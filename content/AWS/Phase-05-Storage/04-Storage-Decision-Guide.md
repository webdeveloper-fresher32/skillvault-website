# Storage Decision Guide — S3 vs EBS vs EFS vs FSx

## The One-Page Summary

```
+------------+------------------+------------------+------------------+------------------+
|            |       S3         |       EBS        |       EFS        |       FSx        |
+------------+------------------+------------------+------------------+------------------+
| Type       | Object           | Block            | File (NFS)       | File (SMB/Lustre)|
| Access     | HTTP/REST        | OS filesystem    | NFS v4           | SMB or Lustre    |
| OS Support | Any              | Any              | Linux only       | Windows or Linux |
| Concurrent | Yes (HTTP)       | No (1 instance)  | Yes (thousands)  | Yes              |
| Scalability| Unlimited        | Up to 64 TB      | Unlimited        | Varies by type   |
| Durability | 11 nines         | 99.999%          | 11 nines         | 11 nines         |
| AZ Scope   | Region-wide      | Single AZ        | Region-wide      | Single or Multi  |
| Pricing    | Per GB stored    | Per GB provis.   | Per GB stored    | Per GB provisioned|
| Latency    | Milliseconds     | Sub-millisecond  | NFS latency      | Similar to EFS   |
+------------+------------------+------------------+------------------+------------------+
```

---

## Master Decision Flowchart

```
START: What does your application need?
                    |
    +---------------+---------------+
    |               |               |
Static files    Running app     Shared files
(no server)    needs storage     multi-instance
    |               |               |
    ↓               |               ↓
   S3              |         Linux instances?
                   |               |
                   |         YES → EFS
                   |         NO  → FSx for Windows
                   |
    Does your app need:
                   |
    +--------------+--------------+
    |              |              |
 OS disk       Database       Big data /
 app dir       workload       streaming logs
    |              |              |
   gp3         io2 (critical)   st1 (HDD)
   EBS         gp3 (standard)   EBS
               EBS
```

## Detailed Decision Questions

### Question 1: Can it be block storage?

If your use case involves:
- OS disk → EBS
- Database requiring ACID transactions → EBS
- Swap space → EBS
- Application binary and library files → EBS

**→ Use EBS**

### Question 2: Do multiple compute resources need to access the same data simultaneously?

If YES:
- Multiple Linux instances → EFS
- Multiple containers (ECS/EKS) → EFS
- Windows instances / Active Directory → FSx for Windows File Server
- HPC / ML training with parallel access → FSx for Lustre

**→ Use EFS or FSx**

### Question 3: Is the data accessed via HTTP/HTTPS?

- Static website → S3
- Application assets (images, videos, documents) → S3 (via CloudFront)
- Data lake / analytics → S3
- Backup destination → S3

**→ Use S3**

---

## Use Case Mapping

### Web Application

```
+----------------------------------+
|        WEB APPLICATION           |
+----------------------------------+
| Component        | Storage       |
+----------------------------------+
| EC2 OS disk      | EBS gp3       |
| Application code | EBS gp3       |
| Session data     | ElastiCache   |
| User uploads     | S3            |
| Static assets    | S3 + CloudFront|
| Shared configs   | EFS           |
| Database         | RDS (EBS)     |
| Access logs      | S3            |
+----------------------------------+
```

### Machine Learning Pipeline

```
+----------------------------------+
|        ML PIPELINE               |
+----------------------------------+
| Component        | Storage       |
+----------------------------------+
| Training data    | S3 or FSx     |
|                  | for Lustre    |
| Model weights    | S3            |
| Training scripts | EFS or EBS    |
| GPU instance OS  | EBS gp3       |
| Checkpoint saves | EFS (shared)  |
| Final models     | S3            |
| Feature store    | S3 or DynamoDB|
+----------------------------------+
```

### Containerized Microservices

```
+----------------------------------+
|     CONTAINERIZED SERVICES       |
+----------------------------------+
| Component        | Storage       |
+----------------------------------+
| Container images | ECR (S3-backed)|
| Ephemeral tmp    | Container FS  |
| Shared code/data | EFS           |
| Config files     | EFS or SSM PS |
| Database         | RDS (EBS)     |
| Event files      | S3            |
| Logs             | CloudWatch    |
+----------------------------------+
```

### Backup and Disaster Recovery

```
+----------------------------------+
|      BACKUP AND DR               |
+----------------------------------+
| Use Case         | Storage       |
+----------------------------------+
| EC2 backups      | EBS Snapshots |
| DB backups       | RDS Snapshots |
| File archives    | S3 Glacier    |
| Long-term arch.  | S3 Deep Arch. |
| Application DR   | CRR on S3     |
| Database DR      | RDS Multi-AZ  |
+----------------------------------+
```

---

## Amazon FSx Options

FSx is AWS's fully managed third-party file system service. There are four types:

### FSx for Windows File Server

```
+----------------------------------+
|    FSx FOR WINDOWS FILE SERVER   |
+----------------------------------+
| Protocol:    SMB (Server Message |
|              Block)              |
| OS Support:  Windows             |
| AD:          Active Directory    |
|              integrated          |
| Features:    DFS namespaces,     |
|              VSS snapshots       |
| Use case:    Windows workloads,  |
|              home directories,   |
|              SQL Server backups  |
+----------------------------------+
```

### FSx for Lustre

```
+----------------------------------+
|    FSx FOR LUSTRE                |
+----------------------------------+
| Protocol:    Lustre (Linux)      |
| Performance: Hundreds of GB/s    |
|              Millions of IOPS    |
| S3 Integration: Yes              |
|   (data visible in both)         |
| Use case:    HPC, ML training,   |
|              financial modeling, |
|              video rendering     |
+----------------------------------+
```

### FSx for NetApp ONTAP

```
+----------------------------------+
|    FSx FOR NETAPP ONTAP          |
+----------------------------------+
| Protocols:  NFS, SMB, iSCSI     |
| OS Support: Linux, Windows       |
| Features:   NetApp SnapMirror,   |
|             FlexClone, dedupe    |
| Use case:   Enterprise workloads |
|             migrating from on-   |
|             premises NetApp      |
+----------------------------------+
```

### FSx for OpenZFS

```
+----------------------------------+
|    FSx FOR OPENZFS               |
+----------------------------------+
| Protocol:    NFS                 |
| Performance: Up to 1 M IOPS     |
| Features:    ZFS snapshots,      |
|              compression,        |
|              data cloning        |
| Use case:    Linux workloads     |
|              requiring ZFS       |
+----------------------------------+
```

---

## Cost Comparison (Approximate — ap-southeast-2)

```
+-------------------+----------------+---------------------------+
| Service           | Cost           | Notes                     |
+-------------------+----------------+---------------------------+
| S3 Standard       | $0.025/GB/mo   | No provisioning           |
| S3 Standard-IA    | $0.019/GB/mo   | + retrieval fee           |
| S3 Glacier        | $0.005/GB/mo   | + retrieval fee + time    |
| S3 Deep Archive   | $0.002/GB/mo   | Cheapest long-term        |
+-------------------+----------------+---------------------------+
| EBS gp3           | $0.096/GB/mo   | Pay for provisioned       |
| EBS gp2           | $0.114/GB/mo   | Pay for provisioned       |
| EBS io2           | $0.138/GB/mo   | + IOPS charges            |
| EBS st1           | $0.051/GB/mo   | HDD, throughput opt.      |
| EBS sc1           | $0.018/GB/mo   | HDD, cold storage         |
+-------------------+----------------+---------------------------+
| EFS Standard      | $0.36/GB/mo    | Pay per use, multi-AZ    |
| EFS Standard-IA   | $0.04/GB/mo    | + retrieval fee           |
| EFS One Zone      | $0.20/GB/mo    | Single AZ                 |
+-------------------+----------------+---------------------------+
| FSx Windows       | $0.23/GB/mo    | SSD, HA pair              |
| FSx Lustre        | $0.145/GB/mo   | SSD Scratch               |
+-------------------+----------------+---------------------------+

Note: Actual costs vary. Always check AWS Pricing Calculator.
S3 typically cheapest for object storage at scale.
EBS cheapest per GB for block storage.
EFS premium justified by shared access capability.
```

---

## Common Exam Scenarios

| Scenario | Answer | Reason |
|----------|--------|--------|
| Host static website | S3 | HTTP, no server |
| Store user profile images | S3 | Object storage, HTTP access |
| OS disk for EC2 | EBS gp3 | Block storage, single attach |
| MySQL database disk | EBS gp3/io2 | Block storage, low latency |
| Share files between 10 EC2 Linux | EFS | Shared NFS, multi-instance |
| Share files between Windows instances | FSx for Windows | SMB, Active Directory |
| Archive 7-year compliance data | S3 Glacier Deep Archive | Cheapest long-term |
| Backup with immediate restore | S3 Standard-IA | Low cost, instant retrieval |
| Big data / Hadoop data nodes | EBS st1 | High throughput HDD |
| ML training data from many nodes | FSx for Lustre | Parallel HPC filesystem |
| Container (ECS/EKS) persistent storage | EFS | Shared, multi-AZ |
| Lambda function persistent storage | EFS via Access Point | Only persistent option |

---

## When NOT to Use Each Service

### Do NOT use S3 when:
- You need low-latency block access (database — use EBS)
- You need POSIX file semantics (use EFS)
- You need to mount as a local filesystem natively (use EFS)
- You need strong consistency with concurrent writers at byte level

### Do NOT use EBS when:
- Multiple instances need access simultaneously (use EFS)
- You need to host static website content (use S3)
- You need cost-effective long-term archival (use S3 Glacier)

### Do NOT use EFS when:
- You have Windows instances (use FSx for Windows)
- You need extreme HPC performance (use FSx for Lustre)
- You need block storage for a database (use EBS)
- Your budget is very tight for small files (EFS per-GB cost is higher than S3/EBS)

### Do NOT use FSx when:
- You just need simple shared Linux storage (EFS is simpler and sufficient)
- You have a basic web farm needing shared configs (EFS)
- You're storing objects (use S3)
