# 03 — Variable Files (`.tfvars`)

## Table of Contents

1. [Why `.tfvars` Files](#1-why-tfvars-files)
2. [`.tfvars` vs `.tfvars.json`](#2-tfvars-vs-tfvarsjson)
3. [Auto-Loaded Files](#3-auto-loaded-files)
4. [Explicit `-var-file` per Environment](#4-explicit--var-file-per-environment)
5. [Variable Precedence Order](#5-variable-precedence-order)
6. [Keeping Secrets Out of tfvars](#6-keeping-secrets-out-of-tfvars)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why `.tfvars` Files

Imagine you have a Terraform configuration with fifteen input variables — VPC CIDR, instance
type, min/max autoscaling size, domain name, tags, and so on. Every time you run `terraform
apply`, are you really going to type `-var="instance_type=t3.micro" -var="min_size=2" -var=
"max_size=6" ...` fifteen times on the command line, and get it *exactly* right every single
time, for every environment? Nobody does that in practice — one typo and you've silently applied
the wrong CIDR block to production. Terraform gives you a much saner alternative: put all those
values in a file, and let Terraform load them for you.

A **`.tfvars` file** is simply a file of `key = value` assignments, one per variable, that
Terraform reads and uses to populate your declared `variable` blocks — without you typing a
single `-var` flag.

```hcl
# variables.tf
variable "instance_type" {
  type = string
}
variable "min_size" {
  type = number
}
```

```hcl
# dev.tfvars
instance_type = "t3.micro"
min_size      = 1
```

```bash
terraform apply -var-file="dev.tfvars"
```

### Analogy

Think of `.tfvars` files like a printed order form you hand to a barista instead of shouting your
order across the counter every time. You fill it out once ("oat milk latte, extra shot, 12oz"),
hand it over, and the barista reads the whole thing reliably — instead of you trying to remember
and re-say six specific details out loud, correctly, every single visit.

### Under the Hood

When Terraform runs `plan` or `apply`, before it ever touches a resource, it goes through a value
resolution phase for every declared `variable` block: it looks at defaults, environment
variables, `.tfvars` files, and CLI flags, merges them by a fixed precedence (§5), and produces
one final value per variable that the rest of the configuration then uses.

```
┌────────────────────────────────────────────────────────────┐
│                 variables.tf (declarations)                │
│   variable "instance_type" { type = string }                │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     Terraform's value resolution     │
        │  reads: defaults, env vars, .tfvars,  │
        │         -var-file, -var  (in order)   │
        └─────────────────────────┬─────────────┘
                                  │
                                  ▼
                   final resolved value used
                   throughout the configuration
```

### Example

```hcl
# variables.tf
variable "region"        { type = string }
variable "instance_type" { type = string  default = "t3.micro" }
variable "min_size"      { type = number  default = 1 }
variable "tags"          { type = map(string) default = {} }
```

```hcl
# prod.tfvars
region        = "us-east-1"
instance_type = "m5.large"
min_size      = 4
tags = {
  Environment = "prod"
  Team        = "platform"
}
```

```bash
terraform plan -var-file="prod.tfvars"
```

### Common Confusion

Beginners sometimes think `.tfvars` files are *config files Terraform automatically knows about
by convention alone, everywhere*. Only a couple of specific filenames are auto-loaded (§3) —
everything else, including any environment-specific file like `dev.tfvars` or `prod.tfvars`, must
be explicitly passed with `-var-file` or it is silently ignored.

### Interview Answer

"A `.tfvars` file is a plain key-value file that supplies values for declared `variable` blocks,
so you don't have to pass every value as a `-var` CLI flag by hand. It's the standard way to keep
environment-specific values — like instance sizes or region — out of the reusable `.tf` code, so
the same configuration can be applied against dev, staging, or prod just by pointing it at a
different `.tfvars` file."

> **Memory hook:** A filled-out order form handed to the barista, instead of re-shouting your order across the counter every time.

---

## 2. `.tfvars` vs `.tfvars.json`

Terraform's native `.tfvars` syntax (HCL) is what you'll write by hand 95% of the time. But
Terraform also accepts a JSON variant, `.tfvars.json` — and knowing when that matters (usually:
when a *machine*, not a human, is generating the file) is a small but real distinction.

### Analogy

`.tfvars` is like a handwritten shopping list — quick to write, easy for a human to skim and edit.
`.tfvars.json` is like a barcode-scanned receipt — less pleasant for a human to read or hand-edit,
but trivial for another piece of software (a CI script, a config-generation tool) to produce and
parse reliably.

### Comparison Table

| Aspect | `.tfvars` (HCL) | `.tfvars.json` |
|---|---|---|
| Syntax | HCL key = value | Strict JSON object |
| Hand-editing | Easy, human-friendly | Awkward — no comments, strict quoting |
| Comments allowed | Yes (`#` or `//`) | No (JSON has no comment syntax) |
| Generated by tooling | Possible but less common | Common — CI pipelines, config-management tools |
| Auto-load filenames | `terraform.tfvars`, `*.auto.tfvars` | `terraform.tfvars.json`, `*.auto.tfvars.json` |
| Complex types (maps, lists, objects) | Native HCL syntax | Native JSON syntax (arrays/objects) |

### Example — Same Values, Both Formats

```hcl
# prod.tfvars
region        = "us-east-1"
instance_type = "m5.large"
tags = {
  Environment = "prod"
}
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
```

```json
// prod.tfvars.json
{
  "region": "us-east-1",
  "instance_type": "m5.large",
  "tags": {
    "Environment": "prod"
  },
  "availability_zones": ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

Both are loaded identically:

```bash
terraform apply -var-file="prod.tfvars"
# or
terraform apply -var-file="prod.tfvars.json"
```

### Common Confusion

Terraform decides which parser to use purely by file **extension** — `.tfvars` is parsed as HCL,
`.tfvars.json` is parsed as strict JSON. Renaming a JSON file to end in just `.tfvars` (dropping
`.json`) will fail to parse, because Terraform will try to read it as HCL syntax and choke on the
JSON's braces/quoting conventions.

### Interview Answer

"`.tfvars` uses HCL syntax — the same style as the rest of your Terraform code, human-friendly,
supports comments. `.tfvars.json` is strict JSON, with no comment support, and is mainly useful
when a script or external tool is programmatically generating the variable file rather than a
human hand-writing it. Terraform picks the parser based on the file extension, and both are
loaded the same way via `-var-file` or the auto-load filenames."

> **Memory hook:** `.tfvars` is a handwritten shopping list; `.tfvars.json` is a barcode receipt — great for machines, awkward for humans to edit by hand.

---

## 3. Auto-Loaded Files

Passing `-var-file` explicitly every time is fine for environment-specific files, but Terraform
also recognizes a small set of *magic filenames* that get loaded automatically, with zero flags
required. This is exactly the convenience mechanism behind "just drop your defaults in
`terraform.tfvars` and it works."

### Analogy

It's like a restaurant kitchen that automatically checks a specific "today's specials" clipboard
every single service without anyone needing to ask for it — but if a chef writes today's specials
on a *different* piece of paper with a name the kitchen doesn't recognize, nobody looks at it
unless someone explicitly hands it over.

### Under the Hood — Auto-Load Rules

Terraform automatically loads variable values from files matching these patterns in the working
directory, with **no** `-var-file` flag needed:

```
┌───────────────────────────────────────────────────────────────┐
│  Auto-loaded, no flag required:                                │
│    • terraform.tfvars                                          │
│    • terraform.tfvars.json                                     │
│    • *.auto.tfvars       (any name ending in .auto.tfvars)     │
│    • *.auto.tfvars.json  (any name ending in .auto.tfvars.json)│
│                                                                  │
│  Load order for auto-loaded files (later can override earlier):│
│    1. terraform.tfvars / terraform.tfvars.json                 │
│    2. *.auto.tfvars / *.auto.tfvars.json,                       │
│       in LEXICAL (alphabetical) filename order                 │
│                                                                  │
│  NOT auto-loaded — must be passed explicitly with -var-file:    │
│    • dev.tfvars, staging.tfvars, prod.tfvars                    │
│    • any other custom filename                                  │
└───────────────────────────────────────────────────────────────┘
```

### Example

```
project/
├── main.tf
├── variables.tf
├── terraform.tfvars          # auto-loaded — common defaults for everyone
├── network.auto.tfvars       # auto-loaded (alphabetically after "size", before "zzz")
├── size.auto.tfvars          # auto-loaded
└── dev.tfvars                # NOT auto-loaded — must pass -var-file="dev.tfvars"
```

```hcl
# terraform.tfvars — loaded automatically, no flag needed
region = "us-east-1"
tags = {
  ManagedBy = "terraform"
}
```

```hcl
# size.auto.tfvars — also loaded automatically
instance_type = "t3.micro"
min_size      = 1
```

```bash
# This picks up terraform.tfvars AND *.auto.tfvars automatically:
terraform apply

# To ALSO layer in environment-specific overrides, you still add -var-file:
terraform apply -var-file="dev.tfvars"
```

### Common Confusion

A very common mistake: naming an environment file `staging.auto.tfvars` and `prod.auto.tfvars`
and keeping both in the same directory, expecting only the "right" one to load. Both `.auto
.tfvars` files match the auto-load pattern and **both get loaded on every run**, regardless of
which environment you intend to target — whichever value comes later in lexical order silently
wins. Auto-loaded files should only ever hold values that are genuinely the same across every
environment; environment-specific values belong in an explicitly-named file passed via
`-var-file`.

### Interview Answer

"Terraform automatically loads `terraform.tfvars` and any file ending in `.auto.tfvars` (or their
`.json` equivalents) from the working directory, with no flag required. Files matching `*.auto
.tfvars` load in alphabetical order, and later ones can override earlier ones. Anything with a
custom name — like `dev.tfvars` or `prod.tfvars` — is never auto-loaded; you must pass it
explicitly with `-var-file`. This split matters because it's easy to accidentally leave two
environment-named `.auto.tfvars` files in the same directory and have both loaded regardless of
which environment you meant to target."

> **Memory hook:** The kitchen always checks the "today's specials" clipboard automatically — but a differently-named note only gets read if someone hands it over.

---

## 4. Explicit `-var-file` per Environment

Given that environment-specific files aren't auto-loaded, how do teams actually structure things
so that `terraform apply` reliably picks up the *right* environment's values, every time, without
relying on someone remembering a long CLI flag correctly? The pattern is simple: one `.tfvars`
file per environment, named clearly, passed explicitly.

### Analogy

It's the difference between a default breakfast the diner always serves without being asked
(auto-loaded file) versus a special order you have to explicitly state to the waiter — "I'll have
the *keto* menu today" (`-var-file=prod.tfvars`) — because the diner has several special menus and
won't guess which one you want.

### Under the Hood

```
┌──────────────────────────────────────────────────────────────┐
│  project/                                                      │
│  ├── main.tf, variables.tf         ← shared configuration      │
│  ├── terraform.tfvars              ← common defaults (auto)    │
│  ├── dev.tfvars                    ← dev-only overrides         │
│  ├── staging.tfvars                ← staging-only overrides     │
│  └── prod.tfvars                   ← prod-only overrides        │
└──────────────────────────────────────────────────────────────┘

terraform apply -var-file="dev.tfvars"
        │
        ▼
  loads terraform.tfvars (auto) + dev.tfvars (explicit)
  dev.tfvars values OVERRIDE terraform.tfvars for any key present in both
```

You can pass `-var-file` multiple times to layer several files — later ones override earlier ones
for any overlapping key.

### Example

```hcl
# terraform.tfvars — auto-loaded, shared across all environments
managed_by = "terraform"
project    = "checkout-service"
```

```hcl
# dev.tfvars
environment   = "dev"
instance_type = "t3.micro"
min_size      = 1
max_size      = 2
```

```hcl
# prod.tfvars
environment   = "prod"
instance_type = "m5.large"
min_size      = 4
max_size      = 12
```

```bash
# Dev
terraform plan  -var-file="dev.tfvars"
terraform apply -var-file="dev.tfvars"

# Prod
terraform plan  -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"

# Layering multiple files (later overrides earlier for shared keys)
terraform apply -var-file="prod.tfvars" -var-file="prod-region-override.tfvars"
```

In a directory-per-environment layout (Phase 07-02), this often collapses even further — each
environment directory has its *own* `terraform.tfvars`, which is now auto-loaded because it's the
only environment that directory knows about at all:

```
environments/
├── dev/
│   └── terraform.tfvars     # auto-loaded — this directory IS "dev", nothing to disambiguate
├── staging/
│   └── terraform.tfvars     # auto-loaded, but a DIFFERENT file (different directory)
└── prod/
    └── terraform.tfvars     # auto-loaded, again a different file entirely
```

```bash
cd environments/prod
terraform apply    # no -var-file flag needed — terraform.tfvars here IS prod's values
```

### Common Mistakes

- Forgetting `-var-file` and getting variable defaults (or a `terraform` prompt asking you to
  type a value interactively) instead of the intended environment's values.
- Passing `-var-file="prod.tfvars"` while sitting in the wrong workspace or wrong directory —
  the file loads fine, but it's being applied against the wrong state.
- Assuming CI remembers which `-var-file` to use "because it usually does" — always pin it
  explicitly per pipeline stage rather than relying on a shared default.

### Interview Answer

"Because environment-named files like `dev.tfvars` aren't auto-loaded, you pass them explicitly
with `-var-file` on every `plan`/`apply` — this makes the target environment an explicit,
visible part of the command rather than something implicit that could be forgotten. In a
directory-per-environment layout, each environment gets its own directory with its own
`terraform.tfvars`, which then *is* auto-loaded, because that directory only ever represents one
environment. Either way, the goal is the same: never guess which environment's values are in
effect."

> **Memory hook:** The diner serves the regular breakfast automatically, but you have to explicitly ask for the special "prod" menu.

---

## 5. Variable Precedence Order

You now have several ways to supply a value for the same variable — a `default` in the
declaration, an environment variable, `terraform.tfvars`, `*.auto.tfvars`, an explicit
`-var-file`, and a raw `-var` flag. What happens when more than one of these supplies a value for
the *same* variable at the *same* time? Terraform has one fixed, well-documented precedence
order, and knowing it cold is essential for debugging "why is this variable not the value I
expected?"

### Analogy

Think of it like a company's dress code policy stack: there's a baseline company policy
(`default`), a general reminder emailed to everyone (`environment variables`), a department memo
(`terraform.tfvars`), a team-specific update posted after the department memo
(`*.auto.tfvars`), an explicit note from your manager for today
(`-var-file`), and finally a direct verbal instruction from the CEO right as you walk out the door
(`-var` on the CLI). Each rule beats the one before it — the CEO's in-person instruction wins over
every written memo, no matter how official.

### The Precedence Order (Lowest to Highest)

| Order | Source | Example |
|---|---|---|
| 1 (lowest) | `default` in the `variable` block | `variable "x" { default = "fallback" }` |
| 2 | Environment variables (`TF_VAR_<name>`) | `export TF_VAR_instance_type=t3.micro` |
| 3 | `terraform.tfvars` (auto-loaded) | `instance_type = "t3.small"` |
| 4 | `*.auto.tfvars`, in alphabetical filename order (auto-loaded) | `size.auto.tfvars` |
| 5 | `-var-file` flags, in the order given on the command line | `-var-file="prod.tfvars"` |
| 6 (highest) | `-var` flags on the CLI, in the order given | `-var="instance_type=m5.large"` |

```
                       LOWEST PRECEDENCE
┌─────────────────────────────────────────────────────────────┐
│ 1. variable "x" { default = ... }                            │
├─────────────────────────────────────────────────────────────┤
│ 2. TF_VAR_x environment variable                              │
├─────────────────────────────────────────────────────────────┤
│ 3. terraform.tfvars                                           │
├─────────────────────────────────────────────────────────────┤
│ 4. *.auto.tfvars  (alphabetical order among themselves)       │
├─────────────────────────────────────────────────────────────┤
│ 5. -var-file="..."  (order given on the command line)         │
├─────────────────────────────────────────────────────────────┤
│ 6. -var="x=..."  (highest — always wins)                      │
└─────────────────────────────────────────────────────────────┘
                       HIGHEST PRECEDENCE
```

### Example

```hcl
# variables.tf
variable "instance_type" {
  type    = string
  default = "t3.nano"     # (1) lowest precedence
}
```

```bash
export TF_VAR_instance_type="t3.micro"        # (2)
```

```hcl
# terraform.tfvars
instance_type = "t3.small"                     # (3)
```

```hcl
# prod.tfvars
instance_type = "m5.large"                     # (5), via -var-file
```

```bash
terraform apply -var-file="prod.tfvars" -var="instance_type=m5.xlarge"
# Final value used: "m5.xlarge"  — the -var flag (6) beats everything else
```

Remove the trailing `-var` flag, and the result becomes `"m5.large"` from `prod.tfvars` (5),
beating the environment variable (2), the default (1), and `terraform.tfvars` (3).

### Common Confusion

People often assume "the file listed last wins" universally, forgetting that `-var` flags always
win regardless of file order — and forgetting that `*.auto.tfvars` files beat `terraform.tfvars`
even though `terraform.tfvars` is often (wrongly) assumed to be "the main/most authoritative"
file. Also: variables of collection type (maps, objects) are **not deep-merged** across sources —
a later source's value for the same variable name fully replaces the earlier one, it doesn't get
merged key-by-key.

### Interview Answer

"From lowest to highest precedence: variable block defaults, `TF_VAR_*` environment variables,
`terraform.tfvars`, then `*.auto.tfvars` files in alphabetical order, then `-var-file` flags in
the order given on the command line, and finally `-var` flags on the CLI, which always win. It's
a strict override, not a merge — even for maps or objects, a higher-precedence source completely
replaces a lower one's value for that variable, it doesn't combine them key by key."

> **Memory hook:** Company policy → department memo → the CEO's spoken instruction on your way out the door — the most immediate, most specific source always wins.

---

## 6. Keeping Secrets Out of tfvars

Here's a scenario that ends badly more often than it should: an engineer needs to pass a database
password into Terraform, so they add `db_password = "SuperSecret123!"` to `prod.tfvars`, commit
it to the repo "just this once," and move on. Six months later that repository (and its full git
history) gets shared with a contractor, or made public by mistake, and that password is
permanently exposed — because git history doesn't forget, even if the file is deleted later.
`.tfvars` files are just plain text (or JSON) on disk; they are **not** an encrypted secret store,
and they should never hold real credentials.

### Analogy

Putting a real password in a `.tfvars` file that gets committed to git is like writing your
house alarm code on a sticky note and photographing it for a public real-estate listing. Even
if you take the sticky note down later, the photo is already out there, indexed, and possibly
cached — deleting the current version doesn't erase where it's already been.

### Under the Hood — Why tfvars Is the Wrong Place for Secrets

```
┌────────────────────────────────────────────────────────────────┐
│ .tfvars file committed to git                                  │
│   → lives in every clone, every fork, every CI checkout          │
│   → remains in git history even after later deletion             │
│   → often mirrored to backup systems, IDE caches, CI logs        │
│                                                                    │
│ Even .gitignore'd locally:                                       │
│   → still plaintext on disk, readable by anything with           │
│     filesystem access, easy to accidentally `git add -A`          │
└────────────────────────────────────────────────────────────────┘
```

The safer pattern (covered in full in Phase 10 — Security & Secrets) is to keep secret material
*out* of `.tfvars` entirely and pull it in from a dedicated secrets manager at apply time:

```hcl
# variables.tf — declare as sensitive so it's redacted from plan/apply output
variable "db_password" {
  type      = string
  sensitive = true
}
```

```hcl
# Instead of hardcoding it in prod.tfvars, fetch it from AWS Secrets Manager:
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/checkout-service/db-password"
}

resource "aws_db_instance" "main" {
  # ...
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

### Example — What Belongs Where

```hcl
# prod.tfvars — SAFE to commit: non-secret, environment-specific config
region        = "us-east-1"
instance_type = "m5.large"
min_size      = 4
tags = {
  Environment = "prod"
}
# db_password  ← intentionally absent — never put this here
```

```bash
# .gitignore — belt-and-suspenders even though secrets shouldn't be here at all
*.tfvars
!terraform.tfvars       # if terraform.tfvars only ever holds non-secret defaults
secrets.auto.tfvars     # if such a file ever existed, ignore it explicitly too
```

```bash
# CI supplies genuinely sensitive values as environment variables instead,
# sourced from a secrets manager/vault integration, never a checked-in file:
export TF_VAR_db_password="$(aws secretsmanager get-secret-value \
  --secret-id prod/checkout-service/db-password \
  --query SecretString --output text)"

terraform apply -var-file="prod.tfvars"
```

### Common Confusion

Marking a variable `sensitive = true` stops Terraform from printing its value in `plan`/`apply`
console output — it does **not** encrypt the value, and it does **not** stop that value from
being stored in plaintext inside the state file. If a secret ever flows through a Terraform
variable at all — even a `sensitive` one — the state file itself must also be treated as
sensitive (encrypted at rest, tightly access-controlled). This full topic — state encryption,
secrets managers, dynamic provider credentials — is covered in depth in Phase 10.

### Interview Answer

"`.tfvars` files are plain text, so real secrets should never be hardcoded into them, especially
if the file is committed to version control — git history retains old values even after later
edits. The safer pattern is to keep genuinely secret values out of `.tfvars` and instead fetch
them at apply time from a secrets manager, either via a `data` source or by injecting them as
`TF_VAR_*` environment variables in CI from a vault integration. Marking a variable `sensitive =
true` only redacts it from CLI output — it still lands in the state file in plaintext, so the
state itself needs the same protection a secret would. This is covered in full in the Security &
Secrets phase."

> **Memory hook:** Writing your alarm code on a sticky note and photographing it for a listing — deleting the note later doesn't un-publish the photo.

---

## 7. Hands-On Exercises

**Exercise 1 — Basic tfvars**
Declare three variables (`region`, `instance_type`, `tags`) with sensible defaults. Create a
`dev.tfvars` and a `prod.tfvars` with different values for each, and run `terraform plan
-var-file=` against each, confirming the plan output shows the expected values.

**Exercise 2 — Auto-Load Collision**
Create both `dev.auto.tfvars` and `prod.auto.tfvars` in the same directory with conflicting
values for `instance_type`. Run `terraform plan` with no flags at all and explain, from the
alphabetical load order rule, which value wins and why this is a design smell.

**Exercise 3 — Precedence Chain**
Set up all six precedence layers for a single variable `min_size`: a `default` of `1`, a
`TF_VAR_min_size` environment variable of `2`, a `terraform.tfvars` value of `3`, an
`extra.auto.tfvars` value of `4`, a `staging.tfvars` value of `5` passed via `-var-file`, and a
CLI `-var="min_size=6"`. Predict the final resolved value before running `terraform console` or
`plan` to confirm, then remove layers one at a time from the top and re-predict.

**Exercise 4 — JSON Variant**
Convert a `prod.tfvars` file with a map and a list variable into an equivalent `prod.tfvars.json`
file. Confirm both produce identical plans.

**Exercise 5 — Secrets Audit**
Given a sample `prod.tfvars` file containing `db_password`, `api_key`, and non-secret values like
`region` and `instance_type`, rewrite the configuration so the two secret values are instead
fetched from AWS Secrets Manager via a `data "aws_secretsmanager_secret_version"` source, and mark
the corresponding variables `sensitive = true`. Explain what `sensitive = true` does and does not
protect against.

---

## 8. Interview Q&A

---

**Q1: What is a `.tfvars` file and why use one?**

A: A `.tfvars` file supplies values for declared `variable` blocks using simple `key = value`
syntax, so you don't need to pass every value as a `-var` CLI flag. It keeps environment-specific
values out of the reusable `.tf` code and makes it reliable and repeatable to apply the same
configuration with different inputs per environment.

---

**Q2: What's the difference between `.tfvars` and `.tfvars.json`?**

A: `.tfvars` uses HCL syntax and supports comments — the standard, human-editable format.
`.tfvars.json` is strict JSON with no comments, typically used when a script or external tool
generates the file programmatically rather than a human writing it by hand. Terraform picks the
parser based on the file extension.

---

**Q3: Which filenames does Terraform load automatically, without any CLI flag?**

A: `terraform.tfvars` and `terraform.tfvars.json`, plus any file matching `*.auto.tfvars` or
`*.auto.tfvars.json`. The `.auto.tfvars` files load in alphabetical order relative to each other.
Any other filename, like `dev.tfvars` or `prod.tfvars`, must be passed explicitly with
`-var-file`.

---

**Q4: What is Terraform's variable precedence order?**

A: From lowest to highest: `variable` block defaults, `TF_VAR_*` environment variables,
`terraform.tfvars`, `*.auto.tfvars` files (alphabetical order), `-var-file` flags (in the order
given), and finally `-var` CLI flags, which always win. It's a full override per variable, not a
merge — even for maps and objects.

---

**Q5: Should you ever put a real secret in a `.tfvars` file?**

A: No. `.tfvars` files are plain text, and if committed to version control the secret persists in
git history even after later deletion. Secrets should be fetched at apply time from a dedicated
secrets manager (e.g. AWS Secrets Manager, Vault) via a data source, or injected as `TF_VAR_*`
environment variables in CI sourced from a vault integration — never hardcoded into a checked-in
`.tfvars` file.

---

**Q6: Does marking a variable `sensitive = true` make it safe to store secrets in tfvars?**

A: No. `sensitive = true` only redacts the value from Terraform's CLI output during `plan` and
`apply` — it does not encrypt the value and does not prevent it from being written in plaintext
into the state file. If a secret flows through any Terraform variable, the state file itself must
also be encrypted at rest and access-controlled, regardless of the `sensitive` flag.

---

**Q7: In a directory-per-environment layout, why might each environment's `terraform.tfvars` be
auto-loaded safely, when a shared `dev.tfvars`/`prod.tfvars` pair would not be?**

A: Because each environment has its own directory, `terraform.tfvars` inside `environments/dev/`
only ever represents dev's values — there's no ambiguity to resolve, since that directory
represents exactly one environment. A shared directory containing both `dev.tfvars` and
`prod.tfvars` needs explicit `-var-file` selection because Terraform has no way to know, from
convention alone, which one you mean to apply.
