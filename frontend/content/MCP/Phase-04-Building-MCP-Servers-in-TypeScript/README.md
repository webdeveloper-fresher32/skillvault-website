# Phase 4: Building MCP Servers in TypeScript

## What You'll Learn

Develop enterprise-grade MCP servers in the Node.js and TypeScript ecosystems using the official `@modelcontextprotocol/sdk`. Master the high-level `McpServer` class, configure `StdioServerTransport` for CLI applications, build production Express/Fastify Server-Sent Events (`SSEServerTransport`) endpoints, and leverage **Zod** for end-to-end type safety and schema validation.

## Learning Objectives

- Architect TypeScript MCP servers using `@modelcontextprotocol/sdk`.
- Implement tools, dynamic resources, and prompt templates using `server.tool()`, `server.resource()`, and `server.prompt()`.
- Expose dual transports: local standard I/O and remote HTTP SSE using Express.
- Enforce schema contracts using Zod objects, enum constraints, and optional parameters.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-TypeScript-MCP-SDK-Fundamentals.md](01-TypeScript-MCP-SDK-Fundamentals.md) | `@modelcontextprotocol/sdk` structure, `McpServer`, lifecycle & registration | 1 day |
| [02-Stdio-and-Express-SSE-Transports.md](02-Stdio-and-Express-SSE-Transports.md) | `StdioServerTransport`, Express / Fastify SSE endpoints, session postbacks | 1 day |
| [03-Type-Safety-and-Zod-Schema-Patterns.md](03-Type-Safety-and-Zod-Schema-Patterns.md) | Zod schema validation, union types, error formatting, stream responses | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Advanced MCP Protocol Features](../Phase-05-Advanced-MCP-Protocol-Features/README.md)
