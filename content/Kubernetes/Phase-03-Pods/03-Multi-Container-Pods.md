# Multi-Container Pods — Complete Guide

## Table of Contents
1. [Why Multi-Container Pods?](#1-why-multi-container-pods)
2. [Sidecar Pattern](#2-sidecar-pattern)
3. [Ambassador Pattern](#3-ambassador-pattern)
4. [Adapter Pattern](#4-adapter-pattern)
5. [Init Containers](#5-init-containers)
6. [Shared Resources Between Containers](#6-shared-resources-between-containers)
7. [When to Use vs Separate Pods](#7-when-to-use-vs-separate-pods)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Multi-Container Pods?

A Pod can run more than one container. The decision to co-locate containers in a single Pod is a deliberate design choice — it means those containers are **tightly coupled** and must share the same lifecycle, node, network namespace, and storage volumes.

### The Co-location Rationale

```
Single-container Pod (the common case):
  Pod ┌────────────────────────┐
      │   Container: app       │
      │   Standalone, no       │
      │   hard dependency on   │
      │   another process.     │
      └────────────────────────┘

Multi-container Pod (intentional coupling):
  Pod ┌──────────────────────────────────────────────────┐
      │   Container: app          Container: log-agent   │
      │   Writes to /var/log ───► Reads /var/log, ships  │
      │                           to Elasticsearch       │
      │   Same node ✓  Same IP ✓  Same volume ✓          │
      └──────────────────────────────────────────────────┘

Why this works:
  - Both containers start and stop together (one atomic unit)
  - They communicate over localhost — no network hop, no service discovery
  - They can share a filesystem via emptyDir or other volumes
  - The scheduler places them on the same node automatically
```

### Three Legitimate Reasons to Multi-Container

1. **Shared localhost** — the helper container needs to call the main container's local port without a Service.
2. **Shared volumes** — the helper container reads or writes files that the main container produces or consumes.
3. **Lifecycle coupling** — if the main container disappears, the helper is meaningless alone.

---

## 2. Sidecar Pattern

A **sidecar** augments the main container without changing it. The main container does its job; the sidecar enhances, monitors, or ships data alongside it.

### Classic Example: Log Shipping

The application writes logs to a shared volume. The sidecar (fluentd) reads those logs and ships them to a central store. Neither container needs to know how the other works — they share only the filesystem path.

```
  Pod
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │   Volume: shared-logs (emptyDir)                                │
  │   ┌──────────────────────────────────────────────────────────┐  │
  │   │  /var/log/app/app.log                                    │  │
  │   └───────────────┬──────────────────────┬───────────────────┘  │
  │                   │ writes                │ reads               │
  │         ┌─────────▼─────────┐   ┌────────▼──────────┐          │
  │         │   nginx (main)    │   │  fluentd (sidecar) │          │
  │         │   Serves HTTP     │   │  Reads log file    │          │
  │         │   Writes access   │   │  Ships to          │          │
  │         │   logs to volume  │   │  Elasticsearch     │          │
  │         └───────────────────┘   └────────────────────┘          │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### YAML: nginx + fluentd Sidecar

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-with-logging
  labels:
    app: nginx-with-logging
spec:
  containers:

  # --- Main container ---
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/nginx

  # --- Sidecar container ---
  - name: log-shipper
    image: fluent/fluentd:v1.16
    env:
    - name: FLUENTD_ARGS
      value: "-c /fluentd/etc/fluent.conf"
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/nginx    # same path — reads nginx logs
    - name: fluentd-config
      mountPath: /fluentd/etc
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "100m"

  volumes:
  - name: shared-logs
    emptyDir: {}
  - name: fluentd-config
    configMap:
      name: fluentd-config
```

### Other Common Sidecar Uses

| Sidecar | What it does |
|---------|-------------|
| **Envoy / Istio proxy** | Intercepts all inbound/outbound traffic for mTLS, retries, observability |
| **Vault agent** | Fetches secrets from HashiCorp Vault, writes them to a shared volume |
| **Git sync** | Polls a git repo, syncs the latest content to a shared volume for the web server |
| **Metrics exporter** | Exposes `/metrics` in Prometheus format, scraping the main app's internal state |

---

## 3. Ambassador Pattern

An **ambassador** container proxies network traffic on behalf of the main container. The main container always talks to `localhost`, and the ambassador figures out where to send the traffic — handling retries, service discovery, or protocol translation.

### The Problem it Solves

```
Without ambassador:
  App code must know:
    - Which Redis host to connect to (dev vs prod vs replica)
    - How to handle failover
    - Which port the shard lives on
  → Config sprawl, hard-coded endpoints, different code per environment

With ambassador:
  App always connects to  localhost:6379
  Ambassador (twemproxy)  decides which Redis shard to route to
  → App code is environment-agnostic
```

### YAML: App + Redis Proxy Ambassador

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-redis-proxy
  labels:
    app: myapp
spec:
  containers:

  # --- Main container ---
  - name: app
    image: myapp:2.0
    env:
    - name: REDIS_HOST
      value: "localhost"      # always localhost — ambassador handles the rest
    - name: REDIS_PORT
      value: "6379"

  # --- Ambassador container ---
  - name: redis-ambassador
    image: haproxy:2.8
    ports:
    - containerPort: 6379
    volumeMounts:
    - name: haproxy-config
      mountPath: /usr/local/etc/haproxy
    resources:
      requests:
        memory: "32Mi"
        cpu: "25m"
      limits:
        memory: "64Mi"
        cpu: "50m"

  volumes:
  - name: haproxy-config
    configMap:
      name: haproxy-redis-config
```

```
  Network flow:
    app container
      └─► localhost:6379
            └─► redis-ambassador (haproxy)
                  └─► redis-primary.prod.svc.cluster.local:6379
                       or
                  └─► redis-replica.prod.svc.cluster.local:6379
                       (based on read vs write decision in haproxy config)
```

---

## 4. Adapter Pattern

An **adapter** container normalizes the output or interface of the main container to conform to a standard expected by an external system. The main container is unchanged; the adapter translates.

### The Problem it Solves

```
External monitoring system expects:
  JSON format: {"timestamp": "...", "level": "INFO", "message": "..."}

Main app emits:
  Plain text: "2025-06-25 10:30:01 INFO  Server started on port 8080"

Without adapter:
  Modify the app to emit JSON — couples the app to the monitoring format

With adapter:
  Adapter container reads the plain-text log, transforms to JSON, forwards
  → App stays unchanged; format negotiation is the adapter's job
```

### YAML: App + Log Adapter

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-adapter
spec:
  containers:

  # --- Main container ---
  - name: app
    image: legacy-app:1.0
    volumeMounts:
    - name: app-logs
      mountPath: /app/logs

  # --- Adapter container ---
  - name: log-adapter
    image: log-transformer:1.0   # custom image that reformats logs
    command: ["python", "/adapter/transform.py"]
    env:
    - name: INPUT_PATH
      value: /logs/app.log
    - name: OUTPUT_FORMAT
      value: json
    - name: OUTPUT_ENDPOINT
      value: "http://logstash.monitoring.svc:5000"
    volumeMounts:
    - name: app-logs
      mountPath: /logs

  volumes:
  - name: app-logs
    emptyDir: {}
```

### Pattern Comparison

```
  Sidecar:    Adds new capability to the main container (log shipping, proxying)
              Main container is unaware of the sidecar.

  Ambassador: Proxies outbound traffic. Main container always talks to localhost.
              Ambassador handles routing, failover, protocol translation.

  Adapter:    Normalizes outbound data/interface to match an external contract.
              Main container is unaware; adapter transforms its output.

  Common thread: the main container is never modified.
                 The helper container is the point of integration.
```

---

## 5. Init Containers

**Init containers** run to completion **before** any app containers start. They are defined under `spec.initContainers` and execute sequentially — each must exit 0 before the next begins. Only after all init containers succeed does Kubernetes start the app containers.

### Init Container Lifecycle

```
  Pod startup sequence:

  ┌──────────────────┐
  │  init-container-1 │  runs to completion (exit 0) ──► moves to next
  └──────────────────┘
           │
           ▼
  ┌──────────────────┐
  │  init-container-2 │  runs to completion (exit 0) ──► moves to next
  └──────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────┐
  │  app containers start (all run in parallel)  │
  │   - main container                           │
  │   - sidecar containers                       │
  └──────────────────────────────────────────────┘

  If any init container fails:
    → Kubernetes restarts it according to the Pod's restartPolicy
    → App containers do NOT start until ALL init containers succeed
    → The Pod stays in Init:0/2, Init:1/2 etc. state
```

### Common Init Container Use Cases

| Use Case | What the init container does |
|----------|------------------------------|
| **Wait for dependency** | Polls until a database or service is ready before the app starts |
| **Seed data** | Populates a shared volume with config files or seed data |
| **Set permissions** | Runs `chown`/`chmod` on a mounted volume the app needs to write to |
| **Database migration** | Runs `migrate up` before the app server starts accepting traffic |
| **Clone a git repo** | Clones code into a shared volume that the app container then serves |

### YAML: Init Containers Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
  labels:
    app: myapp
spec:
  initContainers:

  # Init container 1: wait for the database to be reachable
  - name: wait-for-db
    image: busybox:1.35
    command:
    - sh
    - -c
    - |
      until nc -z mysql.default.svc.cluster.local 3306; do
        echo "Waiting for MySQL...";
        sleep 2;
      done;
      echo "MySQL is ready."

  # Init container 2: run database migrations
  - name: run-migrations
    image: myapp:2.0
    command: ["python", "manage.py", "migrate"]
    env:
    - name: DB_HOST
      value: mysql.default.svc.cluster.local
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password

  # App container — only starts after both init containers succeed
  containers:
  - name: app
    image: myapp:2.0
    ports:
    - containerPort: 8000
    env:
    - name: DB_HOST
      value: mysql.default.svc.cluster.local
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
```

### Init Container Restart Behavior

```
restartPolicy: Always  (default)
  → If an init container fails, it is restarted indefinitely.
  → The Pod stays in the Init phase until the init container succeeds.

restartPolicy: Never
  → If an init container fails, the Pod phase becomes Failed.
  → No restart attempt.

restartPolicy: OnFailure
  → Restart on non-zero exit, not on exit 0.

Key difference from app containers:
  Init containers do NOT support livenessProbe or readinessProbe.
  They are expected to run to completion — they either succeed or fail.
```

---

## 6. Shared Resources Between Containers

Containers inside a Pod share three things: network namespace, storage volumes, and optionally the PID namespace.

### Shared Network Namespace

```
  Pod IP: 10.0.0.55
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  pause container (holds the network namespace)        │
  │  └── eth0  (10.0.0.55)                                │
  │         │                                             │
  │   ┌─────┴──────────────────┐                          │
  │   │                        │                          │
  │  Container A             Container B                  │
  │  (nginx, port 80)        (metrics, port 9090)         │
  │                                                        │
  │  A → B:  curl localhost:9090  ✓  (no Service needed)  │
  │  B → A:  curl localhost:80    ✓                        │
  │                                                        │
  │  Port conflict: A and B CANNOT both bind :80           │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

### Shared emptyDir Volume

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: shared-data
      mountPath: /data

  - name: sidecar
    image: busybox:1.35
    volumeMounts:
    - name: shared-data
      mountPath: /data    # same volume, same path or different — both see same files

  volumes:
  - name: shared-data
    emptyDir: {}
```

```
  emptyDir lifecycle:
    Created:  when the Pod is assigned to a node
    Deleted:  when the Pod is removed from the node
    Survives: container crashes and restarts within the same Pod
    Does NOT survive: Pod deletion, Pod eviction, node reboot (unless hostPath)
```

### Shared PID Namespace (Optional)

By default, each container has its own PID namespace. You can enable sharing:

```yaml
spec:
  shareProcessNamespace: true    # containers can see each other's processes
  containers:
  - name: app
    image: nginx:1.25
  - name: debugger
    image: busybox:1.35
    command: ["sleep", "infinity"]
    # from inside debugger: ps aux — shows nginx processes from the app container
```

This is useful for debugging: you can attach a debugger sidecar that can `strace` or inspect processes in the main container without modifying the main container image.

---

## 7. When to Use vs Separate Pods

Multi-container Pods are a specific tool for a specific problem. Most containers should be in separate Pods.

### Use Multi-Container When

```
✓ The helper is meaningless without the main container
    (log shipper with no app = nothing to ship)

✓ They must share a local file path or socket
    (app writes to /tmp/app.sock, proxy reads from it)

✓ They must communicate over localhost with near-zero latency
    (Envoy proxy intercepting every request at the loopback interface)

✓ They have identical scaling requirements
    (you always want exactly 1 sidecar per 1 app instance)

✓ The helper is an infrastructure concern, not an application concern
    (the app team should not have to deploy their own log shipper separately)
```

### Use Separate Pods When

```
✗ Different scaling requirements
    App: 10 replicas    Background worker: 2 replicas
    → Separate Deployments

✗ Different teams own different containers
    → Separate Pods, separate ownership, separate RBAC

✗ Independent deployment cadence
    → Deploying the sidecar should not restart the app

✗ Different resource profiles
    → CPU-bound workers and memory-bound caches need separate scheduling

✗ Independent health and restart semantics
    → One container crashing should not necessarily kill the other
```

### Decision Tree

```
  Do the two containers need to share a local file or socket?
      YES → Multi-container Pod
      NO  ↓

  Does the helper need to intercept localhost traffic of the main container?
      YES → Multi-container Pod
      NO  ↓

  Do they always scale at exactly the same ratio (1:1)?
      NO  → Separate Pods
      YES ↓

  Are they owned and deployed by the same team at the same cadence?
      NO  → Separate Pods
      YES → Multi-container Pod is reasonable
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a sidecar logging Pod. Write a manifest for a Pod named `sidecar-demo` with two containers: `writer` (busybox, writes the current date to `/shared/log.txt` every 2 seconds in a loop) and `reader` (busybox, runs `tail -f /shared/log.txt`). Share an `emptyDir` volume between them. Apply it, then run `kubectl logs sidecar-demo -c reader` to confirm the reader is streaming the writer's output. Verify that deleting and recreating the Pod resets the log file.

**Exercise 2:** Implement and test an init container. Deploy a Pod with one init container that runs `sleep 10` (simulating a slow dependency check) followed by an app container running nginx. Watch `kubectl get pod <name> -w` to observe the Pod progress through `Init:0/1` → `PodInitializing` → `Running`. While the init container is running, confirm that the app container has not started with `kubectl describe pod <name>`. Modify the init container to `exit 1` (forced failure) and observe the CrashLoopBackOff state in the init phase.

**Exercise 3:** Demonstrate the shared network namespace. Create a multi-container Pod with nginx (port 80) and a busybox sidecar running `sleep infinity`. Exec into the busybox container: `kubectl exec -it <pod> -c sidecar -- sh`. From inside busybox, run `wget -qO- localhost:80` and confirm you receive nginx's default HTML page — without any Service defined. Also run `ip addr` and compare the IP address to what `kubectl get pod <name> -o wide` shows — they should be identical.

**Exercise 4:** Use an init container to seed a shared volume. Create a Pod where the init container (`busybox`) writes a custom `index.html` file to an `emptyDir` volume, and the main container (`nginx`) serves that volume at `/usr/share/nginx/html`. Port-forward to the Pod and confirm in your browser that nginx serves the custom HTML written by the init container, not the default nginx page.

**Exercise 5:** Compare the three patterns. Create three Pods — one demonstrating the sidecar pattern (main app + log-reading busybox sidecar sharing a volume), one demonstrating the ambassador pattern (app container that connects to `localhost:5000` + a busybox netcat listener on port 5000 echoing requests), and one demonstrating the adapter pattern (main container writes a file, adapter container reads and transforms it). For each Pod, use `kubectl describe` to observe both containers listed under `Containers:` and confirm both show `State: Running`.

---

## 9. Interview Q&A

**Q: What is the sidecar pattern in Kubernetes, and when would you use it?**
Answer: The sidecar pattern places a helper container alongside the main application container in the same Pod. The sidecar augments or supports the main container without modifying it — common examples include log shippers that read from a shared volume and forward to Elasticsearch, Envoy proxies injected by a service mesh that intercept all network traffic, Vault agents that fetch secrets and write them to a shared volume, and git-sync containers that keep a local directory in sync with a git repository. You use the sidecar pattern when the helper must run on the same node, share a filesystem path or socket with the main container, and has a 1:1 scaling relationship with it.

**Q: What are init containers, and how do they differ from regular app containers?**
Answer: Init containers run sequentially to completion before any app container starts. They are defined under `spec.initContainers` and each must exit 0 before the next one begins. Once all init containers succeed, all app containers start in parallel. Unlike app containers, init containers do not support `livenessProbe` or `readinessProbe` — they are expected to succeed or fail, not to be continuously monitored. Common uses are waiting for a dependency to be ready (polling until a database port opens), running database migrations, seeding a shared volume with config or data, and setting filesystem permissions. If an init container fails, Kubernetes restarts it according to the Pod's `restartPolicy`.

**Q: How do containers within the same Pod communicate with each other?**
Answer: They communicate over `localhost`. All containers in a Pod share the same network namespace — the same IP address and the same port space. If container A listens on port 8080, container B can reach it with `curl localhost:8080` without any Service, DNS lookup, or cluster networking. This is implemented by a `pause` container (the "infra" container) that is created first and holds the network namespace open for the lifetime of the Pod. The consequence is that two containers in the same Pod cannot bind the same port number, just as two processes on the same host cannot both bind the same port.

**Q: What is the difference between the ambassador pattern and the adapter pattern?**
Answer: Both patterns use a helper container to decouple the main application from external integration concerns, but they operate in opposite directions. The ambassador handles outbound traffic — it sits between the main container and an external service. The main container always talks to `localhost:<port>`, and the ambassador proxies, routes, or translates that traffic to the real external endpoint (such as routing Redis reads to replicas and writes to the primary). The adapter handles the outbound interface — it normalizes what the main container produces to match what an external consumer expects. If a legacy app emits plain-text logs but a monitoring pipeline expects JSON, the adapter container reads the plain-text output and transforms it. In both cases the main container is unmodified.

**Q: When should you NOT use a multi-container Pod?**
Answer: You should not use a multi-container Pod when the containers have different scaling requirements — if you need 10 web servers but only 2 background workers, they must be separate Deployments. You should not co-locate when containers are owned by different teams or deployed on different release cycles, because tying them together means one team's deployment restarts the other team's container. You should not co-locate when the containers have independent health and restart semantics — if a metrics sidecar crashes it probably should not kill the main application. The general rule is: multi-container Pods are for infrastructure-level coupling (proxies, log agents, secret injectors), not for application-level decomposition. Two microservices that happen to work together belong in separate Pods communicating over the cluster network.

---
