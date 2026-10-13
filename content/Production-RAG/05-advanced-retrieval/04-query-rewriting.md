> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 5.3: Cross-Encoder Reranking in Production RAG](03-reranking-with-cross-encoders.md) | ➡️ [Module 5.5: Contextual Compression & Prompt Cost Optimization](05-contextual-compression.md)

---

# Module 5 — Lesson 4: Query Rewriting

So far, we've improved retrieval with **hybrid search** and improved result ordering with **reranking**. Now let's solve another common production RAG problem: users don't always ask questions in the same language or wording as the documents.

## 1. Why do we need query rewriting?

Imagine your knowledge base contains this chunk:

> “Stripe webhook events are deduplicated using the event ID to prevent repeated processing. The handler must be idempotent.”

But the user asks:

> “How did we stop that thing from running twice?”

A keyword search may struggle because the query doesn't contain *Stripe*, *webhook*, *event ID*, or *idempotent*.

Query rewriting transforms the user's original question into a clearer search query while preserving the intent.

```
[Original Ambiguous Question]
("How did we stop that thing from running twice?")
       │
       ▼
[Query Rewriter & Contextual Resolver]
(Conversation history context + LLM prompt / Domain Synonym Dictionary)
       │
       ▼
[Self-Contained Search Query]
("How does Stripe webhook event ID deduplication prevent duplicate processing?")
       │
       ▼
[Production Retrieval & Generation]
(Hybrid Search ──► Cross-Encoder Reranking ──► Grounded LLM Response)
```

Query rewriting is especially useful for:
- Short or vague questions.
- Follow-up questions such as “What about its limitations?”
- Queries with misspellings or alternative terminology.
- Questions that need to be reformulated for keyword and semantic retrieval.

One important distinction: **rewriting improves the search query; it should not invent facts or change what the user is asking.**

## 2. Two approaches to query rewriting

| Approach | Example | Best for |
|---|---|---|
| Rule-based rewriting | Expand known abbreviations or correct common aliases | Predictable, low-cost transformations |
| LLM-based rewriting | Convert a vague follow-up into a standalone search query | Conversational questions that need context |

Let's implement both. We'll start with a simple version that runs without an API key.

## 3. Build a rule-based query rewriter

Create `app/query_rewriter.py`.

```python
import re

REPLACEMENTS = [
    (r"\bstripe webhooks?\b", "Stripe webhook events"),
    (r"\bduplicate events?\b", "duplicate webhook processing"),
    (r"\brun(?:ning)? twice\b", "duplicate processing"),
    (r"\bstop(?:ped)? it from happening again\b",
     "prevent repeated processing"),
]

def rewrite_query(query: str) -> str:
    rewritten = query.strip()

    for pattern, replacement in REPLACEMENTS:
        rewritten = re.sub(
            pattern,
            replacement,
            rewritten,
            flags=re.IGNORECASE,
        )

    return rewritten

if __name__ == "__main__":
    queries = [
        "How did we stop that thing from running twice?",
        "How do Stripe webhooks work?",
        "How do we prevent duplicate events?",
    ]

    for query in queries:
        print(f"\nOriginal:  {query}")
        print(f"Rewritten: {rewrite_query(query)}")
```

Run it:

```bash
python -m app.query_rewriter
```

This demonstrates the concept, but notice the limitation: rules cannot reliably understand what “that thing” refers to without conversation context. They can also produce awkward wording if replacements overlap.

In production, don't keep adding dozens of brittle rules to solve every possible phrasing.

## 4. Use an LLM to rewrite conversational queries

An LLM can transform a question into a standalone retrieval query. For follow-up questions, pass only the relevant conversation history needed to resolve references.

For example:

- Previous question: “How did we handle duplicate Stripe webhook events?”
- Follow-up: “What were the trade-offs?”
- Rewritten query: “What were the trade-offs of using Stripe event IDs for webhook deduplication instead of a queue?”

The rewritten query uses the previous turn to resolve the meaning of “the trade-offs.”

### Create `app/llm_query_rewriter.py`

This example uses the OpenAI Python SDK. If you don't already have it installed, run `python -m pip install openai python-dotenv` and configure `OPENAI_API_KEY` in your local `.env` file. Never commit that key.

```python
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

def rewrite_query(
    question: str,
    conversation_history: str = "",
) -> str:
    if not question.strip():
        raise ValueError("Question cannot be empty")

    prompt = f"""
You are a query-rewriting component for a production RAG system.

Rewrite the user's latest question into ONE standalone search query.

Rules:
- Preserve the user's intent.
- Use conversation history only to resolve references
  such as "it", "that", or "what about the trade-offs".
- Do not answer the question.
- Do not invent facts, identifiers, or technical details.
- Keep important names, error codes, and exact identifiers.
- If the question is already clear, preserve its meaning
  with minimal changes.
- Return only the rewritten query.

Conversation history:
{conversation_history or "(none)"}

Latest user question:
{question}
"""

    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=prompt,
    )

    rewritten = response.output_text.strip()

    if not rewritten:
        return question.strip()

    return rewritten

if __name__ == "__main__":
    history = (
        "User: How did we prevent duplicate Stripe webhook events?\n"
        "Assistant: We used the Stripe event ID for deduplication "
        "and made the webhook handler idempotent."
    )

    question = "What were the trade-offs?"

    rewritten = rewrite_query(
        question=question,
        conversation_history=history,
    )

    print("Original:", question)
    print("Rewritten:", rewritten)
```

Run it with your environment activated:

```bash
python -m pip install openai python-dotenv
python -m app.llm_query_rewriter
```

Set `OPENAI_API_KEY` in `.env`. If your account or SDK configuration uses a different available model, set `OPENAI_MODEL` accordingly.

**Production safeguard:** the LLM's rewritten query is untrusted output. Validate its length, handle API timeouts and errors, and fall back to the original question if rewriting fails. Never let a rewrite change tenant filters or access-control rules.

## 5. Integrate rewriting into your RAG pipeline

Now let's connect the rewriter to the hybrid search and reranker you built earlier.

Create `app/advanced_retrieval.py`:

```python
from app.hybrid_search import hybrid_search
from app.reranker import rerank_chunks
from app.llm_query_rewriter import rewrite_query

def advanced_retrieve(
    question: str,
    conversation_history: str = "",
    tenant_id: str | None = None,
    source: str | None = None,
    candidate_k: int = 20,
    top_k: int = 5,
) -> list[dict]:

    # Stage 1: Rewrite the question for retrieval.
    search_query = rewrite_query(
        question=question,
        conversation_history=conversation_history,
    )

    print("Original query:", question)
    print("Search query:", search_query)

    # Stage 2: Retrieve candidates using hybrid search.
    candidates = hybrid_search(
        query=search_query,
        top_k=candidate_k,
        tenant_id=tenant_id,
        source=source,
    )

    # Stage 3: Rerank candidates against the rewritten query.
    return rerank_chunks(
        query=search_query,
        candidates=candidates,
        top_k=top_k,
    )

if __name__ == "__main__":
    results = advanced_retrieve(
        question="What were the trade-offs?",
        conversation_history=(
            "User: How did we prevent duplicate Stripe webhook events?\n"
            "Assistant: We used the Stripe event ID for deduplication "
            "and made the handler idempotent."
        ),
        candidate_k=20,
        top_k=5,
    )

    for result in results:
        print("\n", result["id"])
        print(result["content"])
        print("Rerank score:", result["rerank_score"])
```

Run:

```bash
python -m app.advanced_retrieval
```

This combines three techniques:

1. **Query rewriting** improves the search wording.
2. **Hybrid search** retrieves candidates through semantic and keyword matching.
3. **Reranking** orders candidates by relevance.

A further improvement is to rerank against the *original question* as well as the rewritten query when rewriting risks losing important nuance. Evaluate both approaches on real queries.

## 6. Production concepts to remember

- **Query rewriting is not query expansion.** Rewriting creates a better standalone query; expansion may generate several alternative queries and merge their results.
- **Conversation history matters.** Without it, a question like “What about the trade-offs?” may be impossible to interpret correctly.
- **Rewriting adds latency and cost.** Use it when the query is ambiguous or follow-up context is needed; simple factual queries may not need it.
- **Measure retrieval quality.** Compare Hit Rate@K and MRR before and after rewriting. A fluent rewrite is not automatically a better search query.

## 7. Quick knowledge check

  Query rewriting quiz
  1. What is the main purpose of query rewriting?
  setAnswers(old=>old.map((x,i)=>i===0?v:x))} direction="col">
- [ ] Generate the final answer
- [ ] Make the search query clearer while preserving intent
- [ ] Replace the vector database

---

  2. A user asks “What about its limitations?” What additional input may the rewriter need?
  setAnswers(old=>old.map((x,i)=>i===1?v:x))} direction="col">
- [ ] Relevant conversation history
- [ ] A new embedding model every time
- [ ] The entire database password

---

  3. What should happen if the query-rewriting API fails?
  setAnswers(old=>old.map((x,i)=>i===2?v:x))} direction="col">
- [ ] Stop all retrieval permanently
- [ ] Use the original query as a fallback
- [ ] Return the API error as the RAG answer

**Next lesson — Contextual compression.** We'll learn how to remove irrelevant portions of retrieved chunks, reduce the context sent to the LLM, and preserve the evidence needed for grounded answers.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 5.3: Cross-Encoder Reranking in Production RAG](03-reranking-with-cross-encoders.md) | ➡️ [Next: Module 5.5: Contextual Compression & Prompt Cost Optimization](05-contextual-compression.md)
