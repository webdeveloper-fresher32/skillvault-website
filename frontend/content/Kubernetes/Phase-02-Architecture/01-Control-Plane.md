# Control Plane — Complete Guide

## Table of Contents
1. [Control Plane Overview](#1-control-plane-overview)
2. [kube-apiserver](#2-kube-apiserver)
3. [etcd](#3-etcd)
4. [kube-scheduler](#4-kube-scheduler)
5. [kube-controller-manager](#5-kube-controller-manager)
6. [cloud-controller-manager](#6-cloud-controller-manager)
7. [How a Request Flows Through the Control Plane](#7-how-a-request-flows-through-the-control-plane)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Control Plane Overview

The control plane is the brain of a Kubernetes cluster. It makes all global decisions about the cluster — scheduling Pods, responding to events, and maintaining the cluster in the desired state.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Control Plane                                │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    kube-apiserver                             │   │
│  │  - Only component that reads/writes to etcd                  │   │
│  │  - REST API gateway for all cluster operations               │   │
│  │  - Handles authentication, authorisation, admission control  │   │
│  └────────────────────────┬──────────────────────────────────────┘   │
│                           │                                          │
│         ┌─────────────────┼──────────────────────┐                  │
│         │                 │                      │                  │
│  ┌──────▼───────┐  ┌──────▼────────┐  ┌──────────▼────────────┐    │
│  │    etcd      │  │kube-scheduler │  │kube-controller-manager │    │
│  │              │  │               │  │                        │    │
│  │ Distributed  │  │ Assigns Pods  │  │ Runs control loops:    │    │
│  │ key-value    │  │ to nodes      │  │  - ReplicaSet          │    │
│  │ store        │  │               │  │  - Deployment          │    │
│  │              │  │ Watches for   │  │  - Node                │    │
│  │ Source of    │  │ unscheduled   │  │  - Endpoint            │    │
│  │ truth for    │  │ Pods, picks   │  │  - Namespace           │    │
│  │ all state    │  │ best node     │  │  - many more           │    │
│  └──────────────┘  └───────────────┘  └────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │              cloud-controller-manager (optional)             │    │
│  │  Integrates with cloud provider APIs: LoadBalancers, volumes │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Control Plane in Production: High Availability

```
Production control plane — 3 nodes for HA:

  Control Plane Node 1  ─────┐
  Control Plane Node 2  ──────┼──▶  etcd cluster (Raft consensus)
  Control Plane Node 3  ─────┘

  API Server load balanced (one active, others standby — or all active)
  Scheduler: leader-elected (one active)
  Controller Manager: leader-elected (one active)

  If one control plane node fails, the others continue.
  etcd requires quorum: with 3 nodes, can lose 1 and still function.
```

---

## 2. kube-apiserver

The API Server is the **central hub** of the entire Kubernetes control plane. Every operation in Kubernetes goes through it.

### What It Does

```
kube-apiserver responsibilities:

1. REST API gateway
   - Exposes the Kubernetes API (HTTPS on port 6443)
   - kubectl, kubelets, controllers, and user apps all use this API

2. Authentication
   - Who are you? (X.509 certs, bearer tokens, OIDC, etc.)

3. Authorisation
   - Are you allowed to do this? (RBAC, ABAC, Webhook)

4. Admission control
   - Should this request be allowed / mutated?
   - Examples: PodSecurityAdmission, ResourceQuota, LimitRanger

5. Etcd gateway
   - Only component that reads/writes etcd
   - All others (scheduler, controllers, kubelet) talk to API Server
```

### API Server as the Single Source of Truth Interface

```
 kubectl          → API Server → etcd
 kubelet          → API Server → etcd
 Scheduler        → API Server → etcd
 Controllers      → API Server → etcd
 Your applications→ API Server → etcd (via in-cluster ServiceAccount)

Nothing talks directly to etcd except the API Server.
```

### API Request Lifecycle

```
kubectl apply -f pod.yaml
        │
        ▼
  kube-apiserver receives the request
        │
        ├─ 1. Authentication: valid token / certificate?
        │
        ├─ 2. Authorisation (RBAC): can this user CREATE pods?
        │
        ├─ 3. Admission controllers: validate/mutate the object
        │       - Set default values (LimitRanger)
        │       - Reject if quota exceeded (ResourceQuota)
        │       - Inject sidecar (MutatingWebhook)
        │
        ├─ 4. Schema validation: is the manifest valid?
        │
        └─ 5. Write to etcd → return 201 Created
```

### Interacting with the API Server Directly

```bash
# See all API groups
kubectl api-versions

# See all resources
kubectl api-resources

# Raw API request with kubectl proxy
kubectl proxy &                           # opens localhost:8001
curl http://localhost:8001/api/v1/pods    # list all pods

# Raw API with curl using credentials
APISERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
TOKEN=$(kubectl create token default --duration=1h)
curl -H "Authorization: Bearer $TOKEN" -k $APISERVER/api/v1/namespaces/default/pods
```

---

## 3. etcd

etcd is a **distributed, reliable key-value store** that Kubernetes uses as its database. All cluster state lives in etcd.

### What Is Stored in etcd

```
Everything in Kubernetes is stored in etcd:
  /registry/pods/default/my-pod
  /registry/deployments/default/my-deployment
  /registry/services/default/my-service
  /registry/configmaps/default/my-config
  /registry/secrets/default/my-secret
  /registry/nodes/worker-1
  ... every K8s object has a record in etcd
```

### etcd's Reliability Guarantee

```
etcd uses the Raft consensus algorithm:

  Node 1 (Leader) ─── replicate ──▶ Node 2
                  └── replicate ──▶ Node 3

  A write is committed only when a majority (quorum) acknowledges it.

  Quorum = (n/2) + 1

  etcd cluster size recommendations:
  ┌─────────────┬─────────┬──────────────────┐
  │ Total nodes │ Quorum  │ Failure tolerance │
  ├─────────────┼─────────┼──────────────────┤
  │      1      │    1    │       0          │
  │      3      │    2    │       1          │
  │      5      │    3    │       2          │
  │      7      │    4    │       3          │
  └─────────────┴─────────┴──────────────────┘

  Odd numbers only — even numbers don't increase tolerance
  and are susceptible to split-brain.
```

### etcd Backup (Critical in Production)

```bash
# Install etcdctl
export ETCDCTL_API=3

# Snapshot backup
etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify snapshot
etcdctl snapshot status /backup/etcd-snapshot.db --write-out=table

# Restore from snapshot (emergency)
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-backup
```

---

## 4. kube-scheduler

The scheduler is responsible for **assigning Pods to nodes**. When a Pod is created, it starts with no node assignment — the scheduler watches for these unscheduled Pods and picks the best node.

### Scheduling Process

```
New Pod created (node: <none>)
        │
        ▼
  kube-scheduler watches API Server for unscheduled Pods
        │
        ▼
  Filtering phase: "Which nodes CAN run this Pod?"
        │
        ├── Node has enough CPU and memory?
        ├── Node satisfies nodeSelector / nodeAffinity?
        ├── Node is not tainted (or Pod has matching toleration)?
        ├── PersistentVolume accessible from this node?
        └── Pods don't violate PodAffinity/AntiAffinity?
        │
        ▼
  Scoring phase: "Which feasible node is BEST?"
        │
        ├── Least requested resources (spread load)
        ├── Node affinity preferred rules
        ├── Inter-Pod affinity
        └── Image already cached on node (faster start)
        │
        ▼
  Highest-scoring node selected
        │
        ▼
  Scheduler writes node assignment to etcd via API Server
        │
        ▼
  kubelet on that node sees the binding, starts the Pod
```

### Influencing the Scheduler

```yaml
# nodeSelector: schedule on nodes with this label
spec:
  nodeSelector:
    disktype: ssd

# nodeAffinity: preferred scheduling
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["ap-southeast-2a"]

# podAntiAffinity: spread replicas across nodes
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: myapp
        topologyKey: kubernetes.io/hostname
```

---

## 5. kube-controller-manager

The controller manager runs a collection of **control loops** (controllers). Each controller watches the current state of the cluster and takes actions to drive it toward the desired state.

### Control Loop Pattern

```
Control Loop (reconciliation loop):

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   Observe      Compare      Act                         │
  │                                                         │
  │   Get actual   desired ≠    Take action to              │
  │   state   ──▶  actual?  ──▶ reconcile                   │
  │   from API     YES          (create/update/delete)      │
  │   Server        │                │                      │
  │                 ▼                ▼                       │
  │               Loop again     Update state               │
  │               (watch/poll)   via API Server             │
  └─────────────────────────────────────────────────────────┘

This loop runs continuously. It's how K8s is self-healing.
```

### Key Controllers

| Controller | What It Does |
|-----------|-------------|
| **ReplicaSet controller** | Ensures the correct number of Pod replicas are running |
| **Deployment controller** | Manages ReplicaSets for rolling updates and rollbacks |
| **Node controller** | Monitors node health; marks unreachable nodes; evicts Pods |
| **Endpoint controller** | Populates the Endpoints object (which Pods a Service routes to) |
| **Namespace controller** | Cleans up resources when a namespace is deleted |
| **ServiceAccount controller** | Creates default ServiceAccounts in new namespaces |
| **Job controller** | Ensures Jobs run to completion; retries on failure |
| **CronJob controller** | Creates Jobs on a schedule |
| **PVC controller** | Binds PersistentVolumeClaims to available PersistentVolumes |

### Real Example: ReplicaSet Controller

```
Desired state in etcd:    ReplicaSet my-rs, replicas=3
Actual state:             2 Pods running (one crashed)

ReplicaSet controller:
  1. Watches API Server for ReplicaSet and Pod events
  2. Counts Pods matching selector: found 2, want 3
  3. Creates 1 new Pod via API Server
  4. Scheduler assigns new Pod to a node
  5. kubelet starts the Pod
  6. Controller re-checks: found 3, want 3 ✓ Done
  7. Continues watching...
```

---

## 6. cloud-controller-manager

The cloud-controller-manager integrates Kubernetes with cloud provider APIs (AWS, GCP, Azure). It lets Kubernetes provision cloud resources automatically.

```
cloud-controller-manager responsibilities:

  Node controller (cloud):
    → When a node is deleted from the cluster, check if the
      underlying cloud VM still exists. If not, remove the node.

  Route controller:
    → Configure cloud network routes between nodes so Pods
      can communicate across nodes without extra hops.

  Service controller:
    → When a Service of type=LoadBalancer is created,
      provision an actual cloud load balancer (AWS ALB/NLB,
      GCP Load Balancer, Azure Load Balancer) automatically.

  Volume controller (now mostly in external CSI plugins):
    → Provision cloud storage volumes for PersistentVolumeClaims.
```

```bash
# When you create this Service:
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
  - port: 80
EOF

# cloud-controller-manager automatically:
# 1. Detects LoadBalancer Service
# 2. Calls cloud API to create a real load balancer (e.g., AWS NLB)
# 3. Updates Service status with the external IP/hostname:
kubectl get svc my-app
# NAME      TYPE           CLUSTER-IP    EXTERNAL-IP
# my-app    LoadBalancer   10.96.45.12   a1b2c3.elb.amazonaws.com
```

---

## 7. How a Request Flows Through the Control Plane

### Example: `kubectl apply -f deployment.yaml`

```
Step 1: kubectl reads kubeconfig, contacts kube-apiserver

Step 2: kube-apiserver
  ├── Authenticates the request (client cert / token)
  ├── Authorises it (RBAC: can this user create Deployments?)
  ├── Runs admission controllers (defaults, quotas, webhooks)
  ├── Validates the Deployment object schema
  └── Writes Deployment to etcd
           ↓
        etcd stores:
        /registry/deployments/default/my-deploy = {spec: {replicas: 3, ...}}

Step 3: Deployment controller (in kube-controller-manager) sees new Deployment
  └── Creates a ReplicaSet
       ↓
     kube-apiserver writes ReplicaSet to etcd

Step 4: ReplicaSet controller sees new ReplicaSet (wants 3 Pods, has 0)
  └── Creates 3 Pod objects (status: Pending, no node assigned)
       ↓
     kube-apiserver writes Pods to etcd

Step 5: kube-scheduler sees 3 unscheduled Pods
  ├── Filters nodes → picks best node for each Pod
  └── Writes node binding to etcd via kube-apiserver
       ↓
     Pod spec now has: nodeName: worker-2

Step 6: kubelet on worker-2 watches API Server
  ├── Sees a Pod assigned to it
  ├── Calls container runtime (containerd) to pull image + start container
  └── Reports back: Pod is Running
       ↓
     kube-apiserver updates Pod status in etcd

Final state: 3 Pods running on worker nodes. Deployment complete.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Inspect control plane component status. Run `kubectl get componentstatuses` (or `kubectl get cs`). If using minikube, run `kubectl get pods -n kube-system` to see control plane Pods. Identify which Pods correspond to: apiserver, etcd, scheduler, controller-manager.

**Exercise 2:** Watch the scheduler at work. Open two terminals. In terminal 1, run: `kubectl get pods -w`. In terminal 2, create a deployment: `kubectl create deployment test --image=nginx --replicas=3`. Watch the Pods appear with status Pending, then ContainerCreating, then Running.

**Exercise 3:** Explore the API Server directly. Run `kubectl proxy` in one terminal. In another, use curl to query the API: `curl http://localhost:8001/api/v1/namespaces/default/pods`. Compare the JSON response to what `kubectl get pods -o json` returns.

**Exercise 4:** Examine controller activity. Create a deployment with 3 replicas. Then manually delete one of the Pods. Watch the ReplicaSet controller create a replacement: `kubectl delete pod <name>` then immediately run `kubectl get pods -w`. Time how long it takes for the replacement to reach Running status.

**Exercise 5:** In minikube or a kubeadm cluster, examine etcd directly. Run: `kubectl exec -n kube-system etcd-minikube -- etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/server.crt --key=/var/lib/minikube/certs/etcd/server.key get /registry/deployments/default --prefix --keys-only` — list all Deployment keys in etcd.

---

## 9. Interview Q&A

**Q: What are the main components of the Kubernetes control plane?**
Answer: The control plane has four core components: (1) kube-apiserver — the REST API gateway; the only component that reads/writes etcd; handles authentication, authorisation, and admission control. (2) etcd — the distributed key-value store that holds all cluster state. (3) kube-scheduler — watches for unscheduled Pods and assigns them to the best node via filtering and scoring. (4) kube-controller-manager — runs all the reconciliation control loops (ReplicaSet, Deployment, Node, Endpoint controllers, etc.). Cloud-hosted clusters also add the cloud-controller-manager for cloud provider integration.

**Q: Why is etcd so important in Kubernetes?**
Answer: etcd is the single source of truth for the entire cluster. Every Kubernetes object — Pods, Deployments, Services, Secrets, ConfigMaps, node state — is stored in etcd. If etcd is lost without a backup, the entire cluster configuration is gone. This is why production clusters run a 3- or 5-node etcd cluster with regular snapshots. The API Server is the only component that reads and writes etcd; all others go through the API Server.

**Q: How does the kube-scheduler decide which node to assign a Pod to?**
Answer: The scheduler uses a two-phase process. First, filtering eliminates nodes that cannot satisfy the Pod's requirements (insufficient CPU/memory, missing labels for nodeSelector, active taints without tolerations, PV topology constraints). Second, scoring ranks the remaining feasible nodes using multiple weighted criteria (least requested resources, affinity preferences, image locality). The highest-scoring node wins. If multiple nodes tie, one is chosen at random.

**Q: What is a controller in Kubernetes and what is the reconciliation pattern?**
Answer: A controller is a control loop that continuously watches the current state of specific resources via the API Server, compares it to the desired state, and takes actions to converge them. For example, the ReplicaSet controller ensures the actual number of running Pods always matches spec.replicas — if a Pod crashes, the controller creates a new one. This "observe → compare → act → repeat" loop is the reconciliation pattern, and it's how Kubernetes is self-healing.

**Q: What does the cloud-controller-manager do?**
Answer: The cloud-controller-manager decouples cloud-provider-specific logic from the core Kubernetes control plane. It runs controllers that integrate with cloud APIs: the Node controller removes nodes from the cluster when the underlying cloud VM is terminated; the Service controller provisions real cloud load balancers (AWS NLB, GCP LB) when a Service of type=LoadBalancer is created; the Route controller configures cloud network routes. This allows the core K8s components to remain cloud-agnostic.
