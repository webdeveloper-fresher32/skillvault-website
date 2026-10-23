# Phase 09 — Docker Swarm

> Docker Swarm mode for container orchestration — services, stacks, and high availability across a cluster of Docker nodes.

---

## Overview

Docker Swarm is Docker's native clustering and orchestration solution. This phase covers initialising a Swarm cluster, deploying replicated services, composing multi-service stacks, and designing for fault tolerance and rolling updates.

By the end of this phase you will be able to provision a production-ready Swarm cluster, deploy and scale services declaratively, and understand how Swarm handles service discovery and overlay networking.

---

## Topics

| # | File | Topic | Estimated Time |
|---|------|-------|---------------|
| 1 | `01-Swarm-Mode.md` | Swarm initialisation, nodes, and managers | 2 days |
| 2 | `02-Services-Stacks.md` | Services, stacks, and rolling deployments | 3 days |
| 3 | `03-Swarm-Networking.md` | Overlay networks and service discovery | 2 days |

---

## What You Will Learn

### 01 — Swarm Mode
- Initialising a Swarm with `docker swarm init`
- Adding manager and worker nodes
- Node roles, quorum, and the Raft consensus algorithm
- Inspecting cluster state with `docker node ls`

### 02 — Services and Stacks
- Creating and scaling services with `docker service create`
- Deploying multi-service applications with `docker stack deploy`
- Compose files for Swarm (`deploy` key, replicas, placement constraints)
- Rolling updates and rollback strategies

### 03 — Swarm Networking
- Overlay network drivers and VXLAN encapsulation
- Service discovery via internal DNS
- Ingress load balancing and the routing mesh
- Connecting external traffic to Swarm services

---

## Estimated Time

**1 week** (7 days total)

---

## Prerequisites

Complete the following phases before starting:

- Phase 01 — Docker Fundamentals
- Phase 02 — Images and Dockerfiles
- Phase 03 — Volumes and Bind Mounts
- Phase 04 — Networking
- Phase 05 — Docker Compose
- Phase 06 — Multi-Container Applications

A working multi-node environment is recommended. You can simulate this locally using Docker Desktop with multiple contexts, or provision lightweight VMs (e.g. via Multipass or VirtualBox).

---

## Up Next

**Phase 10 — Docker Security**

Covers image scanning, runtime security, secrets management, capability restrictions, and hardening Docker daemon configuration.

---

## Quick Reference

```bash
# Initialise a Swarm on the manager node
docker swarm init --advertise-addr <MANAGER_IP>

# Join a worker node (run on each worker)
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377

# Deploy a stack from a Compose file
docker stack deploy -c docker-compose.yml my-app

# List running services
docker service ls

# Scale a service
docker service scale my-app_web=5

# Inspect service logs
docker service logs my-app_web

# Drain a node before maintenance
docker node update --availability drain <NODE_ID>
```

---

*Docker Learning Path — Phase 09 of 12*
