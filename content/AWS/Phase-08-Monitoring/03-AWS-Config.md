# AWS Config — Complete Configuration Compliance Guide

> AWS Config answers: "Are my AWS resources configured the way they should be?" It provides a history of configuration changes and evaluates resources against compliance rules.

---

## Table of Contents

1. [What is AWS Config?](#1-what-is-aws-config)
2. [How AWS Config Works](#2-how-aws-config-works)
3. [Configuration Items and History](#3-configuration-items-and-history)
4. [Config Rules](#4-config-rules)
5. [Remediation Actions](#5-remediation-actions)
6. [Config Timeline](#6-config-timeline)
7. [Multi-Account and Multi-Region Aggregation](#7-multi-account-and-multi-region-aggregation)
8. [AWS Config vs CloudTrail](#8-aws-config-vs-cloudtrail)
9. [Conformance Packs](#9-conformance-packs)
10. [Hands-on Lab](#10-hands-on-lab)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is AWS Config?

**AWS Config** is a service that enables you to assess, audit, and evaluate the **configurations** of your AWS resources. It answers:

```
CloudTrail: "Who changed the security group at 2pm?"
AWS Config: "Was the security group compliant before and after the change?"
            "How has this security group's configuration changed over time?"
            "Show me all security groups that allow port 22 from 0.0.0.0/0"
```

### Core Capabilities

```
1. Configuration Recording
   Continuously records resource configurations
   "What does this EC2 instance look like right now?"
   "What did it look like 3 months ago?"

2. Compliance Evaluation
   Rules define desired state
   "All S3 buckets must have encryption enabled"
   "No security groups allow 0.0.0.0/0 on port 22"

3. Change History
   Timeline of every configuration change
   Diff view: what changed between two points

4. Relationship Tracking
   "Which EC2 instances use this security group?"
   "Which subnets are in this VPC?"
   Resource dependency mapping
```

### Use Cases

| Use Case | Example |
|----------|---------|
| Security compliance | All EBS volumes must be encrypted |
| Regulatory compliance | HIPAA: no unencrypted databases |
| Operational governance | All EC2 instances must have backup tags |
| Change management | See exactly what changed and when |
| Troubleshooting | Instance was working before, what changed? |
| Incident response | What was the config when the breach occurred? |

---

## 2. How AWS Config Works

### Components

```
+----------------------------------------------------------+
|                    AWS Config                            |
|                                                          |
|  Configuration     Configuration    Config Rules        |
|  Recorder          History          Evaluations         |
|  +----------+     +----------+     +----------+         |
|  | Records  |     | Timeline |     | COMPLIANT|         |
|  | resource |---->| of all   |     | or       |         |
|  | configs  |     | changes  |     | NON-COMP |         |
|  +----------+     +----------+     +----------+         |
|       |                                 |               |
|       v                                 v               |
|  Config S3 Bucket              Remediation Actions      |
|  (configuration history)       (auto-fix violations)    |
+----------------------------------------------------------+
```

### Configuration Recorder

AWS Config uses a **Configuration Recorder** to detect and record configuration changes:

```
Triggers for recording:
  1. Resource change detected (EC2 stopped, S3 bucket policy changed)
  2. Periodic: Every 24 hours (full snapshot)
  3. On demand: via API

What it records:
  - Resource type and ID
  - Resource attributes (all configuration details)
  - Relationships (what other resources it's connected to)
  - Timestamp of the recording
```

### AWS Config Delivery Channel

Config delivers configuration data to an S3 bucket:

```
S3 Bucket: aws-config-<account-id>-<region>
Path: AWSLogs/<accountId>/Config/<region>/

Files:
  Configuration Snapshots: Full point-in-time snapshot
  Configuration History:   Changes over time
  Compliance History:      Rule evaluation results
```

### Setting Up AWS Config

```
AWS Config Console -> Get started

Recording:
  Record all resources: Yes (or specific resource types)
  Record global resources (IAM): Yes
  Include global resources: Yes (for IAM)

S3 Bucket:
  Create new bucket or use existing
  Bucket: aws-config-<account-id>-us-east-1

SNS Topic (optional):
  Get notifications for configuration changes

-> Confirm -> AWS Config starts recording
```

---

## 3. Configuration Items and History

### Configuration Item (CI)

A **Configuration Item** is a point-in-time record of an AWS resource:

```json
{
  "version": "1.3",
  "accountId": "123456789012",
  "configurationItemCaptureTime": "2024-01-15T14:32:11Z",
  "configurationItemStatus": "OK",
  "resourceType": "AWS::EC2::Instance",
  "resourceId": "i-0123456789abcdef0",
  "resourceName": "prod-web-server-1",
  "awsRegion": "us-east-1",
  "availabilityZone": "us-east-1a",
  "resourceCreationTime": "2024-01-01T09:00:00Z",
  "tags": {
    "Environment": "Production",
    "Team": "WebApp"
  },
  "configuration": {
    "instanceId": "i-0123456789abcdef0",
    "instanceType": "t3.medium",
    "imageId": "ami-0abcdef1234567890",
    "state": {"code": 16, "name": "running"},
    "subnetId": "subnet-0123456789abcdef0",
    "vpcId": "vpc-0123456789abcdef0",
    "privateIpAddress": "10.0.1.100",
    "keyName": "my-key-pair",
    "iamInstanceProfile": {
      "arn": "arn:aws:iam::123456789012:instance-profile/EC2Role"
    }
  },
  "relationships": [
    {
      "resourceType": "AWS::EC2::SecurityGroup",
      "resourceId": "sg-0123456789abcdef0",
      "relationshipName": "Is associated with SecurityGroup"
    },
    {
      "resourceType": "AWS::EC2::Subnet",
      "resourceId": "subnet-0123456789abcdef0",
      "relationshipName": "Is contained in Subnet"
    }
  ]
}
```

### Configuration History

Config stores the **complete history** of every configuration change:

```
EC2 Instance i-0123456789abcdef0 Timeline:

2024-01-01 09:00:00  CREATED         instance type: t3.small
2024-01-05 10:15:00  CHANGED         instance type: t3.small -> t3.medium
2024-01-10 14:00:00  CHANGED         security group added: sg-abc123
2024-01-15 14:32:00  CHANGED         state: running -> stopped
2024-01-15 16:00:00  CHANGED         state: stopped -> running
2024-01-20 09:00:00  DELETED         instance terminated
```

### Config Dashboard

```
AWS Config Console -> Dashboard

Shows:
  Total resources recorded
  Resources by type (pie chart)
  Compliance by rule (% compliant)
  Recent configuration changes
  Non-compliant resources count
```

---

## 4. Config Rules

**Config Rules** define the desired configuration state for your AWS resources. Config continuously evaluates resources against these rules.

### Rule Compliance States

```
COMPLIANT:     Resource meets the rule's requirements
NON_COMPLIANT: Resource violates the rule
NOT_APPLICABLE: Rule doesn't apply to this resource type
ERROR:         Rule couldn't be evaluated (IAM permissions, etc.)
```

### Types of Config Rules

#### Managed Rules (AWS-provided)

AWS maintains 200+ pre-built rules for common compliance requirements.

**Security Rules:**

```
encrypted-volumes
  Checks: Are all EBS volumes encrypted?
  
s3-bucket-public-read-prohibited
  Checks: Are S3 buckets blocking public read access?
  
s3-bucket-server-side-encryption-enabled
  Checks: Is S3 server-side encryption enabled?

rds-storage-encrypted
  Checks: Are RDS instances encrypted at rest?

iam-root-access-key-check
  Checks: Does root account have access keys? (should be NO)

iam-user-mfa-enabled
  Checks: Do all IAM users have MFA enabled?

access-keys-rotated
  Checks: Are access keys rotated within N days?
  
mfa-enabled-for-iam-console-access
  Checks: Do console users have MFA?

vpc-sg-open-only-to-authorized-ports
  Checks: Security groups don't allow unrestricted access on non-standard ports
  
restricted-ssh
  Checks: No security groups allow unrestricted SSH (0.0.0.0/0 port 22)
  
restricted-common-ports
  Checks: Commonly attacked ports not open to internet
```

**Operational Rules:**

```
required-tags
  Checks: Resources have required tags (Environment, Owner, etc.)
  Parameters: tag1Key=Environment, tag1Value=Production|Staging|Dev

ec2-instance-managed-by-ssm
  Checks: EC2 instances managed by AWS Systems Manager

ec2-stopped-instance
  Checks: No instances stopped for more than N days (cost control)

elb-deletion-protection-enabled
  Checks: ELBs have deletion protection enabled

rds-multi-az-support
  Checks: RDS instances have Multi-AZ enabled (production best practice)

backup-plan-exists
  Checks: AWS Backup plans exist for the account

cloudtrail-enabled
  Checks: CloudTrail is enabled and logging
```

#### Custom Rules (Lambda-based)

For rules that don't exist in managed rules, create custom rules using AWS Lambda.

```
Custom Rule: Check EC2 instances use approved AMIs only

Lambda Function:
def evaluate_compliance(configuration_item):
    # Get the AMI ID from the configuration
    ami_id = configuration_item['configuration']['imageId']
    
    # List of approved AMIs
    approved_amis = ['ami-0approved1', 'ami-0approved2', 'ami-0approved3']
    
    if ami_id in approved_amis:
        return 'COMPLIANT'
    else:
        return {
            'complianceType': 'NON_COMPLIANT',
            'annotation': f'Instance uses unapproved AMI: {ami_id}'
        }
```

```
Creating Custom Rule:
  AWS Config -> Rules -> Add Rule -> Create custom Lambda rule
  
  Name: approved-amis-only
  Description: EC2 instances must use approved AMIs
  
  Trigger type:
    Configuration changes (when EC2 instance config changes)
    OR Periodic (run every 24 hours)
    
  Scope of changes: EC2 instance resources
  
  Lambda function: your-custom-rule-lambda
  
  Parameters (optional):
    approvedAMIs: ami-0approved1,ami-0approved2
    (passed to Lambda as JSON)
```

### Evaluation Triggers

**Configuration change trigger:**
```
Runs evaluation when:
  - A resource is created
  - A resource's configuration changes
  - A resource is deleted

Example: S3 bucket encryption rule
  Runs when: S3 bucket created, S3 bucket configuration changed
  Evaluates: Is encryption enabled on this bucket?
```

**Periodic trigger:**
```
Runs evaluation at:
  1-hour, 3-hour, 6-hour, 12-hour, or 24-hour intervals

Example: access-keys-rotated rule
  Runs: Every 24 hours
  Evaluates: When were all access keys last rotated?
  (No configuration change trigger because rotation age changes with time, not config changes)
```

### Creating a Managed Rule

```
AWS Config Console -> Rules -> Add Rule

Add managed rule:
  Search: "encrypted-volumes"
  Select: encrypted-volumes
  
  Description: Check that EBS volumes are encrypted
  
  Trigger:
    All changes (when any EBS volume config changes)
    AND periodic: 24 hours
    
  Parameters:
    kmsId: arn:aws:kms:... (optional: require specific KMS key)
    
-> Save
```

Config immediately evaluates all existing EBS volumes and marks each as COMPLIANT or NON_COMPLIANT.

---

## 5. Remediation Actions

**Remediation** automatically fixes non-compliant resources.

### Manual Remediation

```
AWS Config -> Rules -> Non-compliant rule
-> Resources in violation -> Select resource
-> Remediation action -> Choose action -> Execute

Example:
  Non-compliant: S3 bucket without encryption
  Remediation: Run SSM Document to enable encryption
  -> Click "Remediate" -> S3 bucket gets encryption enabled
```

### Automatic Remediation

Configure Config to automatically remediate without human intervention:

```
AWS Config -> Rules -> Edit rule
-> Remediation actions
-> Automatic remediation: Yes
-> Retry: 5 times (before giving up)

Remediation action:
  Action: AWS-EnableS3BucketEncryption
  SSM Automation document that enables encryption
  
  Parameters:
    BucketName: RESOURCE_ID  (auto-populated)
    SSEAlgorithm: aws:kms
    KMSMasterKeyId: arn:aws:kms:...

Result:
  When Config detects non-compliant S3 bucket
  -> Automatically runs SSM Automation
  -> Bucket gets encryption enabled
  -> Config re-evaluates -> COMPLIANT
```

### Remediation with SSM Automation Documents

AWS provides pre-built automation documents for common remediations:

```
AWS-EnableS3BucketEncryption      - Enable S3 encryption
AWS-EnableRDSEncryption           - Enable RDS encryption
AWS-EnableEBSEncryption           - Enable EBS volume encryption
AWS-EnableCloudTrail              - Enable CloudTrail
AWS-EnableVPCFlowLogs             - Enable VPC Flow Logs
AWS-DeleteAccessKey               - Delete an IAM access key
AWS-DisablePublicAccessToRDSInstance - Remove RDS public access
AWS-TerminateEC2Instance          - Terminate non-compliant EC2
```

You can also write custom SSM Automation documents.

### Remediation Considerations

```
Automatic vs Manual:
  Automatic: Use for low-risk, well-tested remediations
    Good for: Enabling encryption, adding tags, enabling MFA
    
  Manual: Use for high-risk changes
    Good for: Deleting resources, network changes, IAM changes
    
Notification:
  Even with automatic remediation, notify teams:
  Config -> SNS -> "Non-compliant resource found and auto-remediated"
  
Testing:
  Test remediation on non-production first
  Verify remediation doesn't break the application
  Some "remediations" can break things (enabling encryption on live DB)
```

---

## 6. Config Timeline

The **Config Timeline** shows a resource's complete configuration history with a visual diff tool.

### Viewing the Timeline

```
AWS Config Console -> Resources -> Find your resource
-> Resource timeline

Shows:
  Bar chart of configuration changes over time
  Each change shows:
    - What changed (diff view)
    - When it changed
    - Which CloudTrail event caused it (linked!)
    - Compliance state at each point
```

### Timeline View Example

```
EC2 Instance i-0123456789abcdef0 Timeline:

Jan 1  Jan 5  Jan 10  Jan 15  Jan 20
  |      |       |       |       |
 CREATED |       |       |       |
        CHANGED  |       |       |
       (type     |       |       |
        change)  |       |       |
                CHANGED  |       |
               (SG added)|       |
                        STOPPED  |
                                DELETED

Compliance:
Jan 1 - Jan 9:  COMPLIANT (encrypted)
Jan 10:         NON-COMPLIANT (SG allowed port 22 from 0.0.0.0/0)
Jan 15:         COMPLIANT (SG fixed)
```

### Configuration Diff View

When you click on a change in the timeline, Config shows you exactly what changed:

```
Before change (Jan 5, 09:55):         After change (Jan 5, 10:15):
{                                      {
  "instanceType": "t3.small",           "instanceType": "t3.medium",  <- CHANGED
  "state": "running",                   "state": "running",
  "privateIpAddress": "10.0.1.100"     "privateIpAddress": "10.0.1.100"
}                                      }
```

---

## 7. Multi-Account and Multi-Region Aggregation

### Config Aggregator

View compliance across multiple accounts and regions in one place:

```
Central Account (Security)
  |
  | Config Aggregator
  |
  +--- Account 1 (us-east-1, us-west-2)
  |
  +--- Account 2 (eu-west-1, eu-central-1)
  |
  +--- Account 3 (ap-southeast-1)

Single dashboard showing:
  Total non-compliant resources: 47
  By account: Account 2 has 30 violations
  By rule: encrypted-volumes fails 20 resources
```

### Setting Up Aggregator

**Using AWS Organizations (recommended):**
```
Management Account:
  AWS Config -> Aggregators -> Create Aggregator
  
  Aggregator name: org-config-aggregator
  Source accounts: My organization (all accounts)
  Source regions: All regions
  
  -> Create aggregator
  
  (AWS automatically grants permissions via Organizations)
```

**Manual (individual account authorization):**
```
In source accounts:
  AWS Config -> Aggregations -> Authorize aggregator account
  Account ID: [security account ID]
  Region: us-east-1

In aggregator account:
  Create aggregator specifying source accounts
```

### Organization Config Rules

Deploy a Config rule to ALL accounts in the organization:

```
Management Account:
  AWS Config -> Rules -> Create Organization Rule
  
  Rule: s3-bucket-public-read-prohibited
  Deploy to: All accounts in organization
  
  Result:
    Rule deployed to all 50 accounts simultaneously
    Non-compliant resources visible in aggregator
    Member accounts cannot delete organization rules
```

---

## 8. AWS Config vs CloudTrail

This is a **common exam question**. Understand the distinction clearly.

| Aspect | AWS Config | CloudTrail |
|--------|-----------|-----------|
| **Primary question** | "Is this resource compliant?" | "Who made this API call?" |
| **Focus** | Resource configuration state | API activity audit |
| **Data type** | Configuration snapshots | API event records |
| **Historical view** | What config looked like at any point | What API calls were made |
| **Compliance** | Yes — rules, evaluations, remediation | No |
| **Who/What** | What (resource attributes) | Who (user identity), what (API call) |
| **Scope** | AWS resource configurations | All AWS API calls |
| **Real-time alerts** | Non-compliant resources | Specific API calls |
| **Use case** | "All S3 buckets encrypted?" | "Who deleted that S3 bucket?" |

### How They Complement Each Other

```
Scenario: S3 bucket policy changed to allow public access

CloudTrail answers:
  - WHAT: PutBucketPolicy API call
  - WHO: IAM user john.doe called PutBucketPolicy
  - WHEN: 2024-01-15 at 14:32:11 UTC
  - FROM: Source IP 203.0.113.45

AWS Config answers:
  - COMPLIANCE: Bucket now NON-COMPLIANT (s3-bucket-public-read-prohibited rule)
  - BEFORE: Policy was private
  - AFTER: Policy allows public read
  - DIFF: Shows exactly what in the policy changed
  - AUTO-FIX: Remediation action restores private policy

Together: Complete picture of the change and its compliance impact
```

---

## 9. Conformance Packs

**Conformance Packs** are collections of Config Rules packaged together to address a specific compliance framework.

### AWS-Provided Conformance Packs

```
Available packs:
  Operational Best Practices for Amazon DynamoDB
  Operational Best Practices for Amazon EC2
  Operational Best Practices for Amazon S3
  Operational Best Practices for Amazon VPC
  
  Compliance framework packs:
  AWS Control Tower Detective Guardrails
  NIST 800-53 Rev 4
  PCI DSS 3.2.1
  HIPAA Security Rule
  CIS AWS Foundations Benchmark
  SOC 2
  FedRAMP
```

### Using the CIS AWS Foundations Benchmark Pack

```
AWS Config -> Conformance Packs -> Deploy conformance pack

Choose template:
  AWS-operational-best-practices-for-cis-aws-benchmark

Parameters:
  AccessKeysRotatedParamMaxAccessKeyAge: 90 (days)
  MFAEnabledForIAMConsoleAccessParamEnabled: true

-> Deploy
```

This automatically creates all CIS benchmark Config Rules in your account and begins evaluating compliance.

### Custom Conformance Packs

Write your own YAML template:

```yaml
Parameters:
  MaxAccessKeyAge:
    Default: "90"
    Type: String

ConformancePackName: MyCompanyBaseline

Rules:
  - Name: encrypted-volumes
    ManagedRuleIdentifier: ENCRYPTED_VOLUMES
    
  - Name: s3-bucket-encryption
    ManagedRuleIdentifier: S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED
    
  - Name: access-keys-rotated
    ManagedRuleIdentifier: ACCESS_KEYS_ROTATED
    InputParameters:
      maxAccessKeyAge: "{{{MaxAccessKeyAge}}}"
    
  - Name: mfa-enabled-for-console
    ManagedRuleIdentifier: MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS
    
  - Name: cloudtrail-enabled
    ManagedRuleIdentifier: CLOUD_TRAIL_ENABLED
```

---

## 10. Hands-on Lab

### Lab: Set Up AWS Config with Security Rules

**Step 1: Enable AWS Config**
```
AWS Config Console -> Get started

Settings:
  Recording strategy: All resources (all resource types in all regions)
  Record global resources: Yes (IAM)
  S3 bucket: aws-config-<account-id>-<region>
  SNS topic: Create new (aws-config-notifications)
  
-> Save
```

**Step 2: Add Security Rules**

Add these rules one by one:

```
1. restricted-ssh
   Checks: No SG allows unrestricted SSH
   
2. s3-bucket-public-read-prohibited
   Checks: S3 buckets block public read
   
3. encrypted-volumes
   Checks: EBS volumes encrypted
   
4. iam-root-access-key-check
   Checks: Root has no access keys
   
5. cloudtrail-enabled
   Checks: CloudTrail is enabled
   
6. required-tags
   Parameters:
     tag1Key: Environment
     tag2Key: Owner
```

**Step 3: View Compliance**
```
AWS Config -> Dashboard
-> See compliance status for each rule
-> Click on any rule to see which resources are compliant/non-compliant
```

**Step 4: Create a Non-Compliant Resource (intentional for learning)**
```
Create an S3 bucket:
  Name: my-config-test-bucket
  Block all public access: UNCHECK (make it public-accessible)

AWS Config will detect this within minutes and mark as NON_COMPLIANT
for rule s3-bucket-public-read-prohibited
```

**Step 5: View the Violation**
```
Config -> Rules -> s3-bucket-public-read-prohibited
-> Non-compliant resources: my-config-test-bucket
-> Click on the bucket to see:
  - Configuration item (what the bucket looks like)
  - Timeline
  - What needs to change
```

**Step 6: Add Remediation**
```
Config -> Rules -> s3-bucket-public-read-prohibited -> Edit
-> Remediation actions
-> Add remediation action:
  Action: AWS-DisableS3BucketPublicReadWrite
  Resource ID: RESOURCE_ID (auto)
  Auto-remediation: Yes
  
-> Save

Now when S3 buckets go non-compliant, Config automatically fixes them
```

**Step 7: Query Resource History**
```
Config -> Resources
Type: AWS::S3::Bucket
Find: my-config-test-bucket

-> Resource timeline
-> See the change from public to private access (after remediation)
```

**Cleanup:**
```
Delete S3 test bucket
Go to Config -> Settings -> Stop recording (avoid ongoing charges)
```

---

## 11. Interview Q&A

**Q1: What is AWS Config and how does it differ from CloudTrail?**

A: AWS Config tracks the **configuration state** of AWS resources over time and evaluates them against compliance rules. CloudTrail records **API calls** (who did what and when).

Config answers: "Is this S3 bucket encrypted? What did the security group look like last week? Are we CIS compliant?"
CloudTrail answers: "Who changed the security group? When was the EC2 instance launched? What CLI command was run?"

They complement each other — CloudTrail shows who made a change, Config shows what the change was and whether it was compliant.

---

**Q2: What is a Config Rule and what are the two types?**

A:
- **Config Rule**: Defines the desired configuration state for an AWS resource. Config continuously evaluates resources and marks them COMPLIANT or NON_COMPLIANT.
- **Managed Rules**: Pre-built rules maintained by AWS (200+). Examples: encrypted-volumes, restricted-ssh, s3-bucket-public-read-prohibited.
- **Custom Rules**: Lambda functions you write for rules that don't exist in managed rules. The Lambda receives a configuration item and returns COMPLIANT or NON_COMPLIANT.

---

**Q3: You need to ensure all EC2 instances are tagged with "Environment" and "Owner" tags. How do you enforce this with AWS Config?**

A: Use the **required-tags** managed rule:
1. Add the `required-tags` rule in AWS Config
2. Set parameters: `tag1Key=Environment`, `tag2Key=Owner`
3. Config will evaluate all EC2 instances (and other resources if specified)
4. Instances without both tags are marked NON_COMPLIANT
5. Optional: Add remediation action to add default tags or send a notification

---

**Q4: What is auto-remediation in AWS Config?**

A: Auto-remediation automatically fixes non-compliant resources without human intervention. You configure a remediation action (usually an SSM Automation document) on a Config rule, and when a resource is found non-compliant, Config triggers the automation to fix it. For example, when a new S3 bucket is created without encryption, auto-remediation can automatically enable encryption on it.

---

**Q5: How does AWS Config handle resources across multiple AWS accounts?**

A: Using **Config Aggregators**, you can view compliance data across multiple accounts and regions from a central account. With AWS Organizations, you can deploy an Organization Aggregator that automatically includes all accounts, and deploy Organization Config Rules that cannot be removed by member accounts. This provides centralized compliance visibility and enforcement.

---

**Q6: What is a Conformance Pack?**

A: A Conformance Pack is a collection of Config rules and remediation actions packaged together to address a specific compliance framework (CIS, NIST, PCI DSS, HIPAA). AWS provides pre-built conformance packs for major compliance frameworks. You deploy one pack and all the relevant rules are created automatically, giving you a compliance score against that framework.

---

**Q7: Can AWS Config detect when a resource was created?**

A: Yes. AWS Config records a configuration item when a resource is **created**. The first configuration item for a resource will have `configurationItemStatus: "ResourceDiscovered"` or `"OK"` and the `resourceCreationTime` field shows when the resource was first seen. The Config timeline starts from resource creation.

---

**Q8: You need to check if any security group allows SSH (port 22) from 0.0.0.0/0. How?**

A: Enable the **restricted-ssh** managed Config Rule. It evaluates all EC2 security groups and marks any that have an inbound rule allowing port 22 from 0.0.0.0/0 or ::/0 as NON_COMPLIANT. The Config console shows all violating security groups, and you can optionally configure auto-remediation to remove the offending rule.

---

**Q9: What is the difference between periodic and configuration-change triggers for Config rules?**

A:
- **Configuration-change trigger**: Rule evaluates when a resource's configuration changes or when a new resource is created. Used for rules where compliance depends on the resource's current settings (e.g., is encryption enabled?).
- **Periodic trigger**: Rule evaluates on a schedule (1, 3, 6, 12, or 24 hours). Used for rules where compliance can change over time without a configuration change (e.g., access key age increases daily — no config change triggers this).

---

**Q10: How long does AWS Config retain configuration history?**

A: AWS Config retains configuration history for **7 years (2,557 days)** by default. You can set a custom retention period between 30 days and 7 years. Note that S3 storage for configuration snapshots and history files follows your S3 bucket's lifecycle policies — you control S3 retention separately.

---

**Q11: What happens to AWS Config data when a resource is deleted?**

A: AWS Config marks the resource with `configurationItemStatus: "ResourceDeleted"` and records this as the final configuration item. The historical data for that resource is retained according to your retention settings. You can still query the history of a deleted resource for compliance and security investigations.

---

**Q12: How would you use AWS Config to investigate a compliance incident from 3 months ago?**

A: 
1. Go to AWS Config -> Resources, find the resource in question
2. Open the **Config Timeline** for that resource
3. Navigate to the date 3 months ago on the timeline
4. View the configuration item at that point — this shows exactly what the resource looked like
5. Check compliance evaluations from that point — was it compliant?
6. Click on the CloudTrail link in the Config timeline to see who made the change
7. View the diff between the compliant and non-compliant configuration items

This gives a complete picture: what was configured, whether it was compliant, and who changed it.

---

*End of AWS Config Complete Guide*

---

## Quick Reference: All Three Services

```
+----------------------------------------------------------+
| Service    | Answers             | Primary Use           |
|------------|---------------------|-----------------------|
| CloudWatch | "What's happening   | Operations, Alarms,   |
|            | right now?"         | Performance metrics   |
|------------|---------------------|-----------------------|
| CloudTrail | "Who did what       | Security audit,       |
|            | and when?"          | Compliance logging    |
|------------|---------------------|-----------------------|
| Config     | "Is this compliant? | Compliance evaluation,|
|            | What changed?"      | Configuration history |
+----------------------------------------------------------+

All three together = Complete observability and governance
```
