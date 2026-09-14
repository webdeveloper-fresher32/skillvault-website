# ChatMessageHistory and Runnables — Complete Guide

> "A doctor's medical chart records every past diagnosis, allergy, and prescription, allowing any attending physician on shift to review patient history instantly before prescribing new treatment."

---

## Table of Contents

1. [The Problem: Stateless HTTP and Lost Conversation Context](#1-the-problem-stateless-http-and-lost-conversation-context)
2. [The Medical Chart Analogy](#2-the-medical-chart-analogy)
3. [The Mechanism: ChatMessageHistory and RunnableWithMessageHistory](#3-the-mechanism-chatmessagehistory-and-runnablewithmessagehistory)
4. [Diagram: Session-Aware Message Resolution Flow](#4-diagram-session-aware-message-resolution-flow)
5. [Code Walkthrough: Managing Multi-User Chat Sessions](#5-code-walkthrough-managing-multi-user-chat-sessions)
6. [Comparing Modern Runnable Memory vs Legacy Memory Classes](#6-comparing-modern-runnable-memory-vs-legacy-memory-classes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Stateless HTTP and Lost Conversation Context

LLMs have no memory across distinct HTTP requests. Every call to an LLM API is completely isolated and stateless.

### The Amnesia Problem in Web Apps

```text
Turn 1: User: "My name is Sarah and I'm learning Rust."
        AI: "Nice to meet you, Sarah! How can I help with Rust?"

Turn 2 (New HTTP Request): User: "What is my name?"
        AI: "I'm sorry, I don't know your name since I have no memory of past turns."
```

### The Solution: `RunnableWithMessageHistory`

LangChain's `RunnableWithMessageHistory` wraps any standard LCEL chain, automatically fetching history for a given `session_id`, injecting it into the prompt, and appending new messages on completion.

---

## 2. The Medical Chart Analogy

A hospital patient does not re-explain their entire life medical history every time a new nurse walks into the room.

### Verbal Memory vs Patient Medical Chart

```text
No Chart System  → Patient must restate blood type, surgeries, and allergies
                   to every doctor on duty (exhausting and dangerous).

Medical Chart    → Hospital assigns Patient ID #8891;
                   Every doctor pulls Chart #8891, reads past entries,
                   adds new prescription notes, and files it back into records.
```

### Mapping to LangChain

`session_id` is the Patient ID; `ChatMessageHistory` is the chart storing `BaseMessage` records; `RunnableWithMessageHistory` is the attending doctor reading and updating the chart.

---

## 3. The Mechanism: ChatMessageHistory and RunnableWithMessageHistory

LangChain standardizes memory via `BaseChatMessageHistory` implementations and the `RunnableWithMessageHistory` wrapper.

### Core Session History Components

```python
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI

# 1. In-memory session dictionary
session_store = {}

def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in session_store:
        session_store[session_id] = ChatMessageHistory()
    return session_store[session_id]

# 2. Base LCEL Chain with history slot
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful tutor."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}")
])
chain = prompt | ChatOpenAI(model="gpt-4o", temperature=0)

# 3. Session-aware runnable
conversational_chain = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="question",
    history_messages_key="history"
)
```

---

## 4. Diagram: Session-Aware Message Resolution Flow

### Request Interception and History Injection

```text
Client Call: chain.invoke({"question": "What is my name?"}, config={"configurable": {"session_id": "user_42"}})
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. RunnableWithMessageHistory Interceptor                               │
│    Calls: get_session_history("user_42") ──▶ Fetches [Human("My name...")]│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. Prompt Formatted with History Slot                                   │
│    Messages: [System, Human("My name is Sarah"), AI(...), Human("...")] │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Model Inference & Answer Generation                                  │
│    Output: AIMessage("Your name is Sarah!")                             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Automatic History Appending                                          │
│    Appends HumanMessage & AIMessage into session_store["user_42"]       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Managing Multi-User Chat Sessions

A production-ready module demonstrating multi-session isolation and dynamic configuration:

```python
# session_history_demo.py
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

store = {}

def get_by_session_id(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

def build_chat_app():
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an AI coding assistant. Answer concisely."),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{user_input}")
    ])
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    base_chain = prompt | model | StrOutputParser()

    return RunnableWithMessageHistory(
        base_chain,
        get_by_session_id,
        input_messages_key="user_input",
        history_messages_key="chat_history"
    )

if __name__ == "__main__":
    app = build_chat_app()

    # User Alice turn 1 & 2
    app.invoke({"user_input": "I like Go language."}, config={"configurable": {"session_id": "alice"}})
    res_alice = app.invoke({"user_input": "What language do I like?"}, config={"configurable": {"session_id": "alice"}})
    print("Alice Session:", res_alice)

    # User Bob (Isolated session)
    res_bob = app.invoke({"user_input": "What language do I like?"}, config={"configurable": {"session_id": "bob"}})
    print("Bob Session:", res_bob)
```

---

## 6. Comparing Modern Runnable Memory vs Legacy Memory Classes

| Feature | Legacy `ConversationBufferMemory` | Modern `RunnableWithMessageHistory` |
|---|---|---|
| Architecture | Stateful wrapper class (`memory.save_context`) | Pure LCEL wrapper over standard Runnables |
| Multi-User Support | Single session per class instance | Multi-tenant via dynamic `session_id` routing |
| Streaming Support | Poor / broken token streaming | Native `.stream()` and `.astream()` support |
| Storage Agnostic | Tied to legacy chain classes | Pluggable (Redis, PostgreSQL, DynamoDB, Mongo) |
| Inspection | Hard to trace in LangSmith | First-class tracing and tags in LangSmith |

---

## 7. Common Mistakes

- **Omitting `config={"configurable": {"session_id": "..."}}`.** Without passing the `session_id` in the config dictionary, the runnable cannot route to the appropriate user history and will error.
- **Mismatching `history_messages_key`.** The `history_messages_key` in `RunnableWithMessageHistory` must exactly match the `MessagesPlaceholder(variable_name="...")` string in the prompt.
- **Storing histories in global Python dicts in multi-pod deployments.** In-memory dicts are lost on container restart and cannot be shared across multiple Kubernetes pods; use Redis or SQL stores.
- **Passing raw strings into message histories.** Always append `HumanMessage`, `AIMessage`, or use `.add_user_message()` and `.add_ai_message()` helper methods.
- **Not budgeting for context window growth.** Storing every message forever eventually exceeds model token limits; implement pruning or summarization.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize a `ChatMessageHistory` object, add 2 user messages and 2 AI messages manually, and inspect `history.messages`.

**Exercise 2:** Construct a `RunnableWithMessageHistory` wrapping a simple greeting chain and test it across two distinct session IDs (`"session_1"`, `"session_2"`).

**Exercise 3:** Clear a specific session's history programmatically using `history.clear()` and assert that the next invocation starts with zero prior context.

**Exercise 4:** Stream tokens from a session-aware chain using `.astream()` and verify that the completed AI response is saved to history after streaming finishes.

**Exercise 5:** Inspect the LangSmith trace of a `RunnableWithMessageHistory` invocation and verify that the injected history messages are visible in the prompt payload.

---

## 9. Interview Q&A

**Q: Why was legacy `ConversationBufferMemory` deprecated in favor of `RunnableWithMessageHistory`?**
Legacy memory classes stored state inside the chain instance itself, making it difficult to support multi-tenant web applications, asynchronous streaming, and distributed session storage. `RunnableWithMessageHistory` cleanly decouples session retrieval from chain execution.

**Q: How does `RunnableWithMessageHistory` identify which user or conversation history to load?**
It extracts the `session_id` from the invocation configuration (`config={"configurable": {"session_id": "xyz"}}`) and passes that ID into a user-provided factory function (`get_session_history(session_id)`).

**Q: What is the role of `input_messages_key` and `history_messages_key`?**
`input_messages_key` tells the wrapper which key in the input dictionary contains the latest user prompt to save to history. `history_messages_key` tells the wrapper which variable in the `ChatPromptTemplate` should receive the historical messages.

**Q: What happens if a user starts a conversation with a new, unseen `session_id`?**
The `get_session_history` factory function instantiates and returns a brand-new, empty `ChatMessageHistory` object, and the chain executes with an empty history list.

**Q: Does `RunnableWithMessageHistory` save tool messages when used with agents?**
Yes. When wrapping an agent, it records the user input and the final agent response, and can optionally record full intermediate tool execution steps when configured.
