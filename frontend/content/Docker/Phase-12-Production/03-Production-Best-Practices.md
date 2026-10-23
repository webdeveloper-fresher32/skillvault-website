# Production Best Practices — Complete Guide

## Table of Contents
1. [Minimal, Hardened Images](#1-minimal-hardened-images)
2. [Health Checks](#2-health-checks)
3. [Graceful Shutdown and Signal Handling](#3-graceful-shutdown-and-signal-handling)
4. [Secrets Management](#4-secrets-management)
5. [Rolling Updates and Zero-Downtime Deploys](#5-rolling-updates-and-zero-downtime-deploys)
6. [12-Factor App Principles Applied to Docker](#6-12-factor-app-principles-applied-to-docker)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Minimal, Hardened Images

### Use the smallest viable base image

```
Image size comparison for a Node.js app:
  node:20               ~1.1 GB   (Debian, full toolchain)
  node:20-slim          ~245 MB   (Debian, stripped)
  node:20-alpine        ~60 MB    (musl libc, minimal)
  gcr.io/distroless/nodejs20   ~45 MB   (no shell, no package manager)
```

Smaller images mean:
- Faster pulls in CI/CD and on nodes
- Fewer installed packages = smaller attack surface
- Less disk cost in registries

### Production-hardened Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1 — build dependencies (never ships to prod)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2 — production image
FROM node:20-alpine AS production

# Security: create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only what production needs
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# Drop all Linux capabilities, run as non-root
USER appuser

# Document the port (does not publish it)
EXPOSE 3000

# Use exec form: PID 1 receives signals directly (no shell wrapper)
CMD ["node", "server.js"]
```

### Key hardening rules

```
Rule 1: Never run as root
  BAD:   (no USER instruction — defaults to root)
  GOOD:  RUN adduser -S appuser && USER appuser

Rule 2: Use exec form CMD/ENTRYPOINT (not shell form)
  BAD:   CMD "node server.js"    # PID 1 = /bin/sh, signals not forwarded
  GOOD:  CMD ["node", "server.js"]  # PID 1 = node, receives SIGTERM directly

Rule 3: Pin base image versions
  BAD:   FROM node:latest          # breaks unpredictably
  GOOD:  FROM node:20.14.0-alpine3.20

Rule 4: .dockerignore — keep the build context lean
  .git
  node_modules
  .env
  *.log
  coverage/
  .DS_Store
```

---

## 2. Health Checks

### HEALTHCHECK instruction in Dockerfile

```dockerfile
FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Docker health check — Docker daemon runs this inside the container
HEALTHCHECK \
  --interval=30s \      # run every 30 seconds
  --timeout=5s \        # fail if no response within 5 seconds
  --start-period=10s \  # grace period after container starts
  --retries=3 \         # mark unhealthy after 3 consecutive failures
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health \
      || exit 1

EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Check health status

```bash
docker ps                                    # STATUS column shows (healthy)/(unhealthy)
docker inspect --format='{{.State.Health}}' myapp
docker inspect myapp | jq '.[0].State.Health.Log'
```

### Health endpoint in your app

```javascript
// server.js — Express health endpoint
const db = require('./db');

// Liveness — is the process alive and not deadlocked?
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Readiness — are dependencies (DB, cache) ready?
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});
```

### Health checks in Docker Compose

```yaml
services:
  web:
    image: myorg/myapp:1.4.2
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    depends_on:
      db:
        condition: service_healthy   # wait until DB is healthy before starting web

  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 3s
      retries: 5
```

---

## 3. Graceful Shutdown and Signal Handling

When Docker stops a container it sends SIGTERM. Your app must catch it, finish in-flight requests, close connections, and exit cleanly — otherwise Docker sends SIGKILL after 10 seconds, which forcefully kills the process and may corrupt data or drop requests.

```
docker stop myapp:
  1. Docker sends SIGTERM to PID 1
  2. App has --stop-timeout seconds (default 10) to shut down
  3. If still running → Docker sends SIGKILL (immediate kill)

Shell-form CMD problem:
  CMD "node server.js"
  PID 1 = /bin/sh  ← /bin/sh does NOT forward signals to node
  Result: node never receives SIGTERM → SIGKILL after 10 seconds

Exec-form CMD solution:
  CMD ["node", "server.js"]
  PID 1 = node ← node receives SIGTERM directly
```

### Graceful shutdown in Node.js

```javascript
// server.js
const server = app.listen(3000, () => console.log('Listening on 3000'));

function gracefulShutdown(signal) {
  console.log(`Received ${signal} — starting graceful shutdown`);

  server.close(() => {
    console.log('HTTP server closed — no new connections accepted');

    // Close DB pool, flush logs, etc.
    db.end(() => {
      console.log('DB connections closed — exiting cleanly');
      process.exit(0);
    });
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('Graceful shutdown timeout — forcing exit');
    process.exit(1);
  }, 9000);   // 9s < Docker's default 10s stop-timeout
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
```

### Extend stop timeout for slow apps

```bash
# Give the container 30 seconds to shut down before SIGKILL
docker stop --time 30 myapp

# In Docker Compose
services:
  web:
    stop_grace_period: 30s
```

---

## 4. Secrets Management

### Never bake secrets into images

```dockerfile
# BAD — secret is baked into the image layer, visible in docker history
ENV DATABASE_URL=postgres://admin:supersecret@db:5432/mydb

# GOOD — pass at runtime
docker run -e DATABASE_URL="$DATABASE_URL" myapp
```

### Docker Secrets (Swarm)

```bash
# Create a secret
echo "supersecret" | docker secret create db_password -

# Use in a service
docker service create \
  --secret db_password \
  --name myapp \
  myorg/myapp:1.4.2
# Secret is mounted at /run/secrets/db_password inside the container
```

### Secrets in Docker Compose (dev/staging)

```yaml
services:
  web:
    image: myorg/myapp:1.4.2
    secrets:
      - db_password
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # never commit this file
```

### Kubernetes Secrets

```yaml
# Create a secret imperatively
kubectl create secret generic myapp-secrets \
  --from-literal=database-url="postgres://admin:pass@db:5432/mydb" \
  -n production

# Reference in Deployment (see 02-Docker-and-Kubernetes.md)
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: myapp-secrets
        key: database-url
```

---

## 5. Rolling Updates and Zero-Downtime Deploys

```
Zero-downtime rolling update flow:

  Before:  [v1] [v1] [v1]   all 3 pods serving traffic

  Step 1:  [v1] [v1] [v2]   new pod started, passes readiness
           [v1] [v1] [v2]   ← traffic routes to all 3

  Step 2:  [v1] [v2] [v2]   one old pod terminated
           [v1] [v2] [v2]   ← still 3 pods serving

  Step 3:  [v2] [v2] [v2]   all replaced — done
```

### Update strategy options

```yaml
# In deployment.yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0    # never reduce capacity below desired
    maxSurge: 1          # allow 1 extra pod during update

# Blue/Green approach with two Deployments + Service selector swap:
# Deploy v2 fully → switch Service selector from app=v1 to app=v2
# Instant cutover, easy rollback (switch selector back)
```

### docker-compose rolling update (single host)

```bash
# Build and push new image
docker build -t myorg/myapp:1.4.3 . && docker push myorg/myapp:1.4.3

# Pull new image then replace containers one at a time
docker compose pull web
docker compose up -d --no-deps --scale web=2 web    # bring up new alongside old
docker compose up -d --no-deps web                   # replace old
```

---

## 6. 12-Factor App Principles Applied to Docker

```
Factor          Docker implementation
─────────────   ──────────────────────────────────────────────────
I.   Codebase   One image per commit; tags map to git SHAs
II.  Deps       All deps baked into image via Dockerfile RUN steps
III. Config     Pass via ENV vars at runtime, never in the image
IV.  Backing    DB/cache URLs injected via ENV at run time
     services
V.   Build/run  docker build = build stage; docker run = run stage
     /release
VI.  Processes  Containers are stateless; state lives in volumes/DB
VII. Port       EXPOSE in Dockerfile; -p maps host → container port
     binding
VIII.Concurrency Scale with replicas (docker scale / kubectl scale)
IX.  Disposability SIGTERM handler for fast graceful shutdown
X.   Dev/prod   Same image dev → staging → prod; only ENV changes
     parity
XI.  Logs       Write to stdout/stderr; Docker captures log streams
XII. Admin      Run one-off tasks: docker run --rm myapp npm migrate
```

### Applying factor XI — logs to stdout

```dockerfile
# BAD: app writes to a file inside the container
CMD ["node", "-e", "require('./app').start(); require('fs').writeFileSync('/app/app.log', ...)"]

# GOOD: configure app to write to stdout
ENV LOG_OUTPUT=stdout
CMD ["node", "server.js"]
```

```bash
# Docker captures stdout/stderr per container
docker logs myapp
docker logs -f myapp                     # follow
docker logs --since 1h myapp             # last 1 hour
docker logs --tail 100 myapp             # last 100 lines
```

---

## 7. Hands-On Exercises

**Exercise 1:** Take an existing Dockerfile that runs as root. Add a non-root user with `adduser -S`, set `USER` to that user, and switch CMD to exec form. Build and run it — verify `docker exec myapp whoami` returns the non-root username, not `root`.

**Exercise 2:** Add a `HEALTHCHECK` instruction to a Node.js Dockerfile using `wget` to hit `/health`. Start the container and run `docker ps` repeatedly — observe it go from `starting` to `healthy`. Then break the `/health` route and watch it go `unhealthy`.

**Exercise 3:** Implement a SIGTERM handler in a Node.js or Python app that logs "graceful shutdown started", waits 2 seconds, then exits 0. Build the image with exec-form CMD. Run `docker stop --time 5 myapp` and confirm the shutdown message appears in `docker logs myapp`.

**Exercise 4:** Demonstrate the secrets anti-pattern vs best practice. Build an image with `ENV DB_PASS=secret123` — run `docker history <image>` to show the secret is visible. Rebuild without the ENV and pass the secret at runtime via `-e`. Confirm `docker history` no longer exposes it.

**Exercise 5:** Set up a docker-compose file with a web service that has `healthcheck` configured and `depends_on` the DB with `condition: service_healthy`. Bring up the stack with `docker compose up` and verify the web container waits until the DB is healthy before starting.

---

## 8. Interview Q&A

**Q: Why should Docker containers run as a non-root user?**
Answer: If a process inside the container is compromised and escapes the container namespace, running as root means the attacker has root on the host. Running as a non-root user limits the blast radius to the container's user space. It also prevents accidental writes to system directories and is a requirement in many Kubernetes environments where `runAsNonRoot: true` is enforced by Pod Security Standards.

**Q: What is the difference between CMD exec form and shell form, and why does it matter for production?**
Answer: Shell form (`CMD "node server.js"`) wraps the command in `/bin/sh -c`, making `/bin/sh` PID 1. Signals like SIGTERM are sent to PID 1 but `/bin/sh` does not forward them to child processes, so Node never receives SIGTERM and gets SIGKILL after the stop timeout — hard kill, no graceful shutdown. Exec form (`CMD ["node", "server.js"]`) makes `node` PID 1 directly, so it receives SIGTERM and can shut down gracefully.

**Q: What is a Docker HEALTHCHECK and how does it differ from a Kubernetes readiness probe?**
Answer: A Docker HEALTHCHECK is evaluated by the Docker daemon and marks the container `healthy`/`unhealthy` in `docker ps`. It can influence Docker Swarm scheduling but is ignored by Kubernetes — Kubernetes uses its own liveness and readiness probes defined in the Pod spec. A readiness probe also removes the Pod from Service endpoints when unhealthy, actively preventing bad traffic routing, which HEALTHCHECK cannot do.

**Q: How should application secrets like database passwords be handled in Docker?**
Answer: Secrets must never be baked into the image — they appear in layer history and registries. Pass them at runtime via environment variables (`docker run -e`), Docker Secrets (`/run/secrets/`), or Kubernetes Secrets (mounted as env vars or files). In production, integrate with a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager) and inject secrets at container startup. Always add `.env` and secrets files to `.dockerignore` and `.gitignore`.

**Q: What are the key principles for making a Docker container production-grade?**
Answer: Use a minimal base image (alpine or distroless) to reduce attack surface and pull time. Run as non-root. Use exec-form CMD so PID 1 receives signals. Implement SIGTERM handling for graceful shutdown. Add a HEALTHCHECK (or K8s probes). Pass all config via environment variables (12-factor). Never embed secrets in the image. Pin exact base image versions. Use multi-stage builds to keep the production image free of build tools and dev dependencies.
