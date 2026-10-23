# Helm Repositories — Complete Guide

## Table of Contents
1. [What is a Helm Repository?](#1-what-is-a-helm-repository)
2. [Working with Repositories](#2-working-with-repositories)
3. [ArtifactHub](#3-artifacthub)
4. [OCI Registries for Charts](#4-oci-registries-for-charts)
5. [Private Repositories (ChartMuseum)](#5-private-repositories-chartmuseum)
6. [Chart Dependencies](#6-chart-dependencies)
7. [Publishing Your Own Chart](#7-publishing-your-own-chart)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Helm Repository?

A Helm repository is an HTTP server that hosts packaged chart `.tgz` files and an `index.yaml` file that lists them. Helm clients fetch the `index.yaml` to discover available charts and their versions, then download specific charts as needed.

```
Helm Repository Structure
┌──────────────────────────────────────────────────────────────┐
│  Web Server / S3 / GitHub Pages                              │
│                                                              │
│  index.yaml          ← metadata for all charts in the repo  │
│  nginx-15.3.4.tgz    ← packaged chart archive               │
│  nginx-15.4.0.tgz                                           │
│  postgresql-13.1.0.tgz                                      │
│  redis-18.2.0.tgz                                           │
└──────────────────────────────────────────────────────────────┘

index.yaml contents (excerpt):
apiVersion: v1
entries:
  nginx:
    - name: nginx
      version: 15.4.0
      appVersion: 1.25.4
      description: NGINX Open Source is a web server...
      digest: sha256:a1b2c3...
      urls:
        - https://charts.example.com/nginx-15.4.0.tgz
      created: "2024-01-06T00:00:00Z"
```

Two repository formats exist in Helm 3:

| Format | Description | URL prefix |
|--------|-------------|------------|
| Classic HTTP | Traditional `index.yaml` + `.tgz` files on a web server | `https://` |
| OCI Registry | Charts stored as OCI artifacts in a container registry | `oci://` |

Well-known public repositories:

| Repository | URL | Description |
|------------|-----|-------------|
| Bitnami | `https://charts.bitnami.com/bitnami` | VMware-maintained production charts |
| Ingress-NGINX | `https://kubernetes.github.io/ingress-nginx` | NGINX Ingress Controller |
| cert-manager | `https://charts.jetstack.io` | TLS certificate management |
| Prometheus | `https://prometheus-community.github.io/helm-charts` | Monitoring stack |
| Grafana | `https://grafana.github.io/helm-charts` | Dashboards and Loki |

---

## 2. Working with Repositories

### Add a repository

```bash
# helm repo add <name> <url>
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add cert-manager https://charts.jetstack.io
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

# Add a private repo with basic auth
helm repo add myrepo https://charts.example.com \
  --username admin \
  --password secretpassword

# Add a private repo with TLS client certificates
helm repo add myrepo https://charts.example.com \
  --cert /path/to/client.crt \
  --key /path/to/client.key \
  --ca-file /path/to/ca.crt
```

### List, update, and remove repositories

```bash
# List all configured repositories
helm repo list
# NAME              URL
# bitnami           https://charts.bitnami.com/bitnami
# ingress-nginx     https://kubernetes.github.io/ingress-nginx

# Update the local cache (fetch latest index.yaml from all repos)
helm repo update

# Update a specific repo only
helm repo update bitnami

# Remove a repository
helm repo remove bitnami
```

### Searching for charts

```bash
# Search your locally configured repositories
helm search repo nginx
# NAME                    CHART VERSION  APP VERSION  DESCRIPTION
# bitnami/nginx           15.4.0         1.25.4       NGINX Open Source is a web server...
# ingress-nginx/ingress-nginx  4.9.0    1.9.6         Ingress controller for Kubernetes...

# Search for a specific keyword
helm search repo redis --versions   # show all available versions

# Filter by version constraint
helm search repo bitnami/postgresql --version ">=13.0.0"

# Search ArtifactHub (public registry — requires internet)
helm search hub redis
```

### Inspecting a chart before installing

```bash
# Show chart information (Chart.yaml + README)
helm show chart bitnami/nginx
helm show readme bitnami/nginx
helm show values bitnami/nginx         # Print default values.yaml
helm show all bitnami/nginx            # Show everything

# Download a chart without installing it
helm pull bitnami/nginx
helm pull bitnami/nginx --version 15.3.4    # Specific version
helm pull bitnami/nginx --untar             # Extract the archive

# Output the chart to a specific directory
helm pull bitnami/nginx --untar --untardir ./charts
```

```
Repository Workflow
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  helm repo add bitnami <url>   ← register repo locally      │
│         │                                                    │
│         ▼                                                    │
│  helm repo update              ← fetch index.yaml           │
│         │                                                    │
│         ▼                                                    │
│  helm search repo nginx        ← browse available charts    │
│         │                                                    │
│         ▼                                                    │
│  helm show values bitnami/nginx ← inspect defaults          │
│         │                                                    │
│         ▼                                                    │
│  helm install my-nginx bitnami/nginx --values my.yaml       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. ArtifactHub

**ArtifactHub** (`https://artifacthub.io`) is the official public registry for Helm charts, replacing the deprecated Helm Hub. It aggregates charts from hundreds of publishers and provides discovery, security scanning, and versioning for charts, operators, plugins, and other Kubernetes artifacts.

Key features:
- **Search** across all public Helm repositories in one place
- **Security reports** — shows known CVEs in chart images
- **Chart linting scores** — badges showing chart quality
- **Official/verified publisher badges** — distinguish trusted publishers
- **Direct install snippets** — copy-paste `helm repo add` and `helm install` commands

```bash
# Search ArtifactHub from the CLI (searches hub, not local repos)
helm search hub cert-manager
# URL                                                  CHART VERSION  APP VERSION
# https://artifacthub.io/packages/helm/...cert-manager  v1.14.0       v1.14.0

# The result shows the ArtifactHub URL but not the repo URL directly.
# Visit the ArtifactHub page for the exact helm repo add command.
```

**ArtifactHub URL structure:**
```
https://artifacthub.io/packages/helm/<publisher>/<chart-name>

Examples:
https://artifacthub.io/packages/helm/bitnami/nginx
https://artifacthub.io/packages/helm/cert-manager/cert-manager
https://artifacthub.io/packages/helm/prometheus-community/prometheus
```

---

## 4. OCI Registries for Charts

Since Helm 3.8, **OCI (Open Container Initiative) registries** are a stable alternative to classic HTTP repositories for distributing charts. Charts are stored as OCI artifacts alongside container images in the same registry infrastructure — GHCR, ECR, GCR, Docker Hub, and Azure ACR all support OCI artifacts.

**Advantages of OCI registries:**
- No separate web server needed — use existing container registry
- Strong authentication via standard Docker credentials
- Immutable tags via content-addressed digests
- Charts and their container images colocate in one registry

```bash
# Log in to an OCI registry (uses docker credentials)
helm registry login ghcr.io -u USERNAME --password-stdin

# Pull a chart from an OCI registry (no repo add needed)
helm pull oci://ghcr.io/bitnami/charts/nginx --version 15.4.0

# Install directly from OCI registry
helm install my-nginx oci://ghcr.io/bitnami/charts/nginx \
  --version 15.4.0

# Push a chart to an OCI registry
helm push mychart-0.1.0.tgz oci://ghcr.io/myorg/helm-charts

# Show chart info from OCI registry
helm show chart oci://ghcr.io/bitnami/charts/nginx --version 15.4.0

# Pull from AWS ECR
helm pull oci://123456789.dkr.ecr.us-east-1.amazonaws.com/myapp --version 1.0.0
```

**OCI vs classic repo comparison:**

| Feature | Classic HTTP repo | OCI Registry |
|---------|-------------------|--------------|
| Server setup | Requires web server + index.yaml | Use existing container registry |
| `helm repo add` | Required | Not needed |
| Search | `helm search repo` | Not available — use registry UI |
| Authentication | `--username`/`--password` flags | `helm registry login` |
| Immutability | Tags can be overwritten | Digest-based immutability |
| Helm version | Helm 3+ | Helm 3.8+ (stable) |

```
OCI Registry Chart Distribution
┌──────────────────────────────────────────────────────────────┐
│  Container Registry (GHCR / ECR / GCR / ACR)                │
│                                                              │
│  Repository: ghcr.io/myorg/helm-charts                      │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────┐        │
│  │  mychart:1.0.0       │   │  mychart:1.1.0       │        │
│  │  (OCI artifact)      │   │  (OCI artifact)      │        │
│  └──────────────────────┘   └──────────────────────┘        │
│                                                              │
│  helm push mychart-1.0.0.tgz oci://ghcr.io/myorg/helm-charts│
│  helm pull oci://ghcr.io/myorg/helm-charts/mychart --ver 1.0.0│
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Private Repositories (ChartMuseum)

**ChartMuseum** is an open-source Helm chart repository server. It provides a simple API-driven server that stores charts in local disk, S3, GCS, or Azure Blob Storage and auto-generates `index.yaml`.

**Run ChartMuseum locally:**

```bash
# Run with Docker
docker run --rm -it \
  -p 8080:8080 \
  -e DEBUG=true \
  -e STORAGE=local \
  -e STORAGE_LOCAL_ROOTDIR=/charts \
  -v $(pwd)/charts:/charts \
  ghcr.io/helm/chartmuseum:latest

# Run with Docker on S3 backend
docker run --rm -it \
  -p 8080:8080 \
  -e STORAGE=amazon \
  -e STORAGE_AMAZON_BUCKET=my-helm-charts \
  -e STORAGE_AMAZON_REGION=us-east-1 \
  ghcr.io/helm/chartmuseum:latest
```

**Push charts to ChartMuseum using the helm-push plugin:**

```bash
# Install the cm-push plugin
helm plugin install https://github.com/chartmuseum/helm-push

# Add your ChartMuseum as a repo
helm repo add myrepo http://localhost:8080

# Push a chart (using cm-push plugin)
helm cm-push mychart-0.1.0.tgz myrepo

# Or push directly via curl (no plugin needed)
curl --data-binary "@mychart-0.1.0.tgz" http://localhost:8080/api/charts

# Update local index after pushing
helm repo update

# Verify the chart is listed
helm search repo myrepo
```

**Deploy ChartMuseum in Kubernetes:**

```bash
# Add the ChartMuseum repo
helm repo add chartmuseum https://chartmuseum.github.io/charts

# Install ChartMuseum with S3 storage
helm install chartmuseum chartmuseum/chartmuseum \
  --set env.open.STORAGE=amazon \
  --set env.open.STORAGE_AMAZON_BUCKET=my-charts-bucket \
  --set env.open.STORAGE_AMAZON_REGION=us-east-1 \
  --set env.open.DISABLE_API=false \
  --set persistence.enabled=true \
  --set service.type=LoadBalancer
```

---

## 6. Chart Dependencies

Charts can declare dependencies on other charts in `Chart.yaml`. Helm downloads and bundles them into the `charts/` subdirectory when you run `helm dependency update`.

**Declaring dependencies in Chart.yaml:**

```yaml
dependencies:
  - name: postgresql            # Chart name in the repository
    version: "13.2.x"           # Version constraint (x = any patch version)
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled   # Only install if .Values.postgresql.enabled = true
    alias: db                       # Reference in values as .Values.db.*

  - name: redis
    version: ">=18.0.0 <19.0.0"    # Semver range
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled

  - name: common                    # A library chart (type: library)
    version: "2.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    tags:
      - helpers                     # Enable/disable by tag in values.yaml
```

**Corresponding values.yaml entries for conditions:**

```yaml
postgresql:
  enabled: true
  auth:
    postgresPassword: "changeme"
    database: myappdb

redis:
  enabled: false          # Redis dependency will not be installed

db:                       # Alias — same keys as postgresql but accessed as db.*
  enabled: true
```

**Managing dependencies:**

```bash
# Download declared dependencies into charts/ directory
helm dependency update ./mychart
# Downloads: charts/postgresql-13.2.5.tgz, charts/redis-18.2.0.tgz

# List dependencies and their status
helm dependency list ./mychart
# NAME          VERSION   REPOSITORY                              STATUS
# postgresql    13.2.x    https://charts.bitnami.com/bitnami      ok
# redis         18.x.x    https://charts.bitnami.com/bitnami      ok

# Build from the Chart.lock file (reproducible builds)
helm dependency build ./mychart
```

**Chart.lock** — generated after `dependency update`. Pins exact versions for reproducible builds:

```yaml
# Chart.lock (auto-generated — commit this to git)
dependencies:
- name: postgresql
  repository: https://charts.bitnami.com/bitnami
  version: 13.2.5       # exact version pinned
- name: redis
  repository: https://charts.bitnami.com/bitnami
  version: 18.2.0
digest: sha256:abc123...
generated: "2024-01-06T10:00:00.000000000Z"
```

```
Dependency Resolution
┌──────────────────────────────────────────────────────────────┐
│  mychart/                                                    │
│  ├── Chart.yaml (declares dependencies)                      │
│  ├── Chart.lock (pinned versions — auto-generated)           │
│  └── charts/  ← populated by helm dependency update         │
│      ├── postgresql-13.2.5.tgz                               │
│      └── redis-18.2.0.tgz                                   │
│                                                              │
│  helm install myapp ./mychart                                │
│    → installs mychart + postgresql + redis in one command    │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Publishing Your Own Chart

Publishing a chart makes it available for others (or your CI/CD pipelines) to install via `helm repo add` + `helm install`.

**Step 1: Prepare and lint the chart**

```bash
# Lint for errors and best-practice violations
helm lint ./mychart

# Lint with custom values (test edge cases)
helm lint ./mychart --values prod-values.yaml

# Dry-run against a real cluster to catch API errors
helm install --dry-run --debug myrelease ./mychart
```

**Step 2: Package the chart**

```bash
# Package into a versioned .tgz archive
helm package ./mychart
# Successfully packaged chart and saved it to: mychart-1.0.0.tgz

# Package with a custom destination directory
helm package ./mychart --destination ./dist

# Bump the version in Chart.yaml before packaging
# (update the version field manually, then package)
```

**Step 3: Generate or update index.yaml**

```bash
# Generate index.yaml for a directory of .tgz files
helm repo index ./dist
# Creates dist/index.yaml listing all charts in the directory

# Merge with an existing index (for incremental additions to a repo)
helm repo index ./dist --url https://charts.example.com --merge existing-index.yaml
```

**Step 4: Upload to a web server / GitHub Pages / S3**

```bash
# Upload to S3 using AWS CLI
aws s3 cp ./dist/mychart-1.0.0.tgz s3://my-helm-charts/
aws s3 cp ./dist/index.yaml s3://my-helm-charts/

# GitHub Pages (commit to gh-pages branch and push)
git checkout gh-pages
cp ./dist/mychart-1.0.0.tgz .
cp ./dist/index.yaml .
git add mychart-1.0.0.tgz index.yaml
git commit -m "Release mychart 1.0.0"
git push origin gh-pages
```

**Publish to OCI registry (alternative — no web server needed):**

```bash
# Package the chart
helm package ./mychart

# Log in to the registry
helm registry login ghcr.io -u USERNAME --password-stdin

# Push the chart
helm push mychart-1.0.0.tgz oci://ghcr.io/myorg/helm-charts
# Pushed: ghcr.io/myorg/helm-charts/mychart:1.0.0
# Digest: sha256:abc123...

# Others can now install:
helm install myapp oci://ghcr.io/myorg/helm-charts/mychart --version 1.0.0
```

**Semantic versioning for charts:**

```
Version: MAJOR.MINOR.PATCH

PATCH (1.0.0 → 1.0.1): Bug fixes, documentation updates
MINOR (1.0.0 → 1.1.0): New optional values, new features — backwards compatible
MAJOR (1.0.0 → 2.0.0): Breaking changes to values.yaml structure,
                         removed values, renamed keys, changed defaults

appVersion: tracks the application version (not the chart version)
  Update appVersion when the container image version changes.
  Update version (chart version) when the chart templates change.
```

```
Publishing Workflow
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. helm lint ./mychart          ← validate                 │
│         │                                                    │
│  2. Bump version in Chart.yaml   ← semantic versioning      │
│         │                                                    │
│  3. helm package ./mychart       ← creates .tgz             │
│         │                                                    │
│  4. helm repo index ./dist       ← generates index.yaml     │
│     --merge existing-index.yaml  ← or update existing       │
│         │                                                    │
│  5. Upload .tgz + index.yaml     ← to S3 / GH Pages / OCI  │
│         │                                                    │
│  6. helm repo update             ← consumers run this       │
│         │                                                    │
│  7. helm install myapp myrepo/mychart --version 1.0.0       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Hands-On Exercises

**Exercise 1:** Add three repositories to your local Helm config: Bitnami (`https://charts.bitnami.com/bitnami`), Prometheus Community (`https://prometheus-community.github.io/helm-charts`), and Ingress-NGINX (`https://kubernetes.github.io/ingress-nginx`). Run `helm repo update` to fetch the latest indexes. Then run `helm search repo prometheus` to list available charts. Use `helm show values prometheus-community/kube-prometheus-stack` and redirect the output to a file to inspect the full default values. Note how many lines it is — this is a large, real-world chart.

**Exercise 2:** Create a new chart with `helm create mywebapp`. Add a PostgreSQL dependency to `Chart.yaml` using Bitnami's chart at version `13.x.x` with `condition: postgresql.enabled`. Set `postgresql.enabled: true` in `values.yaml`. Run `helm dependency update ./mywebapp` to download the dependency into `charts/`. Inspect the generated `Chart.lock` file. Then install the chart with `helm install webapp ./mywebapp -n webapp --create-namespace` and run `kubectl get pods -n webapp` to confirm both your app and the PostgreSQL pod are running.

**Exercise 3:** Set up a local ChartMuseum instance using Docker (`ghcr.io/helm/chartmuseum:latest` with `STORAGE=local` and a mounted `./charts` volume on port 8080). Install the `helm-push` plugin. Package any chart you have (`helm package ./mywebapp`) and push it with `helm cm-push mywebapp-0.1.0.tgz myrepo`. Run `helm repo update` and `helm search repo myrepo` to confirm the chart appears. Then install it from your local ChartMuseum with `helm install localtest myrepo/mywebapp`.

**Exercise 4:** Publish a chart to GitHub Container Registry (GHCR) using OCI. Create a simple chart, package it with `helm package`, then log in with `helm registry login ghcr.io`. Push the packaged chart with `helm push mychart-0.1.0.tgz oci://ghcr.io/<your-username>/helm-charts`. Visit `https://github.com/<your-username>?tab=packages` in a browser to confirm the OCI artifact appears. Pull it back down with `helm pull oci://ghcr.io/<your-username>/helm-charts/mychart --version 0.1.0` and verify the `.tgz` file is downloaded.

**Exercise 5:** Practice the full publishing workflow for a static HTTP repository using GitHub Pages. Create a `gh-pages` branch in a GitHub repo. Package your chart, generate `index.yaml` with `helm repo index .`, commit both files, and push the `gh-pages` branch. Enable GitHub Pages in the repo settings. Add the repository with `helm repo add ghpages https://<username>.github.io/<repo>` and run `helm repo update`. Search for your chart with `helm search repo ghpages`. Then increment the chart version, package again, run `helm repo index . --merge index.yaml`, push the new `.tgz` and updated `index.yaml`, and confirm `helm search repo ghpages --versions` shows both versions.

---

## 9. Interview Q&A

**Q: What is the difference between `helm search repo` and `helm search hub`?**
Answer: `helm search repo` searches only the repositories you have added locally with `helm repo add` — it searches the locally cached `index.yaml` files and works offline after the last `helm repo update`. `helm search hub` searches ArtifactHub (`https://artifacthub.io`), which aggregates charts from hundreds of publishers across the entire Helm ecosystem. It requires internet access and returns results from repositories you may not have configured locally. Use `helm search hub` to discover charts you haven't used before, then `helm repo add` the specific repository and use `helm search repo` for day-to-day work.

**Q: What is the purpose of `helm dependency update` and what does it create?**
Answer: `helm dependency update` reads the `dependencies` section in `Chart.yaml`, resolves the version constraints against the configured repositories, downloads the matching chart `.tgz` files, and places them in the `charts/` subdirectory of your chart. It also generates (or updates) `Chart.lock`, which pins the exact resolved versions for reproducible builds. If you only run `helm dependency build` (without `update`), Helm uses the pinned versions in `Chart.lock` rather than re-resolving constraints — important for CI/CD pipelines where you want deterministic builds. You should commit `Chart.lock` to version control but typically add `charts/` to `.helmignore`.

**Q: What is an OCI registry and how does it differ from a classic Helm repository for chart distribution?**
Answer: A classic Helm repository is an HTTP server that hosts `.tgz` chart archives and an `index.yaml` file. You must run a dedicated web server (or use GitHub Pages, S3, ChartMuseum) and manually generate and upload `index.yaml` whenever you publish a new chart. An OCI registry stores charts as OCI artifacts alongside container images in a standard container registry (GHCR, ECR, GCR, ACR). No separate server or `index.yaml` is needed — you push with `helm push` and pull with `helm pull oci://`. OCI offers stronger immutability guarantees, centralised authentication via `helm registry login`, and lets you colocate chart and image versioning in one place. The trade-off is that `helm search` does not work with OCI registries — you need to use the registry's own UI or API to discover available charts.

**Q: When should you use `condition` vs `tags` for chart dependencies?**
Answer: `condition` is a dotted path into the chart's `.Values` that must resolve to `true` to enable the dependency — for example, `condition: postgresql.enabled` means the dependency installs only if the user sets `postgresql.enabled: true` in their values. It is the most common pattern for optional dependencies because it maps naturally to values the user can override. `tags` allow a dependency to be grouped and toggled as a set — you list one or more tag strings on each dependency, then enable or disable the entire group by setting `tags.<tagname>: true/false` in values. Tags are useful when multiple dependencies should be toggled together (e.g., all observability dependencies under a `monitoring` tag), but conditions are clearer for single, independent optional components.

**Q: What does `helm repo index --merge` do and when do you need it?**
Answer: When you run `helm repo index ./dist`, Helm generates a fresh `index.yaml` that lists only the `.tgz` files present in that directory. If you publish charts incrementally — adding one new chart version at a time to a hosted repository — regenerating `index.yaml` from scratch each time would work, but it requires you to have all previous `.tgz` files in the same directory. `helm repo index ./dist --merge existing-index.yaml` fetches the existing `index.yaml` from your live repository, merges the new entries from `./dist` into it, and writes a combined `index.yaml` back to `./dist`. This way you only need the new `.tgz` file locally — the rest of the chart history is preserved from the existing hosted index. It is the standard pattern for CI/CD pipelines that publish one chart at a time to a static file hosting backend like S3 or GitHub Pages.

---
