# Amazon ECS (Elastic Container Service): Complete Guide

## Table of Contents

1. [What is ECS](#1-what-is-ecs)
2. [ECS vs Self-Managed Kubernetes](#2-ecs-vs-self-managed-kubernetes)
3. [Launch Types: Fargate vs EC2](#3-launch-types-fargate-vs-ec2)
4. [ECS Core Concepts](#4-ecs-core-concepts)
5. [ECS Service Auto Scaling](#5-ecs-service-auto-scaling)
6. [ECS with ALB](#6-ecs-with-alb)
7. [ECS with EFS](#7-ecs-with-efs)
8. [ECS Service Connect](#8-ecs-service-connect)
9. [Deployments: Rolling and Blue/Green](#9-deployments-rolling-and-bluegreen)
10. [ECS Anywhere](#10-ecs-anywhere)
11. [Hands-On: Deploy Node.js on ECS Fargate](#11-hands-on-deploy-nodejs-on-ecs-fargate)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What is ECS

Amazon ECS (Elastic Container Service) is AWS's fully managed container orchestration service.
It runs Docker containers at scale, handling cluster management, scheduling, load balancing,
auto scaling, and rolling deployments.

You describe what containers to run (Task Definition), and ECS handles placing them on
infrastructure, restarting failed containers, draining containers during deployments, and
integrating with AWS services (ALB, CloudWatch, IAM, EFS, Secrets Manager).

```
+--------------------------------------------------------+
|                     ECS Architecture                    |
|                                                        |
|  You provide:                                          |
|  - Docker image (in ECR or Docker Hub)                 |
|  - Task Definition (CPU, memory, ports, env vars)      |
|  - Service definition (desired count, ALB config)      |
|                                                        |
|  ECS provides:                                         |
|  - Scheduling containers on infrastructure             |
|  - Health monitoring and restart                       |
|  - Rolling deployments                                 |
|  - Integration with ALB, CloudWatch, IAM               |
+--------------------------------------------------------+
```

### ECS Key Value Proposition

- **No Kubernetes overhead** — ECS has a simpler mental model than Kubernetes
- **Deep AWS integration** — IAM, ALB, EFS, Secrets Manager, CloudWatch all work natively
- **Two launch types** — Fargate (serverless) or EC2 (you manage the hosts)
- **Mature and battle-tested** — used extensively at Amazon scale

---

## 2. ECS vs Self-Managed Kubernetes

| Feature | ECS | Self-Managed Kubernetes |
|---------|-----|------------------------|
| Control plane | AWS managed | You manage (or use EKS) |
| Learning curve | Low | High |
| AWS integration | Native, deep | Requires setup |
| Multi-cloud | AWS only | Portable |
| Ecosystem | Smaller | Huge (CNCF) |
| Cost | Pay for tasks only (Fargate) | Pay for control plane + nodes |
| Autoscaling | Native + simple | HPA, VPA, Cluster Autoscaler |
| Service mesh | ECS Service Connect | Istio, Linkerd, App Mesh |
| Debugging | CloudWatch + ECS Exec | kubectl + many tools |
| Custom schedulers | No | Yes |

**Choose ECS when:**
- AWS-only deployment
- Team is AWS-native, not Kubernetes-experienced
- Simpler applications without complex orchestration needs
- You want minimal operational overhead

**Choose self-managed Kubernetes (or EKS) when:**
- Multi-cloud or hybrid-cloud requirements
- Team has Kubernetes expertise
- Need Kubernetes-specific features (CRDs, operators, Helm ecosystem)
- Complex service mesh requirements

---

## 3. Launch Types: Fargate vs EC2

### Fargate: Serverless Containers

```
+------------------------------------------------------+
|                    Your ECS Cluster                   |
|                                                      |
|  +-----------+  +-----------+  +-----------+         |
|  |   Task    |  |   Task    |  |   Task    |         |
|  | (Fargate) |  | (Fargate) |  | (Fargate) |         |
|  +-----------+  +-----------+  +-----------+         |
|                                                      |
|  *** No EC2 instances visible or managed by you ***  |
|  AWS manages the underlying compute infrastructure   |
+------------------------------------------------------+
```

With Fargate:
- You do NOT manage EC2 instances
- AWS handles patching, scaling, and provisioning the underlying host
- You pay per vCPU and memory per second (only for running tasks)
- No need to think about EC2 capacity or instance types
- Great for: APIs, microservices, event-driven workloads

**Fargate CPU and Memory Combinations:**

| vCPU | Memory Range |
|------|-------------|
| 0.25 | 0.5 GB – 2 GB |
| 0.5 | 1 GB – 4 GB |
| 1 | 2 GB – 8 GB |
| 2 | 4 GB – 16 GB |
| 4 | 8 GB – 30 GB |
| 8 | 16 GB – 60 GB |
| 16 | 32 GB – 120 GB |

### EC2 Launch Type

```
+------------------------------------------------------+
|                    Your ECS Cluster                   |
|                                                      |
|  +-----------------+    +-----------------+           |
|  | EC2 Instance    |    | EC2 Instance    |           |
|  | (ECS Agent)     |    | (ECS Agent)     |           |
|  |  +----------+   |    |  +----------+   |           |
|  |  |  Task A  |   |    |  |  Task C  |   |           |
|  |  +----------+   |    |  +----------+   |           |
|  |  +----------+   |    |  +----------+   |           |
|  |  |  Task B  |   |    |  |  Task D  |   |           |
|  |  +----------+   |    |  +----------+   |           |
|  +-----------------+    +-----------------+           |
+------------------------------------------------------+
```

With EC2 launch type:
- You provision EC2 instances in the cluster (Auto Scaling Group recommended)
- ECS Agent (a Docker container) runs on each EC2 instance
- ECS schedules tasks onto the instances based on available resources
- You are responsible for OS patching the EC2 instances
- You can use Spot Instances for significant cost savings
- Better for: GPU workloads, custom AMIs, specific instance types

### Fargate vs EC2 Comparison

| Aspect | Fargate | EC2 |
|--------|---------|-----|
| Infrastructure management | AWS manages | You manage |
| Patching | AWS patches underlying OS | You patch EC2 AMIs |
| Cost model | Pay per task (vCPU + memory seconds) | Pay for EC2 uptime |
| Cost for constant load | More expensive | Cheaper |
| Cost for variable load | Cheaper (pay only for running tasks) | Reserve capacity needed |
| Spot usage | Fargate Spot (up to 70% off) | EC2 Spot |
| GPUs | No (limited) | Yes |
| SSH into host | No | Yes |
| Startup time | ~30-40 seconds | Faster once EC2 is running |
| Max container size | 16 vCPU, 120 GB | Whatever the EC2 instance supports |

### Fargate Spot

Like EC2 Spot Instances but for containers. Up to 70% cost reduction.
AWS can interrupt tasks with a 2-minute warning. Use for:
- Batch processing jobs
- Non-critical workloads
- Tasks that can be safely interrupted

---

## 4. ECS Core Concepts

```
+-------------------------------------------------------+
|                                                       |
|   CLUSTER (logical grouping)                          |
|   +---------------------------------------------------+
|   |                                                   |
|   |   SERVICE (maintains desired task count)          |
|   |   +-----------------------------------------------+
|   |   |                                               |
|   |   |   TASK (running container group)              |
|   |   |   +-------------------------------------------+
|   |   |   |                                           |
|   |   |   |  Container A  |  Container B (sidecar)   |
|   |   |   |  (your app)   |  (log router)            |
|   |   |   +-------------------------------------------+
|   |   |   TASK DEFINITION (blueprint for tasks)       |
|   |   +-----------------------------------------------+
|   +---------------------------------------------------+
+-------------------------------------------------------+
```

### Cluster

A logical grouping of tasks and services. It can contain a mix of Fargate and EC2 tasks.
Clusters are free — you pay for the tasks and EC2 instances running inside them.

```
One cluster can contain:
- Multiple services
- Fargate tasks
- EC2 tasks
- Multiple namespaces (for Service Connect)
```

Creating a cluster:
```bash
aws ecs create-cluster \
  --cluster-name my-production-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1
```

### Task Definition

The blueprint for your containers. Like a Dockerfile, but for ECS. Defines everything
about how your containers run. Versioned — each update creates a new revision.

Key fields in a Task Definition:

```json
{
  "family": "myapp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789:role/myapp-task-role",
  "containerDefinitions": [
    {
      "name": "myapp",
      "image": "123456789.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:123456789:secret:myapp/db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "cpu": 0,
      "memory": 512,
      "mountPoints": []
    }
  ]
}
```

#### IAM Task Role vs Task Execution Role

This is one of the most commonly tested ECS concepts.

```
+-----------------------------------------------------------+
|                                                           |
|   Task Execution Role (ecsTaskExecutionRole)             |
|   Used by ECS AGENT (not your app)                       |
|   Needs:                                                  |
|   - Pull image from ECR                                   |
|   - Write logs to CloudWatch                              |
|   - Fetch secrets from Secrets Manager / SSM             |
|   - Get values from SSM Parameter Store                   |
|                                                           |
|   Task Role (your custom role)                            |
|   Used by YOUR APPLICATION (the container itself)        |
|   Needs:                                                  |
|   - Read from S3 buckets                                  |
|   - Put items in DynamoDB                                 |
|   - Publish to SQS                                        |
|   - Call other AWS APIs your app needs                    |
|                                                           |
+-----------------------------------------------------------+
```

**Memory trick:**
- Execution Role = ECS's permissions to SET UP the container
- Task Role = YOUR APP's permissions to call AWS services

#### CPU and Memory in Task Definitions

Two levels: Task-level (total) and Container-level (per container).
For Fargate, task-level CPU and memory are required and determine pricing.
Container-level settings are optional but useful for soft/hard limits.

- `memory` = hard limit (container is killed if it exceeds this)
- `memoryReservation` = soft limit (reserved from total, but can exceed)

#### Network Modes

| Mode | Fargate | EC2 | Description |
|------|---------|-----|-------------|
| `awsvpc` | Required | Supported | Each task gets its own ENI and private IP |
| `bridge` | No | Yes | Docker bridge networking |
| `host` | No | Yes | Container uses host network |
| `none` | No | Yes | No networking |

For Fargate, `awsvpc` is the only option. With `awsvpc`, each task gets its own security group.

#### Logging

The standard approach is AWS FireLens or `awslogs` driver:

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/myapp",
    "awslogs-region": "ap-southeast-2",
    "awslogs-stream-prefix": "ecs"
  }
}
```

For more advanced log routing (to Kinesis Firehose, OpenSearch, S3), use AWS FireLens
which uses Fluent Bit under the hood.

### Task

A running instance of a Task Definition. A task can contain one or more containers
that are scheduled together on the same host (or same Fargate task). They share
the same network namespace (with awsvpc mode, they share the task's ENI).

Tasks can be run:
1. As part of a Service (for long-running apps)
2. Standalone (for batch jobs, migrations, one-off commands)

```bash
# Run a one-off task (e.g., database migration)
aws ecs run-task \
  --cluster my-cluster \
  --task-definition myapp:15 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-abc123],securityGroups=[sg-abc123]}" \
  --overrides '{"containerOverrides":[{"name":"myapp","command":["node","scripts/migrate.js"]}]}'
```

### Service

A Service ensures a specified number of task instances are always running. If a task fails
or becomes unhealthy, the Service starts a replacement. Services also manage rolling
deployments and integration with load balancers.

Key Service settings:
- **Desired count** — how many tasks to run
- **Minimum healthy percent** — floor during deployments (e.g., 50% = can reduce to half during rollout)
- **Maximum percent** — ceiling during deployments (e.g., 200% = can run double during rollout)
- **Deployment type** — Rolling or Blue/Green (CodeDeploy)
- **Load balancer** — attach an ALB target group

```bash
aws ecs create-service \
  --cluster my-cluster \
  --service-name myapp-service \
  --task-definition myapp:15 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-private1,subnet-private2],
    securityGroups=[sg-app],
    assignPublicIp=DISABLED
  }" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=myapp,containerPort=3000" \
  --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200"
```

### Container Instances (EC2 Launch Type)

When using EC2 launch type, your EC2 instances are container instances. Each must:
1. Run the ECS container agent (included in the ECS-optimized AMI)
2. Have an IAM instance profile with the `AmazonEC2ContainerServiceforEC2Role` policy
3. Be in the cluster's security group

The ECS Agent communicates with the ECS control plane and receives instructions to
start, stop, and manage containers.

#### ECS Exec

Allows you to directly interact with a running container without SSH:
```bash
aws ecs execute-command \
  --cluster my-cluster \
  --task abc123 \
  --container myapp \
  --interactive \
  --command "/bin/bash"
```

Requires the Task Role to have ssmmessages permissions and the task definition to
have `enableExecuteCommand: true`.

---

## 5. ECS Service Auto Scaling

ECS Services can automatically scale the number of running tasks based on metrics.

```
+----------------------------------------------+
|         ECS Service Auto Scaling              |
|                                              |
|  CloudWatch Alarm                            |
|    "CPU utilization > 70%"                   |
|         |                                    |
|         v                                    |
|  Application Auto Scaling                    |
|    Target: ECS service task count            |
|         |                                    |
|         v                                    |
|  ECS Service adjusts desired count          |
|    3 tasks --> 6 tasks --> 3 tasks           |
+----------------------------------------------+
```

### Scaling Policies

**Target Tracking** (recommended):
```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  }
}
```
AWS automatically adjusts tasks to maintain 70% CPU utilization.

**Step Scaling**:
```
If CPU > 70% for 3 minutes: add 2 tasks
If CPU > 85% for 3 minutes: add 4 tasks
If CPU < 40% for 15 minutes: remove 1 task
```

**Scheduled Scaling**:
```bash
# Scale up at 8am Monday-Friday for business hours
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/my-cluster/myapp-service \
  --scheduled-action-name scale-up-business-hours \
  --schedule "cron(0 8 ? * MON-FRI *)" \
  --scalable-target-action MinCapacity=3,MaxCapacity=10
```

### Configuring Auto Scaling

```bash
# 1. Register the ECS service as a scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/my-cluster/myapp-service \
  --min-capacity 2 \
  --max-capacity 20

# 2. Create target tracking policy for CPU
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/my-cluster/myapp-service \
  --policy-name myapp-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

Predefined metrics:
- `ECSServiceAverageCPUUtilization`
- `ECSServiceAverageMemoryUtilization`
- `ALBRequestCountPerTarget` (request count per task)

---

## 6. ECS with ALB

Application Load Balancer integration is one of ECS's most powerful features.

### Dynamic Port Mapping (EC2 launch type)

With EC2 launch type, you can set containerPort but leave hostPort as 0 (or omit it).
ECS assigns a random high port on the EC2 instance for each task.
The ALB handles the dynamic port mapping automatically.

```
+------------------+
|       ALB        |
|   Port 80/443    |
+--------+---------+
         |
  Target Group
  (ECS Registers each task with dynamic port)
         |
    +----+----+
    |         |
+---+--+   +--+---+
|EC2-1 |   |EC2-2 |
|:32768|   |:31492|  <-- random host ports
| Task |   | Task |
|:3000 |   |:3000 |  <-- same container port
+------+   +------+
```

### Path-Based Routing with Multiple Services

```
+----------------------------+
|           ALB              |
+---+----+----+----+---------+
    |    |    |
    |    |    +--- /api/*    -> API Service (ECS)
    |    +-------- /admin/*  -> Admin Service (ECS)
    +------------- /*        -> Frontend Service (ECS)
```

```
ECS Target Groups:
- TargetGroup-API     -> myapp-api-service   (port 3001)
- TargetGroup-Admin   -> myapp-admin-service (port 3002)
- TargetGroup-Frontend-> myapp-web-service   (port 3000)
```

### ALB Target Group Configuration for ECS

When you create an ECS Service linked to an ALB:
- ECS automatically registers/deregisters task IPs with the target group
- ALB performs health checks on each task
- If health check fails, ALB stops routing to that task; ECS replaces it
- During rolling deployments, new tasks are registered before old ones are drained

---

## 7. ECS with EFS

EFS (Elastic File System) provides shared persistent storage for ECS tasks.
This is essential when multiple containers need to read and write the same data.

```
+----------+  +----------+  +----------+
|  Task 1  |  |  Task 2  |  |  Task 3  |
| (Fargate)|  | (Fargate)|  | (Fargate)|
+----+-----+  +----+-----+  +----+-----+
     |              |              |
     +--------------+--------------+
                    |
            +-------+--------+
            |   EFS File      |
            |   System        |
            |  (NFS shared)   |
            +----------------+
```

Use cases:
- WordPress, Drupal (shared uploads directory)
- Machine learning models (shared model files)
- Configuration files shared across tasks
- Content management systems

Task Definition with EFS:
```json
{
  "volumes": [
    {
      "name": "efs-volume",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-0abc123",
        "rootDirectory": "/",
        "transitEncryption": "ENABLED",
        "authorizationConfig": {
          "accessPointId": "fsap-0abc123",
          "iam": "ENABLED"
        }
      }
    }
  ],
  "containerDefinitions": [
    {
      "name": "myapp",
      "mountPoints": [
        {
          "sourceVolume": "efs-volume",
          "containerPath": "/app/uploads",
          "readOnly": false
        }
      ]
    }
  ]
}
```

---

## 8. ECS Service Connect

Service Connect provides service discovery and service mesh capabilities for ECS services.
It is the successor to Cloud Map for ECS.

```
+-----------------------------------------------+
|              ECS Cluster                       |
|                                               |
|  +----------+         +----------+            |
|  | Service A|-------->| Service B|            |
|  |  Tasks   |  myapp  |  Tasks   |            |
|  |          | .local  |          |            |
|  +----------+         +----------+            |
|                                               |
|  Each task has an Envoy proxy sidecar injected|
|  automatically by ECS Service Connect         |
+-----------------------------------------------+
```

Benefits:
- Services can reach each other by DNS name (e.g., `http://myapp:3000`)
- Traffic metrics (requests, latency, errors) in CloudWatch
- Client-side load balancing
- No need to manually configure DNS

To enable: set `serviceConnectConfiguration` in the service definition with a namespace.

---

## 9. Deployments: Rolling and Blue/Green

### Rolling Update (Default)

ECS gradually replaces old tasks with new tasks, maintaining minimum healthy percent.

```
Before deployment:  [v1] [v1] [v1] [v1]  (desired=4)

During deployment (minimumHealthyPercent=50, maximumPercent=200):
Step 1: [v1] [v1] [v2] [v2]  (2 old + 2 new)
Step 2: [v2] [v2] [v2] [v2]  (all new)

ALB:
- v2 tasks pass health check -> added to target group
- v1 tasks deregistered -> connection draining -> stopped
```

Configuration in service:
```json
{
  "deploymentConfiguration": {
    "minimumHealthyPercent": 50,
    "maximumPercent": 200
  },
  "deploymentController": {
    "type": "ECS"
  }
}
```

### Blue/Green Deployment (CodeDeploy)

```
BLUE (current)              GREEN (new)
+-----------+               +-----------+
| v1 Tasks  |               | v2 Tasks  |
| (3 tasks) |               | (3 tasks) |
+-----------+               +-----------+
      |                           |
  Target Group 1             Target Group 2
      |                           |
+-----+---------------------------+-----+
|                 ALB                   |
|  Listener 1 (prod):  100% -> Blue     |
|  Listener 2 (test):  100% -> Green    |
+---------------------------------------+

Deploy v2 -> All traffic to Blue
Test v2 via Listener 2 (test port)
Shift traffic: 10% Green, 90% Blue
Shift traffic: 100% Green
Wait for stability period
Terminate Blue (or keep for rollback)
```

Blue/Green benefits:
- Zero downtime deployment
- Instant rollback (just re-route ALB traffic back to Blue)
- Test the new version before it receives production traffic
- Bake time: keep both running to verify stability

Configured via CodeDeploy integration in ECS service.

---

## 10. ECS Anywhere

ECS Anywhere lets you run ECS tasks on infrastructure outside of AWS — on-premises servers,
in your data center, or on other cloud providers.

The ECS Agent and SSM Agent are installed on the external instances, which then register
with your ECS cluster in AWS. You can then use the same ECS APIs, console, and tooling
to manage these external instances alongside your AWS tasks.

Use cases:
- Gradual cloud migration — run some tasks on-prem, some in AWS
- Data sovereignty requirements — data must stay on-premises
- Hybrid architectures
- Leverage existing hardware investment

```
+------------------+          +--------------------+
|    AWS Region    |          |  On-Premises DC    |
|                  |          |                    |
|  ECS Control     |  <-----> |  ECS Agent         |
|  Plane           |  SSM     |  (your server)     |
|                  |          |  Registered as     |
|  ECS Cluster     |          |  EXTERNAL instance  |
+------------------+          +--------------------+
```

---

## 11. Hands-On: Deploy Node.js on ECS Fargate

### Step 1: Create ECR Repository and Push Image

```bash
# Create ECR repo
aws ecr create-repository \
  --repository-name myapp \
  --region ap-southeast-2

# Authenticate Docker to ECR
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com

# Build, tag, push
docker build -t myapp:1.0 .
docker tag myapp:1.0 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0
docker push 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0
```

### Step 2: Create IAM Roles

```bash
# Task Execution Role (allows ECS to pull images and write logs)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Task Role (permissions for your app to call AWS services)
aws iam create-role \
  --role-name myapp-task-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

### Step 3: Create CloudWatch Log Group

```bash
aws logs create-log-group --log-group-name /ecs/myapp
```

### Step 4: Register Task Definition

```bash
aws ecs register-task-definition --cli-input-json '{
  "family": "myapp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/myapp-task-role",
  "containerDefinitions": [
    {
      "name": "myapp",
      "image": "123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0",
      "essential": true,
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}'
```

### Step 5: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name my-cluster \
  --capacity-providers FARGATE FARGATE_SPOT
```

### Step 6: Create ALB, Target Group, and Security Groups

```bash
# Security group for ALB (allow internet traffic)
aws ec2 create-security-group \
  --group-name alb-sg \
  --description "ALB Security Group" \
  --vpc-id vpc-abc123

aws ec2 authorize-security-group-ingress \
  --group-id sg-alb123 \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# Security group for ECS tasks (allow from ALB only)
aws ec2 create-security-group \
  --group-name ecs-tasks-sg \
  --description "ECS Tasks Security Group" \
  --vpc-id vpc-abc123

aws ec2 authorize-security-group-ingress \
  --group-id sg-ecs123 \
  --protocol tcp --port 3000 \
  --source-group sg-alb123

# Create ALB
aws elbv2 create-load-balancer \
  --name myapp-alb \
  --subnets subnet-public1 subnet-public2 \
  --security-groups sg-alb123 \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name myapp-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-abc123 \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### Step 7: Create ECS Service

```bash
aws ecs create-service \
  --cluster my-cluster \
  --service-name myapp-service \
  --task-definition myapp:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-private1", "subnet-private2"],
      "securityGroups": ["sg-ecs123"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --load-balancers '[{
    "targetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/myapp-tg/...",
    "containerName": "myapp",
    "containerPort": 3000
  }]' \
  --deployment-configuration '{
    "minimumHealthyPercent": 50,
    "maximumPercent": 200
  }'
```

### Step 8: Update to New Version

```bash
# After pushing a new image to ECR...

# Register new task definition revision (update image tag)
aws ecs register-task-definition ... # with :2.0 image tag

# Update service to use new task definition
aws ecs update-service \
  --cluster my-cluster \
  --service myapp-service \
  --task-definition myapp:2

# Monitor deployment
aws ecs describe-services \
  --cluster my-cluster \
  --services myapp-service \
  --query 'services[0].deployments'
```

---

## 12. Interview Q&A

**Q1: What is the difference between an ECS Task and an ECS Service?**

A Task is a running instance of a Task Definition — it runs one or more containers.
A Service is a long-running scheduler that ensures a specified number of tasks are always
running. If a task fails or becomes unhealthy, the Service automatically starts a replacement.
A Service also manages rolling deployments, integrates with load balancers, and supports
auto scaling. Use a Service for web APIs and long-running applications; use standalone tasks
for batch jobs and one-off scripts.

**Q2: What is the difference between the Task Execution Role and the Task Role?**

The Task Execution Role is used by the ECS agent (not your application) to perform setup
operations: pulling the container image from ECR, writing logs to CloudWatch, and fetching
secrets from Secrets Manager or SSM Parameter Store. The Task Role is used by your
application code running inside the container to make AWS API calls — like reading from S3,
writing to DynamoDB, or publishing to SQS. Both are IAM roles with trust policies allowing
ecs-tasks.amazonaws.com to assume them.

**Q3: When would you choose Fargate over EC2 launch type?**

Fargate is the better default choice for most workloads because AWS manages the underlying
infrastructure. You pay per task by vCPU and memory, there is no cluster capacity planning,
and scaling is fast. Choose EC2 launch type when you need: GPU instances, specific instance
types with large memory or storage, the ability to SSH into hosts for debugging, spot instance
savings with fine-grained control, or workloads too large for Fargate's 16 vCPU / 120 GB limits.

**Q4: How does ECS integrate with an Application Load Balancer?**

ECS services register task IPs (with awsvpc mode) or task IP + dynamic port (with bridge mode)
directly with an ALB Target Group. When a new task passes health checks, it is added to the
target group. When a task is stopping, it is deregistered from the target group with connection
draining before the container is terminated. ALB performs health checks on every registered task
and stops routing to unhealthy ones. ECS creates replacement tasks if health checks fail.

**Q5: What is the network mode awsvpc and why is it required for Fargate?**

With `awsvpc` network mode, each ECS task gets its own Elastic Network Interface (ENI) with
a private IP address from the VPC subnet. This means tasks behave like EC2 instances from
a networking perspective — they have their own security groups, can be reached by IP, and
are subject to VPC routing rules. Fargate requires `awsvpc` because Fargate tasks run on
AWS-managed infrastructure, and the ENI is the attachment point between your VPC and the
invisible underlying host.

**Q6: How do you pass secrets to ECS containers securely?**

In the Task Definition, use the `secrets` field (not `environment`) to reference values
from AWS Secrets Manager or SSM Parameter Store. The ECS agent (using the Task Execution
Role) fetches the secret values at task startup and injects them as environment variables.
The actual secret values are never stored in the task definition itself — only the ARN.
The Task Execution Role needs permissions to read from Secrets Manager or SSM.

**Q7: What is ECS Service Auto Scaling?**

ECS Services can automatically adjust the desired task count using Application Auto Scaling.
You register the ECS service as a scalable target and define scaling policies. Target tracking
policies maintain a specific metric (CPU 70%, memory 70%, ALB requests per target). Step
scaling policies add or remove tasks in steps based on CloudWatch alarm thresholds. Scheduled
scaling adjusts capacity at set times. There is a scale-out cooldown (how long to wait before
scaling out again) and scale-in cooldown (how long to wait before scaling in).

**Q8: How does a Blue/Green deployment work in ECS?**

Blue/Green deployments in ECS use AWS CodeDeploy. The current (Blue) tasks continue serving
traffic. A new set of (Green) tasks is started with the new version. A test listener on a
non-production port lets you verify the Green environment. Traffic is then shifted from Blue
to Green, either all at once, linearly (10% per minute), or in canary fashion (10% first,
then all). During a stability period, both environments are running. If no errors, Blue is
terminated. At any point before termination, you can instantly rollback by rerouting the
ALB listener back to Blue.

**Q9: What is the ECS Agent?**

The ECS Agent is an open-source container that runs on each EC2 instance in an ECS cluster.
It communicates with the ECS service and receives tasks to run, manages the container
lifecycle, reports back container status, and handles resource registration. When using
Fargate, the ECS Agent is managed by AWS and not visible to you. The Agent is included in
the ECS-optimized AMI.

**Q10: How do you run a one-off task in ECS (like a database migration)?**

Use `aws ecs run-task` with the cluster name, task definition, launch type, network
configuration, and optionally an overrides object to change the command. For example,
run the same task definition with `["node", "scripts/migrate.js"]` as the command override.
The task runs to completion and exits. You can monitor it with `describe-tasks` and stream
its logs from CloudWatch Logs.
