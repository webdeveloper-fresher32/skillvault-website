# AWS Services Cheat Sheet

Quick reference for all major AWS services organized by category. Use this for architecture decisions and exam review.

---

## Compute

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **EC2** | Virtual machines (instances) in the cloud | General-purpose compute, web servers, application servers |
| **Lambda** | Serverless compute — runs code in response to events, no server management | Event-driven functions, API backends, data processing |
| **ECS** | Container orchestration service using Docker containers | Running microservices in containers without managing Kubernetes |
| **EKS** | Managed Kubernetes service | Container orchestration with Kubernetes for complex workloads |
| **Fargate** | Serverless compute engine for containers (ECS/EKS) | Running containers without managing EC2 instances |
| **Lightsail** | Simplified cloud platform with predictable pricing | Simple web apps, dev/test environments, small websites |
| **Batch** | Managed batch computing for large-scale jobs | Data processing pipelines, ML training, HPC workloads |
| **Elastic Beanstalk** | PaaS — deploy code and AWS handles the infrastructure | Rapid application deployment without infrastructure knowledge |
| **Outposts** | AWS infrastructure installed on-premises | Hybrid cloud, low-latency on-premises processing |
| **Wavelength** | AWS infrastructure at telecom 5G edge | Ultra-low-latency applications for mobile devices |
| **App Runner** | Fully managed container service — deploy directly from code or image | Quickly deploy web apps and APIs from source code |
| **EC2 Auto Scaling** | Automatically adjusts EC2 fleet size based on demand | Handling variable traffic without over-provisioning |

---

## Storage

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **S3** | Object storage — unlimited files up to 5 TB each | Static assets, backups, data lakes, media storage, static websites |
| **EBS** | Block storage volumes attached to EC2 instances | EC2 root volumes, databases, transactional workloads |
| **EFS** | Elastic NFS file system mountable by multiple EC2s simultaneously | Shared file storage for web servers, CMS, containers |
| **FSx for Windows** | Managed Windows file system (SMB/NTFS) | Windows workloads requiring shared file storage |
| **FSx for Lustre** | High-performance parallel file system | ML training, HPC, big data processing |
| **S3 Glacier** | Low-cost archival storage with retrieval delays | Long-term archive, compliance records, disaster recovery |
| **S3 Glacier Deep Archive** | Cheapest storage tier, 12-hour retrieval | Multi-year data archival, regulatory retention |
| **Storage Gateway** | Hybrid cloud storage connecting on-premises to S3 | Extending on-premises storage to cloud |
| **DataSync** | Automated data transfer between on-premises and AWS | One-time or ongoing migrations |
| **Snow Family** | Physical devices for data transfer or edge computing | Moving petabytes of data to AWS, remote/offline environments |
| **Backup** | Centralized managed backup across AWS services | Automated backups with retention policies |

### S3 Storage Classes

| Class | Availability | Use Case |
|-------|-------------|---------|
| S3 Standard | 99.99% | Frequently accessed data |
| S3 Standard-IA | 99.9% | Infrequent access, rapid retrieval |
| S3 One Zone-IA | 99.5% | Infrequent access, non-critical data |
| S3 Intelligent-Tiering | 99.9% | Unknown or changing access patterns |
| S3 Glacier Instant | 99.9% | Archive with millisecond retrieval |
| S3 Glacier Flexible | 99.99% | Archive, retrieval in minutes to hours |
| S3 Glacier Deep Archive | 99.99% | Lowest cost, 12-48 hour retrieval |

---

## Databases

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **RDS** | Managed relational databases (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) | Traditional RDBMS workloads with managed maintenance |
| **Aurora** | AWS-built MySQL/PostgreSQL-compatible DB with 5x performance | High-performance relational workloads; production applications |
| **Aurora Serverless** | Aurora that automatically scales capacity up/down | Intermittent or unpredictable database workloads |
| **DynamoDB** | Fully managed NoSQL key-value and document database | High-scale, low-latency applications; gaming, IoT, ad tech |
| **ElastiCache** | In-memory caching (Redis or Memcached) | Database query caching, session storage, real-time leaderboards |
| **DocumentDB** | MongoDB-compatible managed document database | Document workloads, migrating from MongoDB |
| **Neptune** | Managed graph database | Social networks, fraud detection, knowledge graphs |
| **Redshift** | Petabyte-scale managed data warehouse | Analytics queries over large historical datasets |
| **Keyspaces** | Managed Cassandra-compatible service | Cassandra workloads without managing clusters |
| **QLDB** | Immutable, verifiable ledger database | Supply chain, financial records, audit trails |
| **Timestream** | Purpose-built time-series database | IoT telemetry, monitoring metrics, industrial data |
| **MemoryDB for Redis** | Redis-compatible durable in-memory database | Ultra-fast primary database for microservices |
| **DMS** | Database Migration Service — migrate databases to AWS | On-premises to AWS migrations, cross-engine migrations |
| **SCT** | Schema Conversion Tool — convert DB schemas | Converting Oracle/SQL Server schemas to open-source engines |

---

## Networking

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **VPC** | Virtual Private Cloud — isolated network in AWS | Foundational network container for all AWS resources |
| **Subnets** | Segments within a VPC in specific AZs | Separating public (internet-facing) and private (internal) resources |
| **Route Tables** | Rules that determine where network traffic is directed | Routing traffic to IGW, NAT GW, VPC peers, etc. |
| **Internet Gateway** | Enables internet communication for public subnets | Giving EC2 instances internet access |
| **NAT Gateway** | Enables private subnet internet outbound access | Allowing private EC2s to download updates without being publicly accessible |
| **Security Groups** | Stateful virtual firewall at instance level | Controlling inbound/outbound traffic per instance |
| **NACLs** | Stateless firewall at subnet level | Additional layer of security, blocking specific IPs at subnet level |
| **ELB / ALB** | Application Load Balancer — HTTP/HTTPS layer 7 load balancing | Distributing web traffic across multiple EC2s/containers/Lambdas |
| **NLB** | Network Load Balancer — TCP/UDP layer 4 ultra-low latency | High-performance TCP traffic, fixed IP requirements |
| **GLB** | Gateway Load Balancer — for network appliances | Third-party firewalls, packet inspection |
| **CloudFront** | Global CDN with 450+ edge locations | Accelerating web content delivery, protecting origins |
| **Route 53** | Managed DNS service with health checks and routing policies | Domain registration, DNS, traffic management |
| **VPC Peering** | Private connection between two VPCs | Connecting VPCs without traversing the internet |
| **Transit Gateway** | Hub that connects hundreds of VPCs and on-premises | Large-scale network connectivity, replaces complex peering |
| **PrivateLink** | Private connectivity to AWS services or your own services | Accessing services without internet exposure |
| **Direct Connect** | Dedicated physical network connection from on-premises to AWS | High-bandwidth, consistent latency hybrid connectivity |
| **VPN** | IPSec encrypted tunnel over internet to VPC | Encrypted on-premises to AWS connectivity |
| **Global Accelerator** | Routes traffic over AWS backbone to nearest endpoint | Improving global application performance and availability |
| **API Gateway** | Managed API service for REST, HTTP, and WebSocket APIs | Creating, managing, and securing APIs |

---

## Security

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **IAM** | Identity and Access Management — users, groups, roles, policies | Controlling who can do what in AWS |
| **KMS** | Key Management Service — create and manage encryption keys | Encrypting data at rest across AWS services |
| **CloudHSM** | Dedicated Hardware Security Module for key storage | Compliance requirements needing dedicated HSM |
| **Secrets Manager** | Securely store and rotate secrets (passwords, API keys) | Database credentials, API keys with automatic rotation |
| **SSM Parameter Store** | Configuration and secrets storage | App configuration, non-rotating secrets (free tier available) |
| **Certificate Manager (ACM)** | Free SSL/TLS certificates for AWS services | HTTPS for CloudFront, ALB, API Gateway |
| **WAF** | Web Application Firewall — blocks malicious HTTP traffic | Protecting against SQL injection, XSS, OWASP Top 10 |
| **Shield** | DDoS protection — Standard (free) and Advanced ($3k/mo) | Protecting against DDoS attacks |
| **GuardDuty** | Intelligent threat detection using ML | Detecting compromised EC2s, unusual API calls, cryptocurrency mining |
| **Inspector** | Automated vulnerability assessments for EC2 and containers | Finding CVEs and network exposure in running workloads |
| **Macie** | ML-powered sensitive data discovery in S3 | Finding PII, credentials, financial data in S3 buckets |
| **Security Hub** | Centralized security findings from all AWS security tools | Single pane of glass for security posture management |
| **Detective** | Investigates security incidents using graph analysis | Root cause analysis of security findings |
| **Cognito** | User authentication and authorization for apps | Adding sign-up/sign-in to mobile and web applications |
| **STS** | Security Token Service — temporary credentials | Cross-account access, federation, EC2 role credentials |
| **Firewall Manager** | Centrally manage WAF, Shield, and Security Groups | Consistent security policies across multiple accounts |
| **RAM** | Resource Access Manager — share resources across accounts | Sharing Transit Gateways, subnets, Route 53 resolver rules |

---

## Monitoring and Observability

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **CloudWatch** | Metrics, logs, alarms, dashboards for AWS resources | Monitoring EC2 CPU, setting billing alarms, querying application logs |
| **CloudWatch Logs** | Centralized log storage and analysis | Aggregating logs from EC2, Lambda, containers |
| **CloudWatch Alarms** | Alerts based on metric thresholds | Notifying on high CPU, error rate spikes, billing thresholds |
| **CloudWatch Events / EventBridge** | Event-driven automation based on AWS service events | Triggering Lambda on EC2 state change, scheduled jobs |
| **CloudTrail** | Audit log of all AWS API calls | Security auditing, compliance, who did what and when |
| **X-Ray** | Distributed tracing for microservices and Lambda | Finding performance bottlenecks in distributed applications |
| **Health Dashboard** | AWS service status and personal health events | Tracking planned maintenance and service disruptions |
| **Trusted Advisor** | Real-time checks for cost, security, performance, fault tolerance | Account-level best practice recommendations |
| **Compute Optimizer** | ML recommendations for right-sizing EC2/Lambda | Reducing over-provisioned resources |
| **Cost Explorer** | Visualize and analyze AWS spending | Understanding and forecasting cloud costs |
| **AWS Budgets** | Set spending and usage alerts | Getting notified when spending approaches your limit |
| **Config** | Track configuration changes to AWS resources over time | Compliance auditing, change management, drift detection |

---

## Serverless and Messaging

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **Lambda** | Run code without managing servers | Event processing, API backends, scheduled tasks |
| **API Gateway** | Create HTTP, REST, and WebSocket APIs | Exposing Lambda functions as APIs |
| **SQS** | Managed message queue for decoupling services | Async job processing, decoupling microservices |
| **SNS** | Pub/sub messaging to multiple subscribers | Fan-out notifications, sending emails/SMS, triggering multiple services |
| **EventBridge** | Serverless event bus for AWS and SaaS events | Event-driven architectures, routing events between services |
| **Step Functions** | Visual workflows for coordinating multiple services | Multi-step workflows, saga pattern, long-running processes |
| **AppSync** | Managed GraphQL service | Real-time data sync, GraphQL APIs for mobile/web |
| **SES** | Simple Email Service — send and receive email | Transactional emails, marketing emails, email automation |
| **Pinpoint** | Customer engagement — email, SMS, push notifications | Marketing campaigns, user engagement analytics |
| **Kinesis Data Streams** | Real-time data streaming for millions of events/sec | Log aggregation, clickstream data, real-time analytics |
| **Kinesis Firehose** | Load streaming data to S3, Redshift, Elasticsearch | Building data pipelines without managing consumers |
| **Kinesis Analytics** | Real-time SQL or Flink queries on streaming data | Real-time anomaly detection, metrics aggregation |
| **MSK** | Managed Apache Kafka | Kafka workloads without managing cluster operations |

---

## Containers

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **ECR** | Elastic Container Registry — private Docker image registry | Storing and versioning Docker images |
| **ECS** | Elastic Container Service — managed container orchestration | Running Docker containers without Kubernetes complexity |
| **EKS** | Elastic Kubernetes Service | Running Kubernetes workloads on AWS |
| **Fargate** | Serverless compute for containers | Running containers without managing EC2 nodes |
| **App Mesh** | Service mesh for microservices | Traffic management, observability between microservices |
| **Cloud Map** | Service discovery for microservices | Registering and discovering microservice endpoints |

---

## DevOps and Infrastructure as Code

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **CloudFormation** | Infrastructure as Code using JSON/YAML templates | Provisioning and managing AWS resources declaratively |
| **CDK** | Cloud Development Kit — define infrastructure in code (TypeScript, Python, etc.) | Programmatic IaC with reusable constructs |
| **Terraform** | Open-source IaC tool (not AWS-native) | Multi-cloud IaC, widely used in industry |
| **CodeCommit** | Managed private Git repositories | AWS-native source control |
| **CodeBuild** | Managed build service — compiles, tests, and packages | CI: building Docker images, running tests |
| **CodeDeploy** | Automated deployment to EC2, Lambda, ECS | CD: deploying code with rollback support |
| **CodePipeline** | Continuous delivery pipeline orchestration | Full CI/CD pipeline tying CodeCommit/Build/Deploy together |
| **CodeArtifact** | Managed artifact repository (npm, Maven, PyPI) | Storing and sharing packages privately |
| **Systems Manager** | Suite of tools for managing EC2 fleets | Patch management, run commands, parameter store, session access |
| **OpsWorks** | Managed Chef and Puppet | Configuration management at scale (legacy, less common now) |
| **Elastic Beanstalk** | PaaS for web applications | Simple deployments without managing infra |
| **Service Catalog** | Curated catalog of approved AWS architectures | Enterprise governance of approved infrastructure patterns |

---

## Analytics

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **Athena** | Serverless SQL queries on data in S3 | Ad-hoc analysis of S3 data without loading into a database |
| **Redshift** | Managed petabyte-scale data warehouse | Business intelligence, complex analytical queries |
| **Glue** | Managed ETL service with a data catalog | Transforming data for analytics pipelines |
| **Lake Formation** | Build, secure, and manage data lakes on S3 | Enterprise data lake governance |
| **EMR** | Managed Hadoop/Spark cluster | Big data processing, ML at scale |
| **QuickSight** | Business intelligence and visualization tool | Dashboards and reports for business users |
| **OpenSearch** | Managed Elasticsearch for search and analytics | Log analytics, full-text search, APM |
| **Data Pipeline** | Orchestrate data movement between AWS services | ETL pipelines (legacy; Glue preferred now) |

---

## Machine Learning and AI

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **SageMaker** | Complete ML platform: build, train, deploy models | End-to-end ML workflows |
| **Bedrock** | Managed foundation models (Claude, Titan, Llama) | Generative AI applications without managing models |
| **Rekognition** | Image and video analysis | Face detection, content moderation, object identification |
| **Comprehend** | NLP — sentiment analysis, entity extraction | Analyzing text in customer feedback, documents |
| **Transcribe** | Speech-to-text | Converting audio recordings to text |
| **Translate** | Neural machine translation | Real-time translation between 75+ languages |
| **Polly** | Text-to-speech | Converting text to spoken audio |
| **Lex** | Conversational AI (same technology as Alexa) | Chatbots, voice assistants |
| **Forecast** | Time-series forecasting with ML | Demand forecasting, inventory planning |
| **Personalize** | Real-time personalization and recommendations | E-commerce recommendations, content personalization |
| **Textract** | Extract text and structured data from documents | Processing PDFs, forms, invoices |
| **Kendra** | Intelligent enterprise search | Internal knowledge base search |

---

## Migration

| Service | Description | Primary Use Case |
|---------|-------------|-----------------|
| **Application Migration Service (MGN)** | Lift-and-shift server migration | Migrating physical/virtual servers to EC2 |
| **DMS** | Database Migration Service | Migrating databases to RDS, Aurora, etc. |
| **SCT** | Schema Conversion Tool | Converting schemas between different DB engines |
| **DataSync** | Automated data transfer | Migrating file data from on-premises to AWS |
| **Snow Family** | Physical devices for data transfer | Moving large datasets (TB to PB) to AWS |
| **Transfer Family** | Managed SFTP, FTPS, FTP to S3/EFS | Migrating SFTP workflows to AWS |
| **Migration Hub** | Central tracking of migrations | Monitoring progress of all migration activities |
| **Application Discovery Service** | Discover on-premises applications for migration | Planning: mapping dependencies before migration |
