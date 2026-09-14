# Phase 07 — Registry

> Docker Hub, private registries, image tagging and versioning strategies.

**Estimated time:** 3–4 days &nbsp;|&nbsp; **Prerequisites:** Phase 2 &nbsp;|&nbsp; **Next:** Phase 8 — Advanced Images

---

## Topics

| File | Topic | Estimated Time |
|------|-------|---------------|
| `01-Docker-Hub.md` | Docker Hub — public repositories, pulling and pushing images, automated builds | 1 day |
| `02-Private-Registry.md` | Private Registries — self-hosted registry setup, authentication, access control | 2 days |
| `03-Image-Management.md` | Image Management — tagging conventions, versioning strategies, cleanup and retention | 1 day |

---

## Overview

This phase covers the full lifecycle of distributing Docker images. You will learn how Docker Hub works as the default public registry, how to stand up and secure a private registry for internal use, and how to apply consistent tagging and versioning strategies so images remain traceable and manageable over time.

### 01 — Docker Hub

Docker Hub is the default registry for public images. This file covers:

- Creating and managing repositories on Docker Hub
- Authenticating with `docker login` and pushing images
- Pulling official and community images
- Understanding image namespacing (`username/image:tag`)
- Automated builds and webhooks

### 02 — Private Registry

Running a private registry gives you control over distribution, access, and retention. This file covers:

- Deploying the official `registry:2` image
- Configuring TLS and authentication
- Pushing and pulling from a private registry
- Integrating with CI/CD pipelines
- Comparing self-hosted options (Harbor, Nexus, ECR, GCR, ACR)

### 03 — Image Management

Consistent tagging and versioning prevents confusion in production. This file covers:

- Semantic versioning for Docker images (`major.minor.patch`)
- Immutable vs. mutable tags (avoiding the `latest` trap)
- Multi-arch image manifests and `docker buildx`
- Pruning dangling images and managing disk usage
- Retention policies and garbage collection

---

## Prerequisites

Before starting this phase, you should be comfortable with:

- Building images with `Dockerfile` (Phase 2)
- Running and managing containers
- Basic `docker` CLI commands

---

## Next Phase

**Phase 8 — Advanced Images** builds on registry knowledge to cover multi-stage builds, build caching strategies, and optimising image size and security for production.
