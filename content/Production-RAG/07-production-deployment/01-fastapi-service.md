> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 6.4: Production RAG Observability, Tracing & Structured Logging](../06-generation-grounding-and-evaluation/04-monitoring-and-debugging.md) | ➡️ [Module 7.2: Authentication, Tenant Isolation & API Security](02-authentication-and-tenant-isolation.md)

---

# Module 7 — Production RAG Deployment

## Lesson 1: Build a RAG API with FastAPI

So far, we've built the core pieces of your RAG system. Now we'll expose them through an API so a frontend, mobile app, or another backend can ask questions.

Think of the production gateway architecture like this:

![FastAPI Production Serving, Gateway & LLM Orchestration Architecture](/images/production-rag/fastapi-production-serving.png)

```
[Client / Frontend Application]
              │
              ▼ (HTTP POST /api/v1/query)
   [FastAPI Gateway / Auth]
              │
              ▼
   [Two-Stage Retrieval Pipeline]
   (pgvector HNSW ──► RRF ──► Cross-Encoder ──► Compressor)
              │
              ▼
   [LLM Grounded Generation & Citations]
              │
              ▼
[JSON Response / SSE Streaming: Answer + Verified Citations]
```

We'll use **FastAPI**, Pydantic request models, and your existing `app/` package. You don't need to rebuild the retrieval logic.

## 1. Install the dependencies

Activate your existing virtual environment from the project root:

```bash
cd production-rag
source .venv/bin/activate

python -m pip install fastapi "uvicorn[standard]" pydantic
python -m pip freeze > requirements.txt
```

Your project should look approximately like this:

```text
production-rag/
├── app/
│   ├── __init__.py
│   ├── generation.py
│   ├── compressed_retrieval.py
│   ├── rag_pipeline.py
│   ├── rag_monitoring.py
│   └── api.py                 # we'll create this
├── documents/
├── .env
├── .gitignore
├── requirements.txt
└── .venv/
```

If `app/__init__.py` doesn't exist, create an empty file. This makes the package structure explicit.

## 2. Create the API

Create `app/api.py`:

```python

import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.monitored_rag import ask_monitored
from app.rag_monitoring import configure_logging

configure_logging()
logger = logging.getLogger("production_rag.api")

app = FastAPI(
    title="Production RAG API",
    description="Ask questions over indexed documents.",
    version="1.0.0",
)

class AskRequest(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=2000,
        description="Question to answer from the indexed documents",
    )
    source: str | None = Field(
        default=None,
        max_length=300,
        description="Optional source-document filter",
    )

class SourceReference(BaseModel):
    # Adapt these fields to your actual generation.py output.
    source: str | None = None
    page: int | None = None

class AskResponse(BaseModel):
    answer: str
    sources: list[dict] = Field(default_factory=list)

def get_current_tenant() -> str:
    """
    Development placeholder.

    Replace with a verified tenant ID from authenticated
    user/session claims before exposing this API to users.
    Never accept a tenant ID directly from the request body.
    """
    return "demo-tenant"

TenantId = Annotated[str, Depends(get_current_tenant)]

@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}

@app.post("/ask", response_model=AskResponse)
def ask(
    request: AskRequest,
    tenant_id: TenantId,
) -> AskResponse:
    try:
        result = ask_monitored(
            question=request.question,
            tenant_id=tenant_id,
            source=request.source,
        )

        return AskResponse(
            answer=result["answer"],
            sources=result.get("sources", []),
        )

    except Exception:
        # Avoid returning internal errors, SQL, or provider details.
        logger.exception("RAG request failed")
        raise HTTPException(
            status_code=500,
            detail="Unable to process the question right now.",
        )

```

### Understand the important pieces

- `BaseModel` validates incoming JSON.
- `Field(min_length=3, max_length=2000)` rejects empty or excessively long questions.
- `Depends(get_current_tenant)` supplies the tenant context on the server side.
- `response_model=AskResponse` documents and validates the response shape.
- `HTTPException` returns a safe error to the client rather than leaking internal details.

**Important:** `get_current_tenant()` is only a development placeholder. Before multi-user deployment, replace it with real authentication and derive the tenant from a verified identity. Ensure every database retrieval path applies that tenant filter. Otherwise, users could access another tenant's documents.

The `sources` field above is intentionally flexible because the exact source dictionaries depend on your existing `generation.py` implementation. You can tighten it into `list[SourceReference]` after confirming the real structure.

## 3. Start the server

From the project root, run:

```bash
uvicorn app.api:app --reload
```

You should see Uvicorn report that the server is running at `http://127.0.0.1:8000`.

Open these URLs in your browser:

- [API documentation](http://127.0.0.1:8000/docs) — interactively test your endpoint.
- [Health check](http://127.0.0.1:8000/health) — verify the API process is running.

The health check only verifies that FastAPI is responding; it does **not** prove PostgreSQL, your embedding model, or your LLM provider is healthy.

## 4. Send your first question

Open a second terminal and run:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does hybrid search improve retrieval?"
  }'
```

The response should have this general shape:

```json
{
  "answer": "Your generated answer, with citations where supported.",
  "sources": [
    {
      "source": "documents/retrieval.md",
      "page": 1
    }
  ]
}
```

The source names and answer above are illustrative. Your actual output depends on your indexed documents and the return structure of `generation.py`.

**If you get an empty answer or no relevant sources:** check that the server-side tenant ID matches the tenant attached to your indexed chunks. In the development code, that value is `"demo-tenant"`; change the placeholder to match your test data. Don't let clients choose arbitrary tenant IDs in production.

## 5. Test API validation

Try sending a question that's too short:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Hi"}'
```

FastAPI should return `422 Unprocessable Entity` because the question fails the minimum-length validation.

That is useful: invalid requests are rejected before expensive embedding and LLM calls happen.

## 6. What you just built

**An HTTP interface**

Your RAG pipeline can now be called by a frontend or another backend.

**Input validation**

Pydantic checks request shape and basic limits.

**Monitoring integration**

The existing monitored pipeline records request and stage events.

**Still needed before production**

Real authentication, enforced tenant isolation, rate limiting, robust timeouts, citation validation, and deployment configuration.

## 7. Hands-On Exercises

1. Create `app/api.py` and start Uvicorn with reload enabled.
2. Open `/docs` (Swagger UI) and successfully submit a test query against `/api/v1/query`.
3. Confirm that an invalid question returns `HTTP 422 Unprocessable Entity`.
4. Verify that retrieval uses the correct tenant for your test documents.

**Next lesson: Authentication, tenant isolation, and API security.** We'll learn how to prevent one customer from retrieving another customer's documents, validate identity at the API boundary, and apply secure access controls throughout the RAG pipeline.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 6.4: Production RAG Observability, Tracing & Structured Logging](../06-generation-grounding-and-evaluation/04-monitoring-and-debugging.md) | ➡️ [Next: Module 7.2: Authentication, Tenant Isolation & API Security](02-authentication-and-tenant-isolation.md)
