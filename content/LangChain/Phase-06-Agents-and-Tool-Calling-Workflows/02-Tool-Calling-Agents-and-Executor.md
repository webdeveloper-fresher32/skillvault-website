# Tool Calling Agents and Executor — Complete Guide

> "A project general contractor delegates blueprints to licensed electricians and plumbers, reviewing each specialist's completed inspection report before signing off on the final building."

---

## Table of Contents

1. [The Problem: Hand-Rolling Agent Execution Loops](#1-the-problem-hand-rolling-agent-execution-loops)
2. [The General Contractor Analogy](#2-the-general-contractor-analogy)
3. [The Mechanism: create_tool_calling_agent and AgentExecutor](#3-the-mechanism-create_tool_calling_agent-and-agentexecutor)
4. [Diagram: AgentExecutor Runtime Architecture](#4-diagram-agentexecutor-runtime-architecture)
5. [Code Walkthrough: Production Multi-Tool Agent with Intermediate Steps](#5-code-walkthrough-production-multi-tool-agent-with-intermediate-steps)
6. [Comparing Modern Tool-Calling Agents vs Legacy Agents](#6-comparing-modern-tool-calling-agents-vs-legacy-agents)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Hand-Rolling Agent Execution Loops

Writing manual `while` loops for tool execution requires repetitive boilerplate: managing message history, tracking timeouts, parsing parallel tool calls, and formatting intermediate outputs.

### The Boilerplate Burden

```text
Manual Loop Complexity:
  while True:
     ai_msg = llm.invoke(...)
     if not ai_msg.tool_calls: break
     # Must manually handle exceptions, format ToolMessages,
     # check max_iterations, record timings, and structure traces!
```

### The Solution: `create_tool_calling_agent` & `AgentExecutor`

LangChain's `create_tool_calling_agent` compiles prompt templates and tools into a standard runnable, while `AgentExecutor` manages the execution runtime, safety bounds, and step tracking.

---

## 2. The General Contractor Analogy

A general building contractor does not perform every plumbing and electrical task themselves; they coordinate licensed subcontractors.

### Solo Handyman vs General Contractor

```text
Solo Handyman     → Tries to do carpentry, wiring, and roofing; drops tasks when tired.
General Contractor→ Inspects architectural plan (Prompt); hires electrician (Tool 1)
                    and plumber (Tool 2); verifies completed work before handoff.
```

### Mapping to LangChain

`create_tool_calling_agent` creates the contractor's plan; `AgentExecutor` manages the schedule, subcontractor calls, and final inspection.

---

## 3. The Mechanism: create_tool_calling_agent and AgentExecutor

The tool-calling agent requires a prompt containing an `agent_scratchpad` `MessagesPlaceholder`.

### Initializing Agent and Executor

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

@tool
def get_stock_price(ticker: str) -> float:
    """Fetch real-time stock ticker price."""
    prices = {"AAPL": 195.50, "GOOGL": 178.20, "MSFT": 425.00}
    return prices.get(ticker.upper(), 0.0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a financial research assistant."),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

llm = ChatOpenAI(model="gpt-4o", temperature=0)
agent = create_tool_calling_agent(llm, [get_stock_price], prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=[get_stock_price],
    verbose=True,
    return_intermediate_steps=True
)
```

---

## 4. Diagram: AgentExecutor Runtime Architecture

### Execution Loop and Step Inspection

```text
Input: {"input": "Compare AAPL and MSFT prices"}
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. AgentExecutor Runtime (Tracks: iteration_count, timeout) │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Tool-Calling Agent Runnable (LLM + bind_tools)           │
│    Returns: [AgentAction(tool="get_stock_price", ...)]      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Tool Dispatcher (Executes tools and collects outputs)    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Scratchpad Update (Appends ToolMessages to scratchpad)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Agent Output Parser returns AgentFinish (Final response) │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production Multi-Tool Agent with Intermediate Steps

A production script demonstrating multi-tool execution, scratchpad tracking, and intermediate step logging:

```python
# agent_executor_demo.py
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

@tool
def get_user_tier(user_id: str) -> str:
    """Retrieve customer subscription level (Free, Pro, Enterprise)."""
    tiers = {"USR-1": "Pro", "USR-2": "Enterprise", "USR-3": "Free"}
    return tiers.get(user_id, "Free")

@tool
def calculate_discount(tier: str, base_price: float) -> float:
    """Calculate discounted price based on customer subscription tier."""
    discount_rates = {"Free": 0.0, "Pro": 0.15, "Enterprise": 0.30}
    return round(base_price * (1 - discount_rates.get(tier, 0.0)), 2)

def run_customer_agent(user_id: str, product_cost: float):
    tools = [get_user_tier, calculate_discount]
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an e-commerce assistant. Resolve customer pricing inquiries."),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad")
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        max_iterations=4,
        return_intermediate_steps=True
    )

    query = f"What is the final price for user {user_id} on a ${product_cost} item?"
    result = executor.invoke({"input": query})

    print("Output:", result["output"])
    print(f"Total intermediate tool calls: {len(result['intermediate_steps'])}")
    for action, obs in result["intermediate_steps"]:
        print(f"  Called: {action.tool}({action.tool_input}) ──▶ Output: {obs}")

if __name__ == "__main__":
    run_customer_agent("USR-2", 200.0)
```

---

## 6. Comparing Modern Tool-Calling Agents vs Legacy Agents

| Feature | Legacy `create_openai_tools_agent` | Modern `create_tool_calling_agent` | Legacy ReAct Agent (`create_react_agent`) |
|---|---|---|---|
| Model Compatibility | OpenAI models only | Multi-provider (OpenAI, Anthropic, Mistral) | Any raw text completion model |
| Invocation API | Custom tool schema binding | Universal `bind_tools()` | Text prompt with regex scratchpad |
| Parallel Tool Execution | Supported (OpenAI only) | Native across all modern tool-calling providers | No (Single sequential action per turn) |
| Scratchpad Format | `AIMessage` + `ToolMessage` | `AIMessage` + `ToolMessage` | Plain text: `"Thought: ... Action: ..."` |
| Performance | High | Highest & Universal | Low (frequent parsing exceptions) |

---

## 7. Common Mistakes

- **Forgetting `MessagesPlaceholder("agent_scratchpad")` in the prompt.** If the agent prompt is missing the scratchpad placeholder, `create_tool_calling_agent` will raise an immediate initialization error.
- **Passing tools to `create_tool_calling_agent` but omitting them from `AgentExecutor`.** The tools list must be provided to both: the agent needs them to format schemas for the LLM; the executor needs them to actually execute the Python functions!
- **Not setting `return_intermediate_steps=True` when auditing.** Without this flag, you only get the final text string, losing full visibility into what external APIs were touched.
- **Assuming `AgentExecutor` maintains multi-turn conversation memory by default.** `AgentExecutor` scratchpad only stores the *current turn's* tool steps; conversation history across turns must be passed explicitly via a `chat_history` placeholder.
- **Blocking inside tool execution.** Tools running long synchronous tasks block the whole executor; use async tools with `.ainvoke()`.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a tool-calling agent with 2 mathematical tools and run a query requiring both tools.

**Exercise 2:** Enable `verbose=True` and `return_intermediate_steps=True` on `AgentExecutor` and inspect the logged `AgentAction` objects.

**Exercise 3:** Add a `MessagesPlaceholder("chat_history")` to an agent prompt and invoke the executor with a multi-turn conversation list.

**Exercise 4:** Test an agent with an unanswerable query (no relevant tools) and confirm it responds conversationally without calling tools unnecessarily.

**Exercise 5:** Run an agent asynchronously using `await agent_executor.ainvoke({"input": "..."})` in an asyncio event loop.

---

## 9. Interview Q&A

**Q: What is the architectural difference between `create_tool_calling_agent` and `AgentExecutor`?**
`create_tool_calling_agent` compiles the prompt, LLM, and tool schemas into a `Runnable` that takes input and returns either an `AgentAction` (tool request) or `AgentFinish` (final answer). `AgentExecutor` is the runtime loop that invokes the agent, executes the requested tools, updates the scratchpad, and repeats until completion.

**Q: Why must `MessagesPlaceholder("agent_scratchpad")` be present in a tool-calling agent prompt?**
The scratchpad is where `AgentExecutor` injects the sequence of intermediate `AIMessage` (tool calls) and `ToolMessage` (tool results) generated during the current reasoning loop. Without it, the model cannot see the results of tools it previously called.

**Q: What information is contained inside an `AgentAction` object?**
`AgentAction` contains `tool` (name of the tool to invoke as a string), `tool_input` (dictionary or string of arguments to pass to the tool), and `log` (the thought or raw model response).

**Q: How does `AgentExecutor` handle parallel tool calls requested by frontier models?**
When the model returns multiple tool calls in a single turn, `AgentExecutor` parses all calls into a list of `AgentAction` objects, executes each corresponding tool (optionally in parallel threads), appends all resulting `ToolMessage`s, and invokes the model with the batch of observations.

**Q: Can `AgentExecutor` stream token-by-token output to a web client?**
Yes. You can stream agent execution using `agent_executor.astream_events(..., version="v2")` to capture both intermediate tool progress and final LLM token generation.
