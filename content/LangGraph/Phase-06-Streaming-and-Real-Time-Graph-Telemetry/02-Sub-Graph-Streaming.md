# Sub-Graph Streaming — Complete Guide

> "A space mission control center monitors real-time telemetry from both the main orbital spacecraft and the detached planetary landing probe on synchronized separate dashboard displays."

---

## Table of Contents

1. [The Problem: Telemetry Blackouts in Nested Subgraphs](#1-the-problem-telemetry-blackouts-in-nested-subgraphs)
2. [The Spacecraft and Landing Probe Analogy](#2-the-spacecraft-and-landing-probe-analogy)
3. [The Mechanism: Subgraph Namespaces and Streaming Traversal](#3-the-mechanism-subgraph-namespaces-and-streaming-traversal)
4. [Diagram: Parent and Subgraph Streaming Hierarchy](#4-diagram-parent-and-subgraph-streaming-hierarchy)
5. [Code Walkthrough: Streaming Multi-Tiered Subgraphs with Namespaces](#5-code-walkthrough-streaming-multi-tiered-subgraphs-with-namespaces)
6. [Comparing Root Streaming vs Subgraph Streaming](#6-comparing-root-streaming-vs-subgraph-streaming)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Telemetry Blackouts in Nested Subgraphs

When complex enterprise graphs embed child subgraphs (e.g. an autonomous research sub-team), naive root streaming treats the entire child subgraph as a single opaque black-box node.

### The Nested Black-Box Problem

```text
Parent Graph: [Orchestrator] ──▶ [Research Subgraph (runs 5 internal steps)] ──▶ [Summarizer]
  Without Subgraph Streaming:
  - Parent stream sits completely silent for 15 seconds while the subgraph runs.
  - Frontend cannot display the child agent's internal progress or tokens.
```

### The Solution: Subgraph-Aware Streaming

LangGraph's `subgraphs=True` parameter in `.stream()` and `.astream()` streams events from all nested child graphs with explicit namespace hierarchies.

---

## 2. The Spacecraft and Landing Probe Analogy

NASA flight controllers do not turn off radio antennas when the lunar lander separates from the command module.

### Command Module Silence vs Dual-Probe Telemetry

```text
Single Antenna  → Flight director only receives updates from the mothership;
                  landing probe telemetry is completely invisible (Blind descent).

Dual Telemetry  → Mothership stream: `[CommandModule]: In Lunar Orbit`.
                  Lander sub-stream: `[Lander.DescentEngine]: Altitude 500m... 200m... Touchdown!`.
```

### Mapping to LangGraph

The command module is the Parent Graph; the lunar lander is the Subgraph; the namespace tags distinguish parent telemetry from child telemetry.

---

## 3. The Mechanism: Subgraph Namespaces and Streaming Traversal

Enable child streaming by setting `subgraphs=True` in `.stream()`.

### Subgraph Streaming Syntax

```python
# Pass subgraphs=True to receive events from all nested child graphs
async for namespace, chunk in app.astream(
    inputs,
    stream_mode="updates",
    subgraphs=True  # Traverses into nested compiled graphs!
):
    print(f"Namespace: {namespace} | Update: {chunk}")
```

### Namespace Format

- Root Graph Events: `namespace = ()` (Empty tuple)
- Child Subgraph Events: `namespace = ("research_team",)`
- Grandchild Subgraph Events: `namespace = ("research_team", "web_scraper")`

---

## 4. Diagram: Parent and Subgraph Streaming Hierarchy

### Multi-Level Streaming Topology

```text
Root Graph Execution Stream
 ├── Namespace: () ──▶ [orchestrator_node] (Emits: "Dispatching Research")
 │
 ├── Namespace: ("research_subgraph",)
 │    ├── [search_worker] (Emits: "Querying Wikipedia...")
 │    ├── [analyst_worker] (Emits: "Analyzing 12 sources...")
 │    └── [writer_worker] (Emits token chunks: "Renewable energy...")
 │
 └── Namespace: () ──▶ [final_synthesis_node] (Emits: "Complete report compiled.")
```

---

## 5. Code Walkthrough: Streaming Multi-Tiered Subgraphs with Namespaces

A complete multi-level nested graph demonstrating real-time subgraph streaming:

```python
# subgraph_streaming_demo.py
import asyncio
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# --- 1. Define Child Subgraph ---
class ChildState(TypedDict):
    topic: str
    subgraph_notes: list[str]

def child_step_1(state: ChildState) -> dict:
    return {"subgraph_notes": [f"Scraped data for {state['topic']}"]}

def child_step_2(state: ChildState) -> dict:
    return {"subgraph_notes": ["Fact-checked sources."]}

child_builder = StateGraph(ChildState)
child_builder.add_node("step_1", child_step_1)
child_builder.add_node("step_2", child_step_2)
child_builder.add_edge(START, "step_1")
child_builder.add_edge("step_1", "step_2")
child_builder.add_edge("step_2", END)
child_subgraph = child_builder.compile()

# --- 2. Define Parent Graph ---
class ParentState(TypedDict):
    topic: str
    final_report: str

def parent_prep_node(state: ParentState) -> dict:
    return {"topic": state["topic"]}

def parent_finish_node(state: ParentState) -> dict:
    return {"final_report": f"Master Report on {state['topic']} generated."}

parent_builder = StateGraph(ParentState)
parent_builder.add_node("prep", parent_prep_node)
parent_builder.add_node("research_team", child_subgraph)  # Subgraph added as standard node!
parent_builder.add_node("finish", parent_finish_node)

parent_builder.add_edge(START, "prep")
parent_builder.add_edge("prep", "research_team")
parent_builder.add_edge("research_team", "finish")
parent_builder.add_edge("finish", END)

parent_app = parent_builder.compile()

# --- 3. Stream with subgraphs=True ---
async def run_subgraph_stream():
    inputs = {"topic": "Fusion Energy"}
    print("--- Streaming with subgraphs=True ---")
    async for namespace, update in parent_app.astream(inputs, stream_mode="updates", subgraphs=True):
        ns_str = " -> ".join(namespace) if namespace else "ROOT"
        print(f"[{ns_str}] {update}")

if __name__ == "__main__":
    asyncio.run(run_subgraph_stream())
```

---

## 6. Comparing Root Streaming vs Subgraph Streaming

| Feature | Root Streaming (`subgraphs=False`) | Subgraph Streaming (`subgraphs=True`) |
|---|---|---|
| Yield Tuple Structure | `chunk` | `(namespace_tuple, chunk)` |
| Child Graph Visibility | None (Child graph appears as 1 opaque delay) | Complete step-by-step visibility into child nodes |
| Token Streaming from Subgraphs | Only final merged response | Real-time token chunks from nested LLMs |
| Namespace Disambiguation | Not needed | `("sub_a", "sub_b")` path hierarchy |
| Best Used For | Simple flat architectures | Multi-agent teams, hierarchical supervisors |

---

## 7. Common Mistakes

- **Forgetting that `subgraphs=True` changes return signature.** When `subgraphs=True`, items yielded are `(namespace, chunk)` tuples rather than bare `chunk` objects.
- **Mismatched state keys between parent and child.** If child subgraph expects `sub_query` but parent passes `query`, child fails on entry; use state transformation wrappers.
- **Streaming grandchild graphs without checking namespace depth.** Hierarchical multi-agent swarms produce deep namespaces (e.g. `("finance", "tax_team", "scraper")`).
- **Assuming child checkpointers are independent.** When compiling a parent graph with a checkpointer, child subgraphs automatically share the checkpointer under sub-namespaces.
- **Overwhelming frontend with excessive child telemetry.** Filter noisy sub-agent events before sending to end-user web clients.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a 2-node child subgraph and embed it inside a parent graph.

**Exercise 2:** Execute with `subgraphs=False` and notice that child internal steps are omitted from output.

**Exercise 3:** Execute with `subgraphs=True` and print `namespace` alongside each node delta.

**Exercise 4:** Embed a `create_react_agent` as a subgraph and stream its internal `ToolNode` calls using `subgraphs=True`.

**Exercise 5:** Build a frontend filter that displays a spinner for child tasks and text typing for parent tasks based on `namespace`.

---

## 9. Interview Q&A

**Q: How do you enable subgraph streaming in LangGraph?**
By setting `subgraphs=True` in `.stream()` or `.astream()`: `app.astream(inputs, subgraphs=True)`.

**Q: What is the structure of the `namespace` yielded during subgraph streaming?**
The `namespace` is a tuple of string node names representing the hierarchical call path from the root graph down to the active child subgraph (e.g. `("supervisor", "researcher_agent")`). For root-level events, the namespace is an empty tuple `()`.

**Q: Can you stream real-time LLM token chunks from within a nested subgraph?**
Yes. Combining `subgraphs=True` with `stream_mode="messages"` yields `(namespace, (AIMessageChunk, metadata))` tuples, delivering real-time tokens from nested child agents.

**Q: How does checkpointing work with nested subgraphs?**
When a parent graph is compiled with a checkpointer, LangGraph manages checkpoints across all nested subgraphs within the same `thread_id`, namespacing child state snapshots automatically.

**Q: Why is subgraph streaming critical for multi-agent supervisor systems?**
In multi-agent architectures, a supervisor delegates work to specialized sub-agents. Subgraph streaming allows UI applications to show the user which specific worker agent is currently reasoning, searching, or generating tokens in real time.
