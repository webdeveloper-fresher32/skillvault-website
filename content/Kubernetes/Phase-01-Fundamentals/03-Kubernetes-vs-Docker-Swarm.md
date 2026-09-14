# Kubernetes vs Docker Swarm — Complete Guide

## Table of Contents
1. [Overview](#1-overview)
2. [Architecture Differences](#2-architecture-differences)
3. [Feature Comparison](#3-feature-comparison)
4. [Deployment Model](#4-deployment-model)
5. [Networking](#5-networking)
6. [Use Cases for Each](#6-use-cases-for-each)
7. [Migration Considerations](#7-migration-considerations)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Overview

Docker Swarm and Kubernetes are both container orchestration platforms — they run containers across multiple machines, handle failures, and scale workloads. They solve the same core problem but with very different philosophies.

```
Docker Swarm:  built into Docker; simpler; Docker Compose compatible
Kubernetes:    separate system; complex; powerful; industry standard

History:
  2014 → Kubernetes created by Google
  2015 → Docker Swarm mode introduced (built into Docker 1.12)
  2017 → Kubernetes wins the "orchestration wars"
  2019 → Docker Enterprise (including Swarm) sold to Mirantis
  Today → Kubernetes has ~88% market share (CNCF 2023)
           Docker Swarm still used in simpler environments
```

---

## 2. Architecture Differences

### Docker Swarm Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Docker Swarm Cluster                     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Manager 1   │  │  Manager 2   │  │  Manager 3   │    │
│  │  (leader)    │  │  (follower)  │  │  (follower)  │    │
│  │              │  │              │  │              │    │
│  │  Control     │  │  Raft        │  │  Raft        │    │
│  │  plane       │  │  consensus   │  │  consensus   │    │
│  └──────┬───────┘  └──────────────┘  └──────────────┘    │
│         │                                                  │
│         │  (managers can also run workloads)               │
│         ▼                                                  │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │   Worker 1   │  │   Worker 2   │                       │
│  │  [container] │  │  [container] │                       │
│  └──────────────┘  └──────────────┘                       │
│                                                            │
│  State: Raft consensus among managers (no separate etcd)  │
└────────────────────────────────────────────────────────────┘
```

### Kubernetes Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Dedicated Control Plane                 │  │
│  │                                                       │  │
│  │  kube-apiserver  │  etcd  │  scheduler  │ controllers│  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────┼───────────────────────────┐     │
│  │                       │                           │     │
│  ▼                       ▼                           ▼     │
│  ┌─────────┐        ┌─────────┐              ┌─────────┐   │
│  │ Worker 1│        │ Worker 2│              │ Worker N│   │
│  │ kubelet │        │ kubelet │              │ kubelet │   │
│  │ [Pods]  │        │ [Pods]  │              │ [Pods]  │   │
│  └─────────┘        └─────────┘              └─────────┘   │
│                                                            │
│  State: etcd (dedicated distributed key-value store)       │
└────────────────────────────────────────────────────────────┘
```

### Key Architectural Differences

| Aspect | Docker Swarm | Kubernetes |
|--------|-------------|------------|
| **Control plane storage** | Raft log on managers | Dedicated etcd cluster |
| **Manager nodes** | Also run workloads by default | Dedicated control plane nodes |
| **Minimum HA setup** | 3 managers | 3 control plane + 3+ workers |
| **API** | Docker API (familiar) | Kubernetes API (new concepts) |
| **Complexity** | Low | High |

---

## 3. Feature Comparison

```
Full Feature Comparison:

┌─────────────────────────────────┬──────────────────┬──────────────────┐
│  Feature                        │  Docker Swarm    │  Kubernetes      │
├─────────────────────────────────┼──────────────────┼──────────────────┤
│  Learning curve                 │  Low             │  High            │
│  Setup complexity               │  Low             │  High            │
│  Docker Compose compatibility   │  Yes (stacks)    │  No (Helm/Kompose)│
│  Auto-scaling (HPA)             │  No              │  Yes             │
│  Rolling updates                │  Yes             │  Yes             │
│  Rollback                       │  Yes (limited)   │  Yes (full)      │
│  Health checks / liveness probes│  Basic           │  Advanced        │
│  Namespace isolation            │  No              │  Yes             │
│  RBAC                           │  Limited         │  Full            │
│  Network policies               │  No              │  Yes (CNI)       │
│  Custom resource definitions    │  No              │  Yes             │
│  Operators / controllers        │  No              │  Yes             │
│  Ingress / routing              │  Basic           │  Full (Ingress)  │
│  StatefulSet support            │  No              │  Yes             │
│  Persistent volume management   │  Basic           │  Full (PV/PVC)   │
│  Multi-cloud / hybrid           │  Limited         │  Yes             │
│  Ecosystem / tooling            │  Small           │  Massive (CNCF)  │
│  Community & support            │  Declining       │  Very active     │
│  Managed cloud service          │  Limited         │  EKS, GKE, AKS  │
└─────────────────────────────────┴──────────────────┴──────────────────┘
```

---

## 4. Deployment Model

### Docker Swarm: Service-based

```yaml
# docker-compose.yml (Swarm stack)
version: "3.8"
services:
  web:
    image: nginx:1.25
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    ports:
    - "80:80"
  db:
    image: postgres:15
    volumes:
    - db-data:/var/lib/postgresql/data

volumes:
  db-data:

# Deploy to swarm:
# docker stack deploy -c docker-compose.yml myapp
```

### Kubernetes: Object manifest-based

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80

# Apply:
# kubectl apply -f .
```

### Swarm vs K8s Rolling Update

```
Docker Swarm rolling update:
  docker service update --image nginx:1.26 myapp_web
  → updates 1 replica at a time (parallelism=1)
  → limited rollback (stores 1 previous version only)

Kubernetes rolling update:
  kubectl set image deployment/web nginx=nginx:1.26
  → configurable surge and unavailability
  → full rollout history stored
  kubectl rollout history deployment/web
  kubectl rollout undo deployment/web --to-revision=2
```

---

## 5. Networking

### Docker Swarm Networking

```
Docker Swarm networking:
  - Overlay network: containers on different nodes communicate
  - VIP (Virtual IP): each service gets a VIP for load balancing
  - Routing mesh: any node receives traffic for any service
  - Built-in: no extra CNI plugin needed

  docker network create --driver overlay myapp-net
  → All service tasks on this network can talk to each other by service name

Routing mesh:
  Request hits Node 3:Port 80
       ↓
  Docker routes to whichever node has a healthy task
       ↓
  Container on Node 1 handles it
```

### Kubernetes Networking

```
Kubernetes networking:
  - Every Pod gets a unique cluster-wide IP (flat network)
  - Pods communicate directly — no NAT
  - Services provide stable DNS names and load balancing
  - CNI plugins handle the networking: Calico, Flannel, Cilium, Weave
  - NetworkPolicy: firewall rules between Pods (Swarm has nothing like this)

  Pod-to-Pod:        10.244.1.5 → 10.244.2.7 directly
  Pod-to-Service:    myapp-svc → ClusterIP → load balanced to Pods
  External traffic:  NodePort / LoadBalancer / Ingress

DNS (built in):
  <service>.<namespace>.svc.cluster.local
  web.default.svc.cluster.local → 10.96.45.12

NetworkPolicy (Swarm has no equivalent):
  # Only allow Pods with label app=frontend to reach backend
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  spec:
    podSelector:
      matchLabels:
        app: backend
    ingress:
    - from:
      - podSelector:
          matchLabels:
            app: frontend
```

---

## 6. Use Cases for Each

### When Docker Swarm is the Right Choice

```
Use Docker Swarm when:
  ✓ Team already knows Docker Compose — Swarm uses same format
  ✓ Simple application with 2-5 services
  ✓ Small team with no dedicated DevOps/platform engineers
  ✓ You want to add HA without rewriting everything
  ✓ Budget-constrained — less overhead, no managed K8s fees
  ✓ Application has predictable, steady load (no autoscaling needed)

Examples:
  - Internal company tools
  - Small SaaS products
  - Migrating from docker-compose to multi-host without K8s complexity
  - Staging environment for a small team
```

### When Kubernetes is the Right Choice

```
Use Kubernetes when:
  ✓ Multiple independent microservices that scale differently
  ✓ Need horizontal Pod autoscaling (HPA) based on metrics
  ✓ Stateful applications (databases) needing stable identities
  ✓ Multi-team environments needing namespace isolation + RBAC
  ✓ Complex routing / traffic management (Ingress, service mesh)
  ✓ Custom operators for database management (Postgres operator, etc.)
  ✓ Cloud-native ecosystem integrations (service meshes, GitOps, etc.)
  ✓ Large scale: dozens to thousands of containers

Examples:
  - Large microservices platforms
  - Multi-tenant SaaS
  - Data processing pipelines needing job management
  - Any company using AWS/GCP/Azure managed K8s services
```

---

## 7. Migration Considerations

### Moving from Docker Compose / Swarm to Kubernetes

```
Docker Compose → Kubernetes migration path:

Step 1: Use Kompose tool to auto-convert
  kompose convert -f docker-compose.yml
  → generates Deployment, Service, PV manifests

Step 2: Review and fix generated manifests
  - Kompose output is a starting point, not production-ready
  - Add health probes (liveness, readiness)
  - Add resource limits (requests/limits)
  - Replace volume definitions with PVC + StorageClass
  - Add NetworkPolicy if needed

Step 3: Test on local kind/minikube cluster

Step 4: Deploy to cloud managed K8s (EKS/GKE/AKS)
```

### What Changes

```
Docker Compose concept → Kubernetes equivalent:

services:            → Deployment + Service
networks:            → namespaces + NetworkPolicy + CNI
volumes:             → PersistentVolume + PersistentVolumeClaim
ports:               → Service (NodePort/LoadBalancer) + Ingress
environment:         → ConfigMap + Secret
healthcheck:         → livenessProbe + readinessProbe
deploy.replicas:     → spec.replicas in Deployment
deploy.resources:    → resources.requests + resources.limits
restart: always      → restartPolicy: Always (Pod spec)
secrets:             → Secret (base64 encoded, mounted as volume/env)
```

### Can You Run Both?

```
Yes — some teams run:
  Dev local:      Docker Compose (fast, simple)
  CI:             kind (reproducible K8s environment)
  Staging/Prod:   EKS / GKE / AKS (managed Kubernetes)

A smaller fraction runs:
  Prod:           Docker Swarm (simpler ops, acceptable for their scale)

Very few run Kubernetes AND Swarm in production simultaneously —
pick one orchestrator per environment.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Install Docker (if not already) and initialise a Swarm: `docker swarm init`. Deploy a simple nginx service: `docker service create --name web --replicas 3 -p 80:80 nginx:1.25`. Run `docker service ls` and `docker service ps web` to inspect. Then scale to 5 replicas: `docker service scale web=5`.

**Exercise 2:** Compare the same workload in both tools. Run 3 nginx replicas in Swarm (Exercise 1). Then run 3 nginx replicas in Kubernetes: `kubectl create deployment nginx --image=nginx:1.25 --replicas=3 && kubectl expose deployment nginx --port=80 --type=NodePort`. Time how long each takes and compare the commands.

**Exercise 3:** Test self-healing in both platforms. In Swarm: find a container running the web service (`docker ps`), kill it (`docker rm -f <id>`), and watch Swarm recreate it with `docker service ps web`. In Kubernetes: delete a pod (`kubectl delete pod <name>`), watch it get recreated with `kubectl get pods -w`.

**Exercise 4:** Use Kompose to convert a docker-compose.yml to Kubernetes manifests. Install kompose (`brew install kompose`), create a simple docker-compose.yml with nginx + redis services, run `kompose convert`, and inspect the generated YAML files. Apply them to your minikube cluster.

**Exercise 5:** Look at the networking differences. In Swarm, inspect the overlay network created for a stack (`docker network inspect`). In Kubernetes, run `kubectl get svc -A` and `kubectl get endpoints` — observe how the Service VIP maps to Pod IPs via endpoints. Then run `kubectl exec -it <pod> -- nslookup kubernetes.default` to see DNS in action.

---

## 9. Interview Q&A

**Q: What is the main difference between Docker Swarm and Kubernetes?**
Answer: Docker Swarm is Docker's built-in clustering mode — simpler to set up, uses Docker Compose format, and is sufficient for smaller workloads. Kubernetes is a more complex, feature-rich system originally from Google, with advanced capabilities like horizontal Pod autoscaling, NetworkPolicy, StatefulSets, custom operators, and a huge ecosystem. Kubernetes has become the industry standard while Swarm use has declined.

**Q: Why did Kubernetes win the orchestration war over Docker Swarm?**
Answer: Several reasons: Kubernetes offered more sophisticated features (autoscaling, StatefulSets, CRDs, RBAC) that enterprises needed. Google, Red Hat, and CoreOS drove aggressive cloud-native ecosystem growth (CNCF). All major cloud providers released managed Kubernetes services (EKS, GKE, AKS), making it easy to adopt. Docker Inc.'s Swarm lacked this backing and cloud-native ecosystem momentum.

**Q: Is there any scenario where you would still choose Docker Swarm today?**
Answer: Yes — for small teams running simple workloads where Docker Compose is already in use and Kubernetes operational complexity isn't justified. Swarm requires less expertise, no CNI configuration, and the Compose file format is familiar. If you have a 3-5 service application, a small team, and don't need autoscaling or advanced isolation, Swarm can be entirely sufficient and significantly easier to operate.

**Q: How does networking differ between Swarm and Kubernetes?**
Answer: In Docker Swarm, the overlay network and VIP-based load balancing are handled by Docker itself using iptables and IPVS — no extra components. In Kubernetes, networking is pluggable via CNI (Container Network Interface) — you choose a plugin (Calico, Flannel, Cilium) that implements Pod networking. Kubernetes also has NetworkPolicy (firewall rules between Pods), which Docker Swarm has no equivalent of.

**Q: How would you migrate a Docker Compose app to Kubernetes?**
Answer: Use the Kompose tool (`kompose convert -f docker-compose.yml`) to auto-generate Kubernetes manifests as a starting point. Then manually review and improve the output: add liveness and readiness probes, set resource requests and limits, convert volumes to PersistentVolumeClaims with appropriate StorageClass, move secrets to Kubernetes Secrets, and add an Ingress for external HTTP routing. Test on a local cluster before deploying to production.
