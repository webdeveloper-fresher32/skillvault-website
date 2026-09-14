# Deployments — Complete Guide

## Table of Contents
1. [What is a Deployment?](#1-what-is-a-deployment)
2. [Deployment Spec YAML](#2-deployment-spec-yaml)
3. [Update Strategies — RollingUpdate vs Recreate](#3-update-strategies--rollingupdate-vs-recreate)
4. [maxSurge and maxUnavailable](#4-maxsurge-and-maxunavailable)
5. [Rolling Updates in Practice](#5-rolling-updates-in-practice)
6. [Rollback](#6-rollback)
7. [Scaling](#7-scaling)
8. [kubectl Rollout Commands](#8-kubectl-rollout-commands)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a Deployment?

A **Deployment** is the standard way to run a stateless application on Kubernetes. You describe the desired state — how many replicas, which container image, what update strategy — and the Deployment controller continuously reconciles the actual state of the cluster to match it.

You almost never create a raw Pod or even a raw ReplicaSet in production. Deployments exist because running bare Pods gives you no self-healing and no upgrade path. Running bare ReplicaSets gives you self-healing but still no rollout management. Deployments give you everything:

- **Self-healing** — if a Pod crashes, it is replaced automatically
- **Declarative updates** — change the image tag and Kubernetes handles the rollout
- **Rollback** — if a bad update goes out, revert to a previous revision in one command
- **Scaling** — change the replica count declaratively or via `kubectl scale`

### Relationship: Deployment → ReplicaSet → Pods

```
┌────────────────────────────────────────────────────┐
│                  Deployment                        │
│  spec.replicas: 3                                  │
│  spec.template: (Pod template)                     │
│  spec.strategy: RollingUpdate                      │
└───────────────────────┬────────────────────────────┘
                        │  owns and manages
                        ▼
        ┌───────────────────────────────┐
        │  ReplicaSet (current)         │
        │  web-app-7d9f8b6c4            │
        │  replicas: 3 / desired: 3     │
        └──────────┬────────────────────┘
                   │  owns
          ┌────────┼────────┐
          ▼        ▼        ▼
       Pod A    Pod B    Pod C
    (Running) (Running) (Running)
```

When you perform a rolling update, the Deployment creates a **new** ReplicaSet alongside the old one and gradually scales them in opposite directions. The old ReplicaSet is kept at 0 replicas (not deleted) so rollback is instant — it just scales the old ReplicaSet back up.

```
During a rolling update:

┌─────────────────────────────┐
│        Deployment           │
└──────────┬──────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
ReplicaSet     ReplicaSet
(old, v1)      (new, v2)
replicas: 1 ←  replicas: 3
  scaling       scaling
  down           up
```

---

## 2. Deployment Spec YAML

Below is a fully annotated Deployment manifest covering the most important fields.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app              # labels on the Deployment object itself
spec:
  replicas: 3                 # desired number of Pod replicas

  selector:
    matchLabels:
      app: web-app            # must match template.metadata.labels below
                              # immutable after creation

  strategy:
    type: RollingUpdate       # RollingUpdate (default) | Recreate
    rollingUpdate:
      maxSurge: 1             # max Pods above desired count during update
      maxUnavailable: 0       # max Pods below desired count during update

  revisionHistoryLimit: 5     # how many old ReplicaSets to keep for rollback
                              # default is 10; set lower to save etcd space

  progressDeadlineSeconds: 600  # seconds before a stalled rollout is marked Failed

  template:                   # Pod template — this is what each Pod looks like
    metadata:
      labels:
        app: web-app          # must match spec.selector.matchLabels
    spec:
      containers:
      - name: web
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"       # 250 millicores = 0.25 of one CPU core
          limits:
            memory: "128Mi"
            cpu: "500m"
        readinessProbe:       # Pod only receives traffic once this passes
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
```

```bash
# Apply the manifest
kubectl apply -f web-app-deployment.yaml

# Verify the Deployment and its Pods are healthy
kubectl get deployment web-app
# NAME      READY   UP-TO-DATE   AVAILABLE   AGE
# web-app   3/3     3            3           30s

kubectl get pods -l app=web-app
# NAME                       READY   STATUS    RESTARTS   AGE
# web-app-7d9f8b6c4-2xkfp   1/1     Running   0          30s
# web-app-7d9f8b6c4-9lmrs   1/1     Running   0          30s
# web-app-7d9f8b6c4-hnqwt   1/1     Running   0          30s

# See the ReplicaSet the Deployment created
kubectl get replicasets -l app=web-app
# NAME                 DESIRED   CURRENT   READY   AGE
# web-app-7d9f8b6c4   3         3         3       30s
```

### selector vs template labels

The `spec.selector.matchLabels` must exactly match `spec.template.metadata.labels`. Kubernetes uses the selector to find which Pods belong to this Deployment. The selector is **immutable** after creation — if you need to change it, delete and re-create the Deployment.

---

## 3. Update Strategies — RollingUpdate vs Recreate

Kubernetes supports two update strategies. The choice affects how much downtime your application experiences during a deployment.

| Aspect | RollingUpdate | Recreate |
|---|---|---|
| Downtime | Zero downtime (if configured correctly) | Brief downtime — all old Pods terminate before new ones start |
| Old and new versions running simultaneously | Yes, during the rollout window | No — clean cutover |
| Complexity | Higher — app must handle two versions at once | Lower — simpler mental model |
| Best for | Stateless apps, REST APIs, web frontends | Stateful apps, apps with incompatible DB migrations, dev environments |
| Speed | Gradual | Fast — all at once |
| Risk | Bad release reaches a percentage of traffic before rollback | All-or-nothing — bad release takes down everything |

```yaml
# RollingUpdate — default, recommended for production stateless apps
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

# Recreate — kills all old Pods first, then starts new ones
strategy:
  type: Recreate
  # no rollingUpdate block
```

### ASCII diagram: Recreate vs RollingUpdate

```
Recreate strategy (replicas: 3):

  Time →
  [Old v1] Pod A ███████████ TERM
  [Old v1] Pod B ███████████ TERM
  [Old v1] Pod C ███████████ TERM
                              ↕ gap (downtime)
  [New v2] Pod D              ████████████████
  [New v2] Pod E              ████████████████
  [New v2] Pod F              ████████████████

RollingUpdate strategy (replicas: 3, maxSurge:1, maxUnavailable:0):

  Time →
  [Old v1] Pod A ████████████████ TERM
  [Old v1] Pod B     ████████████████ TERM
  [Old v1] Pod C         ████████████████ TERM
  [New v2] Pod D     ████████████████████████
  [New v2] Pod E         ████████████████████████
  [New v2] Pod F             ████████████████████████
              ↑ always ≥ 3 Pods serving traffic
```

---

## 4. maxSurge and maxUnavailable

These two fields control the speed and availability guarantee of a rolling update. Both accept either an **absolute integer** (number of Pods) or a **percentage** of the desired replica count.

### What each controls

**maxSurge** — the maximum number of Pods that can exist *above* the desired replica count during an update. A higher value means new Pods are created faster (less time to complete the rollout) but uses more resources temporarily.

**maxUnavailable** — the maximum number of Pods that can be *below* the desired replica count (unavailable to serve traffic) during an update. Setting this to 0 means the Deployment will never drop below the desired replica count, guaranteeing full availability at all times.

### Examples with a 10-replica Deployment

| maxSurge | maxUnavailable | Max Pods during update | Min available during update | Effect |
|---|---|---|---|---|
| `1` | `0` | 11 | 10 | Safest — adds one new Pod, removes one old Pod; always full capacity |
| `0` | `1` | 10 | 9 | Lowest resource use — removes one old Pod, then adds new one |
| `2` | `2` | 12 | 8 | Fast rollout — 4 Pods changing at once; some capacity reduction |
| `25%` | `25%` | 13 | 8 | Kubernetes default — good balance of speed and availability |
| `100%` | `0` | 20 | 10 | Fastest rollout — all new Pods created before any old ones removed |

```yaml
# Zero-downtime configuration (recommended for critical services)
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

# Fast rollout for non-critical services
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 25%
```

### Important: percentages are rounded

When using percentages, maxSurge rounds **up** and maxUnavailable rounds **down**. This ensures you never accidentally go below capacity.

```
replicas: 10, maxSurge: 25%, maxUnavailable: 25%

maxSurge:       10 * 0.25 = 2.5 → rounds UP   → 3  (max Pods = 13)
maxUnavailable: 10 * 0.25 = 2.5 → rounds DOWN → 2  (min available = 8)
```

---

## 5. Rolling Updates in Practice

### Triggering an update

The most common trigger is changing the container image tag. Kubernetes detects the change in the Pod template and creates a new ReplicaSet.

```bash
# Method 1: kubectl set image (imperative — good for quick updates)
kubectl set image deployment/web-app web=nginx:1.26

# Method 2: edit the manifest and kubectl apply (declarative — recommended)
# Change image: nginx:1.25 → nginx:1.26 in the YAML file, then:
kubectl apply -f web-app-deployment.yaml

# Method 3: kubectl edit (opens live spec in your editor)
kubectl edit deployment web-app
```

Any change to `spec.template` triggers a new rollout — image, environment variables, resource limits, labels on the Pod template, etc.

### Watching a rollout unfold

```bash
# Watch rollout status in real time
kubectl rollout status deployment/web-app
# Waiting for deployment "web-app" rollout to finish: 1 out of 3 new replicas have been updated...
# Waiting for deployment "web-app" rollout to finish: 2 out of 3 new replicas have been updated...
# Waiting for deployment "web-app" rollout to finish: 1 old replicas are pending termination...
# deployment "web-app" successfully rolled out

# Watch Pods changing
kubectl get pods -l app=web-app --watch
```

### ReplicaSet handoff during a rolling update

```
Initial state — nginx:1.25 running (RS: web-app-7d9f8b6c4)

web-app-7d9f8b6c4   desired:3  current:3  ready:3
web-app-5c8b2a1f9   desired:0  current:0  ready:0   ← new RS created

Step 1: new RS scales up to 1 (maxSurge=1, so 4 Pods total is OK)

web-app-7d9f8b6c4   desired:3  current:3  ready:3
web-app-5c8b2a1f9   desired:1  current:1  ready:1

Step 2: old RS scales down to 2 (respecting maxUnavailable=0)

web-app-7d9f8b6c4   desired:2  current:2  ready:2
web-app-5c8b2a1f9   desired:2  current:2  ready:2

Step 3: new RS scales to 3, old RS scales to 1

web-app-7d9f8b6c4   desired:1  current:1  ready:1
web-app-5c8b2a1f9   desired:3  current:3  ready:3

Step 4: old RS scales to 0 — rollout complete

web-app-7d9f8b6c4   desired:0  current:0  ready:0   ← kept for rollback
web-app-5c8b2a1f9   desired:3  current:3  ready:3
```

### Revision tracking

Every rollout creates a new **revision**. The Deployment records which ReplicaSet corresponds to which revision.

```bash
kubectl rollout history deployment/web-app
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>
# 3         <none>

# Add a change cause by annotating before applying
kubectl annotate deployment/web-app kubernetes.io/change-cause="Update nginx to 1.26"

# Or pass --record (deprecated in newer versions, but widely seen)
kubectl set image deployment/web-app web=nginx:1.26 --record
```

---

## 6. Rollback

If a bad image is deployed or a rollout causes errors, roll back to a previous revision instantly.

```bash
# Roll back to the immediately previous revision
kubectl rollout undo deployment/web-app

# Roll back to a specific revision (e.g., revision 2)
kubectl rollout undo deployment/web-app --to-revision=2

# Check rollout history to find the right revision
kubectl rollout history deployment/web-app

# Inspect what a specific revision contains
kubectl rollout history deployment/web-app --revision=2
```

A rollback is itself a rollout — the old ReplicaSet scales back up using the configured update strategy, and the current one scales down.

### Simulating a bad deployment and rolling back

```bash
# Deploy a broken image
kubectl set image deployment/web-app web=nginx:this-tag-does-not-exist

# Watch Pods fail to pull
kubectl get pods -l app=web-app
# NAME                        READY   STATUS             RESTARTS   AGE
# web-app-5c8b2a1f9-hnqwt    1/1     Running            0          5m
# web-app-5c8b2a1f9-9lmrs    1/1     Running            0          5m
# web-app-5c8b2a1f9-2xkfp    1/1     Running            0          5m
# web-app-6d4a9c2b7-xrpts    0/1     ImagePullBackOff   0          30s

# Roll back immediately
kubectl rollout undo deployment/web-app

# Confirm rollback succeeded
kubectl rollout status deployment/web-app
```

### revisionHistoryLimit

Controls how many old ReplicaSets (and thus revision history entries) to keep. Default is 10.

```yaml
spec:
  revisionHistoryLimit: 5      # keep last 5 revisions; older ReplicaSets are deleted
  replicas: 3
  selector:
    matchLabels:
      app: web-app
```

Setting a lower limit saves etcd storage in large clusters. Setting it to 0 disables rollback entirely.

---

## 7. Scaling

### Manual scaling

```bash
# Scale up to 10 replicas
kubectl scale deployment/web-app --replicas=10

# Scale down to 2
kubectl scale deployment/web-app --replicas=2

# Scale only if current replica count matches (conditional scale — safer in scripts)
kubectl scale deployment/web-app --replicas=5 --current-replicas=3

# Verify
kubectl get deployment web-app
# NAME      READY   UP-TO-DATE   AVAILABLE   AGE
# web-app   10/10   10           10          15m
```

Scaling does not create a new ReplicaSet or increment the revision. The current ReplicaSet simply has its replica count changed.

### Horizontal Pod Autoscaler (HPA) preview

The Horizontal Pod Autoscaler watches CPU or memory utilization (or custom metrics) and automatically adjusts the Deployment's replica count within bounds you define.

```bash
# Create an HPA targeting 50% average CPU utilization
kubectl autoscale deployment web-app --min=2 --max=20 --cpu-percent=50

# View the HPA
kubectl get hpa web-app
# NAME      REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS
# web-app   Deployment/web-app   23%/50%   2         20        3
```

```yaml
# HPA manifest (more explicit than the imperative command)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

When an HPA is attached, avoid setting `kubectl scale` manually — the HPA will immediately override it. The HPA is covered in depth in the autoscaling phase.

---

## 8. kubectl Rollout Commands

All rollout management runs through the `kubectl rollout` subcommand family.

### kubectl rollout status

Reports whether a rollout is in progress, succeeded, or stalled. Exits with code 0 on success, 1 on failure — useful in CI/CD pipelines.

```bash
kubectl rollout status deployment/web-app
# deployment "web-app" successfully rolled out

# Block until rollout completes or timeout (default 10 minutes)
kubectl rollout status deployment/web-app --timeout=5m
```

### kubectl rollout history

Lists all recorded revisions for a Deployment.

```bash
kubectl rollout history deployment/web-app
# REVISION  CHANGE-CAUSE
# 1         Initial release nginx:1.25
# 2         Update to nginx:1.26
# 3         Update to nginx:1.27

# Inspect the full Pod template for a specific revision
kubectl rollout history deployment/web-app --revision=2
```

### kubectl rollout undo

Rolls the Deployment back to a previous revision.

```bash
# Undo the most recent rollout
kubectl rollout undo deployment/web-app

# Undo to a specific revision
kubectl rollout undo deployment/web-app --to-revision=1
```

### kubectl rollout pause

Pauses a Deployment so you can make multiple changes without triggering a rollout for each one. No new rollout starts while the Deployment is paused.

```bash
kubectl rollout pause deployment/web-app

# Make several changes — none will trigger a rollout yet
kubectl set image deployment/web-app web=nginx:1.27
kubectl set env deployment/web-app LOG_LEVEL=debug
kubectl set resources deployment/web-app -c=web --limits=cpu=1,memory=256Mi
```

### kubectl rollout resume

Resumes a paused Deployment. All accumulated changes are applied in a single rollout.

```bash
kubectl rollout resume deployment/web-app
# deployment.apps/web-app resumed

kubectl rollout status deployment/web-app
# Waiting for deployment "web-app" rollout to finish...
# deployment "web-app" successfully rolled out
```

### kubectl rollout restart

Forces a new rollout without any change to the Pod template spec. Useful to cycle Pods and pick up changes in a referenced ConfigMap or Secret, or to clear memory pressure across a Deployment.

```bash
kubectl rollout restart deployment/web-app
# deployment.apps/web-app restarted

# This adds a restartedAt annotation to the Pod template, triggering a new RS
kubectl describe deployment web-app | grep restartedAt
```

### Summary table

| Command | What it does |
|---|---|
| `kubectl rollout status` | Show current rollout progress; block until complete |
| `kubectl rollout history` | List revision history; inspect a specific revision |
| `kubectl rollout undo` | Roll back to previous or specified revision |
| `kubectl rollout pause` | Halt rollout triggering; batch multiple changes |
| `kubectl rollout resume` | Apply all batched changes in one rollout |
| `kubectl rollout restart` | Force re-rollout without spec change |

---

## 9. Hands-On Exercises

**Exercise 1:** Create the web-app Deployment from Section 2 with 3 replicas running `nginx:1.25`. Verify that the Deployment, ReplicaSet, and three Pods are all healthy. Use `kubectl get all -l app=web-app` to see everything in one view. Then use `kubectl describe deployment web-app` to find the Events section and confirm the scaling events were recorded.

**Exercise 2:** Perform a rolling update from `nginx:1.25` to `nginx:1.26` using `kubectl set image`. Immediately run `kubectl rollout status deployment/web-app` in a second terminal to watch the rollout progress in real time. In a third terminal, run `kubectl get pods -l app=web-app --watch` and observe old Pods terminating and new Pods starting. After the rollout completes, run `kubectl get replicasets` and confirm two ReplicaSets exist — the old one at 0 replicas, the new one at 3.

**Exercise 3:** Deploy a broken image update with `kubectl set image deployment/web-app web=nginx:999-does-not-exist`. Watch `kubectl get pods -l app=web-app` and observe the new Pod enter `ImagePullBackOff`. Confirm the Deployment stalls (it respects maxUnavailable=0, so the old Pods keep running). Roll back with `kubectl rollout undo deployment/web-app` and verify the good image is restored. Check `kubectl rollout history deployment/web-app` to see the revision list.

**Exercise 4:** Scale the Deployment from 3 replicas to 6 using `kubectl scale`, then back down to 2. After each scale operation, run `kubectl get pods -l app=web-app` to confirm the correct number of Pods. Then run `kubectl get replicasets` and confirm only one ReplicaSet exists (scaling does not create new ReplicaSets). Finally, edit the Deployment manifest to set `replicas: 4` and apply it with `kubectl apply` — verify this also works.

**Exercise 5:** Practice pausing and resuming a rollout. Pause the Deployment with `kubectl rollout pause deployment/web-app`. Then run two changes: update the image to `nginx:1.27` and add an environment variable `APP_ENV=production` using `kubectl set env`. Confirm no rollout has started yet with `kubectl rollout status`. Resume with `kubectl rollout resume deployment/web-app` and watch both changes apply in a single rollout. Verify the final Pods have the new image and environment variable using `kubectl describe pod <pod-name>`.

---

## 10. Interview Q&A

**Q: What is a Kubernetes Deployment and why should you use it instead of creating Pods or ReplicaSets directly?**
Answer: A Deployment is a higher-level controller that manages a ReplicaSet, which in turn manages a set of Pods. Creating raw Pods gives you no self-healing — if a Pod dies, nothing replaces it. A raw ReplicaSet adds self-healing but has no built-in concept of updates or rollback. A Deployment adds declarative rolling updates, revision history, and rollback on top of the ReplicaSet mechanism. When you change the Pod template (for example, a new image tag), the Deployment creates a new ReplicaSet and orchestrates the transition, keeping the old ReplicaSet at 0 replicas for instant rollback if needed. In production you should always use a Deployment (or StatefulSet/DaemonSet for stateful or per-node workloads) rather than managing ReplicaSets directly.

**Q: Explain the RollingUpdate strategy. How does it ensure zero downtime?**
Answer: When a rolling update is triggered, the Deployment controller creates a new ReplicaSet for the updated Pod template. It then iterates: scale the new ReplicaSet up by `maxSurge` Pods, wait for them to pass their readinessProbe, then scale the old ReplicaSet down by the same amount, respecting the `maxUnavailable` limit. This continues until the new ReplicaSet is at the desired replica count and the old one is at zero. Zero downtime is achieved by setting `maxUnavailable: 0` — the controller will never remove an old Pod until a new Pod is ready and passing its readiness probe. The readinessProbe is critical here: Kubernetes only removes a Pod from service when the incoming Pod is confirmed healthy and receiving traffic.

**Q: What are maxSurge and maxUnavailable, and how do you choose values for them?**
Answer: `maxSurge` controls how many extra Pods can exist above the desired count during a rollout — a higher value creates new Pods faster at the cost of temporarily using more resources. `maxUnavailable` controls how many Pods can be below the desired count during a rollout — setting it to 0 guarantees you never drop below full capacity. To choose values, consider your workload's tolerance for reduced capacity and your cluster's spare resource headroom. For critical production services with tight SLOs, set `maxSurge: 1` and `maxUnavailable: 0` — safest, no capacity drop, but slowest. For non-critical services where a brief capacity drop is acceptable, use `maxSurge: 25%` and `maxUnavailable: 25%` (the Kubernetes default) for a faster rollout. Both accept absolute integers or percentages; percentages are useful when the replica count varies due to an HPA.

**Q: How do you roll back a Deployment, and what actually happens under the hood?**
Answer: Run `kubectl rollout undo deployment/<name>` to roll back to the previous revision, or `kubectl rollout undo deployment/<name> --to-revision=<N>` to target a specific one. Under the hood, a rollback is simply another rolling update — the controller scales the target old ReplicaSet back up and scales the current one down, using the same maxSurge and maxUnavailable settings. This is why old ReplicaSets are kept at 0 replicas rather than deleted after a rollout. The number of old ReplicaSets retained is controlled by `revisionHistoryLimit` (default 10). Rollback is fast because the old ReplicaSet and its Pod template already exist in etcd; Kubernetes only needs to adjust replica counts rather than create new objects.

**Q: What is the relationship between a Deployment, a ReplicaSet, and a Pod in Kubernetes?**
Answer: A Deployment owns one or more ReplicaSets (usually one active, others at zero replicas for rollback). A ReplicaSet owns a set of Pods whose labels match its selector. The Deployment controller watches for changes to `spec.template` and creates a new ReplicaSet when the template changes. The ReplicaSet controller ensures the actual number of Pods matching its selector always equals `spec.replicas`, replacing any Pods that fail or are deleted. The Pod is the actual unit of execution — it runs the containers. Each object in the chain delegates to the one below it: Deployment handles updates and history, ReplicaSet handles steady-state replica count, and Pods handle running the workload. You can see this ownership chain with `kubectl get pods -o yaml` — each Pod's `ownerReferences` field names its parent ReplicaSet, and each ReplicaSet's `ownerReferences` field names its parent Deployment.
