# Worker Nodes — Complete Guide

## Table of Contents
1. [Worker Node Overview](#1-worker-node-overview)
2. [kubelet](#2-kubelet)
3. [kube-proxy](#3-kube-proxy)
4. [Container Runtime](#4-container-runtime)
5. [Node Registration and Lifecycle](#5-node-registration-and-lifecycle)
6. [Node Conditions and Health](#6-node-conditions-and-health)
7. [Taints and Tolerations (Introduction)](#7-taints-and-tolerations-introduction)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Worker Node Overview

Worker nodes are the machines that actually run your application containers. The control plane tells workers what to run; workers do the work.

```
┌────────────────────────────────────────────────────────────────────┐
│                          Worker Node                               │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Pods (your workloads)                    │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │    Pod A     │  │    Pod B     │  │    Pod C     │      │   │
│  │  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │      │   │
│  │  │ │container │ │  │ │container │ │  │ │container │ │      │   │
│  │  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │   kubelet    │   │  kube-proxy  │   │  Container Runtime   │   │
│  │              │   │              │   │  (containerd / CRI-O)│   │
│  │ Node agent   │   │ Network rules│   │                      │   │
│  │ Manages pods │   │ iptables /   │   │ Pulls images         │   │
│  │ Reports to   │   │ IPVS rules   │   │ Starts/stops         │   │
│  │ API Server   │   │ for Services │   │ containers           │   │
│  └──────────────┘   └──────────────┘   └──────────────────────┘   │
│                                                                    │
│  Operating System (Linux — Ubuntu, RHEL, etc.)                    │
│  Hardware / VM                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Worker Node vs Control Plane Node

```
Control Plane Node:   Runs K8s management processes
                      No application Pods scheduled here
                      (tainted with node-role.kubernetes.io/control-plane:NoSchedule)

Worker Node:          Runs your application Pods
                      Has no K8s API database (etcd)
                      Receives instructions from the control plane
                      Communicates via kubelet ↔ API Server
```

---

## 2. kubelet

The kubelet is the **primary node agent**. It runs on every worker node and is responsible for managing Pods assigned to that node.

### What kubelet Does

```
kubelet responsibilities:

1. Watches the API Server for Pods assigned to this node
2. Starts containers by calling the container runtime
3. Monitors container health via liveness probes
4. Reports Pod status back to the API Server
5. Mounts volumes into containers
6. Manages node-level resources and reports capacity
7. Runs static Pods (used by control plane components themselves)
```

### kubelet Pod Lifecycle

```
API Server: "Pod my-pod is assigned to worker-1, nodeName=worker-1"
                           │
                           ▼
              kubelet on worker-1 watches API Server
                           │
                           ▼
              kubelet sees the new Pod spec
                           │
                           ├─ Pull image (if not cached)
                           │   containerd pulls nginx:1.25 from registry
                           │
                           ├─ Set up Pod network (calls CNI plugin)
                           │   Assign Pod IP from cluster CIDR
                           │
                           ├─ Mount volumes into container
                           │
                           ├─ Start container via container runtime
                           │
                           ├─ Run health probes (liveness, readiness, startup)
                           │
                           └─ Report status to API Server:
                               Phase: Running
                               ContainerStatuses: [{ready: true, ...}]
```

### kubelet Configuration

```bash
# kubelet runs as a systemd service on worker nodes
systemctl status kubelet
systemctl restart kubelet

# kubelet config location (kubeadm clusters)
/var/lib/kubelet/config.yaml
/etc/kubernetes/kubelet.conf  # kubeconfig for kubelet

# View kubelet logs
journalctl -u kubelet -f

# kubelet listens on:
# Port 10250: HTTPS API (used by API Server to reach kubelet)
# Port 10255: Read-only HTTP (deprecated, metrics)
```

### Static Pods

Static Pods are a special feature of kubelet — it can manage Pods defined in a local directory without needing the API Server.

```
/etc/kubernetes/manifests/
├── kube-apiserver.yaml         ← API Server runs as a static Pod!
├── kube-controller-manager.yaml
├── kube-scheduler.yaml
└── etcd.yaml

kubelet watches this directory and starts/restarts Pods from these files.
This is how kubeadm bootstraps the control plane:
  - Control plane starts with no API Server
  - kubelet starts API Server as a static Pod from the manifest
  - Once API Server is running, everything else bootstraps normally

Static Pods always have the node name appended:
  kube-apiserver-minikube
  kube-scheduler-minikube
```

---

## 3. kube-proxy

kube-proxy runs on every node and maintains **network rules** that enable Pod-to-Service communication.

### What kube-proxy Does

```
When you create a Service, kube-proxy:
  1. Watches the API Server for Service and Endpoints changes
  2. Programs network rules so traffic to the Service IP
     is forwarded to one of the healthy backend Pods

Without kube-proxy:
  Client → Service IP (10.96.45.12) → nowhere (no rules)

With kube-proxy:
  Client → Service IP (10.96.45.12) → Pod A IP (10.244.1.5)
                                    OR Pod B IP (10.244.2.7)
                                    OR Pod C IP (10.244.3.2)
  (load balanced, only to healthy Pods)
```

### kube-proxy Modes

```
iptables mode (default):
  - Programs iptables PREROUTING/POSTROUTING rules
  - Random selection among Pods (probabilistic load balancing)
  - Efficient for moderate scale
  - Rules grow O(n) with number of Services

  iptables rule example:
  KUBE-SVC-XXXX → KUBE-SEP-A (33% chance) → 10.244.1.5:8080
               → KUBE-SEP-B (50% chance) → 10.244.2.7:8080
               → KUBE-SEP-C (100%)       → 10.244.3.2:8080

IPVS mode (high performance):
  - Uses Linux IP Virtual Server (kernel load balancer)
  - O(1) lookup (hash table) — scales to 10,000s of Services
  - More load balancing algorithms: round-robin, least-conn, etc.
  - Enable: kube-proxy --proxy-mode=ipvs

  kubectl get configmap kube-proxy -n kube-system -o yaml
```

### What kube-proxy Does NOT Do

```
kube-proxy does NOT:
  × Handle Pod-to-Pod traffic (that's the CNI plugin's job)
  × Handle Ingress routing (that's the Ingress controller's job)
  × Work for Headless Services (those go directly to Pod DNS)

Modern alternative:
  Cilium eBPF-based networking can replace kube-proxy entirely,
  programming rules in the kernel eBPF maps instead of iptables.
  This is more efficient and provides better observability.
```

---

## 4. Container Runtime

The container runtime is the software that actually **runs containers**. Kubernetes uses the Container Runtime Interface (CRI) to talk to any compliant runtime.

```
Kubernetes → CRI → Container Runtime → Linux Kernel

                    ┌───────────────────────────────┐
                    │     Container Runtimes         │
                    │                               │
                    │  containerd  (most common)    │
                    │    ├── CRI plugin             │
                    │    ├── pulls images           │
                    │    ├── manages snapshots      │
                    │    └── calls runc to start    │
                    │                               │
                    │  CRI-O  (RHEL / OpenShift)    │
                    │    └── Kubernetes-native CRI  │
                    │        runtime                │
                    │                               │
                    │  Docker Engine  (deprecated)  │
                    │    └── removed in K8s 1.24    │
                    │        (use containerd)       │
                    └───────────────────────────────┘
                               │
                               ▼
                    ┌───────────────────────────────┐
                    │       runc (OCI runtime)      │
                    │  low-level process that sets  │
                    │  up namespaces, cgroups and   │
                    │  starts container processes   │
                    └───────────────────────────────┘
```

### Container Runtime Commands (containerd)

```bash
# containerd CLI tool: ctr (low-level) or nerdctl (Docker-compatible)

# List running containers via crictl (Kubernetes-aware CLI)
crictl ps
crictl pods
crictl images
crictl logs <container-id>
crictl exec -it <container-id> sh
crictl inspect <container-id>

# Check container runtime on a node
kubectl get node worker-1 -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}'
# → containerd://1.7.2

# View containerd config
cat /etc/containerd/config.toml
```

---

## 5. Node Registration and Lifecycle

### How a Node Joins a Cluster

```
1. Install kubelet, kubeadm (or configure kubelet manually)
2. kubelet starts and registers itself with the API Server:
   POST /api/v1/nodes
   {name: "worker-1", capacity: {cpu: "4", memory: "8Gi"}}

3. API Server stores the Node object in etcd

4. Controller Manager's Node controller begins monitoring the node

5. Scheduler now considers this node for Pod placement
```

### Node Registration with kubeadm

```bash
# On the control plane (get the join command)
kubeadm token create --print-join-command

# On the new worker node (run the join command)
kubeadm join 192.168.1.100:6443 \
  --token abc123.xyz789 \
  --discovery-token-ca-cert-hash sha256:deadbeef...

# Verify node joined
kubectl get nodes
```

---

## 6. Node Conditions and Health

The kubelet reports node health to the API Server as **conditions**. The Node controller watches these conditions and takes action if a node becomes unreachable.

```
kubectl describe node worker-1

Conditions:
  Type              Status   Reason                  Message
  ────              ──────   ──────                  ───────
  MemoryPressure    False    KubeletHasSufficientMem  Sufficient memory
  DiskPressure      False    KubeletHasNoDiskPressure Sufficient disk
  PIDPressure       False    KubeletHasSufficientPIDs Sufficient PIDs
  Ready             True     KubeletReady             kubelet posting ready status

Meaning of Ready = False:
  - Node is not healthy
  - Scheduler will not place new Pods here
  - After 5 min (node-monitor-grace-period), Pods are evicted
```

### Node Conditions in Detail

| Condition | True means | False means |
|-----------|-----------|-------------|
| **Ready** | Node is healthy; can accept Pods | Node is not healthy; Pods will be evicted |
| **MemoryPressure** | Node is low on memory | Memory is fine |
| **DiskPressure** | Node is low on disk | Disk is fine |
| **PIDPressure** | Node is running low on process IDs | PIDs are fine |
| **NetworkUnavailable** | Network not configured | Network is configured |

### Node Eviction Timeline

```
Node becomes unreachable:
  t=0:00   kubelet stops posting heartbeats to API Server
  t=0:40   Node condition flips to Ready=Unknown (node-monitor-grace-period)
  t=5:00   Node controller starts evicting Pods
             (pod-eviction-timeout: 5 minutes)
  t=5:10   ReplicaSet controller creates replacement Pods on healthy nodes
```

---

## 7. Taints and Tolerations (Introduction)

Taints allow nodes to **repel** certain Pods unless those Pods declare they can tolerate the taint. This is how the control plane prevents regular application Pods from running on control plane nodes.

```
Taint on a node:       "I don't accept Pods unless they tolerate me"
Toleration on a Pod:   "I can run on nodes with this taint"

Control plane node has:
  node-role.kubernetes.io/control-plane:NoSchedule

Regular Pods:   no toleration → scheduler skips control plane node
System Pods:    have toleration → can run on control plane node
```

### Taint Effects

| Effect | Meaning |
|--------|---------|
| **NoSchedule** | New Pods without toleration won't be scheduled here |
| **PreferNoSchedule** | Scheduler tries to avoid, but may schedule if no choice |
| **NoExecute** | Existing Pods without toleration are evicted; new ones rejected |

### Working with Taints

```bash
# View node taints
kubectl describe node worker-1 | grep -A3 Taints

# Add a taint (e.g., dedicated GPU node)
kubectl taint nodes worker-gpu nvidia.com/gpu=true:NoSchedule

# Remove a taint
kubectl taint nodes worker-gpu nvidia.com/gpu=true:NoSchedule-

# Pod toleration to run on tainted node
spec:
  tolerations:
  - key: "nvidia.com/gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"

# Cordon a node (mark unschedulable, don't evict existing Pods)
kubectl cordon worker-1

# Drain a node (evict all Pods, for maintenance)
kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data

# Uncordon after maintenance
kubectl uncordon worker-1
```

---

## 8. Hands-On Exercises

**Exercise 1:** Inspect your cluster's worker node. Run `kubectl get nodes -o wide` to see node IPs and OS. Then `kubectl describe node <name>` and read through: capacity (CPU, memory), allocatable resources, conditions, and system info (container runtime version, kernel version, OS image).

**Exercise 2:** Observe kubelet in action. SSH into your minikube node (`minikube ssh`). Run `sudo systemctl status kubelet` to confirm it's running. Then look at `sudo journalctl -u kubelet --since "5 minutes ago"` — find log lines showing kubelet syncing Pods.

**Exercise 3:** Inspect kube-proxy iptables rules. In minikube, run `minikube ssh`. Then `sudo iptables -t nat -L KUBE-SERVICES -n | head -30`. Create a new Service and re-run the command — observe new rules added by kube-proxy.

**Exercise 4:** Practice node maintenance. Run `kubectl cordon minikube` to mark the node unschedulable. Try creating a new Pod — observe it stays Pending. Then `kubectl uncordon minikube`. The Pod should schedule. Finally, try `kubectl drain minikube --ignore-daemonsets` and observe running Pods being evicted.

**Exercise 5:** Explore taints. View the taint on the control plane node: `kubectl describe node <control-plane-node> | grep Taint`. Then create a Pod with a matching toleration and apply it — verify it can be scheduled on the control plane node.

---

## 9. Interview Q&A

**Q: What is kubelet and what does it do?**
Answer: kubelet is the primary agent that runs on every worker node. It watches the Kubernetes API Server for Pods assigned to its node, then calls the container runtime (containerd) to start those containers. It mounts volumes, configures the network (via CNI), runs health probes (liveness, readiness, startup), and reports Pod and node status back to the API Server. If a container fails its liveness probe, kubelet restarts it. Kubelet also manages static Pods from a local manifest directory.

**Q: What is kube-proxy and how does it implement Services?**
Answer: kube-proxy runs on every node and implements the Kubernetes Service abstraction by programming network rules. In iptables mode (default), it creates iptables NAT rules so traffic destined for a Service's ClusterIP is load balanced to one of the healthy Pod IPs in the Endpoints list. In IPVS mode it uses the kernel's IP Virtual Server for better scalability. kube-proxy watches the API Server for Service and Endpoints changes and updates the rules in real time.

**Q: What is a container runtime and what is CRI?**
Answer: A container runtime is the software that actually creates and runs containers. The Container Runtime Interface (CRI) is a plugin API that lets Kubernetes talk to any compliant runtime without needing runtime-specific code in Kubernetes itself. The dominant runtime is containerd (also used by Docker). CRI-O is popular in OpenShift/RHEL environments. All runtimes ultimately call runc (or a compatible OCI runtime) to set up Linux namespaces and cgroups and start the container process.

**Q: What are node conditions and what happens when a node becomes NotReady?**
Answer: Node conditions are health indicators that kubelet reports to the API Server — Ready, MemoryPressure, DiskPressure, PIDPressure, and NetworkUnavailable. When a node's Ready condition becomes False or Unknown (kubelet stops sending heartbeats), the Node controller waits for the node-monitor-grace-period (default 40s) before marking the condition Unknown, then after pod-eviction-timeout (default 5 minutes) it evicts the Pods. The Scheduler stops placing new Pods on NotReady nodes immediately. ReplicaSet controllers create replacement Pods on healthy nodes.

**Q: What are taints and tolerations and when would you use them?**
Answer: Taints mark a node to repel Pods that don't explicitly tolerate the taint. Tolerations are Pod-level declarations that allow scheduling on tainted nodes. Use cases include: dedicating nodes to specific workloads (GPU nodes tainted for GPU workloads only), preventing app Pods from running on control plane nodes (NoSchedule taint on control plane), or forcing Pod eviction from a node being drained for maintenance (NoExecute taint). They are the inverse of nodeAffinity — taints push Pods away; affinity pulls them toward specific nodes.
