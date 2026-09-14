# Phase 10: Containers on AWS

## Overview

Containers have become the standard unit of deployment for modern applications. This phase covers
the full container ecosystem on AWS — from the fundamentals of Docker through to running
production workloads on ECS and EKS.

## Why Containers Matter for AWS Engineers

Every AWS service you will work with in a modern environment either runs containers itself
or integrates deeply with containers. Lambda runs your code in containers under the hood.
ECS and EKS are first-class AWS services. CodePipeline and CodeBuild use containers for build
environments. Knowing containers is no longer optional — it is foundational.

## Learning Path

```
Docker Fundamentals
       |
       v
ECR (Image Registry)
       |
       v
ECS (Managed Container Service)
       |
       v
EKS (Managed Kubernetes)
```

## Files in This Phase

| File | Topic | Priority |
|------|-------|----------|
| 01-Docker-Complete.md | Docker fundamentals, Dockerfile, Compose | Start here |
| 02-ECS-Complete.md | Elastic Container Service, Fargate, EC2 | Core AWS service |
| 03-ECR-Complete.md | Elastic Container Registry | Required for ECS/EKS |
| 04-EKS-Complete.md | Elastic Kubernetes Service | Advanced |

## Exam Weight (SAA-C03)

Containers appear in the exam primarily in the context of:
- Choosing between ECS Fargate vs EC2 launch type
- IAM roles for containers (Task Role vs Execution Role)
- ECS Service Auto Scaling
- ECR image scanning and lifecycle policies
- When to use EKS vs ECS

## Prerequisites

- Phase 04 (Compute) — EC2, IAM
- Phase 07 (Networking) — VPC, ALB, Security Groups
- Phase 03 (Identity) — IAM Roles and Policies

## Key Concepts to Master

1. **Image vs Container** — An image is the blueprint, a container is the running instance
2. **Fargate vs EC2** — Fargate = serverless (AWS manages the host), EC2 = you manage the host
3. **Task Role vs Execution Role** — Task Role = what your app can do in AWS; Execution Role = what ECS can do on your behalf
4. **ECS vs EKS** — ECS is simpler and AWS-native; EKS is Kubernetes and portable
