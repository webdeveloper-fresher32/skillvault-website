# Map-Reduce Workflows with Send API — Complete Guide

> "A postal sorting facility takes a giant cargo container of 10,000 mixed letters, splits them across 50 conveyor belts to be scanned simultaneously, and merges the sorted mail into localized delivery trucks."

---

## Table of Contents

1. [The Problem: Dynamic Dynamic Parallelism with Variable Input Sizes](#1-the-problem-dynamic-dynamic-parallelism-with-variable-input-sizes)
2. [The Postal Sorting Facility Analogy](#2-the-postal-sorting-facility-analogy)
3. [The Mechanism: The Send() API for Dynamic Map-Reduce](#3-the-mechanism-the-send-api-for-dynamic-map-reduce)
4. [Diagram: Dynamic Map-Reduce Fan-Out / Fan-In with Send](#4-diagram-dynamic-map-reduce-fan-out--fan-in-with-send)
5. [Code Walkthrough: Parallel Chapter Summarization via Map-Reduce](#5-code-walkthrough-parallel-chapter-summarization-via-map-reduce)
6. [Comparing Static Fan-Out vs Dynamic Send API](#6-comparing-static-fan-out-vs-dynamic-send-api)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Dynamic Dynamic Parallelism with Variable Input Sizes

Static fan-out requires knowing the exact number of branches at graph compile time. But real-world inputs vary dynamically (e.g. a book may contain 4 chapters or 40 chapters).

### The Dynamic Parallelism Challenge

```text
Fixed Graph Edges:
  Hardcoded for 3 branches.
  If input has 12 items ──▶ Must loop 4 times sequentially (Slow).
  If input has 1 item   ──▶ 2 branches run with empty dummy data (Wasteful).

Dynamic Map-Reduce with Send():
  Input has $N$ items ──▶ Graph dynamically generates exactly $N$ parallel worker tasks!
```

### The Solution: LangGraph `Send` Object

The `Send(node_name, state_payload)` primitive allows conditional edge functions to dynamically generate a list of task dispatches at runtime.

---

## 2. The Postal Sorting Facility Analogy

A regional sorting hub does not build a fixed, unchangeable 4-chute sorting desk.

### Fixed 4-Chute Desk vs Dynamic Conveyor Belt System

```text
Fixed 4-Chute Desk → If 10,000 packages arrive, 9,996 packages wait in line for the 4 slots
                     (Massive logistical backlog).

Dynamic Sorter     → Scans incoming truck manifest, dynamically opens 25 sorting belts,
                     distributes 400 packages per belt in parallel, and merges at shipping dock.
```

### Mapping to LangGraph

The incoming manifest is the input state; the sorting belts are the `Send("worker_node", item)` tasks; the shipping dock is the reducer node.

---

## 3. The Mechanism: The Send() API for Dynamic Map-Reduce

Return a list of `Send` objects from a conditional edge routing function.

### The Send Function Signature

```python
from langgraph.types import Send

def map_chapters_router(state: BookState) -> list[Send]:
    """Dynamically spawns 1 worker node per chapter in state."""
    return [
        Send("summarize_chapter_node", {"chapter_text": ch, "chapter_index": i})
        for i, ch in enumerate(state["chapters"])
    ]

# Connect router via conditional edges:
builder.add_conditional_edges("split_book_node", map_chapters_router, ["summarize_chapter_node"])
```

---

## 4. Diagram: Dynamic Map-Reduce Fan-Out / Fan-In with Send

### Map-Reduce Topology

```text
[START]
   │
   ▼
[1. Splitter Node] (Splits 500-page book into N chapters)
   │
   ▼ (Conditional Edge evaluates `map_chapters_router` ──▶ Returns [Send, Send, ...])
   ├──────────────────────┬──────────────────────┬─────────────...
   ▼                      ▼                      ▼
[Worker 1 (Ch. 1)]  [Worker 2 (Ch. 2)]  [Worker 3 (Ch. 3)] ... [Worker N (Ch. N)]
   │                      │                      │
   └──────────────────────┼──────────────────────┴─────────────... (Dynamic Fan-In)
                          │
                          ▼ (All worker summaries merged via operator.add)
                 [2. Reducer Node] (Synthesizes Master Book Summary)
                          │
                          ▼
                        [END]
```

---

## 5. Code Walkthrough: Parallel Chapter Summarization via Map-Reduce

A complete implementation processing variable-length document chunks concurrently:

```python
# map_reduce_send_demo.py
from typing import TypedDict, Annotated, List
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

# --- 1. State Definitions ---
class MasterBookState(TypedDict):
    book_title: str
    raw_text: str
    chapters: List[str]
    # Reducer accumulates chapter summaries concurrently!
    chapter_summaries: Annotated[List[str], operator.add]
    master_summary: str

class ChapterWorkerState(TypedDict):
    chapter_index: int
    chapter_text: str

# --- 2. Graph Nodes ---
def split_book_node(state: MasterBookState) -> dict:
    # Splits text by paragraph into variable chunks
    chunks = [c.strip() for c in state["raw_text"].split("\n\n") if c.strip()]
    return {"chapters": chunks, "chapter_summaries": []}

def summarize_chapter_node(state: ChapterWorkerState) -> dict:
    idx = state["chapter_index"]
    txt = state["chapter_text"]
    # Simulates LLM summarizing individual chapter
    summary = f"Summary of Part {idx + 1}: Key insight from '{txt[:30]}...'"
    return {"chapter_summaries": [summary]}

def reduce_summaries_node(state: MasterBookState) -> dict:
    all_summaries = "\n".join(state["chapter_summaries"])
    return {
        "master_summary": f"=== Master Summary of {state['book_title']} ===\n{all_summaries}"
    }

# --- 3. Dynamic Router returning List[Send] ---
def dynamic_map_router(state: MasterBookState) -> list[Send]:
    return [
        Send("summarizer", {"chapter_index": i, "chapter_text": ch})
        for i, ch in enumerate(state["chapters"])
    ]

# --- 4. Assemble Graph ---
builder = StateGraph(MasterBookState)
builder.add_node("splitter", split_book_node)
builder.add_node("summarizer", summarize_chapter_node)
builder.add_node("reducer", reduce_summaries_node)

builder.add_edge(START, "splitter")
builder.add_conditional_edges("splitter", dynamic_map_router, ["summarizer"])
builder.add_edge("summarizer", "reducer")
builder.add_edge("reducer", END)

app = builder.compile()

if __name__ == "__main__":
    sample_text = (
        "Chapter 1: The foundation of distributed agentic architectures.\n\n"
        "Chapter 2: Checkpointing state persistence mechanisms.\n\n"
        "Chapter 3: Dynamic fan-out and Map-Reduce paradigms."
    )
    res = app.invoke({"book_title": "Modern Graph AI", "raw_text": sample_text})
    print(res["master_summary"])
```

---

## 6. Comparing Static Fan-Out vs Dynamic Send API

| Feature | Static Fan-Out (`add_edge`) | Dynamic Map-Reduce (`Send`) |
|---|---|---|
| Branch Cardinality | Fixed at compile time ($N=3$) | Variable at runtime ($N = \text{len}(\text{input})$) |
| Input Data Variation | Poor fit for variable collections | Ideal for documents, chunks, datasets |
| Worker Input Schema | Shares global state schema | Can pass dedicated local `WorkerState` schema |
| Concurrency Handling | Event loop scheduling | Async parallel task generation |
| Code Complexity | Low | Medium |

---

## 7. Common Mistakes

- **Forgetting the target node list in `add_conditional_edges`.** When returning `Send` objects, you must declare all possible target node names as a list: `builder.add_conditional_edges(..., router, ["target_node_name"])`.
- **Worker state schema mismatches.** The dictionary payload passed to `Send("node", payload)` must match the argument keys expected by the worker node.
- **Missing channel reducers on accumulator fields.** The master state must use `Annotated[list, operator.add]` for the reduced field, or concurrent writes will crash with update errors.
- **Unbounded fan-out crashing rate limits.** If a book produces 100 chapters, spawning 100 simultaneous LLM calls will hit rate limits; use batch chunking or an async semaphore.
- **Trying to return `Send` from a regular node instead of a conditional edge.** `Send()` is only valid when returned from conditional routing functions.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a text translator that splits a document by sentence and uses `Send()` to translate sentences in parallel.

**Exercise 2:** Implement an automated stock portfolio audit that uses `Send()` to analyze $N$ stock tickers concurrently.

**Exercise 3:** Add an async semaphore inside the worker node to limit max concurrent LLM calls to 5.

**Exercise 4:** Test `Send()` with an empty list `[]` to verify the graph gracefully handles zero-item inputs.

**Exercise 5:** Combine `Send()` with subgraph worker nodes to execute nested agent workflows per chapter.

---

## 9. Interview Q&A

**Q: What is the `Send` API in LangGraph?**
The `Send` API (`langgraph.types.Send`) is a primitive used in conditional edge functions to dynamically generate parallel task invocations at runtime. Each `Send(node_name, state_dict)` schedules an independent execution of `node_name` with a custom state payload.

**Q: How does LangGraph achieve Map-Reduce using the `Send` API?**
1. **Map Step**: A conditional edge function splits a collection of items and returns a list of `Send("worker_node", item)` objects.
2. **Execution**: LangGraph runs all spawned worker nodes concurrently in parallel.
3. **Reduce Step**: Each worker emits its result to a channel configured with a reducer (`operator.add`). Once all workers complete, LangGraph executes a downstream aggregator node.

**Q: Can `Send()` pass a different state schema to worker nodes than the parent graph?**
Yes. The payload passed to `Send("worker_node", custom_payload)` can conform to a lean, dedicated worker state schema rather than the full parent graph schema.

**Q: What happens if a conditional edge returns an empty list `[]` instead of `Send` objects?**
If no `Send` objects are returned, LangGraph skips worker execution entirely and transitions directly to downstream nodes or terminates cleanly without error.

**Q: How do you prevent out-of-memory or rate-limit issues when fanning out thousands of items with `Send`?**
Chunk large item collections into batches (e.g. 10 items per `Send` task), use `asyncio.Semaphore` inside worker nodes to throttle max concurrency, or implement worker queue batching.
