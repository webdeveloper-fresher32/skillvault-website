# 01 — Terraform State Deep Dive

## Table of Contents

1. [Why State Exists](#1-why-state-exists)
2. [Anatomy of terraform.tfstate](#2-anatomy-of-terraformtfstate)
3. [State as Source of Truth vs Real Infra](#3-state-as-source-of-truth-vs-real-infra)
4. [Local State Risks](#4-local-state-risks)
5. [Sensitive Data in State](#5-sensitive-data-in-state)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why State Exists

Imagine you write a Terraform config that declares one `aws_instance`, run `terraform apply`,
and it creates an EC2 instance for you — say `i-0abc123def456`. A week later, you add a `tags`
block to that same resource and run `apply` again. How does Terraform know that this HCL block
you just edited refers to *that exact* instance, and not "go create a brand-new EC2 instance,
please"? Your `.tf` file doesn't contain `i-0abc123def456` anywhere — you never typed an instance
ID. Something has to remember the mapping between "the resource named `aws_instance.web` in your
config" and "the real object with ID `i-0abc123def456` sitting in AWS." That something is
Terraform **state**.

Without state, every `terraform apply` would be flying blind: Terraform would have no way to
distinguish "this resource already exists, just update it" from "this resource has never been
created, make a new one." State is the memory that makes incremental, declarative infrastructure
management possible at all.

### Analogy

Think of state as a **shipping manifest** for a cargo ship. The ship (your real infrastructure)
carries hundreds of containers (resources). The captain's paperwork (config) says "we should be
carrying a container of electronics, a container of textiles, and a container of machinery." But
paperwork alone doesn't tell you *which physical container*, sitting in *which exact slot*, is the
electronics one. The manifest bridges the two: "electronics = container #4521, currently in
bay 12." Terraform state is that manifest — it maps abstract declarations to concrete, addressable
real-world objects.

### Under the Hood

```
┌──────────────────────────┐        ┌──────────────────────────┐
│   YOUR .tf CONFIG          │        │   REAL WORLD (AWS)        │
│                            │        │                            │
│ resource "aws_instance"    │        │  EC2 instance              │
│   "web" {                  │        │  i-0abc123def456           │
│   ami           = "ami-x"  │        │  ami-x, t3.micro            │
│   instance_type = "t3.micro│        │  running in us-east-1a      │
│ }                          │        │                            │
└─────────────┬─────────────┘        └─────────────▲──────────────┘
             │                                     │
             │        terraform.tfstate            │
             │   ┌─────────────────────────────┐   │
             └──►│ aws_instance.web  ──────────►│───┘
                 │   id = "i-0abc123def456"      │
                 │   ami = "ami-x"               │
                 │   instance_type = "t3.micro"  │
                 └─────────────────────────────┘
```

When you run `terraform apply`, Terraform performs three steps every single time:

1. **Read state** — load the last known mapping of config addresses to real object IDs.
2. **Refresh** — (by default, as part of plan) call the provider API to check the *current* real
   values for those tracked objects, so it can detect drift.
3. **Diff** — compare desired config vs. state (and real values) to build an execution plan: create,
   update in place, destroy-and-recreate, or no-op.

Without step 1, step 3 is impossible — there'd be nothing to diff *against*, and Terraform would
default to "I've never seen this resource address before, so create it," even if the real
resource already exists.

### Example

```hcl
# main.tf
resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd"
  instance_type = "t3.micro"

  tags = {
    Name = "web-server"
  }
}
```

```bash
$ terraform apply
# Terraform creates the instance, then writes to terraform.tfstate:
#   aws_instance.web -> id = "i-0abc123def456"

$ terraform apply
# You edit tags.Name to "web-server-prod" and re-run.
# Terraform reads state, sees aws_instance.web already maps to i-0abc123def456,
# and issues an UPDATE (not a CREATE) against that specific instance.
```

### Comparison: With State vs Without State (Hypothetical)

| Behavior | With State | Without State (hypothetical) |
|----------|-----------|-------------------------------|
| Re-running `apply` on unchanged config | No-op ("0 to add, 0 to change, 0 to destroy") | Would try to create duplicates every time |
| Editing a resource attribute | Targeted in-place update | No way to know what to update |
| Deleting a resource block from config | Terraform destroys the matching real resource | No way to know which real resource to destroy |
| Tracking resource dependencies | Dependency graph built from state + config | Impossible to order operations correctly |
| Performance on large infra | Fast — reads state instead of querying everything from scratch | Would require querying/matching all cloud resources every run |

### Common Confusion

A lot of newcomers assume Terraform "scans your cloud account" to figure out what exists. It does
not — by default, Terraform only knows about resources it manages *because they're recorded in
state*. If someone manually creates an EC2 instance in the AWS console, Terraform has zero
awareness of it until you explicitly `terraform import` it into state. State isn't a live view of
your cloud account; it's Terraform's own private ledger of "resources I created and am
responsible for."

### Interview Answer

"Terraform state is a JSON file that maps every resource block in your configuration to the real
identifier of the object it created in the provider's API — like an AWS instance ID or an S3
bucket ARN. It's necessary because HCL config alone is just a declaration of desired end state; it
has no way to reference a specific existing object. State lets `terraform plan`/`apply` diff
'what you want' against 'what you last created' to compute a minimal set of API calls, instead of
re-creating everything on every run."

> **Memory hook:** State is the shipping manifest that says which physical container corresponds to which line item on the packing list — without it, Terraform can't tell "update this" from "create a new one."

---

## 2. Anatomy of terraform.tfstate

You've run `terraform apply` and now there's a `terraform.tfstate` file sitting next to your
`.tf` files. Someone tells you "never hand-edit that file" but also "you can `cat` it if you're
curious." So — what's actually in there? If you've only ever treated it as an opaque blob, opening
it up demystifies almost every state-related error message you'll ever see (`resource already
exists`, `state lock`, `provider produced inconsistent result`, etc.), because those errors are
almost always about a mismatch between what's *in this file* and what's really out there.

### Analogy

`terraform.tfstate` is like a detailed inventory spreadsheet a warehouse manager keeps — not just
"we have a box of shirts," but the exact SKU, warehouse aisle, quantity, and which specific
purchase order it came from. Every row also lists any other rows it depends on ("this pallet of
finished t-shirts depends on the fabric roll in aisle 3 being received first"). You never edit the
spreadsheet by hand with a pen — you use the barcode scanner (Terraform CLI), and the spreadsheet
updates itself correctly.

### Under the Hood — Full Structure Walkthrough

```json
{
  "version": 4,
  "terraform_version": "1.7.5",
  "serial": 12,
  "lineage": "8e0a3c1e-4f2b-4a11-9c77-2b6f5e9d1a90",
  "outputs": {
    "instance_ip": {
      "value": "54.203.10.44",
      "type": "string"
    }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "aws_instance",
      "name": "web",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "schema_version": 1,
          "attributes": {
            "id": "i-0abc123def456",
            "ami": "ami-0c101f26f147fa7fd",
            "instance_type": "t3.micro",
            "arn": "arn:aws:ec2:us-east-1:123456789012:instance/i-0abc123def456",
            "private_ip": "10.0.1.23",
            "public_ip": "54.203.10.44",
            "tags": {
              "Name": "web-server"
            }
          },
          "sensitive_attributes": [],
          "dependencies": [
            "aws_security_group.web_sg"
          ]
        }
      ]
    },
    {
      "mode": "managed",
      "type": "aws_security_group",
      "name": "web_sg",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "schema_version": 1,
          "attributes": {
            "id": "sg-0a1b2c3d4e5f6",
            "name": "web-sg",
            "vpc_id": "vpc-0123abcd"
          },
          "sensitive_attributes": [],
          "dependencies": []
        }
      ]
    }
  ],
  "check_results": null
}
```

Field-by-field breakdown:

| Field | Meaning |
|-------|---------|
| `version` | The state file *format* version (schema of the JSON itself), currently `4`. Not the Terraform CLI version. |
| `terraform_version` | The CLI version that last wrote this file — used to warn you if you open an old state with a much newer/older CLI. |
| `serial` | A monotonically increasing counter, bumped every time the state changes. Used to detect "is my local copy stale compared to remote?" |
| `lineage` | A UUID generated once, when the state is first created. All future `serial` bumps share this lineage. If lineage differs between two state files, Terraform treats them as *unrelated histories* (this is what "state lineage mismatch" errors mean). |
| `outputs` | Values from your root module's `output` blocks — this is how `terraform output` and `terraform_remote_state` data sources read values. |
| `resources[]` | One entry per resource *block* (not per instance if using `count`/`for_each` — those live under `instances[]`). |
| `resources[].mode` | `"managed"` (created via `resource` blocks) or `"data"` (read via `data` blocks — data sources are also cached in state). |
| `resources[].provider` | Fully-qualified provider source address, so Terraform knows which provider plugin owns this resource type. |
| `instances[].attributes` | The full flattened set of every attribute Terraform knows about the real object — this is the "manifest" data itself. |
| `instances[].dependencies` | Which other resource addresses this instance depends on — used to build the dependency graph without re-parsing HCL every time. |
| `instances[].sensitive_attributes` | Marks which attribute paths were flagged `sensitive = true`, so the CLI can redact them in plan/apply output (they are still stored in plaintext in the JSON — see Section 5). |

### Example — Reading State Without Editing It

```bash
# Never hand-edit the file. Use the CLI:
terraform show -json terraform.tfstate | jq '.values.root_module.resources[0].values.id'
# "i-0abc123def456"

terraform state list
# aws_instance.web
# aws_security_group.web_sg

terraform state show aws_instance.web
# id               = "i-0abc123def456"
# ami              = "ami-0c101f26f147fa7fd"
# instance_type    = "t3.micro"
# ...
```

### Comparison: State File Versions

| Version | Terraform Era | Notable Change |
|---------|---------------|-----------------|
| v1–v2 | Terraform 0.3–0.6 | Simple flat resource maps, no `lineage`/`serial` |
| v3 | Terraform 0.7–0.11 | Added module nesting, richer resource metadata |
| v4 | Terraform 0.12+ (current) | Attributes stored as flexible JSON values (not just strings) to support complex types (lists, maps, nested objects) introduced by HCL2 |

### Common Mistakes

- **Hand-editing the JSON.** It's tempting to fix a typo directly in `terraform.tfstate`, but a
  single malformed field can corrupt the file so badly that `terraform plan` refuses to run at
  all. Always use `terraform state <subcommand>` (covered in lesson 03) instead.
- **Committing `terraform.tfstate` to Git for a "quick fix."** Even once, this creates a merge
  conflict nightmare and — worse — permanently bakes secrets into your Git history (see Section 5).
- **Assuming `serial` is a resource count.** It's a *revision* counter for the whole file, not a
  count of resources.

### Interview Answer

"The state file is JSON with a handful of top-level fields: `version` for the state schema,
`terraform_version` and `serial`/`lineage` for versioning and staleness detection, `outputs` for
root module output values, and a `resources` array. Each resource entry records its type, name,
owning provider, and an `instances` array holding the full set of real-world attribute values plus
a `dependencies` list used to reconstruct the dependency graph without re-parsing HCL. I read it
with `terraform state show` or `terraform show -json` rather than opening the raw file, since
manual edits can corrupt it."

> **Memory hook:** `terraform.tfstate` is the warehouse inventory spreadsheet — every SKU (resource), its exact bin location (attributes), and what it depends on, kept current by a barcode scanner (the CLI), never by hand.

---

## 3. State as Source of Truth vs Real Infra

Here's an unsettling scenario: your `terraform.tfstate` says a security group only allows port 443
inbound. But last Tuesday, someone on-call opened port 22 directly in the AWS console to
debug an issue at 2 a.m., and forgot to close it. Terraform has no idea this happened — its state
file still says "port 443 only." Which one is "true"? This gap between *what Terraform believes*
(state) and *what actually exists* (real infrastructure) is called **drift**, and understanding it
is the single most important mental model for working with Terraform state safely.

### Analogy

Picture a thermostat with a paper log that a facilities manager fills in by hand every time they
change the setting. If someone walks up to the physical thermostat and changes the temperature
directly — bypassing the log — the paper record now lies. The room is one temperature; the log
says another. Terraform's state is that paper log. It's only accurate if *every* change goes
through Terraform. The moment something changes the real resource outside of Terraform, the log
(state) and the room (real infra) disagree — that's drift.

### Under the Hood

```
                     terraform plan
                     ─────────────

  ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
  │  CONFIG (.tf)  │        │ STATE (belief)│        │ REAL INFRA     │
  │                │        │               │        │ (AWS API)      │
  │ port = 443     │        │ port = 443    │        │ port = 22, 443 │◄── someone
  └───────┬───────┘        └───────┬───────┘        └───────┬───────┘    changed this
          │                        │                        │            by hand
          │      1. Compare config vs state ──► no diff on paper
          │                        │                        │
          │      2. REFRESH: query real infra ──────────────┘
          │                        │
          │      3. Compare refreshed real values vs config
          │                        ▼
          │              DRIFT DETECTED:
          │              "port 22 exists in real infra
          │               but not in config or old state"
          ▼
   Plan shows: ~ update in-place
     - remove port 22 (to match config)
```

Every `terraform plan` (unless run with `-refresh=false`) performs a **refresh** step: for each
resource tracked in state, Terraform calls the provider's "read" API to fetch the current real
values, and silently updates its in-memory copy of state with those real values *before* diffing
against your `.tf` config. This is how Terraform detects drift — not by magic, but by re-asking
the cloud API "what do you actually look like right now?" on every plan.

### Example

```bash
$ terraform plan

aws_security_group.web_sg: Refreshing state... [id=sg-0a1b2c3d4e5f6]

Terraform detected the following changes made outside of Terraform since the
last "terraform apply":

  # aws_security_group.web_sg has been changed
  ~ resource "aws_security_group" "web_sg" {
        id = "sg-0a1b2c3d4e5f6"
      ~ ingress {
          ~ from_port = 443 -> 22
        }
    }

Unless you have made equivalent changes to your configuration, or ignored the
relevant attributes using ignore_changes, the following plan may include
actions to undo or respond to these changes.

Plan: 0 to add, 1 to change, 0 to destroy.
```

Terraform's default behavior here is to plan an update that pushes the real resource *back* to
match config — because config is the declared source of truth, and state is just Terraform's
cached belief about reality, refreshed on every run.

### Comparison Table

| Concept | What It Represents | Can Lie/Go Stale? |
|---------|--------------------|--------------------|
| **Config (`.tf` files)** | What you *want* infrastructure to look like — the desired end state, version-controlled | No — it's whatever you wrote, always "true" to itself |
| **State (`terraform.tfstate`)** | What Terraform *believes* it created and currently looks like, as of the last refresh | Yes — becomes stale the instant a resource changes outside Terraform |
| **Real infrastructure** | What actually exists in the cloud provider right now | This is ground truth — everything else is compared against it |

### Common Mistakes

- **Treating state as ground truth.** State is a *cache* of the last known real values, refreshed
  on each plan — it is not itself authoritative. The provider API is ground truth.
- **Assuming Terraform prevents manual changes.** Terraform has no way to lock down a cloud
  console short of IAM permissions — it can only detect and reconcile drift *after the fact*, on
  the next plan/apply.
- **Panicking at every drift warning.** Some drift is expected and safe (e.g., an ASG's
  `desired_capacity` fluctuating with autoscaling) — this is exactly what `ignore_changes` (a
  future-lesson meta-argument) exists for.

### Interview Answer

"Config declares the desired end state, state is Terraform's cached record of what it last
created and its most recently observed real values, and the actual cloud resources are the
ultimate source of truth. On every `plan`/`apply`, Terraform refreshes: it queries the provider
API for each tracked resource's current real values, updates its in-memory state with those, then
diffs that against your config. Any difference between the *previous* state and the *refreshed*
real values is drift — infrastructure that changed outside of Terraform's control, like a manual
console edit."

> **Memory hook:** Config is the wish list, state is the last diary entry about what happened, and the real cloud is what's actually sitting in the room right now — `plan` is Terraform re-reading the room before trusting its diary.

---

## 4. Local State Risks

Picture this: you're the only person who has ever run `terraform apply` for a project, so
`terraform.tfstate` just sits in your project folder on your laptop. It works fine — until your
laptop dies, or a teammate joins and runs `terraform apply` from *their* laptop, which has no idea
your state file exists. Now there are two competing "manifests" for the same real infrastructure,
and the moment your teammate applies, Terraform (seeing no record of your resources) may try to
create duplicates or, worse, mark real resources for destruction because "they're not in my
state." This is the core danger of **local state**: it's a single point of failure and it does not
coordinate across people or machines.

### Analogy

Local state is like keeping the only copy of a shared apartment's master key list in a notebook on
your personal desk. As long as you're the only one who ever locks or unlocks anything, it's fine.
The moment a roommate needs to change a lock and doesn't have your notebook, they either can't
verify what's already been changed, or they start their own notebook — and now there are two
"official" records of the same set of locks, disagreeing with each other.

### Under the Hood

```
   Laptop A (you)                          Laptop B (teammate)
  ┌───────────────────┐                   ┌───────────────────┐
  │ terraform.tfstate  │                   │  (no state file    │
  │  aws_instance.web   │                   │   exists locally)  │
  │  id=i-0abc123       │                   │                    │
  └─────────┬───────────┘                   └─────────┬──────────┘
            │                                        │
            │        Both point at the SAME          │
            │        real AWS account/region          │
            ▼                                        ▼
        ┌─────────────────────────────────────────────────┐
        │              REAL AWS INFRASTRUCTURE              │
        │           i-0abc123def456 (aws_instance.web)      │
        └─────────────────────────────────────────────────┘

Teammate B runs `terraform apply` with their config (same aws_instance.web block)
but an EMPTY local state ──► Terraform believes this resource has never been
created ──► attempts to CREATE a duplicate instance, or (if a name collision
occurs on a uniquely-named resource like an S3 bucket) errors out entirely.
```

Concrete failure modes of local-only state:

1. **No locking** — two people running `apply` at the same time can corrupt the state file or
   race to modify the same real resource, producing an inconsistent result.
2. **No single source of truth** — every laptop's copy can drift from every other laptop's copy.
3. **No durability** — a lost or corrupted laptop disk means the *only* record of what Terraform
   manages is gone. You still have the real infra, but Terraform now has amnesia about it.
4. **Secrets sit unencrypted on disk** — state stores full resource attributes in plaintext JSON
   (see Section 5), and a laptop is far less access-controlled than a locked-down S3 bucket.

### Example — What Actually Happens

```bash
# Teammate B, who has never run apply before on this project:
$ git clone repo && cd repo
$ terraform init
$ terraform apply

# Terraform plan output:
  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami           = "ami-0c101f26f147fa7fd"
      + instance_type = "t3.micro"
      ...
    }

Plan: 1 to add, 0 to change, 0 to destroy.
# ^ This resource ALREADY EXISTS in AWS (created by teammate A) — Terraform B
#   just doesn't know that, because it never saw A's local state file.
```

### Comparison: Local State vs Remote State (Preview)

| Risk | Local State | Remote State (covered in lesson 02) |
|------|-------------|--------------------------------------|
| Team visibility | Only on one machine | Centralized, shared by whole team |
| Locking | None | Native locking (e.g., S3 + DynamoDB, or built-in with S3 native locking) |
| Durability | As durable as one laptop's disk | Backed by durable object storage (S3, GCS, Azure Blob) with versioning |
| Secrets exposure | Plaintext file on a laptop, easy to accidentally commit to Git | Encrypted at rest in the backend, access controlled by IAM |
| CI/CD compatibility | Impossible — CI has no access to your laptop's file | Native — CI just needs backend credentials |

### Common Mistakes

- **"It's just me for now, I'll add remote state later."** Migrating later is easy (lesson 02
  covers `terraform init -migrate-state`), but teams routinely forget until *after* the first
  incident. Set up remote state on day one for anything beyond a personal sandbox.
- **Committing `terraform.tfstate` to version control "to share it."** This is worse than local
  state alone — Git has no locking, so two people editing the state file in parallel branches
  produces an unresolvable merge conflict *and* a permanent secrets leak in history.
- **Assuming `.gitignore` alone is sufficient protection.** It stops *future* accidental commits,
  but does nothing to add locking or multi-machine visibility.

### Interview Answer

"Local state stores `terraform.tfstate` as a plain file on whatever machine ran `apply`. It works
for solo experimentation but breaks down for teams for three reasons: there's no locking, so
concurrent applies can corrupt state or race on the same resource; there's no shared visibility,
so a second person's Terraform has no idea what the first person already created, which can lead
to duplicate-creation or erroneous destroy plans; and there's no durability guarantee beyond a
single disk. The fix is a remote backend — like S3 with DynamoDB locking, or Terraform Cloud —
which centralizes state and adds locking as a first-class feature."

> **Memory hook:** Local state is a master-key notebook on one person's desk — fine solo, a coordination disaster the moment a second roommate needs to change a lock.

---

## 5. Sensitive Data in State

Here's a fact that surprises almost everyone the first time they learn it: if you create an RDS
database with `resource "aws_db_instance" "db" { password = var.db_password }`, that password is
stored **in plaintext** inside `terraform.tfstate` — even if you marked the variable `sensitive =
true`. The `sensitive` flag only tells Terraform to redact the value from *console output*
(`plan`/`apply` logs). It does nothing to encrypt or omit the value from the state file itself.
Anyone who can read your state file can read that password.

### Analogy

Marking a variable `sensitive = true` is like whispering a number instead of saying it out loud in
a meeting — nobody in the room hears it spoken. But you still wrote that number down, in plain
ink, in a shared notebook (state) that everyone with notebook access can flip open and read later.
Whispering protects the *live conversation*; it does nothing to protect the *written record*.

### Under the Hood

```
resource "aws_db_instance" "db" {
  password = var.db_password   # var.db_password is sensitive = true
}
```

```
terraform apply output (console):
  ~ password = (sensitive value)     <── redacted here, in the CLI/log

terraform.tfstate (on disk):
  "password": "Sup3rSecretPassw0rd!"  <── stored in FULL PLAINTEXT
```

```
┌───────────────────────────────────────────────────────────────┐
│  sensitive = true PROTECTS:        sensitive = true DOES NOT   │
│  - CLI plan/apply console output   PROTECT:                     │
│  - CI/CD job logs                  - The raw terraform.tfstate  │
│                                       file's JSON attributes     │
│                                     - `terraform show`           │
│                                       (unless piped through a    │
│                                        redaction tool)           │
│                                     - `terraform state show`     │
└───────────────────────────────────────────────────────────────┘
```

Because of this, protecting secrets in Terraform is really about protecting **access to the state
backend**, not about marking variables sensitive (though you should still do that, for log
hygiene). The real controls are:

1. **Encrypt state at rest** — e.g., an S3 backend with `encrypt = true` (SSE-S3 or SSE-KMS).
2. **Restrict IAM access to the state bucket** — only the CI role and specific admins should be
   able to `s3:GetObject` on the state key.
3. **Enable state file versioning** on the bucket, and restrict who can read *old* versions too.
4. **Avoid putting long-lived secrets in Terraform at all where possible** — prefer referencing a
   secret already stored in AWS Secrets Manager / SSM Parameter Store via a `data` source, so the
   plaintext value never has to pass through your `.tf` config or state as something Terraform
   *created*. (Note: even values *read* via a data source still land in state.)
5. **Never commit state to Git.**

### Example

```hcl
# variables.tf
variable "db_password" {
  type      = string
  sensitive = true
}

# main.tf
resource "aws_db_instance" "db" {
  identifier     = "app-db"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  username       = "app_admin"
  password       = var.db_password
  allocated_storage = 20
}
```

```bash
$ terraform apply
# Console output redacts it:
  ~ password = (sensitive value)

$ grep password terraform.tfstate
  "password": "Sup3rSecretPassw0rd!"
# ^ Full plaintext, right there, even though the variable was marked sensitive.
```

Recommended backend hardening (S3 example):

```hcl
terraform {
  backend "s3" {
    bucket         = "my-org-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true                 # SSE-S3 encryption at rest
    kms_key_id     = "alias/tfstate-key"  # or SSE-KMS for tighter key control
    dynamodb_table = "terraform-locks"
  }
}
```

Bucket-level IAM policy (conceptual — restrict to CI role + admins only):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:role/terraform-ci" },
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::my-org-tfstate/prod/*"
    },
    {
      "Effect": "Deny",
      "NotPrincipal": { "AWS": [
        "arn:aws:iam::123456789012:role/terraform-ci",
        "arn:aws:iam::123456789012:role/platform-admin"
      ]},
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::my-org-tfstate/prod/*"
    }
  ]
}
```

### Comparison Table

| Protection | What It Guards | What It Does NOT Guard |
|------------|-----------------|--------------------------|
| `sensitive = true` on a variable/output | CLI console output, CI logs | The raw state file contents |
| S3 `encrypt = true` / SSE-KMS | Data at rest on disk in the bucket | Anyone with valid IAM read access to the object |
| IAM bucket policy restricting `s3:GetObject` | Who can even fetch the state object | Data already leaked via a prior overly-broad policy |
| `.gitignore` for `*.tfstate` | Accidental commits going forward | Secrets already committed in prior history |
| Terraform Cloud/Enterprise state encryption | Rest + transit encryption, audit logging of state reads | Misconfigured workspace-level access controls |

### Common Mistakes

- **Believing `sensitive = true` encrypts the value.** It only affects what's printed to a
  terminal or log — the value is still plaintext in the state JSON.
- **Committing `.tfstate` "just this once" during a demo.** Git history is forever unless you
  rewrite it (and even then, anyone who already cloned has a copy). Treat any state-in-Git
  incident as a secret that must be rotated, not just deleted from the latest commit.
- **Forgetting that outputs marked `sensitive` still land in state.** `terraform output` will
  redact it on screen, but `terraform output -json` and the state file both contain the raw value.

### Interview Answer

"`sensitive = true` only affects what Terraform prints to the console or logs during
plan/apply — it does not encrypt or omit the value from the state file. The state file stores
every resource attribute, including things like database passwords, in plaintext JSON. So the real
security boundary is the state *backend*, not the `sensitive` flag: use a remote backend that
encrypts data at rest (e.g., S3 with SSE-KMS), lock down IAM access to only the roles that need it,
enable versioning, and never commit state to version control. `sensitive` is a UX/log-hygiene
feature, not an encryption feature."

> **Memory hook:** Marking a value `sensitive` is whispering it in a meeting — the room doesn't hear it, but it's still written in plain ink in the shared notebook (state) that anyone with notebook access can read.

---

## 6. Hands-On Exercises

**Exercise 1 — Inspect a Real State File**
Create a minimal config with one `aws_instance` (or use `null_resource` if you don't want AWS
costs), run `terraform apply`, then run `cat terraform.tfstate | jq .` (or open it in an editor).
Identify the `serial`, `lineage`, and the `id` attribute inside `resources[0].instances[0]`.

**Exercise 2 — Watch `serial` Increment**
Run `terraform apply` twice in a row with no config changes, then make a small change (e.g., add a
tag) and `apply` again. Compare the `serial` value in the state file before and after. What does
this tell you about what triggers a `serial` bump?

**Exercise 3 — Simulate Drift**
Using the AWS Console (or CLI, `aws ec2 create-tags`), manually add a tag to an instance managed by
Terraform, *without* updating your `.tf` config. Run `terraform plan` and read the "changes made
outside of Terraform" message. Explain, in your own words, what Terraform did between reading the
old state and producing that message.

**Exercise 4 — Find a Secret in State**
Write a config with a `random_password` resource (from the `hashicorp/random` provider) feeding
into a variable marked `sensitive = true` used elsewhere. Apply it, then `grep` the state file for
the generated password. Confirm it's stored in plaintext despite the `sensitive` flag.

**Exercise 5 — Local State Failure Scenario**
On paper (no need to actually do this), describe what would happen if two teammates, each with
their own local `terraform.tfstate` for the same project, both ran `terraform apply` within a
minute of each other against the same AWS account. List at least two distinct failure modes.

---

## 7. Interview Q&A

---

**Q1: What problem does Terraform state solve?**

A: HCL configuration only declares *desired* end state — it has no built-in way to reference a
specific already-existing real-world object. State solves this by recording a mapping from each
resource address in your config to the actual identifier (and full attribute set) of the object
Terraform created for it. This lets `plan`/`apply` distinguish "update this existing resource"
from "create a brand-new one," and lets Terraform compute a minimal diff instead of re-creating
everything on every run.

---

**Q2: What are `serial` and `lineage` in a state file, and why do they matter?**

A: `lineage` is a UUID generated once when a state file is first created; it identifies a
continuous history of that state. `serial` is a counter incremented every time the state changes.
Together they let Terraform (and remote backends) detect staleness or divergence — if two state
files share a lineage but have different serials, one is out of date; if lineages differ entirely,
the two state files represent unrelated histories and shouldn't be merged.

---

**Q3: Is Terraform state a live view of your cloud account?**

A: No. It's a cache of the last-known attributes for resources Terraform itself created or
imported, refreshed by querying the provider API at the start of each `plan`/`apply`. Resources
created outside Terraform (e.g., manually in a console) are entirely invisible to Terraform until
explicitly imported.

---

**Q4: What is infrastructure drift, and how does Terraform detect it?**

A: Drift is a difference between what Terraform's state believes about a resource and what the
resource actually looks like in the provider right now, typically caused by manual out-of-band
changes. Terraform detects it during the refresh step of `plan`: it queries the provider's read
API for each tracked resource, updates its in-memory copy of state with the real current values,
and then diffs those refreshed values against your `.tf` config.

---

**Q5: Why is local state risky for a team?**

A: Local state lives as a single file on one machine, with no locking and no shared visibility. If
two people run `apply` around the same time, they can corrupt the file or race on the same real
resource. A second team member's Terraform, having never seen the first person's state file, may
try to re-create resources that already exist, or plan to destroy resources it doesn't recognize.
Local state is also a single point of failure — losing the machine loses Terraform's only record
of what it manages.

---

**Q6: Does marking a variable `sensitive = true` encrypt it in the state file?**

A: No. `sensitive = true` only suppresses the value from being printed in CLI/log output during
plan and apply. The value is still stored in plaintext inside the state file's JSON. Protecting
secrets requires securing the state backend itself — encryption at rest, restrictive IAM policies,
and never committing state to version control.

---

**Q7: What's stored inside a `resources[].instances[]` entry in the state JSON?**

A: The full flattened attribute set Terraform knows about that specific real-world object (its
`id` and every other schema attribute), a `sensitive_attributes` list marking which attribute
paths should be redacted in CLI output, and a `dependencies` list of other resource addresses it
depends on, used to rebuild the dependency graph without re-parsing all the HCL.

---

**Q8: Why shouldn't you hand-edit `terraform.tfstate`?**

A: The file's structure (JSON schema, attribute shapes, dependency lists) must stay internally
consistent for Terraform to parse and diff it correctly. A single malformed field, missing
dependency, or wrong data type can corrupt the file to the point where `terraform plan` fails
outright. The supported way to modify state is through `terraform state` subcommands (`mv`, `rm`,
`import`, etc.), which validate and rewrite the file safely.
