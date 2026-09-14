# Project 1: Deploy Static App on Kubernetes

**Level:** Beginner
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 1-3 (Fundamentals, Architecture, Workloads)

---

## Overview

You will write a Kubernetes Deployment to run three replicas of Nginx and expose them through a NodePort Service on minikube. Traffic is load-balanced across all three Pods automatically. The goal is to get comfortable with the core Kubernetes workflow: author YAML manifests, apply them with kubectl, inspect resource state, and access a running service.

```
Internet
   │
NodePort (port 30080)
   │
Service (my-nginx-svc)
   │
┌──┴────────────────────┐
│  Pod   Pod   Pod      │  ← 3 replicas
│  nginx nginx nginx    │
└───────────────────────┘
        Deployment (my-nginx)
```

---

## Prerequisites

- minikube installed and running (`minikube start`)
- kubectl configured to talk to minikube (`kubectl config current-context` → `minikube`)
- Basic familiarity with YAML syntax

---

## What You'll Learn

- Writing a Deployment manifest with replica count, labels, and a container spec
- Writing a NodePort Service manifest and understanding selector matching
- Using `kubectl apply -f` for declarative resource management
- Inspecting Pods, Deployments, and Services with kubectl
- Accessing a Service through minikube's NodePort tunnel

---

## Project Structure

```
01-deploy-static-app/
├── deployment.yaml
├── service.yaml
└── configmap.yaml
```

---

## Step-by-Step Guide

### Step 1 — Start minikube

```bash
minikube start --cpus=2 --memory=2048

# Verify the cluster is healthy
kubectl cluster-info
kubectl get nodes
```

Expected output:
```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   30s   v1.29.0
```

### Step 2 — Create the project directory

```bash
mkdir 01-deploy-static-app && cd 01-deploy-static-app
```

### Step 3 — Write the ConfigMap (custom HTML)

Create `configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-html
  labels:
    app: my-nginx
data:
  index.html: |
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Kubernetes Static App</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center;
               align-items: center; min-height: 100vh; margin: 0;
               background: #0f172a; color: #e2e8f0; }
        .card { text-align: center; background: #1e293b; padding: 3rem 4rem;
                border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; }
        p  { color: #94a3b8; }
        .badge { display: inline-block; margin-top: 1.5rem; padding: 0.4rem 1rem;
                 background: #0284c7; border-radius: 20px; font-size: 0.85rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Hello from Kubernetes!</h1>
        <p>Served by <strong>Nginx</strong> running inside a Pod.</p>
        <p>Three replicas are sharing this traffic.</p>
        <div class="badge">Kubernetes Master Course · Project 1</div>
      </div>
    </body>
    </html>
```

### Step 4 — Write the Deployment manifest

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nginx
  labels:
    app: my-nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-nginx
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: my-nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.25-alpine
          ports:
            - containerPort: 80
          volumeMounts:
            - name: html-volume
              mountPath: /usr/share/nginx/html
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 20
      volumes:
        - name: html-volume
          configMap:
            name: nginx-html
```

### Step 5 — Write the Service manifest

Create `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-nginx-svc
  labels:
    app: my-nginx
spec:
  type: NodePort
  selector:
    app: my-nginx          # Must match Pod labels in the Deployment template
  ports:
    - protocol: TCP
      port: 80             # Port on the Service (cluster-internal)
      targetPort: 80       # Port on the Pod
      nodePort: 30080      # Port on the Node (accessible from outside)
```

### Step 6 — Apply all manifests

```bash
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

Or apply the entire directory at once:

```bash
kubectl apply -f .
```

### Step 7 — Verify the resources

```bash
# Check the Deployment
kubectl get deployment my-nginx
# NAME       READY   UP-TO-DATE   AVAILABLE   AGE
# my-nginx   3/3     3            3           45s

# Check the Pods
kubectl get pods -l app=my-nginx
# NAME                        READY   STATUS    RESTARTS   AGE
# my-nginx-7d6f8d9c4-4xkzp   1/1     Running   0          45s
# my-nginx-7d6f8d9c4-j2rkm   1/1     Running   0          45s
# my-nginx-7d6f8d9c4-p9wqn   1/1     Running   0          45s

# Check the Service
kubectl get service my-nginx-svc
# NAME           TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
# my-nginx-svc   NodePort   10.96.45.123   <none>        80:30080/TCP   30s
```

### Step 8 — Access the application

```bash
# Open in browser via minikube
minikube service my-nginx-svc

# Or get the URL and curl it
MINIKUBE_URL=$(minikube service my-nginx-svc --url)
curl -s "$MINIKUBE_URL" | grep -o "<title>.*</title>"
# Expected: <title>Kubernetes Static App</title>
```

### Step 9 — Observe load balancing

Run this loop to see requests hitting different Pods:

```bash
for i in $(seq 1 9); do
  kubectl exec -it $(kubectl get pod -l app=my-nginx -o name | head -1) \
    -- sh -c 'echo "Pod: $HOSTNAME"'
done
```

### Step 10 — Perform a rolling update

Update the Nginx version without downtime:

```bash
kubectl set image deployment/my-nginx nginx=nginx:1.26-alpine

# Watch the rollout in real time
kubectl rollout status deployment/my-nginx

# View rollout history
kubectl rollout history deployment/my-nginx

# Roll back if needed
kubectl rollout undo deployment/my-nginx
```

### Step 11 — Clean up

```bash
kubectl delete -f .
```

---

## Verification

| Check | Command | Expected result |
|-------|---------|-----------------|
| Deployment healthy | `kubectl get deployment my-nginx` | `READY 3/3` |
| All Pods running | `kubectl get pods -l app=my-nginx` | 3 Pods, STATUS `Running` |
| Service created | `kubectl get svc my-nginx-svc` | NodePort `80:30080/TCP` |
| HTTP response | `curl -o /dev/null -sw "%{http_code}" $(minikube service my-nginx-svc --url)` | `200` |

---

## Challenges

1. **Scale to 5 replicas** — use `kubectl scale deployment my-nginx --replicas=5` then observe how Kubernetes schedules the new Pods.
2. **Resource quotas** — add a `ResourceQuota` to the default namespace that limits total CPU to 500m and memory to 512Mi. See what happens when your Deployment exceeds the quota.
3. **Pod disruption budget** — create a `PodDisruptionBudget` that ensures at least 2 Pods remain available during voluntary disruptions, then `kubectl drain` the minikube node to test it.

---

## Key Takeaways

- A **Deployment** manages the desired replica count and rolling update strategy for stateless Pods.
- A **Service** provides a stable virtual IP and DNS name that load-balances across matching Pods, even as Pods are replaced.
- **Labels and selectors** are the glue — the Service's `selector` must match the Pod template's `labels`.
- **ConfigMaps** decouple configuration from container images, enabling the same image to behave differently in different environments.
- **Readiness and liveness probes** protect your users: Kubernetes only routes traffic to Pods that pass readiness checks and restarts Pods that fail liveness checks.
