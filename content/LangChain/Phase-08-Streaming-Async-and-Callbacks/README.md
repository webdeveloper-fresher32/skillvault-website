# Phase 8: Streaming, Async, and Callbacks

## What You'll Learn

Achieve sub-second Time-To-First-Token (TTFT) and high-throughput concurrency: implement token streaming via `.stream()` and `.astream()`, capture granular pipeline events with `astream_events(version="v2")`, build custom lifecycle callbacks, and stream Server-Sent Events (SSE) to frontend clients using FastAPI.

## Learning Objectives

- Stream token deltas and intermediate chunks from complex LCEL chains and agents using `astream_events`.
- Implement custom `AsyncCallbackHandler` hooks for metrics, logging, audit trails, and token counters.
- Expose production streaming REST endpoints via FastAPI `StreamingResponse` using SSE (Server-Sent Events).

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Astream-and-Event-Streaming.md](01-Astream-and-Event-Streaming.md) | `stream()`, `astream()`, `astream_events(v2)`, event types (`on_chat_model_stream`, `on_tool_start`) | 1 day |
| [02-Custom-Callbacks-and-Lifecycle-Hooks.md](02-Custom-Callbacks-and-Lifecycle-Hooks.md) | `BaseCallbackHandler`, `AsyncCallbackHandler`, lifecycle events, token tracking | 1 day |
| [03-SSE-and-FastAPI-Streaming.md](03-SSE-and-FastAPI-Streaming.md) | FastAPI `StreamingResponse`, Server-Sent Events (SSE) wire protocol, frontend consumption | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Evaluation, Observability, and LangSmith](../Phase-09-Evaluation-Observability-and-LangSmith/README.md)
