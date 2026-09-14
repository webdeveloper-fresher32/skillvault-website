# Defining Custom Tools and Schemas — Complete Guide

> "A certified pilot's cockpit manual specifies the exact function, safety boundaries, and input dial readings for every switch on the control panel."

---

## Table of Contents

1. [The Problem: LLMs Are Isolated Reasoning Engines](#1-the-problem-llms-are-isolated-reasoning-engines)
2. [The Cockpit Control Manual Analogy](#2-the-cockpit-control-manual-analogy)
3. [The Mechanism: The @tool Decorator and BaseTool](#3-the-mechanism-the-tool-decorator-and-basetool)
4. [Diagram: Tool Definition and Schema Extraction](#4-diagram-tool-definition-and-schema-extraction)
5. [Code Walkthrough: Production Tool with Pydantic Validation](#5-code-walkthrough-production-tool-with-pydantic-validation)
6. [Comparing Tool Definition Approaches](#6-comparing-tool-definition-approaches)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: LLMs Are Isolated Reasoning Engines

LLMs cannot check live stock prices, query production SQL databases, or send email alerts without external tool bindings.

### Why Informal Function Descriptions Break

```text
Vague Tool Description:
  "Tool: sql_query. Run SQL."
  → LLM generates: sql_query(query="DROP TABLE users;--")
  → Model has no idea what parameters are required or their types.
  → No runtime validation of arguments before executing dangerous code.
```

### The Solution: Strongly-Typed LangChain Tools

LangChain converts Python functions and Pydantic schemas into standardized JSON Schema specifications consumed natively by frontier LLMs.

---

## 2. The Cockpit Control Manual Analogy

An aircraft manufacturer does not install unlabeled black switches in a cockpit.

### Unlabeled Switches vs Certified Flight Manual

```text
Unlabeled Switch → Pilot flips a random toggle hoping it deploys landing gear;
                   accidentally dumps fuel instead.

Certified Manual → Switch: "Flaps Deployer"
                   Args: angle (int, 0-40 degrees), altitude_limit (ft).
                   The flight computer validates inputs before moving hydraulic arms.
```

### Mapping to LangChain Tools

The `@tool` docstring is the manual explaining *when* to use the tool; the Pydantic schema specifies the exact parameter types and boundaries.

---

## 3. The Mechanism: The @tool Decorator and BaseTool

LangChain tools inherit from `BaseTool` or are instantiated via the `@tool` decorator.

### Defining Tools with Decorator and Class

```python
from langchain_core.tools import tool, BaseTool
from pydantic import BaseModel, Field
from typing import Type

# 1. Pydantic parameter schema
class PaymentRefundInput(BaseModel):
    transaction_id: str = Field(description="Unique transaction ID e.g. tx_12345")
    amount_cents: int = Field(gt=0, description="Refund amount in integer cents")
    reason: str = Field(description="Customer explanation for refund")

# 2. Defining tool using @tool decorator with explicit args_schema
@tool(args_schema=PaymentRefundInput)
def process_refund(transaction_id: str, amount_cents: int, reason: str) -> str:
    """Issue a full or partial refund for a customer transaction."""
    # Production API call here
    return f"Successfully refunded {amount_cents} cents for {transaction_id}."

# Inspect generated JSON schema sent to LLM
json_schema = process_refund.args
```

---

## 4. Diagram: Tool Definition and Schema Extraction

### Tool Registration Lifecycle

```text
Python Function + Docstring + Pydantic Schema
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. @tool Decorator Introspection                            │
│    - Extracts tool name: "process_refund"                   │
│    - Extracts description: "Issue a full or partial refund."│
│    - Generates JSON Schema from Pydantic model              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (OpenAPI / JSON Schema Payload)
┌─────────────────────────────────────────────────────────────┐
│ 2. Tool Definition Sent to Chat Model                       │
│    {                                                        │
│      "type": "function",                                    │
│      "function": {                                          │
│        "name": "process_refund",                            │
│        "description": "Issue a full or partial refund...",  │
│        "parameters": { "type": "object", ... }              │
│      }                                                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production Tool with Pydantic Validation

A complete production tool implementation featuring error handling and async support:

```python
# custom_tool_demo.py
import asyncio
from typing import Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool

class DatabaseQueryInput(BaseModel):
    table_name: str = Field(description="Name of the database table to query")
    limit: int = Field(default=5, ge=1, le=50, description="Max rows to return")

class SecureDatabaseTool(BaseTool):
    name: str = "secure_db_query"
    description: str = "Query public database tables with strict row limits. Use for user lookups."
    args_schema: Type[BaseModel] = DatabaseQueryInput
    return_direct: bool = False

    def _run(self, table_name: str, limit: int = 5) -> str:
        # Mock database lookup
        allowed_tables = ["users", "courses", "orders"]
        if table_name not in allowed_tables:
            return f"Error: Access to table '{table_name}' is restricted."
        return f"Fetched {limit} records from table '{table_name}' successfully."

    async def _arun(self, table_name: str, limit: int = 5) -> str:
        # Async execution path
        return self._run(table_name, limit)

if __name__ == "__main__":
    tool_instance = SecureDatabaseTool()
    print("Tool Name:", tool_instance.name)
    print("Tool Schema:", tool_instance.args)
    result = tool_instance.invoke({"table_name": "users", "limit": 3})
    print("Execution Result:", result)
```

---

## 6. Comparing Tool Definition Approaches

| Feature | `@tool` Function Decorator | `BaseTool` Subclassing | `StructuredTool.from_function()` |
|---|---|---|---|
| Boilerplate | Minimal (1 decorator on a function) | Medium (explicit class definition) | Low (wraps existing functions) |
| Async Support | Auto-wraps async functions (`async def`) | Explicit `_run` and `_arun` methods | Requires passing `coroutine` parameter |
| Injected State | Via `InjectedToolArg` | Via class instance attributes | Via kwargs closures |
| Custom Validation | Passed via `args_schema=Schema` | Defined as `args_schema: Type[BaseModel]` | Passed via `args_schema` |
| Best Used For | 90% of custom utility functions | Complex tools with database/API client state | Converting 3rd party SDK functions |

---

## 7. Common Mistakes

- **Writing vague docstrings.** The LLM decides whether to call a tool based *entirely* on the docstring and name. A docstring like `"Does math"` causes the model to call the tool at the wrong times.
- **Not specifying parameter descriptions.** Omitting `Field(description="...")` inside Pydantic schemas leaves the LLM guessing what values are valid.
- **Throwing unhandled exceptions inside tools.** If a tool raises an unhandled Python exception, the entire agent run crashes; catch exceptions and return a descriptive error string.
- **Forgetting `async` implementation.** If your application uses `ainvoke()`, defining a synchronous tool without `_arun` can block the event loop or raise a NotImplementedError.
- **Allowing unbounded integer inputs.** Always use Pydantic validators (`ge=1, le=100`) to prevent models from requesting 10,000,000 database rows.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a weather tool using `@tool` that takes a `city: str` and `unit: Literal["celsius", "fahrenheit"]` with descriptive docstrings.

**Exercise 2:** Define a Pydantic schema with constraints (`min_length=3`, `max_length=50`) and bind it to a tool using `@tool(args_schema=...)`.

**Exercise 3:** Subclass `BaseTool` to create a `CalculatorTool` implementing both `_run` and `_arun` methods.

**Exercise 4:** Intentionally invoke a tool with invalid arguments (e.g. negative number when `gt=0`) and observe the Pydantic `ValidationError`.

**Exercise 5:** Inspect the generated JSON schema of a tool by printing `tool.args` and verify that field descriptions match your Pydantic definitions.

---

## 9. Interview Q&A

**Q: How does an LLM know when and how to call a custom LangChain tool?**
LangChain converts the tool's name, docstring, and Pydantic argument schema into a JSON Schema format (OpenAI function calling specification). The model inspects this schema and, if relevant to the user query, outputs a structured `tool_calls` object.

**Q: What is the purpose of `args_schema` in LangChain tools?**
`args_schema` specifies a Pydantic `BaseModel` that enforces strict typing, default values, and boundary constraints on the arguments generated by the LLM before the tool's execution function runs.

**Q: What happens if a tool raises an exception during execution?**
By default, an unhandled exception will crash the agent execution. Setting `handle_tool_error=True` catches errors and returns the exception message back to the LLM so it can retry or explain the failure.

**Q: What is the difference between `_run` and `_arun` in `BaseTool`?**
`_run` is the synchronous execution handler called by `.invoke()`. `_arun` is the asynchronous execution handler called by `.ainvoke()`.

**Q: Why should tool descriptions describe "when" to use the tool in addition to "what" it does?**
LLMs rely on semantic routing. Explicitly stating "Use this tool when the user asks for account billing information, but do NOT use for general support" prevents tool misuse and hallucinated calls.
