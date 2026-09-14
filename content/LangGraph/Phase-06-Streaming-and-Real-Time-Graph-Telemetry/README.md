# Phase 6: Streaming and Real-Time Graph Telemetry

## What You'll Learn

Master real-time token and state streaming in LangGraph: stream complete graph states (`stream_mode="values"`), node-level deltas (`stream_mode="updates"`), and real-time LLM token chunks (`stream_mode="messages"`), stream through nested subgraphs, and build production Server-Sent Events (SSE) FastAPI endpoints.

## Learning Objectives

- Compare LangGraph's three core streaming modes: `values`, `updates`, and `messages`.
- Stream token-by-token LLM generation directly to frontend clients with sub-200ms latency.
- Capture streaming telemetry across multi-level nested subgraph hierarchies.
- Implement production-grade FastAPI Server-Sent Events (SSE) streaming endpoints.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Streaming-Modes-Values-Updates-Messages.md](01-Streaming-Modes-Values-Updates-Messages.md) | `stream_mode="values"`, `"updates"`, `"messages"`, token streaming | 1 day |
| [02-Sub-Graph-Streaming.md](02-Sub-Graph-Streaming.md) | Streaming across subgraphs, namespace tagging, parent-child event isolation | 1 day |
| [03-FastAPI-and-SSE-Streaming-Integration.md](03-FastAPI-and-SSE-Streaming-Integration.md) | Async FastAPI streaming, `StreamingResponse`, SSE protocol formatting, client UI integration | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Multi-Agent Architectures](../Phase-07-Multi-Agent-Architectures/README.md)
