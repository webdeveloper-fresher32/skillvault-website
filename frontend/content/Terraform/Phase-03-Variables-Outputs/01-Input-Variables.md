# 01 — Input Variables

## Table of Contents

1. [Why Input Variables](#1-why-input-variables)
2. [variable Block Syntax](#2-variable-block-syntax)
3. [Type Constraints](#3-type-constraints)
4. [Default Values & Required Variables](#4-default-values--required-variables)
5. [Variable Validation Blocks](#5-variable-validation-blocks)
6. [Sensitive Variables](#6-sensitive-variables)
7. [Setting Variables (CLI, .tfvars, Env Vars, Precedence)](#7-setting-variables-cli-tfvars-env-vars-precedence)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Input Variables

Picture this: you've written a Terraform config that spins up an EC2 instance —
`instance_type = "t3.micro"`, `ami = "ami-0abcdef1234567890"`, `region = "us-east-1"` — all typed
directly into the `.tf` file. It works. Then your manager asks: "Great, now stand up the exact
same thing in staging, but with a bigger instance, in `eu-west-1`." Do you copy-paste the entire
file and hand-edit three values? What happens next month when there are five environments and
twelve values that differ between them? You'd be maintaining five near-identical copies of the
same configuration, and one day someone edits `staging/main.tf` and forgets to edit `prod/main.tf`
the same way — now your environments have silently drifted apart.

This is exactly the problem **input variables** solve. Instead of burning literal values into
your resource blocks, you declare *parameters* — named, typed placeholders — and the actual
values get supplied from outside the configuration at plan/apply time. The `.tf` files describing
*what infrastructure looks like* never change between environments; only the *values* fed into
them do.

### Analogy

Think of a Terraform configuration as a form letter template, and input variables as the mail-merge
fields — `{{customer_name}}`, `{{account_balance}}`. You write the letter's structure exactly
once. To send a thousand personalized letters, you don't rewrite the letter a thousand times —
you feed the mail-merge engine a thousand different data rows, and it stamps out a thousand
letters from one template. Your `main.tf` is the letter; your variable values (per environment)
are the data rows.

### Under the Hood

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR .tf CONFIGURATION                       │
│                                                                    │
│   variable "instance_type" {                                     │
│     type = string                                                 │
│   }                                                                │
│                                                                    │
│   resource "aws_instance" "web" {                                 │
│     instance_type = var.instance_type   ◄── placeholder, not a   │
│     ami           = var.ami                 literal value        │
│   }                                                                │
└───────────────────────────┬────────────────────────────────────┘
                             │  terraform plan / apply
                             │  reads values from (in precedence order):
                             ▼
      ┌──────────────────────────────────────────────────────┐
      │  -var / -var-file flags │ *.auto.tfvars │ terraform.  │
      │  TF_VAR_* env vars      │                │ tfvars     │
      └──────────────────────────────────────────────────────┘
                             │
                             ▼
              Terraform builds one merged "input map"
              and substitutes it into every var.xxx reference
                             │
                             ▼
                Resource graph built with REAL values
                (t3.micro in dev, m5.large in prod — same file)
```

Terraform doesn't compile your `.tf` files differently per environment — it evaluates the *same*
graph of resources, but resolves every `var.xxx` reference against whatever value map you handed
it that run. This is why the same module can be `terraform apply`'d against dev, staging, and
prod with three different `.tfvars` files and produce three appropriately-sized environments.

### Concrete Example

```hcl
# variables.tf
variable "instance_type" {
  type        = string
  description = "EC2 instance type for the web server"
  default     = "t3.micro"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev, staging, prod)"
}

# main.tf
resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd" # Amazon Linux 2023, us-east-1
  instance_type = var.instance_type

  tags = {
    Name        = "web-${var.environment}"
    Environment = var.environment
  }
}
```

```hcl
# prod.tfvars
environment   = "prod"
instance_type = "m5.large"
```

```bash
terraform apply -var-file="prod.tfvars"
```

Nothing in `main.tf` changed between dev and prod — only the values fed in via `prod.tfvars`.

### Common Mistakes

- **Hardcoding "just this once."** Every hardcoded literal is a promise you'll remember to change
  it consistently everywhere it's duplicated — a promise that eventually gets broken.
- **Treating variables as just a way to avoid typing twice.** Their real value is *decoupling
  configuration (structure) from data (values)* — that's what lets the same module be reused
  across environments, teams, and accounts.
- **Forgetting variables are per-*root-module* by default.** A variable declared in a child module
  is a separate variable from one with the same name in the root — values must be explicitly
  passed in via the module block (covered in Phase 6).

### Interview Answer

"Input variables parameterize a Terraform configuration so the same `.tf` code can be reused
across environments or accounts by supplying different values, instead of duplicating and
hand-editing files. They decouple the *structure* of infrastructure (resource blocks) from the
*data* that instantiates it (instance sizes, regions, tags), which is what makes modules reusable
and environments consistent."

> **Memory hook:** Variables turn a one-off letter into a mail-merge template — write the structure once, feed in different data per recipient.

---

## 2. variable Block Syntax

You've decided to parameterize your config. Now: where does `var.instance_type` actually come
from, and what exactly can you put inside the block that declares it? Get the syntax wrong — say,
put `description` where `type` should go — and Terraform will refuse to even validate your
configuration. Let's look at every argument a `variable` block can take.

### Analogy

A `variable` block is like a form field on an intake form: it has a *label* (the variable name),
instructions for what kind of answer is expected (`type`), a pre-filled suggestion if you leave it
blank (`default`), a hint text explaining what it's for (`description`), a rule checking the
answer makes sense (`validation`), and a checkbox saying "don't print this on the receipt"
(`sensitive`).

### Syntax Anatomy

```hcl
variable "instance_type" {
  type        = string          # what kind of value is allowed
  description = "EC2 instance type for the web server"   # shows in `terraform plan`, docs
  default     = "t3.micro"      # used if no value is supplied (makes it optional)
  sensitive   = false           # if true, hides value from CLI/plan output
  nullable    = true            # if false, null is rejected even if type allows it

  validation {
    condition     = contains(["t3.micro", "t3.small", "m5.large"], var.instance_type)
    error_message = "instance_type must be one of: t3.micro, t3.small, m5.large."
  }
}
```

| Argument | Required? | Purpose |
|----------|-----------|---------|
| `type` | Optional (defaults to `any`) | Constrains what kind of value is accepted |
| `description` | Optional but strongly recommended | Documents intent; shows in `terraform plan`, `-json` output, generated docs |
| `default` | Optional | Value used if caller supplies none — makes the variable optional |
| `validation` | Optional, repeatable | Custom rule(s) checked after type conversion |
| `sensitive` | Optional (default `false`) | Redacts the value from CLI output and logs |
| `nullable` | Optional (default `true`) | Whether `null` is an acceptable value |

### Under the Hood

When Terraform parses your configuration, `variable` blocks are **not** resources — they don't
show up in the dependency graph as things to create. Instead, they're metadata that Terraform
uses during its *input resolution* phase, which happens before graph construction:

```
1. Terraform scans all *.tf files for `variable` blocks → builds a schema
2. Terraform gathers actual values from CLI/env/tfvars (see section 7)
3. For each variable: apply default if no value given → type-convert → run validation blocks
4. If any variable lacks a value AND has no default → Terraform prompts interactively
   (or errors in non-interactive/CI contexts)
5. Only after this resolves does Terraform substitute var.xxx references and build the graph
```

### Common Mistakes

- **Confusing `variable` blocks with the values themselves.** The block only *declares* the
  variable's name, type, and constraints — it does not assign a value used across environments.
  The actual value comes from precedence rules in section 7.
- **Skipping `description`.** It costs nothing and it's what shows up when someone runs
  `terraform plan` without a value supplied, or when generating docs with `terraform-docs`.
- **Assuming all arguments are required.** Only the variable's *name* (the block label) is
  mandatory — every argument inside the block is optional (though omitting `type` silently
  defaults to `any`, which defeats most of the safety type constraints give you).

### Interview Answer

"A `variable` block declares a named input with an optional type constraint, default value,
description, validation rules, and a sensitive flag. It's metadata Terraform resolves during
input processing, before building the resource graph — it doesn't create anything itself, it
just defines the contract for what values the configuration accepts."

> **Memory hook:** A `variable` block is an intake form field — name, type of answer expected, a suggested default, and a validation rule, all before anyone actually fills it in.

---

## 3. Type Constraints

Suppose someone runs your Terraform config and passes `instance_count = "three"` instead of `3`.
Without any guardrail, that typo could silently propagate deep into your configuration and
explode with a cryptic error three resources downstream — or worse, coerce into something
unexpected and create the wrong infrastructure. Type constraints are Terraform's way of catching
"three" the moment it comes in the door, before it ever touches a resource block.

### Analogy

Type constraints are like the shape-sorter toy for toddlers — the round hole only accepts round
pegs, the square hole only accepts square pegs. You can't jam a string into a slot expecting a
number; the mismatch gets caught immediately, right at the opening, not somewhere deep inside
the box.

### The Type System

```
                    any
                     │
        ┌────────────┼──────────────────────┐
        │            │                       │
   PRIMITIVE TYPES    COLLECTION TYPES    STRUCTURAL TYPES
        │                    │                    │
   ┌────┼────┐      ┌────────┼────────┐   ┌───────┼────────┐
 string number bool  list(T) map(T) set(T)  object({...})  tuple([...])
```

| Type | Example Value | Use Case |
|------|---------------|----------|
| `string` | `"t3.micro"` | Single text value |
| `number` | `3`, `2.5` | Counts, ports, sizes |
| `bool` | `true`, `false` | Feature toggles |
| `list(string)` | `["us-east-1a", "us-east-1b"]` | Ordered, allows duplicates |
| `set(string)` | `["10.0.1.0/24", "10.0.2.0/24"]` | Unordered, unique values |
| `map(string)` | `{ Name = "web", Team = "sre" }` | Key-value pairs, all same value type |
| `object({...})` | `{ name = "web", port = 8080 }` | Fixed set of named attributes, mixed types |
| `tuple([...])` | `["web", 8080, true]` | Fixed-length, mixed-type ordered list |

### Concrete Example

```hcl
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "instance_count" {
  type    = number
  default = 2
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "allowed_cidr_blocks" {
  type    = set(string)
  default = ["10.0.0.0/16", "192.168.0.0/16"]
}

variable "common_tags" {
  type = map(string)
  default = {
    ManagedBy = "terraform"
    Team      = "platform"
  }
}

variable "server_config" {
  type = object({
    name          = string
    instance_type = string
    port          = number
    tags          = map(string)
  })
  default = {
    name          = "web"
    instance_type = "t3.micro"
    port          = 8080
    tags          = {}
  }
}
```

### List vs Set vs Map — Comparison

| Property | `list(T)` | `set(T)` | `map(T)` |
|----------|-----------|----------|----------|
| **Ordering** | Preserved | Not preserved (unordered) | Keyed, no positional order |
| **Duplicates** | Allowed | Automatically deduplicated | Keys must be unique |
| **Access** | By index: `var.azs[0]` | No index access | By key: `var.tags["Team"]` |
| **Good for** | Ordered sequences (AZ lists, subnet CIDRs in order) | Collections where uniqueness matters, order doesn't (security group rules) | Named key-value config (tags, labels) |

### Common Mistakes

- **Using `list` when you actually need `set`.** If duplicates would be a bug (e.g., a list of
  security group ports) and order truly doesn't matter, `set` self-documents that intent and
  Terraform enforces uniqueness for you.
- **Forgetting `object` types are *closed* by default.** Passing an extra attribute not declared
  in the object type is a validation error (unless you use the `optional()` modifier for that
  attribute), not silently ignored.
- **Assuming `any` is "flexible" rather than "unchecked."** `type = any` accepts literally
  anything with zero validation — it's the type-constraint equivalent of removing the guardrail
  entirely, not a more permissive guardrail.

### Interview Answer

"Terraform's type system has primitive types — `string`, `number`, `bool` — and complex types:
collection types `list`, `set`, `map` which hold multiple values of one element type, and
structural types `object` and `tuple` which hold a fixed set of differently-typed attributes.
Declaring a type constraint means Terraform validates and, where possible, converts the supplied
value at input-resolution time, catching type mismatches before they reach the resource graph
rather than failing deep inside a provider."

> **Memory hook:** Type constraints are the toddler shape-sorter — the wrong-shaped peg gets rejected at the hole, not after it's already inside the box.

---

## 4. Default Values & Required Variables

Here's a design decision every variable declaration forces you to make: should this variable have
a sensible default, or should it be **required** — forcing the caller to explicitly supply it
every time? Get this wrong in one direction and every `terraform apply` needs ten `-var` flags for
values that almost never change. Get it wrong in the other direction and someone forgets to set
`environment` and silently deploys to `dev` defaults in what was supposed to be `prod`.

### Analogy

Think of ordering a coffee. "Size" is a required variable — the barista won't guess for you, you
must say small/medium/large. "Number of sugars" has a sensible default (zero) — if you say
nothing, you get unsweetened coffee, and only speak up if you want something different. A
well-designed `variable` block makes the same judgment call per parameter: does silence mean "use
the common case," or does silence mean "stop and ask"?

### The Rule

```
variable "x" {
  type    = string
  default = "some-value"     # ← presence of `default` makes this OPTIONAL
}

variable "y" {
  type = string
  # no default                # ← absence of `default` makes this REQUIRED
}
```

- If `default` is present: the variable is **optional**. Omit a value entirely and Terraform
  silently uses the default.
- If `default` is absent: the variable is **required**. Terraform will either prompt you
  interactively for a value, or — in `-input=false` / CI contexts — fail the plan/apply with
  `Error: No value for required variable`.

### Concrete Example

```hcl
# Optional — sensible default, most callers never touch it
variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.micro"
}

# Required — every environment MUST decide this explicitly.
# No default means: force the caller to think about it.
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

resource "aws_instance" "web" {
  instance_type = var.instance_type
  ami           = "ami-0c101f26f147fa7fd"

  tags = {
    Environment = var.environment
  }
}
```

```bash
# This fails — "environment" has no default and none was supplied
terraform plan
# Error: No value for required variable "environment"

# This succeeds
terraform plan -var="environment=staging"
```

### When to Make a Variable Required

| Make it required when... | Give it a default when... |
|---------------------------|----------------------------|
| A wrong guess would be dangerous (e.g., `environment`, `account_id`) | The common case covers 90%+ of usage (e.g., `instance_type = "t3.micro"`) |
| There genuinely is no sane universal default (e.g., `vpc_cidr` per team) | You want callers to override only in special cases |
| You want to force a deliberate, explicit decision every time | Convenience matters more than forcing a decision |

### Common Mistakes

- **Giving `environment` or `region` a default "just to make testing easier."** This is exactly
  how someone accidentally applies dev-shaped infrastructure to a production account — the
  default silently absorbed a missing, critical decision.
- **Making everything required "to be safe."** This just makes the module annoying to call —
  ten `-var` flags for values that are genuinely always the same defeats variables' whole
  convenience purpose.
- **Confusing `default = null` with "no default."** Setting `default = null` still makes the
  variable optional (it resolves to `null` if omitted) — it's different from omitting `default`
  entirely, which makes Terraform demand a value.

### Interview Answer

"A variable with a `default` argument is optional — Terraform uses the default when no value is
supplied. Omitting `default` makes the variable required — Terraform will prompt interactively or
fail the run if no value is provided via CLI, tfvars, or environment variable. The design
principle is: default the safe, common-case values; require the ones where a wrong guess (like
which environment or account you're deploying to) would be dangerous."

> **Memory hook:** Coffee size is required — the barista won't guess. Sugar count defaults to zero — silence means the common case.

---

## 5. Variable Validation Blocks

Type constraints catch "you gave me a string when I wanted a number." But they can't catch
"you gave me a *valid* string that is nonetheless a nonsense value" — like `instance_type =
"my-favorite-server"`, which is a perfectly well-typed string that will only fail once AWS
rejects it, potentially minutes into an apply, after other resources have already started
creating. `validation` blocks let you catch *semantic* mistakes — not just type mistakes — at
plan time, before anything touches the cloud.

### Analogy

A `validation` block is the bouncer at a club door checking ID, standing *after* the "are you a
human with a photo ID" check (that's the type constraint) but *before* you're allowed inside.
Type constraints check "is this the right shape of thing?" Validation blocks check "is this
specific thing actually allowed in here?"

### Syntax

```hcl
variable "instance_type" {
  type        = string
  description = "EC2 instance type"

  validation {
    condition     = contains(["t3.micro", "t3.small", "t3.medium", "m5.large"], var.instance_type)
    error_message = "instance_type must be one of: t3.micro, t3.small, t3.medium, m5.large."
  }
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be exactly one of: dev, staging, prod."
  }
}

variable "port" {
  type    = number
  default = 443

  validation {
    condition     = var.port > 0 && var.port <= 65535
    error_message = "port must be between 1 and 65535."
  }
}

variable "cidr_block" {
  type = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "cidr_block must be a valid CIDR notation, e.g. 10.0.0.0/16."
  }
}
```

A `variable` block can have **multiple** `validation` blocks — each runs independently, and all
must pass.

### Under the Hood

```
terraform plan
     │
     ▼
1. Value resolved (from -var/tfvars/env/default)
     │
     ▼
2. Type conversion attempted (string → number, etc.)
     │  fails here → "Invalid value for variable" (type error)
     ▼
3. Every `validation` block's `condition` evaluated
     │  condition = false → "error_message" printed, plan HALTS
     ▼
4. Only if ALL validations pass → value substituted into var.xxx everywhere
```

The key detail: validation happens **before** the resource graph is built. A failing validation
means zero API calls were made — nothing was even attempted, unlike a bad value that only AWS
itself would have rejected.

### Common Mistakes

- **Referencing another variable inside a `condition`.** A variable's own `validation` block can
  only reference *itself* (`var.<same-name>`) — it cannot cross-validate against a different
  variable's value. Cross-variable checks require a `check` block (Terraform 1.5+) or a
  precondition on a resource/output.
- **Using `error_message` that doesn't say what's actually wrong.** `"Invalid input."` tells the
  next engineer nothing. `"environment must be one of: dev, staging, prod (got: 'Production')"`
  tells them exactly what to fix.
- **Forgetting `can()` for expressions that might error, not just return false.** Functions like
  `cidrhost()` *throw an error* on a malformed CIDR rather than returning `false` — wrapping in
  `can()` converts that error into a clean `false` your condition can use.

### Interview Answer

"`validation` blocks let you enforce semantic constraints on a variable's value beyond what its
type allows — for example, restricting a string to an enum of allowed values, or checking a
number falls within a valid range. They run during input processing, before the resource graph is
built, so a bad value fails fast with a custom error message instead of surfacing as a confusing
provider-level error partway through an apply."

> **Memory hook:** Type constraints check the shape of the ID card; validation blocks are the bouncer checking if this specific person is actually on the list.

---

## 6. Sensitive Variables

Say your Terraform config takes a database password as a variable so it can wire it into an RDS
instance. Now run `terraform plan` — by default, that password shows up in plain text in your
terminal output, and again in CI logs, and again in `terraform.tfstate` on disk. Anyone with read
access to your CI pipeline's build logs now has your database password. Marking a variable
`sensitive = true` is Terraform's built-in way to stop that value from being echoed anywhere it
doesn't strictly need to be.

### Analogy

Marking a variable sensitive is like a doctor's office writing your prescription on paper that
says "CONFIDENTIAL" across it — everyone in the workflow still *uses* the real prescription to do
their job, but nobody prints it on the public receipt, and it gets redacted (`(sensitive value)`)
on any screen or printout that isn't specifically authorized to see it.

### Syntax

```hcl
variable "db_password" {
  type        = string
  description = "Master password for the RDS instance"
  sensitive   = true
}

resource "aws_db_instance" "main" {
  identifier = "app-db"
  engine     = "postgres"
  username   = "app_admin"
  password   = var.db_password   # still works normally — sensitivity doesn't block usage
  # ...
}
```

```bash
$ terraform plan
  # aws_db_instance.main will be created
  + resource "aws_db_instance" "main" {
      + password = (sensitive value)   # ← redacted in CLI output
      ...
```

### What sensitive = true Actually Does (and Doesn't Do)

| It DOES | It does NOT |
|---------|-------------|
| Redact the value from `terraform plan`/`apply` CLI output | Encrypt the value in the state file — it's stored in plaintext in `.tfstate` |
| Redact the value if it flows into an output (forces that output `sensitive = true` too) | Prevent anyone with state-file read access from seeing it |
| Mark the value in `-json` plan output as `"sensitive": true` | Stop the value from being logged by the *provider* if the provider itself logs it |
| Propagate — any expression derived from a sensitive value becomes sensitive too | Replace the need for a proper secrets manager (Vault, AWS Secrets Manager) |

This distinction matters: `sensitive = true` is a **UI/output redaction feature**, not an
encryption feature. State files still need to be protected (encrypted backend, restricted access)
regardless — this is covered in depth in Phase 10 (Security & Secrets), including how to source
secrets from AWS Secrets Manager or Vault instead of passing them as raw `.tfvars` values at all.

### Common Mistakes

- **Believing `sensitive = true` encrypts the state file.** It only hides the value from console/
  log output. The state file is the real thing to lock down — via a remote backend with
  encryption at rest and tight IAM/access controls.
- **Putting real secrets in a `.tfvars` file committed to git — sensitive or not.** Marking the
  variable sensitive does nothing to protect a plaintext secret sitting in version control.
  `.tfvars` files containing secrets should be gitignored, or better, the secret should come from
  a secrets manager data source instead (Phase 10).
- **Forgetting sensitivity propagates.** If `local.connection_string` is built by interpolating a
  sensitive variable, `local.connection_string` becomes sensitive too — and any output exposing
  it must also be marked `sensitive = true` or Terraform will error asking you to.

> This is only a preview — full secrets-management patterns (Vault, AWS Secrets Manager,
> encrypted backends, avoiding secrets in state entirely) are covered in Phase 10: Security &
> Secrets.

### Interview Answer

"Marking a variable `sensitive = true` tells Terraform to redact its value from CLI output, plan
output, and `-json` plan exports, and that sensitivity propagates to anything derived from it. It
is purely a display-redaction control, not encryption — the value is still stored in plaintext in
the state file, so protecting state (encrypted remote backend, restricted access) remains
necessary regardless of this flag."

> **Memory hook:** `sensitive = true` is the "CONFIDENTIAL" stamp on the printout, not a lock on the filing cabinet — the filing cabinet still needs its own lock (encrypted state).

---

## 7. Setting Variables (CLI, .tfvars, Env Vars, Precedence)

You now know how to *declare* a variable. But when you actually run `terraform apply`, where does
Terraform look to find the real value, if there are several places a value *could* come from at
once? What happens if `terraform.tfvars` says `instance_type = "t3.micro"` but you also pass
`-var="instance_type=m5.large"` on the command line — which one wins? Knowing the precedence
order is what saves you from "but I set that variable, why is it still using the old value?"
debugging sessions.

### Analogy

Think of it like layered settings on a phone: there's a factory default, then a company-wide MDM
profile, then your personal settings, then a one-time override you tap right before opening an
app. The most specific, most recently applied setting wins — but if you never set the personal
override, it quietly falls back to the layer below. Terraform's variable sources stack the exact
same way.

### The Four Ways to Supply a Value

**1. Command-line flags**
```bash
terraform apply -var="instance_type=m5.large"
terraform apply -var-file="prod.tfvars"
```

**2. Variable definition files (`.tfvars` / `.tfvars.json`)**
```hcl
# prod.tfvars
instance_type = "m5.large"
environment   = "prod"
common_tags = {
  Team = "platform"
}
```
```bash
terraform apply -var-file="prod.tfvars"
```

**3. Environment variables (`TF_VAR_<name>`)**
```bash
export TF_VAR_instance_type="m5.large"
export TF_VAR_db_password="hunter2"   # useful for secrets in CI — never printed in shell history if set via CI secret store
terraform apply
```

**4. Interactive prompt**
If a required variable (no default) has no value from any other source, and Terraform is running
in an interactive terminal, it prompts:
```
var.environment
  Deployment environment (dev, staging, prod)

  Enter a value:
```
In CI (`-input=false`), this instead becomes a hard error.

### Precedence Order (Highest Wins)

```
┌───────────────────────────────────────────────────────────────┐
│ 1. -var and -var-file on the command line                     │  ← HIGHEST
│    (later flags on the same command line override earlier ones)│
├───────────────────────────────────────────────────────────────┤
│ 2. *.auto.tfvars / *.auto.tfvars.json                          │
│    (auto-loaded, alphabetical order if multiple)               │
├───────────────────────────────────────────────────────────────┤
│ 3. terraform.tfvars.json                                       │
├───────────────────────────────────────────────────────────────┤
│ 4. terraform.tfvars                                             │
│    (auto-loaded if present, no flag needed)                    │
├───────────────────────────────────────────────────────────────┤
│ 5. TF_VAR_<name> environment variables                        │
├───────────────────────────────────────────────────────────────┤
│ 6. default value in the variable block                         │  ← LOWEST
└───────────────────────────────────────────────────────────────┘
```

| Source | Auto-loaded? | Typical use |
|--------|-------------|-------------|
| `-var` | No — must pass explicitly | One-off overrides, scripting |
| `-var-file` | No — must pass explicitly | Per-environment value sets (`prod.tfvars`) |
| `*.auto.tfvars` | Yes — Terraform loads automatically | Shared defaults you want auto-applied without a flag |
| `terraform.tfvars` | Yes — Terraform loads automatically if present | The "default" values file for a config |
| `TF_VAR_*` | Yes — read from shell environment | CI/CD secrets, avoiding values in files entirely |
| `default` in block | Always available as fallback | Sensible built-in default |

### Concrete Example

```hcl
# variables.tf
variable "instance_type" {
  type    = string
  default = "t3.micro"
}
```

```bash
# terraform.tfvars (auto-loaded)
instance_type = "t3.small"
```

```bash
export TF_VAR_instance_type="t3.medium"

terraform apply -var="instance_type=m5.large"
# Result: m5.large wins — CLI -var beats everything else
```

If the `-var` flag were removed from that command, the result would be `t3.small` — because
`terraform.tfvars` (rank 4) outranks `TF_VAR_*` (rank 5), even though the environment variable
was set *last* in time. Precedence is about source rank, not chronological order of when you set
it.

### Common Mistakes

- **Assuming environment variables always win because they were "set most recently."**
  Precedence is fixed by source type, not by when you exported it — `terraform.tfvars` beats
  `TF_VAR_*` every time, regardless of shell history order.
- **Not realizing `terraform.tfvars` loads automatically with no flag.** Teams sometimes wonder
  why a value changes even though no `-var-file` was passed — it's because a `terraform.tfvars`
  sitting in the working directory is picked up silently.
- **Putting secrets in `*.auto.tfvars` and committing it to git "for convenience."** Auto-loading
  is exactly why this is dangerous — anyone running `terraform apply` in that directory picks up
  the secret without even knowing the file exists.

### Interview Answer

"Terraform resolves a variable's value from, in order of highest to lowest precedence: `-var` and
`-var-file` command-line flags, then `*.auto.tfvars` files, then `terraform.tfvars`, then
`TF_VAR_*` environment variables, and finally the `default` in the variable block. Precedence is
determined by the source, not by timing — an environment variable set most recently still loses
to a `terraform.tfvars` file sitting in the directory, because file-based `.tfvars` outranks
environment variables in Terraform's resolution order."

> **Memory hook:** Like layered phone settings — factory default loses to MDM profile loses to your personal setting loses to the one-tap override you make right before opening the app; the most specific layer always wins, not the most recent click.

---

## 8. Hands-On Exercises

**Exercise 1 — Parameterize a Hardcoded Config**

Given this hardcoded configuration:
```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd"
  instance_type = "t3.micro"

  tags = {
    Name        = "web-server"
    Environment = "dev"
  }
}
```
Rewrite it using `variable` blocks for `ami`, `instance_type`, and `environment`. Give
`instance_type` a default of `"t3.micro"`, but make `environment` required.

**Exercise 2 — Type Constraints**

Write `variable` blocks for the following, choosing the correct type for each:
- A list of exactly three availability zone names, order matters.
- A set of allowed inbound ports, where duplicates would be a bug.
- A map from environment name to instance count (e.g., `{ dev = 1, prod = 5 }`).
- An object representing a VPC's config: `cidr_block` (string), `enable_dns` (bool),
  `subnet_count` (number).

**Exercise 3 — Validation Blocks**

Add a `validation` block to a `variable "environment"` (type `string`) that only allows the
values `dev`, `staging`, or `prod`, with a clear, actionable error message. Then add a
`validation` block to a `variable "instance_count"` (type `number`) requiring the value be
between 1 and 10 inclusive.

**Exercise 4 — Sensitive Variables**

Declare a `variable "db_password"` marked `sensitive = true`, wire it into an
`aws_db_instance.password` argument, and run `terraform plan` (or reason through what the CLI
output would show). Explain in one paragraph why `sensitive = true` alone is not sufficient
protection for this secret in a real production pipeline.

**Exercise 5 — Precedence Puzzle**

Given: a `variable "region"` with `default = "us-east-1"`, a `terraform.tfvars` file containing
`region = "us-west-2"`, an exported `TF_VAR_region=eu-west-1`, and a command run as
`terraform apply -var="region=ap-south-1"` — what value does `var.region` resolve to? Now remove
the `-var` flag from the command — what does it resolve to, and why?

---

## 9. Interview Q&A

---

**Q1: What is the purpose of a Terraform input variable?**

A: Input variables parameterize a Terraform configuration so the same resource definitions can be
reused with different values across environments, accounts, or teams, instead of hardcoding
literals that must be manually duplicated and kept in sync across copies of a config.

---

**Q2: What happens if a variable has no `default` and no value is supplied?**

A: If Terraform is running interactively, it prompts the user to enter a value at the terminal.
If running non-interactively (e.g., `-input=false` in CI/CD), it fails immediately with
`Error: No value for required variable`, without attempting to build the resource graph.

---

**Q3: What's the difference between `list`, `set`, and `map` type constraints?**

A: `list(T)` is an ordered collection that allows duplicate values and supports index access.
`set(T)` is an unordered collection that automatically deduplicates values and has no index
access. `map(T)` is a collection of key-value pairs, accessed by key, where all values share the
same type `T`.

---

**Q4: What does a `validation` block check, and when does it run?**

A: A `validation` block checks a custom, semantic condition on a variable's value — beyond what
its type constraint alone can enforce, like restricting a string to an enum or a number to a
range. It runs during Terraform's input-processing phase, after type conversion but before the
resource graph is built, so an invalid value fails fast with a custom `error_message` instead of
surfacing as a confusing provider error mid-apply.

---

**Q5: Does marking a variable `sensitive = true` encrypt it in the state file?**

A: No. `sensitive = true` only redacts the value from CLI output, plan output, and `-json` plan
exports (and propagates that redaction to anything derived from it). The value is still stored in
plaintext inside the Terraform state file, so protecting state itself — via an encrypted remote
backend and restricted access — remains necessary regardless of this flag.

---

**Q6: What is the precedence order for variable values in Terraform?**

A: From highest to lowest precedence: `-var` / `-var-file` command-line flags, then
`*.auto.tfvars` files (loaded automatically), then `terraform.tfvars.json`, then
`terraform.tfvars` (also loaded automatically), then `TF_VAR_<name>` environment variables, and
finally the variable's `default` value as the last fallback.

---

**Q7: If I set `TF_VAR_region` in my shell right before running `terraform apply`, but a
`terraform.tfvars` file in the working directory also sets `region`, which value wins?**

A: The `terraform.tfvars` value wins. Precedence in Terraform is determined by source type, not
by the order or recency in which values were set — file-based `.tfvars` sources always outrank
`TF_VAR_*` environment variables in the resolution order, regardless of shell history timing.

---

**Q8: Why would you use `TF_VAR_` environment variables instead of a `.tfvars` file for a
secret?**

A: Environment variables are a common way to inject secrets in CI/CD pipelines without writing
them to disk in a file that could accidentally be committed to version control or left behind on
a build agent. Most CI systems support masking secret environment variables in logs, whereas a
plaintext `.tfvars` file sitting in a repo or workspace has no such protection.

---

**Q9: Can a variable's `validation` block reference the value of a *different* variable?**

A: No — a variable's own `validation` block can only reference `var.<its own name>`. Cross-
variable validation (e.g., "this value must be less than that other variable's value") requires
a `check` block (Terraform 1.5+) or a `precondition` attached to a resource, data source, or
output.

---

**Q10: What's the difference between omitting `default` entirely and setting `default = null`?**

A: Omitting `default` makes the variable required — Terraform demands an explicit value from some
other source or prompts/errors if none is found. Setting `default = null` makes the variable
optional; if no value is supplied, it simply resolves to `null` (assuming `nullable` is not set
to `false`), rather than forcing the caller to provide anything.
