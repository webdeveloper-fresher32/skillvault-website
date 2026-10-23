# Phase 2: LangChain Expression Language (LCEL)

## What You'll Learn

Master the Runnable protocol that powers modern LangChain, compose resilient pipelines using `RunnableParallel`, `RunnablePassthrough`, and `RunnableLambda`, and leverage built-in async execution, streaming, fallbacks, and retries.

## Learning Objectives

- Implement the core `Runnable` interface methods (`invoke`, `batch`, `stream`, `ainvoke`, `abatch`, `astream`) across custom and built-in components.
- Use LCEL primitives (`RunnableParallel`, `RunnablePassthrough`, `RunnableLambda`, `RunnableBranch`) to manage branching, data transformations, and parallel task execution.
- Build production-resilient chains with `.with_fallbacks()`, `.with_retry()`, `.bind()`, and `.with_config()`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Runnable-Protocol-and-Primitives.md](01-Runnable-Protocol-and-Primitives.md) | The Runnable interface, core methods, RunnablePassthrough, RunnableLambda, custom data transforms | 1 day |
| [02-Chaining-Parallelism-and-Fallbacks.md](02-Chaining-Parallelism-and-Fallbacks.md) | RunnableParallel, branching, error fallbacks, retries, dynamic runtime argument binding | 1 day |
| [03-Streaming-and-Async-LCEL.md](03-Streaming-and-Async-LCEL.md) | Async batching, intermediate streaming, token iterators, async pipeline optimization | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Document Loaders, Splitters, and Embeddings](../Phase-03-Document-Loaders-Splitters-and-Embeddings/README.md)
