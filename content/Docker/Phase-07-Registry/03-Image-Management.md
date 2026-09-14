# Image Management — Complete Guide

## Table of Contents
1. [Tagging Conventions](#1-tagging-conventions)
2. [Semantic Versioning for Docker Images](#2-semantic-versioning-for-docker-images)
3. [The `latest` Anti-Pattern](#3-the-latest-anti-pattern)
4. [Multi-Arch Images with docker buildx](#4-multi-arch-images-with-docker-buildx)
5. [Cleanup and Disk Management](#5-cleanup-and-disk-management)
6. [Retention Policies and Garbage Collection](#6-retention-policies-and-garbage-collection)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Tagging Conventions

A tag is a mutable human-readable pointer to an image manifest. Good tagging makes images traceable back to their source.

```
Image tag anatomy:
  registry/namespace/repository:tag

Common tag formats in the wild:
  myapp:latest                     ← mutable, avoid in production
  myapp:v2.3.1                     ← semantic version (recommended)
  myapp:2.3                        ← floating minor (updates with patches)
  myapp:2                          ← floating major (updates with minor/patch)
  myapp:sha-a1b2c3d                ← git commit SHA (immutable, traceable)
  myapp:20260624-a1b2c3d           ← date + SHA (sortable + traceable)
  myapp:main                       ← branch name (CI built from main branch)
  myapp:pr-142                     ← pull request build (ephemeral)
  myapp:stable                     ← alias for the current production version
```

### Recommended tagging strategy

```
On every merge to main:
  ┌─────────────────────────────────────────────────────┐
  │  myapp:main                 ← latest main build      │
  │  myapp:sha-$(git rev-parse --short HEAD)             │
  └─────────────────────────────────────────────────────┘

On every release tag (v2.3.1):
  ┌─────────────────────────────────────────────────────┐
  │  myapp:v2.3.1               ← exact version          │
  │  myapp:2.3                  ← floating minor         │
  │  myapp:2                    ← floating major         │
  │  myapp:latest               ← only on stable release │
  └─────────────────────────────────────────────────────┘
```

```bash
# Apply multiple tags to the same build
IMAGE_ID=$(docker build -q .)
VERSION=v2.3.1
SHORT_SHA=$(git rev-parse --short HEAD)

docker tag "$IMAGE_ID" "ganesh/myapp:${VERSION}"
docker tag "$IMAGE_ID" "ganesh/myapp:2.3"
docker tag "$IMAGE_ID" "ganesh/myapp:2"
docker tag "$IMAGE_ID" "ganesh/myapp:sha-${SHORT_SHA}"
docker tag "$IMAGE_ID" "ganesh/myapp:latest"
```

---

## 2. Semantic Versioning for Docker Images

Semantic versioning (semver) uses a `MAJOR.MINOR.PATCH` scheme that communicates the nature of changes to consumers.

```
MAJOR — breaking / incompatible API change        (v1.x.x → v2.0.0)
MINOR — new backwards-compatible functionality    (v2.2.x → v2.3.0)
PATCH — backwards-compatible bug fix              (v2.3.0 → v2.3.1)

Pre-release labels:
  v2.3.0-alpha.1   ← early unstable preview
  v2.3.0-beta.2    ← feature-complete, not yet hardened
  v2.3.0-rc.1      ← release candidate, final testing

Build metadata (informational, ignored in comparison):
  v2.3.0+20260624  ← build timestamp
  v2.3.0+sha.a1b2c ← build commit
```

```bash
# Example versioning workflow in CI (GitHub Actions):
# When git tag v2.3.1 is pushed:

docker build \
  --label "org.opencontainers.image.version=2.3.1" \
  --label "org.opencontainers.image.source=https://github.com/ganesh/myapp" \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t ganesh/myapp:2.3.1 \
  -t ganesh/myapp:2.3 \
  -t ganesh/myapp:2 \
  .

# Read OCI labels from a pulled image
docker inspect ganesh/myapp:2.3.1 \
  --format '{{json .Config.Labels}}' | jq .
```

### OCI image annotation standard

```
Label key                                   Meaning
─────────────────────────────────────────   ─────────────────────────
org.opencontainers.image.version            semver of the image
org.opencontainers.image.revision           git commit SHA
org.opencontainers.image.created            ISO 8601 build timestamp
org.opencontainers.image.source             VCS URL
org.opencontainers.image.title              Human-readable name
org.opencontainers.image.licenses           SPDX license identifier

Using OCI labels makes images self-documenting and enables tooling
(vulnerability scanners, SBOMs, registries) to extract metadata
without accessing the source repository.
```

---

## 3. The `latest` Anti-Pattern

```
The problem with :latest

  Build 1 (v1.0.0)         Build 2 (v1.1.0)
  ──────────────            ──────────────────
  myapp:latest  ─┐          myapp:latest  ─┐
  myapp:1.0.0   ─┘ same     myapp:1.1.0   ─┘ same
                 image                      image

  After Build 2:
  myapp:latest now points to v1.1.0.
  myapp:1.0.0 still points to the exact v1.0.0 image.

  If a server does "docker pull myapp:latest" at different times,
  it gets DIFFERENT images — indistinguishable from the tag alone.
```

```bash
# Anti-pattern: non-reproducible deployment
docker pull myapp:latest            # what version am I actually getting?
docker run myapp:latest             # depends on when you pull

# Correct pattern: pin to a specific version
docker pull myapp:v1.1.0
docker run myapp:v1.1.0

# Even better: pin to an immutable digest
docker pull myapp@sha256:a4c8ab9fa6d9...
docker run myapp@sha256:a4c8ab9fa6d9...

# In a Dockerfile: never do this in production
FROM myapp:latest          ← breaks reproducible builds

# Do this instead:
FROM myapp:v1.1.0          ← explicit version
# or
FROM myapp@sha256:a4c8...  ← immutable (always the exact same image)
```

### When `latest` IS acceptable

```
Acceptable:
  - Local development ("give me the newest build to test")
  - Documentation examples (for readability)
  - The very latest tag in an automated demo pipeline

Never acceptable:
  - Production Dockerfiles (FROM myapp:latest)
  - Kubernetes deployment manifests
  - Any environment where reproducibility matters
```

---

## 4. Multi-Arch Images with docker buildx

`docker buildx` extends `docker build` with BuildKit features, including the ability to build images for multiple CPU architectures and bundle them into a single manifest list (a.k.a. multi-platform image or fat manifest).

```
Multi-arch manifest list:
  ganesh/myapp:v1.0.0
    ├── linux/amd64   → manifest sha256:aaa…  (x86-64 servers)
    ├── linux/arm64   → manifest sha256:bbb…  (Apple Silicon, AWS Graviton)
    └── linux/arm/v7  → manifest sha256:ccc…  (Raspberry Pi)

When you docker pull ganesh/myapp:v1.0.0 on an Apple M2:
  Docker detects linux/arm64, pulls sha256:bbb… automatically.
  No --platform flag needed by the consumer.
```

```bash
# 1. Create a multi-platform builder (one-time setup)
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap
# Platforms: linux/amd64, linux/arm64, linux/arm/v7, linux/arm/v6…

# 2. Build and push for multiple platforms in one command
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag ganesh/myapp:v1.0.0 \
  --tag ganesh/myapp:latest \
  --push \
  .
# --push is required: multi-arch images must go to a registry,
# they cannot be loaded into the local daemon.

# 3. Inspect the manifest list
docker buildx imagetools inspect ganesh/myapp:v1.0.0
# Manifests:
#   Name:      ganesh/myapp:v1.0.0@sha256:…
#   MediaType: application/vnd.docker.distribution.manifest.list.v2+json
#   Platforms:
#     linux/amd64
#     linux/arm64
#     linux/arm/v7

# 4. Build for a single platform and load locally (for testing)
docker buildx build \
  --platform linux/amd64 \
  --tag ganesh/myapp:test \
  --load \
  .

# QEMU emulation (needed for cross-arch builds on a single machine)
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
```

---

## 5. Cleanup and Disk Management

Docker accumulates dangling images, stopped containers, unused networks, and build cache over time.

```bash
# ── Images ─────────────────────────────────────────────────────────

# List dangling images (<none>:<none> — untagged, unreferenced layers)
docker images --filter "dangling=true"

# Remove only dangling images
docker image prune

# Remove ALL unused images (not referenced by any container, running or stopped)
docker image prune -a

# Remove a specific image
docker rmi ganesh/myapp:v1.0.0

# ── Containers ─────────────────────────────────────────────────────

# Remove all stopped containers
docker container prune

# ── Volumes ────────────────────────────────────────────────────────

# Remove unused (anonymous) volumes
docker volume prune

# ── Build cache ────────────────────────────────────────────────────

# Show build cache breakdown
docker buildx du

# Remove all build cache
docker buildx prune -a

# ── Everything at once ─────────────────────────────────────────────

# Remove stopped containers + dangling images + unused networks + build cache
docker system prune

# Also remove ALL unused images (not just dangling) + volumes
docker system prune -a --volumes

# Check disk usage before/after
docker system df
# TYPE            TOTAL   ACTIVE  SIZE      RECLAIMABLE
# Images          14      3       4.72GB    3.1GB (65%)
# Containers      2       1       1.2MB     600kB (50%)
# Local Volumes   5       2       890MB     450MB (50%)
# Build Cache     38      0       1.3GB     1.3GB
```

### Automated cleanup with cron

```bash
# /etc/cron.weekly/docker-cleanup
#!/usr/bin/env bash
# Remove images not pulled or used in the last 7 days, keep running containers
docker image prune -a --force --filter "until=168h"
docker container prune --force
docker volume prune --force
```

---

## 6. Retention Policies and Garbage Collection

### Registry-side retention (registry:2)

```bash
# Enable deletion in config.yml:
# storage:
#   delete:
#     enabled: true

# Manual garbage collection (stop or pause the registry first)
docker stop secure-registry
docker run --rm \
  -v registry-data:/var/lib/registry \
  registry:2 \
  garbage-collect /etc/docker/registry/config.yml --delete-untagged
docker start secure-registry
```

### Automated retention with Docker Hub

```
Docker Hub Pro/Team: set automated image retention rules via UI.
  - Delete images not pulled in 90 days
  - Keep last N tags
  - Exempt tags matching a regex (e.g. "v*")
```

### ECR lifecycle policies (AWS example)

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 tagged releases",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Expire untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": { "type": "expire" }
    }
  ]
}
```

---

## 7. Hands-On Exercises

**Exercise 1:** Build a small image (FROM alpine, add a label). Tag it three ways: `v1.0.0`, `1.0`, and `sha-$(git rev-parse --short HEAD)`. Run `docker images` and verify all three tags share the same IMAGE ID. Then push all tags to your Docker Hub account.

**Exercise 2:** Demonstrate the `latest` anti-pattern. Build the same Dockerfile twice (change a label between builds) both tagged `:latest`. Notice the old `latest` becomes `<none>:<none>` (dangling). Run `docker image prune` and confirm the dangling image is removed.

**Exercise 3:** Create a `docker buildx` builder and build a multi-arch image for `linux/amd64` and `linux/arm64`. Push it to Docker Hub. Run `docker buildx imagetools inspect yourusername/multiarch-test:v1.0.0` and verify both platform manifests appear.

**Exercise 4:** Fill your local Docker daemon with test images: pull several images, build a few intermediate layers. Run `docker system df` to see disk usage. Then run `docker system prune -a` and run `docker system df` again — compare the reclaimed space.

**Exercise 5:** Write a shell script that tags an image with a semantic version (`v$MAJOR.$MINOR.$PATCH`), a floating minor tag (`$MAJOR.$MINOR`), a floating major tag (`$MAJOR`), a git-SHA tag, and `latest` — all pointing to the same `IMAGE_ID`. Accept the version as a command-line argument (e.g. `./tag-release.sh 2.3.1`).

---

## 8. Interview Q&A

**Q: What is the difference between a mutable and an immutable tag in Docker?**
Answer: A mutable tag (like `latest` or a branch name) can be moved — every new push to the same tag name overwrites it, so the same tag can refer to different images over time. An immutable tag (like `v2.3.1`) or a digest (`sha256:abc...`) always refers to the same image. Production deployments should always pin to immutable references to ensure reproducibility and prevent unintended updates when images are re-pulled.

**Q: What is a multi-arch manifest list and how does the Docker CLI use it?**
Answer: A manifest list (also called a "fat manifest" or OCI image index) is a registry object that maps platform identifiers (e.g. `linux/amd64`, `linux/arm64`) to individual image manifests. When `docker pull` contacts the registry, it sends the client's platform in the `Accept` header. The registry returns the matching platform's manifest automatically, so the same tag works on any supported architecture without the user specifying `--platform`.

**Q: Why should you add OCI image labels (org.opencontainers.image.*) to every production image?**
Answer: OCI labels make images self-documenting. Tools like vulnerability scanners, software bill of materials (SBOM) generators, and container management platforms use these labels to link running containers back to their source repository, commit, build timestamp, and license. Without them, you must query a CI system or tag naming convention to answer "what code is running in this container right now?" — an audit and incident response requirement.

**Q: How does `docker image prune -a` differ from `docker system prune -a --volumes`?**
Answer: `docker image prune -a` removes only images not referenced by any container (running or stopped). `docker system prune -a --volumes` removes everything unused: stopped containers, all unused images, unused networks, build cache, and anonymous volumes. The `--volumes` flag is notable because volumes hold persistent data — always confirm no important data is in anonymous volumes before running it.

**Q: When building a multi-arch image with `docker buildx`, why must you use `--push` instead of `--load`?**
Answer: The local Docker daemon's image store can only hold images for the host's native architecture. A multi-arch manifest list (containing separate manifests for amd64, arm64, etc.) has no single-architecture representation to load. `--push` sends all platform-specific manifests and the manifest list directly to the registry, which is the only store capable of holding multiple architecture entries under one tag. You can use `--load` for a single-platform build targeted at the host's architecture for local testing.
