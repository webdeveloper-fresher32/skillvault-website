# Image Layers & Build Caching — Complete Guide

## Table of Contents
1. [How Build Cache Works](#1-how-build-cache-works)
2. [Cache Invalidation](#2-cache-invalidation)
3. [Optimizing Layer Order](#3-optimizing-layer-order)
4. [.dockerignore](#4-dockerignore)
5. [BuildKit Optimizations](#5-buildkit-optimizations)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. How Build Cache Works

Docker caches the result of each Dockerfile instruction as a layer. On subsequent builds, if the instruction and its inputs haven't changed, Docker reuses the cached layer — drastically speeding up builds.

```
First build (no cache):
  Step 1/5: FROM node:18-alpine       → pull from registry  (slow)
  Step 2/5: COPY package*.json ./     → copy files          (fast)
  Step 3/5: RUN npm install           → download deps       (SLOW)
  Step 4/5: COPY . .                  → copy source         (fast)
  Step 5/5: CMD ["node", "server.js"] → metadata            (instant)

Second build (code change only):
  Step 1/5: FROM node:18-alpine       → CACHED ✅
  Step 2/5: COPY package*.json ./     → CACHED ✅ (package.json unchanged)
  Step 3/5: RUN npm install           → CACHED ✅ (package.json unchanged)
  Step 4/5: COPY . .                  → cache MISS (source changed)
  Step 5/5: CMD ["node", "server.js"] → must rerun (depends on Step 4)

Total time: ~2 seconds (vs 60 seconds fresh)
```

---

## 2. Cache Invalidation

Cache is invalidated when ANY of these change:
- The instruction itself
- Files referenced by COPY/ADD
- The environment (ARG values)
- Any parent layer is invalidated (cascade)

```dockerfile
# ❌ BAD ORDER — code change invalidates npm install cache
FROM node:18-alpine
WORKDIR /app
COPY . .              ← any code change hits this
RUN npm install       ← cache miss every build! (expensive)
CMD ["node", "server.js"]

# ✅ GOOD ORDER — only package.json change triggers npm install
FROM node:18-alpine
WORKDIR /app
COPY package*.json .  ← only changes when deps change
RUN npm install       ← cached unless package.json changes
COPY . .              ← code changes here don't affect npm cache
CMD ["node", "server.js"]
```

---

## 3. Optimizing Layer Order

### Rule: Least-changing steps first, most-changing steps last

```dockerfile
# ✅ Optimal Node.js Dockerfile
FROM node:18-alpine

# 1. System deps (rarely change)
RUN apk add --no-cache curl

# 2. App user (rarely changes)
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# 3. Dependencies (changes when package.json changes)
COPY package*.json ./
RUN npm ci --only=production

# 4. Source code (changes most often — LAST)
COPY --chown=app:app . .

USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### Python Optimization

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependencies first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source last
COPY . .

CMD ["gunicorn", "app:application"]
```

### Squash Layers (Reduce Image Size)

```dockerfile
# ❌ Creates 3 layers, intermediate files in first layer persist
RUN wget https://example.com/file.tar.gz
RUN tar -xzf file.tar.gz
RUN rm file.tar.gz

# ✅ Single layer — cleanup happens in same layer
RUN wget https://example.com/file.tar.gz && \
    tar -xzf file.tar.gz && \
    rm file.tar.gz
```

---

## 4. .dockerignore

The `.dockerignore` file tells Docker NOT to send certain files to the build context. This speeds up `docker build` and prevents accidentally copying secrets or large files.

```
# .dockerignore

# Version control
.git
.gitignore

# Node.js
node_modules
npm-debug.log

# Python
__pycache__
*.pyc
.venv
venv/
*.egg-info

# Environment / secrets
.env
.env.local
*.env
secrets/

# IDE
.vscode
.idea
*.swp

# OS
.DS_Store
Thumbs.db

# Tests (don't include in prod image)
tests/
__tests__/
*.test.js
*.spec.js

# Build artifacts (multi-stage handles this)
dist/
build/

# Documentation
docs/
*.md
README*

# CI/CD
.github/
.circleci/
Jenkinsfile
```

```bash
# Verify what's being sent to the build context
# Build context size appears on first line of docker build output:
docker build -t test .
# Sending build context to Docker daemon  15.36kB  ← should be small!
# If it says MBs → check .dockerignore
```

---

## 5. BuildKit Optimizations

BuildKit is Docker's enhanced build engine (default since Docker 23.0).

```bash
# Enable BuildKit (if not default)
export DOCKER_BUILDKIT=1
docker build -t myapp .

# Or use the new syntax:
docker buildx build -t myapp .
```

### Mount Cache (fastest for package managers)

```dockerfile
# syntax=docker/dockerfile:1

# Cache npm packages across builds (persists between builds!)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Cache pip packages
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Cache Go modules
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
```

### Secret Mounts (no secrets in layers)

```dockerfile
# Pass secret at build time WITHOUT baking it into the image
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install

# Build with:
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
```

### Parallel Multi-Stage Builds

```dockerfile
# syntax=docker/dockerfile:1

# These two stages build in PARALLEL with BuildKit
FROM node:18-alpine AS frontend
WORKDIR /app
COPY frontend/ .
RUN npm ci && npm run build

FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/ .
RUN pip install -r requirements.txt

# Final stage: combine outputs
FROM nginx:alpine
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY --from=backend /app /backend
```

---

## 6. Hands-On Exercises

**Exercise 1:** Create a Node.js app with a Dockerfile that puts COPY . . BEFORE npm install. Build it, time it. Then fix the order (package.json first) — make a code change and rebuild. Measure the speedup.

**Exercise 2:** Add a `.dockerignore` that excludes `node_modules`, `.git`, `.env`, and test files. Observe how the "Sending build context" size drops in the build output.

**Exercise 3:** Use `docker history myapp` to see all layers and their sizes. Identify the largest layer. Optimize a RUN command that has multi-step cleanup to happen in one layer.

**Exercise 4:** Enable BuildKit and use `RUN --mount=type=cache` for npm install. Build twice — compare how fast the second build is vs without the mount cache.

**Exercise 5:** Use `docker build --no-cache` to force a fresh build. Compare time vs cached build. Explain when you'd want to bypass cache (e.g., `apt-get update` for security patches).

---

## 7. Interview Q&A

**Q: How does Docker build cache work?**
Answer: Docker caches each instruction's output as a layer. On rebuild, Docker checks if the instruction and its inputs are identical to the cached version. If yes, it reuses the layer (cache HIT). If anything changes (instruction, file contents for COPY, ARG value), that layer and all subsequent layers are rebuilt (cache MISS and cascade).

**Q: Why should you copy package.json before copying source code?**
Answer: Package installation is slow (downloads dependencies). If you COPY . . first, any source code change (every edit) invalidates the cache for npm install — reinstalling all packages every build. By copying only package.json first and running npm install, the expensive install step is cached as long as package.json doesn't change. Source code changes then only require the final COPY layer.

**Q: What is .dockerignore and why is it important?**
Answer: .dockerignore tells Docker to exclude files from the build context (the directory sent to the daemon). Without it, `node_modules` (hundreds of MB), `.git` history, `.env` secrets, and test files get sent to the daemon every build — slow and insecure. .dockerignore reduces context size, speeds up builds, and prevents secrets from accidentally being copied into images.

**Q: What is BuildKit?**
Answer: BuildKit is Docker's enhanced build engine with parallel stage building, improved caching (`--mount=type=cache`), secret mounts (no secrets baked into layers), and SSH forwarding. It's the default since Docker 23.0 and available via `docker buildx build`. Key benefit: `--mount=type=cache` persists dependency caches between builds, making repeated builds significantly faster.

**Q: Why should RUN commands that create and delete files be chained in one layer?**
Answer: Each RUN creates a new layer as an overlay diff. If you download a file in one RUN and delete it in the next RUN, the file is hidden in the union filesystem but still exists in the earlier layer — the image is still large. Chaining `wget && tar && rm` in one RUN means the temporary file never exists as a permanent layer, keeping the image smaller.
