# Phase 3: Identity & Security

## Overview

Security is not an afterthought in AWS — it is the foundational layer on top of which every other service is built. Before you can do anything meaningful with compute, storage, or networking, you need to understand how AWS controls access to resources, manages secrets, and protects data.

This phase covers the four pillars of AWS identity and security:

1. **IAM (Identity and Access Management)** — who can do what to which resources
2. **AWS Organizations** — multi-account structure, policy enforcement at scale
3. **KMS (Key Management Service)** — encrypting data at rest
4. **Secrets Manager** — securely storing and rotating credentials

---

## Why This Phase is Critical

Every security breach on AWS has one of these root causes:
- Overly permissive IAM policies (too much access granted)
- Hardcoded credentials in code or storage
- Root user access keys in use
- Missing encryption on sensitive data
- No rotation of secrets or access keys
- Single account with no blast radius control

This phase directly addresses all six.

---

## Files in This Phase

| File | Topic | Cert Exam Weight |
|------|-------|-----------------|
| `01-IAM-Complete.md` | IAM Users, Groups, Roles, Policies, MFA | Very High |
| `02-AWS-Organizations.md` | Multi-account strategy, SCPs, OUs | High |
| `03-KMS.md` | Key Management, Encryption, CloudHSM | High |
| `04-Secrets-Manager.md` | Secrets storage, rotation, comparison with Parameter Store | Medium |

---

## Key Security Principles

### 1. Principle of Least Privilege
Grant only the permissions required to do a specific job, nothing more.

### 2. Defense in Depth
Layer multiple security controls — if one fails, others prevent the breach.

### 3. Zero Trust
Never trust, always verify. Assume the network is hostile. Authenticate and authorise every request.

### 4. Separation of Duties
No single person or system should have unrestricted access to everything.

### 5. Shared Responsibility Model

```
AWS is responsible for:        You are responsible for:
- Physical security            - Your data
- Hardware                     - IAM users and policies
- Network infrastructure       - Encryption settings
- Hypervisor                   - OS patching (for EC2)
- Managed service security     - Application code
- Compliance certifications    - Network configuration (security groups, NACLs)
```

---

## AWS Well-Architected Framework: Security Pillar

The 6 design principles of the Security Pillar:

1. Implement a strong identity foundation (IAM, least privilege, MFA)
2. Enable traceability (CloudTrail, CloudWatch, Config)
3. Apply security at all layers (VPC, security groups, WAF, NACLs)
4. Automate security best practices (Security Hub, GuardDuty)
5. Protect data in transit and at rest (KMS, ACM, TLS)
6. Keep people away from data (use automation, minimize direct access)

---

## Learning Objectives

By the end of this phase you will be able to:

1. Create IAM users, groups, roles, and policies with correct permissions
2. Explain the difference between IAM Users, Groups, and Roles
3. Write a valid IAM policy JSON document from scratch
4. Design a multi-account AWS Organisation structure
5. Write and apply Service Control Policies (SCPs)
6. Encrypt data using KMS and understand envelope encryption
7. Store and auto-rotate database passwords using Secrets Manager
8. Answer 20+ IAM interview questions confidently

---

## Prerequisites

- Phase 2 complete (AWS account created, IAM admin user created)
- Basic understanding of JSON syntax
- Basic understanding of authentication vs authorisation concepts

---

## Time Estimate

| Activity | Time |
|----------|------|
| IAM Complete guide | 4-6 hours |
| AWS Organizations | 2 hours |
| KMS | 2 hours |
| Secrets Manager | 1 hour |
| Hands-on practice | 3-4 hours |
| Interview prep | 2 hours |

**Total: ~15 hours**

---

## Certifications This Phase Covers

- **CLF-C02** (Cloud Practitioner) — security concepts, shared responsibility model
- **SAA-C03** (Solutions Architect Associate) — Domain 2: Security (26% of exam)
- **DVA-C02** (Developer Associate) — IAM roles, Secrets Manager
- **SOA-C02** (SysOps Admin) — IAM administration, Organizations
- **SCS-C02** (Security Specialty) — Advanced IAM, KMS, Organizations SCPs
