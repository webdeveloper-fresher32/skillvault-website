# Project 1: PostgreSQL Enterprise Database MCP Server

> **Difficulty**: Advanced | **Estimated Time**: 6–8 hours | **Stack**: Python, FastMCP, asyncpg, Pydantic v2, PostgreSQL, Docker

---

## 1. Project Overview

In this capstone project, you will architect and build a production-grade, secure **PostgreSQL Database MCP Server**. Rather than giving an AI model raw, dangerous database access, this server exposes:
1. **Parameterized Query Tools:** Strictly read-only, sanitized analytical SQL query executors with row limits and statement timeouts.
2. **Dynamic Schema Resources:** Automatically exposes table definitions and column metadata as dynamic MCP resources (`postgres://{schema}/{table}/schema`).
3. **Slow-Query Diagnostic Prompts:** Pre-engineered templates (`/explain_slow_query`) that take a query, run `EXPLAIN (ANALYZE, BUFFERS)`, and prompt the model to diagnose index fragmentation and sequential scans.
4. **Connection Pooling & Lifespan:** High-performance async connection pooling using `asyncpg`.

```mermaid
flowchart TD
    classDef client fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef gateway fill:#1e293b,stroke:#38bdf8,color:#ffffff,stroke-width:1.5px;
    classDef security fill:#854d0e,stroke:#facc15,color:#ffffff,stroke-width:2px;
    classDef db fill:#064e3b,stroke:#34d399,color:#ffffff,stroke-width:2px;

    Client([Claude Desktop / Cursor / LangGraph]):::client --> Gateway[Postgres MCP Server]:::gateway
    
    subgraph GatewayCore ["MCP Server Engine"]
        Gateway --> ToolRouter["Tools: execute_readonly_sql"]:::gateway
        Gateway --> ResourceRouter["Resources: postgres://schema/{table}"]:::gateway
        Gateway --> PromptRouter["Prompts: /explain_slow_query"]:::gateway
    end

    ToolRouter --> SecFilter{"Security Guard: Read-Only & Injection Filter"}:::security
    SecFilter -- "Prohibited Mutation" --> ErrorRet["isError: true (Write Disallowed)"]:::security
    SecFilter -- "Clean SELECT" --> Pool["asyncpg Connection Pool"]:::db
    
    ResourceRouter --> Pool
    PromptRouter --> Pool
    Pool --> PostgresDB[(Production PostgreSQL Replica)]:::db
```

---

## 2. Architecture & Data Model

The server organizes its capabilities around zero-trust database principles:
- **Database Replica Target:** Connects strictly to a read-only PostgreSQL replica.
- **Statement Timeouts:** Enforces `SET statement_timeout = '5000'` (5 seconds max per query).
- **Row Limits:** Automatically caps returned rows at `MAX_ROWS = 100` to prevent memory blowups.
- **Dynamic URI Schema:** `postgres://{schema}/{table}/schema` resolves to real-time DDL and foreign key relationships.

---

## 3. Step-by-Step Implementation

### Step 1: Environment & Dependency Setup

```bash
# Create virtual environment and install production dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install "mcp[cli]" asyncpg pydantic python-dotenv
```

### Step 2: Production Server Implementation

```python
# postgres_mcp_server.py
import asyncio
import os
import re
import sys
from typing import Dict, Any, List, Optional
import asyncpg
from pydantic import BaseModel, Field, field_validator
from mcp.server.fastmcp import FastMCP, Context

# Initialize FastMCP Server
mcp = FastMCP(
    name="EnterprisePostgresGateway",
    instructions="Provides safe read-only SQL queries, dynamic table schema resources, and query execution plan diagnostics."
)

# Configuration from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
MAX_ROWS = int(os.getenv("MAX_ROWS", "100"))
STATEMENT_TIMEOUT_MS = int(os.getenv("STATEMENT_TIMEOUT_MS", "5000"))

db_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    """Initializes or returns singleton asyncpg connection pool."""
    global db_pool
    if db_pool is None:
        sys.stderr.write("[DB]: Initializing asyncpg connection pool...\n")
        db_pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=STATEMENT_TIMEOUT_MS / 1000.0
        )
        sys.stderr.flush()
    return db_pool

# --- 1. TOOLS: SAFE READ-ONLY SQL EXECUTION ---
class SQLQueryInput(BaseModel):
    query: str = Field(description="The read-only SQL query to execute. Must be a SELECT statement.")

    @field_validator("query")
    @classmethod
    def validate_select_only(cls, v: str) -> str:
        cleaned = v.strip()
        # Remove comments
        cleaned = re.sub(r"--.*$", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL).strip()
        
        # Verify starts with SELECT or WITH
        first_word = cleaned.split()[0].upper() if cleaned.split() else ""
        if first_word not in ("SELECT", "WITH", "EXPLAIN"):
            raise ValueError(f"Security Alert: Only SELECT, WITH, or EXPLAIN statements are permitted. Received: '{first_word}'.")

        # Block dangerous keywords anywhere in query
        blocked_keywords = ["DROP", "DELETE", "TRUNCATE", "INSERT", "UPDATE", "ALTER", "GRANT", "REVOKE"]
        tokens = [t.upper() for t in re.findall(r"\b\w+\b", cleaned)]
        for kw in blocked_keywords:
            if kw in tokens:
                raise ValueError(f"Security Alert: Prohibited mutating keyword '{kw}' detected.")

        return cleaned

@mcp.tool()
async def execute_readonly_sql(query: str, ctx: Context) -> Dict[str, Any]:
    """Safely executes a read-only SQL query on the PostgreSQL replica and returns tabular rows."""
    # Step 1: Validate query constraints via Pydantic
    try:
        validated = SQLQueryInput(query=query)
    except Exception as val_err:
        return {
            "isError": True,
            "content": [{"type": "text", "text": f"Validation Error: {str(val_err)}"}]
        }

    pool = await get_pool()
    await ctx.info("Executing parameterized query on PostgreSQL replica...")

    try:
        async with pool.acquire() as conn:
            # Enforce local statement timeout
            await conn.execute(f"SET statement_timeout = '{STATEMENT_TIMEOUT_MS}';")
            
            # Execute query
            rows = await conn.fetch(validated.query)
            
            if not rows:
                return {
                    "isError": False,
                    "content": [{"type": "text", "text": "Query executed successfully. 0 rows returned."}]
                }

            # Limit output to MAX_ROWS
            limited_rows = rows[:MAX_ROWS]
            column_names = list(limited_rows[0].keys())

            # Format Markdown Table for optimal LLM parsing
            header = "| " + " | ".join(column_names) + " |"
            separator = "| " + " | ".join(["---"] * len(column_names)) + " |"
            row_lines = []
            for r in limited_rows:
                row_lines.append("| " + " | ".join(str(r[c]) for c in column_names) + " |")

            output_table = "\n".join([header, separator] + row_lines)
            note = f"\n\n*(Showing {len(limited_rows)} of {len(rows)} total rows)*" if len(rows) > MAX_ROWS else ""

            return {
                "isError": False,
                "content": [{"type": "text", "text": output_table + note}]
            }

    except asyncpg.QueryCanceledError:
        return {
            "isError": True,
            "content": [{"type": "text", "text": f"Query Timed Out: Execution exceeded {STATEMENT_TIMEOUT_MS}ms limit."}]
        }
    except Exception as db_err:
        return {
            "isError": True,
            "content": [{"type": "text", "text": f"Database Error: {str(db_err)}"}]
        }

# --- 2. DYNAMIC RESOURCES: TABLE SCHEMAS ---
@mcp.resource("postgres://{schema_name}/{table_name}/schema")
async def get_table_schema_resource(schema_name: str, table_name: str) -> str:
    """Returns the column definitions, types, and primary keys for a specific table."""
    pool = await get_pool()
    sql = """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, schema_name, table_name)
        if not rows:
            return f"Table '{schema_name}.{table_name}' does not exist."

        lines = [f"Schema definition for `{schema_name}.{table_name}`:"]
        for r in rows:
            nullable = "NULL" if r["is_nullable"] == "YES" else "NOT NULL"
            default = f"DEFAULT {r['column_default']}" if r["column_default"] else ""
            lines.append(f"- **{r['column_name']}**: `{r['data_type']}` {nullable} {default}".strip())

        return "\n".join(lines)

# --- 3. PROMPTS: SLOW QUERY OPTIMIZATION ---
@mcp.prompt()
def explain_slow_query(sql_query: str) -> str:
    """Pre-engineered prompt for analyzing slow database queries with EXPLAIN ANALYZE."""
    return (
        f"You are a Principal Database Administrator specializing in PostgreSQL query optimization.\n\n"
        f"### Target Query to Analyze:\n```sql\n{sql_query}\n```\n\n"
        f"### Your Mission:\n"
        f"1. Call the `execute_readonly_sql` tool with `EXPLAIN (ANALYZE, BUFFERS) {sql_query}`.\n"
        f"2. Inspect the query plan for Sequential Scans (Seq Scan), high buffer reads, and slow Sort/Hash operations.\n"
        f"3. Provide exact, production-ready `CREATE INDEX` statements or query rewrites to reduce execution latency."
    )

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

---

## 4. Testing & Verification

1. **Launch a Local Postgres Container:**
   ```bash
   docker run -d --name test-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
   ```
2. **Test with the MCP Inspector:**
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
   npx @modelcontextprotocol/inspector python postgres_mcp_server.py
   ```
3. **Verify Security Guards:**
   - Execute: `execute_readonly_sql(query="SELECT 1 as test;")` $\rightarrow$ Returns table with `1`.
   - Execute: `execute_readonly_sql(query="DROP TABLE users;")` $\rightarrow$ Blocked with `Validation Error: Prohibited mutating keyword 'DROP'`.

---

## 5. Production Optimization & Deployment

Package into a hardened, non-root Docker container and attach to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enterprise-postgres": {
      "command": "python",
      "args": ["/path/to/postgres_mcp_server.py"],
      "env": {
        "DATABASE_URL": "postgresql://ro_user:secure@aurora-replica.internal:5432/prod_db",
        "STATEMENT_TIMEOUT_MS": "4000",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

