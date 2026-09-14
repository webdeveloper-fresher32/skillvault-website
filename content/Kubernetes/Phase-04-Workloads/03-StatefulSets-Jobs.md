# StatefulSets, Jobs & CronJobs — Complete Guide

## Table of Contents
1. [StatefulSet Fundamentals](#1-statefulset-fundamentals)
2. [StatefulSet YAML & volumeClaimTemplates](#2-statefulset-yaml--volumeclaimtemplates)
3. [Headless Service for StatefulSets](#3-headless-service-for-statefulsets)
4. [StatefulSet Update Strategies](#4-statefulset-update-strategies)
5. [Jobs](#5-jobs)
6. [CronJobs](#6-cronjobs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. StatefulSet Fundamentals

A **StatefulSet** is a workload API object that manages a set of Pods with **stable, unique identities**. Unlike Deployments, which treat all Pod replicas as interchangeable, StatefulSets give each Pod a persistent name, a persistent DNS hostname, and persistent storage that follows the Pod even if it is rescheduled to a different node.

### The Problem StatefulSets Solve

```
Deployment (stateless):
  Pod-abc123  ─── deleted ──►  Pod-xyz789  (new name, new storage, new IP)
  Pod-def456                   Pod-mnp123
  All Pods are interchangeable. Any can handle any request.
  Storage is optional and ephemeral.

StatefulSet (stateful):
  mysql-0  ─── deleted ──►  mysql-0  (SAME name, SAME storage, new IP)
  mysql-1                   mysql-1
  mysql-2                   mysql-2
  Each Pod has a fixed identity that survives restarts and rescheduling.
  Storage is per-Pod and persistent.
```

### Three Guarantees StatefulSets Provide

**1. Stable Network Identity**

Each Pod gets a predictable, stable DNS name that never changes:

```
<statefulset-name>-<ordinal>.<service-name>.<namespace>.svc.cluster.local

Examples:
  mysql-0.mysql.default.svc.cluster.local
  mysql-1.mysql.default.svc.cluster.local
  mysql-2.mysql.default.svc.cluster.local

The ordinal index (0, 1, 2) is assigned at creation and is permanent.
Deleting mysql-1 and waiting for it to restart → same name mysql-1 comes back.
```

**2. Stable Persistent Storage**

Each Pod gets its own PersistentVolumeClaim created from a `volumeClaimTemplate`. The PVC is named `<volume-name>-<pod-name>`:

```
data-mysql-0   (PVC for mysql-0)
data-mysql-1   (PVC for mysql-1)
data-mysql-2   (PVC for mysql-2)

If mysql-1 is deleted and rescheduled to a different node:
  → Kubernetes creates a new mysql-1 Pod
  → It reattaches the existing PVC  data-mysql-1
  → The Pod resumes with the same data
```

**3. Ordered Startup and Shutdown**

```
Startup (scale up):
  mysql-0 starts → waits until Ready → mysql-1 starts → waits until Ready → mysql-2 starts

Shutdown (scale down or delete):
  mysql-2 terminates → waits until gone → mysql-1 terminates → waits until gone → mysql-0 terminates

This ordering is critical for databases:
  mysql-0 is typically the primary. It must be the last to go down
  and the first to come up, so replicas can connect to it on startup.
```

### When to Use StatefulSets

| Workload | Needs StatefulSet? |
|----------|-------------------|
| Nginx web servers | No — Deployment is fine |
| REST API | No — Deployment is fine |
| MySQL / PostgreSQL | Yes — stable identity and storage |
| Redis cluster | Yes — shards have fixed IDs |
| Kafka / Zookeeper | Yes — brokers have fixed identities |
| Elasticsearch | Yes — data nodes have fixed storage |
| etcd | Yes — member IDs must be stable |

---

## 2. StatefulSet YAML & volumeClaimTemplates

The key difference from a Deployment YAML is the `volumeClaimTemplates` field. Instead of creating one PVC and sharing it, the StatefulSet creates one PVC per Pod automatically.

### Full StatefulSet YAML: MySQL

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: default
spec:
  serviceName: mysql          # must match the Headless Service name
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        ports:
        - containerPort: 3306
          name: mysql
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        - name: MYSQL_DATABASE
          value: appdb
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: data
          mountPath: /var/lib/mysql    # MySQL data directory
        livenessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - mysql
            - -h
            - localhost
            - -e
            - "SELECT 1"
          initialDelaySeconds: 5
          periodSeconds: 5

  # --- The critical StatefulSet feature ---
  # One PVC is created per Pod, named: data-mysql-0, data-mysql-1, data-mysql-2
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]    # one node can mount it at a time
      storageClassName: "standard"      # matches your cluster's StorageClass
      resources:
        requests:
          storage: 10Gi
```

### What Gets Created

```
kubectl apply -f mysql-statefulset.yaml

Resources created automatically:
  StatefulSet: mysql
  Pods:        mysql-0,  mysql-1,  mysql-2   (started in order)
  PVCs:        data-mysql-0,  data-mysql-1,  data-mysql-2  (one per Pod)
  PVs:         dynamically provisioned by the StorageClass (if configured)

kubectl get statefulset mysql
NAME    READY   AGE
mysql   3/3     2m

kubectl get pvc
NAME           STATUS   VOLUME            CAPACITY   ACCESS MODES
data-mysql-0   Bound    pvc-abc...        10Gi       RWO
data-mysql-1   Bound    pvc-def...        10Gi       RWO
data-mysql-2   Bound    pvc-ghi...        10Gi       RWO
```

### Scaling a StatefulSet

```bash
# Scale up — mysql-3 is created after mysql-2 is Ready
kubectl scale statefulset mysql --replicas=4

# Scale down — mysql-3 is deleted first, then mysql-2 (reverse order)
kubectl scale statefulset mysql --replicas=2

# IMPORTANT: scaling down does NOT delete PVCs
# data-mysql-3 and data-mysql-2 persist on disk
# If you scale back up, the same PVCs are reattached
```

---

## 3. Headless Service for StatefulSets

A StatefulSet requires a **headless Service** — a Service with `clusterIP: None`. A headless Service does not load-balance traffic. Instead, DNS returns the individual IP addresses of each Pod, allowing clients to connect to a specific Pod by its stable DNS name.

### Why Headless?

```
Normal Service (clusterIP: 10.96.0.10):
  DNS: mysql.default.svc.cluster.local → 10.96.0.10 (virtual IP)
  kube-proxy load-balances to any Pod
  You cannot target mysql-1 specifically

Headless Service (clusterIP: None):
  DNS: mysql.default.svc.cluster.local → [10.0.0.4, 10.0.0.5, 10.0.0.6] (Pod IPs)
  DNS: mysql-0.mysql.default.svc.cluster.local → 10.0.0.4  (mysql-0 only)
  DNS: mysql-1.mysql.default.svc.cluster.local → 10.0.0.5  (mysql-1 only)
  DNS: mysql-2.mysql.default.svc.cluster.local → 10.0.0.6  (mysql-2 only)

For a MySQL replica set, replicas need to connect to the PRIMARY specifically.
They use: mysql-0.mysql.default.svc.cluster.local:3306
```

### Headless Service YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql          # must match StatefulSet's spec.serviceName
  namespace: default
spec:
  clusterIP: None      # this makes it headless
  selector:
    app: mysql
  ports:
  - port: 3306
    targetPort: 3306
    name: mysql
```

### DNS Records Created

```bash
# From inside the cluster — individual Pod DNS names:
nslookup mysql-0.mysql.default.svc.cluster.local
  → 10.0.0.4

nslookup mysql-1.mysql.default.svc.cluster.local
  → 10.0.0.5

# The StatefulSet service name resolves to all Pod IPs (for discovery):
nslookup mysql.default.svc.cluster.local
  → 10.0.0.4
  → 10.0.0.5
  → 10.0.0.6
```

---

## 4. StatefulSet Update Strategies

StatefulSets support two update strategies, controlled by `spec.updateStrategy.type`.

### RollingUpdate (default)

Pods are updated one at a time, in reverse ordinal order (highest index first). The next Pod is not updated until the previous one is Running and Ready.

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 0    # update all Pods (0 = no partition)
```

```
Update sequence for a 3-replica StatefulSet:
  mysql-2 updated → waits until Ready
  mysql-1 updated → waits until Ready
  mysql-0 updated → waits until Ready

Highest ordinal first — the primary (mysql-0) is updated last,
minimizing disruption to replication topology.
```

**Canary Updates with Partition**

The `partition` field lets you do a partial rollout. Pods with an ordinal >= partition are updated; lower ordinals keep the old version.

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 2    # only mysql-2 gets the new version
                      # mysql-0 and mysql-1 stay on old version
```

```
Use case: canary test on mysql-2 (a replica) before rolling to mysql-1 and mysql-0.

Step 1: partition: 2  → only mysql-2 updated, observe for issues
Step 2: partition: 1  → mysql-2 and mysql-1 updated
Step 3: partition: 0  → all Pods updated including mysql-0 (primary)
```

### OnDelete

The StatefulSet does NOT automatically update Pods when the template changes. You must manually delete each Pod to trigger the update. The replacement Pod uses the new template.

```yaml
spec:
  updateStrategy:
    type: OnDelete    # manual control over when each Pod is updated
```

```
Use case: you need to manually coordinate the update order,
run pre-update checks, or have complex external orchestration logic
that kubectl rolling-update cannot express.
```

---

## 5. Jobs

A **Job** creates one or more Pods to perform a task and tracks successful completions. When the specified number of Pods complete successfully, the Job is done. Pods are not restarted after success.

### Job vs Deployment

```
Deployment:  run Pods forever, restart on failure, no concept of "done"
Job:         run Pods until N successful completions, then stop
             Pods that fail are restarted (up to backoffLimit)
             Pods that succeed are NOT restarted
```

### Key Job Fields

```
completions:           Total successful Pod completions required (default: 1)
parallelism:           How many Pods run in parallel (default: 1)
backoffLimit:          Max retries before the Job is marked Failed (default: 6)
activeDeadlineSeconds: Wall-clock time limit for the entire Job
ttlSecondsAfterFinished: Auto-delete the Job N seconds after it finishes
```

### Job YAML Example

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-backup
spec:
  completions: 1             # one successful completion = Job is done
  parallelism: 1             # run one Pod at a time
  backoffLimit: 4            # retry up to 4 times on failure
  activeDeadlineSeconds: 600 # fail the Job if it takes longer than 10 minutes
  ttlSecondsAfterFinished: 3600  # auto-delete 1 hour after completion
  template:
    metadata:
      labels:
        job-name: db-backup
    spec:
      restartPolicy: OnFailure    # required for Jobs (Never or OnFailure)
      containers:
      - name: backup
        image: mysql:8.0
        command:
        - sh
        - -c
        - |
          mysqldump -h mysql-0.mysql.default.svc.cluster.local \
            -u root -p$MYSQL_ROOT_PASSWORD appdb \
            > /backup/appdb-$(date +%Y%m%d-%H%M%S).sql
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        volumeMounts:
        - name: backup-storage
          mountPath: /backup
      volumes:
      - name: backup-storage
        persistentVolumeClaim:
          claimName: backup-pvc
```

### Parallel Jobs Patterns

```
Pattern 1: Fixed completion count (completions > parallelism)
  completions: 10, parallelism: 3
  → 10 total successful completions required
  → 3 Pods run at a time
  → Total waves: ceil(10/3) = 4 waves

Pattern 2: Work queue (completions not set, parallelism > 1)
  parallelism: 5   (completions omitted)
  → Pods read from a queue (SQS, Redis, etc.)
  → Job is complete when any ONE Pod exits 0
    (that Pod signals "queue is empty")
  → All other Pods are terminated

Pattern 3: Indexed Job (completionMode: Indexed)
  completions: 5, parallelism: 5, completionMode: Indexed
  → Each Pod gets a unique index 0-4 via JOB_COMPLETION_INDEX env var
  → Use case: process one shard of data per Pod
```

### Monitoring Jobs

```bash
kubectl get jobs
kubectl describe job db-backup
kubectl get pods -l job-name=db-backup
kubectl logs job/db-backup     # logs from the Job's Pod
```

---

## 6. CronJobs

A **CronJob** creates Jobs on a repeating schedule, using the standard Unix cron syntax. It manages the lifecycle of the Jobs it creates — keeping a history and cleaning up old ones.

### CronJob YAML Example

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"          # 2:00 AM every night
  concurrencyPolicy: Forbid       # do not start a new Job if previous is still running
  successfulJobsHistoryLimit: 3   # keep the last 3 successful Job records
  failedJobsHistoryLimit: 1       # keep the last 1 failed Job record
  startingDeadlineSeconds: 300    # if missed, skip if more than 5 minutes late
  suspend: false                  # set to true to pause the CronJob without deleting it

  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        metadata:
          labels:
            cronjob: nightly-backup
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: mysql:8.0
            command: ["sh", "-c", "mysqldump -h mysql-0.mysql ... > /backup/dump.sql"]
            env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: root-password
```

### Cron Schedule Syntax

```
┌─────────────── minute         (0-59)
│ ┌───────────── hour           (0-23)
│ │ ┌─────────── day of month   (1-31)
│ │ │ ┌───────── month          (1-12)
│ │ │ │ ┌─────── day of week    (0-6, 0=Sunday)
│ │ │ │ │
* * * * *

Examples:
  "0 2 * * *"      every day at 2:00 AM
  "*/15 * * * *"   every 15 minutes
  "0 9 * * 1-5"    9:00 AM Monday through Friday
  "0 0 1 * *"      midnight on the 1st of every month
  "@hourly"        shorthand for "0 * * * *"
  "@daily"         shorthand for "0 0 * * *"
  "@weekly"        shorthand for "0 0 * * 0"
```

### concurrencyPolicy

```
Allow (default):
  A new Job starts even if the previous Job is still running.
  Multiple Job instances can overlap.
  Risk: resource contention, data corruption on shared state.

Forbid:
  A new Job is skipped if the previous Job is still running.
  The most common setting for data processing Jobs.

Replace:
  The current running Job is terminated and a new one starts.
  Use when you want the latest run to always be the active one.
```

### CronJob Commands

```bash
# List CronJobs
kubectl get cronjobs
kubectl get cj                    # short alias

# Trigger a Job manually from a CronJob (without waiting for schedule)
kubectl create job --from=cronjob/nightly-backup manual-run-1

# Suspend a CronJob (pause without deleting)
kubectl patch cronjob nightly-backup -p '{"spec":{"suspend":true}}'

# Resume a suspended CronJob
kubectl patch cronjob nightly-backup -p '{"spec":{"suspend":false}}'

# View the Jobs created by a CronJob
kubectl get jobs -l cronjob=nightly-backup
```

### Job and CronJob State Machine

```
CronJob triggers at scheduled time
        │
        ▼
    Job created
        │
        ▼
    Pod(s) created
        │
    ┌───┴────────────────────────────┐
    │                                │
    ▼                                ▼
Pod succeeds (exit 0)          Pod fails (exit != 0)
    │                                │
    ▼                                ▼
completions count +1          backoffLimit check
    │                                │
    ▼                            YES │ more retries?
all completions met?  ◄─────────────┘
    │YES                        NO → Job status: Failed
    ▼
Job status: Complete
    │
    ▼
ttlSecondsAfterFinished? → auto-delete after N seconds
```

---

## 7. Hands-On Exercises

**Exercise 1:** Deploy a StatefulSet and observe ordered startup. Create a StatefulSet named `web` with 3 replicas using nginx:1.25 and a `volumeClaimTemplate` for 1Gi of storage each. Run `kubectl get pods -w` in a second terminal while applying the manifest. Observe that `web-0` reaches Running before `web-1` is even created, and `web-1` reaches Running before `web-2` starts. Then run `kubectl get pvc` to confirm three PVCs named `data-web-0`, `data-web-1`, `data-web-2` were created automatically.

**Exercise 2:** Test stable identity through Pod deletion. With the StatefulSet from Exercise 1 running, delete `web-1`: `kubectl delete pod web-1`. Immediately run `kubectl get pods -w`. Confirm that a new `web-1` Pod is created (same name), and run `kubectl get pvc` to confirm that `data-web-1` still exists and is reattached. The Pod name and its PVC are both stable across restarts.

**Exercise 3:** Create a headless Service and verify DNS. Create a headless Service (`clusterIP: None`) named `web` for the StatefulSet in Exercise 1. Deploy a busybox Pod and exec into it: `kubectl run dns-test --image=busybox:1.35 --rm -it --restart=Never -- sh`. Inside busybox, run `nslookup web-0.web.default.svc.cluster.local` and `nslookup web.default.svc.cluster.local`. Confirm the first resolves to a single Pod IP and the second resolves to all three Pod IPs.

**Exercise 4:** Run a one-off Job and monitor it to completion. Write a Job manifest that runs a busybox container with the command `echo "Job complete" && sleep 5`. Set `backoffLimit: 3` and `ttlSecondsAfterFinished: 60`. Apply it and watch `kubectl get pods -w` until the Pod shows `Completed`. Check the logs with `kubectl logs job/<name>`. Wait 60 seconds and confirm the Job and its Pod are auto-deleted.

**Exercise 5:** Create a CronJob and manually trigger it. Write a CronJob that runs every minute (`*/1 * * * *`) executing a busybox container that prints the current date. Apply it, wait about 90 seconds, and run `kubectl get jobs` to see the Jobs it created. Run `kubectl logs` on one of the completed Pods to see the date output. Then trigger it manually with `kubectl create job --from=cronjob/<name> manual-test`. Set `successfulJobsHistoryLimit: 2` and `failedJobsHistoryLimit: 1` and observe that old Jobs are pruned after new ones complete.

---

## 8. Interview Q&A

**Q: What is a StatefulSet, and how does it differ from a Deployment?**
Answer: A StatefulSet manages Pods that require stable, unique identities. Unlike a Deployment where all Pods are interchangeable replicas with random names and ephemeral storage, a StatefulSet assigns each Pod a persistent ordinal index (pod-0, pod-1, pod-2). Each Pod gets a stable DNS hostname that never changes across restarts, its own dedicated PersistentVolumeClaim created from a `volumeClaimTemplate`, and ordered startup and shutdown semantics — each Pod must be Running and Ready before the next one starts. Deployments are for stateless workloads like web servers. StatefulSets are for stateful workloads like databases, message brokers, and distributed caches where each instance has a unique identity that other instances reference by name.

**Q: What is a headless Service, and why do StatefulSets need one?**
Answer: A headless Service is a Service with `clusterIP: None`. A normal Service has a virtual IP — kube-proxy intercepts traffic to that IP and load-balances it to one of the backing Pods. You cannot target a specific Pod by name. A headless Service bypasses this virtual IP entirely: DNS queries for the Service name return the actual IP addresses of all backing Pods, and DNS queries for `<pod-name>.<service-name>.<namespace>.svc.cluster.local` return that specific Pod's IP. StatefulSets require headless Services because stateful applications often need to communicate with specific peers — a MySQL replica must connect to `mysql-0` (the primary), not just any Pod. The headless Service makes each Pod individually addressable by its stable DNS name.

**Q: What is the difference between a Job and a Deployment?**
Answer: A Deployment manages Pods that should run indefinitely — if a Pod exits (for any reason), the Deployment replaces it. There is no concept of a task being "done." A Job manages Pods that perform a finite task — it tracks successful completions and stops creating Pods once the required number of completions is reached. Pods that complete successfully are not restarted. Pods that fail are retried up to `backoffLimit` times. You use Jobs for batch processing, database migrations, backups, or any one-off computation. The critical difference in YAML is that Job Pods must have `restartPolicy: OnFailure` or `restartPolicy: Never` — they cannot use `restartPolicy: Always`.

**Q: What does concurrencyPolicy do in a CronJob, and which setting would you choose for a database backup?**
Answer: `concurrencyPolicy` controls what happens when a CronJob's schedule fires while the previous Job is still running. `Allow` starts a new Job regardless — multiple instances overlap. `Forbid` skips the new execution if the previous one is still running — only one instance ever runs at a time. `Replace` terminates the running Job and starts a fresh one. For a database backup, you would choose `Forbid`. Running two backup Jobs simultaneously against the same database could cause inconsistent dumps, double the load on the database, and consume double the storage. If the backup takes longer than the schedule interval (e.g., a large database backing up every hour but taking 90 minutes), `Forbid` ensures you never have two simultaneous backups while `Allow` would compound the problem.

**Q: How does the partition field in a StatefulSet's RollingUpdate strategy work, and why is it useful?**
Answer: The `partition` field sets a threshold ordinal — only Pods with an ordinal greater than or equal to the partition value are updated when the Pod template changes. Pods below the threshold keep the old version. Setting `partition: 2` on a 3-replica StatefulSet means only `mysql-2` gets the new image; `mysql-0` and `mysql-1` stay on the old one. This enables canary deployments for stateful applications: you update one replica (typically a read replica, not the primary), observe it for errors, then lower the partition to roll out further. For a primary-replica database topology, you typically update replicas first (partition: 1, then 0) to validate the new version before touching the primary, minimizing risk of primary downtime.

---
