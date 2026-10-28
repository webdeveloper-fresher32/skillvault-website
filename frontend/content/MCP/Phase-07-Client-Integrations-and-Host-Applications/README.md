# Phase 7: Client Integrations and Host Applications

## What You'll Learn

Connect, configure, and orchestrate MCP servers inside desktop host applications and build your own autonomous client applications from scratch. Master configuration schemas for Claude Desktop, Cursor, and Zed, leverage the interactive **MCP Inspector** for real-time visual debugging, and implement production MCP Client runners in both Python and TypeScript with full session management and tool execution loops.

## Learning Objectives

- Configure and manage multi-server environments in Claude Desktop and modern AI IDEs.
- Debug JSON-RPC message exchanges, resource previews, and tool parameters using `@modelcontextprotocol/inspector`.
- Construct a full custom MCP Client in Python using `mcp.client.stdio.stdio_client` and `ClientSession`.
- Construct a full custom MCP Client in TypeScript using `@modelcontextprotocol/sdk/client`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Claude-Desktop-and-Cursor-Configuration.md](01-Claude-Desktop-and-Cursor-Configuration.md) | `claude_desktop_config.json`, Cursor/Zed setup, debugging with MCP Inspector | 1 day |
| [02-Building-Custom-MCP-Clients-in-Python.md](02-Building-Custom-MCP-Clients-in-Python.md) | Python ClientSession, stdio/SSE client connections, listing & calling tools | 1 day |
| [03-Building-Custom-MCP-Clients-in-TypeScript.md](03-Building-Custom-MCP-Clients-in-TypeScript.md) | TypeScript Client, capability exchange, session management, event listeners | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 8: Orchestration: MCP with LangChain and LangGraph](../Phase-08-Orchestration-MCP-with-LangChain-and-LangGraph/README.md)
