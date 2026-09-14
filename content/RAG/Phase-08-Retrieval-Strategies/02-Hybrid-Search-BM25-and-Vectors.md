# 02 — Hybrid Search: BM25 and Vectors

> Pure vector search misses exact keyword, code, and acronym matches — this lesson combines BM25 keyword search with vector similarity using reciprocal rank fusion to get the best of both.

---

## Table of Contents

1. [The Problem: Vector Search Misses the Obvious Exact Match](#1-the-problem-vector-search-misses-the-obvious-exact-match)
2. [The Analogy: A Librarian Who Searches Both the Subject Catalog and the Keyword Index](#2-the-analogy-a-librarian-who-searches-both-the-subject-catalog-and-the-keyword-index)
3. [Internal Flow: BM25 and Reciprocal Rank Fusion](#3-internal-flow-bm25-and-reciprocal-rank-fusion)
4. [Code Example: BM25 Search Alongside Vector Search, Combined with RRF](#4-code-example-bm25-search-alongside-vector-search-combined-with-rrf)
5. [Comparison: Pure Vector vs. Pure Keyword vs. Hybrid](#5-comparison-pure-vector-vs-pure-keyword-vs-hybrid)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Vector Search Misses the Obvious Exact Match

Every retrieval strategy so far in this course has relied purely on embedding similarity: convert the query to a vector, find the nearest chunk vectors, done. This works remarkably well for *meaning*-based queries — Phase 1's refund example, where "can I get my money back" correctly matches "refund policy" despite sharing almost no literal words. But it has a blind spot that's easy to miss until it bites you in production: pure vector search is often *worse* than plain keyword search at finding exact, literal matches.

Consider a user searching a support knowledge base for error code `ERR-4471`, or a product SKU like `SKU-88213-BLK`, or an acronym like `RBAC`. An embedding model represents these as points in a high-dimensional meaning-space based on the statistical patterns it learned during training — but it has no special mechanism for treating an exact alphanumeric string as uniquely important. Two chunks that both mention *some* error code may end up embedded close together even if only one of them mentions the *specific* code the user typed. A human doing this search would instinctively do an exact string match first; a pure vector retriever has no equivalent instinct.

---

## 2. The Analogy: A Librarian Who Searches Both the Subject Catalog and the Keyword Index

**Real-world analogy:** an old-fashioned library has two different catalogs for a reason. The **subject catalog** groups books by topic and theme — you look up "gardening" and find books about gardening even if the word "gardening" never appears in some of their titles. The **keyword/title index** is different: it's an exact-match lookup — you look up the precise title or author string and get precisely the matching entries, no interpretation involved.

A good librarian doesn't pick one catalog and ignore the other. If you ask for a specific ISBN or an exact title, they use the keyword index — that's what it's for. If you ask "books about growing tomatoes in cold climates," they lean on the subject catalog, because no keyword search will reliably surface a book on that topic that happens to be titled something unrelated. **Hybrid search is the RAG equivalent of a librarian who runs both searches and merges the results** — vector search playing the role of the subject catalog (meaning-based), and BM25 playing the role of the keyword index (exact term-based).

> 🧠 Reach for this analogy whenever someone asks "why not just use vectors for everything" — because some queries are exact-match queries in disguise, and no amount of semantic understanding substitutes for literally finding the string the user typed.

---

## 3. Internal Flow: BM25 and Reciprocal Rank Fusion

**BM25 in plain terms.** BM25 ("Best Match 25") is a classic **keyword/term-frequency ranking function** — it is *not* embedding-based and has nothing to do with vector similarity. Given a query and a document, BM25 scores the document higher when the query's terms appear frequently in that document, while correcting for two things: very common words across the whole corpus (like "the") get down-weighted (similar in spirit to the intuition behind TF-IDF, if you've encountered it elsewhere), and longer documents don't get an unfair advantage just from containing more words overall. The net effect: BM25 rewards documents that contain the query's literal terms, especially rare/distinctive ones, and it does this purely through counting words — no semantic understanding, no embeddings, no notion of "meaning" whatsoever.

This is precisely why BM25 complements vector search rather than competing with it: BM25 is strong exactly where vector search is weak (rare literal terms, codes, acronyms, exact phrases) and weak exactly where vector search is strong (queries phrased differently from the source text, synonyms, paraphrase).

**Combining two ranked lists: Reciprocal Rank Fusion (RRF).** Once you have two separate ranked lists for the same query — one from BM25, one from vector similarity — you need a principled way to merge them into a single ranking. RRF is a simple, robust method that doesn't require the two scores to be on comparable scales (BM25 scores and cosine similarities live in completely different numeric ranges, so averaging them directly wouldn't make sense). Instead, RRF only looks at each document's **rank position** in each list:

```
score(d) = sum over each ranking of  1 / (k + rank(d))
```

where `rank(d)` is the document's position in a given ranked list (1st, 2nd, 3rd, ...), and `k` is a small constant — **60 is the commonly used default** — that dampens the influence of very low ranks and keeps the formula numerically well-behaved. A document that ranks highly in *either* list contributes a large `1/(k + rank)` term; a document that ranks highly in *both* lists gets the sum of two large terms and rises to the top of the fused ranking. Documents are then sorted by this combined score, descending.

---

## 4. Code Example: BM25 Search Alongside Vector Search, Combined with RRF

```python
from rank_bm25 import BM25Okapi

corpus = [
    "Our refund policy allows returns within 30 days of purchase.",
    "Error code ERR-4471 indicates a failed payment authorization.",
    "To reset your password, go to Settings, then Security.",
    "International shipping takes 7-14 business days to arrive.",
]

# BM25Okapi expects a tokenized corpus: a list of documents, where each
# document is itself a list of tokens (here, just lowercase words split
# on whitespace -- a real system would use a proper tokenizer).
tokenized_corpus = [doc.lower().split() for doc in corpus]
bm25 = BM25Okapi(tokenized_corpus)

query = "what does error ERR-4471 mean"
tokenized_query = query.lower().split()

# get_scores returns a numpy array of scores, one per document in the
# corpus (in corpus order) -- higher score means more relevant. It does
# NOT return a pre-sorted ranking; we sort it ourselves below.
bm25_scores = bm25.get_scores(tokenized_query)

# Turn the raw scores into a rank list: doc index -> rank position (1-based).
bm25_ranked_indices = sorted(
    range(len(corpus)), key=lambda i: bm25_scores[i], reverse=True
)
bm25_ranks = {doc_idx: rank for rank, doc_idx in enumerate(bm25_ranked_indices, start=1)}

# --- Vector search side (conceptual stand-in for a real Chroma/Pinecone/
# pgvector query from Phases 5-7) -- assume this returns doc indices already
# ranked most-to-least similar by embedding distance.
vector_ranked_indices = [0, 2, 1, 3]  # e.g. from collection.query(...)
vector_ranks = {doc_idx: rank for rank, doc_idx in enumerate(vector_ranked_indices, start=1)}

# --- Reciprocal Rank Fusion ---
def rrf_score(doc_idx: int, rank_lists: list[dict], k: int = 60) -> float:
    total = 0.0
    for ranks in rank_lists:
        if doc_idx in ranks:
            total += 1.0 / (k + ranks[doc_idx])
    return total

all_doc_indices = range(len(corpus))
fused = sorted(
    all_doc_indices,
    key=lambda i: rrf_score(i, [bm25_ranks, vector_ranks]),
    reverse=True,
)

print("Fused ranking (best first):")
for idx in fused:
    print(f"  score={rrf_score(idx, [bm25_ranks, vector_ranks]):.4f}  '{corpus[idx]}'")
```

Notice what happens with the query about `ERR-4471`: BM25 ranks the error-code chunk highly because the literal term appears in both the query and the document — something a vector search might not reliably do if the embedding model doesn't treat that exact alphanumeric code as especially distinctive. RRF then lets that BM25 signal pull the chunk toward the top of the fused ranking even if the vector search ranked it lower, without ever needing to compare raw BM25 scores to raw cosine similarities directly.

---

## 5. Comparison: Pure Vector vs. Pure Keyword vs. Hybrid

| | Pure Vector Search | Pure Keyword (BM25) | Hybrid (Vector + BM25 via RRF) |
|---|---|---|---|
| **Strengths** | Understands meaning, synonyms, paraphrase; finds relevant text even with no shared words | Finds exact terms, codes, acronyms, rare identifiers reliably; cheap, no embedding model needed | Gets both: semantic matches and exact-term matches in one ranked list |
| **Weaknesses** | Can miss exact matches (codes, SKUs, acronyms) that share no strong embedding signal with the query | No understanding of meaning; misses paraphrased or synonym-based matches entirely | Slightly more infrastructure/complexity: two search paths instead of one |
| **When it wins** | Conceptual questions phrased differently from the source text ("can I get my money back" → "refund policy") | Exact-match queries: error codes, product IDs, specific technical terms, quoted phrases | Real-world query mixes, where some queries are conceptual and others are exact-match, and you don't know in advance which is which |

---

## 6. Common Mistakes

**Mistake 1: Assuming vector search alone is always better.** It's tempting, especially after seeing embeddings solve the "meaning gap" so well in earlier phases, to conclude that vector search strictly dominates keyword search. It doesn't — it specifically loses on exact-match queries (error codes, SKUs, acronyms, quoted phrases) where BM25's literal term matching is a better fit for what the user actually typed. A production RAG system serving real users will see both query types, and a pure-vector retriever silently underperforms on the exact-match half of that traffic.

**Mistake 2: Averaging raw BM25 and vector scores directly.** BM25 scores and cosine similarity scores live on completely different, uncalibrated numeric scales — a BM25 score of "8.3" and a cosine similarity of "0.83" are not comparable numbers, and naively adding or averaging them produces a meaningless combined score dominated by whichever scale happens to have larger numbers. This is exactly why RRF works off rank *position* rather than raw score magnitude — it sidesteps the scale-mismatch problem entirely.

**Interview angle:** if asked "when would you add BM25 to a RAG system that already has vector search," the strong answer names the specific gap — exact-match queries (codes, IDs, acronyms) that vector search handles unreliably — rather than a vague "to make retrieval better." Naming reciprocal rank fusion (and knowing it operates on ranks, not raw scores) as the combination mechanism is what separates a candidate who's implemented hybrid search from one who's only heard the term.

---

## 7. Hands-On Exercises

### Exercise 1 — Run BM25 alone and inspect the scores

Using the `rank_bm25` code above, try three different queries against the same corpus: one paraphrased/conceptual query, one exact-match query (like the error code), and one query using a synonym for a word in the corpus. Print the raw `get_scores()` array for each and note which query type BM25 handles well versus poorly.

### Exercise 2 — Break RRF with an extreme k

Re-run the RRF fusion code with `k=1` instead of `k=60`. Observe how much more the top-ranked position in each list now dominates the fused score, compared to `k=60`. Explain in your own words why a very small `k` makes RRF behave more like "trust only the #1 result from each list."

### Exercise 3 — Design a hybrid query for your own corpus

Take any small corpus you've indexed in a vector store from Phases 5-7, add one document containing a distinctive exact-match term (a code, an ID, an acronym), and confirm: does a pure vector query for that term reliably return the right document? Then implement the BM25 + RRF pipeline from this lesson and confirm it does.

---

## 8. Interview Q&A

### Q1. What is BM25, and is it based on embeddings?

**Answer:** BM25 ("Best Match 25") is a classic keyword/term-frequency ranking function — it is not embedding-based and has no notion of semantic meaning. It scores documents higher when they contain the query's literal terms frequently, while down-weighting overly common words and correcting for document length. It's purely a statistical word-counting method, which is exactly why it complements vector search rather than duplicating it.

---

### Q2. Why does hybrid search often outperform pure vector search in production?

**Answer:** Because real user queries are a mix of conceptual questions (where vector search's semantic understanding wins) and exact-match queries — error codes, product IDs, acronyms, specific technical terms — where BM25's literal term matching is more reliable. Vector search alone silently underperforms on that second category; hybrid search combines both signals so neither type of query is systematically disadvantaged.

---

### Q3. Explain reciprocal rank fusion and why it's used instead of just averaging scores.

**Answer:** RRF combines two or more ranked lists by summing `1 / (k + rank(d))` for each document across every ranking it appears in, typically with `k=60`. It's used instead of averaging raw scores because BM25 scores and vector similarity scores live on incompatible numeric scales — averaging them directly would be dominated by whichever scale has larger magnitudes. RRF sidesteps this entirely by working only with rank position, which is directly comparable across any two ranking methods.

---

### Q4. What does the constant k in the RRF formula actually do?

**Answer:** It dampens the influence of rank position, particularly for lower ranks, and keeps the score well-behaved (avoiding a division by a very small number for rank 1). A commonly used default is k=60. A very small k makes the formula much more sensitive to whether a document is ranked #1 versus #2 in a given list; a larger k flattens those differences out.

---

### Q5. Give a concrete example of a query where BM25 would outperform vector search.

**Answer:** A user searching for a specific error code like "ERR-4471" or a product SKU. BM25 will strongly favor any document containing that exact literal string. A vector search might rank a different, topically-similar chunk (one that discusses errors or payments generally, but doesn't contain that specific code) just as highly or higher, because the embedding model has no special mechanism for treating an exact alphanumeric match as decisive.

---

> 🧠 **Memory hook:** "Vectors understand what you mean; BM25 finds what you typed — hybrid search refuses to choose between them."
