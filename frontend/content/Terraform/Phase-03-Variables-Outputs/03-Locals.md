# 03 — Locals

## Table of Contents

1. [Why Locals](#1-why-locals)
2. [locals Block Syntax](#2-locals-block-syntax)
3. [Locals vs Variables vs Data Sources](#3-locals-vs-variables-vs-data-sources)
4. [Computed Locals with Functions/Conditionals](#4-computed-locals-with-functionsconditionals)
5. [Organizing Locals in Larger Configs](#5-organizing-locals-in-larger-configs)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Locals

Picture a configuration with fifteen resources, and every single one of them needs the same
`Name = "acme-${var.environment}-${var.region}"` prefix baked into its tags, plus the same set of
five common tags (`ManagedBy`, `CostCenter`, `Team`, `Project`, `Environment`). Do you retype that
exact string-interpolation expression fifteen times? What happens when the naming convention
changes six months from now — do you find-and-replace across fifteen resource blocks and hope you
didn't miss one hiding in a `module` call?

**Locals** solve exactly this: they let you compute a value or expression *once*, give it a name,
and reference that name everywhere instead of repeating the underlying expression. Change the
computation in one place (the `locals` block), and every resource that referenced it picks up the
new value automatically on the next plan.

### Analogy

A `locals` block is like a spreadsheet formula cell. Instead of typing `=B2*1.08` (price plus tax)
into fifty different cells and hoping the tax rate never changes, you compute it once in cell
`C1`, and every other cell just references `=C1`. Update the formula in `C1` once, and all fifty
downstream cells update instantly and consistently — no risk of one cell being left with the old
formula.

### Under the Hood

```
┌────────────────────────────────────────────────────────────────┐
│  locals {                                                        │
│    name_prefix = "${var.project}-${var.environment}"            │
│    common_tags = {                                                │
│      ManagedBy   = "terraform"                                   │
│      Environment = var.environment                                │
│      Project      = var.project                                  │
│    }                                                              │
│  }                                                                │
└──────────────────────────┬─────────────────────────────────────┘
                            │  evaluated ONCE per plan/apply,
                            │  result cached as local.name_prefix,
                            │  local.common_tags
                            ▼
   ┌────────────────────────────────────────────────────────────┐
   │  resource "aws_instance" "web" {                            │
   │    tags = merge(local.common_tags, { Name = "${local.       │
   │              name_prefix}-web" })                            │
   │  }                                                            │
   │                                                               │
   │  resource "aws_s3_bucket" "assets" {                         │
   │    tags = merge(local.common_tags, { Name = "${local.       │
   │              name_prefix}-assets" })                          │
   │  }                                                            │
   │       ... 13 more resources, all referencing local.*          │
   └────────────────────────────────────────────────────────────┘
```

Terraform evaluates each `local` expression as part of building the resource graph, and every
`local.xxx` reference resolves to that single computed value — it's not re-evaluated per usage
site, it's computed once and fanned out.

### Concrete Example

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c101f26f147fa7fd"
  instance_type = "t3.micro"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web"
  })
}

resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-assets"
  })
}
```

Change the naming scheme in `locals.name_prefix` once, and both `aws_instance.web` and
`aws_s3_bucket.assets` (and every other resource referencing it) update consistently on the next
`terraform plan`.

### Common Mistakes

- **Copy-pasting the same interpolation expression across many resources "because it's just one
  line."** That one line, repeated fifteen times, is fifteen places a future change has to be
  made correctly and consistently.
- **Confusing locals with variables.** Locals cannot be set by the caller from outside the
  configuration (no `-var`, no `.tfvars`) — they're always computed *internally* from
  expressions, often built out of variables. (Full comparison in section 3.)
- **Overusing locals for values used exactly once.** If an expression appears in exactly one
  place and isn't likely to be reused, wrapping it in a `local` just adds an extra layer of
  indirection with no DRY benefit — inline it directly instead.

### Interview Answer

"Locals let you compute an expression once inside a configuration and reference it by name
wherever it's needed, instead of repeating the same computation across many resource blocks. This
keeps configurations DRY — a naming convention or tag set that's used in fifteen resources only
needs to change in one place, the `locals` block, rather than fifteen separate resource blocks."

> **Memory hook:** A local is a spreadsheet formula cell — compute it once, reference it everywhere, and updating the one formula updates every dependent cell.

---

## 2. locals Block Syntax

Now the mechanics: how do you actually declare a local, and what can go inside the block?

### Analogy

A `locals` block is like a "scratch pad" section at the top of a math worksheet where you work
out intermediate results before using them in the main problems below — you're allowed to define
as many scratch values as you like, and later ones can even build on earlier ones.

### Syntax Anatomy

```hcl
locals {
  # A single locals block can declare many named values
  name_prefix = "${var.project}-${var.environment}"
  is_production = var.environment == "prod"

  # Later locals in the same or a different `locals` block can
  # reference earlier ones
  full_name = "${local.name_prefix}-app"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    IsProd      = local.is_production
  }
}
```

Key syntax facts:

- There is no block label — it's just `locals { ... }`, unlike `variable "name" { ... }` or
  `output "name" { ... }`.
- Each key inside the block (`name_prefix`, `full_name`, etc.) becomes accessible as
  `local.name_prefix`, `local.full_name`.
- You can have **multiple `locals` blocks** in the same configuration (even the same file) — they
  are merged together as if written in one block. This is often used to group related locals
  under a comment header.
- Locals can reference other locals, variables, data sources, and resource attributes — anything
  valid in an expression.

### Under the Hood

```
Evaluation order is NOT top-to-bottom in the file —
it's dependency order, resolved automatically:

locals {
  b = local.a * 2      # references 'a' — Terraform evaluates 'a' first
  a = 10
  c = local.b + 1      # references 'b' — evaluated after 'b'
}

Actual evaluation order: a → b → c
(regardless of the order they're written in the file)
```

Terraform builds a dependency graph for locals just like it does for resources — you don't need
to declare them in "the right order" in the file, because Terraform resolves the true dependency
order itself. A local can even reference a local declared later in the same block, as long as
there's no circular dependency (which *would* be an error).

### Common Mistakes

- **Trying to give a `locals` block a label**, like `locals "shared" { ... }` — this is invalid
  syntax. `locals` blocks never take a label; only the individual keys inside are named.
- **Assuming locals must be declared in dependency order in the file.** They don't — Terraform
  resolves the actual evaluation order from the dependency graph, not file position.
  Readability still favors ordering logically, but it's not a functional requirement.
- **Creating a circular reference** (`local.a` depends on `local.b` which depends on `local.a`) —
  Terraform will detect and reject this with a dependency cycle error, exactly as it would for
  resources.

### Interview Answer

"A `locals` block has no label and can declare any number of named expressions, each becoming
accessible as `local.<name>`. Multiple `locals` blocks in a configuration are merged together.
Locals can reference variables, other locals, data sources, or resource attributes, and Terraform
resolves their evaluation order from the dependency graph — not from the order they appear in the
file."

> **Memory hook:** A `locals` block is the scratch-pad section of a math worksheet — work out as many intermediate values as you like, in whatever order they logically depend on each other, then use the results below.

---

## 3. Locals vs Variables vs Data Sources

You now have three different ways to get a "value" into your configuration — a `variable`, a
`local`, or a `data` source. They can look deceptively similar at a call site
(`var.x`, `local.x`, `data.aws_ami.x.id`), but they answer three fundamentally different
questions, and picking the wrong one is one of the most common structural mistakes in Terraform
configs.

### Analogy

Think of planning a dinner party. A **variable** is an ingredient someone else brings — you ask
for it, but you don't control exactly what shows up (the guest decides how much wine to bring,
within the "bring wine" instruction you gave). A **local** is a dish you prepare yourself from
ingredients already in the kitchen — you control the recipe, but it's built from what's already
available (variables, other locals). A **data source** is calling the caterer to ask "what's
today's fresh catch?" — you don't control the answer at all; it reflects the real-world state of
something that already exists outside your control (an existing AMI ID, an existing VPC someone
else created).

### Comparison Table

| | Variable (`var.x`) | Local (`local.x`) | Data Source (`data.x.y`) |
|---|---|---|---|
| **Where the value comes from** | Supplied externally (CLI, tfvars, env var, or its own default) | Computed internally from an expression | Read from a real, already-existing external resource (via a provider API call) |
| **Who controls it** | The caller of the configuration | The configuration author | Whatever already exists in the real infrastructure |
| **Can it change per environment without editing .tf files?** | Yes — that's its entire purpose | No — its expression is fixed in code; only its *inputs* (variables) can vary | Indirectly — different real-world state produces a different lookup result |
| **Evaluated at...** | Input-resolution phase, before graph build | Graph build, in dependency order | Plan time — Terraform makes a real read-only API call |
| **Typical use** | Environment-specific config (`environment`, `instance_type`) | DRY-ing up repeated expressions (naming, merged tag maps) | Looking up something Terraform doesn't manage (latest AMI, existing VPC, existing IAM role) |
| **Example** | `variable "environment" {}` | `locals { name_prefix = "${var.project}-${var.environment}" }` | `data "aws_ami" "latest" { most_recent = true ... }` |

### When to Use Which

```
Need a value that changes per environment/caller?
        │
        ├── YES → use a `variable`
        │
        └── NO → is it computed FROM other values you already have
                  (variables, other locals, resource attributes)?
                        │
                        ├── YES → use a `local`
                        │
                        └── NO → does it need to be READ from something
                                  that already exists outside this config
                                  (an existing AMI, VPC, account ID)?
                                        │
                                        └── YES → use a `data` source
```

### Concrete Example — All Three Together

```hcl
variable "environment" {
  type = string
}

variable "project" {
  type    = string
  default = "acme"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id      # DATA SOURCE — looked up externally
  instance_type = "t3.micro"

  tags = merge(local.common_tags, {                  # LOCAL — computed internally
    Name = "${local.name_prefix}-web"                 # built from a VARIABLE-derived local
  })
}
```

### Common Mistakes

- **Using a `local` when you actually need a `variable`.** If a value genuinely needs to differ
  per caller/environment without editing the `.tf` file, a hardcoded local defeats that — it's
  not externally settable.
- **Using a `variable` when you actually need a `local`.** If a value is always computed
  deterministically from other values already in the config (e.g., a naming convention built from
  `var.project` and `var.environment`), making it a separate required variable just duplicates
  data the config could derive itself — increasing the chance of the two getting out of sync.
- **Using a hardcoded value when you actually need a `data` source.** Hardcoding
  `ami = "ami-0c101f26f147fa7fd"` bakes in a specific AMI that goes stale (deprecated, no longer
  available in that region) — a `data "aws_ami"` lookup with filters always resolves to a current,
  valid AMI at plan time.

### Interview Answer

"Variables are externally-supplied inputs controlled by the caller; locals are internally-computed
expressions controlled by the configuration author, usually built from variables or other locals
to avoid repetition; and data sources are read-only lookups against real infrastructure that
already exists outside the configuration's management, like finding the latest AMI ID or an
existing VPC. The decision rule is: does this value need to vary per caller (variable), is it
derived from values you already have (local), or does it need to reflect the current state of
something in the real world you don't manage here (data source)?"

> **Memory hook:** Variable is the ingredient a guest brings; local is the dish you cook yourself from what's already in the kitchen; data source is calling the caterer to ask what's fresh today.

---

## 4. Computed Locals with Functions/Conditionals

Locals get genuinely powerful once you realize their expressions can use Terraform's built-in
functions and conditional (ternary) logic — not just simple string interpolation. This is where
locals become "derived configuration," computing entire structures based on other inputs.

### Analogy

If a simple local is a single spreadsheet formula cell, a computed local with functions and
conditionals is a spreadsheet cell using `IF()`, `VLOOKUP()`, and `CONCATENATE()` together — still
just one cell, but it's making a genuine decision based on other cells' values, not just gluing
text together.

### Conditional (Ternary) Locals

```hcl
locals {
  # condition ? true_value : false_value
  instance_type = var.environment == "prod" ? "m5.large" : "t3.micro"

  instance_count = var.environment == "prod" ? 3 : 1

  is_production = var.environment == "prod"
}
```

### Locals Using Built-in Functions

```hcl
locals {
  # merge() — combine multiple maps into one
  common_tags = merge(
    var.extra_tags,
    {
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  # for expression — transform a list into a map
  subnet_by_az = {
    for idx, az in var.availability_zones :
    az => var.subnet_cidrs[idx]
  }

  # lookup() — safe map access with a default
  instance_type = lookup(var.instance_type_overrides, var.environment, "t3.micro")

  # concat() and flatten() — combine and flatten lists
  all_cidr_blocks = flatten([
    var.vpc_cidr_blocks,
    var.peered_vpc_cidr_blocks,
  ])

  # coalesce() — first non-null value
  effective_domain = coalesce(var.custom_domain, "app-${var.environment}.example.com")
}
```

### Concrete Example — A Realistic Environment-Aware Local

```hcl
variable "environment" {
  type = string
}

locals {
  environment_config = {
    dev = {
      instance_type  = "t3.micro"
      instance_count = 1
      multi_az       = false
    }
    staging = {
      instance_type  = "t3.small"
      instance_count = 2
      multi_az       = false
    }
    prod = {
      instance_type  = "m5.large"
      instance_count = 3
      multi_az       = true
    }
  }

  # Pick the config block matching this run's environment
  config = local.environment_config[var.environment]
}

resource "aws_instance" "web" {
  count         = local.config.instance_count
  instance_type = local.config.instance_type
  ami           = "ami-0c101f26f147fa7fd"
}
```

This pattern — a map of environment name to config object, then indexing into it with
`local.environment_config[var.environment]` — is one of the most common and powerful uses of
computed locals: it centralizes every environment's sizing decisions in one readable table
instead of scattering `? :` ternaries across every resource.

### Common Mistakes

- **Writing deeply nested ternaries instead of a lookup map.** `var.environment == "prod" ? "x" :
  var.environment == "staging" ? "y" : "z"` is hard to read and easy to get wrong past two
  branches — the environment-config-map pattern above scales far better and is far more
  reviewable.
- **Forgetting `lookup()`'s third argument (default) when a key might be missing.** Plain map
  index syntax `var.map[key]` errors if the key doesn't exist; `lookup(var.map, key, "default")`
  degrades gracefully instead.
- **Using functions inside locals that have side effects or aren't idempotent.** Terraform's
  built-in functions are all pure (same input always produces same output) — there's no
  equivalent of "call an API and cache the result" inside a plain `locals` block; that's what
  `data` sources are for.

### Interview Answer

"Locals aren't limited to simple string concatenation — their expressions can use any of
Terraform's built-in functions (`merge`, `lookup`, `coalesce`, `for` expressions) and conditional
ternaries. A common pattern is building a map of per-environment configuration objects and
indexing into it with the current environment variable, which centralizes sizing/scaling
decisions in one readable place instead of scattering conditional logic across every resource
block."

> **Memory hook:** A computed local is a spreadsheet cell running `IF()` and `VLOOKUP()` together — one cell, but making a real decision, not just gluing text.

---

## 5. Organizing Locals in Larger Configs

A five-resource proof-of-concept can get away with one `locals` block at the top of `main.tf`. A
fifty-resource production configuration with a dozen contributors cannot — without some
organization, `locals` sprawl becomes exactly the kind of tangled mess variables and locals were
supposed to prevent.

### Analogy

A small `locals` block is a single sticky note on your desk. A large configuration's locals are
more like a shared team wiki — if everyone just writes to one giant undifferentiated page, it
becomes unusable; the fix isn't "stop writing things down," it's organizing by topic with clear
sections so anyone can find what they need.

### Common Organization Patterns

**1. A dedicated `locals.tf` file** — separate from `main.tf`, `variables.tf`, `outputs.tf`:

```
project/
├── main.tf
├── variables.tf
├── outputs.tf
├── locals.tf        ← all locals live here
└── providers.tf
```

**2. Grouped by concern with comment headers, inside one file:**

```hcl
# locals.tf

locals {
  # ---- Naming ----
  name_prefix = "${var.project}-${var.environment}"
  full_name   = "${local.name_prefix}-app"
}

locals {
  # ---- Tagging ----
  common_tags = merge(var.extra_tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

locals {
  # ---- Environment-specific sizing ----
  environment_config = {
    dev     = { instance_type = "t3.micro", instance_count = 1 }
    staging = { instance_type = "t3.small", instance_count = 2 }
    prod    = { instance_type = "m5.large", instance_count = 3 }
  }
  config = local.environment_config[var.environment]
}
```

(Multiple `locals` blocks like this are functionally identical to one big block — this is purely
an organizational/readability choice.)

**3. Locals scoped near where they're used**, for locals that only serve one resource, rather than
forcing every local into one central file:

```hcl
# networking.tf
locals {
  # Only used by resources in this file — keep it local to this file
  private_subnet_cidrs = [for i in range(3) : cidrsubnet(var.vpc_cidr, 8, i)]
}

resource "aws_subnet" "private" {
  count             = 3
  cidr_block        = local.private_subnet_cidrs[count.index]
  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
}
```

### Comparison — Organization Strategies

| Strategy | Best for | Trade-off |
|----------|----------|-----------|
| Single `locals.tf`, one block, grouped by comments | Small-to-medium configs, single team | Can still grow unwieldy past ~50 locals |
| Single `locals.tf`, multiple blocks by concern | Medium-to-large configs | Requires discipline to keep comment headers accurate |
| Locals colocated with the file that uses them | Large configs split across many `.tf` files (networking.tf, compute.tf, etc.) | Harder to get a single "big picture" view of every local in the config |
| Locals pushed into a shared module's outputs instead | Very large orgs, multiple consuming configs | Adds module indirection (Phase 6) — overkill for a single config |

### Common Mistakes

- **One 300-line `locals` block with no comments or grouping.** Exactly the sprawl problem this
  section warns about — impossible to scan or review changes to confidently.
- **Duplicating the same computed value as both a file-scoped local and a central local**, because
  someone didn't realize it already existed elsewhere in the config — a symptom of insufficient
  organization/discoverability, not a locals feature problem.
- **Treating "which strategy" as a permanent, one-time decision.** It's fine — expected, even —
  for a growing config to migrate from "one block at the top of main.tf" to "dedicated
  locals.tf with grouped sections" as it grows past a handful of resources.

### Interview Answer

"For small configurations, a single `locals` block is fine. As configurations grow, common
practice is a dedicated `locals.tf` file with multiple `locals` blocks grouped by concern
(naming, tagging, environment sizing) using comment headers — since multiple `locals` blocks
merge together functionally identically to one big block, this is purely for readability. Locals
used by only one file's resources can also be colocated there instead of centralized, trading a
single big-picture view for better locality of reference."

> **Memory hook:** A few locals is a sticky note on your desk; fifty locals without organization is an unreadable wall of undifferentiated notes — organize like a team wiki, by topic, with clear headers.

---

## 6. Common Mistakes

A consolidated checklist of locals-specific pitfalls worth reviewing as a standalone list.

| Mistake | Why it's a problem | Fix |
|---------|---------------------|-----|
| Using a local where a variable belongs | Value can't vary per caller/environment | Promote it to a `variable` |
| Using a variable where a local belongs | Duplicated, potentially inconsistent data the config could derive itself | Compute it as a `local` from existing variables |
| Deeply nested ternary chains | Hard to read, error-prone past two branches | Use a lookup map (`local.environment_config[var.environment]`) |
| One giant unorganized `locals` block | Impossible to scan/review in large configs | Split into grouped blocks or a dedicated `locals.tf`, with comments |
| Circular local references | Terraform errors with a dependency cycle | Restructure so no local depends on itself, even indirectly |
| Assuming file-position order matters | Misunderstanding of how Terraform resolves locals | Trust the dependency graph; order in the file is for humans only |
| Using locals for one-off, single-use expressions | Adds indirection with no DRY benefit | Inline the expression directly if it's used exactly once and unlikely to be reused |

> **Memory hook:** Every locals mistake here traces back to one root cause — treating locals like a place to dump *any* value, instead of reserving them specifically for expressions derived once and reused, cleanly organized as the config grows.

---

## 7. Hands-On Exercises

**Exercise 1 — DRY-ing Up Tags**

Given five resources (`aws_instance`, `aws_s3_bucket`, `aws_db_instance`, `aws_lb`,
`aws_security_group`) that all currently repeat this tag block inline:
```hcl
tags = {
  Project     = "acme"
  Environment = "prod"
  ManagedBy   = "terraform"
}
```
Refactor this into a single `locals.common_tags`, and show how each resource references it (using
`merge()` where a resource also needs a unique `Name` tag).

**Exercise 2 — Variable, Local, or Data Source?**

For each of the following, decide whether it should be a `variable`, a `local`, or a `data`
source, and justify your choice in one sentence:
- The AWS account ID the current provider is authenticated against.
- The instance type to launch, which differs between dev and prod.
- A naming prefix built by concatenating the project name and environment.
- The most recent Amazon Linux 2023 AMI ID available in the current region.

**Exercise 3 — Environment Config Map**

Write a `locals` block containing an `environment_config` map with three environments (`dev`,
`staging`, `prod`), each specifying `instance_type`, `instance_count`, and `multi_az` (bool). Then
write a `local.config` that indexes into it using `var.environment`, and show an
`aws_instance` resource using `local.config.instance_type` and `count = local.config.
instance_count`.

**Exercise 4 — Organizing a Growing Config**

You've inherited a 200-line `main.tf` with a single 60-line `locals` block covering naming,
tagging, networking CIDR calculations, and IAM policy JSON construction, all mixed together with
no comments. Describe, in a short paragraph, how you would reorganize this — what files you'd
create and how you'd group the locals.

**Exercise 5 — Debugging a Circular Reference**

Given:
```hcl
locals {
  a = local.b + 1
  b = local.c + 1
  c = local.a + 1
}
```
What error would Terraform report, and how would you restructure this so it's valid (assuming the
actual intent was for `a`, `b`, and `c` to each add 1 to some genuinely independent base value)?

---

## 8. Interview Q&A

---

**Q1: What problem do locals solve that variables and resource attributes alone don't?**

A: Locals let you compute an expression once — often built from variables, other locals, or
resource attributes — and reference it by name everywhere it's needed, instead of repeating the
same computation across many resource blocks. This keeps configurations DRY: a naming convention
or tag set used across fifteen resources only needs to change in one place.

---

**Q2: Can a local's value be overridden externally, like a variable can with `-var`?**

A: No. Locals are always computed internally from expressions within the configuration itself —
there's no CLI flag, `.tfvars` entry, or environment variable that sets a local directly. If a
value genuinely needs to vary per caller, it belongs in a `variable`, which the local can then
incorporate into its own computation.

---

**Q3: What's the core difference between a variable, a local, and a data source?**

A: A variable is an externally-supplied input controlled by the caller. A local is an internally-
computed expression controlled by the configuration author, typically derived from variables or
other locals. A data source is a read-only lookup against something that already exists in real
infrastructure outside this configuration's management — it reflects external, real-world state
rather than being defined or supplied by either the caller or the author.

---

**Q4: Does the order locals are written in a `locals` block matter?**

A: No — Terraform resolves the actual evaluation order from the dependency graph between locals,
not from their position in the file. A local can reference another local declared later in the
same block, as long as there's no circular dependency, which Terraform would reject with an
error.

---

**Q5: Can you have more than one `locals` block in a configuration?**

A: Yes. Multiple `locals` blocks — even across different files — are merged together and behave
identically to one large block. This is commonly used purely for organization, grouping related
locals (naming, tagging, sizing) under separate blocks with comment headers as a configuration
grows.

---

**Q6: What's a common, powerful pattern for computed locals in environment-aware
configurations?**

A: Defining a map of environment name to a configuration object (e.g., `{ dev = {...}, prod =
{...} }`) as one local, then indexing into it with the current environment variable
(`local.environment_config[var.environment]`) as a second local. This centralizes all
per-environment sizing/scaling decisions in one readable table, instead of scattering conditional
ternary expressions across many separate resource blocks.

---

**Q7: When should you avoid creating a local?**

A: When an expression is used in exactly one place and unlikely to be reused elsewhere — wrapping
a single-use expression in a local adds a layer of indirection (the reader now has to jump to the
`locals` block to understand it) without any DRY benefit, since there's nothing being repeated.

---

**Q8: What happens if two locals reference each other circularly?**

A: Terraform detects the cycle while building the dependency graph and fails with a dependency
cycle error before any plan can be produced — it will not attempt to resolve an ambiguous circular
computation.

---

**Q9: How should locals be organized in a large, multi-contributor configuration?**

A: Common practice is a dedicated `locals.tf` file with multiple `locals` blocks grouped by
concern (naming, tagging, environment sizing) using comment headers for readability, since
multiple blocks merge identically to one. Alternatively, locals used by only one file's resources
can be colocated in that file rather than centralized, trading a single big-picture view for
better locality of reference — the right balance often shifts as a configuration grows.

---

**Q10: Give an example of hardcoding a value where a local would have been the better choice.**

A: Repeating `"${var.project}-${var.environment}"` as an inline string interpolation in fifteen
separate resource blocks' `Name` tags or resource name arguments. If the naming convention changes
later (e.g., adding a region suffix), every one of those fifteen call sites needs a manual,
consistent edit — versus a single change to one `locals.name_prefix` expression that every
resource already references.
