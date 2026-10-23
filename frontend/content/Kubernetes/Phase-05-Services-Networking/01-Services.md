# Services — Complete Guide

## Table of Contents
1. [What is a Kubernetes Service?](#1-what-is-a-kubernetes-service)
2. [ClusterIP — Default Service Type](#2-clusterip--default-service-type)
3. [NodePort — Exposing to the Node Network](#3-nodeport--exposing-to-the-node-network)
4. [LoadBalancer — Cloud-Native External Access](#4-loadbalancer--cloud-native-external-access)
5. [ExternalName — DNS Alias to External Services](#5-externalname--dns-alias-to-external-services)
6. [Service Spec YAML in Depth](#6-service-spec-yaml-in-depth)
7. [Selector Matching and Endpoints](#7-selector-matching-and-endpoints)
8. [kube-proxy Modes](#8-kube-proxy-modes)
9. [Headless Services](#9-headless-services)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is a Kubernetes Service?

Pods are ephemeral. They are created and destroyed constantly — by rolling updates, node failures, or autoscaling. Each new Pod gets a new IP address that no other part of the cluster can rely on.

A **Service** is a stable, long-lived abstraction that sits in front of a group of Pods. It provides:
- A **stable virtual IP** (ClusterIP) that never changes even as Pods are replaced
- A **stable DNS name** registered in the cluster DNS (`<service>.<namespace>.svc.cluster.local`)
- **Load balancing** across all healthy Pods that match the Service's label selector

```
Without a Service:
  Client → Pod IP (10.0.1.5) ← Pod dies, IP changes → Client is broken

With a Service:
  Client → Service VIP (10.96.0.10) → kube-proxy → healthy Pod

  ┌─────────┐          ┌──────────────────────────┐
  │  Client │──────────▶  Service (ClusterIP)      │
  └─────────┘          │  10.96.0.10:80           │
                        └────────────┬─────────────┘
                                     │ load balances
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                       Pod A      Pod B      Pod C
                    10.0.1.2   10.0.1.3   10.0.1.4
```

### Service Types at a Glance

```
ClusterIP:    Pod → Service (cluster-internal only)
NodePort:     External → NodeIP:NodePort → Service → Pod
LoadBalancer: External → LB IP → NodePort → Service → Pod
ExternalName: Pod → Service → CNAME → external hostname
```

---

## 2. ClusterIP — Default Service Type

`ClusterIP` is the default Service type. It assigns a virtual IP address (the ClusterIP) that is only reachable from inside the cluster — from other Pods, from the cluster's kube-proxy, or from workloads running in the cluster.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
  namespace: default
spec:
  type: ClusterIP         # default if omitted
  selector:
    app: my-app           # must match Pod labels
  ports:
    - name: http
      port: 80            # port clients connect to on the Service
      targetPort: 8080    # port the container listens on
      protocol: TCP
```

```bash
# Apply the Service
kubectl apply -f my-app-svc.yaml

# Get the assigned ClusterIP
kubectl get svc my-app-svc
# NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
# my-app-svc   ClusterIP   10.96.45.123   <none>        80/TCP    5s

# Describe it to see endpoints
kubectl describe svc my-app-svc

# Test from inside the cluster
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- curl http://my-app-svc:80
```

The ClusterIP is allocated from the Service CIDR (usually `10.96.0.0/12`) defined at API server startup with `--service-cluster-ip-range`.

---

## 3. NodePort — Exposing to the Node Network

`NodePort` extends ClusterIP by also opening a static port (30000–32767) on every node in the cluster. External traffic hitting any node on that port is forwarded to the Service, which routes it to a healthy Pod.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-nodeport
spec:
  type: NodePort
  selector:
    app: my-app
  ports:
    - name: http
      port: 80            # Service port (internal)
      targetPort: 8080    # Pod container port
      nodePort: 30080     # node-level port (optional; auto-assigned if omitted)
      protocol: TCP
```

```
External Client
      │
      ▼
  <NodeIP>:30080   (any node — even nodes without matching Pods)
      │
      ▼
  kube-proxy (iptables / IPVS rule)
      │
      ▼
  Service ClusterIP (10.96.45.123:80)
      │
      ▼
  Pod (10.0.1.x:8080)
```

```bash
# Get nodes with their external IPs
kubectl get nodes -o wide

# Access from outside the cluster
curl http://<node-external-ip>:30080

# Let Kubernetes assign the nodePort automatically (recommended)
# then find out which one was assigned
kubectl get svc my-app-nodeport -o jsonpath='{.spec.ports[0].nodePort}'
```

NodePort is useful for development, on-prem bare metal, or when a load balancer is unavailable. In production, prefer LoadBalancer or Ingress.

---

## 4. LoadBalancer — Cloud-Native External Access

`LoadBalancer` extends NodePort by automatically provisioning an external load balancer through the cloud provider's API (AWS ALB/NLB, GCP CLB, Azure LB). The load balancer gets a public IP and forwards traffic to the NodePort on all cluster nodes.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-lb
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb   # AWS NLB
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
  loadBalancerSourceRanges:          # optional: restrict to specific CIDRs
    - 203.0.113.0/24
```

```bash
# Check provisioning status — EXTERNAL-IP changes from <pending> to the LB IP
kubectl get svc my-app-lb --watch
# NAME        TYPE           CLUSTER-IP     EXTERNAL-IP       PORT(S)        AGE
# my-app-lb   LoadBalancer   10.96.100.5    52.12.34.56       80:31234/TCP   45s

# Traffic flow:
# External → 52.12.34.56:80 → NodePort 31234 → ClusterIP 10.96.100.5:80 → Pod:8080
```

```
Internet
    │
    ▼
AWS/GCP/Azure Load Balancer (52.12.34.56:80)
    │
    ├── Node 1 :31234
    ├── Node 2 :31234
    └── Node 3 :31234
            │
            ▼
       Service ClusterIP
            │
        ┌───┴───┐
        ▼       ▼
      Pod A   Pod B
```

On bare metal clusters (where there is no cloud controller manager), `LoadBalancer` Services stay in `<pending>` state. Use MetalLB to provide load balancer IPs in an on-prem environment.

---

## 5. ExternalName — DNS Alias to External Services

`ExternalName` creates a CNAME DNS record inside the cluster DNS. It does not allocate a ClusterIP and does no proxying — it simply returns the configured external hostname when Pods resolve the Service name.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: default
spec:
  type: ExternalName
  externalName: my-database.us-east-1.rds.amazonaws.com
  # No selector — no Pods are selected
  # No ClusterIP is assigned
```

```bash
# Any Pod in the cluster can now connect using the Service name
# instead of the raw RDS endpoint
kubectl exec -it my-pod -- curl http://external-db:5432

# DNS resolution inside the cluster:
# external-db.default.svc.cluster.local → CNAME → my-database.us-east-1.rds.amazonaws.com
```

Use ExternalName to:
- Migrate an application from an external DB to an in-cluster DB by swapping the Service definition — no app config change needed
- Give an external service a cluster-friendly DNS name

---

## 6. Service Spec YAML in Depth

```yaml
apiVersion: v1
kind: Service
metadata:
  name: comprehensive-svc
  namespace: production
  labels:
    app: my-app
    env: prod
  annotations:
    description: "Full example service spec"
spec:
  type: ClusterIP              # ClusterIP | NodePort | LoadBalancer | ExternalName

  selector:                    # Pods with ALL these labels are selected
    app: my-app
    tier: backend

  ports:
    - name: http               # required when multiple ports defined
      protocol: TCP            # TCP (default) | UDP | SCTP
      port: 80                 # port clients use to access the Service
      targetPort: 8080         # port on the Pod (can be a named port)
    - name: metrics
      protocol: TCP
      port: 9090
      targetPort: metrics      # named port — must match containerPort name in Pod spec

  sessionAffinity: ClientIP    # None (default) | ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800    # session stickiness timeout (3 hours default)

  ipFamilies:                  # IPv4 | IPv6 | dual-stack
    - IPv4

  publishNotReadyAddresses: false  # include Pods not yet Ready (use for StatefulSets)
```

### port vs targetPort vs nodePort

| Field | Meaning |
|-------|---------|
| `port` | Port the Service listens on (what clients connect to) |
| `targetPort` | Port on the Pod the traffic is forwarded to |
| `nodePort` | Port opened on every Node (NodePort and LoadBalancer types only) |

```
Client → Service.port (80) → [kube-proxy] → Pod.targetPort (8080)
                 ↑
          NodePort (30080) also maps here for NodePort/LB types
```

---

## 7. Selector Matching and Endpoints

When a Service has a `selector`, the Endpoints controller watches for Pods whose labels match. It maintains an `Endpoints` object (same name as the Service) listing the IP:port of each ready Pod.

```bash
# View the Endpoints object
kubectl get endpoints my-app-svc
# NAME         ENDPOINTS                                   AGE
# my-app-svc   10.0.1.2:8080,10.0.1.3:8080,10.0.1.4:8080  10m

# Describe for more detail
kubectl describe endpoints my-app-svc

# In Kubernetes 1.21+, EndpointSlices replace Endpoints for scalability
kubectl get endpointslices -l kubernetes.io/service-name=my-app-svc
```

```
Service (selector: app=my-app)
        │
        ▼  Endpoints controller reconciles
Endpoints object:
  - 10.0.1.2:8080  ← Pod A (app=my-app, Ready=true)
  - 10.0.1.3:8080  ← Pod B (app=my-app, Ready=true)
  ✗ 10.0.1.4:8080  ← Pod C (app=my-app, Ready=false) — excluded
```

### Manual (Selector-less) Services

You can create a Service without a selector and manually manage the Endpoints. This is useful to represent external services or databases as first-class cluster services.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: manual-endpoints-svc
spec:
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: v1
kind: Endpoints
metadata:
  name: manual-endpoints-svc   # must match Service name
subsets:
  - addresses:
      - ip: 192.168.10.50      # external DB server
    ports:
      - port: 5432
```

---

## 8. kube-proxy Modes

`kube-proxy` runs on every node and implements the Service abstraction by programming network rules that forward traffic from the Service's ClusterIP to a backing Pod.

### iptables Mode (default)

kube-proxy writes iptables DNAT rules. On each packet destined for the ClusterIP, iptables randomly selects a Pod endpoint and rewrites the destination IP.

```
Packet to 10.96.45.123:80
   │
   ▼
iptables PREROUTING chain
   │  DNAT rule: randomly selects Pod IP (1/N probability per Pod)
   ▼
Packet to 10.0.1.2:8080  →  Pod A
```

- Pro: Mature, widely tested
- Con: Random selection (no true round-robin), O(n) rule scanning

### IPVS Mode (recommended for large clusters)

kube-proxy programs Linux IPVS (IP Virtual Server) rules. IPVS uses a hash table so rule lookup is O(1).

```bash
# Check current mode
kubectl get configmap kube-proxy -n kube-system -o yaml | grep mode

# Enable IPVS on a new cluster (kubeadm example)
# kubeadm-config.yaml:
# kubeProxy:
#   config:
#     mode: ipvs
#     ipvs:
#       scheduler: rr    # rr | lc | dh | sh | sed | nq
```

Supports scheduling algorithms: round-robin (`rr`), least-connection (`lc`), destination-hash (`dh`), etc.

### nftables Mode (Kubernetes 1.29+ alpha)

nftables is the modern Linux successor to iptables. Kubernetes 1.29 introduced experimental nftables support for kube-proxy to improve performance at scale.

---

## 9. Headless Services

A headless Service has `clusterIP: None`. Kubernetes does not assign a VIP. Instead, DNS returns the A records of all matching Pod IPs directly. Clients receive all Pod IPs and handle selection themselves.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-headless
spec:
  clusterIP: None              # ← makes it headless
  selector:
    app: my-app
  ports:
    - port: 8080
      targetPort: 8080
```

```bash
# DNS query for a normal Service → single A record (ClusterIP)
# DNS query for a headless Service → multiple A records (one per Pod)

kubectl run dns-test --image=busybox --rm -it --restart=Never -- \
  nslookup my-app-headless.default.svc.cluster.local

# Server:    10.96.0.10
# Address 1: 10.0.1.2 pod-a.my-app-headless.default.svc.cluster.local
# Address 2: 10.0.1.3 pod-b.my-app-headless.default.svc.cluster.local
# Address 3: 10.0.1.4 pod-c.my-app-headless.default.svc.cluster.local
```

### Why Headless Services Matter for StatefulSets

StatefulSets use a headless Service to give each Pod a stable, ordered DNS name:

```
pod-0.my-statefulset.default.svc.cluster.local → 10.0.1.2
pod-1.my-statefulset.default.svc.cluster.local → 10.0.1.3
pod-2.my-statefulset.default.svc.cluster.local → 10.0.1.4
```

This is how databases like Cassandra, Kafka, and etcd members identify each other — they need to reach a specific, named replica, not a random one.

---

## 10. Hands-On Exercises

**Exercise 1:** Deploy an nginx Deployment with 3 replicas and the label `app: nginx-demo`. Create a ClusterIP Service that targets port 80. Use `kubectl exec` to run a curl from inside a busybox Pod to the Service's ClusterIP. Verify load balancing by watching the nginx access logs across all three Pods simultaneously with `kubectl logs -l app=nginx-demo -f`.

**Exercise 2:** Modify the Service from Exercise 1 to type `NodePort`. Verify that Kubernetes opens a port in the 30000–32767 range on the node. If running minikube, use `minikube service nginx-demo-svc --url` to get the accessible URL. Access the nginx welcome page from your browser or with curl from your laptop.

**Exercise 3:** Create a selector-less Service and a manual Endpoints object pointing to any public IP (e.g., use `1.1.1.1:80` for Cloudflare's HTTP). Run a busybox Pod and curl the Service name. Observe that the traffic reaches the manually configured endpoint rather than a Pod.

**Exercise 4:** Create a StatefulSet with 3 replicas and a headless Service as its governing Service. Once all Pods are Running, exec into Pod-0 and run `nslookup <statefulset-name>.<namespace>.svc.cluster.local`. Confirm you get back three separate A records. Then resolve the individual Pod DNS name `<podname>.<headless-svc>.<namespace>.svc.cluster.local` to confirm stable per-Pod DNS.

**Exercise 5:** Simulate a rolling update and observe how Service endpoints update. Scale down a Deployment to 0 with `kubectl scale deployment nginx-demo --replicas=0`. Watch `kubectl get endpoints nginx-demo-svc` — confirm the Endpoints list empties within seconds. Scale back up to 3 and watch endpoints repopulate. This demonstrates how the Endpoints controller keeps the Service VIP continuously healthy.

---

## 11. Interview Q&A

**Q: What problem does a Kubernetes Service solve?**
Answer: Pods are ephemeral and get new IP addresses every time they are created. If an application connects directly to a Pod's IP, a Pod restart breaks the connection. A Service provides a stable virtual IP and DNS name that persists regardless of how many times the underlying Pods are replaced. It also load balances across all healthy Pods and removes unhealthy Pods from rotation automatically via the Endpoints controller.

**Q: What is the difference between port, targetPort, and nodePort in a Service spec?**
Answer: `port` is the port that clients use to connect to the Service's ClusterIP — it is the Service's listening port. `targetPort` is the port on the actual Pod container where traffic is forwarded to — it matches the `containerPort` in the Pod spec. `nodePort` only exists for NodePort and LoadBalancer Services; it is the static port (30000–32767) opened on every node in the cluster, allowing external traffic to enter the cluster. If `targetPort` is omitted it defaults to the same value as `port`.

**Q: When would you use a headless Service instead of a normal ClusterIP Service?**
Answer: Use a headless Service when clients need to discover and connect to individual Pods directly rather than through a load-balanced VIP. The primary use case is StatefulSets — databases like Cassandra, Kafka, and etcd need to communicate with specific named replicas. A headless Service gives each Pod a stable DNS name in the form `<pod-name>.<service-name>.<namespace>.svc.cluster.local`. DNS returns all Pod A records directly, letting the client or application framework handle the selection logic.

**Q: What is the difference between NodePort and LoadBalancer Service types?**
Answer: NodePort opens a static port on every node and makes the Service reachable externally at `<any-node-ip>:<nodePort>`. It requires clients to know a node's IP and handle node failures themselves. LoadBalancer extends NodePort by also provisioning an external load balancer through the cloud provider API (AWS, GCP, Azure). The cloud LB gets a stable public IP or hostname and automatically distributes traffic across all nodes' NodePorts. LoadBalancer is the production-grade option for cloud deployments; NodePort is simpler and used on-prem or for dev/test.

**Q: How does kube-proxy implement Service routing, and what are the trade-offs of iptables vs IPVS mode?**
Answer: kube-proxy watches the Kubernetes API for Service and Endpoint changes and programs the node's network layer to intercept traffic destined for the Service ClusterIP. In iptables mode it creates DNAT rules that statistically (randomly) select a Pod endpoint; rule evaluation is O(n) so performance degrades with many Services. In IPVS mode it uses the Linux kernel's IPVS (IP Virtual Server) subsystem, which stores rules in a hash table for O(1) lookup and supports multiple scheduling algorithms (round-robin, least-connection, etc.). IPVS is recommended for clusters with more than a few hundred Services.
