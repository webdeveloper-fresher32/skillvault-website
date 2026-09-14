# Project 4: Multi-Source RAG with LangChain

## Goal

Stop hand-wiring every component and use LangChain to ingest and query across multiple document types (PDF, HTML, Markdown) in one unified pipeline, with metadata-based filtering that lets you scope retrieval to a particular source type or document.

## What You'll Build

A LangChain-based RAG application that ingests documents from at least three different formats into a single vector store, tags every chunk with a `source_type` (and other identifying metadata), wraps the store as a LangChain retriever, and composes a full ingestion-to-generation chain using LCEL.

## Phases Required

- Phase 3 — Document Loading & Preprocessing
- Phase 8 — Retrieval Strategies
- Phase 10 — RAG Orchestration with LangChain

## Requirements

- Ingest documents from at least three distinct source types: a PDF, an HTML page (or saved HTML file), and a Markdown/plain text file.
- Use LangChain's `Document` abstraction consistently across all three loaders, with metadata including at minimum `source_type` and `source_name`.
- Store all chunks from all sources in a single LangChain-wrapped vector store (Chroma or Pinecone, your choice — reuse either from earlier projects).
- Build a LangChain retriever with a configured search type and `k`, and compose it with a `PromptTemplate` and an LLM into one chain using the LCEL `|` operator.
- Support filtering retrieval to a single `source_type` (e.g. "only search PDFs") or a single `source_name` at query time.
- Apply at least one retrieval-strategy improvement from Phase 8 (e.g. MMR for diversity, or a tuned `k`) within the LangChain retriever configuration, and justify the choice.

## Suggested Approach

1. Pick one PDF, one HTML page, and one Markdown/text document covering related-enough content that cross-source questions make sense.
2. Load each with the appropriate LangChain-compatible loader (or wrap your own Phase 3 loaders' output as LangChain `Document` objects), tagging each with `source_type` and `source_name` in `metadata`.
3. Chunk all documents with a single consistent LangChain splitter so chunk boundaries are handled uniformly regardless of source.
4. Embed and add every chunk (regardless of source type) into one LangChain-wrapped vector store.
5. Build a retriever from that vector store, configuring `search_type` (e.g. `"mmr"`) and `k`, and note why you chose that configuration over plain similarity search.
6. Compose the retriever, a `PromptTemplate`, and your LLM into a single LCEL chain (`retriever | prompt | llm`, adapted to however you structure the pipe).
7. Add a wrapper that accepts an optional `source_type` or `source_name` filter and passes it to the retriever's search kwargs, so a query can be scoped to just the PDF, just the HTML page, or run across everything.
8. Test with at least one question that only the PDF can answer, one that only the HTML source can answer, and one deliberately cross-source question.

## Stretch Goals

- Add a fourth source type (e.g. a CSV or a Word document) and confirm the pipeline handles it without structural changes.
- Log, for each query, which source types contributed to the final retrieved set — a lightweight preview of the tracing you'll build in Project 5.
- Swap the vector store backend (e.g. from Chroma to Pinecone) without changing any of the chain composition code, to confirm the abstraction is actually doing its job.

## Evaluation Checklist

- [ ] All three source types load successfully into a consistent `Document` representation with correct metadata.
- [ ] A single vector store contains chunks from all three sources.
- [ ] The LCEL chain runs end-to-end from a raw question string to a generated answer.
- [ ] Filtering by `source_type` returns only chunks from that source type.
- [ ] A cross-source question produces an answer that correctly draws on more than one source.
- [ ] You can explain why you chose your retriever's search type/config (e.g. MMR vs. plain similarity) for this dataset.
