# Docker Images — Complete Guide

## Table of Contents
1. [Image Structure](#1-image-structure)
2. [Image Layers](#2-image-layers)
3. [Image Naming and Tags](#3-image-naming-and-tags)
4. [Managing Images](#4-managing-images)
5. [Base Images — Choosing Right](#5-base-images--choosing-right)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Image Structure

A Docker image is a stack of read-only layers built on top of each other.

```
┌─────────────────────────────────┐  ← Container layer (read-write, ephemeral)
├─────────────────────────────────┤
│  Layer 4: COPY . /app           │  ← your application files
├─────────────────────────────────┤
│  Layer 3: RUN npm install       │  ← node_modules installed
├─────────────────────────────────┤
│  Layer 2: COPY package.json .   │  ← package.json copied
├─────────────────────────────────┤
│  Layer 1: FROM node:18-alpine   │  ← base OS + Node.js runtime
└─────────────────────────────────┘  ← base layer (immutable)

Each layer = diff from the layer below (like git commits)
```

### Union Filesystem (OverlayFS)

Docker merges all layers into a single unified view using OverlayFS:

```
Container sees:  /app/server.js      (Layer 4)
                 /app/node_modules   (Layer 3)
                 /app/package.json   (Layer 2)
                 /usr/local/bin/node (Layer 1 — base)
                 /bin, /etc, ...     (Layer 1 — OS)

All read-only. The container layer on top is read-write.
Modifying a file: copy-on-write to the container layer.
```

---

## 2. Image Layers

```bash
# See layers of an image
docker history nginx:latest
# IMAGE         CREATED      CREATED BY                SIZE
# a99a39d070bf  2 weeks ago  CMD ["nginx" "-g" "dae…   0B
# <missing>     2 weeks ago  STOPSIGNAL SIGQUIT         0B
# <missing>     2 weeks ago  EXPOSE map[80/tcp:{}]      0B
# <missing>     2 weeks ago  COPY /etc/nginx/nginx.c…   0B
# <missing>     2 weeks ago  RUN /bin/sh -c set -x;…    56.3MB
# <missing>     2 weeks ago  FROM debian:bookworm-slim  97.2MB

# Inspect image metadata (full JSON)
docker inspect nginx:latest

# Image size
docker images nginx
# REPOSITORY  TAG     IMAGE ID       SIZE
# nginx       latest  a99a39d070bf   192MB

# Layer sharing: two images sharing the same base layer
# use disk space only ONCE (deduplication)
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

---

## 3. Image Naming and Tags

```
Full image name format:
  [registry/][namespace/]repository[:tag][@digest]

Examples:
  nginx                          → docker.io/library/nginx:latest
  nginx:1.25                     → docker.io/library/nginx:1.25
  ubuntu:22.04                   → docker.io/library/ubuntu:22.04
  ganesh/myapp:v1.0              → docker.io/ganesh/myapp:v1.0
  ghcr.io/org/service:sha-abc123 → GitHub Container Registry

Digest (immutable reference):
  nginx@sha256:a4c8ab9fa6d9...   → always this exact version, even if tag changes
```

```bash
# Tagging images
docker tag myapp:latest myapp:v1.0
docker tag myapp:latest registry.mycompany.com/team/myapp:v1.0

# Multiple tags same image (same IMAGE ID)
docker images myapp
# REPOSITORY  TAG     IMAGE ID
# myapp       latest  abc123
# myapp       v1.0    abc123   ← same ID, just another tag

# Pull specific digest (immutable)
docker pull nginx@sha256:a4c8ab9fa6d9...
```

---

## 4. Managing Images

```bash
# List images
docker images
docker image ls
docker images --filter "dangling=true"  # untagged images (<none>)
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Pull an image
docker pull ubuntu:22.04
docker pull --platform linux/amd64 nginx  # force architecture

# Remove images
docker rmi nginx:latest
docker image rm nginx:latest
docker rmi $(docker images -q --filter "dangling=true")  # remove dangling

# Remove all unused images
docker image prune         # only dangling
docker image prune -a      # all unused (not referenced by any container)

# Save image to tar (offline transfer)
docker save nginx:latest | gzip > nginx.tar.gz

# Load image from tar
docker load < nginx.tar.gz
# or:
gunzip -c nginx.tar.gz | docker load

# Export container filesystem (flat, no layers)
docker export <container_id> > container.tar

# Import as image (loses layer history)
cat container.tar | docker import - myimage:imported
```

---

## 5. Base Images — Choosing Right

### Size Comparison

| Base Image | Size | Use Case |
|-----------|------|---------|
| `scratch` | 0 B | Go static binaries, minimal |
| `alpine` | 7 MB | Small general purpose |
| `debian:slim` | 75 MB | Smaller Debian variant |
| `ubuntu:22.04` | 77 MB | Full Ubuntu |
| `debian` | 124 MB | Full Debian |
| `node:18-alpine` | 180 MB | Node.js on Alpine |
| `node:18` | 993 MB | Node.js on Debian |
| `python:3.11-slim` | 130 MB | Python on Debian slim |
| `python:3.11` | 920 MB | Full Python on Debian |

### Decision Guide

```
Need smallest possible image?  → scratch or alpine
Need glibc (most C libs)?      → debian:slim or ubuntu
Need apt packages?             → ubuntu or debian
Language-specific?             → use official: node:alpine, python:slim
Production app?                → use official slim/alpine variants
Debugging ease matters?        → use full image during dev, slim in prod
Multi-arch (ARM + AMD64)?      → check official image manifest
```

### Alpine Warning

```
Alpine uses musl libc (not glibc).
Some Python packages, Node native modules, or compiled C libraries
may fail on Alpine.

If you hit issues → use debian:slim instead (glibc based, still small).
```

---

## 6. Hands-On Exercises

**Exercise 1:** Pull `nginx:latest` and `nginx:alpine`. Compare sizes with `docker images`. Run `docker history` on both — count the layers.

**Exercise 2:** Tag `nginx:latest` with your username: `docker tag nginx:latest yourname/nginx-test:v1`. List images — verify same IMAGE ID with two tags.

**Exercise 3:** Save `nginx:alpine` to a tar file, remove the image locally, then reload from the tar file. Verify it works.

**Exercise 4:** Use `docker inspect nginx:latest` to find: the default command (CMD), exposed ports, and the OS/architecture the image was built for.

**Exercise 5:** Pull `node:18`, `node:18-slim`, and `node:18-alpine`. Compare sizes. Run `docker run --rm node:18-alpine node --version` to verify Node version.

---

## 7. Interview Q&A

**Q: What is a Docker image layer?**
Answer: An image layer is a read-only filesystem diff created by each Dockerfile instruction (FROM, RUN, COPY, etc.). Layers are stacked — Docker uses OverlayFS to present all layers as a unified filesystem. Layers are identified by content hash and shared between images — if two images start from the same base, they share those base layers on disk.

**Q: What is the difference between `docker save` and `docker export`?**
Answer: `docker save` exports a full image including all layers, history, and metadata — suitable for transferring an image between Docker hosts. `docker export` exports a container's filesystem as a flat tar (no layers, no history). Save/load preserves layering; export/import creates a single-layer image.

**Q: What is a dangling image?**
Answer: A dangling image is an untagged, unreferenced image layer — usually created when you rebuild an image with the same tag (the old layers lose their tag). They show as `<none>:<none>` in `docker images`. Clean them with `docker image prune`. They waste disk space but are otherwise harmless.

**Q: Why use Alpine as a base image?**
Answer: Alpine Linux is tiny (~7MB) due to busybox tooling and musl libc instead of glibc. Smaller images mean faster pulls, less attack surface (fewer packages = fewer CVEs), and lower registry costs. Downside: musl libc can cause compatibility issues with some native C extensions — in that case use debian:slim instead.

**Q: What is an image digest and when should you use it?**
Answer: An image digest is a SHA256 hash of the image manifest — it's immutable (the tag `nginx:latest` can point to different images over time, but the digest always points to the exact same image). Use digests in production Dockerfiles and deployments to guarantee reproducibility: `FROM nginx@sha256:abc123...`.
