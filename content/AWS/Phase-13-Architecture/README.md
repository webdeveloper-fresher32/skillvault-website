# Phase 13: Architecture Design

This phase covers how to design robust, scalable, and resilient AWS architectures. You will learn the AWS Well-Architected Framework, common architectural patterns used in production, and disaster recovery strategies that align with real business requirements.

## Modules

| File | Topic | What You'll Learn |
|------|-------|-------------------|
| `01-Well-Architected-Framework.md` | AWS Well-Architected Framework | All 6 pillars, design principles, AWS services, review process |
| `02-Common-Architectures.md` | Production Architecture Patterns | 7 real-world patterns with ASCII diagrams and service mappings |
| `03-Disaster-Recovery.md` | Disaster Recovery | RTO/RPO, 4 DR strategies, AWS tools, cost comparisons |

## Learning Objectives

By the end of this phase you will be able to:

- Conduct a Well-Architected Review for any workload and identify gaps
- Design a 3-tier web application, serverless API, and microservices platform on AWS
- Choose the right DR strategy based on RTO/RPO requirements and budget
- Draw architecture diagrams and explain service choices in interviews
- Identify cost, security, and reliability trade-offs in architectural decisions

## Key Concepts

**Well-Architected Framework** — AWS's structured approach for evaluating architectures across six pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability.

**Architectural Patterns** — Proven, repeatable solutions to common problems: 3-tier web, serverless, microservices, event-driven, data pipelines, multi-region.

**Disaster Recovery** — Planning for failure at regional scale: Backup and Restore, Pilot Light, Warm Standby, and Multi-Site Active-Active strategies.

## Prerequisites

- Phases 1–12 completed (core AWS services, networking, security, CI/CD)
- Understanding of VPCs, subnets, security groups, IAM
- Familiarity with EC2, RDS, S3, Lambda, ECS, DynamoDB

## Exam Relevance

This phase is heavily tested in:
- **AWS Solutions Architect Associate (SAA-C03)** — architecture decisions, HA, fault tolerance
- **AWS Solutions Architect Professional (SAP-C02)** — complex multi-region, migration, DR
- **AWS DevOps Engineer Professional** — CI/CD, operational excellence, observability
