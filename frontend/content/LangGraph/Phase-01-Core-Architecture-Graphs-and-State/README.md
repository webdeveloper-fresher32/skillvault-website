# Phase 1: Core Architecture, Graphs, and State

## What You'll Learn

Master the foundations of cyclical stateful agent orchestration in LangGraph: construct your first `StateGraph`, define graph computation nodes as pure Python functions, design state schemas using `TypedDict` and Pydantic, and route execution dynamically via standard and conditional edges.

## Learning Objectives

- Understand how LangGraph models AI workflows as stateful, cyclical Directed Graphs.
- Build and compile `StateGraph` workflows with `START`, `END`, and custom node functions.
- Design strongly-typed state channels using `TypedDict`, `BaseModel`, and type annotations.
- Implement deterministic transitions with `add_edge()` and dynamic conditional routing with `add_conditional_edges()`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-StateGraph-and-Nodes.md](01-StateGraph-and-Nodes.md) | `StateGraph`, nodes as Python functions, graph compilation, `START` and `END` sentinels | 1 day |
| [02-State-Schemas-TypedDict-and-Pydantic.md](02-State-Schemas-TypedDict-and-Pydantic.md) | `TypedDict` vs Pydantic `BaseModel`, channel definitions, type validation | 1 day |
| [03-Edges-and-Conditional-Routing.md](03-Edges-and-Conditional-Routing.md) | `add_edge()`, `add_conditional_edges()`, router functions, dynamic branching | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: Reducers and State Management](../Phase-02-Reducers-and-State-Management/README.md)
