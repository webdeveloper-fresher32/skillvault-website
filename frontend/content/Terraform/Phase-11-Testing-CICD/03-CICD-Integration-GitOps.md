# 03 — CI/CD Integration & GitOps

## Table of Contents

1. [The GitOps Model for Infrastructure](#1-the-gitops-model-for-infrastructure)
2. [A Full GitHub Actions Workflow Example](#2-a-full-github-actions-workflow-example)
3. [Manual Approval Gates for Apply](#3-manual-approval-gates-for-apply)
4. [Drift Detection Jobs](#4-drift-detection-jobs)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The GitOps Model for Infrastructure

Two engineers on the same team both have valid AWS credentials and both have Terraform installed
locally. One of them runs `terraform apply` from their laptop on Monday to add a new subnet.
The other runs `terraform apply` from their laptop on Tuesday, working from a slightly stale
`git pull`, to fix an unrelated security group rule. Neither apply is "wrong" in isolation — but
now there are two independently-applied changes, no single record of who ran what and when, no
review of either change before it hit production, and state that's been written to twice from
two different machines with two different local Terraform versions. When something breaks
Wednesday, there is no audit trail to reconstruct what happened, and no way to know without
guessing whether the Monday change or the Tuesday change is responsible.

**GitOps** solves this by making one rule absolute: the Git repository is the single source of
truth for desired infrastructure state, and the *only* path from a code change to a real
infrastructure change runs through an automated pipeline — never a human running `apply` from a
laptop. Concretely, for Terraform this almost always means: opening a pull request triggers a
`plan` (so reviewers see the concrete effect before approving), and merging that pull request to
the main branch triggers the `apply` (so there is exactly one, auditable, CI-run apply per
approved change, with logs and history git already gives you for free).

### Analogy

Think of GitOps like a bank's wire transfer process. No single teller can just walk up to the
vault and move money because they believe it's the right thing to do — every transfer has to be
initiated through the approved system, which logs who requested it, who approved it, and exactly
what happened, in that order, every time. A local `terraform apply` is the teller walking up to
the vault. GitOps is the wire transfer system: same outcome (money/infrastructure moves), but
with an unbreakable paper trail and a mandatory approval step baked into the only path that
exists.

### The GitOps Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  Developer creates feature branch, edits .tf files                   │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │  git push, open PR
┌────────────────────────────────▼─────────────────────────────────────┐
│  PULL REQUEST OPENED                                                  │
│  CI triggers: fmt -check → validate → lint/security scan → plan      │
│  Plan output posted as PR comment                                     │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │  human reviews code diff + plan diff
┌────────────────────────────────▼─────────────────────────────────────┐
│  APPROVAL + MERGE to main                                             │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │  merge event triggers CI on main
┌────────────────────────────────▼─────────────────────────────────────┐
│  APPLY PIPELINE                                                       │
│  terraform apply (using the SAME plan artifact that was reviewed,     │
│  or a freshly regenerated plan if the pipeline is designed that way)  │
│  Runs with a CI service identity/role — never a human's own creds     │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────────┐
│  Git history now IS the audit log:                                    │
│  commit → PR → plan comment → approver → merge → apply run → outcome │
└────────────────────────────────────────────────────────────────────────┘
```

### Common Confusion

GitOps is sometimes described as "just running Terraform in CI," but the defining property is
narrower and stricter than that: it's that CI is the *only* path to apply, full stop — no human
ever has standing credentials to run `terraform apply` against the shared state directly. Many
teams run Terraform in CI for convenience but still permit engineers to apply locally "in an
emergency," which quietly breaks the single-source-of-truth guarantee and reintroduces exactly
the audit-trail gap GitOps exists to close. A true GitOps setup typically restricts the
apply-capable credentials/role to the CI system entirely, so local apply against shared
environments isn't just discouraged, it's not technically possible.

### Interview Answer

"GitOps for infrastructure means the Git repository — specifically the state of the main branch
— is the single source of truth for what should be deployed, and the *only* mechanism that can
change real infrastructure is an automated pipeline triggered by Git events: a PR triggers a plan
for review, and a merge triggers the apply. The key benefit over ad hoc local applies is a
complete, tamper-evident audit trail — every infrastructure change is traceable to a specific
commit, a specific PR, a specific approver, and a specific CI run — combined with the fact that
CI applies with a consistent, pinned Terraform version and consistent credentials, removing the
'works on my machine' class of inconsistency between engineers' local setups."

> **Memory hook:** GitOps is the wire-transfer system for infrastructure — no teller walks up to the vault alone; every change goes through the same auditable pipe.

---

## 2. A Full GitHub Actions Workflow Example

Here is a complete, realistic two-workflow setup implementing the GitOps flow from Section 1:
one workflow runs on pull requests (format check, validate, plan, post the plan as a comment),
and a second runs on merge to `main` (apply). This mirrors the pattern used across most
production Terraform-on-GitHub-Actions setups.

### Workflow 1 — PR Plan (`.github/workflows/terraform-plan.yml`)

```yaml
name: Terraform Plan

on:
  pull_request:
    branches: [main]
    paths:
      - 'infra/**'

permissions:
  contents: read
  pull-requests: write
  id-token: write   # required for OIDC auth to AWS

env:
  TF_WORKING_DIR: infra
  AWS_REGION: us-east-1

jobs:
  plan:
    name: Format, Validate, Plan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS Credentials (OIDC, no long-lived keys)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-terraform-plan
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - name: Terraform Format Check
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform fmt -check -recursive

      - name: Terraform Init
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform init

      - name: Terraform Validate
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform validate

      - name: Run tflint
        uses: terraform-linters/setup-tflint@v4
      - run: tflint --init && tflint
        working-directory: ${{ env.TF_WORKING_DIR }}

      - name: Run tfsec
        uses: aquasecurity/tfsec-action@v1.0.3
        with:
          working_directory: ${{ env.TF_WORKING_DIR }}

      - name: Terraform Plan
        id: plan
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform plan -no-color -out=tfplan.binary
        continue-on-error: true

      - name: Save Plan Text
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform show -no-color tfplan.binary > plan_output.txt

      - name: Upload Plan Artifact
        uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: ${{ env.TF_WORKING_DIR }}/tfplan.binary
          retention-days: 5

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infra/plan_output.txt', 'utf8').slice(0, 60000);
            const body = `#### Terraform Plan (\`${context.sha.slice(0,7)}\`)\n\`\`\`\n${plan}\n\`\`\``;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body,
            });

      - name: Fail if Plan Errored
        if: steps.plan.outcome == 'failure'
        run: exit 1
```

### Workflow 2 — Apply on Merge (`.github/workflows/terraform-apply.yml`)

```yaml
name: Terraform Apply

on:
  push:
    branches: [main]
    paths:
      - 'infra/**'

permissions:
  contents: read
  id-token: write

env:
  TF_WORKING_DIR: infra
  AWS_REGION: us-east-1

jobs:
  apply:
    name: Terraform Apply
    runs-on: ubuntu-latest
    environment: production   # ties this job to GitHub Environments protection rules
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-terraform-apply
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - name: Terraform Init
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform init

      - name: Terraform Apply
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform apply -auto-approve
```

### Why Two Separate Workflows

```
┌──────────────────────────┐        ┌──────────────────────────┐
│   PLAN WORKFLOW           │        │   APPLY WORKFLOW           │
│   trigger: pull_request   │        │   trigger: push to main    │
│   role: PLAN-only IAM role│        │   role: APPLY-capable role │
│   (read-only permissions) │        │   (write permissions)       │
│   runs on every PR commit │        │   runs once per merge        │
└──────────────────────────┘        └──────────────────────────┘
```

Splitting plan and apply into separate workflows with separate IAM roles means a PR from an
external contributor (or a compromised PR branch) can never accidentally trigger a role capable
of writing to real infrastructure — the `pull_request` trigger only ever assumes a read-only
plan role. Only a push to `main` — which requires merge, which requires approval — can assume
the apply-capable role.

### Analogy

Two separate workflows with two separate IAM roles is like a building having a visitor badge
that opens the lobby doors and a staff badge that opens the server room — even if a visitor badge
gets cloned, it physically cannot open a door it was never provisioned to open, regardless of
what the person holding it claims their intent is.

### Common Mistakes

- **Using the same IAM role/credentials for both plan and apply.** This means a PR (which
  anyone with write access, or in some setups even a fork, can trigger) has implicit access to a
  role capable of applying, even though the `pull_request` event should never need write
  permissions.
- **Using long-lived AWS access keys stored as GitHub secrets instead of OIDC.** Long-lived keys
  can leak, don't expire automatically, and provide no cryptographic proof of which specific
  workflow run requested them. OIDC federation (`aws-actions/configure-aws-credentials` with
  `role-to-assume`) issues short-lived, per-run credentials tied to the exact repo and workflow.
- **Not restricting the `paths` filter.** Without `paths: ['infra/**']`, every unrelated PR
  (docs, README changes) triggers a full Terraform plan run, wasting CI minutes and cloud API
  quota.
- **Forgetting `-no-color` on `plan`/`show`.** Without it, ANSI escape codes pollute the PR
  comment, making the pasted plan output nearly unreadable.

### Interview Answer

"A production-grade setup splits the plan and apply into two workflows triggered by two
different Git events — `pull_request` for plan, `push` to `main` for apply — each authenticating
with a distinct IAM role scoped to only the permissions that stage needs, ideally via OIDC
federation rather than long-lived static credentials. This means the plan role, which anyone
opening a PR can effectively trigger, physically cannot write to infrastructure even in the worst
case of a malicious or careless PR, because it was never granted write permissions in the first
place — the blast radius of a compromised or careless PR is bounded by IAM, not just by process."

> **Memory hook:** Visitor badge opens the lobby, staff badge opens the server room — plan role and apply role should never be the same key.

---

## 3. Manual Approval Gates for Apply

Automatically applying on every merge to `main` works well for a `dev` environment where mistakes
are cheap. It is a much scarier proposition for `prod`, where you generally want a human to look
at the specific plan that's about to be applied — one more chance to catch something — even
after code review already happened on the PR. GitHub Actions supports this natively through
**Environments**, which can require a specific reviewer (or set of reviewers) to manually approve
a job before it proceeds, and it composes cleanly with the two-workflow setup from Section 2.

### Setting Up a Protected Environment

```
GitHub repo → Settings → Environments → New environment: "production"

  Required reviewers:        [ ] platform-team (GitHub team)
  Wait timer:                 0 minutes
  Deployment branches:        Only "main"
```

### Workflow Using the Protected Environment

```yaml
name: Terraform Apply (Production)

on:
  push:
    branches: [main]
    paths:
      - 'infra/prod/**'

permissions:
  contents: read
  id-token: write

jobs:
  plan-for-approval:
    name: Generate Plan for Reviewer
    runs-on: ubuntu-latest
    outputs:
      plan-exitcode: ${{ steps.plan.outputs.exitcode }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0
      - working-directory: infra/prod
        run: terraform init
      - id: plan
        working-directory: infra/prod
        run: terraform plan -no-color -out=tfplan.binary -detailed-exitcode
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: prod-tfplan
          path: infra/prod/tfplan.binary

  apply:
    name: Apply (requires manual approval)
    needs: plan-for-approval
    if: needs.plan-for-approval.outputs.plan-exitcode == '2'   # 2 = changes present
    runs-on: ubuntu-latest
    environment: production   # <-- pauses here until a required reviewer approves
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0
      - uses: actions/download-artifact@v4
        with:
          name: prod-tfplan
          path: infra/prod
      - working-directory: infra/prod
        run: terraform init
      - working-directory: infra/prod
        run: terraform apply -auto-approve tfplan.binary   # applies the EXACT reviewed plan
```

Two details matter here. First, `-detailed-exitcode` on `terraform plan` returns `0` for "no
changes," `1` for an error, and `2` for "changes present" — using that in the `if:` condition on
the `apply` job means the pipeline doesn't even pause for approval when there's nothing to apply.
Second, `apply` runs against the *exact* uploaded `tfplan.binary` artifact, not a freshly
recomputed plan — the reviewer approves precisely the plan they can see the content of, and
that's precisely what gets applied, with no window for drift between review and execution.

### The Approval Gate in Practice

```
push to main (infra/prod/** changed)
        │
        ▼
  plan-for-approval job runs, plan saved as artifact
        │
        ▼
  apply job reaches `environment: production`
        │
        ▼
┌──────────────────────────────────────────┐
│  GitHub pauses the job                    │
│  Required reviewer gets a notification    │
│  Reviewer opens the run, inspects the     │
│  plan artifact / logs, clicks "Approve"   │
│  or "Reject"                              │
└──────────────────┬───────────────────────┘
                   │ approved
                   ▼
          apply proceeds against
          the exact plan artifact
```

### Analogy

A manual approval gate on `prod` apply is the two-person rule used to launch a nuclear missile —
one person (the PR author + reviewer) already decided the code should merge, but a second,
independent confirmation is required at the actual point of irreversible action, specifically
because the cost of a mistake at that step is so much higher than the cost of a few extra minutes
of friction.

### Common Mistakes

- **Applying `environment: production` protection to the PR/plan job instead of the apply job.**
  The approval gate should sit immediately before the irreversible action (apply), not before a
  read-only plan, or you've added friction without adding safety.
  ```yaml
  # WRONG — gate is meaningless here, plan is not destructive
  jobs:
    plan:
      environment: production
      steps: [...]
  ```
- **Re-running `terraform plan` fresh inside the apply job instead of applying the saved
  artifact.** This reopens the exact "plan the reviewer saw might not be the plan that gets
  applied" gap that manual approval was supposed to close.
- **Allowing the same person who authored the PR to also be the required approver on the
  environment.** Most teams configure "required reviewers" to exclude the PR author by policy,
  mirroring code review rules, so the manual gate is a genuinely independent check.
- **No `-detailed-exitcode` check, so reviewers get paged for approval even when there's nothing
  to apply.** This trains reviewers to rubber-stamp approvals out of habit, defeating the purpose.

### Interview Answer

"For production environments, GitHub's Environments feature lets you require a specific set of
reviewers to manually approve a job before it runs — I place that gate directly on the `apply`
job, not the `plan` job, since the gate exists to catch problems before the irreversible action,
not before a read-only preview. Critically, the apply step should consume the exact plan artifact
that was generated and made visible to the reviewer, rather than recomputing a fresh plan at
apply time, otherwise there's a window where what gets approved and what gets applied can
diverge — which defeats the entire purpose of adding a human gate in the first place."

> **Memory hook:** The two-person rule for infrastructure — one person approves the code, a second approves the exact plan, right before the button that can't be unpressed.

---

## 4. Drift Detection Jobs

Six months into running a clean GitOps pipeline, an on-call engineer gets paged for a production
incident at 2am, opens the AWS console (not Terraform, because it's an emergency and the console
is faster), and manually bumps a security group rule to unblock a customer. The incident is
resolved. Nobody remembers to reflect that change back into the `.tf` files. Now the Git
repository — supposedly the single source of truth — no longer matches reality, and the next
`terraform plan` anyone runs will either silently revert the emergency fix or produce a
confusing, unexpected diff nobody can explain. This gap between "what Git says should exist" and
"what actually exists in the cloud account" is called **drift**, and it's not a hypothetical edge
case — it's close to inevitable in any team that has console access alongside Terraform.

Drift detection is a scheduled CI job that runs `terraform plan` on a fixed schedule (independent
of any PR or merge event), on the theory that if the plan shows *any* changes at all when nothing
was supposed to have changed via Terraform, that's drift, and someone should be alerted before it
causes a confusing surprise during the next real, intentional apply.

### Drift Detection Workflow

```yaml
name: Terraform Drift Detection

on:
  schedule:
    - cron: '0 6 * * *'   # every day at 06:00 UTC
  workflow_dispatch:        # allow manual trigger too

permissions:
  contents: read
  id-token: write
  issues: write

env:
  TF_WORKING_DIR: infra/prod

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-terraform-plan
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform init

      - name: Plan-Only Drift Check
        id: drift
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform plan -no-color -detailed-exitcode -out=drift.tfplan
        continue-on-error: true

      - name: Show Drift Details
        if: steps.drift.outputs.exitcode == '2'
        working-directory: ${{ env.TF_WORKING_DIR }}
        run: terraform show -no-color drift.tfplan > drift_output.txt

      - name: Open Issue on Drift Detected
        if: steps.drift.outputs.exitcode == '2'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const drift = fs.readFileSync('infra/prod/drift_output.txt', 'utf8').slice(0, 50000);
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Terraform drift detected in prod - ${new Date().toISOString().slice(0,10)}`,
              body: `Scheduled drift check found unexpected changes:\n\n\`\`\`\n${drift}\n\`\`\``,
              labels: ['terraform-drift', 'needs-triage'],
            });

      - name: Fail Job if Plan Errored (not just drifted)
        if: steps.drift.outputs.exitcode == '1'
        run: exit 1
```

Note the deliberate use of `-detailed-exitcode` again: exit code `0` means "no drift, all clean,"
`2` means "drift found, changes exist that Git didn't produce," and `1` means an actual error
(bad credentials, provider issue) — the workflow only opens an issue on `2`, and only hard-fails
the job on `1`, so a genuinely clean day doesn't spam anyone.

### The Drift Detection Loop

```
┌────────────────────────────────────────────────────────────────┐
│  Scheduled trigger (daily cron) — no code change involved        │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
                  terraform plan (read-only, no apply)
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        exitcode 0        exitcode 2        exitcode 1
        "no changes"     "drift found"        "error"
              │                │                │
              ▼                ▼                ▼
        do nothing      open a GitHub       fail the CI job,
                         issue with the      alert on-call for
                         drift diff           tooling problem
```

### Analogy

Drift detection is a nightly security guard doing rounds with a checklist of "every door that
should be locked" — not because anyone expects to catch a break-in every night, but because it's
the only way to notice that someone propped a door open for a delivery three days ago and forgot
to close it, before that becomes the entry point for an actual incident.

### Common Confusion

Drift detection jobs should almost never auto-apply on drift. The whole reason drift exists is
usually a deliberate, informed human decision (an emergency console fix) — automatically
"correcting" it back to the Git-defined state could silently undo an intentional, still-needed
emergency change. The correct response to detected drift is to surface it to a human (an issue,
a Slack alert) who can decide whether to update the `.tf` files to match reality, or run a
deliberate apply to revert the drift — not to have the pipeline decide unilaterally.

### Interview Answer

"Drift detection is a scheduled, plan-only CI job — independent of any PR or merge trigger — that
runs on a cron schedule purely to compare the real cloud state against what Terraform's
configuration says should exist. It matters because manual out-of-band changes are almost
inevitable in practice, especially during incidents when someone reaches for the console instead
of a PR, and without a scheduled check, that mismatch stays invisible until it causes a confusing
or dangerous surprise during the next real apply. I use `-detailed-exitcode` to distinguish 'no
drift' from 'drift found' from 'plan errored,' and I always route detected drift to a human via
an issue or alert rather than auto-applying a fix, since the drift itself may represent an
intentional emergency change that hasn't been reconciled back into code yet."

> **Memory hook:** Drift detection is the nightly guard checking every door — not expecting a break-in, just catching the one someone propped open and forgot about.

---

## 5. Common Mistakes

- **No separation between plan-capable and apply-capable credentials.** Every PR should be able
  to trigger a read-only plan; only a merge to `main` should be able to trigger anything with
  write access. Sharing one role across both collapses that boundary.
- **Storing long-lived cloud credentials as CI secrets instead of using OIDC federation.**
  Static keys in GitHub secrets don't rotate automatically, can be exfiltrated by a malicious
  workflow change, and provide weaker auditability than short-lived, per-run OIDC tokens scoped
  to a specific repo and workflow.
- **Approving on the code diff alone and skipping the plan entirely**, even with all the
  automation in Section 2 in place — automation only helps if humans actually read what it
  surfaces.
- **No manual approval gate on production applies**, treating dev and prod pipelines identically
  when the cost of a mistake in each is wildly different.
- **Treating drift detection as optional or "nice to have."** Without it, out-of-band changes
  accumulate invisibly until they surface as a confusing, high-stakes surprise during an
  unrelated, otherwise-routine apply.
- **Auto-remediating drift without human review.** Automatically re-applying Terraform's version
  of the truth over detected drift can silently undo a deliberate emergency fix that hasn't yet
  been reflected back into the `.tf` files.
- **Letting `workflow_dispatch` or schedule-triggered jobs assume the apply-capable role "just in
  case."** Drift detection only ever needs plan-level (read-only) permissions — it should never
  be able to apply anything, even by accident.

---

## 6. Hands-On Exercises

**Exercise 1 — Build the Two-Workflow Pipeline**
Set up a minimal Terraform project in a GitHub repo with the plan workflow (Section 2, Workflow
1) and the apply workflow (Workflow 2). Open a PR that changes an `instance_type`, confirm the
plan comment appears, merge it, and confirm the apply workflow runs on `main`.

**Exercise 2 — Split IAM Roles**
Create two IAM roles in AWS (or your cloud of choice): one with only read/plan-equivalent
permissions, one with the additional write permissions needed to apply. Wire the plan workflow to
assume the first and the apply workflow to assume the second via OIDC. Confirm the plan workflow
fails if you deliberately try to have it assume the apply role.

**Exercise 3 — Add a Protected Environment**
Configure a GitHub Environment named `production` with a required reviewer. Modify the apply
workflow to target that environment and confirm the job pauses for approval before running
`terraform apply`.

**Exercise 4 — Apply the Exact Reviewed Plan**
Modify your apply workflow so it downloads the plan artifact generated during the PR's plan run
and applies that exact file (`terraform apply tfplan.binary`) instead of recomputing a fresh plan.
Explain in your own words why this matters.

**Exercise 5 — Build a Drift Detection Job**
Add the scheduled drift-detection workflow from Section 4. Manually change a tagged resource via
the cloud console (outside Terraform) and confirm the next scheduled (or manually triggered) run
opens a GitHub issue describing the drift.

**Exercise 6 — Decide the Right Gate**
For each scenario below, decide what should trigger a plan, what should require manual approval
before apply, and what should be handled by drift detection instead:
  a) A junior engineer opens a PR changing a dev-environment instance type.
  b) A senior engineer's PR changes a production RDS instance class.
  c) Someone manually deleted a tag on a production S3 bucket via the console last week.
  d) A scheduled nightly job needs to confirm prod matches what's in Git.

---

## 7. Interview Q&A

---

**Q1: What is GitOps, applied specifically to Terraform?**

A: GitOps means the Git repository is the single source of truth for desired infrastructure
state, and the only path to actually changing real infrastructure is through an automated
pipeline triggered by Git events — a pull request triggers a `plan` for review, and a merge to
the main branch triggers the `apply`. No engineer applies directly from a local machine against
shared environments; every change is traceable to a commit, a PR, an approver, and a CI run.

---

**Q2: Why should the plan workflow and apply workflow use different IAM roles?**

A: Because the `pull_request` trigger — which anyone opening a PR can effectively cause to run —
should never have write access to infrastructure, even in the worst case of a careless or
malicious PR. Giving the plan job only read-level permissions and reserving the apply-capable
role for the `push`-to-`main` trigger (which requires a merge, which requires approval) bounds
the blast radius of anything that happens during PR review to read-only operations.

---

**Q3: Why prefer OIDC federation over storing static cloud credentials as CI secrets?**

A: Static access keys are long-lived, don't rotate automatically, and if leaked can be used from
anywhere. OIDC federation issues short-lived credentials scoped to a specific repository and
workflow, minted fresh for each run and expiring quickly, which removes the risk of a long-lived
secret sitting in CI configuration and provides stronger auditability tied to the exact workflow
run that requested access.

---

**Q4: How does a manual approval gate for production apply fit into an otherwise fully automated
pipeline?**

A: It's implemented via GitHub Environments (or the equivalent in other CI systems) requiring a
specific reviewer to approve the apply job before it proceeds, placed immediately before the
apply step rather than before the plan step, since the point is to add a second check right
before the irreversible action. Critically, the apply step should consume the exact plan artifact
the reviewer saw, rather than recomputing a fresh plan, so there's no window for drift between
what was approved and what actually gets applied.

---

**Q5: What is infrastructure drift, and why can't code review alone prevent it?**

A: Drift is a mismatch between what the Terraform configuration says should exist and what
actually exists in the cloud account, typically caused by manual out-of-band changes — most
commonly an emergency fix made via the console during an incident. Code review only examines
changes going through the Git/PR path; it has no visibility into changes made outside that path,
which is exactly why drift needs its own detection mechanism independent of the PR/merge flow.

---

**Q6: How does a scheduled drift detection job work, and what should it do when it finds drift?**

A: It's a CI job triggered on a cron schedule (not by any PR or merge event) that runs a
plan-only `terraform plan` and inspects the exit code — typically using `-detailed-exitcode`,
where `2` means changes were found (drift), `0` means clean, and `1` means an actual error. On
detecting drift, the job should surface it to a human, usually by opening an issue or sending an
alert containing the plan diff, rather than automatically applying a "fix," since the drift may
represent an intentional change (like an emergency fix) that hasn't yet been reflected back into
the Terraform configuration.

---

**Q7: What does `-detailed-exitcode` do on `terraform plan`, and why is it useful in CI?**

A: It changes `terraform plan`'s exit code to be meaningful rather than just 0-or-nonzero: `0`
means the plan succeeded with no changes, `1` means an error occurred, and `2` means the plan
succeeded and found changes. This lets a CI workflow branch its behavior precisely — skip a
manual approval step or drift alert when there's genuinely nothing to do (`0`), fail loudly on
real tooling errors (`1`), and only page someone or request approval when there are actual
changes to review (`2`).

---

**Q8: Why is applying the exact plan artifact important rather than letting the apply job run a
fresh `terraform plan` right before applying?**

A: Between the time a plan is generated (and reviewed, in a manual-approval setup) and the time
apply actually runs, real infrastructure state or the underlying configuration could have
changed — another merge could have landed, or drift could have occurred outside Terraform. If the
apply job recomputes a brand-new plan instead of reusing the saved plan file, whatever gets
applied might differ from what was actually reviewed and approved, which quietly defeats the
purpose of both code review and any manual approval gate.
