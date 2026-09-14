# Project 3: Stateful App with PVCs

**Level:** Intermediate
**Time Estimate:** 75 – 90 minutes
**Phase Prerequisite:** Phase 6 (Storage)

---

## Overview

This project walks you through deploying a production-style stateful application on Kubernetes using a **StatefulSet**, **PersistentVolumeClaims (PVCs)**, and a **headless Service**. You will deploy a three-replica MySQL cluster where each pod gets its own stable identity, its own dedicated storage volume, and a predictable DNS name — behaviours that are impossible to achieve with a standard Deployment.

```
                          ┌─────────────────────────────┐
                          │   Headless Service: mysql    │
                          │     clusterIP: None          │
                          │     port: 3306               │
                          └────────────┬────────────────-┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                         │
    ┌─────────▼────────┐   ┌──────────▼───────┐   ┌────────────▼─────┐
    │    mysql-0        │   │    mysql-1        │   │    mysql-2        │
    │  (StatefulSet)    │   │  (StatefulSet)    │   │  (StatefulSet)    │
    │  mysql:8.0        │   │  mysql:8.0        │   │  mysql:8.0        │
    └─────────┬────────┘   └──────────┬───────┘   └────────────┬─────┘
              │                        │                         │
    ┌─────────▼────────┐   ┌──────────▼───────┐   ┌────────────▼─────┐
    │ mysql-data-       │   │ mysql-data-       │   │ mysql-data-       │
    │   mysql-0 (PVC)   │   │   mysql-1 (PVC)   │   │   mysql-2 (PVC)   │
    │    1Gi RWO        │   │    1Gi RWO        │   │    1Gi RWO        │
    └──────────────────┘   └──────────────────┘   └──────────────────┘

        ▲                        ▲                        ▲
        │        Client Pods connect via stable DNS        │
        │   mysql-0.mysql.stateful-demo.svc.cluster.local  │
        │   mysql-1.mysql.stateful-demo.svc.cluster.local  │
        └──────────────────────────────────────────────────┘
```

Each pod (`mysql-0`, `mysql-1`, `mysql-2`) has a **sticky**, dedicated PVC. If a pod is deleted and rescheduled, Kubernetes re-attaches the same PVC — your data never moves.

---

## Prerequisites

- `kubectl` configured and pointing at a running cluster
- **minikube** (local) or a real cluster (EKS / GKE / AKS) with a default StorageClass
- Basic familiarity with Pods and Deployments
- **Phase 5 (Workloads)** complete — you should understand ReplicaSets and rolling updates before tackling StatefulSets

> **Verify your cluster is ready:**
> ```bash
> kubectl cluster-info
> kubectl get nodes
> kubectl get storageclass   # at least one StorageClass must exist
> ```

---

## What You'll Learn

By completing this project you will be able to:

1. **Explain the difference between StatefulSets and Deployments** — ordered creation/deletion, stable hostnames, sticky storage
2. **Create PersistentVolumeClaims automatically** using `volumeClaimTemplates` inside a StatefulSet spec
3. **Configure a headless Service** (`clusterIP: None`) to give each pod its own DNS A-record
4. **Mount per-pod storage** with `volumeMounts` wired to `volumeClaimTemplates`
5. **Verify data persistence** by deleting a pod and confirming its data survives on the re-attached PVC
6. **Use stable network identities** — connect to a specific replica by DNS name (`pod.service.namespace.svc.cluster.local`)
7. **Safely scale a StatefulSet** up and down while understanding the ordered teardown guarantees Kubernetes provides

---

## Project Structure

```
stateful-mysql/
├── namespace.yaml          # Isolates all resources in a dedicated namespace
├── secret.yaml             # Base64-encoded MySQL root password
├── service-headless.yaml   # Headless Service — clusterIP: None
└── statefulset.yaml        # StatefulSet with volumeClaimTemplates
```

---

## Step-by-Step Guide

### Step 1: Create the Namespace

Isolating workloads in their own namespace keeps your cluster tidy and makes RBAC, NetworkPolicies, and resource quotas easier to apply later.

```bash
kubectl create namespace stateful-demo --dry-run=client -o yaml > namespace.yaml
```

**`namespace.yaml`**

```yaml
# namespace.yaml
# Creates a dedicated namespace for this stateful MySQL project.
apiVersion: v1
kind: Namespace
metadata:
  name: stateful-demo
  labels:
    project: skillvault
    phase: "06-storage"
```

Apply it:

```bash
kubectl apply -f namespace.yaml
```

Verify:

```bash
kubectl get namespace stateful-demo
```

---

### Step 2: Create the MySQL Root Password Secret

Kubernetes Secrets store sensitive data as **base64-encoded** strings. Base64 is an encoding, not encryption — in production, back your Secrets with a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault, or Sealed Secrets).

Generate the base64 value for the password:

```bash
echo -n 'MyS3cretP@ss' | base64
# Output: TXlTM2NyZXRQQHNz
```

> The `-n` flag suppresses the trailing newline — always use it when encoding secrets, otherwise the newline becomes part of the value and your password will silently not match.

**`secret.yaml`**

```yaml
# secret.yaml
# Stores the MySQL root password as a base64-encoded Kubernetes Secret.
# The key "mysql-root-password" is referenced by the StatefulSet env var.
apiVersion: v1
kind: Secret
metadata:
  name: mysql-secret
  namespace: stateful-demo
  labels:
    app: mysql
    project: skillvault
type: Opaque
data:
  # echo -n 'MyS3cretP@ss' | base64
  mysql-root-password: TXlTM2NyZXRQQHNz
```

Apply it:

```bash
kubectl apply -f secret.yaml
```

Verify (the value will be base64-encoded in the output):

```bash
kubectl get secret mysql-secret -n stateful-demo -o jsonpath='{.data.mysql-root-password}' | base64 --decode
# Expected: MyS3cretP@ss
```

---

### Step 3: Create the Headless Service

A **headless Service** (`clusterIP: None`) does not get a virtual IP. Instead, DNS returns the individual IP addresses of every matching Pod. This is what gives each StatefulSet pod its own stable DNS record:

```
mysql-0.mysql.stateful-demo.svc.cluster.local  →  Pod IP of mysql-0
mysql-1.mysql.stateful-demo.svc.cluster.local  →  Pod IP of mysql-1
mysql-2.mysql.stateful-demo.svc.cluster.local  →  Pod IP of mysql-2
```

This lets clients — or MySQL replication agents — connect to a **specific replica by name**, which is impossible with a regular ClusterIP Service.

**`service-headless.yaml`**

```yaml
# service-headless.yaml
# Headless Service for the MySQL StatefulSet.
# clusterIP: None means Kubernetes will NOT allocate a virtual IP.
# DNS queries for "mysql" return individual Pod A-records instead.
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: stateful-demo
  labels:
    app: mysql
    project: skillvault
spec:
  # clusterIP: None is what makes this a headless Service.
  # Pods are directly reachable via their stable DNS names.
  clusterIP: None

  # publishNotReadyAddresses: true ensures DNS records are published
  # even before pods pass their readiness probe — useful during
  # cluster bootstrapping (e.g. Galera, MySQL Group Replication).
  publishNotReadyAddresses: true

  selector:
    app: mysql

  ports:
    - name: mysql
      port: 3306
      targetPort: 3306
      protocol: TCP
```

Apply it:

```bash
kubectl apply -f service-headless.yaml
```

Verify that `CLUSTER-IP` is `None`:

```bash
kubectl get service mysql -n stateful-demo
# NAME    TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)    AGE
# mysql   ClusterIP   None         <none>        3306/TCP   5s
```

---

### Step 4: Create the StatefulSet

The StatefulSet is the core of this project. Key differences from a Deployment:

| Feature | Deployment | StatefulSet |
|---|---|---|
| Pod names | Random suffix (`pod-xk2j9`) | Stable ordinal (`pod-0`, `pod-1`) |
| Creation order | Parallel | Sequential (0 → 1 → 2) |
| Deletion order | Parallel | Reverse sequential (2 → 1 → 0) |
| Storage | Shared or ephemeral | Per-pod PVC via `volumeClaimTemplates` |
| DNS | Single Service VIP | Per-pod A-record via headless Service |

**`statefulset.yaml`**

```yaml
# statefulset.yaml
# Three-replica MySQL StatefulSet.
# Each pod gets its own PVC (mysql-data-mysql-{0,1,2}) automatically
# provisioned by the cluster's default StorageClass.
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: stateful-demo
  labels:
    app: mysql
    project: skillvault
spec:
  # serviceName links this StatefulSet to the headless Service.
  # This is what enables the stable per-pod DNS names.
  serviceName: mysql

  replicas: 3

  # Pods are created and deleted one at a time, in order.
  # OrderedReady (default) waits for each pod to be Running+Ready
  # before moving to the next one.
  podManagementPolicy: OrderedReady

  selector:
    matchLabels:
      app: mysql

  template:
    metadata:
      labels:
        app: mysql
        project: skillvault
    spec:
      # Allow up to 30s for graceful shutdown — gives MySQL time to
      # flush buffers and release locks before SIGKILL.
      terminationGracePeriodSeconds: 30

      containers:
        - name: mysql
          image: mysql:8.0
          imagePullPolicy: IfNotPresent

          ports:
            - name: mysql
              containerPort: 3306
              protocol: TCP

          env:
            # Pull the root password from the Secret created in Step 2.
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: mysql-root-password

            # Optional: set the default character set for new databases.
            - name: MYSQL_ROOT_HOST
              value: "%"

          # ── Volume Mount ──────────────────────────────────────────
          # Mount the per-pod PVC at the standard MySQL data directory.
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql

          # ── Liveness Probe ────────────────────────────────────────
          # If mysqladmin ping fails, Kubernetes restarts the container.
          # initialDelaySeconds gives MySQL time to initialise on first boot.
          livenessProbe:
            exec:
              command:
                - mysqladmin
                - ping
                - -h
                - localhost
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # ── Readiness Probe ───────────────────────────────────────
          # Only routes traffic to this pod when it can actually execute
          # queries. Uses the root password from the env var.
          readinessProbe:
            exec:
              command:
                - bash
                - -c
                - |
                  mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" 2>/dev/null
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          # ── Resource Requests & Limits ────────────────────────────
          # Requests guarantee these resources on the node.
          # Limits cap usage — MySQL is killed/throttled if it exceeds them.
          resources:
            requests:
              cpu: 250m       # 0.25 vCPU guaranteed
              memory: 512Mi   # 512 MiB guaranteed
            limits:
              cpu: 500m       # 0.5 vCPU maximum
              memory: 1Gi     # 1 GiB maximum

  # ── volumeClaimTemplates ──────────────────────────────────────────
  # This is the StatefulSet superpower. Kubernetes automatically creates
  # one PVC per pod using this template:
  #   mysql-data-mysql-0
  #   mysql-data-mysql-1
  #   mysql-data-mysql-2
  # These PVCs are NOT deleted when the StatefulSet is deleted or scaled
  # down — data is preserved until you explicitly delete the PVCs.
  volumeClaimTemplates:
    - metadata:
        name: mysql-data
        labels:
          app: mysql
          project: skillvault
      spec:
        accessModes:
          # ReadWriteOnce: the volume can be mounted read-write by a
          # single node at a time. Correct for a per-pod MySQL data dir.
          - ReadWriteOnce
        resources:
          requests:
            storage: 1Gi
        # Omitting storageClassName uses the cluster's default StorageClass.
        # To use a specific class: storageClassName: standard
```

---

### Step 5: Apply All Manifests

Apply in order — namespace first, then dependents:

```bash
# 1. Namespace must exist before anything else
kubectl apply -f namespace.yaml

# 2. Secret (referenced by the StatefulSet env var)
kubectl apply -f secret.yaml

# 3. Headless Service (must exist before pods start so DNS resolves)
kubectl apply -f service-headless.yaml

# 4. StatefulSet (pods will start creating immediately)
kubectl apply -f statefulset.yaml
```

Or apply the whole directory at once (Kubernetes handles ordering via API):

```bash
kubectl apply -f stateful-mysql/
```

---

### Step 6: Verify the StatefulSet Rolls Out

StatefulSet pods start **sequentially** — `mysql-0` must be `Running` and `Ready` before `mysql-1` starts, and so on. Watch the rollout in real time:

```bash
# Check the StatefulSet summary
kubectl get statefulset -n stateful-demo
# NAME    READY   AGE
# mysql   3/3     2m

# Watch pod creation in real time (Ctrl-C when all are Running)
kubectl get pods -n stateful-demo -w
# NAME      READY   STATUS              RESTARTS   AGE
# mysql-0   0/1     ContainerCreating   0          10s
# mysql-0   1/1     Running             0          35s
# mysql-1   0/1     ContainerCreating   0          36s
# mysql-1   1/1     Running             0          62s
# mysql-2   0/1     ContainerCreating   0          63s
# mysql-2   1/1     Running             0          88s

# Verify PVCs were automatically created — one per pod
kubectl get pvc -n stateful-demo
```

Expected PVC output:

```
NAME                   STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
mysql-data-mysql-0     Bound    pvc-3f7a1b2c-...                           1Gi        RWO            standard       2m
mysql-data-mysql-1     Bound    pvc-7d9e4f1a-...                           1Gi        RWO            standard       90s
mysql-data-mysql-2     Bound    pvc-1c8b5e3d-...                           1Gi        RWO            standard       60s
```

All three PVCs should be in `Bound` status. If any are `Pending`, check that your cluster has a default StorageClass:

```bash
kubectl get storageclass
# Look for a row with "(default)" in the NAME column
```

---

### Step 7: Connect to MySQL and Create a Database

Use a temporary `mysql-client` pod to connect to `mysql-0` by its stable DNS name. The `--rm` flag ensures the pod is deleted automatically when you exit.

```bash
kubectl run mysql-client \
  --image=mysql:8.0 \
  -it --rm --restart=Never \
  -n stateful-demo \
  -- mysql \
    -h mysql-0.mysql.stateful-demo.svc.cluster.local \
    -u root \
    -pMyS3cretP@ss
```

You should see the MySQL prompt. Now create a database:

```sql
-- Create a test database to verify persistence in the next step
CREATE DATABASE skillvault;

-- Confirm it was created
SHOW DATABASES;
-- +--------------------+
-- | Database           |
-- +--------------------+
-- | information_schema |
-- | mysql              |
-- | performance_schema |
-- | skillvault         |
-- | sys                |
-- +--------------------+

-- Exit the client
EXIT;
```

> **DNS anatomy:** `mysql-0.mysql.stateful-demo.svc.cluster.local`
> - `mysql-0` — pod ordinal name
> - `mysql` — headless Service name
> - `stateful-demo` — namespace
> - `svc.cluster.local` — cluster DNS suffix

---

### Step 8: Test Data Persistence — Delete mysql-0 and Verify Data Survives

This is the key test. Delete `mysql-0` and watch Kubernetes recreate it and re-attach the **same PVC**.

```bash
# Delete the pod — Kubernetes will immediately recreate it
kubectl delete pod mysql-0 -n stateful-demo
# pod "mysql-0" deleted

# Watch the pod be recreated (takes ~30-40s for MySQL to initialise)
kubectl get pods -n stateful-demo -w
# NAME      READY   STATUS        RESTARTS   AGE
# mysql-0   1/1     Terminating   0          5m
# mysql-1   1/1     Running       0          4m
# mysql-2   1/1     Running       0          4m
# mysql-0   0/1     Pending       0          2s
# mysql-0   0/1     ContainerCreating 0      3s
# mysql-0   1/1     Running       0          38s
```

Once `mysql-0` is `Running` again, reconnect and check the database:

```bash
kubectl run mysql-client \
  --image=mysql:8.0 \
  -it --rm --restart=Never \
  -n stateful-demo \
  -- mysql \
    -h mysql-0.mysql.stateful-demo.svc.cluster.local \
    -u root \
    -pMyS3cretP@ss
```

```sql
SHOW DATABASES;
-- +--------------------+
-- | Database           |
-- +--------------------+
-- | information_schema |
-- | mysql              |
-- | performance_schema |
-- | skillvault         |   ← still here after pod deletion!
-- | sys                |
-- +--------------------+
EXIT;
```

Confirm the PVC is still bound and unchanged:

```bash
kubectl get pvc -n stateful-demo
# NAME                   STATUS   VOLUME                CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# mysql-data-mysql-0     Bound    pvc-3f7a1b2c-...      1Gi        RWO            standard       8m
# mysql-data-mysql-1     Bound    pvc-7d9e4f1a-...      1Gi        RWO            standard       7m
# mysql-data-mysql-2     Bound    pvc-1c8b5e3d-...      1Gi        RWO            standard       6m
```

The PVC `mysql-data-mysql-0` is the **same PVC** — same volume, same data, re-attached to the recreated pod.

---

### Step 9: Inspect Stable DNS Names

Run `nslookup` from inside a pod to observe how the headless Service returns individual pod IPs:

```bash
kubectl exec -it mysql-0 -n stateful-demo -- nslookup mysql.stateful-demo.svc.cluster.local
```

Expected output:

```
Server:         10.96.0.10
Address:        10.96.0.10#53

Name:   mysql.stateful-demo.svc.cluster.local
Address: 10.244.0.12    ← IP of mysql-0
Address: 10.244.0.13    ← IP of mysql-1
Address: 10.244.0.14    ← IP of mysql-2
```

Query a specific pod's DNS record:

```bash
kubectl exec -it mysql-0 -n stateful-demo -- nslookup mysql-1.mysql.stateful-demo.svc.cluster.local
# Returns only the IP of mysql-1
```

**Stable DNS pattern:**

```
<pod-name>.<service-name>.<namespace>.svc.cluster.local
     │            │            │
  mysql-0       mysql    stateful-demo
```

This pattern holds even if the pod is rescheduled to a different node — Kubernetes updates the DNS A-record to the new pod IP automatically, but the **DNS name never changes**.

---

### Step 10: Scale the StatefulSet

Scale down to a single replica. Pods are terminated in **reverse ordinal order** (mysql-2 first, then mysql-1):

```bash
kubectl scale statefulset mysql --replicas=1 -n stateful-demo
# statefulset.apps/mysql scaled

kubectl get pods -n stateful-demo
# NAME      READY   STATUS        RESTARTS   AGE
# mysql-0   1/1     Running       1          10m
# mysql-1   1/1     Terminating   0          9m
# mysql-2   0/1     Terminating   0          8m

# After a few seconds:
# NAME      READY   STATUS    RESTARTS   AGE
# mysql-0   1/1     Running   1          10m
```

Check what happened to the PVCs:

```bash
kubectl get pvc -n stateful-demo
# NAME                   STATUS   VOLUME                CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# mysql-data-mysql-0     Bound    pvc-3f7a1b2c-...      1Gi        RWO            standard       11m
# mysql-data-mysql-1     Bound    pvc-7d9e4f1a-...      1Gi        RWO            standard       10m
# mysql-data-mysql-2     Bound    pvc-1c8b5e3d-...      1Gi        RWO            standard       9m
```

> All three PVCs remain `Bound` even after scaling down. If you scale back up to 3, the **same PVCs** are re-attached to `mysql-1` and `mysql-2`. This is intentional — Kubernetes does not delete PVCs on scale-down to prevent accidental data loss.

Scale back up to restore all three replicas:

```bash
kubectl scale statefulset mysql --replicas=3 -n stateful-demo
kubectl get pods -n stateful-demo
```

---

## Verification

Use this checklist to confirm every component is working correctly before moving on:

| Check | Command | Expected Result |
|---|---|---|
| Namespace exists | `kubectl get namespace stateful-demo` | `STATUS: Active` |
| Secret exists | `kubectl get secret mysql-secret -n stateful-demo` | Secret listed with type `Opaque` |
| Headless Service has no ClusterIP | `kubectl get svc mysql -n stateful-demo` | `CLUSTER-IP: None` |
| All 3 PVCs are Bound | `kubectl get pvc -n stateful-demo` | 3 PVCs, all `STATUS: Bound` |
| All 3 pods are Running | `kubectl get pods -n stateful-demo` | `mysql-0`, `mysql-1`, `mysql-2` all `1/1 Running` |
| Database persists after pod delete | Delete `mysql-0`, reconnect, run `SHOW DATABASES;` | `skillvault` database still present |
| DNS resolution works | `kubectl exec -it mysql-0 -n stateful-demo -- nslookup mysql-1.mysql.stateful-demo.svc.cluster.local` | Returns a single Pod IP |

---

## Challenges

Completed the core project? Push further with these extension tasks:

### Challenge 1: Backup Sidecar with mysqldump

Add a second container to the StatefulSet pod that runs `mysqldump` on a schedule and writes the dump to a **separate** `emptyDir` volume (or a second PVC). This simulates a real-world backup sidecar pattern.

```yaml
# Add this sidecar container alongside the mysql container in the StatefulSet template.
# It runs mysqldump every 60 seconds and writes to /backups.
- name: backup-agent
  image: mysql:8.0
  env:
    - name: MYSQL_ROOT_PASSWORD
      valueFrom:
        secretKeyRef:
          name: mysql-secret
          key: mysql-root-password
  command:
    - bash
    - -c
    - |
      while true; do
        echo "[$(date)] Starting mysqldump..."
        mysqldump \
          -h 127.0.0.1 \
          -u root \
          -p"${MYSQL_ROOT_PASSWORD}" \
          --all-databases \
          > /backups/all-databases-$(date +%Y%m%d-%H%M%S).sql
        echo "[$(date)] Dump complete."
        sleep 60
      done
  volumeMounts:
    - name: backup-storage
      mountPath: /backups
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi
```

You will also need to add a corresponding `emptyDir` volume (ephemeral) or a second `volumeClaimTemplate` entry (persistent) for `backup-storage`.

### Challenge 2: Pod Disruption Budget (PDB)

A PodDisruptionBudget ensures that voluntary disruptions (node drains, cluster upgrades) never take the cluster below a safe minimum number of available replicas.

```yaml
# pdb.yaml
# Ensures at least 2 MySQL pods are available during voluntary disruptions
# such as kubectl drain (node maintenance) or cluster version upgrades.
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mysql-pdb
  namespace: stateful-demo
  labels:
    app: mysql
    project: skillvault
spec:
  # minAvailable: 2 means disruptions are only allowed when at least
  # 2 pods are healthy. With 3 replicas, only 1 pod can be disrupted
  # at a time. Kubernetes will block a node drain that would violate this.
  minAvailable: 2
  selector:
    matchLabels:
      app: mysql
```

Apply and test:

```bash
kubectl apply -f pdb.yaml
kubectl get pdb -n stateful-demo
# NAME        MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
# mysql-pdb   2               N/A               1                     5s
```

### Challenge 3: Custom MySQL Configuration via ConfigMap

Mount a `my.cnf` ConfigMap into the StatefulSet to tune MySQL's performance parameters without rebuilding the image.

```yaml
# configmap-mysql.yaml
# Custom MySQL server configuration.
# Mounted at /etc/mysql/conf.d/ — MySQL reads all *.cnf files from this dir.
apiVersion: v1
kind: ConfigMap
metadata:
  name: mysql-config
  namespace: stateful-demo
  labels:
    app: mysql
    project: skillvault
data:
  my.cnf: |
    [mysqld]
    # Use UTF-8 by default for all new schemas and tables
    character-set-server     = utf8mb4
    collation-server         = utf8mb4_unicode_ci

    # InnoDB buffer pool — cache for data and indexes.
    # Set to ~50-70% of available memory for dedicated DB servers.
    innodb_buffer_pool_size  = 256M

    # Number of InnoDB buffer pool instances — improves concurrency.
    innodb_buffer_pool_instances = 1

    # Binary logging is required for point-in-time recovery and replication.
    # Disable if you don't need either (saves disk I/O).
    # log_bin                = mysql-bin

    # Slow query log — log queries taking longer than 1 second.
    slow_query_log           = 1
    slow_query_log_file      = /var/lib/mysql/slow.log
    long_query_time          = 1

    # Maximum number of client connections.
    max_connections          = 100
```

Add to the StatefulSet spec:

```yaml
# Under spec.template.spec.volumes (add alongside volumeClaimTemplates):
volumes:
  - name: mysql-config-volume
    configMap:
      name: mysql-config

# Under spec.template.spec.containers[0].volumeMounts:
- name: mysql-config-volume
  mountPath: /etc/mysql/conf.d/
  readOnly: true
```

Verify the config is loaded:

```bash
kubectl exec -it mysql-0 -n stateful-demo -- mysql -u root -pMyS3cretP@ss \
  -e "SHOW VARIABLES LIKE 'character_set_server';"
# +--------------------+---------+
# | Variable_name      | Value   |
# +--------------------+---------+
# | character_set_server | utf8mb4 |
# +--------------------+---------+
```

---

## Key Takeaways

- **StatefulSets deploy pods in strict ordinal order** (`0 → 1 → 2`) and delete them in reverse (`2 → 1 → 0`). Each pod waits for the previous to be `Running` and `Ready` before the next starts — this is critical for databases that require a primary to exist before replicas can join.

- **PVCs created by `volumeClaimTemplates` are sticky** — they are permanently bound to their ordinal pod. When `mysql-0` is deleted and recreated on any node in the cluster, Kubernetes finds and re-attaches `mysql-data-mysql-0`. The pod name never changes, so the storage never changes.

- **Headless Services give each pod a stable, individual DNS A-record.** Unlike a regular ClusterIP Service (which load-balances across pods), a headless Service lets clients target a specific replica by name — essential for databases where reads and writes must go to specific nodes.

- **Data is NOT lost when pods are deleted or the cluster scales down.** PVCs outlive their pods. This is the fundamental difference between stateful and stateless workloads — you must explicitly delete PVCs when you want to discard data.

- **StatefulSets are not a complete database solution** — they provide the infrastructure primitives (stable identity, ordered rollout, persistent storage). Actual database clustering, replication, and failover logic must be handled by the application itself (e.g. MySQL Group Replication, Galera Cluster) or by an operator (e.g. Vitess, Percona Operator).

- **Pod Disruption Budgets protect stateful workloads during maintenance.** Always pair a PDB with production StatefulSets to prevent cluster operations (node drains, upgrades) from inadvertently taking down too many replicas simultaneously.

---

*SkillVault — Kubernetes Master Course | Phase 6: Storage*
