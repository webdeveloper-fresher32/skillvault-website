# Phase 10: Production Deployment and LangGraph Cloud

## What You'll Learn

Deploy, monitor, and manage production-grade LangGraph applications: configure `langgraph.json` manifests and use the LangGraph CLI, leverage LangGraph Studio for local visual graph debugging and state inspection, deploy serverless agent services to LangGraph Cloud, and build custom self-hosted Docker and Kubernetes production architectures.

## Learning Objectives

- Author production `langgraph.json` configuration manifests defining graphs, dependencies, and environments.
- Use LangGraph Studio for real-time visual step-through graph execution and state manipulation.
- Deploy scalable multi-tenant agent graphs to LangGraph Cloud with managed persistence and streaming APIs.
- Package and deploy production self-hosted LangGraph services using Docker, PostgreSQL, and Redis.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-LangGraph-CLI-and-Configuration.md](01-LangGraph-CLI-and-Configuration.md) | `langgraph.json`, CLI commands (`langgraph dev`, `langgraph build`), env variables | 1 day |
| [02-LangGraph-Cloud-and-Studio.md](02-LangGraph-Cloud-and-Studio.md) | LangGraph Studio UI, visual breakpoints, LangGraph Cloud managed deployment | 1 day |
| [03-Production-Docker-and-Self-Hosted-Deployment.md](03-Production-Docker-and-Self-Hosted-Deployment.md) | Production Dockerfile, Postgres checkpointer, Redis caching, Gunicorn/Uvicorn clustering | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Projects](../Projects/01-Autonomous-Research-and-Writer-Agent.md)
