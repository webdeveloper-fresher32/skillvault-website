# Resource Management — Complete Guide

## Table of Contents
1. [Why Resource Limits Matter](#1-why-resource-limits-matter)
2. [Linux cgroups and Docker](#2-linux-cgroups-and-docker)
3. [Memory Limits](#3-memory-limits)
4. [CPU Limits](#4-cpu-limits)
5. [Inspecting Resource Usage with docker stats](#5-inspecting-resource-usage-with-docker-stats)
6. [OOM Killer Behaviour](#6-oom-killer-behaviour)
7. [Resource Limits in Docker Compose](#7-resource-limits-in-docker-compose)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Resource Limits Matter

Without resource limits, a single runaway container can exhaust the host's CPU and memory, starving all other containers and potentially bringing the entire host down.

```
Without limits:                    With limits:

Host: 8 CPU, 16 GB RAM             Host: 8 CPU, 16 GB RAM
                                   ┌────────────────────────────────┐
Container A: uses 7 CPU ◄──────    │ Container A: capped at 2 CPU   │
Container B: starved (0.1 CPU)     │ Container B: capped at 2 CPU   │
Container C: OOM-killed            │ Container C: 512 MB memory     │
Host: unresponsive                 │ All containers healthy          │
                                   └────────────────────────────────┘
```

Resource constraints are essential for:
- **Multi-tenant environments** — preventing noisy-neighbour problems
- **Cost control** — matching container footprint to what the app actually needs
- **Predictability** — guaranteed resource budgets in production
- **SLA enforcement** — ensuring critical containers always have CPU headroom

---

## 2. Linux cgroups and Docker

Docker uses Linux **control groups (cgroups)** to enforce resource limits. Cgroups are a kernel feature that organises processes into hierarchical groups and applies accounting and limits to each group.

```
Linux Kernel
└── cgroup hierarchy
    └── /sys/fs/cgroup/
        ├── memory/
        │   └── docker/<container-id>/
        │       ├── memory.limit_in_bytes     ← enforces --memory
        │       └── memory.usage_in_bytes     ← current usage
        ├── cpu/
        │   └── docker/<container-id>/
        │       ├── cpu.cfs_period_us         ← scheduling period (100ms)
        │       └── cpu.cfs_quota_us          ← quota within period
        └── blkio/
            └── docker/<container-id>/
                └── blkio.throttle.read_bps_device
```

### cgroups v1 vs cgroups v2

| Feature | cgroups v1 | cgroups v2 |
|---------|-----------|-----------|
| Hierarchy | Multiple, per-subsystem trees | Single unified hierarchy |
| Memory swap control | Separate knobs | Unified `memory.swap.max` |
| CPU pressure | Not available | `cpu.pressure` (PSI) |
| Default on | Older kernels (pre-4.5) | Modern kernels (5.2+), Ubuntu 22.04+ |
| Docker support | Full | Full (Docker 20.10+) |

Check which version your host uses:

```bash
# Check cgroup version
stat -fc %T /sys/fs/cgroup/
# output: cgroup2fs  →  v2
# output: tmpfs      →  v1

# Docker reports it too
docker info | grep "Cgroup Version"
```

---

## 3. Memory Limits

### Setting Memory Limits

```bash
# Limit container to 512 MB RAM
docker run -d --memory=512m nginx

# Limit RAM + swap (total = memory + swap)
docker run -d --memory=512m --memory-swap=1g nginx
# swap available = 1g - 512m = 512m

# Disable swap entirely (swap = memory limit)
docker run -d --memory=512m --memory-swap=512m nginx

# Soft limit (kernel tries to reclaim if host is under pressure)
docker run -d --memory=512m --memory-reservation=256m nginx
```

### Memory Limit Units

```
b  = bytes
k  = kilobytes
m  = megabytes
g  = gigabytes

Examples:
  --memory=134217728    (128 MB in bytes)
  --memory=128k         (128 KB)
  --memory=512m         (512 MB — most common)
  --memory=2g           (2 GB)
```

### Inspecting Memory Settings

```bash
# Inspect a running container's memory config
docker inspect my-container | grep -A5 Memory

# Output:
# "Memory": 536870912,        ← 512 MB in bytes
# "MemorySwap": 1073741824,   ← 1 GB total (512 MB swap)
# "MemoryReservation": 0,

# Verify via cgroup (on cgroups v2 host)
cat /sys/fs/cgroup/system.slice/docker-<id>.scope/memory.max
```

---

## 4. CPU Limits

### Setting CPU Limits

```bash
# Limit to 0.5 of a CPU (50% of one core)
docker run -d --cpus=0.5 nginx

# Limit to 1.5 CPUs across a 4-core host
docker run -d --cpus=1.5 nginx

# Pin container to specific CPU cores (0 and 1 only)
docker run -d --cpuset-cpus="0,1" nginx

# Set CPU shares (relative weight, not hard limit)
# Default is 1024. 512 = half the priority of default.
docker run -d --cpu-shares=512 nginx
```

### How --cpus Translates to cgroups

```
--cpus=0.5 on a 100ms CFS period:

cpu.cfs_period_us = 100000   (100ms)
cpu.cfs_quota_us  =  50000   (50ms)

Meaning: this container can run at most 50ms out of every 100ms
         = 0.5 CPU regardless of how many cores the host has

--cpus=2.0:
cpu.cfs_quota_us = 200000   (200ms per 100ms period = 2 full cores)
```

### CPU Pinning vs CPU Quota

```
--cpus=0.5           → soft quota; process can run on any core
                       but time-sliced to 50% of one core

--cpuset-cpus="0,1"  → hard pinning; process ONLY runs on cores 0 and 1
                       no time limit — can use 200% if both cores free

Combined:
docker run --cpus=1.0 --cpuset-cpus="2,3" app
→ pinned to cores 2 and 3, but limited to 1 core's worth of time
```

---

## 5. Inspecting Resource Usage with docker stats

```bash
# Live resource usage for all running containers
docker stats

# One-shot snapshot (no live refresh)
docker stats --no-stream

# Specific container
docker stats my-container --no-stream

# Custom format
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

### Reading docker stats Output

```
NAME          CPU %   MEM USAGE / LIMIT     MEM %   NET I/O         BLOCK I/O
web           2.34%   48.5MiB / 512MiB      9.47%   1.2kB / 800B    0B / 0B
db            0.12%   312MiB / 1GiB         30.47%  0B / 0B         8.1MB / 2.3MB
cache         0.01%   6.2MiB / 256MiB       2.42%   900B / 600B     0B / 0B

Column meanings:
  CPU %      = CPU usage relative to ONE core (can exceed 100% on multi-core)
  MEM USAGE  = current RSS memory used
  LIMIT      = --memory value (or total host RAM if no limit set)
  MEM %      = MEM USAGE / LIMIT × 100
  NET I/O    = bytes received / sent on container network interfaces
  BLOCK I/O  = bytes read / written to block devices
```

---

## 6. OOM Killer Behaviour

When a container exceeds its memory limit, the Linux **OOM (Out-Of-Memory) Killer** terminates a process inside the container.

```
Memory usage reaches --memory limit
           │
           ▼
Kernel OOM Killer activates
           │
           ▼
Selects process with highest oom_score_adj to kill
           │
      ┌────┴────────────────────┐
      ▼                         ▼
Container's PID 1 killed    Other process killed
(container exits)           (container may stay up
                             but behave incorrectly)
```

### Checking for OOM Events

```bash
# Check if a container was OOM-killed
docker inspect <container> | grep -i oom
# "OOMKilled": true

# View OOM events in kernel log
dmesg | grep -i "oom\|killed"

# Exit code 137 = SIGKILL = typically OOM
docker ps -a --filter "status=exited"
docker inspect <container> --format '{{.State.ExitCode}}'
# 137 = OOM kill
```

### OOM Killer Options

```bash
# Disable OOM killer for this container (container pauses instead of dying)
# Use with caution — can hang the host under extreme pressure
docker run --oom-kill-disable --memory=512m my-app

# Adjust OOM score (lower = less likely to be killed; range: -1000 to 1000)
docker run --oom-score-adj=-500 critical-service
```

---

## 7. Resource Limits in Docker Compose

```yaml
# docker-compose.yml (Compose v3 — deploy.resources syntax)
version: "3.8"

services:
  web:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M

  db:
    image: postgres:15
    deploy:
      resources:
        limits:
          cpus: "1.00"
          memory: 1G
        reservations:
          memory: 512M
```

Note: `deploy.resources` is respected by `docker compose up` from Docker Compose v2 (compose-spec). On older Compose v1 standalone, use top-level `mem_limit` / `cpus` keys instead.

```yaml
# Compose v2 shorthand (compose-spec, no deploy key needed)
services:
  web:
    image: myapp:latest
    mem_limit: 512m
    cpus: 0.5
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run an nginx container with a 128 MB memory limit and 0.25 CPU. Run `docker stats --no-stream` and confirm the limit column shows 128 MiB.

**Exercise 2:** Run `docker run --memory=32m --memory-swap=32m progrium/stress --vm 1 --vm-bytes 64M`. Observe the exit code with `docker inspect <id> --format '{{.State.OOMKilled}}'` — it should be `true`.

**Exercise 3:** Start two containers: one with `--cpus=0.1` and one with `--cpus=2.0`. Run a CPU-intensive workload in each (`stress --cpu 1`). Use `docker stats` to verify CPU% is capped as expected.

**Exercise 4:** Write a `docker-compose.yml` with a web service (limit: 256 MB, 0.5 CPU) and a redis service (limit: 128 MB, 0.25 CPU). Start the stack and confirm limits with `docker stats`.

**Exercise 5:** On a Linux host, find the cgroup directory for a running container. Read `memory.max` (cgroups v2) or `memory.limit_in_bytes` (cgroups v1) and verify it matches the `--memory` value you set.

---

## 9. Interview Q&A

**Q: What happens when a Docker container exceeds its memory limit?**
Answer: The Linux OOM (Out-Of-Memory) Killer is invoked. It selects the highest-scoring process in the container's cgroup and sends it SIGKILL. If that process is PID 1 (the main container process), the container exits with code 137. You can verify this with `docker inspect <container> | grep OOMKilled` — it will show `true`. The container does not automatically restart unless a restart policy is configured.

**Q: What is the difference between --memory and --memory-reservation?**
Answer: `--memory` is a hard limit — the kernel enforces it and OOM-kills if exceeded. `--memory-reservation` is a soft limit (guarantee) — the kernel tries to keep the container's usage below this value when the host is under memory pressure, but does not enforce it strictly. Set reservation lower than the hard limit to give the container a guaranteed minimum while still allowing it to burst up to the hard ceiling.

**Q: How does --cpus=0.5 work internally?**
Answer: Docker translates `--cpus=0.5` into CFS (Completely Fair Scheduler) cgroup parameters. With the default 100ms period (`cpu.cfs_period_us=100000`), it sets `cpu.cfs_quota_us=50000`, meaning the container can consume at most 50ms of CPU time per 100ms scheduling window — equivalent to half a core, regardless of how many physical cores the host has.

**Q: What is the difference between cgroups v1 and cgroups v2?**
Answer: cgroups v1 uses multiple separate hierarchies per subsystem (memory, cpu, blkio each have their own tree), which leads to inconsistencies. cgroups v2 uses a single unified hierarchy under `/sys/fs/cgroup/`, adds Pressure Stall Information (PSI) for better resource pressure visibility, and provides more accurate memory accounting (including kernel memory). Docker supports both; cgroups v2 is the default on modern Linux distributions (Ubuntu 22.04+, RHEL 9+).

**Q: How do you prevent one container from starving others on a shared host?**
Answer: Set explicit resource limits on all containers. Use `--memory` for hard memory caps, `--cpus` for CPU quotas, and `--cpu-shares` for relative CPU weighting during contention. In Docker Compose, use `deploy.resources.limits` for hard caps and `deploy.resources.reservations` for guaranteed minimums. Combine this with container-level restart policies and health checks so OOM-killed containers recover automatically.
