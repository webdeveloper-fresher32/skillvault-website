# Docker: The Definitive Guide for AWS Engineers

## Table of Contents

1. [Why Containers](#1-why-containers)
2. [Docker Architecture](#2-docker-architecture)
3. [Docker Images](#3-docker-images)
4. [Dockerfile Deep Dive](#4-dockerfile-deep-dive)
5. [Docker Commands Reference](#5-docker-commands-reference)
6. [Docker Volumes](#6-docker-volumes)
7. [Docker Networking](#7-docker-networking)
8. [Docker Compose](#8-docker-compose)
9. [Docker Registry](#9-docker-registry)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Containers

### The "It Works On My Machine" Problem

You build an application on your MacBook. It works perfectly. You push it to a Linux server
in production. It crashes. Why?

- Your Mac has Python 3.11, the server has Python 3.8
- Your Mac has a library at version 2.1, the server has version 1.9
- Your Mac has certain environment variables set, the server does not
- Your Mac has a specific file at a certain path, the server does not

This is the classic dependency and environment mismatch problem. Containers solve it by
packaging the application together with everything it needs to run.

### Virtual Machines vs Containers

```
VIRTUAL MACHINES                        CONTAINERS
+---------------------------+           +---------------------------+
|  App A   |  App B         |           |  App A   |  App B         |
+----------+---------+      |           +----------+---------+      |
| Libs/Deps| Libs/Deps      |           | Libs/Deps| Libs/Deps      |
+----------+---------+      |           +---------------------------+
| Guest OS | Guest OS       |           |    Container Runtime      |
+----------+---------+      |           +---------------------------+
|      Hypervisor           |           |       Host OS             |
+---------------------------+           +---------------------------+
|         Hardware          |           |         Hardware          |
+---------------------------+           +---------------------------+

Size: Gigabytes per VM                  Size: Megabytes per container
Boot: Minutes                           Boot: Milliseconds
Isolation: Full OS isolation            Isolation: Process isolation (namespaces)
Overhead: High                          Overhead: Low
```

### Key Differences

| Aspect | Virtual Machine | Container |
|--------|----------------|-----------|
| OS | Each VM has its own OS | Share the host OS kernel |
| Size | GBs | MBs |
| Startup | 1-2 minutes | Milliseconds |
| Isolation | Strong (full OS) | Moderate (namespaces + cgroups) |
| Overhead | High | Low |
| Use case | Full OS isolation needed | App packaging and portability |
| Patching | Each OS must be patched | Just patch the host OS |

### Benefits of Containers

**1. Consistency Across Environments**
The container that runs on your laptop is byte-for-byte identical to what runs in production.
The OS libraries, runtime, dependencies — all bundled together.

**2. Portability**
Build once, run anywhere Docker is installed. On-premises, AWS, Azure, GCP, developer laptop.

**3. Efficiency**
Containers share the host OS kernel. You can run dozens of containers on a machine that
might only support a handful of VMs. Startup time is measured in milliseconds.

**4. Isolation**
Each container has its own filesystem, network interfaces, and process space. A crash in
one container does not bring down another.

**5. Scalability**
Because containers start in milliseconds, you can spin up new instances quickly in response
to load. ECS and EKS are built around this capability.

**6. Microservices Enablement**
Each microservice runs in its own container. Services are independently deployable, scalable,
and can use different languages and runtimes.

---

## 2. Docker Architecture

```
+------------------+      REST API       +---------------------------+
|   Docker Client  |  ----------------> |      Docker Daemon        |
|  (docker CLI)    |                    |  (dockerd)                |
+------------------+                    |                           |
                                        |  +---------+ +---------+  |
                                        |  |Container| |Container|  |
                                        |  +---------+ +---------+  |
                                        |  +---------+ +---------+  |
                                        |  | Image   | | Image   |  |
                                        |  +---------+ +---------+  |
                                        +---------------------------+
                                                    |
                                                    | push/pull
                                                    v
                                        +---------------------------+
                                        |      Docker Registry      |
                                        |  (Docker Hub / ECR / etc) |
                                        +---------------------------+
```

### Docker Daemon (dockerd)

The Docker Daemon is the background service running on your host machine. It:
- Manages Docker objects: images, containers, networks, volumes
- Listens for Docker API requests
- Can communicate with other daemons to manage Docker Swarm services

You never interact with the daemon directly. You use the Docker client.

### Docker Client

The `docker` CLI tool you type commands into. Every `docker` command is translated into an
API call sent to the Docker Daemon. The client can connect to a daemon on the same host
or a remote host.

### Docker Registry

A storage and distribution system for Docker images. When you run `docker pull nginx`,
Docker downloads the nginx image from Docker Hub (the default public registry).

**Docker Hub** — Public registry at hub.docker.com. Free for public images.
**Amazon ECR** — AWS-managed private registry. Integrates with IAM for access control.
**GitHub Container Registry** — ghcr.io
**Self-hosted** — Run your own registry with the `registry` Docker image.

### Images vs Containers

```
Image (blueprint/template)          Container (running instance)
+------------------------+          +------------------------+
| Read-only layers       |  run --> | Writable layer (top)   |
|   Layer 3: App code    |          +------------------------+
|   Layer 2: npm install |          | Read-only layers below |
|   Layer 1: Ubuntu base |          | (shared from image)    |
+------------------------+          +------------------------+

Multiple containers can share the same image layers.
Each container gets its own writable layer on top.
```

Think of an image like a class in object-oriented programming.
A container is an instance (object) of that class.
You can create many containers from one image.

---

## 3. Docker Images

### What is an Image

A Docker image is a read-only, layered filesystem snapshot. It contains:
- The base operating system files (from the FROM instruction)
- Application dependencies and libraries
- Your application code
- Configuration and metadata (CMD, ENV, EXPOSE etc.)

Images are immutable. When you change something, you create a new image layer on top.

### Image Layers and Caching

```
docker build output:

Step 1/5 : FROM node:18-alpine           <-- Layer 1 (pulled from registry or cache)
Step 2/5 : WORKDIR /app                  <-- Layer 2
Step 3/5 : COPY package*.json ./         <-- Layer 3
Step 4/5 : RUN npm install               <-- Layer 4 (most expensive, cached if no change)
Step 5/5 : COPY . .                      <-- Layer 5

Each instruction creates a new layer.
Docker caches each layer based on the instruction and previous layers.
If nothing changed up to Step 3, Steps 1-3 are served from cache.
```

### Layer Caching Strategy

**Always copy package.json BEFORE copying application code.**
```dockerfile
# GOOD: npm install layer is cached until package.json changes
COPY package*.json ./
RUN npm install
COPY . .

# BAD: any code change invalidates npm install cache
COPY . .
RUN npm install
```

### Base Image Choices

| Base Image | Size | Use Case |
|------------|------|----------|
| ubuntu:22.04 | 77MB | General purpose, familiar |
| debian:bookworm-slim | 74MB | Smaller Debian |
| alpine:3.18 | 7MB | Minimal, production |
| node:18-alpine | 127MB | Node.js apps |
| python:3.11-slim | 130MB | Python apps |
| scratch | 0 | Go binaries, extreme minimalism |
| distroless | ~20MB | Security-focused, no shell |

---

## 4. Dockerfile Deep Dive

### Every Instruction Explained

#### FROM
```dockerfile
FROM node:18-alpine
FROM ubuntu:22.04
FROM python:3.11-slim AS builder    # Named stage for multi-stage builds
FROM scratch                         # Empty image
```
Must be the first instruction. Specifies the base image.
`AS builder` gives this stage a name for multi-stage builds.

#### RUN
```dockerfile
RUN apt-get update && apt-get install -y curl git
RUN npm install
RUN ["npm", "install"]    # Exec form (preferred for signals)
```
Executes a command during image build. Creates a new layer.
Combine multiple apt installs with `&&` to reduce layers.
Always clean up in the same RUN command:
```dockerfile
RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
```

#### COPY
```dockerfile
COPY package.json .
COPY src/ /app/src/
COPY --from=builder /app/dist /app/dist    # Copy from another stage
COPY --chown=node:node . .                  # Set file ownership
```
Copies files from build context into the image. Prefer COPY over ADD.

#### ADD
```dockerfile
ADD https://example.com/file.tar.gz /app/
ADD archive.tar.gz /app/    # Auto-extracts tar files
```
Like COPY but also supports URLs and auto-extracts tar archives.
Only use ADD when you specifically need URL fetching or tar extraction.
For everything else, use COPY.

#### WORKDIR
```dockerfile
WORKDIR /app
WORKDIR /app/src
```
Sets the working directory for subsequent RUN, CMD, ENTRYPOINT, COPY, ADD instructions.
If the directory does not exist, it is created. Prefer WORKDIR over `RUN cd /app`.

#### EXPOSE
```dockerfile
EXPOSE 3000
EXPOSE 80 443
EXPOSE 5432/tcp
```
Documents which port the container listens on. It is documentation only — it does NOT
actually publish the port. You still need `-p` in `docker run` or `ports` in Compose.

#### ENV
```dockerfile
ENV NODE_ENV=production
ENV PORT=3000 HOST=0.0.0.0
ENV DATABASE_URL="postgres://localhost:5432/mydb"
```
Sets environment variables that persist into the running container.
These are baked into the image. For secrets, use runtime environment variables instead.

#### ARG
```dockerfile
ARG VERSION=1.0
ARG BUILD_DATE
ARG REGISTRY=myregistry.example.com
```
Build-time variables. Unlike ENV, ARG values are not available in the running container.
Pass them at build time: `docker build --build-arg VERSION=2.0 .`

```dockerfile
# Common pattern: use ARG then set ENV from it
ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV:-production}
```

#### CMD
```dockerfile
CMD ["node", "server.js"]              # Exec form (preferred)
CMD ["npm", "start"]
CMD node server.js                     # Shell form (avoid — wraps in /bin/sh -c)
```
The default command to run when a container starts. Can be overridden at `docker run`.
There should be only one CMD per Dockerfile. The last one wins.

#### ENTRYPOINT
```dockerfile
ENTRYPOINT ["node", "server.js"]       # Exec form
ENTRYPOINT ["/entrypoint.sh"]
```
Like CMD, but it cannot be easily overridden. The container always runs this executable.
Arguments passed to `docker run` are appended to the ENTRYPOINT.

#### CMD vs ENTRYPOINT

```
                  docker run myapp            docker run myapp --port 8080
ENTRYPOINT only:  runs node server.js         runs node server.js --port 8080
CMD only:         runs node server.js         runs --port 8080 (replaces CMD!)
ENTRYPOINT+CMD:   runs node server.js         runs node server.js --port 8080
                  (CMD provides defaults)
```

**The golden rule:**
- Use ENTRYPOINT when the container has one specific purpose (e.g., run your app)
- Use CMD to provide default arguments that users might want to override
- Use both together: ENTRYPOINT = the command, CMD = the default args

```dockerfile
# Common pattern for flexible containers
ENTRYPOINT ["node"]
CMD ["server.js"]
# docker run myapp           -> node server.js
# docker run myapp debug.js  -> node debug.js
```

#### VOLUME
```dockerfile
VOLUME /data
VOLUME ["/var/log", "/var/db"]
```
Creates a mount point. Data written to this path is stored outside the container's
writable layer. Survives container deletion. Prefer explicit volume mounts at runtime.

#### USER
```dockerfile
USER node
USER 1001
USER node:node
```
Sets the user for subsequent RUN, CMD, ENTRYPOINT instructions. Never run as root
in production containers. Create a non-root user and switch to it.

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

### CMD vs ENTRYPOINT: Complete Comparison Table

| Scenario | Result |
|----------|--------|
| Only CMD defined | docker run can override CMD completely |
| Only ENTRYPOINT defined | ENTRYPOINT always runs, docker run args are appended |
| Both defined | ENTRYPOINT runs with CMD as default args; docker run replaces CMD |
| Shell form CMD | Runs as /bin/sh -c "..." — PID 1 is sh, not your app |
| Exec form CMD | Runs directly — PID 1 is your app (correct) |

### Multi-Stage Builds

Multi-stage builds produce smaller final images by separating build-time and runtime dependencies.

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production (only the built output, no node_modules for build)
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

Without multi-stage:  image might be 900MB (includes all devDependencies)
With multi-stage:     image might be 150MB (only production dependencies)

### .dockerignore File

Like .gitignore but for Docker build context. Prevents unnecessary files from being
sent to the Docker daemon on every build.

```
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
Dockerfile
docker-compose.yml
*.md
coverage
.nyc_output
dist
build
.DS_Store
```

Without .dockerignore: entire node_modules might be sent as context (hundreds of MB)
With .dockerignore: only the files your app needs are sent

### Example Dockerfile: Node.js Express App

```dockerfile
# Stage 1 — dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2 — builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3 — production
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Set permissions
RUN chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### Example Dockerfile: Python Flask App

```dockerfile
FROM python:3.11-slim AS base

# Prevents Python from writing .pyc files and enables unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### Example Dockerfile: React App with Nginx

```dockerfile
# Stage 1 — Build the React app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — Serve with Nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle React Router (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 5. Docker Commands Reference

### Building Images

```bash
# Basic build — tag as myapp:latest
docker build -t myapp .

# Tag with version
docker build -t myapp:1.0 .

# Tag with full registry path
docker build -t 123456789.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0 .

# Build specific stage
docker build --target builder -t myapp:builder .

# Build with build args
docker build --build-arg NODE_ENV=production -t myapp:prod .

# Build without cache
docker build --no-cache -t myapp:fresh .

# Build from a different directory (context)
docker build -f ./docker/Dockerfile -t myapp .

# Show build output verbosely
docker build --progress=plain -t myapp .
```

### Running Containers

```bash
# Run in background (detached), map port 3000 on host to 3000 in container, name it
docker run -d -p 3000:3000 --name myapp myapp:1.0

# Run interactively (get a shell)
docker run -it ubuntu:22.04 bash

# Run and auto-remove when stopped
docker run --rm myapp:1.0

# Run with environment variable
docker run -d -e DATABASE_URL=postgres://localhost/mydb myapp:1.0

# Run with env file
docker run -d --env-file .env myapp:1.0

# Run with volume mount
docker run -d -v mydata:/app/data myapp:1.0

# Run with bind mount (maps host directory)
docker run -d -v $(pwd)/src:/app/src myapp:1.0

# Run with memory and CPU limits
docker run -d --memory=512m --cpus=0.5 myapp:1.0

# Run with network
docker run -d --network mynetwork myapp:1.0

# Run on specific platform (cross-architecture)
docker run --platform linux/amd64 myapp:1.0
```

### Managing Containers

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# List only container IDs
docker ps -q

# View logs
docker logs myapp

# Follow logs in real time
docker logs -f myapp

# Last 100 lines of logs
docker logs --tail 100 myapp

# Logs with timestamps
docker logs -t myapp

# Execute command in running container
docker exec -it myapp bash
docker exec -it myapp sh          # If bash not available (alpine)
docker exec myapp ls /app

# Copy files from/to container
docker cp myapp:/app/logs/app.log ./app.log
docker cp ./config.json myapp:/app/config.json

# Inspect container details (IP, mounts, env vars, etc.)
docker inspect myapp

# View resource usage stats
docker stats
docker stats myapp

# Stop container (sends SIGTERM, waits 10 seconds, then SIGKILL)
docker stop myapp

# Immediately kill
docker kill myapp

# Start a stopped container
docker start myapp

# Restart
docker restart myapp

# Remove a stopped container
docker rm myapp

# Force remove a running container
docker rm -f myapp

# Remove all stopped containers
docker container prune
```

### Managing Images

```bash
# List images
docker images
docker image ls

# Pull an image
docker pull nginx:latest
docker pull python:3.11-slim

# Push an image
docker push myregistry/myapp:1.0

# Tag an image (create alias)
docker tag myapp:1.0 myregistry/myapp:1.0
docker tag myapp:1.0 myapp:latest

# Remove an image
docker rmi myapp:1.0

# Remove all unused images
docker image prune

# Remove all images (careful!)
docker image prune -a

# View image history (layers)
docker history myapp:1.0

# Inspect image metadata
docker inspect myapp:1.0

# Save image to tar file
docker save myapp:1.0 > myapp.tar
docker save myapp:1.0 | gzip > myapp.tar.gz

# Load image from tar file
docker load < myapp.tar
```

### Docker System Commands

```bash
# Show disk usage by Docker
docker system df

# Remove everything unused (containers, images, networks, volumes)
docker system prune

# Remove everything including volumes
docker system prune -a --volumes

# Show Docker info
docker info

# Docker version
docker version
```

### Complete Command Reference Table

| Command | What it Does |
|---------|-------------|
| `docker build -t name:tag .` | Build image from Dockerfile in current directory |
| `docker run -d -p host:container name` | Run container in background with port mapping |
| `docker run -it name bash` | Run container interactively with bash shell |
| `docker ps` | List running containers |
| `docker ps -a` | List all containers including stopped |
| `docker logs -f name` | Follow container logs in real time |
| `docker exec -it name bash` | Open shell in running container |
| `docker stop name` | Gracefully stop container |
| `docker rm name` | Remove stopped container |
| `docker images` | List local images |
| `docker pull name:tag` | Download image from registry |
| `docker push name:tag` | Upload image to registry |
| `docker tag source:tag target:tag` | Create an image alias |
| `docker rmi name:tag` | Remove image |
| `docker inspect name` | Detailed JSON info about container/image |
| `docker stats` | Live resource usage statistics |
| `docker system prune` | Remove all unused Docker resources |
| `docker volume ls` | List volumes |
| `docker network ls` | List networks |

---

## 6. Docker Volumes

Containers are ephemeral. When a container is removed, its writable layer (all data written
at runtime) is gone. Volumes solve this by storing data outside the container's lifecycle.

### Types of Storage

```
+--------------------------------------------------+
|                   Container                       |
|  +--------------------------------------------+  |
|  | Application Code (from image)              |  |
|  | Read-Only Layers                           |  |
|  +--------------------------------------------+  |
|  | Writable Layer (dies with container)       |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
         |                    |
         v                    v
  Named Volume           Bind Mount
  /var/lib/docker/       /host/path
  volumes/mydata         directly mapped
  (managed by Docker)    (you control path)
```

### Named Volumes

Docker manages where the data is stored. Best for persistent application data.

```bash
# Create a volume
docker volume create mydata

# List volumes
docker volume ls

# Inspect a volume (find where it is on the host)
docker volume inspect mydata

# Use volume when running container
docker run -d -v mydata:/app/data myapp:1.0

# Remove a volume (data is deleted)
docker volume rm mydata

# Remove all unused volumes
docker volume prune
```

Named volume paths on the host:
- Linux: `/var/lib/docker/volumes/mydata/_data`
- Mac (inside the Docker VM): not directly accessible on the host filesystem

### Bind Mounts

Maps a specific path on the host into the container. Best for development (hot reload).

```bash
# Mount current directory into container
docker run -d -v $(pwd):/app myapp:1.0

# Mount with read-only flag
docker run -d -v $(pwd)/config:/app/config:ro myapp:1.0

# Modern --mount syntax (more explicit)
docker run -d \
  --mount type=bind,source=$(pwd)/src,target=/app/src \
  myapp:1.0
```

### Volume vs Bind Mount Comparison

| Feature | Named Volume | Bind Mount |
|---------|-------------|------------|
| Managed by | Docker | You |
| Path | Docker chooses | You specify |
| Portability | High | Low (host path must exist) |
| Use case | Databases, persistent data | Development, config files |
| Backup | `docker run --volumes-from` | Direct host filesystem |
| Performance on Mac/Win | Better | Slower (cross-OS) |

### tmpfs Mounts

Stored in host memory only. Fast. Not persisted.

```bash
docker run -d --tmpfs /app/tmp myapp:1.0
docker run -d --mount type=tmpfs,destination=/app/tmp myapp:1.0
```

Use for: temporary files, sensitive data that must not be written to disk.

---

## 7. Docker Networking

### Network Types

#### Bridge Network (Default)

When you run a container without specifying a network, it connects to the default `bridge` network.

```
+----------------------------------------------------------+
|                      Host Machine                         |
|                                                           |
|  +----------+   +----------+   +----------+              |
|  |Container1|   |Container2|   |Container3|              |
|  | 172.17.0.2|   |172.17.0.3|   |172.17.0.4|              |
|  +----+-----+   +----+-----+   +----+-----+              |
|       |               |               |                   |
|  +----+---------------+---------------+----+              |
|  |         docker0 bridge (172.17.0.1)     |              |
|  +-----------------------------------------+              |
|                        |                                  |
|                  iptables NAT                             |
|                        |                                  |
+------------------------+---------------------------------+
                         |
                    Internet / Host Network
```

Containers on the default bridge can communicate by IP, but NOT by container name.
Use custom bridge networks to get DNS resolution by container name.

#### Custom Bridge Network (Recommended)

```bash
# Create custom network
docker network create mynetwork

# Run containers on the custom network
docker run -d --name db --network mynetwork postgres:15
docker run -d --name app --network mynetwork -e DB_HOST=db myapp:1.0

# Now "app" container can reach "db" container by name: ping db, psql -h db
```

On custom networks, Docker provides automatic DNS resolution.
Container names become hostnames.

#### Host Network

```bash
docker run -d --network host nginx
```

The container shares the host's network stack. No NAT, no port mapping needed.
The container uses the host's IP directly.

Use cases: High-performance networking, when you need to listen on specific host ports.
Not available on Docker Desktop (Mac/Windows) in the traditional sense.

#### None Network

```bash
docker run -d --network none myapp:1.0
```

Container has no network access. Complete isolation.
Use for security-sensitive batch processing jobs.

### Container Communication

```bash
# Containers on the same custom network can communicate by name
# App container can connect to DB container:
# Host:     db
# Port:     5432
# No port publishing needed between containers

# To publish port to HOST machine
docker run -d -p 5432:5432 postgres:15    # Accessible from host
docker run -d postgres:15                  # Accessible only from other containers
```

### Port Publishing Format

```
-p hostPort:containerPort
-p 127.0.0.1:8080:80      # Bind to specific host interface
-p 8080:80/tcp             # Specify protocol
-P                          # Publish all EXPOSED ports to random host ports
```

### Network Commands

```bash
docker network ls                          # List networks
docker network create mynetwork            # Create bridge network
docker network inspect mynetwork           # Details about network
docker network connect mynetwork myapp     # Connect container to network
docker network disconnect mynetwork myapp  # Disconnect container
docker network rm mynetwork                # Remove network
docker network prune                       # Remove unused networks
```

---

## 8. Docker Compose

Docker Compose lets you define and run multi-container applications in a single YAML file.
Instead of running multiple `docker run` commands, you write a `docker-compose.yml`.

### docker-compose.yml Structure

```yaml
version: '3.9'

# Named volumes
volumes:
  postgres_data:
  redis_data:

# Custom networks
networks:
  backend:
  frontend:

services:

  # ---- Database ----
  db:
    image: postgres:15-alpine
    container_name: myapp_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ---- Redis Cache ----
  redis:
    image: redis:7-alpine
    container_name: myapp_redis
    restart: unless-stopped
    command: redis-server --requirepass redissecret
    volumes:
      - redis_data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ---- Application ----
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
      args:
        - NODE_ENV=production
    container_name: myapp
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://appuser:secret@db:5432/myapp
      REDIS_URL: redis://:redissecret@redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - backend
      - frontend
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ---- Nginx Reverse Proxy ----
  nginx:
    image: nginx:alpine
    container_name: myapp_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - app
    networks:
      - frontend
```

### Key Compose Fields

| Field | Purpose |
|-------|---------|
| `image` | Use a pre-built image |
| `build` | Build image from Dockerfile |
| `container_name` | Name for the container |
| `restart` | Restart policy (no, always, on-failure, unless-stopped) |
| `ports` | Publish ports (host:container) |
| `environment` | Environment variables |
| `env_file` | Load variables from a file |
| `volumes` | Mount volumes or bind mounts |
| `networks` | Which networks to join |
| `depends_on` | Start order (and optionally health conditions) |
| `healthcheck` | Container health check command |
| `command` | Override default CMD |
| `entrypoint` | Override ENTRYPOINT |
| `deploy` | Resources, replicas (for Swarm) |

### Docker Compose Commands

```bash
# Start all services in background
docker-compose up -d

# Start and rebuild images
docker-compose up -d --build

# Stop all services (keeps containers and volumes)
docker-compose stop

# Stop and remove containers and networks (keeps volumes)
docker-compose down

# Stop and remove containers, networks, AND volumes
docker-compose down -v

# View logs for all services
docker-compose logs

# Follow logs for specific service
docker-compose logs -f app

# List running services
docker-compose ps

# Execute command in running service
docker-compose exec app bash
docker-compose exec db psql -U appuser myapp

# Scale a service (run 3 app instances)
docker-compose up -d --scale app=3

# Pull latest images
docker-compose pull

# Run a one-off command
docker-compose run --rm app npm run migrate

# View resource usage
docker-compose top
```

### Multiple Compose Files (Overrides)

```bash
# docker-compose.yml         — base config
# docker-compose.override.yml — auto-applied override (usually dev)
# docker-compose.prod.yml    — production overrides

# Apply specific override
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

```yaml
# docker-compose.override.yml (development)
services:
  app:
    build:
      target: development      # Use dev stage of Dockerfile
    volumes:
      - .:/app                 # Bind mount source code for hot reload
    environment:
      NODE_ENV: development
    command: npm run dev       # Use nodemon or ts-node-dev
```

---

## 9. Docker Registry

### Docker Hub

The default public registry. Images referenced without a registry prefix pull from Docker Hub.

```bash
# These are equivalent
docker pull nginx
docker pull docker.io/library/nginx:latest

# Login to Docker Hub
docker login

# Push to Docker Hub (your username/imagename)
docker tag myapp:1.0 ganesh/myapp:1.0
docker push ganesh/myapp:1.0
```

### Private Registry Workflow

```bash
# 1. Login to registry
docker login myregistry.example.com

# 2. Tag image with registry prefix
docker tag myapp:1.0 myregistry.example.com/team/myapp:1.0

# 3. Push
docker push myregistry.example.com/team/myapp:1.0

# 4. Pull
docker pull myregistry.example.com/team/myapp:1.0
```

### AWS ECR Login

```bash
# Get login password and pipe to docker login
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-southeast-2.amazonaws.com

# Tag and push
docker tag myapp:1.0 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0
docker push 123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/myapp:1.0
```

---

## 10. Interview Q&A

**Q1: What is the difference between an image and a container?**

An image is a read-only template that contains the application code, runtime, libraries,
and configuration. It is built from a Dockerfile and stored in a registry. A container is
a running (or stopped) instance of an image. Multiple containers can be created from the
same image, and each gets its own writable layer on top of the shared read-only image layers.

**Q2: What is the difference between CMD and ENTRYPOINT?**

ENTRYPOINT defines the executable that always runs when the container starts and cannot
easily be overridden. CMD provides default arguments or a default command. When both are
defined, CMD serves as default arguments to ENTRYPOINT. Arguments passed to `docker run`
replace CMD but are appended to ENTRYPOINT. Use exec form (JSON array) for both to avoid
shell wrapping issues with signal handling.

**Q3: Why are multi-stage builds useful?**

Multi-stage builds allow you to use a larger build image (with all build tools, compilers,
devDependencies) and then copy only the compiled artifacts into a smaller final image.
This results in production images that are much smaller, have a smaller attack surface
(no build tools), and are faster to push/pull. A Node.js app might go from 900MB to 150MB.

**Q4: What is layer caching and how do you optimize it?**

Docker caches each image layer. If a layer's instruction and all previous layers are
unchanged, Docker reuses the cached layer. To maximize cache hits: copy package.json
before copying application code (so npm install is only re-run when dependencies change,
not on every code change). Put infrequently changing instructions early in the Dockerfile.

**Q5: What is the difference between a named volume and a bind mount?**

A named volume is managed by Docker — Docker decides where to store the data on the host.
It is portable, managed via Docker CLI, and the recommended way to persist application data
(like databases). A bind mount maps a specific host path directly into the container. It
is used in development for hot reloading (mount source code) but less portable because
the host path must exist. Bind mounts can be read-only with the `:ro` flag.

**Q6: How do containers communicate with each other?**

Containers on the same Docker network can communicate using their container names as
hostnames (DNS resolution). On the default bridge network, communication is by IP only.
On custom bridge networks, Docker provides automatic DNS. In Docker Compose, all services
are automatically on the same default network and can reach each other by service name.

**Q7: What is Docker Compose used for?**

Docker Compose is a tool for defining and running multi-container applications. You define
all services, networks, and volumes in a docker-compose.yml file. With `docker-compose up`,
you start the entire stack. It is the standard tool for local development environments
involving multiple services (app + database + cache + proxy).

**Q8: What is .dockerignore and why is it important?**

.dockerignore specifies files and directories to exclude from the Docker build context.
The build context is sent to the Docker daemon before the build starts. Without
.dockerignore, node_modules (potentially hundreds of MB) or .git would be sent on
every build. This slows builds and can cause unexpected behavior when files you do not
want to include get COPY'd in.

**Q9: How do you run containers securely?**

Do not run as root — create a non-root user and use USER in the Dockerfile. Use
read-only filesystems where possible (`--read-only`). Scan images for vulnerabilities
(ECR scanning, Snyk, Trivy). Use distroless or Alpine base images to reduce attack surface.
Do not bake secrets into images — use runtime environment variables or secrets managers.
Limit capabilities with `--cap-drop`. Use `--security-opt no-new-privileges`.

**Q10: What is the difference between COPY and ADD in Dockerfile?**

Both copy files into the image. COPY simply copies files from the build context.
ADD does everything COPY does but also supports fetching from URLs and automatically
extracting tar archives. The general guidance is to use COPY unless you specifically
need ADD's extra features, because COPY is more explicit and predictable.

**Q11: What happens to data when a container is deleted?**

Any data written to the container's writable layer (not in a volume) is permanently
deleted when the container is removed with `docker rm`. Only data in named volumes or
bind mounts persists after the container is removed. This is why databases in containers
must always use named volumes.

**Q12: How does Docker handle container networking on the same host?**

Docker creates a virtual bridge network interface (docker0) on the host. Each container
gets a virtual Ethernet interface (veth pair) connected to the bridge. Docker uses
iptables rules for NAT, port forwarding, and isolation between networks. Containers on
the same network can communicate. Containers on different networks cannot communicate
unless a container is connected to both networks.

**Q13: What is the HEALTHCHECK instruction?**

HEALTHCHECK defines a command Docker runs periodically to determine if the container is
healthy. It returns 0 (healthy) or 1 (unhealthy). You set the interval, timeout, start
period, and retries. Docker Compose can use `condition: service_healthy` in depends_on
to wait until a service is healthy before starting dependent services. ECS and Kubernetes
also honor health checks when deciding whether to route traffic to a container.

**Q14: What is the exec form vs shell form in Dockerfile?**

Exec form: `CMD ["node", "server.js"]` — runs the process directly, it becomes PID 1,
and properly receives Unix signals (SIGTERM for graceful shutdown). Shell form:
`CMD node server.js` — runs the process via /bin/sh -c "..." — your process is NOT PID 1,
signals are received by the shell and may not be passed to your process, causing issues
with graceful shutdown. Always prefer exec form.

**Q15: How do you reduce Docker image size?**

1. Use Alpine or slim base images instead of full Ubuntu/Debian
2. Use multi-stage builds to exclude build tools from final image
3. Combine RUN commands to reduce layers
4. Clean up package caches in the same RUN layer: `apt-get clean && rm -rf /var/lib/apt/lists/*`
5. Use .dockerignore to exclude unnecessary files
6. Remove test files, documentation, example code
7. Use `--no-cache-dir` with pip
8. Use `npm ci --only=production` to exclude devDependencies
