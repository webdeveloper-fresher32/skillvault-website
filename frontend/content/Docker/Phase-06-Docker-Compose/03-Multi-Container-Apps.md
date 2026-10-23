# Multi-Container Apps with Docker Compose — Complete Guide

## Table of Contents
1. [Designing a Multi-Container Stack](#1-designing-a-multi-container-stack)
2. [3-Tier Application Example](#2-3-tier-application-example)
3. [Service Dependencies and Health Checks](#3-service-dependencies-and-health-checks)
4. [Scaling Services](#4-scaling-services)
5. [Startup Ordering and Readiness Patterns](#5-startup-ordering-and-readiness-patterns)
6. [Logging and Observability](#6-logging-and-observability)
7. [Production-Ready Compose Patterns](#7-production-ready-compose-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Designing a Multi-Container Stack

The guiding principle for multi-container design is **one concern per container**: the database does not run inside the application container; the reverse proxy is separate from the app server. This enables independent scaling, replacement, and failure isolation.

Common tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                       External Traffic                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ :80 / :443
                ┌──────────▼──────────┐
                │    Reverse Proxy    │  (nginx / traefik)
                │    (frontend tier)  │
                └──────┬──────────────┘
                       │ :3000
          ┌────────────▼────────────┐
          │     Application API     │  (Node / Django / Spring)
          │     (backend tier)      │
          └────┬────────────────────┘
               │ :5432 / :6379 / :27017
    ┌──────────▼──────────────────────┐
    │  Database + Cache               │  (Postgres, Redis)
    │  (data tier)                    │
    └─────────────────────────────────┘
```

---

## 2. 3-Tier Application Example

A complete production-style stack: **React frontend served by Nginx**, **Node.js REST API**, **PostgreSQL database**, and **Redis cache**.

```yaml
# docker-compose.yml
name: webapp

services:

  # ── Reverse Proxy / Static File Server ──────────────────────
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - frontend-build:/usr/share/nginx/html:ro
    networks:
      - frontend
      - backend
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

  # ── React Frontend Build (init container pattern) ───────────
  frontend:
    build:
      context: ./frontend
      target: builder
    volumes:
      - frontend-build:/app/build
    networks: []              # no network needed; just writes to volume

  # ── Node.js API ──────────────────────────────────────────────
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      REDIS_URL: redis://cache:6379
    env_file:
      - .env
    networks:
      - backend
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  # ── PostgreSQL Database ──────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  # ── Redis Cache ──────────────────────────────────────────────
  cache:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - cache-data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true            # database tier has no internet access

volumes:
  db-data:
  cache-data:
  frontend-build:
```

**Companion .env file:**
```bash
# .env  (never commit secrets to git)
DB_USER=appuser
DB_PASSWORD=supersecret123
DB_NAME=webapp_prod
```

---

## 3. Service Dependencies and Health Checks

`depends_on` controls startup ordering. Without `condition`, Compose only waits for the container to **start**, not for the service inside to be ready.

### condition values

```
service_started   — container is running (default; does NOT wait for healthy)
service_healthy   — healthcheck reports healthy
service_completed_successfully — container exited with code 0 (init containers)
```

```yaml
# Correct: wait for DB to be actually ready
services:
  api:
    depends_on:
      db:
        condition: service_healthy
      migrations:
        condition: service_completed_successfully

  migrations:
    image: myapp/api
    command: python manage.py migrate
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s
```

### Health check states

```
                  ┌──────────────┐
   container      │   starting   │  (within start_period)
   starts ───────►│              │
                  └──────┬───────┘
                         │
              ┌──────────▼──────────┐
              │   test command runs  │
              └──────┬──────────────┘
              exit 0 │       │ exit ≠ 0
                     ▼       ▼
                  healthy  unhealthy  (after retries exhausted)
```

---

## 4. Scaling Services

Stateless services (API workers, background processors) can be scaled horizontally.

```bash
# Scale the API to 4 replicas
docker compose up -d --scale api=4

# Check what's running
docker compose ps
# NAME            IMAGE         STATUS    PORTS
# webapp-api-1    webapp/api    running
# webapp-api-2    webapp/api    running
# webapp-api-3    webapp/api    running
# webapp-api-4    webapp/api    running
```

**Important:** When scaling, remove `container_name` and host-port bindings from the service; otherwise Compose cannot create multiple instances.

```yaml
# WRONG — prevents scaling
services:
  api:
    container_name: my-api     # remove this
    ports:
      - "3000:3000"            # remove static host port

# CORRECT — scalable
services:
  api:
    expose:
      - "3000"                 # internal only; nginx load-balances
```

Nginx upstream configuration for scaled API:
```nginx
upstream api_cluster {
    server api:3000;           # Compose DNS round-robins across all replicas
}
```

Docker's embedded DNS automatically round-robins requests across all containers sharing the service name.

---

## 5. Startup Ordering and Readiness Patterns

Even with `depends_on: condition: service_healthy`, some apps need their own retry logic for transient connection failures.

### Entrypoint wait script pattern

```bash
#!/bin/sh
# docker-entrypoint.sh
set -e

echo "Waiting for database..."
until pg_isready -h db -U "$DB_USER"; do
  echo "  db not ready — sleeping 2s"
  sleep 2
done

echo "Running migrations..."
python manage.py migrate

echo "Starting application..."
exec "$@"
```

```yaml
services:
  api:
    build: ./api
    entrypoint: ["/docker-entrypoint.sh"]
    command: ["gunicorn", "app:application"]
```

### Init container pattern (one-shot migration)

```yaml
services:
  migrate:
    image: myapp/api:${TAG}
    command: python manage.py migrate
    depends_on:
      db:
        condition: service_healthy
    restart: "no"              # run once; do not restart

  api:
    image: myapp/api:${TAG}
    depends_on:
      migrate:
        condition: service_completed_successfully
```

---

## 6. Logging and Observability

```bash
# All services, follow, timestamps
docker compose logs -f -t

# Last 100 lines from a single service
docker compose logs --tail=100 api

# Filter by time
docker compose logs --since="2024-01-01T10:00:00" api
```

**Centralized logging with a sidecar:**
```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  log-shipper:
    image: fluent/fluent-bit:3
    volumes:
      - /var/lib/docker/containers:/var/log/containers:ro
      - ./fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
    depends_on:
      - api
```

---

## 7. Production-Ready Compose Patterns

### Pattern 1: Secrets management

```yaml
# Never put raw secrets in compose YAML
services:
  db:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # loaded from file, not env var
```

### Pattern 2: Rolling updates (with health checks)

```bash
# Update the API image without downtime
docker compose pull api
docker compose up -d --no-deps --build api
```

### Pattern 3: CI pipeline compose

```yaml
# docker-compose.ci.yml
services:
  test:
    build:
      context: .
      target: test
    command: npm test -- --ci --coverage
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://test:test@db:5432/testdb

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      retries: 10
```

```bash
# Run tests in CI
docker compose -f docker-compose.ci.yml up --abort-on-container-exit --exit-code-from test
```

---

## 8. Hands-On Exercises

**Exercise 1 — Full 3-tier stack**
Use the compose file from Section 2. Create a minimal Node.js Express API with a `/health` endpoint that returns `{"status":"ok"}`. Write the Nginx config to proxy `/api/` to the `api` service. Bring the full stack up and verify: `curl localhost/api/health` returns 200.

**Exercise 2 — Health check dependency chain**
Add health checks to `db` and `cache` services. Set the `api` service to `depends_on` both with `condition: service_healthy`. Observe startup order with `docker compose up` (non-detached) to see health check polling in the terminal output.

**Exercise 3 — Scale and load balance**
Remove `container_name` and the static host port from the `api` service. Scale it to 3 replicas with `--scale api=3`. Run `docker compose exec nginx wget -qO- http://api:3000/health` five times and note which container hostname appears in the response (add `os.hostname()` to the response body in your API code).

**Exercise 4 — Migration init container**
Add a `migrate` service that runs `node scripts/migrate.js` and exits. Set the `api` service to wait for `migrate` with `condition: service_completed_successfully`. Verify that if the migration service fails (exit 1), the `api` service does not start.

**Exercise 5 — Dev vs prod override**
Create a base `docker-compose.yml` where the API uses `image: myapp/api:prod` with `restart: always`. Create `docker-compose.override.yml` that switches to `build: ./api`, mounts source code as a bind mount, and adds `NODE_ENV=development`. Run `docker compose config` to confirm the merge, then bring up dev. Use `-f docker-compose.yml` alone to confirm prod mode skips the build and bind mount.

---

## 9. Interview Q&A

**Q:** Why should stateful services like databases not be scaled with `--scale`?

Answer: Stateful services write to disk and require coordination between replicas (leader election, replication, consensus). Simply running multiple database containers against the same volume will cause data corruption because each instance expects exclusive write access. Horizontal scaling of stateful services requires a clustering solution (e.g., Patroni for Postgres, Redis Cluster) — not just multiple Compose replicas.

---

**Q:** What is the difference between `depends_on: condition: service_started` and `condition: service_healthy`?

Answer: `service_started` only waits until Docker reports the container as running — the application inside may still be initialising. `service_healthy` waits until the container's `healthcheck` command exits with code 0, meaning the service is actually ready to accept connections. Always use `service_healthy` when a downstream service (like an API) must connect to a database on startup.

---

**Q:** How does Docker Compose handle DNS resolution when a service is scaled to multiple replicas?

Answer: Docker's embedded DNS server returns all container IPs associated with the service name. Clients that do a DNS lookup for `api` receive multiple A records (one per replica). Round-robin DNS provides basic load balancing. For more control, put a proper reverse proxy (Nginx, Traefik) in front and use the service name as the upstream.

---

**Q:** How would you run database migrations in a Compose-managed stack without running them every time the app container restarts?

Answer: Use an init container pattern: define a separate `migrate` service with `restart: "no"` that runs the migration command and exits. The main application service uses `depends_on: migrate: condition: service_completed_successfully`. Compose starts the migrator, waits for it to exit cleanly, then starts the application. On subsequent `docker compose up` runs, Compose skips already-exited containers unless the image or command changes.

---

**Q:** What does `--abort-on-container-exit` do and when is it useful?

Answer: It tells Compose to stop all services as soon as any container exits. This is critical in CI pipelines where a test runner container exits after tests complete. Without this flag, the other services (database, cache) keep running and the `docker compose up` command never returns. Combine it with `--exit-code-from <service>` to propagate the test container's exit code to the shell so CI marks the build as failed if tests fail.
