# Local Message Queues and Topics — Complete Guide

> "A mailbox holds physical letters until you retrieve them at your convenience; a radio tower broadcasts signals instantly to anyone tuned in to the frequency."

---

## Table of Contents

1. [The Problem: Synchronous Bottlenecks in API Architectures](#1-the-problem-synchronous-bottlenecks-in-api-architectures)
2. [The Postal Service vs. Broadcasting Analogy](#2-the-postal-service-vs-broadcasting-analogy)
3. [The Mechanism: Local Message Queuing and Fan-out Subscriptions](#3-the-mechanism-local-message-queuing-and-fan-out-subscriptions)
4. [Diagram: SNS to SQS Message Fan-out Architecture](#4-diagram-sns-to-sqs-message-fan-out-architecture)
5. [Code Walkthrough: Node.js Message Publisher and Consumer Worker](#5-code-walkthrough-node-js-message-publisher-and-consumer-worker)
6. [Comparing SQS (Queues) and SNS (Topics)](#6-comparing-sqs-queues-and-sns-topics)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Synchronous Bottlenecks in API Architectures

In a standard monolithic MERN application, when a user completes a purchase, the backend server might perform several actions: process the payment, send an email, update inventory, and notify shipping.

### The Failure Chain

If these actions occur synchronously inside a single HTTP request, any failure in a downstream service (like a slow email provider API) blocks the entire response. The user sees a spinning wheel, and the database connection remains open.

### Cloud Cost and Logging Overhead

Testing messaging queues (SQS) and topics (SNS) on live AWS introduces network overhead and increases costs. If an application generates millions of messages during testing, the read/write API actions (`SendMessage`, `ReceiveMessage`, `Publish`) incur significant charges.

---

## 2. The Postal Service vs. Broadcasting Analogy

A postal mailbox holds letters. The letter sits inside the box until the homeowner arrives, opens the box, and retrieves it.

### Buffered Queueing

If the homeowner is busy, the mail remains safe inside the mailbox. It does not disappear, and no one else can read it. This represents SQS queueing, which buffers tasks until a worker is ready to process them.

### Broadcast Transmission

A radio station broadcasts a song. Thousands of cars receive the signal simultaneously. If a car radio is turned off, they miss the song; the radio station does not buffer it for them. This represents SNS pub-sub, which broadcasts messages instantly to active subscribers.

---

## 3. The Mechanism: Local Message Queuing and Fan-out Subscriptions

Floci emulates SQS and SNS by running a mock broker inside the container, exposing the standard AWS messaging APIs on port `4566`.

### Local Queue Operations

When an SQS queue is created locally, Floci allocates an in-memory queue data structure. The API endpoints handle standard polling queries (`ReceiveMessage`) and delete receipts (`DeleteMessage`), matching the SQS visibility timeout mechanics.

### Fan-out Subscriptions

You can subscribe multiple local SQS queues to a single local SNS topic. When a message is published to the SNS topic, Floci intercepts the call, duplicates the payload, and pushes a copy into every subscribed SQS queue. This allows you to test multi-recipient message fan-out offline.

---

## 4. Diagram: SNS to SQS Message Fan-out Architecture

### The Fan-out Configuration

```text
  [Publish Event] ──► [Local SNS Topic: orders-topic]
                                │
                 ┌──────────────┴──────────────┐ (Subscriptions)
                 ▼                             ▼
    [Local SQS: inventory-queue]  [Local SQS: shipping-queue]
                 │                             │
                 ▼ (Worker 1)                  ▼ (Worker 2)
       [Inventory Service]            [Shipping Service]
```

### Strategic Advantage

Adding new consumer queues requires zero changes to the publisher code. The SNS topic automatically distributes messages to all subscribers, enabling decoupled microservices.

---

## 5. Code Walkthrough: Node.js Message Publisher and Consumer Worker

The following scripts demonstrate how to publish a message to an SQS queue and write a worker that polls for messages and processes them.

### SQS Message Publisher Script

```js
// sqs-publisher.js
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "mock-key", secretAccessKey: "mock-secret" }
});

async function publishMessage(queueUrl, payload) {
  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
      DelaySeconds: 0
    });
    const result = await sqsClient.send(command);
    console.log(`Message sent. MessageId: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error("Publish failed:", error.message);
  }
}

publishMessage("http://localhost:4566/000000000000/local-orders-queue", { orderId: 8821, total: 45 });
```

### SQS Consumer Worker Script

```js
// sqs-worker.js
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "mock-key", secretAccessKey: "mock-secret" }
});

async function pollQueue(queueUrl) {
  try {
    const response = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: 10 // Message hidden from other consumers for 10s
    }));

    if (response.Messages && response.Messages.length > 0) {
      const message = response.Messages[0];
      console.log("Processing message body:", message.Body);

      // Delete message from queue after successful processing
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      }));
      console.log("Message processed and deleted from queue.");
    }
  } catch (error) {
    console.error("Worker error:", error.message);
  }
}

// Poll every 2 seconds
setInterval(() => pollQueue("http://localhost:4566/000000000000/local-orders-queue"), 2000);
```

---

## 6. Comparing SQS (Queues) and SNS (Topics)

### Messaging Comparison

| Feature | SQS (Simple Queue Service) | SNS (Simple Notification Service) |
|---|---|---|
| Model | Pull-based (consumers poll queue) | Push-based (publishes to endpoints) |
| Persistence | Messages stored up to 14 days | Ephemeral (delivered or lost) |
| Consumers | Competing workers (one gets message) | Fan-out (all subscribers get copy) |
| Ordering | FIFO queues guarantee order | Standard topics are unordered |
| Primary Use | Buffering, throttling workloads | Event broadcasting, email notifications |
| Local Parity | Fully emulated via memory queues | Fully emulated via local event links |

---

## 7. Common Mistakes

- **Forgetting to delete SQS messages after processing.** If a worker processes a message but fails to call `DeleteMessage`, the message becomes visible again in the queue after the visibility timeout, causing duplicate processing.
- **Using SNS topics without active subscriptions.** Publishing to an SNS topic with no active subscriptions means the message is dropped, and no log or queue stores it.
- **Hardcoding Queue URLs with public domains.** SQS URLs in local emulators contain the account `000000000000`. Keep this URL configurable to prevent the application from hitting live endpoints in production.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize a Node.js project, install `@aws-sdk/client-sqs`, and run the publisher script from Section 5.

**Exercise 2:** Create a local SQS queue using the CLI command `aws sqs create-queue --queue-name local-orders-queue`.

**Exercise 3:** Write a script that spins up the consumer worker from Section 5, publishes 3 messages, and monitors the terminal log outputs.

**Exercise 4:** Create a local SNS topic (`aws sns create-topic`), subscribe your SQS queue to it, publish a message to the topic, and confirm the message appears in the SQS queue.

**Exercise 5:** Verify the SQS visibility timeout mechanics by setting the parameter to 5 seconds and checking if a message reappears when not deleted.

---

## 9. Interview Q&A

**Q: What is the SQS Visibility Timeout, and why is it important?**
It is the period during which SQS prevents other consumers from receiving and processing a message after a worker has retrieved it. It gives the worker time to process the task and call `DeleteMessage`. If the worker crashes or fails within this window, the message becomes visible again to other workers, preventing message loss.

**Q: What is the "fan-out" pattern in AWS messaging, and how is it implemented?**
The fan-out pattern is an architectural design where a single message published to an SNS topic is distributed to multiple SQS queues. It is implemented by creating an SNS topic, creating multiple SQS queues, and subscribing those queues to the SNS topic.

**Q: What is a Dead-Letter Queue (DLQ), and why is it used?**
A DLQ is an SQS queue used to isolate messages that cannot be processed successfully after a configured number of retries (defined by the Redrive Policy). It prevents "poison-pill" messages from blocking the main queue and allows developers to inspect failed payloads.

**Q: What is the difference between standard SQS queues and SQS FIFO queues?**
Standard queues offer high throughput but do not guarantee exact ordering and support at-least-once delivery (duplicates possible). FIFO (First-In-First-Out) queues guarantee exact ordering and exactly-once delivery, at the cost of lower maximum throughput.

**Q: How do you configure a subscriber SQS queue to receive messages from an SNS topic?**
You create the SNS topic and the SQS queue, then call `aws sns subscribe` passing the SQS queue ARN as the endpoint, the SNS topic ARN, and setting the protocol to `sqs`. You must also attach a queue policy allowing the SNS service to call `sqs:SendMessage` on the queue.
