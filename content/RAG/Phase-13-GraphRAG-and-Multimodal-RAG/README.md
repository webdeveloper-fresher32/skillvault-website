# Phase 13: GraphRAG & Multimodal RAG

## Overview

Every phase so far has treated retrieval as "find the chunks whose text is most similar to the question." That covers most real-world RAG needs — but two blind spots remain. First, plain vector search struggles with questions that hinge on *relationships between things* rather than topical similarity ("who reports to the person who manages the Sydney office?"), because a relationship isn't a fact you can embed into one chunk. Second, plain text embeddings are blind to images, charts, and tables — and a lot of real knowledge lives in exactly those formats. This phase covers both extensions: GraphRAG, which layers a knowledge graph on top of (or instead of) vector search for relationship-heavy questions, and multimodal RAG, which brings images and tables into a system built around text embeddings. Both are targeted upgrades for specific failure modes, not replacements for everything you've already built — the phase spends real time on when each is worth the added complexity, and when it isn't.

## Learning Objectives

By the end of Phase 13, you will be able to:

- Explain why vector search alone struggles with relationship-style questions, and describe a knowledge graph as nodes (entities) and edges (relationships)
- Extract a simple knowledge graph from unstructured text using an LLM, and represent it in Python with `networkx`
- Implement graph traversal retrieval that walks outward from matched entities and combines that context with standard vector-retrieved chunks
- Judge, for a given question type, whether GraphRAG is likely to help or is unnecessary complexity on top of a plain vector-search system
- Describe the three introductory approaches to multimodal RAG — image captioning, multimodal embeddings, and structured table extraction — and their respective tradeoffs
- Build a working example that captions an image via a multimodal LLM call and stores that caption as retrievable text alongside a reference to the original image

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Knowledge-Graph-Basics-for-Retrieval.md | Entities, relationships, and extracting a knowledge graph from text with an LLM | 2-3 hours |
| 02-GraphRAG-Retrieval-Patterns.md | Graph traversal at query time, combined with vector retrieval | 2-3 hours |
| 03-Multimodal-RAG-Images-and-Tables.md | Captioning, multimodal embeddings, and structured tables for retrieval | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - Knowledge Graph Basics for Retrieval
`/Phase-13-GraphRAG-and-Multimodal-RAG/01-Knowledge-Graph-Basics-for-Retrieval.md`

Starts from the problem: vector search finds chunks that are semantically *similar* to a question, but it can't reason about how two facts are *connected*. Introduces the entity/relationship/entity triple as the atomic unit of a knowledge graph, and walks through prompting an LLM to extract triples from a short paragraph, parsing them as JSON, and loading them into a small `networkx` graph.

Key topics:
- Why "who reports to the person who manages the Sydney office?" defeats plain vector similarity
- The index-cards-vs-family-tree analogy
- Extracting `(entity, relation, entity)` triples from text via a structured LLM prompt
- Representing a knowledge graph with `networkx.DiGraph`

---

### 02 - GraphRAG Retrieval Patterns
`/Phase-13-GraphRAG-and-Multimodal-RAG/02-GraphRAG-Retrieval-Patterns.md`

Given a knowledge graph, how do you actually use it at query time? Covers matching a query to graph entities, walking 1-2 hops along relevant edges to gather connected context, and combining that graph-derived context with standard vector-retrieved chunks in the same prompt.

Key topics:
- The trail-of-connected-dots analogy vs. checking the single closest dot
- A small Python function that walks `networkx` edges outward from a matched entity
- Comparison table: pure vector RAG vs. GraphRAG, by question type
- Avoiding GraphRAG over-engineering for simple lookup questions

---

### 03 - Multimodal RAG: Images and Tables
`/Phase-13-GraphRAG-and-Multimodal-RAG/03-Multimodal-RAG-Images-and-Tables.md`

A lot of real knowledge lives in diagrams, screenshots, and spreadsheets, not plain text. Covers three introductory approaches — captioning images into searchable text, embedding images and text into a shared vector space, and treating extracted tables as structured markdown/JSON — with a worked example that captions an image via the Claude API's image content-block format and stores the caption as retrievable text.

Key topics:
- Why a text-only retriever is "blind" to a document full of charts and screenshots
- Image captioning vs. multimodal embeddings vs. structured table extraction
- Claude API image input: `content` blocks with `type: "image"` and `type: "text"` together
- Testing multimodal retrieval quality separately from text retrieval quality

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file — Lesson 01 and 02 build on each other (the graph you extract in 01 is the graph you traverse in 02).
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-explain, from memory, when you would reach for GraphRAG vs. plain vector search, and when you would reach for image captioning vs. multimodal embeddings.

## Prerequisites

Phases 1-9, especially Phase 2 (embeddings), Phase 5 (Chroma), and Phase 8 (retrieval strategies). Comfort with basic Python data structures (lists, dicts, tuples) is assumed; any less common construct is explained inline the first time it appears.

## What Comes Next

After completing Phase 13, proceed to:
- **Phase 14: Production Patterns & Scaling** — taking a RAG system from a working prototype to something that holds up under real production load and cost constraints

---

> "Vector search finds what's similar. A knowledge graph finds what's connected. Most systems only need the first — know how to tell which one you're facing." — Phase 13 in one sentence.
