# Loop Control and Recursion Limits — Complete Guide

> "An industrial emergency circuit breaker cuts electricity to a high-speed assembly line whenever a motor spins beyond safety limits, preventing catastrophic factory floor fires."

---

## Table of Contents

1. [The Problem: Runaway Agent Loops and Token Drainage](#1-the-problem-runaway-agent-loops-and-token-drainage)
2. [The Emergency Circuit Breaker Analogy](#2-the-emergency-circuit-breaker-analogy)
3. [The Mechanism: recursion_limit and State Iteration Circuit Breakers](#3-the-mechanism-recursion_limit-and-state-iteration-circuit-breakers)
4. [Diagram: Dual-Layer Loop Boundary Architecture](#4-diagram-dual-layer-loop-boundary-architecture)
5. [Code Walkthrough: Production Agent with Cycle Detection and Iteration Bounds](#5-code-walkthrough-production-agent-with-cycle-detection-and-iteration-bounds)
6. [Comparing Engine Limits vs In-Graph Circuit Breakers](#6-comparing-engine-limits-vs-in-graph-circuit-breakers)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Runaway Agent Loops and Token Drainage

When an LLM gets stuck in an unresolvable tool-call failure loop (e.g. repeated SQL syntax errors or hallucinated tool arguments), an unbounded graph will cycle endlessly, burning hundreds of dollars in API credits.

### The Infinite Loop Vulnerability

```text
Turn 1: Agent calls search("latest stock price") ──▶ Tool returns empty
Turn 2: Agent calls search("latest stock price") ──▶ Tool returns empty
Turn 3: Agent calls search("latest stock price") ──▶ Tool returns empty
...
Turn 100: Consumed $50 in API credits and exhausted rate limits!
```

### The Solution: Multi-Layered Loop Bounds

LangGraph combines an engine-level `recursion_limit` (hard crash safeguard) with state-tracked iteration counters (graceful synthesis on max iterations).

---

## 2. The Emergency Circuit Breaker Analogy

An industrial power plant does not rely on human operators noticing an overheating turbine.

### Unmonitored Turbine vs Dual Breakers

```text
Unmonitored Motor   → Motor overheats; friction ignites grease;
                      entire manufacturing floor burns down.

Dual Circuit System → 1. Primary Governor: Software governor limits motor to 3,000 RPM (In-Graph Counter).
                      2. Hard Fuse: Physical magnetic breaker trips power at 3,500 RPM (Engine Recursion Limit).
```

### Mapping to LangGraph

The In-Graph Counter is the software governor (synthesizes partial answer); the `recursion_limit` is the hard physical fuse (throws `GraphRecursionError`).

---

## 3. The Mechanism: recursion_limit and State Iteration Circuit Breakers

### 1. Engine-Level Hard Limit (`recursion_limit`)

Configured via the invocation `config` dictionary (default is 25 steps).

```python
# Hard stop at 10 graph node transitions
config = {"recursion_limit": 10}
response = app.invoke(inputs, config=config)
```

### 2. State-Tracked Graceful Degradation Counter

Track iteration counts inside state and branch to a fallback synthesizer node when limits are approached.

```python
def route_with_guard(state: AgentState):
    if state.get("loop_count", 0) >= 4:
        return "fallback_synthesizer"  # Graceful exit without throwing an error
    if state["messages"][-1].tool_calls:
        return "tools"
    return END
```

---

## 4. Diagram: Dual-Layer Loop Boundary Architecture

### Safety Hierarchy

```text
Incoming User Query
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Outer Safety Net: LangGraph Engine recursion_limit=10       │
│ (Triggers GraphRecursionError if exceeded)                  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Inner Circuit Breaker: loop_count >= 4              │   │
│   │                                                     │   │
│   │       (loop_count < 4)           (loop_count >= 4)  │   │
│   │       ┌───────────────┐          ┌────────────────┐ │   │
│   │       │ Execute Tools │          │ Fallback Model │ │   │
│   │       │ & Loop Back   │          │ Synthesis Node │ │   │
│   │       └───────┬───────┘          └───────┬────────┘ │   │
│   │               │                          │          │   │
│   └───────────────┼──────────────────────────┼──────────┘   │
│                   │                          │              │
└───────────────────┼──────────────────────────┼──────────────┘
                    │                          │
                    ▼                          ▼
            [Next Cycle]                     [END]
```

---

## 5. Code Walkthrough: Production Agent with Cycle Detection and Iteration Bounds

A self-correcting agent graph with duplicate action detection and graceful fallback synthesis:

```python
# loop_guard_demo.py
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

@tool
def flaky_search(query: str) -> str:
    """Simulates a search tool that repeatedly fails."""
    return "Error: Database connection refused."

tools = [flaky_search]
tools_dict = {t.name: t for t in tools}
model = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools(tools)

class GuardedState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    loop_count: int

def call_model_node(state: GuardedState) -> dict:
    count = state.get("loop_count", 0) + 1
    resp = model.invoke(state["messages"])
    return {"messages": [resp], "loop_count": count}

def call_tools_node(state: GuardedState) -> dict:
    last_msg = state["messages"][-1]
    res = []
    for tc in last_msg.tool_calls:
        func = tools_dict[tc["name"]]
        out = func.invoke(tc["args"])
        res.append(ToolMessage(content=str(out), tool_call_id=tc["id"]))
    return {"messages": res}

def fallback_synthesizer_node(state: GuardedState) -> dict:
    # Graceful degradation message instead of crashing
    msg = AIMessage(content="I apologize, but after several attempts the search service is unavailable. Please try again later.")
    return {"messages": [msg]}

def guarded_router(state: GuardedState):
    if state.get("loop_count", 0) >= 3:
        return "fallback"  # Trigger graceful fallback!
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "tools"
    return END

def build_guarded_graph():
    b = StateGraph(GuardedState)
    b.add_node("agent", call_model_node)
    b.add_node("tools", call_tools_node)
    b.add_node("fallback", fallback_synthesizer_node)

    b.add_edge(START, "agent")
    b.add_conditional_edges("agent", guarded_router, {"tools": "tools", "fallback": "fallback", END: END})
    b.add_edge("tools", "agent")
    b.add_edge("fallback", END)

    return b.compile()

if __name__ == "__main__":
    app = build_guarded_graph()
    initial = {"messages": [HumanMessage(content="Find latest revenue data")], "loop_count": 0}
    # Pass engine hard recursion_limit as emergency fallback
    result = app.invoke(initial, config={"recursion_limit": 10})
    print("Final Output:\n", result["messages"][-1].content)
```

---

## 6. Comparing Engine Limits vs In-Graph Circuit Breakers

| Feature | Engine Limit (`recursion_limit`) | In-Graph Circuit Breaker (State Counter) |
|---|---|---|
| Trigger Condition | Total node transitions exceed threshold | Specific cycle count exceeds threshold |
| Termination Behavior | Throws unhandled `GraphRecursionError` | Routes cleanly to fallback synthesizer node |
| User Experience | 500 Server Error | Helpful apology / Partial answer synthesis |
| Granularity | Global across entire graph | Per-agent, per-tool, or per-subgraph |
| Best Used For | Emergency infrastructure safeguard | Production UX and business logic resilience |

---

## 7. Common Mistakes

- **Relying solely on `recursion_limit=25`.** Letting the engine hit `recursion_limit` crashes the application with an unhandled exception; always implement in-graph loop counters.
- **Counting user turns instead of graph cycles.** A user conversation can last 50 turns (`thread_id`), but an individual reasoning step should be limited to 4–6 cycles; reset loop counters at the start of each user request.
- **Ignoring identical tool call loops.** If an agent issues the exact same tool name and arguments 3 times in a row, a cycle detector should break the loop immediately.
- **Setting `recursion_limit` too low for multi-agent graphs.** In a multi-agent supervisor graph with 4 sub-agents, setting `recursion_limit=5` causes premature crashes.
- **Not logging loop threshold breaches.** When an agent hits a circuit breaker, emit a high-priority alert to LangSmith or Datadog for engineering investigation.

---

## 8. Hands-On Exercises

**Exercise 1:** Trigger a `GraphRecursionError` by configuring `recursion_limit=3` on a 4-step cyclical graph.

**Exercise 2:** Implement an in-graph loop counter that gracefully terminates with a partial answer on iteration 3.

**Exercise 3:** Build a repeat-action detector that checks if `(tool_name, args)` matches the previous turn and halts the loop.

**Exercise 4:** Test a multi-agent supervisor graph and calculate the required `recursion_limit` based on agent depth.

**Exercise 5:** Add a retry delay or exponential backoff node before cycling back to a failing tool.

---

## 9. Interview Q&A

**Q: What happens when a LangGraph execution exceeds `recursion_limit`?**
LangGraph immediately halts execution and raises a `langgraph.errors.GraphRecursionError`. The invocation fails and no further nodes are executed.

**Q: What is the default `recursion_limit` in LangGraph and how is it customized?**
The default `recursion_limit` is 25 node transitions. It can be customized per invocation via the `config` argument: `app.invoke(inputs, config={"recursion_limit": 50})`.

**Q: Why is an in-graph circuit breaker preferable to relying on `recursion_limit`?**
`recursion_limit` raises a hard exception that returns a 500 error to users. An in-graph circuit breaker intercepts runaway loops before the engine limit is reached, allowing the graph to route to a fallback synthesis node that returns a polite apology or partial result.

**Q: What is "Repeat Action Detection" in agent architectures?**
Repeat Action Detection is an algorithmic guardrail that inspects the agent's recent tool calls. If the agent repeatedly calls the exact same tool with identical parameters and receives the same error, the detector intervenes to prevent wasting API tokens.

**Q: How does `recursion_limit` interact with persistent checkpoints?**
The `recursion_limit` counts node transitions *within a single invocation*. If a user interacts over 100 conversation turns across multiple days, `recursion_limit` does not trigger because it resets to 0 on each new `.invoke()` call on that thread.
