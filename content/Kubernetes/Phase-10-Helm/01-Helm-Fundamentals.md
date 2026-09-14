# Helm Fundamentals — Complete Guide

## Table of Contents
1. [What is Helm?](#1-what-is-helm)
2. [Helm 3 Architecture (no Tiller)](#2-helm-3-architecture-no-tiller)
3. [Core Concepts: Charts, Releases, Revisions](#3-core-concepts-charts-releases-revisions)
4. [Installing Helm](#4-installing-helm)
5. [Essential Helm Commands](#5-essential-helm-commands)
6. [values.yaml](#6-valuesyaml)
7. [Release Management](#7-release-management)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is Helm?

**Helm** is the package manager for Kubernetes. It solves three problems that arise when managing Kubernetes applications at scale:

- **Templating** — Kubernetes manifests are static YAML files. Helm replaces hardcoded values with template variables so the same set of manifests can be deployed to dev, staging, and production with different images, replica counts, and resource limits.
- **Packaging** — All the manifests that make up an application (Deployment, Service, Ingress, ConfigMap, HPA, etc.) are bundled into a single versioned archive called a **chart**. One command installs the entire application.
- **Lifecycle management** — Helm tracks every install and upgrade as a numbered revision, stores the full state of each revision in the cluster, and allows one-command rollbacks to any previous revision.

```
Without Helm (managing raw YAML):
┌─────────────────────────────────────────────────────────────┐
│  Developer                                                   │
│   kubectl apply -f deployment.yaml                          │
│   kubectl apply -f service.yaml                             │
│   kubectl apply -f ingress.yaml                             │
│   kubectl apply -f configmap.yaml   ← no versioning         │
│   kubectl apply -f hpa.yaml         ← no rollback           │
│   ... (different values per env = copy-paste YAML)          │
└─────────────────────────────────────────────────────────────┘

With Helm:
┌─────────────────────────────────────────────────────────────┐
│  Developer                                                   │
│   helm install myapp ./mychart \                            │
│     --set image.tag=v2.1.0 \        ← override any value   │
│     --values prod-values.yaml        ← env-specific config  │
│                                                             │
│   helm rollback myapp 3              ← one command rollback │
└─────────────────────────────────────────────────────────────┘
```

Helm is the de-facto standard for distributing Kubernetes applications. Major projects — Prometheus, Grafana, cert-manager, NGINX Ingress Controller — all publish official Helm charts.

---

## 2. Helm 3 Architecture (no Tiller)

Helm 2 used a server-side component called **Tiller** that ran inside the cluster with broad RBAC permissions. Tiller was a major security concern because it effectively had cluster-admin rights, and any client that could reach Tiller could deploy anything.

**Helm 3 (released November 2019) removed Tiller entirely.**

```
Helm 2 Architecture (deprecated):
┌──────────────────────────────────────────────────────────┐
│  Developer Machine          │  Kubernetes Cluster        │
│                             │                            │
│  helm CLI ─────────── gRPC ──▶  Tiller Pod               │
│                             │   (cluster-admin)          │
│                             │        │                   │
│                             │        ▼                   │
│                             │   kube-apiserver           │
└──────────────────────────────────────────────────────────┘
  Problem: Tiller has too much power; a security liability

Helm 3 Architecture (current):
┌──────────────────────────────────────────────────────────┐
│  Developer Machine          │  Kubernetes Cluster        │
│                             │                            │
│  helm CLI ──── kubeconfig ───▶  kube-apiserver           │
│   (uses your credentials)   │   (respects your RBAC)     │
│                             │                            │
│                             │  Release state stored as   │
│                             │  Secrets in each namespace │
└──────────────────────────────────────────────────────────┘
  Helm 3 uses your kubeconfig credentials — no extra pod needed
```

**Key Helm 3 changes vs Helm 2:**

| Feature | Helm 2 | Helm 3 |
|---------|--------|--------|
| Server component | Tiller (required) | None — client only |
| Release storage | ConfigMaps in `kube-system` | Secrets in release namespace |
| RBAC | Tiller had cluster-admin | Uses caller's kubeconfig permissions |
| Namespaces | Releases were cluster-global | Releases are namespace-scoped |
| Chart API version | `apiVersion: v1` | `apiVersion: v2` |
| 3-way merge | No | Yes (detects manual changes) |

Release state is stored as base64-encoded Secrets in the same namespace as the release. Each revision gets its own Secret named `sh.helm.release.v1.<release-name>.v<revision>`.

```bash
# See the Secrets Helm creates for release state
kubectl get secrets --field-selector type=helm.sh/release.v1
```

---

## 3. Core Concepts: Charts, Releases, Revisions

**Chart** — a Helm package. A chart is a directory (or `.tgz` archive) containing templates, a `values.yaml` file with defaults, and a `Chart.yaml` metadata file. A chart is analogous to an `apt` package or an `npm` module.

**Release** — a running instance of a chart deployed into a cluster. When you run `helm install`, Helm creates a release. You can install the same chart multiple times (e.g., one `redis` chart installed as `redis-cache` and `redis-session`) — each is an independent release.

**Revision** — every time a release is installed or upgraded, Helm increments the revision counter. Revision 1 is the initial install. Revision 2 is the first upgrade. Rollback to revision 1 creates revision 3 (rollback is itself a new revision).

**Repository** — a collection of charts served over HTTP. Charts are listed in an `index.yaml` file. Think of it as a package registry (like npm registry or PyPI).

```
Core Concepts Relationship
┌──────────────────────────────────────────────────────────────┐
│  Repository                                                  │
│  (e.g., https://charts.bitnami.com/bitnami)                 │
│                                                              │
│    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│    │  nginx      │   │  redis      │   │  postgresql │      │
│    │  chart 1.2  │   │  chart 17.0 │   │  chart 13.1 │      │
│    └─────────────┘   └─────────────┘   └─────────────┘      │
│          │                                                   │
│          │ helm install myapp bitnami/nginx                  │
│          ▼                                                   │
│    Release: myapp (Revision 1)  ← running in cluster        │
│    Release: myapp (Revision 2)  ← after helm upgrade        │
│    Release: myapp (Revision 3)  ← after helm rollback       │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Installing Helm

**macOS (Homebrew):**
```bash
brew install helm
```

**Linux (script):**
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

**Linux (apt):**
```bash
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | \
  sudo tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/usr/share/keyrings/helm.gpg] \
  https://baltocdn.com/helm/stable/debian/ all main" | \
  sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update && sudo apt-get install helm
```

**Windows (Chocolatey):**
```powershell
choco install kubernetes-helm
```

**Verify installation:**
```bash
helm version
# helm.sh/helm/v3: {Version:"v3.14.0", ...}

# Check that Helm can talk to your cluster
helm list
# (empty if no releases installed yet)
```

**Add tab completion (bash/zsh):**
```bash
# Bash
helm completion bash > /etc/bash_completion.d/helm

# Zsh
helm completion zsh > "${fpath[1]}/_helm"
```

---

## 5. Essential Helm Commands

### Install a chart

```bash
# helm install <release-name> <chart>
helm install my-nginx bitnami/nginx

# Install into a specific namespace (creates namespace if it doesn't exist)
helm install my-nginx bitnami/nginx --namespace web --create-namespace

# Install with value overrides
helm install my-nginx bitnami/nginx \
  --set replicaCount=3 \
  --set service.type=LoadBalancer

# Install with a values file
helm install my-nginx bitnami/nginx --values my-values.yaml

# Dry run — render templates without installing
helm install my-nginx bitnami/nginx --dry-run --debug

# Generate a name automatically
helm install bitnami/nginx --generate-name
```

### Upgrade a release

```bash
# helm upgrade <release-name> <chart>
helm upgrade my-nginx bitnami/nginx --set replicaCount=5

# Install if not exists, upgrade if exists
helm upgrade --install my-nginx bitnami/nginx \
  --values prod-values.yaml

# Upgrade and wait for pods to be ready
helm upgrade my-nginx bitnami/nginx --wait --timeout 5m

# Upgrade and automatically rollback on failure
helm upgrade my-nginx bitnami/nginx --atomic
```

### Rollback a release

```bash
# Roll back to the previous revision
helm rollback my-nginx

# Roll back to a specific revision
helm rollback my-nginx 2

# Roll back and wait for completion
helm rollback my-nginx 1 --wait
```

### Inspect releases

```bash
# List all releases in current namespace
helm list

# List releases in all namespaces
helm list --all-namespaces

# Show status and last deployed time
helm status my-nginx

# Show revision history
helm history my-nginx

# Get the rendered manifests that were applied
helm get manifest my-nginx

# Get the values used for a release
helm get values my-nginx

# Get all values (including defaults)
helm get values my-nginx --all

# Get the NOTES.txt output
helm get notes my-nginx
```

### Uninstall a release

```bash
# Remove a release (also deletes release history)
helm uninstall my-nginx

# Keep history after uninstall (allows rollback)
helm uninstall my-nginx --keep-history
```

### Search for charts

```bash
# Search repos you've added
helm search repo nginx

# Search ArtifactHub (public charts)
helm search hub nginx

# Show all versions of a chart
helm search repo bitnami/nginx --versions
```

### Render templates locally

```bash
# Render all templates to stdout (no cluster needed)
helm template my-nginx bitnami/nginx

# Render with value overrides
helm template my-nginx bitnami/nginx --set replicaCount=2

# Render a specific template file
helm template my-nginx ./mychart -s templates/deployment.yaml
```

```
Helm Command Flow
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  helm install ──▶ Revision 1 (DEPLOYED)                    │
│                                                             │
│  helm upgrade ──▶ Revision 2 (DEPLOYED)                    │
│                   Revision 1 (SUPERSEDED)                  │
│                                                             │
│  helm upgrade  ──▶ Revision 3 (FAILED — if pods crash)     │
│    (bad image)     Revision 2 (SUPERSEDED)                 │
│                                                             │
│  helm rollback 2 ▶ Revision 4 (DEPLOYED — copy of rev 2)   │
│                    Revision 3 (SUPERSEDED)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. values.yaml

`values.yaml` is the configuration file for a chart. It defines default values that templates reference via `.Values`. Users can override any value at install/upgrade time.

```yaml
# values.yaml — default configuration for the chart
replicaCount: 1

image:
  repository: nginx
  tag: "1.25.3"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: ""
  host: ""

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

env: []
# - name: LOG_LEVEL
#   value: info

nodeSelector: {}
tolerations: []
affinity: {}
```

**Overriding values at install time:**

```bash
# Override a single scalar value
helm install myapp ./mychart --set replicaCount=3

# Override a nested value (dot notation)
helm install myapp ./mychart --set image.tag=v2.0.0

# Override multiple values
helm install myapp ./mychart \
  --set image.tag=v2.0.0 \
  --set service.type=LoadBalancer \
  --set replicaCount=3

# Override with a list item
helm install myapp ./mychart --set env[0].name=LOG_LEVEL,env[0].value=debug

# Override with a values file (recommended for many overrides)
helm install myapp ./mychart --values prod-values.yaml

# Multiple values files — later files take precedence
helm install myapp ./mychart \
  --values base-values.yaml \
  --values prod-values.yaml
```

**Values precedence (highest to lowest):**
1. `--set` flags on the command line
2. `--values` / `-f` files (rightmost file wins)
3. `values.yaml` defaults in the chart

---

## 7. Release Management

Every Helm operation on a release is tracked as a revision. Understanding release states helps with debugging and recovery.

**Release states:**

| State | Description |
|-------|-------------|
| `PENDING_INSTALL` | Install started, hooks running |
| `DEPLOYED` | Successfully installed or upgraded |
| `FAILED` | Install or upgrade failed (pods crashed, hooks failed) |
| `SUPERSEDED` | A newer revision has replaced this one |
| `PENDING_UPGRADE` | Upgrade in progress |
| `UNINSTALLING` | Uninstall in progress |

```bash
# View full revision history with states
helm history my-nginx
# REVISION  UPDATED        STATUS      CHART         APP VERSION  DESCRIPTION
# 1         Mon Jan 6 ...  superseded  nginx-15.3.4  1.25.3       Install complete
# 2         Mon Jan 6 ...  deployed    nginx-15.4.0  1.25.4       Upgrade complete

# After a failed upgrade — revision 3 is FAILED, revision 2 is still DEPLOYED
# helm rollback my-nginx 2  ← restores revision 2, creating revision 3
```

**Atomic upgrades — the safest pattern:**

```bash
# --atomic: if upgrade fails, automatically rollback to last successful revision
helm upgrade my-nginx bitnami/nginx \
  --set image.tag=bad-tag \
  --atomic \
  --timeout 3m
# If pods don't become Ready within 3m, Helm automatically rolls back
```

```
Release Lifecycle
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  helm install ──▶  PENDING_INSTALL ──▶ DEPLOYED             │
│                                    └─▶ FAILED               │
│                                                              │
│  helm upgrade ──▶  PENDING_UPGRADE ──▶ DEPLOYED             │
│     (old rev becomes SUPERSEDED)   └─▶ FAILED               │
│                                                              │
│  helm rollback ──▶ DEPLOYED (new revision = copy of old)    │
│                                                              │
│  helm uninstall ──▶ (release removed from cluster)          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Checking what changed between revisions:**

```bash
# Compare values between two revisions
helm get values my-nginx --revision 1 > /tmp/rev1-values.yaml
helm get values my-nginx --revision 2 > /tmp/rev2-values.yaml
diff /tmp/rev1-values.yaml /tmp/rev2-values.yaml

# Get manifests for a specific revision
helm get manifest my-nginx --revision 1
```

---

## 8. Hands-On Exercises

**Exercise 1:** Add the Bitnami Helm repository (`helm repo add bitnami https://charts.bitnami.com/bitnami`) and install NGINX into a new namespace called `helm-demo` with the release name `my-nginx`. Override `replicaCount` to `2` and `service.type` to `NodePort` using `--set`. Run `helm list -n helm-demo` and `kubectl get all -n helm-demo` to confirm the release and its resources were created. Inspect the release's stored values with `helm get values my-nginx -n helm-demo`.

**Exercise 2:** Upgrade the `my-nginx` release from Exercise 1. Change `replicaCount` to `3` and add an environment variable by setting `extraEnvVars[0].name=MY_VAR` and `extraEnvVars[0].value=hello`. Run `helm history my-nginx -n helm-demo` to confirm revision 2 now shows as `DEPLOYED` and revision 1 as `SUPERSEDED`. Use `helm get manifest my-nginx -n helm-demo` to verify the Deployment has 3 replicas.

**Exercise 3:** Simulate a failed upgrade by setting an invalid image tag: `helm upgrade my-nginx bitnami/nginx --set image.tag=this-tag-does-not-exist --wait --timeout 60s -n helm-demo`. Observe the upgrade fail. Check `helm history my-nginx -n helm-demo` — revision 3 should show `FAILED`. Now run `helm rollback my-nginx 2 -n helm-demo` and confirm revision 4 is created with status `DEPLOYED`. Verify pods are running with `kubectl get pods -n helm-demo`.

**Exercise 4:** Create a custom `values.yaml` file that overrides `replicaCount: 4`, sets `service.type: ClusterIP`, and adds a `nodeSelector` label `disktype: ssd`. Install a second release named `my-nginx-prod` using `helm install my-nginx-prod bitnami/nginx --values your-values.yaml -n helm-demo`. Use `helm get values my-nginx-prod -n helm-demo --all` to see all effective values and confirm your overrides are present.

**Exercise 5:** Run `helm template my-nginx bitnami/nginx --set replicaCount=5 --set image.tag=1.26.0` and pipe the output to a file. Open the file and identify the rendered Deployment manifest — confirm the `replicas` field is `5` and the image tag is `1.26.0`. Then run `helm uninstall my-nginx -n helm-demo` and verify with `helm list -n helm-demo` that the release is gone and with `kubectl get all -n helm-demo` that all resources were cleaned up.

---

## 9. Interview Q&A

**Q: What problem does Helm solve, and why not just use kubectl apply -f?**
Answer: `kubectl apply -f` works for static manifests but breaks down at scale. You end up with copy-pasted YAML directories for each environment, no way to upgrade atomically, no built-in rollback, and no versioning of what was deployed when. Helm solves all three: templating removes duplication by externalising variable values into `values.yaml`, packaging bundles all related manifests into a single chart that installs with one command, and release management tracks every change as a numbered revision so you can roll back with `helm rollback`. For one-off ad hoc deploys `kubectl apply` is fine; for anything that goes to multiple environments or needs upgrade/rollback, Helm is the right tool.

**Q: What was wrong with Tiller in Helm 2, and how did Helm 3 fix it?**
Answer: Tiller was a server-side pod that ran in `kube-system` with cluster-admin privileges. Any client that could reach the Tiller gRPC port could deploy or delete anything in the cluster, regardless of the caller's own RBAC permissions. This was a significant security liability — a compromised client or network attacker could take over the entire cluster via Tiller. Helm 3 removed Tiller entirely. The Helm CLI now communicates directly with the Kubernetes API server using the operator's own kubeconfig credentials, so it is subject to the same RBAC rules as any other client. Release state previously stored in ConfigMaps in `kube-system` is now stored as Secrets in the release's own namespace, which means you can give team members per-namespace Helm access without granting cluster-wide permissions.

**Q: What is the difference between a Helm chart and a Helm release?**
Answer: A chart is a static package — a directory or `.tgz` archive containing templates, a `values.yaml`, and a `Chart.yaml`. It is analogous to a `.deb` package. A release is a live, running instance of a chart deployed into a cluster namespace. You can create multiple releases from the same chart — for example, installing the `redis` chart twice as `redis-cache` (with maxmemory policy `allkeys-lru`) and `redis-session` (with maxmemory policy `noeviction`). Each release has its own independent history, values, and lifecycle, even though they share the same chart source.

**Q: How does `helm upgrade --atomic` work and when should you use it?**
Answer: `--atomic` combines `--wait` (wait for all pods to become Ready) with automatic rollback on failure. If the upgraded release does not reach a healthy state within the `--timeout` period, Helm automatically rolls back to the last successful revision and marks the failed revision as `FAILED`. You should use `--atomic` in CI/CD pipelines where a failed upgrade must never leave the cluster in a broken intermediate state. Without `--atomic`, a failed upgrade leaves the cluster running the new (broken) revision, requiring a manual `helm rollback` to recover. The trade-off is that `--atomic` can mask the failed pods — you should capture logs before the rollback fires in automated pipelines.

**Q: Where does Helm store release state in Helm 3, and why does it matter?**
Answer: Helm 3 stores release state as Kubernetes Secrets with the type `helm.sh/release.v1`, named `sh.helm.release.v1.<release-name>.v<revision>`, in the same namespace as the release. Each Secret contains the full rendered manifest and values for that revision, base64-encoded. This matters for several reasons: (1) release history survives cluster restarts because it lives in etcd, (2) RBAC for Helm access is now just standard Kubernetes RBAC on Secrets in a namespace — no special Tiller configuration needed, (3) you can list Helm releases in a namespace with `kubectl get secrets -l owner=helm`, and (4) namespace-scoped storage means two teams can each manage their own namespace independently without interfering with each other's release history.

---
