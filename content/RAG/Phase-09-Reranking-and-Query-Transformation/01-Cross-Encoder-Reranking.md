# 01 — Cross-Encoder Reranking

> The fast vector search that scans millions of chunks only approximates true relevance — cross-encoder reranking adds a slower, far more accurate second pass over a small shortlist.

---

## Table of Contents

1. [The Problem: Fast Retrieval Isn't Precisely Ordered](#1-the-problem-fast-retrieval-isnt-precisely-ordered)
2. [The Analogy: A Resume Scanner, Then a Careful Human Reviewer](#2-the-analogy-a-resume-scanner-then-a-careful-human-reviewer)
3. [Internal Flow: Bi-Encoders vs Cross-Encoders](#3-internal-flow-bi-encoders-vs-cross-encoders)
4. [Code Example: Retrieve Top 20, Then Rerank with a Cross-Encoder](#4-code-example-retrieve-top-20-then-rerank-with-a-cross-encoder)
5. [Comparison: Bi-Encoder vs Cross-Encoder](#5-comparison-bi-encoder-vs-cross-encoder)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Fast Retrieval Isn't Precisely Ordered

Every vector store you've used so far (Chroma, Pinecone, pgvector — Phases 5-7) answers a similarity query by comparing a pre-computed query embedding against millions of pre-computed chunk embeddings and returning the closest ones, fast. That speed is only possible because each embedding was computed *independently* — the query never actually "looks at" the full text of a candidate chunk before scoring it. It just compares two fixed-length vectors that were each produced without knowledge of the other.

That independence is a trade-off, not a free lunch. Two chunks can end up with very similar embeddings to a query's embedding even though, read side by side, one is clearly a better answer than the other — the embedding model captured *general* topical similarity, but it never had the chance to weigh the query and that specific chunk against each other word-for-word. The practical consequence: the top 20 results from a vector search are a good *shortlist* — the truly relevant chunk is very likely somewhere in there — but their exact order within that shortlist is only approximately correct. Chunk #1 in the ranked list isn't reliably the single best match; it's just the closest by an approximation that had to be cheap enough to run over millions of candidates.

If your RAG pipeline hands the LLM whatever came back in positions 1-3 of that approximate ranking, you're trusting an approximation exactly where precision matters most — the few chunks that actually make it into the prompt.

---

## 2. The Analogy: A Resume Scanner, Then a Careful Human Reviewer

**Real-world analogy:** a company hiring for a role receives ten thousand resumes. Nobody reads all ten thousand carefully. Instead, an automated scanner does a first pass — checking for keywords, years of experience, degree requirements — in seconds per resume, and narrows ten thousand down to a shortlist of twenty. That scanner is fast precisely *because* it's shallow: it never deeply cross-references one resume's specific project history against the specific responsibilities of the role.

Then a human reviewer takes over — but only for those twenty, never all ten thousand. The reviewer reads each shortlisted resume slowly and carefully, actually weighing its specific details against the specific job requirements, and produces a much more trustworthy final ranking of who to interview first. The reviewer is far more accurate than the scanner, but also far slower — which is exactly why the reviewer only ever looks at the twenty that already passed the first pass, never the full ten thousand.

**Vector search is the scanner; cross-encoder reranking is the human reviewer.** The vector search's job is recall at scale — don't miss the good candidates, do it fast. The cross-encoder's job is precision on a small set — take the shortlist the fast pass already narrowed down, and actually reason about how well each candidate matches, one pair at a time.

> 🧠 Reach for this analogy whenever someone asks "why not just always use the more accurate model" — because the more accurate model is too slow to run at the scale the first pass operates at; the whole design depends on the fast stage doing the narrowing first.

---

## 3. Internal Flow: Bi-Encoders vs Cross-Encoders

**Bi-encoders (what vector search uses).** Every embedding model you've used so far (Phase 2 onward) is a **bi-encoder**: it takes a single piece of text — a query, or a document chunk — and produces one embedding vector for it, completely independently of any other text. The query gets embedded once, each chunk got embedded once (at indexing time, ahead of any specific query), and similarity is just a fast vector-distance computation (cosine similarity or dot product) between two already-computed vectors. This independence is exactly what makes it possible to pre-compute and index millions of chunk embeddings once, then compare a new query against all of them in milliseconds.

**Cross-encoders (what reranking uses).** A **cross-encoder** takes the query and a single candidate document *together*, as one combined input, and passes that whole pair through the model jointly — typically a transformer that attends across both texts at once — to produce a single relevance score for that specific pair. Because the model sees the query and the document simultaneously, it can pick up on much finer-grained relevance signals: whether a specific phrase in the document actually answers the specific question asked, not just whether the two texts are generally about the same topic. This is strictly more accurate than comparing two independently-computed vectors — but it's also much more expensive, because there's no way to pre-compute anything. Every query+document pair has to be freshly scored through the full model, at query time, one pair at a time.

**Why this forces a two-stage pipeline.** A cross-encoder cannot be used for the initial search step — you can't run "query + every chunk in the corpus, jointly, through a transformer" over millions of chunks and expect an acceptable response time. So the standard pattern is:

1. **Stage 1 (recall):** bi-encoder vector search retrieves a shortlist — commonly the top 10-50 candidates — fast, approximately ordered.
2. **Stage 2 (precision):** a cross-encoder re-scores *only that shortlist*, pair by pair, producing a much more trustworthy final ordering, from which you take the true top 3-5 to actually hand to the LLM.

The cross-encoder never touches the full corpus. It only ever operates on however many candidates the bi-encoder already narrowed things down to.

---

## 4. Code Example: Retrieve Top 20, Then Rerank with a Cross-Encoder

This example assumes a Chroma collection already populated with chunks, using a **persistent client** — reusing the same setup pattern from Phase 5, `chromadb.PersistentClient(path=...)`, not the in-memory `chromadb.Client()` — so the data survives across runs and this snippet is actually querying real, previously-indexed content rather than an empty collection.

```python
import chromadb
from sentence_transformers import CrossEncoder

# --- Stage 0: connect to an already-populated persistent collection ---
# (This reuses a collection built in an earlier phase's indexing step, e.g.
# Phase 5's chroma_data directory with `.add()` already called on real chunks.)
client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection(name="support_docs")

# If this is the first time running this specific example standalone, populate
# it so the query below has real data to retrieve from:
if collection.count() == 0:
    collection.add(
        ids=[f"doc_{i}" for i in range(5)],
        documents=[
            "Our refund policy allows returns within 30 days of purchase, provided the item is unused.",
            "To reset your password, go to Settings, then Security, then Reset Password.",
            "Error code ERR-4471 indicates a failed payment authorization during checkout.",
            "International shipping typically takes 7-14 business days to arrive.",
            "Refunds for damaged items are processed immediately, without the 30-day restriction.",
        ],
    )

query = "Can I get my money back if the item I received was broken?"

# --- Stage 1: fast bi-encoder recall -- get a shortlist (here, top 4 of a
# small demo corpus; a real corpus would use top_k=20 or so) ---
results = collection.query(query_texts=[query], n_results=4)
candidate_docs = results["documents"][0]  # list[str], approximately ranked

print("Bi-encoder (vector search) order:")
for rank, doc in enumerate(candidate_docs, start=1):
    print(f"  {rank}. {doc}")

# --- Stage 2: slow, accurate cross-encoder rerank over just this shortlist ---
# CrossEncoder is instantiated with a model name; .predict() takes a list of
# (query, document) tuples and returns a numpy array of relevance scores --
# for this model family, higher score means more relevant (it is NOT a
# distance metric where lower is better).
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
pairs = [(query, doc) for doc in candidate_docs]
scores = reranker.predict(pairs)  # numpy array, one score per pair

# Reorder the shortlist by the cross-encoder's scores, descending.
reranked = sorted(zip(candidate_docs, scores), key=lambda pair: pair[1], reverse=True)

print("\nCross-encoder reranked order:")
for rank, (doc, score) in enumerate(reranked, start=1):
    print(f"  {rank}. (score={score:.3f}) {doc}")
```

Notice the shape of the result: the bi-encoder shortlist is likely to rank *some* refund-related chunk near the top already (that's what recall is for), but it may not reliably put the "damaged items processed immediately, without the 30-day restriction" chunk *ahead of* the more generic 30-day refund policy chunk — even though, for a query specifically about a broken item, that chunk is the more precisely relevant one. The cross-encoder, having read the query and each candidate jointly, is much better positioned to make that call correctly.

---

## 5. Comparison: Bi-Encoder vs Cross-Encoder

| | Bi-Encoder (vector search) | Cross-Encoder (reranker) |
|---|---|---|
| **What it computes** | One embedding per text, independently | One joint score per (query, document) pair |
| **Speed** | Very fast — compares pre-computed vectors | Slow — every pair requires a fresh forward pass |
| **Scalability** | Scales to millions of documents (pre-indexed) | Only scales to a small shortlist (tens of candidates) |
| **Accuracy** | Good general topical relevance | More accurate fine-grained relevance judgment |
| **When to use** | Stage 1: initial recall over the full corpus | Stage 2: precision reordering of an already-narrow shortlist |

---

## 6. Common Mistakes

**Mistake 1: Running the cross-encoder over the entire corpus instead of just the shortlist.** This is the single most common and most damaging mistake with reranking. A cross-encoder that takes, say, 20ms per pair is completely fine over a shortlist of 20 candidates (400ms) but catastrophic over a corpus of a million chunks (over five hours, per query). The whole design depends on the bi-encoder doing the narrowing first — the cross-encoder is a refinement step on an already-small set, never a replacement for the initial search.

**Mistake 2: Treating the cross-encoder's output as a distance metric.** Different cross-encoder models have different score conventions. For a model like `cross-encoder/ms-marco-MiniLM-L-6-v2`, a *higher* score means more relevant — sorting `reverse=True` as in the example above. Confusing this with a distance-style metric (where lower is better, as with raw cosine distance in some vector stores) silently inverts your final ranking. Always check the specific model's documented scoring convention rather than assuming.

**Interview angle:** if asked "how would you improve retrieval precision on top of an existing vector search," naming reranking specifically — and being able to explain *why* a cross-encoder is more accurate but too slow to use directly at index scale — signals real hands-on understanding. A weaker answer just says "add a reranker" without being able to explain the bi-encoder/cross-encoder distinction underneath it.

---

## 7. Hands-On Exercises

### Exercise 1 — Compare orderings before and after reranking

Using the code example above, run the same query through the bi-encoder shortlist and the cross-encoder rerank, and print both orderings side by side. Identify at least one case where the order changed, and explain in your own words *why* the cross-encoder might have made that call differently than the vector search.

### Exercise 2 — Time the two stages

Wrap the `collection.query(...)` call and the `reranker.predict(...)` call each in a simple timer (e.g. `time.perf_counter()` before and after). Compare the per-item cost: time per document scored by the vector search vs. time per document scored by the cross-encoder. Use this to reason about why reranking 20 candidates is fine but reranking 100,000 would not be.

### Exercise 3 — Vary the shortlist size

Re-run the pipeline with `n_results=2` and then `n_results=10`. Discuss the trade-off: a larger shortlist gives the cross-encoder more candidates to potentially find a better match among (higher recall going into stage 2), but costs more reranking time. Where would you draw the line for a latency-sensitive production system?

---

## 8. Interview Q&A

### Q1. What's the difference between a bi-encoder and a cross-encoder?

**Answer:** A bi-encoder embeds the query and each document independently into fixed vectors and compares them with a fast distance computation — this is what standard vector search uses, and it scales to millions of documents because chunk embeddings can be pre-computed once. A cross-encoder takes the query and a single document together as one combined input and jointly processes them through the model to produce one relevance score per pair — this is more accurate because the model can directly compare the two texts, but it's much slower because nothing can be pre-computed; every pair needs a fresh model pass.

---

### Q2. Why can't you just use a cross-encoder for your primary retrieval instead of a vector store?

**Answer:** Because a cross-encoder requires a full model forward pass for every single (query, document) pair it scores, with no pre-computation possible. Running that over an entire corpus of potentially millions of documents, for every query, would be far too slow for any real-time system. Cross-encoders are only practical over a small shortlist — typically the top 10-50 candidates a fast bi-encoder-based vector search already narrowed down.

---

### Q3. What does a `CrossEncoder.predict()` call return, and how do you use it?

**Answer:** It takes a list of `(query, document)` tuples and returns a numpy array of relevance scores, one per pair. For most cross-encoder models in the `sentence-transformers` family (e.g. `ms-marco-MiniLM-L-6-v2`), a higher score means more relevant — so you sort candidates by that score descending to get the reranked order, not ascending as you might with a distance metric.

---

### Q4. What's the typical shortlist size fed into a reranker, and why not rerank the full retrieved set?

**Answer:** Commonly the top 10-50 candidates from the initial vector search. The size is a trade-off: a larger shortlist gives the reranker more chances to surface a truly relevant document that the vector search under-ranked, but each additional candidate adds reranking latency since cross-encoder scoring doesn't parallelize as cheaply as vector comparisons. You rerank only the shortlist — never the full corpus — because the cross-encoder's cost per document is orders of magnitude higher than the bi-encoder's.

---

### Q5. Give an example of a situation where reranking changes the final order versus the raw vector search order.

**Answer:** A query about a broken item's refund eligibility might have a vector search rank a generic "30-day refund policy" chunk above a more specific "damaged items are refunded immediately, without the 30-day restriction" chunk, simply because both chunks are topically close to "refund" in embedding space. A cross-encoder, reading the query and each chunk together, can recognize that the second chunk more precisely answers the specific question about a broken item, and rerank it above the generic policy chunk.

---

> 🧠 **Memory hook:** "The vector search is the résumé scanner — fast and broad. The cross-encoder is the human reviewer — slow, careful, and only ever looking at the shortlist."
