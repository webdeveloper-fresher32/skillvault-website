# Volumes — Complete Guide

## Table of Contents
1. [What is a Kubernetes Volume?](#1-what-is-a-kubernetes-volume)
2. [emptyDir — Ephemeral Shared Storage](#2-emptydir--ephemeral-shared-storage)
3. [hostPath — Node Filesystem Access](#3-hostpath--node-filesystem-access)
4. [configMap as a Volume](#4-configmap-as-a-volume)
5. [secret as a Volume](#5-secret-as-a-volume)
6. [projected — Combining Multiple Sources](#6-projected--combining-multiple-sources)
7. [downwardAPI — Pod Metadata as Files](#7-downwardapi--pod-metadata-as-files)
8. [Volume Types Overview and When to Use Each](#8-volume-types-overview-and-when-to-use-each)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a Kubernetes Volume?

A container's filesystem is ephemeral by default — when the container restarts, all writes to the container layer are lost. A **Volume** is a directory that is mounted into one or more containers in a Pod. Volumes persist across container restarts within the same Pod (but not necessarily across Pod restarts, depending on the volume type).

Key characteristics of Kubernetes Volumes:
- Volumes are defined at the **Pod level** (in `spec.volumes`)
- Containers mount them via `spec.containers[].volumeMounts`
- Volume lifetime is tied to the Pod unless the backing storage is external (PV)
- Multiple containers in the same Pod can share the same volume (init container pattern)

```
Pod
├── spec.volumes[]              ← defines available volumes
│       ├── name: shared-data
│       │   type: emptyDir
│       └── name: config-vol
│           type: configMap
└── spec.containers[]
        ├── container: app
        │   └── volumeMounts:
        │       ├── /data   ← mounts shared-data
        │       └── /etc/config  ← mounts config-vol
        └── container: sidecar
            └── volumeMounts:
                └── /data   ← also mounts shared-data (shared!)
```

---

## 2. emptyDir — Ephemeral Shared Storage

`emptyDir` creates an empty directory when the Pod is scheduled on a node. It is deleted when the Pod is removed. It survives container crashes and restarts within the Pod.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-demo
spec:
  volumes:
    - name: scratch-space
      emptyDir: {}             # backed by node disk (tmpfs option below)

  containers:
    - name: writer
      image: busybox
      command: ["sh", "-c", "echo hello > /data/output.txt && sleep 3600"]
      volumeMounts:
        - name: scratch-space
          mountPath: /data

    - name: reader
      image: busybox
      command: ["sh", "-c", "cat /data/output.txt && sleep 3600"]
      volumeMounts:
        - name: scratch-space
          mountPath: /data      # same volume, shared between containers
```

### emptyDir with tmpfs (in-memory)

```yaml
volumes:
  - name: cache
    emptyDir:
      medium: Memory       # backed by RAM (tmpfs), never written to disk
      sizeLimit: 512Mi     # caps memory usage
```

### Use Cases for emptyDir

- Sharing files between a main container and a sidecar (logging, proxies)
- Init containers that download or prepare data for the main container
- Temporary scratch space for processing (e.g., image conversion, compilation)
- Caching data that can be regenerated if lost

```
Init container writes → /data/app-code → Main container reads /data/app-code
(Both mount the same emptyDir volume)
```

---

## 3. hostPath — Node Filesystem Access

`hostPath` mounts a directory or file from the node's filesystem into the Pod. The data persists on the node even when the Pod is deleted, but it is tied to a specific node — if the Pod is rescheduled to a different node, it sees a different (or empty) hostPath directory.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-demo
spec:
  volumes:
    - name: node-logs
      hostPath:
        path: /var/log/myapp     # must exist on the node (or be created)
        type: DirectoryOrCreate  # create if it doesn't exist

  containers:
    - name: log-reader
      image: busybox
      command: ["tail", "-f", "/host-logs/app.log"]
      volumeMounts:
        - name: node-logs
          mountPath: /host-logs
```

### hostPath Types

| Type | Behavior |
|------|---------|
| `""` (empty) | No check — use the path as-is |
| `DirectoryOrCreate` | Create directory if it doesn't exist |
| `Directory` | Path must already exist and be a directory |
| `FileOrCreate` | Create empty file if it doesn't exist |
| `File` | Path must already exist and be a file |
| `Socket` | Path must exist and be a UNIX socket |
| `CharDevice` | Path must be a character device |
| `BlockDevice` | Path must be a block device |

### Security Warning

`hostPath` is powerful but dangerous:
- A container with `hostPath: /` has access to the entire node filesystem
- Combined with a privileged container, this can lead to a full node compromise
- Avoid hostPath for arbitrary user workloads; restrict it with PodSecurity admission or OPA/Kyverno policies

```bash
# Common legitimate uses:
# - DaemonSets that need to access node logs (/var/log)
# - DaemonSets that need to access node metrics (/sys, /proc)
# - Container runtimes that need /var/lib/docker
# - Node-level monitoring agents (Prometheus node exporter, Datadog agent)
```

---

## 4. configMap as a Volume

ConfigMaps can be mounted as directories, where each key becomes a file and the value is the file content. This is ideal for config files that are too large or complex for environment variables.

```yaml
# First, create the ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.properties: |
    server.port=8080
    server.timeout=30
    log.level=INFO
  nginx.conf: |
    server {
        listen 80;
        location / {
            proxy_pass http://localhost:8080;
        }
    }
```

```yaml
# Mount it as a volume
apiVersion: v1
kind: Pod
metadata:
  name: configmap-volume-demo
spec:
  volumes:
    - name: config-files
      configMap:
        name: app-config          # name of the ConfigMap

  containers:
    - name: app
      image: my-app:latest
      volumeMounts:
        - name: config-files
          mountPath: /etc/app/    # each CM key becomes a file here
          readOnly: true          # recommended — app should not modify config
```

```
Result:
  /etc/app/app.properties  ← content of app.properties key
  /etc/app/nginx.conf      ← content of nginx.conf key
```

### Mounting a Specific Key to a Specific Path

```yaml
volumes:
  - name: config-files
    configMap:
      name: app-config
      items:
        - key: nginx.conf          # only mount this key
          path: nginx.conf         # mount it here (relative to mountPath)
          mode: 0444               # file permission (octal)
```

### ConfigMap Updates

When a ConfigMap is updated, the mounted files are automatically updated (with a ~1 minute delay due to kubelet sync). Environment variable references do NOT update — a Pod restart is required. Use mounted ConfigMaps for dynamic config that the app can reload (e.g., with inotify or a SIGHUP handler).

---

## 5. secret as a Volume

Secrets work exactly like ConfigMaps as volumes, but the data is stored base64-encoded in etcd (and optionally encrypted at rest). Secrets mounted as volumes are stored in `tmpfs` on the node — they are never written to the node's disk.

```yaml
# Create a TLS secret
kubectl create secret tls my-tls-cert \
  --cert=tls.crt \
  --key=tls.key

# Or create a generic secret
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=supersecret
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-demo
spec:
  volumes:
    - name: tls-certs
      secret:
        secretName: my-tls-cert
        defaultMode: 0400         # restrict read permissions

    - name: db-creds
      secret:
        secretName: db-credentials
        items:
          - key: username
            path: db/username
          - key: password
            path: db/password
            mode: 0400

  containers:
    - name: app
      image: my-app:latest
      volumeMounts:
        - name: tls-certs
          mountPath: /etc/ssl/certs
          readOnly: true
        - name: db-creds
          mountPath: /etc/secrets
          readOnly: true
```

```
/etc/ssl/certs/tls.crt  ← certificate file
/etc/ssl/certs/tls.key  ← private key (permission 0400)
/etc/secrets/db/username
/etc/secrets/db/password
```

---

## 6. projected — Combining Multiple Sources

A `projected` volume combines multiple volume sources (configMap, secret, serviceAccountToken, downwardAPI) into a single directory mount.

```yaml
volumes:
  - name: all-in-one
    projected:
      defaultMode: 0444
      sources:
        - configMap:
            name: app-config
            items:
              - key: app.properties
                path: config/app.properties
        - secret:
            name: db-credentials
            items:
              - key: password
                path: secrets/db-password
                mode: 0400
        - serviceAccountToken:
            path: token
            expirationSeconds: 3600    # short-lived token rotation
            audience: my-api-server
        - downwardAPI:
            items:
              - path: pod-name
                fieldRef:
                  fieldPath: metadata.name
```

```
/projected/
  config/app.properties
  secrets/db-password
  token
  pod-name
```

Projected volumes simplify Pod specs when many sources need to appear in the same directory.

---

## 7. downwardAPI — Pod Metadata as Files

The Downward API exposes information about the Pod and cluster to the running container. This avoids the need to query the Kubernetes API from within the container.

```yaml
volumes:
  - name: pod-info
    downwardAPI:
      items:
        - path: pod-name
          fieldRef:
            fieldPath: metadata.name
        - path: pod-namespace
          fieldRef:
            fieldPath: metadata.namespace
        - path: pod-ip
          fieldRef:
            fieldPath: status.podIP
        - path: node-name
          fieldRef:
            fieldPath: spec.nodeName
        - path: labels
          fieldRef:
            fieldPath: metadata.labels
        - path: cpu-request
          resourceFieldRef:
            containerName: app
            resource: requests.cpu
            divisor: 1m            # express as millicores
        - path: memory-limit
          resourceFieldRef:
            containerName: app
            resource: limits.memory
            divisor: 1Mi           # express as MiB
```

```yaml
containers:
  - name: app
    image: my-app
    volumeMounts:
      - name: pod-info
        mountPath: /etc/podinfo
    resources:
      requests:
        cpu: 250m
        memory: 64Mi
      limits:
        memory: 128Mi
```

```bash
# Inside the container
cat /etc/podinfo/pod-name        # my-pod-abc123
cat /etc/podinfo/pod-namespace   # production
cat /etc/podinfo/pod-ip          # 10.0.1.5
cat /etc/podinfo/cpu-request     # 250
cat /etc/podinfo/memory-limit    # 128
```

downwardAPI volumes are also used by logging sidecars and monitoring agents that need to tag metrics/logs with the Pod name, namespace, or node.

---

## 8. Volume Types Overview and When to Use Each

| Volume Type | Persistence | Shared Across Pods | Use Case |
|------------|-------------|-------------------|---------|
| `emptyDir` | Pod lifetime | No (within Pod only) | Sidecar file sharing, scratch space, init data |
| `hostPath` | Node lifetime | No (node-specific) | Node monitoring agents, DaemonSets |
| `configMap` | External (K8s object) | Yes (read-only) | Application config files |
| `secret` | External (K8s object) | Yes (read-only) | TLS certs, passwords, API keys |
| `projected` | External (multiple) | Yes (read-only) | Combine multiple sources into one mount |
| `downwardAPI` | N/A (live metadata) | No | Pod identity, resource info to container |
| `persistentVolumeClaim` | External (storage system) | Depends on access mode | Databases, stateful apps needing durability |
| `nfs` | External (NFS server) | Yes (ReadWriteMany) | Shared file storage across Pods |
| `csi` | External (CSI driver) | Depends on driver | Cloud volumes, object storage, advanced storage |

```
Choosing the right volume:

Need to survive Pod deletion?
  No  → emptyDir (or tmpfs for in-memory)
  Yes → PersistentVolumeClaim (see Phase 06-02)

Need to share across multiple Pods simultaneously?
  No  → emptyDir or PVC with ReadWriteOnce
  Yes → PVC with ReadWriteMany (NFS, CephFS, etc.)

Injecting configuration?
  Small values   → env vars from ConfigMap/Secret
  Files/multi-line → ConfigMap or Secret as volume

Accessing node-level resources?
  → hostPath (use sparingly, restrict with policy)

Exposing Pod identity/resources to app?
  → downwardAPI volume
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create a Pod with two containers (`writer` and `reader`) that share an emptyDir volume. The writer container should write a timestamp to `/shared/timestamp` every 5 seconds using a shell loop. The reader container should continuously `tail -f /shared/timestamp`. Verify both containers see the same file using `kubectl logs`. Then kill the writer container (exec a `kill 1`) and observe that the reader container keeps running and the volume data is preserved.

**Exercise 2:** Create a ConfigMap with a multi-line nginx.conf content. Create a Pod running nginx that mounts the ConfigMap as a volume at `/etc/nginx/conf.d/`. Verify nginx loads the config by exec-ing into the Pod and running `nginx -t`. Then update the ConfigMap (change a setting), wait 60 seconds, and observe the mounted file automatically updating with `cat /etc/nginx/conf.d/custom.conf`. Note that nginx does NOT hot-reload automatically — you would need to send SIGHUP.

**Exercise 3:** Create a TLS secret from self-signed certificates (use `openssl req -x509` to generate them). Mount the secret into an nginx Pod at `/etc/ssl/certs/`. Configure nginx to serve HTTPS using the mounted certificate files. Exec into the Pod and verify the cert files exist with correct permissions (0400 for the key). Try to write to the mount path and confirm it is read-only.

**Exercise 4:** Create a Pod with a downwardAPI volume that exposes `metadata.name`, `metadata.namespace`, `status.podIP`, and the container's `requests.memory` as separate files. After the Pod starts, exec in and cat each file to confirm the values match what `kubectl describe pod` shows. This simulates how monitoring agents like Datadog or Prometheus node exporters identify themselves.

**Exercise 5:** Create a projected volume that combines a ConfigMap, a Secret, and a downwardAPI source into the same mount directory. Verify all three sources are accessible under their configured paths. Then create a second Pod mounting the same ConfigMap and Secret (different downwardAPI values) and confirm that the shared ConfigMap/Secret files have identical content while the downwardAPI files differ (each Pod reports its own name).

---

## 10. Interview Q&A

**Q: What is the difference between an emptyDir volume and a PersistentVolumeClaim?**
Answer: An `emptyDir` volume is created fresh when a Pod starts on a node and is deleted permanently when the Pod is removed — it cannot outlive the Pod. It is backed by the node's disk (or RAM with `medium: Memory`) and is local to the node. A PersistentVolumeClaim (PVC) requests storage from an external storage system (cloud disk, NFS, Ceph). PVC data survives Pod deletion, can be reattached to a new Pod (even on a different node, depending on the access mode), and is managed independently of any individual Pod's lifecycle. Use emptyDir for temporary scratch space and sharing between sidecar containers; use PVCs for any data that must survive a Pod restart.

**Q: Why are Secrets mounted as volumes stored in tmpfs and why does this matter?**
Answer: When Kubernetes mounts a Secret as a volume, it uses a tmpfs (in-memory) filesystem on the node rather than the node's disk. This means Secret data is never written to persistent storage on the node, reducing the risk of sensitive data being recoverable from disk forensics or node snapshots. If the node restarts, the tmpfs is lost and Kubernetes re-mounts the Secret from etcd when the Pod is rescheduled. This is a security advantage over writing secrets to disk. Note that etcd itself should also be encrypted at rest (via `EncryptionConfiguration`) so secrets are not readable from etcd backups.

**Q: What is the downwardAPI and when would you use it?**
Answer: The Downward API is a mechanism that exposes information about the Pod itself (its name, namespace, labels, annotations, IP, resource limits) to the container without requiring the container to query the Kubernetes API server. It can be consumed as environment variables or as volume-mounted files. You would use it when an application needs to know its own Pod name (for logging or metric labeling), its namespace (for multi-tenant apps), its resource limits (for tuning thread pools or JVM heap based on the container's memory limit), or its labels (for dynamic configuration). It is commonly used by logging agents, monitoring sidecars, and distributed systems that need stable identity information.

**Q: What is a projected volume and what problem does it solve?**
Answer: A projected volume combines multiple volume sources — ConfigMap, Secret, serviceAccountToken, and downwardAPI — into a single directory mount point in the container. Without projected volumes, each source requires a separate `volumeMounts` entry and a separate mount path in the container. Projected volumes let you consolidate related config (e.g., a config file, a TLS cert, and the service account token) into one directory, which simplifies mount management and reduces the number of `volumeMounts` entries in the container spec. They are particularly useful when all the data logically belongs to the same part of the application's config directory.

**Q: When should you use hostPath and what are the security risks?**
Answer: Use `hostPath` only when a workload genuinely needs access to node-level resources — the most common legitimate cases are DaemonSets running node monitoring agents (e.g., Prometheus node exporter reading `/proc` and `/sys`), log collection agents reading `/var/log`, and container runtimes. The security risks are significant: a container with a broad `hostPath` mount (such as `/` or `/etc`) can read and write the node's filesystem, potentially extracting credentials, modifying system files, or escaping the container. Combined with a privileged container, it can fully compromise the node. Restrict `hostPath` usage with PodSecurity admission (`restricted` profile disallows hostPath), OPA Gatekeeper, or Kyverno policies.
