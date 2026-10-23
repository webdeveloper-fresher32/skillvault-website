# RAG Cheatsheet

---

## Chunking Strategies Comparison

| Strategy | How it works | Best for | Watch out for |
|---|---|---|---|
| Fixed-size (with overlap) | Split every N characters/tokens, overlap ~10-20% between chunks | Quick prototypes, uniform text | Slices mid-sentence, loses meaning at boundaries |
| Recursive character splitting | Tries paragraph → sentence → word boundaries before a hard cut | General-purpose default (most document types) | Still structural, not meaning-aware |
| Semantic chunking | Embed sentences, split where similarity between adjacent sentences drops | Topic-shift-heavy prose, long-form articles | Extra embedding calls = latency + cost |
| Sentence-window | Index small precise chunks (1 sentence), retrieve a window of surrounding sentences at query time | Precision matching with full local context | Requires tracking sentence order/offsets |
| Parent-document retrieval | Embed small child chunks for matching, return the larger parent chunk/section for context | Balancing retrieval precision with LLM context needs | Extra indirection: child→parent id mapping to maintain |

Chunk-size decision guide: FAQ/short Q&A → small chunks (~200-400 chars), no parent needed. Technical manuals → recursive splitting + parent-document. Code → split on function/class boundaries, not char count.

---

## Similarity Metrics Cheat Sheet

| Metric | Formula (conceptual) | Range | Notes |
|---|---|---|---|
| Cosine similarity | `dot(A,B) / (\|A\| * \|B\|)` | -1 to 1 (1 = identical direction) | Measures direction only, ignores magnitude — most common for text embeddings |
| Dot product | `sum(A_i * B_i)` | Unbounded | Equivalent to cosine similarity when vectors are pre-normalized (unit length) |
| Euclidean (L2) distance | `sqrt(sum((A_i - B_i)^2))` | 0 to ∞ (0 = identical) | Sensitive to vector magnitude; smaller = more similar |

Rule of thumb: normalize embeddings once at index time, then dot product ≈ cosine similarity (cheaper to compute). Always use the **same embedding model** for indexing and querying — mismatched models produce vectors in different, incomparable spaces.

---

## Vector DB Comparison (Chroma vs Pinecone vs pgvector)

| | Chroma | Pinecone | pgvector |
|---|---|---|---|
| Deployment | Local / embedded (persistent client) | Fully managed cloud service | Extension inside your existing PostgreSQL |
| Setup cost | `pip install chromadb`, zero account | API key + index creation (serverless or pod-based) | `CREATE EXTENSION vector;` on a Postgres instance |
| Best for | Local dev, prototyping, small/single-node apps | Production scale, multi-tenant apps needing always-on managed infra | Teams already on Postgres wanting vectors next to relational data |
| Query API | `.query()` with embedding vector | `index.query()` with namespace + metadata filter | SQL `ORDER BY embedding <-> query_vec LIMIT k` |
| Scaling model | Bound by local disk/RAM | Serverless (auto) or pod-based (provisioned), scales independently | Scales with your Postgres instance; needs IVFFlat/HNSW index at scale |
| Multi-tenancy | Multiple collections | Namespaces within an index | Ordinary `WHERE` filters combined with vector `ORDER BY` |
| Distance operators | Cosine/L2/IP via collection config | Metric set at index creation (cosine, dotproduct, euclidean) | `<->` = L2, `<=>` = cosine distance, `<#>` = negative inner product |

---

## pgvector Operators Quick Reference

| Operator | Distance | Meaning |
|---|---|---|
| `<->` | L2 (Euclidean) | Straight-line distance between vectors; smaller = closer |
| `<=>` | Cosine distance | `1 - cosine_similarity`; smaller = more similar |
| `<#>` | Negative inner product | Negated dot product (Postgres operators must be ascending-sorts-best); smaller (more negative) = higher dot product |

Index types: **IVFFlat** (cluster-based, needs `lists` tuned to row count, faster to build) vs **HNSW** (graph-based, better recall/speed at query time, slower to build) — pick IVFFlat for simpler/smaller datasets, HNSW when query latency matters more than build time.

---

## Retrieval Strategies Quick Reference

| Strategy | What it fixes | Key idea |
|---|---|---|
| Top-k similarity search | Baseline retrieval | Tune `k`: too small misses context, too large adds noise + triggers "lost in the middle" (LLMs attend less to mid-prompt context) |
| Hybrid search (BM25 + vector) | Vector search misses exact keyword/code/SKU matches | Run BM25 (term-frequency) and vector search separately, merge ranked lists with **Reciprocal Rank Fusion (RRF)** |
| MMR (Maximal Marginal Relevance) | Top-k returning near-duplicate chunks | Balances relevance to query against diversity from already-selected chunks via a `lambda` parameter |
| Metadata filtering | Scoping results (user, date, tenant) | Decide filter-then-rank vs. rank-then-filter depending on filter selectivity |

**RRF formula:** `score(d) = Σ 1 / (k + rank(d))` across all ranked lists containing `d`, default `k = 60`.

**MMR formula:** `MMR = λ * sim(doc, query) − (1 − λ) * max_sim(doc, selected)` — `λ` near 1 favors relevance, `λ` near 0 favors diversity.

---

## Reranking / Query Transformation Techniques

| Technique | Stage | How it works | Cost tradeoff |
|---|---|---|---|
| Cross-encoder reranking | Post-retrieval, pre-generation | Jointly scores (query, doc) pairs for a small shortlist — more accurate than bi-encoder embeddings, but O(n) per pair so never run over the full corpus | Slow but accurate; run only on top ~20-50 candidates |
| HyDE (Hypothetical Document Embeddings) | Pre-retrieval, query side | LLM generates a hypothetical answer to the query; embed *that* instead of the raw query (closes the short-query-vs-long-document embedding gap) | Extra LLM call latency; risk of trusting hallucinated facts (only the embedding matters, not factual accuracy) |
| Query expansion / multi-query retrieval | Pre-retrieval, query side | LLM generates multiple reworded variants of the query, retrieves for each, merges results with RRF | Extra LLM + retrieval calls; over-generating variants adds latency for diminishing returns |

Bi-encoder (embeds query and doc separately, fast, used for initial recall) vs. cross-encoder (embeds query+doc jointly, slow, used for precision reranking of a shortlist).

---

## Common LangChain Snippets

**Retriever setup (wrapping a vector store):**
```python
retriever = vectorstore.as_retriever(
    search_type="mmr",                     # or "similarity"
    search_kwargs={"k": 5, "fetch_k": 20},  # k results, mmr considers fetch_k candidates
)
```

**LCEL chain skeleton (retrieve → prompt → generate):**
```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

prompt = ChatPromptTemplate.from_template(
    "Answer using only this context:\n{context}\n\nQuestion: {question}"
)

chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

chain.invoke("What does the config file control?")
```

Core abstractions: `Document`, `Embeddings`, `VectorStore`, `Retriever`, `PromptTemplate`, `Runnable` (composed with the `|` pipe operator, aka LCEL).

---

## Evaluation Metrics Glossary

| Metric | Question it answers | Low score means |
|---|---|---|
| Faithfulness | Is the generated answer grounded in the retrieved context (not hallucinated)? | The LLM is inventing facts not present in retrieved chunks |
| Answer relevance | Does the answer actually address the question asked? | Answer is grounded but off-topic or non-responsive |
| Context precision | Of the retrieved chunks, how many were actually relevant/useful? | Retriever is pulling in noise alongside good chunks |
| Context recall | Of all the relevant information available, how much did retrieval actually surface? | Retriever is missing relevant chunks entirely (too narrow k, wrong embedding, bad chunking) |

LLM-as-judge pattern: use an LLM call to output a grounded/ungrounded verdict comparing the generated answer against the retrieved context — a simplified faithfulness check. Always evaluate retrieval quality (precision/recall) separately from generation quality (faithfulness/relevance) — judging only the final answer can mask a retrieval problem as a prompting problem.

**Debugging checklist for bad retrievals:** embedding model consistency (index vs. query) → chunk size/strategy → metadata filtering correctness → query rewriting (HyDE/expansion) → `k` tuning. Change one variable at a time.

---

## Production Checklist

**Caching**
- Embedding cache — avoid re-embedding identical text
- Semantic cache — cosine-similarity match against recent queries to catch near-duplicates (watch staleness/invalidation risk)
- Response cache — TTL-based caching of full generated answers for repeated queries

**Security**
- Enforce per-user/per-tenant metadata filters **server-side** — never trust a client-supplied filter
- Redact PII before indexing, not after
- Audit-log what was retrieved and returned, per query

**Monitoring**
- Track per-stage latency (embed, retrieve, rerank, generate) not just end-to-end latency
- Watch for retrieval quality drift (context precision/recall trending down over time)
- Monitor cost per query and upstream LLM/API rate-limit or outage errors
- Watch for vector index drift as the underlying document set changes without reindexing
