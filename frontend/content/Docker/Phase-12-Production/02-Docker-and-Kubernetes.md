# Docker and Kubernetes — Complete Guide

## Table of Contents
1. [Why Kubernetes?](#1-why-kubernetes)
2. [Core Concepts: Pod, Deployment, Service](#2-core-concepts-pod-deployment-service)
3. [Deployment YAML with a Docker Image](#3-deployment-yaml-with-a-docker-image)
4. [Service Types: ClusterIP vs NodePort vs LoadBalancer](#4-service-types-clusterip-vs-nodeport-vs-loadbalancer)
5. [Essential kubectl Commands](#5-essential-kubectl-commands)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Kubernetes?

Docker alone runs containers on a single host. Kubernetes (K8s) orchestrates containers across a cluster of many hosts, handling scheduling, scaling, healing, and networking automatically.

```
Docker alone (single host):
  ┌──────────────────────────────────┐
  │  Host: prod-server-1             │
  │  [container] [container]         │
  │  [container] [container]         │
  │                                  │
  │  Problems:                       │
  │  - Server dies → app goes down   │
  │  - Manual scaling                │
  │  - No load balancing             │
  └──────────────────────────────────┘

Kubernetes (cluster of hosts):
  ┌────────────────────────────────────────────────────────┐
  │                   Kubernetes Cluster                   │
  │                                                        │
  │  ┌──────────────┐    ┌────────────────────────────┐   │
  │  │ Control Plane│    │       Worker Nodes         │   │
  │  │              │    │                            │   │
  │  │  API Server  │───▶│  Node 1: [pod][pod]        │   │
  │  │  Scheduler   │    │  Node 2: [pod][pod][pod]   │   │
  │  │  Controller  │    │  Node 3: [pod][pod]        │   │
  │  │  etcd (state)│    │                            │   │
  │  └──────────────┘    └────────────────────────────┘   │
  │                                                        │
  │  K8s handles: scheduling, auto-restart, scaling,       │
  │  rolling updates, service discovery, load balancing    │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Core Concepts: Pod, Deployment, Service

### Pod — the smallest unit

A Pod wraps one or more containers that share a network namespace and storage. Pods are ephemeral — they can be killed and replaced.

```
┌─────────────────────────────────────┐
│ Pod: myapp-7d9f4b-xk2p              │
│  IP: 10.244.1.5                     │
│                                     │
│  ┌────────────────┐                 │
│  │ Container:     │                 │
│  │  myapp:sha-abc │  port 3000      │
│  └────────────────┘                 │
│                                     │
│  ┌────────────────┐                 │
│  │ Sidecar:       │  (optional)     │
│  │  log-collector │  port 9090      │
│  └────────────────┘                 │
└─────────────────────────────────────┘
```

### Deployment — manages replicas and rollouts

A Deployment declares the desired state: which image to run, how many replicas, update strategy. The Deployment controller continuously reconciles actual state to match.

```
Deployment: myapp
  replicas: 3
  image: myorg/myapp:1.4.2

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  Pod 1   │  │  Pod 2   │  │  Pod 3   │
  │ myapp    │  │ myapp    │  │ myapp    │
  │ :1.4.2   │  │ :1.4.2   │  │ :1.4.2   │
  └──────────┘  └──────────┘  └──────────┘

If Pod 1 dies → Deployment controller creates Pod 4 immediately
If you update image to :1.4.3 → rolling update, zero downtime
```

### Service — stable endpoint for a set of Pods

Pods have dynamic IPs. A Service provides a stable DNS name and IP that load-balances across matching Pods via label selectors.

```
Client
  │
  ▼
Service: myapp-svc  (ClusterIP: 10.96.42.1)
  │  label selector: app=myapp
  ├──▶ Pod 1 (10.244.1.5)
  ├──▶ Pod 2 (10.244.2.3)
  └──▶ Pod 3 (10.244.3.7)

Pod IPs change on restart — Service IP never changes
```

### Object hierarchy

```
Deployment
  └── ReplicaSet (managed automatically)
        └── Pod  ×  N
              └── Container (your Docker image)
```

---

## 3. Deployment YAML with a Docker Image

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp                   # must match template labels
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1            # at most 1 pod down during update
      maxSurge: 1                  # at most 1 extra pod during update
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myorg/myapp:1.4.2   # your Docker image from CI/CD
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: database-url
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
      imagePullSecrets:
        - name: dockerhub-credentials  # if using private registry
```

### Service YAML

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
  namespace: production
spec:
  selector:
    app: myapp              # routes to all pods with this label
  ports:
    - protocol: TCP
      port: 80              # Service port (what clients connect to)
      targetPort: 3000      # Container port (your app listens here)
  type: LoadBalancer        # see next section for types
```

### Apply both resources

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# or apply a whole directory
kubectl apply -f k8s/
```

---

## 4. Service Types: ClusterIP vs NodePort vs LoadBalancer

```
┌─────────────────────────────────────────────────────────────────┐
│  ClusterIP (default)                                            │
│  ─────────────────                                              │
│  Accessible only inside the cluster.                            │
│  Use for: internal microservice communication.                  │
│                                                                 │
│  [Pod A] ──▶ myapp-svc:80 (ClusterIP) ──▶ [Pod B][Pod C]       │
│  Internet: ✗                                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  NodePort                                                       │
│  ────────                                                       │
│  Opens a high port (30000-32767) on every node.                 │
│  Use for: development, on-prem without cloud LB.                │
│                                                                 │
│  Internet ──▶ NodeIP:30080 ──▶ Service ──▶ [Pods]              │
│  Internet: ✓ (but ugly port, manual DNS)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LoadBalancer                                                   │
│  ────────────                                                   │
│  Provisions a cloud load balancer (AWS ELB, GCP LB, Azure LB). │
│  Use for: production internet-facing services.                  │
│                                                                 │
│  Internet ──▶ cloud-lb:80 ──▶ NodePort ──▶ Service ──▶ [Pods]  │
│  Internet: ✓ (clean DNS, TLS termination at LB)                 │
└─────────────────────────────────────────────────────────────────┘
```

| Type | Reachable from | Typical use |
|------|---------------|-------------|
| ClusterIP | Inside cluster only | DB, cache, internal APIs |
| NodePort | Node IP + high port | Dev/test, on-prem |
| LoadBalancer | Public internet | Production web services |

---

## 5. Essential kubectl Commands

### Apply and inspect

```bash
# Apply manifests
kubectl apply -f deployment.yaml
kubectl apply -f k8s/                       # apply all files in directory

# Get resources
kubectl get pods                            # list pods (default namespace)
kubectl get pods -n production              # specific namespace
kubectl get deployments -n production
kubectl get services -n production
kubectl get all -n production               # pods, deployments, services

# Describe — detailed info, events at the bottom
kubectl describe pod myapp-7d9f4b-xk2p -n production
kubectl describe deployment myapp -n production
```

### Logs and debugging

```bash
# View logs
kubectl logs myapp-7d9f4b-xk2p             # logs from a pod
kubectl logs -f myapp-7d9f4b-xk2p          # follow (like tail -f)
kubectl logs myapp-7d9f4b-xk2p -c myapp    # specific container in pod
kubectl logs -l app=myapp --all-containers  # all pods matching label

# Exec into a running pod
kubectl exec -it myapp-7d9f4b-xk2p -- /bin/sh

# Port-forward for local testing
kubectl port-forward svc/myapp-svc 8080:80 -n production
# now http://localhost:8080 → your production service
```

### Rolling updates and rollbacks

```bash
# Update image (triggers rolling update)
kubectl set image deployment/myapp \
  myapp=myorg/myapp:1.4.3 \
  -n production

# Check rollout status
kubectl rollout status deployment/myapp -n production

# View rollout history
kubectl rollout history deployment/myapp -n production

# Rollback to previous version
kubectl rollout undo deployment/myapp -n production

# Rollback to specific revision
kubectl rollout undo deployment/myapp --to-revision=2 -n production
```

### Scale and delete

```bash
# Scale replicas manually
kubectl scale deployment myapp --replicas=5 -n production

# Delete resources
kubectl delete -f deployment.yaml
kubectl delete pod myapp-7d9f4b-xk2p       # pod is recreated by Deployment
kubectl delete deployment myapp -n production
```

---

## 6. Hands-On Exercises

**Exercise 1:** Install `kubectl` and set up a local Kubernetes cluster using Docker Desktop (enable Kubernetes in Settings) or `minikube start`. Run `kubectl get nodes` and confirm the node is in `Ready` state.

**Exercise 2:** Write a `deployment.yaml` for `nginx:1.25` with 2 replicas. Apply it with `kubectl apply -f deployment.yaml`. Run `kubectl get pods` and confirm 2 pods are running. Then `kubectl describe pod <name>` and read the Events section.

**Exercise 3:** Add a `service.yaml` of type `NodePort` for your nginx Deployment. Apply it, then run `kubectl get svc` and note the NodePort assigned. Access it at `http://localhost:<nodeport>` (Docker Desktop) or `minikube service nginx-svc --url`.

**Exercise 4:** Perform a rolling update: change the Deployment image from `nginx:1.25` to `nginx:1.27`. Run `kubectl rollout status deployment/nginx` to watch the update. Then roll back with `kubectl rollout undo deployment/nginx` and verify the old image is restored.

**Exercise 5:** Scale the Deployment to 4 replicas with `kubectl scale`. Run `kubectl get pods -w` to watch pods being created. Then delete one pod manually — observe Kubernetes immediately create a replacement to maintain the desired count.

---

## 7. Interview Q&A

**Q: What is the difference between a Pod, a Deployment, and a Service in Kubernetes?**
Answer: A Pod is the smallest schedulable unit — one or more containers sharing network and storage. A Deployment manages a set of identical replica Pods, handling scheduling, restarts, and rolling updates. A Service provides a stable DNS name and IP that load-balances traffic across whichever Pods match its label selector, abstracting away the ephemeral nature of Pod IPs.

**Q: How does a Docker image get into Kubernetes?**
Answer: You specify the image in the `spec.containers[].image` field of a Pod or Deployment manifest. When Kubernetes schedules the Pod onto a node, the node's container runtime (containerd) pulls the image from the registry — Docker Hub, ECR, GCR, or a private registry — and creates the container. Credentials for private registries are provided via an `imagePullSecret`.

**Q: What is a liveness probe vs a readiness probe?**
Answer: A liveness probe checks if the container is still alive — if it fails, Kubernetes kills and restarts the container. A readiness probe checks if the container is ready to receive traffic — if it fails, Kubernetes removes the Pod from the Service's endpoints (stops sending traffic) without restarting it. Use liveness for deadlock detection, readiness for startup delays and dependency checks.

**Q: What happens during a Kubernetes rolling update?**
Answer: The Deployment controller incrementally replaces old Pods with new ones. With `maxUnavailable: 1` and `maxSurge: 1`, it creates one new Pod, waits for it to pass readiness checks, then terminates one old Pod, and repeats until all Pods run the new image. Traffic is only routed to ready Pods throughout, achieving zero downtime. If the new Pods fail readiness, the rollout pauses automatically.

**Q: What is the difference between ClusterIP and LoadBalancer service types?**
Answer: ClusterIP (default) creates a virtual IP accessible only inside the cluster — other Pods reach it by DNS name. LoadBalancer provisions an external cloud load balancer (e.g., AWS ELB) with a public IP, making the service reachable from the internet. NodePort is the middle ground — opens a static port on every node that external clients can reach, but without a managed cloud load balancer in front.
