# Phase 1: MCP Fundamentals and Architecture

## What You'll Learn

Discover the foundations of the **Model Context Protocol (MCP)**: resolve the classic $M \times N$ tool integration bottleneck, understand the Host-Client-Server architectural topology, master the JSON-RPC 2.0 lifecycle from initialization to teardown, and evaluate local standard I/O (`stdio`) versus remote Server-Sent Events (`SSE`) transports.

## Learning Objectives

- Analyze why custom point-to-point tool integrations fail at scale and how MCP creates a universal standard.
- Understand the distinct responsibilities of Hosts (e.g. Claude Desktop, Cursor), Clients, and Servers.
- Dissect the JSON-RPC 2.0 message envelope including protocol handshakes, capability negotiation, and notifications.
- Compare stdio sub-processes vs HTTP/SSE network transports for latency, security, and scalability.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Introduction-to-Model-Context-Protocol.md](01-Introduction-to-Model-Context-Protocol.md) | The $M \times N$ problem, MCP vision, Host-Client-Server architecture | 1 day |
| [02-JSON-RPC-2.0-and-Protocol-Lifecycle.md](02-JSON-RPC-2.0-and-Protocol-Lifecycle.md) | JSON-RPC 2.0 spec, initialization handshake, capability negotiation, ping & keepalive | 1 day |
| [03-Transport-Mechanisms-Stdio-vs-SSE.md](03-Transport-Mechanisms-Stdio-vs-SSE.md) | Subprocess `stdio` pipes vs HTTP/SSE network transport, message framing, trade-offs | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: Core Primitives: Tools, Resources, and Prompts](../Phase-02-Core-Primitives-Tools-Resources-and-Prompts/README.md)
