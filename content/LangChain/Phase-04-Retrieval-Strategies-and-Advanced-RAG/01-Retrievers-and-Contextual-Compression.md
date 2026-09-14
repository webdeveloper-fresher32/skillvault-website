# Retrievers and Contextual Compression — Complete Guide

> "A legal researcher does not hand a judge five 800-page case law binders; they highlight and extract the exact three relevant paragraphs from each binder."

---

## Table of Contents

1. [The Problem: Retrieval Noise and Context Distraction](#1-the-problem-retrieval-noise-and-context-distraction)
2. [The Legal Researcher Analogy](#2-the-legal-researcher-analogy)
3. [The Mechanism: Retrievers, MMR, and Compression](#3-the-mechanism-retrievers-mmr-and-compression)
4. [Diagram: Contextual Compression Pipeline](#4-diagram-contextual-compression-pipeline)
5. [Code Walkthrough: Compression with Cohere Rerank](#5-code-walkthrough-compression-with-cohere-rerank)
6. [Comparing Retrieval Search Types](#6-comparing-retrieval-search-types)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Retrieval Noise and Context Distraction

Standard vector similarity search retrieves full document chunks based on average semantic distance.

### The Context Stuffing Dilemma

```text
User Query: "What is the maximum baggage weight for international flights?"
Standard Retrieval (Top 3 Chunks):
  Chunk 1 (1000 tokens): Baggage policies, pet travel rules, infant car seats... (Only 1 sentence relevant)
  Chunk 2 (1000 tokens): Domestic carry-on dimensions, musical instruments... (0 sentences relevant)
  Chunk 3 (1000 tokens): Checked baggage fees, overweight fines... (2 sentences relevant)
  
  → 3000 tokens sent to LLM; cost is 10x higher.
  → "Lost in the middle" effect causes the model to miss the critical sentence.
```

### The Solution: Contextual Compression

A compressor inspects retrieved documents with respect to the query and extracts only the relevant text fragments before passing them to the generator.

---

## 2. The Legal Researcher Analogy

When preparing a brief for a senior judge, a junior clerk does not dump entire filing cabinets on the bench.

### Unfiltered Binders vs Highlighted Extracts

```text
Unfiltered Dump  → 5 heavy books; the judge has to spend hours searching
                   through irrelevant statutes and dissents.

Highlighted Brief→ The clerk pulls the 5 books, extracts the 3 precise
                   sentences that decide the case, and presents a 1-page memo.
```

### Mapping to LangChain

The base `VectorStoreRetriever` finds the books; `ContextualCompressionRetriever` extracts the 3 sentences and discards the rest.

---

## 3. The Mechanism: Retrievers, MMR, and Compression

LangChain defines the `BaseRetriever` interface (`invoke(query)` returning `List[Document]`).

### Maximal Marginal Relevance (MMR) and Compression

```python
from langchain_core.vectorstores import VectorStoreRetriever
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_openai import ChatOpenAI

# 1. Maximal Marginal Relevance (MMR) balances relevance and diversity
mmr_retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 5, "fetch_k": 20, "lambda_mult": 0.7}
)

# 2. Contextual Compressor using LLM extraction
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
compressor = LLMChainExtractor.from_llm(llm)

compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=vectorstore.as_retriever(search_kwargs={"k": 8})
)
```

---

## 4. Diagram: Contextual Compression Pipeline

### Compression and Reranking Architecture

```text
User Query: "What is the baggage weight limit?"
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Base Retriever (Vector Store Lookups)                     │
│    Fetches Top-8 broad chunks (8 x 500 = 4000 tokens)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Contextual Compressor / Reranker                         │
│    - Evaluates each chunk against query intent              │
│    - Strips irrelevant paragraphs & extracts facts          │
│    - Reranks by cross-encoder relevance score               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (Compressed Context: 250 tokens)
┌─────────────────────────────────────────────────────────────┐
│ 3. Filtered High-Density Chunks                             │
│    "International economy checked baggage limit: 23kg."     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Generator LLM (Fast, accurate, hallucination-resistant)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Compression with Cohere Rerank

A production-grade pipeline combining base vector retrieval with a cross-encoder reranker:

```python
# compression_demo.py
import os
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

def build_compression_retriever():
    # 1. Corpus setup
    raw_texts = [
        "Economy passengers are allowed 1 checked bag up to 23kg (50 lbs).",
        "Business class passengers are allowed 2 bags up to 32kg each.",
        "Pets in cabin must remain in carrier under the seat in front of you.",
        "Flight cancellations due to weather will be rebooked free of charge.",
        "Excess baggage fees start at $75 for bags between 23kg and 32kg."
    ]
    docs = [Document(page_content=t, metadata={"id": i}) for i, t in enumerate(raw_texts)]

    # 2. Base Vector Store
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = FAISS.from_documents(docs, embeddings)
    base_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    # 3. Cross-Encoder Reranker
    compressor = CohereRerank(model="rerank-english-v3.0", top_n=2)

    # 4. Assembled compression retriever
    return ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=base_retriever
    )

if __name__ == "__main__":
    retriever = build_compression_retriever()
    results = retriever.invoke("How heavy can my economy bag be?")
    for doc in results:
        print(f"Content: {doc.page_content} | Score: {doc.metadata.get('relevance_score')}")
```

---

## 6. Comparing Retrieval Search Types

| Search Strategy | Mechanism | Diversity | Latency | Primary Strength |
|---|---|---|---|---|
| Standard Similarity (`similarity`) | Raw cosine distance | Low (returns duplicate chunks) | Lowest (<10ms) | Fast lookups on clean data |
| Maximal Marginal Relevance (`mmr`) | Balances relevance vs novelty | High (penalizes redundant chunks) | Low (<20ms) | Multi-faceted research queries |
| Similarity with Threshold | Discards matches below minimum score | Variable | Low (<15ms) | Preventing hallucination on unknown queries |
| Contextual Compression | LLM / Cross-Encoder post-filtering | High | Medium (50-200ms) | Eliminates context stuffing & token waste |

---

## 7. Common Mistakes

- **Using expensive frontier LLMs for `LLMChainExtractor`.** Running GPT-4o for document compression adds huge latency and cost; use lightweight rerankers (Cohere Rerank, BGE Reranker) or `gpt-4o-mini`.
- **Setting `fetch_k` equal to `k` in MMR.** In MMR, `fetch_k` must be significantly larger than `k` (e.g. `fetch_k=20, k=4`) to give the diversity algorithm a candidate pool to filter.
- **Dropping metadata in custom compressors.** Custom compressor functions must preserve the original document's metadata to ensure citations remain valid.
- **Ignoring empty retrieval results.** If a threshold or compressor filters out all documents, prompt templates must handle empty context gracefully without erroring.
- **Over-compressing numeric or tabular data.** Text-stripping extractors can accidentally delete table headers, making numbers meaningless.

---

## 8. Hands-On Exercises

**Exercise 1:** Convert a `Chroma` or `FAISS` vector store into a retriever using `.as_retriever(search_type="mmr", search_kwargs={"k": 3, "lambda_mult": 0.5})`.

**Exercise 2:** Create a synthetic vector store with 5 nearly identical documents and observe how MMR returns diverse documents compared to standard similarity search.

**Exercise 3:** Implement an `LLMChainFilter` compressor that drops irrelevant documents based on a binary yes/no classifier prompt.

**Exercise 4:** Measure the token reduction percentage achieved by passing a 1,000-word document chunk through `LLMChainExtractor`.

**Exercise 5:** Build an LCEL chain `retriever | prompt | model | parser` and invoke it with a query, inspecting the retrieved documents in the trace.

---

## 9. Interview Q&A

**Q: What problem does Maximal Marginal Relevance (MMR) solve in RAG retrieval?**
Standard similarity search often retrieves multiple chunks that say the exact same thing in slightly different words. MMR optimizes for both query relevance AND document diversity, selecting documents that are relevant while penalizing those that duplicate information already retrieved.

**Q: How does `lambda_mult` control the behavior of MMR?**
`lambda_mult` is a float between 0 and 1. A value of 1.0 corresponds to standard similarity search (pure relevance), while 0.0 maximizes diversity with zero weight on relevance. A balanced value of 0.5–0.7 is typically optimal.

**Q: What is the difference between a bi-encoder and a cross-encoder (reranker)?**
Bi-encoders (embedding models) embed queries and documents separately into vectors, allowing fast ANN lookups. Cross-encoders (rerankers) pass the query and candidate document together into attention layers, producing dramatically higher accuracy at higher compute cost.

**Q: Why does contextual compression reduce LLM hallucination?**
By stripping out irrelevant paragraphs and context noise, it places the exact factual answer directly in the prompt, preventing the generator model from getting confused by extraneous details ("lost in the middle").

**Q: How does `ContextualCompressionRetriever` fit into the LCEL pipeline?**
Because it implements the standard `BaseRetriever` interface, it is a full `Runnable`. It can be placed directly in an LCEL pipeline using `{"context": compression_retriever, "query": RunnablePassthrough()}`.
