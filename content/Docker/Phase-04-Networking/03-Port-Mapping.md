# Docker Port Mapping — Complete Guide

## Table of Contents
1. [How Port Mapping Works](#1-how-port-mapping-works)
2. [The -p Flag — Explicit Port Publishing](#2-the--p-flag--explicit-port-publishing)
3. [The -P Flag — Automatic Port Publishing](#3-the--p-flag--automatic-port-publishing)
4. [Binding to a Specific Interface](#4-binding-to-a-specific-interface)
5. [EXPOSE vs Publish — Key Distinction](#5-expose-vs-publish--key-distinction)
6. [Inspecting Published Ports](#6-inspecting-published-ports)
7. [Port Mapping in Production Patterns](#7-port-mapping-in-production-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. How Port Mapping Works

Port mapping (also called port publishing) connects a port on the Docker host to a port inside a container. Without it, container ports are not reachable from outside the container's network namespace.

```
External Client
    │
    │  HTTP request to 203.0.113.5:8080
    ▼
┌───────────────────────────────────────┐
│  Docker Host  203.0.113.5             │
│                                       │
│  iptables DNAT rule:                  │
│  0.0.0.0:8080  ──▶  172.17.0.2:80    │
│                                       │
│  ┌──────────────────────────────┐     │
│  │  Container                  │     │
│  │  172.17.0.2                 │     │
│  │  nginx listens on port 80   │     │
│  └──────────────────────────────┘     │
└───────────────────────────────────────┘

Docker inserts an iptables DNAT rule for each -p mapping.
The kernel rewrites the destination IP+port before the packet
reaches the container.
```

Docker uses `iptables` (or `nftables`) rules and the `docker-proxy` process to implement port forwarding. You can verify:

```bash
sudo iptables -t nat -L DOCKER -n -v
# Chain DOCKER
# target  prot  opt  source      destination
# DNAT    tcp   --   0.0.0.0/0   0.0.0.0/0   tcp dpt:8080 to:172.17.0.2:80
```

---

## 2. The -p Flag — Explicit Port Publishing

`-p` (lowercase) lets you specify exactly which host port maps to which container port.

### Syntax forms

```
-p hostPort:containerPort            TCP (default)
-p hostPort:containerPort/tcp        TCP explicit
-p hostPort:containerPort/udp        UDP
-p hostIP:hostPort:containerPort     Bind to specific host interface
-p hostPort                          Map hostPort → same containerPort
```

### Examples

```bash
# Map host port 8080 to container port 80 (TCP)
docker run -d -p 8080:80 nginx

# Map port 5432 on host to PostgreSQL inside container
docker run -d -p 5432:5432 postgres:16

# Multiple ports in one command
docker run -d \
  -p 80:80 \
  -p 443:443 \
  nginx

# UDP port mapping (e.g. DNS server)
docker run -d -p 53:53/udp \
  --name dns \
  mycoredns:latest

# Map both TCP and UDP for the same port
docker run -d \
  -p 5000:5000/tcp \
  -p 5000:5000/udp \
  myapp:latest

# Same container port, different host ports (two replicas on same host)
docker run -d -p 8081:80 --name web1 nginx
docker run -d -p 8082:80 --name web2 nginx
```

### Port Ranges

```bash
# Map a range of ports (host 8000-8005 → container 8000-8005)
docker run -d -p 8000-8005:8000-8005 myapp:latest

# Ranges must be equal in size
# docker run -d -p 9000-9002:8000-8005  ← ERROR: ranges must match
```

---

## 3. The -P Flag — Automatic Port Publishing

`-P` (uppercase) publishes ALL ports that the image declares with `EXPOSE`, mapping each to a random ephemeral port on the host (typically in the 32768–60999 range).

```bash
# Automatically publish all exposed ports
docker run -d -P nginx
# nginx exposes port 80 → mapped to e.g. 0.0.0.0:32768->80/tcp

# See which random ports were assigned
docker port <container_id>
# 80/tcp -> 0.0.0.0:32768

docker ps
# PORTS
# 0.0.0.0:32768->80/tcp

# Useful for local dev or testing — you don't care which host port is used
curl http://localhost:32768
```

### -p vs -P Comparison

```
-p (lowercase):
  - You specify exactly which host port to use
  - Deterministic: same port every time
  - Required for production (load balancer expects a known port)

-P (uppercase):
  - Docker picks a random host port from the ephemeral range
  - Non-deterministic: different port after container restart
  - Convenient for local testing, CI pipelines, dynamic environments
  - Only publishes ports declared with EXPOSE in the Dockerfile
```

---

## 4. Binding to a Specific Interface

By default, Docker binds to `0.0.0.0` — all host interfaces. You can restrict a published port to a single interface for security.

```bash
# Bind only to localhost — external clients cannot reach this port
docker run -d -p 127.0.0.1:5432:5432 postgres:16

# Bind to a specific LAN IP (e.g. internal network interface only)
docker run -d -p 192.168.1.50:8080:80 nginx

# Bind to all interfaces (default — explicit version)
docker run -d -p 0.0.0.0:8080:80 nginx
```

```
Scenario: Database should not be reachable from the internet

Host NICs:
  eth0: 203.0.113.5  (public internet)
  eth1: 192.168.1.50 (private LAN)

docker run -d -p 192.168.1.50:5432:5432 postgres:16
                 ──────────────
                       │
                  Only LAN clients
                  on 192.168.1.x
                  can connect.

docker run -d -p 127.0.0.1:5432:5432 postgres:16
                 ─────────────
                       │
                  Only processes on
                  THIS host can connect
                  (e.g. an app container
                  using host networking,
                  or a local tool).
```

---

## 5. EXPOSE vs Publish — Key Distinction

`EXPOSE` and `-p`/`-P` are often confused. They serve different purposes.

```
EXPOSE (Dockerfile instruction):
  - Documents which port the service listens on inside the container
  - Does NOT open any firewall rule
  - Does NOT make the port accessible from outside the container
  - Acts as metadata / developer documentation
  - Enables -P to know which ports to auto-publish

-p / -P (docker run flags):
  - Actually publishes the port by creating iptables rules
  - Opens the port for external access
  - Required for any external connectivity
```

### Dockerfile example

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Documents that the app listens on 3000
# Does NOT publish it — just a label
EXPOSE 3000

CMD ["node", "server.js"]
```

```bash
# EXPOSE alone — port 3000 is NOT accessible from outside
docker run -d myapp:latest
curl http://localhost:3000    # ← connection refused from host

# Must publish explicitly with -p
docker run -d -p 3000:3000 myapp:latest
curl http://localhost:3000    # ← works

# Or publish automatically (EXPOSE enables this)
docker run -d -P myapp:latest
docker port <id>   # → 3000/tcp -> 0.0.0.0:32768
```

### Summary table

| | EXPOSE in Dockerfile | -p flag at runtime | -P flag at runtime |
|--|---------------------|--------------------|-------------------|
| Documents port | Yes | No | No |
| Creates iptables rule | No | Yes | Yes |
| Port accessible externally | No | Yes | Yes |
| Port choice | N/A | You decide | Docker decides (random) |
| Enables `-P` auto-publish | Yes | N/A | Reads from EXPOSE |

---

## 6. Inspecting Published Ports

```bash
# Quick view — ports column
docker ps
# PORTS
# 0.0.0.0:8080->80/tcp, 0.0.0.0:8443->443/tcp

# All port mappings for a container
docker port mycontainer
# 80/tcp  -> 0.0.0.0:8080
# 443/tcp -> 0.0.0.0:8443

# Lookup a specific container port's host mapping
docker port mycontainer 80
# 0.0.0.0:8080

# Full inspect — NetworkSettings.Ports
docker inspect mycontainer \
  --format '{{json .NetworkSettings.Ports}}' | python3 -m json.tool
# {
#   "80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "8080" }],
#   "443/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "8443" }]
# }

# List all ports in use by Docker on the host
docker ps --format "{{.Ports}}"

# Check from the host what is listening
ss -tlnp | grep docker
```

---

## 7. Port Mapping in Production Patterns

### Reverse Proxy Pattern (recommended)

```
Internet
   │
   ▼
nginx / Traefik / Caddy   (port 80/443 on host)
   │
   │ internal Docker network (no external ports)
   ├──▶ app1:3000
   ├──▶ app2:3000
   └──▶ api:8080

Only the reverse proxy publishes ports to the host.
Backend containers use internal DNS, zero external ports.
```

```bash
# Only the proxy has host port mappings
docker run -d -p 80:80 -p 443:443 --network frontend \
  --name proxy nginx-proxy

# App containers expose nothing to the host
docker run -d --network frontend --name app1 myapp:latest
docker run -d --network frontend --name app2 myapp:latest
```

### Docker Compose port mapping syntax

```yaml
services:
  web:
    image: nginx
    ports:
      - "8080:80"          # host:container (string — quoted to avoid YAML octal)
      - "127.0.0.1:443:443"  # interface:host:container
      - "3000"             # same as 3000:3000

  db:
    image: postgres:16
    # No ports: section — not accessible from outside Docker network
    expose:
      - "5432"             # documents port, no host mapping
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run `nginx` with `-p 8080:80`. Confirm with `docker port` and `curl http://localhost:8080`. Then run a second nginx with `-p 8081:80`. Verify both are reachable on different host ports. Show that they share the same container port 80.

**Exercise 2:** Run nginx with `-P` (uppercase). Use `docker port` to find the random host port. Access it with curl. Restart the container and note the port changes. This illustrates why `-P` is unsuitable for production load-balancer configs.

**Exercise 3:** Run `postgres:16` with `-p 127.0.0.1:5432:5432`. Confirm that `psql -h 127.0.0.1 -U postgres` works from the host. Then try to connect from another container using the host's public IP — confirm it is blocked. Contrast with `0.0.0.0:5432:5432`.

**Exercise 4:** Write a minimal Dockerfile for a Python Flask app that includes `EXPOSE 5000`. Build the image. Run it without `-p` and confirm the port is not reachable. Run it with `-p 5000:5000` and confirm it is. Then run with `-P` and find the assigned port.

**Exercise 5:** Inspect the iptables NAT table on a Linux host running a published container: `sudo iptables -t nat -L DOCKER -n -v`. Identify the DNAT rule for your container's port. Stop the container and re-inspect — confirm the rule is removed automatically.

---

## 9. Interview Q&A

**Q: What is the difference between EXPOSE in a Dockerfile and -p at runtime?**
Answer: `EXPOSE` is documentation — it records which port the containerized process listens on, but creates no firewall rules and makes the port reachable by nothing outside the container's network. `-p` (or `-P`) is the runtime flag that actually publishes the port by creating an iptables DNAT rule that forwards traffic from a host port into the container. You need `-p` for external connectivity; `EXPOSE` alone does nothing for access.

**Q: What does -p 127.0.0.1:5432:5432 do and why would you use it?**
Answer: It binds the host side of the port mapping to the loopback interface (`127.0.0.1`) only. This means only processes running on the Docker host itself can connect to port 5432 — external network clients and containers using bridge networking cannot reach it. This is used to expose a database or admin port to local tooling (like a DBA GUI on the same machine) without making it reachable from the network, reducing the attack surface.

**Q: What happens when two containers try to publish the same host port?**
Answer: The second container fails to start with a "port is already allocated" error. Host ports are exclusive — only one process can listen on a given IP:port combination. The solution is to use different host port numbers (`-p 8081:80` and `-p 8082:80`) or put containers behind a reverse proxy so only the proxy exposes ports on the host.

**Q: How does Docker implement port mapping internally?**
Answer: Docker inserts iptables DNAT (Destination NAT) rules in the `DOCKER` chain of the `nat` table. When a packet arrives on the host port, the kernel rewrites the destination to the container's IP and port before routing it. Docker also starts a userspace `docker-proxy` process per mapped port as a fallback for loopback traffic that iptables does not intercept. You can inspect the rules with `sudo iptables -t nat -L DOCKER -n -v`.

**Q: Why should backend containers (like databases) not publish ports to the host in production?**
Answer: Publishing a database port to the host means it is reachable from any process on the host or (if bound to 0.0.0.0) from the network. The correct pattern is to place frontend and backend containers on the same Docker network — only the reverse proxy or API gateway publishes ports to the host. Backend containers are reachable internally by DNS name. This follows the principle of least exposure: the database is never accessible from outside the Docker network, eliminating an entire class of network-based attack vectors.
