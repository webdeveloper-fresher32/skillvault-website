# State Schemas (TypedDict and Pydantic) — Complete Guide

> "An architectural structural blueprint specifies the exact material dimensions, load tolerances, and electrical conduits of every room in a building before construction crews pour concrete."

---

## Table of Contents

1. [The Problem: Untyped State and Runtime KeyErrors](#1-the-problem-untyped-state-and-runtime-keyerrors)
2. [The Architectural Blueprint Analogy](#2-the-architectural-blueprint-analogy)
3. [The Mechanism: TypedDict and Pydantic Schemas](#3-the-mechanism-typeddict-and-pydantic-schemas)
4. [Diagram: State Validation and Channel Lifecycle](#4-diagram-state-validation-and-channel-lifecycle)
5. [Code Walkthrough: Type-Safe Graph with Pydantic State](#5-code-walkthrough-type-safe-graph-with-pydantic-state)
6. [Comparing TypedDict vs Pydantic BaseModel](#6-comparing-typeddict-vs-pydantic-basemodel)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Untyped State and Runtime KeyErrors

When multiple agents and tools mutate unstructured dictionaries (`state = {}`), missing keys and type mismatches cause unexpected crashes deep inside long execution loops.

### The Fragility of Raw Dictionaries

```text
Node 1 outputs: {"user_id": 12345}  # Integer ID
Node 2 expects: state["userId"].upper()  # KeyError (camelCase vs snake_case)
                                         # AttributeError (int has no upper())
→ The graph fails on turn 10 of an expensive agent run!
```

### The Solution: Strongly-Typed State Schemas

LangGraph supports `TypedDict` and Pydantic `BaseModel` schemas to define state channels, validate inputs at graph boundaries, and enable IDE autocompletion.

---

## 2. The Architectural Blueprint Analogy

A civil engineer does not allow plumbers to guess pipe diameters while installing high-pressure water mains.

### Guesswork vs Structural Blueprint

```text
Guesswork Wiring    → Electrician runs 110V wires into 240V air conditioners;
                      breakers trip and equipment burns out.

Formal Blueprint    → Blueprint specifies Room 4: 240V / 30A Copper Romex.
                      Inspectors verify electrical compatibility before occupancy.
```

### Mapping to LangChain & LangGraph

The `TypedDict` / Pydantic schema is the building blueprint; every graph node reads and writes against verified state channels.

---

## 3. The Mechanism: TypedDict and Pydantic Schemas

You pass a `TypedDict` or `BaseModel` class directly into `StateGraph(Schema)`.

### Defining TypedDict and Pydantic Schemas

```python
from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph

# Option A: Standard TypedDict (Lightweight, zero runtime overhead)
class ChatWorkflowState(TypedDict):
    query: str
    documents: List[str]
    iteration: int

# Option B: Pydantic BaseModel (Enforces runtime validation & boundary checks)
class StrictWorkflowState(BaseModel):
    query: str = Field(min_length=1, description="User search query")
    retry_count: int = Field(default=0, ge=0, le=5)
    authorized: bool = Field(default=False)

# Initializing graph with schema
builder = StateGraph(StrictWorkflowState)
```

---

## 4. Diagram: State Validation and Channel Lifecycle

### State Ingestion and Channel Distribution

```text
Initial Input Dict: {"query": "Search docs", "retry_count": 0}
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Graph State Schema Validation                            │
│    - Validates types (query: str, retry_count: int)         │
│    - Populates default values (authorized: False)           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Node Function Execution: search_node(state)              │
│    Reads: state.query                                       │
│    Emits Partial Update: {"authorized": True}               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. State Channel Merge                                      │
│    Merges partial update into centralized graph state       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Type-Safe Graph with Pydantic State

A complete LangGraph pipeline implementing runtime validation, default values, and Pydantic constraints:

```python
# pydantic_state_demo.py
from typing import List
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END

class ResearchState(BaseModel):
    topic: str = Field(min_length=2, description="Research topic")
    sources_scraped: List[str] = Field(default_factory=list)
    draft_article: str = Field(default="")
    review_score: float = Field(default=0.0, ge=0.0, le=10.0)

def scrape_sources_node(state: ResearchState) -> dict:
    # State is accessed via dot-notation with Pydantic BaseModel
    topic = state.topic
    mock_sources = [f"https://wiki.org/{topic}", f"https://news.com/{topic}"]
    return {"sources_scraped": mock_sources}

def generate_draft_node(state: ResearchState) -> dict:
    article = f"Comprehensive research summary on {state.topic} using {len(state.sources_scraped)} verified sources."
    return {"draft_article": article, "review_score": 8.5}

def build_research_graph():
    builder = StateGraph(ResearchState)
    builder.add_node("scraper", scrape_sources_node)
    builder.add_node("writer", generate_draft_node)

    builder.add_edge(START, "scraper")
    builder.add_edge("scraper", "writer")
    builder.add_edge("writer", END)

    return builder.compile()

if __name__ == "__main__":
    app = build_research_graph()
    result = app.invoke({"topic": "Quantum Teleportation"})
    print("Article:\n", result["draft_article"])
    print("Score:", result["review_score"])
```

---

## 6. Comparing TypedDict vs Pydantic BaseModel

| Feature | `TypedDict` | Pydantic `BaseModel` |
|---|---|---|
| Runtime Validation | None (Static type checker only) | Strict (Enforces constraints like `ge=0, le=10`) |
| Performance Overhead | Zero (Pure Python dictionaries) | Negligible (~0.1ms per validation pass) |
| State Access Syntax | Dictionary keys (`state["topic"]`) | Dot notation (`state.topic`) or dictionary keys |
| Default Field Values | Not natively supported | First-class `Field(default=...)` support |
| Best Used For | High-throughput agent message streams | Strict API boundaries, security-sensitive states |

---

## 7. Common Mistakes

- **Accessing Pydantic state with dictionary keys when expecting an object.** While LangGraph allows dictionary access for backward compatibility, dot-notation `state.topic` is cleaner for `BaseModel`.
- **Forgetting `default_factory=list` in Pydantic.** Using `sources: List[str] = []` shares a mutable list across all instances; always use `Field(default_factory=list)`.
- **Throwing validation errors on partial updates.** Node functions only return partial dictionaries (e.g. `{"review_score": 8.0}`); the schema validates the *merged* state, not the partial update.
- **Using non-serializable types in state.** Storing raw database connections or thread locks in state breaks JSON checkpointing; store serializable primitives.
- **Inconsistent field naming.** Mixing `user_id` and `userId` across different nodes results in duplicate channels in state.

---

## 8. Hands-On Exercises

**Exercise 1:** Define a `TypedDict` state schema for an email assistant with fields: `email_text: str`, `spam_score: float`, and `is_spam: bool`.

**Exercise 2:** Create a `BaseModel` state schema with a Pydantic validator that rejects any `topic` containing prohibited profanity.

**Exercise 3:** Build a 2-node graph using your Pydantic state and verify that default fields are initialized correctly.

**Exercise 4:** Test input validation by invoking your compiled graph with an invalid payload (e.g. integer instead of string) and catch the `ValidationError`.

**Exercise 5:** Compare execution time of 1,000 iterations between a `TypedDict` graph and a `BaseModel` graph.

---

## 9. Interview Q&A

**Q: What is the difference between `TypedDict` and Pydantic `BaseModel` as LangGraph state schemas?**
`TypedDict` provides static type hinting during development with zero runtime validation overhead (state remains a standard Python `dict`). Pydantic `BaseModel` performs strict runtime type checking, boundary enforcement (e.g. min/max constraints), and default field population on every state transition.

**Q: Can you pass a partial dictionary from a node function when using a Pydantic state schema?**
Yes. Even when using a Pydantic `BaseModel`, node functions return partial dictionaries (e.g. `{"step_completed": True}`). LangGraph merges the partial dictionary into the existing state and re-validates the combined model.

**Q: Why should mutable fields like lists use `default_factory=list` in Pydantic schemas?**
In Python, default arguments like `items: List[str] = []` are evaluated once at class definition time, causing all graph executions to accidentally share the same list instance. `default_factory=list` instantiates a fresh list for each graph execution.

**Q: What happens if a node returns a key that is not defined in the state schema?**
If using standard `TypedDict` or `BaseModel` with default settings, undefined keys will either be ignored or raise an extra field error depending on Pydantic's `extra="forbid"` configuration.

**Q: Why is state serializability critical in LangGraph?**
LangGraph serializes state to disk, Redis, or PostgreSQL checkpoints to support human-in-the-loop approvals, time-travel debugging, and multi-day agent workflows. All state channels must be serializable (e.g. JSON/Msgpack).
