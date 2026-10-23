# Environment Variables — Complete Guide

## Table of Contents
1. [Environment Variables in Kubernetes](#1-environment-variables-in-kubernetes)
2. [Direct env Definition](#2-direct-env-definition)
3. [envFrom — Bulk Loading](#3-envfrom--bulk-loading)
4. [valueFrom — Selective Loading](#4-valuefrom--selective-loading)
5. [The Downward API](#5-the-downward-api)
6. [Precedence and Override Rules](#6-precedence-and-override-rules)
7. [Best Practices](#7-best-practices)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Environment Variables in Kubernetes

Environment variables are the primary way to inject runtime configuration into containers. Kubernetes supports several methods for defining environment variables, ranging from simple hardcoded values to dynamic values sourced from ConfigMaps, Secrets, and pod metadata.

```
Environment Variable Sources
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌────────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │   Hardcoded    │   │  ConfigMap   │   │     Secret       │  │
│  │   env value    │   │  (envFrom /  │   │   (envFrom /     │  │
│  │                │   │   valueFrom) │   │    valueFrom)    │  │
│  └───────┬────────┘   └──────┬───────┘   └────────┬─────────┘  │
│          │                  │                     │            │
│          └──────────────────┼─────────────────────┘            │
│                             ▼                                  │
│  ┌─────────────────────────────────────────┐                   │
│  │  ┌──────────────────────────────────┐   │                   │
│  │  │          Container               │   │                   │
│  │  │  ENV VAR_A=value                 │   │                   │
│  │  │  ENV VAR_B=from-configmap        │   │                   │
│  │  │  ENV VAR_C=from-secret           │   │                   │
│  │  │  ENV POD_NAME=mypod-xyz          │   │   (Downward API)  │
│  │  └──────────────────────────────────┘   │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Direct env Definition

The simplest form — hardcoded values defined directly in the pod spec. Suitable for static values that are the same across all environments.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    env:
    - name: APP_NAME
      value: "MyApplication"
    - name: LOG_LEVEL
      value: "info"
    - name: MAX_RETRIES
      value: "3"
    - name: FEATURE_FLAG_X
      value: "true"
```

**Limitations of hardcoded values:**
- The same values apply to every environment unless you use separate manifests or Helm templates
- Sensitive values (passwords, API keys) must never be hardcoded — use Secrets
- Changes require a pod restart

---

## 3. envFrom — Bulk Loading

`envFrom` loads all key-value pairs from a ConfigMap or Secret as environment variables. Each key in the ConfigMap/Secret becomes an environment variable name.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    envFrom:
    - configMapRef:
        name: app-config          # Load ALL keys from ConfigMap
        optional: false           # Fail if ConfigMap doesn't exist
    - secretRef:
        name: app-secrets         # Load ALL keys from Secret
        optional: true            # Start even if Secret is missing
    - configMapRef:
        name: feature-flags       # Load from a second ConfigMap
      prefix: FEATURE_            # Prepend prefix to all keys
```

```
ConfigMap: app-config            Pod Environment Variables
┌───────────────────────┐        ┌────────────────────────────────┐
│ LOG_LEVEL=debug       │───────▶│ LOG_LEVEL=debug                │
│ APP_ENV=staging       │───────▶│ APP_ENV=staging                │
│ PORT=8080             │───────▶│ PORT=8080                      │
└───────────────────────┘        │                                │
                                 │                                │
ConfigMap: feature-flags         │ (with prefix: FEATURE_)        │
┌───────────────────────┐        ├────────────────────────────────┤
│ DARK_MODE=true        │───────▶│ FEATURE_DARK_MODE=true         │
│ NEW_UI=false          │───────▶│ FEATURE_NEW_UI=false           │
└───────────────────────┘        └────────────────────────────────┘
```

**Caveats of envFrom:**
- ConfigMap keys must be valid environment variable names (alphanumeric and `_` only)
- Invalid keys are silently skipped with a warning event
- All keys from a Secret are loaded — this can accidentally expose more than intended

---

## 4. valueFrom — Selective Loading

`valueFrom` lets you load a single specific key from a ConfigMap, Secret, or pod metadata. This is more explicit and reduces the risk of accidentally exposing values.

### configMapKeyRef

```yaml
env:
- name: LOG_LEVEL
  valueFrom:
    configMapKeyRef:
      name: app-config            # ConfigMap name
      key: LOG_LEVEL              # Specific key to read
      optional: true              # Don't fail if key is absent
```

### secretKeyRef

```yaml
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-credentials        # Secret name
      key: password               # Specific key to read
      optional: false             # Pod must have this secret
```

### fieldRef — Pod Metadata

```yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name    # Pod name
- name: POD_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: POD_UID
  valueFrom:
    fieldRef:
      fieldPath: metadata.uid
```

### resourceFieldRef — Resource Limits

```yaml
env:
- name: CPU_REQUEST
  valueFrom:
    resourceFieldRef:
      containerName: myapp        # Target container
      resource: requests.cpu      # Resource field
- name: MEMORY_LIMIT
  valueFrom:
    resourceFieldRef:
      containerName: myapp
      resource: limits.memory
      divisor: 1Mi                # Express in MiB
```

---

## 5. The Downward API

The **Downward API** allows pods to consume information about themselves without calling the Kubernetes API server. Information is exposed either as environment variables (`fieldRef`, `resourceFieldRef`) or as files via a volume mount.

```
Downward API
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Kubernetes metadata          Pod / Container can read:    │
│  ┌──────────────────────┐     ┌────────────────────────┐  │
│  │ metadata.name        │────▶│ ENV: POD_NAME          │  │
│  │ metadata.namespace   │────▶│ ENV: NAMESPACE         │  │
│  │ metadata.labels      │────▶│ /etc/podinfo/labels    │  │
│  │ metadata.annotations │────▶│ /etc/podinfo/annots    │  │
│  │ status.podIP         │────▶│ ENV: POD_IP            │  │
│  │ spec.nodeName        │────▶│ ENV: NODE_NAME         │  │
│  │ requests.cpu         │────▶│ ENV: CPU_REQUEST       │  │
│  │ limits.memory        │────▶│ ENV: MEMORY_LIMIT      │  │
│  └──────────────────────┘     └────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Downward API as Volume Mount

For labels and annotations (which can be updated at runtime), use volume mounts:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
    version: "1.0"
spec:
  volumes:
  - name: podinfo
    downwardAPI:                  # Special volume type
      items:
      - path: labels             # File: /etc/podinfo/labels
        fieldRef:
          fieldPath: metadata.labels
      - path: annotations       # File: /etc/podinfo/annotations
        fieldRef:
          fieldPath: metadata.annotations
      - path: cpu_limit
        resourceFieldRef:
          containerName: myapp
          resource: limits.cpu
  containers:
  - name: myapp
    image: myapp:1.0
    volumeMounts:
    - name: podinfo
      mountPath: /etc/podinfo
```

```bash
# Check the downward API files
kubectl exec myapp-pod -- cat /etc/podinfo/labels
# app="myapp"
# version="1.0"

kubectl exec myapp-pod -- cat /etc/podinfo/annotations
```

---

## 6. Precedence and Override Rules

When multiple sources define the same environment variable, the following precedence applies:

```
Precedence (highest to lowest):
┌─────────────────────────────────────────────────────────────┐
│  1. env[].value (hardcoded in pod spec)           HIGHEST   │
│  2. env[].valueFrom (ConfigMap/Secret key ref)             │
│  3. envFrom (bulk load, processed top to bottom)           │
│  4. Container image ENV instructions (Dockerfile)  LOWEST  │
└─────────────────────────────────────────────────────────────┘
```

```yaml
# Example: demonstrating precedence
spec:
  containers:
  - name: myapp
    image: myapp:1.0            # Dockerfile: ENV LOG_LEVEL=info
    envFrom:
    - configMapRef:
        name: app-config        # ConfigMap: LOG_LEVEL=debug
    env:
    - name: LOG_LEVEL
      value: "warn"             # Hardcoded: LOG_LEVEL=warn (WINS)
# Result: LOG_LEVEL=warn
```

**Key rules:**
- A later `envFrom` entry does NOT override an earlier one — the first definition wins
- A specific `env` entry always overrides a conflicting `envFrom` entry
- Values from a `valueFrom` in the `env` list take precedence over matching keys from `envFrom`

---

## 7. Best Practices

```
Best Practices for Environment Variables
┌─────────────────────────────────────────────────────────────┐
│  DO                          DO NOT                         │
│  ✓ Use ConfigMaps for        ✗ Hardcode secrets in env      │
│    non-sensitive config        or Dockerfile                │
│  ✓ Use Secrets for           ✗ Use envFrom for secrets      │
│    sensitive values            (loads more than needed)     │
│  ✓ Use valueFrom for         ✗ Log env vars in application  │
│    explicit references         (secrets leak)               │
│  ✓ Set optional: true for    ✗ Use base64 and think it is   │
│    non-critical config         encrypted                    │
│  ✓ Use Downward API for      ✗ Store large config in env    │
│    pod metadata                vars (use volumes instead)   │
└─────────────────────────────────────────────────────────────┘
```

```bash
# Use resource limits — always set them for predictable env vars
kubectl describe pod myapp-pod | grep -A 5 "Limits"

# Inspect all environment variables in a running container
kubectl exec myapp-pod -- env | sort

# Check which ConfigMaps/Secrets a pod references
kubectl describe pod myapp-pod | grep -A 20 "Environment"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a ConfigMap named `app-env` with five keys: `APP_NAME`, `LOG_LEVEL`, `PORT`, `DEBUG`, and `TIMEZONE`. Create a pod that uses `envFrom` to load all keys and also hardcodes `LOG_LEVEL=error` in the `env` section. Exec into the pod, run `printenv | sort`, and verify that `LOG_LEVEL` is `error` (demonstrating that the explicit `env` value wins over `envFrom`).

**Exercise 2:** Create a pod that uses `valueFrom.fieldRef` to expose the following pod metadata as environment variables: `POD_NAME`, `POD_NAMESPACE`, `POD_IP`, and `NODE_NAME`. Create the pod and exec into it to run `env | grep POD_` and `env | grep NODE_`. Verify each value matches what `kubectl get pod -o wide` reports.

**Exercise 3:** Create a Deployment with resource `requests` and `limits` set for CPU and memory. Add environment variables using `resourceFieldRef` to expose `requests.cpu` as `CPU_REQUEST` and `limits.memory` as `MEMORY_LIMIT` (with divisor `1Mi`). Exec into a pod and verify that the values are present and match the resource specification.

**Exercise 4:** Create a pod with a downward API volume that exposes `metadata.labels` and `metadata.annotations` as files at `/etc/podinfo/labels` and `/etc/podinfo/annotations`. Add two labels and one annotation to the pod. Exec into the pod and cat both files to verify the content. Then add a new annotation using `kubectl annotate` and observe that the file in the volume updates automatically.

**Exercise 5:** Create a ConfigMap with a key `DATABASE_URL` containing a connection string, and a Secret with a key `DATABASE_PASSWORD`. Create a pod that loads `DATABASE_URL` via `configMapKeyRef` and `DATABASE_PASSWORD` via `secretKeyRef`. Additionally, use `envFrom` to load a second ConfigMap. Add a prefix `APP_` to the `envFrom` load. Exec into the pod and verify all variables are set with the correct names and values.

---

## 9. Interview Q&A

**Q: What is the difference between env, envFrom, and valueFrom in a Kubernetes pod spec?**
Answer: `env` is a list of environment variable definitions in the pod spec. Each item can have a hardcoded `value` or a `valueFrom` that references a specific key in a ConfigMap, Secret, pod metadata (fieldRef), or resource limits (resourceFieldRef). `envFrom` bulk-loads all key-value pairs from an entire ConfigMap or Secret as environment variables, optionally with a key prefix. `valueFrom` is a property of an individual `env` entry that specifies where to source the value from — it is not used with `envFrom`.

**Q: What is the Kubernetes Downward API?**
Answer: The Downward API is a mechanism that allows pods to introspect information about themselves without calling the Kubernetes API server. It exposes pod metadata (name, namespace, labels, annotations, UID), status (pod IP, host IP), and resource information (CPU/memory requests and limits) either as environment variables (via `fieldRef` and `resourceFieldRef` in the `env` section) or as files in a `downwardAPI` volume. It is useful for injecting pod identity into applications, for log correlation, or for applications that need to know their own resource constraints.

**Q: When would you use a downwardAPI volume instead of fieldRef environment variables?**
Answer: Labels and annotations can be updated at runtime (e.g., with `kubectl label` or `kubectl annotate`) after the pod starts. If you expose them as environment variables via `fieldRef`, the container does not see the updates — environment variables are fixed at startup. If you expose them via a `downwardAPI` volume, Kubernetes updates the files when the labels or annotations change, allowing the application to read the current values. For static fields like `metadata.name` or `metadata.namespace`, either approach works.

**Q: If an environment variable is defined in both envFrom (ConfigMap) and directly in the env list, which value takes precedence?**
Answer: The value defined in the `env` list takes precedence over a matching key from `envFrom`. Kubernetes processes `envFrom` first (setting variables from the ConfigMap or Secret), then processes the `env` list — explicit entries in `env` overwrite any conflicting values loaded by `envFrom`. Additionally, if multiple `envFrom` sources define the same key, the first source wins (later sources do not override earlier ones for duplicate keys).

**Q: What happens if you reference a ConfigMap or Secret key that does not exist, and how can you handle optional references?**
Answer: By default, if a `valueFrom.configMapKeyRef` or `valueFrom.secretKeyRef` references a non-existent ConfigMap, Secret, or key, the pod fails to start and remains in a `Pending` state with an event message indicating the missing resource. You can set `optional: true` on the reference — in that case, if the ConfigMap, Secret, or specific key is absent, the environment variable is simply not set and the pod starts normally. This is useful for optional feature flags or configuration that may not exist in all environments.
