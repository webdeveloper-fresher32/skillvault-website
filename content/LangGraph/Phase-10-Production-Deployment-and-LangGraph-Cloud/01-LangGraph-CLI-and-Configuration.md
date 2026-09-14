# LangGraph CLI and Configuration — Complete Guide

> "An architect's blueprint manifest specifies every structural load, pipe dimension, and electrical conduit before construction begins, allowing any engineering team to build the identical skyscraper anywhere in the world."

---

## Table of Contents

1. [The Problem: Moving from Local Python Scripts to Production Services](#1-the-problem-moving-from-local-python-scripts-to-production-services)
2. [The Architectural Blueprint Manifest Analogy](#2-the-architectural-blueprint-manifest-analogy)
3. [The Mechanism: The langgraph.json Manifest and CLI Tooling](#3-the-mechanism-the-langgraphjson-manifest-and-cli-tooling)
4. [Diagram: LangGraph CLI Local Development and Build Flow](#4-diagram-langgraph-cli-local-development-and-build-flow)
5. [Code Walkthrough: Production langgraph.json and Project Setup](#5-code-walkthrough-production-langgraphjson-and-project-setup)
6. [Comparing Raw Python Scripts vs LangGraph CLI Projects](#6-comparing-raw-python-scripts-vs-langgraph-cli-projects)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Moving from Local Python Scripts to Production Services

Running graphs via `python agent.py` works on a developer's laptop, but lacks HTTP API endpoints, background task workers, streaming protocols, and container packaging required for cloud infrastructure.

### The Prototype vs Production Gap

```text
Local Script (python agent.py):
  - Requires manual terminal execution.
  - No standardized REST or SSE streaming API.
  - No automatic hot-reloading or web visualization.

LangGraph CLI Service (langgraph dev):
  - Spawns local production-grade FastAPI server with full REST/SSE APIs.
  - Integrates automatically with LangGraph Studio GUI.
  - Auto-reloads code changes on file save!
```

### The Solution: The LangGraph CLI and `langgraph.json`

The LangGraph CLI provides standardized commands (`langgraph dev`, `langgraph build`) driven by a declarative `langgraph.json` project manifest.

---

## 2. The Architectural Blueprint Manifest Analogy

A construction contractor does not build a 50-story commercial tower from verbal descriptions or ad-hoc sketches.

### Ad-Hoc Sketches vs Standardized Blueprint

```text
Verbal Description → Electrician wires outlets arbitrarily; plumber places pipes in elevator shaft
                     (Chaos, unmaintainable, safety hazard).

Standard Blueprint → Specifies exact structural coordinate grid, duct dimensions, and fire exits.
                     Any certified crew builds the exact same compliant building reliably.
```

### Mapping to LangGraph

The blueprint is `langgraph.json`; the construction crew is `langgraph dev` / `langgraph build`; the skyscraper is the deployed agent API server.

---

## 3. The Mechanism: The langgraph.json Manifest and CLI Tooling

The root `langgraph.json` file declares your graphs, dependencies, and environment files.

### Standard `langgraph.json` Schema

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent.py:graph",
    "research_team": "./src/teams/research.py:research_graph"
  },
  "env": ".env",
  "python_version": "3.11"
}
```

### Key CLI Commands

- `langgraph dev`: Starts local development server with Studio GUI support.
- `langgraph build -t my-agent-app`: Compiles application into an optimized Docker container image.
- `langgraph up`: Starts local Dockerized background services (Postgres, Redis, API).

---

## 4. Diagram: LangGraph CLI Local Development and Build Flow

### Development & Containerization Flow

```text
Developer writes: `src/agent.py` + `langgraph.json`
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Command: `langgraph dev`                                    │
│   ├── Spawns Local API Server at http://localhost:2024       │
│   ├── Launches Local LangGraph Studio Web UI                │
│   └── Watches files for instant Hot-Reloading               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (When ready for production)
┌─────────────────────────────────────────────────────────────┐
│ Command: `langgraph build -t enterprise-agent:v1.0`         │
│   └── Outputs OCI-compliant production Docker image         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production langgraph.json and Project Setup

A complete production project structure and graph definition ready for the LangGraph CLI:

```python
# src/customer_support_graph.py
from typing import TypedDict, Annotated
import operator
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END

llm = ChatOpenAI(model="gpt-4o", temperature=0)

def support_agent_node(state: MessagesState) -> dict:
    sys_msg = {"role": "system", "content": "You are a tier-1 customer support agent."}
    msgs = [sys_msg] + list(state["messages"])
    response = llm.invoke(msgs)
    return {"messages": [response]}

# Define and compile graph instance
builder = StateGraph(MessagesState)
builder.add_node("agent", support_agent_node)
builder.add_edge(START, "agent")
builder.add_edge("agent", END)

# Export the compiled graph object for langgraph.json to discover!
graph = builder.compile()
```

```json
// langgraph.json (Placed at project root)
{
  "dependencies": ["."],
  "graphs": {
    "support_bot": "./src/customer_support_graph.py:graph"
  },
  "env": ".env",
  "python_version": "3.11"
}
```

```bash
# Terminal execution:
# 1. Install CLI
pip install "langgraph-cli[inmem]"

# 2. Run local development server
langgraph dev
# Output: Server running on http://127.0.0.1:2024
# LangGraph Studio UI available at https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

---

## 6. Comparing Raw Python Scripts vs LangGraph CLI Projects

| Feature | Raw Python Script (`python app.py`) | LangGraph CLI (`langgraph dev`) |
|---|---|---|
| API Endpoints | None (Must manually code FastAPI routes) | Auto-generated REST & SSE streaming routes |
| Studio Integration | Not available | 1-click visual step-through debugging |
| Hot Reloading | Manual script restarts | Automatic on file save |
| Multi-Graph Support | Ad-hoc routing logic | Multiple graphs declared in `langgraph.json` |
| Container Packaging | Custom Dockerfile maintenance | Automated via `langgraph build` |

---

## 7. Common Mistakes

- **Incorrect graph export path syntax.** The graph identifier in `langgraph.json` must follow `./path/to/file.py:variable_name`.
- **Exporting uncompiled `StateGraph` builder.** `langgraph.json` requires a *compiled* graph (`graph = builder.compile()`).
- **Missing environment variables in `.env`.** The CLI reads `.env` automatically; missing `OPENAI_API_KEY` causes startup failure.
- **Forgetting dependencies array.** Ensure `"dependencies": ["."]` is declared so local package modules are installed in the container environment.
- **Port collisions.** If port 2024 is already occupied by another service, use `langgraph dev --port 2025`.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a project directory with `langgraph.json` and a minimal 2-node graph.

**Exercise 2:** Run `langgraph dev` and test the auto-generated HTTP `/threads` and `/runs/stream` endpoints via curl.

**Exercise 3:** Declare 2 distinct graphs (`"sales_bot"` and `"support_bot"`) in `langgraph.json` and verify both load.

**Exercise 4:** Modify Python source code while `langgraph dev` is running and verify auto-reload functionality.

**Exercise 5:** Run `langgraph build -t test-agent:latest` and inspect the generated Docker image with `docker images`.

---

## 9. Interview Q&A

**Q: What is the purpose of `langgraph.json`?**
`langgraph.json` is the standardized configuration manifest for LangGraph projects. It declares the entry points for compiled graphs, Python dependencies, environment files, and runtime settings, enabling the LangGraph CLI, LangGraph Studio, and LangGraph Cloud to package and serve graphs automatically.

**Q: What does the `langgraph dev` command do?**
`langgraph dev` boots a local asynchronous development server (running on port 2024) that exposes standardized REST and SSE streaming endpoints for all graphs declared in `langgraph.json`. It provides hot-reloading on code changes and connects seamlessly to the local LangGraph Studio web interface.

**Q: How does `langgraph build` simplify containerization?**
`langgraph build` inspects `langgraph.json`, generates an optimized multi-stage Dockerfile containing all required dependencies, system libraries, and server configurations, and builds a production-ready OCI container image without requiring manual Dockerfile maintenance.

**Q: Can a single `langgraph.json` manifest expose multiple independent graphs?**
Yes. Under the `"graphs"` key, you can map multiple graph names to different file paths (e.g. `{"triage": "./src/triage.py:graph", "billing": "./src/billing.py:graph"}`).

**Q: How does the LangGraph server handle concurrency and thread execution?**
The LangGraph server manages an asynchronous task queue with background worker execution, handling thread locks to prevent race conditions during concurrent runs on the same `thread_id`.
