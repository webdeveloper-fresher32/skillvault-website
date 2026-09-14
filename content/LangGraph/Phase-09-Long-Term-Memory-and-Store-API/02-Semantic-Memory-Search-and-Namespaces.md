# Semantic Memory Search and Namespaces — Complete Guide

> "A master librarian organizes millions of books into distinct categorized wings (namespaces), allowing patrons to ask questions in plain English and instantly retrieving the exact paragraph needed (semantic vector search)."

---

## Table of Contents

1. [The Problem: Exact-Match Key Lookups Fail for Unstructured Human Memory](#1-the-problem-exact-match-key-lookups-fail-for-unstructured-human-memory)
2. [The Master Librarian Analogy](#2-the-master-librarian-analogy)
3. [The Mechanism: Hierarchical Namespaces and store.search()](#3-the-mechanism-hierarchical-namespaces-and-storesearch)
4. [Diagram: Namespace Hierarchy and Semantic Vector Indexing](#4-diagram-namespace-hierarchy-and-semantic-vector-indexing)
5. [Code Walkthrough: Production Semantic Memory Store with Embeddings](#5-code-walkthrough-production-semantic-memory-store-with-embeddings)
6. [Comparing Exact Key Lookup vs Semantic Vector Search](#6-comparing-exact-key-lookup-vs-semantic-vector-search)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Exact-Match Key Lookups Fail for Unstructured Human Memory

Exact key-value lookups (`store.get(namespace, key="dietary_preference")`) work only if you know the exact key name ahead of time.

### The Key-Lookup Failure

```text
Stored Memory: Key="user_health_notes", Value="Customer had bariatric surgery in 2022 and avoids sugar."
User Query: "What dessert should I serve at my dinner party?"
→ Exact Key Lookup: Looking up key "dessert_prefs" returns None!
→ Semantic Search: Queries embedding space: "dessert" is semantically close to "avoids sugar"!
```

### The Solution: Embeddings-Enabled `InMemoryStore` Search

LangGraph `Store` supports vector embeddings, enabling semantic search with `store.search(namespace_prefix, query=...)`.

---

## 2. The Master Librarian Analogy

A research library does not require researchers to know the exact ISBN number of every single book.

### Rigid ISBN Lookup vs Semantic Reference Librarian

```text
Rigid ISBN Lookup  → Patron must know exact alphanumeric code: `ISBN-978-0-13-110362-7`
                     (Impossible if patron only remembers the concept).

Semantic Librarian → Patron asks: "Where are books discussing distributed consensus algorithms?"
                     Librarian leads patron directly to Section 4B (Computer Science) and pulls Raft papers.
```

### Mapping to LangGraph

Section 4B is the `namespace_prefix`; the patron's question is `query="distributed consensus"`; the retrieved papers are `SearchItem` records.

---

## 3. The Mechanism: Hierarchical Namespaces and store.search()

Configure `InMemoryStore` with an embedding model for vector search.

### Semantic Search Syntax

```python
from langchain_openai import OpenAIEmbeddings
from langgraph.store.memory import InMemoryStore

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
# Initialize store with vector search indexing enabled!
store = InMemoryStore(index={"dims": 1536, "embed": embeddings})

# Search across all keys matching a namespace prefix
results = store.search(
    namespace_prefix=("users", "user_101"),
    query="travel destinations with warm beaches",
    limit=3
)
for item in results:
    print(f"Memory: {item.value} | Similarity Score: {item.score}")
```

---

## 4. Diagram: Namespace Hierarchy and Semantic Vector Indexing

### Hierarchical Vector Namespace Tree

```text
LangGraph Store
 ├── Namespace: ("users", "user_101", "memories")
 │    ├── [Vector 1]: "Loves Italian espresso and dark roast."
 │    ├── [Vector 2]: "Traveled to Tokyo in spring 2023."
 │    └── [Vector 3]: "Allergic to shellfish and crustacea."
 │
 └── Namespace: ("users", "user_102", "memories")
      └── [Vector 4]: "Prefers vegan dining options."
                ▲
                │ (Query: "Where should I go for coffee?")
                │
         [Semantic Search matches Vector 1 in user_101 namespace]
```

---

## 5. Code Walkthrough: Production Semantic Memory Store with Embeddings

A complete conversational agent retrieving relevant semantic memories to answer user questions:

```python
# semantic_memory_demo.py
from typing import TypedDict
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

class SemanticChatState(MessagesState):
    user_id: str

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
store = InMemoryStore(index={"dims": 1536, "embed": embeddings})
llm = ChatOpenAI(model="gpt-4o", temperature=0)

def populate_sample_memories(user_id: str):
    # Pre-populate unstructured long-term user memories
    store.put(("users", user_id, "memories"), "mem_1", {"text": "User loves mountain hiking in Switzerland."})
    store.put(("users", user_id, "memories"), "mem_2", {"text": "User drives a Tesla Model Y electric vehicle."})
    store.put(("users", user_id, "memories"), "mem_3", {"text": "User suffers from severe peanut and tree nut allergy."})

def personalized_agent_node(state: SemanticChatState, store: InMemoryStore) -> dict:
    user_id = state["user_id"]
    last_user_query = state["messages"][-1].content

    # 1. Semantic vector search inside the user's namespace!
    matched_memories = store.search(
        namespace_prefix=("users", user_id, "memories"),
        query=last_user_query,
        limit=2
    )

    memory_context = "\n".join([f"- {m.value['text']}" for m in matched_memories])
    system_prompt = (
        "You are a personalized assistant. Use the following long-term user memories if relevant:\n"
        f"{memory_context}"
    )

    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
    response = llm.invoke(messages)
    return {"messages": [response]}

builder = StateGraph(SemanticChatState)
builder.add_node("agent", personalized_agent_node)
builder.add_edge(START, "agent")
builder.add_edge("agent", END)

checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer, store=store)

if __name__ == "__main__":
    test_user = "user_sarah_99"
    populate_sample_memories(test_user)

    cfg = {"configurable": {"thread_id": "vacation_planning_01"}}
    query = "Can you recommend a great summer vacation activity that matches my hobbies?"
    res = app.invoke({"user_id": test_user, "messages": [HumanMessage(content=query)]}, config=cfg)
    print("Agent Response:\n", res["messages"][-1].content)
```

---

## 6. Comparing Exact Key Lookup vs Semantic Vector Search

| Feature | Exact Key Lookup (`store.get`) | Semantic Vector Search (`store.search`) |
|---|---|---|
| Query Style | Exact key string (`key="pet_name"`) | Natural language query (`query="outdoor sports"`) |
| Execution Speed | $O(1)$ Hash table lookup (Sub-millisecond) | $O(\log N)$ Vector similarity search (~5–20ms) |
| Embedding Cost | Zero | Requires embedding model API calls |
| Flexibility | Rigid; fails if key name differs | High; handles synonyms and related concepts |
| Best Used For | Structured IDs, flags, auth tokens | Unstructured notes, past conversations, preferences |

---

## 7. Common Mistakes

- **Forgetting to configure `index=` in `InMemoryStore`.** Calling `store.search(..., query="...")` on a store initialized without an index raises a `ValueError`.
- **Querying global namespace without user prefix.** Always use `namespace_prefix=("users", user_id)` to prevent one user's private data from leaking into another user's search results.
- **Embedding huge state payloads.** Embed concise, synthesized factual sentences rather than raw 50-turn conversation dumps.
- **Mismatched embedding dimensions.** Using `dims: 1536` with a model that outputs 768 dimensions causes vector indexing failures.
- **Setting `limit` too high.** Retrieving 20 semantic memories pollutes the agent's prompt context; 2–4 high-relevance memories is optimal.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize an `InMemoryStore` with `OpenAIEmbeddings` and insert 5 diverse hobbies.

**Exercise 2:** Search the store with a conceptual query like `"winter sports"` and verify cosine similarity ranking.

**Exercise 3:** Implement namespace filtering so searches under `("users", "alice")` never return memories from `("users", "bob")`.

**Exercise 4:** Build an auto-retrieval node that injects top-2 relevant memories into the agent system prompt.

**Exercise 5:** Test semantic search across multilingual memories (e.g. querying in Spanish against English memories).

---

## 9. Interview Q&A

**Q: How does semantic search work in the LangGraph Store API?**
When initializing the Store (e.g. `InMemoryStore(index={"embed": embeddings, "dims": 1536})`), LangGraph automatically computes vector embeddings for JSON document values stored via `store.put()`. Calling `store.search(namespace_prefix, query=...)` embeds the search query and performs vector cosine similarity search across that namespace.

**Q: What is a `namespace_prefix` in `store.search()`?**
A `namespace_prefix` is a tuple that restricts vector search to documents stored under matching hierarchical paths (e.g. `namespace_prefix=("users", "user_123")` will search documents in `("users", "user_123", "profile")` and `("users", "user_123", "notes")`, but ignores `("users", "user_456")`).

**Q: Why is semantic memory search critical for long-term personalized agents?**
Humans do not recall past events using rigid database keys. Semantic memory search allows an agent to retrieve relevant life events, preferences, and dietary restrictions based on the natural language context of the user's current question.

**Q: Can you perform keyword or metadata filtering alongside semantic search in the Store?**
Yes. `store.search()` supports metadata filtering parameters (e.g. `filter={"category": "travel"}`) in combination with vector similarity queries.

**Q: How do you prevent cross-tenant data leaks when using semantic search?**
Strictly prefix all memory namespace paths with tenant and user IDs (`("orgs", org_id, "users", user_id)`), and always pass the authenticated user's `namespace_prefix` when invoking `store.search()`.
