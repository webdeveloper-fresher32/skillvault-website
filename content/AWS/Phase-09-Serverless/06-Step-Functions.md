# AWS Step Functions - Complete Guide

## Table of Contents
1. [What is Step Functions and Why Use It](#1-what-is-step-functions-and-why-use-it)
2. [State Machines Concept](#2-state-machines-concept)
3. [Standard vs Express Workflows](#3-standard-vs-express-workflows)
4. [All State Types with Examples](#4-all-state-types-with-examples)
5. [Amazon States Language (ASL)](#5-amazon-states-language-asl)
6. [Error Handling: Catch and Retry](#6-error-handling-catch-and-retry)
7. [SDK Integration Types](#7-sdk-integration-types)
8. [Distributed Map](#8-distributed-map)
9. [Integration with AWS Services](#9-integration-with-aws-services)
10. [Use Cases](#10-use-cases)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is Step Functions and Why Use It

### Definition

AWS Step Functions is a serverless orchestration service that lets you coordinate multiple AWS services into workflows using a visual state machine. You define your workflow as a series of steps (states), and Step Functions manages execution, state passing, error handling, retries, and monitoring.

### The Problem Step Functions Solves

**Without Step Functions (Lambda orchestration via code):**
```python
# One Lambda doing everything
def lambda_handler(event, context):
    # Step 1: Validate order
    validation_result = validate_order(event)
    if not validation_result['valid']:
        send_error_notification(validation_result)
        return
    
    # Step 2: Check inventory
    inventory = check_inventory(event['items'])
    if not inventory['available']:
        notify_out_of_stock(inventory)
        return
    
    # Step 3: Process payment
    try:
        payment = process_payment(event)
    except PaymentError as e:
        # Retry logic here... manually
        # What if Lambda times out? 15-min limit!
        # How to resume? Start over!
        pass
    
    # Problem: 
    # - Lambda max 15 minutes — can't handle long workflows
    # - No visual tracking of where workflow is
    # - Retry logic is complex and error-prone
    # - Can't easily add/modify steps
    # - Debugging is painful (all or nothing)
```

**With Step Functions:**
```
Each step is a separate state in the state machine
Step Functions manages:
  ✓ State passing between steps
  ✓ Retry logic with exponential backoff (per step)
  ✓ Error handling and fallback paths (per step)
  ✓ Waiting for async operations (hours/days)
  ✓ Parallel execution of independent steps
  ✓ Visual execution history and debugging
  ✓ Long-running workflows (up to 1 year for Standard)
```

### Core Benefits

| Problem | Without Step Functions | With Step Functions |
|---------|----------------------|---------------------|
| Long-running workflows | Limited to Lambda 15min | Up to 1 year |
| Retry logic | Code in every Lambda | Declarative in ASL |
| Error handling | Code in every Lambda | Catch blocks in ASL |
| Parallel steps | Complex async code | Parallel state |
| Loop processing | Recursive Lambda calls | Map state |
| Workflow visibility | Custom logging | Built-in visual console |
| Wait for human approval | Polling loops | WaitForTaskToken |
| Debugging | Search CloudWatch logs | Visual execution graph |

### Step Functions Console

The console provides:
- Visual state machine diagram
- Execution history (input/output at each state)
- Real-time execution status (running, succeeded, failed)
- Ability to re-run failed executions with same input

---

## 2. State Machines Concept

### What is a State Machine?

A state machine is a computational model consisting of:
- **States**: Each step or condition in the workflow
- **Transitions**: How to move from one state to another
- **Input/Output**: JSON data that flows between states

### Execution Model

```
Start Execution
│ (with JSON input)
↓
[State 1]
│ Receives input
│ Performs action
│ Produces output
↓
[State 2]
│ Receives State 1's output as input
│ ...
↓
[End State]
(Execution succeeds or fails)
```

### Input/Output Processing

Step Functions passes JSON between states. You can control what data flows using:

- **InputPath**: Which part of input to pass to the state's resource (`$.detail`, `$.order`)
- **Parameters**: Construct a new input from any combination of static values and input data
- **ResultSelector**: Extract specific fields from the state's result
- **ResultPath**: Where to put the state's result in the output (`$.paymentResult`, null)
- **OutputPath**: Which part of the state's output to pass to the next state

**Data flow example:**
```json
// Input to state:
{
  "orderId": "ORD-123",
  "customerId": "CUST-456",
  "amount": 99.99
}

// Lambda processes and returns:
{
  "paymentId": "PAY-789",
  "status": "approved"
}

// With ResultPath: "$.payment", output becomes:
{
  "orderId": "ORD-123",          ← preserved from input
  "customerId": "CUST-456",      ← preserved from input
  "amount": 99.99,               ← preserved from input
  "payment": {                   ← new field added
    "paymentId": "PAY-789",
    "status": "approved"
  }
}
```

### Execution Duration

| Workflow Type | Max Duration |
|--------------|-------------|
| Standard | 1 year |
| Express (Synchronous) | 5 minutes |
| Express (Asynchronous) | 5 minutes |

---

## 3. Standard vs Express Workflows

### Comparison Table

| Feature | Standard Workflow | Express Workflow (Async) | Express Workflow (Sync) |
|---------|------------------|-------------------------|------------------------|
| **Duration** | Up to 1 year | Up to 5 minutes | Up to 5 minutes |
| **Execution model** | Exactly-once | At-least-once | At-most-once |
| **Execution rate** | 2,000/sec | 100,000/sec | 2,000/sec |
| **Execution history** | Stored 90 days | CloudWatch Logs only | CloudWatch Logs only |
| **Pricing** | Per state transition | Per execution duration + requests | Per execution duration + requests |
| **Use case** | Long-running, auditable workflows | High-volume, short-duration events | Synchronous HTTP-backed workflows |
| **Error handling** | Built-in (Retry/Catch) | Built-in | Built-in |
| **Idempotency** | Yes | No (duplicates possible) | Possible |

### Standard Workflow Pricing

```
$0.025 per 1,000 state transitions
Free tier: 4,000 state transitions/month

Example: 10-step workflow, 1M executions/month
= 10 state transitions × 1,000,000 = 10M transitions
= 10,000 × $0.025 = $250/month
```

### Express Workflow Pricing

```
$1.00 per 1,000,000 workflow requests
+ $0.00001 per GB-second of duration

Example: 1M short workflows, 1 second each, 64MB
= $1.00 + (1,000,000 × 1s × 64/1024 GB × $0.00001)
= $1.00 + $0.625 = $1.625/month
```

### When to Choose

**Standard Workflow:**
- Order processing, fulfillment
- User onboarding
- Financial transactions requiring audit trail
- Any workflow > 5 minutes
- Workflows requiring exactly-once execution
- Human approval workflows (could wait days)

**Express Workflow (Async):**
- IoT data processing (millions of events/sec)
- Log transformation
- Mobile backends (high-frequency short tasks)
- Streaming data processing

**Express Workflow (Sync):**
- REST API backend orchestration (returns result synchronously)
- Request-response workflows < 5 minutes
- Replacing complex Lambda functions with multiple service calls

---

## 4. All State Types with Examples

### State Type Overview

| State | Purpose |
|-------|---------|
| Task | Do work (Lambda, SDK call, activity) |
| Choice | Conditional branching (if/else) |
| Wait | Pause execution (delay or until time) |
| Succeed | End with success |
| Fail | End with failure |
| Pass | Pass input to output (optionally transform) |
| Parallel | Execute branches simultaneously |
| Map | Iterate over an array |

---

### 1. Task State

The most common state. Calls an AWS service or activity.

```json
"ProcessPayment": {
  "Type": "Task",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
  "TimeoutSeconds": 30,
  "HeartbeatSeconds": 10,
  "ResultPath": "$.paymentResult",
  "Retry": [...],
  "Catch": [...],
  "Next": "ShipOrder"
}
```

---

### 2. Choice State

Implements conditional logic based on input values. Does NOT have a `Next` field — each `Choice` rule has its own `Next`.

```json
"CheckOrderValue": {
  "Type": "Choice",
  "Choices": [
    {
      "Variable": "$.order.amount",
      "NumericGreaterThanEquals": 1000,
      "Next": "RequireManagerApproval"
    },
    {
      "Variable": "$.order.customerTier",
      "StringEquals": "premium",
      "Next": "ExpressProcessing"
    },
    {
      "And": [
        {
          "Variable": "$.order.amount",
          "NumericGreaterThan": 100
        },
        {
          "Variable": "$.order.status",
          "StringEquals": "VERIFIED"
        }
      ],
      "Next": "StandardProcessing"
    }
  ],
  "Default": "RejectOrder"
}
```

**Supported comparison operators:**
- `StringEquals`, `StringGreaterThan`, `StringLessThan`, `StringMatches` (glob)
- `NumericEquals`, `NumericGreaterThan`, `NumericGreaterThanEquals`, `NumericLessThan`, `NumericLessThanEquals`
- `BooleanEquals`
- `TimestampEquals`, `TimestampGreaterThan`, `TimestampLessThan`
- `IsNull`, `IsString`, `IsNumeric`, `IsBoolean`, `IsTimestamp`
- `And`, `Or`, `Not` (logical combinations)
- `*Path` variants for comparing to input variables (e.g., `StringEqualsPath`)

---

### 3. Wait State

Pauses workflow execution for a specified time.

```json
// Wait for fixed duration
"WaitForPaymentProcessing": {
  "Type": "Wait",
  "Seconds": 30,
  "Next": "CheckPaymentStatus"
}

// Wait until specific timestamp
"WaitForScheduledDelivery": {
  "Type": "Wait",
  "Timestamp": "2026-12-25T09:00:00Z",
  "Next": "InitiateDelivery"
}

// Wait duration from input
"WaitForCustomDelay": {
  "Type": "Wait",
  "SecondsPath": "$.delaySeconds",
  "Next": "ProcessAfterDelay"
}

// Wait until timestamp from input
"WaitUntilScheduledTime": {
  "Type": "Wait",
  "TimestampPath": "$.scheduledDeliveryTime",
  "Next": "BeginDelivery"
}
```

**Key insight**: While waiting, you are NOT charged (Standard workflows) because no state transitions occur. This enables extremely long pauses (hours, days, weeks) at no cost.

---

### 4. Succeed State

Terminates execution successfully.

```json
"OrderCompleted": {
  "Type": "Succeed"
}
```

Can be used as a branch endpoint in Choice states where no further processing is needed.

---

### 5. Fail State

Terminates execution with a failure.

```json
"OrderFailed": {
  "Type": "Fail",
  "Error": "OrderProcessingFailed",
  "Cause": "Payment was declined by the payment processor"
}
```

---

### 6. Pass State

Passes input to output without doing any work. Optionally transforms the data.

```json
// Simple passthrough
"PassThrough": {
  "Type": "Pass",
  "Next": "NextState"
}

// Inject static data into execution
"AddMetadata": {
  "Type": "Pass",
  "Result": {
    "processedBy": "StepFunctions",
    "version": "v2",
    "environment": "prod"
  },
  "ResultPath": "$.metadata",
  "Next": "ProcessOrder"
}

// Transform input
"TransformInput": {
  "Type": "Pass",
  "Parameters": {
    "orderId.$": "$.order.id",
    "amount.$": "$.order.totalAmount",
    "currency": "USD"
  },
  "Next": "ProcessPayment"
}
```

**Use cases for Pass:**
- Injecting static configuration data into the workflow
- Renaming/restructuring fields without Lambda
- Mocking a state during development
- Adding constants to the execution context

---

### 7. Parallel State

Executes multiple independent branches simultaneously. All branches must complete before proceeding.

```json
"ProcessOrderInParallel": {
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "SendConfirmationEmail",
      "States": {
        "SendConfirmationEmail": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:SendEmail",
          "End": true
        }
      }
    },
    {
      "StartAt": "UpdateInventory",
      "States": {
        "UpdateInventory": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:UpdateInventory",
          "End": true
        }
      }
    },
    {
      "StartAt": "NotifyWarehouse",
      "States": {
        "NotifyWarehouse": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:NotifyWarehouse",
          "End": true
        }
      }
    }
  ],
  "ResultPath": "$.parallelResults",
  "Next": "FinalizeOrder"
}
```

**Key behaviors:**
- All branches start simultaneously
- Execution waits until ALL branches complete (or any branch fails)
- If any branch fails → entire Parallel state fails (unless error handled)
- Output is an array of each branch's output
- Each branch is an independent sub-state-machine

---

### 8. Map State

Iterates over an array in the input, processing each item with a sub-workflow.

```json
"ProcessOrderItems": {
  "Type": "Map",
  "ItemsPath": "$.order.items",
  "ItemSelector": {
    "item.$": "$$.Map.Item.Value",
    "orderId.$": "$.orderId"
  },
  "MaxConcurrency": 5,
  "Iterator": {
    "StartAt": "ProcessSingleItem",
    "States": {
      "ProcessSingleItem": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:...:function:ProcessItem",
        "End": true
      }
    }
  },
  "ResultPath": "$.processedItems",
  "Next": "CompileResults"
}
```

**Key parameters:**
- `ItemsPath`: JSONPath to the array in input
- `ItemSelector`: Shape of input for each iteration
- `MaxConcurrency`: How many items to process in parallel (0 = unlimited)
- `Iterator`: The sub-state-machine applied to each item
- `$$.Map.Item.Value`: The current item being processed
- `$$.Map.Item.Index`: The current item's index

**Concurrency control:**
```
MaxConcurrency: 0   = All items in parallel (unlimited)
MaxConcurrency: 1   = Sequential processing (one at a time)
MaxConcurrency: 10  = Up to 10 concurrent iterations
```

---

## 5. Amazon States Language (ASL)

### What is ASL?

Amazon States Language (ASL) is the JSON-based language used to define Step Functions state machines. It's a declarative language — you describe WHAT the workflow does, not HOW to implement it.

### Complete Order Processing State Machine Example

```json
{
  "Comment": "E-commerce order processing workflow",
  "StartAt": "ValidateOrder",
  "States": {
    
    "ValidateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ValidateOrder",
      "ResultPath": "$.validation",
      "Retry": [
        {
          "ErrorEquals": ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "OrderFailed",
          "ResultPath": "$.error"
        }
      ],
      "Next": "CheckIfValid"
    },
    
    "CheckIfValid": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.validation.isValid",
          "BooleanEquals": false,
          "Next": "RejectOrder"
        }
      ],
      "Default": "CheckInventory"
    },
    
    "RejectOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:RejectOrder",
      "End": true
    },
    
    "CheckInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:getItem",
      "Parameters": {
        "TableName": "Inventory",
        "Key": {
          "productId": {"S.$": "$.items[0].productId"}
        }
      },
      "ResultPath": "$.inventory",
      "Next": "ProcessPayment"
    },
    
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
      "TimeoutSeconds": 30,
      "ResultPath": "$.payment",
      "Retry": [
        {
          "ErrorEquals": ["PaymentGatewayTimeout"],
          "IntervalSeconds": 5,
          "MaxAttempts": 2,
          "BackoffRate": 1.5
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["PaymentDeclined"],
          "Next": "HandlePaymentDeclined",
          "ResultPath": "$.paymentError"
        }
      ],
      "Next": "FulfillOrderInParallel"
    },
    
    "HandlePaymentDeclined": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:NotifyPaymentDeclined",
      "Next": "OrderFailed"
    },
    
    "FulfillOrderInParallel": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "SendConfirmationEmail",
          "States": {
            "SendConfirmationEmail": {
              "Type": "Task",
              "Resource": "arn:aws:states:::sns:publish",
              "Parameters": {
                "TopicArn": "arn:aws:sns:us-east-1:123456789012:OrderConfirmations",
                "Message.$": "States.Format('Order {} confirmed!', $.orderId)"
              },
              "End": true
            }
          }
        },
        {
          "StartAt": "NotifyWarehouse",
          "States": {
            "NotifyWarehouse": {
              "Type": "Task",
              "Resource": "arn:aws:states:::sqs:sendMessage",
              "Parameters": {
                "QueueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/WarehouseQueue",
                "MessageBody.$": "States.JsonToString($.order)"
              },
              "End": true
            }
          }
        },
        {
          "StartAt": "UpdateOrderStatus",
          "States": {
            "UpdateOrderStatus": {
              "Type": "Task",
              "Resource": "arn:aws:states:::dynamodb:updateItem",
              "Parameters": {
                "TableName": "Orders",
                "Key": {
                  "orderId": {"S.$": "$.orderId"}
                },
                "UpdateExpression": "SET #status = :status",
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {":status": {"S": "CONFIRMED"}}
              },
              "End": true
            }
          }
        }
      ],
      "Next": "WaitForShipping"
    },
    
    "WaitForShipping": {
      "Type": "Wait",
      "SecondsPath": "$.estimatedShippingDelay",
      "Next": "InitiateShipping"
    },
    
    "InitiateShipping": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:InitiateShipping",
      "Next": "OrderCompleted"
    },
    
    "OrderCompleted": {
      "Type": "Succeed"
    },
    
    "OrderFailed": {
      "Type": "Fail",
      "Error": "OrderProcessingFailed",
      "Cause": "Order processing encountered an unrecoverable error"
    }
  }
}
```

### ASL Intrinsic Functions

Step Functions has built-in functions usable in Parameters:

| Function | Description | Example |
|----------|-------------|---------|
| `States.Format` | String interpolation | `States.Format('Hello, {}!', $.name)` |
| `States.StringToJson` | Parse JSON string | `States.StringToJson($.jsonString)` |
| `States.JsonToString` | Serialize to JSON string | `States.JsonToString($.object)` |
| `States.Array` | Create array | `States.Array($.a, $.b, $.c)` |
| `States.ArrayPartition` | Split array into chunks | `States.ArrayPartition($.items, 10)` |
| `States.ArrayContains` | Check if array has item | `States.ArrayContains($.arr, $.val)` |
| `States.ArrayRange` | Create range array | `States.ArrayRange(0, 9, 1)` |
| `States.ArrayGetItem` | Get item by index | `States.ArrayGetItem($.arr, 0)` |
| `States.ArrayLength` | Get array length | `States.ArrayLength($.arr)` |
| `States.ArrayUnique` | Deduplicate array | `States.ArrayUnique($.arr)` |
| `States.Base64Encode` | Base64 encode | `States.Base64Encode($.data)` |
| `States.Base64Decode` | Base64 decode | `States.Base64Decode($.encoded)` |
| `States.Hash` | Hash a value | `States.Hash($.data, 'SHA-256')` |
| `States.JsonMerge` | Merge two JSON objects | `States.JsonMerge($.obj1, $.obj2, false)` |
| `States.MathAdd` | Add numbers | `States.MathAdd($.total, 1)` |
| `States.MathRandom` | Random number | `States.MathRandom(1, 100, $.seed)` |
| `States.UUID` | Generate UUID | `States.UUID()` |

---

## 6. Error Handling: Catch and Retry

### Understanding Errors

Every state can throw errors. Common built-in error codes:

| Error Code | Description |
|-----------|-------------|
| `States.ALL` | Matches any error |
| `States.Timeout` | State exceeded `TimeoutSeconds` |
| `States.TaskFailed` | Task threw an error |
| `States.Permissions` | Insufficient IAM permissions |
| `States.HeartbeatTimeout` | Activity heartbeat not received |
| `States.BranchFailed` | A Parallel branch failed |
| `States.NoChoiceMatched` | No Choice rule matched (no Default) |
| `Lambda.ServiceException` | Lambda service-level errors |
| `Lambda.AWSLambdaException` | Lambda function error |
| `Lambda.TooManyRequestsException` | Lambda throttling |
| Custom error names | From your Lambda `raise Exception(...)` |

### Retry Block

Automatically retries a state on failure with configurable parameters.

```json
"ProcessPayment": {
  "Type": "Task",
  "Resource": "arn:aws:lambda:...:function:ProcessPayment",
  "Retry": [
    {
      "ErrorEquals": ["Lambda.TooManyRequestsException"],
      "IntervalSeconds": 1,
      "MaxAttempts": 5,
      "BackoffRate": 2,
      "MaxDelaySeconds": 30,
      "JitterStrategy": "FULL"
    },
    {
      "ErrorEquals": ["PaymentGatewayTimeout"],
      "IntervalSeconds": 5,
      "MaxAttempts": 3,
      "BackoffRate": 1.5
    },
    {
      "ErrorEquals": ["States.ALL"],
      "IntervalSeconds": 2,
      "MaxAttempts": 2,
      "BackoffRate": 1
    }
  ],
  "Next": "FulfillOrder"
}
```

**Retry parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ErrorEquals` | List of error codes to match | Required |
| `IntervalSeconds` | Initial wait before first retry | 1 |
| `MaxAttempts` | Maximum retry count | 3 |
| `BackoffRate` | Multiplier for interval after each retry | 2 |
| `MaxDelaySeconds` | Maximum wait between retries | None |
| `JitterStrategy` | `NONE` or `FULL` (adds randomness) | NONE |

**Backoff calculation example:**
```
IntervalSeconds: 2, BackoffRate: 2, MaxDelaySeconds: 30

Attempt 1: wait 2 seconds
Attempt 2: wait 4 seconds (2 × 2)
Attempt 3: wait 8 seconds (4 × 2)
Attempt 4: wait 16 seconds (8 × 2)
Attempt 5: wait 30 seconds (capped at MaxDelaySeconds)
```

**With FULL jitter** (best practice for distributed systems):
```
Jittered wait = random(0, calculated_wait)
Prevents thundering herd: multiple retries don't all fire simultaneously
```

### Catch Block

After retries are exhausted (or for non-retried errors), Catch provides a fallback path.

```json
"ProcessPayment": {
  "Type": "Task",
  "Resource": "arn:aws:lambda:...:function:ProcessPayment",
  "Retry": [...],
  "Catch": [
    {
      "ErrorEquals": ["PaymentDeclined"],
      "Next": "NotifyPaymentDeclined",
      "ResultPath": "$.error"
    },
    {
      "ErrorEquals": ["InsufficientFunds"],
      "Next": "OfferPaymentPlan",
      "ResultPath": "$.error"
    },
    {
      "ErrorEquals": ["States.ALL"],
      "Next": "OrderFailed",
      "ResultPath": "$.error"
    }
  ],
  "Next": "FulfillOrder"
}
```

**ResultPath in Catch:**
- `"$.error"`: Adds error info to existing input (recommended — preserves context)
- `null`: Discards the error details (use original input)
- `"$"`: Replaces input with error info (loses original data — avoid!)

**Error object shape:**
```json
{
  "Error": "PaymentDeclined",
  "Cause": "Card number ending 4242 was declined by issuer"
}
```

### Retry + Catch Together

```
State executes
     ↓
  Error occurs
     ↓
  Check Retry rules → match? → Retry with backoff
     ↓ (retries exhausted or no match)
  Check Catch rules → match? → Go to fallback state
     ↓ (no catch match)
  Execution FAILS
```

### Custom Error Names from Lambda

```python
class PaymentDeclinedException(Exception):
    pass

class InsufficientFundsException(Exception):
    pass

def lambda_handler(event, context):
    result = call_payment_api(event)
    
    if result['status'] == 'declined':
        raise PaymentDeclinedException('Card declined by issuer')
    
    if result['status'] == 'insufficient_funds':
        raise InsufficientFundsException('Not enough funds')
    
    return {'paymentId': result['id'], 'status': 'approved'}
```

Step Functions Catch block:
```json
"Catch": [
  {
    "ErrorEquals": ["PaymentDeclinedException"],
    "Next": "HandleDeclined"
  },
  {
    "ErrorEquals": ["InsufficientFundsException"],
    "Next": "HandleInsufficientFunds"
  }
]
```

---

## 7. SDK Integration Types

### Overview

Step Functions can integrate with AWS services in three ways that differ in how they handle asynchronous work.

### Type 1: Request-Response (Default)

Step Functions calls the API and immediately moves to the next state after receiving the HTTP response. Does NOT wait for the underlying work to complete.

```json
"StartLambdaAsync": {
  "Type": "Task",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
  "Next": "NextState"
  // Step Functions moves to NextState as soon as Lambda is invoked
  // Does NOT wait for Lambda to finish processing
}
```

**Use when**: Triggering fire-and-forget operations (send email, start a background process), or when you don't need the result.

### Type 2: .sync (Synchronous Wait)

Step Functions calls the API and WAITS for the work to complete. Uses the service's polling mechanism.

Resource ARN suffix: `:2` for optimized integrations.

```json
"StartECSTask": {
  "Type": "Task",
  "Resource": "arn:aws:states:::ecs:runTask.sync:2",
  "Parameters": {
    "Cluster": "MyCluster",
    "TaskDefinition": "MyTaskDef",
    "LaunchType": "FARGATE",
    "NetworkConfiguration": {
      "AwsvpcConfiguration": {
        "Subnets": ["subnet-abc123"],
        "AssignPublicIp": "ENABLED"
      }
    }
  },
  "Next": "ProcessECSResults"
  // Waits until ECS task is STOPPED before moving to ProcessECSResults
}
```

**Services supporting .sync:**
- Lambda (`.sync:2`) — waits for function to return
- ECS (`runTask.sync`) — waits for task to stop
- Glue (`startJobRun.sync`) — waits for job to complete
- Batch (`submitJob.sync`) — waits for job to complete
- Step Functions (`startExecution.sync`) — waits for child execution
- SageMaker (various operations)
- Athena (`startQueryExecution.sync`)
- CodeBuild (`startBuild.sync`)

**How .sync works internally:**
Step Functions polls the service's status API (e.g., `DescribeTasks`, `GetJobRun`) until the operation reaches a terminal state. This is transparent to you.

### Type 3: .waitForTaskToken (Callback Pattern)

Step Functions pauses execution and waits for an external system to call `SendTaskSuccess` or `SendTaskFailure` with the task token. Used for:
- Human approval workflows
- Calling legacy systems and waiting for response
- Long-running external processes
- IoT device responses

**How it works:**

```
Step Functions executes state
    ↓
Generates unique task token (UUID)
    ↓
Sends task token to resource (Lambda, SQS, etc.)
    ↓
PAUSES (waits, no charge for wait time in Standard)
    ↓
External system processes
    ↓
External system calls SendTaskSuccess(taskToken, output)
    ↓
Step Functions resumes with the provided output
```

**Task state definition:**
```json
"WaitForHumanApproval": {
  "Type": "Task",
  "Resource": "arn:aws:states:::sqs:sendMessage.waitForTaskToken",
  "Parameters": {
    "QueueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/ApprovalQueue",
    "MessageBody": {
      "orderId.$": "$.orderId",
      "amount.$": "$.amount",
      "taskToken.$": "$$.Task.Token"
    }
  },
  "HeartbeatSeconds": 86400,
  "TimeoutSeconds": 604800,
  "Next": "ProcessApproval"
}
```

Note: `$$.Task.Token` is the task token injected by Step Functions.

**Approval Lambda (worker processes the token):**
```python
import boto3

sfn_client = boto3.client('stepfunctions')

def handle_approval_decision(task_token: str, approved: bool, reviewer: str):
    if approved:
        sfn_client.send_task_success(
            taskToken=task_token,
            output=json.dumps({
                'approved': True,
                'reviewedBy': reviewer,
                'reviewedAt': datetime.utcnow().isoformat()
            })
        )
    else:
        sfn_client.send_task_failure(
            taskToken=task_token,
            error='OrderRejected',
            cause=f'Order rejected by {reviewer}'
        )
```

**Heartbeat**: To prevent the workflow from timing out during the wait, the worker can call `send_task_heartbeat(taskToken=token)` to indicate it's still alive.

### Integration Type Summary

| Type | Suffix | When Step Functions proceeds | Use Case |
|------|--------|------------------------------|---------|
| Request-Response | (none) | Immediately after API call | Fire-and-forget |
| Sync | `.sync` or `.sync:2` | When service operation completes | Long-running service operations |
| WaitForTaskToken | `.waitForTaskToken` | When external system calls SendTaskSuccess | Human approval, external systems |

---

## 8. Distributed Map

### What is Distributed Map?

Distributed Map is an enhanced version of the Map state designed to process **large-scale data** — millions of items — from S3 or other sources. It can process items in massively parallel child executions (vs regular Map which runs as part of the parent execution).

### Regular Map vs Distributed Map

| Feature | Map State | Distributed Map |
|---------|-----------|-----------------|
| Items source | JSON array in input | S3 objects, S3 inventory, JSON array |
| Scale | Thousands | Millions |
| Execution type | Inline (part of parent) | Child executions (Standard or Express) |
| Max concurrency | 40 | 10,000 concurrent child executions |
| S3 integration | No | Yes (direct from S3) |
| Use case | Process small arrays | Process S3 datasets at scale |

### Use Cases

1. **S3 data processing**: Process millions of records in CSV/JSON files in S3
2. **Bulk database operations**: Update millions of DynamoDB records
3. **Media transcoding**: Process thousands of video files
4. **Data migration**: Migrate millions of records between databases
5. **Machine learning inference**: Run batch inference on millions of items

### Distributed Map Configuration

```json
"ProcessMillionsOfRecords": {
  "Type": "Map",
  "ItemProcessor": {
    "ProcessorConfig": {
      "Mode": "DISTRIBUTED",
      "ExecutionType": "STANDARD"
    },
    "StartAt": "ProcessRecord",
    "States": {
      "ProcessRecord": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:...:function:ProcessRecord",
        "End": true
      }
    }
  },
  "ItemReader": {
    "Resource": "arn:aws:states:::s3:getObject",
    "ReaderConfig": {
      "InputType": "JSON",
      "MaxItems": 1000000
    },
    "Parameters": {
      "Bucket": "my-data-bucket",
      "Key": "data/records.json"
    }
  },
  "MaxConcurrency": 1000,
  "ToleratedFailurePercentage": 5,
  "ItemBatcher": {
    "MaxItemsPerBatch": 100,
    "MaxInputBytesPerBatch": 262144
  },
  "ResultWriter": {
    "Resource": "arn:aws:states:::s3:putObject",
    "Parameters": {
      "Bucket": "my-results-bucket",
      "Prefix": "results/"
    }
  },
  "Next": "CompileResults"
}
```

**Key parameters:**
- `Mode: DISTRIBUTED` — enables distributed processing
- `ExecutionType` — child execution type (STANDARD or EXPRESS)
- `MaxConcurrency` — up to 10,000 concurrent child executions
- `ToleratedFailurePercentage` — allow up to X% child failures before parent fails
- `ItemBatcher` — group items into batches before passing to each child
- `ResultWriter` — write results to S3 instead of returning in-memory

### S3 Input Sources

| InputType | Description |
|-----------|-------------|
| `JSON` | Array of JSON objects |
| `CSV` | CSV file with header row |
| `MANIFEST` | S3 inventory manifest file |

---

## 9. Integration with AWS Services

### Lambda Integration

```json
// Synchronous Lambda call (most common)
"InvokeLambda": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": {
    "FunctionName": "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
    "Payload.$": "$"
  },
  "ResultSelector": {
    "body.$": "$.Payload"
  },
  "Next": "Next"
}
```

### DynamoDB Integration (Direct, No Lambda)

```json
// PutItem
"SaveOrder": {
  "Type": "Task",
  "Resource": "arn:aws:states:::dynamodb:putItem",
  "Parameters": {
    "TableName": "Orders",
    "Item": {
      "orderId": {"S.$": "$.orderId"},
      "status": {"S": "CREATED"},
      "amount": {"N.$": "States.Format('{}', $.amount)"},
      "createdAt": {"S.$": "$$.Execution.StartTime"}
    }
  },
  "ResultPath": null,
  "Next": "NextState"
}

// GetItem
"GetOrder": {
  "Type": "Task",
  "Resource": "arn:aws:states:::dynamodb:getItem",
  "Parameters": {
    "TableName": "Orders",
    "Key": {
      "orderId": {"S.$": "$.orderId"}
    }
  },
  "ResultPath": "$.orderData",
  "Next": "ProcessOrder"
}

// UpdateItem
"UpdateOrderStatus": {
  "Type": "Task",
  "Resource": "arn:aws:states:::dynamodb:updateItem",
  "Parameters": {
    "TableName": "Orders",
    "Key": {"orderId": {"S.$": "$.orderId"}},
    "UpdateExpression": "SET #s = :s, updatedAt = :t",
    "ExpressionAttributeNames": {"#s": "status"},
    "ExpressionAttributeValues": {
      ":s": {"S": "SHIPPED"},
      ":t": {"S.$": "$$.State.EnteredTime"}
    }
  },
  "ResultPath": null,
  "Next": "Done"
}
```

### SNS Integration

```json
"SendNotification": {
  "Type": "Task",
  "Resource": "arn:aws:states:::sns:publish",
  "Parameters": {
    "TopicArn": "arn:aws:sns:us-east-1:123456789012:OrderNotifications",
    "Message.$": "States.Format('Order {} has been processed', $.orderId)",
    "Subject": "Order Update",
    "MessageAttributes": {
      "orderType": {
        "DataType": "String",
        "StringValue.$": "$.orderType"
      }
    }
  },
  "ResultPath": null,
  "Next": "Done"
}
```

### SQS Integration

```json
"QueueForProcessing": {
  "Type": "Task",
  "Resource": "arn:aws:states:::sqs:sendMessage",
  "Parameters": {
    "QueueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/WorkQueue",
    "MessageBody.$": "States.JsonToString($)",
    "MessageGroupId.$": "$.customerId"
  },
  "ResultPath": null,
  "Next": "WaitingForProcessing"
}
```

### ECS Integration

```json
"RunContainerTask": {
  "Type": "Task",
  "Resource": "arn:aws:states:::ecs:runTask.sync:2",
  "Parameters": {
    "Cluster": "arn:aws:ecs:us-east-1:123456789012:cluster/MyCluster",
    "TaskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/DataProcessor:5",
    "LaunchType": "FARGATE",
    "NetworkConfiguration": {
      "AwsvpcConfiguration": {
        "Subnets": ["subnet-abc123def456"],
        "SecurityGroups": ["sg-12345678"],
        "AssignPublicIp": "ENABLED"
      }
    },
    "Overrides": {
      "ContainerOverrides": [
        {
          "Name": "DataProcessor",
          "Environment": [
            {
              "Name": "INPUT_FILE",
              "Value.$": "$.s3Key"
            }
          ]
        }
      ]
    }
  },
  "Next": "ProcessResults"
}
```

### Step Functions Within Step Functions (Child Execution)

```json
"StartChildWorkflow": {
  "Type": "Task",
  "Resource": "arn:aws:states:::states:startExecution.sync:2",
  "Parameters": {
    "StateMachineArn": "arn:aws:states:us-east-1:123456789012:stateMachine:ChildWorkflow",
    "Input.$": "$.childInput",
    "Name.$": "States.Format('child-{}', $.executionId)"
  },
  "Next": "ProcessChildResult"
}
```

---

## 10. Use Cases

### Use Case 1: Order Processing Workflow

```
                    ┌─────────────────────────────────────────────┐
                    │           Order Processing Workflow          │
                    │                                              │
                    │  Start                                       │
                    │    ↓                                         │
                    │  ValidateOrder (Task: Lambda)                │
                    │    ↓                                         │
                    │  IsValid? (Choice)                           │
                    │    ├── No → RejectOrder (Task) → End        │
                    │    └── Yes ↓                                 │
                    │  CheckInventory (Task: DynamoDB GetItem)     │
                    │    ↓                                         │
                    │  InStock? (Choice)                           │
                    │    ├── No → BackorderOrReject (Choice)      │
                    │    └── Yes ↓                                 │
                    │  ProcessPayment (Task: Lambda)               │
                    │    ↓                                         │
                    │  Parallel Fulfillment:                       │
                    │    ├── SendEmail (Task: SNS)                 │
                    │    ├── NotifyWarehouse (Task: SQS)           │
                    │    └── UpdateInventory (Task: DynamoDB)      │
                    │    ↓                                         │
                    │  WaitForShipping (Wait: timestampPath)       │
                    │    ↓                                         │
                    │  InitiateShipping (Task: Lambda)             │
                    │    ↓                                         │
                    │  OrderCompleted (Succeed)                    │
                    └─────────────────────────────────────────────┘
```

### Use Case 2: Image Processing Pipeline

```
Upload to S3 → EventBridge → Step Functions Start

Workflow:
1. ValidateImage (Task: Lambda)
   - Check file type, size
   
2. ExtractMetadata (Task: Lambda)
   - EXIF data, dimensions
   
3. GenerateThumbnails (Parallel)
   ├── Generate 100x100 thumbnail (Task: Lambda)
   ├── Generate 400x400 thumbnail (Task: Lambda)
   └── Generate 800x800 thumbnail (Task: Lambda)
   
4. RunContentModeration (Task: Lambda → Rekognition)
   
5. ContentApproved? (Choice)
   ├── No → DeleteImage + NotifyUploader
   └── Yes ↓
   
6. UpdateDatabase (Task: DynamoDB PutItem)

7. PublishCDN (Task: CloudFront Invalidation)

8. NotifyUploader (Task: SNS)

9. ImageProcessingComplete (Succeed)
```

### Use Case 3: Human Approval Workflow

```
1. Order submitted
2. Check if amount > $10,000 (Choice)
   ├── No → Auto-approve → Continue
   └── Yes ↓
3. SendApprovalRequest (Task: SQS.waitForTaskToken)
   - Email sent to manager with approve/reject links
   - Workflow PAUSES (could be hours/days)
4. Manager clicks Approve/Reject
5. API Lambda calls SendTaskSuccess/SendTaskFailure with taskToken
6. Workflow RESUMES
7. ApprovalDecision? (Choice)
   ├── Rejected → NotifyRejected → End
   └── Approved → ContinueProcessing
```

---

## 11. Interview Q&A

---

**Q1: What is AWS Step Functions and what problem does it solve?**

**A:** Step Functions is a serverless workflow orchestration service that coordinates multiple AWS services into multi-step workflows. It solves several problems with doing orchestration in Lambda: (1) Lambda has a 15-minute timeout — Step Functions workflows run up to 1 year; (2) Retry/error handling in Lambda is complex code — Step Functions declares it in ASL; (3) Parallel execution requires complex async code — Step Functions has a Parallel state; (4) Debugging distributed workflows is painful — Step Functions provides visual execution history with input/output at each step; (5) Long waits (waiting for human approval) require polling loops — Step Functions' waitForTaskToken pauses for free.

---

**Q2: What is the difference between Standard and Express workflows?**

**A:** Standard workflows run up to 1 year, have exactly-once execution semantics, store execution history for 90 days (queryable via API), and are priced per state transition ($0.025/1000). Best for long-running, auditable workflows (order processing, approvals, user onboarding).

Express workflows run up to 5 minutes, have at-least-once (async) or at-most-once (sync) semantics, log to CloudWatch only, and are priced by duration and requests. Best for high-volume, short-duration events (IoT processing, log transformation, high-frequency microservice calls). Express Sync returns the result synchronously — useful as an API backend orchestrator.

---

**Q3: Describe all state types in Step Functions.**

**A:** Task: Executes work (Lambda, SDK calls, activities). Choice: Conditional branching based on input data (if/else/switch). Wait: Pauses execution for a duration or until a timestamp — free in Standard. Succeed: Terminal state that ends execution successfully. Fail: Terminal state that ends execution with error and cause. Pass: Passes input to output without doing work, optionally injecting static data or transforming structure. Parallel: Executes multiple independent branches simultaneously; waits for all to complete. Map: Iterates over an input array, applying a sub-workflow to each item with configurable concurrency.

---

**Q4: Explain the three SDK integration types in Step Functions.**

**A:** Request-Response (default): Step Functions sends the API call and immediately proceeds to the next state after receiving the HTTP response. It does NOT wait for the underlying work to finish. Use for fire-and-forget operations.

.sync (or .sync:2): Step Functions waits for the service operation to complete before proceeding. Internally, Step Functions polls the service for completion. Use for Lambda, ECS tasks, Glue jobs, Batch jobs where you need the result.

.waitForTaskToken: Step Functions pauses and inserts a unique task token into the payload sent to the resource. Execution resumes ONLY when an external system calls `SendTaskSuccess` or `SendTaskFailure` with that token. Use for human approvals, external system callbacks, or any scenario where processing time is unbounded.

---

**Q5: How does error handling work in Step Functions? Explain Retry and Catch.**

**A:** Retry and Catch are defined per state. When a state fails, Step Functions first checks Retry rules in order. If a matching rule exists (ErrorEquals), it retries with the configured interval and backoff. Retries are exhausted when MaxAttempts is reached.

After retries are exhausted (or if no matching Retry rule), Catch rules are checked. If a matching Catch rule exists, execution transitions to the specified fallback state. The error details (Error, Cause) are captured into the ResultPath so the fallback state has context.

Exponential backoff with `BackoffRate`: delay = IntervalSeconds × BackoffRate^(attempt-1). Use `MaxDelaySeconds` to cap the wait. Use `JitterStrategy: FULL` to add randomness and prevent thundering herd. `States.ALL` matches any error — put it last as a catch-all.

---

**Q6: How does waitForTaskToken work? Give a real example.**

**A:** Step Functions generates a unique task token (UUID) and includes `$$.Task.Token` in the payload sent to the resource (Lambda, SQS, API Gateway, etc.). The execution completely PAUSES — no polling, no cost for the wait time in Standard workflows. It can wait up to the state's `TimeoutSeconds` (up to 1 year).

Real example — human approval: A high-value order triggers a workflow. The `WaitForApproval` state sends a message to an SQS queue containing the order details and the task token. A Lambda function processes the queue message, sends an email to a manager with approve/reject URLs. When the manager clicks Approve, a Lambda API handler calls `sfn_client.send_task_success(taskToken=token, output='{"approved": true}')`. The Step Functions execution resumes exactly where it paused. If 24 hours pass without a response, `HeartbeatSeconds` can trigger a timeout.

---

**Q7: What is Distributed Map and when would you use it?**

**A:** Distributed Map runs a sub-workflow on millions of items from S3 (JSON, CSV, or S3 inventory manifest) by creating child executions. Regular Map is limited to items in the in-memory JSON input and runs inline. Distributed Map creates up to 10,000 concurrent child executions and writes results back to S3.

Use when: Processing large S3 datasets (millions of records), running parallel inference across thousands of S3 files, bulk DynamoDB operations, large-scale data transformation pipelines. Key advantage: `ToleratedFailurePercentage` allows some child executions to fail without failing the whole job. `ItemBatcher` groups items into batches per child execution to reduce overhead. Results are written to S3 via `ResultWriter` rather than returned in memory.

---

**Q8: How do you implement a long wait (e.g., "send email in 7 days") in Step Functions?**

**A:** Use the Wait state with a dynamic timestamp from the input. In your workflow, when you need to wait 7 days: set a state like `{"Type": "Wait", "TimestampPath": "$.scheduledAt", "Next": "SendEmail"}`. Your Lambda or the input provides the future timestamp. Step Functions pauses at zero cost (Standard workflow) until that timestamp.

This is far more reliable than other approaches (Lambda scheduled events, EventBridge scheduler workarounds). The workflow maintains full state context and resumes automatically. For 7-day waits, use Standard workflow (supports up to 1 year). The execution is paused, not polling — so there's no cost during the wait period, and resumption is precise to the second.

---

**Q9: Explain the Parallel state. What happens if one branch fails?**

**A:** The Parallel state starts all branches simultaneously when entered. Each branch is an independent sub-state-machine. The Parallel state waits until ALL branches complete successfully before proceeding to the next state. The output is an array containing each branch's output in order.

If any branch fails (reaches a Fail state or throws unhandled error), the entire Parallel state fails immediately. Other running branches are cancelled. If the Parallel state has a Retry rule, ALL branches restart from the beginning on retry. If the Parallel state has a Catch rule, execution transitions to the catch state with the error details.

Best practice: Add error handling within each branch for branch-specific recoverable errors. Use Catch on the Parallel state only for truly unrecoverable failures.

---

**Q10: What are Step Functions intrinsic functions and give three useful examples?**

**A:** Intrinsic functions are built-in functions available in the `Parameters` block to transform data without needing Lambda. Called with `States.*` prefix.

Three useful examples:

1. `States.Format('Order {} shipped to {}', $.orderId, $.address)` — string interpolation to build messages/SNS subjects without Lambda.

2. `States.JsonToString($.object)` — converts a JSON object to a string. Essential for passing structured data to services that accept string inputs (SQS MessageBody must be a string; SNS Message must be a string).

3. `States.UUID()` — generates a UUID. Use as a unique execution name for child Step Functions executions, or as an idempotency key for DynamoDB operations or Lambda invocations, without needing a Lambda function just to generate an ID.

---

*End of AWS Step Functions Complete Guide*
