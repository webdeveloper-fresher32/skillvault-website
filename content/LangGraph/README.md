# LangGraph Mastery Curriculum — Complete Zero-to-Hero Guide

Welcome to the **LangGraph Mastery Curriculum**, the comprehensive, production-grade learning track for architecting stateful, cyclic, multi-agent systems, Human-in-the-Loop workflows, and autonomous AI swarms.

---

## 🏗️ Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANGGRAPH ECOSYSTEM                               │
│                                                                             │
│  ┌─────────────────────────┐  Cyclic ReAct Loops   ┌─────────────────────┐  │
│  │   StateGraph Engine     │ ────────────────────▶ │  ToolNode Execution │  │
│  │  (State, Nodes, Edges)  │ ◀──────────────────── │  & Error Recovery   │  │
│  └────────────┬────────────┘                       └─────────────────────┘  │
│               │                                                             │
│       Persistence & Control                                                 │
│       ┌───────┴─────────────────────────────┐                               │
│       ▼                                     ▼                               │
│  ┌─────────────────────────┐           ┌─────────────────────────────────┐  │
│  │ Checkpointers & Threads │           │ Human-in-the-Loop Interrupts    │  │
│  │ (Postgres, SQLite, Mem) │           │ (Breakpoints, State Overwrite)  │  │
│  └────────────┬────────────┘           └────────────────┬────────────────┘  │
│               │                                         │                   │
│       Enterprise Topologies                             │                   │
│       ┌───────┴─────────────────────────────────────────┘                   │
│       ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Multi-Agent Architectures & Topologies                                 │  │
│  │  - Supervisor Pattern (Star Topology)                                 │  │
│  │  - Hierarchical Teams (Nested Department Subgraphs)                   │  │
│  │  - Decentralized Swarm Mesh (Direct Tool Handoffs)                    │  │
│  │  - Dynamic Map-Reduce (Send API Fan-Out / Fan-In)                     │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│       Cross-Thread Memory & Store    │                                      │
│       ┌──────────────────────────────┘                                      │
│       ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Long-Term Store API (Cross-Thread User Profiles & Semantic Memory)    │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│       Production & Telemetry         │                                      │
│       ┌──────────────────────────────┘                                      │
│       ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Fast API SSE Streaming • LangGraph Studio • LangGraph Cloud • Docker  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Complete Learning Path

| Phase | Title | Core Concepts | Files |
|-------|-------|---------------|-------|
| **01** | [Core Architecture, Graphs, and State](Phase-01-Core-Architecture-Graphs-and-State/README.md) | `StateGraph`, `START`, `END`, Nodes, Edges, TypedDict/Pydantic schemas, Conditional Routing | 3 Lessons |
| **02** | [Reducers and State Management](Phase-02-Reducers-and-State-Management/README.md) | Default overwrite vs custom reducers, `Annotated`, `operator.add`, `add_messages`, transactional mutations | 3 Lessons |
| **03** | [Cyclic Graphs and Agentic Loops](Phase-03-Cyclic-Graphs-and-Agentic-Loops/README.md) | ReAct agent pattern, `ToolNode`, `tools_condition`, `create_react_agent`, loop control, `recursion_limit` | 3 Lessons |
| **04** | [Persistence, Checkpointing, and Thread Management](Phase-04-Persistence-Checkpointing-and-Thread-Management/README.md) | `MemorySaver`, `SqliteSaver`, `PostgresSaver`, `thread_id` session isolation, state history | 3 Lessons |
| **05** | [Human-in-the-Loop and Breakpoints](Phase-05-Human-in-the-Loop-and-Breakpoints/README.md) | `interrupt_before`, dynamic `interrupt()`, `Command(resume=...)`, `get_state`, `update_state`, Time Travel | 3 Lessons |
| **06** | [Streaming and Real-Time Graph Telemetry](Phase-06-Streaming-and-Real-Time-Graph-Telemetry/README.md) | `stream_mode="values"`, `"updates"`, `"messages"`, nested subgraph streaming, FastAPI SSE streaming | 3 Lessons |
| **07** | [Multi-Agent Architectures](Phase-07-Multi-Agent-Architectures/README.md) | Multi-Agent Supervisor pattern, Hierarchical Subgraph Teams, Peer-to-Peer Swarms, Handoff tools | 3 Lessons |
| **08** | [Subgraphs, Branching, and Map-Reduce](Phase-08-Subgraphs-Branching-and-Map-Reduce/README.md) | Subgraphs as nodes, parallel fan-out/fan-in, Barrier Synchronization, dynamic `Send` API | 3 Lessons |
| **09** | [Long-Term Memory and Store API](Phase-09-Long-Term-Memory-and-Store-API/README.md) | `BaseStore`, `InMemoryStore`, cross-thread memory, semantic vector search, self-learning user profiles | 3 Lessons |
| **10** | [Production Deployment and LangGraph Cloud](Phase-10-Production-Deployment-and-LangGraph-Cloud/README.md) | `langgraph.json`, CLI (`langgraph dev`, `build`), LangGraph Studio GUI, Cloud SaaS, Docker & Postgres | 3 Lessons |

---

## 🛠️ Capstone Projects

- **[Project 1: Autonomous Research and Writer Agent](Projects/01-Autonomous-Research-and-Writer-Agent.md)**: Multi-query parallel research, outline generation, section drafting, quality review scoring loops, and final Markdown report assembly.
- **[Project 2: Enterprise Customer Support with HITL](Projects/02-Enterprise-Customer-Support-with-HITL.md)**: Automated customer triage, intent detection, dynamic tool calling, and dynamic Human-in-the-Loop approval gates for financial transactions.
- **[Project 3: Hierarchical Multi-Agent Software Dev Team](Projects/03-Hierarchical-Multi-Agent-Software-Dev-Team.md)**: Top-level Product Manager supervisor coordinating Engineering Subgraph (Architect + Backend Dev) and QA Subgraph (Test Writer + Runner) with automated feedback loops.

---

## ⚡ Quick Reference & Interview Prep

- **[LangGraph Syntax Cheatsheet](Quick-Reference/Cheatsheet.md)**: High-density syntax guide covering graph builder, reducers, persistence, streaming, interrupts, and multi-agent routing.
- **[LangGraph Master Interview Q&A](Quick-Reference/Interview-QA.md)**: 50 in-depth technical questions and answers for Senior AI Engineers and Architects.
