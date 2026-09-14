# Docker Hub — Complete Guide

## Table of Contents
1. [What is Docker Hub](#1-what-is-docker-hub)
2. [Image Naming and Namespacing](#2-image-naming-and-namespacing)
3. [Authenticating with Docker Hub](#3-authenticating-with-docker-hub)
4. [Pulling Images](#4-pulling-images)
5. [Pushing Images](#5-pushing-images)
6. [Automated Builds and Webhooks](#6-automated-builds-and-webhooks)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is Docker Hub

Docker Hub is the default public registry used by the Docker CLI. When you run `docker pull nginx`, Docker contacts `docker.io` (Docker Hub) automatically.

```
Docker Hub hierarchy:

  docker.io
  ├── library/          ← Official images (nginx, ubuntu, python, postgres…)
  │     nginx:latest
  │     ubuntu:22.04
  │     python:3.11-slim
  ├── username/         ← Community / personal images
  │     ganesh/myapp:v1.0
  │     ganesh/api-server:latest
  └── organisation/     ← Organisation namespaces (paid plan)
        myorg/backend:sha-a1b2c3
```

### Key features

| Feature | Free Tier | Paid (Pro/Team) |
|---------|-----------|-----------------|
| Public repositories | Unlimited | Unlimited |
| Private repositories | 1 | Unlimited |
| Pull rate limit | 100/6 h (unauthenticated), 200/6 h (authenticated) | Unlimited |
| Automated builds | Discontinued (use GitHub Actions) | — |
| Image vulnerability scanning | Limited | Full |

---

## 2. Image Naming and Namespacing

```
Full Docker Hub image reference:

  [registry/][namespace/]repository[:tag][@digest]

  nginx                      → docker.io/library/nginx:latest
  nginx:1.25                 → docker.io/library/nginx:1.25
  ubuntu:22.04               → docker.io/library/ubuntu:22.04
  ganesh/myapp               → docker.io/ganesh/myapp:latest
  ganesh/myapp:v2.1.0        → docker.io/ganesh/myapp:v2.1.0
  ganesh/myapp@sha256:abc…   → immutable digest reference

Rules:
  - Official images:   no namespace prefix (library/)
  - User images:       username/repository
  - Tags default to:   :latest (avoid relying on this in production)
  - Digest is SHA256 of the image manifest — immutable
```

---

## 3. Authenticating with Docker Hub

```bash
# Interactive login (prompts for username + password / PAT)
docker login

# Login with username flag (password read from stdin — safer in scripts)
echo "$DOCKER_PAT" | docker login --username ganesh --password-stdin

# Verify you are logged in
cat ~/.docker/config.json
# {
#   "auths": {
#     "https://index.docker.io/v1/": {
#       "auth": "Z2FuZXNoOm15c2VjcmV0"   ← base64(username:password)
#     }
#   }
# }

# Logout (removes credentials from config.json)
docker logout

# Best practice: use Personal Access Tokens (PAT) instead of your password.
# Create at: https://hub.docker.com/settings/security
# Scope PATs to read-only or read/write as needed.
```

### Credential helpers (recommended)

```bash
# macOS: Docker Desktop stores credentials in the Keychain automatically.
# Linux: install docker-credential-helpers
#   https://github.com/docker/docker-credential-helpers
#
# config.json when a helper is active:
# {
#   "credsStore": "osxkeychain"   ← macOS
#   "credsStore": "secretservice" ← Linux GNOME
# }
# Credentials are NOT stored in plain base64 — they stay in the OS store.
```

---

## 4. Pulling Images

```bash
# Pull latest tag (implicit)
docker pull nginx

# Pull specific tag
docker pull nginx:1.25-alpine

# Pull specific platform (useful on Apple Silicon)
docker pull --platform linux/amd64 nginx:latest

# Pull by digest (immutable — guarantees exact image)
docker pull nginx@sha256:a4c8ab9fa6d9c2a6d5b3f1e9c8b7a2d4e5f6...

# Pull from a non-default registry (Docker Hub still, but explicit)
docker pull docker.io/library/nginx:latest

# Inspect what you pulled
docker inspect nginx:1.25-alpine --format '{{.Architecture}}'
docker history nginx:1.25-alpine
```

### Rate limits and authentication

```
Unauthenticated:  100 pulls per 6 hours (shared by source IP)
Authenticated:    200 pulls per 6 hours per Docker Hub account
Paid plan:        Unlimited

To avoid rate limits in CI: always docker login before pulling.
Check remaining pulls:
  TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)
  curl -s --head -H "Authorization: Bearer $TOKEN" \
       https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest \
  | grep -i ratelimit
```

---

## 5. Pushing Images

```bash
# 1. Build your image
docker build -t myapp:latest .

# 2. Tag for Docker Hub (namespace with your username)
docker tag myapp:latest ganesh/myapp:v1.0.0
docker tag myapp:latest ganesh/myapp:latest    # also tag as latest

# 3. Push both tags
docker push ganesh/myapp:v1.0.0
docker push ganesh/myapp:latest

# Push all tags for a repository at once
docker push ganesh/myapp --all-tags
```

### Full push workflow

```
Developer machine                Docker Hub
─────────────────                ──────────
docker build              →
docker tag                →
docker login              →      authenticate
docker push               →      layer 1: already exists
                                 layer 2: already exists
                                 layer 3: pushed (7.42MB)
                                 ganesh/myapp:v1.0.0 digest: sha256:…

┌──────────────────────────────────────┐
│  Repository: ganesh/myapp             │
│  Tags: v1.0.0  latest                 │
│  Last pushed: 2026-06-24 by ganesh    │
└──────────────────────────────────────┘
```

```bash
# Verify pushed image exists
docker pull ganesh/myapp:v1.0.0
docker run --rm ganesh/myapp:v1.0.0 echo "pulled successfully"

# View repository tags via Docker Hub API
curl -s "https://hub.docker.com/v2/repositories/ganesh/myapp/tags/" | jq '.results[].name'
```

---

## 6. Automated Builds and Webhooks

Docker Hub's native automated builds were discontinued in 2021. The modern replacement is a CI/CD pipeline that builds and pushes images on git events.

### GitHub Actions — push on every release tag

```yaml
# .github/workflows/docker-publish.yml
name: Build and Push to Docker Hub

on:
  push:
    tags: ["v*.*.*"]

jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ganesh/myapp
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### Webhooks

```
Docker Hub repository → Settings → Webhooks

Add a webhook URL (e.g. your CI server or a Slack incoming webhook).
Docker Hub POSTs a JSON payload after each successful push:

{
  "push_data": { "tag": "v1.0.0", "pusher": "ganesh" },
  "repository": { "repo_name": "ganesh/myapp", "full_name": "ganesh/myapp" }
}

Use cases:
  - Trigger a Kubernetes rolling update
  - Notify a Slack channel
  - Kick off integration tests
```

---

## 7. Hands-On Exercises

**Exercise 1:** Create a free Docker Hub account if you do not have one. Generate a Personal Access Token (PAT) with read/write scope. Log in with `docker login --username <you> --password-stdin` using the PAT and verify `~/.docker/config.json` is updated.

**Exercise 2:** Pull `nginx:alpine` and `nginx:1.25-alpine`. Run `docker images nginx` to see both tags. Run `docker inspect nginx:alpine --format '{{.Architecture}}'` — confirm the architecture matches your machine.

**Exercise 3:** Write a minimal `Dockerfile` that starts `FROM alpine` and adds a file. Build it as `yourusername/hello-docker:v1.0.0`, push it, then pull it on a second terminal session using `docker pull yourusername/hello-docker:v1.0.0` to confirm it is publicly accessible.

**Exercise 4:** Check Docker Hub rate limit headers. Run the two-step `TOKEN`/`curl --head` commands from Section 4. Observe the `RateLimit-Remaining` header value. Then `docker login` and repeat — the counter should reflect the authenticated limit.

**Exercise 5:** Set up the GitHub Actions workflow from Section 6 in a test repository. Push a tag matching `v*.*.*` (e.g. `git tag v0.1.0 && git push origin v0.1.0`). Verify the image appears in your Docker Hub repository with the correct version tag.

---

## 8. Interview Q&A

**Q: What happens when you run `docker pull nginx` without specifying a registry or tag?**
Answer: Docker resolves the image to `docker.io/library/nginx:latest`. The `docker.io` host is the default registry, `library` is the namespace for official images, and `:latest` is the default tag. The Docker daemon first checks if the image exists in the local cache; if not, it contacts Docker Hub and downloads the image layers.

**Q: How do Docker Hub pull rate limits work and how do you avoid hitting them in CI?**
Answer: Unauthenticated pulls are limited to 100 per 6 hours per source IP (a shared IP in CI means many teams hit the limit quickly). Authenticated free-tier accounts get 200 pulls per 6 hours. To avoid limits in CI: always run `docker login` at the start of the pipeline using a PAT stored as a secret. Paid Docker Hub plans have no pull limit.

**Q: What is a Personal Access Token (PAT) and why is it preferred over a password for `docker login`?**
Answer: A PAT is a scoped, revocable credential issued by Docker Hub (or any registry). It is preferred over a password because it can be scoped to read-only or read/write, it does not expose your account password if leaked, and it can be revoked without changing your main password. In CI, store the PAT as an encrypted secret and pass it via `--password-stdin` to avoid it appearing in process listings or logs.

**Q: How do you push an image to Docker Hub with multiple tags?**
Answer: Tag the image multiple times with `docker tag` (each tag points to the same image ID), then push each tag separately with `docker push`, or use `docker push --all-tags` to push every tag for a repository in one command. The image layers are only uploaded once — additional tags are just additional metadata references.

**Q: What replaced Docker Hub automated builds and why?**
Answer: Docker Hub discontinued its native automated builds in 2021 for free accounts. The modern replacement is CI/CD pipelines (GitHub Actions, GitLab CI, CircleCI, etc.) using `docker/build-push-action` or equivalent. This approach is more flexible: it supports multi-arch builds with `docker buildx`, custom build arguments, secrets management, and integration with any source control provider.
