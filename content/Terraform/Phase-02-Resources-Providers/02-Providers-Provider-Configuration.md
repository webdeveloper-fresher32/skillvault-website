# 02 — Providers & Provider Configuration

## Table of Contents

1. [What is a Provider](#1-what-is-a-provider)
2. [Provider Block Syntax and required_providers](#2-provider-block-syntax-and-required_providers)
3. [Provider Versioning & Constraints](#3-provider-versioning--constraints)
4. [Multiple Provider Configurations (Aliases)](#4-multiple-provider-configurations-aliases)
5. [Authentication Methods](#5-authentication-methods)
6. [Provider Plugin Cache](#6-provider-plugin-cache)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a Provider

You've written `resource "aws_instance" "web" { ... }` and run `terraform apply`. Terraform Core
itself has never made a single HTTP call to AWS — it doesn't even know AWS exists as a concept. So
who actually authenticates to AWS, signs the request, and calls `RunInstances`? That job belongs
entirely to a separate piece of software called a **provider**, and understanding that split is
the key to understanding almost every "why does Terraform work this way" question you'll ever ask.

### Analogy

Terraform Core is like a construction project manager who is fluent in reading blueprints and
scheduling — but doesn't personally know how to pour concrete, wire electricity, or install
plumbing. For each specialized job, the manager hires a subcontractor: an electrician for wiring,
a plumber for pipes. The manager (Terraform Core) tells each subcontractor (provider) "here's the
blueprint section that's yours — go make it real," and the subcontractor knows the actual trade
knowledge (in this case, the AWS API) to make it happen.

### The Plugin Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TERRAFORM CORE                             │
│   - Parses HCL                                                    │
│   - Builds the dependency graph                                   │
│   - Manages state file                                            │
│   - Has ZERO built-in knowledge of AWS, Azure, GCP, Kubernetes...  │
└───────────┬─────────────────┬──────────────────┬──────────────────┘
            │ gRPC             │ gRPC              │ gRPC
            ▼                 ▼                    ▼
 ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐
 │ terraform-      │  │ terraform-       │  │ terraform-          │
 │ provider-aws    │  │ provider-azurerm │  │ provider-kubernetes │
 │ (Go binary)     │  │ (Go binary)      │  │ (Go binary)         │
 └───────┬─────────┘  └────────┬─────────┘  └─────────┬───────────┘
         │ AWS SDK              │ Azure SDK             │ K8s client-go
         ▼                     ▼                       ▼
      AWS API               Azure API              Kubernetes API
```

Every provider is a standalone compiled binary that implements a plugin protocol (currently gRPC,
via HashiCorp's `terraform-plugin-framework` or the older `terraform-plugin-sdk`). When you run
`terraform apply`, Terraform Core launches the provider binary as a subprocess and communicates
with it over that protocol for every create, read, update, and delete operation.

### Why This Design Matters

- **Terraform Core stays small and provider-agnostic** — it doesn't need a new release every time
  AWS adds a service.
- **Anyone can write a provider** — HashiCorp maintains AWS/Azure/GCP, but there are also
  community and partner providers (Datadog, Cloudflare, GitHub, Kubernetes, even providers for
  things like Auth0 or PagerDuty).
- **You only download the providers you actually use** — a project using only AWS never downloads
  the Azure provider binary.

### Example

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "example" {
  bucket = "my-example-bucket-123456"
}
```

Running `terraform init` here downloads the `hashicorp/aws` provider plugin binary (matching
version `~> 5.0`) into `.terraform/providers/`, and every subsequent `plan`/`apply` launches it as
a subprocess to actually talk to AWS.

### Common Confusion

- **Thinking "Terraform" and "the AWS provider" are the same piece of software.** They are
  developed, versioned, and released completely separately. Terraform Core's version (e.g.
  1.9.x) and the AWS provider's version (e.g. 5.60.x) are independent numbers.
  Upgrading Terraform Core does not automatically upgrade any provider, and vice versa.
- **Assuming a resource type like `aws_instance` is a Terraform built-in.** It is entirely defined
  by the AWS provider plugin — Terraform Core has no idea what `aws_instance` even means until the
  plugin registers that schema with it.
- **Not realizing multiple clouds can be managed in one configuration** — you can have `provider
  "aws"` and `provider "google"` in the same root module, each managing its own resources, because
  each is just an independent plugin process.

### Interview Answer

"A provider is a plugin — a separate compiled binary — that Terraform Core launches and
communicates with over a gRPC-based plugin protocol. Terraform Core itself has no built-in
knowledge of any cloud API; all of that knowledge lives in the provider, which translates HCL
resource arguments into actual API calls (like AWS SDK calls) and translates API responses back
into Terraform's internal state representation. This plugin architecture is what lets Terraform
support hundreds of different platforms without Core needing to know about any of them directly."

> **Memory hook:** Terraform Core is the project manager reading blueprints; the provider is the subcontractor who actually knows the trade (AWS, Azure, Kubernetes...) and does the real work.

---

## 2. Provider Block Syntax and required_providers

You add a second cloud resource to your config — say, a Cloudflare DNS record alongside your AWS
infrastructure — and suddenly `terraform init` complains it can't find a provider for
`cloudflare_record`. Terraform needs to be told, explicitly, *which* provider plugins your
configuration needs and *where* to download them from, before it can do anything with your
resource blocks. That's the job of `required_providers`, paired with a `provider` block per
provider that needs configuration.

### Analogy

`required_providers` is like the ingredients list at the top of a recipe card — "you will need:
flour (King Arthur brand, at least version 2), eggs (any farm, version doesn't matter)." It tells
you what to go buy *before* you start cooking. The `provider` block itself is like the actual
prep step — "preheat the oven to 350°F, grease the pan" — the specific configuration needed to use
that ingredient correctly for this recipe.

### Two Different Blocks, Two Different Jobs

| Block | Lives in | Purpose |
|-------|----------|---------|
| `required_providers` (inside `terraform {}`) | Usually a `versions.tf` or top of `main.tf` | Declares WHICH provider plugins and WHICH versions to download during `init` |
| `provider "aws" { }` | Anywhere in the root module | Configures HOW to use that provider — region, credentials, endpoints, default tags |

### Example

```hcl
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = "ap-southeast-2"

  default_tags {
    tags = {
      ManagedBy = "terraform"
    }
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "reports" {
  bucket = "reports-${random_id.suffix.hex}"
}
```

The `source` attribute (`hashicorp/aws`) is a full registry address:
`<namespace>/<provider-name>`. Providers not published by HashiCorp under `hashicorp/` use their
own namespace, e.g. `source = "cloudflare/cloudflare"` or `source = "integrations/github"`.

### Under the Hood

```
terraform init
    │
    ├─ 1. Reads required_providers block(s) across all .tf files in the module
    ├─ 2. Resolves version constraints against the Terraform Registry (or private registry)
    ├─ 3. Downloads matching plugin binaries into .terraform/providers/
    ├─ 4. Writes exact resolved versions into .terraform.lock.hcl  ← the LOCK FILE
    └─ 5. Every subsequent plan/apply uses ONLY the locked versions (until you run
          `terraform init -upgrade`)
```

The **lock file** (`.terraform.lock.hcl`) is what makes builds reproducible across machines and
CI runners — everyone gets the exact same provider binary (down to the checksum), not just "a
version matching `~> 5.60`."

### Common Mistakes

- **Omitting `required_providers` entirely and relying on a bare `provider "aws" {}` block.**
  This works for the built-in "official" HashiCorp providers due to legacy default behavior, but
  it's considered bad practice — you get no version pinning and Terraform will just grab
  "latest," which breaks reproducibility.
- **Committing without the lock file** (`.terraform.lock.hcl`) to version control — teams that
  `.gitignore` it lose the guarantee that CI and every teammate's laptop resolve to the exact same
  provider build.
- **Confusing `required_version` (Terraform Core's version) with `version` inside
  `required_providers` (the provider plugin's version)** — these are two entirely separate
  version numbers.

### Interview Answer

"`required_providers`, nested inside the `terraform {}` block, declares which provider plugins a
configuration needs and which version constraints apply — it's what `terraform init` reads to
know what to download. A separate `provider "aws" { }` block then configures how that provider
should behave at runtime, like which region to target or which credentials to use. The two are
separate concerns: one is 'what plugin and version,' the other is 'how do I use it.'"

> **Memory hook:** `required_providers` is the shopping list; `provider "aws" { }` is the recipe instructions for using what you bought.

---

## 3. Provider Versioning & Constraints

Six months ago your team pinned nothing, just wrote `provider "aws" {}`. Then one morning a
teammate runs `terraform init` on a fresh laptop, gets the newest AWS provider release, and
suddenly `terraform plan` shows unexpected changes on every resource — because an argument's
default behavior changed between major versions. This is exactly the failure mode version
constraints exist to prevent.

### Analogy

Version constraints are like specifying "I need a phone charger, USB-C, at least version 3.0
speed, but not the brand-new experimental 5.0 spec that might not be backward compatible yet."
You're not pinning to one exact charger forever — you're defining a safe range you trust.

### Constraint Operators

| Operator | Meaning | Example | Matches |
|----------|---------|---------|---------|
| `=` (or bare number) | Exact version only | `= 5.60.0` | Only `5.60.0` |
| `!=` | Exclude a version | `!= 5.61.0` | Anything except `5.61.0` |
| `>`, `>=`, `<`, `<=` | Comparison | `>= 5.0.0` | `5.0.0` and above |
| `~>` (pessimistic/twiddle) | Allow only the rightmost version component to increment | `~> 5.60` | `>= 5.60.0, < 6.0.0` |
| `~>` with 3 parts | Allow only patch increments | `~> 5.60.2` | `>= 5.60.2, < 5.61.0` |

### Example

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"     # allows 5.60.x, 5.70.x, 5.99.x ... but NOT 6.0.0
    }
  }
}
```

Compare the practical effect of each strategy:

```hcl
version = "5.60.0"    # Exact pin — safest, but you must manually bump it for every bugfix
version = "~> 5.60.0" # Patch-only — auto-picks up 5.60.1, 5.60.2, but not 5.61.0
version = "~> 5.60"   # Minor-flexible — auto-picks up 5.61.0, 5.99.0, but not 6.0.0
version = ">= 5.0"    # Wide open — risky; a future major version could break your config
```

### Under the Hood

```
Your constraint: ~> 5.60
                    │
                    ▼
        Terraform Registry has: 5.58.0, 5.59.1, 5.60.0, 5.60.1, 5.61.0, 6.0.0
                    │
                    ▼
        Candidates matching ~> 5.60 (>= 5.60.0, < 6.0.0):
            5.60.0 ✓   5.60.1 ✓   5.61.0 ✓        6.0.0 ✗ (major bump, excluded)
                    │
                    ▼
        Terraform picks the HIGHEST matching version: 5.61.0
                    │
                    ▼
        Locked into .terraform.lock.hcl as an exact version + checksum
        (stays at 5.61.0 until you explicitly run `terraform init -upgrade`)
```

### Comparison: Strategy Trade-offs

| Strategy | Safety | Maintenance burden | Recommended for |
|----------|--------|---------------------|------------------|
| Exact pin (`= 5.60.0`) | Highest | High — must bump by hand often | Regulated/compliance environments |
| Patch-only (`~> 5.60.0`) | High | Low | Most production teams |
| Minor-flexible (`~> 5.60`) | Medium | Very low | Fast-moving teams, non-critical envs |
| Open (`>= 5.0`) | Low | None (until it breaks) | Rarely recommended |

### Common Mistakes

- **Assuming semantic versioning guarantees zero breaking changes within a major version.**
  HashiCorp providers try hard to follow semver, but provider *behavior* changes (like a new
  required argument becoming effectively required due to an API deprecation) can still surface
  even within a minor bump — always read the CHANGELOG before running `-upgrade` in production.
- **Forgetting that the lock file, not the constraint string, determines the actual version used
  day-to-day.** Editing `version = "~> 5.60"` in your `.tf` file doesn't upgrade anything by
  itself — you must run `terraform init -upgrade` to actually re-resolve and rewrite the lock file.
- **Mixing constraint styles across team members' local configs** — if one engineer's `.tf` file
  says `~> 5.0` and another says `~> 5.60`, whoever runs `init -upgrade` first can silently shift
  what the whole team resolves to.

### Interview Answer

"Terraform provider version constraints use operators like `=`, `>=`, and the pessimistic
constraint `~>`, which allows only the rightmost specified version segment to increment — `~>
5.60` allows any `5.x` release at or above `5.60` but excludes `6.0.0`. The actual resolved
version is written to `.terraform.lock.hcl`, which is what guarantees reproducible builds across
machines; the constraint in your `.tf` file only defines the acceptable range, and you have to
explicitly run `terraform init -upgrade` to move to a newer version within that range."

> **Memory hook:** `~>` is a leash, not a fence — it lets the dog (the version) wander within the yard (the range) but never past the gate (the next major version).

---

## 4. Multiple Provider Configurations (Aliases)

You're deploying an application that needs an S3 bucket in `us-east-1` for CloudFront origin
requirements, but the rest of your infrastructure lives in `ap-southeast-2`. A single `provider
"aws" { region = "..." }` block can only represent one region. So how do you manage resources in
two regions — or two AWS accounts — within one Terraform configuration? You configure the same
provider *twice*, and distinguish the two configurations with an **alias**.

### Analogy

Think of `provider "aws" {}` as a phone line to "AWS." If you need to call two different AWS
offices (say, the US East office and the Australia office), you don't get a new phone — you save
two separate contacts in your phonebook: "AWS – US East" and "AWS – Australia," each with its own
number (region). The `alias` is that contact label — it lets you dial the right one explicitly
whenever you need to.

### Example

```hcl
provider "aws" {
  region = "ap-southeast-2"   # default/unaliased provider
}

provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}

# Uses the DEFAULT provider (ap-southeast-2) — no alias needed
resource "aws_instance" "app" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}

# Explicitly uses the aliased provider (us-east-1)
resource "aws_acm_certificate" "cloudfront_cert" {
  provider = aws.us_east

  domain_name       = "www.example.com"
  validation_method = "DNS"
}
```

The `provider = aws.us_east` line inside the resource block is the key syntax: it overrides which
of the two `provider "aws"` configurations that specific resource should use.

### Multi-Account Example

Aliases are equally common for cross-account setups, using distinct credentials per alias via
`assume_role`:

```hcl
provider "aws" {
  alias  = "shared_services"
  region = "us-east-1"

  assume_role {
    role_arn = "arn:aws:iam::111111111111:role/TerraformCrossAccount"
  }
}

provider "aws" {
  alias  = "production"
  region = "us-east-1"

  assume_role {
    role_arn = "arn:aws:iam::222222222222:role/TerraformCrossAccount"
  }
}

resource "aws_route53_record" "shared_dns" {
  provider = aws.shared_services
  # ...
}

resource "aws_instance" "prod_app" {
  provider = aws.production
  # ...
}
```

### Under the Hood

```
required_providers { aws = { source = "hashicorp/aws" } }   ← ONE plugin binary type

provider "aws" { region = "ap-southeast-2" }        ┐
provider "aws" { alias = "us_east" ... }            ┤  TWO separate configured instances
provider "aws" { alias = "production" ... }         ┘  of that SAME plugin binary,
                                                        each with its own settings

Every aws_* resource picks exactly ONE of these instances (default, unless
`provider = aws.<alias>` is set) to send its API calls through.
```

Only one provider *plugin binary* is downloaded — `aliases` don't require separate plugin
installs. What multiplies is the number of *configured instances* of that same plugin, each
potentially pointed at a different region, account, or credential set.

### Common Mistakes

- **Forgetting the `provider = aws.alias_name` line** on a resource that needs the non-default
  configuration — it silently falls back to whatever the unaliased `provider "aws" {}` block
  specifies, often the wrong region/account.
- **Trying to alias inside a child module's provider block directly** — instead, provider
  configurations (including aliased ones) must be passed into child modules explicitly via the
  module's `providers = { ... }` argument (covered in the Modules phase).
- **Assuming aliases are required just to change region per-resource.** Many AWS resource types
  accept region as part of an ARN or endpoint override; aliases are specifically for cases needing
  a genuinely different provider *configuration* (different region, account, or credentials) tied
  to specific resources.

### Interview Answer

"An alias lets you configure the same provider multiple times within one Terraform configuration
— for example, one `provider "aws"` block per AWS region or per account. Each aliased block is a
distinct configured instance of the same plugin binary. Any resource that needs the non-default
configuration must explicitly reference it with `provider = aws.<alias_name>`; without that line,
a resource always uses the default, unaliased provider configuration. This is the standard pattern
for multi-region or multi-account Terraform setups."

> **Memory hook:** One phone (plugin), many saved contacts (aliases) — dial the right one explicitly with `provider = aws.contact_name`, or you'll call the default.

---

## 5. Authentication Methods

You've written `provider "aws" { region = "us-east-1" }` — but nowhere in that block did you type
an access key or a password. So how does the AWS provider actually authenticate? This is one of
the most common points of confusion for people new to Terraform, and also one of the most
important to get right for security: the AWS provider deliberately supports *multiple* credential
sources, checked in a defined priority order, so you're never forced to hardcode secrets in your
`.tf` files.

### Analogy

Think of it like how your phone tries multiple ways to get online: first it checks if you've
manually entered Wi-Fi credentials, then it falls back to a saved network, then to cellular data.
It doesn't ask you to type in a password every single time — it checks a prioritized list of
"known good" sources and uses the first one that works. AWS credential resolution works the same
way.

### Authentication Methods, Ranked by Provider Chain Priority

| Priority | Method | Where it lives | Best for |
|----------|--------|-----------------|----------|
| 1 (highest) | Explicit provider arguments | `access_key` / `secret_key` in the `provider` block | Never recommended — hardcodes secrets in HCL |
| 2 | Environment variables | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Local dev, CI/CD pipelines |
| 3 | Shared credentials file | `~/.aws/credentials` (profile-based) | Local development with multiple named accounts |
| 4 | Shared config file | `~/.aws/config` (`[profile ...]` blocks, supports `sso_*`, `role_arn`) | Local dev with AWS SSO or role assumption |
| 5 | Container credentials | ECS task role (via metadata endpoint) | Terraform running inside an ECS task |
| 6 (typically preferred in CI) | IAM role via OIDC | GitHub Actions/GitLab CI assuming a role via `sts:AssumeRoleWithWebIdentity` | CI/CD pipelines, no long-lived secrets at all |
| 7 (lowest, implicit) | EC2 instance profile | Attached IAM role on the EC2 instance running Terraform | Terraform running inside AWS itself (an EC2 box, a CodeBuild job) |

### Example — Environment Variables (most common for CI)

```bash
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="us-east-1"
```

```hcl
provider "aws" {
  # No credentials here at all — the provider picks them up from the environment
  region = "us-east-1"
}
```

### Example — Named Profile (shared credentials file)

`~/.aws/credentials`:
```ini
[dev-account]
aws_access_key_id     = AKIA...
aws_secret_access_key = wJal...

[prod-account]
aws_access_key_id     = AKIA...
aws_secret_access_key = wJal...
```

```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "prod-account"
}
```

### Example — OIDC (GitHub Actions, zero long-lived secrets)

```yaml
# .github/workflows/terraform.yml
permissions:
  id-token: write   # required for OIDC
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/github-actions-terraform
      aws-region: us-east-1
  - run: terraform apply -auto-approve
```

```hcl
provider "aws" {
  region = "us-east-1"
  # No credentials block needed — the AWS SDK's default credential chain
  # picks up the temporary credentials injected by configure-aws-credentials
}
```

### Under the Hood

```
terraform plan/apply
        │
        ▼
   AWS provider needs credentials
        │
        ▼
   Checks in order (first match wins):
   1. Static credentials in provider block      ──▶ found? use it, STOP
   2. AWS_ACCESS_KEY_ID / SECRET env vars        ──▶ found? use it, STOP
   3. Shared credentials file (~/.aws/credentials, selected profile) ──▶ STOP
   4. Shared config file (~/.aws/config, SSO/assume-role settings)   ──▶ STOP
   5. ECS container credentials endpoint          ──▶ STOP
   6. EC2 instance metadata service (IMDS) role   ──▶ STOP
        │
        ▼
   No credentials found anywhere → "NoCredentialProviders: no valid providers in chain" error
```

### Common Mistakes

- **Hardcoding `access_key`/`secret_key` directly in a `provider` block** and committing it to
  git — this is the single most common way AWS credentials leak publicly. Never do this; use
  environment variables, profiles, or role assumption instead.
- **Forgetting `AWS_SESSION_TOKEN`** when using temporary credentials (e.g. from `aws sso login`
  or `assume-role`) — static keys alone will fail with an authentication error if the credentials
  are actually temporary/session-based.
- **Assuming EC2 instance profiles "just work" everywhere** — they only apply when Terraform is
  literally running on an EC2 instance (or ECS task) with an attached IAM role; running Terraform
  from your laptop never picks these up.

### Interview Answer

"The AWS provider doesn't require you to hardcode credentials in HCL. It uses a credential
resolution chain, similar to the AWS SDK's default chain: it checks explicit provider arguments
first, then environment variables, then the shared credentials/config files (which support named
profiles and SSO), then container or EC2 instance metadata credentials. In CI/CD, the modern best
practice is OIDC-based role assumption — the pipeline gets short-lived, automatically rotated
credentials with no long-lived secret ever stored, which is both more secure and removes secret
rotation as an operational burden."

> **Memory hook:** AWS credential resolution is your phone trying Wi-Fi profiles in order before falling back to cellular — first match wins, and you never had to type a password each time.

---

## 6. Provider Plugin Cache

Your team has fifty Terraform projects, all using the AWS provider, all pinned to roughly the
same version. Every time someone runs `terraform init` in a fresh clone, does it really need to
re-download the same ~400MB AWS provider binary from the internet, every single time? That's
wasteful, slow, and fragile in CI where network flakiness can fail a whole pipeline. The provider
plugin cache solves exactly this.

### Analogy

Without a plugin cache, every project is like buying a brand new copy of the same reference book
every time you need it, even though you already own five copies on your shelf from other
projects. The plugin cache is that shelf — a single shared location Terraform checks first before
going out and "buying" (downloading) another copy.

### Enabling It

Set this in the CLI configuration file (`~/.terraformrc` on Linux/macOS, or `terraform.rc` on
Windows) — not inside any `.tf` file:

```hcl
# ~/.terraformrc
plugin_cache_dir = "$HOME/.terraform.d/plugin-cache"
```

Or via environment variable (handy for CI):

```bash
export TF_PLUGIN_CACHE_DIR="$HOME/.terraform.d/plugin-cache"
```

### Under the Hood

```
WITHOUT plugin cache:
  project-a/.terraform/providers/registry.terraform.io/hashicorp/aws/5.60.0/... (full copy)
  project-b/.terraform/providers/registry.terraform.io/hashicorp/aws/5.60.0/... (full copy AGAIN)
  project-c/.terraform/providers/registry.terraform.io/hashicorp/aws/5.60.0/... (full copy AGAIN)
                    → same binary downloaded and stored 3 times

WITH plugin cache:
  ~/.terraform.d/plugin-cache/registry.terraform.io/hashicorp/aws/5.60.0/... (ONE real copy)

  project-a/.terraform/providers/... → symlink to the cache
  project-b/.terraform/providers/... → symlink to the cache
  project-c/.terraform/providers/... → symlink to the cache
                    → downloaded once, linked everywhere else
```

`terraform init` still writes a `.terraform.lock.hcl` per project as normal — the cache only
changes *where the bytes physically live*, not the version-locking behavior.

### Common Mistakes

- **Expecting the plugin cache to skip `terraform init` entirely** — it only skips the *download*
  step; `init` still runs, still verifies checksums, and still writes the lock file per project.
- **Setting `TF_PLUGIN_CACHE_DIR` inside a `.tf` file** — this setting belongs in the CLI config
  file or an environment variable; it is not part of the Terraform language and has no effect if
  placed in a resource/provider block.
- **Using the cache across CI runners without shared storage.** A local plugin cache dir helps a
  single machine or a persistent runner reuse downloads across many projects; ephemeral CI
  containers that get wiped between runs need a different strategy (e.g. caching the `.terraform`
  or plugin-cache directory as a CI artifact/cache layer) to see any benefit.

### Interview Answer

"The provider plugin cache is a shared local directory, configured via `plugin_cache_dir` in the
CLI config file (or the `TF_PLUGIN_CACHE_DIR` environment variable), where Terraform stores
downloaded provider binaries once and reuses them across every project on that machine instead of
re-downloading the same version for each project. `terraform init` still runs per project and
still writes a `.terraform.lock.hcl`, but the actual binary download is skipped if a matching,
checksum-verified copy already exists in the cache."

> **Memory hook:** The plugin cache is your shared bookshelf — buy the reference book once, let every project on the same machine borrow it instead of buying a new copy each time.

---

## 7. Hands-On Exercises

**Exercise 1 — Write a required_providers Block**
Write a `terraform { required_providers { } }` block requiring the AWS provider (patch-only
constraint on version `5.6x`) and the `hashicorp/random` provider (any `3.x`).

**Exercise 2 — Multi-Region Alias**
Write two `provider "aws"` blocks: a default one for `eu-west-1` and an aliased one
(`alias = "backup_region"`) for `eu-central-1`. Write one `aws_s3_bucket` resource in each region,
using the correct `provider = ` syntax where needed.

**Exercise 3 — Trace the Credential Chain**
A teammate says `terraform plan` is authenticating as the wrong AWS account. List, in priority
order, the five places Terraform would check for credentials, and describe how you'd find out
which one is actually being used (hint: `aws sts get-caller-identity` and checking env vars/
profile config).

**Exercise 4 — Constraint Behavior**
Given the constraint `~> 4.50`, would each of these versions be allowed? Justify each answer:
`4.50.0`, `4.67.3`, `4.49.9`, `5.0.0`.

**Exercise 5 — Plugin Cache Setup**
Write the `~/.terraformrc` content needed to enable a shared plugin cache at
`~/.terraform.d/plugin-cache`, and explain what changes (and doesn't change) in the output of
`terraform init` once it's enabled.

---

## 8. Interview Q&A

---

**Q1: What is the relationship between Terraform Core and a provider?**

A: Terraform Core is provider-agnostic — it parses HCL, builds the dependency graph, and manages
state, but has no built-in knowledge of any specific cloud API. A provider is a separate plugin
binary that Terraform Core launches as a subprocess and communicates with over a gRPC-based
plugin protocol; the provider is what actually knows how to translate resource arguments into real
API calls.

---

**Q2: What's the difference between `required_providers` and a `provider` block?**

A: `required_providers`, nested inside `terraform { }`, declares which provider plugins and which
version constraints a configuration needs — it's what `terraform init` uses to know what to
download. A `provider "aws" { }` block configures runtime behavior for that provider, like region
or credentials.

---

**Q3: What does the `~>` operator mean in a version constraint?**

A: It's the pessimistic constraint operator. `~> 5.60` allows any version `>= 5.60.0` and `<
6.0.0` — only the rightmost specified version segment is allowed to increment. `~> 5.60.2` is
stricter, allowing only `>= 5.60.2, < 5.61.0`.

---

**Q4: Why does Terraform use a lock file (`.terraform.lock.hcl`) in addition to version
constraints?**

A: The version constraint in `.tf` files defines an acceptable range; the lock file records the
exact resolved version and cryptographic checksums so that every machine and CI run downloads and
uses the identical provider binary until someone explicitly runs `terraform init -upgrade`. This
is what makes builds reproducible.

---

**Q5: How do you manage resources in two AWS regions in one Terraform configuration?**

A: Configure the AWS provider twice: once as the default `provider "aws" { region = "..." }`, and
again with an `alias` (e.g. `alias = "us_east"`). Any resource that should use the aliased
configuration explicitly sets `provider = aws.us_east`; resources without that line use the
default configuration.

---

**Q6: In what order does the AWS provider look for credentials?**

A: Roughly: explicit `access_key`/`secret_key` arguments in the provider block (highest priority,
not recommended), environment variables, the shared credentials file (`~/.aws/credentials`
profiles), the shared config file (supports SSO/assume-role), then container credentials (ECS),
then EC2 instance metadata (IMDS) role credentials. The first source that resolves successfully is
used.

---

**Q7: Why is OIDC-based authentication preferred over static access keys in CI/CD?**

A: OIDC lets the CI pipeline assume an IAM role using a short-lived, automatically issued identity
token instead of a long-lived static access key stored as a secret. This removes the need to
create, rotate, or ever leak a static AWS credential, and it scopes access tightly to what the
assumed role's trust policy allows for that specific pipeline/repository.

---

**Q8: What does the provider plugin cache actually cache, and what does it not skip?**

A: It caches the downloaded, checksum-verified provider plugin binaries in a shared directory so
multiple projects on the same machine don't each download their own copy of the same version. It
does not skip `terraform init` itself, and each project still gets its own
`.terraform.lock.hcl` recording the resolved version for that project.
