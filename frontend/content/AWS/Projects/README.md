# AWS Projects Overview

This directory contains hands-on AWS projects organized by difficulty level. Each project is designed to reinforce core AWS concepts through practical implementation. Work through them in order — each project builds on skills from the previous ones.

## Project Index

### Beginner Projects (`01-Beginner-Projects.md`)

| # | Project | Difficulty | Time Estimate | Services Used |
|---|---------|------------|---------------|---------------|
| 1 | Static Website on S3 + CloudFront | Beginner | 1–2 hours | S3, CloudFront, Route 53 (optional) |
| 2 | Deploy Node.js App on EC2 | Beginner | 2–3 hours | EC2, Security Groups, Elastic IP |
| 3 | IAM Users, Groups, and Roles | Beginner | 1–2 hours | IAM, AWS CLI |
| 4 | RDS MySQL Setup with Bastion | Beginner | 2–3 hours | RDS, EC2, VPC, Security Groups |

### Intermediate Projects (`02-Intermediate-Projects.md`)

| # | Project | Difficulty | Time Estimate | Services Used |
|---|---------|------------|---------------|---------------|
| 1 | VPC from Scratch | Intermediate | 2–3 hours | VPC, Subnets, IGW, NAT Gateway, Route Tables |
| 2 | ALB + Auto Scaling Group | Intermediate | 2–3 hours | EC2, ALB, ASG, Launch Templates, CloudWatch |
| 3 | Serverless CRUD API | Intermediate | 3–4 hours | Lambda, API Gateway, DynamoDB, IAM |
| 4 | CI/CD with GitHub Actions to EC2 | Intermediate | 3–4 hours | EC2, CodeDeploy, S3, IAM, GitHub Actions |

### Advanced Projects (`03-Advanced-Projects.md`)

| # | Project | Difficulty | Time Estimate | Services Used |
|---|---------|------------|---------------|---------------|
| 1 | Dockerized App on ECS Fargate | Advanced | 3–5 hours | ECS, ECR, Fargate, ALB, CloudWatch |
| 2 | Terraform Complete Infrastructure | Advanced | 4–6 hours | Terraform, VPC, EC2, S3, DynamoDB (state) |
| 3 | GitHub Actions CI/CD to ECS | Advanced | 4–5 hours | ECS, ECR, GitHub Actions, IAM (OIDC), Slack |
| 4 | EKS Kubernetes Deployment | Advanced | 5–8 hours | EKS, ALB Controller, CloudWatch, HPA, Ingress |

## Recommended Learning Path

```
Beginner (Projects 1-4)
    ↓
Intermediate (Projects 5-8)
    ↓
Advanced (Projects 9-12)
```

## Cost Estimates

| Level | Estimated AWS Cost (if torn down same day) |
|-------|---------------------------------------------|
| Beginner | $0–$2 per project |
| Intermediate | $1–$5 per project |
| Advanced | $3–$15 per project |

> **Important:** Always destroy/terminate resources after each project to avoid ongoing charges. Enable AWS Budgets with a $10/month alert on your account.

## Prerequisites

- AWS account (free tier eligible)
- AWS CLI installed and configured
- Basic Linux command line knowledge
- Node.js installed locally (for serverless projects)
- Docker installed locally (for container projects)
- Terraform installed locally (for IaC projects)
