> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.3: Rate Limiting, Timeouts, Retries & Error Handling](03-rate-limiting-timeouts-and-retries.md) | ➡️ [Module 7.5: Asynchronous Document Ingestion & Background Workers](05-background-ingestion-and-async-processing.md)

---

# Module 7 — Lesson 4: Caching in Production RAG

Let's make your RAG application faster and reduce unnecessary embedding and LLM API costs.

Imagine a user asks:

> How does hybrid search improve retrieval?

Five seconds later, the same user asks the same question again. Your application performs the same retrieval, reranking, compression, and LLM generation all over again.

That can waste time and money. **Caching stores the result of an expensive operation so it can be reused when the inputs and relevant data haven't changed.**

## 1. Where can we cache in a RAG pipeline?

```
[User Question]
("What is our enterprise refund policy?")
       │
       ▼
[Layer 1: Embedding Cache]
(LRU Cache · Have we already computed an embedding vector for this input?)
       │
       ▼
[Layer 2: Retrieval Cache]
(Redis / Memory · Have we searched this exact corpus with matching filters?)
       │
       ▼
[Layer 3: Answer & Citation Cache]
(Semantic Cache · Do we have a verified, non-stale grounded answer?)
       │
       ▼
[Instant Response]
(Return cached answer + citations in < 5ms without expensive LLM API calls)
```

These are separate caches. You can cache an embedding even if retrieval changes, or cache retrieval results while generating a fresh answer.

| Cache | Benefit | Main risk |
|---|---|---|
| Embedding | Avoids recomputing vectors | Reusing a vector from the wrong model |
| Retrieval | Avoids repeated database searches | Stale results after document updates |
| Answer | Avoids repeated LLM calls | Stale answers or cross-tenant data leaks |

We'll start with a simple in-process cache, then discuss how to scale it across multiple API instances.

## 2. Cache embeddings

You already have an `app/embedding_service.py` with `get_model()` decorated using `@lru_cache(maxsize=1)`. That caches the loaded embedding model, which is good—but it does **not** cache individual text embeddings.

Let's cache repeated inputs too.

Install `cachetools`:

```bash
python -m pip install cachetools
python -m pip freeze > requirements.txt
```

Update `app/embedding_service.py` by adding an embedding cache:

```python

from cachetools import TTLCache
from threading import RLock

from sentence_transformers import SentenceTransformer

MODEL_NAME = 
1. sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION = 384

_embedding_cache = TTLCache(
    maxsize=2000,
    ttl=3600,
)
_cache_lock = RLock()

def embed_text_cached(text: str) -> list[float]:
    # Include model identity so embeddings from different
    # models are never confused.
    cache_key = f
1. {MODEL_NAME}:{text}
    with _cache_lock:
        cached = _embedding_cache.get(cache_key)
        if cached is not None:
            return cached.copy()

    vector = embed_texts([text])[0]

    with _cache_lock:
        _embedding_cache[cache_key] = vector

    return vector.copy()

```

This assumes your existing `embed_texts()` function and `MODEL_NAME` are already defined in the same module. Keep those definitions and add this code below them; don't duplicate the model declaration or replace the existing batch function.

Now use:

```python
from app.embedding_service import embed_text_cached

vector = embed_text_cached(
    
1. How does hybrid search improve retrieval?
)
```

### How it works

- `maxsize=2000`: bounds the number of cached entries.
- `ttl=3600`: entries expire after one hour.
- `RLock`: protects cache access when multiple threads use the application.
- The model name is part of the key to prevent mixing embeddings produced by different models.

This is an in-memory cache. Each worker process has its own cache, and entries disappear when the process restarts. Also, this simple cache may compute the same embedding more than once if identical requests arrive simultaneously before the first computation completes. That's a performance inefficiency, not a correctness issue.

For large document ingestion, continue using your existing batch `embed_texts()` function rather than embedding every chunk separately.

## 3. Cache retrieval results

Retrieval depends on more than the question. These two searches are not equivalent:

- `"What is the leave policy?"` for tenant A
- `"What is the leave policy?"` for tenant B

Your cache key must include all inputs that can affect the result.

Create `app/retrieval_cache.py`:

```python

import hashlib
import json
from threading import RLock

from cachetools import TTLCache

_retrieval_cache = TTLCache(
    maxsize=1000,
    ttl=120,
)
_cache_lock = RLock()

def make_retrieval_cache_key(
    query: str,
    tenant_id: str,
    source: str | None,
    top_k: int,
    corpus_version: str,
) -> str:
    payload = {
        "query": query,
        "tenant_id": tenant_id,
        "source": source,
        "top_k": top_k,
        "corpus_version": corpus_version,
    }

    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        serialized.encode("utf-8")
    ).hexdigest()

def get_cached_retrieval(key: str):
    with _cache_lock:
        value = _retrieval_cache.get(key)

        # Return a copy so callers can't mutate cached state.
        return None if value is None else value.copy()

def set_cached_retrieval(key: str, chunks: list[dict]) -> None:
    with _cache_lock:
        _retrieval_cache[key] = [
            dict(chunk) for chunk in chunks
        ]

```

The `corpus_version` is a version identifier for the indexed data. Change it whenever a document update, deletion, or reindexing could change the results. You could maintain a corpus version per tenant in your database.

The two-minute TTL limits how long results remain cached, but **TTL alone doesn't guarantee immediate freshness**. A version change makes old entries unreachable when the new version is used.

This sample copies dictionaries shallowly. If your chunk objects contain nested mutable structures, use immutable objects or deep copies where appropriate.

## 4. Connect the retrieval cache to your pipeline

Add this function to `app/retrieval_cache.py`:

```python

from app.compressed_retrieval import retrieve_compressed_context

def retrieve_cached(
    query: str,
    tenant_id: str,
    source: str | None = None,
    top_k: int = 5,
    corpus_version: str = "v1",
) -> list[dict]:
    key = make_retrieval_cache_key(
        query=query,
        tenant_id=tenant_id,
        source=source,
        top_k=top_k,
        corpus_version=corpus_version,
    )

    cached = get_cached_retrieval(key)
    if cached is not None:
        return cached

    chunks = retrieve_compressed_context(
        query=query,
        tenant_id=tenant_id,
        source=source,
        candidate_k=20,
        top_k=top_k,
    )

    set_cached_retrieval(key, chunks)
    return chunks

```

This assumes your existing `retrieve_compressed_context()` accepts `query`, `tenant_id`, `source`, `candidate_k`, and `top_k`, as in the previous lessons. If your current function signature differs, adjust the call to match your actual code.

To use this in the monitored pipeline, replace the direct call to `retrieve_compressed_context()` in `app/monitored_rag.py` with `retrieve_cached()` and supply the current tenant's corpus version.

For example:

```python
from app.retrieval_cache import retrieve_cached

chunks = retrieve_cached(
    query=question,
    tenant_id=tenant_id,
    source=source,
    top_k=5,
    corpus_version=current_corpus_version,
)
```

`current_corpus_version` must come from a trustworthy source, such as your database—not from a client-provided value. If you don't yet track corpus versions, implement that first or use a short TTL while accepting that updates might not appear immediately.

## 5. Cache generated answers carefully

Answer caching can save the most money because it avoids repeated LLM calls. But it's also the cache with the highest correctness and security risk.

Suppose an answer was generated before a document was updated. Returning it after the update may be wrong.

A robust answer-cache key should account for:

- Tenant and authorization scope
- Normalized question
- Relevant filters and conversation context
- Corpus version
- Model and prompt version
- Any settings that affect generation or citation behavior

Never share cached answers across tenants merely because their questions are identical. For permission-sensitive systems, tenant identity alone may not be sufficient if users within a tenant have different document permissions.

A practical starting policy:

1. Cache retrieval results first.
2. Measure hit rate and stale-result behavior.
3. Add answer caching only for suitable requests, with versioning and authorization checks.
4. Avoid caching personalized or highly sensitive answers unless your policy explicitly permits it.

## 6. Scale beyond one process

An in-memory cache is useful during development, but each worker has its own cache. If you deploy four workers, the same result may be computed and cached four times.

For a distributed deployment, use a shared cache such as Redis.

**API worker 1**
Checks shared cache

**API worker 2**
Uses the same shared cache

---

**Redis**
Shared cache with expiry and eviction policies

Redis doesn't automatically make caching correct. You still need tenant-aware keys, expiry, invalidation, bounded memory, and appropriate access controls. Avoid putting sensitive document text into cache keys or unprotected cache logs.

## 7. Test your cache


1. Call embed_text_cached twice with the same text and compare the returned vectors.
2. Call retrieve_cached twice with the same query and filters; instrument the retrieval function to confirm the second call is a cache hit.
3. Change tenant_id and verify that the cache key changes.
4. Change corpus_version and verify that updated documents cannot reuse the old cached retrieval result.
- [ ] setChecks(prev=>prev.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

One final production note: measure cache hit rate, latency saved, memory usage, and stale-result incidents. A cache that rarely hits or serves incorrect results isn't an optimization.

**Next lesson: Background ingestion and asynchronous processing.** We'll move document parsing, chunking, embedding, and indexing out of the user-facing request so large uploads don't make your RAG API slow or unreliable.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.3: Rate Limiting, Timeouts, Retries & Error Handling](03-rate-limiting-timeouts-and-retries.md) | ➡️ [Next: Module 7.5: Asynchronous Document Ingestion & Background Workers](05-background-ingestion-and-async-processing.md)
