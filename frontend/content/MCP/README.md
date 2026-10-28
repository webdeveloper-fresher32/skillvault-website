# Model Context Protocol (MCP) Mastery Curriculum — Complete Zero-to-Hero Guide

Welcome to the **Model Context Protocol (MCP) Mastery Curriculum**, the definitive, production-grade learning track for architecting, building, securing, and orchestrating standardized AI tool, resource, and prompt integrations using Anthropic's open-standard Model Context Protocol.

---

## 🏗️ Architecture Overview

![Model Context Protocol Architecture](/images/mcp/01-mcp-architecture.jpg)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODEL CONTEXT PROTOCOL (MCP)                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                              HOST APP                                 │  │
│  │      (Claude Desktop • Cursor • Zed • Antigravity • LangGraph App)    │  │
│  │                                                                       │  │
│  │    ┌─────────────────────────┐       ┌─────────────────────────┐      │  │
│  │    │      MCP Client A       │  ...  │      MCP Client N       │      │  │
│  │    └────────────┬────────────┘       └────────────┬────────────┘      │  │
│  └─────────────────┼─────────────────────────────────┼───────────────────┘  │
│                    │                                 │                      │
│            stdio / SSE / HTTP                stdio / SSE / HTTP             │
│                    │                                 │                      │
│                    ▼                                 ▼                      │
│  ┌───────────────────────────────────┐ ┌─────────────────────────────────┐  │
│  │             MCP SERVER            │ │           MCP SERVER            │  │
│  │         (PostgreSQL Engine)       │ │       (GitLab & DevOps API)     │  │
│  │                                   │ │                                 │  │
│  │  ┌─────────────────────────────┐  │ │  ┌───────────────────────────┐  │  │
│  │  │ Tools (Function Execution)  │  │ │  │ Tools (Trigger CI/CD Jobs)│  │  │
│  │  │  - `execute_query(sql)`     │  │ │  │  - `create_merge_request` │  │  │
│  │  └─────────────────────────────┘  │ │  └───────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │ │  ┌───────────────────────────┐  │  │
│  │  │ Resources (Data & Context)  │  │ │  │ Resources (Live Logs)     │  │  │
│  │  │  - `postgres://schema/v1`   │  │ │  │  - `gitlab://pipeline/log`│  │  │
│  │  └─────────────────────────────┘  │ │  └───────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │ │  ┌───────────────────────────┐  │  │
│  │  │ Prompts (Reusable Workflows)│  │ │  │ Prompts (Code Review)     │  │  │
│  │  │  - `explain_slow_query`     │  │ │  │  - `security_audit_diff`  │  │  │
│  │  └─────────────────────────────┘  │ │  └───────────────────────────┘  │  │
│  │                                   │ │                                 │  │
│  │  ┌─────────────────────────────┐  │ │  ┌───────────────────────────┐  │  │
│  │  │ Advanced Capabilities       │  │ │  │ Advanced Capabilities     │  │  │
│  │  │  - Sampling & Roots         │  │ │  │  - Progress & Cancellation│  │  │
│  │  └─────────────────────────────┘  │ │  └───────────────────────────┘  │  │
│  └───────────────────────────────────┘ └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Complete Learning Path

| Phase | Title | Core Concepts | Files |
|-------|-------|---------------|-------|
| **01** | [MCP Fundamentals and Architecture](Phase-01-MCP-Fundamentals-and-Architecture/README.md) | $M \times N$ integration problem, Host-Client-Server model, JSON-RPC 2.0 lifecycle, stdio vs SSE transports | 3 Lessons |
| **02** | [Core Primitives: Tools, Resources, and Prompts](Phase-02-Core-Primitives-Tools-Resources-and-Prompts/README.md) | Tools execution & JSON Schema, URI schemes & Resource Templates, Prompts & slash command workflows | 3 Lessons |
| **03** | [Building MCP Servers in Python](Phase-03-Building-MCP-Servers-in-Python/README.md) | Official Python SDK, FastMCP decorators, low-level server primitives, error codes & Pydantic validation | 3 Lessons |
| **04** | [Building MCP Servers in TypeScript](Phase-04-Building-MCP-Servers-in-TypeScript/README.md) | `@modelcontextprotocol/sdk`, McpServer, Zod schema patterns, Express/Fastify SSE endpoints | 3 Lessons |
| **05** | [Advanced MCP Protocol Features](Phase-05-Advanced-MCP-Protocol-Features/README.md) | Server sampling (`sampling/createMessage`), client roots & repository bounds, progress tokens & task cancellation | 3 Lessons |
| **06** | [Security, Authentication, and Sandboxing](Phase-06-Security-Authentication-and-Sandboxing/README.md) | Prompt injection defense, SSRF prevention, OAuth2/OIDC bearer tokens, Docker sandbox isolation | 3 Lessons |
| **07** | [Client Integrations and Host Applications](Phase-07-Client-Integrations-and-Host-Applications/README.md) | Claude Desktop & Cursor configs, building custom Python & TypeScript clients, MCP Inspector debugging | 3 Lessons |
| **08** | [Orchestration: MCP with LangChain and LangGraph](Phase-08-Orchestration-MCP-with-LangChain-and-LangGraph/README.md) | LangChain MCP adapters, LangGraph `ToolNode` integration, multi-server dynamic tool dispatch | 3 Lessons |
| **09** | [Enterprise MCP Gateways and Routing](Phase-09-Enterprise-MCP-Gateways-and-Routing/README.md) | Reverse proxies & multi-server aggregators, Redis rate limiting & connection pools, OpenTelemetry auditing | 3 Lessons |
| **10** | [Production Deployment and DevOps](Phase-10-Production-Deployment-and-DevOps/README.md) | Multi-stage Docker packaging, Kubernetes & Cloud Run deployment, CI/CD automated testing with mock clients | 3 Lessons |

---

## 🛠️ Capstone Projects

- **[Project 1: PostgreSQL Enterprise Database MCP Server](Projects/01-PostgreSQL-and-Database-MCP-Server.md)**: Production-grade database gateway exposing parameterized SQL tools, dynamic table schema resources (`postgres://{table}`), and slow-query prompt analyzers with connection pooling.
- **[Project 2: Enterprise GitHub & DevOps MCP Server](Projects/02-Enterprise-GitHub-and-DevOps-MCP-Server.md)**: Full DevOps control plane providing pull request review automation, branch tree inspection, CI/CD pipeline triggering, and real-time SSE progress streaming.
- **[Project 3: Autonomous Multi-Server Research Agent with LangGraph](Projects/03-Autonomous-Multi-Server-Research-Agent.md)**: End-to-end agentic workflow connecting a LangGraph cyclic state machine to three distinct MCP servers (Filesystem, Web Retrieval, Postgres) with human-in-the-loop approval.

---

## ⚡ Quick Reference & Interview Prep

- **[MCP Syntax & Architecture Cheatsheet](Quick-Reference/Cheatsheet.md)**: High-density quick reference covering JSON-RPC wire frames, Python FastMCP, TypeScript SDK, client config schemas, and CLI debugging commands.
- **[MCP Master Interview Q&A](Quick-Reference/Interview-QA.md)**: 50 in-depth architectural questions and detailed senior-level answers covering protocol specifications, security, transports, and multi-agent systems.
