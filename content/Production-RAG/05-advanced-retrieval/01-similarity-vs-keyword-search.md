> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.7: Task 4 — Running a Retrieval Evaluation Script](../04-vector-databases-pgvector/07-task-4-retrieval-evaluation-script.md) | ➡️ [Module 5.2: Hybrid Search with PostgreSQL + pgvector (Reciprocal Rank Fusion)](02-hybrid-search-with-rrf.md)

---

Let's go! 🚀 We've reached **Module 5: Advanced Retrieval Strategies** in your Production RAG course.

You've built the foundation: document loading, chunking, embeddings, vector databases, metadata filtering, and basic retrieval. Now we'll improve how your system finds the *right* information in real-world queries.

# Module 5 — Advanced Retrieval Strategies

![Advanced Multi-Stage Retrieval Architecture](/images/production-rag/advanced-retrieval-pipeline.png)

### The 5 Pillars of Advanced Retrieval

| Step | Technique | Production Goal |
| :--- | :--- | :--- |
| **Lesson 1** | **Similarity Search vs. Keyword Search** | Understand why vector search misses exact terms like error codes, IDs, and SKUs |
| **Lesson 2** | **Hybrid Search & RRF** | Combine dense semantic search with sparse BM25 keyword matching via Reciprocal Rank Fusion |
| **Lesson 3** | **Cross-Encoder Reranking** | Retrieve top 50 candidates, then prune to the top 4 using full cross-attention scoring |
| **Lesson 4** | **Query Rewriting & HyDE** | Expand and disambiguate conversational user queries into targeted search inputs |
| **Lesson 5** | **Contextual Compression** | Filter extraneous sentences from retrieved chunks to minimize prompt token spend |

---

## Lesson 1: Similarity search vs. keyword search

Let's start with the problem that motivates advanced retrieval.

Imagine your billing document contains:

> “Stripe webhook event `invoice.payment_failed` is sent when an invoice payment fails.”

Now a user asks:

> “What does `invoice.payment_failed` mean?”

A vector search can find this because the query and document have related meanings. But consider a query like:

> “Find error code `ERR-4821`.”

If the document contains that exact code, keyword search may be more reliable than semantic search alone.

### 1. How the three approaches differ

### A. Keyword search

Looks for exact terms or matching words.

Good for error codes, IDs, names, and exact phrases.

---

### B. Vector search

Converts queries and chunks into embeddings and ranks them by vector similarity.

Good for paraphrases and conceptually similar language.

---

### C. Hybrid search

Combines keyword and vector retrieval.

Often a stronger starting point for production systems containing both natural-language questions and exact identifiers.

## 2. Try a small experiment in Python

This exercise demonstrates keyword matching versus semantic retrieval without changing your database.

Install the dependency if needed:

```bash
python -m pip install scikit-learn
```

Create `app/retrieval_comparison.py`:

```python

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

documents = [
    "Stripe webhook event invoice.payment_failed means an invoice payment failed.",
    "Use idempotency and event IDs to prevent duplicate webhook processing.",
    "The error code ERR-4821 indicates a failed payment authorization.",
    "Golden retriever puppies need consistent training and positive reinforcement.",
]

queries = [
    "What does invoice.payment_failed mean?",
    "Find error code ERR-4821.",
    "How do I prevent duplicate webhook events?",
]

# Build a simple keyword-based TF-IDF index.
vectorizer = TfidfVectorizer(
    lowercase=True,
    token_pattern=r"(?u)\b[\w.-]+\b",
)
document_vectors = vectorizer.fit_transform(documents)

def keyword_search(query, top_k=3):
    query_vector = vectorizer.transform([query])
    scores = cosine_similarity(query_vector, document_vectors)[0]

    ranked = sorted(
        enumerate(scores),
        key=lambda item: item[1],
        reverse=True,
    )
    return ranked[:top_k]

for query in queries:
    print("\nQuery:", query)

    for index, score in keyword_search(query):
        print(f"{score:.3f} | {documents[index]}")

```

Run it:

```bash
python -m app.retrieval_comparison
```

This uses TF-IDF as a simple keyword baseline. It is not a full production search engine, and its scores are not directly comparable with your embedding similarity scores.

### 3. Your key takeaway

A strong production RAG pipeline may look like this:

**User question**

**Parallel retrieval**

Vector search + keyword search

**Combine and rank results**

**Relevant context for the LLM**

We'll implement this pipeline with your existing PostgreSQL + pgvector project in the next lesson.

**Your task:** Run the script and inspect the results. Pay attention to how it handles `ERR-4821` compared with the natural-language question about duplicate webhooks. Once you've tried it, we can build **hybrid search using PostgreSQL full-text search + pgvector**.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.7: Task 4 — Running a Retrieval Evaluation Script](../04-vector-databases-pgvector/07-task-4-retrieval-evaluation-script.md) | ➡️ [Next: Module 5.2: Hybrid Search with PostgreSQL + pgvector (Reciprocal Rank Fusion)](02-hybrid-search-with-rrf.md)
