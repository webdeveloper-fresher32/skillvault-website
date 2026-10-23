# Docker Compose Fundamentals — Complete Guide

## Table of Contents
1. [What Is Docker Compose?](#1-what-is-docker-compose)
2. [How Compose Works — Architecture](#2-how-compose-works--architecture)
3. [Installing and Verifying Compose](#3-installing-and-verifying-compose)
4. [Project Structure and Naming](#4-project-structure-and-naming)
5. [Core CLI Commands](#5-core-cli-commands)
6. [Your First Compose File](#6-your-first-compose-file)
7. [Lifecycle Management](#7-lifecycle-management)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Is Docker Compose?

Docker Compose is a tool for **defining and running multi-container applications** using a single declarative YAML file. Instead of running multiple `docker run` commands with many flags, you describe the entire application stack — services, networks, volumes, environment variables — in one place and bring everything up with a single command.

Key benefits:
- Reproducible environments (dev, staging, CI all use the same file)
- Automatic service discovery between containers via DNS
- Shared named networks and volumes managed declaratively
- Built-in dependency ordering with `depends_on`

Compose V2 ships as a Docker CLI plugin (`docker compose`) rather than the standalone `docker-compose` binary. The syntax is identical; the plugin is the modern standard.

---

## 2. How Compose Works — Architecture

```
┌─────────────────────────────────────────────────────┐
│                  docker-compose.yml                 │
│                                                     │
│  services:          networks:       volumes:        │
│    web: ...           app-net: {}     db-data: {}   │
│    api: ...                                         │
│    db:  ...                                         │
└────────────────────┬────────────────────────────────┘
                     │  docker compose up
                     ▼
┌─────────────────────────────────────────────────────┐
│                  Docker Engine                      │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  web     │    │  api     │    │  db          │  │
│  │container │◄──►│container │◄──►│  container   │  │
│  └──────────┘    └──────────┘    └──────────────┘  │
│         │               │               │           │
│         └───────────────┴───────────────┘           │
│                    app-net (bridge)                  │
└─────────────────────────────────────────────────────┘
```

Compose reads the YAML, then instructs Docker Engine to:
1. Pull or build images for each service
2. Create defined networks
3. Create defined volumes
4. Start containers in dependency order
5. Attach containers to the correct networks

---

## 3. Installing and Verifying Compose

**Docker Desktop (macOS / Windows):** Compose V2 is bundled — no extra install needed.

**Linux — install the plugin:**
```bash
# Install Docker Engine first, then add the Compose plugin
sudo apt-get install docker-compose-plugin

# Verify
docker compose version
# Docker Compose version v2.27.0
```

**Check both the legacy binary and the plugin:**
```bash
docker compose version      # plugin (preferred)
docker-compose --version    # legacy standalone binary
```

---

## 4. Project Structure and Naming

Compose uses the **project name** to namespace all resources (containers, networks, volumes). By default it is the name of the directory containing the compose file.

```
my-app/                        ← project name: "my-app"
├── docker-compose.yml         ← default compose file
├── docker-compose.override.yml← automatically merged (dev overrides)
├── docker-compose.prod.yml    ← explicit override for production
├── .env                       ← default env-var file (auto-loaded)
├── frontend/
│   └── Dockerfile
├── backend/
│   └── Dockerfile
└── nginx/
    └── nginx.conf
```

Override the project name:
```bash
docker compose -p myproject up
# or set in environment
export COMPOSE_PROJECT_NAME=myproject
```

---

## 5. Core CLI Commands

### Starting and Stopping
```bash
# Start all services (detached)
docker compose up -d

# Start and rebuild images first
docker compose up -d --build

# Stop containers but keep networks/volumes
docker compose stop

# Stop and remove containers, networks (keeps volumes)
docker compose down

# Stop and remove everything including volumes
docker compose down -v
```

### Inspecting
```bash
# List running containers in this project
docker compose ps

# Show all (including stopped)
docker compose ps -a

# Stream logs from all services
docker compose logs -f

# Logs for one service only
docker compose logs -f api

# Show last 50 lines then follow
docker compose logs --tail=50 -f db
```

### Executing Commands
```bash
# Run a one-off command in a new container
docker compose run --rm api python manage.py migrate

# Execute in a running container
docker compose exec web sh

# Execute as a specific user
docker compose exec --user root web bash
```

### Building
```bash
# Build (or rebuild) all services with a build context
docker compose build

# Build a specific service
docker compose build api

# Pull latest base images before building
docker compose build --pull
```

### Scaling
```bash
# Start 3 replicas of the worker service
docker compose up -d --scale worker=3

# Scale down to 1
docker compose up -d --scale worker=1
```

---

## 6. Your First Compose File

A minimal two-service example: an Nginx front end serving static files, and a simple Redis cache.

```yaml
# docker-compose.yml
version: "3.9"

services:
  web:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro
    networks:
      - frontend

  cache:
    image: redis:7-alpine
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
```

Run it:
```bash
docker compose up -d
docker compose ps
docker compose logs web
docker compose down
```

---

## 7. Lifecycle Management

```
                    docker compose up
                          │
          ┌───────────────▼──────────────┐
          │         RUNNING              │
          │  (containers healthy/started)│
          └───────┬───────────┬──────────┘
                  │           │
        docker    │           │  docker
        compose   │           │  compose
        stop      │           │  down
                  ▼           ▼
          ┌────────────┐  ┌─────────────────────┐
          │  STOPPED   │  │ REMOVED             │
          │(containers │  │(containers+networks │
          │ preserved) │  │ removed)            │
          └─────┬──────┘  └─────────────────────┘
                │
        docker compose start
                │
                ▼
          RUNNING again
```

Compose tracks state per project name. Resources from different projects do not interfere even when using the same image names.

---

## 8. Hands-On Exercises

**Exercise 1 — Run a web server with Compose**
Create a directory `lab01/`, write a `docker-compose.yml` that runs `nginx:alpine` on port 8080 with a local `./html/index.html` mounted read-only. Bring it up, verify in the browser, then tear it down.

**Exercise 2 — Two-service project**
Add a `redis:7-alpine` service to Exercise 1. Confirm both services appear in `docker compose ps`. Use `docker compose exec` to run `redis-cli ping` inside the Redis container.

**Exercise 3 — Inspect logs**
Add the `--scale` flag to start 2 replicas of the `web` service. Use `docker compose logs -f web` and observe interleaved output. Identify which replica name prefixes each log line.

**Exercise 4 — Environment variables via .env**
Create a `.env` file with `NGINX_PORT=9090`. Update the compose file to reference `${NGINX_PORT}`. Bring the project up and verify Nginx listens on 9090 with `curl localhost:9090`.

**Exercise 5 — Teardown comparison**
Run `docker compose down` and note which resources remain. Then restart and run `docker compose down -v`. Compare the `docker volume ls` output before and after each command to understand what `-v` removes.

---

## 9. Interview Q&A

**Q:** What is the difference between `docker compose stop` and `docker compose down`?

Answer: `stop` halts the running containers but leaves them (and their networks/volumes) intact so you can restart quickly with `docker compose start`. `down` removes the containers and the networks Compose created. Volumes are only removed when you add the `-v` flag.

---

**Q:** What is the default project name for a Compose project?

Answer: The name of the directory containing the `docker-compose.yml` file. You can override it with the `-p` flag, the `COMPOSE_PROJECT_NAME` environment variable, or the top-level `name:` key in the compose file (Compose V2).

---

**Q:** How does service discovery work between Compose services?

Answer: Compose attaches all services to the same default network and registers each service's name as a DNS hostname. So a service named `api` is reachable at the hostname `api` from any other container in the project without any extra configuration.

---

**Q:** What is the purpose of `docker compose run` vs `docker compose exec`?

Answer: `run` starts a **new** container from the service's image and runs a one-off command (useful for migrations, shell access before containers start). `exec` runs a command inside an **already-running** container. Use `--rm` with `run` to delete the temporary container after it exits.

---

**Q:** How do you force a rebuild of images when using `docker compose up`?

Answer: Pass the `--build` flag: `docker compose up -d --build`. This triggers a fresh `docker build` for every service that has a `build:` context defined, even if the image already exists locally. To also pull the latest base layers, combine with `docker compose build --pull` beforehand.
