# Phase 9: Long-Term Memory and Store API

## What You'll Learn

Master cross-thread persistence and long-term memory in LangGraph: understand the architectural difference between short-term thread checkpoints and cross-thread memory, use the `BaseStore` / `InMemoryStore` APIs, implement hierarchical namespacing and semantic memory vector search, and build self-updating user profile and preference systems.

## Learning Objectives

- Distinguish short-term thread-scoped memory from cross-thread long-term memory.
- Store, retrieve, and delete arbitrary JSON documents using the LangGraph `Store` API.
- Organize long-term memories using hierarchical namespace tuples (`("users", user_id, "memories")`).
- Perform semantic vector similarity search over persisted memories inside graph nodes.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-LangGraph-Store-API-and-Cross-Thread-State.md](01-LangGraph-Store-API-and-Cross-Thread-State.md) | `BaseStore`, `InMemoryStore`, thread memory vs cross-thread memory | 1 day |
| [02-Semantic-Memory-Search-and-Namespaces.md](02-Semantic-Memory-Search-and-Namespaces.md) | Hierarchical namespaces, semantic vector indexing, `store.search()` | 1 day |
| [03-User-Profile-and-Preference-Persistence.md](03-User-Profile-and-Preference-Persistence.md) | Dynamic memory extraction, auto-updating user profiles, personalized reasoning | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: Production Deployment and LangGraph Cloud](../Phase-10-Production-Deployment-and-LangGraph-Cloud/README.md)
