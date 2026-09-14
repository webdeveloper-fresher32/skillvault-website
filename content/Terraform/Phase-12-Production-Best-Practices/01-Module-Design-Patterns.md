# 01 — Module Design Patterns

## Table of Contents

1. [Recap: What Makes a Good Module](#1-recap-what-makes-a-good-module)
2. [The Composable "Layers" Pattern](#2-the-composable-layers-pattern)
3. [Versioned Internal Module Registry Strategy](#3-versioned-internal-module-registry-strategy)
4. [Avoiding the "God Module" Anti-Pattern](#4-avoiding-the-god-module-anti-pattern)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Recap: What Makes a Good Module

Picture two teams six months into using Terraform. Team A has one module called `infra` that
creates a VPC, three EC2 instances, an RDS database, an S3 bucket, and an IAM role — all in one
`main.tf` with forty input variables. Team B has small, focused modules: `vpc`, `ecs-service`,
`rds-postgres`, each doing one job well. Team A's `terraform plan` takes four minutes and touches
things nobody asked to change. Team B's plans are fast, scoped, and predictable. Same tool,
wildly different outcomes — and the difference is module design, not Terraform skill.

At the fundamentals level (Phase 6) "a good module" meant: it has clear inputs (`variables.tf`),
clear outputs (`outputs.tf`), sensible defaults, and it doesn't hardcode things that differ between
environments (account IDs, CIDR blocks, instance sizes). At production scale, all of that is still
true, but three more properties become non-negotiable:

1. **Single responsibility** — a module manages one conceptual piece of infrastructure (a
   network, a database, a service), not "everything for project X."
2. **Stable, versioned interface** — consumers pin to a module version and upgrade deliberately,
   the same way you'd pin an npm or pip package.
3. **Composability** — modules are combined by *root* configurations that wire outputs of one
   into inputs of another, rather than one module reaching into another's internals.

### Analogy

A good module is like a well-designed API endpoint in a microservice architecture: it has a
contract (inputs/outputs), it does one job, and callers don't need to know how it's implemented
internally to use it correctly. A "god module" is the monolith that does everything — you can't
change the billing logic without redeploying the entire application, and you can't reason about
just one part of it in isolation.

### Recap Checklist

| Property | Fundamentals-level check | Production-level check |
|---|---|---|
| Inputs | `variables.tf` with types and descriptions | Inputs validated (`validation` blocks), no environment-specific hardcoding |
| Outputs | `outputs.tf` exposes what callers need | Outputs are a stable *contract* — renaming breaks consumers, so it's versioned |
| Defaults | Sensible defaults for optional variables | Defaults documented; no secret defaults ever |
| Scope | Groups related resources | Scope maps to a bounded, independently-deployable unit ("layer") |
| Reuse | Used more than once | Published/versioned so multiple teams/repos can consume it safely |

### Common Confusion

A common misconception is that "modularizing" just means moving resource blocks into a
subdirectory and calling it a module. That's refactoring, not design. A module boundary is a
*deployment* boundary consideration too — anything inside one module's `resource` blocks lives
in the same Terraform run and (usually) the same state file section. Boundaries should be drawn
around what changes together and what needs to be deployed/rolled back independently, not just
around what looks tidy in a folder tree.

### Interview Answer

"A production-grade module has a single responsibility, a stable versioned interface (inputs and
outputs that don't change without a version bump), validated inputs, no hardcoded
environment-specific values, and a scope that matches an independently deployable unit of
infrastructure — not just a folder of related resources."

> **Memory hook:** A good module is a microservice with a contract, not a junk drawer with a folder name.

---

## 2. The Composable "Layers" Pattern

Here's the scenario that breaks the "one big module" approach every time: your networking team
wants to update a security group rule. Your database team is mid-migration on RDS. Your app team
is deploying ten times a day. If all of that infrastructure lives in one Terraform state managed
by one root module, *any* of those changes forces a plan/apply against the same state file — one
team's `terraform apply` can be blocked by another team's lock, and a mistake in the app layer's
plan can theoretically show a diff touching the VPC. The fix is to split infrastructure into
**layers**, each with its own root module, its own state file, and its own blast radius.

### Analogy

Think of a building's utilities: plumbing, electrical, and network cabling are installed by
different trades, inspected separately, and can be repaired independently without tearing out the
others — as long as they agree on where the wall sockets and pipe fittings are (the interface).
The "layers" pattern applies that same separation-of-trades idea to infrastructure: the network
layer, the data layer, the compute layer, and the application layer are installed and repaired
independently, and they hand data to each other through **remote state outputs**, not shared code.

### The Four Common Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 4 — APPLICATION                                              │
│  ECS services, Lambda functions, ALB listener rules, autoscaling    │
│  State: app-layer/terraform.tfstate                                 │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │ reads outputs from
┌───────────────────────────────▼─────────────────────────────────────┐
│  Layer 3 — COMPUTE                                                   │
│  ECS cluster, EKS cluster, EC2 launch templates, ASGs                │
│  State: compute-layer/terraform.tfstate                              │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │ reads outputs from
┌───────────────────────────────▼─────────────────────────────────────┐
│  Layer 2 — DATA                                                      │
│  RDS instances, ElastiCache, S3 buckets, DynamoDB tables             │
│  State: data-layer/terraform.tfstate                                 │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │ reads outputs from
┌───────────────────────────────▼─────────────────────────────────────┐
│  Layer 1 — NETWORK                                                    │
│  VPC, subnets, route tables, NAT gateways, security groups            │
│  State: network-layer/terraform.tfstate                               │
└───────────────────────────────────────────────────────────────────--┘
```

Each layer is its own root module (own backend configuration, own `terraform apply` lifecycle).
Layers depend on each other only through outputs read via `terraform_remote_state` or, in Terraform
Cloud/Enterprise, run triggers — never by one layer's code importing another's `.tf` files.

### Example

**Layer 1 — network-layer/main.tf**

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "network-layer/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acme-tf-locks"
    encrypt        = true
  }
}

module "vpc" {
  source  = "app.terraform.io/acme-corp/vpc/aws"
  version = "~> 3.2"

  name       = "prod"
  cidr_block = "10.10.0.0/16"
  azs        = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}
```

**Layer 2 — data-layer/main.tf** (consumes Layer 1's state)

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "data-layer/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acme-tf-locks"
    encrypt        = true
  }
}

data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "acme-tfstate-prod"
    key    = "network-layer/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "prod-db-subnets"
  subnet_ids = data.terraform_remote_state.network.outputs.private_subnet_ids
}

resource "aws_db_instance" "main" {
  identifier             = "prod-orders-db"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = false
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}
```

Layer 3 (compute) and Layer 4 (application) chain in the same way, each reading the outputs of the
layer beneath it.

### Common Confusion

Engineers new to this pattern often ask "isn't this just more state files to manage, and isn't
that worse?" It's more *files*, but each one is smaller, changes less often, and has a smaller
blast radius — which is a trade you almost always want in production. The mistake to avoid is the
opposite direction: too many layers, each with one resource, creating a web of remote state lookups
that's harder to trace than the monolith it replaced. Four layers (network/data/compute/app) is a
good starting granularity; split further only when a real team boundary or deploy-cadence
difference demands it.

### Interview Answer

"The layers pattern splits infrastructure into independently-deployed root modules — typically
network, data, compute, and application — each with its own state file and backend. Layers
communicate through `terraform_remote_state` data sources reading each other's outputs, never
through shared source code. This limits blast radius: a bad application-layer apply can't corrupt
network state, and teams that own different layers don't block each other on state locks."

> **Memory hook:** Layers are separate trades on a job site — plumbing, electrical, network cabling — each installed and repaired independently, agreeing only on where the sockets are.

---

## 3. Versioned Internal Module Registry Strategy

Imagine your `vpc` module is used by fifteen different application teams. You fix a bug in it —
say, a wrong route table association. If every team's root module points at
`git::https://github.com/acme/tf-modules.git//vpc?ref=main`, that fix (or a *breaking* change
someone else pushes next week) lands in everyone's next `terraform init` silently, with zero
warning and zero opt-in. That's exactly how a "small fix" turns into fifteen simultaneous
production incidents. The fix is to treat internal modules like software packages: give them
semantic versions, publish them to a registry, and let consumers pin and upgrade on their own
schedule.

### Analogy

An internal module registry is like your company's internal npm/PyPI mirror. Nobody depends on
"whatever is on the main branch of the utils repo right now" — they depend on `utils@2.3.1`, and
upgrading to `3.0.0` is a deliberate, reviewed decision, not something that happens to you while
you sleep.

### Strategy: Git Tags + Semantic Versioning

Terraform supports versioned module sources natively for Git and registry sources. The cheapest
internal registry to start with is just **Git tags** following semver:

```
tf-modules/
├── modules/
│   ├── vpc/
│   ├── ecs-service/
│   └── rds-postgres/
└── CHANGELOG.md

Git tags:  vpc/v1.0.0   vpc/v1.1.0   vpc/v2.0.0
           ecs-service/v1.0.0   ecs-service/v1.2.3
```

Consumers reference a specific tag:

```hcl
module "vpc" {
  source = "git::https://github.com/acme-corp/tf-modules.git//modules/vpc?ref=vpc/v2.0.0"

  name       = "staging"
  cidr_block = "10.20.0.0/16"
}
```

### Strategy: A Real Module Registry

Once you have enough consumers, a private registry (Terraform Cloud/Enterprise private registry,
or a self-hosted one) is worth the investment because it gives you `version` constraints instead
of exact `ref` pins, plus a searchable catalog:

```hcl
module "vpc" {
  source  = "app.terraform.io/acme-corp/vpc/aws"
  version = "~> 2.1"   # accepts 2.1.x, rejects 3.0.0
}
```

### Semver Rules for Module Authors

| Change | Version bump | Example |
|---|---|---|
| Bug fix, no interface change | Patch (`2.1.0` → `2.1.1`) | Fixed wrong tag on a resource |
| New optional input/output, backward compatible | Minor (`2.1.0` → `2.2.0`) | Added optional `enable_flow_logs` variable |
| Removed/renamed a variable or output, changed a default in a breaking way | Major (`2.1.0` → `3.0.0`) | Renamed `subnet_cidr` → `subnet_cidrs` (list) |

```
┌───────────────────────────────────────────────────────────┐
│  Consumer's version constraint decides upgrade exposure     │
├──────────────────┬──────────────────────────────────────────┤
│ version = "2.1.0" │ Locked exactly — never changes silently  │
│ version = "~> 2.1" │ Accepts 2.1.x patch fixes only           │
│ version = "~> 2"   │ Accepts any 2.x.x minor/patch            │
│ version = ">= 2.0" │ Accepts everything 2.0.0+, including 3.x │
└──────────────────┴──────────────────────────────────────────┘
```

### Common Mistakes

- **Pointing at `?ref=main`**: the single most common way teams accidentally take an unreviewed
  breaking change. Always pin to a tag or version constraint.
- **Bumping only patch versions for breaking changes** because "it was a small change" — semver is
  a promise to consumers, not a description of how much code moved.
- **No `CHANGELOG.md`**: without one, consumers can't tell what a version bump actually changed
  before deciding to upgrade.

### Interview Answer

"Internal modules should be versioned like any shared package: Git tags or a private registry
entry using semantic versioning, with consumers pinning a version constraint (`~> 2.1`) rather
than tracking a branch. This lets module authors ship fixes and features without silently breaking
every consumer, and lets consuming teams upgrade deliberately, on their own schedule, after
reading a changelog."

> **Memory hook:** Never `import * from main` — pin the version, read the changelog, upgrade on your own terms.

---

## 4. Avoiding the "God Module" Anti-Pattern

Every "god module" starts innocently. Someone needs a VPC and an EC2 instance for a proof of
concept, so they put both in one module for convenience. Six months later that same module also
creates the RDS database, the S3 buckets, the IAM roles, the CloudWatch alarms, and a Lambda
function — because "it was already there, and adding one more resource felt easier than making a
new module." Now a junior engineer needs to add a single S3 bucket and has to understand forty
variables, half of which are unrelated to buckets, to safely make the change without breaking the
EC2 instances defined 200 lines below.

### Analogy

A god module is the "one drawer for everything" in a kitchen — the tape measure, batteries, spare
keys, rubber bands, and take-out menus. It's not that any single item is wrong to own; it's that
finding anything, or removing anything, requires digging through everything else, and nobody can
agree on what belongs there anymore.

### How to Recognize One

| Symptom | What it signals |
|---|---|
| More than ~15-20 top-level resources/modules in one root | Scope has grown past one responsibility |
| Variable file has 30+ variables, many optional/unused per environment | Module is trying to serve every use case at once |
| `terraform plan` regularly shows unrelated diffs | Resources that don't change together are coupled together |
| Different teams need to review the same PR for unrelated changes | Ownership boundary doesn't match the module boundary |
| The module has resources behind `count = var.enable_x ? 1 : 0` for many `x` | Feature flags substituting for real modularization |

### Refactoring Pattern

```
BEFORE (god module):                    AFTER (composable modules):

infra/                                  modules/
├── main.tf   (VPC + EC2 + RDS +        ├── vpc/
│              S3 + IAM + Lambda +      ├── ecs-service/
│              CloudWatch, 600 lines)   ├── rds-postgres/
├── variables.tf (40 variables)         ├── s3-static-site/
└── outputs.tf                          └── lambda-worker/

                                         root/
                                         ├── network-layer/  (uses modules/vpc)
                                         ├── data-layer/     (uses modules/rds-postgres,
                                         │                     modules/s3-static-site)
                                         └── app-layer/       (uses modules/ecs-service,
                                                               modules/lambda-worker)
```

### Example — Splitting a God Module

Before (one module doing everything, abbreviated):

```hcl
# modules/infra/main.tf  (god module — DO NOT do this)
resource "aws_vpc" "this" { cidr_block = var.vpc_cidr }
resource "aws_instance" "app" { ami = var.ami; instance_type = var.instance_type }
resource "aws_db_instance" "this" { engine = "postgres" /* ... */ }
resource "aws_s3_bucket" "assets" { bucket = var.bucket_name }
resource "aws_iam_role" "app" { /* ... */ }
```

After — one focused module, composed by a root:

```hcl
# modules/rds-postgres/main.tf
resource "aws_db_instance" "this" {
  identifier          = var.identifier
  engine              = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  allocated_storage    = var.allocated_storage
  db_subnet_group_name = var.db_subnet_group_name
  skip_final_snapshot  = var.skip_final_snapshot
}

output "endpoint" {
  value = aws_db_instance.this.endpoint
}
```

```hcl
# data-layer/main.tf (root module composing focused modules)
module "orders_db" {
  source  = "app.terraform.io/acme-corp/rds-postgres/aws"
  version = "~> 1.4"

  identifier           = "prod-orders-db"
  engine_version       = "15.4"
  instance_class       = "db.r6g.large"
  allocated_storage    = 100
  db_subnet_group_name = data.terraform_remote_state.network.outputs.db_subnet_group_name
  skip_final_snapshot  = false
}
```

### Common Mistakes

- Adding "just one more resource" to an existing module because a new module feels like overhead —
  the overhead of a new module directory is far smaller than the long-term cost of a god module.
- Using boolean feature flags (`enable_rds`, `enable_lambda`) inside one module instead of separate
  modules — this is modularization pretending not to be modularization, and it keeps unrelated
  resources coupled in the same plan/apply.
- Treating "it's all one application" as a reason to keep everything in one module — application
  boundaries and deployment/blast-radius boundaries are not the same thing.

### Interview Answer

"A god module is a module that has grown to manage unrelated pieces of infrastructure — network,
compute, data, and application resources all in one place — usually because new resources were
added to an existing module out of convenience rather than being given their own scope. It's a
problem because it couples unrelated changes into the same plan/apply, forces reviewers and
variables to cover every use case, and makes the module impossible to reuse partially. The fix is
to split by responsibility, using the layers pattern to keep truly independent infrastructure in
separate root modules with separate state."

> **Memory hook:** If your module needs a table of contents to explain what it manages, it's a junk drawer, not a module.

---

## 5. Common Mistakes

- **Sharing one state file across all layers** "for simplicity," then being surprised when a
  network change and an app deploy can't happen independently.
- **Tracking a module's `main` branch** instead of pinning versions, turning every `terraform init`
  into an unreviewed deploy of someone else's latest commit.
- **Letting module scope grow with the org** instead of proactively splitting responsibilities —
  god modules are rarely built that way on day one; they accrete.
- **Treating outputs as an implementation detail** — renaming or removing an output without a major
  version bump breaks every consumer's `terraform plan` with a cryptic "Unsupported attribute" error.
- **Skipping `variable` and `output` descriptions** — at scale, a module with undocumented
  interfaces is only usable by the person who wrote it.

---

## 6. Hands-On Exercises

**Exercise 1 — Draw the Layers**
For a typical three-tier web app (VPC, ALB, ECS Fargate service, RDS Postgres, S3 for static
assets), draw which resources belong in the network, data, compute, and application layers. Write
out the `terraform_remote_state` outputs each layer would need to read from the layer below it.

**Exercise 2 — Refactor a God Module**
You inherit a module `modules/app-stack` containing: a VPC, two subnets, a security group, an RDS
instance, an S3 bucket, an ECS cluster, and an ECS service — 25 variables total, some used only by
some resources. Propose a split into at least three focused modules. For each new module, list its
`variables.tf` names and `outputs.tf` names.

**Exercise 3 — Version a Breaking Change**
Your `vpc` module is at `v1.4.2`. You need to rename the output `subnet_id` (singular, one subnet)
to `subnet_ids` (list, now supports multiple subnets per AZ). What version should the next release
be tagged? Write the Git tag command and a one-paragraph changelog entry explaining the breaking
change and the migration path for consumers.

**Exercise 4 — Registry Constraint Reasoning**
A consumer pins `version = "~> 3.2"` on a module currently at `3.2.4`. The module author releases
`3.3.0` (new optional feature) and separately `4.0.0` (renamed a required variable). Which of these
will the consumer pick up on their next `terraform init` without changing their constraint, and
why?

---

## 7. Interview Q&A

---

**Q1: What distinguishes a production-grade module from a module that merely "works"?**

A: A production-grade module has a single, well-scoped responsibility; a stable interface
(inputs/outputs) that changes only with a deliberate version bump; validated inputs; documented
variables and outputs; and no hardcoded environment-specific values. A module that "merely works"
might do all of that inconsistently, or might bundle unrelated resources together because it was
convenient at the time.

---

**Q2: What is the "layers" pattern and why is it used?**

A: It splits infrastructure into separate root modules — commonly network, data, compute, and
application — each with its own state file and backend. Layers communicate only through outputs
read via `terraform_remote_state` (or run triggers in Terraform Cloud), never through shared
source. This limits blast radius, lets different teams own and deploy different layers
independently, and avoids state lock contention between unrelated changes.

---

**Q3: Why shouldn't internal modules be referenced by `ref=main` or `ref=master`?**

A: Referencing a branch means every `terraform init` can silently pull in whatever the module
author most recently pushed, including breaking changes, with no review step for the consumer.
Pinning to a Git tag or a semver constraint (`~> 2.1`) makes upgrades a deliberate, reviewed
decision instead of something that happens automatically and invisibly.

---

**Q4: How should module authors decide between a patch, minor, or major version bump?**

A: Following semantic versioning: patch for backward-compatible bug fixes, minor for
backward-compatible additions (new optional variables/outputs), and major for anything that breaks
existing consumers — removing or renaming a variable/output, or changing a default in a way that
alters existing infrastructure. The version number is a promise to consumers about what kind of
change they're getting, not a measure of how much code changed.

---

**Q5: What is a "god module" and how do you recognize one?**

A: A module that has accumulated responsibility for multiple unrelated pieces of infrastructure —
often because new resources were added to an existing module for convenience rather than given
their own scope. Symptoms include a large, sprawling variable file with many optional/unused
inputs per environment, `terraform plan` regularly showing unrelated diffs, and multiple teams
needing to review the same PR for unrelated reasons. The fix is splitting by responsibility and,
where the pieces are independently deployable, giving each its own layer and state.

---

**Q6: What's the difference between an application boundary and a deployment/blast-radius
boundary, and why does it matter for module design?**

A: An application boundary is about what code/business logic belongs together conceptually (e.g.,
"the orders service"). A deployment boundary is about what needs to change, be reviewed, and be
rolled back independently. They often don't match: the orders service's network, database, and
compute might all be "part of the same application" but should live in separate modules/layers
because they change at different rates and carry different blast radii if something goes wrong.

---

**Q7: How do you handle a module that needs to support two very different use cases — should you
add a feature flag variable?**

A: Prefer two smaller, focused modules (or one module with a genuinely optional secondary resource
governed by a clear boolean, used sparingly) over accumulating many `enable_x` flags in one module.
A module riddled with feature flags is usually a sign it's trying to be several modules at once —
the flags are doing modularization's job without giving you modularization's benefits (independent
versioning, independent reuse, smaller blast radius).
