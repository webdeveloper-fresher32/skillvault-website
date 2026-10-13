> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.5: Asynchronous Document Ingestion & Background Workers](05-background-ingestion-and-async-processing.md) | ➡️ [Module 7.7: Production Readiness Checklist, Deep Health Checks & Migrations](07-production-readiness-and-healthchecks.md)

---

# Module 7 — Lesson 6: Dockerizing Your Production RAG Application

Let's package your RAG application so it can run consistently on your Mac, another developer's machine, or a cloud server.

So far, your project depends on a local Python virtual environment, installed libraries, PostgreSQL, environment variables, and an embedding model. Docker helps make the runtime environment reproducible.

## 1. Understand the architecture

**Docker Compose**
Starts and connects your services

**FastAPI**
HTTP endpoints

**Worker**
Document ingestion

**PostgreSQL + pgvector**
Documents, embeddings, and metadata

We'll containerize the API and database first. We'll keep the worker as a separate service in the production architecture; the in-memory `BackgroundTasks` example from the previous lesson isn't a durable worker queue yet.

## 2. Create a Dockerfile

At the root of `production-rag/`, create a file named `Dockerfile`:

```dockerfile

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install requirements separately so Docker can cache this layer.
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

# Copy application code only after installing dependencies.
COPY app/ ./app/

# Create a dedicated unprivileged user.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]

```

### Why these instructions matter

- `python:3.12-slim` provides a relatively small Python runtime.
- `COPY requirements.txt` before the application code helps Docker reuse the dependency layer when your code changes.
- `PYTHONUNBUFFERED=1` makes application logs appear promptly.
- `USER appuser` avoids running the application as root.
- `0.0.0.0` allows the container's API port to be reached through Docker's port mapping.

Your dependencies include machine-learning libraries, so the image may be large. The first build can also download the embedding model when the application starts. Later, we'll look at model caching and separating ingestion workers from API processes.

## 3. Add a `.dockerignore` file

Create `.dockerignore` in the project root:

```text

.venv/
__pycache__/
*.py[cod]
.git/
.env
uploads/
documents/
.pytest_cache/
.mypy_cache/
.DS_Store

```

This prevents local virtual environments, secrets, source documents, and temporary uploads from being copied into the image.

The `.env` file is excluded from the image, but Docker Compose can still pass environment variables to the container through `env_file`.

Keep a separate `.gitignore` too, especially for `.env`, uploads, and local secrets.

## 4. Create `compose.yaml`

This configuration runs the API and PostgreSQL with pgvector:

```yaml

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: rag_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
      POSTGRES_DB: ragdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          
1. CMD-SHELL
          
1. pg_isready -U rag_user -d ragdb
        ]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  api:
    build: .
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://rag_user:${POSTGRES_PASSWORD}@db:5432/ragdb
      UPLOAD_DIR: /app/uploads
    ports:
      - 
1. 127.0.0.1:8000:8000
    volumes:
      - uploaded_documents:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  uploaded_documents:

```

Notice the hostname `db` in `DATABASE_URL`. Inside Docker Compose, services communicate using their service names. `localhost` inside the API container refers to the API container itself, not PostgreSQL.

This configuration binds the API to your machine's loopback interface, making it suitable for local development. A cloud deployment needs an appropriate ingress or reverse proxy, TLS, authentication, and network restrictions.

One other important detail: `CREATE EXTENSION vector` and your table/index creation SQL still need to run. The container image provides pgvector, but it doesn't automatically create your application's schema.

## 5. Configure your environment

Add the database password to your local `.env` file:

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-random-local-password
```

Use a strong password. Don't commit `.env` to Git.

The database URL inside Docker must use the hostname `db`; if you run your API directly on your Mac instead, it normally uses `localhost`.

## 6. Initialize pgvector and your schema

Create `docker/init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(384) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_chunks_metadata_idx
    ON rag_chunks USING GIN (metadata);

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
    ON rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS rag_chunks_content_fts_idx
    ON rag_chunks USING GIN (
        to_tsvector('english', content)
    );
```

Add this mount under the `db` service in `compose.yaml`:

```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/001-init.sql:ro
```

**Important:** PostgreSQL's initialization scripts run when the data directory is first initialized. If the `postgres_data` volume already exists, adding this file won't automatically apply the schema. In that case, run the SQL against the existing database using `docker compose exec -T db psql ...` or apply your existing migrations. Don't delete a volume to force initialization if it contains data you need.

## 7. Build and start your application

From the project root:

```bash
docker compose config
docker compose up --build -d
docker compose ps
```

Check the logs:

```bash
docker compose logs -f api
```

In another terminal, test the endpoints:

```bash
curl http://127.0.0.1:8000/health
```

Then open the interactive API documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

If the API fails to start, inspect its logs first. Common issues include missing environment variables, database schema not initialized, an incompatible Python dependency, or code that expects a local file not copied into the image.

## 8. Fix the upload directory for Docker

In the previous lesson, `app/api.py` used:

```python
UPLOAD_DIR = Path("uploads")
```

Make it configurable so the container uses the mounted directory:

```python
import os
from pathlib import Path

UPLOAD_DIR = Path(
    os.getenv("UPLOAD_DIR", "uploads")
)
```

The Docker Compose configuration sets `UPLOAD_DIR=/app/uploads`, which is backed by the `uploaded_documents` volume. This lets uploaded files survive an API container restart.

Remember that persistent file storage is not a substitute for a durable ingestion queue. Your current in-memory job registry and `BackgroundTasks` can still lose pending work when the process restarts.

## 9. Useful Docker commands

| Command | Purpose |
|---|---|
| `docker compose ps` | Check service status |
| `docker compose logs -f api` | Follow API logs |
| `docker compose logs -f db` | Inspect PostgreSQL logs |
| `docker compose restart api` | Restart the API |
| `docker compose exec db psql -U rag_user -d ragdb` | Open a database shell |
| `docker compose down` | Stop and remove containers |
| `docker compose down -v` | Remove containers **and persistent volumes** |

Be especially careful with `docker compose down -v`: it deletes the Compose-managed database volume and its stored data.

## 10. Your practical exercise


1. Create the Dockerfile, .dockerignore, and compose.yaml.
2. Start PostgreSQL and verify that the rag_chunks table exists.
3. Build the API image and successfully call /health.
4. Restart the API container and verify that the database data remains available.
- [ ] setChecks(prev=>prev.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

## What's next?

**Module 7 — Lesson 7: Production deployment and readiness.**

We'll cover deployment architecture, reverse proxies and HTTPS, environment-specific configuration, database migrations, durable background workers, health checks, and a final production-readiness checklist for your RAG system.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.5: Asynchronous Document Ingestion & Background Workers](05-background-ingestion-and-async-processing.md) | ➡️ [Next: Module 7.7: Production Readiness Checklist, Deep Health Checks & Migrations](07-production-readiness-and-healthchecks.md)
