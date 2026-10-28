# Phase 2: Core Primitives: Tools, Resources, and Prompts

## What You'll Learn

Master the three foundational building blocks of the Model Context Protocol:
1. **Tools:** Model-controlled executable functions with JSON Schema parameter validation and error handling.
2. **Resources:** Application-controlled context streams, standardized URI schemes, and dynamic URI templates.
3. **Prompts:** User-controlled slash commands, reusable reasoning templates, and workflow orchestration.

## Learning Objectives

- Define custom MCP Tools with strict type validation, descriptions, and result content blocks.
- Construct static and dynamic URI Resources (`protocol://path/{id}`) with custom MIME types.
- Design enterprise Prompt templates with required and optional arguments for client UI surfacing.
- Understand the security and human-in-the-loop boundaries governing each primitive.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Tools-and-Callable-Functions.md](01-Tools-and-Callable-Functions.md) | Tools primitive, JSON Schema validation, execution mechanics, content blocks | 1 day |
| [02-Resources-and-Resource-Templates.md](02-Resources-and-Resource-Templates.md) | URI schemes, static vs dynamic resources, MIME types, text and binary data | 1 day |
| [03-Prompt-Templates-and-Workflows.md](03-Prompt-Templates-and-Workflows.md) | Pre-engineered prompt templates, arguments, slash commands, multi-turn messages | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Building MCP Servers in Python](../Phase-03-Building-MCP-Servers-in-Python/README.md)
