# TaskFlow AI — Complete Production Engineering Master Specification
## End-to-End Architectural Blueprints, ADRs & Runnable Implementation Guide

| Master Specification Details | Value |
| :--- | :--- |
| **System Name** | TaskFlow AI Platform |
| **Target Roles** | Staff / Principal Full Stack + Backend + AI Systems Engineer |
| **Module Coverage** | Complete 12/12 Production Modules Documented & Specified |
| **Architectural Decision Records (ADRs)** | 10 Exhaustive Areas (All existing industry algorithms compared & defended) |
| **Repository Location** | `docs/modules/` and `docs/PRD_PRODUCTION_AI_CHAT_ASSISTANT.md` |

---

## 🧭 Master Table of Contents & Module Guide

Click on any module below to inspect its dedicated architectural blueprint, complete code implementations, ADR trade-off matrices, and SRE failure runbooks:

| Module Number | Title & Domain | Key Deliverables & Code |
| :--- | :--- | :--- |
| **[Module 1](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_01_SYSTEM_DESIGN.md)** | **Requirements, System Topology & Master Design** | Multi-tenant RBAC, complete PostgreSQL 16 DDL with pgvector HNSW, 10 Master ADRs. |
| **[Module 2](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_02_AUTH_AND_GATEWAY.md)** | **Authentication, Tenant Context & API Gateway** | Node.js Express Gateway, multi-tenant JWT context, `SET LOCAL app.current_tenant_id` RLS hook. |
| **[Module 3](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_03_CHAT_FRONTEND.md)** | **Next.js 16 Chat UI & Streaming Consumer** | React 19 Client components, custom `useTaskFlowChat` hook with `fetch` stream parser, active route context badge. |
| **[Module 4](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_04_FASTAPI_AI_SERVICE.md)** | **Python FastAPI Service & LLM Abstraction** | Asynchronous ASGI engine, multi-provider circuit breaker (OpenAI $\leftrightarrow$ Anthropic), client disconnect listener. |
| **[Module 5](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_05_PRODUCTION_RAG_PIPELINE.md)** | **Production RAG: Ingestion, Hybrid & FlashRank**| AST markdown chunker, parallel HNSW vector + tsvector lexical search, Reciprocal Rank Fusion ($k=60$), FlashRank in-process cross-encoder. |
| **[Module 6](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_06_LANGGRAPH_AGENT.md)** | **LangGraph Cyclic State Machine & Self-Correction**| `AgentState` typed dict, intent classifier node, context relevance grader, automated query reformulation retry loop. |
| **[Module 7](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_07_TOOL_EXECUTION_AND_HITL.md)** | **Application Tool Execution & HITL Gates** | Pydantic v2 tool parameter schemas, internal Node.js API dispatch, Human-in-the-Loop confirmation gate for destructive operations. |
| **[Module 8](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_08_REALTIME_STREAMING_SSE.md)** | **Real-Time SSE Streaming & Protocol Engineering** | Server-Sent Events typed event frames (`thought`, `chunk`, `tool_call`, `citation`, `done`), NGINX buffering bypass headers, keepalive pings. |
| **[Module 9](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_09_CONVERSATION_MEMORY.md)** | **Conversation Memory & Context Window Management**| 6-turn sliding window, asynchronous background running summary generation, token budget bounds (1,400 prompt ceiling). |
| **[Module 10](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_10_RELIABILITY_AND_CACHING.md)**| **Reliability, Semantic Caching & Background Queues**| Redis vector semantic cache ($\ge 0.96$ sim, $<30\text{ms}$ latency, $\$0$ cost), Redis sorted set sliding-window rate limiter, BullMQ pipeline. |
| **[Module 11](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_11_SECURITY_AND_EVALUATION.md)**| **Security Guardrails & Ragas Evaluation** | Delimiter input fencing (`<untrusted_user_query>`), secret redactor, SQL RLS penetration tests, automated Ragas CI/CD test harness. |
| **[Module 12](file:///Users/ganeshpirikirala/Desktop/Projects/SkillVault-website/docs/modules/MODULE_12_DEPLOYMENT_AND_OBSERVABILITY.md)**| **Production Deployment, IaC & SRE Observability**| Multi-stage Dockerfiles, Kubernetes Helm charts & Ingress, OpenTelemetry distributed tracing, Prometheus metrics exporter. |

---

## 🚀 How to Review and Prepare for Implementation

You can read through all the module files in your workspace directly inside `docs/modules/`:
1. Open any module file in your editor to inspect the architecture schematics and code.
2. Review the **ADRs** in each module to master the interview defenses for why competing technologies were rejected.
3. When you are ready to begin writing the code, we can proceed step-by-step through the implementation phase.
