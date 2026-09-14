# LangChain and LangGraph Courses — Design Spec

Date: 2026-09-01

## Purpose

Add two new top-level SkillVault courses, `LangChain/` and `LangGraph/`, providing comprehensive, modern, production-grade curriculum for AI Full Stack Development. These courses cover LLM orchestration, modern LCEL, tool calling, memory, advanced RAG, streaming, stateful cyclical multi-agent workflows, human-in-the-loop governance, long-term memory stores, and production deployment patterns.

## Scope

### Course 1: LangChain (10 Phases)
- **Phase 01: LangChain Fundamentals & Architecture** — Modern package architecture (`langchain-core`, `langchain-community`, provider packages), Chat Models vs LLMs, Chat Messages, Prompt Templates, Output Parsers.
- **Phase 02: LangChain Expression Language (LCEL)** — The Runnable protocol (`invoke`, `stream`, `batch`, `ainvoke`, `astream`), composition pipes, `RunnableParallel`, `RunnablePassthrough`, `RunnableLambda`, fallbacks, retries.
- **Phase 03: Document Loaders, Splitters & Embeddings** — Document loaders (PDF, web, markdown), text splitters (recursive, header-based, semantic), embeddings and vector store integrations (Chroma, FAISS, pgvector).
- **Phase 04: Retrieval Strategies & Advanced RAG** — Contextual compression, MultiQueryRetriever, EnsembleRetriever (hybrid dense/sparse), ParentDocumentRetriever, Conversational RAG with history rephrasing.
- **Phase 05: Tools, Function Calling & Structured Outputs** — Defining `@tool` schemas with Pydantic, model tool-binding (`bind_tools`), structured outputs (`with_structured_output`).
- **Phase 06: Agents & Tool Calling Workflows** — ReAct loop mechanics, tool-calling agents (`create_tool_calling_agent`, `AgentExecutor`), intermediate steps, tool execution error handling.
- **Phase 07: Memory & Conversational State** — `ChatMessageHistory`, session management with `RunnableWithMessageHistory`, persistent backends (Redis, Postgres), token-windowing and summarization memory.
- **Phase 08: Streaming, Async & Callbacks** — Token streaming, `astream_events` v2 protocol, custom callback handlers (`BaseCallbackHandler`), FastAPI SSE / WebSocket streaming integration.
- **Phase 09: Evaluation, Observability & LangSmith** — Tracing LLM runs with LangSmith, datasets and evaluators (criteria, correctness, RAG metrics), unit testing with mocks.
- **Phase 10: Production Optimization & Deployment** — Caching (`InMemoryCache`, `RedisCache`), semantic caching, rate limiting, prompt injection defense, guardrails, and production FastAPI deployment.

### Course 2: LangGraph (10 Phases)
- **Phase 01: LangGraph Fundamentals & Core Concepts** — Why graphs for agentic systems vs DAGs, StateGraph primitives (State, Nodes, Edges, `START`/`END`), graph compilation and invocation.
- **Phase 02: State Management & Reducers** — Defining schemas with `TypedDict` and Pydantic, state reducers (`Annotated[list, add_messages]`, custom reducers), partial updates and delta merging.
- **Phase 03: Conditional Routing & Dynamic Edges** — Conditional edges (`add_conditional_edges`), dynamic routing functions, parallel node execution (fan-out/fan-in), cyclical loops and self-correction.
- **Phase 04: Persistence & Checkpointing** — Checkpointers (`MemorySaver`, `SqliteSaver`, `PostgresSaver`), threads and execution isolation, state history inspection and rollback.
- **Phase 05: Human-in-the-Loop & Time Travel** — Static and dynamic interrupts (`interrupt()`), human approval gates, state modification mid-flight (`update_state`), time travel and execution branching.
- **Phase 06: Multi-Agent Architectures** — Supervisor / Router patterns (hierarchical agent networks), peer-to-peer swarms with agent handoffs, Plan-and-Execute multi-agent workflows.
- **Phase 07: Subgraphs & Modular Graph Design** — Parent-child graph composition, private vs shared state transformations, modular reusable agent libraries.
- **Phase 08: Streaming Modes & Frontend Integration** — Streaming modes (`values`, `updates`, `messages`, `events`), token streaming from graph nodes, connecting LangGraph to Next.js UI via SSE.
- **Phase 09: Long-Term Memory & Store** — Working memory vs long-term cross-thread memory, LangGraph `Store` primitive (hierarchical namespaces and keys), semantic memory retrieval.
- **Phase 10: LangGraph Cloud, Studio & Production** — LangGraph Server architecture, visual debugging with LangGraph Studio, reliability, webhooks, rate limiting, and enterprise deployment.

## Projects & Quick References

Each course features:
- **Projects/ Directory**: 3 end-to-end hands-on project briefs with goals, requirements, approach, stretch goals, and evaluation checklists.
- **Quick-Reference/ Directory**:
  - `Cheatsheet.md`: Dense, instant-reference lookup tables, code snippets, and architecture cheat sheets.
  - `Interview-QA.md`: 50 interview questions and answers organized across the course topics (`### Qn.` format).
- **Course-level `README.md`**: Complete overview, structure tree, learning path table with difficulty and time estimates.

## Invariant Compliance
All lesson files adhere strictly to the repository's **Current (lean, code-dense)** format:
- Title ending in `— Complete Guide`
- Analogy on line 3
- Table of Contents
- 8–9 numbered sections with ASCII diagrams and code walkthroughs
- Dedicated comparison table
- Common mistakes
- Exactly 5 Hands-on Exercises
- Exactly 5 Interview Q&As
- 200–248 lines per lesson
