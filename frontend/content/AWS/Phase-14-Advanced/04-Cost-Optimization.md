# AWS Cost Optimization - Comprehensive Guide

## Table of Contents
1. [AWS Cost Management Tools](#aws-cost-management-tools)
2. [EC2 Pricing Models](#ec2-pricing-models)
3. [S3 Cost Optimization](#s3-cost-optimization)
4. [RDS Cost Optimization](#rds-cost-optimization)
5. [Lambda Cost Optimization](#lambda-cost-optimization)
6. [Data Transfer Costs](#data-transfer-costs)
7. [Tagging Strategy](#tagging-strategy)
8. [Right-Sizing](#right-sizing)
9. [Auto Scaling for Cost](#auto-scaling-for-cost)
10. [FinOps Practices](#finops-practices)
11. [Real-World Cost Reduction Examples](#real-world-cost-reduction-examples)
12. [Interview Q&A](#interview-qa)

---

## AWS Cost Management Tools

### Cost Explorer

Cost Explorer is the primary tool for analyzing, visualizing, and forecasting AWS spending.

**Key Capabilities:**
- Visualize spending over the last 12 months and forecast up to 12 months ahead
- Filter and group by service, region, account, tag, instance type, usage type, and more
- Hourly-level granularity (paid tier) or daily/monthly (free)
- Right-sizing recommendations: identifies over-provisioned EC2 instances (requires CloudWatch agent for memory metrics)
- Savings Plan recommendations: analyzes your On-Demand usage and recommends Savings Plan commitment amounts with estimated savings
- Reserved Instance utilization and coverage reports

**How to Use Cost Explorer Effectively:**
1. Navigate to Billing > Cost Explorer > Enable it (takes 24 hours to populate)
2. Start with "Monthly costs by service" to identify your top cost drivers
3. Use the "Filters" panel to drill into specific services (e.g., EC2-Other = data transfer, EBS, etc.)
4. Group by "Usage Type" inside EC2 to separate compute, EBS, data transfer costs
5. Use the "Forecast" tab to project end-of-month spend
6. Check Right Sizing Recommendations under "Recommendations" — filter to "savings only"
7. Review Savings Plans recommendations and set commitment period (1 or 3 year)
8. Export reports to S3 for further analysis or share with stakeholders

**Important:** Cost Explorer data has a 24-hour delay. It is not real-time.

---

### AWS Budgets

AWS Budgets lets you set custom cost and usage budgets and receive alerts when thresholds are crossed.

**Four Budget Types:**

| Budget Type | What It Monitors | Alert Triggers |
|---|---|---|
| Cost Budget | Total dollar spend | Actual or forecasted amount |
| Usage Budget | Service usage units (e.g., EC2 hours, GB transferred) | Actual or forecasted units |
| Savings Plans Utilization | % of Savings Plans commitment being used | Falls below threshold (e.g., 80%) |
| RI Coverage | % of usage covered by Reserved Instances | Falls below threshold (e.g., 70%) |

**Alert Thresholds:**
- Common practice: set 80% alert (early warning) AND 100% alert (budget hit)
- Can alert based on actual spend OR forecasted spend for the month
- Supports email notifications (up to 10 addresses) and SNS topic integrations
- Can send alerts to AWS Chatbot (Slack/Chime)

**Budget Actions:**
Budget Actions let you automatically respond when a budget threshold is breached:
- Apply an SCP (Service Control Policy) to deny provisioning of new resources
- Stop specific EC2 or RDS instances (e.g., stop all dev instances when monthly budget hits 90%)
- Require IAM action approval (human in the loop for large spends)

**Walk-Through: Creating a Monthly Cost Budget with Email Alert**

1. Go to AWS Billing Console > Budgets > Create Budget
2. Select "Use a template (simplified)" or "Customize (advanced)"
3. Choose Budget type: **Cost**
4. Budget name: `monthly-total-spend`
5. Budget amount: `$500` (your monthly limit)
6. Budget period: **Monthly**, recurring
7. Effective date: start of current month
8. Add an alert:
   - Alert threshold: **80%** of budgeted amount ($400)
   - Trigger: **Actual** costs (not forecasted)
   - Email recipients: your-team@company.com
9. Add a second alert:
   - Alert threshold: **100%** of budgeted amount ($500)
   - Trigger: **Forecasted** costs (to warn before hitting the limit)
10. Review and Create

**Tip:** Budget Actions require an IAM role. Create a dedicated `aws-budgets-actions-role` with permissions to apply SCPs or stop instances.

---

### Cost Anomaly Detection

Cost Anomaly Detection uses machine learning to identify unusual spending patterns and alerts you to unexpected cost spikes — without requiring you to set fixed thresholds.

**How It Works:**
- ML model learns your normal spending patterns (per service, account, or custom cost category)
- Detects anomalies by identifying deviations from expected behavior
- Reduces false positives by understanding seasonality (weekday vs weekend, end-of-month spikes)

**Monitor Types:**
- **AWS Services monitor:** Detects anomalies across all AWS services
- **Linked account monitor:** Detects anomalies per AWS account (useful in Organizations)
- **Cost category monitor:** Monitors by your custom cost categories
- **Cost allocation tag monitor:** Monitors by tag (e.g., per project or per team)

**Configuration Steps:**
1. Go to Cost Explorer > Cost Anomaly Detection > Create monitor
2. Select monitor type (e.g., AWS Services)
3. Create an alert subscription:
   - **Alert frequency:** Individual alerts (immediate) or Daily/Weekly summary
   - **Threshold type:**
     - Percentage threshold: "Alert if cost is 20% above expected"
     - Absolute dollar threshold: "Alert if anomaly exceeds $50"
   - Notification: Email or SNS
4. Enable it — takes 10-14 days to train the model initially

**Example Finding:** Anomaly detected — EC2 costs 340% above expected in us-east-1. Root cause: a developer accidentally left 50 r5.xlarge instances running overnight.

---

### AWS Cost and Usage Report (CUR)

The CUR is the most granular billing tool AWS provides — a detailed CSV/Parquet file delivered to S3.

**Key Characteristics:**
- Hourly or daily granularity (hourly recommended for maximum detail)
- Contains every line item: resource ID, usage type, blended/unblended cost, reservation charges, tags
- Delivered to an S3 bucket you specify, compressed with gzip
- Can use GZIP or Parquet format (Parquet is better for Athena query performance)

**Setting Up CUR:**
1. Billing Console > Cost & Usage Reports > Create Report
2. Name: `cur-hourly`
3. Include resource IDs: Yes (required to identify specific resources)
4. Enable data integration for: Amazon Athena (creates Glue table automatically)
5. S3 bucket: `my-company-cur-reports`
6. Report path prefix: `cur/`
7. Time granularity: Hourly
8. Compression: Parquet

**Querying CUR with Athena:**

After setup, AWS creates a Glue crawler that makes the CUR queryable via Athena.

```sql
-- Top 10 most expensive services this month
SELECT
  line_item_product_code AS service,
  ROUND(SUM(line_item_blended_cost), 2) AS total_cost
FROM "athenacurcfn"."cur_hourly"
WHERE month = '2024-01'
GROUP BY line_item_product_code
ORDER BY total_cost DESC
LIMIT 10;

-- EC2 cost by instance type
SELECT
  product_instance_type,
  ROUND(SUM(line_item_unblended_cost), 2) AS cost
FROM "athenacurcfn"."cur_hourly"
WHERE line_item_product_code = 'AmazonEC2'
  AND line_item_line_item_type = 'Usage'
GROUP BY product_instance_type
ORDER BY cost DESC;

-- Cost by tag (requires enabling cost allocation tags)
SELECT
  resource_tags_user_project AS project,
  ROUND(SUM(line_item_blended_cost), 2) AS cost
FROM "athenacurcfn"."cur_hourly"
GROUP BY resource_tags_user_project
ORDER BY cost DESC;
```

**Note:** CUR is the only tool that shows savings plan and RI amortization at the individual resource level.

---

### Billing Dashboard

The Billing Dashboard provides a quick high-level overview:
- **Current month-to-date spend:** what you have spent so far this month
- **Last month total:** final amount charged last month
- **Forecasted end-of-month:** ML-based projection for total this month
- **Top services by spend:** bar chart of biggest cost drivers
- **Free tier usage alerts:** notifies when approaching free tier limits

Use the Billing Dashboard for a daily sanity check. For actual analysis, use Cost Explorer.

---

### Trusted Advisor

Trusted Advisor is a best-practice advisory tool with both free and paid checks. The Cost Optimization category identifies waste.

**Free Cost Checks:**
- Service limits that may cause unexpected failures

**Business/Enterprise Support - Cost Optimization Checks:**
- **Underutilized EC2 instances:** CPU < 10% and network < 5 MB over 14 days
- **Idle load balancers:** Classic ELBs with no active back-end connections (last 14 days)
- **Unattached EBS volumes:** Volumes in "available" state (not attached to any instance)
- **Unused Elastic IP addresses:** Elastic IPs not associated with a running instance ($0.005/hour = $3.60/month each)
- **Underutilized RDS DB instances:** DB with low connection counts
- **S3 bucket versioning:** Identifies buckets without lifecycle rules on versioned objects

**Access:** AWS Console > Trusted Advisor > Cost Optimization category

---

### Compute Optimizer

Compute Optimizer uses ML to analyze your historical resource utilization and recommend right-sized configurations.

**Supported Resources:**
- EC2 instances
- Auto Scaling Groups (ASG)
- EBS volumes
- Lambda functions
- ECS services on AWS Fargate

**How It Works:**
1. Analyzes 14 days of CloudWatch metrics (extendable to 93 days with enhanced infrastructure metrics — paid add-on)
2. For EC2: looks at CPU utilization, network I/O, EBS read/write throughput
3. For memory: requires CloudWatch agent installed on EC2 (Compute Optimizer uses the `mem_used_percent` metric)
4. Classifies instances as: Over-provisioned | Under-provisioned | Optimized | Insufficient data
5. Provides specific alternative instance types with projected cost and performance changes

**Key Facts:**
- Free service (enhanced metrics add-on is paid)
- Must be opted in (go to Compute Optimizer > Opt in)
- Can be enabled at the management account level in AWS Organizations to cover all linked accounts
- Findings visible in Cost Explorer right-sizing recommendations (same underlying data)

---

## EC2 Pricing Models

This is the most important section for AWS cost optimization and certifications.

---

### On-Demand Instances

**Description:** Pay for compute capacity by the hour or second with no long-term commitments or upfront payments.

**Pricing:** Highest price of all options. Linux/Windows instances billed per second (minimum 60 seconds). Some specialized instances billed per hour.

**Use Cases:**
- Development and test environments
- Short-term, spiky, or unpredictable workloads
- First 30 days on AWS while you learn your usage patterns
- Workloads that cannot tolerate interruption and don't run 24/7
- Proof-of-concept applications

**Discount:** 0% (this is the baseline)

**Commitment:** None

**Interruption Risk:** None

**Key Point:** On-Demand is the default. Everything else is measured against it.

---

### Reserved Instances (RI)

Reserved Instances are a billing discount that applies to On-Demand usage of specific instance types. You commit to using an instance configuration for 1 or 3 years.

**Important:** RIs do not launch instances — they are billing discounts applied to running On-Demand instances that match the RI configuration.

#### Standard Reserved Instances
- **Fixed attributes:** instance family, instance size, OS, tenancy, region
- **Cannot change:** instance family (e.g., m5), OS (Linux vs Windows)
- **Can change in regional RI:** instance size within the same family (m5.large to m5.xlarge using normalization factors)
- **Discount:** Up to **72%** over On-Demand
- **Can be sold:** on the AWS Marketplace RI Marketplace (Standard RIs only)

#### Convertible Reserved Instances
- **Flexible attributes:** can exchange for different instance family, size, OS, or tenancy
- **Exchange process:** submit exchange request, receive new Convertible RI of equal or greater value
- **Discount:** Up to **66%** over On-Demand (lower than Standard because of flexibility)
- **Cannot be sold:** on the RI Marketplace
- **Use case:** when you expect instance family changes over 3 years (e.g., moving from m5 to m6i)

#### Term Options
| Term | Discount Level | Best For |
|---|---|---|
| 1 Year | Moderate | Moderately stable workloads, shorter commitment comfort |
| 3 Year | Maximum | Highly stable production workloads, maximum savings |

#### Payment Options
| Payment Option | Upfront Cost | Monthly Charge | Discount Level |
|---|---|---|---|
| No Upfront | $0 | Full monthly payment | Lowest discount |
| Partial Upfront | Part of total | Reduced monthly | Medium discount |
| All Upfront | Full cost paid now | $0 | Highest discount |

**Rule:** More money upfront = more discount.

**Note:** 3-year All Upfront Standard RI = maximum possible RI discount (72%)

#### Scope: Regional vs Zonal

| Scope | AZ Flexibility | Instance Size Flexibility | Capacity Reservation |
|---|---|---|---|
| Regional | Any AZ in the region | Yes (within same family) | No |
| Zonal | Specific AZ only | No (exact size match) | Yes — guaranteed capacity |

**When to use Zonal:** If capacity reservation is critical (e.g., high-traffic production workloads where you must guarantee instance availability in a specific AZ).

**When to use Regional:** More flexibility, better utilization of the discount.

#### When to Buy RIs
- Steady-state workloads running **24/7 for 1+ years**
- Production databases (RDS, ElastiCache)
- Web servers in production
- Any workload with predictable, constant utilization

**Break-even analysis:** If an On-Demand instance runs more than ~50-60% of the time, an RI is almost always cheaper.

---

### Savings Plans

Savings Plans are a newer, more flexible alternative to RIs. Instead of committing to a specific instance type, you commit to a minimum hourly spend (e.g., $10/hour) for 1 or 3 years. AWS automatically applies the discount to your matching usage.

**Why Savings Plans Are Preferred Over RIs for Most Customers:**
- No need to manage specific instance type selections
- Automatically covers changing instance types, sizes, regions (for Compute SP)
- Simpler to purchase and manage
- Recommended by AWS Cost Explorer directly

#### Compute Savings Plans
- **Coverage:** Any EC2 instance family, any size, any region, any OS, any tenancy
- **Also covers:** AWS Lambda (per invocation and duration) and AWS Fargate (ECS and EKS)
- **Discount:** Up to **66%** over On-Demand
- **Most flexible** Savings Plan — applies automatically to whatever compute you use
- **Commitment:** Hourly dollar amount (e.g., $5.00/hour)

#### EC2 Instance Savings Plans
- **Coverage:** Specific instance family AND specific region
- **Flexibility within commitment:** Any size, any OS, any tenancy within that family/region
- **Example:** Commit to m5 in us-east-1 — covers m5.large, m5.xlarge, m5.2xlarge, Linux, Windows, etc.
- **Discount:** Up to **72%** over On-Demand (same as Standard RI)
- **Most savings** of any Savings Plan type

#### SageMaker Savings Plans
- Specific to Amazon SageMaker ML instance usage
- Up to 64% savings
- Any SageMaker instance family, size, region, and component

#### How Commitment Works
- You commit to a **minimum spend per hour** (e.g., $10.00/hour = $7,300/year)
- AWS applies the Savings Plan rate to your actual usage up to that committed amount
- Usage above the commitment is charged at On-Demand rates
- Unused commitment is still charged — don't over-commit

**Example:** You commit to $10/hour Compute SP. In one hour, your Lambda + EC2 + Fargate usage would normally cost $14 at On-Demand rates. With the SP, your committed $10 gets the 66% discount rate applied, and the remaining $4 of usage charges at On-Demand.

#### Purchasing Savings Plans
1. Cost Explorer > Savings Plans > Recommendations
2. Select commitment term (1 or 3 year)
3. Select payment option (No/Partial/All Upfront)
4. Review recommended hourly commitment amount
5. Purchase

---

### Spot Instances

Spot Instances provide access to unused EC2 capacity at drastically reduced prices. AWS can reclaim the instance with a 2-minute warning.

**Discount:** Up to **90% off** On-Demand prices

**How Spot Price Works:**
- Spot price varies by instance type, AZ, and current supply/demand
- You set a maximum price (or use the current price by default — recommended)
- If the Spot price exceeds your max price, your instance is reclaimed
- Spot prices are generally stable — dramatic spikes are rare for flexible fleets

**Interruption Notification:**
- 2-minute notice before reclamation
- Check instance metadata endpoint: `http://169.254.169.254/latest/meta-data/spot/termination-time`
- Can also use EventBridge rule on `EC2 Spot Instance Interruption Warning` event

**Best Practices for Handling Interruptions:**

1. **Use Spot with multiple instance types:** If one type is reclaimed, others continue working
2. **Checkpoint progress:** Periodically save work to S3, DynamoDB, or EFS so it can resume
3. **Use SQS for work queues:** Worker processes pull tasks from SQS. If Spot is reclaimed, another instance picks up the task (with visibility timeout)
4. **Design stateless applications:** Spot instances should not hold critical state
5. **Use Spot Instance Interruption Notice in scripts:** Gracefully drain connections and save state when notice arrives
6. **Target diversified instance families:** m5, m4, c5, c4, r5 — all have similar performance for many workloads

**Spot Fleet:**
A collection of Spot Instances (and optionally On-Demand) that maintains a target capacity.

- Define a fleet specification (multiple instance types, AZs, weights)
- Allocation strategies:
  - `lowest-price`: fill from cheapest pool first (good for cost, interruption-prone)
  - `diversified`: spread across all pools (most stable)
  - `capacity-optimized`: fill from pool with most available capacity (reduces interruptions — recommended)
  - `price-capacity-optimized`: balance of low price and available capacity (newest strategy, recommended)

**EC2 Auto Scaling with Spot:**
Use Launch Templates with mixed instances policy:
```
On-Demand base: 1 instance (always on)
On-Demand %: 20%
Spot %: 80%
Instance types: [m5.large, m5.xlarge, m4.large, c5.large, c5.xlarge]
AZs: us-east-1a, us-east-1b, us-east-1c
Allocation strategy: capacity-optimized
```

**Workloads That Are Good for Spot:**
- Batch processing jobs (image rendering, video transcoding, ETL)
- CI/CD build agents (Jenkins, GitHub Actions runners)
- Machine learning training jobs
- Stateless web server tier (behind ALB — ALB handles unhealthy instance removal)
- Big data analytics (EMR, Spark, Hadoop)
- HPC (high-performance computing) simulations
- Test and development environments

**Workloads NOT Suitable for Spot:**
- Production databases (cannot tolerate sudden termination)
- Stateful applications with in-memory state
- Critical single-instance services
- Applications with long-running transactions that cannot be checkpointed

---

### Dedicated Instances

**Description:** EC2 instances running on hardware physically dedicated to a single AWS customer. Other customers' instances never run on your hardware.

**Key Distinction from Dedicated Hosts:**
- Hardware dedication at the account level (your instances are isolated)
- You may share the physical server with OTHER instances from YOUR OWN account
- AWS manages the physical server placement
- You cannot see socket/core topology

**Pricing:**
- Per-instance billing (same as On-Demand but higher)
- Additional $2/hour per-region fee when any Dedicated Instances are running
- Can be purchased as Reserved Instances for discount

**Use Cases:**
- Regulatory or compliance requirements that prohibit multi-tenant hardware
- Corporate security policies requiring physical isolation from other customers
- Situations where Dedicated Hosts are too expensive and license isolation is not needed

---

### Dedicated Hosts

**Description:** An entire physical server dedicated to your use. You have full control over instance placement, socket and core visibility.

**Why Dedicated Hosts Are Used:**
1. **Server-bound software licenses:** Oracle Database, SQL Server, SUSE Linux Enterprise, and other software licensed per physical socket or per core. Dedicated Hosts let you Bring Your Own License (BYOL) and remain compliant.
2. **Compliance requirements:** Some regulations require physical server control and audit capability
3. **License audit visibility:** You can prove exactly how many sockets/cores your licensed software is running on

**Pricing:**
- Per-host billing (pay for the entire physical server)
- Most expensive EC2 option per instance, but can be cost-effective when replacing expensive per-core licensed software
- Available as On-Demand (hourly) or Reserved (1 or 3 year, up to 70% savings)

**Key Facts:**
- You see the underlying hardware: number of physical CPUs, sockets, and cores
- You control instance placement on the host
- Can run multiple instances of different sizes on the same host (within the host's capacity)
- Does NOT share hardware with any other AWS customer OR your other accounts

---

### Complete EC2 Pricing Comparison Table

| Pricing Model | Discount vs On-Demand | Commitment | Interruption Risk | Best Use Case |
|---|---|---|---|---|
| On-Demand | 0% (baseline) | None | None | Dev/test, unpredictable, short-term |
| Reserved Standard (1yr, All Upfront) | Up to 40% | 1 year, specific instance | None | Steady-state, known instance type |
| Reserved Standard (3yr, All Upfront) | Up to 72% | 3 years, specific instance | None | Long-term production, maximum savings |
| Reserved Convertible (3yr) | Up to 66% | 3 years, flexible exchange | None | Production, instance family may change |
| Compute Savings Plans (3yr) | Up to 66% | 3 years, hourly spend | None | Best for flexible multi-service usage |
| EC2 Instance Savings Plans (3yr) | Up to 72% | 3 years, family+region | None | Production EC2, known family+region |
| Spot Instances | Up to 90% | None | High (2-min notice) | Batch, CI/CD, fault-tolerant workloads |
| Dedicated Instances | Higher than On-Demand | Optional RI | None | Compliance, multi-tenant isolation |
| Dedicated Hosts | Most expensive | Optional RI | None | BYOL, per-socket/core licensed software |

---

## S3 Cost Optimization

### S3 Storage Classes and When to Use Them

| Storage Class | Retrieval | Availability | Min Storage Duration | Use Case |
|---|---|---|---|---|
| S3 Standard | Milliseconds | 99.99% | None | Frequently accessed data |
| S3 Intelligent-Tiering | Milliseconds | 99.9-99.99% | None | Unknown access patterns |
| S3 Standard-IA | Milliseconds | 99.9% | 30 days | Infrequently accessed, rapid retrieval |
| S3 One Zone-IA | Milliseconds | 99.5% | 30 days | IA data, non-critical, single AZ |
| S3 Glacier Instant Retrieval | Milliseconds | 99.9% | 90 days | Archives with occasional access |
| S3 Glacier Flexible Retrieval | Minutes to hours | 99.99% | 90 days | Backup and archive |
| S3 Glacier Deep Archive | 12-48 hours | 99.99% | 180 days | Long-term regulatory archive |

### S3 Storage Class Analysis
- AWS feature that monitors object access patterns within a bucket or prefix
- Takes 30 days to generate first recommendations
- Recommends when objects are ready to transition to Standard-IA (based on infrequent access)
- View results in the S3 Console under the bucket's Metrics tab
- Use the analysis output to configure Lifecycle rules

### S3 Intelligent-Tiering

The best choice when access patterns are unknown or unpredictable.

**How It Works:**
- Objects start in Frequent Access tier
- Not accessed for 30 days → moved to Infrequent Access tier (40% cheaper)
- Not accessed for 90 days → moved to Archive Instant Access tier (68% cheaper)
- Not accessed for 180 days → can be moved to Deep Archive Access tier (95% cheaper) if enabled
- Objects are automatically moved back to Frequent Access when accessed

**Cost:**
- Small monitoring and automation fee per object per month ($0.0025 per 1,000 objects)
- No retrieval fees (unlike Standard-IA which charges retrieval fees)
- Not cost-effective for objects under 128KB (monitoring fee outweighs storage savings)

### S3 Lifecycle Rules

Automate transitions and deletions to reduce storage costs.

**Example: Production Backup Lifecycle Policy**
```
Day 0:      Object created → S3 Standard
Day 30:     Transition → S3 Standard-IA
Day 90:     Transition → S3 Glacier Flexible Retrieval
Day 365:    Transition → S3 Glacier Deep Archive
Day 2555:   Expire (delete) the object
```

**For Versioning-Enabled Buckets (Critical Cost Optimization):**
```
Current version: Standard → IA at 30 days → Glacier at 90 days
Non-current versions: Expire after 30 days
Expired object delete markers: Delete after 1 day
Incomplete multipart uploads: Delete after 7 days
```

**Setting Up Lifecycle Rule (Console):**
1. S3 > Bucket > Management > Create Lifecycle Rule
2. Rule name: `archive-old-objects`
3. Choose scope: entire bucket or prefix/tags
4. Add transitions: (e.g., Standard-IA after 30 days, Glacier after 90 days)
5. Add expiration: (e.g., expire current versions after 365 days)
6. Add incomplete multipart upload cleanup: after 7 days

### S3 Lens

S3 Lens provides a single organization-wide view of S3 storage usage and activity.

**Features:**
- Dashboard showing total storage, object count, requests by type
- Identifies buckets with no lifecycle rules (a cost risk)
- Identifies buckets with non-current version storage (pay for old versions)
- Activity metrics: how many GET/PUT/DELETE requests per bucket
- Drill down from organization level → account → region → bucket → prefix
- 14 days of metrics free (29 metrics); advanced metrics paid (35+ metrics, 15 months history)

### Delete Incomplete Multipart Uploads

One of the most commonly overlooked S3 costs. When a multipart upload starts but never completes (due to app crash, network issue), the parts remain in S3 and you are charged for storage.

**Fix:** Add a lifecycle rule to abort incomplete multipart uploads after 7 days:
```
Rule: Abort incomplete multipart uploads after 7 days
Applies to: Entire bucket
```
This single rule can save significant money in buckets with active uploads.

### Requester Pays

Enable on a bucket so that the requester (downloader) pays for data transfer and request costs — not the bucket owner.

**Use Case:** Sharing large public datasets (genomics data, satellite imagery). You provide the data; users pay to download it.

**How to Enable:** S3 > Bucket > Properties > Requester Pays > Enable

### Versioning Cost Awareness

Every version of every object is billed as a separate object at full storage price.

**Example:** A 1GB object with 10 versions = 10GB billed.

**Mitigation Strategies:**
1. Add lifecycle rules to expire non-current versions after N days
2. Add lifecycle rules to keep only the last N versions
3. Only enable versioning on buckets that truly need it (not log buckets)
4. Monitor versioned object costs with S3 Lens

---

## RDS Cost Optimization

### Reserved DB Instances

Works identically to EC2 Reserved Instances but for RDS database instances.

- **Discount:** Up to 69% compared to On-Demand RDS pricing
- **Term:** 1 year or 3 year
- **Payment:** No Upfront, Partial Upfront, All Upfront
- **Applies to:** DB instance type, DB engine (MySQL, PostgreSQL, Oracle, SQL Server, Aurora), deployment (Single-AZ vs Multi-AZ), and region
- **Multi-AZ commitment:** If you have a Multi-AZ deployment, you need Multi-AZ Reserved Instances
- **Aurora:** Reserve Aurora instances separately (Aurora uses different instance types)
- **Note:** Reserved DB Instances are purchased per instance, per engine, per region

**When to Buy:** Any production RDS that runs 24/7. At steady-state workloads, the break-even point is roughly 50% utilization compared to always-on On-Demand.

### Right-Size DB Instances Using Compute Optimizer

- Compute Optimizer analyzes DB CPU, memory, and connection utilization
- Common finding: Production RDS databases are provisioned at 2-4x the needed size
- After right-sizing, verify using CloudWatch metrics: `CPUUtilization`, `FreeableMemory`, `DatabaseConnections`
- Right-size during a maintenance window with Multi-AZ failover to minimize downtime

### Aurora Serverless v2

Aurora Serverless v2 automatically scales compute capacity based on actual database load.

**Scaling:** 0.5 to 128 Aurora Capacity Units (ACUs)
- 1 ACU = approximately 2 GB RAM + proportional CPU and network
- Scales up within seconds as load increases
- Scales down to minimum ACUs during idle periods

**Cost Model:** Pay per ACU-hour actually consumed (not provisioned)

**Ideal For:**
- Development and staging databases (near zero cost when idle at night/weekends)
- Variable production workloads with unpredictable traffic spikes
- Multi-tenant applications where aggregate load is variable
- Applications with bursty usage patterns

**Not Ideal For:** Extremely high-throughput consistent workloads where provisioned capacity is more cost-predictable.

### Read Replicas to Reduce Primary Load

Adding a Read Replica (instead of scaling up the primary instance) can reduce costs significantly.

**Scenario:** Production db.r5.2xlarge ($0.48/hour) is overloaded because of reporting queries.
**Solution:** Add a db.r5.large Read Replica ($0.24/hour) and route all reporting/analytics queries to it.
**Result:** Primary instance stays at db.r5.large, total cost is lower than upgrading to db.r5.4xlarge.

**Additional Benefit:** Aurora Read Replicas share the same underlying storage (no storage cost for replicas), making them especially cost-efficient.

### Stop Dev/Test RDS Instances on Schedule

RDS instances can be stopped for up to 7 days at a time (AWS automatically restarts them after 7 days to apply patches).

**Cost Savings:** A stopped RDS instance still incurs storage charges (~$0.115/GB-month for gp2) but does NOT charge for compute. For a db.t3.medium running 8 hours/day vs 24 hours/day: 66% compute savings.

**Automate with Systems Manager Automation:**
1. Create an SSM Automation document or use `AWS-StopRdsInstance`
2. Create an EventBridge rule: cron at 7pm weekdays → trigger SSM to stop all dev RDS instances
3. Create an EventBridge rule: cron at 8am weekdays → trigger SSM to start them

### Use gp3 Storage Instead of gp2

**gp3 vs gp2 Comparison:**

| Feature | gp2 | gp3 |
|---|---|---|
| Baseline IOPS | 3 IOPS/GB (min 100) | 3,000 IOPS always |
| Max IOPS | 16,000 (at 5,333 GB) | 16,000 (provisioned separately) |
| Throughput | 128-250 MB/s | 125-1,000 MB/s |
| Price (RDS) | $0.115/GB-month | $0.092/GB-month (~20% cheaper) |
| IOPS pricing | Included (burst limited) | First 3,000 included; pay above |

**Action:** Migrate RDS storage from gp2 to gp3 for most workloads — 20% cheaper and better baseline performance. Can be done as an online storage modification.

### Delete Automated Backups When Not Needed

- RDS automated backups are retained for 1-35 days (default: 7 days)
- Backup storage within the same size as your database is free
- Backup storage exceeding your DB storage size is charged (~$0.095/GB-month)
- For dev/test databases: set retention to 1 day minimum (0 disables backups entirely)
- Delete manual snapshots when they are no longer needed

---

## Lambda Cost Optimization

### Memory Allocation and the CPU Relationship

Lambda allocates CPU power proportional to memory. More memory = more vCPU cores.

**Memory → CPU allocation:**
- 128 MB: 0.083 vCPU
- 512 MB: 0.333 vCPU
- 1,769 MB: 1 full vCPU
- 3,008 MB: ~2 vCPU
- 10,240 MB: ~6 vCPU

**Key insight:** Sometimes allocating MORE memory reduces duration enough to lower the total cost.

**Example:**
- 512 MB: 2,000ms duration → cost = 512 × 2000 = 1,024,000 GB-ms
- 1,024 MB: 800ms duration → cost = 1024 × 800 = 819,200 GB-ms (20% cheaper AND faster!)

**AWS Lambda Power Tuning Tool:**
- Open-source AWS Step Functions state machine
- Tests your function at multiple memory configurations (128MB to 10,240MB)
- Measures execution time and calculates cost at each memory level
- Generates a visualization showing cost vs. speed trade-off
- Recommends optimal memory for cost, speed, or balanced

**How to Use:**
1. Deploy the Lambda Power Tuning SAR application
2. Invoke with your function ARN and payload
3. Review the output visualization
4. Update your Lambda memory setting to the recommended value

### ARM64 (Graviton2) Architecture

Switching Lambda from x86_64 to arm64 delivers significant savings.

**Savings:**
- arm64 pricing is **20% cheaper** per GB-second than x86
- Graviton2 processor is faster for most workloads: typically **~19% faster** execution
- Combined effect: approximately **34% total cost reduction** for equivalent workloads

**How to Enable:**
1. Lambda Console > Function > Configuration > General Configuration > Edit
2. Architecture: change from x86_64 to arm64
3. Redeploy the function (rebuild the deployment package if using native binaries)

**Compatibility:** Most Lambda runtimes support arm64: Python, Node.js, Java, Go, .NET, Ruby, and custom runtimes. Avoid arm64 if your deployment package includes x86-specific compiled binaries.

### Minimize Cold Starts

Cold starts add latency (and can add billable duration if initialization code runs slowly).

**Optimization Techniques:**
1. **Keep deployment packages small:** Smaller packages load faster. Remove unused dependencies. Use Lambda layers for shared libraries.
2. **Optimize initialization code:** Move expensive operations (DB connections, config loading, SDK initialization) outside the handler function. This code runs once per container lifetime.
3. **Use Provisioned Concurrency:** Pre-warm N Lambda containers (incurs constant cost but eliminates cold starts). Use with Auto Scaling to match predicted traffic.
4. **Choose smaller runtimes:** Python and Node.js cold starts are faster than Java and .NET.
5. **Use Lambda SnapStart (Java):** Snapshots the initialized Lambda environment, dramatically reducing Java cold starts.

### Reuse Connections

Lambda containers are reused across invocations. Variables initialized outside the handler persist between invocations.

**Wrong (reconnects every invocation):**
```python
def handler(event, context):
    conn = psycopg2.connect(DATABASE_URL)  # New connection every time
    result = conn.execute("SELECT ...")
    return result
```

**Correct (reuses connection):**
```python
import psycopg2
conn = None  # Module-level variable

def handler(event, context):
    global conn
    if conn is None or conn.closed:
        conn = psycopg2.connect(DATABASE_URL)  # Only connects on cold start
    result = conn.execute("SELECT ...")
    return result
```

**Applies to:** Database connections, HTTP clients (requests.Session), AWS SDK clients (boto3), Redis connections.

### Set Appropriate Timeouts

Default Lambda timeout is 3 seconds (not 15 minutes). However, many developers set timeouts to 15 minutes "just to be safe."

**Problem:** A runaway Lambda function at 15-minute timeout consumes far more cost than one at 30-second timeout for the same workload.

**Best Practice:** Set timeout to 2-3x the expected maximum execution time. Monitor p99 duration in CloudWatch and adjust.

### Lambda Compute Savings Plans

Compute Savings Plans apply to Lambda duration and request charges (in addition to EC2 and Fargate). A single Compute SP commitment covers all three.

---

## Data Transfer Costs

Data transfer is one of the most frequently underestimated AWS costs. Understanding the rules prevents billing surprises.

### Complete Data Transfer Pricing Reference

| Transfer Type | Cost | Notes |
|---|---|---|
| Inbound to AWS (from internet) | **FREE** | Always free, no exceptions |
| Within same AZ (private IP) | **FREE** | Must use private/internal IPs |
| Within same AZ (public/Elastic IP) | $0.01/GB each direction | Use private IPs instead |
| Between AZs in same region | $0.01/GB each direction | $0.02/GB total round trip |
| Between regions (AWS backbone) | $0.02 - $0.09/GB | Varies by region pair |
| To internet (from EC2, ALB, etc.) | ~$0.09/GB | First 10 TB/month; tiered below |
| To internet (via CloudFront) | ~$0.0085-$0.085/GB | Cheaper than direct egress |
| To internet (first 100 GB/month) | **FREE** | Small free tier allotment |

### CloudFront vs Direct Egress

Using CloudFront as a CDN is cheaper than serving content directly from EC2 or S3 to the internet:
- Direct S3 to internet: ~$0.09/GB
- CloudFront to internet (via S3 origin): ~$0.0085/GB (regional) to $0.17/GB (most expensive region)
- CloudFront data transfer out to origin (S3): Free within same region

**Additional Benefits of CloudFront:** Caching reduces origin requests (saving compute and API costs), DDoS protection via Shield Standard (free), and global edge caching for lower latency.

### VPC Endpoints — Traffic on AWS Network

Without VPC Endpoints, traffic from EC2 to S3 or DynamoDB travels:
EC2 → NAT Gateway → Internet → AWS S3/DynamoDB endpoint

**Cost:**
- NAT Gateway data processing: $0.045/GB
- NAT Gateway hourly: $0.045/hour
- Data transfer to internet and back

**With Gateway VPC Endpoint (S3, DynamoDB):**
EC2 → VPC Endpoint → S3/DynamoDB (stays on AWS private network)

**Cost:** **Free** (Gateway endpoints have no hourly or data processing fee)

**Savings:** Eliminates NAT Gateway data processing charges for S3 and DynamoDB traffic — often one of the largest cost savings in a VPC audit.

### NAT Gateway Cost Breakdown

NAT Gateway is a common unexpected cost item.

| Cost Component | Price |
|---|---|
| NAT Gateway hourly | $0.045/hour ($32.40/month) |
| Data processed per GB | $0.045/GB |

**Example:** A production application sending 1 TB/month through NAT Gateway:
- Hourly: $32.40/month
- Data processing: 1,024 GB × $0.045 = $46.08/month
- **Total: ~$78.48/month per NAT Gateway**

**Optimization Strategies:**
1. Use Gateway VPC Endpoints for S3 and DynamoDB (eliminates that traffic from NAT)
2. Use Interface VPC Endpoints for other AWS services (eliminates CloudWatch, SQS, SNS traffic through NAT)
3. Consider one NAT Gateway per region (not per AZ) for dev environments — save 2/3 of NAT hourly costs, accept cross-AZ traffic charges
4. For production: keep per-AZ NAT Gateways for resilience, but use VPC endpoints aggressively

### Cross-AZ Traffic Optimization

Every time an EC2 instance in AZ-a calls an RDS in AZ-b: $0.02/GB round trip.

**Solutions:**
1. Keep application and database in the same AZ when possible
2. Use Application Load Balancer with AZ affinity routing
3. For microservices: prefer same-AZ communication for data-intensive services

---

## Tagging Strategy

Tags are the foundation of cost allocation, chargeback, and FinOps maturity.

### Why Tags Are Critical

Without tags, you cannot answer:
- "How much is Project Alpha costing us per month?"
- "Which team is responsible for this $10,000 RDS cluster?"
- "How much is our production environment vs development?"

With tags, Cost Explorer can filter and group spend by any tag dimension.

### Enabling Cost Allocation Tags

Tags are not automatically visible in Cost Explorer. You must activate them:
1. Billing Console > Cost Allocation Tags
2. Find your tag keys in "User-defined cost allocation tags"
3. Activate each tag key (takes 24 hours to appear in Cost Explorer data)
4. Tags only apply to costs incurred after activation — not retroactively

### Mandatory Tag Policy

Define a mandatory set of tags for all resources across your organization:

| Tag Key | Example Values | Purpose |
|---|---|---|
| `Environment` | prod, staging, dev, test | Cost breakdown by environment |
| `Project` | project-alpha, mobile-app | Cost breakdown by initiative |
| `Team` | platform, data-eng, frontend | Charge teams for their usage |
| `Owner` | jsmith@company.com | Contact for resource ownership |
| `CostCenter` | CC-1234, CC-5678 | Finance chargeback codes |
| `Application` | payment-service, auth-api | Application-level cost tracking |

### Enforcing Tags with AWS Config

Use AWS Config Managed Rule `required-tags` to detect non-compliant resources:
1. Config > Rules > Add Rule > required-tags
2. Specify required tag keys: Environment, Project, Team, Owner
3. Set remediation action: SNS notification to team, or auto-apply default tags via SSM

### AWS Organizations Tag Policies

Tag Policies enforce consistent tag key capitalization and allowed values across all accounts in an Organization:
1. Organizations Console > Policies > Tag Policies
2. Create policy:
   ```json
   {
     "tags": {
       "Environment": {
         "tag_value": {
           "@@assign": ["prod", "staging", "dev", "test"]
         }
       }
     }
   }
   ```
3. Attach to OUs or accounts
4. Set enforcement mode: report non-compliance OR prevent non-compliant tag operations

### Chargeback vs Showback

| Approach | Description | Effect |
|---|---|---|
| Showback | Show teams their costs (awareness) | Educational, no financial consequence |
| Chargeback | Charge teams' budget for their AWS costs | Financial accountability, strong incentive |
| Hybrid | Shared infrastructure costs split by formula | Common for platform/shared services |

**Best Practice:** Start with showback to build awareness, then move to chargeback when teams have capacity to optimize.

---

## Right-Sizing

Right-sizing means selecting the optimal instance size for your workload — not too large (wasted money) and not too small (poor performance).

### Compute Optimizer Analysis Process

**What Compute Optimizer Analyzes:**

| Resource | Metrics Analyzed |
|---|---|
| EC2 | CPU, network in/out, EBS IOPS/throughput, memory* |
| ASG | Same as EC2 |
| EBS | IOPS utilization, throughput utilization |
| Lambda | Duration, memory utilization, cost |
| ECS on Fargate | CPU and memory utilization |

*Memory requires CloudWatch Agent installed and sending `mem_used_percent` metric.

**Recommendation Categories:**
- **Over-provisioned:** Current usage significantly below capacity. Downsize to save money.
- **Under-provisioned:** Performance risk. Upsize recommended.
- **Optimized:** Current sizing matches utilization patterns.
- **Insufficient data:** Less than 30 hours of metrics. Not enough to analyze.

**How to Action Recommendations:**
1. Compute Optimizer Console > EC2 Instances > filter by "Over-provisioned"
2. Review each instance: current type, recommended type, projected monthly savings
3. Check estimated performance risk (Low/Medium/High)
4. During maintenance window: stop instance → change instance type → start
5. For production: use Launch Template change + Rolling update in ASG

### Typical Finding in Enterprise Environments

Industry data consistently shows:
- **60-70%** of EC2 instances are over-provisioned
- Average over-provisioning: **2x the needed size**
- Most common scenario: Instance was sized for a launch peak and never right-sized afterward

**Quick Win Formula:** Find all instances with average CPU < 20% over the last 14 days. These are prime right-sizing candidates.

### Right-Sizing Process

1. **Gather data:** 4-6 weeks minimum of metrics (include at least one end-of-month processing spike)
2. **Identify candidates:** CPU < 20% average, memory < 40% average, network I/O well below capacity
3. **Analyze peaks:** Ensure the smaller instance handles 95th-percentile load, not just average
4. **Test in non-production:** Validate performance on smaller instance type first
5. **Implement in production:** With rollback plan (maintain old Launch Template version)
6. **Monitor post-change:** Watch CloudWatch alarms for 48-72 hours after change

---

## Auto Scaling for Cost

Auto Scaling is a powerful cost tool — pay for compute only when you need it.

### Scheduled Scaling

Perfect for predictable usage patterns.

**Use Case: Dev Environment Cost Reduction**
- Scale down to 0 instances every weekday at 7pm
- Scale back up to minimum capacity every weekday at 8am
- Scale to 0 on Friday night, back up Monday morning
- Result: Dev environment only runs during business hours (55 hours/week vs 168 hours = 67% compute savings)

**Implementation:**
```
Scheduled Action 1: scale-down-evening
  Recurrence: 0 19 * * 1-5 (7pm Mon-Fri)
  Min: 0, Max: 0, Desired: 0

Scheduled Action 2: scale-up-morning
  Recurrence: 0 8 * * 1-5 (8am Mon-Fri)
  Min: 2, Max: 10, Desired: 2
```

### Target Tracking Scaling

Instead of setting fixed scaling thresholds, define a target utilization (e.g., "keep CPU at 60%"). ASG automatically adjusts capacity to maintain that target.

**Why This Saves Money Over Fixed Sizing:**
- Traditional approach: provision enough instances to handle peak load 24/7
- Target tracking: provision just enough for current load, scale up when needed
- Peak load at 2pm: 10 instances running
- Off-peak at 2am: 2 instances running
- Result: Only pay for what you need, when you need it

**Common Targets:**
- `ASGAverageCPUUtilization`: 60-70%
- `ALBRequestCountPerTarget`: requests per instance
- `ASGAverageNetworkIn/Out`: network bandwidth target

### Predictive Scaling

ML-based scaling that analyzes historical patterns and scales ahead of expected load.

**How It Works:**
- Analyzes 14 days of load history to identify patterns (daily cycles, weekly cycles)
- Pre-scales the ASG up to 1 hour before expected load increase
- Prevents scaling lag (the period where load has spiked but instances haven't launched yet)
- Combine with reactive Target Tracking for actual unexpected spikes

**Cost Benefit:** Predictive scaling avoids over-provisioning "buffer capacity" for anticipated load. You can set a tighter target utilization because you know scale-out will happen proactively.

---

## FinOps Practices

FinOps (Cloud Financial Operations) is the practice of bringing financial accountability to cloud spending.

### FinOps Maturity Model

| Maturity Level | Characteristics | Actions |
|---|---|---|
| Crawl | Cost visibility just starting | Enable CUR, tagging, basic dashboards |
| Walk | Teams aware of costs, some optimization | Showback, right-sizing, Savings Plans |
| Run | Cost optimization embedded in culture | Chargeback, unit economics, automated governance |

### Weekly Cost Review Cadence

**Recommended Meeting Structure (30 minutes):**
1. Review week-over-week cost change (Cost Explorer)
2. Review any anomaly detection alerts from the week
3. Review Trusted Advisor and Compute Optimizer new findings
4. Team-specific: each team reviews their tagged spend
5. Identify 1-2 optimization actions for next sprint

**Key Metrics to Track Weekly:**
- Total monthly spend to date vs budget
- Forecasted end-of-month vs budget
- Week-over-week change % by service
- Savings Plans utilization % (should be > 90%)
- RI coverage % (should be > 80% for steady workloads)

### Cost Per Unit Metrics

The most mature cost metric: cost per business outcome.

| Business | Unit Metric | Example |
|---|---|---|
| SaaS product | Cost per active user | $2.40/user/month |
| E-commerce | Cost per order | $0.08/transaction |
| Media platform | Cost per 1,000 streams | $1.20/1K streams |
| API service | Cost per API call | $0.0002/call |

**Why Unit Metrics Matter:** Infrastructure costs might increase 20% but if users grew 40%, the unit cost actually went down — infrastructure is becoming more efficient.

### Automated Cleanup — Lambda for Idle Resource Detection

Build a Lambda function (scheduled daily) that finds and reports (or deletes) idle resources:

**Targets for Automated Cleanup:**
- EC2 instances stopped for > 30 days (detach and delete EBS volumes, release Elastic IPs)
- EBS volumes in "available" state (not attached) for > 7 days
- Unassociated Elastic IP addresses (cost $0.005/hour = $3.60/month each)
- EBS snapshots older than 90 days for terminated instances
- Unused Load Balancers (0 healthy targets for 48+ hours)
- CloudWatch Log Groups with no ingestion for 90+ days (set retention policies)
- Old EC2 AMIs and their associated snapshots

**Tool:** AWS Instance Scheduler (open-source AWS solution) automates start/stop of EC2 and RDS instances on a schedule, configurable via DynamoDB tags.

### Infrastructure as Code for Cost Control

IaC (Terraform, CloudFormation, CDK) enables better cost governance:
- **Easy cleanup:** `terraform destroy` removes all resources for a feature branch
- **Automated deletion:** CI/CD pipelines can delete temporary environments after testing
- **Cost estimation:** `infracost` (open-source tool) estimates monthly cost of a Terraform plan before applying
- **Drift detection:** Identify manually-created resources not in IaC (shadow IT resources)
- **Tagging enforcement:** Apply mandatory tags in IaC templates so no resource is ever created without tags

---

## Real-World Cost Reduction Examples

### Example 1: On-Demand to Reserved — 40% Savings

**Situation:** 50 m5.xlarge instances running 24/7 in production. All On-Demand.

**Monthly cost (On-Demand):** 50 × $0.192/hour × 720 hours = **$6,912/month**

**Action:** Purchase 3-year, Partial Upfront EC2 Instance Savings Plans for m5, us-east-1

**Monthly cost (after Savings Plans):** $6,912 × 0.60 (40% savings) = **$4,147/month**

**Monthly savings: ~$2,765 | Annual savings: ~$33,180**

---

### Example 2: S3 Lifecycle Rules — 60% Reduction

**Situation:** 500 TB in S3 Standard. 90% of objects are over 90 days old and rarely accessed.

**Before:** 500,000 GB × $0.023/GB = **$11,500/month**

**Action:** Added lifecycle rules:
- Transition to Standard-IA at 30 days
- Transition to Glacier Flexible Retrieval at 90 days

**After:** 50 TB recent in Standard ($1,150) + 50 TB in IA ($1,125) + 400 TB in Glacier ($1,600) = **$3,875/month**

**Monthly savings: ~$7,625 | 66% reduction**

---

### Example 3: Right-Sized RDS — 75% Saving

**Situation:** Production PostgreSQL on db.r5.2xlarge ($0.48/hour). Average CPU: 8%. Average memory used: 20%.

**Action:** Compute Optimizer recommended db.r5.large ($0.12/hour). Tested in staging → performance identical.

**Before:** db.r5.2xlarge × 720 hours = **$345.60/month**
**After:** db.r5.large × 720 hours = **$86.40/month**

**Monthly savings: $259.20 | 75% reduction**

---

### Example 4: Spot Instances for CI/CD — 80% Reduction

**Situation:** 20 Jenkins build agents running as c5.xlarge On-Demand, 8 hours/day weekdays.

**Before:** 20 × $0.17/hour × 8 hrs × 22 days = **$598.40/month**

**Action:** Migrated to Spot Instances with capacity-optimized fleet across c5, c5d, c4 instance families.

**After:** 20 × $0.034/hour (avg Spot price) × 8 hrs × 22 days = **$119.68/month**

**Monthly savings: $478.72 | 80% reduction**

---

### Example 5: VPC Endpoints Eliminated NAT Gateway Costs

**Situation:** Applications sending 10 TB/month to S3 through NAT Gateway.

**NAT Gateway cost:**
- Hourly: $0.045 × 720 = $32.40
- Data processing: 10,240 GB × $0.045 = $460.80
- **Total NAT Gateway cost: $493.20/month**

**Action:** Created S3 Gateway VPC Endpoint and DynamoDB Gateway VPC Endpoint.

**After:** S3/DynamoDB traffic bypasses NAT Gateway entirely (uses AWS private network).
- NAT Gateway hourly still charged: $32.40 (still needed for other internet traffic)
- Data processing reduced by 80%: $92.16
- **New total: $124.56/month**

**Monthly savings: $368.64 | 75% reduction in NAT Gateway costs**

---

## Interview Q&A

### Q1: What is the cheapest EC2 pricing model and what are its risks?

**A:** Spot Instances are the cheapest, offering up to 90% discount over On-Demand. The risk is that AWS can reclaim Spot Instances with only a 2-minute warning when they need the capacity back. To handle this: design stateless workloads, use SQS for work queues so tasks can be retried, checkpoint progress to S3 or DynamoDB, and use Spot Fleet with diversified instance types to reduce the chance of simultaneous reclamation.

---

### Q2: What is the difference between Reserved Instances and Savings Plans? Which should I use?

**A:** Both provide discounts of up to 72% over On-Demand in exchange for a 1 or 3-year commitment.

**Reserved Instances** commit to a specific instance type, OS, region, and tenancy. Standard RIs give the biggest discount (72%) but are rigid. Convertible RIs allow exchanges for different types but give less discount (66%).

**Savings Plans** commit to an hourly spend amount. Compute Savings Plans (66%) cover any EC2 instance family, region, OS, plus Lambda and Fargate — most flexible. EC2 Instance Savings Plans (72%) cover any size/OS within a specific family and region.

**Recommendation:** AWS now recommends Savings Plans for most customers because they automatically apply to changing usage without manual RI exchanges. Only consider Dedicated Host RIs for license compliance scenarios.

---

### Q3: What is the difference between a Dedicated Host and a Dedicated Instance?

**A:** Both run on hardware isolated from other AWS customers, but:

**Dedicated Instance:** AWS manages physical placement. Your instances don't share hardware with other accounts, but may share with your own account's instances. Billed per instance.

**Dedicated Host:** You get a specific physical server. You have visibility into socket and core topology. You control instance placement on the host. Billed per host. Required when using BYOL software licensed per physical socket or core (Oracle, SQL Server).

**Memory tip:** Dedicated HOST = you see the physical hardware and control placement = needed for license compliance.

---

### Q4: What is the difference between a Savings Plan's No Upfront, Partial Upfront, and All Upfront payment options?

**A:** All three provide the same term (1 or 3 year) and the same coverage, but differ in how you pay and the resulting discount:

- **No Upfront:** Pay nothing now; pay a reduced hourly rate throughout the term. Smallest discount.
- **Partial Upfront:** Pay a portion now; pay a reduced hourly rate for the remainder. Medium discount.
- **All Upfront:** Pay the entire commitment now; no hourly charges for covered usage. Largest discount.

The rule: more money upfront = more discount. Choose based on your cash flow preference vs. desire for maximum savings.

---

### Q5: Your EC2 costs are 3x what was budgeted. How do you investigate?

**A:**
1. **Cost Explorer:** Group by "Instance Type" and "Usage Type" to see if it's compute, data transfer, or EBS driving the cost.
2. **Filter to "EC2-Other":** This category includes EBS, data transfer, Elastic IPs — often surprises teams.
3. **Check Trusted Advisor:** Underutilized instances, unattached EBS, unused Elastic IPs.
4. **Cost Anomaly Detection:** See if there are recent anomalies with root cause analysis.
5. **Compute Optimizer:** Look for over-provisioned instances.
6. **Tag analysis:** Break cost by Environment and Team tags to identify which workloads are responsible.
7. **Check if any RIs/Savings Plans expired:** Forgetting to renew commitments causes cost to jump back to On-Demand rates.

---

### Q6: How does S3 Intelligent-Tiering work and when would you NOT use it?

**A:** S3 Intelligent-Tiering automatically moves objects between access tiers based on actual usage: Frequent Access (Standard pricing) → Infrequent Access (40% cheaper) after 30 days without access → Archive Instant Access (68% cheaper) after 90 days → Deep Archive (95% cheaper) after 180 days if configured. Objects are automatically moved back to Frequent Access when accessed.

**When NOT to use it:**
- Objects smaller than 128KB: the per-object monitoring fee ($0.0025/1K objects/month) costs more than the storage savings.
- Objects with truly unpredictable but heavy access: if almost all objects are frequently accessed, Standard is cheaper (no monitoring fee).
- Very short-lived objects (deleted within days): no time to benefit from tiering.

---

### Q7: What is the difference between AWS Cost Explorer and AWS Cost and Usage Report (CUR)?

**A:**
- **Cost Explorer:** Visual dashboard for analyzing trends, forecasting, and getting recommendations. Interactive UI with filters and groupings. Data available at daily or monthly granularity. Free to access (hourly granularity is paid).
- **CUR:** Detailed billing CSV/Parquet delivered to S3 at hourly granularity. Contains every line item with resource IDs, tags, blended/unblended costs, amortized RI/SP costs. Must be queried with Athena or loaded into a data warehouse. The most granular billing data available.

**Use Cost Explorer for:** Quick analysis, trend spotting, recommendations, and forecasting.
**Use CUR for:** Detailed cost attribution, custom reporting, chargeback, joining cost data with business data, or when you need resource-level hourly cost data.

---

### Q8: Your application uses a lot of NAT Gateway. How do you reduce the cost?

**A:**
1. **Create Gateway VPC Endpoints for S3 and DynamoDB.** These are free and route traffic over the AWS private network, completely bypassing the NAT Gateway for those services. This is often the single biggest savings action.
2. **Create Interface VPC Endpoints for other AWS services** (CloudWatch, SQS, SNS, Secrets Manager) that your instances call frequently.
3. **Analyze NAT Gateway traffic** using VPC Flow Logs to identify the top destinations by bytes transferred. If the top destination is S3 or an AWS service endpoint, VPC Endpoints will fix it.
4. **Consolidate to fewer NAT Gateways for non-production** environments (accept cross-AZ charges instead of paying for multiple NAT Gateway hourly fees).
5. **Review if any NAT Gateway traffic is unnecessary** (e.g., log agents sending large volumes of data that should go to an internal endpoint).

---

### Q9: How do Spot Instance Interruptions work and how do you handle them?

**A:** When AWS needs capacity back, it sends an interruption notice 2 minutes before terminating the Spot Instance. The notice is available at the EC2 instance metadata endpoint: `http://169.254.169.254/latest/meta-data/spot/termination-time`. An EventBridge event `EC2 Spot Instance Interruption Warning` is also published.

**Handling strategies:**
1. **Poll metadata endpoint** every 5 seconds in your application. When the endpoint returns a timestamp, begin graceful shutdown.
2. **Checkpoint work** to S3, DynamoDB, or EFS so it can resume from the last checkpoint on a new instance.
3. **Use SQS for work distribution.** Tasks stay in the queue until a worker completes them. If a Spot Instance is interrupted mid-task, the visibility timeout expires and another instance picks up the task.
4. **Design stateless applications.** No critical state in memory or local disk.
5. **Use Spot Fleet with capacity-optimized strategy** and multiple instance types to reduce the probability of fleet-wide interruptions.

---

### Q10: What are the 5 AWS reserved IP addresses in every subnet and what are they for?

**A:** AWS reserves the first 4 IP addresses and the last 1 IP address in every subnet CIDR block:

| Address | Reserved For |
|---|---|
| x.x.x.0 | Network address (not usable) |
| x.x.x.1 | AWS VPC router |
| x.x.x.2 | AWS DNS server (always VPC base + 2) |
| x.x.x.3 | Reserved by AWS for future use |
| x.x.x.255 | Network broadcast address (not used, reserved) |

**Practical impact:** A /24 subnet has 256 total IPs but only **251 usable** for EC2, RDS, etc. A /28 (smallest usable subnet) has 16 IPs but only **11 usable**.

---

### Q11: Explain the concept of "blended cost" vs "unblended cost" in AWS billing.

**A:**
- **Unblended Cost:** The actual charge for each line item at its specific rate. A Reserved Instance shows $0 for covered usage (the RI was already paid for). The RI purchase shows as a separate line item. This can make analysis confusing because most usage shows $0 and the RI fee is a lump sum.
- **Blended Cost:** AWS averages the RI/SP savings across all matching usage to give a "blended" hourly rate. Provides a more consistent view of cost per resource.
- **Amortized Cost (recommended for analysis):** Spreads the upfront RI/SP fees across the term and adds them to the reservation's effective hourly rate. Shows the true economic cost of each resource over time. Best for chargeback and unit economics analysis.

---

### Q12: You have a Lambda function running 1 million times per month. How do you optimize its cost?

**A:**
1. **Run the Lambda Power Tuning tool** to find the optimal memory setting. More memory often means faster execution and lower total cost.
2. **Switch to arm64 (Graviton2):** 20% cheaper per GB-second, typically 19% faster = ~34% total savings for most workloads. Change the Architecture setting.
3. **Move initialization code outside the handler:** DB connections, SDK clients, and config loading runs once per container lifetime — not per invocation.
4. **Review timeout setting:** Reduce from default to appropriate maximum to avoid runaway executions.
5. **Consider Compute Savings Plans** if Lambda costs are significant — Compute SP covers Lambda duration charges.
6. **Reduce invocation count** if possible: batch smaller events together, use SQS batching, or filter events at the source (EventBridge content filtering) before they reach Lambda.

---

### Q13: What is Cost Anomaly Detection and how does it differ from AWS Budgets?

**A:**
- **AWS Budgets:** You set a fixed threshold. Alert fires when actual or forecasted spend crosses that threshold. You must know in advance what "too much" looks like. Requires manual threshold management.
- **Cost Anomaly Detection:** ML-based. It learns your normal spending patterns, including seasonality. Alerts when spend deviates unusually from expected — even if you never set a threshold. Catches unexpected spikes without requiring you to predict them in advance.

**Example:** If your EC2 costs normally spike at month-end processing, a Budget alert at $1,000 would fire every month even though it's expected behavior. Cost Anomaly Detection learns that spike is normal and doesn't alert for it — but would alert if EC2 suddenly spiked on a random Tuesday with no historical precedent.

**Best practice:** Use both. Budgets for hard limits with automatic actions (stop instances when budget is hit). Cost Anomaly Detection for ML-based early warning of unexpected spend.

---

### Q14: Your company is moving from on-premises Oracle Database to AWS. How do you think about licensing costs?

**A:** Oracle licensing is per-processor. On standard x86 servers, 1 physical core = 0.5 Oracle processor licenses. On AWS EC2, the approach depends on instance type:

**Dedicated Host approach (recommended for Oracle BYOL):**
- Use EC2 Dedicated Hosts to have visibility into the exact number of physical sockets and cores
- You can legally count only the vCPUs you assign to Oracle instances
- Dedicated Host + Oracle Standard Edition 2 (limited to 2 sockets) is a common cost-effective pattern

**Bring Your Own License (BYOL):**
- Bring existing Oracle licenses to AWS Dedicated Hosts
- Must comply with Oracle's hard partitioning requirements (AWS Dedicated Hosts qualify; regular EC2 does not)

**Alternative — migrate to Aurora PostgreSQL or Aurora MySQL:**
- Eliminate Oracle license cost entirely (licenses can cost more than the infrastructure)
- AWS Schema Conversion Tool (SCT) + Database Migration Service (DMS) for automated migration
- For many workloads, this is the most impactful cost optimization possible

---

### Q15: Walk me through designing a cost-optimized 3-tier web application on AWS.

**A:** Here's a cost-optimized production architecture:

**Compute Layer:**
- ALB (pay-per-use, no fixed cost)
- Auto Scaling Group with mixed instances: 20% On-Demand base + 80% Spot Instances
- Instance types: diversified across m5, m5d, c5, c5d families
- Savings Plans for the On-Demand portion (covering the always-on base capacity)

**Database Layer:**
- Aurora PostgreSQL with Read Replicas (route read-heavy workloads to replicas)
- Production: Reserved DB Instance for primary (1-year, Partial Upfront)
- Dev/test: Aurora Serverless v2 (near-zero cost when idle)

**Storage Layer:**
- S3 with Intelligent-Tiering for application uploads (unknown access patterns)
- S3 Lifecycle rules for logs: Standard → IA at 30 days → Glacier at 90 days → delete at 365 days
- Delete incomplete multipart uploads after 7 days

**Networking:**
- CloudFront in front of ALB and S3 (cheaper egress, caching reduces origin requests)
- Gateway VPC Endpoints for S3 and DynamoDB (eliminates that traffic from NAT Gateway)
- Interface VPC Endpoints for CloudWatch, SQS, SNS

**Governance:**
- Mandatory tags enforced via Organizations Tag Policy
- Cost Anomaly Detection enabled per service
- Monthly budget with 80% and 100% alerts with Budget Actions
- Compute Optimizer opted in across all accounts

**Result:** Compared to all On-Demand with no optimization, this architecture typically achieves 50-65% cost reduction.
