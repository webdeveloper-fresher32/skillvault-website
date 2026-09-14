# Dockerizing a Node App — Complete Guide

> For Docker fundamentals (images, containers, architecture, `docker build`/`run`, volumes, networking), see `../../Docker/`. This file focuses on **Node-specific** concerns when containerizing an Express app.

## Table of Contents
1. [Node-Specific Concerns](#1-node-specific-concerns)
2. [.dockerignore](#2-dockerignore)
3. [Multi-Stage Dockerfile](#3-multi-stage-dockerfile)
4. [npm ci vs npm install](#4-npm-ci-vs-npm-install)
5. [Non-Root User](#5-non-root-user)
6. [Layer Caching for node_modules](#6-layer-caching-for-node_modules)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Node-Specific Concerns

Containerizing a Node/Express app has a few concerns beyond generic Docker basics:

| Concern | Why it matters for Node |
|---------|--------------------------|
| `node_modules` size | Can be large; shouldn't be rebuilt on every code change |
| Dev vs prod dependencies | `devDependencies` (test frameworks, linters) shouldn't ship in the final image |
| Build step | TypeScript/bundled apps need a build stage that isn't needed at runtime |
| Root user | The official `node` image runs as root by default — a security risk |
| Signal handling | Node must correctly receive `SIGTERM` to shut down gracefully in orchestrated environments |

---

## 2. .dockerignore

Prevents copying unnecessary or sensitive files into the build context, speeding up builds and avoiding leaking secrets into the image.

```
# .dockerignore
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
.vscode
.idea
coverage
*.md
Dockerfile
.dockerignore
tests
__tests__
*.test.js
.github
```

Excluding `node_modules` is critical — it's reinstalled inside the container against the container's OS/architecture, and copying the host's `node_modules` can cause native-module mismatches (e.g., a module compiled on macOS won't run in Linux).

---

## 3. Multi-Stage Dockerfile

A multi-stage build compiles/installs in one stage and copies only the runtime artifacts into a slim final image — smaller, more secure, no build tools in production.

```dockerfile
# Dockerfile

# ---------- Stage 1: dependencies ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: build (compile TS, bundle, etc.) ----------
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # e.g., tsc, or a bundler step — no-op if plain JS

# ---------- Stage 3: production runtime ----------
FROM node:18-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Bring in only what's needed to run the app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
```

For a plain JavaScript app (no build step), the build stage collapses:

```dockerfile
# Dockerfile (plain JavaScript, no bundler/TypeScript)

FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:18-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
```

Why multi-stage matters here:
- The final image never contains `devDependencies`, source TypeScript files, test files, or build tools (like a TS compiler) — smaller image, smaller attack surface.
- Each stage can use a different/heavier base image if needed (e.g., a build stage with build tools) while the runtime stays minimal.

---

## 4. npm ci vs npm install

| | `npm install` | `npm ci` |
|---|---|---|
| Reads | `package.json` | `package-lock.json` (must exist and match) |
| Can modify lockfile | Yes | No — fails if `package.json`/lockfile mismatch |
| Speed | Slower (resolves versions) | Faster (no resolution, deletes `node_modules` first) |
| Reproducibility | Can install slightly different versions over time | Exact versions guaranteed, every time |
| Use case | Local development, adding new packages | CI pipelines, Docker builds |

```dockerfile
# In Docker builds, always prefer npm ci for reproducible, faster installs
RUN npm ci --omit=dev
```

`npm ci` deletes any existing `node_modules` before installing, and errors out immediately if `package-lock.json` is missing or out of sync with `package.json` — exactly the strictness wanted for a reproducible container image.

---

## 5. Non-Root User

The official `node` base image runs as `root` unless told otherwise. Running a container as root means a container escape or RCE vulnerability has root privileges on the host's container namespace — unnecessary risk.

```dockerfile
# Alpine-based images: create a dedicated user/group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

```dockerfile
# Debian-based images (e.g., node:18-slim) commonly already ship a "node" user
USER node
```

Verify it worked:

```bash
docker run --rm my-node-app whoami
# appuser   (not root)
```

If the app needs to bind to a privileged port (<1024), don't run as root to work around it — instead bind to a port ≥1024 inside the container (e.g., 3000) and map it with `-p 80:3000` at the Docker/orchestrator level.

---

## 6. Layer Caching for node_modules

Docker caches each instruction as a layer and reuses it if the instruction and its inputs haven't changed. Ordering the Dockerfile so `package.json`/`package-lock.json` are copied — and `npm ci` run — **before** copying the rest of the source code means dependency installation is cached and skipped unless dependencies actually changed.

```dockerfile
# GOOD — dependency layer is cached across code-only changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
```

```dockerfile
# BAD — any source file change invalidates the npm ci layer too,
# forcing a full reinstall on every build
COPY . .
RUN npm ci --omit=dev
```

```
Build 1 (first build):
  COPY package*.json    → cache miss → runs
  RUN npm ci             → cache miss → runs (60s)
  COPY . .               → cache miss → runs

Build 2 (only a route file changed, package.json unchanged):
  COPY package*.json    → cache HIT  → skipped
  RUN npm ci             → cache HIT  → skipped (0s, saved 60s)
  COPY . .               → cache miss → runs (source changed)
```

This ordering is the single biggest Docker build-speed win for Node apps with more than a handful of dependencies.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `.dockerignore` for an Express app that excludes `node_modules`, `.env`, `.git`, and test files. Build the image and confirm (`docker run --rm my-app ls -la`) that none of those made it in.

**Exercise 2:** Write a multi-stage Dockerfile for a plain JavaScript Express app with a `deps` stage (`npm ci --omit=dev`) and a `production` stage that copies `node_modules` and source from `deps`. Build it and check the final image size with `docker images`.

**Exercise 3:** Modify the Dockerfile to create and switch to a non-root user. Run `docker run --rm my-app whoami` to confirm it's not root.

**Exercise 4:** Demonstrate layer caching: build the image once, change only a route file (not `package.json`), rebuild, and observe in the build output that the `npm ci` layer says "CACHED".

**Exercise 5:** Add a `HEALTHCHECK` instruction that curls/fetches a `/health` endpoint. Run the container and use `docker ps` to observe the health status transition from `starting` to `healthy`.

---

## 8. Interview Q&A

**Q: Why use a multi-stage Dockerfile for a Node app instead of a single stage?**
Answer: A multi-stage build separates the build environment (installing all dependencies, compiling TypeScript/bundling) from the runtime environment. Only the compiled output and production dependencies get copied into the final stage, so the shipped image excludes devDependencies, source TypeScript, build tools, and test files — resulting in a smaller image with a reduced attack surface.

**Q: What's the difference between `npm install` and `npm ci`, and which should a Dockerfile use?**
Answer: `npm install` resolves and can update `package-lock.json`, and doesn't require it to exist. `npm ci` requires an existing, matching `package-lock.json`, deletes `node_modules` first, and installs exact locked versions — faster and fully reproducible. Dockerfiles (and CI pipelines generally) should use `npm ci` so every build produces byte-identical dependency trees.

**Q: How do you optimize Docker layer caching for `npm install`/`npm ci` in a Node app?**
Answer: Copy only `package.json` and `package-lock.json` first and run `npm ci` before copying the rest of the source code. Docker caches each layer keyed on its instruction and inputs, so if the lockfile hasn't changed, the (often slow) dependency-install layer is reused from cache even when application code changes — dramatically speeding up rebuilds.

**Q: Why shouldn't a Node container run as root, and how do you avoid it?**
Answer: The official `node` image runs as root by default. If an attacker achieves code execution inside the container, running as root gives them root within the container's namespace, increasing the blast radius of a container escape or privilege-escalation bug. The fix is to create a dedicated non-root user (`addgroup`/`adduser` on Alpine, or the pre-existing `node` user on Debian-based images) and switch to it with `USER` before the `CMD`.

**Q: Why exclude `node_modules` via `.dockerignore` even though the Dockerfile installs dependencies itself?**
Answer: If `node_modules` isn't ignored, `COPY . .` would copy the host machine's locally-installed modules into the image, which can include native binary modules compiled for the host's OS/architecture (e.g., macOS) that are incompatible with the container's Linux environment. It also bloats the build context sent to the Docker daemon and defeats layer caching, since `node_modules` changes very frequently relative to source files.

**Q: What is `npm ci --omit=dev` doing, and why is it used in the production stage specifically?**
Answer: `--omit=dev` skips installing `devDependencies` (test frameworks, linters, type definitions) that are only needed at development/build time, not at runtime. Using it in the final production stage keeps the shipped image lean and avoids including packages that could carry their own vulnerabilities without runtime benefit; the earlier build stage may still install full dependencies (including dev) if a build step needs them.
