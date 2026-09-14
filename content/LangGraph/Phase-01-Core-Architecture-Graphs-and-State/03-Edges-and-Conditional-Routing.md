# Edges and Conditional Routing — Complete Guide

> "A railway track switch operator inspects the incoming freight manifest and flips the mechanical switch to route refrigerated cargo to the depot and dry grain to the silo."

---

## Table of Contents

1. [The Problem: Static Graphs Cannot Adapt to Dynamic Agent Decisions](#1-the-problem-static-graphs-cannot-adapt-to-dynamic-agent-decisions)
2. [The Railway Switch Operator Analogy](#2-the-railway-switch-operator-analogy)
3. [The Mechanism: add_edge and add_conditional_edges](#3-the-mechanism-add_edge-and-add_conditional_edges)
4. [Diagram: Dynamic Conditional Routing and Looping](#4-diagram-dynamic-conditional-routing-and-looping)
5. [Code Walkthrough: Production Router with Cyclical Retry Loop](#5-code-walkthrough-production-router-with-cyclical-retry-loop)
6. [Comparing Standard Edges vs Conditional Edges](#6-comparing-standard-edges-vs-conditional-edges)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Static Graphs Cannot Adapt to Dynamic Agent Decisions

In real-world applications, the next step depends on previous outcomes: if the LLM called a tool, route to `tools`; if an error occurred, route to `retry`; if satisfied, route to `END`.

### Why Static Transitions Fail in Agents

```text
Static Edge Workflow:
  [Evaluate Query] ──▶ [Always Run Search Tool] ──▶ [Answer]
  If user asks: "What is 2 + 2?"
  → Graph blindly executes an unnecessary web search.
  → Cannot dynamically branch or loop back on failure.
```

### The Solution: Conditional Routing (`add_conditional_edges`)

LangGraph provides dynamic branching via `add_conditional_edges()`, where a router function inspects the current state and returns the next destination node.

---

## 2. The Railway Switch Operator Analogy

A railway junction does not force high-speed passenger trains onto rusty industrial coal sidings.

### Fixed Straight Track vs Rail Track Switch

```text
Fixed Track     → Every train travels to the same terminal regardless of cargo
                  (Passenger trains get dumped in a coal mine).

Switch Operator → Inspector checks the train manifest:
                  - If cargo is Hazardous ──▶ Route to Hazmat Siding.
                  - If passenger express  ──▶ Route to Grand Central Station.
                  - If brake failure      ──▶ Route to Emergency Loop Track.
```

### Mapping to LangGraph

The router function is the switch operator; its return value determines whether the graph proceeds to a tool, loops back, or terminates at `END`.

---

## 3. The Mechanism: add_edge and add_conditional_edges

LangGraph supports standard static edges and dynamic conditional routing.

### Core Routing Primitives

```python
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END

class AgentState(TypedDict):
    confidence_score: float
    retry_count: int

# 1. Routing Function
def route_next_step(state: AgentState) -> Literal["human_review", "auto_approve", "retry"]:
    if state["confidence_score"] >= 0.85:
        return "auto_approve"
    elif state["retry_count"] < 3:
        return "retry"
    else:
        return "human_review"

# 2. Wire conditional edge with path mapping
builder = StateGraph(AgentState)
# ... add nodes: "evaluator", "human_review", "auto_approve", "retry" ...
builder.add_conditional_edges(
    "evaluator",
    route_next_step,
    {
        "auto_approve": "auto_approve",
        "human_review": "human_review",
        "retry": "evaluator"  # Cyclical loop back to start node!
    }
)
```

---

## 4. Diagram: Dynamic Conditional Routing and Looping

### Decision Branching Topology

```text
[START] ──▶ [Evaluator Node]
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Conditional Edge Router Function: route_next_step(state)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
    (Score >= 0.85)             (Score < 0.85 & Retries < 3)  (Retries >= 3)
               ▼                               ▼                      ▼
┌──────────────────────┐        ┌──────────────────────┐ ┌──────────────────┐
│ Node: "auto_approve" │        │ Cyclical Loop Back   │ │ Node: "human_rev"│
│                      │        │ to "Evaluator"       │ │                  │
└──────────────┬───────┘        └──────────────────────┘ └────────┬─────────┘
               │                                                  │
               └───────────────────────┬──────────────────────────┘
                                       │
                                       ▼
                                     [END]
```

---

## 5. Code Walkthrough: Production Router with Cyclical Retry Loop

A complete self-correcting code generation graph that checks syntax and loops back on errors:

```python
# conditional_routing_demo.py
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END

class CodeReviewState(TypedDict):
    code_snippet: str
    is_valid: bool
    iterations: int
    error_log: str

def generate_code_node(state: CodeReviewState) -> dict:
    count = state.get("iterations", 0) + 1
    # Simulate code generation that improves on iteration 2
    if count == 1:
        code = "def add(a, b) return a + b"  # Syntax error: missing colon
    else:
        code = "def add(a, b):\n    return a + b"  # Fixed syntax
    return {"code_snippet": code, "iterations": count}

def validate_syntax_node(state: CodeReviewState) -> dict:
    try:
        compile(state["code_snippet"], "<string>", "exec")
        return {"is_valid": True, "error_log": ""}
    except SyntaxError as e:
        return {"is_valid": False, "error_log": str(e)}

def route_after_validation(state: CodeReviewState) -> Literal["generate", "__end__"]:
    if state["is_valid"] or state["iterations"] >= 3:
        return "__end__"
    return "generate"  # Loop back!

def build_code_repair_graph():
    builder = StateGraph(CodeReviewState)
    builder.add_node("generate", generate_code_node)
    builder.add_node("validate", validate_syntax_node)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "validate")
    builder.add_conditional_edges(
        "validate",
        route_after_validation,
        {"generate": "generate", "__end__": END}
    )
    return builder.compile()

if __name__ == "__main__":
    app = build_code_repair_graph()
    result = app.invoke({"code_snippet": "", "iterations": 0})
    print(f"Repaired in {result['iterations']} iterations:")
    print(result["code_snippet"])
```

---

## 6. Comparing Standard Edges vs Conditional Edges

| Feature | Standard Edge (`add_edge`) | Conditional Edge (`add_conditional_edges`) |
|---|---|---|
| Destination | Single deterministic node | Dynamic (computed from state by router function) |
| Routing Logic | Static 1-to-1 connection | Python conditional branching (`if/elif/else`) |
| Cylical Looping | Can loop directly to prior node | Decides dynamically whether to loop or terminate |
| Path Mapping Dict | Not used | Optional mapping dict (`{"route_key": "node_name"}`) |
| Best Used For | Sequential linear pipelines | Agent decisions, tool routing, error self-correction |

---

## 7. Common Mistakes

- **Returning a destination node not present in the graph.** If the router function returns `"summarize"` but no node named `"summarize"` exists, LangGraph raises a runtime routing error.
- **Creating infinite cyclical loops without a termination counter.** If a conditional edge loops back indefinitely, the graph runs until hitting the default recursion limit (25 iterations).
- **Mutating state inside the router function.** Router functions should be pure read-only evaluators; do not return state dictionaries from routers.
- **Forgetting to map `END` in path dictionary.** When using a path mapping dictionary, map the terminal condition explicitly: `{"done": END}`.
- **Mismatched return types in router functions.** Ensure router return strings exactly match keys in the mapping dictionary.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a graph with a conditional edge routing queries to `support_bot` if inquiry is billing-related, or `tech_bot` otherwise.

**Exercise 2:** Create a cyclical graph that increments an integer counter from 1 to 5 and terminates when `counter == 5`.

**Exercise 3:** Use `path_map` dictionary in `add_conditional_edges` to rename internal router keys to external node IDs.

**Exercise 4:** Implement an agent tool router that checks `if state["messages"][-1].tool_calls:` to decide whether to call `tools` or `END`.

**Exercise 5:** Test recursion limit behavior by intentionally building an infinite conditional loop and observing the `GraphRecursionError`.

---

## 9. Interview Q&A

**Q: What is the difference between `add_edge` and `add_conditional_edges` in LangGraph?**
`add_edge(node_a, node_b)` creates a static, deterministic transition where execution always moves from Node A to Node B. `add_conditional_edges(node_a, routing_func)` executes a Python routing function that inspects the current graph state and dynamically returns the target destination node.

**Q: How does LangGraph prevent infinite loops in cyclical conditional graphs?**
LangGraph enforces a configurable `recursion_limit` parameter during invocation (default is 25 steps: `app.invoke(input, config={"recursion_limit": 50})`). If execution cycles exceed this limit, a `GraphRecursionError` is raised.

**Q: What is the role of the optional `path_map` argument in `add_conditional_edges`?**
The `path_map` dictionary maps the string return values of the router function to actual graph node names (e.g. `{"continue": "agent", "stop": END}`), decoupling router return values from literal node identifier strings.

**Q: Can a router function return `END` directly?**
Yes. A router function can return the `END` sentinel constant (or `"__end__"`), immediately terminating graph execution and returning the final state dictionary to the caller.

**Q: Can conditional edges route to multiple parallel branches simultaneously?**
Yes. In advanced workflows, router functions can return a list of target node names (or use the `Send` API) to fan-out execution across multiple downstream nodes in parallel.
