# Project 2: Autonomous Data Analysis Agent

## Goal

Build an autonomous multi-tool data analyst agent that accepts natural language analytical questions, inspects relational database schemas, generates and executes safe SQL queries, runs Python statistical computations, generates charts, handles errors gracefully, and enforces strict iteration and execution time boundaries.

## What You'll Build

An autonomous analytics agent featuring:
1. SQL Database Inspection and Query Generation tools.
2. Sandboxed Python REPL for mathematical calculations and Pandas data transformations.
3. Chart Generation tool generating data visualizations.
4. Modern Tool-Calling Agent architecture using `create_tool_calling_agent` and `AgentExecutor`.
5. Error recovery interceptors for SQL syntax errors and bad table names.
6. Guardrail system blocking destructive SQL operations (`DROP`, `DELETE`, `UPDATE`).

## Phases Required

- Phase 01: Modern LangChain Ecosystem & Core Types
- Phase 02: LangChain Expression Language (LCEL)
- Phase 05: Tools, Function Calling, and Structured Outputs
- Phase 06: Agents and Tool Calling Workflows
- Phase 08: Streaming, Async, and Callbacks
- Phase 10: Production Optimization and Deployment

## Requirements

### Core Functionality
- **Database Tools**: Implement `@tool` functions to inspect schema definitions (`list_tables`, `get_table_schema`) and execute read-only SQL queries with row limits.
- **Python Execution Tool**: Provide a computational tool capable of running statistical calculations using Pandas and NumPy.
- **Agent Reasoning**: Build an autonomous ReAct loop using `create_tool_calling_agent` that dynamically breaks multi-step user queries into discrete tool actions.
- **Runtime Boundaries**: Configure `max_iterations=6`, `max_execution_time=25.0`, and `early_stopping_method="generate"` on `AgentExecutor`.
- **Security Guardrails**: Enforce strict validation blocking write operations on the database.

### Architecture Specifications
```text
User Analytical Query: "What was our highest-margin product category in Q3 2024?"
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Tool-Calling Agent (GPT-4o + bind_tools)                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      ▼                        ▼                        ▼
┌─────────────────┐  ┌───────────────────┐  ┌───────────────────────┐
│ list_tables &   │  │ run_safe_sql_query│  │ python_math_calculator│
│ describe_schema │  │ (Read-only, max50)│  │ (Pandas / Statistics) │
└─────────────────┘  └───────────────────┘  └───────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Scratchpad Feedback Loop & Final Answer Synthesis           │
└─────────────────────────────────────────────────────────────┘
```

## Suggested Approach

1. **Phase 1: Tool Definitions & Pydantic Schemas**
   - Create SQLite sample database (`ecommerce.db`) with `orders`, `customers`, and `products` tables.
   - Define `SQLQueryInput` Pydantic model with query validation.
   - Decorate SQL tools with `@tool(args_schema=SQLQueryInput)`.
   - Add regex validation blocking any query containing `DROP`, `ALTER`, `TRUNCATE`, `UPDATE`, or `DELETE`.

2. **Phase 2: Error Handling & Self-Correction**
   - Implement `handle_tool_error` on the SQL tool returning descriptive error strings when queries fail.
   - Test that intentional SQL syntax errors cause the model to inspect its scratchpad and retry with a corrected query.

3. **Phase 3: Agent Compilation**
   - Define a `ChatPromptTemplate` with a `MessagesPlaceholder("agent_scratchpad")`.
   - Compile the agent using `create_tool_calling_agent(llm, tools, prompt)`.
   - Instantiate `AgentExecutor` with `verbose=True`, `return_intermediate_steps=True`, and `max_iterations=6`.

4. **Phase 4: Execution & Verification**
   - Test multi-step questions requiring: (1) schema lookup, (2) SQL aggregation, and (3) percentage calculation.
   - Extract and format intermediate tool calls to display full reasoning audit trails.

## Stretch Goals

- Save generated charts as PNG files and return markdown image references.
- Implement structured output formatting so the agent returns answers with summary metrics and raw data tables.
- Add an evaluation benchmark testing SQL generation accuracy across 20 complex analytical questions.

## Evaluation Checklist

- [ ] Agent correctly queries schema before attempting to write SQL.
- [ ] Read-only guardrails strictly reject destructive statements (`DROP TABLE`).
- [ ] SQL syntax errors are caught and self-corrected by the agent in follow-up iterations.
- [ ] `AgentExecutor` terminates cleanly within `max_iterations` without infinite loops.
- [ ] Intermediate steps clearly show tool inputs, outputs, and reasoning steps.
