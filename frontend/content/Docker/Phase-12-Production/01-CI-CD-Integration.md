# CI/CD Integration — Complete Guide

## Table of Contents
1. [What is CI/CD with Docker?](#1-what-is-cicd-with-docker)
2. [GitHub Actions Overview](#2-github-actions-overview)
3. [Full Pipeline: Build → Test → Push → Deploy](#3-full-pipeline-build--test--push--deploy)
4. [Image Tagging Strategy](#4-image-tagging-strategy)
5. [Deploying to a Remote Host](#5-deploying-to-a-remote-host)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is CI/CD with Docker?

CI/CD (Continuous Integration / Continuous Delivery) with Docker means your pipeline builds the same immutable image that moves all the way from a developer's pull request through to production.

```
Developer pushes code
         │
         ▼
┌─────────────────────────────────────────────────────┐
│               GitHub Actions (CI/CD)                │
│                                                     │
│  Step 1: Checkout code                              │
│  Step 2: Build Docker image                         │
│  Step 3: Run tests inside the image                 │
│  Step 4: Push image to registry (Hub / ECR)         │
│  Step 5: Deploy image to server / Kubernetes        │
└─────────────────────────────────────────────────────┘
         │
         ▼
Production running the exact image built from that commit
```

### Why Docker makes CI/CD better

```
Without Docker CI/CD:
  CI runner: Ubuntu 20.04 + Node 18.4
  Prod server: Ubuntu 22.04 + Node 18.12
  Result: subtle bugs only in production

With Docker CI/CD:
  CI builds image → image carries its own Node 18.4 → same in prod
  Environment is frozen inside the image
```

---

## 2. GitHub Actions Overview

GitHub Actions is a CI/CD platform built into GitHub. Pipelines are defined as YAML files in `.github/workflows/`.

```
Repository structure:
  .github/
    workflows/
      docker-publish.yml    ← CI/CD pipeline definition
  Dockerfile
  src/
  tests/
```

### Key Concepts

| Concept | Meaning |
|---------|---------|
| **Workflow** | The YAML file — the full pipeline |
| **Trigger** | What starts the pipeline (`push`, `pull_request`, `schedule`) |
| **Job** | A group of steps that run on one runner |
| **Step** | A single shell command or Action |
| **Action** | A reusable plugin (`actions/checkout`, `docker/build-push-action`) |
| **Secret** | Encrypted variable stored in GitHub Settings → Secrets |

---

## 3. Full Pipeline: Build → Test → Push → Deploy

### `.github/workflows/docker-publish.yml`

```yaml
name: Docker Build, Test, Push, Deploy

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

env:
  REGISTRY: docker.io
  IMAGE_NAME: ${{ github.repository }}   # e.g. myorg/myapp

jobs:
  build-test-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      # Step 1 — Checkout source code
      - name: Checkout repository
        uses: actions/checkout@v4

      # Step 2 — Set up Docker Buildx (multi-platform support)
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Step 3 — Log in to Docker Hub
      - name: Log in to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # Step 4 — Extract metadata for tags and labels
      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-,format=short
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      # Step 5 — Build image and run tests
      - name: Build image for testing
        uses: docker/build-push-action@v5
        with:
          context: .
          target: test          # multi-stage: build the test stage
          push: false
          load: true
          tags: myapp:test

      - name: Run tests inside the image
        run: docker run --rm myapp:test npm test

      # Step 6 — Build final image and push to registry
      - name: Build and push production image
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production    # multi-stage: build the production stage
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-test-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Deploy to production server via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            docker stop myapp || true
            docker rm myapp   || true
            docker run -d \
              --name myapp \
              --restart unless-stopped \
              -p 80:3000 \
              -e NODE_ENV=production \
              -e DATABASE_URL=${{ secrets.DATABASE_URL }} \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
```

### Multi-stage Dockerfile matching the pipeline

```dockerfile
# Stage 1 — install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2 — test stage (CI runs this)
FROM node:20-alpine AS test
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "test"]

# Stage 3 — production stage (deployed to prod)
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

---

## 4. Image Tagging Strategy

A consistent tagging strategy makes rollbacks and audits possible.

```
Recommended tags per release:
  myapp:sha-a3f2c1b         ← immutable, maps to exact git commit
  myapp:1.4.2               ← semantic version
  myapp:1.4                 ← minor version (floating)
  myapp:latest              ← latest on main (floating)

Flow:
  git push --tag v1.4.2
         │
         ▼
  GitHub Actions tags the image:
    docker tag myapp:sha-a3f2c1b myapp:1.4.2
    docker tag myapp:sha-a3f2c1b myapp:1.4
    docker tag myapp:sha-a3f2c1b myapp:latest
```

### Pushing to AWS ECR instead of Docker Hub

```yaml
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-2

      - name: Log in to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: myapp
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag  $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
                      $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
```

---

## 5. Deploying to a Remote Host

### Option A — SSH + docker pull (single server)

```bash
# On CI runner — SSH into prod and pull the new image
ssh deploy@prod.myapp.com "
  docker pull myorg/myapp:sha-a3f2c1b
  docker service update --image myorg/myapp:sha-a3f2c1b myapp_web
"
```

### Option B — docker-compose pull + up on the server

```yaml
# On the prod server: docker-compose.yml
version: "3.9"
services:
  web:
    image: myorg/myapp:${IMAGE_TAG}
    ports:
      - "80:3000"
    restart: unless-stopped
    env_file: .env.production
```

```bash
# CI step: update IMAGE_TAG and restart
ssh deploy@prod "
  export IMAGE_TAG=sha-a3f2c1b
  docker compose pull
  docker compose up -d --no-deps web
"
```

### Option C — Deploy to Kubernetes (see next lesson)

```bash
kubectl set image deployment/myapp \
  myapp=myorg/myapp:sha-a3f2c1b \
  --record
```

---

## 6. Hands-On Exercises

**Exercise 1:** Create a minimal Node.js Express app with a Dockerfile. Add a `.github/workflows/docker-publish.yml` that only builds and runs `docker build` on every push. Confirm it triggers in the Actions tab.

**Exercise 2:** Add a test step. Create a `Dockerfile` with a `test` stage that runs `npm test`. Update the workflow to build the test stage and run it with `docker run --rm`. Introduce a failing test and watch the pipeline fail — then fix it.

**Exercise 3:** Set up Docker Hub credentials as GitHub Secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`). Extend your workflow to push the image with the git SHA as the tag on every push to `main`. Verify the image appears on Docker Hub.

**Exercise 4:** Implement the full tagging strategy: push both `sha-<short>` and `latest` tags. Create a GitHub Release with a semver tag (`v1.0.0`) and confirm the pipeline also pushes that version tag.

**Exercise 5:** Add a `deploy` job that depends on `build-test-push`. Use `appleboy/ssh-action` or a `curl` webhook to trigger a simulated deploy. Confirm the `deploy` job only runs on pushes to `main` (not on pull requests).

---

## 7. Interview Q&A

**Q: What is the purpose of separating build, test, and deploy into distinct CI/CD stages?**
Answer: Each stage has a different risk profile and audience. The build stage verifies the image compiles. The test stage verifies correctness — failing here means no image is pushed. The deploy stage applies only images that have passed both gates. Separation also enables parallel jobs (e.g., unit tests and integration tests) and clear failure attribution.

**Q: Why should you tag images with the git SHA and not just `latest`?**
Answer: `latest` is a mutable, floating tag — it always points to the newest push, making rollbacks ambiguous. The git SHA produces an immutable tag that maps 1:1 to a commit, enabling precise rollbacks (`docker pull myapp:sha-a3f2c1b`), audit trails, and reproducible deployments. Semver tags provide human-readable release markers alongside the SHA.

**Q: How do you store secrets like Docker Hub credentials in a GitHub Actions pipeline?**
Answer: Via GitHub Settings → Secrets and variables → Actions. Secrets are encrypted at rest, masked in logs, and exposed to workflows as `${{ secrets.NAME }}`. Never hard-code credentials in the YAML. For cloud providers, use OIDC (OpenID Connect) identity federation instead of long-lived access keys where possible.

**Q: What is Docker layer caching in CI and why does it matter?**
Answer: Docker builds images layer by layer. If a layer's inputs haven't changed, Docker reuses the cached layer from a previous build. In CI, `cache-from: type=gha` restores the cache from GitHub Actions cache storage across runs. This can reduce a 5-minute build to under 30 seconds by skipping unchanged dependency installation steps.

**Q: What is the difference between `docker build` and `docker buildx build`?**
Answer: `docker build` uses the classic builder; `docker buildx build` uses BuildKit, which supports multi-platform images (build for `linux/amd64` and `linux/arm64` in one command), inline cache metadata, and more efficient layer exports. GitHub Actions' `docker/setup-buildx-action` enables BuildKit as the default builder, required for the `cache-from: type=gha` feature.
