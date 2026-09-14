# Kubernetes Autoscaling — Complete Guide

## Table of Contents
1. [Autoscaling Types Overview](#1-autoscaling-types-overview)
2. [Horizontal Pod Autoscaler (HPA)](#2-horizontal-pod-autoscaler-hpa)
3. [HPA with Custom Metrics](#3-hpa-with-custom-metrics)
4. [Vertical Pod Autoscaler (VPA)](#4-vertical-pod-autoscaler-vpa)
5. [KEDA — Event-Driven Autoscaling](#5-keda--event-driven-autoscaling)
6. [Cluster Autoscaler](#6-cluster-autoscaler)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Autoscaling Types Overview

### Three Axes of Kubernetes Autoscaling

Kubernetes provides autoscaling along three independent dimensions. Understanding which axis to scale on — and when to combine them — is one of the key skills for running production workloads efficiently.

```
The three autoscaling axes:

  ┌────────────────────────────────────────────────────────────────────┐
  │                     Kubernetes Cluster                             │
  │                                                                    │
  │  ┌──────────────────────────────────────────────────────────────┐  │
  │  │  Node Pool (Cluster Autoscaler scales this)                  │  │
  │  │                                                              │  │
  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
  │  │  │   Node 1   │  │   Node 2   │  │   Node 3   │  ◀── CA    │  │
  │  │  │            │  │            │  │  (new node)│  adds nodes│  │
  │  │  │  pod  pod  │  │  pod  pod  │  │  pod       │             │  │
  │  │  │  pod  pod  │  │  pod       │  │            │             │  │
  │  │  └────────────┘  └────────────┘  └────────────┘             │  │
  │  │       ▲                                                      │  │
  │  │       │  HPA scales out (more pods)                          │  │
  │  │       │  VPA scales up (bigger pods)                         │  │
  │  └───────┼──────────────────────────────────────────────────────┘  │
  │          │                                                         │
  │     ┌────┴──────────────────────────────────────────────────────┐  │
  │     │                                                           │  │
  │     │   HPA (Horizontal Pod Autoscaler)                        │  │
  │     │   → Changes the NUMBER of pod replicas                   │  │
  │     │   → Scale out: more pods for more traffic                 │  │
  │     │   → Scale in: fewer pods when traffic drops               │  │
  │     │                                                           │  │
  │     │   VPA (Vertical Pod Autoscaler)                           │  │
  │     │   → Changes the SIZE of each pod (requests/limits)        │  │
  │     │   → Scale up: more CPU/memory per pod                     │  │
  │     │   → Scale down: less CPU/memory (right-sizing)            │  │
  │     │                                                           │  │
  │     │   CA (Cluster Autoscaler)                                 │  │
  │     │   → Changes the NUMBER of nodes in the cluster            │  │
  │     │   → Adds nodes when pods can't be scheduled               │  │
  │     │   → Removes nodes when they're underutilised              │  │
  │     └───────────────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────────────────┘
```

### When to Use Each

```
┌────────────────────┬────────────────────────────────────────────────┐
│  Autoscaler        │  Best use case                                 │
├────────────────────┼────────────────────────────────────────────────┤
│ HPA                │ Stateless services with variable traffic        │
│                    │ Web APIs, background workers, microservices     │
│                    │ When you can run multiple identical pod copies  │
├────────────────────┼────────────────────────────────────────────────┤
│ VPA                │ Stateful workloads that can't scale horizontally│
│                    │ Databases, caches, single-instance services     │
│                    │ Right-sizing pods to eliminate over-provisioning│
├────────────────────┼────────────────────────────────────────────────┤
│ KEDA               │ Event-driven workloads with external triggers   │
│                    │ Message queue consumers, batch processing       │
│                    │ Scale to zero when no events pending            │
├────────────────────┼────────────────────────────────────────────────┤
│ Cluster Autoscaler │ Dynamic workloads with unpredictable pod counts │
│                    │ Cost optimisation: reduce nodes during off-peak │
│                    │ Works alongside HPA and KEDA                    │
└────────────────────┴────────────────────────────────────────────────┘
```

---

## 2. Horizontal Pod Autoscaler (HPA)

### How HPA Works

HPA watches a target workload (Deployment, StatefulSet, or ReplicaSet) and periodically compares observed metrics against configured thresholds. When the metric exceeds the threshold, HPA increases the replica count. When it drops below the threshold, HPA decreases the replica count. The default evaluation interval is 15 seconds.

```
HPA control loop:

  Every 15 seconds:
  ┌─────────────────────────────────────────────────────────────────┐
  │  1. Fetch metric from metrics-server (or custom metrics API)    │
  │     e.g. average CPU = 85% across all pods                      │
  │                                                                 │
  │  2. Calculate desired replicas:                                 │
  │     desiredReplicas = ceil(currentReplicas * (current / target))│
  │     = ceil(3 * (85 / 50)) = ceil(5.1) = 6                      │
  │                                                                 │
  │  3. Apply scale-up / scale-down constraints (behavior field)    │
  │                                                                 │
  │  4. Update Deployment replicas if within [min, max] bounds      │
  └─────────────────────────────────────────────────────────────────┘
```

### Full HPA YAML

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-api                         # the Deployment to scale

  minReplicas: 2                         # never scale below 2 (for HA)
  maxReplicas: 20                        # never scale above 20

  metrics:
  # Scale on CPU utilisation (percentage of the pod's CPU request)
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60           # scale up when average CPU > 60%

  # Also scale on memory utilisation
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80           # scale up when average memory > 80%

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60    # wait 60s before scaling up again
      policies:
      - type: Pods
        value: 4                        # add up to 4 pods at a time
        periodSeconds: 60
      - type: Percent
        value: 100                      # or double pod count, whichever is smaller
        periodSeconds: 60
      selectPolicy: Min                 # use the more conservative policy

    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 minutes before scaling down
      policies:
      - type: Pods
        value: 1                        # remove at most 1 pod per minute
        periodSeconds: 60
      selectPolicy: Min
```

### kubectl autoscale Shortcut

```bash
# Create an HPA quickly from the command line
kubectl autoscale deployment my-api \
  --cpu-percent=60 \
  --min=2 \
  --max=20 \
  -n production

# Check HPA status (shows current replicas and target metrics)
kubectl get hpa -n production

# Detailed HPA status including scaling events
kubectl describe hpa my-api-hpa -n production
```

```
Example kubectl get hpa output:

  NAME         REFERENCE           TARGETS         MINPODS   MAXPODS   REPLICAS
  my-api-hpa   Deployment/my-api   48%/60%, 2/80%  2         20        3

  Column explanations:
  TARGETS: current/target for each metric (CPU: 48%/60%, Memory: 2Mi/80%)
  REPLICAS: current number of running replicas
```

### HPA Requirements

```
For HPA to work, two things must be true:

  1. The target pods must have resource requests defined
     HPA calculates CPU% as: actual CPU / CPU request
     Without a CPU request, HPA cannot calculate utilisation

  2. metrics-server must be installed and running
     kubectl get deployment metrics-server -n kube-system

  Common HPA issue — "unknown" target:
  NAME         REFERENCE           TARGETS
  my-api-hpa   Deployment/my-api   <unknown>/60%

  Cause: pods have no CPU request, or metrics-server is not running
  Fix: add resources.requests.cpu to the pod spec
```

---

## 3. HPA with Custom Metrics

### Why Custom Metrics

CPU and memory are not always the right signals for scaling. A web API might be under-loaded CPU-wise but handling too many concurrent database connections. A message queue consumer might need to scale based on queue depth, not CPU. Custom metrics and external metrics allow HPA to scale on any signal.

```
Custom metrics scaling options:

  Resource metrics (built-in):
    CPU utilisation
    Memory utilisation
    → Served by metrics-server API

  Custom metrics (from your app):
    http_requests_per_second
    active_connections
    queue_depth
    → Served by Prometheus Adapter or Datadog Cluster Agent

  External metrics (from outside the cluster):
    AWS SQS queue depth
    Kafka consumer lag
    RabbitMQ queue length
    → Served by KEDA (see section 5) or custom adapters
```

### Prometheus Adapter for Custom Metrics

The Prometheus Adapter bridges the Kubernetes custom metrics API with Prometheus. It translates PromQL queries into the custom metrics API format that HPA can consume.

```bash
# Install Prometheus Adapter
helm install prometheus-adapter \
  prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --set prometheus.url=http://kube-prometheus-stack-prometheus.monitoring.svc \
  --set prometheus.port=9090
```

```yaml
# values.yaml for Prometheus Adapter — define which PromQL metrics to expose
rules:
  custom:
  - seriesQuery: 'http_requests_total{kubernetes_namespace!="",kubernetes_pod_name!=""}'
    resources:
      overrides:
        kubernetes_namespace: {resource: "namespace"}
        kubernetes_pod_name: {resource: "pod"}
    name:
      matches: "^(.*)_total"
      as: "${1}_per_second"
    metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
```

```yaml
# HPA using custom HTTP request rate metric
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-api-custom-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-api
  minReplicas: 2
  maxReplicas: 30
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second      # metric exposed by Prometheus Adapter
      target:
        type: AverageValue
        averageValue: "100"                 # scale when avg > 100 req/s per pod
```

---

## 4. Vertical Pod Autoscaler (VPA)

### What VPA Does

VPA analyses historical and current resource usage of pods and automatically adjusts the resource requests (and optionally limits) to match actual usage. It solves the problem of over-provisioned or under-provisioned pods without requiring manual right-sizing.

```
VPA operation:

  Historical usage collected by VPA recommender:
    pod/api → avg CPU: 120m, avg mem: 180Mi
    pod/api → p95 CPU: 350m, p95 mem: 280Mi

  VPA Recommender calculates:
    Recommended requests:
      cpu: "350m"   (was: 1000m — over-provisioned)
      memory: "300Mi" (was: 128Mi — under-provisioned)

  VPA Updater (if mode=Auto):
    Evicts existing pods
    New pods start with updated requests
    → Results in correct QoS class and efficient scheduling
```

### VPA Installation

```bash
# Clone the VPA repo and install
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-install.sh

# Verify VPA components
kubectl get pods -n kube-system | grep vpa
# vpa-admission-controller-xxx  1/1  Running
# vpa-recommender-xxx           1/1  Running
# vpa-updater-xxx               1/1  Running
```

### VPA YAML — Three Update Modes

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-api
  updatePolicy:
    updateMode: "Auto"          # Off | Initial | Recreate | Auto
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: "50m"              # VPA will never recommend below these values
        memory: "64Mi"
      maxAllowed:
        cpu: "4"                # VPA will never recommend above these values
        memory: "4Gi"
      controlledResources: ["cpu", "memory"]
```

```
VPA update modes explained:

  Off:
    → VPA only RECOMMENDS — it never changes anything
    → Check recommendations: kubectl describe vpa my-api-vpa
    → Use to audit and understand what VPA would suggest
    → Safe starting point for any existing deployment

  Initial:
    → Applies recommendations only when a NEW pod is created
    → Does not evict running pods
    → Good for gradual adoption — recommendations take effect on next rollout

  Recreate:
    → Evicts pods that are outside the recommended range
    → New pods start with recommended requests
    → Causes brief disruption; acceptable if PodDisruptionBudget is in place

  Auto:
    → Same as Recreate today
    → Will use in-place pod updates (no restart) in future K8s versions
    → Use for production once you have confidence in VPA's recommendations
```

### Reading VPA Recommendations

```bash
# Check what VPA currently recommends for a deployment
kubectl describe vpa my-api-vpa -n production
```

```
Example kubectl describe vpa output:

  Recommendation:
    Container Recommendations:
      Container Name:  api
      Lower Bound:
        Cpu:     100m
        Memory:  128Mi
      Target:
        Cpu:     350m          ← apply this as the new request
        Memory:  300Mi
      Uncapped Target:
        Cpu:     280m
        Memory:  240Mi
      Upper Bound:
        Cpu:     2
        Memory:  1Gi

  Target = the recommended request value
  LowerBound = minimum VPA would accept as reasonable
  UpperBound = maximum VPA would accept before flagging over-provisioning
```

### VPA and HPA Interaction

```
IMPORTANT: Do NOT run VPA and HPA on the same resource metric simultaneously.

  VPA adjusts CPU requests → HPA uses CPU% (which changes when requests change)
  This creates a feedback loop: VPA lowers request → HPA thinks usage is high
  → HPA scales out → VPA sees lower per-pod usage → VPA lowers requests further

  Safe combination:
    VPA on CPU + memory       → right-size requests/limits
    HPA on custom metrics     → scale replicas based on queue depth or RPS

  Or use just one:
    HPA on CPU               → stateless services
    VPA in Off mode          → audit tool only (no changes)
```

---

## 5. KEDA — Event-Driven Autoscaling

### What KEDA Does

KEDA (Kubernetes Event-Driven Autoscaling) extends HPA to support external event sources as scaling triggers. It can scale workloads from zero to any number of replicas based on signals like Kafka consumer lag, SQS queue depth, RabbitMQ queue length, HTTP request rate, Prometheus metrics, and dozens more.

```
KEDA architecture:

  External event source (Kafka, SQS, RabbitMQ, etc.)
          │
          │  KEDA Metrics Adapter polls source
          ▼
  KEDA ScaledObject CRD
    - defines the trigger (e.g. Kafka lag > 100)
    - defines the target (Deployment to scale)
    - defines min/max replicas
          │
          │  KEDA creates/manages HPA internally
          ▼
  HPA scales the Deployment
          │
  Deployment replica count adjusts
  (including scale to ZERO when no events)
```

### Installing KEDA

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

helm install keda kedacore/keda \
  --namespace keda \
  --create-namespace

kubectl get pods -n keda
# keda-operator-xxx                1/1  Running
# keda-operator-metrics-apiserver  1/1  Running
```

### ScaledObject — Kafka Trigger

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: kafka-consumer-scaledobject
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kafka-consumer

  minReplicaCount: 0              # scale to ZERO when no lag
  maxReplicaCount: 30
  pollingInterval: 15             # check Kafka every 15 seconds
  cooldownPeriod: 60              # wait 60s after last event before scaling to 0

  triggers:
  - type: kafka
    metadata:
      bootstrapServers: kafka.production.svc.cluster.local:9092
      consumerGroup: my-consumer-group
      topic: orders
      lagThreshold: "100"         # scale up when consumer lag > 100 messages
      offsetResetPolicy: latest
```

### ScaledObject — SQS Queue Trigger

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: sqs-worker-scaledobject
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sqs-worker
  minReplicaCount: 0
  maxReplicaCount: 10
  triggers:
  - type: aws-sqs-queue
    authenticationRef:
      name: keda-aws-credentials    # reference to TriggerAuthentication with AWS creds
    metadata:
      queueURL: https://sqs.ap-southeast-2.amazonaws.com/123456789/my-queue
      queueLength: "5"              # scale up when queue has > 5 messages
      awsRegion: ap-southeast-2
```

### ScaledObject — Prometheus Trigger

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: api-prometheus-scaledobject
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-api
  minReplicaCount: 2
  maxReplicaCount: 50
  triggers:
  - type: prometheus
    metadata:
      serverAddress: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
      metricName: http_requests_rate
      threshold: "100"             # scale when RPS > 100 per pod
      query: |
        sum(rate(http_requests_total{namespace="production",
          deployment="my-api"}[2m]))
        / on() kube_deployment_status_replicas_available{
          namespace="production", deployment="my-api"}
```

### ScaledJob — Batch Processing

For batch jobs that should run to completion rather than scaling a long-running Deployment, use ScaledJob:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: image-processor-scaledjob
  namespace: production
spec:
  jobTargetRef:
    template:
      spec:
        containers:
        - name: processor
          image: my-image-processor:1.0
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2"
              memory: "2Gi"
        restartPolicy: Never
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: https://sqs.ap-southeast-2.amazonaws.com/123456789/images
      queueLength: "1"             # one job per SQS message
      awsRegion: ap-southeast-2
  maxReplicaCount: 20
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
```

---

## 6. Cluster Autoscaler

### What Cluster Autoscaler Does

Cluster Autoscaler (CA) automatically adjusts the size of the node pool. It adds nodes when pods cannot be scheduled due to insufficient resources, and removes nodes when they are underutilised and their pods can be rescheduled elsewhere.

```
Cluster Autoscaler decision loop:

  SCALE UP trigger:
    Pod remains Pending for > 60 seconds
    Reason: Insufficient cpu / Insufficient memory on all nodes
    CA action: provision a new node from the node group
    Result: pod is scheduled on new node

  SCALE DOWN trigger:
    Node CPU + memory utilisation < 50% for > 10 minutes
    All pods on the node can be moved to other nodes
    No scale-down restrictions (PDB, local storage, etc.)
    CA action: cordon node → drain pods → terminate node
    Result: pods rescheduled, node removed, cost reduced

  BLOCKED scale-down (CA will not remove the node):
    → Pod with local PersistentVolume (hostPath, emptyDir with data)
    → Pod not covered by a controller (standalone pods)
    → Pod with PodDisruptionBudget that would be violated
    → Node with annotation: cluster-autoscaler.kubernetes.io/scale-down-disabled=true
```

### Cluster Autoscaler on AWS EKS

```bash
# Install Cluster Autoscaler via Helm (EKS example)
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo update

helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  --namespace kube-system \
  --set autoDiscovery.clusterName=my-eks-cluster \
  --set awsRegion=ap-southeast-2 \
  --set rbac.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=\
arn:aws:iam::123456789:role/ClusterAutoScalerRole \
  --set extraArgs.balance-similar-node-groups=true \
  --set extraArgs.skip-nodes-with-system-pods=false

# Node groups must have these tags for CA to discover them:
# k8s.io/cluster-autoscaler/enabled: "true"
# k8s.io/cluster-autoscaler/<cluster-name>: "owned"
```

### Cluster Autoscaler Configuration

```yaml
# Important Cluster Autoscaler flags (as extraArgs in Helm):

extraArgs:
  # How long to wait before removing an underutilised node
  scale-down-delay-after-add: "10m"     # wait 10 min after a scale-up
  scale-down-unneeded-time: "10m"       # node must be unneeded for 10 min
  scale-down-utilization-threshold: "0.5" # below 50% utilisation = unneeded

  # Balance pods across node groups (for AZ balance)
  balance-similar-node-groups: "true"

  # Estimate pod resource needs for pending pods
  estimator: binpacking

  # Expand node groups that have the most free capacity
  expander: least-waste
```

### Overprovisioning for Fast Scale-Up

A common pattern is to deploy pause pods (which consume resources but do nothing) as placeholders. When real pods need to be scheduled, they preempt the pause pods, which become Pending and trigger CA to add a new node — but the real pods are already running on the freed capacity.

```yaml
# overprovisioner.yaml — placeholder pods to reserve headroom
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overprovisioner
  namespace: kube-system
spec:
  replicas: 3                             # 3 placeholder pods
  selector:
    matchLabels:
      app: overprovisioner
  template:
    metadata:
      labels:
        app: overprovisioner
    spec:
      priorityClassName: cluster-overprovisioner  # low priority — preemptible
      containers:
      - name: pause
        image: registry.k8s.io/pause:3.9
        resources:
          requests:
            cpu: "1"                      # reserve 1 CPU per placeholder
            memory: "1Gi"                 # reserve 1Gi per placeholder
```

```bash
# Check Cluster Autoscaler logs for scaling decisions
kubectl logs -n kube-system deployment/cluster-autoscaler --tail=50

# Check which nodes are candidates for scale-down
kubectl logs -n kube-system deployment/cluster-autoscaler \
  | grep "scale_down\|Scale down"

# Prevent a specific node from being scaled down
kubectl annotate node worker-3 \
  cluster-autoscaler.kubernetes.io/scale-down-disabled=true
```

---

## 7. Hands-On Exercises

**Exercise 1: Deploy an HPA and trigger scale-up with CPU load**

```bash
# Deploy a simple application with CPU request defined
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hpa-demo
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hpa-demo
  template:
    metadata:
      labels:
        app: hpa-demo
    spec:
      containers:
      - name: app
        image: nginx:1.25
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hpa-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hpa-demo
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
EOF

# Generate CPU load
kubectl run cpu-loader --image=busybox --restart=Never -- \
  /bin/sh -c 'while true; do :; done'

# Watch HPA react
kubectl get hpa hpa-demo -w

# Clean up
kubectl delete pod cpu-loader
kubectl delete deployment hpa-demo
kubectl delete hpa hpa-demo
```

---

**Exercise 2: Inspect VPA recommendations for an existing Deployment**

```bash
# Ensure VPA is installed first (see section 4)

# Deploy a workload
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vpa-demo
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vpa-demo
  template:
    metadata:
      labels:
        app: vpa-demo
    spec:
      containers:
      - name: app
        image: nginx:1.25
        resources:
          requests:
            cpu: "500m"      # intentionally over-provisioned
            memory: "512Mi"  # intentionally over-provisioned
          limits:
            cpu: "1"
            memory: "1Gi"
---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: vpa-demo
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vpa-demo
  updatePolicy:
    updateMode: "Off"          # recommendations only — no changes
EOF

# Wait 2-3 minutes for VPA to collect data, then check recommendations
kubectl describe vpa vpa-demo
# Look for the Target CPU and memory recommendations

kubectl delete deployment vpa-demo
kubectl delete vpa vpa-demo
```

---

**Exercise 3: Install KEDA and create a ScaledObject with a Prometheus trigger**

```bash
helm repo add kedacore https://kedacore.github.io/charts && helm repo update
kubectl create namespace keda
helm install keda kedacore/keda --namespace keda

# Verify KEDA is running
kubectl get pods -n keda

# Deploy a target deployment to scale
kubectl create deployment keda-demo --image=nginx:1.25 -n default

# Create a ScaledObject using Prometheus (requires kube-prometheus-stack)
kubectl apply -f - <<'EOF'
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: keda-demo-scaledobject
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: keda-demo
  minReplicaCount: 0
  maxReplicaCount: 5
  triggers:
  - type: prometheus
    metadata:
      serverAddress: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
      metricName: kube_pod_count
      threshold: "1"
      query: count(kube_pod_info{namespace="default"})
EOF

kubectl get scaledobject -n default
kubectl get hpa -n default         # KEDA creates an HPA automatically
kubectl describe scaledobject keda-demo-scaledobject -n default
```

---

**Exercise 4: Observe HPA scale-down stabilisation window**

```bash
# Create an HPA with a long scale-down stabilisation window
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stable-demo
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stable-demo
  template:
    metadata:
      labels:
        app: stable-demo
    spec:
      containers:
      - name: app
        image: nginx:1.25
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: stable-demo-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stable-demo
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 30
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 120   # wait 2 minutes before scaling down
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
EOF

# Observe: even though CPU is low (replicas=3 but no traffic),
# HPA will wait 120s before reducing replicas
kubectl get hpa stable-demo-hpa -w

kubectl delete deployment stable-demo
kubectl delete hpa stable-demo-hpa
```

---

**Exercise 5: Combine HPA and Cluster Autoscaler to scale from 2 to 20+ pods**

```bash
# This exercise requires a cloud cluster with Cluster Autoscaler installed

# Deploy a workload with tight requests (to trigger node expansion)
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ca-hpa-demo
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ca-hpa-demo
  template:
    metadata:
      labels:
        app: ca-hpa-demo
    spec:
      containers:
      - name: app
        image: polinux/stress
        args: ["--cpu", "1"]              # consume 1 CPU core
        resources:
          requests:
            cpu: "900m"                   # large request to fill nodes quickly
            memory: "256Mi"
          limits:
            cpu: "1"
            memory: "512Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ca-hpa-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ca-hpa-demo
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
EOF

# Watch HPA scale pods
kubectl get hpa ca-hpa-demo -w &

# Watch Cluster Autoscaler add nodes as pods become Pending
kubectl get nodes -w &

# Check CA logs for scaling decisions
kubectl logs -n kube-system deployment/cluster-autoscaler --tail=30

kubectl delete deployment ca-hpa-demo
kubectl delete hpa ca-hpa-demo
```

---

## 8. Interview Q&A

**Q: What is the difference between HPA and VPA, and can you run them together?**

Answer: HPA (Horizontal Pod Autoscaler) and VPA (Vertical Pod Autoscaler) address scaling along different axes. HPA changes the number of pod replicas — it adds more identical pods when demand rises and removes them when demand falls. VPA changes the size of each individual pod by adjusting the resource requests and limits — it makes pods bigger or smaller based on historical and current usage patterns. HPA is best suited for stateless, horizontally scalable services where running multiple replicas distributes load. VPA is best suited for stateful workloads or services that cannot scale horizontally, where the goal is right-sizing rather than adding copies. Running them together is possible but requires care. You must not run both HPA and VPA on the same resource metric simultaneously — specifically, do not use HPA on CPU while VPA manages CPU requests. When VPA reduces a pod's CPU request, HPA sees higher CPU utilisation percentage (since the request denominator shrank), which causes HPA to scale out, which causes VPA to see lower per-pod usage, which causes VPA to lower requests further — a destabilising feedback loop. The safe combination is VPA managing CPU and memory right-sizing while HPA scales on custom metrics (request rate, queue depth) that are independent of resource requests.

---

**Q: How does KEDA differ from standard HPA, and when would you choose it?**

Answer: Standard HPA can only scale based on resource metrics (CPU, memory) served by metrics-server, or custom metrics served by a custom metrics adapter like Prometheus Adapter. This covers most stateless web services but is insufficient for event-driven architectures. KEDA (Kubernetes Event-Driven Autoscaling) extends HPA by adding support for external event sources as scaling triggers — Kafka consumer lag, SQS queue depth, RabbitMQ queue length, database row count, HTTP request rate, Prometheus queries, Datadog metrics, and dozens more via a plugin architecture. KEDA's most important capability that standard HPA lacks is **scale to zero**: when there are no events to process (empty Kafka topic, empty SQS queue), KEDA can scale the Deployment to zero replicas, eliminating the compute cost entirely. When events arrive, KEDA scales from zero to the required number of replicas within seconds. Choose KEDA when your workload is driven by external events rather than internal CPU/memory pressure, when you want scale-to-zero for cost optimisation (particularly useful for batch processing workloads), or when you need to scale based on business metrics exposed via Prometheus or external systems rather than infrastructure metrics.

---

**Q: What prevents Cluster Autoscaler from scaling down a node?**

Answer: Cluster Autoscaler follows several safety rules before removing an underutilised node. If any of these conditions are present, CA will not scale down that node. First, if any pod on the node is not covered by a ReplicationController, ReplicaSet, Deployment, or StatefulSet (a standalone pod), CA will not evict it because it would not be rescheduled anywhere. Second, if evicting any pod would violate a PodDisruptionBudget — for example, a PDB with minAvailable=2 and only 2 replicas are running — CA will not proceed. Third, pods with local storage (volumes using `hostPath`, `emptyDir`, or local PVs with `WaitForFirstConsumer`) cannot be moved to another node, so CA will not evict them. Fourth, if the node has the annotation `cluster-autoscaler.kubernetes.io/scale-down-disabled=true`, it is explicitly excluded from scale-down. Fifth, if the pods on that node cannot fit anywhere else in the cluster — either because all other nodes are full or because the pods have node selectors, affinity rules, or tolerations that only match this specific node. The overprovisioning pattern addresses the scale-up latency issue: deploying placeholder pods with low priority that CA can evict quickly, freeing capacity for real workloads while a new node is being provisioned.

---

**Q: What is the HPA scaling formula and how does the stabilisation window prevent thrashing?**

Answer: The HPA uses a straightforward formula to calculate the desired replica count: `desiredReplicas = ceil(currentReplicas × (currentMetricValue / desiredMetricValue))`. For example, if 3 pods are running with average CPU at 90% and the target is 50%, the calculation is `ceil(3 × (90/50)) = ceil(5.4) = 6` replicas. This formula works the same way for scale-down: if 6 pods are running at 20% CPU with a 50% target, `ceil(6 × (20/50)) = ceil(2.4) = 3` replicas. Without protection, this could cause **thrashing** — rapid alternating between scaling up and down as metrics fluctuate around the threshold. The stabilisation window prevents this. For scale-down (`stabilizationWindowSeconds: 300` by default), HPA maintains a rolling window of all desired replica counts calculated in the past 300 seconds and uses the maximum value in that window as the actual target. This means even if a 10-second spike temporarily required 8 replicas, HPA will not scale back down until the entire 5-minute window shows that 8 replicas are no longer needed. Scale-up has a much shorter stabilisation window (0 by default, configurable) because you generally want to respond to increased demand quickly. The `behavior.scaleDown.policies` field adds further control — for example, limiting scale-down to 1 pod per minute prevents a runaway scale-down event from terminating too many pods at once.

---

**Q: How does KEDA achieve scale-to-zero, and what are the latency implications?**

Answer: KEDA achieves scale-to-zero by taking over from standard HPA when the replica count needs to reach zero. Standard Kubernetes HPA has a minimum of 1 replica and cannot scale to zero. KEDA intercepts this: when the scaling trigger indicates there are no events to process (Kafka lag = 0, SQS queue empty), KEDA directly sets the Deployment's replica count to 0, bypassing HPA's minimum constraint. KEDA owns the replica count at this point. When events arrive again, KEDA detects them during its polling interval (configurable, default 15 seconds) and immediately scales the Deployment back up to at least 1 replica, at which point HPA takes over and scales further based on load. The latency implication is the **cold start penalty**: when events arrive and the Deployment is at zero, there is a delay of: KEDA polling interval (up to 15s) + pod scheduling time (seconds) + container startup time (seconds to minutes depending on image size and application startup). For latency-sensitive workloads, scale-to-zero is inappropriate. For batch processing workloads where processing a message within 30–60 seconds is acceptable, scale-to-zero provides significant cost savings — particularly for overnight batch jobs where the consumer can be at zero for 16 hours per day. The `cooldownPeriod` setting controls how long KEDA waits after the last event before scaling to zero, preventing rapid scale-to-zero during brief lulls in event traffic.
