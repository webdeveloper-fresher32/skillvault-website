# Phase 3: Building MCP Servers in Python

## What You'll Learn

Build robust, high-performance MCP servers in Python using the official `mcp` SDK. Master high-level development with **FastMCP** decorators (`@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()`), understand the low-level Server API with custom request handlers and lifespan managers, and implement production-grade Pydantic input validation, structured error codes, and graceful timeouts.

## Learning Objectives

- Install, configure, and operate the official `mcp` Python SDK and FastMCP framework.
- Author asynchronous tools, dynamic URI resources, and parameterized prompts with automatic type deduction.
- Implement low-level Server instances with custom session lifespans and background tasks.
- Enforce rigorous validation with Pydantic v2 models and custom JSON-RPC error mapping.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Python-MCP-SDK-and-FastMCP.md](01-Python-MCP-SDK-and-FastMCP.md) | Official Python SDK, FastMCP decorators, tool/resource/prompt authoring | 1 day |
| [02-Low-Level-Python-Server-API.md](02-Low-Level-Python-Server-API.md) | Low-level Server class, Lifespan context, custom RPC handlers, stdio/SSE runners | 1 day |
| [03-Error-Handling-and-Input-Validation.md](03-Error-Handling-and-Input-Validation.md) | Pydantic validation, standard & custom RPC error codes, timeouts, debugging | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 4: Building MCP Servers in TypeScript](../Phase-04-Building-MCP-Servers-in-TypeScript/README.md)
