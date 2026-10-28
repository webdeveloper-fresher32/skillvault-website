# Phase 5: Advanced MCP Protocol Features

## What You'll Learn

Explore the cutting-edge protocol features of the Model Context Protocol:
1. **Sampling (`sampling/createMessage`):** Enable MCP servers to request intelligent completions and reasoning from the host's LLM, unlocking recursive and autonomous reasoning loops.
2. **Roots (`roots/list`):** Allow servers to discover workspace directory boundaries, enforce sandboxed path resolutions, and react to workspace folder changes.
3. **Progress Tokens & Task Cancellation:** Stream granular execution progress tokens (`progressToken`) to host UIs and handle clean, non-destructive task cancellations (`notifications/cancelled`).

## Learning Objectives

- Implement server-driven LLM sampling workflows without hardcoding API keys in the server.
- Utilize client Roots capabilities to restrict filesystem operations strictly to authorized project boundaries.
- Stream intermediate progress percentages for long-running batch and analytics jobs.
- Handle cancellation signals gracefully to abort ongoing database queries and HTTP calls.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Sampling-and-LLM-Feedback-Loops.md](01-Sampling-and-LLM-Feedback-Loops.md) | Server sampling (`sampling/createMessage`), LLM feedback loops, recursive reasoning | 1 day |
| [02-Roots-and-Workspace-Boundaries.md](02-Roots-and-Workspace-Boundaries.md) | Client roots (`roots/list`), workspace boundary notifications, sandboxed paths | 1 day |
| [03-Progress-Tokens-and-Task-Cancellation.md](03-Progress-Tokens-and-Task-Cancellation.md) | Long-running operations, `progressToken`, client cancellation notifications | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Security, Authentication, and Sandboxing](../Phase-06-Security-Authentication-and-Sandboxing/README.md)

