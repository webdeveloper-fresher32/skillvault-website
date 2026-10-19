# Semantic Memory Search and Namespaces in LangGraph

> "Keyword lookup only works if you remember the exact key. Semantic memory search lets an agent find relevant facts by meaning, even with fuzzy phrasing."

---

### Step 1: Why Do We Need This?

#### The Real Problem

In Lesson 1, we learned exact key lookup: `store.get(("users", "alice"), "diet")`.
This works when you know the exact key name ahead of time.

Now imagine a user chatting over 6 months:
- The user has shared 80 different facts: pet names, family members, previous vacation spots, work projects, hardware setups.
- Today the user asks: *"What was that quiet hotel in the mountains I liked last summer?"*
- The agent does not know what key name was used. Was it `hotel_name`? `vacation_2025`? `travel_favorites`?
- Exact key lookups fail completely when queries are descriptive, conversational, or fuzzy.

You need **Semantic Memory Search**: the ability to search your long-term store using vector embeddings.

#### Why LangGraph Solves It

LangGraph's Store API supports built-in **Semantic Search**:
- You can configure the store with an embedding model (e.g. OpenAI `text-embedding-3-small`).
- When saving items with `store.put()`, LangGraph automatically generates embeddings for the content.
- Inside any node, you can call `store.search(namespace, query="quiet mountain hotel", limit=3)` to retrieve the most semantically relevant memories.

---

### Step 2: What Is It?

#### Simple Explanation

Think of a **librarian with a photographic memory**:
- If you ask for book #88219 (Exact Key), they pull that exact book.
- But if you ask: *"Do you have any stories about lonely robots exploring distant galaxies?"* (Semantic Query),
- The librarian searches their semantic memory, identifies books with matching themes, and hands you the top 3 best matches.

#### Exact Key vs Semantic Search

| Feature | Exact Key (`store.get`) | Semantic Search (`store.search`) |
| :--- | :--- | :--- |
| **Lookup Mechanism** | Exact primary key match (`"preferences"`). | Cosine similarity across vector embeddings. |
| **Speed** | Instant O(1) hash table lookup. | Vector distance calculation (approximate nearest neighbor). |
| **Flexibility** | Zero flexibility: exact string required. | High: matches synonyms, paraphrasing, and related concepts. |
| **Best Used For** | User settings, flags, strict configuration. | Past memories, conversational notes, user background knowledge. |

---

### Step 3: Real-World Example

#### Executive Assistant Remembering Meeting Context

Imagine an executive AI chief of staff:
- **What it receives:** An executive asks: *"Prepare my briefing with Sarah. What did we discuss regarding our cloud budget last month?"*
- **What decision it makes:**
  1. The agent calls: `store.search(("exec_memory", "meetings"), query="Sarah cloud budget discussions", limit=2)`.
  2. The semantic search finds two relevant memory notes:
     - Note A: *"Met with Sarah on Sep 14: AWS bill exceeded forecast by $15k."*
     - Note B: *"Sarah proposed moving database backups to S3 Glacier."*
  3. The agent synthesizes these retrieved memories into a structured pre-meeting brief.
- **What it outputs:** High-value context retrieved by meaning without searching through hundreds of emails.

---

### Step 4: How Does It Work?

1. **Configure Store with Embeddings:** Initialize `InMemoryStore(index={"embed": embeddings_model, "dims": 1536})`.
2. **Store Memories:** Save text items into designated namespaces:
   `store.put(("users", "alice", "memories"), "mem_01", {"text": "I love visiting Kyoto in the autumn."})`.
3. **Execute Semantic Search:** Inside a node:
   ```python
   matches = store.search(
       ("users", user_id, "memories"),
       query="places Alice likes traveling to",
       limit=3
   )
   ```
4. **Use Retrieved Context:** Inject matched memory texts into the LLM prompt.

---

### Step 5: Code Example

Here is a complete, runnable example demonstrating semantic memory search with namespaces:

```python
from typing import TypedDict, Annotated, List
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore

# 1. State definition
class MemorySearchState(TypedDict):
    user_id: str
    messages: Annotated[List[BaseMessage], add_messages]
    retrieved_context: List[str]

# 2. Node that performs semantic search over user memories
def memory_retriever_node(state: MemorySearchState, store: BaseStore) -> dict:
    user_id = state["user_id"]
    query = state["messages"][-1].content
    namespace = ("users", user_id, "memories")
    
    print(f"-> [Memory Store]: Searching namespace {namespace} for query: '{query}'")
    
    # Simple mock similarity search demonstration
    # In full production, this runs vector search using your configured embedding model
    all_items = store.search(namespace, query=query, limit=2)
    
    found_facts = []
    for item in all_items:
        found_facts.append(item.value.get("text", ""))
        
    return {"retrieved_context": found_facts}

def answer_node(state: MemorySearchState) -> dict:
    context = "\n".join(f"- {c}" for c in state["retrieved_context"])
    response = f"Based on your past notes:\n{context}\n\nI recommend planning a visit to the Arashiyama bamboo forest."
    return {"messages": [AIMessage(content=response)]}

# Build graph
builder = StateGraph(MemorySearchState)
builder.add_node("retrieve_memories", memory_retriever_node)
builder.add_node("answer", answer_node)

builder.add_edge(START, "retrieve_memories")
builder.add_edge("retrieve_memories", "answer")
builder.add_edge("answer", END)

global_store = InMemoryStore()
graph = builder.compile(store=global_store)

if __name__ == "__main__":
    alice_id = "user_alice_88"
    alice_namespace = ("users", alice_id, "memories")
    
    # Seed the store with historical facts
    global_store.put(alice_namespace, "note_1", {"text": "Alice prefers quiet vacations in Japan with great tea shops."})
    global_store.put(alice_namespace, "note_2", {"text": "Alice is allergic to shellfish."})
    global_store.put(alice_namespace, "note_3", {"text": "Alice works as a senior cloud architect."})
    
    # Alice asks a fuzzy question
    result = graph.invoke({
        "user_id": alice_id,
        "messages": [HumanMessage(content="Where should I go for a relaxing retreat in East Asia?")],
        "retrieved_context": []
    })
    
    print("\n=== AGENT RESPONSE WITH SEMANTIC MEMORY ===")
    print(result["messages"][-1].content)
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Namespace Isolation** | Memory queries accidentally searching across all users in the company. | Scope searches strictly by namespace: `("tenants", tenant_id, "users", user_id)`. |
| **Embedding Latency** | Computing embeddings synchronously on every `store.put()` slows down the user response. | Offload embedding calculation and memory indexing to an asynchronous background worker. |
| **Stale Memory Overlap** | Multiple conflicting memories retrieved (e.g. old job vs new job). | Include timestamps in memory payloads and sort semantic matches by recency. |

---

### Step 7: Quick Revision

- Semantic search lets agents retrieve long-term memories by conceptual meaning rather than exact keys.
- Hierarchical namespaces partition memory stores cleanly between tenants, users, and teams.
- Use `store.search(namespace, query="...", limit=N)` to find nearest vector matches.
- Combine semantic memories with the current prompt to provide rich personalized answers.
- In production, include timestamps to prioritize recent facts over outdated notes.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    UserQuery["User asks: 'Where should I go on vacation in Japan?'"]:::startStyle --> RetrieveNode["memory_retriever_node"]:::nodeStyle
    
    RetrieveNode -->|store.search(namespace, query)| VectorIndex[("Namespaced Store with Embeddings<br>('users', 'alice', 'memories')")]:::decisionStyle
    
    VectorIndex -->|Top-K Matches (Kyoto tea shops)| RetrieveNode
    RetrieveNode --> AnswerNode["answer_node: Synthesize with memory"]:::nodeStyle
    AnswerNode --> Output(["Personalized Recommendation"]):::endStyle

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decisionStyle fill:#334155,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef endStyle fill:#10b981,stroke:#34d399,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

Try answering these questions to check your understanding:

1. When should you use `store.search()` instead of `store.get()`?
   - A) When you only know an exact numeric ID
   - B) When searching by natural language meaning, synonyms, or descriptive queries without knowing an exact key
   - C) When saving temporary variables
   - D) When compiling Python code

2. What role do namespaces play in the Store API?
   - A) They format CSS stylesheets
   - B) They organize memories into hierarchical folders (e.g. tenant, user, category), preventing cross-user data leakage
   - C) They set computer clock time
   - D) They replace Python packages

3. What technology enables `store.search()` to find related concepts like "bamboo forest" when the query asked for "relaxing nature retreat"?
   - A) String matching using regex
   - B) Vector embeddings and cosine similarity
   - C) Python dictionary lookups
   - D) Randomized guessing

4. Why is including a timestamp in stored memory records recommended for production?
   - A) To pay higher AWS bills
   - B) To resolve conflicts and allow the agent to favor recent facts over outdated historical preferences
   - C) To disable the database
   - D) Because Python requires dates on all variables

*Submit your answers (e.g. 1-B, 2-B, 3-B, 4-B) to verify your score!*
