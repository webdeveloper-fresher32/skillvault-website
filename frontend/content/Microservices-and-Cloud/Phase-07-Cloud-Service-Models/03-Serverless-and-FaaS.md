# Serverless and FaaS

The newest evolution in cloud computing is **Serverless**, heavily driven by **Functions as a Service (FaaS)**. 

"Serverless" is a misnomer; there are still servers, but you, the developer, never see them, provision them, or pay for them when they are idle.

## What is FaaS?

In IaaS or PaaS, you deploy a long-running server process (e.g., a Node.js Express server) that runs 24/7, waiting for HTTP requests. You pay for that server every hour it runs, even if no one visits your website at 3 AM.

In FaaS, you do not deploy an application. You deploy individual **functions** (snippets of code).

**Examples:**
- AWS Lambda
- Google Cloud Functions
- Azure Functions

### The Event-Driven Execution Model

A FaaS function sits completely dormant (and costs $0) until it is triggered by an **Event**.
- An HTTP request comes in via an API Gateway.
- A new image is uploaded to an S3 bucket.
- A message is placed on a Kafka queue.

When the event occurs, the cloud provider instantly provisions a micro-container, injects your function code, executes it, returns the result, and destroys the container. 

### Pros of Serverless / FaaS

1. **Scale to Zero**: If your function is not executed, you pay exactly $0.00. 
2. **Infinite Auto-Scaling**: If your function is triggered once, the provider spins up 1 container. If 10,000 users click a button at the exact same millisecond, the provider instantly spins up 10,000 isolated containers to handle the requests concurrently.
3. **No Operational Overhead**: There is absolutely no OS patching, no load balancer configuration, and no server maintenance.

### Cons of Serverless / FaaS

1. **Cold Starts**: When a function hasn't been executed recently, the provider must provision a new container from scratch. This can add a noticeable delay (100ms - 2 seconds) to the first execution, known as a "cold start."
2. **Execution Limits**: Functions are designed for short tasks. AWS Lambda, for example, will forcefully terminate your code if it runs for more than 15 minutes.
3. **State**: Functions are strictly stateless. Any data you need to persist must be saved to an external database (like DynamoDB) before the function finishes executing.

## Summary

- **FaaS (Serverless)** allows you to deploy individual functions rather than full applications.
- Functions execute in response to events and scale from 0 to 10,000 instantly.
- You are billed in increments of 1 millisecond. If your code isn't running, you don't pay.
- The major drawbacks are Cold Starts and execution time limits.
