# 03 — Debugging Bad Retrievals

> A comprehensive reference covering a systematic checklist for diagnosing bad retrieval, each item tied back to the earlier phase that addresses it, plus a diagnostic script for sanity-checking the embedding model itself.

---

## Table of Contents

1. [The Problem: A Trace Points at Retrieval — Now What?](#1-the-problem-a-trace-points-at-retrieval--now-what)
2. [The Analogy: A Differential Diagnosis](#2-the-analogy-a-differential-diagnosis)
3. [Internal Flow: The Five-Item Debugging Checklist](#3-internal-flow-the-five-item-debugging-checklist)
4. [Code Example: Sanity-Checking the Embedding Model Itself](#4-code-example-sanity-checking-the-embedding-model-itself)
5. [The Checklist, Mapped to Phases](#5-the-checklist-mapped-to-phases)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: A Trace Points at Retrieval — Now What?

Lesson 02 gave you a way to *locate* the failing stage: read a `RAGTrace` and find the first checkpoint where something looks wrong. Suppose you've done exactly that, and the trace clearly shows the problem is retrieval — `retrieved_chunks` doesn't contain the chunk that should have answered the question, even though you can confirm that chunk exists somewhere in your document collection.

Knowing *that* retrieval failed is only half the job. Retrieval can fail for several structurally different reasons, and they call for completely different fixes: a mismatched embedding model calls for a different fix than a chunk size that splits information awkwardly, which calls for a different fix than an over-aggressive metadata filter. Guessing at a fix without first narrowing down *which* of these is actually happening wastes time and can make things worse — you might "fix" chunk size when the real problem was the embedding model, see no improvement, and conclude (wrongly) that chunking isn't the issue either.

So the concrete problem this lesson solves: **given confirmed evidence that retrieval returned the wrong chunks, work through a systematic, ordered set of checks — rather than randomly changing settings — to find and fix the actual cause.**

---

## 2. The Analogy: A Differential Diagnosis

**Real-world analogy:** when a patient walks in with a set of symptoms, a good doctor doesn't guess at a cure and prescribe it on a hunch. They work through a **differential diagnosis** — a structured list of the most likely causes for those symptoms, checked one at a time in a sensible order, each one either ruled in or ruled out with a specific test, before any treatment is prescribed. Fatigue and weight loss could be a dozen different conditions; the doctor doesn't treat all twelve at once, and doesn't pick one at random — they check the most likely and easiest-to-test causes first, narrow the list down, and only then treat the one that's actually confirmed.

**Debugging a bad retrieval is the same discipline.** "Retrieval returned the wrong chunk" has a handful of well-known likely causes — the same ones every time, in practice — and the fix is to check them in a sensible order, confirming or ruling out each one with a specific, targeted test, rather than changing five pipeline settings at once and hoping something improves.

> 🧠 One-line version: *"Don't prescribe a cure before running the tests — check each likely cause in order, and confirm it before you 'fix' it."*

---

## 3. Internal Flow: The Five-Item Debugging Checklist

Work through these five checks in order. Each one is cheap to test and, if confirmed, points to a specific, well-understood fix from an earlier phase in this course.

**1. Is the embedding model consistent between indexing and query time?** If chunks were embedded with one model (or one model version) at indexing time, and the query is embedded with a *different* model at query time, the two sets of vectors don't live in a comparable space at all — similarity scores between them are close to meaningless, even though nothing about your retrieval logic itself is "wrong." This is the single most common silent failure, because it produces no error — just consistently bad results. Ties back to **Phase 2** (LLM & Embedding Basics), which covers how embedding models produce vectors and why comparing vectors from two different models is comparing apples to oranges.

**2. Is chunk size appropriate for this content?** A chunk that's too small can split a sentence (or a fact and its qualifying context) across a boundary, so neither half alone contains the complete relevant information the query is looking for. A chunk that's too large can dilute a specific relevant sentence with enough surrounding unrelated text that its embedding no longer closely matches the query's meaning. Ties back to **Phase 4** (Chunking Strategies), which covers how to choose chunk size and overlap for a given kind of content.

**3. Is metadata filtering excluding the right document?** If your retrieval query includes a metadata filter (e.g., only search documents tagged `department: "billing"`), and the actually-relevant chunk is tagged differently (or wasn't tagged at all), the filter silently excludes it before similarity search ever gets a chance to consider it — the chunk could have a perfect embedding match and still never be returned. Ties back to **Phases 6 and 7** (Vector Databases - Pinecone and pgvector), which cover metadata filtering syntax and how filters combine with similarity search in each store.

**4. Does the query need rewriting or HyDE?** Sometimes the embedding model itself and the chunking are both fine, but the *user's literal query wording* is a poor semantic match for how the relevant chunk is phrased — a short, vague, or oddly-worded question can embed to a vector that's further from the relevant chunk than a better-phrased version of the same question would be. Query rewriting or HyDE (Hypothetical Document Embeddings — embedding a hypothetical *answer* instead of the literal question) can close this gap. Ties back to **Phase 9** (Reranking & Query Transformation), which covers both techniques.

**5. Does `k` (or `fetch_k`) need tuning?** If the relevant chunk actually is being retrieved, but ranked outside the top-`k` cutoff the pipeline uses, the fix isn't the embedding model or chunking at all — it's simply that too few candidates are being considered (or handed to a reranker that could have promoted it). Ties back to **Phase 8** (Retrieval Strategies), which covers how `k` and `fetch_k` interact with strategies like MMR.

```
   1. Embedding model consistency  ──▶  Phase 2
   2. Chunk size / boundaries       ──▶  Phase 4
   3. Metadata filtering            ──▶  Phases 6/7
   4. Query rewriting / HyDE        ──▶  Phase 9
   5. k / fetch_k tuning            ──▶  Phase 8

   Check top to bottom. Confirm each one with a specific test before
   changing anything -- don't skip to a fix based on a hunch.
```

Notice the ordering isn't arbitrary: item 1 (embedding consistency) is checked first because if it's broken, none of the other four checks are meaningful — you'd be tuning chunk size or `k` against similarity scores that don't reflect real semantic similarity in the first place. Only once the embedding model itself is confirmed sane does it make sense to move on to chunking, filtering, query phrasing, and `k`.

---

## 4. Code Example: Sanity-Checking the Embedding Model Itself

Checklist item 1 — embedding consistency — is the cheapest to test and should come first. The idea: take a query and a document you *know* should be a strong match (you wrote them yourself, or you've manually confirmed the document answers the query), re-embed both right now using whatever embedding model and call pattern your pipeline actually uses, and compute their cosine similarity directly. If a known-good pair scores low, the embedding model or how it's being called is the problem — not the rest of the pipeline.

This reuses the exact cosine similarity formula from Phase 2 Lesson 02 (`dot(a, b) / (|a| * |b|)`), applied to a pair of real embeddings instead of hand-picked toy vectors.

```python
import numpy as np
from langchain_openai import OpenAIEmbeddings  # or whichever Embeddings class your pipeline uses


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Same formula as Phase 2 Lesson 02: dot product divided by the
    product of both vectors' magnitudes -- direction only, scale ignored."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def diagnose_embedding_consistency(
    known_good_query: str,
    known_good_document: str,
    embeddings_model: OpenAIEmbeddings,
) -> None:
    """Re-embed a query/document pair known to be a strong match, using the
    exact embedding model the pipeline uses, and print their similarity.

    A low score here (well below what you'd expect for an obviously matching
    pair) points at the embedding model itself, or how it's being invoked --
    not at chunking, filtering, or k -- as the root cause.
    """
    query_vector = np.array(embeddings_model.embed_query(known_good_query))
    doc_vector = np.array(embeddings_model.embed_query(known_good_document))
    # embed_query (not embed_documents) is used for both here deliberately --
    # some embedding models apply different internal handling to "query" vs.
    # "document" inputs, so mixing the two methods when you're specifically
    # trying to isolate the model's own behavior would muddy the test.

    similarity = cosine_similarity(query_vector, doc_vector)
    print(f"Query:    {known_good_query!r}")
    print(f"Document: {known_good_document!r}")
    print(f"Cosine similarity: {similarity:.4f}")

    if similarity < 0.5:
        print("LOW similarity for a known-good pair -- suspect the embedding "
              "model or the way it's being called (Phase 2), before looking "
              "at chunking, filtering, or k.")
    else:
        print("Similarity looks reasonable -- the embedding model itself is "
              "likely fine; move on to checklist items 2-5.")


embeddings = OpenAIEmbeddings()
diagnose_embedding_consistency(
    known_good_query="What's the return window for a purchase?",
    known_good_document=(
        "Our refund policy allows returns within 30 days of purchase, "
        "provided the item is unused and in its original packaging."
    ),
    embeddings_model=embeddings,
)
```

The `0.5` threshold above is illustrative, not a universal law — the "reasonable" similarity range varies by embedding model and by how semantically close your known-good pair actually is in wording. The point of this script isn't to produce one magic passing number; it's to give you a concrete, reproducible baseline reading for a pair you already know should match well, so you have something to compare against when a real query-document pair in production scores surprisingly low.

---

## 5. The Checklist, Mapped to Phases

| Checklist item | What it tests | Phase to revisit | Symptom if this is the cause |
|---|---|---|---|
| **1. Embedding consistency** | Same model/version used for indexing and query embedding | Phase 2 | Consistently bad retrieval across nearly all queries, with no obvious pattern by topic |
| **2. Chunk size** | Chunks aren't splitting facts across boundaries or diluting them with unrelated text | Phase 4 | Retrieval finds a chunk "near" the right answer but missing a key detail, or finds nothing despite the fact clearly existing in the source document |
| **3. Metadata filtering** | Filters aren't excluding the relevant document before similarity search runs | Phases 6/7 | Retrieval works fine for unfiltered queries but fails specifically when a metadata filter is applied |
| **4. Query rewriting / HyDE** | The literal query wording embeds close to how the relevant chunk is phrased | Phase 9 | Retrieval fails specifically for short, vague, or oddly-phrased queries, but works for queries phrased similarly to the source text |
| **5. `k` / `fetch_k` tuning** | The relevant chunk is ranked within the cutoff actually used | Phase 8 | The relevant chunk is confirmed to be *in the candidate set* somewhere, just outside the top-`k` that made it to the prompt |

---

## 6. Common Mistakes

**Mistake 1: Changing multiple pipeline variables at once when debugging.** It's tempting, when a retrieval is bad, to change the embedding model *and* bump up chunk size *and* widen `k` all in the same debugging session, hoping one of them fixes it. The problem: if the answer improves, you don't actually know which change fixed it — and if two of the changes had opposing effects (one making things better, one making things worse), the net result might look unchanged even though you made real progress on one front and real regression on another. Change exactly one variable at a time, re-test with the same known-good query, and only then move to the next checklist item — exactly the discipline the differential-diagnosis analogy in Section 2 is built around.

**Mistake 2: Skipping straight to checklist item 5 (tuning `k`) because it's the easiest change to make.** Widening `k` is a one-line config change, so it's often the first thing people try — and sometimes it does help, purely by accident, because a wider net happens to catch the relevant chunk despite an underlying embedding or chunking problem still being present. But if the real issue is checklist item 1 or 2, widening `k` just means more *irrelevant* candidates get passed to the reranker and prompt, without fixing the actual cause — and the next query with a similar underlying issue will fail again. Work the checklist in order rather than reaching for the easiest fix first.

**Interview angle:** "A user reports that your RAG system gave a wrong answer, and you've confirmed via tracing that retrieval returned the wrong chunks. What do you do next?" is a natural, concrete follow-up to a tracing question, and a strong answer walks through a checklist rather than naming one favorite fix — checking embedding consistency first (since everything else is meaningless if that's broken), then chunk boundaries, then metadata filters, then query phrasing, then `k` — and explicitly says they'd change one variable at a time so the actual cause is identifiable, not just "fixed" by coincidence.

---

## 7. Hands-On Exercises

### Exercise 1 — Run the embedding sanity check against a genuinely mismatched pair

**Goal:** See what a *failing* diagnostic actually looks like, not just a passing one.

Run `diagnose_embedding_consistency` from Section 4 with the same known-good document, but pair it with a query about a completely unrelated topic (e.g., "What's the boiling point of mercury?"). Confirm the similarity score comes back noticeably lower than the known-good pair's score. Then run it once more with a query that's topically related but phrased very differently from the document's wording (e.g., "Can I send this back?" against the refund-policy document) and compare all three scores.

### Exercise 2 — Work the checklist against a synthetic failure

**Goal:** Practice the ordered-checklist discipline end to end.

Take Phase 10's pipeline and deliberately introduce exactly one of the five failure modes (for example: build the vector store using one `OpenAIEmbeddings` model but embed the query with a *different* embedding model — checklist item 1 — or set a metadata filter that excludes the document that actually answers your test question — checklist item 3). Without looking at your own deliberate change, use the checklist in Section 3 to work through items 1-5 in order and identify which one is broken. Confirm your diagnosis matches the change you actually made.

### Exercise 3 — Change one variable at a time and log the result

**Goal:** Build the habit from Mistake 1 directly.

Pick a real (or realistic) retrieval failure. Before touching any pipeline setting, write down your current hypothesis (which checklist item you suspect) and a prediction of what should happen if you're right. Make exactly one change, re-run the same test query, and record whether the prediction held. Repeat for a second hypothesis only if the first didn't resolve it. At the end, explain why this one-change-at-a-time log would have been harder to produce if you'd changed three settings simultaneously.

---

## 8. Interview Q&A

### Q1. A trace confirms retrieval returned the wrong chunks. What's the first thing you'd check, and why first?

**Answer:** Whether the embedding model is consistent between indexing time and query time — including using the same model version and the same embedding call pattern. It's checked first because if the embeddings themselves aren't comparable, no other fix (chunk size, filtering, query rewriting, `k`) can produce good results, since the similarity scores retrieval relies on wouldn't reflect real semantic similarity in the first place.

---

### Q2. How would you sanity-check whether the embedding model itself is the problem, versus the rest of the pipeline configuration?

**Answer:** Take a query and a document you already know should be a strong match, re-embed both directly using the exact embedding model and call method the pipeline uses, and compute their cosine similarity. A surprisingly low score for a known-good pair points at the embedding model or how it's being invoked as the root cause; a reasonable score means the embedding model is likely fine and the problem lies elsewhere in the pipeline (chunking, filtering, query phrasing, or `k`).

---

### Q3. Retrieval works for most queries but fails specifically when a metadata filter is applied. Which checklist item does this point to, and what phase covers the fix?

**Answer:** This points to checklist item 3 — the metadata filter is likely excluding the document that actually answers the query, either because it's tagged incorrectly or wasn't tagged at all. This is covered in Phases 6 and 7 (Vector Databases - Pinecone and pgvector), which cover how metadata filtering combines with similarity search in each store.

---

### Q4. Why is it a mistake to change several pipeline settings at once while debugging a bad retrieval?

**Answer:** Because if the result improves, you don't know which change actually caused the improvement — and if changes have opposing effects, you could make real progress on one dimension while regressing on another and see no net change, masking both effects. Changing exactly one variable at a time, re-testing after each change, is the only way to attribute an improvement (or lack of one) to a specific cause.

---

### Q5. Widening `k` seems to fix a bad retrieval. Should you stop there?

**Answer:** Not necessarily. Widening `k` can "fix" a symptom by accident — casting a wider net that happens to catch the relevant chunk — without addressing an underlying problem like a mismatched embedding model or poor chunk boundaries. If the underlying cause wasn't actually `k` being too narrow, similar queries will likely fail again later. It's worth confirming the fix by checking whether the relevant chunk was already being retrieved (just outside the old cutoff) versus not being retrieved at all even at a wide `k`, which would point to an earlier checklist item instead.

---

> 🧠 **Memory hook:** "Run the differential diagnosis before prescribing the cure — embedding, then chunking, then filtering, then query phrasing, then k — one test, one change, at a time."
