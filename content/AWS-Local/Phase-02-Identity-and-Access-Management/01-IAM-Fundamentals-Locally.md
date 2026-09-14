# IAM Fundamentals Locally — Complete Guide

> "A key ring holds different keys for your house, office, and filing cabinets; a security policy defines which of those doors you are actually permitted to open."

---

## Table of Contents

1. [The Problem: IAM Policy Blockers during Development](#1-the-problem-iam-policy-blockers-during-development)
2. [The Key Ring Analogy](#2-the-key-ring-analogy)
3. [The Mechanism: Policy Structure and Simulation Rules](#3-the-mechanism-policy-structure-and-simulation-rules)
4. [Diagram: Local vs. Live IAM Request Evaluation](#4-diagram-local-vs-live-iam-request-evaluation)
5. [Code Walkthrough: Local User Creation and STS Role Assumption](#5-code-walkthrough-local-user-creation-and-sts-role-assumption)
6. [Comparing Live IAM Enforcement to Local Simulation](#6-comparing-live-iam-enforcement-to-local-simulation)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: IAM Policy Blockers during Development

In public AWS, writing security policies is often a major source of friction. Developers spend hours writing JSON configurations, deploying them, receiving `AccessDenied` errors, tweaking permissions, and redeploying.

### The Access Denied Loop

This cycle slows down coding. If you are building a simple Node.js application that reads files from S3, you should not be blocked because your local test profile lacks a specific permission boundary.

### Security Key Leakage Risks

To avoid these blockers, developers often generate powerful Admin access keys and store them in plain text on their local machines. If these machines are compromised, or if the config files are accidentally checked into public code repositories, it exposes the entire enterprise cloud to attackers.

---

## 2. The Key Ring Analogy

A key ring holds multiple physical keys. Each key fits a specific lock. Having a key on your ring represents authentication (proving you have the physical credentials).

### Lock Permissibility

Just because you have a key doesn't mean you are authorized to open any door in a building. The building manager sets rules: employees can open the front door, but only administrators can open the server room door. This rules list represents an access policy.

### Bypassing Locks during Construction

When a building is under construction, the doors may not have locks installed yet. Workers can walk freely between rooms to install plumbing, electrical wiring, and drywall without needing keys. Local IAM emulation behaves like this construction phase, allowing you to design the structure without being locked out.

---

## 3. The Mechanism: Policy Structure and Simulation Rules

AWS IAM policies are JSON documents containing statements. Each statement defines an `Effect` (Allow/Deny), an `Action` (the API call), a `Resource` (the target), and optional `Condition` statements.

### Policy Document Structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::dev-bucket/*"
    }
  ]
}
```

### Local Emulation Logic

In local emulators like Floci, IAM APIs are fully simulated. You can run commands to create users, attach policies, and assume roles, and they will return successful API payloads. However, by default, the emulator does not block your S3, DynamoDB, or Lambda API requests even if you have not explicitly attached the necessary IAM permissions. This is a deliberate choice to speed up local prototyping.

---

## 4. Diagram: Local vs. Live IAM Request Evaluation

### The Policy Evaluation Path

```text
Live AWS Request Path:
  [Client Request] ──► [IAM Evaluation Engine]
                             │
                             ▼  (Checks Policies, Roles, MFA)
                       Is request allowed?
                             │
                      ┌──────┴──────┐
                      YES           NO
                      │             │
                      ▼             ▼
               [Execute API]   [AccessDenied Error]

Local AWS Request Path:
  [Client Request] ──► [Floci IAM Simulator]
                             │
                             ▼  (Logs API, mocks metadata)
                       Always returns success
                             │
                             ▼
                       [Execute API]
```

### Strategic Value

The API signatures remain identical. You can run the exact same `iam:CreateUser` calls to build setup scripts, but your application code won't break mid-run due to policy misconfigurations.

---

## 5. Code Walkthrough: Local User Creation and STS Role Assumption

The following shell script configures a local user, policy, and role inside the Floci container. The Node.js snippet shows how to call the Security Token Service (STS) locally to assume that role.

### local-iam-provision.sh script

```bash
#!/bin/bash
# local-iam-provision.sh

# Target the local emulator
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_PROFILE=local

# 1. Create a local user
aws iam create-user --user-name dev-user

# 2. Create a local role for S3 access
aws iam create-role \
  --role-name s3-reader-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": { "Service": "ec2.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

echo "IAM Setup complete. Local role 's3-reader-role' created."
```

### Node.js STS AssumeRole Client

```js
// sts-assume-role.js
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const stsClient = new STSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "mock-key",
    secretAccessKey: "mock-secret"
  }
});

async function acquireTemporaryCredentials() {
  try {
    const command = new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::000000000000:role/s3-reader-role",
      RoleSessionName: "LocalDevSession"
    });
    const data = await stsClient.send(command);
    console.log("Assumed Role Credentials successfully acquired:");
    console.log(`Access Key ID: ${data.Credentials.AccessKeyId}`);
    return data.Credentials;
  } catch (error) {
    console.error(`AssumeRole failed: ${error.message}`);
    throw error;
  }
}

acquireTemporaryCredentials();
```

---

## 6. Comparing Live IAM Enforcement to Local Simulation

### Feature Comparison

| Feature | Live AWS | Local Emulator (Floci) |
|---|---|---|
| Enforcement | Strict (fails on missing permission) | Permissive (allows all actions by default) |
| Account ID | Unique 12-digit number | Defaults to `000000000000` |
| Execution Speed | Network-bound (slow) | Sub-millisecond (instant) |
| Cost | Free service, but blocks cause idle costs | Completely free |
| STS Service | Generates temporary session tokens | Mocks session token response payloads |
| Access Key Syntax | Must start with `AKIA` / `ASIA` | Accepts arbitrary dummy strings |

---

## 7. Common Mistakes

- **Confusing local simulation with security enforcement.** Assuming that because a Node.js app runs successfully without errors against localhost, its IAM permissions are correctly configured for production.
- **Forgetting the default Account ID.** Emulators mock the account number as `000000000000`. Writing hardcoded policy resource ARNs with real account IDs causes cross-account policy tests to fail locally.
- **Overlooking STS session lifetimes.** Assuming simulated STS tokens expire like live tokens. Floci returns token metadata, but does not actively expire local connections based on token duration.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a JSON policy document that allows an app to read (GetObject) but forbids deleting (DeleteObject) items in a bucket named `media-bucket`.

**Exercise 2:** Run the script in Section 5 to create a user and role. Verify their existence by running `aws iam list-users --endpoint-url=http://localhost:4566`.

**Exercise 3:** Write a Node.js function that initializes the STS client, calls `GetCallerIdentityCommand`, and prints the current account ID and user ARN.

**Exercise 4:** Explain why local emulators default the account ID to `000000000000` and how this affects your Terraform policy configurations.

**Exercise 5:** Save the script in Section 5, make it executable (`chmod +x local-iam-provision.sh`), and verify its syntax using the bash terminal.

---

## 9. Interview Q&A

**Q: What is the default AWS account ID used in local emulators like Floci, and why does this matter?**
The default account ID is `000000000000`. This matters because all local Resource ARNs (such as `arn:aws:iam::000000000000:role/my-role`) utilize this number. When migrating to live AWS, you must replace `000000000000` with your real 12-digit AWS account ID, preferably using variables in Terraform or CloudFormation.

**Q: How does IAM policy enforcement differ between local emulators and the public cloud?**
In the public cloud, IAM is strictly enforced, and any missing permission results in an `AccessDenied` error. By default, local emulators simulate the IAM API (allowing you to create users, roles, and policies) but do not actively enforce permissions on other resource APIs (like S3 or DynamoDB), allowing you to prototype without policy bottlenecks.

**Q: What is the function of the AWS STS AssumeRole operation, and how is it tested locally?**
The `AssumeRole` operation returns temporary security credentials that grant access to AWS resources. It is tested locally by configuring an STS client to target `http://localhost:4566`, calling the `AssumeRoleCommand` with a mock role ARN, and using the returned keys (mock access keys) to initialize other service clients.

**Q: What is the difference between an IAM User and an IAM Role?**
An IAM User is a permanent identity assigned to a specific person or application with long-term credentials (password, access keys). An IAM Role is an identity that can be assumed dynamically by trusted entities (like a Lambda function or an EC2 instance) to obtain short-term, temporary credentials.

**Q: How do you configure the AWS CLI profile to run local IAM commands?**
You configure a dedicated profile (e.g. named `local`) using `aws configure --profile local` and input dummy values for keys. When running CLI commands, you append `--profile local` and `--endpoint-url=http://localhost:4566` to target the emulator.
