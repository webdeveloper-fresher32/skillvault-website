# Phase 9: Evaluation, Observability, and LangSmith

## What You'll Learn

Debug, evaluate, and regression-test LLM applications in production: configure zero-code LangSmith tracing, evaluate RAG chains using LLM-as-a-Judge (faithfulness, answer relevancy, Ragas framework), and write deterministic pytest unit tests by mocking model outputs.

## Learning Objectives

- Set up LangSmith tracing for LCEL chains and agents using environment variables and metadata tags.
- Evaluate RAG pipelines using LLM-as-a-Judge criteria: faithfulness, context precision, and ground truth similarity.
- Build reliable CI/CD pipelines by mocking LLM responses and vector stores using pytest.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-LangSmith-Tracing-and-Debugging.md](01-LangSmith-Tracing-and-Debugging.md) | LangSmith setup, trace visualization, run trees, metadata tags, latency/cost breakdown | 1 day |
| [02-RAG-and-Agent-Evaluators.md](02-RAG-and-Agent-Evaluators.md) | LLM-as-a-Judge, RAG triad (faithfulness, answer relevance, context recall), LangSmith evaluators | 1 day |
| [03-Unit-Testing-and-Mocking-Chains.md](03-Unit-Testing-and-Mocking-Chains.md) | Pytest for LCEL, `FakeListChatModel`, mocking retrievers, CI/CD regression testing | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: Production Optimization and Deployment](../Phase-10-Production-Optimization-and-Deployment/README.md)
