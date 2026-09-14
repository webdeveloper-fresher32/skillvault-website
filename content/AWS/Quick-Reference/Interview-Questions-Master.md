# AWS Interview Questions Master Guide

60+ questions with detailed answers organized by difficulty. Use this for interview prep, certification review, and deepening your understanding.

---

## BEGINNER QUESTIONS (1–20)

### 1. What is cloud computing, and what are the key benefits?

Cloud computing is the delivery of computing services — servers, storage, databases, networking, software, and analytics — over the internet on a pay-as-you-go basis. The key benefits are: **agility** (spin up resources in minutes instead of weeks), **elasticity** (scale up and down automatically based on demand), **cost savings** (pay only for what you use, no upfront hardware investment), **global reach** (deploy to any AWS Region in minutes), **reliability** (high availability through multiple data centers), and **security** (AWS invests billions annually in physical and digital security). The shift from capital expenditure (CapEx) to operational expenditure (OpEx) is a major driver for enterprise adoption.

---

### 2. What is the AWS Shared Responsibility Model?

The Shared Responsibility Model defines the division of security responsibilities between AWS and the customer. **AWS is responsible for security "of" the cloud** — the physical infrastructure, hardware, hypervisor, managed service software, and global network. This includes data center physical security, hardware maintenance, and the software that runs services like RDS or Lambda. **The customer is responsible for security "in" the cloud** — everything they deploy and configure: EC2 OS patching, IAM user permissions, data encryption, network firewall (security groups), and application code. For managed services like RDS, the OS-level responsibility shifts to AWS; for EC2, the customer owns OS and above.

---

### 3. What is IAM and why is it important?

IAM (Identity and Access Management) is the AWS service that controls who can authenticate (sign in) and what they are authorized to do (permissions) in your AWS account. IAM lets you create **users** (individual identities for humans), **groups** (collections of users sharing permissions), **roles** (identities assumed by services, applications, or federated users), and **policies** (JSON documents defining allowed/denied actions). IAM is fundamental because it enforces the principle of **least privilege** — every entity should have only the permissions it needs and nothing more. IAM is a **global service** — users and roles are not region-specific. Always use roles for service-to-service access (never embed access keys in code).

---

### 4. What is the difference between an IAM User, Group, and Role?

- **IAM User:** A permanent identity representing a person or application. Has long-term credentials (password and/or access keys). You log in as a user. Best for individual humans or legacy apps that don't support roles.
- **IAM Group:** A container for multiple users that allows you to attach policies once and have all group members inherit those permissions. You cannot log in as a group; groups simplify permission management at scale.
- **IAM Role:** A temporary identity that can be **assumed** by AWS services (like EC2, Lambda), applications, or users from other accounts. Roles use short-term credentials issued by STS. Best practice: use roles for EC2 instances, Lambda functions, and cross-account access — never use access keys where roles are possible.

---

### 5. What is S3 and what are its main use cases?

S3 (Simple Storage Service) is AWS's object storage service that stores data as objects (files + metadata) inside buckets. Unlike a file system, S3 has no directory hierarchy — just flat key-value storage with path-like keys. Main use cases include: **static website hosting**, **data backup and restore**, **disaster recovery archives**, **data lakes** (storing raw data for analytics), **media storage and distribution** (images, videos), **log archives**, **software distribution**, and **intermediate storage** for ETL pipelines. S3 provides 11 nines (99.999999999%) of durability by replicating data across a minimum of three AZs. Objects can be up to 5 TB and S3 storage is virtually unlimited.

---

### 6. What is an EC2 instance and how do you choose the right instance type?

EC2 (Elastic Compute Cloud) provides virtual machines (called instances) in AWS. Each instance is a virtual server with dedicated vCPU, RAM, network bandwidth, and optionally local storage. Instance types are grouped into families: **T series** (burstable, general purpose — good for dev/test, web servers), **M series** (balanced CPU/memory — general production workloads), **C series** (compute-optimized, high CPU — batch processing, gaming servers), **R series** (memory-optimized — databases, in-memory caching), **G/P series** (GPU instances — ML training, graphics rendering), **I series** (storage-optimized, high IOPS — databases, NoSQL). Choose based on your workload's bottleneck: CPU-bound → C series, memory-bound → R series, I/O-bound → I series. For most applications, M or T series is the right starting point.

---

### 7. What is a VPC and why is it used?

A VPC (Virtual Private Cloud) is your own logically isolated network within AWS. It gives you full control over your network topology including IP address ranges, subnets, route tables, and gateways. Every AWS account gets a default VPC, but for production workloads you should create a custom VPC. VPCs are used to: isolate resources from the public internet, separate environments (dev/staging/prod), control traffic flow between subnets (public vs private), implement network-level security, and enable hybrid connectivity with on-premises networks via VPN or Direct Connect. Resources in a VPC can communicate privately without going over the internet. A VPC spans all AZs within a Region, but subnets are tied to a specific AZ.

---

### 8. What is the difference between a public subnet and a private subnet?

A **public subnet** has a route in its route table pointing to an Internet Gateway (0.0.0.0/0 → IGW). Resources in a public subnet with a public IP can communicate directly with the internet (inbound and outbound). Bastion hosts, load balancers, and NAT Gateways are typically placed in public subnets. A **private subnet** has no route to an Internet Gateway. Resources in private subnets cannot be reached from the internet, and cannot initiate outbound internet connections directly. They typically route outbound traffic through a NAT Gateway (in a public subnet) to access the internet for updates. Databases, application servers, and other sensitive resources should live in private subnets to reduce attack surface.

---

### 9. What is the difference between Security Groups and NACLs?

| | Security Groups | Network ACLs |
|---|---|---|
| Level | Instance level | Subnet level |
| State | Stateful (return traffic auto-allowed) | Stateless (must allow both directions) |
| Rules | Allow rules only | Allow and Deny rules |
| Evaluation | All rules evaluated together | Rules evaluated in order (lowest number wins) |
| Default | Deny all inbound, allow all outbound | Allow all inbound and outbound |
| Association | One SG can apply to many instances | One NACL per subnet |

Security Groups are the primary tool — most architectures use only Security Groups. NACLs are used as an additional layer to explicitly block specific IPs or ranges, such as blocking a known malicious IP address at the subnet level.

---

### 10. What is CloudFront and how does it work?

CloudFront is AWS's Content Delivery Network (CDN) with 450+ edge locations (Points of Presence) worldwide. When a user requests content, CloudFront routes the request to the nearest edge location. If the edge location has the content cached (cache hit), it returns it immediately without contacting the origin — reducing latency significantly. If not cached (cache miss), CloudFront fetches it from the origin (S3, ALB, EC2, external server), caches it according to the cache-control headers, and returns it to the user. CloudFront provides: reduced latency (content served from nearest edge), reduced origin load (cache hits don't hit your servers), DDoS protection (via Shield Standard, included free), free SSL/TLS certificates via ACM, and the ability to run code at the edge via Lambda@Edge and CloudFront Functions.

---

### 11. What is Route 53?

Route 53 is AWS's highly available, scalable managed DNS service (named after DNS port 53). It can register domain names, route internet traffic to the appropriate resources, and check the health of your resources. Route 53 supports multiple routing policies: **Simple** (single resource), **Weighted** (split traffic by percentage — A/B testing), **Latency** (route to region with lowest latency), **Failover** (primary/secondary — health-check based), **Geolocation** (route based on user's country/continent), **Geoproximity** (route based on geographic distance with bias), and **Multi-value** (returns multiple IPs for basic load balancing). Route 53 is the only DNS service in AWS that supports **Alias records** — which point to AWS resources like ALBs and CloudFront distributions without charging for DNS queries.

---

### 12. What is the difference between vertical and horizontal scaling?

**Vertical scaling (Scale Up):** Adding more resources to an existing instance — upgrading from t3.micro to t3.large, adding more RAM or CPU. This has an upper limit (you can't scale a single server infinitely), causes downtime during resize, and creates a single point of failure. **Horizontal scaling (Scale Out):** Adding more instances to distribute the load — going from 2 EC2 instances to 10. This has no practical upper limit, requires a load balancer to distribute traffic, provides fault tolerance (one instance failure doesn't bring down the service), and is the preferred cloud architecture pattern. AWS Auto Scaling Groups implement horizontal scaling automatically based on metrics like CPU utilization or request count. The classic advice: "Design for failure, and nothing fails."

---

### 13. What is an AMI?

An AMI (Amazon Machine Image) is a template that contains the software configuration for an EC2 instance — the operating system, application software, and configuration. When you launch an EC2 instance, you specify an AMI. AMIs can be: **AWS-managed** (Amazon Linux, Ubuntu, Windows Server — maintained and patched by AWS or the OS vendor), **Community AMIs** (shared publicly by other users), or **Your own custom AMIs** (created from a running instance with your software pre-installed). Custom AMIs are valuable because they allow you to launch pre-configured instances quickly — instead of running a setup script on every launch, the configuration is baked in. AMIs are regional but can be copied to other regions.

---

### 14. What is Elastic IP?

An Elastic IP address is a static public IPv4 address associated with your AWS account that you can allocate and assign to EC2 instances. By default, when you stop and restart an EC2 instance, its public IP address changes. An Elastic IP is persistent — it stays the same even after stop/start. EIPs are useful for: servers that need a fixed public IP (DNS records pointing to a specific IP), replacing a failed instance while keeping the same IP, and whitelist-based access where other systems have your IP listed. Important: AWS charges for Elastic IPs that are **allocated but not associated with a running instance**. You get 5 Elastic IPs per region by default. For most web applications, use a DNS name or ALB instead of EIPs.

---

### 15. What is the difference between RDS and DynamoDB?

**RDS** is a managed relational database service (MySQL, PostgreSQL, etc.) that uses structured data with tables, rows, and SQL. Best for: complex queries with JOINs, ACID transactions, reporting, e-commerce order management, and applications where data relationships are complex. Scaling requires vertical sizing or read replicas; not designed for massive scale-out. **DynamoDB** is a serverless NoSQL key-value and document database. Best for: high-scale applications needing single-digit millisecond latency (gaming, ad tech, IoT), applications with simple, predictable access patterns, and workloads that need to scale to millions of requests per second. Does not support JOINs or complex SQL queries. Data modeling in DynamoDB requires designing around your access patterns, not around the data structure. Choose RDS for complex relational data; DynamoDB for scale and simplicity.

---

### 16. What is Lambda and when should you use it?

Lambda is AWS's serverless compute service — you upload your code and AWS runs it in response to events without you provisioning or managing servers. Lambda scales automatically from 0 to thousands of concurrent executions. You pay only for the compute time consumed (measured in milliseconds). Use Lambda when: your function executes occasionally or unpredictably (pay-as-you-go is cheaper than 24/7 EC2), you want zero server management, your logic is triggered by events (S3 uploads, API calls, DynamoDB changes, SQS messages). Lambda is NOT ideal for: long-running processes (max 15 minutes), large memory requirements (max 10 GB), workloads needing consistent high throughput (cold starts add latency), or applications requiring persistent in-memory state between invocations.

---

### 17. What is auto scaling?

Auto Scaling automatically adjusts the number of EC2 instances in your application based on current demand, ensuring you have the right number of instances available at all times. It consists of three components: **Launch Template** (defines the instance configuration — AMI, instance type, security groups, user data), **Auto Scaling Group** (defines min, max, and desired capacity, and the VPC/subnets), and **Scaling Policies** (rules that trigger scaling). Types of scaling: **Target tracking** (maintain metric at target value — e.g., keep CPU at 50%), **Step scaling** (scale by different amounts based on alarm severity), **Scheduled scaling** (scale at specific times — e.g., add capacity every weekday morning), **Predictive scaling** (ML-based proactive scaling using historical patterns). Auto Scaling also performs health checks and replaces unhealthy instances automatically.

---

### 18. What are the AWS pricing models for EC2?

**On-Demand:** Pay by the second with no commitment. Highest per-hour price. Use for: unpredictable workloads, development, short-term applications. **Reserved Instances:** 1 or 3-year commitment for up to 72% discount. Three payment options: No Upfront, Partial Upfront, All Upfront (more upfront = larger discount). Best for: steady-state, predictable workloads (production databases, web servers). **Spot Instances:** Bid for unused AWS capacity — up to 90% discount. AWS can terminate with 2-minute notice. Best for: fault-tolerant batch jobs, big data processing, stateless workers, CI/CD. **Savings Plans:** Commit to a dollar amount of compute usage per hour (not specific instance types) for 1 or 3 years — up to 66% savings, more flexible than RIs. **Dedicated Hosts:** Physical server dedicated to you — needed for per-socket/core licensing (Oracle, Windows Server) or compliance. Most expensive.

---

### 19. What is S3 versioning?

S3 versioning is a bucket-level feature that keeps all versions of an object when it is overwritten or deleted. When enabled, every PUT operation creates a new version with a unique version ID instead of overwriting the previous version. When you delete an object without specifying a version ID, S3 adds a "delete marker" that hides the object but does not actually remove the data — you can restore it by deleting the delete marker. Versioning protects against: accidental deletions, accidental overwrites, and application bugs that corrupt data. Once versioning is enabled on a bucket, it can only be suspended (not disabled) — all existing versions are retained. Versioning increases storage costs because all versions are stored separately and billed. MFA Delete can be added on top of versioning to require MFA for permanent version deletion.

---

### 20. What is CloudWatch and what can you do with it?

CloudWatch is AWS's monitoring and observability service. It collects and processes raw data from AWS services and your applications into readable metrics. Core capabilities: **Metrics** — numeric data points published by AWS services (EC2 CPU, RDS connections, Lambda duration) and custom metrics from your applications. **Alarms** — triggers notifications or Auto Scaling actions when metrics cross thresholds. **Logs** — centralized log storage from EC2, Lambda, VPC Flow Logs, CloudTrail, and custom applications. **Logs Insights** — query language for analyzing log data. **Dashboards** — customizable visualizations of metrics. **Events/EventBridge** — react to changes in AWS resources with automated actions. CloudWatch is the foundation of operational visibility in AWS — you cannot operate a production system without it. Default EC2 metrics have 5-minute resolution; detailed monitoring enables 1-minute resolution.

---

## INTERMEDIATE QUESTIONS (21–45)

### 21. How would you design a highly available three-tier web application on AWS?

A highly available three-tier architecture consists of: **Presentation tier:** CloudFront distribution in front of an ALB deployed across two or more AZs. ALB distributes traffic to web/app servers. **Application tier:** EC2 instances (or ECS containers) in an Auto Scaling Group across private subnets in ≥2 AZs. Security group allows HTTP only from the ALB's security group. **Data tier:** RDS in Multi-AZ mode in private subnets, with read replicas for read scaling. DB subnet group spans ≥2 AZs. Security group allows DB port only from app tier's security group. High availability is achieved by: eliminating single points of failure (each tier spans ≥2 AZs), using health checks at each layer (ALB health checks, ASG EC2 health checks, RDS Multi-AZ automatic failover), and configuring Auto Scaling to replace unhealthy instances. Add ElastiCache for session storage so app servers are stateless.

---

### 22. What is the difference between Multi-AZ and Read Replicas in RDS?

**Multi-AZ** is for **high availability and disaster recovery**. AWS automatically provisions and maintains a synchronous standby replica in a different AZ. If the primary fails, RDS automatically fails over to the standby within 1-2 minutes. The standby is NOT used for read traffic — it is purely for failover. You pay for two instances at all times. **Read Replicas** are for **read scaling and performance**. They are asynchronous copies of your primary instance that can serve read traffic. You can have up to 5 read replicas (MySQL/PostgreSQL) or 15 (Aurora). Read replicas can be promoted to standalone instances (useful for DR or migrations). They cannot be used for failover automatically. You can combine both: a Multi-AZ primary for HA plus Read Replicas for scaling read workloads. Aurora handles this differently — a single Aurora cluster can have up to 15 read replicas sharing the same storage layer.

---

### 23. What is the difference between SQS and SNS?

**SQS (Simple Queue Service)** is a message queue — messages are stored until a consumer pulls (polls) them. One message is typically processed by **one consumer**. SQS is used for decoupling microservices and handling asynchronous job processing. You choose SQS when you need: guaranteed delivery, message persistence, ordered processing (FIFO), rate limiting (consumer processes at its own pace). **SNS (Simple Notification Service)** is a pub/sub service — messages are pushed to **all subscribers** simultaneously. One message can be delivered to many endpoints (Lambda, SQS, email, HTTP, SMS). SNS is used when you need to broadcast a message to multiple consumers. The classic pattern that combines both: **SNS → multiple SQS queues** (fan-out). An event is published to SNS which fans out to multiple SQS queues, each consumed by different microservices. This gives both broadcast (SNS) and reliable delivery (SQS) in one pattern.

---

### 24. What is a NAT Gateway and when do you need it?

A NAT (Network Address Translation) Gateway allows EC2 instances in **private subnets** to initiate outbound connections to the internet while preventing inbound connections from the internet. Without a NAT Gateway, private instances cannot reach the internet to download software updates, pull container images, or call external APIs. NAT Gateway is placed in a **public subnet** with an Elastic IP, and private subnet route tables have a 0.0.0.0/0 route pointing to the NAT Gateway. Important distinctions: NAT Gateway is for **outbound only** from private subnets. It cannot be used to make private instances reachable from the internet (that's what a load balancer or bastion is for). NAT Gateway is managed by AWS, is highly available within an AZ, and costs ~$0.045/hour plus data processing fees. For cost optimization, deploy one NAT Gateway per AZ (not one per VPC) to avoid cross-AZ data transfer charges.

---

### 25. What is VPC Peering?

VPC Peering is a networking connection between two VPCs that allows instances in either VPC to communicate using private IP addresses as if they were in the same network. Peering can be within the same account, across different accounts, or across different AWS Regions (inter-Region peering). Key limitations: VPC Peering is **non-transitive** — if VPC A is peered with VPC B, and VPC B is peered with VPC C, VPC A cannot communicate with VPC C through VPC B. You must create direct peering between every pair that needs to communicate. This becomes complex at scale (10 VPCs need 45 peering connections). **AWS Transit Gateway** solves this: connect all VPCs to a central hub (TGW) and routing is handled centrally. You also cannot have overlapping CIDR blocks between peered VPCs — this is why proper IP planning is critical when setting up VPCs.

---

### 26. How does DynamoDB handle partitioning and what are hot partitions?

DynamoDB automatically partitions data across multiple storage nodes for scalability. Each partition can handle up to 3,000 RCU and 1,000 WCU. DynamoDB assigns items to partitions based on the partition key hash value. A **hot partition** occurs when a disproportionate amount of traffic is directed at a single partition — typically because items with the same (or similar) partition key are being accessed very frequently. For example, if you use `userId` as partition key and user "ADMIN" is accessed 10,000 times/second while all others are accessed 10 times/second, the partition holding "ADMIN" is hot. Solutions: choose a high-cardinality partition key (many unique values), add a random suffix or timestamp to the partition key and use GSIs to query, use DynamoDB's adaptive capacity (automatically rebalances hot partitions), or use DAX for caching frequent reads. A well-designed partition key distributes traffic evenly.

---

### 27. What is Lambda cold start and how do you minimize it?

A Lambda cold start occurs when a new execution environment must be initialized to handle an invocation. This happens when: Lambda scales up to handle more concurrent requests, after a function has been idle for some time (typically minutes), or after a deployment. Cold start duration includes: downloading the deployment package, initializing the runtime, running initialization code outside the handler function. Cold start durations range from ~100ms (Node.js, Python) to several seconds (Java, .NET with heavy dependencies). Strategies to minimize: **Provisioned Concurrency** — pre-initializes a specified number of execution environments, eliminating cold starts entirely (at cost), **Keep-warm** — scheduled EventBridge rule pings Lambda every few minutes (hacky but free), **Optimize package size** — smaller packages download and initialize faster, **Use faster runtimes** — Node.js and Python have shorter cold starts than Java or .NET, **Move initialization code outside handler** — reused across warm invocations (DB connections, SDK clients).

---

### 28. What is the difference between EBS, EFS, and S3?

| | EBS | EFS | S3 |
|---|---|---|---|
| Type | Block storage | File system (NFS) | Object storage |
| Access | Single EC2 (usually) | Multiple EC2s simultaneously | Any client via HTTP |
| Protocol | Block device | NFS v4 | REST API / SDK |
| Use case | EC2 root volumes, databases | Shared web server content, CMS | Static assets, backups, data lakes |
| Availability | Single AZ (unless Multi-Attach) | Multi-AZ, automatically | Multi-AZ (≥3 copies) |
| Scaling | Manual resize or elastic volumes | Automatic (elastic) | Unlimited and automatic |
| Latency | Sub-millisecond | Low (slightly higher than EBS) | Milliseconds |
| Cost | Per GB provisioned | Per GB stored (more expensive) | Per GB stored (cheapest) |

Use EBS for anything attached to a single EC2 instance. Use EFS when multiple EC2s need shared access to the same files. Use S3 for anything that doesn't need to be mounted as a drive.

---

### 29. How does Auto Scaling ensure high availability?

Auto Scaling Groups provide HA through several mechanisms: **Health checks** — ASG checks EC2 status checks and optionally ELB health checks. Unhealthy instances are automatically terminated and replaced with new ones. **Multi-AZ deployment** — ASG distributes instances across configured AZs. If an AZ fails, ASG launches replacement instances in the remaining AZs. **Minimum capacity** — ASG maintains a minimum number of healthy instances. Even if you don't need to scale, the minimum ensures the fleet stays healthy. **Launch Template/Configuration** — ASG knows exactly how to create replacement instances automatically. **Lifecycle hooks** — allow you to run custom scripts before an instance enters or leaves service (e.g., warm-up script, drain connections). For true HA, deploy ASG across at least 2 AZs with minimum capacity ≥ 2 so that losing one AZ doesn't reduce capacity to zero.

---

### 30. What is AWS CloudTrail and how is it different from CloudWatch?

**CloudTrail** records every API call made in your AWS account — who did what, when, and from where. It logs management events (creating EC2, modifying security groups) and optionally data events (S3 GetObject, DynamoDB PutItem). CloudTrail is primarily a **security and compliance** tool: audit who deleted resources, investigate security incidents, meet regulatory requirements, track configuration changes. Logs are stored in S3 and can be sent to CloudWatch Logs for alerting. **CloudWatch** is a **monitoring and operations** tool: tracks metrics (CPU, memory, request count), collects application logs, triggers alarms, and drives auto-scaling. A simple mnemonic: CloudWatch = "Is my application healthy RIGHT NOW?" and CloudTrail = "Who did what in my account HISTORICALLY?" For a security incident, you'd look in CloudTrail. For an application performance issue, you'd look in CloudWatch.

---

### 31. What is an Application Load Balancer and how does it differ from a Network Load Balancer?

**ALB (Layer 7 — HTTP/HTTPS):** Understands HTTP content, making intelligent routing decisions based on URL path (/api/* vs /*), hostname (api.example.com vs www.example.com), HTTP headers and query strings, and request methods. Supports WebSocket. Can authenticate users via Cognito or OIDC. Used for web applications and microservices. Slightly higher latency due to HTTP processing. **NLB (Layer 4 — TCP/UDP/TLS):** Routes traffic at the transport layer based on IP addresses and ports. Extremely high performance: handles millions of requests per second with microsecond latency. Supports static IP addresses and Elastic IPs per AZ (useful for firewalling). Used for: TCP/UDP applications, real-time gaming, IoT, financial trading systems, and scenarios requiring static IPs. Cannot inspect HTTP content. Use ALB for web applications; use NLB for extreme performance or when you need static IPs.

---

### 32. What is ElastiCache and when should you use Redis vs Memcached?

ElastiCache is a managed in-memory caching service that improves application performance by storing frequently accessed data in memory (microsecond latency) instead of hitting a database. **Redis** is a feature-rich in-memory data structure store supporting strings, lists, sets, sorted sets, hashes, bitmaps, and pub/sub. Redis supports persistence (data survives restarts), replication, clustering, multi-AZ with automatic failover, and Lua scripting. Use Redis for: session storage, real-time leaderboards (sorted sets), pub/sub, caching with complex data types, or when you need data persistence. **Memcached** is simpler — pure caching with no persistence. Supports multithreading (better CPU utilization on multi-core). Use Memcached for: simple object caching, when you need to scale horizontally across many nodes, or when simplicity is preferred. In practice, **Redis is almost always the better choice** due to its feature set and persistence support.

---

### 33. What is IAM Role vs IAM User — when should you use each?

**IAM Users** should be used for human identities who sign in interactively, or legacy applications that don't support IAM roles. Users have long-term credentials (password + access keys) which are a security risk if compromised or rotated infrequently. **IAM Roles** should be used for: EC2 instances, Lambda functions, ECS tasks, and other AWS services — they need permissions but should NEVER have access keys hardcoded. Cross-account access (role in another account that your role can assume). Federated identities (users in Active Directory or a SAML provider assuming AWS roles). Temporary elevated access for users. IAM Roles are more secure because: credentials are temporary (rotated by STS automatically, typically 1 hour), no long-term secret to accidentally expose in code, permissions can be changed without creating new credentials. **Rule of thumb:** If it's a machine or service, use a Role. If it's a human, use a User or federated identity.

---

### 34. What is AWS KMS and how does encryption work in AWS?

KMS (Key Management Service) manages encryption keys for AWS services and your applications. KMS uses **envelope encryption**: your data is encrypted with a **data key** (a symmetric encryption key), and that data key is itself encrypted by a **Customer Master Key (CMK)** stored in KMS. You never handle the CMK directly. When you need to decrypt: your application asks KMS to decrypt the encrypted data key (KMS checks IAM permissions), KMS returns the plaintext data key, your application decrypts the data, then discards the plaintext data key from memory. This means even if someone gets your encrypted data, they can't decrypt it without KMS access. AWS managed CMKs are free and auto-rotate annually. Customer managed CMKs cost $1/month and give you control over rotation, deletion (requires 7-30 day waiting period), and access policies. Most AWS services (S3, RDS, EBS, Lambda, Secrets Manager) integrate natively with KMS for at-rest encryption.

---

### 35. What are SQS Dead Letter Queues?

A Dead Letter Queue (DLQ) is a standard SQS queue that receives messages that could not be successfully processed after a configurable number of attempts. When you create an SQS queue, you can configure a **maxReceiveCount** (e.g., 3). If a message is received 3 times but not deleted from the queue (consumer failed to process it each time), SQS automatically moves it to the DLQ instead of leaving it to loop indefinitely. DLQs are used for: isolating problematic messages for investigation, preventing a single bad message from blocking the queue, debugging processing failures, and alerting on accumulating failed messages (CloudWatch alarm on DLQ depth). DLQs should be the same type as the source queue: FIFO source → FIFO DLQ, Standard source → Standard DLQ. For Lambda triggers, Lambda has its own DLQ for failed async invocations (separate from SQS DLQ).

---

### 36. What is an ECS Task Definition?

A Task Definition is a blueprint for your application in ECS — similar to a Dockerfile but at the deployment configuration level. It specifies: **Container definitions** (which Docker images to use, memory and CPU limits, port mappings, environment variables, log configuration, health checks), **Network mode** (bridge, host, awsvpc — Fargate requires awsvpc), **Launch type** (EC2 or Fargate), **CPU and memory** at the task level, **IAM Task Role** (permissions the container has to access AWS services like DynamoDB), **IAM Execution Role** (permissions for ECS to pull images from ECR and write logs to CloudWatch), **Volumes** (EFS volumes, bind mounts, tmpfs). Task Definitions are versioned — each update creates a new revision. An ECS Service then runs the specified number of tasks from a Task Definition, replacing unhealthy tasks automatically.

---

### 37. How does CloudFront caching work?

CloudFront caches content at 450+ edge locations globally. When a request arrives, CloudFront checks its edge cache for the content (cache key = URL by default, but can include headers and query strings). If it's a **cache hit**, content is returned from the edge — fast, no origin hit. If it's a **cache miss**, CloudFront forwards the request to the origin (S3, ALB, EC2), receives the response, caches it at the edge for future requests, and returns it to the user. Cache TTL is controlled by: **Cache-Control: max-age** header from origin (most reliable), CloudFront **cache policy** settings (min/max/default TTL), or CloudFront **default TTL** (24 hours if origin sends no cache headers). You can invalidate cached files on-demand (CloudFront → Invalidations, specify paths like `/*` or `/images/*`) — charged per path invalidation. For versioned assets (files with hash in filename), invalidation is unnecessary — the URL changes so CloudFront fetches a fresh copy.

---

### 38. What is Elastic Beanstalk?

Elastic Beanstalk is a Platform as a Service (PaaS) that abstracts infrastructure management. You deploy your application code and EB provisions and manages: EC2 instances, Auto Scaling Groups, Elastic Load Balancers, RDS databases, security groups, and CloudWatch monitoring. Supported platforms: Node.js, Python, Ruby, PHP, Java, .NET, Go, Docker, and multi-container Docker. Deployment strategies: **All at once** (fastest, causes brief downtime), **Rolling** (deploys to a batch of instances at a time, no downtime, reduced capacity during deploy), **Rolling with additional batch** (maintains full capacity during deploy), **Immutable** (deploys to a new ASG, swaps, safest), **Blue/Green** (via environment swap, zero downtime). EB doesn't cost extra — you pay for the underlying resources. Use EB when you want AWS to handle infrastructure management and deployment automation without learning CloudFormation or Terraform. For full control, use EC2 + CloudFormation/Terraform directly.

---

### 39. What is AWS Config?

AWS Config is a service that continuously records and evaluates the configuration of your AWS resources. It creates a configuration history of your resources (what did this security group look like 6 months ago?), compares current configuration against desired configuration (**Config Rules**), and can trigger remediation actions when resources are non-compliant. Config Rules can be: **AWS managed rules** (over 150 pre-built rules like "is-s3-bucket-public", "is-ec2-instance-in-vpc", "rds-instance-public-access-check") or **custom Lambda rules** for organization-specific compliance requirements. Use cases: regulatory compliance auditing, security analysis, change management, and operational troubleshooting. Config integrates with Security Hub to aggregate compliance findings. Note: Config records configuration but does NOT prevent non-compliant resources from being created (that's SCPs or IAM). It detects and optionally remediates after the fact.

---

### 40. What is the difference between Cognito User Pools and Identity Pools?

**User Pools** handle **authentication** — they are a user directory that manages sign-up, sign-in, MFA, password policies, and social identity federation (sign in with Google/Facebook/Apple). When a user authenticates, User Pools issue JWT tokens (ID token, Access token, Refresh token). Your backend validates these JWTs to verify the user's identity. Use User Pools when you need a managed user database for your application. **Identity Pools** handle **authorization** for AWS resources — they exchange an identity token (from Cognito User Pool, Google, Facebook, SAML, etc.) for **temporary AWS credentials** (via STS). These credentials allow the user to directly call AWS services (e.g., upload to S3, call DynamoDB) without going through your backend. Use Identity Pools when you need mobile/web clients to access AWS services directly. The common pattern: authenticate with User Pool → exchange token with Identity Pool → use AWS credentials to access S3/DynamoDB directly.

---

### 41. What is blue/green deployment and how is it implemented on AWS?

Blue/green deployment maintains two identical production environments: **Blue** (current live) and **Green** (new version). You deploy the new version to Green, run tests, then switch traffic from Blue to Green — either all at once or gradually. If something goes wrong, you switch traffic back to Blue instantly. On AWS, blue/green can be implemented with: **Route 53** — create two DNS records and shift traffic using weighted routing. **ALB** — use target group weights to shift traffic percentage from Blue to Green listener rule. **ECS** — CodeDeploy blue/green shifts traffic between two ECS task sets. **Elastic Beanstalk** — environment swap (CLI: `eb swap`) swaps CNAMEs between blue and green environments. **Lambda aliases** — traffic shifting between two Lambda function versions. Benefits vs rolling deployments: instant rollback capability, ability to test green before routing traffic, zero downtime, full production environment testing. Downside: requires double the infrastructure temporarily.

---

### 42. What is AWS CloudFormation?

CloudFormation is AWS's native Infrastructure as Code (IaC) service. You define your infrastructure in a YAML or JSON template and CloudFormation provisions, updates, and deletes resources in the correct dependency order. Key concepts: **Stack** — a collection of AWS resources created from a template. **Template** — YAML/JSON file defining resources, parameters, mappings, conditions, and outputs. **Change Set** — preview of proposed changes before applying. **Stack Drift** — detection of manual changes that deviate from the CloudFormation template. **Nested Stacks** — stacks that create other stacks (for large templates). **StackSets** — deploy the same stack to multiple accounts and regions. CloudFormation is free — you pay only for the resources created. It integrates with all AWS services. When a stack update fails, CloudFormation automatically rolls back to the previous state. The AWS CDK (Cloud Development Kit) is a higher-level abstraction that generates CloudFormation templates using programming languages.

---

### 43. Explain the different DynamoDB consistency models.

DynamoDB offers two read consistency options: **Eventually Consistent Reads (default):** When you read, you might get data that is slightly stale (replication to all nodes takes time, typically milliseconds). This is fine for most applications. Costs 0.5 RCU per 4 KB. Twice as cost-effective as strongly consistent. **Strongly Consistent Reads:** When you specify `ConsistentRead: true`, DynamoDB returns the most up-to-date data, waiting for all nodes to confirm. Costs 1 RCU per 4 KB. Use when your application cannot tolerate stale data (financial balances, inventory counts). **Transactional Reads (DynamoDB Transactions):** ACID transactions across multiple items and tables using `TransactGetItems` or `TransactWriteItems`. Costs 2x RCU/WCU. Use for: financial transactions, shopping cart checkout, any operation where multiple items must succeed or fail together. For global tables (multi-region), strongly consistent reads are only available within the same region.

---

### 44. What is an ALB vs API Gateway for exposing Lambda?

Both can expose Lambda via HTTP, but they serve different use cases: **API Gateway** is purpose-built for APIs: supports request/response transformation, API keys and usage plans, custom authorizers (JWT, Lambda), built-in request validation, request/response mapping templates, stage variables, and WebSocket APIs. Costs $3.50/million requests (REST) or $1/million (HTTP API). Adds ~5-10ms overhead. **ALB** is simpler and cheaper: routes HTTP requests to Lambda based on path rules, supports multiple targets (EC2 + Lambda + ECS on same ALB). Costs $0.008/LCU-hour (typically cheaper for high traffic). ALB does NOT support: API keys, usage plans, request validation, custom authorizers, or WebSocket. Recommendation: Use API Gateway for public APIs that need security, throttling, and transformation features. Use ALB if you're already using it for other services and just need simple HTTP → Lambda routing without API management features.

---

### 45. How would you secure data at rest and in transit in AWS?

**Data in transit encryption:** Use TLS/HTTPS everywhere. CloudFront and ALB can enforce HTTPS with free ACM certificates. RDS, ElastiCache, and MSK support TLS connections. VPN and Direct Connect encrypt traffic to/from on-premises. Use `aws:SecureTransport` condition in S3 bucket policies to deny HTTP access. **Data at rest encryption:** S3: Enable SSE-S3 (AWS managed), SSE-KMS (customer managed keys), or SSE-C (customer-provided keys). Enable S3 default encryption on buckets. EBS: Enable encryption by default at the account level. RDS: Enable encryption at creation time (cannot add to existing — must snapshot and restore). DynamoDB: Encrypted by default using AWS managed keys. Lambda environment variables: Use KMS encryption for sensitive values. Secrets Manager: Encrypted by default with KMS. **Key management:** Rotate KMS keys annually (automatic for AWS managed). Use different KMS keys per environment (dev/staging/prod). Enable CloudTrail logging for KMS API calls.

---

## ADVANCED QUESTIONS (46–66)

### 46. How do you design a DynamoDB table for a social media application?

DynamoDB design starts with access patterns, not the data model. For a social media app, identify access patterns first: (1) Get a user's profile. (2) Get a user's posts in chronological order. (3) Get all comments on a post. (4) Get a user's followers. (5) Get a user's feed (posts from people they follow). A single-table design (recommended for DynamoDB) stores all entity types in one table. Design: `PK` (partition key) and `SK` (sort key) as generic names. For user: PK=`USER#userId`, SK=`#METADATA#`. For post: PK=`USER#userId`, SK=`POST#timestamp`. For comment: PK=`POST#postId`, SK=`COMMENT#timestamp#commentId`. Query user's posts: `PK=USER#userId, SK begins_with POST#`. Access pattern 5 (feed) is the hardest — either use a fan-out (write each new post to each follower's feed table) for read-heavy apps, or at read time query all followed users. Add GSI for reverse lookups (follower lists, post by ID). The key insight: in DynamoDB, reads are cheap and predictable; complex queries are expensive or impossible — design to make reads simple.

---

### 47. What is VPC PrivateLink and when do you use it?

AWS PrivateLink creates a private endpoint that allows you to access AWS services or your own services running in another VPC using private IPs — without traffic traversing the public internet or requiring VPC peering. How it works: the service provider creates a **VPC Endpoint Service** (backed by an NLB). The consumer creates an **Interface VPC Endpoint** in their VPC — this creates an ENI with a private IP in the consumer's subnet. All traffic flows through the ENI privately over the AWS network. Use cases: (1) Access AWS public services (S3, DynamoDB, SQS) without internet traffic — **Gateway Endpoints** for S3/DynamoDB (free), **Interface Endpoints** for others (cost per hour + data). (2) Expose your SaaS service to customers privately — customers access your service via their own private IP without seeing your VPC CIDR or needing VPC peering. (3) Microservices in separate VPCs communicating privately without complex peering topology. Key benefit over VPC peering: consumers don't see your entire VPC — just the specific service endpoint.

---

### 48. Explain how you would implement disaster recovery on AWS.

DR strategy selection depends on RTO (maximum acceptable downtime) and RPO (maximum acceptable data loss). **Backup and Restore (RTO: hours, RPO: hours — cheapest):** Regularly back up data to S3 cross-region. In DR event, restore from snapshots in the DR region. Cost: only storage. Use for non-critical systems. **Pilot Light (RTO: 10-30 min, RPO: minutes — low cost):** Always-running core components in DR region (databases with replication, minimal compute). Most infra is off. In DR event, scale up compute and update DNS. **Warm Standby (RTO: minutes, RPO: seconds — medium cost):** Reduced-scale version of production always running. Scales up in DR event. RDS Multi-AZ cross-region with read replica, EC2 ASG with min=1. **Multi-Site Active/Active (RTO: zero, RPO: zero — expensive):** Full capacity in both regions simultaneously. Route 53 routes traffic to both. No DR event needed — just remove the failed region from DNS. Implementation tools: RDS cross-region read replicas, S3 cross-region replication, Route 53 health checks with failover routing, CloudFormation to re-create infrastructure.

---

### 49. What is AWS Transit Gateway and when do you need it vs VPC Peering?

Transit Gateway (TGW) is a regional network hub that connects VPCs, VPNs, and Direct Connect gateways through a central routing layer. Unlike VPC peering (which creates direct point-to-point connections), TGW is a hub-and-spoke model: each VPC attaches to the TGW and the TGW's route tables control connectivity. **Choose VPC Peering when:** fewer than 5-10 VPCs need to connect, you want direct high-bandwidth connections, and transitive routing is not needed. Low cost: only data transfer charges. **Choose Transit Gateway when:** you have many VPCs (5+) that need to communicate, you need transitive routing between VPCs, you want centralized routing control, or you need to connect VPNs and Direct Connect to multiple VPCs simultaneously (without TGW, each VPC needs its own VGW). TGW costs $0.05/attachment/hour + data charges, so for small setups VPC peering is cheaper. TGW also supports inter-Region peering and multi-account hub-and-spoke architectures.

---

### 50. How does DynamoDB Streams work and what are its use cases?

DynamoDB Streams captures a time-ordered sequence of every change (insert, update, delete) to items in a DynamoDB table. Each stream record contains: the keys of the modified item, the old image (before change), the new image (after change), or both (configurable). Records are retained for 24 hours. Streams are consumed by Lambda functions — you configure Lambda as a trigger for the stream, and Lambda receives batches of records for processing. Use cases: **Event sourcing** — replay all changes to reconstruct state at any point in time. **Cross-region replication** — stream writes to another table in another region (this is how DynamoDB Global Tables works). **Aggregations** — maintain counts or sums in another DynamoDB table by reacting to item changes. **Notifications** — send emails or push notifications when specific data changes. **Cache invalidation** — invalidate ElastiCache entries when the underlying DynamoDB item changes. **Audit logs** — record all changes to sensitive data. The Lambda-DynamoDB Streams pattern is a powerful event-driven architecture primitive.

---

### 51. What are the trade-offs between Aurora and RDS MySQL?

**Aurora advantages over RDS MySQL:** Up to 3x more throughput than standard RDS MySQL. Storage automatically grows in 10 GB increments up to 128 TB — no pre-provisioning. Up to 15 read replicas (vs 5 for MySQL) with sub-10ms replication lag. Failover is faster (< 30 seconds vs 1-2 minutes for Multi-AZ RDS). Aurora MySQL is wire-compatible with MySQL 5.7/8.0 — most apps work without changes. Aurora Serverless v2 scales capacity in fine-grained increments (0.5 ACU steps). Global Database replicates to 5 regions with < 1 second replication lag. **Aurora disadvantages:** More expensive (~20% more than equivalent RDS). Less flexible instance types available. Aurora MySQL is not 100% feature-identical to community MySQL (edge cases). **When to use RDS MySQL:** Cost-sensitive workloads, specific MySQL version requirements, or when you need exact MySQL compatibility for specific features. **When to use Aurora:** Production workloads needing high performance, high availability, and operational simplicity. In practice, new projects should default to Aurora unless cost is the primary constraint.

---

### 52. How do you implement cross-account access in AWS?

Cross-account access allows principals in Account A to access resources in Account B without sharing credentials. The standard pattern uses IAM Roles: **Step 1:** In Account B (target), create an IAM role with the permissions needed and a trust policy that allows Account A's principal to assume it: `"Principal": {"AWS": "arn:aws:iam::ACCOUNT_A_ID:root"}`. **Step 2:** In Account A (source), grant the user or role `sts:AssumeRole` permission on the target role's ARN. **Step 3:** The user/application in Account A calls `sts:AssumeRole` to get temporary credentials for the Account B role. This pattern works for: developers accessing production accounts read-only, CI/CD pipelines deploying to multiple accounts, centralized logging accounts receiving CloudTrail logs, and AWS Organizations member accounts accessing services in a central account. For AWS Organizations, use Service Control Policies (SCPs) to set guardrails across accounts. For large environments, AWS Control Tower automates multi-account governance. The external ID parameter in trust policies prevents the "confused deputy" security problem in third-party integrations.

---

### 53. What is ECS service discovery and how does it work?

ECS service discovery allows ECS services to find each other by DNS name rather than hardcoded IPs or environment variables. AWS integrates ECS with **AWS Cloud Map** (service discovery service). How it works: when you create an ECS service with service discovery enabled, each task registered in the service creates a DNS record in a private Route 53 hosted zone. For example, a service named `user-service` in namespace `internal` gets DNS name `user-service.internal`. Other services can call `user-service.internal` and Route 53 returns the private IPs of healthy tasks. Records are automatically added when tasks start and removed when they stop or fail health checks. **A records** map to the task's IP directly (for awsvpc network mode). Use cases: service-to-service communication within a VPC, replacing hardcoded service endpoints, implementing service meshes. Alternative: use an ALB with path-based routing for HTTP services — simpler and provides load balancing, health checks, and TLS termination.

---

### 54. How do you optimize Lambda costs?

Lambda pricing is based on number of invocations ($0.20/million) and compute duration (GB-seconds). Optimization strategies: **Right-size memory** — use AWS Lambda Power Tuning (open source) to find the optimal memory/cost balance. Higher memory sometimes finishes faster and costs less overall. **Reduce duration** — optimize code, use async operations correctly, avoid synchronous waits. **Arm64 (Graviton2)** — up to 34% better price-performance vs x86. Just change architecture in the function config. **Optimize package size** — smaller packages cold start faster, reducing duration for first invocations. **Provisioned Concurrency** — if you need consistent latency and have constant traffic, provisioned concurrency eliminates cold starts but adds fixed cost. Compare with always-on EC2/Fargate. **Reuse connections** — initialize DB connections, SDK clients, and HTTP clients outside the handler function. They are reused across invocations in the same execution environment. **Batch invocations** — when processing SQS, use batch size and batch window to reduce invocations. **Choose right trigger type** — synchronous invocations cost more per request than async + SQS for background jobs.

---

### 55. What is the AWS Well-Architected Framework?

The Well-Architected Framework is AWS's set of architectural best practices organized into six pillars: **Operational Excellence:** Run and monitor systems to deliver business value and continually improve. Key concepts: operations as code (CloudFormation), frequent small reversible changes, anticipate failure, learn from operations events. **Security:** Protect information, systems, and assets. Key concepts: strong identity foundation (least privilege), enable traceability (CloudTrail), apply security at all layers, automate security best practices, protect data in transit and at rest. **Reliability:** Ability to recover from failures and meet demand. Key concepts: automatic recovery, test recovery procedures, scale horizontally, stop guessing capacity, manage change in automation. **Performance Efficiency:** Use computing resources efficiently. Key concepts: democratize advanced technologies (use managed services), go global in minutes, use serverless architectures, experiment more often. **Cost Optimization:** Avoid unnecessary costs. Key concepts: adopt a consumption model, measure overall efficiency, stop spending on undifferentiated heavy lifting, analyze and attribute expenditure. **Sustainability:** Minimize environmental impact of cloud workloads. Key concepts: maximize utilization, use managed services (more efficient than self-managed), reduce downstream impact. Use the Well-Architected Tool in AWS Console to review your workloads against these pillars.

---

### 56. How does EKS differ from ECS?

**ECS (Elastic Container Service)** is AWS-proprietary container orchestration. Simpler to get started — fewer concepts to learn. Tight AWS integration out-of-the-box. Two launch types: EC2 (you manage nodes) and Fargate (fully serverless). No control plane cost for EC2 launch type (Fargate has per-task pricing). Best for teams comfortable with AWS APIs. **EKS (Elastic Kubernetes Service)** is managed Kubernetes. Uses industry-standard Kubernetes API — skills transfer to any Kubernetes deployment (GKE, AKS, on-premises). Larger ecosystem: thousands of CNCF tools, Helm charts, operators. More complex: Kubernetes concepts (pods, deployments, services, ingress, RBAC) have a steep learning curve. Control plane costs $0.10/hour ($73/month) regardless of workload. EKS also supports Fargate for serverless pods. **When to choose ECS:** small/medium teams, primarily AWS shops, want simplicity. **When to choose EKS:** multi-cloud strategy, need Kubernetes-specific tooling (service mesh, Helm, operators), team already knows Kubernetes, or migrating existing Kubernetes workloads from on-premises.

---

### 57. What is AWS Secrets Manager vs SSM Parameter Store?

Both store sensitive configuration, but they have different strengths: **Secrets Manager:** Designed specifically for secrets (passwords, API keys, OAuth tokens). Native **automatic rotation** — can rotate RDS/Redshift/DocumentDB/custom secrets on a schedule using Lambda. Secrets are versioned automatically. Integrated with RDS, Redshift, and other services for rotation. More expensive: $0.40/secret/month + $0.05/10,000 API calls. **SSM Parameter Store:** More general-purpose configuration store. **Standard parameters:** Free. **Advanced parameters:** $0.05/parameter/month. Supports SecureString (encrypted with KMS) and plain String/StringList. Supports parameter hierarchy (`/myapp/prod/db-password`). No automatic rotation. Better for: configuration values (feature flags, ARNs, non-rotating API keys), environment-specific config. **Decision rule:** If the secret needs automatic rotation → Secrets Manager. If it's a configuration value or a secret that doesn't rotate often → Parameter Store. Budget-conscious teams often use Parameter Store for everything and manually rotate.

---

### 58. How would you handle a database migration from on-premises MySQL to Aurora?

A large-scale database migration should be done with near-zero downtime using AWS Database Migration Service (DMS): **Phase 1: Preparation.** Provision the Aurora MySQL target cluster. Create a DMS replication instance (sized appropriately for data volume). Install the DMS agent if source is on-premises. Test connectivity. **Phase 2: Full Load.** Configure DMS source endpoint (on-premises MySQL) and target endpoint (Aurora). Create DMS task with full load. Run the full load during a low-traffic period. This copies all existing data to Aurora. Full load can take hours/days for large databases. **Phase 3: Ongoing Replication (CDC).** After full load, DMS continues to replicate changes from on-premises (via binary log replication / CDC) to Aurora in near real time. Lag is typically seconds. **Phase 4: Application Testing.** Point a test environment at Aurora. Run full integration tests. Fix any compatibility issues (DMS may not migrate all stored procedures/triggers — use SCT for those). **Phase 5: Cutover.** Reduce connection pool size to minimize in-flight transactions. Wait for DMS replication lag to reach zero. Update application connection strings to point to Aurora endpoint. Monitor for errors. If issues, revert to on-premises (DMS can also replicate back). **Post-migration:** Verify row counts, run queries against both DBs to confirm data integrity. Delete DMS task and replication instance to stop charges.

---

### 59. What is Lambda Layers and when should you use them?

Lambda Layers are packages of code or data that can be shared across multiple Lambda functions. A layer is a ZIP archive that Lambda extracts into the `/opt` directory of the function's execution environment. Use cases: **Shared libraries** — common utilities used by multiple functions (lodash, moment.js, Axios). Instead of bundling them in every function package, put them in a layer. **Runtime extensions** — custom runtimes, Lambda Insights agent, Datadog agent. **Large dependencies** — if your ML model or binary dependency is 200 MB, put it in a layer to keep your function deployment packages small and faster to deploy. **Configuration files** — shared configuration or certificates across functions. Limits: up to 5 layers per function. Total uncompressed size (layers + function) must be ≤ 250 MB. Layers are versioned and can be shared publicly or with specific accounts. Layers reduce deployment package sizes, making `aws lambda update-function-code` faster. AWS publishes official layers for tools like the AWS SDK extensions and Lambda Insights.

---

### 60. What is AWS GuardDuty and what threats does it detect?

GuardDuty is a managed threat detection service that continuously monitors your AWS accounts and workloads using machine learning, anomaly detection, and threat intelligence feeds. It analyzes: **CloudTrail management events** (API calls — detecting unusual patterns like calls from Tor exit nodes, unusual regions, or after-hours activity), **VPC Flow Logs** (network traffic — detecting port scanning, cryptocurrency mining outbound connections, communication with known malicious IPs), **DNS logs** (detecting command-and-control callbacks using DNS). Specific threats GuardDuty detects: unauthorized access to EC2 (brute force SSH), unusual API activity from IAM credentials (stolen access keys), crypto mining (detected by outbound connections to mining pools), data exfiltration (large outbound data transfers), port scanning from EC2 instances (your instance is compromised and scanning others), and communication with known malicious IPs in threat intelligence databases. GuardDuty findings can trigger EventBridge rules to automatically isolate affected instances (change security group to block all traffic). GuardDuty is regional but findings can be aggregated to a central security account. Cost: based on volume of data analyzed.

---

### 61. How does S3 versioning and lifecycle policies work together?

S3 versioning keeps all versions of every object; lifecycle policies automate the transition and expiration of objects (and their versions). Without lifecycle policies, versioning can dramatically increase storage costs as every version is stored forever. A typical lifecycle policy for a versioned bucket: **Current version rules:** After 30 days → transition to Standard-IA. After 90 days → transition to Glacier. **Noncurrent version rules:** After 30 days → transition to Standard-IA. After 90 days → transition to Glacier. After 365 days → expire (permanently delete). **Expired delete markers:** If all versions of an object are deleted, there's a delete marker left. Enable "Expire current versions" for delete markers to clean these up. **Incomplete multipart uploads:** After 7 days → abort and delete. Practical example: a backup bucket with versioning → keep last 30 days in Standard (quick restore), archive to Glacier for compliance (years 2-7), then expire. This gives both the safety of versioning and the cost control of lifecycle policies.

---

### 62. What is EBS multi-attach and when should you use it?

EBS Multi-Attach allows a single EBS io1 or io2 volume to be attached to up to 16 Nitro-based EC2 instances simultaneously in the same AZ. Each instance has full read and write access to the volume. This sounds like a solution for shared storage, but it comes with critical caveats: **standard file systems (ext4, XFS) cannot be used** because they are not cluster-aware and multiple writers will corrupt data. You must use a **cluster-aware file system** like GFS2 or OCFS2, or handle locking at the application level. Use cases are narrow and specific: **cluster databases** (like SAP HANA, Oracle RAC) that manage their own I/O coordination, **high-availability applications** that need fast failover without reattachment delay, and **shared raw block device** workloads with application-level locking. For most shared file storage needs, EFS (NFS) is the correct choice — it's designed for concurrent access. Multi-Attach is a specialized feature for very specific clustering use cases, not a general-purpose shared storage solution.

---

### 63. How does API Gateway throttling work?

API Gateway implements token bucket throttling at multiple levels: **Account-level:** 10,000 requests/second steady state, 5,000 burst across all APIs in a region. **Stage-level:** can configure default method throttle per stage. **Method-level:** can configure per-method throttle limits. **Usage Plans:** associate API keys with usage plans that define per-key rate limits and quotas. When throttled, API Gateway returns HTTP 429 (Too Many Requests). The token bucket algorithm: a bucket fills with tokens at the steady-state rate (e.g., 10,000/sec). Each request consumes one token. The bucket can hold up to the burst limit (5,000) worth of tokens for brief traffic spikes. Once the bucket is empty, requests are throttled. Client SDKs should implement **exponential backoff with jitter** when receiving 429 responses. For Lambda integrations, the Lambda service has its own concurrency limits (1,000 per region default) — so Lambda throttles (502) can happen even if API Gateway is not throttled. Use the combination of API Gateway throttling + Lambda reserved concurrency to protect downstream databases.

---

### 64. What is AWS Organizations and how do Service Control Policies work?

AWS Organizations lets you centrally manage multiple AWS accounts in a hierarchy. You create an **organization** with a **management (master) account** at the top, and organize member accounts into **Organizational Units (OUs)** — for example, OUs for Production, Development, and Security. **Service Control Policies (SCPs)** are JSON policies attached to OUs or accounts that act as guardrails — they define the maximum permissions available in an account, regardless of what IAM allows. Key SCP concepts: SCPs never grant permissions — they only restrict. Even if an IAM policy allows an action, the SCP must also allow it. The effective permission is the intersection. SCPs apply to all principals including the root user (except the management account). Common SCP examples: Deny all actions outside specific approved regions (data residency). Deny creation of IAM users or access keys (force SSO/federation). Deny purchasing Reserved Instances (control costs). Deny disabling CloudTrail (preserve audit trail). Require MFA for root account access. SCPs enable centralized governance — the central security team sets boundaries; individual account teams manage within those boundaries.

---

### 65. Describe the architecture for a real-time streaming data pipeline.

A production real-time data pipeline on AWS: **Ingestion:** Applications publish events to **Kinesis Data Streams** (up to 1 MB/record, ordered within shards) or **Amazon MSK** (Kafka for higher throughput or when Kafka ecosystem tools are needed). For simpler/smaller scale, SQS is sufficient. **Stream Processing:** **Lambda** (simple transformations, event-driven processing) or **Kinesis Data Analytics with Apache Flink** (complex stateful stream processing — aggregations, windowing, anomaly detection). **Multiple consumers** can read from Kinesis (Kinesis Data Analytics, Lambda, custom apps). **Storage / Archival:** **Kinesis Firehose** buffers and loads data to S3 (for the data lake), Redshift (for analytics), or OpenSearch (for search/visualization). Firehose can transform data with Lambda before loading. **Analytics:** Athena queries S3 data lake with SQL. Redshift for complex historical analytics. QuickSight for dashboards. **Monitoring:** CloudWatch metrics for Kinesis (GetRecords.IteratorAgeMilliseconds shows consumer lag), Lambda duration, and Firehose delivery success rate. **Failure handling:** Kinesis retains data for 24 hours (default) to 365 days — consumers can reprocess on failure. DLQ for Lambda failures. This pattern handles millions of events per second with sub-second latency from ingestion to analysis.

---

### 66. What is the difference between an Alias and a CNAME record in Route 53?

Both Alias and CNAME records point a hostname to another hostname, but they have critical differences: **CNAME records:** Standard DNS — point a hostname to another hostname. CANNOT be used for the root/apex domain (example.com without subdomain — called the zone apex). Query resolution: DNS client resolves the CNAME chain to the final IP. Charged per query. External hostnames (non-AWS) supported. **Alias records:** AWS-specific extension to DNS. Can be used for the zone apex (example.com) — this is a major advantage. Resolve natively to AWS resource IPs — the DNS response contains the actual IP, not another hostname. FREE for queries to AWS resources (S3, CloudFront, ALB, Elastic Beanstalk, API Gateway, VPC endpoints). Automatically follow changes to the target resource (e.g., ALB scales and changes IPs — Alias always resolves correctly). Only work for specific AWS targets — cannot point to external IPs. For exam: if the question asks how to point `example.com` (root domain) to an ALB → use Alias record. CNAME records cannot be used for zone apex. Alias is always preferred over CNAME for AWS resources due to the zero-query-cost benefit.

---

## Quick Reference: Common Follow-Up Questions

| If asked about... | Key points to mention |
|-------------------|-----------------------|
| S3 security | Bucket policies, ACLs, Block Public Access, VPC endpoints, SSE-KMS |
| Lambda optimization | Memory sizing, provisioned concurrency, package size, ARM64 |
| RDS scaling | Read replicas, Aurora auto-scaling, RDS Proxy for connection pooling |
| Cost optimization | Reserved/Spot/Savings Plans, right-sizing, S3 lifecycle, Trusted Advisor |
| High availability | Multi-AZ, multiple regions, health checks, stateless architecture |
| Networking security | Security groups, NACLs, PrivateLink, VPC endpoints, WAF |
| CI/CD | CodePipeline + CodeBuild + CodeDeploy OR GitHub Actions + OIDC + ECS |
| Containers | ECS vs EKS, Fargate vs EC2 launch type, ECR for images |
| Monitoring | CloudWatch metrics, alarms, Logs Insights, X-Ray for tracing |
| Disaster recovery | RTO/RPO, 4 strategies, Route 53 health checks, S3 cross-region replication |
