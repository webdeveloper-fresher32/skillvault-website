# Docker Master Course — Projects

This section contains six hands-on projects that take you from a single-container static site all the way to a production-grade Swarm deployment. Complete them in order; each one builds on the skills introduced in earlier phases of the course.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Static Website | Beginner | Phase 1 – Images & Containers | Serve a custom HTML page with Nginx inside a single container |
| 2 | Node.js API | Beginner | Phase 1 – Images & Containers | Containerise an Express REST API using a multi-stage Dockerfile |
| 3 | LAMP Stack | Intermediate | Phase 2 – Docker Compose | Orchestrate Apache, PHP, and MySQL with Compose and persistent volumes |
| 4 | Microservices App | Intermediate | Phase 2 – Docker Compose | Wire three services (Nginx, Node.js, Postgres) together with a custom network and health checks |
| 5 | CI/CD Pipeline | Advanced | Phase 3 – Registries & Automation | Automate build → test → push → deploy with GitHub Actions |
| 6 | Swarm Deployment | Advanced | Phase 4 – Orchestration | Deploy a replicated stack to a 3-node Swarm with zero-downtime rolling updates |

---

## Project Summaries

### 1. Static Website (Beginner)
Write a minimal Dockerfile that copies a custom `index.html` into the official Nginx image. You will practise building images, exposing ports, running detached containers, and reading container logs — all the daily mechanics of working with Docker.

### 2. Node.js API (Beginner)
Containerise a small Express.js application that exposes a few JSON endpoints. The Dockerfile uses a two-stage build (install dependencies in a `build` stage, copy only production artefacts into the `runtime` stage) to keep the final image as small as possible.

### 3. LAMP Stack (Intermediate)
Use Docker Compose to spin up Apache, PHP-FPM, and MySQL as separate services that communicate over a shared bridge network. A named volume ensures MySQL data survives container restarts, and a tiny PHP script proves the full stack is wired together end-to-end.

### 4. Microservices App (Intermediate)
Model a real-world microservices topology: an Nginx reverse proxy sitting in front of a Node.js backend API, both of which talk to a Postgres database. Services discover each other by DNS name, health checks gate startup ordering, and environment variables keep credentials out of the image layer.

### 5. CI/CD Pipeline (Advanced)
Set up a GitHub Actions workflow that triggers on every push to `main`. The pipeline builds a Docker image, runs a smoke-test container, pushes the tagged image to Docker Hub, and optionally triggers a remote deployment — giving you a repeatable, auditable release process.

### 6. Swarm Deployment (Advanced)
Initialise a three-node Docker Swarm, deploy a replicated service stack with a `docker stack deploy` YAML, then perform a rolling update while watching the scheduler replace replicas one at a time. You will verify that the application remains available throughout the update — the gold standard for zero-downtime deployments.
