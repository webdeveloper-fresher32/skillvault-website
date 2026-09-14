# AWS Certification Complete Study Guide

A comprehensive guide to all AWS certifications with study strategies, key topics, and career-path recommendations.

---

## 1. AWS Cloud Practitioner (CLF-C02)

### Who It Is For
- Anyone new to cloud computing
- Business analysts, project managers, sales engineers moving into cloud roles
- Developers who want a formal credential before diving into associate-level certs
- Non-technical professionals who need to understand AWS

### What It Tests
Foundational understanding of cloud concepts, AWS services, security, pricing, and support. No deep technical knowledge required — it tests awareness, not implementation skills.

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 65 (50 scored + 15 unscored) |
| Time | 90 minutes |
| Format | Multiple choice, multiple response |
| Passing Score | 700 / 1000 |
| Cost | $100 USD |
| Validity | 3 years |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| Cloud Concepts | 24% |
| Security and Compliance | 30% |
| Cloud Technology and Services | 34% |
| Billing, Pricing and Support | 12% |

### Core Topics to Know
- What is cloud computing: on-demand, pay-as-you-go, scalability, elasticity
- Global infrastructure: Regions, AZs, Edge Locations
- Shared Responsibility Model (who manages what)
- Core services: EC2, S3, RDS, Lambda, VPC, IAM, CloudFront
- AWS pricing models: On-Demand, Reserved, Spot, Savings Plans
- Support tiers: Basic, Developer, Business, Enterprise
- AWS Organizations and consolidated billing
- Compliance programs: HIPAA, PCI DSS, SOC 1/2/3

### Recommended Study Time
3–4 weeks (1–2 hours/day) with no prior cloud experience

### Resources
- **Free:** AWS Skill Builder free tier — Cloud Practitioner Essentials course
- **Paid (best value):** Stephane Maarek on Udemy — "AWS Certified Cloud Practitioner"
- **Practice Exams:** Tutorials Dojo (Neal Davis) — 6 full practice exams
- **Free:** AWS official practice question set (20 free questions)

---

## 2. AWS Solutions Architect Associate (SAA-C03)

### Who It Is For
**This is the most important AWS certification.** It validates broad architectural knowledge across most AWS services. If you're a backend developer, DevOps engineer, or solutions engineer — this is your first serious cert.

### What It Tests
Your ability to design resilient, high-performing, secure, and cost-optimized architectures using AWS services. You'll need to choose the right service for a given scenario, design fault-tolerant systems, and understand when to use what.

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 65 (50 scored + 15 unscored) |
| Time | 130 minutes |
| Format | Multiple choice, multiple response |
| Passing Score | 720 / 1000 |
| Cost | $150 USD |
| Validity | 3 years |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| Design Resilient Architectures | 30% |
| Design High-Performing Architectures | 28% |
| Design Secure Architectures | 24% |
| Design Cost-Optimized Architectures | 18% |

### Critical Topics to Master

**Compute:**
- EC2 instance types, pricing models (On-Demand vs Reserved vs Spot)
- Auto Scaling Groups, Launch Templates, scaling policies
- Lambda limits, concurrency, cold starts, triggers
- ECS vs EKS vs Fargate — when to use each

**Storage:**
- S3: storage classes (Standard, IA, Glacier, Intelligent-Tiering), lifecycle policies, versioning, replication
- EBS: volume types (gp3, io1, st1, sc1), IOPS limits, multi-attach
- EFS: NFS for multiple EC2s, performance modes, throughput modes
- S3 Transfer Acceleration, Multipart Upload

**Databases:**
- RDS: Multi-AZ vs Read Replicas (know the difference deeply)
- Aurora: global databases, Serverless v2, auto-scaling storage
- DynamoDB: partition keys, GSI/LSI, DAX, streams, on-demand vs provisioned
- ElastiCache: Redis vs Memcached use cases
- When to use RDS vs DynamoDB vs Redshift vs Neptune

**Networking:**
- VPC design: subnets, route tables, IGW, NAT Gateway
- Security Groups vs NACLs (stateful vs stateless)
- VPC Peering, Transit Gateway, PrivateLink
- Route 53: routing policies, health checks, failover
- CloudFront: origins, behaviors, cache invalidation, Lambda@Edge

**Security:**
- IAM: users, groups, roles, policies (identity vs resource-based)
- KMS: envelope encryption, key rotation, CMK vs AWS managed
- Secrets Manager vs SSM Parameter Store
- WAF, Shield, GuardDuty — what each protects against
- VPC endpoints (gateway for S3/DynamoDB, interface for others)

**High Availability and Disaster Recovery:**
- RTO vs RPO (Recovery Time Objective vs Recovery Point Objective)
- DR strategies: Backup/Restore → Pilot Light → Warm Standby → Multi-Site Active/Active
- Multi-AZ vs Multi-Region

**Decoupling and Messaging:**
- SQS: standard vs FIFO, visibility timeout, dead-letter queues
- SNS: fan-out pattern, message filtering
- EventBridge: event-driven architectures
- SQS + SNS fan-out pattern

### Recommended Study Time
6–8 weeks (2 hours/day) for someone with 6+ months AWS experience

### Resources
- **Best course:** Stephane Maarek "AWS SAA-C03" on Udemy (most comprehensive)
- **Alternative:** Adrian Cantrill's course (more hands-on, deeper)
- **Practice exams (critical):** Tutorials Dojo — do all 6 exams, review every wrong answer
- **AWS docs:** Read the FAQs for: EC2, S3, RDS, DynamoDB, VPC, Lambda
- **Hands-on:** Complete all Projects in the Projects directory

---

## 3. AWS Developer Associate (DVA-C02)

### Who It Is For
Software developers who primarily build and deploy applications on AWS. Focuses on development workflows, SDK usage, serverless, CI/CD, and application integration.

### What It Tests
How to build, deploy, and debug cloud applications using AWS services. More code-focused than SAA.

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 65 |
| Time | 130 minutes |
| Passing Score | 720 / 1000 |
| Cost | $150 USD |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| Development with AWS Services | 32% |
| Security | 26% |
| Deployment | 24% |
| Troubleshooting and Optimization | 18% |

### Core Topics
- **Lambda:** Cold starts, provisioned concurrency, layers, environment variables, /tmp storage, function URLs
- **DynamoDB:** Data modeling, query vs scan, projection expressions, condition expressions, transactions
- **API Gateway:** REST vs HTTP vs WebSocket APIs, integration types, throttling, usage plans
- **Cognito:** User pools vs identity pools, JWT validation, hosted UI
- **CodePipeline, CodeBuild, CodeDeploy, CodeCommit:** complete CI/CD flow
- **X-Ray:** Distributed tracing, annotations, sampling rules
- **SQS/SNS:** Message attributes, deduplication, batch operations
- **ElastiCache:** Caching patterns — lazy loading, write-through, session caching
- **Elastic Beanstalk:** Deployment strategies, .ebextensions, environment tiers
- **CloudFormation:** Templates, stacks, change sets, drift detection
- **SSM Parameter Store:** SecureString parameters, parameter hierarchy
- **SDK:** Boto3 (Python) / AWS SDK for Node.js — retry logic, exponential backoff

### Recommended Study Time
4–6 weeks (if you already have SAA)

### Resources
- Stephane Maarek "AWS Developer Associate" on Udemy
- Tutorials Dojo practice exams (mandatory)
- AWS official developer guides

---

## 4. AWS SysOps Administrator Associate (SOA-C02)

### Who It Is For
System administrators, cloud operations engineers, and DevOps engineers responsible for deploying, managing, and operating AWS workloads.

### What It Tests
Operations skills: monitoring, automation, incident response, cost management, and high availability implementation.

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 65 (includes some lab scenarios in some regions) |
| Time | 180 minutes |
| Passing Score | 720 / 1000 |
| Cost | $150 USD |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| Monitoring, Logging, Remediation | 20% |
| Reliability and Business Continuity | 16% |
| Deployment, Provisioning, Automation | 18% |
| Security and Compliance | 16% |
| Networking and Content Delivery | 18% |
| Cost and Performance Optimization | 12% |

### Core Topics
- **CloudWatch:** Custom metrics, alarms, dashboards, Logs Insights queries, metric math
- **AWS Config:** Config rules, conformance packs, remediation
- **CloudTrail:** Management events vs data events, log file integrity, organization trails
- **Systems Manager:** Session Manager (SSH-less access), Patch Manager, Automation, Parameter Store, Inventory
- **Trusted Advisor:** Cost optimization, security, fault tolerance checks
- **Auto Scaling:** Scheduled scaling, step scaling, warm pools
- **ELB:** Health check tuning, access logs, connection draining
- **Route 53:** Health checks, DNS failover, DNSSEC
- **Cost Management:** Cost Explorer, Budgets, Cost Allocation Tags, Savings Plans

### Recommended Study Time
5–6 weeks (if you already have SAA)

### Resources
- Stephane Maarek "AWS SysOps" on Udemy
- Tutorials Dojo practice exams
- Hands-on: Set up CloudWatch dashboards and alarms on your own account

---

## 5. AWS Solutions Architect Professional (SAP-C02)

### Who It Is For
Senior architects, senior engineers, and cloud leaders responsible for complex multi-account, multi-region architectures. Requires deep breadth of knowledge.

### Prerequisites
- SAA certification (officially), but practically you need much more experience
- 2–3 years of hands-on AWS work recommended

### What It Tests
Advanced architectural decisions across the full AWS portfolio. Long, complex scenario questions. Often requires choosing between three plausible-sounding options.

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 75 |
| Time | 180 minutes |
| Passing Score | 750 / 1000 |
| Cost | $300 USD |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| Design for Organizational Complexity | 26% |
| Design for New Solutions | 29% |
| Migration Planning | 14% |
| Cost Control | 13% |
| Continuous Improvement | 18% |

### Advanced Topics
- **AWS Organizations:** SCPs, organizational units, account vending, delegated admin
- **Control Tower:** Landing zones, guardrails, account factory
- **Multi-account networking:** Transit Gateway, VPC peering at scale, AWS RAM
- **Identity Federation:** SAML 2.0, OIDC, AD Connector, Cognito federation
- **Migration strategies:** 7 Rs (Rehost, Replatform, Refactor, Repurchase, Retire, Retain, Relocate)
- **Application Migration Service (MGN)**, DMS, SCT
- **Data lakes:** S3, Glue, Athena, Lake Formation
- **Advanced DR:** Pilot light, warm standby, multi-site active/active patterns
- **Edge computing:** Outposts, Wavelength, Local Zones
- **Cost optimization at scale:** Compute Optimizer, Savings Plans across organizations

### Recommended Study Time
12–16 weeks (if you have SAA; working full-time)

### Resources
- Adrian Cantrill's SAP course (widely considered the best)
- Stephane Maarek SAP course on Udemy
- Tutorials Dojo practice exams (critical — difficulty matches the real exam)

---

## 6. AWS DevOps Engineer Professional (DOP-C02)

### Who It Is For
DevOps engineers, platform engineers, and SREs responsible for automating and optimizing AWS deployment pipelines and operations.

### Prerequisites
- Developer Associate OR SysOps Associate

### Exam Format

| Attribute | Details |
|-----------|---------|
| Questions | 75 |
| Time | 180 minutes |
| Passing Score | 750 / 1000 |
| Cost | $300 USD |

### Key Topic Domains

| Domain | Weight |
|--------|--------|
| SDLC Automation | 22% |
| Configuration Management and IaC | 19% |
| Resilient Cloud Solutions | 15% |
| Monitoring and Logging | 15% |
| Incident and Event Response | 14% |
| Security and Compliance | 15% |

### Core Topics
- **CI/CD:** CodePipeline deep dive, cross-account deployments, approval gates
- **CloudFormation advanced:** Custom resources, nested stacks, StackSets, drift detection
- **AWS CDK:** Constructs, stacks, synthesis
- **OpsWorks:** Chef/Puppet on AWS (still tested)
- **ECS/EKS deployments:** Blue/green, canary deployments
- **Incident management:** EventBridge rules, Lambda remediation, Systems Manager OpsCenter
- **Compliance as code:** Config rules + Lambda auto-remediation
- **Observability:** CloudWatch Evidently, RUM, X-Ray trace analysis

### Recommended Study Time
10–12 weeks (if you have associate cert)

### Resources
- Stephane Maarek DOP course
- Linux Academy / A Cloud Guru materials
- Tutorials Dojo practice exams

---

## 7. AWS Specialty Certifications

### Advanced Networking Specialty (ANS-C01)

**Who:** Network engineers, architects designing complex networking solutions.

**Key Topics:**
- VPC advanced: inter-Region peering, Transit Gateway routing, VPN, Direct Connect
- BGP routing, route summarization, AS path prepending
- CloudFront advanced: Lambda@Edge, signed URLs, field-level encryption
- Route 53 Resolver, hybrid DNS
- Network firewall, AWS Shield Advanced

**Study Time:** 12+ weeks

---

### Security Specialty (SCS-C02)

**Who:** Security engineers, cloud security architects.

**Key Topics:**
- IAM advanced: permission boundaries, resource-based policies, cross-account roles
- KMS: key policies, grants, CloudHSM vs KMS
- Detective controls: GuardDuty, Macie, Inspector, Security Hub
- Incident response playbooks
- Certificate Manager, private CA
- WAF rules, Shield Advanced, Firewall Manager

**Study Time:** 12+ weeks

---

### Machine Learning Specialty (MLS-C01)

**Who:** ML engineers, data scientists using AWS AI/ML services.

**Key Topics:**
- SageMaker end-to-end: data prep, training, tuning, deployment
- ML concepts: overfitting, bias, regularization, feature engineering
- AWS AI services: Rekognition, Comprehend, Translate, Transcribe, Forecast
- Data pipeline: Glue, Kinesis, S3 for ML
- Model monitoring and A/B testing

**Study Time:** 16+ weeks

---

## Career Path Recommendations

### Path 1: Backend Developer

```
Start: No certs
  ↓
Month 1-2:  Cloud Practitioner (establishes cloud vocabulary)
  ↓
Month 3-5:  Solutions Architect Associate (core architecture)
  ↓
Month 6-8:  Developer Associate (development focus)
  ↓
Month 9+:   Choose specialty based on work focus
```

**Recommended additional skills:** Lambda, DynamoDB, API Gateway, Cognito, X-Ray

### Path 2: DevOps / Platform Engineer

```
Start: No certs
  ↓
Month 1-2:  Cloud Practitioner (optional — skip if experienced)
  ↓
Month 2-5:  Solutions Architect Associate (required foundation)
  ↓
Month 6-8:  SysOps Associate (operations focus)
  ↓
Month 9-12: DevOps Professional (advanced pipeline automation)
  ↓
Month 12+:  Advanced Networking Specialty
```

**Recommended additional skills:** Terraform, Kubernetes, CI/CD pipelines, monitoring

### Path 3: Data Engineer

```
Start: No certs
  ↓
Month 1-3:  Solutions Architect Associate (foundational)
  ↓
Month 4-7:  Data Analytics Specialty or ML Specialty
  ↓
Month 8+:   Database Specialty
```

**Recommended additional skills:** Redshift, Glue, Athena, Lake Formation, Kinesis

---

## Exam Strategy

### How to Handle Scenario Questions

SAA, DVA, SAP, and DOP exams use scenario-based questions. The question describes a business situation and asks you to select the best solution. The trick: there are often two technically correct options, and you must choose the one that best meets the stated constraints.

**The MOST/BEST/LEAST framework:**
- "MOST cost-effective" → bias toward serverless, spot instances, S3, reserved capacity
- "HIGHEST availability" → bias toward Multi-AZ, Multi-Region, auto-scaling, managed services
- "LEAST operational overhead" → bias toward fully managed services (Aurora Serverless, ECS Fargate, Lambda)
- "MOST secure" → bias toward private endpoints, encryption at rest/in-transit, least-privilege IAM
- "MINIMUM changes to the existing application" → bias toward lift-and-shift solutions

### Common Question Patterns

**Pattern 1: Migration scenarios**
- Lift-and-shift (Rehost) → EC2 + RDS
- Refactor → Lambda + DynamoDB + API Gateway
- Replatform → Elastic Beanstalk or ECS

**Pattern 2: High availability**
- Single region HA → Multi-AZ RDS + ASG + ALB across 2+ AZs
- Disaster recovery → S3 cross-region replication + Route 53 health checks

**Pattern 3: Decoupling**
- Tight coupling → decouple with SQS
- Fan-out → SNS → multiple SQS queues
- Ordered messages → SQS FIFO

**Pattern 4: Caching**
- Database read scaling → ElastiCache (read-heavy workloads)
- Static content → CloudFront
- DynamoDB → DAX

**Pattern 5: Cost optimization**
- Long-running predictable workloads → Reserved Instances / Savings Plans
- Batch processing → Spot Instances
- Infrequent access → S3 IA, S3 Glacier
- Dev/test environments → Schedule-based shutdown

### Time Management

- **Professional exams:** You have 180 minutes for 75 questions = 2.4 min/question
- Flag long questions and come back to them
- Eliminate obviously wrong answers first (usually 2 can be eliminated quickly)
- If unsure, guess — there is no penalty for wrong answers
- Use the last 10 minutes to review flagged questions

### Exam Day Tips

1. **Use Pearson VUE** — you can take it online or at a test center
2. Online: test your equipment 24 hours before using the system check
3. Have a valid photo ID
4. You get a 30-minute extension if English is not your first language — request it when registering
5. After the exam, results are often available within hours on AWS Certification portal
6. AWS exams do not show which questions you got wrong — you only get a score report by domain

### How Many Practice Exams to Take

- **Tutorials Dojo** has 6 full practice exams per certification
- Complete all 6 in exam mode (not learning mode)
- Target: consistently scoring 80%+ before taking the real exam
- For every wrong answer, read the detailed explanation AND the AWS documentation link provided
- Focus extra study time on your lowest-scoring domains

---

## Maintaining Certifications

- All AWS certifications expire after **3 years**
- You can recertify by passing the current version of the exam, or by passing a higher-level exam in the same path (e.g., passing SAP-C02 automatically recertifies SAA-C03)
- AWS sends reminders starting 12 months before expiration
- Recertification exams cost the same as the original exam
- Check aws.training and aws.amazon.com/certification for current exam guides
