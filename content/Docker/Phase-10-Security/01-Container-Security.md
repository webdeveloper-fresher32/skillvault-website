# Container Security — Complete Guide

## Table of Contents
1. [Why Container Security Matters](#1-why-container-security-matters)
2. [Running as Non-Root User](#2-running-as-non-root-user)
3. [Linux Capabilities](#3-linux-capabilities)
4. [Read-Only Filesystem](#4-read-only-filesystem)
5. [Image Scanning](#5-image-scanning)
6. [Distroless and Minimal Images](#6-distroless-and-minimal-images)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Container Security Matters

By default, Docker containers run with more privileges than most workloads need. A container that runs as root, has access to all Linux capabilities, and mounts writable filesystems creates an unnecessarily large attack surface.

```
Default container risk surface:
  ┌──────────────────────────────────────────────────────┐
  │  Container (default)                                 │
  │                                                      │
  │  ● Runs as root (UID 0) ← can write anywhere        │
  │  ● All Linux capabilities enabled                   │
  │  ● Writable root filesystem                         │
  │  ● Unscanned base image (known CVEs inside)         │
  │  ● No seccomp/AppArmor profile applied              │
  │                                                      │
  │  Risk: container escape → host root access          │
  └──────────────────────────────────────────────────────┘

Hardened container:
  ┌──────────────────────────────────────────────────────┐
  │  Container (hardened)                                │
  │                                                      │
  │  ● Runs as UID 1001 (non-root)                      │
  │  ● Only required capabilities kept                  │
  │  ● Read-only root filesystem                        │
  │  ● Scanned image — no critical CVEs                 │
  │  ● seccomp profile restricts syscalls               │
  │                                                      │
  │  Blast radius: contained to app process only        │
  └──────────────────────────────────────────────────────┘
```

The principle of **least privilege** — give a container only the permissions it needs to run, nothing more.

---

## 2. Running as Non-Root User

### The Root Problem

A container process running as root (UID 0) maps to root on the host kernel. If the container is compromised, attackers have a much easier path to the host.

```dockerfile
# Bad: default root user
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
# Process inside container runs as root (UID 0)
```

### Creating and Using a Non-Root User

```dockerfile
# Good: explicit non-root user
FROM node:18-alpine

# Create a dedicated system user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy and install dependencies as root (build step)
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Set ownership of app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user before running the app
USER 1001

EXPOSE 3000
CMD ["node", "server.js"]
```

```
Layer ownership model:
  Build stage (root):  installs packages, compiles, sets up dirs
  Runtime stage (UID 1001): runs the app process

  UID 1001 cannot:
    ● Write to /etc, /bin, /usr
    ● Bind to ports < 1024 (without NET_BIND_SERVICE capability)
    ● Modify other users' files
    ● Install new packages at runtime
```

### Verify the Running User

```bash
# Check which user the container process is running as
docker run --rm myapp whoami
docker run --rm myapp id

# Inspect at runtime
docker exec <container_id> id

# Confirm in image metadata
docker inspect myapp --format='{{.Config.User}}'
```

### Port Binding for Non-Root

Non-root users cannot bind to privileged ports (< 1024). Solutions:

```dockerfile
# Option 1: Use a port above 1024
EXPOSE 8080
CMD ["node", "server.js"]   # listen on 8080

# Option 2: Use NET_BIND_SERVICE capability (see Section 3)
# Option 3: Use a reverse proxy (nginx) to handle port 80/443
```

---

## 3. Linux Capabilities

Linux capabilities are fine-grained privileges that split root's all-or-nothing power into individual units. Docker enables a default set — most workloads need far fewer.

```
Linux capabilities (subset):
  CAP_NET_BIND_SERVICE  — bind to ports < 1024
  CAP_NET_ADMIN         — configure network interfaces
  CAP_SYS_ADMIN         — broad sysadmin (very dangerous)
  CAP_SYS_PTRACE        — trace/debug processes
  CAP_CHOWN             — change file ownership
  CAP_SETUID            — change UID
  CAP_DAC_OVERRIDE      — bypass file permission checks

Docker default set (14 capabilities granted automatically):
  CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW,
  SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE,
  SYS_CHROOT, KILL, AUDIT_WRITE
```

### Dropping All Capabilities (Best Practice)

```bash
# Start with no capabilities, add only what is needed
docker run -d \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  -p 80:80 \
  nginx:alpine

# A typical Node.js API needs no capabilities at all
docker run -d \
  --cap-drop=ALL \
  -p 3000:3000 \
  mynode-api:latest
```

### In Docker Compose

```yaml
services:
  api:
    image: mynode-api:latest
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    ports:
      - "3000:3000"
```

### No New Privileges Flag

Prevents the container process from gaining additional privileges via setuid/setgid binaries:

```bash
docker run -d \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  mynode-api:latest
```

---

## 4. Read-Only Filesystem

A read-only root filesystem prevents an attacker from writing malware, modifying binaries, or persisting changes inside a compromised container.

```bash
# Mount the container filesystem as read-only
docker run -d \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /var/run \
  -p 3000:3000 \
  mynode-api:latest
```

```
Read-only container layout:
  ┌──────────────────────────────────────────────────────┐
  │  / (read-only)                                       │
  │  ├── /bin   (read-only — binaries)                  │
  │  ├── /usr   (read-only — libraries)                 │
  │  ├── /app   (read-only — your application code)     │
  │  ├── /tmp   (tmpfs — writable, in-memory, ephemeral)│
  │  └── /var/run (tmpfs — PID files, sockets)          │
  │                                                      │
  │  Attacker cannot: write files, install tools,       │
  │  modify binaries, or persist across restarts        │
  └──────────────────────────────────────────────────────┘
```

### In Docker Compose

```yaml
services:
  api:
    image: mynode-api:latest
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

---

## 5. Image Scanning

Even well-written Dockerfiles can inherit vulnerabilities from base images. Scanning catches known CVEs before they reach production.

### Trivy (Open Source — Most Popular)

```bash
# Install Trivy (macOS)
brew install trivy

# Scan a local image
trivy image mynode-api:latest

# Scan with severity filter (only HIGH and CRITICAL)
trivy image --severity HIGH,CRITICAL mynode-api:latest

# Scan and output as JSON for CI integration
trivy image --format json --output results.json mynode-api:latest

# Scan a public image
trivy image nginx:latest

# Scan a Dockerfile for misconfigurations
trivy config ./Dockerfile
```

```
Example Trivy output:
  mynode-api:latest (alpine 3.18.4)
  =======================================
  Total: 3 (HIGH: 1, CRITICAL: 2)

  ┌────────────┬────────────────┬──────────┬──────────────────────┐
  │  Library   │ Vulnerability  │ Severity │ Fixed Version        │
  ├────────────┼────────────────┼──────────┼──────────────────────┤
  │ openssl    │ CVE-2023-1234  │ CRITICAL │ 3.1.4-r1             │
  │ zlib       │ CVE-2023-5678  │ HIGH     │ 1.2.13-r1            │
  └────────────┴────────────────┴──────────┴──────────────────────┘
```

### Snyk

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Scan a Docker image
snyk container test mynode-api:latest

# Monitor image (track ongoing vulnerabilities)
snyk container monitor mynode-api:latest
```

### Docker Scout (Built-in)

```bash
# Scan with Docker Scout (Docker Desktop users)
docker scout cves mynode-api:latest

# Quick summary
docker scout quickview mynode-api:latest

# Compare two image versions
docker scout compare mynode-api:v1.0 mynode-api:v1.1
```

### CI Pipeline Integration

```yaml
# GitHub Actions example
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: mynode-api:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: 1        # fail the build on findings
```

---

## 6. Distroless and Minimal Images

Distroless images contain only the application runtime — no shell, no package manager, no OS utilities. Minimal attack surface.

```
Image size and attack surface comparison:
  ubuntu:22.04      — 77MB  — full OS, ~400 packages
  debian:slim       — 75MB  — trimmed OS
  alpine:3.18       — 7MB   — minimal OS, busybox shell
  distroless/nodejs — 110MB — Node.js runtime only, no shell
  scratch           — 0MB   — empty, for statically compiled binaries
```

### Multi-Stage Build with Distroless

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Stage 2: Distroless runtime (no shell, no package manager)
FROM gcr.io/distroless/nodejs18-debian11

WORKDIR /app
COPY --from=builder /app /app

# Distroless sets a non-root user by default (UID 65532)
USER 65532

EXPOSE 3000
CMD ["server.js"]
```

### Docker Content Trust (Signed Images)

```bash
# Enable Docker Content Trust globally (enforce signed images only)
export DOCKER_CONTENT_TRUST=1

# Sign and push an image (requires Notary)
docker trust sign myregistry.io/myapp:1.0

# Verify image signature
docker trust inspect myregistry.io/myapp:1.0

# View signing keys
docker trust key ls
```

---

## 7. Hands-On Exercises

**Exercise 1:** Take a Dockerfile that uses `FROM node:18` with no USER instruction. Add a non-root user (`adduser -S appuser`) and switch to it with `USER 1001`. Build the image and verify with `docker run --rm myapp id` that the process runs as UID 1001, not root.

**Exercise 2:** Run any image with `--cap-drop=ALL --cap-add=NET_BIND_SERVICE --security-opt no-new-privileges:true`. Use `docker exec <id> cat /proc/1/status | grep Cap` to inspect the capability bitmask and compare it to a container started without those flags.

**Exercise 3:** Run a container with `--read-only --tmpfs /tmp`. Try to create a file in `/etc` (should fail) and in `/tmp` (should succeed). This demonstrates the read-only boundary.

**Exercise 4:** Install Trivy and scan `nginx:latest`. Identify the highest-severity CVE, look it up on the NVD (nvd.nist.gov), and find which version of nginx (or the affected library) fixes it. Then rescan `nginx:alpine` and compare the vulnerability count.

**Exercise 5:** Build a multi-stage Dockerfile where the build stage uses `node:18-alpine` and the final stage uses `gcr.io/distroless/nodejs18-debian11`. Compare the final image size to a single-stage build using `docker images`. Run `docker run --rm distroless-app sh` and confirm there is no shell.

---

## 8. Interview Q&A

**Q: Why should containers run as non-root, and how do you enforce it in a Dockerfile?**
Answer: Root inside a container maps to UID 0 on the host kernel. If an attacker exploits the containerized application, running as root makes container escape significantly easier. You enforce it in the Dockerfile with `RUN addgroup -S appgroup && adduser -S appuser -G appgroup` followed by `USER 1001` (or the named user) before the `CMD` instruction. In production you can also enforce this at the orchestrator level (Kubernetes PodSecurityContext, Docker `--user` flag).

**Q: What is the difference between `--cap-drop=ALL` and `--no-new-privileges`?**
Answer: `--cap-drop=ALL` removes all Linux capabilities from the container's capability set, so the process cannot perform privileged operations (like raw socket access or changing file ownership). `--no-new-privileges` is a separate kernel security bit that prevents the process from gaining additional capabilities through setuid/setgid executables at runtime. Best practice is to use both together.

**Q: What does image scanning with Trivy actually check?**
Answer: Trivy compares the packages installed in the image (OS packages via APK/APT/RPM and language packages via package-lock.json, go.sum, etc.) against CVE databases (NVD, GitHub Advisory, OS-specific advisories). It reports the CVE ID, severity (CRITICAL/HIGH/MEDIUM/LOW), the affected version, and the fixed version. It also checks Dockerfile and Compose files for misconfigurations (running as root, privileged mode, etc.).

**Q: What are distroless images and when would you use them?**
Answer: Distroless images (from Google) contain only the language runtime (e.g., Node.js, Java, Python) — no shell, no package manager, no coreutils. They drastically reduce the attack surface because an attacker who achieves code execution inside the container cannot run shell commands, install tools, or easily explore the filesystem. Use them for production workloads where you do not need to exec into the container to debug. For debugging, a sidecar or ephemeral container approach is used instead.

**Q: How does Docker Content Trust (DCT) improve supply chain security?**
Answer: Docker Content Trust uses Notary (based on The Update Framework) to cryptographically sign images at push time. When DCT is enabled (`DOCKER_CONTENT_TRUST=1`), Docker verifies the signature at pull time and refuses to run unsigned images. This protects against registry compromise and man-in-the-middle attacks where a tampered image could be substituted for a legitimate one.
