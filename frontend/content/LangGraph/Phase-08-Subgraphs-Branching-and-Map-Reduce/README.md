# Phase 8: Subgraphs, Branching, and Map-Reduce

## What You'll Learn

Master complex graph execution topologies in LangGraph: encapsulate modular logic with subgraphs as first-class nodes, run parallel multi-branch fan-out/fan-in executions, and implement scalable Map-Reduce workflows using LangGraph's dynamic `Send` API.

## Learning Objectives

- Encapsulate reusable domain logic by nesting compiled subgraphs inside parent graphs.
- Execute parallel branching (fan-out) from a single node to multiple concurrent worker nodes.
- Reconcile concurrent branch writes at fan-in aggregator nodes using channel reducers.
- Dynamically spawn variable numbers of parallel tasks using the `Send` API (Map-Reduce).

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Subgraphs-as-Nodes.md](01-Subgraphs-as-Nodes.md) | Subgraphs as nodes, state schema mapping, parent-child checkpoint isolation | 1 day |
| [02-Parallel-Branch-Execution-and-Fan-Out.md](02-Parallel-Branch-Execution-and-Fan-Out.md) | Fan-out static branches, fan-in barrier synchronization, concurrent state merge | 1 day |
| [03-Map-Reduce-Workflows-with-Send-API.md](03-Map-Reduce-Workflows-with-Send-API.md) | Dynamic task generation, `Send()` API, parallel chunk map-reduce | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Long-Term Memory and Store API](../Phase-09-Long-Term-Memory-and-Store-API/README.md)
