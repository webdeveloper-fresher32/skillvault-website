# The ReAct Agent Pattern in LangGraph — Complete Guide

> "A master detective at a crime scene inspects physical clues (Thought), runs fingerprint chemical tests (Action), observes the lab results (Observation), and repeats until the mystery is solved."

---

## Table of Contents

1. [The Problem: Why ReAct Requires Cyclical State Graphs](#1-the-problem-why-react-requires-cyclical-state-graphs)
2. [The Crime Scene Detective Analogy](#2-the-crime-scene-detective-analogy)
3. [The Mechanism: The 2-Node Cyclical ReAct Architecture](#3-the-mechanism-the-2-node-cyclical-react-architecture)
4. [Diagram: The Cyclical ReAct State Transition Flow](#4-diagram-the-cyclical-react-state-transition-flow)
5. [Code Walkthrough: Custom ReAct Graph Built from Scratch](#5-code-walkthrough-custom-react-graph-built-from-scratch)
6. [Comparing Legacy AgentExecutor vs LangGraph ReAct](#6-comparing-legacy-agentexecutor-vs-langgraph-react)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Why ReAct Requires Cyclical State Graphs

In legacy frameworks, autonomous agents were black-box loops (`AgentExecutor`) that hid state transitions, made dynamic interventions impossible, and resisted checkpointing.

### The Black-Box Agent Problem

```text
Legacy AgentExecutor:
  User Query ──▶ [Hidden While Loop] ──▶ Final Answer
  - Cannot inspect intermediate state in real-time.
  - Cannot inject human approvals before a dangerous tool executes.
  - Cannot pause execution and resume tomorrow.
```

### The Solution: Explicit ReAct Graphs

In LangGraph, ReAct is modeled as an explicit 2-node cyclical graph where every step is a first-class state checkpoint.

---

## 2. The Crime Scene Detective Analogy

A homicide detective does not guess the perpetrator on minute one without gathering evidence.

### Guesswork vs Iterative Detective Investigation

```text
Guesswork (Zero-Shot)   → Detective glances at crime scene and makes an unverified arrest.

Iterative Investigation → 1. Thought: "There is blood on the window."
                          2. Action: Run DNA analyzer tool on blood.
                          3. Observation: DNA belongs to Suspect B.
                          4. Thought: "Now I need Suspect B's bank records."
                          5. Action: Request bank records tool.
                          6. Observation: Received wire transfers.
                          7. Final Synthesis: Arrest Suspect B with full evidence.
```

### Mapping to LangGraph

The detective's mind is the `agent` LLM node; the crime lab instruments are the `tools` execution node; the case binder is the `MessagesState`.

---

## 3. The Mechanism: The 2-Node Cyclical ReAct Architecture

A LangGraph ReAct agent consists of:
1. `agent` node: Calls the LLM with bound tools.
2. `tools` node: Executes tool calls and returns `ToolMessage` outputs.
3. `should_continue` conditional edge: Routes to `tools` if `tool_calls` exist, or `END` if finished.

### Core Structure

```python
from langgraph.graph import StateGraph, MessagesState, START, END

# 1. State Definition
class AgentState(MessagesState):
    pass

# 2. Router Function
def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END
```

---

## 4. Diagram: The Cyclical ReAct State Transition Flow

### Cyclical Graph Topology

```text
[START]
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. "agent" Node (LLM with bind_tools)                       │
│    Reads: state["messages"]                                 │
│    Emits: AIMessage (with content or tool_calls)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Conditional Router: should_continue(state)               │
└──────────────┬───────────────────────────────┬──────────────┘
               │ (Has Tool Calls)              │ (No Tool Calls)
               ▼                               ▼
┌──────────────────────────────┐             [END]
│ 3. "tools" Node              │
│    Executes Tool Functions   │
│    Emits: [ToolMessage(...)] │
└──────────────┬───────────────┘
               │
               ▼ (Cyclical Loop Back to Reason on New Evidence)
      (Return to "agent")
```

---

## 5. Code Walkthrough: Custom ReAct Graph Built from Scratch

A complete custom ReAct agent built from foundational primitives:

```python
# custom_react_demo.py
import json
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END

# 1. Define Tools
@tool
def calculate_mortgage(loan_amount: float, interest_rate: float, years: int) -> str:
    """Calculate estimated monthly mortgage payment."""
    monthly_rate = (interest_rate / 100) / 12
    num_payments = years * 12
    monthly_payment = (loan_amount * monthly_rate) / (1 - (1 + monthly_rate) ** -num_payments)
    return f"${monthly_payment:.2f} per month"

tools = [calculate_mortgage]
tools_by_name = {t.name: t for t in tools}

# 2. Bind Tools to Model
model = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools(tools)

# 3. Define Nodes
def call_model(state: MessagesState) -> dict:
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def call_tools(state: MessagesState) -> dict:
    last_msg = state["messages"][-1]
    tool_results = []
    for tool_call in last_msg.tool_calls:
        tool_func = tools_by_name[tool_call["name"]]
        output = tool_func.invoke(tool_call["args"])
        tool_results.append(ToolMessage(content=str(output), tool_call_id=tool_call["id"]))
    return {"messages": tool_results}

def route_model_output(state: MessagesState):
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "tools"
    return END

# 4. Assemble Graph
workflow = StateGraph(MessagesState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tools)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", route_model_output, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")  # The Crucial Cyclical Edge!

app = workflow.compile()

if __name__ == "__main__":
    query = "What is the monthly payment on a $500,000 mortgage at 6.5% interest for 30 years?"
    res = app.invoke({"messages": [HumanMessage(content=query)]})
    print("Final Agent Response:\n", res["messages"][-1].content)
```

---

## 6. Comparing Legacy AgentExecutor vs LangGraph ReAct

| Dimension | Legacy `AgentExecutor` | LangGraph ReAct Graph |
|---|---|---|
| Execution Model | Hidden internal `while` loop | Explicit state machine with visual DAG |
| State Visibility | Intermediate steps bundled in string output | First-class versioned state checkpoints at each node |
| Human-in-the-Loop | Rigid callback interceptors | Native pause/resume breakpoints at `tools` |
| Customizability | Hard to modify loop logic | Full freedom to insert custom nodes into loop |
| Multi-Agent Scaling | Not supported natively | Compose multiple ReAct graphs as hierarchical subgraphs |

---

## 7. Common Mistakes

- **Forgetting the return edge from `tools` back to `agent`.** Without `builder.add_edge("tools", "agent")`, the graph terminates immediately after the first tool execution without letting the model synthesize the final answer.
- **Forgetting `tool_call_id` in `ToolMessage`.** Modern LLMs (like GPT-4o) reject tool results if the `tool_call_id` does not match the original `AIMessage.tool_calls[i].id`.
- **Handling multiple tool calls as a single item.** When an LLM emits parallel tool calls (`len(tool_calls) > 1`), iterating and emitting a list of all `ToolMessage` objects is mandatory.
- **Not setting temperature=0 for tool reasoning.** Non-zero temperature increases tool argument hallucination and malformed JSON payloads.
- **Missing recursion limits in production.** Always set `recursion_limit` in invocation config to prevent unexpected runaway loops.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a 2-node custom ReAct graph with a weather lookup tool.

**Exercise 2:** Print the full message history to observe the sequence: `[HumanMessage, AIMessage(tool_calls), ToolMessage, AIMessage(final)]`.

**Exercise 3:** Test parallel tool calling by asking a query requiring 2 simultaneous tool calls ("What is the weather in Paris and Tokyo?").

**Exercise 4:** Implement error handling inside `call_tools` so failed tool executions return descriptive `ToolMessage` errors rather than crashing the graph.

**Exercise 5:** Add an intermediate `guardrail` node between `tools` and `agent` that inspects tool outputs for sensitive data.

---

## 9. Interview Q&A

**Q: How does LangGraph represent the ReAct pattern architecturally?**
LangGraph represents ReAct as a stateful cyclical graph with two primary nodes: an `agent` node (which queries an LLM with tool bindings) and a `tools` node (which executes tool calls). A conditional edge inspects the `AIMessage.tool_calls` attribute to decide whether to route to `tools` or `END`, and a static edge routes from `tools` back to `agent`.

**Q: Why must the `tools` node route back to the `agent` node?**
Tool execution produces raw data (`ToolMessage`), not a human-facing answer. Routing back to the `agent` node allows the LLM to inspect the tool output, decide if additional tools are needed, or synthesize a coherent final response for the user.

**Q: How does LangGraph handle parallel tool calls emitted in a single turn?**
When the LLM generates multiple tool calls in `AIMessage.tool_calls`, the `tools` node iterates over all tool calls, executes them, and returns a list of `ToolMessage` objects. The `add_messages` reducer appends all of them to the message history.

**Q: What is the primary advantage of building agents as LangGraph graphs rather than using monolithic wrappers?**
Every step in the reasoning cycle is exposed as an explicit state transition. This enables fine-grained streaming, breakpoint interrupts before dangerous tool executions, time-travel state rollback, and seamless multi-agent orchestration.

**Q: What happens if the LLM calls a tool that does not exist?**
If tool execution is not guarded with try/except, an uncaught `KeyError` or `Exception` will crash the graph. In production, tools nodes catch exceptions and return a `ToolMessage(content="Error: tool not found")`, allowing the LLM to self-correct in the next iteration.
