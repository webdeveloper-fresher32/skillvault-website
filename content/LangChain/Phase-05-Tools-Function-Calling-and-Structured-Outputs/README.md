# Phase 5: Tools, Function Calling, and Structured Outputs

## What You'll Learn

Equip LLMs with the ability to take actions in the real world: define custom tools with `@tool` and Pydantic schemas, bind tools to frontier chat models via `.bind_tools()`, and extract guaranteed structured JSON outputs using `.with_structured_output()`.

## Learning Objectives

- Define custom tools using the `@tool` decorator, `BaseTool` class, docstring specifications, and Pydantic parameter schemas.
- Bind tools to chat models using `llm.bind_tools([tool1, tool2])` and inspect structured `tool_calls` in `AIMessage`.
- Extract deterministic structured data using `llm.with_structured_output(Schema)` across OpenAI, Anthropic, and open-source models.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Defining-Custom-Tools-and-Schemas.md](01-Defining-Custom-Tools-and-Schemas.md) | `@tool` decorator, Pydantic argument schemas, BaseTool inheritance, tool error handling | 1 day |
| [02-Model-Tool-Calling-Mechanics.md](02-Model-Tool-Calling-Mechanics.md) | `bind_tools()`, tool_choice, parsing AIMessage.tool_calls, executing tools and returning ToolMessage | 1 day |
| [03-Structured-Outputs-with-Pydantic.md](03-Structured-Outputs-with-Pydantic.md) | `with_structured_output()`, function calling vs JSON mode, TypedDict vs Pydantic schemas | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Agents and Tool Calling Workflows](../Phase-06-Agents-and-Tool-Calling-Workflows/README.md)
