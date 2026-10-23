# Amazon EKS (Elastic Kubernetes Service) - Complete Guide

## Table of Contents

### Part 1: Kubernetes Fundamentals
1. [What is Kubernetes and the Problem it Solves](#what-is-kubernetes)
2. [VMs vs Containers vs Kubernetes](#vms-vs-containers-vs-kubernetes)
3. [Kubernetes Architecture](#kubernetes-architecture)
4. [Core Kubernetes Objects](#core-kubernetes-objects)
5. [kubectl Essential Commands](#kubectl-commands)
6. [YAML Manifest Structure](#yaml-manifest-structure)

### Part 2: EKS Specifics
7. [What is EKS](#what-is-eks)
8. [EKS Architecture](#eks-architecture)
9. [Node Options: Managed, Self-Managed, Fargate](#node-options)
10. [eksctl: Creating Clusters](#eksctl)
11. [kubeconfig and EKS Integration](#kubeconfig)
12. [AWS Load Balancer Controller](#aws-load-balancer-controller)
13. [IRSA: IAM Roles for Service Accounts](#irsa)
14. [aws-auth ConfigMap](#aws-auth-configmap)
15. [EBS CSI Driver](#ebs-csi-driver)
16. [EFS CSI Driver](#efs-csi-driver)
17. [Cluster Autoscaler and Karpenter](#autoscaling)
18. [Helm](#helm)
19. [EKS Add-ons](#eks-addons)
20. [Monitoring with CloudWatch Container Insights](#monitoring)
21. [ECS vs EKS Decision Guide](#ecs-vs-eks)
22. [Interview Q&A](#interview-qa)

---

# PART 1: Kubernetes Fundamentals

## 1. What is Kubernetes and the Problem it Solves

### The Problem

When you run applications in containers, at small scale (say, one server with a few containers), Docker alone is sufficient. But as your application grows, you face a cascade of operational challenges:

- **Scaling:** How do you automatically add more containers when traffic spikes? And remove them when it drops?
- **Scheduling:** When you have 10 servers and 50 containers, which container goes on which server? How do you ensure servers aren't over-provisioned or starved?
- **Self-healing:** If a container crashes, how is it automatically restarted? If a server dies, how are its containers moved to healthy servers?
- **Rolling updates:** How do you deploy a new version of your app with zero downtime?
- **Rollbacks:** If a bad deployment goes out, how do you revert instantly?
- **Service discovery:** How does Service A find Service B when containers are constantly moving between servers?
- **Load balancing:** How do you distribute traffic across multiple instances of a service?
- **Secret management:** How do you securely inject environment variables and credentials into containers?
- **Storage:** How do you attach persistent storage to containers that might move between servers?

Docker Swarm attempted to solve these problems, but the ecosystem largely converged on Kubernetes as the standard.

### What Kubernetes Is

Kubernetes (often abbreviated K8s — the 8 replaces "ubernete") is an open-source container orchestration platform originally developed by Google, now maintained by the Cloud Native Computing Foundation (CNCF).

It provides:
- **Declarative configuration:** You describe the desired state ("I want 5 replicas of this container") and Kubernetes continuously works to make reality match that description.
- **Automated scheduling:** Places containers on nodes based on resource requirements and constraints.
- **Self-healing:** Restarts failed containers, replaces containers on failed nodes, kills containers that don't pass health checks.
- **Horizontal scaling:** Scale applications up/down manually or automatically.
- **Service discovery and load balancing:** Stable DNS names and IP addresses for services; automatic load balancing.
- **Automated rollouts/rollbacks:** Deploy new versions gradually; roll back if something goes wrong.
- **Secret and config management:** Store and manage sensitive information separately from application code.
- **Storage orchestration:** Automatically mount storage systems (local, cloud providers, NFS, etc.).

---

## 2. VMs vs Containers vs Kubernetes

### Virtual Machines

```
┌─────────────────────────────────────────────┐
│              Physical Server                │
│  ┌─────────────────────────────────────┐   │
│  │         Hypervisor (VMware/KVM)     │   │
│  │  ┌──────────┐  ┌──────────┐        │   │
│  │  │   VM 1   │  │   VM 2   │        │   │
│  │  │ ┌──────┐ │  │ ┌──────┐ │        │   │
│  │  │ │Guest │ │  │ │Guest │ │        │   │
│  │  │ │  OS  │ │  │ │  OS  │ │        │   │
│  │  │ └──────┘ │  │ └──────┘ │        │   │
│  │  │   App    │  │   App    │        │   │
│  │  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- Each VM includes a full guest OS (GBs of overhead)
- Boot time: minutes
- Strong isolation (full OS boundary)
- Resource-heavy: each VM needs its own OS kernel, libraries, binaries

### Containers

```
┌─────────────────────────────────────────────┐
│              Physical Server                │
│  ┌─────────────────────────────────────┐   │
│  │          Host OS + Kernel           │   │
│  │  ┌──────────┐  ┌──────────┐        │   │
│  │  │Container1│  │Container2│        │   │
│  │  │ ┌──────┐ │  │ ┌──────┐ │        │   │
│  │  │ │App+  │ │  │ │App+  │ │        │   │
│  │  │ │Libs  │ │  │ │Libs  │ │        │   │
│  │  │ └──────┘ │  │ └──────┘ │        │   │
│  │  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- Share the host OS kernel (no guest OS needed)
- Boot time: milliseconds
- Lighter weight: MBs vs GBs
- Less isolation than VMs (process-level isolation via namespaces and cgroups)
- Portable: same image runs on any system with the container runtime

### Kubernetes (Container Orchestration)

```
┌────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Control Plane                          │ │
│  │  API Server   etcd   Scheduler   Controller Manager      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │  Worker    │  │  Worker    │  │  Worker    │              │
│  │  Node 1    │  │  Node 2    │  │  Node 3    │              │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │              │
│  │ │Pod(s)  │ │  │ │Pod(s)  │ │  │ │Pod(s)  │ │              │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │              │
│  └────────────┘  └────────────┘  └────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

Kubernetes adds a management layer on top of containers, solving the orchestration problem. You stop thinking "run this container on server X" and start thinking "run 5 replicas of this container, keep them healthy, scale as needed."

| Aspect | VMs | Containers | Kubernetes |
|---|---|---|---|
| Unit | Virtual Machine | Container | Pod (group of containers) |
| OS | Full guest OS per VM | Shared host OS | Shared OS per node |
| Boot time | Minutes | Seconds | Seconds (plus scheduling) |
| Resource overhead | High (GBs) | Low (MBs) | Low per container + control plane overhead |
| Isolation | Strong | Moderate | Moderate (per pod) |
| Scaling | Manual (or with tools) | Manual | Automatic (HPA, Karpenter) |
| Self-healing | No (needs external tools) | No (needs orchestrator) | Yes (built-in) |
| Portability | Limited by hypervisor | Highly portable | Highly portable + cloud-agnostic |

---

## 3. Kubernetes Architecture

### Control Plane

The control plane is the "brain" of Kubernetes. It makes global decisions about the cluster (scheduling, responding to events) and manages cluster state.

```
┌──────────────────────────────────────────────────────┐
│                     Control Plane                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │  API Server │  │            etcd              │  │
│  │             │  │  (cluster state key-value DB)│  │
│  │  The single │  │  Single source of truth for  │  │
│  │  entry point│  │  all cluster configuration   │  │
│  └─────────────┘  └──────────────────────────────┘  │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │    Scheduler     │  │   Controller Manager     │  │
│  │                  │  │                          │  │
│  │  Assigns pods to │  │  Runs control loops:     │  │
│  │  nodes based on  │  │  - ReplicaSet controller │  │
│  │  resources and   │  │  - Deployment controller │  │
│  │  constraints     │  │  - Node controller       │  │
│  └──────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**API Server (`kube-apiserver`)**
- The central communication hub for all Kubernetes components
- Exposes the Kubernetes REST API
- All commands from `kubectl` go through the API server
- Authenticates and validates requests
- Updates state in etcd
- Horizontally scalable — you can run multiple API server replicas

**etcd**
- A distributed, consistent key-value store
- Stores all cluster state: pods, services, deployments, config maps, secrets — everything
- The single source of truth for the cluster
- Highly available in production (3 or 5 nodes for quorum)
- In EKS, AWS manages etcd — you never interact with it directly

**Scheduler (`kube-scheduler`)**
- Watches for newly created pods with no assigned node
- Selects the best node for each pod based on:
  - Resource requirements (CPU, memory)
  - Node selectors and affinity rules
  - Taints and tolerations
  - Available capacity
- Once it selects a node, it writes the assignment to etcd via the API server

**Controller Manager (`kube-controller-manager`)**
- Runs a collection of controllers, each in a separate goroutine
- Key controllers:
  - **ReplicaSet Controller:** Ensures the correct number of pod replicas are running
  - **Deployment Controller:** Manages rolling updates and rollbacks
  - **Node Controller:** Responds to node failures
  - **Service Account Controller:** Creates default service accounts
  - **Endpoint Controller:** Populates the Endpoints object (links Services to Pods)

### Worker Nodes

Worker nodes run the actual application workloads. Each node has three key components:

**kubelet**
- The primary node agent; runs on every worker node
- Communicates with the API server to get pod specs assigned to its node
- Ensures containers described in pod specs are running and healthy
- Reports node and pod status back to the API server
- Does NOT manage containers directly — delegates to the container runtime

**kube-proxy**
- A network proxy that runs on each node
- Maintains network rules that allow communication to pods from inside and outside the cluster
- Implements the Service concept by routing traffic to the correct pod IPs
- Can use iptables or IPVS for routing

**Container Runtime**
- The software that actually runs containers
- Kubernetes supports any runtime implementing the Container Runtime Interface (CRI)
- Options: containerd (most common in EKS), CRI-O, Docker (via dockershim, deprecated)
- In modern EKS (1.24+), containerd is the default

---

## 4. Core Kubernetes Objects

### Cluster

A Kubernetes cluster is the top-level entity — it consists of the control plane and all worker nodes. Everything in Kubernetes lives within a cluster.

### Node

A Node is a physical or virtual machine that is part of the cluster. It runs pods. Nodes have:
- Capacity: total CPU and memory
- Allocatable: CPU and memory available for pods (total minus system reserved)
- Conditions: Ready, MemoryPressure, DiskPressure, PIDPressure

```bash
kubectl get nodes                    # List all nodes
kubectl describe node <node-name>    # Detailed node info
```

### Pod

The smallest deployable unit in Kubernetes. A Pod wraps one or more containers that:
- Share the same network namespace (same IP, communicate via localhost)
- Share the same storage volumes
- Are always scheduled together on the same node

In practice, most pods contain a single container. Multiple containers in one pod (sidecar pattern) is used for closely coupled processes like log shippers, proxies (Envoy, Istio), or init containers.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
spec:
  containers:
    - name: myapp
      image: 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v1.0.0
      ports:
        - containerPort: 8080
      resources:
        requests:
          cpu: "250m"      # 0.25 CPU cores
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

### Deployment

Deployments manage ReplicaSets to provide declarative updates for Pods. You define the desired state (image version, replica count), and the Deployment controller handles rolling updates and rollbacks.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: myapp
        version: v2.1.0
    spec:
      containers:
        - name: myapp
          image: 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:v2.1.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
```

### Service

Services provide stable network access to pods. Since pod IPs change as pods are created and destroyed, Services provide a stable endpoint (IP or DNS name) that load-balances traffic across matching pods (selected by labels).

**ClusterIP (default)**
- Internal cluster IP, only reachable from within the cluster
- Use case: internal microservice communication

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
    - port: 80          # port the service listens on
      targetPort: 8080  # port on the pod
```

**NodePort**
- Exposes the service on each Node's IP at a static port (30000-32767)
- Accessible from outside the cluster via `<NodeIP>:<NodePort>`
- Use case: development, testing, not recommended for production

```yaml
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080   # optional; auto-assigned if omitted
```

**LoadBalancer**
- Creates an external load balancer (in AWS, this creates an ELB/NLB)
- Automatically assigns an external IP/hostname
- Use case: exposing services to the internet (but Ingress is usually preferred)

```yaml
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
```

### Ingress

Ingress manages external HTTP/HTTPS routing to services. A single Ingress resource can route traffic to multiple services based on host and path rules. Requires an Ingress Controller (e.g., AWS Load Balancer Controller, NGINX).

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - host: api.mycompany.com
      http:
        paths:
          - path: /users
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 80
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
  tls:
    - hosts:
        - api.mycompany.com
      secretName: myapp-tls
```

### ConfigMap

Stores non-sensitive configuration data as key-value pairs. Decouples configuration from container images.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  DATABASE_HOST: "mydb.cluster.local"
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
    cache:
      ttl: 300s
```

Consuming in a pod:
```yaml
env:
  - name: APP_ENV
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: APP_ENV

# Or mount as a file
volumeMounts:
  - name: config-volume
    mountPath: /etc/myapp
volumes:
  - name: config-volume
    configMap:
      name: myapp-config
```

### Secret

Stores sensitive data (passwords, tokens, certificates). Values are base64-encoded (NOT encrypted by default — enable encryption at rest with KMS for production).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: bXl1c2Vy          # base64("myuser")
  password: c3VwZXJzZWNyZXQ=  # base64("supersecret")
```

Creating secrets imperatively:
```bash
kubectl create secret generic db-secret \
    --from-literal=username=myuser \
    --from-literal=password=supersecret
```

### Namespace

Namespaces provide virtual isolation within a cluster. They allow multiple teams or environments to share a cluster with separate resource quotas, RBAC policies, and network policies.

```bash
kubectl create namespace production
kubectl create namespace staging
kubectl create namespace development
```

Common namespaces in Kubernetes:
- `default`: Where resources go if no namespace is specified
- `kube-system`: System components (kube-dns, kube-proxy, etc.)
- `kube-public`: Publicly accessible resources
- `kube-node-lease`: Node heartbeat objects

### PersistentVolume (PV) and PersistentVolumeClaim (PVC)

PVs are cluster-level storage resources (provisioned by admins or dynamically). PVCs are requests for storage by pods. The PVC-PV binding decouples pods from the underlying storage implementation.

```yaml
# StorageClass (dynamic provisioning)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer

---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myapp-data
spec:
  storageClassName: gp3
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi

---
# Using the PVC in a Pod
spec:
  containers:
    - name: myapp
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: myapp-data
```

### HorizontalPodAutoscaler (HPA)

Automatically scales the number of pod replicas based on CPU/memory utilization or custom metrics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp-deployment
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## 5. kubectl Essential Commands

### Context and Configuration

```bash
# View current context (which cluster you're talking to)
kubectl config current-context

# List all contexts
kubectl config get-contexts

# Switch context
kubectl config use-context my-eks-cluster

# View full kubeconfig
kubectl config view
```

### Getting Resources

```bash
# Get pods in default namespace
kubectl get pods

# Get pods in specific namespace
kubectl get pods -n production

# Get pods across all namespaces
kubectl get pods --all-namespaces
kubectl get pods -A

# Get pods with more detail (node, IP)
kubectl get pods -o wide

# Get pods with labels
kubectl get pods --show-labels

# Watch pods update in real time
kubectl get pods -w

# Get all resource types
kubectl get all -n production

# Get specific resource types
kubectl get deployments
kubectl get services
kubectl get ingress
kubectl get configmaps
kubectl get secrets
kubectl get nodes
kubectl get namespaces
kubectl get pvc
kubectl get storageclass
kubectl get hpa
```

### Describing Resources (Detailed Info + Events)

```bash
kubectl describe pod myapp-pod-abc123
kubectl describe deployment myapp-deployment
kubectl describe service myapp-service
kubectl describe node ip-10-0-1-50.ec2.internal
kubectl describe ingress myapp-ingress
```

### Logs

```bash
# Get logs from a pod
kubectl logs myapp-pod-abc123

# Follow logs (like tail -f)
kubectl logs -f myapp-pod-abc123

# Logs from a specific container in a multi-container pod
kubectl logs myapp-pod-abc123 -c sidecar-container

# Previous container logs (if container restarted)
kubectl logs myapp-pod-abc123 --previous

# Logs from all pods in a deployment
kubectl logs -l app=myapp

# Last 100 lines
kubectl logs myapp-pod-abc123 --tail=100

# Logs since 1 hour ago
kubectl logs myapp-pod-abc123 --since=1h
```

### Executing Commands in Containers

```bash
# Open a shell in a running container
kubectl exec -it myapp-pod-abc123 -- /bin/bash
kubectl exec -it myapp-pod-abc123 -- /bin/sh

# Run a one-off command
kubectl exec myapp-pod-abc123 -- env
kubectl exec myapp-pod-abc123 -- cat /etc/config/app.yaml
```

### Applying and Managing Resources

```bash
# Apply a manifest (create or update)
kubectl apply -f deployment.yaml
kubectl apply -f ./k8s/  # apply all files in directory
kubectl apply -f https://example.com/manifest.yaml

# Create (error if already exists)
kubectl create -f manifest.yaml

# Delete resources
kubectl delete -f deployment.yaml
kubectl delete pod myapp-pod-abc123
kubectl delete deployment myapp-deployment
kubectl delete namespace old-namespace

# Force delete a stuck pod
kubectl delete pod myapp-pod-abc123 --grace-period=0 --force
```

### Scaling and Updates

```bash
# Scale a deployment
kubectl scale deployment myapp-deployment --replicas=5

# Update a deployment image
kubectl set image deployment/myapp-deployment myapp=myapp:v2.0.0

# Check rollout status
kubectl rollout status deployment/myapp-deployment

# View rollout history
kubectl rollout history deployment/myapp-deployment

# Rollback to previous version
kubectl rollout undo deployment/myapp-deployment

# Rollback to specific revision
kubectl rollout undo deployment/myapp-deployment --to-revision=3

# Pause/resume a rollout
kubectl rollout pause deployment/myapp-deployment
kubectl rollout resume deployment/myapp-deployment
```

### Imperative Resource Creation

```bash
# Create a deployment imperatively
kubectl create deployment myapp --image=nginx:1.21 --replicas=3

# Expose a deployment as a service
kubectl expose deployment myapp --port=80 --target-port=8080 --type=ClusterIP

# Create a ConfigMap
kubectl create configmap myapp-config --from-literal=key=value --from-file=config.yaml

# Create a Secret
kubectl create secret generic my-secret --from-literal=password=mysecret
kubectl create secret tls my-tls --cert=cert.pem --key=key.pem
```

### Resource Requests and Troubleshooting

```bash
# Check resource usage (requires metrics-server)
kubectl top pods
kubectl top nodes

# Get pod events (useful for debugging scheduling failures)
kubectl describe pod <pod-name> | grep -A 10 Events

# Edit a resource live (opens in editor)
kubectl edit deployment myapp-deployment

# Patch a resource
kubectl patch deployment myapp-deployment \
  -p '{"spec":{"replicas":5}}'

# Port-forward to a pod (for local debugging)
kubectl port-forward pod/myapp-pod-abc123 8080:8080
kubectl port-forward service/myapp-service 8080:80

# Copy files to/from a pod
kubectl cp myapp-pod-abc123:/var/log/app.log ./app.log
kubectl cp ./config.yaml myapp-pod-abc123:/etc/config/
```

---

## 6. YAML Manifest Structure

Every Kubernetes manifest follows a consistent structure with four top-level fields:

```yaml
apiVersion: <group/version>    # Which API version to use
kind: <ResourceType>           # What type of resource
metadata:                      # Resource metadata
  name: <name>
  namespace: <namespace>
  labels:
    key: value
  annotations:
    key: value
spec:                          # Desired state (resource-specific)
  ...
```

### apiVersion

Different resources use different API groups and versions:

| Resource | apiVersion |
|---|---|
| Pod, Service, ConfigMap, Secret, Namespace, PV, PVC | `v1` |
| Deployment, ReplicaSet, DaemonSet, StatefulSet | `apps/v1` |
| HorizontalPodAutoscaler (v1) | `autoscaling/v1` |
| HorizontalPodAutoscaler (v2) | `autoscaling/v2` |
| Ingress | `networking.k8s.io/v1` |
| NetworkPolicy | `networking.k8s.io/v1` |
| StorageClass | `storage.k8s.io/v1` |
| CronJob, Job | `batch/v1` |
| ClusterRole, Role, RoleBinding | `rbac.authorization.k8s.io/v1` |
| ServiceAccount | `v1` |

### kind

The resource type. Must match exactly (case-sensitive, PascalCase).

### metadata

```yaml
metadata:
  name: myapp-deployment          # Required; must be unique in namespace
  namespace: production           # Optional; defaults to 'default'
  labels:                         # Key-value pairs for selection and organization
    app: myapp
    env: production
    version: v2.1.0
    team: backend
  annotations:                    # Non-identifying metadata (tools, external systems)
    kubernetes.io/change-cause: "Updated to v2.1.0 — adds user auth"
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
```

**Labels vs Annotations:**
- Labels are for selection (Services use label selectors to find pods, HPA uses them to find deployments)
- Annotations are for metadata that doesn't affect behavior (build info, URLs, tool configuration)

### spec

Resource-specific. The spec defines the desired state of the resource. The controller manager continuously reconciles actual state with the spec.

---

# PART 2: EKS Specifics

## 7. What is EKS

Amazon Elastic Kubernetes Service (EKS) is AWS's managed Kubernetes service. It runs the Kubernetes control plane for you across multiple AWS Availability Zones, handles upgrades, patching, and scaling of the control plane, and integrates with AWS services.

**What AWS manages in EKS:**
- Kubernetes API server instances (across AZs for HA)
- etcd cluster (across AZs, encrypted at rest)
- Control plane upgrades
- Control plane certificates
- Control plane health and recovery

**What you manage in EKS:**
- Worker nodes (EC2 instances or Fargate profiles)
- Node OS patching and upgrades
- Kubernetes add-ons (CoreDNS, kube-proxy, VPC CNI)
- Application workloads
- Networking configuration
- IAM permissions for pods (via IRSA)

### EKS Pricing

- Control plane: $0.10/hour per cluster (~$73/month)
- Worker nodes: Standard EC2 pricing for the instances
- Fargate: Per vCPU and memory per second
- Data transfer: Standard AWS rates

---

## 8. EKS Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         AWS Account                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    EKS Managed VPC                       │   │
│  │   (AWS-managed, not in your account)                     │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              EKS Control Plane                     │  │   │
│  │  │                                                    │  │   │
│  │  │  API Server (AZ-a)  API Server (AZ-b)              │  │   │
│  │  │  etcd (AZ-a)        etcd (AZ-b)       etcd (AZ-c) │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          │ Kubernetes API (HTTPS)                │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Your VPC                             │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              Managed Node Group                   │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │   │
│  │  │  │  EC2     │  │  EC2     │  │  EC2     │       │   │   │
│  │  │  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │       │   │   │
│  │  │  │ [kubelet]│  │ [kubelet]│  │ [kubelet]│       │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘       │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │            Fargate Profile (optional)             │   │   │
│  │  │  [Serverless pods — no EC2 management]           │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural facts:**
- The control plane runs in AWS-managed infrastructure (not visible in your VPC)
- API server endpoint can be public, private, or both
- Worker nodes in your VPC communicate with the API server via an ENI (Elastic Network Interface) projected into your VPC
- VPC CNI plugin gives each pod a real VPC IP address (from your subnet CIDR)

---

## 9. Node Options

### Managed Node Groups

AWS manages the EC2 instances (Auto Scaling Group) for you. You define the instance type, size, and AMI. AWS handles:
- Provisioning the ASG
- Using the EKS-optimized AMI
- Node bootstrap configuration
- Graceful node draining during updates
- AMI patching (you initiate the update, AWS handles the rolling replacement)

```bash
# Create a managed node group
aws eks create-nodegroup \
    --cluster-name my-cluster \
    --nodegroup-name my-node-group \
    --node-role arn:aws:iam::123456789012:role/EKSNodeGroupRole \
    --subnets subnet-abc123 subnet-def456 \
    --instance-types t3.medium \
    --scaling-config minSize=2,maxSize=10,desiredSize=3 \
    --disk-size 50 \
    --ami-type AL2_x86_64 \
    --region ap-southeast-2
```

### Self-Managed Node Groups

You create and manage the EC2 instances and Auto Scaling Groups yourself. Useful when you need:
- Custom AMIs (e.g., with specific security agents)
- Windows nodes
- Specialized hardware not available in managed node groups
- Full control over every node configuration

You're responsible for:
- Creating the ASG with the correct bootstrap arguments
- Patching the nodes
- Managing the node lifecycle

### Fargate Profiles

Run pods as serverless. No EC2 nodes to manage. AWS provisions compute behind the scenes (each pod gets its own isolated micro-VM).

```bash
# Create a Fargate profile
aws eks create-fargate-profile \
    --cluster-name my-cluster \
    --fargate-profile-name my-fargate-profile \
    --pod-execution-role-arn arn:aws:iam::123456789012:role/EKSFargatePodExecutionRole \
    --subnets subnet-abc123 subnet-def456 \
    --selectors namespace=production,labels={app=myapp} \
    --region ap-southeast-2
```

Pods are placed on Fargate if they match the namespace + label selectors defined in the profile.

### Comparison Table

| Feature | Managed Node Groups | Self-Managed Nodes | Fargate |
|---|---|---|---|
| EC2 management | AWS manages the ASG | You manage everything | No EC2 at all |
| AMI updates | AWS provides, you initiate | Fully manual | AWS manages |
| Pricing | EC2 instance pricing | EC2 instance pricing | Per vCPU + memory/second |
| Cost efficiency | Good (spot support) | Good (spot support) | Higher per workload |
| Scaling | Manual or with Cluster Autoscaler | Manual or with Cluster Autoscaler | Automatic per pod |
| Persistent volumes (EBS) | Yes | Yes | No (EBS can't attach to Fargate) |
| Daemonsets | Yes | Yes | No |
| GPU support | Yes | Yes | No |
| Windows nodes | No | Yes | No |
| Custom AMI | Limited (launch templates) | Full control | N/A |
| Best for | Most workloads | Custom requirements | Stateless, bursty, batch |

---

## 10. eksctl: Creating Clusters

`eksctl` is the official CLI tool for creating and managing EKS clusters. It abstracts the complexity of CloudFormation, VPC configuration, and IAM role creation.

### Installation

```bash
# macOS
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl

# Linux
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

### Creating a Cluster (Simple)

```bash
eksctl create cluster \
    --name my-cluster \
    --version 1.29 \
    --region ap-southeast-2 \
    --nodegroup-name standard-workers \
    --node-type t3.medium \
    --nodes 3 \
    --nodes-min 2 \
    --nodes-max 5 \
    --managed
```

This single command creates:
- A new VPC with public and private subnets across 3 AZs
- The EKS control plane
- A managed node group with EC2 instances
- IAM roles for the control plane and nodes
- Updates your kubeconfig to include the new cluster

### Creating a Cluster with a Config File (Recommended)

```yaml
# cluster-config.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: my-production-cluster
  region: ap-southeast-2
  version: "1.29"
  tags:
    environment: production
    team: platform

iam:
  withOIDC: true   # Enables IRSA (IAM Roles for Service Accounts)

vpc:
  cidr: 10.0.0.0/16
  nat:
    gateway: HighlyAvailable  # One NAT GW per AZ

managedNodeGroups:
  - name: system-nodes
    instanceType: t3.medium
    minSize: 2
    maxSize: 4
    desiredCapacity: 2
    volumeSize: 50
    volumeType: gp3
    amiFamily: AmazonLinux2
    labels:
      role: system
    taints:
      - key: "CriticalAddonsOnly"
        value: "true"
        effect: "NoSchedule"
    iam:
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy

  - name: application-nodes
    instanceTypes: ["m5.xlarge", "m5.2xlarge", "m4.xlarge"]
    spot: true           # Use Spot instances for cost savings
    minSize: 2
    maxSize: 20
    desiredCapacity: 3
    volumeSize: 100
    volumeType: gp3
    labels:
      role: application
      lifecycle: spot
    iam:
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
    wellKnownPolicies:
      ebsCSIController: true
```

```bash
eksctl create cluster -f cluster-config.yaml
```

### Common eksctl Commands

```bash
# List clusters
eksctl get cluster

# Get node groups
eksctl get nodegroup --cluster my-cluster

# Scale a node group
eksctl scale nodegroup \
    --cluster my-cluster \
    --name application-nodes \
    --nodes 5

# Upgrade cluster version
eksctl upgrade cluster \
    --name my-cluster \
    --version 1.30 \
    --approve

# Delete cluster
eksctl delete cluster --name my-cluster

# Enable OIDC provider (for IRSA)
eksctl utils associate-iam-oidc-provider \
    --cluster my-cluster \
    --approve
```

---

## 11. kubeconfig and EKS Integration

### What is kubeconfig?

`kubeconfig` is a YAML file (default: `~/.kube/config`) that stores cluster connection information, credentials, and context settings. `kubectl` uses it to know which cluster to communicate with.

```yaml
# ~/.kube/config structure
apiVersion: v1
kind: Config
clusters:
  - name: my-eks-cluster
    cluster:
      server: https://ABCDEF1234567890.gr7.ap-southeast-2.eks.amazonaws.com
      certificate-authority-data: <base64-encoded-ca-cert>
users:
  - name: my-eks-cluster-user
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: aws
        args:
          - eks
          - get-token
          - --cluster-name
          - my-eks-cluster
          - --region
          - ap-southeast-2
contexts:
  - name: my-eks-cluster
    context:
      cluster: my-eks-cluster
      user: my-eks-cluster-user
      namespace: default
current-context: my-eks-cluster
```

Key point: For EKS, authentication uses `aws eks get-token` (called by `exec`). This means your AWS credentials/role are used to authenticate to Kubernetes — no separate Kubernetes credentials are needed.

### Adding EKS to kubeconfig

```bash
# Add or update kubeconfig for an EKS cluster
aws eks update-kubeconfig \
    --name my-eks-cluster \
    --region ap-southeast-2

# Add with a specific IAM role (for assumed-role access)
aws eks update-kubeconfig \
    --name my-eks-cluster \
    --region ap-southeast-2 \
    --role-arn arn:aws:iam::123456789012:role/EKSAdminRole

# Add with a custom context name
aws eks update-kubeconfig \
    --name my-eks-cluster \
    --region ap-southeast-2 \
    --alias production-cluster

# Verify access
kubectl get nodes
kubectl get pods --all-namespaces
```

### Managing Multiple Clusters

```bash
# List all contexts
kubectl config get-contexts

# Switch context
kubectl config use-context production-cluster
kubectl config use-context staging-cluster

# Run a command in a specific context without switching
kubectl --context production-cluster get pods

# Set a default namespace for a context
kubectl config set-context --current --namespace=production
```

---

## 12. AWS Load Balancer Controller

The AWS Load Balancer Controller is a Kubernetes controller that manages AWS Elastic Load Balancers for Kubernetes Ingress and Service resources. When you create an Ingress resource with the right annotations, the controller automatically provisions an Application Load Balancer (ALB). For Service type LoadBalancer, it can create a Network Load Balancer (NLB).

### Why Use It vs Default Kubernetes Load Balancer

The default Kubernetes cloud provider integration creates Classic Load Balancers — which are old, lack features, and are more expensive. The AWS Load Balancer Controller creates:
- ALBs for Ingress (HTTP/HTTPS routing, path-based, host-based, WAF integration)
- NLBs for Service LoadBalancer (Layer 4, ultra-low latency, static IPs)

### Installation

```bash
# Step 1: Create IAM policy
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.1/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Step 2: Create IRSA (service account with IAM role)
eksctl create iamserviceaccount \
    --cluster my-cluster \
    --namespace kube-system \
    --name aws-load-balancer-controller \
    --role-name AmazonEKSLoadBalancerControllerRole \
    --attach-policy-arn arn:aws:iam::123456789012:policy/AWSLoadBalancerControllerIAMPolicy \
    --approve

# Step 3: Install with Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=my-cluster \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --set region=ap-southeast-2 \
    --set vpcId=vpc-12345678
```

### Creating an ALB with Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing      # or internal
    alb.ingress.kubernetes.io/target-type: ip              # recommended; routes to pod IPs
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-2:123456789012:certificate/abc123
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443},{"HTTP":80}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/group.name: shared-alb       # share ALB across Ingress resources
spec:
  rules:
    - host: api.mycompany.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp-service
                port:
                  number: 80
```

---

## 13. IRSA: IAM Roles for Service Accounts

### The Problem IRSA Solves

Before IRSA, pods running on EKS nodes used the node's IAM role for AWS API calls. This meant:
- All pods on the same node shared the same permissions
- Over-permissioned: if one pod needed S3 access, all pods on that node got S3 access
- No pod-level isolation

**IRSA (IAM Roles for Service Accounts)** provides pod-level IAM permissions by linking Kubernetes Service Accounts to IAM roles.

### How IRSA Works

1. You create an IAM OIDC provider for your EKS cluster (the OIDC provider represents the Kubernetes cluster's identity)
2. You create an IAM role with a trust policy that allows the OIDC provider to assume it, scoped to a specific namespace and service account
3. You annotate the Kubernetes Service Account with the IAM role ARN
4. The pod uses the annotated Service Account
5. At pod startup, the EKS Pod Identity webhook mutates the pod to inject a projected service account token and environment variables (`AWS_WEB_IDENTITY_TOKEN_FILE`, `AWS_ROLE_ARN`)
6. The AWS SDK in the pod automatically uses these to assume the IAM role via STS

### Setting Up IRSA

**Step 1: Enable OIDC provider for the cluster**
```bash
eksctl utils associate-iam-oidc-provider \
    --cluster my-cluster \
    --approve
```

Or with AWS CLI:
```bash
# Get the OIDC issuer URL
OIDC_URL=$(aws eks describe-cluster \
    --name my-cluster \
    --query "cluster.identity.oidc.issuer" \
    --output text)

# Create the OIDC provider
aws iam create-open-id-connect-provider \
    --url $OIDC_URL \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list <thumbprint>
```

**Step 2: Create IAM role with trust policy**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-southeast-2.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.ap-southeast-2.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:sub": "system:serviceaccount:production:myapp-service-account",
          "oidc.eks.ap-southeast-2.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

```bash
aws iam create-role \
    --role-name MyAppS3Role \
    --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
    --role-name MyAppS3Role \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

**Step 3: Create annotated Kubernetes Service Account**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-service-account
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppS3Role
```

**Step 4: Use the Service Account in a Pod/Deployment**
```yaml
spec:
  serviceAccountName: myapp-service-account
  containers:
    - name: myapp
      image: myapp:v1.0.0
      # The AWS SDK automatically picks up the role from env vars injected by IRSA
```

### Using eksctl to simplify IRSA setup

```bash
eksctl create iamserviceaccount \
    --cluster my-cluster \
    --namespace production \
    --name myapp-service-account \
    --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
    --approve
```

This creates both the IAM role (with correct trust policy) and the annotated Kubernetes Service Account.

---

## 14. aws-auth ConfigMap

### What is the aws-auth ConfigMap?

The `aws-auth` ConfigMap in the `kube-system` namespace is the bridge between AWS IAM identities and Kubernetes RBAC. It maps IAM users and roles to Kubernetes usernames and groups.

When a user or role calls the EKS API, the authentication step verifies the AWS identity, then `aws-auth` maps that identity to a Kubernetes username/group, and then RBAC determines what that user can do.

### Default State

When you create an EKS cluster, only the IAM identity that created the cluster has access (as `system:masters`). Other users/roles need to be added to `aws-auth`.

### Viewing the aws-auth ConfigMap

```bash
kubectl get configmap aws-auth -n kube-system -o yaml
```

### Structure

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  # Node group IAM roles (REQUIRED for worker nodes to join cluster)
  mapRoles: |
    - rolearn: arn:aws:iam::123456789012:role/EKSNodeGroupRole
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
    - rolearn: arn:aws:iam::123456789012:role/TeamDevOpsRole
      username: devops-role
      groups:
        - system:masters       # Full admin access
    - rolearn: arn:aws:iam::123456789012:role/TeamDeveloperRole
      username: developer-role
      groups:
        - eks-developers        # Custom group with limited RBAC
  
  # Individual IAM user mappings (less common, roles are preferred)
  mapUsers: |
    - userarn: arn:aws:iam::123456789012:user/alice
      username: alice
      groups:
        - system:masters
```

### Granting Limited Access (RBAC + aws-auth)

Create a Kubernetes ClusterRole and ClusterRoleBinding for a developer group:

```yaml
# Only allows read access to pods and deployments
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: eks-developer-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: eks-developers-binding
subjects:
  - kind: Group
    name: eks-developers    # Matches the group in aws-auth
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: eks-developer-role
  apiGroup: rbac.authorization.k8s.io
```

### Important Note

If you accidentally break the `aws-auth` ConfigMap (e.g., delete it or corrupt it), you will lose access to the cluster. Recovery requires using the creator's IAM credentials. Use `eksctl` or tools like `eks-node-viewer` that help manage `aws-auth` safely.

---

## 15. EBS CSI Driver

The EBS CSI (Container Storage Interface) driver allows EKS pods to use Amazon EBS volumes as persistent storage.

### Installation

```bash
# Install as EKS add-on
aws eks create-addon \
    --cluster-name my-cluster \
    --addon-name aws-ebs-csi-driver \
    --service-account-role-arn arn:aws:iam::123456789012:role/EBSCSIRole \
    --region ap-southeast-2

# The EBS CSI controller needs IAM permissions
eksctl create iamserviceaccount \
    --cluster my-cluster \
    --namespace kube-system \
    --name ebs-csi-controller-sa \
    --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
    --approve
```

### Creating a StorageClass

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
  kmsKeyId: arn:aws:kms:ap-southeast-2:123456789012:key/abc123  # optional
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer   # Wait until pod is scheduled to know which AZ
allowVolumeExpansion: true
```

### Using EBS Storage in a StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: ebs-gp3
        resources:
          requests:
            storage: 50Gi
```

**Important EBS Limitation:** EBS volumes are AZ-specific (ReadWriteOnce). A pod using an EBS volume must be scheduled in the same AZ as the volume. This is why `WaitForFirstConsumer` volume binding mode is important — it waits to create the volume until the pod is scheduled, ensuring the volume is created in the correct AZ.

---

## 16. EFS CSI Driver

Amazon EFS (Elastic File System) provides shared storage that multiple pods can read and write simultaneously (ReadWriteMany). Unlike EBS, EFS is regional and accessible from any AZ.

### Installation

```bash
# Install EFS CSI driver via Helm
helm repo add aws-efs-csi-driver https://kubernetes-sigs.github.io/aws-efs-csi-driver/
helm repo update
helm install aws-efs-csi-driver aws-efs-csi-driver/aws-efs-csi-driver \
    --namespace kube-system \
    --set controller.serviceAccount.create=true \
    --set controller.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::123456789012:role/EFSCSIRole
```

### StorageClass for EFS Dynamic Provisioning

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-sc
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap           # Dynamic provisioning via Access Points
  fileSystemId: fs-abc123456         # Your EFS filesystem ID
  directoryPerms: "700"
  gidRangeStart: "1000"
  gidRangeEnd: "2000"
  basePath: "/dynamic_provisioning"
```

### EFS PVC for Shared Storage

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage
spec:
  accessModes:
    - ReadWriteMany      # Multiple pods can mount simultaneously
  storageClassName: efs-sc
  resources:
    requests:
      storage: 5Gi       # EFS doesn't enforce storage limits; this is just metadata
```

### EBS vs EFS Comparison

| Feature | EBS | EFS |
|---|---|---|
| Access mode | ReadWriteOnce | ReadWriteMany |
| Scope | AZ-specific | Regional (multi-AZ) |
| Protocol | Block storage | NFS (network file system) |
| Latency | Very low (sub-ms) | Higher (NFS over network) |
| Cost | Lower | Higher |
| Fargate support | No | Yes |
| Use cases | Databases, single-node workloads | Shared config, CMS, ML training data |

---

## 17. Cluster Autoscaler and Karpenter

### Cluster Autoscaler

The Kubernetes Cluster Autoscaler watches for pods that cannot be scheduled due to insufficient resources, and scales up the node group. It also scales down nodes that have been underutilized.

```bash
# Install Cluster Autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Annotate the deployment to target your cluster
kubectl annotate serviceaccount cluster-autoscaler \
    -n kube-system \
    eks.amazonaws.com/role-arn=arn:aws:iam::123456789012:role/ClusterAutoscalerRole

# Update the command arguments with your cluster name
kubectl edit deployment cluster-autoscaler -n kube-system
# Add: --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/my-cluster
```

**Cluster Autoscaler limitations:**
- Can only scale existing node groups
- Slow to respond (up to several minutes)
- Requires careful configuration with AWS Auto Scaling Groups

### Karpenter

Karpenter is a newer, more efficient node provisioner. Instead of scaling pre-defined node groups, Karpenter directly provisions EC2 instances of any type that best fit the pending pods.

**Advantages over Cluster Autoscaler:**
- Faster provisioning (30-60 seconds vs several minutes)
- Picks the optimal instance type for each workload
- Supports Spot instances with automatic fallback
- Consolidates workloads and terminates underutilized nodes
- More flexible — not tied to pre-configured node groups

```bash
# Install Karpenter
helm repo add karpenter https://charts.karpenter.sh/
helm repo update
helm install karpenter oci://public.ecr.aws/karpenter/karpenter \
    --version 0.37.0 \
    --namespace karpenter \
    --create-namespace \
    --set settings.clusterName=my-cluster \
    --set settings.interruptionQueue=my-cluster \
    --set controller.resources.requests.cpu=1 \
    --set controller.resources.requests.memory=1Gi
```

**Karpenter NodePool example:**
```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      nodeClassRef:
        apiVersion: karpenter.k8s.aws/v1beta1
        kind: EC2NodeClass
        name: default
      requirements:
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["2"]
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
  limits:
    cpu: 1000
    memory: 1000Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
```

---

## 18. Helm

Helm is the package manager for Kubernetes. It allows you to define, install, and upgrade complex Kubernetes applications using "charts" — pre-packaged collections of Kubernetes manifests with templating.

### Key Concepts

- **Chart:** A Helm package containing all resource definitions for a Kubernetes application
- **Release:** A running instance of a chart installed in a cluster
- **Repository:** Collection of charts (like npm registry for npm packages)
- **Values:** Configuration for a chart release (overrides chart defaults)

### Installation

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Essential Commands

```bash
# Add a chart repository
helm repo add stable https://charts.helm.sh/stable
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Search for charts
helm search repo nginx
helm search hub prometheus

# Install a chart
helm install my-nginx bitnami/nginx
helm install my-nginx bitnami/nginx --namespace production
helm install my-nginx bitnami/nginx --values custom-values.yaml
helm install my-nginx bitnami/nginx --set service.type=LoadBalancer --set replicaCount=3

# Upgrade a release
helm upgrade my-nginx bitnami/nginx --values custom-values.yaml

# Upgrade or install (install if not exists)
helm upgrade --install my-nginx bitnami/nginx --values custom-values.yaml

# List all releases
helm list
helm list --all-namespaces
helm list -n production

# View release status
helm status my-nginx

# View deployed values
helm get values my-nginx

# View all computed values (including defaults)
helm get values my-nginx --all

# Rollback to previous release version
helm rollback my-nginx 1

# Uninstall a release
helm uninstall my-nginx
helm uninstall my-nginx --keep-history  # keep history for rollback

# Download and inspect a chart before installing
helm pull bitnami/nginx --untar
```

### Creating a Helm Chart

```bash
helm create myapp
# Creates this structure:
# myapp/
#   Chart.yaml          # Chart metadata
#   values.yaml         # Default configuration values
#   charts/             # Dependencies
#   templates/          # Kubernetes manifest templates
#     deployment.yaml
#     service.yaml
#     ingress.yaml
#     _helpers.tpl      # Template helper functions
#     NOTES.txt         # Post-install notes
```

### values.yaml example

```yaml
replicaCount: 3

image:
  repository: 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp
  tag: v2.1.0
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: true
  className: alb
  host: api.mycompany.com
  certArn: arn:aws:acm:ap-southeast-2:123456789012:certificate/abc123

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

---

## 19. EKS Add-ons

EKS Add-ons are managed operational software components that AWS maintains, tests, and updates. They simplify cluster operations.

### Core Add-ons

| Add-on | Purpose |
|---|---|
| `vpc-cni` | Amazon VPC CNI plugin — gives pods VPC IP addresses |
| `coredns` | Cluster DNS resolution |
| `kube-proxy` | Network proxy on each node |
| `aws-ebs-csi-driver` | EBS persistent volume support |

### Installing/Managing Add-ons

```bash
# List available add-ons
aws eks describe-addon-versions --region ap-southeast-2

# List installed add-ons
aws eks list-addons --cluster-name my-cluster

# Install an add-on
aws eks create-addon \
    --cluster-name my-cluster \
    --addon-name aws-ebs-csi-driver \
    --addon-version v1.28.0-eksbuild.1 \
    --service-account-role-arn arn:aws:iam::123456789012:role/EBSCSIRole

# Update an add-on
aws eks update-addon \
    --cluster-name my-cluster \
    --addon-name aws-ebs-csi-driver \
    --addon-version v1.30.0-eksbuild.1 \
    --resolve-conflicts OVERWRITE

# Delete an add-on
aws eks delete-addon \
    --cluster-name my-cluster \
    --addon-name aws-ebs-csi-driver
```

---

## 20. Monitoring with CloudWatch Container Insights

Container Insights collects, aggregates, and summarizes metrics and logs from EKS clusters. It provides CPU, memory, disk, and network metrics per cluster, node, pod, and container.

### Installation

```bash
# Create namespace
kubectl create namespace amazon-cloudwatch

# Install CloudWatch agent using the quick-start
ClusterName=my-cluster
RegionName=ap-southeast-2
FluentBitHttpPort='2020'
FluentBitReadFromHead='Off'
[[ ${FluentBitReadFromHead} = 'On' ]] && FluentBitReadFromTail='Off' || FluentBitReadFromTail='On'
[[ -z ${FluentBitHttpPort} ]] && FluentBitHttpServer='Off' || FluentBitHttpServer='On'

curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml | \
sed 's/{{cluster_name}}/'${ClusterName}'/;s/{{region_name}}/'${RegionName}'/;s/{{http_server_toggle}}/"'${FluentBitHttpServer}'"/;s/{{http_server_port}}/"'${FluentBitHttpPort}'"/;s/{{read_from_head}}/"'${FluentBitReadFromHead}'"/;s/{{read_from_tail}}/"'${FluentBitReadFromTail}'"/' | \
kubectl apply -f -
```

### Node IAM Role Permissions Required

```bash
aws iam attach-role-policy \
    --role-name EKSNodeGroupRole \
    --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
```

### What Container Insights Provides

- **ClusterName/Namespace/PodName/ContainerName** dimensions on all metrics
- CPU utilization (cluster, node, pod, container)
- Memory utilization (cluster, node, pod, container)
- Network bytes in/out (cluster, pod, service)
- Disk I/O (node)
- Filesystem usage
- Number of running pods per node
- Container restart counts
- Pre-built CloudWatch dashboards

### Custom Metrics with CloudWatch Embedded Metric Format

```python
# Application code can emit custom metrics to CloudWatch using EMF
import boto3
import json

metric = {
    "_aws": {
        "Timestamp": 1704067200000,
        "CloudWatchMetrics": [
            {
                "Namespace": "MyApp",
                "Dimensions": [["Service", "Environment"]],
                "Metrics": [
                    {"Name": "OrdersProcessed", "Unit": "Count"}
                ]
            }
        ]
    },
    "Service": "order-service",
    "Environment": "production",
    "OrdersProcessed": 42
}
print(json.dumps(metric))  # CloudWatch agent picks this up from stdout
```

---

## 21. ECS vs EKS Decision Guide

### Choose ECS When

- Your team is small and doesn't want to learn Kubernetes
- You run simple containerized applications without complex networking requirements
- You want to minimize operational overhead
- You're fully committed to AWS and don't need cloud portability
- Your workloads fit well on Fargate and you want serverless containers
- Budget is constrained — ECS is free (you pay only for EC2/Fargate)
- You need quick time-to-market without learning K8s concepts

### Choose EKS When

- Your team has Kubernetes experience or is willing to invest in it
- You need portability across cloud providers or on-premises
- Your applications require advanced scheduling (GPU nodes, spot diversification, custom topologies)
- You have complex microservices requiring features like Istio service mesh, advanced ingress routing, or Helm-managed deployments
- Your organization is adopting a multi-cloud or hybrid-cloud strategy
- You have a large engineering team that can manage K8s complexity
- You need advanced RBAC with fine-grained access control per namespace
- The open-source K8s ecosystem tools your team uses run on Kubernetes

### Feature Comparison

| Feature | ECS | EKS |
|---|---|---|
| Learning curve | Low | High |
| Operational complexity | Low | High |
| Control plane cost | Free | $0.10/hour ($73/month) |
| AWS integration | Native | Requires configuration |
| Multi-cloud portability | No | Yes (Kubernetes is cloud-agnostic) |
| Service mesh | AWS App Mesh | Istio, Linkerd, App Mesh |
| Ecosystem | AWS-centric | Rich open-source (CNCF) |
| Scheduling | Task definitions | Full K8s scheduler |
| Fargate | Yes, native | Yes, but more complex |
| Windows containers | Yes | Yes (self-managed only) |
| Custom networking | Limited | Full control (CNI plugins) |

### Summary Rule of Thumb

- **Startup / Small team / AWS-only:** Use ECS
- **Enterprise / Large team / Multi-cloud / Kubernetes expertise:** Use EKS
- **Serverless containers / simple workloads:** ECS Fargate
- **Complex microservices / need K8s ecosystem:** EKS

---

## 22. Interview Q&A

**Q1: What is the difference between ECS and EKS? How do you decide which to use?**

A: ECS is AWS's proprietary container orchestration service with no control plane cost and simpler setup, but limited to AWS and fewer ecosystem tools. EKS is managed Kubernetes — more complex, costs $73/month for the control plane, but gives you Kubernetes portability, the CNCF ecosystem, and advanced features. Choose ECS for simpler AWS-only workloads, choose EKS when you need Kubernetes features, multi-cloud portability, or Kubernetes expertise in the team. ECS Fargate is excellent for teams wanting serverless containers without K8s complexity.

---

**Q2: Explain the Kubernetes control plane components and their roles.**

A: The control plane has four main components: (1) API Server — the central hub for all communication; every kubectl command and internal component interaction goes through it. (2) etcd — the distributed key-value store holding all cluster state; the single source of truth. (3) Scheduler — watches for unscheduled pods and assigns them to nodes based on resources, affinity rules, and taints/tolerations. (4) Controller Manager — runs controllers that reconcile actual state with desired state, including the ReplicaSet controller, Deployment controller, and Node controller. In EKS, AWS manages all these components.

---

**Q3: What is IRSA and why is it important?**

A: IRSA (IAM Roles for Service Accounts) provides pod-level IAM permissions in EKS. Before IRSA, all pods on a node shared the node's IAM role, which violates least-privilege. IRSA links a Kubernetes Service Account to an IAM role via the cluster's OIDC provider. When a pod uses that Service Account, the AWS SDK automatically assumes the IAM role via STS. This means each pod (or group of pods using the same Service Account) can have precisely the AWS permissions it needs, with no over-provisioning.

---

**Q4: What is the difference between a Deployment and a StatefulSet?**

A: Deployments are for stateless applications — pods are interchangeable, get random names, and can be scheduled on any node. StatefulSets are for stateful applications — pods get stable, ordered names (pod-0, pod-1), persistent storage that follows each pod through rescheduling, and ordered startup/shutdown. StatefulSets are used for databases, message queues, and anything that needs persistent identity. The `volumeClaimTemplates` in StatefulSets creates a separate PVC for each pod replica.

---

**Q5: Explain the pod networking model in EKS.**

A: EKS uses the Amazon VPC CNI plugin. Every pod gets a real VPC IP address (directly from your subnet's CIDR range, not a virtual overlay network). This means pods can communicate directly with other AWS services and vice versa using their VPC IPs without NAT. Each EC2 node has multiple network interfaces, and secondary IPs on those interfaces are allocated to pods. The number of pods per node is limited by the number of IPs the instance type supports. This model simplifies networking but means you need sufficient IP space in your VPC.

---

**Q6: What happens when a pod cannot be scheduled?**

A: The pod enters `Pending` state. The Scheduler continuously tries to assign it to a node. Common reasons for scheduling failures include: insufficient CPU/memory on all nodes (check with `kubectl describe pod`), node selectors or affinity rules that no node satisfies, taints on all nodes without matching tolerations, or Persistent Volume claims in the wrong AZ. The Cluster Autoscaler (or Karpenter) monitors pending pods and scales up nodes. You can diagnose by running `kubectl describe pod <pod-name>` and looking at the Events section at the bottom.

---

**Q7: How do you perform a zero-downtime rolling update in Kubernetes?**

A: Use a Deployment with `strategy.type: RollingUpdate`. Set `maxSurge: 1` (allow one extra pod during rollout) and `maxUnavailable: 0` (never reduce below desired replicas). Configure readiness probes on the container — Kubernetes only routes traffic to pods that pass readiness checks and marks old pods for termination only after new pods are ready. Update the image with `kubectl set image` or update the YAML and `kubectl apply`. The Deployment controller creates new pods, waits for them to be ready, then terminates old pods one by one. To monitor: `kubectl rollout status deployment/myapp`.

---

**Q8: What is the aws-auth ConfigMap and why is it critical?**

A: The `aws-auth` ConfigMap in `kube-system` namespace maps AWS IAM roles and users to Kubernetes usernames and RBAC groups. It's the bridge between AWS identity and Kubernetes authorization. It must include entries for the node group IAM roles (so worker nodes can join the cluster) and for any IAM roles/users that need cluster access. If it's misconfigured or deleted, all access to the cluster (except the creator's IAM identity) is lost. Changes to it should be made carefully, ideally via tools like eksctl or the EKS access entry API (a newer alternative to aws-auth that allows IAM-native access management).

---

**Q9: Explain the difference between ClusterIP, NodePort, and LoadBalancer services.**

A: ClusterIP creates an internal-only virtual IP reachable only within the cluster — for microservice-to-microservice communication. NodePort exposes the service on every node's IP at a static port (30000-32767) — accessible from outside the cluster via any node's IP, but not recommended for production as node IPs change. LoadBalancer creates an external AWS load balancer (ELB/NLB) with a stable external DNS name — suitable for internet-facing services, but creates one load balancer per service (expensive). Ingress is generally preferred over LoadBalancer for HTTP/HTTPS services as it can route many services through a single ALB.

---

**Q10: What is a DaemonSet and when would you use it?**

A: A DaemonSet ensures exactly one pod runs on every node (or every node matching a selector). When a new node joins the cluster, the DaemonSet automatically schedules a pod on it. When a node is removed, the pod is garbage collected. Use cases: log collectors (Fluentd, CloudWatch Agent), monitoring agents (Datadog, Prometheus node exporter), network plugins (CNI plugin, kube-proxy itself runs as a DaemonSet), and security agents. You would not use DaemonSets for application workloads — they're for infrastructure-level per-node agents.

---

**Q11: What is Helm and why is it used?**

A: Helm is the Kubernetes package manager. It bundles Kubernetes manifests into reusable "charts" with templating (Go templates). Instead of maintaining multiple YAML files per environment with slight differences, you define a chart once with configurable values and deploy different releases with different `values.yaml` files. Helm manages release history (for rollbacks), dependencies between charts, and simplifies deploying complex applications like Prometheus, Nginx, or your own app across environments. `helm upgrade --install` is idempotent — it installs on first run and upgrades on subsequent runs.

---

**Q12: How does Kubernetes handle node failures?**

A: When a node fails, the Node Controller (part of Controller Manager) detects the failure when the node stops sending heartbeats. After a configurable timeout (default 5 minutes with `--node-monitor-grace-period`), the node is marked `NotReady`. After another timeout (`--pod-eviction-timeout`), pods on the failed node are marked for eviction. The ReplicaSet controller then creates replacement pods on healthy nodes. The entire process can take 5-10+ minutes by default. This timeout exists to avoid false positives (brief network issues). Cluster operators can tune these timeouts for faster recovery in production.

---

**Q13: What is a ConfigMap vs a Secret, and what are the security considerations for Secrets?**

A: ConfigMap stores non-sensitive configuration data (strings, config files). Secrets store sensitive data (passwords, tokens, TLS certs). Both are stored in etcd. The key security difference: Secrets values are base64-encoded (NOT encrypted) by default in etcd — base64 is encoding, not encryption. Anyone with etcd access can read them. Best practices for Secrets: (1) Enable envelope encryption for etcd using KMS (`--encryption-provider-config`). (2) Use AWS Secrets Manager or Parameter Store with the External Secrets Operator instead of Kubernetes Secrets for highly sensitive values. (3) Restrict access with RBAC. (4) Avoid mounting secrets as env vars when possible — files are slightly safer as they're not exposed in process listings.

---

**Q14: What is a Namespace in Kubernetes and how does it affect RBAC?**

A: Namespaces are virtual partitions within a cluster that provide resource isolation, naming scope, and access control boundaries. Resources in different namespaces are isolated: a Service in namespace A cannot be referenced by its short name from namespace B (it must use the full `service.namespace.svc.cluster.local` DNS name). RBAC in Kubernetes is namespace-scoped: `Role` and `RoleBinding` apply within a namespace, while `ClusterRole` and `ClusterRoleBinding` apply cluster-wide. This allows granting team-A admin access only to their namespace without affecting other teams' namespaces.

---

**Q15: What is Karpenter and how does it differ from the Cluster Autoscaler?**

A: The Cluster Autoscaler works by scaling pre-configured node groups (AWS Auto Scaling Groups). When pods are pending, it increments the desired count on an ASG. It's limited to the instance types and configurations defined in the ASG. Karpenter works differently — it reads the requirements of pending pods (CPU, memory, GPU, Spot vs On-Demand, architecture) and directly provisions the optimal EC2 instance type via the EC2 fleet API, bypassing Auto Scaling Groups entirely. Karpenter is faster (30-60 seconds vs Cluster Autoscaler's several minutes), picks the cheapest or most appropriate instance for each batch of pods, and supports node consolidation — it terminates underutilized nodes and reschedules pods to reduce waste. For new EKS clusters, Karpenter is generally preferred over Cluster Autoscaler.

---

*End of EKS Complete Guide*
