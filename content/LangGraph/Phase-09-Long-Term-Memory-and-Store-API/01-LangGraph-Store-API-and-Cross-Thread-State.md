# LangGraph Store API and Cross-Thread State

> "Checkpointers give an agent short-term memory inside a single conversation thread. The Store API gives an agent long-term memory across all threads, users, and months of time."

---

### Step 1: Why Do We Need This?

#### The Real Problem

In lesson 4, we learned that checkpointers save state scoped to a specific `thread_id`:
- Thread 1 (January): User says: *"I am allergic to peanuts and prefer dark mode."*
- Thread 2 (March): User starts a new chat thread: *"Recommend a quick dessert recipe."*
- If your system only uses Checkpointers: Thread 2 knows **nothing** about Thread 1. The agent recommends peanut butter cookies and displays a bright white screen.
- The user is frustrated having to repeat their personal preferences, constraints, and background every time they open a new chat.

Short-term thread memory is not enough. You need **cross-thread long-term memory**.

#### Why LangGraph Solves It

LangGraph provides the **Store API** (`BaseStore` / `InMemoryStore` / `AsyncPostgresStore`):
- Unlike checkpointers (which partition strictly by `thread_id`), the Store allows graphs to save and retrieve data across *any* thread using hierarchical **namespaces** (e.g. `("users", "user_123", "preferences")`).
- Any agent, in any thread, at any time, can read and write to this shared long-term memory bank.

---

### Step 2: What Is It?

#### Simple Explanation

Think of a **doctor's visit**:
- **Checkpointer (Short-Term Memory):** The conversation you are having with the doctor right now in the exam room.
- **Store API (Long-Term Memory):** Your permanent medical chart stored in the hospital records room.
- Even if you visit the hospital 6 months later with a completely different issue (new `thread_id`), the doctor opens your medical chart and instantly sees your blood type and medication allergies.

#### Checkpointer vs Store API

| Feature | Checkpointer | Store API |
| :--- | :--- | :--- |
| **Scope** | Scoped strictly to one `thread_id`. | Global across all threads, sessions, and assistants. |
| **Data Model** | Snapshots of full graph state over time. | Key-value documents organized by namespaces. |
| **Typical Use** | Conversational continuity, time-travel, HITL breakpoints. | User profiles, persistent preferences, company policies, semantic memory. |
| **Access Method** | Automatic re-hydration during `graph.invoke()`. | Explicit `store.get()` and `store.put()` inside node functions. |

---

### Step 3: Real-World Example

#### Personalized Coding Companion

Imagine an enterprise AI pair programmer:
- **Session 1 (Project A):** The developer instructs: *"Always use TypeScript strict mode and use TailwindCSS for styling."*
  - The agent writes to the store: `store.put(("users", "dev_alice"), "preferences", {"strict_mode": True, "styling": "tailwind"})`.
- **Session 2 (Project B - New thread 3 months later):** The developer prompts: *"Create a new login button component."*
  - The agent reads the user profile from the Store: `store.get(("users", "dev_alice"), "preferences")`.
  - Without being asked, the agent immediately generates a TypeScript button styled with TailwindCSS utility classes!
- **What it outputs:** Exceptional user personalization that feels truly intelligent.

---

### Step 4: How Does It Work?

1. **Initialize the Store:** Create a store instance like `in_memory_store = InMemoryStore()`.
2. **Compile with Store:** Pass both checkpointer and store to compilation:
   `graph = builder.compile(checkpointer=checkpointer, store=in_memory_store)`.
3. **Inject Store into Node:** In your node function signature, add `store: BaseStore`:
   ```python
   def my_node(state: MyState, store: BaseStore) -> dict:
       # Read from store
       user_profile = store.get(("users", state["user_id"]), "profile")
       # Write to store
       store.put(("users", state["user_id"]), "profile", {"theme": "dark"})
       return {"output": "..."}
   ```
4. **LangGraph Dependency Injection:** LangGraph automatically injects the compiled store instance into your node at runtime.

---

### Step 5: Code Example

Here is a complete, runnable example demonstrating LangGraph's Store API for cross-thread memory:

```python
from typing import TypedDict, Annotated, List, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore

# 1. State definition
class ProfileChatState(TypedDict):
    user_id: str
    messages: Annotated[List[BaseMessage], add_messages]

# 2. Node that reads from and writes to the global Store!
def personalized_assistant_node(state: ProfileChatState, store: BaseStore) -> dict:
    user_id = state["user_id"]
    last_query = state["messages"][-1].content
    
    # Define hierarchical namespace for this user's profile
    namespace = ("users", user_id)
    
    # 1. Read existing profile from the long-term Store
    existing_record = store.get(namespace, "user_preferences")
    preferences = existing_record.value if existing_record else {}
    
    # 2. If user mentions a dietary restriction, save it to the Store!
    if "vegetarian" in last_query.lower():
        preferences["diet"] = "vegetarian"
        store.put(namespace, "user_preferences", preferences)
        print("-> [Store Updated]: Saved diet='vegetarian' to persistent long-term storage.")
        
    # 3. Personalize response using long-term memory
    diet_info = preferences.get("diet", "standard")
    reply = f"Understood. Your active profile setting is diet='{diet_info}'. Ready for your question: '{last_query}'"
    return {"messages": [AIMessage(content=reply)]}

# Build graph
builder = StateGraph(ProfileChatState)
builder.add_node("assistant", personalized_assistant_node)
builder.add_edge(START, "assistant")
builder.add_edge("assistant", END)

# Compile with BOTH Checkpointer (short-term) and Store (long-term)!
checkpointer = MemorySaver()
global_store = InMemoryStore()

graph = builder.compile(checkpointer=checkpointer, store=global_store)

if __name__ == "__main__":
    user_id = "usr_alice_402"
    
    print("=== CONVERSATION 1 (THREAD #1 - JANUARY) ===")
    thread_1_config = {"configurable": {"thread_id": "thread_january"}}
    
    # Alice establishes her diet preference in Thread 1
    res1 = graph.invoke({
        "user_id": user_id,
        "messages": [HumanMessage(content="Please remember that I am a strict vegetarian.")]
    }, config=thread_1_config)
    print("Thread 1 Bot:", res1["messages"][-1].content)

    print("\n=== CONVERSATION 2 (THREAD #2 - MARCH: BRAND NEW THREAD) ===")
    # Notice this is a completely different thread_id!
    thread_2_config = {"configurable": {"thread_id": "thread_march_completely_new"}}
    
    # Alice asks for food recommendations without mentioning her diet
    res2 = graph.invoke({
        "user_id": user_id,
        "messages": [HumanMessage(content="Recommend a high-protein dinner option.")]
    }, config=thread_2_config)
    print("Thread 2 Bot:", res2["messages"][-1].content)
    
    # Verify the item exists in the store directly
    direct_read = global_store.get(("users", user_id), "user_preferences")
    print("\nDirect Store Verification:", direct_read.value)
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Namespace Collisions** | Two different users overwrite each other's preferences. | Always use partitioned namespaces: `("users", user_id, "data_type")`. |
| **Outdated User Facts** | A user moves cities or changes diets, but the old memory stays forever. | Let the agent update or delete keys when the user explicitly provides conflicting facts. |
| **Persistent Storage** | `InMemoryStore` is wiped when server restarts. | Use `AsyncPostgresStore` connected to your production PostgreSQL database. |
| **Memory Extraction Timing** | Writing to the store on every single turn adds latency. | Run memory extraction asynchronously in a background node or after conversation finishes. |

---

### Step 7: Quick Revision

- Checkpointers manage short-term memory within a single `thread_id`.
- The Store API manages long-term memory shared across all threads and sessions.
- Data in the Store is organized by hierarchical namespaces: `("domain", "entity_id")`.
- Access the store by adding `store: BaseStore` to your node function signature.
- Use `store.put()` to save facts and `store.get()` to retrieve them.
- In production, use `AsyncPostgresStore` for durable persistence.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    Thread1["Thread 1: 'I am vegetarian'"]:::startStyle --> Node1["Assistant Node"]:::nodeStyle
    Node1 -->|store.put(users, alice)| StoreDB[("LangGraph Store API<br>(Long-Term Memory Bank)")]:::decisionStyle
    
    Thread2["Thread 2 (New Thread 3 Months Later)"]:::startStyle --> Node2["Assistant Node"]:::nodeStyle
    StoreDB -->|store.get(users, alice)<br>Returns diet: vegetarian| Node2
    Node2 --> EndNode([Personalized Vegetarian Answer]):::endStyle

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decisionStyle fill:#334155,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef endStyle fill:#10b981,stroke:#34d399,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

Try answering these questions to check your understanding:

1. What is the fundamental difference between LangGraph Checkpointers and the Store API?
   - A) Checkpointers are written in C++; Store API is written in Java
   - B) Checkpointers manage short-term state for a single thread; the Store API provides long-term cross-thread memory across all sessions
   - C) Checkpointers only store images
   - D) There is no difference

2. How do you access the Store inside a node function?
   - A) By reading the user's hard drive directly
   - B) By adding `store: BaseStore` as a parameter in your node function signature
   - C) By importing global variables
   - D) By typing `graph.read()`

3. How are records organized in the LangGraph Store API?
   - A) By hierarchical tuple namespaces (e.g. `("users", "alice", "preferences")`) and a key string
   - B) By random numbers
   - C) In plain text files on the desktop
   - D) By alphabet letters only

4. Which store implementation should be used in production multi-container deployments?
   - A) `InMemoryStore`
   - B) `AsyncPostgresStore`
   - C) A temporary Python dict
   - D) A CSV file

*Submit your answers (e.g. 1-B, 2-B, 3-A, 4-B) to verify your score!*
