# Dockerfile — Complete Guide

## Table of Contents
1. [Dockerfile Basics](#1-dockerfile-basics)
2. [FROM — Base Image](#2-from--base-image)
3. [RUN — Execute Commands](#3-run--execute-commands)
4. [COPY and ADD](#4-copy-and-add)
5. [WORKDIR, ENV, ARG](#5-workdir-env-arg)
6. [EXPOSE, CMD, ENTRYPOINT](#6-expose-cmd-entrypoint)
7. [USER, VOLUME, HEALTHCHECK](#7-user-volume-healthcheck)
8. [Real-World Dockerfiles](#8-real-world-dockerfiles)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Dockerfile Basics

```dockerfile
# A Dockerfile is a text file of instructions to build an image.
# Each instruction creates a new layer.

# Build the image:
docker build -t myapp:1.0 .
# -t = tag name
# .  = build context (directory to send to daemon)

# Build with a different file name:
docker build -t myapp:1.0 -f Dockerfile.prod .
```

---

## 2. FROM — Base Image

```dockerfile
# Simple
FROM ubuntu:22.04

# Slim variant (recommended for production)
FROM node:18-alpine

# Scratch — empty filesystem (for Go static binaries)
FROM scratch

# Multi-stage: name each stage
FROM node:18-alpine AS builder
FROM node:18-alpine AS production

# Platform-specific
FROM --platform=linux/amd64 node:18-alpine
```

---

## 3. RUN — Execute Commands

```dockerfile
# Single command
RUN apt-get update

# Chain commands with && (best practice — fewer layers)
RUN apt-get update && \
    apt-get install -y curl git && \
    rm -rf /var/lib/apt/lists/*   ← always clean apt cache

# Shell form (runs via /bin/sh -c)
RUN echo "hello"

# Exec form (no shell, array syntax)
RUN ["apt-get", "install", "-y", "curl"]

# RUN mount cache (BuildKit) — faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm install
```

---

## 4. COPY and ADD

```dockerfile
# COPY — preferred: simple file/directory copy
COPY package.json .
COPY src/ ./src/
COPY --chown=node:node . .       # change ownership
COPY --chmod=755 entrypoint.sh . # set permissions

# Multiple sources
COPY package*.json ./

# COPY from another build stage (multi-stage)
COPY --from=builder /app/dist ./dist

# ADD — superset of COPY (avoid unless you need its extras)
# ADD can: auto-extract tar archives, fetch URLs
ADD app.tar.gz /app/         # auto-extracts!
ADD https://example.com/file /tmp/  # fetches URL (avoid — use curl/wget instead)
```

### COPY vs ADD

| Feature | COPY | ADD |
|---------|------|-----|
| Copy files/dirs | ✅ | ✅ |
| Auto-extract tar | ❌ | ✅ |
| Fetch URLs | ❌ | ✅ |
| Recommended? | ✅ Always | Only for tar extraction |

---

## 5. WORKDIR, ENV, ARG

```dockerfile
# WORKDIR — set working directory (creates if not exists)
WORKDIR /app
WORKDIR /app/src   # can chain; creates /app, then /app/src

# ENV — environment variables (available at runtime too)
ENV NODE_ENV=production
ENV PORT=3000 HOST=0.0.0.0  # multiple on one line

# ARG — build-time variables only (NOT in final image)
ARG VERSION=1.0
ARG BUILD_DATE
# Pass at build time:
# docker build --build-arg VERSION=2.0 .

# ENV vs ARG
# ENV: visible inside container at runtime
# ARG: only during build, not in final image
# Use ARG for: build numbers, external package versions
# Use ENV for: runtime config, ports, feature flags

# Use ARG value in ENV
ARG APP_VERSION=1.0
ENV VERSION=$APP_VERSION
```

---

## 6. EXPOSE, CMD, ENTRYPOINT

### EXPOSE

```dockerfile
# Documents which ports the container listens on
# Does NOT actually publish the port (that's -p at runtime)
EXPOSE 3000
EXPOSE 80/tcp
EXPOSE 53/udp
```

### CMD — Default Command

```dockerfile
# Exec form (preferred)
CMD ["node", "server.js"]
CMD ["npm", "start"]

# Shell form (runs via sh -c — avoid)
CMD node server.js

# CMD is overridable at runtime:
docker run myapp node other-script.js   # overrides CMD
```

### ENTRYPOINT — Container as Executable

```dockerfile
# Exec form (preferred)
ENTRYPOINT ["node"]
# Then CMD provides default arguments:
CMD ["server.js"]
# docker run myapp           → runs: node server.js
# docker run myapp other.js  → runs: node other.js

# ENTRYPOINT is harder to override (needs --entrypoint flag)
docker run --entrypoint bash myapp  # override entrypoint

# Shell form (not recommended — can't receive signals properly)
ENTRYPOINT node server.js
```

### CMD vs ENTRYPOINT Decision

```
Use CMD alone:      container has a default command, easily overridable
Use ENTRYPOINT:     container IS the executable (like a binary)
Use ENTRYPOINT+CMD: entrypoint=command, CMD=default arguments
```

---

## 7. USER, VOLUME, HEALTHCHECK

### USER — Run as Non-Root

```dockerfile
# Create user and run as it (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
# or use numeric UID/GID (more portable)
USER 1001:1001
```

### VOLUME — Declare Mount Points

```dockerfile
# Declare that this path should be a volume
VOLUME ["/data"]
VOLUME /logs /tmp

# At runtime, Docker auto-creates a named volume if not mounted
# Best practice: explicitly mount with -v at runtime
```

### HEALTHCHECK — Container Health

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3000/health || exit 1

# HTTP API check:
HEALTHCHECK CMD wget -q --spider http://localhost/health || exit 1

# Disable inherited healthcheck:
HEALTHCHECK NONE
```

---

## 8. Real-World Dockerfiles

### Node.js API

```dockerfile
FROM node:18-alpine

# Create app user (security)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install deps first (cache optimization)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
```

### Python Flask App

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 5000

ENV FLASK_ENV=production

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:application"]
```

### Go Application (Multi-Stage)

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./cmd/server

# Production stage
FROM scratch
COPY --from=builder /build/app /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/app"]
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a Dockerfile for a simple Node.js "Hello World" Express app. Build it, run it, and visit `http://localhost:3000`.

**Exercise 2:** Start from the Dockerfile above and add: a non-root user, a HEALTHCHECK, and correct WORKDIR. Rebuild and verify the container runs as non-root (`docker exec <id> whoami`).

**Exercise 3:** Write a Dockerfile for a Python Flask app. Use `--no-cache-dir` for pip to keep the image small. Compare the size using `docker images`.

**Exercise 4:** Use ARG to pass the app version at build time. Store it in an ENV variable. Verify: `docker run myapp node -e "console.log(process.env.VERSION)"`.

**Exercise 5:** Demonstrate CMD vs ENTRYPOINT: build an image with `ENTRYPOINT ["echo"]` and `CMD ["hello"]`. Run it with and without override arguments. Then override with `--entrypoint`.

---

## 10. Interview Q&A

**Q: What is the difference between CMD and ENTRYPOINT?**
Answer: CMD sets the default command and arguments for a container — easily overridden by passing a command at `docker run`. ENTRYPOINT makes the container behave like an executable — it always runs and can't be replaced without `--entrypoint`. Use them together: ENTRYPOINT=command, CMD=default args. Best practice: use exec form (array syntax) for both.

**Q: What is the difference between COPY and ADD?**
Answer: COPY simply copies files/directories from the build context into the image. ADD does everything COPY does plus auto-extracts tar archives and can fetch URLs. Best practice: use COPY for most cases; only use ADD for tar extraction. Avoid ADD for URL fetching — use curl/wget in a RUN step instead (allows cleanup in the same layer).

**Q: What is the difference between ARG and ENV?**
Answer: ARG is a build-time variable — available during `docker build` only, not in the running container. ENV is a runtime variable — available in the container at runtime and can be overridden with `-e` at `docker run`. Use ARG for build configuration (version numbers, build flags), ENV for runtime configuration (ports, feature flags).

**Q: Why should you run containers as a non-root user?**
Answer: Running as root means if the container is compromised (e.g., code injection), the attacker has root within the container. On misconfigured hosts or with volume mounts, this can escalate to host root. Create a dedicated user with `adduser`/`useradd` and switch with `USER` in the Dockerfile. Many container registries and Kubernetes policies reject root containers.

**Q: What is HEALTHCHECK in a Dockerfile?**
Answer: HEALTHCHECK defines a command Docker runs periodically to determine if a container is healthy. It sets container status to `healthy`, `unhealthy`, or `starting`. Docker Swarm and Kubernetes use health status for routing and restart decisions. Parameters: `--interval` (how often), `--timeout` (how long to wait for a response), `--retries` (failures before unhealthy), `--start-period` (grace period at startup).
