# Runtime Security and Security Best Practices — Complete Guide

## Table of Contents
1. [Defense in Depth Model](#1-defense-in-depth-model)
2. [seccomp Profiles](#2-seccomp-profiles)
3. [AppArmor Profiles](#3-apparmor-profiles)
4. [Privileged Mode and Its Dangers](#4-privileged-mode-and-its-dangers)
5. [Network Security](#5-network-security)
6. [Supply Chain and Image Trust](#6-supply-chain-and-image-trust)
7. [Security Hardening Checklist](#7-security-hardening-checklist)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Defense in Depth Model

Container security is not a single control — it is a stack of overlapping layers. Each layer limits what a compromised container can do.

```
Defense in depth — container security layers:
  ┌────────────────────────────────────────────────────────────────┐
  │  Layer 7: Image supply chain (signed, scanned, pinned tags)   │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 6: Secrets management (no secrets in ENV or layers)    │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 5: Network policies (container-to-container isolation) │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 4: Read-only filesystem + minimal image (distroless)   │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 3: Linux capabilities (--cap-drop=ALL)                 │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 2: seccomp / AppArmor (syscall + MAC restrictions)     │
  ├────────────────────────────────────────────────────────────────┤
  │  Layer 1: Non-root user + no-new-privileges                   │
  └────────────────────────────────────────────────────────────────┘
  Host kernel (shared by all containers)

  Each layer is independently enforceable.
  Compromise of one layer is contained by the others.
```

---

## 2. seccomp Profiles

seccomp (Secure Computing Mode) is a Linux kernel feature that restricts which system calls a process can make. Docker applies a default seccomp profile that blocks ~44 dangerous syscalls. You can apply a custom profile to be even more restrictive.

```
Syscall restriction model:
  Application code
        │
        │  calls libc (open, read, write, connect, ...)
        ▼
  seccomp profile ──▶ ALLOWED syscalls ──▶ kernel executes
                 └──▶ BLOCKED syscalls ──▶ EPERM / SIGKILL

  Default Docker profile blocks (examples):
    keyctl, process_vm_readv, ptrace, reboot,
    mount, pivot_root, syslog, clock_settime,
    create_module, delete_module, ...
```

### Applying the Default Profile (Explicit)

```bash
# Docker applies a default seccomp profile automatically.
# To be explicit (same as default):
docker run -d \
  --security-opt seccomp=/etc/docker/seccomp.json \
  myapp:latest

# To disable seccomp entirely (NOT recommended for production):
docker run -d \
  --security-opt seccomp=unconfined \
  myapp:latest
```

### Writing a Custom seccomp Profile

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": [
        "accept4", "bind", "brk", "close", "connect",
        "epoll_create1", "epoll_ctl", "epoll_wait",
        "exit", "exit_group", "fcntl", "fstat",
        "futex", "getpid", "getuid", "listen",
        "mmap", "mprotect", "munmap", "nanosleep",
        "open", "openat", "read", "recvfrom",
        "sendto", "set_tid_address", "setuid",
        "socket", "write"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

```bash
# Apply custom profile
docker run -d \
  --security-opt seccomp=./my-seccomp.json \
  -p 3000:3000 \
  myapp:latest
```

### Generating a Profile from Strace

```bash
# Run container with strace to capture all syscalls actually used
docker run --rm --security-opt seccomp=unconfined \
  --cap-add SYS_PTRACE \
  myapp:latest \
  strace -ff -e trace=all node server.js 2>&1 | \
  grep -oP 'syscall_\K[a-z_]+' | sort -u

# Use the output to whitelist only those syscalls in your profile
```

---

## 3. AppArmor Profiles

AppArmor is a Linux Mandatory Access Control (MAC) system. It restricts what files a process can access, which capabilities it can use, and what network operations it can perform — based on a named profile.

```
AppArmor enforcement model:
  ┌─────────────────────────────────────────────────────────────┐
  │  AppArmor profile: docker-nginx                            │
  │                                                             │
  │  Allow:  /var/log/nginx/** rw                              │
  │  Allow:  /etc/nginx/** r                                   │
  │  Allow:  network tcp                                       │
  │  Deny:   /etc/shadow r        ← cannot read shadow file    │
  │  Deny:   /proc/sys/kernel/**  ← cannot modify kernel params│
  │  Deny:   capability sys_admin ← cannot be root-like        │
  └─────────────────────────────────────────────────────────────┘
```

### Docker's Default AppArmor Profile

Docker automatically applies the `docker-default` AppArmor profile on systems where AppArmor is enabled (Ubuntu, Debian).

```bash
# Verify AppArmor is active
aa-status

# Check which profile is applied to a running container
docker inspect <container_id> --format='{{.HostConfig.SecurityOpt}}'

# Run with Docker's default (explicit)
docker run -d --security-opt apparmor=docker-default nginx:alpine

# Run with no AppArmor profile (NOT recommended)
docker run -d --security-opt apparmor=unconfined nginx:alpine
```

### Custom AppArmor Profile

```
# /etc/apparmor.d/docker-myapp
#include <tunables/global>

profile docker-myapp flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  network tcp,
  network udp,

  /app/** r,
  /app/server.js r,
  /tmp/** rw,
  /run/secrets/* r,

  deny /etc/shadow r,
  deny /proc/sys/kernel/** rw,
  deny @{PROC}/*/mem rw,
  deny capability sys_admin,
  deny capability net_admin,
}
```

```bash
# Load the profile
sudo apparmor_parser -r /etc/apparmor.d/docker-myapp

# Apply to container
docker run -d \
  --security-opt apparmor=docker-myapp \
  -p 3000:3000 \
  myapp:latest
```

---

## 4. Privileged Mode and Its Dangers

`--privileged` gives a container nearly all Linux capabilities and disables seccomp, AppArmor, and capability restrictions. It is the most dangerous Docker flag and should be considered equivalent to giving the container root access to the host.

```
Privileged container vs host:
  Normal container:
    ● Limited capabilities (~14 of 41)
    ● seccomp profile applied
    ● AppArmor profile applied
    ● Cannot see host's /proc, /sys fully
    ● Cannot load kernel modules

  --privileged container:
    ● ALL 41 capabilities
    ● seccomp disabled
    ● AppArmor disabled
    ● Full /dev access (can mount host filesystems)
    ● Can load/unload kernel modules
    ● Effectively root on the host

  Escape from privileged container:
    docker run --privileged ubuntu bash
    # Inside:
    mkdir /mnt/host && mount /dev/sda1 /mnt/host
    chroot /mnt/host  → you are now on the host
```

### When --privileged Is (Rarely) Justified

```bash
# Only legitimate use cases:
# 1. Docker-in-Docker (DinD) for CI builds — prefer rootless alternatives
# 2. System-level tools (e.g., Wireshark, perf) — not for application containers
# 3. Kernel module loading — use dedicated tooling instead

# Safer alternatives to --privileged:
# Add only the specific capability you need:
docker run --cap-add SYS_PTRACE myapp    # for debuggers
docker run --cap-add NET_ADMIN myapp     # for network tools

# Grant device access explicitly instead of full /dev:
docker run --device /dev/snd myapp       # just the sound device
```

### Resource Limits (Preventing DoS)

Unconstrained containers can consume all host resources — a form of attack or accidental DoS:

```bash
# CPU and memory limits
docker run -d \
  --cpus="1.5" \
  --memory="512m" \
  --memory-swap="512m" \
  --pids-limit=100 \
  -p 3000:3000 \
  myapp:latest
```

```yaml
# Docker Compose resource limits
services:
  api:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 128M
```

---

## 5. Network Security

By default, containers on the same Docker network can communicate with each other freely. Network isolation is an important security layer.

```
Default Docker networking risk:
  ┌──────────────────────────────────────────────────────────┐
  │  bridge network (default)                                │
  │                                                          │
  │  [frontend] ←──────────────── can reach ──▶ [database]  │
  │  [api]      ←──────────────── can reach ──▶ [database]  │
  │  [worker]   ←──────────────── can reach ──▶ [database]  │
  │  All containers can talk to all containers               │
  └──────────────────────────────────────────────────────────┘

Segmented networking (best practice):
  ┌──────────────────────────────────────────────────────────┐
  │  frontend-net         │  backend-net                     │
  │  [frontend]           │  [api] ←───────▶ [database]     │
  │       │               │   ▲                              │
  │       └───── can reach api only ─────────┘               │
  │  frontend cannot reach database directly                 │
  └──────────────────────────────────────────────────────────┘
```

### Network Segmentation in Compose

```yaml
version: "3.8"

services:
  frontend:
    image: nginx:alpine
    networks:
      - frontend-net
    ports:
      - "80:80"

  api:
    image: myapi:latest
    networks:
      - frontend-net
      - backend-net

  database:
    image: postgres:15
    networks:
      - backend-net
    # NOT on frontend-net — frontend cannot reach it

networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
    internal: true   # no outbound internet access from backend
```

---

## 6. Supply Chain and Image Trust

### Pin Image Digests

Tags like `nginx:latest` are mutable — the image they point to can change. Digest pinning is immutable.

```dockerfile
# Mutable — the image can be replaced under this tag
FROM node:18-alpine

# Immutable — this exact image, always
FROM node:18-alpine@sha256:a65a5b2d1a30e8beab3b5a92e8d7c3f4a8e3df2c1b4a7c6f8e2d1b9a5c3e7f0
```

```bash
# Get the digest of an image
docker pull node:18-alpine
docker inspect node:18-alpine --format='{{index .RepoDigests 0}}'

# Pull by digest
docker pull node@sha256:a65a5b2d1a30e8beab...
```

### Docker Content Trust (DCT)

```bash
# Enable globally for all docker pull/push in current shell
export DOCKER_CONTENT_TRUST=1

# Generate signing keys
docker trust key generate mykey

# Sign and push an image
docker trust sign myregistry.io/myapp:1.0

# Inspect trust data
docker trust inspect --pretty myregistry.io/myapp:1.0

# Add a signer to a repository
docker trust signer add --key mycert.pem myteammember myregistry.io/myapp
```

### Minimal Base Images — Final Summary

```
Attack surface vs usability:
  ┌──────────────────────────────────────────────────────────────┐
  │  Image            Size    Shell  Package mgr  Attack surface │
  ├──────────────────────────────────────────────────────────────┤
  │  ubuntu:22.04     77MB    bash   apt          High           │
  │  debian:slim      75MB    bash   apt          Medium-High    │
  │  alpine:3.18      7MB     sh     apk          Low-Medium     │
  │  distroless/node  110MB   None   None         Very Low       │
  │  scratch          0MB     None   None         Minimal        │
  └──────────────────────────────────────────────────────────────┘

  Recommendation:
    Build stage:   use node:18-alpine or full base image
    Runtime stage: use distroless or alpine (multi-stage build)
```

---

## 7. Security Hardening Checklist

A consolidated reference of all hardening controls covered across Phase 10:

```
Container security hardening checklist:
  ┌────────────────────────────────────────────────────────────────┐
  │  IMAGE BUILD                                                   │
  │  [ ] Use official or verified base images                     │
  │  [ ] Pin base image digest (not just tag)                     │
  │  [ ] Use multi-stage builds — no build tools in final image   │
  │  [ ] Use distroless or minimal runtime image                  │
  │  [ ] Set USER to non-root (USER 1001) before CMD             │
  │  [ ] No secrets in ENV, COPY, or RUN layers                  │
  │  [ ] Run image scanner (Trivy/Snyk) in CI pipeline           │
  │  [ ] Enable Docker Content Trust for signed images            │
  ├────────────────────────────────────────────────────────────────┤
  │  RUNTIME FLAGS                                                 │
  │  [ ] --cap-drop=ALL (add back only what is needed)           │
  │  [ ] --security-opt no-new-privileges:true                   │
  │  [ ] --read-only + --tmpfs /tmp                              │
  │  [ ] --security-opt seccomp=<profile>                        │
  │  [ ] --security-opt apparmor=<profile>                       │
  │  [ ] Never use --privileged in production                    │
  │  [ ] --cpus, --memory, --pids-limit (resource limits)        │
  ├────────────────────────────────────────────────────────────────┤
  │  SECRETS                                                       │
  │  [ ] No secrets in environment variables                     │
  │  [ ] Use Docker Secrets (Swarm) or Compose secrets (file)    │
  │  [ ] Use BuildKit --mount=type=secret for build-time secrets │
  │  [ ] .env and key files in .dockerignore and .gitignore      │
  ├────────────────────────────────────────────────────────────────┤
  │  NETWORKING                                                    │
  │  [ ] Use custom bridge networks (not default bridge)         │
  │  [ ] Segment frontend, api, and database onto separate nets  │
  │  [ ] Use internal: true for networks that don't need egress  │
  │  [ ] Expose only required ports                              │
  └────────────────────────────────────────────────────────────────┘
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run an nginx container twice — once with the default seccomp profile and once with `--security-opt seccomp=unconfined`. Inside each container, read `/proc/1/status` and look at the `Seccomp` field. It should show `2` (filtering mode) for the default run and `0` (disabled) for unconfined. This demonstrates that the default Docker profile is actively applied.

**Exercise 2:** On a Linux host with AppArmor enabled, run `aa-status` to see loaded profiles. Run an nginx container and use `docker inspect <id> --format='{{.HostConfig.SecurityOpt}}'` to confirm the `apparmor=docker-default` profile is applied. Then run the same container with `--security-opt apparmor=unconfined` and compare.

**Exercise 3:** Demonstrate the `--privileged` container escape (in a safe test environment). Run `docker run --privileged -it ubuntu bash`, then inside the container run `fdisk -l` to list host disks and `ls /dev/sd*`. Confirm you have full device access. Immediately contrast with a normal container where `fdisk -l` returns nothing useful.

**Exercise 4:** Build a complete hardened docker-compose.yml for a Node.js API + Postgres stack that applies: `cap_drop: [ALL]`, `read_only: true`, `security_opt: [no-new-privileges:true]`, `tmpfs: [/tmp]`, resource limits, network segmentation (frontend-net / backend-net), and Compose secrets for the DB password. Start the stack and verify the API can connect to the database.

**Exercise 5:** Set up a CI-style security gate: write a shell script that runs `trivy image --severity CRITICAL --exit-code 1 myapp:latest`. If the scan finds any CRITICAL CVEs, the script exits non-zero (failing the build). Test it against `python:2.7` (high CVE count) and `python:3.12-alpine` (lower CVE count) to see the difference.

---

## 9. Interview Q&A

**Q: What is seccomp and how does Docker use it by default?**
Answer: seccomp (Secure Computing Mode) is a Linux kernel feature that restricts which system calls a process can make. Docker applies a default seccomp profile to every container (unless disabled). The default profile allows ~300 common syscalls and blocks ~44 dangerous ones such as `keyctl`, `ptrace`, `reboot`, `mount`, and `create_module`. This limits what a compromised container process can ask the kernel to do, reducing the kernel attack surface. You can supply a custom stricter profile with `--security-opt seccomp=<path>`.

**Q: What is the difference between seccomp and AppArmor?**
Answer: seccomp operates at the syscall level — it decides which kernel system calls a process is allowed to invoke, regardless of what files or resources are involved. AppArmor is a Mandatory Access Control (MAC) system that operates at the resource level — it defines which files the process can read/write, which network operations it can perform, and which capabilities it can use, based on a named profile. They are complementary: seccomp restricts how a process can talk to the kernel; AppArmor restricts what the process can access. Docker applies both by default on supported systems.

**Q: When is `--privileged` justified, and what are the risks?**
Answer: `--privileged` disables all container isolation mechanisms — it grants all 41 Linux capabilities, disables seccomp and AppArmor, and gives full access to host devices. The only legitimate uses are Docker-in-Docker CI builds (prefer rootless Docker or Kaniko instead) and certain low-level system tools. In all other cases it is dangerous: a privileged container can mount the host filesystem and escape to the host trivially. In production, add only the specific capability needed with `--cap-add` instead of using `--privileged`.

**Q: How do you prevent a container from consuming all CPU or memory on a host?**
Answer: Use resource limits at `docker run` time with `--cpus`, `--memory`, `--memory-swap`, and `--pids-limit`. In Compose, set them under `deploy.resources.limits`. Without limits, a single misbehaving or compromised container can consume all host resources, causing a denial of service for other containers. The `--pids-limit` flag is especially important to prevent fork bomb attacks. In Kubernetes, this is handled via `resources.limits` in the Pod spec.

**Q: What is image digest pinning and why is it more secure than using a tag?**
Answer: Docker image tags (e.g., `node:18-alpine`) are mutable pointers — the registry owner can push a different image to the same tag at any time (or an attacker who compromises the registry can substitute a malicious image). An image digest (e.g., `node:18-alpine@sha256:a65a5b...`) is the SHA-256 hash of the image manifest and is immutable — if a single byte changes, the digest changes. Pinning to a digest guarantees that you always pull the exact same image, protecting against supply chain attacks and unexpected breaking changes from upstream updates.
