# Production Docker and Self-Hosted Deployment — Complete Guide

> "A cargo ship secures thousands of standardized, weather-sealed steel intermodal containers, ensuring fragile goods safely navigate ocean storms, port cranes, and rail lines unchanged."

---

## Table of Contents

1. [The Problem: Operating Self-Hosted Agent Clusters at Enterprise Scale](#1-the-problem-operating-self-hosted-agent-clusters-at-enterprise-scale)
2. [The Intermodal Cargo Shipping Container Analogy](#2-the-intermodal-cargo-shipping-container-analogy)
3. [The Mechanism: Multi-Stage Docker, Postgres, and Gunicorn Clustering](#3-the-mechanism-multi-stage-docker-postgres-and-gunicorn-clustering)
4. [Diagram: Self-Hosted Production Infrastructure Topology](#4-diagram-self-hosted-production-infrastructure-topology)
5. [Code Walkthrough: Production Dockerfile and docker-compose Stack](#5-code-walkthrough-production-dockerfile-and-docker-compose-stack)
6. [Comparing Self-Hosted vs Managed LangGraph Cloud](#6-comparing-self-hosted-vs-managed-langgraph-cloud)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Operating Self-Hosted Agent Clusters at Enterprise Scale

Regulated enterprises (banking, defense, healthcare) often cannot send sensitive customer state to public third-party SaaS clouds.

### The Self-Hosting Imperative

```text
Public SaaS Deployment:
  - Subject to third-party data residency and vendor risk.
  - Hard cloud spending quotas.

Self-Hosted Enterprise Architecture:
  - Deployed in private VPC (AWS EKS, GCP GKE, on-prem Kubernetes).
  - Checkpoints stored securely in encrypted private PostgreSQL instances.
  - Complete sovereignty over telemetry, logs, and token encryption.
```

### The Solution: Containerized LangGraph Stacks

Package LangGraph with `langgraph build` or custom multi-stage Dockerfiles orchestrated via Docker Compose or Kubernetes with PostgreSQL checkpointers.

---

## 2. The Intermodal Cargo Shipping Container Analogy

A global logistics company does not ship loose electronics stacked on wooden pallets across the Atlantic.

### Loose Cargo vs Standard Intermodal Container

```text
Loose Cargo Pallet  → Rain damages boxes; customs agents drop crates; contents shift during transit
                      (Fragile, high loss rate, environment-dependent).

Standard Container  → Steel container locks identically into cargo ships, rail cars, and semi-trucks;
                      internal temperature controlled; goods arrive 100% intact everywhere.
```

### Mapping to LangGraph

The Python agent code is the cargo; the Docker image is the steel container; the Kubernetes cluster is the container ship.

---

## 3. The Mechanism: Multi-Stage Docker, Postgres, and Gunicorn Clustering

A production stack contains:
1. Multi-stage OCI Docker container.
2. Production PostgreSQL connection pool for `PostgresSaver`.
3. Uvicorn/Gunicorn process manager with async worker pooling.

---

## 4. Diagram: Self-Hosted Production Infrastructure Topology

### High-Availability Production Architecture

```text
Internet / Corporate VPC
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Application Load Balancer / Nginx (SSL Termination)         │
│ Headers: `X-Accel-Buffering: no`                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ LangGraph Docker Pod #1       │ │ LangGraph Docker Pod #2       │
│ Uvicorn ASGI Worker Cluster   │ │ Uvicorn ASGI Worker Cluster   │
└──────────────┬────────────────┘ └──────────────┬────────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ Managed PostgreSQL Cluster (High Availability)              │
│   ├── Table: `checkpoints` (Thread state snapshots)         │
│   ├── Table: `writes` (Pending multi-node writes)           │
│   └── Table: `store` (Cross-thread long-term memory)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production Dockerfile and docker-compose Stack

A complete production deployment manifest with PostgreSQL checkpointer integration:

```dockerfile
# Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim AS runner

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

# Run as non-root security best practice
USER 1001

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: langgraph_postgres
    environment:
      POSTGRES_DB: langgraph_db
      POSTGRES_USER: graph_user
      POSTGRES_PASSWORD: secret_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U graph_user -d langgraph_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  agent_api:
    build: .
    container_name: langgraph_service
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://graph_user:secret_password@postgres:5432/langgraph_db"
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
    ports:
      - "8000:8000"

volumes:
  pgdata:
```

---

## 6. Comparing Self-Hosted vs Managed LangGraph Cloud

| Architectural Dimension | Self-Hosted Deployment | Managed LangGraph Cloud |
|---|---|---|
| Data Sovereignty | 100% on-prem / Private VPC | Managed multi-tenant cloud |
| Operational Maintenance | DevOps team manages Postgres & Kubernetes | Zero infrastructure management |
| Cost Structure | Fixed server / VM compute costs | Usage-based consumption pricing |
| Custom Networking | Direct access to internal VPC databases | Requires VPC peering / secure tunnels |
| Compliance | Full control for HIPAA, SOC2, FedRAMP | Vendor-certified compliance |

---

## 7. Common Mistakes

- **Running with default in-memory checkpointer.** `MemorySaver` loses all checkpoints whenever a Docker container restarts; always use `PostgresSaver` in production.
- **Forgetting connection pool limits in `psycopg_pool`.** Setting pool size too small causes API workers to stall waiting for database connections under heavy load.
- **Running containers as root.** Always specify a non-root `USER 1001` in production Dockerfiles.
- **Omitting Docker HEALTHCHECK probes.** Kubernetes and load balancers cannot detect hung async workers without active health checks.
- **Hardcoding database credentials in images.** Always pass connection strings via environment variables or Kubernetes secrets.

---

## 8. Hands-On Exercises

**Exercise 1:** Build the production Docker image using `docker build -t langgraph-prod:1.0 .`.

**Exercise 2:** Start the full stack with `docker compose up -d` and verify Postgres health checks pass.

**Exercise 3:** Send a chat request to `http://localhost:8000/chat` and verify checkpoint rows in Postgres via `psql`.

**Exercise 4:** Stop the container (`docker compose stop agent_api`), restart it, and verify conversation memory persists across restarts.

**Exercise 5:** Configure a multi-worker Gunicorn setup with `--workers 4` and test concurrent load with Locust or Apache Bench.

---

## 9. Interview Q&A

**Q: What is the recommended production checkpointer for self-hosted LangGraph deployments?**
`PostgresSaver` backed by a managed PostgreSQL instance (e.g. AWS RDS Aurora Postgres) using an asynchronous connection pool (`AsyncConnectionPool` from `psycopg_pool`). It provides ACID transaction guarantees, thread isolation, and horizontal scalability.

**Q: How do you handle database schema migrations for LangGraph Postgres checkpointers?**
Call `checkpointer.setup()` during service startup (or within a Kubernetes init-container). LangGraph automatically creates the required `checkpoints`, `checkpoint_blobs`, and `checkpoint_writes` tables if they do not exist.

**Q: Why is multi-stage Docker building critical for LangGraph production images?**
Multi-stage builds separate the compile-time toolchains (GCC, headers, package installers) from the final minimal runtime image, reducing image size by up to 70% and eliminating security vulnerabilities associated with build compilers.

**Q: How do you scale self-hosted LangGraph services horizontally behind a load balancer?**
Because graph state is stored centrally in PostgreSQL, stateless API container pods can scale horizontally across Kubernetes nodes. Any pod can resume any `thread_id` by reading the latest checkpoint from the shared database.

**Q: How do you configure reverse proxies like Nginx to support LangGraph SSE streaming?**
Ensure Nginx disables response buffering by adding `proxy_buffering off;` and `proxy_set_header X-Accel-Buffering no;`, and set `proxy_read_timeout 3600s;` to prevent terminating long-running agent threads prematurely.
