# Phase 8: Monitoring, Logging, and Observability

## Overview

Monitoring and observability are what separates production-grade AWS deployments from amateur ones. You cannot operate what you cannot see. This phase covers the three pillars of observability in AWS: metrics (CloudWatch), audit trails (CloudTrail), and configuration compliance (AWS Config).

---

## Why Monitoring Matters

- **Proactive alerting**: Know before users tell you something is broken
- **Root cause analysis**: Diagnose issues quickly with logs and metrics
- **Compliance**: Prove your environment meets regulatory requirements
- **Cost control**: Identify resource waste with utilization metrics
- **Security**: Detect unauthorized changes and suspicious activity
- **Capacity planning**: Understand usage trends for scaling decisions

---

## The Three Services

```
CloudWatch        = "What is happening RIGHT NOW?"
                    Metrics, Logs, Alarms, Dashboards
                    Operational monitoring
                    
CloudTrail        = "WHO did WHAT and WHEN?"
                    API call audit log
                    Security and compliance
                    
AWS Config        = "Are we COMPLIANT with our rules?"
                    Configuration history
                    Rule-based compliance checking
```

---

## Phase Contents

| File | Service | Focus |
|------|---------|-------|
| 01-CloudWatch-Complete.md | Amazon CloudWatch | Metrics, Logs, Alarms, Dashboards |
| 02-CloudTrail-Complete.md | AWS CloudTrail | API auditing, security investigation |
| 03-AWS-Config.md | AWS Config | Configuration compliance, history |

---

## How They Work Together

```
Example scenario: "Who stopped my EC2 instance?"

CloudTrail: Shows the API call
  - StopInstances called by user: john.doe@company.com
  - At: 2024-01-15 14:32:11 UTC
  - From IP: 203.0.113.45
  - Using: AWS Console

CloudWatch: Shows the impact
  - CPU dropped to 0% at 14:32
  - Status check failed at 14:33
  - Alarm triggered: EC2-Down at 14:33

AWS Config: Shows the compliance impact
  - EC2 instance moved from "running" to "stopped"
  - Config rule "ec2-instance-managed-by-ssm" now NON_COMPLIANT
```

---

## Learning Path

```
01-CloudWatch-Complete.md   <-- Start here (most used day-to-day)
        |
02-CloudTrail-Complete.md   <-- Security and audit
        |
03-AWS-Config.md            <-- Compliance and governance
```

---

## Key Concepts by Service

### CloudWatch
- Metrics (built-in + custom)
- Log Groups and Streams
- Alarms (OK, ALARM, INSUFFICIENT_DATA)
- Dashboards
- Logs Insights (query language)
- Metric Filters
- Container Insights

### CloudTrail
- Management Events (control plane)
- Data Events (data plane)
- Trails (log to S3)
- CloudTrail Insights (anomaly detection)
- Athena integration

### AWS Config
- Configuration items (snapshots of resources)
- Config Rules (managed and custom)
- Remediation actions
- Configuration timeline
- Aggregators (multi-account, multi-region)

---

## Exam Weight

- Monitoring tools: **~13%** of AWS SAA-C03
- CloudWatch: Most commonly tested
- CloudTrail: Security scenarios
- Config: Compliance scenarios

---

## Prerequisites

- Phase 1-4 completed
- Familiar with EC2, IAM, S3
- Basic understanding of logging concepts

---

## Estimated Study Time

| Topic | Beginner | Intermediate |
|-------|----------|--------------|
| CloudWatch | 4-5 hours | 2-3 hours |
| CloudTrail | 2-3 hours | 1-2 hours |
| AWS Config | 2-3 hours | 1-2 hours |
| **Total** | **8-11 hours** | **4-7 hours** |
