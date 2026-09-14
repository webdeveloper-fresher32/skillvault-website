# Containerization & Deployment — Complete Guide

## Table of Contents
1. [Why Containerize a NestJS App](#1-why-containerize-a-nestjs-app)
2. [Anatomy of a Multi-Stage Dockerfile](#2-anatomy-of-a-multi-stage-dockerfile)
3. [Worked Example — Production Dockerfile](#3-worked-example--production-dockerfile)
4. [Environment Variable Management in Containers](#4-environment-variable-management-in-containers)
5. [Graceful Shutdown](#5-graceful-shutdown)
6. [Worked Example — Graceful Shutdown End-to-End](#6-worked-example--graceful-shutdown-end-to-end)
7. [Deployment Targets Overview](#7-deployment-targets-overview)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Containerize a NestJS App

A container packages the compiled application together with the exact Node.js runtime and OS-level dependencies it needs, producing a single artifact that behaves identically on a laptop, in CI, and in production. For a NestJS service this matters for several concrete reasons: it eliminates "works on my machine" drift caused by different local Node versions, it gives an orchestrator (Kubernetes, ECS, Cloud Run) a uniform unit to schedule, scale, and health-check, and it forces a clean separation between build-time concerns (TypeScript compilation, dev dependencies, test tooling) and what actually needs to exist at runtime.

This lesson assumes familiarity with basic Docker concepts (images, layers, the build cache) — if any of that is unfamiliar, this repo's **Docker course** (`Docker/Phase-01` through `Phase-12`) covers it from first principles and is worth working through first. This lesson focuses specifically on what's different about containerizing a NestJS application versus a generic Node app: the build step (`nest build`), the compiled output layout (`dist/`), and the runtime lifecycle hooks Nest exposes for graceful shutdown.

---

## 2. Anatomy of a Multi-Stage Dockerfile

A naive single-stage Dockerfile for a Nest app copies the entire project — including `devDependencies`, TypeScript source, tests, and the `.git` directory if you're not careful — into the final image, producing something several times larger than necessary and carrying unused attack surface (a full TypeScript compiler and test framework have no business existing in a production container).

A **multi-stage build** splits this into separate stages, each with its own base image, where only the last stage's output ships as the final image:

```
  Stage 1: "deps"                Stage 2: "builder"              Stage 3: "runtime"
  ┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
  │ node:20-alpine        │       │ node:20-alpine        │       │ node:20-alpine        │
  │                       │       │                       │       │                       │
  │ npm ci                │──────▶│ COPY deps' node_modules│──────▶│ COPY builder's dist/  │
  │ (installs ALL deps,   │       │ COPY source            │       │ COPY deps' prod-only  │
  │  including dev)       │       │ RUN nest build         │       │  node_modules          │
  │                       │       │ (produces dist/)       │       │                       │
  └──────────────────────┘       └──────────────────────┘       │ No TypeScript compiler│
                                                                  │ No dev dependencies    │
                                                                  │ No source, no tests    │
                                                                  │ Non-root user          │
                                                                  └──────────────────────┘
                                                                  Final image: only what
                                                                  the running app needs
```

Each stage's filesystem is discarded once the build moves past it — the final image is built `FROM` the runtime stage and selectively `COPY --from=` pulls only the specific artifacts it needs (the compiled `dist/` directory, the production `node_modules`). Everything else — the TypeScript compiler, `@types/*` packages, test runners, source `.ts` files — never makes it into the shipped image, which typically cuts image size by 60-80% versus a naive single-stage build and meaningfully shrinks the attack surface.

---

## 3. Worked Example — Production Dockerfile

Assume a standard Nest CLI project layout: `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `nest-cli.json`, compiling to `dist/main.js`.

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: install all dependencies (including dev) ----------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2: build the application ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
  # prune devDependencies now so stage 3 can copy a single, ready-to-use node_modules
  && npm prune --omit=dev

# ---------- Stage 3: slim runtime image ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user rather than the default root
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER nestjs

EXPOSE 3000

# Prefer the "exec form" so Node receives signals directly as PID 1,
# rather than a shell wrapping it and swallowing SIGTERM (see Section 5)
CMD ["node", "dist/main.js"]
```

```dockerfile
# .dockerignore — keep the build context small and avoid leaking local state
node_modules
dist
.git
.env
.env.*
*.md
test
coverage
.vscode
```

A few choices worth calling out explicitly:

- **`npm ci` instead of `npm install`.** `npm ci` requires a `package-lock.json`, installs exactly what's locked (no version drift), and is faster in CI/build contexts — the correct default for reproducible builds.
- **Copying `package.json`/`package-lock.json` before the rest of the source.** Docker's layer cache keys off file content — if only application source changes (not dependencies), this ordering means the `npm ci` layer is reused from cache and doesn't re-run, making incremental builds dramatically faster.
- **`npm prune --omit=dev` after building.** The build stage needs the TypeScript compiler and other dev dependencies to run `nest build`, but the resulting `node_modules` should not carry them forward — pruning after the build keeps this stage's own `node_modules` copy production-only, matching what stage 3 copies in.
- **A non-root user.** Running the container process as `root` is unnecessary privilege — if the application is compromised, a non-root user limits what an attacker can do inside the container (and is required outright by some orchestrators' Pod Security Standards).
- **`CMD` in exec form (`["node", "dist/main.js"]`), not shell form (`node dist/main.js`).** This is essential for graceful shutdown — covered in Section 5.
- **`node:20-alpine`**, not `node:20`. Alpine-based images are dramatically smaller (tens of MB vs. hundreds) because they use `musl libc` and a minimal package set instead of a full Debian userland. The trade-off is occasional native-addon compatibility issues (a package with prebuilt binaries compiled against `glibc`) — if you hit that, `node:20-slim` (Debian-based, still much smaller than the default `node:20`) is a reasonable middle ground.

---

## 4. Environment Variable Management in Containers

A container image should be environment-agnostic — the same built image gets deployed to staging and production, with behavior differing only via environment variables injected at runtime, never via rebuilding the image per environment. This is a core tenet of the [twelve-factor app](https://12factor.net/config) methodology and is what makes a container genuinely portable.

```
  ONE image, built once in CI:
  ┌────────────────────────────────┐
  │  myapp:1.4.2                    │
  └────────────────────────────────┘
         │                │
         ▼                ▼
  ┌──────────────┐  ┌──────────────┐
  │  Staging      │  │  Production  │
  │  DATABASE_URL │  │  DATABASE_URL│
  │  = staging db │  │  = prod db   │
  │  LOG_LEVEL    │  │  LOG_LEVEL   │
  │  = debug      │  │  = info      │
  └──────────────┘  └──────────────┘
  Same artifact, different env vars injected at deploy time
```

Locally, `.env` files loaded via `@nestjs/config`'s `ConfigModule.forRoot()` (covered in earlier phases) are convenient — but a `.env` file should never be baked into a production image (it belongs in `.dockerignore`, as shown above). In production, environment variables are injected by the platform: Kubernetes `ConfigMap`/`Secret` objects mounted as env vars, an ECS task definition's `environment`/`secrets` block, or a platform-native secrets manager (AWS Secrets Manager, GCP Secret Manager) referenced at deploy time.

```typescript
// app.module.ts — ConfigModule works identically regardless of where the
// values actually come from (.env file locally, injected env vars in prod)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env',
      validationSchema: undefined, // see Joi/Zod validation from Phase 05/06
    }),
  ],
})
export class AppModule {}
```

Setting `envFilePath: undefined` in production is a deliberate guard: it ensures the app relies exclusively on real process environment variables in production rather than accidentally picking up a stray `.env` file that made it into the image or the container's filesystem.

Never bake secrets (database passwords, API keys, JWT signing secrets) directly into a Dockerfile via `ENV` instructions or `ARG` values passed at build time — both end up permanently embedded in the image's layer history and are trivially recoverable with `docker history` even after the value is "removed" in a later layer. Secrets belong in runtime-injected environment variables or a mounted secret volume, never in the image itself.

---

## 5. Graceful Shutdown

When an orchestrator scales down, redeploys, or replaces a container, it does not kill the process instantly — it sends `SIGTERM` and waits a grace period (Kubernetes defaults to 30 seconds) before force-killing with `SIGKILL`. A well-behaved application uses that window to stop accepting new requests, finish in-flight ones, and close resources cleanly — an open database connection pool, a message broker connection, a WebSocket gateway — rather than dropping them mid-transaction.

Nest exposes this through `enableShutdownHooks()`, which wires up listeners for termination signals and, on receiving one, calls the `onModuleDestroy()` / `beforeApplicationShutdown()` / `onApplicationShutdown()` lifecycle hooks on every provider that implements them — mirroring the `onModuleInit()` hooks used at startup.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks(); // listens for SIGTERM/SIGINT and runs shutdown hooks

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

A provider participates in graceful shutdown simply by implementing `OnModuleDestroy` (or the more granular `OnApplicationShutdown`, which additionally receives the signal name):

```typescript
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseShutdownService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleDestroy() {
    this.logger.log('Closing database connection pool...');
    await this.dataSource.destroy();
    this.logger.log('Database connection pool closed.');
  }
}
```

In practice, most database integrations (TypeORM, Mongoose via `@nestjs/mongoose`) already register their own shutdown hooks internally once `enableShutdownHooks()` is called — you typically only need to write a custom hook like the one above for resources Nest doesn't manage automatically: a raw Redis client, an open file handle, a message broker connection opened manually outside of Nest's microservices transporter abstraction.

---

## 6. Worked Example — Graceful Shutdown End-to-End

Combining `enableShutdownHooks()` with an explicit `SIGTERM` handler that also stops accepting *new* HTTP connections before resources are torn down — important because the orchestrator's grace period is meant to drain existing traffic, not just close database handles instantaneously while new requests keep arriving.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableShutdownHooks();

  const server = await app.listen(process.env.PORT ?? 3000);

  // Belt-and-braces: explicitly log the shutdown sequence so it's visible
  // in the orchestrator's logs during a rollout, independent of provider hooks.
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — draining connections and shutting down');
    server.close(() => {
      logger.log('HTTP server closed, no longer accepting new connections');
    });
    // enableShutdownHooks() has already triggered app.close() -> onModuleDestroy()
    // on every provider; give in-flight requests a bounded window to finish.
    setTimeout(() => {
      logger.warn('Forcing exit after grace period');
      process.exit(0);
    }, 9000); // stay comfortably under the orchestrator's kill timeout
  });
}
bootstrap();
```

```typescript
// orders/orders.service.ts — a provider that participates in shutdown
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class OrdersQueueConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(OrdersQueueConsumer.name);
  private processing = 0;

  async onModuleDestroy() {
    this.logger.log(`Waiting for ${this.processing} in-flight jobs to finish...`);
    while (this.processing > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.logger.log('All in-flight jobs finished, safe to shut down.');
  }
}
```

```yaml
# excerpt of a Kubernetes Deployment spec setting a matching grace period
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: nestjs-app
      image: myregistry.example.com/nestjs-app:1.4.2
      ports:
        - containerPort: 3000
      env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
      readinessProbe:
        httpGet: { path: /health/ready, port: 3000 }
      livenessProbe:
        httpGet: { path: /health/live, port: 3000 }
```

The sequence on a rolling deploy: Kubernetes marks the pod as terminating and stops routing new traffic to it (via removal from the Service's endpoints, using the readiness probe state) → sends `SIGTERM` to PID 1 in the container → Nest's shutdown hooks run, closing the database pool and draining the queue consumer → the process exits cleanly well before `terminationGracePeriodSeconds` elapses → if it hadn't, Kubernetes would `SIGKILL` it at the deadline, abruptly dropping any still-open connections.

---

## 7. Deployment Targets Overview

A built, hardened container image is deployment-target-agnostic — the same image runs on any platform that can pull an OCI image and inject environment variables. The choice of target is mostly about how much orchestration machinery you want to own versus delegate:

```
  ┌──────────────────────┬────────────────────────────────────────────────────┐
  │ Target                │ Characteristics                                    │
  ├──────────────────────┼────────────────────────────────────────────────────┤
  │ AWS ECS (Fargate)     │ Managed compute, no node/cluster management.       │
  │                       │ Task definitions map closely to a single           │
  │                       │ container spec + env vars. Good middle ground.     │
  ├──────────────────────┼────────────────────────────────────────────────────┤
  │ Google Cloud Run      │ Fully serverless containers — scales to zero,      │
  │                       │ billed per request/duration. Simplest path from    │
  │                       │ "I have a Dockerfile" to a public HTTPS endpoint.  │
  ├──────────────────────┼────────────────────────────────────────────────────┤
  │ Kubernetes            │ Full control over scheduling, networking, RBAC,   │
  │ (EKS/GKE/AKS/self-run)│ scaling policy. Most operational overhead, most    │
  │                       │ flexibility — the right choice once you run many  │
  │                       │ services and need shared platform tooling.        │
  └──────────────────────┴────────────────────────────────────────────────────┘
```

A few NestJS-specific considerations shape which target fits a given service:

- **Cold starts matter more on Cloud Run than ECS or Kubernetes.** Cloud Run's scale-to-zero model means an idle service pays a cold-start cost (container boot + Node process startup + Nest's module graph resolution) on the first request after a quiet period. A Nest app with a large module tree and many providers can have a noticeably slower cold start than a minimal Express app — keep `min-instances` above zero for latency-sensitive services, or budget for the cold-start tail on ones that can tolerate it.
- **ECS Fargate task definitions map almost one-to-one onto a single Dockerfile + environment variable list**, without requiring you to learn Kubernetes' broader API surface (Deployments, Services, Ingress, RBAC) — a reasonable first step for a team that wants managed container hosting without adopting Kubernetes wholesale.
- **Kubernetes is worth the added operational overhead once you're running many services that need to share platform-level tooling** — a common Ingress controller, a shared service mesh, centralized RBAC, HorizontalPodAutoscalers keyed off custom metrics. A single NestJS service in isolation rarely justifies standing up a cluster on its own.

This course does not re-teach container orchestration mechanics — this repo already has dedicated courses for that:

- **This repo's Docker course** (`Docker/Phase-01` through `Phase-12`) covers image building, registries, networking, volumes, Compose, and CI/CD integration in depth.
- **This repo's Kubernetes course** (`Kubernetes/Phase-01` through `Phase-12`) covers Deployments, Services, ConfigMaps/Secrets, health probes, RBAC, and production best practices for running containerized workloads at scale.

What's specific to a NestJS application — and what this lesson has covered — is what goes *into* the image (the multi-stage Dockerfile), how the app receives its configuration (environment variables, never baked-in secrets), and how it behaves at the edges of its lifecycle (readiness/liveness endpoints from Lesson 01, graceful shutdown from this lesson). Those three things are true regardless of whether the resulting image lands on ECS, Cloud Run, or a Kubernetes Deployment.

---

## 8. Common Pitfalls

- **Shell-form CMD swallowing signals.** `CMD node dist/main.js` (shell form) runs Node as a child of `/bin/sh`, which becomes PID 1 and does not forward `SIGTERM` to Node by default — the app never gets a chance to shut down gracefully and is eventually force-killed. Always use exec form: `CMD ["node", "dist/main.js"]`.
- **Baking secrets into the image via ENV/ARG.** Any value set with `ENV` or passed as a build `ARG` is permanently recorded in the image's layer history, recoverable with `docker history` or by inspecting layers directly — even if a later instruction appears to remove or overwrite it. Secrets must be injected at runtime, never at build time.
- **Not pruning dev dependencies before the final stage.** Forgetting `npm prune --omit=dev` (or building the final `node_modules` fresh with `npm ci --omit=dev`) ships the TypeScript compiler, test frameworks, and type definitions into production — bloating the image and expanding attack surface for no runtime benefit.
- **A `terminationGracePeriodSeconds` shorter than your actual drain time.** If in-flight requests or queue jobs genuinely need 20 seconds to finish but the grace period is 10, Kubernetes `SIGKILL`s the process before it can finish cleanly — measure real drain time under load and set the grace period with margin.
- **Copying the whole build context without a `.dockerignore`.** Without one, `COPY . .` can drag `node_modules`, `.git`, and `.env` files into the build context, bloating build time, invalidating the layer cache unnecessarily, and in the worst case leaking a local `.env` file's secrets into an image layer.
- **Health check endpoints that don't reflect true dependency state during shutdown.** If the readiness probe keeps reporting healthy after `SIGTERM` is received but before the app has actually stopped accepting new work, the load balancer keeps routing traffic to a pod that's mid-shutdown — flip readiness to unhealthy as the very first step of the shutdown sequence.
- **Running as root.** Skipping the non-root `USER` instruction is a needless privilege escalation risk and, on some managed platforms (e.g. Kubernetes clusters enforcing Pod Security Standards), will outright fail admission.

---

## 9. Best Practices

- Always build with a multi-stage Dockerfile: separate dependency installation, compilation, and the final runtime image so the shipped artifact contains nothing beyond what's needed to run `node dist/main.js`.
- Pin the Node base image to a specific major version (`node:20-alpine`, not `node:alpine` or `node:latest`) so a base image update doesn't silently change your runtime behavior between builds.
- Treat the container image as immutable and environment-agnostic — configuration differences between staging and production belong entirely in injected environment variables/secrets, never in environment-specific image builds.
- Call `enableShutdownHooks()` in every production Nest app, and verify — under actual load, not just in theory — that in-flight requests and open connections are given enough time to close before the orchestrator's grace period expires.
- Flip the readiness probe to unhealthy as the first action on receiving `SIGTERM`, before tearing down any other resource, so the load balancer stops sending new traffic immediately while existing requests still drain.
- Run the container as a non-root user and keep the final image's package set minimal — every package present is something that can later carry a CVE.
- Keep the Dockerfile and any Kubernetes/ECS manifests in version control alongside the application code, so a deployment's exact configuration is reviewable and reproducible the same way application code is.

---

## 10. Hands-On Exercises

**Exercise 1:** Write a multi-stage Dockerfile for an existing Nest CLI project following the three-stage pattern in Section 3. Build it, then compare `docker images` size against a naive single-stage Dockerfile (`FROM node:20`, `COPY . .`, `RUN npm install && npm run build`, `CMD node dist/main.js`) for the same project. Report the size difference.

**Exercise 2:** Confirm the exec-form vs shell-form CMD difference experimentally. Build two images identical except one uses `CMD node dist/main.js` and the other `CMD ["node", "dist/main.js"]`. Run each, then `docker stop` it (which sends SIGTERM) while the app logs a message inside a `SIGTERM` handler. Confirm the shell-form container takes the full stop timeout (~10s, hitting SIGKILL) while the exec-form container logs the message and exits promptly.

**Exercise 3:** Add `enableShutdownHooks()` and a provider implementing `OnModuleDestroy` that logs a message and waits 2 seconds before resolving (simulating draining in-flight work). Run the container, send `docker stop`, and confirm the log message appears and the container takes roughly the simulated delay to exit — not longer, not instantly.

**Exercise 4:** Configure `ConfigModule.forRoot()` to only read `.env` in non-production environments (as shown in Section 4). Build the production image, run it with a `.env` file present in the build context but NOT copied into the image, and confirm the app only picks up values passed via `docker run -e` / environment injection — never from a stray `.env`.

**Exercise 5:** Take a Dockerfile that (deliberately, for this exercise) sets a secret via `ENV DATABASE_PASSWORD=supersecret`, build it, then run `docker history --no-trunc <image>` and locate the plaintext secret in the layer history — even after adding a later `RUN` instruction that attempts to unset it. Then fix the Dockerfile to accept the secret only via runtime environment injection and confirm `docker history` no longer contains it.

---

## 11. Interview Q&A

**Q: Why use a multi-stage Dockerfile for a NestJS application instead of a single-stage build?**
Answer: A single-stage build that runs `npm install` and `nest build` in the same image that ships to production carries the TypeScript compiler, all dev dependencies, source files, and test tooling into the runtime image — none of which are needed to actually run `node dist/main.js`. A multi-stage build separates dependency installation and compilation into discardable intermediate stages, and the final stage selectively copies in only the compiled `dist/` output and production-only `node_modules`. This typically shrinks image size by 60-80% and meaningfully reduces the attack surface, since a compromised container has far less tooling available to an attacker.

**Q: Why does using shell-form CMD break graceful shutdown, and what's the fix?**
Answer: `CMD node dist/main.js` (shell form) is actually executed as `/bin/sh -c "node dist/main.js"`, which makes the shell process PID 1 inside the container, with Node running as its child. Docker (and Kubernetes) sends `SIGTERM` to PID 1 on shutdown, but most shells do not forward signals to child processes by default — so Node never receives the signal, its shutdown hooks never run, and it is eventually force-killed with `SIGKILL` once the grace period expires, dropping any in-flight work. The fix is exec-form CMD, `CMD ["node", "dist/main.js"]`, which runs Node directly as PID 1 so it receives `SIGTERM` and can act on it via `enableShutdownHooks()`.

**Q: What does enableShutdownHooks() actually do, and what's the difference between OnModuleDestroy and OnApplicationShutdown?**
Answer: `enableShutdownHooks()` registers listeners for termination signals (SIGTERM, SIGINT) that, when received, call `app.close()`, which in turn triggers the shutdown lifecycle hooks on every provider that implements them. `OnModuleDestroy` fires during that teardown and is where most cleanup (closing a database pool, finishing in-flight work) belongs. `OnApplicationShutdown` is a more granular hook that additionally receives the signal name that triggered shutdown, useful if a provider needs to behave differently depending on whether it's a deliberate SIGINT (local dev, Ctrl+C) versus a SIGTERM from an orchestrator during a rolling deploy.

**Q: Why should secrets never be set via Dockerfile ENV or ARG instructions?**
Answer: Docker images are built as a stack of immutable layers, and every instruction — including `ENV` and `ARG` — is recorded permanently in the image's layer history. A value set this way is recoverable with `docker history` or by inspecting the image's layers directly, even if a subsequent instruction appears to overwrite or unset it, because the earlier layer containing the original value still exists in the image. Secrets must instead be injected at runtime — via orchestrator-managed environment variables, mounted secret volumes, or a secrets manager reference — so they never become part of the shipped, distributable image artifact.

**Q: How do readiness probes interact with a graceful shutdown sequence during a rolling deployment?**
Answer: When an orchestrator begins terminating a pod, it should stop routing new traffic to it as its very first action — this is driven by the readiness probe failing (or the pod being marked terminating, which most orchestrators treat as an implicit readiness failure) so the load balancer removes it from rotation. Only after new traffic stops should the application proceed with the rest of its shutdown sequence: finishing in-flight requests, closing database connections, and exiting. If readiness continues reporting healthy during shutdown, the load balancer keeps sending new requests to a pod that's actively tearing down, causing failed requests exactly during deploys — the moment reliability matters most.

**Q: What's the practical division of responsibility between a NestJS-specific containerization lesson and this repo's Docker/Kubernetes courses?**
Answer: What's specific to a NestJS application is what goes into the image (a multi-stage Dockerfile shaped around `nest build`'s `dist/` output), how it receives configuration (via `@nestjs/config` reading runtime-injected environment variables, never baked-in secrets), and how it behaves at the edges of its process lifecycle (the `/health/live` and `/health/ready` endpoints from `@nestjs/terminus`, and `enableShutdownHooks()` for clean teardown). Everything downstream of "here is a built, hardened container image" — image registries, orchestration, scheduling, networking, RBAC, autoscaling policy — is generic container/Kubernetes knowledge that doesn't depend on the application being written in NestJS, and is covered in depth by this repo's dedicated Docker and Kubernetes courses.
