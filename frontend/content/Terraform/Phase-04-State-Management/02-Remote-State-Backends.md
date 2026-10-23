# 02 — Remote State Backends

## Table of Contents

1. [Why Remote State](#1-why-remote-state)
2. [Backend Types Overview](#2-backend-types-overview)
3. [Configuring an S3 Backend with DynamoDB Locking](#3-configuring-an-s3-backend-with-dynamodb-locking)
4. [Backend Migration](#4-backend-migration)
5. [Partial Configuration & Backend Config Files](#5-partial-configuration--backend-config-files)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Remote State

Picture a three-person platform team. Priya provisions the VPC on Monday from her laptop. Raj
needs to add a subnet on Tuesday, but his laptop has never seen Priya's `terraform.tfstate` —
it's sitting in a folder on her machine, not in the Git repo (correctly, since it can contain
secrets — see lesson 01, Section 5). Raj runs `terraform apply` and Terraform, seeing an empty
local state, calmly proposes creating a *second* VPC. Nothing about Raj's HCL was wrong — his
Terraform simply had no memory of what Priya already built. This is the exact problem remote
state exists to solve: one shared, authoritative copy of state that every team member and every
CI job reads from and writes to, with a mechanism to stop two people from writing to it at the
same instant.

### Analogy

Local state is a personal notebook. Remote state is a shared Google Doc that the whole team edits
— except this Google Doc has a strict rule built in: only one person can type into it at a time.
While Priya is editing, the document literally locks for everyone else ("Priya is currently
editing…") until she's done. That's remote state plus locking in one sentence: a shared,
single copy, with mutual exclusion enforced automatically.

### Under the Hood

```
                    ┌───────────────────────────────────┐
                    │      REMOTE STATE BACKEND           │
                    │   (e.g., S3 bucket + DynamoDB)      │
                    │                                     │
                    │  terraform.tfstate  (single file)   │
                    │  Lock record: { held_by: "raj" }    │
                    └───────┬──────────────────┬─────────┘
                            │                  │
              read/write via API   read/write via API
                            │                  │
            ┌───────────────▼───┐   ┌─────────▼───────────┐
            │  Priya's laptop    │   │   Raj's laptop        │
            │  terraform apply   │   │   terraform apply     │
            └────────────────────┘   └────────────────────────┘
                            │                  │
                            ▼                  ▼
                  ┌───────────────────────────────────┐
                  │           CI/CD pipeline            │
                  │  (also reads/writes the SAME state) │
                  └───────────────────────────────────┘
```

Two properties matter here, and they're separate concerns even though people often lump them
together:

1. **Shared storage** — the state file lives in one durable, centrally-accessible location (S3,
   Azure Blob, GCS, Terraform Cloud) instead of on any one person's disk. Everyone's `terraform
   init` points at the same backend config, so everyone reads the same truth.
2. **Locking** — before writing to state, Terraform acquires a lock (e.g., a row in a DynamoDB
   table, or a native lock feature of the backend). If someone else holds the lock, your `apply`
   blocks (or fails, depending on flags) instead of racing to write at the same time. This
   prevents two concurrent applies from corrupting the file or double-applying changes to the same
   resource.

### Example — What Breaks Without Locking

```bash
# Both Priya and Raj run `terraform apply` within the same 5 seconds,
# against a *shared* S3 backend that has NO DynamoDB locking configured:

Priya's terminal:                      Raj's terminal:
$ terraform apply                      $ terraform apply
Reading state... (serial=12)           Reading state... (serial=12)
Planning...                            Planning...
Applying...                            Applying...
Writing state... (serial=13)           Writing state... (serial=13)
# ^ LAST WRITE WINS — whichever apply finishes last silently
#   overwrites the other's changes in the state file, even though
#   BOTH sets of real infrastructure changes actually happened.
#   Terraform's state is now out of sync with reality for one of them.
```

With locking enabled, Raj's `apply` would instead show:

```
Error: Error acquiring the state lock

Lock Info:
  ID:        8f3a1c2d-...
  Path:      my-org-tfstate/prod/network/terraform.tfstate
  Operation: OperationTypeApply
  Who:       priya@platform-team
  Created:   2026-07-20 10:03:12 UTC

Terraform acquires a state lock to protect the state from being written
by multiple users at the same time. Please resolve the issue above and try
again.
```

### Comparison Table

| Dimension | Local State | Remote State |
|-----------|-------------|---------------|
| Shared visibility | One machine only | All team members + CI |
| Locking | None | Native (backend-dependent) |
| Durability | Tied to one disk | Durable object storage, often versioned |
| Secrets exposure | Plaintext file on a laptop | Encrypted at rest, IAM/RBAC controlled |
| CI/CD friendly | No | Yes |
| Setup effort | Zero (default) | One-time backend config + bootstrap resources |

### Common Confusion

People sometimes think "remote state" and "state locking" are the same feature. They're not —
some backends provide storage without locking (a plain unlocked network file share, for instance),
and it's entirely possible to misconfigure a remote backend without locking enabled. Always
verify both: is state centrally stored, *and* is a lock acquired on every write?

### Interview Answer

"Remote state moves `terraform.tfstate` out of a single person's local disk into a shared,
centrally accessible backend like an S3 bucket, Azure Blob container, or Terraform Cloud
workspace. This solves two problems at once: everyone — teammates and CI pipelines alike — reads
and writes the same authoritative state, eliminating the 'my Terraform doesn't know what your
Terraform created' problem; and most remote backends support locking, so Terraform acquires a
lock before writing state, preventing two concurrent applies from corrupting the file or racing on
the same resource."

> **Memory hook:** Remote state is a shared Google Doc with a built-in 'someone else is editing' lock — not everyone scribbling in their own private notebook.

---

## 2. Backend Types Overview

You've decided you need remote state. Now: *which* backend? Terraform supports several, and the
right choice depends heavily on which cloud you're already standardized on, and how much extra
tooling (locking tables, IAM policies) you're willing to manage yourself versus getting for free.
This section is a map of the territory before we zoom into the most common real-world choice: S3 +
DynamoDB.

### Analogy

Think of backend types as different kinds of shared safety-deposit boxes. A local file is keeping
cash under your own mattress. An S3 bucket is a safety-deposit box at your own bank branch — you
manage the key and the locking mechanism yourself (DynamoDB). Terraform Cloud is a full-service
vault company — they hand you the box, manage the lock, keep an audit log of every visit, and
even manage who's authorized to open it.

### Backend Comparison Table

| Backend | Storage Location | Native Locking | Encryption at Rest | Typical Use Case |
|---------|-------------------|-----------------|----------------------|--------------------|
| `local` | Disk on the machine running Terraform | No | No (unless disk-level) | Solo experimentation, learning, throwaway sandboxes |
| `s3` | AWS S3 bucket | Yes — via DynamoDB table (pre-1.10) or native S3 locking (1.10+, using S3 conditional writes) | Yes — SSE-S3 or SSE-KMS | AWS-native teams; the most common production choice |
| `azurerm` | Azure Storage Account blob container | Yes — native blob lease locking | Yes — Storage Service Encryption | Azure-native teams |
| `gcs` | Google Cloud Storage bucket | Yes — native GCS object locking | Yes — Google-managed or CMEK | GCP-native teams |
| `remote` / `cloud` block (Terraform Cloud/Enterprise) | HCP Terraform-managed storage | Yes — built-in, plus run queueing (serializes entire applies, not just state writes) | Yes — managed by HashiCorp, plus audit logging | Multi-cloud teams, teams wanting policy-as-code (Sentinel/OPA), remote execution |
| `kubernetes` | A Kubernetes Secret | Yes — via Lease objects | Depends on cluster's secret encryption config | Teams already centralizing everything around Kubernetes |
| `http` | Any HTTP endpoint implementing the state API | Optional, backend-dependent | Depends on the endpoint | Custom/self-hosted state servers |

### Under the Hood — Where Locking Actually Lives

```
   S3 BACKEND (classic, pre-1.10 pattern)
   ┌─────────────────────┐        ┌───────────────────────────┐
   │  S3 bucket            │        │  DynamoDB table            │
   │  terraform.tfstate    │◄──────►│  LockID (primary key)       │
   │  (the actual state)   │  lock  │  Info (who, when, op type)  │
   └─────────────────────┘  check   └───────────────────────────┘
     Terraform writes state         Terraform writes/deletes a
     content HERE                  lock ROW here before/after
                                    touching the state object

   AZURERM / GCS BACKENDS (native locking, no second resource needed)
   ┌───────────────────────────────────────────────────────────┐
   │  Storage account / bucket                                    │
   │  terraform.tfstate  +  a native "lease"/"generation" lock    │
   │  attached to the SAME object — no separate lock table         │
   └───────────────────────────────────────────────────────────┘
```

S3 historically needed a *separate* DynamoDB table for locking because S3 itself had no
conditional-write/lock primitive. Azure's blob storage and GCS both have native object leasing/
generation-based locking built in, so those backends don't need a second resource. (Newer
Terraform + AWS provider versions also support S3-native locking via conditional writes,
removing the DynamoDB dependency — but DynamoDB locking remains extremely common in existing
production configs and is what most documentation and interviews still assume.)

### Example — Minimal Config Per Backend Type

```hcl
# local (the default — no backend block needed at all)
# Terraform just writes ./terraform.tfstate

# s3
terraform {
  backend "s3" {
    bucket         = "my-org-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

# azurerm
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "tfstateacct001"
    container_name       = "tfstate"
    key                  = "prod.network.tfstate"
  }
}

# gcs
terraform {
  backend "gcs" {
    bucket = "my-org-tfstate"
    prefix = "prod/network"
  }
}

# remote (Terraform Cloud)
terraform {
  cloud {
    organization = "my-org"
    workspaces {
      name = "prod-network"
    }
  }
}
```

### Common Mistakes

- **Picking a backend that doesn't match your cloud.** Using a `gcs` backend for a purely
  AWS-hosted project adds an unnecessary second cloud dependency just for state. Match the
  backend to the cloud (or cloud-neutral tooling) your org already trusts.
- **Forgetting locking exists as a separate concept from storage.** Some teams configure `s3` as a
  backend and stop there, without adding `dynamodb_table` — this technically "works" until two
  people apply concurrently and silently corrupt state.
- **Assuming all backends support workspaces the same way.** `local` and `s3` support Terraform
  CLI workspaces (`terraform workspace new`) by prefixing state file paths; Terraform Cloud has its
  own distinct workspace concept that maps roughly 1:1 with a backend "workspace" but has extra
  UI/API features layered on top (covered in Phase 07).

### Interview Answer

"Terraform backends fall into a few categories: `local` for single-machine use with no locking;
cloud object-storage backends (`s3`, `azurerm`, `gcs`) that store state centrally and add locking
either via a companion resource (S3 classically needed a DynamoDB table) or native object leasing
(Azure, GCS); and the `cloud`/`remote` backend for Terraform Cloud or Enterprise, which adds
locking, remote execution, run queueing, and policy enforcement on top of storage. The right
choice usually just matches whichever cloud provider the organization is already standardized on,
since that minimizes the number of credential sets and IAM policies you need to manage."

> **Memory hook:** `local` is cash under your mattress, `s3`/`azurerm`/`gcs` are a bank safety-deposit box you still manage the lock for, and Terraform Cloud is a full-service vault company that manages the lock, the audit log, and the guest list for you.

---

## 3. Configuring an S3 Backend with DynamoDB Locking

You've picked S3 because your org is all-in on AWS. Now you need the actual moving parts: a bucket
to hold the state object, and a DynamoDB table to hold the lock record. This is the single most
common production Terraform backend setup in the wild, so it's worth building end-to-end.

### Analogy

The S3 bucket is the shared filing cabinet drawer holding the one master manifest document. The
DynamoDB table is the "in use" sign that hangs on the drawer handle — before anyone opens the
drawer to write, they check for the sign; if it's there, they wait outside; if not, they hang the
sign themselves, do their edit, then take the sign back down.

### Under the Hood

```
┌──────────────────────────────────────────────────────────────────┐
│                      terraform apply (Priya)                      │
└───────────────────────────────┬────────────────────────────────────┘
                                 │
                1. Attempt to acquire lock
                                 ▼
             ┌──────────────────────────────────┐
             │  DynamoDB table: terraform-locks   │
             │  PutItem (conditional: item must    │
             │  NOT already exist for this LockID) │
             └───────────────┬──────────────────┘
                             │  success (no existing lock)
                             ▼
             ┌──────────────────────────────────┐
             │  S3 bucket: my-org-tfstate         │
             │  GetObject (read current state)    │
             │  ... plan/apply happens ...        │
             │  PutObject (write new state)        │
             └───────────────┬──────────────────┘
                             │
                2. Release lock
                             ▼
             ┌──────────────────────────────────┐
             │  DynamoDB: DeleteItem for LockID    │
             └──────────────────────────────────┘

If Raj tries to acquire the SAME LockID while Priya's PutItem condition
check is still in place, his conditional PutItem FAILS (item already
exists) → Terraform surfaces "Error acquiring the state lock" and Raj's
apply stops before touching S3 at all.
```

### Example — Bootstrapping the Backend Resources

You can't put the S3 bucket and DynamoDB table for your backend *inside* the same Terraform
config that uses that backend (chicken-and-egg problem). Bootstrap them once, typically with a
small separate Terraform config using local state, or manually via CLI:

```hcl
# bootstrap/main.tf  — run this ONCE with local state, before anyone points
# a "real" project's backend at these resources.

resource "aws_s3_bucket" "tfstate" {
  bucket = "my-org-tfstate"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }
}
```

Now, in the *real* project config, point Terraform at those bootstrapped resources:

```hcl
# prod/network/backend.tf
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-org-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

```bash
$ terraform init

Initializing the backend...

Successfully configured the backend "s3"! Terraform will automatically
use this backend unless the backend configuration changes.

Initializing provider plugins...
...
Terraform has been successfully initialized!
```

The `key` attribute is the object path *within* the bucket — this is how a single bucket can hold
state for many different projects/environments (`prod/network/terraform.tfstate`,
`staging/network/terraform.tfstate`, `prod/database/terraform.tfstate`, etc.), each with its own
independent lock in the same DynamoDB table (the `LockID` is derived from bucket + key, so
different keys never contend for the same lock).

### Comparison: DynamoDB Locking vs S3-Native Locking (Terraform 1.10+)

| Aspect | DynamoDB Table Locking | S3-Native Locking (`use_lockfile`, 1.10+) |
|--------|--------------------------|----------------------------------------------|
| Extra AWS resource needed | Yes — a DynamoDB table | No — uses S3 conditional writes only |
| Additional IAM permissions | `dynamodb:PutItem/DeleteItem/GetItem` on the table | Just S3 permissions, no DynamoDB IAM needed |
| Cost | Small (pay-per-request DynamoDB is cheap but non-zero) | No additional cost |
| Maturity / adoption | Battle-tested since Terraform 0.9-era, used almost everywhere | Newer; check your Terraform + provider version support before relying on it in production |
| Config | `dynamodb_table = "terraform-locks"` | `use_lockfile = true` |

### Common Mistakes

- **Forgetting `prevent_destroy` on the bucket/table.** An accidental `terraform destroy` in the
  bootstrap config would delete the very thing every other project's state depends on.
- **Reusing the same `key` for two different environments.** If `staging` and `prod` configs both
  point at `key = "network/terraform.tfstate"`, they'll silently share (and corrupt) each other's
  state. Always give each environment/component a distinct key path.
- **Not enabling bucket versioning.** Versioning is your safety net — if state ever gets corrupted
  or wrongly overwritten, you can restore a previous object version.
- **Granting overly broad IAM permissions to the CI role.** The CI role only needs `s3:GetObject`,
  `s3:PutObject`, `s3:ListBucket` on the specific key prefix, and `dynamodb:GetItem/PutItem/
  DeleteItem` on the lock table — not full `s3:*`/`dynamodb:*`.

### Interview Answer

"An S3 backend with DynamoDB locking stores the actual state JSON as an object in an S3 bucket,
keyed by a path you choose — which lets one bucket hold state for many projects. Locking works via
a DynamoDB table with a `LockID` primary key: before writing, Terraform does a conditional
`PutItem` that only succeeds if no lock item already exists for that key; if it fails, someone else
holds the lock and your operation errors out immediately instead of racing. You typically bootstrap
the bucket and table once, outside of the project that will actually use them, since a config can't
reference a backend it's simultaneously trying to create. Best practice adds bucket versioning
and SSE-KMS encryption, and scopes IAM narrowly to just the needed S3 and DynamoDB actions."

> **Memory hook:** S3 is the shared filing cabinet holding the manifest; DynamoDB is the 'in use' sign on the drawer handle — check the sign before you open the drawer, hang it up while you write, take it down when you're done.

---

## 4. Backend Migration

You started a project with `local` state because it was quick, and now the team has grown and
you need to move to S3. Do you lose all your existing state — every EC2 instance ID, every
mapping Terraform has painstakingly built up? No — Terraform has a first-class, built-in flow for
exactly this: changing (or adding) a `backend` block and re-running `terraform init`, which
detects the change and offers to copy your existing state into the new location.

### Analogy

Moving backends is like transferring the contents of your personal notebook into the shared
company filing cabinet. You don't have to retype anything by hand — you literally photocopy every
page of your notebook and file the copies into the cabinet in one motion. Terraform does this
copy-and-confirm dance automatically when it detects your backend configuration changed.

### Under the Hood

```
BEFORE:                                     AFTER (backend block added/changed):
main.tf                                     main.tf
  (no backend block →                         terraform {
   implicitly using "local")                    backend "s3" {
                                                   bucket = "my-org-tfstate"
                                                   key    = "prod/network/terraform.tfstate"
                                                   region = "us-east-1"
                                                   ...
                                                 }
                                               }

$ terraform init

Terraform detects the backend configuration changed and prompts:

  Initializing the backend...
  Backend configuration changed!

  Terraform has detected that the configuration specified for the backend
  has changed. Terraform will now check for existing state in the backends.

  Do you want to copy existing state to the new backend?
    Pre-existing state was found while migrating the previous "local"
    backend to the newly configured "s3" backend. An existing
    non-empty state already exists in the new backend. The two states have
    been merged. [...]

    Enter "yes" to confirm and continue with the migration.

  Enter a value: yes

  Successfully configured the backend "s3"! Terraform will automatically
  use this backend unless the backend configuration changes.
```

### Example — Full Migration Walkthrough

```hcl
# Step 1: existing config, currently using local state
# main.tf (no backend block yet)
resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd"
  instance_type = "t3.micro"
}
```

```bash
# Confirm current state is local
$ ls
main.tf  terraform.tfstate
```

```hcl
# Step 2: add the backend block
# main.tf
terraform {
  backend "s3" {
    bucket         = "my-org-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd"
  instance_type = "t3.micro"
}
```

```bash
# Step 3: re-init and migrate
$ terraform init -migrate-state

Initializing the backend...
Backend configuration changed!

Do you want to copy existing state to the new backend?
  Enter "yes" to confirm and continue with the migration.

Enter a value: yes

Successfully configured the backend "s3"!

# Step 4: verify
$ terraform state list
aws_instance.web
# ^ same resources, now tracked in the S3 object instead of the local file.

# Step 5: once confirmed, it's safe to delete the old local file
# (Terraform does NOT auto-delete it for you)
$ rm terraform.tfstate terraform.tfstate.backup
```

### Comparison: `-migrate-state` vs `-reconfigure`

| Flag | Behavior | When to Use |
|------|----------|--------------|
| `terraform init -migrate-state` | Copies existing state from the old backend into the new one, prompting for confirmation | Changing backend type/config and you want to KEEP existing state |
| `terraform init -reconfigure` | Reconfigures the backend WITHOUT attempting to migrate/copy old state | Old state is irrelevant/already empty, or you deliberately want a fresh start |
| `terraform init` (backend changed, no flag) | Terraform detects the change and interactively prompts you to choose | Interactive use — CI should use an explicit flag instead |

### Common Mistakes

- **Running plain `terraform init` non-interactively in CI after a backend change.** Without
  `-migrate-state` or `-reconfigure`, CI will hang waiting for a prompt it can never answer, or
  fail depending on `-input=false` settings. Always pass an explicit flag in automation.
- **Forgetting to delete the old local state file after migration.** It's harmless once migrated
  (Terraform will use the new backend going forward), but leaving it around invites confusion —
  or worse, someone accidentally runs `terraform apply` from a directory where the backend block
  got reverted, silently reading the stale local copy again.
- **Migrating without a backup.** Always keep the automatic `terraform.tfstate.backup` Terraform
  creates during migration until you've fully verified the new backend, and consider a manual
  `terraform state pull > backup.json` before any migration as extra insurance.

### Interview Answer

"When you add or change a `backend` block, `terraform init` detects the configuration diff and
offers to migrate existing state into the new backend automatically — you don't need to manually
recreate any resource mappings. In automation you pass an explicit flag: `-migrate-state` to copy
the old state into the new backend, or `-reconfigure` if you deliberately don't want that copy.
After confirming the new backend works — usually via `terraform plan` showing no unexpected
changes and `terraform state list` showing the same resources — it's safe to delete the old local
state file, which Terraform never removes automatically."

> **Memory hook:** Migrating backends is photocopying your personal notebook into the shared filing cabinet in one motion — `terraform init` is the copier, `-migrate-state` is you pressing the "copy" button instead of walking away with an empty folder.

---

## 5. Partial Configuration & Backend Config Files

Here's a problem: your S3 bucket name is different for `dev`, `staging`, and `prod` — and you
really don't want to hardcode any of that, or worse, put a hardcoded AWS account ID in a `.tf`
file that's checked into a public-ish repo. Terraform's `backend` block famously **cannot use
variables** (`bucket = var.env_bucket` is not allowed — the backend has to be resolvable before
Terraform has even loaded your variable values). The escape hatch is **partial configuration**:
you leave some or all backend settings out of the `.tf` file, and supply them separately at
`terraform init` time.

### Analogy

Think of the `backend` block in your `.tf` file as a shipping label template that says "Deliver
to: ___________". You can't write the destination address as a formula ("whatever city variable
X resolves to") — shipping labels need a literal address before the truck leaves the depot. So
instead, you keep several separate filled-in address slips (`dev.backend.hcl`, `prod.backend.hcl`)
and hand the depot worker the right slip at dispatch time (`terraform init -backend-config=...`).

### Under the Hood

```
main.tf:
  terraform {
    backend "s3" {
      key    = "network/terraform.tfstate"   # can stay hardcoded if shared
      region = "us-east-1"
      # bucket, dynamodb_table deliberately OMITTED — partial config
    }
  }

environments/dev.backend.hcl:
  bucket         = "my-org-tfstate-dev"
  dynamodb_table = "terraform-locks-dev"

environments/prod.backend.hcl:
  bucket         = "my-org-tfstate-prod"
  dynamodb_table = "terraform-locks-prod"

               ┌─────────────────────────────────────┐
$ terraform init -backend-config=environments/dev.backend.hcl
               │  Terraform MERGES:                    │
               │   main.tf backend block                │
               │        +                                │
               │   dev.backend.hcl values                │
               │  = fully resolved backend config         │
               └─────────────────────────────────────┘
```

Three ways to supply the missing pieces (usable individually or combined):

1. A separate `.hcl` file passed with `-backend-config=path/to/file.hcl`.
2. Individual key/value flags: `-backend-config="bucket=my-org-tfstate-dev"`.
3. Interactive prompts — if you run `terraform init` with pieces missing and no flags, Terraform
   will prompt for each missing value (rarely desirable in CI).

### Example — Full Multi-Environment Setup

```hcl
# main.tf — shared across all environments
terraform {
  required_version = ">= 1.7"

  backend "s3" {
    key     = "network/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
    # bucket and dynamodb_table intentionally omitted here
  }
}
```

```hcl
# backends/dev.hcl
bucket         = "my-org-tfstate-dev"
dynamodb_table = "terraform-locks-dev"
```

```hcl
# backends/prod.hcl
bucket         = "my-org-tfstate-prod"
dynamodb_table = "terraform-locks-prod"
```

```bash
# Dev
$ terraform init -backend-config=backends/dev.hcl

# Prod (in CI, e.g., a GitHub Actions job matrix step)
$ terraform init -backend-config=backends/prod.hcl -input=false
```

```bash
# Or purely with inline flags, no files at all:
$ terraform init \
    -backend-config="bucket=my-org-tfstate-dev" \
    -backend-config="dynamodb_table=terraform-locks-dev"
```

### Comparison Table

| Approach | Pros | Cons |
|----------|------|------|
| Fully hardcoded backend block | Simplest to read | Can't vary per environment; risks hardcoding sensitive names |
| Partial config + `.hcl` file per environment | Clean separation, easy to diff environments, file is reusable in CI | One more file to keep in sync per environment |
| Partial config + inline `-backend-config` flags | No extra files, good for scripted/parameterized CI | Less readable, easy to typo a flag in a shell script |
| Terraform Cloud `cloud` block | No backend variables problem at all — workspace selection can use `TF_WORKSPACE` env var | Ties you to Terraform Cloud/Enterprise workflow |

### Common Mistakes

- **Trying to interpolate a variable directly into the `backend` block.** `bucket =
  var.bucket_name` fails to parse — the backend block is evaluated before variables are resolved,
  by design (Terraform needs to know where state lives before it can even load the rest of the
  config that might define those variables).
- **Forgetting `-reconfigure` when switching between environment config files in the same local
  directory.** If you `init` for `dev` and later `init` for `prod` in the same working directory
  without `-reconfigure`, Terraform may try to "migrate" dev's state into prod's bucket, which is
  almost never what you want. Either use `-reconfigure` (clean switch, no migration attempted) or
  keep separate working directories/CI jobs per environment.
- **Checking backend `.hcl` files into a public repo with account IDs baked into bucket names.**
  If bucket names must stay private, keep those files in a private repo or inject via CI secrets
  instead of a checked-in `.hcl`.

### Interview Answer

"Terraform's `backend` block cannot reference variables, because the backend must be resolved
before Terraform loads the rest of the configuration, including variable definitions. Partial
configuration solves this: you specify only the parts that don't vary (like `region`) directly in
the `.tf` file, and leave environment-specific values (`bucket`, `dynamodb_table`) out. At `init`
time you supply them via `-backend-config=path/to/file.hcl`, individual `-backend-config="key=value"`
flags, or — if you don't pass any — Terraform interactively prompts for each missing value. This
lets one shared `.tf` file drive dev, staging, and prod backends without hardcoding secrets or
duplicating the whole backend block per environment."

> **Memory hook:** The backend block is a shipping label that can't say "whatever city variable X resolves to" — you keep separate filled-in address slips per destination and hand the right one to the depot worker at dispatch time (`terraform init -backend-config=...`).

---

## 6. Common Mistakes

A consolidated list of the highest-impact remote-backend mistakes, gathered across the sections
above, worth reviewing together before moving on:

1. **No locking configured at all.** An `s3` backend without `dynamodb_table` (or native S3
   locking) "works" right up until two people apply concurrently.
2. **Reusing the same state `key` across environments.** Distinct environments must have distinct
   object keys or workspace prefixes — sharing a key silently merges unrelated infrastructure.
3. **Skipping bucket/table bootstrapping safeguards.** No `prevent_destroy`, no versioning, no
   encryption — leaves your single most critical piece of Terraform infrastructure fragile.
4. **Non-interactive backend changes in CI without an explicit flag.** Plain `terraform init`
   after a backend change will hang or fail in CI; always pass `-migrate-state` or `-reconfigure`
   explicitly.
5. **Trying to variable-ize the `backend` block directly.** Use partial configuration instead.
6. **Overly broad IAM permissions for the backend resources.** Scope down to exactly the S3/
   DynamoDB (or Azure/GCS equivalent) actions actually needed.
7. **Committing backend `.hcl` files with sensitive account-specific details to a public repo.**
   Treat bucket/account names with the same care as other infra secrets when repo visibility is a
   concern.

> **Memory hook:** Most remote-backend incidents trace back to one of two root causes — "we forgot to configure locking" or "we let two environments share the same drawer" — check those two first.

---

## 7. Hands-On Exercises

**Exercise 1 — Bootstrap a Real S3 Backend**
Using a throwaway AWS account/sandbox, write a small Terraform config (using local state) that
creates an S3 bucket with versioning + SSE-KMS encryption, and a DynamoDB table with `LockID` as
the hash key. Apply it.

**Exercise 2 — Migrate Local to Remote**
Create a second, separate Terraform config with a single `null_resource` (or a cheap real
resource) using local state. Add an `s3` backend block pointing at the bucket/table from Exercise
1, then run `terraform init -migrate-state`. Confirm with `terraform state list` that your
resource still shows up after migration.

**Exercise 3 — Simulate a Lock Conflict**
In one terminal, start a `terraform apply` and pause at the "yes/no" confirmation prompt (don't
answer yet). In a second terminal, in the same directory, run `terraform plan`. Observe and explain
the "Error acquiring the state lock" message, including the `Who` and `Created` fields it reports.

**Exercise 4 — Partial Configuration for Two Environments**
Refactor Exercise 2's config to use partial backend configuration: put `region` and `key` directly
in the `.tf` file, and put `bucket`/`dynamodb_table` into two separate files, `dev.hcl` and
`prod.hcl`, pointing at two different (real or imagined) bucket names. Run `terraform init
-backend-config=dev.hcl -reconfigure`, then `terraform init -backend-config=prod.hcl -reconfigure`,
and describe what happens to your local `.terraform` directory each time.

**Exercise 5 — Backend Type Trade-off Memo**
Write a short memo (5-8 sentences) recommending a backend choice for a company that is currently
100% AWS but is evaluating a multi-cloud strategy over the next two years, and already uses
Sentinel-style policy-as-code gates in other tooling. Justify your recommendation using the
comparison table in Section 2.

---

## 8. Interview Q&A

---

**Q1: Why can't you use a variable inside a `backend` block?**

A: The backend configuration must be resolved before Terraform has loaded the rest of the
configuration, including provider blocks and variable definitions — the backend is what tells
Terraform *where to even find the state that would let it evaluate anything else*. Since
variables aren't available yet at that point, Terraform disallows interpolation there. Partial
configuration (supplying missing backend values via `-backend-config` at `init` time) is the
supported workaround.

---

**Q2: What two distinct problems does a remote backend solve, and are they always both present?**

A: Shared/centralized storage (everyone reads/writes the same state object) and locking
(preventing concurrent writes from racing or corrupting state). They're separate concerns — it's
possible to have shared storage without locking configured, which still risks corruption under
concurrent applies. A properly configured production backend needs both.

---

**Q3: Why did the classic S3 backend need a DynamoDB table?**

A: S3 historically had no built-in conditional-write/locking primitive that Terraform could use
safely to implement mutual exclusion. DynamoDB, with its atomic conditional `PutItem` (fails if an
item with that key already exists), provided exactly the primitive needed: a lock record keyed by
`LockID`, acquired before writing state and released after. Newer Terraform/AWS provider versions
added S3-native locking via conditional writes, removing the DynamoDB dependency, but the
DynamoDB pattern remains extremely widespread in existing production setups.

---

**Q4: What's the difference between `terraform init -migrate-state` and `-reconfigure`?**

A: `-migrate-state` copies existing state from the old backend into the newly configured backend,
prompting for confirmation. `-reconfigure` switches to the new backend configuration without
attempting to copy any existing state — useful when old state is irrelevant or you want a
guaranteed clean slate, such as when switching between environment-specific backend config files
in the same working directory.

---

**Q5: How do you handle different S3 bucket names for dev/staging/prod without hardcoding them
in your `.tf` files?**

A: Use partial backend configuration: put the values that don't vary (e.g., `region`) directly in
the `backend "s3" {}` block, and omit the values that do vary (`bucket`, `dynamodb_table`).
Supply the missing values at `terraform init` time via `-backend-config=environments/dev.hcl` (or
equivalent per-environment file), or via individual `-backend-config="key=value"` flags in CI.

---

**Q6: What happens if two people run `terraform apply` at the same time against a properly
locked remote backend?**

A: Whoever acquires the lock first (via a successful conditional write to the lock table/lease)
proceeds normally. The second person's Terraform fails fast with an "Error acquiring the state
lock" message, showing who currently holds the lock and when they acquired it, and does not
attempt to write to state — preventing corruption or a lost update.

---

**Q7: Name three hardening steps you'd apply to a production S3 state bucket.**

A: Enable versioning (recover from accidental bad writes), enable server-side encryption
(preferably SSE-KMS for tighter key control), and restrict IAM access via bucket policy so only
the specific CI role and designated admins can read/write the relevant key prefix — plus setting
`prevent_destroy` on the bucket and lock table in whatever config bootstraps them.

---

**Q8: Why must the S3 bucket and DynamoDB table for a backend usually be created in a *separate*
Terraform config from the project that uses them?**

A: A configuration cannot reference the backend it is itself trying to create — Terraform needs
to know where to store/read state before it can process any resource blocks, including ones that
would create that very backend. So the bucket and lock table are typically bootstrapped once via
a small separate config (often using local state, since it only needs to run rarely), and later
projects simply point their `backend "s3"` block at the already-existing bucket and table.
