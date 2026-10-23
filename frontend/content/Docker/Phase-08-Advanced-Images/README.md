# Phase 8: Advanced Images

## What You'll Learn

Go beyond basic Dockerfiles. Master multi-stage builds, BuildKit, and production image optimization to ship lean, secure, and fast images.

## Learning Objectives

- Use multi-stage builds to separate build and runtime environments
- Reduce final image size by discarding build-time dependencies
- Leverage BuildKit features: cache mounts, secret mounts, and parallel stages
- Apply production best practices: minimal base images, layer consolidation, and non-root users
- Profile and benchmark image builds to identify bottlenecks

## Prerequisites

- [Phase 2: Docker Images](../Phase-02-Images/README.md)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Multi-Stage-Builds.md](01-Multi-Stage-Builds.md) | Separating build and runtime stages, named stages, partial builds | 2 days |
| [02-Build-Optimization.md](02-Build-Optimization.md) | Layer consolidation, minimal base images, .dockerignore, image scanning | 2 days |
| [03-BuildKit-Advanced.md](03-BuildKit-Advanced.md) | Cache mounts, secret mounts, SSH forwarding, parallel stage execution | 1 day |

## Estimated Time

4-5 days

## Next Phase

→ [Phase 9: Docker Swarm](../Phase-09-Docker-Swarm/README.md)
