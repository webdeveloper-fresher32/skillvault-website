# Amazon SNS - Complete Guide

## Table of Contents
1. [What is SNS and the Pub/Sub Pattern](#1-what-is-sns-and-the-pubsub-pattern)
2. [Topics: Standard vs FIFO](#2-topics-standard-vs-fifo)
3. [Publishers and Subscribers](#3-publishers-and-subscribers)
4. [Subscription Protocols](#4-subscription-protocols)
5. [Message Filtering with FilterPolicy](#5-message-filtering-with-filterpolicy)
6. [Message Structure and Attributes](#6-message-structure-and-attributes)
7. [SNS + SQS Fan-Out Pattern](#7-sns--sqs-fan-out-pattern)
8. [Message Delivery Retry Policy and DLQ](#8-message-delivery-retry-policy-and-dlq)
9. [SNS FIFO: Ordering and Deduplication](#9-sns-fifo-ordering-and-deduplication)
10. [Mobile Push Notifications](#10-mobile-push-notifications)
11. [Encryption with KMS](#11-encryption-with-kms)
12. [Access Policies](#12-access-policies)
13. [Interview Q&A](#13-interview-qa)

---

## 1. What is SNS and the Pub/Sub Pattern

### Definition
Amazon Simple Notification Service (SNS) is a fully managed pub/sub (publish-subscribe) messaging service for both application-to-application (A2A) and application-to-person (A2P) communication.

### The Pub/Sub Pattern

The publish-subscribe pattern decouples message producers (publishers) from message consumers (subscribers). Publishers do not need to know who is consuming their messages.

```
                        ┌─────────────────────┐
                        │    SNS Topic         │
                        │                      │
Publisher ──publish──→  │  Topic ARN:          │──→ Subscriber 1 (Lambda)
(Any AWS service       │  arn:aws:sns:...     │──→ Subscriber 2 (SQS Queue)
  or application)      │                      │──→ Subscriber 3 (Email)
                        │                      │──→ Subscriber 4 (HTTP endpoint)
                        └─────────────────────┘
                         One message → delivered to ALL subscribers
```

### Key Characteristics
- **Push-based**: SNS pushes messages to subscribers (vs SQS which requires polling)
- **Fan-out**: One message can reach many subscribers simultaneously
- **Durable**: Messages are stored redundantly across multiple AZs
- **Scalable**: No provisioning needed, handles millions of messages per second

### Real-World Analogy
SNS is like a news broadcaster. One journalist (publisher) publishes a story, and all subscribers (newspapers, TV channels, apps) receive the same story simultaneously. Each subscriber can independently decide what to do with it.

### SNS vs SQS Quick Comparison

| Feature | SNS | SQS |
|---------|-----|-----|
| Pattern | Push (pub/sub) | Pull (queue) |
| Consumers | Multiple (fan-out) | Single or competing consumers |
| Message persistence | No (must be consumed immediately or lost) | Yes (up to 14 days) |
| Processing guarantee | Best-effort delivery | At-least-once delivery |
| Use case | Fan-out notifications | Decoupled work queue |

---

## 2. Topics: Standard vs FIFO

### Standard Topic

| Property | Value |
|----------|-------|
| Throughput | Nearly unlimited (100,000+ msg/sec) |
| Ordering | Best-effort (not guaranteed) |
| Delivery | At-least-once (possible duplicates) |
| Subscribers | SQS, Lambda, HTTP/S, Email, SMS, Mobile Push, Kinesis Firehose |
| Use case | High throughput, order doesn't matter |

### FIFO Topic

| Property | Value |
|----------|-------|
| Throughput | 300 msg/sec (or 10 MB/sec) |
| Ordering | Strict (within message group) |
| Delivery | Exactly-once processing |
| Subscribers | SQS FIFO only |
| Use case | Ordered events, transactional systems |
| Naming | Must end in `.fifo` |

### FIFO Topic Naming Requirement
```
Standard:  my-notifications
FIFO:      my-notifications.fifo
```

### When to Use Each

**Standard Topic:**
- User signup → send welcome email + create Stripe customer + provision resources
- Order placed → notify warehouse + update inventory + send confirmation
- Image uploaded → generate thumbnails in different sizes

**FIFO Topic:**
- Financial transactions where order matters
- Inventory updates where sequence is critical
- E-commerce order state machine (created → paid → shipped → delivered)

---

## 3. Publishers and Subscribers

### Publishers (Who Can Send to SNS)

Any AWS service or application can publish to SNS:
- **Application code** via AWS SDK
- **AWS Services**: CloudWatch Alarms, S3 event notifications, CodeCommit, CloudFormation, EC2 Auto Scaling, RDS, Budgets, DynamoDB Streams
- **Other Lambda functions**
- **AWS IoT**

**Publishing via AWS SDK (Python):**
```python
import boto3
import json

sns_client = boto3.client('sns', region_name='us-east-1')

response = sns_client.publish(
    TopicArn='arn:aws:sns:us-east-1:123456789012:OrderEvents',
    Message=json.dumps({
        'orderId': 'ORD-123',
        'customerId': 'CUST-456',
        'status': 'CREATED',
        'amount': 99.99
    }),
    Subject='New Order Created',
    MessageAttributes={
        'orderType': {
            'DataType': 'String',
            'StringValue': 'premium'
        },
        'region': {
            'DataType': 'String',
            'StringValue': 'us-east-1'
        }
    }
)

print(f"Message published: {response['MessageId']}")
```

### Subscribers (Who Can Receive from SNS)

| Subscriber | Description |
|-----------|-------------|
| Amazon SQS | Push to SQS queue |
| AWS Lambda | Invoke Lambda function |
| HTTP/HTTPS | POST to HTTP endpoint |
| Email | Plain text email |
| Email-JSON | JSON formatted email |
| SMS | Text message to phone |
| Platform Application | Mobile push (iOS, Android) |
| Amazon Kinesis Data Firehose | Stream to S3/Redshift/Elasticsearch |

### Subscription Confirmation

For HTTP/HTTPS and Email subscriptions, the subscriber must **confirm** the subscription:
1. SNS sends a confirmation message with a token
2. Subscriber must visit the SubscribeURL (HTTP) or click the link (Email)
3. Only then does SNS deliver actual messages

Lambda, SQS, and Firehose subscriptions are automatically confirmed.

---

## 4. Subscription Protocols

### Email / Email-JSON
```
- Email: sends plain text
- Email-JSON: sends the full SNS message envelope as JSON
- Confirmation required: Yes (must click confirmation link)
- Use: Alert notifications, monitoring alerts
- Limitation: Manual confirmation, not suitable for automated processing
```

### HTTP/HTTPS
```
- SNS makes POST request to your endpoint
- Request body: SNS message JSON
- Confirmation required: Yes (must respond to SubscribeURL)
- Retry policy: configurable (see Section 8)
- Use: Webhooks, external services
```

**HTTP/HTTPS message body:**
```json
{
  "Type": "Notification",
  "MessageId": "abc123-def456",
  "TopicArn": "arn:aws:sns:us-east-1:123456789012:OrderEvents",
  "Subject": "New Order",
  "Message": "{\"orderId\": \"ORD-123\"}",
  "Timestamp": "2026-06-08T10:00:00.000Z",
  "SignatureVersion": "1",
  "Signature": "EXAMPLE...",
  "SigningCertURL": "https://sns.us-east-1.amazonaws.com/...",
  "UnsubscribeURL": "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&..."
}
```

### Amazon SQS
```
- SNS pushes message JSON to SQS queue
- SQS stores the message (durable)
- Consumer polls SQS at own pace
- Confirmation: Automatic
- Use: Fan-out to workers, decoupling, buffering
- Most common subscription type for application integration
```

**SNS message wrapped in SQS body:**
```json
{
  "Records": [
    {
      "body": "{\"Type\":\"Notification\",\"MessageId\":\"abc\",\"TopicArn\":\"arn:aws:sns:...\",\"Message\":\"{\\\"orderId\\\":\\\"ORD-123\\\"}\"}",
      "receiptHandle": "...",
      "messageId": "..."
    }
  ]
}
```

Note: The actual payload is double-serialized! `Records[0].body` is a string containing JSON, and inside that JSON, `Message` is another string containing JSON.

### AWS Lambda
```
- SNS directly invokes Lambda function
- Asynchronous invocation (Lambda processes independently)
- Lambda receives SNS message as event
- Confirmation: Automatic
- Use: Real-time processing, transformations, routing
```

**Lambda event from SNS:**
```json
{
  "Records": [
    {
      "EventSource": "aws:sns",
      "EventVersion": "1.0",
      "EventSubscriptionArn": "arn:aws:sns:us-east-1:...:MyTopic:abc123",
      "Sns": {
        "Type": "Notification",
        "MessageId": "abc123",
        "TopicArn": "arn:aws:sns:us-east-1:123456789012:OrderEvents",
        "Subject": "New Order",
        "Message": "{\"orderId\": \"ORD-123\", \"amount\": 99.99}",
        "Timestamp": "2026-06-08T10:00:00.000Z",
        "Attributes": {
          "ApproximateFirstReceiveTimestamp": "1749373200000",
          "ApproximateReceiveCount": "1"
        },
        "MessageAttributes": {
          "orderType": {
            "Type": "String",
            "Value": "premium"
          }
        }
      }
    }
  ]
}
```

**Parsing SNS message in Lambda:**
```python
import json

def lambda_handler(event, context):
    for record in event['Records']:
        sns_message = json.loads(record['Sns']['Message'])
        order_id = sns_message['orderId']
        amount = sns_message['amount']
        print(f"Processing order {order_id} for ${amount}")
```

### SMS
```
- Send text messages to phone numbers
- Opt-in required for transactional SMS
- Two types: Promotional (bulk, lower cost) and Transactional (immediate delivery)
- Character limit: 140 bytes per SMS (longer messages split into multiple)
- Supported countries: varies
- Cost: Per SMS, varies by country
```

### Amazon Kinesis Data Firehose
```
- Stream SNS messages directly to:
  - Amazon S3
  - Amazon Redshift (via S3)
  - Amazon OpenSearch Service
  - Datadog, Splunk, etc.
- Use: Log aggregation, analytics pipelines, archiving
- Confirmation: Automatic
- No Lambda needed for data streaming to S3
```

### Mobile Push (Platform Application)
See Section 10 for detailed coverage.

---

## 5. Message Filtering with FilterPolicy

### What is Message Filtering?

By default, every subscriber receives every message published to the topic. FilterPolicy allows subscribers to receive only messages that match certain criteria.

This is set on the **subscription**, not the topic. Each subscription can have its own filter.

### Filter Policy Basics

Filter policies match against **message attributes**.

```
SNS Topic: OrderEvents
├── Subscription 1 (Lambda-PremiumOrders)  ← filter: orderType = "premium"
├── Subscription 2 (SQS-StandardOrders)    ← filter: orderType = "standard"
├── Subscription 3 (Lambda-AllOrders)      ← no filter (receives all)
└── Subscription 4 (Email-HighValue)       ← filter: amount >= 1000
```

### Filter Policy Syntax

**String matching:**
```json
{
  "orderType": ["premium", "enterprise"],
  "status": ["CREATED", "UPDATED"]
}
```
Matches messages where `orderType` is "premium" OR "enterprise" AND `status` is "CREATED" OR "UPDATED".

**Numeric matching:**
```json
{
  "amount": [{"numeric": [">=", 100, "<", 1000]}]
}
```
Matches messages where `amount` is between 100 (inclusive) and 1000 (exclusive).

**Prefix matching:**
```json
{
  "customerId": [{"prefix": "CUST-US-"}]
}
```

**Anything-but (blacklist):**
```json
{
  "status": [{"anything-but": ["CANCELLED", "FAILED"]}]
}
```

**Exists check:**
```json
{
  "discount": [{"exists": true}]
}
```
Matches only messages that have the `discount` attribute.

### Complex Filter Example

```python
# Publishing with attributes for filtering
sns_client.publish(
    TopicArn='arn:aws:sns:us-east-1:123456789012:OrderEvents',
    Message=json.dumps({'orderId': 'ORD-123', 'amount': 1500}),
    MessageAttributes={
        'orderType': {'DataType': 'String', 'StringValue': 'premium'},
        'region': {'DataType': 'String', 'StringValue': 'us-east'},
        'amount': {'DataType': 'Number', 'StringValue': '1500'},
        'priority': {'DataType': 'String', 'StringValue': 'high'}
    }
)

# Subscription filter (SQS for high-value premium orders):
filter_policy = {
    "orderType": ["premium"],
    "amount": [{"numeric": [">=", 1000]}],
    "region": ["us-east", "us-west"]
}
```

### Filter Policy Scope (New Feature)
By default, filters apply to **message attributes**. With `FilterPolicyScope = MessageBody`, filters can apply to the **message body** (JSON payload).

```json
// Filter on message body
{
  "order": {
    "status": ["CREATED"]
  }
}
```

---

## 6. Message Structure and Attributes

### Message Size Limits
- Maximum message size: **256 KB**
- For larger payloads: Use SNS Extended Client Library (stores payload in S3, sends S3 reference)

### Message Structure

```json
{
  "Type": "Notification",
  "MessageId": "unique-message-id",
  "TopicArn": "arn:aws:sns:us-east-1:123456789012:MyTopic",
  "Subject": "Optional subject line",
  "Message": "The actual message payload (string)",
  "Timestamp": "2026-06-08T10:00:00.000Z",
  "SignatureVersion": "1",
  "Signature": "BASE64-ENCODED-SIGNATURE",
  "SigningCertURL": "https://...",
  "UnsubscribeURL": "https://..."
}
```

### Message Attributes

Key-value metadata attached to a message. Used for:
- Message filtering (FilterPolicy)
- Routing decisions
- Metadata without changing message body

```python
MessageAttributes={
    'key1': {
        'DataType': 'String',        # String, Number, Binary, String.Array
        'StringValue': 'value1'
    },
    'key2': {
        'DataType': 'Number',
        'StringValue': '42'          # Always StringValue, even for numbers
    },
    'key3': {
        'DataType': 'Binary',
        'BinaryValue': b'binary-data'
    },
    'tags': {
        'DataType': 'String.Array',
        'StringValue': '["tag1", "tag2", "tag3"]'
    }
}
```

### Per-Protocol Message Format

SNS supports sending different message content per protocol:

```python
import json

message_structure = 'json'  # Tell SNS to use per-protocol messages
message = json.dumps({
    "default": "Generic message text",
    "email": "Dear Customer, your order has been confirmed.",
    "sqs": json.dumps({"orderId": "ORD-123", "event": "ORDER_CREATED"}),
    "lambda": json.dumps({"orderId": "ORD-123", "event": "ORDER_CREATED", "detailed": True}),
    "http": json.dumps({"orderId": "ORD-123", "webhookEvent": "order.created"}),
    "sms": "Order ORD-123 confirmed!"
})

sns_client.publish(
    TopicArn='arn:aws:sns:...',
    Message=message,
    MessageStructure='json'
)
```

---

## 7. SNS + SQS Fan-Out Pattern

### What is Fan-Out?

The Fan-Out pattern uses one SNS topic to distribute a single message to multiple SQS queues simultaneously. Each SQS queue can have one or more consumers that process the message independently.

This is one of the most critical architecture patterns in AWS.

### ASCII Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │             SNS Topic: OrderEvents            │
                         └───────────────┬─────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
                    ▼                    ▼                     ▼
          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
          │  SQS Queue:     │  │  SQS Queue:     │  │  SQS Queue:     │
          │  EmailService   │  │  Warehouse      │  │  Analytics      │
          └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                   │                    │                     │
                   ▼                    ▼                     ▼
          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
          │  Lambda:        │  │  EC2 Workers:   │  │  Lambda:        │
          │  Send Email     │  │  Update Inv.    │  │  Track Metrics  │
          └─────────────────┘  └─────────────────┘  └─────────────────┘

Publisher:
  ┌──────────────┐
  │ Order Service│ ──publish 1 message──→ SNS Topic
  └──────────────┘
                    SNS delivers to ALL 3 SQS queues simultaneously
                    Each service processes independently at its own pace
```

### Why Fan-Out Instead of Directly Writing to Multiple SQS Queues?

**Without Fan-Out (Bad):**
```python
# Order service must write to each queue separately
# Problems: partial failures, tight coupling, must know all consumers
sqs.send_message(QueueUrl=email_queue_url, ...)
sqs.send_message(QueueUrl=warehouse_queue_url, ...)
sqs.send_message(QueueUrl=analytics_queue_url, ...)
# If analytics queue fails → inconsistent state
```

**With Fan-Out (Good):**
```python
# Order service publishes to ONE SNS topic
# Benefits: decoupled, atomic, new consumers added without code change
sns.publish(TopicArn=order_events_topic_arn, Message=order_json)
# SNS handles delivery to all subscribers
# Adding new consumer = add new SQS subscription to SNS (no code change)
```

### Key Benefits of Fan-Out

1. **Decoupling**: Publisher doesn't know about consumers
2. **Durability**: SQS stores messages if consumer is down
3. **Scalability**: Each queue scales independently
4. **Reliability**: SQS retains message even if Lambda fails temporarily
5. **Flexibility**: Add/remove consumers without changing publisher code
6. **Filtering**: Each SQS subscription can have its own filter policy
7. **Independent Processing Speed**: Each consumer processes at its own rate

### Fan-Out with Filtering

```
SNS Topic: OrderEvents
├── SQS: EmailQueue         ← Filter: status = ["CREATED", "SHIPPED", "DELIVERED"]
├── SQS: WarehouseQueue     ← Filter: status = ["CREATED"]  (only new orders)
├── SQS: RefundQueue        ← Filter: status = ["REFUND_REQUESTED"]
└── SQS: AnalyticsQueue     ← No filter (receives all events)
```

### Fan-Out to S3 via Firehose

```
SNS Topic
├── SQS → Lambda (real-time processing)
└── Kinesis Firehose → S3 (archiving/analytics)
```

### Cross-Region Fan-Out

SNS can deliver to SQS queues in different AWS regions:
```
SNS (us-east-1)
├── SQS (us-east-1) → US processing
├── SQS (eu-west-1) → EU processing
└── SQS (ap-southeast-2) → Asia processing
```

---

## 8. Message Delivery Retry Policy and DLQ

### HTTP/HTTPS Retry Policy

When an HTTP/HTTPS subscriber fails to receive a message (non-2xx response or connection error), SNS retries with a configurable policy:

**Default retry phases:**
```
Phase 1: Immediate retry (no delay)
         3 retries, 0 seconds between
         
Phase 2: Pre-backoff retries  
         2 retries, 1 second between
         
Phase 3: Backoff retries
         10 retries, exponential backoff (1s → 2s → 4s → ... → 20s max)
         
Phase 4: Post-backoff retries
         100,000 retries, 20 seconds between
         
Maximum total retries: 100,015 (over 23 days)
```

### Configurable Parameters
```
minDelayTarget: Minimum delay between retries (default: 20 seconds)
maxDelayTarget: Maximum delay between retries (default: 20 seconds)
numRetries: Total number of retries (default: 3)
backoffFunction: linear, arithmetic, geometric, exponential
```

### Dead-Letter Queue (DLQ) for SNS

SNS can send undeliverable messages to a DLQ (SQS queue).

Triggered when:
- All retries exhausted
- Subscriber is inaccessible
- Access denied to Lambda function
- Lambda function returns error (for Lambda subscribers)

**DLQ Setup:**
```
SNS Subscription
└── DLQ: arn:aws:sqs:us-east-1:123456789012:OrderEvents-DLQ
```

**DLQ Message Format:**
The DLQ message includes the original SNS message plus delivery failure metadata:
```json
{
  "ERROR_CODE": "200",
  "ERROR_MESSAGE": "FAILED_RETRIES",
  "FAILED_PROVIDER": "SNS",
  "ORIGINAL_SNS_MESSAGE_ATTRIBUTES": "...",
  "SNS_ORIGINAL_MESSAGE_BODY": "{...}"
}
```

### Lambda DLQ vs SNS DLQ

Important distinction:
- **SNS subscription DLQ**: Captures messages SNS couldn't deliver to Lambda
- **Lambda function DLQ**: Captures events Lambda processed but failed on

Configure both for complete fault tolerance:
```
SNS → Lambda (fails to invoke)    → SNS DLQ
SNS → Lambda (invoked, throws)    → Lambda DLQ (async invocation)
```

---

## 9. SNS FIFO: Ordering and Deduplication

### Overview

SNS FIFO (First-In-First-Out) topics guarantee ordered message delivery within a message group and exactly-once processing.

**Constraint**: SNS FIFO topics can only have **SQS FIFO queues** as subscribers.

### Message Group ID

Messages with the same `MessageGroupId` are delivered in strict order to subscribers.

```
Message 1: GroupId=order-123, Body={"status":"CREATED"}    → delivered 1st
Message 2: GroupId=order-123, Body={"status":"PAID"}       → delivered 2nd
Message 3: GroupId=order-123, Body={"status":"SHIPPED"}    → delivered 3rd
Message 4: GroupId=order-456, Body={"status":"CREATED"}    → parallel to order-123
```

Orders from different message groups can be processed in parallel (different sequences).

### Message Deduplication

Two methods to prevent duplicate messages:

**Method 1: Content-Based Deduplication**
- SNS computes SHA-256 hash of message body
- Duplicate messages (same hash) within a 5-minute window are discarded
- Enable on topic: `ContentBasedDeduplication = true`

**Method 2: Message Deduplication ID**
- Publisher provides an explicit `MessageDeduplicationId`
- If a message with the same ID is published within 5 minutes → discarded
- More control than content-based

```python
sns_client.publish(
    TopicArn='arn:aws:sns:us-east-1:123456789012:OrderEvents.fifo',
    Message=json.dumps({'orderId': 'ORD-123', 'status': 'CREATED'}),
    MessageGroupId='order-ORD-123',
    MessageDeduplicationId='ORD-123-CREATED-20260608'
)
```

### FIFO Limitations
- Throughput: 300 messages/second (or 10 MB/s) — much lower than Standard
- Subscribers: SQS FIFO only (no Email, HTTP, Lambda directly)
- For Lambda processing: SNS FIFO → SQS FIFO → Lambda (event source mapping)

---

## 10. Mobile Push Notifications

### Platform Application Endpoints

SNS Mobile Push supports:
- **APNS** (Apple Push Notification Service) — iOS, macOS
- **APNS_SANDBOX** — iOS development
- **FCM/GCM** (Firebase/Google Cloud Messaging) — Android
- **ADM** (Amazon Device Messaging) — Kindle
- **WNS** (Windows Push Notification Service) — Windows
- **MPNS** (Microsoft Push Notification Service) — Windows Phone
- **Baidu** — Chinese Android devices

### Architecture

```
Mobile App ──registers──→ APNS/FCM ──device token──→ Your Backend
Your Backend ──creates endpoint──→ SNS Platform Application
SNS Platform Application ──endpoint ARN──→ Store in DB

To send notification:
Your App ──publish──→ SNS Platform Endpoint ARN → SNS → APNS/FCM → Device
```

Or for bulk:
```
SNS Topic ──subscribe: platform endpoints──→ APNS/FCM → Devices
```

### Setup Flow

```
1. Create SNS Platform Application
   - Platform: APNS (iOS) or FCM (Android)
   - Credentials: APNS certificate/key or FCM server key

2. Register Device
   - App gets device token from APNS/FCM
   - Your backend calls SNS CreatePlatformEndpoint with device token
   - SNS returns endpoint ARN

3. Store endpoint ARN in your database associated with user

4. Send Notification
   - Publish to endpoint ARN directly (single device)
   - Or subscribe endpoint ARN to SNS topic (broadcast)
```

### Sending Push Notification

```python
# Direct push to single device
sns_client.publish(
    TargetArn='arn:aws:sns:us-east-1:123456789012:endpoint/APNS/MyApp/device-token-hash',
    Message=json.dumps({
        'APNS': json.dumps({
            'aps': {
                'alert': {
                    'title': 'Order Update',
                    'body': 'Your order has been shipped!'
                },
                'badge': 1,
                'sound': 'default'
            },
            'orderId': 'ORD-123'
        }),
        'FCM': json.dumps({
            'notification': {
                'title': 'Order Update',
                'body': 'Your order has been shipped!'
            },
            'data': {
                'orderId': 'ORD-123'
            }
        })
    }),
    MessageStructure='json'
)
```

### Handling Stale Endpoints

Device tokens can become invalid (user uninstalls app, rotates token). SNS sets endpoint attribute `Enabled = false` when delivery fails. Your application should periodically check and clean up disabled endpoints.

---

## 11. Encryption with KMS

### What Gets Encrypted

SNS supports **Server-Side Encryption (SSE)** using AWS KMS:
- Messages are encrypted when written to SNS storage
- Decrypted when delivered to subscribers
- In-transit: Always encrypted with HTTPS
- At-rest: Optional KMS encryption

### Enabling Encryption

```python
# Create encrypted topic
sns_client.create_topic(
    Name='SecureOrderEvents',
    Attributes={
        'KmsMasterKeyId': 'alias/aws/sns'  # AWS managed key
        # Or use custom CMK:
        # 'KmsMasterKeyId': 'arn:aws:kms:us-east-1:123456789012:key/key-id'
    }
)
```

### KMS Key Permissions

The publisher's IAM role must have `kms:GenerateDataKey` and `kms:Decrypt`.
The subscriber (SQS, Lambda) must have `kms:Decrypt` for the KMS key.

```json
// KMS Key Policy additions needed
{
  "Sid": "Allow SNS to use this key",
  "Effect": "Allow",
  "Principal": {
    "Service": "sns.amazonaws.com"
  },
  "Action": [
    "kms:GenerateDataKey*",
    "kms:Decrypt"
  ],
  "Resource": "*"
}
```

### Compliance Use Cases
- Financial data compliance (PCI DSS, SOX)
- Healthcare data (HIPAA)
- PII data protection
- Regulatory requirements in specific regions

---

## 12. Access Policies

### SNS Topic Policy

Controls who can publish to and subscribe to a topic. Similar to S3 bucket policies.

**Allow another AWS account to publish:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountPublish",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::PARTNER-ACCOUNT-ID:root"
      },
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:123456789012:OrderEvents"
    }
  ]
}
```

**Allow CloudWatch to publish alarms:**
```json
{
  "Sid": "AllowCloudWatch",
  "Effect": "Allow",
  "Principal": {
    "Service": "cloudwatch.amazonaws.com"
  },
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:us-east-1:123456789012:AlarmTopic"
}
```

**Restrict publishing to specific VPC:**
```json
{
  "Sid": "DenyNonVPC",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:...",
  "Condition": {
    "StringNotEquals": {
      "aws:SourceVpc": "vpc-12345678"
    }
  }
}
```

### IAM vs Resource Policy

| Method | Use When |
|--------|---------|
| IAM Policy on role | Same account, user/role-based access |
| SNS Topic Policy | Cross-account access, AWS service access (CloudWatch, S3), public access |

---

## 13. Interview Q&A

---

**Q1: What is the difference between SNS and SQS, and when would you use each?**

**A:** SNS is a pub/sub push-based notification service. One message goes to ALL subscribers simultaneously (fan-out). It's push-based — SNS pushes to subscribers. Messages are not stored; if no subscriber is available, the message is lost (unless there's a DLQ). SNS is best when you need to notify multiple systems simultaneously about an event.

SQS is a message queue for decoupling. Messages are stored durably (up to 14 days) and consumers poll to retrieve them. One consumer processes each message (competing consumers pattern). SQS is best when you need reliable, ordered (FIFO), or buffered message processing.

They are complementary: Use SNS + SQS Fan-Out to get both fan-out AND durability/buffering.

---

**Q2: Explain the SNS + SQS Fan-Out pattern and why it's important.**

**A:** The Fan-Out pattern involves an SNS topic with multiple SQS queue subscriptions. When a message is published to the SNS topic, it's delivered to all subscribed SQS queues simultaneously. Each SQS queue has its own consumers processing the message independently.

Why it's important: (1) Decoupling — the publisher doesn't know about consumers; (2) Durability — SQS stores the message even if a consumer is temporarily down; (3) Scalability — each consumer scales independently; (4) Extensibility — add new consumers (SQS subscriptions) without changing publisher code; (5) Filtering — each subscription can filter on message attributes to receive only relevant messages.

Classic example: Order placed → SNS → [Email Queue, Warehouse Queue, Analytics Queue] — each processed independently.

---

**Q3: How does SNS message filtering work and what can you filter on?**

**A:** Message filtering is configured on the subscription (not the topic) via a FilterPolicy. By default, filtering matches against message attributes. The filter is a JSON policy specifying conditions; only messages matching ALL conditions are delivered to that subscription.

You can filter on: exact string match, string prefix match, numeric ranges (operators: =, <, <=, >, >=, between), anything-but (blacklist), and attribute existence checks. Multiple values in an array act as OR; multiple keys act as AND.

New feature: FilterPolicyScope = MessageBody allows filtering on JSON message body fields instead of message attributes.

---

**Q4: What is the difference between SNS Standard and FIFO topics?**

**A:** Standard topics offer nearly unlimited throughput but with best-effort ordering and at-least-once delivery (possible duplicates). They support all subscriber types: SQS, Lambda, HTTP, email, SMS, mobile push, Firehose.

FIFO topics guarantee strict ordering within a message group (MessageGroupId) and exactly-once delivery via deduplication (content-based hash or explicit MessageDeduplicationId). However, throughput is limited to 300 messages/second, and they ONLY support SQS FIFO queues as subscribers — not Lambda, HTTP, Email, SMS, or mobile push directly.

Use Standard for high-throughput fan-out where order doesn't matter. Use FIFO for transactional systems where message order is critical (e.g., order state machine: created → paid → shipped → delivered).

---

**Q5: How does SNS retry work for HTTP/HTTPS endpoints, and what happens to undeliverable messages?**

**A:** SNS uses a four-phase retry policy for HTTP/HTTPS subscriptions: immediate retries (no delay), pre-backoff retries (short delays), exponential backoff retries, and post-backoff retries (up to ~23 days of retrying, ~100,015 total attempts).

If all retries are exhausted and the message still cannot be delivered, SNS can send the message to a Dead Letter Queue (SQS queue) configured on the subscription. Without a DLQ, undeliverable messages are permanently lost.

For Lambda subscribers: SNS asynchronously invokes Lambda. If Lambda fails, SNS doesn't retry (Lambda's own async retry handles it). Configure a DLQ on the SNS subscription to capture messages Lambda failed to process.

---

**Q6: A Lambda function subscribed to SNS keeps failing. Where can you add a DLQ and what's the difference?**

**A:** Two DLQ options: (1) **SNS Subscription DLQ** — captures messages SNS couldn't DELIVER to Lambda (invocation failure, permission errors). Configure this on the SNS subscription itself. (2) **Lambda Function DLQ** (or Lambda Destination) — captures events where Lambda was invoked successfully but the function threw an unhandled exception.

For complete fault tolerance, configure both: SNS subscription DLQ catches delivery failures, Lambda async DLQ/Destination catches execution failures. Messages in both DLQs should be monitored and reprocessed when the root cause is fixed.

---

**Q7: How would you architect a system where one event needs to trigger email notification, update a database, and write to an analytics stream?**

**A:** Use the SNS Fan-Out pattern: publish the event to an SNS Standard topic with three subscriptions:
1. SQS Queue → Lambda: formats and sends email via SES
2. SQS Queue → Lambda or EC2: updates the database
3. Kinesis Data Firehose: streams to S3 for analytics

Using SQS as an intermediary (rather than SNS → Lambda directly) provides durability and buffering — if any service is temporarily unavailable, SQS retains the message. Lambda processes at its own pace. Each subscriber is completely independent and can be scaled, modified, or replaced without affecting others.

---

**Q8: What are SNS message attributes used for?**

**A:** Message attributes are metadata key-value pairs attached to messages. They serve two purposes: (1) **Message filtering** — subscribers with FilterPolicy match on attributes, so the right subscribers get the right messages (e.g., `orderType=premium` routes to premium-order processing). (2) **Metadata transport** — carry contextual information (correlation IDs, trace IDs, source system) without modifying the message body.

Data types: String, Number, Binary, and String.Array. Attributes are NOT included in the 256 KB message body limit — they have their own size limits (up to 10 attributes, total 256 KB per message including attributes).

---

**Q9: How does SNS cross-account access work?**

**A:** SNS supports cross-account access via topic access policies (resource-based policies). To allow Account B to publish to a topic in Account A: add an SNS topic policy in Account A granting `sns:Publish` to Account B's root or specific role ARN. Account B's IAM roles also need `sns:Publish` in their IAM policies (both sides needed for cross-account).

For subscriptions across accounts: the subscriber account adds the SNS subscription but the SNS topic policy must permit the cross-account principal to subscribe. Note: With SNS FIFO, cross-account subscriptions are only to SQS FIFO queues, and the SQS queue policy must also allow SNS to send messages.

---

**Q10: Explain SNS encryption and who needs what KMS permissions.**

**A:** SNS SSE encrypts messages at rest using a KMS Customer Master Key (CMK). The publisher needs `kms:GenerateDataKey` to encrypt the message before it's stored. SNS service itself needs the same permission. Subscribers (Lambda, SQS) need `kms:Decrypt` to decrypt messages when they're delivered.

Important: The KMS key policy must explicitly grant these permissions to the relevant principals. If using SQS as a subscriber and SQS also has SSE enabled with its own KMS key, there are two encryption layers — SNS encrypts with its key (decrypts on delivery to SQS), then SQS encrypts with its own key. The SQS consumers only need the SQS KMS key for decryption.

---

**Q11: What is per-message protocol formatting in SNS and when is it useful?**

**A:** When you set `MessageStructure=json` in the publish call, the Message parameter is a JSON object with different keys for each protocol (default, email, sqs, lambda, http, sms, APNS, GCM, etc.). SNS delivers the protocol-specific message to each subscriber.

This is useful when subscribers need different formats: an SMS recipient needs a short plain-text message, a Lambda function needs a structured JSON payload, a mobile push notification needs a platform-specific payload (APNS vs FCM format), and an email recipient needs human-readable text. Without per-protocol formatting, all subscribers receive the same message regardless of their rendering capabilities.

---

**Q12: How do you handle the SNS + SQS fan-out when reading from SQS in Lambda? What's the message structure?**

**A:** When SNS delivers to SQS and Lambda polls SQS, the Lambda event `Records` array contains SQS messages. The SQS record's `body` field is a JSON string of the SNS notification wrapper. To get the actual payload, you must parse twice:

```python
import json
def lambda_handler(event, context):
    for sqs_record in event['Records']:
        sns_notification = json.loads(sqs_record['body'])  # Parse SQS body → SNS envelope
        actual_message = json.loads(sns_notification['Message'])  # Parse SNS Message → payload
        # Now use actual_message
```

The `sns_notification` has fields: Type, MessageId, TopicArn, Subject, Message, Timestamp, MessageAttributes. The `actual_message` is your application payload. This double-serialization is the most common mistake when processing SNS → SQS → Lambda pipelines.

---

*End of Amazon SNS Complete Guide*
