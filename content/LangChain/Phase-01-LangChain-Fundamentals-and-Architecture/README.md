# Phase 1: LangChain Fundamentals and Architecture

## What You'll Learn

Understand the modular architecture of modern LangChain (`langchain-core`, `langchain-community`, provider packages), how Chat Models differ from legacy LLMs, message types and prompt templates, and how structured output parsers transform raw text into validated Pydantic objects.

## Learning Objectives

- Distinguish the roles of `langchain-core`, `langchain-community`, and partner packages (`langchain-openai`, `langchain-anthropic`), avoiding deprecated monolith imports.
- Use `ChatPromptTemplate`, message roles (`SystemMessage`, `HumanMessage`, `AIMessage`, `ToolMessage`), and `MessagesPlaceholder` to manage dynamic conversations.
- Implement structured output parsers (`PydanticOutputParser`, `JsonOutputParser`, `StrOutputParser`) with schema validation and error-resilient prompt injections.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Modern-LangChain-Ecosystem.md](01-Modern-LangChain-Ecosystem.md) | Package architecture, core vs community vs partner libraries, import conventions, upgrade migration | 1 day |
| [02-Models-Prompts-and-Messages.md](02-Models-Prompts-and-Messages.md) | Chat models, message types, ChatPromptTemplate, message placeholders, temperature and model parameters | 1 day |
| [03-Output-Parsers-and-Schemas.md](03-Output-Parsers-and-Schemas.md) | StrOutputParser, JsonOutputParser, PydanticOutputParser, schema extraction, parsing error handling | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: LangChain Expression Language (LCEL)](../Phase-02-LangChain-Expression-Language-LCEL/README.md)
