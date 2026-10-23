# Build Optimization — Complete Guide

## Table of Contents
1. [Why Build Optimization Matters](#1-why-build-optimization-matters)
2. [Layer Caching — Order Dependencies Before Code](#2-layer-caching--order-dependencies-before-code)
3. [Layer Consolidation — Reducing Layer Count](#3-layer-consolidation--reducing-layer-count)
4. [Minimal Base Images](#4-minimal-base-images)
5. [.dockerignore — Controlling the Build Context](#5-dockerignore--controlling-the-build-context)
6. [Image Scanning for Vulnerabilities](#6-image-scanning-for-vulnerabilities)
7. [Measurement and Tooling](#7-measurement-and-tooling)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Build Optimization Matters

Unoptimized images have compounding costs:

```
Unoptimized image:
  Push to registry:   slow   (upload 1.2 GB on every commit)
  Pull on deploy:     slow   (cold-start penalty in production)
  Cache misses:       slow   (full rebuild because COPY . . is first)
  CVE exposure:       high   (unnecessary packages = more vulnerabilities)
  Storage cost:       high   (registry stores every version)

Optimized image:
  Push to registry:   fast   (only changed layers uploaded)
  Pull on deploy:     fast   (most layers already cached on host)
  Cache hits:         high   (deps layer stable, code layer small)
  CVE exposure:       low    (distroless/alpine has ~5 packages)
  Storage cost:       low    (15 MB vs 1.2 GB × N versions)
```

Three levers:
1. **Layer cache** — order instructions to maximize reuse
2. **Base image** — start from the smallest appropriate image
3. **Build context** — send only what Docker actually needs

---

## 2. Layer Caching — Order Dependencies Before Code

Docker invalidates a layer's cache when its instruction changes **or any preceding layer changes**.
Put slow, stable instructions first; fast, volatile instructions last.

```
Cache invalidation waterfall:

WRONG ORDER:
  COPY . .              ← changes on every commit  ← cache miss
  RUN npm install       ← re-runs every time (slow)

CORRECT ORDER:
  COPY package.json package-lock.json ./   ← rarely changes
  RUN npm install                          ← cached until deps change
  COPY . .                                 ← only code layer misses

Timeline savings:
  Wrong order:   every build ~90s (npm install runs every time)
  Correct order: cache hit ~5s   (npm install skipped)
                 cache miss ~90s (only when package.json changes)
```

```dockerfile
# WRONG — code copy invalidates npm install cache on every change
FROM node:20-alpine
WORKDIR /app
COPY . .                       # ← volatile: changes every commit
RUN npm ci                     # ← re-runs every build

# CORRECT — stable layers first, volatile layers last
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./   # ← stable
RUN npm ci                               # ← cached until lockfile changes
COPY . .                                 # ← volatile, but cheap
RUN npm run build
```

```dockerfile
# Go equivalent — cache module download separately
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./          # ← stable: only changes when deps added
RUN go mod download            # ← cached until go.sum changes
COPY . .                       # ← volatile
RUN go build -o /out/server ./cmd/server
```

---

## 3. Layer Consolidation — Reducing Layer Count

Every `RUN`, `COPY`, and `ADD` instruction creates a new layer. Intermediate files written
and deleted in separate `RUN` instructions still occupy space in the earlier layer.

```
Problem: intermediate files persist in layers
  RUN apt-get update              ← layer A: apt cache (~40 MB)
  RUN apt-get install -y curl     ← layer B: curl + deps
  RUN rm -rf /var/lib/apt/lists/* ← layer C: deletes apt cache

  Image size = A + B + C
  The 40 MB apt cache in layer A is still in the image!

Solution: chain into a single RUN
  RUN apt-get update \
   && apt-get install -y --no-install-recommends curl \
   && rm -rf /var/lib/apt/lists/*
  ← single layer, apt cache never committed
```

```dockerfile
# Consolidated apt install — best practice
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
 && rm -rf /var/lib/apt/lists/*

# Consolidated pip install
FROM python:3.12-slim

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
#              ^^^^^^^^^^^^^^^^
#   --no-cache-dir: pip's download cache never written to the layer
```

```bash
# Check layer sizes
docker history myimage:latest --no-trunc
docker history myimage:latest --format "{{.Size}}\t{{.CreatedBy}}" | sort -rh | head -10
```

---

## 4. Minimal Base Images

```
Base image size comparison (compressed on disk):

  ubuntu:22.04            ~29 MB
  debian:bookworm-slim    ~31 MB
  debian:bookworm         ~47 MB
  node:20                 ~143 MB   (debian-based)
  node:20-slim            ~58 MB
  node:20-alpine          ~38 MB
  python:3.12             ~145 MB
  python:3.12-slim        ~53 MB
  python:3.12-alpine      ~19 MB
  alpine:3.19             ~3.5 MB
  distroless/static       ~1.8 MB   (Google, no shell)
  scratch                 ~0 MB     (empty)

Choosing the right base:
  Compiled binary (Go, Rust):   scratch or distroless/static
  JVM app (Java, Kotlin):       eclipse-temurin:21-jre-alpine
  Node.js:                      node:20-alpine
  Python:                       python:3.12-slim (alpine can break C extensions)
  General scripting:            alpine:3.19
  Debugging / dev:              debian:bookworm-slim
```

```dockerfile
# Google Distroless — no shell, no package manager, no extras
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/server /server
ENTRYPOINT ["/server"]
# No /bin/sh → exec form ENTRYPOINT required
# No apt, apk, curl → dramatically smaller CVE surface
```

---

## 5. .dockerignore — Controlling the Build Context

The build context is the directory tree Docker sends to the daemon before building.
Without `.dockerignore` Docker sends everything — including `.git`, `node_modules`,
test fixtures, and secrets.

```
Without .dockerignore:
  Build context: 450 MB   (node_modules + .git + logs + …)
  COPY . . receives all of it
  docker build startup: ~8s (just to transfer context)

With .dockerignore:
  Build context: 2 MB    (only source files)
  docker build startup: <1s
```

```
# .dockerignore — place in same directory as Dockerfile

# Version control
.git
.gitignore

# Dependency directories (reinstalled inside the image)
node_modules
vendor/
__pycache__/
*.pyc
.venv/

# Build output (rebuilt inside the image)
dist/
build/
out/
target/

# Test and coverage
coverage/
.nyc_output
*.test.js

# Editor and OS artefacts
.DS_Store
.idea/
.vscode/
*.swp

# Secrets — never send these to the daemon
.env
.env.*
*.pem
*.key
secrets/

# Documentation
docs/
*.md
LICENSE

# CI / CD config (not needed at runtime)
.github/
.circleci/
Jenkinsfile
```

```bash
# Verify what's in your build context before building
docker build --no-cache --progress=plain . 2>&1 | grep "sending build context"
# Sending build context to Docker daemon  1.92MB   ← good
# Sending build context to Docker daemon  452MB    ← add .dockerignore
```

---

## 6. Image Scanning for Vulnerabilities

Smaller images have fewer packages and fewer CVEs. Scan regularly, especially after
pulling new base images.

```bash
# Docker Scout (built into Docker Desktop / CLI plugin)
docker scout cves myapp:latest

# Trivy — open-source, widely used in CI
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image myapp:latest

# Trivy in CI — fail on HIGH or CRITICAL
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest

# Grype — another popular scanner
grype myapp:latest

# Example output snippet:
# NAME        INSTALLED  FIXED-IN  SEVERITY
# openssl     3.0.8      3.0.9     HIGH
# libcurl     7.88.1     7.88.2    MEDIUM
# zlib        1.2.13     —         LOW
```

```bash
# Keep base images fresh — use digest pinning for reproducibility
# then update the digest periodically
FROM node:20-alpine@sha256:a1b2c3d4e5f6...   # pinned digest
# Update the digest in a scheduled job / Renovate bot
```

---

## 7. Measurement and Tooling

```bash
# Compare image sizes
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Deep dive: what makes up each layer
docker history myapp:latest
dive myapp:latest          # interactive TUI (brew install dive)

# Build with timing
time docker build -t myapp:latest .

# Inspect final image filesystem
docker run --rm myapp:latest find / -type f | sort

# BuildKit build summary (shows cache hits/misses)
DOCKER_BUILDKIT=1 docker build --progress=plain -t myapp:latest . 2>&1 | \
  grep -E "CACHED|RUN|COPY"
```

---

## 8. Hands-On Exercises

**Exercise 1 — Fix layer cache order**
Clone or create a Node.js project. Write a Dockerfile with `COPY . .` before `RUN npm install`.
Time the build twice (second should hit cache). Fix the order. Time again — confirm the
`npm install` layer is now cached on the second build even when you modify a source file.

**Exercise 2 — Layer consolidation audit**
Take a Dockerfile that uses separate `RUN apt-get update`, `RUN apt-get install`, and
`RUN rm -rf /var/lib/apt/lists/*` instructions. Merge them into one `RUN`. Use
`docker history` to compare layer counts and total sizes before and after.

**Exercise 3 — .dockerignore impact**
Build a Node.js image without a `.dockerignore`. Note "Sending build context" size.
Create a `.dockerignore` that excludes `node_modules`, `.git`, `dist`, and test files.
Rebuild and compare context size and total build time.

**Exercise 4 — Base image ladder**
Build the same simple Python Flask app four times using: `python:3.12`, `python:3.12-slim`,
`python:3.12-alpine`, and `gcr.io/distroless/python3`. Record the final image size for each.
Verify the app works (`curl localhost:5000`) for each variant.

**Exercise 5 — Vulnerability scan comparison**
Scan `node:20` (full) vs `node:20-alpine` vs a distroless Node.js image using Trivy.
Count HIGH and CRITICAL CVEs in each. Document which base image has the smallest
exploitable surface area and note any tradeoffs.

---

## 9. Interview Q&A

**Q: Why does the order of Dockerfile instructions affect build performance?**
Answer: Docker caches each layer by a hash of the instruction and its inputs. When a layer's
cache is invalidated, every subsequent layer is also invalidated. Placing slow, stable
instructions (dependency installation) before fast, volatile ones (copying source code) means
the slow layers stay cached even when source code changes, dramatically reducing rebuild time.

**Q: What is the impact of not using .dockerignore?**
Answer: Without `.dockerignore` Docker transfers the entire build context — including `.git`
history, `node_modules`, coverage reports, and potentially secrets — to the Docker daemon
before the build starts. This wastes time on every build and can unintentionally include
sensitive files in the image if `COPY . .` is used. `.dockerignore` reduces context size,
speeds up builds, and prevents accidental secret exposure.

**Q: When would you choose alpine over distroless?**
Answer: Alpine includes a shell (`ash`) and a package manager (`apk`), which is useful when
you need to install extra packages or need a shell for debugging. Distroless has no shell
and no package manager at all, which shrinks the CVE surface further and makes it harder for
attackers to execute commands if they gain access. For production workloads with compiled
binaries, distroless is preferred. For interpreted runtimes (Python, Node.js) where you may
need occasional `exec` access, Alpine is a practical balance.

**Q: How do you prevent apt/apk caches from inflating image size?**
Answer: Chain the install and cleanup in a single `RUN` instruction so intermediate cache
files are never committed as a separate layer. For apt: `apt-get update && apt-get install
--no-install-recommends … && rm -rf /var/lib/apt/lists/*`. For apk: `apk add --no-cache …`.
The `--no-cache` flag tells apk not to write a cache index at all.

**Q: What does image scanning tell you and what are its limits?**
Answer: Scanners (Trivy, Scout, Grype) match installed package versions against known CVE
databases and report severity. They tell you which packages have known vulnerabilities and
whether a fix version exists. Limits: they only find known CVEs (no zero-days), they do not
check application code logic, and a HIGH-severity CVE in an unused library may carry little
actual risk. Scanning should be one layer of a defence-in-depth strategy, not the only one.
