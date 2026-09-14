# Pod Lifecycle — Complete Guide

## Table of Contents
1. [Pod Phases Overview](#1-pod-phases-overview)
2. [Container States](#2-container-states)
3. [Pod Phase Transition Diagram](#3-pod-phase-transition-diagram)
4. [Restart Policy](#4-restart-policy)
5. [Liveness Probes](#5-liveness-probes)
6. [Readiness Probes](#6-readiness-probes)
7. [Startup Probes](#7-startup-probes)
8. [Init Containers](#8-init-containers)
9. [Pod Conditions](#9-pod-conditions)
10. [Common Failures and Debugging](#10-common-failures-and-debugging)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Pod Phases Overview

A Pod's **phase** is a high-level summary of where the Pod is in its lifecycle. Kubernetes reports this in `pod.status.phase`. There are exactly five possible phases:

| Phase | Description | How You Get There |
|---|---|---|
| **Pending** | Pod accepted by the cluster but not yet running. Containers not started. | Pod created; scheduler searching for a suitable node; images being pulled |
| **Running** | Pod bound to a node; at least one container is running (or starting/restarting) | Scheduler assigned a node; kubelet started all containers |
| **Succeeded** | All containers terminated successfully (exit code 0) and will not be restarted | Batch/Job workloads that finish cleanly; `restartPolicy: Never` or `OnFailure` |
| **Failed** | All containers have terminated; at least one terminated with non-zero exit code or was killed by the system | Container crashes, OOM kills, or manually deleted while running |
| **Unknown** | Pod state cannot be determined — typically the node hosting the Pod lost contact with the API server | Node network partition, kubelet crash, node power loss |

```
# Check a pod's phase:
kubectl get pod my-pod -o jsonpath='{.status.phase}'

# Watch phase changes in real time:
kubectl get pod my-pod -w

# Get full status including conditions:
kubectl describe pod my-pod
```

**Important distinction:** Phase is NOT the same as whether your application is healthy. A Pod can be in the `Running` phase while the application inside it is deadlocked or serving errors. That is why probes exist (covered in sections 5–7).

---

## 2. Container States

While Pod phase describes the overall Pod, each **individual container** has its own state reported in `pod.status.containerStatuses[*].state`:

| State | Description | Common Reasons |
|---|---|---|
| **Waiting** | Container is not running yet — waiting for something to happen | Image pull in progress; init containers still running; `CrashLoopBackOff` back-off timer active |
| **Running** | Container is executing; `startedAt` timestamp is set | Normal operation after successful start |
| **Terminated** | Container finished execution (success or failure); has `exitCode`, `reason`, `startedAt`, `finishedAt` | Process exited (any exit code), OOMKilled, container was stopped |

```
# Inspect container states:
kubectl get pod my-pod -o jsonpath='{.status.containerStatuses[*].state}'

# See last termination reason (useful for crash debugging):
kubectl get pod my-pod -o jsonpath='{.status.containerStatuses[0].lastState}'

# Human-readable via describe:
kubectl describe pod my-pod | grep -A 10 "State:"
```

**Waiting reasons you'll see often:**

```
ContainerCreating      - pulling image or creating volumes
PodInitializing        - init containers still running
CrashLoopBackOff       - container keeps crashing; K8s is applying back-off
ImagePullBackOff       - cannot pull image; applying back-off before retry
ErrImagePull           - image pull failed (first failure, before back-off)
CreateContainerError   - container runtime error (bad config, missing secret)
```

---

## 3. Pod Phase Transition Diagram

```
                         kubectl apply / Pod created
                                    │
                                    ▼
                          ┌─────────────────┐
                          │    PENDING      │
                          │                 │
                          │  • Scheduling   │
                          │  • Image pull   │
                          │  • Init ctrs    │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  All init containers done,   │
                    │  images pulled, node ready   │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                 ┌────────│    RUNNING      │────────┐
                 │        │                 │        │
                 │        │  • App ctrs     │        │
                 │        │    executing    │        │
                 │        └─────────────────┘        │
                 │                 │                 │
                 │   All ctrs      │         Container
                 │   exit 0, no   │         crash / OOM
                 │   restarts due │         non-zero exit
                 │   (Never/OnF.) │                 │
                 ▼                ▼                 ▼
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │  SUCCEEDED  │  │  (restart   │  │   FAILED    │
        │             │  │   policy    │  │             │
        │  All exit 0 │  │   → RUNNING │  │  Non-zero   │
        │  Permanent  │  │   again)    │  │  exit code  │
        └─────────────┘  └─────────────┘  └─────────────┘

        ┌─────────────────────────────────┐
        │           UNKNOWN               │
        │  Node unreachable / kubelet     │
        │  lost contact with API server   │
        └─────────────────────────────────┘
              (can transition from any state)
```

**Key insight:** A container crash under `restartPolicy: Always` keeps the Pod in `Running` phase even while restarting. The Pod phase doesn't become `Failed` until all containers have terminated with no more restarts allowed.

---

## 4. Restart Policy

`restartPolicy` is set at the **Pod level** (not per-container) and controls what Kubernetes does when a container inside the Pod exits.

### The Three Policies

| Policy | On Success (exit 0) | On Failure (exit != 0) | Typical Use Case |
|---|---|---|---|
| **Always** | Restart | Restart | Long-running services (web servers, APIs, workers) |
| **OnFailure** | Do NOT restart | Restart | Batch jobs that should succeed once and stop |
| **Never** | Do NOT restart | Do NOT restart | One-shot tasks, debugging, migration scripts |

### YAML Examples

**Always (default for Deployments):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
spec:
  restartPolicy: Always        # default; explicit here for clarity
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
```

**OnFailure (for Jobs):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  restartPolicy: OnFailure     # retry on crash, stop on success
  containers:
  - name: processor
    image: myapp/processor:2.1
    command: ["python", "process.py"]
```

**Never (one-shot / debugging):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-migration
spec:
  restartPolicy: Never         # run once, succeed or fail, done
  containers:
  - name: migrator
    image: myapp/migrator:1.0
    command: ["python", "migrate.py", "--run"]
```

**Important note:** Deployments, DaemonSets, and StatefulSets only support `restartPolicy: Always`. Jobs support `OnFailure` and `Never`. If you set `Never` on a Deployment's pod template, Kubernetes will reject it.

---

## 5. Liveness Probes

A **liveness probe** answers: "Is this container alive and should it keep running?"

If a liveness probe fails, Kubernetes **kills the container and restarts it** (subject to restartPolicy). This handles deadlocked processes that are running but not making progress — without probes, Kubernetes would never know.

### Probe Types

**httpGet — HTTP endpoint check:**
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
    - name: Custom-Header
      value: liveness-check
  initialDelaySeconds: 15    # wait before first probe
  periodSeconds: 10          # probe every 10s
  timeoutSeconds: 5          # fail if no response in 5s
  failureThreshold: 3        # fail 3 times before restart
  successThreshold: 1        # 1 success = healthy (liveness must be 1)
```

**exec — Run a command inside the container:**
```yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy          # file must exist for app to be considered alive
  initialDelaySeconds: 5
  periodSeconds: 5
```

**tcpSocket — TCP port open check:**
```yaml
livenessProbe:
  tcpSocket:
    port: 3306              # MySQL port must be open
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
```

### What Happens on Probe Failure

```
                    ┌─────────────────────────────┐
                    │      Running Container       │
                    └──────────────┬──────────────┘
                                   │
                          Liveness probe
                          fires every periodSeconds
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
           HTTP 200                               HTTP 500 / timeout
           (or exit 0                             (or exit != 0
            or port open)                          or port closed)
              │                                         │
              ▼                                         ▼
      ┌───────────────┐                    ┌────────────────────────┐
      │ successCount  │                    │ failureCount++         │
      │ reset to 0    │                    │                        │
      │ (stays alive) │                    │ if failureCount >=     │
      └───────────────┘                    │ failureThreshold:      │
                                           │                        │
                                           │  kubelet KILLS ctr     │
                                           │  (SIGTERM → SIGKILL)   │
                                           │                        │
                                           │  restartPolicy applies │
                                           │  → container restarts  │
                                           └────────────────────────┘
```

**Full liveness probe example with a realistic app:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-liveness
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    ports:
    - containerPort: 8080
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 30  # give app 30s to start before first probe
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3      # 30s of failures before restart
```

---

## 6. Readiness Probes

A **readiness probe** answers: "Is this container ready to receive traffic?"

If a readiness probe fails, Kubernetes **removes the Pod's IP from the Service endpoints** — it stops sending traffic to it — but does NOT restart the container. The Pod stays running, just isolated from traffic until it passes again.

### Key Difference from Liveness

```
Liveness failure  → RESTART the container (nuclear option)
Readiness failure → REMOVE from load balancer (traffic isolation)

Use liveness for:  "Is the process alive and healthy?"
Use readiness for: "Is the app ready to handle requests right now?"
```

### Traffic Flow with Readiness Probe

```
                          Kubernetes Service
                         ┌──────────────────┐
                         │  Load Balancer   │
                         └────────┬─────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
               ▼                  ▼                  ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   Pod A         │ │   Pod B         │ │   Pod C         │
    │  Readiness: ✓   │ │  Readiness: ✗   │ │  Readiness: ✓   │
    │  (in endpoints) │ │  (REMOVED from  │ │  (in endpoints) │
    │                 │ │   endpoints)    │ │                 │
    │  Gets traffic   │ │  No traffic     │ │  Gets traffic   │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                    Pod B is still Running,
                    still exists, just not
                    receiving any requests.
                    Will re-join when probe passes.
```

### Readiness Probe YAML Examples

**httpGet readiness:**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
  successThreshold: 1
```

**exec readiness (check DB connection file):**
```yaml
readinessProbe:
  exec:
    command:
    - sh
    - -c
    - "pg_isready -h localhost -p 5432"
  initialDelaySeconds: 10
  periodSeconds: 5
```

**Both probes together (best practice):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: production-app
spec:
  containers:
  - name: app
    image: myapp:2.0
    ports:
    - containerPort: 8080
    livenessProbe:
      httpGet:
        path: /healthz         # lightweight: is process alive?
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready           # thorough: DB connected? cache warm?
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 3
      successThreshold: 1
```

---

## 7. Startup Probes

A **startup probe** answers: "Has the application finished starting up?"

Some applications (JVM apps, large ML models, legacy monoliths) take a long time to initialize. If you set `initialDelaySeconds` too short on a liveness probe, Kubernetes kills the app before it finishes starting. If you set it too long, you have slow failure detection in production.

### How Startup Probes Gate Other Probes

```
Container starts
      │
      ▼
┌─────────────────────────────────────────────────┐
│  STARTUP PROBE runs                             │
│                                                 │
│  Liveness probe: DISABLED  ──── (gated)         │
│  Readiness probe: DISABLED ──── (gated)         │
│                                                 │
│  App has up to:                                 │
│  failureThreshold × periodSeconds to start      │
└──────────────────────────────────┬──────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
         Startup probe                           Startup probe
         SUCCEEDS                                FAILS (threshold hit)
              │                                         │
              ▼                                         ▼
  ┌────────────────────────┐               ┌──────────────────────┐
  │  Startup probe stops   │               │  Container KILLED    │
  │  Liveness ENABLED  ────│               │  and restarted       │
  │  Readiness ENABLED ────│               │  (never got past     │
  │                        │               │   startup phase)     │
  │  Normal probe cycle    │               └──────────────────────┘
  │  begins                │
  └────────────────────────┘
```

### Max Startup Time Formula

```
max startup time = failureThreshold × periodSeconds

Example:
  failureThreshold: 30
  periodSeconds: 10
  → 30 × 10 = 300 seconds (5 minutes) to start
```

### Startup Probe YAML Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: slow-starting-app
spec:
  containers:
  - name: legacy-app
    image: legacy-monolith:5.2
    ports:
    - containerPort: 8080
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30     # 30 × 10s = 5 minutes to start
      periodSeconds: 10
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      periodSeconds: 10        # only runs AFTER startup probe passes
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
```

**Without startup probe (wrong approach):**
```yaml
# BAD: forces a 5-minute delay before any liveness check
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 300   # blunt instrument; slow to detect real failures
  periodSeconds: 10
```

Using a startup probe, liveness kicks in 10 seconds after startup completes — much faster failure detection in production while still allowing slow startup.

---

## 8. Init Containers

**Init containers** are specialized containers that run and complete **before any app containers start**. They run sequentially, one at a time, in the order defined. If any init container fails, Kubernetes restarts it (per restartPolicy) until it succeeds — the app containers never start until all init containers have exited successfully with code 0.

### Key Properties

```
Init container properties:
  ✓ Run to completion before app containers start
  ✓ Run sequentially (init-1 must finish before init-2 starts)
  ✓ Separate image from app container (can have tools not in app image)
  ✓ Share volumes with app containers (for pre-populating data)
  ✓ Can run as a different user/security context than app containers
  ✗ Do NOT support probes (livenessProbe, readinessProbe, startupProbe)
  ✗ Cannot be restarted independently once app containers are running
```

### Use Cases

```
Common init container patterns:

1. Wait for dependency (database, message queue):
   init: "until pg_isready; do sleep 2; done"
   app: starts knowing DB is available

2. Database schema migration:
   init: "python manage.py migrate"
   app: Django app starts on migrated schema

3. Clone configuration from git:
   init: "git clone https://config-repo /etc/app-config"
   app: reads config from shared volume

4. Generate TLS certificates:
   init: "certgen --output /certs"
   app: reads certs from shared volume

5. Set kernel parameters (requires privileged):
   init: "sysctl -w vm.max_map_count=262144"
   app: Elasticsearch starts with correct OS settings
```

### Startup Sequence Diagram

```
Pod created
    │
    ▼
┌───────────────────────────────────────────────────────┐
│  INIT CONTAINER 1: wait-for-db                        │
│  image: busybox                                        │
│  command: until pg_isready; do sleep 2; done          │
│                                                       │
│  Status: Running → (loops until DB is ready) →        │
│  Status: Succeeded (exit 0)                           │
└───────────────────────────┬───────────────────────────┘
                            │  init-1 done
                            ▼
┌───────────────────────────────────────────────────────┐
│  INIT CONTAINER 2: run-migrations                     │
│  image: myapp-migrator:1.0                            │
│  command: python manage.py migrate                    │
│                                                       │
│  Status: Running → (applies DB migrations) →          │
│  Status: Succeeded (exit 0)                           │
└───────────────────────────┬───────────────────────────┘
                            │  init-2 done
                            ▼
┌───────────────────────────────────────────────────────┐
│  INIT CONTAINER 3: clone-config                       │
│  image: alpine/git:latest                             │
│  command: git clone https://... /config               │
│                                                       │
│  Status: Running → (clones repo to shared vol) →      │
│  Status: Succeeded (exit 0)                           │
└───────────────────────────┬───────────────────────────┘
                            │  ALL init containers done
                            ▼
┌───────────────────────────────────────────────────────┐
│  APP CONTAINER: my-django-app                         │
│  image: myapp:3.0                                     │
│  (DB is ready, schema migrated, config available)     │
│                                                       │
│  Status: Running                                      │
└───────────────────────────────────────────────────────┘
```

### Full YAML Example with Multiple Init Containers

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: django-app
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.35
    command:
    - sh
    - -c
    - |
      echo "Waiting for PostgreSQL..."
      until nc -z postgres-service 5432; do
        echo "DB not ready, sleeping 2s"
        sleep 2
      done
      echo "DB is ready!"

  - name: run-migrations
    image: myapp/migrator:1.0
    command: ["python", "manage.py", "migrate", "--no-input"]
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url
    volumeMounts:
    - name: app-code
      mountPath: /app

  - name: clone-config
    image: alpine/git:2.40.1
    command:
    - git
    - clone
    - https://github.com/myorg/app-config.git
    - /config
    volumeMounts:
    - name: config-volume
      mountPath: /config

  containers:
  - name: django-app
    image: myapp:3.0
    ports:
    - containerPort: 8000
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url
    volumeMounts:
    - name: app-code
      mountPath: /app
    - name: config-volume
      mountPath: /etc/app-config

  volumes:
  - name: app-code
    emptyDir: {}
  - name: config-volume
    emptyDir: {}
```

```
# Check init container status:
kubectl get pod django-app -o jsonpath='{.status.initContainerStatuses[*].state}'

# See init container logs:
kubectl logs django-app -c wait-for-db
kubectl logs django-app -c run-migrations

# Watch pod startup (you'll see initContainers: 0/3 → 1/3 → 2/3 → 3/3 → Running):
kubectl get pod django-app -w
```

---

## 9. Pod Conditions

Pod conditions are boolean True/False signals that together describe the Pod's full operational status. They appear in `pod.status.conditions[]` and are reported in order.

| Condition | Meaning | Set to True When |
|---|---|---|
| **PodScheduled** | Pod has been assigned to a node | Scheduler finds a suitable node |
| **Initialized** | All init containers completed successfully | Every init container exits with code 0 |
| **ContainersReady** | All containers in the Pod are ready | All app container readiness probes pass |
| **Ready** | Pod is ready to receive traffic | `ContainersReady` is True AND any custom readiness gates pass |

```
# Inspect conditions in raw form:
kubectl get pod my-pod -o jsonpath='{.status.conditions}' | python3 -m json.tool

# Human-readable output from describe:
kubectl describe pod my-pod

# Example describe output for conditions:
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
```

**Diagnosing stuck conditions:**

```
PodScheduled = False  → pod can't find a node
  Check: kubectl describe pod <name> | grep Events
  Common cause: Insufficient CPU/memory, taint mismatch, no matching node selector

Initialized = False   → init container is failing or still running
  Check: kubectl logs <pod> -c <init-container-name>
  kubectl describe pod <name> | grep -A 5 "Init Containers"

ContainersReady = False → readiness probe failing
  Check: kubectl describe pod <name> | grep -A 10 "Readiness"
  kubectl logs <pod>

Ready = False          → usually follows ContainersReady
  Check: kubectl get endpoints <service-name>
  (Pod won't appear in service endpoints)
```

---

## 10. Common Failures and Debugging

### CrashLoopBackOff

`CrashLoopBackOff` means: the container keeps crashing and Kubernetes is deliberately slowing down restart attempts using exponential back-off.

**Exponential back-off timing:**

| Restart Attempt | Back-off Wait | Cumulative Time |
|---|---|---|
| 1st restart | 10 seconds | 10s |
| 2nd restart | 20 seconds | 30s |
| 3rd restart | 40 seconds | 70s |
| 4th restart | 80 seconds | 150s |
| 5th restart | 160 seconds | 310s |
| 6th+ restart | 300 seconds (max) | caps at 5 min between attempts |

Back-off resets to 10s if the container runs successfully for 10 minutes.

**Debugging CrashLoopBackOff:**
```bash
# Step 1: See what's happening
kubectl describe pod crashing-pod

# Step 2: Read the current logs (if container is running briefly)
kubectl logs crashing-pod

# Step 3: Read previous container's logs (after crash)
kubectl logs crashing-pod --previous

# Step 4: Check the exit code
kubectl get pod crashing-pod -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'

# Step 5: Override entrypoint to debug interactively
kubectl run debug-pod --image=myapp:1.0 --restart=Never -it --command -- /bin/sh
```

**Common root causes:**
```
Exit Code 1        → Application error (check app logs)
Exit Code 137      → OOMKilled (process killed by kernel for using too much RAM)
Exit Code 139      → Segmentation fault
Exit Code 143      → SIGTERM (graceful kill, expected during shutdown)
Exit Code 255      → Entrypoint script syntax error or file not found
```

### OOMKilled (Exit Code 137)

```yaml
# Container was killed because it exceeded its memory limit
# Check with:
kubectl describe pod oom-pod | grep -A 3 "OOMKilled"

# Container status will show:
# State: Terminated
# Reason: OOMKilled
# Exit Code: 137

# Fix: increase memory limit or fix memory leak
resources:
  requests:
    memory: "128Mi"
  limits:
    memory: "512Mi"    # OOMKill happens when usage exceeds this
```

### ImagePullBackOff

```bash
# Root causes:
# 1. Image name/tag typo
# 2. Image doesn't exist in registry
# 3. Private registry — no imagePullSecret configured
# 4. Registry is down or rate-limited

# Diagnose:
kubectl describe pod imagepull-pod | grep -A 10 Events

# Common events you'll see:
# Failed to pull image: rpc error: ... not found
# Failed to pull image: ... unauthorized: authentication required

# Fix for private registry:
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=me@example.com

# Then reference in pod spec:
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: myprivateregistry/myapp:1.0
```

### General Debugging Workflow

```
Pod not working?
      │
      ▼
kubectl get pod <name>       ← check Phase and STATUS column
      │
      ├── Pending ──────────► kubectl describe pod <name> | grep Events
      │                        (look for: Insufficient CPU, Unschedulable,
      │                         FailedScheduling, taint issues)
      │
      ├── CrashLoopBackOff ► kubectl logs <pod> --previous
      │                        kubectl describe pod <name>
      │                        (check exit code, lastState)
      │
      ├── Running (no traffic)► kubectl describe pod <name> | grep Readiness
      │                          kubectl get endpoints <service>
      │                          (pod might be failing readiness probe)
      │
      └── ImagePullBackOff ► kubectl describe pod <name> | grep -A 5 Events
                              (check image name, registry auth)
```

---

## 11. Hands-On Exercises

**Exercise 1: Create a Pod with a Liveness Probe and Trigger a Restart**

Create a pod that will deliberately start healthy and then fail:
```yaml
# liveness-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-demo
spec:
  containers:
  - name: app
    image: busybox:1.35
    args:
    - /bin/sh
    - -c
    - |
      touch /tmp/healthy
      sleep 30
      rm -f /tmp/healthy
      sleep 600
    livenessProbe:
      exec:
        command:
        - cat
        - /tmp/healthy
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
```
```bash
kubectl apply -f liveness-demo.yaml
kubectl get pod liveness-demo -w    # watch it restart after ~45s
kubectl describe pod liveness-demo  # look at Events for "Killing" entries
kubectl get pod liveness-demo -o jsonpath='{.status.containerStatuses[0].restartCount}'
```

**Exercise 2: Trigger CrashLoopBackOff and Debug It**

```bash
# Create a deliberately crashing pod
kubectl run crasher \
  --image=busybox:1.35 \
  --restart=Always \
  -- /bin/sh -c "echo 'crashing now'; exit 1"

# Watch back-off behavior
kubectl get pod crasher -w

# Read the crash logs
kubectl logs crasher --previous

# Check exit code and restart count
kubectl describe pod crasher | grep -E "Exit Code|Restart Count|State"

# Clean up
kubectl delete pod crasher
```

**Exercise 3: Use an Init Container to Wait for a Service**

```yaml
# init-wait-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
spec:
  initContainers:
  - name: wait-for-service
    image: busybox:1.35
    command:
    - sh
    - -c
    - |
      echo "Checking for myservice..."
      until nslookup myservice.default.svc.cluster.local; do
        echo "Service not ready, waiting 3s..."
        sleep 3
      done
      echo "Service found!"
  containers:
  - name: main-app
    image: nginx:1.25
    ports:
    - containerPort: 80
```
```bash
kubectl apply -f init-wait-demo.yaml
kubectl get pod app-with-init -w           # watch: Init:0/1 → Init:1/1 → Running
kubectl logs app-with-init -c wait-for-service  # see the wait loop output
```

**Exercise 4: Configure a Startup Probe for a Slow Application**

```yaml
# startup-probe-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: slow-app
spec:
  containers:
  - name: slow-starter
    image: busybox:1.35
    command:
    - /bin/sh
    - -c
    - |
      echo "Simulating slow startup (40s)..."
      sleep 40
      echo "App started, serving on 8080"
      # Create a health file after startup
      touch /tmp/started
      sleep 3600
    startupProbe:
      exec:
        command: ["cat", "/tmp/started"]
      failureThreshold: 12      # 12 × 5s = 60s max startup time
      periodSeconds: 5
    livenessProbe:
      exec:
        command: ["cat", "/tmp/started"]
      periodSeconds: 10
      failureThreshold: 3
```
```bash
kubectl apply -f startup-probe-demo.yaml
kubectl get pod slow-app -w         # stays Running during 40s startup window
kubectl describe pod slow-app       # no "Killing" events during startup
```

**Exercise 5: Inspect Pod Conditions and Diagnose a Pending Pod**

```bash
# Create an intentionally unschedulable pod (requests more RAM than available)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: unschedulable-pod
spec:
  containers:
  - name: memory-hog
    image: nginx:1.25
    resources:
      requests:
        memory: "999Gi"   # more than any node has
EOF

# Inspect the pod conditions
kubectl get pod unschedulable-pod -o jsonpath='{.status.conditions}' | python3 -m json.tool

# Look for PodScheduled = False
kubectl describe pod unschedulable-pod | grep -A 5 Conditions
kubectl describe pod unschedulable-pod | grep -A 10 Events

# Clean up
kubectl delete pod unschedulable-pod
```

---

## 12. Interview Q&A

**Q: What are the five Pod phases in Kubernetes and what does each mean?**

Answer: The five Pod phases are: **Pending** (Pod accepted by cluster, containers not yet running — waiting for scheduling, image pull, or init containers to complete); **Running** (Pod is bound to a node and at least one container is running); **Succeeded** (all containers exited with code 0 and won't restart — common for batch jobs); **Failed** (all containers terminated and at least one exited with non-zero code or was killed); **Unknown** (Pod state cannot be determined, typically because the node running it is unreachable). Phase is a high-level summary; for detailed status you also look at container states and Pod conditions.

---

**Q: What is the difference between a liveness probe and a readiness probe?**

Answer: A **liveness probe** determines if a container is alive. If it fails, Kubernetes kills and restarts the container. Use it to detect deadlocks or hung processes — situations where the process is running but not making progress. A **readiness probe** determines if a container is ready to receive traffic. If it fails, Kubernetes removes the Pod from the Service's endpoints (no traffic is routed to it) but does NOT restart it. Use it to signal "I'm temporarily busy" — during startup, cache warming, or when downstream dependencies are unavailable. The practical rule: liveness probe failure = restart the container; readiness probe failure = stop sending traffic, but let the container keep running and recover.

---

**Q: What is CrashLoopBackOff and how do you debug it?**

Answer: `CrashLoopBackOff` means a container is repeatedly crashing and Kubernetes is applying exponential back-off between restart attempts to avoid thrashing — starting at 10 seconds, doubling each time (10s → 20s → 40s → 80s → 160s → 300s max). To debug: first run `kubectl logs <pod> --previous` to see the logs from the crashed container (the current one might be in back-off), then `kubectl describe pod <pod>` to see the exit code in `lastState.terminated`. Common causes include: application startup errors (exit code 1), missing environment variables or secrets, OOM kills (exit code 137), and bad entrypoint commands. Fix the root cause in the image or configuration, then redeploy.

---

**Q: What are init containers and when would you use them?**

Answer: Init containers are specialized containers that run sequentially to completion before any app containers start. They share the Pod's volumes and network but have separate images and can run with different permissions. You use them when your app has prerequisites that must be satisfied before startup: waiting for a database to be ready (`until pg_isready`), running database schema migrations before the app starts, cloning configuration from a git repo into a shared volume, or setting kernel parameters that require elevated privileges. The guarantee init containers provide is sequential, ordered, blocking startup — init-1 must succeed before init-2 starts, and all init containers must succeed before any app containers start.

---

**Q: What is a startup probe and why is it needed when you already have a liveness probe?**

Answer: A startup probe solves the problem of slow-starting applications. Without it, you face a dilemma: set `initialDelaySeconds` short and Kubernetes kills the app before it finishes starting; set it long and you have slow failure detection in production. A startup probe disables the liveness and readiness probes while it runs, giving the app up to `failureThreshold × periodSeconds` seconds to start (e.g., 30 × 10s = 5 minutes). Once the startup probe succeeds, it disables itself and the liveness probe kicks in immediately with its normal short interval. This gives slow apps (JVM, ML models, legacy monoliths) a generous startup window while keeping fast failure detection once the app is running.
