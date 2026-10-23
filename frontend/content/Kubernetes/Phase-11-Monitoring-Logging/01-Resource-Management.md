# Resource Management — Complete Guide

## Table of Contents
1. [Why Resource Management Matters](#1-why-resource-management-matters)
2. [Resource Requests vs Limits](#2-resource-requests-vs-limits)
3. [CPU Throttling vs Memory OOM](#3-cpu-throttling-vs-memory-oom)
4. [QoS Classes](#4-qos-classes)
5. [LimitRange — Namespace Defaults](#5-limitrange--namespace-defaults)
6. [ResourceQuota — Namespace Limits](#6-resourcequota--namespace-limits)
7. [Inspecting Usage with kubectl top](#7-inspecting-usage-with-kubectl-top)
8. [Troubleshooting OOMKilled and Evicted Pods](#8-troubleshooting-oomkilled-and-evicted-pods)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Resource Management Matters

### The Noisy-Neighbour Problem

A Kubernetes node is a shared machine. Multiple pods run on the same node and compete for the same pool of CPU and memory. Without resource management, a single misbehaving pod can consume all available node resources and cause every other pod on that node to starve — the classic noisy-neighbour problem.

```
Without resource limits (dangerous):

┌─────────────────────────────────────────────────────────┐
│                  Worker Node (8 CPU / 16 Gi RAM)        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  pod/runaway-app                                 │   │
│  │  CPU used: 7.8 cores  ← consuming nearly all!   │   │
│  │  RAM used: 14 Gi      ← consuming nearly all!   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ pod/api-server │  │ pod/database   │                 │
│  │ CPU: starved   │  │ CPU: starved   │  ← suffering!  │
│  │ RAM: starved   │  │ RAM: OOMKilled │                 │
│  └────────────────┘  └────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

```
With resource limits (safe):

┌─────────────────────────────────────────────────────────┐
│                  Worker Node (8 CPU / 16 Gi RAM)        │
│                                                         │
│  ┌──────────────────────┐  ┌────────────────────────┐   │
│  │  pod/runaway-app     │  │  pod/api-server        │   │
│  │  CPU limit: 2 cores  │  │  CPU limit: 2 cores    │   │
│  │  RAM limit: 4 Gi     │  │  RAM limit: 4 Gi       │   │
│  │  (throttled at cap)  │  │  (guaranteed headroom) │   │
│  └──────────────────────┘  └────────────────────────┘   │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  pod/database                                  │     │
│  │  CPU limit: 3 cores  │  RAM limit: 6 Gi        │     │
│  │  (predictable, isolated behaviour)             │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### How the Scheduler Uses Resource Requests

The Kubernetes scheduler uses **resource requests** — not limits — to decide which node a pod should be placed on. This is one of the most important concepts to internalise.

```
Scheduling decision flow:

New Pod created (requests: 500m CPU, 512Mi RAM)
                │
                ▼
     Scheduler inspects all nodes:
                │
     ┌──────────┼──────────────────┐
     │          │                  │
     ▼          ▼                  ▼
  Node A      Node B            Node C
  8 CPU       8 CPU             8 CPU
  16 Gi RAM   16 Gi RAM         16 Gi RAM
              Already allocated: Already allocated:
              7.8 CPU           3 CPU
              15 Gi RAM         8 Gi RAM
              → NOT enough      → has capacity
              → filtered out    → eligible

     Scheduler selects Node A or Node C
     based on available allocatable resources
```

The scheduler sums up the requests of all pods already scheduled on a node. If adding the new pod's requests would exceed the node's allocatable capacity, that node is filtered out. **The scheduler never looks at actual live usage — only declared requests.** This means a node could be lightly utilised but still appear "full" if pods have high requests, or heavily utilised but still accept pods if requests are too low. Setting accurate requests is therefore critical for good bin-packing and cluster efficiency.

---

## 2. Resource Requests vs Limits

### The Core Distinction

| Concept | What It Means | Effect |
|---------|--------------|--------|
| **Request** | The minimum the container is guaranteed | Used by the scheduler for placement; reserved on the node |
| **Limit** | The maximum the container is allowed to use | Enforced at runtime by the Linux kernel cgroup subsystem |

Think of it this way: requests are a **promise to the scheduler**, and limits are a **ceiling enforced by the kernel**.

### A Complete Pod YAML with Resources

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

### Understanding CPU Units — Millicores

CPU resources are expressed in **millicores** (also written as millicpu or m).

```
CPU unit conversions:

  1000m  = 1 CPU core (1 vCPU on a cloud instance, 1 hyperthread)
   500m  = 0.5 CPU (half a core)
   250m  = 0.25 CPU (quarter of a core)
   100m  = 0.1 CPU (one tenth of a core)

Practical examples:
  A lightweight sidecar container:  cpu: "50m"
  A typical web API:                cpu: "250m"
  A CPU-intensive data processor:   cpu: "2000m"  (or simply cpu: "2")

You can use fractional notation or millicore notation:
  cpu: "0.5"   is exactly the same as   cpu: "500m"
  cpu: "2"     is exactly the same as   cpu: "2000m"
```

Millicores exist because a single CPU core can be time-shared at fine granularity. A container requesting 100m gets 10% of one core's time across any scheduling period. On a 4-core node, 40 pods each requesting 100m can be accommodated in theory (4000m total), though real scheduling also accounts for other resources.

### Understanding Memory Units — MiB vs MB

Memory is expressed in either binary (IEC) or decimal units, and the distinction matters:

```
Memory unit reference:

  Decimal (SI):           Binary (IEC):
  1 KB  = 1,000 bytes     1 Ki  = 1,024 bytes
  1 MB  = 1,000,000 bytes 1 Mi  = 1,048,576 bytes
  1 GB  = 1,000,000,000   1 Gi  = 1,073,741,824 bytes

Kubernetes accepts both:
  "128M"   → 128 megabytes  (decimal — 134,217,728 bytes)
  "128Mi"  → 128 mebibytes  (binary  — 134,217,728 bytes)  ← more precise
  "1G"     → 1 gigabyte     (decimal)
  "1Gi"    → 1 gibibyte     (binary) ← preferred in K8s YAML

Best practice: always use Mi and Gi in Kubernetes manifests to avoid
ambiguity — the binary units map directly to how the OS manages memory.
```

### What Happens Without Requests or Limits

```
No requests declared:
  → Pod scheduled anywhere (scheduler assumes 0 resource need)
  → Pod gets the lowest QoS class (BestEffort)
  → First to be evicted under memory pressure
  → No guaranteed CPU or memory

No limits declared:
  → Pod can consume unlimited CPU and memory
  → A bug causing a memory leak will consume the entire node
  → Other pods on the node will be starved or OOMKilled
  → This is the noisy-neighbour problem
```

Always declare both requests and limits for every container in production.

---

## 3. CPU Throttling vs Memory OOM

CPU and memory behave very differently when a container approaches or exceeds its limit. Understanding this distinction is essential for diagnosing performance issues.

### CPU is Compressible

CPU is considered a **compressible resource**. When a container tries to use more CPU than its limit, the Linux kernel's Completely Fair Scheduler (CFS) throttles the container — it slows it down but does not kill it.

```
CPU behaviour at each threshold:

CPU:    request=250m  limit=500m
        │
        ├── below 250m:  guaranteed scheduling
        │                The scheduler reserved this capacity on the node.
        │                The container will always get at least 250m.
        │
        ├── 250m-500m:   allowed if node has spare capacity
        │                The container can burst above its request
        │                when other pods are not using their allocated CPU.
        │                This is opportunistic usage.
        │
        └── above 500m:  THROTTLED (slowed, not killed)
                         The CFS throttling kicks in. The container's CPU
                         access is rate-limited. It continues running but
                         slower. No restart, no eviction — just degraded
                         throughput. Latency increases; queues build up.
```

CPU throttling is often invisible unless you are measuring latency or checking Prometheus metrics. A container can be throttled 80% of the time and still appear "Running" with no obvious signs of trouble. This is why monitoring CPU throttle percentage (via `container_cpu_cfs_throttled_seconds_total`) is important.

### Memory is Incompressible

Memory is an **incompressible resource**. When a container exceeds its memory limit, the kernel's Out-Of-Memory (OOM) killer terminates the container immediately.

```
Memory behaviour at each threshold:

Memory: request=128Mi  limit=256Mi
        │
        ├── below 128Mi:  guaranteed
        │                 The scheduler reserved this on the node.
        │                 The container is guaranteed to receive
        │                 at least 128Mi of physical RAM.
        │
        ├── 128Mi-256Mi:  allowed if node has spare memory
        │                 The container can use more than its request
        │                 when the node has available memory.
        │                 This is opportunistic memory usage.
        │
        └── above 256Mi:  OOMKILLED (container terminated immediately)
                          The Linux kernel's OOM killer sends SIGKILL
                          to the container process. The container exits
                          with status 137 (128 + SIGKILL signal 9).
                          Kubernetes restarts the container automatically
                          (following the pod's restartPolicy).
```

### Side-by-Side Comparison

```
┌─────────────────────────────┬──────────────────────────────────────┐
│         CPU (compressible)  │        Memory (incompressible)       │
├─────────────────────────────┼──────────────────────────────────────┤
│ Exceeds limit → throttled   │ Exceeds limit → OOMKilled            │
│ Container keeps running     │ Container process terminated         │
│ Slowed, not stopped         │ Stopped immediately (SIGKILL)        │
│ Exit code: none (no exit)   │ Exit code: 137                       │
│ Symptom: high latency       │ Symptom: CrashLoopBackOff            │
│ Kernel mechanism: CFS       │ Kernel mechanism: OOM killer         │
│ Recoverable automatically   │ Kubernetes restarts the container    │
│ Often silent / hard to see  │ Clearly visible in pod events        │
└─────────────────────────────┴──────────────────────────────────────┘
```

### Why Containers Get OOMKilled

The most common causes of OOMKilled in production:

```
1. Memory leak in application code
   → RSS grows over time until it hits the limit
   → Fix: find and patch the leak; increase limit as temporary measure

2. Limit set too low for actual workload
   → Application needs 300Mi but limit is 256Mi
   → Fix: profile memory usage with kubectl top and adjust limit

3. Sudden traffic spike causing large heap allocation
   → JVM heap, Python objects, or buffer pools grow under load
   → Fix: set limit with enough headroom for peak usage

4. Misconfigured JVM heap (Java applications)
   → JVM -Xmx set to 512m but container limit is 512Mi
   → JVM heap + JVM overhead (metaspace, native threads) > 512Mi
   → Fix: set JVM heap to 75-80% of container memory limit
```

---

## 4. QoS Classes

Kubernetes assigns every pod to one of three **Quality of Service (QoS) classes** based on how its resource requests and limits are configured. These classes determine the eviction order under node memory pressure.

### The Three QoS Classes

#### Guaranteed

The highest priority class. A pod is Guaranteed when **every container** in the pod has both CPU and memory requests **equal to** their limits.

```yaml
# QoS: Guaranteed
# requests == limits for every container
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        memory: "256Mi"
        cpu: "500m"
      limits:
        memory: "256Mi"   # exactly equal to request
        cpu: "500m"       # exactly equal to request
```

```
Guaranteed pods:
  → Last to be evicted under memory pressure
  → Kernel will OOMKill other processes first
  → Predictable, consistent performance
  → Use for: critical services (databases, core APIs)
```

#### Burstable

The middle priority class. A pod is Burstable when at least one container has requests set, but requests are not equal to limits (or some containers lack limits entirely).

```yaml
# QoS: Burstable
# requests < limits (can burst above the request)
apiVersion: v1
kind: Pod
metadata:
  name: burstable-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"   # limit higher than request
        cpu: "1000m"      # limit higher than request
```

```
Burstable pods:
  → Evicted after BestEffort pods but before Guaranteed pods
  → Can use more than their request when resources are available
  → Eviction order within Burstable: pods using the most above
    their request are evicted first
  → Use for: most production workloads with variable resource needs
```

#### BestEffort

The lowest priority class. A pod is BestEffort when **no container** has any resource requests or limits specified.

```yaml
# QoS: BestEffort
# no requests and no limits at all
apiVersion: v1
kind: Pod
metadata:
  name: besteffort-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    # no resources field at all
```

```
BestEffort pods:
  → First to be evicted when the node is under memory pressure
  → No guaranteed CPU or memory whatsoever
  → Scheduled on any node (requests assumed to be zero)
  → Use for: non-critical batch jobs or dev/test workloads only
  → Never use BestEffort for production services
```

### Eviction Order Under Memory Pressure

```
Node memory pressure builds:

  Available memory drops below threshold
                │
                ▼
  Kubelet begins eviction process:

  1st evicted: BestEffort pods
               (no requests declared — lowest priority)
                │
                ▼
  2nd evicted: Burstable pods
               (using the most memory above their request)
                │
                ▼
  Last evicted: Guaranteed pods
               (only evicted as last resort before node crash)
```

### Checking the QoS Class of a Pod

```bash
# Check the QoS class of a running pod
kubectl get pod <name> -o jsonpath='{.status.qosClass}'

# Example output:
# Guaranteed
# Burstable
# BestEffort

# Check QoS class for all pods in a namespace
kubectl get pods -o custom-columns=\
"NAME:.metadata.name,QOS:.status.qosClass"

# Example output:
# NAME                    QOS
# api-server-7d9f4        Burstable
# postgres-0              Guaranteed
# batch-job-xk2p9         BestEffort
```

### QoS Class Summary

```
┌──────────────┬───────────────────────────────────┬──────────────────┐
│  QoS Class   │  Condition                        │  Eviction Order  │
├──────────────┼───────────────────────────────────┼──────────────────┤
│ Guaranteed   │ All containers: requests == limits │ Last (safest)    │
│ Burstable    │ Some containers: requests < limits │ Middle           │
│ BestEffort   │ No containers have requests/limits │ First (riskiest) │
└──────────────┴───────────────────────────────────┴──────────────────┘
```

---

## 5. LimitRange — Namespace Defaults

### The Problem LimitRange Solves

In a team environment, developers may forget to set resource requests and limits on their pods. Without guidance, pods land in BestEffort class and can cause noisy-neighbour problems. LimitRange solves this by automatically injecting default requests and limits into pods that don't specify them, and by enforcing minimum and maximum boundaries at the namespace level.

### LimitRange YAML

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
  - type: Container
    default:
      memory: "256Mi"
      cpu: "500m"
    defaultRequest:
      memory: "128Mi"
      cpu: "250m"
    max:
      memory: "2Gi"
      cpu: "2"
    min:
      memory: "64Mi"
      cpu: "100m"
```

### Breaking Down the Fields

```
LimitRange fields explained:

  default:
    → The limit injected into containers that specify no limits at all
    → If a container has no resources.limits, it gets memory: 256Mi, cpu: 500m

  defaultRequest:
    → The request injected into containers that specify no requests
    → If a container has no resources.requests, it gets memory: 128Mi, cpu: 250m

  max:
    → The maximum any container in this namespace can request or limit
    → Any pod with memory limit > 2Gi will be REJECTED by the API server
    → Prevents runaway resource allocation

  min:
    → The minimum any container in this namespace must request or limit
    → Any pod with memory request < 64Mi will be REJECTED
    → Ensures containers have meaningful resource reservations
```

### How Default Injection Works

```
Developer submits a pod with no resources field:

  apiVersion: v1
  kind: Pod
  metadata:
    name: my-app
    namespace: production
  spec:
    containers:
    - name: app
      image: myapp:1.0
      # no resources field

  Kubernetes admission controller sees the LimitRange:
                │
                ▼
  Injects defaults automatically:
  resources:
    requests:
      memory: "128Mi"   ← from defaultRequest
      cpu: "250m"       ← from defaultRequest
    limits:
      memory: "256Mi"   ← from default
      cpu: "500m"       ← from default

  Pod is now Burstable (requests != limits) and safely bounded.
```

### Verifying a LimitRange

```bash
# Create the LimitRange
kubectl apply -f limitrange.yaml

# Inspect the LimitRange
kubectl describe limitrange default-limits -n production

# Output example:
# Name:       default-limits
# Namespace:  production
# Type        Resource  Min    Max   Default Request  Default Limit
# ----        --------  ---    ---   ---------------  -------------
# Container   cpu       100m   2     250m             500m
# Container   memory    64Mi   2Gi   128Mi            256Mi

# Deploy a pod WITHOUT resources — then check what was injected
kubectl get pod my-app -n production -o yaml | grep -A 10 resources
```

### LimitRange for Other Object Types

LimitRange can also apply to Pods (aggregate across all containers) and PersistentVolumeClaims (storage size limits):

```yaml
spec:
  limits:
  - type: Pod         # applies to entire pod, not individual containers
    max:
      memory: "4Gi"
      cpu: "4"
  - type: PersistentVolumeClaim
    max:
      storage: "50Gi"
    min:
      storage: "1Gi"
```

---

## 6. ResourceQuota — Namespace Limits

### What ResourceQuota Does

While LimitRange controls per-container and per-pod boundaries, **ResourceQuota** controls the aggregate total resources that can be consumed by all pods in a namespace. It is a namespace-level budget.

```
LimitRange vs ResourceQuota:

  LimitRange:
    → Per container / per pod rules
    → "Each container must stay within these bounds"
    → Controls individual resource declarations

  ResourceQuota:
    → Namespace-level aggregate totals
    → "The entire namespace cannot use more than this combined"
    → Controls total resource consumption across all pods
```

### ResourceQuota YAML Example

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    # Compute resource totals
    requests.cpu: "10"          # total CPU requests across all pods <= 10 cores
    requests.memory: "20Gi"     # total memory requests across all pods <= 20Gi
    limits.cpu: "20"            # total CPU limits across all pods <= 20 cores
    limits.memory: "40Gi"       # total memory limits across all pods <= 40Gi

    # Object count limits
    pods: "50"                  # max 50 pods in this namespace
    services: "20"              # max 20 services
    persistentvolumeclaims: "30" # max 30 PVCs
    secrets: "50"               # max 50 secrets
    configmaps: "50"            # max 50 configmaps
```

### How ResourceQuota Interacts with LimitRange

When ResourceQuota is active on a namespace, **every pod must have resource requests and limits declared**. Without them, the API server will reject the pod because it cannot calculate the quota impact.

```
Important interaction:

  Namespace has ResourceQuota → every pod MUST declare resources
                                (or have a LimitRange inject them)

  Recommended pattern:
  1. Create a LimitRange with sensible defaults
  2. Create a ResourceQuota with aggregate limits
  3. LimitRange injects defaults into pods without resources
  4. ResourceQuota enforces the namespace-wide total budget
```

### Checking ResourceQuota Usage

```bash
# Describe the quota to see current usage vs hard limits
kubectl describe resourcequota production-quota -n production

# Example output:
# Name:                    production-quota
# Namespace:               production
# Resource                 Used    Hard
# --------                 ---     ---
# limits.cpu               4500m   20
# limits.memory            8Gi     40Gi
# pods                     18      50
# requests.cpu             2250m   10
# requests.memory          4Gi     20Gi
# services                 6       20

# Watch what happens when you exceed the quota:
# kubectl apply -f big-deployment.yaml
# Error from server (Forbidden): pods "big-pod" is forbidden:
# exceeded quota: production-quota, requested: requests.memory=8Gi,
# used: requests.memory=16Gi, limited: requests.memory=20Gi
```

### ResourceQuota for QoS Classes

You can also scope quotas to specific QoS classes, which allows you to control how many Guaranteed vs Burstable pods are running in a namespace:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: guaranteed-quota
  namespace: production
spec:
  hard:
    pods: "10"
    requests.cpu: "8"
    requests.memory: "16Gi"
  scopeSelector:
    matchExpressions:
    - operator: In
      scopeName: PriorityClass
      values:
      - high-priority
```

---

## 7. Inspecting Usage with kubectl top

### Prerequisites — Metrics Server

`kubectl top` requires the **metrics-server** to be installed and running in the cluster. Metrics Server scrapes CPU and memory usage from the kubelet on each node every 15 seconds.

```bash
# Check if metrics-server is installed
kubectl get deployment metrics-server -n kube-system

# Install metrics-server with Helm if not present
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm install metrics-server metrics-server/metrics-server -n kube-system

# For minikube, enable the addon:
minikube addons enable metrics-server

# Verify it is working (may take 1-2 minutes after install):
kubectl top nodes
```

### Node-Level Usage

```bash
# Show CPU and memory usage for all nodes
kubectl top nodes
```

```
Example output:
NAME            CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
node-1          412m         10%    3814Mi          23%
node-2          1203m        30%    9512Mi          59%
node-3          87m          2%     1024Mi          6%

Column explanations:
  CPU(cores)     → current CPU usage in millicores (live measurement)
  CPU%           → percentage of node's total CPU capacity
  MEMORY(bytes)  → current RSS memory usage in Mi or Gi
  MEMORY%        → percentage of node's total memory capacity
```

### Pod-Level Usage

```bash
# Show CPU and memory usage for all pods in current namespace
kubectl top pods

# Show pods across all namespaces
kubectl top pods --all-namespaces

# Sort by memory consumption (descending) — useful for finding memory hogs
kubectl top pods --sort-by=memory

# Sort by CPU consumption (descending) — useful for finding CPU hogs
kubectl top pods --sort-by=cpu

# Show per-container breakdown within each pod
kubectl top pods --containers

# Combine flags: all namespaces, sorted by memory, with container breakdown
kubectl top pods --all-namespaces --containers --sort-by=memory
```

```
Example output of kubectl top pods --containers:
POD                       NAME       CPU(cores)   MEMORY(bytes)
api-server-7d9f4-x8kqp   api        245m         198Mi
api-server-7d9f4-x8kqp   sidecar    12m          24Mi
database-0                postgres   512m         2048Mi
cache-6d8f9-vp2rk         redis      87m          312Mi
batch-job-xk2p9           processor  1200m        768Mi

Column explanations:
  POD          → pod name
  NAME         → container name within the pod
  CPU(cores)   → live CPU usage in millicores
  MEMORY(bytes)→ live memory usage in bytes (shown as Mi or Gi)
```

### Comparing Requests to Actual Usage

`kubectl top` shows actual live usage. You can compare this against declared requests by examining the pod spec:

```bash
# See requests and limits declared for a specific pod
kubectl get pod api-server-7d9f4-x8kqp -o jsonpath=\
'{range .spec.containers[*]}{.name}{"\n"}{.resources}{"\n"}{end}'

# A useful one-liner: show all pods with their requests and limits
kubectl get pods -o custom-columns=\
"NAME:.metadata.name,\
CPU-REQ:.spec.containers[0].resources.requests.cpu,\
MEM-REQ:.spec.containers[0].resources.requests.memory,\
CPU-LIM:.spec.containers[0].resources.limits.cpu,\
MEM-LIM:.spec.containers[0].resources.limits.memory"
```

### Identifying Over-Provisioned and Under-Provisioned Pods

```
Pattern: memory request much higher than actual usage
  → pod/cache   request=2Gi   actual=200Mi
  → Over-provisioned: wasting 1.8Gi of reserved capacity on the node
  → Action: reduce request to ~300Mi (actual + ~50% headroom)

Pattern: memory usage approaching the limit
  → pod/api     limit=256Mi   actual=245Mi
  → Under-provisioned: one traffic spike will OOMKill this container
  → Action: increase limit to 512Mi and investigate memory usage

Pattern: CPU usage consistently at or near limit
  → pod/worker  limit=500m    actual=490m
  → Under-provisioned: container is being throttled
  → Action: increase CPU limit or optimise application code
```

---

## 8. Troubleshooting OOMKilled and Evicted Pods

### Identifying OOMKilled Containers

When a container exceeds its memory limit, the kernel kills it and the process exits with code **137** (128 + signal 9, SIGKILL). Kubernetes records this in the pod's status.

```bash
# Describe the pod to see OOMKilled in the Last State section
kubectl describe pod <pod-name>
```

```
Example output from kubectl describe pod (relevant section):
Containers:
  app:
    State:          Running
      Started:      Wed, 25 Jun 2026 09:12:34 +1000
    Last State:     Terminated
      Reason:       OOMKilled          ← clear signal
      Exit Code:    137               ← 128 + SIGKILL (9)
      Started:      Wed, 25 Jun 2026 09:10:11 +1000
      Finished:     Wed, 25 Jun 2026 09:12:33 +1000
    Ready:          True
    Restart Count:  4                 ← has happened 4 times
    Limits:
      memory:  256Mi
    Requests:
      memory:  128Mi
```

```bash
# Check recent events sorted by time — OOMKilled shows up here
kubectl get events --sort-by=.metadata.creationTimestamp

# Filter to just OOMKill events
kubectl get events --sort-by=.metadata.creationTimestamp \
  | grep -i oom

# Find all pods that have restarted (possible OOMKill indicator)
kubectl get pods --all-namespaces | awk '$5 > 0'

# Find all failed pods
kubectl get pods --field-selector=status.phase=Failed --all-namespaces
```

### Understanding CrashLoopBackOff After OOMKill

After a container is OOMKilled, Kubernetes restarts it following the pod's `restartPolicy`. If it keeps getting OOMKilled, Kubernetes exponentially backs off the restarts: 10s, 20s, 40s, 80s, up to 5 minutes. This manifests as `CrashLoopBackOff` status.

```bash
# Pods in CrashLoopBackOff
kubectl get pods | grep CrashLoopBackOff

# Check the restart count and last termination reason
kubectl describe pod <pod-name> | grep -A 5 "Last State"

# View logs from the previous (crashed) container run
kubectl logs <pod-name> --previous
```

### Node Pressure Eviction

Beyond OOMKill (which is container-level), the kubelet also performs **node-level eviction** when the node itself runs low on resources. This evicts entire pods (not just containers) based on configured thresholds.

```
Node eviction triggers (kubelet default thresholds):

  memory.available < 100Mi
    → kubelet begins evicting pods (BestEffort first)

  nodefs.available < 10%
    → disk pressure: evicts pods that are writing lots of data

  imagefs.available < 15%
    → container image filesystem pressure

  pid.available < 1000
    → process ID exhaustion (rare but can happen with many containers)
```

```bash
# Check if a node is under memory pressure
kubectl describe node <node-name> | grep -A 5 Conditions

# Example output showing memory pressure:
# Conditions:
#   Type              Status   Reason
#   MemoryPressure    True     KubeletHasInsufficientMemory
#   DiskPressure      False    KubeletHasNoDiskPressure
#   PIDPressure       False    KubeletHasSufficientPID
#   Ready             True     KubeletReady
```

### Finding and Diagnosing Evicted Pods

Evicted pods remain in the cluster with `status.phase=Failed` and `reason=Evicted` until cleaned up. They are useful for post-mortem analysis.

```bash
# List all evicted pods across all namespaces
kubectl get pods --all-namespaces \
  --field-selector=status.phase=Failed \
  | grep Evicted

# Describe an evicted pod to see why it was evicted
kubectl describe pod <evicted-pod-name>
# Look for: "The node was low on resource: memory."

# Clean up evicted pods (they don't restart but take up etcd space)
kubectl delete pods --all-namespaces \
  --field-selector=status.phase=Failed
```

### Fixing OOMKilled and Eviction Issues

```
Diagnosis → Fix mapping:

1. Single container repeatedly OOMKilled
   Diagnosis: kubectl describe pod → OOMKilled, exit code 137
   Fix A: Increase memory limit:
          resources.limits.memory: "512Mi"  (was 256Mi)
   Fix B: Find and fix memory leak in application
   Fix C: For JVM apps: set -Xmx to 75% of container memory limit

2. Multiple pods evicted from a node
   Diagnosis: kubectl describe node → MemoryPressure True
   Fix A: Reduce memory requests on over-provisioned pods
   Fix B: Add more nodes to the cluster
   Fix C: Enable cluster autoscaler to auto-add nodes

3. Pod pending (insufficient resources)
   Diagnosis: kubectl describe pod → "Insufficient memory"
   Fix A: Reduce requests to match actual usage
   Fix B: Add more nodes
   Fix C: Enable Vertical Pod Autoscaler (VPA)

4. OOMKill on Java application
   Diagnosis: JVM heap (-Xmx) + JVM overhead > container limit
   Fix: Set -Xmx to ~75% of container memory limit
        e.g., limit=1Gi → set -Xmx=768m (750Mi headroom for JVM)
```

---

## 9. Hands-On Exercises

**Exercise 1: Deploy a pod with requests and limits, verify with kubectl top**

Deploy the following pod manifest and observe its resource usage:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx:1.25
    resources:
      requests:
        memory: "64Mi"
        cpu: "100m"
      limits:
        memory: "128Mi"
        cpu: "250m"
```

```bash
kubectl apply -f resource-demo.yaml
kubectl get pod resource-demo
kubectl top pod resource-demo
kubectl get pod resource-demo -o jsonpath='{.status.qosClass}'
# Expected: Burstable (requests != limits)
```

Verify the QoS class and observe that requests are lower than limits. Note the actual CPU and memory usage from `kubectl top`.

---

**Exercise 2: Trigger OOMKill with a memory-hog container**

Deploy a container designed to consume more memory than its limit:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: oom-demo
spec:
  containers:
  - name: memory-hog
    image: polinux/stress
    args:
    - "--vm"
    - "1"
    - "--vm-bytes"
    - "200M"     # attempts to allocate 200Mi
    - "--vm-hang"
    - "1"
    resources:
      requests:
        memory: "64Mi"
        cpu: "100m"
      limits:
        memory: "100Mi"   # limit is 100Mi, but app wants 200Mi
        cpu: "200m"
```

```bash
kubectl apply -f oom-demo.yaml
# Watch the pod status change
kubectl get pod oom-demo -w
# Wait for OOMKilled, then examine:
kubectl describe pod oom-demo
# Look for: Last State: Terminated, Reason: OOMKilled, Exit Code: 137
```

---

**Exercise 3: Create a LimitRange and verify defaults are injected**

Create a namespace and a LimitRange, then deploy a pod without any resource specification and verify defaults are auto-injected:

```bash
kubectl create namespace test-limits
```

```yaml
# limitrange.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: test-limits
spec:
  limits:
  - type: Container
    default:
      memory: "256Mi"
      cpu: "500m"
    defaultRequest:
      memory: "128Mi"
      cpu: "250m"
    max:
      memory: "1Gi"
      cpu: "2"
    min:
      memory: "32Mi"
      cpu: "50m"
```

```yaml
# no-resources-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-resources-pod
  namespace: test-limits
spec:
  containers:
  - name: app
    image: nginx:1.25
    # no resources field
```

```bash
kubectl apply -f limitrange.yaml
kubectl apply -f no-resources-pod.yaml

# Verify defaults were injected by the admission controller
kubectl get pod no-resources-pod -n test-limits \
  -o jsonpath='{.spec.containers[0].resources}' | python3 -m json.tool
# Expected: requests.memory=128Mi, requests.cpu=250m,
#           limits.memory=256Mi, limits.cpu=500m
```

---

**Exercise 4: Create a ResourceQuota and attempt to exceed it**

```yaml
# quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: test-quota
  namespace: test-limits
spec:
  hard:
    pods: "3"
    requests.cpu: "500m"
    requests.memory: "512Mi"
    limits.cpu: "1"
    limits.memory: "1Gi"
```

```bash
kubectl apply -f quota.yaml
kubectl describe resourcequota test-quota -n test-limits

# Deploy 4 pods and observe the 4th being rejected
for i in 1 2 3 4; do
  kubectl run pod-$i --image=nginx:1.25 -n test-limits \
    --requests='cpu=100m,memory=100Mi' \
    --limits='cpu=200m,memory=200Mi'
done

# The 4th pod should fail with:
# Error from server (Forbidden): pods "pod-4" is forbidden:
# exceeded quota: test-quota, requested: pods=1, used: pods=3, limited: pods=3
```

---

**Exercise 5: Find the top memory consumer using kubectl top**

```bash
# Ensure metrics-server is running
kubectl get deployment metrics-server -n kube-system

# List all pods across all namespaces sorted by memory usage (highest first)
kubectl top pods --all-namespaces --sort-by=memory

# List with container-level breakdown
kubectl top pods --all-namespaces --containers --sort-by=memory

# Find which node is under the most memory pressure
kubectl top nodes --sort-by=memory

# Advanced: compare actual memory usage against the declared limit
# for a specific pod to see how close it is to being OOMKilled
POD=resource-demo
LIMIT=$(kubectl get pod $POD -o jsonpath=\
  '{.spec.containers[0].resources.limits.memory}')
ACTUAL=$(kubectl top pod $POD --no-headers | awk '{print $3}')
echo "Pod: $POD | Limit: $LIMIT | Actual: $ACTUAL"
```

---

## 10. Interview Q&A

**Q: What is the difference between resource requests and limits in Kubernetes?**

Answer: Resource requests and limits are two separate controls that serve different purposes. A **request** is the amount of CPU or memory that Kubernetes guarantees a container will have available — it is used by the scheduler to determine which node has sufficient capacity to place the pod. Once scheduled, the node reserves that capacity. A **limit** is the maximum amount the container is allowed to consume at runtime, enforced by the Linux kernel's cgroup subsystem. If a container tries to use more CPU than its limit it is throttled (slowed down) by the CFS scheduler. If it tries to use more memory than its limit, the kernel's OOM killer terminates the container immediately with exit code 137. The scheduler only sees requests; limits are invisible to scheduling decisions. Best practice is to set both requests and limits for every container, with requests sized to actual typical usage and limits providing a reasonable burst ceiling.

---

**Q: What are QoS classes and how does Kubernetes use them during eviction?**

Answer: Kubernetes assigns every pod to one of three Quality of Service classes based on its resource configuration. **Guaranteed** pods have requests equal to limits for every container — they are the last to be evicted under node memory pressure. **Burstable** pods have requests set but lower than their limits, or have limits without requests — they are evicted after BestEffort pods, with pods using the most memory above their request being evicted first. **BestEffort** pods have no resource requests or limits at all — they are the first to be evicted when a node runs low on memory. The kubelet monitors node-level resource thresholds and begins evicting pods in BestEffort → Burstable → Guaranteed order when available memory drops below configured thresholds (default: 100Mi). You can inspect a pod's QoS class with `kubectl get pod <name> -o jsonpath='{.status.qosClass}'`.

---

**Q: What happens when a pod exceeds its CPU limit? What about its memory limit?**

Answer: The behaviour differs because CPU and memory are fundamentally different resource types. **CPU is compressible**: when a container tries to use more CPU than its declared limit, the Linux kernel's Completely Fair Scheduler (CFS) throttles it — the container is slowed down but continues running. There is no restart or eviction; the container simply receives less CPU time than it wants, which manifests as increased response latency or reduced throughput. **Memory is incompressible**: when a container's RSS memory exceeds its declared limit, the kernel's Out-Of-Memory (OOM) killer sends SIGKILL to the container process immediately. The container exits with code 137, and Kubernetes restarts it according to the pod's restartPolicy. If the container is repeatedly killed, it enters CrashLoopBackOff with exponentially increasing backoff intervals. The key distinction is: exceeding a CPU limit degrades performance silently, while exceeding a memory limit causes an abrupt container termination.

---

**Q: How does the Kubernetes scheduler use resource requests?**

Answer: The Kubernetes scheduler uses resource requests to determine which node is eligible to run a new pod. When a pod is created, the scheduler evaluates all nodes in the cluster and filters out any node where adding the pod's requests would exceed the node's total allocatable capacity. Allocatable capacity is the node's total capacity minus resources reserved for the kubelet and OS. The scheduler tracks the sum of requests across all pods already scheduled on each node — it does not look at live actual usage reported by metrics-server. This means a node could be lightly utilised (pods using little actual CPU/memory) but appear full to the scheduler if the declared requests are high. Conversely, a node could be heavily utilised but still accept new pods if declared requests are low. This is why setting accurate, realistic requests is essential: too high wastes node capacity through poor bin-packing, and too low causes unexpected performance issues and disrupts scheduling decisions.

---

**Q: What is LimitRange and how does it differ from ResourceQuota?**

Answer: LimitRange and ResourceQuota operate at different granularities and serve complementary purposes. A **LimitRange** is a per-container and per-pod policy applied within a namespace. It sets default requests and limits that are automatically injected into containers that do not specify them (via the admission controller), and it enforces minimum and maximum boundaries for individual container declarations. If a container specifies a memory limit above the LimitRange maximum, the API server rejects the pod. A **ResourceQuota** is a namespace-level aggregate budget. It caps the total amount of CPU, memory, and other resources that can be consumed by all pods in a namespace combined. It also caps object counts (pods, services, PVCs). The two work together: LimitRange ensures every container has sensible per-container bounds (and injects defaults so pods without resources can satisfy the quota), while ResourceQuota ensures the namespace as a whole cannot consume more than its allocated share of cluster resources. When ResourceQuota is active, pods without requests and limits are rejected unless a LimitRange provides defaults.
