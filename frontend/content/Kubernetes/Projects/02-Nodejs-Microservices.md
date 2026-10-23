# Project 2: Node.js Microservices on Kubernetes

**Level:** Beginner
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 1-5 (Fundamentals, Architecture, Workloads, Services, Configuration)

---

## Overview

You will deploy a two-tier microservices application inside a dedicated Kubernetes namespace. A Node.js REST API backend runs as three replicas behind a ClusterIP Service, reachable only inside the cluster. A lightweight Nginx frontend runs as two replicas, configured via ConfigMap to reverse-proxy all `/api` requests to the backend by its DNS name. Traffic enters the cluster through a NodePort Service on the frontend, flows over Kubernetes DNS to the backend ClusterIP, and returns JSON that the frontend renders as HTML.

```
Browser
   │
NodePort (port 30090)
   │
Service: frontend-svc  (ClusterIP + NodePort)
   │
┌──┴─────────────────┐
│  Pod   Pod         │  ← 2 replicas (Nginx, proxy config via ConfigMap)
│  nginx nginx       │
└──┬─────────────────┘
   │  /api/* → http://api-svc:3000
   │
Service: api-svc  (ClusterIP, port 3000)
   │
┌──┴──────────────────────────┐
│  Pod     Pod     Pod        │  ← 3 replicas (Node.js API)
│  api     api     api        │
└─────────────────────────────┘
        Deployment: api
Namespace: microservices
```

---

## Prerequisites

- minikube running (`minikube start`)
- kubectl configured (`kubectl config current-context` → `minikube`)
- Project 1 completed — you understand Deployments, Services, and ConfigMaps
- Docker installed locally (to build the API image and load it into minikube)

---

## What You'll Learn

- Creating and using a dedicated Kubernetes **namespace** to isolate resources
- Writing a simple Node.js HTTP server and building its container image
- Loading a locally-built image into minikube without a registry
- Configuring Nginx as a **reverse proxy** via a ConfigMap-mounted `nginx.conf`
- Injecting runtime values into containers using **environment variables**
- Discovering services across Pods using **Kubernetes DNS** (`<service>.<namespace>.svc.cluster.local`)
- Verifying inter-service communication by exec-ing into a running Pod

---

## Project Structure

```
02-nodejs-microservices/
├── api/
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── api-deployment.yaml
├── api-service.yaml
├── frontend-configmap.yaml
├── frontend-deployment.yaml
└── frontend-service.yaml
```

---

## Step-by-Step Guide

### Step 1 — Create the project directory and namespace

```bash
mkdir 02-nodejs-microservices && cd 02-nodejs-microservices

# Create the namespace so all resources live together
kubectl create namespace microservices

# Set it as the default for this session (optional but convenient)
kubectl config set-context --current --namespace=microservices
```

Verify:

```bash
kubectl get namespace microservices
# NAME           STATUS   AGE
# microservices  Active   5s
```

### Step 2 — Build the Node.js API

Create the application directory and source files:

```bash
mkdir api && cd api
```

Create `api/package.json`:

```json
{
  "name": "k8s-api",
  "version": "1.0.0",
  "description": "Simple REST API for Kubernetes microservices project",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {}
}
```

Create `api/server.js`:

```javascript
const http = require('http');
const os   = require('os');

const PORT     = process.env.PORT     || 3000;
const APP_ENV  = process.env.APP_ENV  || 'development';
const APP_NAME = process.env.APP_NAME || 'k8s-api';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/api/info') {
    const payload = {
      app:       APP_NAME,
      env:       APP_ENV,
      pod:       os.hostname(),          // Pod name injected by Kubernetes
      timestamp: new Date().toISOString(),
      message:   'Hello from the Node.js API running inside Kubernetes!',
    };
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Served-By':  os.hostname(),
    });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
});

server.listen(PORT, () => {
  console.log(`[${APP_NAME}] listening on port ${PORT} (env: ${APP_ENV})`);
});
```

Create `api/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifest first for layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY server.js ./

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
```

Build the image and load it directly into minikube's Docker daemon (no registry needed):

```bash
cd ..   # back to 02-nodejs-microservices/

# Point your shell's Docker CLI at minikube's Docker daemon
eval $(minikube docker-env)

# Build the image
docker build -t k8s-api:1.0 ./api

# Verify the image is visible to minikube
docker images | grep k8s-api
# k8s-api   1.0   a1b2c3d4e5f6   10 seconds ago   120MB
```

### Step 3 — Write the API Deployment

Create `api-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: microservices
  labels:
    app: api
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: api
        tier: backend
    spec:
      containers:
        - name: api
          image: k8s-api:1.0
          imagePullPolicy: Never       # Use the locally loaded image; skip pulling from a registry
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
            - name: APP_ENV
              value: "production"
            - name: APP_NAME
              value: "k8s-api"
            - name: POD_NAME           # Inject the actual Pod name at runtime via the Downward API
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

### Step 4 — Write the API Service

Create `api-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-svc
  namespace: microservices
  labels:
    app: api
    tier: backend
spec:
  type: ClusterIP          # Internal-only; no external exposure
  selector:
    app: api               # Routes traffic to Pods with this label
  ports:
    - protocol: TCP
      port: 3000           # Port clients use to reach the Service
      targetPort: 3000     # Port the container listens on
```

The DNS name `api-svc.microservices.svc.cluster.local` (or simply `api-svc` from within the same namespace) now resolves to this Service's ClusterIP.

### Step 5 — Write the frontend Nginx ConfigMap

The ConfigMap holds a custom `nginx.conf` that proxies `/api` requests to the backend Service by its DNS name.

Create `frontend-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-nginx-config
  namespace: microservices
  labels:
    app: frontend
    tier: frontend
data:
  nginx.conf: |
    events {
      worker_connections 1024;
    }

    http {
      include       /etc/nginx/mime.types;
      default_type  application/octet-stream;

      # Kubernetes DNS resolver — required for dynamic upstream resolution
      resolver kube-dns.kube-system.svc.cluster.local valid=10s;

      server {
        listen 80;
        server_name _;

        # Serve the frontend HTML
        location / {
          root  /usr/share/nginx/html;
          index index.html;
        }

        # Reverse proxy: forward /api/* to the Node.js backend by its DNS name
        location /api/ {
          proxy_pass         http://api-svc.microservices.svc.cluster.local:3000;
          proxy_http_version 1.1;
          proxy_set_header   Host              $host;
          proxy_set_header   X-Real-IP         $remote_addr;
          proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
          proxy_read_timeout 30s;
        }

        # Health check endpoint for the frontend itself
        location /health {
          return 200 'ok';
          add_header Content-Type text/plain;
        }
      }
    }

  index.html: |
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>K8s Microservices Demo</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a;
               color: #e2e8f0; min-height: 100vh; display: flex;
               flex-direction: column; align-items: center; padding: 3rem 1rem; }
        h1  { color: #38bdf8; font-size: 2rem; margin-bottom: 0.5rem; }
        p.sub { color: #94a3b8; margin-bottom: 2rem; }
        .card { background: #1e293b; border-radius: 12px; padding: 2rem;
                width: 100%; max-width: 560px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .card h2 { font-size: 1rem; color: #7dd3fc; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
        pre  { background: #0f172a; border-radius: 8px; padding: 1rem;
               font-size: 0.85rem; color: #a5f3fc; overflow-x: auto; white-space: pre-wrap; }
        button { margin-top: 1.5rem; padding: 0.6rem 1.6rem; background: #0284c7;
                 color: white; border: none; border-radius: 8px; cursor: pointer;
                 font-size: 0.95rem; transition: background 0.2s; }
        button:hover { background: #0369a1; }
        .badge { display: inline-block; margin-top: 2rem; padding: 0.3rem 0.9rem;
                 background: #1e3a5f; border-radius: 20px; font-size: 0.8rem; color: #7dd3fc; }
      </style>
    </head>
    <body>
      <h1>Kubernetes Microservices</h1>
      <p class="sub">Frontend (Nginx) → API (Node.js) via Kubernetes DNS</p>

      <div class="card">
        <h2>API Response</h2>
        <pre id="output">Click the button to call /api/info ...</pre>
        <button onclick="fetchAPI()">Call the API</button>
      </div>

      <div class="badge">Kubernetes Master Course · Project 2</div>

      <script>
        async function fetchAPI() {
          const el = document.getElementById('output');
          el.textContent = 'Fetching...';
          try {
            const res  = await fetch('/api/info');
            const data = await res.json();
            el.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            el.textContent = 'Error: ' + err.message;
          }
        }
      </script>
    </body>
    </html>
```

### Step 6 — Write the Frontend Deployment

Create `frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: microservices
  labels:
    app: frontend
    tier: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: frontend
        tier: frontend
    spec:
      containers:
        - name: nginx
          image: nginx:1.25-alpine
          ports:
            - containerPort: 80
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/nginx.conf
              subPath: nginx.conf          # Mount only this key, not the entire directory
            - name: nginx-config
              mountPath: /usr/share/nginx/html/index.html
              subPath: index.html
          resources:
            requests:
              cpu: "30m"
              memory: "32Mi"
            limits:
              cpu: "100m"
              memory: "64Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 20
      volumes:
        - name: nginx-config
          configMap:
            name: frontend-nginx-config
```

### Step 7 — Write the Frontend Service

Create `frontend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-svc
  namespace: microservices
  labels:
    app: frontend
    tier: frontend
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
    - protocol: TCP
      port: 80             # Cluster-internal port
      targetPort: 80       # Container port
      nodePort: 30090      # External port on the Node
```

### Step 8 — Apply all manifests and verify

Apply everything in order (ConfigMap before Deployments so volumes are available):

```bash
kubectl apply -f api-service.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f frontend-configmap.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
```

Wait for all Pods to reach Running state:

```bash
kubectl get pods -n microservices -w
# NAME                        READY   STATUS    RESTARTS   AGE
# api-6d8f9c7b5-2hkpq         1/1     Running   0          30s
# api-6d8f9c7b5-7xtqr         1/1     Running   0          30s
# api-6d8f9c7b5-m4wnp         1/1     Running   0          30s
# frontend-5c9db7f4c-8rjsw    1/1     Running   0          25s
# frontend-5c9db7f4c-v2nlk    1/1     Running   0          25s
```

Inspect the Services:

```bash
kubectl get services -n microservices
# NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
# api-svc        ClusterIP   10.96.112.44    <none>        3000/TCP         40s
# frontend-svc   NodePort    10.96.201.87    <none>        80:30090/TCP     35s
```

### Step 9 — Verify DNS resolution and inter-service communication

Exec into a frontend Pod and resolve the API Service DNS name manually:

```bash
# Get a frontend Pod name
FRONTEND_POD=$(kubectl get pod -n microservices -l app=frontend -o name | head -1)

# Resolve the API Service via Kubernetes DNS
kubectl exec -n microservices "$FRONTEND_POD" -- \
  nslookup api-svc.microservices.svc.cluster.local
# Server:    10.96.0.10
# Address:   10.96.0.10:53
# Name:      api-svc.microservices.svc.cluster.local
# Address:   10.96.112.44

# Call the API directly from inside the frontend Pod
kubectl exec -n microservices "$FRONTEND_POD" -- \
  wget -qO- http://api-svc:3000/api/info
# {
#   "app": "k8s-api",
#   "env": "production",
#   "pod": "api-6d8f9c7b5-2hkpq",
#   "timestamp": "2024-11-15T10:23:45.123Z",
#   "message": "Hello from the Node.js API running inside Kubernetes!"
# }
```

Each call returns a different `pod` value as the ClusterIP Service load-balances across the three API replicas.

### Step 10 — Test end-to-end through the frontend

```bash
# Open in browser
minikube service frontend-svc -n microservices

# Or test via curl
FRONTEND_URL=$(minikube service frontend-svc -n microservices --url)

# Test the frontend health endpoint
curl -s "$FRONTEND_URL/health"
# ok

# Test that the Nginx proxy correctly forwards to the API
curl -s "$FRONTEND_URL/api/info" | python3 -m json.tool
# {
#     "app": "k8s-api",
#     "env": "production",
#     "pod": "api-6d8f9c7b5-7xtqr",
#     "timestamp": "2024-11-15T10:24:12.456Z",
#     "message": "Hello from the Node.js API running inside Kubernetes!"
# }

# Call multiple times to observe load balancing across API replicas
for i in $(seq 1 6); do
  curl -s "$FRONTEND_URL/api/info" | grep '"pod"'
done
# "pod": "api-6d8f9c7b5-2hkpq",
# "pod": "api-6d8f9c7b5-7xtqr",
# "pod": "api-6d8f9c7b5-m4wnp",
# "pod": "api-6d8f9c7b5-2hkpq",
# "pod": "api-6d8f9c7b5-7xtqr",
# "pod": "api-6d8f9c7b5-m4wnp",
```

### Step 11 — Inspect logs across all replicas

```bash
# Stream logs from all API Pods simultaneously using a label selector
kubectl logs -n microservices -l app=api --follow --prefix

# Check frontend Nginx access logs to see proxy forwarding
kubectl logs -n microservices -l app=frontend --prefix
```

### Step 12 — Clean up

```bash
kubectl delete namespace microservices

# Reset context back to default namespace
kubectl config set-context --current --namespace=default
```

---

## Verification

| Check | Command | Expected result |
|-------|---------|-----------------|
| Namespace exists | `kubectl get ns microservices` | `STATUS Active` |
| API Pods running | `kubectl get pods -n microservices -l app=api` | 3 Pods, STATUS `Running` |
| Frontend Pods running | `kubectl get pods -n microservices -l app=frontend` | 2 Pods, STATUS `Running` |
| API Service (ClusterIP) | `kubectl get svc api-svc -n microservices` | `TYPE ClusterIP`, port `3000` |
| Frontend Service (NodePort) | `kubectl get svc frontend-svc -n microservices` | `TYPE NodePort`, `80:30090/TCP` |
| DNS resolves inside cluster | `kubectl exec -n microservices <frontend-pod> -- nslookup api-svc` | Returns an IP address |
| API reachable via proxy | `curl $(minikube service frontend-svc -n microservices --url)/api/info` | JSON with `pod` and `timestamp` |
| Load balancing working | Run curl 6x, check `pod` field | At least 2 different pod names |

---

## Challenges

1. **Add a third tier** — deploy a Redis StatefulSet in the same namespace and update the Node.js API to increment a request counter in Redis. Return the counter value in the `/api/info` response. The API should connect to Redis using its ClusterIP Service DNS name.

2. **ConfigMap hot-reload** — update the `frontend-configmap.yaml` to change the page title, apply it with `kubectl apply`, and observe how long it takes for the running Nginx Pods to pick up the change. Then force an immediate reload by deleting all frontend Pods and letting the Deployment recreate them.

3. **Simulate API failure** — scale the API Deployment to zero replicas (`kubectl scale deployment api --replicas=0 -n microservices`). Observe the frontend behaviour when the upstream is unavailable. Then update the Nginx config to return a custom 503 error page using an `error_page` directive and redeploy.

4. **Resource-based scaling** — add resource `requests` and `limits` to both Deployments, enable the metrics-server addon in minikube (`minikube addons enable metrics-server`), and create a HorizontalPodAutoscaler that scales the API between 2 and 6 replicas when CPU utilisation exceeds 50%. Generate load with a `kubectl run` busybox loop and watch the HPA react.

---

## Key Takeaways

- **Namespaces** provide isolation and a scope for RBAC, resource quotas, and network policies — always use a dedicated namespace per application or team.
- **ClusterIP Services** expose workloads inside the cluster only. The API does not need a NodePort or LoadBalancer because only the frontend (also inside the cluster) calls it.
- **Kubernetes DNS** automatically creates an A record for every Service: `<service-name>.<namespace>.svc.cluster.local`. Within the same namespace, the short name `<service-name>` is sufficient.
- **ConfigMap-mounted files** let you inject an entire `nginx.conf` into a running container without baking configuration into the image. The same Nginx image can serve as a proxy in one environment and a static file server in another.
- **Environment variables** injected via `env:` and the **Downward API** (`fieldRef: metadata.name`) allow containers to be self-aware of their own identity at runtime — useful for logging and tracing.
- **imagePullPolicy: Never** tells Kubernetes to use the image already present in the node's local Docker daemon, which is the correct approach when developing with minikube and building images locally.
