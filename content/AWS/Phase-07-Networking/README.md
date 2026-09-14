# Phase 7: Networking

## Overview

Networking is one of the most critical and complex domains in AWS. Everything in AWS runs on a network, and understanding how to design, secure, and operate AWS networks is essential for any cloud engineer or architect. This phase covers the complete networking stack from virtual private clouds through DNS, CDN, and advanced connectivity options.

---

## Why Networking Matters

- Every AWS resource lives in a network context
- Poor network design = security vulnerabilities and performance bottlenecks
- Networking is consistently the heaviest topic on AWS certifications (SAA, ANS, SAP)
- Real-world production architectures require deep VPC knowledge
- Misconfigurations cause outages and data breaches

---

## Phase Contents

| File | Topic | Difficulty |
|------|-------|------------|
| 01-VPC-Complete.md | Virtual Private Cloud (full depth) | Hard |
| 02-Route53-Complete.md | DNS and Routing Policies | Medium |
| 03-CloudFront-Complete.md | Content Delivery Network | Medium |
| 04-Advanced-Networking.md | Transit Gateway, Direct Connect, VPN | Hard |

---

## Learning Path

```
Start Here
    |
    v
01-VPC-Complete.md          <-- Foundation of everything
    |
    v
02-Route53-Complete.md      <-- DNS and traffic routing
    |
    v
03-CloudFront-Complete.md   <-- CDN, caching, edge
    |
    v
04-Advanced-Networking.md   <-- Enterprise connectivity
```

---

## Key Concepts to Master

### Tier 1 (Must Know Cold)
- VPC, subnets, CIDR blocks
- Internet Gateway vs NAT Gateway
- Security Groups vs NACLs (stateful vs stateless)
- Route tables
- Public vs Private subnets

### Tier 2 (Know Well)
- VPC Peering
- VPC Endpoints (Gateway vs Interface)
- Route53 routing policies
- CloudFront distributions

### Tier 3 (Understand Conceptually)
- Transit Gateway
- Direct Connect
- Site-to-Site VPN

---

## Common Architecture Patterns

### 3-Tier Web Application
```
Internet
   |
[CloudFront] --> [ALB in Public Subnet]
                        |
               [EC2 in Private Subnet]
                        |
               [RDS in Private Subnet]
```

### Hybrid Cloud
```
On-Premises DC
   |
[Direct Connect / VPN]
   |
[Transit Gateway]
   |
[Multiple VPCs]
```

---

## Exam Weight (AWS SAA-C03)

Networking and content delivery: **~15-20%** of the exam

---

## Prerequisites

- Completed Phase 1-4 (Cloud Fundamentals, AWS Foundations, Security, Compute)
- Basic understanding of IP addressing (IPv4, CIDR notation)
- Familiarity with TCP/IP networking concepts

---

## Estimated Study Time

| Topic | Beginner | Intermediate |
|-------|----------|--------------|
| VPC | 6-8 hours | 3-4 hours |
| Route53 | 2-3 hours | 1-2 hours |
| CloudFront | 2-3 hours | 1-2 hours |
| Advanced Networking | 3-4 hours | 2-3 hours |
| **Total** | **13-18 hours** | **7-11 hours** |
