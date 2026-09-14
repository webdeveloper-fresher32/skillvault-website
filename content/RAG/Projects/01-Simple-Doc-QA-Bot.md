# Project 1: Simple Doc-QA Bot

## Goal

Build the smallest possible end-to-end RAG pipeline: load a handful of your own text/markdown files, chunk them, embed them, store them in a local vector database, and answer questions about their content with a single retrieve-then-generate call.

## What You'll Build

A command-line (or simple script-based) question-answering bot that ingests a small folder of `.txt`/`.md` files once, stores their embeddings in Chroma, and then lets you ask free-form questions in a loop — each answer grounded in the retrieved chunks, with the source file cited.

## Phases Required

- Phase 1 — RAG Fundamentals
- Phase 2 — LLM & Embedding Basics
- Phase 3 — Document Loading & Preprocessing
- Phase 4 — Chunking Strategies
- Phase 5 — Vector Databases I (Chroma)

## Requirements

- Load at least 5-10 plain text or Markdown files from a local folder into a common in-memory representation.
- Attach basic metadata to each loaded document: at minimum the source filename.
- Chunk every document using fixed-size chunking with overlap (hand-rolled, not a library's recursive splitter — save that for Project 2).
- Embed every chunk using an embedding API and store the chunks, their embeddings, and their metadata in a persistent Chroma collection.
- Given a user question, embed the question, retrieve the top-k most similar chunks from Chroma, and pass them plus the question to an LLM in a single retrieve-then-generate call.
- The final answer must cite which source file(s) the answer came from.
- The bot should run in a loop, so multiple questions can be asked against the same indexed collection without re-ingesting documents each time.

## Suggested Approach

1. Pick or write 5-10 short `.txt`/`.md` files on a topic you know well (this makes it easy to judge whether answers are actually correct).
2. Write a loader that reads each file, strips obviously irrelevant whitespace, and records `{text, source: filename}` for each document.
3. Implement fixed-size chunking with overlap by hand (e.g. 500 characters per chunk, 50 character overlap) and apply it to every loaded document, carrying the source metadata onto every chunk.
4. Set up a persistent Chroma client and a collection. Embed every chunk (batch the embedding calls if your API supports it) and add each chunk's text, embedding, and metadata to the collection with a unique id.
5. Write a `answer(question)` function: embed the question, query Chroma for the top-k (start with k=3-4) most similar chunks, build a prompt that includes the retrieved chunk text plus the question, and call the LLM.
6. Format the final answer to include a "Sources:" line listing the distinct filenames the retrieved chunks came from.
7. Wrap `answer()` in a simple REPL loop so you can ask several questions against the same persisted collection without re-running ingestion.

## Stretch Goals

- Add a "Sources not found in context" fallback: if none of the top-k chunks pass a similarity threshold, have the bot say it doesn't know rather than guessing.
- Print the retrieved chunk text (not just the final answer) as a debug mode, so you can see exactly what the LLM was grounded on.
- Experiment with chunk size and overlap and note how the retrieved chunks (and answer quality) change for the same question.

## Evaluation Checklist

- [ ] Ingestion runs once and Chroma persists across separate script runs (you don't need to re-embed to ask a new question).
- [ ] Asking a question whose answer is clearly contained in one of your files returns a correct, grounded answer.
- [ ] The answer names the correct source file(s).
- [ ] Asking a question with no relevant content in your files produces an honest "I don't know" rather than a hallucinated answer.
- [ ] You can explain, from memory, each of the four RAG stages (index, retrieve, augment, generate) as it maps onto your own code.
