# Docker Networking — Complete Guide

## Table of Contents
1. [How Docker Networking Works](#1-how-docker-networking-works)
2. [Default Networks](#2-default-networks)
3. [Custom Bridge Networks](#3-custom-bridge-networks)
4. [Docker DNS — Container Name Resolution](#4-docker-dns--container-name-resolution)
5. [Connecting Containers to Networks](#5-connecting-containers-to-networks)
6. [Overlay Networks (Swarm)](#6-overlay-networks-swarm)
7. [Inspecting and Troubleshooting Networks](#7-inspecting-and-troubleshooting-networks)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. How Docker Networking Works

Docker networking is built on the Linux kernel's network namespaces and virtual Ethernet pairs (veth). Each container gets its own network namespace — isolated from the host and other containers.

```
Host Network Stack
┌────────────────────────────────────────────────────┐
│                  Docker Host                       │
│                                                    │
│  ┌─────────────┐        ┌─────────────┐            │
│  │  Container A│        │  Container B│            │
│  │  eth0       │        │  eth0       │            │
│  │  172.17.0.2 │        │  172.17.0.3 │            │
│  └──────┬──────┘        └──────┬──────┘            │
│         │ veth pair             │ veth pair         │
│  ┌──────┴───────────────────────┴──────┐            │
│  │        docker0  (bridge)           │            │
│  │        172.17.0.1                  │            │
│  └─────────────────────────────────────┘            │
│                  │ NAT / iptables                   │
│            eth0 (host NIC)                         │
└────────────────────────────────────────────────────┘
```

Each container has:
- A virtual NIC (`eth0`) inside its own network namespace
- A matching `veth` interface attached to a bridge on the host side
- An IP address assigned by Docker's built-in IPAM

---

## 2. Default Networks

Docker creates three networks automatically when installed:

```bash
docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# 3f8a2b1c9d7e   bridge    bridge    local
# 1c2d3e4f5a6b   host      host      local
# 7a8b9c0d1e2f   none      null      local
```

### bridge (default)
- All containers started without `--network` join this network
- Containers can communicate by IP but NOT by name (no DNS on the default bridge)
- NAT is applied for outbound traffic; port mapping needed for inbound

### host
- Container shares the host's network namespace directly
- No isolation — container binds directly to host ports
- Best performance, but no port mapping needed (or possible)

### none
- Container has no network interface except loopback
- Completely network-isolated — useful for batch jobs or security-sensitive tasks

```bash
# Start a container with no network
docker run --rm --network none alpine ping 8.8.8.8
# ping: bad address '8.8.8.8'  ← no connectivity, as expected
```

---

## 3. Custom Bridge Networks

Custom bridge networks are the recommended way to connect containers. Unlike the default bridge, custom networks provide:
- **Automatic DNS resolution** — containers find each other by name
- **Better isolation** — only containers on the same network can communicate
- **On-the-fly connect/disconnect** — without restarting containers

```bash
# Create a custom bridge network
docker network create myapp-net

# Create with custom subnet and gateway
docker network create \
  --driver bridge \
  --subnet 192.168.100.0/24 \
  --gateway 192.168.100.1 \
  --ip-range 192.168.100.128/25 \
  myapp-net

# List all networks
docker network ls

# Inspect a network (see connected containers, subnet, gateway)
docker network inspect myapp-net

# Remove a network (all containers must be disconnected first)
docker network rm myapp-net

# Remove all unused networks
docker network prune
```

### Network Inspect Output (key fields)

```
docker network inspect myapp-net
[
  {
    "Name": "myapp-net",
    "Driver": "bridge",
    "IPAM": {
      "Config": [{ "Subnet": "192.168.100.0/24", "Gateway": "192.168.100.1" }]
    },
    "Containers": {
      "abc123": { "Name": "web",  "IPv4Address": "192.168.100.2/24" },
      "def456": { "Name": "db",   "IPv4Address": "192.168.100.3/24" }
    }
  }
]
```

---

## 4. Docker DNS — Container Name Resolution

On a custom network, Docker runs an embedded DNS server at `127.0.0.11`. Containers register their names automatically and can resolve each other using just the container name.

```
Custom Network: myapp-net
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌──────────────┐       ┌──────────────┐        │
│  │  web         │       │  db          │        │
│  │  172.18.0.2  │──────▶│  172.18.0.3  │        │
│  │              │  DNS  │  (postgres)  │        │
│  └──────────────┘       └──────────────┘        │
│       ▲  name: "db"                             │
│       │  resolves to 172.18.0.3                 │
│       │                                         │
│  ┌────┴─────────────────────────────────┐        │
│  │  Docker DNS  127.0.0.11              │        │
└──┴──────────────────────────────────────┴────────┘
```

```bash
# Start a database container on custom network
docker run -d \
  --name db \
  --network myapp-net \
  -e POSTGRES_PASSWORD=secret \
  postgres:16

# Start a web container on the same network
docker run -d \
  --name web \
  --network myapp-net \
  -e DB_HOST=db \
  myapp:latest

# web can reach db by name — no IP needed
# Inside web container:
docker exec web ping db
# PING db (172.18.0.3): 56 data bytes
# 64 bytes from 172.18.0.3: ...

docker exec web nslookup db
# Server:    127.0.0.11
# Address 1: 127.0.0.11
# Name:      db
# Address 1: 172.18.0.3
```

**Important:** The default bridge network does NOT support DNS name resolution. Always use a custom network for multi-container apps.

---

## 5. Connecting Containers to Networks

A container can be connected to multiple networks simultaneously.

```bash
# Connect at run time
docker run -d --name web --network frontend-net nginx

# Connect a running container to another network
docker network connect backend-net web

# Disconnect a running container from a network
docker network disconnect frontend-net web

# Assign a specific IP when connecting
docker network connect --ip 192.168.100.10 backend-net web

# Assign a network alias (reachable by alias name on that network)
docker network connect --alias webapp backend-net web

# Verify which networks a container is on
docker inspect web --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
```

### Multi-Network Architecture

```
frontend-net          backend-net
┌─────────────┐      ┌─────────────────────────┐
│  client     │      │  web        db           │
│  (browser)  │      │  nginx  ──▶ postgres     │
│       ──────┼──────┼──▶ web                   │
└─────────────┘      └─────────────────────────┘
                        web is on BOTH networks
                        db is on backend-net ONLY
                        client cannot reach db directly
```

---

## 6. Overlay Networks (Swarm)

Overlay networks span multiple Docker hosts. They are used exclusively in Docker Swarm (or via third-party plugins like Weave, Flannel).

```bash
# Initialize a Swarm (required before creating overlay networks)
docker swarm init --advertise-addr 192.168.1.10

# Create an overlay network
docker network create \
  --driver overlay \
  --attachable \
  --subnet 10.0.9.0/24 \
  myswarm-net

# Deploy a service on the overlay network
docker service create \
  --name web \
  --network myswarm-net \
  --replicas 3 \
  nginx

# Services on the same overlay network resolve each other by service name
# Overlay uses VXLAN encapsulation to tunnel L2 traffic over L3 (UDP 4789)
```

```
Swarm Overlay: myswarm-net (10.0.9.0/24)
┌──────────────────┐        ┌──────────────────┐
│   Node 1         │        │   Node 2         │
│  ┌────────────┐  │        │  ┌────────────┐  │
│  │ web task 1 │  │VXLAN   │  │ web task 2 │  │
│  │ 10.0.9.3   │◀─┼────────┼─▶│ 10.0.9.4   │  │
│  └────────────┘  │ UDP    │  └────────────┘  │
└──────────────────┘ 4789   └──────────────────┘
```

---

## 7. Inspecting and Troubleshooting Networks

```bash
# List all networks
docker network ls
docker network ls --filter driver=bridge

# Full inspect of a network
docker network inspect myapp-net

# Which networks is a container connected to?
docker inspect <container> --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'

# Test connectivity from inside a container
docker exec -it web ping db
docker exec -it web curl http://db:5432
docker exec -it web nslookup db

# Check iptables rules Docker created (host)
sudo iptables -L DOCKER -n -v

# Check bridge interfaces on host
ip link show type bridge
brctl show   # or: bridge link show

# Real-time network stats
docker stats --format "table {{.Name}}\t{{.NetIO}}"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run `docker network ls` and inspect each of the three default networks (bridge, host, none). Note the subnet, gateway, and any connected containers for each.

**Exercise 2:** Create a custom network called `lab-net` with subnet `10.10.10.0/24`. Start two alpine containers (`ping1` and `ping2`) on it. From `ping1`, run `ping ping2` — verify DNS works. Then try the same two containers on the default bridge — confirm DNS does NOT work.

**Exercise 3:** Start an `nginx` container on `lab-net`. Connect it to a second custom network called `admin-net`. Use `docker inspect` to confirm the container has two IP addresses, one per network.

**Exercise 4:** Run a `postgres:16` container named `mydb` on a custom network. Run a `python:3.11-alpine` container on the same network and install `psycopg2` inside it. Connect to `mydb` using the container name as the host. Confirm connection works.

**Exercise 5:** Use `docker network inspect` to find the gateway IP of your custom network. From a container, run `ip route` to confirm the default route points to that gateway. Then run `curl ifconfig.me` from the container to verify outbound NAT works.

---

## 9. Interview Q&A

**Q: What is the difference between the default bridge network and a custom bridge network?**
Answer: The default bridge network (`docker0`) is created automatically and does not support DNS name resolution between containers — they can only reach each other by IP. Custom bridge networks use Docker's embedded DNS server (127.0.0.11) so containers discover each other by name. Custom networks also provide better isolation (only members can communicate) and allow live connect/disconnect without restarting containers.

**Q: How does Docker DNS work, and where does it run?**
Answer: Docker runs an embedded DNS resolver at `127.0.0.11` inside every container connected to a custom network. When a container tries to resolve another container's name, the query goes to 127.0.0.11, which returns the target container's IP on the shared network. Docker registers each container's name (and any aliases) automatically when it joins the network. This only works on custom networks — the default bridge has no DNS.

**Q: Can a container be on multiple networks at the same time?**
Answer: Yes. Use `docker network connect` to attach a running container to additional networks. The container gets a separate IP address on each network. This is a common pattern for a proxy or API gateway that needs to sit between a public-facing network and a private backend network — it has one NIC facing each.

**Q: What is an overlay network and when do you need one?**
Answer: An overlay network spans multiple Docker hosts by encapsulating L2 Ethernet frames inside VXLAN packets (UDP port 4789). It is required in Docker Swarm when service replicas or tasks spread across different nodes need to communicate by name. On a single host, a bridge network is sufficient. Overlay networks require a Swarm or a key-value store like etcd/Consul.

**Q: Why should you avoid putting containers on the default bridge network in production?**
Answer: The default bridge lacks DNS resolution, so applications must hardcode IP addresses or use legacy `--link` flags (deprecated). It also has no isolation — every container on the host can reach every other container on the default bridge unless `icc=false` is explicitly set. Custom networks are isolated by default, support DNS, and are easy to manage — there is no reason to use the default bridge for production workloads.
