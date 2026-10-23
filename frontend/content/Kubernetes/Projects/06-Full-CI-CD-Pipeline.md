---
# Project 6: Full CI/CD Pipeline

**Level:** Advanced
**Time estimate:** 120 – 180 minutes
**Phase prerequisite:** Phase 11-12

## Overview

This project implements a production-grade end-to-end GitOps pipeline. A developer push triggers GitHub Actions, which builds and pushes a Docker image to GitHub Container Registry (GHCR). The CI workflow then updates the image tag in a separate GitOps manifests repository. ArgoCD watches the manifests repo and automatically syncs the desired state to the Kubernetes cluster — no manual kubectl applies required.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        End-to-End GitOps Flow                                   │
│                                                                                 │
│  Developer                                                                      │
│     │                                                                           │
│     │  git push                                                                 │
│     ▼                                                                           │
│  ┌──────────┐     webhook     ┌─────────────────────┐                          │
│  │  GitHub   │ ─────────────► │   GitHub Actions CI  │                          │
│  │  (app     │                │                      │                          │
│  │   repo)   │                │  1. Checkout code     │                          │
│  └──────────┘                 │  2. Build Docker img  │                          │
│                               │  3. Push to GHCR      │──────► ┌──────────────┐ │
│                               │  4. Update manifest   │        │     GHCR      │ │
│                               │  5. Push to GitOps    │        │ (image store) │ │
│                               └─────────────────────┘        └──────────────┘ │
│                                          │                                      │
│                                          │  git push                            │
│                                          ▼                                      │
│                               ┌─────────────────────┐                          │
│                               │   GitOps Repo        │                          │
│                               │   (manifests)        │◄─── ArgoCD polls         │
│                               └─────────────────────┘      every 3 min         │
│                                                                  │               │
│                                                                  │  sync         │
│                                                                  ▼               │
│                               ┌─────────────────────────────────────────────┐  │
│                               │            Kubernetes Cluster                │  │
│                               │                                              │  │
│                               │   ┌──────────┐   ┌──────────┐              │  │
│                               │   │  Pod v2   │   │  Pod v2   │             │  │
│                               │   │ (new img) │   │ (new img) │             │  │
│                               │   └──────────┘   └──────────┘              │  │
│                               └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- A Kubernetes cluster (kind, k3d, EKS, GKE, AKS, or any kubeadm cluster)
- `kubectl` configured and pointing at your cluster
- `helm` v3 installed
- A GitHub account with two repositories:
  - `my-app` — the Node.js application source code
  - `my-app-manifests` — the Kubernetes manifests (GitOps repo)
- `argocd` CLI installed (`brew install argocd` or download binary)
- Docker Desktop or equivalent for local testing

## What You'll Learn

- How to structure a GitOps workflow separating app code from deployment manifests
- Building and tagging Docker images with Git SHA for immutable deployments
- Pushing images to GitHub Container Registry (GHCR) with OIDC authentication
- Automating manifest updates via `sed` or `yq` inside GitHub Actions
- Installing and configuring ArgoCD for automatic cluster synchronisation
- Using ArgoCD's Application CRD to declaratively manage deployments
- Verifying rolling updates and performing rollbacks via ArgoCD UI and CLI
- Using `kubectl rollout` commands to monitor deployment progress

## Project Structure

```
.
├── my-app/                             # Application source repo
│   ├── .github/
│   │   └── workflows/
│   │       └── deploy.yml             # CI/CD pipeline
│   ├── src/
│   │   └── index.js                   # Node.js app
│   ├── Dockerfile
│   └── package.json
│
└── my-app-manifests/                  # GitOps manifests repo
    ├── apps/
    │   └── my-app/
    │       ├── namespace.yaml
    │       ├── deployment.yaml        # Image tag updated by CI
    │       ├── service.yaml
    │       └── ingress.yaml
    └── argocd/
        └── application.yaml          # ArgoCD Application CRD
```

## Step-by-Step Guide

### Step 1: Create the Node.js Application

Create `my-app/src/index.js`:

```javascript
const http = require('http');

const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || 'v1.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: VERSION }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Hello from my-app ${VERSION}\n`);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, version ${VERSION}`);
});
```

Create `my-app/package.json`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/index.js",
    "test": "echo 'Tests passed'"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### Step 2: Write the Dockerfile

Create `my-app/Dockerfile`:

```dockerfile
# ----- Build stage -----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ----- Runtime stage -----
FROM node:20-alpine AS runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./

USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "src/index.js"]
```

### Step 3: Create the Kubernetes Manifests

Create `my-app-manifests/apps/my-app/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: my-app
  labels:
    app.kubernetes.io/managed-by: argocd
```

Create `my-app-manifests/apps/my-app/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
  labels:
    app: my-app
    app.kubernetes.io/managed-by: argocd
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # Zero-downtime rolling update
  template:
    metadata:
      labels:
        app: my-app
      annotations:
        # Force pod restart when config changes even if image tag is the same
        rollme: "{{ randAlphaNum 5 | quote }}"
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: my-app
          # CI pipeline replaces this tag on every push
          image: ghcr.io/YOUR_GITHUB_USERNAME/my-app:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: PORT
              value: "3000"
            - name: APP_VERSION
              valueFrom:
                fieldRef:
                  fieldPath: metadata.labels['app.kubernetes.io/version']
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]
      imagePullSecrets:
        - name: ghcr-pull-secret
```

Create `my-app-manifests/apps/my-app/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: my-app
  labels:
    app: my-app
spec:
  selector:
    app: my-app
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

Create `my-app-manifests/apps/my-app/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  namespace: my-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  rules:
    - host: my-app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

### Step 4: Set Up GitHub Secrets

In your `my-app` GitHub repository, add these secrets under **Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|---|---|
| `GHCR_TOKEN` | A GitHub Personal Access Token with `write:packages` scope |
| `MANIFESTS_DEPLOY_KEY` | Private SSH key with write access to `my-app-manifests` repo |

For GHCR, you can also use the built-in `GITHUB_TOKEN` with `packages: write` permission — this is preferred for same-org repos (shown in Step 5).

### Step 5: Write the GitHub Actions Workflow

Create `my-app/.github/workflows/deploy.yml`:

```yaml
name: Build, Push, and Deploy

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}           # e.g. youruser/my-app

permissions:
  contents: read
  packages: write                                 # Required to push to GHCR
  id-token: write                                 # Required for OIDC (optional)

jobs:
  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}
      image-digest: ${{ steps.build-push.outputs.digest }}

    steps:
      - name: Checkout application code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            # Tag with short Git SHA (first 7 chars) — immutable
            type=sha,prefix=sha-,format=short
            # Tag with full branch name
            type=ref,event=branch
            # Tag 'latest' only on main branch pushes
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push Docker image
        id: build-push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Generate artifact attestation
        if: github.event_name != 'pull_request'
        uses: actions/attest-build-provenance@v1
        with:
          subject-name: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          subject-digest: ${{ steps.build-push.outputs.digest }}
          push-to-registry: true

  update-manifests:
    name: Update GitOps Manifests
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'

    steps:
      - name: Checkout manifests repository
        uses: actions/checkout@v4
        with:
          repository: YOUR_GITHUB_USERNAME/my-app-manifests
          token: ${{ secrets.MANIFESTS_DEPLOY_KEY }}
          path: manifests

      - name: Install yq (YAML processor)
        run: |
          sudo wget -qO /usr/local/bin/yq \
            https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
          sudo chmod +x /usr/local/bin/yq

      - name: Update image tag in deployment manifest
        env:
          NEW_TAG: sha-${{ github.sha }}
          IMAGE_BASE: ghcr.io/YOUR_GITHUB_USERNAME/my-app
        run: |
          cd manifests

          # Show what we're changing
          echo "Updating image tag to: ${IMAGE_BASE}:${NEW_TAG}"

          # Use yq to safely update the image field (handles YAML correctly)
          yq e -i \
            '.spec.template.spec.containers[0].image = strenv(IMAGE_BASE) + ":" + strenv(NEW_TAG)' \
            apps/my-app/deployment.yaml

          # Also update the app version label
          yq e -i \
            ".spec.template.metadata.labels[\"app.kubernetes.io/version\"] = \"${NEW_TAG}\"" \
            apps/my-app/deployment.yaml

          # Verify the change
          echo "Updated deployment.yaml:"
          grep -A2 "image:" apps/my-app/deployment.yaml

          # Alternative: sed-based approach (simpler, less safe for complex YAML)
          # sed -i "s|image: ghcr.io/.*/my-app:.*|image: ${IMAGE_BASE}:${NEW_TAG}|g" \
          #   apps/my-app/deployment.yaml

      - name: Commit and push manifest changes
        run: |
          cd manifests

          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          git add apps/my-app/deployment.yaml

          # Only commit if there are actual changes
          if git diff --staged --quiet; then
            echo "No changes to commit — image tag unchanged"
            exit 0
          fi

          git commit -m "chore(deploy): update my-app image to sha-${GITHUB_SHA::7}

          Triggered by: ${{ github.actor }}
          Workflow run: ${{ github.run_id }}
          Commit: ${{ github.sha }}"

          git push origin main

      - name: Post deployment summary
        run: |
          echo "### Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| Image | \`ghcr.io/YOUR_GITHUB_USERNAME/my-app:sha-${GITHUB_SHA::7}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Digest | \`${{ needs.build-and-push.outputs.image-digest }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Manifests commit | pushed to my-app-manifests/main |" >> $GITHUB_STEP_SUMMARY
          echo "| ArgoCD will sync | within 3 minutes |" >> $GITHUB_STEP_SUMMARY
```

### Step 6: Install ArgoCD

```bash
# Create the argocd namespace
kubectl create namespace argocd

# Install ArgoCD using the official manifests
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all ArgoCD pods to become ready
kubectl wait --for=condition=Ready pod \
  -l app.kubernetes.io/name=argocd-server \
  -n argocd \
  --timeout=120s

# Watch rollout progress
kubectl rollout status deployment/argocd-server -n argocd

# Verify all pods are running
kubectl get pods -n argocd
# Expected output:
# argocd-application-controller-0          1/1  Running
# argocd-applicationset-controller-xxx     1/1  Running
# argocd-dex-server-xxx                    1/1  Running
# argocd-notifications-controller-xxx      1/1  Running
# argocd-redis-xxx                         1/1  Running
# argocd-repo-server-xxx                   1/1  Running
# argocd-server-xxx                        1/1  Running
```

### Step 7: Access the ArgoCD UI

```bash
# Retrieve the initial admin password
ARGOCD_PWD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD admin password: $ARGOCD_PWD"

# Port-forward the ArgoCD server to localhost
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Now open https://localhost:8080 in your browser
# Username: admin
# Password: (from the command above)

# Or log in via CLI
argocd login localhost:8080 \
  --username admin \
  --password "$ARGOCD_PWD" \
  --insecure

# Change the default password immediately
argocd account update-password \
  --current-password "$ARGOCD_PWD" \
  --new-password "YourSecurePassword123!"

# List current applications
argocd app list
```

### Step 8: Connect ArgoCD to Your Manifests Repository

```bash
# If your manifests repo is private, add it with credentials
argocd repo add https://github.com/YOUR_GITHUB_USERNAME/my-app-manifests \
  --username YOUR_GITHUB_USERNAME \
  --password YOUR_GITHUB_PAT

# For SSH-based authentication
argocd repo add git@github.com:YOUR_GITHUB_USERNAME/my-app-manifests.git \
  --ssh-private-key-path ~/.ssh/id_rsa

# Verify the repo is connected (should show "Successful")
argocd repo list
```

### Step 9: Create the ArgoCD Application

Create `my-app-manifests/argocd/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  finalizers:
    # Ensures all child resources are deleted when the Application is deleted
    - resources-finalizer.argocd.argoproj.io
  labels:
    app: my-app
    team: platform
spec:
  project: default

  source:
    repoURL: https://github.com/YOUR_GITHUB_USERNAME/my-app-manifests
    targetRevision: HEAD           # Track the default branch tip
    path: apps/my-app              # Path within the repo to sync from

  destination:
    server: https://kubernetes.default.svc    # In-cluster deployment
    namespace: my-app

  syncPolicy:
    automated:
      prune: true                  # Remove resources deleted from the repo
      selfHeal: true               # Re-sync if cluster drifts from desired state
      allowEmpty: false            # Prevent accidental deletion of all resources
    syncOptions:
      - CreateNamespace=true       # Auto-create the target namespace
      - PrunePropagationPolicy=foreground
      - PruneLast=true             # Prune old resources after new ones are healthy
    retry:
      limit: 5                     # Retry failed syncs up to 5 times
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  revisionHistoryLimit: 10        # Keep last 10 deployment history entries

  # Health check overrides (optional)
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas           # Ignore replica count if HPA is managing it
```

Apply the Application to the cluster:

```bash
# Apply the ArgoCD Application manifest
kubectl apply -f my-app-manifests/argocd/application.yaml

# Or create it imperatively via CLI
argocd app create my-app \
  --repo https://github.com/YOUR_GITHUB_USERNAME/my-app-manifests \
  --path apps/my-app \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace my-app \
  --sync-policy automated \
  --auto-prune \
  --self-heal

# Check the application status
argocd app get my-app

# Trigger a manual sync if needed
argocd app sync my-app

# Watch sync status in real time
argocd app wait my-app --health
```

### Step 10: Configure GHCR Image Pull Secret

The cluster needs credentials to pull private images from GHCR:

```bash
# Create a Personal Access Token with read:packages scope
# Then create the pull secret in the my-app namespace
kubectl create secret docker-registry ghcr-pull-secret \
  --namespace my-app \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=your@email.com

# Verify the secret was created
kubectl get secret ghcr-pull-secret -n my-app
kubectl describe secret ghcr-pull-secret -n my-app

# Alternatively, patch the default service account to use the pull secret
kubectl patch serviceaccount default \
  -n my-app \
  -p '{"imagePullSecrets": [{"name": "ghcr-pull-secret"}]}'
```

### Step 11: Trigger the Full Pipeline

```bash
# Make a code change in your app repo
cd my-app
echo "// Updated: $(date)" >> src/index.js

# Commit and push — this triggers the GitHub Actions workflow
git add src/index.js
git commit -m "feat: add timestamp to demonstrate GitOps pipeline"
git push origin main

# --- In GitHub ---
# Navigate to: https://github.com/YOUR_GITHUB_USERNAME/my-app/actions
# Watch the "Build, Push, and Deploy" workflow run
# Steps: checkout → login → build → push → update manifests → commit

# --- After CI completes (~3-5 min) ---
# ArgoCD will detect the manifest change and sync automatically

# Watch the deployment rollout on the cluster
kubectl rollout status deployment/my-app -n my-app
# Output: Waiting for deployment "my-app" rollout to finish: 1 out of 3 new replicas have been updated...
#         Waiting for deployment "my-app" rollout to finish: 2 out of 3 new replicas have been updated...
#         deployment "my-app" successfully rolled out

# Verify the new pod image is correct
kubectl get pods -n my-app -o wide
kubectl describe pod -n my-app -l app=my-app | grep Image:

# Check the rollout history
kubectl rollout history deployment/my-app -n my-app
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>
```

### Step 12: Rollback Procedures

**Option A: Rollback via ArgoCD (recommended for GitOps)**

```bash
# View application history in ArgoCD
argocd app history my-app
# ID  DATE                           REVISION
# 0   2024-01-15 10:00:00 +0000 UTC  abc1234
# 1   2024-01-15 11:30:00 +0000 UTC  def5678

# Roll back to a previous revision (by ArgoCD history ID)
argocd app rollback my-app 0

# Check the status after rollback
argocd app get my-app
argocd app wait my-app --health

# IMPORTANT: After rolling back via ArgoCD, also revert the manifest commit in Git
# so ArgoCD's auto-sync doesn't re-apply the bad version
cd my-app-manifests
git log --oneline -5
git revert HEAD --no-edit       # Creates a new revert commit
git push origin main
```

**Option B: Rollback via kubectl (emergency)**

```bash
# Immediately roll back to the previous deployment revision
kubectl rollout undo deployment/my-app -n my-app

# Roll back to a specific revision number
kubectl rollout undo deployment/my-app -n my-app --to-revision=1

# Watch the rollback progress
kubectl rollout status deployment/my-app -n my-app

# Verify pods are running the old image
kubectl describe deployment/my-app -n my-app | grep Image

# NOTE: This kubectl rollback will cause ArgoCD to detect drift (OutOfSync)
# because the cluster no longer matches the manifests repo.
# Always follow up by reverting the Git commit to keep GitOps in sync.
```

**Option C: Emergency — Disable auto-sync and pin image**

```bash
# Temporarily disable ArgoCD auto-sync for manual intervention
argocd app set my-app --sync-policy none

# Make your emergency change directly
kubectl set image deployment/my-app \
  my-app=ghcr.io/YOUR_GITHUB_USERNAME/my-app:sha-abc1234 \
  -n my-app

# After stabilising, revert manifests in Git, then re-enable sync
argocd app set my-app --sync-policy automated
argocd app sync my-app
```

## Verification

| Check | Command | Expected Result |
|---|---|---|
| ArgoCD pods running | `kubectl get pods -n argocd` | All pods in Running state |
| Application synced | `argocd app get my-app` | Health: Healthy, Sync: Synced |
| Deployment available | `kubectl get deploy -n my-app` | READY shows 3/3 |
| Pods use new image | `kubectl describe pod -n my-app -l app=my-app \| grep Image:` | Shows sha-XXXXXXX tag |
| Service reachable | `kubectl port-forward svc/my-app 8080:80 -n my-app` | curl localhost:8080 returns app response |
| Rollout completed | `kubectl rollout status deploy/my-app -n my-app` | "successfully rolled out" |
| GHCR image exists | `docker pull ghcr.io/YOUR_GITHUB_USERNAME/my-app:latest` | Pulls successfully |
| GitHub Actions green | Check GitHub Actions tab | All steps show green checkmarks |
| Manifests repo updated | `git log my-app-manifests` | Latest commit shows updated image tag |
| ArgoCD history | `argocd app history my-app` | Shows multiple revision entries |

## Challenges

**Challenge 1: Add a Staging Environment**

Extend the pipeline to support a staging environment that deploys automatically, but requires a manual approval gate before production:

- Create a `apps/my-app-staging/` directory in the manifests repo with its own `deployment.yaml`
- Add a second ArgoCD Application targeting the `staging` namespace
- Modify the GitHub Actions workflow to update `staging` manifests automatically on every push, but use `environment: production` with a required reviewer for the production manifest update step
- Verify by pushing a change and watching it deploy to staging automatically, then manually approving the production promotion

**Challenge 2: Implement Notifications**

Configure ArgoCD to send Slack notifications when a sync completes or fails:

- Install the ArgoCD Notifications controller (included in ArgoCD >= 2.3)
- Create a Slack webhook secret in the `argocd` namespace
- Apply an `argocd-notifications-cm` ConfigMap with a Slack trigger template
- Annotate the Application with `notifications.argoproj.io/subscribe.on-sync-succeeded.slack: your-channel`
- Trigger a deployment and verify the Slack message arrives

**Challenge 3: Add Image Vulnerability Scanning**

Integrate Trivy image scanning into the CI pipeline before pushing to GHCR:

- Add a `scan` job to the GitHub Actions workflow that runs between build and push
- Use `aquasecurity/trivy-action@master` to scan the built image
- Fail the pipeline if any CRITICAL vulnerabilities are found (`exit-code: '1'`, `severity: CRITICAL`)
- Configure a `.trivyignore` file in the repo to suppress known false positives
- Add a step that uploads the Trivy SARIF report to GitHub Security tab using `upload-sarif`

## Key Takeaways

- **GitOps separates concerns**: application code lives in one repo, deployment manifests in another. This makes it easy to audit what is deployed and when, without mixing CI logic with Kubernetes YAML.
- **Immutable image tags** (Git SHA) are essential for reproducibility. Using `latest` makes it impossible to know which code version is running.
- **ArgoCD as the deployment agent** means no CI credentials need write access to the cluster. The cluster pulls its desired state from Git rather than being pushed to by CI.
- **Auto-sync + self-heal** protects against configuration drift. If someone manually edits a resource in the cluster, ArgoCD will revert it within minutes.
- **Rolling updates with `maxUnavailable: 0`** combined with readiness probes guarantee zero-downtime deployments — a new pod must pass health checks before the old one is terminated.
- **Rollback should be a Git operation**: reverting a commit in the manifests repo gives you a full audit trail and re-triggers the normal ArgoCD sync flow, rather than using out-of-band kubectl commands.
- **The `preStop` sleep hook** gives the load balancer time to remove the pod from rotation before the process exits, preventing in-flight requests from being dropped during termination.
