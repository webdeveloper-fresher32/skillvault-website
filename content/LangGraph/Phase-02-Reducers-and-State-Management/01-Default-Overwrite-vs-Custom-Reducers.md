# Default Overwrite vs Custom Reducers — Complete Guide

> "A shared team whiteboard can either erase the entire board on each presentation slide (overwrite) or append new bullet points underneath prior notes (reducer)."

---

## Table of Contents

1. [The Problem: Accidental State Erasure During Node Transitions](#1-the-problem-accidental-state-erasure-during-node-transitions)
2. [The Team Whiteboard Analogy](#2-the-team-whiteboard-analogy)
3. [The Mechanism: Default Overwrite vs Reducer Functions](#3-the-mechanism-default-overwrite-vs-reducer-functions)
4. [Diagram: Channel Update Strategy Comparison](#4-diagram-channel-update-strategy-comparison)
5. [Code Walkthrough: Custom Reducer for Mathematical Accumulation](#5-code-walkthrough-custom-reducer-for-mathematical-accumulation)
6. [Comparing Overwrite vs Reducer Behavior](#6-comparing-overwrite-vs-reducer-behavior)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Accidental State Erasure During Node Transitions

By default, when a node in LangGraph returns a dictionary `{"my_key": "new_val"}`, LangGraph replaces the previous value of `"my_key"` completely.

### The Overwrite Pitfall

```text
Turn 1: Node A returns {"logs": ["Started job"]}
        State: {"logs": ["Started job"]}

Turn 2: Node B returns {"logs": ["Step 2 completed"]}
        Default Overwrite Behavior:
        State: {"logs": ["Step 2 completed"]}  # "Started job" is LOST!
```

### The Solution: Custom Channel Reducers

Using Python's `typing.Annotated`, developers attach custom reducer functions to state channels to control exactly how incoming node updates merge into existing state.

---

## 2. The Team Whiteboard Analogy

In a conference room brainstorming session, two different rules can govern the team whiteboard.

### Whiteboard Wipe vs Running Ledger

```text
Whiteboard Wipe  → Presenter 2 takes the dry-erase eraser, wipes away
                   Presenter 1's diagrams, and writes a single sentence (Lossy).

Running Ledger   → Presenter 2 draws a horizontal separator line and appends
                   their findings below Presenter 1's work (Additive).
```

### Mapping to LangGraph

The Whiteboard Wipe is the **Default Overwrite** channel; the Running Ledger is a channel configured with an accumulator **Reducer**.

---

## 3. The Mechanism: Default Overwrite vs Reducer Functions

A reducer is a binary function `reducer(current_value, new_update) -> merged_value`.

### Defining Custom Channel Reducers with Annotated

```python
from typing import TypedDict, Annotated, List

# Custom Reducer: Concatenate lists without duplicates
def unique_list_reducer(current: List[str], update: List[str]) -> List[str]:
    if not current:
        return update or []
    return list(set(current + (update or [])))

class CustomState(TypedDict):
    # Channel 1: Default Overwrite (No Annotated)
    current_status: str

    # Channel 2: Custom Reducer attached via Annotated
    active_tags: Annotated[List[str], unique_list_reducer]
```

---

## 4. Diagram: Channel Update Strategy Comparison

### Channel Merge Mechanics

```text
Current Graph State: { "status": "PENDING", "active_tags": ["alpha"] }
                               │
                               ▼
Node Returns Partial Update: { "status": "RUNNING", "active_tags": ["beta"] }
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LangGraph State Engine Channel Processing                   │
├──────────────────────────────┬──────────────────────────────┤
│ Channel: "status"            │ Channel: "active_tags"       │
│ Strategy: Default Overwrite  │ Strategy: unique_list_reducer│
│ Result: "RUNNING"            │ Result: ["alpha", "beta"]    │
└──────────────────────────────┴──────────────────────────────┘
                               │
                               ▼
New Graph State: { "status": "RUNNING", "active_tags": ["alpha", "beta"] }
```

---

## 5. Code Walkthrough: Custom Reducer for Mathematical Accumulation

A complete LangGraph workflow demonstrating custom reducer arithmetic across multiple graph nodes:

```python
# custom_reducer_demo.py
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END

def score_aggregator(current: float, update: float) -> float:
    """Reducer that calculates a running average score."""
    if current == 0.0:
        return update
    return round((current + update) / 2.0, 2)

class EvaluationState(TypedDict):
    submission_id: str
    overall_score: Annotated[float, score_aggregator]
    audit_notes: Annotated[list[str], lambda cur, upd: cur + [upd]]

def judge_grammar_node(state: EvaluationState) -> dict:
    return {"overall_score": 9.0, "audit_notes": "Grammar: 9.0/10"}

def judge_logic_node(state: EvaluationState) -> dict:
    return {"overall_score": 7.0, "audit_notes": "Logic: 7.0/10"}

def build_grading_graph():
    builder = StateGraph(EvaluationState)
    builder.add_node("judge_grammar", judge_grammar_node)
    builder.add_node("judge_logic", judge_logic_node)

    builder.add_edge(START, "judge_grammar")
    builder.add_edge("judge_grammar", "judge_logic")
    builder.add_edge("judge_logic", END)

    return builder.compile()

if __name__ == "__main__":
    app = build_grading_graph()
    initial = {"submission_id": "SUB-101", "overall_score": 0.0, "audit_notes": []}
    result = app.invoke(initial)
    print("Final State:")
    print("  Aggregated Score:", result["overall_score"])  # (9.0 + 7.0) / 2 = 8.0
    print("  Audit Trail:", result["audit_notes"])
```

---

## 6. Comparing Overwrite vs Reducer Behavior

| Dimension | Default Channel (Overwrite) | Custom Reducer (`Annotated[T, func]`) |
|---|---|---|
| Definition Syntax | `field: int` or `field: str` | `field: Annotated[int, custom_func]` |
| Merge Logic | Discards previous value, sets new value | Executes `custom_func(current, update)` |
| Parallel Node Updates | Raises conflict error if 2 nodes write simultaneously | Merges parallel updates sequentially via reducer |
| List Management | Overwrites entire list on each update | Can append, prepend, or deduplicate items |
| Best Used For | Current status flags, single-step outputs | Chat histories, logs, metrics, accumulators |

---

## 7. Common Mistakes

- **Forgetting that untyped channels overwrite by default.** Expecting a list field `messages: List[str]` to append automatically without `Annotated` causes message history loss.
- **Raising exceptions on `None` in custom reducers.** Reducer functions must handle initial states where `current` or `update` might be `None` or empty.
- **Mutating input arguments inside reducers.** Reducers should return fresh objects rather than mutating `current.append(update)` in place.
- **Reducer function signature mismatch.** Reducers must accept exactly 2 arguments: `(current_value, new_update)` and return the new value.
- **Using complex side-effect code in reducers.** Reducers are called frequently during state replays; keep them pure, deterministic functions without network I/O.

---

## 8. Hands-On Exercises

**Exercise 1:** Define a custom reducer that keeps the maximum integer value: `max_reducer(cur, upd) -> max(cur, upd)`.

**Exercise 2:** Create a state schema with two channels: one overwriting `status: str` and one accumulating `history: Annotated[list, add]`.

**Exercise 3:** Build a 3-node graph where each node updates the accumulator and verify that all 3 updates appear in final state.

**Exercise 4:** Implement a dictionary merger reducer that merges incoming dictionaries via `{**cur, **upd}`.

**Exercise 5:** Test parallel node execution writing to an overwrite channel versus a reducer channel to observe conflict handling.

---

## 9. Interview Q&A

**Q: What is a Reducer in LangGraph and how is it declared?**
A Reducer is a binary function that defines how a state channel updates when a node returns a value for that key. It is declared using Python's `typing.Annotated` metadata syntax: `channel_name: Annotated[Type, reducer_function]`.

**Q: What is the default update behavior for a state channel without `Annotated`?**
Without `Annotated`, LangGraph uses the default overwrite strategy: whatever value the latest node returns completely replaces the previous value stored in that channel.

**Q: Why are reducers essential when two nodes execute in parallel?**
When two nodes execute concurrently in a fan-out graph, both may return updates for the same state channel. Without a reducer, LangGraph cannot reconcile conflicting writes. With a reducer, updates are applied sequentially to merge the results cleanly.

**Q: What are the two parameters passed to a custom reducer function?**
The first parameter is `current_value` (the existing value in the channel before the update). The second parameter is `new_update` (the value emitted by the node).

**Q: Can a reducer function clear or reset a state channel?**
Yes. A reducer can inspect the incoming update and, if a sentinel value (like `None` or `"RESET"`) is received, return an empty list or default value to reset the channel.
