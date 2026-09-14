# Amazon SQS - Complete Guide

## Table of Contents
1. [What is SQS and the Decoupling Concept](#1-what-is-sqs-and-the-decoupling-concept)
2. [Standard vs FIFO Queue Comparison](#2-standard-vs-fifo-queue-comparison)
3. [Message Lifecycle Step by Step](#3-message-lifecycle-step-by-step)
4. [Visibility Timeout](#4-visibility-timeout)
5. [Message Retention Period](#5-message-retention-period)
6. [Maximum Message Size (256KB)](#6-maximum-message-size-256kb)
7. [Delivery Delay](#7-delivery-delay)
8. [Long Polling vs Short Polling](#8-long-polling-vs-short-polling)
9. [Dead Letter Queue (DLQ)](#9-dead-letter-queue-dlq)
10. [SQS + Lambda: Event Source Mapping](#10-sqs--lambda-event-source-mapping)
11. [SQS + Auto Scaling](#11-sqs--auto-scaling)
12. [FIFO Queue Deep Dive](#12-fifo-queue-deep-dive)
13. [SQS Extended Client](#13-sqs-extended-client)
14. [Security](#14-security)
15. [Hands-On: Decoupled Order Processing System](#15-hands-on-decoupled-order-processing-system)
16. [Interview Q&A](#16-interview-qa)

---

## 1. What is SQS and the Decoupling Concept

### Definition
Amazon Simple Queue Service (SQS) is a fully managed message queuing service that enables you to decouple and scale microservices, distributed systems, and serverless applications.

### The Problem SQS Solves: Tight Coupling

**Without SQS (Tight Coupling):**
```
                           ┌─────────────────────┐
Order API ──HTTP call──→   │  Order Processor     │
                           │  (must be UP)        │
                           └─────────────────────┘
Problems:
- If Order Processor is down → Order API fails
- If Order Processor is slow → Order API blocks
- Traffic spike → Order Processor overwhelmed
- Cannot scale independently
- Cannot retry failed processing
```

**With SQS (Loose Coupling):**
```
┌─────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Order API  │──msg──→│   SQS Queue          │←poll── │ Order Processors │
│ (Producer)  │        │                      │        │  (Consumers)     │
└─────────────┘        │  [msg][msg][msg][msg] │        │  EC2 / Lambda    │
                        │                      │        │  Auto-scaling    │
                        │  Durable: 14 days    │        └──────────────────┘
                        │  Scales infinitely   │
                        └──────────────────────┘

Benefits:
✓ Order API succeeds even if processors are down (message queued)
✓ Processors work at their own pace (backpressure)
✓ Processors scale based on queue depth
✓ Failed messages can be retried automatically
✓ Order API and processors deployed independently
```

### Key Characteristics
- **Pull-based**: Consumers poll the queue (vs SNS which pushes)
- **Durable**: Messages stored across multiple AZs (redundant)
- **At-least-once delivery**: Standard queues (possible duplicates)
- **Unlimited throughput**: No provisioning needed
- **Scales automatically**: From 1 message/day to millions/second
- **Serverless-ready**: Native Lambda integration

### SQS vs Direct Service Calls

| Scenario | Direct Call | With SQS |
|---------|-------------|----------|
| Downstream service down | Request fails | Message queued, retried later |
| Traffic spike | Downstream overwhelmed | Queue buffers, consumers scale |
| Processing failure | Manual recovery | Automatic retry via visibility timeout |
| Deployment | Must coordinate | Independent deployments |
| Scaling | Must scale together | Scale independently |

---

## 2. Standard vs FIFO Queue Comparison

### Comparison Table

| Feature | Standard Queue | FIFO Queue |
|---------|---------------|------------|
| **Throughput** | Unlimited (nearly) | 300 msg/sec (3,000 with batching) |
| **Message Ordering** | Best-effort (NOT guaranteed) | Strict FIFO within message group |
| **Delivery** | At-least-once (duplicates possible) | Exactly-once processing |
| **Deduplication** | No | Yes (5-minute dedup window) |
| **Message Group ID** | No | Yes (MessageGroupId) |
| **Use Case** | High-throughput, order doesn't matter | Order-critical, financial transactions |
| **Naming** | Any name | Must end in `.fifo` |
| **Lambda Trigger** | Yes | Yes |
| **SNS Integration** | Any SNS topic | SNS FIFO only |
| **DLQ** | Supported | FIFO DLQ only |
| **Cost** | Lower | Higher (~3x) |
| **Delay Queue** | Yes (0-900 sec) | Yes (0-900 sec) |
| **Long Polling** | Yes | Yes |
| **Encryption** | Yes (KMS) | Yes (KMS) |
| **Content-Based Dedup** | No | Yes |

### When to Choose Standard
- Email sending jobs (order doesn't matter)
- Image processing (resize, thumbnail generation)
- Log processing
- Notification dispatch
- Any high-volume work where duplicates are handled idempotently

### When to Choose FIFO
- Financial transactions (must process in exact order)
- E-commerce order state transitions (created → paid → fulfilled)
- Inventory management (FIFO prevents overselling)
- User action sequencing (undo/redo operations)
- Any workflow where sequence is business-critical

### FIFO Throughput Limits
```
Without batching: 300 transactions/second
With batching (up to 10 messages per batch): 3,000 messages/second

To exceed 3,000 msg/sec: Use high throughput FIFO (up to 70,000 msg/sec in preview)
```

---

## 3. Message Lifecycle Step by Step

### Full Lifecycle

```
Step 1: Producer sends message
Producer ──SendMessage()──→ SQS Queue
                             Message state: AVAILABLE
                             (visible to consumers)

Step 2: Consumer polls and receives message
Consumer ──ReceiveMessage()──→ Gets message from queue
                               Message state: IN-FLIGHT (not visible)
                               Visibility timeout starts (default: 30 sec)

Step 3a: Successful processing
Consumer processes message
Consumer ──DeleteMessage()──→ Message permanently removed from queue

Step 3b: Failed processing (crash/error)
Consumer crashes / visibility timeout expires
Message returns to AVAILABLE state
Consumer can receive it again
ReceiveCount incremented by 1

Step 4: Too many failures → DLQ
If ReceiveCount >= maxReceiveCount threshold
Message moved to Dead Letter Queue
```

### Visual Lifecycle

```
[Available] ──receive──→ [In-Flight] ──delete──→ [Deleted ✓]
     ↑                        │
     │                        │ timeout or failure
     └────────────────────────┘
     (back to available)

If ReceiveCount >= maxReceiveCount:
[Available] ──receive──→ [In-Flight] ──(no delete)──→ [DLQ]
```

### Key API Operations

| Operation | Description |
|-----------|-------------|
| `SendMessage` | Add message to queue |
| `ReceiveMessage` | Poll for messages (up to 10 at once) |
| `DeleteMessage` | Remove processed message |
| `ChangeMessageVisibility` | Extend visibility timeout if processing takes longer |
| `GetQueueAttributes` | Get queue depth, etc. |
| `PurgeQueue` | Delete ALL messages from queue |

---

## 4. Visibility Timeout

### Concept

When a consumer receives a message, the message becomes **invisible** to other consumers for the visibility timeout duration. This prevents multiple consumers from processing the same message simultaneously.

### Visual Explanation

```
Timeline:                    0s          30s         60s
                             ├───────────┤───────────┤
Consumer A receives msg       ↑ visibility timeout starts
                              Message is INVISIBLE to others

Consumer A finishes at 20s:   ──────────────────→ DeleteMessage() ✓
                              Message gone at 20s

Consumer A crashes at 10s:    ↑──(crash)
                              At 30s: message becomes VISIBLE again
                              Consumer B can receive it

Consumer A processing takes 45s: At 30s message reappears
                              Consumer B also starts processing SAME message!
                              DUPLICATE PROCESSING → Use ChangeMessageVisibility
```

### Visibility Timeout Values

| Setting | Value |
|---------|-------|
| Default | 30 seconds |
| Minimum | 0 seconds |
| Maximum | 12 hours |
| Recommendation | Set to the MAX expected processing time |

### Extending Visibility Timeout During Processing

If processing takes longer than expected, extend the timeout:

```python
import boto3
import json

sqs = boto3.client('sqs', region_name='us-east-1')
QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue'

def process_message(message):
    receipt_handle = message['ReceiptHandle']
    body = json.loads(message['Body'])
    
    # Extend visibility timeout before it expires
    # Call this every ~25 seconds if processing takes longer than 30s
    sqs.change_message_visibility(
        QueueUrl=QUEUE_URL,
        ReceiptHandle=receipt_handle,
        VisibilityTimeout=60  # Extend by 60 more seconds
    )
    
    # Process the message...
    result = do_heavy_processing(body)
    
    # Only delete AFTER successful processing
    sqs.delete_message(
        QueueUrl=QUEUE_URL,
        ReceiptHandle=receipt_handle
    )
```

### Choosing Visibility Timeout

```
Processing time estimate: 45 seconds
Set visibility timeout to: 60 seconds (buffer above max expected)

Processing time varies widely:
- Use ChangeMessageVisibility to extend dynamically
- Start with generous timeout, shrink via API calls
- Maximum single extension: 12 hours
```

### Visibility Timeout and DLQ

The `ReceiveCount` increments each time a consumer receives the message. When `ReceiveCount >= maxReceiveCount` (DLQ setting), the message is moved to DLQ.

If visibility timeout is too short → consumer receives message multiple times before processing completes → ReceiveCount inflates → messages end up in DLQ prematurely.

**Best practice**: Set visibility timeout higher than maximum processing time.

---

## 5. Message Retention Period

### Overview

Messages that are not processed and deleted remain in the queue for the retention period, then are automatically deleted.

| Setting | Value |
|---------|-------|
| Default retention | 4 days |
| Minimum | 60 seconds |
| Maximum | 14 days |

### When Retention Matters

```
Scenario: Consumer service goes down for 3 days
- Retention = 4 days → Messages survive, processed when service recovers ✓
- Retention = 1 day → Messages deleted after 1 day, work is lost ✗
```

**Best practice**: Set retention to maximum (14 days) for critical workloads. The cost is minimal (storage is cheap in SQS).

### Retention vs Visibility Timeout

| Concept | Scope | When it Expires |
|---------|-------|----------------|
| Visibility Timeout | Per-receive | Message returns to queue |
| Retention Period | Queue-wide | Message deleted permanently |

A message can be received and returned to the queue many times within the retention period. Only when retention expires is it permanently deleted (unless manually deleted).

---

## 6. Maximum Message Size (256KB)

### Size Limit Details

| Item | Limit |
|------|-------|
| Maximum message size | 256 KB |
| Includes | Message body + message attributes |
| Each attribute | Up to 256 KB (but total message ≤ 256 KB) |
| For larger messages | Use SQS Extended Client (S3 approach) |

### Why 256KB?

SQS is designed for metadata and small payloads, not file transfers. The architecture optimizes for throughput and durability of small messages.

### Handling Large Payloads

Two patterns:

**Pattern 1: Store in S3, Reference in SQS (Manual)**
```python
import boto3
import json
import uuid

s3 = boto3.client('s3')
sqs = boto3.client('sqs')

def send_large_message(queue_url, large_payload):
    # Store payload in S3
    key = f"sqs-payloads/{uuid.uuid4()}"
    s3.put_object(Bucket='my-payload-bucket', Key=key, Body=json.dumps(large_payload))
    
    # Send reference in SQS
    message = {
        'payload_type': 's3',
        'bucket': 'my-payload-bucket',
        'key': key
    }
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))

def receive_large_message(record):
    body = json.loads(record['body'])
    if body.get('payload_type') == 's3':
        # Retrieve from S3
        response = s3.get_object(Bucket=body['bucket'], Key=body['key'])
        actual_payload = json.loads(response['Body'].read())
        return actual_payload
    return body
```

**Pattern 2: SQS Extended Client Library (Java, automatic)**
See Section 13 for full coverage.

---

## 7. Delivery Delay

### What is Delivery Delay?

A delay before a newly added message becomes visible to consumers. Messages are hidden in the queue during the delay period.

| Setting | Value |
|---------|-------|
| Default delay | 0 seconds |
| Maximum delay | 15 minutes (900 seconds) |
| Queue-level | Default delay for all messages |
| Per-message | Override queue default (Standard only) |

### Use Cases

**Scheduling future processing:**
```python
# Delay an order cancellation check by 5 minutes
# (allows user to cancel within 5 minutes)
sqs.send_message(
    QueueUrl=QUEUE_URL,
    MessageBody=json.dumps({'orderId': 'ORD-123', 'action': 'check_cancellation'}),
    DelaySeconds=300  # 5 minutes
)
```

**Rate limiting burst traffic:**
```python
# Spread out processing over time
for i, item in enumerate(bulk_items):
    delay = min(i * 2, 900)  # 2 second delay per item, max 15 min
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(item),
        DelaySeconds=delay
    )
```

**Retry with backoff:**
```python
# Manual retry with increasing delay
attempt = int(message_attributes.get('attempt', {'StringValue': '0'})['StringValue'])
retry_delay = min(2 ** attempt * 10, 900)  # Exponential backoff, max 15 min
sqs.send_message(
    QueueUrl=QUEUE_URL,
    MessageBody=message_body,
    DelaySeconds=retry_delay,
    MessageAttributes={'attempt': {'DataType': 'Number', 'StringValue': str(attempt + 1)}}
)
```

### Delay Queue vs Visibility Timeout

| Feature | Delivery Delay | Visibility Timeout |
|---------|---------------|-------------------|
| When applied | When message is added | After message is received |
| Message state | Not yet visible | In-flight (invisible) |
| Purpose | Defer processing | Prevent concurrent processing |

---

## 8. Long Polling vs Short Polling

### Short Polling (Default, Avoid!)

Consumer sends `ReceiveMessage` → SQS immediately returns, possibly with 0 messages.

```
Consumer           SQS (distributed, multiple servers)
   |──ReceiveMessage──→ |
   |←──0 messages────── |  (only checked subset of servers)
   |──ReceiveMessage──→ |
   |←──0 messages────── |  (still empty?)
   |──ReceiveMessage──→ |
   |←──1 message─────── |  (finally got one)
```

**Problems with short polling:**
- Costs money for empty responses (charged per API call)
- Wastes CPU and network
- Distributed nature means messages might not be found immediately
- Adds unnecessary load to SQS

### Long Polling (Always Use)

Consumer sends `ReceiveMessage` with `WaitTimeSeconds` → SQS waits up to N seconds for a message to arrive before returning.

```
Consumer           SQS
   |──ReceiveMessage──→ |
   |   (waiting...)     |
   |   (waiting...)     | ← message arrives!
   |←──1 message─────── |  (returns immediately when message available)
   
OR:
   |──ReceiveMessage──→ |
   |   (waiting...)     |
   |   (waiting...)     |
   |←──0 messages────── | ← 20 seconds passed, no message (returns empty)
```

### Configuration

| Setting | Value |
|---------|-------|
| WaitTimeSeconds | 0 = short polling, 1-20 = long polling |
| Recommended | 20 seconds (maximum, most efficient) |
| Queue-level default | Set `ReceiveMessageWaitTimeSeconds` |
| Per-request override | Set `WaitTimeSeconds` in API call |

```python
# Queue-level long polling (set when creating queue)
sqs.create_queue(
    QueueName='MyQueue',
    Attributes={
        'ReceiveMessageWaitTimeSeconds': '20'
    }
)

# Per-request long polling
response = sqs.receive_message(
    QueueUrl=QUEUE_URL,
    MaxNumberOfMessages=10,
    WaitTimeSeconds=20,     # Long poll
    VisibilityTimeout=60
)
```

### When Lambda Polls SQS
Lambda's event source mapping automatically uses long polling. You don't need to configure this manually.

### Cost Comparison

| Scenario | Short Polling | Long Polling |
|---------|--------------|-------------|
| 1,000 polls, 50 have messages | 1,000 API calls | ~50 API calls |
| Cost (approx at $0.40/million) | $0.0004 | $0.00002 |
| CPU/Network waste | High | Minimal |

---

## 9. Dead Letter Queue (DLQ)

### What is a DLQ?

A Dead Letter Queue is a secondary SQS queue where messages that fail processing are moved after exceeding the maximum number of receive attempts.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Main Queue                                │
│                                                                   │
│  Message A ──receive──→ Process ──delete──→ Done ✓              │
│  Message B ──receive──→ fail                                      │
│             ──receive──→ fail                                      │
│             ──receive──→ fail  (ReceiveCount = maxReceiveCount)   │
│             ──────────────────────────────────→ DLQ ✗           │
└──────────────────────────────────────────────────────────────────┘
                                                    ↓
                                        ┌──────────────────┐
                                        │   Dead Letter     │
                                        │     Queue         │
                                        │  Inspect/Replay   │
                                        └──────────────────┘
```

### maxReceiveCount

The maximum number of times a message can be received before being sent to the DLQ.

| Value | Behavior |
|-------|---------|
| 1 | Any failure → DLQ immediately |
| 3 | 3 failures → DLQ |
| 5 (recommended) | Balance between retries and quick DLQ routing |
| 1000 (max) | Message retried up to 1000 times |

### DLQ Requirements

| Queue Type | Required DLQ Type |
|-----------|-------------------|
| Standard Queue | Standard Queue DLQ |
| FIFO Queue | FIFO Queue DLQ |
| Must be in | Same AWS account AND same region |

### Setting Up a DLQ

```python
# 1. Create the DLQ
dlq_response = sqs.create_queue(QueueName='OrderQueue-DLQ')
dlq_arn = sqs.get_queue_attributes(
    QueueUrl=dlq_response['QueueUrl'],
    AttributeNames=['QueueArn']
)['Attributes']['QueueArn']

# 2. Create main queue with redrive policy
import json
sqs.create_queue(
    QueueName='OrderQueue',
    Attributes={
        'RedrivePolicy': json.dumps({
            'deadLetterTargetArn': dlq_arn,
            'maxReceiveCount': '5'  # Move to DLQ after 5 failures
        }),
        'VisibilityTimeout': '60',
        'ReceiveMessageWaitTimeSeconds': '20'
    }
)
```

### DLQ Redrive (Replay)

After fixing the bug that caused messages to fail, you can **redrive** messages from the DLQ back to the source queue for reprocessing.

**Console method**: Select DLQ → "Start DLQ redrive" → choose destination queue.

**Programmatic (move messages back):**
```python
# Move message from DLQ back to source queue
dlq_message = receive_from_dlq()
sqs.send_message(
    QueueUrl=source_queue_url,
    MessageBody=dlq_message['Body']
)
sqs.delete_message(
    QueueUrl=dlq_queue_url,
    ReceiptHandle=dlq_message['ReceiptHandle']
)
```

### DLQ Best Practices

1. **Always create a DLQ** for every production queue
2. **Set CloudWatch Alarm** on DLQ depth (`ApproximateNumberOfMessagesVisible > 0`)
3. **Set retention on DLQ to maximum** (14 days) — you don't want to lose poisoned messages
4. **Never use the DLQ as a DLQ for another DLQ** (no chained DLQs)
5. **Root cause analysis**: Every DLQ message is a bug or data issue that needs investigation

### DLQ Monitoring

```
CloudWatch Alarm:
  Metric: ApproximateNumberOfMessagesVisible
  Queue: OrderQueue-DLQ
  Threshold: > 0
  Period: 1 minute
  Action: SNS notification → PagerDuty/Slack
```

---

## 10. SQS + Lambda: Event Source Mapping

### How It Works

Lambda's **Event Source Mapping** continuously polls the SQS queue and invokes Lambda with batches of messages.

```
SQS Queue
   │
   │ Lambda polls every ~second (long poll, 20s wait)
   ↓
Lambda Event Source Mapping
   │
   │ Invokes Lambda with batch of messages
   ↓
Lambda Function
   │
   ├── Process all records
   ├── Success → SQS auto-deletes ALL messages in batch
   └── Failure → ALL messages return to queue (or partial batch reporting)
```

### Batch Configuration

| Parameter | Description | Range |
|-----------|-------------|-------|
| Batch Size | Messages per Lambda invocation | 1-10,000 |
| Batch Window | Wait time to fill batch | 0-300 seconds |
| Maximum Concurrency | Lambda concurrent executions | 2-1000 |

**Lambda event from SQS:**
```python
def lambda_handler(event, context):
    for record in event['Records']:
        # record is one SQS message
        message_id = record['messageId']
        receipt_handle = record['receiptHandle']
        body = json.loads(record['body'])
        
        # Message attributes
        attributes = record.get('messageAttributes', {})
        
        print(f"Processing message: {message_id}")
        process(body)
    
    # If no exception raised → Lambda ESM deletes all messages
    # If exception raised → all messages return to queue
```

### Error Handling: All-or-Nothing vs Partial Batch Reporting

**Default behavior (All-or-Nothing):**
```
Batch: [msg1, msg2, msg3, msg4, msg5]
msg3 fails → Exception raised
ALL 5 messages return to queue
msg1, msg2, msg4, msg5 processed again (DUPLICATE PROCESSING!)
```

**Partial Batch Response (Recommended):**
```
Lambda returns which messages failed:
{
    "batchItemFailures": [
        {"itemIdentifier": "msg3-messageId"}
    ]
}
Only msg3 returns to queue, others are deleted. ✓
```

**Implementing partial batch response:**
```python
def lambda_handler(event, context):
    batch_item_failures = []
    
    for record in event['Records']:
        try:
            body = json.loads(record['body'])
            process(body)
        except Exception as e:
            print(f"Failed to process {record['messageId']}: {e}")
            batch_item_failures.append({
                "itemIdentifier": record['messageId']
            })
    
    return {"batchItemFailures": batch_item_failures}
```

**Enable in event source mapping:**
```python
lambda_client.create_event_source_mapping(
    EventSourceArn='arn:aws:sqs:us-east-1:123456789012:OrderQueue',
    FunctionName='OrderProcessor',
    BatchSize=10,
    FunctionResponseTypes=['ReportBatchItemFailures'],  # Enable partial batch
    MaximumBatchingWindowInSeconds=5
)
```

### Concurrency and Scaling

- Lambda ESM starts with 1-5 concurrent pollers
- Scales up to `BatchSize * concurrent_executions` messages/sec
- Scales UP quickly when queue fills
- Scales DOWN more slowly to prevent thrashing

### Lambda Reserved Concurrency + SQS

Use reserved concurrency to throttle processing and protect downstream services:
```
Lambda reserved concurrency: 10
→ Maximum 10 concurrent Lambda invocations from SQS
→ Queue buffers excess messages
→ Downstream database protected from overload
```

### FIFO Queue + Lambda

- Lambda ESM supports FIFO queues
- Lambda processes ONE message group at a time (preserves ordering within group)
- Different message groups can be processed in parallel

---

## 11. SQS + Auto Scaling

### Why Scale Based on Queue Depth?

```
Queue depth → represents backlog of work to be done
More work in queue → scale up consumers
Queue draining → scale down consumers
```

### Scaling Metric: ApproximateNumberOfMessagesVisible

This CloudWatch metric tells you how many messages are waiting (not in-flight) in the queue.

```
High ApproximateNumberOfMessagesVisible → Queue backing up → Scale OUT consumers
Low ApproximateNumberOfMessagesVisible → Queue drained → Scale IN consumers
```

### Setup: EC2 Auto Scaling Group Based on SQS

**Step 1: Create CloudWatch Alarm**
```
Metric: ApproximateNumberOfMessagesVisible
Queue: OrderProcessingQueue
Threshold (scale out): > 100 messages
Threshold (scale in): < 10 messages
Period: 1 minute
```

**Step 2: Create Auto Scaling Policy**
```
Scale Out Policy:
  Trigger: Queue depth > 100
  Action: Add 2 instances
  Cooldown: 60 seconds

Scale In Policy:
  Trigger: Queue depth < 10
  Action: Remove 1 instance
  Cooldown: 300 seconds
```

**CloudFormation Auto Scaling Policy:**
```yaml
ScaleOutPolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    AutoScalingGroupName: !Ref OrderProcessorsASG
    PolicyType: StepScaling
    StepAdjustments:
      - MetricIntervalLowerBound: 0
        MetricIntervalUpperBound: 500
        ScalingAdjustment: 2
      - MetricIntervalLowerBound: 500
        ScalingAdjustment: 5
```

### Target Tracking for SQS

Better approach: target tracking scales to maintain a specific backlog per instance:

```
Target: 10 messages per EC2 instance
2 instances → can handle 20 messages backlog
Queue has 50 messages → need 5 instances (50/10)
```

**Custom metric: `BacklogPerInstance`**
```
BacklogPerInstance = ApproximateNumberOfMessagesVisible / RunningInstances
```

Auto scaling adjusts instance count so `BacklogPerInstance ≈ target`.

### Lambda + SQS Auto Scaling

Lambda auto-scales automatically (no configuration needed). The Event Source Mapping handles polling and concurrency scaling. Use `Maximum Concurrency` to set an upper limit.

---

## 12. FIFO Queue Deep Dive

### Message Group ID

`MessageGroupId` is a tag that groups related messages. All messages with the same `MessageGroupId` are processed in strict FIFO order. Messages in DIFFERENT groups can be processed in parallel.

```
Group: order-001  [msg1] → [msg2] → [msg3]   (strictly ordered)
Group: order-002  [msg1] → [msg2]             (strictly ordered, parallel to order-001)
Group: order-003  [msg1]                      (independent)
```

```python
# Producer: ensure related messages go to same group
sqs.send_message(
    QueueUrl=FIFO_QUEUE_URL,
    MessageBody=json.dumps({'orderId': 'ORD-001', 'status': 'CREATED'}),
    MessageGroupId='ORD-001',
    MessageDeduplicationId='ORD-001-CREATED'
)

sqs.send_message(
    QueueUrl=FIFO_QUEUE_URL,
    MessageBody=json.dumps({'orderId': 'ORD-001', 'status': 'PAID'}),
    MessageGroupId='ORD-001',
    MessageDeduplicationId='ORD-001-PAID'
)
# PAID will always be processed after CREATED for ORD-001
```

### Message Deduplication ID

FIFO queues prevent duplicate processing within a **5-minute deduplication window**. Two methods:

**Method 1: Explicit MessageDeduplicationId**
```python
sqs.send_message(
    QueueUrl=FIFO_QUEUE_URL,
    MessageBody=json.dumps(order_data),
    MessageGroupId=f"order-{order_id}",
    MessageDeduplicationId=f"order-{order_id}-{event_type}-{timestamp}"
)
# If same MessageDeduplicationId sent again within 5 min → silently discarded
```

**Method 2: Content-Based Deduplication**
Enable on queue: `ContentBasedDeduplication = True`
SQS computes SHA-256 hash of message body → same body within 5 minutes → discarded.

```python
sqs.create_queue(
    QueueName='OrderQueue.fifo',
    Attributes={
        'FifoQueue': 'true',
        'ContentBasedDeduplication': 'true'
    }
)
# No need to set MessageDeduplicationId in send_message
```

### FIFO vs Standard: Processing Behavior

```
Standard queue: Consumer A and Consumer B can process same message simultaneously
(solved by: make processing idempotent)

FIFO queue: Only one consumer processes a message group at a time
(message group blocked until current message is deleted)
```

### FIFO Queue Naming

```
# MUST end in .fifo
VALID:   OrderQueue.fifo
VALID:   order-events.fifo
INVALID: OrderQueue
INVALID: OrderQueue.FIFO  (case sensitive!)
```

---

## 13. SQS Extended Client

### What Problem Does It Solve?

SQS messages have a 256 KB size limit. Some use cases require larger payloads:
- Large XML/JSON documents
- PDF reports
- CSV data files
- Image metadata with base64 content (should use S3 reference instead)

### How It Works

The SQS Extended Client Library (officially Java, also community Python) automatically:
1. Checks if message exceeds threshold (default 256 KB)
2. Stores message body in S3
3. Sends SQS message containing only the S3 reference
4. On receive, transparently fetches from S3

### Architecture

```
Producer                   SQS                    Consumer
   │                        │                          │
   │  Large message (1MB)   │                          │
   │──store in S3──────────────────────────────────────│
   │  S3 Reference msg────→ │                          │
   │                        │  ←──receive S3 ref──────│
   │                        │                          │─→ fetch from S3
   │                        │                          │   process full payload
```

### Python Implementation (Manual)

```python
import boto3
import json
import uuid

s3 = boto3.client('s3')
sqs = boto3.client('sqs')

BUCKET_NAME = 'sqs-large-payloads'
QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue'
SIZE_THRESHOLD = 256 * 1024  # 256 KB

def send_message_extended(payload: dict) -> None:
    message_body = json.dumps(payload)
    message_bytes = message_body.encode('utf-8')
    
    if len(message_bytes) > SIZE_THRESHOLD:
        # Store in S3
        s3_key = f"sqs-payloads/{uuid.uuid4()}.json"
        s3.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=message_bytes)
        
        # Send reference
        reference = {
            'S3BucketName': BUCKET_NAME,
            'S3Key': s3_key,
            'isLargePayload': True
        }
        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(reference))
    else:
        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=message_body)

def receive_message_extended(sqs_record: dict) -> dict:
    body = json.loads(sqs_record['body'])
    
    if body.get('isLargePayload'):
        response = s3.get_object(Bucket=body['S3BucketName'], Key=body['S3Key'])
        actual_payload = json.loads(response['Body'].read())
        
        # Clean up S3 after successful processing (optional: do after delete from SQS)
        s3.delete_object(Bucket=body['S3BucketName'], Key=body['S3Key'])
        
        return actual_payload
    return body
```

### S3 Lifecycle Policy for Cleanup

Set a lifecycle policy on the S3 bucket to auto-delete objects after N days as a safety net:
```json
{
  "Rules": [{
    "Status": "Enabled",
    "Filter": {"Prefix": "sqs-payloads/"},
    "Expiration": {"Days": 7}
  }]
}
```

---

## 14. Security

### Encryption

**In-Transit**: HTTPS endpoints always encrypt data in transit.

**At-Rest (SSE-SQS):**
```
Default encryption using SQS-managed keys
Transparent — no configuration of KMS needed
Enabled by default on new queues (as of 2023)
```

**At-Rest (SSE-KMS):**
```
Use your own Customer Managed Key (CMK)
Full key management: rotation, access control, audit trail
Required for compliance: HIPAA, PCI DSS, etc.
```

**Enabling KMS encryption:**
```python
sqs.create_queue(
    QueueName='SecureOrderQueue',
    Attributes={
        'KmsMasterKeyId': 'alias/my-sqs-key',
        'KmsDataKeyReusePeriodSeconds': '300'
    }
)
```

`KmsDataKeyReusePeriodSeconds`: How often SQS calls KMS for a new data key (default 300 seconds, range 60-86400). Lower = more KMS calls = more cost but better security. Higher = fewer calls but data key reused longer.

### Access Policies (Resource Policies)

**Allow another account to send messages:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::PARTNER-ACCOUNT:root"
      },
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:123456789012:OrderQueue"
    }
  ]
}
```

**Allow SNS to send messages:**
```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "sns.amazonaws.com"},
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:123456789012:OrderQueue",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:sns:us-east-1:123456789012:OrderEvents"
        }
      }
    }
  ]
}
```

### IAM Policies (Identity Policies)

For same-account access, use IAM roles:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:OrderQueue"
    }
  ]
}
```

### VPC Endpoints

Access SQS from within a VPC without internet traffic:
```
EC2/Lambda (private subnet) → VPC Endpoint → SQS
                                (no internet gateway needed)
```

---

## 15. Hands-On: Decoupled Order Processing System

### Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Decoupled Order Processing System                      │
│                                                                               │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │ API Gateway  │───→│ Lambda: Submit  │───→│ SQS: OrderQueue (FIFO)     │  │
│  │ POST /orders │    │ Order           │    │  MessageGroupId = customerId │  │
│  └──────────────┘    └─────────────────┘    └──────────────┬──────────────┘  │
│                                                             │                 │
│                              ┌──────────────────────────────┘                │
│                              ▼                                                │
│                    ┌─────────────────────┐                                    │
│                    │ Lambda: Process     │                                    │
│                    │ Order (ESM)         │                                    │
│                    │ - Validate order    │                                    │
│                    │ - Charge payment    │──→ ┌──────────────────────────┐   │
│                    │ - Update inventory  │    │ SNS: OrderEventsTopic    │   │
│                    │ - Publish to SNS    │    └────────────┬─────────────┘   │
│                    └─────────────────────┘                 │                 │
│                                                ┌───────────┼───────────┐    │
│                                                ▼           ▼           ▼    │
│                                          ┌──────────┐ ┌──────────┐ ┌──────┐ │
│                                          │SQS:Email │ │SQS:Wrhse │ │SQS:  │ │
│                                          │Queue     │ │Queue     │ │Audit │ │
│                                          └─────┬────┘ └────┬─────┘ └───┬──┘ │
│                                                │           │           │    │
│                                                ▼           ▼           ▼    │
│                                          ┌──────────┐ ┌──────────┐ ┌──────┐ │
│                                          │Lambda:   │ │Lambda:   │ │Lambda│ │
│                                          │Send SES  │ │Update DB │ │→ S3  │ │
│                                          └──────────┘ └──────────┘ └──────┘ │
│                                                                               │
│   ┌─────────────────────────────┐                                            │
│   │ OrderQueue-DLQ (FIFO)       │ ← Failed orders after 3 retries            │
│   │ CloudWatch Alarm: depth > 0 │                                            │
│   └─────────────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Code: Order Submission Lambda

```python
import boto3
import json
import uuid
from datetime import datetime

sqs = boto3.client('sqs', region_name='us-east-1')
ORDER_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/OrderQueue.fifo'

def lambda_handler(event, context):
    try:
        order_data = json.loads(event['body'])
        
        # Validate required fields
        required_fields = ['customerId', 'items', 'shippingAddress']
        for field in required_fields:
            if field not in order_data:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': f'Missing required field: {field}'})
                }
        
        order_id = str(uuid.uuid4())
        order = {
            'orderId': order_id,
            'customerId': order_data['customerId'],
            'items': order_data['items'],
            'shippingAddress': order_data['shippingAddress'],
            'submittedAt': datetime.utcnow().isoformat(),
            'status': 'SUBMITTED'
        }
        
        # Submit to FIFO queue
        # MessageGroupId = customerId ensures orders from same customer are ordered
        sqs.send_message(
            QueueUrl=ORDER_QUEUE_URL,
            MessageBody=json.dumps(order),
            MessageGroupId=order_data['customerId'],
            MessageDeduplicationId=order_id  # Idempotency: same orderId = same dedup
        )
        
        return {
            'statusCode': 202,
            'body': json.dumps({
                'orderId': order_id,
                'status': 'SUBMITTED',
                'message': 'Order queued for processing'
            })
        }
    except Exception as e:
        print(f"Error: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal error'})}
```

### Code: Order Processing Lambda

```python
import boto3
import json

sns = boto3.client('sns')
dynamodb = boto3.resource('dynamodb')
orders_table = dynamodb.Table('Orders')
ORDER_EVENTS_TOPIC = 'arn:aws:sns:us-east-1:123456789012:OrderEventsTopic'

def lambda_handler(event, context):
    batch_item_failures = []
    
    for record in event['Records']:
        try:
            order = json.loads(record['body'])
            
            # 1. Validate inventory
            check_inventory(order['items'])
            
            # 2. Process payment
            payment_result = process_payment(order)
            
            # 3. Update order status in DynamoDB
            orders_table.put_item(Item={
                'orderId': order['orderId'],
                'customerId': order['customerId'],
                'status': 'PROCESSING',
                'paymentId': payment_result['paymentId'],
                'items': order['items']
            })
            
            # 4. Publish event to SNS for fan-out
            sns.publish(
                TopicArn=ORDER_EVENTS_TOPIC,
                Message=json.dumps(order),
                MessageAttributes={
                    'eventType': {'DataType': 'String', 'StringValue': 'ORDER_CONFIRMED'},
                    'customerId': {'DataType': 'String', 'StringValue': order['customerId']}
                }
            )
            
            print(f"Successfully processed order {order['orderId']}")
            
        except InsufficientInventoryError as e:
            print(f"Inventory error for {record['messageId']}: {e}")
            batch_item_failures.append({'itemIdentifier': record['messageId']})
        except PaymentFailedError as e:
            print(f"Payment error for {record['messageId']}: {e}")
            batch_item_failures.append({'itemIdentifier': record['messageId']})
        except Exception as e:
            print(f"Unexpected error for {record['messageId']}: {e}")
            batch_item_failures.append({'itemIdentifier': record['messageId']})
    
    return {'batchItemFailures': batch_item_failures}
```

---

## 16. Interview Q&A

---

**Q1: What is SQS and how does it help with decoupling?**

**A:** SQS is a managed message queue service that stores messages until consumers retrieve and process them. It decouples producers from consumers: the producer writes to the queue and continues, regardless of whether the consumer is running or available. The consumer processes at its own pace.

Decoupling benefits: (1) Independent failure — producer succeeds even if consumer is down; (2) Independent scaling — consumer scales based on queue depth, not producer traffic; (3) Independent deployment — producer and consumer can be deployed separately; (4) Buffering — absorbs traffic spikes without overwhelming downstream systems.

---

**Q2: What is the difference between Standard and FIFO queues in SQS?**

**A:** Standard queues offer nearly unlimited throughput but with best-effort ordering and at-least-once delivery (duplicates possible). FIFO queues guarantee strict message ordering within a message group and exactly-once processing, but are limited to 300 msg/sec (3,000 with batching) and cost more.

Choose Standard when order doesn't matter and throughput is important (image processing, email dispatch). Choose FIFO when order is business-critical (financial transactions, order state machine, inventory updates where sequence prevents overselling).

---

**Q3: Explain visibility timeout. What happens if it's set too low?**

**A:** Visibility timeout is the period during which a received message is hidden from other consumers. When Consumer A receives a message, it becomes invisible for this duration. If Consumer A deletes the message before timeout → message gone permanently. If Consumer A fails or takes too long → timeout expires, message becomes visible, Consumer B receives it.

If set too low: Consumer A may still be processing when the timeout expires, causing Consumer B to receive the same message — DUPLICATE PROCESSING. Best practice: set visibility timeout higher than maximum expected processing time. Use `ChangeMessageVisibility` to extend it dynamically if processing takes longer than expected.

---

**Q4: What is a Dead Letter Queue and how do you configure it?**

**A:** A DLQ is a separate queue where messages that fail processing are sent after exceeding `maxReceiveCount` attempts. Each time a message is received without being deleted, its `ReceiveCount` increments. When `ReceiveCount >= maxReceiveCount`, the message is moved to the DLQ instead of the main queue.

Configure by setting the `RedrivePolicy` attribute on the main queue with the DLQ's ARN and `maxReceiveCount`. The DLQ must be the same type (Standard→Standard, FIFO→FIFO) and in the same account/region.

Operational practice: Set CloudWatch alarm on DLQ depth > 0 to alert on failures. Set DLQ retention to 14 days. After fixing the root cause, use DLQ redrive to replay messages.

---

**Q5: What is long polling and why should you always use it?**

**A:** Long polling (`WaitTimeSeconds` = 1-20) makes the `ReceiveMessage` API call wait up to N seconds for a message to arrive before returning, rather than returning immediately with 0 messages. With short polling, SQS checks only a subset of servers and returns immediately — most calls return empty responses.

Benefits of long polling: fewer API calls (each empty poll costs money), lower CPU waste, fewer false empty responses (long polling checks all servers), lower end-to-end latency (message returned as soon as available rather than next poll cycle).

Always set `ReceiveMessageWaitTimeSeconds=20` on queues. Lambda's event source mapping uses long polling automatically.

---

**Q6: How does SQS + Lambda event source mapping work? What happens on failure?**

**A:** Lambda's ESM polls the SQS queue (long poll), accumulates messages up to the batch size or batch window, then synchronously invokes Lambda with a batch as `Records`. If Lambda succeeds (no exception), ESM deletes all messages in the batch. If Lambda throws an exception, all messages return to the queue (ReceiveCount incremented for each).

This all-or-nothing behavior can cause duplicate processing if only some messages fail. Solution: Enable `ReportBatchItemFailures` and return `{"batchItemFailures": [...]}` from Lambda with the IDs of failed messages. Only those specific messages return to the queue; successfully processed ones are deleted.

---

**Q7: How do you use SQS to trigger Auto Scaling of EC2 instances?**

**A:** Monitor the `ApproximateNumberOfMessagesVisible` CloudWatch metric (queue backlog). Create step scaling or target tracking policies on an EC2 Auto Scaling Group based on this metric. Scale out when the backlog exceeds a threshold, scale in when it decreases.

Better approach: Use a custom metric `BacklogPerInstance = ApproximateNumberOfMessagesVisible / RunningInstances` and a target tracking policy to maintain N messages per instance. This proportionally scales instances to queue depth. For Lambda, this is unnecessary — Lambda ESM auto-scales up to the configured maximum concurrency.

---

**Q8: What is the MessageGroupId and MessageDeduplicationId in FIFO queues?**

**A:** `MessageGroupId` is a tag that creates ordering groups. All messages with the same group ID are delivered in strict FIFO order. Different group IDs can be processed in parallel. Design group IDs around your business entity (orderId, customerId, accountId) to parallelize work while maintaining per-entity ordering.

`MessageDeduplicationId` prevents duplicate processing within a 5-minute window. If the same ID is published twice within 5 minutes, the second is silently discarded. Use explicit IDs based on the idempotency key of the operation (orderId + eventType + timestamp). Alternative: enable content-based deduplication (SHA-256 hash of body used as the dedup ID) on the queue.

---

**Q9: What is the SQS Extended Client and when is it needed?**

**A:** SQS has a 256 KB message size limit. The Extended Client Library works around this by automatically storing large message bodies in S3 and putting an S3 reference in the SQS message. Consumers transparently fetch the payload from S3.

Needed when: processing large documents, forwarding large event payloads, or any case where the serialized message exceeds 256 KB. Considerations: S3 costs, S3 cleanup (lifecycle policy for orphaned objects if consumer fails), S3 latency for each large message, and ensuring S3 permissions are correct for both producer and consumer. For Python, implement manually (the official Java client has automatic support).

---

**Q10: How does SQS handle encryption and what are the security options?**

**A:** Three levels: (1) In-transit: always HTTPS, no configuration needed. (2) SSE-SQS: AWS-managed encryption at rest using SQS's own keys, transparent, now enabled by default on new queues. (3) SSE-KMS: customer-managed CMK via KMS, required for compliance (HIPAA, PCI DSS), allows key rotation control, audit trails in CloudTrail, and IAM-based key access control.

For cross-account access, use SQS resource policies (queue policies) granting `sqs:SendMessage` to the external principal. For Lambda or SQS accessing an encrypted queue, the IAM role needs `kms:Decrypt` on the KMS key. Use VPC endpoints to route SQS traffic through the VPC backbone without traversing the internet.

---

**Q11: What is the delivery delay in SQS and how is it different from visibility timeout?**

**A:** Delivery delay (`DelaySeconds`) postpones the initial visibility of a newly added message. The message exists in the queue but is invisible for the delay period. Visibility timeout hides a message that has already been received. Delivery delay affects a message's first appearance; visibility timeout affects it after each receive.

Use delivery delay for: deferring processing (allow user cancellation window), spreading load over time, implementing simple scheduling (up to 15 minutes). For longer delays, use EventBridge Scheduler or Step Functions Wait state.

---

**Q12: Describe how you would design a fault-tolerant order processing system using SQS.**

**A:** Architecture: API Gateway → Lambda (submit) → SQS FIFO OrderQueue → Lambda (process, ESM) → SNS (fan-out) → [Email SQS, Warehouse SQS, Audit SQS]. Key design decisions:

(1) FIFO queue with `MessageGroupId=customerId` ensures per-customer ordering while different customers are processed in parallel. (2) DLQ on OrderQueue with `maxReceiveCount=3` catches poison messages; CloudWatch alarm on DLQ depth notifies ops team. (3) Partial batch response in processing Lambda ensures individual failures don't cause entire batch reprocessing. (4) Lambda idempotency — use orderId as idempotency key; check DynamoDB before processing to skip already-processed orders. (5) Visibility timeout set to 5 minutes (exceed max processing time). (6) SNS fan-out with SQS subscriptions ensures each downstream service processes independently and has its own DLQ. (7) S3 Extended Client if order payloads could exceed 256 KB.

---

**Q13: What is the maximum message size in SQS and what are your options when exceeded?**

**A:** 256 KB (262,144 bytes) including the message body and all message attributes. Options when exceeded: (1) Store payload in S3, put S3 reference (bucket + key) in SQS message — implement transparently or use Extended Client Library; (2) Compress the payload (gzip) before sending — if still too large, combine with S3; (3) Redesign the message to contain only a reference ID and have consumers fetch data from source (DynamoDB, RDS); (4) Split into multiple smaller messages if the data is naturally divisible.

---

**Q14: How does SQS handle concurrent consumers reading from the same queue?**

**A:** SQS uses the visibility timeout to prevent two consumers from processing the same message. When Consumer A receives a message, it becomes invisible to all other consumers for the visibility timeout duration. Consumer B polling the same queue will not receive that message until the timeout expires.

For competing consumers (multiple EC2 instances or Lambda concurrent invocations polling the same queue): they all poll, but SQS ensures each message is delivered to only one consumer at a time. This is the competing consumers pattern — natural load balancing. Multiple consumers increase throughput by processing different messages in parallel. The queue becomes the coordination mechanism without consumers needing to know about each other.

---

**Q15: What metrics should you monitor for SQS queues in production?**

**A:** Key metrics: (1) `ApproximateNumberOfMessagesVisible` — queue backlog depth; high value means consumers aren't keeping up; use for auto scaling. (2) `ApproximateAgeOfOldestMessage` — oldest unprocessed message age; high value means processing is backed up; set alarm if age exceeds acceptable SLA (e.g., > 1 hour). (3) `NumberOfMessagesSent` — throughput into the queue. (4) `NumberOfMessagesDeleted` — successful processing rate. (5) `ApproximateNumberOfMessagesNotVisible` — messages currently in flight; high value indicates slow processing or visibility timeout issues. (6) DLQ `ApproximateNumberOfMessagesVisible` — alarm at > 0 (any DLQ message = problem). (7) Lambda ESM errors, throttles, and duration if using Lambda as consumer.

---

*End of Amazon SQS Complete Guide*
