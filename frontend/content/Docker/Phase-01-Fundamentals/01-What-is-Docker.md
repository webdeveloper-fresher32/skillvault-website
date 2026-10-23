# What is Docker — Complete Guide

## Table of Contents
1. [The Problem Docker Solves](#1-the-problem-docker-solves)
2. [What is a Container?](#2-what-is-a-container)
3. [Docker Architecture](#3-docker-architecture)
4. [Key Concepts](#4-key-concepts)
5. [Docker vs Traditional Deployment](#5-docker-vs-traditional-deployment)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Docker Solves

### "It Works on My Machine"

```
Developer's machine:       Production server:
  Node.js 18.14            Node.js 16.2
  npm 9.4                  npm 8.1
  Ubuntu 22.04             CentOS 7
  libssl 3.0               libssl 1.0
  PORT=3000                PORT=8080 (firewall blocks 3000)

Result: App works locally, crashes in production.
```

### What Docker Provides

```
┌────────────────────────────────────────────────────────────┐
│ Docker Container                                           │
│                                                            │
│  Your App                                                  │
│     + Node.js 18.14 (exact version)                       │
│     + npm 9.4                                              │
│     + Ubuntu 22.04 (exact OS)                             │
│     + libssl 3.0                                           │
│     + environment variables                                │
│     + all dependencies                                     │
│                                                            │
│  = Runs IDENTICALLY on: your laptop, CI, staging, prod    │
└────────────────────────────────────────────────────────────┘
```

Docker packages your app + its entire environment into a single portable unit that runs identically anywhere Docker is installed.

---

## 2. What is a Container?

A container is a **lightweight, isolated process** with its own:
- Filesystem (from the image)
- Network interface
- Process tree
- User space

Unlike a VM, a container shares the **host kernel** — no hypervisor overhead.

```
Without Docker:
  App A (needs Python 2.7)  ← conflicts with →  App B (needs Python 3.10)
  Both run on the same OS → dependency hell!

With Docker:
  Container A: [App A + Python 2.7]  ← isolated
  Container B: [App B + Python 3.10] ← isolated
  Both run on the same host, zero conflict
```

---

## 3. Docker Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          Your Machine                              │
│                                                                    │
│  ┌─────────────┐                                                   │
│  │  Docker CLI │   ── docker build / run / push ──▶               │
│  │  (client)   │                                                   │
│  └─────────────┘                                                   │
│         │  REST API (Unix socket: /var/run/docker.sock)            │
│         ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                    Docker Daemon (dockerd)               │      │
│  │                                                          │      │
│  │  ┌─────────────────────────────────────────────────┐    │      │
│  │  │              containerd (runtime)               │    │      │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │    │      │
│  │  │  │Container │  │Container │  │Container │      │    │      │
│  │  │  │  nginx   │  │  mysql   │  │  redis   │      │    │      │
│  │  │  └──────────┘  └──────────┘  └──────────┘      │    │      │
│  │  └─────────────────────────────────────────────────┘    │      │
│  └──────────────────────────────────────────────────────────┘      │
│         │                                                          │
│         │  pull/push                                               │
│         ▼                                                          │
│  ┌─────────────┐                                                   │
│  │ Docker Hub  │  (or private registry)                           │
│  │ (Registry)  │                                                   │
│  └─────────────┘                                                   │
└────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | What it does |
|-----------|-------------|
| **Docker CLI** | Command-line tool you type commands into |
| **Docker Daemon (dockerd)** | Background service that manages containers, images, networks |
| **containerd** | Low-level container runtime (manages container lifecycle) |
| **runc** | OCI-compliant runtime that actually creates the container processes |
| **Docker Hub** | Public registry where images are stored and shared |

---

## 4. Key Concepts

### Image

A read-only template containing your app + dependencies. Like a class in OOP.

```
Image = snapshot of a filesystem + metadata
      = base OS + your app + all dependencies
      = immutable blueprint
```

### Container

A running instance of an image. Like an object created from a class.

```
Image ──── docker run ────▶ Container (running process)
                           Container (running process)
                           Container (running process)
One image → many containers
```

### Dockerfile

A text file with instructions to build an image.

```dockerfile
FROM node:18-alpine        # start from this base image
WORKDIR /app               # set working directory
COPY package.json .        # copy files
RUN npm install            # run commands
COPY . .                   # copy rest of app
EXPOSE 3000                # document which port
CMD ["node", "server.js"]  # default command to run
```

### Registry

A server that stores and distributes images.

```
Docker Hub:  docker.io/library/nginx:latest
             docker.io/username/myapp:1.0

AWS ECR:     123456789.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:latest
Private:     registry.mycompany.com/myapp:v2.1
```

### Volumes

Persistent storage for containers — data survives container restart/removal.

---

## 5. Docker vs Traditional Deployment

```
Traditional:
  Dev → "works on my machine" → Ops → "fix your code" → weeks of debugging

Docker:
  Dev → builds Docker image → CI tests same image → Ops deploys same image
  Same artifact from dev laptop to production

Speed comparison:
  VM spin-up:        30-60 seconds
  Container start:   < 1 second (often < 100ms)

Resource comparison (running 10 apps):
  VMs:         10 × 1-2GB RAM (for OS alone) = 10-20GB just for OS
  Containers:  share host kernel, ~50MB overhead per container = ~500MB
```

---

## 6. Hands-On Exercises

**Exercise 1:** Install Docker Desktop (Mac/Windows) or Docker Engine (Linux). Run `docker version` — verify both Client and Server show versions.

**Exercise 2:** Run your first container: `docker run hello-world`. Read the output — identify which steps it shows (pull, create, start, output).

**Exercise 3:** Run an interactive Ubuntu container: `docker run -it ubuntu bash`. Inside it, run `ls`, `whoami`, `cat /etc/os-release`. Exit with `exit`.

**Exercise 4:** Run nginx: `docker run -d -p 8080:80 nginx`. Open `http://localhost:8080` in browser. Stop the container with `docker stop <id>`.

**Exercise 5:** Run `docker info` and identify: number of containers, number of images, storage driver, and OS/kernel version reported by Docker.

---

## 7. Interview Q&A

**Q: What is Docker and what problem does it solve?**
Answer: Docker is a containerization platform that packages an application and all its dependencies (runtime, libraries, config) into a single portable container. It solves the "works on my machine" problem — a Docker container runs identically across a developer laptop, CI server, staging, and production, eliminating environment-specific bugs.

**Q: What is the difference between a Docker image and a container?**
Answer: An image is a read-only template — a snapshot of a filesystem with application code and dependencies, built once. A container is a running instance of an image — an isolated process with its own filesystem, network, and PID space. One image can spawn many containers. Images are stored in registries; containers exist on the Docker host.

**Q: What are the main components of Docker architecture?**
Answer: Docker CLI (user interface), Docker Daemon/dockerd (manages everything — images, containers, networks, volumes), containerd (low-level runtime that manages container lifecycle), runc (OCI runtime that creates actual processes), and a Registry (stores images — Docker Hub is the default public one).

**Q: How is Docker different from a Virtual Machine?**
Answer: VMs virtualize hardware and run a complete OS per VM — heavy (GBs of RAM per VM, minutes to start). Containers share the host kernel and only isolate the user space — lightweight (MBs of overhead, seconds or less to start). Containers trade VM-level isolation for significantly better performance and density.

**Q: What is a Docker registry?**
Answer: A registry is a server that stores and distributes Docker images. Docker Hub is the default public registry. Images are identified as `registry/repo:tag` (e.g., `docker.io/library/nginx:1.25`). Private registries (AWS ECR, GCR, GitHub Container Registry) are used for proprietary images. `docker push` uploads; `docker pull` downloads.
