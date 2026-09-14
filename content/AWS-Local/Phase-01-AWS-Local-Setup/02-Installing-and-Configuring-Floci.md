# Installing and Configuring Floci — Complete Guide

> "A power strip plugs into a single wall outlet but splits it into multiple sockets, letting you power a computer, monitor, and lamp all in one place."

---

## Table of Contents

1. [The Problem: Local Cloud Service Coordination](#1-the-problem-local-cloud-service-coordination)
2. [The Power Strip Analogy](#2-the-power-strip-analogy)
3. [The Mechanism: Docker, Edge Routing, and Quarkus Native](#3-the-mechanism-docker-edge-routing-and-quarkus-native)
4. [Diagram: Port Binding and Local Network Routing](#4-diagram-port-binding-and-local-network-routing)
5. [Code Walkthrough: Floci CLI, docker-compose.yml, and Floci UI](#5-code-walkthrough-floci-cli-docker-composeyml-and-floci-ui)
6. [Comparing Emulators: Floci, MiniStack, and LocalStack](#6-comparing-emulators-floci-ministack-and-localstack)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Local Cloud Service Coordination

To build modern web applications, you need more than just a single database or server. A standard architecture might require S3 for media uploads, DynamoDB for user metadata, Lambda for serverless jobs, and SQS for processing queues.

### Manual Service Management

Setting up, starting, and connecting separate mock servers for each of these services is a DevOps nightmare. Running S3 mock servers, separate DynamoDB Local jars, and Lambda runners consumes massive memory, requires managing multiple ports, and makes networking between services incredibly complex.

### Environment Divergence

If each developer on a team configures their local mock tools differently, it leads to the classic "works on my machine" problem. Port conflicts, mismatched API versions, and complex startup sequences slow down onboarding and lead to brittle local configurations.

---

## 2. The Power Strip Analogy

A standard wall outlet has only one socket, meaning you can plug in only one device at a time. If you need to power a workstation with multiple components, you use a power strip.

### Unified Endpoint

The power strip plugs into the wall and provides a single, unified block of outlets. You don't need to run extension cords to different rooms. It manages the electrical routing internally.

### Multiplexed Routing

Similarly, Floci acts as a digital power strip. It binds to a single port on your host machine (port `4566`) and exposes endpoints for S3, DynamoDB, Lambda, and more. When you send requests to port `4566`, Floci handles the internal routing, directing your traffic to the appropriate service handler.

---

## 3. The Mechanism: Docker, Edge Routing, and Quarkus Native

Floci is packaged as a Docker container and a native CLI wrapper, ensuring that it runs exactly the same way on macOS, Linux, and Windows. This containerizes the emulator and its dependencies.

### Edge Proxy Multiplexing

Inside the container, a single-edge proxy server inspects incoming HTTP requests on port `4566`. It reads the HTTP headers (such as `Authorization` or `X-Amz-Target`) and the URL paths. If it sees `s3` in the signature or path, it routes the request to the S3 emulator; if it sees a DynamoDB action, it routes it to the database engine.

### Quarkus Native Performance

Floci is built using Java and compiled to a native executable using the GraalVM Quarkus framework. This Native compilation bypasses standard Java Virtual Machine (JVM) startup overhead. As a result, Floci boots up in approximately ~24ms and consumes an extremely lightweight ~13 MiB of idle RAM on your Mac, compared to python-based emulators which consume over 1 GB of idle RAM.

---

## 4. Diagram: Port Binding and Local Network Routing

### Local Request Pipeline

```text
Incoming request (AWS CLI / SDK / Terraform)
       │
       ▼  (Pointed to endpoint: http://localhost:4566)
  [Host Machine Port 4566]
       │
       ▼  (Docker Bridge / Port Mapping)
  [Floci Container Port 4566]
       │
       ▼  (Quarkus Edge Proxy Router)
  Headers inspect ──► Contains "s3" signature?
                          │
                   ┌──────┴──────┐
                   YES           NO
                   │             │
                   ▼             ▼
              [S3 Mock Engine]  [Other Service Router]
```

### Key Takeaway

Port `4566` acts as the single point of entry for all emulated services. This eliminates the need to expose a separate port for every single AWS service.

---

## 5. Code Walkthrough: Floci CLI, docker-compose.yml, and Floci UI

Floci provides a native CLI tool to manage start scripts, environment profiles, and a local console visual dashboard called `floci-ui` running on port `4500`.

### Native CLI Commands

Install the CLI using Homebrew and start the environment:

```bash
# 1. Install Floci CLI
brew install floci-io/floci/floci

# 2. Start the local AWS services container
floci start

# 3. Export environment variables dynamically to the active terminal
eval $(floci env)

# 4. Check the local cloud health status
floci doctor
```

### Under the Hood: CLI Environment Outputs

When you run the command `floci env`, the CLI generates the shell export configurations dynamically for your system shell context:

```bash
# Generated outputs from floci env command:
export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_ACCESS_KEY_ID="mock-key-id"
export AWS_SECRET_ACCESS_KEY="mock-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_PROFILE="local"
```

### docker-compose.yml with Floci UI

You can orchestrate Floci and its visual dashboard UI console together using Docker Compose:

```yaml
# docker-compose.yml
services:
  floci:
    image: flociorg/floci:latest
    container_name: local-aws-cloud
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway,sqs,sns,cloudwatch
    volumes:
      - "./floci-data:/tmp/floci/data"
      - "/var/run/docker.sock:/var/run/docker.sock"

  floci-ui:
    image: flociorg/floci-ui:latest
    container_name: local-cloud-dashboard
    ports:
      - "4500:4500"
    environment:
      - FLOCI_ENDPOINT=http://floci:4566
    depends_on:
      - floci
```

---

## 6. Comparing Emulators: Floci, MiniStack, and LocalStack

### Emulator Feature Matrix

| Feature | Floci | MiniStack | LocalStack (Free Tier) |
|---|---|---|---|
| License | MIT (Open Source) | Apache-2.0 | Proprietary (Restricted) |
| Services Supported | ~75 | ~60 | ~10 (with paid Pro upsell) |
| Idle RAM | Ultra-Light (~13 MiB) | Light (~100 MiB) | Heavy (~1.2 GiB) |
| Boot Time | ~24ms | ~200ms | ~5s |
| Account Requirement | None | None | Requires account login |
| Visual Dashboard | Yes (floci-ui on port 4500) | None | Paid Web Console |

---

## 7. Common Mistakes

- **Forgetting `eval $(floci env)` in new shell windows.** Opening a new terminal tab clears the exported environment parameters, causing subsequent AWS commands to execute against live AWS if keys exist.
- **Port conflicts on 4500 or 4566.** Running local applications on port 4500 or running old emulator instances on port 4566 blocks Floci container initialization.
- **Failing to configure Docker socket mapping.** If `/var/run/docker.sock` is not mapped, Floci cannot invoke host docker tasks, which prevents Lambda execution container runs from spawning.

---

## 8. Hands-On Exercises

**Exercise 1:** Install the Floci CLI on your Mac using Homebrew, and run `floci --version` to verify the execution.

**Exercise 2:** Create the `docker-compose.yml` file from Section 5 and run `docker compose up -d` to launch the emulator and the dashboard.

**Exercise 3:** Open `http://localhost:4500` in your web browser and inspect the local S3 and DynamoDB dashboard views.

**Exercise 4:** Run `floci doctor` to audit your local system environment variables and confirm the CLI targets the local proxy.

**Exercise 5:** Set up a shell profile alias that automates the `eval $(floci env)` execution when opening new terminal shells.

---

## 9. Interview Q&A

**Q: Why is Floci so much lighter on RAM and boot times compared to python-based emulators?**
Floci is built using the Quarkus framework in Java and compiled directly to a platform-native executable using GraalVM. This native compilation removes the need for a JVM interpreter or python runtime, allowing the container to boot in ~24ms and consume only ~13 MiB of idle RAM.

**Q: What is the function of the Floci CLI `eval $(floci env)` command?**
The `floci env` command prints the shell configuration commands required to map standard environment variables (like `AWS_ENDPOINT_URL` and `AWS_PROFILE`) to local endpoints. Running it inside `eval $(...)` dynamically executes those exports inside the active shell.

**Q: What is `floci-ui`, and how do you connect it to your local emulators?**
`floci-ui` is a web-based dashboard console that connects to running Floci instances (via HTTP API checks on port 4566). It provides a visual UI interface to browse created S3 buckets, files, DynamoDB tables, queues, and execution logs locally.

**Q: Why must `/var/run/docker.sock` be mounted inside the Floci container volume?**
To enable Docker-in-Docker functionality. Floci needs access to the host's Docker engine to dynamically pull base runtimes and spawn sibling container nodes for Lambda functions or containerized ECS tasks.

**Q: Can you query multiple clouds locally using Floci CLI?**
Yes. While this course focuses on AWS APIs, the Floci repository architecture also hosts emulators for Google Cloud (GCP), Microsoft Azure, and Oracle Cloud (OCI) using companion proxy wrappers.
