# Ensemble and MultiQuery Retrieval — Complete Guide

> "A search and rescue team dispatches both canine scent trackers and aerial infrared drones, combining distinct sensory perspectives into a unified rescue map."

---

## Table of Contents

1. [The Problem: Single-Query and Single-Modality Blind Spots](#1-the-problem-single-query-and-single-modality-blind-spots)
2. [The Search and Rescue Analogy](#2-the-search-and-rescue-analogy)
3. [The Mechanism: MultiQuery and Ensemble Retrievers](#3-the-mechanism-multiquery-and-ensemble-retrievers)
4. [Diagram: Hybrid Ensemble Retrieval Architecture](#4-diagram-hybrid-ensemble-retrieval-architecture)
5. [Code Walkthrough: Hybrid BM25 and Vector Search with RRF](#5-code-walkthrough-hybrid-bm25-and-vector-search-with-rrf)
6. [Comparing Retrieval Paradigms](#6-comparing-retrieval-paradigms)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Single-Query and Single-Modality Blind Spots

Dense vector search struggles with exact keyword queries (like SKU numbers `SKU-8942A` or error codes `ERR_CONN_RESET`), while keyword search (BM25) fails on abstract conceptual questions.

### The Single-Method Failure

```text
Scenario A (Exact Identifier):
  Query: "Fix error code ERR_404_TIMEOUT"
  Dense Vector Search ──▶ Retrieves generic HTTP articles (0% exact error match).
  BM25 Keyword Search ──▶ Directly finds the specific troubleshooting guide.

Scenario B (Abstract Concept):
  Query: "How to prevent service crashes under high traffic?"
  BM25 Keyword Search ──▶ Fails if documents use terms "rate limiting" or "circuit breaking".
  Dense Vector Search ──▶ Easily maps meaning to rate limiting and load shedding.
```

### The Solution: Hybrid Ensemble Search

Combining dense vector embeddings with sparse BM25 keyword matching using Reciprocal Rank Fusion (RRF) delivers the strengths of both approaches.

---

## 2. The Search and Rescue Analogy

A mountain rescue team does not rely solely on satellite photos or solely on bloodhound dogs.

### Single Scout vs Multi-Modal Team

```text
Satellite Only  → Cannot see through dense tree canopy or underground caves.
Canine Only     → Cannot scan a 50-square-mile valley in 10 minutes.

Ensemble Team   → Drones scan the open ridge, dogs search the forest floor,
                  and a coordinator merges the sightings into a single map.
```

### Mapping to LangChain

`EnsembleRetriever` merges dense vector results (drones) and BM25 exact matches (dogs) into a unified, scored document list using RRF.

---

## 3. The Mechanism: MultiQuery and Ensemble Retrievers

LangChain provides `MultiQueryRetriever` (query expansion) and `EnsembleRetriever` (hybrid search).

### MultiQuery and Ensemble Primitives

```python
from langchain.retrievers import MultiQueryRetriever, EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_openai import ChatOpenAI

# 1. MultiQuery Retriever: Generates 3 query variations using an LLM
multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=vectorstore.as_retriever(),
    llm=ChatOpenAI(model="gpt-4o-mini", temperature=0)
)

# 2. Hybrid Ensemble Retriever (Dense + Sparse)
bm25_retriever = BM25Retriever.from_documents(docs)
bm25_retriever.k = 4

ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vectorstore.as_retriever(search_kwargs={"k": 4})],
    weights=[0.5, 0.5]
)
```

---

## 4. Diagram: Hybrid Ensemble Retrieval Architecture

### Reciprocal Rank Fusion Pipeline

```text
User Query: "Troubleshoot ERR_AUTH_99 on Linux"
                          │
         ┌────────────────┴────────────────┐
         ▼ (Sparse Keyword Path)           ▼ (Dense Semantic Path)
┌──────────────────────────────┐  ┌─────────────────────────────┐
│ 1. BM25 Keyword Retriever    │  │ 2. Dense Vector Retriever   │
│    Matches exact tokens:     │  │    Matches semantic meaning:│
│    "ERR_AUTH_99", "Linux"    │  │    "Authentication failure" │
└──────────────┬───────────────┘  └──────────────┬──────────────┘
               │                                 │
               ▼                                 ▼
       Ranked List A                     Ranked List B
    [Doc 1, Doc 4, Doc 7]             [Doc 4, Doc 2, Doc 1]
               │                                 │
               └────────────────┬────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Reciprocal Rank Fusion (RRF) Algorithm                   │
│    Score(d) = Σ [ Weight_i / (60 + Rank_i(d)) ]             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
        Unified Deduplicated & Reranked Top-K Documents
```

---

## 5. Code Walkthrough: Hybrid BM25 and Vector Search with RRF

A production-ready hybrid search pipeline combining BM25 and vector retrieval:

```python
# hybrid_retrieval_demo.py
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.retrievers import EnsembleRetriever

def build_hybrid_search_system():
    # 1. Knowledge corpus with mixed technical terms and concepts
    documents = [
        Document(page_content="PostgreSQL configuration parameter max_connections controls client limit.", metadata={"doc_id": 1}),
        Document(page_content="To resolve error PG_ERR_503, increase pool size in connection pooler.", metadata={"doc_id": 2}),
        Document(page_content="Database scalability requires horizontal read replicas and caching.", metadata={"doc_id": 3}),
        Document(page_content="Redis in-memory caching reduces database query latency dramatically.", metadata={"doc_id": 4})
    ]

    # 2. Sparse Retriever (BM25 for exact terms/codes)
    sparse_retriever = BM25Retriever.from_documents(documents)
    sparse_retriever.k = 2

    # 3. Dense Retriever (FAISS for conceptual intent)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    dense_store = FAISS.from_documents(documents, embeddings)
    dense_retriever = dense_store.as_retriever(search_kwargs={"k": 2})

    # 4. Hybrid Ensemble Retriever (RRF combination)
    hybrid_retriever = EnsembleRetriever(
        retrievers=[sparse_retriever, dense_retriever],
        weights=[0.6, 0.4]  # 60% weight to exact keyword matches, 40% to vectors
    )

    return hybrid_retriever

if __name__ == "__main__":
    retriever = build_hybrid_search_system()
    results = retriever.invoke("How do I fix PG_ERR_503?")
    for doc in results:
        print(f"Retrieved: {doc.page_content} (ID: {doc.metadata['doc_id']})")
```

---

## 6. Comparing Retrieval Paradigms

| Paradigm | Component | Strengths | Weaknesses | Best Use Case |
|---|---|---|---|---|
| Dense Semantic | `VectorStoreRetriever` | Conceptual mapping, synonyms, multilingual | Fails on exact codes, SKUs, names | Natural language questions |
| Sparse Keyword | `BM25Retriever` | Exact keyword matching, zero training | Fails on vocabulary mismatch | Product IDs, error logs |
| Multi-Query | `MultiQueryRetriever` | Broadens search perspectives | Additional LLM call latency | Complex, ambiguous prompts |
| Hybrid Ensemble | `EnsembleRetriever` | Combines exact token and semantic recall | Slight compute overhead | Production enterprise RAG |

---

## 7. Common Mistakes

- **Forgetting to set `k` on `BM25Retriever`.** `BM25Retriever` defaults to returning 4 documents; if not synced with vector store `k`, weighting becomes unbalanced.
- **Using uniform weights without testing.** For technical documentation with part numbers and error codes, weight BM25 higher (e.g. `[0.7, 0.3]`); for general FAQ conversational bots, weight dense search higher.
- **Ignoring document deduplication in custom ensembles.** `EnsembleRetriever` automatically deduplicates documents based on `page_content`; custom scripts often return duplicated results.
- **Not persisting BM25 index.** BM25 stores word frequency dictionaries in RAM; if your server restarts, recreate the BM25 index alongside your vector store.
- **High latency in MultiQueryRetriever.** Generating 3 alternative queries with GPT-4 adds 1000ms+ latency; use fast models like `gpt-4o-mini` or local SLMs for query expansion.

---

## 8. Hands-On Exercises

**Exercise 1:** Instantiate a `BM25Retriever` from a list of documents and retrieve matches for an exact acronym that vector embeddings miss.

**Exercise 2:** Construct an `EnsembleRetriever` combining `BM25Retriever` and `Chroma` with equal weights (`[0.5, 0.5]`).

**Exercise 3:** Configure a `MultiQueryRetriever` with a custom prompt template that instructs the LLM to generate 5 query perspectives in JSON format.

**Exercise 4:** Test hybrid retrieval against a pure vector retriever on a query containing both an error code and a conceptual question, comparing result rankings.

**Exercise 5:** Verify that `EnsembleRetriever` deduplicates identical document chunks returned by both sparse and dense retrievers.

---

## 9. Interview Q&A

**Q: How does Reciprocal Rank Fusion (RRF) work in `EnsembleRetriever`?**
RRF computes a score for each document across multiple search lists using the formula $\text{RRF}(d) = \sum \frac{w_i}{k + \text{rank}_i(d)}$, where $k$ is a constant (typically 60) and $\text{rank}_i(d)$ is the document's position in retriever $i$. Higher combined scores rank first.

**Q: Why is hybrid search (dense + sparse) considered the industry gold standard for production RAG?**
Because real user queries are heterogeneous. Some queries are conceptual ("how to improve latency"), which dense vectors excel at; others contain exact alphanumeric tokens ("CVE-2024-3094"), which sparse BM25 excels at. Hybrid search guarantees high recall for both.

**Q: What does `MultiQueryRetriever` do behind the scenes?**
It takes a user's original query, uses an LLM to generate multiple distinct phrasings/perspectives of that query, runs vector retrieval for each generated query, and returns the union of all retrieved documents deduplicated.

**Q: Does `BM25Retriever` require an embedding model or vector database?**
No. BM25 is an algorithmic statistical method based on Term Frequency-Inverse Document Frequency (TF-IDF). It runs entirely in memory and requires zero API calls or neural embedding weights.

**Q: How does `EnsembleRetriever` handle disparate score scales between vector cosine distance and BM25 scores?**
By using rank-based fusion (RRF) rather than raw score addition. RRF uses the ordinal position (rank 1, rank 2, rank 3) of a document rather than raw floating-point scores, making it immune to differing score scales.
