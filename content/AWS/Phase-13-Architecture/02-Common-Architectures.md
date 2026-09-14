# Common AWS Architecture Patterns — Complete Guide

## Table of Contents
1. [3-Tier Web Architecture](#1-3-tier-web-architecture)
2. [Serverless API](#2-serverless-api)
3. [Microservices on ECS](#3-microservices-on-ecs)
4. [Event-Driven Architecture](#4-event-driven-architecture)
5. [Real-time Data Pipeline](#5-real-time-data-pipeline)
6. [Multi-Region Active-Active](#6-multi-region-active-active)
7. [CI/CD Pipeline Architecture](#7-cicd-pipeline-architecture)
8. [Interview Q&A](#interview-qa)

---

## 1. 3-Tier Web Architecture

### Overview
The classic, battle-tested pattern for web applications. Separates concerns into presentation (CDN/edge), application (compute), and data (storage) tiers. Still the most common pattern for migrating on-premises applications to AWS.

### Architecture Diagram

```
                              INTERNET
                                 |
                          [Route 53]
                    (DNS, Health Checks, Failover)
                                 |
                         [CloudFront CDN]
                    (Cache, WAF, SSL termination,
                     DDoS protection via Shield)
                                 |
                    ┌────────────┴────────────┐
                    │     PUBLIC SUBNETS      │
                    │  (AZ-a)        (AZ-b)  │
                    │    [ALB]               │
                    │  (HTTPS, target groups) │
                    └────────────┬────────────┘
                                 |
                    ┌────────────┴────────────┐
                    │    PRIVATE SUBNETS      │
                    │  (AZ-a)        (AZ-b)  │
                    │  [EC2 ASG]   [EC2 ASG] │
                    │  App Servers  App Servers│
                    │  (Node.js/   (Node.js/  │
                    │   Python/    Python/    │
                    │   Java)      Java)      │
                    └────────────┬────────────┘
                                 |
                    ┌────────────┴────────────┐
                    │   DATA SUBNETS          │
                    │  (AZ-a)        (AZ-b)  │
                    │ [RDS Primary] [RDS      │
                    │               Standby]  │
                    │    Multi-AZ             │
                    │ [ElastiCache Redis       │
                    │  Cluster Mode]          │
                    └─────────────────────────┘

  Out-of-band management:
  [Bastion / Session Manager] -> [Private EC2 fleet]
  [NAT Gateway in public subnet] -> (EC2 outbound internet)
```

### Service List

| Layer | Service | Purpose |
|-------|---------|---------|
| DNS | Route 53 | Domain resolution, health checks, failover routing |
| CDN | CloudFront | Cache static content, SSL termination, WAF attachment point |
| Security | WAF | Block malicious requests (SQLi, XSS, rate limiting) |
| DDoS | Shield Standard | Automatic Layer 3/4 protection (free) |
| Load Balancing | ALB (Application Load Balancer) | Layer 7 routing, health checks, SSL offload |
| Compute | EC2 Auto Scaling Group | Application servers, scales with demand |
| Database | RDS Multi-AZ | Primary/standby, automatic failover, automated backups |
| Cache | ElastiCache Redis | Session storage, database query cache |
| NAT | NAT Gateway | Private EC2 instances' outbound internet access |
| Management | Systems Manager Session Manager | No-SSH access to private instances |
| Storage | S3 | Static files, user uploads, ALB access logs |
| Secrets | Secrets Manager | Database credentials, API keys |
| Monitoring | CloudWatch | Metrics, alarms, dashboards |

### Security Notes

**Network Isolation:**
- EC2 instances in PRIVATE subnets — no direct internet access
- ALB in PUBLIC subnets — only publicly reachable entry point
- RDS in DATA (isolated) subnets — accessible only from app tier security group
- Security Group chain: ALB-SG (80/443 from 0.0.0.0/0) → App-SG (8080 from ALB-SG only) → DB-SG (5432/3306 from App-SG only)

**Encryption:**
- HTTPS enforced — ALB redirects HTTP to HTTPS
- RDS encrypted at rest (AES-256 via KMS)
- EBS volumes encrypted
- ElastiCache in-transit and at-rest encryption

**Identity:**
- EC2 instances use IAM roles (no access keys)
- Database credentials in Secrets Manager with auto-rotation
- IMDSv2 enforced on EC2

**Logging:**
- ALB access logs to S3
- VPC Flow Logs
- CloudTrail for API calls
- Application logs to CloudWatch Logs

### Auto Scaling Configuration
```
Target Tracking Policy:
  Metric: ALBRequestCountPerTarget
  Target value: 1000 requests per instance
  Scale-in cooldown: 300 seconds
  Scale-out cooldown: 60 seconds

Scheduled scaling:
  Peak hours (8am-6pm AEST): min 4, desired 6, max 20
  Off-peak: min 2, desired 2, max 20

Health checks:
  ALB health check: GET /health → 200 OK
  EC2 health check (ASG): system status
  Grace period: 120 seconds (allow app startup)
```

---

## 2. Serverless API

### Overview
For modern applications with variable or spiky traffic where you want minimal operational overhead. Pay per request — cost goes to zero when not in use. Scales automatically from 0 to millions of requests.

### Architecture Diagram

```
                              INTERNET
                                 |
                          [Route 53]
                    (Custom domain: api.myapp.com)
                                 |
                         [CloudFront]
                    (Cache GET responses,
                     WAF attachment, TLS termination)
                                 |
                         [API Gateway]
                    (REST or HTTP API, request validation,
                     throttling, authorization, stages)
                                 |
                    ┌────────────┼────────────┐
                    |            |            |
              [Lambda]     [Lambda]     [Lambda]
              GET /users  POST /orders GET /products
                    |            |            |
             [DynamoDB]  [DynamoDB]         [S3]
             Users table  Orders table   Product images
                                 |
                        [DynamoDB Streams]
                                 |
                        [Lambda processor]
                                 |
                             [SNS]
                     (Email/SMS notifications)

  Auth layer:
  [Cognito User Pool] <-> [API Gateway Authorizer]
  or [Lambda Authorizer] for custom auth logic
```

### Service List

| Service | Role |
|---------|------|
| Route 53 | Custom domain resolution |
| CloudFront | Cache, WAF, TLS termination |
| API Gateway (HTTP API) | Request routing, throttling, CORS, auth |
| Lambda | Business logic execution |
| DynamoDB | NoSQL database, on-demand capacity |
| S3 | Binary/large object storage |
| Cognito | User authentication and JWT issuance |
| SES/SNS | Email/SMS notifications |
| CloudWatch | Lambda metrics, logs, X-Ray tracing |
| X-Ray | Distributed tracing across Lambda chains |
| EventBridge | Event routing for async workflows |
| SQS | Decoupled Lambda invocations, buffering |

### API Gateway Types Comparison

| Feature | REST API | HTTP API | WebSocket API |
|---------|----------|----------|---------------|
| Cost | Higher | 70% cheaper | Per message |
| Caching | Yes | No | No |
| Usage plans | Yes | No | No |
| Lambda proxy | Yes | Yes | Yes |
| JWT auth | Via Cognito | Native | Via Lambda |
| Request validation | Yes | Limited | No |
| Use case | Full-featured APIs | Low-latency, microservices | Real-time (chat, gaming) |

### Security Notes

**Authentication/Authorization:**
- Cognito User Pool for end-user auth → JWT tokens
- API Gateway JWT Authorizer validates tokens on every request
- Lambda Authorizer for complex custom auth (SAML, LDAP, third-party OAuth)
- Resource-based policies on API Gateway to restrict by IP or VPC

**Lambda Security:**
- Lambda execution role with least-privilege IAM permissions
- VPC Lambda (in private subnet) to access RDS or internal services
- Lambda environment variables encrypted with KMS
- No access to DynamoDB without explicit IAM policy

**DynamoDB Security:**
- Encryption at rest with KMS
- VPC Endpoint (Gateway Endpoint) — DynamoDB traffic never leaves AWS network
- Fine-grained access control: `dynamodb:LeadingKeys` condition to restrict users to their own data

**API Protection:**
- WAF on CloudFront: rate limiting, SQLi/XSS rules, geo-blocking
- API Gateway throttling: 10,000 req/sec default, configurable
- Request/response validation in API Gateway
- CloudFront Origin Access Control (OAC) — prevents direct API Gateway access

### Cost Optimization
- HTTP API instead of REST API: 70% cheaper
- Provision Concurrency only for critical, latency-sensitive paths
- DynamoDB On-Demand for spiky traffic; switch to Provisioned + Auto Scaling at sustained load
- CloudFront caching GET responses: reduces Lambda invocations
- S3 for large assets: cheaper storage + CloudFront delivery

---

## 3. Microservices on ECS

### Overview
For applications decomposed into independently deployable services. Each service owns its domain, database, and deployment pipeline. Services communicate via HTTP/gRPC synchronously or SQS/SNS asynchronously.

### Architecture Diagram

```
                              INTERNET
                                 |
                        [ALB — Public]
                   Path-based routing rules:
                   /api/users*  → Users Target Group
                   /api/orders* → Orders Target Group
                   /api/products* → Products Target Group
                                 |
          ┌──────────────────────┼──────────────────────┐
          |                      |                      |
   [ECS Fargate]         [ECS Fargate]         [ECS Fargate]
   Users Service          Orders Service       Products Service
   (container:3000)      (container:3001)     (container:3002)
   IAM Role: users-role   IAM Role: orders    IAM Role: products
          |                      |                      |
   [RDS PostgreSQL]    [RDS PostgreSQL]     [DynamoDB]
   users DB (private)   orders DB (private)  products table
                               |
                   Async communication:
                   [SQS Queue: order-events]
                              /|\
                   Subscribed by:
                   [Lambda: send-email]
                   [Lambda: update-inventory]
                   [ECS: analytics-service]

   Service Discovery:
   [AWS Cloud Map] or
   [App Mesh] (service mesh, mTLS, retries, circuit breaker)

   Container Registry:
   [ECR] — private registry for all service images

   Monitoring:
   [Container Insights] — CPU/memory/network per container
   [X-Ray] — distributed tracing across services
   [CloudWatch Logs] — centralized log aggregation
```

### Service List

| Category | Service | Purpose |
|----------|---------|---------|
| Load Balancing | ALB | Path-based routing to ECS services |
| Compute | ECS Fargate | Serverless container execution |
| Registry | ECR | Private Docker image repository |
| Databases | RDS per service | Service-owned PostgreSQL/MySQL |
| NoSQL | DynamoDB | Product catalog, sessions |
| Messaging | SQS | Async service communication, decoupling |
| Pub/Sub | SNS | Fan-out notifications |
| Service Mesh | AWS App Mesh | mTLS, retries, circuit breaker, observability |
| Discovery | Cloud Map | DNS-based service discovery |
| Tracing | X-Ray | End-to-end request tracing |
| Secrets | Secrets Manager | DB credentials injected at container start |
| Config | Parameter Store | Non-sensitive config (feature flags, URLs) |

### ECS Fargate Task Definition (Example)
```json
{
  "family": "users-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789:role/users-service-role",
  "containerDefinitions": [
    {
      "name": "users-service",
      "image": "123456789.dkr.ecr.ap-southeast-2.amazonaws.com/users-service:latest",
      "portMappings": [{"containerPort": 3000}],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:123456789:secret:users-db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/users-service",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Security Notes

**Network Isolation:**
- Each ECS service in its own Security Group
- Services only accept traffic from ALB Security Group or peer service Security Groups
- Databases only accept traffic from their owning service's Security Group
- No cross-service direct database access (service boundary enforced at network level)

**Identity:**
- Each ECS service has a dedicated Task Role with minimum permissions
- executionRole: permission to pull from ECR, write logs, read secrets
- taskRole: permissions for the application (e.g., DynamoDB access for products service)

**Inter-service Authentication:**
- App Mesh with mTLS: mutual TLS ensures only authorized services communicate
- Alternatively: JWT tokens passed in service-to-service calls, validated by Lambda Authorizer

**Secrets:**
- Secrets Manager injects DB credentials at task startup via ECS secrets injection
- Credentials are never in environment variables or task definition in plaintext

---

## 4. Event-Driven Architecture

### Overview
Decoupled, asynchronous processing triggered by events. Services don't call each other directly — they produce/consume events. Excellent for workflows that cross service boundaries, long-running processes, and audit-friendly pipelines.

### Architecture Diagram

```
  Trigger:
  User uploads file to S3 bucket
         |
  [S3 Event Notification]
         |
  [EventBridge]  <── Can also receive from: API GW, SaaS, custom sources
  (Event Bus, rules, filtering)
         |
  ┌──────┴──────────────┐
  |                     |
  [Lambda: validate]  [Step Functions]
  (immediate actions)  (orchestrate workflow)
         |                     |
  [DynamoDB: update status]    |
                     ┌─────────┴──────────┐
                     |                    |
              [Lambda: resize]    [Lambda: extract-metadata]
              (image processing)  (EXIF data extraction)
                     |                    |
              [S3: thumbnails]    [DynamoDB: metadata table]
                     |
              [Lambda: generate-CDN-url]
                     |
              [DynamoDB: update final status]
                     |
              [SNS Topic]
              /          \
   [SES: email user]   [SQS: analytics queue]
                              |
                      [Lambda: analytics processor]
                              |
                      [Kinesis Firehose]
                              |
                         [S3: data lake]
```

### Service List

| Service | Role |
|---------|------|
| S3 | Event source (file uploads) |
| EventBridge | Central event bus, rule-based routing, filtering |
| Step Functions | Workflow orchestration, error handling, retries |
| Lambda | Individual processing steps |
| DynamoDB | State tracking, metadata storage |
| SNS | Fan-out notifications to multiple targets |
| SES | Email delivery |
| SQS | Buffering between Lambda and downstream |
| Kinesis Firehose | Stream to S3 data lake |

### Step Functions Workflow (Express vs Standard)

| Feature | Standard Workflow | Express Workflow |
|---------|------------------|-----------------|
| Duration | Up to 1 year | Up to 5 minutes |
| Execution model | Exactly-once | At-least-once |
| Price | Per state transition | Per execution duration |
| Use case | Business processes, audit | High-volume event processing |
| History | Full execution history | CloudWatch Logs |

### EventBridge Rules Example
```json
// Rule: route S3 events to Step Functions
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": {
      "name": ["user-uploads-bucket"]
    },
    "object": {
      "key": [{"prefix": "uploads/"}]
    }
  }
}
```

### Security Notes
- EventBridge resource-based policies: only specific sources can publish to the bus
- Lambda execution roles: each Lambda has minimum permissions for its task
- Step Functions role: can only invoke specific Lambda functions and write to specific DynamoDB tables
- SQS visibility timeout > Lambda processing time (prevents duplicate processing)
- S3 bucket policy: only allows PutObject from authenticated users (Cognito Identity Pool)
- All data at rest encrypted (S3 SSE-KMS, DynamoDB KMS)

---

## 5. Real-time Data Pipeline

### Overview
For ingesting, processing, and analyzing streaming data in near real-time. Supports both hot path (immediate processing) and cold path (batch analytics).

### Architecture Diagram

```
  Data Sources:
  [IoT sensors]  [Web clickstream]  [App events]
        \              |              /
         \             |             /
          [Kinesis Data Streams]
          (Shards: 1MB/s in, 2MB/s out per shard)
                       |
              ┌────────┴────────┐
              |                 |
        [Lambda]          [Kinesis Data
        (real-time         Firehose]
         processing,       (buffer + batch
         enrichment)        delivery)
              |                 |
        [DynamoDB]        ┌─────┴─────┐
        (hot storage,     |           |
         live dashboards) [S3 Raw]  [Redshift]
                          (data lake) (warehouse)
                               |
                          [AWS Glue]
                          (Crawlers: discover schema
                           ETL jobs: transform to Parquet)
                               |
                          [S3 Curated]
                          (Parquet, partitioned by
                           year/month/day)
                               |
                          [Athena]
                          (SQL queries on S3,
                           pay per scan)
                               |
                          [QuickSight]
                          (BI dashboards,
                           SPICE cache,
                           scheduled reports)

  Real-time analytics:
  [Kinesis Data Analytics]
  (Apache Flink, SQL on streams,
   windowed aggregations)
        |
   [Lambda / ElasticSearch / DynamoDB]
```

### Service List

| Service | Role |
|---------|------|
| Kinesis Data Streams | Real-time data ingestion (ordered, replayable) |
| Kinesis Firehose | Managed delivery to S3, Redshift, OpenSearch |
| Lambda | Real-time processing, transformation, enrichment |
| Kinesis Data Analytics | Flink-based streaming SQL/aggregations |
| DynamoDB | Low-latency hot storage for real-time queries |
| S3 | Data lake — raw and curated zones |
| Glue | Crawlers for schema discovery, ETL for transformation |
| Athena | Serverless SQL queries on S3 data |
| Redshift | Data warehouse for complex analytics |
| QuickSight | BI dashboards with SPICE in-memory engine |
| OpenSearch Service | Full-text search and log analytics |
| CloudWatch | Lambda metrics, Kinesis consumer metrics |

### Kinesis Shards Sizing
```
Shards calculation:
  Ingest rate = max(incoming_records/sec / 1000, incoming_bytes/sec / 1MB)
  Read rate (Enhanced Fan-Out) = 2MB/s per shard per consumer

Example:
  100,000 events/sec, avg 512 bytes each:
  = 100,000 events/1000 = 100 shards (records)
  = 50MB/s / 1MB = 50 shards (bytes)
  → Provision 100 shards (higher of the two)
```

### Security Notes
- Kinesis streams encrypted with KMS
- Firehose can invoke Lambda to redact PII before delivery to S3
- S3 data lake: bucket policies restrict access to specific IAM roles/services
- Athena uses IAM for access control, Column/Row-level security via Lake Formation
- QuickSight permissions: data source and dataset access control per user/group
- Glue Data Catalog secured with Lake Formation permissions (column and row level security)

---

## 6. Multi-Region Active-Active

### Overview
Highest tier of availability — users are served from the nearest region. No failover needed because both regions are always active. Near-zero RTO/RPO. Most complex and most expensive pattern.

### Architecture Diagram

```
                              INTERNET
                                 |
                          [Route 53]
                    Latency-based routing:
                    au-southeast-2 → Sydney users
                    us-east-1 → US users
                    Health checks on both regions
                                 |
              ┌──────────────────┴──────────────────┐
              │                                     │
     REGION A: ap-southeast-2              REGION B: us-east-1
              │                                     │
     [CloudFront]                         [CloudFront]
     (with WAF)                           (with WAF)
              │                                     │
     [ALB / API Gateway]                  [ALB / API Gateway]
              │                                     │
     [ECS Fargate /                       [ECS Fargate /
      Lambda]                              Lambda]
              │                                     │
     ┌────────┴───────┐               ┌────────┴───────┐
     │                │               │                │
[DynamoDB       [Aurora            [DynamoDB       [Aurora
 Global          Global             Global          Global
 Tables]         Database]          Tables] ←→      Database]
     │                │               │                │
     └────────┬───────┘               └────────┬───────┘
              │                                │
              └──────── Bi-directional ────────┘
                         replication

  S3 Cross-Region Replication (CRR):
  [S3 bucket A] ──────────────────→ [S3 bucket B]
  (source of truth)                 (replica)

  Shared services (global):
  [Route 53] [CloudFront] [IAM] [ACM] [Global Accelerator]
```

### Service List

| Service | Multi-Region Role |
|---------|------------------|
| Route 53 | Latency-based or geolocation routing, health checks |
| CloudFront | Global CDN — single distribution serves both regions |
| Global Accelerator | Anycast IP routing, faster for non-cacheable traffic |
| DynamoDB Global Tables | Multi-master replication, last-writer-wins |
| Aurora Global Database | Primary + up to 5 read-only regions, <1s replication lag |
| S3 CRR | Cross-region replication for objects |
| ACM | Certificate in each region (regional service) |
| ECS / Lambda | Deploy identical stacks in each region |
| Secrets Manager | Replicate secrets across regions |

### DynamoDB Global Tables Conflict Resolution
```
DynamoDB Global Tables use "last writer wins" based on timestamp.
For financial data or counters where conflicts matter:
  - Design for idempotency (same request produces same result)
  - Use conditional writes (optimistic locking)
  - Avoid writing same item from multiple regions simultaneously
  - Route user writes to a preferred "home" region, reads globally
```

### Aurora Global Database
```
Architecture:
  Primary Region (ap-southeast-2):
    - 1 writer instance
    - Up to 15 Aurora Replicas (readers)
    - 6 copies of data across 3 AZs

  Secondary Region (us-east-1):
    - Up to 16 read-only instances
    - Replication lag: typically < 1 second (storage-level replication)
    - Promoted to primary in < 1 minute (manual or automated failover)

Managed Failover:
  aws rds failover-global-cluster \
    --global-cluster-identifier my-global-cluster \
    --target-db-cluster-identifier arn:aws:rds:us-east-1:...
```

### Security Notes
- Separate IAM roles per region (IAM is global, but resource-scoped policies are regional)
- KMS keys are regional — need CMKs in each region and cross-region key grants for replication
- WAF rules deployed identically in both regions (via Firewall Manager)
- CloudTrail in each region, aggregated to central security account
- S3 replication: destination bucket has same or stricter encryption

### Route 53 Health Check + Failover Configuration
```
Health Check:
  Target: ALB in ap-southeast-2
  Protocol: HTTPS
  Path: /health
  Interval: 10 seconds
  Failure threshold: 2

Latency Routing Policy:
  Record: api.myapp.com
  Region A: ap-southeast-2, weight: primary
  Region B: us-east-1, weight: primary
  Both active — latency routing selects nearest

  If ap-southeast-2 health check fails:
  → Route 53 automatically routes all traffic to us-east-1
```

---

## 7. CI/CD Pipeline Architecture

### Overview
Full pipeline from code commit to production deployment with zero-downtime blue/green strategy. Combines GitHub Actions for CI (build, test, push) with CodeDeploy for safe production deployments.

### Architecture Diagram

```
  Developer:
  git push → [GitHub Repository]
                    |
            [GitHub Actions]
            (CI Workflow)
                    |
        ┌───────────┴───────────┐
        |           |           |
   [npm test]  [docker build] [security scan]
   (unit tests) (multi-stage) (Trivy/Snyk)
                    |
            [ECR Push]
            (image tagged with git SHA)
                    |
            [GitHub Actions]
            (CD Workflow — main only)
                    |
       ┌────────────┴────────────┐
       |                         |
  [Staging Deploy]          [Prod Deploy]
  (auto on merge)           (requires approval)
       |                         |
  [ECS Update                [CodeDeploy]
   Service —                 (Blue/Green
   rolling]                   deployment)
                                  |
                    ┌─────────────┴──────────────┐
                    |                             |
             [ECS Blue]                   [ECS Green]
             (current version,            (new version,
              100% traffic)                0% traffic → 100%)
                    |                             |
             [ALB Target Group 1]       [ALB Target Group 2]
                    |
             [Monitoring 10 min]
             (CloudWatch alarms,
              error rate, latency)
                    |
          If alarms: auto-rollback to Blue
          If clean: terminate Blue, Green becomes primary

  Supporting infrastructure:
  [ECR] ← images stored here (lifecycle: keep last 10)
  [Parameter Store] ← app config (non-secret)
  [Secrets Manager] ← credentials
  [CloudWatch Dashboards] ← deployment observability
```

### Blue/Green Deployment Details

**How it works:**
1. Deploy new version to Green ECS task set (not receiving traffic)
2. Run validation tests against Green task set (using test traffic listener on port 8080)
3. Shift 10% traffic to Green (optional canary)
4. Monitor for 10 minutes — CloudWatch alarms watch error rate and P99 latency
5. If alarms trigger: automatic rollback to Blue (< 1 minute)
6. If clean: shift 100% traffic to Green
7. Wait 5 minutes
8. Terminate Blue task set

**Configuration in AppSpec:**
```yaml
# appspec.yml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo:
          ContainerName: "my-app"
          ContainerPort: 3000
Hooks:
  - BeforeAllowTraffic: "arn:aws:lambda:...:function:pre-traffic-hook"
  - AfterAllowTraffic: "arn:aws:lambda:...:function:post-traffic-hook"
```

### Service List

| Stage | Service | Purpose |
|-------|---------|---------|
| Source | GitHub | Code repository |
| CI | GitHub Actions | Build, test, scan, push |
| Registry | ECR | Docker image storage |
| Deployment | CodeDeploy (ECS) | Blue/green deployment orchestration |
| Compute | ECS Fargate | Container execution |
| Load Balancing | ALB | Traffic shifting between Blue/Green |
| Monitoring | CloudWatch Alarms | Deployment health gates |
| Notifications | SNS | Deployment success/failure alerts |
| Approval | GitHub Environments | Required reviewers for production |

### Security Notes
- OIDC authentication from GitHub Actions to AWS — no stored access keys
- ECR image scanning enabled (Inspector) — blocks deployment of vulnerable images
- CodeDeploy IAM role: least privilege (only ECS, ALB actions needed)
- Separate IAM roles for staging vs production
- Production environment requires 2 approvers in GitHub Environments
- All pipeline activity logged in CloudTrail

---

## Interview Q&A

**Q1: You need to design a web application for 1 million daily active users. The traffic spikes 10x during business hours. What architecture would you choose?**

A: I'd use the 3-tier architecture with modifications for scale. For the compute tier: EC2 Auto Scaling with Target Tracking policy on ALBRequestCountPerTarget. Use scheduled scaling to pre-warm instances before known peak hours. Put CloudFront in front to cache static assets and reduce origin hits by 80%+. For the database: Aurora Serverless v2 for the primary DB — it scales from 0.5 to 256 ACUs automatically. Add ElastiCache Redis for session storage and query caching. Use Read Replicas for read-heavy queries. For the data tier: DynamoDB for any simple lookup data (product catalog, user preferences). This design handles the 10x spike without manual intervention and uses consumption-based pricing where possible.

---

**Q2: What is the difference between ALB path-based routing and microservices? How does ECS implement this?**

A: ALB path-based routing uses listener rules to forward requests to different Target Groups based on URL path (e.g., `/api/users*` → Users TG, `/api/orders*` → Orders TG). In ECS, each microservice is an ECS Service registered with its own Target Group. Each ECS Service has its own task definition (container image, resources, environment), IAM role, and can scale independently. The ALB is the single entry point for clients, but internally each service is isolated. This avoids needing a separate internal load balancer per service while maintaining service independence.

---

**Q3: A file uploaded to S3 needs to trigger multiple downstream processes (resize image, extract metadata, send notification). How would you design this?**

A: Event-driven architecture with EventBridge or SNS fan-out. Two approaches: (1) S3 → SNS topic → multiple Lambda subscribers in parallel (fan-out). Each Lambda does one thing: resize, extract metadata, notify. (2) S3 → EventBridge → Step Functions for complex orchestration where you need error handling, retries, and conditional logic. Use Step Functions if steps have dependencies or you need workflow visibility. Use SNS fan-out if all steps are truly independent. For the notification: Lambda → SES for email, SNS for SMS/push.

---

**Q4: How does DynamoDB Global Tables handle write conflicts in an active-active setup?**

A: DynamoDB Global Tables uses "last writer wins" based on timestamp. If two regions write to the same item within the replication window (typically < 1 second), the write with the latest timestamp wins. This can cause data loss for concurrent writes. Solutions: (1) Design write ownership — each user writes to their "home" region. (2) Use conditional writes with version numbers (optimistic locking). (3) Design items to be idempotent (writing same value twice is safe). (4) Use event sourcing — append-only writes don't conflict.

---

**Q5: What is the difference between Kinesis Data Streams and Kinesis Firehose?**

A: Kinesis Data Streams is for real-time processing — data is available in milliseconds, consumers can be Lambda or custom applications, data is retained for 24 hours to 365 days (replayable), and you manage shards (capacity). Firehose is for delivery — it's a fully managed loader that batches data and delivers to S3, Redshift, OpenSearch, or Splunk. It buffers data (60 seconds to 15 minutes or 1MB-128MB) and handles batching, compression, and format conversion. Typical pattern: Kinesis Streams → real-time Lambda processing + Firehose subscription → S3 data lake.

---

**Q6: When would you use Step Functions over Lambda chaining directly?**

A: Use Step Functions when: (1) Workflow has multiple steps with error handling and retries needed at each step. (2) Steps have dependencies and conditional branching. (3) Long-running workflows (Lambda max 15 min; Step Functions up to 1 year). (4) You need workflow visualization and execution history for debugging. (5) Human approval steps in the workflow. Direct Lambda chaining (Lambda calling Lambda): simpler but tightly coupled, error handling is manual, no built-in retry with backoff, no visibility into execution state. Step Functions provides the orchestration layer with built-in retries, timeouts, parallel execution, and audit trail.

---

**Q7: A company requires RPO of 4 hours and RTO of 1 hour. Which DR strategy would you recommend?**

A: Pilot Light strategy. Backup and Restore wouldn't meet 1-hour RTO (takes time to provision infrastructure from scratch). Warm Standby is overkill (RPO minutes, RTO minutes) and more expensive. Pilot Light maintains critical services (replicating database) running in DR region continuously. In a disaster, auto-scaling and additional services are brought up quickly using pre-configured AMIs or containers. Route53 health check triggers DNS failover to the DR region. Database is already running and current (continuous replication). This achieves RTO of < 1 hour and RPO of minutes (matches the 4-hour requirement with buffer).

---

**Q8: How does CloudFront improve the 3-tier web architecture?**

A: CloudFront adds: (1) **Caching** — static assets (JS, CSS, images) cached at edge, reducing origin load by 80%+. Dynamic content can also be cached with appropriate Cache-Control headers. (2) **Global performance** — 400+ edge locations serve users from nearest POP, reducing latency from 200ms to 20ms for distant users. (3) **Security** — WAF attachment point for Layer 7 protection. Shield Advanced DDoS protection. TLS termination at edge (reduces SSL handshake latency). (4) **Availability** — edge caches serve users even if origin is temporarily unavailable (stale-while-revalidate). (5) **Cost** — CloudFront-to-origin data transfer is cheaper than origin-to-internet.

---

**Q9: What is the blue/green deployment strategy and what are its advantages over rolling deployment?**

A: Blue/green maintains two identical environments. Blue is current production (100% traffic). Green is the new version (0% traffic). Traffic is switched from Blue to Green either instantly or gradually. Rollback is instant — switch traffic back to Blue (still running). Advantages over rolling: (1) Zero-downtime — no instances running mixed versions simultaneously. (2) Instant rollback vs rolling rollback (which takes time to replace instances). (3) Full testing of new version with production traffic shapes before commitment. (4) No need to worry about backward compatibility between versions (no mixed-version state). Disadvantage: requires double the infrastructure temporarily.

---

**Q10: How does Route 53 health check work with multi-region active-active?**

A: Route 53 health checks periodically send requests to your endpoint (HTTP/HTTPS/TCP) from multiple AWS locations globally. If the endpoint fails the health check threshold (e.g., 2 consecutive failures), Route 53 marks the record as unhealthy and stops routing traffic to it. In active-active with latency routing: both regions have healthy records. Users are routed to nearest region by latency. If Region A fails its health check: Route 53 automatically routes all traffic to Region B, which is still healthy. Failover is automatic and fast (under 60 seconds for default settings). Health checks can also be composite — combine multiple checks for complex failover logic.

---

**Q11: For a startup with variable traffic and a limited budget, would you recommend 3-tier or serverless architecture? Why?**

A: Serverless for a startup with variable traffic. Reasons: (1) **Cost** — pay per request, cost goes to zero with no traffic. No idle EC2/RDS costs. (2) **Operational simplicity** — no instance management, patching, or capacity planning. (3) **Scaling** — automatic, no Auto Scaling Group configuration needed. (4) **Speed to market** — can build and deploy quickly. Limitations to plan for: cold start latency (mitigate with Provisioned Concurrency for critical paths), Lambda 15-min timeout (use Step Functions for longer tasks), debugging complexity (use X-Ray), DynamoDB data modeling requires thought upfront. As traffic stabilizes and grows predictably, consider hybrid: serverless for variable workloads, reserved capacity for baseline.

---

**Q12: How would you design for data consistency in microservices? Each service has its own database.**

A: This is the distributed transactions problem. Solutions: (1) **Saga pattern** — break distributed transaction into local transactions. If one fails, compensating transactions undo previous steps. Example: Order saga → Reserve inventory → Charge payment → Confirm order. If payment fails → release inventory reservation. Implement via choreography (services emit events) or orchestration (Step Functions coordinates). (2) **Two-phase commit** — rarely used in microservices (blocks resources). (3) **Eventual consistency** — accept that data is temporarily inconsistent. Design UI to handle this gracefully. (4) **Event sourcing** — append events to a log; state derived from events. Enables replay and audit trail. Best practice: design services to be idempotent (receiving same event twice is safe).

---

**Q13: What are the trade-offs of using SQS between microservices versus direct HTTP calls?**

A: **SQS (async):** Decouples producer and consumer — producer doesn't wait for consumer to be available. Consumer can scale independently based on queue depth. Built-in retry with visibility timeout. Dead-letter queue for failed messages. Cost: slight latency (message visible to consumer within milliseconds). Use when: result not needed immediately, operations can be async (send email, process file, update stats). **Direct HTTP (sync):** Immediate response — caller knows the result instantly. Simpler debugging. No queue infrastructure. Cost: tight coupling — if consumer is down or slow, caller is impacted. Use when: result is needed to continue (check if user exists before creating order). Pattern: synchronous for queries (GET), asynchronous for commands (POST/PUT that don't need immediate confirmation).

---

**Q14: How would you migrate a monolithic application to microservices on AWS?**

A: Strangler Fig pattern — incrementally replace monolith pieces. (1) Deploy monolith to ECS or EC2 as-is. Put ALB in front. (2) Identify first service to extract (least coupled, clear domain boundary). (3) Build new microservice (ECS Fargate + own database). (4) Add ALB path rule: specific paths route to new service, rest to monolith. (5) Test, validate, and monitor new service. (6) Repeat for next domain. Migration order: start with most independent services (file upload, notifications), leave core transactional services last. Database: start with strangled service reading/writing its own DB, then migrate data from monolith's DB.

---

**Q15: How do you handle session state in a horizontally-scaled application?**

A: Session state must be external to the application server since any subsequent request can hit a different EC2/ECS instance. Options: (1) **ElastiCache Redis** — best for session storage. In-memory, fast, supports TTL for session expiry, cluster mode for HA. Sticky sessions on ALB are a workaround but prevent effective load balancing. (2) **DynamoDB** — good for session data that needs to persist across ElastiCache restarts or for compliance logging. Slightly higher latency than Redis but more durable. (3) **JWT (stateless)** — encode session data in the token itself (signed, optionally encrypted). No server-side storage, but can't revoke a JWT before expiry without a blocklist. Use refresh tokens for long sessions. Best practice: JWT for authentication claims, ElastiCache for application session data.
