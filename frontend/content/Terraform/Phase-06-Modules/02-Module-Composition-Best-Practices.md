# 02 — Module Composition & Best Practices

## Table of Contents

1. [Composing Multiple Modules Together](#1-composing-multiple-modules-together)
2. [Module Design Principles](#2-module-design-principles)
3. [Nested Modules](#3-nested-modules)
4. [Module Outputs as Cross-Module Glue](#4-module-outputs-as-cross-module-glue)
5. [Common Anti-Patterns](#5-common-anti-patterns)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Composing Multiple Modules Together

Lesson 01 showed you a single module in isolation. But real infrastructure is never just "one
VPC module" — it's a network layer, a compute layer, a database layer, a DNS layer, all wired
together, each depending on values the previous one produced. Imagine standing up a typical web
app on AWS: you need a VPC with subnets, then an EC2 Auto Scaling Group that launches *inside*
those subnets, then a security group that only allows traffic from *that* VPC, then a Route 53
record pointing at the load balancer *those instances* sit behind. None of these can be built
independently — each one needs to know about the last. This chaining of module inputs/outputs
across module boundaries is called **module composition**, and it's the actual day-to-day skill
of using Terraform at scale.

### Analogy

Think of an assembly line building a car. The chassis station (network module) doesn't know or
care how the engine gets built — it just bolts on whatever chassis pieces it's responsible for and
passes the result down the line. The engine station (compute module) picks up exactly where the
chassis station left off, using measurements (outputs) from the previous station as its own
inputs. No station tries to do the whole car; each does one job well and hands off a well-defined
interface to the next.

### Under the Hood

```
                        ROOT MODULE (environments/prod/main.tf)
   ┌─────────────────────────────────────────────────────────────────────┐
   │                                                                       │
   │   module "network" {                                                 │
   │     source = "../../modules/network"                                 │
   │     cidr_block = "10.2.0.0/16"                                        │
   │   }                                                                   │
   │        │                                                              │
   │        │ outputs: vpc_id, public_subnet_ids, private_subnet_ids       │
   │        ▼                                                              │
   │   module "compute" {                                                 │
   │     source    = "../../modules/compute"                              │
   │     vpc_id    = module.network.vpc_id            ◄── wired from       │
   │     subnet_ids = module.network.private_subnet_ids   network module   │
   │   }                                                                   │
   │        │                                                              │
   │        │ outputs: asg_name, load_balancer_dns_name                    │
   │        ▼                                                              │
   │   module "dns" {                                                     │
   │     source     = "../../modules/dns"                                 │
   │     lb_dns_name = module.compute.load_balancer_dns_name ◄── wired     │
   │     zone_id     = "Z0123456789ABC"                        from compute│
   │   }                                                                   │
   │                                                                       │
   └─────────────────────────────────────────────────────────────────────┘

Terraform builds a dependency graph from these references automatically:

   network  ──►  compute  ──►  dns

It applies network first (nothing depends on it), then compute (depends on network's outputs),
then dns (depends on compute's outputs) — WITHOUT you writing a single explicit depends_on.
```

Terraform infers this ordering purely from the fact that `module.compute` references
`module.network.vpc_id` in its arguments — that reference *is* the dependency. You never have to
manually sequence `terraform apply` calls per module; one `terraform apply` at the root handles
the whole graph.

### Example

```hcl
# modules/network/outputs.tf
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
```

```hcl
# modules/compute/variables.tf
variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}
```

```hcl
# modules/compute/main.tf
resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = var.vpc_id            # ← composed from the network module

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "app" {
  name               = "app-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.subnet_ids   # ← composed from the network module
  security_groups    = [aws_security_group.app.id]
}

output "load_balancer_dns_name" {
  value = aws_lb.app.dns_name
}
```

```hcl
# environments/prod/main.tf  — the composition happens HERE, at the root
module "network" {
  source     = "../../modules/network"
  cidr_block = "10.2.0.0/16"
}

module "compute" {
  source     = "../../modules/compute"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}

module "dns" {
  source      = "../../modules/dns"
  lb_dns_name = module.compute.load_balancer_dns_name
  zone_id     = "Z0123456789ABC"
}
```

### Common Confusion

A common misconception is that modules can discover each other automatically — e.g., that a
"compute" module could somehow "find" the VPC created by a "network" module without being told.
There is no implicit discovery mechanism. Composition only ever happens in the root module (or
whatever module is doing the calling), by explicitly wiring `module.a.some_output` into
`module.b`'s input arguments. If you don't wire it, the two modules know nothing about each other.

### Interview Answer

"Module composition means building a larger system out of smaller, independent modules by
wiring one module's outputs into another module's inputs — for example, a network module's
`vpc_id` output feeding into a compute module's `vpc_id` input. Terraform automatically infers
the dependency graph and apply order from these references, so you never need explicit
`depends_on` for straightforward output-to-input wiring. All the composition logic lives in
whichever module is doing the calling — usually the root module — since modules cannot discover
each other on their own."

> **Memory hook:** Composition is an assembly line — each station only knows the measurements handed to it by the station before, and passes its own result to the next.

---

## 2. Module Design Principles

Once you start writing more than one or two modules, a design question creeps in: how big should
a module be? Should "network" and "compute" be one module, or two? Should every possible knob be
exposed as a variable, just in case someone needs it someday? Get this wrong and you end up with
either a sprawling "god module" that's impossible to reuse partially, or a module with forty
required variables that nobody wants to call because it's such a chore to configure. Three
principles keep modules healthy over time.

### Analogy

Think of a good module like a well-designed kitchen appliance — a toaster. A toaster does one
thing (toasts bread) and does it well; it has a small number of sensible controls (darkness
dial), and it comes with sane factory defaults (medium setting) so you don't *have* to configure
anything to get a reasonable result. A bad module is like a single appliance that claims to
toast bread, blend smoothies, and also do your taxes — you can't buy "just the toaster part," and
you need a 40-page manual before you can safely turn it on.

### Under the Hood — The Three Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. SINGLE RESPONSIBILITY                                                │
│    One module = one clear piece of infrastructure ("a VPC", "an RDS     │
│    instance", "an ECS service") — not "everything for the app."         │
│                                                                          │
│ 2. SENSIBLE DEFAULTS                                                    │
│    Every variable that CAN have a reasonable default SHOULD have one.   │
│    Only force the caller to supply values that are genuinely unique     │
│    per-environment (e.g. cidr_block, environment name).                 │
│                                                                          │
│ 3. AVOID OVER-PARAMETERIZATION                                          │
│    Don't expose every underlying provider argument as a module          │
│    variable "just in case." Each new variable is a permanent piece of   │
│    the module's public interface you now have to maintain forever.      │
└────────────────────────────────────────────────────────────────────────┘
```

### Example — Single Responsibility (Bad vs Good)

```hcl
# BAD: one "app" module trying to do everything
module "app" {
  source = "../../modules/app"

  vpc_cidr        = "10.2.0.0/16"
  instance_type   = "t3.large"
  db_engine       = "postgres"
  db_instance_class = "db.t3.medium"
  hosted_zone_id  = "Z0123456789ABC"
  # ... 40 more variables covering network, compute, database, and DNS
}
```

```hcl
# GOOD: split by responsibility, composed at the root
module "network" {
  source     = "../../modules/network"
  cidr_block = "10.2.0.0/16"
}

module "database" {
  source        = "../../modules/rds-postgres"
  vpc_id        = module.network.vpc_id
  subnet_ids    = module.network.private_subnet_ids
  instance_class = "db.t3.medium"
}

module "compute" {
  source     = "../../modules/compute"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
  instance_type = "t3.large"
}

module "dns" {
  source      = "../../modules/dns"
  zone_id     = "Z0123456789ABC"
  lb_dns_name = module.compute.load_balancer_dns_name
}
```

Now anyone who only needs a standalone Postgres instance can call `modules/rds-postgres` on its
own, without dragging in compute or DNS resources they don't need.

### Example — Sensible Defaults + Avoiding Over-Parameterization

```hcl
# modules/rds-postgres/variables.tf
variable "environment" {
  type        = string
  description = "Environment name, e.g. dev, staging, prod"
  # no default — genuinely different per caller, MUST be supplied
}

variable "vpc_id" {
  type        = string
  description = "VPC to launch the RDS instance in"
  # no default — genuinely different per caller
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.micro"       # sensible default — most callers won't override this
}

variable "allocated_storage" {
  type        = number
  description = "Storage in GB"
  default     = 20                   # sensible default
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for high availability"
  default     = false                 # sensible default — prod callers explicitly opt in
}

# NOT exposed as a variable: storage_type, backup_window, maintenance_window,
# parameter_group_family, etc. — these are set to good fixed values INSIDE the module.
# If a real caller genuinely needs to override one, add that ONE variable when the
# need actually arises — don't pre-guess every possible knob up front.
```

### Common Anti-Patterns (Design-Level)

- **The "god module"** — one module that creates network + compute + database + DNS. Impossible
  to reuse any single piece; every unrelated change forces a plan/apply touching everything.
- **The "40-variable module"** — exposing every underlying resource argument as a pass-through
  variable "just in case." This makes the module exhausting to call and just as hard to maintain
  as *not* using a module at all.
- **No defaults anywhere** — forcing every caller to specify every variable explicitly, even ones
  that are almost always the same value (e.g., `port = 5432` for Postgres). Add sensible defaults
  and let callers override only what's actually different for them.

### Interview Answer

"Well-designed modules follow single responsibility — one module represents one coherent piece of
infrastructure, like a VPC or an RDS instance, not an entire application stack. They provide
sensible defaults for anything that's usually the same across callers, so consumers only have to
supply values that are genuinely unique to their environment. And they avoid over-parameterization
— not every underlying provider argument needs to be exposed as a module variable; each exposed
variable is a permanent maintenance commitment, so you add it when a real need arises rather than
speculatively."

> **Memory hook:** Build a toaster, not a Swiss Army kitchen — one job, done well, with sane defaults so you don't need the manual just to make toast.

---

## 3. Nested Modules

Sometimes a single logical unit of infrastructure is itself made up of smaller reusable pieces.
Say your "network" module needs both a VPC *and* a set of VPC endpoints for S3/DynamoDB — and you
already have a standalone `vpc-endpoints` module used elsewhere in the company. Rather than
copy-pasting the VPC endpoint resources into your network module, your network module can itself
call the `vpc-endpoints` module. A module calling another module is a **nested module** — and it's
completely normal, though it comes with one important caveat: the calling module's own consumers
never see the nested module directly.

### Analogy

Think of nested modules like subcontracting on a construction project. The general contractor
(your "network" module) is hired to build the whole site, but they subcontract the electrical
work out to a specialist electrician (the "vpc-endpoints" module). The client who hired the
general contractor never talks to the electrician directly — they only see the finished result
the general contractor hands over. If the client wants something changed about the electrical
work, they go through the general contractor, not around them.

### Under the Hood

```
                     environments/prod/main.tf   (ROOT MODULE)
                              │
                              │ calls
                              ▼
                     modules/network/            (CHILD MODULE, called by root)
                     ├── main.tf
                     │     module "vpc_endpoints" {          ← NESTED module call,
                     │       source = "../vpc-endpoints"        made FROM WITHIN
                     │       vpc_id = aws_vpc.main.id            modules/network
                     │     }
                     ├── variables.tf
                     └── outputs.tf
                              │
                              │ calls
                              ▼
                     modules/vpc-endpoints/       (GRANDCHILD MODULE relative to root)
                     ├── main.tf   (aws_vpc_endpoint resources)
                     └── outputs.tf

State address from the root's point of view:
   module.network.module.vpc_endpoints.aws_vpc_endpoint.s3
   └────┬─────┘ └───────┬────────┘
     child module    nested (grandchild) module
```

The root module (`environments/prod`) never writes `module "vpc_endpoints"` itself — it only ever
sees `module.network`. Whatever `modules/network` chooses to expose via its own `output` blocks
is all the root gets to see; the fact that some of the work was subcontracted to
`modules/vpc-endpoints` is an internal implementation detail of the network module.

### Example

```hcl
# modules/network/main.tf
resource "aws_vpc" "main" {
  cidr_block = var.cidr_block
}

module "vpc_endpoints" {
  source = "../vpc-endpoints"          # nested module call, relative to modules/network

  vpc_id     = aws_vpc.main.id
  route_table_ids = aws_route_table.private[*].id
  services   = ["s3", "dynamodb"]
}
```

```hcl
# modules/network/outputs.tf
output "vpc_id" {
  value = aws_vpc.main.id
}

# Re-expose a nested module's output through this module's own interface, if callers need it
output "vpc_endpoint_ids" {
  value = module.vpc_endpoints.endpoint_ids
}
```

```hcl
# environments/prod/main.tf — the root only ever sees module.network's interface
module "network" {
  source     = "../../modules/network"
  cidr_block = "10.2.0.0/16"
}

# This works — network re-exposed it:
output "s3_endpoint_ids" {
  value = module.network.vpc_endpoint_ids
}

# This does NOT work — root can't reach the grandchild directly:
# output "broken" {
#   value = module.network.module.vpc_endpoints.endpoint_ids
# }
```

### Common Confusion

People sometimes assume a root module can reach two levels deep into module outputs, like
`module.network.module.vpc_endpoints.endpoint_ids`. It cannot — Terraform configuration syntax
doesn't allow reaching through a module boundary more than one level. If the root needs a value
produced by a nested (grandchild) module, the *middle* module (`network`, in this example) must
explicitly re-expose it via its own `output` block, as shown above. Nesting doesn't flatten
automatically — each module boundary only shows exactly what it chooses to.

### Interview Answer

"A nested module is simply a module block declared inside another module, rather than in the
root. It's useful when a reusable sub-pattern (like a set of VPC endpoints) is itself needed by
multiple parent modules. The key constraint is visibility: the root module only ever sees the
outputs of the module it directly calls — if the root needs a value produced by a grandchild
module, the parent module must explicitly re-declare that value as one of its own outputs. There's
no way to reach two module levels deep in a single reference."

> **Memory hook:** Nested modules are subcontractors — the client only ever talks to the general contractor, never straight to the sub's crew.

---

## 4. Module Outputs as Cross-Module Glue

By now you've seen outputs feed into other modules' variables several times — this section makes
that pattern explicit as a design tool in its own right, because it's *the* mechanism you'll use
constantly once you have more than two or three modules. Think of every module's `outputs.tf` file
not as an afterthought, but as a contract you are actively designing: "here is everything a future
caller might legitimately need to build something on top of what I created."

### Analogy

A module's outputs are like the specification sheet that comes with a purchased part in a
hardware store — bolt diameter, thread pitch, load rating. You don't need to cut the bolt open to
know if it'll fit; the spec sheet (outputs) tells you everything you need to combine it correctly
with other parts. A module with poor or missing outputs is like a bolt sold with no spec sheet at
all — technically usable, practically useless for building anything on top of it.

### Under the Hood

```
Good outputs.tf anticipates what OTHER modules will plausibly need:

modules/network/outputs.tf
├── vpc_id                    ← needed by: compute, database, dns modules
├── public_subnet_ids         ← needed by: compute (public-facing instances/LBs)
├── private_subnet_ids        ← needed by: compute (internal instances), database
├── vpc_cidr_block             ← needed by: security group rules referencing "my own VPC"
└── nat_gateway_ips            ← needed by: allow-listing on third-party APIs

If you only expose vpc_id and nothing else, every module composed with "network" that
needs a subnet ID has to duplicate subnet-lookup logic itself (e.g. a data source query) —
instead of just reading module.network.private_subnet_ids directly.
```

### Example

```hcl
# modules/network/outputs.tf — designed with downstream consumers in mind
output "vpc_id" {
  description = "VPC ID — needed by any module launching resources inside this network"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR — used by security groups to allow traffic from within the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs — for internet-facing load balancers"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs — for application servers and databases"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_public_ips" {
  description = "Elastic IPs of NAT gateways — for allow-listing with third-party APIs"
  value       = aws_eip.nat[*].public_ip
}
```

```hcl
# environments/prod/main.tf — every downstream module reads exactly what it needs
module "network" {
  source     = "../../modules/network"
  cidr_block = "10.2.0.0/16"
}

module "database" {
  source     = "../../modules/rds-postgres"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}

resource "aws_security_group" "db_sg" {
  vpc_id = module.network.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.network.vpc_cidr_block]   # "allow anything inside my own VPC"
  }
}
```

### Common Anti-Patterns

- **Under-exposing outputs**, forcing consumers to re-derive values with `data` source lookups
  instead of simply reading a module output that was one line away from existing.
- **Exposing raw provider resource objects wholesale** instead of specific attributes — e.g.
  outputting an entire `aws_vpc.main` object rather than just `aws_vpc.main.id`. This leaks
  implementation detail and breaks the moment the module's internal resource changes shape.
- **No `description` on outputs**, leaving consumers to guess what a value actually represents by
  reading the module's internals instead of its documented interface.

### Interview Answer

"Outputs aren't just a way to print a value at the end of `terraform apply` — they're the
designed public interface between modules, and the main mechanism for composing multiple modules
together. A well-designed module anticipates what other modules will plausibly need (VPC ID,
subnet IDs, CIDR blocks) and exposes exactly those values, each with a clear description, so
downstream modules or root-level resources can consume them directly instead of re-deriving the
same information with redundant data source lookups."

> **Memory hook:** Outputs are the spec sheet on a hardware store part — design them so the next builder never has to cut the part open to see what's inside.

---

## 5. Common Anti-Patterns

A consolidated list of composition-level mistakes worth watching for as your module tree grows.

| Anti-Pattern | Symptom | Better Approach |
|--------------|---------|------------------|
| God module doing network + compute + database + DNS | Any small change re-plans the entire stack; nothing is independently reusable | Split by single responsibility; compose at the root |
| Over-parameterized module (30+ variables) | Nobody wants to call it; every caller copy-pastes a huge block of arguments | Keep required variables minimal; give the rest sane defaults |
| Reaching two levels into nested module outputs | `module.a.module.b.output` — invalid syntax, fails validation | Have the parent module re-expose the value as its own output |
| Hardcoded provider config inside a child module | Module can't be reused in a different region/account | Provider blocks stay in the root; module inherits provider config |
| Duplicating subnet/VPC lookups with `data` sources instead of using existing module outputs | Two sources of truth for the same infrastructure; drift risk | Consume the network module's outputs directly |
| No composition boundary at all — every resource in one flat root `main.tf` | Impossible to reason about or reuse any part of the stack | Introduce modules along natural seams (network, compute, database, DNS) as the config grows |

> **Memory hook:** Every composition anti-pattern boils down to breaking the "single responsibility + clean interface" rule somewhere — fix the rule, the symptom disappears.

---

## 6. Hands-On Exercises

**Exercise 1 — Compose Two Modules**
Build a `modules/network` module (VPC + 2 subnets) and a `modules/compute` module (a security
group + one `aws_instance`). Wire `module.network`'s `vpc_id` and subnet output into
`module.compute`'s inputs from a root module. Run `terraform graph` and inspect the dependency
order between the two modules.

**Exercise 2 — Split a God Module**
You're given (hypothetically) a single module that creates a VPC, an RDS instance, and an EC2
Auto Scaling Group all in one `main.tf`. Refactor it into three single-responsibility modules
(`network`, `database`, `compute`) composed together in a root module. List which outputs each
new module needs to expose to make the composition work.

**Exercise 3 — Build a Nested Module**
Create a small `modules/vpc-endpoints` module, then call it *from within* your `modules/network`
module (nested, not from the root). Re-expose one of its outputs through `modules/network`'s own
`outputs.tf`, and consume that value from the root module.

**Exercise 4 — Design an Outputs Interface**
For a hypothetical `modules/rds-postgres` module, write out an `outputs.tf` with at least four
outputs you believe downstream modules/resources would plausibly need (e.g., endpoint address,
port, security group ID). Justify each one in a one-line comment.

**Exercise 5 — Spot the Anti-Pattern**
Given this snippet, identify at least two anti-patterns from the table in section 5 and rewrite it
correctly:
```hcl
module "everything" {
  source              = "../../modules/everything"
  vpc_cidr            = "10.0.0.0/16"
  db_engine           = "postgres"
  db_instance_class   = "db.t3.medium"
  instance_type       = "t3.large"
  desired_capacity    = 3
  hosted_zone_id      = "Z0123456789ABC"
  enable_nat_gateway  = true
  enable_flow_logs    = true
  # ... 25 more arguments
}
```

---

## 7. Interview Q&A

---

**Q1: What is module composition?**

A: Module composition is building a larger infrastructure system out of smaller, independent
modules by wiring one module's outputs into another module's inputs — for example, feeding a
network module's `vpc_id` output into a compute module's `vpc_id` variable. Terraform
automatically derives the dependency graph and apply order from these references.

---

**Q2: What's the "single responsibility" principle for Terraform modules?**

A: A module should represent one coherent, independently reusable piece of infrastructure — a
VPC, a database instance, a compute cluster — rather than an entire application's full stack.
This keeps each module small, testable, and reusable in contexts where you only need part of the
whole system.

---

**Q3: What is a nested module, and what's the key limitation when consuming its outputs?**

A: A nested module is a `module` block declared inside another module rather than in the root.
The key limitation is that the root (or any calling module) can only see the outputs of the
module it directly calls — it cannot reach two levels deep (e.g.
`module.network.module.vpc_endpoints.output_name` is invalid). If a grandparent module needs a
nested module's value, the parent module must explicitly re-expose it through its own `output`
block.

---

**Q4: Why is over-parameterizing a module considered an anti-pattern?**

A: Every variable exposed on a module is a permanent part of its public interface that must be
documented, maintained, and considered on every future change. Exposing every possible underlying
provider argument "just in case" makes the module exhausting to call (callers must specify many
values) and just as hard to maintain long-term as not modularizing at all. Add variables when a
real need arises, not speculatively.

---

**Q5: How does Terraform decide the order to apply multiple composed modules in?**

A: Terraform builds an implicit dependency graph from references between modules — if
`module.compute` uses `module.network.vpc_id` as an input, Terraform knows `network` must be
applied first. This happens automatically from the reference itself; you don't need `depends_on`
for ordinary output-to-input composition, only for dependencies that aren't visible through direct
references (e.g. an IAM policy that must exist before an unrelated resource is created).
