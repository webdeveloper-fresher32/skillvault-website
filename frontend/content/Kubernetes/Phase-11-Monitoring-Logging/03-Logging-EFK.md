# Logging on Kubernetes — EFK Stack — Complete Guide

## Table of Contents
1. [Kubernetes Logging Architecture](#1-kubernetes-logging-architecture)
2. [Logging Strategies](#2-logging-strategies)
3. [EFK Stack Overview](#3-efk-stack-overview)
4. [Deploying Fluentd as a DaemonSet](#4-deploying-fluentd-as-a-daemonset)
5. [Elasticsearch & Kibana](#5-elasticsearch--kibana)
6. [Loki Alternative](#6-loki-alternative)
7. [kubectl logs Best Practices](#7-kubectl-logs-best-practices)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Kubernetes Logging Architecture

### The stdout/stderr Contract

The fundamental rule of Kubernetes logging is simple: **write to stdout and stderr**. Everything else — shipping, storing, searching — is handled by infrastructure outside your application.

When a containerised process writes to stdout or stderr, the container runtime (containerd or Docker) captures that output and writes it to a log file on the node's filesystem. The kubelet manages these files and exposes them via the `/logs` API. The files live at a predictable path on every node.

```
Container logging flow:

  ┌──────────────────────────────────────────────────────────────────┐
  │  Container process                                               │
  │    fmt.Println("request received")  →  stdout                   │
  │    log.Error("db connection failed") → stderr                   │
  └──────────────────┬───────────────────────────────────────────────┘
                     │ captured by container runtime (containerd)
                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  Node filesystem                                                 │
  │    /var/log/containers/                                          │
  │      <pod-name>_<namespace>_<container-name>-<id>.log           │
  │                                                                  │
  │    Example:                                                      │
  │      /var/log/containers/                                        │
  │        api-7d9f4-x8kq_production_app-abc123.log                 │
  │                                                                  │
  │    /var/log/pods/                                                │
  │      <namespace>_<pod-name>_<uid>/                               │
  │        <container-name>/0.log   ← symlinked from /containers/   │
  └──────────────────────────────────────────────────────────────────┘
                     │ read by
                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  kubectl logs — reads via kubelet API                            │
  │  Log shipping agent (Fluentd/Fluent Bit) — reads files directly  │
  └──────────────────────────────────────────────────────────────────┘
```

### Log Rotation and Retention

The kubelet performs automatic log rotation to prevent nodes from running out of disk space. By default it keeps the last 10 log files per container and caps each file at 10 MiB. Logs older than the rotation window are permanently deleted from the node. This is a critical constraint: **node-level logs are ephemeral**. If a pod is deleted or rescheduled, its logs on the original node will eventually be rotated away. This is why a centralised log shipping solution is required for any serious workload.

```
Log file lifecycle on a node:

  Container running → logs written to /var/log/containers/*.log
                        │
  Container restarted → previous log file renamed (rotation)
                        New log file created
                        Up to 10 rotations kept
                        │
  Pod deleted        → log files eventually garbage collected
                        by kubelet (configurable via
                        containerLogMaxSize and containerLogMaxFiles)
                        │
  Without log shipper → logs are GONE once rotated/deleted
  With log shipper    → logs already forwarded to Elasticsearch/Loki
```

---

## 2. Logging Strategies

### Three Approaches to Log Collection

There is no single correct approach to log collection in Kubernetes. The right choice depends on the cluster size, log volume, team structure, and whether you can modify application deployments.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Strategy 1: Node-Level Agent (DaemonSet) — most common             │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Worker 1  │  │   Worker 2  │  │   Worker 3  │                 │
│  │             │  │             │  │             │                 │
│  │ pod/api     │  │ pod/worker  │  │ pod/db      │                 │
│  │ pod/cache   │  │ pod/cron    │  │ pod/queue   │                 │
│  │             │  │             │  │             │                 │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │                 │
│  │ │Fluentd  │ │  │ │Fluentd  │ │  │ │Fluentd  │ │                 │
│  │ │DaemonSet│ │  │ │DaemonSet│ │  │ │DaemonSet│ │                 │
│  │ └────┬────┘ │  │ └────┬────┘ │  │ └────┬────┘ │                 │
│  └──────┼──────┘  └──────┼──────┘  └──────┼──────┘                 │
│         └────────────────┼────────────────┘                        │
│                          ▼                                          │
│                   Elasticsearch / Loki                              │
│                                                                     │
│  Pros: no app changes, one agent per node, consistent               │
│  Cons: cannot handle non-stdout logs without extra config           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Strategy 2: Sidecar Log Shipper                                    │
│                                                                     │
│  Pod:                                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  container: app          container: fluent-bit-sidecar        │   │
│  │  writes to:              reads from:                          │   │
│  │  /var/log/app.log   ──▶  shared emptyDir volume               │   │
│  │  (not stdout)            forwards to Elasticsearch            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Pros: handles file-based legacy app logs, per-app config           │
│  Cons: extra container per pod, higher resource overhead            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Strategy 3: Direct Application Logging                             │
│                                                                     │
│  App embeds SDK → sends logs directly to Elasticsearch/Splunk       │
│                                                                     │
│  Pros: no infrastructure dependency, maximum control                │
│  Cons: log collection logic in every app, harder to standardise     │
└─────────────────────────────────────────────────────────────────────┘
```

The **DaemonSet approach** is the default recommendation for new Kubernetes deployments. It requires no application changes and provides a consistent, centralised configuration point.

---

## 3. EFK Stack Overview

### The Three Components

EFK stands for Elasticsearch, Fluentd (or Fluent Bit), and Kibana. Together they form a complete log pipeline: collect, store, and visualise.

```
EFK stack data flow:

  Application pods (stdout/stderr)
          │
          │  Container runtime writes to node filesystem
          ▼
  /var/log/containers/*.log (on each node)
          │
          │  Fluentd DaemonSet reads, parses, enriches
          │  Adds metadata: pod name, namespace, node, labels
          ▼
  Elasticsearch cluster (stores and indexes logs)
          │
          │  Kibana queries via REST API
          ▼
  Kibana UI (search, filter, visualise, create dashboards)
```

### Component Responsibilities

```
┌─────────────────┬──────────────────────────────────────────────────┐
│  Component      │  Role                                            │
├─────────────────┼──────────────────────────────────────────────────┤
│ Fluentd         │ Log collector, parser, and forwarder             │
│ (or Fluent Bit) │ Runs as DaemonSet on every node                  │
│                 │ Reads /var/log/containers, parses JSON/text logs  │
│                 │ Enriches with K8s metadata (pod, namespace, etc) │
│                 │ Forwards to Elasticsearch over HTTP              │
├─────────────────┼──────────────────────────────────────────────────┤
│ Elasticsearch   │ Distributed search and analytics engine          │
│                 │ Stores logs as JSON documents in time-based index │
│                 │ Provides full-text search across all log fields   │
│                 │ Retains logs per ILM (Index Lifecycle Management) │
├─────────────────┼──────────────────────────────────────────────────┤
│ Kibana          │ Web UI for Elasticsearch                         │
│                 │ Create index patterns to query log indices        │
│                 │ Discover: free-text search with time filtering    │
│                 │ Dashboards: visualise log rates, error trends     │
│                 │ Alerts: trigger notifications on log patterns     │
└─────────────────┴──────────────────────────────────────────────────┘
```

---

## 4. Deploying Fluentd as a DaemonSet

### ServiceAccount and RBAC

Fluentd needs permission to read pod and namespace metadata from the Kubernetes API to enrich log records.

```yaml
# fluentd-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fluentd
  namespace: logging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fluentd
rules:
- apiGroups: [""]
  resources:
  - pods
  - namespaces
  verbs:
  - get
  - list
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: fluentd
roleRef:
  kind: ClusterRole
  name: fluentd
  apiGroup: rbac.authorization.k8s.io
subjects:
- kind: ServiceAccount
  name: fluentd
  namespace: logging
```

### Fluentd ConfigMap

```yaml
# fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: logging
data:
  fluent.conf: |
    # Input: read from all container log files on the node
    <source>
      @type tail
      @id in_tail_container_logs
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag raw.kubernetes.*
      read_from_head true
      <parse>
        @type multi_format
        <pattern>
          format json
          time_key time
          time_format %Y-%m-%dT%H:%M:%S.%NZ
        </pattern>
        <pattern>
          format /^(?<time>.+) (?<stream>stdout|stderr) [^ ]* (?<log>.*)$/
          time_format %Y-%m-%dT%H:%M:%S.%N%:z
        </pattern>
      </parse>
    </source>

    # Filter: add Kubernetes metadata (pod name, namespace, labels)
    <filter raw.kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      kubernetes_url "https://#{ENV['KUBERNETES_SERVICE_HOST']}:#{ENV['KUBERNETES_SERVICE_PORT']}/api"
      verify_ssl true
      ca_file /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      skip_labels false
      skip_container_metadata false
    </filter>

    # Filter: parse JSON application logs (structured logging)
    <filter raw.kubernetes.**>
      @type parser
      key_name log
      reserve_data true
      remove_key_name_field false
      <parse>
        @type json
        json_parser json
      </parse>
    </filter>

    # Output: send to Elasticsearch
    <match **>
      @type elasticsearch
      @id out_es
      host elasticsearch-svc.logging.svc.cluster.local
      port 9200
      scheme http
      ssl_verify false
      logstash_format true                # creates daily indices: logstash-YYYY.MM.DD
      logstash_prefix kubernetes
      include_tag_key true
      tag_key @log_name
      flush_interval 5s
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_interval 5s
        retry_forever false
        retry_max_interval 30
        chunk_limit_size 2M
        total_limit_size 500M
        overflow_action block
      </buffer>
    </match>
```

### Fluentd DaemonSet

```yaml
# fluentd-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: logging
  labels:
    app: fluentd
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      serviceAccountName: fluentd
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        effect: NoSchedule                         # run on control-plane nodes too
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1.16-debian-elasticsearch8-1
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch-svc.logging.svc.cluster.local"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        - name: FLUENT_ELASTICSEARCH_SCHEME
          value: "http"
        resources:
          requests:
            cpu: "100m"
            memory: "200Mi"
          limits:
            cpu: "500m"
            memory: "500Mi"
        volumeMounts:
        - name: varlog
          mountPath: /var/log                     # read container log files
        - name: dockercontainerlogpath
          mountPath: /var/lib/docker/containers   # Docker container paths
          readOnly: true
        - name: fluentd-config
          mountPath: /fluentd/etc
      terminationGracePeriodSeconds: 30
      volumes:
      - name: varlog
        hostPath:
          path: /var/log                          # mount node's /var/log
      - name: dockercontainerlogpath
        hostPath:
          path: /var/lib/docker/containers
      - name: fluentd-config
        configMap:
          name: fluentd-config
```

```bash
# Deploy everything
kubectl create namespace logging
kubectl apply -f fluentd-rbac.yaml
kubectl apply -f fluentd-configmap.yaml
kubectl apply -f fluentd-daemonset.yaml

# Verify DaemonSet is running on all nodes
kubectl get daemonset fluentd -n logging
# DESIRED and READY should match your node count

# Check Fluentd logs for errors
kubectl logs -n logging daemonset/fluentd --tail=50
```

---

## 5. Elasticsearch & Kibana

### Elasticsearch StatefulSet (Single-Node Dev)

```yaml
# elasticsearch.yaml — single node, suitable for dev/testing
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: logging
spec:
  serviceName: elasticsearch-svc
  replicas: 1
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
        env:
        - name: discovery.type
          value: single-node              # disable cluster formation for single node
        - name: xpack.security.enabled
          value: "false"                  # disable security for dev
        - name: ES_JAVA_OPTS
          value: "-Xms1g -Xmx1g"         # JVM heap — keep at 50% of container limit
        resources:
          requests:
            cpu: "500m"
            memory: "2Gi"
          limits:
            cpu: "2"
            memory: "2Gi"               # limit == request → Guaranteed QoS
        ports:
        - containerPort: 9200
          name: http
        - containerPort: 9300
          name: transport
        volumeMounts:
        - name: es-data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: es-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch-svc
  namespace: logging
spec:
  selector:
    app: elasticsearch
  ports:
  - name: http
    port: 9200
    targetPort: 9200
  - name: transport
    port: 9300
    targetPort: 9300
  clusterIP: None                         # headless service for StatefulSet
```

### Kibana Deployment

```yaml
# kibana.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kibana
  namespace: logging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kibana
  template:
    metadata:
      labels:
        app: kibana
    spec:
      containers:
      - name: kibana
        image: docker.elastic.co/kibana/kibana:8.11.0
        env:
        - name: ELASTICSEARCH_HOSTS
          value: "http://elasticsearch-svc.logging.svc.cluster.local:9200"
        resources:
          requests:
            cpu: "200m"
            memory: "512Mi"
          limits:
            cpu: "1"
            memory: "1Gi"
        ports:
        - containerPort: 5601
          name: http
---
apiVersion: v1
kind: Service
metadata:
  name: kibana-svc
  namespace: logging
spec:
  selector:
    app: kibana
  ports:
  - port: 5601
    targetPort: 5601
```

```bash
kubectl apply -f elasticsearch.yaml
kubectl apply -f kibana.yaml

# Wait for Elasticsearch to be ready
kubectl rollout status statefulset/elasticsearch -n logging

# Port-forward to Kibana
kubectl port-forward -n logging svc/kibana-svc 5601:5601
# Open http://localhost:5601

# In Kibana:
# Stack Management → Index Patterns → Create index pattern
# Index pattern: kubernetes-*  (matches logstash_prefix=kubernetes + date suffix)
# Time field: @timestamp
# → Now explore logs in Discover tab
```

---

## 6. Loki Alternative

### Why Loki

Grafana Loki is a lightweight log aggregation system designed specifically for Kubernetes. Its key design decision is to **not index the content of log lines** — only the labels (metadata like pod name, namespace, and container). This makes it far cheaper to operate than Elasticsearch in terms of storage and compute, at the cost of less powerful full-text search.

```
EFK vs Loki comparison:

  ┌─────────────────────┬────────────────────┬────────────────────────┐
  │  Feature            │  EFK               │  Loki                  │
  ├─────────────────────┼────────────────────┼────────────────────────┤
  │ Log indexing        │ Full-text index     │ Labels only (no index) │
  │ Storage cost        │ High               │ Very low (compressed)  │
  │ Query language      │ Lucene / KQL       │ LogQL                  │
  │ Query speed         │ Fast full-text      │ Slower (grep-style)    │
  │ Integration         │ Kibana             │ Grafana                │
  │ Good for            │ Complex log search  │ High-volume K8s logs   │
  │ Best use case       │ Security/compliance │ DevOps/SRE dashboards  │
  └─────────────────────┴────────────────────┴────────────────────────┘
```

### Installing Loki with Helm

```bash
# Add Grafana Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Loki stack (Loki + Promtail as DaemonSet + Grafana)
helm install loki-stack grafana/loki-stack \
  --namespace logging \
  --set grafana.enabled=true \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=10Gi

# Promtail (Loki's log shipper) runs as a DaemonSet
# It automatically discovers pods and ships logs to Loki
kubectl get daemonset -n logging loki-stack-promtail
```

### LogQL Basics

LogQL is Loki's query language. It uses label selectors (similar to PromQL) to filter logs, then optional filter expressions to search within log lines.

```
LogQL query anatomy:

  {selector} | filter | filter | parser | metric

Examples:

  # All logs from the production namespace
  {namespace="production"}

  # Logs from the api container in production with "error" in the line
  {namespace="production", container="api"} |= "error"

  # Filter out health check noise
  {namespace="production"} != "/health"

  # Parse JSON and filter on a field value
  {namespace="production"} | json | level="error"

  # Count error log lines per minute (metric query)
  rate({namespace="production"} |= "error" [1m])

  # Case-insensitive regex match
  {namespace="production"} |~ "(?i)exception|panic|fatal"

  # Line format: reformat log output
  {namespace="production"} | json | line_format "{{.level}} {{.msg}}"
```

```bash
# Access Loki in Grafana (port-forward to Grafana)
kubectl port-forward -n logging svc/loki-stack-grafana 3000:80

# Grafana → Explore → select Loki datasource → run LogQL queries
# Build dashboards combining Prometheus metrics and Loki logs side-by-side
```

---

## 7. kubectl logs Best Practices

### Core Commands

```bash
# Stream logs in real-time (-f = follow)
kubectl logs -f pod/api-7d9f4-x8kq

# View logs from a previous container run (crashed or restarted containers)
kubectl logs pod/api-7d9f4-x8kq --previous

# View logs from a specific container within a multi-container pod
kubectl logs pod/api-7d9f4-x8kq -c api

# Limit output to the last 100 lines
kubectl logs pod/api-7d9f4-x8kq --tail=100

# Show only logs from the last 30 minutes
kubectl logs pod/api-7d9f4-x8kq --since=30m

# Show logs since an absolute timestamp
kubectl logs pod/api-7d9f4-x8kq --since-time=2026-06-25T08:00:00Z

# Include timestamps in output
kubectl logs pod/api-7d9f4-x8kq --timestamps

# Stream logs from all pods matching a selector (useful for a Deployment)
kubectl logs -f -l app=my-api --all-containers=true --prefix=true

# Stream logs from all pods in a namespace matching a label
kubectl logs -f -l app=my-api -n production --prefix=true
```

### --previous — Debugging Crashed Containers

`--previous` is one of the most important flags for debugging crash loops. When a container crashes and Kubernetes restarts it, the new container runs fresh and produces new logs. The previous container's logs are retained briefly and accessible with `--previous`.

```bash
# Pod in CrashLoopBackOff — view the logs from the previous (crashed) run
kubectl logs pod/api-7d9f4-x8kq --previous

# View previous logs for a specific container
kubectl logs pod/api-7d9f4-x8kq -c api --previous

# Common pattern: check both current and previous logs
kubectl logs pod/api-7d9f4-x8kq > current.log
kubectl logs pod/api-7d9f4-x8kq --previous > previous.log
diff current.log previous.log
```

### Streaming Logs Across All Pods

```bash
# Follow logs from all pods with label app=api in real time
# --prefix shows which pod each line came from
kubectl logs -f -l app=api --prefix=true -n production

# Output example:
# [pod/api-7d9f4-x8kq] {"level":"info","msg":"request received","method":"GET"}
# [pod/api-7d9f4-qr2p] {"level":"error","msg":"db timeout","duration":"5001ms"}

# Use stern (third-party tool) for coloured multi-pod log tailing
# stern -n production api
```

### Structured Logging — JSON Best Practices

```
Write JSON logs from your application:

  {"timestamp":"2026-06-25T09:00:01Z","level":"info","service":"api",
   "method":"GET","path":"/orders","status":200,"duration_ms":45,
   "trace_id":"abc-123"}

Benefits:
  - Fluentd can parse fields individually → filterable in Kibana
  - Loki can parse with `| json` → filterable in LogQL
  - Consistent structure across all services
  - Machine-readable for alerting on specific fields

Avoid plain text logs:
  WRONG: "ERROR: database connection timed out after 5001ms"
  RIGHT: {"level":"error","msg":"database connection timeout",
          "duration_ms":5001,"db_host":"postgres-0.production"}
```

---

## 8. Hands-On Exercises

**Exercise 1: Deploy the EFK stack and verify log shipping**

```bash
kubectl create namespace logging

# Apply all EFK manifests (from sections 4 and 5)
kubectl apply -f fluentd-rbac.yaml
kubectl apply -f fluentd-configmap.yaml
kubectl apply -f fluentd-daemonset.yaml
kubectl apply -f elasticsearch.yaml
kubectl apply -f kibana.yaml

# Wait for all components to be ready
kubectl rollout status statefulset/elasticsearch -n logging
kubectl rollout status deployment/kibana -n logging
kubectl get daemonset fluentd -n logging

# Generate some test logs by deploying a noisy pod
kubectl run log-generator \
  --image=busybox \
  -- /bin/sh -c 'while true; do echo "{\"level\":\"info\",\"msg\":\"heartbeat\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"; sleep 2; done'

# Verify Fluentd is shipping logs
kubectl logs -n logging daemonset/fluentd --tail=20 | grep -i elasticsearch
```

---

**Exercise 2: Query logs in Kibana with index patterns and filters**

```bash
# Port-forward to Kibana
kubectl port-forward -n logging svc/kibana-svc 5601:5601

# Steps to explore in Kibana:
# 1. Stack Management → Index Patterns → Create index pattern
#    Pattern: kubernetes-*  |  Time field: @timestamp
# 2. Discover → Set time range to Last 15 minutes
# 3. Add filters:
#    - kubernetes.namespace_name: default
#    - kubernetes.container_name: log-generator
# 4. Search for specific terms: error, warning
# 5. Add columns: kubernetes.pod_name, log, level
# 6. Save the search as "Production Errors"
# 7. Create a visualisation: count of logs over time broken by level
```

---

**Exercise 3: Debug a crashing pod using --previous and structured logs**

```bash
# Deploy a pod that crashes on startup
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: crash-demo
spec:
  containers:
  - name: app
    image: busybox
    command: ["/bin/sh", "-c"]
    args:
    - |
      echo '{"level":"info","msg":"starting up"}'
      sleep 2
      echo '{"level":"error","msg":"critical config missing","key":"DATABASE_URL"}'
      exit 1
    resources:
      requests:
        memory: "32Mi"
        cpu: "50m"
      limits:
        memory: "64Mi"
        cpu: "100m"
EOF

# Watch the pod enter CrashLoopBackOff
kubectl get pod crash-demo -w

# Once it crashes, view the previous run's logs
kubectl logs crash-demo --previous

# Check the describe output for the exit code
kubectl describe pod crash-demo | grep -A 5 "Last State"
# Expected: Reason: Error, Exit Code: 1

kubectl delete pod crash-demo
```

---

**Exercise 4: Install Loki and query logs with LogQL**

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki-stack grafana/loki-stack \
  --namespace logging \
  --set grafana.enabled=true \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=false   # in-memory for dev

# Wait for pods to start
kubectl get pods -n logging -w

# Port-forward to Grafana
kubectl port-forward -n logging svc/loki-stack-grafana 3000:80

# Default password:
kubectl get secret -n logging loki-stack-grafana \
  -o jsonpath='{.data.admin-password}' | base64 -d

# In Grafana Explore with Loki datasource, run these LogQL queries:
# {namespace="default"}
# {namespace="logging"} |= "error"
# rate({namespace="default"}[1m])
```

---

**Exercise 5: Stream logs from multiple pods simultaneously and spot errors**

```bash
# Deploy a multi-replica application
kubectl create deployment multi-app \
  --image=nginx:1.25 \
  --replicas=3 \
  -n production

# Generate some 404 traffic to create error logs
kubectl run curl-client \
  --image=curlimages/curl \
  --restart=Never \
  -- /bin/sh -c 'for i in $(seq 1 20); do curl -s http://multi-app.production/notfound; done'

# Stream logs from all 3 replicas simultaneously with pod prefix
kubectl logs -f -l app=multi-app \
  --prefix=true \
  --all-containers=true \
  -n production

# Filter the stream for 404 errors (pipe to grep)
kubectl logs -f -l app=multi-app -n production --prefix=true 2>&1 | grep "404"

# Count errors per pod
kubectl logs -l app=multi-app -n production --prefix=true 2>&1 | \
  grep "404" | \
  awk -F] '{print $1}' | \
  sort | uniq -c | sort -rn

kubectl delete deployment multi-app -n production
kubectl delete pod curl-client --ignore-not-found
```

---

## 9. Interview Q&A

**Q: How does Kubernetes handle container logs, and why do you need a centralised log shipping solution?**

Answer: When a container writes to stdout or stderr, the container runtime (typically containerd) captures that output and writes it to a log file on the node's local filesystem under `/var/log/containers/`. The kubelet exposes these files through its API, which is how `kubectl logs` retrieves them. The kubelet also performs automatic log rotation — by default keeping the last 10 log files per container at 10 MiB each. This means logs are ephemeral: once a container restarts, the old log file is rotated. Once a pod is deleted or rescheduled to a different node, its logs on the original node will eventually be garbage collected. Without a centralised log shipping solution, logs from deleted pods are permanently lost. This is why running a log agent as a DaemonSet (such as Fluentd or Fluent Bit) is essential for production workloads. The agent reads from the node's log files and forwards them to a durable storage system (Elasticsearch or Loki) before they are rotated away, enabling historical search across all pods including those that no longer exist.

---

**Q: What is the difference between Fluentd and Fluent Bit, and when would you choose each?**

Answer: Fluentd and Fluent Bit are both open-source log forwarders from the same project but serve different use cases. **Fluentd** is the full-featured data collector. It has a large plugin ecosystem (hundreds of input, filter, and output plugins), supports complex routing and transformation logic, and can aggregate logs from multiple sources before forwarding. However it is written in Ruby (with C extensions) and carries a higher memory footprint — typically 40–100 MB per instance. **Fluent Bit** is the lightweight sibling. It is written entirely in C, uses 1–5 MB of memory, and is designed specifically for constrained environments like Kubernetes nodes. It covers the most common use cases (tail log files, enrich with Kubernetes metadata, forward to Elasticsearch or Loki) with minimal resource overhead. In practice: use **Fluent Bit** as the per-node DaemonSet for low-overhead log collection and forwarding. If you need complex log transformation, fan-out to multiple backends, or custom processing logic, deploy **Fluentd** as an aggregator tier that Fluent Bit feeds into. Many large-scale deployments combine both: Fluent Bit on every node (lightweight collection) → centralised Fluentd tier (transformation and routing) → Elasticsearch.

---

**Q: What are the trade-offs between EFK (Elasticsearch) and Loki for Kubernetes log storage?**

Answer: The fundamental difference is in indexing strategy. **Elasticsearch** indexes the full content of every log line — every word, every field value — allowing blazing-fast full-text search and aggregation queries across billions of log records. This power comes at significant cost: Elasticsearch requires substantial CPU and memory (typically 8–16 GB RAM per node), large disk storage for the index structures, and complex cluster management (sharding, replication, ILM policies). It is the right choice when you need powerful log analytics, compliance requirements with extensive log search, or security teams doing forensic investigation across historical logs. **Loki** deliberately avoids indexing log content. It indexes only the label set (pod name, namespace, container, etc.) and stores log chunks compressed as raw text. This makes it drastically cheaper: 10x or more reduction in storage costs. Queries work by scanning matching log chunks (like a distributed grep). Loki integrates natively with Grafana, so teams already using Prometheus/Grafana can add log correlation without a separate UI. The trade-off is that full-text searches are slower for very large log volumes. Loki is the right choice for high-volume Kubernetes observability on a budget where the primary use case is tailing logs, correlating with metrics, and catching error patterns rather than deep analytical queries.

---

**Q: How would you debug a pod that is in CrashLoopBackOff?**

Answer: CrashLoopBackOff means the container is repeatedly crashing and Kubernetes is backing off between restart attempts with exponential delay (10s, 20s, 40s, up to 5 minutes). The debugging process follows a specific order. First, `kubectl describe pod <name>` to see the Last State section — look for the exit code (137 = OOMKilled, 1 = application error, 126/127 = command not found) and the reason (Error, OOMKilled, Completed). Second, `kubectl logs <pod> --previous` to view the logs from the most recent crashed container run — this is the most important step. The `--previous` flag is essential because `kubectl logs` without it shows the current container's logs (which may be empty if it crashed immediately). Third, check events with `kubectl get events --sort-by=.metadata.creationTimestamp` — look for OOMKilled events or image pull errors. Fourth, check whether the issue is resource-related (`kubectl top pod` if the pod is running momentarily) or configuration-related (missing ConfigMaps, Secrets, or environment variables). Common root causes: memory limit too low (increase limit or fix leak), missing environment variable (add to pod spec), wrong command or entrypoint (check Dockerfile vs pod spec), application startup failure (check application logs for configuration errors), and failed health checks causing rapid restarts (adjust initialDelaySeconds on the probe).

---

**Q: What is structured logging, and why is it important in a Kubernetes environment?**

Answer: Structured logging means emitting log records as machine-parseable data — typically JSON — rather than free-form human-readable text strings. Each log record is a document with consistent, typed fields: level, timestamp, message, request ID, user ID, duration, status code, and any other relevant context. In a Kubernetes environment, structured logging becomes essential because logs from hundreds of pods across dozens of services are aggregated into a single centralised store. When every service emits JSON, Fluentd or Fluent Bit can parse those fields and store them as separate indexed fields in Elasticsearch. This enables precise filtering — `status_code:500 AND service:payment AND duration_ms:>1000` — rather than fragile regex over raw text strings. It also enables log-based metrics: Kibana can count log records by level per service, or Loki with `| json | level="error"` can drive Grafana panels showing error rates over time. Contrast this with unstructured logs like `ERROR: payment service timed out after 1523ms for user 42` — to extract the user ID, duration, or service name from thousands of such lines requires complex, brittle regex that breaks whenever the message format changes. Best practice is to pick a structured logging library (Go's `slog`, Python's `structlog`, Java's Logback with JSON encoder) and enforce it across all services in the platform.
