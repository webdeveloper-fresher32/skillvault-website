# Local CloudWatch and SAM CLI — Complete Guide

> "A car dashboard displays real-time speed, oil levels, and engine temperature, warning the driver with alert lights before a component breaks down."

---

## Table of Contents

1. [The Problem: Debugging Serverless Outputs and Deployment Cycles](#1-the-problem-debugging-serverless-outputs-and-deployment-cycles)
2. [The Dashboard and Warning Light Analogy](#2-the-dashboard-and-warning-light-analogy)
3. [The Mechanism: CloudWatch Logs and SAM CLI template mapping](#3-the-mechanism-cloudwatch-logs-and-sam-cli-template-mapping)
4. [Diagram: SAM CLI Local Invoke and Event Routing](#4-diagram-sam-cli-local-invoke-and-event-routing)
5. [Code Walkthrough: SAM template.yaml and EventBridge cron config](#5-code-walkthrough-sam-templateyaml-and-eventbridge-cron-config)
6. [Comparing SAM Local execution to Live CloudFormation](#6-comparing-sam-local-execution-to-live-cloudformation)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Debugging Serverless Outputs and Deployment Cycles

Developing microservices without real-time observability is like flying blind. If your serverless backend throws an error, you need access to logs and execution metrics immediately.

### The Live Cloud Logging Delay

In public AWS, Lambda execution outputs are streamed to CloudWatch Logs. Querying these logs involves logging into the console or waiting for log groups to sync, which introduces several seconds of delay during hot debugging loops.

### CloudFormation Configuration Latency

Deploying serverless frameworks using raw CloudFormation requires compiling long YAML configs and waiting for stacks to create. If your template has a minor indentation error, AWS rolls back the entire deployment stack, which takes minutes.

---

## 2. The Dashboard and Warning Light Analogy

A driver operates a motor vehicle. They do not look under the hood to check engine RPM or temperature while driving.

### Aggregated Metrics

Instead, the dashboard summarizes system health. Speed, fuel levels, and tire pressure are aggregated onto simple dials. A red warning light alerts you to low oil pressure immediately, saving the engine from damage.

### Virtual Test Benches

Before an engine is installed in a car, technicians mount it on a test bench. They connect sensors to read exhaust metrics and rev the engine safely without putting it on a highway. The AWS SAM CLI acts as this virtual test bench for serverless functions.

---

## 3. The Mechanism: CloudWatch Logs and SAM CLI template mapping

AWS CloudWatch aggregates logs and metrics, and EventBridge (formerly CloudWatch Events) manages cron schedules.

### Local Log Group Mapping

When your Lambda functions call `console.log()` inside Floci, the emulator redirects standard outputs to a mock CloudWatch log group. You can read, filter, and stream these streams locally via port `4566` using CLI log queries.

### SAM CLI Local Execution

The AWS SAM (Serverless Application Model) CLI extends CloudFormation. It reads a `template.yaml` file declaring your serverless resources. When you run `sam local invoke`, the SAM CLI mounts your function code directory into a transient Docker container on your host, executes the event payload, and shuts down instantly.

---

## 4. Diagram: SAM CLI Local Invoke and Event Routing

### The Local Invocation Flow

```text
  [sam local invoke MyFunction -e event.json]
                       │
                       ▼  (Reads template.yaml configuration)
  [Host Docker Daemon] ──► Launches runtime container (e.g. nodejs20.x)
                                │
                                ▼  (Mounts code folder and passes event)
                     [Transient Runtime Container]
                                │
                 ┌──────────────┴──────────────┐
                 ▼ (Returns output payload)    ▼ (Streams console logs)
           Terminal stdout               Local CloudWatch Mock
```

### Critical Requirement

There is zero upload latency. The code executes inside a clean Docker environment matching the official AWS runtime, providing instant stack verification.

---

## 5. Code Walkthrough: SAM template.yaml and EventBridge cron config

The following `template.yaml` defines a serverless application containing a Lambda function triggered by an EventBridge scheduled cron job.

### template.yaml configuration file

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Local Serverless App with EventBridge trigger

Resources:
  ScheduledLoggerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.scheduledHandler
      Runtime: nodejs20.x
      CodeUri: ./src
      Timeout: 10
      Events:
        TimerEvent:
          Type: Schedule
          Properties:
            Schedule: cron(*/5 * * * ? *) # Trigger every 5 minutes

Outputs:
  LoggerFunctionArn:
    Description: "Scheduled Logger Lambda Function ARN"
    Value: !GetAtt ScheduledLoggerFunction.Arn
  LocalAPIEndpoint:
    Description: "Local Mock Gateway Endpoint"
    Value: "http://localhost:3000/hello"
```

### app.js handler code

Save this file in the `./src` directory:

```js
// src/app.js
export const scheduledHandler = async (event) => {
  console.log("EventBridge cron event received at:", new Date().toISOString());
  console.log("Trigger detail:", JSON.stringify(event));
  return { status: "processed" };
};
```

### Simulating API Gateway via SAM local start-api

You can also run a local HTTP server that emulates API Gateway routing using the following CLI execution block:

```bash
# Start a local HTTP server on port 3000 mapping API routes defined in template.yaml
sam local start-api --port 3000

# Invoke the local API Gateway URL
curl -X GET http://localhost:3000/hello
```

---

## 6. Comparing SAM Local execution to Live CloudFormation

### Deployment Framework Matrix

| Parameter | Live CloudFormation Stack | SAM Local CLI (Docker) |
|---|---|---|
| Deploy Target | Remote AWS Account | Local Docker Engine |
| Deploy Latency | 2 - 10 minutes (stack creation) | Instant container startup |
| CloudWatch logs | Synced to remote groups | Written to local console / mock |
| Stack Rollback | Strict (deletes all resources) | Bypassed (only reports validation errors) |
| Internet connection | Required | Offline-friendly |
| Cost | Accrues charges (resource hours) | 100% Free |

---

## 7. Common Mistakes

- **Incorrect relative path in CodeUri.** Defining `CodeUri: .` instead of pointing to the subdirectory containing `package.json` causes SAM to copy irrelevant folders, bloating the transient container.
- **Forgetting to start Docker before calling SAM.** Since SAM CLI uses Docker to run functions, executing commands without the Docker daemon active causes connection failures.
- **Confusing Cron syntax.** Writing standard 5-field crontabs inside `template.yaml`. AWS EventBridge cron schedules require exactly 6 fields (Minutes, Hours, Day-of-month, Month, Day-of-week, Year).

---

## 8. Hands-On Exercises

**Exercise 1:** Install the AWS SAM CLI on your system and verify the installation using `sam --version`.

**Exercise 2:** Create the directory structure from Section 5 (`template.yaml` and `./src/app.js`) and run `sam validate`.

**Exercise 3:** Execute the function locally by passing a mock event payload: `sam local invoke ScheduledLoggerFunction`.

**Exercise 4:** Run a local API Gateway server using SAM: `sam local start-api`. Test the endpoint using your browser or curl.

**Exercise 5:** Verify the EventBridge configuration by launching the SAM local container and checking the scheduled logs.

---

## 9. Interview Q&A

**Q: What is the relationship between AWS SAM and AWS CloudFormation?**
AWS SAM is an open-source framework that extends CloudFormation. It introduces simplified serverless resource types (such as `AWS::Serverless::Function`). During deployment, CloudFormation translates these custom types into standard resource objects, acting as a compiler.

**Q: How does `sam local invoke` differ from `aws lambda invoke`?**
`aws lambda invoke` sends an API request to a running AWS or Floci container to execute a deployed function. `sam local invoke` compiles, mounts, and runs the function code inside a temporary Docker container directly on your host machine without deploying it first.

**Q: How do you schedule periodic serverless tasks in AWS?**
You create an Amazon EventBridge (CloudWatch Events) Schedule rule specifying a cron or rate expression, and set the target to invoke the desired Lambda function. EventBridge triggers the function automatically when the time matches.

**Q: What is the role of CloudWatch Log Groups and Log Streams?**
A Log Group is a logical container that shares retention, monitoring, and access control settings. A Log Stream is a sequence of log events that share the same source (such as a specific instance of a running Lambda container).

**Q: Why does the SAM CLI require Docker to test functions locally?**
To ensure execution consistency. The SAM CLI runs functions inside official AWS Lambda execution environment base images. This ensures your local runs match live AWS, catching runtime issues or missing modules before cloud deployment.
