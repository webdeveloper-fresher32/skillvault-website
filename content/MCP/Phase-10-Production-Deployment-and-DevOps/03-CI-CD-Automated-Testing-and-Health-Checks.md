# CI/CD, Automated Testing, and Health Checks in MCP

> "Testing an MCP server by manually typing prompts into Claude Desktop is like testing an airplane by flying passengers on it. Production reliability demands automated CI/CD test harnesses with programmatic mock clients and schema regression assertions."

---

![MCP CI/CD and Automated Testing](/images/mcp/01-mcp-architecture.jpg)

### Step 1: Why Do We Need This?

#### The Real Problem

In an enterprise environment, breaking an MCP tool contract breaks every developer's AI assistant simultaneously:
- A developer modifies a Python tool signature: changing parameter `customer_id: str` to `user_id: int`.
- Claude Desktop tries to call `customer_id` and fails with validation errors.
- A missing environment variable crashes the server on startup, causing Claude to display an alarming red error badge.
- If testing relies on engineers manually opening an IDE and typing prompts, bugs slip through into production.

#### Why Automated CI/CD & Testing Solve It

Enterprise MCP engineering requires **automated protocol testing**:
1. **Headless Protocol Testing:** Use the official MCP Client SDK inside **`pytest`** or **`Jest`** suites to test real JSON-RPC exchanges over stdio without launching any GUI.
2. **Schema Snapshot Testing:** Assert that tool descriptions and JSON Schemas do not break backward compatibility unexpectedly.
3. **Automated CI/CD Gates:** Block pull requests via GitHub Actions if handshake negotiation, tool execution, or error handling tests fail.
4. **Health Check Probes:** Expose `/healthz` and `/readyz` endpoints to verify database connections before routing agent traffic.

---

### Step 2: What Is It?

#### Simple Explanation: The Automated Crash-Test Dummy

Think of testing an MCP server like **crash-testing a vehicle**:
- You do not put real humans inside the prototype vehicle on day one (**Manual Testing in Claude**).
- You place high-tech sensor dummies inside the car and launch it down a test track into barriers under controlled laboratory conditions (**Programmatic Test Suite**).
- If the airbags deploy properly (the server handles malformed arguments and returns `isError: true` without crashing), the car passes inspection and is approved for production release (**CI/CD Pass**).

#### MCP Testing Levels

| Test Level | What It Validates | Tools Used |
| :--- | :--- | :--- |
| **Unit Tests** | Pure business logic functions independent of the protocol. | `pytest`, `vitest`, `unittest`. |
| **Protocol Integration** | Full JSON-RPC handshake, `tools/list`, and `tools/call` over stdio/SSE. | `pytest-asyncio` + official `ClientSession`. |
| **Schema Regression** | Ensures JSON Schema contracts do not drop required parameters. | Snapshot testing (`pytest-snapshot`). |
| **End-to-End Health Checks** | Validates external database and service availability. | HTTP `/healthz` and `/readyz` probes. |

---

### Step 3: Real-World Example

#### The Schema Regression Gate in GitHub Actions

A developer submits a pull request updating an internal PostgreSQL MCP server:
- The developer accidentally renamed the parameter `table_name` to `tableName`.
- **The CI Action Runs:** In 8 seconds, the GitHub Action boots the server with a headless mock client.
- **Assertion Failure:** `AssertionError: Tool 'inspect_schema' broke parameter contract! Missing property 'table_name'`.
- The PR is blocked with red status checks. The developer fixes the parameter name before 500 colleagues experience broken tools.

---

### Step 4: How Does It Work?

```text
Developer pushes git commit to Pull Request
                     │
                     ▼
       [GitHub Actions CI Runner]
                     │
       ├── 1. Run Linter (ruff / eslint)
       │
       ├── 2. Spin up in-memory Test Database (Postgres / SQLite)
       │
       ├── 3. Execute Pytest / Jest Protocol Suite
       │      - Spawn MCP server over stdio
       │      - Verify session.initialize() succeeds
       │      - Assert all expected tools exist in session.list_tools()
       │      - Test valid tool call: assert isError == False
       │      - Test invalid tool call: assert isError == True (Graceful recovery!)
       │
       ├── 4. Build Multi-Stage Docker Image
       │
       ▼
PR Approved & Merged -> Auto-Deploy to Cloud Run / Kubernetes!
```

---

### Step 5: Code Example: Pytest Suite & GitHub Actions Workflow

#### 1. Complete `test_mcp_server.py` Protocol Test Suite

```python
# test_mcp_server.py
import pytest
import pytest_asyncio
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Path to the server script under test
SERVER_SCRIPT = str(Path(__file__).parent / "server.py")

@pytest.mark.asyncio
async def test_mcp_server_lifecycle_and_tools():
    """Validates handshake, tool discovery, execution, and error handling."""
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[SERVER_SCRIPT],
        env={"TEST_MODE": "1", "PYTHONUNBUFFERED": "1"}
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # 1. Test Handshake & Version Negotiation
            init_result = await session.initialize()
            assert init_result.protocolVersion == "2024-11-05"
            assert init_result.serverInfo.name is not None
            assert "tools" in init_result.capabilities

            # 2. Test Tool Catalog Discovery
            tools_resp = await session.list_tools()
            tool_names = [t.name for t in tools_resp.tools]
            assert "calculate_tax" in tool_names
            
            # Verify parameter schema integrity
            tax_tool = next(t for t in tools_resp.tools if t.name == "calculate_tax")
            assert "amount" in tax_tool.inputSchema["properties"]
            assert "amount" in tax_tool.inputSchema["required"]

            # 3. Test Successful Tool Execution
            valid_call = await session.call_tool(
                name="calculate_tax",
                arguments={"amount": 100.0, "state": "CA"}
            )
            assert valid_call.isError is False
            assert len(valid_call.content) > 0
            assert "Total with tax: $108.25" in valid_call.content[0].text

            # 4. Test Graceful Error Handling (Negative Test)
            # Passing negative amount should trigger isError: True without crashing server
            invalid_call = await session.call_tool(
                name="calculate_tax",
                arguments={"amount": -50.0, "state": "CA"}
            )
            assert invalid_call.isError is True
            assert "must be positive" in invalid_call.content[0].text.lower()

            # 5. Test Server Remains Alive After Error
            alive_check = await session.call_tool(
                name="calculate_tax",
                arguments={"amount": 200.0, "state": "NY"}
            )
            assert alive_check.isError is False
```

#### 2. Production GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/mcp-ci.yml
name: MCP Production CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-verify:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpassword
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run MCP Protocol Automated Tests
        env:
          DATABASE_URL: "postgresql://testuser:testpassword@localhost:5432/testdb"
          PYTHONUNBUFFERED: "1"
        run: |
          pytest test_mcp_server.py -v --cov=server --cov-report=term-missing

      - name: Build Hardened Docker Container
        run: |
          docker build -t mcp-server:latest -f Dockerfile .

      - name: Smoke Test Sandboxed Docker Container
        run: |
          # Verify container executes and outputs valid JSON-RPC
          echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | \
            docker run -i --rm --read-only --network none mcp-server:latest
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Flaky Async Event Loops in Pytest** | Tests hang when running multiple async fixtures sequentially. | Set `pytest_plugins = ('pytest_asyncio',)` and scope event loops with `@pytest_asyncio.fixture(loop_scope="function")`. |
| **Testing Long-Running Tools** | Tools with 30-second timeouts slow down CI pipelines to a crawl. | Introduce a mock time multiplier or dependency injection flags (`TEST_SPEED_MULTIPLIER=100`) for unit test runs. |
| **Schema Snapshot Drift** | Unintentional schema modifications pass unnoticed in unit tests. | Use `pytest-snapshot` to record canonical JSON Schemas and trigger git diff errors if any tool signature changes. |
| **Health Check Endpoint Liveness** | Container runs, but database connection died 10 minutes ago. | Implement a `/readyz` probe that executes `SELECT 1` on the database pool; return HTTP 503 if the database is unreachable. |

---

### Step 7: Quick Revision

- Automated protocol testing with **`pytest-asyncio`** and a headless **`ClientSession`** catches bugs before deployment.
- Always write negative test cases: verify that passing malformed inputs yields **`isError: True`** and leaves the server alive.
- Prevent breaking changes by asserting against **schema snapshots** in CI pipelines.
- Automate testing on every pull request using **GitHub Actions** with service containers (PostgreSQL, Redis).
- Provide distinct **`/healthz`** (liveness) and **`/readyz`** (database readiness) endpoints for Kubernetes and Cloud Run.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    GitPush["Git Push / PR Opened"]:::startStyle --> GHActions["GitHub Actions CI Runner"]:::nodeStyle
    
    subgraph TestSuite ["Automated Test Matrix"]
        GHActions --> LintStep["Code Style & Type Checking (Ruff / MyPy)"]:::actionStyle
        LintStep --> MockClient["Headless Stdio Client Test (pytest-asyncio)"]:::nodeStyle
        
        MockClient --> TestHandshake{"1. Handshake Valid?"}:::decision
        TestHandshake -- "No" --> FailPR["Block PR & Alert Developer"]:::errorStyle
        TestHandshake -- "Yes" --> TestSchema{"2. Schema Unbroken?"}:::decision
        
        TestSchema -- "No" --> FailPR
        TestSchema -- "Yes" --> TestExec{"3. Valid & Error Tool Calls Pass?"}:::decision
        TestExec -- "No" --> FailPR
        TestExec -- "Yes" --> DockerBuild["4. Multi-Stage Docker Build & Scan"]:::actionStyle
    end

    DockerBuild --> DeployProd["Approved: Auto-Deploy to Production!"]:::startStyle

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef actionStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef decision fill:#854d0e,stroke:#facc15,stroke-width:2px,color:#ffffff;
    classDef errorStyle fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

1. How do you test an MCP server without manually opening Claude Desktop or Cursor?
   - A) You cannot test it without an AI
   - B) By using the official MCP Client SDK inside automated test frameworks like `pytest` or `Jest` over a headless stdio pipe
   - C) By printing the code on paper
   - D) By looking at the code for 5 minutes

2. What should a negative test case verify when passing invalid arguments to an MCP tool?
   - A) That the server reboots
   - B) That the server returns a `CallToolResult` with `isError: True` and an explanatory message, remaining alive for subsequent calls
   - C) That the operating system deletes the file
   - D) That an exception crashes the process

3. What is the difference between a `/healthz` liveness probe and a `/readyz` readiness probe in Kubernetes?
   - A) There is no difference
   - B) Liveness checks if the process is running; Readiness checks if the server is ready to accept traffic (e.g. database pool is connected)
   - C) Liveness costs money while readiness is free
   - D) Readiness runs only on Sundays

4. Why is schema snapshot testing valuable in an enterprise MCP CI/CD pipeline?
   - A) To detect accidental breaking changes to tool parameter names or required fields before they reach developers
   - B) To take photos of the server
   - C) To speed up Python compilation
   - D) To reduce image sizes

*Submit your answers (e.g. 1-B, 2-B, 3-B, 4-A) to verify your score!*

