# Conversational RAG Chains — Complete Guide

> "A courtroom stenographer rephrases follow-up pronouns like 'Did you see him there?' into standalone factual statements like 'Did the witness see the defendant at the bank?' before searching the court record."

---

## Table of Contents

1. [The Problem: Conversational Pronouns Break Vector Retrieval](#1-the-problem-conversational-pronouns-break-vector-retrieval)
2. [The Court Stenographer Analogy](#2-the-court-stenographer-analogy)
3. [The Mechanism: History-Aware Query Rephrasing](#3-the-mechanism-history-aware-query-rephrasing)
4. [Diagram: Conversational RAG Architecture](#4-diagram-conversational-rag-architecture)
5. [Code Walkthrough: End-to-End Conversational RAG Pipeline](#5-code-walkthrough-end-to-end-conversational-rag-pipeline)
6. [Comparing Standard RAG vs Conversational RAG](#6-comparing-standard-rag-vs-conversational-rag)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Conversational Pronouns Break Vector Retrieval

In multi-turn chat applications, users ask follow-up questions using pronouns ("How do I configure it?", "What is its price?").

### Why Raw Follow-Ups Fail in Vector DBs

```text
Turn 1: User asks: "Tell me about Redis persistence."
        Assistant answers: "Redis supports RDB snapshots and AOF logs."

Turn 2: User asks: "How do I configure it?"
        Raw Vector Search on "How do I configure it?":
        → Embedding has no idea what "it" refers to!
        → Retrieves random config guides for React, Docker, and Nginx.
        → Fails completely to retrieve Redis configuration documents.
```

### The Solution: History-Aware Retrieval

A sub-chain reformulates the latest user query into a standalone question incorporating conversation history *before* querying the vector database.

---

## 2. The Court Stenographer Analogy

When a lawyer asks, *"What was he wearing when you saw him?"*, the court record needs to be clear without ambiguity.

### Ambiguous Pronoun vs Clarified Record

```text
Lawyer's Question  → "What was he wearing when you saw him?" (Ambiguous).

Stenographer Record→ "What was defendant John Smith wearing when the
                      witness saw him at the First National Bank?"
```

### Mapping to LangChain

`create_history_aware_retriever` acts as the stenographer: it reads `[HumanMessage, AIMessage]` history and rewrites `"How do I configure it?"` into `"How do I configure Redis persistence in redis.conf?"`.

---

## 3. The Mechanism: History-Aware Query Rephrasing

LangChain provides high-level factory functions in `langchain.chains` for robust conversational RAG.

### Core Conversational RAG Components

```python
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# 1. Contextualize question prompt (rephraser)
rephrase_prompt = ChatPromptTemplate.from_messages([
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    ("human", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation. Don't answer the question, just formulate a search query.")
])

# 2. History-aware retriever sub-chain
history_retriever = create_history_aware_retriever(llm, retriever, rephrase_prompt)

# 3. Final document QA chain
qa_prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer based only on context:\n\n{context}"),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}")
])
qa_chain = create_stuff_documents_chain(llm, qa_prompt)

# 4. Master retrieval chain
rag_chain = create_retrieval_chain(history_retriever, qa_chain)
```

---

## 4. Diagram: Conversational RAG Architecture

### Two-Stage Contextual Retrieval and Generation

```text
User Input: "How do I enable it?" + History: [User: "Tell me about Redis AOF"]
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. History-Aware Rephraser LLM                              │
│    Rewrites query: "How to enable Redis AOF in redis.conf"   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Standalone Search Query)
┌─────────────────────────────────────────────────────────────┐
│ 2. Vector Store Retriever                                   │
│    Searches index using reformulated query                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Retrieved Docs: [redis.conf doc])
┌─────────────────────────────────────────────────────────────┐
│ 3. Stuff Documents Chain (QA Prompt)                        │
│    Injects {context} + {chat_history} + {input}             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Final Answer Generation                                  │
│    "To enable Redis AOF, set `appendonly yes` in redis.conf"│
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: End-to-End Conversational RAG Pipeline

A production-ready conversational RAG script supporting multi-turn state:

```python
# conversational_rag_demo.py
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

def create_conversational_rag():
    # 1. Ingest sample knowledge
    docs = [
        Document(page_content="Redis AOF (Append Only File) logs every write command. Enable with `appendonly yes` in redis.conf."),
        Document(page_content="Redis RDB snapshots the dataset at specified intervals. Configured via `save 60 1000`.")
    ]
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    retriever = FAISS.from_documents(docs, embeddings).as_retriever()
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # 2. Rephraser sub-chain
    rephrase_prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
        ("human", "Given conversation history, formulate a standalone search query.")
    ])
    history_retriever = create_history_aware_retriever(llm, retriever, rephrase_prompt)

    # 3. Answer synthesis chain
    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", "Answer the question using only the context below:\n\n{context}"),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}")
    ])
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)

    # 4. Master chain
    return create_retrieval_chain(history_retriever, question_answer_chain)

if __name__ == "__main__":
    rag = create_conversational_rag()
    history = [
        HumanMessage(content="What is Redis AOF?"),
        AIMessage(content="Redis AOF is an append-only file persistence mode that logs every write operation.")
    ]
    # Follow-up with pronoun "it"
    res = rag.invoke({"input": "How do I turn it on?", "chat_history": history})
    print("Answer:", res["answer"])
```

---

## 6. Comparing Standard RAG vs Conversational RAG

| Feature | Standard Single-Turn RAG | Conversational Multi-Turn RAG |
|---|---|---|
| Query Processing | Direct vector search on raw input | Reformulates input using history into standalone query |
| Context Injection | Documents only | Documents + Conversation message history |
| Handling Pronouns | Fails on "it", "they", "that one" | Resolves pronouns to prior entities accurately |
| LLM Invocations | 1 LLM call per query | 2 LLM calls per query (1 rephrase + 1 answer) |
| Latency Profile | Lower (~1s) | Slightly higher (~1.5s due to query rewrite step) |

---

## 7. Common Mistakes

- **Answering the question in the rephrase step.** The rephrase prompt must explicitly state: *"Do not answer the question, only output the rewritten search query."* Otherwise the model wastes completion tokens answering prematurely.
- **Passing chat history as raw strings.** `MessagesPlaceholder` requires a list of `BaseMessage` (`HumanMessage`, `AIMessage`); passing strings throws schema validation errors.
- **Rewriting the very first turn.** When `chat_history` is empty, `create_history_aware_retriever` automatically skips the rephrase LLM call to save latency and money.
- **Not returning source documents.** `create_retrieval_chain` returns a dictionary with keys `"answer"` and `"context"` (the retrieved documents); ensure your API forwards `"context"` for citations.
- **Unbounded chat history.** Sending 50 previous messages into the rephrase prompt exhausts context windows; always truncate or summarize history.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a standalone query rephraser chain and test it on 3 conversational follow-ups with ambiguous pronouns.

**Exercise 2:** Create an end-to-end `create_retrieval_chain` and simulate a 3-turn interactive conversation in a terminal loop.

**Exercise 3:** Inspect the intermediate keys of `create_retrieval_chain` and extract the exact list of retrieved `Document` chunks from `result["context"]`.

**Exercise 4:** Implement a fallback prompt that returns *"I don't have information about that in the knowledge base"* when retrieved context is empty.

**Exercise 5:** Benchmark the latency difference between a single-turn RAG query and a conversational RAG query with query rewriting.

---

## 9. Interview Q&A

**Q: Why does conversational multi-turn chat break naive vector search?**
Because users naturally refer back to previous concepts using pronouns ("how do I install it?", "compare that with PostgreSQL"). Naive vector search embeds the literal sentence "how do I install it?", which lacks the noun/entity required to match relevant document chunks in vector space.

**Q: How does `create_history_aware_retriever` resolve pronouns?**
It executes a fast pre-processing LLM call that takes the entire message history and the user's latest input, producing a disambiguated, standalone search query that explicitly names the intended entity before querying the vector store.

**Q: What is `create_stuff_documents_chain` in LangChain?**
It is a helper chain that formats a list of `Document` objects into a single context string (stuffing them into the `{context}` variable) and pipes them into a prompt template and LLM.

**Q: What dictionary keys does `create_retrieval_chain` take as input and produce as output?**
Inputs: `{"input": str, "chat_history": List[BaseMessage]}`. Outputs: `{"input": str, "chat_history": List[BaseMessage], "context": List[Document], "answer": str}`.

**Q: How does LangChain optimize the first turn of a conversation in `create_history_aware_retriever`?**
If `chat_history` is empty or not provided, `create_history_aware_retriever` skips the query rephrasing LLM call entirely and passes the raw input directly to the retriever, avoiding unnecessary latency and token costs.
