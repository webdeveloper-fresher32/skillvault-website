# 02 — Multi-Environment Strategies

## Table of Contents

1. [Workspaces vs Directory-per-Environment vs Separate Repos](#1-workspaces-vs-directory-per-environment-vs-separate-repos)
2. [Directory-per-Environment Layout Example](#2-directory-per-environment-layout-example)
3. [Choosing a Strategy for Team Size/Complexity](#3-choosing-a-strategy-for-team-sizecomplexity)
4. [Promoting Changes Across Environments](#4-promoting-changes-across-environments)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Workspaces vs Directory-per-Environment vs Separate Repos

Six months into using Terraform, most teams hit the same wall: "how do we actually structure
dev/staging/prod so that a junior engineer can't accidentally nuke production, but we're also not
maintaining four copy-pasted versions of every `.tf` file?" There's no single right answer —
there are three well-established strategies, and picking between them is one of the most common
real-world Terraform design decisions you'll be asked about in an interview.

### Analogy

Think of it like organizing a company's finances across three subsidiaries:

- **Workspaces** = one shared checkbook, with a different colored tab for each subsidiary's
  entries. Fast to set up, but anyone with the checkbook can write on any tab.
- **Directory-per-environment** = one bank, but a separate physical ledger book per subsidiary.
  You have to consciously pick up the right book before writing anything — much harder to
  accidentally write staging's numbers into prod's book.
- **Separate repos** = each subsidiary has its own entirely separate bank, its own accountant,
  its own vault. Maximum isolation, but now three sets of paperwork to keep in sync when a policy
  changes company-wide.

### Comparison Table

| Dimension | Workspaces | Directory-per-Environment | Separate Repositories |
|---|---|---|---|
| Code duplication | None — one set of `.tf` files | Some (root modules per env call shared modules) | Highest (unless modules are a shared package) |
| State isolation | Yes, within one backend | Yes, fully separate backend configs possible | Yes, fully separate, often separate accounts |
| Different AWS accounts/credentials per env | Hard (shared provider block) | Natural (each dir has its own backend/provider config) | Natural |
| Blast-radius protection | Low (one `select` away from prod) | Medium (must `cd`, explicit `-var-file`) | High (separate repo, separate CI pipeline, separate access) |
| CI/CD complexity | Low (one pipeline, parameterized) | Medium (pipeline per directory or matrix job) | Higher (pipeline per repo, cross-repo coordination for shared modules) |
| Good for | Personal sandboxes, ephemeral/PR environments, quick prototypes | Small-to-mid teams needing env isolation without repo sprawl | Large orgs, strict compliance boundaries, independently-owned environments |
| Drift risk between envs | Very low (identical code by construction) | Low-medium (must remember to promote changes, see §4) | Medium-high (easy for repos to diverge over time) |
| Onboarding complexity | Lowest | Low | Higher (must clone/access multiple repos) |

### Under the Hood

The three strategies are really three different answers to one question: **"What is the unit
that gets duplicated to create isolation?"**

```
Workspaces:               ONE root module, MANY state files
                          (duplication unit = state file only)

Directory-per-env:        MANY root modules, calling ONE shared module source,
                          MANY state files
                          (duplication unit = a thin root module + its backend config)

Separate repos:           MANY independent repos, each with its own root module
                          (and possibly its own copy or version pin of shared modules)
                          (duplication unit = the entire repository)
```

As you move left to right, isolation goes up and blast radius goes down — but so does the ease of
making a single change apply everywhere at once.

### Common Confusion

People often think "directory-per-environment" means copy-pasting the *entire* resource
definitions into each environment's folder. In practice, the strategy that scales is: keep
resource logic in a shared, versioned **module**, and make each environment's directory a *thin*
root module that just calls that shared module with different variable values and a different
backend block. That way you get directory-level isolation without losing the DRY benefit
workspaces give you for free.

### Interview Answer

"There are three common strategies. Workspaces reuse one configuration against multiple state
files — zero duplication, but weak isolation because the provider and backend blocks are shared.
Directory-per-environment gives each environment its own root module and backend configuration
(often calling a shared versioned module), which allows different AWS accounts and stronger
blast-radius protection at the cost of some duplication. Separate repositories take that further
— entire independent codebases, usually for large orgs with strict compliance or ownership
boundaries between environments. The right choice depends on team size, how different the
environments really are, and how much you need to prevent an engineer from accidentally touching
prod."

> **Memory hook:** One checkbook with colored tabs (workspaces), separate ledger books at one bank (directories), or separate banks entirely (repos) — isolation goes up, convenience goes down, left to right.

---

## 2. Directory-per-Environment Layout Example

Talking about "directory-per-environment" in the abstract only gets you so far — the pattern
becomes obvious once you see an actual file tree. The core idea: put the reusable resource logic
in a `modules/` directory, and give each environment its own small directory that calls that
module with environment-specific values and points at its own backend/state.

### Analogy

It's like a restaurant chain with one master recipe book (the shared module) kept in a central
office, but each franchise location (each environment directory) has its own ordering sheet
specifying quantities for *its* kitchen — the Downtown location orders enough for 200 covers a
night, the Airport location orders for 800. Same recipes, different order sheets, completely
separate inventories.

### Example Layout

```
infra/
├── modules/
│   └── web-app/
│       ├── main.tf          # aws_instance, aws_security_group, aws_lb, etc.
│       ├── variables.tf     # instance_type, min_size, max_size, vpc_id, ...
│       └── outputs.tf       # lb_dns_name, instance_ids, ...
│
├── environments/
│   ├── dev/
│   │   ├── main.tf           # calls module "web-app" with dev-sized inputs
│   │   ├── backend.tf        # backend "s3" { key = "dev/web-app/terraform.tfstate" }
│   │   ├── terraform.tfvars  # instance_type = "t3.micro", min_size = 1
│   │   └── provider.tf       # provider "aws" { region = "us-east-1" }
│   │
│   ├── staging/
│   │   ├── main.tf
│   │   ├── backend.tf        # key = "staging/web-app/terraform.tfstate"
│   │   ├── terraform.tfvars  # instance_type = "t3.small", min_size = 2
│   │   └── provider.tf
│   │
│   └── prod/
│       ├── main.tf
│       ├── backend.tf        # key = "prod/web-app/terraform.tfstate"
│       │                     # often a DIFFERENT bucket/account entirely
│       ├── terraform.tfvars  # instance_type = "m5.large", min_size = 4
│       └── provider.tf       # provider "aws" { assume_role { role_arn = "...prod-role" } }
```

```hcl
# environments/prod/main.tf
module "web_app" {
  source = "../../modules/web-app"

  instance_type = var.instance_type
  min_size      = var.min_size
  max_size      = var.max_size
  vpc_id        = data.aws_vpc.prod.id
}

# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket = "mycompany-prod-tfstate"   # separate bucket, separate AWS account
    key    = "web-app/terraform.tfstate"
    region = "us-east-1"
  }
}
```

```hcl
# environments/dev/main.tf  — identical module call, different values
module "web_app" {
  source = "../../modules/web-app"

  instance_type = var.instance_type
  min_size      = var.min_size
  max_size      = var.max_size
  vpc_id        = data.aws_vpc.dev.id
}
```

To operate on one environment, you `cd` into it — there's no workspace-switching step to forget:

```bash
cd infra/environments/dev
terraform init
terraform plan
terraform apply
```

### Common Confusion

New adopters sometimes still copy the entire `main.tf` resource block into every environment
folder ("directory-per-environment done wrong"). That reintroduces exactly the duplication
problem workspaces were meant to avoid. The pattern only pays off when the environment
directories are *thin callers* of a shared, versioned module — the environment folder should
mostly contain variable values, a backend block, and a provider block, not raw resource
definitions.

### Interview Answer

"The layout puts shared resource logic in a `modules/` directory and gives each environment its
own small root module under `environments/<env>/` that calls the shared module with
environment-specific variables and its own backend configuration. This lets `prod` point at a
completely separate state backend — even a separate AWS account via `assume_role` — while `dev`
and `staging` share less-restrictive settings, all without duplicating the actual resource
definitions."

> **Memory hook:** One recipe book in the back office, a different order sheet per franchise location.

---

## 3. Choosing a Strategy for Team Size/Complexity

None of the three strategies from §1 is universally "correct" — the right pick depends on how
big your team is, how different your environments really are, and how much damage an accidental
`prod` apply would cause. A five-person startup optimizing for shipping speed and a 200-engineer
org under SOC 2 compliance are solving genuinely different problems.

### Analogy

It's the difference between how a single household stores its keys (one hook by the door — fast,
low risk, few people) versus how an office building manages keys (individually badge-scoped, key
cabinets, sign-out logs — slower, but the building has hundreds of people and much higher risk if
the wrong person gets into the wrong room).

### Decision Guide

```
┌───────────────────────────────────────────────────────────────────┐
│  Team size: 1–3 engineers, one AWS account, low compliance need   │
│  → Workspaces are fine. Fast iteration matters more than isolation.│
├───────────────────────────────────────────────────────────────────┤
│  Team size: 4–20 engineers, staging must mirror prod closely,     │
│  some compliance/change-control expectations                      │
│  → Directory-per-environment with shared modules.                  │
│    Balances DRY code with real isolation and explicit promotion.  │
├───────────────────────────────────────────────────────────────────┤
│  Team size: 20+ engineers, multiple AWS accounts / business units, │
│  strict compliance (SOC 2, PCI-DSS), independent environment owners│
│  → Separate repositories (+ a shared, versioned module registry).  │
│    Each environment/team owns its own pipeline, review process,   │
│    and access boundary.                                            │
└───────────────────────────────────────────────────────────────────┘
```

| Factor | Favors Workspaces | Favors Directory-per-Env | Favors Separate Repos |
|---|---|---|---|
| Team size | 1–3 | 4–20 | 20+ |
| Environments share one AWS account | Yes | Sometimes | Rarely |
| Compliance requirements | Minimal | Moderate | Strict (SOC 2, PCI, HIPAA) |
| Need per-environment approvals in CI | No | Yes, achievable | Yes, required |
| Environments structurally identical | Yes | Mostly | Not necessarily |
| Ownership | One person/team owns everything | One platform team owns all envs | Different teams own different envs |

### Common Mistakes

- Choosing separate repos for a 3-person startup "to be safe" — this adds process overhead
  (cross-repo module version bumps, multiple pipelines) that slows the team down with no
  corresponding risk reduction, since there was only ever one person who could break prod anyway.
- Sticking with workspaces past the point where `prod` needs a different AWS account —
  workspaces can't express that at all, so teams end up bolting on fragile external scripts to
  fake account isolation.
- Assuming the choice is permanent. Many teams start with workspaces, then graduate to
  directory-per-environment once staging needs to diverge from dev in ways that don't fit neatly
  into `terraform.workspace` conditionals.

### Interview Answer

"I pick based on team size, compliance needs, and how different the environments actually are.
Small teams sharing one AWS account benefit from workspaces because there's negligible
duplication and low risk. Mid-sized teams that need `prod` in a separate account, or explicit
promotion gates, tend to move to directory-per-environment with a shared module. Large orgs with
compliance requirements or independently-owned environments usually go to separate repositories
so each environment has its own pipeline, its own access control, and its own change-approval
process. It's not a one-time decision either — teams commonly outgrow workspaces and migrate to
directories as the org and compliance bar grow."

> **Memory hook:** One hook by the door for a household, a badge system for an office building — the security model should match the size of the population, not be maxed out on day one.

---

## 4. Promoting Changes Across Environments

Multiple environments only earn their keep if changes flow through them in a controlled order:
you write and test a change in `dev`, confirm it in `staging`, and only then let it touch `prod`.
Get this "promotion" step wrong — apply straight to prod, or let staging drift out of sync with
what dev already validated — and having separate environments buys you nothing beyond extra
infrastructure to pay for.

### Analogy

Think of it like a play going through previews before opening night. You rehearse it in an empty
theater (dev), run it in front of a small preview audience who can tell you what's broken
(staging), and only once it's held up under a live audience do you open it to the general public
(prod) — the *same script* moves through each stage, in order, never skipping ahead.

### Under the Hood — A Typical Promotion Flow

```
                     ┌───────────────┐
  git commit  ──────►│   dev branch   │──── terraform apply (auto, on merge) ───► dev env
                     └───────┬───────┘
                             │  open PR: dev → staging
                             ▼
                     ┌───────────────┐
                     │ staging branch │──── terraform plan (CI) ── manual approval ───► staging env
                     └───────┬───────┘        (terraform apply after approval)
                             │  open PR: staging → main/prod
                             ▼
                     ┌───────────────┐
                     │  main branch   │──── terraform plan (CI) ── manual approval ───► prod env
                     └───────────────┘        (terraform apply after approval,
                                                often requiring 2 reviewers)
```

The same `.tf` change (a module version bump, a new variable value, a new resource) travels
through each environment's directory or workspace in sequence. Nobody hand-edits `prod`'s files
directly — the change that already ran cleanly in `staging` is the exact change that gets applied
to `prod`.

### Example — Directory-per-Environment Promotion

```bash
# Step 1: change lands in dev
cd infra/environments/dev
terraform plan
terraform apply
# validated — behaves as expected

# Step 2: same module version / variable change copied into staging's tfvars
cd ../staging
terraform plan   # CI runs this automatically on PR
# reviewed, approved, merged
terraform apply  # CI runs this automatically after merge

# Step 3: same change promoted into prod, gated by manual approval
cd ../prod
terraform plan     # CI posts the plan output to the PR for review
# requires 2 approvals before...
terraform apply    # ...CI runs apply, often with an explicit "approve" gate
```

### Example — Workspace Promotion

```bash
terraform workspace select dev
terraform apply

terraform workspace select staging
terraform apply

# Only after staging is validated:
terraform workspace select prod
terraform apply
```

### Common Confusion

Promotion is not "copy staging's exact `.tfvars` into prod." Environment-specific values (sizes,
counts, domain names) legitimately differ. What must be promoted *unchanged* is the **module
version / code logic** — the actual resource definitions and their structure. A very common
anti-pattern is hot-fixing `prod`'s module version directly without ever running that same
version through `dev`/`staging` first — this defeats the entire purpose of having a staging gate.

### Interview Answer

"Promotion means the same validated Terraform code — usually a specific module version or a
merged set of `.tf` changes — moves through environments in order: dev, then staging, then prod,
typically gated by CI pipeline stages with manual approval before the prod apply. What differs
per environment is only the input values (sizes, counts, domains), not the underlying logic. The
goal is that whatever gets applied to prod has already been applied, tested, and observed working
in staging — never a change that skips straight to prod."

> **Memory hook:** Previews before opening night — same script, escalating audiences, never skip ahead to the big one.

---

## 5. Common Mistakes

Even teams that pick a sound strategy (§1) and a sensible promotion flow (§4) still trip over the
same handful of mistakes in practice. Naming them explicitly makes them much easier to catch in
a code review before they become an incident.

### Analogy

These are the multi-environment equivalent of "left the stove on" mistakes — individually small,
individually easy to prevent, but the kind of thing that, unchecked, eventually burns the house
down.

### The Mistakes

1. **Applying from the wrong workspace or directory.** The single most common incident cause.
   Nothing stops you from running `terraform apply` in `prod`'s directory while thinking you're
   in `staging`, or forgetting a `terraform workspace select` before applying.
   *Mitigation:* CI pipelines that pin the environment per job, `terraform workspace show` as a
   pre-apply CI check, and separate AWS credentials per environment so a mistaken apply at least
   fails on permissions instead of succeeding against the wrong account.

2. **Letting staging drift from prod.** If staging uses different instance types, different
   module versions, or skipped a change that prod later gets first, staging stops being a
   meaningful signal. Bugs that would have been caught in staging now surface directly in prod.
   *Mitigation:* keep staging's module version pinned to the same version being promoted to
   prod; run `terraform plan` diffs between environments periodically to catch drift.

3. **Hardcoding environment-specific values inside shared modules.** A module that hardcodes
   `"prod-vpc-12345"` cannot be reused for `dev`, defeating the entire point of a shared module
   and forcing environment-specific forks.

4. **No plan review before prod apply.** Skipping a human review of the `terraform plan` output
   before applying to prod is how "this looked like a small change" turns into an unplanned
   resource replacement (e.g. an `aws_instance` recreated due to a forced ID/AMI change) taking
   production down.

5. **Sharing state/backend credentials across environments.** If the same IAM role can write to
   `dev`'s, `staging`'s, and `prod`'s state buckets, a compromised or misconfigured `dev`
   pipeline can corrupt `prod` state.

6. **Treating workspaces as if they were access-controlled environments** (see lesson 01, §5) —
   assuming `terraform workspace select prod` requires special permission when, in open-source
   Terraform, it does not.

### Interview Answer

"The recurring failure mode across almost every incident I've seen is applying the right change
to the wrong environment — either the wrong workspace was selected, or CI ran against the wrong
directory. The fixes that actually work are structural, not just discipline: separate credentials
per environment so a mistake fails on permissions rather than succeeding, mandatory `plan` review
before any prod apply, and keeping staging's module version in lockstep with what's being
promoted to prod so staging remains a meaningful signal."

> **Memory hook:** Left the stove on — small, preventable mistakes that compound into a real fire if nobody checks.

---

## 6. Hands-On Exercises

**Exercise 1 — Strategy Selection**
For each scenario below, pick workspaces, directory-per-environment, or separate repos, and
justify in two sentences:
- (a) A solo developer's personal side project with a dev and a prod environment in one AWS
  account.
- (b) A 12-person startup where prod must live in a separate AWS account from dev/staging for
  compliance reasons, but the team wants to move fast.
- (c) A 300-engineer company where the payments team's prod environment must be under a
  completely separate approval workflow from the marketing team's environments.

**Exercise 2 — Build a Directory-per-Environment Layout**
Starting from a single flat configuration with one `aws_instance` and one `aws_security_group`,
refactor it into the `modules/web-app` + `environments/{dev,staging,prod}` layout shown in §2.
Each environment should have its own `backend.tf` with a distinct state key.

**Exercise 3 — Design a Promotion Pipeline**
Sketch (as a diagram or bullet list) a CI/CD pipeline with three stages — dev, staging, prod —
where dev auto-applies on merge, staging requires one approval, and prod requires two approvals
plus a successful staging apply within the last 24 hours. Identify which CI system constructs
(environments, protected branches, required reviewers) would implement each gate.

**Exercise 4 — Spot the Drift**
Given two `terraform.tfvars` files — one for staging, one for prod — that reference different
module *versions* (not just different instance sizes), explain why this is a red flag and what
you'd change before the next promotion.

**Exercise 5 — Incident Postmortem**
Write a short (5–8 sentence) postmortem for a fictional incident: an engineer meant to apply a
security group change to `staging` but was still in the `prod` workspace from an earlier session,
and it silently applied to production. Identify the root cause and propose two structural
(not just "be more careful") fixes.

---

## 7. Interview Q&A

---

**Q1: What are the three main strategies for managing multiple Terraform environments?**

A: Workspaces (one configuration, multiple state files, no code duplication but shared
provider/backend), directory-per-environment (one root module per environment calling a shared
versioned module, allowing different backends/accounts per environment), and separate
repositories (fully independent codebases per environment, used by larger orgs with strict
compliance or ownership boundaries).

---

**Q2: When would you choose directory-per-environment over workspaces?**

A: When environments need different AWS accounts or credentials, different backend access
controls, or when you want it structurally harder to accidentally apply to the wrong environment
(you must `cd` into a directory rather than just switching a CLI pointer). It's the common choice
for small-to-mid-sized teams that need real isolation without the overhead of fully separate
repositories.

---

**Q3: How do you avoid duplicating resource code across environment directories?**

A: Put the actual resource logic in a shared, versioned module (e.g. `modules/web-app`), and make
each environment's directory a thin root module that calls that module with environment-specific
variable values and its own backend configuration. The environment directories should contain
variables, a backend block, and a provider block — not raw resource definitions.

---

**Q4: What does "promoting a change" mean in a multi-environment Terraform setup?**

A: It means the same validated code (typically a specific module version or a merged set of
`.tf` changes) moves through environments in order — dev, then staging, then prod — usually gated
by CI stages with manual approval before the production apply. Only input values differ per
environment; the underlying logic being applied to prod is identical to what was already tested
in staging.

---

**Q5: What's the most common real-world Terraform incident related to multiple environments, and
how do you prevent it?**

A: Applying the right change to the wrong environment — either a forgotten `terraform workspace
select` or CI running against the wrong directory. Prevention is structural: separate credentials
per environment so mistakes fail on permissions, mandatory plan review before prod applies, and
CI pipelines that pin which environment each job targets rather than relying on a human to
remember to switch.

---

**Q6: Why might a team outgrow workspaces and move to directory-per-environment?**

A: Once an environment needs its own AWS account, its own more restrictive backend access
controls, or resources that are structurally different (not just differently sized) from other
environments, workspaces can't express that — the provider and backend blocks are shared across
all workspaces of one configuration. Directory-per-environment gives each environment its own
backend and provider configuration while still sharing logic through a common module.
