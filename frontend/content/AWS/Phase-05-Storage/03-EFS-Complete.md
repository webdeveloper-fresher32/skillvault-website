# EFS (Elastic File System) — Complete Guide

## Table of Contents
1. [What is EFS](#what-is-efs)
2. [NFS Protocol](#nfs-protocol)
3. [EFS vs EBS vs S3 Decision Tree](#efs-vs-ebs-vs-s3-decision-tree)
4. [EFS Performance Modes](#efs-performance-modes)
5. [EFS Throughput Modes](#efs-throughput-modes)
6. [EFS Storage Classes](#efs-storage-classes)
7. [EFS with Multiple EC2 Instances](#efs-with-multiple-ec2-instances)
8. [EFS with ECS and EKS](#efs-with-ecs-and-eks)
9. [EFS Access Points](#efs-access-points)
10. [Interview Q&A](#interview-qa)

---

## What is EFS

Amazon EFS (Elastic File System) is a fully managed, scalable **network file system** for Linux-based workloads. It provides shared file storage accessible from multiple EC2 instances simultaneously.

```
                    EFS FILE SYSTEM
                   +---------------+
                   |   /home       |
                   |   /var/log    |
                   |   /shared     |
                   |   (NFS)       |
                   +-------+-------+
                           |
           +---------------+---------------+
           |               |               |
    +------+-----+  +------+-----+  +------+-----+
    | EC2 (AZ-a) |  | EC2 (AZ-b) |  | EC2 (AZ-c) |
    | /mnt/efs   |  | /mnt/efs   |  | /mnt/efs   |
    +------------+  +------------+  +------------+

All instances see the SAME files
Changes by one are immediately visible to all others
```

**Key characteristics:**
- **Elastic scaling:** Automatically grows and shrinks as files are added/removed — no pre-provisioning needed
- **Multi-AZ:** Accessible from all AZs in a region (through Mount Targets in each AZ)
- **Shared access:** Thousands of concurrent NFS connections
- **Linux only:** Supports Linux (POSIX-compliant). For Windows shared storage, use Amazon FSx for Windows File Server
- **Pay per use:** You pay for the actual storage consumed, not provisioned capacity
- **Highly available:** Data replicated across multiple AZs (Standard class)

**EFS vs EBS quick comparison:**
```
EFS:
  Multiple EC2s can access simultaneously
  Automatically scales
  Pay per GB stored
  Multi-AZ by default (Standard class)
  Ideal for: shared storage, CMS, home directories

EBS:
  One EC2 at a time (except Multi-Attach with io1/io2)
  Fixed provisioned size
  Pay for provisioned GB
  Single AZ
  Ideal for: OS disks, databases, dedicated block storage
```

---

## NFS Protocol

EFS uses the **NFS (Network File System)** protocol, specifically NFSv4 and NFSv4.1.

```
CLIENT (EC2)                           SERVER (EFS)
+------------------+                   +------------------+
|  Application     |                   |  File System     |
|  open("/mnt/efs/ |                   |  /               |
|    file.txt")    |                   |  /data/          |
|                  |   NFSv4.1         |  /data/file.txt  |
|  Linux VFS       | <---------------> |                  |
|  NFS Client      |   TCP port 2049   |                  |
|  /dev/nfs        |                   |                  |
+------------------+                   +------------------+
```

**NFS key points:**
- Operates over TCP port 2049
- Supports file locking (fcntl, flock)
- POSIX compliant (permissions, ownership, timestamps)
- Security group must allow TCP 2049 inbound from EC2 security group

**Mounting EFS:**

```bash
# Install NFS client
sudo yum install -y amazon-efs-utils    # Amazon Linux / RHEL
sudo apt-get install -y amazon-efs-utils  # Ubuntu/Debian

# Mount via EFS mount helper (recommended — handles encryption in transit)
sudo mount -t efs \
  -o tls \
  fs-12345678.efs.ap-southeast-2.amazonaws.com:/ \
  /mnt/efs

# Mount via NFS directly
sudo mount -t nfs4 \
  -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2 \
  fs-12345678.efs.ap-southeast-2.amazonaws.com:/ \
  /mnt/efs

# Make persistent (add to /etc/fstab)
fs-12345678.efs.ap-southeast-2.amazonaws.com:/ /mnt/efs efs tls,_netdev 0 0
```

---

## EFS vs EBS vs S3 Decision Tree

```
What type of storage do you need?
              |
              |
    +---------+---------+
    |         |         |
   Files   Database    Objects
    |         |         |
    |         |         +→ S3 (HTTP access, unlimited scale)
    |         |
    |         +→ Block storage needed?
    |              YES → EBS (gp3, io2 for databases)
    |
    |
Do multiple instances need to access simultaneously?
    |
   YES → EFS (shared NFS, Linux only)
    |
   NO → EBS (single instance)

More questions:
  Is it Linux? → EFS
  Is it Windows? → FSx for Windows File Server
  Is it Lustre/HPC? → FSx for Lustre
  Is it on-premises connected? → EFS (accessible via Direct Connect)
```

### Detailed Comparison Table

```
+------------------+------------------+------------------+------------------+
|                  |      S3          |      EBS         |      EFS         |
+------------------+------------------+------------------+------------------+
| Type             | Object           | Block            | File (NFS)       |
| Access           | HTTP/REST        | OS block device  | NFS v4/v4.1      |
| Shared Access    | Yes (HTTP)       | No (1 instance)  | Yes (thousands)  |
| OS Support       | Any              | Any              | Linux only       |
| Max Size         | Unlimited        | 64 TB (io2 BE)   | Unlimited (auto) |
| AZ Scope         | Regional         | Single AZ        | Regional         |
| Pricing          | Per GB stored    | Per GB provisioned| Per GB stored   |
| Performance      | High throughput  | Low latency SSD  | NFS performance  |
| Durability       | 11 nines         | 99.999%          | 11 nines         |
| Availability     | 99.99%           | 99.999%          | 99.99%           |
| Backup           | Versioning, rep. | Snapshots        | AWS Backup       |
| Encryption       | SSE-S3, SSE-KMS  | KMS              | KMS              |
+------------------+------------------+------------------+------------------+
| Best for         | Static assets,   | OS disks,        | Shared config,   |
|                  | backups, data    | databases,       | CMS files,       |
|                  | lakes, websites  | swap space       | home dirs,       |
|                  |                  |                  | containers       |
+------------------+------------------+------------------+------------------+
```

---

## EFS Performance Modes

Choose the performance mode when creating the file system. **Cannot be changed after creation.**

### General Purpose Mode (Default)

```
+----------------------------------+
|    GENERAL PURPOSE MODE          |
+----------------------------------+
| Latency:    Sub-millisecond      |
| Operations: Lower overhead       |
| Recommended: 99% of use cases   |
+----------------------------------+
| USE WHEN:                        |
| - Web serving                   |
| - Content management            |
| - Home directories               |
| - General file serving          |
| - Development environments      |
+----------------------------------+
```

### Max I/O Mode

```
+----------------------------------+
|    MAX I/O MODE                  |
+----------------------------------+
| Latency:    Higher (tradeoff)   |
| Throughput: Higher               |
| Operations: More parallelism    |
| Connections: Thousands of        |
|              concurrent clients  |
+----------------------------------+
| USE WHEN:                        |
| - Massively parallel processing |
| - Big data and analytics        |
| - Media processing pipelines    |
| - Thousands of EC2 instances    |
+----------------------------------+
| NOTE: Higher latency per         |
| operation — not suitable for     |
| latency-sensitive workloads      |
+----------------------------------+
```

**Recommendation:** Start with General Purpose. Only use Max I/O if you have massive parallelism requirements AND can tolerate higher per-operation latency.

---

## EFS Throughput Modes

Unlike performance modes, throughput modes CAN be changed after creation.

### Bursting Throughput (Default)

```
+------------------------------------------+
|        BURSTING THROUGHPUT               |
+------------------------------------------+
| Baseline:  50 KB/s per GB of storage    |
| Burst:     Up to 100 MB/s always        |
|            Up to 1 GB/s (for > 1 TB)   |
| Credit:    Earns during low activity   |
|            Spends during bursts         |
+------------------------------------------+
| Example:                                 |
| 500 GB EFS:                              |
|   Baseline: 500 GB × 50 KB/s = 25 MB/s |
|   Burst:    100 MB/s                    |
|                                          |
| 1 TB EFS:                                |
|   Baseline: 1 TB × 50 KB/s = 50 MB/s   |
|   Burst:    Up to 100 MB/s              |
+------------------------------------------+
| USE WHEN:                                |
| - Workloads have spiky traffic           |
| - Average throughput is low             |
| - Cost is primary concern               |
+------------------------------------------+
```

### Provisioned Throughput

```
+------------------------------------------+
|       PROVISIONED THROUGHPUT             |
+------------------------------------------+
| You specify: exact MiB/s needed         |
| Billed for:  provisioned throughput      |
|              (independent of storage)   |
| Max:         Up to 3 GB/s               |
+------------------------------------------+
| USE WHEN:                                |
| - Throughput needs exceed burst credits  |
| - High throughput on small EFS           |
| - Consistent throughput required        |
| - Low storage but high throughput app   |
+------------------------------------------+
| Example:                                 |
| 10 GB EFS file system:                   |
|   Burst baseline: 0.5 MB/s (tiny!)      |
|   Provisioned:    100 MB/s (you set it) |
+------------------------------------------+
```

### Elastic Throughput (Recommended for most workloads)

```
+------------------------------------------+
|        ELASTIC THROUGHPUT                |
+------------------------------------------+
| Automatically scales to workload        |
| Up to:   3 GB/s read, 1 GB/s write      |
| No burst credits to manage              |
| Pay only for what you use               |
+------------------------------------------+
| USE WHEN:                                |
| - Unpredictable workloads               |
| - You want hands-off management         |
| - Serverless architectures             |
| - New EFS file systems (recommended)   |
+------------------------------------------+
```

---

## EFS Storage Classes

EFS has a two-tier storage model similar to S3's lifecycle rules.

```
+----------------------------------+          +----------------------------------+
|       EFS STANDARD               |          |    EFS STANDARD-IA               |
+----------------------------------+          +----------------------------------+
| Frequently accessed files        |          | Infrequently accessed files      |
| Highest availability             |          | Lower cost (up to 92% savings)   |
| Multiple AZ redundancy           |          | Multiple AZ redundancy           |
| Standard pricing                 |          | Retrieval fee per GB             |
+----------------------------------+          +----------------------------------+
        |                                               ↑
        |  EFS Lifecycle Management                     |
        |  (automatically moves files after N days     |
        |   without access: 14, 30, 60, 90, 180 days) |
        +-----------------------------------------------+
```

### EFS One Zone Storage Classes

For development/test or when multi-AZ is not needed:

```
EFS One Zone:       Standard pricing, single AZ
EFS One Zone-IA:    Lowest cost, single AZ, retrieval fee

~47% cheaper than multi-AZ Standard
Risk: Data lost if AZ fails
```

### Configuring Lifecycle Management

```bash
# Enable lifecycle management (move to IA after 30 days)
aws efs put-lifecycle-configuration \
  --file-system-id fs-12345678 \
  --lifecycle-policies \
    TransitionToIA=AFTER_30_DAYS \
    TransitionToPrimaryStorageClass=AFTER_1_ACCESS
```

The `TransitionToPrimaryStorageClass=AFTER_1_ACCESS` option moves files back to Standard when accessed — useful when you want fast reads after retrieval.

---

## EFS with Multiple EC2 Instances

This is the primary use case for EFS: shared storage across multiple instances.

### Architecture

```
+------------------------------------------+
|          VPC: vpc-12345                  |
|                                          |
|  +----------+  +----------+             |
|  | EC2 Web1 |  | EC2 Web2 |             |
|  | ap-syd-a |  | ap-syd-b |             |
|  | /mnt/efs |  | /mnt/efs |             |
|  +----+-----+  +----+-----+             |
|       |              |                  |
|  +---------+   +---------+              |
|  | Mount   |   | Mount   |              |
|  | Target  |   | Target  |              |
|  | AZ: a   |   | AZ: b   |              |
|  +---------+   +---------+              |
|       |              |                  |
|       +------+-------+                  |
|              |                          |
|    +---------+---------+                |
|    |    EFS File System  |              |
|    |    fs-12345678     |              |
|    |    (multi-AZ)      |              |
|    +-------------------+               |
+------------------------------------------+
```

**Mount Targets:**
- Each AZ needs its own Mount Target (an endpoint in that AZ's subnet)
- Mount Targets have their own security group
- EC2's security group must allow outbound TCP 2049 to Mount Target's security group
- Mount Target's security group must allow inbound TCP 2049 from EC2's security group

### Setting Up EFS for Web Farm

```bash
# 1. Create EFS file system
aws efs create-file-system \
  --performance-mode generalPurpose \
  --throughput-mode elastic \
  --encrypted \
  --tags Key=Name,Value=WebAppSharedStorage

# 2. Create Mount Targets (one per AZ)
aws efs create-mount-target \
  --file-system-id fs-12345678 \
  --subnet-id subnet-aaa111 \
  --security-groups sg-efs

aws efs create-mount-target \
  --file-system-id fs-12345678 \
  --subnet-id subnet-bbb222 \
  --security-groups sg-efs

# 3. Mount on each EC2 instance
sudo yum install -y amazon-efs-utils
sudo mkdir /var/www/shared
sudo mount -t efs -o tls fs-12345678:/ /var/www/shared

# 4. In UserData (auto-mount for new instances)
#!/bin/bash
yum install -y amazon-efs-utils
mkdir -p /var/www/shared
echo "fs-12345678:/ /var/www/shared efs _netdev,tls 0 0" >> /etc/fstab
mount -a
```

### Use Cases for Multi-EC2 EFS

| Use Case | Description |
|----------|-------------|
| Web content | Apache/Nginx web root shared across fleet |
| WordPress | WordPress uploads directory shared across instances |
| CI/CD | Build artifacts and shared workspaces |
| Home directories | NFS home dirs for multiple bastion hosts |
| Config files | Centralized application configuration |
| Machine learning | Training data accessible from multiple GPU instances |

---

## EFS with ECS and EKS

### EFS with Amazon ECS

EFS is the standard shared storage solution for containerized workloads.

```
+--------------------------------+
|         ECS CLUSTER            |
|                                |
|  +----------+  +----------+   |
|  | Task #1  |  | Task #2  |   |
|  | Container|  | Container|   |
|  | /data    |  | /data    |   |
|  +-----+----+  +----+-----+   |
|        |            |         |
|  +-----+----+  +----+-----+   |
|  | EFS      |  | EFS      |   |
|  | Mount    |  | Mount    |   |
|  | (Task)   |  | (Task)   |   |
|  +----------+  +----------+   |
|        \           /          |
|         +---------+           |
|         | EFS FS  |           |
+--------------------------------+
```

**ECS Task Definition with EFS:**
```json
{
  "family": "my-task",
  "containerDefinitions": [
    {
      "name": "my-container",
      "image": "nginx",
      "mountPoints": [
        {
          "sourceVolume": "my-efs-volume",
          "containerPath": "/usr/share/nginx/html"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "my-efs-volume",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-12345678",
        "rootDirectory": "/web-content",
        "transitEncryption": "ENABLED",
        "authorizationConfig": {
          "accessPointId": "fsap-abc123",
          "iam": "ENABLED"
        }
      }
    }
  ]
}
```

### EFS with Amazon EKS

In Kubernetes, EFS is used as a **PersistentVolume** with the EFS CSI driver.

```yaml
# PersistentVolume backed by EFS
apiVersion: v1
kind: PersistentVolume
metadata:
  name: efs-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteMany        # Multiple pods can read/write
  persistentVolumeReclaimPolicy: Retain
  csi:
    driver: efs.csi.aws.com
    volumeHandle: fs-12345678

---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: efs-claim
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi

---
# Pod using the PVC
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: myapp:latest
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    persistentVolumeClaim:
      claimName: efs-claim
```

**Key advantage:** `ReadWriteMany` access mode — multiple pods on different nodes can read and write to the same EFS volume simultaneously. EBS only supports `ReadWriteOnce` (single node).

---

## EFS Access Points

Access Points are application-specific entry points into an EFS file system that enforce specific POSIX user identity and directory.

### Why Access Points?

```
WITHOUT ACCESS POINTS:
  All containers mount fs-12345678:/
  Any container can read/write any file
  No isolation between applications

WITH ACCESS POINTS:
  App A → Access Point A → /app-a/ (owned by uid 1000)
  App B → Access Point B → /app-b/ (owned by uid 2000)
  App A cannot access /app-b/ files
  Clean isolation with single EFS file system
```

### Creating Access Points

```bash
# Create access point for web app
aws efs create-access-point \
  --file-system-id fs-12345678 \
  --posix-user "Uid=1000,Gid=1000" \
  --root-directory \
    "Path=/webapp,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=755}" \
  --tags Key=Name,Value=WebAppAccessPoint

# This creates an access point where:
# - The app sees /webapp as its root (like chroot)
# - Files are created with uid/gid 1000
# - The app cannot navigate above /webapp
```

### Access Points + IAM Authentication

```json
// IAM Policy: Allow access to specific access point only
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite"
      ],
      "Resource": "arn:aws:elasticfilesystem:region:account:file-system/fs-12345678",
      "Condition": {
        "StringEquals": {
          "elasticfilesystem:AccessPointArn": 
            "arn:aws:elasticfilesystem:region:account:access-point/fsap-abc123"
        }
      }
    }
  ]
}
```

### Access Point Use Cases

1. **Multi-tenant applications:** Each tenant gets their own access point with isolated directory
2. **Lambda to EFS:** Lambda functions mount EFS via access points with specific user context
3. **Container isolation:** Different microservices use different access points on same EFS
4. **Security compliance:** Enforce specific POSIX user/group permissions for audit requirements

---

## Interview Q&A

### Q1: What is the difference between EFS and EBS?

**Answer:**
- **EBS (Block Store):** Network-attached virtual hard disk. Attached to a single EC2 instance at a time (except Multi-Attach io1/io2). Fixed provisioned size. AZ-locked. Like a dedicated hard drive.
- **EFS (File System):** NFS-based shared file system. Can be mounted by thousands of EC2 instances simultaneously across multiple AZs. Automatically scales. Like a shared network drive.

Choose EBS for: OS disks, databases (MySQL, PostgreSQL), anything needing low-latency block I/O on a single instance.
Choose EFS for: Shared content between multiple instances (web farm, CMS), container shared storage, home directories, configuration files.

---

### Q2: Can EFS be used with Windows instances?

**Answer:** **No.** EFS uses the NFS (Network File System) protocol which is a Linux/Unix standard. Windows does not natively support NFS as a file system mount in the same way.

For Windows shared file storage, use:
- **Amazon FSx for Windows File Server** — Fully managed Windows native file system with SMB/CIFS protocol
- FSx integrates with Active Directory and supports DFS namespaces, which is exactly what Windows workloads need.

---

### Q3: What are EFS Performance Modes and can you change them?

**Answer:** There are two performance modes:
- **General Purpose:** Sub-millisecond latency, lower per-operation overhead. Suitable for 99% of workloads.
- **Max I/O:** Higher aggregate throughput and operations per second, but higher per-operation latency. For massively parallel workloads like big data processing with thousands of clients.

**Critical fact:** Performance mode **cannot be changed after file system creation**. You would need to create a new file system and migrate data. Therefore, think carefully before choosing Max I/O — General Purpose handles most workloads including high-throughput scenarios.

---

### Q4: What are EFS Throughput Modes and which should you use?

**Answer:** Three throughput modes:
- **Bursting:** Throughput scales with storage size (50 KB/s per GB baseline). Uses burst credits. Good for spiky workloads with small storage. Default.
- **Provisioned:** You specify the exact throughput in MB/s regardless of storage size. Used when you need high throughput on small EFS (e.g., 100 MB/s on 10 GB).
- **Elastic (recommended):** Automatically scales up to 3 GB/s read / 1 GB/s write. No burst credits. Pay per use. Best for unpredictable workloads.

For new workloads: use **Elastic Throughput** unless you have specific cost constraints. It's the most hands-off option and handles variable loads automatically.

---

### Q5: An application has 100 EC2 instances in an Auto Scaling Group. They all need to share the same configuration files. What AWS storage solution would you recommend?

**Answer:** **Amazon EFS**. Because:
1. All 100 instances can mount the same EFS file system simultaneously (shared access)
2. Configuration files are typically small but need to be accessed by all instances
3. When ASG scales out, new instances can mount EFS in their UserData script
4. Changes to config files on EFS are immediately visible to all instances
5. EFS is multi-AZ, so it's available even if one AZ goes down

Implementation: Create EFS file system, create Mount Targets in each AZ, mount EFS in the EC2 UserData/launch template.

---

### Q6: What is the EFS Intelligent Tiering feature (Lifecycle Management)?

**Answer:** EFS lifecycle management automatically moves files between **Standard** (frequently accessed) and **Standard-IA** (infrequently accessed) tiers based on access patterns.

Configuration options: Move to IA after 14, 30, 60, 90, or 180 days without access.

You can also configure `TransitionToPrimaryStorageClass=AFTER_1_ACCESS` to move files back to Standard when accessed — useful for files that are cold for a long time but occasionally need fast access.

Cost benefit: Standard-IA costs ~92% less than Standard per GB. For mixed workloads where most files are rarely accessed, this can dramatically reduce costs.

---

### Q7: How does EFS pricing differ from EBS pricing?

**Answer:**
- **EBS:** You pay for the **provisioned size** regardless of how much you use. If you create a 1 TB gp3 volume and only use 100 GB, you pay for 1 TB.
- **EFS:** You pay only for what you **actually store**. If your EFS file system contains 100 GB, you pay for 100 GB. If you add 50 GB more files, you now pay for 150 GB. No pre-provisioning.

This makes EFS better for variable workloads, and EBS better for workloads where you need consistent capacity with predictable costs.

---

### Q8: What is an EFS Access Point and why would you use it?

**Answer:** An EFS Access Point is an application-specific entry point into an EFS file system. It provides:

1. **Root directory enforcement:** The access point sets a root directory — the application can only see files within that directory (like a chroot jail)
2. **POSIX user enforcement:** Forces all file operations to use a specific UID/GID, regardless of the NFS client's user
3. **IAM integration:** Combined with IAM conditions, you can restrict which containers/functions can access which access points

**Why use it:**
- Run multiple applications on one EFS file system with complete isolation
- ECS/EKS containers get isolated storage without separate EFS per service
- Lambda functions accessing EFS need access points
- Enforces security without depending on the client to set correct permissions

---

### Q9: How would you set up EFS for containers running in ECS Fargate?

**Answer:**
1. Create an EFS file system with appropriate throughput mode
2. Create a Mount Target in the same VPC and subnet as your Fargate tasks
3. Configure security groups: EFS security group allows inbound TCP 2049 from the ECS task security group
4. Create an EFS Access Point (required for Fargate)
5. In the ECS Task Definition:
   - Define a volume of type `efsVolumeConfiguration` pointing to the EFS file system and Access Point
   - Mount the volume in the container definition
6. Enable `transitEncryption: ENABLED` and `iam: ENABLED` for security

Fargate doesn't have persistent local disk, so EFS is the primary way to give Fargate containers persistent, shared storage.

---

### Q10: What happens to EFS data if an Availability Zone goes down?

**Answer:** With **EFS Standard** (multi-AZ): Nothing bad happens. EFS Standard stores data redundantly across multiple AZs. The file system remains fully accessible from instances in other AZs via their Mount Targets. Availability SLA is 99.99%.

With **EFS One Zone** (single-AZ): The file system becomes inaccessible while the AZ is down. If the AZ suffers physical destruction (extremely rare), data could be lost. This is why EFS One Zone is only recommended for dev/test or easily reproducible data.

The Mount Target in the affected AZ becomes unavailable, but instances in other AZs using other Mount Targets can still access the data (for Standard class).
