# Runnable Protocol and Primitives — Complete Guide

> "Unix pipes allow small, single-purpose utilities to be chained together using a universal standard input/output interface."

---

## Table of Contents

1. [The Problem: Inconsistent Class Interfaces](#1-the-problem-inconsistent-class-interfaces)
2. [The Unix Pipe Analogy](#2-the-unix-pipe-analogy)
3. [The Mechanism: The Runnable Interface and Primitives](#3-the-mechanism-the-runnable-interface-and-primitives)
4. [Diagram: The Runnable Protocol Pipeline](#4-diagram-the-runnable-protocol-pipeline)
5. [Code Walkthrough: Composing Custom Primitives](#5-code-walkthrough-composing-custom-primitives)
6. [Comparing Runnable Methods](#6-comparing-runnable-methods)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Inconsistent Class Interfaces

In legacy frameworks, every component exposed a different method signature: `model.predict()`, `prompt.format()`, `chain.run()`, or `retriever.get_relevant_documents()`.

### The Interface Chaos

```text
Legacy Fragmentation:
  text = prompt.format(query="hello")
  resp = model.predict(text)
  result = parser.parse(resp)
  
  → Cannot stream intermediate tokens easily
  → Cannot automatically run async operations in parallel
  → Impossible to build standard monitoring or fallbacks across components
```

### The Solution: Universal Runnable Protocol

The `Runnable` protocol standardizes execution across all components with synchronous, asynchronous, batch, and streaming methods.

---

## 2. The Unix Pipe Analogy

Unix command-line tools (`cat`, `grep`, `awk`, `sort`) do not care who produced the data; they all read from `stdin` and write to `stdout` via the pipe (`|`) operator.

### Ad-Hoc Scripts vs Unix Pipes

```text
Ad-Hoc Scripts   → One script writes a CSV file, another reads a JSON file,
                    a third requires custom CLI flags (brittle).

Unix Pipeline    → cat logs.txt | grep "ERROR" | awk '{print $4}' | sort
                    Unified streaming protocol across every program.
```

### Mapping to LCEL

In LangChain Expression Language (LCEL), `prompt | model | parser` chains components together using Python's `__or__` operator because each component is a `Runnable`.

---

## 3. The Mechanism: The Runnable Interface and Primitives

Every runnable in `langchain-core` implements a standard protocol and provides foundational primitives like `RunnablePassthrough` and `RunnableLambda`.

### Core Primitives

```python
from langchain_core.runnables import (
    RunnablePassthrough,
    RunnableLambda,
    RunnableParallel
)

# 1. RunnableLambda converts any Python function into a Runnable
def uppercase_cleaner(text: str) -> str:
    return text.strip().upper()

cleaner_runnable = RunnableLambda(uppercase_cleaner)

# 2. RunnablePassthrough passes inputs through unchanged or assigns new keys
passthrough = RunnablePassthrough()
assigner = RunnablePassthrough.assign(length=lambda x: len(x["text"]))

# 3. Invocation using standard protocol
output = assigner.invoke({"text": "LangChain"})
# Result: {"text": "LangChain", "length": 9}
```

---

## 4. Diagram: The Runnable Protocol Pipeline

### Execution Flow

```text
Input: {"topic": "Microservices"}
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. RunnablePassthrough.assign(word_count=...)               │
│    Transforms input dictionary into augmented state         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ChatPromptTemplate                                       │
│    Formats system/human messages into PromptValue           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BaseChatModel                                            │
│    Executes inference and streams/returns AIMessage         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. StrOutputParser                                          │
│    Extracts raw string content from AIMessage               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
Output: "Microservices partition applications into services."
```

---

## 5. Code Walkthrough: Composing Custom Primitives

A complete module illustrating custom `RunnableLambda` validation, input assignment, and execution:

```python
# runnable_primitives_demo.py
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

def sanitize_input(data: dict) -> dict:
    query = data.get("query", "").strip()
    if len(query) < 3:
        raise ValueError("Query too short for processing.")
    return {"query": query, "char_count": len(query)}

def build_annotated_chain():
    sanitizer = RunnableLambda(sanitize_input)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an assistant. The query length was {char_count} chars."),
        ("human", "Answer: {query}")
    ])
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    parser = StrOutputParser()

    # LCEL pipeline
    chain = sanitizer | prompt | model | parser
    return chain

if __name__ == "__main__":
    chain = build_annotated_chain()
    result = chain.invoke({"query": "Explain LCEL in 10 words"})
    print("Result:", result)
```

---

## 6. Comparing Runnable Methods

| Method | Execution Mode | Input | Output | Primary Use Case |
|---|---|---|---|---|
| `invoke(input)` | Synchronous | Single input | Single output | Standard blocking single request |
| `ainvoke(input)` | Asynchronous | Single input | Single output | High-concurrency async servers (FastAPI) |
| `batch(inputs)` | Synchronous | List of inputs | List of outputs | Local multi-query batching with auto-threading |
| `abatch(inputs)` | Asynchronous | List of inputs | List of outputs | Async multi-query batching over network |
| `stream(input)` | Synchronous | Single input | Iterator of chunks | Streaming tokens to CLI or console |
| `astream(input)` | Asynchronous | Single input | Async iterator of chunks | Real-time web streaming to frontends (SSE) |

---

## 7. Common Mistakes

- **Using plain functions in LCEL without `RunnableLambda`.** While modern LangChain auto-coerces simple functions in pipe operations, explicitly wrapping them with `RunnableLambda` allows custom names, tracing tags, and error handling.
- **Mutating input state inside `RunnableLambda`.** Always return a new dictionary or modified copy; in-place mutations cause race conditions when running in parallel branches.
- **Forgetting that `RunnablePassthrough.assign()` requires dictionary inputs.** Calling `.assign()` when the input is a raw string or integer will raise a `ValueError`.
- **Mixing blocking `invoke()` inside asynchronous event loops.** Always use `await chain.ainvoke()` inside `async def` functions to prevent blocking the asyncio loop.
- **Not passing configuration dictionaries.** Dynamic settings (e.g. `run_name`, `tags`, `callbacks`) should be passed via `chain.invoke(input, config={"tags": ["prod"]})`.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a Python function `normalize_text` and wrap it in a `RunnableLambda`. Invoke it with dirty string input and assert clean output.

**Exercise 2:** Create a dictionary pipeline using `RunnablePassthrough.assign()` that adds a timestamp key to an incoming dictionary payload.

**Exercise 3:** Build a chain `prompt | model | parser` and invoke it across 5 distinct inputs simultaneously using the `.batch()` method.

**Exercise 4:** Use `.stream()` on a chain and iterate through the yielded token chunks, printing each chunk to stdout with `flush=True`.

**Exercise 5:** Write an async function that runs two distinct LCEL chains concurrently using `asyncio.gather` and `ainvoke()`.

---

## 9. Interview Q&A

**Q: What is a `Runnable` in LangChain and why was it introduced?**
A `Runnable` is a unified standard interface in `langchain-core` that provides synchronous, asynchronous, batch, and streaming execution across all components (prompts, models, retrievers, parsers, and custom functions), eliminating interface fragmentation.

**Q: How does `RunnablePassthrough` differ from `RunnablePassthrough.assign()`?**
`RunnablePassthrough` takes an input and passes it forward completely unchanged. `RunnablePassthrough.assign()` takes an input dictionary and appends or updates specific keys using provided runnables or lambdas while keeping the rest of the dictionary intact.

**Q: How does the pipe (`|`) operator work in Python with LangChain components?**
LangChain overrides the `__or__` and `__ror__` magic methods on the `Runnable` base class. When `A | B` is evaluated, it returns a `RunnableSequence(first=A, middle=[], last=B)` that automatically connects the output of A to the input of B.

**Q: What is the advantage of using `.batch()` over calling `.invoke()` in a loop?**
`.batch()` uses internal thread pools and provider-specific batch APIs to execute multiple requests concurrently, dramatically reducing total latency without requiring manual `asyncio` or threading boilerplate.

**Q: What does `RunnableLambda` provide beyond a standard Python `lambda`?**
It converts any standard synchronous or asynchronous function into a full `Runnable`, adding support for `ainvoke`, `batch`, `stream`, automatic tracing in LangSmith, and dynamic configuration via `config`.
