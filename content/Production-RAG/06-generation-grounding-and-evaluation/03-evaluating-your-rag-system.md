> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 6.2: Citation Validation & Hallucination Guardrails](02-citation-validation-and-hallucination-control.md) | ➡️ [Module 6.4: Production RAG Observability, Tracing & Structured Logging](04-monitoring-and-debugging.md)

---

# Module 6 — Lesson 3: Evaluating Your RAG System

So far, you've built the major stages of your Production RAG pipeline: document ingestion, chunking, embeddings, vector storage, hybrid search, reranking, query rewriting, contextual compression, generation, and citation validation.

Now comes a question every production engineer needs to answer:

**How do we know the RAG system is actually working well?**

A response that sounds convincing isn't necessarily correct. We need repeatable tests and measurable results.

## 1. What should we evaluate?

**Retrieval quality**
Did search find the right document chunks, and did it rank them near the top?
Metrics: Hit Rate@K, MRR, Recall@K

---

**Answer quality**
Is the answer supported by retrieved evidence and relevant to the question?
Metrics: faithfulness, answer relevance, correctness

---

**Operational performance**
How long does a request take, what does it cost, and how often does it fail?
Metrics: latency, token usage, cost, error rate

We will start with retrieval evaluation because it doesn't require an LLM judge or an additional API.

## 2. Understand the three retrieval metrics

Imagine the expected relevant chunk for a question is `chunk-B`, but retrieval returns:

1. `chunk-A` — unrelated
2. `chunk-C` — somewhat related
3. `chunk-B` — contains the answer

### Hit Rate@K

Did we retrieve at least one relevant chunk in the top K results?

\[
\operatorname{HitRate@K} =
\frac{\text{Queries with a relevant result in top K}}
{\text{Total queries}}
\]

If the correct chunk appears in the top 3, that query counts as a hit at K = 3.

### Mean Reciprocal Rank (MRR)

How high did we rank the *first* relevant result?

\[
\operatorname{RR} = \frac{1}{\text{rank of first relevant result}}
\]

If the first relevant chunk appears at rank 3, reciprocal rank is \(1/3 \approx 0.333\). MRR averages that value across all test queries, assigning zero to queries with no relevant result.

### Recall@K

How many of all known relevant chunks did we retrieve in the top K?

\[
\operatorname{Recall@K} =
\frac{\text{Relevant chunks retrieved in top K}}
{\text{Total known relevant chunks}}
\]

Unlike Hit Rate, Recall accounts for multiple relevant chunks per question.

## 3. Build a repeatable retrieval evaluation script

You previously worked on a retrieval evaluation exercise. We'll extend that idea into a reusable evaluation script that can compare retrieval strategies.

Create `app/evaluate_retrieval.py`:

```python
from collections.abc import Callable

# Replace these example IDs with real chunk IDs from your database.
# Include ALL known relevant chunk IDs for each question.
EVALUATION_DATASET = [
    {
        "query": 
1. How did we prevent duplicate Stripe webhook processing?
        "relevant_ids": {"replace_with_real_chunk_id_1"},
    },
    {
        "query": 
1. What does invoice.payment_failed mean?
        "relevant_ids": {"replace_with_real_chunk_id_2"},
    },
    {
        "query": 
1. How does our subscription billing flow work?
        "relevant_ids": {
            
1. replace_with_real_chunk_id_3
            
1. replace_with_real_chunk_id_4
        },
    },
]

def evaluate_retriever(
    search_fn: Callable,
    dataset: list[dict],
    k: int = 5,
) -> dict:
    if not dataset:
        raise ValueError("Evaluation dataset cannot be empty")

    if k < 1:
        raise ValueError("k must be at least 1")

    total_hits = 0
    reciprocal_ranks = []
    recall_scores = []

    for item in dataset:
        query = item["query"]
        relevant_ids = item["relevant_ids"]

        if not relevant_ids:
            raise ValueError(
                f
1. No relevant IDs defined for query: {query}
            )

        results = search_fn(query, k)
        retrieved_ids = [
            result["id"] for result in results
        ]

        # Hit Rate@K
        hit = any(
            chunk_id in relevant_ids
            for chunk_id in retrieved_ids
        )
        total_hits += int(hit)

        # Reciprocal rank of the first relevant result.
        reciprocal_rank = 0.0

        for rank, chunk_id in enumerate(
            retrieved_ids, start=1
        ):
            if chunk_id in relevant_ids:
                reciprocal_rank = 1.0 / rank
                break

        reciprocal_ranks.append(reciprocal_rank)

        # Recall@K
        retrieved_relevant = set(retrieved_ids) & relevant_ids
        recall = len(retrieved_relevant) / len(relevant_ids)
        recall_scores.append(recall)

        print(f"\nQuery: {query}")
        print(f"Relevant IDs: {sorted(relevant_ids)}")
        print(f"Retrieved IDs: {retrieved_ids}")
        print(f"Hit@{k}: {int(hit)}")
        print(f"RR: {reciprocal_rank:.3f}")
        print(f"Recall@{k}: {recall:.3f}")

    count = len(dataset)

    return {
        f"hit_rate@{k}": total_hits / count,
        f"mrr@{k}": sum(reciprocal_ranks) / count,
        f"recall@{k}": sum(recall_scores) / count,
        "queries_evaluated": count,
    }

if __name__ == "__main__":
    from app.hybrid_search import hybrid_search

    def search_fn(query: str, k: int) -> list[dict]:
        return hybrid_search(
            query=query,
            top_k=k,
        )

    metrics = evaluate_retriever(
        search_fn=search_fn,
        dataset=EVALUATION_DATASET,
        k=5,
    )

    print("\n=== Evaluation Summary ===")
    for name, value in metrics.items():
        if isinstance(value, float):
            print(f"{name}: {value:.3f}")
        else:
            print(f"{name}: {value}")
```

### Before running it

1. Replace every placeholder ID with a real chunk ID from your database.
2. Make sure each expected ID really contains information relevant to that query.
3. For questions with multiple relevant chunks, include all known relevant IDs.
4. Run it with your virtual environment activated:

```bash
python -m app.evaluate_retrieval
```

This evaluates your current hybrid search. To compare it with semantic-only retrieval, pass a different `search_fn` that calls your vector-search function instead. Keep the same dataset and K value for a fair comparison.

These metrics measure retrieval against your labeled examples—not overall answer correctness. The quality of your labels matters.

## 4. Evaluate generated answers too

Good retrieval does not guarantee good answers. The LLM might ignore the evidence, misunderstand it, or cite a source that doesn't support a claim.

For answer evaluation, build a small dataset with four fields:

| Field | Purpose |
|---|---|
| `question` | What the user asks |
| `expected_answer` | A reference answer reviewed by a human |
| `relevant_chunk_ids` | Evidence expected to support the answer |
| `must_abstain` | Whether the documents lack enough evidence to answer |

For example:

  **Question**

  How did we prevent duplicate Stripe webhook processing?

  **Expected answer**

  We used the Stripe event ID for deduplication and designed the handler to be idempotent.

  **Evidence required**

  The chunk describing event-ID deduplication and idempotent processing.

  **Must abstain?**

  No.

For a second test, ask for a specific reliability-improvement percentage that isn't in the documents. Set `must_abstain` to `True`. This checks whether your system admits the limits of its evidence instead of inventing metrics.

You can measure:

- **Answer correctness:** Does the answer match the verified facts?
- **Faithfulness:** Are its factual claims supported by the supplied context?
- **Answer relevance:** Does it answer the question asked?
- **Citation support:** Does each cited chunk support its associated claim?
- **Abstention quality:** Does the system avoid unsupported answers when evidence is insufficient?

Start by manually reviewing 20–50 representative question-answer pairs. Automated LLM judges can help scale this, but they should be checked against human judgments rather than treated as perfect ground truth.

## 5. Track latency and cost

A production RAG pipeline has several latency contributors:

["Query rewriting", "Optional LLM call"],
["Retrieval", "Database search"],
["Reranking", "Model scoring"],
["Compression", "Filtering or summarization"],
["Generation", "LLM response"]
  ] as stage}

{stage[0]}
{stage[1]}

Measure total request latency and, where possible, each stage separately. Track median and p95 latency, error rates, token usage, and estimated cost. A change that improves MRR but doubles latency may or may not be worthwhile for your application.

## 6. Your practical exercise

  RAG evaluation checklist

1. Create a test dataset with at least five questions and verified relevant chunk IDs.
2. Run the evaluation script and record Hit Rate@5, MRR@5, and Recall@5.
3. Run the same test dataset against semantic-only and hybrid retrieval.
4. Review at least three generated answers for factual correctness, citation support, and appropriate abstention.
- [ ] setDone(old=>old.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

Don't worry if the first scores are low. The baseline is useful because it tells you where to improve.

## 7. Key takeaways

- Use Hit Rate@K to check whether relevant evidence is retrieved.
- Use MRR to measure how highly the first relevant result is ranked.
- Use Recall@K when multiple chunks are relevant to a question.
- Evaluate answer correctness, faithfulness, citations, and abstention separately from retrieval.
- Measure latency and cost alongside quality.
- Keep a fixed evaluation dataset so you can compare changes fairly.

**Next lesson — Production RAG monitoring and debugging.** We'll learn how to trace a failed answer through the pipeline, identify whether the problem came from ingestion, retrieval, reranking, or generation, and build useful logs without exposing sensitive document content.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 6.2: Citation Validation & Hallucination Guardrails](02-citation-validation-and-hallucination-control.md) | ➡️ [Next: Module 6.4: Production RAG Observability, Tracing & Structured Logging](04-monitoring-and-debugging.md)
