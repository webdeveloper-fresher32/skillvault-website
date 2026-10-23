# Local Lambda Functions — Complete Guide

> "A restaurant chef prepares dishes on-demand only when a customer places an order; the kitchen fires up the burners, cooks the meal, and immediately cleans the station when the order is fulfilled."

---

## Table of Contents

1. [The Problem: Cold Starts and Slow Deployment Loops](#1-the-problem-cold-starts-and-slow-deployment-loops)
2. [The Restaurant Kitchen Analogy](#2-the-restaurant-kitchen-analogy)
3. [The Mechanism: Containerized Sibling Runs and Local ZIPs](#3-the-mechanism-containerized-sibling-runs-and-local-zips)
4. [Diagram: Docker-in-Docker Sibling Runtime Invocation](#4-diagram-docker-in-docker-sibling-runtime-invocation)
5. [Code Walkthrough: Local Node.js Handler and CLI Deployer](#5-code-walkthrough-local-node-js-handler-and-cli-deployer)
6. [Comparing Local Lambda to Live AWS Lambda](#6-comparing-local-lambda-to-live-aws-lambda)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Cold Starts and Slow Deployment Loops

Writing serverless microservices requires deploying lightweight, isolated code blocks that execute on-demand. In traditional server infrastructure, code runs continuously on virtual machines.

### The Remote Package Deployment Cycle

In public AWS, deploying a Lambda function involves zipping your code, uploading it to S3, updating the function code, and waiting for propagation. During testing, making a small syntax tweak requires redeploying the package, which takes minutes and disrupts development.

### Cold Start and Timeout Latency

When a function executes after a period of inactivity, AWS must spin up a new container instance. This "cold start" introduces latency. Debugging cold start behavior, memory exhaustion, and runtime timeouts in the public cloud is slow and expensive because logging latency adds delay.

---

## 2. The Restaurant Kitchen Analogy

A traditional buffet restaurant cooks food in large quantities and keeps it warm under heat lamps all day. This represents a traditional, always-running server.

### On-Demand Cooking

In contrast, a fine-dining kitchen cooks each meal to order. If no customers are in the dining room, the chef sits idle. When an order arrives (an event), the chef fires up the grill (cold start), prepares the dish, and turns off the heat once the food is served (scale to zero).

### Kitchen Sharing and Tools

To speed up prep, the chef uses shared pre-cut vegetables from a prep station. These pre-packaged tools represent Lambda Layers. They are shared across multiple menu items, saving prep time during execution.

---

## 3. The Mechanism: Containerized Sibling Runs and Local ZIPs

To run AWS Lambda locally, Floci utilizes Docker. The emulator container itself does not contain the runtime environments (Node.js, Python, Java) for your functions.

### Sibling Containers

When you invoke a local Lambda function, Floci connects to the host's Docker engine using the mapped `/var/run/docker.sock`. It dynamically downloads the corresponding official AWS Lambda base image (e.g. `public.ecr.aws/lambda/nodejs:20`) and starts it as a sibling container.

### Local Endpoint Forwarding

This sibling container is mounted on the same Docker network as Floci. It executes your handler code, relays the output logs back to Floci, and shuts down or stays warm for subsequent requests. When the function calls S3 or DynamoDB, it must route requests back to the host machine's IP or Floci's container name (`local-aws-cloud:4566`) rather than standard localhost.

---

## 4. Diagram: Docker-in-Docker Sibling Runtime Invocation

### The Execution Pipeline

```text
The Invocation Flow:
  [Host Machine] ──► CLI/SDK Invoke ──► [Floci Container (4566)]
                                                │
                                                ▼  (Uses mapped docker.sock)
                                        [Host Docker Daemon]
                                                │
                                                ▼  (Spawns sibling container)
                                        [Lambda Sibling Container]
                                          (Mounts zip/code directory)
                                                │
                                                ▼  (Executes Handler code)
                                        Returns response payload
```

### Critical Requirement

Mapping `/var/run/docker.sock` allows Floci to invoke host-level docker commands from inside the container, enabling local serverless environments.

---

## 5. Code Walkthrough: Local Node.js Handler and CLI Deployer

The following code illustrates a standard Node.js handler that returns a message and processes incoming event parameters. The script packages and deploys it locally.

### index.mjs handler code

```js
// index.mjs
export const handler = async (event, context) => {
  console.log("Function invoked locally. Event data:", JSON.stringify(event));

  const userName = event.name || "stranger";
  
  const response = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Hello, ${userName}!`,
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId
    })
  };

  return response;
};
```

### local-lambda-deploy.sh Script

This script zips the handler code, creates the role, and deploys it to the local Floci container:

```bash
#!/bin/bash
# local-lambda-deploy.sh

# 1. Zip the function
zip function.zip index.mjs

# 2. Deploy to local container
aws lambda create-function \
  --function-name hello-world-fn \
  --runtime nodejs20.x \
  --zip-file fileb://function.zip \
  --handler index.handler \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --endpoint-url http://localhost:4566

# 3. Invoke locally and capture output
aws lambda invoke \
  --function-name hello-world-fn \
  --payload '{"name": "Ganesh"}' \
  --cli-binary-format raw-in-base64-out \
  --endpoint-url http://localhost:4566 \
  output.json

cat output.json
```

---

## 6. Comparing Local Lambda to Live AWS Lambda

### Compute Comparison Matrix

| Feature | Live AWS Lambda | Local Lambda (Floci) |
|---|---|---|
| Provisioning | Managed internally by AWS | Spawns sibling containers on host |
| Execution Costs | Free tier: 1M / month; then billed | 100% Free |
| Deploy Mechanism | Zip upload / ECR image | Zip upload (simulated via Docker) |
| SDK Endpoint Routing | Automatic | Requires routing configuration |
| Logs | CloudWatch Log Groups | Docker container logs / CLI redirect |
| Execution Limits | Up to 15-minute timeout | Bounded by host machine performance |

---

## 7. Common Mistakes

- **Forgetting `fileb://` prefix during deployment.** The AWS CLI expects the `fileb://` prefix to read the zip package as binary data. Omitting it causes base64 decoding errors.
- **Incorrect handler mapping names.** If the file is named `index.mjs` and exports `handler`, but `--handler` is configured as `app.handler`, the execution container will fail with a "Handler not found" error.
- **Calling localhost from inside the sibling container.** The sibling container runs inside the Docker network. If it attempts to reach S3 using `localhost:4566`, it will fail because `localhost` refers to itself. It must target `http://host.docker.internal:4566` or the emulator's network name.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the `index.mjs` file from Section 5 and zip it using your command line terminal.

**Exercise 2:** Execute the deploy script from Section 5 to push the function code to the running Floci container.

**Exercise 3:** Write a script that invokes the local function with 3 different JSON payloads containing distinct name parameters, printing output results.

**Exercise 4:** Run a docker check command (`docker ps`) during a long-running function execution to observe the sibling container starting up and shutting down.

**Exercise 5:** Verify the output logs of your function execution by querying the local CloudWatch log streams using the AWS CLI.

---

## 9. Interview Q&A

**Q: How does a local cloud emulator execute Lambda function runs under the hood?**
It connects to the host's Docker engine via mapped `/var/run/docker.sock`. When a function is invoked, the emulator dynamically pulls the matching official AWS Lambda base image, starts it as a sibling container, mounts the zip package, executes the handler, and returns the response.

**Q: Why does the S3 or DynamoDB client inside a local Lambda function need a different endpoint configuration than localhost?**
Because the Lambda function runs inside a sibling container on the Docker network. Within that container, `localhost` resolves to the container itself, not the host machine where Floci port 4566 is exposed. The SDK inside the function must use `http://host.docker.internal:4566` to resolve the host.

**Q: What is a Lambda Layer, and why is it useful during development?**
A Lambda Layer is a zip archive containing library dependencies, custom runtimes, or utility code. It allows you to share dependencies across multiple functions, reducing deployment package sizes and keeping function code clean and lightweight.

**Q: How do you debug runtime timeouts and memory limit issues when developing serverless functions?**
You configure the `--timeout` (seconds) and `--memory-size` (MB) parameters during function creation. Locally, you test these parameters by running resource-heavy loops and observing if the sibling container throws out-of-memory errors or halts execution.

**Q: What is the purpose of the `--cli-binary-format raw-in-base64-out` flag when invoking functions via the AWS CLI?**
By default, newer versions of the AWS CLI expect input payloads to be base64-encoded strings. Using the `raw-in-base64-out` flag instructs the CLI to accept raw JSON strings directly in the terminal invocation parameter, simplifying command lines.
