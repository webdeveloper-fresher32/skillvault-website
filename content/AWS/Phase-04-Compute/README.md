# Phase 4: AWS Compute Services

## Overview

Compute is the backbone of any cloud architecture. This phase covers every major compute service
in AWS, from raw virtual machines all the way to managed platforms. By the end of this phase you
will be able to design, launch, scale, and load-balance production workloads on AWS.

---

## Why Compute Matters

Every application needs somewhere to run code. AWS compute services let you:

- Provision servers in seconds instead of weeks
- Pay only for what you use
- Scale automatically with demand
- Choose the right abstraction level (VMs, containers, functions, or managed platforms)

---

## Files in This Phase

| File | Topic | Estimated Study Time |
|------|-------|----------------------|
| 01-EC2-Complete.md | Elastic Compute Cloud — the complete guide | 4–6 hours |
| 02-Auto-Scaling.md | Auto Scaling Groups, policies, lifecycle | 2–3 hours |
| 03-Elastic-Load-Balancer.md | ALB, NLB, GWLB — routing and HA | 2–3 hours |
| 04-Other-Compute.md | Beanstalk, Lightsail, Batch, Outposts | 1–2 hours |

---

## Topic Map

```
Phase 4: Compute Services
│
├── EC2 (01-EC2-Complete.md)
│   ├── Instance Types & Families
│   ├── AMIs
│   ├── Launching Instances
│   ├── EBS Storage
│   ├── Security Groups & Key Pairs
│   ├── Elastic IP
│   ├── User Data / Bootstrap
│   ├── Instance Lifecycle
│   ├── Pricing Models
│   ├── Placement Groups
│   └── Instance Metadata
│
├── Auto Scaling (02-Auto-Scaling.md)
│   ├── Auto Scaling Groups (ASG)
│   ├── Launch Templates
│   ├── Scaling Policies
│   ├── Health Checks
│   ├── Lifecycle Hooks
│   └── Instance Refresh
│
├── Elastic Load Balancer (03-Elastic-Load-Balancer.md)
│   ├── Application Load Balancer (ALB)
│   ├── Network Load Balancer (NLB)
│   ├── Gateway Load Balancer (GWLB)
│   ├── Target Groups
│   ├── Listeners & Rules
│   └── Cross-Zone Load Balancing
│
└── Other Compute (04-Other-Compute.md)
    ├── Elastic Beanstalk
    ├── Lightsail
    ├── AWS Batch
    └── AWS Outposts
```

---

## Key Relationships Between Services

```
Internet
    |
    v
[Route 53] ──> DNS resolution
    |
    v
[Elastic Load Balancer] ──> Distributes traffic
    |           |
    v           v
[EC2]       [EC2]       <── Auto Scaling Group manages these
    |           |
    v           v
[EBS]       [EBS]       <── Persistent block storage per instance
```

---

## Prerequisites

Before starting Phase 4, make sure you have completed:

- Phase 1: Cloud Fundamentals (regions, AZs, IAM)
- Phase 2: Networking (VPC, subnets, route tables, security groups)
- Phase 3: Storage (S3, EBS overview)

---

## AWS Services Covered

| Service | Type | Managed Level |
|---------|------|---------------|
| EC2 | Virtual Machine | IaaS |
| Auto Scaling | Scaling automation | AWS-managed |
| ELB (ALB/NLB) | Load balancing | AWS-managed |
| Elastic Beanstalk | App platform | PaaS |
| Lightsail | Simple VPS | Simplified IaaS |
| AWS Batch | Batch jobs | Managed |
| AWS Outposts | On-premises AWS | Hybrid |

---

## Exam Tips (AWS SAA-C03 Focus)

- EC2 instance types appear heavily — know General, Compute, Memory, Storage optimized families
- Pricing models are a common exam topic — understand when to recommend Spot vs Reserved vs On-Demand
- ALB vs NLB distinction is tested — remember Layer 7 vs Layer 4
- Auto Scaling policies — know the difference between Target Tracking, Step, and Scheduled
- EBS volume types — know gp2 vs gp3 vs io2 differences
- Security Groups are stateful; NACLs are stateless — this distinction is frequently tested

---

## Hands-On Lab Checklist

- [ ] Launch an EC2 instance and SSH into it
- [ ] Attach an EBS volume, format, mount, and write data
- [ ] Create a custom AMI from a running instance
- [ ] Launch a second instance from the custom AMI
- [ ] Create a Security Group for a web server (ports 22, 80, 443)
- [ ] Allocate and associate an Elastic IP
- [ ] Write a User Data bootstrap script
- [ ] Create an Auto Scaling Group with min=1, max=3
- [ ] Create an ALB and route traffic to the ASG
- [ ] Test scaling by simulating CPU load with `stress`

---

## Estimated Cost for Labs

All labs below use Free Tier eligible resources where possible.

| Lab | Instance Type | Cost Estimate |
|-----|--------------|---------------|
| Basic EC2 launch | t2.micro | Free Tier |
| EBS snapshots | 1 GB gp3 | ~$0.01 |
| ALB creation | - | ~$0.02/hour |
| ASG with 2 instances | t2.micro x2 | ~$0.02/hour |

> Always terminate resources after labs to avoid unexpected charges.
