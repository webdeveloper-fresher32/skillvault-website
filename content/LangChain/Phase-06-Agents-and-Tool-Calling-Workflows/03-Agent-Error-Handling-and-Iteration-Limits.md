# Agent Error Handling and Iteration Limits — Complete Guide

> "A Formula 1 racing car is equipped with automatic rev limiters and pit-lane speed governors to prevent catastrophic engine burnout during high-stress maneuvers."

---

## Table of Contents

1. [The Problem: Runaway Agent Loops and Hallucinated Arguments](#1-the-problem-runaway-agent-loops-and-hallucinated-arguments)
2. [The Engine Rev Limiter Analogy](#2-the-engine-rev-limiter-analogy)
3. [The Mechanism: max_iterations, Timeouts, and Error Handlers](#3-the-mechanism-max_iterations-timeouts-and-error-handlers)
4. [Diagram: Agent Error Interception and Recovery](#4-diagram-agent-error-interception-and-recovery)
5. [Code Walkthrough: Production Resilient Agent Runtime](#5-code-walkthrough-production-resilient-agent-runtime)
6. [Comparing Early Stopping Methods](#6-comparing-early-stopping-methods)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Runaway Agent Loops and Hallucinated Arguments

When an agent encounters a broken API endpoint, an unparsable schema, or a circular reasoning loop, it can spin indefinitely.

### The Infinite Loop Failure

```text
Turn 1: Agent calls SQL query ──▶ DB Error: "Table 'user_profiles' does not exist."
Turn 2: Agent retries same SQL query ──▶ DB Error: "Table 'user_profiles' does not exist."
Turn 3: Agent retries same SQL query ──▶ DB Error...
...
Turn 100: Agent has consumed 250,000 tokens ($15.00 cost) and timed out the HTTP client!
```

### The Solution: Deterministic Guardrails & Self-Correction

`AgentExecutor` enforces hard bounds (`max_iterations`, `max_execution_time`) and transforms tool exceptions into feedback strings so the model can course-correct.

---

## 2. The Engine Rev Limiter Analogy

A modern supercar does not allow a driver to downshift into 1st gear at 150 mph; an electronic rev limiter cuts the fuel injection to protect the engine block.

### Unrestricted Engine vs Rev-Limited Power Unit

```text
Unrestricted Engine → Driver steps on accelerator in neutral;
                       engine spins to 14,000 RPM and explodes (fatal crash).

Rev-Limited Engine   → Computer caps engine at 8,500 RPM max.
                       If sensor detects oil pressure drop, it switches
                       to "Limp Home Mode" safely.
```

### Mapping to LangChain

`max_iterations=5` is the rev limiter; `handle_tool_error=True` is the "Limp Home" recovery routine that passes error logs back to the LLM.

---

## 3. The Mechanism: max_iterations, Timeouts, and Error Handlers

LangChain provides configuration flags on `AgentExecutor` and tools to prevent runaway executions.

### Core Safety Parameters

```python
from langchain.agents import AgentExecutor
from langchain_core.tools import tool

@tool
def fragile_api_tool(param: str) -> str:
    """Query external microservice with automatic exception handling."""
    if not param.isalnum():
        raise ValueError("Invalid parameter: alphanumeric characters required.")
    return f"Processed {param}"

# 1. Attach custom exception handler to tool
fragile_api_tool.handle_tool_error = True  # Or pass a custom function

# 2. Configure safety boundaries on AgentExecutor
executor = AgentExecutor(
    agent=agent,
    tools=[fragile_api_tool],
    max_iterations=5,              # Maximum reasoning loop steps
    max_execution_time=15.0,        # Hard timeout in seconds
    early_stopping_method="generate", # Generate summary on timeout vs force stop
    handle_parsing_errors=True      # Recovers if model produces invalid JSON
)
```

---

## 4. Diagram: Agent Error Interception and Recovery

### Error Handling Decision Flow

```text
Agent emits Tool Action: fragile_api_tool("invalid@param!")
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Tool Execution Engine                                    │
│    Runs Python function ──▶ Raises ValueError               │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │ (handle_tool_error=False) │ (handle_tool_error=True)
          ▼                           ▼
┌──────────────────┐        ┌────────────────────────────────┐
│ Runtime Crash    │        │ 2. Error Converted to String   │
│ (500 Server Err) │        │ "Error: Invalid parameter..."  │
└──────────────────┘        └─────────┬──────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ToolMessage Appended to Scratchpad                       │
│    LLM reads error description in next reasoning turn       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Model Course-Correction Turn                             │
│    Thought: "My previous parameter had special characters.  │
│    Action: fragile_api_tool("cleanParam123")                │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production Resilient Agent Runtime

A complete script demonstrating custom error handling, iteration limits, and graceful early stopping:

```python
# resilient_agent_demo.py
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

def custom_tool_error_handler(error: Exception) -> str:
    return f"Tool execution failed with error: {str(error)}. Please try an alternative tool or parameter."

@tool
def buggy_database_tool(table_name: str) -> str:
    """Access internal database tables."""
    if table_name != "valid_users":
        raise KeyError(f"Table '{table_name}' does not exist in schema.")
    return "Query successful: 10 active records found."

buggy_database_tool.handle_tool_error = custom_tool_error_handler

def run_resilient_agent(query: str):
    tools = [buggy_database_tool]
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an automated support engineer. Handle database lookup errors gracefully."),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad")
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        max_iterations=3,
        max_execution_time=10.0,
        early_stopping_method="generate",
        handle_parsing_errors=True
    )

    return executor.invoke({"input": query})

if __name__ == "__main__":
    res = run_resilient_agent("Query the 'legacy_orders' table.")
    print("Agent Result:", res["output"])
```

---

## 6. Comparing Early Stopping Methods

| Early Stopping Method | Behavior on Timeout / Max Iterations | User Experience | Token Cost |
|---|---|---|---|
| `"force"` (Default) | Returns a generic string: *"Agent stopped due to max iterations."* | Abrupt, unhelpful to end users | Low (Zero additional LLM calls) |
| `"generate"` | Performs one final LLM call asking the model to summarize progress | Helpful, explains what was attempted and failed | 1 additional LLM completion call |
| Custom Callback | Triggers a webhook or alerts Sentry/PagerDuty | Enterprise-grade observability | Depends on implementation |

---

## 7. Common Mistakes

- **Leaving `handle_tool_error=False` in production.** Any unexpected network blip or API 500 error will bubble up as an unhandled Python exception, crashing the entire web request.
- **Setting `max_iterations` too high.** Values like `max_iterations=30` allow misaligned models to cycle endlessly; keep limits between 3 and 7 for standard agents.
- **Ignoring `max_execution_time`.** If a tool makes an HTTP call with a 60-second timeout, `max_iterations=3` could still take 3 full minutes without `max_execution_time`.
- **Not passing `handle_parsing_errors=True`.** If a model outputs malformed JSON in its thought stream, the parser crashes unless `handle_parsing_errors` is enabled.
- **Silent failure without alerting.** Catching errors inside tools without logging them hides backend service degradation from engineering teams.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a tool that intentionally raises a `ZeroDivisionError` and configure `handle_tool_error=True`. Observe the agent's response.

**Exercise 2:** Configure an `AgentExecutor` with `max_iterations=2` on a complex multi-step question and verify that execution terminates after 2 turns.

**Exercise 3:** Compare the output of `early_stopping_method="force"` versus `early_stopping_method="generate"` when an agent hits its iteration limit.

**Exercise 4:** Implement a custom tool error handler function that formats the error message into a structured JSON string.

**Exercise 5:** Add a 3-second `max_execution_time` to an agent with a tool that sleeps for 5 seconds and verify the timeout is triggered.

---

## 9. Interview Q&A

**Q: What is the primary function of `max_iterations` in `AgentExecutor`?**
It acts as a safety rev limiter that bounds the maximum number of reasoning loop cycles (thought $\to$ action $\to$ observation) the agent is permitted to execute, preventing infinite loops and runaway API token costs.

**Q: What is the difference between `early_stopping_method="force"` and `early_stopping_method="generate"`?**
`"force"` abruptly halts execution and returns a hardcoded error string when the iteration or time limit is reached. `"generate"` conducts one final LLM inference pass, asking the model to synthesize the best possible answer given the partial observations gathered so far.

**Q: How does `handle_tool_error=True` enable agent self-correction?**
Instead of raising an exception that crashes the Python runtime, it catches the error and serializes the exception message into a `ToolMessage`. The LLM reads this error message in its next turn and can adjust its arguments or pick an alternative tool.

**Q: Why is `handle_parsing_errors=True` essential when deploying agents with open-source LLMs?**
Open-source or smaller models occasionally output slightly malformed JSON or markdown delimiters. `handle_parsing_errors=True` catches parsing failures and feeds an error prompt back to the model, asking it to correct its output format.

**Q: How do you set a hard timeout on an agent run in LangChain?**
By configuring `max_execution_time=float` (in seconds) on `AgentExecutor`. If the elapsed wall-clock time exceeds this value, the executor immediately triggers the early stopping routine.
