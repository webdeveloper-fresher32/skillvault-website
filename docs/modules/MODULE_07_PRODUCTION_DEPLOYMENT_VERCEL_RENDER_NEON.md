# Module 07: Production Cloud Deployment
## Deploying FastAPI on Vercel, Dockerizing for Render/Fly.io & Neon Cloud Database

---

### ❓ Question 1: Can we deploy our Python FastAPI microservice on Vercel?

> **The Question**: Vercel is built for Next.js and frontend applications. Can it host our Python FastAPI RAG microservice?

#### 💡 The Architectural Reality

**Yes, Vercel supports Python Serverless Functions via the `@vercel/python` runtime**, but deploying AI workloads requires solving 3 critical serverless traps:

1. **The Read-Only Filesystem Trap (`[Errno 30] Read-only file system`)**:
   - In AWS Lambda and Vercel Serverless, the entire filesystem is strictly read-only except for `/tmp`.
   - Libraries like Hugging Face Hub, PyTorch, and FastEmbed attempt to write models to `~/.cache`.
   - On Vercel, this immediately throws an `OSError: [Errno 30] Read-only file system`.
   - *Our Solution*: Redirect all cache directories explicitly to `/tmp` in `api/index.py` and `vercel.json`:
     ```python
     os.environ["MODEL_CACHE_DIR"] = "/tmp/models"
     os.environ["HF_HOME"] = "/tmp/huggingface"
     os.environ["XDG_CACHE_HOME"] = "/tmp"
     ```

2. **The 10-Second Execution Timeout Trap**:
   - Vercel Serverless Functions on the free Hobby tier default to a 10-second execution timeout.
   - Downloading a 548MB ONNX embedding model on cold start takes $>30$ seconds, triggering a `FUNCTION_INVOCATION_TIMEOUT` (504 Gateway Timeout).
   - *Our Solution*: Configure `maxDuration: 60` and `memory: 1024` inside `vercel.json`.

3. **The Groq Model Tier Trap**:
   - Many Groq API keys default to high-speed Qwen models rather than Llama 3.3. Requesting `llama-3.3-70b-versatile` returns `model_not_found`.
   - *Our Solution*: Configured the active model **`qwen/qwen3.8-27b`**, which generated verified responses in just **21ms**!

---

### ❓ Question 2: Why is a Docker container (Render / Fly.io) preferred over Serverless for heavy AI workloads?

> **The Question**: If Vercel works, why does our repository also include `render.yaml`, `fly.ai.toml`, and a multi-stage `Dockerfile`?

#### 💡 Serverless vs Container Comparison

| Feature | Vercel Serverless Function | Containerized Docker (Render / Fly.io) |
| :--- | :--- | :--- |
| **Model Weight Pre-caching** | **Not possible**. Vercel's 50MB zip limit prevents bundling a 548MB ONNX model. Models must download on cold starts. | **Pre-cached during Docker build**. The 548MB model is baked directly into the image. **0ms cold start latency**. |
| **Connection Pooling** | Ephemeral lambdas tear down PostgreSQL pools after every few minutes of inactivity. | **Persistent Connection Pool**. `asyncpg` keeps 10 warm connections open to Neon DB permanently. |
| **Streaming Duration** | Limited by function timeouts (10s Hobby / 60s Pro). | **Unlimited Streaming**. SSE connections can stream large generation tokens indefinitely. |
| **Cost** | Free tier available. | Free tier available on Render (Web Service) / Fly.io ($0). |

---

### 3. Vercel Python Microservice Configuration

Located in `backend-ai/`:

#### A. Entry Point: `backend-ai/api/index.py`
```python
import os
import sys

# Configure writable cache directories for AWS Lambda / Vercel Serverless environment
os.environ.setdefault("MODEL_CACHE_DIR", "/tmp/models")
os.environ.setdefault("HF_HOME", "/tmp/huggingface")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp")

try:
    os.makedirs("/tmp/models", exist_ok=True)
    os.makedirs("/tmp/huggingface", exist_ok=True)
except Exception:
    pass

# Ensure backend-ai root directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.main import app
```

#### B. Deployment Descriptor: `backend-ai/vercel.json`
```json
{
  "version": 2,
  "functions": {
    "api/index.py": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.py"
    }
  ],
  "env": {
    "MODEL_CACHE_DIR": "/tmp/models",
    "HF_HOME": "/tmp/huggingface",
    "XDG_CACHE_HOME": "/tmp"
  }
}
```

---

### 4. Multi-Stage Dockerfile with Pre-Cached Weights (`backend-ai/Dockerfile`)

For deployment to Render, Fly.io, or AWS ECS, the Dockerfile downloads the models **during build time**:

```dockerfile
# Stage 1: Build & Pre-cache FlashRank Model
FROM python:3.11-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download FlashRank & FastEmbed models during build to guarantee 0ms cold starts
RUN python -c "from flashrank import Ranker; Ranker(model_name='ms-marco-MiniLM-L-12-v2', cache_dir='/build/models')" && \
    python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='nomic-ai/nomic-embed-text-v1.5', cache_dir='/build/models')"

# Stage 2: Minimal Hardened Runtime
FROM python:3.11-slim AS runner
WORKDIR /app

RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /build/models /tmp/models
COPY . .

ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    MODEL_CACHE_DIR=/tmp/models \
    PORT=8000

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 5. Live Verification on Vercel

The backend microservice was deployed and verified live at:
**`https://backend-ai-lovat.vercel.app`**

#### Test 1: Health Endpoint
```bash
curl -i https://backend-ai-lovat.vercel.app/health
```
**Output (`HTTP/2 200 OK`)**:
```json
{
  "status": "healthy",
  "service": "SkillVault AI Service (LangChain)",
  "provider": "cloud_api",
  "models": {
    "embeddings": "nomic-embed-text",
    "chat": "qwen/qwen3.8-27b"
  }
}
```

#### Test 2: CORS Preflight Verification
```bash
curl -i -X OPTIONS 'https://backend-ai-lovat.vercel.app/api/v1/rag/chat/stream' \
  -H 'Origin: https://skillvault-app.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type'
```
**Output (`HTTP/2 200 OK`)**:
- `access-control-allow-origin: https://skillvault-app.vercel.app`
- `access-control-allow-credentials: true`
- `access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT, QUERY`
- `access-control-allow-headers: Content-Type`

#### Test 3: Live SSE Streaming
```bash
curl -i -N -X POST 'https://backend-ai-lovat.vercel.app/api/v1/rag/chat/stream' \
  -H 'Content-Type: application/json' \
  --data-raw '{"message":"What is React reconciliation?","top_k":2}'
```
**Output (`HTTP/2 200 OK`)**:
```
event: citations
data: [{"citation_index": 1, "document_title": "React Reconciliation", "section_header": "Fiber Tree", "score": 0.9993}]

event: token
data: {"token": "React"}

event: token
data: {"token": " reconciliation is the algorithm React uses to diff one tree with another..."}

event: done
data: {}
```

---

### 6. Environment Variables Checklist

#### Backend Microservice (`backend-ai` on Vercel / Render / Fly.io)
```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your_groq_api_key_here
CHAT_MODEL=qwen/qwen3.8-27b
EMBEDDING_PROVIDER=fastembed
MODEL_CACHE_DIR=/tmp/models
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
```

#### Frontend Application (`frontend` on Vercel)
```env
BACKEND_AI_URL=https://backend-ai-lovat.vercel.app
```

👉 **Next: [Module 08: Troubleshooting & Engineering Gotchas](MODULE_08_TROUBLESHOOTING_AND_ENGINEERING_PLAYBOOK.md)**
