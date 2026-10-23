# Disaster Recovery on AWS — Complete Guide

## Table of Contents
1. [RTO and RPO Fundamentals](#rto-and-rpo-fundamentals)
2. [Cost of Downtime](#cost-of-downtime)
3. [DR Strategy 1: Backup and Restore](#dr-strategy-1-backup-and-restore)
4. [DR Strategy 2: Pilot Light](#dr-strategy-2-pilot-light)
5. [DR Strategy 3: Warm Standby](#dr-strategy-3-warm-standby)
6. [DR Strategy 4: Multi-Site Active-Active](#dr-strategy-4-multi-site-active-active)
7. [Comparison Table](#comparison-table)
8. [AWS Services for DR](#aws-services-for-dr)
9. [AWS Backup Service](#aws-backup-service)
10. [Interview Q&A](#interview-qa)

---

## RTO and RPO Fundamentals

### Recovery Time Objective (RTO)
**Definition:** The maximum acceptable time that a system or application can be offline after a disaster before business impact becomes unacceptable.

**In plain language:** "How long can we be down?"

**Examples:**
- E-commerce platform: RTO = 1 hour (every hour down = lost revenue)
- Internal HR system: RTO = 24 hours (business can function manually for a day)
- Stock trading system: RTO = 5 minutes (real-money operations, regulatory requirements)
- Hospital patient records: RTO = 15 minutes (patient safety implications)

**What affects RTO:**
- Time to detect the disaster (monitoring, alerting)
- Time to decide to invoke DR (runbook, approvals)
- Time to provision infrastructure (if not pre-provisioned)
- Time to restore data (from backup)
- Time to test and validate recovery
- Time to cut over traffic (DNS TTL, etc.)

### Recovery Point Objective (RPO)
**Definition:** The maximum acceptable amount of data loss measured in time. How old can your recovered data be?

**In plain language:** "How much data can we afford to lose?"

**Examples:**
- Online banking: RPO = 0 seconds (synchronous replication — zero data loss tolerated)
- E-commerce orders: RPO = 1 minute (lose at most 1 minute of orders — acceptable)
- Blog platform: RPO = 24 hours (content is created slowly, daily backup sufficient)
- Payment processor: RPO = 0 (regulatory: must not lose any transactions)

**What affects RPO:**
- Backup frequency (daily backup = up to 24h RPO)
- Replication type: synchronous (RPO=0, higher cost/latency) vs asynchronous (RPO=seconds/minutes, lower cost)
- Transaction log shipping frequency
- Replication lag (Aurora Global ~1 second, RDS Cross-Region replica seconds to minutes)

### Visualizing RTO and RPO

```
Timeline:

  Disaster        Detection    DR invoked    Recovery
  occurs             |             |         complete
     |               |             |             |
─────▼───────────────▼─────────────▼─────────────▼──────────→ time
     |                                           |
     |<────────── RTO ──────────────────────────>|
     |  Maximum acceptable downtime

     |
     ▼
  Last good
  backup/replica
     |
─────▼──────────────────────────────────────────────→ time
     |             Disaster occurs here
     |<──── RPO ──>|
     Maximum acceptable data loss
```

### RTO/RPO and the Four Strategies

```
         Low RPO                    High RPO
         (near-zero data loss)      (hours of data loss OK)
          │                              │
High RTO  │   Warm Standby          Backup & Restore
(hours)   │   (expensive but        (cheapest)
          │    not the cheapest)
          │
Low RTO   │   Multi-Site            Pilot Light
(minutes) │   Active-Active         (intermediate)
          │   (most expensive)
```

---

## Cost of Downtime

### The Business Case for DR Investment

Downtime has both direct and indirect costs:

**Direct costs:**
- Lost revenue during downtime
- Emergency response (overtime, external consultants)
- SLA penalties / credits to customers
- Recovery costs (data restoration, forensics)

**Indirect costs:**
- Customer churn (customers switch to competitors)
- Reputation damage
- Regulatory fines (especially for healthcare, finance)
- Employee productivity loss
- Brand damage and PR costs

### Example Calculation

```
Company: E-commerce platform
Average revenue: $10,000,000/year
Operating hours: 24x7 = 8,760 hours/year
Revenue per hour: $10,000,000 / 8,760 = ~$1,141/hour

Major outage scenarios:

Scenario 1: 4-hour outage (no DR plan, manual recovery)
  Lost revenue:        $1,141 x 4 hours = $4,564
  Emergency staff:     $5,000
  Customer credits:    $10,000
  Total direct cost:   $19,564

  Plus:
  Customer churn (0.5% = 5 customers at $500/year lifetime value): $2,500
  Reputational impact: estimated 1% traffic drop for 3 months: $7,500
  ─────────────────────────────────────────────────────────────
  Total estimated cost: ~$29,564

Scenario 2: 24-hour complete outage
  Lost revenue:        $1,141 x 24 = $27,384
  Emergency response:  $20,000
  Customer credits:    $50,000
  Regulatory review:   $15,000
  PR/communications:   $10,000
  Total direct cost:   $122,384

  Customer churn (2%): $20,000
  Reputational impact: $50,000
  ─────────────────────────────────────────────────────────────
  Total estimated cost: ~$192,384

Annual DR investment comparison:
  Pilot Light DR plan:   ~$8,000/year
  Warm Standby plan:     ~$25,000/year
  Active-Active plan:    ~$80,000/year (duplicates prod costs)

Break-even analysis:
  Even one 4-hour outage ($29,564) justifies $8,000/year Pilot Light.
  One 24-hour outage ($192,384) justifies Warm Standby.
```

### Business Impact by Industry

| Industry | Typical Downtime Cost | Key Regulatory Concern |
|----------|----------------------|----------------------|
| Financial Services | $5.6M/hour | SOX, FINRA, MiFID |
| Healthcare | $636K/hour | HIPAA, patient safety |
| E-commerce | Variable (revenue-based) | PCI-DSS |
| Manufacturing | $260K/hour | Production stoppage |
| Media & Entertainment | $90K/hour | Viewer experience |
| SaaS | Variable (SLA-based) | Customer churn |

---

## DR Strategy 1: Backup and Restore

### What It Is
The simplest and cheapest DR strategy. Your infrastructure runs only in the primary region. Data is backed up regularly. In a disaster, you rebuild the infrastructure from IaC and restore data from backup. No standby infrastructure running.

### Architecture Diagram

```
PRIMARY REGION (ap-southeast-2) — ACTIVE
┌────────────────────────────────────────────┐
│                                            │
│  [Route 53]                                │
│       │                                    │
│  [ALB]                                     │
│       │                                    │
│  [EC2 ASG]    ──→  Automated backups ──→   │
│                                            │
│  [RDS Multi-AZ]  ──→ Daily snapshots ──→   │
│                                            │
│  [EBS Volumes]  ──→  AWS Backup ──────→    │
│                                            │
│  [S3 Primary]   ──→  S3 versioning ────→   │
│                                            │
└────────────────────────────────────────────┘
         │ Backups stored in:
         ▼
DR REGION (us-east-1) — COLD (no running resources)
┌────────────────────────────────────────────┐
│                                            │
│  [S3 Backup Vault]                         │
│  (RDS snapshots copied cross-region)       │
│  (AWS Backup vault — replicated)           │
│  (S3 CRR — objects replicated)             │
│  (AMI copies for EC2)                      │
│  (CloudFormation templates)                │
│                                            │
│  NO RUNNING COMPUTE OR DATABASE            │
│                                            │
└────────────────────────────────────────────┘

DISASTER EVENT:
  Primary region becomes unavailable
         │
         ▼
  DR RECOVERY PROCESS (hours):
  1. Declare disaster → invoke DR runbook
  2. In DR region: run CloudFormation template
     → provisions VPC, subnets, security groups, ALB
  3. Restore RDS from latest cross-region snapshot
     → 30 min to 2 hours depending on DB size
  4. Launch EC2 ASG with copied AMIs
  5. Configure DNS: Route 53 update to DR ALB endpoint
  6. Validate application health
  7. Notify stakeholders
```

### Key Parameters
- **RTO:** 4–24 hours (depends on infrastructure size and data volume)
- **RPO:** Hours (last backup — typically daily backups = up to 24h RPO)
- **Cost:** Cheapest — only pay for backup storage

### When to Use
- Non-critical internal applications
- Development/staging environments
- Applications that can tolerate hours of downtime
- Tight budget with flexibility on RTO/RPO
- Applications with low rate of data change

### AWS Services Used
- **AWS Backup:** Centralized backup management
- **RDS Automated Backups:** Retained up to 35 days
- **RDS Cross-Region Snapshot Copy:** Manually or automatically
- **S3 Cross-Region Replication (CRR):** Objects replicated to DR bucket
- **EC2 AMI Copy:** Copy AMIs to DR region
- **CloudFormation:** Infrastructure templates stored in S3 for quick rebuild

### Implementation Tips
```bash
# Copy RDS snapshot to DR region (automate with Lambda + EventBridge schedule)
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:ap-southeast-2:123456789:snapshot:rds:mydb-2024-01-01 \
  --target-db-snapshot-identifier mydb-dr-2024-01-01 \
  --region us-east-1

# Copy AMI to DR region
aws ec2 copy-image \
  --source-region ap-southeast-2 \
  --source-image-id ami-0123456789abcdef0 \
  --name "MyApp-DR-$(date +%Y%m%d)" \
  --region us-east-1
```

---

## DR Strategy 2: Pilot Light

### What It Is
A small, minimum version of your environment always running in the DR region — specifically the critical, hard-to-recover components (typically the database). Application servers are not running but can be quickly launched using pre-configured AMIs or container images.

The analogy: a pilot light on a gas furnace — tiny flame always burning, ready to ignite the full furnace quickly.

### Architecture Diagram

```
PRIMARY REGION (ap-southeast-2) — FULLY ACTIVE
┌────────────────────────────────────────────┐
│                                            │
│  [Route 53 → ALB]                          │
│       │                                    │
│  [EC2 ASG: 4 instances running]  ◄────┐   │
│                                       │   │
│  [RDS Primary: db.r6g.2xlarge]  ──────┼──→ Continuous async
│                                       │   replication
└───────────────────────────────────────┼───┘
                                        │
DR REGION (us-east-1) — PILOT LIGHT     │
┌───────────────────────────────────────▼───┐
│                                           │
│  [NO EC2 instances]     ← ready to scale  │
│  [NO ALB]               ← CloudFormation  │
│                           ready to deploy │
│  [RDS Read Replica]  ← ALWAYS RUNNING    │
│  (db.r6g.large — smaller, read-only      │
│   replica of primary)                    │
│                                           │
│  [S3 DR bucket — S3 CRR synced]           │
│  [ECR images replicated]                  │
│  [Secrets Manager replicated]             │
│                                           │
└───────────────────────────────────────────┘

DISASTER RECOVERY (1–4 hours):

Step 1 (minutes): Detect primary region failure
  → Route 53 health check triggers alarm

Step 2 (minutes): Promote RDS Read Replica to standalone primary
  aws rds promote-read-replica --db-instance-identifier my-replica-dr

Step 3 (20–60 min): Deploy compute in DR region
  → Run CloudFormation: creates VPC, ALB, ASG
  → ASG launches EC2 instances with pre-baked AMI
  → Or: ECS Fargate service deployed from container images in DR ECR

Step 4 (5 min): Update DNS
  → Route 53: change ALB endpoint to DR region ALB

Step 5 (minutes): Validate
  → Health checks pass
  → Smoke tests run
  → Notify stakeholders
```

### Key Parameters
- **RTO:** 1–4 hours
- **RPO:** Minutes (async replication lag, typically < 5 minutes for RDS)
- **Cost:** Low-moderate (only paying for RDS replica + storage, not compute)

### When to Use
- Applications with hours-acceptable RTO but low RPO (need fresh data)
- Budget-conscious with critical data requirements
- Web applications where compute is easy to relaunch but data is irreplaceable
- Good balance of cost vs recovery capability

### AWS Services Used
- **RDS Read Replica (Cross-Region):** Continuously replicates from primary
- **S3 CRR:** Objects replicated to DR bucket
- **CloudFormation:** Full stack template in DR region ready to execute
- **EC2 AMI (pre-built):** Golden AMIs pre-copied to DR region
- **Elastic IP / Route 53:** DNS failover
- **Secrets Manager (replication):** Credentials available in DR region
- **ECR Replication:** Container images available in DR region

---

## DR Strategy 3: Warm Standby

### What It Is
A scaled-down but fully functional version of your production environment runs continuously in the DR region. Minimum capacity (e.g., 1 EC2 instance instead of 10, small DB instance). On disaster, you scale up to full production capacity.

### Architecture Diagram

```
PRIMARY REGION (ap-southeast-2) — FULL PRODUCTION
┌────────────────────────────────────────────────┐
│                                                │
│  [Route 53] → 100% traffic                     │
│       │                                        │
│  [ALB]                                         │
│       │                                        │
│  [EC2 ASG]                                     │
│  Min: 4, Desired: 8, Max: 20                   │
│  (handling full prod load)                     │
│       │                                        │
│  [RDS Primary: db.r6g.4xlarge]                 │
│       │                                        │
│  [ElastiCache Redis: 3 nodes]                  │
│                                                │
└────────────────────────────────────────────────┘
         │ Continuous replication
         ▼
DR REGION (us-east-1) — WARM STANDBY (scaled down)
┌────────────────────────────────────────────────┐
│                                                │
│  [Route 53] → 0% traffic (health check fails  │
│               until primary goes down)         │
│       │                                        │
│  [ALB — running but receiving no traffic]      │
│       │                                        │
│  [EC2 ASG]                                     │
│  Min: 1, Desired: 2, Max: 20  ← scaled up on  │
│  (minimal capacity, smoke test  disaster)      │
│   traffic only)                                │
│       │                                        │
│  [RDS Read Replica: db.r6g.xlarge]             │
│  (smaller than primary, promoted on disaster)  │
│       │                                        │
│  [ElastiCache Redis: 1 node]                   │
│  (scaled up on disaster)                       │
│                                                │
└────────────────────────────────────────────────┘

FAILOVER PROCESS (minutes):

1. Route 53 detects primary region health check failure
   → Automatic DNS failover to DR ALB (sub-60 seconds)

2. Traffic begins arriving at DR region (but capacity is low)
   → Initial traffic served by 2 EC2 instances

3. Automated runbook triggers (Lambda + Systems Manager):
   → Promote RDS Read Replica to standalone primary
   → Scale ASG: change desired from 2 to 8
   → Scale ElastiCache: add replicas
   → Adjust instance sizes if needed

4. DR region now at full capacity: 5–30 minutes
```

### Key Parameters
- **RTO:** Minutes to 1 hour (DNS failover is fast; scaling to full capacity takes minutes)
- **RPO:** Seconds to minutes (async RDS replication lag)
- **Cost:** Moderate-high (running 20–40% of production cost continuously in DR region)

### When to Use
- Business-critical applications with strict RTO but limited budget for full active-active
- Applications that need frequent DR testing (warm standby is easy to test)
- SaaS products with SLA commitments (99.9%+ availability = <8.7 hours downtime/year)

---

## DR Strategy 4: Multi-Site Active-Active

### What It Is
Both (or more) regions are fully active and handling live production traffic simultaneously. No failover needed — if one region fails, traffic continues to the other region seamlessly.

### Architecture Diagram

```
                              INTERNET
                                 |
                          [Route 53]
                    Latency/geolocation routing
                    Health checks on both regions
                                 |
              ┌──────────────────┴──────────────────┐
              │ 50% traffic                         │ 50% traffic
              │                                     │
REGION A: ap-southeast-2                  REGION B: us-east-1
[CloudFront] → [ALB]                      [CloudFront] → [ALB]
      │                                          │
[ECS Fargate: full prod]            [ECS Fargate: full prod]
      │                                          │
[DynamoDB Global Tables] ←─────────→ [DynamoDB Global Tables]
(Multi-master write in both regions)   (bidirectional replication)
      │                                          │
[Aurora Global Database]             [Aurora Global Database]
(primary: writes here)    ←─────────  (read replica: promotes in <1min)
      │                                          │
[S3 bucket] ─── S3 CRR ──────────────→ [S3 bucket]
[ElastiCache]                            [ElastiCache]

REGION A FAILURE:

Before:  100% users → [R53] → 50% to A, 50% to B
After:   Route 53 health check detects A failure
         → 100% to B  (within 60 seconds)
         Users served without interruption
         → RTO ≈ 0 (sub-minute)
         → RPO ≈ 0 (data already replicated to B)
```

### Key Parameters
- **RTO:** Near-zero (< 60 seconds for DNS propagation)
- **RPO:** Near-zero (synchronous or near-synchronous replication)
- **Cost:** Highest — approximately 2x production cost (two full regions)

### When to Use
- Mission-critical applications where any downtime = significant financial or safety impact
- Global applications where latency to a single region is unacceptable
- Regulatory requirements mandating geographic distribution
- Applications with enough traffic to justify the cost (economies of scale)

### Data Consistency Challenges
```
Problem: What if both regions write the same DynamoDB item simultaneously?

Solution options:
1. Last Writer Wins (DynamoDB default) — last timestamp wins, may lose one write
2. Write ownership routing — users in AU always write to ap-southeast-2
   users in US always write to us-east-1
   → no conflicts in normal operation
   → in failure: secondary region accepts writes, merge conflicts handled after recovery
3. Optimistic locking — conditional writes prevent silent overwrites
4. CRDT (conflict-free replicated data types) — specialized data structures
   that merge without conflicts (counters, sets, etc.)
```

---

## Comparison Table

| Strategy | RTO | RPO | Relative Cost | Complexity | Best For |
|----------|-----|-----|---------------|------------|----------|
| Backup and Restore | 4–24 hours | 24 hours | $ (lowest) | Low | Non-critical, dev/test, low-change data |
| Pilot Light | 1–4 hours | Minutes | $$ | Medium | Critical data, compute easily rebuilt |
| Warm Standby | Minutes–1hr | Seconds | $$$ | High | Business-critical, SLA-bound |
| Multi-Site Active-Active | Near-zero | Near-zero | $$$$ (highest) | Very High | Mission-critical, global apps |

### Cost Breakdown Example (Monthly)
```
Assumption: Production = $10,000/month

Backup and Restore:
  DR cost: $200–500/month (backup storage + cross-region copies)
  Total: $10,200–$10,500/month

Pilot Light:
  DR cost: $800–$1,500/month (RDS replica + storage)
  Total: $10,800–$11,500/month

Warm Standby:
  DR cost: $2,000–$4,000/month (scaled-down compute + full DB)
  Total: $12,000–$14,000/month

Multi-Site Active-Active:
  DR cost: $9,000–$10,000/month (full duplicate)
  Total: $19,000–$20,000/month
```

---

## AWS Services for DR

### Route 53 Failover

**Active-Passive Failover (Pilot Light / Warm Standby):**
```
Primary record: api.myapp.com → ALB in ap-southeast-2
  Type: A/ALIAS
  Routing policy: Failover (Primary)
  Health check: attached

Secondary record: api.myapp.com → ALB in us-east-1
  Type: A/ALIAS
  Routing policy: Failover (Secondary)
  Health check: attached (optional)

If primary health check fails → Route 53 serves secondary record
DNS TTL: 60 seconds for fast failover
```

**Health Check Types:**
- HTTP/HTTPS endpoint check: GET /health → 200 OK
- String matching: response body must contain "healthy"
- Calculated health check: combine multiple checks
- CloudWatch Alarm check: fails when alarm is in ALARM state

### RDS Cross-Region Read Replica

```
# Create read replica in DR region
aws rds create-db-instance-read-replica \
  --db-instance-identifier mydb-replica-us-east-1 \
  --source-db-instance-identifier arn:aws:rds:ap-southeast-2:123456789:db:mydb-primary \
  --db-instance-class db.r6g.large \
  --region us-east-1

# Promote to standalone on disaster
aws rds promote-read-replica \
  --db-instance-identifier mydb-replica-us-east-1 \
  --region us-east-1

# Notes:
# - Replication is asynchronous (seconds to minutes lag)
# - Read replica is read-only until promoted
# - After promotion: no longer replicates from source
# - You cannot un-promote — it becomes a standalone DB
```

### Aurora Global Database

```
Architecture:
  Primary cluster: ap-southeast-2 (writer + up to 15 readers)
  Secondary cluster: us-east-1 (up to 16 readers, no writer)

Replication:
  Storage-level replication (not log-based)
  Typical lag: < 1 second
  Max lag: 1 second (monitored via AuroraGlobalDBReplicationLag CloudWatch metric)

Managed Failover (planned):
  Console → Cluster → Actions → Switch over
  New primary promoted, old primary becomes secondary
  < 1 minute

Unplanned Failover (disaster):
  Console → Secondary cluster → Actions → Promote
  Or: aws rds failover-global-cluster
  RTO: < 1 minute

RPO: Seconds (up to AuroraGlobalDBReplicationLag at time of failure)
```

### DynamoDB Global Tables

```
# Enable Global Tables (add regions)
aws dynamodb create-global-table \
  --global-table-name Orders \
  --replication-group '[{"RegionName": "ap-southeast-2"}, {"RegionName": "us-east-1"}]'

# Or via console: DynamoDB → Tables → Global Tables tab → Add region

Key behaviors:
  - Multi-master: writes accepted in any region
  - Bidirectional replication, typically < 1 second
  - Last writer wins on conflict (timestamp-based)
  - Streams must be enabled
  - Replicated table must be ACTIVE in both regions

RPO: Seconds (replication lag)
RTO: Near-zero (both tables always active)
```

### S3 Cross-Region Replication (CRR)

```
Configuration:
  Source bucket: my-app-files (ap-southeast-2)
  Destination bucket: my-app-files-dr (us-east-1)

Replication rule settings:
  - Filter: replicate all objects (or prefix/tag filter)
  - Destination: specific bucket with optional storage class override
  - Replication time control (RTC): 99.99% of objects replicated within 15 minutes
  - Replicate delete markers: optional
  - Existing objects: use S3 Batch Replication (not replicated automatically for existing)

IAM Role:
  s3:ReplicateObject, s3:ReplicateDelete, s3:ReplicateTags
  on source and destination buckets

Notes:
  - Replicated objects maintain: metadata, ACLs, tags, storage class
  - Encrypted objects with SSE-KMS require KMS key replication config
  - Does NOT replicate: lifecycle deletions, objects before replication rule created
```

### CloudFormation for IaC-based Rebuild

```yaml
# Backup and Restore pattern: store full CloudFormation templates in S3
# In DR region, run:

aws cloudformation deploy \
  --template-url s3://my-infra-templates/prod-stack.yaml \
  --stack-name prod-dr \
  --parameter-overrides \
    Environment=production \
    DBSnapshotId=arn:aws:rds:us-east-1:123456789:snapshot:mydb-dr-latest \
    AMIId=ami-0123456789abcdef0 \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Template should parameterize:
# - DB snapshot to restore from
# - AMI ID for EC2 instances
# - Certificate ARN
# - Domain name
# - VPC CIDR blocks
```

---

## AWS Backup Service

### What It Is
AWS Backup is a centralized, fully managed backup service that automates backup across AWS services (EC2, EBS, RDS, Aurora, DynamoDB, EFS, FSx, Storage Gateway, VMware).

### Why Use It Instead of Per-Service Backups
- **Central policy:** One backup plan covers all resource types
- **Cross-region copy:** Automatically copy backups to DR region
- **Cross-account copy:** Send backups to a dedicated backup account
- **Compliance:** Vault Lock (WORM — write once, read many) prevents backup deletion
- **Audit:** Backup audit reports for compliance evidence
- **Restore testing:** AWS Backup restore testing (automated restore validation)

### Backup Plan Configuration

```yaml
Backup Plan: "Production-DR-Plan"

Rules:
  Daily backup:
    Schedule: cron(0 5 * * ? *)    # 5am UTC daily
    Start within: 1 hour
    Complete within: 8 hours
    Retention: 35 days
    Copy to us-east-1:
      Retention: 90 days
      Vault: DR-Vault-us-east-1

  Weekly backup:
    Schedule: cron(0 3 ? * SUN *)  # 3am UTC Sunday
    Retention: 1 year
    Copy to us-east-1:
      Retention: 7 years

  Monthly backup:
    Schedule: cron(0 1 1 * ? *)    # 1am UTC, 1st of month
    Retention: 7 years
    Copy to us-east-1:
      Retention: 7 years

Resources assigned:
  Tag: backup=true    # All resources tagged backup=true
```

### Backup Vault Lock (WORM)
```
Purpose: Prevent deletion of backups (ransomware protection, compliance)
Mode: Compliance mode (cannot be changed, even by root)
Min retention: 1 day
Max retention: up to 36,500 days

Once Vault Lock is enabled in Compliance mode:
  - Nobody can delete backups before retention period
  - Not AWS Support, not root account
  - Audit provides immutability guarantee
```

### Restore Testing
```
AWS Backup Restore Testing (automated):
  Schedule: Weekly
  Resource: randomly selected backup
  Restore to: isolated test account
  Validation: Lambda function validates restore
    (checks DB connectivity, EC2 boot, file integrity)
  Report: sent to SNS, CloudWatch

This ensures backups are actually restorable — critical!
Many organizations have "backup" but discover at disaster time
that restores fail.
```

### Backup Strategy by Service

| Service | Backup Method | Retention | Cross-Region | RPO |
|---------|--------------|-----------|--------------|-----|
| EC2 (EBS) | AWS Backup / EBS Snapshots | 35 days | Yes | 24h (daily) |
| RDS | Automated backups + snapshots | 35 days | Yes (manual copy) | 5 min (PITR) |
| Aurora | Automated + manual snapshots | 35 days | Yes | 1 min (PITR) |
| DynamoDB | On-demand / PITR (35 days) | 35 days | Via export to S3 | 1 min |
| S3 | Versioning + CRR | Lifecycle policy | Yes (CRR) | Near-zero |
| EFS | AWS Backup | Configurable | Yes | 24h |

---

## Interview Q&A

**Q1: What is RTO vs RPO? How do they influence DR strategy selection?**

A: RTO (Recovery Time Objective) is the maximum acceptable downtime — how long the system can be offline. RPO (Recovery Point Objective) is the maximum acceptable data loss — how old the recovered data can be. They drive different DR decisions: RPO drives database replication choice (synchronous for RPO=0, async for RPO=minutes). RTO drives infrastructure provisioning choice (pre-provisioned for fast RTO, rebuild from backup for slow RTO). If a business says "we can lose up to 1 hour of data but must be back online within 30 minutes" → RPO=1 hour (hourly backups fine), RTO=30 minutes (infrastructure must be pre-provisioned, not rebuilt from scratch).

---

**Q2: What is the difference between Warm Standby and Pilot Light?**

A: Pilot Light runs only the critical "always-on" components (typically just the database replica) with no compute running in the DR region. Warm Standby runs a fully functional but scaled-down version of the entire stack (compute + database + load balancer) in DR, handling minimal traffic or none. Recovery: Pilot Light requires provisioning compute before traffic can be served (1-4 hours). Warm Standby requires only scaling up existing compute (minutes). Warm Standby is more expensive (compute costs) but faster recovery.

---

**Q3: You have an RDS database that you need to protect with RPO of 5 minutes. How would you configure this?**

A: Two approaches: (1) Enable RDS Automated Backups with Multi-AZ — automated backups support Point-in-Time Recovery (PITR) to any second within the retention window. PITR effectively gives RPO of 5 minutes or less. However, this is within the same region — doesn't protect against regional failure. (2) For cross-region RPO of 5 minutes: create an RDS Cross-Region Read Replica. Async replication typically achieves < 1-5 minutes lag. For Aurora: Aurora Global Database replicates with < 1 second lag. Monitor `ReplicaLag` / `AuroraGlobalDBReplicationLag` CloudWatch metrics to verify lag stays within RPO.

---

**Q4: How does Route 53 failover routing work in a DR scenario?**

A: Route 53 attaches health checks to DNS records. For failover routing: Primary record points to primary region ALB with a health check. Secondary record points to DR region endpoint. If the health check on the primary record fails for the configured threshold (e.g., 2 consecutive failures, 10-second interval), Route 53 stops serving the primary record and begins serving the secondary record. The TTL on the record affects how quickly clients see the change — set TTL to 60 seconds for fast failover. The health check monitors an endpoint (HTTP/HTTPS) and can also check CloudWatch Alarms for complex scenarios.

---

**Q5: What is Aurora Global Database and when would you choose it over RDS Cross-Region Read Replica?**

A: Aurora Global Database uses storage-level replication across regions with typically < 1 second lag — much lower than RDS replication lag (which can be minutes under heavy load). Aurora Global also supports "managed failover" — promoting a secondary region to primary is automated and takes < 1 minute, with AWS updating the cluster endpoint. RDS Cross-Region Read Replica requires manual promotion and DNS update. Choose Aurora Global when: sub-second RPO required across regions, RTO < 1 minute for regional failover, or global read scaling across multiple regions. Use RDS replica when: cost sensitivity (Aurora is pricier), existing MySQL/PostgreSQL RDS workload, or minutes-level RPO is acceptable.

---

**Q6: A company's database is 10TB. How does this affect DR strategy choice?**

A: Large databases significantly impact Backup and Restore and Pilot Light strategies. Restoring a 10TB database from snapshot takes 2-8+ hours — blowing through most RTO budgets. Solutions: (1) Use Pilot Light with a continuously-replicated Read Replica — no restore needed, just promote the replica. (2) For Backup and Restore feasibility: restore happens in parallel (Aurora restores from S3 at up to 20GB/minute = ~8 min for 10TB, but this is Aurora-specific). (3) Warm Standby: replica is always running, scale-up is just changing instance type — no data restore required. Large databases push you toward always-on replication strategies rather than restore-based strategies.

---

**Q7: What is S3 Replication Time Control (RTC) and when should you use it?**

A: Standard S3 CRR replicates objects but with no guaranteed time SLA (typically seconds to minutes, but could be longer during high load). S3 RTC provides an SLA: 99.99% of objects replicated within 15 minutes. It also provides replication metrics (bytes pending, latency, operations pending) so you can monitor replication lag. Use RTC when your RPO is tied to S3 object replication (e.g., compliance documents, critical files) and you need both the SLA guarantee and monitoring visibility. RTC costs more ($0.015/GB extra) — use only for critical data.

---

**Q8: How would you test your DR plan without impacting production?**

A: DR testing approaches: (1) **Tabletop exercise** — team walks through the runbook step-by-step without executing. Low value but zero risk. (2) **Isolated restore test** — restore RDS snapshot to a new instance in DR region, validate data integrity, delete it. Tests restore works without impacting production. (3) **Full DR simulation** — in off-peak hours, execute the full DR runbook in DR region with synthetic traffic. Production continues running. Then execute rollback. (4) **Route 53 traffic shifting** — shift 5% traffic to DR region as a live test. (5) **Chaos engineering** — use FIS to simulate AZ failure in non-critical environment. Best practice: test DR quarterly, test recovery of specific backup files monthly, full DR simulation annually.

---

**Q9: What is AWS Backup Vault Lock and why would you use it?**

A: Vault Lock enables WORM (Write Once Read Many) protection for backups stored in a Backup Vault. Once configured, backups cannot be deleted before their retention period — not by any AWS account, not by root, not by AWS Support. It comes in Governance mode (certain users can still modify) and Compliance mode (nobody can change anything). Use cases: (1) Ransomware protection — even if an attacker compromises your AWS account, they cannot delete your backups. (2) Regulatory compliance — regulations like SEC Rule 17a-4, HIPAA, and CJIS require immutable records. (3) Protection against accidental deletion. Enable with minimum/maximum retention periods and it becomes effective after a 72-hour cool-down period (changeable window).

---

**Q10: How do you calculate the right DR strategy based on business requirements?**

A: Framework: (1) Get business RTO/RPO requirements — talk to business stakeholders, not just IT. "We lose $50,000/hour of downtime" is more useful than "we need high availability." (2) Calculate potential annual downtime cost. Example: $50K/hour x 4 hours potential = $200K. (3) Price each DR strategy at your infrastructure scale. (4) If DR cost < annual downtime risk: the strategy is justified. (5) Present options to business as a cost-risk trade-off: "Option A: $5K/year, 4-hour RTO. Option B: $30K/year, 15-minute RTO." (6) Document the decision with business sign-off — this is important if the day comes when the chosen strategy's limitations are experienced. (7) Test the plan and document actual observed RTO/RPO.
