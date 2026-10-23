# Phase 12: Agentic RAG

## Overview

Every phase up to this point has assumed a fixed pipeline: a question comes in, the system always retrieves, and the retrieved chunks always get stuffed into one prompt for one generation call. That assumption breaks down constantly in the real world. Some questions don't need retrieval at all ("what's 2+2"). Some need a different tool entirely (a calculator, a web search, a live database query). Some mix a semantic question with a structured filter in the same sentence ("pricing articles from last month"). And some genuinely can't be answered by a single retrieval pass at all — they require finding one piece of evidence, then using it to decide what to look for next.

Agentic RAG is the shift from "always retrieve the same way" to "let an LLM decide whether, what, and how many times to retrieve." This phase covers the three concrete patterns that make that shift real: giving an LLM tools and letting it choose among them, having an LLM parse a natural-language query into a structured search, and running an iterative retrieve-reason-retrieve loop for multi-hop questions. These patterns turn the RAG pipeline from a fixed assembly line into something closer to a small reasoning agent that happens to have retrieval as one of its capabilities.

## Learning Objectives

By the end of Phase 12, you will be able to:

- Explain why a plain RAG pipeline that always retrieves is insufficient, and describe the agent loop that fixes it (decide → act → observe → decide again)
- Define a retrieval tool for an LLM using the real Anthropic tool-use API shape and trace a full tool-use round trip, including when the model chooses *not* to call the tool
- Build a self-querying retriever that splits a natural-language question into a semantic search string and a structured metadata filter, and apply that filter safely
- Implement a multi-step iterative retrieval loop with a sound termination condition (both a max-iteration cap and a model-decided "I have enough" exit)
- Identify and avoid the most common agentic RAG failure modes: tool overload, unbounded loops, and blindly trusting model-generated filters

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Tool-Using-Retrieval-Agents.md | Giving an LLM a retriever (and other tools) and letting it decide when to call them | 2-3 hours |
| 02-Self-Querying-Retrievers.md | Parsing natural language into a semantic query + structured metadata filter | 2-3 hours |
| 03-Multi-Step-and-Iterative-Retrieval.md | Multi-hop questions: retrieve, reason, retrieve again, with sound termination | 2-3 hours |

**Total: 6-9 hours of focused study**
