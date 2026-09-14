# Docker — Complete Learning Course

Master Docker from zero to production. This course covers everything from basic container concepts through multi-stage builds, Docker Compose, Swarm orchestration, security, and CI/CD integration.

---

## Course Structure

```
Docker/
├── Phase-01-Fundamentals/      → What Docker is, installation, containers vs VMs
├── Phase-02-Images/            → Dockerfiles, layers, caching, base images
├── Phase-03-Containers/        → Lifecycle, run flags, exec, logs, management
├── Phase-04-Networking/        → Bridge, host, overlay networks, port mapping
├── Phase-05-Volumes-Storage/   → Volumes, bind mounts, tmpfs, storage drivers
├── Phase-06-Docker-Compose/    → Multi-container apps, compose file, services
├── Phase-07-Registry/          → Docker Hub, private registry, image tagging
├── Phase-08-Advanced-Images/   → Multi-stage builds, BuildKit, optimization
├── Phase-09-Docker-Swarm/      → Swarm mode, services, stacks, HA
├── Phase-10-Security/          → Least privilege, secrets, image scanning
├── Phase-11-Monitoring-Logging/→ Resource limits, logging drivers, monitoring
├── Phase-12-Production/        → CI/CD, Kubernetes intro, production patterns
├── Quick-Reference/            → Cheatsheet + 50 interview Q&A
└── Projects/                   → Beginner → Advanced hands-on projects
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals | Beginner | 3 days |
| 02 | Images & Dockerfiles | Beginner | 3 days |
| 03 | Container Management | Beginner | 2 days |
| 04 | Networking | Intermediate | 3 days |
| 05 | Volumes & Storage | Intermediate | 2 days |
| 06 | Docker Compose | Intermediate | 4 days |
| 07 | Registry | Intermediate | 2 days |
| 08 | Advanced Images | Intermediate | 3 days |
| 09 | Docker Swarm | Advanced | 4 days |
| 10 | Security | Advanced | 3 days |
| 11 | Monitoring & Logging | Advanced | 2 days |
| 12 | Production | Advanced | 3 days |

**Total estimated time: 8-10 weeks**

---

## Prerequisites

- Basic Linux command line (ls, cd, cat, grep)
- Understanding of processes and file systems
- Basic networking concepts (ports, IP addresses)

---

## Docker Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Architecture                        │
│                                                                  │
│  ┌──────────────┐   REST API   ┌──────────────────────────────┐ │
│  │ Docker CLI   │ ──────────▶  │       Docker Daemon           │ │
│  │ docker build │              │   (dockerd)                   │ │
│  │ docker run   │              │                               │ │
│  │ docker push  │              │  ┌─────────┐  ┌─────────┐   │ │
│  └──────────────┘              │  │Container│  │Container│   │ │
│                                │  │  nginx  │  │  mysql  │   │ │
│  ┌──────────────┐              │  └─────────┘  └─────────┘   │ │
│  │ Docker Hub   │ ◀──────────  │                               │ │
│  │ (Registry)   │  pull/push   │  ┌──────────────────────┐    │ │
│  └──────────────┘              │  │   Container Runtime   │    │ │
│                                │  │   (containerd/runc)   │    │ │
│                                │  └──────────────────────┘    │ │
│                                └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Static Website | Beginner | Nginx + custom HTML in Docker |
| Node.js API | Beginner | Containerise an Express app |
| LAMP Stack | Intermediate | Compose: Apache + MySQL + PHP |
| Microservices App | Intermediate | 3-service app with Compose + networking |
| CI/CD Pipeline | Advanced | GitHub Actions → build → push → deploy |
| Swarm Deployment | Advanced | 3-node Swarm with rolling updates |

---

## Quick Commands

```bash
docker run hello-world              # first container
docker ps -a                        # list all containers
docker images                       # list images
docker build -t myapp:1.0 .         # build image
docker-compose up -d                # start compose stack
docker system prune -af             # clean everything
```
