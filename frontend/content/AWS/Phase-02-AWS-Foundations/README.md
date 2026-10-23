# Phase 2: AWS Foundations

## Overview

This phase establishes the foundational knowledge required for every AWS service and certification. Before you can meaningfully work with compute, storage, databases, or networking, you must understand how AWS is structured globally and how to interact with it.

---

## Why This Phase Matters

Everything you build on AWS sits inside a Region. Every API call you make authenticates through credentials tied to an account. Every decision about where to deploy a workload depends on understanding Regions, Availability Zones, and Edge Locations. This phase is not optional background — it is the lens through which all other AWS knowledge is interpreted.

---

## Files in This Phase

| File | Topic | Exam Weight |
|------|-------|-------------|
| `01-AWS-Global-Infrastructure.md` | Regions, AZs, Edge Locations, Local Zones | High |
| `02-AWS-Account-Setup.md` | Account creation, root user, IAM user, CLI, Free Tier | High |

---

## Learning Objectives

By the end of this phase you will be able to:

1. Explain the difference between a Region, an Availability Zone, and an Edge Location
2. Articulate why workloads should span multiple AZs
3. Choose the correct Region for a workload based on latency, compliance, and cost
4. Set up an AWS account with billing alerts and a locked-down root user
5. Install and configure the AWS CLI with named profiles
6. Understand the Free Tier tiers and avoid unexpected charges
7. Navigate the AWS Console confidently and switch between Regions

---

## Key Concepts at a Glance

```
AWS Global Infrastructure
├── Regions (geographic areas)
│   ├── us-east-1 (N. Virginia)
│   ├── eu-west-1 (Ireland)
│   └── ap-southeast-2 (Sydney)
│       ├── Availability Zone A  (one or more data centers)
│       ├── Availability Zone B
│       └── Availability Zone C
└── Edge Locations (CloudFront PoPs, 400+)
    └── Local Zones (ultra-low latency extensions)
```

---

## Recommended Study Order

1. Read `01-AWS-Global-Infrastructure.md` in full
2. Log in to the AWS Console and physically switch Regions
3. Read `02-AWS-Account-Setup.md`
4. Set up billing alerts before doing anything else
5. Install the AWS CLI and run `aws sts get-caller-identity`

---

## Certifications This Phase Covers

- AWS Certified Cloud Practitioner (CLF-C02) — Foundational
- AWS Certified Solutions Architect Associate (SAA-C03) — Domain 1 (Cloud Architecture Design)
- AWS Certified Developer Associate (DVA-C02) — Background knowledge
- AWS Certified SysOps Administrator Associate (SOA-C02) — Background knowledge

---

## Prerequisites

- Basic understanding of networking (what is an IP address, what is a data center)
- A credit card to create an AWS account (Free Tier will be used — charges are minimal if you follow the guide)
- A computer with internet access

---

## Time Estimate

| Activity | Time |
|----------|------|
| Reading both files | 3-4 hours |
| AWS Console hands-on | 1 hour |
| AWS CLI setup | 30 minutes |
| Practice interview questions | 1 hour |

**Total: ~6 hours**
