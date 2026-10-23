# 01 — Module Basics

## Table of Contents

1. [Why Modules (Avoiding Copy-Paste Infrastructure)](#1-why-modules-avoiding-copy-paste-infrastructure)
2. [Root Module vs Child Modules](#2-root-module-vs-child-modules)
3. [The module Block Syntax](#3-the-module-block-syntax)
4. [Passing Variables In and Reading Outputs Out](#4-passing-variables-in-and-reading-outputs-out)
5. [Standard Module File Structure](#5-standard-module-file-structure)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Modules (Avoiding Copy-Paste Infrastructure)

Picture this: your company has three environments — dev, staging, production. Each one needs a
VPC, three subnets, a security group, and an EC2 instance. You write the `.tf` files for dev,
copy them into a `staging/` folder, tweak the CIDR block, copy them again into `prod/`, tweak
again. Six months later, someone finds a security group rule in prod that's wrong. You go fix
it... and then remember you need to fix the *same* mistake in dev and staging too, except the
files have drifted apart so much that the fix doesn't paste cleanly anymore. This is exactly the
problem modules exist to solve.

A **module** is simply a reusable, parameterized bundle of Terraform configuration. Instead of
writing the VPC + subnets + security group code three times, you write it once as a module, then
*call* that module three times with different inputs (different CIDR blocks, different instance
sizes). One source of truth, three configurations.

### Analogy

Think of a module like a cookie cutter. You don't hand-cut every cookie from scratch, freehand,
hoping they come out the same shape — you build one cutter (the module) and press it into the
dough as many times as you like (module "calls"). Each cookie can still be a different flavor
(different input variables — dev vs prod sizing) but they're all guaranteed to be the same
*shape* (the same architecture, the same security posture, the same tags).

### Under the Hood

Without modules, every environment is a flat pile of resources with no boundary between them:

```
WITHOUT MODULES                          WITH MODULES
────────────────────                     ────────────────────

dev/main.tf                              modules/vpc/  (written ONCE)
  resource "aws_vpc" ...                   main.tf, variables.tf, outputs.tf
  resource "aws_subnet" ...
  resource "aws_security_group" ...        environments/dev/main.tf
                                             module "vpc" {
staging/main.tf   (COPY-PASTED)               source = "../../modules/vpc"
  resource "aws_vpc" ...                      cidr_block = "10.0.0.0/16"
  resource "aws_subnet" ...                 }
  resource "aws_security_group" ...
                                          environments/staging/main.tf
prod/main.tf      (COPY-PASTED AGAIN)       module "vpc" {
  resource "aws_vpc" ...                      source = "../../modules/vpc"
  resource "aws_subnet" ...                   cidr_block = "10.1.0.0/16"
  resource "aws_security_group" ...         }

  ↑ 3 copies to keep in sync,             environments/prod/main.tf
    3 places a bug can hide                 module "vpc" {
                                               source = "../../modules/vpc"
                                               cidr_block = "10.2.0.0/16"
                                             }

                                          ↑ 1 place to fix a bug,
                                            3 places it's automatically applied
```

When Terraform runs `plan` or `apply`, it doesn't treat a module call as some special magic — it
simply expands the module block into the resources defined inside it, as if you had pasted that
code in yourself, but with the input variables substituted in. Every resource created inside a
module gets a prefixed address in the state file, like `module.vpc.aws_vpc.main`, so Terraform
can track exactly which module a resource "belongs" to.

### Example

```hcl
# modules/vpc/main.tf  — the reusable module, written once
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.environment}-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.environment}-public-${count.index}"
  }
}
```

```hcl
# environments/dev/main.tf  — calling the module
module "vpc" {
  source = "../../modules/vpc"

  environment          = "dev"
  cidr_block            = "10.0.0.0/16"
  public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
  availability_zones    = ["us-east-1a", "us-east-1b"]
}
```

```hcl
# environments/prod/main.tf  — same module, different inputs
module "vpc" {
  source = "../../modules/vpc"

  environment          = "prod"
  cidr_block            = "10.2.0.0/16"
  public_subnet_cidrs   = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

Fix a bug in `modules/vpc/main.tf` once, and every environment that calls the module picks it up
the next time someone runs `terraform plan` there.

### Common Confusion

People new to Terraform sometimes think modules are only for "official" reusable libraries
downloaded from the registry (covered in lesson 03). In reality, the *most common* use of modules
is entirely local and private — just factoring your own repo's repeated patterns into a
`modules/` folder, exactly like the VPC example above. You don't need to publish anything or use
git sources to benefit from modules.

### Interview Answer

"A module is a container for multiple resources that are used together, parameterized by input
variables and exposing values via outputs. Modules exist to eliminate copy-pasted infrastructure
code — instead of duplicating a VPC-and-subnets pattern across dev/staging/prod, you write it
once as a module and call it three times with different inputs. Terraform expands each module
call into real resources at plan time, prefixing their addresses in state with the module path."

> **Memory hook:** A module is a cookie cutter — one shape, pressed into as much dough (as many environments) as you need.

---

## 2. Root Module vs Child Modules

Here's something that confuses almost everyone the first time they read Terraform docs: *every*
Terraform configuration is a module, even if you never write a single `module` block. The
directory you run `terraform apply` from is called the **root module**. Any module you call from
there — with a `module "name" { source = ... }` block — becomes a **child module**. This
distinction matters because it changes how you address resources in state, how outputs propagate,
and where variables get their values from.

### Analogy

Think of an org chart. The root module is the CEO's office — it's where the buck stops, where
`terraform apply` is actually invoked, and where top-level decisions (variable values from
`.tfvars`, provider configuration) get made. Child modules are departments reporting up to the
CEO: each department (module) has its own internal structure and staff (resources), but it only
talks to the CEO's office through defined channels — inputs coming down, reports (outputs) going
up. A department can't just reach into another department's files directly.

### Under the Hood

```
                         ┌───────────────────────────┐
                         │      ROOT MODULE           │
                         │   (the directory you       │
                         │    run terraform apply in) │
                         │                             │
                         │  var.environment = "prod"   │  ← from terraform.tfvars
                         │  module "vpc" { ... }        │
                         │  module "compute" { ... }    │
                         └──────────┬─────────┬────────┘
                                    │         │
                     inputs down    │         │   inputs down
                                    ▼         ▼
                    ┌───────────────────┐   ┌───────────────────┐
                    │  CHILD MODULE     │   │  CHILD MODULE     │
                    │  "vpc"            │   │  "compute"        │
                    │                   │   │                   │
                    │  aws_vpc.main     │   │  aws_instance.app │
                    │  aws_subnet.pub   │   │                   │
                    └─────────┬─────────┘   └───────────────────┘
                              │  outputs up
                              ▼
                    module.vpc.vpc_id  ──► used as input to "compute"
```

State addressing follows the same nesting:

```
# terraform state list  (root module resources have NO prefix)
aws_route53_record.app

# resources inside child modules are prefixed with module.<name>.
module.vpc.aws_vpc.main
module.vpc.aws_subnet.public[0]
module.vpc.aws_subnet.public[1]
module.compute.aws_instance.app
```

A child module can itself call another module — that's a **nested module** (covered in lesson
02) — but no matter how deep the nesting goes, there is only ever one root module per Terraform
working directory: the one holding the `.tf` files you actually run commands against.

### Example

```hcl
# root module: environments/prod/main.tf
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

module "vpc" {
  source = "../../modules/vpc"

  environment = "prod"
  cidr_block  = "10.2.0.0/16"
}

module "compute" {
  source = "../../modules/compute"

  environment = "prod"
  vpc_id      = module.vpc.vpc_id      # child module output feeds another child module
  subnet_id   = module.vpc.public_subnet_ids[0]
}
```

Notice: `provider` blocks and `terraform` blocks live in the root module. Child modules should
almost never declare their own `provider` blocks — they inherit the provider configuration passed
down from the root (or explicitly via `providers = { ... }` in the module call, an advanced
pattern).

### Common Mistakes

- Declaring a `provider "aws" { region = ... }` block *inside* a child module. This is legal but
  strongly discouraged — it makes the module impossible to reuse across regions/accounts, since
  the provider config is baked into the module instead of controlled by whoever calls it.
- Assuming `terraform state list` output without a `module.` prefix means "child module resources
  aren't tracked." They absolutely are tracked — they're just addressed with the `module.<name>.`
  prefix so Terraform (and you) can tell which resources came from which module call.

### Interview Answer

"The root module is the configuration directory Terraform is invoked against directly — it's
where provider blocks, backend configuration, and top-level variable values live. A child module
is any module referenced via a `module` block from the root (or from another module). Resources
inside child modules are addressed in state as `module.<name>.<resource_type>.<name>`, and data
flows strictly through declared inputs (variables) going down and declared outputs coming back
up — a child module can't reach into a sibling module's resources directly."

> **Memory hook:** Root module = CEO's office where `apply` is run. Child modules = departments that only talk through official inputs and reports.

---

## 3. The module Block Syntax

You've seen `module` blocks in the last two sections already — now let's slow down and cover
every part of the syntax precisely, because a surprising number of Terraform bugs come from
getting one of these arguments subtly wrong (a relative path off by one `../`, or forgetting a
required version pin).

### Analogy

A `module` block is like filling out a work order form to a specialized contractor. You write
down: *which* contractor (`source`), *which version* of their service catalog you want
(`version`), and the *job details* (all the other arguments, which become that module's input
variables). The contractor does the work and hands back a report (`outputs`) — you just wire that
report into your own paperwork.

### Under the Hood

```
module "vpc" {
  source  = "../../modules/vpc"     ← WHERE the module's code lives
  version = "~> 2.0"                 ← version constraint (registry sources only)

  environment = "prod"               ┐
  cidr_block  = "10.2.0.0/16"        ├─ everything else = input variables,
  subnet_count = 3                   ┘  matched to variables.tf inside the module

  count      = 1                     ← meta-argument (optional, like a resource)
  depends_on = [aws_iam_role.ci]      ← meta-argument (optional)
  providers  = { aws = aws.east }     ← meta-argument (optional, advanced)
}
```

Terraform parses this block, resolves `source` (local path, registry address, or Git URL — see
lesson 03), loads the `.tf` files it finds there, and treats every other argument in the block as
a value being assigned to a matching `variable` block declared inside that module. If you pass an
argument that the module doesn't declare as a variable, `terraform validate` fails immediately —
modules have a strict, checked interface, not a loose bag of arbitrary settings.

### Example

```hcl
# modules/compute/variables.tf
variable "environment" {
  type        = string
  description = "Environment name, e.g. dev, staging, prod"
}

variable "instance_type" {
  type        = string
  default     = "t3.micro"
  description = "EC2 instance type"
}

variable "vpc_id" {
  type        = string
  description = "VPC to launch the instance in"
}

variable "subnet_id" {
  type        = string
  description = "Subnet to launch the instance in"
}
```

```hcl
# environments/prod/main.tf
module "compute" {
  source = "../../modules/compute"

  environment   = "prod"
  instance_type = "t3.large"           # overrides the module's default
  vpc_id        = module.vpc.vpc_id
  subnet_id     = module.vpc.public_subnet_ids[0]
}

# Calling the SAME module again with a different name — a second, independent instance
module "compute_batch" {
  source = "../../modules/compute"

  environment   = "prod"
  instance_type = "c5.xlarge"
  vpc_id        = module.vpc.vpc_id
  subnet_id     = module.vpc.public_subnet_ids[1]
}
```

Notice `instance_type` is omitted from nowhere being required — it has a `default` in the module,
so a caller can skip it and get `t3.micro`. `environment`, `vpc_id`, and `subnet_id` have no
default, so *every* caller must supply them or `terraform plan` errors out with a "missing
required argument" message.

### Common Mistakes

- **Typing an argument that isn't a declared variable.** Terraform will error with something
  like `An argument named "isntance_type" is not expected here` — usually a typo. Always check the
  module's `variables.tf` (or its README) for the exact expected argument names.
- **Forgetting a required variable has no default.** If `variables.tf` declares a variable with
  no `default`, every caller must supply it — there's no "it'll just use nothing" fallback.
- **Reusing the same module name (`module "vpc"`) twice in the same file.** Module block labels,
  like resource names, must be unique within their containing module — use `count` or `for_each`
  on the module block itself if you need multiple instances (Terraform 0.13+).

### Interview Answer

"A `module` block has a `source` argument telling Terraform where to find the module's code, an
optional `version` constraint when the source is a registry, and then any number of arguments
that map directly onto `variable` blocks declared inside the module — Terraform validates that
every argument you pass matches a declared variable, and that every variable without a default is
supplied. Meta-arguments like `count`, `for_each`, `depends_on`, and `providers` also work on
module blocks, just like on resource blocks."

> **Memory hook:** A `module` block is a work order — `source` says which contractor, everything else fills in the job spec that must match their intake form (`variables.tf`) exactly.

---

## 4. Passing Variables In and Reading Outputs Out

Here's the practical question every module user eventually hits: "I created a VPC inside a
module — how do I get its ID into the security group I'm creating in the root module?" The VPC
resource lives *inside* the module's own state namespace; you can't just write
`aws_vpc.main.id` from the root and expect it to work, because from the root module's point of
view, `aws_vpc.main` doesn't exist — only `module.vpc` exists, and only what that module chooses
to expose as an `output`.

### Analogy

Think of a vending machine. You put coins in a specific slot (input variables) — you can't just
reach inside and grab whatever snack you want. The machine internally decides what happens with
your coins, and only gives you back exactly what comes out of the delivery slot (outputs). If the
machine's designer didn't wire up a delivery slot for a certain snack, you can't get it out, no
matter how much you know it's in there.

### Under the Hood

```
                    ┌─────────────── module "vpc" ───────────────┐
                    │                                              │
  INPUTS   ───────► │  var.cidr_block ──► aws_vpc.main             │
  (from caller)      │  var.environment  ──►    (cidr_block = ...) │
                    │                                              │
                    │  aws_subnet.public[0], [1], [2]               │
                    │                                              │
                    │  output "vpc_id" {                            │
                    │    value = aws_vpc.main.id                    │
                    │  }                                            │
                    │  output "public_subnet_ids" {                 │
  OUTPUTS  ◄─────── │    value = aws_subnet.public[*].id            │
  (to caller)         │  }                                            │
                    └──────────────────────────────────────────────┘

Caller (root module) reads outputs as:  module.vpc.vpc_id
                                          module.vpc.public_subnet_ids
```

Two rules fall directly out of this diagram:

1. A module can **only** read what the caller passes as `variable` values — it has zero visibility
   into any other resource, module, or data source in the calling configuration unless it's
   explicitly passed in.
2. A caller can **only** read what the module explicitly declares as an `output` — internal
   resources of the module (like `aws_vpc.main` itself) are invisible from outside; only the
   `output` blocks form the module's public interface.

### Example

```hcl
# modules/vpc/outputs.tf
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of all public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_cidr_blocks" {
  description = "CIDR blocks of all public subnets"
  value       = aws_subnet.public[*].cidr_block
}
```

```hcl
# environments/prod/main.tf
module "vpc" {
  source     = "../../modules/vpc"
  environment = "prod"
  cidr_block  = "10.2.0.0/16"
}

# Using the module's outputs as inputs to a plain resource in the root module
resource "aws_security_group" "web" {
  name   = "prod-web-sg"
  vpc_id = module.vpc.vpc_id          # ← reading a child module output

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [module.vpc.public_subnet_cidr_blocks[0]]
  }
}

# Feeding a module's output straight into ANOTHER module's input
module "compute" {
  source    = "../../modules/compute"
  vpc_id    = module.vpc.vpc_id       # ← chaining module outputs as module inputs
  subnet_id = module.vpc.public_subnet_ids[0]
}
```

### Common Mistakes

- Trying to reference a resource *inside* a module directly, e.g. `module.vpc.aws_vpc.main.id`.
  This does not work — you cannot dot into a module's internal resources. You can only access
  values the module author explicitly exposed via `output` blocks.
- Forgetting to add an `output` block for a value you'll need later. If you didn't think ahead
  and expose `vpc_id` as an output, you have to go add it, then run `terraform apply` again before
  any other configuration can consume it — outputs aren't retroactive.
- Assuming outputs are automatically "public" the moment a resource exists. Nothing is exposed
  from a module unless there's an explicit `output` block for it — the module's internals are
  private by default.

### Interview Answer

"Variables are how data flows *down* into a module — the caller sets them via arguments on the
`module` block, and inside the module they're referenced as `var.name`. Outputs are how data
flows *up* out of a module — the module declares `output` blocks exposing specific values, and
the caller reads them as `module.<name>.<output_name>`. A module's only interface to the outside
world is its declared variables and outputs; you cannot reach into a module's internal resources
directly from the calling configuration."

> **Memory hook:** Variables are the coin slot going in, outputs are the delivery slot coming out — you never get to reach inside the vending machine.

---

## 5. Standard Module File Structure

If you've browsed any module on the public Terraform Registry, you've probably noticed they all
look eerily similar: a `main.tf`, a `variables.tf`, an `outputs.tf`, and a `README.md`. This isn't
a coincidence or a HashiCorp mandate enforced by the tool — it's a community convention that
exists because it makes every module predictable to *read*, even one you've never seen before.
When file layout is standardized, you always know exactly where to look for "what does this thing
need" (variables.tf) versus "what does this thing give back" (outputs.tf) versus "what does it
actually build" (main.tf).

### Analogy

It's like the standard drawers in a hotel room desk — top drawer is always stationery, second
drawer is always the info binder, bottom drawer is always extra pillows. You've never stayed in
this specific hotel room before, but because every hotel in the chain uses the same drawer
convention, you know exactly where to look without opening all of them.

### Under the Hood

```
modules/vpc/
├── main.tf          ← the actual resources (aws_vpc, aws_subnet, aws_route_table, ...)
├── variables.tf      ← every input the module accepts, with type + description + default
├── outputs.tf         ← every value the module exposes to callers
├── versions.tf        ← required_providers / required_version constraints (often merged into main.tf)
└── README.md          ← human-readable docs: purpose, example usage, inputs/outputs table
```

Terraform itself does **not** enforce these exact filenames — you could put every resource in one
giant `everything.tf` and Terraform would happily load it (Terraform loads and merges *all* `.tf`
files in a directory regardless of name). The split into `main.tf` / `variables.tf` / `outputs.tf`
is purely a readability convention, but it's such a strong one that violating it will make
reviewers (and your future self) squint at your pull requests.

### Example

```hcl
# modules/vpc/variables.tf
variable "environment" {
  type        = string
  description = "Environment name used in resource tags, e.g. dev, staging, prod"
}

variable "cidr_block" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets, one per availability zone"
  default     = []
}
```

```hcl
# modules/vpc/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block = var.cidr_block
  tags = {
    Name = "${var.environment}-vpc"
  }
}

resource "aws_subnet" "public" {
  count      = length(var.public_subnet_cidrs)
  vpc_id     = aws_vpc.main.id
  cidr_block = var.public_subnet_cidrs[count.index]
  tags = {
    Name = "${var.environment}-public-${count.index}"
  }
}
```

```hcl
# modules/vpc/outputs.tf
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}
```

````markdown
<!-- modules/vpc/README.md -->
# VPC Module

Creates a VPC with N public subnets spread across availability zones.

## Usage

```hcl
module "vpc" {
  source              = "../../modules/vpc"
  environment         = "prod"
  cidr_block          = "10.2.0.0/16"
  public_subnet_cidrs = ["10.2.1.0/24", "10.2.2.0/24"]
}
```

## Inputs

| Name | Description | Type | Default |
|------|-------------|------|---------|
| environment | Environment name for tags | string | n/a |
| cidr_block | CIDR block for the VPC | string | n/a |
| public_subnet_cidrs | List of public subnet CIDRs | list(string) | [] |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | ID of the created VPC |
| public_subnet_ids | IDs of the public subnets |
````

### Common Mistakes

- Cramming provider requirements, variables, resources, and outputs all into a single
  undifferentiated `main.tf`. Terraform doesn't care, but every human who has to maintain the
  module afterward does.
- Skipping the README. On a team, the README (or an auto-generated one via `terraform-docs`) is
  often the *only* documentation a module ever gets — without it, every consumer has to read
  `variables.tf` line by line to figure out what's required.
- Forgetting `description` on variables and outputs. Terraform doesn't require it, but a variable
  with no description is a mystery box to the next person who calls the module.

### Interview Answer

"By convention (not by tool enforcement), Terraform modules are laid out as `main.tf` for
resources, `variables.tf` for inputs, `outputs.tf` for the module's public interface, optionally
`versions.tf` for provider/version constraints, and a `README.md` documenting usage. Terraform
actually loads every `.tf` file in a directory and merges them regardless of filename, so this
structure is purely for human readability and consistency across teams and the public registry —
but it's followed so universally that deviating from it makes a module harder for others to
trust and adopt."

> **Memory hook:** main.tf / variables.tf / outputs.tf / README.md is the hotel-room drawer layout — same drawers, every room, so you never have to hunt.

---

## 6. Common Mistakes

A few module pitfalls are common enough, and costly enough, to call out together in one place
before you start writing your own modules.

| Mistake | Why It Hurts | Fix |
|---------|---------------|-----|
| Hardcoding a region/account inside a module's `provider` block | Module becomes unusable in any other region/account | Let the root module own all `provider` blocks; child modules just consume resources |
| Not pinning a module's provider `version` constraint | A provider upgrade silently changes module behavior | Add a `required_providers` block with a version constraint in the module |
| Passing secrets as plain-string module variables and printing them in outputs | Secrets land in state file and CLI output in plaintext | Mark sensitive variables/outputs with `sensitive = true`; still encrypt state at rest |
| One module trying to do "everything" (VPC + IAM + compute + DNS) | Impossible to reuse just the VPC part elsewhere; huge blast radius per apply | Split into single-responsibility modules (see lesson 02) |
| Referencing `module.name.some_resource.id` directly | Not valid — modules only expose declared outputs | Add an explicit `output` block for the value you need |
| Forgetting that changing a module's internal resource *type* (not just config) can force a destroy/recreate for every caller | Every environment using the module gets the same disruptive change simultaneously | Test module changes in dev first; use `terraform plan` per environment before wide rollout |

> **Memory hook:** Most module mistakes come from forgetting the module boundary is real — treat it like a sealed box with only the labeled slots (variables in, outputs out) actually connected to the outside.

---

## 7. Hands-On Exercises

**Exercise 1 — Build Your First Module**
Create a local module at `modules/s3-bucket/` that creates an `aws_s3_bucket` resource. It should
accept variables `bucket_name` (string, required) and `enable_versioning` (bool, default `false`),
and expose outputs `bucket_id` and `bucket_arn`. Call it twice from a root module with two
different bucket names.

**Exercise 2 — Trace the State Addresses**
After applying Exercise 1, run `terraform state list`. Identify which lines correspond to which
module call. Explain in your own words why the addresses look the way they do.

**Exercise 3 — Break the Interface on Purpose**
In your `modules/s3-bucket` module, try referencing `module.my_bucket.aws_s3_bucket.this.arn`
from the root module's `main.tf` instead of using a proper `output`. Run `terraform validate` and
read the error message carefully — explain why Terraform rejects this.

**Exercise 4 — Required vs Optional Variables**
Remove the `default` from `enable_versioning` in your module. Run `terraform plan` from a root
module that doesn't pass `enable_versioning`. What error do you get? Add the `default` back and
re-run to confirm it now works.

**Exercise 5 — Standard Structure Refactor**
Take any `.tf` file you've written previously in this course that mixes resources, variables, and
outputs in one file. Split it into `main.tf`, `variables.tf`, and `outputs.tf`, and write a short
`README.md` documenting its inputs and outputs table.

---

## 8. Interview Q&A

---

**Q1: What is a Terraform module?**

A: A module is a reusable, self-contained set of Terraform configuration files — resources,
variables, and outputs — that can be called multiple times with different input values. It lets
you define infrastructure patterns once and reuse them across environments or projects instead of
duplicating `.tf` code.

---

**Q2: What is the difference between a root module and a child module?**

A: The root module is the directory Terraform commands are actually run from — it holds provider
configuration and top-level variable values. A child module is any module invoked via a `module`
block from the root (or from another module). Resources inside a child module are addressed in
state with a `module.<name>.` prefix.

---

**Q3: How do you pass data into a module, and how do you get data back out?**

A: Data goes in via arguments on the `module` block, which must match `variable` blocks declared
inside the module — referenced internally as `var.name`. Data comes back out via `output` blocks
declared inside the module, read by the caller as `module.<name>.<output_name>`. A module's
internal resources are otherwise invisible to the caller.

---

**Q4: Why is the main.tf / variables.tf / outputs.tf split not enforced by Terraform?**

A: Terraform loads and merges every `.tf` file in a directory regardless of its filename — there
is no special meaning to the name `main.tf` versus `everything.tf`. The three-file convention
(plus `README.md`) is a community standard purely for human readability and consistency, followed
so widely (including on the public Registry) that deviating from it makes a module harder to
trust and review.

---

**Q5: Can you reference a resource inside a module directly from outside it, like
`module.vpc.aws_vpc.main.id`?**

A: No. A module's only public interface is its declared `output` blocks. If the module author
didn't expose a value as an output, the caller cannot access it, no matter how obviously it
exists inside the module's resources. You'd need to add an `output` block to the module and
re-apply before that value becomes available to callers.

---

**Q6: Where should provider blocks live when using modules?**

A: Provider blocks should live in the root module, not inside child modules. Child modules
inherit provider configuration from the root (implicitly, or explicitly via the `providers`
meta-argument on the module block). Hardcoding a `provider` block inside a child module ties that
module to one specific region/account and destroys its reusability.

---

**Q7: What happens if you pass an argument to a module block that isn't declared as a variable
inside that module?**

A: `terraform validate` (and `plan`) will fail with an error like "An argument named ... is not
expected here." Modules have a strict, checked interface — you can only pass arguments that
correspond to declared `variable` blocks inside the module.
