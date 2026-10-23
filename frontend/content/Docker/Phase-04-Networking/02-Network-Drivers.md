# Docker Network Drivers — Complete Guide

## Table of Contents
1. [Network Driver Overview](#1-network-driver-overview)
2. [Bridge Driver](#2-bridge-driver)
3. [Host Driver](#3-host-driver)
4. [Overlay Driver](#4-overlay-driver)
5. [Macvlan Driver](#5-macvlan-driver)
6. [None Driver](#6-none-driver)
7. [Choosing the Right Driver](#7-choosing-the-right-driver)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Network Driver Overview

Docker networking is pluggable. A network driver is the component that implements how packets move between containers, the host, and external networks. Docker ships five built-in drivers; third-party plugins (Weave, Calico, Cilium) are also available.

```
┌──────────────────────────────────────────────────────────────┐
│                     Docker Engine                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │               Network Plugin API (libnetwork)       │     │
│  └─────┬──────┬──────┬──────────┬─────────────────────┘     │
│        │      │      │          │                            │
│   bridge  host  overlay  macvlan  none                       │
│        │      │      │          │                            │
│   Linux  Host   VXLAN  Direct    loopback                    │
│   bridge  NS    tunnel  MAC addr  only                       │
└──────────────────────────────────────────────────────────────┘
```

| Driver | Scope | Multi-host | DNS | Use Case |
|--------|-------|-----------|-----|---------|
| bridge | local | No | Yes (custom) | Default single-host container comms |
| host | local | No | Host's DNS | Max-performance, no isolation |
| overlay | swarm | Yes | Yes | Swarm services across nodes |
| macvlan | local | No (L2 only) | No | Legacy apps, direct LAN access |
| none | local | No | No | Isolated batch jobs, security |

---

## 2. Bridge Driver

The bridge driver creates a software-defined Layer 2 switch (Linux bridge) on the host. All containers on the same bridge can communicate; traffic to other networks is routed through the bridge and NAT'd.

### How it works

```
Host kernel
┌───────────────────────────────────────────┐
│                                           │
│  Container A (172.18.0.2)                 │
│  └─ eth0 ──── veth0a ──┐                  │
│                         │                 │
│  Container B (172.18.0.3)                 │
│  └─ eth0 ──── veth0b ──┤                  │
│                         │                 │
│                  ┌──────▼──────┐          │
│                  │  br-abc123  │          │
│                  │  172.18.0.1 │          │
│                  └──────┬──────┘          │
│                         │ iptables / NAT  │
│                      eth0 (host)          │
│                      203.0.113.5          │
└───────────────────────────────────────────┘
```

### Configuration Options

```bash
# Create a bridge network with all options
docker network create \
  --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  --opt com.docker.network.bridge.name=mybridge0 \
  --opt com.docker.network.bridge.enable_icc=true \
  --opt com.docker.network.bridge.enable_ip_masquerade=true \
  --opt com.docker.network.driver.mtu=1500 \
  mybridge-net

# Disable inter-container communication (containers cannot talk to each other)
docker network create \
  --opt com.docker.network.bridge.enable_icc=false \
  isolated-net

# Inspect bridge-specific info
docker network inspect mybridge-net \
  --format '{{json .Options}}' | python3 -m json.tool
```

### Key Bridge Options

| Option | Default | Description |
|--------|---------|-------------|
| `enable_icc` | true | Allow container-to-container communication |
| `enable_ip_masquerade` | true | NAT outbound traffic via host IP |
| `bridge.name` | auto (br-xxxx) | Custom name for the Linux bridge interface |
| `driver.mtu` | 1500 | MTU for the bridge interface |

---

## 3. Host Driver

The host driver removes all network isolation. The container process binds directly to the host's network interfaces.

```
With bridge driver:
  Container eth0 ──veth──▶ docker0 bridge ──NAT──▶ host eth0
  Container listens on port 80 inside its namespace
  Host maps host:8080 → container:80

With host driver:
  Container runs in HOST network namespace
  Container listens on host eth0 directly on port 80
  No port mapping needed — or possible
```

```bash
# Run nginx directly on host network (port 80 goes live on the host)
docker run -d --network host nginx

# Verify: nginx is bound to host interface, not a container IP
ss -tlnp | grep :80
# LISTEN  0  511  0.0.0.0:80  0.0.0.0:*  users:(("nginx",...))

# Host network is Linux-only; on Mac/Windows it uses a VM layer
# Not useful for true host-network behavior on non-Linux
```

### When to use host networking

```
Good fit:
  - High-performance networking (eliminates NAT overhead)
  - Applications that need to bind to many dynamic ports (FTP passive mode)
  - Network monitoring tools that must see host interfaces
  - When you need the lowest possible latency

Avoid when:
  - You need port isolation between containers
  - Running multiple instances of the same app on the same host
  - You need portability across platforms (Mac/Windows behave differently)
```

---

## 4. Overlay Driver

The overlay driver creates a distributed network that spans multiple Docker hosts. It uses VXLAN (Virtual Extensible LAN) to encapsulate L2 frames inside UDP packets, tunneling them over the existing L3 infrastructure.

```
Swarm Cluster — overlay network "myapp-overlay" (10.0.1.0/24)

Node 1 (192.168.1.10)          Node 2 (192.168.1.11)
┌─────────────────────┐        ┌─────────────────────┐
│  service task A     │        │  service task B     │
│  10.0.1.3           │        │  10.0.1.4           │
│  └── vxlan0 ────────┼────────┼──── vxlan0          │
│                     │UDP4789 │                     │
│  eth0: 192.168.1.10 │◀──────▶│ eth0: 192.168.1.11  │
└─────────────────────┘        └─────────────────────┘

VXLAN header wraps the original L2 frame:
[ Outer IP | UDP | VXLAN header | Inner Ethernet | Inner IP | Payload ]
```

```bash
# Requires an active Swarm
docker swarm init --advertise-addr <manager-ip>

# Join a worker (run on worker node, using token from swarm init output)
docker swarm join --token <token> <manager-ip>:2377

# Create an attachable overlay network (attachable = standalone containers can use it too)
docker network create \
  --driver overlay \
  --attachable \
  --subnet 10.0.1.0/24 \
  myapp-overlay

# Deploy a stack using the overlay network
# docker-compose.yml services will share the overlay automatically
docker stack deploy -c docker-compose.yml mystack

# Services on the same overlay resolve by service name
# Docker provides a VIP (virtual IP) per service for load balancing across replicas
docker service inspect mystack_web --format '{{json .Endpoint.VirtualIPs}}'
```

### Overlay Ports to Allow in Firewall

```
TCP 2377   — Swarm management (between manager nodes)
TCP/UDP 7946 — Container network discovery (gossip)
UDP 4789   — VXLAN data plane (overlay traffic)
```

---

## 5. Macvlan Driver

The macvlan driver assigns each container its own MAC address and connects it directly to the physical network. The container appears as a first-class device on the LAN — no NAT, no bridge, no port mapping.

```
Physical LAN: 10.0.0.0/24

                Router
                10.0.0.1
                   │
          ─────────┼─────────
          │                 │
      host eth0          (other LAN devices)
      10.0.0.50
          │
   ┌──────┴──────────────────┐
   │      macvlan (Docker)   │
   │                         │
   │  Container A  Container B│
   │  MAC: aa:bb:..  cc:dd:.. │
   │  IP: 10.0.0.51  10.0.0.52│
   └─────────────────────────┘
   Containers are peers on the physical LAN
```

```bash
# Create a macvlan network (parent = host physical interface)
docker network create \
  --driver macvlan \
  --subnet 10.0.0.0/24 \
  --gateway 10.0.0.1 \
  --ip-range 10.0.0.192/26 \
  --opt parent=eth0 \
  macvlan-net

# Run a container with a specific LAN IP
docker run -d \
  --network macvlan-net \
  --ip 10.0.0.200 \
  --name legacy-app \
  mylegacyapp:latest

# Macvlan 802.1q trunk (VLAN-tagged sub-interface)
docker network create \
  --driver macvlan \
  --subnet 192.168.30.0/24 \
  --gateway 192.168.30.1 \
  --opt parent=eth0.30 \
  macvlan-vlan30
```

### Macvlan caveats

```
- The host itself CANNOT communicate with macvlan containers by default
  (Linux kernel restriction: macvlan parent cannot receive from sub-interfaces)
  Workaround: create a macvlan interface on the host too

- Requires promiscuous mode on the NIC (may not be available in cloud VMs)
- IP management is manual — Docker's IPAM assigns IPs but you must
  ensure no overlap with existing LAN devices
```

---

## 6. None Driver

The none driver gives the container a loopback interface only. No external connectivity whatsoever.

```bash
# Completely isolated container
docker run -d \
  --name isolated-job \
  --network none \
  myprocessor:latest process --input /data/file.csv

# Verify no external interfaces inside the container
docker exec isolated-job ip link show
# 1: lo: <LOOPBACK,UP> ...
# (no eth0, no other interfaces)

# Use cases:
#   - Batch processing jobs that need zero network attack surface
#   - Security-sensitive data processing
#   - Unit test environments where networking is irrelevant
#   - Containers that communicate only via shared volumes
```

---

## 7. Choosing the Right Driver

```
Decision tree:

Single host?
├── Yes → bridge (custom network, DNS included)
│         host (only if max performance + Linux)
│         macvlan (only if legacy app needs LAN IP)
│         none (no network needed)
└── No (multi-host) → overlay (Docker Swarm)
                      macvlan (if L2 adjacency across hosts)
                      3rd party: Calico / Cilium / Weave

Common patterns:
  Web app + DB on same host          → bridge (custom network)
  Nginx on host port 80, max perf    → host
  Legacy app that needs a real LAN IP → macvlan
  Microservices in Swarm, N nodes    → overlay
  Batch job, no network needed       → none
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a custom bridge network with ICC disabled (`enable_icc=false`). Start two containers on it. Verify that they cannot ping each other despite being on the same network. This demonstrates how to add network-level isolation within a single network.

**Exercise 2:** Start an nginx container with `--network host`. Confirm that port 80 appears on the host with `ss -tlnp` and that you can curl `http://localhost` directly. Compare with a bridge-mode nginx where you need `-p 80:80`.

**Exercise 3:** If you have two Linux VMs or machines, initialize a Docker Swarm across them. Create an overlay network with `--attachable`. Run a standalone container on each node attached to the overlay. Verify that the container on node 1 can ping the container on node 2 by name.

**Exercise 4:** On a Linux host with a physical NIC, create a macvlan network using your LAN subnet. Start a container with an IP in the same subnet. From another device on your LAN, ping the container IP directly — no port mapping needed.

**Exercise 5:** Use `docker network inspect` on a bridge, overlay (if available), and macvlan network. Compare the `Options`, `IPAM.Config`, and `Driver` fields. Write a one-line summary of the key difference visible in the inspect output for each driver.

---

## 9. Interview Q&A

**Q: What is the difference between bridge and overlay network drivers?**
Answer: Bridge is a single-host driver that creates a Linux software bridge. Containers on the same bridge communicate directly; traffic to other networks goes through NAT. Overlay is a multi-host driver that uses VXLAN encapsulation to tunnel L2 traffic over L3 between Docker Swarm nodes. Overlay requires Swarm (or a key-value store) for distributed state. Bridge is faster on a single host; overlay is necessary when containers are distributed across nodes.

**Q: When would you use the macvlan driver instead of bridge?**
Answer: Use macvlan when an application requires a real MAC address and IP on the physical LAN — for example, a legacy network appliance that must be reachable from the broader network without NAT, or an app that listens on a specific LAN IP that must not change. Macvlan containers appear as independent hosts on the LAN. The downside is that the host cannot communicate with macvlan containers by default due to a Linux kernel restriction.

**Q: What ports must be open in a firewall for overlay networking?**
Answer: TCP 2377 for Swarm cluster management traffic between managers. TCP and UDP 7946 for container network discovery (the gossip protocol). UDP 4789 for VXLAN data-plane traffic that carries the actual overlay packets. All three must be open between all Swarm nodes for overlay networking to function correctly.

**Q: What does `--attachable` mean when creating an overlay network?**
Answer: By default, overlay networks created with `docker network create` can only be used by Swarm services (`docker service create`). Adding `--attachable` allows standalone containers (`docker run`) to be connected to the overlay network directly. This is useful in hybrid setups where you need both services and standalone containers on the same overlay, or for debugging by running a test container alongside swarm services.

**Q: Why is host networking not portable across Mac and Windows?**
Answer: On Linux, `--network host` gives the container direct access to the host's kernel network stack. On macOS and Windows, Docker runs inside a lightweight Linux VM (HyperKit/WSL2). `--network host` connects the container to the VM's network namespace, not the Mac/Windows host's interface. So port bindings and interface visibility behave differently. Production code that relies on `--network host` should document the Linux-only requirement explicitly.
