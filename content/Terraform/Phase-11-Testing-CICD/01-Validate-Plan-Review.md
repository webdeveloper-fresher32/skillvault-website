# 01 — Validate & Plan Review

## Table of Contents

1. [Why Validate Before Apply](#1-why-validate-before-apply)
2. [terraform fmt and terraform validate](#2-terraform-fmt-and-terraform-validate)
3. [Static Analysis Tools](#3-static-analysis-tools)
4. [Reading and Reviewing a terraform plan in a PR](#4-reading-and-reviewing-a-terraform-plan-in-a-pr)
5. [Plan Output as a Gate in Code Review](#5-plan-output-as-a-gate-in-code-review)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Validate Before Apply

Picture this: it's 4:58pm on a Friday. A teammate pushes a "tiny" change to a Terraform file —
just renaming a variable — merges it without review, and runs `terraform apply` straight from
their laptop. Thirty seconds later, the production RDS instance is being destroyed and recreated
because the rename accidentally changed a resource's identity. By the time anyone notices, the
database is gone and a restore-from-snapshot is underway. Nobody typed "delete the database."
Terraform just did exactly what the code said, quickly, and without anyone stopping to look at
what it was about to do.

This is the entire reason a whole ecosystem of validation, linting, and plan-review tooling
exists around Terraform. Unlike a typo in application code — which usually throws a runtime
error a developer notices in a test — a typo or oversight in infrastructure code can silently
authorize an operation that deletes, replaces, or exposes real infrastructure. Terraform is
declarative and extremely good at doing what you asked; it has almost no concept of "are you
sure?" beyond the interactive `yes` prompt, which CI pipelines routinely bypass with
`-auto-approve`. Validation and review are how humans and tools inject judgment back into a
process that otherwise happily executes whatever the `.tf` files say.

### Analogy

Think of `terraform apply` as a surgeon making an incision. The surgeon doesn't just walk into
the operating room and start cutting based on a hallway conversation. There's a pre-op checklist:
confirm the patient's identity, confirm the correct limb, confirm the imaging matches the plan.
`terraform fmt`, `validate`, linters, and a human-reviewed `plan` are that checklist for your
infrastructure — cheap, fast checks performed *before* the irreversible action, specifically
because the irreversible action is expensive to undo.

### The Validation Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPER MACHINE                          │
│                                                                        │
│   write .tf files ──► terraform fmt ──► terraform validate           │
│                        (style)          (syntax + internal           │
│                                           consistency)                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  git push / open PR
┌───────────────────────────────▼──────────────────────────────────────┐
│                          CI PIPELINE                                  │
│                                                                        │
│  fmt -check ──► validate ──► tflint/tfsec/checkov ──► terraform plan │
│  (fails PR      (fails PR     (fails PR on security    (posts plan   │
│   if unformatted) if broken)   or best-practice issues) as PR comment)│
└───────────────────────────────┬──────────────────────────────────────┘
                                │  human reviews plan output in the PR
┌───────────────────────────────▼──────────────────────────────────────┐
│                        HUMAN CODE REVIEW                             │
│         "Does this plan match what the PR description says?"        │
│         "Is anything being destroyed that shouldn't be?"             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  approve + merge
┌───────────────────────────────▼──────────────────────────────────────┐
│                    terraform apply (in CI, not laptop)               │
└────────────────────────────────────────────────────────────────────────┘
```

Each stage catches a different class of mistake. `fmt` catches style drift. `validate` catches
syntax errors and internally inconsistent configuration (like referencing an undeclared
variable). Linters catch security misconfigurations and anti-patterns. The plan, reviewed by a
human, catches the thing none of the automated tools can catch: "is this actually the change we
intended?"

### Common Confusion

A lot of teams believe that if `terraform validate` passes, the configuration is "safe to apply."
It is not. `validate` only checks that the configuration is internally consistent and
syntactically correct — it has no knowledge of your actual cloud state, so it cannot tell you
that this apply will destroy a database. Passing `validate` is a necessary but nowhere near
sufficient condition for a safe apply. The plan is the thing that actually tells you what will
happen; validate just tells you the code isn't broken.

### Interview Answer

"Validation and plan review exist because Terraform executes exactly what the configuration
says, including destroy-and-recreate operations, without inherently distinguishing between
a benign change and a catastrophic one. `terraform fmt` and `validate` catch style and syntax
issues early and cheaply. Static analysis tools like tflint, tfsec, and checkov catch security
and best-practice violations before any cloud API call is made. But none of those tools know
what you *intended* — only a human reading the `terraform plan` output in a pull request can
confirm the diff matches the change that was actually meant, which is why plan review is treated
as a required gate before merge in any serious infrastructure workflow."

> **Memory hook:** Terraform doesn't ask "are you sure?" — so your pipeline has to ask for it.

---

## 2. terraform fmt and terraform validate

You just finished writing a module with three engineers contributing over two weeks. One person
indents with two spaces, another with four, another aligns `=` signs by hand and gives up
halfway through. The diffs in every pull request are now 80% whitespace noise, and reviewers
start skimming past the actual logic because the visual noise is exhausting. This is a solved
problem, and Terraform solves it with a single command built into the binary — no external
tool, no config file required.

### terraform fmt

`terraform fmt` rewrites `.tf` files in the current directory to Terraform's canonical style:
consistent indentation, aligned `=` signs within blocks, consistent spacing. It is purely
cosmetic — it never changes the meaning of your configuration.

```bash
# Rewrite files in place
terraform fmt

# Recurse into subdirectories (modules, environments)
terraform fmt -recursive

# CI-friendly: exit non-zero if any file WOULD be reformatted, but don't write
terraform fmt -check -recursive

# Show a diff of what would change, without writing
terraform fmt -diff -recursive
```

Before:
```hcl
resource "aws_instance" "web" {
  ami= "ami-0c55b159cbfafe1f0"
    instance_type = "t3.micro"
  tags = {
Name = "web-server"
  }
}
```

After `terraform fmt`:
```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  tags = {
    Name = "web-server"
  }
}
```

### terraform validate

`terraform validate` checks the configuration for internal consistency: correct HCL syntax,
required arguments present, referenced variables and resources actually declared, and correct
attribute types where Terraform can determine them statically. Crucially, it does **not** contact
your cloud provider — it does not check credentials, does not check whether an AMI ID exists,
and does not check whether a resource already exists in state.

```bash
terraform init -backend=false   # need providers initialised, but not a real backend
terraform validate
```

Example output on a broken configuration:

```
$ terraform validate
╷
│ Error: Reference to undeclared input variable
│
│   on main.tf line 12, in resource "aws_instance" "web":
│   12:   instance_type = var.instance_typ
│
│ An input variable with the name "instance_typ" has not been declared.
│ Did you mean "instance_type"?
╵
```

### Analogy

`fmt` is spell-check — it tidies up presentation without touching meaning. `validate` is
grammar-check — it confirms the sentence is structurally sound (subject, verb, object all
present and correctly typed) but says nothing about whether the *content* of the sentence is
true. Neither one fact-checks the sentence against the real world; that's the plan's job.

### Under the Hood

```
terraform validate
        │
        ▼
┌─────────────────────────────┐
│ 1. Parse HCL syntax          │  ← catches missing braces, bad string interpolation
└──────────────┬───────────────┘
               ▼
┌─────────────────────────────┐
│ 2. Build in-memory graph      │  ← resolves resource/module/variable references
└──────────────┬───────────────┘
               ▼
┌─────────────────────────────┐
│ 3. Check required arguments   │  ← e.g. aws_instance needs ami + instance_type
└──────────────┬───────────────┘
               ▼
┌─────────────────────────────┐
│ 4. Static type checking       │  ← where types are known without provider calls
└──────────────┬───────────────┘
               ▼
       No cloud API calls made — entirely local and offline
```

### Common Mistakes

- **Forgetting `terraform init` first.** `validate` needs the provider schemas loaded to know
  what arguments each resource type expects; running it in a fresh checkout without `init` fails
  with confusing provider errors.
- **Treating a passing `validate` as "safe to apply."** It only proves the code is well-formed —
  it says nothing about drift, cost, or destructive changes.
- **Running `fmt` without `-check` in CI.** If CI silently reformats and doesn't fail the build,
  developers never learn to run `fmt` locally, and the CI job becomes a rewrite-and-recommit
  loop instead of a gate.

### Interview Answer

"`terraform fmt` is a purely cosmetic formatter — it standardizes indentation and alignment and
never changes semantics. `terraform validate` is a static, offline check: it parses the HCL,
builds the reference graph, and confirms required arguments and variable references are
consistent — but it makes no calls to the cloud provider, so it can't catch things like an
invalid AMI ID or a change that would destroy a resource. Both run in milliseconds and are the
first two gates in any CI pipeline, before anything that costs an API call or touches real
infrastructure."

> **Memory hook:** `fmt` is spell-check, `validate` is grammar-check — neither one checks if what you wrote is actually true.

---

## 3. Static Analysis Tools

`terraform validate` will happily pass a configuration that opens an S3 bucket to the entire
internet, launches an unencrypted EBS volume, or attaches a security group with `0.0.0.0/0` on
port 22. None of that is a syntax error — it's a security or compliance problem, and Terraform's
built-in tooling has no opinion on security posture. That's the gap static analysis tools fill:
they encode a checklist of "this is technically valid but a bad idea" rules and fail the build
before any of it reaches a real account.

### tflint

`tflint` focuses on Terraform-specific correctness and provider-specific best practices —
catching things like deprecated syntax, invalid instance types, or unused variables that
`validate` doesn't check.

```bash
# .tflint.hcl
plugin "aws" {
  enabled = true
  version = "0.31.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "terraform_unused_declarations" {
  enabled = true
}

rule "aws_instance_invalid_type" {
  enabled = true
}
```

```bash
tflint --init
tflint
```

```
2 issue(s) found:

Warning: variable "region" is declared but not used (terraform_unused_declarations)

  on variables.tf line 5:
   5: variable "region" {

Error: "t3.mega" is an invalid value as instance_type (aws_instance_invalid_type)

  on main.tf line 8:
   8:   instance_type = "t3.mega"
```

### tfsec and checkov

`tfsec` and `checkov` are security and compliance scanners. They scan the *static configuration*
for known-risky patterns — open security groups, unencrypted storage, missing logging, overly
permissive IAM — mapped to frameworks like CIS Benchmarks, and both can fail a CI build on
findings above a severity threshold.

```bash
# tfsec
tfsec .

# checkov
checkov -d . --framework terraform
```

Example finding (tfsec):
```
Result #1 HIGH Security group rule allows ingress from public internet.

  main.tf:3-9
  ────────────────────────────────────────────────────────────
     3   resource "aws_security_group" "web" {
     4     ingress {
     5       from_port   = 22
     6       to_port     = 22
     7       protocol    = "tcp"
     8       cidr_blocks = ["0.0.0.0/0"]
     9     }
  ────────────────────────────────────────────────────────────
    ID aws-vpc-no-public-ingress-sgr
```

### Comparison Table

| Tool | Focus | Catches | Speed | Config file | Cloud calls |
|------|-------|---------|-------|--------------|-------------|
| `terraform validate` | Syntax/internal consistency | Broken references, missing args | Instant | None | No |
| **tflint** | Terraform + provider correctness | Deprecated syntax, invalid values, unused vars/outputs | Fast (seconds) | `.tflint.hcl` | No (plugin metadata only) |
| **tfsec** | Security misconfiguration | Open ports, unencrypted storage, public buckets | Fast (seconds) | `.tfsec/config.yml` or inline ignores | No |
| **checkov** | Security + compliance frameworks | Same class as tfsec plus CIS/SOC2/PCI mapped policies, Sentinel-like policy-as-code | Slower (more checks) | `.checkov.yaml` | No |

Note: tfsec's checks were merged into Checkov's engine after Aqua Security (tfsec's maintainer)
partnered with Bridgecrew/Checkov's maintainer — many teams now standardize on Checkov alone,
but plenty of existing pipelines still run tfsec for its speed and simpler output.

### Analogy

If `validate` is grammar-check, tflint is a style guide editor who flags "you used a word that's
about to be deprecated in the next dictionary edition," and tfsec/checkov are a building
inspector who doesn't care about grammar at all — they just want to know if you left the front
door unlocked and the gas line exposed.

### Common Confusion

Teams sometimes run only one of these tools and assume it covers everything. tflint does not
catch security issues (an open security group is perfectly valid Terraform); tfsec/checkov do
not catch Terraform-idiom issues (unused variables, deprecated attribute names). They are
complementary, not redundant — a mature pipeline runs `validate` + `tflint` + `tfsec`/`checkov`
in sequence, each catching a different failure class.

### Interview Answer

"`validate` confirms the code is well-formed. `tflint` layers on Terraform- and provider-specific
best-practice checks — things like invalid instance types or unused declarations that are
syntactically fine but semantically wrong. `tfsec` and `checkov` are security and compliance
scanners that check the static configuration against known-risky patterns — public ingress
rules, unencrypted volumes, overly broad IAM — often mapped to compliance frameworks like CIS.
All three run entirely offline before any plan is generated, so they're the cheapest possible
place to fail fast, before a single API call is made against real infrastructure."

> **Memory hook:** validate checks grammar, tflint checks style, tfsec/checkov check whether you left the door unlocked.

---

## 4. Reading and Reviewing a terraform plan in a PR

Automated checks catch known patterns, but they cannot catch "this isn't what we meant to do."
Only a `terraform plan` — a preview of every create, update, and destroy Terraform is about to
perform — combined with a human who understands the intended change, can catch that. Reading a
plan is a skill: the output is dense, and the difference between a routine in-place update and a
destroy-and-recreate can be a single symbol easy to miss if you're skimming.

### Anatomy of a Plan

```
Terraform will perform the following actions:

  # aws_instance.web will be updated in-place
  ~ resource "aws_instance" "web" {
        id            = "i-0abcd1234"
      ~ instance_type = "t3.micro" -> "t3.small"
        tags          = {
            "Name" = "web-server"
        }
        # (12 unchanged attributes hidden)
    }

  # aws_security_group.web must be replaced
-/+ resource "aws_security_group" "web" {
      ~ name = "web-sg" -> "web-sg-v2" # forces replacement
        id   = "sg-0a1b2c3d"
    }

  # aws_s3_bucket.logs will be destroyed
  - resource "aws_s3_bucket" "logs" {
      - bucket = "my-app-logs-prod" -> null
    }

Plan: 0 to add, 1 to change, 1 to destroy, 1 to replace.
```

### The Symbol Legend

| Symbol | Meaning | Risk level |
|--------|---------|------------|
| `+` | Resource will be **created** | Low — usually additive and safe |
| `~` | Resource will be **updated in-place** | Depends — check *which* attribute changed |
| `-` | Resource will be **destroyed** | High — data loss possible, especially for stateful resources |
| `-/+` | Resource will be **destroyed then recreated** (replacement) | High — same risk as destroy, plus brief downtime |
| `<=` | Value is only known after apply (computed) | Informational |
| `# forces replacement` | Comment tagging *which attribute* triggered a replace | Critical to read — explains the `-/+` |

### Analogy

Reading a plan is like reading a surgical consent form before signing it — it lists exactly what
procedure is about to happen, on exactly which body part, in plain language, *before* the
anesthesia. Skimming past a `-/+` on a stateful database because you were only expecting a `~`
on an unrelated instance is the equivalent of signing the form without reading which limb is
listed.

### Under the Hood: Why "must be replaced" Happens

Terraform determines "update in place" vs "destroy and recreate" per attribute, based on the
provider's schema. Some arguments are mutable via an API call (e.g., changing an EC2 instance's
`tags` just calls `CreateTags`). Others are immutable at the infrastructure layer — you cannot
rename an S3 bucket via API, so changing `bucket` in the config has no update path; Terraform's
only option is to destroy the old one and create a new one with the new name.

```
Attribute changes  ──►  Provider schema lookup  ──►  Is this attribute
                                                       updatable in place?
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                                     YES                                            NO
                                       │                                             │
                              "~ update in-place"                         "-/+ destroy & recreate"
                          (single API call, e.g.                    (DeleteBucket then CreateBucket —
                           ModifyInstanceAttribute)                    original object/data lost)
```

### Common Mistakes

- **Skimming the summary line only.** "Plan: 3 to add, 1 to change" hides the fact that the "1 to
  change" is the production database security group losing its only ingress rule.
- **Not reading `# forces replacement` comments.** This is the single most important line in a
  plan — it tells you exactly which attribute caused a destroy-and-recreate.
- **Assuming `~` is always safe.** An in-place update on an IAM policy that removes a permission
  a downstream service depends on is just as dangerous as a destroy.
- **Reviewing the code diff instead of the plan.** The code diff shows intent; the plan shows the
  actual, concrete effect against the real current state — and those can diverge, especially
  after manual out-of-band changes (drift).

### Interview Answer

"A `terraform plan` is the single source of truth for what an apply will actually do, and
reviewing it is non-negotiable for anything touching production. I look at the symbol for each
resource — `+`, `~`, `-`, or `-/+` — and pay closest attention to any `-` or `-/+`, since those
represent destroy operations. For a `-/+`, I specifically look for the `# forces replacement`
comment to understand which attribute change is forcing the recreation, because that's often the
difference between an intentional recreate and an accidental one caused by, say, renaming a
resource in a way that changed its addressing."

> **Memory hook:** `+` is a new hire, `~` is a raise, `-` is a termination, and `-/+` is "fired and replaced" — read the fine print before you approve any of the last two.

---

## 5. Plan Output as a Gate in Code Review

Knowing how to read a plan is only useful if the plan is actually *in front of* the reviewer at
the moment they approve the PR. If the plan only appears in a build log the reviewer never opens,
it might as well not exist. The pattern that makes plan review actually work in practice is
posting the plan output directly into the pull request as a comment, so it sits right next to
the code diff the reviewer is already looking at.

### Example: Posting a Plan to a PR (GitHub Actions)

```yaml
name: Terraform Plan

on:
  pull_request:
    paths:
      - 'infra/**'

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.0

      - name: Terraform Init
        working-directory: infra
        run: terraform init

      - name: Terraform Plan
        id: plan
        working-directory: infra
        run: terraform plan -no-color -out=tfplan.binary
        continue-on-error: true

      - name: Show Plan as Text
        id: show
        working-directory: infra
        run: terraform show -no-color tfplan.binary > plan_output.txt

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        env:
          PLAN: ${{ steps.show.outputs.stdout }}
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infra/plan_output.txt', 'utf8').slice(0, 60000);
            const body = `#### Terraform Plan\n\`\`\`\n${plan}\n\`\`\``;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });

      - name: Fail Job if Plan Failed
        if: steps.plan.outcome == 'failure'
        run: exit 1
```

### The Gate in Practice

```
┌────────────────────────────────────────────────────────────────┐
│  Pull Request #482: "Bump instance_type to t3.small"           │
├────────────────────────────────────────────────────────────────┤
│  Files changed: main.tf  (+1 -1)                                │
│                                                                  │
│  🤖 CI Bot commented:                                            │
│  #### Terraform Plan                                            │
│  ~ aws_instance.web: instance_type "t3.micro" -> "t3.small"     │
│  -/+ aws_security_group.web: name forces replacement            │
│  Plan: 0 to add, 1 to change, 0 to destroy, 1 to replace.       │
│                                                                  │
│  👤 Reviewer: "Wait — why is the security group being replaced   │
│      for an instance_type change? That's not in the diff."      │
│                                                                  │
│  → Reviewer catches an unintended side effect BEFORE merge,      │
│    caused by a name collision the PR author didn't notice.      │
└────────────────────────────────────────────────────────────────┘
```

This is the entire value proposition: the plan surfaces a consequence the code diff alone did
not make obvious, and it surfaces it at the one point in the process where a human is already
paying attention and has the authority to block the merge.

### Analogy

Posting the plan on the PR is like a contractor emailing you photos of the actual demolition site
before swinging the wrecking ball, instead of just handing you the blueprint and hoping you can
mentally simulate what the blueprint implies for the building that's already standing there.

### Common Mistakes

- **Requiring approval on the PR but not re-running plan after new commits.** If a reviewer
  approves based on commit 1's plan and commit 3 changes the resource graph, the approval is
  stale. Most teams dismiss stale approvals automatically on new pushes.
  ```yaml
  # Branch protection setting (GitHub repo settings, not workflow YAML):
  # "Dismiss stale pull request approvals when new commits are pushed"
  ```
- **Letting `terraform apply` run from a different plan than the one that was reviewed.** If CI
  re-runs `plan` right before `apply` instead of reusing the saved `tfplan.binary` artifact from
  the PR, drift between review-time and apply-time state can mean the applied change differs
  from what was approved. Best practice: save the plan as an artifact and apply that exact file.
- **Posting a truncated or garbled plan.** GitHub comments have a size limit; naive concatenation
  of a huge plan can get silently cut off mid-resource, hiding exactly the destroy operation you
  needed to see. Truncate visibly and link to full CI logs.
- **Not gating merge on the plan job succeeding.** If `terraform plan` errors (e.g., a
  provider auth failure) but the PR can still be merged, teams end up merging blind.

### Interview Answer

"Posting the `terraform plan` output as a PR comment turns an invisible CI artifact into part of
the actual code review — reviewers see the concrete infrastructure diff right next to the code
diff, in the same interface, without needing to dig through CI logs. The critical detail is that
the plan output should come from a saved plan file (`terraform plan -out=tfplan.binary`) that is
the *exact* plan later applied, and that stale approvals get dismissed on new commits — otherwise
you can end up applying a plan nobody actually reviewed."

> **Memory hook:** A plan nobody looks at is a blueprint nobody checked before demolition — post it where the reviewer's eyes already are.

---

## 6. Common Mistakes

- **Running `terraform apply` locally against a shared production state.** Once CI is
  established as the source of truth for applies, a local apply bypasses every gate described
  above and can silently drift the reviewed history from the real infrastructure.
- **Treating linter warnings as optional noise.** Teams that let tflint/tfsec warnings
  accumulate without triage eventually can't tell a real new risk from background noise —
  the "boy who cried wolf" problem. Tune severity thresholds and suppress specific known-safe
  findings explicitly (with a comment explaining why), rather than ignoring the whole tool.
- **Skipping `-check` on `fmt` in CI and just letting a pre-commit hook handle it.** Pre-commit
  hooks can be bypassed with `--no-verify`; CI cannot be bypassed the same way, so CI is the
  actual enforcement point even if a local hook is a nice-to-have convenience.
- **Not pinning linter/tool versions.** tflint, tfsec, and checkov all ship new rules regularly;
  an unpinned version can start failing a previously-green pipeline with no code change, which
  looks like a false alarm and erodes trust in the gate.
- **Confusing "plan succeeded" with "plan is what we want."** A successful plan just means
  Terraform could compute one — it says nothing about whether the computed changes are the
  intended ones.

---

## 7. Hands-On Exercises

**Exercise 1 — Fix a Formatting Violation**
Write a `main.tf` with inconsistent indentation and misaligned `=` signs. Run
`terraform fmt -check -diff` and observe the exit code and diff output. Then run `terraform fmt`
without `-check` and confirm the file is rewritten.

**Exercise 2 — Break and Fix Validate**
Write a configuration that references `var.instance_typ` (typo) instead of `var.instance_type`.
Run `terraform validate` and read the error. Fix it and confirm `validate` passes.

**Exercise 3 — Install and Run tflint**
Install tflint, add a `.tflint.hcl` with the AWS ruleset plugin enabled, and intentionally set
`instance_type = "t3.mega"` (an invalid type). Run `tflint` and confirm it catches the error that
`validate` did not.

**Exercise 4 — Install and Run tfsec or checkov**
Write a security group resource with `cidr_blocks = ["0.0.0.0/0"]` on port 22. Run `tfsec .` (or
`checkov -d .`) and confirm it flags the open ingress rule. Fix it by restricting the CIDR and
re-run to confirm a clean result.

**Exercise 5 — Read a Real Plan**
Given the plan output below, answer: (a) which resource is being destroyed, (b) which resource is
being replaced and why, (c) is this plan safe to approve as-is?
```
  # aws_db_instance.primary will be destroyed
  - resource "aws_db_instance" "primary" {
      - identifier = "prod-db" -> null
    }

  # aws_iam_role.app will be updated in-place
  ~ resource "aws_iam_role" "app" {
      ~ description = "app role" -> "application service role"
    }
```

**Exercise 6 — Wire Up a Plan-Comment Workflow**
Using the GitHub Actions example from Section 5, set up a repository with a minimal Terraform
config, open a PR that changes an `instance_type`, and confirm the CI bot posts the plan as a
comment on the PR.

---

## 8. Interview Q&A

---

**Q1: What is the difference between `terraform fmt` and `terraform validate`?**

A: `terraform fmt` is a purely cosmetic formatter that standardizes whitespace, indentation, and
alignment — it never changes the meaning of the configuration. `terraform validate` performs a
static, offline check of syntax and internal consistency (undeclared variables, missing required
arguments, basic type checks) without making any calls to the cloud provider. Neither tool
checks actual cloud state or catches destructive changes — that's the job of `terraform plan`.

---

**Q2: Why doesn't `terraform validate` catch a security misconfiguration like an open security
group?**

A: `validate` only checks whether the HCL is syntactically correct and internally consistent —
an open CIDR block is completely valid Terraform syntax, so there's nothing for `validate` to
flag. Catching that class of issue requires a dedicated static analysis tool like tfsec or
checkov, which encode security and compliance rules on top of valid configuration.

---

**Q3: What's the difference between tflint and tfsec/checkov?**

A: tflint focuses on Terraform-idiom and provider-specific correctness — deprecated syntax,
invalid attribute values, unused variables or outputs. tfsec and checkov focus on security and
compliance — public ingress rules, unencrypted storage, overly permissive IAM policies, often
mapped to frameworks like CIS Benchmarks. They check different concerns and are typically run
together, not as substitutes for each other.

---

**Q4: What does `-/+` mean in a Terraform plan, and why does it happen?**

A: `-/+` means the resource will be destroyed and then recreated (a "replace"). It happens when a
changed attribute has no in-place update path in the provider's API — some attributes, like an
S3 bucket name, are immutable after creation, so the only way to apply the change is to delete
the old resource and create a new one. Terraform marks the specific attribute that triggered this
with a `# forces replacement` comment in the plan output.

---

**Q5: Why should the plan output be posted as a comment on the pull request rather than just left
in CI logs?**

A: Because reviewers rarely open CI logs during a code review, but they are already looking at
the PR. Posting the plan as a PR comment puts the concrete infrastructure diff directly next to
the code diff, which is where a reviewer can actually catch a mismatch between intended change
and actual effect — for example, an unrelated resource being replaced as a side effect of a
seemingly small edit.

---

**Q6: Why is it important to apply the exact plan that was reviewed, rather than re-running
`terraform plan` right before apply?**

A: Infrastructure and state can change between the time a plan is reviewed and the time it's
applied — someone else might merge a different change, or drift could occur outside Terraform.
If CI regenerates a fresh plan at apply time instead of reusing the saved plan file
(`terraform plan -out=tfplan.binary`), the applied changes could differ from what was actually
reviewed and approved, defeating the purpose of the review gate.

---

**Q7: What is "stale approval dismissal" and why does it matter for Terraform PRs?**

A: It's a GitHub branch protection setting that automatically invalidates a reviewer's approval
whenever new commits are pushed to the PR. It matters because a plan reviewed against commit 1
may no longer reflect reality after commit 3 changes the resource graph — without dismissing
stale approvals, a PR could merge on an approval that was given for a materially different plan.

---

**Q8: Can `terraform validate` detect that an apply will destroy a resource?**

A: No. `validate` has no awareness of current state or the diff between configuration and state
— it only checks that the configuration itself is well-formed. Detecting a destroy operation
requires `terraform plan`, which compares the configuration against the real current state to
compute the actual set of changes.
