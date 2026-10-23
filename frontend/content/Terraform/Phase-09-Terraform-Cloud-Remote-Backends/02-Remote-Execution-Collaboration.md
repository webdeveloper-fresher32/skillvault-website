# 02 — Remote Execution & Collaboration

## Table of Contents

1. [Local Execution vs Remote Execution Mode](#1-local-execution-vs-remote-execution-mode)
2. [The `cloud` Block Configuration](#2-the-cloud-block-configuration)
3. [Remote Run Lifecycle](#3-remote-run-lifecycle)
4. [Team Access & Permissions Model](#4-team-access--permissions-model)
5. [Notifications & Run Triggers Between Workspaces](#5-notifications--run-triggers-between-workspaces)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Local Execution vs Remote Execution Mode

Imagine a junior engineer joins your team and their laptop has an outdated Terraform version, a
stale AWS credentials file, and a slightly different provider version than everyone else's. They
run `terraform apply` against the production workspace and it behaves subtly differently than it
did on your machine yesterday — not because the `.tf` files changed, but because *the environment
running Terraform* changed. This is the exact class of bug that "remote execution mode" is
designed to eliminate: instead of Terraform running wherever a human happened to type the
command, it always runs inside a single, consistent, controlled environment.

### Analogy

Local execution is like every cook in a restaurant bringing their own knives, their own stove, and
their own recipe card from home — dinner service technically happens, but no two cooks are working
with quite the same tools, and mistakes are hard to trace back to a cause. Remote execution mode is
one shared, professional kitchen: everyone cooks with the same equipment, the same ingredient
supplier, and every dish that comes out is prepared under identical conditions.

### Comparison Table

| Dimension | Local Execution | Remote Execution (TFC) |
|-----------|-----------------|-------------------------|
| **Where `plan`/`apply` runs** | The engineer's own machine or CI runner | TFC's own runners (or self-hosted agents) |
| **Terraform version** | Whatever is installed locally; can drift between engineers | Pinned per-workspace, consistent for every run |
| **Credentials** | Stored/exported locally on each machine (risk of leakage) | Stored once as workspace variables, never touch a laptop |
| **State access** | Fetched to local disk (if not using a remote backend) | Never leaves TFC; runs execute next to the state |
| **Concurrency safety** | Depends on correctly configured external locking | Built-in: TFC serializes runs per workspace automatically |
| **Audit trail** | None, unless you build it yourself in CI logs | Full run history, logs, and plan diffs per workspace |
| **Policy enforcement (Sentinel/OPA)** | Not possible — nothing intercepts the local run | Runs through policy checks before apply is allowed |
| **Typical trigger** | A human typing a command | VCS push/PR, API call, scheduled run, or manual UI trigger |

### Under the Hood

When a workspace is set to **remote** execution mode, running `terraform plan` from your CLI does
not actually compute the plan on your machine. Instead:

```
Your machine                         Terraform Cloud
     │                                       │
     │  terraform plan                       │
     ├──────────────────────────────────────►│
     │   (uploads .tf files + variables)      │
     │                                       │  spins up an ephemeral run
     │                                       │  environment (container)
     │                                       │  with the pinned TF version
     │                                       │
     │                                       │  fetches state, runs plan
     │                                       │  against real provider APIs
     │                                       │
     │◄──────────────────────────────────────┤
     │   streams plan output back to your     │
     │   terminal in real time                │
```

Your local `terraform` CLI becomes essentially a thin client — it streams your configuration up,
and streams the plan/apply output back down for you to watch, but the actual execution and state
access happen entirely on TFC's side.

### Example

```hcl
terraform {
  cloud {
    organization = "acme-platform-team"

    workspaces {
      name = "app-prod"
    }
  }
}
```

With this block in place, `terraform plan` from your laptop transparently becomes a remote run:

```bash
$ terraform plan

Running plan in Terraform Cloud. Output will stream here. Pressing Ctrl-C
will stop streaming the logs, but will not stop the plan running remotely.

Preparing the remote plan...

To view this run in a browser, visit:
https://app.terraform.io/app/acme-platform-team/workspaces/app-prod/runs/run-Ab12Cd34EfGh56Ij

Waiting for the plan to start...
```

### Common Confusion

People assume "remote execution" only affects *where the state file lives*. It affects far more:
the Terraform binary version, the provider plugin downloads, environment variables, and the
compute environment executing the plan are all remote too. A workspace can use a remote *backend*
(state only) while still executing locally — this is different from full remote *execution mode*,
which TFC and TFE provide.

### Interview Answer

"In remote execution mode, Terraform Cloud runs `plan` and `apply` on its own infrastructure rather
than on the engineer's machine. Your local CLI uploads the configuration and streams back the run
output, but the Terraform binary version, provider downloads, credentials, and state access all
happen inside a consistent, TFC-managed environment. This removes 'works on my machine' drift and
lets TFC enforce policy checks and concurrency control that a purely local run can't provide."

> **Memory hook:** Local execution is BYO-knives cooking at home; remote execution is everyone cooking in the same professional kitchen with the same tools every time.

---

## 2. The `cloud` Block Configuration

You've seen the `cloud` block appear in every example so far — it's the single piece of
configuration that tells Terraform "don't manage state and execution the old way; hand this off to
Terraform Cloud instead." Before Terraform 1.1, this was done with a `backend "remote"` block; the
`cloud` block is the modern, purpose-built syntax and the one HashiCorp now recommends.

### Analogy

Think of the `cloud` block as changing your mailing address with the post office. You're not
changing anything about the letters themselves (your `.tf` resources) — you're just telling every
future piece of mail (every `plan`/`apply`) to be delivered to, and routed through, a completely
different address (TFC) instead of your own home mailbox (local state on disk).

### Configuration Anatomy

```hcl
terraform {
  cloud {
    organization = "acme-platform-team"     # required: your TFC organization

    hostname = "app.terraform.io"           # optional: defaults to app.terraform.io
                                              # (change only for Terraform Enterprise)

    workspaces {
      name = "app-prod"                      # single workspace, OR use `tags` below
      # tags = ["app", "prod"]               # dynamically match multiple workspaces
    }
  }
}
```

| Argument | Purpose | Notes |
|----------|---------|-------|
| `organization` | Which TFC organization this configuration belongs to | Required |
| `hostname` | Which TFC/TFE instance to talk to | Defaults to `app.terraform.io`; set for self-hosted TFE |
| `workspaces.name` | Bind this configuration to exactly one named workspace | Mutually exclusive with `tags` |
| `workspaces.tags` | Bind this configuration to any workspace carrying all listed tags | Useful for CLI-driven workspaces generated per branch/PR |

### Under the Hood

The `cloud` block replaces the entire traditional `backend` block — you cannot use both `backend`
and `cloud` in the same configuration. When present, Terraform's init step authenticates against
the configured `hostname` using credentials stored by `terraform login` (typically saved in
`~/.terraform.d/credentials.tfrc.json`), resolves the target workspace, and from that point every
`plan`/`apply` is redirected to remote execution as described in Section 1.

```
terraform init
      │
      ▼
Reads `cloud` block → looks up credentials for `hostname`
      │
      ▼
Authenticates → resolves organization + workspace
      │
      ▼
terraform plan/apply → executes remotely, streams output locally
```

### Example — Migrating an Existing Backend

```hcl
# BEFORE — traditional S3 backend
terraform {
  backend "s3" {
    bucket = "acme-tfstate"
    key    = "networking/prod/terraform.tfstate"
    region = "us-east-1"
  }
}
```

```hcl
# AFTER — migrated to Terraform Cloud
terraform {
  cloud {
    organization = "acme-platform-team"

    workspaces {
      name = "networking-prod"
    }
  }
}
```

```bash
# Terraform detects the backend change and offers to migrate existing state
$ terraform init

Initializing Terraform Cloud...
Do you wish to proceed with migrating the existing state? (yes/no)
  yes
```

### Common Mistakes

- **Leaving both a `backend` block and a `cloud` block in the same configuration.** This is a hard
  error — Terraform will refuse to initialize. Remove the `backend` block entirely when adopting
  the `cloud` block.
- **Hardcoding `hostname` to `app.terraform.io` when actually targeting a self-hosted Terraform
  Enterprise instance.** Forgetting to change this points your runs at the wrong service entirely.
- **Using `workspaces.name` for a scenario that actually needs per-branch or per-PR ephemeral
  workspaces.** In that case `tags` (matching workspaces dynamically) is usually the better fit
  than hardcoding a single workspace name.

### Interview Answer

"The `cloud` block, introduced in Terraform 1.1, is the modern way to bind a configuration to
Terraform Cloud. It specifies the organization, optionally the hostname for self-hosted Terraform
Enterprise, and which workspace (or set of tagged workspaces) the configuration maps to. It
replaces the older `backend "remote"` syntax and cannot coexist with a traditional `backend`
block — once you add `cloud`, TFC manages both your state and your run execution."

> **Memory hook:** The `cloud` block is a change-of-address form — same letters, new place they get delivered and processed.

---

## 3. Remote Run Lifecycle

Say your team has Sentinel policies enabled and cost estimation turned on. You open a pull request
that adds a new, oversized EC2 instance. What actually happens between "I clicked merge" and "the
instance exists in AWS" is not a single atomic step — it's a pipeline with several distinct gates,
any one of which can stop the run before it ever reaches `apply`.

### Analogy

A remote run is like a package going through customs before it's allowed into the country. First
someone inspects the manifest (plan), then customs calculates the duty owed (cost estimate), then
a compliance officer checks it against a list of banned items (policy check), then a human signs
off (approval), and only then does the package actually get delivered (apply). Skipping or failing
any one of those steps stops the package right there.

### The Lifecycle

```
┌───────────┐   ┌────────────────┐   ┌────────────────┐   ┌──────────┐   ┌────────┐
│   PLAN    │──►│ COST ESTIMATE  │──►│ POLICY CHECK   │──►│ APPROVE  │──►│ APPLY  │
│           │   │  (optional)    │   │  (Sentinel/OPA)│   │ (human   │   │        │
│ Terraform │   │ Estimates $    │   │ Advisory / Soft│   │ or auto) │   │ Runs   │
│ computes  │   │ impact of the  │   │ Mandatory /    │   │          │   │ actual │
│ diff vs   │   │ proposed       │   │ Hard Mandatory │   │          │   │ changes│
│ state     │   │ changes        │   │ rules evaluated│   │          │   │ against│
│           │   │                │   │ against the    │   │          │   │ real   │
│           │   │                │   │ plan's output   │   │          │   │ infra  │
└───────────┘   └────────────────┘   └────────────────┘   └──────────┘   └────────┘
      │                 │                     │                  │             │
      ▼                 ▼                     ▼                  ▼             ▼
  Can fail on       Informational        Can HARD-BLOCK      Can be         Can fail on
  syntax/provider   only, does not       the run entirely     rejected      provider
  errors            block the run        (hard-mandatory)     by a          errors, drift,
                                          or warn only         reviewer      etc.
                                          (advisory)
```

1. **Plan** — Terraform computes what would change, without touching real infrastructure.
2. **Cost estimate** — TFC (paid tiers) estimates the monthly cost delta of the plan, surfaced in
   the run UI and, if VCS-connected, in the PR comment.
3. **Policy check** — Sentinel or OPA policies (see Lesson 3) evaluate the plan's JSON output
   against organizational rules. A hard-mandatory failure stops the run cold; advisory failures
   just warn.
4. **Approve** — Unless auto-apply is enabled, a human with apply permission must click "Confirm &
   Apply" in the UI (or approve via the API/CLI).
5. **Apply** — Terraform executes the actual create/update/destroy calls against provider APIs and
   writes the new state.

### Example — A Run's Timeline in the TFC UI

```
Run #142 — networking-prod
─────────────────────────────────────────────────────────
✓ Plan finished           2 to add, 1 to change, 0 to destroy
✓ Cost estimate           +$47.30/month
✓ Policy check            2 passed, 0 failed (hard-mandatory)
✓ Confirmed by            jane.doe@acme.com
⏳ Apply in progress      Creating aws_instance.web[2]...
```

### Common Mistakes

- **Assuming cost estimation blocks a run.** It doesn't — it's informational only, unless you
  separately wire up a Sentinel policy that reads the cost estimate and enforces a limit on it.
- **Confusing "policy check failed" with "plan failed."** A plan can succeed perfectly (valid HCL,
  reachable providers) and still be blocked entirely at the policy-check stage because of a
  hard-mandatory Sentinel rule — these are two independent gates.
- **Forgetting that a stale plan can't be applied after too much time or too many other changes.**
  TFC discards or requires re-planning a run if the underlying state has moved on since the plan
  was generated, to avoid applying a plan against infrastructure it no longer accurately reflects.

### Interview Answer

"A Terraform Cloud run moves through distinct stages: plan, an optional cost estimate, a policy
check against Sentinel or OPA rules, a human or automated approval step, and finally apply. Each
stage can independently stop the run — a hard-mandatory policy failure blocks the run even if the
plan itself was completely valid. This staged pipeline is what lets an organization enforce
governance (cost limits, security rules, tagging standards) as a mandatory gate rather than a
suggestion someone might ignore."

> **Memory hook:** A remote run is a package going through customs — manifest, duty, banned-items check, signature, then delivery — and it can be turned back at any checkpoint.

---

## 4. Team Access & Permissions Model

Your organization has fifteen engineers. Three of them should be able to apply changes to
production. Everyone should be able to plan against staging to see what a change would do. The
intern should be able to read state outputs but never trigger a run at all. Terraform Cloud's team
permission model exists precisely to encode rules like this instead of relying on "please don't
touch prod" as a policy.

### Analogy

Think of it like a hospital's badge access system. Every staff badge (Team) is programmed with
specific door access (Workspace permissions): a nurse's badge opens patient wards but not the
pharmacy vault; a surgeon's badge opens the operating theater; only a small set of senior badges
open the vault where the controlled substances are locked away. The badge system doesn't rely on
people being polite — the door physically won't open without the right permission.

### The Model

```
┌────────────────────────────────────────────────────────────────┐
│  ORGANIZATION: acme-platform-team                                │
│                                                                    │
│  TEAM: "platform-engineers"     TEAM: "app-developers"            │
│    members: alice, bob            members: carol, dave, intern    │
│                                                                    │
│  Workspace permissions per team, set independently per workspace: │
│                                                                    │
│  Workspace "networking-prod"                                      │
│    platform-engineers → Write (plan + apply)                      │
│    app-developers      → Read (view state/outputs only)           │
│                                                                    │
│  Workspace "app-staging"                                          │
│    platform-engineers → Admin (full control incl. settings)       │
│    app-developers      → Plan (can plan, cannot apply)             │
└────────────────────────────────────────────────────────────────┘
```

| Permission Level | Can do |
|-------------------|--------|
| **Read** | View workspace, state outputs, run history |
| **Plan** | Everything in Read, plus trigger plan-only runs |
| **Write** | Everything in Plan, plus apply runs, manage variables |
| **Admin** | Everything in Write, plus manage workspace settings, VCS connection, team access itself |

Permissions are assigned per **team**, per **workspace** — a team can be `Admin` on one workspace
and have no access at all to another. Individual users are added to teams; they never receive
permissions directly, which keeps access reviewable and consistent as people join or leave.

### Common Mistakes

- **Granting individual users direct workspace access instead of managing everything through
  teams.** This makes access reviews and offboarding painful — always add/remove people from
  teams, not workspaces directly.
- **Giving everyone Admin "to be safe."** Admin includes the ability to change VCS connections and
  team access itself — a much broader blast radius than most engineers need day to day.
- **Assuming organization-level "Owners" team membership is the same as workspace Admin.**
  Organization owners have broad org-wide power (billing, SSO, team creation) but workspace-level
  permissions are still assigned per workspace on top of that.

### Interview Answer

"Terraform Cloud grants permissions to teams, and teams are then given a permission level — Read,
Plan, Write, or Admin — on specific workspaces. This means the same person can have Write access to
staging and only Read access to production, purely based on which teams they belong to. It avoids
per-user permission sprawl and makes onboarding, offboarding, and audits straightforward, since you
just add or remove someone from a team rather than reconfiguring access on every workspace
individually."

> **Memory hook:** Teams are hospital badges — programmed for specific doors (workspaces), and the door won't open without the right clearance, no matter how polite you ask.

---

## 5. Notifications & Run Triggers Between Workspaces

Your infrastructure is split across workspaces on purpose — `networking-prod` provisions the VPC
and subnets, and `app-prod` deploys application servers into that VPC using data sources to read
its outputs. But what happens when `networking-prod` changes? Someone needs to know, and often,
`app-prod` needs to automatically re-plan against the new networking outputs. That's exactly what
**notifications** and **run triggers** solve.

### Analogy

Think of a relay race. Notifications are like a coach on the sideline yelling updates to everyone
watching ("leg one just finished, here's the split time") — informational, no one's forced to act.
Run triggers are the literal baton handoff: when the first runner (workspace) finishes, it
physically triggers the next runner (a dependent workspace) to start running, automatically, no
one has to yell "go" — the handoff itself starts the next leg.

### Notifications

Configured per workspace, notifications push run status events to external systems:

| Destination | Typical use |
|-------------|-------------|
| **Slack / Microsoft Teams** | Post a message when a run needs confirmation, or completes/fails |
| **Email** | Notify specific users of run state changes |
| **Generic webhook** | Feed run events into your own incident/ChatOps tooling |

```
Run state change (e.g., "planned_and_needs_confirmation", "applied", "errored")
                │
                ▼
     TFC notification configuration
                │
        ┌───────┴────────┐
        ▼                ▼
    Slack webhook    Generic webhook → internal dashboard
```

### Run Triggers

A run trigger lets Workspace B automatically queue a new run whenever Workspace A finishes a
successful apply — used when B's configuration depends on A's outputs (via `terraform_remote_state`
data sources or TFC's workspace output referencing).

```hcl
# app-prod workspace configuration references networking-prod's outputs
data "terraform_remote_state" "networking" {
  backend = "remote"

  config = {
    organization = "acme-platform-team"
    workspaces = {
      name = "networking-prod"
    }
  }
}

resource "aws_instance" "web" {
  subnet_id = data.terraform_remote_state.networking.outputs.public_subnet_id
  # ...
}
```

With a run trigger configured (Workspace Settings → Run Triggers, in the `app-prod` workspace,
pointing back at `networking-prod`), any successful apply of `networking-prod` automatically
queues a new plan in `app-prod` — so if the subnet ID changes, `app-prod` immediately shows you
what that change means downstream, without anyone needing to remember to check.

### Common Mistakes

- **Building long, implicit chains of run triggers across many workspaces** without documenting
  them anywhere — a change in workspace A can silently cascade through five other workspaces, and
  when something breaks, no one immediately knows which trigger fired.
  Chains this deep usually need to be diagrammed and owned explicitly.
- **Relying on run triggers instead of `terraform_remote_state` data sources for actual data
  flow.** Run triggers only queue a new run — they don't pass data. The actual output values must
  still be read via `terraform_remote_state` or another lookup mechanism.
- **Forgetting that a triggered run still goes through the full lifecycle** (plan, policy check,
  approval if not auto-applying) — it's not a bypass around governance, just an automatic kickoff.

### Interview Answer

"Notifications and run triggers solve two different problems. Notifications push run status events
— started, needs confirmation, applied, errored — to Slack, email, or a webhook, purely for
visibility. Run triggers are functional: they let one workspace automatically queue a new run in a
dependent workspace whenever the upstream workspace applies successfully, which matters when
workspaces are split by layer (like networking vs. application) and downstream configuration reads
the upstream workspace's outputs via `terraform_remote_state`."

> **Memory hook:** Notifications are the coach yelling updates from the sideline; run triggers are the actual baton handoff that starts the next runner automatically.

---

## 6. Common Mistakes

- **Treating remote execution as "just a different backend."** It changes where the Terraform
  binary runs, not just where state lives — Terraform version, provider downloads, and credentials
  all move to TFC too.
- **Leaving both `backend` and `cloud` blocks in a configuration.** This is a hard init-time error;
  the `cloud` block fully replaces the traditional backend configuration.
- **Skipping the policy-check stage mentally** when reasoning about run failures — a valid plan can
  still be blocked entirely by a hard-mandatory Sentinel/OPA policy.
- **Assigning permissions to individuals instead of teams**, which breaks down as the org scales and
  makes offboarding error-prone.
- **Building deep, undocumented run-trigger chains** across many workspaces with no clear ownership
  of the dependency graph.

> **Memory hook:** Nearly every mistake here comes from underestimating how much more Terraform Cloud does than "store state remotely" — it runs the show end to end: execution, gates, access, and cross-workspace wiring.

---

## 7. Hands-On Exercises

**Exercise 1 — Migrate to the `cloud` block**
Take a configuration currently using an S3 backend and migrate it to the `cloud` block, following
the migration prompt from `terraform init`. Confirm the state now lives in TFC.

**Exercise 2 — Trace a Run's Lifecycle**
Enable cost estimation (if available on your plan) on a workspace and apply a change that adds a
billable resource (e.g., an `aws_instance`). Screenshot or note each stage of the run (plan → cost
estimate → policy check → approve → apply) as it appears in the UI.

**Exercise 3 — Team Permissions**
Create two teams in your organization: `readers` and `deployers`. Grant `readers` Read access and
`deployers` Write access to a test workspace. Add a colleague (or a second test account) to
`readers` and confirm they cannot trigger an apply.

**Exercise 4 — Run Triggers Across Workspaces**
Create two workspaces: `net-demo` (an `aws_vpc` + subnet) and `app-demo` (an `aws_instance` reading
the subnet ID via `terraform_remote_state`). Configure a run trigger from `net-demo` into
`app-demo`. Apply a change in `net-demo` and confirm `app-demo` automatically queues a new plan.

**Exercise 5 — Notification Wiring**
Configure a Slack (or generic webhook, using a tool like webhook.site for testing) notification on
a workspace for the "needs confirmation" and "errored" run states. Trigger a run and confirm the
notification fires.

---

## 8. Interview Q&A

---

**Q1: What actually changes when a workspace is set to remote execution mode?**

A: The Terraform binary version, provider plugin downloads, environment variables/credentials, and
the actual `plan`/`apply` execution all move to TFC's infrastructure instead of the local machine.
Your local CLI becomes a thin client that uploads configuration and streams back run output.

---

**Q2: Can you use both a `backend` block and a `cloud` block together?**

A: No. The `cloud` block fully replaces a traditional `backend` block. Having both in the same
configuration is a hard error at `terraform init` time.

---

**Q3: What stages does a Terraform Cloud run go through?**

A: Plan, an optional cost estimate, a policy check (Sentinel or OPA), an approval step (human or
automatic), and apply. Each stage can independently stop the run — most notably, a hard-mandatory
policy failure blocks the run even when the plan itself is completely valid.

---

**Q4: How are permissions assigned in Terraform Cloud?**

A: Permissions are assigned to teams, and teams are granted a permission level — Read, Plan, Write,
or Admin — on specific workspaces. Individual users get permissions only through team membership,
which keeps access reviewable and avoids per-user permission sprawl.

---

**Q5: What's the difference between a notification and a run trigger?**

A: A notification pushes run status events (started, needs confirmation, applied, errored) to an
external system like Slack or a webhook, purely for visibility. A run trigger functionally queues a
new run in a dependent workspace whenever the upstream workspace applies successfully — used when
one workspace's configuration depends on another's outputs.

---

**Q6: If workspace B has a run trigger pointing at workspace A, does B automatically receive A's
output values?**

A: No. A run trigger only queues a new run in B; it does not pass data. B must still read A's
outputs explicitly, typically via a `terraform_remote_state` data source pointed at workspace A.

---

**Q7: Why might cost estimation not stop a risky, expensive change from being applied?**

A: Cost estimation in Terraform Cloud is informational by default — it surfaces the estimated
monthly cost delta in the run UI and PR comments, but it does not block the run on its own. To
actually enforce a cost limit, you need a Sentinel (or OPA) policy that reads the cost estimate data
and hard-fails the run if it exceeds a threshold.
