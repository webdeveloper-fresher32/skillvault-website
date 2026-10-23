# Phase 2: Reducers and State Management

## What You'll Learn

Master LangGraph's state update mechanics: understand default key overwrites versus custom channel reducers, use `Annotated` with `operator.add` for accumulating lists and messages (`add_messages`), and handle complex state mutations across multi-step agent transitions.

## Learning Objectives

- Compare default channel overwriting with accumulator reducers.
- Append message histories and telemetry logs cleanly using `Annotated[List[T], operator.add]`.
- Use the built-in `add_messages` reducer to automatically merge, update, and deduplicate `BaseMessage` arrays.
- Manage nested state updates and dictionary mergers in multi-step graphs.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Default-Overwrite-vs-Custom-Reducers.md](01-Default-Overwrite-vs-Custom-Reducers.md) | Default overwrite behavior, custom reducer functions, merge conflicts | 1 day |
| [02-Annotated-and-Operator-Add.md](02-Annotated-and-Operator-Add.md) | `Annotated[list, operator.add]`, `add_messages` reducer, ID-based message updates | 1 day |
| [03-Complex-State-Mutations-and-State-Transitions.md](03-Complex-State-Mutations-and-State-Transitions.md) | Dictionary merging, state deletion (`None`), branch state synchronization | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Cyclic Graphs and Agentic Loops](../Phase-03-Cyclic-Graphs-and-Agentic-Loops/README.md)
