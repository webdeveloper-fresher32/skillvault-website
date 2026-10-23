# Docker Swarm Networking — Complete Guide

## Table of Contents

1. [Swarm Networking Overview](#1-swarm-networking-overview)
2. [Overlay Networks](#2-overlay-networks)
3. [VXLAN Tunneling](#3-vxlan-tunneling)
4. [Ingress Routing Mesh](#4-ingress-routing-mesh)
5. [Service Discovery and DNS](#5-service-discovery-and-dns)
6. [Network Isolation and Internal Networks](#6-network-isolation-and-internal-networks)
7. [Network Troubleshooting](#7-network-troubleshooting)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Swarm Networking Overview

Docker Swarm uses several network drivers to manage communication between containers across multiple hosts:

| Network Driver | Scope       | Use Case                                            |
|----------------|-------------|-----------------------------------------------------|
| `overlay`      | Swarm-wide  | Container-to-container across nodes                 |
| `ingress`      | Swarm-wide  | Built-in overlay for the routing mesh               |
| `bridge`       | Single host | Local container communication (not Swarm-aware)     |
| `host`         | Single host | Container shares host network stack                 |
| `macvlan`      | Single host | Assign MAC address; appear as physical device       |

In a Swarm cluster, the two most important networks are:

- **`ingress`** — automatically created by Swarm, carries external traffic to services via the routing mesh
- **User-defined overlay networks** — created by administrators for east-west (service-to-service) communication

```
External Client
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                  Ingress Routing Mesh                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  Node 1  │    │  Node 2  │    │  Node 3  │          │
│  │ port 80  │    │ port 80  │    │ port 80  │          │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘          │
└───────┼──────────────┼──────────────┼──────────────────┘
        │              │              │
        ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│               User-Defined Overlay Network              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │  web.1   │  │  web.2   │  │  web.3   │             │
│   │ (nginx)  │  │ (nginx)  │  │ (nginx)  │             │
│   └────┬─────┘  └──────────┘  └──────────┘             │
│        │                                                │
│        ▼                                                │
│   ┌──────────┐                                          │
│   │  api.1   │◄── DNS: "api" resolves to VIP            │
│   └──────────┘                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Overlay Networks

An **overlay network** spans multiple Docker hosts by encapsulating traffic at the network layer. Containers on different physical hosts attached to the same overlay network can communicate as if they were on the same LAN.

### Creating Overlay Networks

```bash
# Create a basic overlay network
docker network create \
  --driver overlay \
  my-overlay

# Create with a specific subnet
docker network create \
  --driver overlay \
  --subnet 10.10.0.0/24 \
  --gateway 10.10.0.1 \
  my-overlay

# Create an attachable overlay (allows standalone containers to attach)
docker network create \
  --driver overlay \
  --attachable \
  my-overlay

# Create an encrypted overlay (AES-GCM 128-bit encryption for data plane)
docker network create \
  --driver overlay \
  --opt encrypted \
  secure-overlay
```

### Attaching Services to Overlay Networks

```bash
# Attach during service creation
docker service create \
  --name web \
  --replicas 3 \
  --network my-overlay \
  nginx:latest

# Attach an existing service to a network
docker service update \
  --network-add my-overlay \
  web

# Remove a service from a network
docker service update \
  --network-rm my-overlay \
  web
```

### Listing and Inspecting Networks

```bash
# List all networks (shows scope: local vs swarm)
docker network ls

# Inspect an overlay network
docker network inspect my-overlay

# Remove a network (must have no active endpoints)
docker network rm my-overlay
```

---

## 3. VXLAN Tunneling

Overlay networks work by encapsulating container packets inside **VXLAN** (Virtual Extensible LAN) frames that travel over the physical underlay network.

```
Container on Node 1 sends packet to container on Node 2
─────────────────────────────────────────────────────────

Original Packet
┌────────────────────────────────────────────┐
│  Src: 10.10.0.2  Dst: 10.10.0.5  Payload  │
│  (overlay IP addresses)                    │
└────────────────────────────────────────────┘

VXLAN Encapsulation on Node 1
┌──────────────────────────────────────────────────────────┐
│  Outer Ethernet Header  (Node1 MAC → Node2 MAC)          │
│  Outer IP Header        (192.168.1.10 → 192.168.1.20)   │
│  Outer UDP Header       (src port → dst port 4789)       │
│  VXLAN Header           (VNI = network identifier)       │
│  Inner Ethernet Header  (container MAC)                  │
│  Inner IP Header        (10.10.0.2 → 10.10.0.5)         │
│  Payload                (application data)               │
└──────────────────────────────────────────────────────────┘

Decapsulation on Node 2
┌────────────────────────────────────────────┐
│  Src: 10.10.0.2  Dst: 10.10.0.5  Payload  │
│  (delivered to destination container)      │
└────────────────────────────────────────────┘
```

**How Docker manages VXLAN:**
- Each overlay network gets a unique **VNI** (VXLAN Network Identifier)
- Docker uses a kernel VXLAN driver (`vxlan` module) for data plane forwarding
- The Swarm control plane distributes MAC-to-IP mappings via the gossip protocol
- UDP port **4789** must be open between all Swarm nodes for VXLAN traffic

**Required open ports for Swarm:**
```
Port 2377/tcp  — Swarm management (manager API)
Port 7946/tcp  — Node-to-node communication (gossip)
Port 7946/udp  — Node-to-node communication (gossip)
Port 4789/udp  — Overlay network traffic (VXLAN)
```

---

## 4. Ingress Routing Mesh

The **ingress routing mesh** enables any node in the Swarm to accept connections on a published service port, even if that node is not running a replica of the service. The connection is transparently routed to a healthy task.

### How It Works

```
Client request → any Swarm node on port 80
                       │
                       ▼
              ┌────────────────┐
              │  ipvs (IPVS)   │  ← Linux kernel load balancer
              │  on every node │
              └────────┬───────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ web.1   │   │ web.2   │   │ web.3   │
    │ Node-1  │   │ Node-2  │   │ Node-1  │
    └─────────┘   └─────────┘   └─────────┘
```

Every Swarm node runs an `ingress-sbox` (ingress sandbox) network namespace that contains the IPVS rules. When a packet arrives on the published port:

1. `iptables` redirects it to the `ingress-sbox`
2. IPVS load-balances it across all healthy task IPs on the `ingress` overlay network
3. The selected task receives the packet — regardless of which physical node it is on

### Publishing Ports

```bash
# Short syntax (host:container)
docker service create --name web --publish 80:80 nginx

# Long syntax — explicit mode
docker service create \
  --name web \
  --publish published=80,target=80,mode=ingress \
  nginx

# Host mode — bypass routing mesh, bind directly on the node running the task
docker service create \
  --name web \
  --publish published=80,target=80,mode=host \
  nginx
```

**Ingress mode** (default) — any node answers on port 80 regardless of whether it runs a task.  
**Host mode** — only nodes actually running a task answer on port 80. Clients must know which nodes have tasks.

---

## 5. Service Discovery and DNS

Swarm embeds a **DNS server** in every container's network namespace. Services are resolvable by name within the same overlay network.

### Virtual IPs (VIPs)

By default, each service gets a **Virtual IP (VIP)** — a stable IP address that does not change as tasks come and go.

```
Service: api  →  VIP: 10.10.0.10

  DNS lookup: "api" → 10.10.0.10 (VIP, never changes)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
         10.10.0.11     10.10.0.12     10.10.0.13
          api.1          api.2          api.3
```

```bash
# Verify DNS resolution from inside a container
docker run --rm --network my-overlay \
  busybox nslookup api

# Inspect the VIP assigned to a service
docker service inspect web --format '{{json .Endpoint.VirtualIPs}}'
```

### DNS Round Robin (DNSRR)

As an alternative to VIPs, services can use DNSRR mode where DNS returns all task IPs:

```bash
docker service create \
  --name api \
  --endpoint-mode dnsrr \
  --network my-overlay \
  myapi:latest
```

With DNSRR, each DNS lookup returns the IPs of all running tasks. The client is responsible for picking one. This is useful for clients that implement their own load balancing (e.g., gRPC).

### Service Name Formats

Within a stack, services are discoverable using multiple DNS name formats:

```
Short name:          web
Fully qualified:     web.mystack
Task-specific:       web.1.task-id (for direct task addressing)
```

---

## 6. Network Isolation and Internal Networks

Use internal overlay networks to isolate backend services from external traffic.

```bash
# Create an internal network (no external routing)
docker network create \
  --driver overlay \
  --internal \
  backend

# Database only reachable from api, not from ingress
docker service create \
  --name db \
  --network backend \
  postgres:15

docker service create \
  --name api \
  --network frontend \
  --network backend \
  --publish 8080:8080 \
  myapi:latest
```

```
Internet
    │
    │ port 8080
    ▼
┌─────────────────┐     ┌─────────────────────────────┐
│  frontend       │     │  backend (internal)          │
│  overlay net    │     │  overlay net                 │
│                 │     │                              │
│  ┌───────────┐  │     │  ┌───────────┐               │
│  │   api.1   ├──┼─────┼─►│   db.1    │               │
│  └───────────┘  │     │  └───────────┘               │
└─────────────────┘     └─────────────────────────────┘
         ▲
         │ (not reachable from internet)
         db is only reachable via api
```

---

## 7. Network Troubleshooting

```bash
# Check which networks a service is connected to
docker service inspect web --format '{{json .Spec.TaskTemplate.Networks}}'

# Run a diagnostic container on an overlay network
docker run --rm -it \
  --network my-overlay \
  nicolaka/netshoot \
  bash

# Inside netshoot — test DNS
nslookup api
dig api

# Inside netshoot — test connectivity
curl http://api:8080/health
ping api

# Check IPVS rules on a node (run on a Swarm node)
nsenter --net=/var/run/docker/netns/ingress_sbox \
  ipvsadm -ln

# Inspect overlay network details
docker network inspect ingress
docker network inspect my-overlay
```

---

## 8. Hands-On Exercises

**Exercise 1 — Create an overlay network and verify connectivity**
```bash
docker network create --driver overlay --attachable demo-net

docker service create \
  --name server \
  --network demo-net \
  --replicas 1 \
  nginx:latest

# Run a client container on the same network
docker run --rm --network demo-net \
  busybox wget -qO- http://server

docker service rm server
docker network rm demo-net
```

**Exercise 2 — Observe the ingress routing mesh**
```bash
docker service create \
  --name mesh-test \
  --replicas 2 \
  --publish published=8080,target=80 \
  nginx:latest

docker service ps mesh-test
# Note which nodes the replicas are on

# Curl from ANY node in the cluster — all should respond
curl http://<node1-ip>:8080
curl http://<node2-ip>:8080
curl http://<node3-ip>:8080   # even nodes without a replica

docker service rm mesh-test
```

**Exercise 3 — Test service DNS resolution**
```bash
docker network create --driver overlay --attachable app-net

docker service create \
  --name backend \
  --network app-net \
  --replicas 3 \
  nginx:latest

# Inspect the VIP
docker service inspect backend --format '{{json .Endpoint.VirtualIPs}}'

# Test DNS from a container
docker run --rm --network app-net \
  busybox nslookup backend

docker service rm backend
docker network rm app-net
```

**Exercise 4 — Create an encrypted overlay network**
```bash
docker network create \
  --driver overlay \
  --opt encrypted \
  secure-net

docker service create \
  --name secure-app \
  --network secure-net \
  --replicas 2 \
  nginx:latest

docker network inspect secure-net | grep -i encrypt

docker service rm secure-app
docker network rm secure-net
```

**Exercise 5 — Deploy a stack with isolated frontend and backend networks**
```bash
cat > /tmp/netstack.yml << 'EOF'
version: "3.9"
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    networks:
      - frontend
    deploy:
      replicas: 2

  api:
    image: nginx:latest
    networks:
      - frontend
      - backend
    deploy:
      replicas: 1

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
    networks:
      - backend
    deploy:
      replicas: 1

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true
EOF

docker stack deploy -c /tmp/netstack.yml netdemo
docker stack services netdemo
docker network ls | grep netdemo
# Confirm backend network has internal=true
docker network inspect netdemo_backend | grep Internal
docker stack rm netdemo
```

---

## 9. Interview Q&A

**Q:** What is the difference between the ingress network and a user-defined overlay network in Docker Swarm?

Answer: The `ingress` network is automatically created by Swarm and is dedicated to the routing mesh — it carries traffic from externally published ports to service tasks. Every service with a published port is implicitly connected to the ingress network. User-defined overlay networks are created explicitly and are used for east-west (service-to-service) communication within the cluster. Services must be explicitly attached to user-defined overlay networks, and multiple isolated overlay networks can coexist for network segmentation.

---

**Q:** How does the ingress routing mesh allow any Swarm node to serve traffic for a service, even if that node has no running replica?

Answer: Every Swarm node runs an `ingress-sbox` — a dedicated network namespace containing IPVS (IP Virtual Server) rules. When a packet arrives on a published port, `iptables` redirects it into the ingress sandbox. IPVS then load-balances the connection across all healthy task IPs registered for that service on the `ingress` overlay network. Since the IPVS rules on every node reference the same set of task IPs, any node can forward traffic to any task, regardless of locality.

---

**Q:** What is VXLAN and why does Docker Swarm use it for overlay networks?

Answer: VXLAN (Virtual Extensible LAN) is a tunneling protocol that encapsulates Layer 2 Ethernet frames inside UDP packets, enabling containers on different physical hosts to communicate as if they share a LAN segment. Docker Swarm uses VXLAN because it works over any IP network (the physical underlay), scales to millions of virtual networks using 24-bit VNIs, and is implemented in the Linux kernel for high performance. Each overlay network gets a unique VNI, providing isolation between different overlay networks on the same physical infrastructure.

---

**Q:** What is a Virtual IP (VIP) in Swarm service discovery, and why is it preferred over DNS round robin?

Answer: A VIP is a stable IP address assigned to a service that does not change as tasks are created, updated, or removed. DNS lookups for the service name always return the same VIP, and the kernel's IPVS handles load balancing across the actual task IPs transparently. VIPs are preferred over DNSRR because many applications and HTTP clients cache DNS responses aggressively. With DNSRR, a client that caches the DNS response may continue sending all traffic to a single task IP even after tasks have been rescheduled or scaled. VIPs avoid this problem because the IP itself is stable — only the IPVS backends change.

---

**Q:** How do you prevent a database service from being directly reachable from the internet in a Swarm deployment?

Answer: Create the database service on an `internal` overlay network. An internal overlay network has no external routing — containers on it cannot reach the internet, and traffic from outside the overlay cannot reach containers on it. The application service (e.g., API) is attached to both a front-end overlay network (which has a published port) and the internal backend network. Only the API can reach the database via the internal network. This is declared in a Compose file with `internal: true` on the backend network definition, or with `--internal` when creating the network via CLI.
