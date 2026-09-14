# LangSmith Tracing and Debugging — Complete Guide

> "An air traffic control radar screen maps the precise flight path, altitude, airspeed, and radio chatter of every aircraft in the airspace simultaneously."

---

## Table of Contents

1. [The Problem: The Black Box of Complex LLM Chains](#1-the-problem-the-black-box-of-complex-llm-chains)
2. [The Air Traffic Control Radar Analogy](#2-the-air-traffic-control-radar-analogy)
3. [The Mechanism: Zero-Code Tracing and Metadata Tagging](#3-the-mechanism-zero-code-tracing-and-metadata-tagging)
4. [Diagram: LangSmith Trace Tree Hierarchy](#4-diagram-langsmith-trace-tree-hierarchy)
5. [Code Walkthrough: Production Tracing with Custom Metadata](#5-code-walkthrough-production-tracing-with-custom-metadata)
6. [Comparing Raw Logging vs LangSmith Tracing](#6-comparing-raw-logging-vs-langsmith-tracing)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Black Box of Complex LLM Chains

When a conversational agent with 4 tools and 3 sub-chains fails or produces a hallucinated answer, standard Python tracebacks are completely unhelpful.

### The Debugging Nightmare

```text
User reports: "The bot gave an incorrect price for the enterprise tier!"
Traditional Logs:
  INFO: POST /api/chat 200 OK (Latency: 8.4s)
  → Which prompt was formatted?
  → What raw chunks did the vector store retrieve?
  → Did the tool return bad data or did the LLM misinterpret good data?
  → How many tokens were consumed at each nested step?
```

### The Solution: LangSmith Distributed Tracing

LangSmith automatically captures the full hierarchical execution tree—prompts, exact token inputs/outputs, latencies, costs, and metadata—with zero code modification.

---

## 2. The Air Traffic Control Radar Analogy

An aviation safety investigator does not rely on a pilot's vague verbal summary after an incident.

### Pilot Story vs Radar & Flight Data Recorder

```text
Pilot Story     → "We flew for 2 hours and landed roughly on schedule."
                  (Hides altitude drops and near-misses).

Radar & FDR     → Black box records engine throttle, rudder angles,
                  GPS coordinates, and ATC voice recordings every millisecond.
```

### Mapping to LangChain

LangSmith is the aviation radar and flight data recorder, visualizing every nested runnable call, tool payload, and model token generation in real time.

---

## 3. The Mechanism: Zero-Code Tracing and Metadata Tagging

LangSmith tracing is enabled globally via standard environment variables and enriched via config dictionaries.

### Core Configuration Flags

```bash
# Set in .env or deployment environment
export LANGCHAIN_TRACING_V2="true"
export LANGCHAIN_API_KEY="lsv2_pt_..."
export LANGCHAIN_PROJECT="skillvault-production"
export LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
```

### Injecting Custom Tags and Metadata at Runtime

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

chain = (
    ChatPromptTemplate.from_template("Summarize: {text}")
    | ChatOpenAI(model="gpt-4o")
    | StrOutputParser()
)

# Runtime trace enrichment
result = chain.invoke(
    {"text": "Production incident logs..."},
    config={
        "tags": ["tier:enterprise", "env:production"],
        "metadata": {
            "user_id": "usr_9981",
            "conversation_id": "conv_441",
            "feature_flag_model": "gpt-4o"
        }
    }
)
```

---

## 4. Diagram: LangSmith Trace Tree Hierarchy

### Hierarchical Run Tree Breakdown

```text
Root Run: RetrievalQAChain (Total: 1.84s | 850 tokens | $0.0042)
 │
 ├── Step 1: HistoryAwareRetriever (0.42s)
 │    ├── LLM: QueryRephraser (0.35s | 120 tokens) ──▶ "Redis AOF config"
 │    └── VectorStoreRetriever (0.07s) ──▶ Retrieved 2 chunks
 │
 ├── Step 2: PromptTemplate (0.001s)
 │    └── Injects {context} + {chat_history} + {input}
 │
 └── Step 3: ChatOpenAI (1.41s | 730 tokens)
      └── Generated tokens: "To configure Redis AOF..."
```

---

## 5. Code Walkthrough: Production Tracing with Custom Metadata

A production script wrapping LangSmith tracing with error capture and run URL generation:

```python
# langsmith_tracing_demo.py
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tracers.context import collect_runs

# Ensure environment variables are loaded
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "SkillVault-Demo"

def execute_traced_query(query: str, tenant_id: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an infrastructure advisor. Answer technically."),
        ("human", "{question}")
    ])
    model = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = prompt | model

    # Capture the exact LangSmith Run ID programmatically
    with collect_runs() as cb:
        response = chain.invoke(
            {"question": query},
            config={
                "tags": ["service:cloud_advisor", f"tenant:{tenant_id}"],
                "metadata": {"tenant_id": tenant_id, "deployment_region": "us-east-1"}
            }
        )
        run_id = cb.traced_runs[0].id
        print(f"Run completed! Trace ID: {run_id}")
        print(f"Inspect in LangSmith UI: https://smith.langchain.com/o/default/projects/p/SkillVault-Demo/r/{run_id}")

    return response.content

if __name__ == "__main__":
    ans = execute_traced_query("Explain VPC Peering vs Transit Gateway", "org_enterprise_99")
    print("\nAnswer:\n", ans[:100], "...")
```

---

## 6. Comparing Raw Logging vs LangSmith Tracing

| Dimension | Raw Application Logs (stdout / CloudWatch) | LangSmith Distributed Tracing |
|---|---|---|
| Trace Hierarchy | Flat, unstructured string lines | Deeply nested parent-child tree visualization |
| Prompt Inspection | Difficult to isolate multi-line prompts | Exact rendered inputs & raw API responses |
| Token / Cost Analytics | Requires manual calculation scripts | Automatic per-step token and dollar cost breakdown |
| Latency Profiling | Monolithic total request time only | Sub-millisecond timing for every individual step |
| Search & Filtering | Regex string search | Filter by tag, metadata, latency $> 2\text{s}$, or error status |

---

## 7. Common Mistakes

- **Forgetting `LANGCHAIN_TRACING_V2="true"`.** Setting `LANGCHAIN_API_KEY` without setting `LANGCHAIN_TRACING_V2="true"` prevents traces from uploading.
- **Leaking Sensitive PII into LangSmith.** Sending unredacted credit cards or passwords in prompts stores them in LangSmith traces; use LangSmith data masking or custom masking runnables.
- **Using a single default project for all environments.** Mixing development, staging, and production traces in one project corrupts latency and error metrics; configure separate `LANGCHAIN_PROJECT` names.
- **Not attaching `metadata` for customer support.** Without user IDs or tenant tags in `config={"metadata": ...}`, locating a specific customer's problematic run among 100,000 traces is impossible.
- **Blocking on trace uploads.** LangChain uploads traces in a background daemon thread; do not force blocking flushes unless shutting down short-lived AWS Lambda functions.

---

## 8. Hands-On Exercises

**Exercise 1:** Set up a free LangSmith account, export your API key, and verify your first traced LCEL chain appears in the dashboard.

**Exercise 2:** Run a chain with custom `tags=["experiment_v2"]` and `metadata={"user": "test_user"}` and filter for that run in the LangSmith web interface.

**Exercise 3:** Use `collect_runs()` context manager to extract the trace UUID programmatically from Python code.

**Exercise 4:** Build an agent that encounters a tool exception and inspect how LangSmith highlights the failed tool node in red.

**Exercise 5:** Compare token counts and estimated costs across `gpt-4o` and `gpt-4o-mini` for the same prompt using the LangSmith run viewer.

---

## 9. Interview Q&A

**Q: How does LangSmith capture traces without requiring code modifications across an existing LangChain application?**
LangSmith hooks directly into LangChain's underlying `Runnable` callback architecture. When `LANGCHAIN_TRACING_V2="true"` is set, a background `LangChainTracer` callback is automatically attached to the root of every chain execution, recording all component inputs, outputs, and timings.

**Q: What is the difference between `tags` and `metadata` in LangSmith run configurations?**
`tags` are strings used for broad categorization and filtering (e.g. `["production", "model:gpt-4o"]`). `metadata` is a key-value dictionary used for structured data, tracking user IDs, session IDs, git commit hashes, and dynamic configuration flags.

**Q: What is a "Run Tree" in LangSmith?**
A Run Tree is a hierarchical DAG representation of an execution. The root node represents the top-level pipeline (e.g. `AgentExecutor`), and child nodes represent intermediate steps (retrievers, prompt formatters, LLM calls, tool executions), showing exact parent-child causal relationships.

**Q: How do you prevent tracing overhead from increasing user latency?**
LangSmith uses an asynchronous, non-blocking background queue and thread pool to batch and upload trace telemetry to the LangSmith API, ensuring zero impact on user-facing request latency.

**Q: What should you do when using LangSmith inside short-lived serverless functions (like AWS Lambda)?**
Because Lambda freezes container processes immediately after an HTTP response, you must explicitly flush the background tracing queue before function exit using `from langchain_core.tracers.langchain import wait_for_all_tracers; wait_for_all_tracers()`.
