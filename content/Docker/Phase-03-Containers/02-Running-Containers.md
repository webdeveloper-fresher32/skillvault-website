# Running Containers — Complete Guide

## Table of Contents
1. [The docker run Command](#1-the-docker-run-command)
2. [Detached vs Interactive Mode](#2-detached-vs-interactive-mode)
3. [Port Mapping](#3-port-mapping)
4. [Volume Mapping](#4-volume-mapping)
5. [Essential Runtime Flags](#5-essential-runtime-flags)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The docker run Command

`docker run` is the primary command for launching containers. It accepts dozens of flags that control every aspect of the container's runtime environment.

```
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
             │        │       │
             │        │       └── override the CMD in the image
             │        └────────── image name (and optional tag)
             └─────────────────── runtime configuration flags
```

### Anatomy of a Full Command

```bash
docker run \
  --name my-api \          # container name
  -d \                     # detached (background)
  -p 3000:3000 \           # port mapping: host:container
  -v $(pwd)/data:/app/data \ # volume: host-path:container-path
  -e NODE_ENV=production \ # environment variable
  --memory 512m \          # memory limit
  --restart unless-stopped \ # restart policy
  myapp:1.2.0              # image:tag
```

---

## 2. Detached vs Interactive Mode

### Detached Mode (-d / --detach)

```bash
docker run -d nginx:alpine
# Returns container ID immediately
# Container runs in background
# Your terminal is free
```

```
Without -d (foreground):
  Terminal ──── attached to ────▶ Container stdout/stderr
  [Ctrl+C] stops the container

With -d (detached):
  Terminal                        Container (background)
  returns ID                        └── logs accumulate
  prompt free                       └── access via docker logs
```

Use detached mode for:
- Long-running services (web servers, databases, queues)
- Any container in production or CI pipelines

### Interactive Mode (-it)

```bash
# -i = keep stdin open   -t = allocate a pseudo-TTY
docker run -it ubuntu bash
docker run -it python:3.11 python
docker run -it alpine sh
```

```
-i alone:   stdin open but no terminal formatting (useful for piping)
-t alone:   TTY allocated but stdin closed (not useful alone)
-it both:   full interactive terminal — the normal combination
```

```bash
# Pipe data to a container (uses -i without -t)
echo "SELECT 1;" | docker run -i postgres:15 psql -U postgres

# Run a one-off command, get output, container auto-exits
docker run --rm python:3.11 python -c "import sys; print(sys.version)"
```

### Attaching to a Running Detached Container

```bash
# Attach (connects your terminal to the container's PID 1 I/O)
docker attach my-container
# Warning: Ctrl+C will stop the container! Use Ctrl+P Ctrl+Q to detach.

# Better: open a NEW shell inside a running container
docker exec -it my-container bash
# Ctrl+C or exit here only stops the exec session, not the container
```

---

## 3. Port Mapping

Containers have their own network namespace — ports are not accessible from the host unless explicitly mapped.

### Syntax

```
-p <host-port>:<container-port>[/protocol]
```

```bash
# Map host 8080 → container 80
docker run -d -p 8080:80 nginx

# Map on a specific host interface only (security)
docker run -d -p 127.0.0.1:8080:80 nginx

# Map multiple ports
docker run -d -p 80:80 -p 443:443 nginx

# TCP is default; specify UDP explicitly
docker run -d -p 5353:53/udp my-dns-server

# Let Docker assign a random host port (ephemeral)
docker run -d -p 80 nginx
docker port <container-id>    # shows assigned host port
```

### Port Mapping Diagram

```
Your laptop / host OS
  ┌────────────────────────────────────────────────┐
  │                                                │
  │   Browser ──▶ localhost:8080                   │
  │                    │                           │
  │             Docker NAT / iptables              │
  │                    │                           │
  │   ┌────────────────▼───────────────┐           │
  │   │  Container                     │           │
  │   │  eth0: 172.17.0.2              │           │
  │   │  nginx listening on :80        │           │
  │   └────────────────────────────────┘           │
  │                                                │
  │  Host port 8080 ──────────▶ Container port 80  │
  └────────────────────────────────────────────────┘
```

### Common Port Mapping Patterns

```bash
# Web server
docker run -d -p 8080:80 nginx:alpine

# Database (bind to localhost only — never expose DB to the internet)
docker run -d -p 127.0.0.1:5432:5432 postgres:15

# Development server with auto-assigned host port
docker run -d -p 3000 node-app
docker port node-app    # e.g. 0.0.0.0:49153->3000/tcp
```

---

## 4. Volume Mapping

Containers have an ephemeral filesystem — data written inside is lost when the container is removed. Volumes persist data beyond the container lifetime.

### Three Types of Mounts

```
1. Bind Mount         host path  ←→  container path
2. Named Volume       docker-managed storage ←→ container path
3. tmpfs Mount        RAM (in-memory, never written to disk)
```

### Bind Mounts

```bash
# Syntax: -v <absolute-host-path>:<container-path>
docker run -d \
  -v /home/user/myapp/data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=secret \
  mysql:8

# Mount current directory (development workflow)
docker run -d \
  -v $(pwd):/app \
  -w /app \
  node:18 npm start

# Read-only bind mount (container cannot write to it)
docker run -d \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx
```

### Named Volumes

```bash
# Docker manages the storage location (/var/lib/docker/volumes/)
docker run -d \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15

# List volumes
docker volume ls

# Inspect where data lives on host
docker volume inspect pgdata
```

### Bind Mount vs Named Volume

```
Bind Mount:
  Host path is explicit and portable across machines via git
  ✔ Good for: source code, config files, dev hot-reload
  ✘ Bad for: database files (permission issues on Linux)

Named Volume:
  Docker manages location; survives container removal
  ✔ Good for: databases, caches, anything that must persist
  ✘ Bad for: sharing with host tools that need a known path
```

### Volume Mapping Diagram

```
Host Filesystem                      Container Filesystem
/home/user/project/                  /app/
├── src/         ◄──── bind mount ──▶ ├── src/
├── package.json ◄──── bind mount ──▶ ├── package.json
└── ...                              └── ...

/var/lib/docker/volumes/pgdata/_data/ ◄── named volume ──▶ /var/lib/postgresql/data/
```

---

## 5. Essential Runtime Flags

### Environment Variables

```bash
# Single variable
docker run -e DB_HOST=localhost mysql:8

# Multiple variables
docker run \
  -e DB_HOST=db \
  -e DB_PORT=5432 \
  -e DB_NAME=myapp \
  postgres:15

# Load from a file (one KEY=VALUE per line)
docker run --env-file .env.production myapp:latest
```

### Resource Limits

```bash
# Memory limit (container is OOM-killed if exceeded)
docker run -d --memory 512m nginx

# Memory + swap limit
docker run -d --memory 512m --memory-swap 1g nginx

# CPU shares (relative weight, default 1024)
docker run -d --cpu-shares 512 nginx

# Hard CPU limit (0.5 = half a core)
docker run -d --cpus 0.5 nginx
```

### Naming and Labels

```bash
# Human-readable name (use instead of container ID)
docker run -d --name api-server myapp

# Labels for filtering and grouping
docker run -d \
  --label env=production \
  --label team=backend \
  --label version=1.2.0 \
  myapp:1.2.0

# Filter containers by label
docker ps --filter label=env=production
```

### Network Mode

```bash
# Default bridge network
docker run -d nginx

# Connect to a custom network
docker run -d --network my-net nginx

# Share host network stack (no isolation — port conflicts possible)
docker run -d --network host nginx

# No network (completely isolated)
docker run -d --network none myapp
```

### Working Directory and User

```bash
# Override working directory
docker run -w /app node:18 npm test

# Run as a specific user (avoid running as root)
docker run -u 1001:1001 myapp
docker run -u nobody myapp
```

---

## 6. Hands-On Exercises

**Exercise 1:** Run nginx in detached mode with `docker run -d -p 8080:80 --name web nginx:alpine`. Verify it is running at `http://localhost:8080`. Then run `docker logs web` and `docker port web`. Stop and remove it with `docker rm -f web`.

**Exercise 2:** Explore interactive mode. Run `docker run -it --rm python:3.11-slim python`. In the REPL, type `import platform; print(platform.python_version())`. Exit the REPL — confirm the container is automatically removed (`docker ps -a`).

**Exercise 3:** Test bind mount hot-reload. Create `index.html` locally. Run `docker run -d -p 9000:80 -v $(pwd):/usr/share/nginx/html:ro --name static nginx`. Open `http://localhost:9000`. Edit `index.html` on your host and refresh — the change appears without restarting the container.

**Exercise 4:** Test named volume persistence. Run `docker run -d --name pg1 -e POSTGRES_PASSWORD=test -v pgdata:/var/lib/postgresql/data postgres:15`. Connect and create a table. Remove the container with `docker rm -f pg1`. Start a new container `pg2` with the same `-v pgdata:...` flag. Verify the table still exists.

**Exercise 5:** Practice resource limits. Run `docker run -d --name limited --memory 64m --cpus 0.25 nginx:alpine`. Run `docker stats limited --no-stream` and confirm the memory limit shows as 64MiB. Run `docker inspect limited | grep -A3 Memory` to see the raw byte value.

---

## 7. Interview Q&A

**Q: What is the difference between -d and -it flags in docker run?**
Answer: `-d` (detached) runs the container in the background — your terminal gets the container ID and the prompt returns immediately. Logs accumulate and are accessed via `docker logs`. `-it` combines `-i` (keep stdin open) and `-t` (allocate a pseudo-TTY) for an interactive terminal session — your terminal is attached to the container's shell. Use `-d` for long-running services and `-it` for debugging, one-off commands, or shell access.

**Q: How does Docker port mapping work?**
Answer: Each container gets its own network namespace with a private IP (e.g., 172.17.0.2). Port mapping via `-p host-port:container-port` creates a NAT rule (via iptables on Linux) that forwards traffic arriving at the host interface on `host-port` to the container's IP on `container-port`. Without `-p`, the container port is only reachable by other containers on the same Docker network — not from the host or outside world.

**Q: What is the difference between a bind mount and a named volume?**
Answer: A bind mount maps a specific host filesystem path into the container — you control where the data lives, which makes it great for source code and config files. A named volume is managed by Docker — data lives in `/var/lib/docker/volumes/` and survives container removal, but the path is Docker-controlled. Named volumes are preferred for databases because Docker handles permissions correctly, and the data is decoupled from the host directory structure.

**Q: How do you pass environment variables to a container?**
Answer: Use `-e KEY=VALUE` for individual variables, or `--env-file filename` to load a file where each line is `KEY=VALUE`. Environment variables are the standard twelve-factor app method for configuration — they override defaults baked into the image and allow the same image to run in dev, staging, and production with different configs. Sensitive values (passwords, API keys) should come from secrets managers or Docker Secrets rather than plain `-e` flags in shell history.

**Q: What happens to data written inside a container when it is removed?**
Answer: It is lost permanently. Containers use a writable layer on top of read-only image layers (overlay2 filesystem). This writable layer is deleted with the container. To persist data, use a volume (`-v`) or a bind mount — these exist independently of the container lifecycle. This is why databases, uploaded files, and any state that must survive restarts must always be stored in volumes, not in the container's writable layer.
