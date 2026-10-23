# AWS Lambda — The Definitive Guide

## Table of Contents
1. [What is Serverless?](#1-what-is-serverless)
2. [What is Lambda?](#2-what-is-lambda)
3. [Lambda Basics and Architecture](#3-lambda-basics-and-architecture)
4. [Lambda Configuration](#4-lambda-configuration)
5. [Lambda Triggers and Event Sources](#5-lambda-triggers-and-event-sources)
6. [Execution Environment: Cold vs Warm Start](#6-execution-environment-cold-vs-warm-start)
7. [Concurrency](#7-concurrency)
8. [Lambda with VPC](#8-lambda-with-vpc)
9. [Lambda Destinations and DLQ](#9-lambda-destinations-and-dlq)
10. [Lambda Layers](#10-lambda-layers)
11. [Lambda Pricing](#11-lambda-pricing)
12. [Hands-On Projects](#12-hands-on-projects)
13. [Interview Q&A](#13-interview-qa)

---

## 1. What is Serverless?

### The Core Concept

"Serverless" is a misleading name. **There are still servers.** The difference is that you, the developer, do not manage them.

```
   TRADITIONAL MODEL                   SERVERLESS MODEL
   ====================                ====================

   You are responsible for:            AWS is responsible for:
   - Buying/renting servers            - All servers
   - OS installation                   - OS installation & patching
   - OS patching & updates             - Capacity planning
   - Capacity planning                 - Hardware failure recovery
   - Scaling infrastructure            - Auto scaling
   - High availability config          - High availability

   You are responsible for:            You are responsible for:
   - Application code                  - Application code ONLY
```

### Benefits of Serverless

**1. No Server Management**
- No SSH access needed
- No patching operating systems
- No configuring web servers (Nginx, Apache)
- No managing fleets of EC2 instances

**2. Automatic Scaling**
```
   Traffic: 1 req/s     -->   1 Lambda instance
   Traffic: 1000 req/s  -->   1000 Lambda instances (near instant)
   Traffic: 0 req/s     -->   0 Lambda instances running (no cost)
```

**3. Pay Per Use**
- Traditional: Pay for server even when it is idle at 3 AM
- Serverless: Pay only for actual compute time consumed
- If no requests come in, you pay nothing

**4. Built-in High Availability**
- Lambda runs across multiple AZs automatically
- No configuration needed for fault tolerance

### Serverless vs Traditional

| Aspect | EC2 (Traditional) | Lambda (Serverless) |
|--------|-------------------|---------------------|
| Server management | Developer manages | AWS manages |
| Scaling | ASG (minutes) | Instant (milliseconds) |
| Billing | Per second (even idle) | Per invocation + ms duration |
| Max run time | Unlimited | 15 minutes |
| State | Stateful (in-memory possible) | Stateless required |
| OS access | Full SSH access | None |
| Cold start | Not applicable | Yes (first invocation) |
| Long-running processes | Yes | No |
| Persistent connections | Yes | No |
| Predictable cost | Yes (fixed) | Yes (variable) |
| Cost at massive scale | Cheaper (per unit) | Can be more expensive |

### When NOT to Use Serverless

- Tasks requiring more than 15 minutes of execution
- Applications needing persistent in-memory state
- Applications requiring GPU compute
- High-volume, sustained-throughput workloads (EC2 may be cheaper)
- Applications needing low-level OS customization

---

## 2. What is Lambda?

Lambda is AWS's **Function as a Service (FaaS)** offering. You write a function, deploy it, and Lambda runs it in response to events.

```
   HOW LAMBDA WORKS

   1. You write a function (code)
         |
         v
   2. You deploy it to Lambda
         |
         v
   3. An event occurs (HTTP request, S3 upload, timer, etc.)
         |
         v
   4. Lambda provisions a container and runs your function
         |
         v
   5. Function executes, returns result or writes to another service
         |
         v
   6. Container is frozen (reused) or destroyed
```

### Event-Driven Architecture

Lambda is fundamentally event-driven. Every Lambda invocation is triggered by an event from another AWS service or a direct invocation.

```
   EVENT SOURCES               LAMBDA               DOWNSTREAM
   ============                ======               ==========

   API Gateway  ------------>  [ fn() ]  --------> DynamoDB
   S3 Upload    ------------>  [ fn() ]  --------> S3
   SQS Message  ------------>  [ fn() ]  --------> SNS
   DynamoDB     ------------>  [ fn() ]  --------> Email
   Streams
   CloudWatch   ------------>  [ fn() ]  --------> Report
   Events
   SNS Topic    ------------>  [ fn() ]  --------> Database
```

### Supported Runtimes

| Runtime | Versions |
|---------|---------|
| Node.js | 18.x, 20.x |
| Python | 3.11, 3.12 |
| Java | 11, 17, 21 |
| Go | 1.x (provided.al2023) |
| Ruby | 3.2, 3.3 |
| .NET | 6, 8 |
| Custom Runtime | Any language via `provided.al2023` |

**Custom Runtime Example:** You can run Rust, C++, or any language by implementing the Lambda Runtime API. You provide a bootstrap executable that calls the Lambda API to receive events and post responses.

---

## 3. Lambda Basics and Architecture

### Lambda Function Components

Every Lambda function has three core components:

```python
# Python example

def handler(event, context):
    #          ^       ^
    #          |       |
    #      event data  |
    #                context object
    #
    # This function is the ENTRY POINT

    # event: dict containing the triggering event data
    print(event)

    # context: runtime information about the invocation
    print(context.function_name)
    print(context.remaining_time_in_millis())

    # Return value becomes the response (for synchronous invocations)
    return {
        "statusCode": 200,
        "body": "Hello from Lambda!"
    }
```

```javascript
// Node.js example

exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    // context.awsRequestId - unique request ID
    // context.functionName - name of this function
    // context.getRemainingTimeInMillis() - time left before timeout

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello from Lambda!' })
    };
};
```

### The Event Object

The event object structure depends on the triggering service:

**API Gateway Event:**
```json
{
  "httpMethod": "POST",
  "path": "/users",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"name\": \"Alice\"}",
  "queryStringParameters": { "page": "1" }
}
```

**S3 Event:**
```json
{
  "Records": [
    {
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": { "name": "my-bucket" },
        "object": { "key": "images/photo.jpg", "size": 102400 }
      }
    }
  ]
}
```

**SQS Event:**
```json
{
  "Records": [
    {
      "messageId": "abc123",
      "body": "{\"orderId\": \"ORD-001\"}",
      "attributes": { "ApproximateReceiveCount": "1" }
    }
  ]
}
```

### The Context Object

```python
def handler(event, context):
    context.function_name          # "my-function"
    context.function_version       # "$LATEST" or version number
    context.invoked_function_arn   # full ARN
    context.memory_limit_in_mb     # "512"
    context.aws_request_id         # unique request ID
    context.log_group_name         # CloudWatch log group
    context.log_stream_name        # CloudWatch log stream
    context.remaining_time_in_millis()  # ms until timeout
```

---

## 4. Lambda Configuration

### Memory

```
   MEMORY RANGE: 128 MB to 10,240 MB (10 GB)

   128 MB  =======================================> 10,240 MB
   (min)                                            (max)

   Default: 128 MB
   Common choices: 128, 256, 512, 1024, 2048, 3008 MB
```

**Key insight:** CPU power scales proportionally with memory. If your function is CPU-bound and slow, increase memory — it also increases CPU allocation.

| Memory | vCPU |
|--------|------|
| 128 MB | 0.0625 vCPU |
| 512 MB | 0.25 vCPU |
| 1,792 MB | 1 full vCPU |
| 3,584 MB | 2 vCPU |
| 10,240 MB | ~6 vCPU |

### Timeout

```
   TIMEOUT RANGE: 1 second to 900 seconds (15 minutes)

   1s =============================================> 900s
   (min)                                            (max)

   Default: 3 seconds
```

If your function exceeds the timeout, Lambda terminates it and throws a `Task timed out` error.

**Best practice:** Set timeout based on your function's expected duration + buffer. Do not set 15 minutes for a function that runs in 2 seconds — wasted money if something hangs.

### Environment Variables

```
   Lambda Function Configuration
   ==============================
   Environment Variables:
   ┌─────────────────────┬──────────────────────────────────┐
   │ Key                 │ Value                            │
   ├─────────────────────┼──────────────────────────────────┤
   │ DB_HOST             │ mydb.cluster.us-east-1.rds.com   │
   │ TABLE_NAME          │ users-table                      │
   │ ENVIRONMENT         │ production                       │
   │ LOG_LEVEL           │ INFO                             │
   └─────────────────────┴──────────────────────────────────┘

   Encrypted at rest using KMS.
   Can be overridden per alias/stage.
```

```python
import os

def handler(event, context):
    table_name = os.environ['TABLE_NAME']
    db_host = os.environ['DB_HOST']
    # Use these values instead of hardcoding
```

### Function URL

Lambda Function URLs give your function a dedicated HTTPS endpoint without needing API Gateway for simple use cases.

```
   https://abc123.lambda-url.us-east-1.on.aws/
         |
         v
   [ Lambda Function ]
```

- Supports GET, POST, PUT, DELETE, etc.
- Can configure CORS
- Supports IAM auth or no auth (public)
- Cheaper than API Gateway for simple endpoints

### Versions and Aliases

```
   Lambda Function: "my-api"
   ===========================

   $LATEST  <-- always points to the latest unpublished code
      |
      v (publish)
   Version 1  (immutable snapshot)
   Version 2  (immutable snapshot)
   Version 3  (immutable snapshot) <-- latest published

   ALIASES:
   ========
   "prod"    ------> Version 2 (90% traffic)
                     Version 3 (10% traffic)  <-- canary deployment!
   "dev"     ------> $LATEST
   "staging" ------> Version 3
```

- **Versions:** Immutable snapshots of code + config. Once published, cannot change.
- **Aliases:** Mutable pointers to versions. Can shift traffic between versions.

---

## 5. Lambda Triggers and Event Sources

### Invocation Types

```
   SYNCHRONOUS                      ASYNCHRONOUS
   ===========                      ============

   Caller waits for result          Caller fires and forgets

   API Gateway  -->  Lambda         S3       -->  Lambda
   ALB          -->  Lambda         SNS      -->  Lambda
   Function URL -->  Lambda         EventBridge  -->  Lambda

   Result returned to caller        Result goes to Destination/DLQ


   POLL-BASED (Lambda polls the source)
   =====================================
   SQS          -->  Lambda (Lambda polls SQS)
   DynamoDB     -->  Lambda (Lambda polls streams)
   Kinesis      -->  Lambda (Lambda polls shards)
```

### 1. API Gateway (Synchronous)

```
   User --> API Gateway --> Lambda --> Response --> User
                (waits)                   ^
                                          |
                              Lambda must respond within
                              29 seconds (API Gateway timeout)
```

```python
def handler(event, context):
    method = event['httpMethod']
    path = event['path']
    body = event.get('body', '{}')

    # Process request
    if method == 'GET' and path == '/users':
        users = get_all_users()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(users)
        }
```

### 2. S3 Events (Asynchronous)

```
   User uploads file.jpg
         |
         v
   [ S3 Bucket ]  ---- s3:ObjectCreated event ---->  [ Lambda ]
                                                          |
                                                    Process image
                                                          |
                                                          v
                                                   [ S3 Output Bucket ]
                                                    save resized.jpg
```

Common S3 event types:
- `s3:ObjectCreated:Put`
- `s3:ObjectCreated:Post`
- `s3:ObjectCreated:Copy`
- `s3:ObjectCreated:CompleteMultipartUpload`
- `s3:ObjectRemoved:Delete`
- `s3:ObjectRemoved:DeleteMarkerCreated`

```python
import boto3

s3 = boto3.client('s3')

def handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        # Download original
        response = s3.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()

        # Process (resize, watermark, etc.)
        resized = resize_image(image_data)

        # Upload to output bucket
        s3.put_object(
            Bucket='output-bucket',
            Key=f'resized/{key}',
            Body=resized
        )
```

### 3. SQS (Poll-Based)

Lambda polls the SQS queue and processes messages in batches.

```
   Producer ---> [ SQS Queue ] <--- Lambda polls every few seconds
                                           |
                                    Batch of messages
                                           |
                                    Process each message
                                           |
                                    Delete successful messages
                                    (failed messages return to queue)
```

Key configuration:
- **Batch Size:** 1 to 10,000 messages per invocation
- **Batch Window:** Wait up to X seconds to fill batch (0-300 seconds)
- **Concurrency:** One Lambda invocation per shard/batch

```python
def handler(event, context):
    failed_messages = []

    for record in event['Records']:
        message_id = record['messageId']
        body = json.loads(record['body'])

        try:
            process_order(body['orderId'])
        except Exception as e:
            # Report failure - this message stays in queue
            failed_messages.append({'itemIdentifier': message_id})

    # Return partial batch failure (SQS only retries failed messages)
    return {'batchItemFailures': failed_messages}
```

### 4. DynamoDB Streams (Poll-Based)

```
   DynamoDB Table
   ==============
   INSERT item  -->  Stream Record  -->  Lambda
   UPDATE item  -->  Stream Record  -->  Lambda
   DELETE item  -->  Stream Record  -->  Lambda
```

Use cases: replicate data, trigger notifications, build audit logs.

```python
def handler(event, context):
    for record in event['Records']:
        event_name = record['eventName']  # INSERT, MODIFY, REMOVE
        new_image = record['dynamodb'].get('NewImage', {})
        old_image = record['dynamodb'].get('OldImage', {})

        if event_name == 'INSERT':
            # New item was added
            user_id = new_image['userId']['S']
            send_welcome_email(user_id)
        elif event_name == 'REMOVE':
            # Item was deleted
            cleanup_user_data(old_image['userId']['S'])
```

### 5. SNS (Asynchronous)

```
   SNS Topic --> Lambda (one invocation per message)
                       |
                  Process notification
```

### 6. EventBridge / CloudWatch Events (Scheduled + Pattern)

```
   Scheduled Rule: rate(5 minutes)
         |
         v
   [ Lambda ] --> Cleanup old records, send reports, health checks


   Event Pattern Rule: EC2 state change to "stopped"
         |
         v
   [ Lambda ] --> Send alert, restart instance
```

```python
# Scheduled Lambda example
def handler(event, context):
    # This runs on a schedule
    expired_sessions = get_expired_sessions()
    for session in expired_sessions:
        delete_session(session['id'])
    print(f"Cleaned up {len(expired_sessions)} expired sessions")
```

### 7. ALB (Application Load Balancer) — Synchronous

```
   Browser --> ALB --> Lambda --> Response --> Browser
                 (Target Group = Lambda function)
```

Similar to API Gateway but uses ALB instead. Good when you already have an ALB and want to route some paths to Lambda.

### 8. Kinesis (Poll-Based)

```
   Data Stream --> [ Kinesis Shards ] <-- Lambda polls each shard
                          |
                    Batch of records
                          |
                    Process in order
```

- Lambda processes one shard at a time (ordered within shard)
- One concurrent Lambda per shard
- Configurable: batch size, parallelization factor (up to 10 concurrent per shard)

---

## 6. Execution Environment: Cold vs Warm Start

### What is a Cold Start?

When Lambda runs your function for the first time (or after it has been idle), it must:

```
   COLD START SEQUENCE
   ===================

   Step 1: Download your deployment package (code + dependencies)
           Time: 10ms - several seconds (depending on package size)
                |
                v
   Step 2: Start the execution environment (container)
           Time: ~100ms
                |
                v
   Step 3: Run your initialization code (outside the handler)
           Time: depends on your code (DB connections, imports)
                |
                v
   Step 4: Run your handler function
           Time: your actual business logic

   TOTAL COLD START: can be 100ms to several seconds
```

### What is a Warm Start?

If the same Lambda container is reused for a subsequent request:

```
   WARM START SEQUENCE
   ===================

   Container already running!
   Initialization code already ran!
                |
                v
   Step 1: Run your handler function (only this!)
           Time: just your business logic

   TOTAL WARM START: ~1ms overhead
```

### Cold Start Optimization Techniques

```
   1. REDUCE PACKAGE SIZE
      ─────────────────────
      Smaller zip = faster download = shorter cold start
      - Remove unused dependencies
      - Use Lambda Layers for large libraries
      - Use tree-shaking for Node.js

   2. CHOOSE RUNTIME WISELY
      ──────────────────────
      Cold start times by runtime (approximate):
      Python:  ~100ms
      Node.js: ~100ms
      Java:    ~500ms - 1s (JVM startup!)
      .NET:    ~200ms
      Go:      ~50ms (compiled binary, fast startup)

   3. MOVE CODE OUTSIDE HANDLER
      ──────────────────────────
      # GOOD: DB connection initialized once, reused across invocations
      db_connection = create_db_connection()  # outside handler!

      def handler(event, context):
          result = db_connection.query("SELECT ...")  # reuses connection
          return result

      # BAD: New DB connection on every invocation
      def handler(event, context):
          db_connection = create_db_connection()  # new connection each time!
          result = db_connection.query("SELECT ...")
          return result

   4. KEEP FUNCTIONS WARM
      ────────────────────
      - Schedule EventBridge rule to ping function every 5 minutes
      - Not perfect (only warms one container)
```

### Provisioned Concurrency

The ultimate solution to cold starts:

```
   WITHOUT PROVISIONED CONCURRENCY:
   =================================
   First request  -->  COLD START (slow)
   Second request -->  Warm (fast)
   ...gap in traffic...
   Next request   -->  COLD START again (slow)


   WITH PROVISIONED CONCURRENCY = 10:
   ====================================
   AWS pre-initializes 10 containers, all ready and warm
   First request  -->  No cold start (container pre-warmed!)
   Second request -->  No cold start
   ... up to 10 concurrent requests: no cold starts

   Cost: You pay for pre-initialized containers even with no traffic
```

```
   PROVISIONED CONCURRENCY DIAGRAM:

   Time
   ──────────────────────────────────────────────────>

   Without PC:
   Request 1: [COLD:500ms][Execute:100ms]
   Request 2:             [Execute:100ms]  (warm, fast)
   Request 3: (idle 1hr)          [COLD:500ms][Execute:100ms]

   With PC (provisioned = 5):
   All warm, pre-initialized:
   Request 1: [Execute:100ms]
   Request 2: [Execute:100ms]
   Request 3: [Execute:100ms]
   Request 4: [Execute:100ms]
   Request 5: [Execute:100ms]
   Request 6: [Execute:100ms]  <-- 6th exceeds provisioned, may cold start
```

---

## 7. Concurrency

### What is Concurrency?

Concurrency = number of requests Lambda is handling simultaneously.

```
   1 request at a time:
   ┌──────────────────────────┐
   │ Request 1: 0s ──> 1s    │  1 concurrent execution
   └──────────────────────────┘

   3 concurrent requests:
   ┌──────────────────────────┐
   │ Request 1: 0s ──> 1s    │
   │ Request 2: 0s ──> 2s    │  3 concurrent executions
   │ Request 3: 0s ──> 0.5s  │
   └──────────────────────────┘
```

**Formula:** `Concurrency = (requests per second) x (average duration in seconds)`

Example: 1000 requests/sec, each taking 0.5s = 500 concurrent executions needed.

### Account-Level Concurrency Limit

Default: **1,000 concurrent executions per AWS account per region**

```
   Account Concurrency Pool: 1000
   ================================

   Function A: using 400
   Function B: using 300
   Function C: using 200
   Available:        100

   If Function D needs 200 concurrent executions --> THROTTLED!
   (only 100 available)
```

You can request a limit increase via AWS Support.

### Reserved Concurrency

Guarantees a function gets a specific amount of concurrency AND caps it.

```
   Account Pool: 1000

   ┌─────────────────────────────────────────┐
   │  Function A: Reserved = 200             │
   │  --> Guaranteed 200, cannot exceed 200  │
   ├─────────────────────────────────────────┤
   │  Function B: Reserved = 400             │
   │  --> Guaranteed 400, cannot exceed 400  │
   ├─────────────────────────────────────────┤
   │  Unreserved Pool: 400                   │
   │  --> Shared by all other functions      │
   └─────────────────────────────────────────┘

   USE CASE: Set reserved = 0 to DISABLE a function (throttle all requests)
   USE CASE: Set reserved concurrency on critical functions to guarantee capacity
```

### Provisioned Concurrency vs Reserved Concurrency

| Feature | Reserved Concurrency | Provisioned Concurrency |
|---------|---------------------|------------------------|
| Purpose | Guarantee + cap | Eliminate cold starts |
| Pre-initializes containers | No | Yes |
| Eliminates cold starts | No | Yes |
| Extra cost | No | Yes |
| Sets a ceiling | Yes | No (separate from reserved) |

### Throttling

When Lambda cannot execute due to concurrency limits:

```
   Synchronous invocation (API Gateway, ALB):
   --> Returns HTTP 429 Too Many Requests
   --> Caller must retry

   Asynchronous invocation (S3, SNS, EventBridge):
   --> Lambda retries for up to 6 hours
   --> Exponential backoff between retries

   Poll-based (SQS, Kinesis, DynamoDB Streams):
   --> Messages stay in queue/stream
   --> Lambda retries when capacity is available
```

---

## 8. Lambda with VPC

### Why Put Lambda in a VPC?

By default, Lambda runs in an AWS-managed VPC with internet access but no access to your private resources.

```
   DEFAULT LAMBDA (no VPC):
   ==========================

   Internet  <-->  [ Lambda ]  <-->  AWS Public Services
                                     (S3, DynamoDB, SNS, etc.)

   Cannot reach: RDS in private subnet, ElastiCache, private EC2


   LAMBDA IN YOUR VPC:
   ====================

   Internet  <-->  [ NAT Gateway ]  <-->  [ Lambda ] (private subnet)
                                               |
                                               v
                                        Private Resources:
                                        - RDS (database)
                                        - ElastiCache (Redis)
                                        - Private EC2 instances
```

### When to Use Lambda with VPC

| Use Case | VPC Needed? |
|----------|-------------|
| Access RDS in private subnet | YES |
| Access ElastiCache (Redis) | YES |
| Call public AWS APIs (S3, DynamoDB) | NO (use VPC endpoints if needed) |
| Call external internet APIs | NO |
| Access private EC2 resources | YES |

### ENI and Hyperplane ENI

**Old behavior (before 2019):**
```
   Lambda with VPC --> Creates a new ENI (Elastic Network Interface) per function
   Problem: ENI creation takes 10-30 seconds!
   Cold starts were VERY slow for VPC Lambda
```

**Modern behavior (Hyperplane ENI):**
```
   Lambda with VPC --> Uses shared Hyperplane ENI
   Benefit: ENI is pre-created and shared across Lambda functions
   Cold start improvement: VPC initialization reduced to ~100ms
   No longer a significant penalty for using VPC!
```

### Lambda VPC Configuration

```
   Lambda Function Settings:
   =========================
   VPC:          vpc-0abc123
   Subnets:      subnet-private-1a, subnet-private-1b
                 (multiple subnets = high availability)
   Security Group: sg-lambda-rds

   Security Group Rules:
   =====================
   Lambda SG (outbound) --> Port 5432 --> RDS SG (inbound)
                        --> Port 6379 --> ElastiCache SG (inbound)
```

### Internet Access from VPC Lambda

```
   Lambda in private subnet --> NO internet access by default

   To enable internet:
   Lambda (private subnet) --> NAT Gateway (public subnet) --> Internet Gateway --> Internet

   For AWS services without internet:
   Lambda (private subnet) --> VPC Endpoint --> S3/DynamoDB (no internet needed)
```

---

## 9. Lambda Destinations and DLQ

### Lambda Destinations

For asynchronous invocations, you can configure where Lambda sends the result:

```
   ASYNCHRONOUS INVOCATION FLOW:

   Event Source
       |
       v
   [ Lambda Function ]
       |
   ┌───┴───────────────┐
   |                   |
   v                   v
SUCCESS            FAILURE
destination        destination

   Options for each:
   - SQS Queue (inspect successful/failed events)
   - SNS Topic (notify on success/failure)
   - Lambda Function (chain functions)
   - EventBridge Event Bus
```

**Success Destination Example:**
```
   S3 Upload --> Lambda (resize image) --> SUCCESS --> SQS "completed-jobs"
                                       --> FAILURE --> SQS "failed-jobs"
                                                           |
                                                     Alert operations team
```

### Dead Letter Queue (DLQ)

A DLQ captures events that Lambda cannot process after maximum retries.

```
   ASYNC INVOCATION WITH DLQ:
   ==========================

   SNS Message --> Lambda (fails!)
                        |
                   Retry attempt 1 (wait 1 min)
                        |
                   Retry attempt 2 (wait 2 min)
                        |
                   All retries exhausted
                        |
                        v
                  [ DLQ (SQS Queue) ]
                        |
                  Message sits here for inspection
                  Ops team investigates, fixes, replays
```

**DLQ vs Destinations:**
| Feature | DLQ | Destinations |
|---------|-----|--------------|
| Captures failures | Yes | Yes |
| Captures successes | No | Yes |
| Supported by | Async + SQS/SNS | Async invocations |
| Payload | Original event | Result + original event |
| Newer feature | No | Yes |

**Recommendation:** Use Destinations (newer, more flexible). DLQ is older and less feature-rich.

---

## 10. Lambda Layers

### What Are Layers?

Layers are ZIP archives containing code or dependencies that you attach to Lambda functions.

```
   WITHOUT LAYERS:
   ===============
   Function A:   [code + pandas + numpy + requests] = 50 MB zip
   Function B:   [code + pandas + numpy + requests] = 50 MB zip
   Function C:   [code + pandas + numpy]            = 45 MB zip

   DEPLOYMENT: 3 x 50MB = 150MB total, duplicated dependencies


   WITH LAYERS:
   ============
   Layer "data-science-libs":  [pandas + numpy]  = 40MB
   Layer "requests-lib":       [requests]        = 5MB

   Function A: [code only = 1MB] + Layer "data-science-libs" + Layer "requests-lib"
   Function B: [code only = 1MB] + Layer "data-science-libs" + Layer "requests-lib"
   Function C: [code only = 1MB] + Layer "data-science-libs"

   DEPLOYMENT: 1MB + 1MB + 1MB = 3MB (shared layers not re-uploaded)
```

### Layer Limits

- Up to **5 layers** per function
- Total unzipped size of function + all layers must be under **250 MB**

### Layer Directory Structure

```
   Layer ZIP structure:
   ====================

   For Python:
   python/
   python/lib/
   python/lib/python3.11/
   python/lib/python3.11/site-packages/
   python/lib/python3.11/site-packages/pandas/
   python/lib/python3.11/site-packages/numpy/

   For Node.js:
   nodejs/
   nodejs/node_modules/
   nodejs/node_modules/lodash/
   nodejs/node_modules/axios/
```

### Creating a Layer

```bash
# Example: Create a Python layer with pandas

# 1. Install dependencies into folder
mkdir python
pip install pandas numpy -t python/

# 2. Zip the folder
zip -r my-data-layer.zip python/

# 3. Publish layer
aws lambda publish-layer-version \
  --layer-name data-science-layer \
  --zip-file fileb://my-data-layer.zip \
  --compatible-runtimes python3.11

# 4. Attach layer to function
aws lambda update-function-configuration \
  --function-name my-function \
  --layers arn:aws:lambda:us-east-1:123456789012:layer:data-science-layer:1
```

### Use Cases for Layers

1. **Shared dependencies:** pandas, numpy, boto3 extensions
2. **Custom runtimes:** Run Rust, PHP, or any language
3. **Security/compliance utilities:** Shared encryption helpers
4. **Configuration files:** Shared config across functions

---

## 11. Lambda Pricing

### Pricing Components

**1. Number of Requests**
```
   First 1,000,000 requests/month: FREE
   After that: $0.20 per 1,000,000 requests

   Example:
   10 million requests/month = (10M - 1M free) = 9M billable
   Cost = 9 x $0.20 = $1.80 for requests
```

**2. Duration (GB-seconds)**
```
   Free tier: 400,000 GB-seconds/month

   After free tier:
   $0.0000166667 per GB-second

   Formula: GB-seconds = (Memory in GB) x (Duration in seconds) x (Number of invocations)

   Example:
   - 512 MB function (= 0.5 GB)
   - Runs for 1 second per invocation
   - 1,000,000 invocations/month

   GB-seconds = 0.5 GB x 1s x 1,000,000 = 500,000 GB-seconds
   Free tier covers 400,000, so billable = 100,000 GB-seconds
   Cost = 100,000 x $0.0000166667 = $1.67
```

**3. Provisioned Concurrency (if used)**
```
   $0.0000097222 per GB-second (allocated, not invoked)
   You pay even when function is idle
```

### Cost Comparison Example

```
   Scenario: Simple API that processes 1M requests/month
             Each request takes 200ms, 256MB memory

   Lambda cost:
   - Requests: 1M - 1M free = $0
   - Duration: 0.25 GB x 0.2s x 1M = 50,000 GB-sec
                50,000 - 400,000 free = $0
   TOTAL: $0/month (within free tier!)

   EC2 (t3.small):
   - $0.0208/hr x 730 hours/month = $15.18/month
   - Even if you only need it for peak traffic

   Lambda is dramatically cheaper for low/moderate workloads!
```

### Lambda vs EC2 Cost Crossover

```
   Cost ($)
   │
   │                              EC2 (fixed cost)
   ├──────────────────────────────────────────────
   │                           /
   │                          /  Lambda (scales with usage)
   │                         /
   │                        /
   │                       * <-- crossover point
   │                      /
   │                     /
   └──────────────────────────────────────────────> Traffic

   Below crossover: Lambda cheaper
   Above crossover: EC2 cheaper (for sustained high traffic)
```

---

## 12. Hands-On Projects

### Project 1: S3 Image Processing Pipeline

**Architecture:**
```
   User uploads image.jpg
         |
         v
   [ S3: input-bucket ]
         |
   (ObjectCreated event)
         |
         v
   [ Lambda: image-resizer ]
         |
         v
   [ S3: output-bucket ]
   Saves: thumbnail-image.jpg
```

**Lambda Code (Python):**
```python
import boto3
import json
from PIL import Image
import io

s3 = boto3.client('s3')
OUTPUT_BUCKET = 'my-thumbnail-bucket'

def handler(event, context):
    for record in event['Records']:
        # Get bucket and file info
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        # Only process jpg/png files
        if not key.lower().endswith(('.jpg', '.jpeg', '.png')):
            print(f"Skipping non-image file: {key}")
            continue

        # Download the original image
        response = s3.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()

        # Resize image
        img = Image.open(io.BytesIO(image_data))
        img.thumbnail((200, 200))  # Create thumbnail

        # Save to bytes
        output = io.BytesIO()
        img.save(output, format=img.format or 'JPEG')
        output.seek(0)

        # Upload thumbnail to output bucket
        thumbnail_key = f"thumbnails/{key}"
        s3.put_object(
            Bucket=OUTPUT_BUCKET,
            Key=thumbnail_key,
            Body=output.getvalue(),
            ContentType='image/jpeg'
        )

        print(f"Created thumbnail: {thumbnail_key}")

    return {'statusCode': 200}
```

**Setup Steps:**
1. Create S3 bucket: `my-input-bucket`
2. Create S3 bucket: `my-thumbnail-bucket`
3. Create Lambda function with Python 3.11 runtime
4. Add Pillow library as a Layer
5. Set Lambda IAM role with S3 read/write permissions
6. Add S3 trigger on `my-input-bucket` for `s3:ObjectCreated:*` events

---

### Project 2: Serverless CRUD API

**Architecture:**
```
   Browser / Postman
         |
   HTTP Request
         |
         v
   [ API Gateway ]
   GET    /users       --> [ Lambda: list-users ]   --> DynamoDB scan
   POST   /users       --> [ Lambda: create-user ]  --> DynamoDB put
   GET    /users/{id}  --> [ Lambda: get-user ]     --> DynamoDB get
   PUT    /users/{id}  --> [ Lambda: update-user ]  --> DynamoDB update
   DELETE /users/{id}  --> [ Lambda: delete-user ]  --> DynamoDB delete
```

**Lambda Code (Node.js — single function handles all routes):**
```javascript
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const { httpMethod, pathParameters, body } = event;
    const userId = pathParameters?.id;

    try {
        switch (httpMethod) {
            case 'GET':
                if (userId) {
                    // Get single user
                    const result = await dynamo.get({
                        TableName: TABLE,
                        Key: { userId }
                    }).promise();
                    return respond(200, result.Item || {});
                } else {
                    // List all users
                    const result = await dynamo.scan({ TableName: TABLE }).promise();
                    return respond(200, result.Items);
                }

            case 'POST':
                const newUser = JSON.parse(body);
                newUser.userId = Date.now().toString();
                await dynamo.put({ TableName: TABLE, Item: newUser }).promise();
                return respond(201, newUser);

            case 'PUT':
                const updates = JSON.parse(body);
                await dynamo.update({
                    TableName: TABLE,
                    Key: { userId },
                    UpdateExpression: 'set #name = :name, email = :email',
                    ExpressionAttributeNames: { '#name': 'name' },
                    ExpressionAttributeValues: {
                        ':name': updates.name,
                        ':email': updates.email
                    }
                }).promise();
                return respond(200, { message: 'Updated' });

            case 'DELETE':
                await dynamo.delete({ TableName: TABLE, Key: { userId } }).promise();
                return respond(204, {});

            default:
                return respond(405, { error: 'Method not allowed' });
        }
    } catch (error) {
        console.error(error);
        return respond(500, { error: 'Internal server error' });
    }
};

const respond = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
```

---

### Project 3: Scheduled Lambda (Cron Job)

**Use Case:** Every day at 9 AM, send a summary email of new user registrations.

**Architecture:**
```
   EventBridge Rule
   cron(0 9 * * ? *)  -->  [ Lambda: daily-report ]  -->  SES (email)
                                     |
                                  DynamoDB
                                  (query new users)
```

**Lambda Code:**
```python
import boto3
import json
from datetime import datetime, timedelta

dynamo = boto3.resource('dynamodb')
ses = boto3.client('ses')

def handler(event, context):
    table = dynamo.Table('users')

    # Query users registered in the last 24 hours
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()

    response = table.scan(
        FilterExpression='createdAt > :yesterday',
        ExpressionAttributeValues={':yesterday': yesterday}
    )

    new_users = response['Items']
    count = len(new_users)

    # Send email report
    ses.send_email(
        Source='reports@myapp.com',
        Destination={'ToAddresses': ['admin@myapp.com']},
        Message={
            'Subject': {'Data': f'Daily Report: {count} New Users'},
            'Body': {
                'Text': {
                    'Data': f'New users in the last 24 hours: {count}\n\n'
                            + '\n'.join([u['email'] for u in new_users])
                }
            }
        }
    )

    return {'statusCode': 200, 'usersReported': count}
```

---

## 13. Interview Q&A

**Q1: What is a cold start in Lambda, and how do you reduce it?**

A cold start occurs when Lambda needs to initialize a new execution environment — downloading the code, starting the container, and running initialization code outside the handler. It adds latency, typically 100ms to several seconds depending on runtime and package size.

Reduction strategies:
1. Use smaller deployment packages (fewer dependencies)
2. Choose lighter runtimes (Python/Node.js over Java)
3. Move initialization code outside the handler (DB connections, SDK clients)
4. Use Provisioned Concurrency for latency-sensitive functions
5. Use Lambda Layers to organize dependencies without increasing per-function size

---

**Q2: What is the difference between reserved concurrency and provisioned concurrency?**

- **Reserved concurrency:** Guarantees a maximum number of concurrent executions for a function. Acts as both a reservation (no other function can take this capacity) and a throttle (function cannot exceed this limit). No extra cost. Does NOT eliminate cold starts.

- **Provisioned concurrency:** Pre-initializes execution environments so they are warm and ready. Eliminates cold starts entirely. Has additional cost (you pay for pre-initialized containers even when idle).

---

**Q3: Lambda is trying to access an RDS database but cannot connect. What is the likely issue?**

Several possible causes:
1. Lambda is not configured to run inside the VPC where RDS resides
2. Lambda's security group does not have an outbound rule to RDS's security group
3. RDS's security group does not allow inbound from Lambda's security group
4. Lambda is in a public subnet but RDS is in a private subnet without proper routing
5. Lambda function is trying to connect via public endpoint but the VPC lacks an internet gateway or NAT gateway

---

**Q4: What is the maximum timeout for a Lambda function?**

15 minutes (900 seconds). If your workload exceeds 15 minutes, you should use Step Functions to orchestrate multiple Lambda functions, or use ECS/EC2 for long-running tasks.

---

**Q5: How does Lambda handle failures for asynchronous invocations?**

For asynchronous invocations (S3, SNS, EventBridge):
1. Lambda retries twice with delays (1 minute, then 2 minutes)
2. After all retries are exhausted, the event goes to the configured DLQ (SQS or SNS) or failure Destination
3. If no DLQ is configured, the event is discarded

---

**Q6: What happens when you set reserved concurrency to 0 on a Lambda function?**

The function is effectively disabled — all invocations are immediately throttled. This is useful for temporarily stopping a function without deleting it, such as during incident response or maintenance.

---

**Q7: What is the Lambda execution environment, and what gets reused between warm invocations?**

The execution environment is a secure, isolated container with your code, runtime, and operating system. Between warm invocations:
- The container is reused (no re-initialization)
- Global variables persist
- Database connections established outside the handler persist
- `/tmp` storage (512 MB to 10 GB) persists within the same environment
- The handler function is called fresh each time with the new event

---

**Q8: Can Lambda access the internet without VPC configuration?**

Yes. By default, Lambda runs in an AWS-managed VPC that has full internet access. You can call external APIs, reach public AWS endpoints, etc.

However, once you put Lambda in YOUR VPC, it loses internet access unless you configure a NAT Gateway in a public subnet, or use VPC Endpoints for AWS services.

---

**Q9: What is the difference between synchronous and asynchronous Lambda invocation?**

- **Synchronous:** The caller waits for the response. Used by API Gateway, ALB, Function URLs. If Lambda fails, the caller gets an error immediately.

- **Asynchronous:** The caller fires and forgets. Lambda queues the event and processes it. Used by S3, SNS, EventBridge. Retries happen automatically. Result goes to Destinations or DLQ.

---

**Q10: What are Lambda Layers and why use them?**

Layers are ZIP archives attached to Lambda functions containing libraries, dependencies, or custom runtimes. Benefits:
1. Share common code across multiple functions without duplicating it in each deployment package
2. Keep deployment packages smaller (faster uploads, faster cold starts)
3. Separate business logic from dependencies (update libraries without touching function code)
4. Use AWS-provided layers for popular libraries (e.g., AWS Data Wrangler for Python)

---

**Q11: How does SQS trigger Lambda, and what is batch processing?**

Lambda polls the SQS queue and retrieves messages in batches. Lambda then invokes your function with the batch as the event. If the function succeeds, Lambda deletes the messages. If it fails, messages return to the queue (become visible again after the visibility timeout).

With partial batch failure reporting, you can return a list of failed message IDs, and Lambda only retries those specific messages rather than the entire batch.

---

**Q12: What is the difference between Lambda Destinations and DLQ?**

Both handle the fate of events after Lambda processing:
- **DLQ:** Older feature. Only captures failures. Receives the original event payload.
- **Destinations:** Newer, more flexible. Can handle both successes AND failures. Can route to SQS, SNS, Lambda, or EventBridge. Receives richer information including the Lambda response or error details.

For new functions, AWS recommends using Destinations over DLQ.

---

**Q13: How do you handle environment-specific configuration in Lambda?**

1. **Environment variables:** Store non-secret config (table names, feature flags). Encrypted with KMS at rest.
2. **AWS Secrets Manager:** Store secrets (passwords, API keys). Lambda fetches at runtime.
3. **SSM Parameter Store:** Store configuration. Lambda fetches at startup (outside handler).
4. **Lambda aliases + stage variables (with API Gateway):** Different aliases point to different versions with different environment variables.

---

**Q14: What is the Hyperplane ENI in Lambda VPC?**

Before 2019, Lambda created a new Elastic Network Interface (ENI) for each function in a VPC, which caused 10-30 second cold starts. The Hyperplane ENI is a shared network interface managed by AWS that Lambda functions share. This dramatically reduced VPC cold starts to roughly the same as non-VPC cold starts (~100ms), making VPC Lambda practical for production workloads.

---

**Q15: How do you monitor Lambda functions?**

1. **CloudWatch Logs:** All `print()` / `console.log()` statements go here automatically
2. **CloudWatch Metrics:**
   - `Invocations`: How many times was the function called
   - `Errors`: How many invocations failed
   - `Duration`: Execution time per invocation
   - `Throttles`: How many were throttled due to concurrency limits
   - `ConcurrentExecutions`: Real-time concurrency usage
3. **X-Ray:** Distributed tracing to see latency breakdown (Lambda init + handler + downstream calls)
4. **CloudWatch Alarms:** Alert when error rate exceeds threshold

---

**Q16: What is Lambda@Edge and when do you use it?**

Lambda@Edge runs Lambda functions at CloudFront edge locations, closer to the user. Use cases:
- Redirect users to region-specific URLs
- A/B testing (modify responses at the edge)
- Authentication and authorization at the edge
- Customize HTTP headers
- Image transformation at the edge

Limitations: max 5 seconds timeout, max 128 MB memory, fewer supported runtimes, more expensive than regular Lambda.

---

**Q17: How does Lambda scale when traffic spikes suddenly?**

Lambda can scale from 0 to 1,000 concurrent executions in seconds. For sudden bursts:
- Lambda initially adds 500-3,000 new concurrent executions per minute (burst limit varies by region)
- After the burst limit, 500 new executions per minute until the account limit
- If traffic exceeds available concurrency, requests are throttled (HTTP 429 for sync, retry queue for async)

---

**Q18: What is the /tmp storage in Lambda, and what are its limitations?**

Lambda provides a writable `/tmp` directory for temporary storage:
- Size: 512 MB (default) to 10,240 MB (10 GB, configurable)
- Persists within the same execution environment (warm container reuse)
- NOT shared between concurrent invocations
- Deleted when the container is destroyed

Use case: Download large files, process them, then upload results. Do NOT use `/tmp` for data that must persist across invocations — use S3 or DynamoDB for that.

---

**Q19: Can you explain function versioning in Lambda?**

Lambda versioning allows immutable snapshots of your function:
1. `$LATEST`: Always points to the latest deployed code (mutable)
2. Published versions (1, 2, 3...): Immutable snapshots. Code + config frozen.
3. Aliases: Named pointers to versions (`prod` → v2, `dev` → $LATEST)
4. Traffic shifting: Alias can split traffic between two versions (e.g., 90% v2, 10% v3 for canary deployments)

---

**Q20: What are the Lambda function package size limits?**

| Method | Limit |
|--------|-------|
| Direct upload (ZIP) | 50 MB compressed |
| S3 upload (ZIP) | 250 MB unzipped |
| Container image | 10 GB |
| Function + all layers | 250 MB unzipped |

For large dependencies (machine learning models, etc.), use container images (up to 10 GB).

---

**Q21: Describe a real-world use case for Lambda Destinations.**

An e-commerce platform processes payment events asynchronously. When a payment Lambda succeeds, send the order confirmation details to an SNS topic (which emails the customer). When it fails, send the full error details to an SQS dead-letter queue for the operations team to investigate and potentially replay. Without Destinations, you would need try/catch blocks in your Lambda code to manually route to different SNS/SQS topics.

---

**Q22: How do you secure Lambda functions?**

1. **IAM Execution Role:** Least-privilege IAM role — only the permissions the function needs
2. **Resource-based policies:** Control which AWS services/accounts can invoke the function
3. **VPC:** Run in private subnets, no direct internet access
4. **Environment variable encryption:** KMS-encrypted environment variables for secrets
5. **Secrets Manager:** Rotate and access secrets without storing in environment variables
6. **Code signing:** Ensure only trusted code is deployed
7. **Lambda Authorizers (API Gateway):** Authenticate/authorize incoming requests before they reach Lambda
