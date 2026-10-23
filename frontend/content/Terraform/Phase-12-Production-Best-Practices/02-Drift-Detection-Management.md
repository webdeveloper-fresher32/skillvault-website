# 02 — Drift Detection & Management

## Table of Contents

1. [What Is Configuration Drift and Why It Happens](#1-what-is-configuration-drift-and-why-it-happens)
2. [Detecting Drift with Scheduled `terraform plan` Runs](#2-detecting-drift-with-scheduled-terraform-plan-runs)
3. [Reconciling Drift](#3-reconciling-drift)
4. [Preventing Drift Organizationally](#4-preventing-drift-organizationally)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What Is Configuration Drift and Why It Happens

It's 2 a.m. and production is on fire. An on-call engineer opens the AWS console, bumps a security
group rule to unblock a partner's IP, and gets the incident resolved. Everyone goes back to sleep.
Nobody updates the Terraform code. Two weeks later, someone runs `terraform apply` for an unrelated
change, and Terraform calmly announces it's going to *delete* that security group rule — because
as far as Terraform's state file is concerned, that rule was never supposed to exist. This is
**configuration drift**: the real-world infrastructure no longer matches what Terraform's state
file (and the `.tf` code that produced it) says it should be.

Drift happens for a handful of very human reasons:

- **Manual console/CLI changes** — the 2 a.m. hotfix above; the single most common cause.
- **Out-of-band automation** — another tool (a Lambda auto-remediation script, a security scanner
  that "fixes" things, an autoscaling event) changes a resource Terraform also manages.
- **Provider-side changes** — AWS applies a default, patches a value, or a resource's attributes
  change as part of a managed service upgrade.
- **Manual `terraform apply` outside CI** — someone runs Terraform locally with stale state or an
  old branch, applying a plan nobody reviewed.

### Analogy

Drift is like a shared shopping list where someone raids the fridge without crossing items off the
list. The list (your Terraform code + state) says "we have 2 eggs, 1 carton of milk." The fridge
(real infrastructure) actually has 0 eggs because someone used them last night. The list isn't
lying about what *it* thinks is true — it's just out of sync with reality, and the next time
someone shops "from the list" they'll under-buy or, worse, throw out something that's actually
there.

### Under the Hood — Where Drift Lives

```
┌───────────────────────────┐        ┌───────────────────────────┐
│   .tf CONFIGURATION        │        │   REAL INFRASTRUCTURE      │
│   (desired state)          │        │   (AWS console changes,    │
│                            │        │    other tools, etc.)      │
│  resource "aws_security_   │        │  Security group sg-0abc    │
│  group_rule" "partner" {   │        │  actually has an EXTRA     │
│    ...                     │        │  inbound rule for          │
│  }                         │        │  203.0.113.5/32 that       │
└─────────────┬──────────────┘        │  isn't in .tf at all       │
              │                       └─────────────┬───────────────┘
              │                                     │
              ▼                                     ▼
        ┌─────────────────────────────────────────────────┐
        │              TERRAFORM STATE FILE                │
        │   Last known mapping of .tf resources → real IDs │
        │   (recorded at the last successful apply)        │
        └─────────────────────┬─────────────────────────────┘
                              │
                     terraform plan
                              │
                              ▼
              "Terraform detected the following changes
               made outside of Terraform since the last
               'terraform apply'..."
```

`terraform plan` (and `refresh` as part of it) calls out to the provider API, reads the *actual*
current attributes of each managed resource, and compares them against state. Any mismatch is
drift, and Terraform will show it as a proposed change — usually to bring the resource back in line
with `.tf`, which can mean *removing* the very fix someone made manually.

### Common Confusion

People sometimes think drift means "someone broke something." It doesn't necessarily — drift is
just *disagreement* between code and reality, and either side can be "right." Sometimes the manual
change was a legitimate emergency fix that should be codified. Sometimes it's cruft that should be
removed. Terraform can't tell you which one is correct; it can only tell you that a disagreement
exists.

### Interview Answer

"Configuration drift is when the real state of infrastructure no longer matches what's recorded in
Terraform's state file and defined in its configuration — typically caused by manual console
changes, out-of-band automation, or provider-side updates. It matters because Terraform's next
plan/apply will try to reconcile reality back to what the code says, which can silently undo a
legitimate manual fix if nobody catches it first."

> **Memory hook:** Drift is a shopping list nobody updated after someone raided the fridge.

---

## 2. Detecting Drift with Scheduled `terraform plan` Runs

If the only time you find out about drift is during a routine unrelated `terraform apply`, you've
already lost control of the timeline — drift might have existed for weeks, silently increasing
risk, before anyone noticed. The fix is to stop waiting for drift to surface accidentally and
instead go looking for it on a schedule, the same way you'd run a nightly `diff` against a backup.

### Analogy

This is a smoke detector, not a fire truck. You don't wait to discover the fire when the whole
kitchen is engulfed (a surprise, high-blast-radius apply); you get a small, early, off-schedule
signal ("smoke detected — go check it out") long before it becomes an emergency.

### How Scheduled Drift Detection Works

Terraform Cloud/Enterprise has this built in as a first-class feature ("health assessments" /
scheduled drift detection). Without it, you build the same idea with CI:

```
┌────────────────────────────────────────────────────────────┐
│  Scheduled job (e.g., cron: every night at 2 AM)             │
│                                                                │
│  1. terraform init                                            │
│  2. terraform plan -detailed-exitcode -out=drift.tfplan       │
│  3. Exit code:                                                 │
│       0 = no changes (no drift)                               │
│       1 = error                                                │
│       2 = changes present (drift OR a legitimate pending      │
│           change nobody applied yet)                          │
│  4. If exit code 2 → post plan summary to Slack/Jira,          │
│     do NOT auto-apply                                          │
└────────────────────────────────────────────────────────────┘
```

### Example — GitHub Actions Scheduled Drift Check

```yaml
# .github/workflows/drift-detection.yml
name: Nightly Drift Detection

on:
  schedule:
    - cron: "0 2 * * *"   # 2 AM UTC every night
  workflow_dispatch: {}

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: environments/prod
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.0"

      - run: terraform init -input=false

      - name: Plan and capture drift
        id: plan
        run: |
          terraform plan -detailed-exitcode -no-color -out=drift.tfplan
        continue-on-error: true

      - name: Notify on drift
        if: steps.plan.outputs.exitcode == '2'
        run: |
          terraform show -no-color drift.tfplan > drift_summary.txt
          curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"Drift detected in prod. See CI logs for details.\"}"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Fail if error (not drift)
        if: steps.plan.outputs.exitcode == '1'
        run: exit 1
```

The key flag is `-detailed-exitcode`: it turns "changes present" into a distinct, scriptable exit
code (`2`) instead of the default `0`-for-success behavior that treats "no error" the same whether
or not there were changes.

### Comparison: Detection Strategies

| Strategy | Frequency | Catches drift from | Risk |
|---|---|---|---|
| Only during normal `apply` | Whenever someone next runs Terraform | Everything, but *late* | Drift silently persists; may get auto-reverted without review |
| Scheduled `plan` in CI (nightly/hourly) | On a fixed schedule | Everything, within one interval | Needs alerting wired up or nobody reads the logs |
| Terraform Cloud/Enterprise health assessments | Configurable, built-in | Everything, with UI history | Requires TFC/TFE (paid tiers for this feature) |
| Cloud-native drift tools (AWS Config rules) | Near real-time | Only what rules are written for | Complementary, not a Terraform-state-aware replacement |

### Common Confusion

A scheduled drift-detection plan should almost never auto-apply. The whole point is to get a human
to look at *why* the drift happened before deciding whether to codify it or revert it — an
unattended auto-apply on a drift-detection job risks automatically deleting someone's legitimate
emergency fix at 2 AM with nobody watching.

### Interview Answer

"Drift detection means running `terraform plan` on a schedule against production state — usually
nightly, in CI — using `-detailed-exitcode` so 'no changes,' 'error,' and 'changes present' are
distinguishable exit codes. When drift is found, the plan output is posted for humans to review; it
should not auto-apply, because the plan might revert someone's legitimate manual fix rather than
correcting genuine unwanted drift."

> **Memory hook:** A scheduled plan is a smoke detector — it tells you to go check the kitchen, it doesn't call the fire truck itself.

---

## 3. Reconciling Drift

You've found drift: someone added an inbound security group rule for a partner IP that isn't in
your `.tf` code. Now what? There are exactly three honest options, and picking the wrong one either
throws away a legitimate fix or lets an unreviewed change live in production indefinitely.

### Analogy

Finding drift is like finding an item in the fridge that isn't on the shopping list. You have three
choices: throw it out (it shouldn't be there — remove it manually to match the list), add it to the
list (it's legitimate — update the list to match the fridge), or, if it's something you didn't
even know the fridge could hold, ask the store what it actually is before deciding (`import` it to
find out its full attributes first).

### Option 1 — Codify the Manual Change

If the manual change was legitimate (the partner IP really does need access), add it to your `.tf`
code so Terraform's desired state matches reality going forward:

```hcl
resource "aws_security_group_rule" "partner_access" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["203.0.113.5/32"]
  security_group_id = aws_security_group.app.id
  description       = "Partner API access — codified after emergency hotfix on 2026-07-05"
}
```

Run `terraform plan` afterward — it should now show *no* changes for this rule, confirming code and
reality agree.

### Option 2 — Revert the Manual Change

If the manual change was a mistake or is no longer needed, just apply your existing code — the
next `terraform apply` will remove the drifted attribute/resource and restore what `.tf` says
should exist. This is exactly the default reconciliation behavior; no special command is required,
just a normal `terraform apply` after confirming the plan is what you want.

### Option 3 — Import an Entirely Unmanaged Resource

Sometimes drift isn't "a resource Terraform manages has an extra attribute" — it's "someone created
a whole new resource by hand and it isn't in state at all." Bring it under management with
`terraform import` (classic syntax) or the `import` block (Terraform 1.5+, preferred because it's
plannable and reviewable):

```hcl
# Terraform 1.5+ import block — plan shows exactly what will be imported
import {
  to = aws_s3_bucket.reports
  id = "acme-reports-bucket-prod"
}

resource "aws_s3_bucket" "reports" {
  bucket = "acme-reports-bucket-prod"
}
```

```bash
terraform plan   # shows the import + any config drift between real resource and your resource block
terraform apply  # performs the import
```

### A Word on `terraform refresh` in Modern Terraform

Older Terraform workflows used a standalone `terraform refresh` to update state from real
infrastructure without changing `.tf` or applying anything. As of Terraform 1.x, this is discouraged
as a standalone command because it silently writes to state with no plan to review first. Instead:

- `terraform plan -refresh-only` shows you *what would change in state* if you refreshed, as a
  reviewable plan, without touching real infrastructure.
- `terraform apply -refresh-only` actually updates the state file to match reality, after you've
  reviewed the plan — this is the safe, modern replacement for a blind `terraform refresh`.

```bash
terraform plan -refresh-only -out=refresh.tfplan
# Review: does this just reflect drift I already understand and accept?
terraform apply refresh.tfplan
```

Note: `-refresh-only apply` updates *state* to match reality — it does **not** change your `.tf`
code. If the drifted values should be permanent, you still need to update your configuration
(Option 1) so a later normal `apply` doesn't try to revert them again.

### Comparison Table — Reconciliation Options

| Situation | Action | Command | Result |
|---|---|---|---|
| Manual change was correct, should persist | Codify it | Edit `.tf`, then `terraform plan`/`apply` | Code + state + reality all agree |
| Manual change was a mistake | Revert it | `terraform apply` (existing code) | Reality restored to match code |
| A managed resource's attributes drifted, unsure of intent | Inspect first | `terraform plan -refresh-only` | See exactly what differs before deciding |
| A whole resource was created outside Terraform | Bring under management | `import` block + `terraform plan`/`apply` | Resource now tracked in state |
| State itself is stale/corrupted vs. reality, no code change intended | Sync state only | `terraform apply -refresh-only` | State updated; `.tf` unchanged |

### Common Mistakes

- Running a bare `terraform refresh` in older habits and assuming it's harmless — always prefer the
  reviewable `-refresh-only` plan/apply pair.
- Blindly running `terraform apply` on drifted infrastructure without reading the plan first — this
  is exactly how a legitimate emergency fix gets silently deleted.
- Using `import` without first writing a matching `resource` block — the import block (or the
  classic `terraform import` command) needs a destination resource address to attach the real
  infrastructure to.

### Interview Answer

"Reconciling drift means deciding, for each detected difference, whether to codify it (update `.tf`
so it matches the legitimate manual change), revert it (apply existing code to restore the
intended state), or import it (bring an entirely unmanaged resource under Terraform with an
`import` block). Modern Terraform prefers `terraform plan -refresh-only` / `apply -refresh-only`
over the older standalone `terraform refresh`, because it makes the state-sync step a reviewable
plan instead of a silent, unreviewed write."

> **Memory hook:** Found something not on the list? Add it, throw it out, or ask what it is first — never just guess.

---

## 4. Preventing Drift Organizationally

Detecting and reconciling drift is damage control. The cheaper, more durable fix is preventing it
in the first place — and that's mostly an organizational problem, not a Terraform feature. No
tool can stop a human with console access from clicking "Save" on a change.

### Analogy

This is like a company that keeps losing inventory to employees "just grabbing what they need"
from the warehouse. You can audit the shelves nightly forever (detection), or you can put a lock on
the door and require a requisition form (prevention). Both matter, but prevention is what actually
reduces how often you're doing the audit-and-reconcile dance.

### Prevention Techniques

**1. Restrict console/CLI write access in shared environments**

Give most engineers **read-only** IAM access to staging/production consoles. Write access goes
through Terraform (via CI/CD) or a tightly scoped "break glass" role that requires justification
and is itself audited.

```hcl
# IAM policy: read-only console access for engineers, enforced org-wide
data "aws_iam_policy_document" "read_only_console" {
  statement {
    effect    = "Allow"
    actions   = ["ec2:Describe*", "rds:Describe*", "s3:List*", "s3:GetObject"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "read_only_console" {
  name   = "engineer-read-only-console"
  policy = data.aws_iam_policy_document.read_only_console.json
}
```

**2. Tag every Terraform-managed resource, and alert on untagged changes**

```hcl
provider "aws" {
  default_tags {
    tags = {
      ManagedBy = "terraform"
      Repo      = "github.com/acme-corp/infra-prod"
    }
  }
}
```

Pair this with an AWS Config rule (or a scheduled Lambda) that flags any resource of a managed type
*without* the `ManagedBy = terraform` tag — a strong signal someone created it by hand.

**3. Require a "break glass" process for emergency manual changes**

Instead of "just fix it in the console," require: (a) the emergency change is made, (b) a ticket
is opened automatically or manually describing what and why, (c) a follow-up PR codifying the
change into Terraform is required within a set SLA (e.g., 24-48 hours), tracked so it doesn't get
forgotten.

**4. Make the Terraform path the fastest path**

The best prevention is cultural: if applying a Terraform change through CI/CD is *faster and
easier* than opening the console, engineers will default to it even under time pressure. Slow,
bureaucratic CI/CD pipelines are one of the biggest drivers of "I'll just do it in the console."

### Comparison Table — Prevention Layers

| Technique | Stops | Doesn't stop |
|---|---|---|
| Read-only IAM for engineers | Casual/accidental console edits | A determined break-glass emergency change |
| Tagging + drift alerting on untagged resources | Undetected resources created outside Terraform | Drift on resources that *are* tagged but had an attribute changed |
| Break-glass process with SLA | Emergency fixes staying uncodified forever | The initial emergency change itself (that's the point — it should still be possible) |
| Fast, reliable CI/CD for applies | The *temptation* to bypass Terraform | Nothing — this is pure culture/tooling investment |

### Common Mistakes

- Locking down console access so hard that genuine emergencies can't be resolved quickly — this
  just pushes people to find workarounds (like a shared root credential) that are worse than the
  drift you were preventing.
- Tagging resources but never actually alerting on untagged ones — the tag becomes decoration
  instead of a detection signal.
- Treating break-glass changes as "done" once the immediate fire is out, with no enforced follow-up
  to codify them — this is exactly how permanent drift accumulates.

### Interview Answer

"Organizationally, drift is best prevented by minimizing who can make direct infrastructure
changes outside Terraform — read-only console access for most engineers, a Terraform-managed tag
on every resource so untagged ones stand out, and a break-glass process for genuine emergencies
that requires a follow-up PR to codify the change within a defined SLA. The goal isn't to make
manual changes impossible — sometimes you need them at 2 AM — it's to make sure they always get
reconciled back into code quickly instead of silently persisting."

> **Memory hook:** Put a lock on the warehouse door and a requisition form on the desk — don't just keep counting the inventory every night forever.

---

## 5. Common Mistakes

- **Discovering drift only during an unrelated `apply`**, with no scheduled detection in place —
  drift can silently persist for weeks.
- **Auto-applying scheduled drift-detection plans** without human review, risking automatic
  reversion of a legitimate emergency fix.
- **Using bare `terraform refresh`** out of habit instead of the reviewable `-refresh-only`
  plan/apply pair in modern Terraform.
- **Giving broad console write access to everyone "just in case"**, which guarantees drift will keep
  recurring no matter how good your detection is.
- **Treating a break-glass fix as finished** the moment the incident is resolved, with no enforced
  follow-up to bring the change into `.tf`.

---

## 6. Hands-On Exercises

**Exercise 1 — Design a Drift Detection Pipeline**
Write a GitHub Actions (or GitLab CI) workflow that runs `terraform plan -detailed-exitcode`
nightly against a `prod` working directory, posts a Slack message only when drift is detected (exit
code 2), and fails the build loudly on a real error (exit code 1). Do not include an `apply` step.

**Exercise 2 — Reconcile a Specific Drift Scenario**
Your nightly drift check reports that an `aws_db_instance` resource's `backup_retention_period` in
AWS is `14` but your `.tf` says `7`. Investigate (in words) how you'd determine whether this was an
intentional change (e.g., ops team increased retention for compliance) versus accidental drift, and
write the `.tf` diff for whichever reconciliation path you choose.

**Exercise 3 — Import an Untracked Resource**
A teammate manually created an S3 bucket `acme-audit-logs-prod` for a compliance requirement, and it
was never added to Terraform. Write the `import` block and matching `resource "aws_s3_bucket"`
block needed to bring it under management, and describe the plan output you'd expect to review
before running `terraform apply`.

**Exercise 4 — Design a Break-Glass Policy**
Draft a one-page policy (bullet points) for your team describing: who can make emergency manual
changes, what they must do immediately after (ticket, tag, timestamp), and what the SLA is for
submitting a PR that codifies the change into Terraform.

---

## 7. Interview Q&A

---

**Q1: What is configuration drift?**

A: The state where real infrastructure no longer matches what Terraform's state file and `.tf`
configuration say it should be — usually caused by manual console/CLI changes, out-of-band
automation, or provider-side updates that happen without going through a `terraform apply`.

---

**Q2: How do you detect drift proactively rather than accidentally?**

A: Run `terraform plan -detailed-exitcode` on a schedule (e.g., nightly via CI/CD or Terraform
Cloud's built-in health assessments). The `-detailed-exitcode` flag returns distinct exit codes for
"no changes" (0), "error" (1), and "changes present" (2), which lets automation alert a team
without needing to parse plan output text.

---

**Q3: Why shouldn't a scheduled drift-detection job auto-apply?**

A: Because drift can represent a legitimate manual fix (e.g., an emergency hotfix) that the plan
would revert. Auto-applying risks silently undoing something intentional. A human needs to look at
*why* the drift exists and decide whether to codify it, revert it, or investigate further.

---

**Q4: What replaced the standalone `terraform refresh` command in modern workflows, and why?**

A: `terraform plan -refresh-only` followed by `terraform apply -refresh-only`. The standalone
`refresh` command wrote changes to the state file immediately with no reviewable plan step. The
`-refresh-only` workflow makes the state-sync step a normal, reviewable plan/apply cycle, and it's
explicit that it only touches state, not real infrastructure or `.tf` code.

---

**Q5: What are the three ways to reconcile detected drift?**

A: Codify it (update `.tf` to match a legitimate manual change), revert it (run `terraform apply`
with existing code to restore the intended state), or import it (use an `import` block or
`terraform import` to bring an entirely unmanaged resource under Terraform if the drift is a whole
resource that was never tracked).

---

**Q6: How would you prevent drift organizationally, not just detect it?**

A: Restrict console/CLI write access for most engineers to read-only, route real changes through
Terraform in CI/CD, tag every Terraform-managed resource and alert on untagged resources of managed
types, and set up a break-glass process for genuine emergencies that requires a follow-up PR within
a defined SLA to codify the change.

---

**Q7: Someone used a break-glass emergency change to open a security group port at 2 AM. What's the
correct sequence of steps afterward?**

A: The change is made and (ideally automatically) logged/ticketed with what changed and why. A
scheduled drift-detection plan (or the next routine plan) will surface it as drift. The team
decides — usually quickly, since it was an intentional fix — to codify it into `.tf`, submitting a
PR within the break-glass SLA so the code and reality converge and the fix survives future applies
instead of being silently reverted.
