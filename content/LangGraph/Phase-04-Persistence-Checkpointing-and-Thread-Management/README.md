# Phase 4: Persistence, Checkpointing, and Thread Management

## What You'll Learn

Master durable graph state persistence and multi-tenant isolation in LangGraph: implement in-memory and SQLite checkpointers, isolate user conversations using `thread_id` parameters, and scale to high-availability production environments using `PostgresSaver`.

## Learning Objectives

- Understand how LangGraph checkpointers serialize and persist graph state after every node step.
- Implement thread-isolated conversational sessions using `MemorySaver` and `SqliteSaver`.
- Inspect, retrieve, and query historical thread state snapshots using `get_state()` and `get_state_history()`.
- Configure enterprise-grade durable persistence with connection pooling using `PostgresSaver`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-State-Checkpointers-Memory-and-Sqlite.md](01-State-Checkpointers-Memory-and-Sqlite.md) | Checkpointer interface, `MemorySaver`, `SqliteSaver`, state serialization | 1 day |
| [02-Thread-IDs-and-Session-Isolation.md](02-Thread-IDs-and-Session-Isolation.md) | `thread_id`, session partitioning, multi-tenant state isolation, state history | 1 day |
| [03-PostgreSQL-Checkpointer-for-Production.md](03-PostgreSQL-Checkpointer-for-Production.md) | `PostgresSaver`, connection pools, migrations, asynchronous database checkpointers | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Human-in-the-Loop and Breakpoints](../Phase-05-Human-in-the-Loop-and-Breakpoints/README.md)
