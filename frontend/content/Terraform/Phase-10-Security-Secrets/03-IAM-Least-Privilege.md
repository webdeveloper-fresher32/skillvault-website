# 03 — IAM & Least Privilege

## Table of Contents

1. [Why Least Privilege for the Terraform Execution Role](#1-why-least-privilege-for-the-terraform-execution-role)
2. [Crafting a Scoped IAM Policy for Terraform CI](#2-crafting-a-scoped-iam-policy-for-terraform-ci)
3. [Separate Roles per Environment](#3-separate-roles-per-environment)
4. [Using OIDC for CI/CD Instead of Long-Lived Keys](#4-using-oidc-for-cicd-instead-of-long-lived-keys)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Least Privilege for the Terraform Execution Role

Here's a scenario that plays out in more organizations than you'd think: a team sets up their
first Terraform pipeline, hits a permissions error, gets frustrated, and — under deadline
pressure — just attaches `AdministratorAccess` to the CI role "to unblock the demo." Six months
later, that pipeline is still running with full account admin, nobody remembers why, and a single
leaked CI secret (a typo'd `echo $AWS_SECRET_ACCESS_KEY` in a debug step, a malicious dependency
in a build script, a compromised third-party GitHub Action) now means an attacker has root over
your entire AWS account — not just the ability to manage the three S3 buckets and one RDS
instance this pipeline was ever supposed to touch.

This is the entire argument for least privilege: the Terraform execution role should be able to
do exactly what its configurations need to do, and nothing else. If a bug, a leaked credential, or
a malicious PR ever manages to run arbitrary Terraform through that role, the blast radius should
be bounded by design — not by hope that nothing ever goes wrong.

### Analogy

Think of a hotel keycard system. A housekeeping staff member's keycard opens the rooms on their
assigned floor and the supply closet — nothing else. It doesn't open the manager's office, the
cash room, or every other floor's rooms, even though technically "housekeeping" sounds like a
broad, trusted role. If a housekeeping keycard is lost, the hotel's exposure is "someone can get
into rooms on one floor," not "someone can access every room and the safe." Least privilege for a
Terraform IAM role is exactly this: scope the keycard to the floor it actually needs.

### Under the Hood — Blast Radius Comparison

```
┌──────────────────────────────────────────────────────────────────┐
│  Scenario: CI secret for the Terraform role leaks                │
│                                                                     │
│  WITH AdministratorAccess:                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Attacker can: create/delete ANY resource, read ANY data, │    │
│  │  modify IAM itself, exfiltrate secrets from Secrets       │    │
│  │  Manager, spin up crypto-mining fleets, delete backups.   │    │
│  │  Blast radius = ENTIRE AWS ACCOUNT                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│  WITH scoped least-privilege policy:                              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Attacker can: only act on the specific resource types    │    │
│  │  and ARNs/prefixes this pipeline manages (e.g., EC2/RDS/  │    │
│  │  S3 tagged Environment=staging). Cannot touch IAM,        │    │
│  │  cannot touch production, cannot touch billing.           │    │
│  │  Blast radius = ONE ENVIRONMENT'S RESOURCES               │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Common Confusion

A common objection: "but Terraform needs to create almost anything — how do I know the full list
of permissions up front?" You don't need to guess by intuition — AWS actually tells you. Every
denied API call in CloudTrail shows the exact action that failed
(`AccessDenied ... on operation rds:CreateDBInstance`), so the practical approach is to start
narrow, run `terraform plan`/`apply` in a sandboxed dry run, and add exactly the actions that get
denied — an iterative, evidence-based tightening rather than a guessed broad grant "to be safe."
Tools like `iamlive` or AWS's own IAM Access Analyzer policy generation can also derive a policy
from actual CloudTrail activity.

### Interview Answer

"Least privilege for a Terraform execution role means scoping its IAM permissions to exactly the
actions and resources its configurations manage — nothing broader. The reasoning is blast-radius
containment: CI credentials do leak, occasionally through a compromised dependency, a
misconfigured log, or a malicious pull request that runs in the pipeline's context. If that role
only has `AdministratorAccess`, a single leak compromises the whole account. If it's scoped to,
say, EC2/RDS/S3 actions on resources tagged for one environment, the same leak is contained to
that environment's resources, and can't touch IAM, billing, or other accounts."

> **Memory hook:** A leaked keycard should open one floor, not the whole hotel — scope the Terraform role to exactly what it touches.

---

## 2. Crafting a Scoped IAM Policy for Terraform CI

Turning "least privilege" from a principle into an actual policy document means enumerating the
specific actions Terraform needs for the resource types it manages, and — wherever the API
supports it — constraining those actions to specific resource ARNs or tag-based conditions rather
than `Resource = "*"`.

### Example: A Policy for a Pipeline Managing VPC + RDS + S3

```hcl
data "aws_iam_policy_document" "terraform_ci" {
  # --- Networking: VPC, subnets, security groups ---
  statement {
    sid    = "NetworkingManage"
    effect = "Allow"
    actions = [
      "ec2:CreateVpc", "ec2:DeleteVpc", "ec2:DescribeVpcs",
      "ec2:CreateSubnet", "ec2:DeleteSubnet", "ec2:DescribeSubnets",
      "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress",
      "ec2:DescribeSecurityGroups",
      "ec2:CreateTags", "ec2:DeleteTags",
    ]
    resources = ["*"]  # EC2 networking actions largely don't support resource-level ARNs
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["us-east-1"]
    }
  }

  # --- RDS: scoped to a naming prefix for this environment ---
  statement {
    sid    = "RDSManageStaging"
    effect = "Allow"
    actions = [
      "rds:CreateDBInstance", "rds:DeleteDBInstance", "rds:ModifyDBInstance",
      "rds:DescribeDBInstances", "rds:AddTagsToResource",
      "rds:CreateDBSubnetGroup", "rds:DeleteDBSubnetGroup",
    ]
    resources = [
      "arn:aws:rds:us-east-1:123456789012:db:staging-*",
      "arn:aws:rds:us-east-1:123456789012:subgrp:staging-*",
    ]
  }

  # --- S3: scoped to a specific bucket prefix, not all buckets ---
  statement {
    sid    = "S3ManageAppBuckets"
    effect = "Allow"
    actions = [
      "s3:CreateBucket", "s3:PutBucketPolicy", "s3:PutBucketVersioning",
      "s3:PutEncryptionConfiguration", "s3:PutBucketPublicAccessBlock",
      "s3:GetBucket*", "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::staging-app-*",
    ]
  }

  # --- Explicit deny on IAM self-modification, regardless of any Allow above ---
  statement {
    sid    = "DenyIAMSelfEscalation"
    effect = "Deny"
    actions = [
      "iam:CreateUser", "iam:CreatePolicy", "iam:AttachUserPolicy",
      "iam:AttachRolePolicy", "iam:PutRolePolicy", "iam:CreateAccessKey",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "terraform_ci" {
  name   = "terraform-ci-staging-scoped"
  policy = data.aws_iam_policy_document.terraform_ci.json
}
```

### Why the Explicit Deny Matters

Even a well-scoped Allow list can be dangerous if it accidentally includes an IAM-modifying action
(easy to do — `iam:PassRole` in particular is a common oversight when an EC2 instance profile is
involved). An explicit `Deny` statement on privilege-escalation actions acts as a hard backstop:
in AWS's policy evaluation logic, an explicit `Deny` always wins over any `Allow`, anywhere in any
attached policy — so even a future mistake that broadens the Allow side can't grant the CI role
the ability to escalate its own permissions.

### Common Mistakes

- Using `Resource = "*"` everywhere "because it was easier to get working," instead of pinning to
  ARNs or tag conditions once the actual resource naming pattern is known.
- Forgetting that some AWS actions (many EC2 networking calls, in particular) simply don't support
  resource-level restriction — for those, compensate with condition keys (region, tags) instead.
- Not adding the explicit `Deny` backstop on IAM self-escalation actions, relying purely on
  "we just won't add those to the Allow list."

### Interview Answer

"I derive the policy from what the configuration actually provisions, then scope each statement's
`Resource` to specific ARNs or tag-based conditions rather than a wildcard. For actions AWS
doesn't support resource-level scoping on, I compensate with condition keys like
`aws:RequestedRegion`. I also add an explicit `Deny` statement on IAM self-modification actions
like `iam:CreateAccessKey` or `iam:AttachRolePolicy` — since explicit denies always win over
allows in AWS's evaluation logic, that's a hard backstop against privilege escalation even if the
Allow list is accidentally broadened later."

> **Memory hook:** Scope the Allow list to exactly what's provisioned, then bolt on an explicit Deny as a backstop that no future mistake can override.

---

## 3. Separate Roles per Environment

If one IAM role manages both staging and production Terraform runs, you've collapsed two
different blast radii into one. A bug in a staging pull request — or a compromised staging CI
secret — now has a path to production, because the role that ran it could always touch
production resources too. Separate roles per environment turn "staging leaked" and "production
leaked" back into two genuinely different, independently contained incidents.

### Analogy

This is the same reason a company issues separate badges for its staging office and its data
center floor, rather than one badge that opens both. Losing the staging office badge is an
inconvenience. Losing a badge that also opens the data center is a completely different severity
of incident. Keeping the badges separate means the blast radius of losing one is knowable and
bounded.

### Structuring Roles per Environment

```hcl
locals {
  environments = ["staging", "production"]
}

resource "aws_iam_role" "terraform_ci" {
  for_each = toset(local.environments)

  name = "terraform-ci-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Only the workflow deploying to THIS environment can assume THIS role
            "token.actions.githubusercontent.com:sub" = "repo:my-org/infra:environment:${each.key}"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "terraform_ci" {
  for_each = toset(local.environments)

  role       = aws_iam_role.terraform_ci[each.key].name
  policy_arn = aws_iam_policy.terraform_ci_scoped[each.key].arn
}
```

Each environment's Terraform Cloud workspace, GitHub Actions environment, or CI pipeline job is
then configured to assume only its own environment's role — a staging pipeline run has no
credential path that resolves to the production role at all, at the identity-provider level, not
just "the policy happens not to grant it."

### Common Confusion

Some teams think "we'll just use one role but add tag-based conditions to prevent staging from
touching production resources" is equivalent to separate roles. It's *weaker*: it depends on every
production resource being tagged correctly, forever, with no exceptions — one untagged resource
and the "restriction" silently doesn't apply. Separate roles with separate trust policies (who can
even assume the role) fail closed by default; tag-based single-role restrictions fail open the
moment a tag is missing.

### Interview Answer

"Separate IAM roles per environment ensure that a compromise or bug in one environment's pipeline
can't reach another environment's resources, because the credential itself — not just a policy
condition — is scoped to that environment. I'd tie each role's trust policy to the specific CI
environment or workspace that's allowed to assume it, so a staging workflow has no identity path
to the production role at all. This is more robust than a single shared role with tag-based
conditions, because tag-based restrictions fail open if a resource is ever left untagged, while
separate-role trust policies fail closed by default."

> **Memory hook:** One badge for staging, one for production — losing one should never open the other's door.

---

## 4. Using OIDC for CI/CD Instead of Long-Lived Keys

For years, the default way to let CI run Terraform against AWS was to generate a long-lived IAM
user access key pair and paste it into the CI provider's secrets store. That key works forever
until someone manually rotates or revokes it — which means if it ever leaks (checked into a log,
exposed by a misconfigured build artifact, exfiltrated by a compromised Action), it remains valid
and exploitable indefinitely, or until someone notices and acts.

OIDC (OpenID Connect) federation solves this by removing the long-lived key entirely. Instead, the
CI provider (GitHub Actions, GitLab CI, CircleCI) presents a short-lived, cryptographically signed
identity token, and AWS exchanges that token for temporary credentials that expire automatically —
typically within an hour.

### Analogy

A long-lived access key is like giving a delivery contractor a permanent key to your building —
they can use it forever, and if they lose it, anyone who finds it can walk in indefinitely until
you manually change every lock. OIDC federation is like a building that checks the contractor's
company ID badge at the door each time, issues a temporary visitor pass valid for exactly one
hour, and never hands out a permanent key at all. If that visitor pass is somehow copied, it stops
working within the hour regardless.

### Diagram: GitHub Actions → AWS OIDC → Temporary Credentials

```
┌────────────────────────┐
│   GitHub Actions        │
│   workflow run starts   │
└───────────┬─────────────┘
            │ 1. GitHub mints a short-lived, signed OIDC JWT
            │    (claims: repo, branch, environment, workflow)
            ▼
┌────────────────────────────────────────────────────────────┐
│  token.actions.githubusercontent.com  (OIDC identity provider)│
└───────────┬──────────────────────────────────────────────────┘
            │ 2. JWT presented to AWS STS
            ▼
┌────────────────────────────────────────────────────────────┐
│  AWS STS: AssumeRoleWithWebIdentity                          │
│                                                                │
│  - Validates JWT signature against GitHub's OIDC provider     │
│  - Checks the role's trust policy "sub"/"aud" conditions      │
│    match this exact repo + branch/environment                 │
└───────────┬──────────────────────────────────────────────────┘
            │ 3. Issues TEMPORARY credentials (~1 hour TTL)
            ▼
┌────────────────────────────────────────────────────────────┐
│  terraform-ci-staging role session                            │
│  AccessKeyId / SecretAccessKey / SessionToken                 │
│  — expires automatically, nothing to rotate, nothing to revoke│
└───────────┬──────────────────────────────────────────────────┘
            │ 4. terraform plan / apply runs using these creds
            ▼
                  AWS resources created/modified
```

### Setting Up the OIDC Provider and Trust Policy

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_oidc_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Locks the role to a specific repo AND branch — not "any workflow anywhere"
      values = ["repo:my-org/infra:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "terraform_ci_oidc" {
  name               = "terraform-ci-github-oidc"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust.json
}
```

The corresponding GitHub Actions workflow needs no AWS secret at all:

```yaml
permissions:
  id-token: write   # required to request the OIDC JWT
  contents: read

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci-github-oidc
          aws-region: us-east-1
      - run: terraform init && terraform apply -auto-approve
```

### Comparison: Long-Lived Keys vs OIDC

| Dimension | Long-Lived IAM User Keys | OIDC Federation |
|---|---|---|
| **Credential lifetime** | Indefinite until manually rotated/revoked | Minutes to ~1 hour, auto-expiring |
| **Storage** | Must be stored as a CI secret somewhere | Nothing stored — minted fresh per run |
| **Leak impact** | Valid until manually revoked, potentially forever | Expires on its own even if leaked |
| **Rotation burden** | Manual process, easy to neglect | None — there is nothing to rotate |
| **Scoping** | Whatever the IAM user's policy allows, any time, from anywhere | Trust policy can lock to exact repo/branch/environment |
| **Setup complexity** | Simple (create user, generate key) | Slightly more setup (OIDC provider + trust policy conditions) |

### Common Mistakes (Overly Broad `*` Permissions)

- **Trust policy with `"sub": "repo:my-org/infra:*"`** instead of pinning to an exact branch or
  environment — this lets *any* branch or PR in that repo assume the role, including an untrusted
  contributor's feature branch in a public repo.
- **Reusing IAM user access keys "temporarily" alongside OIDC** during a migration and never
  finishing the cutover — the old long-lived key remains a live, forgotten backdoor.
- **Granting `Resource = "*"` with `Action = "*"`** anywhere in the policy attached to the OIDC
  role — OIDC fixes the *credential lifetime* problem, not the *policy scope* problem; you still
  need least-privilege actions/resources from sections 1–2.
- **Forgetting `permissions: id-token: write`** in the GitHub Actions workflow — without it, the
  workflow can't request the OIDC token at all, and the failure mode looks like a generic
  AssumeRole error rather than clearly pointing at the missing permission.
- **Not scoping the audience (`aud`) condition** — omitting the `token.actions.githubusercontent.com:aud`
  check means the trust policy validates less about the token than it should.

---

## 5. Common Mistakes

- **Attaching `AdministratorAccess` to the Terraform CI role "to unblock a demo"** and never
  circling back to scope it down.
- **One shared role for all environments**, collapsing independent blast radii into a single point
  of failure.
- **Using long-lived IAM user access keys in CI** when OIDC federation is available and removes
  the entire class of "leaked static credential" risk.
- **Wildcard trust policy conditions** (`repo:my-org/infra:*`) that let any branch or fork assume
  a privileged role.
- **No explicit Deny backstop on IAM self-escalation actions**, relying solely on a hand-curated
  Allow list to never include them.
- **Never revisiting the policy after initial setup** — permissions accrete over time as new
  resource types get added to the configuration, but nobody removes the ones no longer needed.

---

## 6. Hands-On Exercises

**Exercise 1 — Policy Scoping Exercise**
Given a Terraform configuration that only manages an S3 bucket named `my-app-uploads-*` and a
CloudFront distribution in front of it, write a least-privilege IAM policy document. Explain which
actions, if any, cannot be scoped to a specific resource ARN and why.

**Exercise 2 — Trust Policy Audit**
Review this OIDC trust policy condition and explain the security problem with it, then rewrite it
correctly:
```hcl
condition {
  test     = "StringLike"
  variable = "token.actions.githubusercontent.com:sub"
  values   = ["repo:my-org/*:*"]
}
```

**Exercise 3 — Blast Radius Reasoning**
A company runs one Terraform Cloud workspace and one AWS IAM role for both staging and production,
distinguishing them only by a `terraform.workspace` conditional inside the `.tf` files. Explain
two concrete ways this design could let a staging-only change accidentally affect production, and
propose the fix from Section 3.

**Exercise 4 — Migrating Off Long-Lived Keys**
Write the sequence of steps (as a checklist, not code) to migrate an existing GitHub Actions
pipeline from a static IAM user access key stored as a repo secret, to OIDC federation — including
what to verify before deleting the old access key.

---

## 7. Interview Q&A

---

**Q1: Why shouldn't a Terraform CI role have `AdministratorAccess`?**

A: Because CI credentials do occasionally leak — through a compromised dependency, a
misconfigured debug log, or a malicious pull request executing in the pipeline's context. If the
role only has `AdministratorAccess`, that single leak compromises the entire AWS account. Scoping
the role to exactly the actions and resources its configurations manage bounds the blast radius to
what that pipeline was ever supposed to touch.

---

**Q2: How do you handle AWS actions that don't support resource-level ARN restriction in an IAM
policy?**

A: Compensate with condition keys instead — for example, restricting by `aws:RequestedRegion`, by
resource tags via `aws:ResourceTag/*`, or by source VPC/IP conditions. Many EC2 networking actions
fall into this category; you can't scope `ec2:CreateSecurityGroup` to a specific ARN because the
resource doesn't exist yet at authorization time, but you can still constrain the region or
account it's created in.

---

**Q3: Why use separate IAM roles per environment instead of one role with conditional logic?**

A: Separate roles create genuinely independent trust boundaries — the credential itself is scoped
per environment via each role's trust policy, so there's no identity path from a staging pipeline
to production resources at all. A single shared role relying on tag-based conditions or
`terraform.workspace` logic fails open if a resource is ever left untagged or the conditional logic
has a bug, whereas separate roles fail closed by default.

---

**Q4: What problem does OIDC federation solve that long-lived IAM access keys don't?**

A: Long-lived access keys remain valid indefinitely once issued — if leaked, they're exploitable
until someone manually notices and revokes them. OIDC federation eliminates the stored credential
entirely: the CI provider presents a short-lived signed identity token, AWS validates it against
the role's trust policy conditions (repo, branch, environment), and issues temporary credentials
that expire automatically, typically within an hour, with nothing left to rotate or revoke.

---

**Q5: What's wrong with a GitHub OIDC trust policy condition like
`"sub": "repo:my-org/infra:*"`?**

A: The wildcard allows any branch, tag, or pull-request context within that repository to assume
the role — including an external contributor's PR branch if the repo accepts outside
contributions, or any developer's throwaway feature branch. It should be scoped to the exact
branch or deployment environment that's actually authorized, e.g.
`repo:my-org/infra:ref:refs/heads/main` or `repo:my-org/infra:environment:production`.

---

**Q6: Why is an explicit `Deny` on IAM self-escalation actions useful even with a carefully
scoped Allow list?**

A: In AWS's policy evaluation logic, an explicit `Deny` always overrides any `Allow`, across every
policy attached to a principal. Adding an explicit deny on actions like `iam:CreateAccessKey` or
`iam:AttachRolePolicy` provides a hard backstop: even if a future change accidentally broadens the
Allow list to include an IAM-modifying action, the explicit deny still blocks it, preventing the
CI role from ever being used to escalate its own privileges.
