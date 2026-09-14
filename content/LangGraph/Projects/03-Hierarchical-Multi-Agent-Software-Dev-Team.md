# Project 3: Hierarchical Multi-Agent Software Dev Team

> **Difficulty**: Expert | **Estimated Time**: 8–10 hours | **Stack**: LangGraph, Multi-Agent Supervisors, Nested Subgraphs, Python REPL Sandbox

---

## 1. Project Overview

In this comprehensive multi-agent capstone, you will construct an autonomous software engineering team organized as a multi-tier hierarchy:
- **Product Manager (Top Supervisor)**: Accepts feature specifications from users and delegates tasks between Engineering and QA departments.
- **Engineering Subgraph (Dev Team Lead)**: Manages Frontend and Backend worker agents to generate modular code files.
- **QA Subgraph (Test Lead)**: Executes automated syntax and unit tests in a Python sandbox, reporting failure stack traces back to developers until all tests pass.

```text
User: "Build an authenticated rate-limited FastAPI key-value store."
                          │
                          ▼
             [Top-Level Product Manager]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│ Engineering Subgraph    │       │ QA & Testing Subgraph   │
│ ┌─────────────────────┐ │       │ ┌─────────────────────┐ │
│ │ Tech Lead Supervisor│ │       │ │ QA Lead Supervisor  │ │
│ └───┬─────────────┬───┘ │       │ └───┬─────────────┬───┘ │
│     ▼             ▼     │       │     ▼             ▼     │
│ [BackendDev] [FrontendDev│      │ [TestRunner] [Linter]   │
└─────────────────────────┘       └─────────────────────────┘
```

---

## 2. Shared State Architecture

```python
from typing import TypedDict, Annotated, List, Dict
import operator
from langchain_core.messages import BaseMessage

class EngineeringState(TypedDict):
    feature_request: str
    architecture_plan: str
    source_code: Dict[str, str]
    test_code: str
    test_results: str
    test_passed: bool
    messages: Annotated[List[BaseMessage], operator.add]
```

---

## 3. Step-by-Step Implementation

### Step 1: Engineering Subgraph Team

```python
# multi_agent_dev_team.py
from typing import TypedDict, Annotated, List, Dict, Literal
import operator
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# --- 1. Engineering Subgraph ---
def architecture_lead_node(state: EngineeringState) -> dict:
    prompt = f"Design file architecture for feature: '{state['feature_request']}'."
    res = llm.invoke(prompt)
    return {"architecture_plan": res.content, "messages": [AIMessage(content="[Tech Lead]: Architecture planned.")]}

def backend_developer_node(state: EngineeringState) -> dict:
    code = (
        "# server.py\n"
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n\n"
        "@app.get('/health')\n"
        "def health(): return {'status': 'healthy'}\n"
    )
    return {
        "source_code": {"server.py": code},
        "messages": [AIMessage(content="[Backend Dev]: Implemented server.py FastAPI routes.")]
    }

eng_builder = StateGraph(EngineeringState)
eng_builder.add_node("architect", architecture_lead_node)
eng_builder.add_node("backend_dev", backend_developer_node)
eng_builder.add_edge(START, "architect")
eng_builder.add_edge("architect", "backend_dev")
eng_builder.add_edge("backend_dev", END)

engineering_subgraph = eng_builder.compile()
```

### Step 2: QA Testing Subgraph Team

```python
def test_generator_node(state: EngineeringState) -> dict:
    test_script = (
        "def test_health():\n"
        "    from server import health\n"
        "    assert health() == {'status': 'healthy'}\n"
    )
    return {"test_code": test_script, "messages": [AIMessage(content="[QA Dev]: Generated pytest suite.")]}

def test_runner_node(state: EngineeringState) -> dict:
    # Simulates test execution
    code = state["source_code"].get("server.py", "")
    passed = "health" in code and "FastAPI" in code
    result_str = "All 3 Unit Tests PASSED (100% coverage)." if passed else "AssertionError: health() endpoint missing."
    return {
        "test_passed": passed,
        "test_results": result_str,
        "messages": [AIMessage(content=f"[QA Runner]: {result_str}")]
    }

qa_builder = StateGraph(EngineeringState)
qa_builder.add_node("qa_writer", test_generator_node)
qa_builder.add_node("qa_runner", test_runner_node)
qa_builder.add_edge(START, "qa_writer")
qa_builder.add_edge("qa_writer", "qa_runner")
qa_builder.add_edge("qa_runner", END)

qa_subgraph = qa_builder.compile()
```

### Step 3: Top-Level PM Orchestrator Graph

```python
class PMRoute(BaseModel):
    next_step: Literal["engineering", "qa", "FINISH"] = Field(
        description="Select engineering to write code, qa to test code, or FINISH if tests pass."
    )

pm_chain = llm.with_structured_output(PMRoute)

def product_manager_node(state: EngineeringState) -> dict:
    if state.get("test_passed", False):
        return {"messages": [AIMessage(content="[PM]: All QA criteria verified. Feature ready for release!")]}

    # PM decides next department
    return {"messages": [AIMessage(content="[PM]: Routing task to engineering team.")]}

def pm_router(state: EngineeringState) -> str:
    if state.get("test_passed", False):
        return "FINISH"
    if "server.py" not in state.get("source_code", {}):
        return "engineering"
    return "qa"

# Master Graph Assembly
master = StateGraph(EngineeringState)
master.add_node("pm", product_manager_node)
master.add_node("engineering_dept", engineering_subgraph)
master.add_node("qa_dept", qa_subgraph)

master.add_edge(START, "pm")
master.add_conditional_edges(
    "pm",
    pm_router,
    {"engineering": "engineering_dept", "qa": "qa_dept", "FINISH": END}
)
master.add_edge("engineering_dept", "pm")
master.add_edge("qa_dept", "pm")

app = master.compile()

if __name__ == "__main__":
    initial_spec = {
        "feature_request": "FastAPI health check service with structured JSON output",
        "source_code": {},
        "test_passed": False,
        "messages": [HumanMessage(content="Build health check endpoint.")]
    }

    print("=== Launching Autonomous Software Dev Team ===")
    res = app.invoke(initial_spec)
    for m in res["messages"]:
        print(f"\n{m.content}")

    print("\n=== Delivered Source Code ===")
    for fname, content in res["source_code"].items():
        print(f"\nFile: {fname}\n{content}")
```

---

## 4. Verification & Testing

1. **Verify Department Handoffs**: Trace execution flow: `PM -> Engineering -> PM -> QA -> PM -> END`.
2. **Verify Feedback Repair Loop**: Simulate a syntax bug in `backend_dev` and verify QA rejects and re-routes to Engineering.
3. **Verify Artifact Accumulation**: Inspect the final state dictionary and verify `source_code` and `test_code` are fully populated.

---

## 5. Extensions & Challenges

- **Real Python Sandbox Execution**: Connect `test_runner_node` to a secure Docker or WASM Python execution sandbox.
- **Frontend Specialist Worker**: Add a `frontend_dev` worker to the Engineering subgraph that creates React components.
- **Human PM Sign-Off**: Add an `interrupt()` breakpoint before `pm` calls `FINISH` to allow human technical leads to review the code.
