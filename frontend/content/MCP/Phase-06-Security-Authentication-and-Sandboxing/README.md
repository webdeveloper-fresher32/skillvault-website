# Phase 6: Security, Authentication, and Sandboxing

## What You'll Learn

Architect zero-trust security foundations for MCP integrations. Analyze the unique threat models introduced by agentic AI (indirect prompt injection, Server-Side Request Forgery via tools, tool poisoning, and confused deputy attacks), implement robust authentication with OAuth2/OIDC and mTLS, and isolate untrusted server execution inside hardened Docker containers and gVisor sandboxes.

## Learning Objectives

- Dissect indirect prompt injection attack vectors targeting tool arguments and resource payloads.
- Defend against Server-Side Request Forgery (SSRF) and local privilege escalation.
- Implement token-based authentication (OAuth2 Bearer tokens, API Keys) for remote SSE servers.
- Containerize MCP servers with rootless Docker, read-only root filesystems, and dropped Linux capabilities.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Security-Architecture-and-Threat-Models.md](01-Security-Architecture-and-Threat-Models.md) | Agentic threat vectors, indirect prompt injection, SSRF, tool poisoning | 1 day |
| [02-Authentication-and-Authorization.md](02-Authentication-and-Authorization.md) | OAuth2/OIDC bearer tokens, mTLS, API keys, role-based access control (RBAC) | 1 day |
| [03-Sandboxing-and-Safe-Execution-Environments.md](03-Sandboxing-and-Safe-Execution-Environments.md) | Docker container isolation, read-only mounts, non-root users, seccomp filters | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Client Integrations and Host Applications](../Phase-07-Client-Integrations-and-Host-Applications/README.md)
