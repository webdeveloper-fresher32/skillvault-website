> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.2: Authentication, Tenant Isolation & API Security](02-authentication-and-tenant-isolation.md) | ➡️ [Module 7.4: Multi-Layer Caching (Embedding Cache & Retrieval Cache)](04-caching-in-production-rag.md)

---

# Module 7 — Lesson 3: Rate Limiting, Timeouts, Retries, and Error Handling

Now let's make your RAG API resilient.

Your API may work perfectly on your Mac, but production introduces problems:

- A user sends 100 requests in a few seconds.
- PostgreSQL takes 15 seconds to return search results.
- The LLM provider temporarily returns `429 Too Many Requests`.
- An external request times out after you've already paid for processing.
- A retry accidentally repeats an expensive operation.

The goal is to **fail safely, recover from temporary problems, and prevent one client from exhausting your resources.**

## 1. Understand the four protections

**Rate limiting**
Controls how many requests a client can make within a time window.
Example: 20 requests per minute per authenticated user.

**Timeouts**
Prevent a request from waiting indefinitely for a database or external service.

**Retries**
Repeat transiently failed operations with bounded exponential backoff.

**Error handling**
Return safe, predictable responses without exposing internal implementation details.

These protections complement one another. A timeout doesn't limit traffic, and a retry doesn't guarantee an operation is safe to repeat.

## 2. Add rate limiting to FastAPI

For a simple local demonstration, we'll use `slowapi`, which integrates with Starlette and FastAPI.

Install it inside your existing virtual environment:

```bash
python -m pip install slowapi
python -m pip freeze > requirements.txt
```

Update `app/api.py` with the following pieces. Keep your existing request and response models and secured `/ask` handler.

Add the rate limiter configuration near the top of `app/api.py`:

```python

from fastapi import Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)

```

Then update your `/ask` route:

```python

@app.post("/ask", response_model=AskResponse)
@limiter.limit("20/minute")
def ask(
    request: Request,
    body: AskRequest,
    principal: Principal = Depends(get_current_principal),
) -> AskResponse:
    try:
        result = ask_monitored(
            question=body.question,
            tenant_id=principal.tenant_id,
            source=body.source,
        )
        return AskResponse(
            answer=result["answer"],
            sources=result.get("sources", []),
        )
    except Exception:
        logger.exception("RAG request failed")
        raise HTTPException(
            status_code=500,
            detail=
1. Unable to process the question right now.
        )

```

Notice that the FastAPI `Request` argument is needed by SlowAPI. The rate limit is per client IP in this example, not per authenticated user.

**Production consideration:** IP-based limiting can be unfair when many users share an IP. For a multi-tenant service, prefer limits based on verified user or tenant identity, and use shared storage such as Redis when running multiple application workers or instances. Configure trusted proxy handling carefully; don't trust arbitrary client-supplied forwarding headers.

## 3. Set timeouts for external services

Timeouts should be configured at the actual network client, not just around the FastAPI route.

For example, if `app/generation.py` uses the OpenAI Python SDK, configure the client with finite connection and request timeouts:

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    timeout=30.0,
    max_retries=0,
)
```

Here, SDK retries are disabled because we'll demonstrate an explicit retry policy next. If you keep the SDK's built-in retries enabled, account for them in your total retry and timeout budget rather than adding another uncontrolled retry loop.

A 30-second SDK timeout is not a promise that the entire API request will finish in 30 seconds. Retrieval, reranking, compression, and generation all consume time, so define a separate end-to-end request deadline at the application or infrastructure layer as well.

For PostgreSQL, use your connection pool and driver configuration to limit connection waits and statement execution. A statement timeout can be configured for a transaction or session; don't rely solely on the LLM timeout to protect the database.

## 4. Retry temporary failures safely

A common mistake is retrying the entire RAG pipeline whenever anything fails. That may repeat embedding, database queries, and LLM calls unnecessarily.

Instead, retry the **specific external operation** that failed.

Install Tenacity:

```bash
python -m pip install tenacity
python -m pip freeze > requirements.txt
```

Create `app/retry_utils.py`:

```python

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)

@retry(
    retry=retry_if_exception_type(
        (
            APIConnectionError,
            APITimeoutError,
            InternalServerError,
            RateLimitError,
        )
    ),
    wait=wait_random_exponential(
        multiplier=1,
        max=8,
    ),
    stop=stop_after_attempt(3),
    reraise=True,
)
def call_llm_with_retry(client, **kwargs):
    return client.responses.create(**kwargs)

```

In your generation code, use the helper for the actual Responses API call:

```python
from app.retry_utils import call_llm_with_retry

response = call_llm_with_retry(
    client,
    model=model_name,
    instructions=system_prompt,
    input=user_prompt,
)
```

Adapt the arguments to match your existing `generation.py` implementation.

How this works:

1. The first call fails with a recognized transient error.
2. Tenacity waits for a randomized interval, increasing the wait on subsequent attempts.
3. It tries at most three times in total.
4. If all attempts fail, the original exception is raised.

Important limitations:

- A `429` caused by exhausted account quota generally won't be fixed by retrying.
- A rate-limit response may include a `Retry-After` header; a production policy should honor it when appropriate.
- Never retry every exception indiscriminately.
- Retrying a generation request may incur additional cost. A timeout also doesn't necessarily mean the provider failed to process the request.
- Keep a total deadline so retries cannot make the user wait indefinitely.

If you use the retry helper, keep the SDK's automatic retries disabled or carefully coordinate both retry layers.

## 5. Return useful HTTP errors

Your endpoint should distinguish common failure classes instead of returning `500` for everything.

| Situation | HTTP status | Meaning |
|---|---:|---|
| Missing or invalid credentials | `401` | Authentication required |
| Authenticated user lacks permission | `403` | Access denied |
| Invalid request body | `422` | Fix the input |
| Rate limit exceeded | `429` | Slow down |
| Temporary provider or database outage | `503` | Service temporarily unavailable |
| Unexpected application failure | `500` | Internal error |

For a temporary upstream failure, you can return `503 Service Unavailable` with a generic message and, where appropriate, a `Retry-After` header. Avoid returning database connection strings, stack traces, provider responses, or raw exception messages to clients.

Also remember that synchronous FastAPI routes execute in a thread pool. For heavy workloads, control concurrency and use appropriate async clients or background workers rather than allowing expensive requests to accumulate without limit.

## 6. Test the failure scenarios

Use these scenarios to check your implementation:


1. Send requests repeatedly and verify the rate limit eventually returns HTTP 429.
2. Confirm the LLM client has a finite timeout.
3. Simulate a transient LLM error and verify retries stop after the configured maximum.
4. Simulate a permanent configuration error and verify it is not retried.
5. Confirm API responses don't expose internal exception details.
- [ ] setChecks(prev=>prev.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

## 7. What you've learned

Your RAG service now has a plan for handling overload, slow dependencies, temporary provider failures, and safe client-facing errors.

The production principle to remember is:

**Limit incoming work → bound execution time → retry only transient failures → fail safely when recovery doesn't work.**

Next lesson: **Caching in RAG** — we'll learn how to cache embeddings, retrieval results, and generated answers to reduce latency and cost without accidentally mixing data between tenants or serving stale information.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.2: Authentication, Tenant Isolation & API Security](02-authentication-and-tenant-isolation.md) | ➡️ [Next: Module 7.4: Multi-Layer Caching (Embedding Cache & Retrieval Cache)](04-caching-in-production-rag.md)
