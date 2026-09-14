# Complete AWS Learning Course

> **From Zero to Cloud Engineer — A Structured, Hands-On Journey Through Amazon Web Services**

---

## Why AWS?

Amazon Web Services powers over 30% of the internet — from Netflix and Airbnb to NASA and the CIA. Whether you are launching a startup, advancing your career, or building enterprise-grade systems, AWS fluency is one of the most valuable technical skills you can develop today. This course takes you from foundational cloud concepts all the way to advanced architecture patterns, giving you both the theory and the hands-on practice to build, deploy, and operate real systems on AWS with confidence.

---

## How to Use This Course

This repository is organised into **phases**, each representing a logical learning milestone. Inside each phase folder you will find:

- `README.md` — Phase overview, objectives, and key concepts
- `notes/` — Detailed notes and explanations
- `labs/` — Hands-on lab exercises with step-by-step instructions
- `diagrams/` — Architecture diagrams and visual aids
- `quiz/` — Knowledge-check questions to test your understanding

**Recommended approach:**
1. Read the phase `README.md` first to understand the scope.
2. Work through the notes sequentially.
3. Complete every lab — reading alone is not enough.
4. Take the quiz before moving to the next phase.
5. Revisit earlier phases as later phases build upon them.

---

## Learning Path

Work through these phases in order. Each phase builds on the previous one.

| # | Phase | Folder | Estimated Time |
|---|-------|--------|----------------|
| 1 | ☁️ **Cloud Fundamentals** | [Phase-01-Cloud-Fundamentals/](Phase-01-Cloud-Fundamentals/) | 1 week |
| 2 | 🏗️ **AWS Foundations** | [Phase-02-AWS-Foundations/](Phase-02-AWS-Foundations/) | 1 week |
| 3 | 🔐 **Identity & Security (IAM)** | [Phase-03-Identity-Security/](Phase-03-Identity-Security/) | 1.5 weeks |
| 4 | 💻 **Compute Services (EC2)** | [Phase-04-Compute/](Phase-04-Compute/) | 2 weeks |
| 5 | 💾 **Storage Services** | [Phase-05-Storage/](Phase-05-Storage/) | 1.5 weeks |
| 6 | 🗄️ **Databases** | [Phase-06-Databases/](Phase-06-Databases/) | 2 weeks |
| 7 | 🌐 **Networking (VPC)** | [Phase-07-Networking/](Phase-07-Networking/) | 2 weeks |
| 8 | 📊 **Monitoring & Observability** | [Phase-08-Monitoring/](Phase-08-Monitoring/) | 1 week |
| 9 | ⚡ **Serverless** | [Phase-09-Serverless/](Phase-09-Serverless/) | 2 weeks |
| 10 | 🐳 **Containers** | [Phase-10-Containers/](Phase-10-Containers/) | 2 weeks |
| 11 | 🧱 **Infrastructure as Code** | [Phase-11-IaC/](Phase-11-IaC/) | 2 weeks |
| 12 | 🔄 **CI/CD & DevOps** | [Phase-12-CICD-DevOps/](Phase-12-CICD-DevOps/) | 2 weeks |
| 13 | 🏛️ **Architecture Design** | [Phase-13-Architecture/](Phase-13-Architecture/) | 2 weeks |
| 14 | 🚀 **Advanced AWS** | [Phase-14-Advanced/](Phase-14-Advanced/) | 3 weeks |

**Total estimated time: 25–30 weeks** (studying 1–2 hours per day)

---

## Recommended Learning Order

A visual flow of how the phases connect and depend on each other:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FOUNDATION LAYER                               │
│                                                                     │
│   [01 Cloud Fundamentals] ──► [02 AWS Foundations]                 │
│                                        │                            │
└────────────────────────────────────────┼────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CORE SERVICES LAYER                           │
│                                                                     │
│   [03 IAM & Security] ──► [04 Compute / EC2]                       │
│          │                       │                                  │
│          ▼                       ▼                                  │
│   [07 Networking/VPC] ◄── [05 Storage]                             │
│          │                       │                                  │
│          └───────────► [06 Databases]                               │
│                                  │                                  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OPERATIONS LAYER                                  │
│                                                                     │
│   [08 Monitoring] ──► [09 Serverless] ──► [10 Containers]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ENGINEERING & ARCHITECTURE LAYER                   │
│                                                                     │
│   [11 IaC] ──► [12 CI/CD & DevOps] ──► [13 Architecture Design]   │
│                                                  │                  │
│                                                  ▼                  │
│                                         [14 Advanced AWS]           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Projects

Practical projects that integrate multiple AWS services across phases. Each project includes a requirements document, architecture diagram, and solution walkthrough.

📁 [Projects/](Projects/)

| Project | Services Used | Difficulty |
|---------|--------------|------------|
| Static Website Hosting | S3, CloudFront, Route 53 | Beginner |
| Serverless REST API | Lambda, API Gateway, DynamoDB | Intermediate |
| Three-Tier Web Application | EC2, RDS, VPC, ELB | Intermediate |
| Containerised Microservices | ECS, ECR, ALB, RDS | Advanced |
| CI/CD Pipeline | CodeCommit, CodeBuild, CodeDeploy, CodePipeline | Advanced |
| Data Lake & Analytics | S3, Glue, Athena, QuickSight | Advanced |
| Multi-Account Landing Zone | Organizations, Control Tower, SSO | Expert |

---

## Certification Path

AWS certifications validate your skills and are recognised globally by employers. This course prepares you for the following certifications in order:

📁 [Certifications/](Certifications/)

```
Foundational
  └── AWS Certified Cloud Practitioner (CLF-C02)          ← After Phase 02

Associate
  ├── AWS Certified Solutions Architect – Associate (SAA-C03) ← After Phase 08
  ├── AWS Certified Developer – Associate (DVA-C02)           ← After Phase 10
  └── AWS Certified SysOps Administrator – Associate (SOA-C02) ← After Phase 12

Professional
  ├── AWS Certified Solutions Architect – Professional (SAP-C02) ← After Phase 14
  └── AWS Certified DevOps Engineer – Professional (DOP-C02)     ← After Phase 14

Specialty
  ├── AWS Certified Security – Specialty (SCS-C02)
  ├── AWS Certified Machine Learning – Specialty (MLS-C01)
  └── AWS Certified Advanced Networking – Specialty (ANS-C01)
```

Each folder in `Certifications/` contains exam guides, practice questions, and revision notes.

---

## Quick Reference

Common AWS service categories and the key services you will encounter throughout this course:

| Category | Key Services |
|----------|-------------|
| ☁️ **Compute** | EC2, Lambda, ECS, EKS, Fargate, Elastic Beanstalk, Batch |
| 💾 **Storage** | S3, EBS, EFS, FSx, Glacier, Storage Gateway |
| 🗄️ **Databases** | RDS, Aurora, DynamoDB, ElastiCache, Redshift, DocumentDB |
| 🌐 **Networking** | VPC, Route 53, CloudFront, API Gateway, ELB, Direct Connect, Transit Gateway |
| 🔐 **Security & Identity** | IAM, Cognito, KMS, Secrets Manager, WAF, Shield, GuardDuty, Inspector |
| 📊 **Monitoring** | CloudWatch, CloudTrail, X-Ray, Config, Health Dashboard |
| ⚡ **Serverless** | Lambda, API Gateway, Step Functions, EventBridge, SQS, SNS |
| 🐳 **Containers** | ECS, EKS, ECR, Fargate, App Runner |
| 🧱 **IaC & Management** | CloudFormation, CDK, Systems Manager, OpsWorks, Service Catalog |
| 🔄 **DevOps & CI/CD** | CodeCommit, CodeBuild, CodeDeploy, CodePipeline, CodeArtifact |
| 📬 **Messaging** | SQS, SNS, EventBridge, Kinesis, MSK (Managed Kafka) |
| 🤖 **AI & Machine Learning** | SageMaker, Rekognition, Comprehend, Polly, Transcribe, Bedrock |
| 📦 **Migration & Transfer** | DMS, SMS, DataSync, Snowball, Migration Hub |
| 💰 **Cost Management** | Cost Explorer, Budgets, Savings Plans, Trusted Advisor |

---

## Timeline Overview

| Weeks | Focus |
|-------|-------|
| 1–2 | Cloud fundamentals and AWS account setup |
| 3–4 | Core services: IAM, EC2, S3 |
| 5–7 | Networking, databases, and storage deep dives |
| 8–9 | Monitoring and serverless architecture |
| 10–12 | Containers and infrastructure as code |
| 13–16 | CI/CD pipelines, architecture patterns |
| 17–20 | Advanced topics and specialisations |
| 21–25 | Certification prep and project consolidation |
| 25–30 | Expert-level projects and real-world scenarios |

---

## Getting Started

1. **Set up your AWS account** — Use the [AWS Free Tier](https://aws.amazon.com/free/) to practise without cost.
2. **Install the AWS CLI** — Follow the setup guide in [Phase-02-AWS-Foundations/](Phase-02-AWS-Foundations/).
3. **Start at Phase 1** — Even if you have some cloud experience, the fundamentals phase is worth reviewing.
4. **Track your progress** — Check off phases and labs as you complete them.
5. **Ask questions** — Use the issues tab or community forums when you get stuck.

> "The best time to start learning AWS was a year ago. The second best time is right now."

---

*Last updated: June 2026 | Maintained by Ganesh Pirikirala*
