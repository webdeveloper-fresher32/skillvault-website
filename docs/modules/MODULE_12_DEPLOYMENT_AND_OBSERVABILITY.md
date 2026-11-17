# Module 12: Production Deployment, IaC & SRE Observability

| Specification | Details |
| :--- | :--- |
| **Module Number** | 12 of 12 |
| **Topic** | Multi-Stage Dockerfiles, Kubernetes Helm Charts, OpenTelemetry Tracing & Prometheus Dashboards |
| **Target System** | Docker, Kubernetes, NGINX Ingress, OpenTelemetry, Prometheus, LangSmith |
| **Engineering Level** | Staff SRE & Cloud Infrastructure Architect |

---

## 1. Production Deployment Topology

```
                                  INTERNET
                                     │
                                     ▼
                      [NGINX Ingress Controller]
            (Proxy Buffering: OFF | Keep-Alive: 3600s)
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
       [Next.js 16 Frontend Pods]             [Node.js API Gateway Pods]
         (HPA: 2 to 10 Replicas)                 (HPA: 3 to 15 Replicas)
                                                         │
                                                         ▼
                                              [Python FastAPI AI Pods]
                                                (HPA: 3 to 20 Replicas)
                                                         │
                        ┌────────────────────────────────┴──────────────────┐
                        ▼                                                   ▼
            [Managed PostgreSQL 16]                               [Redis 7 Cluster]
          (pgvector + Connection Pooler)                         (Rate Limit & Cache)
```

---

## 2. ADR: Container Orchestration & Deployment

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CONTAINER DEPLOYMENT PLATFORMS                                  │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Platform                 │ Scaling Architecture        │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Kubernetes (EKS/GKE)  │ Pod Autoscalers (HPA/KEDA)  │ 🏆 SELECTED (Granular node pool scaling) │
│ 2. Serverless Containers │ AWS ECS Fargate             │ ❌ REJECTED (High cold-start latency)    │
│ 3. Serverless Functions  │ AWS Lambda / Vercel Edge    │ ❌ REJECTED (15s execution timeout cap)  │
│ 4. Single Virtual Server │ Docker Compose on EC2       │ ❌ REJECTED (Single point of failure)    │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

### **🏆 1. Kubernetes (EKS / GKE) with HPA — SELECTED**
* **Why Selected:**
  * **Independent Scaling Profiles:** Node.js Gateway scales on I/O connection count; Python AI service scales on CPU/GPU utilization; Next.js scales on HTTP requests.
  * **Zero Cold-Starts:** Continuous warm worker pool guarantees that Time-To-First-Token is never penalized by 3-second container initialization delays.

---

## 3. Concrete Production Infrastructure as Code (IaC)

### 3.1 Python FastAPI Multi-Stage Dockerfile (`backend-ai/Dockerfile`)
```dockerfile
# Stage 1: Dependency Builder
FROM python:3.11-slim AS builder

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download FlashRank ONNX model during build to eliminate runtime cold-starts
RUN python -c "from flashrank import Ranker; Ranker(model_name='ms-marco-MiniLM-L-12-v2', cache_dir='/build/models')"

# Stage 2: Minimal Distroless / Hardened Runtime
FROM python:3.11-slim AS runner

WORKDIR /app
RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh appuser

COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /build/models /tmp/models
COPY . .

ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    MODEL_CACHE_DIR=/tmp/models

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--loop", "uvloop"]
```

### 3.2 Kubernetes Deployment & Ingress (`k8s/deployment.yaml`)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskflow-ai-service
  labels:
    app: taskflow-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: taskflow-ai
  template:
    metadata:
      labels:
        app: taskflow-ai
    spec:
      containers:
        - name: ai-service
          image: taskflow-ai:v1.0.0
          ports:
            - containerPort: 8000
          resources:
            requests:
              cpu: "1000m"
              memory: "1536Mi"
            limits:
              cpu: "2500m"
              memory: "3072Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          envFrom:
            - configMapRef:
                name: taskflow-ai-config
            - secretRef:
                name: taskflow-ai-secrets
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: taskflow-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-buffering: "off" # Mandatory for SSE streaming
spec:
  rules:
    - host: api.taskflow.dev
      http:
        paths:
          - path: /api/v1/ai
            pathType: Prefix
            backend:
              service:
                name: taskflow-ai-service
                port:
                  number: 8000
```

### 3.3 OpenTelemetry & Prometheus Metrics (`app/core/telemetry.py`)
```python
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Prometheus Instrumentation Metrics
AI_REQUEST_LATENCY = Histogram(
    "ai_request_duration_seconds",
    "Time spent generating full AI response",
    ["intent", "tenant_tier"]
)

AI_TOKENS_CONSUMED = Counter(
    "ai_tokens_consumed_total",
    "Total LLM tokens consumed",
    ["model", "token_type"] # prompt vs completion
)

CACHE_HITS = Counter("ai_semantic_cache_hits_total", "Count of Redis semantic cache hits")
CACHE_MISSES = Counter("ai_semantic_cache_misses_total", "Count of Redis semantic cache misses")

def metrics_endpoint():
    return Response(generate_latest(), media_type="text/plain")
```

---

## 4. Final SRE Checklist & Verification

| Production Verification | Command / Check | Expected Health Result |
| :--- | :--- | :--- |
| **Ingress Buffering Check** | `curl -N https://api.taskflow.dev/api/v1/ai/chat/stream` | First token arrives in $<800\text{ms}$; chunks appear continuously. |
| **HPA Scale Under Load** | Run Locust load test (500 users) | Pods scale automatically from 3 to 12 when CPU exceeds $70\%$. |
| **Non-Root User Security** | `docker exec <container> id` | Returns `uid=1001(appuser)` (Never runs as root). |
| **Trace Context Propagation** | Check LangSmith / Jaeger UI | Single distributed trace spans `Next.js -> Node Gateway -> FastAPI -> pgvector`. |
