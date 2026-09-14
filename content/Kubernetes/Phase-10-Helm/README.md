# Phase 10: Helm

## What You'll Learn

Helm is the package manager for Kubernetes. Just as `apt` manages Debian packages and `npm` manages Node modules, Helm manages Kubernetes applications. It bundles all the YAML manifests for an application into a single deployable unit called a **chart**, adds a templating engine so the same chart can be deployed with different configurations, and tracks every install and upgrade as a versioned **release** — giving you one-command rollbacks. In this phase you will go from understanding why Helm exists to authoring production-grade charts, managing repositories, and publishing your own packages.

## Learning Objectives

- Understand the Helm 3 architecture and how it differs from Helm 2 (no Tiller)
- Install and use core Helm CLI commands: install, upgrade, rollback, uninstall, history
- Read and write `values.yaml` files and override values at deploy time
- Build a Helm chart from scratch using Go templates, built-in objects, and named templates
- Use `_helpers.tpl`, flow control (`if`/`range`/`with`), and pipelines in templates
- Add, search, and publish charts to Helm repositories and OCI registries

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Helm-Fundamentals.md](01-Helm-Fundamentals.md) | Helm concepts, CLI, releases | 2 days |
| [02-Charts-Templates.md](02-Charts-Templates.md) | Chart structure, Go templates, values | 1 day |
| [03-Helm-Repositories.md](03-Helm-Repositories.md) | Repos, ArtifactHub, dependencies, publishing | 1 day |

## Estimated Time

4 days

## Previous Phase

→ [Phase 9: RBAC & Security](../Phase-09-RBAC-Security/README.md)

## Next Phase

→ [Phase 11: Monitoring & Logging](../Phase-11-Monitoring-Logging/README.md)
