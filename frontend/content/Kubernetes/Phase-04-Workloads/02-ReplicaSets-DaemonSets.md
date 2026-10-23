# ReplicaSets & DaemonSets — Complete Guide

## Table of Contents
1. [What is a ReplicaSet](#1-what-is-a-replicaset)
2. [ReplicaSet Reconciliation Loop](#2-replicaset-reconciliation-loop)
3. [Why You Rarely Use ReplicaSet Directly](#3-why-you-rarely-use-replicaset-directly)
4. [Label Selector Matching](#4-label-selector-matching)
5. [What is a DaemonSet](#5-what-is-a-daemonset)
6. [DaemonSet Spec YAML](#6-daemonset-spec-yaml)
7. [DaemonSet Update Strategies](#7-daemonset-update-strategies)
8. [Node Selectors and Tolerations with DaemonSets](#8-node-selectors-and-tolerations-with-daemonsets)
9. [kubectl Commands](#9-kubectl-commands)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is a ReplicaSet

A **ReplicaSet** is a Kubernetes controller whose sole job is to ensure that a specified number of Pod replicas are running at any given time. If too few Pods exist, it creates more. If too many exist, it deletes the excess.

### Core Purpose

```
ReplicaSet guarantees:

  desired replicas = 3
  ┌─────────────────────────────────────────────────┐
  │  Pod A  (running)   ✓                           │
  │  Pod B  (running)   ✓                           │
  │  Pod C  (running)   ✓  ← Always maintaining N  │
  └─────────────────────────────────────────────────┘

  If Pod B crashes:
  ┌─────────────────────────────────────────────────┐
  │  Pod A  (running)   ✓                           │
  │  Pod B  (crashed)   ✗  ← RS detects deficit     │
  │  Pod D  (creating)  ↻  ← RS creates replacement │
  └─────────────────────────────────────────────────┘
```

### How Selector Matching Works

A ReplicaSet uses a **label selector** to identify which Pods it owns. It counts all Pods in the same namespace that match the selector and compares that count to `spec.replicas`. The selector is set once at creation and is **immutable** after that.

### Full ReplicaSet YAML Example

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend-rs
  namespace: default
  labels:
    app: frontend
    tier: web
spec:
  replicas: 3                        # Desired number of Pod copies
  selector:
    matchLabels:
      app: frontend                  # RS owns any Pod with this label
  template:                          # Pod template — RS creates Pods from this
    metadata:
      labels:
        app: frontend                # Must match spec.selector.matchLabels
        tier: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "250m"
            memory: "256Mi"
```

Key rules:
- `spec.selector` must match `spec.template.metadata.labels` exactly, or the API server rejects the resource
- The selector is immutable — you cannot change it after creation
- A ReplicaSet does not care how a matching Pod was created; it will adopt any Pod that matches its selector

---

## 2. ReplicaSet Reconciliation Loop

The ReplicaSet controller runs a continuous **reconciliation loop** inside the `kube-controller-manager`. It watches the API server for changes and acts to converge actual state to desired state.

```
┌────────────────────────────────────────────────────────────────────┐
│                   ReplicaSet Reconciliation Loop                   │
│                                                                    │
│   ┌──────────────────────────────────────┐                         │
│   │   1. OBSERVE DESIRED STATE           │                         │
│   │      Read spec.replicas from RS      │                         │
│   │      e.g. desired = 3               │                         │
│   └──────────────────┬───────────────────┘                         │
│                      │                                             │
│                      ▼                                             │
│   ┌──────────────────────────────────────┐                         │
│   │   2. OBSERVE ACTUAL STATE            │                         │
│   │      List Pods matching RS selector  │                         │
│   │      e.g. actual = 2 (one crashed)  │                         │
│   └──────────────────┬───────────────────┘                         │
│                      │                                             │
│                      ▼                                             │
│   ┌──────────────────────────────────────┐                         │
│   │   3. COMPUTE DIFF                    │                         │
│   │      diff = desired - actual         │                         │
│   │      diff = 3 - 2 = +1              │                         │
│   └──────────────────┬───────────────────┘                         │
│                      │                                             │
│          ┌───────────┴───────────┐                                 │
│          ▼                       ▼                                 │
│   ┌──────────────┐       ┌───────────────┐                         │
│   │  diff > 0    │       │   diff < 0    │                         │
│   │  CREATE Pods │       │  DELETE Pods  │                         │
│   │  (scale up)  │       │  (scale down) │                         │
│   └──────┬───────┘       └───────┬───────┘                         │
│          │                       │                                 │
│          └───────────┬───────────┘                                 │
│                      │                                             │
│                      ▼                                             │
│   ┌──────────────────────────────────────┐                         │
│   │   4. WAIT FOR NEXT EVENT             │                         │
│   │      (Pod created, deleted,          │                         │
│   │       RS spec changed, etc.)         │                         │
│   └──────────────────┬───────────────────┘                         │
│                      │                                             │
│                      └──────────────────────────────┐  (loop)     │
│                                                      ▼             │
│                                         Back to step 1             │
└────────────────────────────────────────────────────────────────────┘
```

The controller is **level-triggered**, not edge-triggered. It re-evaluates the full state on every event, not just deltas. This means even if multiple Pods crash simultaneously, the controller handles them all in one reconciliation pass.

Events that trigger reconciliation:
- A Pod matching the selector is deleted or crashes
- A Pod with matching labels is created outside the RS (Pod adoption)
- `spec.replicas` is updated via `kubectl scale`
- A node becomes unavailable, making its Pods `Unknown`

---

## 3. Why You Rarely Use ReplicaSet Directly

In practice, you almost never write a ReplicaSet manifest yourself. **Deployments** manage ReplicaSets on your behalf and add critical capabilities on top:

```
Deployment
│
├── Owns and manages ReplicaSets
│   │
│   ├── ReplicaSet (current — revision 3)   ← running 3 pods
│   ├── ReplicaSet (previous — revision 2)  ← scaled to 0, kept for rollback
│   └── ReplicaSet (older — revision 1)     ← scaled to 0, kept for rollback
```

### What Deployment Adds on Top of ReplicaSet

| Feature | ReplicaSet | Deployment |
|---|---|---|
| Maintain N replicas | Yes | Yes (via RS) |
| Rolling update | No | Yes |
| Rollback to previous version | No | Yes |
| Rollout history | No | Yes |
| Pause/resume rollout | No | Yes |
| Update strategy (RollingUpdate/Recreate) | No | Yes |

### When You Interact with ReplicaSets Directly

You interact with ReplicaSets primarily for **debugging** — not for creating or modifying them:

```bash
# See all ReplicaSets — Deployment creates one per revision
kubectl get rs

# Example output:
NAME                      DESIRED   CURRENT   READY   AGE
frontend-7d9f8b6c4d       3         3         3       2d      ← active RS
frontend-6b8c7f5a3e       0         0         0       5d      ← old RS (rollback target)
frontend-5a7b6e4c2d       0         0         0       10d     ← older RS

# Inspect a specific RS
kubectl describe rs frontend-7d9f8b6c4d

# See which Deployment owns this RS
kubectl get rs frontend-7d9f8b6c4d -o yaml | grep -A5 ownerReferences
```

The `ownerReference` field on a ReplicaSet points back to the Deployment that created it. This is how Kubernetes tracks ownership throughout the object hierarchy: Deployment → ReplicaSet → Pod.

---

## 4. Label Selector Matching

Label selectors are the mechanism by which a ReplicaSet identifies which Pods it owns. There are two forms: `matchLabels` (simple equality) and `matchExpressions` (richer logic).

### matchLabels

Simple key-value equality. All listed labels must be present and equal on the Pod.

```yaml
selector:
  matchLabels:
    app: frontend
    environment: production
# Matches Pods that have BOTH:
#   app=frontend  AND  environment=production
# A Pod with app=frontend but environment=staging is NOT matched
```

### matchExpressions

Supports set-based operations. Each expression has a `key`, an `operator`, and optionally `values`.

```yaml
selector:
  matchExpressions:
  - key: app
    operator: In               # Pod must have app=frontend OR app=web
    values:
    - frontend
    - web
  - key: environment
    operator: NotIn            # Pod must NOT have environment=testing
    values:
    - testing
  - key: tier
    operator: Exists           # Pod must have the 'tier' label (any value)
  - key: deprecated
    operator: DoesNotExist     # Pod must NOT have the 'deprecated' label
```

Supported operators:
- `In` — label value must be one of the listed values
- `NotIn` — label value must not be any of the listed values
- `Exists` — label key must be present (any value)
- `DoesNotExist` — label key must be absent

### Gotchas: Pod Adoption and Orphaned Pods

**Pod Adoption**: If a bare Pod (created without any controller) has labels that match a ReplicaSet's selector, the RS will **adopt** it. The Pod gets an `ownerReference` pointing to the RS, and the RS counts it toward its desired replica count. This can cause surprise scale-downs if the RS was at capacity.

```
Scenario:
  RS desired = 3, currently running 3 Pods
  You manually create a Pod with matching labels
  RS now sees 4 matching Pods
  RS immediately deletes one Pod to return to 3
  (It may delete your manually-created Pod or one of its own)
```

**Orphaned Pods**: If you delete a ReplicaSet with `--cascade=orphan`, the RS is removed but its Pods continue running. These Pods have no owner and will not be rescheduled if they crash. A new RS with the same selector will then adopt them.

```bash
# Delete RS but leave its Pods running
kubectl delete rs frontend-rs --cascade=orphan

# Pods are now orphaned — no controller manages them
kubectl get pods -l app=frontend
# NAME                READY   STATUS    RESTARTS   AGE
# frontend-rs-x7k2p   1/1     Running   0          10m  ← orphaned
# frontend-rs-m9n3q   1/1     Running   0          10m  ← orphaned
# frontend-rs-p4r8t   1/1     Running   0          10m  ← orphaned
```

---

## 5. What is a DaemonSet

A **DaemonSet** ensures that a copy of a Pod runs on **every node** (or a subset of nodes) in the cluster. When a new node is added to the cluster, the DaemonSet controller automatically schedules its Pod on that node. When a node is removed, its Pod is garbage-collected.

### Core Use Cases

```
Cluster Node Infrastructure — one agent per node:

┌─────────────────────────────────────────────────────────────────────┐
│  Use Case              │  Example Tools                              │
│────────────────────────┼─────────────────────────────────────────── │
│  Log collection        │  Fluentd, Fluent Bit, Logstash             │
│  Node monitoring       │  Prometheus node-exporter, Datadog agent   │
│  Network plugins (CNI) │  Calico, Flannel, Weave, Cilium            │
│  Storage plugins       │  Ceph, GlusterFS node agents               │
│  Security agents       │  Falco, Sysdig agent                       │
│  Service mesh proxies  │  Linkerd, Consul Connect                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Three-Node Cluster DaemonSet Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                            │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │    Node 1        │  │    Node 2        │  │    Node 3        │ │
│  │  (worker)        │  │  (worker)        │  │  (worker)        │ │
│  │                  │  │                  │  │                  │ │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │ │
│  │  │  App Pod A │  │  │  │  App Pod B │  │  │  │  App Pod C │  │ │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │ │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │ │
│  │  │  App Pod D │  │  │  │  App Pod E │  │  │  │            │  │ │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │ │
│  │                  │  │                  │  │                  │ │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │ │
│  │  │  fluentd   │  │  │  │  fluentd   │  │  │  │  fluentd   │  │ │
│  │  │  (DS Pod)  │  │  │  │  (DS Pod)  │  │  │  │  (DS Pod)  │  │ │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│          ▲                      ▲                      ▲           │
│          └──────────────────────┴──────────────────────┘           │
│                    DaemonSet guarantees exactly                     │
│                    one Pod per node, always                         │
│                                                                     │
│  New Node 4 joins cluster:                                          │
│  ┌──────────────────┐                                               │
│  │    Node 4        │  ← DaemonSet controller auto-schedules        │
│  │  ┌────────────┐  │    a new fluentd Pod here immediately         │
│  │  │  fluentd   │  │                                               │
│  │  │  (DS Pod)  │  │                                               │
│  │  └────────────┘  │                                               │
│  └──────────────────┘                                               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. DaemonSet Spec YAML

A complete, annotated DaemonSet for running Fluentd as a log collector on every node, including the control plane:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: kube-system          # Infrastructure DaemonSets typically go here
  labels:
    app: fluentd
    component: logging
spec:
  selector:
    matchLabels:
      name: fluentd               # DS owns Pods with this label
  updateStrategy:
    type: RollingUpdate           # Update pods one node at a time
    rollingUpdate:
      maxUnavailable: 1           # At most 1 DS Pod can be down during update
  template:
    metadata:
      labels:
        name: fluentd             # Must match spec.selector.matchLabels
    spec:
      # Allow this DaemonSet to run on the control-plane node
      # (control-plane has a NoSchedule taint that normally blocks pods)
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      # Use host network for direct node-level network access (optional)
      # hostNetwork: true
      containers:
      - name: fluentd
        image: fluent/fluentd:v1.16
        # Fluentd needs read access to all container logs on the host
        volumeMounts:
        - name: varlog
          mountPath: /var/log     # Mounted from the host's /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        resources:
          requests:
            cpu: "100m"
            memory: "200Mi"
          limits:
            cpu: "500m"
            memory: "500Mi"
        env:
        - name: FLUENTD_ARGS
          value: "--no-supervisor -q"
      # Graceful termination — allow Fluentd to flush its buffers
      terminationGracePeriodSeconds: 30
      volumes:
      - name: varlog
        hostPath:
          path: /var/log          # Read logs directly from the node filesystem
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

Key annotations on this manifest:
- `namespace: kube-system` — infrastructure DaemonSets belong here alongside system components
- `tolerations` — the control-plane taint blocks regular Pods; this toleration overrides that so Fluentd runs everywhere
- `hostPath` volumes — DaemonSets commonly mount node filesystem paths to read logs, access devices, or expose metrics
- `terminationGracePeriodSeconds` — gives the log shipper time to flush buffered data before the Pod is killed

---

## 7. DaemonSet Update Strategies

DaemonSets support two update strategies, controlled by `spec.updateStrategy.type`.

### RollingUpdate (Default)

Pods are updated one node at a time. The controller deletes the old Pod on a node and creates the new Pod before moving to the next node.

```yaml
updateStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1    # How many DS pods can be down simultaneously
                         # Can be an absolute number or a percentage ("10%")
```

```
Rolling update sequence across 4 nodes:

Node 1: [old] → delete → [new]   ← updated first
Node 2: [old] → delete → [new]   ← updated after Node 1 is Ready
Node 3: [old] → delete → [new]   ← updated after Node 2 is Ready
Node 4: [old] → delete → [new]   ← updated last

maxUnavailable: 1 ensures only one node at a time loses its DS pod
maxUnavailable: 2 would update two nodes in parallel
```

### OnDelete

Pods are **not** automatically updated when the DaemonSet spec changes. The new spec is applied only when you manually delete a Pod on a node. This gives you full control over when each individual node gets the updated Pod.

```yaml
updateStrategy:
  type: OnDelete
  # No rollingUpdate block needed
```

```
OnDelete sequence:

Spec updated → No automatic action
                 ↓
You drain Node 1:  kubectl drain node1 --ignore-daemonsets
You delete Pod:    kubectl delete pod fluentd-node1-xxxx
DaemonSet creates new Pod with updated spec on Node 1
                 ↓
Repeat for each node on your schedule
```

**When to use OnDelete:**
- When you need to coordinate DaemonSet pod updates with manual node draining procedures
- When updating a low-level network plugin (CNI) where a bad update could disrupt all traffic on the node
- When the DaemonSet runs a storage agent and you want to ensure data is safely migrated before restarting
- In regulated environments where each node update requires manual sign-off

---

## 8. Node Selectors and Tolerations with DaemonSets

By default, a DaemonSet schedules a Pod on every node. You can restrict it to a subset of nodes using `nodeSelector`, `nodeAffinity`, or by relying on taints and tolerations.

### nodeSelector — Target Specific Nodes

```yaml
spec:
  template:
    spec:
      nodeSelector:
        gpu: "true"              # Only schedule on nodes with this label
      containers:
      - name: gpu-monitor
        image: nvidia/dcgm-exporter:latest
```

Label target nodes first:
```bash
kubectl label node node3 gpu=true
kubectl label node node4 gpu=true
# DaemonSet will only place pods on node3 and node4
```

### nodeAffinity — More Expressive Targeting

```yaml
spec:
  template:
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/os
                operator: In
                values:
                - linux
              - key: node-type
                operator: In
                values:
                - storage
                - storage-premium
```

### Tolerating the Control-Plane Taint

Control-plane nodes have a `NoSchedule` taint that prevents regular workloads from running there. DaemonSets for cluster-wide tools (logging, monitoring, CNI) need to tolerate it:

```yaml
spec:
  template:
    spec:
      tolerations:
      # Tolerate the control-plane NoSchedule taint
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      # Also tolerate the master taint (older Kubernetes versions)
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      # Tolerate nodes that are not yet ready (useful for CNI plugins)
      - key: node.kubernetes.io/not-ready
        operator: Exists
        effect: NoSchedule
```

### Targeting GPU Nodes — Full Example

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: nvidia-dcgm-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      name: nvidia-dcgm-exporter
  template:
    metadata:
      labels:
        name: nvidia-dcgm-exporter
    spec:
      nodeSelector:
        accelerator: nvidia-gpu     # Only GPU nodes
      tolerations:
      - key: nvidia.com/gpu         # GPU nodes often have a taint
        operator: Exists
        effect: NoSchedule
      containers:
      - name: exporter
        image: nvidia/dcgm-exporter:3.2.5-3.1.8-ubuntu20.04
        securityContext:
          runAsNonRoot: false
          runAsUser: 0
```

---

## 9. kubectl Commands

### ReplicaSet Commands

```bash
# List all ReplicaSets in the current namespace
kubectl get rs

# List with additional columns (node selector, container images)
kubectl get rs -o wide

# List across all namespaces
kubectl get rs -A

# Describe a specific ReplicaSet (events, conditions, owned pods)
kubectl describe rs <rs-name>

# Scale a ReplicaSet directly (not recommended — use Deployment instead)
kubectl scale rs <rs-name> --replicas=5

# List Pods owned by a specific ReplicaSet (using its selector)
kubectl get pods -l app=frontend

# Get the YAML of an existing ReplicaSet
kubectl get rs <rs-name> -o yaml

# Delete a ReplicaSet (also deletes its Pods by default)
kubectl delete rs <rs-name>

# Delete a ReplicaSet but keep its Pods running (orphan them)
kubectl delete rs <rs-name> --cascade=orphan
```

### DaemonSet Commands

```bash
# List all DaemonSets in the current namespace
kubectl get ds

# List with additional info (desired, current, ready, up-to-date, available)
kubectl get ds -o wide

# List DaemonSets across all namespaces
kubectl get ds -A

# Describe a DaemonSet in detail
kubectl describe ds <ds-name>

# Example output of kubectl get ds:
# NAME      DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
# fluentd   3         3         3       3            3           <none>          2d

# Watch DaemonSet rollout status in real time
kubectl rollout status ds/<ds-name>

# View rollout history
kubectl rollout history ds/<ds-name>

# Roll back a DaemonSet update to the previous revision
kubectl rollout undo ds/<ds-name>

# Roll back to a specific revision
kubectl rollout undo ds/<ds-name> --to-revision=2

# Pause a DaemonSet rollout
kubectl rollout pause ds/<ds-name>

# Resume a paused DaemonSet rollout
kubectl rollout resume ds/<ds-name>

# List Pods created by a DaemonSet (using its label selector)
kubectl get pods -l name=fluentd -o wide

# Check which node each DaemonSet Pod is running on
kubectl get pods -l name=fluentd -o wide | awk '{print $1, $7}'

# Delete a single DaemonSet Pod (controller will recreate it)
kubectl delete pod <ds-pod-name>

# Update DaemonSet image (triggers rolling update if strategy is RollingUpdate)
kubectl set image ds/<ds-name> <container>=<new-image>
```

---

## 10. Hands-On Exercises

**Exercise 1: Create a ReplicaSet and Observe Reconciliation**

Create a ReplicaSet with 3 replicas, then manually delete one Pod and watch the RS recreate it automatically.

```bash
# Apply the ReplicaSet
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: demo-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
EOF

# Verify 3 pods are running
kubectl get pods -l app=demo

# Delete one pod by name
kubectl delete pod <one-of-the-pod-names>

# Immediately watch — RS creates a replacement
kubectl get pods -l app=demo -w

# Verify the RS events show the creation
kubectl describe rs demo-rs | grep -A20 Events
```

**Exercise 2: Inspect a ReplicaSet Created by a Deployment**

Deploy a Deployment and explore the ReplicaSet it creates, including owner references.

```bash
# Create a Deployment
kubectl create deployment nginx-deploy --image=nginx:1.25 --replicas=2

# List ReplicaSets — see the one created by the Deployment
kubectl get rs

# Inspect the ownerReference — links RS back to Deployment
kubectl get rs <rs-name> -o jsonpath='{.metadata.ownerReferences}' | python3 -m json.tool

# Update the Deployment image — creates a NEW RS
kubectl set image deployment/nginx-deploy nginx=nginx:1.26

# See two RSes now: old (0 replicas) and new (2 replicas)
kubectl get rs
```

**Exercise 3: Deploy a DaemonSet and Verify One Pod Per Node**

```bash
# Apply a simple DaemonSet
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-checker
  namespace: default
spec:
  selector:
    matchLabels:
      name: node-checker
  template:
    metadata:
      labels:
        name: node-checker
    spec:
      containers:
      - name: checker
        image: busybox:1.35
        command: ["sh", "-c", "while true; do echo Running on $(hostname); sleep 60; done"]
EOF

# Verify exactly one Pod per node
kubectl get pods -l name=node-checker -o wide

# Count nodes and compare to DaemonSet pod count
kubectl get nodes --no-headers | wc -l
kubectl get ds node-checker

# Check DaemonSet DESIRED == number of nodes
kubectl describe ds node-checker | grep -E "Desired|Current|Ready"
```

**Exercise 4: Use nodeSelector to Target Specific Nodes**

```bash
# Label a specific node
kubectl label node <node-name> disk=ssd

# Update the DaemonSet to only run on SSD nodes
kubectl patch ds node-checker --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/nodeSelector","value":{"disk":"ssd"}}]'

# Watch pods being evicted from non-SSD nodes
kubectl get pods -l name=node-checker -o wide -w

# Add the label to another node
kubectl label node <another-node> disk=ssd

# DaemonSet automatically schedules a pod on the newly-labeled node
kubectl get pods -l name=node-checker -o wide
```

**Exercise 5: Perform a DaemonSet Rolling Update**

```bash
# Check current image
kubectl get ds node-checker -o jsonpath='{.spec.template.spec.containers[0].image}'

# Update the DaemonSet image
kubectl set image ds/node-checker checker=busybox:1.36

# Watch the rolling update — one pod at a time
kubectl rollout status ds/node-checker

# View the rollout history
kubectl rollout history ds/node-checker

# If something goes wrong, roll back
kubectl rollout undo ds/node-checker

# Verify rollback completed
kubectl rollout status ds/node-checker
kubectl get ds node-checker -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## 11. Interview Q&A

**Q: What is a ReplicaSet and how does its reconciliation loop work?**

Answer: A ReplicaSet is a Kubernetes controller that ensures a specified number of Pod replicas are running at all times. It uses a label selector to identify which Pods it owns, then continuously runs a reconciliation loop: it reads the desired replica count from its spec, counts the actual running Pods that match its selector, computes the difference, and either creates Pods (if too few) or deletes Pods (if too many) until actual matches desired. This loop runs inside `kube-controller-manager` and is triggered by any relevant event — a Pod crash, a node failure, or a manual scale operation.

**Q: Why do you use Deployments instead of ReplicaSets directly?**

Answer: Deployments add orchestration on top of ReplicaSets: rolling updates, rollback to any previous revision, pause/resume of rollouts, and configurable update strategies (RollingUpdate or Recreate). A Deployment manages a history of ReplicaSets — when you update a Deployment, it creates a new RS with the new Pod spec, scales it up, and scales the old RS down. This gives you zero-downtime updates and a clean rollback path. A raw ReplicaSet has no concept of update history — changing its Pod template does not affect already-running Pods. You interact with ReplicaSets directly mainly when debugging (checking which RS revision is active, inspecting owner references) but you never create or manage them directly.

**Q: What is a DaemonSet and what are its use cases?**

Answer: A DaemonSet ensures that exactly one copy of a Pod runs on every node in the cluster (or a subset defined by a nodeSelector). When a new node joins the cluster, the DaemonSet controller automatically schedules a Pod on it; when a node is removed, its Pod is cleaned up. DaemonSets are used for infrastructure-level agents that must run on every node: log collectors (Fluentd, Fluent Bit), metrics exporters (Prometheus node-exporter), CNI network plugins (Calico, Cilium), storage plugins, and security agents (Falco). These workloads need visibility into node-level resources — host filesystem, network interfaces, kernel metrics — which is why they run as DaemonSets rather than Deployments.

**Q: How does a DaemonSet differ from a Deployment in terms of scheduling?**

Answer: A Deployment schedules Pods based on resource availability — the scheduler places them wherever capacity exists, and you control replica count, not node placement. A DaemonSet bypasses normal scheduling and places exactly one Pod per node (matching the node selector), regardless of resource requests. DaemonSet Pods are created by the DaemonSet controller itself, not by the scheduler in the traditional sense — the controller sets the `nodeName` field directly on each Pod spec, binding it to a specific node. This means DaemonSet Pods can also tolerate taints that would block regular Pods (like the control-plane taint), which is important for cluster infrastructure that must run everywhere.

**Q: How do you run a DaemonSet on only specific nodes?**

Answer: There are two main approaches. First, use `nodeSelector` in the Pod template spec — the DaemonSet will only create Pods on nodes that have the specified label. You label the target nodes with `kubectl label node <name> key=value`, then set `spec.template.spec.nodeSelector: {key: value}` in the DaemonSet. Second, use `nodeAffinity` in the Pod template for more complex expressions — for example, targeting nodes where a label's value is in a set, or excluding nodes with certain labels. Additionally, if the target nodes have taints, you must add matching `tolerations` to the DaemonSet Pod spec, otherwise the Pod will not schedule on tainted nodes even if the nodeSelector matches.
