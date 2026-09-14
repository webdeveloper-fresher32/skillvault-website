# 03 — Query Expansion and Multi-Query Retrieval

> A single phrasing of a query can miss documents that describe the same thing in different words — generating several reworded queries and merging their results covers more ground.

---

## Table of Contents

1. [The Problem: One Phrasing Can Miss the Right Document](#1-the-problem-one-phrasing-can-miss-the-right-document)
2. [The Analogy: Asking Three People the Same Question, Three Different Ways](#2-the-analogy-asking-three-people-the-same-question-three-different-ways)
3. [Internal Flow: Generate Variants, Retrieve for Each, Merge with RRF](#3-internal-flow-generate-variants-retrieve-for-each-merge-with-rrf)
4. [Code Example: Multi-Query Retrieval with Reciprocal Rank Fusion](#4-code-example-multi-query-retrieval-with-reciprocal-rank-fusion)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: One Phrasing Can Miss the Right Document

Every retrieval technique covered so far in this course — plain vector search, hybrid search, HyDE — still runs on a single query embedding per user question. But a single phrasing of a question is just one path into the corpus, and a relevant document might describe the same underlying concept using entirely different words, structure, or level of formality than however the user happened to phrase their question that day.

A user asking "how do I get a refund" and a document titled "Return and Reimbursement Procedures" are conceptually about the same thing, but "refund" and "reimbursement" are different words, and depending on the embedding model and the specific phrasing, one query might retrieve that document reliably while a slightly different phrasing of the same underlying question might not. Relying on exactly one phrasing of the query means the retrieval quality is at the mercy of however the embedding model happens to have represented that one specific sentence — a single roll of the dice, in effect, rather than a robust search.

---

## 2. The Analogy: Asking Three People the Same Question, Three Different Ways

**Real-world analogy:** imagine you're trying to find out whether a restaurant is any good, so you ask three different friends who've eaten there — but you phrase the question slightly differently to each one. To the first, you ask "was the food good?" To the second, "would you go back?" To the third, "was it worth the price?" Each phrasing surfaces a slightly different angle of the same underlying question, and each friend might emphasize different things in their answer. If you only ever asked one friend, one way, you'd get one slice of the picture. By asking multiple phrasings and combining what you hear back, you get a much more complete, reliable read — and if two of the three friends both independently praised the same dish, that's a much stronger signal than any single friend's opinion alone.

**Multi-query retrieval works the same way.** Instead of trusting one phrasing of the user's query to find everything relevant, you generate several reworded versions of the same underlying question, run retrieval separately for each, and then merge the results — documents that show up across *multiple* query variants' results are a stronger, more trustworthy signal than a document that only one phrasing happened to surface.

> 🧠 Reach for this analogy whenever someone asks "why not just improve the embedding model instead" — because no single embedding model is going to perfectly bridge every possible synonym and phrasing gap; asking the question multiple ways sidesteps the problem rather than trying to solve it inside one embedding call.

---

## 3. Internal Flow: Generate Variants, Retrieve for Each, Merge with RRF

**Step 1 — Generate query variants.** Send the user's original query to an LLM with a prompt asking it to produce several alternative phrasings or related sub-questions — for example, "rewrite this question 3 different ways, using different vocabulary where possible, while preserving the original meaning." This is **query expansion**: broadening a single query into several that together cover more of the ways the underlying concept might be expressed in the corpus.

**Step 2 — Retrieve for each variant independently.** Run a normal vector search (or hybrid search, from Phase 8) for each of the reworded queries, separately, each producing its own ranked list of candidate chunks. At this point you have several ranked lists — one per query variant — potentially overlapping in which documents they surface, and in what order.

**Step 3 — Merge with reciprocal rank fusion.** This is the same RRF technique from Phase 8's hybrid search lesson, applied here across query variants instead of across BM25-vs-vector: for each document, sum `1 / (k + rank(d))` across every ranked list it appears in, with `k=60` as the typical default, then sort by that combined score descending. A document that only one query variant surfaced contributes one term; a document that multiple variants independently surfaced (even at middling ranks in each) accumulates several terms and can rise above a document that only ranked #1 in a single list. This is exactly the same rank-based reasoning that made RRF useful for combining BM25 and vector rankings — it doesn't require the different retrieval passes to produce comparable raw scores, only comparable rank positions.

**Step 4 — Deduplicate.** Because the query variants are different phrasings of the same underlying question, it's common for the *same* chunk to be retrieved by more than one variant. Before or during the RRF merge, results need to be deduplicated by a stable document identifier (not by comparing text strings, which is fragile) so a single chunk doesn't get miscounted as several different candidates.

---

## 4. Code Example: Multi-Query Retrieval with Reciprocal Rank Fusion

This example uses the Claude API to generate query variants, and a Chroma **persistent client** already populated with real chunks (same setup pattern as the earlier lessons in this phase — `chromadb.PersistentClient(path=...)`, not the in-memory `chromadb.Client()`).

```python
import chromadb
from anthropic import Anthropic

client_llm = Anthropic()

chroma_client = chromadb.PersistentClient(path="./chroma_data")
collection = chroma_client.get_or_create_collection(name="support_docs")

if collection.count() == 0:
    collection.add(
        ids=[f"doc_{i}" for i in range(4)],
        documents=[
            "Our refund policy allows returns within 30 days of purchase, provided the item is unused.",
            "Return and Reimbursement Procedures: items must be shipped back within one month of the order date.",
            "To reset your password, go to Settings, then Security, then Reset Password.",
            "International shipping typically takes 7-14 business days to arrive.",
        ],
    )


def generate_query_variants(query: str, n: int = 3) -> list[str]:
    """Ask the LLM to produce n reworded versions of the original query."""
    response = client_llm.messages.create(
        model="claude-opus-4-8",
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Rewrite the following question {n} different ways, using "
                    "different wording where possible while preserving the "
                    "original meaning. Reply with exactly one rewritten "
                    "question per line, no numbering or extra text.\n\n"
                    f"Question: {query}"
                ),
            }
        ],
    )
    text = response.content[0].text
    # Split into lines and drop any blank lines from the LLM's formatting.
    variants = [line.strip() for line in text.splitlines() if line.strip()]
    return variants[:n]


def rrf_score(doc_id: str, rank_lists: list[dict], k: int = 60) -> float:
    """Reciprocal rank fusion, identical formula to Phase 8's hybrid search."""
    total = 0.0
    for ranks in rank_lists:
        if doc_id in ranks:
            total += 1.0 / (k + ranks[doc_id])
    return total


def multi_query_retrieve(query: str, n_variants: int = 3, n_results: int = 3) -> list[str]:
    all_queries = [query] + generate_query_variants(query, n=n_variants)

    rank_lists = []  # one dict per query: {doc_id: rank}
    doc_text_by_id = {}  # keep track of the actual text for each id, for deduplication

    for q in all_queries:
        results = collection.query(query_texts=[q], n_results=n_results)
        ids = results["ids"][0]
        docs = results["documents"][0]
        ranks = {doc_id: rank for rank, doc_id in enumerate(ids, start=1)}
        rank_lists.append(ranks)
        for doc_id, doc_text in zip(ids, docs):
            doc_text_by_id[doc_id] = doc_text  # de-duplicates automatically by id

    # Merge: score every unique document id seen across all rank lists.
    all_doc_ids = doc_text_by_id.keys()
    fused = sorted(
        all_doc_ids,
        key=lambda doc_id: rrf_score(doc_id, rank_lists),
        reverse=True,
    )

    return [doc_text_by_id[doc_id] for doc_id in fused]


query = "how do I get my money back"
final_results = multi_query_retrieve(query)

print("Multi-query fused results:")
for rank, doc in enumerate(final_results, start=1):
    print(f"  {rank}. {doc}")
```

Notice the deduplication step: both `doc_0` ("Our refund policy...") and `doc_1` ("Return and Reimbursement Procedures...") are strong candidates for a refund-related question, but they use different vocabulary ("refund" vs "reimbursement"). A single query phrasing might reliably surface only one of them; generating variants like "how do I request a reimbursement" or "what's the process to return an item for a refund" makes it far more likely that *both* relevant documents show up somewhere across the merged results, rather than the system getting lucky (or unlucky) on one specific wording.

---

## 5. Common Mistakes

**Mistake 1: Generating too many query variants.** Each additional variant means one more full retrieval pass against the vector store, multiplying retrieval latency and cost roughly linearly. Going from 1 query to 3 is often a strong improvement for modest added cost; going from 3 to 10 usually adds diminishing returns — most of the useful phrasing diversity is already covered by a handful of variants, and beyond that you're mostly paying for redundant coverage of the same documents.

**Mistake 2: Not deduplicating overlapping results across variants.** If the same document comes back from two different query variants and is treated as two separate candidates (for example, by keying on document text instead of a stable id, or by simply concatenating result lists without merging), it can throw off the fused ranking and waste slots in the final context that could have gone to a genuinely different document. Always deduplicate by document id, not by raw text comparison, since two chunks with near-identical wording but slightly different formatting would otherwise be miscounted as distinct.

**Interview angle:** if asked "how would you make retrieval robust to different ways users phrase the same question," multi-query retrieval combined with RRF is the concrete, implementable answer — and being able to name RRF specifically (rather than a vague "combine the results somehow") is what distinguishes a candidate who has actually built this from one who has only heard the term. It's also worth being able to explain the cost trade-off unprompted, since interviewers often push on "what if you generated 20 variants" to see if the candidate recognizes the diminishing-returns problem.

---

## 6. Hands-On Exercises

### Exercise 1 — Inspect the generated variants

Call `generate_query_variants("how do I get my money back")` directly and print the result. Judge for yourself whether the variants meaningfully differ in vocabulary (a good sign) or are just trivial rewordings of the same words (a sign the prompt might need tightening).

### Exercise 2 — Measure the effect of deduplication

Modify the example to skip deduplication — instead, concatenate all `docs` lists directly without keying by id — and observe how a single document occurring in multiple variants' results distorts the naive combined list versus the properly deduplicated, RRF-fused version.

### Exercise 3 — Find the point of diminishing returns

Run `multi_query_retrieve` with `n_variants=1`, `3`, and `6` against the same query, and compare how much the fused top results actually change between 3 and 6 variants versus how much retrieval time increases. Write down, in your own words, where you'd draw the line for a production system with a latency budget.

---

## 7. Interview Q&A

### Q1. What problem does multi-query retrieval solve that a single query embedding doesn't?

**Answer:** A single phrasing of a user's query only captures one path into the corpus's vocabulary and structure. Relevant documents may use different wording, synonyms, or framing for the same underlying concept, and a single embedding may or may not bridge that gap reliably. Multi-query retrieval generates several reworded versions of the query, retrieves for each, and merges the results, so retrieval isn't solely dependent on how well one specific phrasing happens to embed against the corpus.

---

### Q2. How do you merge the results from multiple query variants into one final ranking?

**Answer:** With reciprocal rank fusion (RRF), the same technique used in Phase 8 to combine BM25 and vector search rankings. For each unique document, sum `1 / (k + rank(d))` across every query variant's ranked list it appears in, using `k=60` as a typical default, then sort by that combined score descending. Documents that multiple query variants independently surface accumulate a higher combined score than documents only one variant found.

---

### Q3. What's the risk of generating too many query variants?

**Answer:** Each variant requires its own full retrieval pass, so cost and latency scale roughly linearly with the number of variants. Beyond a handful (commonly 3-5), additional variants tend to surface mostly redundant results rather than meaningfully new relevant documents, so the added retrieval cost stops being proportional to the benefit.

---

### Q4. Why is deduplication important in multi-query retrieval, and how should it be done?

**Answer:** Different query variants frequently retrieve the same underlying document, since they're reworded versions of the same question. If those duplicates aren't recognized as the same document — for example, by comparing raw text instead of a stable document id — they can be double-counted, distorting the fused ranking and wasting space in the final result set. Deduplication should key off a stable document identifier assigned at indexing time, not text similarity.

---

### Q5. Is query expansion the same thing as generating a HyDE hypothetical answer? How do they differ?

**Answer:** No. HyDE generates one hypothetical *answer* to the query and embeds that single hypothetical document to replace the query embedding for a single retrieval pass. Query expansion/multi-query retrieval generates multiple reworded *questions* (not answers) and performs a separate retrieval pass for each, then merges the multiple resulting ranked lists with RRF. They solve related but distinct problems — HyDE bridges a query-vs-document style gap in a single search; multi-query retrieval covers multiple possible phrasings of the question across several searches — and they can be combined (generating multiple variants, each optionally passed through HyDE) in a more advanced pipeline.

---

> 🧠 **Memory hook:** "Ask it three different ways, then trust whichever document shows up no matter how you asked."
