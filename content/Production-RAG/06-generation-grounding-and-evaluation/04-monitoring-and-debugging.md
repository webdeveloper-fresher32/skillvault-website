> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 6.3: RAG Evaluation Metrics (Hit Rate, MRR, Context Recall, Faithfulness)](03-evaluating-your-rag-system.md) | ➡️ [Module 7.1: Build a Production RAG API with FastAPI](../07-production-deployment/01-fastapi-service.md)

---

# Module 6 — Lesson 4: Production RAG Monitoring and Debugging

Now we'll learn how to troubleshoot a RAG application when it gives a bad answer, becomes slow, or returns irrelevant documents.

In production, the hardest question often isn't *“Why did the LLM answer incorrectly?”* It's **“Which stage caused the failure?”**

![Distributed Systems Observability, Tracing, Metrics & Logs Pipeline](/images/production-rag/observability-pipeline.png)

Your pipeline now has six interdependent stages, and each can fail independently:

| Stage | Diagnostic Question | Observability Metric |
| :--- | :--- | :--- |
| **1. Ingestion** | Was the document text extracted cleanly without loss? | Parse error rate, checksum collisions |
| **2. Chunking** | Was semantic context preserved across boundaries? | Average chunk length, split ratio |
| **3. Retrieval** | Were the right document chunks retrieved? | Recall@K, Cosine distance distribution |
| **4. Reranking** | Were truly relevant chunks ranked in top 4? | MRR, Cross-Encoder score cutoff |
| **5. Generation** | Did the LLM ground its response on the retrieved text? | Token latency (TTFT), hallucination rate |
| **6. Citation Guard** | Do citations point to verified context chunks? | Citation verification pass rate |

## 1. Learn to diagnose failures systematically

Imagine a user asks:

> How did we prevent duplicate Stripe webhook processing?

The RAG application answers:

> We added a message queue and achieved a 40% improvement in reliability.

But your actual project notes say you used Stripe event IDs for deduplication and an idempotent handler, without a queue or a measured percentage.

Where did the failure occur?

- **Possibility A:** The correct project notes were never indexed.
- **Possibility B:** Retrieval found the notes but ranked them too low.
- **Possibility C:** Compression removed the important sentence.
- **Possibility D:** The LLM invented details despite receiving the correct evidence.

You can't know which one happened by looking at the final answer alone. You need a trace of the pipeline.

## 2. Add structured logging to your project

Instead of printing arbitrary messages throughout the application, use Python's `logging` module. Structured logs make it easier to search for failures and compare performance across requests.

Create `app/rag_monitoring.py`:

```python
import hashlib
import json
import logging
import time
import uuid
from contextlib import contextmanager

logger = logging.getLogger("production_rag")

def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format=
1. %(message)s
    )

def query_fingerprint(query: str) -> str:
    """Identify repeated queries without logging their raw text."""
    return hashlib.sha256(
        query.encode("utf-8")
    ).hexdigest()[:12]

def log_event(
    request_id: str,
    event: str,
    **fields,
) -> None:
    record = {
        "request_id": request_id,
        "event": event,
        **fields,
    }

    logger.info(
        json.dumps(record, default=str)
    )

@contextmanager
def trace_stage(request_id: str, stage: str):
    start = time.perf_counter()

    try:
        yield
    except Exception as exc:
        elapsed_ms = round(
            (time.perf_counter() - start) * 1000,
            2,
        )
        log_event(
            request_id,
            
1. stage_failed
            stage=stage,
            duration_ms=elapsed_ms,
            error_type=type(exc).__name__,
        )
        raise
    else:
        elapsed_ms = round(
            (time.perf_counter() - start) * 1000,
            2,
        )
        log_event(
            request_id,
            
1. stage_completed
            stage=stage,
            duration_ms=elapsed_ms,
        )

def start_request(query: str) -> str:
    request_id = str(uuid.uuid4())

    log_event(
        request_id,
        
1. request_started
        query_hash=query_fingerprint(query),
    )

    return request_id

if __name__ == "__main__":
    configure_logging()

    request_id = start_request(
        
1. How did we prevent duplicate webhook events?
    )

    with trace_stage(request_id, "retrieval"):
        time.sleep(0.01)  # Demonstration only

    log_event(
        request_id,
        
1. request_completed
        status=
1. success
    )
```

Run the demo:

```bash
python -m app.rag_monitoring
```

You should see JSON-formatted log records with a request ID, event name, and stage duration.

The short `sleep()` is only there to demonstrate timing; remove it from real application code.

**Security note:** don't log API keys, raw documents, authorization headers, or unredacted user queries by default. Even a query hash can reveal repeated activity, so treat logs as potentially sensitive and apply access controls and retention limits.

## 3. Trace a real RAG request

Now instrument your existing pipeline. Create `app/monitored_rag.py`:

```python
from app.compressed_retrieval import retrieve_compressed_context
from app.generation import generate_answer
from app.rag_monitoring import (
    configure_logging,
    log_event,
    start_request,
    trace_stage,
)

def ask_monitored(
    question: str,
    tenant_id: str | None = None,
    source: str | None = None,
) -> dict:
    request_id = start_request(question)

    try:
        with trace_stage(request_id, "retrieval_reranking_compression"):
            chunks = retrieve_compressed_context(
                query=question,
                tenant_id=tenant_id,
                source=source,
                candidate_k=20,
                top_k=5,
            )

        log_event(
            request_id,
            
1. retrieval_summary
            chunks_returned=len(chunks),
            chunk_ids=[chunk["id"] for chunk in chunks],
        )

        with trace_stage(request_id, "generation"):
            result = generate_answer(
                question=question,
                chunks=chunks,
            )

        log_event(
            request_id,
            
1. generation_summary
            source_count=len(result["sources"]),
            answer_chars=len(result["answer"]),
        )

        log_event(
            request_id,
            
1. request_completed
            status=
1. success
        )

        return result

    except Exception as exc:
        log_event(
            request_id,
            
1. request_failed
            error_type=type(exc).__name__,
        )
        raise

if __name__ == "__main__":
    configure_logging()

    result = ask_monitored(
        
1. How did we prevent duplicate Stripe webhook processing?
    )

    print("\nAnswer:\n", result["answer"])
```

Run it:

```bash
python -m app.monitored_rag
```

This records the overall retrieval stage and the generation stage. For more detailed diagnosis, add `trace_stage()` inside your existing functions around embedding, database search, reranking, compression, and any external API calls.

Don't log exception messages indiscriminately: they may contain query text, SQL details, or provider response content. Record the exception type by default and send detailed errors only to a suitably protected error-reporting system.

## 4. Diagnose problems with a decision tree

  Start with the failed answer

**Did retrieval return a relevant chunk?**

`No`
**Inspect ingestion and retrieval**
Check extracted text, chunk boundaries, filters, embeddings, and search ranking.

`Yes`
**Inspect later stages**
Check reranking, compression, prompt construction, and generation.

---

**Was the relevant evidence preserved in the final context?**

**No**
Adjust reranking or compression; inspect the exact text passed to generation in a secure debug environment.

**Yes**
Inspect the prompt, model output, citation validation, and abstention behavior.

This approach avoids randomly changing prompts when the real problem is a missing or incorrectly indexed document.

## 5. Production metrics and alerts

Track these metrics over time:

| Metric | What it helps detect |
|---|---|
| Retrieval hit rate | Relevant chunks are being missed |
| Empty retrieval rate | Queries return no candidates |
| p50 / p95 latency | Typical and slow requests |
| LLM error rate | Provider outages, rate limits, or invalid requests |
| Citation validation failure rate | Invalid source references |
| Abstention rate | How often the system cannot answer |
| Token usage and cost | Unexpected usage increases |

Don't alert on every individual bad answer. Establish a baseline, define acceptable thresholds, and alert on meaningful changes—for example, a sustained rise in empty retrievals or p95 latency.

## 6. Your practical exercise

  Monitoring checklist

1. Run the monitored pipeline and confirm that request IDs appear in logs.
2. Record retrieval and generation durations separately.
3. Inspect returned chunk IDs when an answer is incorrect, without exposing document content in normal logs.
4. Simulate a failure in a test environment and confirm that the failed stage is recorded.
- [ ] setDone(old=>old.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

## 7. What comes next?

You've now covered the core RAG application lifecycle:

- Ingestion and chunking
- Embeddings and vector databases
- Hybrid retrieval, reranking, rewriting, and compression
- Grounded generation and citations
- Evaluation and monitoring

The next logical module is **Module 7: Production Hardening and Deployment**, where we'll cover API design with FastAPI, request validation, authentication and tenant isolation, asynchronous processing, caching, retries, Docker deployment, and production readiness.

We'll turn your collection of RAG components into a service that other applications can call reliably.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 6.3: RAG Evaluation Metrics (Hit Rate, MRR, Context Recall, Faithfulness)](03-evaluating-your-rag-system.md) | ➡️ [Next: Module 7.1: Build a Production RAG API with FastAPI](../07-production-deployment/01-fastapi-service.md)
