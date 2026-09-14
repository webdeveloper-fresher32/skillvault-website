# Local AWS — Complete Learning Course

Master AWS cloud development entirely on your local machine for ₹0. This course covers cloud infrastructure, serverless programming, containerization, and IaC using Floci, Docker, AWS CLI, and Terraform. Learn how to configure, code, deploy, and monitor production-like systems without ever receiving an AWS bill.

---

## Overview

AWS services are essential for modern Full-Stack and AI engineering, but learning them in the public cloud carries real billing risks. This course uses **Floci** (a fully free, MIT-licensed local AWS emulator simulating 70+ services) and **Docker** to run a local cloud directly on your machine. You will learn the exact same AWS APIs, CLI commands, and SDK integrations used in production. We cover the entire stack: from Identity and Access Management (IAM) and core serverless components (S3, DynamoDB, Lambda, API Gateway) to messaging queues (SQS, SNS), containers (ECS, ECR), Infrastructure as Code (Terraform), DevOps frameworks (SAM CLI, CloudWatch), and AI mock environments (Bedrock and SageMaker alternatives).

---

## Course Structure

```
AWS-Local/
├── Phase-01-AWS-Local-Setup/                 → Install Floci, Docker, AWS CLI, set endpoints
├── Phase-02-Identity-and-Access-Management/   → Simulate Users, Groups, Roles, and local Policies
├── Phase-03-Amazon-S3-Storage/               → Local buckets, object API, and static site hosting
├── Phase-04-DynamoDB-Database/               → Single-table design, PK/SK, GSI, and SDK queries
├── Phase-05-AWS-Lambda/                      → Write local Lambda handlers, layers, and runtimes
├── Phase-06-API-Gateway/                     → HTTP/REST APIs, CORS, and Lambda proxy integration
├── Phase-07-SQS-and-SNS-Messaging/           → Queue processing, dead-letter queues, and pub-sub
├── Phase-08-Docker-and-EC2-Simulation/       → Mimic EC2 instances, SSH, and Nginx using Docker
├── Phase-09-Terraform-IaC-Local/             → Infrastructure as Code targeting local endpoints
├── Phase-10-Containers-ECS-and-ECR/          → Build local image registries and run ECS task mocks
├── Phase-11-DevOps-Observability-and-Automation/ → CloudWatch logging and SAM CLI local serverless
├── Phase-12-AI-and-Cloud-Simulation/         → Ollama/Bedrock alignment and local SageMaker setups
├── Projects/                                 → 5 end-to-end portfolio-ready integration projects
└── Quick-Reference/                          → Cheatsheet + 50 AWS & DevOps Interview Q&As
```

Every phase directory contains a `README.md` outlining the phase objectives, followed by numbered lesson files (`01-...md`, `02-...md`) structured in the repository's signature code-dense style.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | AWS Local Setup | Easy | 2 days |
| 02 | Identity & Access Management (IAM) | Easy | 2 days |
| 03 | Amazon S3 Storage | Easy | 3 days |
| 04 | DynamoDB Database | Medium | 4 days |
| 05 | AWS Lambda | Medium | 3 days |
| 06 | API Gateway | Medium | 3 days |
| 07 | SQS & SNS Messaging | Medium | 3 days |
| 08 | Docker & EC2 Simulation | Easy-Medium | 3 days |
| 09 | Terraform IaC Local | Medium-Hard | 3 days |
| 10 | Containers (ECS & ECR) | Medium-Hard | 3 days |
| 11 | DevOps & SAM CLI | Hard | 3 days |
| 12 | AI & Cloud Simulation | Medium-Hard | 3 days |
| Projects | 5 Portfolio Projects | Hard | 5 days |

**Total estimated time: 6 weeks** (30 phase-days + 12 project/quick-reference days ≈ 42 days)

---

## Prerequisites

- **MERN Stack / Node.js Familiarity:** All programmatic examples use Node.js and the official `@aws-sdk/client-*` libraries.
- **Docker Installed:** Docker Desktop or Docker Engine must be running on your system to host Floci and simulate containers.
- **Terminal Basics:** Comfortable with running commands in bash/zsh.
- **No AWS Account Required:** We will use dummy keys for configuration.

---

## Where to Start

Begin with [Phase-01-AWS-Local-Setup/README.md](Phase-01-AWS-Local-Setup/README.md).
