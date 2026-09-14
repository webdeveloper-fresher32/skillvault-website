# Project 5 — CI/CD Pipeline with GitHub Actions

**Level:** Advanced
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 3 – Registries & Automation

---

## Overview

You will automate the complete container lifecycle using **GitHub Actions**:

1. A push to `main` triggers the workflow.
2. The image is built from the project Dockerfile.
3. A smoke-test container runs against the built image.
4. On success, the image is tagged and pushed to **Docker Hub**.
5. An optional deploy step pulls the new image on a remote server.

---

## Prerequisites

- A GitHub account and a repository for this project
- A Docker Hub account (free tier is fine)
- The Node.js API from Project 2 (or any Dockerised app) as the application code
- Familiarity with GitHub repository settings (Actions, Secrets)

---

## Project Structure

```
05-cicd-pipeline/
├── .github/
│   └── workflows/
│       └── docker.yml       ← the GitHub Actions workflow
├── src/
│   └── server.js            ← reuse from Project 2
├── package.json
├── Dockerfile
└── .dockerignore
```

---

## Step-by-Step Instructions

### Step 1 — Reuse the application code

Copy `src/server.js`, `package.json`, `.dockerignore`, and the `Dockerfile` from Project 2 into this directory. No changes are needed — the CI/CD machinery wraps any Dockerised application.

### Step 2 — Create the Dockerfile

If you are starting fresh, use this production-ready multi-stage Dockerfile:

```dockerfile
# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["node", "src/server.js"]
```

### Step 3 — Configure GitHub Secrets

In your GitHub repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | A Docker Hub **Access Token** (Account Settings → Security → New Access Token) |

Never use your Docker Hub password — access tokens can be revoked independently.

### Step 4 — Create the workflow file

Create `.github/workflows/docker.yml`:

```yaml
name: Build · Test · Push

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/nodejs-api

jobs:

  # ── Job 1: Build and test ──────────────────────────────────────────────────
  build-and-test:
    name: Build & smoke-test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Build the image and load it into the local Docker daemon for testing.
      # We use --load so the smoke-test step can run a container from it.
      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context:   .
          push:      false
          load:      true
          tags:      ${{ env.IMAGE_NAME }}:test
          cache-from: type=gha
          cache-to:   type=gha,mode=max

      # Start a container and probe the health endpoint.
      # If the health check returns a non-200 status, the job fails.
      - name: Smoke test
        run: |
          docker run -d --name smoke_test -p 3000:3000 ${{ env.IMAGE_NAME }}:test
          echo "Waiting for the app to become ready..."
          for i in $(seq 1 15); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true)
            if [ "$STATUS" = "200" ]; then
              echo "App is healthy (HTTP $STATUS)"
              break
            fi
            echo "Attempt $i: got HTTP $STATUS — retrying in 2s"
            sleep 2
          done
          [ "$STATUS" = "200" ] || (echo "Smoke test failed" && exit 1)

      - name: Collect logs on failure
        if: failure()
        run: docker logs smoke_test

      - name: Tear down smoke-test container
        if: always()
        run: docker rm -f smoke_test || true

  # ── Job 2: Push to Docker Hub (main branch only) ───────────────────────────
  push-to-registry:
    name: Push to Docker Hub
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # Extract metadata to generate tags automatically:
      # - latest         (always on main)
      # - sha-<short>    (unique per commit — great for rollbacks)
      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=sha-,format=short

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context:    .
          push:       true
          tags:       ${{ steps.meta.outputs.tags }}
          labels:     ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to:   type=gha,mode=max

      - name: Image digest
        run: echo "Pushed ${{ env.IMAGE_NAME }} — digest ${{ steps.build.outputs.digest }}"

  # ── Job 3: Deploy (optional — uncomment and configure) ─────────────────────
  # deploy:
  #   name: Deploy to server
  #   runs-on: ubuntu-latest
  #   needs: push-to-registry
  #   if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  #   steps:
  #     - name: SSH and pull new image
  #       uses: appleboy/ssh-action@v1
  #       with:
  #         host:     ${{ secrets.DEPLOY_HOST }}
  #         username: ${{ secrets.DEPLOY_USER }}
  #         key:      ${{ secrets.DEPLOY_SSH_KEY }}
  #         script: |
  #           docker pull ${{ env.IMAGE_NAME }}:latest
  #           docker stop app || true
  #           docker rm   app || true
  #           docker run -d --name app -p 3000:3000 ${{ env.IMAGE_NAME }}:latest
```

### Step 5 — Push and watch the pipeline

```bash
git init
git remote add origin https://github.com/<your-username>/<your-repo>.git
git add .
git commit -m "feat: add CI/CD pipeline"
git push -u origin main
```

Navigate to the **Actions** tab in your GitHub repository. You will see the workflow running. Click into each job to follow the live logs.

### Step 6 — Verify the image on Docker Hub

```bash
# Pull and run the pushed image locally
docker run -d -p 3000:3000 <your-dockerhub-username>/nodejs-api:latest
curl http://localhost:3000/
```

---

## Explanation of Each Job Step

| Step | Purpose |
|------|---------|
| `actions/checkout@v4` | Checks out the repository code into the runner |
| `docker/setup-buildx-action@v3` | Enables BuildKit features (cache, multi-platform) |
| `docker/build-push-action@v5` | Builds the image, optionally pushes to a registry |
| `cache-from / cache-to: type=gha` | Stores layer cache in GitHub Actions cache — speeds up subsequent builds |
| Smoke test loop | Polls the health endpoint until the app responds or times out |
| `docker/login-action@v3` | Authenticates to Docker Hub using the stored secrets |
| `docker/metadata-action@v5` | Generates tags (`latest`, `sha-abc1234`) from Git context |

---

## How to Verify It Works

| Check | Where | Expected result |
|-------|-------|-----------------|
| Workflow triggered | GitHub → Actions tab | Workflow appears and turns green |
| Image on Docker Hub | hub.docker.com → your repository | Tags `latest` and `sha-*` present |
| Image runs locally | `docker run` command above | `{"status":"ok"}` from the API |
| PR does not push | Open a pull request | `build-and-test` runs; `push-to-registry` is skipped |

---

## Stretch Goals

1. **Semantic versioning** — add a `type=semver,pattern={{version}}` tag using Git tags (`git tag v1.0.0 && git push --tags`).
2. **Multi-platform build** — add `platforms: linux/amd64,linux/arm64` to build for both Intel and Apple Silicon simultaneously.
3. **Security scan** — insert a `docker/scout-action` step after the build to fail the workflow if critical CVEs are found.
4. **Slack notification** — add a final step that posts the workflow result (pass/fail + image digest) to a Slack channel.
5. **Matrix build** — test the image against both `node:20-alpine` and `node:22-alpine` using a build matrix.
