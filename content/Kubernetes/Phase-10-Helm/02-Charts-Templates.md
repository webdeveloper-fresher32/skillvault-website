# Helm Charts & Templates — Complete Guide

## Table of Contents
1. [Chart Directory Structure](#1-chart-directory-structure)
2. [Chart.yaml](#2-chartyaml)
3. [values.yaml Deep Dive](#3-valuesyaml-deep-dive)
4. [Template Syntax Basics](#4-template-syntax-basics)
5. [Built-in Objects](#5-built-in-objects)
6. [Template Functions & Pipelines](#6-template-functions--pipelines)
7. [Named Templates (_helpers.tpl)](#7-named-templates-_helperstpl)
8. [Flow Control (if/range/with)](#8-flow-control-ifrangewith)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Chart Directory Structure

A Helm chart is a directory with a specific layout. Helm expects this structure:

```
mychart/
├── Chart.yaml              ← Chart metadata (name, version, description)
├── values.yaml             ← Default configuration values
├── values.schema.json      ← (optional) JSON Schema to validate values
├── templates/              ← Kubernetes manifests as Go templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   ├── NOTES.txt           ← Post-install instructions (also a template)
│   └── _helpers.tpl        ← Named templates / partials (not rendered directly)
├── charts/                 ← Dependency charts (sub-charts) unpacked here
└── .helmignore             ← Files to exclude when packaging (like .gitignore)
```

**Key rules about the `templates/` directory:**
- Files beginning with `_` (like `_helpers.tpl`) are **not** rendered as Kubernetes manifests — they hold named templates that other files can call.
- `NOTES.txt` is rendered and printed to the user after a successful install or upgrade. It is a template, not a static file.
- All `.yaml` and `.yml` files (except `_` prefixed) are rendered and applied.
- Files in subdirectories of `templates/` are also rendered.

```bash
# Scaffold a new chart with the default directory structure
helm create mychart

# Package a chart directory into a .tgz archive
helm package mychart
# Produces: mychart-0.1.0.tgz

# Lint a chart for errors
helm lint mychart
```

---

## 2. Chart.yaml

`Chart.yaml` contains metadata about the chart. Helm 3 uses `apiVersion: v2`.

```yaml
# Chart.yaml — full example with all common fields
apiVersion: v2                     # v2 for Helm 3; v1 for Helm 2 compatibility

name: mychart                      # Chart name (matches directory name)
version: 1.4.2                     # Chart version — semantic versioning (SemVer 2)
appVersion: "2.0.1"                # Version of the application inside the chart
                                   # (informational only — not used by Helm for logic)

description: A Helm chart for deploying MyApp on Kubernetes

type: application                  # application (default) or library
                                   # library charts contain only named templates
                                   # and cannot be installed directly

keywords:
  - myapp
  - web
  - api

home: https://github.com/example/myapp
sources:
  - https://github.com/example/myapp

maintainers:
  - name: Jane Smith
    email: jane@example.com

icon: https://example.com/myapp-icon.png

annotations:
  category: "Web"

dependencies:
  - name: postgresql
    version: "13.2.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled     # Only install if this value is true
    alias: db                         # Refer to this dependency as "db"
  - name: redis
    version: "18.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
```

**Versioning rules:**
- `version` uses SemVer 2 (`MAJOR.MINOR.PATCH`). Increment PATCH for bug fixes, MINOR for new features, MAJOR for breaking changes.
- `appVersion` is a string — it can be any format (e.g., `"2.0.1"`, `"stable"`, `"sha-a1b2c3d"`). Quote it to prevent YAML from interpreting it as a number.

---

## 3. values.yaml Deep Dive

`values.yaml` is the interface between a chart and its users. Well-structured values files with clear comments make a chart self-documenting.

```yaml
# values.yaml — a realistic, well-structured example

# Number of pod replicas
replicaCount: 1

image:
  repository: ghcr.io/myorg/myapp  # Container image registry and name
  tag: ""                           # Defaults to Chart.appVersion if empty
  pullPolicy: IfNotPresent

imagePullSecrets: []
# - name: my-registry-secret

nameOverride: ""       # Overrides the chart name in generated resource names
fullnameOverride: ""   # Overrides the full name (release-name + chart-name)

serviceAccount:
  create: true
  annotations: {}
  name: ""             # If empty, a name is auto-generated

podAnnotations: {}
podLabels: {}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: "nginx"
  annotations: {}
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

livenessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

env: []
# - name: LOG_LEVEL
#   value: info
# - name: DB_PASSWORD
#   valueFrom:
#     secretKeyRef:
#       name: my-secret
#       key: password

nodeSelector: {}
tolerations: []
affinity: {}
```

**Accessing nested values in templates:**

```yaml
# In a template file, access values with .Values.<path>
image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
replicas: {{ .Values.replicaCount }}
type: {{ .Values.service.type }}
```

---

## 4. Template Syntax Basics

Helm templates use Go's `text/template` package with Sprig functions added. Template actions are wrapped in `{{ }}`.

```yaml
# templates/deployment.yaml — basic template example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-myapp          # Use release name for uniqueness
  namespace: {{ .Release.Namespace }}
  labels:
    app: {{ .Chart.Name }}
    version: {{ .Chart.AppVersion }}
    release: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
      release: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
        release: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
```

**Whitespace control:**

By default, `{{ }}` preserves surrounding whitespace and newlines. Use `-` to trim whitespace.

```yaml
# Without trimming — adds blank lines
{{- if .Values.ingress.enabled }}    ← trims whitespace BEFORE the action
ingress content
{{ end -}}                           ← trims whitespace AFTER the action

# {{- trims leading whitespace/newline
# -}} trims trailing whitespace/newline
# Use both: {{- action -}} to trim both sides
```

**Comments in templates:**

```yaml
{{/* This is a template comment — it will NOT appear in rendered output */}}
# This is a YAML comment — it WILL appear in rendered output
```

**Quoting strings safely:**

```yaml
# Always quote string values that come from .Values to handle special characters
image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default "latest" }}"

# Use the quote function for values embedded in YAML string context
annotations:
  version: {{ .Chart.AppVersion | quote }}
```

---

## 5. Built-in Objects

Helm injects several top-level objects into every template. These are the most important:

**`.Values`** — all values from `values.yaml`, merged with user overrides.

```yaml
{{ .Values.replicaCount }}
{{ .Values.image.repository }}
{{ .Values.service.type }}
```

**`.Release`** — information about the current release.

```yaml
{{ .Release.Name }}         # Release name (e.g., my-nginx)
{{ .Release.Namespace }}    # Namespace the release is installed into
{{ .Release.IsInstall }}    # true on first install (bool)
{{ .Release.IsUpgrade }}    # true on upgrade or rollback (bool)
{{ .Release.Revision }}     # Current revision number (int)
{{ .Release.Service }}      # Always "Helm"
```

**`.Chart`** — values from `Chart.yaml`.

```yaml
{{ .Chart.Name }}           # Chart name
{{ .Chart.Version }}        # Chart version
{{ .Chart.AppVersion }}     # appVersion field
{{ .Chart.Description }}    # description field
```

**`.Files`** — access non-template files in the chart.

```yaml
# Read a file from the chart directory (not from templates/)
{{ .Files.Get "config/app.conf" }}

# Use in a ConfigMap
data:
  app.conf: |
    {{ .Files.Get "config/app.conf" | nindent 4 }}
```

**`.Capabilities`** — information about the Kubernetes cluster.

```yaml
# Check cluster version for conditional features
{{ .Capabilities.KubeVersion.Minor }}    # e.g., "28"

# Check if a given API is available
{{ if .Capabilities.APIVersions.Has "networking.k8s.io/v1" }}
```

**`.Template`** — information about the current template file.

```yaml
{{ .Template.Name }}     # e.g., mychart/templates/deployment.yaml
{{ .Template.BasePath }} # e.g., mychart/templates
```

---

## 6. Template Functions & Pipelines

Helm includes the full [Sprig](http://masterminds.github.io/sprig/) function library plus a few Helm-specific functions.

**Common functions:**

```yaml
# default — use a fallback value if the input is empty
{{ .Values.image.tag | default "latest" }}
{{ default "nginx" .Values.image.repository }}

# required — fail rendering with a message if value is empty
{{ required "image.repository is required" .Values.image.repository }}

# quote — wrap value in double quotes (safe for YAML string context)
{{ .Values.config.logLevel | quote }}           # "info"

# upper / lower — change case
{{ .Chart.Name | upper }}                       # MYCHART

# trim / trimAll — remove whitespace or specific characters
{{ "  hello  " | trim }}                        # hello

# toYaml — convert a Go value to a YAML string
{{ .Values.resources | toYaml }}

# nindent — indent a multi-line string by N spaces (adds leading newline)
{{ .Values.resources | toYaml | nindent 12 }}

# indent — indent by N spaces (no leading newline)
{{ .Values.resources | toYaml | indent 12 }}

# b64enc / b64dec — base64 encode/decode
{{ .Values.secret | b64enc }}

# sha256sum — hash a value
{{ .Values.config | toYaml | sha256sum }}

# trunc — truncate a string
{{ .Release.Name | trunc 63 | trimSuffix "-" }}

# replace — string replacement
{{ .Values.name | replace "." "-" }}

# len — length of a string or list
{{ len .Values.env }}

# int — convert to integer
{{ .Values.replicaCount | int }}

# printf — format string
{{ printf "%s-%s" .Release.Name .Chart.Name }}
```

**Pipelines** chain functions left to right, passing the result of each as the last argument of the next:

```yaml
# Without pipeline
{{ quote (default "latest" .Values.image.tag) }}

# With pipeline (reads left to right — more readable)
{{ .Values.image.tag | default "latest" | quote }}

# Multi-step pipeline
{{ .Values.appName | lower | replace " " "-" | trunc 63 | trimSuffix "-" | quote }}

# Embedding toYaml with nindent (the standard pattern for nested YAML blocks)
resources:
  {{- toYaml .Values.resources | nindent 2 }}

# Or equivalently
resources:
  {{- .Values.resources | toYaml | nindent 2 }}
```

**The `toYaml + nindent` pattern** is used everywhere for multi-line values:

```yaml
# In values.yaml:
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

# In deployment.yaml template:
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
# Rendered output:
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
```

---

## 7. Named Templates (_helpers.tpl)

Named templates (also called partials) are reusable template fragments defined in `_helpers.tpl`. The `_` prefix tells Helm not to render the file directly. Use `define` to declare and `include` to use them.

```yaml
{{/* _helpers.tpl — shared named templates */}}

{{/*
Expand the name of the chart.
*/}}
{{- define "mychart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncate to 63 characters because Kubernetes DNS name limits.
*/}}
{{- define "mychart.fullname" -}}
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
Common labels applied to all resources.
*/}}
{{- define "mychart.labels" -}}
helm.sh/chart: {{ include "mychart.chart" . }}
{{ include "mychart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels (used in matchLabels — must be stable across upgrades).
*/}}
{{- define "mychart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mychart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart name and version as used by the chart label.
*/}}
{{- define "mychart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
ServiceAccount name — use override, auto-generated name, or default.
*/}}
{{- define "mychart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "mychart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

**Using named templates with `include`:**

```yaml
# In deployment.yaml — call named templates with include
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "mychart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "mychart.selectorLabels" . | nindent 8 }}
```

**`include` vs `template`:**
- `template "name" .` — renders the named template but **cannot** be used in a pipeline.
- `include "name" .` — renders the named template and **returns a string** that can be piped to `nindent`, `quote`, etc. Always prefer `include`.

---

## 8. Flow Control (if/range/with)

### if / else

```yaml
# Conditional block — only render if .Values.ingress.enabled is truthy
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "mychart.fullname" . }}
{{- end }}

# if / else
{{- if eq .Values.service.type "LoadBalancer" }}
  # Load balancer specific config
{{- else if eq .Values.service.type "NodePort" }}
  # NodePort specific config
{{- else }}
  # ClusterIP default
{{- end }}

# Negate with not
{{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
{{- end }}

# Combine conditions with and / or
{{- if and .Values.ingress.enabled .Values.ingress.tls }}
  # TLS ingress config
{{- end }}
```

**Falsy values in Go templates:** `false`, `0`, `nil`, empty string `""`, empty list `[]`, empty map `{}` — all evaluate as false.

### range

```yaml
# Iterate over a list
env:
{{- range .Values.env }}
  - name: {{ .name }}
    value: {{ .value | quote }}
{{- end }}

# Iterate over a map (key, value)
podAnnotations:
{{- range $key, $value := .Values.podAnnotations }}
  {{ $key }}: {{ $value | quote }}
{{- end }}

# Range over a static list
{{- range $port := list 80 443 8080 }}
  - port: {{ $port }}
{{- end }}

# Range with index
{{- range $index, $host := .Values.ingress.hosts }}
  - host: {{ $host.host }}
{{- end }}
```

### with

`with` changes the scope (`.`) to the given value and only executes the block if the value is truthy. Useful for optional nested blocks.

```yaml
# Without with — must fully qualify every access
{{- if .Values.podAnnotations }}
annotations:
  {{- range $k, $v := .Values.podAnnotations }}
  {{ $k }}: {{ $v | quote }}
  {{- end }}
{{- end }}

# With with — cleaner, . becomes .Values.podAnnotations inside the block
{{- with .Values.podAnnotations }}
annotations:
  {{- toYaml . | nindent 2 }}
{{- end }}

# Another common use: nodeSelector
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}

# To access parent scope inside a with block, use $
{{- with .Values.ingress }}
  name: {{ $.Release.Name }}-ingress     # $ refers to root scope
  host: {{ .hosts | first }}             # . is now .Values.ingress
{{- end }}
```

### Variables

```yaml
# Assign a variable with :=
{{- $name := include "mychart.fullname" . }}
{{- $labels := include "mychart.labels" . }}

# Variables survive scope changes (useful inside range/with)
{{- $root := . }}
{{- with .Values.ingress }}
  releaseName: {{ $root.Release.Name }}   # Access root via variable
  host: {{ .hosts | first }}
{{- end }}
```

**Debugging rendered templates:**

```bash
# Render all templates to stdout without applying to cluster
helm template myrelease ./mychart

# Render with value overrides
helm template myrelease ./mychart --set replicaCount=3

# Render only one specific template file
helm template myrelease ./mychart -s templates/deployment.yaml

# Render and show which line causes errors
helm template myrelease ./mychart --debug

# Lint the chart for syntax and structural errors
helm lint ./mychart

# Lint with a custom values file
helm lint ./mychart --values custom-values.yaml
```

---

## 9. Hands-On Exercises

**Exercise 1:** Run `helm create myapp` to scaffold a new chart. Open `templates/deployment.yaml` and identify every instance of `include "myapp.*"`. Trace each named template back to `_helpers.tpl` and understand what each one renders. Then run `helm template myrelease ./myapp` and match each block in the rendered output to its source template. Finally, run `helm lint ./myapp` to confirm the scaffolded chart has no errors.

**Exercise 2:** Edit `values.yaml` in your `myapp` chart to add a new top-level key `config` with two sub-keys: `logLevel: "info"` and `maxConnections: 100`. Then add a `ConfigMap` template at `templates/configmap.yaml` that creates a ConfigMap named `{{ include "myapp.fullname" . }}-config` with these two values as data keys. Use `{{ .Values.config.logLevel | quote }}` and `{{ .Values.config.maxConnections | int | quote }}` in the template. Verify with `helm template myrelease ./myapp -s templates/configmap.yaml`.

**Exercise 3:** Add flow control to your `deployment.yaml`. Wrap the `replicas` field in an `{{- if not .Values.autoscaling.enabled }}` / `{{- end }}` block so that the replicas count is only set when autoscaling is disabled (HPA manages replicas otherwise). Add a `range` block to the container's `env:` section that iterates over `.Values.env`. Test by running `helm template` with `--set autoscaling.enabled=true` (replicas line should vanish) and with `--set env[0].name=FOO,env[0].value=bar` (env var should appear).

**Exercise 4:** Add a `with` block to `deployment.yaml` for `nodeSelector`, `tolerations`, and `affinity`. Each block should only render if the corresponding value is non-empty. Test with `helm template myrelease ./myapp --set 'nodeSelector.disktype=ssd'` and confirm the rendered Deployment includes the `nodeSelector` section. Also confirm that when no nodeSelector is set (default empty map), the section does not appear in the rendered output.

**Exercise 5:** Create a named template `myapp.envFrom` in `_helpers.tpl` that renders an `envFrom` block for a ConfigMap ref using the full release name. Call this named template from `deployment.yaml` using `include "myapp.envFrom" . | nindent 10`. Add a values key `envFromConfig.enabled: false` and wrap the named template call in an `if` block. Test the full rendering with `--set envFromConfig.enabled=true` to confirm the `envFrom` block appears, and without the flag to confirm it is absent. Use `helm lint` to verify no errors.

---

## 10. Interview Q&A

**Q: What is the purpose of `_helpers.tpl` and why does the filename start with an underscore?**
Answer: `_helpers.tpl` is where named templates (reusable template fragments) are defined using `{{- define "name" -}}`. The underscore prefix is a Helm convention that signals the file should not be rendered as a Kubernetes manifest — Helm skips files starting with `_` during rendering. Without the underscore, Helm would try to send the file's contents to the Kubernetes API as a manifest and fail. Any file name starting with `_` inside `templates/` is treated as a library of named templates. You can have multiple such files (e.g., `_helpers.tpl`, `_utils.tpl`) for organisation.

**Q: What is the difference between `include` and `template` in Helm?**
Answer: Both call a named template, but `include` returns the result as a string value that can be used in a pipeline, while `template` renders the named template in place but returns nothing (its return value cannot be piped). In practice, always use `include` because the rendered output from named templates almost always needs to be piped through `nindent` to fix indentation. For example, `{{- include "mychart.labels" . | nindent 4 }}` is the standard pattern — `template "mychart.labels" .` cannot be indented this way. The `template` action is essentially obsolete in Helm charts and exists only for backwards compatibility.

**Q: Why does the `replicas` field need to be wrapped in an `if not autoscaling.enabled` block?**
Answer: When a HorizontalPodAutoscaler (HPA) is managing a Deployment, the HPA continuously sets the `spec.replicas` field on the Deployment to match the current scaled count. If Helm's upgrade also writes a `replicas` value during the upgrade, Helm will reset the replica count to the value in `values.yaml`, fighting the HPA. By omitting the `replicas` field entirely when autoscaling is enabled, Helm leaves the field under HPA control. This is a well-known gotcha: without this guard, a `helm upgrade` will reset pod count to 1 mid-day and override the HPA's scaling decision.

**Q: What is the `toYaml | nindent` pattern and why is it used so widely?**
Answer: `toYaml` converts a Go value (a map, list, or scalar from `.Values`) back into a YAML string. `nindent N` prepends a newline and indents every line of the string by N spaces. Together, they let you embed multi-line YAML blocks (like `resources`, `nodeSelector`, `affinity`, or `env` lists) at the correct indentation level without manually replicating the structure in the template. The alternative — writing out the entire nested structure with template actions on every line — would be verbose and fragile. The pattern `{{- toYaml .Values.resources | nindent 10 }}` is idiomatic Helm and appears in virtually every production chart.

**Q: What is the difference between `values.yaml` in the chart directory and a values file passed with `--values`?**
Answer: `values.yaml` inside the chart directory contains the **default** values — the baseline configuration that works out of the box. It defines every key the chart supports and provides sensible defaults. A values file passed with `--values custom.yaml` (or `--values prod.yaml`) contains **overrides** for a specific deployment context. Helm deep-merges the files: keys in the custom file replace corresponding keys in the default `values.yaml`, and keys not mentioned in the custom file retain their defaults. This means a `prod-values.yaml` file only needs to list the values that differ from the defaults, keeping environment-specific files small and focused. Multiple `--values` flags are allowed; later files override earlier ones.

---
