# Modern LangChain & Full-Stack AI Engineering — Complete Mastery Course

A comprehensive, production-grade curriculum for building enterprise-grade generative AI applications, advanced Retrieval-Augmented Generation (RAG) systems, autonomous tool-calling agents, and real-time streaming services with modern LangChain (v0.2+ / v0.3+) and Python.

---

## Course Architecture & Mental Model

```text
                                 Modern LangChain Architecture
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                                    LangChain Core                                      │
  │   ┌─────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────┐   │
  │   │  Runnable Protocol  │──▶│ Prompts, Models, Parsers │──▶│ Base Tools & Schemas  │   │
  │   └──────────┬──────────┘   └────────────┬─────────────┘   └───────────┬───────────┘   │
  └──────────────┼───────────────────────────┼─────────────────────────────┼───────────────┘
                 │                           │                             │
                 ▼                           ▼                             ▼
  ┌─────────────────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
  │  Advanced RAG Pipelines │ │ Multi-Agent Reasoning Loops│ │ Real-Time Streaming & State│
  │  • Parent-Document RAG  │ │ • create_tool_calling_agent│ │ • astream_events(v2) & SSE │
  │  • Hybrid BM25 + Dense  │ │ • AgentExecutor Safety     │ │ • RedisChatMessageHistory  │
  │  • Contextual Reranking │ │ • Pydantic Structured Out  │ │ • Token Windowing & Summary│
  └──────────────┬──────────┘ └──────────────┬─────────────┘ └─────────────┬──────────────┘
                 │                           │                             │
                 └───────────────────────────┼─────────────────────────────┘
                                             │
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                        Production Deployment & Observability                           │
  │  • Zero-Code LangSmith Tracing & RAG Triad Evaluators • Redis Exact & Semantic Cache   │
  │  • Input/Output Security Guardrails & PII Scrubber   • FastAPI + Docker + Kubernetes   │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Learning Path

| Phase | Focus Topic | Key Concepts | Difficulty | Time |
|---|---|---|---|---|
| **[Phase 1](Phase-01-LangChain-Fundamentals-and-Architecture/README.md)** | Fundamentals & Architecture | Modern package split, ChatOpenAI, Prompts, Pydantic Parsers | Beginner | 3 days |
| **[Phase 2](Phase-02-LangChain-Expression-Language-LCEL/README.md)** | LangChain Expression Language | Runnable protocol, Parallelism, Fallbacks, Async Streaming | Intermediate | 3 days |
| **[Phase 3](Phase-03-Document-Loaders-Splitters-and-Embeddings/README.md)** | Document Loaders & Splitters | PDF/Web loaders, Semantic Chunking, Vector Stores (FAISS/Qdrant) | Intermediate | 3 days |
| **[Phase 4](Phase-04-Retrieval-Strategies-and-Advanced-RAG/README.md)** | Retrieval Strategies & RAG | MMR, Contextual Compression, Hybrid RRF, History-Aware RAG | Advanced | 3 days |
| **[Phase 5](Phase-05-Tools-Function-Calling-and-Structured-Outputs/README.md)** | Tools & Structured Outputs | `@tool` decorator, Pydantic schemas, `bind_tools`, `with_structured_output` | Intermediate | 3 days |
| **[Phase 6](Phase-06-Agents-and-Tool-Calling-Workflows/README.md)** | Agents & Tool Workflows | ReAct loop, `create_tool_calling_agent`, `AgentExecutor`, loop safety | Advanced | 3 days |
| **[Phase 7](Phase-07-Memory-and-Conversational-State/README.md)** | Memory & Conversational State | `RunnableWithMessageHistory`, Redis/SQL stores, `trim_messages` | Intermediate | 3 days |
| **[Phase 8](Phase-08-Streaming-Async-and-Callbacks/README.md)** | Streaming, Async & Callbacks | `astream_events(v2)`, Custom Callbacks, FastAPI SSE Streaming | Advanced | 3 days |
| **[Phase 9](Phase-09-Evaluation-Observability-and-LangSmith/README.md)** | Evaluation & LangSmith | Zero-code tracing, RAG Triad (Faithfulness, Relevancy), Pytest Mocks | Advanced | 3 days |
| **[Phase 10](Phase-10-Production-Optimization-and-Deployment/README.md)** | Production Deployment | Semantic Caching, Guardrails, Docker multi-stage, Kubernetes | Production | 3 days |

---

## Hands-On Capstone Projects

Apply everything you have learned by building 3 production-grade portfolio projects:

1. **[Project 1: Enterprise Conversational RAG Assistant](Projects/01-Conversational-RAG-Assistant.md)**
   - Hybrid dense/sparse search with reranking, history-aware query rewriting, SSE streaming, and LangSmith evaluation.
2. **[Project 2: Autonomous Data Analysis Agent](Projects/02-Autonomous-Data-Analysis-Agent.md)**
   - Multi-tool SQL inspection, Pandas data transformation, execution time limits, and self-correcting error recovery.
3. **[Project 3: Production Customer Support Bot](Projects/03-Production-Customer-Support-Bot.md)**
   - CRM tool bindings, prompt injection defense, output PII redaction, Redis session memory, and Docker/Kubernetes deployment.

---

## Quick Reference & Interview Prep

- **[Syntax Cheatsheet](Quick-Reference/Cheatsheet.md)**: Dense, copy-pasteable syntax guide for all modern LangChain components.
- **[50 Comprehensive Interview Questions & Answers](Quick-Reference/Interview-QA.md)**: Technical interview questions covering LCEL internals, agent loops, RAG metrics, and production deployment.

---

## Prerequisites & Getting Started

### Prerequisites
- Strong proficiency in Python 3.10+ (type annotations, async/await, Pydantic).
- Basic understanding of LLMs (tokens, temperature, system prompts).
- Active OpenAI, Anthropic, or local Ollama API access.

### Installation
```bash
pip install langchain-core langchain langchain-community langchain-openai langchain-anthropic pydantic fastapi uvicorn redis
```
