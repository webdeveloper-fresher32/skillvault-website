# 03 — Terraform Workflow & Core Concepts

## Table of Contents

1. [The Core Workflow: Write → Init → Plan → Apply → Destroy](#1-the-core-workflow-write--init--plan--apply--destroy)
2. [Understanding `terraform plan` Output](#2-understanding-terraform-plan-output)
3. [HCL Syntax Basics](#3-hcl-syntax-basics)
4. [File Layout Conventions](#4-file-layout-conventions)
5. [Idempotency Explained](#5-idempotency-explained)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Core Workflow: Write → Init → Plan → Apply → Destroy

Imagine you're about to perform surgery — you wouldn't want to just start cutting. You'd want to
see an X-ray first, confirm exactly where you're cutting and why, get a second opinion, and only
then proceed. Terraform's workflow is built around exactly this instinct for infrastructure
changes: never blindly execute a change against production. Instead, you always get to *see the
plan* — a precise preview of every create, update, and destroy — before anything actually happens.

### Analogy

Think of the five steps as: **Write** (draw the blueprint), **Init** (gather your tools and
materials), **Plan** (walk the site with the blueprint and mark exactly what will be built, torn
down, or changed, without touching anything yet), **Apply** (actually do the construction), and
**Destroy** (demolish it when you no longer need it). A responsible contractor never skips the
"walk the site and mark it up" step before swinging a hammer — and neither should you, with
production infrastructure.

### Under the Hood: The Full Loop

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌────────────┐
│  1.WRITE │──▶│ 2. INIT  │──▶│ 3. PLAN  │──▶│ 4. APPLY  │──▶│ 5. DESTROY │
│  .tf     │   │ download │   │ diff     │   │ execute   │   │ tear down  │
│  files   │   │ providers│   │ desired  │   │ the diff, │   │ (optional, │
│          │   │ + state  │   │ vs       │   │ update    │   │ when done) │
│          │   │ backend  │   │ actual   │   │ state     │   │            │
└──────────┘   └──────────┘   └──────────┘   └───────────┘   └────────────┘
                                                    │
                                                    ▼
                                          Real AWS resources exist
```

### Full Walkthrough Example: One AWS Resource

**Step 1 — Write.** Create `main.tf`:

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

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "web-server"
  }
}
```

**Step 2 — Init.**

```bash
$ terraform init
Initializing provider plugins...
- Installing hashicorp/aws v5.55.0...
Terraform has been successfully initialized!
```

**Step 3 — Plan.**

```bash
$ terraform plan
Terraform will perform the following actions:

  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami           = "ami-0c55b159cbfafe1f0"
      + instance_type = "t3.micro"
      + id            = (known after apply)
      + public_ip     = (known after apply)
      + tags          = {
          + "Name" = "web-server"
        }
      # ... many computed attributes elided for brevity
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

**Step 4 — Apply.**

```bash
$ terraform apply

  # (same plan shown again)

Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes

aws_instance.web: Creating...
aws_instance.web: Still creating... [10s elapsed]
aws_instance.web: Creation complete after 24s [id=i-0abc123def456789]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
```

At this point a real EC2 instance is running in your AWS account, and `terraform.tfstate` now
contains its instance ID, so Terraform will recognize it as "already exists" on every future run.

**Step 5 — Destroy** (when you're done, e.g. tearing down a sandbox environment).

```bash
$ terraform destroy
  # aws_instance.web will be destroyed
  - resource "aws_instance" "web" { ... }

Plan: 0 to add, 0 to change, 1 to destroy.

Do you really want to destroy all resources?
  Enter a value: yes

aws_instance.web: Destroying... [id=i-0abc123def456789]
aws_instance.web: Destruction complete after 3s

Destroy complete! Resources: 0 added, 0 changed, 1 destroyed.
```

### Common Confusion

New users sometimes run `terraform apply` immediately without ever inspecting a `plan`, treating
it as "just the command that does the thing." In fact `apply` internally always generates a plan
first and shows it to you for confirmation (unless you pass `-auto-approve`, which skips the
confirmation prompt entirely). In production pipelines it's standard practice to run `plan` as a
separate step whose output a human reviews — often as a comment on a pull request — *before*
anyone runs `apply`, precisely so a mistake can be caught on paper before it touches real
infrastructure.

### Interview Answer

"The core Terraform workflow is write, init, plan, apply, and optionally destroy. You write HCL
describing desired infrastructure, run `init` once to download providers, run `plan` to preview
exactly what will be created, changed, or destroyed without making any real changes, run `apply`
to execute that plan after confirmation, and run `destroy` to tear resources down when they're no
longer needed. The critical safety property is that `plan` is a dry run — nothing touches real
infrastructure until `apply` is explicitly confirmed."

> **Memory hook:** Write the blueprint, gather your tools, walk the site with a red pen before touching anything, then build — and only demolish when you actually mean to.

---

## 2. Understanding `terraform plan` Output

You've run `terraform plan` and you're staring at a wall of `+`, `-`, and `~` symbols and lines
like `(known after apply)`. This output is arguably the single most important piece of text in
the entire Terraform workflow — it's your last chance to catch a mistake before it becomes a real
outage. Learning to read it fluently is a core skill, not an afterthought.

### Analogy

Reading a `plan` output is like reading a track-changes document in Google Docs before accepting
the edits — green additions, red deletions, and highlighted modifications, all visible before you
click "accept all." You'd never accept track-changes edits without skimming them first; treat
`terraform plan` the same way.

### The Symbol Vocabulary

| Symbol | Meaning | Example |
|--------|---------|---------|
| `+` | Resource will be **created** | `+ resource "aws_instance" "web"` |
| `-` | Resource will be **destroyed** | `- resource "aws_instance" "old"` |
| `~` | Resource will be **updated in-place** | `~ instance_type = "t2.micro" -> "t3.micro"` |
| `-/+` | Resource will be **destroyed and recreated** (a forced replacement) | changing an attribute that can't be updated in-place, e.g. `availability_zone` |
| `(known after apply)` | Value can't be known until the real API responds (e.g. an auto-assigned ID or IP) | `+ id = (known after apply)` |

### Under the Hood: Where the Diff Comes From

```
┌────────────────────────┐        ┌────────────────────────┐
│   DESIRED STATE          │        │    ACTUAL STATE          │
│   (your .tf files,        │        │   (real infra, read via   │
│    parsed by Core)        │        │   provider API refresh)   │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │                                   │
             └───────────────┬───────────────────┘
                             ▼
                  ┌────────────────────┐
                  │   DIFF ENGINE        │
                  │  (Terraform Core)     │
                  │  compares attribute-  │
                  │  by-attribute         │
                  └──────────┬─────────┘
                             ▼
              Plan output: create / update / destroy / replace
```

Before computing the diff, Terraform performs a **refresh** — it queries the real provider API for
the current values of every resource already in state, so the "actual state" side of the
comparison reflects reality right now, not just what state *thinks* is true (which matters if
someone changed something manually outside of Terraform).

### Example: A Forced Replacement

```hcl
resource "aws_instance" "web" {
  ami               = "ami-0c55b159cbfafe1f0"
  instance_type     = "t3.micro"
  availability_zone = "us-east-1a"   # changing this forces replacement
}
```

If you change `availability_zone` to `"us-east-1b"` and re-plan:

```
  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
      ~ availability_zone = "us-east-1a" -> "us-east-1b" # forces replacement
      ~ id                = "i-0abc123" -> (known after apply)
        # ... other attributes unchanged
    }

Plan: 1 to add, 0 to change, 1 to destroy.
```

The `-/+` and "forces replacement" comment tell you *exactly* why Terraform can't just update the
instance in place — some AWS attributes (like AZ) are immutable on an existing instance and
require destroying the old one and creating a new one.

### Common Mistakes

- **Skimming past "1 to destroy" without reading which resource** — in a large plan touching many
  resources, it's easy to miss that a database, not a throwaway test instance, is the one being
  destroyed. Always read the resource *addresses*, not just the summary counts.
- **Assuming `-/+` means "no data loss risk"** — for stateful resources (databases, EBS volumes)
  a forced replacement can mean real data loss unless you've planned for it (e.g., snapshots,
  `prevent_destroy` lifecycle rules).
- **Ignoring `(known after apply)` and assuming a value is wrong** — it's not wrong, it's simply
  not computable until AWS actually assigns it (e.g., a public IP address); this is expected and
  normal for many attributes.

### Interview Answer

"`terraform plan` shows a symbol-annotated diff between desired configuration and real current
state: `+` for create, `-` for destroy, `~` for an in-place update, and `-/+` for a destroy-and-
recreate forced by changing an attribute that can't be modified without replacing the resource.
Before computing this diff Terraform refreshes its view of real infrastructure via the provider
API, so the comparison reflects current reality, not stale state. Reading plan output carefully —
especially spotting forced replacements on stateful resources — is the main safeguard against
accidental data loss."

> **Memory hook:** `plan` is track-changes for your infrastructure — read every colored line before you click "accept all."

---

## 3. HCL Syntax Basics

You open a `.tf` file for the first time and see `resource`, curly braces, and `=` signs that
look almost like JSON but not quite. HCL (HashiCorp Configuration Language) was deliberately
designed to sit between raw JSON (machine-friendly, painful for humans to hand-write) and a full
programming language (powerful, but risks the exact non-determinism and complexity that
declarative IaC tries to avoid). Learning its handful of core building blocks unlocks the ability
to read essentially any Terraform config you'll ever encounter.

### Analogy

If JSON is a strict form with no comments allowed and every quotation mark mandatory, and Python
is a full workshop with every power tool imaginable, HCL is a well-designed intake form: labeled
fields (blocks), fill-in-the-blank values (arguments), the ability to reference an earlier answer
on the same form (expressions), and margin notes allowed (comments) — structured enough to be
machine-parsed reliably, flexible enough to write by hand comfortably.

### The Building Blocks

**Blocks** — the fundamental unit of HCL. A block has a *type*, optional *labels*, and a body in
`{ }`.

```hcl
resource "aws_instance" "web" {
  # block type: resource
  # labels: "aws_instance" (the resource type), "web" (the local name)
  # body: everything inside { }
}
```

**Arguments** — `name = value` pairs inside a block body.

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"   # argument: ami
  instance_type = "t3.micro"                 # argument: instance_type
}
```

**Expressions** — values on the right side of `=` aren't limited to string/number literals; they
can reference other resources, variables, or use built-in functions.

```hcl
resource "aws_instance" "web" {
  ami                    = data.aws_ami.latest.id            # reference to a data source
  instance_type          = var.instance_size                  # reference to a variable
  subnet_id              = aws_subnet.public.id                # reference to another resource
  vpc_security_group_ids = [aws_security_group.web_sg.id]      # a list expression
  user_data              = base64encode(file("init.sh"))       # function calls
}
```

**Comments** — three supported styles:

```hcl
# single-line comment (preferred style)
// also single-line (also valid, less common in Terraform community style)
/* multi-line
   comment block */
```

**Identifiers and References** — every resource has an address: `<TYPE>.<LOCAL_NAME>`. You
reference its attributes elsewhere as `<TYPE>.<LOCAL_NAME>.<ATTRIBUTE>`.

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id        # reference: aws_vpc.main's "id" attribute
  cidr_block = "10.0.1.0/24"
}
```

### Under the Hood

```
resource "aws_instance" "web" {
   │        │              │    │
   │        │              │    └── body: arguments + nested blocks
   │        │              └─────── label 2: local name (how YOU refer to it in this config)
   │        └────────────────────── label 1: resource TYPE (defined by the provider schema)
   └─────────────────────────────── block type: tells Terraform Core what kind of block this is
```

Terraform Core parses every `.tf` file in a directory (order doesn't matter — HCL files in the
same directory are merged into one configuration), builds a graph from every reference between
blocks (e.g., `aws_subnet.public` depends on `aws_vpc.main` because it references
`aws_vpc.main.id`), and uses that graph to determine creation order.

### Comparison: HCL vs JSON vs a General-Purpose Language

| Property | HCL | JSON | Python/TypeScript (Pulumi-style) |
|----------|-----|------|-----------------------------------|
| Comments allowed | Yes | No | Yes |
| Designed for human editing | Yes (primary goal) | No (data interchange format) | Yes |
| Loops/conditionals | Yes (`count`, `for_each`, `for` expressions, `dynamic` blocks) | No | Yes (native language constructs) |
| Machine-parsed reliably | Yes | Yes | Requires running the actual language runtime |
| Terraform also accepts it directly | Yes (native) | Yes (`.tf.json` — rare, tooling-generated) | No (that's Pulumi, a different tool) |

### Common Confusion

Beginners sometimes think the second label in `resource "aws_instance" "web"` is an AWS-visible
name (like the EC2 console "Name" tag). It is not — it's purely a *local* identifier used only
within your Terraform configuration to reference this resource elsewhere (`aws_instance.web.id`).
The actual AWS-visible name, if you want one, must be set explicitly via a `tags = { Name = "..."
}` argument, as shown in section 1.

### Interview Answer

"HCL configurations are built from blocks — a type, optional labels, and a body of arguments in
braces. A `resource` block's two labels are the resource type (defined by the provider) and a
local name you choose, used only to reference that resource elsewhere in the same configuration,
for example `aws_subnet.public.vpc_id` referencing `aws_vpc.main.id`. Arguments can hold literal
values or expressions — references to other resources, variables, data sources, or function
calls — and those references are exactly what Terraform uses to build its dependency graph."

> **Memory hook:** HCL is a form: blocks are labeled sections, arguments are fill-in-the-blank fields, and expressions let one answer point back to an earlier one on the same form.

---

## 4. File Layout Conventions

Every real Terraform project you'll open — from a two-person startup's repo to a HashiCorp
official example — uses roughly the same handful of file names. This isn't enforced by the
Terraform binary (you could put everything in one file called `whatever.tf` and it would work
identically), but the convention is so universal that deviating from it makes a codebase harder
for any new contributor to navigate.

### Analogy

This is exactly like a standard project layout in any language ecosystem — a Node.js project
"just works" with all code crammed into one `index.js`, but every real project separates
`routes/`, `models/`, `config/` because a predictable layout means any engineer can open an
unfamiliar repo and immediately know where to look for what.

### The Standard Files

```
my-project/
├── main.tf          # primary resource definitions
├── variables.tf     # input variable declarations (the "parameters" of this config)
├── outputs.tf        # output value declarations (values exposed after apply)
├── providers.tf      # provider + required_providers configuration
├── versions.tf       # (sometimes split out) terraform { required_version = ... } block
├── terraform.tfvars  # actual values assigned to variables (often gitignored if sensitive)
└── .terraform.lock.hcl
```

Terraform itself does not care what you name these files — it reads and merges *every* `.tf` file
in a directory as if it were one giant file. The names above are purely a human convention (though
extremely strongly followed).

### Example: How the Pieces Connect

```hcl
# variables.tf
variable "instance_type" {
  description = "EC2 instance type for the web server"
  type        = string
  default     = "t3.micro"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
}
```

```hcl
# main.tf
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type

  tags = {
    Name        = "web-server"
    Environment = var.environment
  }
}
```

```hcl
# outputs.tf
output "instance_public_ip" {
  description = "Public IP address of the web server"
  value       = aws_instance.web.public_ip
}
```

```hcl
# terraform.tfvars
environment = "staging"
```

Running `terraform apply` here uses `t3.micro` (the default from `variables.tf`, since
`terraform.tfvars` doesn't override it), tags the instance `Environment = "staging"`, and after
apply prints the resulting public IP because of the `output` block.

### Under the Hood

```
┌─────────────────────────────────────────────────────────────────┐
│  Terraform Core reads EVERY *.tf file in the directory            │
│  and merges them into ONE logical configuration graph.             │
│                                                                     │
│  variables.tf  ──┐                                                 │
│  main.tf        ──┼──► merged configuration ──► dependency graph   │
│  outputs.tf     ──┤                                                 │
│  providers.tf   ──┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This is why splitting files by convention is purely for *human* readability — Terraform behaves
identically whether you have five well-named files or one 2,000-line `everything.tf`.

### Comparison: Small Project vs Larger Project Layout

| Project size | Typical layout |
|--------------|-----------------|
| Small / learning project | `main.tf`, `variables.tf`, `outputs.tf` in one flat directory |
| Growing project | Above, plus `providers.tf` and `terraform.tfvars`, still one directory per environment |
| Larger, multi-team project | Reusable `modules/` directory, with thin `environments/dev`, `environments/staging`, `environments/prod` directories each calling shared modules with different variable values (covered in a later phase) |

### Common Mistakes

- **Putting real secrets directly in `terraform.tfvars` and committing it** — treat this file the
  same as any other credentials file; if it contains sensitive values, gitignore it and instead
  use `*.auto.tfvars` patterns intentionally, environment variables (`TF_VAR_environment=staging`),
  or a secrets manager.
- **Believing file names have special meaning to Terraform** — they don't; `main.tf` is a
  convention, not a keyword. You could rename it `resources.tf` and nothing would break — but
  don't, for the sake of every future reader.
- **Cramming unrelated resources for multiple environments into one giant file with no
  separation** — this doesn't break Terraform, but it makes review, blast-radius reasoning, and
  onboarding much harder as a project grows.

### Interview Answer

"Terraform doesn't enforce file names — it merges every `.tf` file in a directory into one
configuration. But the community convention of `main.tf` for resources, `variables.tf` for
inputs, `outputs.tf` for exposed values, and `providers.tf` for provider configuration is followed
almost universally because it makes any unfamiliar Terraform project immediately navigable, the
same way a standard project layout helps in any language ecosystem."

> **Memory hook:** Terraform doesn't care what you name your files — it reads them all as one — but everyone still uses `main.tf`/`variables.tf`/`outputs.tf` for the same reason every codebase has a predictable folder structure: so a stranger can find their way around instantly.

---

## 5. Idempotency Explained

Here's a scenario that should make you nervous if you're used to imperative scripts: you run
`terraform apply`, it succeeds, and then — by accident, or because a CI job retried after a
timeout — you run `terraform apply` again with the exact same configuration. Does it create a
*second* EC2 instance? If you're used to `aws ec2 run-instances` in a bash script, the answer
would be yes — that command has no memory and will happily create a duplicate every time you run
it. Terraform's answer is no, and the reason it can promise that is a property called
**idempotency**.

### Analogy

Idempotency is like a thermostat set to 70°F. Whether you "run" that thermostat once, or a
thousand times, the room settles at 70°F — running it again when the room is already 70°F does
nothing, because the thermostat's job was never "turn on the heater," it was "make sure the room
is 70°F." Terraform apply behaves the same way: its job is never literally "run these API calls,"
it's "make sure reality matches this configuration" — and if reality already matches, there's
nothing left to do.

### Under the Hood

```
Run 1: terraform apply
  Desired: 1x aws_instance (t3.micro)     Actual (state): none exists
  Diff: 1 to create
  → Creates the instance. State now records it.

Run 2: terraform apply (same config, run again immediately)
  Desired: 1x aws_instance (t3.micro)     Actual (state): 1x exists, matches exactly
  Diff: 0 to create, 0 to change, 0 to destroy
  → "No changes. Your infrastructure matches the configuration."

Run 3: terraform apply (after changing instance_type to "t3.small")
  Desired: 1x aws_instance (t3.small)     Actual (state): 1x exists (t3.micro)
  Diff: 1 to update in-place (instance_type is updatable without replacement)
  → Updates ONLY the instance_type. Does not recreate. Does not touch anything else.
```

This is only possible because of the state file (lesson 01, section 4): Terraform always knows
what it already created, so re-running the same configuration is safe — it computes "nothing left
to do" instead of blindly repeating creation calls.

### Example: Contrast With a Non-Idempotent Script

```bash
# NOT idempotent — running this twice creates TWO instances
aws ec2 run-instances --image-id ami-0c55b159cbfafe1f0 --instance-type t3.micro
```

```hcl
# Idempotent — running `terraform apply` twice results in exactly ONE instance,
# whether you apply it once or a hundred times
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}
```

### Comparison: Idempotent vs Non-Idempotent Operations

| Operation | Idempotent? | Why |
|-----------|-------------|-----|
| `terraform apply` (same config, run repeatedly) | Yes | Diffs desired vs. actual state; converges, doesn't repeat |
| `aws ec2 run-instances` (run repeatedly, no check) | No | Creates a new instance every single call, with no memory of prior calls |
| `PUT /users/123 {"name": "Alice"}` (REST API) | Yes | Setting the same value repeatedly leaves the resource in the same end state |
| `POST /users` (create a new user, REST API) | No | Each call typically creates a new user record with a new ID |
| SQL `UPDATE users SET active = true WHERE id = 5` | Yes | Running it once or a hundred times leaves `active` as `true` |
| SQL `INSERT INTO users (...) VALUES (...)` (no uniqueness constraint) | No | Running it N times inserts N duplicate rows |

### Common Mistakes

- **Assuming idempotency means "nothing ever changes on a second run"** — it means the *end
  state* converges to what's desired, not that zero work ever happens. If you changed the config
  between runs, the second run absolutely will make changes — just only the changes needed to
  close the gap, nothing more.
- **Writing `provisioner "local-exec"` blocks that run non-idempotent shell commands** (e.g., a
  script that always appends a line to a file) — this quietly breaks Terraform's idempotency
  guarantee for that resource, since re-running `apply` with no config changes can still produce
  side effects. Provisioners are a common place this guarantee leaks.
- **Believing idempotency is unique to Terraform** — it's a general systems design concept
  (also central to REST API design and distributed systems retry logic); Terraform is simply one
  well-known application of it to infrastructure.

### Interview Answer

"Idempotency means performing an operation multiple times produces the same end result as
performing it once. For Terraform, running `terraform apply` repeatedly against an unchanged
configuration results in zero additional changes, because Terraform diffs desired configuration
against the state it already recorded, rather than blindly re-issuing create calls like a raw
imperative script would. This is what makes it safe to re-run `apply` after a network blip or a
CI retry — it converges toward the desired state instead of duplicating resources."

> **Memory hook:** `terraform apply` is a thermostat, not a heater's "on" switch — running it again when you're already at the target temperature does nothing, because the job was always "reach this state," not "perform this action."

---

## 6. Hands-On Exercises

**Exercise 1 — Full Workflow, One Resource**
Write a `main.tf` that creates a single `aws_s3_bucket` resource (bucket name of your choosing,
must be globally unique). Run `init`, `plan`, and `apply` against your own AWS sandbox account.
Read the plan output line by line before typing `yes`. Then run `destroy` to clean up.

**Exercise 2 — Read a Plan for a Forced Replacement**
Given this resource, already applied once:
```hcl
resource "aws_instance" "web" {
  ami               = "ami-0c55b159cbfafe1f0"
  instance_type     = "t3.micro"
  availability_zone = "us-east-1a"
}
```
If you change `availability_zone` to `"us-east-1c"`, predict — before running `plan` — whether
Terraform will show `~` (update in place) or `-/+` (destroy and recreate), and explain why in one
sentence. Then verify by actually running `plan`.

**Exercise 3 — HCL Syntax Identification**
For the snippet below, label each numbered part: block type, label(s), argument, and expression
(vs. literal value).
```hcl
resource "aws_subnet" "public" {          # (1)
  vpc_id     = aws_vpc.main.id            # (2)
  cidr_block = "10.0.1.0/24"              # (3)
}
```

**Exercise 4 — File Layout Refactor**
You're handed a single 300-line `everything.tf` file containing provider config, five resources,
three variables, and two outputs, all mixed together with no separation. Split it into the
conventional `main.tf`/`variables.tf`/`outputs.tf`/`providers.tf` layout. Confirm (by reasoning,
not necessarily running it) that Terraform's behavior is identical either way.

**Exercise 5 — Idempotency in Practice**
Apply a simple `aws_instance` resource. Without changing the configuration at all, run
`terraform apply` a second time. Write down exactly what output you expect *before* running it,
then run it and compare. Now change `instance_type` and run `apply` a third time — does Terraform
recreate the instance, or update it in place? Why?

---

## 7. Interview Q&A

---

**Q1: What are the core steps of the Terraform workflow?**

A: Write HCL configuration, run `terraform init` to download providers and set up the backend,
run `terraform plan` to preview changes as a dry run, run `terraform apply` to execute the
approved plan against real infrastructure, and run `terraform destroy` when you want to tear
resources down. `plan` is the critical safety step — it never modifies real infrastructure, only
shows what would happen.

---

**Q2: What do the `+`, `-`, and `~` symbols mean in a `terraform plan` output?**

A: `+` means the resource will be created, `-` means it will be destroyed, and `~` means it will
be updated in place without being destroyed. `-/+` (or "must be replaced") means a destroy
followed by a recreate, which happens when a changed attribute can't be modified on an existing
resource and forces Terraform to replace it entirely.

---

**Q3: Why does `terraform plan` sometimes show `(known after apply)` for a value?**

A: Because some attributes — like an auto-assigned instance ID or a dynamically allocated public
IP address — genuinely cannot be known until the real provider API creates the resource and
returns that value. It is not an error; it's expected for any attribute the cloud provider itself
generates rather than one you specify in configuration.

---

**Q4: What is a block in HCL, and what are its parts?**

A: A block is HCL's fundamental structural unit: a block type (e.g. `resource`, `variable`,
`provider`), zero or more labels (for a `resource` block, the resource type and a local name), and
a body enclosed in braces containing arguments and possibly nested blocks. For example, in
`resource "aws_instance" "web" { ... }`, `resource` is the block type, `"aws_instance"` and
`"web"` are the two labels, and everything inside `{ }` is the body.

---

**Q5: Does the second label on a `resource` block (e.g. `"web"` in `aws_instance.web`) set the resource's name in AWS?**

A: No. That label is a purely local identifier used only within the Terraform configuration to
reference the resource elsewhere, e.g. `aws_instance.web.id`. It has no effect on any AWS-visible
name. To set a name visible in the AWS console, you must explicitly set a `tags = { Name = "..." }`
argument (or the equivalent for that resource type).

---

**Q6: Why do Terraform projects conventionally split files into main.tf, variables.tf, and outputs.tf if Terraform reads them all as one config anyway?**

A: Purely for human readability and team convention — Terraform Core merges every `.tf` file in a
directory into one logical configuration regardless of file names, so behavior is identical
whether you use one file or many. The convention exists because a predictable layout lets any
engineer, including someone new to a given repository, immediately know where to look for
resources, inputs, or outputs.

---

**Q7: What is idempotency, and how does Terraform achieve it?**

A: Idempotency means applying an operation multiple times produces the same end result as
applying it once. Terraform achieves this by always diffing your desired configuration against
the actual state it recorded from previous applies (refreshed against the real provider API), and
only performing the specific creates, updates, or deletes needed to close that gap — rather than
blindly re-issuing every API call from scratch on each run.

---

**Q8: If you run `terraform apply` twice in a row with no configuration changes, what happens the second time?**

A: Nothing changes in real infrastructure. Terraform computes the diff between desired and actual
state, finds they already match, and reports "No changes. Your infrastructure matches the
configuration." This is the practical demonstration of idempotency and is what makes it safe to
re-run `apply` after something like a CI timeout or an accidental double-click.

---

**Q9: What causes a resource to be destroyed and recreated (`-/+`) instead of updated in place (`~`)?**

A: Certain attributes of certain resource types are immutable once the resource exists — for
example, an EC2 instance's availability zone can't be changed on a running instance. When your
configuration changes one of these "force new resource" attributes, Terraform has no way to
update it in place, so it plans a destroy of the old resource followed by a create of a new one
with the new value. The plan output explicitly labels this with "# forces replacement" next to
the changed attribute.

---

**Q10: Why does Terraform "refresh" state before computing a plan?**

A: To account for the possibility that real infrastructure has drifted from what state believes —
for example, if someone manually changed a security group rule in the AWS console outside of
Terraform. Refreshing queries the real provider API for current values before diffing against
desired configuration, so the plan reflects true current reality rather than a possibly stale
state file.
