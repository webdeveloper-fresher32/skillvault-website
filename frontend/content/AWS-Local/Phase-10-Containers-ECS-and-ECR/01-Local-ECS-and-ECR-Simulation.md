# Local ECS and ECR Simulation — Complete Guide

> "A shipping port registry assigns unique registry numbers to shipping containers arriving from overseas; the port crane operator unloads the containers and arranges them in the harbor based on those registry numbers."

---

## Table of Contents

1. [The Problem: High Cost and Orchestration Latency of Cloud Containers](#1-the-problem-high-cost-and-orchestration-latency-of-cloud-containers)
2. [The Shipping Vessel and Harbor Registry Analogy](#2-the-shipping-vessel-and-harbor-registry-analogy)
3. [The Mechanism: Local ECR Registry Mocks and ECS Task Spawning](#3-the-mechanism-local-ecr-registry-mocks-and-ecs-task-spawning)
4. [Diagram: Local ECR Container Push and ECS Service Deployment Flow](#4-diagram-local-ecr-container-push-and-ecs-service-deployment-flow)
5. [Code Walkthrough: Local Image Build-Push and Task definition JSON](#5-code-walkthrough-local-image-build-push-and-task-definition-json)
6. [Comparing Local ECS/ECR to Live AWS ECS/ECR](#6-comparing-local-ecsecs-to-live-aws-ecsecs)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: High Cost and Orchestration Latency of Cloud Containers

Running microservices in production requires container registries (ECR) to store images, and orchestration services (ECS) to manage task lifecycles, load balancing, and scaling.

### High Infrastructure Costs of ECS/Fargate

In public AWS, deploying services to ECS Fargate immediately triggers billing charges. You pay for the virtual CPUs (vCPU) and memory allocated to each task. Running multiple container instances for development or testing can easily run up hundreds of dollars in monthly charges.

### Slow Orchestration Feedback Loops

Pushing a Docker image to live ECR, registering a new Task Definition version, and waiting for the ECS scheduler to stop old tasks and drain connections takes several minutes. This latency blocks developers who need to test how their React and Node.js containers interact.

---

## 2. The Shipping Vessel and Harbor Registry Analogy

A cargo shipping company uses standard metal shipping containers to package goods. Each container must be registered at the harbor registry office before loading.

### Registry Catalogs

The registry office keeps track of where each container came from, its weight, and its dimensions. This corresponds to the Elastic Container Registry (ECR), which catalogs your Docker images.

### Crane and Allocation Logistics

Once registered, the crane operator (ECS) reads the shipping manifest (Task Definition) and places containers in specific sections of the harbor (the Cluster). The operator balances weight across the port and starts new shipments when demand spikes, representing auto-scaling.

---

## 3. The Mechanism: Local ECR Registry Mocks and ECS Task Spawning

Since Floci runs inside a Docker environment, simulating ECS and ECR is highly efficient because it maps directly to your host's Docker engine.

### ECR Emulation via Registry Containers

To emulate ECR, you spin up an official Docker Registry container on port `5001`. This acts as your private local ECR registry. You tag your local application images as `localhost:5001/my-app:latest` and push them to this container.

### ECS Task Mocking

ECS APIs are emulated by Floci on port `4566`. When you run `aws ecs register-task-definition` or `aws ecs run-task`, Floci parses the JSON configurations and translates the directives into standard Docker container run calls. It pulls the image from your local registry on port `5001` and runs it as a sibling container.

---

## 4. Diagram: Local ECR Container Push and ECS Service Deployment Flow

### The Deployment Flow

```text
  [Docker Build App] ──► Tag: localhost:5001/node-app:latest
                              │
                              ▼  (docker push)
  [Local ECR Registry (Port 5001)]
                              │
                              ▼  (aws ecs register-task-definition)
  [Floci ECS Simulator (Port 4566)] ──► Reads JSON task config
                                             │
                                             ▼  (Instructs Host Docker Engine)
  [Host Docker Daemon] ──► Pulls image ──► Spawns container: node-app
```

### Critical Advantage

The registry and scheduler execute locally inside your Docker workspace. You can build, push, register, and run container tasks in seconds.

---

## 5. Code Walkthrough: Local Image Build-Push and Task definition JSON

The following configurations and scripts demonstrate how to write the Node.js Dockerfile, set up the local ECR registry, build the image, and register the ECS Task.

### Application Dockerfile

This simple, lightweight configuration packages our Node.js application server:

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "app.js"]
```

### ecr-registry-setup.sh script

This script starts a local image registry and pushes a compiled image to it:

```bash
#!/bin/bash
# ecr-registry-setup.sh

# 1. Start a local registry container (simulating ECR)
if ! docker ps | grep -q "local-ecr-registry"; then
  docker run -d -p 5001:5000 --name local-ecr-registry registry:2
  echo "Local ECR Registry started on port 5001."
fi

# 2. Tag and push Node.js application image
docker build -t node-app-image .
docker tag node-app-image localhost:5001/node-app-image:latest
docker push localhost:5001/node-app-image:latest
echo "Image successfully pushed to local registry."
```

### task-definition.json config file

This JSON template defines the task execution details, mapping container ports:

```json
{
  "family": "node-app-task",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "node-app-container",
      "image": "localhost:5001/node-app-image:latest",
      "cpu": 256,
      "memory": 512,
      "portMappings": [
        {
          "containerPort": 5000,
          "hostPort": 5000,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

---

## 6. Comparing Local ECS/ECR to Live AWS ECS/ECR

### Container Operations Comparison

| Feature | Live AWS Cloud | Local Emulator (Floci + Registry) |
|---|---|---|
| ECR Endpoint | `*.dkr.ecr.us-east-1.amazonaws.com` | `localhost:5001` |
| Orchestrator | ECS Control Plane & Fargate | Floci Docker-in-Docker translation |
| Deploy Latency | 3 - 8 minutes (image pull & config) | <5 seconds |
| vCPU/Memory fees | Charged per second of task runtime | 100% Free |
| Network Mode | `awsvpc` (VPC Elastic Network Interfaces) | Docker bridge/host networks |
| Scaling | Auto-scaling groups & CloudWatch | Manual scaling CLI commands |

---

## 7. Common Mistakes

- **Forgetting to configure localhost registry as insecure.** Docker CLI might block pushing to `localhost:5001` if it enforces HTTPS. Configure your Docker daemon json to allow `localhost:5001` as an insecure registry.
- **Mismatching hostPort and containerPort in bridge networks.** Mapping conflicting host ports across multiple task instances will cause the ECS scheduler to throw port-allocation errors.
- **Using public registry paths in task definitions.** Writing task files with public ECR paths will cause Floci to search the live web instead of pulling from your local port `5001`.

---

## 8. Hands-On Exercises

**Exercise 1:** Execute the registry setup script from Section 5 to start a local registry container on port 5001.

**Exercise 2:** Create a simple Node.js web server Dockerfile, compile it, and push it to the registry.

**Exercise 3:** Register the Task Definition JSON from Section 5 using the CLI command `aws ecs register-task-definition --cli-input-json file://task-definition.json --endpoint-url=http://localhost:4566`.

**Exercise 4:** Run the task locally using `aws ecs run-task` and verify the container starts as a sibling container on your host.

**Exercise 5:** Verify the list of registered task definitions by running the ECS list command against port 4566.

---

## 9. Interview Q&A

**Q: What is the relationship between an ECS Task Definition, a Task, and a Service?**
A Task Definition is the blueprint JSON file that describes the container configuration (image, memory, ports). A Task is a running instance of a Task Definition. A Service is the controller that maintains the desired count of active Tasks, handles scaling, and integrates with load balancers.

**Q: What is the difference between AWS ECS Fargate and ECS EC2 launch types?**
Under the Fargate launch type, AWS manages the underlying EC2 host servers, and you pay only for the container resource allocations (serverless). Under the EC2 launch type, you manage a cluster of EC2 instances, giving you access to the host OS but requiring manual server maintenance.

**Q: How do you configure a local private Docker registry container to emulate AWS ECR?**
You start the official `registry:2` container mapping host port 5001 to container port 5000. In your shell, you build your application image, tag it using the prefix `localhost:5001/image-name:tag`, and run `docker push` to upload it to the registry container.

**Q: Why does the ECS task definition define network modes like `awsvpc`?**
The `awsvpc` network mode assigns each running task its own dedicated Elastic Network Interface (ENI) and private IP address inside your VPC. This allows tasks to be managed with standard security groups and VPC route rules, but introduces minor initialization latency.

**Q: What is the purpose of image tagging in container workflows?**
Image tagging assigns a unique tag identifier (like a commit hash or version number) to a Docker image. This allows registries to store multiple revisions of the same application image, enabling developers to roll back deployments by running tasks with earlier tags.
