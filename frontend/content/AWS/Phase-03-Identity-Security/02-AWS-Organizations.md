# AWS Organizations

## Table of Contents

1. [What is AWS Organizations?](#what-is-aws-organizations)
2. [Master Account vs Member Accounts](#master-account-vs-member-accounts)
3. [Organizational Units (OUs)](#organizational-units-ous)
4. [Service Control Policies (SCPs)](#service-control-policies-scps)
5. [SCP vs IAM Policy](#scp-vs-iam-policy)
6. [SCP Examples](#scp-examples)
7. [Multi-Account Strategy](#multi-account-strategy)
8. [Common Account Patterns](#common-account-patterns)
9. [Consolidated Billing](#consolidated-billing)
10. [Other Organizations Features](#other-organizations-features)
11. [Interview Q&A](#interview-qa)

---

## What is AWS Organizations?

AWS Organizations is a service that lets you consolidate multiple AWS accounts into a single organization that you centrally manage.

Without Organizations, every AWS account is completely independent:
- Separate billing
- No central governance
- No way to restrict what member accounts can do
- No sharing of resources

With Organizations, you get:
- **Central billing**: One invoice for all accounts
- **Governance**: Apply policies across all accounts from the management account
- **Structure**: Organise accounts into logical groups (Organizational Units)
- **Security guardrails**: Service Control Policies restrict what accounts can do
- **Resource sharing**: AWS RAM (Resource Access Manager) shares resources across accounts

### Why Use Multiple AWS Accounts?

A common question is: "Why not just use one account with multiple IAM users?"

**Single account problems:**
- A bug in production code can accidentally delete development data
- Compromised credentials in one team can affect all teams
- No billing separation by team/project
- IAM permissions complexity grows exponentially
- Reaching service quotas (EC2 limits, VPC limits) affects everyone
- Compliance: some regulations require environment isolation

**Multi-account benefits:**
- **Blast radius control**: An incident in the dev account cannot affect production
- **Billing clarity**: See exactly how much each team/environment/project costs
- **Security isolation**: Compromise of one account doesn't cascade
- **Service quotas**: Each account has its own independent quotas
- **Compliance**: Regulated workloads can be in a dedicated account with strict controls

---

## Master Account vs Member Accounts

### Management Account (formerly Master Account)

The **management account** is the AWS account that created the organization. It:
- Owns and manages the entire organization
- Is the only account that can create/delete OUs, invite/remove member accounts
- Is where consolidated billing rolls up
- Is where Service Control Policies are managed
- Has a special trust relationship — it is NOT subject to SCPs (important!)
- Should contain ONLY organization management resources — not application workloads

> Security best practice: The management account should have minimal resources and minimal IAM users. Use it ONLY for billing, governance, and organization management. All actual workloads belong in member accounts.

### Member Accounts

Any account that is part of the organization but is not the management account. Member accounts:
- Join the organization by invitation (existing account) or by being created within the organization
- Are subject to SCPs applied by the management account
- Have their billing rolled up to the management account
- Can be given delegated admin permissions for specific services
- Can leave the organization (if the account has a valid payment method)
- Can be moved between OUs

---

## Organizational Units (OUs)

### What is an OU?

An Organizational Unit (OU) is a container for AWS accounts within the organization. OUs form a hierarchical tree structure rooted at the organization root.

### OU Hierarchy

```
ROOT
├── Security OU
│   ├── Log Archive Account
│   └── Security Tooling Account
│
├── Infrastructure OU
│   ├── Network Account
│   └── Shared Services Account
│
├── Sandbox OU
│   └── Individual developer sandbox accounts
│
├── Workloads OU
│   ├── Development OU
│   │   ├── Dev Account - App A
│   │   └── Dev Account - App B
│   │
│   ├── Staging OU
│   │   ├── Staging Account - App A
│   │   └── Staging Account - App B
│   │
│   └── Production OU
│       ├── Prod Account - App A
│       └── Prod Account - App B
│
└── Suspended OU
    └── Accounts pending closure
```

### Why Use OUs?

1. **Group similar accounts**: All production accounts in one OU
2. **Apply policies at scale**: Attach one SCP to the Production OU and it affects all production accounts
3. **Inheritance**: Policies applied to a parent OU are inherited by child OUs and accounts
4. **Delegation**: Give different teams control over their OU subtree
5. **Reporting**: Cost Explorer and AWS Config can report per-OU

### OU Rules

- An OU can contain accounts and other OUs (up to 5 levels deep)
- An account can only be in ONE OU at a time
- Policies flow down: root → OU → child OU → account (inheritance)
- Maximum 1,000 accounts per organization by default (can be increased)

---

## Service Control Policies (SCPs)

### What is an SCP?

A Service Control Policy is a JSON policy document that defines the **maximum permissions** available to accounts in an OU or the entire organization.

Key insight: **SCPs do not grant permissions. They define the ceiling of permissions.** Even if an IAM policy in a member account grants `"Action": "*"`, if the SCP doesn't allow an action, that action is blocked.

SCPs apply to:
- All users in the account (including root user of the member account!)
- All roles in the account
- All services in the account

SCPs do NOT apply to:
- The management account itself
- Service-linked roles (they bypass SCPs)

### SCP Evaluation Logic

```
A request in a member account succeeds only if:
    SCP ALLOWS the action
    AND
    IAM policy ALLOWS the action

Even if IAM policy says Allow, if SCP doesn't include it --> DENY
Even if SCP includes it, if IAM policy doesn't allow it --> DENY
```

### Default SCP: FullAWSAccess

When you enable Organizations, a default SCP called `FullAWSAccess` is attached to the root, allowing all actions on all resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}
```

This means by default, SCPs don't restrict anything. You must explicitly add restrictive SCPs to the root or specific OUs.

---

## SCP vs IAM Policy

This is a critical distinction:

| Feature | SCP | IAM Policy |
|---------|-----|------------|
| What it is | Organization-level guardrail | Account-level permissions |
| Grants permissions | NO — only sets ceiling | YES |
| Applies to | Entire accounts | Users/Roles/Groups |
| Can be bypassed by root? | Root of MEMBER account cannot bypass | Root user can override if they have admin IAM |
| Applies to management account? | NO | YES |
| Service-linked roles affected? | NO | YES (but limited) |
| Purpose | Governance and guardrails | Day-to-day access control |
| Think of it as | The walls of the sandbox | What you can build inside the sandbox |

### Interaction Example

```
SCP on Production OU:
    Allow: ["ec2:*", "s3:*", "rds:*"]   (only these services allowed)
    Implicitly denies everything else

IAM policy on developer-alice in a Production account:
    Allow: ["iam:CreateUser", "ec2:*"]

Effective permissions for alice:
    ec2:*  --> Allowed (both SCP and IAM allow it)
    s3:*   --> DENIED  (SCP allows it, but IAM doesn't grant it → implicit deny)
    iam:CreateUser --> DENIED (IAM allows it, but SCP doesn't → SCP blocks it)
```

---

## SCP Examples

### Example 1: Deny Deleting S3 Objects

Prevent anyone in the member accounts from deleting S3 objects (including admins):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyS3ObjectDeletion",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:DeleteBucket"
      ],
      "Resource": "*"
    }
  ]
}
```

Apply to the Production OU — no one can accidentally (or maliciously) delete S3 data in production.

### Example 2: Require MFA for Sensitive Actions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyHighRiskWithoutMFA",
      "Effect": "Deny",
      "Action": [
        "ec2:TerminateInstances",
        "rds:DeleteDBInstance",
        "s3:DeleteBucket",
        "iam:DeleteUser",
        "iam:DeleteRole"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

### Example 3: Restrict to Specific AWS Regions

Ensure all resources are created only in approved Regions (e.g., only Sydney for an Australian company):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyNonApprovedRegions",
      "Effect": "Deny",
      "NotAction": [
        "iam:*",
        "organizations:*",
        "route53:*",
        "budgets:*",
        "waf:*",
        "cloudfront:*",
        "globalaccelerator:*",
        "importexport:*",
        "support:*",
        "sts:*"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "ap-southeast-2",
            "ap-southeast-4"
          ]
        }
      }
    }
  ]
}
```

Note: `NotAction` is used here to exclude global services (IAM, Route 53, etc.) from the region restriction.

### Example 4: Deny Leaving the Organization

Prevent member accounts from leaving the organization:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyLeavingOrg",
      "Effect": "Deny",
      "Action": "organizations:LeaveOrganization",
      "Resource": "*"
    }
  ]
}
```

### Example 5: Deny Root User API Calls (Critical Security Control)

Prevent the root user of member accounts from making API calls (the root user should be locked away and never used):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyRootAccountUsage",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "aws:PrincipalArn": "arn:aws:iam::*:root"
        }
      }
    }
  ]
}
```

### Example 6: Restrict Instance Types (Cost Control)

Only allow small instance types to prevent budget explosions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyLargeInstances",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringNotEquals": {
          "ec2:InstanceType": [
            "t2.micro", "t2.small", "t2.medium",
            "t3.micro", "t3.small", "t3.medium",
            "t3.large"
          ]
        }
      }
    }
  ]
}
```

---

## Multi-Account Strategy

### Why Separate Accounts for Environments?

The most common pattern is one account per environment:

```
Single Account Risks:
    Developer accidentally runs: aws ec2 terminate-instances --instance-ids $(aws ec2 describe-instances ...)
    Could terminate PRODUCTION instances because they're all in the same account!

Multi-Account Protection:
    Developer logs in with credentials for the DEV account only
    Has no credentials for the PROD account
    Cannot affect production regardless of what they do in dev
```

### The AWS Landing Zone / Control Tower Pattern

AWS Control Tower automates the setup of a secure, multi-account AWS environment (called a Landing Zone):

```
Management Account
    (Only billing, org management, Control Tower)
    |
    Organization ROOT
        |
        |-- Security OU
        |     |-- Audit Account (Security Hub, GuardDuty, CloudTrail aggregation)
        |     |-- Log Archive Account (centralized CloudTrail and Config logs)
        |
        |-- Sandbox OU
        |     |-- Developer sandbox accounts (one per developer)
        |     SCPs: Restrict regions, deny expensive services
        |
        |-- Workloads OU
              |-- Development OU
              |     |-- Dev accounts per application
              |     SCPs: Allow dev services, deny production data access
              |
              |-- Staging OU
              |     |-- Staging accounts per application
              |     SCPs: Similar to prod but relaxed
              |
              |-- Production OU
                    |-- Prod accounts per application
                    SCPs: Strict controls, require MFA, deny region changes, deny deletion
```

### Account Vending Machine

As organizations grow, they need to create new accounts frequently. The "Account Vending Machine" pattern automates account creation:
1. Developer submits a form (Jira ticket, service catalog request)
2. Automation creates a new AWS account within the Organization
3. Applies standard SCPs for the OU
4. Deploys baseline infrastructure (VPC, logging, security tools) via CloudFormation StackSets
5. Sends account details to the requester

Tools: AWS Control Tower, AWS Service Catalog, Terraform, or custom Lambda automation.

---

## Common Account Patterns

### Pattern 1: Simple 3-Account Setup (Small Teams)

```
Management Account: billing/governance only
Development Account: all dev/test work
Production Account: only production workloads
```

### Pattern 2: Standard 5-Account Setup

```
Management Account: billing/governance
Security Account: GuardDuty, Security Hub, CloudTrail aggregation
Shared Services Account: DNS, AD, monitoring, CI/CD tools
Development Account: dev and test
Production Account: production
```

### Pattern 3: Enterprise (Per-Application)

```
Management Account
    Security OU:
        - Audit Account
        - Log Archive Account
    Platform OU:
        - Network Account (Transit Gateway, shared VPCs)
        - Shared Services Account (AD, DNS, CI/CD)
    Workloads OU:
        App-A OU:
            - App-A-Dev Account
            - App-A-Staging Account
            - App-A-Prod Account
        App-B OU:
            - App-B-Dev Account
            - App-B-Staging Account
            - App-B-Prod Account
```

---

## Consolidated Billing

### What is Consolidated Billing?

With Organizations, all member accounts' charges roll up to the management account in a single monthly invoice. This provides:

**1. Single Invoice**: One bill instead of N bills for N accounts.

**2. Volume Discounts**: AWS pricing for services like S3, EC2, and data transfer is tiered — you pay less per unit the more you use. Consolidated billing aggregates usage across all accounts, potentially moving into a lower price tier.

**Example:**
```
Account A: uses 40 TB of S3 data ($0.023/GB for first 50 TB)
Account B: uses 40 TB of S3 data ($0.023/GB for first 50 TB)

Without consolidation:
    Account A pays: 40,960 GB × $0.023 = $942
    Account B pays: 40,960 GB × $0.023 = $942
    Total: $1,884

With consolidation:
    Combined 80 TB
    First 50 TB: 51,200 GB × $0.023 = $1,177.60
    Next 30 TB: 30,720 GB × $0.022 = $675.84  (lower tier)
    Total: $1,853.44
    Savings: ~$30 (not huge in this example, but scales with usage)
```

**3. Reserved Instance and Savings Plans Sharing**: If one account purchases Reserved Instances but doesn't fully use them, the unused reservations can be applied to usage in other accounts in the organization, maximizing RI utilization.

**4. Cost Allocation**: Despite consolidated billing, you can still see per-account breakdown in Cost Explorer.

### Payment and Cost Management

- The management account's credit card is charged for all accounts
- Member accounts can be given access to their own billing data (if you enable it)
- Member accounts can have their own budgets and cost alerts
- IAM users in member accounts can be given access to the Billing console (if management account enables it)

---

## Other Organizations Features

### AWS CloudTrail Organization Trail

Instead of enabling CloudTrail in every account individually, create an organization trail in the management account that automatically captures API activity from ALL member accounts into a central S3 bucket (in the Log Archive account).

### AWS Config Organization Rules

Deploy AWS Config rules across all accounts in the organization simultaneously. Detect non-compliant resources (e.g., "all S3 buckets must have versioning enabled") across the entire organization.

### AWS Security Hub Organization

Automatically enable Security Hub in all accounts and aggregate security findings from GuardDuty, Inspector, Macie, and other services into a central Security Hub in the Audit account.

### Delegated Administration

Instead of doing everything from the management account, you can designate member accounts as delegated administrators for specific services:
- Security account = delegated admin for GuardDuty, Security Hub
- Network account = delegated admin for AWS Firewall Manager
- This follows least privilege — the management account doesn't need service-level access

### Tag Policies

Enforce consistent tagging across all accounts. Example: all EC2 instances must have a `CostCenter` tag.

### Backup Policies

Enforce backup rules across all accounts. Example: all EC2 instances in production must be backed up daily with 30-day retention.

---

## Interview Q&A

### Q1: What is AWS Organizations and why would you use it?

**Answer:** AWS Organizations is a service that groups multiple AWS accounts under a central management account for unified billing, governance, and policy enforcement. You use it when you have multiple AWS accounts that need centralized billing, when you want to apply security guardrails across all accounts using Service Control Policies, when you need to share resources (Reserved Instances, Savings Plans) across accounts, and when you want to automate account creation and baseline configuration.

### Q2: What is the difference between a management account and a member account?

**Answer:** The management account (formerly master account) created the organization, owns the billing, and manages the organizational structure (OUs, SCPs). It is NOT subject to SCPs — there are no guardrails on the management account itself, which is why it should be used only for governance and contain no application workloads. Member accounts are all other accounts in the organization. They are subject to SCPs applied by the management account.

### Q3: What is a Service Control Policy (SCP)?

**Answer:** An SCP is a JSON policy document attached to OUs or the organization root that defines the maximum permissions available in member accounts. SCPs do not grant permissions — they are permission ceilings. Even if an IAM policy in a member account allows an action, if the SCP does not allow it, the action is blocked. SCPs apply to all users, roles (including root user of member accounts), but not to service-linked roles and not to the management account.

### Q4: Can SCPs override the root user in a member account?

**Answer:** Yes. This is a key difference from IAM policies. SCPs apply to ALL principals in a member account, including the account's root user. If an SCP denies `ec2:TerminateInstances`, even the root user of that member account cannot terminate EC2 instances. The only account root user immune to SCPs is the root user of the management account.

### Q5: What is the difference between an SCP and an IAM policy?

**Answer:** An SCP sets the maximum permissions ceiling at the account level. An IAM policy grants actual permissions to specific identities (users, roles). For an action to succeed, BOTH must allow it. The SCP is evaluated first — if it doesn't allow the action, no amount of IAM permissions will help. SCPs are managed in the Organizations service. IAM policies are managed in IAM. SCPs apply to entire accounts; IAM policies apply to individual identities within accounts.

### Q6: What is consolidated billing and what are its advantages?

**Answer:** Consolidated billing aggregates all member accounts' AWS charges into a single monthly bill from the management account. Advantages: (1) One invoice for all accounts simplifying finance processes; (2) Volume discounts — combined usage across accounts may reach higher usage tiers with lower per-unit pricing; (3) Reserved Instance and Savings Plans sharing — unused reservations in one account benefit other accounts in the organization; (4) Centralized cost visibility while still maintaining per-account breakdowns in Cost Explorer.

### Q7: What is an Organizational Unit (OU)?

**Answer:** An OU is a logical container for AWS accounts within an organization. OUs form a hierarchy (tree structure) rooted at the organization root. Accounts can be placed in OUs, and SCPs can be applied at the OU level and are inherited by all accounts within (and nested OUs below). Common OUs include Production, Development, Security, Sandbox. An account can only be in one OU at a time.

### Q8: What is the FullAWSAccess SCP?

**Answer:** `FullAWSAccess` is the default SCP created when Organizations is enabled. It allows all actions on all resources (`Action: "*", Resource: "*"`). It is attached to the root and all OUs by default, meaning SCPs don't restrict anything until you explicitly add restrictive policies. Organizations uses an allowlist model — if you remove `FullAWSAccess` from an OU and don't replace it with another Allow SCP, all actions in those accounts are denied.

### Q9: What is the benefit of having a dedicated Log Archive account in Organizations?

**Answer:** A dedicated Log Archive account centralizes all CloudTrail logs, Config snapshots, VPC Flow Logs, and other audit logs from all accounts in the organization. Security: the account has very restricted access (only the Security team can read logs, and write access is controlled). Tamper-resistance: developers in application accounts cannot delete their own audit logs even if compromised. Compliance: regulators can be given read access to one account instead of every application account.

### Q10: Can a member account leave the AWS Organization?

**Answer:** Yes, a member account can leave the organization, but it requires a valid payment method set up in the member account (since it can no longer use consolidated billing). You can also prevent this with an SCP: deny the `organizations:LeaveOrganization` action. When an account leaves, SCPs no longer apply, and the account is billed independently.
