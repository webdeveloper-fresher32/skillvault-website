# Production Docker and Self-Hosted Deployment in LangGraph

> "Running on a managed cloud is great, but strict enterprise regulations often require self-hosting in your own VPC, Kubernetes cluster, or on-premise hardware."

---

### Step 1: Why Do We Need This?

#### The Real Problem

In highly regulated industries (healthcare, defense, finance, banking):
1. **Data Sovereignty:** Customer data cannot leave your corporate Virtual Private Cloud (VPC). Managed third-party cloud platforms are prohibited by security compliance.
2. **Predictable Infrastructure Costs:** Serverless per-run fees become expensive at enterprise scale (e.g. 10 million executions per month).
3. **Internal Network Access:** Your agents need direct access to private internal databases, LDAP servers, and local LLM models (e.g. self-hosted vLLM or Ollama on internal GPUs).

You need to know how to containerize your LangGraph application with **Docker** and deploy it reliably onto your own Kubernetes, AWS ECS, or bare-metal Linux servers.

#### Why LangGraph Solves It

LangGraph is fully open-source and self-hostable:
- Package your graph into a standard OCI-compliant Docker container.
- Connect to self-hosted PostgreSQL for durable checkpoints.
- Use Docker Compose for single-server setups, or Helm charts for Kubernetes multi-replica clusters.
- Complete control over security, networking, data encryption, and compute resources.

---

### Step 2: What Is It?

#### Simple Explanation

Think of a **shipping container**:
- Whether loaded onto a cargo ship, a train, or a truck, the shipping container has standard dimensions and locks.
- A **Docker container** packages your Python runtime, LangGraph code, system dependencies, and environment configurations into a standard, isolated box.
- It runs identically on a developer's MacBook, an AWS EC2 instance, or an on-premise server room.

#### Production Self-Hosted Architecture

```text
               [Internet / Corporate VPN]
                           │
                   [Nginx Reverse Proxy]
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
 [Docker Container 1: FastAPI]           [Docker Container 2: FastAPI]
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
             [Internal PostgreSQL Database]
                  (Port 5432 - Private)
```

---

### Step 3: Real-World Example

#### HIPAA-Compliant Hospital Patient Triage Deployment

Imagine an internal hospital agent deployed on-premise:
- **Environment:** Isolated hospital intranet without external internet access.
- **Components:**
  1. Docker container running LangGraph with local medical models.
  2. PostgreSQL container storing encrypted state checkpoints.
  3. Nginx container managing internal SSL certificates.
- **Workflow:** Nurses input patient symptoms on tablets. The self-hosted LangGraph agent checks local EHR records and assists in prioritization. Zero medical data ever touches third-party cloud servers.
- **What it outputs:** 100% HIPAA compliance, data privacy, and reliable uptime.

---

### Step 4: How Does It Work?

1. **Write `Dockerfile`:** Multi-stage build starting from `python:3.11-slim`, installing dependencies, and exposing port 8000.
2. **Write `docker-compose.yml`:** Defines the LangGraph app service and the PostgreSQL database service with persistent volume storage.
3. **Configure Environment:** Set `DATABASE_URL`, API keys, and thread configuration in `.env`.
4. **Boot Stack:** Run `docker compose up -d` to launch the database and agent service in the background.
5. **Health Checks:** Add a `/health` endpoint so orchestrators (Kubernetes, AWS ECS) can monitor container liveliness.

---

### Step 5: Code Example

Here is a complete, production-ready configuration including `Dockerfile`, `docker-compose.yml`, and the companion `server.py`:

#### File 1: `Dockerfile` (Production Multi-Stage Container)

```dockerfile
# Use lightweight official Python runtime
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Run as non-root user for enterprise security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# Healthcheck for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### File 2: `docker-compose.yml` (Complete Production Stack)

```yaml
version: '3.8'

services:
  # LangGraph Agent Service
  agent-api:
    build: .
    container_name: langgraph-agent-api
    restart: always
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://langgraph_user:securepassword123@postgres-db:5432/langgraph_prod
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      postgres-db:
        condition: service_healthy

  # Dedicated PostgreSQL Checkpointer Database
  postgres-db:
    image: postgres:16-alpine
    container_name: langgraph-postgres
    restart: always
    environment:
      - POSTGRES_USER=langgraph_user
      - POSTGRES_PASSWORD=securepassword123
      - POSTGRES_DB=langgraph_prod
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langgraph_user -d langgraph_prod"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

#### File 3: `server.py` (FastAPI Server with Health Check)

```python
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class SimpleState(TypedDict):
    input_text: str
    processed_text: str

def process_node(state: SimpleState) -> dict:
    return {"processed_text": f"PROCESSED: {state['input_text'].upper()}"}

builder = StateGraph(SimpleState)
builder.add_node("process", process_node)
builder.add_edge(START, "process")
builder.add_edge("process", END)

# Connection pool holder
pool = None
graph = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, graph
    db_uri = os.environ.get("DATABASE_URL", "postgresql://langgraph_user:securepassword123@localhost:5432/langgraph_prod")
    pool = AsyncConnectionPool(conninfo=db_uri, max_size=10, kwargs={"autocommit": True})
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    print("✓ Self-hosted LangGraph worker ready and connected to PostgreSQL.")
    yield
    await pool.close()

app = FastAPI(title="Self-Hosted LangGraph API", lifespan=lifespan)

class RequestPayload(BaseModel):
    thread_id: str
    text: str

@app.get("/health")
async def health_check():
    """Liveness probe for Docker / Kubernetes."""
    return {"status": "healthy", "service": "langgraph-agent"}

@app.post("/api/run")
async def run_agent(payload: RequestPayload):
    config = {"configurable": {"thread_id": payload.thread_id}}
    result = await graph.ainvoke({"input_text": payload.text, "processed_text": ""}, config=config)
    return {"output": result["processed_text"]}
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Running as Root** | Running Docker containers as `root` violates enterprise security audits. | Create and use a dedicated non-root user (`USER appuser`) in your Dockerfile. |
| **Persistent Data Loss** | Stopping a Docker container erases all SQLite/Postgres checkpoint data. | Always mount external Docker volumes (`volumes: - pgdata:/var/lib/postgresql/data`). |
| **Kubernetes Pod Readiness** | Kubernetes routes traffic to the container before database setup completes. | Use FastAPI's `lifespan` context manager and implement a `/health` endpoint for readiness probes. |

---

### Step 7: Quick Revision

- Docker packages the Python environment, LangGraph graph, and dependencies into an immutable container.
- Connect your container to a dedicated PostgreSQL database for enterprise checkpoint durability.
- Use Docker Compose for single-host deployments and Kubernetes for multi-node autoscaling.
- Always run containers as non-root users and use persistent volumes for database data.
- Provide a `/health` endpoint for container orchestrator readiness and liveness checks.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    Client["Client / Load Balancer"]:::startStyle --> Nginx["Nginx Reverse Proxy / Ingress"]:::nodeStyle
    Nginx --> Pod["Docker Container: langgraph-agent-api<br>(Non-Root User, Port 8000)"]:::nodeStyle
    Pod --> Pool["AsyncConnectionPool (psycopg3)"]:::decisionStyle
    Pool --> Postgres[("PostgreSQL Database Container<br>(Persistent Volume: pgdata)")]:::nodeStyle
    Postgres --> Ready(["Consistent, Scalable Execution"]):::endStyle

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decisionStyle fill:#334155,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef endStyle fill:#10b981,stroke:#34d399,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

Try answering these questions to check your understanding:

1. Why should you self-host LangGraph inside your own Docker containers instead of a public cloud?
   - A) Because Docker makes models smarter
   - B) To satisfy strict data privacy regulations (HIPAA, GDPR), keep data inside your VPC, and connect to internal databases
   - C) Because LangGraph cannot run in the cloud
   - D) To avoid writing code

2. Why must you configure persistent Docker volumes (`volumes: - pgdata:...`) for your PostgreSQL database container?
   - A) To increase RAM speed
   - B) So that database checkpoints are saved to the host hard drive and not erased when the container stops or restarts
   - C) Because Docker requires it to boot
   - D) To format the disk

3. What is the security best practice for running Python containers in production?
   - A) Always run as `root`
   - B) Create and run as a non-root user (`USER appuser`) to prevent privilege escalation attacks
   - C) Disable all passwords
   - D) Leave all ports open

4. What is the role of the `/health` endpoint in a containerized LangGraph deployment?
   - A) To diagnose computer viruses
   - B) To allow Kubernetes or load balancers to check if the container is healthy and ready to receive traffic
   - C) To calculate token prices
   - D) To shut down the container

*Submit your answers (e.g. 1-B, 2-B, 3-B, 4-B) to verify your score!*
