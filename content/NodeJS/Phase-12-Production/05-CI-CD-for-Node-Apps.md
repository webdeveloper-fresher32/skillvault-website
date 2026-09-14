# CI/CD for Node Apps — Complete Guide

## Table of Contents
1. [Why CI/CD](#1-why-cicd)
2. [Anatomy of a Pipeline](#2-anatomy-of-a-pipeline)
3. [A Complete GitHub Actions Workflow](#3-a-complete-github-actions-workflow)
4. [Deploying to a Container Registry and Server](#4-deploying-to-a-container-registry-and-server)
5. [Pipeline Best Practices](#5-pipeline-best-practices)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why CI/CD

**Continuous Integration (CI):** every push/PR automatically installs dependencies, lints, and runs tests — catching bugs before they merge.

**Continuous Deployment/Delivery (CD):** every merge to the main branch (or a tag) automatically builds and ships the app to staging/production — removing manual, error-prone deploy steps.

```
Without CI/CD:                          With CI/CD:
Dev pushes code                         Dev pushes code
  → hopes tests were run locally          → pipeline auto-runs lint + tests
  → manually SSHs to server                 → pipeline builds Docker image
  → manually pulls code, restarts           → pipeline pushes image to registry
  → no consistent record of what shipped    → pipeline deploys automatically
  → "works on my machine" risk              → identical, repeatable process every time
```

---

## 2. Anatomy of a Pipeline

A typical Node.js pipeline has these stages, run in order (failing fast at the first broken stage):

```
1. Install    → npm ci (deterministic, from lockfile)
2. Lint       → eslint . (catch style/bug patterns before tests even run)
3. Test       → npm test (unit + integration tests, with coverage)
4. Build      → npm run build (if TypeScript/bundled) and/or docker build
5. Deploy     → push image to registry + trigger deployment (only on main/tags)
```

Stages 1–4 typically run on **every push and pull request**. Stage 5 typically runs only **after merge to `main`** (or on a version tag), so unfinished feature branches never deploy.

---

## 3. A Complete GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18.x'

jobs:
  # ---------- CI: runs on every push and PR ----------
  test:
    name: Lint & Test
    runs-on: ubuntu-latest

    services:
      # Spin up a real Postgres for integration tests
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests with coverage
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db
          NODE_ENV: test

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  # ---------- CI: build the Docker image (runs on every push/PR too, to catch build errors early) ----------
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t my-node-app:${{ github.sha }} .

      - name: Smoke-test the image
        run: |
          docker run -d --name smoke-test -p 3000:3000 my-node-app:${{ github.sha }}
          sleep 3
          curl --fail http://localhost:3000/health/live
          docker stop smoke-test

  # ---------- CD: only runs after a successful merge to main ----------
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to container registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest

      - name: Deploy to server
        run: |
          curl -X POST "${{ secrets.DEPLOY_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -d '{"image": "ghcr.io/${{ github.repository }}:${{ github.sha }}"}'
```

Notes on this workflow:
- `services.postgres` spins up a real Postgres container for the job — integration tests run against a real DB, not a mock, catching real query bugs.
- `needs: test` / `needs: [test, build]` enforces stage ordering — deploy never runs if tests or the build fail.
- `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` ensures deployment only fires on merges to `main`, never on PRs from forks or feature branches.
- Secrets (`DEPLOY_WEBHOOK_URL`, `DEPLOY_TOKEN`) are stored in GitHub repo/organization Settings → Secrets, never hardcoded in the YAML (see `01-Environment-Config-and-Secrets.md`).

---

## 4. Deploying to a Container Registry and Server

The pipeline above pushes to **GHCR** (GitHub Container Registry); the same pattern applies to Docker Hub or AWS ECR with a different `login-action`/registry URL. Once the image is pushed, "deploy" typically means one of:

| Deploy target | Mechanism |
|----------------|-----------|
| Single VM (Docker) | SSH in and run `docker pull` + `docker run` (or a webhook triggers this remotely, as above) |
| Kubernetes cluster | Update the image tag in a Deployment manifest (`kubectl set image ...`) — see `../../Kubernetes/` for full Deployment/rollout mechanics |
| PaaS (Heroku, Render, Railway, etc.) | Push triggers the platform's own build/deploy pipeline |

For a Kubernetes deploy step, the workflow's final step commonly looks like:

```yaml
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/my-node-app \
            my-node-app=ghcr.io/${{ github.repository }}:${{ github.sha }} \
            --namespace production
```

That single line kicks off a rolling update — see `../../Kubernetes/` for how Deployments perform rolling updates and rollbacks.

---

## 5. Pipeline Best Practices

- **Fail fast**: run cheap checks (lint) before expensive ones (integration tests, Docker build).
- **Cache dependencies**: `actions/setup-node`'s `cache: 'npm'` avoids re-downloading packages every run.
- **Pin Node version**: use the same major version in CI as production to avoid version-specific bugs slipping through.
- **Use `npm ci`, not `npm install`**, in CI for the same reproducibility reasons as in Docker builds (see `03-Dockerizing-a-Node-App.md`).
- **Never deploy from an untested branch**: gate the deploy job with `needs:` and branch/event conditions.
- **Keep secrets out of YAML**: use `${{ secrets.X }}`, never inline tokens or credentials.
- **Smoke-test the built artifact**: a quick health-check curl against the freshly built image catches "builds fine but doesn't start" failures before they reach production.

---

## 6. Hands-On Exercises

**Exercise 1:** Create a `.github/workflows/ci.yml` that checks out code, sets up Node, runs `npm ci`, `npm run lint`, and `npm test` on every push and PR to `main`.

**Exercise 2:** Add a `postgres` (or `mongo`) service container to the workflow and point your integration tests at it via an env var, confirming tests pass against the real service in CI.

**Exercise 3:** Add a `build` job that runs `docker build` on the repo and then does a smoke test: run the container, curl a health endpoint, and fail the job if it doesn't return 200.

**Exercise 4:** Add a `deploy` job gated with `needs: [test, build]` and an `if` condition restricting it to `main` pushes only. Point it at a container registry login + push (GHCR is free to try with a GitHub repo).

**Exercise 5:** Store a fake secret (e.g., `DEPLOY_TOKEN`) in your repo's GitHub Settings → Secrets, reference it in the workflow as `${{ secrets.DEPLOY_TOKEN }}`, and confirm it never appears in plaintext in the Actions log output (GitHub auto-masks it).

---

## 7. Interview Q&A

**Q: What's the difference between Continuous Integration and Continuous Deployment?**
Answer: Continuous Integration automatically builds, lints, and tests every code change (push/PR) to catch problems before merge. Continuous Deployment goes further — after a successful merge to the main branch (or a tag), the pipeline automatically builds and ships the app to staging/production without manual intervention. CI catches bugs early; CD removes manual, error-prone release steps.

**Q: Why should `npm ci` be used in a CI pipeline instead of `npm install`?**
Answer: `npm ci` installs exact versions from `package-lock.json` and fails if the lockfile is missing or out of sync, guaranteeing every pipeline run installs identical dependency versions. `npm install` can silently update the lockfile or resolve slightly different versions over time, which risks "works in CI, breaks in prod" or flaky, non-reproducible test runs.

**Q: How would you ensure a CI/CD pipeline never deploys code that hasn't passed tests?**
Answer: Structure the pipeline as dependent jobs using `needs:` (e.g., a `deploy` job with `needs: [test, build]`), so GitHub Actions only runs `deploy` if the `test` and `build` jobs succeed. Combine this with a branch/event condition (`if: github.ref == 'refs/heads/main'`) so deployment only triggers on merges to the protected main branch, not arbitrary feature-branch pushes or forked PRs.

**Q: How should secrets like deploy tokens or database credentials be handled in a GitHub Actions workflow?**
Answer: Store them in GitHub repository or organization Settings → Secrets, and reference them in the YAML via `${{ secrets.NAME }}` — GitHub injects them as masked environment variables at runtime and automatically redacts them from log output. They should never be hardcoded in the workflow file or committed anywhere in the repo.

**Q: Why include a "smoke test" step after building a Docker image in CI, before deploying?**
Answer: A successful `docker build` only proves the image compiled — it doesn't guarantee the app actually starts and serves traffic correctly (e.g., a missing runtime env var or misconfigured start command could still break it). Running the container and curling a health endpoint immediately after build catches "builds but doesn't run" failures in CI, before they'd otherwise surface as a failed deployment or outage in production.

**Q: How does a typical CI/CD pipeline hand off a Node app deployment to Kubernetes?**
Answer: After the pipeline builds and pushes a new image to a container registry (tagged with the commit SHA), the deploy step typically runs something like `kubectl set image deployment/<name> <container>=<new-image> --namespace <ns>`, which tells Kubernetes to perform a rolling update — replacing pods with the new image version gradually while keeping the service available. The pipeline itself doesn't need to manage the rollout logic; Kubernetes' Deployment controller handles that.
