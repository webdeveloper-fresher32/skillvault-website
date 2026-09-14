# Caching, Rate Limiting, and Retries — Complete Guide

> "A high-volume expressway toll plaza uses fast automated pass transponders (caching) and metered signal lights (rate limiting) to prevent traffic jams from collapsing the highway network."

---

## Table of Contents

1. [The Problem: High Costs, Rate Limit Errors, and Provider Outages](#1-the-problem-high-costs-rate-limit-errors-and-provider-outages)
2. [The Expressway Toll Plaza Analogy](#2-the-expressway-toll-plaza-analogy)
3. [The Mechanism: LLM Caching and Fallback Chains](#3-the-mechanism-llm-caching-and-fallback-chains)
4. [Diagram: Multi-Layer Caching and Resilient Fallback Architecture](#4-diagram-multi-layer-caching-and-resilient-fallback-architecture)
5. [Code Walkthrough: Redis Semantic Cache with Fallback Model](#5-code-walkthrough-redis-semantic-cache-with-fallback-model)
6. [Comparing Exact vs Semantic Caching](#6-comparing-exact-vs-semantic-caching)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: High Costs, Rate Limit Errors, and Provider Outages

In production, popular queries are asked thousands of times ("What is your refund policy?"), wasting API dollars and latency. Meanwhile, upstream LLM providers occasionally return `429 Too Many Requests` or `503 Service Unavailable`.

### Production Vulnerabilities

```text
Duplicate Query Problem:
  1,000 users ask: "How do I reset my password?"
  → Without cache: 1,000 GPT-4o calls = $30.00 + 1,500 seconds total latency.
  → With cache: 1 GPT-4o call + 999 cache hits = $0.03 + 2ms latency per hit!

Provider Outage Problem:
  OpenAI API experiences a 5-minute outage
  → Without fallbacks: 100% of user requests crash with 500 errors.
  → With fallbacks: Automatically switches to Anthropic Claude 3.5 Sonnet seamlessly.
```

### The Solution: Multi-Layer Caching & Fallback Networks

LangChain provides global LLM caching (`InMemoryCache`, `RedisCache`, `RedisSemanticCache`) and `.with_fallbacks()` for resilient high availability.

---

## 2. The Expressway Toll Plaza Analogy

A highway authority does not force every single car to stop, roll down the window, and pay in coins to a human clerk.

### Manual Cash Toll vs Electronic Transponder

```text
Manual Cash Toll  → Every car stops for 45 seconds; traffic backs up for miles;
                     if the toll collector drops coins, all traffic halts.

Transponder Pass  → Registered cars zip through overhead sensors in 5ms;
                     metered on-ramp lights prevent expressway gridlock.
```

### Mapping to LangChain

Electronic pass is the Redis cache; metered on-ramp lights are the client-side rate limiters; emergency detour lanes are the fallback models.

---

## 3. The Mechanism: LLM Caching and Fallback Chains

LangChain enables global LLM caching through `langchain_core.globals.set_llm_cache`.

### Enabling Exact and Semantic Caching

```python
from langchain_core.globals import set_llm_cache
from langchain_community.cache import InMemoryCache, RedisCache, RedisSemanticCache
from langchain_openai import OpenAIEmbeddings

# 1. Global in-memory cache
set_llm_cache(InMemoryCache())

# 2. Redis Exact Cache
set_llm_cache(RedisCache(redis_url="redis://localhost:6379/0"))

# 3. Redis Semantic Cache (Matches similar meaning, not just exact strings)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
set_llm_cache(RedisSemanticCache(
    redis_url="redis://localhost:6379/0",
    embedding=embeddings,
    score_threshold=0.92
))
```

---

## 4. Diagram: Multi-Layer Caching and Resilient Fallback Architecture

### Request Flow with Caching and Fallbacks

```text
Incoming User Query: "How do I cancel my subscription?"
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Redis Semantic Cache Lookup (Vector Similarity >= 0.92)  │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │ (Cache Hit: < 5ms)        │ (Cache Miss)
           ▼                           ▼
┌─────────────────────┐   ┌──────────────────────────────────┐
│ Return Cached Text  │   │ 2. Primary Model (GPT-4o)        │
│ (Zero API Cost)     │   └────────────────┬─────────────────┘
└─────────────────────┘                    │
                             ┌─────────────┴─────────────┐
                             │ (Success)                 │ (429 / 503 Outage)
                             ▼                           ▼
                     ┌────────────────┐         ┌────────────────────┐
                     │ Write to Cache │         │ 3. Fallback Model  │
                     │ & Return to Usr│         │ (Claude 3.5 Sonnet)│
                     └────────────────┘         └────────────────────┘
```

---

## 5. Code Walkthrough: Redis Semantic Cache with Fallback Model

A production-grade script configuring semantic caching, exponential backoff retries, and cross-provider model failover:

```python
# production_resilience_demo.py
import os
from langchain_core.globals import set_llm_cache
from langchain_community.cache import InMemoryCache
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

def build_resilient_llm_pipeline():
    # 1. Configure cache
    set_llm_cache(InMemoryCache())

    # 2. Define primary model with retry boundaries
    primary_model = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        max_retries=3,          # Exponential backoff on rate limits
        timeout=10.0            # Request timeout in seconds
    )

    # 3. Define fallback secondary model
    fallback_model = ChatAnthropic(
        model="claude-3-5-sonnet-20241022",
        temperature=0,
        max_retries=2
    )

    # 4. Bind fallbacks to primary model
    resilient_model = primary_model.with_fallbacks([fallback_model])

    prompt = ChatPromptTemplate.from_template("Provide a concise 1-sentence definition of: {term}")
    return prompt | resilient_model | StrOutputParser()

if __name__ == "__main__":
    chain = build_resilient_llm_pipeline()
    # Call 1 (Triggers LLM generation)
    print("Run 1:", chain.invoke({"term": "BGP Anycast Routing"}))
    # Call 2 (Instant Cache Hit)
    print("Run 2 (Cached):", chain.invoke({"term": "BGP Anycast Routing"}))
```

---

## 6. Comparing Exact vs Semantic Caching

| Feature | Exact Caching (`RedisCache`) | Semantic Caching (`RedisSemanticCache`) |
|---|---|---|
| Match Criteria | Exact character-for-character prompt match | Cosine similarity above threshold ($\ge 0.90$) |
| Hit Rate | Low for conversational chat; high for fixed forms | High across synonymous conversational queries |
| Computational Cost | Near zero ($O(1)$ key lookup) | Requires 1 embedding API call per query |
| False Positive Risk | Zero | Low-to-Medium if similarity threshold is too low |
| Best Used For | Deterministic batch extraction tasks | Public FAQ bots, customer support portals |

---

## 7. Common Mistakes

- **Setting semantic cache threshold too low.** A threshold like `0.75` causes the cache to return answers for completely different questions; use $\ge 0.92$.
- **Caching personalized or dynamic prompts.** Caching prompts containing `user_id`, dynamic timestamps, or live user balances returns stale or private data across users.
- **Forgetting `timeout` on primary models.** If the primary LLM hangs on an open TCP socket, `.with_fallbacks()` will not trigger until the default 10-minute HTTP timeout expires.
- **Applying caching on non-zero temperature models.** Caching temperature=0.9 generations defeats the purpose of creative randomness.
- **Not setting TTL on Redis cache entries.** Without TTL or Redis `maxmemory-policy allkeys-lru`, the cache database will eventually run out of memory.

---

## 8. Hands-On Exercises

**Exercise 1:** Enable `InMemoryCache` globally and measure execution time between the first and second identical invocation.

**Exercise 2:** Configure `.with_fallbacks([fallback_model])` and intentionally provide an invalid API key to the primary model to verify automatic failover.

**Exercise 3:** Set up a `RedisSemanticCache` and test it with two paraphrased questions ("What is Kubernetes?" vs "Can you explain Kubernetes?").

**Exercise 4:** Tune the semantic similarity threshold from 0.85 to 0.98 and observe when a cache hit vs miss is triggered.

**Exercise 5:** Add `max_retries=5` and `timeout=5.0` to a chat model and test its behavior during a simulated slow network connection.

---

## 9. Interview Q&A

**Q: How does semantic caching differ from standard key-value caching in LLM systems?**
Standard key-value caching requires an exact character-level string match on the input prompt. Semantic caching generates a vector embedding of the prompt and queries a vector database, returning cached responses if cosine similarity exceeds a high confidence threshold (e.g. 0.92), capturing paraphrased user questions.

**Q: What is the purpose of `.with_fallbacks()` in LangChain?**
`.with_fallbacks([model_b, model_c])` wraps a primary runnable with backup runnables. If the primary model raises an exception (e.g. 429 rate limit, 503 outage, or context window overflow), the executor catches the error and immediately tries the fallback models in order.

**Q: Why should `timeout` always be specified when configuring model fallbacks?**
Without a short client-side timeout (e.g. 5–10 seconds), a hung connection to a degraded LLM provider can stall the user request indefinitely before the fallback mechanism is triggered.

**Q: What is the risk of using semantic caching with multi-tenant data?**
If prompt templates contain tenant IDs or private customer variables, a low similarity threshold could inadvertently serve one customer's private cached response to another customer; semantic caching should only be applied to public, non-sensitive queries.

**Q: How does LangChain handle rate limiting using exponential backoff?**
By setting `max_retries=N`, the underlying HTTP client automatically retries transient errors (`429 Too Many Requests`, `500 Internal Server Error`) with randomized exponential backoff intervals to prevent thundering herd problems.
