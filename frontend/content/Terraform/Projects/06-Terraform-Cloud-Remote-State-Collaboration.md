# Project 6 — Terraform Cloud: Remote State & Team Collaboration

**Level:** Advanced
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 9 – Terraform Cloud & Remote Backends, Phase 12 – Production Best Practices

---

## Overview

You will migrate a local (or S3-backed) Terraform configuration to **Terraform Cloud (HCP Terraform)**, replacing manual `plan`/`apply` runs with a managed workspace that:

- Stores state remotely with locking, versioning, and encryption handled for you — no S3 bucket or DynamoDB table to maintain.
- Runs `plan` and `apply` **in Terraform Cloud's own infrastructure**, not on your laptop or in GitHub Actions, using the `cloud` block.
- Is **connected to your VCS repository (GitHub)**, so pushing a commit automatically triggers a plan, and merging can automatically trigger an apply — the same outcome as Project 5's pipeline, but using Terraform's native remote-run product instead of hand-rolled Actions steps.
- Supports **team-based access**: different Terraform Cloud teams can be granted read, plan, or write permissions on the workspace independent of anyone's individual AWS credentials.

```
Local state ──migrate──▶ Terraform Cloud workspace
                              │
                    VCS-connected to GitHub repo
                              │
              push to branch ──▶ remote plan (runs in HCP Terraform)
              merge to main  ──▶ remote apply (with optional manual confirm)
```

---

## Prerequisites

- A free Terraform Cloud account (https://app.terraform.io) — the free tier supports remote state and VCS-driven runs for a small number of users
- Completed Project 1 or Project 3 with a working local (or S3) state file to migrate
- The GitHub repository containing that Terraform code, with Terraform Cloud granted access to it
- AWS credentials that Terraform Cloud will use to run `plan`/`apply` remotely — added as **workspace variables**, not committed to code

---

## Step-by-Step Instructions

### Step 1 — Create an organization and workspace in Terraform Cloud

1. Sign in at [app.terraform.io](https://app.terraform.io) and create an organization, e.g. `my-org-terraform`.
2. Click **New workspace** → choose **Version control workflow** → connect your GitHub account → select the repository containing your Terraform code (e.g. the Project 3 root module).
3. Set the working directory if your `.tf` files live in a subdirectory (e.g. `03-multi-tier-app-infra`).
4. Name the workspace, e.g. `multitier-app-prod`.

### Step 2 — Add the `cloud` block to your configuration

Replace any existing `backend "s3" { ... }` block (or add fresh, if you had none) with the `cloud` block in your `main.tf`:

```hcl
terraform {
  required_version = ">= 1.5.0"

  cloud {
    organization = "my-org-terraform"

    workspaces {
      name = "multitier-app-prod"
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
  region = var.aws_region
}
```

> The `cloud` block replaces the `backend` block entirely — Terraform will refuse to have both in the same configuration. This is HCP Terraform's native integration, distinct from using Terraform Cloud purely as a generic remote backend.

### Step 3 — Authenticate the CLI to Terraform Cloud

```bash
terraform login
```

This opens a browser, generates an API token, and stores it in `~/.terraform.d/credentials.tfrc.json` so your local CLI can talk to the workspace.

### Step 4 — Migrate existing state into the workspace

If you have local state (or state in S3) from an earlier project, run `init` and confirm the migration when prompted:

```bash
terraform init
```

```
Initializing Terraform Cloud...

Do you wish to proceed?
  As part of migrating to Terraform Cloud, Terraform can optionally copy your
  current workspace state to the configured Terraform Cloud workspace.

  Enter "yes" to proceed with the migration.
```

Type `yes`. Terraform uploads your existing state as the workspace's first state version — nothing about your real infrastructure changes, only where the *record* of it lives.

### Step 5 — Set workspace variables (AWS credentials + Terraform variables)

In the Terraform Cloud UI, go to your workspace → **Variables**, and add:

**Terraform variables** (used inside your `.tf` files, e.g. from `variables.tf`):

| Key | Value | Category |
|-----|-------|----------|
| `aws_region` | `us-east-1` | Terraform variable |
| `key_name` | `my-terraform-key` | Terraform variable |
| `db_password` | `********` | Terraform variable, marked **Sensitive** |

**Environment variables** (consumed by the AWS provider directly):

| Key | Value | Category |
|-----|-------|----------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Environment variable, marked **Sensitive** |
| `AWS_SECRET_ACCESS_KEY` | `********` | Environment variable, marked **Sensitive** |

Marking a variable **Sensitive** means it's write-only afterward — nobody, including admins, can read its value back through the UI or API once saved.

### Step 6 — Set the execution mode and run trigger

In the workspace's **Settings → General**, confirm:
- **Execution Mode**: `Remote` (runs execute on Terraform Cloud's infrastructure, not your laptop)
- **Apply Method**: `Auto apply` (for this exercise) or `Manual apply` (recommended for anything touching real infrastructure — a human clicks **Confirm & Apply** after reviewing the plan)

Under **Settings → Version Control**, confirm the connected repository and branch (`main`) that triggers runs.

### Step 7 — Trigger a remote run by pushing a commit

```bash
git checkout -b tf-cloud-migration
git add main.tf
git commit -m "Migrate to Terraform Cloud remote backend"
git push -u origin tf-cloud-migration
gh pr create --title "Migrate to Terraform Cloud" --body "Switch from S3 backend to HCP Terraform cloud block"
```

Opening the PR (or pushing directly to a tracked branch, depending on your VCS trigger settings) causes Terraform Cloud to automatically start a **speculative plan** — visible in the workspace's **Runs** tab — without needing any local Terraform command or CI YAML at all.

### Step 8 — Review and confirm the apply

Merge the PR to `main`. Terraform Cloud starts a new run:
1. **Plan phase** — runs remotely, output streamed live in the UI.
2. **Manual confirmation** (if Apply Method is `Manual apply`) — a **Confirm & Apply** button appears; a teammate with the right workspace permissions clicks it.
3. **Apply phase** — runs remotely and updates the workspace's state.

### Step 9 — Configure team-based access

Under your organization's **Settings → Teams**, create teams such as `platform-admins` and `developers`. Then, on the workspace's **Settings → Team Access**, grant:

| Team | Permission | Effect |
|------|------------|--------|
| `platform-admins` | Admin | Can change workspace settings, variables, and VCS connection |
| `developers` | Plan | Can trigger and view plans, cannot apply or change variables |

This decouples "who can propose infrastructure changes" from "who can approve and apply them," and none of it depends on distributing AWS credentials to individual laptops — the workspace's stored credentials are the only ones that ever touch AWS.

---

## Expected Result

- Your `terraform.tfstate` now lives in the Terraform Cloud workspace, versioned and lockable, replacing any local file or S3 object.
- Pushing a commit to your connected branch automatically produces a plan in the Terraform Cloud UI — no local `terraform plan` or GitHub Actions workflow required.
- Merging to `main` produces an apply that either runs automatically or waits for a **Confirm & Apply** click, depending on the workspace's Apply Method.
- Sensitive values (`db_password`, AWS credentials) are stored write-only in the workspace and never appear in your git history or local shell history.
- Team permissions on the workspace control who can plan vs. who can apply, independent of git branch permissions.

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| State lives in Terraform Cloud | Workspace → **States** tab | Shows a version history with your migrated state as v1 |
| Local plan reads remote state | `terraform plan` locally | No prompt to re-migrate; reads current remote state, shows `No changes` if nothing drifted |
| VCS trigger works | Push a trivial change (e.g. a new tag) to the tracked branch | A new run appears automatically in the **Runs** tab within seconds |
| Sensitive variables are hidden | Workspace → **Variables** → view `db_password` | Value shown as `Sensitive - write only`, not the plaintext |
| Team permission enforced | Log in as a `developers`-team member, attempt to edit a workspace variable | Action is blocked / control is not visible |
| Locking works | Start a run, then try `terraform apply` locally at the same time | Local run reports the state is locked by the in-progress remote run |

---

## Tear Down

Run a destroy through the same remote workflow rather than reverting to local state:

```bash
terraform destroy
```

Terraform Cloud will execute the destroy plan remotely (subject to the same manual-apply confirmation if configured). Once you're done experimenting, you can also delete the workspace itself from **Settings → Destruction and Deletion** — note that Terraform Cloud requires you to run a full destroy plan through the UI before it allows workspace deletion if resources are still tracked in state.

---

## Stretch Goals

1. **Sentinel/OPA policy checks** — add a Sentinel policy (Terraform Cloud's built-in policy-as-code, available on paid tiers) or an equivalent `run_task` webhook that blocks any apply which would create a publicly accessible RDS instance.
2. **Cost estimation** — enable Terraform Cloud's built-in cost estimation for the workspace and observe the monthly cost delta shown directly on each plan.
3. **Notifications** — configure a Slack or email notification on the workspace so the team is notified whenever a run needs manual confirmation or completes an apply.
4. **`tfe` provider** — manage the Terraform Cloud workspace, variables, and team access *itself* as code using the `hashicorp/tfe` provider, so your collaboration setup is as version-controlled as your infrastructure.
5. **Multiple workspaces from one repo** — connect `dev`, `staging`, and `prod` directories (from Project 4) as three separate VCS-connected workspaces in the same Terraform Cloud organization, each with its own variable sets and apply method (auto-apply for `dev`, manual for `prod`).
