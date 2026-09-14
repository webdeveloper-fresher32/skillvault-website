# ConfigMaps — Complete Guide

## Table of Contents
1. [What is a ConfigMap](#1-what-is-a-configmap)
2. [Creating ConfigMaps](#2-creating-configmaps)
3. [Using ConfigMaps as Environment Variables](#3-using-configmaps-as-environment-variables)
4. [Using ConfigMaps as Volume Mounts](#4-using-configmaps-as-volume-mounts)
5. [Updating ConfigMaps](#5-updating-configmaps)
6. [Immutable ConfigMaps](#6-immutable-configmaps)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a ConfigMap

A **ConfigMap** is a Kubernetes API object used to store non-confidential configuration data as key-value pairs. ConfigMaps decouple configuration from container images, allowing you to change application behaviour without rebuilding images.

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
│                                                             │
│  ┌─────────────┐        ┌──────────────────────────────┐   │
│  │  ConfigMap  │        │           Pod                │   │
│  │             │        │  ┌────────────────────────┐  │   │
│  │ key: value  │───────▶│  │      Container         │  │   │
│  │ key: value  │        │  │  ENV: key=value        │  │   │
│  │ key: value  │        │  │  /etc/config/key=value │  │   │
│  └─────────────┘        │  └────────────────────────┘  │   │
│                         └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

ConfigMaps can store:
- Simple key-value pairs (e.g., `LOG_LEVEL=debug`)
- Configuration file contents (e.g., `nginx.conf`, `app.properties`)
- Multi-line strings and JSON blobs

**What ConfigMaps are NOT for:** storing passwords, tokens, or certificates — use Secrets for those.

---

## 2. Creating ConfigMaps

### From Literals

```bash
# Create a ConfigMap with literal key-value pairs
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=debug \
  --from-literal=APP_ENV=production \
  --from-literal=MAX_CONNECTIONS=100

# Verify the ConfigMap
kubectl get configmap app-config -o yaml
```

### From a File

```bash
# Create a file first
cat > app.properties << EOF
database.host=postgres.default.svc.cluster.local
database.port=5432
database.name=myapp
EOF

# Create ConfigMap from file
kubectl create configmap app-config --from-file=app.properties

# The key is the filename, value is the file contents
kubectl get configmap app-config -o yaml
```

### From a Directory

```bash
# Create multiple config files
mkdir configs/
echo "debug" > configs/log-level
echo "postgres:5432" > configs/db-host
echo "3000" > configs/port

# Create ConfigMap from entire directory
kubectl create configmap app-config --from-file=configs/

# Each file becomes a key (filename = key, file contents = value)
kubectl describe configmap app-config
```

### From a YAML Manifest

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
  labels:
    app: myapp
data:
  # Simple key-value pairs
  LOG_LEVEL: "debug"
  APP_ENV: "production"
  MAX_CONNECTIONS: "100"
  # Multi-line configuration file
  nginx.conf: |
    server {
      listen 80;
      server_name myapp.example.com;
      location / {
        proxy_pass http://localhost:8080;
      }
    }
  app.properties: |
    database.host=postgres.default.svc.cluster.local
    database.port=5432
    database.name=myapp
```

```bash
# Apply the manifest
kubectl apply -f configmap.yaml

# List all ConfigMaps
kubectl get configmaps

# Describe a ConfigMap
kubectl describe configmap app-config

# View raw YAML
kubectl get configmap app-config -o yaml
```

---

## 3. Using ConfigMaps as Environment Variables

### envFrom — Load All Keys as Environment Variables

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
        name: app-config   # All keys become env vars
```

### valueFrom — Load a Specific Key

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
    - name: LOG_LEVEL           # Name of the env var in the container
      valueFrom:
        configMapKeyRef:
          name: app-config      # ConfigMap name
          key: LOG_LEVEL        # Key inside the ConfigMap
    - name: DATABASE_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: database.host
          optional: true        # Pod starts even if key is missing
```

```
ConfigMap: app-config              Pod: myapp-pod
┌──────────────────────┐          ┌────────────────────────────┐
│ LOG_LEVEL=debug      │─────────▶│ ENV LOG_LEVEL=debug        │
│ APP_ENV=production   │─────────▶│ ENV APP_ENV=production     │
│ MAX_CONNECTIONS=100  │─────────▶│ ENV MAX_CONNECTIONS=100    │
└──────────────────────┘          └────────────────────────────┘
         envFrom: configMapRef (loads ALL keys)
```

### Verify Environment Variables

```bash
# Check env vars inside a running pod
kubectl exec myapp-pod -- env | grep LOG_LEVEL
# LOG_LEVEL=debug

kubectl exec myapp-pod -- printenv APP_ENV
# production
```

---

## 4. Using ConfigMaps as Volume Mounts

When you mount a ConfigMap as a volume, each key becomes a file inside the mount path.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  volumes:
  - name: config-volume
    configMap:
      name: app-config          # Reference the ConfigMap
      items:                    # Optional: select specific keys
      - key: nginx.conf
        path: nginx.conf        # Filename inside the container
      - key: app.properties
        path: app.properties
  containers:
  - name: myapp
    image: nginx:latest
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config    # Directory inside the container
      readOnly: true
```

```
ConfigMap: app-config              Pod filesystem
┌──────────────────────┐          ┌─────────────────────────────┐
│ nginx.conf: |        │          │ /etc/config/                │
│   server {           │─────────▶│   nginx.conf                │
│     listen 80;       │          │   app.properties            │
│   }                  │          │                             │
│ app.properties: |    │          │ Each key → one file         │
│   db.host=postgres   │          │ Value → file contents       │
└──────────────────────┘          └─────────────────────────────┘
```

```bash
# Verify the mounted files
kubectl exec myapp-pod -- ls /etc/config
# app.properties  nginx.conf

kubectl exec myapp-pod -- cat /etc/config/nginx.conf
```

### Setting File Permissions

```yaml
volumes:
- name: config-volume
  configMap:
    name: app-config
    defaultMode: 0644           # Octal permissions for all files
    items:
    - key: app.properties
      path: app.properties
      mode: 0600                # Override for a specific file
```

---

## 5. Updating ConfigMaps

```bash
# Edit a ConfigMap in-place
kubectl edit configmap app-config

# Patch a specific field
kubectl patch configmap app-config \
  --patch '{"data":{"LOG_LEVEL":"info"}}'

# Replace entire ConfigMap from file
kubectl apply -f updated-configmap.yaml
```

**Important behaviour:**
- ConfigMaps mounted as **volumes** are updated automatically (with a short delay, typically 60 seconds based on kubelet sync period).
- ConfigMaps used as **environment variables** are NOT updated — the pod must be restarted to pick up changes.

```bash
# Trigger a rolling restart to pick up ConfigMap changes
kubectl rollout restart deployment myapp-deployment

# Watch the rollout
kubectl rollout status deployment myapp-deployment
```

---

## 6. Immutable ConfigMaps

Setting `immutable: true` prevents any changes to the ConfigMap's data. This improves cluster performance (the API server stops watching the object) and prevents accidental configuration changes in production.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
  labels:
    version: "2"
data:
  LOG_LEVEL: "info"
  APP_ENV: "production"
immutable: true                 # Cannot be changed after creation
```

```bash
# Attempting to edit an immutable ConfigMap fails
kubectl edit configmap app-config-v2
# Error: configmaps "app-config-v2" is immutable

# To "update" an immutable ConfigMap:
# 1. Create a new ConfigMap with a new name (e.g., app-config-v3)
# 2. Update pod specs to reference the new ConfigMap
# 3. Delete the old ConfigMap
kubectl delete configmap app-config-v2
```

---

## 7. Hands-On Exercises

**Exercise 1:** Create a ConfigMap named `webapp-config` with the following literal values: `PORT=8080`, `DEBUG=false`, `CACHE_TTL=300`. Verify the ConfigMap was created, then create a pod that loads all keys as environment variables using `envFrom` and confirm the values are present inside the container.

**Exercise 2:** Create a local file called `database.conf` containing connection settings (host, port, database name, pool size). Create a ConfigMap from this file, then mount it as a volume at `/etc/database` inside an nginx pod. Exec into the pod to confirm the file is visible with the correct contents.

**Exercise 3:** Create a ConfigMap with two keys: `app.env` and `logging.conf`. Each should contain multi-line content defined using the `|` block scalar in YAML. Mount only the `logging.conf` key into a pod at `/etc/logging/logging.conf` and verify the file permissions are `0640`.

**Exercise 4:** Create a Deployment with 2 replicas that reads `LOG_LEVEL` from a ConfigMap using `valueFrom`. Update the ConfigMap to change `LOG_LEVEL` from `debug` to `warn`. Observe that the running pods do NOT automatically see the change, then trigger a rolling restart and confirm the updated value is reflected.

**Exercise 5:** Create an immutable ConfigMap with a versioned name (e.g., `api-config-v1`). Attempt to modify it and observe the error. Then create `api-config-v2` with updated values, update a Deployment to reference the new ConfigMap, apply the change, and delete the old ConfigMap.

---

## 8. Interview Q&A

**Q: What is a ConfigMap and why should you use it instead of hardcoding values in a container image?**
Answer: A ConfigMap is a Kubernetes object that stores non-sensitive configuration as key-value pairs, decoupled from the container image. Using ConfigMaps means the same image can run in development, staging, and production with different configurations — you change the ConfigMap, not the image. This supports the 12-factor app methodology of strict separation between code and config.

**Q: What is the difference between using a ConfigMap as an environment variable vs a volume mount?**
Answer: Environment variables are loaded once at pod startup and never updated without a pod restart. Volume-mounted ConfigMaps are periodically refreshed by the kubelet (typically within 60 seconds of a change), making them suitable for applications that can reload configuration at runtime by watching the filesystem. Volume mounts also allow you to deliver whole configuration files with specific filenames and permissions, whereas env vars are flat key-value pairs.

**Q: How do you update a ConfigMap and ensure running pods see the change?**
Answer: You can update a ConfigMap using `kubectl edit`, `kubectl patch`, or `kubectl apply`. Pods using the ConfigMap as a volume mount will receive the update within the kubelet sync period (default 60 seconds) without a restart. Pods using the ConfigMap as environment variables must be restarted — typically via `kubectl rollout restart deployment <name>` — to receive the updated values.

**Q: What are immutable ConfigMaps and when should you use them?**
Answer: An immutable ConfigMap has `immutable: true` set and cannot have its data modified after creation. You should use them in production environments where accidental config changes could cause outages. They also reduce API server load because the kubelet stops watching immutable objects for changes. To "update" an immutable ConfigMap, you create a new one with a different name and update your pod specs to reference it.

**Q: What is the maximum size of a ConfigMap and what should you do if your configuration exceeds it?**
Answer: A ConfigMap has a maximum size of 1 MiB. If your configuration data exceeds this limit, you should consider splitting the data across multiple ConfigMaps, storing large files in a persistent volume or object storage (e.g., S3, GCS), or using a dedicated configuration management tool like Consul or etcd directly. For very large datasets that pods need at runtime, mounting a PersistentVolumeClaim is the appropriate approach.
