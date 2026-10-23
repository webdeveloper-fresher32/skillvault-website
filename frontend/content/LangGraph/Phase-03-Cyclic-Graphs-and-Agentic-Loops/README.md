# Phase 3: Cyclic Graphs and Agentic Loops

## What You'll Learn

Build autonomous reasoning loops in LangGraph: implement the native ReAct agent cycle, use prebuilt `ToolNode` and `create_react_agent` components, and configure deterministic loop control, recursion limits, and self-correcting error recovery.

## Learning Objectives

- Implement the ReAct (Reasoning + Acting) loop as a cyclical two-node graph (`agent` $\rightleftharpoons$ `tools`).
- Use LangGraph's prebuilt `ToolNode` and `tools_condition` for zero-boilerplate tool execution.
- Prevent runaway execution loops by configuring `recursion_limit` and implementing loop circuit breakers.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-The-ReAct-Agent-Pattern-in-LangGraph.md](01-The-ReAct-Agent-Pattern-in-LangGraph.md) | The ReAct graph loop, model node, tool execution node, conditional cycle | 1 day |
| [02-ToolNode-and-Prebuilt-Components.md](02-ToolNode-and-Prebuilt-Components.md) | `ToolNode`, `tools_condition`, `create_react_agent`, prebuilt component internals | 1 day |
| [03-Loop-Control-and-Recursion-Limits.md](03-Loop-Control-and-Recursion-Limits.md) | `recursion_limit`, max iteration guards, cycle detection, infinite loop prevention | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 4: Persistence, Checkpointing, and Thread Management](../Phase-04-Persistence-Checkpointing-and-Thread-Management/README.md)
