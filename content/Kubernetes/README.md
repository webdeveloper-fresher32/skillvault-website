# Kubernetes — Complete Learning Course

Master Kubernetes from zero to production. This course covers everything from core container orchestration concepts through Pods, Deployments, Services, Ingress, RBAC, Helm, monitoring, and CI/CD — giving you the skills to design, deploy, and operate resilient applications on Kubernetes clusters.

---

## Course Structure

```
Kubernetes/
├── Phase-01-Fundamentals/      → What K8s is, installation, K8s vs Docker Swarm
├── Phase-02-Architecture/      → Control plane, worker nodes, kubectl CLI
├── Phase-03-Pods/              → Pod fundamentals, lifecycle, multi-container pods
├── Phase-04-Workloads/         → Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs
├── Phase-05-Services-Networking/ → Services, DNS, NetworkPolicy
├── Phase-06-Storage/           → Volumes, PersistentVolumes, PVCs, StorageClasses
├── Phase-07-Config-Secrets/    → ConfigMaps, Secrets, environment variables
├── Phase-08-Ingress/           → Ingress, Ingress controllers, TLS
├── Phase-09-RBAC-Security/     → RBAC, ServiceAccounts, security best practices
├── Phase-10-Helm/              → Helm fundamentals, charts, templates, repos
├── Phase-11-Monitoring-Logging/ → Resource management, Prometheus/Grafana, EFK
├── Phase-12-Production/        → CI/CD, autoscaling, production best practices
├── Quick-Reference/            → Cheatsheet + 50 interview Q&A
└── Projects/                   → Beginner → Advanced hands-on projects
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals | Beginner | 3 days |
| 02 | Architecture | Beginner | 3 days |
| 03 | Pods | Beginner | 3 days |
| 04 | Workloads | Intermediate | 4 days |
| 05 | Services & Networking | Intermediate | 4 days |
| 06 | Storage | Intermediate | 3 days |
| 07 | Config & Secrets | Intermediate | 2 days |
| 08 | Ingress | Intermediate | 3 days |
| 09 | RBAC & Security | Advanced | 3 days |
| 10 | Helm | Advanced | 4 days |
| 11 | Monitoring & Logging | Advanced | 3 days |
| 12 | Production | Advanced | 3 days |

**Total estimated time: 10-12 weeks**

---

## Prerequisites

- Solid understanding of Docker (containers, images, Dockerfiles)
- Basic Linux command line (ls, cd, cat, grep, systemctl)
- Basic networking concepts (TCP/IP, DNS, ports, load balancing)
- Familiarity with YAML syntax

---

## Kubernetes Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      Control Plane                             │  │
│  │                                                                │  │
│  │  ┌───────────┐  ┌──────────┐  ┌──────────────────────────┐   │  │
│  │  │ API Server │  │   etcd   │  │   Controller Manager     │   │  │
│  │  │(kube-      │  │(cluster  │  │  (ReplicaSet, Node,      │   │  │
│  │  │ apiserver) │  │  store)  │  │   Deployment controllers)│   │  │
│  │  └───────────┘  └──────────┘  └──────────────────────────┘   │  │
│  │         │                       ┌─────────────┐               │  │
│  │         │                       │  Scheduler  │               │  │
│  │         │                       │(kube-sched) │               │  │
│  │         │                       └─────────────┘               │  │
│  └─────────│───────────────────────────────────────────────────┘  │  │
│            │  (kubectl / API calls)                                │  │
│  ┌─────────▼──────────────────────────────────────────────────┐   │  │
│  │                       Worker Nodes                          │   │  │
│  │                                                             │   │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  │   │  │
│  │  │       Node 1            │  │       Node 2            │  │   │  │
│  │  │  ┌───────┐ ┌─────────┐  │  │  ┌───────┐ ┌─────────┐  │  │   │  │
│  │  │  │ Pod A │ │  Pod B  │  │  │  │ Pod C │ │  Pod D  │  │  │   │  │
│  │  │  └───────┘ └─────────┘  │  │  └───────┘ └─────────┘  │  │   │  │
│  │  │  kubelet / kube-proxy   │  │  kubelet / kube-proxy   │  │   │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  │   │  │
│  └─────────────────────────────────────────────────────────────┘   │  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Deploy a Static Website | Beginner | Nginx Pod + Service + NodePort |
| Node.js API on K8s | Beginner | Deployment + ClusterIP Service + ConfigMap |
| MySQL with PersistentVolume | Intermediate | StatefulSet + PVC + Secret |
| Microservices App | Intermediate | 3-service app with Ingress + NetworkPolicy |
| Helm Chart from Scratch | Advanced | Package a multi-tier app as a reusable chart |
| Production CI/CD Pipeline | Advanced | GitHub Actions → build → push → rolling deploy |

---

## Quick Commands

```bash
kubectl get nodes                        # list cluster nodes
kubectl get pods -A                      # list all pods in all namespaces
kubectl apply -f manifest.yaml           # create/update resources
kubectl describe pod <name>              # inspect a pod
kubectl logs <pod> -f                    # stream pod logs
kubectl exec -it <pod> -- bash           # shell into a pod
kubectl port-forward svc/<name> 8080:80  # forward a service port locally
kubectl delete -f manifest.yaml          # delete resources
```
