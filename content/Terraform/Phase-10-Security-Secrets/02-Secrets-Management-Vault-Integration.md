# 02 — Secrets Management & Vault Integration

## Table of Contents

1. [Why Not Hardcode Secrets in .tfvars](#1-why-not-hardcode-secrets-in-tfvars)
2. [The `vault` Provider](#2-the-vault-provider)
3. [AWS Secrets Manager / SSM Parameter Store as Alternatives](#3-aws-secrets-manager--ssm-parameter-store-as-alternatives)
4. [A Full Example](#4-a-full-example)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Not Hardcode Secrets in .tfvars

Imagine onboarding a new engineer to your team. Step one of the README says "clone the repo,"
step two says "copy `terraform.tfvars.example` to `terraform.tfvars`," and step three — buried
in there — is a real, working RDS master password, sitting in a file that's one `git add -A`
away from being pushed to a public fork. This is not a hypothetical: `.tfvars` files are exactly
where teams under time pressure put "just get it working" secrets, because it's the path of
least resistance — no extra tooling, no extra provider, just a plain key-value file Terraform
already reads automatically.

The problem is that a `.tfvars` file is just a text file. It has no access control of its own —
whoever can read the repo (or the CI runner's checkout, or a laptop backup, or an IDE's recent
files list) can read the secret. And secrets in `.tfvars` never rotate automatically: if the DB
password changes, someone has to remember to update the file everywhere it's checked out, which
in practice means it *doesn't* get rotated, because rotating it is now a manual, error-prone,
multi-repo chore.

### Analogy

A `.tfvars` file with a password in it is like writing your house alarm code on a sticky note and
taping it to the front door "just for now, I'll move it later." It works — the alarm code is
right there, easy to find — but it works equally well for anyone else who walks up to that door,
and it never expires on its own. A secrets manager is a keypad that generates a fresh
one-time code and logs every single person who requested it.

### The Core Problem, Concretely

```hcl
# terraform.tfvars — DO NOT DO THIS
db_master_password = "Summer2024!Prod"
api_key             = "sk_live_51H8xJ2..."
```

This file typically:
- Gets committed by accident (a `.gitignore` miss, a rebase that drops the ignore rule).
- Gets shared over Slack/email "so the new hire can run `terraform apply` locally."
- Never rotates, because rotating means editing N files across N repos/laptops.
- Has no audit trail — you cannot answer "who read this password, and when?"

### Common Mistakes

Teams sometimes think encrypting the `.tfvars` file with something like `git-crypt` or `sops`
solves this. It helps with the "don't commit plaintext to Git" problem, but it doesn't solve
rotation, audit trails, or centralization — you still have a file, now encrypted, that someone
has to manually update everywhere when the password changes. A real secrets manager (Vault, AWS
Secrets Manager, SSM Parameter Store) solves rotation and audit *and* removes the "file living on
disk" problem entirely — Terraform fetches the current value fresh, at apply time, from a
central, access-controlled, audited source.

### Interview Answer

"Hardcoding secrets in `.tfvars` puts a static, unencrypted credential directly on disk with no
access control beyond filesystem/repo permissions, no audit trail of who read it, and no rotation
story — updating the password means manually editing every checkout of that file. A secrets
manager centralizes the secret, gates access via IAM or Vault policy, logs every read, and lets
Terraform fetch the current value dynamically via a data source at apply time, so rotating the
secret requires no Terraform code change at all."

> **Memory hook:** A `.tfvars` secret is a sticky note on the door; a secrets manager is a keypad that logs every visitor and can be recoded without moving.

---

## 2. The `vault` Provider

HashiCorp Vault is purpose-built for exactly this problem: centralized secret storage, dynamic
secret generation, fine-grained access policies, and full audit logging. Terraform talks to Vault
through the official `vault` provider, most commonly by reading a secret via a **data source** —
Terraform never stores the secret in your `.tf` files, it fetches the current value at plan/apply
time.

### Analogy

Think of Vault as a hotel safe that generates a temporary access code for each guest's stay. You
don't get a permanent key to the safe — you authenticate at check-in (Terraform authenticates to
Vault using a token, AppRole, or cloud IAM auth method), and the safe hands you exactly the
contents you're authorized to see, for exactly as long as your session is valid.

### Setting Up the Provider

```hcl
terraform {
  required_providers {
    vault = {
      source  = "hashicorp/vault"
      version = "~> 4.0"
    }
  }
}

provider "vault" {
  address = "https://vault.internal.example.com:8200"
  # Authentication is typically NOT a static token in provider config.
  # In CI, use the AppRole auth method or Vault Agent to inject a
  # short-lived VAULT_TOKEN environment variable before terraform runs.
}
```

### Reading a Secret via Data Source

```hcl
# KV v2 secrets engine — the most common Vault setup
data "vault_kv_secret_v2" "db_creds" {
  mount = "secret"
  name  = "database/prod"
}

resource "aws_db_instance" "main" {
  identifier     = "prod-app-db"
  engine         = "postgres"
  instance_class = "db.t3.medium"
  username       = data.vault_kv_secret_v2.db_creds.data["username"]
  password       = data.vault_kv_secret_v2.db_creds.data["password"]

  allocated_storage = 20
  db_subnet_group_name = aws_db_subnet_group.main.name
  skip_final_snapshot  = false
}
```

### Under the Hood

```
┌────────────────────────────────────────────────────────────────┐
│  terraform plan / apply                                        │
│                                                                   │
│  1. vault provider authenticates to Vault                       │
│       (AppRole role_id + secret_id, or Vault Agent auto-auth)    │
│                       │                                          │
│                       ▼                                          │
│  2. Vault checks the calling identity's POLICY:                 │
│       path "secret/data/database/prod" { capabilities=["read"] } │
│                       │                                          │
│                       ▼ (allowed)                                │
│  3. Vault returns the current secret value over TLS             │
│       — Vault logs this read in its AUDIT DEVICE                │
│                       │                                          │
│                       ▼                                          │
│  4. Terraform holds the value in memory for this run only        │
│       — it is NOT written back to Vault, but IS written to       │
│         state (see Lesson 01 — state still gets the plaintext)   │
└────────────────────────────────────────────────────────────────┘
```

Note the important overlap with Lesson 01: fetching a secret from Vault solves the "where does
the secret live at rest, and who can read it, and is it rotated/audited" problem — it does **not**
solve the "state file will still contain the plaintext value" problem. You still need state
encryption and access restriction regardless of where the secret originally came from.

### Dynamic Secrets (Vault's Superpower)

Beyond static KV secrets, Vault can generate **dynamic, short-lived credentials** on demand — for
example, a database secrets engine that creates a brand-new, unique Postgres user with a
randomly generated password and a TTL, every time Terraform (or any client) requests one:

```hcl
data "vault_database_secret_backend_credentials" "db" {
  backend = "database"
  role    = "prod-readonly"
}

# data.vault_database_secret_backend_credentials.db.username / .password
# are unique to THIS request and expire automatically after the role's TTL.
```

This eliminates a whole category of problems: there's no long-lived shared password to rotate at
all — every consumer gets its own ephemeral credential, and Vault automatically revokes it when
the lease expires.

### Common Confusion

People sometimes think using the `vault` provider means "the secret is now safe in Terraform."
It means the secret is safe *at its source* (Vault) — centrally managed, access-controlled,
audited, possibly dynamically generated. But once Terraform reads it into a resource attribute
(like `aws_db_instance.password`), the same state-file plaintext problem from Lesson 01 applies.
Vault fixes where the secret is authored and how it's rotated; it does not change Terraform's own
state-handling behavior.

### Interview Answer

"The `vault` provider lets Terraform fetch secrets at apply time from a centrally managed,
access-controlled, audited store instead of hardcoding them in `.tf` or `.tfvars` files.
Authentication typically happens via AppRole or a short-lived token injected by Vault Agent, not
a static token in provider config. Vault can serve static KV secrets or generate dynamic,
short-lived database credentials unique per request. It's important to note this solves secret
*origin and rotation*, not Terraform *state* exposure — the fetched value still ends up in
plaintext in the state file, so state encryption and access control from Lesson 01 are still
required."

> **Memory hook:** Vault is the hotel safe with a logged, temporary access code — it doesn't change the fact that whoever's holding the contents still has to keep them somewhere safe too.

---

## 3. AWS Secrets Manager / SSM Parameter Store as Alternatives

If you're already deep in the AWS ecosystem and don't want to run and operate a separate Vault
cluster, AWS gives you two native alternatives: **Secrets Manager** and **SSM Parameter Store**
(specifically its `SecureString` parameter type). Both integrate with Terraform via data sources,
both are backed by IAM for access control and KMS for encryption, and both log reads to
CloudTrail.

### Comparison Table

| Dimension | HashiCorp Vault | AWS Secrets Manager | AWS SSM Parameter Store |
|---|---|---|---|
| **Hosting** | Self-managed (or HCP Vault managed) | Fully managed AWS service | Fully managed AWS service |
| **Cost** | Infra + operational cost of running Vault | ~$0.40/secret/month + API call cost | Standard tier free; Advanced tier has per-parameter cost |
| **Dynamic secrets** | Yes — generates ephemeral DB/cloud creds on demand | No (static values; supports automated *rotation* via Lambda) | No |
| **Automatic rotation** | Via dynamic secrets or manually configured leases | Built-in rotation scheduling (Lambda-based) for RDS, Redshift, etc. | No native rotation; must build your own |
| **Multi-cloud** | Yes — designed to be cloud-agnostic | AWS only | AWS only |
| **Access control** | Vault policies (path-based, fine-grained) | IAM policies + resource policies | IAM policies |
| **Encryption** | Transit encryption + storage backend encryption | KMS (customer or AWS-managed key) | KMS (SecureString only) |
| **Audit logging** | Vault audit devices (detailed, per-request) | CloudTrail | CloudTrail |
| **Terraform data source** | `vault_kv_secret_v2`, `vault_database_secret_backend_credentials` | `aws_secretsmanager_secret_version` | `aws_ssm_parameter` |
| **Best for** | Multi-cloud shops, teams needing dynamic/ephemeral creds | AWS-only shops wanting managed rotation with minimal ops | AWS-only shops with simple static config values, lower cost |

### Reading from AWS Secrets Manager

```hcl
data "aws_secretsmanager_secret_version" "db_creds" {
  secret_id = "prod/app/db-credentials"
}

locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_creds.secret_string)
}

resource "aws_db_instance" "main" {
  username = local.db_creds["username"]
  password = local.db_creds["password"]
  # ...
}
```

### Reading from SSM Parameter Store

```hcl
data "aws_ssm_parameter" "db_password" {
  name            = "/prod/app/db-password"
  with_decryption = true   # required to decrypt a SecureString parameter
}

resource "aws_db_instance" "main" {
  password = data.aws_ssm_parameter.db_password.value
  # ...
}
```

### Common Confusion

A frequent mistake: forgetting `with_decryption = true` on `aws_ssm_parameter` for a
`SecureString` value — without it, Terraform receives the still-encrypted ciphertext blob instead
of the plaintext value, and the resource creation fails cryptically (or, worse, silently sets a
garbage password). Also, people assume SSM Parameter Store has the same automatic rotation
Secrets Manager offers — it does not; you'd need to build your own Lambda + EventBridge schedule
to rotate SSM `SecureString` values.

### Interview Answer

"For an AWS-only shop, Secrets Manager and SSM Parameter Store are the native alternatives to
Vault. Secrets Manager costs more per secret but gives built-in rotation scheduling for common
engines like RDS, plus resource-based policies for cross-account access. SSM Parameter Store
`SecureString` is cheaper and simpler but has no native rotation — you'd have to build that
yourself. Vault remains the better choice when you need dynamic, short-lived credentials or are
multi-cloud; for a single-cloud AWS shop wanting the least operational overhead, Secrets Manager
is usually the pragmatic default."

> **Memory hook:** Vault is the multi-cloud Swiss Army knife with dynamic secrets; Secrets Manager is AWS's managed vault with built-in rotation; SSM Parameter Store is the cheap, simple drawer with no rotation included.

---

## 4. A Full Example

Putting it together: fetching a database password from Vault and using it to provision an RDS
instance, with the password never appearing anywhere in the Terraform configuration itself.

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "vault" {
  address = "https://vault.internal.example.com:8200"
  # VAULT_TOKEN is injected by Vault Agent / CI auth step — never hardcoded here.
}

# --- Fetch the DB password from Vault's KV v2 engine ---
data "vault_kv_secret_v2" "rds" {
  mount = "secret"
  name  = "database/prod/rds"
}

# --- Networking prerequisites (abbreviated) ---
resource "aws_db_subnet_group" "main" {
  name       = "prod-rds-subnet-group"
  subnet_ids = ["subnet-0abc123", "subnet-0def456"]
}

resource "aws_security_group" "rds" {
  name   = "prod-rds-sg"
  vpc_id = "vpc-0123456789abcdef0"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = ["sg-0app11223344"]  # only the app tier, nothing else
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- The RDS instance itself, password pulled from Vault at apply time ---
resource "aws_db_instance" "main" {
  identifier     = "prod-app-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_encrypted     = true

  db_name  = "appdb"
  username = data.vault_kv_secret_v2.rds.data["username"]
  password = data.vault_kv_secret_v2.rds.data["password"]

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  multi_az                = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "prod-app-db-final-snapshot"

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# --- Never output the raw password; mark derived outputs sensitive ---
output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_connection_string" {
  value = "postgres://${data.vault_kv_secret_v2.rds.data["username"]}:${data.vault_kv_secret_v2.rds.data["password"]}@${aws_db_instance.main.endpoint}/appdb"
  sensitive = true
}
```

Notice what never happens anywhere in this file: no literal password string, no `.tfvars`
reference to a credential, no provider hardcoded token. The only thing checked into version
control is *how* to fetch the secret (the Vault path), never the secret's value.

> **Memory hook:** The good version of this file has a recipe for finding the key, never the key itself.

---

## 5. Common Mistakes

- **Hardcoding a Vault token in `provider "vault" { token = "..." }`.** This just relocates the
  hardcoded-secret problem one level — the Vault *token* is now the thing sitting in plaintext.
  Use AppRole, Vault Agent auto-auth, or short-lived CI-injected tokens instead.
- **Forgetting `with_decryption = true` on SSM `SecureString` parameters**, silently getting
  ciphertext instead of the real value.
- **Assuming Secrets Manager's rotation Lambda "just works" without testing it** — a broken
  rotation Lambda can leave a secret in an inconsistent, half-rotated state that locks out both
  old and new credentials.
- **Treating a data-source fetch as "the secret is now safe"** — the value still lands in
  Terraform state, so state encryption/access control from Lesson 01 is still mandatory.
- **Using overly broad Vault policies** like `path "secret/*" { capabilities = ["read"] }`
  instead of scoping to the exact path the workspace needs (`secret/data/database/prod`).
- **Not rotating the Vault AppRole `secret_id`** — treating an AppRole credential as "set once,
  forget forever" defeats the purpose of dynamic secret tooling.

---

## 6. Hands-On Exercises

**Exercise 1 — Data Source Comparison**
Write the Terraform data source block needed to read a secret named `prod/api/stripe-key` from
each of: Vault KV v2, AWS Secrets Manager, and SSM Parameter Store (`SecureString`). Note any
argument that's easy to forget in each.

**Exercise 2 — Migration Plan**
A team currently has `db_password` hardcoded in a committed `terraform.tfvars` file. Write a
step-by-step migration plan to move that secret into AWS Secrets Manager, including what to do
about the value's presence in Git history.

**Exercise 3 — Choosing a Tool**
A startup is entirely on AWS, has no dedicated platform/security team, and wants automatic
password rotation for their RDS instances with minimal operational burden. Should they choose
Vault, Secrets Manager, or SSM Parameter Store? Justify with at least two reasons.

**Exercise 4 — Dynamic Secrets Reasoning**
Explain why a Vault dynamic database secret (unique credential per request, auto-expiring) is a
stronger security posture than even a well-rotated static Secrets Manager secret shared across
every app instance. What attack does it specifically mitigate that a shared rotated secret does
not?

---

## 7. Interview Q&A

---

**Q1: Why is storing secrets in `.tfvars` a bad practice, even if the file is git-ignored?**

A: `.gitignore` only prevents accidental commits to that specific repo — it doesn't provide
access control, doesn't create an audit trail of who read the file, and doesn't help with
rotation (every checkout needs manual updating when the secret changes). A `.tfvars` secret is a
static, unencrypted value on disk with no centralized management.

---

**Q2: How does Terraform typically authenticate to Vault in a CI pipeline?**

A: Not with a static long-lived token in provider config. Common patterns are the AppRole auth
method (a `role_id` plus a rotated `secret_id`, often injected as CI environment variables) or
Vault Agent auto-auth, which handles authentication and token renewal automatically and hands
Terraform a short-lived `VAULT_TOKEN`.

---

**Q3: Does fetching a secret from Vault or Secrets Manager solve Terraform's state-file plaintext
problem?**

A: No. It solves where the secret is authored, how it's access-controlled, and how it's rotated
at the source. But once Terraform reads the value into a resource attribute, that value is still
written into the state file in plaintext, exactly as with a hardcoded value. State encryption and
access restriction (Lesson 01) are still required regardless of the secret's origin.

---

**Q4: What's the key difference between AWS Secrets Manager and SSM Parameter Store for secrets
management?**

A: Secrets Manager has built-in automated rotation (Lambda-based) for supported services like RDS
and costs more per secret. SSM Parameter Store's `SecureString` type is cheaper and simpler but
has no native rotation mechanism — you'd have to build your own scheduled rotation logic.

---

**Q5: What is a Vault dynamic secret and why is it more secure than a static one?**

A: A dynamic secret is generated on-demand by Vault for a specific request — for example, a
unique database username/password pair with a time-to-live, created fresh each time a client
requests credentials from that Vault role. Because each consumer gets a unique, auto-expiring
credential instead of everyone sharing one static password, a leaked credential has a narrow blast
radius and a short window of validity, and there's no shared secret to rotate manually at all.

---

**Q6: What's wrong with `path "secret/*" { capabilities = ["read"] }` as a Vault policy for a
Terraform CI role?**

A: It's far broader than least privilege — that CI role could read every secret under that mount,
not just the ones its workspace actually needs. A properly scoped policy grants read access only
to the specific path(s) required (e.g., `secret/data/database/prod`), so a compromised CI role
can't be used to exfiltrate unrelated secrets.
