# AWS CloudTrail — Complete Audit and Governance Guide

> AWS CloudTrail records API calls made to your AWS account. It answers: "Who did what, when, from where?"

---

## Table of Contents

1. [What is CloudTrail?](#1-what-is-cloudtrail)
2. [How CloudTrail Works](#2-how-cloudtrail-works)
3. [Event Types](#3-event-types)
4. [Trails](#4-trails)
5. [CloudTrail Insights](#5-cloudtrail-insights)
6. [Integration with CloudWatch](#6-integration-with-cloudwatch)
7. [Querying with Athena](#7-querying-with-athena)
8. [Security and Integrity](#8-security-and-integrity)
9. [Scenario Walkthroughs](#9-scenario-walkthroughs)
10. [Hands-on Lab](#10-hands-on-lab)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is CloudTrail?

**AWS CloudTrail** is an AWS service that enables governance, compliance, operational auditing, and risk auditing of your AWS account. Every API call to AWS is a CloudTrail event.

### The Core Question CloudTrail Answers

```
"Who deleted the production database?"
  -> CloudTrail: admin@company.com called DeleteDBInstance at 14:32 UTC from IP 203.0.113.45

"Which role changed the security group?"
  -> CloudTrail: arn:aws:iam::123456789012:role/DevOpsRole called AuthorizeSecurityGroupIngress

"What was done from this compromised access key?"
  -> CloudTrail: Filter by AccessKeyId = AKIAXXX shows all API calls made with that key
```

### What CloudTrail Records

Every API call (console action, CLI command, SDK call, service-to-service call) generates a CloudTrail event:

```
User creates S3 bucket in Console:
  -> Browser calls CreateBucket API
  -> CloudTrail records: who, when, what bucket, from where

DevOps engineer runs: aws ec2 terminate-instances --instance-ids i-123
  -> CLI calls TerminateInstances API
  -> CloudTrail records: which IAM user, when, which instance

Lambda function assumes an IAM role:
  -> Lambda calls AssumeRole
  -> CloudTrail records: which function, which role, when

Terraform creates infrastructure:
  -> Terraform calls EC2, RDS, VPC APIs
  -> CloudTrail records every call with the IAM role Terraform uses
```

### CloudTrail is Always On (But Limited)

Important: CloudTrail is enabled **by default** for all AWS accounts. However:

```
Default (no trail configured):
  - Events stored for 90 days in Event History
  - Only management events
  - Viewable in CloudTrail console
  - Cannot query with Athena
  - Not sent to S3

With a Trail configured:
  - Events stored indefinitely in S3
  - Management events + optionally Data events + Insights
  - Can query with Athena
  - Can send to CloudWatch Logs for real-time alerting
  - Long-term retention and analysis
```

---

## 2. How CloudTrail Works

### Event Flow

```
Action performed
(Console click, CLI command, SDK call, Service-to-service)
       |
       v
AWS API Call
  (CreateInstance, DeleteBucket, PutObject, etc.)
       |
       v
CloudTrail captures the event
       |
       +---> Event History (90 days, always free)
       |
       +---> Trail (if configured)
               |
               +---> S3 Bucket (log files every ~5 minutes)
               |     (unlimited retention, pay for S3 storage)
               |
               +---> CloudWatch Logs (optional, for real-time)
               |
               +---> CloudWatch Events/EventBridge (optional, for automation)
```

### Event Structure

Every CloudTrail event is a JSON record:

```json
{
    "eventVersion": "1.08",
    "userIdentity": {
        "type": "IAMUser",
        "principalId": "AIDAJDXLV7XXXXXXXXXXXX",
        "arn": "arn:aws:iam::123456789012:user/alice",
        "accountId": "123456789012",
        "accessKeyId": "AKIAXXXXXXXXXXXXXXXXXXX",
        "userName": "alice"
    },
    "eventTime": "2024-01-15T14:32:11Z",
    "eventSource": "ec2.amazonaws.com",
    "eventName": "TerminateInstances",
    "awsRegion": "us-east-1",
    "sourceIPAddress": "203.0.113.45",
    "userAgent": "aws-cli/2.13.0",
    "requestParameters": {
        "instancesSet": {
            "items": [{"instanceId": "i-0123456789abcdef0"}]
        }
    },
    "responseElements": {
        "instancesSet": {
            "items": [{
                "instanceId": "i-0123456789abcdef0",
                "currentState": {"code": 32, "name": "shutting-down"},
                "previousState": {"code": 16, "name": "running"}
            }]
        }
    },
    "requestID": "abc123-def456-ghi789",
    "eventID": "unique-event-id-here",
    "readOnly": false,
    "resources": [
        {
            "ARN": "arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0",
            "accountId": "123456789012",
            "type": "AWS::EC2::Instance"
        }
    ],
    "eventType": "AwsApiCall",
    "managementEvent": true,
    "recipientAccountId": "123456789012"
}
```

### Key Fields

| Field | Description | Example |
|-------|-------------|---------|
| userIdentity | WHO made the call | IAM user, role, root, service |
| eventTime | WHEN the call was made | 2024-01-15T14:32:11Z |
| eventSource | Which AWS service | ec2.amazonaws.com |
| eventName | What API call | TerminateInstances |
| awsRegion | Which region | us-east-1 |
| sourceIPAddress | From where | 203.0.113.45 (or AWS internal) |
| userAgent | How (console, CLI, SDK) | aws-cli/2.13.0, console.amazonaws.com |
| requestParameters | Input to the API | Instance IDs, parameters passed |
| responseElements | Output from the API | Created resource IDs, etc. |
| errorCode | If call failed | AccessDenied, NoSuchBucket |
| errorMessage | Why it failed | User is not authorized to perform |

### Log File Format

CloudTrail stores log files in S3 as gzip-compressed JSON:

```
S3 Bucket: my-cloudtrail-logs
Path: s3://my-cloudtrail-logs/AWSLogs/123456789012/CloudTrail/us-east-1/2024/01/15/
File: 123456789012_CloudTrail_us-east-1_20240115T1435Z_abcdefgh.json.gz

Contents: JSON array of events from ~15-minute period
```

---

## 3. Event Types

### Management Events (Control Plane)

These are **operations performed on AWS resources** — creating, configuring, and deleting resources.

```
Examples:
  CreateVpc              - Someone created a VPC
  DeleteS3Bucket         - Someone deleted a bucket
  AuthorizeSecurityGroup - Security group rule added
  CreateUser             - New IAM user created
  AttachRolePolicy       - IAM policy attached to role
  PutBucketPolicy        - S3 bucket policy changed
  StopInstances          - EC2 instance stopped
  CreateDBInstance       - RDS database created
  DeleteTrail            - Someone tried to hide their tracks!

Types:
  Write Management Events: changes (create, update, delete)
  Read Management Events:  reads (describe, list, get)
  
Default: All management events logged
You can separate read and write events
```

**These are the most important for security and auditing.**

### Data Events (Data Plane)

These are **operations performed ON resources** — the actual data access.

```
S3 Object Operations:
  GetObject              - File downloaded from S3
  PutObject              - File uploaded to S3
  DeleteObject           - File deleted from S3
  
Lambda Invocations:
  Invoke                 - Lambda function called

DynamoDB:
  GetItem, PutItem, etc.

SNS/SQS message operations

Note: Data events are HIGH VOLUME and NOT logged by default!
  - An S3 bucket with 1M downloads/day = 1M data events/day
  - Very expensive to log all data events
  - Only enable for specific resources you need to audit
```

**When to enable Data Events:**
- Compliance requirement to audit file access
- Security investigation of S3 bucket
- Lambda execution history for debugging
- Monitoring sensitive DynamoDB tables

### Insights Events

**CloudTrail Insights** analyzes your write management events and detects unusual patterns.

```
Baseline: CloudTrail learns your "normal" API activity patterns over 7 days

Anomaly: Unusual spike or drop detected
  Examples:
  - Normally 10 TerminateInstances/day, suddenly 500 in an hour
  - Normally 5 CreateSecurityGroup/day, suddenly 100 in an hour
  - S3 deletion rate 10x above normal

Insights event generated:
  What: Which API is anomalous
  When: Start/end time of anomaly
  Comparison: Baseline vs observed rate
```

Insights events are logged to a separate S3 prefix and appear in CloudTrail console.

---

## 4. Trails

A **Trail** is the configuration that enables delivery of events to an S3 bucket (and optionally CloudWatch Logs).

### Trail Scope

**Single-Region Trail:**
```
Records events only in the region where the trail is created
Stored in: s3://bucket/AWSLogs/accountId/CloudTrail/us-east-1/

Use case: Compliance requirement for specific region
```

**Multi-Region Trail (Recommended):**
```
Records events from ALL regions
Stored in: s3://bucket/AWSLogs/accountId/CloudTrail/<each-region>/

Benefits:
  - Global services (IAM, STS, Route53) captured
  - Don't miss activity in regions you forgot about
  - Single trail to manage

Global Service Events:
  IAM, STS, CloudFront, Route53 are global
  Only included in ONE region's trail (typically us-east-1)
  Must enable "Include global service events" on multi-region trail
```

### Organization Trail

For AWS Organizations (multiple accounts):

```
Management Account creates Organization Trail:
  Applies to ALL accounts in the organization
  Logs to central S3 bucket
  
Benefits:
  - Single trail for compliance across 100+ accounts
  - Member accounts cannot modify or delete the trail
  - Centralized security monitoring
```

### Creating a Trail

```
CloudTrail Console -> Trails -> Create Trail

Trail name: prod-cloudtrail
Apply trail to all regions: Yes (recommended)
Enable CloudWatch Logs: Yes
  -> Create new log group
  -> Create new IAM role

S3 bucket: my-cloudtrail-logs-<account-id>
  (or use existing bucket with correct policy)
  
Log file SSE-KMS encryption: Optional
  Use KMS key for encryption at rest

Insight types:
  API call rate: Yes
  API error rate: Yes (optional)

-> Create trail
```

### Trail S3 Bucket Policy

CloudTrail needs permission to write to your S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::my-cloudtrail-logs"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::my-cloudtrail-logs/AWSLogs/123456789012/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control"
        }
      }
    }
  ]
}
```

### Protecting Your Trail

Best practice: Protect CloudTrail logs from tampering:

```
1. Enable S3 MFA Delete
   Prevents deletion without MFA authentication

2. Enable S3 Object Lock (WORM)
   Compliance mode: Cannot delete even with AWS root account!
   
3. Enable Log File Validation
   Cryptographic hash of each log file
   Can detect if log files were deleted or modified
   
4. Alert on trail changes
   CloudWatch Event -> "DeleteTrail" or "StopLogging" -> SNS alert
   
5. Separate AWS account for trail S3 bucket
   Attacker compromising production account cannot delete logs in separate account
   
6. Restrict access to trail S3 bucket
   Only security team can read CloudTrail logs
```

---

## 5. CloudTrail Insights

CloudTrail Insights automatically detects unusual API activity.

### How Insights Works

```
Phase 1: Baseline Learning (7 days)
  CloudTrail measures normal API activity rates
  Builds hourly baselines for write management events
  
Phase 2: Continuous Analysis
  Compares current activity to baseline
  
Phase 3: Insight Generation
  If current rate is significantly higher/lower than baseline:
    -> Generate Insight event
    
Phase 4: Alerting
  Insight event sent to S3
  Can trigger CloudWatch Events
```

### Insights Event Example

```json
{
  "eventName": "TerminateInstances",
  "insightType": "ApiCallRateInsight",
  "insightDetails": {
    "state": "Start",
    "statistics": {
      "baseline": {
        "average": 2.5
      },
      "insight": {
        "average": 150.0
      }
    }
  }
}
```

Baseline: 2.5 TerminateInstances/hour
Observed: 150 TerminateInstances/hour
**60x above normal** — likely a security incident!

### Cost of Insights

- $0.35 per 100,000 management events analyzed (write events only)
- For active accounts, this can add up

---

## 6. Integration with CloudWatch

Sending CloudTrail events to CloudWatch Logs enables real-time alerting.

### Setup

```
Trail configuration:
  CloudWatch Logs: Enabled
  Log Group: /aws/cloudtrail/prod
  IAM Role: CloudTrailRoleForCloudWatch
    (needs PutLogEvents permission on the log group)
```

### Real-Time Alerting with Metric Filters

Create alerts for specific security events:

**Alert: Root Account Login**
```
Metric Filter:
  Pattern: { $.userIdentity.type = "Root" && $.eventType != "AwsServiceEvent" }
  Metric: RootAccountLogins

Alarm: Any root login -> page security team
```

**Alert: Unauthorized API Calls**
```
Metric Filter:
  Pattern: { $.errorCode = "AccessDenied" }
  Metric: UnauthorizedAPICalls
  
Alarm: > 10 AccessDenied in 5 minutes -> investigate
```

**Alert: Security Group Changes**
```
Metric Filter:
  Pattern: { ($.eventName = AuthorizeSecurityGroupIngress) ||
             ($.eventName = AuthorizeSecurityGroupEgress) ||
             ($.eventName = RevokeSecurityGroupIngress) ||
             ($.eventName = RevokeSecurityGroupEgress) ||
             ($.eventName = CreateSecurityGroup) ||
             ($.eventName = DeleteSecurityGroup) }
  Metric: SecurityGroupChanges

Alarm: Any change -> notify security team
```

**Alert: IAM Policy Changes**
```
Metric Filter:
  Pattern: { ($.eventName = CreatePolicy) ||
             ($.eventName = DeletePolicy) ||
             ($.eventName = AttachRolePolicy) ||
             ($.eventName = DetachRolePolicy) ||
             ($.eventName = CreatePolicyVersion) }
  Metric: IAMPolicyChanges
```

**Alert: Console Login Without MFA**
```
Metric Filter:
  Pattern: { ($.eventName = "ConsoleLogin") &&
             ($.additionalEventData.MFAUsed != "Yes") }
  Metric: ConsoleLoginWithoutMFA
```

**Alert: S3 Bucket Policy Changes**
```
Metric Filter:
  Pattern: { ($.eventName = PutBucketAcl) ||
             ($.eventName = PutBucketPolicy) ||
             ($.eventName = PutBucketCors) ||
             ($.eventName = PutBucketLifecycle) ||
             ($.eventName = DeleteBucketPolicy) }
  Metric: S3BucketPolicyChanges
```

**Alert: CloudTrail Logging Stopped**
```
Metric Filter:
  Pattern: { $.eventName = "StopLogging" }
  Metric: CloudTrailChanges
  
Alarm: Immediate alert if someone stops logging (covering tracks!)
```

### Complete Security Alerting Architecture

```
CloudTrail Trail
      |
      v
CloudWatch Logs (/aws/cloudtrail/prod)
      |
      +-- Metric Filter 1 (Root Login) --> Alarm --> SNS (security-critical)
      |
      +-- Metric Filter 2 (AccessDenied) --> Alarm --> SNS (security-alerts)
      |
      +-- Metric Filter 3 (SG Changes) --> Alarm --> SNS (infra-changes)
      |
      +-- Metric Filter 4 (IAM Changes) --> Alarm --> SNS (security-critical)
      |
      +-- Metric Filter 5 (StopLogging) --> Alarm --> SNS (security-critical)
      |
      +-- Logs Insights --> Ad-hoc investigation
```

---

## 7. Querying with Athena

**Amazon Athena** allows you to run SQL queries directly against CloudTrail logs stored in S3.

### Setting Up Athena for CloudTrail

**Option 1: CloudTrail creates table automatically**
```
CloudTrail Console -> Event History -> Run advanced queries in Athena
-> Create table automatically
```

**Option 2: Create table manually**
```sql
CREATE EXTERNAL TABLE cloudtrail_logs (
    eventVersion STRING,
    userIdentity STRUCT<
        type: STRING,
        principalId: STRING,
        arn: STRING,
        accountId: STRING,
        invokedBy: STRING,
        accessKeyId: STRING,
        userName: STRING,
        sessionContext: STRUCT<
            sessionIssuer: STRUCT<
                type: STRING,
                principalId: STRING,
                arn: STRING,
                accountId: STRING,
                userName: STRING>,
            attributes: STRUCT<
                mfaAuthenticated: STRING,
                creationDate: STRING>>>,
    eventTime STRING,
    eventSource STRING,
    eventName STRING,
    awsRegion STRING,
    sourceIPAddress STRING,
    userAgent STRING,
    errorCode STRING,
    errorMessage STRING,
    requestId  STRING,
    eventId    STRING,
    resources ARRAY<STRUCT<
        arn: STRING,
        accountId: STRING,
        type: STRING>>,
    eventType STRING,
    apiVersion  STRING,
    readOnly BOOLEAN,
    recipientAccountId STRING,
    sharedEventID STRING,
    vpcEndpointId STRING,
    requestParameters STRING,
    responseElements STRING,
    additionalEventData STRING,
    serviceEventDetails STRING
)
ROW FORMAT SERDE 'com.amazon.emr.hive.serde.CloudTrailSerde'
STORED AS INPUTFORMAT 'com.amazon.emr.cloudtrail.CloudTrailInputFormat'
OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://my-cloudtrail-logs/AWSLogs/123456789012/CloudTrail/';
```

### Useful Athena Queries

**Find all events by a specific user:**
```sql
SELECT eventTime, eventName, awsRegion, sourceIPAddress, userAgent
FROM cloudtrail_logs
WHERE userIdentity.userName = 'alice'
  AND eventTime > '2024-01-01'
ORDER BY eventTime DESC
LIMIT 100;
```

**Find all EC2 instance terminations:**
```sql
SELECT eventTime, 
       userIdentity.userName,
       userIdentity.arn,
       sourceIPAddress,
       requestParameters
FROM cloudtrail_logs
WHERE eventName = 'TerminateInstances'
  AND eventTime > '2024-01-01'
ORDER BY eventTime DESC;
```

**Find all failed API calls (access denied):**
```sql
SELECT eventTime, 
       eventSource,
       eventName,
       userIdentity.arn,
       errorCode,
       errorMessage,
       sourceIPAddress
FROM cloudtrail_logs
WHERE errorCode IN ('AccessDenied', 'UnauthorizedOperation', 'Client.UnauthorizedAccess')
  AND eventTime BETWEEN '2024-01-15' AND '2024-01-16'
ORDER BY eventTime DESC;
```

**Find console logins:**
```sql
SELECT eventTime,
       userIdentity.userName,
       sourceIPAddress,
       additionalEventData
FROM cloudtrail_logs
WHERE eventName = 'ConsoleLogin'
  AND eventTime > '2024-01-01'
ORDER BY eventTime DESC;
```

**Find all IAM changes in a time window:**
```sql
SELECT eventTime,
       eventName,
       userIdentity.arn,
       requestParameters,
       responseElements
FROM cloudtrail_logs
WHERE eventSource = 'iam.amazonaws.com'
  AND eventTime BETWEEN '2024-01-15T00:00:00Z' AND '2024-01-15T23:59:59Z'
ORDER BY eventTime;
```

**Who made changes to S3 bucket policy:**
```sql
SELECT eventTime,
       userIdentity.userName,
       userIdentity.arn,
       requestParameters,
       sourceIPAddress
FROM cloudtrail_logs
WHERE eventName = 'PutBucketPolicy'
  AND requestParameters LIKE '%my-sensitive-bucket%'
ORDER BY eventTime DESC;
```

**Find root account usage:**
```sql
SELECT eventTime,
       eventName,
       awsRegion,
       sourceIPAddress,
       userAgent
FROM cloudtrail_logs
WHERE userIdentity.type = 'Root'
  AND eventType != 'AwsServiceEvent'
ORDER BY eventTime DESC;
```

**API calls from unusual IP addresses:**
```sql
SELECT sourceIPAddress, 
       COUNT(*) as callCount,
       MIN(eventTime) as firstSeen,
       MAX(eventTime) as lastSeen
FROM cloudtrail_logs
WHERE eventTime > '2024-01-01'
  AND sourceIPAddress NOT LIKE '10.%'
  AND sourceIPAddress NOT LIKE '192.168.%'
  AND sourceIPAddress NOT IN ('known-ip-1', 'known-ip-2')
GROUP BY sourceIPAddress
ORDER BY callCount DESC;
```

### Partitioning for Performance and Cost

Without partitioning, Athena scans ALL log files:
```sql
-- BAD: scans all data (expensive, slow)
SELECT * FROM cloudtrail_logs WHERE eventTime LIKE '2024-01-15%';
```

Partition the table by date:
```sql
-- Add partition
ALTER TABLE cloudtrail_logs ADD PARTITION (region='us-east-1', year='2024', month='01', day='15')
LOCATION 's3://my-cloudtrail-logs/AWSLogs/123456789012/CloudTrail/us-east-1/2024/01/15/';

-- GOOD: only scans January 15th data
SELECT * FROM cloudtrail_logs WHERE year='2024' AND month='01' AND day='15';
```

---

## 8. Security and Integrity

### Log File Validation

CloudTrail creates a **digest file** every hour with cryptographic hashes of all log files:

```
Trail setting: Enable log file validation

Creates digest files in S3:
  s3://bucket/AWSLogs/accountId/CloudTrail-Digest/region/yyyy/mm/dd/

Digest contains:
  - SHA-256 hash of each log file in the period
  - Previous digest hash (chain of custody)
  - Signed with CloudTrail's private key

Validate with CLI:
  aws cloudtrail validate-logs \
    --trail-arn arn:aws:cloudtrail:us-east-1:123456789012:trail/my-trail \
    --start-time 2024-01-15T00:00:00Z \
    --end-time 2024-01-16T00:00:00Z
    
Output: "Results requested for 2024-01-15T00:00:00Z to 2024-01-16T00:00:00Z
         Digest files validated: 24
         Log files validated: 1,440
         All validated log files passed"
```

If any log file was deleted or modified, validation will detect it.

### Protecting Trail Logs from Deletion

```
Best practices:

1. S3 Bucket in separate account
   Attacker cannot delete logs if they compromise your main account
   
2. S3 Object Lock (WORM - Write Once Read Many)
   Governance mode: Admins can delete (with special permission)
   Compliance mode: Nobody can delete (not even root!)
   
3. MFA Delete
   Requires MFA to delete objects
   
4. S3 Versioning
   Deleted objects become "delete markers" - originals preserved
   
5. Restrict IAM permissions
   Only security team role can access CloudTrail S3 bucket
   Deny delete actions for everyone else
   
6. Alert on deletion attempts
   S3 CloudTrail events: DeleteObject on trail bucket -> SNS alert
```

---

## 9. Scenario Walkthroughs

### Scenario 1: "Who Deleted the EC2 Instance?"

**Situation**: Production EC2 instance `i-0123456789abcdef0` was terminated. Need to investigate.

**Step 1: Check CloudTrail Event History (quick)**
```
CloudTrail Console -> Event History
Event name: TerminateInstances
Filter by resource: i-0123456789abcdef0
Time range: last 24 hours

-> Find the event
-> Look at userIdentity: alice@company.com
-> Time: 2024-01-15 14:32:11 UTC
-> Source IP: 203.0.113.45 (corporate VPN)
```

**Step 2: Deeper investigation with Athena**
```sql
SELECT eventTime, 
       userIdentity.userName,
       userIdentity.arn,
       sourceIPAddress,
       userAgent,
       requestParameters,
       responseElements
FROM cloudtrail_logs
WHERE eventName = 'TerminateInstances'
  AND requestParameters LIKE '%i-0123456789abcdef0%'
  AND eventTime > '2024-01-14';
```

**Step 3: Check what else Alice did**
```sql
SELECT eventTime, eventName, eventSource, sourceIPAddress
FROM cloudtrail_logs
WHERE userIdentity.userName = 'alice'
  AND eventTime BETWEEN '2024-01-15T14:00:00Z' AND '2024-01-15T15:00:00Z'
ORDER BY eventTime;
```

**Resolution**: Alice terminated the instance accidentally. Source IP matches corporate VPN (not compromised). Training needed.

---

### Scenario 2: "Detect Compromised Access Key"

**Situation**: Access key `AKIAXXXXXXXXXXXXXXXXXXX` may have been leaked. Need to see what was done with it.

**Athena query:**
```sql
SELECT eventTime,
       eventName,
       eventSource,
       awsRegion,
       sourceIPAddress,
       userAgent,
       errorCode
FROM cloudtrail_logs
WHERE userIdentity.accessKeyId = 'AKIAXXXXXXXXXXXXXXXXXXX'
ORDER BY eventTime DESC
LIMIT 500;
```

**Look for:**
- Unusual regions (attacker in different country)
- Unusual times (3am API calls)
- Unusual services (EC2 if this key is normally for S3 only)
- CreateUser, AttachRolePolicy (privilege escalation)
- New instances, databases being launched (crypto mining?)
- S3 data access (data exfiltration)

**Immediate actions:**
```bash
# Disable the access key immediately
aws iam update-access-key \
  --access-key-id AKIAXXXXXXXXXXXXXXXXXXX \
  --status Inactive \
  --user-name affected-user
```

---

### Scenario 3: "Unexpected S3 Data Exfiltration"

**Situation**: Large amount of data was downloaded from sensitive S3 bucket. Who did it?

**Requirements**: Data events must be enabled for this S3 bucket.

**Athena query:**
```sql
SELECT eventTime,
       userIdentity.userName,
       userIdentity.arn,
       sourceIPAddress,
       requestParameters,
       COUNT(*) as downloadCount,
       SUM(CAST(responseElements as JSON).contentLength as bigint) as totalBytes
FROM cloudtrail_logs
WHERE eventName = 'GetObject'
  AND requestParameters LIKE '%sensitive-bucket%'
  AND eventTime > '2024-01-15'
GROUP BY eventTime, userIdentity.userName, userIdentity.arn, sourceIPAddress, requestParameters
ORDER BY downloadCount DESC;
```

---

### Scenario 4: "Root Account Was Used — Why?"

**Situation**: AWS Config alert says root account was used. Need details.

```sql
SELECT eventTime,
       eventName,
       awsRegion,
       sourceIPAddress,
       userAgent,
       requestParameters,
       errorCode,
       additionalEventData
FROM cloudtrail_logs
WHERE userIdentity.type = 'Root'
  AND eventType != 'AwsServiceEvent'
  AND eventTime > '2024-01-15'
ORDER BY eventTime DESC;
```

Root account should NEVER be used for day-to-day tasks. Find what was done, then:
1. Change root password
2. Verify MFA is enabled on root
3. Review if the action was necessary
4. Document in change log

---

## 10. Hands-on Lab

### Lab: Set Up CloudTrail and Security Alerting

**Step 1: Create CloudTrail Trail**
```
CloudTrail -> Trails -> Create Trail
Name: org-cloudtrail
All regions: Yes
S3 bucket: create new (cloudtrail-logs-<account-id>)
CloudWatch Logs: Enable
  Log group: /aws/cloudtrail/prod
SSE-KMS encryption: No (optional for lab)
Log file validation: Yes
Insight types: API call rate
-> Create trail
```

**Step 2: Create SNS Topic for Alerts**
```
SNS -> Topics -> Create Standard topic
Name: security-alerts
Subscribe your email
Confirm subscription
```

**Step 3: Create Metric Filter for Root Login**
```
CloudWatch -> Log groups -> /aws/cloudtrail/prod
-> Metric filters -> Create metric filter

Filter pattern:
{ $.userIdentity.type = "Root" && $.eventType != "AwsServiceEvent" }

Test pattern (use sample CloudTrail event JSON)

Metric name: RootAccountLogin
Namespace: SecurityAlerts
Value: 1
Default: 0
Unit: Count

-> Create metric filter
```

**Step 4: Create Alarm on Root Login**
```
CloudWatch -> Alarms -> Create Alarm
Metric: SecurityAlerts / RootAccountLogin
Statistic: Sum
Period: 5 minutes
Threshold: >= 1 (any root login)
-> Notify security-alerts SNS topic
Name: Root-Account-Login-Detected
```

**Step 5: Test with Event History**
```
CloudTrail -> Event History
Look at recent events
Note: you can see everything you've done in the console today!

Events visible:
  CreateTrail          - you just did this
  PutMetricFilter      - you just did this
  CreateAlarm          - you just did this
```

**Step 6: Query with Logs Insights**
```
CloudWatch -> Logs Insights
Log group: /aws/cloudtrail/prod
Time: last 1 hour

Query:
  fields eventTime, eventName, userIdentity.userName, sourceIPAddress
  | filter eventSource = "ec2.amazonaws.com"
  | sort eventTime desc
  | limit 50

-> Shows all EC2 API calls you made
```

---

## 11. Interview Q&A

**Q1: What is the difference between CloudTrail and CloudWatch?**

A:
- **CloudTrail**: Audit log of API calls. Who did what to AWS resources. Governance, compliance, security investigation. Answers "who changed the security group?"
- **CloudWatch**: Operational monitoring. Metrics, logs from applications/services, alarms. Answers "is our application healthy right now?"

They complement each other: CloudTrail for audit, CloudWatch for operations.

---

**Q2: Is CloudTrail enabled by default?**

A: Yes, CloudTrail records the last 90 days of management events by default in the Event History, at no cost. However, for long-term retention, multi-region coverage, data events, and Athena querying, you must create a **Trail** that stores events in S3.

---

**Q3: What are data events and when should you enable them?**

A: Data events record operations **on** AWS resources (S3 GetObject, PutObject, Lambda Invoke, DynamoDB GetItem). They are not enabled by default because they generate high volume and cost. Enable them when:
- Compliance requires auditing data access (HIPAA, SOC2)
- Investigating a security incident involving S3 or Lambda
- Auditing access to sensitive databases

---

**Q4: How would you detect if someone is trying to delete CloudTrail logs to cover their tracks?**

A:
1. **Alert on StopLogging**: Metric Filter + Alarm on eventName = "StopLogging"
2. **Alert on DeleteTrail**: Metric Filter + Alarm on eventName = "DeleteTrail"
3. **S3 Object Lock**: CloudTrail log files cannot be deleted regardless
4. **Store logs in separate account**: Even if main account is compromised, attacker can't reach the log account
5. **Enable log file validation**: Can detect if logs were modified

---

**Q5: What is CloudTrail Insights and what does it detect?**

A: CloudTrail Insights uses machine learning to detect unusual API activity. It establishes a 7-day baseline of normal API call rates, then alerts when activity deviates significantly. It can detect:
- Sudden spike in resource creation (crypto mining attack)
- Unusual deletion activity (insider threat)
- Burst of failed API calls (credential stuffing/scanning)
- Any API with 10x+ above normal rate

---

**Q6: How would you investigate an incident where someone may have accessed sensitive S3 files?**

A:
1. Ensure S3 data events are enabled for that bucket (if not, limited to management events)
2. Check CloudTrail Event History for S3 operations on that bucket
3. Query CloudTrail logs in Athena: filter by eventName = 'GetObject' and the bucket name
4. Look for: unusual users/roles, unusual source IPs, unusual times, large volumes of downloads
5. Cross-reference with VPC Flow Logs if accessing from EC2

---

**Q7: What is the difference between a single-region and multi-region trail?**

A:
- **Single-region**: Records events only in one region. Cheaper but incomplete coverage.
- **Multi-region**: Records events from all regions including global services (IAM, STS, Route53). Recommended for security compliance. Creates separate log files per region in the same S3 bucket.

Global service events (IAM, Route53) are logged in one region regardless — must enable "global service events" in your trail.

---

**Q8: How do you ensure CloudTrail logs cannot be tampered with?**

A: Multiple layers:
1. Enable log file validation (SHA-256 hashes in digest files)
2. S3 Object Lock on the trail bucket (WORM storage)
3. S3 versioning (deleted objects are preserved as versions)
4. Store trail bucket in a separate AWS account
5. Restrict IAM permissions — nobody except security team can delete from trail bucket
6. Enable MFA Delete on the S3 bucket

---

**Q9: What is the retention period for CloudTrail Event History?**

A: CloudTrail Event History retains events for **90 days** for free, without configuring a trail. After 90 days, events are deleted. To retain beyond 90 days, configure a Trail that delivers to S3, where you control retention indefinitely.

---

**Q10: You need to audit all API activity across 50 AWS accounts. What do you recommend?**

A: Create an **Organization Trail** from the AWS Organizations management account:
1. Enable AWS Organizations
2. Create a trail in the management account with "Apply to all accounts in my organization"
3. All 50 member accounts send logs to a central S3 bucket in the management account
4. Member accounts cannot disable or modify the organization trail
5. Use Athena with partitioning for efficient querying across all accounts
6. Consider using AWS Security Hub or SIEM tools for analysis

---

*End of CloudTrail Complete Guide*
