# LangGraph Quick Reference Cheatsheet

A concise, high-density syntax and pattern cheatsheet for building stateful, multi-agent AI systems with LangGraph.

---

## 1. Core Graph Construction

```python
from langgraph.graph import StateGraph, START, END, MessagesState
from typing import TypedDict, Annotated
import operator

# TypedDict State Schema
class CustomState(TypedDict):
    query: str
    messages: Annotated[list, operator.add]
    count: int

# Initialize Builder
builder = StateGraph(CustomState)

# Add Nodes
builder.add_node("node_a", node_a_function)
builder.add_node("node_b", node_b_function)

# Add Normal Edges
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "node_b")

# Add Conditional Edges
def route_decision(state: CustomState) -> str:
    return "node_b" if state["count"] < 3 else END

builder.add_conditional_edges("node_a", route_decision, {"node_b": "node_b", END: END})

# Compile Graph
app = builder.compile()
```

---

## 2. Channel Reducers

```python
import operator
from typing import Annotated, List
from langchain_core.messages import BaseMessage, add_messages

class ReducerState(TypedDict):
    # Appends new items to existing list
    history: Annotated[List[str], operator.add]

    # LangChain message-aware reducer (merges ID-matched message updates)
    messages: Annotated[List[BaseMessage], add_messages]

    # Custom Reducer Function
    total_score: Annotated[int, lambda old, new: max(old, new)]
```

---

## 3. Prebuilt ReAct Agent

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def search_db(query: str) -> str:
    """Search the company database."""
    return f"Results for {query}"

model = ChatOpenAI(model="gpt-4o", temperature=0)
checkpointer = MemorySaver()

# Instant production ReAct Agent with ToolNode loop
agent_app = create_react_agent(model, tools=[search_db], checkpointer=checkpointer)
```

---

## 4. Checkpointing & Persistence

```python
from langgraph.checkpoint.memory import MemorySaver
# For production PostgreSQL:
# from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)

# Mandatory config containing thread_id
config = {"configurable": {"thread_id": "session_user_42"}}

# Invoke with thread isolation
res = app.invoke({"messages": [...]}, config=config)

# Inspect State Snapshot
snapshot = app.get_state(config)
print("Current State:", snapshot.values)
print("Next Nodes:", snapshot.next)

# Inspect Checkpoint History (Reverse Chronological)
history = list(app.get_state_history(config))
```

---

## 5. Human-in-the-Loop & Breakpoints

```python
# Static Breakpoint (declared on compile)
app = builder.compile(checkpointer=checkpointer, interrupt_before=["sensitive_tool_node"])

# Resume static breakpoint
app.invoke(None, config=config)

# Dynamic Breakpoint (inside node function)
from langgraph.types import interrupt, Command

def payment_node(state: CustomState):
    if state["amount"] > 1000:
        approval = interrupt({"prompt": "Authorize wire?", "amount": state["amount"]})
        if not approval.get("approved"):
            return {"status": "REJECTED"}
    return {"status": "APPROVED"}

# Resume dynamic interrupt
app.invoke(Command(resume={"approved": True}), config=config)

# Manual State Overwrite / Time Travel
app.update_state(config, {"amount": 500}, as_node="agent")
```

---

## 6. Real-Time Streaming Modes

```python
# 1. stream_mode="messages" (Token-by-token LLM streaming)
async for chunk, metadata in app.astream(inputs, config=config, stream_mode="messages"):
    if chunk.content:
        print(chunk.content, end="", flush=True)

# 2. stream_mode="updates" (Node completion deltas)
for update in app.stream(inputs, stream_mode="updates"):
    print(update)  # Output: {"node_a": {"count": 1}}

# 3. stream_mode="values" (Full state snapshot after each node)
for snapshot in app.stream(inputs, stream_mode="values"):
    print(snapshot["messages"])

# Subgraph streaming
async for namespace, chunk in app.astream(inputs, stream_mode="updates", subgraphs=True):
    print(f"[{namespace}] {chunk}")
```

---

## 7. Dynamic Map-Reduce with Send API

```python
from langgraph.types import Send

def dynamic_splitter_router(state: BookState) -> list[Send]:
    return [
        Send("chapter_worker", {"chapter_idx": i, "text": ch})
        for i, ch in enumerate(state["chapters"])
    ]

builder.add_conditional_edges("splitter_node", dynamic_splitter_router, ["chapter_worker"])
builder.add_edge("chapter_worker", "reducer_node")
```

---

## 8. Cross-Thread Long-Term Store API

```python
from langgraph.store.memory import InMemoryStore
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings()
store = InMemoryStore(index={"dims": 1536, "embed": embeddings})

app = builder.compile(checkpointer=checkpointer, store=store)

# Inside node function:
def profile_node(state: State, store: InMemoryStore):
    # Write / Update
    store.put(namespace=("users", "user_101"), key="diet", value={"vegan": True})

    # Exact Read
    item = store.get(namespace=("users", "user_101"), key="diet")

    # Semantic Vector Search
    results = store.search(namespace_prefix=("users", "user_101"), query="food preferences")
    return {"preferences": [r.value for r in results]}
```

---

## 9. Multi-Agent Supervisor Pattern

```python
from pydantic import BaseModel
from typing import Literal

class RouterDecision(BaseModel):
    next: Literal["researcher", "coder", "FINISH"]

router_chain = llm.with_structured_output(RouterDecision)

def supervisor_node(state: MessagesState) -> dict:
    decision = router_chain.invoke(state["messages"])
    return {"next": decision.next}

builder.add_node("supervisor", supervisor_node)
builder.add_node("researcher", researcher_subgraph)
builder.add_node("coder", coder_subgraph)

builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    lambda state: state["next"],
    {"researcher": "researcher", "coder": "coder", "FINISH": END}
)
builder.add_edge("researcher", "supervisor")
builder.add_edge("coder", "supervisor")
```

---

## 10. CLI & Production Deployment

```bash
# Start local dev server & Studio
langgraph dev

# Build OCI production container
langgraph build -t my-agent:latest

# langgraph.json schema
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent.py:graph"
  },
  "env": ".env",
  "python_version": "3.11"
}
```
