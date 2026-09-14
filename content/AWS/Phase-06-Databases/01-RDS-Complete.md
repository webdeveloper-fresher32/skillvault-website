# RDS (Relational Database Service) — The Definitive Guide

## Table of Contents
1. [What is RDS](#what-is-rds)
2. [Supported Engines](#supported-engines)
3. [What AWS Manages](#what-aws-manages)
4. [RDS Instance Classes](#rds-instance-classes)
5. [RDS Storage](#rds-storage)
6. [High Availability — Multi-AZ](#high-availability--multi-az)
7. [Read Replicas](#read-replicas)
8. [Multi-AZ vs Read Replicas](#multi-az-vs-read-replicas-critical)
9. [RDS Security](#rds-security)
10. [Backups and Restoration](#backups-and-restoration)
11. [RDS Proxy](#rds-proxy)
12. [Amazon Aurora](#amazon-aurora)
13. [Hands-On Labs](#hands-on-labs)
14. [Interview Q&A](#interview-qa)

---

## What is RDS

Amazon RDS (Relational Database Service) is a managed service that makes it easy to set up, operate, and scale a relational database in the cloud. It handles the undifferentiated heavy lifting of database administration.

```
WITHOUT RDS (Self-managed on EC2):
  You handle: OS installation, OS patching, DB installation,
  DB patching, backups, replication setup, failover, monitoring,
  scaling, security hardening, disk management...

WITH RDS:
  AWS handles: OS patches, DB engine patches, automated backups,
  Multi-AZ replication, automatic failover, disk scaling, monitoring

  You handle: Schema design, query optimization, application code,
  DB parameter tuning, choosing instance size
```

---

## Supported Engines

```
+---------------+---------------------------------+-------------------+
| Engine        | AWS Version                     | Notes             |
+---------------+---------------------------------+-------------------+
| MySQL         | 5.7, 8.0                        | Most popular FOSS |
| PostgreSQL    | 12, 13, 14, 15, 16              | Feature-rich FOSS |
| MariaDB       | 10.5, 10.6, 10.11               | MySQL fork        |
| Oracle        | 19c, 21c                        | License required  |
| SQL Server    | 2017, 2019, 2022 (Web/Std/Ent)  | License required  |
| Aurora MySQL  | 3.x (MySQL 8.0 compat.)         | AWS-native        |
| Aurora PgSQL  | 15.x (PgSQL 15 compat.)         | AWS-native        |
+---------------+---------------------------------+-------------------+
```

**License considerations:**
- MySQL, PostgreSQL, MariaDB → Community editions (open source, no license fee)
- Oracle, SQL Server → License Included (AWS bundles license into hourly cost) or BYOL (Bring Your Own License)

---

## What AWS Manages

```
+--------------------------------------------------+
|           RESPONSIBILITY SPLIT                    |
+--------------------------------------------------+
|                                                  |
| AWS MANAGES:                                     |
|   ✓ EC2 instance provisioning                    |
|   ✓ Operating system installation                |
|   ✓ OS security patches                          |
|   ✓ Database engine installation                 |
|   ✓ Database engine patches (minor versions)     |
|   ✓ Automated backups                            |
|   ✓ Multi-AZ replication                         |
|   ✓ Automatic failover                           |
|   ✓ Storage management (EBS)                     |
|   ✓ Hardware replacement                         |
|   ✓ Monitoring (CloudWatch metrics)              |
|                                                  |
| YOU MANAGE:                                      |
|   ✓ Database schema design                       |
|   ✓ Query optimization                           |
|   ✓ Application-level database design            |
|   ✓ Choosing instance type and storage           |
|   ✓ Parameter Group configuration               |
|   ✓ Security Group rules                         |
|   ✓ Major version upgrades (you schedule these) |
|   ✓ Data content and privacy                     |
+--------------------------------------------------+
```

---

## RDS Instance Classes

### Instance Class Families

```
db.t3 / db.t4g — Burstable Performance
  Purpose:  Dev, test, small production
  CPU:      Burst-capable (credit model like EC2 t-types)
  Examples: db.t3.micro, db.t3.small, db.t3.medium, db.t3.large
  Use when: Workload is not CPU-intensive or bursty
  
db.m5 / db.m6g — General Purpose
  Purpose:  Balanced CPU and memory
  CPU:      Consistent performance
  Examples: db.m5.large, db.m5.xlarge, db.m5.2xlarge
  Use when: Production workloads with moderate load

db.r5 / db.r6g — Memory Optimized
  Purpose:  Memory-intensive databases
  RAM:      High memory-to-CPU ratio
  Examples: db.r5.large, db.r5.xlarge, db.r5.4xlarge
  Use when: Large working sets, analytics, caching
  Best for: PostgreSQL, Oracle, SAP HANA

db.x2 — Extreme Memory
  Purpose:  Very large in-memory workloads
  RAM:      Up to 3.9 TB
  Use when: Largest Oracle / SAP workloads
```

**Instance sizing rule of thumb:**
- Start with `db.t3.micro` for dev/test (eligible for Free Tier)
- Use `db.m5.large` for small production
- Use `db.r5.large` or larger when database working set approaches available RAM
- Monitor CloudWatch `FreeableMemory` — keep working set in memory for best performance

---

## RDS Storage

### Storage Types for RDS

```
+------------------+------------------+------------------+
| gp2              | gp3              | io1              |
+------------------+------------------+------------------+
| 3 IOPS/GB        | 3,000 IOPS base  | Provisioned IOPS |
| Max 16,000 IOPS  | Max 64,000 IOPS  | Max 64,000 IOPS  |
| Max 3,277 GB     | Up to 64 TB      | Up to 64 TB      |
| Default for most | Better option    | Mission critical |
+------------------+------------------+------------------+
```

### Storage Autoscaling

RDS can automatically increase storage when free space runs low.

```
How it works:
  1. Set Maximum Storage Threshold (e.g., 1000 GB)
  2. RDS monitors free storage
  3. When free storage < 10% (or < 5 GB) for 5+ minutes...
  4. AND 6+ hours since last storage modification...
  5. → RDS automatically scales up storage

Benefits:
  - Never run out of disk space
  - No manual intervention
  - No downtime for scale-up

Limitations:
  - Cannot decrease storage (only increase)
  - Must set a maximum threshold
```

```bash
# Enable storage autoscaling
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --max-allocated-storage 1000 \
  --apply-immediately
```

---

## High Availability — Multi-AZ

Multi-AZ is RDS's high availability feature. It creates a synchronous standby replica in a different AZ.

### Architecture

```
                    APPLICATION
                        |
                (RDS DNS Endpoint)
                mydb.cluster.region.rds.amazonaws.com
                        |
    +-------------------+-------------------+
    |                                       |
+--------+                             +--------+
| RDS    |   Synchronous Replication   | RDS    |
| Primary|  <========================> | Standby|
| AZ-a   |   (every write replicated   | AZ-b   |
|        |    before acknowledged)     |        |
+--------+                             +--------+
    |                                       |
   EBS                                    EBS
  (AZ-a)                                 (AZ-b)
```

### How Failover Works

```
NORMAL OPERATION:
  All reads and writes → Primary (AZ-a)
  Standby (AZ-b) is passive — receives sync replicas but serves NO traffic

FAILURE SCENARIO:
  Primary goes down (AZ-a failure, hardware failure, etc.)
  
FAILOVER PROCESS:
  Step 1: RDS detects primary failure (usually within 1-2 minutes)
  Step 2: RDS updates DNS record to point to standby IP
  Step 3: Standby becomes new primary
  Step 4: AWS starts creating new standby in AZ-a (or another AZ)
  
Total downtime: Typically 1-2 minutes
  (Your application must handle this — retry connections with backoff)

CRITICAL: The ENDPOINT (DNS name) does NOT change!
  Before: mydb.abc123.us-east-1.rds.amazonaws.com → 10.0.1.5 (AZ-a)
  After:  mydb.abc123.us-east-1.rds.amazonaws.com → 10.0.2.5 (AZ-b)
  Application reconnects to same hostname, gets new primary
```

### When Failover Is Triggered

- Primary instance failure
- AZ failure or disruption
- Loss of network connectivity
- Storage failure
- Manual failover (for maintenance): `aws rds reboot-db-instance --force-failover`
- OS or database patching (brief)

### Multi-AZ for Read Performance

**Multi-AZ does NOT improve read performance.** The standby is passive. To improve read performance, use **Read Replicas**.

---

## Read Replicas

Read Replicas allow you to offload read traffic from the primary instance by creating one or more read-only copies.

### Architecture

```
                    APPLICATION
                    |         |
           WRITES   |         |   READS
                    |         |
                    ↓         ↓
              +----------+  +----------+  +----------+
              | PRIMARY  |→ | Replica  |  | Replica  |
              | (Read/   |  | AZ-b     |  | AZ-c     |
              |  Write)  |  | (Read    |  | (Read    |
              |          |→ |  Only)   |  |  Only)   |
              +----------+  +----------+  +----------+
              Async replication ──────────────────────

Note: Replication is ASYNCHRONOUS (slight lag possible)
```

### Key Read Replica Facts

```
+------------------------------------------+
|           READ REPLICA FACTS             |
+------------------------------------------+
| Number:     Up to 5 read replicas        |
|             (15 for Aurora)              |
| Replication: Asynchronous                |
|             (slight replication lag)     |
| Region:     Same region or cross-region  |
| Engine:     MySQL, PostgreSQL, MariaDB,  |
|             Aurora (not Oracle, MSSQL)   |
| Promotion:  Can promote to standalone DB |
| Endpoint:   Each replica has own DNS     |
| VPC:        Can be in different VPC      |
+------------------------------------------+
```

### Use Cases for Read Replicas

```
1. READ-HEAVY WORKLOADS
   App → Reports/analytics queries → Read Replica
   App → Transactional writes     → Primary

2. REPORTING DASHBOARDS
   Business intelligence tool → Read Replica(s)
   (Avoids impacting production primary)

3. DISASTER RECOVERY
   Cross-region Read Replica → Can be promoted if primary region fails
   (Not automatic — manual promotion required)

4. MIGRATION
   Promote read replica to standalone → Migrate to new region/account
```

### Promoting a Read Replica

Promotion makes a read replica into a standalone RDS instance (read/write). The promoted instance is no longer a replica.

```bash
# Promote read replica to standalone DB
aws rds promote-read-replica \
  --db-instance-identifier my-read-replica \
  --backup-retention-period 7

# After promotion, update application to point to new instance
```

### Cross-Region Read Replicas

```
+------------------+           +------------------+
|   us-east-1      |           |   ap-southeast-2 |
|                  |           |                  |
|   Primary DB     | --------> |  Cross-Region    |
|                  | Async rep |  Read Replica    |
|                  |           |                  |
+------------------+           +------------------+
```

**Benefits:**
- Read traffic can be served locally in the destination region (lower latency)
- Can be promoted for DR if primary region goes down
- Network charges apply for cross-region replication

---

## Multi-AZ vs Read Replicas (CRITICAL)

This is the most commonly tested RDS topic. Know this cold.

```
+---------------------------+---------------------------+
|       MULTI-AZ            |     READ REPLICAS         |
+---------------------------+---------------------------+
| PURPOSE                                               |
| High Availability/DR      | Read Scalability          |
+---------------------------+---------------------------+
| REPLICATION                                           |
| Synchronous               | Asynchronous              |
+---------------------------+---------------------------+
| CONSISTENCY                                           |
| Zero data loss            | Slight lag possible       |
+---------------------------+---------------------------+
| STANDBY READS                                         |
| Standby CANNOT serve reads| Replicas serve reads      |
+---------------------------+---------------------------+
| FAILOVER                                              |
| Automatic                 | Manual (promotion)        |
+---------------------------+---------------------------+
| ENDPOINTS                                             |
| Same endpoint (DNS change)| Each has own endpoint     |
+---------------------------+---------------------------+
| REGIONS                                               |
| Same region (different AZ)| Same or cross-region      |
+---------------------------+---------------------------+
| USE WHEN:                                             |
| Need automatic failover   | Need read scalability     |
| "Never lose a write"      | Offload heavy reads       |
| Compliance/HA SLA         | Run reports               |
+---------------------------+---------------------------+
| CAN COMBINE BOTH?                                     |
| YES — Primary with Multi-AZ + Read Replicas          |
+---------------------------+---------------------------+
```

**Exam trick:** The question says "The database is experiencing too much read load." The answer is always **Read Replicas**, not Multi-AZ. Multi-AZ does NOT help with read performance.

---

## RDS Security

### Network Security

```
+-----------------------------------------------+
|                    VPC                        |
|                                               |
|  +---------------+     +------------------+  |
|  | App Tier (EC2)|     | Database Tier    |  |
|  | SG: sg-app    | --> | SG: sg-database  |  |
|  +---------------+     |                  |  |
|                         | RDS: Private     |  |
|                         | Subnet (no IGW)  |  |
|                         +------------------+  |
|                                               |
|   sg-database inbound rules:                  |
|   TCP 3306 from sg-app (MySQL)               |
|   TCP 5432 from sg-app (PostgreSQL)          |
+-----------------------------------------------+

RULE: RDS should ALWAYS be in private subnet
       NEVER expose RDS directly to internet
```

### Encryption

```
AT REST:
  - KMS encryption (AWS Managed Key or CMK)
  - Enabled at creation time (cannot be changed later)
  - Encrypts: DB data, automated backups, read replicas, snapshots
  
IN TRANSIT:
  - SSL/TLS enabled by default
  - Force SSL: Set Parameter Group rds.force_ssl = 1 (PostgreSQL)
               ssl-require = 1 (MySQL)

IAM DATABASE AUTHENTICATION:
  - Use IAM roles/users to authenticate to MySQL/PostgreSQL
  - Token-based (15-minute tokens generated by IAM)
  - No permanent password stored
  - Works for EC2 instances with IAM roles
  
  ENABLE:
  aws rds modify-db-instance \
    --db-instance-identifier mydb \
    --enable-iam-database-authentication
```

### Parameter Groups and Option Groups

```
Parameter Group:
  Settings for the database engine
  Examples:
    max_connections = 1000
    slow_query_log = 1
    character_set_server = utf8mb4
  
  Static parameters:  Require DB reboot to apply
  Dynamic parameters: Apply immediately

Option Group:
  Additional features for the DB engine
  Examples: Oracle APEX, SQL Server transparent data encryption
```

---

## Backups and Restoration

### Automated Backups

```
+------------------------------------------+
|          AUTOMATED BACKUPS               |
+------------------------------------------+
| Retention:   1-35 days (default: 7 days) |
| Window:      30 min (off-peak hours)     |
| What:        Full daily snapshot +        |
|              transaction logs every 5 min|
| Storage:     S3 (free — same size as DB) |
| PITR:        Any second in retention     |
|              period                      |
| Delete:      Deleted with DB instance    |
|              (unless retained)           |
+------------------------------------------+
```

**Point-in-Time Recovery (PITR):**
```
Automated backup + transaction logs = PITR

Can restore to any point in last N days
  (where N = retention period, up to 35 days)

Example: "Restore database to yesterday at 2:15:32 PM"
  → RDS restores last daily snapshot
  → Replays transaction logs up to 2:15:32 PM
  → Creates NEW DB instance (not overwrites existing!)
```

### Manual Snapshots

```
+------------------------------------------+
|          MANUAL SNAPSHOTS                |
+------------------------------------------+
| Triggered:   By you (console/CLI/API)    |
| Retained:    Until YOU delete them       |
|             (even if DB is deleted)      |
| Cost:        S3 storage for snapshot     |
| Cross-region: Can be copied              |
| Sharing:     Can share with other accts  |
+------------------------------------------+
```

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier mydb \
  --db-snapshot-identifier mydb-snapshot-2024-01-15

# Restore from snapshot (creates NEW DB instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier mydb-restored \
  --db-snapshot-identifier mydb-snapshot-2024-01-15 \
  --db-instance-class db.m5.large \
  --db-subnet-group-name mydb-subnet-group
```

**Important:** Restoring from snapshot or PITR always creates a **NEW** RDS instance. It does not modify the existing one.

---

## RDS Proxy

### The Problem RDS Proxy Solves

```
THE PROBLEM:
+----------+     connections     +----------+
| 1000     | ==================>| RDS      |
| Lambda   |   (each function   | (limited |
| functions|    opens its own   |  max     |
|          |    DB connection)  |  conns)  |
+----------+                    +----------+
  Result: Too many connections, DB throttles, connection errors

THE SOLUTION: RDS Proxy
+----------+     +----------+     +----------+
| 1000     |     |  RDS     |     | RDS      |
| Lambda   |---->| Proxy    |---->| Database |
| functions|     |          |     |          |
+----------+     | Pool of  |     +----------+
                 | ~50 conns|
                 +----------+
  Result: Proxy maintains pool, Lambda reuses connections
```

### RDS Proxy Features

```
+------------------------------------------+
|           RDS PROXY                      |
+------------------------------------------+
| Connection pooling                        |
| Reduces database connections by up to    |
| 87% (for Lambda use case)               |
|                                          |
| Failover improvement:                    |
| Reduces failover time by up to 66%       |
| Application sees shorter interruption    |
|                                          |
| IAM authentication                       |
| No database credentials in app code     |
|                                          |
| Supports: MySQL, PostgreSQL, SQL Server, |
|           Aurora MySQL, Aurora PostgreSQL|
|                                          |
| Serverless: Highly available, multi-AZ  |
| VPC only: Cannot be accessed publicly   |
+------------------------------------------+
```

**When to use RDS Proxy:**
- Lambda functions connecting to RDS (primary use case)
- Applications with many short-lived connections
- When you want improved failover time
- Microservices architecture with many small services

---

## Amazon Aurora

Aurora is AWS's proprietary cloud-native relational database, compatible with MySQL and PostgreSQL.

### Aurora Architecture

```
+--------------------------------------------------------+
|                    AURORA CLUSTER                       |
|                                                        |
|  +-------------+  +-------------+  +-------------+   |
|  | Writer      |  | Reader 1    |  | Reader 2    |   |
|  | (Primary)   |  | (Replica)   |  | (Replica)   |   |
|  | db.r5.large |  | db.r5.large |  | db.r5.large |   |
|  +------+------+  +------+------+  +------+------+   |
|         |                |                |           |
|  +------+----------------+----------------+------+   |
|  |         SHARED AURORA STORAGE LAYER           |   |
|  |                                               |   |
|  |  +------+ +------+ +------+ +------+ +------+|   |
|  |  | 10GB | | 10GB | | 10GB | | 10GB | | 10GB ||   |
|  |  | AZ-a | | AZ-a | | AZ-b | | AZ-b | | AZ-c ||   |
|  |  +------+ +------+ +------+ +------+ +------+|   |
|  |                                               |   |
|  | Auto-expands in 10 GB increments up to 128 TB|   |
|  | 6 copies of data across 3 AZs                |   |
+--+-----------------------------------------------+---+
```

### How Aurora Storage Works

```
AURORA STORAGE (Unique to Aurora):
  - Shared across all instances in the cluster
  - Starts at 10 GB, auto-grows to 128 TB
  - 6 copies spread across 3 AZs (2 per AZ)
  - Can tolerate: 2 copies lost without write impact
                  3 copies lost without read impact
  - Self-healing: continuously scans and repairs

COMPARISON:
  RDS:    Each instance has its own EBS volume
          Must replicate data across volumes
  Aurora: All instances share one distributed storage
          Much faster replication (no data movement)
```

### Aurora vs RDS Performance

```
Aurora MySQL vs RDS MySQL:
  Up to 5× faster than standard MySQL

Aurora PostgreSQL vs RDS PostgreSQL:
  Up to 3× faster than standard PostgreSQL

Why faster?
  - Custom distributed storage (less I/O path)
  - Only redo logs sent across network (not full pages)
  - Read from local storage node (low latency)
  - Write acknowledged after 4 of 6 storage copies written
```

### Aurora Replicas

```
RDS MySQL Read Replicas: Up to 5
Aurora Replicas:         Up to 15 (within same cluster)

Aurora replica benefits over RDS:
  - Access same storage (no replication lag in storage)
  - Automatic failover to Aurora Replica if writer fails
  - Sub-second replication (just log forwarding)
```

### Aurora Endpoints

```
Aurora has multiple types of endpoints:

1. CLUSTER ENDPOINT (Writer Endpoint)
   mydb.cluster-abc123.us-east-1.rds.amazonaws.com
   Always points to current writer instance
   Use for: All writes, some reads

2. READER ENDPOINT
   mydb.cluster-ro-abc123.us-east-1.rds.amazonaws.com
   Load balances across all reader instances
   Use for: Read-only queries, reporting

3. INSTANCE ENDPOINTS
   mydb-instance-1.abc123.us-east-1.rds.amazonaws.com
   Points to specific instance
   Use for: Debugging, specific instance targeting

4. CUSTOM ENDPOINTS
   Define subset of instances (e.g., larger instances for analytics)
```

### Aurora Global Database

```
+------------------+           +------------------+
|   PRIMARY REGION  |           |  SECONDARY REGION|
|   us-east-1       |           |  eu-west-1       |
|                   |           |                  |
|  Aurora Cluster   |  -------> |  Aurora Cluster  |
|  (Read/Write)     | < 1 sec   |  (Read Only)     |
|                   | repl lag  |                  |
+------------------+           +------------------+
                                
Primary region:   Single Aurora cluster
Secondary regions: Up to 5 (read only, < 1 second lag)
Failover:         Promote secondary to primary in < 1 minute

Use cases:
  - Global applications needing low-latency reads worldwide
  - Disaster recovery with sub-second RPO
```

### Aurora Serverless v2

```
+-------------------------------------------+
|         AURORA SERVERLESS V2              |
+-------------------------------------------+
| Scales:   From 0.5 ACU to 128 ACUs        |
|           (Aurora Capacity Units)          |
| Billing:  Per ACU per second              |
| Pause:    Can scale to 0 (v1 feature)    |
|           v2 scales to minimum, not zero  |
| Failover: Instant (no cold start)        |
|                                          |
| ACU = 2 GB RAM + proportional CPU        |
| 0.5 ACU → 1 GB RAM (smallest)           |
| 128 ACU → 256 GB RAM (largest)          |
+-------------------------------------------+
| USE WHEN:                                 |
| - Unpredictable or variable traffic      |
| - Dev/test databases                     |
| - New applications with unknown scale   |
| - Infrequently used applications         |
+-------------------------------------------+
```

### Aurora Backtrack

```
BACKTRACK (MySQL-compatible Aurora only):
  Rewind the database IN-PLACE to any point in the past
  (within backtrack window)
  
  Without backtrack:  Need to restore snapshot to NEW instance
  With backtrack:     Roll back same cluster in minutes, no new instance
  
  Use case: "Oops, I ran DROP TABLE"
  Backtrack window: Up to 72 hours
  
  Enables: mysql> CALL mysql.rds_set_backtrack_period(86400);
```

---

## Hands-On Labs

### Lab 1: Launch RDS MySQL in Private Subnet

```bash
# Step 1: Create a subnet group (requires subnets in 2+ AZs)
aws rds create-db-subnet-group \
  --db-subnet-group-name mydb-subnet-group \
  --db-subnet-group-description "MySQL DB Subnet Group" \
  --subnet-ids subnet-private-az-a subnet-private-az-b

# Step 2: Create security group for RDS
aws ec2 create-security-group \
  --group-name sg-rds \
  --description "RDS Security Group" \
  --vpc-id vpc-12345678

# Allow MySQL from app servers
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-id \
  --protocol tcp \
  --port 3306 \
  --source-group sg-app-id

# Step 3: Launch RDS MySQL
aws rds create-db-instance \
  --db-instance-identifier my-mysql-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version "8.0" \
  --master-username admin \
  --master-user-password "SecurePassword123!" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-subnet-group-name mydb-subnet-group \
  --vpc-security-group-ids sg-rds-id \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --multi-az \
  --tags Key=Environment,Value=dev
```

### Lab 2: Connect from EC2 in Same VPC

```bash
# On your EC2 instance (in same VPC, using sg-app security group)

# Install MySQL client
sudo yum install -y mysql

# Get RDS endpoint from console or:
aws rds describe-db-instances \
  --db-instance-identifier my-mysql-db \
  --query 'DBInstances[0].Endpoint.Address'

# Connect to RDS
mysql -h my-mysql-db.abc123.us-east-1.rds.amazonaws.com \
      -u admin \
      -p

# Test
mysql> SHOW DATABASES;
mysql> CREATE DATABASE myapp;
mysql> USE myapp;
mysql> CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
mysql> INSERT INTO users (name) VALUES ('Ganesh');
mysql> SELECT * FROM users;
```

### Lab 3: Create Read Replica

```bash
# Create read replica (in same region, different AZ)
aws rds create-db-instance-read-replica \
  --db-instance-identifier my-mysql-db-replica \
  --source-db-instance-identifier my-mysql-db \
  --db-instance-class db.t3.micro \
  --availability-zone ap-southeast-2b

# Create cross-region read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier my-mysql-db-replica-us \
  --source-db-instance-identifier arn:aws:rds:ap-southeast-2:123456789012:db:my-mysql-db \
  --db-instance-class db.t3.micro \
  --region us-east-1

# Promote read replica to standalone (for DR drill)
aws rds promote-read-replica \
  --db-instance-identifier my-mysql-db-replica
```

---

## Interview Q&A

### Q1: What is the difference between Multi-AZ and Read Replicas?

**Answer:**

**Multi-AZ:**
- Purpose: HIGH AVAILABILITY — automatic failover if primary fails
- Replication: SYNCHRONOUS — every write must be confirmed by standby before acknowledged
- Standby: Passive — does NOT serve read traffic (cannot use for read scaling)
- Failover: AUTOMATIC — RDS updates DNS, typically 1-2 minute downtime
- Region: Same region, different AZ only

**Read Replicas:**
- Purpose: READ SCALABILITY — offload read queries from primary
- Replication: ASYNCHRONOUS — slight lag possible (usually milliseconds)
- Replicas: ACTIVE — serve read traffic with their own endpoints
- Failover: MANUAL — must promote replica to standalone
- Region: Same or cross-region

**Exam tip:** If question says "too much read traffic" → Read Replicas. If "database goes down" → Multi-AZ.

---

### Q2: How does RDS Multi-AZ failover work?

**Answer:** When the primary RDS instance fails:
1. RDS detects the failure (monitoring checks fail)
2. RDS automatically updates the DNS record for the cluster endpoint to point to the standby instance's IP address
3. The standby becomes the new primary (it already has all data due to synchronous replication)
4. AWS provisions a new standby instance in the original AZ (or another AZ)
5. Synchronous replication resumes to the new standby

**Key point:** The application must use the DNS endpoint (not hardcoded IP). Since DNS changes, the application reconnects to the new primary using the same hostname. Connection poolers may need to handle reconnection logic with retries.

Typical failover time: 1-2 minutes.

---

### Q3: Why would you use RDS Proxy?

**Answer:** RDS Proxy is primarily used when **Lambda functions connect to RDS**. The problem:

Lambda can have hundreds or thousands of concurrent function invocations, each trying to open its own database connection. RDS databases have a maximum connection limit (e.g., db.t3.micro MySQL has ~87 max connections). Without a proxy, this causes connection exhaustion and errors.

RDS Proxy maintains a connection pool and reuses connections. Lambda functions connect to the proxy (which accepts many connections), and the proxy multiplexes these onto a smaller pool of actual database connections.

Additional benefits: Faster failover (proxy redirects existing connections), IAM authentication support, no credentials in application code.

---

### Q4: How does Aurora differ from standard RDS?

**Answer:** Aurora uses a fundamentally different architecture:

1. **Shared distributed storage:** All Aurora instances (writer + readers) share the same underlying storage layer. In standard RDS, each instance has its own EBS volume and data must be replicated.

2. **Storage auto-scaling:** Aurora storage starts at 10 GB and automatically grows in 10 GB increments up to 128 TB. No manual storage provisioning.

3. **Replicas:** Aurora supports up to 15 read replicas vs 5 for RDS MySQL. Aurora replicas have near-zero replication lag because they access the same shared storage.

4. **Performance:** Up to 5× faster than MySQL, 3× faster than PostgreSQL.

5. **Failover:** Aurora can promote a read replica to writer automatically in under 30 seconds (vs 1-2 minutes for Multi-AZ RDS).

6. **Backtrack:** Aurora MySQL supports rewinding the database in-place (no restore needed).

Aurora costs about 20% more than comparable RDS but provides significantly higher performance, scalability, and availability.

---

### Q5: What are the Aurora endpoints and when do you use each?

**Answer:**
1. **Cluster endpoint (writer):** Routes to the current primary/writer. Use for all writes and reads that need up-to-date data.
2. **Reader endpoint:** Load balances read requests across all Aurora read replicas. Use for read-heavy queries, reporting.
3. **Instance endpoints:** Point to individual instances. Used for debugging or targeting specific instances.
4. **Custom endpoints:** You define a subset of instances (e.g., larger instances) as a custom endpoint. Used when different workloads need different instance sizes (OLTP vs analytics).

---

### Q6: Can you take a snapshot of a Multi-AZ RDS instance? Does it affect production?

**Answer:** Yes, you can take snapshots of Multi-AZ instances. AWS takes the snapshot from the **standby instance**, not the primary. This means:
- No I/O suspension on the primary
- No impact on production read/write performance
- The snapshot is taken without interrupting the application

For single-AZ RDS, snapshots may cause a brief I/O suspension (sub-second for most engines).

---

### Q7: What is the maximum retention period for RDS automated backups?

**Answer:** The maximum retention period for automated backups is **35 days** (minimum 1 day). The default is 7 days.

During the retention period, you can perform **Point-in-Time Recovery (PITR)** to any second within that window. PITR works by restoring the latest full snapshot and then replaying transaction logs up to the desired point in time.

Automated backups are automatically deleted when the retention period expires. Manual snapshots are retained indefinitely until explicitly deleted.

---

### Q8: A company needs their RDS PostgreSQL database to scale automatically based on traffic. What would you recommend?

**Answer:** **Aurora Serverless v2** for PostgreSQL. It:
- Automatically scales compute capacity (ACUs) up and down based on actual demand
- Scales in fine-grained increments (0.5 ACU increments)
- Provides near-instant scaling without downtime
- You pay per ACU-second (cost-effective for variable workloads)
- Still Aurora PostgreSQL underneath — all Aurora features available

Alternatively, if they want to keep standard RDS, use **Read Replicas** for read scaling and manually resize the primary instance during maintenance windows.

---

### Q9: What encryption options are available for RDS?

**Answer:**

**At rest:** Enable KMS encryption when creating the instance. Uses AES-256. Once enabled, cannot be disabled (must snapshot, copy as unencrypted, and restore — complex). Encrypts all data, backups, and replicas. Can use AWS managed key (`aws/rds`) or your own CMK.

**In transit:** SSL/TLS connections are available for all RDS engines. To enforce SSL, set the `rds.force_ssl = 1` parameter (PostgreSQL) or use a CA certificate to verify server identity.

**IAM authentication:** Instead of passwords, use IAM roles to generate authentication tokens (15-minute tokens). Supported for MySQL and PostgreSQL. Ideal for EC2 and Lambda connecting to RDS without storing credentials.

---

### Q10: What is an RDS DB Subnet Group?

**Answer:** A DB Subnet Group is a collection of subnets (in different AZs) that RDS can use to create instances. You MUST have at least 2 subnets in different AZs in the subnet group, even if you're only using a single-AZ deployment.

Why: RDS needs to know which subnets it can use if it needs to perform failover or create a standby in a different AZ. Without the subnet group covering multiple AZs, Multi-AZ would be impossible.

Best practice: Always use private subnets in your subnet group. Never include subnets with an Internet Gateway route.

---

### Q11: How does Aurora Global Database work and when would you use it?

**Answer:** Aurora Global Database replicates an Aurora cluster to up to 5 additional regions using Aurora's dedicated infrastructure (not the public internet).

Architecture:
- One primary region with read/write Aurora cluster
- Up to 5 secondary regions with read-only clusters
- Replication lag: typically under 1 second

Failover in disaster:
- Manually promote a secondary region to primary
- Takes under 1 minute (vs hours for typical DR)

Use cases:
1. **Global applications** — Users in Australia read from ap-southeast-2, users in Europe read from eu-west-1, with low latency
2. **Disaster recovery** — Sub-second RPO (Recovery Point Objective), under 1 minute RTO (Recovery Time Objective)
3. **Compliance** — Keep data in specific geographic regions while serving global users

---

### Q12: What happens to read replicas if you enable Multi-AZ?

**Answer:** You can have BOTH Multi-AZ AND Read Replicas simultaneously — they serve different purposes and are additive.

With both enabled:
- Multi-AZ standby provides automatic failover for HA
- Read Replicas provide read scalability

When using Multi-AZ with read replicas:
- If the primary fails, it fails over to the Multi-AZ standby
- Read replicas continue to replicate from the new primary (may experience brief replication pause during failover)
- The reader endpoint redirects to replicas automatically

This is a common production architecture for high-traffic, high-availability applications.

---

### Q13: How would you migrate a self-managed MySQL on EC2 to RDS with minimal downtime?

**Answer:** Using **AWS Database Migration Service (DMS)**:

1. Create the target RDS MySQL instance
2. Set up DMS replication instance
3. Create a DMS Full Load + CDC (Change Data Capture) task
4. Full Load: DMS copies existing data to RDS (production still running on EC2)
5. CDC: DMS continuously replicates ongoing changes from EC2 MySQL to RDS (using binlog)
6. Monitor replication lag — when lag approaches 0, schedule the cutover
7. Cutover: Stop writes to EC2 MySQL, wait for RDS to catch up, update application config to point to RDS endpoint, start writes to RDS
8. Decommission EC2 MySQL

Minimal downtime: Only the brief cutover window (seconds to minutes).

---

### Q14: What is the difference between RDS parameter groups and option groups?

**Answer:**
- **Parameter Group:** Controls database engine configuration parameters (like a my.cnf or postgresql.conf file). Examples: `max_connections`, `innodb_buffer_pool_size`, `slow_query_log`. Changes to dynamic parameters take effect immediately; static parameters require a reboot.

- **Option Group:** Enables additional features for specific database engines. Not all engines have option groups. Examples: Oracle APEX, Oracle TimeZone, SQL Server Transparent Data Encryption, MySQL Memcached support. Each option group option adds specific functionality that isn't part of the core engine configuration.

RDS provides default parameter groups and option groups for each engine version. You create custom groups when you need non-default settings.

---

### Q15: An application has a read replica being used for reporting. The reports sometimes show slightly stale data. Why is this happening and how do you handle it?

**Answer:** This is expected behavior. RDS Read Replicas use **asynchronous replication** — there is always some replication lag between the primary and replica. For most workloads this is milliseconds, but under heavy write load it can grow to seconds or more.

**Solutions:**
1. **Accept the lag** for reporting use cases — reports showing data that's a few seconds old is usually acceptable
2. **Check replication lag** via CloudWatch metric `ReplicaLag` (in seconds) — set alarms if it exceeds threshold
3. **Direct time-sensitive queries to primary** — only use replicas for reports that don't need real-time data
4. **Scale up the replica** — if replica is CPU/IO limited, it falls behind faster. Larger instance size reduces lag
5. **For truly consistent reads** — point those queries to the primary endpoint instead

Replication lag is a fundamental tradeoff with read replicas — you get read scalability at the cost of potential staleness.
