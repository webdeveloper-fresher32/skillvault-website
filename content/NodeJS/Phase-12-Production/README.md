# Phase 12 — Production

## Overview

Shipping a Node.js/Express app to production is more than `node server.js`. This phase covers the operational concerns every backend engineer is expected to know: environment configuration, process management, containerization, logging/monitoring, CI/CD, and scaling.

This phase intentionally stays **Node-specific**. For deep containerization and orchestration content — Docker architecture, Kubernetes objects, Deployments, Services, Helm, autoscaling, etc. — see the dedicated courses already in this repo:

- **`../../Docker/`** — Docker fundamentals through production patterns (Phase 01–12)
- **`../../Kubernetes/`** — Kubernetes fundamentals through production best practices (Phase 01–12)

## Files

| File | Topic |
|------|-------|
| `01-Environment-Config-and-Secrets.md` | `NODE_ENV`, per-environment config, dotenv, secrets management |
| `02-Process-Management-with-PM2.md` | Process managers, PM2 cluster mode, zero-downtime reload |
| `03-Dockerizing-a-Node-App.md` | Multi-stage Dockerfile, `.dockerignore`, non-root user, layer caching |
| `04-Logging-and-Monitoring.md` | Structured logging, log levels, correlation IDs, health checks, APM |
| `05-CI-CD-for-Node-Apps.md` | GitHub Actions pipeline: install, lint, test, build, deploy |
| `06-Scaling-Node-Applications.md` | Horizontal/vertical scaling, load balancing, stateless design, Redis externalization |

## How to Use This Phase

Read the files in order — they build on each other (env config → process management → containerize → observe → automate → scale). Each file has runnable code/config examples, Hands-On Exercises, and Interview Q&A.
