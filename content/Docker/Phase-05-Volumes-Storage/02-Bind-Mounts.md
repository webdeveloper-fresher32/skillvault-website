# Bind Mounts — Complete Guide

## Table of Contents
1. [What is a Bind Mount?](#1-what-is-a-bind-mount)
2. [Bind Mount Syntax](#2-bind-mount-syntax)
3. [Read-Only Bind Mounts](#3-read-only-bind-mounts)
4. [Local Development Workflow](#4-local-development-workflow)
5. [Config Injection](#5-config-injection)
6. [Bind Mounts vs Named Volumes](#6-bind-mounts-vs-named-volumes)
7. [Bind Mount Gotchas](#7-bind-mount-gotchas)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Bind Mount?

A bind mount maps a specific path on the host filesystem directly into a container. Unlike a named volume, Docker does not manage the storage — the data lives exactly where you point it on the host and the container sees it in real time.

```
Host machine                        Container
────────────────                    ─────────────────────────────
/home/ganesh/
  myapp/                            /app/
    src/                   ──────►    src/
      server.js                          server.js   (same inode)
      routes.js                          routes.js
    package.json           ──────►    package.json
    .env                   ──────►    .env  (or :ro for safety)

Changes on the host appear immediately inside the container.
Changes inside the container appear immediately on the host.
No copy, no sync — they are the same files.
```

### Key characteristics

```
Bind mount:
  ✔ Host controls the path (not Docker)
  ✔ Changes are bidirectional and instant
  ✔ Works with any existing host directory
  ✔ Perfect for local development (hot reload)
  ✗ Path must exist on the host (or Docker creates an empty dir)
  ✗ Ties the container to a specific host path (portability concern)
  ✗ Any process inside the container can modify host files (security risk)
```

---

## 2. Bind Mount Syntax

### -v flag

```bash
# Syntax: -v <host-absolute-path>:<container-path>[:<options>]

# Mount current working directory into container
docker run -d \
  --name node-app \
  -v $(pwd):/app \
  -p 3000:3000 \
  node:18-alpine \
  node /app/src/server.js

# Mount a specific host directory
docker run -d \
  -v /home/ganesh/myapp:/app \
  -w /app \
  node:18-alpine \
  npm start

# Mount a single file (not a directory)
docker run -d \
  -v /etc/localtime:/etc/localtime:ro \
  myapp:latest
```

### --mount flag (preferred)

```bash
# Syntax: --mount type=bind,source=<host-path>,target=<container-path>[,options]

docker run -d \
  --name node-app \
  --mount type=bind,source=$(pwd),target=/app \
  -p 3000:3000 \
  node:18-alpine \
  node /app/src/server.js

# Read-only bind mount
docker run -d \
  --mount type=bind,source=/etc/nginx/nginx.conf,target=/etc/nginx/nginx.conf,readonly \
  nginx:latest

# With consistency option (macOS performance tuning)
docker run -d \
  --mount type=bind,source=$(pwd),target=/app,consistency=cached \
  node:18-alpine \
  npm start
```

### macOS consistency options

```
consistency=consistent  (default) Host and container always in sync
consistency=cached      Host is authoritative; container may lag slightly (faster reads)
consistency=delegated   Container is authoritative; host may lag slightly (faster writes)

On Linux, all three behave identically — only affects Docker Desktop on macOS.
```

---

## 3. Read-Only Bind Mounts

Mounting a path read-only prevents container processes from modifying host files, reducing blast radius if a container is compromised.

```bash
# :ro suffix with -v
docker run -d \
  --name nginx \
  -v /home/ganesh/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /home/ganesh/html:/usr/share/nginx/html:ro \
  -p 80:80 \
  nginx:latest

# readonly option with --mount
docker run -d \
  --name nginx \
  --mount type=bind,source=/home/ganesh/nginx.conf,target=/etc/nginx/nginx.conf,readonly \
  --mount type=bind,source=/home/ganesh/html,target=/usr/share/nginx/html,readonly \
  -p 80:80 \
  nginx:latest

# Verify read-only enforcement
docker exec nginx touch /etc/nginx/nginx.conf
# touch: /etc/nginx/nginx.conf: Read-only file system

# Read-only root filesystem + specific writable paths
docker run -d \
  --read-only \
  --mount type=tmpfs,target=/tmp \
  --mount type=bind,source=$(pwd)/logs,target=/var/log/app \
  myapp:latest
```

---

## 4. Local Development Workflow

Bind mounts are the primary tool for local development — mount your source code into a container running the language runtime so you get hot reload without rebuilding the image on every code change.

```
Development loop WITHOUT bind mounts:
  edit code → docker build → docker run → test → repeat (slow)

Development loop WITH bind mounts:
  docker run (once) → edit code → hot-reload in container → test (fast)
```

### Node.js with nodemon

```bash
# Start dev container — source code from host, dependencies in container
docker run -d \
  --name node-dev \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/package.json:/app/package.json \
  -p 3000:3000 \
  -w /app \
  node:18-alpine \
  sh -c "npm install && npx nodemon src/server.js"

# Edit src/server.js on your host → nodemon detects change → restarts server
# No rebuild needed
```

### Python Flask with auto-reload

```bash
docker run -d \
  --name flask-dev \
  -v $(pwd):/app \
  -p 5000:5000 \
  -e FLASK_ENV=development \
  -e FLASK_APP=app.py \
  -w /app \
  python:3.11-slim \
  sh -c "pip install -r requirements.txt && flask run --host=0.0.0.0"
```

### Separating source from node_modules (anonymous volume trick)

```bash
# Problem: mounting $(pwd) overwrites node_modules inside the container
# Solution: mount source, then use an anonymous volume for node_modules

docker run -d \
  --name node-dev \
  -v $(pwd):/app \
  -v /app/node_modules \       # anonymous volume hides host node_modules
  -p 3000:3000 \
  node:18-alpine \
  npm start

# Container uses its own node_modules (installed during build)
# Host src changes are still reflected immediately
```

---

## 5. Config Injection

Inject configuration files into a container at runtime without rebuilding the image. The container image ships with a default config; the bind mount overlays it with an environment-specific one.

```
Image layer:                    Runtime (bind mount):
  /etc/myapp/                     /home/ganesh/configs/
    config.yaml (defaults)  →       prod-config.yaml
    logging.yaml (defaults) →       prod-logging.yaml

Container sees the host file at /etc/myapp/config.yaml — not the image default.
```

```bash
# Inject production config
docker run -d \
  --name myapp-prod \
  -v /etc/myapp/prod/config.yaml:/etc/myapp/config.yaml:ro \
  -v /etc/myapp/prod/logging.yaml:/etc/myapp/logging.yaml:ro \
  myapp:v2.1

# Inject TLS certificates
docker run -d \
  --name nginx-prod \
  -v /etc/letsencrypt/live/example.com:/certs:ro \
  -v /etc/nginx/prod.conf:/etc/nginx/nginx.conf:ro \
  -p 443:443 \
  nginx:latest

# Inject secrets as files (preferred over env vars for sensitive data)
docker run -d \
  --name app \
  -v /run/secrets/db_password:/run/secrets/db_password:ro \
  myapp:latest
```

---

## 6. Bind Mounts vs Named Volumes

```
                    Bind Mount              Named Volume
──────────────────────────────────────────────────────────
Managed by          Host / user             Docker daemon
Path on host        You choose              /var/lib/docker/volumes/
Path must exist     Yes (dir or file)       No (Docker creates it)
Portability         Low (host-specific)     High (Docker manages it)
Best for            Dev, config inject      Databases, persistent state
Performance         Same as host FS         Same as host FS
Backup              cp / rsync host path    docker run + tar
Security            Can modify host files   Isolated from host paths
Works in Swarm      Risky (node-specific)   Yes (with volume drivers)
```

### Decision guide

```
Use a bind mount when:
  → Local development (live code reload)
  → Injecting config or cert files at runtime
  → Reading host files (logs, sockets, /etc/localtime)
  → You need to see changes on the host immediately

Use a named volume when:
  → Database data (Postgres, MySQL, MongoDB)
  → Any data that must survive host OS reinstall or machine migration
  → Production deployments and Docker Swarm services
  → You want Docker to manage cleanup
```

---

## 7. Bind Mount Gotchas

```bash
# Gotcha 1: Relative paths do not work with -v (use $(pwd))
docker run -v ./src:/app myapp     # ERROR: invalid syntax
docker run -v $(pwd)/src:/app myapp  # correct

# Gotcha 2: Mounting a file that doesn't exist creates a directory
# If /tmp/nginx.conf does not exist on host:
docker run -v /tmp/nginx.conf:/etc/nginx/nginx.conf nginx
# Docker creates /tmp/nginx.conf/ as a DIRECTORY — nginx fails to start

# Gotcha 3: Host permissions bleed into container
# If host dir is owned by uid 1000 but container runs as uid 999:
# container cannot write to the mount — explicit uid mapping required
docker run --user 1000:1000 -v $(pwd)/data:/data myapp

# Gotcha 4: SELinux label (Linux with SELinux enabled)
# Without :z or :Z, SELinux blocks access to the bind-mounted files
docker run -v $(pwd)/html:/usr/share/nginx/html:z nginx  # shared label
docker run -v $(pwd)/html:/usr/share/nginx/html:Z nginx  # private label

# Gotcha 5: macOS performance (large node_modules on bind mount)
# Use anonymous volume trick for dependency dirs (see section 4)
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a directory `~/docker-dev/html` with a custom `index.html`. Run an nginx container mounting that directory read-only at `/usr/share/nginx/html`. Open the page in your browser. Edit `index.html` on the host and refresh — confirm the change appears without restarting the container.

**Exercise 2:** Run a Node.js container with `$(pwd)/src` mounted at `/app/src` and nodemon installed. Create `src/server.js` on the host. Add a console.log and save — watch the container logs to confirm nodemon restarts automatically.

**Exercise 3:** Mount a single config file into a running nginx container using the `--mount type=bind` syntax. Verify with `docker inspect <container> --format '{{json .Mounts}}'` that the mount type is `bind` and the source path is correct.

**Exercise 4:** Demonstrate the node_modules anonymous volume trick: mount `$(pwd)` and add `-v /app/node_modules`. Run `npm install` inside the container. Verify `ls node_modules` works inside but is empty on the host, confirming the anonymous volume is hiding the host path.

**Exercise 5:** Mount a directory with SELinux labels (on a Linux host with SELinux enabled) using `:z` and `:Z` options. Compare `ls -Z` output on the host directory before and after to see the label change. On macOS, instead test the `consistency=cached` option and measure startup time difference for a large directory.

---

## 9. Interview Q&A

**Q: What is the difference between a bind mount and a named volume?**
Answer: A bind mount maps a specific host path into a container — the host controls the location and the data can be seen and modified directly on the host filesystem. A named volume is managed by Docker: Docker decides the storage location (`/var/lib/docker/volumes/`), and you reference it by name. Named volumes are more portable, easier to back up through Docker tooling, and the recommended choice for production data. Bind mounts are preferred for development workflows and config injection.

**Q: How do you mount a single file (rather than a directory) as a bind mount?**
Answer: Use the same `-v` or `--mount` syntax but point to the file path: `docker run -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx`. The file must exist on the host before running the container — if it does not exist, Docker creates a directory at that path instead, which will cause the container to fail. Always verify the source path exists when mounting individual files.

**Q: Why is a read-only bind mount preferred for config files in production?**
Answer: A read-only mount (`ro` / `readonly`) ensures that even if the container is compromised or has a bug, it cannot modify the host configuration files. It also makes the intent explicit — config files are inputs, not outputs. Combined with `--read-only` on the container root filesystem, read-only bind mounts form part of a defense-in-depth strategy that limits what an attacker can change if they gain code execution inside the container.

**Q: What is the node_modules anonymous volume trick and why is it needed?**
Answer: When you bind-mount your entire project directory into a Node.js container (`-v $(pwd):/app`), the host's `node_modules` (which may be absent or built for the host OS) overwrites the container's `node_modules` (built for Linux inside the image). The trick is to add a second mount with no source (`-v /app/node_modules`), which creates an anonymous volume at that path. Docker mounts it on top of the bind mount, so the container uses its own Linux-built `node_modules` while all other source files are still live-synced from the host.

**Q: Can bind mounts be used in Docker Swarm?**
Answer: Technically yes, but it is risky. Docker Swarm can schedule a service replica on any node in the cluster. If you use a bind mount pointing to a local host path, the container works only on the specific node where that path exists — if the service is rescheduled to another node, it will fail or start with an empty directory. For Swarm, use named volumes backed by a distributed volume driver (NFS, AWS EFS, etc.) so the data is accessible from every node.
