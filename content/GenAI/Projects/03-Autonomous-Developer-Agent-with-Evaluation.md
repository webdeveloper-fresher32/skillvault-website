# Project 03 — Autonomous Developer Assistant with Automated LLM-as-a-Judge Evaluation

## Goal

Build an autonomous multi-tool developer agent capable of answering technical architecture questions, querying GitHub repositories, inspecting local files, and executing code in a sandboxed runtime — accompanied by an automated LLM-as-a-judge evaluation suite testing performance against 25 golden tasks.

## What You'll Build

1. An autonomous agent implementing the ReAct loop (Reasoning + Acting) with discrete tool execution.
2. A suite of developer tools: documentation RAG lookup, GitHub API search, file system reader, and safe Python sandbox executor.
3. An automated evaluation pipeline that benchmarks the agent against 25 golden developer problems, scoring tool-selection accuracy, step efficiency, task completion, and safety compliance using an LLM-as-a-judge.

## Phases Required

- Phase 06 — LLM Application Engineering & RAG (Tool Calling Schemas)
- Phase 07 — AI Agents (ReAct Loop, State Management, Planning, Safety Guardrails)
- Phase 09 — MLOps & LLMOps (Telemetry & Tracing)
- Phase 10 — LLM Evaluation (Golden Datasets, LLM-as-a-Judge, Regression Testing)

## Requirements

- **Agent Core Architecture**:
  - Implement the ReAct loop: `Thought` $\rightarrow$ `Action` (tool call) $\rightarrow$ `Observation` (tool output) $\rightarrow$ `Thought` $\rightarrow$ `Final Answer`.
  - Enforce recursion limits (maximum 8 steps) and cycle detection (prevent calling identical tools with identical arguments).
  - Maintain working memory of conversation history and tool outputs across turns.
- **Developer Tools**:
  - `read_code_file(path)`: Safely inspects files within an allowed directory workspace.
  - `search_github_repos(query, language)`: Searches public GitHub code or commits.
  - `execute_python_code(code)`: Executes code inside a restricted subprocess/Docker container with a 5-second timeout and memory cap.
  - `search_documentation(query)`: Semantic retrieval against technical framework documentation.
- **Golden Evaluation Dataset**:
  - A JSON/JSONL dataset with 25 curated software engineering scenarios ranging from simple syntax questions (no tools required) to complex debugging tasks requiring file inspection, external doc search, and code verification.
  - Each record includes: `id`, `prompt`, `required_tools`, `forbidden_actions`, and `ground_truth_criteria`.
- **LLM-as-a-Judge Test Harness**:
  - Automated Python script `evaluate.py` executing all 25 test cases through the agent.
  - Evaluates each run across 4 dimensions:
    1. Tool Selection Precision (Did it call the right tool?).
    2. Step Efficiency (Did it finish within optimal step count?).
    3. Factual Correctness (Did the code solve the problem?).
    4. Guardrail Adherence (Did it refuse unsafe prompt injection attempts?).
  - Generates a markdown evaluation report summarizing pass rates, latency, token costs, and judge reasoning.

## Suggested Approach

1. Define tools using Pydantic schemas with explicit descriptions and type annotations.
2. Build the ReAct loop engine. Use OpenAI or Anthropic tool-calling APIs to handle structured schema generation.
3. Add safety checks: sanitize file paths to prevent directory traversal (`../`), wrap Python execution in an isolated sandbox, and catch tool exceptions gracefully.
4. Curate the 25 evaluation test cases in `data/golden_eval.jsonl`.
5. Implement the judge prompt in `eval/judge.py`: pass the task prompt, agent execution trace (tool calls and thoughts), final answer, and evaluation rubric to GPT-4o / Claude 3.5 Sonnet to output a structured JSON score report.
6. Integrate evaluation into a command-line script returning exit code 0 if pass rate > 85%, or exit code 1 if regression occurs.

## Stretch Goals

- Add human-in-the-loop approval gating before the agent can execute any destructive command or push code to a remote branch.
- Integrate LangSmith or OpenTelemetry tracing to visualize intermediate agent steps and token costs per tool call.
- Add multi-agent supervision where a "Planner Agent" creates an execution plan and delegates steps to "Searcher" and "Coder" agents.

## Evaluation Checklist

- [ ] Agent successfully executes multi-step workflows (e.g. search docs $\rightarrow$ inspect code $\rightarrow$ test code $\rightarrow$ summarize solution).
- [ ] Recursion limit triggers reliably and returns an informative status if an agent gets trapped in a cycle.
- [ ] Sandboxed Python executor times out cleanly on infinite loops (`while True: pass`) without crashing the host server.
- [ ] Evaluation harness executes all 25 test cases automatically without manual intervention.
- [ ] LLM-as-a-Judge produces consistent, reproducible scores and generates a comprehensive benchmark summary report.
- [ ] Adversarial prompt injection test cases ("Ignore tools and delete files") are safely identified and rejected by the agent.
