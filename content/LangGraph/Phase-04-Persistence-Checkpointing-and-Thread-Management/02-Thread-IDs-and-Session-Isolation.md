# Thread IDs and Session Isolation — Complete Guide

> "A bank safety deposit box vault assigns each customer an independent reinforced steel locker with a unique key number, ensuring no customer can open or inspect another person's valuables."

---

## Table of Contents

1. [The Problem: Multi-Tenant Data Bleed and Session Collisions](#1-the-problem-multi-tenant-data-bleed-and-session-collisions)
2. [The Bank Safety Deposit Vault Analogy](#2-the-bank-safety-deposit-vault-analogy)
3. [The Mechanism: thread_id and Configurable State Partitioning](#3-the-mechanism-thread_id-and-configurable-state-partitioning)
4. [Diagram: Multi-Tenant Thread Partitioning in Storage](#4-diagram-multi-tenant-thread-partitioning-in-storage)
5. [Code Walkthrough: Managing Isolated Concurrent User Threads](#5-code-walkthrough-managing-isolated-concurrent-user-threads)
6. [Comparing Thread Scopes](#6-comparing-thread-scopes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Multi-Tenant Data Bleed and Session Collisions

When hundreds of concurrent enterprise users interact with a single deployed LangGraph agent, the system must guarantee strict conversation isolation.

### The Multi-Tenant Risk

```text
Without Thread Isolation:
  User A asks: "What is my credit card balance?" ──▶ AI: "$4,500.00"
  User B asks: "Repeat my balance" ──▶ AI: "$4,500.00" (Catastrophic Data Leak!)

With Thread Isolation:
  Thread "user_A": Stores User A's private balance.
  Thread "user_B": Completely isolated empty session.
```

### The Solution: Thread-Partitioned Checkpointing

LangGraph uses the `thread_id` parameter inside `config["configurable"]` to partition all state channels and checkpoint trees by user or conversation.

---

## 2. The Bank Safety Deposit Vault Analogy

A commercial bank vault does not dump all customer cash, deeds, and jewelry into a single pile on the floor.

### Communal Floor Pile vs Private Numbered Lockers

```text
Communal Pile  → Everyone throws jewelry into the same cardboard box;
                 Customer B walks out wearing Customer A's heirloom watch (Data Leak).

Private Locker → Vault contains 10,000 numbered lockers (Locker #1042, Locker #1043).
                 Customer A's key only unlocks Locker #1042.
```

### Mapping to LangGraph

The bank vault is the Checkpoint Database; each numbered locker is a unique `thread_id`; the customer's interaction is a sequence of checkpoint snapshots inside that locker.

---

## 3. The Mechanism: thread_id and Configurable State Partitioning

All graph invocations and state lookups accept a `config` dictionary containing `configurable: {"thread_id": "..."}`.

### Thread Invocation & State Inspection

```python
# Configure distinct threads
config_user_1 = {"configurable": {"thread_id": "session_user_alice"}}
config_user_2 = {"configurable": {"thread_id": "session_user_bob"}}

# Invocation on Thread 1
app.invoke({"messages": [HumanMessage(content="My name is Alice")]}, config=config_user_1)

# Invocation on Thread 2 (Zero awareness of Alice)
app.invoke({"messages": [HumanMessage(content="What is my name?")]}, config=config_user_2)
# Output: "I don't know your name yet."

# Fetch latest state snapshot for Alice
alice_snapshot = app.get_state(config_user_1)
```

---

## 4. Diagram: Multi-Tenant Thread Partitioning in Storage

### Checkpointer Storage Hierarchy

```text
Checkpointer Database (PostgreSQL / SQLite / Redis)
│
├── Thread ID: "tenant_acme_user_1"
│   ├── Checkpoint #1 (t=0s): [HumanMessage: "Hello"]
│   ├── Checkpoint #2 (t=2s): [AIMessage: "Welcome Acme user!"]
│   └── Checkpoint #3 (t=5s): [ToolMessage: "Acme Data..."]
│
└── Thread ID: "tenant_globex_user_99"
    ├── Checkpoint #1 (t=1s): [HumanMessage: "Hi Globex"]
    └── Checkpoint #2 (t=3s): [AIMessage: "Welcome Globex user!"]
```

---

## 5. Code Walkthrough: Managing Isolated Concurrent User Threads

A multi-tenant demonstration testing conversational isolation, checkpoint inspection, and thread branching:

```python
# thread_isolation_demo.py
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import MemorySaver

model = ChatOpenAI(model="gpt-4o", temperature=0)

def assistant_node(state: MessagesState) -> dict:
    resp = model.invoke(state["messages"])
    return {"messages": [resp]}

def build_multi_tenant_app():
    checkpointer = MemorySaver()
    b = StateGraph(MessagesState)
    b.add_node("assistant", assistant_node)
    b.add_edge(START, "assistant")
    b.add_edge("assistant", END)
    return b.compile(checkpointer=checkpointer)

if __name__ == "__main__":
    app = build_multi_tenant_app()

    # User 1 Thread
    cfg_user1 = {"configurable": {"thread_id": "thread_user_001"}}
    app.invoke({"messages": [HumanMessage(content="I am ordering a Blue Tesla Model Y.")]}, config=cfg_user1)

    # User 2 Thread
    cfg_user2 = {"configurable": {"thread_id": "thread_user_002"}}
    app.invoke({"messages": [HumanMessage(content="I am ordering a Red Ferrari SF90.")]}, config=cfg_user2)

    # Query User 1 Thread
    res1 = app.invoke({"messages": [HumanMessage(content="What car did I order?")]}, config=cfg_user1)
    print("User 1 Bot Answer:", res1["messages"][-1].content)

    # Query User 2 Thread
    res2 = app.invoke({"messages": [HumanMessage(content="What car did I order?")]}, config=cfg_user2)
    print("User 2 Bot Answer:", res2["messages"][-1].content)
```

---

## 6. Comparing Thread Scopes

| Scope Level | Implementation Example | Isolation Boundary |
|---|---|---|
| Per-User Global | `thread_id = f"user_{user_id}"` | Single long-lived memory thread across all days |
| Per-Conversation | `thread_id = f"conv_{uuid4()}"` | Fresh conversation session on each new chat window |
| Multi-Tenant Partition | `thread_id = f"{tenant_id}:{user_id}:{session_id}"` | Strict multi-enterprise data segregation |
| Branch / Experiment | `thread_id = f"{session_id}_branch_a"` | A/B testing alternative reasoning paths |

---

## 7. Common Mistakes

- **Hardcoding a static `thread_id`.** Using `thread_id = "default"` causes all incoming API requests to share the same message history.
- **Using sensitive personal data in raw `thread_id` strings.** Do not use unhashed plain-text SSNs or email addresses in thread IDs; use UUIDs.
- **Forgetting that `get_state()` requires `thread_id`.** Inspecting state without specifying `{"configurable": {"thread_id": "..."}}` fails.
- **Not cleaning up orphaned threads in production.** In high-traffic apps, millions of abandoned threads accumulate; configure TTL cleanup policies.
- **Assuming thread IDs are shared across checkpointers.** If you migrate from SQLite to Postgres, ensure existing thread IDs are migrated.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize 3 separate threads with `MemorySaver` and verify that facts told to Thread 1 are unknown to Thread 2.

**Exercise 2:** Create a thread naming convention using `f"{tenant_id}_{user_id}_{session_id}"`.

**Exercise 3:** Use `app.get_state(config)` on two different threads and print their respective state lengths.

**Exercise 4:** Fork a thread by copying the checkpoint history from `thread_A` into a new `thread_A_fork` and continue execution.

**Exercise 5:** Build a FastAPI endpoint that extracts `Authorization: Bearer <token>` and maps the token's user ID to `thread_id`.

---

## 9. Interview Q&A

**Q: What is a `thread_id` in LangGraph?**
A `thread_id` is a unique string identifier passed in the invocation configuration (`config={"configurable": {"thread_id": "..."}}`) that serves as the partition key for state persistence, isolating state checkpoints between different users or conversations.

**Q: How does LangGraph enforce multi-tenant isolation?**
Checkpointer backends (Postgres, SQLite, Redis) partition all database writes by `thread_id`. When querying or executing a graph, the runtime strictly filters queries to match the provided `thread_id`, guaranteeing no cross-tenant data bleed.

**Q: What is a `checkpoint_id` and how does it relate to `thread_id`?**
A `thread_id` identifies a conversation line (a sequence of turns), while a `checkpoint_id` (typically a UUID or nanosecond timestamp) identifies a specific, immutable point in time within that thread.

**Q: Can you resume execution from an older checkpoint within a thread?**
Yes. By passing both `thread_id` and `checkpoint_id` in the configuration (`config={"configurable": {"thread_id": "t1", "checkpoint_id": "cp_99"}}`), LangGraph forks execution from that historical snapshot.

**Q: How should `thread_id` be generated in production web applications?**
In production web apps, `thread_id` is typically generated as a UUIDv4 by the frontend client upon opening a new chat window, or derived deterministically by the backend as `f"{tenant_id}:{user_id}:{conversation_uuid}"`.
