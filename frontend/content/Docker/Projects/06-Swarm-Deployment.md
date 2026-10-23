# Project 6 — Docker Swarm Deployment with Rolling Updates

**Level:** Advanced
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 4 – Orchestration

---

## Overview

You will initialise a **three-node Docker Swarm**, deploy a replicated application stack, and perform a **rolling update** — replacing replicas one at a time while the service continues to serve traffic. At the end you will confirm zero-downtime by watching the scheduler work through the update in real time.

This project uses Docker's built-in orchestrator. No Kubernetes installation is required.

---

## Prerequisites

- Three machines (or VMs) that can reach each other over the network. Acceptable options:
  - Three VMs in VirtualBox / VMware / Multipass
  - Three EC2 / DigitalOcean instances
  - Docker Desktop's `docker-machine` (deprecated but functional for learning)
- Docker Engine installed on all three nodes
- Port 2377 (Swarm management), 7946 (node communication), and 4789 (overlay network) open between nodes
- An image on Docker Hub (use the one you built in Project 5, or `nginx:alpine` for simplicity)

---

## Project Structure

```
06-swarm-deployment/
├── docker-stack.yml        ← Compose-format stack file used with docker stack deploy
└── update.sh               ← helper script to trigger a rolling update
```

---

## Step-by-Step Instructions

### Step 1 — Initialise the Swarm on the manager node

SSH into the machine that will be your **manager** and run:

```bash
# Replace 192.168.1.10 with the manager's actual IP address
docker swarm init --advertise-addr 192.168.1.10
```

Docker prints a join token. Save it — it looks like this:

```
docker swarm join --token SWMTKN-1-<long-token> 192.168.1.10:2377
```

### Step 2 — Join the two worker nodes

SSH into **worker-1** and **worker-2** separately and paste the join command from Step 1:

```bash
docker swarm join --token SWMTKN-1-<long-token> 192.168.1.10:2377
```

Expected output on each worker:

```
This node joined a swarm as a worker.
```

### Step 3 — Verify cluster membership

Back on the **manager**:

```bash
docker node ls
```

Expected output:

```
ID                            HOSTNAME   STATUS    AVAILABILITY   MANAGER STATUS
abc123 *                      manager    Ready     Active         Leader
def456                        worker-1   Ready     Active
ghi789                        worker-2   Ready     Active
```

The `*` marks the node you are currently logged into. All three should show `Ready` / `Active`.

### Step 4 — Create `docker-stack.yml`

```yaml
version: "3.9"

services:

  # ── Web service — 3 replicas, rolling update config ───────────────────────
  web:
    image: nginx:1.25-alpine          # change this to your own image later
    ports:
      - target:    80
        published: 80
        protocol:  tcp
        mode:      ingress            # Swarm's routing mesh — any node accepts traffic
    deploy:
      replicas: 3
      update_config:
        parallelism:    1             # replace 1 replica at a time
        delay:          10s           # wait 10 seconds between each replacement
        order:          start-first   # start the new task before stopping the old one
        failure_action: rollback      # automatically roll back if the new task fails
      rollback_config:
        parallelism:    1
        delay:          5s
      restart_policy:
        condition:   on-failure
        delay:       5s
        max_attempts: 3
      resources:
        limits:
          cpus:   "0.50"
          memory: 128M
    healthcheck:
      test:     ["CMD-SHELL", "wget -qO- http://localhost/ || exit 1"]
      interval: 10s
      timeout:  5s
      retries:  3

  # ── Visualiser — see the Swarm state in a browser ─────────────────────────
  visualizer:
    image: dockersamples/visualizer:stable
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      placement:
        constraints: [node.role == manager]   # only run on the manager

networks:
  default:
    driver: overlay
```

### Step 5 — Deploy the stack

Run this on the **manager node**:

```bash
docker stack deploy -c docker-stack.yml myapp
```

Monitor task placement:

```bash
watch docker stack ps myapp
```

Wait until all three `web` tasks show `Running`. The Swarm scheduler distributes replicas across the three nodes automatically.

### Step 6 — Confirm the service is reachable

From any machine (including your laptop, if ports are open):

```bash
# Hit the manager's IP — the routing mesh forwards to any healthy replica
curl http://192.168.1.10/

# Or loop 10 times to confirm all replicas respond
for i in $(seq 1 10); do curl -s -o /dev/null -w "Request $i: %{http_code}\n" http://192.168.1.10/; done
```

Open [http://192.168.1.10:8080](http://192.168.1.10:8080) for the Visualiser — you will see each replica on its node.

### Step 7 — Perform a rolling update

Create `update.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

STACK="myapp"
SERVICE="${STACK}_web"
NEW_IMAGE="nginx:1.27-alpine"   # upgrade from 1.25 to 1.27

echo "==> Updating $SERVICE to $NEW_IMAGE"
docker service update \
  --image "$NEW_IMAGE" \
  --update-parallelism 1 \
  --update-delay 10s \
  --update-order start-first \
  "$SERVICE"

echo "==> Update complete. Current tasks:"
docker service ps "$SERVICE"
```

```bash
chmod +x update.sh
./update.sh
```

In a **second terminal**, watch the scheduler work through the replicas:

```bash
watch -n 2 "docker service ps myapp_web --format 'table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Node}}'"
```

You will see tasks move through `Preparing → Starting → Running` one at a time. At no point should all replicas be unavailable simultaneously.

### Step 8 — Simulate a failed update and automatic rollback

Deploy a deliberately broken image to observe the `failure_action: rollback` policy:

```bash
docker service update \
  --image nginx:broken-image-does-not-exist \
  myapp_web
```

Watch the logs — after the first task fails to start, Swarm will automatically roll back to the previous image.

### Step 9 — Scale the service

```bash
# Scale up to 5 replicas
docker service scale myapp_web=5

# Scale back down
docker service scale myapp_web=3
```

### Step 10 — Tear down

```bash
docker stack rm myapp

# Remove nodes from the Swarm (run on each worker first)
# On worker-1 and worker-2:
docker swarm leave

# On the manager (last):
docker swarm leave --force
```

---

## How to Verify Zero-Downtime

Run a continuous load test in one terminal while the rolling update proceeds in another:

```bash
# Terminal 1: continuous HTTP probe (requires Apache Bench or wrk)
ab -n 10000 -c 10 http://192.168.1.10/

# Terminal 2: trigger the rolling update
./update.sh
```

After `ab` finishes, check its output. The `Failed requests` count should remain **0** throughout the update, confirming zero-downtime delivery.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Three nodes active | `docker node ls` | All three `Ready / Active` |
| Three replicas running | `docker service ps myapp_web` | Three tasks `Running` |
| Routing mesh works | `curl http://<any-node-ip>/` | Nginx 200 response |
| Rolling update completes | `docker service ps myapp_web` | All tasks on new image |
| Failed update rolls back | Attempt bad image update | Previous image restored automatically |

---

## Stretch Goals

1. **Promote a worker to manager** — run `docker node promote worker-1` and verify you now have two managers for fault tolerance.
2. **Overlay network with encryption** — add `options: encrypted: true` to the overlay network definition and verify inter-service traffic is TLS-encrypted.
3. **Docker Secrets** — store a database password as a Swarm secret (`docker secret create`) and mount it into a service at `/run/secrets/db_password`.
4. **Config objects** — use `docker config create` to manage the Nginx config file without rebuilding the image.
5. **Drain a node** — run `docker node update --availability drain worker-1` during load and watch Swarm evacuate and reschedule its tasks onto the remaining nodes automatically.
