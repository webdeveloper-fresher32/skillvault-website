# Phase 5: Storage

## Overview

This phase covers all AWS storage services. Storage is one of the most heavily tested areas in AWS certifications and is critical for real-world architecture decisions.

## Why Storage Matters

Every application needs to store data somewhere. Choosing the wrong storage type leads to:
- Unnecessary cost
- Poor performance
- Operational complexity
- Security vulnerabilities

AWS offers three fundamental storage paradigms, each optimized for different use cases.

## Storage Types at a Glance

```
+------------------+------------------+------------------+
|   OBJECT (S3)    |   BLOCK (EBS)    |   FILE (EFS)     |
+------------------+------------------+------------------+
| Flat namespace   | Raw disk blocks  | Hierarchical FS  |
| Access via HTTP  | Access via OS    | Access via NFS   |
| Unlimited scale  | Fixed size       | Auto-scale       |
| Cheap at scale   | High performance | Shared access    |
| Eventual consist | Strong consist   | Strong consist   |
+------------------+------------------+------------------+
| Use: images,     | Use: OS disk,    | Use: shared      |
| backups, static  | databases,       | config, CMS,     |
| websites         | swap space       | container storage|
+------------------+------------------+------------------+
```

## Files in This Phase

| File | Service | Priority |
|------|---------|----------|
| [01-S3-Complete.md](01-S3-Complete.md) | Simple Storage Service | CRITICAL |
| [02-EBS-Complete.md](02-EBS-Complete.md) | Elastic Block Store | HIGH |
| [03-EFS-Complete.md](03-EFS-Complete.md) | Elastic File System | HIGH |
| [04-Storage-Decision-Guide.md](04-Storage-Decision-Guide.md) | Comparison & Decision Guide | CRITICAL |

## Learning Path

```
Week 1:
  Day 1-2: S3 fundamentals, storage classes, lifecycle
  Day 3:   S3 security, pre-signed URLs, static hosting
  Day 4:   EBS volume types, snapshots, encryption
  Day 5:   EFS, NFS, shared storage patterns
  Day 6-7: Comparison guide + hands-on labs

Week 2:
  Practice exam questions on storage
  Build: Static website on S3
  Build: Shared EFS mount across multiple EC2
```

## Key Exam Topics

- S3 storage classes and when to use each
- S3 lifecycle policies (transition + expiration)
- EBS volume types (gp2 vs gp3 vs io1/io2)
- Multi-AZ EBS (EBS is AZ-locked)
- EFS vs EBS vs S3 decision making
- S3 security: bucket policies, IAM, pre-signed URLs
- S3 replication: CRR vs SRR
- EBS encryption and snapshots

## Common Gotchas

1. **EBS is AZ-locked** — you cannot attach an EBS volume to an EC2 in a different AZ
2. **S3 is global service** — buckets are region-specific but namespace is global
3. **EFS is Linux only** — does not support Windows (use FSx for Windows)
4. **S3 durability vs availability** — 11 9s durability does NOT mean 11 9s availability
5. **Glacier is not for backups you need immediately** — retrieval takes time
6. **EBS snapshots are incremental** — first snapshot is full, subsequent are incremental
7. **S3 versioning cannot be disabled once enabled** — only suspended
