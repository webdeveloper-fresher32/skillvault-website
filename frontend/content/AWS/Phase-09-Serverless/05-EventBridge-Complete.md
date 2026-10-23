# Amazon EventBridge - Complete Guide

## Table of Contents
1. [What is EventBridge](#1-what-is-eventbridge)
2. [Event Bus Types](#2-event-bus-types)
3. [Event Structure](#3-event-structure)
4. [Rules: Event Pattern Matching and Schedules](#4-rules-event-pattern-matching-and-schedules)
5. [Event Pattern Syntax Examples](#5-event-pattern-syntax-examples)
6. [Supported Targets (20+)](#6-supported-targets-20)
7. [Input Transformation](#7-input-transformation)
8. [EventBridge vs SNS vs SQS](#8-eventbridge-vs-sns-vs-sqs)
9. [EventBridge Pipes](#9-eventbridge-pipes)
10. [Schema Registry](#10-schema-registry)
11. [Archive and Replay](#11-archive-and-replay)
12. [Cross-Account and Cross-Region Routing](#12-cross-account-and-cross-region-routing)
13. [EventBridge Scheduler](#13-eventbridge-scheduler)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What is EventBridge

### History: CloudWatch Events → EventBridge

Amazon EventBridge evolved from Amazon CloudWatch Events. In 2019, AWS rebranded and significantly expanded CloudWatch Events as EventBridge with:
- Custom event buses
- Partner event sources
- Schema registry
- Significantly more targets
- Advanced routing capabilities

**Backward compatibility**: The CloudWatch Events API still works and the default event bus is shared.

### Definition

Amazon EventBridge is a serverless event bus service that makes it easy to build event-driven architectures by connecting applications using events. It routes events from various sources to targets based on rules.

### Core Concept

```
Event Source ──event──→ Event Bus ──rule matches──→ Target(s)
                                    (pattern or schedule)
```

### Why EventBridge Instead of Just SNS?

| Need | SNS | EventBridge |
|------|-----|-------------|
| Fan-out based on content | Filter policies (limited) | Rich pattern matching (any JSON field) |
| AWS service events | Requires SNS integration setup | Native: 90+ AWS services publish automatically |
| SaaS partner events | No | Yes (200+ SaaS partners) |
| Schema discovery | No | Yes (Schema Registry) |
| Event replay | No | Yes (Archive + Replay) |
| Input transformation | No | Yes (transform before target) |
| Cross-account routing | Via topic policies | Native |
| Scheduling | No | Yes (EventBridge Scheduler) |
| Targets | 6 protocol types | 20+ AWS service targets |

### The Event-Driven Architecture Mindset

```
Traditional (synchronous):
  Service A calls Service B directly
  Service A waits for response
  Tight coupling: A fails if B is down

Event-Driven (asynchronous):
  Service A publishes event to EventBridge
  EventBridge routes to Service B (and C, D, E)
  Service A continues without waiting
  Loose coupling: B's availability doesn't affect A
```

---

## 2. Event Bus Types

### Default Event Bus

```
- Name: "default"
- Automatically exists in every AWS account
- Receives ALL AWS service events (CloudTrail, EC2, RDS, CodePipeline, etc.)
- Also receives custom events you publish
- Cannot be deleted
```

**AWS services that publish to default bus:**
- EC2: instance state changes (running, stopped, terminated)
- RDS: instance events, snapshot events
- CodePipeline: pipeline execution state changes
- ECS: task state changes
- CloudTrail: API activity (via CloudWatch Events bridge)
- Health: AWS service health events
- Config: configuration compliance changes
- Security Hub: findings
- GuardDuty: findings
- S3: object-level events (via EventBridge integration)
- 90+ other services

### Custom Event Bus

```
- Create your own named event bus for application events
- Isolate application events from AWS service events
- Supports cross-account event publishing
- Resource-based policies control who can publish/receive
```

**Use cases:**
- Microservices event communication
- Separate environments (prod vs dev buses)
- Tenant isolation in multi-tenant SaaS

**Creating a custom bus:**
```python
import boto3

events_client = boto3.client('events', region_name='us-east-1')

# Create custom event bus
events_client.create_event_bus(
    Name='ecommerce-events',
    Tags=[
        {'Key': 'Environment', 'Value': 'prod'},
        {'Key': 'Application', 'Value': 'OrderSystem'}
    ]
)

# Publish to custom bus
events_client.put_events(
    Entries=[
        {
            'Source': 'com.mycompany.orders',
            'DetailType': 'Order Placed',
            'Detail': json.dumps({
                'orderId': 'ORD-123',
                'customerId': 'CUST-456',
                'amount': 99.99,
                'items': [{'sku': 'PROD-001', 'quantity': 2}]
            }),
            'EventBusName': 'ecommerce-events'
        }
    ]
)
```

### Partner Event Bus

```
- Receive events from SaaS partners directly into your account
- Partner must be enabled in AWS console
- Events flow: SaaS App → Partner event source → Your account's event bus
- 200+ supported partners
```

**Supported partners include:**
- Salesforce (CRM events)
- Zendesk (ticket events)
- PagerDuty (incident events)
- Datadog (monitoring events)
- GitHub (repository events)
- Stripe (payment events)
- Twilio (communication events)
- Auth0 (identity events)
- Shopify (e-commerce events)

**Setup:**
1. In EventBridge console → Partner event sources
2. Find partner (e.g., Salesforce)
3. Get the partner event source ARN
4. Configure your SaaS app to send events to that ARN
5. Create rules on the partner event bus

---

## 3. Event Structure

### All EventBridge Events Follow This JSON Schema

```json
{
  "version": "0",
  "id": "12345678-1234-1234-1234-123456789012",
  "source": "com.mycompany.orders",
  "account": "123456789012",
  "time": "2026-06-08T10:00:00Z",
  "region": "us-east-1",
  "resources": [
    "arn:aws:ec2:us-east-1:123456789012:instance/i-12345678"
  ],
  "detail-type": "Order Placed",
  "detail": {
    "orderId": "ORD-123",
    "customerId": "CUST-456",
    "amount": 99.99,
    "status": "CREATED",
    "items": [
      {"sku": "PROD-001", "quantity": 2, "price": 49.99}
    ]
  }
}
```

### Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `version` | Always "0" | "0" |
| `id` | Unique event ID (UUID) | "12345678-..." |
| `source` | Who sent the event | "aws.ec2", "com.myapp.orders" |
| `account` | AWS account ID | "123456789012" |
| `time` | When event was generated | "2026-06-08T10:00:00Z" |
| `region` | AWS region | "us-east-1" |
| `resources` | ARNs of involved resources | EC2 ARN, S3 bucket ARN |
| `detail-type` | Human-readable event type | "EC2 Instance State-change Notification" |
| `detail` | Event-specific JSON payload | Any JSON |

### Real AWS Service Event Example (EC2 State Change)

```json
{
  "version": "0",
  "id": "7bf73129-1428-4cd3-a780-95db273d1602",
  "source": "aws.ec2",
  "account": "123456789012",
  "time": "2026-06-08T10:00:05Z",
  "region": "us-east-1",
  "resources": [
    "arn:aws:ec2:us-east-1:123456789012:instance/i-0abc123def456789"
  ],
  "detail-type": "EC2 Instance State-change Notification",
  "detail": {
    "instance-id": "i-0abc123def456789",
    "state": "terminated"
  }
}
```

### Publishing Custom Events

```python
import boto3
import json
from datetime import datetime

events_client = boto3.client('events')

def publish_order_event(order_id: str, customer_id: str, event_type: str, details: dict):
    response = events_client.put_events(
        Entries=[
            {
                'Time': datetime.utcnow(),
                'Source': 'com.mycompany.ecommerce',
                'Resources': [f'arn:aws:dynamodb:us-east-1:123456789012:table/Orders/item/{order_id}'],
                'DetailType': event_type,  # e.g., "Order Placed", "Order Shipped"
                'Detail': json.dumps({
                    'orderId': order_id,
                    'customerId': customer_id,
                    **details
                }),
                'EventBusName': 'ecommerce-events'
            }
        ]
    )
    
    failed = response['FailedEntryCount']
    if failed > 0:
        print(f"Warning: {failed} events failed to publish")
    
    return response['Entries'][0].get('EventId')
```

### Batch Publishing

```python
# Publish up to 10 events per API call
entries = []
for order in orders:
    entries.append({
        'Source': 'com.mycompany.ecommerce',
        'DetailType': 'Order Processed',
        'Detail': json.dumps(order),
        'EventBusName': 'ecommerce-events'
    })

# EventBridge allows max 10 entries per put_events call
for i in range(0, len(entries), 10):
    batch = entries[i:i+10]
    events_client.put_events(Entries=batch)
```

---

## 4. Rules: Event Pattern Matching and Schedules

### What is a Rule?

A rule is an EventBridge construct that:
1. Monitors an event bus for events
2. Matches events using a pattern OR fires on a schedule
3. Sends matching events to one or more targets

### Rule Types

#### Type 1: Event Pattern Rules

Match events based on their JSON structure. When an event matches, it's sent to all configured targets.

```json
// Rule pattern: match all EC2 instance terminations
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["terminated"]
  }
}
```

#### Type 2: Schedule Rules

Fire on a schedule (cron or rate expression). Creates a synthetic "scheduled event" that is sent to targets.

```
Rate expression: rate(5 minutes)
                 rate(1 hour)
                 rate(2 days)

Cron expression: cron(0 9 * * ? *)     = every day at 9 AM UTC
                 cron(0 0 1 * ? *)     = first day of every month
                 cron(0/15 * * * ? *)  = every 15 minutes
```

### Multiple Targets per Rule

A single rule can have up to **5 targets**. Each target receives the same matching event (or transformed version).

```
Rule: "OrderPlaced"
Targets:
  1. Lambda → Process order
  2. SQS → Queue for warehouse
  3. SNS → Notify operations team
  4. Step Functions → Start order workflow
  5. CloudWatch Logs → Audit trail
```

### Rule State

Rules can be **enabled** or **disabled**. Disabled rules don't process events but retain their configuration.

---

## 5. Event Pattern Syntax Examples

### Basic Exact Match

```json
// Match specific source and detail-type
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"]
}
```

### Match Multiple Values (OR Logic)

```json
// Match any of these states
{
  "source": ["aws.ec2"],
  "detail": {
    "state": ["stopped", "terminated", "shutting-down"]
  }
}
```

### Nested Field Matching

```json
// Match on nested detail field
{
  "source": ["com.mycompany.ecommerce"],
  "detail-type": ["Order Placed"],
  "detail": {
    "customer": {
      "tier": ["premium", "enterprise"]
    }
  }
}
```

### Numeric Matching

```json
// Orders over $1000
{
  "detail": {
    "amount": [{"numeric": [">", 1000]}]
  }
}

// Amount between 100 and 999.99
{
  "detail": {
    "amount": [{"numeric": [">=", 100, "<=", 999.99]}]
  }
}
```

### Prefix Matching

```json
// Match any source starting with "com.mycompany"
{
  "source": [{"prefix": "com.mycompany"}]
}

// Match resource ARNs in us-east-1
{
  "resources": [{"prefix": "arn:aws:ec2:us-east-1:"}]
}
```

### Anything-But Matching

```json
// All orders EXCEPT cancelled ones
{
  "detail": {
    "status": [{"anything-but": "CANCELLED"}]
  }
}

// Exclude multiple values
{
  "detail": {
    "status": [{"anything-but": ["CANCELLED", "FAILED", "REFUNDED"]}]
  }
}
```

### Exists Condition

```json
// Events that have a discount field
{
  "detail": {
    "discount": [{"exists": true}]
  }
}

// Events that DON'T have an errorCode field
{
  "detail": {
    "errorCode": [{"exists": false}]
  }
}
```

### Complex Combined Pattern

```json
// High-value premium orders placed in business hours that have a discount
{
  "source": ["com.mycompany.ecommerce"],
  "detail-type": ["Order Placed"],
  "detail": {
    "customer": {
      "tier": ["premium", "enterprise"]
    },
    "amount": [{"numeric": [">=", 500]}],
    "discount": [{"exists": true}],
    "status": [{"anything-but": "CANCELLED"}]
  }
}
```

### Account and Region Matching (Cross-Account Rules)

```json
// Events from specific accounts
{
  "account": ["111111111111", "222222222222"]
}
```

### Suffix Matching

```json
// S3 keys ending in .pdf
{
  "detail": {
    "object": {
      "key": [{"suffix": ".pdf"}]
    }
  }
}
```

---

## 6. Supported Targets (20+)

### Compute Targets

| Target | Use Case |
|--------|---------|
| AWS Lambda | Serverless processing |
| ECS Task | Run containerized task |
| EC2 Run Command | Execute on EC2 instances |
| EC2 RebootInstances | Restart instances |
| EC2 TerminateInstances | Auto-terminate instances |
| EC2 CreateSnapshot | Automated EBS snapshots |

### Integration Targets

| Target | Use Case |
|--------|---------|
| Amazon SQS | Queue for async processing |
| Amazon SNS | Fan-out notifications |
| Amazon Kinesis Data Streams | High-volume event streaming |
| Amazon Kinesis Data Firehose | Stream to S3/Redshift |
| AWS Step Functions | Start state machine execution |
| Amazon EventBridge Event Bus | Forward to another bus |

### Developer/DevOps Targets

| Target | Use Case |
|--------|---------|
| AWS CodePipeline | Trigger CI/CD pipeline |
| AWS CodeBuild | Trigger build |
| AWS Glue | Start ETL job |
| Amazon Batch | Submit batch job |
| AWS Systems Manager Run Command | Automate operations |
| AWS Systems Manager Automation | Run automation documents |

### Storage/Database Targets

| Target | Use Case |
|--------|---------|
| Amazon DynamoDB Streams | (via Pipe) |

### Monitoring Targets

| Target | Use Case |
|--------|---------|
| Amazon CloudWatch Logs | Log events |
| CloudWatch Metrics | Publish custom metrics |

### API Targets

| Target | Use Case |
|--------|---------|
| API Gateway REST API | Call any REST endpoint |
| API Destination (HTTP endpoint) | Call external webhooks |

### Example: Automated EC2 Snapshot

```python
# Rule: Every day at 2 AM, create snapshots of tagged EBS volumes
# No code needed — configure via console/CloudFormation

# Rule:
rule = {
    'Name': 'DailyEBSSnapshot',
    'ScheduleExpression': 'cron(0 2 * * ? *)',
    'State': 'ENABLED'
}

# Target:
target = {
    'Id': 'CreateEBSSnapshot',
    'Arn': 'arn:aws:ssm:us-east-1::automation-definition/AWS-CreateEbsSnapshot',
    'RoleArn': 'arn:aws:iam::123456789012:role/EventBridgeSSMRole',
    'Input': json.dumps({
        'VolumeId': 'vol-12345678',
        'Description': 'Automated daily snapshot'
    })
}
```

---

## 7. Input Transformation

### What is Input Transformation?

Before sending an event to a target, EventBridge can transform the event JSON. This is useful when:
- Target expects a different format than the source event
- You want to extract only specific fields
- You need to add static values

### Three Modes

#### Mode 1: Matched Event (Default)
Pass the entire event JSON as-is to the target.

#### Mode 2: Part of the Matched Event
Extract specific fields using JSONPath:
```
$.detail.orderId           → extracts orderId
$.detail.customer.email    → extracts nested field
$.source                   → extracts source field
```

Input path:
```json
{
  "orderId": "$.detail.orderId",
  "customerEmail": "$.detail.customer.email",
  "eventTime": "$.time"
}
```

#### Mode 3: Constant (Static Input)
Always send the same static JSON regardless of event content.
```json
{
  "action": "process",
  "environment": "production",
  "version": "v2"
}
```

### Input Template

Combine event data with static text using templates:

**Input paths map (extract fields):**
```json
{
  "orderId": "$.detail.orderId",
  "amount": "$.detail.amount",
  "region": "$.region"
}
```

**Input template (combine with static):**
```
"Order <orderId> for $<amount> received in <region>"
```

**Result:**
```
"Order ORD-123 for $99.99 received in us-east-1"
```

**JSON template:**
```json
{
  "message": "New order <orderId> for $<amount>",
  "priority": "HIGH",
  "source": "EventBridge",
  "region": "<region>"
}
```

### Practical Example: Transform EC2 Event for Slack

**Original EC2 event (detail):**
```json
{
  "instance-id": "i-0abc123",
  "state": "terminated"
}
```

**Input path:**
```json
{
  "instanceId": "$.detail.instance-id",
  "state": "$.detail.state",
  "account": "$.account",
  "time": "$.time"
}
```

**Input template:**
```json
{
  "text": "EC2 instance <instanceId> changed to state: <state> in account <account> at <time>"
}
```

**Sent to Slack webhook:**
```json
{
  "text": "EC2 instance i-0abc123 changed to state: terminated in account 123456789012 at 2026-06-08T10:00:05Z"
}
```

---

## 8. EventBridge vs SNS vs SQS

### Detailed Comparison Table

| Feature | EventBridge | SNS | SQS |
|---------|-------------|-----|-----|
| **Pattern** | Event routing (pub/sub enhanced) | Pub/sub | Message queue |
| **Message delivery** | Push to targets | Push to subscribers | Pull by consumers |
| **Message persistence** | No (archive separately) | No | Yes (up to 14 days) |
| **Event sources** | 90+ AWS services, 200+ SaaS, custom | Custom + some AWS | Custom only |
| **Content filtering** | Rich pattern matching on any JSON field | Message attributes only | No filtering |
| **Input transformation** | Yes (JSONPath + templates) | No | No |
| **Schema discovery** | Yes (Schema Registry) | No | No |
| **Archive + Replay** | Yes | No | No (DLQ only) |
| **Scheduling** | Yes (built-in scheduler) | No | Delivery delay (up to 15 min) |
| **Cross-account** | Yes (event bus policies) | Yes (topic policies) | Yes (queue policies) |
| **Cross-region** | Yes | No (same region only) | No (same region only) |
| **Targets** | 20+ AWS services | 6 protocol types | Consumers poll |
| **SaaS integration** | Yes (200+ partners) | No | No |
| **DLQ** | Yes (on rules) | Yes (on subscriptions) | Yes (native) |
| **Throughput** | 10,000 events/sec (default) | Near-unlimited | Near-unlimited |
| **Latency** | ~500ms (higher than SNS) | ~200ms | Depends on polling |
| **Cost** | $1.00/million custom events | $0.50/million | $0.40/million |
| **Message ordering** | No | No (Standard) / Yes (FIFO) | No (Standard) / Yes (FIFO) |

### Decision Guide

```
Use EventBridge when:
├── Source is an AWS service (S3, EC2, RDS, etc.) publishing native events
├── Source is a SaaS partner (Salesforce, Zendesk, etc.)
├── Need content-based routing on arbitrary JSON fields
├── Need input transformation before delivery
├── Need event archive + replay capability
├── Building event-driven microservices architecture
└── Need scheduling (use Scheduler)

Use SNS when:
├── Need simple fan-out to multiple subscribers
├── High throughput + low latency notifications
├── Need mobile push notifications (APNS, FCM)
├── Need SMS delivery
└── Fan-out pattern with SQS (SNS → multiple SQS queues)

Use SQS when:
├── Need durable message storage
├── Consumers need to process at their own pace
├── Need dead letter queue for failures
├── Decoupling producers from consumers
└── Work queue pattern (one message → one consumer)
```

### Combining All Three

The most powerful architectures combine all three:

```
AWS Service Event / Custom Event
         ↓
   EventBridge Bus
   (rich routing + transformation)
         ↓
       SNS Topic
       (fan-out)
    ↙     ↓      ↘
SQS-1  SQS-2   Lambda
(workers) (workers) (immediate)
```

---

## 9. EventBridge Pipes

### What are EventBridge Pipes?

EventBridge Pipes are point-to-point integrations that connect a source to a target with optional filtering and enrichment steps. Unlike rules (which fan-out), Pipes are 1:1 connections.

### Pipe Components

```
Source → [Filter] → [Enrichment] → Target
```

**Visual flow:**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   Source     │───→│   Filter     │───→│   Enrichment     │───→│   Target     │
│              │    │  (optional)  │    │   (optional)     │    │              │
│ - SQS Queue  │    │ Filter out   │    │ - Lambda         │    │ - SQS        │
│ - DynamoDB   │    │ unwanted     │    │ - API Gateway    │    │ - SNS        │
│   Streams    │    │ events       │    │ - Step Functions │    │ - Lambda     │
│ - Kinesis    │    │              │    │ - EventBridge    │    │ - EventBridge│
│ - Kafka      │    │              │    │   Connection     │    │ - Step Func  │
│ - MSK        │    │              │    │                  │    │ - API Dest   │
└──────────────┘    └──────────────┘    └──────────────────┘    └──────────────┘
```

### Sources

| Source | Description |
|--------|-------------|
| Amazon SQS | Messages from SQS queue |
| Amazon DynamoDB Streams | Table change events |
| Amazon Kinesis Data Streams | Streaming data |
| Amazon MSK | Managed Kafka |
| Self-managed Apache Kafka | External Kafka |
| Amazon MQ (ActiveMQ, RabbitMQ) | Message broker |

### Use Case: DynamoDB Streams → EventBridge Pipe → Target

```
DynamoDB Table: Orders
  ↓ (DynamoDB Stream on INSERT/MODIFY/REMOVE)
EventBridge Pipe
  ↓ Filter: only INSERT events, amount > 100
  ↓ Enrichment: Lambda adds customer tier from another DB query
  ↓
EventBridge Bus → Rules → Targets
```

### Pipes vs Rules + Event Bus

| Feature | Pipes | Rules + Event Bus |
|---------|-------|------------------|
| Source | Polling sources (SQS, DynamoDB Streams, Kinesis) | Event bus (push-based) |
| Fan-out | No (1:1) | Yes (multiple targets per rule) |
| Enrichment | Yes | No (only input transform) |
| Filtering | Yes | Yes (pattern matching) |
| Use case | Connect polling sources to event-driven | Route events from bus |

---

## 10. Schema Registry

### What is the Schema Registry?

EventBridge Schema Registry automatically discovers and stores schemas for events flowing through event buses. It enables:
- Code binding generation (auto-generated classes for events)
- Documentation of event structure
- Discovery of available event types
- Versioning of schemas

### How Schema Discovery Works

Enable schema discovery on an event bus → EventBridge analyzes events → infers JSON Schema → stores in registry.

```
Event flows through bus → Schema auto-discovered → Stored in registry
                                    ↓
                              Version 1: OrderPlaced schema
                                    ↓
                              Schema changes detected → Version 2 created
```

### Schema Registries

| Registry | Content |
|---------|---------|
| `aws.events` | All AWS service event schemas (pre-built, 100+ events) |
| `discovered-events` | Auto-discovered from your custom events |
| Custom | Manually created schemas |

### Generated Code Bindings

From a schema, EventBridge can generate code in:
- Python
- Java 8 / Java 11
- TypeScript

**Example generated Python class:**

For an `Order Placed` event, you get:
```python
from dataclasses import dataclass
from typing import List

@dataclass
class OrderPlacedItem:
    sku: str
    quantity: int
    price: float

@dataclass
class OrderPlacedDetail:
    orderId: str
    customerId: str
    amount: float
    items: List[OrderPlacedItem]

@dataclass
class OrderPlacedEvent:
    detail: OrderPlacedDetail
    detailType: str
    source: str
    account: str
    time: str
    region: str
```

**Benefit**: Instead of manually parsing JSON, use type-safe generated classes.

---

## 11. Archive and Replay

### What is Archive?

EventBridge can archive events (store them) as they flow through an event bus. You can replay archived events later.

**Configuration:**
```python
events_client.create_archive(
    ArchiveName='ecommerce-events-archive',
    EventSourceArn='arn:aws:events:us-east-1:123456789012:event-bus/ecommerce-events',
    Description='Archive all ecommerce events for replay',
    EventPattern=json.dumps({
        'source': [{'prefix': 'com.mycompany'}]  # Archive only your custom events
    }),
    RetentionDays=90  # Keep for 90 days (0 = indefinite)
)
```

### Why Archive and Replay?

**Scenarios:**
1. **Bug in event handler**: New Lambda has a bug, processes 1,000 events incorrectly. Fix the bug, replay those events.
2. **New service onboarding**: New microservice needs historical events to build its state.
3. **Testing**: Test new event handler against real historical events.
4. **Disaster recovery**: Replay events after a failure to rebuild state.

### Replay Events

```python
events_client.start_replay(
    ReplayName='replay-failed-orders-2026-06-08',
    Description='Replay orders that failed due to payment processing bug',
    EventSourceArn='arn:aws:events:us-east-1:123456789012:archive/ecommerce-events-archive',
    EventStartTime=datetime(2026, 6, 1),    # Replay from June 1
    EventEndTime=datetime(2026, 6, 8),      # To June 8
    Destination={
        'Arn': 'arn:aws:events:us-east-1:123456789012:event-bus/ecommerce-events',
        'FilterArns': [
            'arn:aws:events:us-east-1:123456789012:rule/ecommerce-events/ProcessOrders'
        ]
    }
)
```

### Archive Storage Cost

Charges per GB of archived events. Set appropriate `RetentionDays` to balance cost vs replay capability.

---

## 12. Cross-Account and Cross-Region Routing

### Cross-Account Event Routing

**Scenario**: Account A (producer) sends events to Account B (consumer).

**Step 1: Account B grants Account A permission to publish**
```python
# Run in Account B
events_client.put_permission(
    EventBusName='arn:aws:events:us-east-1:ACCOUNT-B:event-bus/default',
    Action='events:PutEvents',
    Principal='ACCOUNT-A-ID',
    StatementId='AllowAccountAPublish'
)
```

**Step 2: Account A creates rule targeting Account B's bus**
```python
# Run in Account A
events_client.put_rule(
    Name='ForwardOrdersToAccountB',
    EventPattern=json.dumps({
        'source': ['com.mycompany.orders'],
        'detail-type': ['Order Placed']
    }),
    EventBusName='ecommerce-events'  # Account A's bus
)

events_client.put_targets(
    Rule='ForwardOrdersToAccountB',
    EventBusName='ecommerce-events',
    Targets=[{
        'Id': 'CrossAccountTarget',
        'Arn': 'arn:aws:events:us-east-1:ACCOUNT-B-ID:event-bus/default',
        'RoleArn': 'arn:aws:iam::ACCOUNT-A-ID:role/EventBridgeCrossAccountRole'
    }]
)
```

### Cross-Region Event Routing

Similar to cross-account but targeting a bus in a different region.

```python
# Forward events to us-west-2 bus for regional processing
events_client.put_targets(
    Rule='ForwardToUSWest2',
    EventBusName='ecommerce-events',
    Targets=[{
        'Id': 'CrossRegionTarget',
        'Arn': 'arn:aws:events:us-west-2:123456789012:event-bus/ecommerce-events',
        'RoleArn': 'arn:aws:iam::123456789012:role/EventBridgeCrossRegionRole'
    }]
)
```

### Multi-Account Architecture Pattern

```
Organizational Structure:
  ┌─────────────────────────────────────────────────────┐
  │                  Central Event Bus                    │
  │         (Dedicated Events Account/Region)             │
  │                                                       │
  │  Rules for routing, monitoring, compliance            │
  └───────────────────┬─────────────────────────────────┘
                      ↑ events forwarded
          ┌───────────┼───────────┐
          ↑           ↑           ↑
   Account A    Account B    Account C
   (Orders)     (Payments)   (Inventory)
```

---

## 13. EventBridge Scheduler

### What is EventBridge Scheduler?

A fully managed scheduler that can invoke targets on a schedule (one-time or recurring). It's more powerful than scheduled rules because it can scale to millions of schedules.

### Scheduler vs Scheduled Rules

| Feature | Scheduled Rules | EventBridge Scheduler |
|---------|----------------|----------------------|
| Scale | Hundreds of rules | Millions of schedules |
| One-time scheduling | No | Yes |
| Timezone support | No (UTC only) | Yes (any timezone) |
| Target types | EventBridge targets | 200+ AWS service APIs |
| Flexible rate expressions | Basic | Yes (flexible cron) |
| Deletion after execution | No | Yes (for one-time) |
| DLQ | No | Yes |

### Schedule Types

**Rate-based:**
```
rate(5 minutes)
rate(2 hours)
rate(1 day)
```

**Cron-based:**
```
cron(0 9 * * ? *)           = Every day at 9 AM UTC
cron(0 9 * * ? *)           in timezone America/Sydney
cron(0 0 ? * MON *)         = Every Monday at midnight
cron(0/30 8-17 ? * MON-FRI *) = Every 30 min during business hours, weekdays
```

**One-time:**
```
at(2026-12-31T23:59:59)     = Exactly once on Dec 31, 2026
```

### Supported Targets (200+)

Any AWS SDK action across 200+ services:
- Lambda: Invoke
- SQS: SendMessage
- SNS: Publish
- Step Functions: StartExecution
- ECS: RunTask
- DynamoDB: PutItem, DeleteItem
- EventBridge: PutEvents
- Many more

### Creating a Schedule

```python
scheduler_client = boto3.client('scheduler', region_name='us-east-1')

# Recurring schedule: run every day at 2 AM to process daily reports
scheduler_client.create_schedule(
    Name='DailyReportProcessor',
    GroupName='ecommerce-schedules',
    ScheduleExpression='cron(0 2 * * ? *)',
    ScheduleExpressionTimezone='Australia/Sydney',  # Run at 2 AM Sydney time
    FlexibleTimeWindow={
        'Mode': 'FLEXIBLE',
        'MaximumWindowInMinutes': 15  # Can run anytime within 15-min window
    },
    Target={
        'Arn': 'arn:aws:lambda:us-east-1:123456789012:function:GenerateDailyReport',
        'RoleArn': 'arn:aws:iam::123456789012:role/SchedulerRole',
        'Input': json.dumps({
            'reportType': 'daily',
            'format': 'PDF'
        }),
        'RetryPolicy': {
            'MaximumRetryAttempts': 3,
            'MaximumEventAgeInSeconds': 3600
        },
        'DeadLetterConfig': {
            'Arn': 'arn:aws:sqs:us-east-1:123456789012:SchedulerDLQ'
        }
    }
)

# One-time schedule: send reminder at specific time
scheduler_client.create_schedule(
    Name=f'order-reminder-{order_id}',
    ScheduleExpression='at(2026-12-25T09:00:00)',
    ScheduleExpressionTimezone='America/New_York',
    ActionAfterCompletion='DELETE',  # Auto-delete after running once
    FlexibleTimeWindow={'Mode': 'OFF'},
    Target={
        'Arn': 'arn:aws:sqs:us-east-1:123456789012:Reminders',
        'RoleArn': 'arn:aws:iam::123456789012:role/SchedulerRole',
        'Input': json.dumps({'orderId': order_id, 'action': 'send_reminder'})
    }
)
```

### Flexible Time Window

Instead of firing at exactly the scheduled time, a flexible window allows AWS to run it within a time range. This distributes load across the window instead of all schedules firing simultaneously.

```
Schedule: rate(1 hour) with FlexibleTimeWindow: 15 minutes
→ Fires sometime between 00:00 and 00:15, then 01:00 and 01:15, etc.
→ Prevents thundering herd problem
```

---

## 14. Interview Q&A

---

**Q1: What is EventBridge and how does it differ from CloudWatch Events?**

**A:** EventBridge evolved from CloudWatch Events in 2019. The default event bus and AWS service event integration are the same (backward compatible). EventBridge added: custom event buses for application events, partner event buses for 200+ SaaS integrations, Schema Registry for event discovery and code generation, Archive + Replay for event storage and replay, API Destinations for calling external HTTP endpoints, 20+ target types (vs ~6 in CloudWatch Events), and richer event pattern matching.

In practice: CloudWatch Events is the old name; use EventBridge for all new development. The underlying service is the same, but EventBridge has significantly expanded capabilities for building event-driven architectures.

---

**Q2: Explain the three types of event buses in EventBridge.**

**A:** Default bus: Automatically exists in every AWS account. Receives events from 90+ AWS services (EC2, S3, RDS, CodePipeline, etc.) natively — no configuration needed. Also accepts custom events. Cannot be deleted.

Custom bus: You create and name it. Used for application-to-application events within your organization. Supports cross-account publishing via resource policies. Isolates application events from AWS service noise.

Partner bus: Receives events from SaaS partners (Salesforce, Zendesk, Stripe, GitHub, etc.). You enable a partner event source in EventBridge console, configure the SaaS app to send events to the provided ARN, and create rules on the partner bus to route those events to your targets. Enables real-time SaaS integration without polling or custom integration code.

---

**Q3: What is the structure of an EventBridge event and what fields does a pattern match against?**

**A:** Every EventBridge event has a standard envelope: `version`, `id` (UUID), `source` (who sent it, e.g., "aws.ec2"), `account`, `time`, `region`, `resources` (array of resource ARNs), `detail-type` (human-readable event type), and `detail` (arbitrary JSON payload specific to the event type).

Event patterns can match against any of these top-level fields, including nested fields within `detail`. You can match on exact values, arrays (OR logic), numeric ranges, prefixes, suffixes, existence/absence of fields, and anything-but conditions. All conditions in a pattern must match (AND logic). Most commonly, you filter on `source` + `detail-type` + specific `detail` fields to route precise event types to the right targets.

---

**Q4: Comparing EventBridge, SNS, and SQS — when would you use each?**

**A:** EventBridge: Use when building event-driven architectures with AWS service events or SaaS partner events, when you need rich content-based routing on arbitrary JSON fields, when you need input transformation, event archive+replay, or complex scheduling. It's the "smart router" for events.

SNS: Use for high-throughput fan-out where you need to push notifications to multiple subscribers simultaneously, especially when subscribers include SMS, mobile push (APNS/FCM), or email. SNS → SQS is the standard fan-out pattern for decoupled reliable processing.

SQS: Use when you need durable message storage, when consumers process at their own pace (pull model), when you need work queues with competing consumers, dead letter queues, and FIFO ordering. SQS is the backbone of reliability.

Often combined: EventBridge routes events → SNS fan-out → SQS queues per service → Lambda/EC2 consumers.

---

**Q5: What is input transformation in EventBridge and give a real use case?**

**A:** Input transformation modifies the event JSON before it's sent to a target. You define an "input path" (JSONPath expressions that extract fields from the event) and an "input template" (a template using those extracted values, possibly mixed with static content).

Real use case: EC2 termination → Slack notification. The EC2 event contains `detail.instance-id` and `detail.state`. The Slack webhook expects `{"text": "..."}`. Use input transformation: extract `instanceId = $.detail.instance-id` and `state = $.detail.state`, then template: `{"text": "Instance <instanceId> is now <state>"}`. The Slack webhook receives a properly formatted message without any Lambda function needed.

---

**Q6: What is the Schema Registry and how does it help development?**

**A:** The Schema Registry stores schemas for events flowing through event buses. Schema discovery can be enabled to automatically infer JSON schemas from events. It also contains pre-built schemas for all AWS service events.

Development benefits: (1) **Discovery** — developers can browse available event types and their structure without reading documentation. (2) **Code binding** — generate type-safe Python/Java/TypeScript classes from schemas, eliminating manual JSON parsing. (3) **Validation** — validate events against schemas before publishing. (4) **Documentation** — schemas serve as living documentation of your event contracts. (5) **IDE integration** — AWS Toolkit for VS Code/IntelliJ shows available events and auto-completes event handling code.

---

**Q7: Explain Archive and Replay in EventBridge. When is it useful?**

**A:** Archive captures events flowing through an event bus and stores them durably. You configure the archive with a pattern (which events to archive) and retention period. Replay allows you to re-publish archived events to an event bus (optionally filtered to specific rules).

Use cases: (1) **Bug recovery** — a Lambda function has a bug and processes 5,000 events incorrectly. Fix the bug, then replay those events to reprocess them correctly. (2) **New service onboarding** — a new microservice needs all historical events from the past 3 months to build its initial state. Replay the archive to the new service's rule. (3) **Testing** — replay real production events against a new event handler in a dev environment. (4) **Audit** — retain events for compliance with configurable retention (0 = indefinite).

---

**Q8: What is EventBridge Pipes and how does it differ from EventBridge rules?**

**A:** Pipes create point-to-point connections from a polling source (SQS, DynamoDB Streams, Kinesis, Kafka, MQ) to a target, with optional filtering and enrichment. Rules work on events already in an event bus and support fan-out (multiple targets).

Key difference: Pipes handle polling sources that don't natively publish to an event bus. DynamoDB Streams, Kinesis, and SQS require polling — Pipes do this automatically and can filter, enrich (call Lambda/API Gateway to add data), then deliver to a target. Rules only work with events pushed to a bus. Use Pipes when the source is a streaming/queue source; use Rules when events are already on an event bus and you need routing/fan-out.

---

**Q9: How does EventBridge Scheduler differ from scheduled rules?**

**A:** Scheduled rules support cron and rate expressions but are limited to hundreds of rules and UTC timezone only. EventBridge Scheduler supports millions of schedules, any timezone, one-time schedules (`at(timestamp)`), flexible time windows to spread load, 200+ AWS service API targets (not just EventBridge targets), per-schedule DLQ, retry policies, and auto-deletion after one-time executions.

Practical difference: If you need to schedule one reminder per user order (potentially millions of schedules), Scheduler handles this; scheduled rules would hit limits. If you're running a daily database cleanup at 2 AM Sydney time, Scheduler handles timezone natively. For simple recurring tasks with a few rules, both work equally.

---

**Q10: How do you route events cross-account with EventBridge?**

**A:** Three steps: (1) The receiving account adds a resource-based policy to its event bus granting `events:PutEvents` to the sending account's account ID (or specific role). (2) The sending account creates a rule on its event bus that targets the receiving account's bus ARN. (3) The sending account's EventBridge rule needs an IAM role with permission to call `events:PutEvents` on the target bus ARN.

Events flow: Sending account event bus → sending account's rule → (cross-account) → receiving account event bus → receiving account's rules and targets.

For multi-account organizations: create a central event bus account, have all accounts forward relevant events to it, build centralized monitoring, compliance, and audit rules there. Use AWS Organizations condition keys (`aws:PrincipalOrgID`) to allow all accounts in your org to publish to the central bus.

---

*End of Amazon EventBridge Complete Guide*
