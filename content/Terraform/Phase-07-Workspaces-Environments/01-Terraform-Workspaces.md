# 01 — Terraform Workspaces

## Table of Contents

1. [Why Workspaces](#1-why-workspaces)
2. [`terraform workspace` Commands](#2-terraform-workspace-commands)
3. [How Workspaces Affect State](#3-how-workspaces-affect-state)
4. [`terraform.workspace` Interpolation](#4-terraformworkspace-interpolation)
5. [Limitations of Workspaces](#5-limitations-of-workspaces)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Workspaces

Picture this: you've written a perfectly good Terraform configuration for a `dev` VPC, an EC2
instance, and a security group. It works. Now your manager asks you to spin up an identical
`staging` copy for QA to test against before every release. Your first instinct might be to
copy-paste the whole directory into a `staging/` folder, rename a few things, and run `terraform
apply` there too. That works for exactly one copy. Then someone asks for `prod`. Then a second
QA environment for a parallel release train. Suddenly you're maintaining three or four copies of
the *same* `.tf` files, and every time you fix a typo or add a new resource, you have to remember
to paste the change into every copy. Forget one, and `staging` silently drifts from `prod`.

Terraform's answer to "I want the exact same configuration, applied multiple times, each with its
own independent state" is the **workspace**. A workspace lets you reuse one set of `.tf` files
against multiple, completely separate state files — one per workspace — without duplicating any
code.

```bash
terraform workspace new dev
terraform apply    # creates dev's infrastructure, tracked in dev's state

terraform workspace new staging
terraform apply    # creates staging's infrastructure, tracked in staging's state
                    # dev's resources are untouched — different state file entirely
```

Every workspace starts life sharing the exact same `.tf` code. What differs is *only* the state
file that records what got built, plus (if you choose to reference `terraform.workspace` in your
code) small conditional values like instance size or resource naming.

### Analogy

Think of a cookie cutter and a tray of dough. The cookie cutter is your Terraform configuration —
one fixed shape. Each workspace is a separate patch of dough on the tray: `dev` dough, `staging`
dough, `prod` dough. You press the *same* cutter into each patch, and you get the same shape of
cookie — but each cookie bakes and exists independently. Burn the `dev` cookie and the `staging`
one is completely unaffected, because they were never the same piece of dough to begin with.

### Under the Hood

By default, every Terraform working directory has exactly one workspace called `default`. When
you run `terraform workspace new dev`, Terraform doesn't touch your `.tf` files at all — it
creates a new, isolated slot for state, and switches your CLI's "current workspace" pointer to it.

```
┌─────────────────────────────────────────────────────────────┐
│                     ONE .tf CONFIGURATION                    │
│         (main.tf, variables.tf, outputs.tf — unchanged)      │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  workspace: default   workspace: dev      workspace: staging
        │                   │                   │
        ▼                   ▼                   ▼
  terraform.tfstate.d/  terraform.tfstate.d/  terraform.tfstate.d/
  default (or root      dev/terraform.tfstate staging/terraform.tfstate
  terraform.tfstate)
```

`terraform workspace select <name>` just rewrites a tiny pointer file (`.terraform/
environment`) telling Terraform which state file to read and write next. Nothing about your
`.tf` code changes — only *which state Terraform consults* changes.

### Example

```bash
# See which workspace you're in right now
terraform workspace show
# default

# Create and switch to a new workspace
terraform workspace new dev
# Created and switched to workspace "dev"!

terraform plan
terraform apply
# Resources are created and recorded under the "dev" workspace's state

terraform workspace new staging
terraform apply
# A brand-new, independent set of resources — dev's are untouched
```

### Common Confusion

A lot of engineers assume workspaces are "environments" in the full sense — separate AWS
accounts, separate networking, separate blast radius. They are not. A workspace is purely a
**state-isolation mechanism inside one backend and one configuration**. If your `dev` and `prod`
should live in different AWS accounts with different credentials, different backend buckets, or
different approval processes, workspaces alone won't give you that — you'd need separate
configurations or separate backend configs (see lesson 02).

### Interview Answer

"A Terraform workspace lets you run the same configuration multiple times, each time against a
separate, named state file, without duplicating code. It's implemented as a subdirectory inside
the backend (or a state key suffix) that Terraform switches between with `terraform workspace
select`. It's useful for lightweight variants of the same infrastructure — like a personal
sandbox per developer — but it's not a full substitute for isolating environments that need
different credentials, providers, or blast-radius boundaries."

> **Memory hook:** One cookie cutter, many patches of dough — same shape, independent cookies.

---

## 2. `terraform workspace` Commands

You now know *why* workspaces exist. The next question is purely mechanical: how do you actually
create one, see which one you're standing in, switch between them, and clean one up when you're
done? Terraform bundles all of this into a small, memorable command family: `terraform
workspace <subcommand>`.

### Analogy

Think of workspaces like tabs in a web browser. `new` opens a tab, `list` shows you all open
tabs, `select` clicks on a tab to bring it to the front, `show` tells you which tab is currently
active, and `delete` closes a tab you no longer need. You're still using the same browser (the
same `.tf` config) — you're just switching which tab (state) is in front of you.

| Command | Purpose |
|---|---|
| `terraform workspace new <name>` | Create a new workspace and switch to it immediately |
| `terraform workspace list` | List all workspaces; `*` marks the active one |
| `terraform workspace select <name>` | Switch to an existing workspace |
| `terraform workspace show` | Print the name of the currently active workspace |
| `terraform workspace delete <name>` | Delete a workspace (must not be the active one, and its state should be empty or you must force it) |

### Under the Hood

```
$ terraform workspace list
* default
  dev
  staging

$ terraform workspace select dev
Switched to workspace "dev".

$ terraform workspace show
dev
```

Internally, `terraform workspace select` writes the chosen workspace name into
`.terraform/environment` (a plain text file inside your local `.terraform` directory). Every
subsequent `plan`/`apply`/`destroy` reads that file first to know which state to load from the
backend before doing anything else.

### Example

```bash
# Start fresh — only "default" exists
terraform workspace list
# * default

# Create three environment workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

terraform workspace list
#   default
# * prod
#   dev
#   staging

# Switch back to dev to make a change
terraform workspace select dev
terraform plan

# Delete a workspace you no longer need (must not be active, and ideally destroyed first)
terraform workspace select default
terraform destroy   # inside staging first, if you want to tear it down
terraform workspace select staging
terraform destroy
terraform workspace select default
terraform workspace delete staging
```

### Common Mistakes

- **Forgetting which workspace is active** before running `apply` — this is the single most
  common cause of "why did this change apply to the wrong environment?!" incidents. Always run
  `terraform workspace show` before a risky `apply`.
- **Deleting a workspace without destroying its resources first.** `terraform workspace delete`
  only removes the state pointer/slot — it does **not** run `terraform destroy` for you. If the
  workspace's state file still lists live resources, Terraform will refuse to delete it unless
  you pass `-force`, and even then the actual cloud resources are now orphaned (untracked by any
  state).
- **Trying to `select` a workspace that doesn't exist** — Terraform will error with "workspace
  does not exist"; you need `new`, not `select`, to create one.

### Interview Answer

"The core commands are `new` to create and switch, `list` to see all of them with the active one
marked by an asterisk, `select` to switch to an existing one, `show` to print the current one, and
`delete` to remove one. They only manage the state pointer — deleting a workspace does not
destroy its infrastructure, so you must run `terraform destroy` in that workspace first."

> **Memory hook:** Browser tabs — `new` opens one, `select` switches to one, `show` tells you which is in front, `delete` closes it (but doesn't shut down what was running in it).

---

## 3. How Workspaces Affect State

Here's the part that trips people up until they see it laid out concretely: when you have three
workspaces (`default`, `dev`, `staging`) all pointed at the exact same backend configuration
(say, one S3 bucket), where do the three separate state files actually *live*? They don't
collide — Terraform automatically namespaces them so each workspace gets its own private slot
inside the same backend.

### Analogy

Imagine a shared filing cabinet (the backend — one S3 bucket) that the whole team uses. Instead
of every environment needing its own physical cabinet, Terraform just gives each workspace its
own labeled folder inside the *same* cabinet: a `dev` folder, a `staging` folder, a `prod`
folder. Open the wrong folder and you'd see someone else's state — but as long as Terraform
picks the right folder (workspace), everyone's paperwork stays separate.

### Under the Hood

**Local backend** (state stored on disk): non-default workspaces get their own subdirectory
under `terraform.tfstate.d/`.

```
project/
├── main.tf
├── terraform.tfstate              ← used ONLY by the "default" workspace
└── terraform.tfstate.d/
    ├── dev/
    │   └── terraform.tfstate      ← "dev" workspace's state
    └── staging/
        └── terraform.tfstate      ← "staging" workspace's state
```

**Remote backend, e.g. S3**: Terraform appends the workspace name into the object key, using the
`workspace_key_prefix` (default `env:`) pattern.

```
S3 bucket: my-tf-state-bucket
├── env:/dev/global/s3/terraform.tfstate         ← "dev" workspace
├── env:/staging/global/s3/terraform.tfstate     ← "staging" workspace
└── global/s3/terraform.tfstate                  ← "default" workspace (no prefix!)
```

```
┌─────────────────────────────────────────────────────────────────┐
│                      ONE S3 BACKEND BUCKET                      │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐     │
│  │ default state │   │  dev state    │   │ staging state │     │
│  │ (root key)     │   │ (env:/dev/…)  │   │(env:/staging/…)│    │
│  └───────────────┘   └───────────────┘   └───────────────┘     │
└─────────────────────────────────────────────────────────────────┘
        ▲                     ▲                     ▲
        │                     │                     │
   workspace                workspace            workspace
    "default"                "dev"                "staging"
```

Notice the `default` workspace is special: it does *not* get an `env:/default/...` prefix — it
uses the bare configured key, which matters if you're migrating an existing single-workspace
project into using workspaces (its existing state becomes the `default` workspace automatically).

### Example

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket = "my-tf-state-bucket"
    key    = "global/s3/terraform.tfstate"
    region = "us-east-1"
    # workspace_key_prefix defaults to "env:" — objects become
    # env:/<workspace>/global/s3/terraform.tfstate for non-default workspaces
  }
}
```

```bash
terraform workspace new dev
terraform apply
# state written to: env:/dev/global/s3/terraform.tfstate

terraform workspace new staging
terraform apply
# state written to: env:/staging/global/s3/terraform.tfstate

# Confirm from the AWS side
aws s3 ls s3://my-tf-state-bucket/env:/ --recursive
```

### Common Confusion

People sometimes expect `terraform state list` to show resources from *every* workspace at once.
It never does — `terraform state list`, `terraform show`, and `terraform state pull` always
operate on the **currently selected workspace's state only**. If you want to inspect `staging`'s
resources, you must `terraform workspace select staging` first.

### Interview Answer

"Workspaces don't create new backends — they partition a single configured backend into separate
state slots. On the local backend that's a subdirectory under `terraform.tfstate.d/`; on S3 (and
most remote backends) it's a key prefix, `env:/<workspace-name>/`, applied to the same object
key. The `default` workspace is the exception — it uses the bare key with no prefix, which is why
existing single-workspace projects don't break when workspaces are introduced."

> **Memory hook:** One filing cabinet (backend), labeled folders inside it (workspaces) — never mix up which folder you opened.

---

## 4. `terraform.workspace` Interpolation

Separate state per environment is useful on its own, but it becomes genuinely powerful once your
*resources themselves* can react to which workspace they're being applied in. Maybe `dev` should
use a `t3.micro` and `prod` should use an `m5.large`. Maybe every resource name should be suffixed
with the environment so nothing collides in the AWS console. Terraform exposes the active
workspace's name as a built-in read-only value: `terraform.workspace`.

### Analogy

Think of `terraform.workspace` like a name tag an actor wears backstage that changes depending on
which show they're performing in tonight. The script (your `.tf` code) is identical every night —
but a single line like `"Welcome to ${show_name}!"` reads differently because the name tag value
changes. Your infrastructure code is the script; `terraform.workspace` is the name tag.

### Under the Hood

`terraform.workspace` is a special expression Terraform resolves at plan/apply time by reading
whichever workspace is currently active (from `.terraform/environment`). It requires no variable
declaration — it's simply available anywhere expressions are allowed.

```
┌────────────────────────────────────────────────────────┐
│  terraform workspace select dev                        │
│              │                                          │
│              ▼                                          │
│  .terraform/environment  contains:  "dev"               │
│              │                                          │
│              ▼                                          │
│  Every reference to terraform.workspace in your .tf     │
│  files resolves to the string "dev" during plan/apply   │
└──────────────────────────────────────────────────────────┘
```

### Example

```hcl
locals {
  environment = terraform.workspace

  instance_type_map = {
    default = "t3.micro"
    dev     = "t3.micro"
    staging = "t3.small"
    prod    = "m5.large"
  }
}

resource "aws_instance" "app" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = lookup(local.instance_type_map, terraform.workspace, "t3.micro")

  tags = {
    Name        = "app-server-${terraform.workspace}"
    Environment = terraform.workspace
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "myapp-logs-${terraform.workspace}"   # myapp-logs-dev, myapp-logs-prod, ...
}

# A common guard rail: block accidental applies against prod from the default workspace
resource "null_resource" "guard" {
  count = terraform.workspace == "default" ? 1 : 0

  provisioner "local-exec" {
    command = "echo 'Refusing to apply from the default workspace' && exit 1"
  }
}
```

```bash
terraform workspace select staging
terraform apply
# Name = app-server-staging, instance_type = t3.small

terraform workspace select prod
terraform apply
# Name = app-server-prod, instance_type = m5.large
```

### Common Confusion

`terraform.workspace` is **not** a variable you declare in `variables.tf` — it's a built-in
expression, similar to `path.module` or `count.index`. You cannot assign it a value with `-var`
or a `.tfvars` file; it is always whatever `terraform workspace show` currently reports. Also,
because it's just a plain string, typos are silent: `terraform.workspace == "prod "` (trailing
space) will simply never match and nobody gets an error telling you why.

### Interview Answer

"`terraform.workspace` is a built-in expression that evaluates to the name of the currently
selected workspace, resolved at plan/apply time. It's commonly used inside `locals` or resource
arguments to vary instance sizes, tags, or naming per environment without duplicating
configuration. It's read-only — you can't set it — and because it's a plain string comparison,
teams typically wrap it in a lookup map with a safe default rather than scattering raw
conditionals across many resources."

> **Memory hook:** `terraform.workspace` is the name tag the actor wears — same script, different name read aloud depending on which show is running.

---

## 5. Limitations of Workspaces

Everything so far makes workspaces sound like a free lunch: same code, isolated state, a
built-in variable to key off of. So why doesn't every team just use workspaces for `dev`/
`staging`/`prod` and call it a day? Because workspaces solve exactly one problem — state
isolation within one backend and one configuration — and real environments usually need more
than that.

### Analogy

Workspaces are like using the same house key to open different rooms that have identical
furniture layouts. Great for rooms that really are just repeated versions of the same thing. But
if one "room" actually needs a completely different security system, different landlord
(a different AWS account entirely), or a different floor plan (materially different resources,
not just different sizes) — you can't get there by turning the same key differently. You need a
genuinely different house.

### Under the Hood — What Workspaces Cannot Do

```
┌───────────────────────────────────────────────────────────────┐
│                    WHAT STAYS THE SAME                        │
│         across ALL workspaces of one configuration             │
├───────────────────────────────────────────────────────────────┤
│  • Backend configuration (same bucket/account, unless you      │
│    hand-roll partial config + `-backend-config` per env)       │
│  • Provider configuration (same AWS account/region/credentials)│
│  • The actual resource graph shape (same resources declared,   │
│    just different arg values via terraform.workspace)          │
│  • Module versions and provider versions pinned in the code    │
└───────────────────────────────────────────────────────────────┘
```

Concretely, workspaces do **not** give you:

1. **Different AWS accounts per environment.** The `provider "aws" {}` block (and its
   credentials) is shared by all workspaces of a configuration. Real teams almost always want
   `prod` in a separate AWS account from `dev` for blast-radius and IAM isolation — workspaces
   can't express that.
2. **Structurally different infrastructure.** If `prod` needs a Multi-AZ RDS cluster and `dev`
   needs a single instance, you end up writing sprawling `count`/`for_each` conditionals keyed
   off `terraform.workspace` just to avoid duplicating files — often harder to read than just
   having two directories.
3. **Independent apply permissions.** Anyone who can run `terraform apply` in the configuration
   can switch workspaces and apply to `prod` — there's no built-in RBAC tied to a workspace name
   (Terraform Cloud/Enterprise adds this on top; open-source CLI workspaces do not).
4. **Different backend state locations by default.** All workspaces share one backend
   configuration block; you can't natively point `prod`'s state to a stricter, separately
   access-controlled bucket without extra tooling.
5. **Easy accidental-apply protection.** Because switching workspaces is a one-line command with
   no confirmation prompt, a forgotten `terraform workspace select prod` is a very easy mistake
   to make right before an `apply`.

| Concern | Workspaces | Directory-per-Environment (Phase 07-02) |
|---|---|---|
| State isolation | Yes | Yes |
| Different AWS accounts/credentials | No (shared provider block) | Yes (separate configs, separate provider blocks) |
| Structurally different resources per env | Awkward (conditionals) | Natural (separate files) |
| Risk of applying to wrong env | Higher (one `select` away) | Lower (must `cd` into a different directory) |
| Code duplication | None | Some (mitigated with modules) |

### Common Mistakes

- Using workspaces as the *only* separation between `dev` and `prod` in the same AWS account,
  then being surprised when a bug in shared provider config or a bad `count` expression takes
  down both at once.
- Assuming workspace names give you access control. They don't — workspace switching is a local
  CLI operation with no permission check in open-source Terraform.
- Letting `terraform.workspace` conditionals multiply until the configuration is an unreadable
  maze of `terraform.workspace == "prod" ? ... : ...` ternaries.

### Interview Answer

"Workspaces are great for cheap, same-shaped variants of one configuration — like a personal
sandbox per developer, or short-lived feature-branch environments. They fall short once
environments need different AWS accounts, different backend access controls, or structurally
different infrastructure, because the provider block, backend block, and resource graph shape
are shared across all workspaces of one configuration. For that level of isolation, most teams
move to directory-per-environment or fully separate repositories, which we cover next."

> **Memory hook:** Same key, different rooms — fine until one "room" needs its own landlord.

---

## 6. Hands-On Exercises

**Exercise 1 — Create and Inspect Workspaces**
Starting from a fresh configuration with a single `aws_s3_bucket` resource:
```hcl
resource "aws_s3_bucket" "demo" {
  bucket = "workspace-demo-${terraform.workspace}"
}
```
Create `dev` and `staging` workspaces, apply in each, then run `aws s3 ls` to confirm two
differently-named buckets exist. Run `terraform state list` in each workspace and confirm each
only shows its own bucket.

**Exercise 2 — Locate the State Files**
Using a local backend, run `terraform apply` in `default`, `dev`, and `staging` workspaces, then
inspect the filesystem. Identify the exact path of each workspace's state file and explain why
`default` doesn't appear under `terraform.tfstate.d/`.

**Exercise 3 — Instance Sizing by Workspace**
Extend the exercise 1 configuration to add an `aws_instance` resource whose `instance_type` comes
from a lookup map keyed by `terraform.workspace` (t3.micro for dev, t3.small for staging, m5.large
for prod). Apply in `dev` and `staging` and confirm (via `terraform state show`) the correct
instance type landed in each.

**Exercise 4 — Clean Teardown**
Destroy the resources in `staging`, then attempt `terraform workspace delete staging` (a) before
destroying and (b) after destroying. Note the different behavior and explain why Terraform
refused the first attempt.

**Exercise 5 — Design Critique**
Your team currently uses workspaces for `dev`/`staging`/`prod`, all sharing one AWS account and
one IAM role capable of applying to any of them. Write three sentences identifying the biggest
risk in this setup and what you'd change.

---

## 7. Interview Q&A

---

**Q1: What problem do Terraform workspaces solve?**

A: They let you apply the exact same `.tf` configuration multiple times, each time against a
separate, isolated state file, without duplicating any code. This is useful for lightweight,
same-shaped variants of one configuration, such as a personal sandbox per developer.

---

**Q2: Where is a non-default workspace's state stored on the local backend? On S3?**

A: Locally, under `terraform.tfstate.d/<workspace-name>/terraform.tfstate`. On S3, Terraform
prefixes the configured object key with `env:/<workspace-name>/` by default (controlled by the
backend's `workspace_key_prefix` setting). The `default` workspace is the exception — it uses the
bare configured key with no prefix.

---

**Q3: How do you reference the currently active workspace inside a resource?**

A: Via the built-in `terraform.workspace` expression, e.g. `bucket =
"logs-${terraform.workspace}"`. It's read-only, resolved at plan/apply time, and not declared as
a variable.

---

**Q4: What are the main limitations of workspaces compared to separate directories/repos per
environment?**

A: Workspaces share the same backend configuration and the same provider block across all
workspaces of one configuration — so you can't point `prod` at a different AWS account or a more
tightly access-controlled state bucket without extra tooling. They also offer no built-in access
control on who can switch workspaces or apply, and structurally different environments (not just
different sizes) tend to produce sprawling conditionals rather than clean separation.

---

**Q5: Does deleting a workspace destroy its infrastructure?**

A: No. `terraform workspace delete` only removes the state slot/pointer. If the workspace's
state still references live resources, Terraform refuses to delete it unless you force it — and
forcing it orphans those cloud resources from any Terraform state. You must `terraform destroy`
in that workspace first.

---

**Q6: Is it safe to use workspaces alone to separate dev, staging, and prod?**

A: It's a viable lightweight approach only if all environments genuinely share the same AWS
account, the same provider configuration, and roughly the same resource shape, and if the team
accepts that anyone who can apply the configuration can switch to any workspace including prod.
For most production setups, teams add stronger isolation via separate directories, separate
backend configs, or separate repositories — workspaces alone are usually not considered enough
for prod isolation.
