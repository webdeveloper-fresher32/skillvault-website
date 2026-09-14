# Pod Fundamentals — Complete Guide

## Table of Contents
1. [What is a Pod](#1-what-is-a-pod)
2. [Pod Spec (YAML)](#2-pod-spec-yaml)
3. [Shared Network Namespace](#3-shared-network-namespace)
4. [Shared Storage (Volumes)](#4-shared-storage-volumes)
5. [Resource Requests and Limits](#5-resource-requests-and-limits)
6. [Labels and Selectors](#6-labels-and-selectors)
7. [Annotations](#7-annotations)
8. [kubectl Commands](#8-kubectl-commands)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a Pod

A **Pod** is the smallest deployable unit in Kubernetes. It is a logical host for one or more containers that share a network namespace, a set of storage volumes, and a lifecycle. Kubernetes schedules, starts, stops, and restarts Pods as a single atomic unit — you never schedule individual containers directly.

### The Analogy

Think of a Pod as a lightweight virtual machine. The containers inside it are like processes running on that VM — they all share the same IP address and can talk to each other over `localhost`, but they are still isolated from containers in other Pods. When the VM (Pod) goes away, all its processes (containers) go with it.

### Why Pods, Not Just Containers?

Kubernetes could have scheduled raw containers, but Pods solve real co-location problems:

```
Without Pods — tight coupling hidden in infra config:
  Container A (app)    ───────────────────────────────────────────
  Container B (log shipper)  separately scheduled, may land on different nodes
                             → can't share a local socket or volume

With Pods — co-location is a first-class concept:
  Pod ┌──────────────────────────────────────────────────────┐
      │  Container A (app)   +  Container B (log shipper)    │
      │  Same node ✓   Same network ✓   Same volume ✓        │
      └──────────────────────────────────────────────────────┘

Both containers start together, stop together, restart together.
No configuration tricks needed to keep them on the same host.
```

Pods exist because some processes are fundamentally coupled — a web server and its log agent, an app and its metrics sidecar, a service and its proxy. Pods express that coupling explicitly in the API.

---

## 2. Pod Spec (YAML)

Every Kubernetes resource is declared as YAML. A Pod manifest has four top-level fields: `apiVersion`, `kind`, `metadata`, and `spec`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  labels:
    app: my-app
    env: production
spec:
  containers:
  - name: app
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
```

### Field-by-Field Breakdown

```
apiVersion: v1
  ↳ Pods are in the core API group — no group prefix, just v1.

kind: Pod
  ↳ The resource type. Case-sensitive.

metadata:
  name: my-app
    ↳ The Pod's name. Must be unique within the namespace.
    ↳ Used in: kubectl get pod my-app, logs, exec, etc.

  labels:
    app: my-app
    env: production
    ↳ Key/value pairs. Services and Deployments use these
      to select which Pods they manage or route to.

spec:
  containers:
    ↳ A list (note the dash). Minimum: one container.

  - name: app
      ↳ The container name. Shown in kubectl describe pod.

    image: nginx:1.25
      ↳ Image name and tag. Always pin a specific tag in production.
        Never use :latest — you lose reproducibility.

    ports:
    - containerPort: 80
      ↳ Informational. Kubernetes does not enforce or expose
        this automatically — it documents what the container listens on.

    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
        ↳ The minimum guaranteed by the scheduler.
          Used to decide which node can host this Pod.

      limits:
        memory: "128Mi"
        cpu: "500m"
        ↳ The maximum the container is allowed to use.
          Exceeding memory limit → OOMKilled.
          Exceeding CPU limit → throttled.
```

### A More Complete Pod Spec

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
  namespace: default
  labels:
    app: web-server
    version: "1.0"
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
spec:
  containers:
  - name: web
    image: nginx:1.25
    ports:
    - name: http
      containerPort: 80
      protocol: TCP
    env:
    - name: APP_ENV
      value: production
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: database-host
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
    livenessProbe:
      httpGet:
        path: /healthz
        port: 80
      initialDelaySeconds: 10
      periodSeconds: 5
    readinessProbe:
      httpGet:
        path: /ready
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 3
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/conf.d
      readOnly: true
  volumes:
  - name: config-volume
    configMap:
      name: nginx-config
  restartPolicy: Always
```

---

## 3. Shared Network Namespace

All containers in a Pod share the same **network namespace**. This means they share one IP address, one set of network interfaces, and the same port space.

### ASCII Diagram

```
  Kubernetes Node
  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │   Pod (IP: 10.0.0.42)                                      │
  │   ┌──────────────────────────────────────────────────────┐ │
  │   │                                                      │ │
  │   │   pause container (holds the network namespace)      │ │
  │   │        │                                             │ │
  │   │        └──── eth0  (IP: 10.0.0.42)                  │ │
  │   │                 │                                    │ │
  │   │        ┌────────┴────────┐                          │ │
  │   │        │                 │                          │ │
  │   │  ┌─────▼─────┐   ┌──────▼─────┐                    │ │
  │   │  │ Container  │   │ Container  │                    │ │
  │   │  │   (app)    │   │  (sidecar) │                    │ │
  │   │  │            │   │            │                    │ │
  │   │  │ port :80   │   │ port :9090 │                    │ │
  │   │  └────────────┘   └────────────┘                    │ │
  │   │                                                      │ │
  │   │  Communication between containers:                   │ │
  │   │    app → sidecar:  curl localhost:9090  ✓            │ │
  │   │    sidecar → app:  curl localhost:80    ✓            │ │
  │   │                                                      │ │
  │   │  From outside the Pod:                               │ │
  │   │    curl 10.0.0.42:80    (reaches app)    ✓           │ │
  │   │    curl 10.0.0.42:9090  (reaches sidecar)✓           │ │
  │   │                                                      │ │
  │   │  Port conflict:                                      │ │
  │   │    Two containers CANNOT both bind port :80          │ │
  │   │    They share the port space — same rules as         │ │
  │   │    two processes on the same machine.                │ │
  │   └──────────────────────────────────────────────────────┘ │
  │                                                            │
  └────────────────────────────────────────────────────────────┘
```

### Why This Matters

- Containers in a Pod communicate over `localhost` — no service discovery needed between them.
- No port can be bound twice. If your app uses `:8080`, your sidecar must use a different port.
- The Pod gets a single IP from the cluster's Pod CIDR. From the perspective of the cluster network, the Pod is the network entity, not the individual container.
- The `pause` container (sometimes called the "infra" container) is created first and holds the network namespace open for the lifetime of the Pod, even if app containers restart.

---

## 4. Shared Storage (Volumes)

Containers in a Pod can also share filesystem storage through **volumes**. A volume is defined at the Pod level and mounted into one or more containers.

### emptyDir: Simplest Shared Volume

`emptyDir` is created when the Pod starts and deleted when the Pod is removed. It lives on the node's disk (or in memory if `medium: Memory`). Any container in the Pod can mount it.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-volume-demo
spec:
  containers:
  - name: writer
    image: busybox:1.35
    command: ["sh", "-c", "while true; do date >> /shared/log.txt; sleep 5; done"]
    volumeMounts:
    - name: shared-data
      mountPath: /shared

  - name: reader
    image: busybox:1.35
    command: ["sh", "-c", "while true; do cat /shared/log.txt; sleep 5; done"]
    volumeMounts:
    - name: shared-data
      mountPath: /shared

  volumes:
  - name: shared-data
    emptyDir: {}
```

```
  Pod
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  Volume: shared-data (emptyDir on /var/lib/kubelet/pods/…) │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  /shared/log.txt                                     │   │
  │  └──────────────┬──────────────────────┬───────────────┘   │
  │                 │ mount: /shared        │ mount: /shared    │
  │         ┌───────▼──────┐       ┌────────▼──────┐           │
  │         │   writer     │       │   reader      │           │
  │         │  appends to  │       │  reads from   │           │
  │         │  log.txt     │       │  log.txt      │           │
  │         └──────────────┘       └───────────────┘           │
  │                                                             │
  │  If writer container restarts → volume persists, reader     │
  │  continues reading. If the Pod is deleted → volume gone.    │
  └─────────────────────────────────────────────────────────────┘
```

### emptyDir in Memory

```yaml
volumes:
- name: cache
  emptyDir:
    medium: Memory     # stored in RAM, not disk
    sizeLimit: 256Mi   # capped to prevent memory exhaustion
```

Use `medium: Memory` for sensitive data (secrets passed via files) or high-speed scratch space. It counts against the container's memory limit.

---

## 5. Resource Requests and Limits

Kubernetes uses two knobs per resource — `requests` and `limits` — which serve fundamentally different purposes.

### Requests vs Limits Explained

```
CPU and memory each have two values:

  requests:
    - The amount the scheduler GUARANTEES will be available.
    - Used during scheduling: node must have this much free.
    - The container always has at least this much CPU/memory.

  limits:
    - The maximum the container is ALLOWED to consume.
    - Enforced at runtime by the Linux kernel.

What happens when a container exceeds its limit:

  CPU limit exceeded:
    → Container is CPU-throttled by the kernel cgroup.
    → It slows down but keeps running.
    → CPU is compressible — excess is taken away, not killed.

  Memory limit exceeded:
    → Container is OOMKilled (Out Of Memory Killed).
    → Process is terminated immediately by the kernel.
    → Kubernetes restarts the container (if restartPolicy: Always).
    → Memory is incompressible — there is no "throttle", only kill.
```

### CPU Units

```
CPU is measured in millicores (m):

  1000m = 1 CPU core = 1 vCPU = 1 AWS vCPU = 1 GCP vCPU

  250m  = 0.25 cores  (one quarter of a core)
  500m  = 0.5  cores  (half a core)
  2000m = 2    cores  (two full cores)

  You can also write without the m suffix:
    cpu: "0.25"  is equivalent to  cpu: "250m"
```

### Memory Units

```
Memory is measured in bytes with SI or binary suffixes:

  Ki = kibibytes (1024 bytes)      K = kilobytes (1000 bytes)
  Mi = mebibytes (1024 * 1024)     M = megabytes (1000 * 1000)
  Gi = gibibytes                   G = gigabytes

  "64Mi"  = 67,108,864 bytes  (64 × 1024²)
  "128Mi" = 134,217,728 bytes

  Always use Ki/Mi/Gi to avoid ambiguity.
```

### QoS Classes

Kubernetes assigns every Pod a Quality of Service class based on its resource configuration. This controls eviction priority under node memory pressure.

| QoS Class | Condition | Eviction Priority |
|-----------|-----------|-------------------|
| **Guaranteed** | Every container has requests == limits for both CPU and memory | Last to be evicted |
| **Burstable** | At least one container has requests < limits, or requests without limits | Evicted second |
| **BestEffort** | No container has any requests or limits set | First to be evicted |

```yaml
# Guaranteed QoS — requests equals limits for all containers
spec:
  containers:
  - name: app
    resources:
      requests:
        memory: "128Mi"
        cpu: "500m"
      limits:
        memory: "128Mi"   # same as request
        cpu: "500m"       # same as request

# Burstable QoS — requests set but limits are higher
spec:
  containers:
  - name: app
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"   # higher than request — can burst
        cpu: "1000m"

# BestEffort QoS — no resources set at all
spec:
  containers:
  - name: app
    image: nginx:1.25
    # no resources block — BestEffort, evicted first under pressure
```

```bash
# Check what QoS class was assigned to a Pod
kubectl get pod my-app -o jsonpath='{.status.qosClass}'
# Output: Guaranteed | Burstable | BestEffort
```

---

## 6. Labels and Selectors

Labels are **key/value pairs** attached to Kubernetes objects. They have no semantic meaning to the Kubernetes core — their meaning is defined by the users and controllers that query them.

### Label Syntax

```
key: value

Key rules:
  - Optional prefix: prefix/name    (e.g. app.kubernetes.io/name)
  - Prefix must be a valid DNS subdomain, max 253 characters
  - Name part: max 63 characters, alphanumeric, dashes, underscores, dots
  - Must start and end with alphanumeric character

Value rules:
  - Max 63 characters
  - Alphanumeric, dashes, underscores, dots
  - Can be empty string ""
```

### Applying Labels in YAML

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
  labels:
    app: web-server           # application name
    version: "2.1.0"          # release version
    env: production           # deployment environment
    tier: frontend            # architectural tier
    team: platform            # owning team
    app.kubernetes.io/name: web-server          # recommended label
    app.kubernetes.io/version: "2.1.0"
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: ecommerce
spec:
  containers:
  - name: web
    image: nginx:1.25
```

### How Services Use Label Selectors

A Service routes traffic to all Pods whose labels match its selector:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web-server       # matches Pods with this label
    env: production       # AND this label (all conditions must match)
  ports:
  - port: 80
    targetPort: 80
```

```
  Pod A  labels: {app: web-server, env: production}   ← selected ✓
  Pod B  labels: {app: web-server, env: staging}      ← not selected ✗
  Pod C  labels: {app: api-server, env: production}   ← not selected ✗
  Pod D  labels: {app: web-server, env: production, version: "2.1.0"}  ← selected ✓

  Selector matches if the Pod has AT LEAST those labels.
  Extra labels on the Pod are fine — they don't exclude it.
```

### How Deployments Use Label Selectors

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-server       # Deployment manages Pods with this label
  template:
    metadata:
      labels:
        app: web-server     # Pods created will have this label
        env: production
    spec:
      containers:
      - name: web
        image: nginx:1.25
```

### kubectl Label Commands

```bash
# Filter Pods by label
kubectl get pods -l app=web-server
kubectl get pods -l app=web-server,env=production

# Set-based selectors
kubectl get pods -l 'env in (production, staging)'
kubectl get pods -l 'env notin (development)'
kubectl get pods -l 'app'              # has this label key (any value)
kubectl get pods -l '!deprecated'     # does not have this label key

# Add a label to a running Pod
kubectl label pod my-app version=2.1.0

# Update an existing label (--overwrite required)
kubectl label pod my-app env=staging --overwrite

# Remove a label (key followed by minus)
kubectl label pod my-app version-

# Show labels in output
kubectl get pods --show-labels
```

---

## 7. Annotations

Annotations are also **key/value pairs** on Kubernetes objects, but they serve a different purpose from labels. Annotations are **not used for selection** — nothing in Kubernetes selects resources by annotation. They exist to attach non-identifying metadata: build info, configuration for external tools, documentation.

### Labels vs Annotations

```
Labels:
  - Used to identify and select objects
  - Short, well-known keys like app, env, version
  - Used by Services, Deployments, HPA, NetworkPolicy to select Pods
  - Appear in kubectl get output with --show-labels
  - Max 63-character values

Annotations:
  - Used to attach arbitrary metadata
  - Not used for selection — Kubernetes ignores them for scheduling/routing
  - Can hold structured data (JSON strings), long URLs, hashes
  - Used by external tools: Prometheus, Istio, cert-manager, Helm
  - No character limit on values (can be megabytes)
```

### Common Annotation Use Cases

```yaml
metadata:
  annotations:
    # --- Build / CI information ---
    git.commit: "a3f2c91d"
    git.branch: "main"
    build.number: "1042"
    build.timestamp: "2025-06-25T10:30:00Z"
    deployed.by: "ci-pipeline"

    # --- Monitoring configuration ---
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"

    # --- Ingress configuration ---
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"

    # --- cert-manager ---
    cert-manager.io/cluster-issuer: letsencrypt-prod

    # --- Documentation ---
    kubernetes.io/change-cause: "Updated nginx from 1.24 to 1.25"
    description: "Primary web frontend serving the ecommerce homepage"
```

### Adding Annotations with kubectl

```bash
# Add annotation to a running resource
kubectl annotate pod my-app git.commit=a3f2c91d

# Update existing annotation
kubectl annotate pod my-app git.commit=b4g3d92e --overwrite

# Remove annotation
kubectl annotate pod my-app git.commit-

# View annotations
kubectl describe pod my-app   # shows Annotations section
kubectl get pod my-app -o jsonpath='{.metadata.annotations}'
```

---

## 8. kubectl Commands

This section covers the essential `kubectl` commands for working with Pods day-to-day.

### Creating and Applying

```bash
# Apply a manifest (create or update)
kubectl apply -f pod.yaml

# Apply all manifests in a directory
kubectl apply -f ./manifests/

# Create imperatively (without a YAML file)
kubectl run my-pod --image=nginx:1.25

# Create and immediately delete (one-shot debug pod)
kubectl run debug --image=busybox:1.35 --rm -it --restart=Never -- sh

# Dry run — validate the manifest without creating anything
kubectl apply -f pod.yaml --dry-run=client
kubectl apply -f pod.yaml --dry-run=server    # validates against the API server
```

### Listing and Inspecting

```bash
# List Pods in the current namespace
kubectl get pods

# List Pods with node, IP, and status details
kubectl get pods -o wide

# List Pods across all namespaces
kubectl get pods -A
kubectl get pods --all-namespaces

# List Pods in a specific namespace
kubectl get pods -n kube-system

# Watch Pods update in real time
kubectl get pods -w

# Filter by label
kubectl get pods -l app=my-app

# Detailed description — events, conditions, volumes, probes
kubectl describe pod my-app

# Get the full raw YAML of a running Pod (includes status)
kubectl get pod my-app -o yaml

# Get just the Pod's IP
kubectl get pod my-app -o jsonpath='{.status.podIP}'

# Get the node a Pod is running on
kubectl get pod my-app -o jsonpath='{.spec.nodeName}'

# Get all Pods sorted by creation time
kubectl get pods --sort-by=.metadata.creationTimestamp
```

### Logs

```bash
# View logs from a Pod (single container)
kubectl logs my-app

# Follow (stream) logs in real time
kubectl logs -f my-app

# Show only the last 50 lines
kubectl logs my-app --tail=50

# Show logs from the last 1 hour
kubectl logs my-app --since=1h

# Get logs from a specific container in a multi-container Pod
kubectl logs my-app -c sidecar

# Get logs from a previously terminated container (after crash)
kubectl logs my-app --previous
kubectl logs my-app -p
```

### Executing Commands Inside a Pod

```bash
# Open an interactive shell in the first container
kubectl exec -it my-app -- /bin/bash
kubectl exec -it my-app -- /bin/sh       # for alpine/busybox images

# Run a single command without interactive shell
kubectl exec my-app -- ls /etc/nginx
kubectl exec my-app -- env

# Target a specific container in a multi-container Pod
kubectl exec -it my-app -c sidecar -- /bin/sh

# Copy files to/from a Pod
kubectl cp my-app:/etc/nginx/nginx.conf ./nginx.conf    # Pod → local
kubectl cp ./nginx.conf my-app:/tmp/nginx.conf           # local → Pod
```

### Deleting Pods

```bash
# Delete by name
kubectl delete pod my-app

# Delete from manifest
kubectl delete -f pod.yaml

# Delete immediately (skip graceful termination)
kubectl delete pod my-app --grace-period=0 --force

# Delete all Pods with a label
kubectl delete pods -l app=my-app

# Delete all Pods in a namespace
kubectl delete pods --all -n my-namespace
```

### Port Forwarding (Local Access Without a Service)

```bash
# Forward local port 8080 to Pod port 80
kubectl port-forward pod/my-app 8080:80

# Forward to a Deployment (connects to one of its Pods)
kubectl port-forward deployment/my-deploy 8080:80

# Access in browser: http://localhost:8080
```

### Useful Output Formats

```bash
# YAML output
kubectl get pod my-app -o yaml

# JSON output
kubectl get pod my-app -o json

# Custom columns
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# JSONPath queries
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create your first Pod from a YAML manifest. Write a file called `nginx-pod.yaml` defining a Pod with name `nginx-test`, image `nginx:1.25`, a label `app: nginx-test`, and resource requests of `64Mi` memory and `100m` CPU with limits of `128Mi` and `200m`. Apply it with `kubectl apply -f nginx-pod.yaml`. Verify it is Running with `kubectl get pod nginx-test -o wide`. Capture the Pod's IP address and node name.

**Exercise 2:** Inspect and describe a running Pod. Run `kubectl describe pod nginx-test` and identify: (1) the QoS class assigned, (2) the node the Pod was scheduled to, (3) the events section at the bottom — note the sequence of events from Scheduled through Pulled, Created, Started. Then run `kubectl get pod nginx-test -o yaml` and find the `status.conditions` array — observe what `Initialized`, `Ready`, and `ContainersReady` mean.

**Exercise 3:** Exec into a Pod and explore the network. Run `kubectl exec -it nginx-test -- /bin/bash`. Inside the container, run `ip addr` to see the network interface and IP. Run `curl localhost:80` to confirm nginx is responding. Run `cat /proc/1/net/fib_trie` to observe that this is the same network namespace shared by all containers in the Pod. Exit the shell. From your machine, use `kubectl port-forward pod/nginx-test 8080:80` and open `http://localhost:8080` in your browser.

**Exercise 4:** Work with labels and selectors. Apply three Pods — one with labels `{app: web, env: production}`, one with `{app: web, env: staging}`, and one with `{app: api, env: production}`. Use `kubectl get pods -l app=web` to list the first two. Use `kubectl get pods -l app=web,env=production` to select only the first. Use `kubectl get pods -l 'env in (production, staging)'` to select all three. Use `kubectl label pod <name> version=1.0` to add a label to a running Pod without restarting it. Delete all three with `kubectl delete pods -l app=web && kubectl delete pods -l app=api`.

**Exercise 5:** Observe resource limits and QoS classes. Create a Pod with `requests.memory: "64Mi"` and `limits.memory: "64Mi"` for both CPU and memory (requests == limits). Check its QoS class: `kubectl get pod <name> -o jsonpath='{.status.qosClass}'` — it should be `Guaranteed`. Create a second Pod with requests smaller than limits — verify it is `Burstable`. Create a third Pod with no resources block at all — verify it is `BestEffort`. Run `kubectl get pods --sort-by=.metadata.creationTimestamp --show-labels` to see all three listed together.

---

## 10. Interview Q&A

**Q: What is a Pod in Kubernetes, and why does Kubernetes use Pods rather than scheduling containers directly?**
Answer: A Pod is the smallest deployable unit in Kubernetes — a logical wrapper around one or more containers that share a network namespace, storage volumes, and a lifecycle. Kubernetes uses Pods rather than raw containers because some processes are fundamentally coupled and must run on the same node with shared local communication. A web server and its log shipping agent need to write to the same log directory and communicate over localhost — Pod makes this co-location a first-class concept in the API rather than an infrastructure implementation detail. The Pod is the unit of scheduling, scaling, and placement.

**Q: What is the difference between a Pod and a container?**
Answer: A container is a Linux process isolated with namespaces and cgroups, packaged with its filesystem layers via a container image. A Pod is a Kubernetes abstraction that wraps one or more containers and adds cluster-level concepts: a shared network namespace (one IP for all containers), shared volumes, resource accounting, health probes, and lifecycle management. You never interact with containers directly in Kubernetes — you define Pods (or higher-level resources like Deployments that create Pods), and the container runtime (containerd or CRI-O) is responsible for actually running the containers inside. A Pod can contain one container (the common case) or multiple tightly coupled containers.

**Q: What are resource requests and limits, and what happens when a container exceeds them?**
Answer: Requests are the minimum resources the scheduler guarantees for a container — a node must have at least this much free capacity for the Pod to be scheduled there. Limits are the maximum a container is allowed to consume at runtime. Exceeding CPU limit does not kill the container — the kernel cgroup throttles it, slowing it down. CPU is compressible. Exceeding memory limit does kill the container — the kernel OOMKills it because memory cannot be throttled; there is no safe way to "take memory back" from a process without terminating it. Kubernetes then restarts the container according to the Pod's restartPolicy.

**Q: What are labels and selectors, and how do Services use them?**
Answer: Labels are key/value pairs attached to Kubernetes objects that identify and group resources. Selectors are queries that match objects by their labels. A Service uses a `selector` field to determine which Pods to route traffic to — when a request arrives at the Service's ClusterIP, kube-proxy forwards it to any Pod whose labels match the selector. This is loose coupling: you can create a Service before the Pods exist, add new Pods that automatically become part of the Service by having the right labels, or roll out new Pods with a different version label and swap the Service selector to cut traffic over to them. Labels enable all of this without hardcoding Pod names or IPs anywhere.

**Q: How do two containers inside the same Pod communicate with each other?**
Answer: Containers in the same Pod share a network namespace — they have the same IP address and can reach each other over `localhost`. If container A listens on port `8080` and container B wants to call it, container B simply makes a request to `localhost:8080`. No Service, no DNS lookup, no cluster networking involved. This is possible because Kubernetes creates a `pause` container first, which establishes and holds the network namespace, and then joins both app containers into it. The tradeoff is that two containers in the same Pod cannot both bind the same port number — they share the port space just like two processes on the same Linux host.
