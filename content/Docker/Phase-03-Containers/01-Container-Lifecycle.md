# Container Lifecycle — Complete Guide

## Table of Contents
1. [What is Container Lifecycle?](#1-what-is-container-lifecycle)
2. [Container States](#2-container-states)
3. [Lifecycle Flow Diagram](#3-lifecycle-flow-diagram)
4. [Creation vs Start — Key Distinction](#4-creation-vs-start--key-distinction)
5. [State Transitions in Practice](#5-state-transitions-in-practice)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is Container Lifecycle?

Every Docker container moves through a well-defined set of states from creation to removal. Understanding the lifecycle lets you:
- Predict what happens when a command fails or a process exits
- Recover containers without losing data
- Write healthcheck and restart policies correctly
- Avoid dangling containers consuming disk space

```
Analogy: think of a container like a job process on a server.
  Created  = job defined, not yet scheduled
  Running  = job executing
  Paused   = job suspended (SIGSTOP)
  Exited   = job finished (with an exit code)
  Dead     = job crashed unrecoverably
  Removed  = job record deleted
```

---

## 2. Container States

Docker tracks six distinct states for every container:

| State | Description | How you get here |
|-------|-------------|-----------------|
| **created** | Container object exists; no process started | `docker create` |
| **running** | Main process is executing | `docker start` / `docker run` |
| **paused** | Process frozen via SIGSTOP; memory retained | `docker pause` |
| **restarting** | Docker daemon is restarting the container | restart policy triggered |
| **exited** | Main process ended (exit code 0 or non-zero) | process finished, `docker stop` |
| **dead** | Container removal failed partway; unusable | daemon crash / force-remove |

### Exit Codes Matter

```
Exit code 0   → process finished cleanly (success)
Exit code 1   → application error
Exit code 137 → killed by SIGKILL (OOM killer or docker kill)
Exit code 143 → killed by SIGTERM (docker stop)
Exit code 125 → docker itself failed to run the container
Exit code 126 → container command found but not executable
Exit code 127 → container command (binary) not found
```

Check exit code: `docker inspect <id> --format '{{.State.ExitCode}}'`

---

## 3. Lifecycle Flow Diagram

```
                      docker pull / image exists
                              │
                              ▼
                     ┌────────────────┐
                     │   IMAGE        │
                     │  (on disk)     │
                     └────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │ docker create               │ docker run
               ▼                             ▼
       ┌───────────────┐             ┌───────────────┐
       │   CREATED     │──docker────▶│   RUNNING     │◀─┐
       │  (no process) │   start     │  (process up) │  │
       └───────────────┘             └───────────────┘  │
                                        │       │        │
                             docker     │       │ docker │ restart
                             pause      │       │ stop   │ policy
                                        ▼       ▼        │
                               ┌──────────┐  ┌──────────┐│
                               │  PAUSED  │  │  EXITED  ││
                               │ (frozen) │  │(code 0+) ││
                               └──────────┘  └──────────┘│
                               docker unpause      │      │
                                   └───────────────┘      │
                                      docker start        │
                                           └──────────────┘
                                                   │
                                           docker rm
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │   REMOVED     │
                                           │  (gone)       │
                                           └───────────────┘
```

---

## 4. Creation vs Start — Key Distinction

`docker create` and `docker start` are two separate operations that `docker run` combines into one.

### docker create
```bash
docker create --name webserver -p 8080:80 nginx:alpine
# Output: <container-id>
# Effect: container object created, filesystem layers merged,
#         network config set — but NO PROCESS started yet.
# State: CREATED
```

### docker start
```bash
docker start webserver
# Effect: container's CMD/ENTRYPOINT process is launched.
# State: RUNNING
```

### docker run = create + start (+ attach by default)
```bash
docker run --name webserver -p 8080:80 nginx:alpine
# Equivalent to:
#   docker create --name webserver -p 8080:80 nginx:alpine
#   docker start --attach webserver
```

### Why use create separately?

```
Use case 1 — pre-stage containers during off-peak hours:
  docker create ... (slow: pulling image, setting up network)
  later...
  docker start ... (fast: process launch only)

Use case 2 — copy files into container before first start:
  docker create --name setup myimage
  docker cp ./config.json setup:/app/config.json
  docker start setup

Use case 3 — scripted orchestration where start must be
  coordinated across multiple containers.
```

---

## 5. State Transitions in Practice

### Stopping a Container Gracefully

```bash
# docker stop sends SIGTERM, waits 10s, then sends SIGKILL
docker stop webserver

# Custom grace period (30 seconds)
docker stop --time 30 webserver

# Immediate kill (SIGKILL, no grace)
docker kill webserver
```

```
SIGTERM → app's signal handler → graceful shutdown
  ↓ (if not exited within --time seconds)
SIGKILL → kernel terminates process immediately
```

### Pausing and Resuming

```bash
# Freeze all processes in a container (cgroup freezer)
docker pause webserver    # State: PAUSED

# Resume
docker unpause webserver  # State: RUNNING

# Use case: take a consistent snapshot, run backup, then resume
docker pause db
pg_dumpall --host=... > backup.sql
docker unpause db
```

### Restart Policies

```bash
# Set restart policy at creation time
docker run -d --restart always nginx
docker run -d --restart on-failure:3 myapp
docker run -d --restart unless-stopped redis

# Policies:
#   no             → never restart (default)
#   always         → restart regardless of exit code
#   on-failure[:n] → restart only on non-zero exit, up to n times
#   unless-stopped → restart always, unless manually stopped
```

### Automatic Cleanup on Exit

```bash
# --rm removes the container filesystem immediately on exit
docker run --rm ubuntu bash -c "echo hello && exit 0"
# Container is gone after the command exits — no docker rm needed
```

---

## 6. Hands-On Exercises

**Exercise 1:** Run `docker create --name lifecycle-test alpine echo "hello"`. Verify the state with `docker ps -a --filter name=lifecycle-test`. Then run `docker start -a lifecycle-test`. Observe the state change from `created` to `exited`.

**Exercise 2:** Start an nginx container with `docker run -d --name pause-demo nginx`. Pause it with `docker pause pause-demo` and check `docker stats pause-demo` — CPU should drop to 0. Unpause it and confirm traffic resumes at `http://localhost`.

**Exercise 3:** Test restart policies. Run `docker run -d --restart on-failure:3 --name fail-test alpine sh -c "exit 1"`. Watch `docker ps -a` repeatedly — observe the `restarting` state and the restart count in `docker inspect fail-test | grep -A5 RestartCount`.

**Exercise 4:** Demonstrate `create` vs `run`. Run `docker create --name pre-stage -p 9090:80 nginx:alpine`. Copy a custom HTML file into it: `echo "<h1>Pre-staged</h1>" > index.html && docker cp index.html pre-stage:/usr/share/nginx/html/index.html`. Then `docker start pre-stage` and verify the custom page at `http://localhost:9090`.

**Exercise 5:** Inspect lifecycle metadata. Run any container, stop it, then run `docker inspect <name>` and locate: `State.Status`, `State.ExitCode`, `State.StartedAt`, `State.FinishedAt`. Calculate the uptime from these timestamps.

---

## 7. Interview Q&A

**Q: What are the possible states of a Docker container?**
Answer: A container can be in one of six states: `created` (object exists, no process), `running` (process executing), `paused` (process frozen via cgroup freezer), `restarting` (daemon is applying restart policy), `exited` (process ended — exit code 0 or non-zero), and `dead` (removal failed partway, unusable). You can inspect current state with `docker inspect <id> --format '{{.State.Status}}'`.

**Q: What is the difference between docker create and docker run?**
Answer: `docker create` sets up the container object — merges image layers into a writable filesystem, configures networking, assigns a name and ID — but does not start the process. `docker run` combines `create` and `start` (and attaches by default). Using `create` separately is useful when you need to copy files into the container before its first start, or pre-stage containers during off-hours for a fast subsequent `start`.

**Q: What happens when you run docker stop?**
Answer: `docker stop` sends `SIGTERM` to the container's main process (PID 1), giving it a grace period (default 10 seconds) to shut down gracefully. If the process does not exit within that window, Docker sends `SIGKILL`, which the kernel uses to immediately terminate the process. You can override the grace period with `--time`. The container transitions to `exited` state with the appropriate exit code (143 for SIGTERM, 137 for SIGKILL).

**Q: What are Docker restart policies and when would you use each?**
Answer: `no` (default) — never restart automatically. `always` — restart regardless of exit code, including on daemon start; used for core infrastructure like monitoring agents. `on-failure[:n]` — restart only if the exit code is non-zero, up to n times; used for apps that might crash but should not loop forever. `unless-stopped` — like `always` but respects a manual `docker stop`; the most common choice for long-running services.

**Q: What is the difference between docker stop and docker kill?**
Answer: `docker stop` sends `SIGTERM` first (graceful), then `SIGKILL` after the timeout. It allows the application to flush buffers, close database connections, and finish in-flight requests. `docker kill` sends `SIGKILL` immediately by default (or any signal you specify with `--signal`), which the kernel enforces — the process cannot catch or ignore it. Use `docker stop` for normal operations; `docker kill` only when a container is unresponsive.
