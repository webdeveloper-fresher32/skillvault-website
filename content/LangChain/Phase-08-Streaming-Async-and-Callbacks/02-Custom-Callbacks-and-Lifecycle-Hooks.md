# Custom Callbacks and Lifecycle Hooks — Complete Guide

> "An electric power grid's telemetry sensors record kilowatt load spikes, transformer temperatures, and circuit breaker trips across every substation without interrupting electricity transmission to homes."

---

## Table of Contents

1. [The Problem: Decoupling Observability from Business Logic](#1-the-problem-decoupling-observability-from-business-logic)
2. [The Power Grid Telemetry Analogy](#2-the-power-grid-telemetry-analogy)
3. [The Mechanism: BaseCallbackHandler and AsyncCallbackHandler](#3-the-mechanism-basecallbackhandler-and-asynccallbackhandler)
4. [Diagram: The Callback Lifecycle Interception Points](#4-diagram-the-callback-lifecycle-interception-points)
5. [Code Walkthrough: Production Latency and Token Usage Tracker](#5-code-walkthrough-production-latency-and-token-usage-tracker)
6. [Comparing Constructor Callbacks vs Request Callbacks](#6-comparing-constructor-callbacks-vs-request-callbacks)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Decoupling Observability from Business Logic

Hardcoding `print()`, Prometheus metric increments, Datadog timers, or token counters directly inside LCEL chain steps pollutes domain logic and makes code difficult to maintain.

### Scattered Logging vs Decoupled Callbacks

```text
Polluted Chain Code:
  def my_llm_step(x):
     t0 = time.time()
     res = llm.invoke(x)
     statsd.timing("llm.latency", time.time() - t0)
     datadog.increment("llm.tokens", count_tokens(res))
     return res

Clean Callback Architecture:
  chain = prompt | llm | parser
  chain.invoke(..., config={"callbacks": [MetricsCollector(), AuditLogger()]})
```

### The Solution: LangChain Callback Handlers

LangChain exposes an event-driven callback system (`BaseCallbackHandler`, `AsyncCallbackHandler`) that triggers lifecycle hooks at every critical execution boundary.

---

## 2. The Power Grid Telemetry Analogy

Electrical engineers do not splice analog meters into home living room walls to measure power generation at a hydro dam.

### In-Line Splicing vs Substation Telemetry

```text
In-Line Splicing     → Electrician cuts household power wires to plug in
                       a voltmeter; power flickers and disrupts appliances.

Telemetry Sensors    → Non-invasive inductive sensors clamp around cables;
                       records voltage and frequency passively without
                       affecting electron flow.
```

### Mapping to LangChain

The chain is the high-voltage transmission cable; `AsyncCallbackHandler` is the non-invasive telemetry sensor capturing metrics silently in the background.

---

## 3. The Mechanism: BaseCallbackHandler and AsyncCallbackHandler

Callback handlers implement hook methods triggered throughout the runnable lifecycle.

### Core Lifecycle Hook Methods

```python
from langchain_core.callbacks import AsyncCallbackHandler
from typing import Any, Dict, List

class PerformanceAuditHandler(AsyncCallbackHandler):
    async def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any) -> None:
        """Triggered when a chain starts running."""
        print(f"Chain started with inputs: {list(inputs.keys())}")

    async def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        """Triggered right before an LLM API call is dispatched."""
        print("LLM generation initiated...")

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Triggered on every streamed token chunk."""
        pass

    async def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> None:
        """Triggered when a tool begins execution."""
        print(f"Tool executing: {input_str}")
```

---

## 4. Diagram: The Callback Lifecycle Interception Points

### Full Execution Pipeline Hooks

```text
Runnable Execution Boundary
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. on_chain_start(inputs)                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. on_llm_start(prompts)                                    │
│    Model token generation begins                            │
│    ──▶ on_llm_new_token(token) [repeated per token]         │
│    ──▶ on_llm_end(response) [includes token usage]          │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ (Tool Call Required)      │ (No Tools)
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────────┐
│ 3. on_tool_start(args)    │ │ 4. on_chain_end(outputs)      │
│    ──▶ on_tool_end(output)│ │    Execution complete         │
└─────────────┬─────────────┘ └───────────────────────────────┘
              │
              └───────────────────────────┘
```

---

## 5. Code Walkthrough: Production Latency and Token Usage Tracker

A complete production callback measuring exact component latencies and aggregated token counts:

```python
# metrics_callback_demo.py
import time
from typing import Any, Dict, List
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

class TelemetryCallbackHandler(BaseCallbackHandler):
    def __init__(self):
        self.start_times: Dict[str, float] = {}
        self.total_tokens: int = 0

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], *, run_id, **kwargs: Any) -> None:
        self.start_times[str(run_id)] = time.perf_counter()

    def on_llm_end(self, response: LLMResult, *, run_id, **kwargs: Any) -> None:
        elapsed = time.perf_counter() - self.start_times.get(str(run_id), time.perf_counter())
        usage = response.llm_output.get("token_usage", {}) if response.llm_output else {}
        tokens = usage.get("total_tokens", 0)
        self.total_tokens += tokens
        print(f"[Telemetry] LLM Run {run_id} completed in {elapsed:.3f}s | Tokens: {tokens}")

    def on_chain_error(self, error: BaseException, *, run_id, **kwargs: Any) -> None:
        print(f"[Alert] Chain Run {run_id} failed with error: {error}")

if __name__ == "__main__":
    telemetry = TelemetryCallbackHandler()
    prompt = ChatPromptTemplate.from_template("Summarize the history of {subject} in 2 sentences.")
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = prompt | model

    # Pass handler via invocation config
    result = chain.invoke(
        {"subject": "quantum computing"},
        config={"callbacks": [telemetry]}
    )
    print("Final Output:", result.content)
    print(f"Total Session Tokens Tracked: {telemetry.total_tokens}")
```

---

## 6. Comparing Constructor Callbacks vs Request Callbacks

| Feature | Constructor Callbacks (`model = Model(callbacks=[...])`) | Request Callbacks (`chain.invoke(..., config={"callbacks": [...]})`) |
|---|---|---|
| Scope | Tied to that specific object instance only | Propagated across the entire downstream runnable graph |
| Concurrency Safety | Shared across all requests (danger of cross-request race conditions) | Scoped strictly to the individual request invocation |
| Dynamic Metadata | Cannot inject per-request user IDs or tenant headers | Easily injects dynamic request headers and user tags |
| Best Used For | Global loggers in single-threaded CLI scripts | Production multi-tenant web applications and APIs |

---

## 7. Common Mistakes

- **Using stateful constructor callbacks in concurrent web servers.** Setting a mutable callback on a shared global model instance causes data races between concurrent user requests; pass callbacks in `config={"callbacks": [...]}` per request.
- **Blocking asynchronous execution with synchronous callbacks.** Using synchronous `BaseCallbackHandler` doing slow network I/O inside async chains (`.ainvoke()`) blocks the asyncio event loop; subclass `AsyncCallbackHandler`.
- **Ignoring `run_id`.** In parallel tool executions, multiple callbacks fire concurrently; match start and end events using the unique `run_id` parameter.
- **Raising uncaught exceptions inside callbacks.** A failure inside a logging callback should never crash the user's primary AI response; wrap callback logic in defensive `try/except` blocks.
- **Forgetting `on_llm_error` / `on_chain_error`.** Monitoring only successful `on_llm_end` events leaves engineering teams blind to production failure rates and timeouts.

---

## 8. Hands-On Exercises

**Exercise 1:** Subclass `BaseCallbackHandler` to create a `DebugPrintHandler` that logs `on_tool_start` and `on_tool_end` events.

**Exercise 2:** Create a `TokenBudgetHandler` that calculates cumulative prompt and completion tokens and prints a warning when usage exceeds 1,000 tokens.

**Exercise 3:** Implement an `AsyncCallbackHandler` that logs timestamps to measure the exact latency of the retriever step in a RAG chain.

**Exercise 4:** Pass a callback via `config={"callbacks": [handler]}` to a multi-tool agent and verify that all intermediate tools trigger `on_tool_start`.

**Exercise 5:** Intentionally trigger an API authentication error and verify that your callback's `on_chain_error` method captures the exception.

---

## 9. Interview Q&A

**Q: What is the architectural difference between constructor callbacks and runtime request callbacks?**
Constructor callbacks are attached during object instantiation (`ChatOpenAI(callbacks=[h])`) and only monitor that specific object. Runtime request callbacks are passed during `.invoke(..., config={"callbacks": [h]})` and are automatically propagated down through every node in the execution graph, ensuring request isolation and thread safety.

**Q: Why should production web applications use `AsyncCallbackHandler` instead of `BaseCallbackHandler`?**
When web frameworks like FastAPI handle thousands of concurrent async requests, synchronous callbacks performing I/O (such as writing to a database or emitting an HTTP metric) will block Python's single event loop thread, degrading server throughput.

**Q: How does `run_id` enable distributed tracing across nested LangChain components?**
Every individual node invocation in an LCEL graph (prompt format, LLM call, retriever search, tool execution) is assigned a unique UUID `run_id` and a `parent_run_id`, allowing tracing systems (like LangSmith or OpenTelemetry) to reconstruct the exact execution tree.

**Q: Where can token usage metrics be extracted inside `on_llm_end`?**
Inside `response.llm_output["token_usage"]`, which contains a dictionary with provider-reported keys such as `prompt_tokens`, `completion_tokens`, and `total_tokens`.

**Q: Can callbacks be used to stream output to websockets?**
Yes. Implementing the `on_llm_new_token(token)` hook allows developers to push incremental token strings directly into a WebSocket or message queue as they are generated by the model.
