# Kubernetes Production Best Practices — Complete Guide

## Table of Contents
1. [High Availability & Multi-Zone](#1-high-availability--multi-zone)
2. [Pod Disruption Budgets](#2-pod-disruption-budgets)
3. [Topology Spread Constraints](#3-topology-spread-constraints)
4. [Pod Affinity & Anti-Affinity](#4-pod-affinity--anti-affinity)
5. [Graceful Shutdown](#5-graceful-shutdown)
6. [Resource & Quota Management](#6-resource--quota-management)
7. [GitOps & Change Management](#7-gitops--change-management)
8. [Disaster Recovery](#8-disaster-recovery)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. High Availability & Multi-Zone

### Why HA Requires Explicit Configuration

Kubernetes does not automatically distribute your workloads across availability zones. By default, the scheduler spreads pods across nodes using a simple bin-packing algorithm — but it has no concept of fault domains, zones, or racks. Two replicas of the same Deployment could land on two nodes in the same data centre, leaving your service offline if that zone fails. Making a service truly highly available requires explicit zone-awareness configuration.

```
Without zone awareness (dangerous):

  ┌──────────────────────────────────────────────────────────────────┐
  │                     Kubernetes Cluster                           │
  │                                                                  │
  │  ┌──────────────────────────┐   ┌───────────────────────────┐   │
  │  │   Zone: ap-southeast-2a  │   │  Zone: ap-southeast-2b    │   │
  │  │                          │   │                           │   │
  │  │  node-1   node-2         │   │  node-3   node-4          │   │
  │  │  pod/api  pod/api        │   │  (no api pods here)       │   │
  │  │  pod/api  ← all replicas │   │                           │   │
  │  │           in one zone!   │   │                           │   │
  │  └──────────────────────────┘   └───────────────────────────┘   │
  │                                                                  │
  │  Zone 2a outage → all api pods gone → service DOWN              │
  └──────────────────────────────────────────────────────────────────┘

With zone awareness (safe):

  ┌──────────────────────────────────────────────────────────────────┐
  │  ┌────────────────────────┐   ┌───────────────────────────────┐  │
  │  │  Zone: ap-southeast-2a │   │  Zone: ap-southeast-2b        │  │
  │  │  node-1    node-2      │   │  node-3    node-4             │  │
  │  │  pod/api   pod/api     │   │  pod/api   pod/api            │  │
  │  └────────────────────────┘   └───────────────────────────────┘  │
  │                                                                  │
  │  Zone 2a outage → 2 api pods still running in 2b → service UP   │
  └──────────────────────────────────────────────────────────────────┘
```

### Control Plane HA — etcd

A production control plane runs at least 3 etcd nodes across different availability zones. etcd uses the Raft consensus algorithm and requires a quorum of `(n/2)+1` nodes to continue operating. With 3 nodes, 1 can fail and the cluster continues. With 5 nodes, 2 can fail. Never run an even number of etcd nodes — a split-brain scenario (2 vs 2) causes both halves to stop accepting writes.

```
etcd HA sizing:

  ┌────────────────┬─────────────────┬───────────────────────────┐
  │  etcd nodes    │  Fault tolerance│  Notes                    │
  ├────────────────┼─────────────────┼───────────────────────────┤
  │  1 (dev only)  │  0 failures     │  Never use in production  │
  │  3             │  1 failure      │  Minimum for production   │
  │  5             │  2 failures     │  Recommended for critical  │
  │  7             │  3 failures     │  Very large clusters       │
  └────────────────┴─────────────────┴───────────────────────────┘

  etcd nodes should span 3 availability zones:
    etcd-0 → Zone A
    etcd-1 → Zone B
    etcd-2 → Zone C

  Loss of Zone A → etcd-1 and etcd-2 maintain quorum → cluster operational
```

### Node Group Configuration for Multi-Zone

On cloud providers (EKS, GKE, AKS), configure node groups to span multiple availability zones:

```
EKS node group configuration:
  Subnets: [subnet-zone-a, subnet-zone-b, subnet-zone-c]
  → ASG spans all 3 zones
  → New nodes launched in the zone with fewest existing nodes

  Node labels added automatically by cloud providers:
    topology.kubernetes.io/zone: ap-southeast-2a
    topology.kubernetes.io/region: ap-southeast-2
    node.kubernetes.io/instance-type: t3.large

  These labels are used by Topology Spread Constraints (see section 3)
```

---

## 2. Pod Disruption Budgets

### What Is a PodDisruptionBudget

A PodDisruptionBudget (PDB) is a policy that limits how many pods of a given application can be simultaneously unavailable during voluntary disruptions. A voluntary disruption is any deliberate action — draining a node for maintenance, upgrading the cluster, running `kubectl delete pod`, a Deployment rollout, or a Cluster Autoscaler scale-down.

Without a PDB, draining a node will evict all pods on that node simultaneously. If all your api replicas happen to be on the same node, you get a complete outage. A PDB prevents this by forcing the eviction process to wait until replacement pods are ready before continuing.

```
PDB enforcement during node drain:

  kubectl drain node-2
          │
          │  Kubernetes evaluates PDB for each pod being evicted
          ▼
  PDB: minAvailable=2, current running api pods=3

  Step 1: Can we evict api-7d9f4-x8kq from node-2?
    → Evicting it would leave 2 api pods running
    → 2 >= minAvailable(2) → YES, safe to evict
    → Pod evicted, replaced on another node

  Step 2: Can we evict api-7d9f4-qr2p from node-2?
    → pod from step 1 not yet Ready on new node
    → Evicting this would leave 1 api pod running
    → 1 < minAvailable(2) → NO, BLOCKED
    → kubectl drain waits until replacement is Ready

  Step 3: Replacement pod becomes Ready
    → 3 running again → safe to evict api-7d9f4-qr2p
    → Proceed with drain
```

### PDB YAML — minAvailable vs maxUnavailable

```yaml
# Option 1: minAvailable — at least N pods must always be running
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
  namespace: production
spec:
  minAvailable: 2                     # at least 2 pods must be up at all times
  selector:
    matchLabels:
      app: my-api
```

```yaml
# Option 2: maxUnavailable — at most N pods can be down at once
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb-max
  namespace: production
spec:
  maxUnavailable: 1                   # at most 1 pod can be unavailable at once
  selector:
    matchLabels:
      app: my-api
```

```yaml
# Option 3: percentage-based (useful when replica count changes dynamically)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb-percent
  namespace: production
spec:
  minAvailable: "75%"                 # at least 75% of pods must be available
  selector:
    matchLabels:
      app: my-api
```

### PDB for Stateful Applications

StatefulSets need careful PDB configuration. For a 3-replica database cluster using Raft or Paxos consensus, losing more than 1 node at a time breaks quorum.

```yaml
# PDB for a 3-node Kafka StatefulSet
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: kafka-pdb
  namespace: production
spec:
  maxUnavailable: 1                   # never remove more than 1 Kafka broker at once
  selector:
    matchLabels:
      app: kafka
```

```bash
# Check PDB status — see current disruptions allowed
kubectl get pdb -n production

# Example output:
# NAME       MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
# api-pdb    2               N/A               1                     5d
# kafka-pdb  N/A             1                 1                     5d

# ALLOWED DISRUPTIONS = how many pods can currently be disrupted safely
```

---

## 3. Topology Spread Constraints

### Why Topology Spread Constraints

Pod anti-affinity (section 4) can prevent two pods from landing on the same node, but it becomes unwieldy for large deployments and cannot express balanced spreading across zones. Topology Spread Constraints provide a declarative way to specify how pods should be distributed across any topology boundary (zone, node, rack), with a configurable skew tolerance.

```
Topology Spread Constraints concept:

  maxSkew: 1 across topologyKey: topology.kubernetes.io/zone

  Current state (bad — unbalanced):
    Zone A: pod pod pod pod   (4 pods)
    Zone B: pod               (1 pod)
    Zone C:                   (0 pods)
    Skew = max - min = 4 - 0 = 4  ← exceeds maxSkew of 1

  Desired state (good — balanced):
    Zone A: pod pod           (2 pods)
    Zone B: pod pod           (2 pods)
    Zone C: pod pod           (2 pods)
    Skew = max - min = 2 - 2 = 0  ← within maxSkew of 1
```

### Topology Spread Constraints YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
  namespace: production
spec:
  replicas: 6
  selector:
    matchLabels:
      app: my-api
  template:
    metadata:
      labels:
        app: my-api
    spec:
      topologySpreadConstraints:
      # Spread evenly across availability zones
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule      # block if spreading not possible
        labelSelector:
          matchLabels:
            app: my-api

      # Also spread across individual nodes (prevents 2 pods on same node)
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname
        whenUnsatisfiable: ScheduleAnyway     # prefer spreading, but allow if unavoidable
        labelSelector:
          matchLabels:
            app: my-api

      containers:
      - name: api
        image: my-api:1.0
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
```

### whenUnsatisfiable Options

```
DoNotSchedule:
  → Hard constraint: pod will stay Pending if the constraint cannot be satisfied
  → Use for zone spreading where you MUST have HA across zones
  → Risk: if you only have 2 zones and maxSkew=1, you cannot schedule
    more than 1 extra pod in one zone. If one zone is full, scheduling stops.

ScheduleAnyway:
  → Soft constraint: Kubernetes tries to satisfy it but will schedule anyway
  → Use for node-level spreading as a preference
  → The scheduler uses the constraint as a scoring factor
  → A pod will be placed on the "most spread" node but never blocked
```

```bash
# Verify topology spreading after deployment
kubectl get pods -n production -l app=my-api \
  -o custom-columns="NAME:.metadata.name,NODE:.spec.nodeName" | head -20

# Cross-reference node zones
kubectl get nodes -L topology.kubernetes.io/zone

# Check if any pods are Pending due to topology constraints
kubectl get pods -n production | grep Pending
kubectl describe pod <pending-pod> -n production | grep -A 5 "Events"
# Look for: "didn't match pod's node affinity/selector" or "topologySpreadConstraint"
```

---

## 4. Pod Affinity & Anti-Affinity

### Pod Anti-Affinity for Resilience

Pod anti-affinity tells the scheduler to avoid placing certain pods on the same node (or zone, or any topology domain) as other pods. The classic use case is ensuring replicas of the same Deployment never share a node — if that node fails, you still have replicas elsewhere.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-api
  template:
    metadata:
      labels:
        app: my-api
    spec:
      affinity:
        podAntiAffinity:
          # Hard anti-affinity: two api pods CANNOT share a node
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: my-api
            topologyKey: kubernetes.io/hostname

          # Soft anti-affinity: prefer api pods in different zones
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  app: my-api
              topologyKey: topology.kubernetes.io/zone

      containers:
      - name: api
        image: my-api:1.0
```

### requiredDuringScheduling vs preferredDuringScheduling

```
requiredDuringSchedulingIgnoredDuringExecution:
  → HARD rule: the scheduler will REFUSE to place the pod if the constraint
    cannot be satisfied
  → Pod will stay Pending indefinitely if no valid node exists
  → Use with caution: if you have 3 replicas and only 3 nodes, adding a 4th
    replica will make it Pending forever (no node without an existing pod)
  → IgnoredDuringExecution = if a pod already running violates the rule
    (e.g. node gets new label), it is NOT evicted

preferredDuringSchedulingIgnoredDuringExecution:
  → SOFT rule: the scheduler TRIES to satisfy it but places the pod anyway
    on the best available node if no perfect match exists
  → weight (1-100): higher weight = stronger preference
  → Multiple preferred rules are summed for scoring
  → Never blocks scheduling — safe to use as a spreading preference
```

### Pod Affinity — Co-Locating Related Pods

Pod affinity (not anti-affinity) places pods close to other pods. Use this when two services have high network traffic between them and co-location on the same node reduces latency.

```yaml
# Place the cache pod on the same node as the api pod it serves
affinity:
  podAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 80
      podAffinityTerm:
        labelSelector:
          matchLabels:
            app: my-api           # co-locate with api pods
        topologyKey: kubernetes.io/hostname
```

### Node Affinity — Target Specific Node Types

```yaml
# Only schedule on nodes with SSDs (for I/O-intensive workloads)
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
          - m5d.large    # local NVMe SSD instance
          - m5d.xlarge

    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
        - key: topology.kubernetes.io/zone
          operator: In
          values:
          - ap-southeast-2a
```

---

## 5. Graceful Shutdown

### The Graceful Termination Sequence

When a pod is terminated — through a deployment update, node drain, scale-down, or `kubectl delete` — Kubernetes follows a specific sequence designed to prevent dropped requests and data loss.

```
Pod termination sequence:

  kubectl delete pod / drain node / deployment rollout
            │
            ▼
  1. Pod moves to Terminating state
     ┌──────────────────────────────────────────────┐
     │  Kubernetes performs two actions in PARALLEL: │
     │                                              │
     │  A. Send SIGTERM to container PID 1          │
     │     Container begins graceful shutdown       │
     │                                              │
     │  B. Remove pod from Service Endpoints        │
     │     No new traffic will be routed to this pod│
     └──────────────────────────────────────────────┘
            │
            │  terminationGracePeriodSeconds (default: 30s)
            │
  2. Container handles SIGTERM:
     - Stop accepting new connections
     - Finish processing in-flight requests
     - Flush buffers, close DB connections
     - Exit cleanly (exit 0)
            │
  3. If container still running after grace period:
     SIGKILL is sent (forced kill, exit 137)
            │
  4. Container storage is removed
     Pod removed from API server
```

### The Endpoint Removal Race Condition

There is a subtle but important race condition in the termination sequence. Steps A and B happen in parallel, but endpoint removal (B) takes time to propagate through kube-proxy to all nodes. A load balancer or other pods may continue routing traffic to the terminating pod for a second or two after SIGTERM is sent.

The solution is the `preStop` hook with a `sleep`:

```yaml
spec:
  containers:
  - name: api
    image: my-api:1.0
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
    # preStop runs BEFORE SIGTERM is sent
    # This 5-second delay gives kube-proxy time to propagate the
    # endpoint removal before the container stops accepting connections
```

```
With preStop sleep:

  Pod enters Terminating state
        │
        │  preStop hook runs: sleep 5
        │  (endpoint removal propagates during this time)
        ▼
  SIGTERM sent to container
  Container closes listener, drains in-flight requests
        │
        │  in-flight requests complete
        ▼
  Container exits cleanly
```

### terminationGracePeriodSeconds

```yaml
spec:
  terminationGracePeriodSeconds: 60   # allow up to 60 seconds for graceful shutdown
  containers:
  - name: api
    image: my-api:1.0
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
```

```
terminationGracePeriodSeconds guidelines:

  Default: 30 seconds (usually sufficient for web services)

  Increase to 60-120s for:
    - Services with long-running streaming requests
    - Services that process jobs that must complete atomically
    - Batch workers that must finish a unit of work before stopping

  Increase to 300s+ for:
    - Database pods that need to flush WAL, close connections
    - ML training jobs that must checkpoint before stopping

  Note: preStop hook duration counts against the grace period
  If preStop runs for 5s and app shutdown takes 25s, total = 30s
  → Default grace period is just enough. Set to 60s for safety.
```

### minReadySeconds and readinessGates

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  minReadySeconds: 10           # pod must be ready for 10s before being counted
                                # as available; rolling update waits for this
  template:
    spec:
      containers:
      - name: api
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5    # wait 5s before first probe
          periodSeconds: 5          # probe every 5 seconds
          failureThreshold: 3       # fail after 3 consecutive failures
          successThreshold: 1       # pass after 1 success
```

```
minReadySeconds effect on rolling deployments:

  Without minReadySeconds=0 (default):
    New pod becomes Ready → immediately marked available
    → Next pod in the rolling update starts terminating

  With minReadySeconds=10:
    New pod becomes Ready → wait 10 more seconds
    → If pod crashes within 10s (e.g. due to startup issue), it's
      still counted as unavailable and the rollout pauses
    → Provides buffer against intermittent startup failures
    → Use 5-30 seconds for production deployments
```

---

## 6. Resource & Quota Management

### Per-Namespace Multi-Tenancy Model

In a shared cluster serving multiple teams or applications, namespaces with ResourceQuotas and LimitRanges provide isolation — preventing one team's workload from consuming all cluster resources and starving others.

```
Multi-tenancy resource model:

  ┌─────────────────────────────────────────────────────────────────┐
  │  Cluster: 100 CPU cores, 400 Gi RAM                             │
  │                                                                 │
  │  ┌───────────────────────┐  ┌───────────────────────────────┐   │
  │  │  namespace: team-a    │  │  namespace: team-b            │   │
  │  │  ResourceQuota:       │  │  ResourceQuota:               │   │
  │  │    CPU:    0-30 cores │  │    CPU:    0-20 cores         │   │
  │  │    RAM:    0-120 Gi   │  │    RAM:    0-80 Gi            │   │
  │  │    pods: max 50       │  │    pods: max 30               │   │
  │  │                       │  │                               │   │
  │  │  LimitRange:          │  │  LimitRange:                  │   │
  │  │    default cpu: 500m  │  │    default cpu: 250m          │   │
  │  │    default mem: 256Mi │  │    default mem: 128Mi         │   │
  │  └───────────────────────┘  └───────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────┘
```

### Image Tagging Policy — No :latest in Production

```
Image tagging best practices:

  WRONG for production:
    image: my-api:latest
    → "latest" tag is mutable — it changes with every build
    → Two nodes could pull different images
    → If a bad image is pushed, pods restart with broken code
    → Impossible to know what code is actually running

  WRONG (mutable tag):
    image: my-api:v1.2
    → Semantic version tags can be accidentally overwritten

  RIGHT (immutable digest):
    image: my-api@sha256:a1b2c3d4e5f6...
    → SHA digest is immutable — always the exact same image
    → Auditable: you know exactly what code ran at any time
    → Cannot be tampered with by pushing a new image

  Practical compromise (good for most teams):
    image: my-api:1.2.3
    → Use precise patch versions
    → Enforce tag immutability in your container registry (ECR, GCR all support this)
    → Use SHA digest in production manifests generated by CI/CD

  kubectl get pod -o jsonpath='{.spec.containers[*].image}'
  # Shows the full image reference including digest if pulled that way
```

### Production ResourceQuota Example

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "80Gi"
    limits.cpu: "40"
    limits.memory: "160Gi"
    pods: "100"
    services: "30"
    persistentvolumeclaims: "50"
    secrets: "100"
    configmaps: "100"
    services.loadbalancers: "5"    # limit expensive LB services
    services.nodeports: "0"        # disallow NodePort in production
```

---

## 7. GitOps & Change Management

### GitOps Principles

GitOps is the practice of using Git as the single source of truth for the desired state of a Kubernetes cluster. Every change to the cluster — whether a new Deployment, a config change, or a scaling adjustment — is made via a pull request to a Git repository. An operator (ArgoCD or Flux) continuously reconciles the cluster's actual state with the Git-declared desired state.

```
GitOps workflow:

  Developer
    │
    │  git commit YAML change
    │  git push → pull request
    ▼
  Git repository (source of truth)
    │
    │  PR reviewed and merged
    ▼
  ArgoCD watches repository (sync every 3 minutes or via webhook)
    │
    │  Detects diff: desired state ≠ actual state
    ▼
  ArgoCD applies changes to cluster via kubectl / Helm
    │
    ▼
  Cluster state updated
    │
    ▼
  ArgoCD verifies: desired state == actual state → SYNCED

  Any manual kubectl apply is:
    - Immediately detected as drift by ArgoCD
    - Reverted to the Git state on next sync (if automated sync)
    - Flagged as OutOfSync in the ArgoCD UI (if manual sync)
```

### ArgoCD Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-api
  namespace: argocd
spec:
  project: production

  source:
    repoURL: https://github.com/myorg/k8s-manifests
    targetRevision: HEAD                     # track main branch
    path: apps/production/my-api             # path within the repo

  destination:
    server: https://kubernetes.default.svc   # in-cluster
    namespace: production

  syncPolicy:
    automated:
      prune: true                            # delete resources removed from Git
      selfHeal: true                         # revert manual changes automatically
    syncOptions:
    - CreateNamespace=true                   # create namespace if missing
    - PrunePropagationPolicy=foreground      # wait for child resources to delete
    - ApplyOutOfSyncOnly=true                # only sync resources that differ

  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas                         # ignore HPA-managed replica count
```

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get initial admin password
kubectl get secret argocd-initial-admin-secret \
  -n argocd -o jsonpath='{.data.password}' | base64 -d

# Check sync status from CLI
argocd app get my-api
argocd app sync my-api                       # manual sync
argocd app diff my-api                       # see what would change
```

---

## 8. Disaster Recovery

### etcd Backup

etcd is the cluster's brain — it stores the complete state of every Kubernetes object. Regular etcd backups are the foundation of disaster recovery. Without a recent backup, a failed cluster must be rebuilt from scratch.

```bash
# Take an etcd snapshot (run on an etcd node or via a Job)
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot-$(date +%Y%m%d-%H%M%S).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify the snapshot
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-snapshot-20260625-090000.db \
  --write-out=table

# Expected output:
# +----------+----------+------------+------------+
# |   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
# +----------+----------+------------+------------+
# | a1b2c3d4 |  1234567 |       4821 |     42 MB  |
# +----------+----------+------------+------------+
```

### etcd Restore Procedure

```bash
# Stop kube-apiserver (restore must happen with apiserver stopped)
# On kubeadm clusters: move apiserver manifest out of /etc/kubernetes/manifests/
mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/

# Restore the snapshot to a new data directory
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-snapshot-20260625-090000.db \
  --data-dir=/var/lib/etcd-restore \
  --name=master-1 \
  --initial-cluster=master-1=https://192.168.0.10:2380 \
  --initial-cluster-token=etcd-cluster-restore \
  --initial-advertise-peer-urls=https://192.168.0.10:2380

# Update etcd manifest to point to the new data directory
# /etc/kubernetes/manifests/etcd.yaml:
# --data-dir=/var/lib/etcd-restore

# Restart apiserver
mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/

# Verify cluster is operational
kubectl get nodes
kubectl get pods --all-namespaces
```

### Automated etcd Backup CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: etcd-backup
  namespace: kube-system
spec:
  schedule: "0 */6 * * *"              # every 6 hours
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          hostNetwork: true
          nodeSelector:
            node-role.kubernetes.io/control-plane: ""
          tolerations:
          - key: node-role.kubernetes.io/control-plane
            effect: NoSchedule
          containers:
          - name: etcd-backup
            image: registry.k8s.io/etcd:3.5.9-0
            command:
            - /bin/sh
            - -c
            - |
              ETCDCTL_API=3 etcdctl snapshot save \
                /backup/etcd-$(date +%Y%m%d-%H%M%S).db \
                --endpoints=https://127.0.0.1:2379 \
                --cacert=/etc/kubernetes/pki/etcd/ca.crt \
                --cert=/etc/kubernetes/pki/etcd/server.crt \
                --key=/etc/kubernetes/pki/etcd/server.key
              # Upload to S3 for off-cluster storage
              aws s3 cp /backup/etcd-*.db s3://my-cluster-backups/etcd/
            volumeMounts:
            - name: etcd-certs
              mountPath: /etc/kubernetes/pki/etcd
              readOnly: true
            - name: backup-dir
              mountPath: /backup
          volumes:
          - name: etcd-certs
            hostPath:
              path: /etc/kubernetes/pki/etcd
          - name: backup-dir
            hostPath:
              path: /var/etcd-backups
          restartPolicy: OnFailure
```

### Backup Strategy Summary

```
Backup what:
  1. etcd snapshots (cluster state)     → every 6 hours, retain 7 days
  2. PersistentVolume data              → use VolumeSnapshot or cloud backup
  3. Git repository (GitOps source)     → inherently backed up by Git + remotes
  4. Helm values files                  → stored in Git
  5. TLS certificates and secrets       → export secrets, encrypt at rest in S3
  6. Container images                   → stored in container registry

Recovery time objectives:
  New cluster from scratch + etcd restore:  ~30 minutes
  New cluster from scratch + GitOps sync:   ~1 hour (ArgoCD re-applies all)
  PV data restore from snapshot:            minutes to hours (depends on data size)
```

---

## 9. Hands-On Exercises

**Exercise 1: Create a PodDisruptionBudget and test it with kubectl drain**

```bash
# Deploy a 3-replica application
kubectl create deployment drain-demo --image=nginx:1.25 --replicas=3 -n default
kubectl wait deployment drain-demo --for=condition=available --timeout=60s

# Create a PDB requiring at least 2 pods to be available
kubectl apply -f - <<'EOF'
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: drain-demo-pdb
  namespace: default
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: drain-demo
EOF

kubectl get pdb drain-demo-pdb
# ALLOWED DISRUPTIONS should show: 1

# Drain a node (use a non-critical node in a test cluster)
NODE=$(kubectl get pods -l app=drain-demo -o wide --no-headers \
  | head -1 | awk '{print $7}')
echo "Draining node: $NODE"
kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data

# Observe: drain respects the PDB — it waits for replacement pods to be Ready
# before removing more pods from the node

# Uncordon the node
kubectl uncordon $NODE

# Clean up
kubectl delete deployment drain-demo
kubectl delete pdb drain-demo-pdb
```

---

**Exercise 2: Apply Topology Spread Constraints and verify zone distribution**

```bash
# This exercise requires a multi-node cluster with zone labels

# Check your nodes have zone labels
kubectl get nodes -L topology.kubernetes.io/zone

# Deploy with topology spread across zones
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zone-spread-demo
  namespace: default
spec:
  replicas: 6
  selector:
    matchLabels:
      app: zone-spread-demo
  template:
    metadata:
      labels:
        app: zone-spread-demo
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: zone-spread-demo
      containers:
      - name: app
        image: nginx:1.25
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
EOF

# Check pod distribution across zones
kubectl get pods -l app=zone-spread-demo -o wide

# Cross-reference which zone each node is in
kubectl get nodes -L topology.kubernetes.io/zone

# Count pods per zone
kubectl get pods -l app=zone-spread-demo -o wide --no-headers \
  | awk '{print $7}' | sort | uniq -c

kubectl delete deployment zone-spread-demo
```

---

**Exercise 3: Implement graceful shutdown with preStop hook and verify**

```bash
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: graceful-demo
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: graceful-demo
  template:
    metadata:
      labels:
        app: graceful-demo
    spec:
      terminationGracePeriodSeconds: 60
      containers:
      - name: app
        image: nginx:1.25
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5 && nginx -s quit"]
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 3
          periodSeconds: 3
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
EOF

kubectl rollout status deployment/graceful-demo

# Watch the graceful shutdown during a rolling update
# Trigger a rollout and observe pod lifecycle
kubectl set image deployment/graceful-demo app=nginx:1.26
kubectl rollout status deployment/graceful-demo -w

# Check rollout events to verify graceful shutdown occurred
kubectl describe deployment graceful-demo | grep -A 5 Events
kubectl delete deployment graceful-demo
```

---

**Exercise 4: Implement per-namespace ResourceQuota and LimitRange for multi-tenancy**

```bash
kubectl create namespace team-a
kubectl create namespace team-b

# Apply different quotas to each team namespace
for TEAM in team-a team-b; do
  LIMIT=$( [ "$TEAM" = "team-a" ] && echo "20" || echo "10" )
  kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ${TEAM}-quota
  namespace: ${TEAM}
spec:
  hard:
    requests.cpu: "${LIMIT}"
    requests.memory: "${LIMIT}0Gi"
    limits.cpu: "$((LIMIT * 2))"
    limits.memory: "$((LIMIT * 2))0Gi"
    pods: "20"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: ${TEAM}-limits
  namespace: ${TEAM}
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
EOF
done

kubectl describe resourcequota -n team-a
kubectl describe limitrange -n team-a

# Test: deploy a pod without resources → defaults are injected
kubectl run test-pod --image=nginx:1.25 -n team-a
kubectl get pod test-pod -n team-a \
  -o jsonpath='{.spec.containers[0].resources}' | python3 -m json.tool

kubectl delete namespace team-a team-b
```

---

**Exercise 5: Back up etcd and validate the snapshot**

```bash
# This exercise requires access to a kubeadm cluster control-plane node

# Check etcd pod is running
kubectl get pod -n kube-system -l component=etcd

# Get etcd connection details from the etcd pod spec
kubectl get pod -n kube-system -l component=etcd \
  -o jsonpath='{.items[0].spec.containers[0].command}' | tr ' ' '\n' \
  | grep -E 'endpoint|cert|key|ca'

# Create a backup directory
sudo mkdir -p /var/etcd-backups

# Take a snapshot (adjust cert paths for your cluster)
sudo ETCDCTL_API=3 etcdctl snapshot save \
  /var/etcd-backups/etcd-$(date +%Y%m%d-%H%M%S).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Validate the snapshot
sudo ETCDCTL_API=3 etcdctl snapshot status \
  /var/etcd-backups/etcd-*.db \
  --write-out=table

# Verify backup file exists and has non-zero size
ls -lh /var/etcd-backups/
```

---

## 10. Interview Q&A

**Q: What is a PodDisruptionBudget and when is it critical to have one?**

Answer: A PodDisruptionBudget (PDB) is a policy object that limits how many pods of an application can be simultaneously unavailable during voluntary disruptions — events where a person or system intentionally causes pod termination, such as draining a node for maintenance, upgrading the cluster, or Cluster Autoscaler removing an underutilised node. A PDB specifies either `minAvailable` (the minimum number or percentage of pods that must remain running) or `maxUnavailable` (the maximum number or percentage that can be down at once). During a voluntary disruption, the eviction API checks the PDB before terminating any pod. If removing the pod would violate the budget — for example, if `minAvailable=2` and only 2 pods are running — the eviction is blocked and `kubectl drain` will wait until the constraint can be satisfied. PDBs are critical for any stateful application where losing quorum would cause an outage (Kafka, Elasticsearch, etcd, PostgreSQL replicas) and for stateless services with low replica counts where simultaneously evicting two pods would cause downtime. A PDB is the primary protection against `kubectl drain` causing unplanned outages, and it is a required prerequisite for running Cluster Autoscaler safely in production.

---

**Q: How do Topology Spread Constraints differ from pod anti-affinity?**

Answer: Both Topology Spread Constraints and pod anti-affinity can spread pods across nodes and zones, but they work differently and have different capabilities. **Pod anti-affinity** is a binary rule: "do not place this pod on a node that already has a pod with this label selector." It prevents co-location but provides no control over the resulting distribution. With 6 replicas and anti-affinity against the same node, you just know no two pods share a node — they could all end up in the same zone. It also becomes difficult to manage when replica counts exceed node counts, because the hard anti-affinity rule blocks scheduling. **Topology Spread Constraints** are distribution rules: "the difference in pod count between any two topology domains (e.g. zones) must not exceed maxSkew." This directly controls the balance of pods across failure domains. With `maxSkew=1` across zones, the scheduler ensures pods are spread as evenly as possible — 2/2/2 for 6 pods across 3 zones, or 3/2 for 5 pods. The `whenUnsatisfiable` field controls whether the constraint is hard (DoNotSchedule) or soft (ScheduleAnyway). Topology Spread Constraints supersede pod anti-affinity for zone-spreading use cases in modern Kubernetes (v1.19+ GA). The recommended approach is to use Topology Spread Constraints for zone and host distribution, and reserve pod anti-affinity for specific co-location avoidance rules that are more nuanced than balanced spreading.

---

**Q: Describe the Kubernetes pod termination sequence and how you ensure zero-downtime deployments.**

Answer: When a pod is deleted or a rolling update removes it, Kubernetes follows a specific termination sequence. First, the pod is moved to a Terminating state and two things happen in parallel: the pod is removed from the Service's endpoint list (so no new traffic is routed to it), and SIGTERM is sent to the container's PID 1. The container has `terminationGracePeriodSeconds` (default 30) to handle SIGTERM gracefully — finish in-flight requests, close database connections, flush buffers. If the container is still running after the grace period, SIGKILL is sent. The critical issue for zero-downtime is that endpoint removal and SIGTERM happen concurrently, but endpoint propagation through kube-proxy takes 1–5 seconds. During that window, the container may receive SIGTERM and stop accepting connections while load balancers still route traffic to it — causing connection refused errors. The solution is a `preStop` lifecycle hook with a `sleep 5` command. preStop runs before SIGTERM is sent, giving endpoint removal time to propagate before the container stops accepting connections. Combined with a proper readinessProbe (so the new pod is not added to endpoints until truly ready) and `minReadySeconds` (so rolling updates wait before declaring a pod healthy and proceeding to the next), this ensures zero-downtime deployments where traffic is always served by at least one ready pod.

---

**Q: What is GitOps and what problem does it solve in Kubernetes operations?**

Answer: GitOps is an operational framework that uses Git as the single source of truth for the desired state of a Kubernetes cluster. Every Kubernetes manifest — Deployments, Services, ConfigMaps, Ingresses, RBAC — is stored in a Git repository. Changes to the cluster are made exclusively through pull requests, which are reviewed, approved, and merged. An operator like ArgoCD or Flux continuously watches the repository and reconciles the cluster's actual state to match the Git-declared desired state. The problem GitOps solves is drift and auditability. In a traditional workflow, operators run `kubectl apply` or `helm upgrade` manually or through ad-hoc scripts. Over time, the cluster's actual state diverges from what anyone documented — a developer applies a hotfix directly, someone scales a deployment manually, a ConfigMap is edited in place. Nobody knows what changed when or why. With GitOps, every change has a Git commit with an author, timestamp, and message. Rollback is `git revert`. Auditing is `git log`. If the cluster is destroyed, the entire state can be recreated by pointing ArgoCD at the repository. The `selfHeal: true` option in ArgoCD's sync policy means any manual `kubectl` change that diverges from Git is automatically reverted, enforcing Git as the authority. The `ignoreDifferences` configuration handles exceptions like HPA-managed replica counts where you don't want Git to override the autoscaler's decisions.

---

**Q: How do you back up and restore an etcd cluster, and what is the recovery procedure?**

Answer: etcd backup uses the `etcdctl snapshot save` command to create a point-in-time snapshot of the entire etcd database. The command requires the etcd endpoint (typically `https://127.0.0.1:2379` on the control-plane node), and the TLS certificates for authentication (`--cacert`, `--cert`, `--key` — found in `/etc/kubernetes/pki/etcd/` on kubeadm clusters). The snapshot is a single binary file containing all Kubernetes object state. Best practice is to automate snapshots via a CronJob every 6 hours, store them locally on the control-plane node, and additionally upload them to object storage (S3) for durability. To restore, the process has several critical steps: first, stop the kube-apiserver by removing its static pod manifest from `/etc/kubernetes/manifests/` — otherwise the apiserver may write to etcd during the restore and corrupt it. Then, run `etcdctl snapshot restore` with the snapshot file and a new data directory path, specifying the initial cluster configuration. Update the etcd static pod manifest to use the new data directory. The apiserver and etcd restart and the cluster state is restored to the snapshot point in time. Any changes made between the snapshot and the failure are lost. This is why frequent snapshots and a short RPO (Recovery Point Objective) are important. In a GitOps environment, the Kubernetes object manifests are recoverable from Git — but etcd also stores secrets, RBAC bindings, lease objects, and other runtime state that is not in Git, making etcd backups irreplaceable.
