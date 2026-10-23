# What is Kubernetes — Complete Guide

## Table of Contents
1. [The Problem Kubernetes Solves](#1-the-problem-kubernetes-solves)
2. [What is Kubernetes?](#2-what-is-kubernetes)
3. [The Cluster Model](#3-the-cluster-model)
4. [Key Kubernetes Objects](#4-key-kubernetes-objects)
5. [Kubernetes vs Plain Docker](#5-kubernetes-vs-plain-docker)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Kubernetes Solves

### Running Containers at Scale

Docker solves the packaging problem — one container runs identically everywhere. But what happens when you need to run hundreds of containers across dozens of machines in production?

```
Single container with Docker (easy):
  docker run -d -p 80:80 myapp:1.0
  → Works great. One container, one host.

100 containers across 10 servers (hard without K8s):
  - Which server has enough CPU and RAM right now?
  - What happens when server 3 crashes at 2 AM?
  - How do you roll out a new version with zero downtime?
  - How do containers on different servers talk to each other?
  - How do you scale up when traffic spikes at midnight?
  - How do you scale back down to save money at 3 AM?
```

### The Operations Nightmare Without Kubernetes

```
Without Kubernetes:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Server 1   │    │   Server 2   │    │   Server 3   │
│              │    │              │    │  (CRASHED)   │
│  container A │    │  container C │    │  container E │ ← lost!
│  container B │    │  container D │    │              │
│              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
  Manual SSH          Manual SSH          PagerDuty at 3 AM
  to check            to check            "where did E go?"
```

### What Kubernetes Provides

```
┌────────────────────────────────────────────────────────────────┐
│ Kubernetes Handles:                                            │
│                                                                │
│  ✓ Scheduling      → place containers on the right node       │
│  ✓ Self-healing    → restart failed containers automatically   │
│  ✓ Scaling         → add/remove replicas based on load        │
│  ✓ Rolling updates → deploy new versions with zero downtime   │
│  ✓ Service discovery → containers find each other by name     │
│  ✓ Load balancing  → spread traffic across healthy replicas   │
│  ✓ Storage         → attach persistent storage to containers  │
│  ✓ Config/secrets  → inject config without rebuilding images  │
└────────────────────────────────────────────────────────────────┘
```

Kubernetes is the **operating system for your cluster** — it manages compute, networking, and storage across many machines so you don't have to.

---

## 2. What is Kubernetes?

Kubernetes (K8s — "K" + 8 letters + "s") is an open-source **container orchestration platform** originally created by Google in 2014, now maintained by the Cloud Native Computing Foundation (CNCF).

### Origins

Google ran containers internally for over a decade using a system called **Borg**. Kubernetes is the open-source evolution of those learnings, designed to let anyone run container workloads at Google scale.

```
Timeline:
  2003  → Google builds Borg (internal cluster manager)
  2013  → Docker released, containerization goes mainstream
  2014  → Google open-sources Kubernetes (inspired by Borg)
  2016  → CNCF takes stewardship of Kubernetes
  2018  → Kubernetes 1.0+ becomes the industry standard
  Today → 5.6M+ developers use K8s (CNCF survey 2023)
```

### What Kubernetes Actually Is

```
Kubernetes is a declarative system:

You declare:    "I want 3 replicas of myapp:2.0, always running"
K8s ensures:    3 replicas are running at all times
                → if one crashes, K8s starts a new one
                → if a node fails, K8s reschedules onto other nodes
                → if load spikes, K8s can scale to 10 replicas
                → you just describe the desired state; K8s reconciles
```

### Declarative vs Imperative

```
Imperative (Docker / scripting):
  docker run myapp        # you tell it WHAT TO DO step by step
  docker stop myapp_v1
  docker run myapp_v2

Declarative (Kubernetes):
  # You write a YAML describing WHAT YOU WANT
  apiVersion: apps/v1
  kind: Deployment
  spec:
    replicas: 3
    image: myapp:v2
  # K8s figures out HOW to get there
```

---

## 3. The Cluster Model

A Kubernetes **cluster** is a set of machines (nodes) that run your containerised workloads. Every cluster has two types of nodes.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      Control Plane Node                        │  │
│  │  (brain of the cluster — makes all scheduling decisions)       │  │
│  │                                                                │  │
│  │  kube-apiserver  │  etcd  │  kube-scheduler  │  controllers   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│              ┌───────────────┼───────────────┐                       │
│              │               │               │                       │
│  ┌───────────▼──┐  ┌─────────▼────┐  ┌──────▼───────┐              │
│  │  Worker Node 1│  │ Worker Node 2│  │ Worker Node 3│              │
│  │  (runs pods) │  │  (runs pods) │  │  (runs pods) │              │
│  │              │  │              │  │              │              │
│  │  [Pod][Pod]  │  │  [Pod][Pod]  │  │  [Pod][Pod]  │              │
│  │  kubelet     │  │  kubelet     │  │  kubelet     │              │
│  │  kube-proxy  │  │  kube-proxy  │  │  kube-proxy  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

### Nodes

| Node Type | Role |
|-----------|------|
| **Control Plane** | Runs the Kubernetes management processes; makes scheduling decisions; stores cluster state |
| **Worker Node** | Runs your application containers (Pods); managed by the control plane |

In production you run multiple control plane nodes for high availability. Worker nodes can be physical machines, VMs, or cloud instances.

---

## 4. Key Kubernetes Objects

Kubernetes manages your workloads through **objects** — records in the cluster's database that describe what you want running. The most important ones:

### Pod

The smallest deployable unit in Kubernetes. A Pod wraps one or more containers that share a network namespace and storage.

```
┌──────────────────────────────────────┐
│              Pod                     │
│                                      │
│  ┌────────────┐   ┌──────────────┐   │
│  │  Container │   │  Container   │   │
│  │  (main)    │   │  (sidecar)   │   │
│  └────────────┘   └──────────────┘   │
│                                      │
│  Shared: IP address, localhost,      │
│          volumes                     │
└──────────────────────────────────────┘

Pod has one IP address. Containers inside communicate via localhost.
```

```yaml
# Minimal Pod manifest
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
```

### Deployment

Manages a set of identical Pods. Handles rolling updates, rollbacks, and scaling.

```
Deployment (desired: 3 replicas of myapp:2.0)
    │
    ├── ReplicaSet
    │       ├── Pod (myapp:2.0)
    │       ├── Pod (myapp:2.0)
    │       └── Pod (myapp:2.0)
    │
    └── If a Pod dies → ReplicaSet creates a new one automatically
```

```yaml
# Deployment manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:2.0
        ports:
        - containerPort: 8080
```

### Service

Provides a stable network endpoint to reach a set of Pods. Pods come and go; the Service IP stays the same.

```
Clients
   │
   ▼
Service (ClusterIP: 10.96.45.12, Port: 80)
   │
   ├──▶ Pod A (10.244.1.5)
   ├──▶ Pod B (10.244.2.7)   ← load balanced
   └──▶ Pod C (10.244.3.2)

Even if Pod A is replaced, the Service still works —
it selects Pods by label, not by IP.
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  selector:
    app: myapp       # targets all Pods with label app=myapp
  ports:
  - port: 80
    targetPort: 8080
```

### Other Core Objects at a Glance

| Object | Purpose |
|--------|---------|
| **Namespace** | Virtual cluster within a cluster; isolates resources |
| **ConfigMap** | Store non-secret configuration as key-value pairs |
| **Secret** | Store sensitive config (passwords, tokens) — base64 encoded |
| **PersistentVolume** | Cluster-level storage resource |
| **Ingress** | HTTP/HTTPS routing to Services; replaces many LoadBalancers |
| **StatefulSet** | Like Deployment but for stateful apps (databases) with stable identities |
| **DaemonSet** | Run one Pod per node (logging agents, monitoring) |
| **Job / CronJob** | Run tasks to completion; run on a schedule |

---

## 5. Kubernetes vs Plain Docker

```
Plain Docker (single host):                 Kubernetes (cluster):

docker run myapp                            kubectl apply -f deployment.yaml
→ runs on THIS machine only                 → runs across any node with capacity

If machine crashes → app gone              If node crashes → K8s reschedules Pods
                                           to healthy nodes automatically

Scale manually:                             Scale declaratively:
  docker run myapp (again, again...)          kubectl scale deploy myapp --replicas=10

No built-in service discovery               DNS-based service discovery built in:
  containers must know each other's IP        myapp-svc.default.svc.cluster.local

Port conflicts (host ports)                 No host port conflicts — Pod network is
                                           cluster-wide, each Pod gets unique IP

Updates require manual coordination         Rolling updates built in:
                                           zero-downtime by default

One file: docker-compose.yaml               Many YAML manifests, but:
  simple to understand                        kubectl apply -f ./k8s/
  limited to one host                         runs across entire cluster
```

### When to use plain Docker / Docker Compose

- Local development environments
- Single-server deployments (small projects, hobby apps)
- CI build pipelines (build, test, push)
- Simpler teams without dedicated platform engineers

### When Kubernetes makes sense

- Multiple services that need to scale independently
- High availability requirements (multi-node, multi-zone)
- Hundreds or thousands of containers
- Teams with dedicated platform / DevOps engineers
- Cloud-native applications in production

---

## 6. Hands-On Exercises

**Exercise 1:** Install minikube and start a local cluster. Run `kubectl cluster-info` and `kubectl get nodes`. Identify which node is the control plane.

**Exercise 2:** Create your first Pod with `kubectl run nginx --image=nginx:1.25`. Run `kubectl get pods` and `kubectl describe pod nginx`. Note the Node it was scheduled to, and the container image.

**Exercise 3:** Expose the nginx Pod with `kubectl expose pod nginx --port=80 --type=NodePort`. Run `minikube service nginx --url` to get the URL and open it in a browser.

**Exercise 4:** Create a Deployment: `kubectl create deployment myapp --image=nginx:1.25 --replicas=3`. Run `kubectl get pods` and observe 3 pods. Delete one pod manually and watch Kubernetes recreate it: `kubectl delete pod <name>`.

**Exercise 5:** Write a Deployment manifest YAML for a simple app (use `nginx:1.25` image, 2 replicas). Apply it with `kubectl apply -f deployment.yaml`. Update the replicas to 4, apply again, and observe the change with `kubectl get pods -w`.

---

## 7. Interview Q&A

**Q: What is Kubernetes and why was it created?**
Answer: Kubernetes is an open-source container orchestration platform created by Google in 2014, open-sourced from Google's internal Borg system. It was created to solve the challenge of running containers at scale across many machines — handling scheduling, self-healing, scaling, rolling updates, service discovery, and load balancing automatically. It became the CNCF-hosted standard for container orchestration.

**Q: What is the difference between a Pod and a container?**
Answer: A container is a single isolated process with its own filesystem (Docker or OCI container). A Pod is the smallest Kubernetes unit and wraps one or more containers that share a network namespace (same IP address, can communicate via localhost) and can share storage volumes. In practice most Pods run a single main container, with optional sidecar containers for logging or proxying.

**Q: What does "declarative" mean in Kubernetes?**
Answer: Declarative means you describe the desired state (e.g., "3 replicas of myapp:2.0 should always be running") and Kubernetes continuously works to reconcile actual state to match your declaration. You don't issue step-by-step commands. If a Pod crashes, Kubernetes detects the drift and creates a new Pod. This is the control loop / reconciliation pattern central to how K8s works.

**Q: What is the role of the Control Plane?**
Answer: The Control Plane is the brain of the Kubernetes cluster. It runs the API Server (all kubectl commands and internal communication go through it), etcd (the cluster state database), the Scheduler (assigns Pods to nodes), and the Controller Manager (runs controllers that reconcile desired vs actual state). In production the control plane runs on dedicated nodes, separate from worker nodes.

**Q: What is a Kubernetes Service and why is it needed?**
Answer: A Service provides a stable IP address and DNS name that routes traffic to a set of Pods matching a label selector. Pods are ephemeral — they get new IPs when recreated. Without a Service, clients would need to track changing Pod IPs. A Service decouples clients from individual Pods and provides built-in load balancing across all matching Pod replicas.
