# Phase 8: Orchestration: MCP with LangChain and LangGraph

## What You'll Learn

Bridge the Model Context Protocol directly into the modern agentic AI orchestration ecosystem. Convert MCP servers into LangChain `BaseTool` toolkits, plug distributed MCP tools into LangGraph cyclic state graphs using `ToolNode`, and implement dynamic runtime tool discovery, namespace isolation, and failover recovery across multiple heterogeneous MCP servers.

## Learning Objectives

- Bridge MCP tool definitions into LangChain 1.x `StructuredTool` and `BaseTool` classes.
- Construct LangGraph cyclic ReAct workflows where `ToolNode` routes calls dynamically to external MCP servers.
- Architect multi-server routing topologies where agents discover tools across database, filesystem, and API servers.
- Implement error isolation and automatic tool failover policies in agentic execution loops.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-LangChain-MCP-Adapters-and-Tool-Bridging.md](01-LangChain-MCP-Adapters-and-Tool-Bridging.md) | LangChain MCP adapters, converting MCP tools to `BaseTool`, dynamic loading | 1 day |
| [02-LangGraph-Multi-Agent-Workflows-with-MCP.md](02-LangGraph-Multi-Agent-Workflows-with-MCP.md) | LangGraph `ToolNode` with MCP, stateful cyclic graphs, persistence | 1 day |
| [03-Dynamic-Tool-Discovery-and-Agent-Execution.md](03-Dynamic-Tool-Discovery-and-Agent-Execution.md) | Dynamic capability discovery, multi-server routing, error recovery & failovers | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Enterprise MCP Gateways and Routing](../Phase-09-Enterprise-MCP-Gateways-and-Routing/README.md)

