> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.4: Multi-Layer Caching (Embedding Cache & Retrieval Cache)](04-caching-in-production-rag.md) | ➡️ [Module 7.6: Containerizing RAG with Docker & Docker Compose](06-dockerizing-production-rag.md)

---

# Module 7 — Lesson 5: Background Ingestion and Asynchronous Processing

Let's solve a major production problem: **what happens when a user uploads a 500-page PDF?**

Your application may need to extract text, split it into chunks, generate embeddings, and write thousands of vectors to PostgreSQL. If you do all that inside the upload request, the user waits—and the request may time out before ingestion finishes.

The production approach is to accept the upload, create a job, and process the document in the background.

## 1. Understand the architecture

![Asynchronous Task Queue & Background Document Ingestion Worker](/images/production-rag/async-task-queue-ingestion.png)

```
[User / Client] ──► (POST /upload) ──► [FastAPI Gateway]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
               [Save to Disk/S3]                             [Push Job to Queue]
                                                               (Redis / PostgreSQL)
                                                                      │
                                                                      ▼
                                                            [Background Ingestion Worker]
                                                            (Parse ──► Chunk ──► Embed ──► pgvector)
                                                                      │
                                                                      ▼
[User / Client] ◄── (GET /jobs/{id}) ◄── [Job Status Registry: completed / failed]
```

The key distinction is that the upload request no longer waits for the entire indexing process.

We'll first build a simple local version using FastAPI's background tasks. Then we'll look at the durable worker/queue design you should use for production.

## 2. Understand the job lifecycle

Every uploaded document should have a job ID and a status.

| Status | Meaning |
|---|---|
| `queued` | Accepted and waiting to be processed |
| `processing` | A worker is processing the document |
| `completed` | Chunks and embeddings were indexed successfully |
| `failed` | Processing stopped with an error |

The client receives a job ID immediately, then polls a status endpoint while ingestion continues.

For example:

```json
{
  "job_id": 
1. 8ef2d47a-...
  "status": 
1. queued
}
```

This is better than keeping an HTTP request open for several minutes.

## 3. Build a local background-ingestion demo

For this exercise, we'll use FastAPI's `BackgroundTasks` to learn the flow. **This is a teaching implementation, not a durable production queue.** If the server restarts, the in-memory job records and pending tasks can be lost.

Create `app/ingestion_jobs.py`:

```python

from threading import Lock
from uuid import uuid4

_jobs: dict[str, dict] = {}
_jobs_lock = Lock()

def create_job(tenant_id: str, filename: str) -> str:
    job_id = str(uuid4())

    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "tenant_id": tenant_id,
            "filename": filename,
            "status": 
1. queued
            "error": None,
        }

    return job_id

def update_job(job_id: str, **fields) -> None:
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(fields)

def get_job(job_id: str, tenant_id: str) -> dict | None:
    with _jobs_lock:
        job = _jobs.get(job_id)

        if job is None or job["tenant_id"] != tenant_id:
            return None

        # Return a copy, not the mutable internal dictionary.
        return dict(job)

```

This stores each job's tenant ID. The status endpoint will use it to prevent users from reading another tenant's job.

Next, create `app/ingestion_worker.py`:

```python

import logging
from pathlib import Path

from app.ingestion_jobs import update_job

logger = logging.getLogger("production_rag.ingestion")

def process_document_job(
    job_id: str,
    tenant_id: str,
    file_path: str,
) -> None:
    update_job(job_id, status="processing")

    try:
        path = Path(file_path)

        # Connect this function to your existing ingestion pipeline:
        # 1. Extract PDF text and page metadata.
        # 2. Split text into chunks.
        # 3. Generate embeddings in batches.
        # 4. Upsert chunks with the correct tenant_id.
        #
        # Replace this guard with your real ingestion function.
        if not path.is_file():
            raise FileNotFoundError("Uploaded document is missing")

        from app.ingest import ingest_document

        ingest_document(
            file_path=str(path),
            tenant_id=tenant_id,
        )

        update_job(job_id, status="completed")

    except Exception as exc:
        logger.exception(
            
1. Document ingestion failed; job_id=%s
            job_id,
        )
        update_job(
            job_id,
            status=
1. failed
            error=type(exc).__name__,
        )

```

**Integration note:** the code assumes `app.ingest` exports a callable named `ingest_document(file_path=..., tenant_id=...)`. If your current `app/ingest.py` only has a script-style `main()` or uses different argument names, adapt that import and call to your existing ingestion functions. Don't create a second ingestion implementation that bypasses your existing stable chunk IDs, metadata, and upsert behavior.

## 4. Add upload and job-status endpoints

Add these imports to `app/api.py`:

```python
import os
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, File, UploadFile
from fastapi import status

from app.ingestion_jobs import create_job, get_job
from app.ingestion_worker import process_document_job
```

Then add the endpoints below your existing routes:

```python

UPLOAD_DIR = Path("uploads")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MiB

@app.post("/documents", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    principal: Principal = Depends(get_current_principal),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail=
1. Only PDF uploads are supported
        )

    # Generate the stored filename ourselves. Never use the
    # user-supplied filename as a filesystem path.
    stored_name = f
1. {uuid4()}.pdf
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / stored_name

    total_bytes = 0
    header = b""

    try:
        with file_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=
1. File exceeds the 20 MiB limit
                    )

                if len(header) < 5:
                    header += chunk[: 5 - len(header)]

                destination.write(chunk)

        # MIME type and extension alone are not trustworthy.
        if not header.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail=
1. The uploaded file is not a valid PDF
            )

        display_name = Path(file.filename).name[:200]
        job_id = create_job(
            tenant_id=principal.tenant_id,
            filename=display_name,
        )

        background_tasks.add_task(
            process_document_job,
            job_id,
            principal.tenant_id,
            str(file_path),
        )

        return {
            "job_id": job_id,
            "status": 
1. queued
        }

    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

@app.get("/documents/jobs/{job_id}")
def document_job_status(
    job_id: str,
    principal: Principal = Depends(get_current_principal),
):
    job = get_job(
        job_id=job_id,
        tenant_id=principal.tenant_id,
    )

    if job is None:
        # Same response for missing jobs and jobs belonging to
        # another tenant, to avoid disclosing their existence.
        raise HTTPException(
            status_code=404,
            detail=
1. Job not found
        )

    return job

```

The example demonstrates the request flow, but a few safeguards are still needed before production:

- The upload directory should be outside any publicly served static directory and have restrictive filesystem permissions.
- Add malware scanning and stronger PDF parsing limits for untrusted uploads.
- Add a document record and durable job record to the database.
- Clean up temporary files according to a defined retention policy.
- If ingestion fails, preserve enough protected diagnostic information for debugging without exposing it through the status endpoint.
- Ensure `ingest_document()` persists each chunk with the authenticated tenant ID.

## 5. Why `BackgroundTasks` isn't enough for production

FastAPI's built-in background tasks are useful for small tasks, but they run within the application process. They are not a durable job queue.

For real document ingestion, a common architecture is:

**FastAPI**
Stores upload + creates database job

**Durable queue**
Redis-backed queue or managed message broker

**Separate worker**
Retries, chunking, batch embeddings, indexing

**PostgreSQL / pgvector**
Chunks, metadata, job status

A durable queue helps recover work after application restarts and lets you scale workers independently. You still need idempotent ingestion, bounded retries, and a policy for jobs that repeatedly fail.

## 6. Your practical exercise


1. Add the job registry and adapt the worker to your existing ingestion function.
2. Upload a small PDF and confirm that the API returns a job ID.
3. Poll the job-status endpoint and verify its tenant restriction.
4. Test an oversized file and a non-PDF file; verify that neither is ingested.
- [ ] setChecks(prev=>prev.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

**Next lesson: Dockerizing and deploying your RAG application.** We'll package the API, worker, PostgreSQL/pgvector, and supporting services so the environment is reproducible beyond your Mac.One dependency to install before testing file uploads:

```bash
python -m pip install python-multipart
python -m pip freeze > requirements.txt
```

FastAPI needs `python-multipart` to parse uploaded files.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.4: Multi-Layer Caching (Embedding Cache & Retrieval Cache)](04-caching-in-production-rag.md) | ➡️ [Next: Module 7.6: Containerizing RAG with Docker & Docker Compose](06-dockerizing-production-rag.md)
