# Project 5: Helm Packaged App

**Level:** Advanced
**Time Estimate:** 90 – 120 minutes
**Phase Prerequisite:** Phase 10 (Helm)

---

## Overview

This project walks you through building a production-quality Helm chart from scratch for a web application. You will author every template file, define a layered values system, lint and render the chart locally, install and upgrade it against a live cluster, push it to an OCI registry, and run rollbacks — the full Helm lifecycle.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HELM WORKFLOW                                │
│                                                                     │
│   Developer                                                         │
│      │                                                              │
│      │  helm install / helm upgrade                                 │
│      ▼                                                              │
│  ┌─────────────────────────────────────────┐                        │
│  │              Helm Engine                │                        │
│  │                                         │                        │
│  │  templates/*.yaml  ──┐                  │                        │
│  │                       ├─► Go Template   │                        │
│  │  values.yaml       ──┘    Renderer      │                        │
│  │  values-prod.yaml  ──►  (merge/overlay) │                        │
│  └─────────────────────────┬───────────────┘                        │
│                            │  Rendered Manifests                    │
│                            ▼                                        │
│                   Kubernetes API Server                             │
│                            │                                        │
│           ┌────────────────┼────────────────┐                       │
│           ▼                ▼                ▼                       │
│      Deployment       Service           Ingress                     │
│      (ReplicaSet)    (ClusterIP)       (nginx)                      │
│           │                                                         │
│           └──────────► ConfigMap (env config)                       │
│                                                                     │
│  ┌──────────────────────────────────┐                               │
│  │         OCI Registry             │                               │
│  │  registry-1.docker.io/<user>/    │                               │
│  │      myapp:0.1.0.tgz             │  ◄── helm push                │
│  └──────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- `kubectl` configured and pointing at a running cluster (minikube, kind, or cloud-managed)
- Helm 3.8 or later installed (`helm version` to verify)
- A running cluster with an Ingress controller deployed (nginx-ingress recommended)
- A Docker Hub or GitHub Container Registry (GHCR) account for OCI push/pull
- Basic familiarity with Kubernetes Deployments, Services, and Ingress resources
- Phase 9 (CI/CD concepts) is helpful for understanding chart promotion pipelines but is not required

---

## What You'll Learn

1. Scaffold a new Helm chart with `helm create` and understand every generated file
2. Author a complete `Chart.yaml` with metadata, keywords, and maintainer information
3. Design a structured `values.yaml` that serves as the single source of truth for defaults
4. Layer environment-specific overrides using `values-prod.yaml`
5. Write Go template syntax (`{{ }}`) including pipelines, functions, and filters
6. Use conditional rendering with `{{- if }}` / `{{- else }}` / `{{- end }}`
7. Iterate over collections using `{{- range }}` for both lists and maps
8. Define and reuse named templates with `{{- define }}` and `{{ include }}`
9. Lint charts with `helm lint`, dry-run with `helm template`, and validate before install
10. Package charts into `.tgz` artifacts with `helm package`
11. Push to and install from an OCI registry with `helm push` / `helm install oci://`
12. Perform in-place upgrades and safe rollbacks with `helm upgrade` and `helm rollback`

---

## Project Structure

```
myapp/
├── Chart.yaml                  # Chart metadata (name, version, dependencies)
├── values.yaml                 # Default values — source of truth
├── values-prod.yaml            # Production overrides (committed to repo)
├── .helmignore                 # Files excluded from helm package
└── templates/
    ├── _helpers.tpl            # Named template definitions (no output)
    ├── configmap.yaml          # ConfigMap for app configuration
    ├── deployment.yaml         # Deployment + container spec
    ├── service.yaml            # ClusterIP / LoadBalancer Service
    ├── ingress.yaml            # Optional Ingress (conditional)
    └── tests/
        └── test-connection.yaml  # helm test smoke-test Pod
```

---

## Step-by-Step Guide

### Step 1: Scaffold the Chart

Use `helm create` to generate the initial scaffold, then wipe the generated templates so you write everything by hand:

```bash
helm create myapp
```

Helm generates:
- `Chart.yaml` — chart metadata file
- `values.yaml` — default values (pre-populated with example values)
- `templates/` — a set of example templates (Deployment, Service, Ingress, HPA, ServiceAccount, NOTES.txt)
- `templates/tests/test-connection.yaml` — example test hook
- `.helmignore` — patterns for files to exclude when packaging

Remove the generated templates to start clean:

```bash
rm -rf myapp/templates/*
mkdir -p myapp/templates/tests
```

You will now author every template file from scratch so you understand each directive.

---

### Step 2: Write Chart.yaml

`Chart.yaml` is the mandatory metadata file. `apiVersion: v2` is required for Helm 3.

```yaml
# myapp/Chart.yaml
apiVersion: v2

name: myapp
description: >
  A production-ready Helm chart for the MyApp web application.
  Includes Deployment, Service, Ingress, ConfigMap, and optional HPA.

# "application" is the default; use "library" for charts that only
# provide named templates and no renderable resources.
type: application

# Chart version — bump this on every chart change (SemVer).
version: 0.1.0

# Application version — the Docker image tag used by default.
appVersion: "1.0.0"

keywords:
  - web
  - api
  - nginx

home: https://github.com/your-org/myapp

sources:
  - https://github.com/your-org/myapp

maintainers:
  - name: Ganesh Pirikirala
    email: Ganesh.Pirikirala@cognitivo.com.au
    url: https://github.com/your-org

annotations:
  category: WebApplication
```

---

### Step 3: Write values.yaml

`values.yaml` defines every configurable parameter with safe, development-friendly defaults. Every field referenced in any template must appear here.

```yaml
# myapp/values.yaml

# ---------------------------------------------------------------------------
# Replica count
# ---------------------------------------------------------------------------
replicaCount: 2

# ---------------------------------------------------------------------------
# Container image
# ---------------------------------------------------------------------------
image:
  repository: docker.io/yourorg/myapp
  # Overrides Chart.appVersion when set; leave empty to use appVersion.
  tag: ""
  pullPolicy: IfNotPresent

# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
service:
  type: ClusterIP
  port: 80
  targetPort: 8080

# ---------------------------------------------------------------------------
# Ingress
# ---------------------------------------------------------------------------
ingress:
  enabled: false
  className: nginx
  annotations: {}
    # nginx.ingress.kubernetes.io/rewrite-target: /
    # cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []
  #  - secretName: myapp-tls
  #    hosts:
  #      - myapp.example.com

# ---------------------------------------------------------------------------
# Resource requests and limits
# ---------------------------------------------------------------------------
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

# ---------------------------------------------------------------------------
# Horizontal Pod Autoscaler
# ---------------------------------------------------------------------------
autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

# ---------------------------------------------------------------------------
# Application configuration (rendered into a ConfigMap)
# ---------------------------------------------------------------------------
config:
  logLevel: info
  apiBaseUrl: ""

# ---------------------------------------------------------------------------
# Extra environment variables injected directly into the container.
# Each entry requires a "name" and a "value" key.
# ---------------------------------------------------------------------------
env: []
# - name: FEATURE_FLAG_DARK_MODE
#   value: "true"

# ---------------------------------------------------------------------------
# Scheduling controls
# ---------------------------------------------------------------------------
nodeSelector: {}

tolerations: []

affinity: {}
```

---

### Step 4: Write values-prod.yaml

`values-prod.yaml` contains only the keys that differ from the defaults. Helm merges this on top of `values.yaml` at render time with `-f`.

```yaml
# myapp/values-prod.yaml

replicaCount: 5

image:
  tag: "1.2.0"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "16m"
  hosts:
    - host: myapp.prod.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-prod-tls
      hosts:
        - myapp.prod.example.com

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60

config:
  logLevel: warn
  apiBaseUrl: "https://api.prod.example.com"

env:
  - name: ENVIRONMENT
    value: "production"
  - name: SENTRY_DSN
    value: "https://abc123@o0.ingest.sentry.io/0"
```

---

### Step 5: Write templates/_helpers.tpl

`_helpers.tpl` is a special file prefixed with `_` — Helm never renders it directly. It exists solely to hold `{{- define }}` blocks that other templates call with `{{ include }}`.

```go
{{/*
myapp/templates/_helpers.tpl

Named template library for the myapp chart.
All templates are namespaced with "myapp." to avoid collisions
when this chart is used as a sub-chart.
*/}}

{{/*
Expand the name of the chart.
Truncated at 63 characters because Kubernetes name fields have a
63-character limit (DNS label standard).
*/}}
{{- define "myapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
If .Values.fullnameOverride is set, use it directly (truncated).
Otherwise combine release name and chart name, separated by "-".
If the release name already contains the chart name, use the
release name only to avoid duplication (e.g., "myapp-myapp" → "myapp").
*/}}
{{- define "myapp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label value: "<chart-name>-<chart-version>".
Replace "+" with "_" because "+" is not valid in label values.
*/}}
{{- define "myapp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
These are the recommended Helm label set per the Helm best-practices guide.
*/}}
{{- define "myapp.labels" -}}
helm.sh/chart: {{ include "myapp.chart" . }}
{{ include "myapp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — used in spec.selector.matchLabels and
pod template metadata.labels. Must remain stable across upgrades;
never add mutable fields here.
*/}}
{{- define "myapp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

---

### Step 6: Write templates/configmap.yaml

The ConfigMap surfaces application configuration as environment variables via `envFrom` in the Deployment.

```yaml
# myapp/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "myapp.fullname" . }}-config
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
data:
  LOG_LEVEL: {{ .Values.config.logLevel | quote }}
  API_BASE_URL: {{ .Values.config.apiBaseUrl | quote }}
```

`nindent 4` indents the multi-line label block by 4 spaces and adds a leading newline, which is required after a block-scalar key like `labels:`.

---

### Step 7: Write templates/deployment.yaml

This is the most complex template. It demonstrates: named template inclusion, conditional blocks, range over a list, `envFrom`, probes, and scheduling fields.

```yaml
# myapp/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
      annotations:
        # Force pod restart when the ConfigMap content changes.
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}

          # Extra environment variables from values.yaml .env list.
          {{- if .Values.env }}
          env:
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          {{- end }}

          # Pull configuration from the ConfigMap as environment variables.
          envFrom:
            - configMapRef:
                name: {{ include "myapp.fullname" . }}-config

          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP

          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3

          resources:
            {{- toYaml .Values.resources | nindent 12 }}

      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}

      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}

      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

**Key directives explained:**

- `{{- if not .Values.autoscaling.enabled }}` — omits the static `replicas` field when the HPA is managing replica count; otherwise the HPA and the Deployment fight each other.
- `{{ .Values.image.tag | default .Chart.AppVersion }}` — the `default` function falls back to `appVersion` if `tag` is empty.
- `{{- range .Values.env }}` — iterates the `env` list; inside the range block `.name` and `.value` refer to keys on each list item.
- `{{- with .Values.nodeSelector }}` — evaluates the block only when the value is non-empty; `.` inside the `with` block refers to `.Values.nodeSelector`.
- `{{ toYaml . | nindent 12 }}` — serialises an arbitrary Go value back to YAML and indents it correctly.

---

### Step 8: Write templates/service.yaml

```yaml
# myapp/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "myapp.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "myapp.selectorLabels" . | nindent 4 }}
```

`selector` uses `myapp.selectorLabels` — the same labels applied to the pod template — so the Service correctly routes traffic to the pods managed by this Deployment.

---

### Step 9: Write templates/ingress.yaml

The entire Ingress resource is wrapped in an `if` block so it only renders when `ingress.enabled` is `true`. Two nested `range` loops iterate hosts and paths.

```yaml
# myapp/templates/ingress.yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "myapp.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- range $key, $value := . }}
    {{ $key }}: {{ $value | quote }}
    {{- end }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "myapp.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

**Key directives explained:**

- `{{- range $key, $value := .Values.ingress.annotations }}` — map range; `$key` and `$value` are scoped variables holding the key and value for each annotation.
- `{{- range .Values.ingress.tls }}` — list range; `.` inside the block refers to each TLS entry.
- Inside a nested `range`, the outer scope is shadowed. Use `$` to access the root context (e.g., `{{ include "myapp.fullname" $ }}` and `{{ $.Values.service.port }}`).

---

### Step 10: Write templates/tests/test-connection.yaml

Helm test hooks are annotated Pods that Helm runs on demand via `helm test`. They must exit 0 for the test to pass.

```yaml
# myapp/templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: {{ include "myapp.fullname" . }}-test-connection
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    # This annotation makes Helm treat the Pod as a test hook.
    # Helm will create it only during "helm test", then delete it
    # (or leave it, depending on the hook-delete-policy).
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox:1.36
      command:
        - wget
      args:
        - --spider
        - --timeout=10
        - "http://{{ include "myapp.fullname" . }}.{{ .Release.Namespace }}.svc.cluster.local:{{ .Values.service.port }}/health"
```

The `wget --spider` flag performs an HTTP HEAD request without downloading the body — a lightweight liveness check. The fully-qualified DNS name `<svc>.<namespace>.svc.cluster.local` ensures the test Pod can reach the Service from any namespace.

---

### Step 11: Lint and Render

**Lint** — checks for structural errors, missing required fields, and common mistakes:

```bash
helm lint myapp/
```

Expected output:

```
==> Linting myapp/
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
```

**Render with default values** — prints the fully rendered YAML manifests to stdout without contacting the cluster:

```bash
helm template myapp myapp/
```

**Render with production overrides** — applies `values-prod.yaml` on top of `values.yaml`:

```bash
helm template myapp myapp/ -f myapp/values-prod.yaml
```

What to verify in the output:
- The Ingress resource appears only in the prod render (because `ingress.enabled: true` in `values-prod.yaml`).
- `replicaCount` is absent from the Deployment in the prod render (because `autoscaling.enabled: true` omits the static replica count).
- The image tag shows `1.2.0` in the prod render and `1.0.0` (from `appVersion`) in the default render.
- All label blocks are consistently indented.
- No `<no value>` tokens appear anywhere in the output (these indicate a missing or misspelled `.Values` key).

**Debug a single template:**

```bash
helm template myapp myapp/ --show-only templates/ingress.yaml -f myapp/values-prod.yaml
```

---

### Step 12: Install the Chart

```bash
# Create the namespace automatically and install.
helm install myapp ./myapp \
  --namespace helm-demo \
  --create-namespace

# Verify the release is listed.
helm list -n helm-demo

# Inspect all created Kubernetes objects.
kubectl get all -n helm-demo
kubectl get configmap -n helm-demo
kubectl get ingress -n helm-demo  # will be empty — ingress.enabled is false by default
```

Expected `helm list` output:

```
NAME    NAMESPACE  REVISION  UPDATED                   STATUS    CHART         APP VERSION
myapp   helm-demo  1         2026-06-25 10:00:00 UTC   deployed  myapp-0.1.0   1.0.0
```

---

### Step 13: Upgrade with Production Values

```bash
helm upgrade myapp ./myapp \
  -f myapp/values-prod.yaml \
  -n helm-demo

# Inspect the revision history.
helm history myapp -n helm-demo
```

Expected `helm history` output:

```
REVISION  UPDATED                   STATUS      CHART         APP VERSION  DESCRIPTION
1         2026-06-25 10:00:00 UTC   superseded  myapp-0.1.0   1.0.0        Install complete
2         2026-06-25 10:05:00 UTC   deployed    myapp-0.1.0   1.0.0        Upgrade complete
```

Verify the Ingress was created on upgrade:

```bash
kubectl get ingress -n helm-demo
```

---

### Step 14: Run Helm Tests

```bash
helm test myapp -n helm-demo
```

Expected output:

```
NAME: myapp
LAST DEPLOYED: ...
NAMESPACE: helm-demo
STATUS: deployed
REVISION: 2
TEST SUITE:     myapp-test-connection
Last Started:   ...
Last Completed: ...
Phase:          Succeeded
```

If the test fails, inspect the Pod logs:

```bash
kubectl logs myapp-test-connection -n helm-demo
```

---

### Step 15: Package the Chart

```bash
helm package myapp/
```

Helm reads the `version` field from `Chart.yaml` and creates a versioned archive:

```bash
ls -la myapp-0.1.0.tgz
```

Expected output:

```
-rw-r--r--  1 user  staff  3842 Jun 25 10:10 myapp-0.1.0.tgz
```

You can inspect the contents without extracting:

```bash
tar -tzf myapp-0.1.0.tgz
```

---

### Step 16: Push to OCI Registry (Docker Hub)

Helm 3.8+ supports OCI registries natively. No Helm plugin is required.

```bash
# Authenticate to Docker Hub.
helm registry login registry-1.docker.io -u <your-dockerhub-username>
# Enter your password or personal access token at the prompt.

# Push the packaged chart.
helm push myapp-0.1.0.tgz oci://registry-1.docker.io/<your-dockerhub-username>

# Verify the chart metadata is accessible from the registry.
helm show all oci://registry-1.docker.io/<your-dockerhub-username>/myapp --version 0.1.0
```

Expected push output:

```
Pushed: registry-1.docker.io/<your-dockerhub-username>/myapp:0.1.0
Digest: sha256:abc123...
```

For GHCR, replace the registry URL:

```bash
helm registry login ghcr.io -u <your-github-username>
helm push myapp-0.1.0.tgz oci://ghcr.io/<your-github-username>
helm show all oci://ghcr.io/<your-github-username>/myapp --version 0.1.0
```

---

### Step 17: Install from OCI Registry

Install the chart directly from the registry without downloading the `.tgz` manually:

```bash
helm install myapp-from-registry \
  oci://registry-1.docker.io/<your-dockerhub-username>/myapp \
  --version 0.1.0 \
  -n helm-demo
```

Verify the second release:

```bash
helm list -n helm-demo
kubectl get all -n helm-demo
```

You should now see two separate releases in the namespace: `myapp` and `myapp-from-registry`.

---

### Step 18: Rollback

Roll the `myapp` release back to revision 1 (the initial install with default values):

```bash
helm rollback myapp 1 -n helm-demo
```

Inspect the updated history:

```bash
helm history myapp -n helm-demo
```

Expected output:

```
REVISION  UPDATED                   STATUS      CHART         APP VERSION  DESCRIPTION
1         2026-06-25 10:00:00 UTC   superseded  myapp-0.1.0   1.0.0        Install complete
2         2026-06-25 10:05:00 UTC   superseded  myapp-0.1.0   1.0.0        Upgrade complete
3         2026-06-25 10:15:00 UTC   deployed    myapp-0.1.0   1.0.0        Rollback to 1
```

Verify the Ingress is gone (since revision 1 had `ingress.enabled: false`):

```bash
kubectl get ingress -n helm-demo
# Expected: No resources found in helm-demo namespace.
```

Rollback is atomic — Helm applies the diff from the stored release secret for revision 1, so all resources return to their prior state.

---

## Verification

| Check | Command | Expected Result |
|---|---|---|
| `helm lint` passes | `helm lint myapp/` | `0 chart(s) failed` |
| Default template renders cleanly | `helm template myapp myapp/ 2>&1 \| grep -c '<no value>'` | `0` |
| Prod template renders Ingress | `helm template myapp myapp/ -f myapp/values-prod.yaml --show-only templates/ingress.yaml` | Full Ingress YAML printed |
| Chart installed successfully | `helm list -n helm-demo` | STATUS = `deployed`, REVISION = 1 |
| All pods running | `kubectl get pods -n helm-demo` | All pods in `Running` state, READY `1/1` |
| ConfigMap present | `kubectl get configmap -n helm-demo` | `myapp-config` listed |
| Helm test passes | `helm test myapp -n helm-demo` | Phase = `Succeeded` |
| History shows all revisions | `helm history myapp -n helm-demo` | At least 3 rows (install, upgrade, rollback) |
| OCI push succeeds | `helm push myapp-0.1.0.tgz oci://registry-1.docker.io/<user>` | Digest printed, no error |
| OCI install succeeds | `helm list -n helm-demo` | Both `myapp` and `myapp-from-registry` listed |

---

## Challenges

### Challenge 1: Add a JSON Schema for Values Validation

Helm supports JSON Schema validation via a `values.schema.json` file in the chart root. When present, Helm validates the merged values object against the schema before rendering any templates.

Create `myapp/values.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/07/schema#",
  "title": "MyApp Helm Chart Values",
  "type": "object",
  "required": ["image"],
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of pod replicas"
    },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": {
          "type": "string",
          "minLength": 1,
          "description": "Container image repository — must not be empty"
        },
        "tag": {
          "type": "string",
          "description": "Image tag; defaults to Chart.appVersion when empty"
        },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"],
          "description": "Kubernetes imagePullPolicy"
        }
      }
    },
    "service": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["ClusterIP", "NodePort", "LoadBalancer"]
        },
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535
        }
      }
    },
    "resources": {
      "type": "object",
      "properties": {
        "requests": { "type": "object" },
        "limits": { "type": "object" }
      }
    }
  }
}
```

Test that validation rejects a bad install:

```bash
# This should fail with a schema validation error.
helm install myapp ./myapp --set image.repository="" -n helm-demo
```

Expected error:

```
Error: values don't meet the specifications of the schema(s) in the following chart(s):
myapp:
- image.repository: String length must be greater than or equal to 1
```

### Challenge 2: Add a NOTES.txt Post-Install Message

Create `myapp/templates/NOTES.txt` (no `.yaml` extension — Helm renders it as plain text and prints it after install/upgrade):

```
{{- $fullName := include "myapp.fullname" . -}}
Thank you for installing {{ .Chart.Name }} {{ .Chart.AppVersion }}!

Release name : {{ .Release.Name }}
Namespace    : {{ .Release.Namespace }}
Chart version: {{ .Chart.Version }}
Image        : {{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}

{{- if .Values.ingress.enabled }}

The application is accessible via Ingress:
{{- range .Values.ingress.hosts }}
  http{{ if $.Values.ingress.tls }}s{{ end }}://{{ .host }}
{{- end }}

{{- else }}

To access the application locally, run:

  kubectl port-forward svc/{{ $fullName }} 8080:{{ .Values.service.port }} -n {{ .Release.Namespace }}

Then open: http://127.0.0.1:8080

{{- end }}

To view running pods:
  kubectl get pods -n {{ .Release.Namespace }} -l "app.kubernetes.io/name={{ include "myapp.name" . }}"

To tail application logs:
  kubectl logs -n {{ .Release.Namespace }} -l "app.kubernetes.io/name={{ include "myapp.name" . }}" -f
```

Re-install or upgrade to see the rendered message printed to the terminal.

### Challenge 3: Add a Redis Sub-Chart Dependency

Helm sub-charts allow you to bundle upstream charts as dependencies. Add Bitnami Redis as a dependency in `Chart.yaml`:

```yaml
# Add to myapp/Chart.yaml
dependencies:
  - name: redis
    version: "19.x.x"
    repository: oci://registry-1.docker.io/bitnamicharts
    alias: cache
    condition: cache.enabled
```

Pull the dependency into `myapp/charts/`:

```bash
helm dependency update myapp/
ls myapp/charts/
# redis-19.x.x.tgz
```

Configure the sub-chart via `values.yaml`. Because the alias is `cache`, all redis values are nested under the `cache` key:

```yaml
# Add to myapp/values.yaml
cache:
  enabled: false
  auth:
    enabled: false
  master:
    persistence:
      enabled: false
  replica:
    replicaCount: 0
```

Enable Redis in `values-prod.yaml`:

```yaml
# Add to myapp/values-prod.yaml
cache:
  enabled: true
  auth:
    enabled: true
    password: "changeme-use-a-secret-manager"
  master:
    persistence:
      enabled: true
      size: 8Gi
  replica:
    replicaCount: 1
```

Reference the Redis host in the application config:

```yaml
# Add to myapp/values.yaml under config:
config:
  logLevel: info
  apiBaseUrl: ""
  redisHost: ""  # Set to "myapp-cache-master" when cache.enabled=true
```

```yaml
# Add to myapp/values-prod.yaml under config:
config:
  logLevel: warn
  apiBaseUrl: "https://api.prod.example.com"
  redisHost: "myapp-cache-master"
```

Run `helm dependency update` whenever you change the `dependencies` block in `Chart.yaml`. Commit the `myapp/charts/*.tgz` files to source control (or use `.helmignore` and rely on `helm dependency build` in CI).

---

## Key Takeaways

- **Helm is Kubernetes' package manager.** It bundles all the manifests required to deploy an application into a single versioned `.tgz` artifact, making installation a one-liner and uninstallation completely clean.
- **Go templates enable dynamic rendering.** Directives like `{{ if }}`, `{{ range }}`, `{{ include }}`, and pipelines (`| default`, `| quote`, `| nindent`) make a single chart work correctly across dev, staging, and production environments.
- **`values.yaml` is the public API of your chart.** Every tunable parameter must appear here with a sensible default. Operators override only what they need in environment-specific files like `values-prod.yaml`.
- **Named templates in `_helpers.tpl` enforce DRY code.** Defining labels and name helpers once and including them in every template ensures consistency and makes global changes (e.g., adding a new standard label) a one-line edit.
- **The Helm lifecycle maps directly to your delivery process.** `helm install` → `helm upgrade` → `helm rollback` maps to deploy → promote → recover, with full revision history stored as Kubernetes Secrets in the release namespace.
- **OCI registries make charts first-class artifacts.** Pushing a chart to `oci://` gives you the same authentication, RBAC, and retention policies that govern your container images — no separate chart repository infrastructure required.
- **`helm test` provides lightweight smoke testing.** Test hooks run after install or upgrade and give you fast feedback that the deployed application is reachable before a canary promotion or pipeline gate passes.
- **JSON Schema validation closes the feedback loop early.** Adding `values.schema.json` means misconfigured values are rejected at `helm install` time with a clear, actionable error — before any Kubernetes resource is created and before an operator has to read template source to find the problem.
