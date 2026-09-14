# Multi-Stage Builds — Complete Guide

## Table of Contents
1. [What Are Multi-Stage Builds](#1-what-are-multi-stage-builds)
2. [Build Stage vs Runtime Stage](#2-build-stage-vs-runtime-stage)
3. [Named Stages and COPY --from](#3-named-stages-and-copy---from)
4. [Real-World Example — Go Binary](#4-real-world-example--go-binary)
5. [Real-World Example — Node.js App](#5-real-world-example--nodejs-app)
6. [Partial Builds and Target Stages](#6-partial-builds-and-target-stages)
7. [Size Comparison](#7-size-comparison)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Are Multi-Stage Builds

Multi-stage builds allow a single `Dockerfile` to contain multiple `FROM` instructions.
Each `FROM` starts a new stage with a clean filesystem. You copy only the artefacts you
need from earlier stages into the final image — build tools, compilers, and intermediate
files are left behind.

```
Before multi-stage (single stage):
┌──────────────────────────────────────────┐
│  FROM node:18                            │
│  RUN apt-get install build-essential     │
│  COPY . .                                │
│  RUN npm install && npm run build        │
│  CMD ["node", "dist/index.js"]           │
│                                          │
│  Final image contains:                   │
│    node:18 (~950 MB) + dev deps + src    │
│  Total: ~1.1 GB                          │
└──────────────────────────────────────────┘

After multi-stage:
┌──────────────────────────────────────────┐
│  Stage 1 — builder (discarded)           │
│    FROM node:18                          │
│    RUN npm install && npm run build      │
│    → produces: dist/                     │
├──────────────────────────────────────────┤
│  Stage 2 — runtime (shipped)            │
│    FROM node:18-alpine                   │
│    COPY --from=builder /app/dist ./dist  │
│    CMD ["node", "dist/index.js"]         │
│                                          │
│  Final image: ~150 MB                    │
└──────────────────────────────────────────┘
```

**Benefits:**
- Dramatically smaller images (build tools never reach production)
- Single `Dockerfile` — no separate build scripts
- Secrets used during build cannot leak into the final image
- Faster deploys, smaller attack surface

---

## 2. Build Stage vs Runtime Stage

```
┌────────────────────────────────────────────────────────────────┐
│                   BUILD STAGE                                  │
│                                                                │
│  FROM golang:1.22                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Go compiler (300 MB)                                   │  │
│  │  Source code (.go files)                                │  │
│  │  go.mod / go.sum                                        │  │
│  │  Test binaries, debug symbols                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                      │
│                    CGO_ENABLED=0                               │
│                    go build -o /app/server                     │
│                         │                                      │
│                    ┌────┴────┐                                 │
│                    │ server  │  ← single statically linked     │
│                    │ binary  │    executable (~10 MB)          │
│                    └────┬────┘                                 │
└─────────────────────────┼──────────────────────────────────────┘
                          │  COPY --from=builder
┌─────────────────────────┼──────────────────────────────────────┐
│                   RUNTIME STAGE                                │
│                                                                │
│  FROM scratch (or alpine:3.19)                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  /app/server  ← only the binary                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Final image size: ~10 MB (vs 300+ MB)                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Named Stages and COPY --from

```dockerfile
# Name a stage with AS <name>
FROM golang:1.22 AS builder

# Reference by name in COPY --from
COPY --from=builder /app/server /app/server

# You can also reference by stage index (zero-based)
COPY --from=0 /app/server /app/server   # index form — fragile, avoid

# Copy from an external image (not a stage)
COPY --from=nginx:alpine /etc/nginx/nginx.conf /etc/nginx/nginx.conf
```

```
Stage naming rules:
  FROM image AS name   ← name must be lowercase
  COPY --from=name     ← references the named stage
  RUN --mount=from=name  ← mounts from another stage (BuildKit)

Multiple build stages in one Dockerfile:
  FROM node:18 AS deps        ← install dependencies
  FROM node:18 AS builder     ← compile / bundle
  FROM node:18-alpine AS runner ← production runtime
```

---

## 4. Real-World Example — Go Binary

```dockerfile
# ── Stage 1: build ──────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Cache dependency downloads separately from source
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/server ./cmd/server

# ── Stage 2: runtime ────────────────────────────────────────────
FROM scratch

# Bring in CA certificates for HTTPS calls
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy only the compiled binary
COPY --from=builder /out/server /server

EXPOSE 8080
ENTRYPOINT ["/server"]
```

```bash
# Build and check the size
docker build -t myapp:go .
docker images myapp:go
# REPOSITORY   TAG   IMAGE ID       SIZE
# myapp        go    3f8a1b2c4d5e   12.4MB   ← vs golang:1.22 at 310MB
```

**Key flags explained:**
- `CGO_ENABLED=0` — pure Go build, no C dependencies, works in `scratch`
- `-ldflags="-s -w"` — strips debug symbols and DWARF info, reduces size ~30%
- `FROM scratch` — empty image; only your binary exists

---

## 5. Real-World Example — Node.js App

```dockerfile
# ── Stage 1: install dependencies ───────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ── Stage 2: build (TypeScript compile) ─────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                          # includes devDependencies

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build                   # outputs to dist/

# ── Stage 3: production runtime ─────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy prod node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t myapp:node .
docker images myapp:node
# REPOSITORY   TAG    IMAGE ID       SIZE
# myapp        node   7c2e9f3a1b4d   148MB   ← vs node:20 at 950MB
```

---

## 6. Partial Builds and Target Stages

Stop the build at a specific stage using `--target`. Useful for:
- Running tests inside the build environment
- Generating debug images with build tools included
- CI pipelines that only need the test artefacts

```bash
# Build only up to the 'builder' stage
docker build --target builder -t myapp:debug .

# Build only up to the 'deps' stage (just node_modules)
docker build --target deps -t myapp:deps .

# Default (no --target) builds the last stage
docker build -t myapp:latest .
```

```dockerfile
# Pattern: test stage between builder and runner
FROM node:20-alpine AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build

FROM builder AS test
RUN npm run test        # CI runs: docker build --target test .

FROM node:20-alpine AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

```bash
# CI pipeline usage
docker build --target test --no-cache -t myapp:test .
# If this succeeds (exit 0), tests passed

docker build --target runner -t myapp:prod .
# Only if tests passed
```

---

## 7. Size Comparison

```
Application: Node.js REST API with TypeScript

Single-stage (naive):
  FROM node:20            →  950 MB
  + devDependencies       →  +180 MB
  + source + dist         →  +20 MB
  ─────────────────────────────────
  Total                   : ~1.15 GB

Multi-stage (3 stages):
  FROM node:20-alpine     →  130 MB
  + prod node_modules     →  +45 MB
  + dist/                 →  +5 MB
  ─────────────────────────────────
  Total                   : ~180 MB

Reduction: 1150 MB → 180 MB  (~84% smaller)

Go application:
  Single-stage (golang:1.22):   310 MB
  Multi-stage (scratch):         12 MB
  Reduction:                    ~96% smaller
```

---

## 8. Hands-On Exercises

**Exercise 1 — Convert a single-stage Dockerfile**
Take an existing single-stage Node.js Dockerfile and convert it to multi-stage.
Measure the image size before and after with `docker images`.
Target: reduce size by at least 50%.

**Exercise 2 — Go scratch image**
Write a minimal Go HTTP server (`net/http`). Build it with multi-stage using `FROM scratch`
as the runtime. Verify it runs: `docker run -p 8080:8080 myapp:go` and `curl localhost:8080`.

**Exercise 3 — Partial build for CI**
Add a `test` stage to a multi-stage Dockerfile that runs `npm test`.
Use `docker build --target test` to run tests in CI without producing a final image.
Confirm that a failing test returns a non-zero exit code.

**Exercise 4 — COPY --from external image**
Use `COPY --from=nginx:alpine` to pull the default `nginx.conf` into a custom image
without adding nginx to your `FROM`. Inspect the final image to confirm nginx binary
is absent but the config file is present.

**Exercise 5 — Size audit**
Build a multi-stage Go image. Run `docker history myapp:go` and identify the largest layer.
Use `-ldflags="-s -w"` and compare the binary size with and without the flag.
Document your findings.

---

## 9. Interview Q&A

**Q: What problem do multi-stage builds solve?**
Answer: They eliminate build-time tools (compilers, package managers, dev dependencies) from the
final image. Before multi-stage builds, teams either maintained separate build scripts or shipped
bloated images containing tools never needed at runtime. Multi-stage builds keep a single
Dockerfile while producing lean, production-ready images.

**Q: What does `FROM scratch` mean and when should you use it?**
Answer: `scratch` is Docker's reserved empty image — it has no OS, no shell, no filesystem at all.
You use it when shipping a statically compiled binary (Go with `CGO_ENABLED=0`, Rust) that has
zero external dependencies. The resulting image contains only your binary, making it the smallest
possible image and the smallest possible attack surface.

**Q: How does `COPY --from=builder` differ from a regular `COPY`?**
Answer: A regular `COPY` pulls files from the build context (your local machine). `COPY --from=<stage>`
pulls files from the filesystem of another build stage or a named external image. The source stage's
filesystem is only accessible during the build; it never becomes part of the final image unless you
explicitly copy from it.

**Q: What is `--target` and why is it useful in CI?**
Answer: `--target <stage>` stops the build after the named stage completes. In CI you can run
`docker build --target test` to execute your test suite inside the build environment without
producing a deployable image. If the stage exits non-zero the pipeline fails. This ties testing
directly to the build process without separate test runners.

**Q: Can a stage COPY from a later stage?**
Answer: No. Stages are evaluated top to bottom and a `COPY --from` can only reference stages
that have already been defined above it (or external images). Referencing a stage defined later
in the file causes a build error. Plan your stage order so each stage only depends on earlier ones.
