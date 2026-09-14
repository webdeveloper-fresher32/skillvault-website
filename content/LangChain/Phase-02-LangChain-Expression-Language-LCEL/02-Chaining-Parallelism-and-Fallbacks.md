# Chaining, Parallelism, and Fallbacks — Complete Guide

> "A dual-generator hospital power grid runs circuits in parallel and automatically trips a backup generator if the primary diesel engine stalls."

---

## Table of Contents

1. [The Problem: Fragile Sequential Pipelines](#1-the-problem-fragile-sequential-pipelines)
2. [The Dual-Generator Grid Analogy](#2-the-dual-generator-grid-analogy)
3. [The Mechanism: RunnableParallel, Fallbacks, and Retries](#3-the-mechanism-runnableparallel-fallbacks-and-retries)
4. [Diagram: Parallel Fan-Out and Fallback Flow](#4-diagram-parallel-fan-out-and-fallback-flow)
5. [Code Walkthrough: Resilient Multi-Provider Pipelines](#5-code-walkthrough-resilient-multi-provider-pipelines)
6. [Comparing Chaining Strategies](#6-comparing-chaining-strategies)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Fragile Sequential Pipelines

Complex AI systems require retrieving documents, querying SQL databases, and formatting user profiles simultaneously before generating a final response.

### The Latency and Outage Dilemma

```text
Sequential Execution:
  Fetch DB (500ms) ──▶ Fetch Docs (600ms) ──▶ Call Primary LLM (1200ms) = 2300ms
  If Primary LLM throws 500 error / rate limit ──▶ Entire user request fails immediately!
```

### The Solution: Parallelism and Declarative Fallbacks

`RunnableParallel` executes independent tasks concurrently, while `.with_fallbacks()` routes failed requests seamlessly to secondary models without breaking client requests.

---

## 2. The Dual-Generator Grid Analogy

Critical infrastructure does not depend on a single utility line without an automatic transfer switch (ATS) and auxiliary generators.

### Single Power Line vs Redundant Grid

```text
Single Line      → Storm knocks out primary transformer;
                    hospital loses power entirely (catastrophic failure).

Redundant Grid   → Primary grid and solar array supply wards in parallel.
                    If voltage drops, the transfer switch kicks on the
                    backup diesel generator within 50 milliseconds.
```

### Mapping to LCEL

`RunnableParallel` powers multiple branches simultaneously; `.with_fallbacks([backup_model])` is the automatic transfer switch activating backup intelligence.

---

## 3. The Mechanism: RunnableParallel, Fallbacks, and Retries

LangChain provides declarative decorators and runnable wrappers to handle fan-out, retries, and failovers.

### Core Parallel and Fallback APIs

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

# 1. RunnableParallel branches input to multiple runnables
parallel_chain = RunnableParallel({
    "original_query": RunnablePassthrough(),
    "summary": lambda x: x["text"][:100],
    "word_count": lambda x: len(x["text"].split())
})

# 2. Resilient model with automatic fallbacks and retries
primary_llm = ChatOpenAI(model="gpt-4o", max_retries=2)
backup_llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")

# Automatic failover if primary encounters rate limits or errors
robust_llm = primary_llm.with_fallbacks([backup_llm])
```

---

## 4. Diagram: Parallel Fan-Out and Fallback Flow

### Branching and Failover Architecture

```text
Incoming Input: {"question": "Explain Paxos consensus"}
                        │
       ┌────────────────┴────────────────┐
       ▼ (Parallel Execution)            ▼ (Parallel Execution)
┌──────────────────────────────┐  ┌─────────────────────────────┐
│ Branch A: Context Retriever  │  │ Branch B: Query Rewriter    │
│ (Searches vector database)   │  │ (Generates search keywords) │
└──────────────┬───────────────┘  └──────────────┬──────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                │ (Merged Dict: {"context": ..., "query": ...})
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChatPromptTemplate                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Primary LLM (GPT-4o with Retry)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │ (200 OK)                  │ (500 / Rate Limit / Timeout)
                 ▼                           ▼
            StrOutputParser      ┌────────────────────────────┐
                 │               │ Fallback LLM (Claude-3.5)  │
                 │               └─────────────┬──────────────┘
                 │                             ▼
                 │                      StrOutputParser
                 │                             │
                 ▼                             ▼
               Final Validated Response Output
```

---

## 5. Code Walkthrough: Resilient Multi-Provider Pipelines

A full script combining parallel retrieval, prompt assembly, and fallback failovers:

```python
# parallel_fallback_demo.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

def build_resilient_pipeline():
    # 1. Define parallel pre-processing branches
    branches = RunnableParallel(
        context=lambda x: f"Context for topic: {x['topic']}. Details: highly available systems.",
        topic=lambda x: x["topic"],
        length_pref=lambda x: x.get("length", "brief")
    )

    # 2. Prompt
    prompt = ChatPromptTemplate.from_template(
        "Using context: {context}\nTopic: {topic}\nProvide a {length_pref} explanation."
    )

    # 3. Models with fallback
    primary = ChatOpenAI(model="gpt-4o", temperature=0).with_retry(stop_after_attempt=2)
    fallback = ChatAnthropic(model="claude-3-5-sonnet-20241022", temperature=0)
    resilient_model = primary.with_fallbacks([fallback])

    # 4. Final pipeline
    return branches | prompt | resilient_model | StrOutputParser()

if __name__ == "__main__":
    chain = build_resilient_pipeline()
    result = chain.invoke({"topic": "Raft Consensus", "length": "concise"})
    print("Response:", result)
```

---

## 6. Comparing Chaining Strategies

| Strategy | LangChain Primitive | Execution Behavior | Latency Profile | Error Handling |
|---|---|---|---|---|
| Sequential Pipeline | `A \| B \| C` | Linear step-by-step | Sum of all steps ($T_a + T_b + T_c$) | Fails at first error |
| Parallel Fan-Out | `RunnableParallel({...})` | Concurrent execution across threads | Max of branches ($\max(T_a, T_b)$) | Branch failure fails chain |
| Fallback Failover | `.with_fallbacks([...])` | Tries primary, falls to secondary | Normal: $T_{\text{primary}}$, Fail: $T_p + T_s$ | Catches exceptions smoothly |
| Conditional Branch | `RunnableBranch` / Lambdas | Evaluates condition then routes | Only executed branch ($T_{\text{branch}}$) | Standard per-branch |

---

## 7. Common Mistakes

- **Forgetting that `RunnableParallel` takes dictionary keys.** Using `RunnableParallel(func1, func2)` instead of `RunnableParallel(key1=func1, key2=func2)` will raise a TypeError.
- **Using `.with_fallbacks()` for bad prompts.** If a prompt contains a syntax error, the fallback model will fail for the exact same reason; fallbacks protect against API outages, rate limits, and network errors.
- **Over-retrying with `.with_retry()`.** Setting `stop_after_attempt=10` delays failover to the backup model; keep retries to 2 or 3 attempts before triggering the fallback.
- **Passing mutable shared state to parallel branches.** If branch 1 mutates a dictionary key used by branch 2, non-deterministic race conditions occur.
- **Not logging fallback events.** Failing over silently without monitoring leaves teams blind to primary provider outages.

---

## 8. Hands-On Exercises

**Exercise 1:** Construct a `RunnableParallel` with two keys: `"title"` (extracts first line) and `"length"` (calculates character count).

**Exercise 2:** Create an intentional failure chain (e.g. invalid API key or model name) wrapped with `.with_fallbacks()` pointing to a valid model, and verify seamless execution.

**Exercise 3:** Configure a chat model with `.with_retry(stop_after_attempt=3, wait_exponential_jitter=True)` and inspect its retry parameters.

**Exercise 4:** Use `RunnableParallel` to invoke two different models with the same prompt and return a dictionary containing both models' outputs side-by-side.

**Exercise 5:** Build a `RunnableBranch` that inspects an input `"language"` key and routes to a Python-specialized prompt or a TypeScript-specialized prompt.

---

## 9. Interview Q&A

**Q: How does `RunnableParallel` reduce latency in complex RAG and agent chains?**
Instead of executing independent pre-processing steps sequentially (e.g. vector search, user profile fetching, keyword extraction), `RunnableParallel` runs them concurrently in separate worker threads, reducing total duration to the time of the single slowest task.

**Q: How does `.with_fallbacks()` work under the hood in LangChain?**
It returns a `RunnableWithFallbacks` object. When invoked, it executes the primary runnable inside a `try/except` block. If a caught exception occurs (such as rate limits or server errors), it immediately invokes the first fallback runnable in the sequence.

**Q: What is the difference between `.with_retry()` and `.with_fallbacks()`?**
`.with_retry()` retries the *same* component multiple times using backoff algorithms to recover from transient glitches. `.with_fallbacks()` switches to a completely *different* component (like another provider or smaller model) when the primary component fails.

**Q: Can `RunnableParallel` accept standard Python dictionaries in LCEL?**
Yes. In LCEL, passing a standard Python dict `{"context": retriever, "query": RunnablePassthrough()}` is automatically coerced into a `RunnableParallel` instance.

**Q: How do you bind runtime parameters like `temperature` or `stop_words` to a runnable dynamically?**
Using the `.bind()` method on any runnable, e.g., `model.bind(temperature=0.7, stop=["\n\n"])`, which returns a new runnable with those parameters pre-configured.
