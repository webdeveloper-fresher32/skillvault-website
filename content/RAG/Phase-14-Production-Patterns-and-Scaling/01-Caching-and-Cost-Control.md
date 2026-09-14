# 01 — Caching and Cost Control

> A comprehensive reference covering why naive RAG pipelines redo expensive work on every query, the three caching layers that fix it, and a working cosine-similarity-based semantic cache.

---

## Table of Contents

1. [The Problem: Every Query Pays Full Price](#1-the-problem-every-query-pays-full-price)
2. [The Analogy: The Fast-Food Kitchen That Pre-Makes Common Orders](#2-the-analogy-the-fast-food-kitchen-that-pre-makes-common-orders)
3. [Internal Flow: Three Caching Layers](#3-internal-flow-three-caching-layers)
4. [Code Example: A Simple In-Memory Semantic Cache](#4-code-example-a-simple-in-memory-semantic-cache)
5. [Comparing the Caching Layers](#5-comparing-the-caching-layers)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Every Query Pays Full Price

Every RAG pipeline you've built so far in this course does the same amount of work no matter how many times the same (or a nearly identical) question has already been asked: embed the query, search the vector store, assemble a prompt, and call the LLM. Each of these steps has a real cost — an embedding-model API call, a vector-database round trip, and, most expensive of all, an LLM generation call that's billed per token and takes real wall-clock time.

At small scale this is fine. At production scale it isn't. Popular questions get asked over and over — "how do I reset my password," "what's your refund policy," "how do I cancel my subscription" — and a naive pipeline pays the full embedding + retrieval + generation cost every single time, even for a question that's been asked, word-for-word or near enough, a thousand times already today. That's wasted money and wasted latency for work whose answer was already computed and is very likely still correct.

The concrete problem this lesson solves: **how do you avoid redoing expensive, repeatable work, without serving stale or wrong answers to genuinely different questions?**

---

## 2. The Analogy: The Fast-Food Kitchen That Pre-Makes Common Orders

**Real-world analogy:** picture two fast-food kitchens on a busy Friday night.

Kitchen A cooks every single order completely from scratch, starting with raw ingredients, the moment it arrives — even though 80% of orders are the same handful of popular items. Every burger gets its patty grilled fresh, one at a time, in the order it was requested. The kitchen is "correct" — every order is made properly — but it's slow, and it burns through gas and staff-hours re-doing work that's nearly identical order after order.

Kitchen B is smarter. It keeps a small batch of the most popular items — pre-grilled patties, pre-toasted buns — ready to assemble instantly the moment a matching order comes in, and only fires up a fresh, from-scratch cook for orders that don't match anything already prepared. Kitchen B serves the common case fast and cheap, while still cooking special or unusual orders properly from scratch.

**Caching in a RAG pipeline is Kitchen B's strategy.** Instead of re-running the full embed → retrieve → generate pipeline for every query, you keep the results of recent or common queries ready to serve instantly, and only run the full (expensive) pipeline for queries that are actually new. The one thing Kitchen B has to get right that Kitchen A never worries about: knowing precisely when a new order is "close enough" to something pre-made to reuse it, versus when it's different enough that it needs the real kitchen — get that judgment wrong, and a customer who ordered "no onions" gets a burger with onions. That judgment call is exactly what Section 6 covers.

> 🧠 Reach for this analogy whenever you need the one-line version: *"Don't re-cook from scratch every time — but know when an order is different enough that you have to."*

---

## 3. Internal Flow: Three Caching Layers

A production RAG pipeline typically layers caching at three different points, each catching a different kind of repeated work.

**Embedding cache.** The same document chunk should never need to be re-embedded twice. If your ingestion pipeline re-runs (say, a scheduled re-index job that touches documents that haven't actually changed), an embedding cache keyed on a hash of the chunk's text lets you skip the embedding-model API call entirely for chunks you've already embedded, and reuse the stored vector. This is the cheapest, lowest-risk cache in the stack, because the input (identical text) genuinely guarantees an identical embedding — there's no fuzziness or judgment call involved.

**Semantic cache.** This is the layer that catches *repeated or near-duplicate queries* rather than repeated documents. The idea: embed the incoming query (using the same embedding approach from Phase 2), and compare it against the embeddings of recent queries you've already answered, using cosine similarity — the exact metric and formula established in Phase 2's `cosine_similarity(a, b) = dot(a, b) / (|a| × |b|)`. If a new query's embedding is similar enough (above some chosen threshold) to a previously cached query's embedding, you skip retrieval and generation entirely and return the cached answer. This is the highest-leverage cache for cost and latency, because it can skip the single most expensive step (the LLM generation call) — but it's also the riskiest, because "similar enough" is a judgment call, not a guarantee of an identical question (Section 6).

**Response caching with TTLs.** Even for an exact-match query (not just a semantically similar one), you generally don't want to cache an answer forever — the underlying documents might change, making yesterday's cached answer wrong today. A TTL (**T**ime-**T**o-**L**ive — a duration after which a cache entry is considered expired and must be recomputed) puts an expiration on every cached response, so stale answers get naturally evicted and recomputed even if nothing explicitly invalidates them. Response caching is often layered *underneath* the semantic cache: an exact-match response cache (keyed on the literal query string) catches the truly identical repeated question cheaply, while the semantic cache catches paraphrases that a literal string match would miss.

```
   Query arrives
        │
        ▼
   ┌─────────────────────┐   hit    ┌───────────────────────────┐
   │ 1. Response cache    │ ───────▶ │ Return cached answer       │
   │ (exact string match, │          │ (cheapest, fastest path)    │
   │  respects TTL)        │          └───────────────────────────┘
   └─────────────────────┘
        │ miss
        ▼
   ┌─────────────────────┐   hit    ┌───────────────────────────┐
   │ 2. Semantic cache     │ ───────▶ │ Return cached answer from  │
   │ (cosine similarity    │          │ the similar prior query    │
   │  vs. recent queries)  │          └───────────────────────────┘
   └─────────────────────┘
        │ miss
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ 3. Full pipeline: embed → retrieve (embedding cache      │
   │    speeds up re-indexing, not this step) → augment →     │
   │    generate — then store the result in both caches        │
   └─────────────────────────────────────────────────────────┘
```

---

## 4. Code Example: A Simple In-Memory Semantic Cache

The following builds a minimal semantic cache using exactly the cosine similarity formula from Phase 2's `02-Vector-Similarity-and-Distance-Metrics.md`. It's deliberately in-memory and single-process — a real production system would back this with a shared store (e.g. Redis) so multiple server instances share the same cache — but the matching logic is identical either way.

```python
import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Same formula as Phase 2: dot product divided by the product of magnitudes."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


class SemanticCache:
    """A minimal semantic cache: reuse a prior answer if a new query's
    embedding is similar enough (by cosine similarity) to a cached query's
    embedding. `threshold` controls how strict "similar enough" is."""

    def __init__(self, threshold: float = 0.95):
        self.threshold = threshold
        # Each entry is a dict: {"query": str, "vector": np.ndarray, "answer": str}
        self.entries: list[dict] = []

    def get(self, query_vector: np.ndarray) -> str | None:
        """Return a cached answer if a similar-enough query was seen before,
        else None. `str | None` means the return value is either a string
        or the literal None -- Python's way of writing "optional string"."""
        best_score = -1.0
        best_answer = None
        for entry in self.entries:
            score = cosine_similarity(query_vector, entry["vector"])
            if score > best_score:
                best_score = score
                best_answer = entry["answer"]

        if best_score >= self.threshold:
            return best_answer
        return None  # no cached entry was similar enough -- caller must run the full pipeline

    def set(self, query: str, query_vector: np.ndarray, answer: str) -> None:
        self.entries.append({"query": query, "vector": query_vector, "answer": answer})


def embed(text: str) -> np.ndarray:
    """Stand-in for a real embedding-model call (Phase 2). In production this
    calls an embedding API/model; here we fake deterministic vectors so the
    example runs standalone."""
    # A real system would call e.g. an embedding model here and get back a
    # vector of hundreds of dimensions -- this stub exists only so the example
    # is runnable without an API key.
    rng = np.random.default_rng(abs(hash(text)) % (2**32))
    return rng.random(8)


def run_full_pipeline(query: str) -> str:
    """Stand-in for the real embed -> retrieve -> augment -> generate pipeline
    from Phases 1-10. Expensive: this is exactly the work we want to avoid
    repeating for near-duplicate queries."""
    return f"[generated answer for: {query}]"


def answer_query(query: str, cache: SemanticCache) -> str:
    query_vector = embed(query)

    cached = cache.get(query_vector)
    if cached is not None:
        return cached  # cache hit -- skipped retrieval AND generation entirely

    # Cache miss: run the real pipeline, then store the result for next time.
    answer = run_full_pipeline(query)
    cache.set(query, query_vector, answer)
    return answer
```

The important line is `if best_score >= self.threshold`. Setting `threshold` too low (e.g. 0.80) risks treating meaningfully different questions as "the same" and returning a wrong cached answer. Setting it too high (e.g. 0.999) means almost nothing gets a cache hit except near-exact duplicates, which limits how much cost and latency you actually save. In a real system this threshold is tuned empirically against your own query traffic and evaluated the same way you'd evaluate retrieval quality in Phase 11 — by checking cache-hit answers against ground truth, not just trusting a chosen number.

---

## 5. Comparing the Caching Layers

| Layer | What it catches | Risk if wrong | Typical cost saved |
|---|---|---|---|
| **Embedding cache** | Re-embedding the exact same document chunk | Very low — identical text always produces an identical embedding | Embedding-model API cost during re-indexing |
| **Semantic cache** | Paraphrased or near-duplicate *queries* | Highest — a "close enough" match can still be a meaningfully different question | Retrieval + LLM generation cost (the most expensive step) |
| **Response cache (TTL)** | Exact repeated queries, with automatic staleness expiry | Low if TTL is short enough relative to how often source documents change | Retrieval + LLM generation cost for literal repeats |

---

## 6. Common Mistakes

**Mistake 1: Caching answers too aggressively and serving stale or wrong answers for subtly different queries.**

A semantic cache threshold set too loosely can conflate genuinely different questions that merely *sound* similar. "What's the refund policy for opened items?" and "What's the refund policy for unopened items?" can produce highly similar embeddings — the surrounding words are nearly identical — while having opposite correct answers. A cache that returns the "unopened" answer for the "opened" question because cosine similarity crossed the threshold is a silent, confident, wrong answer — arguably worse than no cache at all, because a user has no signal that anything went wrong.

**Mistake 2: Not invalidating the cache when underlying documents change.**

If a document backing a cached answer gets updated or deleted (a policy changes, a price changes), a cache with no TTL and no invalidation hook keeps serving the old answer indefinitely, because nothing ever told it the source data moved. Production systems need either a TTL short enough to bound how stale an answer can get, or an explicit invalidation step tied to the document-ingestion pipeline (Phase 3) — when a document is re-indexed, any cache entries that depended on it should be evicted, not left to expire naturally on their own schedule.

**Interview angle:** "How would you cache a RAG pipeline without serving wrong answers?" is a common systems-design follow-up once a candidate mentions caching for cost savings. The strong answer distinguishes exact-match response caching (safe, cheap, needs only a TTL) from semantic caching (higher payoff, but introduces a real correctness risk that has to be actively managed via threshold tuning, monitoring cache-hit accuracy, and invalidating on document change) — a candidate who says "just cache everything" without acknowledging this tradeoff hasn't thought through the failure mode.

---

## 7. Hands-On Exercises

### Exercise 1 — Trigger a cache hit and a cache miss

**Goal:** Confirm the `SemanticCache` from Section 4 behaves as expected on both a near-duplicate and a genuinely different query.

Using the code from Section 4, call `answer_query("How do I reset my password?", cache)`, then call it again with a reworded version like `"How can I reset my password?"` and confirm you get a cache hit (same cached answer returned, no new `run_full_pipeline` call). Then call it with a clearly unrelated query like `"What's your shipping time to Canada?"` and confirm it triggers a cache miss instead. (Note: because `embed()` in this example uses a text-hash-seeded random vector rather than a real embedding model, near-duplicate phrasings won't actually score high on cosine similarity — replace `embed()` with a call to a real embedding model, or a small hand-picked vector dict as in Phase 2's exercises, to see realistic hit/miss behavior.)

### Exercise 2 — Break the cache with a threshold that's too loose

**Goal:** Reproduce Mistake 1 directly.

Lower `threshold` to something very permissive (e.g. `0.5`), and feed the cache two queries you'd expect to have *different* correct answers (e.g. "refund policy for opened items" vs. "refund policy for unopened items", using real or hand-picked embeddings that are close but not identical). Confirm the second query gets served the first query's cached (and wrong) answer. This is the exact failure mode Mistake 1 describes, made concrete.

### Exercise 3 — Add a TTL to the semantic cache

**Goal:** Extend `SemanticCache` from Section 4 to store a timestamp with each entry and treat entries older than a given TTL as expired (skip them in `get()`, or evict them). This closes the gap identified in Mistake 2 — cached answers eventually get forced to recompute even without an explicit invalidation signal.

---

## 8. Interview Q&A

### Q1. Why does caching matter for a production RAG system specifically?

**Answer:** Every query in a naive RAG pipeline re-embeds the query, re-runs retrieval, and re-calls the LLM — even for repeated or near-duplicate questions. At production scale, popular questions get asked constantly, so redoing this full pipeline every time wastes money (embedding and LLM API costs) and adds unnecessary latency for work whose answer is often still valid.

### Q2. What's the difference between a response cache and a semantic cache?

**Answer:** A response cache matches on the literal query string (or a hash of it) and only produces a hit for exact repeats. A semantic cache embeds the incoming query and compares it, via cosine similarity, against previously cached queries' embeddings, producing a hit for paraphrased or reworded questions that mean the same thing even if the wording differs. Semantic caching catches more repeated work but introduces a real risk of false-positive matches that a literal string match never would.

### Q3. What cosine similarity threshold should a semantic cache use?

**Answer:** There's no universal number — it has to be tuned empirically against real query traffic and evaluated by checking whether cache hits actually produce correct answers, the same way retrieval quality is evaluated in Phase 11. Too low a threshold risks conflating meaningfully different questions (a correctness risk); too high a threshold produces very few cache hits (limiting the cost/latency benefit).

### Q4. How do you keep a semantic cache from serving stale answers after a source document changes?

**Answer:** Two complementary mechanisms: a TTL that automatically expires cache entries after a bounded amount of time regardless of whether anything explicitly invalidated them, and an explicit invalidation step tied to document re-ingestion, so that when a document is updated, any cache entries derived from it are evicted immediately rather than waiting out their TTL.

### Q5. Which is riskier to get wrong: an embedding cache or a semantic cache, and why?

**Answer:** A semantic cache is riskier. An embedding cache only ever reuses a vector for text that is byte-for-byte identical to text it's seen before, so there's no ambiguity — identical input guarantees an identical, correct embedding. A semantic cache reuses an *answer* based on a similarity score crossing a threshold, which is a judgment call rather than a guarantee, so it can serve a wrong answer for a query that merely resembles a previously cached one without meaning the same thing.

---

> 🧠 **Memory hook:** "Cache the kitchen's popular orders, not a guess at what the customer meant — a semantic cache saves money exactly to the degree you trust its threshold."
