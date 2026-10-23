# IAM: Identity and Access Management — Complete Guide

## Table of Contents

1. [What is IAM?](#what-is-iam)
2. [Authentication vs Authorization](#authentication-vs-authorization)
3. [IAM is a Global Service](#iam-is-a-global-service)
4. [IAM Users](#iam-users)
5. [IAM Groups](#iam-groups)
6. [IAM Roles](#iam-roles)
7. [IAM Policies](#iam-policies)
8. [Policy Evaluation Logic](#policy-evaluation-logic)
9. [Principle of Least Privilege](#principle-of-least-privilege)
10. [MFA (Multi-Factor Authentication)](#mfa-multi-factor-authentication)
11. [IAM Password Policy](#iam-password-policy)
12. [IAM Best Practices](#iam-best-practices)
13. [Hands-On Practice Scenarios](#hands-on-practice-scenarios)
14. [Common Policy Examples](#common-policy-examples)
15. [Interview Q&A (20+ Questions)](#interview-qa)

---

## What is IAM?

AWS Identity and Access Management (IAM) is the service that controls **who** (authentication) can do **what** (authorization) on **which** AWS resources.

Without IAM, anyone who knows your account ID could access everything. IAM is the gatekeeper that:
- Defines identities (users, groups, roles, service accounts)
- Defines permissions (what actions are allowed on which resources)
- Enforces those permissions on every API call made to AWS

Every single request to AWS — whether from the Console, CLI, SDK, or another AWS service — goes through IAM for evaluation.

```
User clicks "Launch Instance" in EC2 Console
    |
    v
AWS receives the API call: ec2:RunInstances
    |
    v
IAM evaluates: Does this identity have permission for ec2:RunInstances?
    |
    YES --> Request proceeds, EC2 instance is launched
    NO  --> AccessDenied error returned
```

### IAM Key Components

```
IAM
├── Identities (the "who")
│   ├── Users         (individual people or applications)
│   ├── Groups        (collections of users)
│   └── Roles         (temporary identities for AWS services, external users)
│
└── Permissions (the "what")
    └── Policies      (JSON documents defining allow/deny rules)
        ├── Managed Policies (AWS or customer-created, reusable)
        └── Inline Policies  (embedded directly in a user/group/role)
```

---

## Authentication vs Authorization

These two words are often confused. In IAM they represent distinct concepts:

| Concept | Question | IAM Mechanism |
|---------|----------|---------------|
| **Authentication** | "Who are you?" | Username/password, access keys, MFA, assumed role credentials |
| **Authorization** | "Are you allowed to do this?" | IAM policies attached to the identity |

Example:
- You log in with your username and password = **Authentication** (IAM knows you are "alice")
- You click "Terminate Instance" = IAM checks if alice has `ec2:TerminateInstances` permission = **Authorization**

---

## IAM is a Global Service

IAM is one of the few AWS services that is **not Region-specific**. This means:
- IAM users, groups, roles, and policies you create are available across ALL Regions
- There is no concept of "us-east-1 IAM" vs "ap-southeast-2 IAM" — there is only ONE IAM per account
- In the AWS Console, when you navigate to IAM, the Region selector shows "Global"
- IAM policies apply to resources in any Region

This is different from resources like EC2 instances (which are Regional) or S3 buckets (which are globally named but data lives in a specific Region).

---

## IAM Users

### What is an IAM User?

An IAM user is a **permanent identity** that represents either:
1. A **human** (a developer, admin, read-only auditor)
2. An **application** (a legacy app that can't use roles)

Key characteristics:
- Has a persistent identity (doesn't expire)
- Can have two types of credentials: Console password and/or Access Keys
- Permissions come from policies attached to the user directly or via group membership

### When to Create an IAM User

Create an IAM user when:
- A human needs to access the Console
- A legacy application cannot use IAM roles (e.g., runs on-premises)
- You need long-term credentials for a specific purpose

Do NOT create an IAM user when:
- Code running on EC2 needs AWS access → use EC2 Instance Role
- A Lambda function needs AWS access → use Lambda Execution Role
- A service needs to access your account from another account → use Cross-Account Role
- Human federated access via SSO/Active Directory → use IAM Identity Center + Role

### Console Access vs Programmatic Access

An IAM user can have either or both types of access:

**Console access (username + password):**
- Used to log in to the AWS Management Console at https://console.aws.amazon.com
- Optional: MFA device can be required
- Password can be set to expire after N days

**Programmatic access (access key + secret access key):**
- Used with AWS CLI, SDK, API calls
- The Access Key ID (starts with "AKIA...") identifies who you are
- The Secret Access Key proves you are that person (like a password — never share it)
- A user can have maximum **2** active access keys (allows rotation: create new, update code, delete old)

### Access Keys

```
Access Key ID:     AKIAIOSFODNN7EXAMPLE
                   ^^^^
                   Always starts with AKIA (long-term key)
                   or ASIA (temporary STS key)

Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
                   - 40 characters
                   - Shown ONLY ONCE at creation
                   - If lost, you must deactivate and create a new one
                   - NEVER commit to git, share via email, or hardcode
```

**Access Key Best Practices:**
- Rotate access keys every 90 days
- Deactivate (don't immediately delete) the old key when rotating — reverting is then possible
- Use IAM roles instead of access keys wherever possible
- If you accidentally expose an access key: deactivate immediately, then investigate

### When NOT to Use IAM Users

IAM users and access keys are static, long-lived credentials. They are a security risk because:
- They don't automatically expire
- If stolen, they work until you notice and deactivate them
- They require manual rotation

Prefer **IAM roles** (which issue temporary credentials) in these situations:

| Scenario | Use Instead of User |
|----------|---------------------|
| EC2 instance needs S3 access | EC2 Instance Role |
| Lambda function needs DynamoDB access | Lambda Execution Role |
| ECS task needs Secrets Manager access | ECS Task Role |
| CodeBuild pipeline needs to push to ECR | CodeBuild Service Role |
| Cross-account access | Cross-Account IAM Role |
| Developers use SSO/Active Directory | IAM Identity Center |

---

## IAM Groups

### What is a Group?

An IAM group is a **collection of IAM users**. Attaching a policy to a group means all users in that group automatically inherit those permissions.

### Why Use Groups?

Without groups, managing permissions for 50 developers would mean:
- Attaching the same policy to 50 individual users
- When the policy needs updating, editing 50 policies
- Risk of inconsistency

With groups:
- Attach the policy ONCE to the group
- All 50 users inherit it
- When a new developer joins: add them to the group
- When a developer changes teams: remove from one group, add to another
- When a developer leaves: delete the user — all group memberships are gone

### Key Group Rules

1. **A user can belong to multiple groups** — a user is in "Developers" AND "OnCall" simultaneously
2. **Groups cannot be nested** — a group cannot contain another group
3. **Groups are not IAM identities** — you cannot log in as a group, and you cannot reference a group in a resource-based policy
4. **No default group** — users have no permissions at all if not added to a group (and no direct policies)

### Practical Group Examples

```
Common Group Setup for a Tech Company:

Group: Administrators
    Policy: AdministratorAccess (AWS Managed)
    Members: alice, bob

Group: Developers
    Policy: PowerUserAccess (AWS Managed) - all services except IAM
    Members: charlie, dave, eve

Group: DevOps
    Policy: Custom DevOps policy (EC2, ECS, ECR, ELB, CloudWatch, etc.)
    Members: frank, grace

Group: DataEngineers
    Policy: Custom data policy (S3, Glue, Athena, Redshift)
    Members: harry, iris

Group: ReadOnly
    Policy: ReadOnlyAccess (AWS Managed)
    Members: auditors, stakeholders

Group: Billing
    Policy: Billing (AWS Managed)
    Members: finance-team
```

### Group Membership Example

```
User: "alice"
    Group member of: Administrators, OnCall

    Effective permissions = UNION of:
        - Policies on alice directly (if any)
        - Policies attached to Administrators group
        - Policies attached to OnCall group
```

---

## IAM Roles

### What is an IAM Role?

An IAM Role is an IAM identity that can be **assumed** by anyone or anything that is trusted to do so. Instead of being tied to a specific person (like a user), a role is a set of permissions that can be temporarily worn.

When an entity assumes a role, it receives **temporary security credentials** (valid for 15 minutes to 12 hours) from the AWS Security Token Service (STS).

### Roles vs Users: The Key Difference

| Feature | IAM User | IAM Role |
|---------|----------|----------|
| Identity type | Permanent | Temporary (assumed) |
| Credentials | Long-lived (access keys or password) | Temporary (STS tokens, expire) |
| Who uses it | Specific person or app | Any trusted entity (service, user, account) |
| Belongs to | Specific account | Specific account (but assumable cross-account) |
| Access keys | Must create manually | Auto-generated on assumption |
| Preferred for | Legacy apps, humans without SSO | EC2, Lambda, cross-account, federation |

### What Happens When a Role is Assumed

```
1. An entity (EC2 instance, Lambda, user) calls STS:AssumeRole
2. IAM evaluates the trust policy: Is this entity allowed to assume this role?
   YES: Proceed
   NO: AccessDenied
3. STS returns:
   - Temporary Access Key ID (starts with "ASIA...")
   - Temporary Secret Access Key
   - Session Token (required for temporary credentials)
   - Expiration timestamp (default 1 hour, max 12 hours)
4. The entity uses these credentials to make API calls
5. When credentials expire, the entity must assume the role again
```

### Use Cases for Roles

#### 1. EC2 Instance Role (Most Common)

An EC2 instance needs to read from S3 and write to DynamoDB:

```
Without role:
    Developer manually creates access keys
    Keys copied to EC2 instance (INSECURE — keys on disk, rotated manually)

With role:
    Create role "EC2-AppRole" with S3 read + DynamoDB write permissions
    Attach role to EC2 at launch
    Application code uses boto3/SDK without any credentials
    SDK automatically fetches temp creds from http://169.254.169.254/latest/meta-data/iam/
    Creds auto-rotate before expiry (SDK handles this transparently)
```

#### 2. Lambda Execution Role

Every Lambda function must have an execution role. This role defines what the Lambda function is allowed to do:
- Access DynamoDB
- Write to S3
- Publish to SNS
- Assume other roles

#### 3. Cross-Account Role

Company A wants to give Company B's account access to read their S3 bucket:

```
Account A (the trusting account):
    Create role "CrossAccountReadRole"
    Trust policy: "I trust Account B (ID: 111111111111) to assume this role"
    Permission policy: S3 read on specific bucket

Account B (the trusted account):
    User in Account B calls sts:AssumeRole with the ARN of CrossAccountReadRole
    Gets temporary credentials for Account A
    Can now read the S3 bucket in Account A
```

#### 4. Service-Linked Roles

AWS services sometimes create these automatically:
- `AWSServiceRoleForElasticLoadBalancing` — ELB uses this to manage EC2 instances
- `AWSServiceRoleForRDS` — RDS uses this for various management tasks
- Cannot be manually deleted while the service is using them

#### 5. Identity Federation / SAML Role

When using external identity providers (Active Directory, Okta, Google Workspace):
- Users authenticate to their IdP (corporate login)
- IdP issues a SAML assertion
- AWS STS exchanges the assertion for temporary role credentials
- Users access AWS without having IAM users

### Trust Policy vs Permission Policy

Every role has TWO policies:

**Trust Policy (who CAN assume this role):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```
This says: "The EC2 service is allowed to assume this role."

**Permission Policy (what this role CAN DO once assumed):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ]
    }
  ]
}
```
This says: "The entity that assumed this role can read from my-app-bucket."

### Instance Profiles

When you attach an IAM Role to an EC2 instance, AWS actually creates a container called an **Instance Profile** that wraps the role. The instance profile is what gets attached to EC2.

- If you create a role for EC2 via the Console, the instance profile is created automatically with the same name
- If you create a role via the CLI/CloudFormation, you must explicitly create an instance profile
- You cannot attach a role directly to EC2 — only an instance profile can be attached

```bash
# CLI: Create a role, then an instance profile, then add role to profile
aws iam create-role --role-name MyEC2Role --assume-role-policy-document file://trust.json
aws iam create-instance-profile --instance-profile-name MyEC2Profile
aws iam add-role-to-instance-profile --instance-profile-name MyEC2Profile --role-name MyEC2Role
aws ec2 associate-iam-instance-profile --instance-id i-1234 --iam-instance-profile Name=MyEC2Profile
```

---

## IAM Policies

### What is a Policy?

An IAM policy is a **JSON document** that defines permissions. It answers three questions:
- What **effect** (Allow or Deny)?
- What **actions** (API calls) does this apply to?
- On what **resources**?
- Under what **conditions** (optional)?

Policies must be attached to identities (user, group, or role) to take effect. A policy by itself does nothing.

### Policy Structure: Every Field Explained

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnMyBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-company-bucket",
        "arn:aws:s3:::my-company-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:prefix": ["uploads/", "reports/"]
        }
      }
    }
  ]
}
```

**Field-by-field breakdown:**

| Field | Required | Description | Values |
|-------|----------|-------------|--------|
| `Version` | Yes | Policy language version. Always use `2012-10-17` | `2012-10-17` (use this) or `2008-10-17` (old) |
| `Statement` | Yes | Array of one or more permission statements | Array of objects |
| `Sid` | No | Statement ID — a human-readable label for the statement | Any string, no spaces |
| `Effect` | Yes | Whether to Allow or Deny the actions | `"Allow"` or `"Deny"` |
| `Action` | Yes | The API actions this statement applies to | `"s3:GetObject"` or `["s3:GetObject", "s3:ListBucket"]` or `"s3:*"` |
| `Resource` | Yes | The AWS resources this statement applies to | ARN string or `"*"` |
| `Condition` | No | Extra conditions that must be true for the statement to apply | Object with condition operators |

**About the Version field:**
The `2012-10-17` version supports policy variables (like `${aws:username}`). The old `2008-10-17` does not. Always use `2012-10-17`.

**About Actions:**
- Format: `service:ActionName` → `s3:GetObject`, `ec2:RunInstances`, `iam:CreateUser`
- Wildcards: `s3:*` means all S3 actions, `ec2:Describe*` means all EC2 Describe actions
- Multiple actions: use an array `["s3:GetObject", "s3:PutObject"]`

**About Resources:**
- ARN format: `arn:partition:service:region:account-id:resource`
- Examples:
  - `arn:aws:s3:::my-bucket` — the bucket itself
  - `arn:aws:s3:::my-bucket/*` — all objects inside the bucket
  - `arn:aws:ec2:us-east-1:123456789012:instance/*` — all EC2 instances in us-east-1
  - `*` — all resources (use sparingly)

**About Conditions:**
```json
"Condition": {
    "StringEquals": {
        "aws:RequestedRegion": "ap-southeast-2"
    }
}
```
Common condition operators:

| Operator | Meaning | Example |
|----------|---------|---------|
| `StringEquals` | String exactly equals | Region must be ap-southeast-2 |
| `StringLike` | String matches pattern with wildcards | Resource path starts with "uploads/" |
| `IpAddress` | IP is in CIDR range | Only allow from office IP |
| `Bool` | Boolean comparison | MFA must be true |
| `DateLessThan` | Date comparison | Only allow before a certain date |
| `ArnLike` | ARN matches pattern | Only from a specific role ARN |
| `Null` | Condition key is absent | MFA not present = deny |

### Complete Policy Example with Full Explanation

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowEC2Describe",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeImages",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowEC2LaunchInDevOnly",
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:StartInstances",
        "ec2:StopInstances"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:ResourceTag/Environment": "dev"
        }
      }
    },
    {
      "Sid": "DenyLargeInstances",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringNotEquals": {
          "ec2:InstanceType": [
            "t2.micro",
            "t3.micro",
            "t3.small"
          ]
        }
      }
    },
    {
      "Sid": "AllowS3ReadOnCompanyBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::company-assets",
        "arn:aws:s3:::company-assets/*"
      ]
    },
    {
      "Sid": "AllowS3WriteToUserOwnFolder",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::company-assets/users/${aws:username}/*"
    }
  ]
}
```

What this policy does, statement by statement:
1. `AllowEC2Describe`: Can describe/list EC2 resources (read-only metadata) in any Region
2. `AllowEC2LaunchInDevOnly`: Can launch/start/stop EC2 instances ONLY if they are tagged `Environment=dev`
3. `DenyLargeInstances`: Explicitly denies running instances larger than t3.small — this DENY overrides any Allow, preventing cost explosions
4. `AllowS3ReadOnCompanyBucket`: Can read objects from the company-assets S3 bucket
5. `AllowS3WriteToUserOwnFolder`: Can write to their OWN folder inside the bucket (note the `${aws:username}` policy variable)

### AWS Managed Policies vs Customer Managed Policies vs Inline Policies

#### 1. AWS Managed Policies

Pre-built policies created and maintained by AWS.

Examples:
- `AdministratorAccess` — full access to everything
- `ReadOnlyAccess` — read access to all services
- `PowerUserAccess` — full access except IAM and Organizations
- `AmazonS3FullAccess` — full S3 access
- `AmazonEC2ReadOnlyAccess` — read-only EC2 access
- `AWSLambdaBasicExecutionRole` — Lambda write CloudWatch Logs

#### 2. Customer Managed Policies

Policies you create and manage in your account.

Create when:
- No AWS Managed Policy does exactly what you need
- You need custom conditions (restrict to specific Resources, Regions, etc.)
- You need to version-control your own policies
- You want to apply the same policy to many roles/users

#### 3. Inline Policies

Policies embedded directly inside a user, group, or role. They cannot be shared.

Use inline policies when:
- You want to ensure the policy is permanently bound to a specific identity
- You want to prevent the policy from being accidentally attached elsewhere

#### Comparison Table

| Feature | AWS Managed | Customer Managed | Inline |
|---------|-------------|-----------------|--------|
| Created by | AWS | You | You |
| Can be shared across users/roles | Yes | Yes | No (1:1 with the identity) |
| Versioning | AWS manages | You manage (up to 5 versions) | No versions |
| Appears in IAM policies list | Yes | Yes | No (only visible on the identity) |
| Deleted when identity is deleted | No | No | Yes (always) |
| Best for | Common/generic permissions | Custom reusable permissions | Identity-specific, inseparable |

---

## Policy Evaluation Logic

This is one of the most important concepts in IAM. When a request comes in, IAM evaluates all applicable policies in this order:

### The Three Outcomes

1. **Explicit Deny**: A Deny statement explicitly matches the request → **DENIED, full stop**
2. **Explicit Allow**: An Allow statement matches and no Deny exists → **ALLOWED**
3. **Implicit Deny**: No Allow statement matches the request → **DENIED** (default)

### Evaluation Priority

```
EVALUATION ORDER (for identity-based policies):

1. START: Is there an explicit DENY anywhere?
   YES --> DENY immediately (no further evaluation)
   NO  --> continue

2. Is there an explicit ALLOW?
   YES --> ALLOW the request
   NO  --> continue

3. No explicit allow was found: IMPLICIT DENY
   --> DENY (the default)
```

### Full Evaluation Order (Including All Policy Types)

When AWS evaluates a request, it checks policies in this priority order:

```
1. Service Control Policies (SCPs) — from AWS Organizations
   If SCP explicitly denies --> DENY (even admins can't override)
   If SCP doesn't allow --> DENY

2. Resource-based policies (e.g., S3 bucket policy, KMS key policy)
   Evaluated alongside identity-based policies

3. Permissions boundaries (optional ceiling on permissions)
   If set, permissions cannot exceed the boundary

4. Session policies (for assumed roles with additional restrictions)

5. Identity-based policies (on the user/group/role itself)

FINAL RULE:
    - Any explicit DENY at any level = DENY
    - Explicit ALLOW at identity level, allowed by SCP, allowed by resource policy = ALLOW
    - No explicit ALLOW at any level = IMPLICIT DENY
```

### Worked Example

Alice has these policies:
- Attached to Alice directly: `{ "Effect": "Allow", "Action": "s3:*", "Resource": "*" }`
- Alice is in group "Developers" which has: `{ "Effect": "Deny", "Action": "s3:DeleteObject", "Resource": "*" }`

Question: Can Alice delete S3 objects?

**Answer: NO.**
- The group has an explicit Deny for `s3:DeleteObject`
- The explicit Deny overrides the explicit Allow on Alice's direct policy
- Explicit Deny ALWAYS wins, regardless of where the Allow comes from

---

## Principle of Least Privilege

### Definition

Grant only the minimum permissions required to perform a specific job function — nothing more, nothing less.

### Why It Matters

- **Limits blast radius**: If an IAM user or role is compromised, the attacker can only do what that identity was allowed to do
- **Reduces accidental damage**: A developer who accidentally runs a script cannot delete production databases if they lack permission
- **Compliance**: Regulations like SOC 2, ISO 27001, and PCI-DSS require least privilege

### How to Implement It

1. **Start with no permissions**: Create the user/role with no policies attached
2. **Grant incrementally**: Add only the permissions needed for the current task
3. **Use specific actions**: Instead of `s3:*`, use `s3:GetObject` if reading is all that's needed
4. **Restrict resources**: Instead of `Resource: "*"`, use specific ARNs
5. **Add conditions**: Restrict by IP, by Region, by requiring MFA
6. **Review regularly**: Use IAM Access Analyzer to find unused permissions

### Tools to Help

- **IAM Access Analyzer**: Identifies policies granting access to external principals or internet
- **IAM Credential Report**: Lists all IAM users and when their credentials were last used
- **AWS Config**: Detects IAM policy changes and alerts on over-permissive policies
- **AWS CloudTrail**: Logs every API call — review to see what permissions are actually being used
- **IAM Last Accessed Data**: Shows when each service was last accessed by a user/role — remove services not accessed in 90+ days

```bash
# Generate a credential report
aws iam generate-credential-report
aws iam get-credential-report --output text --query Content | base64 -d

# Get last accessed data for a role
aws iam get-service-last-accessed-details \
    --job-id $(aws iam generate-service-last-accessed-details \
        --arn arn:aws:iam::123456789012:role/MyRole \
        --query JobId --output text)
```

---

## MFA (Multi-Factor Authentication)

### What is MFA?

MFA adds a second factor beyond username/password to authenticate. Even if a password is stolen, the attacker cannot log in without the second factor.

### Types of MFA in AWS

#### Virtual MFA (Software TOTP)

A time-based one-time password generated by an app on your phone:
- Google Authenticator
- Authy
- Microsoft Authenticator
- 1Password (can store TOTP secrets)

How it works:
1. A secret seed is shared between AWS and your authenticator app (via QR code)
2. The app generates a new 6-digit code every 30 seconds based on the seed + current time
3. When you log in, you enter your password AND the current 6-digit code
4. AWS validates the code against the same calculation

#### Hardware MFA (Physical Token)

Physical devices that generate TOTP codes:
- YubiKey (USB-based, supports FIDO2 and TOTP)
- Gemalto hardware token
- Thales Group tokens

More secure than virtual MFA because the seed never exists in software.

#### FIDO Security Keys (U2F / WebAuthn)

USB or NFC hardware keys (YubiKey, Google Titan Key):
- Passwordless or second factor
- Phishing-resistant (key is bound to the specific domain)
- Supports the FIDO2/WebAuthn standard

### Enabling MFA on Root User

1. Log in as root
2. Click your account name (top right) --> "Security credentials"
3. Click "Assign MFA device"
4. Choose "Authenticator app" (virtual MFA)
5. Open Google Authenticator on your phone
6. Scan the QR code shown on screen
7. Enter two consecutive 6-digit codes (MFA code 1, then wait 30s, enter MFA code 2)
8. MFA is now enabled

### Enabling MFA on IAM User

1. IAM Console --> Users --> click the user's name
2. "Security credentials" tab
3. "Assigned MFA device" --> click "Manage"
4. Choose device type and follow prompts

### Requiring MFA via Policy Condition

You can write policies that only work if MFA is active:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyWithoutMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken"
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

This policy denies ALL actions (except the ones needed to set up MFA) unless the user authenticated with MFA.

---

## IAM Password Policy

IAM allows you to enforce a password policy for all IAM users in the account. The password policy applies to Console passwords (not access keys).

### Configuring Password Policy

IAM Console --> Account Settings --> Edit password policy

Settings available:

| Setting | Description | Recommended Value |
|---------|-------------|------------------|
| Minimum password length | Min characters | 14+ |
| Require uppercase letters | Must have A-Z | Yes |
| Require lowercase letters | Must have a-z | Yes |
| Require numbers | Must have 0-9 | Yes |
| Require non-alphanumeric | Must have !@#$%^& | Yes |
| Password expiration | Days until expiry | 90 days |
| Password expiration requires admin reset | User is locked until admin resets | No (let user reset) |
| Prevent password reuse | Number of previous passwords cannot reuse | 24 |
| Allow users to change password | Users can change their own | Yes |

### CLI to set password policy:

```bash
aws iam update-account-password-policy \
    --minimum-password-length 14 \
    --require-uppercase-characters \
    --require-lowercase-characters \
    --require-numbers \
    --require-symbols \
    --max-password-age 90 \
    --password-reuse-prevention 24 \
    --allow-users-to-change-password
```

---

## IAM Best Practices

AWS's official IAM best practices (essential for interviews and exams):

1. **Lock away the root user** — Enable MFA, do not create access keys, don't use for daily tasks
2. **Create individual IAM users** — Don't share credentials, one identity per person
3. **Use groups to assign permissions** — Manage permissions at the group level, not per user
4. **Grant least privilege** — Start with minimum permissions, add as needed
5. **Enable MFA** — For privileged users (admins) at minimum, ideally for all users
6. **Use roles for applications on EC2** — Never put access keys on EC2 instances
7. **Use roles for cross-account access** — Share via role assumption, not by sharing users
8. **Rotate credentials regularly** — Rotate access keys every 90 days; enforce password rotation
9. **Remove unnecessary credentials** — Delete access keys and users you no longer need
10. **Use IAM Access Analyzer** — Review policies regularly for over-permissiveness
11. **Monitor account activity** — Enable CloudTrail; set up CloudWatch alarms for suspicious activity
12. **Enable strong password policy** — Enforce length, complexity, rotation, and reuse prevention
13. **Use conditions in policies** — Add MFA conditions, IP restrictions, time restrictions
14. **Prefer AWS Managed Policies** for common cases — well-tested, auto-updated by AWS
15. **Never share access keys** — Each person or service gets their own credentials
16. **Tag IAM resources** — Tag users, roles, and policies for governance and cost attribution

---

## Hands-On Practice Scenarios

### Scenario 1: Create a Developer User with S3 Read and EC2 Launch Permissions

```bash
# Step 1: Create the user
aws iam create-user --user-name developer-alice

# Step 2: Create a custom policy
cat > developer-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Read",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::company-assets",
        "arn:aws:s3:::company-assets/*"
      ]
    },
    {
      "Sid": "AllowEC2BasicLaunch",
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeImages",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs",
        "ec2:CreateTags"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:InstanceType": ["t2.micro", "t3.micro", "t3.small"]
        }
      }
    }
  ]
}
EOF

# Step 3: Create and attach the policy
POLICY_ARN=$(aws iam create-policy \
    --policy-name DeveloperPolicy \
    --policy-document file://developer-policy.json \
    --query 'Policy.Arn' \
    --output text)

aws iam attach-user-policy \
    --user-name developer-alice \
    --policy-arn $POLICY_ARN

# Step 4: Create console access password
aws iam create-login-profile \
    --user-name developer-alice \
    --password 'TempPass@123' \
    --password-reset-required

# Step 5: Create access keys for CLI
aws iam create-access-key --user-name developer-alice
```

### Scenario 2: Create a Read-Only User

```bash
# Create user
aws iam create-user --user-name readonly-bob

# Attach AWS Managed ReadOnlyAccess policy
aws iam attach-user-policy \
    --user-name readonly-bob \
    --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Create console password
aws iam create-login-profile \
    --user-name readonly-bob \
    --password 'TempPass@456' \
    --password-reset-required
```

### Scenario 3: Create a Role for EC2 to Access S3

```bash
# Step 1: Create the trust policy (who can assume this role)
cat > ec2-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Step 2: Create the role with the trust policy
aws iam create-role \
    --role-name EC2-S3AccessRole \
    --assume-role-policy-document file://ec2-trust-policy.json

# Step 3: Create the permission policy
cat > s3-access-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ]
    }
  ]
}
EOF

POLICY_ARN=$(aws iam create-policy \
    --policy-name EC2-S3AccessPolicy \
    --policy-document file://s3-access-policy.json \
    --query 'Policy.Arn' --output text)

# Step 4: Attach the permission policy to the role
aws iam attach-role-policy \
    --role-name EC2-S3AccessRole \
    --policy-arn $POLICY_ARN

# Step 5: Create instance profile and add role to it
aws iam create-instance-profile \
    --instance-profile-name EC2-S3AccessProfile

aws iam add-role-to-instance-profile \
    --instance-profile-name EC2-S3AccessProfile \
    --role-name EC2-S3AccessRole

# Step 6: Launch EC2 and attach the profile
aws ec2 run-instances \
    --image-id ami-0abcdef1234567890 \
    --instance-type t2.micro \
    --iam-instance-profile Name=EC2-S3AccessProfile
```

---

## Common Policy Examples

### Policy 1: S3 Full Access to Specific Bucket

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-specific-bucket",
        "arn:aws:s3:::my-specific-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListAllMyBuckets",
      "Resource": "*"
    }
  ]
}
```

### Policy 2: EC2 Read Only

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ec2:Get*",
        "ec2:List*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Policy 3: Custom Policy with IP Condition (Office Access Only)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": [
            "203.0.113.0/24",
            "198.51.100.50/32"
          ]
        }
      }
    }
  ]
}
```

### Policy 4: Allow Only If MFA Is Active

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "aws:MultiFactorAuthPresent": "true"
        }
      }
    }
  ]
}
```

### Policy 5: Lambda Execution Role Policy (CloudWatch Logs + DynamoDB)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:123456789012:table/MyTable"
    }
  ]
}
```

---

## Interview Q&A

### Q1: What is IAM and why is it important?

**Answer:** IAM (Identity and Access Management) is the AWS service that controls authentication (who you are) and authorization (what you're allowed to do) for all AWS API calls. It is critical because every action in AWS goes through IAM evaluation. Without IAM, there would be no way to restrict access, and any user could do anything in the account. IAM enables the principle of least privilege, auditing, and secure cross-service communication.

### Q2: What is the difference between an IAM User, Group, and Role?

**Answer:**
- **User**: A permanent identity for a specific person or application. Has credentials (password, access keys) that persist until manually changed.
- **Group**: A collection of users. Policies attached to a group are inherited by all users in it. Groups cannot be nested and cannot be used as principals in policies.
- **Role**: A temporary identity that can be assumed by AWS services, other accounts, or users. Issues short-lived credentials via STS. Preferred over users for AWS service-to-service communication.

### Q3: What is the difference between a Trust Policy and a Permission Policy on a role?

**Answer:**
- **Trust Policy**: Defines WHO can assume this role (the principal). Could be an AWS service (ec2.amazonaws.com), an IAM user, another AWS account, or a federated identity provider.
- **Permission Policy**: Defines WHAT the role can do once assumed — the actual AWS actions and resources.

Both must be correct for a role assumption to succeed: the trust policy must allow the entity to assume the role, and the permission policy must allow the specific action being requested.

### Q4: Explain IAM policy evaluation logic.

**Answer:** IAM evaluates policies in this order:
1. If there is an explicit **Deny** anywhere (in any policy type), the request is **DENIED immediately**.
2. If there is an explicit **Allow** and no explicit Deny, the request is **ALLOWED**.
3. If there is neither (no applicable Allow), the request is **implicitly DENIED** (the default).

"Explicit Deny always wins" — even if a user has AdministratorAccess, an explicit Deny in any policy (SCP, boundary, identity policy) will override it.

### Q5: What are the three types of IAM policies and when would you use each?

**Answer:**
- **AWS Managed Policies**: Pre-built by AWS, cover common use cases (AdministratorAccess, ReadOnlyAccess, service-specific policies). Use for standard roles. Maintained and updated by AWS.
- **Customer Managed Policies**: Created and managed by you. Use when you need custom permissions not covered by AWS managed policies, or when you want to reuse a policy across multiple roles/users.
- **Inline Policies**: Embedded directly into a single user, group, or role. Use when you want to ensure the policy cannot be detached and reused elsewhere — creating a strict 1:1 binding.

### Q6: What is an Instance Profile and how does it relate to an IAM Role?

**Answer:** An Instance Profile is a container for an IAM Role that allows it to be attached to an EC2 instance. When you create a role for EC2 via the Console, AWS automatically creates an Instance Profile with the same name. If you use the CLI or CloudFormation, you must explicitly create the Instance Profile and add the role to it. EC2 does not accept a role directly — only an Instance Profile.

### Q7: What is STS and what are temporary credentials?

**Answer:** AWS Security Token Service (STS) is the service that issues temporary security credentials. When an entity assumes an IAM role, STS returns:
- A temporary Access Key ID (starts with "ASIA...")
- A temporary Secret Access Key
- A Session Token (required for API calls)
- An expiration time (15 minutes to 12 hours)

Temporary credentials are more secure than long-term access keys because they auto-expire. They are used by EC2 instance roles, Lambda execution roles, cross-account access, identity federation, and anywhere STS:AssumeRole is called.

### Q8: What is the Principle of Least Privilege?

**Answer:** Grant only the minimum permissions required to perform a specific task — nothing more. This minimizes the blast radius if credentials are compromised and reduces the risk of accidental changes. Implementation: start with no permissions, add specifically required actions and specific resource ARNs (not `*`), add conditions where possible (MFA, IP, Region), and regularly review using IAM Last Accessed data to remove unused permissions.

### Q9: How do you enforce MFA for IAM users?

**Answer:** You cannot force MFA device setup at the policy level, but you can write an IAM policy that denies all actions (except those needed to set up MFA) unless `aws:MultiFactorAuthPresent` is `true` in the condition. This effectively forces users to set up MFA before they can do anything useful. Alternatively, use IAM Identity Center (SSO) where you can enforce MFA centrally at the identity provider level.

### Q10: Can a user belong to multiple IAM groups?

**Answer:** Yes. A user can belong to multiple groups simultaneously. Their effective permissions are the union of all policies attached to the user directly and via all groups they belong to, minus any explicit Denies from any of those policies.

### Q11: Can groups be nested in IAM?

**Answer:** No. IAM groups cannot contain other groups. You cannot have a "Senior Developers" group inside a "Developers" group. Groups only contain users.

### Q12: What is a Permissions Boundary?

**Answer:** A Permissions Boundary is an advanced IAM feature that sets the maximum permissions an IAM entity (user or role) can have. Even if an identity has policies granting broad permissions, the effective permissions cannot exceed what the boundary allows. This is useful for delegating IAM administration to developers — they can create roles, but only within the constraints of the boundary set by central security. The effective permissions are the intersection of the identity's policies and the boundary.

### Q13: What is the ARN format for IAM resources?

**Answer:**
- IAM User: `arn:aws:iam::123456789012:user/alice`
- IAM Group: `arn:aws:iam::123456789012:group/Developers`
- IAM Role: `arn:aws:iam::123456789012:role/EC2-S3AccessRole`
- IAM Policy: `arn:aws:iam::123456789012:policy/DeveloperPolicy`
- AWS Managed Policy: `arn:aws:iam::aws:policy/ReadOnlyAccess` (account ID is `aws`)

Note: IAM ARNs have no Region component (empty string between `iam:` and `:account-id`) because IAM is a global service.

### Q14: What is IAM Access Analyzer?

**Answer:** IAM Access Analyzer is a service that analyzes resource-based policies to identify resources shared outside your account or organization. It creates findings when:
- An S3 bucket policy allows public or cross-account access
- A KMS key policy grants external access
- An IAM role has a trust policy allowing external principals
- An SQS queue or SNS topic is publicly accessible

It helps you identify unintended access before it becomes a security incident. It can also validate and generate IAM policies.

### Q15: How would you audit which permissions an IAM user actually uses?

**Answer:**
1. **IAM Last Accessed Data**: In the Console, open a user/role and click "Last accessed" — shows the last time each service was accessed
2. **IAM Credential Report**: Download via `aws iam generate-credential-report` — shows all users, when passwords/keys were last used, MFA status
3. **AWS CloudTrail**: Query CloudTrail logs to see every API call made by the user
4. **AWS Config**: Review configuration history and detect overly permissive policies
5. **IAM Access Analyzer Policy Generation**: Observes CloudTrail for a period and generates a least-privilege policy based on actual usage

### Q16: What happens if you accidentally expose an IAM access key?

**Answer:** Act immediately:
1. **Deactivate the key** immediately: `aws iam update-access-key --access-key-id AKIA... --status Inactive`
2. **Do not delete immediately** — you may need the key ID for investigation
3. **Check CloudTrail** for unauthorized API calls made with the exposed key
4. **Check for rogue resources** — EC2 instances (especially for crypto mining), S3 buckets, IAM users created by the attacker
5. **Check billing** — unusual charges indicate active exploitation
6. **Create a new key** for the legitimate owner
7. **Delete the old key** after confirming the new one works
8. **Review and revoke** any resources created during the exposure window

### Q17: What is the difference between resource-based policies and identity-based policies?

**Answer:**
- **Identity-based policies**: Attached to IAM identities (users, groups, roles). Define what the identity can DO.
  Example: A policy on the "alice" user allowing `s3:GetObject`.
- **Resource-based policies**: Attached directly to AWS resources (S3 buckets, KMS keys, SQS queues, Lambda functions). Define WHO can access the resource.
  Example: An S3 bucket policy allowing a specific Lambda role to read objects.

When both exist, access is granted if EITHER the identity policy OR the resource policy allows it (and no explicit deny exists). Exception: for cross-account access, BOTH the identity policy and the resource policy must allow the action.

### Q18: What is IAM Identity Center (formerly AWS SSO)?

**Answer:** IAM Identity Center is the recommended way to manage human user access to AWS accounts at scale. Instead of creating IAM users in every account, you:
1. Connect to an identity source (Active Directory, Okta, Google Workspace, or built-in)
2. Define Permission Sets (collections of policies)
3. Assign users/groups to accounts with Permission Sets
4. Users log in via a central SSO portal and get temporary credentials for their assigned accounts

Benefits over individual IAM users: centralized user management, no permanent IAM users needed, MFA enforced at IdP level, automatic deprovisioning when users leave the company.

### Q19: Can a Lambda function call another AWS service without credentials in the code?

**Answer:** Yes. Every Lambda function is configured with an **execution role** — an IAM role that the function assumes automatically when it runs. The Lambda runtime provides the temporary credentials from that role to the SDK/CLI running inside the function. The AWS SDK automatically discovers and uses these credentials. You should never hardcode credentials in Lambda code. Instead, expand the execution role's permissions to include the services the Lambda function needs.

### Q20: What are Service-Linked Roles?

**Answer:** Service-linked roles are IAM roles created automatically by AWS services when you enable a service feature. They are:
- Pre-defined by the service with the exact permissions needed
- Named with the format `AWSServiceRoleFor<ServiceName>`
- Cannot be manually edited (the service manages them)
- Cannot be deleted while the service is using them

Examples: `AWSServiceRoleForElasticLoadBalancing`, `AWSServiceRoleForAmazonECS`, `AWSServiceRoleForRDS`. They implement least privilege for the service itself without you having to define what permissions the service needs.

### Q21: What is the difference between `aws:SourceIp` and `aws:VpcSourceIp` conditions?

**Answer:**
- `aws:SourceIp`: The originating IP address of the request. Used for internet-originating requests. Does NOT work as expected for VPC endpoints — use `aws:VpcSourceIp` for those.
- `aws:VpcSourceIp`: The source IP of the request when made through a VPC endpoint. Use this when restricting access via VPC endpoints.
- `aws:SourceVpc`: The VPC ID from which the request originates (via VPC endpoint).
- `aws:SourceVpce`: The specific VPC Endpoint ID from which the request originates.

Common pattern: S3 bucket policy that only allows access from your VPC:
```json
"Condition": {
    "StringEquals": {
        "aws:SourceVpc": "vpc-12345678"
    }
}
```

### Q22: What is an IAM Policy Variable?

**Answer:** Policy variables are placeholders replaced at evaluation time with values from the request context. They allow writing dynamic policies that adapt to the requester. Format: `${variable-name}`.

Common examples:
- `${aws:username}` — the IAM username of the requester
- `${aws:userid}` — the IAM user ID
- `${aws:PrincipalTag/TagKey}` — value of a tag on the principal

Example use case — each user can only access their own S3 folder:
```json
"Resource": "arn:aws:s3:::company-data/home/${aws:username}/*"
```
This allows alice to access `company-data/home/alice/*` and bob to access `company-data/home/bob/*` with a single policy.
