# Phase 5: Human-in-the-Loop and Breakpoints

## What You'll Learn

Implement enterprise Human-in-the-Loop (HITL) workflows: configure static breakpoints (`interrupt_before`, `interrupt_after`) and dynamic programmatic interrupts (`interrupt()`), build secure approval and state-editing flows, and implement time-travel state rewinding and branch replay.

## Learning Objectives

- Pause graph execution automatically before critical or destructive actions (e.g., executing financial transfers or database deletes).
- Use `app.get_state()` to inspect pending state and `app.update_state()` to modify or approve actions.
- Build dynamic in-node interruption gates using LangGraph's native `interrupt()` function.
- Implement time-travel state exploration by replaying historical checkpoints.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Static-and-Dynamic-Breakpoints.md](01-Static-and-Dynamic-Breakpoints.md) | `interrupt_before`, `interrupt_after`, dynamic `interrupt()`, pause/resume mechanics | 1 day |
| [02-State-Inspection-and-Approval-Flows.md](02-State-Inspection-and-Approval-Flows.md) | `get_state()`, `update_state()`, human feedback injection, edit and continue | 1 day |
| [03-Time-Travel-and-State-Rewind.md](03-Time-Travel-and-State-Rewind.md) | State history replay, checkpoint forking, debugging failed runs, deterministic rewind | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Streaming and Real-Time Graph Telemetry](../Phase-06-Streaming-and-Real-Time-Graph-Telemetry/README.md)
