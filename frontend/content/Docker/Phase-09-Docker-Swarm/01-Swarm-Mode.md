# Docker Swarm Mode — Complete Guide

## Table of Contents

1. [What Is Docker Swarm?](#1-what-is-docker-swarm)
2. [Managers vs Workers](#2-managers-vs-workers)
3. [Raft Consensus Algorithm](#3-raft-consensus-algorithm)
4. [Initialising a Swarm](#4-initialising-a-swarm)
5. [Joining Nodes to the Swarm](#5-joining-nodes-to-the-swarm)
6. [Inspecting and Managing Nodes](#6-inspecting-and-managing-nodes)
7. [Node Availability and Promotion](#7-node-availability-and-promotion)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Is Docker Swarm?

Docker Swarm is Docker's native container orchestration system built into the Docker Engine. It turns a pool of Docker hosts into a single virtual host, enabling you to deploy, scale, and manage containerised services across multiple machines.

Key capabilities:
- **Declarative service model** — describe desired state; Swarm reconciles actual state to match
- **Scaling** — add or remove replicas with a single command
- **Load balancing** — built-in ingress routing mesh distributes traffic
- **Rolling updates** — zero-downtime deployments with configurable parallelism
- **Self-healing** — failed containers are automatically rescheduled on healthy nodes

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Swarm Cluster                  │
│                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │  Manager 1  │   │  Manager 2  │   │  Manager 3  │   │
│  │  (Leader)   │◄──►  (Follower) │◄──►  (Follower) │   │
│  └──────┬──────┘   └─────────────┘   └─────────────┘   │
│         │  Raft Consensus                               │
│         │                                               │
│  ┌──────▼──────┐   ┌─────────────┐   ┌─────────────┐   │
│  │  Worker 1   │   │  Worker 2   │   │  Worker 3   │   │
│  │  (Tasks)    │   │  (Tasks)    │   │  (Tasks)    │   │
│  └─────────────┘   └─────────────┘   └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Managers vs Workers

Swarm nodes have two roles: **manager** and **worker**.

### Manager Nodes

| Responsibility         | Detail                                                     |
|------------------------|------------------------------------------------------------|
| Maintain cluster state | Store and replicate Swarm state via Raft consensus log     |
| Schedule tasks         | Decide which worker (or manager) runs each container task  |
| Serve API requests     | Accept `docker service` and `docker stack` commands        |
| Perform health checks  | Monitor task state and reschedule failed containers        |

Managers can also run workloads. In small clusters (1 node) the single manager doubles as a worker. In production, drain managers so they only orchestrate.

### Worker Nodes

| Responsibility         | Detail                                                     |
|------------------------|------------------------------------------------------------|
| Execute tasks          | Run the container tasks assigned by manager scheduling     |
| Report task state      | Send heartbeats and state updates back to managers         |
| No Raft participation  | Workers do not vote or store cluster state                 |

```
Manager Node                          Worker Node
┌────────────────────────────┐        ┌──────────────────────────┐
│  ┌──────────────────────┐  │        │  ┌────────────────────┐  │
│  │  Swarm Manager API   │  │        │  │  Docker Engine     │  │
│  └──────────────────────┘  │        │  └────────────────────┘  │
│  ┌──────────────────────┐  │        │  ┌────────────────────┐  │
│  │  Raft Consensus Log  │  │        │  │  Task Executor     │  │
│  └──────────────────────┘  │        │  └────────────────────┘  │
│  ┌──────────────────────┐  │        │  ┌────────────────────┐  │
│  │  Scheduler           │  │        │  │  Containers        │  │
│  └──────────────────────┘  │        │  └────────────────────┘  │
│  ┌──────────────────────┐  │        └──────────────────────────┘
│  │  Dispatcher          │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

---

## 3. Raft Consensus Algorithm

Swarm managers use the **Raft Distributed Consensus** algorithm to maintain a consistent view of cluster state across all manager nodes.

**How it works:**
1. One manager is elected **Leader** — it processes all write operations
2. Writes are proposed and must be acknowledged by a **quorum** (majority) of managers
3. Once a quorum acknowledges, the write is committed to all managers
4. If the Leader fails, a new election is triggered automatically

**Quorum formula:**
```
Quorum = floor(N / 2) + 1

Managers    Quorum    Fault Tolerance
    1           1           0
    3           2           1
    5           3           2
    7           4           3
```

**Best practice:** Always deploy an **odd number** of manager nodes. Even numbers provide no additional fault tolerance and increase the quorum requirement.

---

## 4. Initialising a Swarm

### Basic Initialisation

```bash
# Initialise swarm on the current host (becomes first manager / leader)
docker swarm init

# Specify advertise address when host has multiple network interfaces
docker swarm init --advertise-addr 192.168.1.10

# Specify advertise address and listen address separately
docker swarm init \
  --advertise-addr 192.168.1.10 \
  --listen-addr 192.168.1.10:2377
```

After `docker swarm init`, Docker outputs a join token for workers:
```
Swarm initialized: current node (xyz123) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-abc...xyz 192.168.1.10:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.
```

### Retrieve Join Tokens Later

```bash
# Get worker join token
docker swarm join-token worker

# Get manager join token
docker swarm join-token manager

# Rotate tokens (invalidates old tokens)
docker swarm join-token --rotate worker
docker swarm join-token --rotate manager
```

---

## 5. Joining Nodes to the Swarm

### Join as Worker

```bash
# Run on each host that should join as a worker
docker swarm join \
  --token SWMTKN-1-abc...xyz \
  192.168.1.10:2377
```

### Join as Manager

```bash
# Run on hosts that should join as additional managers
docker swarm join \
  --token SWMTKN-1-manager-token \
  192.168.1.10:2377
```

### Leaving the Swarm

```bash
# Worker leaves the swarm
docker swarm leave

# Force a manager to leave (degrades cluster — use with caution)
docker swarm leave --force
```

---

## 6. Inspecting and Managing Nodes

```bash
# List all nodes in the swarm (run on a manager)
docker node ls

# Inspect a specific node
docker node inspect node-id --pretty

# List tasks running on a node
docker node ps node-id

# List tasks on the current node
docker node ps self
```

Example output of `docker node ls`:
```
ID             HOSTNAME   STATUS    AVAILABILITY   MANAGER STATUS   ENGINE VERSION
xyz123 *       manager1   Ready     Active         Leader           24.0.7
abc456         manager2   Ready     Active         Reachable        24.0.7
def789         manager3   Ready     Active         Reachable        24.0.7
ghi012         worker1    Ready     Active                          24.0.7
jkl345         worker2    Ready     Active                          24.0.7
```

---

## 7. Node Availability and Promotion

### Availability States

```bash
# Active — node accepts new task assignments (default)
docker node update --availability active node-id

# Pause — node stops receiving new tasks; existing tasks continue
docker node update --availability pause node-id

# Drain — node stops receiving new tasks; existing tasks rescheduled elsewhere
docker node update --availability drain node-id
```

Draining a node is the safe way to take a node offline for maintenance.

### Promoting and Demoting Nodes

```bash
# Promote a worker to manager
docker node promote worker-node-id

# Demote a manager to worker
docker node demote manager-node-id
```

### Removing a Node

```bash
# Remove a node from the swarm (node must have left first)
docker node rm node-id
```

---

## 8. Hands-On Exercises

**Exercise 1 — Initialise a single-node swarm**
```bash
docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')
docker node ls
```
Observe that one node appears with role Manager and status Leader.

**Exercise 2 — Retrieve and inspect join tokens**
```bash
docker swarm join-token worker
docker swarm join-token manager
```
Note the difference in token format. On a second VM or using play-with-docker.com, paste the worker join command and verify with `docker node ls`.

**Exercise 3 — Drain a node for maintenance**
```bash
# Identify a worker node ID from docker node ls
docker node update --availability drain <worker-node-id>
docker node ls
# Restore after maintenance
docker node update --availability active <worker-node-id>
```

**Exercise 4 — Promote a worker to manager**
```bash
docker node promote <worker-node-id>
docker node ls
# Confirm the node now shows "Reachable" under MANAGER STATUS
docker node demote <worker-node-id>
```

**Exercise 5 — Inspect node details**
```bash
docker node inspect self --pretty
docker node inspect <worker-node-id> --pretty
```
Review the Platform, Resources, Engine Version, and TLS certificate fields.

---

## 9. Interview Q&A

**Q:** What is the minimum number of manager nodes recommended for a production Swarm cluster?

Answer: Three manager nodes. With three managers, Raft quorum is two, meaning the cluster tolerates one manager failure while remaining operational. A single-manager cluster has zero fault tolerance — if the manager fails, no scheduling decisions can be made.

---

**Q:** What is the difference between a Swarm manager's "Pause" and "Drain" availability modes?

Answer: Pause stops the scheduler from assigning new tasks to the node, but all currently running tasks on that node continue running. Drain goes further — it stops new task assignments AND reschedules all existing tasks from that node onto other available nodes. Drain is used before taking a node down for maintenance.

---

**Q:** How does Raft consensus prevent split-brain in a Swarm cluster?

Answer: Raft requires a quorum (majority) of managers to acknowledge any write before it is committed. If the cluster partitions, only the partition containing a quorum of managers can continue to make decisions. The minority partition becomes read-only and cannot schedule new work, preventing two independent "brains" from making conflicting decisions.

---

**Q:** Can a manager node also run workloads?

Answer: Yes. By default, managers are eligible to run tasks. In production environments it is common to drain manager nodes (`--availability drain`) so they are dedicated solely to orchestration, improving stability and preventing workloads from competing with cluster management for resources.

---

**Q:** How do you rotate join tokens and why would you do this?

Answer: Run `docker swarm join-token --rotate worker` or `docker swarm join-token --rotate manager`. You would rotate tokens if you suspect a token has been compromised — for example, if a join command was accidentally logged or exposed. Rotating immediately invalidates the old token without affecting existing cluster members.
