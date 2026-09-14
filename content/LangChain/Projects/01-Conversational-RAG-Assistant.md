# Project 1: Enterprise Conversational RAG Assistant

## Goal

Build a production-grade conversational RAG assistant that ingests internal technical documentation (PDFs, Markdown, Web documentation), performs hybrid retrieval (Dense Vector + Sparse BM25) with Flashrank reranking, reformulates follow-up queries using conversation history, streams Server-Sent Events (SSE) to clients, and tracks distributed traces in LangSmith.

## What You'll Build

An enterprise documentation assistant API featuring:
1. Multi-format ingestion pipeline (PDF, Markdown, HTML) with metadata tagging.
2. Parent-Document / Small-to-Big chunking stored in Qdrant or FAISS.
3. Hybrid Ensemble Retriever (BM25 + Dense Embeddings) with RRF fusion.
4. History-aware query rephraser resolving multi-turn pronouns.
5. FastAPI streaming endpoint delivering real-time tokens with source document citations.
6. LangSmith tracing with automated evaluation metrics for answer faithfulness.

## Phases Required

- Phase 01: Modern LangChain Ecosystem & Core Types
- Phase 02: LangChain Expression Language (LCEL)
- Phase 03: Document Loaders, Text Splitters, and Embeddings
- Phase 04: Retrieval Strategies and Advanced RAG
- Phase 07: Memory and Conversational State
- Phase 08: Streaming, Async, and Callbacks
- Phase 09: Evaluation, Observability, and LangSmith

## Requirements

### Core Functionality
- **Document Pipeline**: Ingest PDF and Markdown documentation into semantic chunks with parent-child document mapping.
- **Hybrid Retrieval**: Combine `BM25Retriever` with dense vector similarity search using `EnsembleRetriever` with reciprocal rank fusion (RRF).
- **History-Aware Rewriter**: Implement `create_history_aware_retriever` to reformulate conversational follow-ups into standalone search queries.
- **Streaming API**: Expose an async FastAPI `/api/chat/stream` route yielding SSE token streams and citation payloads.
- **Session State**: Persist multi-turn conversation messages in Redis with configurable TTL expiration.

### Architecture Specifications
```text
[PDF / Markdown Docs] ──▶ [ParentDocumentRetriever] ──▶ [FAISS Vector Store]
                                                              │
                                                              ▼
[User Chat Stream] ──▶ [History Rephraser] ──▶ [Ensemble Retriever] ──▶ [Reranker]
                                                                          │
                                                                          ▼
[FastAPI SSE Stream] ◀── [Token-by-Token LLM Generation] ◀── [Stuff QA Chain]
```

## Suggested Approach

1. **Phase 1: Ingestion & Vectorization**
   - Use `PyPDFLoader` and `DirectoryLoader` to read technical documentation.
   - Use `RecursiveCharacterTextSplitter` with 500-token chunks and 100-token overlap.
   - Embed chunks using `OpenAIEmbeddings(model="text-embedding-3-small")` and persist to a vector store.

2. **Phase 2: Hybrid Retrieval & Reranking**
   - Initialize `BM25Retriever.from_documents(docs)`.
   - Combine dense and sparse retrievers using `EnsembleRetriever(retrievers=[dense, sparse], weights=[0.6, 0.4])`.
   - Add `ContextualCompressionRetriever` with `FlashrankRerank` to pick the top 4 most relevant chunks.

3. **Phase 3: Conversational Pipeline**
   - Construct a `ChatPromptTemplate` with a `MessagesPlaceholder` for chat history.
   - Wire `create_history_aware_retriever` and `create_stuff_documents_chain` into `create_retrieval_chain`.
   - Wrap the chain with `RunnableWithMessageHistory` connected to `RedisChatMessageHistory`.

4. **Phase 4: FastAPI Streaming & LangSmith Tracing**
   - Implement `chain.astream_events(..., version="v2")` inside an async FastAPI generator.
   - Yield formatted SSE events: `data: {"type": "token", "content": "..."}\n\n` and `data: {"type": "citation", "sources": [...]}\n\n`.
   - Configure `LANGCHAIN_TRACING_V2="true"` to trace end-to-end latency and retriever score distributions.

## Stretch Goals

- Implement semantic caching on the input rephraser to return instant responses for frequently asked questions.
- Add an automated LLM-as-a-judge evaluation suite in pytest that tests golden questions against Faithfulness and Relevancy criteria.
- Support multi-tenant document namespaces with partition filters.

## Evaluation Checklist

- [ ] Ingestion correctly extracts text and populates chunk metadata (`source`, `page`).
- [ ] Multi-turn follow-up queries ("How do I install it?") correctly rewrite the entity name before searching.
- [ ] Hybrid search returns higher recall on technical acronyms than dense search alone.
- [ ] FastAPI streaming endpoint starts yielding tokens with sub-500ms TTFT.
- [ ] Redis session history maintains conversational state across distinct HTTP requests.
- [ ] LangSmith dashboard records full hierarchical run trees with token counts and latency metrics.
