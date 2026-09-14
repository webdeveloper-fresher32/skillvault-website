# CI/CD for Kubernetes — Complete Guide

## Table of Contents

1. [CI/CD Flow for Kubernetes](#1-cicd-flow-for-kubernetes)
2. [Image Tag Strategies](#2-image-tag-strategies)
3. [GitHub Actions — Build and Deploy Pipeline](#3-github-actions--build-and-deploy-pipeline)
4. [GitOps with ArgoCD](#4-gitops-with-argocd)
5. [ArgoCD Application Manifest](#5-argocd-application-manifest)
6. [Rolling Deployments](#6-rolling-deployments)
7. [Blue/Green Deployments](#7-bluegreen-deployments)
8. [Canary Deployments](#8-canary-deployments)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. CI/CD Flow for Kubernetes

A CI/CD pipeline for Kubernetes has two distinct phases: a **continuous integration** phase that validates and packages your application into a container image, and a **continuous delivery** phase that deploys that image to the cluster. Understanding the boundary between these phases — and how information (specifically the image tag) flows from one to the other — is the foundation for everything else in this guide.

### The End-to-End Pipeline

```
Developer pushes code
         │
         ▼
┌─────────────────┐
│   CI Pipeline   │
│                 │
│  1. git clone   │
│  2. run tests   │
│  3. docker build│
│  4. docker push │
│     to registry │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   CD Pipeline   │
│                 │
│  5. update K8s  │
│     manifests   │
│  6. kubectl     │
│     apply OR    │
│     ArgoCD sync │
└────────┬────────┘
         │
         ▼
  Kubernetes cluster
  applies new image
```

The **CI phase** is triggered by a `git push` or pull request merge. The runner checks out the code, executes the test suite, builds a Docker image, and pushes it to a container registry (Docker Hub, GitHub Container Registry, Amazon ECR, Google Artifact Registry, etc.). The image is tagged with a unique identifier — typically the git commit SHA — so every build is traceable back to an exact point in history.

The **CD phase** takes the image tag produced by CI and updates the Kubernetes cluster. There are two broad approaches to this update step: **push-based** and **pull-based (GitOps)**.

### Push-Based Deployment

In a push-based pipeline, the CI runner has `kubectl` installed and cluster credentials in a secret. After pushing the image, the runner runs `kubectl set image` or `kubectl apply` directly against the cluster.

```
CI Runner ──── kubectl apply ────► Kubernetes API Server
                (credentials
                 stored in CI secret)
```

**Advantages:** Simple to set up. Works with any CI platform. No additional tooling in the cluster.

**Disadvantages:** Cluster credentials must be stored in the CI system, which is a security risk if the CI platform is compromised. There is no audit trail beyond the CI job logs. If someone runs `kubectl` manually and changes cluster state, the pipeline has no way to detect or correct the drift. The cluster's desired state is not recorded anywhere declaratively.

### Pull-Based Deployment (GitOps)

In a GitOps pipeline, a tool running inside the cluster (typically ArgoCD or Flux) continuously watches a Git repository. The CI pipeline updates the Git repository (e.g., commits a new image tag to a manifest), and the in-cluster agent detects the change and applies it.

```
CI Runner ──── git push ────► Git Repository (source of truth)
                                       │
                                       │  ArgoCD watches
                                       ▼
                              ArgoCD (in cluster)
                                       │
                                       │  kubectl apply
                                       ▼
                              Kubernetes API Server
```

**Advantages:** Git is the single source of truth. Every change has a git commit with an author, timestamp, and message — a complete audit trail. Drift between desired and actual state is automatically detected and corrected. CI runners do not need cluster credentials. Rollback is a `git revert`.

**Disadvantages:** Requires additional tooling (ArgoCD or Flux) in the cluster. The GitOps repository update step (committing the new image tag) adds complexity to the CI pipeline. Debugging requires understanding two systems: the CI runner and the GitOps agent.

For production systems, GitOps is the recommended approach. Push-based pipelines are acceptable for smaller projects or teams that are just starting with Kubernetes.

---

## 2. Image Tag Strategies

Image tagging is one of the most consequential — and most commonly mishandled — decisions in a Kubernetes deployment pipeline. The tag you choose determines traceability, rollback capability, and whether Kubernetes knows to pull a new image.

### Why `latest` Is Dangerous

The `latest` tag is a convention, not a guarantee. It is simply a mutable pointer that gets reassigned each time you push a new image without specifying a tag. Using `latest` in Kubernetes deployments creates several serious problems:

1. **Non-deterministic deployments.** If you deploy a manifest with `image: myapp:latest` on Tuesday and again on Thursday, you may get different images. There is no way to know what code is actually running in your cluster.

2. **Kubernetes does not re-pull by default.** If `imagePullPolicy` is `IfNotPresent` (the default when a tag other than `latest` is specified), Kubernetes will not pull the image if it is already cached on the node. But even with `latest`, where `imagePullPolicy` defaults to `Always`, different nodes may pull at different times and end up running different versions.

3. **No rollback traceability.** When something breaks, `kubectl rollout undo` rolls back to the previous `Deployment` spec. If both the current and previous spec say `myapp:latest`, the rollback achieves nothing because both point to the same (broken) image.

4. **No audit trail.** You cannot determine from the running cluster which commit is deployed.

### Tag Strategy Comparison

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| `latest` | `myapp:latest` | Simple to type | Non-deterministic, no traceability, dangerous in production |
| Semantic version | `myapp:1.4.2` | Human-readable, clear release meaning | Requires a release process; not suitable for every commit |
| Git SHA (short) | `myapp:abc1234` | Unique, traceable to exact commit | Not human-readable at a glance |
| Git SHA + date | `myapp:20240615-abc1234` | Sortable by date, still traceable | Slightly longer tag |
| Branch + build number | `myapp:main-42` | Identifies branch and sequence | Build number is CI-system-specific; not universally portable |
| Semantic version + SHA | `myapp:1.4.2-abc1234` | Human-readable release label plus traceability | Requires both a release process and SHA tagging |

### Recommendation

- **Production deployments:** use the git commit SHA as the primary tag. Every deployment is uniquely traceable to a commit. `myapp:abc1234ef` is unambiguous.
- **Release artefacts:** additionally tag with a semantic version when you cut a release (`myapp:1.4.2`). The semantic version tag is for humans and external consumers; the SHA tag is for the cluster.
- **Never use `latest` in a Kubernetes manifest that deploys to a real environment.**

### Generating the SHA Tag in CI

```bash
# Get the short commit SHA (first 7 characters)
IMAGE_TAG=$(git rev-parse --short HEAD)

# Build the image with the SHA tag
docker build -t myapp:${IMAGE_TAG} .

# Push to a registry (example: GitHub Container Registry)
docker push ghcr.io/myorg/myapp:${IMAGE_TAG}

# Optionally also tag as latest for local dev convenience
# (never use this tag in Kubernetes manifests)
docker tag myapp:${IMAGE_TAG} ghcr.io/myorg/myapp:latest
docker push ghcr.io/myorg/myapp:latest
```

In a CI environment, `git rev-parse --short HEAD` gives you the short SHA of the commit that triggered the build. Because CI checks out the exact commit, this is always deterministic and available without any additional tooling.

---

## 3. GitHub Actions — Build and Deploy Pipeline

GitHub Actions is one of the most widely used CI/CD platforms and integrates natively with GitHub Container Registry (GHCR). The pipeline below builds an image, pushes it to GHCR, and then deploys it to Kubernetes — demonstrating both the direct `kubectl` approach and the kustomize-based approach for GitOps.

### Complete Pipeline: `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches:
      - main

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    name: Build and Push Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image_tag: ${{ steps.meta.outputs.version }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        # Buildx enables BuildKit, which provides layer caching,
        # multi-platform builds, and faster builds overall.

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          # GITHUB_TOKEN is automatically provided by Actions.
          # No manual secret configuration is required for GHCR.
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            # Tag with the short git SHA — primary production tag
            type=sha,format=short
            # Also tag the branch name for reference (not used in K8s manifests)
            type=ref,event=branch

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          # Use GitHub Actions cache to speed up subsequent builds
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy to Kubernetes
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: production

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.29.0'

      - name: Configure kubeconfig
        # KUBECONFIG_B64 is a base64-encoded kubeconfig file
        # stored as a GitHub Actions secret. To create it:
        #   cat ~/.kube/config | base64 | pbcopy
        # Then paste the result into Settings > Secrets > KUBECONFIG_B64.
        run: |
          mkdir -p $HOME/.kube
          echo "${{ secrets.KUBECONFIG_B64 }}" | base64 --decode > $HOME/.kube/config
          chmod 600 $HOME/.kube/config

      - name: Deploy using kubectl set image
        # This is the push-based approach: the CI runner updates the
        # Deployment directly. The image tag from the build job is
        # passed through the job output.
        run: |
          IMAGE_TAG=${{ needs.build-and-push.outputs.image_tag }}
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${IMAGE_TAG} \
            --namespace production
          kubectl rollout status deployment/myapp \
            --namespace production \
            --timeout=5m

      - name: Verify deployment
        run: |
          kubectl get deployment myapp --namespace production
          kubectl get pods --namespace production -l app=myapp
```

### Understanding the Pipeline

**`permissions: packages: write`** — GHCR requires the `packages: write` permission on the job to allow pushing images. Without this, the push will fail with a 403 error even though `GITHUB_TOKEN` is provided.

**`docker/metadata-action`** — This action generates consistent image tags and OCI labels from git metadata. Using `type=sha,format=short` produces a tag like `sha-abc1234`. The `outputs.version` value is the primary tag (the SHA tag), which is passed to the deploy job via `outputs.image_tag`.

**`cache-from: type=gha` / `cache-to: type=gha,mode=max`** — GitHub Actions cache is used for Docker layer caching. Layers that have not changed since the last build are reused, which can reduce build times from several minutes to under a minute for incremental changes.

**`environment: production`** — Linking the deploy job to a GitHub Environment enables protection rules (e.g., required reviewers before deployment), environment-specific secrets, and a deployment history in the GitHub UI.

**`kubectl rollout status`** — After `kubectl set image`, the runner waits for the rollout to complete. If the new pods fail to become ready within 5 minutes, the command exits with a non-zero status code, failing the CI job and alerting the team.

### Kustomize-Based Image Tag Update (GitOps Approach)

Instead of running `kubectl set image` directly, you can commit the updated image tag to a GitOps repository using kustomize. This is the preferred approach when using ArgoCD or Flux.

Your `kustomization.yaml` references a base manifest and overrides the image tag:

```yaml
# kubernetes/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

images:
  - name: myapp
    newName: ghcr.io/myorg/myapp
    newTag: abc1234   # This value is updated by the CI pipeline
```

The CI pipeline updates this file and commits it:

```yaml
# In your GitHub Actions deploy job (GitOps variant):

      - name: Checkout GitOps repository
        uses: actions/checkout@v4
        with:
          # If your GitOps manifests are in a separate repository,
          # specify it here and provide a PAT with repo write access.
          repository: myorg/myapp-gitops
          token: ${{ secrets.GITOPS_PAT }}
          path: gitops

      - name: Update image tag in kustomization
        run: |
          IMAGE_TAG=${{ needs.build-and-push.outputs.image_tag }}
          cd gitops
          # Use kustomize to set the new image tag
          kustomize edit set image myapp=ghcr.io/myorg/myapp:${IMAGE_TAG} \
            --kustomization-file kubernetes/overlays/production/kustomization.yaml

      - name: Commit and push updated manifest
        run: |
          IMAGE_TAG=${{ needs.build-and-push.outputs.image_tag }}
          cd gitops
          git config user.name "CI Bot"
          git config user.email "ci@myorg.com"
          git add kubernetes/overlays/production/kustomization.yaml
          git commit -m "deploy: update myapp to ${IMAGE_TAG}"
          git push
          # ArgoCD or Flux will detect this commit and sync the cluster.
```

In this approach, the CI runner never needs cluster credentials. The runner only needs write access to the GitOps repository. The cluster credentials stay inside the cluster, held by the ArgoCD service account.

---

## 4. GitOps with ArgoCD

GitOps is a set of principles for managing infrastructure and application deployments using Git as the single source of truth. The term was coined by Weaveworks in 2017, but the underlying ideas — declarative configuration, version control, automated reconciliation — are core Kubernetes patterns.

### GitOps Principles

1. **Declarative.** The desired state of the system is expressed declaratively (Kubernetes manifests, Helm charts, kustomize overlays) rather than as a sequence of imperative commands. You describe what you want, not how to achieve it.

2. **Versioned and immutable.** The desired state is stored in Git, which provides a complete history of every change. Every deployment is associated with a commit, author, timestamp, and message.

3. **Automatically pulled.** A software agent running in (or near) the cluster continuously compares the desired state in Git with the actual state in the cluster. When they diverge, the agent reconciles them — it does not wait to be told.

4. **Continuously reconciled.** If someone runs a manual `kubectl` command that changes cluster state, the GitOps agent detects the drift and reverts it. Git is always authoritative.

### Push-Based CI/CD vs GitOps

| Dimension | Push-Based CI/CD | GitOps (Pull-Based) |
|---|---|---|
| Trigger | CI runner pushes changes | Agent in cluster pulls changes |
| Credentials | Cluster creds stored in CI | Cluster creds stay in cluster |
| Audit trail | CI job logs | Git commit history |
| Drift detection | None | Automatic, continuous |
| Rollback mechanism | Re-run pipeline or `kubectl rollout undo` | `git revert` + auto-sync |
| Emergency access | Direct `kubectl` always works | Direct `kubectl` may be overridden by agent |
| Tooling complexity | Low (just kubectl) | Higher (ArgoCD or Flux required) |

### Installing ArgoCD

ArgoCD is deployed into its own namespace in the cluster. The installation manifest creates all the necessary CRDs, Deployments, Services, and RBAC resources.

```bash
# Create the argocd namespace
kubectl create namespace argocd

# Apply the official installation manifest
# This installs ArgoCD with all components in the argocd namespace
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all ArgoCD components to become ready
kubectl wait --for=condition=available deployment \
  --all \
  --namespace argocd \
  --timeout=5m

# Retrieve the initial admin password (auto-generated, stored in a secret)
kubectl get secret argocd-initial-admin-secret \
  -n argocd \
  -o jsonpath="{.data.password}" | base64 --decode && echo

# Access the ArgoCD UI by port-forwarding the API server service
kubectl port-forward svc/argocd-server -n argocd 8080:443
# The UI is now available at https://localhost:8080
# Username: admin
# Password: the value retrieved above
```

### ArgoCD Components

ArgoCD is composed of several distinct services, each with a specific responsibility:

**API Server (`argocd-server`)** — Exposes the ArgoCD REST and gRPC API. The web UI, the `argocd` CLI, and CI pipelines all communicate with this service. It handles authentication, authorisation, and application management operations.

**Repository Server (`argocd-repo-server`)** — Clones and caches Git repositories. When ArgoCD needs to render manifests (from raw YAML, Helm, or kustomize), the repo server does the work. It runs in a sandboxed environment to limit the blast radius of malicious repository content.

**Application Controller (`argocd-application-controller`)** — The heart of ArgoCD. This is a Kubernetes controller that continuously watches both the Git repository (via the repo server) and the cluster (via the Kubernetes API). When it detects a difference between desired state (Git) and actual state (cluster), it performs a sync. It runs as a `StatefulSet` because it maintains reconciliation state.

**Dex (`argocd-dex-server`)** — An optional identity provider that handles SSO integration. Dex allows ArgoCD to authenticate users via OIDC providers such as GitHub, Google Workspace, Okta, or Active Directory. If you are using ArgoCD's local user accounts only, Dex is still deployed but unused.

**Redis (`argocd-redis`)** — A cache used by the API server and application controller to store rendered manifests, application state, and session data. This reduces the load on the Kubernetes API server and speeds up the UI.

### ArgoCD Sync Flow

```
┌─────────────────────────────────────┐
│           Git Repository            │
│  (kubernetes/overlays/production)   │
│                                     │
│  kustomization.yaml                 │
│  deployment.yaml                    │
│  service.yaml                       │
└──────────────┬──────────────────────┘
               │  argocd-repo-server
               │  polls every 3 minutes
               │  (or webhook triggers immediately)
               ▼
┌─────────────────────────────────────┐
│      ArgoCD Application Controller  │
│                                     │
│  Compares desired state (Git)       │
│  with actual state (cluster)        │
│                                     │
│  If OutOfSync → apply changes       │
│  If Synced → no action needed       │
└──────────────┬──────────────────────┘
               │  kubectl apply
               ▼
┌─────────────────────────────────────┐
│        Kubernetes API Server        │
│                                     │
│  Updates Deployments, Services,     │
│  ConfigMaps, etc. to match          │
│  the desired state from Git         │
└─────────────────────────────────────┘
```

By default, ArgoCD polls Git every 3 minutes. For faster feedback, you can configure a webhook from GitHub/GitLab/Bitbucket to the ArgoCD API server, which triggers an immediate sync check when a commit is pushed.

### Flux as an Alternative

[Flux](https://fluxcd.io/) is the other major GitOps tool in the CNCF ecosystem. It takes a more modular approach than ArgoCD: instead of a single application, Flux is a set of controllers (source-controller, kustomize-controller, helm-controller, notification-controller) that compose together.

Key differences:
- **ArgoCD** has a rich web UI and is often preferred by teams that want visibility into sync state without using the CLI.
- **Flux** is more Kubernetes-native (no UI by default) and is often preferred by teams that favour a purely declarative, CLI-driven workflow.
- Both are CNCF graduated projects and are production-ready.

This guide focuses on ArgoCD, but the GitOps principles are identical for Flux.

---

## 5. ArgoCD Application Manifest

An `Application` is an ArgoCD custom resource that declares what to deploy, where to find it, and where to deploy it. ArgoCD's application controller watches `Application` resources and acts on them.

### Complete Application YAML

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
  # Labels and annotations are optional but useful for organising
  # multiple applications in a large cluster.
  labels:
    team: platform
    environment: production
spec:
  # The ArgoCD project this application belongs to.
  # 'default' is the built-in project that allows any source and destination.
  # In production, create custom projects with restricted sources and destinations.
  project: default

  source:
    # The URL of the Git repository containing your Kubernetes manifests.
    # ArgoCD supports HTTPS and SSH URLs.
    repoURL: https://github.com/myorg/myapp-gitops

    # The branch, tag, or commit SHA to track.
    # Using a branch (e.g., 'main') means ArgoCD tracks the latest commit
    # on that branch. Using a tag or SHA pins to a specific version.
    targetRevision: main

    # The path within the repository where the manifests are located.
    # ArgoCD automatically detects whether this is plain YAML, kustomize,
    # or Helm by inspecting the files at this path.
    path: kubernetes/overlays/production

  destination:
    # The Kubernetes API server to deploy to.
    # 'https://kubernetes.default.svc' refers to the cluster where
    # ArgoCD itself is running (in-cluster deployment).
    # For external clusters, use the cluster's API server URL.
    server: https://kubernetes.default.svc

    # The namespace in the destination cluster to deploy into.
    namespace: production

  syncPolicy:
    automated:
      # prune: true means ArgoCD will delete resources from the cluster
      # if they are removed from the Git repository.
      # Without prune, old resources accumulate in the cluster indefinitely.
      prune: true

      # selfHeal: true means ArgoCD will revert manual changes.
      # If someone runs 'kubectl edit deployment myapp' and changes the
      # replica count, ArgoCD will detect the drift and set it back
      # to what Git says within a few minutes.
      selfHeal: true

    syncOptions:
      # Automatically create the destination namespace if it does not exist.
      # Without this, the sync fails if the 'production' namespace is missing.
      - CreateNamespace=true

      # Apply server-side apply instead of client-side apply.
      # Recommended for manifests managed by multiple tools.
      - ServerSideApply=true

  # Ignore differences in fields that are managed by other controllers.
  # This prevents ArgoCD from flagging expected divergences as OutOfSync.
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        # HPA modifies spec.replicas at runtime. Ignore this field
        # so ArgoCD does not conflict with the HPA controller.
        - /spec/replicas
```

### Field-by-Field Explanation

**`metadata.namespace: argocd`** — All `Application` resources must be created in the `argocd` namespace. ArgoCD only watches this namespace for `Application` resources by default.

**`spec.project`** — ArgoCD Projects are an access control mechanism. The `default` project has no restrictions, but in a multi-team environment you would create named projects that restrict which repositories and destination namespaces are permitted. For example, a `team-backend` project might only be allowed to read from `github.com/myorg/backend-gitops` and deploy to the `backend` namespace.

**`spec.source.targetRevision`** — Tracking a branch (`main`) is the most common configuration. When the CI pipeline commits a new image tag to `main`, ArgoCD detects the change within 3 minutes (or immediately via webhook) and syncs. Tracking a tag or SHA gives you more control but requires updating the `Application` resource to move forward.

**`spec.source.path`** — ArgoCD inspects this path and auto-detects the tool:
- If a `kustomization.yaml` is present, ArgoCD uses kustomize.
- If a `Chart.yaml` is present, ArgoCD uses Helm.
- Otherwise, ArgoCD applies all YAML files directly with `kubectl apply`.

**`spec.destination.server: https://kubernetes.default.svc`** — This is the in-cluster Kubernetes API server address, accessible from within the ArgoCD pods. If ArgoCD manages external clusters, the cluster must first be registered with `argocd cluster add`.

**`syncPolicy.automated.prune: true`** — Without `prune`, removing a resource from Git leaves the resource running in the cluster. With `prune`, the deleted resource is cleaned up on the next sync. This is essential for maintaining a clean cluster state over time.

**`syncPolicy.automated.selfHeal: true`** — Without `selfHeal`, `automated` sync only applies changes when Git changes (i.e., on new commits). With `selfHeal`, ArgoCD also syncs when it detects that the cluster has drifted from Git — catching manual `kubectl` modifications. This enforces Git as the sole authoritative source of truth.

**`ignoreDifferences`** — Some controllers (HPA, cert-manager, etc.) modify resource fields at runtime. Without `ignoreDifferences`, ArgoCD flags these as drift and may revert them. The example above ignores `spec.replicas` on Deployments because the HPA sets this value dynamically; if ArgoCD overwrote it, the HPA's scaling decisions would be lost on every sync.

---

## 6. Rolling Deployments

A rolling update replaces old pods with new pods incrementally, ensuring that the application remains available throughout the deployment. Kubernetes performs rolling updates natively — it is the default `strategy.type` for a `Deployment`.

### Deployment Spec with Rolling Update Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 4
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # maxUnavailable: the maximum number of pods that can be unavailable
      # during the update. Set to 0 to ensure full capacity is maintained
      # throughout — no requests are dropped.
      # Can be an absolute number (e.g., 1) or a percentage (e.g., 25%).
      maxUnavailable: 0

      # maxSurge: the maximum number of pods that can be created above
      # the desired replica count during the update.
      # With maxUnavailable: 0 and maxSurge: 1, Kubernetes creates one
      # new pod, waits for it to become ready, then terminates one old pod.
      # Can be an absolute number or a percentage.
      maxSurge: 1

  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:abc1234
          ports:
            - containerPort: 8080
          # A readiness probe is mandatory for safe rolling updates.
          # Kubernetes will not route traffic to a new pod until this probe
          # succeeds, and will not mark the old pod for termination until
          # the new pod is ready. Without a readiness probe, Kubernetes
          # considers the pod ready the moment the container starts,
          # which may be before the application has initialised.
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
```

### Understanding maxUnavailable and maxSurge

`maxUnavailable` and `maxSurge` together control the speed and safety of a rolling update. They interact as follows:

| Configuration | Behaviour | Use case |
|---|---|---|
| `maxUnavailable: 0, maxSurge: 1` | Always at or above desired replica count. Slowest but safest. | Production services that must not lose capacity. |
| `maxUnavailable: 1, maxSurge: 0` | Terminates one old pod before starting a new one. Uses no extra resources. | Resource-constrained environments. |
| `maxUnavailable: 25%, maxSurge: 25%` | Kubernetes default. Balanced speed and safety. | General-purpose workloads. |
| `maxUnavailable: 0, maxSurge: 100%` | All new pods start simultaneously, then all old pods terminate. | Blue/green-like behaviour with a Deployment. |

The **readiness probe** is not optional for safe rolling updates. When `maxUnavailable: 0`, Kubernetes refuses to terminate an old pod until the new pod passes its readiness probe. If the new pod never becomes ready (e.g., because the new image has a startup bug), Kubernetes stalls the rollout instead of taking down the old pods. This prevents a bad deployment from taking the entire service offline.

### kubectl Rollout Commands

```bash
# Check the status of an ongoing rollout
kubectl rollout status deployment/myapp --namespace production
# Output: Waiting for deployment "myapp" rollout to finish: 1 out of 4 new replicas have been updated...
# Output: deployment "myapp" successfully rolled out

# View rollout history (shows revision numbers and change cause)
kubectl rollout history deployment/myapp --namespace production
# To record the change cause, add --record to kubectl apply (deprecated)
# or set the kubernetes.io/change-cause annotation manually.

# Inspect a specific revision
kubectl rollout history deployment/myapp --namespace production --revision=3

# Roll back to the previous revision
kubectl rollout undo deployment/myapp --namespace production

# Roll back to a specific revision
kubectl rollout undo deployment/myapp --namespace production --to-revision=2

# Pause a rolling update mid-deployment (useful for canary-style checking)
kubectl rollout pause deployment/myapp --namespace production

# Resume a paused rollout
kubectl rollout resume deployment/myapp --namespace production

# Restart all pods in a deployment (triggers a rolling update with the same image)
# Useful when a ConfigMap has changed and you need pods to pick up the new config.
kubectl rollout restart deployment/myapp --namespace production
```

---

## 7. Blue/Green Deployments

A blue/green deployment maintains two complete, independent versions of the application simultaneously. The **blue** environment runs the current production version; the **green** environment runs the new version. Traffic is switched from blue to green by updating a Service's label selector. Rollback is instantaneous — just switch the selector back.

### Architecture

```
            ┌──────────────────────────────────────┐
            │              Service                 │
            │  selector: version: blue             │
            │  (routes all traffic to blue pods)   │
            └──────────────┬───────────────────────┘
                           │
          ┌────────────────▼────────────────────┐
          │          Blue Deployment             │
          │  label: version: blue                │
          │  image: myapp:1.4.1 (current)        │
          │  replicas: 4 (receiving traffic)     │
          └─────────────────────────────────────┘

          ┌─────────────────────────────────────┐
          │          Green Deployment            │
          │  label: version: green               │
          │  image: myapp:1.5.0 (new)            │
          │  replicas: 4 (idle, fully tested)    │
          └─────────────────────────────────────┘
```

After the green environment is validated, you update the Service selector from `version: blue` to `version: green`. Traffic immediately routes to green pods.

### YAML Manifests

**Blue Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  namespace: production
  labels:
    app: myapp
    version: blue
spec:
  replicas: 4
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:1.4.1
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

**Green Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  namespace: production
  labels:
    app: myapp
    version: green
spec:
  replicas: 4
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:1.5.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

**Service (initially pointing to blue):**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
spec:
  selector:
    app: myapp
    version: blue   # Change to 'green' to switch traffic
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

### Switching Traffic to Green

After deploying the green environment and confirming it is healthy (e.g., by running integration tests against a staging URL that points directly to the green deployment), switch production traffic:

```bash
# Option 1: kubectl patch (fast, no manifest edit required)
kubectl patch service myapp \
  --namespace production \
  --type=json \
  -p='[{"op": "replace", "path": "/spec/selector/version", "value": "green"}]'

# Option 2: kubectl edit (opens manifest in your editor)
kubectl edit service myapp --namespace production
# Change 'version: blue' to 'version: green' and save.

# Option 3: apply an updated Service manifest
# Edit the selector in service.yaml and apply:
kubectl apply -f service.yaml

# Verify the switch — check endpoint addresses
kubectl get endpoints myapp --namespace production
```

**Rolling back** is equally simple — patch the selector back to `blue`. The blue deployment is still running with all its pods, so rollback is instantaneous with no restart required.

```bash
# Instant rollback: switch selector back to blue
kubectl patch service myapp \
  --namespace production \
  --type=json \
  -p='[{"op": "replace", "path": "/spec/selector/version", "value": "blue"}]'
```

### Advantages and Disadvantages

**Advantages:**
- Instant rollback by changing a single label selector — no pod restarts, no rolling update.
- The green environment can be fully tested (including integration and smoke tests against a staging URL) before any production traffic is switched.
- Zero downtime — traffic switches atomically at the Service level.
- The blue environment remains available as a hot standby for a configurable period after the switch.

**Disadvantages:**
- **Double resource cost** during the switch window. You are running twice the normal number of pods. For large applications or resource-constrained clusters, this may be prohibitive.
- **State management complexity.** If the application holds state (sessions, caches, database connections), both environments must handle requests gracefully during the transition. Database schema migrations must be backward-compatible with both the blue and green versions simultaneously.
- **Orchestration overhead.** Blue/green requires managing two parallel Deployments. Tools like Argo Rollouts automate this and provide a more structured lifecycle.

---

## 8. Canary Deployments

A canary deployment routes a small percentage of production traffic to the new version before committing to a full rollout. The name comes from the historical practice of using canaries in coal mines to detect dangerous gases — the canary pod detects problems before they affect all users.

### Simple Canary with Replica Ratio

The simplest canary implementation in Kubernetes uses two Deployments that share the same Service selector. Traffic is distributed across all pods that match the selector, so the ratio of canary replicas to stable replicas determines the traffic split.

**Stable Deployment (current production version, 9 replicas):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  namespace: production
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:1.4.1
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

**Canary Deployment (new version, 1 replica — 10% of traffic):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  namespace: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:1.5.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

**Shared Service (selects all pods with `app: myapp`):**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
spec:
  selector:
    app: myapp   # Matches both stable and canary pods
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

With 9 stable replicas and 1 canary replica, approximately 10% of requests hit the canary. Monitor error rates, latency, and business metrics for the canary pods. If metrics look healthy, increase the canary replica count and reduce stable replicas proportionally (e.g., 8 stable + 2 canary = 20%). Continue until the canary handles 100% of traffic, then remove the stable deployment.

**Limitation:** The replica-ratio approach only approximates traffic percentages and does not allow fine-grained control (e.g., exactly 5% or routing only logged-in users to the canary). For precise percentage-based canary, use Istio or Argo Rollouts.

### Argo Rollouts — Precise Canary Deployments

[Argo Rollouts](https://argoproj.github.io/rollouts/) is a Kubernetes controller that replaces the standard `Deployment` with a `Rollout` resource, providing advanced deployment strategies including precise canary with configurable traffic weights, automated metric analysis, and pause-and-promote workflows.

**Install Argo Rollouts:**

```bash
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install the kubectl plugin for rollout management
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-darwin-amd64
chmod +x kubectl-argo-rollouts-darwin-amd64
sudo mv kubectl-argo-rollouts-darwin-amd64 /usr/local/bin/kubectl-argo-rollouts
```

**Rollout YAML with Canary Steps:**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 10
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: ghcr.io/myorg/myapp:1.5.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5

  strategy:
    canary:
      # canaryService routes canary traffic (used by Istio/ALB for weight-based routing)
      canaryService: myapp-canary
      # stableService routes stable traffic
      stableService: myapp-stable

      steps:
        # Step 1: Route 10% of traffic to the canary
        - setWeight: 10
        # Step 2: Pause for 5 minutes and monitor metrics manually
        # (or use 'pause: {}' to pause indefinitely until promoted)
        - pause:
            duration: 5m
        # Step 3: Increase to 30% if no issues
        - setWeight: 30
        # Step 4: Pause again for automated analysis
        - pause:
            duration: 10m
        # Step 5: Increase to 60%
        - setWeight: 60
        # Step 6: Final pause before full rollout
        - pause:
            duration: 5m
        # After all steps complete, Argo Rollouts automatically
        # promotes the canary to 100% and scales down the old version.

      # analysis: run automated metric checks at each pause step
      # If the analysis fails, the rollout is automatically aborted.
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 2
        args:
          - name: service-name
            value: myapp-canary
```

**Managing the Rollout:**

```bash
# Watch the rollout progress in real time
kubectl argo rollouts get rollout myapp --namespace production --watch

# Promote the rollout to the next step (skip the current pause)
kubectl argo rollouts promote myapp --namespace production

# Abort the rollout and revert to the stable version
kubectl argo rollouts abort myapp --namespace production

# Retry a failed rollout after fixing the issue
kubectl argo rollouts retry rollout myapp --namespace production
```

### Istio for Traffic Splitting

If your cluster uses [Istio](https://istio.io/) as a service mesh, you can use `VirtualService` and `DestinationRule` resources for precise, header-based, or cookie-based canary traffic splitting — without changing replica counts.

```yaml
# DestinationRule: defines the stable and canary subsets
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: myapp
  namespace: production
spec:
  host: myapp
  subsets:
    - name: stable
      labels:
        track: stable
    - name: canary
      labels:
        track: canary
---
# VirtualService: splits traffic 90/10 between stable and canary
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
  namespace: production
spec:
  hosts:
    - myapp
  http:
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 90
        - destination:
            host: myapp
            subset: canary
          weight: 10
```

With Istio, the weight is applied at the proxy level — independent of replica counts — giving you precise control down to a single percentage point.

---

## 9. Hands-On Exercises

These exercises progressively build a complete CI/CD pipeline from scratch. Complete them in order, as each exercise builds on the previous one.

### Exercise 1: Set Up GitHub Actions to Build and Push to GHCR

**Goal:** Create a GitHub Actions workflow that automatically builds a Docker image and pushes it to GitHub Container Registry on every push to `main`.

1. Create a simple web application (or use an existing one) with a `Dockerfile`.
2. Create `.github/workflows/build.yml` with a workflow that triggers on `push` to `main`.
3. Add steps to:
   - Check out the repository.
   - Log in to GHCR using `docker/login-action` with `secrets.GITHUB_TOKEN`.
   - Build and push the image using `docker/build-push-action` with a SHA-based tag.
4. Push a change to `main` and verify the workflow runs successfully.
5. Navigate to your repository's "Packages" section on GitHub and confirm the image appears with the correct SHA tag.

**Verification:** Run `docker pull ghcr.io/<your-org>/<your-repo>:sha-<shortsha>` from your local machine and confirm the image downloads successfully.

### Exercise 2: Install ArgoCD and Create an Application

**Goal:** Deploy ArgoCD to a local cluster (using kind or minikube) and create an `Application` resource that syncs a Kubernetes manifest from a Git repository.

1. Create a local cluster: `kind create cluster --name argo-lab`.
2. Install ArgoCD using the official manifest (see Section 4).
3. Wait for all ArgoCD pods to be ready: `kubectl get pods -n argocd`.
4. Retrieve the initial admin password.
5. Port-forward the ArgoCD server and log into the UI at `https://localhost:8080`.
6. Create a public GitHub repository containing a simple Deployment and Service YAML.
7. Create an `Application` manifest (see Section 5) pointing to your repository and apply it: `kubectl apply -f application.yaml`.
8. In the ArgoCD UI, observe the application sync and deploy your resources.
9. Make a change to your manifest in Git (e.g., change the replica count) and observe ArgoCD automatically detecting and applying the change.

**Verification:** Run `kubectl get deployment -n production` and confirm the deployment matches what is in your Git repository.

### Exercise 3: Implement Rolling Update with maxUnavailable=0

**Goal:** Configure a Deployment with a zero-disruption rolling update strategy and observe the rollout behaviour.

1. Create a Deployment with 4 replicas, `maxUnavailable: 0`, and `maxSurge: 1`.
2. Include a readiness probe on the `/health/ready` path.
3. Apply the Deployment and confirm all 4 pods are running.
4. Update the image tag in the Deployment manifest and apply it.
5. In a separate terminal, run `kubectl get pods --namespace production --watch` to observe the rollout.
6. Confirm that the total number of running pods never drops below 4 during the rollout (you will momentarily see 5 pods as the new pod starts before an old one terminates).
7. After the rollout completes, run `kubectl rollout history deployment/myapp` to see the revision history.

**Verification:** During the rollout, verify that `kubectl get endpoints myapp` always shows 4 endpoint addresses.

### Exercise 4: Implement a Blue/Green Switch

**Goal:** Deploy a blue and green version of an application and switch traffic between them.

1. Create two Deployments (`myapp-blue` and `myapp-green`) with different image tags and different `version` labels (see Section 7).
2. Create a Service that initially selects `version: blue`.
3. Confirm that requests to the Service return responses from the blue version (you can use a different `MESSAGE` environment variable in each Deployment to differentiate them).
4. Run `kubectl patch service myapp --type=json -p='[{"op": "replace", "path": "/spec/selector/version", "value": "green"}]'` to switch traffic to green.
5. Confirm that subsequent requests return responses from the green version.
6. Switch back to blue to simulate a rollback.

**Verification:** Use `kubectl exec` to curl the Service from within the cluster and confirm the response changes immediately after the selector patch.

### Exercise 5: Use kubectl rollout undo to Roll Back a Bad Deployment

**Goal:** Simulate a bad deployment and practise rolling back using `kubectl rollout undo`.

1. Start with a working Deployment (e.g., `nginx:1.25`).
2. Update the image to a non-existent tag (e.g., `nginx:this-does-not-exist`) to simulate a bad deployment.
3. Apply the updated Deployment and observe the rollout stalling with `kubectl rollout status deployment/myapp`.
4. In a separate terminal, observe the `ImagePullBackOff` error: `kubectl get pods --namespace production`.
5. Roll back to the previous revision: `kubectl rollout undo deployment/myapp --namespace production`.
6. Observe the rollback completing and the pods returning to the good image.

**Verification:** After the rollback, run `kubectl describe deployment myapp` and confirm the image has reverted to `nginx:1.25`. Run `kubectl rollout history deployment/myapp` to see the revision that was restored.

---

## 10. Interview Q&A

### Q1: What is GitOps and how does it differ from traditional push-based CI/CD?

**Answer:**

GitOps is an operational model in which Git is the single source of truth for the desired state of a system. All changes — to infrastructure, application configuration, and Kubernetes manifests — are made via Git commits. A software agent running inside the cluster continuously compares the desired state in Git with the actual state in the cluster and reconciles any differences.

In a **traditional push-based CI/CD** pipeline, the CI runner authenticates to the cluster and pushes changes via `kubectl apply` or `helm upgrade`. The runner has cluster credentials, the pipeline is authoritative, and the cluster's state after the pipeline runs is whatever the pipeline last applied. If someone manually edits a resource with `kubectl edit`, that change persists and is not tracked anywhere.

In **GitOps**, the flow is reversed. The CI pipeline only updates Git (e.g., commits a new image tag to a manifest). An in-cluster agent (ArgoCD or Flux) pulls from Git and applies changes to the cluster. The agent also continuously monitors for drift — if a manual `kubectl edit` changes a resource, the agent detects the discrepancy and reverts it to match Git.

Key practical differences:
- **Audit trail:** In push-based CD, who deployed what is recorded in CI logs, which may be ephemeral. In GitOps, every deployment is a git commit with an author, timestamp, and message.
- **Credential security:** Push-based CD requires cluster credentials in the CI system. GitOps keeps credentials inside the cluster.
- **Rollback:** In push-based CD, rollback means re-running the pipeline with an older image tag. In GitOps, rollback is `git revert` — a standard operation familiar to all developers.
- **Drift correction:** Push-based CD cannot detect or correct drift. GitOps corrects drift automatically.

### Q2: Why should you avoid using the `latest` image tag in Kubernetes deployments?

**Answer:**

The `latest` tag is mutable — it is reassigned to a new image every time you push without specifying a tag. Using it in Kubernetes manifests creates three serious problems:

**1. Non-deterministic deployments.** If you apply the same manifest twice on different days, you may get different images. There is no way to know what code is actually running in your cluster by looking at the manifest.

**2. Kubernetes may not pull the new image.** When a tag other than `latest` is specified, `imagePullPolicy` defaults to `IfNotPresent`. Kubernetes will not pull the image if it is already cached on the node. Even with `latest` (where `imagePullPolicy` defaults to `Always`), different nodes may pull at different times and run different versions simultaneously.

**3. Rollback is broken.** `kubectl rollout undo` reverts the Deployment spec to a previous revision. If both the current and previous revisions specify `image: myapp:latest`, the rollback does nothing — both point to the same (potentially broken) image.

The correct approach is to tag every image with the git commit SHA. This produces a unique, immutable tag (`myapp:abc1234ef`) that is traceable to an exact commit. Rollback restores a Deployment spec that points to a different SHA, which Kubernetes will pull and deploy deterministically.

### Q3: What does ArgoCD's `selfHeal` option do?

**Answer:**

`selfHeal: true` in an ArgoCD `Application`'s `syncPolicy.automated` block instructs ArgoCD to reconcile the cluster back to the desired state in Git whenever it detects drift — not just when Git changes.

Without `selfHeal`, `automated` sync is triggered only by changes to the Git repository. If someone runs `kubectl scale deployment myapp --replicas=10` directly against the cluster (changing it from the Git-declared value of 4), ArgoCD will not correct the drift until the next Git commit triggers a sync.

With `selfHeal: true`, ArgoCD's application controller continuously monitors the cluster. When it detects that `spec.replicas` is 10 in the cluster but 4 in Git, it immediately syncs the cluster back to match Git — setting replicas back to 4.

`selfHeal` enforces GitOps discipline by making Git the authoritative source of truth at all times. It prevents "snowflake" clusters where manual changes accumulate and diverge from what is documented in version control. The trade-off is that operators must not make one-off manual changes expecting them to persist; all changes must go through Git.

### Q4: What is the difference between blue/green and canary deployments?

**Answer:**

Both patterns enable zero-downtime deployments, but they differ in how they route traffic and manage risk:

**Blue/Green:**
- Maintains two complete, parallel environments: blue (current production) and green (new version).
- All production traffic goes to one environment at a time — there is no traffic split.
- The switch is atomic: a single Service selector change routes 100% of traffic from blue to green instantly.
- Rollback is instantaneous (switch the selector back).
- The cost is double the resource consumption during the switch window.
- Suitable when you want to fully test the new environment before exposing any production users to it.

**Canary:**
- Runs a small portion of the new version alongside the stable version.
- Routes a percentage of production traffic (e.g., 5–10%) to the canary.
- Allows you to observe the canary's behaviour under real production load and traffic patterns before committing to a full rollout.
- If metrics look good, the canary percentage is gradually increased. If problems appear, only a small percentage of users were affected.
- Rollback involves removing the canary pods or setting their weight to 0.
- Suitable when you need real production traffic to validate the new version, or when the risk of exposing all users to an untested version is too high.

The key distinction: blue/green is a binary switch; canary is a graduated roll-forward under real traffic. Blue/green costs more resources; canary exposes real users to the new version during the validation period.

### Q5: What is `maxUnavailable` and `maxSurge` in a RollingUpdate strategy?

**Answer:**

`maxUnavailable` and `maxSurge` are two parameters that control the pace and safety of a Kubernetes rolling update:

**`maxUnavailable`** specifies the maximum number (or percentage) of pods from the desired replica count that can be in an unavailable state during the update. A pod is unavailable if it is not passing its readiness probe. Setting `maxUnavailable: 0` means Kubernetes will never let the number of ready pods drop below the desired count — it will only terminate an old pod after a new one is fully ready. This is the safest setting for production services that must maintain full capacity throughout a deployment.

**`maxSurge`** specifies the maximum number (or percentage) of pods that can be created above the desired replica count during the update. Setting `maxSurge: 1` on a 4-replica Deployment means Kubernetes can temporarily run 5 pods (4 desired + 1 surge) while the new pod starts. Once the new pod is ready, an old pod is terminated, bringing the total back to 4.

The two parameters work together:

- `maxUnavailable: 0, maxSurge: 1` — The safest configuration. Kubernetes creates one new pod, waits for it to pass its readiness probe, then terminates one old pod. The deployment proceeds one pod at a time. Full capacity is maintained throughout.

- `maxUnavailable: 1, maxSurge: 0` — Kubernetes terminates one old pod before starting a new one. Capacity temporarily drops by one. No extra resources are required. Suitable for resource-constrained clusters.

- `maxUnavailable: 25%, maxSurge: 25%` — The Kubernetes default. Balanced between speed and safety. For a 4-replica Deployment, Kubernetes can start 1 new pod (25% surge) and have 1 old pod unavailable simultaneously, making the rollout faster than the one-at-a-time approach.

Both values can be specified as absolute integers or percentages. When specified as percentages, they are rounded (down for `maxUnavailable`, up for `maxSurge`) to the nearest whole number.
