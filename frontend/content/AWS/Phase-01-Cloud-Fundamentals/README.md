# Phase 1: Cloud Fundamentals

## Overview

This phase builds the foundational knowledge required before diving into AWS services. Every concept here is prerequisite knowledge that AWS builds on top of. If you understand everything in this phase deeply, the rest of AWS will make intuitive sense.

## Learning Objectives

By the end of Phase 1, you will be able to:

- Explain cloud computing to a non-technical person using analogies
- Distinguish between IaaS, PaaS, and SaaS and know when to use each
- Understand core networking concepts that underpin every AWS service
- Confidently navigate a Linux server from the command line
- Explain authentication, authorization, and encryption fundamentals
- Answer every common cloud fundamentals interview question with confidence

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-What-is-Cloud-Computing.md | Cloud concepts, HA, Scalability | 3-4 hours |
| 02-Cloud-Service-Models.md | IaaS, PaaS, SaaS | 2-3 hours |
| 03-Networking-Basics.md | IP, DNS, TCP/UDP, Firewalls | 4-5 hours |
| 04-Linux-Basics.md | Commands, SSH, Permissions, Processes | 5-6 hours |
| 05-Basic-Security.md | Auth, Encryption, SSL/TLS | 3-4 hours |

**Total: 17-22 hours of focused study**

---

## File Index

### 01 - What is Cloud Computing
`/Phase-01-Cloud-Fundamentals/01-What-is-Cloud-Computing.md`

The foundational "why" of cloud. Covers the evolution from physical servers to cloud, the 5 essential characteristics defined by NIST, deployment models (public/private/hybrid/multi-cloud), and the four reliability pillars every AWS architect must know: High Availability, Scalability, Fault Tolerance, and Elasticity.

Key topics:
- Electricity and renting analogies for cloud
- Traditional server vs cloud cost comparison
- On-premise → Colocation → Cloud evolution
- 99.9% vs 99.99% SLA math and what it means in downtime
- Vertical vs Horizontal Scaling
- Active-Active vs Active-Passive Fault Tolerance
- Auto Scaling concept

---

### 02 - Cloud Service Models
`/Phase-01-Cloud-Fundamentals/02-Cloud-Service-Models.md`

The three fundamental service models: who manages what. Uses the Pizza-as-a-Service analogy to make the distinction crystal clear. Maps real AWS services to each model.

Key topics:
- IaaS: you manage OS and above (EC2, S3, VPC)
- PaaS: you manage only application code (Elastic Beanstalk, RDS)
- SaaS: you manage nothing (WorkMail, Chime)
- Responsibility matrix table
- Decision framework for choosing a model

---

### 03 - Networking Basics
`/Phase-01-Cloud-Fundamentals/03-Networking-Basics.md`

The most critical prerequisite for AWS. VPC, subnets, security groups, route tables — none of these make sense without this chapter. Every concept maps directly to an AWS service.

Key topics:
- IP addressing (IPv4/IPv6, public/private ranges)
- CIDR notation with subnet math
- DNS resolution step-by-step
- Common port numbers
- HTTP/HTTPS request-response cycle
- TCP vs UDP with use cases
- NAT, Firewalls, Load Balancers
- Subnets and Route Tables

---

### 04 - Linux Basics
`/Phase-01-Cloud-Fundamentals/04-Linux-Basics.md`

You will SSH into EC2 instances constantly. This is your Linux survival guide. Every command includes practical examples and an AWS context.

Key topics:
- Linux file system architecture
- File and directory commands with examples
- File permissions (symbolic and numeric)
- SSH with key pairs (directly applies to EC2)
- Process management
- Networking commands (curl, dig, netstat)
- Package managers (apt, yum)
- Cron jobs and environment variables

---

### 05 - Basic Security
`/Phase-01-Cloud-Fundamentals/05-Basic-Security.md`

Security is not an afterthought in AWS — it is the foundation. This chapter explains the concepts that IAM, KMS, ACM, and Security Groups are built on.

Key topics:
- Authentication vs Authorization (most common interview question)
- All authentication methods including MFA and JWT
- RBAC vs ABAC
- Symmetric vs Asymmetric encryption
- Hashing with salting (why passwords are hashed not encrypted)
- SSL/TLS handshake step by step
- Common attacks and defenses
- AWS security service mapping

---

## How to Study This Phase

1. Read each file once for understanding without memorizing
2. After each section, close the file and explain the concept in your own words (Feynman technique)
3. Do the hands-on practice in the Practice section at the end of each file
4. Review the Interview Q&A section and answer each question out loud
5. Come back after 2 days and re-read the sections you found hard

## Prerequisites

None. This is the starting point.

## What Comes Next

After completing Phase 1, proceed to:
- **Phase 2: AWS Core Services** — IAM, EC2, S3, VPC

---

> "The expert in anything was once a beginner." — Start here, stay consistent.
