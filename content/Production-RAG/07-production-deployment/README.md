# Module 7: Production Deployment & API Engineering

Welcome to **Module 7**. Transforming your Python RAG logic into an enterprise-ready, containerized backend service.

---

## 📑 Module Lessons

1. **[01-fastapi-service.md](01-fastapi-service.md)**
   - Creating the FastAPI service: `POST /query` and `GET /health`.
   - Strict Pydantic models for request validation and response schemas.

2. **[02-authentication-and-tenant-isolation.md](02-authentication-and-tenant-isolation.md)**
   - Secure API key / Bearer token authentication via FastAPI dependencies.
   - Deriving `tenant_id` from the verified token—never trusting user-supplied request headers or body values.

3. **[03-rate-limiting-timeouts-and-retries.md](03-rate-limiting-timeouts-and-retries.md)**
   - API rate limiting using SlowAPI.
   - Safe exponential backoff retries on LLM timeouts and transient database errors.

4. **[04-caching-in-production-rag.md](04-caching-in-production-rag.md)**
   - Multi-layer caching: in-memory caching of model objects (`@lru_cache`), embedding computation cache, and frequent query retrieval cache.

5. **[05-background-ingestion-and-async-processing.md](05-background-ingestion-and-async-processing.md)**
   - Solving slow synchronous uploads: background ingestion jobs with status polling (`queued`, `processing`, `completed`, `failed`).

6. **[06-dockerizing-production-rag.md](06-dockerizing-production-rag.md)**
   - Multi-stage Dockerfile for FastAPI + Python ML dependencies.
   - Complete `docker-compose.yml` orchestrating the FastAPI application with PostgreSQL + `pgvector`.

7. **[07-production-readiness-and-healthchecks.md](07-production-readiness-and-healthchecks.md)**
   - Deep health checks verifying live database connections and embedding model responsiveness.
   - Database migration management and pre-flight production checklist.

---

[⬅️ Previous Module: Generation & Eval](../06-generation-grounding-and-evaluation/README.md) | [Next Module: Capstone Project ➡️](../08-capstone-project/README.md)
