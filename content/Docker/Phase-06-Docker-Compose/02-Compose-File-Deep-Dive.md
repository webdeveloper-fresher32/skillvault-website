# Docker Compose File Deep Dive — Complete Guide

## Table of Contents
1. [Compose File Structure](#1-compose-file-structure)
2. [Services in Detail](#2-services-in-detail)
3. [Networking](#3-networking)
4. [Volumes](#4-volumes)
5. [Environment Variables and .env Files](#5-environment-variables-and-env-files)
6. [Compose Override Files](#6-compose-override-files)
7. [Resource Constraints and Restart Policies](#7-resource-constraints-and-restart-policies)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Compose File Structure

A `docker-compose.yml` has four top-level sections:

```
┌─────────────────────────────────────────────┐
│            docker-compose.yml               │
│                                             │
│  name: my-app          ← project name (V2)  │
│                                             │
│  services:             ← containers to run  │
│    web: ...                                 │
│    api: ...                                 │
│                                             │
│  networks:             ← custom networks    │
│    app-net: ...                             │
│                                             │
│  volumes:              ← named volumes      │
│    db-data: ...                             │
│                                             │
│  configs: / secrets:   ← Swarm / advanced   │
└─────────────────────────────────────────────┘
```

The `version:` key is **deprecated** in Compose V2 and can be omitted. The schema is inferred automatically.

---

## 2. Services in Detail

Services are the core of a compose file. Each service maps to one container (or multiple when scaled).

```yaml
services:
  api:
    # --- Image source (pick one) ---
    image: node:20-alpine          # use a pre-built image
    build:                         # OR build from source
      context: ./backend
      dockerfile: Dockerfile.prod
      args:
        NODE_ENV: production

    # --- Container identity ---
    container_name: my-api         # explicit name (prevents scaling)
    hostname: api-server

    # --- Port mapping ---
    ports:
      - "3000:3000"                # host:container
      - "127.0.0.1:9229:9229"     # bind to localhost only

    # --- Volumes ---
    volumes:
      - ./backend:/app             # bind mount (dev hot-reload)
      - node_modules:/app/node_modules  # named volume overlay

    # --- Environment ---
    environment:
      NODE_ENV: production
      PORT: 3000
    env_file:
      - .env
      - .env.api

    # --- Networking ---
    networks:
      - backend-net
    expose:
      - "3000"                     # internal only, no host binding

    # --- Dependencies ---
    depends_on:
      db:
        condition: service_healthy  # wait for healthcheck to pass

    # --- Health check ---
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s

    # --- Runtime ---
    restart: unless-stopped
    command: ["node", "server.js"]
    entrypoint: ["/docker-entrypoint.sh"]
    working_dir: /app
    user: "1001:1001"

    # --- Labels ---
    labels:
      app.component: "api"
      app.version: "2.1"
```

### Build vs Image

| Scenario | Use |
|---|---|
| Using a published image | `image: nginx:alpine` |
| Building from local Dockerfile | `build: ./path` |
| Build with custom Dockerfile name | `build: { context: ., dockerfile: Dockerfile.dev }` |
| Build then tag | `image: myapp:latest` + `build: ./` |

---

## 3. Networking

By default, Compose creates one network per project and attaches all services to it. You can define additional networks for isolation.

```yaml
services:
  nginx:
    image: nginx:alpine
    networks:
      - frontend
      - backend          # nginx bridges both tiers

  api:
    build: ./api
    networks:
      - backend          # api is NOT on frontend network

  db:
    image: postgres:16
    networks:
      - backend          # db only reachable from backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true       # no external internet access
```

```
Internet ──► nginx ──► api ──► db
              │         │       │
           frontend  backend  backend
                        │       │
                     (isolated from internet)
```

### Network drivers

```yaml
networks:
  host-net:
    driver: host          # share host network stack (Linux only)

  overlay-net:
    driver: overlay       # multi-host (Swarm)
    attachable: true

  macvlan-net:
    driver: macvlan
    driver_opts:
      parent: eth0

  custom-bridge:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: my-bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Connecting to an existing (external) network

```yaml
networks:
  shared:
    external: true        # must already exist; not created by Compose
    name: my-shared-net
```

---

## 4. Volumes

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data   # named volume
      - ./init-scripts:/docker-entrypoint-initdb.d:ro  # bind mount

  backup:
    image: alpine
    volumes:
      - db-data:/backup/data:ro            # share the same named volume

volumes:
  db-data:                                 # simple named volume (local driver)

  nfs-share:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,rw
      device: ":/exports/data"

  external-vol:
    external: true                         # must already exist
    name: my-existing-volume
```

### Volume types comparison

```
┌──────────────┬──────────────────────┬──────────────────────┐
│ Type         │ Syntax               │ Use case             │
├──────────────┼──────────────────────┼──────────────────────┤
│ Named volume │ db-data:/var/lib/pg  │ Persist DB data      │
│ Bind mount   │ ./code:/app          │ Dev hot-reload       │
│ tmpfs        │ type: tmpfs          │ Secrets in memory    │
│ Anonymous    │ /var/lib/data        │ Short-lived scratch  │
└──────────────┴──────────────────────┴──────────────────────┘
```

---

## 5. Environment Variables and .env Files

### Precedence (highest to lowest)

```
1. Shell environment variable (already exported)
2. .env file in the project directory
3. environment: key in docker-compose.yml
4. ENV instruction in the Dockerfile
```

### .env file (auto-loaded)

```bash
# .env
POSTGRES_USER=appuser
POSTGRES_PASSWORD=s3cr3t
POSTGRES_DB=myapp
APP_PORT=8080
IMAGE_TAG=1.4.2
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}

  web:
    image: myapp:${IMAGE_TAG}
    ports:
      - "${APP_PORT}:80"
```

### Multiple env files per service

```yaml
services:
  api:
    env_file:
      - .env             # shared vars
      - .env.api         # api-specific vars
      - .env.secrets     # sensitive vars (gitignored)
```

### Validate variable substitution

```bash
docker compose config          # prints the fully-resolved compose file
docker compose config --quiet  # silent; exit code 1 if invalid
```

---

## 6. Compose Override Files

Compose automatically merges `docker-compose.yml` with `docker-compose.override.yml` when both exist. This is the standard pattern for dev/prod separation.

```
docker-compose.yml              ← base (committed, production-safe)
docker-compose.override.yml     ← dev overrides (may be gitignored)
docker-compose.prod.yml         ← explicit prod overrides
docker-compose.ci.yml           ← CI-specific overrides
```

**Base file (docker-compose.yml):**
```yaml
services:
  api:
    image: myapp/api:${IMAGE_TAG:-latest}
    restart: always
    environment:
      NODE_ENV: production
```

**Dev override (docker-compose.override.yml — auto-merged):**
```yaml
services:
  api:
    build: ./api           # override: build locally in dev
    volumes:
      - ./api:/app         # hot-reload
    environment:
      NODE_ENV: development
      DEBUG: "true"
    ports:
      - "9229:9229"        # debugger port
```

**Explicit merge for production:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**docker-compose.prod.yml:**
```yaml
services:
  api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
```

---

## 7. Resource Constraints and Restart Policies

```yaml
services:
  worker:
    image: myapp/worker
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    restart: unless-stopped

  # Restart policies:
  # no            - never restart (default)
  # always        - always restart
  # on-failure    - only on non-zero exit code
  # unless-stopped- restart unless manually stopped
```

```yaml
# on-failure with max retry count
services:
  flaky-job:
    image: myapp/job
    restart: on-failure
    # using the long form
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

---

## 8. Hands-On Exercises

**Exercise 1 — Multi-network isolation**
Write a compose file with three services: `nginx`, `api`, `db`. Place `nginx` on both `frontend` and `backend` networks; place `api` and `db` only on `backend`. Mark `backend` as `internal: true`. Verify that `db` cannot reach the internet by running `docker compose exec db ping 8.8.8.8`.

**Exercise 2 — Named volume persistence**
Define a `postgres:16` service with a named volume `pg-data`. Bring the stack up, create a test database, run `docker compose down`, then `docker compose up -d` again. Confirm the database still exists. Then run `docker compose down -v` and verify the data is gone.

**Exercise 3 — .env substitution**
Create a `.env` file that sets `WEB_PORT`, `API_TAG`, and `DB_PASSWORD`. Reference all three in your compose file. Run `docker compose config` to confirm the values are substituted before bringing the stack up.

**Exercise 4 — Override files**
Create a base `docker-compose.yml` that uses `image: myapp:prod` for the `api` service. Create a `docker-compose.override.yml` that replaces this with `build: ./api`. Run `docker compose config` and observe how Compose merges the two files. Then run `docker compose -f docker-compose.yml up -d` (without the override) and compare behavior.

**Exercise 5 — Resource limits**
Add `deploy.resources.limits` of 256MB RAM and 0.5 CPU to a service. Run `docker compose up -d` and verify the limits with `docker inspect <container_id> | grep -A5 Memory`.

---

## 9. Interview Q&A

**Q:** How does Compose merge `docker-compose.yml` and `docker-compose.override.yml`?

Answer: Compose applies a deep merge strategy. Scalar values (strings, numbers) in the override replace those in the base. Mappings (dictionaries) are merged recursively. Sequences (lists such as `ports`, `volumes`, `environment`) are **concatenated** — items from both files appear in the result. This means you cannot remove a port from the override; you can only add.

---

**Q:** What is the difference between `expose` and `ports` in a service definition?

Answer: `ports` publishes a container port to the host, making it accessible from outside Docker. `expose` documents that a port is used internally but does NOT publish it to the host. Other services in the same Compose project can still reach an exposed port via the service name DNS because they share the same network.

---

**Q:** How do you prevent a variable in your shell from accidentally overriding a value in `.env`?

Answer: You cannot — shell environment variables always take precedence over `.env`. The safest approach is to use `env_file:` to load specific files explicitly and avoid exporting secrets into the shell. You can also use `docker compose config` to audit the fully-resolved values before running.

---

**Q:** When would you use an `external` volume in Compose?

Answer: When the volume is managed outside the Compose project lifecycle — for example, a volume pre-provisioned by an ops team, shared between multiple Compose projects, or seeded with data before deployment. Compose will error at startup if the external volume does not exist, which acts as a safety check.

---

**Q:** What happens to services not listed under `depends_on` when you run `docker compose up <service>`?

Answer: Only the specified service and its declared dependencies (via `depends_on`) are started. Services with no dependency relationship to the target are not started. This is useful for debugging a single service without spinning up the entire stack.
