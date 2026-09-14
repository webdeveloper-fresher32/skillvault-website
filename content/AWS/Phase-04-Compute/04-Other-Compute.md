# Other AWS Compute Services

## Table of Contents

1. [Elastic Beanstalk](#1-elastic-beanstalk)
2. [Amazon Lightsail](#2-amazon-lightsail)
3. [AWS Batch](#3-aws-batch)
4. [AWS Outposts](#4-aws-outposts)
5. [Service Comparison](#5-service-comparison)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Elastic Beanstalk

### What is Elastic Beanstalk?

Elastic Beanstalk (EB) is AWS's **Platform as a Service (PaaS)** offering. You give it your
application code, and it handles the underlying infrastructure — provisioning EC2 instances,
configuring load balancers, setting up Auto Scaling, installing the runtime, and deploying
your code.

```
What YOU manage with Elastic Beanstalk:
  ✓ Application code
  ✓ Configuration files (.ebextensions)
  ✓ Environment variables

What AWS manages:
  ✓ EC2 instances
  ✓ Auto Scaling Group
  ✓ Load Balancer (ALB)
  ✓ Operating system patching
  ✓ Runtime installation (Node.js, Python, Java, etc.)
  ✓ Deployment mechanics
  ✓ Health monitoring
```

### The Abstraction Ladder

```
More Control ▲       EC2 (you manage everything)
             │       Elastic Beanstalk (manage code, AWS manages infra)
             │       App Runner / Fargate (container, no server management)
Less Control ▼       Lambda (just functions, event-driven)
```

### What Beanstalk Provisions

Behind the scenes, Beanstalk creates real AWS resources that you can see and modify:

```
Elastic Beanstalk Environment
├── Elastic Load Balancer (ALB)
├── Auto Scaling Group
│   ├── EC2 instances (runs your code)
│   └── Launch Template
├── Security Groups
├── CloudWatch Alarms
├── S3 Bucket (stores deployment artifacts)
└── RDS (optional, if you configure it)
```

### Supported Platforms

| Platform | Versions |
|----------|----------|
| Node.js | 18, 20 |
| Python | 3.9, 3.10, 3.11 |
| Ruby | 3.0, 3.1, 3.2 |
| PHP | 8.0, 8.1, 8.2 |
| Go | 1.21 |
| Java SE | Corretto 17, 21 |
| Java with Tomcat | 8.5, 9, 10 |
| .NET on Linux | .NET 6, 7, 8 |
| .NET on Windows Server | Various |
| Docker | Single container, Multi-container (ECS) |
| Custom platforms | Using Packer |

### Environments

Elastic Beanstalk has two environment tiers:

**Web Server Environment:**
```
For: HTTP/HTTPS applications, APIs, websites
Architecture:
  Internet → ELB → EC2 fleet → (optional) RDS
```

**Worker Environment:**
```
For: Background tasks, queue processing
Architecture:
  SQS Queue → Worker EC2 → Process messages
  (The SQS daemon on each instance pulls messages and posts to localhost)
```

You can run both simultaneously — web tier for the API, worker tier for background jobs.

### Deployment Strategies

#### All at Once (Default)
```
Before: [v1] [v1] [v1] [v1]
Deploy: [v1] [v1] [v1] [v1]  ← All updating simultaneously
After:  [v2] [v2] [v2] [v2]

Downtime: YES (brief outage during deployment)
Speed: Fastest
Use: Development environments only
```

#### Rolling
```
Before: [v1] [v1] [v1] [v1]
Batch 1: [v2] [v2] [v1] [v1]  ← First 50% update
Batch 2: [v2] [v2] [v2] [v2]  ← Second 50% update

Downtime: NO (reduced capacity during deployment)
Speed: Medium
Use: Acceptable to have reduced capacity briefly
```

#### Rolling with Additional Batch
```
Before:  [v1] [v1] [v1] [v1]
Phase 1: [v1] [v1] [v1] [v1] [v2]  ← Extra instance added first
Phase 2: [v2] [v2] [v1] [v1] [v2]  ← Rolling update proceeds
Phase 3: [v2] [v2] [v2] [v2] [v2]  ← Extra instance removed
After:   [v2] [v2] [v2] [v2]

Downtime: NO (full capacity maintained throughout)
Speed: Medium (costs slightly more temporarily)
Use: Production workloads
```

#### Immutable
```
Before:  [v1] [v1] [v1] [v1]
Phase 1: [v1] [v1] [v1] [v1] + new ASG: [v2] [v2] [v2] [v2]
Phase 2: All v2 healthy? → Swap: [v2] [v2] [v2] [v2]
         Old v1 ASG deleted

Downtime: NO (two fleets run simultaneously)
Speed: Slow (full fleet must launch)
Cost: Double during deployment
Rollback: Easy (delete new ASG)
Use: Production, when you need zero risk
```

#### Blue/Green (Traffic Shifting)
```
Blue environment: [v1] ← 100% traffic
Green environment: [v2] ← 0% traffic (new)

Swap environment URL:
Blue:  [v1] ← 0%  (standby)
Green: [v2] ← 100% traffic

If problems: Swap back instantly (URL swap)
```

### Beanstalk Configuration with .ebextensions

Create a directory `.ebextensions/` in your project root with `.config` files (YAML/JSON):

**Install a package:**
```yaml
# .ebextensions/packages.config
packages:
  yum:
    git: []
    wget: []
    nginx: []
```

**Set environment variables:**
```yaml
# .ebextensions/env.config
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    LOG_LEVEL: info
    DB_HOST: mydb.cluster.us-east-1.rds.amazonaws.com
```

**Configure the ALB:**
```yaml
# .ebextensions/alb.config
option_settings:
  aws:elb:loadbalancer:
    CrossZone: true
  aws:elasticbeanstalk:environment:
    LoadBalancerType: application
```

**Run a command during deployment:**
```yaml
# .ebextensions/migrate.config
container_commands:
  01_migrate:
    command: "python manage.py migrate"
    leader_only: true  # Only run on the first instance
  02_collectstatic:
    command: "python manage.py collectstatic --noinput"
```

### Beanstalk CLI Workflow

```bash
# Install EB CLI
pip install awsebcli

# Initialize project
eb init

# Create environment
eb create production-env \
  --platform "Node.js 18 running on 64bit Amazon Linux 2023" \
  --instance-type t3.medium \
  --min-instances 2 \
  --max-instances 10

# Deploy code
eb deploy

# Check environment status
eb status

# View logs
eb logs

# SSH into an instance
eb ssh

# Open in browser
eb open

# Terminate environment
eb terminate production-env
```

### When to Use Elastic Beanstalk

**Good fit:**
- Teams that want to focus on code, not infrastructure
- Standard web applications (CRUD APIs, websites)
- Teams new to AWS (easier than raw EC2)
- Applications on supported runtimes
- Organizations requiring PCI-DSS compliance (Beanstalk is compliant)

**Bad fit:**
- Need very custom infrastructure (complex VPC, specialized EC2 configs)
- Containers (use ECS or EKS instead)
- Event-driven workloads (use Lambda)
- Very high traffic needing fine-tuned scaling (use raw EC2 + ASG)
- Microservices architecture (each service in Beanstalk adds overhead)

---

## 2. Amazon Lightsail

### What is Lightsail?

Amazon Lightsail is AWS's **simplified Virtual Private Server (VPS)** service. It provides a
streamlined experience for simple workloads with predictable, all-inclusive pricing.

```
Lightsail vs EC2:

EC2: Full power, complex, pay for what you use
     → For developers and architects who know AWS

Lightsail: Simple, predictable, bundled pricing
           → For developers who just want a server
           → Or migrating from DigitalOcean / Linode
```

### Lightsail Plans (Pricing)

All-inclusive monthly price includes: vCPU, RAM, SSD storage, data transfer allowance, DNS
management, static IP.

| Plan | vCPU | RAM | SSD | Data Transfer | Price/month |
|------|------|-----|-----|---------------|-------------|
| Nano | 2 | 0.5 GB | 20 GB | 1 TB | $3.50 |
| Micro | 2 | 1 GB | 40 GB | 2 TB | $7 |
| Small | 2 | 2 GB | 60 GB | 3 TB | $12 |
| Medium | 2 | 4 GB | 80 GB | 4 TB | $20 |
| Large | 2 | 8 GB | 160 GB | 5 TB | $40 |
| XL | 4 | 16 GB | 320 GB | 6 TB | $80 |
| 2XL | 8 | 32 GB | 640 GB | 7 TB | $160 |

### What Lightsail Includes

- Virtual Machine (the instance)
- Static IP (one free per instance)
- SSD storage (root disk)
- Data transfer (1-7 TB/month depending on plan)
- DNS zone management
- Snapshots (manual and automatic)
- Monitoring metrics (basic)
- Firewall rules

### Lightsail Blueprints

Pre-configured application stacks — click to launch:

| Category | Options |
|----------|---------|
| OS | Amazon Linux 2023, Ubuntu, Debian, CentOS |
| Websites | WordPress, Ghost, Joomla, Drupal, Magento |
| Web servers | LAMP, LEMP, MEAN, Node.js |
| Databases | MySQL, PostgreSQL (standalone) |
| Applications | cPanel, Plesk, GitLab, Nextcloud, Redmine |

### Lightsail Databases

Managed relational databases with automatic backups and high availability:
- MySQL 8.0
- PostgreSQL 12, 13, 14, 15

Lightsail databases are simpler and cheaper than RDS but with fewer features.

### Lightsail Containers

Lightsail can deploy container workloads without needing to understand ECS/EKS/Kubernetes.
Push your Docker image to ECR or Docker Hub and deploy in minutes.

### Lightsail vs EC2

| Feature | Lightsail | EC2 |
|---------|-----------|-----|
| Pricing | Fixed monthly (predictable) | Pay-per-second (variable) |
| Setup complexity | Very easy (wizard-based) | Complex (many choices) |
| Customization | Limited | Full |
| Networking | Simplified | Full VPC control |
| Scaling | Manual | Auto Scaling |
| Load balancing | Basic Lightsail LB | ALB/NLB |
| AWS integration | Limited | Full (IAM, VPC, etc.) |
| Target audience | Beginners, simple apps | Professionals |
| Free tier | No | Yes (t2.micro) |

### When to Use Lightsail

**Good fit:**
- Personal websites and blogs (WordPress)
- Simple web applications
- Development and testing servers
- Small business websites
- Migrating from DigitalOcean or Linode
- Learning AWS without complexity

**Not a good fit:**
- Production applications needing Auto Scaling
- Complex networking requirements
- Deep AWS service integration
- High-traffic applications
- Enterprise workloads

### Lightsail → EC2 Migration Path

As your application grows, you can move from Lightsail to EC2:
1. Take a Lightsail snapshot
2. Export snapshot to Amazon EC2 (Lightsail console → Snapshots → Export to EC2)
3. This creates an AMI in EC2
4. Launch EC2 instances from the AMI
5. Update DNS to point to new EC2/ALB

---

## 3. AWS Batch

### What is AWS Batch?

AWS Batch is a fully managed service for running **batch computing workloads** at any scale.
You define jobs (containers or shell scripts), and AWS Batch:
- Provisions the right amount of compute (EC2 or Fargate)
- Queues and schedules jobs
- Manages compute resources (scales up and down)
- Retries failed jobs
- Runs dependent jobs in the right order

```
Without AWS Batch:
  You → Manage servers → Queue jobs → Monitor → Retry failures → Clean up servers

With AWS Batch:
  You → Submit job → Done
  Batch → Provision → Queue → Run → Retry → Clean up
```

### Core Concepts

#### Job

A unit of work. Defined by:
- A Docker container image
- The command to run
- CPU, memory requirements
- Environment variables
- Retry strategy

```json
{
  "jobName": "process-data-2024-01-15",
  "jobQueue": "high-priority-queue",
  "jobDefinition": "data-processor:3",
  "containerOverrides": {
    "command": ["python", "process.py", "--date", "2024-01-15"],
    "environment": [
      {"name": "S3_BUCKET", "value": "my-data-bucket"}
    ]
  }
}
```

#### Job Queue

Jobs wait in a queue until compute resources are available. Multiple queues allow priority
management:

```
High-priority queue  → Mapped to large compute environment
Low-priority queue   → Mapped to Spot compute environment

Time-sensitive jobs → High-priority queue (runs immediately)
Overnight analytics → Low-priority queue (cheap Spot instances)
```

#### Compute Environment

The pool of EC2 instances or Fargate tasks that run your jobs.

**Managed Compute Environment (Recommended):**
```
AWS Batch manages the EC2 fleet automatically:
- Scales up when jobs are queued
- Scales down (to zero!) when no jobs are queued
- Chooses optimal instance types
- Can use Spot instances for cost savings

Configuration:
  Type: MANAGED
  Compute resources:
    Type: EC2 (or SPOT for cost savings)
    Min vCPUs: 0      ← Scale to zero when idle
    Desired vCPUs: 0
    Max vCPUs: 256
    Instance types: optimal (AWS selects)
    Subnets: private-subnet-a, private-subnet-b
    Security groups: batch-sg
```

**Unmanaged Compute Environment:**
You provision and manage the EC2 instances yourself. Less common.

#### Job Definition

A template for your job (like a Docker Compose service definition):

```json
{
  "jobDefinitionName": "data-processor",
  "type": "container",
  "containerProperties": {
    "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/data-processor:latest",
    "vcpus": 4,
    "memory": 8192,
    "command": ["python", "main.py"],
    "jobRoleArn": "arn:aws:iam::123456789:role/batch-job-role",
    "environment": [
      {"name": "LOG_LEVEL", "value": "INFO"}
    ],
    "mountPoints": [],
    "volumes": []
  },
  "retryStrategy": {
    "attempts": 3
  },
  "timeout": {
    "attemptDurationSeconds": 3600
  }
}
```

### Job Dependencies (DAG Scheduling)

Jobs can depend on other jobs — you build a directed acyclic graph (DAG):

```
Job: extract-data
       │
       ▼
Job: transform-data  ← depends on extract-data
       │
       ├──────────────────────┐
       ▼                      ▼
Job: load-table-a       Job: load-table-b   ← both depend on transform
       │                      │
       └──────────┬───────────┘
                  ▼
           Job: send-report   ← depends on both loads
```

```bash
# Submit dependent jobs
JOB1=$(aws batch submit-job \
  --job-name extract-data \
  --job-queue my-queue \
  --job-definition data-processor \
  --query 'jobId' --output text)

JOB2=$(aws batch submit-job \
  --job-name transform-data \
  --job-queue my-queue \
  --job-definition data-transformer \
  --depends-on jobId=$JOB1 \
  --query 'jobId' --output text)
```

### Array Jobs

Run the same job multiple times in parallel with different parameters. Useful for
parallelizing large data processing tasks.

```bash
# Process 100 data files in parallel (array of 100 jobs)
aws batch submit-job \
  --job-name process-files \
  --job-queue my-queue \
  --job-definition file-processor \
  --array-properties size=100

# In your container, read AWS_BATCH_JOB_ARRAY_INDEX environment variable
# to determine which item to process (0 through 99)
# e.g., process file number $AWS_BATCH_JOB_ARRAY_INDEX
```

### AWS Batch Architecture

```
Developer/Application
        │
        │ Submit job
        ▼
┌─────────────────┐
│   Job Queue     │  (jobs wait here)
│   (Priority: 5) │
└────────┬────────┘
         │ Job scheduled
         ▼
┌─────────────────────────────────────────────┐
│   Compute Environment                        │
│                                             │
│   [EC2] [EC2] [EC2]   ← Managed by Batch   │
│                                             │
│   Batch runs container on available EC2     │
│   Scales EC2 count based on queue depth     │
└─────────────────────────────────────────────┘
         │
         │ Job complete
         ▼
   Results written to S3 / RDS / DynamoDB
```

### Common Use Cases

| Industry | Use Case |
|----------|----------|
| Financial services | End-of-day trade reconciliation, risk calculations |
| Media | Video transcoding, image resizing |
| Genomics | DNA sequencing analysis |
| Data engineering | ETL pipelines, data warehouse loading |
| Machine learning | Model training, feature engineering |
| Gaming | Game simulation, analytics processing |
| Scientific computing | Physics simulations, weather modeling |

### AWS Batch vs Lambda vs EC2

| Aspect | Lambda | AWS Batch | EC2 |
|--------|--------|-----------|-----|
| Max duration | 15 minutes | No limit | No limit |
| Max memory | 10 GB | No limit | No limit |
| Scaling | Automatic | Automatic | Manual/ASG |
| Pricing | Per request | EC2 cost only | EC2 cost |
| Container support | Yes (containers) | Yes (Docker) | Yes |
| Best for | Short tasks (<15min) | Long jobs, HPC | Custom workloads |
| Cold start | Yes | Yes (EC2 provision) | No (if running) |

---

## 4. AWS Outposts

### What is AWS Outposts?

AWS Outposts brings AWS infrastructure, services, APIs, and tools to **your on-premises
data center or co-location facility**. It's physical AWS hardware installed at your location.

```
Traditional Cloud:
  Your app → Internet → AWS Region → AWS Services

AWS Outposts:
  Your app → Local network → Outpost Rack → AWS Services
  (runs locally, in your building, on AWS hardware)
```

### The Problem Outposts Solves

Some workloads cannot go to the public cloud due to:
- **Data residency requirements**: Data must stay in a specific country or building
- **Low latency requirements**: Applications need < 1ms latency to local systems
- **Regulatory requirements**: Healthcare, government, financial data that must stay on-prem
- **Industrial applications**: Factory floor systems that cannot tolerate internet latency
- **Existing on-prem integration**: Must connect to systems that cannot be moved

### What is an Outpost Rack?

AWS ships physical server racks to your facility. You provide:
- Physical space (standard rack units)
- Power (redundant power circuits)
- Networking (uplinks to AWS region)
- Physical security

AWS provides:
- The hardware (compute, storage, networking)
- Installation and maintenance
- The full AWS API experience

```
Outpost Rack:
┌──────────────────────────────────────────────────────┐
│  AWS Outpost Rack (42U standard rack)                │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  AWS Nitro Compute Servers                  │    │
│  │  (Run EC2 instances locally)                │    │
│  ├─────────────────────────────────────────────┤    │
│  │  AWS Local Storage                          │    │
│  │  (EBS gp2 volumes, S3 on Outposts)          │    │
│  ├─────────────────────────────────────────────┤    │
│  │  AWS Networking Equipment                   │    │
│  │  (Connects to your VPC in AWS region)       │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ Dedicated high-speed connection
         │ (Direct Connect recommended)
         ▼
    AWS Region (control plane, management)
```

### Outpost Servers (1U and 2U)

For smaller deployments, AWS offers individual 1U and 2U servers (not full racks).

```
Outpost Servers:
  1U Server: Fits under a desk or in a small rack
  2U Server: Slightly more capacity

Use case:
  - Bank branch location needing local compute
  - Retail store point-of-sale systems
  - Factory edge computing
  - Healthcare clinic needing local data processing
```

### AWS Services Available on Outposts

Not all AWS services run on Outposts — only a subset that makes sense for local execution:

| Service | Notes |
|---------|-------|
| EC2 | Various instance families |
| EBS | gp2 volumes on Outpost storage |
| ECS | Run containers locally |
| EKS | Kubernetes on Outpost nodes |
| S3 (on Outposts) | Local S3 buckets |
| RDS | MySQL, PostgreSQL locally |
| ElastiCache | Redis locally |
| EMR | Big data processing locally |
| SageMaker | ML at the edge |
| ALB | Local load balancing |

Control plane (IAM, CloudFormation, console) still runs in the AWS Region.

### Outpost Connectivity

```
Outpost requires a reliable connection to the parent AWS region for:
  - AWS API calls (management operations)
  - Syncing state with the control plane
  - Services that have regional dependencies

If the connection to AWS region is lost:
  - Running EC2 instances continue running
  - EBS volumes continue working
  - NEW instance launches may fail (depends on service)
  - Control plane operations fail
  - The Outpost can run in "disconnected mode" for some services
```

### Outpost Pricing

Outposts pricing is based on a 3-year or 1-year contract for the physical capacity:

- You pay for the hardware capacity reservation (EC2 instance families)
- Plus storage (EBS gp2)
- AWS handles hardware maintenance at no extra cost

**Very expensive** compared to regular EC2 — suitable only when regulatory or technical
requirements mandate on-premises deployment.

### When to Use Outposts

**Use Outposts when:**
- Regulatory requirements mandate data stays on-premises
- Ultra-low latency to local systems is required (factory automation, trading)
- You want AWS APIs and operational consistency on-premises
- You are migrating to cloud but some workloads must stay local temporarily
- Hybrid cloud strategy with consistent tooling across cloud and on-prem

**Do NOT use Outposts when:**
- You just want cloud services (use a region)
- Cost is a concern (Outposts is expensive)
- You can meet requirements with data residency via specific AWS regions

### Outposts vs Local Zones vs Wavelength

| Feature | Outposts | Local Zones | Wavelength |
|---------|----------|-------------|------------|
| Location | Your data center | AWS-managed facility near city | Telecom network (5G) |
| Management | You provide space/power | AWS fully manages | AWS fully manages |
| Latency target | Sub-millisecond to local systems | Low-latency to specific metro area | Ultra-low latency to 5G mobile |
| Use case | Data sovereignty, on-prem | Video rendering, gaming | Mobile, IoT, AR/VR |
| Control | You manage physical access | AWS manages | AWS manages |

---

## 5. Service Comparison

### Choosing the Right Compute Service

```
What do you need to run?
        │
        ├── Function / Event-driven? ──────────────────> Lambda
        │
        ├── Container workload?
        │     ├── Manage servers yourself? ─────────────> ECS on EC2 / EKS
        │     └── Serverless containers? ───────────────> ECS Fargate / App Runner
        │
        ├── Web application?
        │     ├── Full control needed? ────────────────> EC2 + ASG + ALB
        │     ├── Just want to deploy code? ───────────> Elastic Beanstalk
        │     └── Simple/small app? ───────────────────> Lightsail
        │
        ├── Batch/scheduled jobs?
        │     ├── < 15 minutes? ───────────────────────> Lambda
        │     └── Long-running or resource-intensive? ─> AWS Batch
        │
        └── Must stay on-premises? ─────────────────────> Outposts
```

### Summary Table

| Service | Abstraction | Best For | Pricing Model | Control Level |
|---------|-------------|----------|---------------|---------------|
| EC2 | VM | Any workload | Per second | Full |
| Auto Scaling | VM group management | Scalable fleets | Included | High |
| Lightsail | Simplified VM | Simple apps, personal sites | Fixed monthly | Medium |
| Elastic Beanstalk | PaaS | Web apps (known runtimes) | EC2 + ELB cost | Medium |
| AWS Batch | Batch jobs | HPC, ETL, data processing | EC2 cost | High |
| Lambda | Functions | Event-driven, short tasks | Per request | Low |
| ECS Fargate | Containers | Microservices | Per task | Medium |
| EKS | Kubernetes | Container orchestration | Per cluster | High |
| Outposts | On-prem AWS | Data sovereignty, ultra-low lat | Contract | Full |

---

## 6. Interview Q&A

**Q1: What is Elastic Beanstalk and what does it manage for you?**
Elastic Beanstalk is AWS's PaaS service. You provide application code, and Beanstalk handles
provisioning EC2 instances, configuring Auto Scaling, creating a load balancer (ALB), setting
up health monitoring, installing the platform runtime (Node.js, Python, etc.), and deploying
code updates. You retain access to and control over all underlying resources — Beanstalk is
not a black box. You can SSH into instances, modify Auto Scaling settings, and customize via
.ebextensions configuration files.

**Q2: What are the different deployment strategies in Elastic Beanstalk?**
All-at-once: Deploys simultaneously to all instances. Fastest but causes downtime. Dev only.
Rolling: Deploys to a batch of instances at a time. No downtime but reduced capacity during
deployment. Good for non-critical production.
Rolling with additional batch: Adds extra instances first, rolls out the update, then removes
the extras. Full capacity maintained throughout. Best for production.
Immutable: Launches a completely new set of instances with the new version. When healthy, swaps
the fleets. Zero downtime, easy rollback, but temporarily doubles compute cost.
Blue/Green: Uses a separate environment (green) and swaps DNS/URL when ready. Complete isolation,
instant rollback, but requires maintaining two full environments briefly.

**Q3: When would you choose Lightsail over EC2?**
Choose Lightsail when simplicity and predictable pricing are priorities over flexibility:
- Small personal projects or websites
- WordPress or simple CMS deployments
- Migrating from DigitalOcean or Linode (familiar VPS model)
- Developers learning cloud without wanting to deal with VPC, subnets, and IAM complexity
- Budget-conscious projects where the fixed monthly pricing is easier to manage
For any production application needing Auto Scaling, complex networking, or deep AWS service
integration, EC2 with ASG and ALB is the right choice.

**Q4: What is AWS Batch and how does it differ from running workloads on EC2 directly?**
AWS Batch is a managed service for batch computing. The key differences from raw EC2:
- Batch scales compute to zero when no jobs are queued (huge cost savings vs always-on EC2)
- Automatic job queuing, scheduling, and retry handling
- Supports job dependencies (run job B only after job A completes)
- Array jobs (run same job N times in parallel with different inputs)
- Managed spot instances (Batch optimizes for cost using Spot automatically)
- No need to manage job scheduling infrastructure (no Cron, no job scheduler EC2 instances)
On raw EC2, you would need to build all this yourself — a queue (SQS), workers, retry logic,
scheduling, and autoscaling based on queue depth.

**Q5: What is AWS Outposts and who should use it?**
AWS Outposts brings AWS hardware, APIs, and services to your on-premises data center. AWS ships
physical server racks that you install in your facility. You get the same AWS APIs (EC2, EBS,
ECS, RDS, etc.) running locally. The target audience is organizations that:
- Have regulatory requirements mandating data stays on-premises (government, healthcare, finance)
- Need ultra-low latency to on-premises systems (factory automation, algorithmic trading)
- Want operational consistency between cloud and on-prem (same APIs, tooling, and operations)
- Have workloads that legally cannot leave a country or facility
Outposts is expensive and complex to operate. It is only justified when regulatory or latency
requirements genuinely prevent using the public AWS cloud.

**Q6: What is the difference between Elastic Beanstalk and raw EC2 with ASG?**
Elastic Beanstalk is an opinionated abstraction built on top of EC2 + ASG + ALB. It makes
opinionated choices about how these services are configured and provides a simplified interface
for deploying code. Raw EC2 + ASG + ALB gives you full control over every configuration detail
but requires much more expertise to set up correctly. Beanstalk is appropriate for standard web
applications where the default configurations work. Raw EC2 + ASG + ALB is appropriate when you
need custom configurations, specific instance types or families, non-standard scaling behavior,
or tight integration with other AWS services in ways Beanstalk doesn't support natively.

**Q7: How does AWS Batch handle job failures and retries?**
You configure a retry strategy in the job definition specifying how many times Batch should
attempt a failed job (1-10 attempts). You can also set evaluate-on-action rules to retry only
on specific exit codes, status reasons, or status codes — for example, retry on Spot
interruptions but not on application errors. Each retry runs in a fresh container on a new
(potentially different) EC2 instance. Combined with the timeout setting (max duration per
attempt), this provides robust failure handling for long-running batch workloads.

**Q8: Can you use Elastic Beanstalk for Docker containers?**
Yes. Beanstalk supports single-container Docker deployments (one container per EC2 instance)
and multi-container Docker (using Amazon ECS under the hood, multiple containers per instance
via a Dockerrun.aws.json file). However, for serious containerized workloads, ECS or EKS are
more appropriate as they offer richer container orchestration features. Beanstalk's Docker
support is best for teams that want the Beanstalk operational model (easy deployments, managed
platform updates) but need to deploy a containerized application.
