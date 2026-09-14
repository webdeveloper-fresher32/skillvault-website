# 01 — Sensitive Variables & State Security

## Table of Contents

1. [The Problem: Secrets Ending Up in Plaintext](#1-the-problem-secrets-ending-up-in-plaintext)
2. [`sensitive = true` on Variables and Outputs](#2-sensitive--true-on-variables-and-outputs)
3. [Why State Files Still Contain Secrets in Plaintext](#3-why-state-files-still-contain-secrets-in-plaintext)
4. [Encrypting State at Rest](#4-encrypting-state-at-rest)
5. [Restricting State Access](#5-restricting-state-access)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Secrets Ending Up in Plaintext

Picture this: a teammate runs `terraform apply` to spin up an RDS database, pastes the plan
output into a Slack thread to ask "does this look right?", and hits send before noticing that
the `master_password` value is sitting right there in plain text — now permanently searchable by
anyone in that Slack workspace, forever. Or maybe it's less dramatic: someone runs `terraform
plan` in a CI job, and the password shows up in the CI provider's build logs, which get retained
for 90 days and are visible to every engineer with repo access. Terraform's entire execution
model — plan, diff, apply — is built around showing you exactly what's about to change. That
transparency is a feature everywhere except when the value being shown is a credential.

This is the core tension of this whole lesson: Terraform needs to *know* your secrets to create
resources (a DB password, an API token, a TLS private key), but by default it treats every value
the same way — print it in the plan, print it in the apply output, save it in the state file. It
has no innate concept of "this one is dangerous to display." You have to tell it.

### Analogy

Think of a construction site foreman reading out the day's work order over a loudspeaker so the
whole crew can hear what's being built today. That's great for concrete, scaffolding, and paint
colors — but if the work order also includes the safe combination for the site office, you
probably don't want that read out over the loudspeaker too. Terraform's plan/apply output is the
loudspeaker. By default, everything goes out over it, safe combination included, unless you
explicitly mark it "whisper this one."

> **Memory hook:** Terraform's plan output is a loudspeaker, not a whisper — silence has to be requested per value.

---

## 2. `sensitive = true` on Variables and Outputs

So how do you ask Terraform to "whisper" a value instead of shouting it into the plan output? You
mark it `sensitive = true`. This is the first line of defense, and it's worth being precise about
what it actually changes.

```hcl
variable "db_master_password" {
  description = "Master password for the RDS instance"
  type        = string
  sensitive   = true
}

output "db_connection_string" {
  value       = "postgres://admin:${var.db_master_password}@${aws_db_instance.main.endpoint}/appdb"
  sensitive   = true
}
```

When you run `terraform plan` or `terraform apply` with these in place, Terraform replaces the
value in the CLI output with the literal string `(sensitive value)`:

```
  # aws_db_instance.main will be created
  + resource "aws_db_instance" "main" {
      + password = (sensitive value)
      ...
    }
```

### What `sensitive = true` DOES

- Redacts the value from `terraform plan` and `terraform apply` CLI output.
- Redacts the value from `terraform output` (unless you explicitly pass `-raw` or `-json` and
  ask for that one output, which still requires you to know its name).
- Propagates: if a sensitive value flows into another value (e.g., you build a connection string
  from a sensitive password), Terraform marks the *derived* value sensitive too, and will error
  if you try to output it without also marking it `sensitive = true`.
- Since Terraform 1.9, applies to `nonsensitive()` reversal being explicit and auditable — you
  have to deliberately call `nonsensitive()` to unmark a value, which is a visible, greppable act
  in your codebase.

### What `sensitive = true` does NOT do

This is the part that trips almost everyone up the first time:

- It does **not** encrypt the value.
- It does **not** remove the value from the **state file** — the raw password is still written
  to `terraform.tfstate` in plaintext JSON.
- It does **not** prevent the value from appearing in **provider debug logs** if you run with
  `TF_LOG=DEBUG` or `TF_LOG=TRACE` — those logs capture the raw HTTP requests to the cloud API,
  password included.
- It does **not** stop someone with direct read access to the state backend (e.g., S3 bucket
  read permission) from reading the value.
- It does **not** protect the value if it's baked into a resource's attributes that some other
  provider or data source echoes back unmarked (this used to be a common leak vector before
  Terraform improved sensitivity propagation in 0.14+).

### Under the Hood

```
┌────────────────────────────────────────────────────────────────┐
│  terraform apply                                               │
│                                                                  │
│  1. Value flows through HCL graph                              │
│     var.db_master_password ──► aws_db_instance.main.password    │
│                                                                  │
│  2. CLI renderer checks: is this attribute marked sensitive?    │
│         YES  ──► print "(sensitive value)" to stdout            │
│         NO   ──► print the actual value                         │
│                                                                  │
│  3. State writer: NO sensitivity check happens here.            │
│     Every attribute — sensitive or not — is serialized as-is    │
│     into terraform.tfstate (or the remote state blob).          │
│                                                                  │
│         terraform.tfstate                                       │
│         { "password": "Sup3rS3cr3t!" }   ◄── plaintext, always  │
└────────────────────────────────────────────────────────────────┘
```

`sensitive` is purely a **display-layer** flag. It affects what a human sees in a terminal or in
`terraform output`. It has zero effect on what gets persisted to disk or to your remote backend.

### Common Confusion

The single biggest misconception in this entire phase: **"I marked it sensitive, so it's safe
now."** No — you've hidden it from your terminal. The value is still sitting in plaintext in
state, in any CI log that dumps the state file, and in debug logs. Marking a variable sensitive
is necessary hygiene (nobody should be shoulder-surfing a password off a shared terminal), but it
is not a security control for data at rest. Treat it as "reduces accidental exposure in
day-to-day CLI usage," not "encrypts my secret."

### Interview Answer

"`sensitive = true` tells Terraform's CLI renderer to redact a value from plan and apply output,
and it propagates through derived values so a computed output built from a sensitive input is
also treated as sensitive. It's a UI-layer redaction, not encryption — the value is still written
in plaintext into the state file and can still leak through debug logs (`TF_LOG=TRACE`) or a
misconfigured `output` block using `-json`. Real protection of secrets requires encrypting state
at rest and restricting who can read the state backend, which `sensitive` does nothing for."

> **Memory hook:** `sensitive = true` puts a "confidential" sticky note on the report cover — it doesn't lock the filing cabinet.

---

## 3. Why State Files Still Contain Secrets in Plaintext

Here's the gotcha that catches people who *did* do their due diligence and marked every secret
variable `sensitive = true`, only to later run a routine `grep -i password terraform.tfstate` out
of curiosity — and find their RDS master password sitting right there in cleartext JSON. Why does
this happen even when you did everything "right" on the variable side?

Because Terraform's state file isn't a UI. It's the **source of truth** Terraform uses to compute
diffs on the next run. To know that nothing has changed about your RDS instance, Terraform must
compare the *actual* current value of every attribute — including `password` — against what's
declared in your `.tf` files. If it stored a redacted placeholder instead of the real password, it
could never detect drift (e.g., if someone manually rotated the password in the AWS console,
Terraform needs the real old value to notice the mismatch).

```
┌───────────────────────────────────────────────────────────────────┐
│                     terraform.tfstate (JSON)                      │
│                                                                     │
│  "resources": [                                                    │
│    {                                                                │
│      "type": "aws_db_instance",                                    │
│      "instances": [                                                │
│        {                                                            │
│          "attributes": {                                            │
│            "password": "Sup3rS3cr3t!",     ◄── PLAINTEXT, always   │
│            "endpoint": "mydb.xxxx.rds.amazonaws.com",               │
│            "arn": "arn:aws:rds:us-east-1:...:db:mydb"               │
│          }                                                           │
│        }                                                             │
│      ]                                                                │
│    }                                                                   │
│  ]                                                                      │
└───────────────────────────────────────────────────────────────────────┘
```

There is **no built-in field-level encryption** of state attributes in open-source Terraform.
(Terraform 1.10+ introduced an experimental client-side **state encryption** feature — see below
— but it is opt-in and not the historical default most existing infrastructure relies on.) The
state file, whether local (`terraform.tfstate` on disk) or remote (S3 object, TFC-managed blob),
is a full plaintext snapshot of every resource attribute Terraform manages, secrets included.

This is *by design*, not a bug: state's job is accurate drift detection, and accurate drift
detection requires the real values. The fix is not "make Terraform redact state" (that would
break the tool) — the fix is "control who and what can read the state file at all."

### Common Confusion

People sometimes propose "let's just add `.gitignore` for `terraform.tfstate` and call it done."
`.gitignore` stops you from *committing* state to a Git repo (which you should never do — Git
history is forever and nearly impossible to fully scrub), but it says nothing about the S3
bucket, GCS bucket, or Terraform Cloud workspace where your *remote* state actually lives. The
real question is always: "who and what has read access to the state backend?" — answered in
section 5.

### Interview Answer

"Terraform state must hold the real, current value of every managed attribute — including
secrets — because state is what Terraform diffs against on every plan to detect drift. If it
stored a redacted or hashed value, it couldn't tell whether a password changed out-of-band. So
even variables marked `sensitive = true` end up in state as plaintext. Historically there is no
field-level encryption inside the state format itself; protection instead comes from encrypting
the storage layer (S3 SSE, TFC's encryption at rest) and tightly restricting IAM/team permissions
on who can read that storage."

> **Memory hook:** State is Terraform's memory, not its mouthpiece — it has to remember the real password to know if it changed, even if it never says it out loud.

---

## 4. Encrypting State at Rest

Since state always contains plaintext secrets, the next layer of defense is making sure the
*storage* holding that state file is encrypted — so that if a backup gets exfiltrated, a disk is
stolen, or a bucket is misconfigured for a moment, the raw bytes on disk aren't directly readable
without also holding the decryption key.

### Analogy

Encrypting state at rest is like a bank storing your safe deposit box's contents in a vault built
into reinforced concrete, versus just leaving the box on the front desk. The box's *contents* are
still whatever you put in — the vault doesn't change what's inside — but it changes who can get to
it, and what they need (a key, a permission, a decryption process) before they can.

### S3 Server-Side Encryption (SSE)

If you use S3 as your remote backend, enable SSE on the bucket so every object — the state file
included — is encrypted at rest using AES-256 (SSE-S3) or a customer-managed KMS key (SSE-KMS,
which also gives you audit logging of every decrypt via CloudTrail).

```hcl
# The S3 bucket that stores Terraform state
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-org-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-KMS: encrypts every object with a customer-managed KMS key
resource "aws_kms_key" "state_key" {
  description             = "KMS key for encrypting Terraform state"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state_key.arn
    }
    bucket_key_enabled = true
  }
}

# Block all public access — belt and suspenders
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

The backend configuration then references this bucket (and typically a DynamoDB table for state
locking):

```hcl
terraform {
  backend "s3" {
    bucket         = "my-org-terraform-state"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true   # forces SSE on the PUT request even if bucket default were off
  }
}
```

### Terraform Cloud / HCP Terraform Encryption

If you use Terraform Cloud (TFC) or HCP Terraform as your backend instead of S3, state is
encrypted at rest by HashiCorp automatically — you don't manage keys or SSE settings yourself.
TFC additionally never exposes state contents through its UI diff view for sensitive-looking
values in the same redacted way the CLI does, and access to a workspace's state is gated entirely
by TFC's team-based permission model (next section).

| Encryption Mechanism | Where | Who Manages Keys | Comment |
|---|---|---|---|
| S3 SSE-S3 (AES-256) | Self-hosted S3 backend | AWS-managed | Simplest, no KMS cost, no custom audit trail |
| S3 SSE-KMS | Self-hosted S3 backend | You (customer-managed KMS key) | CloudTrail logs every decrypt; supports key rotation and key policies |
| TFC/HCP Terraform | Managed SaaS backend | HashiCorp | Zero setup; encryption is a platform default, not something you configure |
| Terraform 1.10+ client-side state encryption | Local + any backend | You (via `encryption` block + key provider) | Encrypts the state *file itself* before it ever reaches the backend — newest option, opt-in |

### Common Confusion

Enabling SSE on the bucket does **not** mean the *contents* of the state file are hidden from
anyone who has S3 `GetObject` permission and downloads it — S3 decrypts transparently for any
authorized reader. SSE protects against someone getting the raw disk/object bytes *without* going
through S3's access control (e.g., a leaked physical disk, or a misconfigured backup). It does
**not** replace IAM-level access control — that's section 5, and it's actually the more important
control day-to-day.

> **Memory hook:** SSE locks the vault door; IAM policy decides who's handed a key to that door.

---

## 5. Restricting State Access

Encryption at rest stops disk-level theft. It does nothing if the door itself — read access via
the S3 API or TFC's permission model — is left open to everyone. This is the control that
actually matters for the day-to-day threat model: an over-permissioned CI role, a developer
laptop with broad AWS credentials, or a intern account that shouldn't be able to read production
secrets.

### S3 Bucket Policy — Explicit Deny + Scoped Allow

```hcl
data "aws_iam_policy_document" "state_bucket_policy" {
  # Deny any request that isn't using TLS
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  # Only allow the CI role and the platform team role to read/write state
  statement {
    sid    = "AllowStateAccessForAuthorizedRoles"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::123456789012:role/terraform-ci",
        "arn:aws:iam::123456789012:role/platform-team",
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = data.aws_iam_policy_document.state_bucket_policy.json
}
```

Pair this with per-environment prefixes (`prod/`, `staging/`) and IAM condition keys
(`s3:prefix`) so a role scoped to staging cannot read `prod/network/terraform.tfstate` even if it
has generic `GetObject` on the bucket.

### Terraform Cloud Team Permissions

TFC/HCP Terraform doesn't use IAM policies — it uses **workspace-level team permissions**. You
create teams (e.g., `platform-admins`, `app-developers`, `readonly-auditors`) and grant each team
a permission level per workspace:

| TFC Permission | Can view state? | Can view variables marked sensitive? | Can run plan/apply? |
|---|---|---|---|
| **Read** | Yes (state outputs only, not raw file) | No | No |
| **Plan** | Yes | No | Plan only, no apply |
| **Write** | Yes | No (write-only, never readable back) | Yes |
| **Admin** | Yes, including full state download | No (sensitive vars are write-only even for admins) | Yes, plus workspace settings |

The important nuance: in TFC, a variable marked **sensitive** in the workspace UI becomes
**write-only** — not even workspace Admins can view its value again after saving it, only
overwrite it. This is stronger than the OSS CLI's `sensitive = true`, which only redacts display
but keeps the value readable in state to anyone with backend access.

```hcl
# Example: referencing a TFC-managed sensitive variable — you never see its value in code
variable "db_master_password" {
  type      = string
  sensitive = true
  # In TFC, this variable's actual value is set in the workspace UI/API,
  # marked "sensitive" there too — TFC then makes it write-only.
}
```

### Common Confusion

People assume TFC's "sensitive" checkbox on a variable behaves like OSS's `sensitive = true` —
just hides it from logs. In TFC it's stricter: it becomes genuinely unreadable via the API and UI
after being set, even to workspace admins. That's a meaningfully stronger guarantee than
self-hosted S3 + `sensitive = true`, where anyone with `s3:GetObject` can still `grep` the raw
state.

### Interview Answer

"State access control has two independent layers: encryption at rest (SSE-S3/KMS, or platform
default in TFC) protects against raw storage theft, and IAM bucket policy / TFC team permissions
control who can actually call `GetObject` or view the workspace at all. The second layer matters
more in practice — a role with broad S3 read access defeats encryption at rest entirely, because
S3 transparently decrypts for any authorized caller. I'd scope IAM policies per environment
prefix, deny non-TLS access, and in TFC rely on team permissions plus marking secret-bearing
variables sensitive so they become write-only even to admins."

> **Memory hook:** Encryption locks the safe; IAM/TFC permissions decide who's issued a key — you need both, but the key list matters more day to day.

---

## 6. Common Mistakes

- **Believing `sensitive = true` encrypts the value.** It only redacts CLI/output display; the
  state file still holds plaintext.
- **Committing `terraform.tfstate` to Git "just this once" for debugging.** Git history is
  forever; a single commit can leak a password permanently, even after a force-push "removes" it.
- **Running with `TF_LOG=TRACE` in CI and archiving the logs.** Debug-level provider logs capture
  raw HTTP request/response bodies, secrets included — treat trace logs as equally sensitive as
  state.
- **Giving the Terraform CI role blanket `s3:*` on the state bucket** instead of scoping to the
  specific prefix/environment it needs — one compromised pipeline can then read every
  environment's secrets.
- **Forgetting that outputs consumed by another `terraform_remote_state` data source are still
  plaintext in the *source* state** even if marked `sensitive` — the consuming module only
  inherits the display-redaction, not encryption.
- **Assuming a private S3 bucket (no public access) is "secure enough"** without also enabling
  SSE and restricting the bucket policy to named roles — "private by default" ACLs can still be
  broadened by a misconfigured policy later.

---

## 7. Hands-On Exercises

**Exercise 1 — Spot the Leak**
Given this variable and output pair, explain exactly where the `api_token` value will still be
visible in plaintext, listing at least three locations.
```hcl
variable "api_token" {
  type      = string
  sensitive = true
}

resource "null_resource" "notify" {
  provisioner "local-exec" {
    command = "curl -H 'Authorization: Bearer ${var.api_token}' https://api.example.com/notify"
  }
}
```

**Exercise 2 — Bucket Hardening**
Starting from a bare `aws_s3_bucket` resource with no other configuration, write the full set of
Terraform resources needed to turn it into a hardened Terraform state backend: versioning,
SSE-KMS, public access block, and a bucket policy that denies non-TLS requests and restricts
access to a single named IAM role.

**Exercise 3 — TFC vs S3 Sensitivity Model**
Explain, in your own words, the difference in guarantee between a variable marked `sensitive =
true` in an S3-backed OSS Terraform project versus a variable marked "sensitive" in a Terraform
Cloud workspace. Which one would you trust more to keep a password unreadable from a workspace
Admin, and why?

**Exercise 4 — Drift Detection Reasoning**
A colleague proposes a feature request to HashiCorp: "state should store a SHA-256 hash of
`password` instead of the plaintext, for security." Explain why this would break Terraform's core
drift-detection behavior, using a concrete example of an out-of-band password change.

---

## 8. Interview Q&A

---

**Q1: Does marking a Terraform variable `sensitive = true` encrypt its value?**

A: No. It only redacts the value from CLI plan/apply output and from `terraform output` unless
explicitly requested. The value is still written in plaintext to the state file, and can still
appear in provider debug logs (`TF_LOG=TRACE`). Real protection requires encrypting the state
backend and restricting who can read it.

---

**Q2: Why does Terraform state always contain secrets in plaintext, even for sensitive
variables?**

A: State is Terraform's source of truth for drift detection — on every plan it compares the real
current value of each attribute against your configuration. If it stored a redacted or hashed
placeholder, it could never tell whether a value changed out-of-band (e.g., someone manually
rotated a password in the console). So state must hold the real value, sensitive or not.

---

**Q3: What's the difference between encrypting state at rest and restricting state access?**

A: Encryption at rest (S3 SSE, KMS, or a managed platform's default encryption) protects the raw
storage — disk, backup, stolen snapshot — from being readable without a key. Restricting access
(IAM bucket policy, TFC team permissions) controls who can call the storage API at all. Encryption
alone doesn't help if an over-permissioned role can call `GetObject` and have S3 transparently
decrypt for them — both layers are needed, but access restriction is usually the more consequential
control in practice.

---

**Q4: How does Terraform Cloud's "sensitive" variable flag differ from OSS `sensitive = true`?**

A: In TFC, marking a variable sensitive makes it write-only — once saved, its value cannot be
read back through the UI or API even by workspace Admins, only overwritten. OSS `sensitive =
true` only affects CLI display; the value remains fully readable to anyone with access to the
state backend.

---

**Q5: Why should you never commit `terraform.tfstate` to a Git repository?**

A: State files contain plaintext secrets for every managed resource. Git history is effectively
permanent — even deleting the file in a later commit or force-pushing leaves the blob recoverable
in reflogs, forks, or CI caches. A single accidental commit can leak credentials indefinitely,
requiring a full credential rotation, not just a file removal.

---

**Q6: What AWS mechanism would you use to audit who decrypted a Terraform state object?**

A: SSE-KMS with a customer-managed key, combined with CloudTrail. Every `Decrypt` call against
that KMS key is logged with the calling principal's identity, letting you audit exactly who or
what read state, unlike SSE-S3 (AWS-managed keys) which doesn't produce per-decrypt audit
entries.
