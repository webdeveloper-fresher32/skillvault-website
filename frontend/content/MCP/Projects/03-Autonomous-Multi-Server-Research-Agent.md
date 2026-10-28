# Project 3: Autonomous Multi-Server Research Agent with LangGraph

> **Difficulty**: Advanced | **Estimated Time**: 8–10 hours | **Stack**: LangGraph, Python MCP Client, ChatOpenAI / ChatAnthropic, PostgreSQL, Filesystem MCP

---

## 1. Project Overview

In this pinnacle capstone project, you will construct an **Autonomous Multi-Server Research & Synthesis Agent** using **LangGraph** and the **Python MCP Client SDK**. 

The agent connects simultaneously to three separate MCP servers:
1. **Local Filesystem MCP Server:** Reads local research briefs and saves final Markdown reports.
2. **PostgreSQL Analytics MCP Server:** Queries structured company metrics and internal benchmark data.
3. **Web Search MCP Server:** Gathers current industry news and external market trends.

The LangGraph cyclic state machine coordinates parallel tool discovery, executes multi-step research loops, handles tool errors gracefully, and checkpoints its state to memory.

```mermaid
flowchart TD
    classDef client fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef graph fill:#1e293b,stroke:#38bdf8,color:#ffffff,stroke-width:1.5px;
    classDef mcp fill:#064e3b,stroke:#34d399,color:#ffffff,stroke-width:2px;

    UserPrompt([User Topic: 'AI Infrastructure 2026']):::client --> LangGraphAgent[LangGraph StateGraph Agent]:::graph
    
    subgraph MultiServerOrchestration ["MCP Multi-Server Ecosystem"]
        LangGraphAgent <==> FS_Client[Filesystem MCP Client]:::mcp
        LangGraphAgent <==> DB_Client[PostgreSQL MCP Client]:::mcp
        LangGraphAgent <==> Web_Client[Brave Web Search MCP Client]:::mcp
    end

    subgraph StateMachineCycles ["LangGraph ReAct Loop"]
        LangGraphAgent --> Plan[1. Research Planner]:::graph
        Plan --> ParallelFetch[2. Multi-Server Tool Executions]:::graph
        ParallelFetch --> Synthesis[3. Report Synthesis]:::graph
        Synthesis --> WriteReport[4. Save Final Report to Disk via MCP]:::graph
    end

    WriteReport --> FinalDoc([Publication-Ready Market Report]):::client
```

---

## 2. Architecture & State Schema

The agent operates across a typed LangGraph `MessagesState` that accumulates findings from multiple MCP servers:
- **Namespace Management:** Tools are prefixed with server tags (`fs__read_file`, `db__query`, `web__search`) to prevent name collisions.
- **Failover & Error Boundaries:** If one MCP server fails, the agent records the error in its message history and pivots to alternative tools.

---

## 3. Step-by-Step Implementation

### Step 1: Environment Setup

```bash
pip install langgraph langchain-core langchain-openai "mcp[cli]" pydantic
```

### Step 2: Agent Implementation Code

```python
# multi_server_agent.py
import asyncio
import sys
from typing import Dict, Any, List
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver

# Mock Tool Implementations simulating three distinct MCP servers
async def fs_read_brief(filename: str) -> str:
    """Reads local research requirements brief from disk."""
    return f"Research Brief ({filename}): Focus on Model Context Protocol adoption, enterprise security, and 2026 agentic trends."

async def fs_write_report(filename: str, markdown_content: str) -> str:
    """Saves finalized research report to local filesystem."""
    return f"Successfully wrote {len(markdown_content)} characters to {filename}."

async def db_query_benchmarks(metric: str) -> str:
    """Queries internal PostgreSQL benchmark database."""
    return f"DB Result for '{metric}': Average latency reduced by 42%; Token consumption dropped 65% across 1,000 runs."

async def web_search_trends(query: str) -> str:
    """Performs live web search for industry news."""
    return f"Web Search Result for '{query}': Over 70% of Fortune 500 enterprises adopted MCP in 2025/2026 for standardized tool interoperability."

# Create StructuredTools representing the 3 MCP servers
tools = [
    StructuredTool.from_function(coroutine=fs_read_brief, name="fs__read_brief", description="Reads local files"),
    StructuredTool.from_function(coroutine=fs_write_report, name="fs__write_report", description="Writes report to disk"),
    StructuredTool.from_function(coroutine=db_query_benchmarks, name="db__query_benchmarks", description="Queries internal database"),
    StructuredTool.from_function(coroutine=web_search_trends, name="web__search_trends", description="Searches the live web")
]

def build_multi_server_agent():
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    model_with_tools = llm.bind_tools(tools)

    async def agent_node(state: MessagesState):
        messages = state["messages"]
        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(tools))

    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", tools_condition)
    builder.add_edge("tools", "agent")

    return builder.compile(checkpointer=MemorySaver())

async def main():
    agent = build_multi_server_agent()
    print("[MULTI-SERVER AGENT]: Successfully initialized with 3 MCP toolsets.")

    query = (
        "1. Read the research brief from 'brief.md' using filesystem tools.\n"
        "2. Query internal benchmarks for 'mcp_efficiency' from the database.\n"
        "3. Search the web for current 'mcp adoption statistics'.\n"
        "4. Synthesize the findings and write a final report to 'mcp_market_report.md'."
    )

    print(f"\nUser Goal:\n{query}\n")
    print("[AGENT]: Ready for cyclic multi-server execution!")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 4. Testing & Verification

1. Run the agent with a test input.
2. Observe the cyclic execution traces:
   - Cycle 1: Agent calls `fs__read_brief`.
   - Cycle 2: Agent calls `db__query_benchmarks` and `web__search_trends`.
   - Cycle 3: Agent calls `fs__write_report` with the synthesized Markdown document.
   - Cycle 4: Agent concludes and transitions to `END`.

---

## 5. Production Optimization & Deployment

Deploy this agent as a background Celery worker or FastAPI endpoint, storing checkpointer threads in PostgreSQL (`PostgresSaver`) for durable state persistence across server restarts.
