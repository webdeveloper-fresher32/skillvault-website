# AWS Key Numbers and Limits

Critical numbers to memorize for AWS certifications and technical interviews. Organized by service.

---

## Amazon S3

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum object size | 5 TB | Single object limit |
| Maximum single PUT size | 5 GB | Use multipart upload above 5 GB |
| Recommended multipart threshold | 100 MB | Best practice to use multipart above this |
| Maximum multipart parts | 10,000 | 5 MB min per part (except last) |
| Minimum multipart part size | 5 MB | Except for the last part |
| S3 bucket name length | 3–63 characters | Lowercase, no dots in new buckets |
| Maximum buckets per account | 100 | Soft limit; can request increase to 1,000 |
| S3 Standard durability | 99.999999999% (11 nines) | Data replicated across ≥3 AZs |
| S3 Standard availability | 99.99% | 52 minutes downtime/year |
| S3 One Zone-IA availability | 99.5% | Single AZ only |
| S3 replication time | S3 RTC: 99.99% in 15 minutes | Replication Time Control SLA |
| S3 request rate | 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD per second per prefix | Rate scales with prefixes |
| Object key length | 1,024 bytes | UTF-8 encoded |
| Metadata size limit | 2 KB | Per object |
| S3 website max file size | 5 TB | Same as max object |
| Lifecycle transition minimum age | 30 days | Before moving Standard → IA |
| S3 Glacier retrieval times | Expedited: 1-5 min, Standard: 3-5 hrs, Bulk: 5-12 hrs | Flexible retrieval |
| S3 Glacier Deep Archive retrieval | Standard: 12 hrs, Bulk: 48 hrs | |
| S3 versioning | Unlimited versions | Each version stored separately and billed |
| MFA Delete | Requires MFA for permanent delete | When versioning + MFA delete enabled |

---

## AWS Lambda

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum execution timeout | 15 minutes (900 seconds) | Default is 3 seconds |
| Maximum memory allocation | 10,240 MB (10 GB) | CPU scales proportionally with memory |
| Minimum memory | 128 MB | |
| /tmp storage | 10,240 MB (10 GB) | Temporary storage per invocation |
| Maximum deployment package (ZIP) | 50 MB compressed, 250 MB uncompressed | Increase using Lambda layers |
| Maximum Lambda layer size | 50 MB per layer (250 MB uncompressed) | Up to 5 layers per function |
| Total layers size limit | 250 MB uncompressed | Including function code |
| Environment variables | 4 KB total | All env vars combined |
| Concurrent executions (default) | 1,000 per region | Soft limit; can request increase |
| Burst concurrency | 3,000 (us-east-1), 1,000 (other regions) | Initial burst per region |
| Provisioned concurrency | Up to function concurrency limit | Eliminates cold starts |
| Cold start duration | 100ms – 1s+ | Depends on runtime and package size |
| Lambda@Edge memory | 128 MB (viewer) / 10 GB (origin) | Limited for viewer-facing functions |
| Lambda@Edge timeout | 5 sec (viewer) / 30 sec (origin) | |
| Asynchronous event queue retention | 6 hours | Events older than this are dropped |
| Dead letter queue | SQS or SNS | For failed async invocations |
| Maximum retry attempts (async) | 2 | Then goes to DLQ |
| SQS batch size for Lambda trigger | 1–10,000 messages | FIFO: max 10 |
| Function URL throttle | 1,000 req/sec per function URL | |
| Maximum response payload | 6 MB (sync), 256 KB (async) | |

---

## Amazon SQS

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum message size | 256 KB | Use S3 + SQS Extended Client for larger |
| Default visibility timeout | 30 seconds | Message invisible to other consumers |
| Maximum visibility timeout | 12 hours | Per message |
| Message retention period | Default: 4 days, Max: 14 days | |
| Minimum retention period | 60 seconds | |
| Maximum queue name length | 80 characters | FIFO queues must end in .fifo |
| In-flight messages (Standard) | 120,000 | Currently being processed |
| In-flight messages (FIFO) | 20,000 | |
| Standard queue throughput | Unlimited (nearly) | Very high TPS |
| FIFO queue throughput | 300 TPS (no batching), 3,000 TPS (batching) | Per API action |
| Batch size | 1–10 messages per batch | |
| Long polling wait time | 1–20 seconds | 0 = short polling |
| Dead letter queue max receive count | 1–1,000 | After this, moved to DLQ |
| Delay queue time | 0–900 seconds (15 min) | Delay before messages are visible |
| Message deduplication (FIFO) | 5-minute deduplication window | |
| Message group ID (FIFO) | Required | Ensures ordering within group |
| Free tier | 1 million requests/month | |

---

## Amazon DynamoDB

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum item size | 400 KB | Including attribute names and values |
| Partition key value length | 2 KB | For string partition key |
| Sort key value length | 1 KB | For string sort key |
| Maximum table name length | 255 characters | |
| Maximum local secondary indexes | 5 per table | Created at table creation only, same partition key |
| Maximum global secondary indexes | 20 per table | Soft limit; can be increased |
| Maximum attributes per item | No limit | But total item ≤ 400 KB |
| Provisioned throughput max (per partition) | 3,000 RCU or 1,000 WCU | Per partition key value |
| Maximum item collection size | 10 GB | All items with same partition key (LSI) |
| DynamoDB Streams retention | 24 hours | Trim horizon |
| DAX cluster write-through | Writes go to DynamoDB first | Cache updates after write |
| DAX item cache TTL default | 5 minutes | |
| DAX query cache TTL default | 5 minutes | |
| Consistent read | 4 KB unit | One RCU = 1 strongly consistent read of ≤ 4 KB |
| Eventually consistent read | 4 KB per 0.5 RCU | One RCU = 2 eventually consistent reads |
| Write capacity unit | 1 KB | 1 WCU = 1 write of up to 1 KB |
| Transactional reads | 2x RCU | Double the read cost |
| Transactional writes | 2x WCU | Double the write cost |
| Global table replication lag | Typically < 1 second | Between regions |
| On-demand capacity auto-scaling | 2x previous peak | Instantly accommodates 2x previous peak |
| Scan vs Query | Scan reads entire table; Query uses index | Always prefer Query |

---

## Amazon RDS

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum DB instance storage | 64 TB (Aurora), 16 TB (others) | Aurora expands automatically |
| Maximum read replicas per DB | 5 (MySQL/PostgreSQL), 15 (Aurora) | |
| Aurora global database regions | 5 secondary regions | |
| RDS Multi-AZ failover time | 1–2 minutes typically | Automatic failover |
| Aurora Multi-AZ failover time | < 30 seconds typically | Faster than standard RDS |
| RDS automated backup retention | 1–35 days | |
| RDS snapshot retention | Indefinite (manual) | Manual snapshots don't auto-expire |
| RDS database connections | Depends on instance class | db.t3.micro: ~70 connections |
| Aurora Serverless v2 capacity | 0.5–128 ACUs | 1 ACU ≈ 2 GB RAM |
| RDS Proxy connection pooling | Reduces DB connections | Useful for Lambda |
| RDS maximum automated backups | 1 backup per day | Point-in-time recovery within retention window |
| Aurora storage auto-grow | Grows in 10 GB increments up to 128 TB | |
| RDS maintenance window | 30-minute window weekly | Can customize time |
| Cross-region snapshot copy | Available for all RDS engines | Required for DR |

---

## Amazon EC2

| Limit | Value | Notes |
|-------|-------|-------|
| On-Demand vCPU limit (standard) | 32 vCPUs per region (default) | Can request increase |
| Reserved Instances per region | 20 per instance family | Default |
| Elastic IPs per region | 5 | Soft limit; can request increase |
| Security groups per ENI | 5 (can increase to 16) | |
| Rules per security group | 60 inbound + 60 outbound | Soft limit |
| ENIs per instance | Depends on instance type | t3.micro: 2 |
| EBS volumes per instance | 28 (most instance types) | |
| EBS gp3 max IOPS | 16,000 IOPS | At 1000 IOPS/GB |
| EBS io1/io2 max IOPS | 64,000 IOPS (io2 Block Express: 256,000) | Requires Nitro instances |
| EBS throughput gp3 | 1,000 MB/s | |
| EBS maximum volume size | 64 TB (io2) | |
| EC2 user data size | 16 KB | |
| Instance metadata size | Varies | Accessible at 169.254.169.254 |
| Spot Instance interruption notice | 2 minutes | Before termination |
| Reserved Instance term lengths | 1 or 3 years | |
| Reserved Instance upfront options | No Upfront, Partial Upfront, All Upfront | More upfront = larger discount |
| Standard RI discount | Up to 72% vs On-Demand | |
| Spot Instance discount | Up to 90% vs On-Demand | |
| Savings Plans discount | Up to 66% | Flexible across instance families |
| EC2 key pair limit | 5,000 per region | |
| AMI limit | 50,000 per region (owned AMIs) | Soft limit |

---

## Amazon VPC

| Limit | Value | Notes |
|-------|-------|-------|
| VPCs per region | 5 (default) | Can request increase to 100+ |
| Subnets per VPC | 200 | Soft limit |
| IPv4 CIDR blocks per VPC | 5 (primary + 4 secondary) | Min /28, Max /16 |
| Internet Gateways per VPC | 1 | One IGW per VPC |
| NAT Gateways per AZ | 5 (default) | Usually 1 per AZ is sufficient |
| Route tables per VPC | 200 | Soft limit |
| Routes per route table | 50 | Soft limit; can increase to 1,000 |
| Security groups per VPC | 2,500 | |
| Inbound/outbound rules per SG | 60 each | Total of 120 rules |
| NACLs per VPC | 200 | |
| Rules per NACL | 20 (each direction) | |
| VPC Peering connections per VPC | 125 | |
| Transit Gateway attachments | 5,000 per TGW | |
| VPC endpoints per VPC | 50 (gateway) | |
| AWS reserved IPs per subnet | 5 | First 4 + last 1 |
| Minimum subnet size | /28 | 16 IPs, 11 usable after AWS reserves |
| Maximum subnet size | /16 | 65,536 IPs |
| VPN connections per VGW | 10 | |
| Direct Connect virtual interfaces | 50 per connection | |

---

## Amazon CloudWatch

| Limit | Value | Notes |
|-------|-------|-------|
| Metrics resolution (standard) | 1 minute | Default for most services |
| Metrics resolution (high-resolution) | 1 second | Custom metrics only |
| Alarm evaluation periods | 1–1440 minutes | |
| Metrics data retention (< 1 min) | 3 hours | High-resolution metrics |
| Metrics data retention (1 min) | 15 days | |
| Metrics data retention (5 min) | 63 days | |
| Metrics data retention (1 hour) | 455 days (15 months) | |
| CloudWatch Logs ingestion | Unlimited | Pay per GB |
| Log retention period | 1 day to 10 years (never expire) | Default: Never expire |
| CloudWatch Events rule targets | 5 per rule | Can fan-out to 5 targets |
| Dashboards per account | 500 | |
| Widgets per dashboard | 500 | |
| Alarm actions per alarm | 5 | |
| Composite alarms limit | 150 per region | |
| CloudWatch agent custom metric dimensions | 10 per metric | |
| Logs Insights query results | 10,000 log events | |
| Metric math expressions | 10 per GetMetricData call | |
| Free tier metrics | 10 custom metrics | |
| Free tier logs | 5 GB ingested per month | |
| Free tier alarms | 10 alarms | |

---

## Amazon API Gateway

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum integration timeout (REST) | 29 seconds | For Lambda, HTTP integrations |
| Maximum integration timeout (HTTP API) | 30 seconds | |
| Request payload size (REST) | 10 MB | |
| Request payload size (HTTP API) | 10 MB | |
| WebSocket message size | 128 KB | |
| WebSocket frame size | 32 KB | |
| Default throttle limit | 10,000 req/sec per region | Soft limit |
| Burst limit | 5,000 requests | Token bucket burst |
| Stage variables limit | 100 | Per stage |
| Resource policy size | 8,192 characters | |
| Maximum authorizer TTL | 3,600 seconds (1 hour) | |
| Stages per REST API | 10 | Soft limit |
| Resources per REST API | 300 | Soft limit |
| APIs per region | 600 (REST), 3,000 (HTTP) | |
| API key length | 20–128 characters | |
| Usage plan rate limit | Per key per API | |
| Mapping template size | 300 KB | |
| Cache capacity | 0.5 GB – 237 GB | REST API only |
| Cache TTL | 0–3,600 seconds | 300 second default |

---

## Amazon ECS

| Limit | Value | Notes |
|-------|-------|-------|
| Clusters per account per region | 2,000 | Soft limit |
| Services per cluster | 2,000 | Soft limit |
| Tasks per service | 5,000 | Default |
| Task definitions per account | Unlimited | But 1,000,000 revisions total |
| Containers per task definition | 10 (recommended), no hard limit | |
| Fargate vCPU per task | 0.25 – 16 vCPU | |
| Fargate memory per task | 512 MB – 120 GB | |
| Fargate task storage (ephemeral) | 20 GB (default), up to 200 GB | |
| ECS Anywhere supported OS | Linux | |
| CloudWatch log retention for ECS | Configured per log group | |
| ALB targets per service | 1 target group | |
| ECS rolling update options | minimumHealthyPercent, maximumPercent | Default: 100% min, 200% max |
| ECS task CPU units | 1 vCPU = 1,024 CPU units | |
| ECS container CPU hard limit | Uses containerCpu setting | |

---

## AWS IAM

| Limit | Value | Notes |
|-------|-------|-------|
| IAM users per account | 5,000 | Soft limit |
| IAM groups per account | 300 | |
| Groups a user can belong to | 10 | Per user |
| IAM roles per account | 1,000 | Soft limit |
| Customer managed policies per account | 1,500 | |
| Managed policies attached to role/user/group | 10 | Hard limit |
| Inline policy size | 2,048 characters per entity | Role, user, or group |
| Managed policy size | 6,144 characters | |
| IAM policy JSON size | 6,144 characters (managed), 2,048 (inline) | |
| Policy versions | 5 per managed policy | |
| IAM role session duration | Default: 1 hr, Max: 12 hrs | For AssumeRole |
| Access keys per user | 2 | One active + one for rotation |
| MFA devices per user | 8 | Multiple MFA types supported |
| Temporary credentials validity | 15 min – 36 hours (STS) | Default 1 hour |
| Permission boundary support | Users and roles | Not for groups |
| Service control policy (SCP) | 5,120 characters | Per policy document |
| Tag limits per IAM resource | 50 tags | |

---

## Summary: Most Important Numbers to Memorize

| Service | Key Numbers |
|---------|-------------|
| S3 | 5 TB max object, 5 GB max single PUT, 11 nines durability, 100 buckets default |
| Lambda | 15 min timeout, 10 GB memory, 10 GB /tmp, 1,000 concurrent default |
| SQS | 256 KB message, 14 days retention, 120K in-flight (standard), 20K (FIFO) |
| DynamoDB | 400 KB max item, 5 LSI, 20 GSI, 3,000 RCU / 1,000 WCU per partition |
| RDS | 5 read replicas (MySQL), 15 (Aurora), 1-2 min failover (Multi-AZ) |
| EC2 | 5 Elastic IPs, 5 security groups per ENI, 60 rules per SG direction |
| VPC | 5 VPCs/region, 5 reserved IPs per subnet, 1 IGW per VPC, 200 subnets/VPC |
| API Gateway | 29 sec timeout, 10 MB payload, 10,000 req/sec throttle |
