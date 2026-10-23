# EC2: Elastic Compute Cloud — The Complete Guide

## Table of Contents

1. [What is EC2?](#1-what-is-ec2)
2. [Instance Types](#2-instance-types)
3. [AMI — Amazon Machine Image](#3-ami--amazon-machine-image)
4. [Launching an EC2 Instance](#4-launching-an-ec2-instance)
5. [Storage — EBS](#5-storage--ebs)
6. [Security Groups](#6-security-groups)
7. [Key Pairs](#7-key-pairs)
8. [Elastic IP](#8-elastic-ip)
9. [User Data](#9-user-data)
10. [Instance Lifecycle](#10-instance-lifecycle)
11. [Pricing Models](#11-pricing-models)
12. [Placement Groups](#12-placement-groups)
13. [Instance Metadata](#13-instance-metadata)
14. [Hands-On Projects](#14-hands-on-projects)
15. [Interview Q&A](#15-interview-qa)

---

## 1. What is EC2?

**EC2 (Elastic Compute Cloud)** is AWS's core virtual machine service. It lets you rent
computing capacity in the cloud rather than buying and managing physical hardware.

### The Virtual Machine Concept

A physical server has fixed CPU, RAM, and storage. A **virtual machine (VM)** is a software
emulation of a computer that runs on top of physical hardware. A single physical host can run
many VMs simultaneously, each isolated from the others.

```
Physical Host (AWS Data Center)
┌────────────────────────────────────────────────────┐
│  Physical CPU: 96 cores   RAM: 384 GB   SSD: 6 TB  │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Your VM    │  │  VM (other  │  │  VM (other  │ │
│  │  (EC2)      │  │  customer)  │  │  customer)  │ │
│  │  2 vCPU     │  │  4 vCPU     │  │  8 vCPU     │ │
│  │  8 GB RAM   │  │  16 GB RAM  │  │  32 GB RAM  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                      │
│            Hypervisor (AWS Nitro System)             │
└────────────────────────────────────────────────────┘
```

### Why EC2 vs Physical Server?

| Factor | Physical Server | EC2 |
|--------|----------------|-----|
| Provisioning time | Weeks to months | Seconds |
| Upfront cost | High capital expenditure | None |
| Capacity planning | Must buy for peak load | Scale on demand |
| Hardware maintenance | Your responsibility | AWS responsibility |
| Geographic expansion | Very expensive | Click a region |
| Elasticity | None (fixed capacity) | Add/remove instantly |
| Billing | Fixed regardless of use | Pay per second |

### EC2 Core Concepts

- **Instance**: A single running virtual machine
- **vCPU**: Virtual CPU core (maps to a physical CPU thread)
- **AMI**: The operating system + pre-installed software image
- **EBS Volume**: Persistent disk attached to the instance
- **Security Group**: Virtual firewall controlling traffic
- **Key Pair**: SSH credentials to log into the instance
- **Region/AZ**: Where the instance runs geographically

---

## 2. Instance Types

### Naming Convention

Every EC2 instance type follows a structured naming pattern:

```
m 5 . x l a r g e
│ │   └───────────── Size
│ └───────────────── Generation
└───────────────────── Family
```

Examples:
- `t3.micro` — T family (burstable), 3rd generation, micro size
- `m6i.2xlarge` — M family (general purpose), 6th generation, Intel, 2x large
- `c5n.4xlarge` — C family (compute), 5th generation, network optimized, 4x large

Size progression (from smallest to largest):
```
nano < micro < small < medium < large < xlarge < 2xlarge < 4xlarge < 8xlarge < 12xlarge < 16xlarge < 24xlarge < 48xlarge < metal
```

### Instance Families Overview

#### General Purpose — T, M, Mac

**T Series (Burstable)**: `t2.micro`, `t3.small`, `t3a.medium`

Best for workloads that need occasional CPU bursts but are mostly idle or low CPU.

- Web servers with variable traffic
- Development and test environments
- Small databases
- Microservices

T instances have a **CPU credit** system (explained below).

---

**M Series**: `m5.large`, `m6i.xlarge`, `m6a.2xlarge`

Balanced CPU and memory. The workhorse of EC2.

- Application servers
- Backend APIs
- Small to medium databases
- Gaming servers
- Cache fleets

---

**Mac**: `mac1.metal`, `mac2.metal`

Dedicated Apple Mac hardware. Required for building/testing macOS and iOS apps.

---

#### Compute Optimized — C

**C Series**: `c5.large`, `c6i.xlarge`, `c7g.2xlarge`

High CPU-to-memory ratio. For CPU-intensive workloads.

- Batch processing
- High-performance web servers
- Scientific modeling
- Media transcoding
- Machine learning inference
- Gaming (dedicated game servers)

---

#### Memory Optimized — R, X, z, High Memory

**R Series**: `r5.large`, `r6i.2xlarge`

High memory-to-CPU ratio. For in-memory workloads.

- In-memory databases (Redis, Memcached)
- Real-time big data analytics
- Large relational databases (MySQL, PostgreSQL with large datasets)
- SAP HANA
- Apache Spark

---

**X Series**: `x1.16xlarge`, `x2idn.16xlarge`

Extreme memory. For the largest in-memory workloads.

- SAP HANA
- Apache Spark in-memory analytics
- Very large relational databases

---

**z Series**: `z1d.large`

High frequency CPU + large memory. For EDA workloads.

---

#### Storage Optimized — I, D, H

**I Series (NVMe SSD)**: `i3.large`, `i3en.xlarge`, `i4i.xlarge`

Very high I/O throughput, low latency local NVMe storage.

- NoSQL databases (Cassandra, MongoDB)
- Distributed file systems
- Data warehousing
- Elasticsearch / OpenSearch

---

**D Series (HDD)**: `d3.xlarge`, `d3en.xlarge`

High sequential read/write with dense HDD storage. Cheapest $/TB of local storage.

- Hadoop distributed computing
- Data warehousing
- Log processing

---

**H Series**: `h1.2xlarge`

High disk throughput, balance of compute and storage.

- MapReduce workloads
- HDFS
- Distributed file systems

---

#### Accelerated Computing — P, G, Trn, Inf, F, VT

**P Series (NVIDIA GPU)**: `p3.2xlarge`, `p4d.24xlarge`

- Deep learning training
- HPC simulations
- GPU rendering

**G Series (NVIDIA GPU, lower cost)**: `g4dn.xlarge`, `g5.xlarge`

- ML inference at scale
- Video encoding
- Remote desktop / virtual workstations
- Game streaming

**Trn Series**: `trn1.2xlarge`

AWS Trainium chips — optimized and cost-effective for deep learning training.

**Inf Series**: `inf1.xlarge`, `inf2.xlarge`

AWS Inferentia chips — high-throughput, low-cost ML inference.

**F Series (FPGA)**: `f1.2xlarge`

Field-programmable gate arrays for custom hardware acceleration.

---

### Instance Type Comparison Table

| Family | Ratio | Primary Use Case | Example Type | vCPU | RAM |
|--------|-------|-----------------|--------------|------|-----|
| t3 | Balanced (burstable) | Dev/test, low traffic web | t3.medium | 2 | 4 GB |
| m6i | Balanced | App servers, APIs | m6i.xlarge | 4 | 16 GB |
| c6i | CPU-heavy | Batch, HPC, web | c6i.xlarge | 4 | 8 GB |
| r6i | Memory-heavy | In-memory DBs | r6i.xlarge | 4 | 32 GB |
| x2idn | Extreme memory | SAP HANA | x2idn.16xlarge | 64 | 1024 GB |
| i4i | NVMe storage | NoSQL, search | i4i.xlarge | 4 | 32 GB |
| p3 | GPU (training) | Deep learning | p3.2xlarge | 8 | 61 GB |
| g4dn | GPU (inference) | ML inference | g4dn.xlarge | 4 | 16 GB |
| inf2 | Inferentia | LLM inference | inf2.xlarge | 4 | 16 GB |

---

### T2/T3 CPU Credits — Explained

T instances work on a **credit system**. When the instance uses less than its baseline CPU,
it earns credits. When it needs more CPU, it spends credits.

```
CPU Usage Over Time:

100%|              ___
    |             /   \
 50%|  baseline  /     \
    |___________/       \_______
  0%|
    |----time--->

Credits: +++++ +++++ ----- +++++ (earning when below baseline, spending when above)
```

Baseline CPU by size:
- `t3.nano`: 5% baseline
- `t3.micro`: 10% baseline
- `t3.small`: 20% baseline
- `t3.medium`: 20% baseline
- `t3.large`: 30% baseline
- `t3.xlarge`: 40% baseline

**T3 Unlimited Mode**: Instance can burst indefinitely — AWS charges for extra CPU credits
used above the baseline at a small per-credit price. T2 also supports unlimited mode.

**When to use T3 vs M5**: If your app is idle most of the time but occasionally spikes (a
marketing site, a dev server, a small API), T3 is significantly cheaper. If you need
consistently high CPU, use M or C family.

---

## 3. AMI — Amazon Machine Image

### What is an AMI?

An AMI is a **snapshot of a virtual machine's disk** that defines what the EC2 instance
boots into. It contains:

- The root operating system (Linux, Windows)
- Pre-installed software (web servers, runtimes, agents)
- Configuration and settings
- Block device mapping (how many disks, sizes)

```
AMI
├── Root Volume Snapshot (OS)
│   ├── Operating System (e.g., Amazon Linux 2)
│   ├── System libraries
│   └── Pre-installed software
├── Block Device Mapping
│   ├── /dev/xvda  → 8 GB gp3 (root)
│   └── /dev/xvdb  → 20 GB gp3 (optional data)
└── Permissions (who can use this AMI)
```

### Types of AMIs

#### AWS-Provided AMIs

Maintained by AWS. Free to use (you pay for EC2 instance, not the AMI).

| AMI | Use Case | Package Manager |
|-----|----------|----------------|
| Amazon Linux 2 | General purpose, AWS-optimized | yum / dnf |
| Amazon Linux 2023 | Latest AWS Linux | dnf |
| Ubuntu 22.04 LTS | Popular open source | apt |
| Ubuntu 20.04 LTS | Stable open source | apt |
| Red Hat Enterprise Linux (RHEL) | Enterprise Linux | yum |
| Windows Server 2022 | Windows workloads | (GUI/PowerShell) |
| Windows Server 2019 | Windows workloads | (GUI/PowerShell) |
| Debian | Lightweight Linux | apt |

**Amazon Linux 2 is recommended for most AWS workloads** — it comes with the AWS CLI,
SSM agent, and is tuned for the Nitro hypervisor.

#### Custom AMIs — Why Create One

Imagine you need to launch 50 identical web servers. Instead of installing Node.js, Nginx,
your application, and dependencies on every single server, you:

1. Launch one EC2 instance
2. Install and configure everything
3. Create an AMI from that running instance
4. Launch all 50 servers from your custom AMI (seconds to boot, fully configured)

Benefits:
- Faster launch times (no bootstrap time)
- Consistent configuration across all instances
- Use in Auto Scaling Groups
- Disaster recovery — rebuild servers quickly
- Environment parity (dev/staging/prod use same AMI)

#### How to Create a Custom AMI

```
Step 1: Launch base instance (e.g., Amazon Linux 2)
Step 2: SSH in and configure
        $ sudo yum update -y
        $ sudo yum install -y nodejs nginx
        $ sudo systemctl enable nginx
        # ... configure your app

Step 3: In AWS Console → EC2 → Instances
        Right-click instance → Image and templates → Create image

Step 4: Set:
        - Image name: my-app-server-v1.0
        - No reboot: false (recommended to ensure filesystem consistency)

Step 5: AWS takes EBS snapshots and registers the AMI
        (takes 2-10 minutes depending on disk size)

Step 6: AMI appears under EC2 → AMIs with state "available"
```

#### AMI Sharing

- **Private (default)**: Only your account can use it
- **Shared with specific accounts**: Add AWS account IDs to AMI permissions
- **Public**: Anyone can use it (be careful with sensitive data)

```
Sharing an AMI:
EC2 Console → AMIs → Select AMI → Actions → Edit AMI permissions
→ Add account ID: 123456789012
```

#### Community AMIs

AMIs published by the community (not AWS). Can be found in the AMI catalog. Use with caution
— verify the publisher and check for malware.

#### AWS Marketplace AMIs

Commercial AMIs sold by third-party vendors (Bitnami, HashiCorp, etc.). Examples:
- WordPress by Bitnami (pre-configured LAMP stack)
- Kali Linux (penetration testing)
- Palo Alto Networks NGFW
- Cisco virtual appliances

Marketplace AMIs may have an additional hourly software charge on top of EC2 costs.

---

## 4. Launching an EC2 Instance

### Step-by-Step Launch Guide

#### Step 1: Navigate to EC2

AWS Console → EC2 → Instances → Launch instances

#### Step 2: Name Your Instance

Give it a descriptive name: `web-server-prod-01`

Tags are added here too:
- `Environment: Production`
- `Team: Backend`
- `Project: MyApp`

#### Step 3: Choose AMI

Search for "Amazon Linux 2023" → Select the free tier eligible option.

For production you might choose Ubuntu 22.04 or a custom AMI.

#### Step 4: Choose Instance Type

- `t2.micro` for free tier / dev
- `t3.medium` for small production web servers
- `m6i.xlarge` for medium production APIs

#### Step 5: Key Pair

- Select existing key pair, OR
- Create a new key pair
  - Name: `my-key-pair`
  - Type: RSA
  - Format: .pem (for Mac/Linux) or .ppk (for Windows/PuTTY)
  - Download and save the .pem file immediately (you cannot download it again)

#### Step 6: Network Settings

```
VPC:            vpc-0abc123 (your VPC or default VPC)
Subnet:         subnet-0xyz (public subnet in your preferred AZ)
Auto-assign public IP: Enable (needed for SSH from internet)

Security Group: Create new or select existing
  - Allow SSH (port 22) from My IP
  - Allow HTTP (port 80) from Anywhere
  - Allow HTTPS (port 443) from Anywhere
```

#### Step 7: Configure Storage

Root volume:
- Size: 8 GB (default) — increase if you need more
- Volume type: gp3 (recommended over gp2)
- Encrypted: Yes (recommended)
- Delete on termination: Yes (default — the volume goes away when instance is terminated)

Add additional volumes if needed (for data, logs, etc.)

#### Step 8: Advanced Details (Optional)

- User Data: paste a bootstrap script (covered in section 9)
- IAM Instance Profile: attach a role so the instance can call AWS APIs
- Detailed monitoring: enable CloudWatch detailed metrics
- Tenancy: Shared (default), Dedicated Host, Dedicated Instance

#### Step 9: Launch

Click "Launch instance". AWS puts the instance into the "pending" state. Within 30-60
seconds it transitions to "running".

#### Step 10: Connect via SSH

```bash
# 1. Set permissions on your key file (Mac/Linux)
chmod 400 ~/Downloads/my-key-pair.pem

# 2. Get the public IP or DNS from EC2 console

# 3. Connect
ssh -i ~/Downloads/my-key-pair.pem ec2-user@54.123.45.67

# For Ubuntu instances, the username is 'ubuntu' not 'ec2-user'
ssh -i ~/Downloads/my-key-pair.pem ubuntu@54.123.45.67

# For Amazon Linux, use ec2-user
# For RHEL, use ec2-user or root
# For CentOS, use centos
# For Debian, use admin
```

**You can also use EC2 Instance Connect** (browser-based SSH) from the AWS Console without
needing to manage key files.

**Or AWS Systems Manager Session Manager** — no SSH port needed, no key pair required,
full audit logging.

---

## 5. Storage — EBS

### What is EBS?

**EBS (Elastic Block Store)** is a persistent, network-attached block storage service for EC2.
Think of it as a hard drive that exists in the cloud and can be attached to your instance.

```
                    AWS Region (us-east-1)
                    Availability Zone A
          ┌─────────────────────────────────┐
          │                                 │
          │   ┌────────────┐                │
          │   │  EC2       │                │
          │   │  Instance  │─── Network ───>│──> EBS Volume
          │   └────────────┘                │    (in same AZ)
          │                                 │
          └─────────────────────────────────┘
```

**Key characteristics:**
- Persists independently of the EC2 instance (data survives instance stop/start)
- Can be detached from one instance and attached to another (in the same AZ)
- Automatically replicated within its Availability Zone
- Can be backed up using snapshots
- Can be encrypted

### EBS vs Instance Store

| Feature | EBS | Instance Store |
|---------|-----|---------------|
| Persistence | Survives stop/restart | Lost when instance stops |
| Performance | Very good | Extremely fast (physically attached) |
| Size | Up to 64 TB | Fixed by instance type |
| Cost | Pay per GB | Included in instance price |
| Snapshots | Yes | No |
| Best for | General storage, databases | Temp data, cache, buffers |

Instance store (also called "ephemeral storage") is physically attached NVMe on the host.
Data is lost if the instance stops, crashes, or is terminated. Never store persistent data there.

### EBS Volume Types

#### SSD-Based (Low Latency, Random I/O)

**gp3 — General Purpose SSD v3 (Recommended Default)**
- 3,000 IOPS baseline (independent of size)
- 125 MB/s throughput baseline
- Can provision up to 16,000 IOPS and 1,000 MB/s separately
- 1 GB to 16 TB
- Use: Most workloads, root volumes, databases
- Cost: ~$0.08/GB-month

**gp2 — General Purpose SSD v2 (Legacy)**
- IOPS tied to size: 3 IOPS per GB, minimum 100, maximum 16,000
- Burst up to 3,000 IOPS for volumes under 1 TB
- 1 GB to 16 TB
- Use: Older setups — prefer gp3 for new workloads
- Cost: ~$0.10/GB-month (more expensive than gp3)

**io2 Block Express — Provisioned IOPS SSD (High Performance)**
- Up to 256,000 IOPS
- Up to 4,000 MB/s throughput
- 99.999% durability (vs 99.8-99.9% for gp3)
- Multi-attach support (attach to multiple EC2 instances simultaneously)
- 4 GB to 64 TB
- Use: Mission-critical databases (Oracle RAC, large SQL databases), SAP
- Cost: ~$0.125/GB-month + $0.065/provisioned IOPS-month

**io1 — Provisioned IOPS SSD (Legacy)**
- Up to 64,000 IOPS
- Older generation — prefer io2 for new workloads

#### HDD-Based (High Throughput, Sequential I/O)

**st1 — Throughput Optimized HDD**
- Baseline throughput: 40 MB/s per TB
- Burst throughput: 250 MB/s per TB, max 500 MB/s
- Max IOPS: 500 (low, HDDs are slow at random I/O)
- 125 GB to 16 TB
- Cannot be root volume
- Use: Big data, data warehouses, log processing, Kafka
- Cost: ~$0.045/GB-month

**sc1 — Cold HDD**
- Baseline throughput: 12 MB/s per TB
- Burst throughput: 80 MB/s per TB, max 250 MB/s
- 125 GB to 16 TB
- Cannot be root volume
- Use: Infrequently accessed data, cold archives
- Cost: ~$0.015/GB-month (cheapest EBS option)

#### Summary Table

| Type | Use Case | Max IOPS | Max Throughput | Cost/GB |
|------|----------|----------|----------------|---------|
| gp3 | Most workloads | 16,000 | 1,000 MB/s | $0.08 |
| gp2 | Legacy | 16,000 | 250 MB/s | $0.10 |
| io2 | Critical DBs | 256,000 | 4,000 MB/s | $0.125 |
| io1 | High IOPS | 64,000 | 1,000 MB/s | $0.125 |
| st1 | Big data | 500 | 500 MB/s | $0.045 |
| sc1 | Cold archive | 250 | 250 MB/s | $0.015 |

### Root Volume vs Additional Volumes

- **Root volume**: Where the OS is installed. Created automatically when launching an instance.
  Default size is 8 GB for Linux. Can increase size.
- **Additional volumes**: Extra disks you attach for data, logs, databases, etc. They must be
  formatted and mounted before use.

### EBS Snapshots

A snapshot is a **point-in-time backup** of an EBS volume, stored in S3 (AWS manages this).

**How snapshots work:**

```
Initial Snapshot (Full):
EBS Volume: [A][B][C][D][E]
Snapshot 1: [A][B][C][D][E]  ← Full copy

After changes (B and D changed):
EBS Volume: [A][B'][C][D'][E]
Snapshot 2: [B'][D']          ← Incremental (only changes)

After more changes (A changed):
EBS Volume: [A'][B'][C][D'][E]
Snapshot 3: [A']              ← Incremental again
```

Snapshots are incremental — only blocks changed since the last snapshot are stored. But each
snapshot is self-sufficient for restore (you don't need to apply multiple snapshots in order).

**Creating a snapshot:**
```
EC2 → Volumes → Select volume → Actions → Create snapshot
```

Or via CLI:
```bash
aws ec2 create-snapshot \
  --volume-id vol-0abc123def456 \
  --description "My backup $(date +%Y-%m-%d)"
```

**Restoring from snapshot:**
```
EC2 → Snapshots → Select snapshot → Actions → Create volume from snapshot
  - Choose size (can be larger than original)
  - Choose AZ (can restore to different AZ)
  - Choose volume type
```

**Cross-region copy:**
```
Snapshots → Select snapshot → Actions → Copy snapshot
→ Choose destination region
```

This is how you migrate EC2 instances between regions:
snapshot → copy to new region → create volume → attach to new instance.

### EBS Encryption

- Uses AWS KMS (Key Management Service) under the hood
- AES-256 encryption
- Encryption is transparent — no application changes needed
- Data is encrypted at rest and in transit between EBS and EC2
- Snapshots of encrypted volumes are automatically encrypted

To encrypt an existing unencrypted volume:
1. Take a snapshot of the volume
2. Copy the snapshot with encryption enabled
3. Create a new volume from the encrypted snapshot
4. Swap the volumes

### EBS vs S3 vs EFS Comparison

| Feature | EBS | S3 | EFS |
|---------|-----|-----|-----|
| Type | Block storage | Object storage | File storage (NFS) |
| Access | Single EC2 (mostly) | Any service, internet | Multiple EC2s simultaneously |
| Protocol | Block (like a hard disk) | REST API (HTTP) | NFS v4 |
| Persistence | Tied to AZ | Global | Regional |
| Performance | Very high IOPS | Lower | Medium |
| Use case | OS disk, databases | Static files, backups | Shared file system |
| Pricing | Per GB provisioned | Per GB stored + requests | Per GB stored |
| Managed | Yes | Yes | Yes |

---

## 6. Security Groups

### What are Security Groups?

A Security Group is a **virtual firewall** that controls inbound and outbound traffic for EC2
instances. Every EC2 instance must have at least one security group.

```
Internet
    |
    v
┌──────────────────────────────────────────┐
│             Security Group               │
│   Inbound Rules:                         │
│     ALLOW port 22  from 203.0.113.5/32   │
│     ALLOW port 80  from 0.0.0.0/0        │
│     ALLOW port 443 from 0.0.0.0/0        │
│                                          │
│   Outbound Rules:                        │
│     ALLOW all traffic to 0.0.0.0/0       │
│                                          │
│   ┌────────────────┐                     │
│   │  EC2 Instance  │                     │
│   └────────────────┘                     │
└──────────────────────────────────────────┘
```

### Inbound vs Outbound Rules

**Inbound rules** control what traffic is allowed INTO the instance.
**Outbound rules** control what traffic is allowed OUT of the instance.

By default:
- All inbound traffic is DENIED
- All outbound traffic is ALLOWED

### Stateful Nature

Security Groups are **stateful** — if you allow inbound traffic on port 80, the response
traffic is automatically allowed out, even if there is no explicit outbound rule.

```
Client ──────────────────────> EC2 (port 80 inbound allowed)
Client <────────────────────── EC2 (response automatically allowed — STATEFUL)
```

This is different from NACLs (Network ACLs) which are **stateless** and require explicit
rules in both directions.

### Security Group Rule Components

Each rule specifies:
- **Type**: Protocol shorthand (SSH, HTTP, HTTPS, Custom TCP, etc.)
- **Protocol**: TCP, UDP, ICMP, or All
- **Port Range**: Single port (22) or range (8080-8090)
- **Source/Destination**: IP CIDR, Security Group ID, or prefix list

**Source can be:**
- `0.0.0.0/0` — All IPv4 addresses (open to everyone)
- `::/0` — All IPv6 addresses
- `203.0.113.5/32` — A specific IP address
- `10.0.0.0/8` — A range of IPs (private network)
- `sg-0abc123def` — Another security group (allows traffic from instances in that SG)

### Referencing Security Groups

A powerful pattern is to use a security group as a source instead of an IP.

Example: Allow RDS to only accept connections from your app servers:

```
App Server Security Group: sg-app-server
RDS Security Group: sg-database

RDS Inbound Rule:
  Protocol: TCP
  Port: 3306
  Source: sg-app-server   ← Only EC2 instances in sg-app-server can connect
```

This is more secure than using IP ranges because IPs change but the security group
membership is managed centrally.

### Default Security Group

Every VPC has a default security group that:
- Allows all inbound traffic from instances in the same security group
- Allows all outbound traffic
- Is NOT recommended for production — create specific security groups instead

### Common Security Group Configurations

**Public Web Server:**
```
Inbound:
  HTTP   TCP  80   0.0.0.0/0    (web traffic)
  HTTPS  TCP  443  0.0.0.0/0    (secure web traffic)
  SSH    TCP  22   YOUR-IP/32   (admin access from your IP only)

Outbound:
  All traffic  All  All  0.0.0.0/0  (allow all responses)
```

**Application Server (behind load balancer):**
```
Inbound:
  Custom TCP  8080  sg-load-balancer   (only ALB can reach this)
  SSH         22    sg-bastion-host    (only bastion/jump box can SSH)

Outbound:
  All traffic  All  All  0.0.0.0/0
```

**RDS Database:**
```
Inbound:
  MySQL/Aurora  TCP  3306  sg-app-server  (only app servers)

Outbound:
  All traffic  All  All  0.0.0.0/0
```

**Redis/ElastiCache:**
```
Inbound:
  Custom TCP  6379  sg-app-server  (only app servers)
```

### Security Group Best Practices

1. **Principle of least privilege** — only open ports you actually need
2. **Never open SSH to 0.0.0.0/0** — use your IP or a bastion host
3. **Use security group references** instead of IP addresses where possible
4. **Separate security groups** for web tier, app tier, and data tier
5. **Name and tag** security groups clearly
6. **Audit regularly** — remove unused rules
7. **Use AWS Security Hub** or Config to detect overly permissive rules
8. **For production**, use AWS Systems Manager Session Manager instead of opening port 22 at all

---

## 7. Key Pairs

### Public/Private Key Concept

EC2 uses asymmetric cryptography for SSH authentication.

```
Key Pair Generation:
┌─────────────────────────────────────┐
│  Private Key (.pem file)            │
│  ─────────────────────              │
│  Stays on YOUR computer             │
│  Never share this                   │
│  Never upload to S3/GitHub          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Public Key                         │
│  ─────────────                      │
│  AWS stores this                    │
│  Copied to ~/.ssh/authorized_keys   │
│  on the EC2 instance                │
└─────────────────────────────────────┘
```

When you SSH into an EC2 instance:
1. Your SSH client uses the private key to sign a challenge
2. The EC2 instance verifies the signature using the stored public key
3. If valid, access is granted (no password needed)

### .pem vs .ppk Files

- **.pem**: Standard PEM format, used by OpenSSH on Mac and Linux
- **.ppk**: PuTTY Private Key format, used by PuTTY on Windows

Converting .pem to .ppk (for PuTTY):
```
Open PuTTYgen → Load .pem file → Save private key as .ppk
```

Modern Windows 10/11 includes OpenSSH, so you can use .pem files directly in PowerShell.

### Connecting from Mac/Linux

```bash
# Step 1: Fix permissions (required or SSH will refuse the key)
chmod 400 ~/keys/my-key-pair.pem

# Step 2: Connect
ssh -i ~/keys/my-key-pair.pem ec2-user@54.123.45.67

# Step 3 (optional): Add to SSH config for convenience
# ~/.ssh/config
Host myserver
    HostName 54.123.45.67
    User ec2-user
    IdentityFile ~/keys/my-key-pair.pem

# Then just:
ssh myserver
```

### Connecting from Windows

**Option 1: PowerShell / Windows Terminal (Windows 10+)**
```powershell
# Set permissions on the file
icacls "C:\keys\my-key-pair.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"

# Connect
ssh -i C:\keys\my-key-pair.pem ec2-user@54.123.45.67
```

**Option 2: PuTTY**
1. Convert .pem to .ppk using PuTTYgen
2. Open PuTTY → Host: `54.123.45.67`
3. Connection → SSH → Auth → Browse to .ppk file
4. Open

### What if You Lose the Key?

You cannot recover a lost key pair — AWS does not store the private key.

**Recovery options:**

**Option 1: If instance is EBS-backed (most common)**
1. Stop the instance
2. Detach the root EBS volume
3. Attach it to another instance as a secondary volume
4. Mount the volume and edit `/home/ec2-user/.ssh/authorized_keys`
5. Add your new public key
6. Reattach to original instance and start

**Option 2: Using EC2 Instance Connect (if enabled)**
Even without a key pair, EC2 Instance Connect can push a temporary public key if you have
IAM permission to use it.

**Option 3: AWS Systems Manager Session Manager**
Does not require key pairs at all. Access via browser or CLI using IAM authentication.

---

## 8. Elastic IP

### Why EC2 Public IPs Change

When you launch an EC2 instance in a public subnet, AWS assigns a dynamic public IP address.
This IP:
- Is assigned from AWS's IP pool
- **Changes every time you stop and start the instance**
- Is free while the instance is running

This is a problem if you have:
- DNS records pointing to the IP
- Firewall rules on the IP
- Client applications hardcoded to the IP

### What is Elastic IP?

An **Elastic IP (EIP)** is a **static, public IPv4 address** that you own and can associate
with any EC2 instance in your account.

```
Without EIP:
  Start instance  → gets 54.123.45.67
  Stop instance   → IP released
  Start instance  → gets 18.234.56.78  ← DIFFERENT IP

With EIP:
  Allocate EIP    → 54.200.100.50 (yours permanently)
  Associate with instance A → 54.200.100.50 → Instance A
  Instance A stops → 54.200.100.50 still yours, just unassociated
  Associate with instance B → 54.200.100.50 → Instance B
```

### How to Allocate and Associate an Elastic IP

**Allocate:**
```
EC2 → Elastic IPs → Allocate Elastic IP address
  → Network Border Group: your region
  → Allocate
```

**Associate:**
```
EC2 → Elastic IPs → Select EIP → Actions → Associate Elastic IP address
  → Resource type: Instance
  → Instance: select your instance
  → Associate
```

**Via CLI:**
```bash
# Allocate
aws ec2 allocate-address --domain vpc

# Returns: AllocationId: eipalloc-0abc123
# Returns: PublicIp: 54.200.100.50

# Associate
aws ec2 associate-address \
  --instance-id i-0abc123def456 \
  --allocation-id eipalloc-0abc123
```

### Elastic IP Costs

| Status | Cost |
|--------|------|
| Associated with running instance | Free |
| Allocated but NOT associated | $0.005/hour (~$3.60/month) |
| Associated with stopped instance | $0.005/hour |

AWS charges for unassociated EIPs to discourage IP hoarding (IPv4 addresses are scarce).
Always release EIPs you are not using.

### Elastic IP Limits

- Default limit: 5 EIPs per region per account
- Can request increases via AWS Support

---

## 9. User Data

### What is User Data?

User Data is a **bootstrap script** that runs automatically the first time an EC2 instance
starts. It runs as root (on Linux). Use it to:

- Install software packages
- Configure applications
- Download and start your code
- Register with config management tools
- Set environment variables

### User Data Execution

```
EC2 Instance Boot Sequence:
1. Kernel starts
2. System services start (systemd/init)
3. AWS user-data script runs (as root)
4. Your instance is ready
```

User data runs only **once** on the first boot (by default). You can configure it to run on
every boot with `cloud-init` directives.

### Example Scripts

**Install and start Nginx:**
```bash
#!/bin/bash
# Update packages
yum update -y

# Install Nginx
amazon-linux-extras install nginx1 -y

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create a simple homepage
echo "<h1>Hello from $(hostname)</h1>" > /usr/share/nginx/html/index.html
```

**Install Node.js app:**
```bash
#!/bin/bash
set -ex  # Exit on error, print each command

# Update system
yum update -y

# Install Node.js 18 via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="/root/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18

# Install PM2 globally
npm install -g pm2

# Clone and run app
cd /opt
git clone https://github.com/myorg/myapp.git
cd myapp
npm install
pm2 start index.js --name myapp
pm2 startup systemd -u root
pm2 save
```

**Docker + app setup:**
```bash
#!/bin/bash
yum update -y
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Pull and run container
docker pull myapp:latest
docker run -d -p 80:3000 --restart unless-stopped myapp:latest
```

### User Data Size Limit

Maximum user data size: **16 KB** (plain text) or **64 KB** when Base64 encoded.

For larger scripts, store in S3 and download in a small user data script:
```bash
#!/bin/bash
aws s3 cp s3://my-bucket/setup.sh /tmp/setup.sh
chmod +x /tmp/setup.sh
/tmp/setup.sh
```

### Viewing User Data Logs

On the instance, user data output is logged to:
```bash
# Amazon Linux / RHEL
cat /var/log/cloud-init-output.log

# View in real-time during boot
tail -f /var/log/cloud-init-output.log
```

---

## 10. Instance Lifecycle

### State Diagram

```
                      ┌─────────┐
  Launch Instance ──> │ PENDING │
                      └────┬────┘
                           │ (Instance ready)
                      ┌────▼────┐
          ┌──────────>│ RUNNING │<──────────┐
          │           └────┬────┘           │
          │                │                │
          │ Start     ┌────▼──────┐    ┌────┴──────┐
          │           │ STOPPING  │    │ REBOOTING │
          │           └────┬──────┘    └───────────┘
          │                │
          │           ┌────▼──────┐
          └───────────│  STOPPED  │
                      └────┬──────┘
                           │ Terminate
                      ┌────▼──────────┐
                      │ SHUTTING-DOWN │
                      └───────┬───────┘
                               │
                      ┌────────▼───────┐
                      │  TERMINATED    │
                      └────────────────┘
```

### Stop vs Terminate

| Action | Effect on Instance | Effect on EBS Root Volume | Restartable? |
|--------|-------------------|--------------------------|--------------|
| Stop | Instance halts | EBS persists (data kept) | Yes |
| Terminate | Instance destroyed | EBS deleted (by default) | No |
| Reboot | Graceful OS restart | EBS untouched | Yes (same session) |

**Stop**: Like shutting down your laptop. The files are still there. You pay for EBS storage
but NOT for EC2 compute. The instance gets a new public IP when started again (unless EIP).

**Terminate**: Like throwing your laptop away. The OS disk is gone. You are not billed.
Data volumes (non-root) survive if "Delete on Termination" is unchecked.

**Protect against accidental termination:**
```
EC2 Console → Instance → Actions → Instance Settings → Change Termination Protection → Enable
```

### Hibernate

EC2 Hibernate saves the **RAM contents** to the root EBS volume when hibernating.
On startup, RAM is restored and the instance resumes from where it left off.

Requirements:
- Instance RAM must be under 150 GB
- Root EBS volume must be large enough to store RAM
- Root EBS volume must be encrypted
- Not all instance types support hibernate
- Maximum hibernate duration: 60 days

Use case: Long-running processes you want to pause and resume (ML training, simulations)

---

## 11. Pricing Models

### On-Demand

Pay by the second (minimum 60 seconds). No commitment.

```
Example: m5.large in us-east-1
On-Demand price: $0.096/hour
Monthly cost (running 24/7): $0.096 × 720 = ~$69/month
```

**When to use:**
- Short-term or unpredictable workloads
- Development and testing
- New applications (before usage patterns are known)
- Spiky workloads that cannot tolerate interruption

---

### Reserved Instances

Commit to using a specific instance type in a specific region for 1 or 3 years in exchange
for a significant discount.

**Payment options:**
- **All Upfront**: Pay everything now → Biggest discount
- **Partial Upfront**: Pay part now + monthly → Medium discount
- **No Upfront**: Pay monthly → Smallest discount (still cheaper than On-Demand)

**Discount levels (approximate for us-east-1 m5.large):**

| Term | Payment | Hourly Rate | Savings vs On-Demand |
|------|---------|-------------|---------------------|
| On-Demand | - | $0.096 | - |
| 1 year, No Upfront | Monthly | $0.060 | ~38% |
| 1 year, All Upfront | $526 once | $0.060 effective | ~38% |
| 3 year, No Upfront | Monthly | $0.044 | ~54% |
| 3 year, All Upfront | $940 once | $0.036 effective | ~63% |

**Types of Reserved Instances:**
- **Standard RI**: Biggest discount, cannot change instance family
- **Convertible RI**: Can change instance family/OS/tenancy during term, smaller discount

**When to use:**
- Steady-state workloads (databases, always-on APIs)
- When you can commit to 1-3 years

---

### Spot Instances

Purchase unused EC2 capacity at steep discounts. AWS can **interrupt** (terminate or stop)
your instance with a 2-minute warning when they need the capacity back.

```
Spot Pricing: Up to 90% off On-Demand

m5.large On-Demand: $0.096/hour
m5.large Spot:      $0.020/hour  ← typical spot price (varies)
```

**How Spot works:**
1. You set a max price (or use the current spot price)
2. If spot price is below your max → instance runs
3. If spot price exceeds your max → you get 2-minute warning → instance interrupted

**Spot Instance Interruption Actions:**
- Terminate (default)
- Stop
- Hibernate

**When to use:**
- Fault-tolerant workloads
- Batch processing jobs
- Big data analytics
- CI/CD runners
- ML training (with checkpointing)
- Stateless web tiers (behind a load balancer)

**Never use for:**
- Databases
- Anything that cannot tolerate interruption

**Spot Fleets**: Mix of Spot and On-Demand instances, can use multiple instance types to
maximize availability.

---

### Savings Plans

More flexible than Reserved Instances. Commit to a **dollar amount of compute usage per hour**
rather than a specific instance type.

**Compute Savings Plans:**
- Apply to EC2, Lambda, and Fargate
- Can change instance family, OS, region, size
- Up to 66% savings

**EC2 Instance Savings Plans:**
- Apply to a specific instance family in a region
- Bigger discount (up to 72%)
- Cannot change instance family

**When to use:**
- You want RI-like discounts but with more flexibility
- Modern deployments mixing instance types

---

### Dedicated Hosts

A **physical server** dedicated entirely to your use.

- Full visibility into host-level details (sockets, cores, host ID)
- Allows using **existing software licenses** (Oracle DB, Windows Server, SQL Server)
  bound to physical cores or sockets — called BYOL (Bring Your Own License)
- Can launch specific EC2 instances on the host

Cost: Paid per host-hour (much more expensive than shared)

**When to use:**
- Regulatory requirements (need dedicated hardware)
- License compliance (BYOL software)

---

### Dedicated Instances

Your instances run on hardware dedicated to your account, but you don't control placement.

- More expensive than shared (On-Demand + $0.02/instance/hour + $2/region/hour fee)
- Less control than Dedicated Hosts
- No BYOL license support (can't track physical cores)

**When to use:**
- Compliance requirements that prohibit sharing hardware with other customers
- Don't need BYOL license support

---

### Pricing Comparison Table

| Model | Cost | Flexibility | Interruption Risk | Best For |
|-------|------|-------------|------------------|----------|
| On-Demand | Highest | Full | None | Dev/test, unpredictable |
| Savings Plans | -66% | High | None | Mixed steady-state |
| Reserved (1yr) | -38% | Low | None | Known steady workloads |
| Reserved (3yr) | -63% | Very low | None | Long-term steady workloads |
| Spot | -90% | Full | Yes (2-min warn) | Fault-tolerant batch |
| Dedicated Host | Very High | Low | None | BYOL license compliance |

---

## 12. Placement Groups

A Placement Group is a logical grouping of EC2 instances that affects how they are placed on
physical hardware. You can use placement groups to influence performance or availability.

### Cluster Placement Group

All instances are placed in the same rack (or adjacent racks) in the same AZ.

```
Single Availability Zone
┌───────────────────────────────────────┐
│  Physical Rack                        │
│  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ EC2 1  │ │ EC2 2  │ │ EC2 3  │    │
│  └────────┘ └────────┘ └────────┘    │
│                                       │
│  10 Gbps between instances (SR-IOV)   │
└───────────────────────────────────────┘
```

**Benefit**: Extremely low network latency (< 1 ms) and up to 100 Gbps bandwidth.
**Drawback**: All instances can fail together if the rack fails (low availability).
**Use case**: HPC, tightly coupled distributed computing, real-time analytics, financial trading.

### Spread Placement Group

Each instance is placed on different underlying hardware (different racks, different power
sources).

```
Availability Zone
┌──────────────────────────────────────────────────┐
│  Rack 1           Rack 2           Rack 3         │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐    │
│  │  EC2 1  │     │  EC2 2  │     │  EC2 3  │    │
│  └─────────┘     └─────────┘     └─────────┘    │
└──────────────────────────────────────────────────┘
```

**Benefit**: Maximum availability — a hardware failure only affects one instance.
**Limit**: Maximum **7 instances per AZ** per spread placement group.
**Use case**: Small number of critical instances (primary/replica databases, master nodes).

### Partition Placement Group

Groups of instances (partitions) placed on separate racks. Multiple instances per partition.

```
Availability Zone
┌───────────────────────────────────────────────────┐
│  Partition 1        Partition 2      Partition 3   │
│  ┌───────────┐     ┌───────────┐   ┌───────────┐  │
│  │ EC2 │ EC2 │     │ EC2 │ EC2 │   │ EC2 │ EC2 │  │
│  │     │     │     │     │     │   │     │     │  │
│  └───────────┘     └───────────┘   └───────────┘  │
│  (Rack A)          (Rack B)        (Rack C)        │
└───────────────────────────────────────────────────┘
```

**Benefit**: Balance between performance and availability. Each partition has its own network
and power. A rack failure affects one partition, not others.
**Scale**: Up to 7 partitions per AZ, hundreds of instances per partition.
**Use case**: Large distributed systems — HDFS, HBase, Cassandra, Kafka.

---

## 13. Instance Metadata

### What is Instance Metadata?

Every running EC2 instance can access information about itself through a special HTTP endpoint
available only from within the instance:

```
http://169.254.169.254/latest/meta-data/
```

This is a **link-local address** — it only works from inside the EC2 instance.

### Accessing Metadata

```bash
# Get instance ID
curl http://169.254.169.254/latest/meta-data/instance-id
# Returns: i-0abc123def456789

# Get public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4
# Returns: 54.123.45.67

# Get private IP
curl http://169.254.169.254/latest/meta-data/local-ipv4
# Returns: 10.0.1.50

# Get instance type
curl http://169.254.169.254/latest/meta-data/instance-type
# Returns: t3.medium

# Get IAM role credentials (temporary AWS credentials)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/MyRoleName
# Returns JSON with AccessKeyId, SecretAccessKey, Token, Expiration

# Get availability zone
curl http://169.254.169.254/latest/meta-data/placement/availability-zone
# Returns: us-east-1a

# Get AMI ID
curl http://169.254.169.254/latest/meta-data/ami-id
# Returns: ami-0abc123def456

# List all metadata categories
curl http://169.254.169.254/latest/meta-data/
```

### IMDSv2 (Instance Metadata Service v2)

IMDSv2 is a more secure version that requires a session token (prevents SSRF attacks).

```bash
# Step 1: Get a token (valid for 21600 seconds = 6 hours)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Step 2: Use the token
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id
```

**Best practice**: Require IMDSv2 on all instances (set in launch template or instance settings).
This prevents attacks where malicious code on the instance makes requests to the metadata service
to steal IAM credentials.

### User Data from Metadata

```bash
# Access user data from within the instance
curl http://169.254.169.254/latest/user-data
```

### Practical Use Case

A common pattern is to use instance metadata in application configuration:
```bash
#!/bin/bash
# Get my own instance ID and region for self-registration
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Register in DynamoDB
aws dynamodb put-item \
  --table-name app-registry \
  --item "{\"InstanceId\": {\"S\": \"$INSTANCE_ID\"}, \"Region\": {\"S\": \"$REGION\"}}" \
  --region $REGION
```

---

## 14. Hands-On Projects

### Project 1: Launch EC2, Install Node.js App, Access via Browser

**Goal**: Launch an EC2 instance, deploy a Node.js web app, and access it from your browser.

**Step 1: Launch the Instance**
- AMI: Amazon Linux 2023
- Instance type: t2.micro (free tier)
- Security group: allow port 22 (SSH from your IP), port 3000 (HTTP from anywhere)
- Key pair: create new `lab-key`

**Step 2: User Data Script**
```bash
#!/bin/bash
set -ex
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<h1>Hello from EC2!</h1><p>Running on Node.js</p>');
});
server.listen(3000, () => console.log('Server running on port 3000'));
" > /opt/app.js

# Run with PM2
npm install -g pm2
pm2 start /opt/app.js --name webapp
pm2 startup systemd -u root --hp /root
pm2 save
```

**Step 3: Access via Browser**
```
http://<public-ip>:3000
```

---

### Project 2: Create a Custom AMI from a Running Instance

**Goal**: Create a "golden image" so you can launch identical servers quickly.

**Step 1: Set up the base instance**
```bash
# SSH into your running instance
ssh -i lab-key.pem ec2-user@<public-ip>

# Install your standard packages
sudo yum update -y
sudo yum install -y nginx python3 git aws-cli
sudo systemctl enable nginx

# Add your config files, set up directories
sudo mkdir -p /opt/myapp
echo "app_version=1.0.0" | sudo tee /etc/myapp.conf
```

**Step 2: Create the AMI**
```
EC2 Console → Instances → Select running instance
→ Actions → Image and templates → Create image
→ Image name: myapp-golden-image-v1.0
→ Description: Node.js 18 + Nginx + standard tools
→ No reboot: false (safer for filesystem consistency)
→ Create image
```

Wait 5-10 minutes. Check EC2 → AMIs → your AMI should show "available".

**Step 3: Launch from Custom AMI**
```
EC2 → Instances → Launch instances
→ My AMIs → Select myapp-golden-image-v1.0
→ Everything else same as before
```

The new instance boots with all your pre-installed software, cutting bootstrap time.

---

### Project 3: Attach Additional EBS Volume

**Goal**: Add a second disk, format it, mount it, and use it for data storage.

**Step 1: Create and attach EBS volume**
```
EC2 → Volumes → Create volume
  Type: gp3
  Size: 20 GB
  AZ: us-east-1a (MUST match your EC2 instance's AZ)
  → Create

Select the volume → Actions → Attach volume
  Instance: your EC2 instance
  Device: /dev/sdf
  → Attach
```

**Step 2: Format and mount on the instance**
```bash
# SSH into instance
ssh -i lab-key.pem ec2-user@<public-ip>

# List block devices - you should see your new volume (probably /dev/xvdf)
lsblk

# Check if it has a filesystem
sudo file -s /dev/xvdf
# Output: /dev/xvdf: data  ← means no filesystem yet

# Create filesystem
sudo mkfs -t xfs /dev/xvdf

# Create mount point
sudo mkdir /data

# Mount the volume
sudo mount /dev/xvdf /data

# Verify it's mounted
df -h /data

# Write some data
echo "Hello EBS" | sudo tee /data/test.txt
cat /data/test.txt
```

**Step 3: Auto-mount on reboot**
```bash
# Get the UUID of the volume
sudo blkid /dev/xvdf
# Output: /dev/xvdf: UUID="abc123-..." TYPE="xfs"

# Add to /etc/fstab
sudo bash -c 'echo "UUID=abc123-... /data xfs defaults,nofail 0 2" >> /etc/fstab'

# Test fstab is correct
sudo umount /data
sudo mount -a
df -h /data
```

---

## 15. Interview Q&A

### Core Concepts

**Q1: What is EC2 and what problem does it solve?**
EC2 is AWS's virtual machine service. It solves the problem of having to buy, rack, and
maintain physical servers. You can provision a server in seconds, scale capacity to match
demand, and pay only for what you use. The "elastic" in the name refers to this ability to
expand and contract capacity on demand.

**Q2: What is the difference between an AMI and an instance?**
An AMI is a template (snapshot) containing an OS, software, and configuration. An instance
is a running copy of that template — a live virtual machine. You can create multiple instances
from a single AMI, just like you can run multiple processes from a single executable.

**Q3: What are the different EC2 instance families and when would you use each?**
- T (burstable): Dev/test, low-traffic web servers, microservices
- M (general purpose): Application servers, APIs, small databases
- C (compute optimized): CPU-intensive workloads — batch processing, HPC, ML inference
- R (memory optimized): In-memory databases, Redis, large relational databases
- I (storage optimized): NoSQL databases, search engines needing low-latency local storage
- P/G (GPU): ML training, video encoding, rendering
- Trn/Inf (Trainium/Inferentia): ML training and inference with AWS custom chips

**Q4: What is a Security Group and how does it differ from a NACL?**
Security Groups are stateful firewalls at the instance level — return traffic is automatically
allowed. NACLs are stateless firewalls at the subnet level — you must explicitly allow both
inbound and outbound for each flow. Security Groups only support allow rules; NACLs support
both allow and deny rules.

**Q5: What is the difference between stopping and terminating an EC2 instance?**
Stopping halts the instance but preserves the root EBS volume — data is retained and you can
restart it. You are not charged for compute when stopped, but you still pay for EBS storage.
Terminating permanently destroys the instance and (by default) deletes the root EBS volume.
Non-root volumes survive termination if their "Delete on Termination" flag is false.

### Storage

**Q6: What is the difference between EBS and instance store?**
EBS is persistent network-attached storage — data survives instance stops and can be snapshotted.
Instance store is physically attached NVMe storage — it provides very high IOPS but data is
lost if the instance stops or fails. Use EBS for anything you need to keep. Use instance store
only for temporary data like caches, buffers, or scratch space.

**Q7: When would you use gp3 vs io2 EBS volumes?**
Use gp3 for most workloads — it is cost-effective with good baseline performance (3,000 IOPS,
125 MB/s) that you can tune independently. Use io2 for mission-critical databases requiring
more than 16,000 IOPS, very low and consistent latency, or 99.999% volume durability
(Oracle databases, large PostgreSQL, SAP systems).

**Q8: How do EBS snapshots work?**
Snapshots are incremental backups stored in S3. The first snapshot captures the full volume.
Subsequent snapshots only store blocks that changed since the last snapshot, making them fast
and cost-effective. Despite being incremental, each snapshot is self-sufficient — you can
restore any single snapshot without needing prior snapshots.

**Q9: Can you attach one EBS volume to multiple EC2 instances?**
Yes, with io1/io2 volumes using the Multi-Attach feature, and only within the same AZ. This is
for specialized applications like Oracle RAC that manage concurrent writes at the application
level. For most use cases you should not share EBS volumes between instances — use EFS instead
for shared file storage.

### Pricing

**Q10: What are Spot Instances and when should you use them?**
Spot Instances let you use spare AWS capacity at up to 90% discount. The catch is AWS can
interrupt your instance with a 2-minute warning. Use them for fault-tolerant, stateless, or
checkpointed workloads: batch processing, big data analytics, CI/CD pipelines, ML training
(with checkpoints), and stateless web tiers behind load balancers. Never use for databases
or anything requiring continuous availability.

**Q11: What is the difference between Reserved Instances and Savings Plans?**
Reserved Instances commit to a specific instance type in a specific region. Savings Plans
commit to a dollar amount of compute usage per hour — they are more flexible (can change
instance family, region, OS) but standard Compute Savings Plans cap savings at 66% vs up to
72% for EC2 Instance Savings Plans. Savings Plans are generally preferred for modern
architectures using mixed instance types.

**Q12: What is a Dedicated Host vs a Dedicated Instance?**
A Dedicated Host is a physical server fully dedicated to your use, giving you visibility into
host hardware (socket, core counts) and enabling BYOL software licensing. A Dedicated Instance
runs on hardware dedicated to your account but you don't control placement or have host-level
visibility. Dedicated Hosts are needed for software licenses bound to physical sockets/cores
(Oracle, Windows Server, SQL Server).

### Networking & Security

**Q13: What is an Elastic IP and when would you use one?**
An Elastic IP is a static public IPv4 address associated with your account. Use it when you
need a consistent IP address for your EC2 instance — such as when DNS records point to the IP,
when customers whitelist the IP in their firewalls, or when you need to quickly failover by
reassociating the EIP from a failed instance to a replacement. It is free when associated with
a running instance, but charged when allocated but unassociated.

**Q14: How does EC2 User Data work?**
User Data is a script that runs once when the instance first boots, executed as root by the
cloud-init service. It is used to bootstrap the instance — installing packages, configuring
software, and starting applications. Output is logged to `/var/log/cloud-init-output.log`.
The maximum size is 16 KB. For larger scripts, store them in S3 and download them in a small
user data script.

**Q15: What are the three types of Placement Groups and when would you use each?**
Cluster: All instances on the same rack, giving ultra-low latency (< 1ms) and up to 100 Gbps
bandwidth. Use for HPC and tightly coupled distributed computing. Risk: single rack failure
takes all instances.
Spread: Each instance on a different rack. Maximum availability. Limited to 7 instances per AZ.
Use for critical small clusters like database primary/replica.
Partition: Groups of instances on separate racks. Up to 7 partitions per AZ with hundreds of
instances per partition. Use for large distributed systems like Cassandra or HDFS where rack
awareness matters.

### Advanced

**Q16: What is the EC2 Instance Metadata Service and why is IMDSv2 important?**
The metadata service is an HTTP endpoint at 169.254.169.254 accessible only from within an EC2
instance, exposing information like instance ID, IP, AZ, and IAM credentials. IMDSv2 adds a
required session token step, preventing SSRF (Server-Side Request Forgery) attacks where
malicious code or a compromised web app could steal IAM credentials by making HTTP requests to
the metadata endpoint without the caller's knowledge.

**Q17: How would you migrate an EC2 instance from one region to another?**
1. Create an EBS snapshot of the root volume
2. Copy the snapshot to the destination region
3. Create an AMI from the copied snapshot in the destination region
4. Launch a new instance from the AMI in the new region
5. Update any associated Elastic IPs, security groups, and DNS records

**Q18: How would you resize an EBS volume?**
You can increase EBS volume size, change volume type, and adjust IOPS/throughput without
stopping the instance (Elastic Volumes). In the console, modify the volume. After AWS completes
the modification, you must also extend the filesystem on the OS side:
```bash
# Extend ext4 filesystem
sudo resize2fs /dev/xvdf

# Extend XFS filesystem
sudo xfs_growfs /data
```

**Q19: What are CPU credits in T-series instances?**
T instances run at a baseline CPU level and earn credits when below that baseline. Credits can
be spent for CPU bursts above the baseline. With T3 Unlimited mode, the instance can burst
indefinitely — AWS charges extra per CPU credit used above the earned baseline. Monitor
`CPUSurplusCreditsCharged` in CloudWatch to catch unexpected costs with Unlimited mode.

**Q20: What happens to an EC2 instance if the underlying hardware fails?**
AWS automatically migrates EBS-backed instances to healthy hardware and restarts them. This is
called automatic recovery. You can also configure a CloudWatch alarm to trigger recovery:
`aws cloudwatch put-metric-alarm --alarm-actions arn:aws:automate:region:ec2:recover`.
Instance store data would be lost in a hardware failure.

**Q21: How would you connect to an EC2 instance if you lost the key pair and the instance has no public IP?**
Three options:
1. Use AWS Systems Manager Session Manager (no key pair, no public IP needed, just needs SSM
   agent installed and an IAM role on the instance)
2. Stop the instance, detach the root EBS volume, attach it to another instance, mount it, edit
   ~/.ssh/authorized_keys to add your new public key, reattach, restart
3. If EC2 Instance Connect is available, it can temporarily inject a public key via IAM

**Q22: What is the difference between a Security Group and a Network ACL?**
| | Security Group | Network ACL |
|--|---------------|-------------|
| Level | Instance | Subnet |
| Stateful | Yes | No |
| Rules | Allow only | Allow and Deny |
| Evaluation | All rules evaluated | Rules evaluated in order (numbered) |
| Default | Deny all inbound | Allow all |

**Q23: How do you make an EC2 instance highly available?**
High availability means surviving failures. Strategies:
1. Deploy instances in multiple Availability Zones
2. Use an Auto Scaling Group so failed instances are replaced automatically
3. Put an Application Load Balancer in front to distribute traffic and detect unhealthy instances
4. Use Amazon RDS Multi-AZ for the database layer
5. Avoid single points of failure (single EC2 instance, single AZ, etc.)

**Q24: What is the AWS Nitro System?**
Nitro is AWS's custom hardware and hypervisor platform that most modern EC2 instances run on.
Key benefits:
- Near bare-metal performance (minimal hypervisor overhead)
- Enhanced networking (up to 100 Gbps)
- NVMe storage via Nitro Cards
- Security isolation between customers via dedicated hardware
- Enables bare-metal instances (`metal` suffix) where you get full control of the hardware

**Q25: What are the steps to troubleshoot an EC2 instance that is not reachable?**
1. Check instance state: Is it running? Any system status checks failing?
2. Check Security Group: Does it allow inbound traffic on the port you are connecting to?
3. Check NACL: Does the subnet NACL allow the traffic?
4. Check Route Table: Does the subnet have a route to the internet gateway?
5. Check Internet Gateway: Is one attached to the VPC?
6. Check public IP: Does the instance have one? Or an Elastic IP?
7. Check the instance's own firewall: iptables or firewalld on the OS
8. Check application logs: Is the service actually running?
9. Use EC2 Serial Console or Get Instance Screenshot for visibility without SSH
10. Check CloudWatch agent logs if installed
