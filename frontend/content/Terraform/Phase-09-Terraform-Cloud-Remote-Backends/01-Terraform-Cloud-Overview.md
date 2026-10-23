# 01 — Terraform Cloud Overview

## Table of Contents

1. [Why Terraform Cloud / Enterprise](#1-why-terraform-cloud--enterprise)
2. [Terraform Cloud Concepts](#2-terraform-cloud-concepts)
3. [Free vs Paid Tiers Overview](#3-free-vs-paid-tiers-overview)
4. [Connecting a VCS Repo to a TFC Workspace](#4-connecting-a-vcs-repo-to-a-tfc-workspace)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Terraform Cloud / Enterprise

Picture this: your platform team has grown from "just me running `terraform apply` from my
laptop" to five engineers across three time zones, all touching the same AWS account. Monday
morning, two people run `terraform apply` within seconds of each other on the same workspace.
One of them silently overwrites the other's changes because both were working off a
`terraform.tfstate` file sitting in a shared S3 bucket with no locking configured correctly. Nobody
can say who ran what, when, or why the VPC subnet suddenly changed CIDR blocks last Thursday. This
is not a hypothetical — it's the exact failure mode that pushes every growing team toward a
managed control plane for Terraform, and that's what **Terraform Cloud (TFC)** and
**Terraform Enterprise (TFE)** are for.

Terraform Cloud is HashiCorp's managed SaaS offering that runs `terraform plan` and
`terraform apply` for you, remotely, with the state, locking, run history, and access control
already built in. Terraform Enterprise is the same product, self-hosted inside your own
infrastructure for organizations with strict compliance or air-gapped requirements. Running
Terraform "locally" (from your own laptop or a bare CI runner with a hand-rolled S3 backend) works
fine for a solo developer or a tiny team, but it breaks down in three specific, recurring ways:

- **State locking** — two people applying at once can corrupt state or silently clobber each
  other's changes, unless every engineer correctly wires up DynamoDB locking (or an equivalent) on
  every workspace, every time, with zero mistakes.
- **Run history / audit trail** — "who ran this apply, what did it change, and can we see the plan
  output from three weeks ago?" is either "check the CI logs across five different pipelines" or,
  with TFC, a single searchable list of runs per workspace.
- **Access control** — "the intern should be able to plan against staging but never apply against
  production" needs to be enforced somewhere. Locally, that "somewhere" is usually nothing more
  than a polite Slack message asking people not to touch prod.

### Analogy

Running Terraform locally with a shared state file is like a group of roommates sharing one
physical checkbook with no ledger and no lock on the drawer. Anyone can grab it, write a check,
and put it back — and if two roommates grab it at the same time, one person's entry gets lost.
Terraform Cloud is switching that household to a shared bank account with an actual bank behind
it: every transaction is logged with a timestamp and a name attached, the account physically
cannot process two conflicting withdrawals at once, and you can set rules like "any withdrawal
over $500 needs a second signature before it clears."

### Under the Hood

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LOCAL EXECUTION (before TFC)                     │
│                                                                        │
│  Engineer A's laptop ──┐                                             │
│                        │  both write to same state file               │
│  Engineer B's laptop ──┼──► S3 bucket (state) + DynamoDB (lock table) │
│                        │      - locking only works if EVERYONE        │
│                        │        configured the backend correctly      │
│  CI pipeline ──────────┘      - no shared run history                 │
│                                - no built-in "who can apply what"      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   REMOTE EXECUTION (with Terraform Cloud)             │
│                                                                        │
│  Engineer A ──┐                                                       │
│               │                                                       │
│  Engineer B ──┼──► TFC Organization                                  │
│               │       └── Workspace: "networking-prod"                │
│  CI pipeline ─┘             ├── State: versioned, locked automatically │
│                              ├── Runs: full plan/apply history, logs   │
│                              ├── Team access: who can plan/apply       │
│                              └── Runs execute on HashiCorp's runners   │
│                                  (or self-hosted agents), not laptops  │
└──────────────────────────────────────────────────────────────────────┘
```

The key architectural shift: instead of `terraform apply` executing *on your machine* against
state *you* fetched, TFC executes the plan and apply on its own remote runners, inside its own
sandboxed environment, and is the single source of truth for state. Your laptop just sends the
configuration and receives back a plan to review.

### Example

```hcl
# main.tf — pointing this configuration at Terraform Cloud
terraform {
  cloud {
    organization = "acme-platform-team"

    workspaces {
      name = "networking-prod"
    }
  }

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

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name        = "prod-vpc"
    ManagedBy   = "terraform-cloud"
    Environment = "production"
  }
}
```

Running `terraform login` once authenticates your CLI against TFC, and from then on
`terraform plan` / `terraform apply` are transparently executed on TFC's infrastructure instead of
locally — with locking, history, and access control all handled for you.

### Common Mistakes

- **Thinking TFC is "just a fancier S3 backend."** It is a full remote execution platform — the
  `plan`/`apply` *processes themselves* run on TFC's servers, not just the state file.
  Environment variables, provider credentials, and even the Terraform binary version live on TFC,
  not on your laptop.
- **Assuming TFC and TFE are different products.** They are the same software; TFE is simply the
  self-hosted deployment for enterprises with data-residency or air-gap requirements. Feature sets
  differ mostly by license tier, not by product name.
- **Forgetting that local state and TFC-managed state are mutually exclusive per workspace** —
  once a workspace is set to remote/cloud execution, you don't also keep a local
  `terraform.tfstate` file as a fallback; TFC *is* the state store.

### Interview Answer

"Terraform Cloud is HashiCorp's managed control plane for Terraform runs. It solves three
problems that appear as soon as more than one person touches the same infrastructure: state
locking (so two applies can't corrupt state), run history (a full audit trail of every plan and
apply, who triggered it, and what changed), and access control (team-based permissions on who can
plan vs. apply on which workspace). Terraform Enterprise is the same product, self-hosted for
organizations that need it inside their own network."

> **Memory hook:** Local Terraform is a shared checkbook in a kitchen drawer; Terraform Cloud is a real bank account with a ledger, a lock, and a signature policy.

---

## 2. Terraform Cloud Concepts

You log into Terraform Cloud for the first time and you're greeted with a form asking for an
"Organization name," and once inside, a button to create a "Workspace." These aren't just UI
labels — they map onto a specific hierarchy that determines who can see what, and how runs are
isolated from each other. Understanding this hierarchy up front saves you from the classic
new-user mistake of creating fifty ungrouped workspaces with no idea how permissions cascade.

### Analogy

Think of a large accounting firm. The **Organization** is the firm itself — one legal entity with
one billing relationship with HashiCorp. Inside the firm there are **Workspaces**, which are like
individual client folders — the "Acme Corp networking" folder is completely separate from the
"Acme Corp application" folder, each with its own set of variables, its own state, and its own
list of who's allowed to touch it. Every time an accountant actually does work on a folder — files
a return, updates a ledger — that's a **Run**: a single, timestamped, logged unit of work with a
clear before-and-after.

### Concept Breakdown

```
┌────────────────────────────────────────────────────────────────┐
│  ORGANIZATION: "acme-platform-team"                             │
│  (billing entity, SSO config, org-wide policy sets, teams)      │
│                                                                   │
│  ┌───────────────────────┐   ┌───────────────────────┐          │
│  │ WORKSPACE:            │   │ WORKSPACE:            │          │
│  │ "networking-prod"     │   │ "app-staging"         │          │
│  │                        │   │                        │          │
│  │ - Own state file       │   │ - Own state file       │          │
│  │ - Own variables/secrets│   │ - Own variables/secrets│          │
│  │ - Own VCS connection    │   │ - Own VCS connection    │          │
│  │ - Own team permissions  │   │ - Own team permissions  │          │
│  │                        │   │                        │          │
│  │  ┌──────────────────┐  │   │  ┌──────────────────┐  │          │
│  │  │ RUN #142          │  │   │  │ RUN #58            │  │          │
│  │  │ plan → apply       │  │   │  │ plan (pending)      │  │          │
│  │  │ triggered by push   │  │   │  │ triggered manually  │  │          │
│  │  │ status: applied     │  │   │  │ status: awaiting    │  │          │
│  │  │                    │  │   │  │  confirmation       │  │          │
│  │  └──────────────────┘  │   │  └──────────────────┘  │          │
│  └───────────────────────┘   └───────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

| Concept | What it is | Scope | Analogy |
|---------|-----------|-------|---------|
| **Organization** | The top-level account; owns billing, SSO, org-level teams and policies | One per company or business unit | The accounting firm itself |
| **Workspace** | A single, isolated set of Terraform configuration + state + variables | One per environment/component (e.g., `networking-prod`, `app-staging`) | A client's dedicated folder |
| **Run** | A single execution: plan, and optionally apply, of a workspace's configuration | One per triggered change (VCS push, API call, manual button) | One billing cycle of work on that folder |

A single organization typically has dozens to hundreds of workspaces — one per
environment-per-component combination is a common pattern (`networking-prod`,
`networking-staging`, `app-prod`, `app-staging`, and so on), rather than one giant workspace for
everything.

### Common Confusion

New users often try to model "dev, staging, prod" as three *organizations*. That's backwards —
organizations are for separating *companies or large business units* (and their billing), while
environments belong at the *workspace* level, often paired with Terraform's own workspace concept
or, more commonly in TFC, simply as separate named workspaces (`app-dev`, `app-staging`,
`app-prod`) each pointing at the same VCS repo but different variable sets.

### Interview Answer

"Terraform Cloud has a three-level hierarchy. An Organization is the billing and identity boundary
— one per company. Inside it, Workspaces are the unit of isolation for a specific piece of
infrastructure — each has its own state, variables, and permissions, similar to a working
directory in local Terraform but centrally managed. A Run is a single plan/apply execution inside
a workspace, fully logged with its inputs, outputs, and the user or automation that triggered it."

> **Memory hook:** Organization = the firm, Workspace = the client folder, Run = one billing cycle of actual work on that folder.

---

## 3. Free vs Paid Tiers Overview

Before you architect your workspace strategy around TFC, it's worth knowing what's actually free
and what starts costing money — because "we designed our whole workflow around Sentinel policies"
only to discover Sentinel needs a paid plan is an expensive lesson to learn after the fact.

HashiCorp offers Terraform Cloud in several tiers. The exact pricing and feature gating shifts
over time, so always check HashiCorp's current pricing page before committing an architecture to
a specific tier, but the broad shape has been stable for years:

| Tier | Who it's for | Included |
|------|-------------|----------|
| **Free** | Individuals, small teams, learning | Unlimited workspaces, remote state, remote execution, VCS integration, basic run history, up to 5 users |
| **Standard / Team & Governance** | Growing teams needing collaboration controls | Team-based access controls (RBAC), more users, cost estimation, private module registry |
| **Plus** | Organizations needing governance at scale | Sentinel policy as code, policy enforcement, run tasks, SSO, audit logging |
| **Terraform Enterprise (self-hosted)** | Regulated/air-gapped enterprises | Everything in Plus, deployed inside your own network, dedicated support, custom SLAs |

### Analogy

Think of it like a gym membership ladder. The free tier gets you into the building and lets you
use the basic equipment (remote state, remote execution) — plenty for one person's workout. The
paid tiers add a personal trainer who enforces your form (Sentinel policy enforcement), a private
locker room only your team can access (RBAC, SSO), and a dedicated private facility built inside
your own building for the most security-conscious clients (Terraform Enterprise, self-hosted).

### Common Mistakes

- **Assuming remote state and locking require a paid plan.** They don't — these are available on
  the Free tier and are the primary reason most small teams adopt TFC in the first place.
- **Building a Sentinel-based governance strategy without confirming the plan tier first.**
  Sentinel (Phase 09, Lesson 3) is gated behind paid tiers; teams on Free tier needing policy
  enforcement typically reach for Open Policy Agent (OPA) integrations or `terraform validate` /
  `checkov` in CI instead.
- **Confusing "Terraform Enterprise" with "the Enterprise tier of Terraform Cloud."** TFE is a
  separately deployed, self-hosted product, not just a bigger plan inside the SaaS product.

### Interview Answer

"Terraform Cloud's free tier already covers the two things that matter most for small teams:
remote state with locking, and remote plan/apply execution with a run history and VCS
integration. Paid tiers layer on governance features — team-based RBAC, SSO, cost estimation, and
critically Sentinel policy-as-code enforcement — and Terraform Enterprise takes the whole product
and lets you self-host it for compliance reasons. The decision of which tier to use usually comes
down to whether you need enforced policy gates before an apply can happen."

> **Memory hook:** Free gets you in the gym door; paid tiers hire you a trainer who enforces the rules (Sentinel), and Enterprise builds you a private gym in your own basement.

---

## 4. Connecting a VCS Repo to a TFC Workspace

Here's the workflow every team eventually wants: an engineer opens a pull request that changes a
`.tf` file, and *before anyone merges anything*, they see a Terraform plan output as a comment on
that PR — no one has to remember to run `terraform plan` locally, and no one can merge a change
without at least seeing what it would do. That workflow only exists because the TFC workspace is
directly wired to your version control system (GitHub, GitLab, Bitbucket, Azure DevOps).

### Analogy

It's the difference between a restaurant kitchen that waits for someone to manually walk in and
hand them a written order (local `terraform apply`) versus a kitchen wired directly into the
front-of-house ordering system, where every new order placed at a table automatically prints a
ticket in the kitchen the instant it's submitted (VCS-driven runs). The VCS connection turns
"someone has to remember to trigger this" into "it just happens."

### Under the Hood

```
 Developer                GitHub Repo             Terraform Cloud Workspace
     │                         │                             │
     │  git push (feature      │                             │
     │  branch or PR)          │                             │
     ├────────────────────────►│                             │
     │                         │  webhook fires on push/PR    │
     │                         ├────────────────────────────►│
     │                         │                             │  fetches repo contents
     │                         │                             │  at that commit SHA
     │                         │                             │
     │                         │                             │  runs `terraform plan`
     │                         │                             │  on TFC's remote runner
     │                         │                             │
     │                         │◄────────────────────────────┤
     │                         │  posts plan summary as a     │
     │                         │  PR status check / comment   │
     │◄────────────────────────┤                             │
     │  sees plan in PR UI     │                             │
```

### Example

Setting up the connection is mostly point-and-click in the TFC UI (Workspace → Settings → Version
Control), but the workspace's resulting configuration is expressed the same way as any other
cloud-backed workspace:

```hcl
# main.tf — this workspace is configured in the TFC UI to track
# the "main" branch of github.com/acme-org/networking-infra,
# watching the "networking/" subdirectory
terraform {
  cloud {
    organization = "acme-platform-team"

    workspaces {
      name = "networking-prod"
    }
  }
}
```

```
# Typical VCS-driven workspace settings (configured in TFC UI):
VCS provider:       GitHub (via OAuth or GitHub App)
Repository:         acme-org/networking-infra
Branch:             main
Working directory:  networking/
Trigger patterns:   networking/**/*.tf
Auto-apply:         false   # require a human to click "Confirm & Apply"
```

Once connected, every push to `main` (or every PR against it, depending on settings) triggers a
**speculative plan** — a plan-only run with no ability to apply — shown directly on the pull
request. Merging to `main` then triggers a real run that can be applied (auto-applied, or
requiring manual confirmation, depending on workspace settings).

### Common Mistakes

- **Forgetting to set a "working directory."** If your repo has multiple Terraform root modules
  (e.g., `networking/`, `app/`, `database/`) and you don't scope the workspace to the correct
  subdirectory, TFC will try to run Terraform from the repo root and fail to find the right
  configuration, or worse, apply the wrong module.
- **Enabling auto-apply on a production workspace without a policy gate.** Auto-apply means *any*
  merge to the tracked branch applies immediately with no human confirmation — fine for a sandbox
  workspace, dangerous for `networking-prod` unless you also have Sentinel or a required PR review
  process guarding the merge itself.
- **Not restricting trigger patterns.** Without a trigger pattern scoped to relevant paths, editing
  a completely unrelated README in the same repo can trigger an unnecessary plan run.

### Interview Answer

"Connecting a VCS repo to a TFC workspace means TFC subscribes to a webhook from your GitHub (or
GitLab/Bitbucket) repository. Every push or pull request against the tracked branch and directory
triggers a run: pull requests get a speculative, plan-only run shown as a status check, and merges
to the tracked branch trigger a real run that can apply, either automatically or after a human
confirms it in the UI. This turns 'someone remembers to run terraform plan' into a mandatory,
automatic part of the PR workflow."

> **Memory hook:** A VCS-connected workspace is a kitchen wired directly to the front-of-house ordering system — every merge prints a ticket automatically, no one has to walk it in by hand.

---

## 5. Common Mistakes

Beyond the mistakes already called out per-section, a few overarching pitfalls trip up teams
adopting Terraform Cloud for the first time:

- **Migrating state to TFC without first running `terraform state pull` to back it up.** Always
  keep a backup of your existing state before switching a workspace's execution mode.
- **Assuming CLI-driven and VCS-driven workspaces are interchangeable at will.** A workspace's
  execution mode (`local`, `remote` via CLI-driven workflow, or `remote` via VCS-driven workflow)
  is a meaningful setting, not just cosmetic — switching it changes how runs are triggered.
- **Not setting workspace-specific variables and instead relying on shared, org-level variables for
  everything.** This causes "it worked in staging but broke in prod" because a variable value that
  should have differed per environment didn't.
- **Treating the Free tier's 5-user limit as a hard technical ceiling on team size** rather than
  understanding it's a licensing boundary — teams larger than 5 need a paid tier, not a workaround.

> **Memory hook:** Most Terraform Cloud onboarding mistakes come from treating it like "the same local workflow, just hosted somewhere else" instead of the genuinely different, more structured system it is.

---

## 6. Hands-On Exercises

**Exercise 1 — Sign Up and Explore**
Create a free Terraform Cloud account at app.terraform.io. Create an organization. Note down: how
many workspaces does the free tier allow? How many users?

**Exercise 2 — CLI-Driven Workspace**
Configure a small local Terraform project (a single `aws_s3_bucket` resource is enough) to use the
`cloud` block pointing at a new workspace. Run `terraform login`, then `terraform init` and
`terraform apply`. Confirm in the TFC UI that the run, plan output, and state now live remotely.

**Exercise 3 — VCS-Driven Workspace**
Push that same project to a GitHub repository. Create a second TFC workspace, this time connecting
it directly to the GitHub repo instead of using the `cloud` block's CLI-driven flow. Open a pull
request that changes the S3 bucket's tags and observe the speculative plan appear as a status
check on the PR.

**Exercise 4 — Tier Comparison Research**
Look up HashiCorp's current Terraform Cloud pricing page. List three features available on a paid
tier but not on Free, and explain which of those three would matter most to a 20-person platform
team.

**Exercise 5 — Organization vs Workspace Design**
A company has three business units (Retail, Logistics, Finance), each running dev/staging/prod
environments for two applications each. Sketch (on paper or in a text file) how you would
structure Terraform Cloud organizations and workspaces for this company. Justify your structure.

---

## 7. Interview Q&A

---

**Q1: What problem does Terraform Cloud solve that local Terraform doesn't?**

A: Local Terraform requires every engineer to correctly configure state locking, and gives no
built-in run history or access control. Terraform Cloud provides these centrally: automatic state
locking, a full audit trail of every plan and apply, and team-based permissions on who can plan vs.
apply per workspace.

---

**Q2: What is the difference between Terraform Cloud and Terraform Enterprise?**

A: They are the same underlying product. Terraform Cloud is HashiCorp's hosted SaaS version.
Terraform Enterprise is the self-hosted version, deployed inside a company's own infrastructure,
typically chosen for compliance, data-residency, or air-gapped network requirements.

---

**Q3: Describe the Organization → Workspace → Run hierarchy.**

A: An Organization is the top-level billing and identity boundary, usually one per company.
Workspaces live inside an organization and are the unit of isolation for a specific piece of
infrastructure — each has its own state, variables, and permissions. A Run is a single execution
(plan, and optionally apply) within a workspace, fully logged with inputs, outputs, and the
trigger source.

---

**Q4: Is remote state locking a paid feature in Terraform Cloud?**

A: No. Remote state storage, automatic locking, and remote execution are all available on the
Free tier. Paid tiers add governance features like Sentinel policy enforcement, SSO, RBAC, and
cost estimation.

---

**Q5: How does a VCS-connected workspace behave differently on a pull request versus a merge?**

A: A pull request against the tracked branch triggers a speculative plan — a plan-only run with no
ability to apply, shown as a status check on the PR. Merging to the tracked branch triggers a real
run that can apply, either automatically (if auto-apply is enabled) or after a human clicks confirm
in the TFC UI.

---

**Q6: What is a "working directory" setting in a VCS-connected workspace, and why does it matter?**

A: It scopes the workspace to a specific subdirectory of the repository, so that TFC runs Terraform
against the correct root module rather than the repository root — critical for monorepos containing
multiple Terraform configurations.

---

**Q7: Would you recommend auto-apply for a production workspace? Why or why not?**

A: Generally no, unless it's paired with a strong policy gate (Sentinel, or a strict PR review and
branch protection process). Auto-apply means any merge to the tracked branch applies immediately
with no human confirmation step inside TFC itself, which removes a safety checkpoint for
production-impacting changes.
