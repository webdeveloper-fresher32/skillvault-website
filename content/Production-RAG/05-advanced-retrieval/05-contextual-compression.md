> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 5.4: Query Rewriting, Expansion & HyDE](04-query-rewriting.md) | ➡️ [Module 6.1: Grounded Generation, Prompt Engineering & Citations](../06-generation-grounding-and-evaluation/01-grounded-generation-and-citations.md)

---

# Module 5 — Lesson 5: Contextual Compression

This is the final lesson in our Advanced Retrieval Strategies module. So far, your RAG pipeline can rewrite queries, retrieve candidates with hybrid search, and rerank them. Now we'll make the retrieved context **smaller and more relevant before sending it to the LLM**.

## 1. Why do we need contextual compression?

Imagine your retriever finds this chunk when the user asks:

> “How did we prevent duplicate Stripe webhook processing?”

**Retrieved chunk**
`180 words`

  Stripe is a payment processing platform that supports subscriptions, invoices, payments, and webhook events. Applications can receive webhook notifications for many types of events. Some events may be retried when delivery fails. In our subscription platform, we used the Stripe event ID as a deduplication key to prevent the same event from being processed repeatedly. The handler was designed to be idempotent. We chose this approach instead of adding a queue because it kept the implementation simpler, although it provided different delivery and retry guarantees than a dedicated queue-based architecture. PostgreSQL was used for storing subscription-related data. The application also integrated with other services for customer billing and account management.

Only a few sentences directly answer the question. The rest describes Stripe, subscriptions, PostgreSQL, and unrelated integrations.

Sending every word to the LLM can:
- Increase token usage and latency.
- Distract the model with irrelevant information.
- Make it harder to focus on the evidence that answers the question.
- Waste context-window space that could be used for other useful chunks.

**Contextual compression** filters or shortens retrieved content based on the current query, while preserving relevant evidence.

## 2. Two types of contextual compression

| Type | What it does | Main trade-off |
|---|---|---|
| Extractive compression | Keeps the most relevant original sentences | Preserves the source wording |
| Abstractive compression | Uses an LLM to summarize relevant information | More concise, but can introduce unsupported claims |

For a production RAG system where answers must be grounded in documents, **extractive compression is a good starting point**. You can preserve the exact source sentences and retain the original chunk ID for traceability.

The flow becomes:

```
[Stage 1: Hybrid Search]
(pgvector + Full-Text Search ──► Retrieve 20 candidate chunks)
       │
       ▼
[Stage 2: Cross-Encoder Reranking]
(Precision scoring ──► Keep top 5 to 10 chunks)
       │
       ▼
[Stage 3: Contextual Compression]
(Sentence-level semantic extraction ──► Retain only high-signal evidence)
       │
       ▼
[Stage 4: Grounded Answer Generation]
(Compact context window ──► Low latency LLM generation with page citations)
```

## 3. Implement extractive compression in Python

We'll start with a local implementation using the embedding model you already use in `app/embedding_service.py`. It scores individual sentences against the user's query and keeps the most relevant ones.

This is a practical baseline: it doesn't require an additional API key, and the selected sentences remain verbatim. However, semantic similarity is only a relevance signal; it doesn't guarantee that the selected sentences contain every fact needed to answer the question.

Create `app/contextual_compression.py`:

```python
import re

from app.embedding_service import embed_texts

def split_sentences(text: str) -> list[str]:
    """Simple sentence splitter for a first implementation."""
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text.strip())
        if sentence.strip()
    ]

def compress_chunk(
    query: str,
    content: str,
    max_sentences: int = 3,
    min_similarity: float = 0.25,
) -> dict:
    if not query.strip() or not content.strip():
        return {
            "compressed_text": "",
            "selected_sentences": [],
        }

    sentences = split_sentences(content)

    if not sentences:
        return {
            "compressed_text": "",
            "selected_sentences": [],
        }

    # Embed the query and each sentence using the same model.
    vectors = embed_texts([query] + sentences)
    query_vector = vectors[0]

    # Embeddings are normalized, so dot product is cosine similarity.
    scored_sentences = []

    for sentence, vector in zip(sentences, vectors[1:]):
        similarity = sum(
            q * s for q, s in zip(query_vector, vector)
        )

        scored_sentences.append({
            "text": sentence,
            "similarity": float(similarity),
            "original_position": len(scored_sentences),
        })

    relevant = [
        item for item in scored_sentences
        if item["similarity"] >= min_similarity
    ]

    # Select the strongest sentences, then restore original order.
    selected = sorted(
        relevant,
        key=lambda item: item["similarity"],
        reverse=True,
    )[:max_sentences]

    selected.sort(key=lambda item: item["original_position"])

    return {
        "compressed_text": " ".join(
            item["text"] for item in selected
        ),
        "selected_sentences": selected,
    }

if __name__ == "__main__":
    query = 
1. How did we prevent duplicate Stripe webhook processing?
    content = (
        
1. Stripe supports payments, subscriptions, and webhooks. 
        
1. Webhook events can be retried if delivery fails. 
        
1. We used the Stripe event ID as a deduplication key to 
        
1. prevent the same event from being processed repeatedly. 
        
1. The handler was designed to be idempotent. 
        
1. PostgreSQL stores subscription-related data.
    )

    result = compress_chunk(query, content)

    print("Original:\n", content)
    print("\nCompressed:\n", result["compressed_text"])

    for item in result["selected_sentences"]:
        print(
            f
1. {item['similarity']:.3f} | {item['text']}
        )
```

Run it from your project root with your virtual environment activated:

```bash
python -m app.contextual_compression
```

The example uses your existing embedding model, so you shouldn't need to install another library if the earlier embedding lessons are working.

**Tuning note:** `min_similarity=0.25` is just an initial experiment, not a universal threshold. Similarity scores depend on the model, language, and content. If nothing survives the filter, inspect the scores and adjust the threshold rather than silently assuming the chunk has no useful evidence.

## 4. Integrate compression after reranking

Now connect compression to your existing `hybrid_search()` and `rerank_chunks()` functions.

Create `app/compressed_retrieval.py`:

```python
from app.hybrid_search import hybrid_search
from app.reranker import rerank_chunks
from app.contextual_compression import compress_chunk

def retrieve_compressed_context(
    query: str,
    tenant_id: str | None = None,
    source: str | None = None,
    candidate_k: int = 20,
    top_k: int = 5,
    max_sentences: int = 3,
) -> list[dict]:
    # Stage 1: Retrieve candidates.
    candidates = hybrid_search(
        query=query,
        top_k=candidate_k,
        tenant_id=tenant_id,
        source=source,
    )

    # Stage 2: Rerank candidates.
    ranked = rerank_chunks(
        query=query,
        candidates=candidates,
        top_k=top_k,
    )

    # Stage 3: Compress each candidate while preserving its ID.
    compressed_results = []

    for chunk in ranked:
        result = compress_chunk(
            query=query,
            content=chunk["content"],
            max_sentences=max_sentences,
        )

        # Don't pass an empty compressed result downstream.
        if not result["compressed_text"]:
            continue

        compressed_results.append({
            **chunk,
            "original_content": chunk["content"],
            "content": result["compressed_text"],
            "selected_sentences": result["selected_sentences"],
        })

    return compressed_results

if __name__ == "__main__":
    query = 
1. How did we prevent duplicate Stripe webhook processing?
    results = retrieve_compressed_context(
        query=query,
        candidate_k=20,
        top_k=5,
    )

    for result in results:
        print(f"\nChunk ID: {result['id']}")
        print(f"Rerank score: {result['rerank_score']:.4f}")
        print(f"Compressed context: {result['content']}")
```

Run:

```bash
python -m app.compressed_retrieval
```

This gives you a complete retrieval pipeline:

**Hybrid search → Reranking → Contextual compression → Compressed context for the LLM.**

When you later generate the final answer, use the original chunk IDs and source metadata to create citations. Compression should not discard provenance.

## 5. Production lessons

- **Don't compress too aggressively.** A sentence that seems irrelevant on its own may contain a qualification needed to answer correctly.
- **Preserve source metadata.** Keep document IDs, page numbers, and other citation fields.
- **Measure the trade-off.** Compare token reduction against answer correctness, citation accuracy, and retrieval quality.
- **Handle tables and code separately.** The simple sentence splitter isn't suitable for every PDF, code sample, or structured table.
- **Watch performance.** Embedding every sentence creates extra work. For high-volume systems, batch requests and cache results where appropriate.

One subtle point: because this baseline selects sentences using embedding similarity, it is not the same as a dedicated LLM compression model. It is an intentionally simple, locally runnable first implementation.

## 6. Your mini-exercise

  Contextual compression checklist

1. Run the compression demo and inspect which sentences survive.
2. Try a different query and compare the selected sentences.
3. Compare the original and compressed text, checking that no critical qualification was lost.
- [ ] setChecks(old=>old.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

## What's next?

You've now covered all five lessons in **Module 5: Advanced Retrieval Strategies**:

1. Similarity vs. keyword search
2. Hybrid search with PostgreSQL and pgvector
3. Reranking
4. Query rewriting
5. Contextual compression

The next module should be **Module 6: Generation, Grounding, and Citations**—where we'll pass retrieved evidence into an LLM, instruct it to answer only from the available context, return source citations, and handle cases where the documents don't contain the answer.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 5.4: Query Rewriting, Expansion & HyDE](04-query-rewriting.md) | ➡️ [Next: Module 6.1: Grounded Generation, Prompt Engineering & Citations](../06-generation-grounding-and-evaluation/01-grounded-generation-and-citations.md)
