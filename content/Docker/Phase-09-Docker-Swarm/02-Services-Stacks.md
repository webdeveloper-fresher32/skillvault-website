# Docker Services and Stacks — Complete Guide

## Table of Contents

1. [Services vs Containers](#1-services-vs-containers)
2. [Creating Services](#2-creating-services)
3. [Replicas and Scaling](#3-replicas-and-scaling)
4. [Rolling Updates](#4-rolling-updates)
5. [Update Failure Policies and Rollback](#5-update-failure-policies-and-rollback)
6. [Docker Stacks](#6-docker-stacks)
7. [Stack Compose File Reference](#7-stack-compose-file-reference)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Services vs Containers

In Docker Swarm, the unit of deployment is a **service**, not a container.

| Concept     | Scope        | Managed by  | Rescheduled on failure |
|-------------|--------------|-------------|------------------------|
| Container   | Single host  | Docker Engine | No                   |
| Task        | Single host  | Swarm Manager | Yes (via service)    |
| Service     | Cluster-wide | Swarm Manager | Yes, automatically   |

A **service** defines the desired state (image, replicas, network, ports). The Swarm scheduler creates **tasks** (one per replica), and each task runs a **container** on a node. If a container crashes, the Swarm scheduler automatically creates a replacement task.

```
Service: web (replicas=3)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Task 1 ──► Container [web.1] on Worker-1            │
│  Task 2 ──► Container [web.2] on Worker-2            │
│  Task 3 ──► Container [web.3] on Worker-3            │
│                                                      │
│  Task 2 fails ──► Swarm creates Task 4 on Worker-1   │
│                   (desired state restored)           │
└──────────────────────────────────────────────────────┘
```

---

## 2. Creating Services

### Basic Service Creation

```bash
# Create a simple service with one replica
docker service create --name web nginx:latest

# Publish a port (host port 80 → container port 80)
docker service create \
  --name web \
  --publish published=80,target=80 \
  nginx:latest

# Create service with 3 replicas
docker service create \
  --name web \
  --replicas 3 \
  --publish published=80,target=80 \
  nginx:latest

# Attach to a specific overlay network
docker service create \
  --name web \
  --replicas 3 \
  --network my-overlay \
  --publish published=80,target=80 \
  nginx:latest

# Set environment variables and resource constraints
docker service create \
  --name api \
  --replicas 2 \
  --env APP_ENV=production \
  --limit-cpu 0.5 \
  --limit-memory 256m \
  --reserve-cpu 0.25 \
  --reserve-memory 128m \
  myapp:1.0
```

### Inspecting Services

```bash
# List all services
docker service ls

# Inspect a service (full JSON)
docker service inspect web

# Inspect with human-readable output
docker service inspect web --pretty

# List tasks for a service (shows which node each replica is on)
docker service ps web

# Show service logs
docker service logs web
docker service logs --follow web
docker service logs --tail 50 web
```

---

## 3. Replicas and Scaling

### Replica Modes

Docker Swarm supports two service modes:

**Replicated mode** (default) — run a specified number of replica tasks:
```bash
docker service create --name web --replicas 5 --mode replicated nginx
```

**Global mode** — run exactly one task on every node in the swarm:
```bash
docker service create --name monitor --mode global prom/node-exporter
```

### Scaling a Service

```bash
# Scale a single service
docker service scale web=10

# Scale multiple services at once
docker service scale web=5 api=3 worker=2

# Alternatively use update
docker service update --replicas 5 web
```

### Viewing Replica Distribution

```bash
docker service ps web
```

```
ID             NAME      IMAGE          NODE       DESIRED STATE   CURRENT STATE
abc1           web.1     nginx:latest   worker-1   Running         Running 2 min
abc2           web.2     nginx:latest   worker-2   Running         Running 2 min
abc3           web.3     nginx:latest   worker-3   Running         Running 2 min
abc4           web.4     nginx:latest   worker-1   Running         Running 2 min
abc5           web.5     nginx:latest   worker-2   Running         Running 2 min
```

---

## 4. Rolling Updates

Rolling updates replace tasks incrementally to avoid downtime. The key parameters are:

| Flag                        | Description                                          |
|-----------------------------|------------------------------------------------------|
| `--update-parallelism N`    | Number of tasks updated simultaneously               |
| `--update-delay`            | Time between each update batch (e.g. `10s`, `1m`)   |
| `--update-order`            | `stop-first` (default) or `start-first`              |
| `--update-failure-action`   | `pause` (default), `continue`, or `rollback`         |
| `--update-max-failure-ratio`| Ratio of tasks that can fail before triggering action|
| `--update-monitor`          | Duration to monitor each task after update           |

### Triggering a Rolling Update

```bash
# Update service image — uses stored update config
docker service update --image nginx:1.25 web

# Update with explicit rolling parameters
docker service update \
  --image nginx:1.25 \
  --update-parallelism 2 \
  --update-delay 15s \
  --update-order start-first \
  web
```

### Rolling Update Visualised

```
Initial state (5 replicas of nginx:1.24)
┌──────┬──────┬──────┬──────┬──────┐
│ 1.24 │ 1.24 │ 1.24 │ 1.24 │ 1.24 │
└──────┴──────┴──────┴──────┴──────┘

After batch 1 (parallelism=2, order=start-first)
┌──────┬──────┬──────┬──────┬──────┐
│ 1.25 │ 1.25 │ 1.24 │ 1.24 │ 1.24 │
└──────┴──────┴──────┴──────┴──────┘
                 ↑ 15s delay ↑

After batch 2
┌──────┬──────┬──────┬──────┬──────┐
│ 1.25 │ 1.25 │ 1.25 │ 1.25 │ 1.24 │
└──────┴──────┴──────┴──────┴──────┘
                         ↑ 15s delay ↑

After batch 3 — update complete
┌──────┬──────┬──────┬──────┬──────┐
│ 1.25 │ 1.25 │ 1.25 │ 1.25 │ 1.25 │
└──────┴──────┴──────┴──────┴──────┘
```

---

## 5. Update Failure Policies and Rollback

### Configuring Failure Behaviour

```bash
docker service update \
  --image myapp:2.0 \
  --update-parallelism 1 \
  --update-delay 10s \
  --update-failure-action rollback \
  --update-max-failure-ratio 0.2 \
  --update-monitor 30s \
  --rollback-parallelism 2 \
  --rollback-delay 5s \
  myapp
```

### Manual Rollback

```bash
# Rollback to the previous service version
docker service rollback web

# Check rollback status
docker service ps web
```

### Removing a Service

```bash
docker service rm web
```

---

## 6. Docker Stacks

A **stack** is a group of interrelated services defined in a Compose file and deployed to a Swarm as a single unit. Stacks are the Swarm equivalent of `docker compose up` for multi-container applications.

### Deploying a Stack

```bash
# Deploy or update a stack from a Compose file
docker stack deploy -c docker-compose.yml myapp

# Deploy with multiple compose files (later files override earlier ones)
docker stack deploy \
  -c docker-compose.yml \
  -c docker-compose.prod.yml \
  myapp

# List all stacks
docker stack ls

# List services in a stack
docker stack services myapp

# List all tasks across a stack
docker stack ps myapp

# Remove a stack (removes all services, networks defined in the stack)
docker stack rm myapp
```

---

## 7. Stack Compose File Reference

Stack Compose files use the same `docker-compose.yml` format with Swarm-specific `deploy` keys.

```yaml
version: "3.9"

services:
  web:
    image: nginx:1.25
    ports:
      - "80:80"
    networks:
      - frontend
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0.2
      rollback_config:
        parallelism: 2
        delay: 5s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      placement:
        constraints:
          - node.role == worker
          - node.labels.zone == us-east
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
        reservations:
          cpus: "0.25"
          memory: 128M

  api:
    image: myapi:2.1
    networks:
      - frontend
      - backend
    environment:
      - DATABASE_URL=postgres://db:5432/myapp
    secrets:
      - db_password
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 15s

  db:
    image: postgres:15
    networks:
      - backend
    volumes:
      - db-data:/var/lib/postgresql/data
    secrets:
      - db_password
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.disk == ssd

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true

volumes:
  db-data:

secrets:
  db_password:
    external: true
```

### Placement Constraints

```bash
# Add a label to a node before using constraints
docker node update --label-add zone=us-east worker-1
docker node update --label-add disk=ssd worker-2
```

---

## 8. Hands-On Exercises

**Exercise 1 — Deploy a replicated service**
```bash
docker service create \
  --name web \
  --replicas 3 \
  --publish published=8080,target=80 \
  nginx:1.24

docker service ls
docker service ps web
curl http://localhost:8080
```

**Exercise 2 — Scale and observe task distribution**
```bash
docker service scale web=6
docker service ps web
# Note how new tasks are distributed across nodes
docker service scale web=2
docker service ps web
# Note which tasks are stopped
```

**Exercise 3 — Perform a rolling update**
```bash
docker service update \
  --image nginx:1.25 \
  --update-parallelism 1 \
  --update-delay 10s \
  --update-order start-first \
  web

# Watch the rolling update in real time
watch docker service ps web
```

**Exercise 4 — Deploy and update a stack**
```bash
# Create a minimal compose file
cat > /tmp/mystack.yml << 'EOF'
version: "3.9"
services:
  web:
    image: nginx:1.24
    ports:
      - "8080:80"
    deploy:
      replicas: 2
EOF

docker stack deploy -c /tmp/mystack.yml demo
docker stack ls
docker stack services demo
docker stack ps demo

# Update the image via compose file change and redeploy
sed -i 's/nginx:1.24/nginx:1.25/' /tmp/mystack.yml
docker stack deploy -c /tmp/mystack.yml demo
docker stack ps demo
```

**Exercise 5 — Test self-healing**
```bash
docker service create --name heal-test --replicas 3 nginx:latest
docker service ps heal-test
# Find a container ID for one of the tasks
docker ps --filter "name=heal-test"
# Kill a container manually
docker rm -f <container-id>
# Within seconds Swarm should reschedule a replacement
watch docker service ps heal-test
```

---

## 9. Interview Q&A

**Q:** What is the difference between a Docker service and a Docker container?

Answer: A container is a single running process on a single host, managed directly by the Docker Engine. A service is a higher-level abstraction managed by Docker Swarm that describes desired state — how many replicas to run, which image to use, update strategies. Swarm translates a service into tasks, each of which runs a container. If a container dies, Swarm automatically creates a new task to restore the desired replica count.

---

**Q:** What is the difference between `update-order: stop-first` and `start-first`?

Answer: With `stop-first` (the default), Swarm stops the old task before starting the replacement. This temporarily reduces capacity by one replica during each update step — safer in terms of resource usage but causes brief under-capacity. With `start-first`, Swarm starts the new task and waits for it to be Running before stopping the old one. This keeps capacity constant (or momentarily increases it), enabling true zero-downtime deployments, but requires extra resources.

---

**Q:** How do rolling updates differ when deploying via `docker service update` versus redeploying a stack?

Answer: Both honour the `update_config` settings defined on the service. When you run `docker stack deploy` with an updated Compose file, Swarm detects which services have changed and applies a rolling update to only those services using their configured `update_config` parameters. The mechanism is the same; the difference is that stacks provide declarative multi-service management in a single file.

---

**Q:** What happens to stack-defined networks and volumes when you run `docker stack rm`?

Answer: All services defined in the stack are removed immediately. Overlay networks created by the stack are also removed once all tasks using them stop. However, named volumes are **not** removed by `docker stack rm` — this is intentional to prevent accidental data loss. Volumes must be removed separately with `docker volume rm`.

---

**Q:** How does Swarm ensure a global service runs on every node, including newly added nodes?

Answer: When a node joins the Swarm or its availability is set to Active, the Swarm scheduler detects that global-mode services do not yet have a task on that node. It automatically schedules and starts a task for every global service on the newly available node. This makes global mode ideal for cluster-wide agents such as log collectors or monitoring exporters.
