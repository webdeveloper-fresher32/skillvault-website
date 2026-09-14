# Project 5 — CI/CD Pipeline with GitHub Actions

**Level:** Advanced
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 9 – Terraform Cloud & Remote Backends, Phase 11 – Testing & CI/CD

---

## Overview

You will wrap the multi-tier infrastructure from Project 3 in a GitHub Actions pipeline that enforces the workflow every serious Terraform team uses:

1. **On every pull request** — run `terraform fmt -check` and `terraform validate`, then `terraform plan`, and post the plan output as a **PR comment** so reviewers see exactly what will change before approving.
2. **A manual approval gate** — using a GitHub Environment with required reviewers, so a human must explicitly approve before `apply` can run.
3. **On merge to `main`** — automatically run `terraform apply` against the approved plan.

This turns infrastructure changes into the same reviewable, auditable process as application code changes.

```
PR opened ──▶ fmt/validate ──▶ terraform plan ──▶ plan posted as PR comment
                                                          │
PR merged to main ──▶ manual approval (GitHub Environment) ──▶ terraform apply
```

---

## Prerequisites

- Completed Project 3 (or any Terraform root module you're comfortable iterating on)
- A GitHub repository containing your Terraform code
- An S3 backend (or Terraform Cloud — see Project 6) already configured, so state is shared between the local runs you've done and the pipeline's runs
- AWS credentials available to GitHub Actions as repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or, better, an OIDC role — see Stretch Goal 1)

---

## Project Structure

```
05-cicd-pipeline/
├── .github/
│   └── workflows/
│       └── terraform.yml
├── main.tf
├── variables.tf
├── outputs.tf
└── backend.tf
```

---

## Step-by-Step Instructions

### Step 1 — Reuse (or recreate) your Terraform root module

```bash
mkdir 05-cicd-pipeline && cd 05-cicd-pipeline
mkdir -p .github/workflows
```

Copy `main.tf`, `variables.tf`, and `outputs.tf` from Project 1 or Project 3 into this directory — any valid root module works for this project since the focus is the pipeline itself.

### Step 2 — `backend.tf` (S3 remote backend so local and CI runs share state)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-demo"
    key            = "cicd-pipeline/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

### Step 3 — Add repository secrets

In GitHub: **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key with least-privilege permissions for the resources you manage |
| `AWS_SECRET_ACCESS_KEY` | Matching secret key |

### Step 4 — Create a GitHub Environment with a required reviewer (the approval gate)

In GitHub: **Settings → Environments → New environment**, name it `production`, then under **Deployment protection rules** check **Required reviewers** and add yourself (or your team) as an approver.

### Step 5 — `.github/workflows/terraform.yml`

```yaml
name: Terraform CI/CD

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

env:
  TF_VERSION: "1.7.5"
  AWS_REGION: "us-east-1"

jobs:
  # ── Runs on every PR: fmt, validate, plan, comment ──────────────────────
  plan:
    name: Terraform Plan
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    defaults:
      run:
        working-directory: 05-cicd-pipeline

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        run: terraform init -input=false

      - name: Terraform Format Check
        id: fmt
        run: terraform fmt -check -recursive
        continue-on-error: true

      - name: Terraform Validate
        id: validate
        run: terraform validate -no-color

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -input=false -out=tfplan
        continue-on-error: true

      - name: Save plan text for PR comment
        if: always()
        run: terraform show -no-color tfplan > plan_output.txt

      - name: Post plan as PR comment
        uses: actions/github-script@v7
        env:
          PLAN: ${{ steps.plan.outcome }}
        with:
          script: |
            const fs = require('fs');
            const planText = fs.readFileSync('05-cicd-pipeline/plan_output.txt', 'utf8')
              .slice(0, 60000); // stay under GitHub's comment size limit
            const output = `#### Terraform Format 🖌 \`${{ steps.fmt.outcome }}\`
            #### Terraform Validate 🤖 \`${{ steps.validate.outcome }}\`
            #### Terraform Plan 📖 \`${{ steps.plan.outcome }}\`

            <details><summary>Show Plan</summary>

            \`\`\`terraform
            ${planText}
            \`\`\`

            </details>

            *Pushed by: @${{ github.actor }}, Action: \`${{ github.event_name }}\`*`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

      - name: Fail if plan failed
        if: steps.plan.outcome == 'failure'
        run: exit 1

  # ── Runs on merge to main: gated by the `production` environment ───────
  apply:
    name: Terraform Apply
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: production   # <-- this is the manual approval gate
    defaults:
      run:
        working-directory: 05-cicd-pipeline

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Terraform Init
        run: terraform init -input=false

      - name: Terraform Apply
        run: terraform apply -auto-approve -input=false
```

> The `apply` job only exists when a push lands on `main` — but GitHub's `environment: production` protection rule pauses the job right there, waiting for a human reviewer to click **Approve** in the Actions tab before `terraform apply` actually executes.

### Step 6 — Open a pull request to exercise the pipeline

```bash
git checkout -b add-tag
# edit main.tf: add a new tag to a resource, e.g. Owner = "platform-team"
git add .
git commit -m "Add Owner tag to web instance"
git push -u origin add-tag
gh pr create --title "Add Owner tag" --body "Testing the CI/CD pipeline"
```

Watch the **Actions** tab: the `plan` job runs, and within a minute or two a bot comment appears on the PR showing the fmt/validate/plan results with the full plan output collapsed under a `<details>` toggle.

### Step 7 — Merge and watch the approval gate

Merge the PR into `main`. The `apply` job starts but immediately shows **Waiting for review** in the Actions UI. Go to the job, click **Review deployments**, select `production`, and click **Approve and deploy** — only then does `terraform apply -auto-approve` actually run.

---

## Expected Result

- Every PR against `main` gets an automatic bot comment showing `fmt`, `validate`, and the full `plan` output — no reviewer ever has to run Terraform locally to see what a change does.
- A malformed or invalid configuration fails the `plan` job and blocks the PR (via a required status check — see Step 8 below) before it can even be reviewed.
- Merging to `main` never silently changes infrastructure — a named human must click **Approve** in the `production` environment before `apply` executes.

### Step 8 (recommended) — Make the plan job a required status check

In **Settings → Branches → Branch protection rules** for `main`, add `plan` as a required status check so PRs literally cannot merge until the Terraform plan succeeds.

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| PR comment appears | Open a PR that changes a resource | Bot comment with fmt/validate/plan status and collapsed plan output |
| Bad syntax blocks the PR | Introduce a deliberate HCL syntax error and open a PR | `validate` step fails, PR comment shows `validate 🤖 failure`, merge blocked if required check is set |
| Apply requires approval | Merge a PR to `main` | `apply` job shows "Waiting" until a reviewer approves in the Actions UI |
| Apply actually runs | Approve the deployment | Job proceeds, `terraform apply` output visible in logs, AWS resources reflect the change |
| State stays consistent | `terraform plan` locally after the pipeline applies | `No changes. Your infrastructure matches the configuration.` |

---

## Tear Down

Destroy the infrastructure the pipeline manages the same way as any other project — either locally against the shared S3 backend, or by adding a manually-triggered `workflow_dispatch` destroy job (see Stretch Goal 4):

```bash
cd 05-cicd-pipeline
terraform destroy
```

---

## Stretch Goals

1. **OIDC instead of long-lived secrets** — replace `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` with `aws-actions/configure-aws-credentials`'s `role-to-assume` input backed by a GitHub OIDC identity provider, so no static AWS credentials are stored in GitHub at all.
2. **`tflint` and `checkov`** — add steps that run `tflint` and `checkov`/`tfsec` against the plan and post any findings as additional PR comments, failing the job on high-severity issues.
3. **Plan artifact reuse** — upload the `tfplan` file as a workflow artifact in the `plan` job and download the *exact same* binary plan in the `apply` job (via `actions/upload-artifact` / `download-artifact`) so what gets applied is provably identical to what was reviewed, rather than re-planning at apply time.
4. **Manual destroy workflow** — add a second workflow triggered by `workflow_dispatch` with a required text input (`type DESTROY to confirm`) that runs `terraform destroy`, gated by the same `production` environment approval.
5. **Matrix across environments** — extend the workflow to a matrix job that runs `plan`/`apply` against `dev`, `staging`, and `prod` directories (from Project 4) in parallel for `plan`, but sequential and separately-gated for `apply`.
