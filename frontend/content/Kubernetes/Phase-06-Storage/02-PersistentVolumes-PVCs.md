# PersistentVolumes and PersistentVolumeClaims — Complete Guide

## Table of Contents
1. [PV vs PVC vs StorageClass](#1-pv-vs-pvc-vs-storageclass)
2. [PersistentVolume Spec](#2-persistentvolume-spec)
3. [Access Modes](#3-access-modes)
4. [Reclaim Policies](#4-reclaim-policies)
5. [PV Lifecycle](#5-pv-lifecycle)
6. [PersistentVolumeClaim Spec](#6-persistentvolumeclaim-spec)
7. [Binding — How PVCs Find PVs](#7-binding--how-pvcs-find-pvs)
8. [Dynamic Provisioning](#8-dynamic-provisioning)
9. [Using PVCs in Pods](#9-using-pvcs-in-pods)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. PV vs PVC vs StorageClass

Kubernetes separates storage provisioning from storage consumption using three abstractions:

| Resource | Who creates it | What it represents |
|---------|---------------|-------------------|
| **StorageClass** | Cluster admin | A category/type of storage with a provisioner (e.g., fast SSD, standard HDD) |
| **PersistentVolume (PV)** | Admin (static) or provisioner (dynamic) | An actual unit of storage — a real disk or volume |
| **PersistentVolumeClaim (PVC)** | Developer / application | A request for storage (size, access mode, class) |

```
StorageClass → dynamic provisioning → PV → Bound to PVC → Mounted in Pod

Static provisioning:
  Admin creates PV manually → Developer creates PVC → Kubernetes binds them

Dynamic provisioning:
  Developer creates PVC → StorageClass provisioner creates PV automatically → Bound
```

```
Kubernetes Storage Architecture:

Developer                   Cluster Admin
    │                           │
    │  Creates PVC               │  Creates StorageClass
    ▼                           ▼
  PVC ────────────────────── StorageClass
    │  (requests 10Gi SSD)      │  (knows how to talk to AWS EBS)
    │                           │
    └──── triggers ──────────── PV provisioning
                                │
                      AWS EBS API call
                                │
                         EBS volume created
                                │
                          PV object created
                                │
                    PVC ←─── Bound ──── PV
                                │
                           Mounted into Pod
```

---

## 2. PersistentVolume Spec

A PV is a cluster-scoped resource (not namespaced). It represents a piece of storage provisioned by an admin or a dynamic provisioner.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv-001
  labels:
    type: ssd
    region: us-east-1
spec:
  capacity:
    storage: 50Gi                  # total size of this volume

  accessModes:
    - ReadWriteOnce                # can be mounted RW by one node at a time

  persistentVolumeReclaimPolicy: Retain   # what happens when PVC is deleted

  storageClassName: fast-ssd       # optional: associates with a StorageClass

  volumeMode: Filesystem           # Filesystem (default) | Block

  # Mount options (filesystem-specific)
  mountOptions:
    - hard
    - nfsvers=4.1

  # The actual backing storage — choose one:

  # NFS:
  nfs:
    path: /mnt/data
    server: 192.168.1.100

  # AWS EBS (static provisioning):
  awsElasticBlockStore:
    volumeID: vol-0a1234567890abcdef
    fsType: ext4

  # hostPath (for local development / single-node):
  hostPath:
    path: /mnt/data
    type: DirectoryOrCreate

  # Local volume (node-affinity required):
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - node-1
```

---

## 3. Access Modes

Access modes define how the volume can be mounted across nodes. The storage backend must support the requested mode.

| Mode | Abbreviation | Meaning |
|------|-------------|---------|
| `ReadWriteOnce` | RWO | Mounted read-write by a single node |
| `ReadOnlyMany` | ROX | Mounted read-only by many nodes simultaneously |
| `ReadWriteMany` | RWX | Mounted read-write by many nodes simultaneously |
| `ReadWriteOncePod` | RWOP | Mounted read-write by a single Pod (K8s 1.22+) |

```
RWO (ReadWriteOnce):
  Node 1 (Pod A) ── read/write ──▶ Volume
  Node 2 (Pod B) ──   BLOCKED  ──▶ Volume

ROX (ReadOnlyMany):
  Node 1 (Pod A) ── read-only  ──▶ Volume
  Node 2 (Pod B) ── read-only  ──▶ Volume  (all allowed)
  Node 3 (Pod C) ──   write    ──▶ Volume  BLOCKED

RWX (ReadWriteMany):
  Node 1 (Pod A) ── read/write ──▶ Volume
  Node 2 (Pod B) ── read/write ──▶ Volume  (all allowed)
  Node 3 (Pod C) ── read/write ──▶ Volume

RWOP (ReadWriteOncePod):
  Pod A on Node 1 ── read/write ──▶ Volume
  Pod B on Node 1 ──   BLOCKED  ──▶ Volume (same node but different pod)
```

### Which Storage Types Support Which Modes

| Storage Backend | RWO | ROX | RWX |
|----------------|-----|-----|-----|
| AWS EBS | Yes | No | No |
| GCE Persistent Disk | Yes | Yes | No |
| Azure Disk | Yes | No | No |
| Azure File | Yes | Yes | Yes |
| NFS | Yes | Yes | Yes |
| CephFS | Yes | Yes | Yes |
| Local volume | Yes | No | No |

> AWS EBS is RWO only — it can only attach to one EC2 instance at a time. For RWX on AWS, use EFS (NFS-based) via the AWS EFS CSI driver.

---

## 4. Reclaim Policies

The reclaim policy determines what happens to the PV (and its underlying storage) when the PVC that was bound to it is deleted.

### Retain

```yaml
persistentVolumeReclaimPolicy: Retain
```

The PV moves to `Released` state. The data is preserved. The PV cannot be rebound to a new PVC until an admin manually cleans it up. Use Retain for production data that should never be automatically deleted.

```
PVC deleted → PV moves to Released → Data preserved on disk
           → Admin manually:
               1. Deletes the PV object
               2. Creates a new PV pointing to same storage
               3. New PVC can bind to new PV
```

### Delete

```yaml
persistentVolumeReclaimPolicy: Delete
```

When the PVC is deleted, the PV and the underlying storage (e.g., the AWS EBS volume, the GCE disk) are automatically deleted. This is the default for dynamically provisioned volumes. Convenient but risky — there is no recovery after deletion.

### Recycle (deprecated)

Performed a basic `rm -rf /volume/*` on the volume data and made it Available again. Deprecated in favor of dynamic provisioning. Do not use.

---

## 5. PV Lifecycle

A PV moves through the following phases:

```
Available → Bound → Released → (Deleted | Available again after manual cleanup)

┌────────────┐   PVC binds   ┌────────────┐   PVC deleted   ┌────────────┐
│ Available  │──────────────▶│   Bound    │────────────────▶│  Released  │
└────────────┘               └────────────┘                  └────────────┘
      ▲                                                            │
      │                                                   Reclaim policy:
      │                                                   ├── Delete → PV deleted
      │                                                   └── Retain → stays Released
      │                                                              (admin must intervene)
      │
   (Admin creates new PV pointing to same storage after manual data cleanup)
```

| Phase | Meaning |
|-------|---------|
| `Available` | PV exists and is not yet claimed — ready to bind |
| `Bound` | PV is bound to a PVC and in use |
| `Released` | PVC was deleted but reclaim policy is Retain; PV is not yet available for new claims |
| `Failed` | Automatic reclamation failed |

```bash
# Check PV status
kubectl get pv
# NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM              STORAGECLASS
# my-pv-001   50Gi       RWO            Retain           Bound       default/my-pvc     fast-ssd
# my-pv-002   20Gi       RWX            Delete           Available                      standard

# Describe a PV for detailed info
kubectl describe pv my-pv-001

# Manually reclaim a Released PV (with Retain policy):
# 1. Delete the old PVC reference from the PV spec
kubectl patch pv my-pv-001 --type=json \
  -p='[{"op": "remove", "path": "/spec/claimRef"}]'
# 2. PV moves back to Available
# 3. New PVC can now bind to it
```

---

## 6. PersistentVolumeClaim Spec

A PVC is a namespaced resource. It is a request for storage from the cluster.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: production
spec:
  accessModes:
    - ReadWriteOnce               # must be a subset of the PV's access modes

  resources:
    requests:
      storage: 10Gi               # minimum size requested

  storageClassName: fast-ssd      # bind only to PVs with this StorageClass
                                  # use "" (empty string) to bind to PVs with NO class
                                  # omit to use the cluster default StorageClass

  volumeMode: Filesystem          # Filesystem (default) | Block

  selector:                       # optional: only bind to PVs matching these labels
    matchLabels:
      type: ssd
    matchExpressions:
      - key: region
        operator: In
        values:
          - us-east-1

  # volumeName: specific-pv       # optional: bind to a specific named PV
```

```bash
# Apply PVC
kubectl apply -f my-pvc.yaml

# Check PVC status
kubectl get pvc my-pvc -n production
# NAME     STATUS   VOLUME       CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# my-pvc   Bound    my-pv-001    50Gi       RWO            fast-ssd       2m

# If STATUS is Pending, the PVC has not found a matching PV yet
# Check events for clues:
kubectl describe pvc my-pvc -n production
```

---

## 7. Binding — How PVCs Find PVs

Kubernetes matches PVCs to PVs using a control loop that evaluates:

1. **StorageClass** — PVC's `storageClassName` must match PV's `storageClassName`
2. **Access modes** — PV must support all access modes requested by PVC
3. **Capacity** — PV must have at least as much storage as PVC requests
4. **Selector** — PV must match PVC's label selector (if specified)
5. **volumeName** — if PVC specifies `volumeName`, only that PV is considered

Binding is exclusive — once a PV is bound to a PVC, no other PVC can bind to it.

```
PVC requests: 10Gi, RWO, storageClass=fast-ssd

Candidate PVs:
  pv-001: 50Gi, RWO, fast-ssd  ← matches! (larger is OK)
  pv-002: 5Gi,  RWO, fast-ssd  ← too small
  pv-003: 10Gi, RWX, fast-ssd  ← RWX includes RWO, matches!
  pv-004: 10Gi, RWO, standard  ← wrong StorageClass

Kubernetes picks the smallest PV that satisfies all requirements → pv-001
```

```bash
# Force binding to a specific PV (static provisioning pattern):
# In the PVC spec, add:
  volumeName: my-pv-001

# In the PV spec, add a claimRef to prevent other PVCs from binding:
  claimRef:
    name: my-pvc
    namespace: production
```

---

## 8. Dynamic Provisioning

With dynamic provisioning, developers do not need to wait for admins to create PVs manually. The PVC references a StorageClass, and a provisioner creates the PV (and underlying storage) automatically.

```yaml
# Dynamic provisioning PVC example (AWS EBS via gp2 StorageClass)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: gp2        # triggers dynamic provisioning
```

```
Developer creates PVC with storageClassName: gp2
    │
    ▼
Kubernetes sees no matching PV exists
    │
    ▼
Calls AWS EBS CSI provisioner (external-provisioner controller)
    │
    ▼
AWS API: CreateVolume(20GiB, gp2, us-east-1a)
    │
    ▼
PV object created automatically (name: pvc-<uuid>)
    │
    ▼
PVC status changes from Pending → Bound
```

```bash
# Watch dynamic provisioning happen in real time
kubectl get pvc dynamic-pvc --watch
# NAME          STATUS    VOLUME   CAPACITY   STORAGECLASS   AGE
# dynamic-pvc   Pending                       gp2            0s
# dynamic-pvc   Bound     pvc-abc  20Gi       gp2            3s

# See the auto-created PV
kubectl get pv
```

### Volume Expansion (Resizing)

If the StorageClass has `allowVolumeExpansion: true`, you can expand a PVC after creation:

```bash
# Edit the PVC to request more storage
kubectl patch pvc dynamic-pvc -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'

# The volume is resized online (for supported storage backends)
# For filesystem resize: may require pod restart
kubectl get pvc dynamic-pvc   # watch CAPACITY change
```

---

## 9. Using PVCs in Pods

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
spec:
  volumes:
    - name: db-data
      persistentVolumeClaim:
        claimName: my-pvc        # must exist in same namespace as the Pod

  containers:
    - name: postgres
      image: postgres:15
      env:
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
      volumeMounts:
        - name: db-data
          mountPath: /var/lib/postgresql/data
```

### StatefulSet with PVC Templates

StatefulSets generate a PVC per replica automatically using `volumeClaimTemplates`. Each Pod gets its own PVC that persists even if the Pod is rescheduled.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-cluster
spec:
  serviceName: postgres-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:            # ← one PVC created per replica
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 50Gi
```

```
StatefulSet creates:
  data-postgres-cluster-0  →  PVC  →  PV (50Gi)  →  postgres-cluster-0 Pod
  data-postgres-cluster-1  →  PVC  →  PV (50Gi)  →  postgres-cluster-1 Pod
  data-postgres-cluster-2  →  PVC  →  PV (50Gi)  →  postgres-cluster-2 Pod

PVCs persist when Pods are deleted — data survives Pod rescheduling
```

---

## 10. Hands-On Exercises

**Exercise 1:** Perform static provisioning. Create a hostPath PV with 1Gi capacity and `RWO` access mode (use `/tmp/kube-pv-test` as the host path). Create a PVC requesting 500Mi. Observe that Kubernetes binds the PVC to the larger PV. Mount the PVC into a Pod, write a file at the mount path, delete the Pod, create a new Pod mounting the same PVC, and confirm the file is still there. This demonstrates PVC data persisting across Pod lifecycles.

**Exercise 2:** Create two PVCs requesting 1Gi each, both with `RWO` access mode. Create a Deployment with 2 replicas that both try to mount the same single PVC. Observe that both replicas cannot start simultaneously if the storage backend only supports RWO (only one node can mount it at once). Then change to a PVC backed by RWX storage (or use two separate PVCs) and observe both Pods running successfully.

**Exercise 3:** Simulate the Retain reclaim policy. Create a PV with `Retain` policy and bind it to a PVC. Write data from a Pod. Delete the PVC and observe the PV moves to `Released` state. Confirm the data still exists on the underlying storage. Manually reclaim the PV by removing its `claimRef` (use `kubectl patch`). Confirm it returns to `Available`. Create a new PVC and observe it binds to the reclaimed PV.

**Exercise 4:** Create a StatefulSet with 3 replicas using `volumeClaimTemplates`. List all the auto-created PVCs and note their naming pattern (`<claim-template-name>-<statefulset-name>-<ordinal>`). Scale the StatefulSet down to 0 replicas. Confirm the PVCs still exist (data preserved). Scale back up to 3 and confirm each Pod reattaches to its own PVC (pod-0 gets its original PVC, not pod-1's).

**Exercise 5:** Test PVC resizing. Create a PVC with a StorageClass that has `allowVolumeExpansion: true`. Mount it in a Pod. Patch the PVC to double its requested storage. Observe the PV capacity change in `kubectl get pv`. Exec into the Pod and run `df -h` at the mount path to confirm the filesystem has been resized online (behavior depends on storage backend — some require a Pod restart to reflect the new size).

---

## 11. Interview Q&A

**Q: What is the difference between a PersistentVolume and a PersistentVolumeClaim?**
Answer: A PersistentVolume (PV) is a cluster-scoped resource representing actual storage — a real disk, NFS share, or cloud volume. It is created by a cluster administrator (or a dynamic provisioner) and contains the technical details of the storage (type, capacity, access modes, reclaim policy). A PersistentVolumeClaim (PVC) is a namespaced resource representing a request for storage by an application developer. It specifies what the application needs (size, access mode, storage class) without caring about the underlying implementation. Kubernetes matches PVCs to PVs through a binding process. This separation allows operators to manage storage infrastructure independently from application developers.

**Q: What are the four access modes and when would you use ReadWriteMany?**
Answer: ReadWriteOnce (RWO) allows a single node to mount the volume read-write — typical for block storage like AWS EBS or Azure Disk. ReadOnlyMany (ROX) allows multiple nodes to mount read-only simultaneously — useful for shared static assets. ReadWriteMany (RWX) allows multiple nodes to mount read-write simultaneously — required for shared storage like NFS, CephFS, or AWS EFS. ReadWriteOncePod (RWOP) limits mounting to a single Pod. Use RWX when multiple Pods on different nodes need to write to the same storage simultaneously — for example, a horizontally scaled web app that writes uploads to a shared filesystem, or an application that synchronizes state across replicas through a shared file.

**Q: What happens to the underlying storage when a PVC is deleted and the reclaim policy is Delete vs Retain?**
Answer: With `Delete`, Kubernetes automatically deletes both the PV object and the underlying storage resource (e.g., the AWS EBS volume is deleted via the AWS API, the GCE disk is deleted). There is no recovery — the data is gone. With `Retain`, Kubernetes moves the PV to `Released` state and preserves both the PV object and the underlying storage. The data is safe but the PV cannot be rebound to a new PVC until an admin manually cleans the PV's `claimRef` (removing the reference to the deleted PVC). Use `Retain` in production for critical data; use `Delete` for ephemeral workloads where data is disposable.

**Q: How does dynamic provisioning work and what is required for it?**
Answer: Dynamic provisioning allows Kubernetes to automatically create PVs (and the underlying storage) in response to PVC creation, without requiring an admin to pre-provision storage. It requires three components: a StorageClass that specifies a provisioner (e.g., `ebs.csi.aws.com` for AWS EBS), a provisioner (a controller that watches for PVC events and calls the cloud/storage API), and a PVC that references the StorageClass by name. When a PVC is created, the provisioner receives an event, calls the storage API (e.g., `CreateVolume` on AWS), creates a PV object, and binds it to the PVC. The whole process takes seconds. If no StorageClass is specified, the cluster's default StorageClass is used.

**Q: Why do StatefulSets use volumeClaimTemplates instead of referencing a single PVC?**
Answer: A StatefulSet runs multiple replicas of a stateful application (like a database), and each replica must have its own independent, persistent storage. If all replicas shared a single PVC, they would all read and write the same data, which is not how databases like MySQL, Cassandra, or Kafka work — each node needs its own data directory. `volumeClaimTemplates` instructs Kubernetes to create a separate PVC for each replica, named `<template-name>-<statefulset-name>-<ordinal>`. Each Pod mounts its own PVC. Critically, these PVCs persist even when the StatefulSet is scaled down, so when the StatefulSet scales back up, each Pod reattaches to its original PVC — maintaining data affinity between Pod identity and its storage.
