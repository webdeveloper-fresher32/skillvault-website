# Advanced AWS Security Services — Complete Guide

## Table of Contents
1. [GuardDuty](#1-guardduty)
2. [WAF (Web Application Firewall)](#2-waf)
3. [Shield](#3-shield)
4. [Macie](#4-macie)
5. [Inspector](#5-inspector)
6. [Security Hub](#6-security-hub)
7. [Firewall Manager](#7-firewall-manager)
8. [IAM Access Analyzer](#8-iam-access-analyzer)
9. [ACM (Certificate Manager)](#9-acm)
10. [Secrets Manager vs Parameter Store](#10-secrets-manager-vs-parameter-store)
11. [Interview Q&A](#interview-qa)

---

## 1. GuardDuty

### What It Is
Amazon GuardDuty is a managed threat detection service that continuously analyzes AWS CloudTrail logs, VPC Flow Logs, DNS query logs, and Kubernetes audit logs to identify malicious activity and unauthorized behavior.

**No agents to install. No data to store. Enable with one click.**

### How It Works
GuardDuty analyzes:
- **CloudTrail management events:** API calls, console sign-ins, IAM changes
- **CloudTrail data events (S3 and Lambda):** Object-level S3 activity, Lambda function invocations
- **VPC Flow Logs:** Network traffic patterns
- **DNS logs:** Domain name resolution (unusual domains, data exfiltration via DNS)
- **EKS audit logs:** Kubernetes API server activity
- **RDS login activity** (newer feature)
- **Runtime monitoring** (EC2/ECS/EKS agent-based behavioral analysis)

GuardDuty uses ML models trained on AWS global threat intelligence, known malicious IPs, known C2 domains, and anomaly detection on your specific environment baseline.

### Finding Types

**Recon (Reconnaissance):**
- `Recon:EC2/PortProbeUnprotectedPort` — port scan detected on EC2
- `Recon:IAMUser/MaliciousIPCaller` — API calls from known malicious IP
- `Recon:EC2/Portscan` — EC2 performing port scan

**Persistence (Unauthorized access):**
- `UnauthorizedAccess:IAMUser/ConsoleLoginSuccess` — unusual console login
- `UnauthorizedAccess:EC2/TorIPCaller` — API call from Tor exit node
- `UnauthorizedAccess:IAMUser/UnusualASNCaller` — call from unusual autonomous system

**Privilege Escalation:**
- `PrivilegeEscalation:IAMUser/AdministrativePermissions` — user adding admin permissions to themselves
- `PrivilegeEscalation:Kubernetes/PrivilegedContainer` — container with excessive privileges

**Cryptomining:**
- `CryptoCurrency:EC2/BitcoinTool.B` — EC2 querying Bitcoin-related domain
- `CryptoCurrency:EC2/BitcoinTool.B!DNS` — DNS lookups to mining pool domains

**Exfiltration:**
- `Exfiltration:S3/ObjectRead.Unusual` — unusual S3 read volume
- `Exfiltration:IAMUser/AnomalousBehavior` — unusual data access patterns

**Backdoor:**
- `Backdoor:EC2/C&CActivity.B` — EC2 communicating with C2 server
- `Backdoor:Lambda/C&CActivity.B` — Lambda making outbound calls to C2

### Finding Severity
| Severity | Score | Meaning | SLA |
|----------|-------|---------|-----|
| Critical | 9.0–10.0 | Immediate threat, active compromise | Minutes |
| High | 7.0–8.9 | Significant risk, likely compromise | Hours |
| Medium | 4.0–6.9 | Suspicious activity worth investigating | Days |
| Low | 1.0–3.9 | Unusual but low risk | Review periodically |

### Multi-Account with AWS Organizations
```
GuardDuty in Organizations:
  Delegated Administrator account (security account)
  └── Manages all member accounts centrally
  └── Sees findings from all accounts in one place
  └── Can auto-enable for new accounts
  └── Members cannot disable GuardDuty

Setup:
  1. Enable Organizations in management account
  2. Designate Security account as GuardDuty Admin
  3. GuardDuty Admin auto-enables all existing accounts
  4. New accounts auto-enabled via configuration
```

### EventBridge Remediation
GuardDuty publishes findings as EventBridge events within 5 minutes of detection.

```json
// EventBridge rule to catch GuardDuty findings
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": {
    "severity": [{"numeric": [">=", 7]}]
  }
}
```

**Automated Remediation Examples:**
```
High-severity finding → SNS → PagerDuty alert

CryptoCurrency finding → Lambda:
  1. Quarantine EC2 instance (new security group with no egress)
  2. Create EBS snapshot for forensics
  3. Post to Slack #security channel
  4. Create JIRA ticket
  5. Notify SOC team via SNS

UnauthorizedAccess:IAMUser finding → Lambda:
  1. Disable IAM user access keys
  2. Detach IAM policies
  3. Revoke active sessions
  4. Notify user's manager
```

```python
# Lambda remediation for compromised EC2
import boto3

def handler(event, context):
    ec2 = boto3.client('ec2')
    finding = event['detail']
    
    instance_id = finding['resource']['instanceDetails']['instanceId']
    region = finding['region']
    
    # Create isolation security group (no ingress, no egress)
    vpc_id = finding['resource']['instanceDetails']['networkInterfaces'][0]['vpcId']
    sg = ec2.create_security_group(
        GroupName=f'QUARANTINE-{instance_id}',
        Description=f'Quarantine SG for GuardDuty finding {finding["id"]}',
        VpcId=vpc_id
    )
    
    # Replace instance's security groups with quarantine SG
    ec2.modify_instance_attribute(
        InstanceId=instance_id,
        Groups=[sg['GroupId']]
    )
    
    # Create forensic snapshot
    volumes = ec2.describe_instance_attribute(
        InstanceId=instance_id,
        Attribute='blockDeviceMapping'
    )
    for bdm in volumes['BlockDeviceMappings']:
        ec2.create_snapshot(
            VolumeId=bdm['Ebs']['VolumeId'],
            Description=f'Forensic snapshot - GuardDuty finding {finding["id"]}'
        )
```

---

## 2. WAF

### What It Is
AWS WAF (Web Application Firewall) is a Layer 7 firewall that protects web applications from common exploits. It inspects HTTP/HTTPS request content and applies rules to allow, block, or count requests.

### Where You Attach WAF (Web ACL)
- CloudFront distribution (global, low-latency inspection at edge)
- Application Load Balancer (regional)
- API Gateway REST API (regional)
- AppSync GraphQL API
- Cognito User Pool

### Web ACL (Access Control List)
A Web ACL contains:
- **Rules** — evaluated in priority order
- **Default action** — Allow or Block if no rule matches
- **Rule groups** — collections of rules (AWS Managed or custom)
- **Capacity** — each rule consumes Web ACL Capacity Units (WCUs), max 5,000

### Rule Types

**1. AWS Managed Rule Groups (zero-configuration protection):**
```
Free:
  AWSManagedRulesCommonRuleSet      — OWASP Top 10 (SQLi, XSS, etc.)
  AWSManagedRulesKnownBadInputsRuleSet — Log4j, SSI, SSRF inputs
  AWSManagedRulesAmazonIpReputationList — Malicious IPs from AWS TI
  AWSManagedRulesAnonymousIpList    — Tor, proxies, anonymizers

Paid:
  AWSManagedRulesLinuxRuleSet       — Linux-specific exploits
  AWSManagedRulesSQLiRuleSet        — SQL injection patterns
  AWSManagedRulesBotControlRuleSet  — Bot detection (paid)
  AWSManagedRulesFraudControlAccountTakeover — Credential stuffing
```

**2. Rate-Based Rules:**
```json
{
  "Name": "RateLimitRule",
  "Priority": 10,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 2000,        // Max requests per 5-minute window per IP
      "AggregateKeyType": "IP"
    }
  },
  "Action": {"Block": {}},
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "RateLimitRule"
  }
}
```

**3. Custom Rules:**
```
Inspect on: URI path, query string, header, body, HTTP method, IP, country

Examples:
  Block: requests with User-Agent containing "sqlmap"
  Block: requests to /admin from non-corporate IP ranges
  Allow: requests from specific IP allowlist
  Block: requests with >8KB body (block large payloads)
  Count: specific bot signatures (for analysis before blocking)
```

### Rule Actions
- **Allow** — forward to origin
- **Block** — return 403 (customizable response body)
- **Count** — let through but increment counter (useful for testing rules before blocking)
- **CAPTCHA** — present CAPTCHA challenge
- **Challenge** — silent browser challenge (JavaScript execution check)

### WAF Logging
```
Send WAF logs to:
  - CloudWatch Logs (near-real-time)
  - S3 (batch delivery, cheaper for long-term)
  - Kinesis Data Firehose (real-time, can transform and deliver to multiple destinations)

Log name must start with: aws-waf-logs-

Log includes for each request:
  - Timestamp, client IP, country
  - URI, host, headers
  - Matching rule(s) and action taken
  - Request sampling (1 in 1000 by default for ALLOW, all for BLOCK)
```

### WAF + CloudFront Pattern
```
Internet users → CloudFront → WAF inspection → Origin (ALB)

Benefits:
  - WAF runs at edge (400+ PoPs) — blocks before reaching your VPC
  - Global rate limiting per IP
  - Geo-blocking: block specific countries at edge
  - Free data transfer from CloudFront to origin after WAF allows

Common rule set for public API:
  Priority 1:  IP Allowlist (trusted partners) → Allow
  Priority 2:  IP Blocklist (known bad actors) → Block
  Priority 3:  Rate limit (2000 req/5min per IP) → Block
  Priority 4:  Geo-block (countries with no legitimate users) → Block
  Priority 5:  AWS Common Managed Rules → Block
  Priority 6:  SQL injection rules → Block
  Default: Allow
```

---

## 3. Shield

### Shield Standard
- **Cost:** Free for all AWS customers
- **Protection:** Automatic Layer 3 and 4 DDoS protection
- **What it blocks:** SYN floods, UDP reflection attacks, volumetric attacks
- **Coverage:** All AWS resources automatically
- **No configuration required**

### Shield Advanced
- **Cost:** $3,000/month per organization (not per account) + data transfer out fees
- **Commitment:** 1-year subscription
- **Protection:** Layer 3, 4, AND Layer 7 DDoS protection

**What you get beyond Standard:**

| Feature | Shield Advanced |
|---------|----------------|
| 24/7 DDoS Response Team (DRT) | Yes — AWS experts engage during attacks |
| Financial protection | Cost protection for scaling charges during DDoS |
| Advanced attack visibility | CloudWatch metrics with detailed DDoS insights |
| Attack diagnostics | Real-time DDoS visibility |
| Proactive engagement | AWS contacts you if they detect attack |
| WAF integration | Free WAF during attack (normally paid) |
| Application layer (L7) protection | Yes (requires WAF) |
| Protected resources | EC2, ELB, CloudFront, Route53, Global Accelerator |
| SLA | Response SLAs for DRT engagement |

### Shield Advanced Cost Protection
```
During a DDoS attack, your infrastructure may auto-scale (EC2, 
data transfer costs spike). Shield Advanced reimburses scaling 
charges that result directly from DDoS attacks.

Claim process:
  1. Attack detected and mitigated
  2. Submit credit request via AWS Support
  3. AWS reviews CloudWatch metrics + Shield event data
  4. Credit applied to account

Example: 100GB DDoS attack hits CloudFront
  Normal data transfer cost: ~$9
  Attack-driven spike: 10TB = $900
  Shield Advanced rebates the abnormal spike: $891 credit
```

### Who Should Use Shield Advanced
- High-profile public-facing services
- Financial services, gaming, media streaming
- Any service where downtime has significant revenue impact
- Organizations subject to targeted attacks
- Services already using WAF (WAF cost is free with Shield Advanced)

---

## 4. Macie

### What It Is
Amazon Macie is a data security service that uses ML to automatically discover, classify, and protect sensitive data stored in Amazon S3.

### What Macie Detects
**PII (Personally Identifiable Information):**
- Full name, email address, phone number
- Physical address, date of birth, age
- Driver's license number, passport number
- SSN (US Social Security Number)
- National ID numbers (multiple countries)

**Financial:**
- Credit card numbers (all major brands)
- Bank account numbers, routing numbers
- AWS access keys and secret keys

**Healthcare:**
- Medical record numbers
- Health information (PHI/ePHI under HIPAA)
- Drug prescription information

**Credentials:**
- AWS credentials
- Private keys, certificates
- Passwords in configuration files

### How Macie Works
```
Configuration:
  1. Enable Macie (per-region service)
  2. Designate S3 buckets for analysis
  3. Create Sensitive Data Discovery jobs:
     - One-time: scan specific buckets
     - Scheduled: recurring (daily/weekly/monthly)

Analysis types:
  - Automated discovery: continuous, lightweight analysis of all S3 objects
  - Sensitive data discovery jobs: deep scanning of specific buckets/prefixes

Output:
  - Findings in Macie console
  - Findings published to EventBridge
  - Export to Security Hub
  - S3 bucket for findings data (if configured)
```

### Macie Findings
```
Policy findings (configuration issues):
  Policy:IAMUser/S3BlockPublicAccessDisabled — bucket public access re-enabled
  Policy:IAMUser/S3BucketEncryptionDisabled — encryption disabled
  Policy:IAMUser/S3BucketPublic — bucket is publicly accessible
  Policy:IAMUser/S3BucketSharedExternally — bucket shared outside org

Sensitive data findings:
  SensitiveData:S3Object/Personal — PII detected
  SensitiveData:S3Object/Financial — financial data detected
  SensitiveData:S3Object/Credentials — credentials detected
  SensitiveData:S3Object/Multiple — multiple sensitive data types
```

### Multi-Account with Organizations
```
Macie in Organizations:
  Delegated Administrator (security account):
    - Enables Macie for all member accounts
    - Aggregated view of all findings
    - Centralized policy control
    - Members cannot disable their own Macie
```

### Compliance Use Cases
- **GDPR:** Prove you know where personal data is stored across all S3 buckets
- **PCI-DSS:** Ensure credit card data is not stored in unencrypted or public buckets
- **HIPAA:** Discover PHI in S3 and ensure appropriate controls
- **Data residency:** Verify sensitive data stays in correct regions

---

## 5. Inspector

### What It Is
Amazon Inspector is an automated vulnerability management service that continuously scans EC2 instances, Lambda functions, and container images in ECR for software vulnerabilities and network exposure.

### What Inspector Scans

**EC2 Instances:**
- OS package vulnerabilities (CVEs) using Systems Manager agent
- Network reachability: identifies paths from internet to EC2 (open ports, security group misconfigurations)
- Requires SSM Agent installed on EC2

**ECR Container Images:**
- OS package vulnerabilities in the base image
- Programming language package vulnerabilities (npm, pip, maven, etc.)
- Scans automatically when pushed to ECR and continuously re-evaluates as new CVEs are published

**Lambda Functions:**
- Vulnerabilities in Lambda function code packages
- Checks all Lambda layers and dependencies
- Language packages: Python (pip), JavaScript (npm), Java (maven)

### Continuous Scanning
```
Inspector v2 is continuous, not point-in-time:

  New CVE published → Inspector automatically re-evaluates
                       all existing resources against new CVE

  This means a finding can appear today for an EC2 instance
  that was last patched 6 months ago, because a new CVE was
  published today covering a package installed 6 months ago.

  Contrast with point-in-time scan: you'd only see this if
  you ran a new scan manually.
```

### Finding Severity (CVSS-based)
| Severity | CVSS Score | Action |
|----------|-----------|--------|
| Critical | 9.0–10.0 | Patch within 24-48 hours |
| High | 7.0–8.9 | Patch within 7 days |
| Medium | 4.0–6.9 | Patch within 30 days |
| Low | 0.1–3.9 | Patch in next maintenance window |
| Informational | N/A | Track, no immediate action |

Inspector uses a combined score considering: CVSS base score + network reachability (is the vulnerable port exposed to internet?) + software exploitability data.

### Security Hub Integration
```
Inspector → Security Hub:
  All Inspector findings sent to Security Hub automatically
  Aggregated with findings from GuardDuty, Macie, Config, etc.
  Normalized to ASFF (Amazon Security Finding Format)
  Single pane of glass for all security findings

Inspector → EventBridge:
  Automate responses to new findings
  Example: Critical CVE in production ECR image →
    Block image from ECS deployment
    Create Jira ticket
    Notify security team via PagerDuty
```

### ECR Integration Pattern
```
Developer pushes image → ECR
                           │
                           ▼ Inspector scans image
                           │
          Findings? ───────┤
          Critical CVE     │ Clean
               │           │
               ▼           ▼
          Block deploy    Allow deploy
          (via ECR policy)
          Notify team
```

---

## 6. Security Hub

### What It Is
AWS Security Hub provides a comprehensive view of your security state in AWS by aggregating, organizing, and prioritizing security alerts (findings) from multiple AWS services and third-party partners.

### What Feeds Security Hub
**Native AWS services:**
- GuardDuty (threat detection findings)
- Inspector (vulnerability findings)
- Macie (sensitive data findings)
- Firewall Manager (WAF, Shield policy violations)
- IAM Access Analyzer (oversharing findings)
- Config (compliance findings)
- Systems Manager Patch Manager

**Third-party integrations (examples):**
- CrowdStrike, Palo Alto Networks, Check Point
- Splunk, Sumo Logic
- Qualys, Rapid7

### Security Standards (Automated Compliance Checks)
Security Hub runs continuous automated checks against security standards:

**1. AWS Foundational Security Best Practices (FSBP):**
- 300+ controls across IAM, EC2, S3, RDS, Lambda, etc.
- Example checks: "S3 buckets should block public access", "MFA should be enabled for root"

**2. CIS AWS Foundations Benchmark:**
- Level 1 (basic): 43 controls
- Level 2 (advanced): Additional controls
- Industry-standard baseline for AWS security

**3. PCI DSS:**
- Payment Card Industry compliance checks
- Required for organizations processing card payments

**4. NIST SP 800-53:**
- Federal government compliance framework

### Findings Aggregation — Cross-Account and Cross-Region
```
Security Hub architecture in an Organization:

Management Account
└── Security Account (delegated administrator)
    └── Aggregation region: us-east-1
        ├── ap-southeast-2 findings → aggregated
        ├── eu-west-1 findings → aggregated
        └── us-east-1 local findings

All member accounts send findings to Security Account
Cross-region aggregation: findings from all regions 
consolidated in one aggregation region

Result: Security team sees all findings from all accounts
        and regions in one Security Hub dashboard
```

### Finding Workflow
```
New finding arrives in Security Hub:
  Status: NEW
    │
    ▼ Security analyst reviews
  Status: NOTIFIED (team informed)
    │
    ▼ Investigation/remediation
  Status: IN_PROGRESS
    │
    ├── Resolved → Status: RESOLVED
    └── False positive → Status: SUPPRESSED
                         (won't appear in active findings)

Automated workflow rules:
  EventBridge rule on Security Hub finding →
    Lambda creates Jira ticket with finding details
    Sets finding status to NOTIFIED
```

### Custom Actions
Security Hub Custom Actions let you trigger responses from the console:
```
Example: Select finding → Actions → "Quarantine EC2"
  → EventBridge event fired
  → Lambda quarantines the instance
  → Finding noted as IN_PROGRESS

Built-in action: Send finding to Slack channel
Built-in action: Escalate to PagerDuty
Built-in action: Create remediation ticket
```

---

## 7. Firewall Manager

### What It Is
AWS Firewall Manager is a centralized security management service that allows you to configure and manage WAF rules, Shield Advanced protections, Security Groups, and Network Firewall policies across all accounts and resources in your AWS Organization.

### What Firewall Manager Manages
- **WAF policies:** Deploy the same WAF Web ACL to all ALBs/CloudFronts/API Gateways across all accounts
- **Shield Advanced:** Enroll all accounts in Shield Advanced automatically
- **Security Groups:** Common security group rules applied across all VPCs
- **Network Firewall:** Centralized network firewall policies
- **DNS Firewall:** Route53 Resolver DNS Firewall rules

### Why It Matters
Without Firewall Manager:
- Team A deploys an ALB without WAF — vulnerable to SQLi
- New AWS account created — no WAF on any resources
- Security team must audit each account manually

With Firewall Manager:
- Policy: "Every ALB must have WAF Web ACL X"
- Firewall Manager automatically applies to existing and NEW ALBs
- Non-compliant resources flagged in Security Hub
- Auto-remediation: automatically creates and attaches WAF to any unprotected ALB

### Policy Types Example
```
WAF Policy:
  Name: "Common-WAF-Policy"
  Scope: All accounts in Organization
  Resource type: ALB
  Web ACL: CommonRuleSet (includes OWASP rules, rate limiting)
  Action on non-compliant: Auto-remediate (attach Web ACL)

Security Group Policy:
  Name: "Block-SSH-From-Internet"
  Scope: All accounts in Production OU
  Rule: Deny inbound port 22 from 0.0.0.0/0
  Action: Auto-remediate (remove the rule if found)
```

### Prerequisites
- AWS Organizations enabled
- Firewall Manager delegated administrator designated (security account)
- Shield Advanced subscription (for Shield policies)

---

## 8. IAM Access Analyzer

### What It Is
AWS IAM Access Analyzer identifies resources in your account or organization that are shared with external entities (other AWS accounts, the internet, specific services). It also provides policy validation and policy generation capabilities.

### Finding Types

**External Access Findings:**
IAM Access Analyzer continuously analyzes resource-based policies (S3 bucket policies, KMS key policies, SQS queue policies, Lambda resource policies, etc.) and alerts when a resource is accessible from outside your Zone of Trust (your account or Organization).

```
Finding examples:
  S3 bucket "my-data-bucket" allows access to account 999999999999 (external)
  KMS key policy allows Principal * (internet-accessible)
  SQS queue allows SendMessage from arn:aws:iam::999999999:root
  Lambda function allows invoke from all accounts
```

**Unused Access Findings:**
- Unused IAM roles (roles not used in the past 90 days)
- Unused access keys (keys not used recently)
- Unused permissions (permissions in a policy that have never been used)

### Policy Validation
```
Before applying a new IAM policy, validate it:

aws accessanalyzer validate-policy \
  --policy-document file://my-policy.json \
  --policy-type IDENTITY_POLICY

Checks for:
  - Security warnings (e.g., wildcard actions with wildcard resources)
  - Errors (malformed policy)
  - Suggestions (simplifications)
  - General warnings

Example warning:
  "Using wildcards (*) in the Action element with certain services can
   be overly permissive. Consider specifying individual actions."
```

### Policy Generation
```
How it works:
  1. Enable CloudTrail (required)
  2. IAM principal performs actions for X days (learning period)
  3. Access Analyzer generates a least-privilege policy based on
     actual observed CloudTrail activity

aws accessanalyzer start-policy-generation \
  --policy-generation-details '{"principalArn": "arn:aws:iam::123456789:role/MyRole"}' \
  --cloudtrail-details '{"startTime": "2024-01-01", "trailArn": "arn:..."}'

Result: A policy with exactly the permissions the role actually used
        (remove unused permissions)
```

### Zones of Trust
```
Analyzers are created with a Zone of Trust:

  Account-level analyzer:
    Zone of Trust = current AWS account
    Alert if resource shared OUTSIDE this account
    (including other AWS accounts, even within org)

  Organization-level analyzer:
    Zone of Trust = entire AWS Organization
    Alert if resource shared OUTSIDE organization
    (internal sharing within org is OK)

Recommendation: Create Organization-level analyzer in security account
```

---

## 9. ACM

### What It Is
AWS Certificate Manager (ACM) provides free, auto-renewing SSL/TLS certificates for use with AWS services.

### Key Features

**Free SSL Certificates:**
- Public trusted certificates (signed by Amazon Trust Services — trusted by all browsers)
- For custom domains you own
- Validated via DNS or email validation

**Auto-Renewal:**
- ACM automatically renews certificates before expiry (typically 60 days before)
- No manual certificate management
- Renewal is automatic if DNS validation is configured and DNS record is present

### Supported Services (Where ACM Certificates Can Be Attached)
- **CloudFront** — HTTPS for CloudFront distributions
- **Application Load Balancer (ALB)** — HTTPS listener
- **API Gateway** — custom domain HTTPS
- **Elastic Beanstalk** — HTTPS for Beanstalk environments
- **CloudFormation** — reference in resource definitions

**NOT supported (cannot export private key):**
- EC2 instances directly
- Non-AWS services
- On-premises servers

### Cannot Export Private Key
```
Critical limitation: ACM certificates cannot have their private key exported.
You cannot download the certificate and private key to use elsewhere.

Why: This prevents key theft and ensures keys are only used in AWS services.

Workaround: If you need a certificate for EC2 or non-AWS services:
  Option 1: Use ACM Private CA (paid) → export private key
  Option 2: Use Let's Encrypt (free, you manage renewal)
  Option 3: Purchase from third-party CA
```

### DNS Validation vs Email Validation
```
DNS Validation (preferred):
  - Add CNAME record to your domain's DNS
  - Works with Route 53 (one-click automation)
  - Persists → auto-renewal works automatically
  - No action needed at renewal time

Email Validation:
  - AWS sends email to domain admin addresses
  - Requires human to click approval link
  - Must re-approve at renewal → can lead to expiry if missed
  - Use only when DNS access is restricted
```

### ACM Private CA
- For internal certificates (not browser-trusted by default)
- Can create custom certificate hierarchies
- Private key can be exported (unlike public ACM certificates)
- Cost: ~$400/month per CA

---

## 10. Secrets Manager vs Parameter Store

### Overview

| Feature | Secrets Manager | Systems Manager Parameter Store |
|---------|----------------|--------------------------------|
| **Purpose** | Secrets management with rotation | Configuration and secret storage |
| **Cost** | $0.40/secret/month + API calls | Free tier (Standard); $0.05/10K API calls (Advanced) |
| **Auto-rotation** | Built-in (Lambda-based) | Not built-in (requires custom Lambda) |
| **Versioning** | Yes | Yes (up to 100 versions) |
| **Cross-region** | Replication to multiple regions | Not built-in |
| **Max value size** | 65KB | 4KB (Standard), 8KB (Advanced) |
| **KMS integration** | Yes (SSE with KMS) | Yes (SecureString type with KMS) |
| **IAM access control** | Resource-level policies + IAM | IAM only |
| **CloudFormation** | `resolve:secretsmanager:` | `resolve:ssm:` or `resolve:ssm-secure:` |
| **ECS secrets injection** | Yes | Yes (SecureString) |
| **Lambda environment** | Yes (SDK call) | Yes (SDK call) |
| **Parameter hierarchy** | No | Yes (`/app/prod/db-password`) |

### Secrets Manager — When to Use
```
Best for:
  - Database credentials (RDS, Aurora, Redshift, DocumentDB, others)
  - API keys for third-party services
  - Any secret requiring automatic rotation
  - Secrets shared across multiple regions
  - When you need automatic rotation without custom code

Auto-rotation support:
  - Amazon RDS (MySQL, PostgreSQL, Oracle, SQL Server, MariaDB)
  - Amazon Aurora
  - Amazon Redshift
  - Amazon DocumentDB
  - Custom (via Lambda function template)

Example rotation workflow:
  1. EventBridge triggers rotation Lambda every N days
  2. Lambda creates new DB password
  3. Lambda updates RDS password
  4. Lambda updates secret with new password
  5. Lambda tests new credentials work
  6. Old password invalidated (after stabilization period)
```

### Parameter Store — When to Use
```
Best for:
  - Application configuration values
  - Feature flags
  - Environment-specific settings (non-sensitive)
  - Secrets where cost is a concern
  - Hierarchical configuration with access by path

Types:
  String       - plain text, unencrypted (e.g., "production")
  StringList   - comma-separated values
  SecureString - encrypted with KMS (use for passwords/API keys)

Path hierarchy example:
  /myapp/prod/db-host
  /myapp/prod/db-port
  /myapp/prod/db-name
  /myapp/prod/db-password  ← SecureString
  /myapp/staging/db-host
  /myapp/staging/db-password

Get all parameters for prod:
  aws ssm get-parameters-by-path --path /myapp/prod --with-decryption
```

### Application Code Patterns
```python
# Secrets Manager
import boto3
import json

def get_db_credentials():
    client = boto3.client('secretsmanager', region_name='ap-southeast-2')
    response = client.get_secret_value(SecretId='prod/myapp/db-credentials')
    secret = json.loads(response['SecretString'])
    return secret['username'], secret['password']

# Cache the secret — avoid calling API on every request
# Use SecretId with version stage (AWSCURRENT = latest, AWSPREVIOUS = before rotation)
```

```python
# Parameter Store
import boto3

def get_config():
    ssm = boto3.client('ssm', region_name='ap-southeast-2')
    
    # Get all params under a path
    response = ssm.get_parameters_by_path(
        Path='/myapp/prod',
        WithDecryption=True,  # Decrypt SecureString params
        Recursive=True
    )
    
    config = {}
    for param in response['Parameters']:
        key = param['Name'].split('/')[-1]
        config[key] = param['Value']
    
    return config
```

### Decision Framework
```
Use Secrets Manager if:
  ✓ You need automatic rotation
  ✓ It's a database credential
  ✓ You need cross-region replication
  ✓ You need secrets at scale (many microservices)
  ✓ Cost is not a primary concern

Use Parameter Store if:
  ✓ Storing application configuration (non-sensitive)
  ✓ Cost optimization (Standard tier is free)
  ✓ You need hierarchical path-based access
  ✓ You need SecureString but don't need rotation
  ✓ Simple key-value config shared across apps
```

---

## Interview Q&A

**Q1: What is GuardDuty and how does it differ from a traditional IDS/IPS?**

A: GuardDuty is a managed threat detection service that analyzes CloudTrail, VPC Flow Logs, and DNS logs using ML and threat intelligence. Traditional IDS/IPS requires deploying agents or network taps, managing signature databases, and ongoing tuning. GuardDuty has no agents, no traffic to route through an appliance — it analyzes existing log streams. It uses AWS-global threat intelligence (IPs seen attacking AWS infrastructure across all customers) that no single organization could develop independently. Findings are contextualized to your specific environment baseline, reducing false positives compared to signature-only detection.

---

**Q2: How does AWS WAF protect against SQL injection?**

A: WAF includes managed rule groups (AWSManagedRulesSQLiRuleSet) that contain regex patterns and byte match statements targeting known SQL injection patterns in request components (URI, query strings, headers, body). It inspects: `'` `OR 1=1` `UNION SELECT` `'; DROP TABLE` patterns. WAF operates at Layer 7 — it reads the HTTP request body. The ALB or CloudFront sends the request to WAF for inspection before forwarding to origin. If SQLi pattern is matched, WAF returns a 403 block response without the request ever reaching your application. Best practice: use managed rules + Rate-based rules + custom rules for your specific application.

---

**Q3: What is the difference between Shield Standard and Shield Advanced? Who needs Advanced?**

A: Shield Standard is free, automatic Layer 3/4 protection for all AWS resources — it blocks volumetric attacks (SYN floods, UDP reflection). Shield Advanced adds: 24/7 DDoS Response Team access, Layer 7 (application layer) DDoS mitigation, detailed attack metrics, proactive engagement, and financial cost protection for scaling charges during attacks. Cost is $3,000/month per organization. Advanced is for organizations that: are high-profile attack targets (gaming, financial, media), have revenue directly tied to availability, need the DRT to engage during active attacks, or want cost protection against unexpected scaling bills from DDoS.

---

**Q4: How does Macie help with GDPR compliance?**

A: GDPR requires organizations to know where personal data is stored and ensure it's appropriately protected. Macie automatically scans all S3 buckets to discover PII (names, emails, addresses, national ID numbers, etc.) and reports findings. This addresses GDPR Article 30 (records of processing activities). Macie also detects policy violations like public buckets containing sensitive data — critical because GDPR requires appropriate security measures. The findings can feed into a data catalog, helping data protection officers answer "where is our customer data?" and "is it encrypted and access-controlled?".

---

**Q5: How does Inspector differ from traditional vulnerability scanning?**

A: Traditional scanners run on-demand or on schedule and only show vulnerabilities at the point of the scan. Inspector v2 is continuous — when a new CVE is published, Inspector automatically re-evaluates all existing resources against the new CVE without running a new scan. Inspector also adds network reachability analysis for EC2: a vulnerability on a port not reachable from the internet is lower priority than the same vulnerability on an internet-exposed port. For ECR, Inspector scans images at push time and re-evaluates them when new CVEs are published — a clean image today can become a finding tomorrow if a new CVE covers one of its packages.

---

**Q6: What is Security Hub and how do findings flow into it?**

A: Security Hub is a centralized security findings aggregation and management service. AWS security services (GuardDuty, Inspector, Macie, Firewall Manager, IAM Access Analyzer, Config) automatically send findings to Security Hub in a standard format called ASFF (Amazon Security Finding Format). Security Hub also checks your environment against security standards (CIS, PCI-DSS, AWS FSBP). In an Organization, a delegated administrator account in a single region can see findings from all accounts and all regions (with cross-region aggregation). This enables a security team to have one dashboard for the entire organization instead of logging into hundreds of accounts.

---

**Q7: What is IAM Access Analyzer policy generation and when would you use it?**

A: Policy generation analyzes CloudTrail logs for a specified IAM principal over a time period and generates a least-privilege policy reflecting the actions the principal actually performed. Use it when: (1) An application or role was deployed with overly broad permissions ("just made it work") and you need to tighten them. (2) You're refactoring an application and want to document what IAM permissions it actually needs. (3) As part of a security review, you want to identify unused permissions. After generation, review the output carefully — it reflects observed behavior during the capture period only. If the application has infrequent code paths (monthly reports, disaster recovery actions), those won't appear in the generated policy.

---

**Q8: Why can't you export the private key from an ACM certificate? What are the implications?**

A: ACM's design intentionally prevents private key export to ensure keys are protected by AWS's key management infrastructure and never exist in plaintext outside AWS. This means ACM certificates can only be used directly with AWS services (CloudFront, ALB, API Gateway). You cannot install them on EC2 web servers, Nginx, Apache, or non-AWS services. Implications: For EC2-hosted websites, you must use Let's Encrypt (Certbot), ACM Private CA with the export option, or a third-party certificate. For fully-managed AWS architectures using ALB → EC2 (SSL terminates at ALB), ACM is perfect — the EC2 instances only handle HTTP internally.

---

**Q9: When should you use Secrets Manager over Parameter Store, and vice versa?**

A: Use Secrets Manager when you need automatic credential rotation — it has native support for rotating RDS, Aurora, Redshift, and DocumentDB passwords on a schedule. Also use it when you need cross-region secret replication and when the secret is high-value (database credentials, OAuth tokens). Use Parameter Store when storing application configuration values (non-sensitive or low-sensitivity), when you need hierarchical path-based organization (`/app/prod/config`), when cost is a concern (Standard tier is free), or when you need simple string configuration without rotation. Many organizations use both: Secrets Manager for credentials, Parameter Store for config.

---

**Q10: How do GuardDuty, Security Hub, and EventBridge work together for automated remediation?**

A: GuardDuty detects a threat (e.g., EC2 communicating with a C2 server) and creates a finding. It publishes that finding to EventBridge in near-real-time (within 5 minutes for new finding types, 6 hours for updates). An EventBridge rule matches on the finding type and severity. The rule triggers a Lambda function with the finding details. Lambda performs automated remediation: isolates the EC2 instance (replaces security groups), creates an EBS snapshot for forensics, notifies the security team via SNS/Slack, and creates a ticket in Jira. Security Hub is also notified (GuardDuty → Security Hub), where the analyst can track the finding's workflow status.

---

**Q11: What is AWS Firewall Manager and why is it needed in large organizations?**

A: Firewall Manager provides centralized management of WAF, Shield, Security Groups, and Network Firewall policies across all accounts in an AWS Organization. Without it, a large organization (50+ AWS accounts) would need to manually ensure WAF is applied to every ALB in every account — a human process error-prone and unscalable. With Firewall Manager: define a policy once ("all ALBs must have this WAF Web ACL"), and it automatically applies to existing and newly created ALBs across all accounts. Non-compliant resources are flagged in Security Hub. Auto-remediation can automatically create and attach WAF without human intervention.

---

**Q12: How do you prevent hardcoded credentials in application code?**

A: Multiple layers of prevention: (1) **Code scanning:** Use pre-commit hooks (git-secrets, detect-secrets) to block commits containing credential patterns. (2) **SAST/secret scanning in CI:** GitHub's secret scanning, Snyk, or Semgrep in your CI pipeline. (3) **IAM roles instead of keys:** Applications running on EC2, Lambda, ECS should use IAM roles — credentials are injected automatically, no hardcoding possible. (4) **Secrets Manager/Parameter Store:** For third-party API keys, store in Secrets Manager and retrieve at runtime. (5) **AWS Config rule:** `no-unrestricted-actions` detects IAM policies with wildcards. (6) **Training:** Developer awareness — understanding why hardcoding is dangerous (GitHub history scans, leaked access to all environments).

---

**Q13: What are the different types of GuardDuty findings you should alert on immediately?**

A: Immediately (Critical/High severity): `Backdoor:EC2/C&CActivity` — active malware communication; `CryptoCurrency:EC2/BitcoinTool` — cryptomining (indicates compromise); `Trojan:EC2/BlackholeTraffic` — EC2 communicating with known sinkholed domains; `UnauthorizedAccess:IAMUser/ConsoleLoginSuccess` from unusual location or without MFA; `Impact:S3/AnomalousBehavior.Delete` — mass S3 deletion (ransomware); `PrivilegeEscalation:IAMUser/AdministrativePermissions` — self-escalation. Medium severity (investigate same day): Port scanning findings (possible pre-attack reconnaissance), unusual API call patterns, calls from Tor exit nodes.

---

**Q14: How does ACM handle certificate renewal for certificates used on CloudFront?**

A: ACM automatically renews certificates it manages (typically starts renewal process 60 days before expiry). For DNS validation (which uses a CNAME record in Route 53 or another DNS provider), renewal is fully automatic — ACM verifies the CNAME record is still in place, generates a new certificate, and the renewal happens transparently without any action needed. CloudFront is automatically updated to the new certificate before the old one expires. For email validation, ACM sends renewal approval emails to the domain contact — if not responded to in time, the certificate expires. This is why DNS validation is strongly preferred for production certificates.

---

**Q15: A company needs to ensure no S3 bucket in any of its 200 AWS accounts is publicly accessible. How would you implement this?**

A: Defense in depth approach: (1) **AWS Organizations SCP:** Deny `s3:PutBucketPublicAccessBlock` with effect allowing Deny-Only mode, and deny `s3:PutBucketPolicy` that sets public access. Preventive control — stops violations before they occur. (2) **Account-level S3 Block Public Access:** Apply via CloudFormation StackSets across all accounts — enables account-level S3 public access block (overrides all bucket-level settings). (3) **Firewall Manager S3 policy:** Enforces S3 block public access settings across all accounts automatically. (4) **AWS Config Rule:** `s3-bucket-public-access-prohibited` — detects non-compliant buckets as a detective control. (5) **Macie:** Alerts on buckets that are publicly accessible and contain sensitive data.
