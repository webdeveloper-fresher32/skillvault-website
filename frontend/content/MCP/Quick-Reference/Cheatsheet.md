# Model Context Protocol (MCP) Quick Reference Cheatsheet

A concise, high-density syntax, wire-format, and architectural quick reference for building, configuring, and securing MCP systems.

---

## 1. JSON-RPC 2.0 Wire Protocol Envelopes

### Request (Expects Response)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": { "sql": "SELECT 1;" }
  }
}
```

### Success Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Result rows..." }],
    "isError": false
  }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: 'sql' argument missing."
  }
}
```

### Notification (One-Way, No `id`)
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": { "uri": "postgres://schema/orders" }
}
```

---

## 2. Python FastMCP Quick Syntax

```python
from mcp.server.fastmcp import FastMCP, Context
from pydantic import BaseModel, Field

mcp = FastMCP("MyServer")

# Tool with Pydantic Schema & Context
@mcp.tool()
async def process_data(item_id: str, count: int = 1, ctx: Context = None) -> str:
    """Processes item with progress updates."""
    await ctx.info(f"Processing {item_id}...")
    await ctx.report_progress(50, 100)
    return f"Processed {count} of {item_id}"

# Dynamic Resource Template
@mcp.resource("data://items/{item_id}")
def get_item_resource(item_id: str) -> str:
    """Read-only context resource."""
    return f"Details for item: {item_id}"

# Prompt Template (Slash Command)
@mcp.prompt()
def review_item(item_id: str) -> str:
    return f"Please review item {item_id} for quality compliance."

if __name__ == "__main__":
    mcp.run(transport="stdio")  # or transport="sse"
```

---

## 3. TypeScript SDK Quick Syntax

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "MyTSServer", version: "1.0.0" });

// Tool with Zod Schema
server.tool(
  "calculate_discount",
  "Calculates discounted total price.",
  {
    price: z.number().positive().describe("Base price in USD"),
    discountPct: z.number().min(0).max(100).default(10).describe("Percentage discount")
  },
  async ({ price, discountPct }) => ({
    content: [{ type: "text", text: `Discounted: $${(price * (1 - discountPct / 100)).toFixed(2)}` }]
  })
);

// Dynamic Resource
server.resource(
  "user-profile",
  new ResourceTemplate("users://{id}/profile", { list: undefined }),
  { mimeType: "application/json" },
  async (uri, { id }) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ userId: id }) }]
  })
);

// Connect Stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 4. Host Client Configuration Schema (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "local-python-tool": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "PYTHONUNBUFFERED": "1",
        "DATABASE_URL": "postgresql://..."
      }
    },
    "local-node-tool": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    },
    "remote-cloud-tool": {
      "url": "https://mcp-gateway.corp.com/sse",
      "headers": {
        "Authorization": "Bearer eyJhbGciOi..."
      }
    },
    "docker-sandboxed-tool": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--read-only",
        "--cap-drop=ALL", "--network", "none",
        "mcp/my-server:latest"
      ]
    }
  }
}
```

---

## 5. Standard CLI & Debugging Commands

```bash
# Launch interactive web UI inspector for visual debugging
npx @modelcontextprotocol/inspector python server.py
npx @modelcontextprotocol/inspector node dist/index.js

# Test stdio server raw ping via pipe
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | python server.py

# Tail Claude Desktop diagnostic error logs (macOS)
tail -f ~/Library/Logs/Claude/mcp*.log

# Tail Claude Desktop diagnostic error logs (Windows)
Get-Content -Path "$env:APPDATA\Claude\Logs\mcp*.log" -Wait
```

---

## 6. Standard JSON-RPC 2.0 Error Codes

| Code | Constant | Meaning |
| :--- | :--- | :--- |
| **`-32700`** | `PARSE_ERROR` | Invalid JSON received by the server. |
| **`-32600`** | `INVALID_REQUEST` | The JSON sent is not a valid JSON-RPC 2.0 object. |
| **`-32601`** | `METHOD_NOT_FOUND` | The requested method does not exist or is not available. |
| **`-32602`** | `INVALID_PARAMS` | Invalid method parameter(s) (schema validation failed). |
| **`-32603`** | `INTERNAL_ERROR` | Internal JSON-RPC error. |
| **`-32000` to `-32099`**| `SERVER_ERROR` | Reserved for implementation-defined server errors. |

