# Container Management — Complete Guide

## Table of Contents
1. [Overview of Management Commands](#1-overview-of-management-commands)
2. [start, stop, restart, and kill](#2-start-stop-restart-and-kill)
3. [Removing Containers](#3-removing-containers)
4. [Executing Commands with exec](#4-executing-commands-with-exec)
5. [Logs — Viewing Container Output](#5-logs--viewing-container-output)
6. [Inspecting Containers](#6-inspecting-containers)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Overview of Management Commands

Once a container is running, you manage it through a set of lifecycle and observability commands. These are the commands you use every day in development and production.

```
Container Management Commands
─────────────────────────────────────────────────────────────
Lifecycle:    start   stop   restart   kill   pause   unpause
Removal:      rm      prune
Interaction:  exec    attach   cp
Observability: logs   inspect  stats    top    diff
Listing:      ps
```

```
┌──────────────────────────────────────────────────────────────┐
│  Common workflow                                             │
│                                                              │
│  docker run -d   → container running in background          │
│  docker ps       → confirm it's running                     │
│  docker logs     → check application output                 │
│  docker exec     → open shell to debug                      │
│  docker inspect  → get full config and state metadata       │
│  docker stop     → graceful shutdown                        │
│  docker rm       → clean up                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. start, stop, restart, and kill

### docker start

```bash
# Start a previously created or stopped container
docker start webserver

# Start and attach (see output in terminal)
docker start -a webserver

# Start multiple containers at once
docker start web db cache
```

### docker stop

```bash
# Graceful stop: SIGTERM → wait 10s → SIGKILL
docker stop webserver

# Custom timeout before SIGKILL
docker stop --time 30 webserver

# Stop multiple containers
docker stop web db cache

# Stop all running containers
docker stop $(docker ps -q)
```

### docker restart

```bash
# Stop then start (same as stop + start, keeps the container object)
docker restart webserver

# Restart with a custom stop timeout
docker restart --time 5 webserver

# When to use restart vs rm + run:
#   restart → config unchanged, just need a fresh process start
#   rm + run → new flags, new image version, or changed env vars
```

### docker kill

```bash
# Immediate SIGKILL — no grace period
docker kill webserver

# Send a specific POSIX signal
docker kill --signal SIGHUP webserver   # reload config in nginx
docker kill --signal SIGUSR1 webserver  # custom app signal
docker kill --signal 9 webserver        # SIGKILL by number
```

### Signal Flow Comparison

```
docker stop:
  Container ──▶ SIGTERM ──▶ [grace period N seconds] ──▶ SIGKILL (if still up)
                   ↑
              app can catch this and clean up

docker kill:
  Container ──▶ SIGKILL ─────────────────────────────────────────▶ terminated
                   ↑
              kernel enforces — app cannot catch or ignore
```

---

## 3. Removing Containers

### docker rm

```bash
# Remove a stopped container
docker rm webserver

# Remove a running container (force)
docker rm -f webserver

# Remove multiple containers
docker rm web db cache

# Remove all stopped containers
docker rm $(docker ps -aq -f status=exited)

# Remove container and its anonymous volumes
docker rm -v webserver
```

### docker container prune

```bash
# Remove ALL stopped containers (prompts for confirmation)
docker container prune

# Skip confirmation prompt (useful in scripts)
docker container prune -f

# Remove stopped containers older than 24 hours
docker container prune --filter "until=24h"
```

### Combining Stop and Remove

```bash
# The -f flag on rm handles running containers automatically
docker rm -f webserver

# One-liner to stop and remove all containers (useful in dev reset)
docker rm -f $(docker ps -aq)
```

---

## 4. Executing Commands with exec

`docker exec` runs a new process inside an already-running container. This is one of the most useful debugging tools.

### Basic exec Usage

```bash
# Open an interactive bash shell
docker exec -it webserver bash

# If bash is not available (alpine images), use sh
docker exec -it webserver sh

# Run a one-off command without staying interactive
docker exec webserver nginx -t           # test nginx config
docker exec webserver cat /etc/hosts     # read a file
docker exec webserver ls /var/log/nginx  # list log files
```

### exec vs attach

```
docker attach:
  Connects your terminal to PID 1's stdin/stdout
  Ctrl+C stops the container
  Only one connection at a time

docker exec:
  Creates a NEW process inside the container (separate from PID 1)
  Ctrl+C only stops the exec session
  Multiple execs can run simultaneously
  ✔ Preferred for debugging — use exec, not attach
```

### Practical exec Patterns

```bash
# Check running processes inside a container
docker exec webserver ps aux

# Inspect the container's filesystem
docker exec webserver find /app -name "*.log"

# View an environment variable inside the container
docker exec webserver printenv DATABASE_URL

# Run a database query inside a postgres container
docker exec -it postgres psql -U admin -d mydb -c "SELECT COUNT(*) FROM users;"

# Reload nginx config without restarting the container
docker exec webserver nginx -s reload

# Run as a specific user inside the container
docker exec -u root webserver chown -R app:app /data
```

---

## 5. Logs — Viewing Container Output

Docker captures everything written to stdout and stderr by the container's main process (PID 1) and stores it as JSON on the host.

### Basic Log Commands

```bash
# Print all logs
docker logs webserver

# Follow logs in real time (like tail -f)
docker logs -f webserver

# Show last N lines only
docker logs --tail 100 webserver

# Follow, starting from last 50 lines
docker logs -f --tail 50 webserver
```

### Filtering by Time

```bash
# Logs since a specific time
docker logs --since "2024-01-15T10:00:00" webserver

# Logs from the last 30 minutes
docker logs --since 30m webserver

# Logs before a specific time
docker logs --until "2024-01-15T12:00:00" webserver

# Combine since and until
docker logs --since 1h --until 30m webserver
```

### Log Drivers and Rotation

```bash
# Default log driver stores JSON on disk — can grow unbounded
# Set limits to avoid filling the disk:

docker run -d \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  nginx

# Or configure globally in /etc/docker/daemon.json:
# {
#   "log-driver": "json-file",
#   "log-opts": { "max-size": "10m", "max-file": "3" }
# }
```

### Log Timestamps

```bash
# Include timestamps (host timezone)
docker logs -t webserver

# Timestamps + follow
docker logs -tf webserver
```

---

## 6. Inspecting Containers

`docker inspect` returns a full JSON document with every configuration and state detail for a container.

### Basic Inspect

```bash
# Full JSON output
docker inspect webserver

# Inspect multiple containers
docker inspect web db cache
```

### Extracting Specific Fields with --format

```bash
# Container IP address
docker inspect --format '{{.NetworkSettings.IPAddress}}' webserver

# Container state
docker inspect --format '{{.State.Status}}' webserver

# Exit code
docker inspect --format '{{.State.ExitCode}}' webserver

# Mounted volumes
docker inspect --format '{{json .Mounts}}' webserver | python3 -m json.tool

# Environment variables
docker inspect --format '{{join .Config.Env "\n"}}' webserver

# Image used
docker inspect --format '{{.Config.Image}}' webserver

# Restart count
docker inspect --format '{{.RestartCount}}' webserver
```

### Other Useful Observation Commands

```bash
# Real-time resource stats (CPU, memory, network, disk I/O)
docker stats webserver

# All containers, no streaming (one snapshot)
docker stats --no-stream

# Processes running inside a container (like ps inside the container)
docker top webserver

# Changes to container filesystem vs the original image
docker diff webserver
# A = added, C = changed, D = deleted
# Example output:
# C /etc/nginx/nginx.conf
# A /var/log/nginx/access.log

# Copy files between host and container
docker cp webserver:/var/log/nginx/access.log ./access.log
docker cp ./new-config.conf webserver:/etc/nginx/nginx.conf
```

---

## 7. Hands-On Exercises

**Exercise 1:** Demonstrate graceful vs forced stop. Run `docker run -d --name stoptest nginx:alpine`. Run `time docker stop stoptest` — note how fast it exits (nginx handles SIGTERM quickly). Now run `docker run -d --name killtest nginx:alpine` and `time docker kill killtest`. Compare the times and exit codes with `docker inspect killtest --format '{{.State.ExitCode}}'`.

**Exercise 2:** Practice `docker exec` for debugging. Run `docker run -d --name debug-me nginx:alpine`. Use `docker exec -it debug-me sh` to get a shell. Inside, run `ps aux`, `cat /etc/nginx/nginx.conf`, and `nginx -t`. Exit the shell — confirm the container is still running.

**Exercise 3:** Master log filtering. Run `docker run -d --name logtest nginx:alpine -p 8080:80`. Make several requests with `curl http://localhost:8080`. Run `docker logs logtest`, then `docker logs --tail 5 logtest`, then `docker logs --since 2m logtest`. Add `-t` to each and compare the timestamps.

**Exercise 4:** Use inspect to extract data. Run any container, then extract: its IP address, its start time, its image name, and all its environment variables using four separate `docker inspect --format` commands. Write the commands in a shell script called `container-info.sh`.

**Exercise 5:** Test `docker diff`. Run `docker run -d --name difftest ubuntu sleep 300`. Use `docker exec difftest bash -c "echo hello > /tmp/test.txt && mkdir /newdir"`. Run `docker diff difftest`. Identify the `A` (added) entries for your new file and directory.

---

## 8. Interview Q&A

**Q: How do you debug a running container that is misbehaving?**
Answer: Start with `docker logs <name>` to check application output for errors. Use `docker stats <name>` to check for memory or CPU exhaustion. Run `docker exec -it <name> sh` (or bash) to get an interactive shell and investigate the filesystem, running processes (`ps aux`), environment variables (`printenv`), and network connectivity (`curl`, `wget`). Use `docker diff <name>` to see what files changed from the base image. Use `docker inspect <name>` for full configuration and state metadata.

**Q: What is the difference between docker exec and docker attach?**
Answer: `docker attach` connects your terminal directly to the container's PID 1 stdin/stdout — pressing Ctrl+C sends a signal to PID 1, which can stop the container. `docker exec` creates a brand-new process inside the container, independent of PID 1 — Ctrl+C only kills the exec session. You should almost always use `docker exec -it <name> bash` for debugging rather than `attach`, because it is safer and supports concurrent sessions.

**Q: How do you access logs from a Docker container?**
Answer: `docker logs <name>` retrieves logs from Docker's log driver (default: json-file, stored in `/var/lib/docker/containers/<id>/<id>-json.log`). Key flags: `-f` to follow in real-time, `--tail N` for last N lines, `--since` for time-based filtering, `-t` to include timestamps. For production, configure a log driver (fluentd, awslogs, gelf) to ship logs to a centralized system, and set `max-size` and `max-file` limits to prevent unbounded disk growth.

**Q: How would you find the IP address of a running container?**
Answer: `docker inspect --format '{{.NetworkSettings.IPAddress}}' <name>` returns the container's IP on the default bridge network. For containers on a custom network: `docker inspect --format '{{json .NetworkSettings.Networks}}' <name>`. You can also run `docker exec <name> hostname -I` from inside. In production on custom Docker networks, container-to-container communication should use container names (DNS-resolved by Docker) rather than IPs, which can change on restart.

**Q: How do you cleanly remove all stopped containers?**
Answer: `docker container prune -f` removes all stopped containers without a confirmation prompt, ideal for scripts. To target specific containers: `docker rm $(docker ps -aq -f status=exited)` removes only exited containers. To force-remove running containers too: `docker rm -f $(docker ps -aq)`. In development, use `docker run --rm` so containers self-delete on exit, eliminating the need to prune them manually.
