# Phase 4: Retrieval Strategies and Advanced RAG

## What You'll Learn

Move beyond basic vector lookups by mastering contextual compression, multi-query expansion, hybrid ensemble search (dense semantic + BM25 keyword), and building production conversational RAG chains with history-aware query rephrasing.

## Learning Objectives

- Implement `ContextualCompressionRetriever` with LLM extractors and rerankers (Cohere Rerank) to filter irrelevant tokens before LLM generation.
- Use `MultiQueryRetriever` and `EnsembleRetriever` (Reciprocal Rank Fusion) to eliminate search blind spots and handle ambiguous user phrasing.
- Build full end-to-end conversational RAG systems using `create_history_aware_retriever` and `create_retrieval_chain`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Retrievers-and-Contextual-Compression.md](01-Retrievers-and-Contextual-Compression.md) | VectorStoreRetriever, similarity vs MMR, ContextualCompressionRetriever, Cohere reranking | 1 day |
| [02-Ensemble-and-MultiQuery-Retrieval.md](02-Ensemble-and-MultiQuery-Retrieval.md) | MultiQueryRetriever, EnsembleRetriever, BM25 keyword search, Reciprocal Rank Fusion (RRF) | 1 day |
| [03-Conversational-RAG-Chains.md](03-Conversational-RAG-Chains.md) | History-aware query transformation, create_retrieval_chain, question-answering LCEL pipelines | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Tools, Function Calling, and Structured Outputs](../Phase-05-Tools-Function-Calling-and-Structured-Outputs/README.md)
