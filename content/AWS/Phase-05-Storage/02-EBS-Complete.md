# EBS (Elastic Block Store) — Complete Guide

## Table of Contents
1. [What is EBS](#what-is-ebs)
2. [EBS Volume Types](#ebs-volume-types)
3. [IOPS and Throughput Concepts](#iops-and-throughput-concepts)
4. [Attaching and Detaching Volumes](#attaching-and-detaching-volumes)
5. [Resizing Volumes](#resizing-volumes)
6. [Snapshots Deep Dive](#snapshots-deep-dive)
7. [Cross-Region Snapshot Copy](#cross-region-snapshot-copy)
8. [EBS Encryption with KMS](#ebs-encryption-with-kms)
9. [RAID Configurations on EBS](#raid-configurations-on-ebs)
10. [Interview Q&A](#interview-qa)

---

## What is EBS

Amazon EBS (Elastic Block Store) provides **persistent block storage volumes** for EC2 instances. Think of it as a network-attached hard drive.

```
+----------------------------------+
|         EC2 INSTANCE             |
|  +----------------------------+  |
|  |    Operating System        |  |
|  |  (mounted /dev/xvda)       |  |
|  +----------------------------+  |
+----------------------------------+
           |  (network)
+----------------------------------+
|         EBS VOLUME               |
|  Raw block storage               |
|  Formatted with ext4/xfs/NTFS    |
|  Persists independently of EC2   |
+----------------------------------+
```

**Key characteristics:**
- **Network-attached:** EBS connects to EC2 over the network (very low latency AWS network)
- **Persistent:** Data survives instance stop/terminate (unless "Delete on Termination" is checked)
- **AZ-locked:** An EBS volume lives in ONE Availability Zone and can ONLY be attached to EC2 instances in the SAME AZ
- **One-to-one (mostly):** Standard volumes attach to one EC2 instance at a time (io1/io2 support Multi-Attach)
- **Provisioned capacity:** You pay for provisioned size even if unused

**EBS vs Instance Store:**
```
+----------------------+----------------------------+
| EBS                  | Instance Store             |
+----------------------+----------------------------+
| Persistent           | Ephemeral (lost on stop)   |
| Network-attached     | Physically attached         |
| Detachable           | Cannot detach              |
| Snapshots supported  | No snapshot support        |
| Lower IOPS ceiling   | Very high IOPS (NVMe SSD)  |
| Good for production  | Good for temp data/cache   |
+----------------------+----------------------------+
```

---

## EBS Volume Types

### Overview Table

```
+--------+----------+----------+-------+----------+----------+-----------+
| Type   | Family   | Use Case | Max   | Max      | Max Size | Max IOPS  |
|        |          |          | IOPS  | Throughput|         | per Volume|
+--------+----------+----------+-------+----------+----------+-----------+
| gp2    | SSD      | General  |16,000 | 250 MB/s | 16 TB    | 16,000    |
| gp3    | SSD      | General  |16,000 | 1,000 MB/s| 16 TB   | 16,000    |
| io1    | SSD      | High IOPS|64,000 | 1,000 MB/s| 16 TB   | 64,000    |
| io2    | SSD      | High IOPS|64,000 | 1,000 MB/s| 16 TB   | 64,000    |
| io2 BE | SSD      | Ultra    |256,000| 4,000 MB/s| 64 TB   | 256,000   |
| st1    | HDD      | Throughput|  500 | 500 MB/s | 16 TB    | N/A       |
| sc1    | HDD      | Cold     |  250 | 250 MB/s | 16 TB    | N/A       |
+--------+----------+----------+-------+----------+----------+-----------+

io2 BE = io2 Block Express (newest, highest performance)
```

### gp2 (General Purpose SSD v2)

```
+-------------------------------------------+
|              gp2 VOLUME                   |
+-------------------------------------------+
| Type:          SSD (General Purpose)      |
| Size:          1 GB - 16 TB              |
| Baseline IOPS: 3 IOPS/GB                 |
| Max IOPS:      16,000                    |
| Burst IOPS:    Up to 3,000 (< 1 TB)     |
| Throughput:    128-250 MB/s              |
| Boot volume:   YES                       |
+-------------------------------------------+
| Burst bucket:                             |
|   < 1 TB → 3,000 IOPS burst              |
|   >= 1 TB → already at baseline > 3,000  |
|   Burst depletes/replenishes via credits  |
+-------------------------------------------+
| USE WHEN:                                 |
| - Boot volumes                           |
| - Dev/test environments                  |
| - Low-latency apps                       |
| - Legacy workloads                       |
+-------------------------------------------+
| NOTE: gp3 is newer and better — prefer   |
| gp3 for new workloads                    |
+-------------------------------------------+
```

**gp2 burst behavior:**
```
Credit balance (like a bucket):
  Earns 3 IOPS/GB/s of credits up to 5.4 million credits
  Burns credits when bursting above baseline
  
Example: 100 GB gp2 volume
  Baseline: 300 IOPS (3 × 100)
  Burst: 3,000 IOPS (uses credits)
  Credits earned: 300/s
  Credits burned at burst: 3,000/s
  Time to exhaust credits: 5,400,000 / (3,000-300) = ~33 minutes
```

### gp3 (General Purpose SSD v3)

```
+-------------------------------------------+
|              gp3 VOLUME                   |
+-------------------------------------------+
| Type:          SSD (General Purpose)      |
| Size:          1 GB - 16 TB              |
| Baseline IOPS: 3,000 (ALWAYS, any size)  |
| Max IOPS:      16,000 (purchasable)      |
| Baseline Thrpt: 125 MB/s                 |
| Max Throughput: 1,000 MB/s (purchasable) |
| Boot volume:   YES                       |
| Cost:          20% cheaper than gp2      |
+-------------------------------------------+
| KEY ADVANTAGE OVER gp2:                   |
| - Predictable 3,000 IOPS for ALL sizes   |
| - IOPS and throughput are independent    |
|   (can provision one without the other)  |
| - No credit burst mechanism              |
+-------------------------------------------+
| USE WHEN:                                 |
| - Almost everything (default choice)     |
| - Boot volumes                           |
| - Databases (non-critical)               |
| - Virtual desktops                       |
| - Development environments               |
+-------------------------------------------+
```

**gp2 vs gp3 key difference:**
```
gp2: IOPS tied to size (3 IOPS/GB, max 16,000)
     1 TB → 3,000 IOPS (no extra charge)
     5 TB → 15,000 IOPS (no extra charge)

gp3: IOPS independent of size
     ANY size → 3,000 IOPS baseline
     Pay separately to increase IOPS up to 16,000
     
Example savings: Need 3,000 IOPS on 100 GB
  gp2: Must provision 1 TB to get 3,000 IOPS → pay for 1 TB
  gp3: 100 GB with 3,000 IOPS baseline → pay for just 100 GB
  Savings: ~80% cost reduction
```

### io1 (Provisioned IOPS SSD v1)

```
+-------------------------------------------+
|              io1 VOLUME                   |
+-------------------------------------------+
| Type:          SSD (Provisioned IOPS)     |
| Size:          4 GB - 16 TB              |
| Max IOPS:      64,000                    |
| Max Throughput: 1,000 MB/s               |
| IOPS:Size ratio: Max 50:1                |
|   (1,000 GB → max 50,000 IOPS)          |
| Multi-Attach:  YES (io1 and io2)         |
| Boot volume:   YES                       |
+-------------------------------------------+
| USE WHEN:                                 |
| - Critical production databases          |
| - Need > 16,000 IOPS (beyond gp3 max)   |
| - Sub-millisecond latency required       |
| - Oracle, Microsoft SQL Server           |
+-------------------------------------------+
```

### io2 (Provisioned IOPS SSD v2)

```
+-------------------------------------------+
|              io2 VOLUME                   |
+-------------------------------------------+
| Type:          SSD (Provisioned IOPS)     |
| Size:          4 GB - 16 TB              |
| Max IOPS:      64,000                    |
| IOPS:Size ratio: Max 500:1               |
|   (higher ratio than io1)               |
| Durability:    99.999% (vs 99.8% io1)   |
| Multi-Attach:  YES                       |
| Cost:          Same as io1               |
+-------------------------------------------+
| io2 Block Express (ultra tier):           |
| Max IOPS:      256,000                   |
| Max Throughput: 4,000 MB/s               |
| Max Size:      64 TB                     |
| Latency:       Sub-millisecond           |
+-------------------------------------------+
| USE WHEN:                                 |
| - io1 but with higher reliability        |
| - SAP HANA, large Oracle, SQL Server     |
| - io2 BE: extreme database workloads     |
+-------------------------------------------+
```

**io1 vs io2 summary:**
```
io2 is strictly better than io1:
  ✓ Higher max IOPS:size ratio (500:1 vs 50:1)
  ✓ Higher durability (99.999% vs 99.8%)
  ✓ Same price
  ✓ Use io2 for all new workloads
```

### st1 (Throughput Optimized HDD)

```
+-------------------------------------------+
|              st1 VOLUME                   |
+-------------------------------------------+
| Type:          HDD (Throughput Optimized) |
| Size:          125 GB - 16 TB            |
| Max IOPS:      500 (large sequential)    |
| Baseline Thrpt: 40 MB/s per TB           |
| Max Throughput: 500 MB/s                 |
| Boot volume:   NO                        |
| Cost:          Much cheaper than SSD     |
+-------------------------------------------+
| USE WHEN:                                 |
| - Big data workloads (Hadoop, Spark)     |
| - Data warehouses                        |
| - Log processing                         |
| - Large sequential reads/writes          |
| - Kafka                                  |
+-------------------------------------------+
| BAD FOR:                                  |
| - Random access workloads                |
| - Boot volumes                           |
| - Small I/O operations                   |
+-------------------------------------------+
```

### sc1 (Cold HDD)

```
+-------------------------------------------+
|              sc1 VOLUME                   |
+-------------------------------------------+
| Type:          HDD (Cold)                 |
| Size:          125 GB - 16 TB            |
| Max IOPS:      250 (large sequential)    |
| Baseline Thrpt: 12 MB/s per TB           |
| Max Throughput: 250 MB/s                 |
| Boot volume:   NO                        |
| Cost:          LOWEST of all EBS types   |
+-------------------------------------------+
| USE WHEN:                                 |
| - Coldest data, accessed infrequently     |
| - Lowest storage cost priority           |
| - Data archives on EBS                   |
| - Sequential data that is rarely accessed|
+-------------------------------------------+
```

### Volume Type Decision Tree

```
Need SSD performance?
    YES → Need > 16,000 IOPS or sub-millisecond latency?
    |         YES → io2 (or io2 Block Express for extreme)
    |         NO  → gp3 (default choice — ALWAYS prefer gp3 over gp2)
    |
    NO (HDD)
        Need high throughput for big data/streaming?
            YES → st1
            NO (cold data, maximum savings)
                YES → sc1
```

---

## IOPS and Throughput Concepts

### IOPS (Input/Output Operations Per Second)

IOPS measures how many read/write operations can be completed per second.

```
IOPS is about:   NUMBER of operations
Throughput is about: SIZE of data transferred

High IOPS workload:   Many small random reads/writes
                      Databases (MySQL, Oracle)
                      OLTP systems

High throughput:      Large sequential reads/writes
                      Video encoding
                      Big data analytics
                      Log processing
```

**IOPS size relationship:**

```
IOPS is measured at 16 KB I/O size by default for gp and io volumes.

If your application uses larger I/O sizes:
  Application reads 64 KB blocks
  Each "operation" = 64 KB / 16 KB = 4 normalized IOPS
  So 1 physical I/O consumes 4 IOPS from your provisioned limit
  
Rule: Larger I/O blocks consume more IOPS
```

### Throughput

Throughput = IOPS × I/O size

```
Example:
  Volume has 3,000 IOPS provisioned
  Application does 128 KB I/O operations
  Throughput = 3,000 × 128 KB = 375 MB/s

  gp3 max throughput is 1,000 MB/s
  3,000 IOPS × 16 KB = 47 MB/s   (small I/O, IOPS-limited)
  16,000 IOPS × 64 KB = 1,000 MB/s (throughput-limited at 1,000 MB/s)
```

### Latency

SSD volumes (gp2, gp3, io1, io2): single-digit millisecond to sub-millisecond
HDD volumes (st1, sc1): tens of milliseconds

For databases: Always use SSD (low latency critical for query response time)

---

## Attaching and Detaching Volumes

### Attach a New Volume to EC2

```bash
# Step 1: Create an EBS volume
aws ec2 create-volume \
  --volume-type gp3 \
  --size 100 \
  --availability-zone ap-southeast-2a

# OUTPUT: VolumeId: vol-0123456789abcdef0

# Step 2: Attach to EC2 instance
aws ec2 attach-volume \
  --volume-id vol-0123456789abcdef0 \
  --instance-id i-0123456789abcdef0 \
  --device /dev/sdf

# Step 3: On the EC2 instance, format and mount
sudo lsblk                           # verify volume appears (e.g., nvme1n1)
sudo mkfs.ext4 /dev/nvme1n1          # format (only for NEW volumes!)
sudo mkdir /data
sudo mount /dev/nvme1n1 /data        # mount

# Make mount persistent after reboot
echo "/dev/nvme1n1 /data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
```

### Detach a Volume

```bash
# Unmount on the instance first (IMPORTANT)
sudo umount /data

# Detach via AWS
aws ec2 detach-volume --volume-id vol-0123456789abcdef0

# Force detach (emergency only — can corrupt data)
aws ec2 detach-volume --volume-id vol-0123456789abcdef0 --force
```

### Multi-Attach (io1/io2 only)

io1 and io2 volumes support attachment to up to **16 EC2 instances** in the same AZ simultaneously.

```
+----------+     +----------+     +----------+
|  EC2 #1  |     |  EC2 #2  |     |  EC2 #3  |
|          |     |          |     |          |
+----------+     +----------+     +----------+
     |                |                |
     +----------------+----------------+
                      |
              +----------------+
              |  io2 EBS Volume|
              |  Multi-Attach  |
              +----------------+
```

**Requirements for Multi-Attach:**
- Must use a cluster-aware filesystem (OCFS2, GFS2) — NOT ext4 or xfs
- io1 or io2 only
- All instances must be in the same AZ
- Requires application-level coordination to prevent data corruption

---

## Resizing Volumes

You can resize EBS volumes **without stopping the instance** (Elastic Volumes feature).

### Increase Volume Size

```bash
# Step 1: Modify volume size (no downtime)
aws ec2 modify-volume \
  --volume-id vol-0123456789abcdef0 \
  --size 200                          # increase from 100 GB to 200 GB

# Step 2: Wait for optimization to complete
aws ec2 describe-volumes-modifications \
  --volume-ids vol-0123456789abcdef0
# State goes: modifying → optimizing → completed

# Step 3: Extend filesystem (while mounted, no downtime)
# For ext4:
sudo growpart /dev/nvme1n1 1         # extend partition
sudo resize2fs /dev/nvme1n1p1       # extend filesystem

# For xfs:
sudo xfs_growfs /data               # extend xfs filesystem
```

**Important rules:**
- You can only INCREASE volume size, never decrease
- You can also change volume type (e.g., gp2 → gp3) without downtime
- After a modification, you must wait 6 hours before modifying again

### Change Volume Type Without Downtime

```bash
# Upgrade from gp2 to gp3
aws ec2 modify-volume \
  --volume-id vol-0123456789abcdef0 \
  --volume-type gp3

# Upgrade from gp2 to io2 (for production database)
aws ec2 modify-volume \
  --volume-id vol-0123456789abcdef0 \
  --volume-type io2 \
  --iops 10000
```

---

## Snapshots Deep Dive

EBS Snapshots are **point-in-time backups** of EBS volumes stored in S3 (you don't see the S3 bucket, it's managed by AWS).

### How Snapshots Work

```
FIRST SNAPSHOT (Full):
Volume: [Block A][Block B][Block C][Block D][Block E]
Snapshot 1: copies ALL blocks
  snap-001: [A][B][C][D][E]

SECOND SNAPSHOT (Incremental):
After change: [Block A][Block B'][Block C][Block D'][Block E]
                              ↑ changed          ↑ changed
Snapshot 2: copies only CHANGED blocks
  snap-002: [B'][D'] + reference to snap-001 for unchanged

RESTORE snap-002: [A from snap-001][B' from snap-002][C from snap-001][D' from snap-002][E from snap-001]
```

**Key snapshot facts:**
- Incremental (first snapshot is full, subsequent are incremental)
- Stored in S3 (managed by AWS, not visible in your S3 console)
- Can be taken while volume is in use (minor performance impact)
- Best practice: stop the instance or flush disk buffers before snapshot for consistency

### Creating Snapshots

```bash
# Create snapshot
aws ec2 create-snapshot \
  --volume-id vol-0123456789abcdef0 \
  --description "Production DB backup $(date +%Y-%m-%d)"

# Create snapshot with tags
aws ec2 create-snapshot \
  --volume-id vol-0123456789abcdef0 \
  --description "Weekly backup" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Environment,Value=prod},{Key=Purpose,Value=weekly-backup}]'

# List snapshots
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters Name=status,Values=completed
```

### Restoring from Snapshot

```bash
# Create new volume from snapshot
aws ec2 create-volume \
  --snapshot-id snap-0123456789abcdef0 \
  --volume-type gp3 \
  --availability-zone ap-southeast-2a

# Volumes created from snapshots must be pre-warmed (initialized)
# for consistent performance — or use Fast Snapshot Restore (FSR)
```

### Fast Snapshot Restore (FSR)

Normally, when you create a volume from a snapshot, blocks are loaded lazily from S3 as they're first accessed. This causes initial I/O latency. FSR pre-warms the volume so full performance is available immediately.

```bash
# Enable Fast Snapshot Restore
aws ec2 enable-fast-snapshot-restores \
  --availability-zones ap-southeast-2a ap-southeast-2b \
  --source-snapshot-ids snap-0123456789abcdef0
```

**Cost:** Additional hourly charge per AZ where FSR is enabled.

### Amazon Data Lifecycle Manager (DLM)

Automate snapshot creation, retention, and deletion.

```
DLM POLICY EXAMPLE:
  Resource type: Volume
  Target: Tag: Environment=prod
  Schedule:
    - Daily at 10:00 PM UTC
    - Retain 7 snapshots
  Cross-region copy:
    - Copy to us-west-2
    - Retain 30 days
```

```bash
# Create DLM policy via CLI
aws dlm create-lifecycle-policy \
  --description "Daily production snapshots" \
  --state ENABLED \
  --execution-role-arn arn:aws:iam::123456789012:role/AWSDataLifecycleManagerDefaultRole \
  --policy-details file://dlm-policy.json
```

---

## Cross-Region Snapshot Copy

```
Region: ap-southeast-2                    Region: us-east-1
+---------------------------+             +---------------------------+
|  EC2 + EBS Volume         |             |  Copied Snapshot          |
|                           |             |  (for DR or migration)    |
|  Create Snapshot          |  -------->  |                           |
|  snap-001 (local)         |   Copy      |  snap-001-copy            |
+---------------------------+             +---------------------------+
```

```bash
# Copy snapshot to another region
aws ec2 copy-snapshot \
  --source-region ap-southeast-2 \
  --source-snapshot-id snap-0123456789abcdef0 \
  --description "DR copy" \
  --region us-east-1

# Copy encrypted snapshot (requires KMS key in destination region)
aws ec2 copy-snapshot \
  --source-region ap-southeast-2 \
  --source-snapshot-id snap-0123456789abcdef0 \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/KEY-ID \
  --encrypted \
  --region us-east-1
```

**Snapshot sharing:**
```bash
# Share snapshot with another AWS account
aws ec2 modify-snapshot-attribute \
  --snapshot-id snap-0123456789abcdef0 \
  --attribute createVolumePermission \
  --operation-type add \
  --user-ids 987654321098
```

---

## EBS Encryption with KMS

### How EBS Encryption Works

```
+----------------------------------+
|        EC2 INSTANCE              |
|   Data written to /dev/nvme0n1   |
|   (plaintext in memory)          |
+----------------------------------+
          |
          | (data is encrypted IN TRANSIT to EBS)
          ↓
+----------------------------------+
|   AWS KMS                        |
|   Data Encryption Key (DEK)      |
|   ← managed by KMS               |
+----------------------------------+
          |
          ↓
+----------------------------------+
|        EBS VOLUME                |
|   Data stored ENCRYPTED at rest  |
|   AES-256 encryption             |
+----------------------------------+
```

**What EBS encryption covers:**
- Data at rest on the volume
- Data in transit between volume and EC2 instance
- Snapshots created from the volume
- Volumes created from those encrypted snapshots

**What is NOT encrypted:**
- Data in EC2 memory (RAM)
- Data transmitted over the network after leaving the EC2 instance

### Enabling Encryption

```bash
# Create encrypted volume
aws ec2 create-volume \
  --volume-type gp3 \
  --size 100 \
  --encrypted \
  --kms-key-id arn:aws:kms:ap-southeast-2:123456789012:key/KEY-ID \
  --availability-zone ap-southeast-2a

# Enable account-level encryption by default (all new volumes encrypted)
aws ec2 enable-ebs-encryption-by-default --region ap-southeast-2
```

### Encrypting an Unencrypted Volume

You cannot directly encrypt an existing unencrypted volume. Use this process:

```
Step 1: Create snapshot of unencrypted volume
  snap = aws ec2 create-snapshot(volume-id)

Step 2: Copy snapshot with encryption
  snap-encrypted = aws ec2 copy-snapshot(snap, encrypted=True)

Step 3: Create new volume from encrypted snapshot
  new-volume = aws ec2 create-volume(snap-encrypted)

Step 4: Attach new encrypted volume and detach unencrypted one
  aws ec2 attach-volume(new-volume, instance)
```

**Alternative:** Use AWS Backup or DLM to automate this.

### KMS Key Types for EBS

```
AWS Managed Key (aws/ebs):
  - Free to use
  - Managed by AWS
  - Cannot customize key policy
  - Used when you don't specify a key

Customer Managed Key (CMK):
  - You control the key policy
  - Can share with other accounts
  - Can set key rotation (annual)
  - Additional KMS cost ($1/key/month + API calls)
  - Required for cross-account snapshot sharing
```

---

## RAID Configurations on EBS

RAID (Redundant Array of Independent Disks) on EBS uses multiple EBS volumes to improve performance or redundancy.

**IMPORTANT:** Only RAID 0 and RAID 1 are practical on EBS. Other RAID levels (5, 6) are not recommended because parity operations create too many I/Os.

### RAID 0 — Striping (Performance)

```
+----------+     +----------+     +----------+
|          |     |          |     |          |
|  EBS #1  |     |  EBS #2  |     |  EBS #3  |
|  500 GB  |     |  500 GB  |     |  500 GB  |
|  3,000   |     |  3,000   |     |  3,000   |
|  IOPS    |     |  IOPS    |     |  IOPS    |
+----------+     +----------+     +----------+
     |                |                |
     +----------------+----------------+
                      |
              +----------------+
              | RAID 0 Array   |
              | 1.5 TB total   |
              | 9,000 IOPS     |
              | (combined!)    |
              +----------------+

Data striped across all volumes
If ONE volume fails → ALL DATA LOST
```

**Use case:** When you need more IOPS than a single volume can provide (e.g., big data, media processing). No fault tolerance.

### RAID 1 — Mirroring (Redundancy)

```
+----------+                       +----------+
|          |    Mirror (copy)      |          |
|  EBS #1  |  <------------------> |  EBS #2  |
|  500 GB  |                       |  500 GB  |
|  3,000   |                       |  3,000   |
|  IOPS    |                       |  IOPS    |
+----------+                       +----------+

Data written to BOTH simultaneously
If ONE volume fails → Other takes over
Reads can be served from either (doubled read performance)
Write performance: same as single volume (writes to both)
Total capacity: 500 GB (not 1 TB)
```

**Use case:** When data is critical and you need redundancy beyond what EBS already provides (EBS already replicates within AZ, so RAID 1 on EBS is usually overkill — consider using snapshots instead).

### Setting Up RAID 0 on EBS (Example)

```bash
# Attach 4 × 100 GB gp3 volumes to EC2

# Install mdadm
sudo yum install mdadm -y

# Create RAID 0 array
sudo mdadm --create /dev/md0 \
  --level=0 \
  --raid-devices=4 \
  /dev/nvme1n1 /dev/nvme2n1 /dev/nvme3n1 /dev/nvme4n1

# Format RAID array
sudo mkfs.ext4 /dev/md0

# Mount
sudo mkdir /raid-data
sudo mount /dev/md0 /raid-data

# Save RAID configuration
sudo mdadm --detail --scan >> /etc/mdadm.conf
```

---

## Interview Q&A

### Q1: What is the key difference between gp2 and gp3 EBS volumes?

**Answer:**
The critical difference is how IOPS is determined:
- **gp2:** IOPS is tied to volume size (3 IOPS/GB). A 100 GB volume gets 300 baseline IOPS; a 1 TB volume gets 3,000 IOPS. Burst up to 3,000 IOPS for smaller volumes.
- **gp3:** IOPS is completely independent of size. Every volume gets 3,000 IOPS baseline regardless of size. You can provision additional IOPS (up to 16,000) and throughput independently.

gp3 is typically 20% cheaper than gp2. For any new workloads, prefer gp3. The main scenario where gp2 was preferred — high IOPS on large volumes — gp3 handles better and cheaper.

---

### Q2: An EC2 instance in us-east-1a needs to access data on an EBS volume in us-east-1b. How do you do this?

**Answer:** You **cannot** attach an EBS volume to an EC2 in a different AZ — EBS volumes are AZ-locked. The solution:

1. Create a snapshot of the EBS volume in us-east-1b
2. Create a new EBS volume from that snapshot in us-east-1a
3. Attach the new volume to the EC2 instance

This is a copy, not a live connection — the data is the same up to the snapshot point, not kept in sync.

---

### Q3: How do you increase an EBS volume's size without downtime?

**Answer:** EBS Elastic Volumes allow you to modify volume size, type, and IOPS while the instance is running:

1. `aws ec2 modify-volume --size NEW_SIZE --volume-id vol-xxx`
2. Wait for state to become "optimizing" then "completed"
3. On the instance: `growpart /dev/xvda 1` then `resize2fs /dev/xvda1`

The filesystem extension is done live with no downtime. The volume modification itself happens without detaching or stopping the instance.

---

### Q4: How do EBS snapshots work? Are they full or incremental?

**Answer:** The **first snapshot** is a full copy of the volume's data. Subsequent snapshots are **incremental** — they only capture the blocks that have changed since the previous snapshot.

However, from the user's perspective, each snapshot is independent. You can restore from any individual snapshot without needing the previous ones. AWS manages the incremental chain internally and assembles the full state when you create a volume from a snapshot.

Snapshots are stored in S3 (not visible in your S3 console — managed by AWS).

---

### Q5: What is the difference between io1 and io2?

**Answer:** io2 is the improved version of io1 with:
- **Higher durability:** 99.999% vs 99.8% for io1 (5 nines vs less than 3 nines)
- **Higher IOPS:GiB ratio:** 500:1 vs 50:1 for io1 (you need less storage to provision high IOPS)
- **Same price as io1**

For all new workloads, use io2. The only reason io1 still exists is backward compatibility for existing resources.

---

### Q6: When would you use st1 over gp3?

**Answer:** Use **st1** when the workload is:
1. **Sequential (not random)** — st1 is optimized for sequential reads/writes
2. **Large I/O operations** — streaming large files, not individual records
3. **Throughput-focused** — need sustained MB/s, not IOPS
4. **Cost-sensitive for big data** — st1 is significantly cheaper than SSDs

Examples: Hadoop HDFS data nodes, Kafka log storage, video rendering source data, database log files.

If your workload does any random access, uses the volume as a database, or needs low latency, use gp3 or io2 instead.

---

### Q7: How do you encrypt an existing unencrypted EBS volume?

**Answer:** You cannot encrypt an existing volume in place. The process is:

1. Create a snapshot of the unencrypted volume
2. Copy the snapshot with the `--encrypted` flag (and specify a KMS key if desired)
3. Create a new EBS volume from the encrypted snapshot
4. Stop the instance
5. Detach the original volume, attach the new encrypted volume
6. Start the instance

Alternatively, enable EBS encryption by default at the account level so all future volumes are automatically encrypted.

---

### Q8: What is EBS Multi-Attach and when should you use it?

**Answer:** Multi-Attach allows a single io1 or io2 volume to be attached to up to 16 EC2 instances in the same AZ simultaneously.

**Use cases:**
- High-availability clustered databases (Oracle RAC)
- Applications using cluster-aware filesystems

**Requirements:**
- Must use a cluster-aware filesystem (OCFS2, GFS2) — standard filesystems like ext4 are not cluster-safe
- All instances must be in the same AZ
- Only io1 and io2 volumes
- The application must manage concurrent write access to prevent data corruption

---

### Q9: What is the difference between a snapshot and an AMI?

**Answer:**
- **EBS Snapshot:** A backup of a single EBS volume. Contains the raw block data of that volume. Used to create a new EBS volume.
- **AMI (Amazon Machine Image):** A complete template for launching an EC2 instance. Includes a snapshot of the root EBS volume, plus configuration (OS, launch permissions, block device mapping). An AMI can contain multiple snapshots (one per volume).

You create an AMI when you want to replicate an entire EC2 configuration. You create a snapshot when you want to back up a single volume or move data between regions.

---

### Q10: What RAID level do AWS docs recommend for EBS? Why not RAID 5 or 6?

**Answer:** AWS recommends **RAID 0** for performance and **RAID 1** for redundancy. RAID 5 and RAID 6 are NOT recommended for EBS because:

1. **Parity calculations** generate many additional I/O operations, reducing effective throughput
2. EBS already has built-in redundancy within an AZ (multiple copies on different hardware), so the additional fault tolerance of RAID 5/6 provides diminishing returns
3. Performance impact of parity on EBS is disproportionately high compared to physical RAID

For durability, use EBS snapshots and Multi-AZ replication instead of RAID 5/6.

---

### Q11: You have a 200 GB gp2 volume with 600 IOPS (3 × 200). You need 3,000 IOPS without changing to io2. What are your options?

**Answer:**

**Option 1: Increase volume size (gp2 method)**
- Increase to 1 TB (1,000 GB × 3 = 3,000 IOPS)
- Cost: You're paying for 1 TB but only using 200 GB

**Option 2: Convert to gp3 (better)**
- gp3 provides 3,000 IOPS baseline for ANY size
- Keep at 200 GB, get 3,000 IOPS at no extra cost for the IOPS
- ~20% cheaper than gp2 and you get the IOPS you need

**Best answer:** Migrate to gp3 using `aws ec2 modify-volume --volume-type gp3`. gp3 provides 3,000 IOPS by default regardless of size, solving the problem without over-provisioning storage.

---

### Q12: How does EBS encryption work with KMS? Is there a performance impact?

**Answer:** EBS encryption uses AES-256 and integrates with AWS KMS:

1. When you create an encrypted volume, KMS generates a **Data Encryption Key (DEK)**
2. The DEK is stored encrypted on the volume (using the CMK)
3. When the volume is attached to EC2, the DEK is retrieved from KMS and used to encrypt/decrypt I/O in the EC2 host hardware (not in software)

**Performance impact:** Near zero. Encryption/decryption happens in hardware on the EC2 host using AES-NI instructions. AWS states there is no measurable performance impact.

All encryption is transparent to the operating system — it sees plaintext data. The I/O is encrypted on the wire between EC2 and EBS.
