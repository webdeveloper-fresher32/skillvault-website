# Phase 9: Serverless on AWS

## Overview

Serverless computing lets you build and run applications without managing infrastructure. AWS offers a comprehensive suite of serverless services that handle scaling, availability, and operations automatically — you focus entirely on business logic.

> "Serverless does not mean no servers. It means you do not manage servers."

---

## What You Will Learn

This phase covers the core AWS serverless services used in modern cloud architectures:

| File | Service | Purpose |
|------|---------|---------|
| 01-Lambda-Complete.md | AWS Lambda | Run code without provisioning servers |
| 02-API-Gateway-Complete.md | API Gateway | Build and expose HTTP/WebSocket APIs |
| 03-SNS-Complete.md | SNS | Pub/Sub messaging, fan-out patterns |
| 04-SQS-Complete.md | SQS | Message queues, decoupling services |
| 05-EventBridge-Complete.md | EventBridge | Event routing and scheduling |
| 06-Step-Functions.md | Step Functions | Orchestrate multi-step workflows |

---

## The Serverless Architecture

```
                        SERVERLESS ARCHITECTURE
   ================================================================

   Client
     |
     v
   [ API Gateway ]  <-- REST / HTTP / WebSocket API layer
     |
     v
   [ Lambda ]       <-- Business logic (stateless functions)
     |         \
     v           v
  [ DynamoDB ]  [ S3 ]   <-- Serverless data stores
     |
     v
   [ SNS / SQS / EventBridge ]  <-- Async messaging layer
     |
     v
   [ Lambda ]  <-- Background processing functions
     |
     v
   [ Step Functions ]  <-- Multi-step workflow orchestration

   ================================================================
```

---

## Core Serverless Principles

### 1. No Server Management
You deploy code, not servers. AWS handles OS patching, hardware, availability zones, and capacity planning.

### 2. Auto Scaling
Functions scale automatically from zero to thousands of concurrent executions in milliseconds.

### 3. Pay Per Use
You are billed only for actual compute time consumed, not idle server time.

### 4. Event-Driven
Serverless functions are triggered by events: HTTP requests, file uploads, database changes, scheduled timers, and messages.

### 5. Stateless
Each function invocation is independent. State is stored in external services (DynamoDB, S3, ElastiCache).

---

## Serverless vs Traditional Comparison

| Aspect | Traditional (EC2) | Serverless (Lambda) |
|--------|-------------------|---------------------|
| Server management | You manage OS, patches | AWS manages everything |
| Scaling | Manual or Auto Scaling Groups | Automatic, instant |
| Billing | Per hour/second (even idle) | Per invocation + duration |
| Cold start | N/A (server always on) | Yes (first invocation) |
| Max execution time | Unlimited | 15 minutes |
| State | Server can hold state | Stateless (use external DB) |
| Long-running tasks | Yes | No (use Step Functions) |
| SSH access | Yes | No |
| Cost at scale | Can be cheaper | More expensive at very high load |

---

## Common Serverless Patterns

### Pattern 1: API + Lambda + DynamoDB
```
User --> API Gateway --> Lambda --> DynamoDB
```
Simple REST API with serverless backend.

### Pattern 2: S3 Event Processing
```
Upload --> S3 --> Lambda --> Process --> S3 (output)
```
File processing, image resizing, document parsing.

### Pattern 3: SNS Fan-Out
```
Publisher --> SNS Topic --> SQS Queue 1 --> Lambda 1
                       --> SQS Queue 2 --> Lambda 2
                       --> SQS Queue 3 --> Lambda 3
```
One event triggers multiple independent workflows.

### Pattern 4: SQS + Lambda (Async Decoupling)
```
API --> SQS Queue --> Lambda (batch processor)
```
Decouple producers from consumers, handle traffic spikes.

### Pattern 5: EventBridge + Lambda (Scheduled)
```
EventBridge Rule (cron) --> Lambda --> Cleanup/Report
```
Scheduled jobs, automated maintenance tasks.

### Pattern 6: Step Functions Orchestration
```
API --> Step Functions --> Lambda 1 --> Lambda 2 --> DynamoDB
                     --> Lambda (error handler)
```
Multi-step workflows with retry, error handling, branching.

---

## Key AWS Exam Topics for This Phase

- Lambda cold start vs warm start
- Lambda concurrency: reserved vs provisioned
- Lambda with VPC: when and why
- API Gateway: REST vs HTTP API differences
- SQS: Standard vs FIFO queue
- SQS visibility timeout and DLQ
- SNS fan-out pattern with SQS
- EventBridge vs SNS vs SQS: when to use each
- Step Functions: Standard vs Express workflows

---

## Prerequisites

Before starting this phase, ensure you have completed:
- Phase 4: Compute (EC2 concepts)
- Phase 6: Databases (DynamoDB basics)
- Phase 7: Networking (VPC, subnets for Lambda VPC)
- Phase 8: Monitoring (CloudWatch for Lambda logs)

---

## Hands-On Labs Summary

| Lab | Services | What You Build |
|-----|---------|----------------|
| Lab 1 | Lambda + S3 | Auto-resize images on upload |
| Lab 2 | Lambda + API Gateway + DynamoDB | Full CRUD REST API |
| Lab 3 | Lambda + EventBridge | Scheduled cron job |
| Lab 4 | SNS + SQS + Lambda | Fan-out processing pipeline |
| Lab 5 | Step Functions + Lambda | Order processing workflow |

---

## Study Approach

1. Read each file in order (01 through 06)
2. Draw the architecture diagrams on paper
3. Complete each hands-on lab in your AWS account
4. Review the Interview Q&A sections before your exam
5. Revisit the EventBridge vs SNS vs SQS comparison table — it is a common exam topic

---

## Estimated Study Time

| Topic | Study Time |
|-------|------------|
| Lambda | 3-4 hours |
| API Gateway | 2-3 hours |
| SNS | 1-2 hours |
| SQS | 2-3 hours |
| EventBridge | 1-2 hours |
| Step Functions | 1-2 hours |
| **Total** | **10-16 hours** |
