# Containers vs Virtual Machines — Complete Guide

## Table of Contents
1. [Architecture Comparison](#1-architecture-comparison)
2. [Linux Namespaces](#2-linux-namespaces)
3. [cgroups — Resource Control](#3-cgroups--resource-control)
4. [Performance Comparison](#4-performance-comparison)
5. [When to Use Which](#5-when-to-use-which)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Architecture Comparison

```
Virtual Machines:
┌──────────────────────────────────────────────────────┐
│                  Physical Hardware                    │
├──────────────────────────────────────────────────────┤
│              Hypervisor (VMware / KVM)                │
├────────────────────┬─────────────────────────────────┤
│     VM 1           │          VM 2                   │
│ ┌────────────────┐ │ ┌────────────────────────────┐  │
│ │   Guest OS     │ │ │         Guest OS           │  │
│ │  (Ubuntu 22)   │ │ │       (Windows Server)     │  │
│ ├────────────────┤ │ ├────────────────────────────┤  │
│ │    App + Deps  │ │ │        App + Deps          │  │
│ └────────────────┘ │ └────────────────────────────┘  │
└────────────────────┴─────────────────────────────────┘
Each VM: full OS = 1-4 GB RAM just for the OS

Containers:
┌──────────────────────────────────────────────────────┐
│                  Physical Hardware                    │
├──────────────────────────────────────────────────────┤
│                   Host OS + Kernel                    │
├──────────────────────────────────────────────────────┤
│                   Docker Daemon                       │
├────────────┬───────────────┬─────────────────────────┤
│Container 1 │  Container 2  │       Container 3       │
│ App + Deps │  App + Deps   │       App + Deps        │
│ (Ubuntu)   │  (Alpine)     │       (Debian)          │
└────────────┴───────────────┴─────────────────────────┘
Each container: shares host kernel = ~10-100 MB overhead
```

### Side-by-Side Comparison

| Feature | Virtual Machine | Container |
|---------|----------------|-----------|
| OS | Full OS per VM | Shares host kernel |
| Startup | 30 seconds – 5 minutes | < 1 second |
| Size | GBs (with OS) | MBs (just app layer) |
| Isolation | Hardware-level | Kernel-level (namespaces) |
| Density | ~10s of VMs per host | 100s of containers per host |
| Portability | Less (hypervisor-dependent) | Highly portable |
| Security | Stronger isolation | Weaker (shared kernel) |
| Boot time | Slow | Instant |

---

## 2. Linux Namespaces

Containers are isolated using Linux **namespaces** — they create the illusion of an isolated system.

```
┌────────────────────────────────────────────────┐
│            Linux Namespace Types               │
│                                                │
│  PID    → container has its own PID space      │
│           (pid 1 inside = your app, not init)  │
│                                                │
│  NET    → container has its own network stack  │
│           (eth0, lo, routing tables, ports)    │
│                                                │
│  MNT    → container has its own filesystem     │
│           (pivot_root to image filesystem)     │
│                                                │
│  UTS    → container has its own hostname       │
│                                                │
│  IPC    → container has its own shared memory  │
│           and message queues                   │
│                                                │
│  USER   → container can have its own UID/GID   │
│           (user namespaces — rootless Docker)  │
│                                                │
│  CGROUP → container has its own cgroup view    │
└────────────────────────────────────────────────┘
```

```bash
# See namespaces for a running container
docker run -d --name demo nginx
docker inspect demo --format '{{.State.Pid}}'
# e.g., PID = 12345

# View namespaces of that process
ls -la /proc/12345/ns/
# lrwxrwxrwx ipc -> ipc:[4026532234]
# lrwxrwxrwx net -> net:[4026532237]
# lrwxrwxrwx pid -> pid:[4026532236]
# etc.
```

---

## 3. cgroups — Resource Control

**cgroups (Control Groups)** limit the resources a container can use.

```bash
# Limit CPU and memory
docker run -d \
  --cpus="0.5" \
  --memory="256m" \
  --memory-swap="512m" \
  nginx

# CPU pinning — only use CPU 0 and 1
docker run -d --cpuset-cpus="0,1" nginx

# Verify limits on a running container
docker stats demo
# CONTAINER  CPU %   MEM USAGE / LIMIT
# demo       0.1%    22MB / 256MB
```

### What cgroups Control

| cgroup Subsystem | Controls |
|-----------------|---------|
| cpu | CPU shares and quotas |
| cpuset | Which CPUs/NUMA nodes |
| memory | RAM and swap limits |
| blkio | Block I/O rates |
| net_cls | Network packet tagging |
| pids | Number of processes |
| devices | Device access permissions |

---

## 4. Performance Comparison

```
App startup time:
  Bare metal:  ~50ms
  Container:   ~100ms (+ image pull if not cached)
  VM:          30,000ms (30 seconds minimum)

Memory overhead per instance:
  Bare metal:  app only
  Container:   app + ~5-50MB per container
  VM:          app + 512MB-4GB (OS)

10 instances of a Node.js app:
  Containers: 10 × 50MB = 500MB overhead
  VMs:        10 × 1GB  = 10GB overhead

Network latency:
  Bare metal:  baseline
  Container:   + ~0.1ms (virtual interface)
  VM:          + ~0.5-2ms (vNIC + hypervisor)
```

---

## 5. When to Use Which

### Use Containers When:

```
✅ Microservices — many small services, frequent deploys
✅ CI/CD pipelines — fast spin-up, throw away after testing
✅ Development environments — consistent across team
✅ Cloud-native apps — Kubernetes-based deployments
✅ Stateless apps — web servers, APIs, workers
✅ High density — pack more apps per server
```

### Use VMs When:

```
✅ Hard security boundaries needed — fintech, multi-tenant isolation
✅ Different kernels required — Windows + Linux on same host
✅ Full OS control needed — custom kernel modules
✅ Legacy apps — not containerizable
✅ Compliance requirements — some require VM-level isolation
✅ Long-running stateful services (sometimes)
```

### Use Both (Common Pattern):

```
Cloud Provider
    └── VM (EC2 instance)
          └── Docker (on the VM)
               ├── Container 1 (app)
               ├── Container 2 (worker)
               └── Container 3 (nginx)

VMs provide hardware isolation and security boundaries.
Containers provide app isolation and density on top of VMs.
```

---

## 6. Hands-On Exercises

**Exercise 1:** Run `docker run -it ubuntu bash` and inside it run `ps aux` and `ls /`. Compare to running those same commands outside the container. Notice PID 1 difference.

**Exercise 2:** Run two containers and show they're isolated: `docker run -d --name c1 nginx` and `docker run -d --name c2 nginx`. Run `docker exec c1 hostname` and `docker exec c2 hostname` — different hostnames, same host.

**Exercise 3:** Launch a container with resource limits: `docker run -d --memory=100m --cpus=0.25 nginx`. Use `docker stats` to watch it. Try to push it over memory with a script and observe OOM kill.

**Exercise 4:** Explore namespace isolation — start a container and from the host, run `ps aux | grep nginx`. Note the container's process is visible on the host, but from inside the container `ps aux` shows different PIDs (namespace effect).

**Exercise 5:** Run `docker system df` to see disk usage breakdown between images, containers, and volumes. Compare to a VM hypervisor's disk usage for a similar workload.

---

## 7. Interview Q&A

**Q: How are containers isolated from each other and from the host?**
Answer: Containers use Linux kernel features: namespaces for isolation (PID, NET, MNT, UTS, IPC, USER) and cgroups for resource limits. Namespaces make each container think it has its own process tree, network, filesystem, and hostname. cgroups prevent one container from consuming all CPU/RAM.

**Q: What is the key architectural difference between containers and VMs?**
Answer: VMs virtualize hardware — each VM runs a full OS with its own kernel, managed by a hypervisor. Containers virtualize the OS user space — multiple containers share the host kernel. This makes containers faster to start (ms vs minutes), lighter (MBs vs GBs), and denser, but with weaker isolation since a kernel exploit affects all containers.

**Q: What are Linux namespaces?**
Answer: Namespaces are a Linux kernel feature that creates isolated views of system resources. Each container gets its own: PID namespace (process IDs), NET namespace (network stack), MNT namespace (filesystem), UTS namespace (hostname), IPC namespace (inter-process communication), and optionally USER namespace (user IDs). From inside, the container appears to have a dedicated system.

**Q: What are cgroups?**
Answer: Control Groups (cgroups) are a Linux kernel feature that limits, accounts for, and isolates resource usage. Docker uses cgroups to enforce `--memory`, `--cpus`, `--blkio-weight` limits. Without cgroups, one container could exhaust all CPU or RAM on the host, starving other containers.

**Q: Can containers run on Windows?**
Answer: Windows containers (with Windows kernel) can run on Windows Server/Desktop. But most containers use Linux — on Windows, Docker Desktop runs these inside a lightweight Linux VM (WSL2). macOS also runs Linux containers inside a VM. Linux containers require a Linux kernel, so non-Linux hosts always use a thin Linux VM layer.
