# StorageClasses — Complete Guide

## Table of Contents
1. [What is a StorageClass?](#1-what-is-a-storageclass)
2. [StorageClass Spec](#2-storageclass-spec)
3. [Provisioners](#3-provisioners)
4. [Parameters — Provisioner-Specific Configuration](#4-parameters--provisioner-specific-configuration)
5. [Reclaim Policy](#5-reclaim-policy)
6. [Volume Binding Mode](#6-volume-binding-mode)
7. [Default StorageClass](#7-default-storageclass)
8. [Cloud Provider StorageClasses](#8-cloud-provider-storageclasses)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a StorageClass?

A StorageClass is a cluster-scoped resource that describes a "class" of storage. It acts as a blueprint that tells Kubernetes:
- **What provisioner** to call to create the actual storage (e.g., AWS EBS CSI driver)
- **What parameters** to pass to that provisioner (e.g., disk type, IOPS, encryption)
- **What reclaim policy** dynamically created PVs should have
- **How and when** to bind PVCs to PVs

StorageClasses enable dynamic provisioning — when a PVC references a StorageClass, Kubernetes automatically provisions a matching PV using the class's provisioner, instead of requiring a pre-created PV.

```
Without StorageClass (static provisioning):
  Admin → creates PV manually → Developer creates PVC → Kubernetes binds
  (Slow, manual, ops-heavy)

With StorageClass (dynamic provisioning):
  Admin → creates StorageClass once → Developer creates PVC
  → Kubernetes calls provisioner → PV created automatically
  (Fast, self-service, scalable)

StorageClass as a menu of storage options:
┌──────────────────────────────────────────────────────┐
│  Available StorageClasses in cluster                │
│                                                      │
│  standard     → HDD, Delete policy, cheap           │
│  fast-ssd     → SSD, Delete policy, fast            │
│  fast-ssd-ha  → SSD, Retain policy, multi-AZ, HA   │
│  shared-nfs   → NFS, RWX support, shared access     │
└──────────────────────────────────────────────────────┘
Developer picks by name in PVC spec
```

---

## 2. StorageClass Spec

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"  # not the default

provisioner: ebs.csi.aws.com         # who creates the actual storage

parameters:                          # provisioner-specific configuration
  type: gp3                          # AWS EBS volume type
  iops: "3000"
  throughput: "125"
  encrypted: "true"
  kmsKeyId: "arn:aws:kms:us-east-1:123456789:key/my-key"

reclaimPolicy: Delete                # Retain | Delete (default: Delete)

allowVolumeExpansion: true           # allow PVCs to be resized after creation

volumeBindingMode: WaitForFirstConsumer  # Immediate | WaitForFirstConsumer

mountOptions:                        # options passed to mount command
  - debug
  - uid=1000
  - gid=1000

# Restrict which topologies (AZs) this class can provision in
allowedTopologies:
  - matchLabelExpressions:
      - key: topology.ebs.csi.aws.com/zone
        values:
          - us-east-1a
          - us-east-1b
```

---

## 3. Provisioners

The `provisioner` field identifies which plugin creates the storage. There are two types:

### In-Tree Provisioners (Legacy, being removed)

Built directly into the Kubernetes binary. Being replaced by CSI drivers.

```
kubernetes.io/aws-ebs    → AWS Elastic Block Store (deprecated)
kubernetes.io/gce-pd     → GCP Persistent Disk (deprecated)
kubernetes.io/azure-disk → Azure Managed Disk (deprecated)
kubernetes.io/no-provisioner → disables dynamic provisioning (static only)
```

### CSI (Container Storage Interface) Provisioners (Modern)

External provisioners that implement the CSI spec. Each runs as a Pod in the cluster.

```
ebs.csi.aws.com          → AWS EBS CSI Driver
pd.csi.storage.gke.io    → GCP Persistent Disk CSI Driver
disk.csi.azure.com       → Azure Disk CSI Driver
file.csi.azure.com       → Azure File CSI Driver
efs.csi.aws.com          → AWS EFS CSI Driver (RWX)
nfs.csi.k8s.io           → NFS CSI Driver
rbd.csi.ceph.com         → Ceph RBD CSI Driver
cephfs.csi.ceph.com      → CephFS CSI Driver (RWX)
```

```bash
# List installed CSI drivers
kubectl get csidriver

# List StorageClasses in the cluster
kubectl get storageclass
# NAME              PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      AGE
# gp2 (default)     ebs.csi.aws.com         Delete          WaitForFirstConsumer   10d
# gp3               ebs.csi.aws.com         Delete          WaitForFirstConsumer   5d
# efs-sc            efs.csi.aws.com         Delete          Immediate              5d

# Describe a StorageClass
kubectl describe storageclass fast-ssd
```

### No-Provisioner (Static Only)

For local volumes, use `kubernetes.io/no-provisioner` — this tells Kubernetes not to provision dynamically; PVs must be created manually.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer   # critical for local volumes
```

---

## 4. Parameters — Provisioner-Specific Configuration

`parameters` are key-value pairs passed directly to the provisioner. They are provisioner-specific and vary by driver.

### AWS EBS CSI Driver Parameters

```yaml
parameters:
  type: gp3            # gp2 | gp3 | io1 | io2 | sc1 | st1
  iops: "3000"         # IOPS for gp3/io1/io2 (gp3 max: 16000)
  throughput: "125"    # MiB/s for gp3 (max: 1000)
  encrypted: "true"
  kmsKeyId: "arn:aws:kms:..."  # specific KMS key; omit to use default
  fsType: ext4         # ext4 | xfs
  blockExpress: "false"
```

### GCP Persistent Disk CSI Driver Parameters

```yaml
parameters:
  type: pd-ssd         # pd-standard | pd-ssd | pd-balanced | pd-extreme
  replication-type: none  # none | regional-pd (for multi-zone replication)
  disk-encryption-kms-key: "projects/..."
  fstype: ext4
```

### Azure Disk CSI Driver Parameters

```yaml
parameters:
  skuName: Premium_LRS         # Standard_LRS | StandardSSD_LRS | Premium_LRS | UltraSSD_LRS
  kind: Managed
  location: eastus
  cachingMode: ReadOnly        # None | ReadOnly | ReadWrite
  fsType: ext4
  enableBursting: "true"       # Premium only
```

### Azure File CSI Driver Parameters (RWX)

```yaml
parameters:
  skuName: Premium_LRS
  storageAccount: mystorageaccount
  protocol: nfs                # smb | nfs
```

### NFS CSI Driver Parameters

```yaml
parameters:
  server: 192.168.1.100
  share: /mnt/data
  mountPermissions: "0777"
```

---

## 5. Reclaim Policy

The `reclaimPolicy` in a StorageClass sets the default reclaim policy for PVs created by that class.

```yaml
reclaimPolicy: Delete    # default — PV and underlying storage deleted when PVC deleted
reclaimPolicy: Retain    # PV and storage preserved when PVC deleted
```

This only affects dynamically provisioned PVs. Statically provisioned PVs use whatever `persistentVolumeReclaimPolicy` is set directly on the PV object.

```
Recommended policies by environment:

Development/staging:
  reclaimPolicy: Delete     ← clean up automatically, storage costs money

Production databases:
  reclaimPolicy: Retain     ← never auto-delete data, require human confirmation

Backups/archival:
  reclaimPolicy: Retain     ← data must be preserved
```

You can change a PV's reclaim policy after creation even if the StorageClass uses Delete:

```bash
kubectl patch pv pvc-abc123 \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

---

## 6. Volume Binding Mode

`volumeBindingMode` controls when a PVC is bound to a PV.

### Immediate (default for most cloud provisioners historically)

```yaml
volumeBindingMode: Immediate
```

The PV is provisioned and the PVC is bound as soon as the PVC is created, regardless of which node the Pod will be scheduled on. This can cause problems with topology-constrained storage (e.g., an EBS volume created in `us-east-1a` but the Pod is scheduled on a node in `us-east-1b`).

```
PVC created → PV provisioned in zone: us-east-1a
Pod scheduled → assigned to node in us-east-1b
→ Pod cannot start: volume is in wrong AZ!
```

### WaitForFirstConsumer (recommended)

```yaml
volumeBindingMode: WaitForFirstConsumer
```

The PV is not provisioned until a Pod using the PVC is scheduled to a node. Kubernetes knows the node's topology (AZ, zone) and provisions the PV in the correct location.

```
PVC created → binding delayed (Pending)
Pod scheduled → Kubernetes selects node in us-east-1a
→ PV provisioned in us-east-1a
→ PVC bound to PV
→ Pod mounts volume successfully
```

```bash
# PVC shows Pending with WaitForFirstConsumer until a Pod uses it
kubectl get pvc my-pvc
# NAME     STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# my-pvc   Pending                       gp3            3m
#         ^^^^^ pending until a Pod is scheduled

# After creating a Pod that uses the PVC:
# NAME     STATUS   VOLUME          CAPACITY   ACCESS MODES   AGE
# my-pvc   Bound    pvc-abc123...   20Gi       RWO            3m5s
```

Use `WaitForFirstConsumer` for any topology-constrained storage (cloud block storage). Use `Immediate` only for storage that spans all zones (NFS, CephFS, object storage).

---

## 7. Default StorageClass

A cluster can have one default StorageClass. When a PVC is created without specifying a `storageClassName`, Kubernetes uses the default.

```yaml
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"   # marks as default
```

```bash
# List StorageClasses — default is marked with (default)
kubectl get storageclass
# NAME            PROVISIONER         RECLAIMPOLICY   VOLUMEBINDINGMODE      AGE
# gp2 (default)   ebs.csi.aws.com     Delete          WaitForFirstConsumer   10d
# gp3             ebs.csi.aws.com     Delete          WaitForFirstConsumer   2d

# Change the default StorageClass:
# Step 1: Remove default annotation from current default
kubectl patch storageclass gp2 \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'

# Step 2: Set new default
kubectl patch storageclass gp3 \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Verify
kubectl get storageclass
# NAME        PROVISIONER         ...
# gp2         ebs.csi.aws.com     ...  ← no longer default
# gp3(default) ebs.csi.aws.com    ...  ← new default
```

If no default StorageClass is set and a PVC omits `storageClassName`, the PVC stays Pending with no matching provisioner.

If a PVC explicitly sets `storageClassName: ""` (empty string), it opts out of dynamic provisioning entirely and will only bind to a statically created PV with no StorageClass.

---

## 8. Cloud Provider StorageClasses

### AWS EKS

AWS EKS clusters come with a `gp2` StorageClass by default (being migrated to `gp3`).

```yaml
# gp3 StorageClass (better performance, lower cost than gp2)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
# High-performance io2 for databases
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: io2-high-iops
provisioner: ebs.csi.aws.com
parameters:
  type: io2
  iops: "50000"
  encrypted: "true"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
# EFS for shared RWX storage
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-sc
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap          # EFS access point per PVC
  fileSystemId: fs-0123456789abcdef
  directoryPerms: "700"
  gidRangeStart: "1000"
  gidRangeEnd: "2000"
reclaimPolicy: Delete
volumeBindingMode: Immediate        # EFS spans all AZs
```

### GCP GKE

```yaml
# Standard HDD
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-standard
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
# SSD
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: premium-rwo
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
# Regional (replicated across zones)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: regional-pd
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
  replication-type: regional-pd
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### Azure AKS

```yaml
# Managed Premium SSD
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: managed-premium
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
  cachingMode: ReadOnly
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
# Azure Files NFS (RWX)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azurefile-nfs
provisioner: file.csi.azure.com
parameters:
  skuName: Premium_LRS
  protocol: nfs
mountOptions:
  - nconnect=8
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
```

### On-Premises with NFS

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
provisioner: nfs.csi.k8s.io
parameters:
  server: 192.168.1.100
  share: /exports/k8s-pv
  mountPermissions: "0777"
reclaimPolicy: Delete
volumeBindingMode: Immediate
mountOptions:
  - hard
  - nfsvers=4.1
  - proto=tcp
  - timeo=600
  - retrans=2
```

### Local Volumes (Bare Metal)

```yaml
# Requires pre-provisioned disks on specific nodes
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer   # mandatory for local volumes
---
# Manually create PV for each local disk
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv-node1-ssd1
spec:
  capacity:
    storage: 200Gi
  volumeMode: Filesystem
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - worker-node-1
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create three StorageClasses in a local cluster (e.g., minikube or kind): `slow` using `hostpath` provisioner (or `rancher.io/local-path` if available), `fast` as a copy of `slow` but with a different name, and `archive` with `reclaimPolicy: Retain`. Create one PVC per StorageClass. Verify all three PVCs bind and confirm each bound PV shows the correct reclaim policy by running `kubectl get pv -o custom-columns=NAME:.metadata.name,RECLAIM:.spec.persistentVolumeReclaimPolicy`.

**Exercise 2:** Observe the `WaitForFirstConsumer` binding mode in action. Create a StorageClass with `volumeBindingMode: WaitForFirstConsumer`. Create a PVC referencing it and observe it stays Pending. Create a Pod that uses the PVC and watch the PVC bind to a newly created PV. Then delete the Pod (but not the PVC) and observe the PV stays Bound (the PVC is still there). This shows that PV lifetime is tied to the PVC, not the Pod.

**Exercise 3:** Test volume expansion. Create a StorageClass with `allowVolumeExpansion: true`. Create a 1Gi PVC. Mount it in a Pod and write data to confirm it works. Patch the PVC to request 2Gi. Observe the PV capacity update. Exec into the Pod and run `df -h` at the mount path — if the filesystem resized online, you will see 2Gi. If not, delete and recreate the Pod and check again. Document whether the storage backend required a Pod restart for the filesystem resize.

**Exercise 4:** Create a StorageClass with `reclaimPolicy: Retain`. Create a PVC, mount it in a Pod, write a test file. Delete the Pod and then delete the PVC. Observe the PV moves to `Released` state. Verify the underlying data is preserved (if using hostPath, check the path on the node). Manually reclaim the PV by patching out the `claimRef`. Create a new PVC and verify it binds to the reclaimed PV and that your data file is still there.

**Exercise 5:** Set up a "tiered storage" scenario with two StorageClasses: `database-storage` (with `Retain` policy, `allowVolumeExpansion: true`, best for databases) and `cache-storage` (with `Delete` policy, for ephemeral caches). Deploy a StatefulSet for a database using `database-storage` via `volumeClaimTemplates`. Deploy a Deployment for a cache service using `cache-storage`. Scale both workloads to 0 replicas and observe: the database PVCs remain (Retain); if you had used Delete, the cache PVCs would be deleted on scale-down (but since PVCs are not deleted by scale-down, observe the difference by actually deleting the cache PVC manually and watching the PV disappear).

---

## 10. Interview Q&A

**Q: What is a StorageClass and why is it needed?**
Answer: A StorageClass is a Kubernetes resource that describes a category of storage — it specifies which provisioner to use (e.g., the AWS EBS CSI driver), what parameters to pass it (disk type, IOPS, encryption), what reclaim policy provisioned PVs should have, and when to bind PVCs to PVs. It is needed to enable dynamic provisioning: without StorageClasses, every PV must be manually created by an admin before a developer can claim it. With StorageClasses, a developer just creates a PVC referencing a class name, and Kubernetes automatically provisions the PV using the class's provisioner. This separates the concern of storage provisioning (admin's job) from storage consumption (developer's job) and scales to thousands of PVCs without manual intervention.

**Q: What is the difference between Immediate and WaitForFirstConsumer volume binding modes?**
Answer: With `Immediate` binding, a PV is provisioned and bound to the PVC as soon as the PVC is created, before any Pod is scheduled. The PV is created in whatever availability zone the provisioner chooses. If the Pod later gets scheduled to a node in a different zone, it cannot mount the volume (for zone-constrained storage like AWS EBS). With `WaitForFirstConsumer`, binding is delayed until a Pod using the PVC is actually scheduled to a node. Kubernetes knows the selected node's zone and provisions the PV in that same zone, guaranteeing the Pod can mount it. Use `WaitForFirstConsumer` for any topology-constrained storage (cloud block storage); use `Immediate` for storage that spans all zones (NFS, CephFS, AWS EFS).

**Q: How do you change the default StorageClass in a cluster?**
Answer: The default StorageClass is identified by the annotation `storageclass.kubernetes.io/is-default-class: "true"`. To change the default: first remove the annotation from the current default (`kubectl patch storageclass <old-name> -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'`), then set it on the new default (`kubectl patch storageclass <new-name> -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'`). Having two StorageClasses both annotated as default is an error condition — Kubernetes will refuse to dynamically provision for PVCs that omit `storageClassName`. Having no default StorageClass means PVCs without a `storageClassName` will remain Pending indefinitely.

**Q: What is the difference between the provisioner in a StorageClass and a CSI driver?**
Answer: A CSI (Container Storage Interface) driver is the actual software that runs in the cluster and implements the CSI specification — it can create, delete, attach, detach, mount, and resize volumes by calling the underlying storage API (e.g., AWS EBS API). The `provisioner` field in a StorageClass is simply the name/identifier of that CSI driver (e.g., `ebs.csi.aws.com`). When a PVC triggers dynamic provisioning, Kubernetes looks up the provisioner name from the StorageClass and routes the create-volume request to the matching CSI driver. In-tree provisioners (legacy `kubernetes.io/aws-ebs`) had this code built into the Kubernetes binary; CSI drivers are external plugins that run as Pods in the cluster, making them independently upgradable and maintained by storage vendors.

**Q: What happens if you create a PVC without specifying storageClassName and there is no default StorageClass?**
Answer: The PVC will remain in `Pending` state indefinitely. Kubernetes will not attempt dynamic provisioning because there is no StorageClass to use. The PVC will only bind if a pre-existing PV (statically created by an admin) matches the PVC's capacity, access mode, and has no `storageClassName` (or an empty one). You can see the reason in `kubectl describe pvc <name>` — the events section will show something like "no persistent volumes available for this claim and no storage class is set." The fix is to either specify an explicit `storageClassName` in the PVC, create a default StorageClass in the cluster, or have an admin pre-create a matching PV.
