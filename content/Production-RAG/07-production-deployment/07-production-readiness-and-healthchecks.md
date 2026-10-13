> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.6: Containerizing RAG with Docker & Docker Compose](06-dockerizing-production-rag.md) | ➡️ [Module 8: Production RAG Capstone Project Architecture & Milestones](../08-capstone-project/01-capstone-blueprint-and-milestones.md)

---

# Module 7 — Lesson 7: Production Deployment and Readiness

Let's bring the pieces together. You've built retrieval, reranking, grounded generation, monitoring, a FastAPI interface, caching, and a Docker setup. Now we'll learn what it takes to deploy the system reliably.

The goal isn't just to make the API accessible over the internet. It's to make sure it remains **secure, observable, recoverable, and maintainable** when real users depend on it.

## 1. Understand the production architecture

```
[Users and Client Applications]
(Web Browsers, Mobile Apps, Enterprise Systems)
       │
       ▼
[HTTPS Ingress / Reverse Proxy]
(NGINX / Cloudflare · TLS termination, request limits, routing)
       │
       ▼
[FastAPI Core Service]
(Bearer Auth, Pydantic validation, Rate limiting, Retrieval coordinator)
       │
       ▼
[PostgreSQL + pgvector]
(Chunks, 384d/1536d vectors, Metadata filters, Job state)
       │
       ▼
[Background Worker Service]
(Celery / Redis / ARQ · Heavy PDF parsing, OCR, and embedding pipelines)
```

In production, the API and worker should usually be separate processes. The API serves user requests; the worker handles heavier document ingestion jobs. A durable queue coordinates the work between them.

## 2. Configure separate environments

Avoid hardcoding production values in Python.

Use environment variables for settings such as:

- Database connection string
- LLM API key and model
- Maximum upload size
- Request and database timeouts
- Allowed frontend origins
- Log level
- Cache and queue endpoints

A useful structure is:

```text
production-rag/
├── app/
├── docker/
│   └── init.sql
├── tests/
├── Dockerfile
├── compose.yaml
├── requirements.txt
├── .env.example
└── .gitignore
```

Create `.env.example` containing placeholders only:

```dotenv
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
POSTGRES_PASSWORD=
```

Commit `.env.example`, but **never commit the actual `.env` file**. In production, inject secrets using your hosting platform's secret manager or environment configuration.

## 3. Add health checks that test real dependencies

Your existing `/health` endpoint returns `{"status": "ok"}` when FastAPI responds. That's useful for a liveness check, but it doesn't prove the database is reachable.

Use two different concepts:

- **Liveness:** Is the application process running?
- **Readiness:** Can the application serve requests with its required dependencies?

Add a database readiness endpoint to `app/api.py`. This example uses your existing psycopg dependency:

```python

from fastapi import HTTPException
from psycopg import connect

from app.settings import settings

@app.get("/health/live")
def liveness():
    return {"status": "alive"}

@app.get("/health/ready")
def readiness():
    try:
        with connect(
            settings.database_url,
            connect_timeout=2,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()

        return {"status": "ready"}

    except Exception:
        raise HTTPException(
            status_code=503,
            detail=
1. Required dependency unavailable
        )

```

This assumes you have an `app/settings.py` that defines `settings.database_url`. If your project currently reads `DATABASE_URL` directly from `os.environ`, use that configuration instead.

The readiness check above verifies PostgreSQL connectivity only. If your service depends on additional mandatory services, decide which ones should be included in readiness checks. Avoid making every health probe call an expensive LLM API; external-provider availability is often better monitored separately.

## 4. Use a settings module

Create `app/settings.py`:

```python

import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    database_url: str
    openai_model: str
    log_level: str

def load_settings() -> Settings:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    return Settings(
        database_url=database_url,
        openai_model=os.getenv(
            
1. OPENAI_MODEL
            
1. gpt-4.1-mini
        ),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )

settings = load_settings()

```

This centralizes configuration and fails early if a required setting is missing. Adjust the model default to match the model you actually use in `generation.py`.

For local development, load your `.env` before importing the settings module, if needed. In production, inject environment variables directly through your deployment platform.

## 5. Deploy safely behind HTTPS

When deploying to a cloud VM or container platform:

1. Put the API behind a reverse proxy or managed ingress that terminates TLS.
2. Expose only the necessary public ports; keep PostgreSQL and Redis private.
3. Configure allowed origins if browser clients call the API directly.
4. Apply request-size limits at the proxy as well as in the application.
5. Configure authentication, rate limiting, and trusted proxy settings.
6. Use managed secrets rather than baking credentials into the image.
7. Set up backups and test restoring them.

Don't expose PostgreSQL port `5432` publicly just to make the application connect. Within a private Docker network or cloud network, the API should connect to the database using its private hostname.

Also avoid running `uvicorn --reload` in production. Use a production process configuration and a deployment platform that can restart failed processes, report health, and support controlled rollouts.

## 6. Manage database schema changes with migrations

In the learning project, you created the `rag_chunks` table and indexes using SQL. That's fine for an initial setup, but production schema changes need a repeatable migration process.

For example, suppose you add a `document_version` field or change your job-status table. You want a migration to apply that change consistently across environments.

A common tool is Alembic, particularly when your application uses SQLAlchemy. If you use plain psycopg, you can also maintain ordered SQL migration files and track which versions have been applied.

A migration workflow should:

- Run in a controlled deployment step.
- Be safe to rerun where possible.
- Avoid destructive changes without a backup and a recovery plan.
- Be tested against a staging database.
- Support rolling deployments where old and new application versions may overlap.

Do not rely on PostgreSQL's container initialization scripts to manage every future schema update; those scripts are intended primarily for initializing a new data directory.

## 7. Make ingestion recoverable

Remember our previous lesson on background ingestion? Your in-memory job registry isn't sufficient for a production service.

Use persistent job records and a durable queue. A job should track fields such as:

| Field | Purpose |
|---|---|
| `job_id` | Unique identifier |
| `tenant_id` | Document ownership |
| `status` | Queued, processing, completed, or failed |
| `attempt_count` | Number of attempts |
| `created_at` | When the job was accepted |
| `updated_at` | Last status change |
| `error_code` | Safe failure category |

Workers should use stable chunk IDs and idempotent upserts, so retrying a job doesn't create duplicate chunks. For large ingestion workflows, consider recording progress and ensuring partially completed jobs can be resumed or safely rerun.

A queue alone doesn't guarantee exactly-once processing. Design for possible duplicate delivery, worker crashes, and transient provider failures.

## 8. Final production-readiness checklist

### RAG deployment checklist


["Security", "Authentication, tenant isolation, secret management, and HTTPS are configured."],
["Retrieval quality", "A verified evaluation dataset tracks Hit Rate@K, MRR, and Recall@K."],
["Grounding", "Citation validation and unsupported-answer handling are tested."],
["Reliability", "Network timeouts, bounded retries, and safe error responses are configured."],
["Rate limiting", "Expensive API operations have appropriate user or tenant limits."],
["Caching", "Cache keys include tenant scope and data/model version information."],
["Ingestion", "Durable job tracking, idempotency, and failure recovery are implemented."],
["Database", "Migrations, backups, and a tested restore procedure are in place."],
["Observability", "Latency, errors, token usage, retrieval quality, and cost are monitored."],
["Deployment", "Containers run without unnecessary privileges and have appropriate health checks."]
{item[0]}
{item[1]}
</checkbox>

This is a readiness checklist, not a claim that your current application has all these controls implemented. Mark items complete only after testing them.

## 9. What's next in the course?

You've now covered the main stages of a production RAG application, from document ingestion through deployment.

The best next step is a **capstone project**: bring your existing components together into one coherent application, verify the actual function signatures and configuration, and run end-to-end tests covering document upload, tenant-isolated retrieval, grounded answers, citations, and failures.

That will help turn the lessons into a project you can confidently explain in interviews and demonstrate as a portfolio project. 

When you're ready, say **“Start the capstone”**, and we'll build and test it step by step using your existing `production-rag` project rather than starting from scratch.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.6: Containerizing RAG with Docker & Docker Compose](06-dockerizing-production-rag.md) | ➡️ [Next: Module 8: Production RAG Capstone Project Architecture & Milestones](../08-capstone-project/01-capstone-blueprint-and-milestones.md)
