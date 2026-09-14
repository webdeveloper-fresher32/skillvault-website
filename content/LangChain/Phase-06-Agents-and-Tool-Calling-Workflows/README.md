# Phase 6: Agents and Tool Calling Workflows

## What You'll Learn

Understand autonomous LLM agents: the reasoning-and-acting (ReAct) loop, modern tool-calling agents (`create_tool_calling_agent`, `AgentExecutor`), intermediate step inspection, and robust iteration and error boundaries.

## Learning Objectives

- Compare agent reasoning architectures (ReAct, Plan-and-Solve, Tool-Calling Agents).
- Construct autonomous tool-calling agents with `create_tool_calling_agent` and `AgentExecutor`.
- Implement production safety boundaries: `max_iterations`, `max_execution_time`, `early_stopping_method`, and tool error self-correction.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Agent-Architectures-and-ReAct.md](01-Agent-Architectures-and-ReAct.md) | The ReAct loop (Thought-Action-Observation), agent types, autonomous reasoning mechanics | 1 day |
| [02-Tool-Calling-Agents-and-Executor.md](02-Tool-Calling-Agents-and-Executor.md) | `create_tool_calling_agent`, `AgentExecutor`, intermediate_steps inspection, multi-tool execution | 1 day |
| [03-Agent-Error-Handling-and-Iteration-Limits.md](03-Agent-Error-Handling-and-Iteration-Limits.md) | Infinite loop prevention, max_iterations, timeout handling, error recovery prompts | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Memory and Conversational State](../Phase-07-Memory-and-Conversational-State/README.md)
