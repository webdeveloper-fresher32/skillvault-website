# BuildKit Advanced — Complete Guide

## Table of Contents
1. [What Is BuildKit](#1-what-is-buildkit)
2. [Enabling BuildKit](#2-enabling-buildkit)
3. [Cache Mounts — Persistent Build Caches](#3-cache-mounts--persistent-build-caches)
4. [Secret Mounts — Safe Credential Handling](#4-secret-mounts--safe-credential-handling)
5. [SSH Forwarding — Private Repository Access](#5-ssh-forwarding--private-repository-access)
6. [Parallel Stage Execution](#6-parallel-stage-execution)
7. [Inline Cache and Registry Cache](#7-inline-cache-and-registry-cache)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Is BuildKit

BuildKit is the next-generation build engine for Docker, replacing the legacy builder.
It was introduced in Docker 18.09 and became the default in Docker 23.0.

```
Legacy builder vs BuildKit:

Legacy builder:
  ┌────────────────────────────────────────────────┐
  │  Sequential execution — one instruction at a   │
  │  time, top to bottom                           │
  │  No cache mounts                               │
  │  Secrets passed as ENV (visible in history)    │
  │  Build context sent in full before build       │
  └────────────────────────────────────────────────┘

BuildKit:
  ┌────────────────────────────────────────────────┐
  │  Parallel stage execution (DAG-based)          │
  │  --mount=type=cache  (persistent cache dirs)   │
  │  --mount=type=secret (secrets never in image)  │
  │  --mount=type=ssh    (SSH agent forwarding)    │
  │  Lazy context transfer (only what's needed)    │
  │  Better progress output and error messages     │
  └────────────────────────────────────────────────┘
```

BuildKit uses a Directed Acyclic Graph (DAG) to determine which stages depend on each other.
Independent stages run in parallel automatically.

---

## 2. Enabling BuildKit

```bash
# Method 1: environment variable (per-command)
DOCKER_BUILDKIT=1 docker build -t myapp:latest .

# Method 2: environment variable (shell session)
export DOCKER_BUILDKIT=1
docker build -t myapp:latest .

# Method 3: Docker daemon config (permanent, all builds)
# Edit /etc/docker/daemon.json
{
  "features": {
    "buildkit": true
  }
}
# Then: sudo systemctl restart docker

# Method 4: docker buildx (always uses BuildKit)
docker buildx build -t myapp:latest .
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# Verify BuildKit is active
docker buildx version
# github.com/docker/buildx v0.12.0 ...

# BuildKit syntax directive (enables specific features in Dockerfile)
# syntax=docker/dockerfile:1
# Place as the very first line of your Dockerfile
```

```dockerfile
# syntax=docker/dockerfile:1
# This comment-like directive pins the Dockerfile frontend version
# and unlocks all BuildKit-specific mount syntax
FROM node:20-alpine
```

---

## 3. Cache Mounts — Persistent Build Caches

Cache mounts create a directory that persists between builds but is never included in the
final image. Package manager caches (npm, pip, apt, go module proxy) are the primary use case.

```
Without cache mount:
  Build 1:  npm ci — downloads 50 packages  →  45s
  Build 2:  npm ci — downloads 50 packages  →  45s  (no cache)
  Build 3:  npm ci — downloads 50 packages  →  45s

With cache mount:
  Build 1:  npm ci — downloads 50 packages  →  45s  (populates cache)
  Build 2:  npm ci — reads from cache       →  8s
  Build 3:  npm ci — reads from cache       →  8s

Cache mount lives at: /var/lib/docker/volumes/buildkit-cache-...
It survives: docker build re-runs, image deletion, container removal
It does NOT appear in: docker history, image layers, or the final image
```

```dockerfile
# syntax=docker/dockerfile:1

# ── Node.js — npm cache mount ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Python — pip cache mount ─────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ── Go — module download cache ───────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /out/server ./cmd/server

# ── apt — package manager cache ──────────────────────────────────
FROM debian:bookworm-slim
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates
```

```bash
# Build with cache mount (BuildKit must be enabled)
DOCKER_BUILDKIT=1 docker build -t myapp:latest .

# Inspect cache usage
docker buildx du

# Clear BuildKit cache
docker buildx prune
```

**Cache mount options:**

```
--mount=type=cache,target=/path          default (shared across builds)
--mount=type=cache,target=/path,id=myid  named cache (isolate per project)
--mount=type=cache,target=/path,sharing=locked   serialize access
--mount=type=cache,target=/path,sharing=private  each build gets own copy
--mount=type=cache,target=/path,readonly         read-only access
```

---

## 4. Secret Mounts — Safe Credential Handling

Secret mounts expose sensitive values to a `RUN` instruction at build time without writing
them into any image layer. The secret is never visible in `docker history` or `docker inspect`.

```
The old (dangerous) way:
  ARG NPM_TOKEN
  RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
  → NPM_TOKEN visible in: docker history --no-trunc
  → NPM_TOKEN baked into the layer forever

BuildKit secret mount:
  RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
      npm install
  → .npmrc only exists for the duration of that RUN
  → Not in any layer, not in docker history
  → Secret value never written to disk permanently
```

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./

# Mount secret as .npmrc — available only during this RUN
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

```bash
# Pass secret from a file
docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -t myapp:latest .

# Pass secret from an environment variable
docker build \
  --secret id=mysecret,env=MY_TOKEN \
  -t myapp:latest .

# Pass secret from a .env file
docker build \
  --secret id=mysecret,src=.env \
  -t myapp:latest .
```

```dockerfile
# Multiple secrets example
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt ./

RUN --mount=type=secret,id=pip_conf,target=/root/.config/pip/pip.conf \
    --mount=type=secret,id=pypirc,target=/root/.pypirc \
    pip install --no-cache-dir -r requirements.txt
```

```bash
# Build with multiple secrets
docker build \
  --secret id=pip_conf,src=./pip.conf \
  --secret id=pypirc,src=~/.pypirc \
  -t myapp:latest .
```

---

## 5. SSH Forwarding — Private Repository Access

SSH forwarding lets the build process use your local SSH agent (with your keys) to
authenticate against private Git repositories — without ever copying your private key
into the image.

```
Without SSH forwarding:
  Option A: COPY id_rsa /root/.ssh/id_rsa   ← key in image layer!
  Option B: ARG GITHUB_TOKEN                ← token in history!

With SSH forwarding:
  Build process uses your SSH agent socket
  Private key never leaves your machine
  Never appears in any layer
```

```dockerfile
# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS builder
WORKDIR /src

# Configure git to use SSH for github.com
RUN apk add --no-cache git openssh-client \
 && git config --global url."git@github.com:".insteadOf "https://github.com/"

COPY go.mod go.sum ./

# SSH mount: use host SSH agent for go mod download
RUN --mount=type=ssh \
    go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM scratch
COPY --from=builder /out/server /server
ENTRYPOINT ["/server"]
```

```bash
# Ensure SSH agent is running and has your key loaded
eval $(ssh-agent)
ssh-add ~/.ssh/id_ed25519

# Build with SSH forwarding
docker build --ssh default -t myapp:latest .

# Verify SSH agent has keys
ssh-add -l

# Named SSH socket (for multiple keys / identities)
docker build --ssh mykey=$HOME/.ssh/deploy_key -t myapp:latest .
```

```dockerfile
# Named SSH mount
RUN --mount=type=ssh,id=mykey \
    git clone git@github.com:myorg/private-repo.git
```

---

## 6. Parallel Stage Execution

BuildKit analyses the dependency graph between stages and runs independent stages in parallel.
No configuration is needed — it happens automatically as long as stages don't depend on each other.

```
Example: frontend + backend built in parallel

  Stage: base-deps          ← shared base
       /          \
      /            \
  Stage: frontend   Stage: backend   ← run in PARALLEL
      \            /
       \          /
      Stage: final          ← waits for both

Timeline:
  Legacy:  base-deps(20s) → frontend(30s) → backend(40s) → final(5s) = 95s
  BuildKit: base-deps(20s) → frontend(30s) + backend(40s) in parallel → final(5s) = 65s
```

```dockerfile
# syntax=docker/dockerfile:1

# ── shared base ──────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── frontend (runs in parallel with backend) ─────────────────────
FROM base AS frontend-builder
COPY frontend/ ./frontend/
RUN npm run build:frontend

# ── backend (runs in parallel with frontend) ─────────────────────
FROM base AS backend-builder
COPY backend/ ./backend/
RUN npm run build:backend

# ── final: waits for both stages ────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=frontend-builder /app/dist/frontend ./public
COPY --from=backend-builder  /app/dist/backend  ./dist

COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
# Watch parallel execution in the progress output
DOCKER_BUILDKIT=1 docker build --progress=plain -t myapp:latest . 2>&1 | \
  grep -E "^\[.*\]"

# Example output showing parallelism:
# [frontend-builder 1/2] COPY frontend/ ./frontend/
# [backend-builder 1/2] COPY backend/ ./backend/   ← both at once
# [frontend-builder 2/2] RUN npm run build:frontend
# [backend-builder 2/2] RUN npm run build:backend   ← both at once
```

---

## 7. Inline Cache and Registry Cache

```bash
# Export cache metadata into the image (inline cache)
docker buildx build \
  --cache-to=type=inline \
  -t myregistry.io/myapp:latest \
  --push .

# Use inline cache on the next build (CI agent with cold filesystem)
docker buildx build \
  --cache-from=myregistry.io/myapp:latest \
  -t myregistry.io/myapp:latest \
  --push .

# External registry cache (separate from the image — preferred)
docker buildx build \
  --cache-to=type=registry,ref=myregistry.io/myapp:cache,mode=max \
  --cache-from=type=registry,ref=myregistry.io/myapp:cache \
  -t myregistry.io/myapp:latest \
  --push .

# mode=max: cache all layers including intermediate stages
# mode=min: cache only the final stage (default)
```

---

## 8. Hands-On Exercises

**Exercise 1 — Enable BuildKit and measure**
Build a Node.js image with `DOCKER_BUILDKIT=0` and time it. Then rebuild the same Dockerfile
with `DOCKER_BUILDKIT=1`. Compare output format and build times. Observe the difference in
progress reporting (plain vs interactive).

**Exercise 2 — npm cache mount**
Add `--mount=type=cache,target=/root/.npm` to your `npm ci` step. Build three times in a row.
Record times for builds 1, 2, and 3. Confirm that builds 2 and 3 are significantly faster.
Use `docker buildx du` to see the cache size.

**Exercise 3 — Secret mount for private package registry**
Create a file `~/.npmrc` containing `//registry.npmjs.org/:_authToken=TEST_TOKEN`. Build a
Node.js image using `--mount=type=secret,id=npmrc,target=/root/.npmrc`. After the build,
run `docker history myapp:latest --no-trunc` and confirm the token does not appear anywhere
in the output.

**Exercise 4 — SSH forwarding for private Go module**
Set up a private GitHub repository with a simple Go package. Configure a Dockerfile that
uses `--mount=type=ssh` and `git config --global url."git@github.com:".insteadOf "https://github.com/"`.
Build with `--ssh default`. Confirm the module is fetched and the binary compiles. Inspect the
image layers to confirm no SSH keys are present.

**Exercise 5 — Parallel stage timing**
Write a Dockerfile with two independent builder stages that each run a 10-second `sleep`
command (simulate a slow build). Add a final stage that copies from both. Time the build
with `DOCKER_BUILDKIT=0` (sequential) and `DOCKER_BUILDKIT=1` (parallel). The parallel build
should complete in ~10s total, sequential in ~20s.

---

## 9. Interview Q&A

**Q: What is BuildKit and how does it differ from the legacy Docker builder?**
Answer: BuildKit is Docker's next-generation build engine. Unlike the legacy builder which
executes Dockerfile instructions sequentially, BuildKit uses a DAG to determine dependencies
and runs independent stages in parallel. It also introduces `--mount` syntax for cache mounts,
secret mounts, and SSH forwarding — features that are impossible in the legacy builder. BuildKit
became the default in Docker 23.0 and is always used by `docker buildx`.

**Q: How do secret mounts prevent credential leakage?**
Answer: With `--mount=type=secret`, the secret value is made available as a file in the
container's filesystem only for the duration of that specific `RUN` instruction. When the
instruction completes, the file is removed before the layer is committed. The secret never
appears in any image layer, is not visible in `docker history --no-trunc`, and cannot be
extracted by anyone who pulls the image. This is fundamentally different from `ARG` or `ENV`
which are baked into layers permanently.

**Q: Why would you use an SSH mount instead of cloning with HTTPS and a token?**
Answer: An HTTPS token passed via `ARG` or `ENV` becomes part of the image's layer history
and can be extracted. `COPY`ing an SSH private key is equally dangerous — the key ends up in
a layer. SSH forwarding (`--mount=type=ssh`) proxies your local SSH agent through the build
without ever writing the private key to disk inside the container. The build authenticates as
you but your key stays on your machine.

**Q: How does a cache mount differ from a regular RUN layer cache?**
Answer: A RUN layer cache is keyed by the instruction text and is invalidated whenever the
instruction or any preceding layer changes. A cache mount persists as a separate volume managed
by BuildKit and is never invalidated by Dockerfile changes — it accumulates downloads across
many builds. Layer caches speed up rebuilds when nothing changes; cache mounts speed up
rebuilds even when the instruction itself changes (e.g., adding a new package to requirements.txt
still reads all existing packages from the mount).

**Q: What does `mode=max` mean in `--cache-to` registry cache?**
Answer: `mode=max` exports cache metadata for all intermediate layers, including those from
stages that are not part of the final image (builder stages, test stages). This means a
completely cold CI agent can restore and skip work for every stage, not just the final one.
`mode=min` (the default) only exports the final image's layers. `mode=max` uses more registry
storage but delivers much higher cache hit rates for multi-stage builds on ephemeral CI runners.
