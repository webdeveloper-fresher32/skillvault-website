# User Profile and Preference Persistence in LangGraph

> "An agent that remembers your preferences feels like a dedicated personal assistant. An agent that forgets feels like talking to an answering machine."

---

### Step 1: Why Do We Need This?

#### The Real Problem

Every user has unique habits, communication styles, technical skill levels, and platform settings:
- Developer Alice prefers: Python, async/await, concise code snippets without conversational fluff.
- Product Manager Bob prefers: High-level summaries, bullet points, business impact metrics, no code.
- If an AI treats both users identically:
  - Alice gets annoyed by long paragraphs explaining basic concepts.
  - Bob gets confused by raw stack traces and unit test assertions.

Without persistent user profiles, your agent cannot adapt its persona or responses to individual humans.

#### Why LangGraph Solves It

LangGraph combines the **Store API** with **Background Profile Extractors**:
- While interacting, an extraction node detects facts like: *"I am a beginner at SQL"* or *"I use macOS"*.
- It saves these facts into a structured user profile document: `store.put(("profiles",), user_id, profile_dict)`.
- On every future interaction, the agent loads the profile and dynamically tunes its system prompt to match the user's expertise and style.

---

### Step 2: What Is It?

#### Simple Explanation

Think of a **barista at your favorite neighborhood coffee shop**:
- The first time you visit, you say: *"Large oat milk latte with an extra espresso shot"*.
- The next morning, as soon as you walk in the door, the barista smiles and says: *"The usual large oat latte with an extra shot?"*
- You did not have to recite your order again. The coffee shop stored your profile in their customer memory.

#### Architecture: Profile Ingestion & Retrieval

```text
[User Chat Turn]
       │
   (Execution)
       ├───► [Agent Node]: Uses existing profile to craft tailored answer
       │
       └───► [Extractor Node]: Detects new preferences -> Updates Store API
```

---

### Step 3: Real-World Example

#### Adaptive Educational Tutor

Imagine an AI math and programming tutor:
- **What it receives:** Student message: *"Explain how recursion works."*
- **What decision it makes:**
  1. The agent loads the student's profile: `{"grade_level": "middle_school", "learning_style": "visual_metaphors"}`.
  2. Instead of giving an academic mathematical proof with Big-O notation, the agent explains recursion using Russian Matryoshka nesting dolls.
  3. Later, the student says: *"I learned Python functions yesterday!"*
  4. The extraction node updates the profile: `{"skills": ["python_basics"]}`.
  5. The next explanation includes simple Python code snippets matching their new skill.
- **What it outputs:** Dynamic, adaptive instruction tailored to each student's journey.

---

### Step 4: How Does It Work?

1. **Profile Schema:** Define a clean Pydantic schema for user profile records (e.g. `Tone`, `Skills`, `Constraints`).
2. **Pre-Run Profile Fetch:** At the start of the graph, a loader node queries `store.get(("profiles",), user_id)`.
3. **Dynamic System Prompt:** The agent combines the user profile with the base system instructions.
4. **Post-Run Extraction:** An evaluator checks if the conversation revealed new preferences and updates the store with `store.put()`.

---

### Step 5: Code Example

Here is a complete, runnable example of user profile persistence and adaptive prompt generation in LangGraph:

```python
from typing import TypedDict, Annotated, List, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore

# 1. State definition
class AdaptiveTutorState(TypedDict):
    user_id: str
    messages: Annotated[List[BaseMessage], add_messages]
    user_profile: dict

# 2. Node 1: Loads persistent profile from Store
def load_profile_node(state: AdaptiveTutorState, store: BaseStore) -> dict:
    user_id = state["user_id"]
    record = store.get(("profiles",), user_id)
    profile = record.value if record else {"skill_level": "beginner", "preferred_tone": "friendly"}
    return {"user_profile": profile}

# 3. Node 2: Adaptive Agent Node that crafts responses matching profile
def tutor_agent_node(state: AdaptiveTutorState) -> dict:
    profile = state["user_profile"]
    skill = profile.get("skill_level", "beginner")
    
    user_query = state["messages"][-1].content
    
    # Adapt explanation depth to the user's recorded skill level!
    if skill == "advanced":
        explanation = f"[Advanced Explanation]: Recursion is a call-stack mechanism where a function evaluates base cases before unwinding frames. Query: {user_query}"
    else:
        explanation = f"[Beginner Metaphor]: Think of recursion like Russian nesting dolls. Each doll opens up until you find the tiny solid doll at the center! Query: {user_query}"
        
    return {"messages": [AIMessage(content=explanation)]}

# 4. Node 3: Preference Extractor (Updates long-term store when user declares changes)
def profile_extractor_node(state: AdaptiveTutorState, store: BaseStore) -> dict:
    user_id = state["user_id"]
    last_msg = state["messages"][-2].content if len(state["messages"]) >= 2 else ""
    
    profile = state["user_profile"].copy()
    if "i am a senior engineer" in last_msg.lower():
        profile["skill_level"] = "advanced"
        store.put(("profiles",), user_id, profile)
        print("-> [Store Updated]: User skill_level promoted to 'advanced'.")
        
    return {"user_profile": profile}

# Build Graph
builder = StateGraph(AdaptiveTutorState)

builder.add_node("load_profile", load_profile_node)
builder.add_node("tutor", tutor_agent_node)
builder.add_node("extractor", profile_extractor_node)

builder.add_edge(START, "load_profile")
builder.add_edge("load_profile", "tutor")
builder.add_edge("tutor", "extractor")
builder.add_edge("extractor", END)

global_store = InMemoryStore()
tutor_graph = builder.compile(store=global_store)

if __name__ == "__main__":
    alice_id = "student_alice_101"
    
    print("=== TURN 1: ALICE ASKS AS A BEGINNER ===")
    res1 = tutor_graph.invoke({
        "user_id": alice_id,
        "messages": [HumanMessage(content="Explain recursion to me.")],
        "user_profile": {}
    })
    print(res1["messages"][-1].content)
    
    print("\n=== TURN 2: ALICE UPDATES HER BACKGROUND ===")
    res2 = tutor_graph.invoke({
        "user_id": alice_id,
        "messages": [HumanMessage(content="Actually, I am a senior engineer. Explain recursion.")],
        "user_profile": {}
    })
    print(res2["messages"][-1].content)
    
    print("\n=== TURN 3: FUTURE SESSION (ALICE ASKS NEW QUESTION) ===")
    # Next week, Alice asks about Docker. The system remembers she is an advanced engineer!
    res3 = tutor_graph.invoke({
        "user_id": alice_id,
        "messages": [HumanMessage(content="Explain Docker containers.")],
        "user_profile": {}
    })
    print(res3["messages"][-1].content)
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Hallucinated Profile Updates** | Extractor incorrectly infers a permanent preference from a temporary mood. | Only extract preferences when the user explicitly states them, or require high model confidence. |
| **Privacy Regulations (GDPR)** | Users have a legal "Right to be Forgotten" under GDPR/CCPA. | Implement a `store.delete(("profiles",), user_id)` endpoint to wipe user records upon request. |
| **Profile Schema Evolution** | Adding new fields (e.g. `timezone`) to profiles created months ago. | Use Pydantic models with default values so older profile records load without missing field errors. |

---

### Step 7: Quick Revision

- Persistent user profiles let agents adapt tone, technical depth, and output formatting to each user.
- Store profiles under the `("profiles",)` namespace using `user_id` as the primary key.
- A pre-run loader node fetches the profile and injects it into system prompts.
- A post-run extractor node detects new preferences and updates the store automatically.
- Always provide a way for users to view, edit, or delete their stored profile data (GDPR compliance).

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    UserMsg["User Message"]:::startStyle --> LoadProfile["load_profile_node: Reads Store"]:::nodeStyle
    LoadProfile --> AgentNode["tutor_agent_node: Generates Adaptive Answer"]:::nodeStyle
    AgentNode --> Extractor["profile_extractor_node: Detects New Facts"]:::nodeStyle
    
    Extractor -->|store.put(profiles, user_id)| StoreDB[("Persistent Store API")]:::decisionStyle
    Extractor --> EndNode([END: Tailored Response Delivered]):::endStyle

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decisionStyle fill:#334155,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef endStyle fill:#10b981,stroke:#34d399,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

Try answering these questions to check your understanding:

1. Why are persistent user profiles critical for real-world AI assistants?
   - A) They make the computer boot faster
   - B) They allow the agent to personalize tone, detail level, and tools to match each user's unique background without asking repeatedly
   - C) They eliminate the need for an LLM
   - D) They format CSS grids

2. Where in the workflow should the user profile be loaded from the Store API?
   - A) At the very start of the graph before the agent crafts its response
   - B) After the response has already been sent to the user
   - C) Never load it
   - D) Only on weekends

3. What legal requirement (such as GDPR) must be considered when storing long-term user profiles?
   - A) You must charge the user $10
   - B) Users have the Right to be Forgotten and must be able to view, edit, or delete their stored profile data
   - C) Profiles must be written in French
   - D) Profiles must be posted on Twitter

4. How do you prevent old profile records from causing errors when you add new fields to your profile schema?
   - A) By deleting all user accounts
   - B) By using Pydantic models with default values for new fields
   - C) By disabling Python type checks
   - D) By switching to SQLite

*Submit your answers (e.g. 1-B, 2-A, 3-B, 4-B) to verify your score!*
