# Claude Desktop and Cursor Configuration

> "Before an MCP server can power your day-to-day workflow, your host applications must know where it lives, how to launch it, and what secrets to provide. Mastering client configuration and the MCP Inspector is the key to painless developer adoption."

---

![Client Configuration and MCP Inspector](/images/mcp/01-mcp-architecture.jpg)

### Step 1: Why Do We Need This?

#### The Real Problem

You have built a stellar MCP server in Python or TypeScript. Now you want to use it inside Claude Desktop, Cursor, Zed, or Sourcegraph Cody:
- Where do the configuration files live on macOS, Linux, and Windows?
- How do you pass API keys, database credentials, and workspace paths without baking them into code?
- If the server fails to start, how do you debug it without opening 10 terminal windows? (Standard desktop GUI apps swallow stderr output!)

#### Why Standardized Host Configuration Solves It

The MCP ecosystem has converged on a clean, standardized configuration format:
- **`claude_desktop_config.json`:** The gold standard configuration schema adopted across Anthropic Claude Desktop, Cursor, and emerging AI tools.
- **Environment Injection:** Pass secrets safely via the `env` dictionary so credentials never touch disk or Git repositories.
- **The Official MCP Inspector:** A dedicated web UI (`npx @modelcontextprotocol/inspector`) that runs your server in isolation, letting you test tools, view resources, and inspect JSON-RPC messages interactively before attaching to a host.

---

### Step 2: What Is It?

#### Simple Explanation: The Plug-and-Play Device Manager

Think of `claude_desktop_config.json` like the **Device Manager on your computer**:
- It lists every peripheral plugged into your system.
- For each device, it specifies the driver executable (`command`), startup switches (`args`), and power requirements (`env`).
- If a device malfunctions, the **MCP Inspector** is your digital multimeter: you clip it onto the wires, press test buttons, and read the exact voltage (JSON-RPC packets).

#### Configuration File Locations

| Operating System | Claude Desktop Path | Cursor Path |
| :--- | :--- | :--- |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.cursor/mcp.json` or `.cursor/mcp.json` (workspace) |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` | `%USERPROFILE%\.cursor\mcp.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` | `~/.config/Cursor/mcp.json` |

---

### Step 3: Real-World Example

#### The Full-Stack Polyglot Developer Setup

A senior engineer configures their local development environment with three distinct MCP servers:
1. **Local Filesystem:** Access to project directories (`@modelcontextprotocol/server-filesystem`).
2. **PostgreSQL Analytics:** Querying local Docker database via Python FastMCP.
3. **Remote Cloud GitHub:** Connecting to company GitHub via remote SSE.

---

### Step 4: How Does It Work?

```text
Claude Desktop / Cursor Starts Up
          │
          ▼
   [Reads claude_desktop_config.json]
          │
    ┌─────┴─────────────────────────────────┐
    ▼                                       ▼
stdio Server (Local Subprocess)         SSE Server (Remote HTTP)
    │                                       │
Spawn: command + args                   HTTP GET: url + headers
Inject: env dictionary                  Open text/event-stream
    │                                       │
    └──────────────────┬────────────────────┘
                       ▼
         [Perform initialize Handshake]
         [Fetch tools/list, resources/list]
                       ▼
      Populate UI Hammer Icon & Tool Menu!
```

---

### Step 5: Configuration & Tooling Examples

#### 1. Complete `claude_desktop_config.json` Specification

```json
{
  "mcpServers": {
    "local-filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/alice/projects/SkillVault-website"
      ]
    },
    "enterprise-postgres": {
      "command": "python3",
      "args": ["/Users/alice/mcp-servers/postgres_server.py"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:secret123@localhost:5432/production_analytics",
        "POOL_SIZE": "10",
        "PYTHONUNBUFFERED": "1"
      }
    },
    "cloud-jira-gateway": {
      "url": "https://mcp-gateway.corp.internal/sse",
      "headers": {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    },
    "sandboxed-sqlite": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--read-only",
        "-v", "/Users/alice/data:/data:ro",
        "mcp/sqlite-server:latest",
        "/data/app.db"
      ]
    }
  }
}
```

#### 2. Visual Debugging with the MCP Inspector

The official MCP Inspector provides an interactive developer GUI for testing servers before integrating them into desktop hosts:

```bash
# Test a Node.js / TypeScript MCP server:
npx @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-postgres "postgresql://localhost/mydb"

# Test a Python FastMCP server:
npx @modelcontextprotocol/inspector python server.py
```

- Launches a local web server at `http://localhost:5173`.
- Displays real-time tabs for **Tools** (test inputs and see outputs), **Resources** (browse schemas), **Prompts** (preview templates), and **Protocol Notifications**.
- Shows raw incoming/outgoing JSON-RPC message logs with timing breakdowns.

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Missing PATH in Desktop GUI** | Server works in terminal, but Claude Desktop fails with `command not found: node`. | GUI apps on macOS do not inherit `.zshrc` PATH. Use absolute paths (`/usr/local/bin/node` or `/opt/homebrew/bin/python3`). |
| **Python stdout Buffering** | FastMCP server produces no output; host times out during handshake. | Set environment variable `"PYTHONUNBUFFERED": "1"` in the config's `env` block. |
| **Silent Startup Failures** | Host shows server in red with generic "Failed to connect" error. | Inspect the Claude Desktop diagnostic logs: on macOS, check `tail -f ~/Library/Logs/Claude/mcp*.log`. |
| **Multi-Workspace Cursor Config** | Different repos require different database credentials. | Use project-local `.cursor/mcp.json` files checked into repository root instead of the global user profile. |

---

### Step 7: Quick Revision

- Host applications configure servers via **`claude_desktop_config.json`** or **`.cursor/mcp.json`**.
- Local servers configure **`command`**, **`args`**, and **`env`**; remote servers configure **`url`** and **`headers`**.
- Always use **absolute binary paths** (`/opt/homebrew/bin/node`) if desktop GUI apps fail to resolve your shell PATH.
- Always set **`PYTHONUNBUFFERED="1"`** for Python servers to ensure JSON-RPC lines flush immediately.
- Use **`npx @modelcontextprotocol/inspector`** to visually debug tools, inspect schemas, and view raw JSON-RPC traffic.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    Config["claude_desktop_config.json"]:::nodeStyle --> HostBoot["Claude Desktop / Cursor Boot"]:::nodeStyle
    
    HostBoot --> ParseConfig{"Valid JSON Schema?"}:::decision
    ParseConfig -- "No (Syntax Error)" --> LogErr["Write to ~/Library/Logs/Claude/mcp.log"]:::errorStyle
    
    ParseConfig -- "Yes" --> LaunchType{"Transport Type?"}:::decision
    LaunchType -- "command (stdio)" --> SpawnChild["Spawn Subprocess with absolute binary & env"]:::actionStyle
    LaunchType -- "url (SSE)" --> ConnectHTTP["Connect to https://.../sse with headers"]:::actionStyle
    
    SpawnChild --> Handshake{"Initialize Handshake"}:::decision
    ConnectHTTP --> Handshake
    
    Handshake -- "Failed" --> ShowRedPill["UI: Server Offline (Check Inspector)"]:::errorStyle
    Handshake -- "Success" --> ShowHammer["UI: Active Tool Hammer Icon Ready!"]:::startStyle

    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decision fill:#854d0e,stroke:#facc15,stroke-width:2px,color:#ffffff;
    classDef errorStyle fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#ffffff;
    classDef actionStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

1. Why does an MCP server that works in terminal sometimes fail to start inside Claude Desktop on macOS?
   - A) Because Claude does not like Python
   - B) Because macOS desktop GUI applications do not automatically inherit shell environment PATH variables from `.zshrc`
   - C) Because Claude requires an internet connection
   - D) Because of daylight saving time

2. What tool allows developers to interactively test MCP tools and inspect JSON-RPC messages in a browser GUI?
   - A) Wireshark
   - B) `@modelcontextprotocol/inspector`
   - C) Postman
   - D) Docker Desktop

3. What Python environment variable must be enabled in `claude_desktop_config.json` to prevent output buffering from freezing the stdio stream?
   - A) `DEBUG=TRUE`
   - B) `PYTHONUNBUFFERED=1`
   - C) `PYTHONDONTWRITEBYTECODE=1`
   - D) `FAST=1`

4. Where are Claude Desktop MCP error logs located on macOS?
   - A) `/tmp/log`
   - B) `~/Library/Logs/Claude/mcp*.log`
   - C) `/var/log/syslog`
   - D) In the Trash can

*Submit your answers (e.g. 1-B, 2-B, 3-B, 4-B) to verify your score!*

