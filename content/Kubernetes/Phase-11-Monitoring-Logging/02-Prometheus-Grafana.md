# Prometheus & Grafana on Kubernetes — Complete Guide

## Table of Contents
1. [Prometheus Architecture](#1-prometheus-architecture)
2. [Installing kube-prometheus-stack](#2-installing-kube-prometheus-stack)
3. [ServiceMonitors & PodMonitors](#3-servicemonitors--podmonitors)
4. [Key Kubernetes Metrics](#4-key-kubernetes-metrics)
5. [PromQL Basics](#5-promql-basics)
6. [Grafana Dashboards](#6-grafana-dashboards)
7. [AlertManager](#7-alertmanager)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Prometheus Architecture

### The Pull-Based Scrape Model

Prometheus operates on a **pull** model — rather than receiving metrics that applications push to it, Prometheus periodically scrapes HTTP endpoints (the `/metrics` path) exposed by each target. This is the fundamental design choice that makes Prometheus easy to operate: targets don't need to know where Prometheus lives, and Prometheus can detect when a target is down simply by failing to scrape it.

```
Prometheus pull-based architecture:

   ┌────────────────────────────────────────────────────────────────┐
   │                    Kubernetes Cluster                          │
   │                                                                │
   │   ┌──────────────┐      scrapes /metrics     ┌─────────────┐  │
   │   │  Prometheus  │ ──────────────────────────▶│  app-pod-1  │  │
   │   │   Server     │ ──────────────────────────▶│  app-pod-2  │  │
   │   │  (TSDB)      │ ──────────────────────────▶│  node-exp.  │  │
   │   │              │ ──────────────────────────▶│  kube-state │  │
   │   └──────┬───────┘                            └─────────────┘  │
   │          │                                                      │
   │          │  PromQL queries                                      │
   │          ▼                                                      │
   │   ┌──────────────┐      alerts                ┌─────────────┐  │
   │   │   Grafana    │              ┌─────────────▶│AlertManager │  │
   │   │  Dashboards  │              │             └──────┬──────┘  │
   │   └──────────────┘              │                    │         │
   │                       firing    │             routes │         │
   │                       alerts    │                    ▼         │
   │                                 │             ┌─────────────┐  │
   │                          ───────┘             │ PagerDuty / │  │
   │                                               │   Slack     │  │
   │                                               └─────────────┘  │
   └────────────────────────────────────────────────────────────────┘
```

### Core Components

**Prometheus Server** contains:
- **Retrieval**: the scrape engine that pulls metrics from targets on a configurable interval (default: 15s)
- **TSDB (Time Series Database)**: an embedded high-performance time series database stored on local disk, optimised for append-only write patterns and fast range queries
- **HTTP API**: exposes PromQL query endpoints consumed by Grafana and other tools
- **Service Discovery**: queries the Kubernetes API server to automatically discover new pods and services without manual configuration

```
Time series data model:

  metric_name{label1="value1", label2="value2"} <float64> [timestamp]

  Examples:
  container_memory_usage_bytes{pod="api-7d9f-x8kq", container="app", namespace="production"} 204800000 1750812034000
  node_cpu_seconds_total{cpu="0", mode="user", instance="node-1:9100"} 54321.12 1750812034000
  http_requests_total{method="GET", status="200", handler="/health"} 9823 1750812034000
```

### How Service Discovery Works in Kubernetes

Prometheus queries the Kubernetes API server to discover all pods, services, and endpoints. When a new pod is created and matches a scrape config or ServiceMonitor selector, Prometheus automatically begins scraping it — no restarts or manual config changes required.

```
Prometheus service discovery flow:

  Kubernetes API Server
        │
        │  List/Watch pods, services, endpoints
        ▼
  Prometheus SD (every 5m default)
        │
        │  Found: new pod with label app=my-api
        │  Annotation: prometheus.io/scrape: "true"
        ▼
  Prometheus adds target:
    http://10.0.0.42:8080/metrics
        │
        │  Scrape every 15s
        ▼
  Metrics stored in TSDB with labels:
    pod="my-api-7d9f-x8kq"
    namespace="production"
    node="worker-1"
```

---

## 2. Installing kube-prometheus-stack

### What kube-prometheus-stack Includes

The `kube-prometheus-stack` Helm chart is the canonical way to deploy a full observability stack on Kubernetes. It bundles everything in a single chart and wires the components together automatically.

```
kube-prometheus-stack components:

  ┌─────────────────────────────────────────────────────────────────┐
  │                   kube-prometheus-stack                         │
  │                                                                 │
  │  ┌────────────────────────┐   ┌────────────────────────────┐    │
  │  │  Prometheus Operator   │   │       Grafana              │    │
  │  │  - manages Prometheus  │   │  - pre-built dashboards    │    │
  │  │    via CRDs            │   │  - auto-provisioned DS     │    │
  │  │  - manages Alertmanager│   │  - default admin password  │    │
  │  └────────────────────────┘   └────────────────────────────┘    │
  │                                                                 │
  │  ┌────────────────────────┐   ┌────────────────────────────┐    │
  │  │  node-exporter         │   │  kube-state-metrics        │    │
  │  │  (DaemonSet)           │   │  - deployment replicas     │    │
  │  │  - host CPU/mem/disk   │   │  - pod phase/status        │    │
  │  │  - network stats       │   │  - resource requests       │    │
  │  │  - filesystem          │   │  - resource limits         │    │
  │  └────────────────────────┘   └────────────────────────────┘    │
  │                                                                 │
  │  ┌────────────────────────┐                                     │
  │  │  AlertManager          │                                     │
  │  │  - deduplication       │                                     │
  │  │  - routing             │                                     │
  │  │  - silences            │                                     │
  │  └────────────────────────┘                                     │
  └─────────────────────────────────────────────────────────────────┘
```

### Installing with Helm

```bash
# Add the prometheus-community Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create a dedicated namespace for monitoring
kubectl create namespace monitoring

# Install the kube-prometheus-stack chart
helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=admin123 \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=20Gi

# Verify all components are running
kubectl get pods -n monitoring
```

```
Expected pods after install:

  NAME                                                     READY   STATUS
  alertmanager-kube-prometheus-stack-alertmanager-0        2/2     Running
  kube-prometheus-stack-grafana-7d9f4-x8kq                 3/3     Running
  kube-prometheus-stack-kube-state-metrics-6d8f9-vp2rk     1/1     Running
  kube-prometheus-stack-operator-5b8c7-nqm4                1/1     Running
  kube-prometheus-stack-prometheus-node-exporter-abc12     1/1     Running  ← one per node
  kube-prometheus-stack-prometheus-node-exporter-def34     1/1     Running
  prometheus-kube-prometheus-stack-prometheus-0            2/2     Running
```

### Custom values.yaml for Production

```yaml
# values.yaml — production-grade kube-prometheus-stack
prometheus:
  prometheusSpec:
    retention: 30d
    retentionSize: "40GB"
    replicas: 2           # HA: two Prometheus instances
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
    resources:
      requests:
        cpu: "500m"
        memory: "2Gi"
      limits:
        cpu: "2"
        memory: "4Gi"

grafana:
  adminPassword: "changeme-in-production"
  persistence:
    enabled: true
    size: 10Gi

alertmanager:
  alertmanagerSpec:
    replicas: 2
    storage:
      volumeClaimTemplate:
        spec:
          resources:
            requests:
              storage: 5Gi
```

```bash
# Apply updated values
helm upgrade kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values values.yaml
```

---

## 3. ServiceMonitors & PodMonitors

### Why CRDs Instead of Static Config

Without the Prometheus Operator, adding a new scrape target requires editing Prometheus's `prometheus.yml` configuration file and reloading or restarting Prometheus. This does not fit the Kubernetes declarative model.

The Prometheus Operator introduces **ServiceMonitor** and **PodMonitor** CRDs. Teams declare their scrape configuration as Kubernetes objects in their own namespaces. The Operator watches for these CRDs and dynamically updates the Prometheus configuration without any manual intervention.

```
ServiceMonitor workflow:

  Team deploys:  my-api Deployment + Service
                  │
                  │  also creates:
                  ▼
  ServiceMonitor CRD (my-api-monitor.yaml)
    - selector: matchLabels app=my-api
    - endpoints: port: metrics, interval: 30s
                  │
                  │  Prometheus Operator watches CRDs
                  ▼
  Operator updates Prometheus config automatically
                  │
                  │  Prometheus begins scraping
                  ▼
  http://my-api-svc.production.svc:8080/metrics
```

### ServiceMonitor YAML — Full Example

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-api-monitor
  namespace: production
  labels:
    release: kube-prometheus-stack   # must match Prometheus selector
spec:
  selector:
    matchLabels:
      app: my-api                    # selects services with this label
  namespaceSelector:
    matchNames:
    - production                     # which namespaces to search
  endpoints:
  - port: metrics                    # named port on the Service
    path: /metrics                   # metrics endpoint path
    interval: 30s                    # scrape every 30 seconds
    scrapeTimeout: 10s
    honorLabels: false
    relabelings:
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod
    metricRelabelings:
    - sourceLabels: [__name__]
      regex: "go_.*"
      action: drop                   # drop Go runtime metrics to save storage
```

The corresponding Service must expose a named port:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api-svc
  namespace: production
  labels:
    app: my-api                      # matches ServiceMonitor selector
spec:
  selector:
    app: my-api
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: metrics                    # named port used by ServiceMonitor
    port: 9090
    targetPort: 9090
```

### PodMonitor YAML — Scraping Pods Directly

Use a PodMonitor when there is no Service in front of the pods, or when you need per-pod metrics rather than load-balanced metrics through a Service.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: batch-job-monitor
  namespace: production
  labels:
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app: batch-processor
  namespaceSelector:
    matchNames:
    - production
  podMetricsEndpoints:
  - port: metrics
    path: /metrics
    interval: 60s                    # slower interval for batch jobs
```

### Verifying Scrape Targets

```bash
# Port-forward to Prometheus UI to inspect targets
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Then open http://localhost:9090/targets
# All UP = healthy scrape, DOWN = connection refused or timeout

# Check if ServiceMonitor was picked up
kubectl get servicemonitor -n production
kubectl describe servicemonitor my-api-monitor -n production

# Check Prometheus config reload (Operator reconciles every ~30s)
kubectl logs -n monitoring \
  $(kubectl get pod -n monitoring -l app.kubernetes.io/name=prometheus-operator \
    -o name) --tail=20
```

---

## 4. Key Kubernetes Metrics

### Node Metrics — node-exporter

node-exporter runs as a DaemonSet and exposes low-level host metrics from each node.

```
node_cpu_seconds_total
  Labels: {cpu, mode, instance}
  Modes: user, system, idle, iowait, steal
  Usage: rate(node_cpu_seconds_total{mode="idle"}[5m])
  → measures CPU utilisation per core and mode

node_memory_MemAvailable_bytes
  Labels: {instance}
  Usage: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes
  → node memory availability percentage

node_filesystem_avail_bytes
  Labels: {instance, device, mountpoint}
  Usage: node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}
  → disk space utilisation

node_network_receive_bytes_total
node_network_transmit_bytes_total
  Labels: {instance, device}
  Usage: rate(node_network_receive_bytes_total[5m])
  → network throughput per interface
```

### Container Metrics — cAdvisor (built into kubelet)

```
container_cpu_usage_seconds_total
  Labels: {container, pod, namespace, node}
  Usage: rate(container_cpu_usage_seconds_total{container!=""}[5m])
  → CPU cores used per container over time

container_memory_usage_bytes
  Labels: {container, pod, namespace}
  Note: includes cache — use container_memory_working_set_bytes for actual usage
  → raw RSS + page cache memory

container_memory_working_set_bytes
  Labels: {container, pod, namespace}
  Usage: container_memory_working_set_bytes{container!=""}
  → active memory usage (what OOM killer uses for limit comparisons)

container_cpu_cfs_throttled_seconds_total
  Labels: {container, pod, namespace}
  Usage: rate(container_cpu_cfs_throttled_seconds_total[5m])
  → time the container was CPU throttled (exceeding its limit)
```

### Kubernetes Object Metrics — kube-state-metrics

```
kube_pod_container_restarts_total
  Labels: {container, pod, namespace}
  Usage: increase(kube_pod_container_restarts_total[1h]) > 5
  → containers restarting more than 5 times per hour

kube_deployment_status_replicas_available
  Labels: {deployment, namespace}
  Usage: kube_deployment_status_replicas_available
       / kube_deployment_spec_replicas < 1
  → deployments with fewer replicas than desired

kube_pod_status_phase
  Labels: {phase, pod, namespace}
  Phases: Running, Pending, Succeeded, Failed, Unknown
  Usage: kube_pod_status_phase{phase="Failed"} > 0
  → any pods in failed state

kube_node_status_condition
  Labels: {condition, node, status}
  Conditions: Ready, MemoryPressure, DiskPressure, PIDPressure
  Usage: kube_node_status_condition{condition="Ready",status="true"}
  → node health status
```

### Metric Summary Table

```
┌─────────────────────────────────────────────┬──────────────────────────────┐
│  Metric                                     │  Source                      │
├─────────────────────────────────────────────┼──────────────────────────────┤
│ node_cpu_seconds_total                      │ node-exporter                │
│ node_memory_MemAvailable_bytes              │ node-exporter                │
│ node_filesystem_avail_bytes                 │ node-exporter                │
│ container_cpu_usage_seconds_total           │ cAdvisor (kubelet)           │
│ container_memory_working_set_bytes          │ cAdvisor (kubelet)           │
│ container_cpu_cfs_throttled_seconds_total   │ cAdvisor (kubelet)           │
│ kube_pod_container_restarts_total           │ kube-state-metrics           │
│ kube_deployment_status_replicas_available   │ kube-state-metrics           │
│ kube_pod_status_phase                       │ kube-state-metrics           │
│ kube_node_status_condition                  │ kube-state-metrics           │
└─────────────────────────────────────────────┴──────────────────────────────┘
```

---

## 5. PromQL Basics

### The Fundamental Building Blocks

PromQL (Prometheus Query Language) operates on time series data. Understanding a handful of core functions covers the vast majority of real-world use cases.

### rate() — Per-Second Rate of Increase

`rate()` calculates the per-second average rate of increase of a counter over a time window. Use it with counters (metrics that only ever increase, like `_total` metrics).

```promql
# CPU usage as a fraction of one core, per container, over the last 5 minutes
rate(container_cpu_usage_seconds_total{container!="", namespace="production"}[5m])

# HTTP request rate per second
rate(http_requests_total{status=~"5.."}[5m])

# Node network receive throughput in bytes/sec
rate(node_network_receive_bytes_total{device="eth0"}[5m])
```

```
Why [5m]?
  The range vector [5m] tells Prometheus to use the last 5 minutes of data
  to calculate the rate. Too short (e.g. [30s]) produces noisy results.
  Too long (e.g. [1h]) smooths out spikes you want to see. 5m is the
  standard starting point for most alerting and dashboards.
```

### sum() and by() — Aggregation

```promql
# Total CPU usage across all containers in a namespace
sum(rate(container_cpu_usage_seconds_total{namespace="production"}[5m]))

# CPU usage summed per pod (one result per pod)
sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="production"}[5m]))

# Total memory usage per namespace
sum by (namespace) (container_memory_working_set_bytes{container!=""})

# Count of pod restarts per namespace
sum by (namespace) (increase(kube_pod_container_restarts_total[1h]))
```

### avg_over_time() — Average Over a Range

```promql
# Average CPU usage per pod over the last hour (for capacity planning)
avg_over_time(
  rate(container_cpu_usage_seconds_total{pod=~"my-api-.*"}[5m])
[1h:]
)
```

### absent() — Detect Missing Metrics

`absent()` returns 1 if the given time series does not exist. Use this to alert when a target has stopped sending metrics — i.e., it has gone down or crashed.

```promql
# Alert if the my-api scrape target has disappeared entirely
absent(up{job="my-api"})

# Alert if a specific container has no metrics (container has vanished)
absent(container_memory_working_set_bytes{container="payment-service"})
```

### histogram_quantile() — Latency Percentiles

```promql
# 99th percentile request latency for the past 5 minutes
histogram_quantile(0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{job="my-api"}[5m])
  )
)

# 50th, 95th, and 99th percentiles on one graph (use multiple queries)
histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```

### Practical Alert-Worthy Queries

```promql
# Memory usage above 90% of limit
(container_memory_working_set_bytes / on(container, pod, namespace)
  kube_pod_container_resource_limits{resource="memory"}) > 0.9

# Deployment replicas below desired count
kube_deployment_status_replicas_available
  / kube_deployment_spec_replicas < 1

# Node CPU utilisation above 80%
1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) > 0.8

# Containers being CPU throttled for more than 25% of their time
rate(container_cpu_cfs_throttled_seconds_total[5m])
  / rate(container_cpu_cfs_periods_total[5m]) > 0.25
```

---

## 6. Grafana Dashboards

### Accessing Grafana

```bash
# Port-forward to Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Open http://localhost:3000
# Default credentials: admin / admin123 (or what you set during install)

# Alternatively, expose via an Ingress (for permanent access):
kubectl get svc -n monitoring kube-prometheus-stack-grafana
```

### Pre-Built Dashboards in kube-prometheus-stack

The stack pre-provisions several dashboards automatically. These are ready immediately after installation with no extra configuration.

```
Pre-provisioned dashboards:

  "Kubernetes / Compute Resources / Cluster"
    → Cluster-wide CPU and memory usage overview
    → Quota utilisation per namespace

  "Kubernetes / Compute Resources / Namespace (Pods)"
    → Per-pod CPU and memory usage within a namespace
    → CPU throttling rate per container

  "Kubernetes / Compute Resources / Node (Pods)"
    → All pods on a specific node and their resource usage

  "Node Exporter / Full"
    → Detailed per-node metrics: CPU, memory, disk I/O, network
    → Filesystem usage with alerts on low space

  "Kubernetes / Networking / Cluster"
    → Network bandwidth per pod and namespace
    → Packet loss and error rates

  "Alertmanager / Overview"
    → Active alerts, alert history, inhibition rules
```

### Importing Community Dashboards by ID

Grafana's dashboard library (grafana.com/grafana/dashboards) contains hundreds of pre-built community dashboards. Import them using a dashboard ID.

```bash
# Notable dashboard IDs:
# 1860  → Node Exporter Full (extremely detailed node metrics)
# 13332 → Kubernetes All-in-One Cluster Monitoring
# 6417  → Kubernetes Cluster (Prometheus)
# 7249  → Kubernetes Cluster Overview

# How to import:
# Grafana UI → Dashboards → Import → Enter dashboard ID → Load → Select
# Prometheus datasource → Import
```

### Creating a Simple Custom Dashboard

```
Useful panels to add to a custom application dashboard:

  Panel 1: Request Rate
    Query: rate(http_requests_total{job="my-api"}[5m])
    Visualisation: Time series
    Unit: requests/sec

  Panel 2: Error Rate
    Query: rate(http_requests_total{job="my-api", status=~"5.."}[5m])
         / rate(http_requests_total{job="my-api"}[5m])
    Visualisation: Stat (big number)
    Unit: percent (0-100)

  Panel 3: p99 Latency
    Query: histogram_quantile(0.99, sum by (le)
             (rate(http_request_duration_seconds_bucket{job="my-api"}[5m])))
    Visualisation: Time series
    Unit: seconds

  Panel 4: Memory Usage vs Limit
    Query: container_memory_working_set_bytes{pod=~"my-api-.*"}
    Query: kube_pod_container_resource_limits{resource="memory", pod=~"my-api-.*"}
    Visualisation: Time series (two lines)
    Unit: bytes
```

```bash
# Export a dashboard as JSON for GitOps
# Grafana UI → Dashboard → Share → Export → Save to file
# Store the JSON in your git repository and use Grafana ConfigMaps to provision it

# Grafana ConfigMap for auto-provisioning dashboards:
kubectl create configmap my-app-dashboard \
  --from-file=my-app.json \
  -n monitoring \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## 7. AlertManager

### AlertManager's Role

Prometheus fires alerts based on PromQL rules. AlertManager receives those alerts and handles the operational concerns: deduplication (same alert from two Prometheus replicas fires once), grouping (multiple alerts about the same service bundled into one notification), inhibition (suppress low-priority alerts when a high-priority one fires), silences, and routing to different receivers based on alert labels.

```
Alert lifecycle:

  Prometheus evaluates PrometheusRule every 1m (default)
          │
          │  condition is true for "for: 5m" duration
          ▼
  Alert enters PENDING state
          │
          │  condition remains true for 5 minutes
          ▼
  Alert enters FIRING state → sent to AlertManager
          │
          ├──────────────────────────────────────────────────┐
          │  AlertManager:                                   │
          │  1. Deduplicate (HA: two Prometheus fire same)   │
          │  2. Group by (namespace, alertname)              │
          │  3. Route based on labels                        │
          │  4. Wait groupWait: 30s before first send        │
          │  5. Send to receiver (Slack / PagerDuty / email) │
          └──────────────────────────────────────────────────┘
```

### PrometheusRule CRD — Defining Alerts

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-api-alerts
  namespace: production
  labels:
    release: kube-prometheus-stack    # must match Prometheus ruleSelector
spec:
  groups:
  - name: my-api.rules
    interval: 1m
    rules:
    # Alert when any pod in the deployment has been restarting frequently
    - alert: PodCrashLooping
      expr: |
        increase(kube_pod_container_restarts_total{namespace="production"}[1h]) > 5
      for: 5m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Pod {{ $labels.pod }} is crash-looping"
        description: >
          Pod {{ $labels.pod }} in namespace {{ $labels.namespace }}
          has restarted {{ $value }} times in the last hour.

    # Alert when deployment is not fully available
    - alert: DeploymentReplicasMismatch
      expr: |
        kube_deployment_status_replicas_available
          / kube_deployment_spec_replicas < 1
      for: 10m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Deployment {{ $labels.deployment }} has fewer replicas than desired"
        description: >
          Deployment {{ $labels.deployment }} in {{ $labels.namespace }}
          has {{ $value | humanizePercentage }} of desired replicas available.

    # Alert on high memory usage (>85% of limit)
    - alert: ContainerMemoryHighUsage
      expr: |
        (container_memory_working_set_bytes{container!=""}
          / on(container, pod, namespace)
          kube_pod_container_resource_limits{resource="memory"}) > 0.85
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Container {{ $labels.container }} memory usage > 85%"
        description: >
          Container {{ $labels.container }} in pod {{ $labels.pod }}
          is using {{ $value | humanizePercentage }} of its memory limit.
```

### AlertManager Routing Configuration

```yaml
# AlertManager configuration (via kube-prometheus-stack values or Secret)
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-kube-prometheus-stack-alertmanager
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
      slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

    route:
      group_by: ['namespace', 'alertname', 'severity']
      group_wait: 30s        # wait 30s before sending first notification
      group_interval: 5m     # wait 5m before sending second batch
      repeat_interval: 4h    # resend if alert still firing after 4h
      receiver: 'slack-default'

      routes:
      # Critical alerts go to PagerDuty
      - match:
          severity: critical
        receiver: 'pagerduty-critical'
        continue: true       # also sends to slack-default

      # Platform team alerts go to their Slack channel
      - match:
          team: platform
        receiver: 'slack-platform'

    receivers:
    - name: 'slack-default'
      slack_configs:
      - channel: '#alerts'
        title: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Details:* {{ .Annotations.description }}
          *Namespace:* {{ .Labels.namespace }}
          {{ end }}
        send_resolved: true

    - name: 'slack-platform'
      slack_configs:
      - channel: '#platform-alerts'
        send_resolved: true

    - name: 'pagerduty-critical'
      pagerduty_configs:
      - routing_key: '<PAGERDUTY_INTEGRATION_KEY>'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
```

```bash
# Verify AlertManager is receiving and routing alerts
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
# Open http://localhost:9093 → view active alerts, silences, and routes

# Check AlertManager configuration was loaded correctly
kubectl logs -n monitoring alertmanager-kube-prometheus-stack-alertmanager-0 \
  -c alertmanager | grep -i "loading\|error"

# Create a silence for planned maintenance (via amtool CLI)
amtool --alertmanager.url=http://localhost:9093 silence add \
  alertname="PodCrashLooping" \
  --comment="Planned restart" \
  --duration=1h
```

---

## 8. Hands-On Exercises

**Exercise 1: Install kube-prometheus-stack and verify all components**

```bash
# Add Helm repo and install
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
kubectl create namespace monitoring

helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=admin123

# Verify all pods are running
kubectl get pods -n monitoring -w

# Port-forward to Prometheus and check /targets
kubectl port-forward -n monitoring \
  svc/kube-prometheus-stack-prometheus 9090:9090

# Open http://localhost:9090/targets — all targets should be UP
# Navigate to Graph → query: up
# All values should be 1 (up), not 0 (down)
```

---

**Exercise 2: Deploy a custom app with a /metrics endpoint and wire a ServiceMonitor**

```yaml
# custom-app.yaml — app exposing Prometheus metrics on :9090/metrics
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-app
  template:
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
      - name: app
        image: prom/prometheus:latest   # Prometheus itself exposes /metrics — useful for demo
        ports:
        - containerPort: 9090
          name: metrics
---
apiVersion: v1
kind: Service
metadata:
  name: demo-app-svc
  namespace: production
  labels:
    app: demo-app
spec:
  selector:
    app: demo-app
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: demo-app-monitor
  namespace: production
  labels:
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app: demo-app
  endpoints:
  - port: metrics
    interval: 30s
```

```bash
kubectl create namespace production
kubectl apply -f custom-app.yaml

# Verify ServiceMonitor is present
kubectl get servicemonitor -n production

# In Prometheus UI (port-forward to 9090), navigate to:
# Status → Targets → look for demo-app endpoints showing as UP
# Status → Configuration → search for demo-app
```

---

**Exercise 3: Write PromQL queries to investigate cluster resource usage**

```bash
# Port-forward to Prometheus
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Open http://localhost:9090/graph and run each query:

# Query 1: CPU utilisation per node (% of capacity)
# 1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))

# Query 2: Memory usage by namespace
# sum by (namespace) (container_memory_working_set_bytes{container!=""})

# Query 3: Top 5 pods by memory usage
# topk(5, container_memory_working_set_bytes{container!=""})

# Query 4: Any pods that have restarted more than 3 times in the last hour
# increase(kube_pod_container_restarts_total[1h]) > 3

# Query 5: Percentage of desired replicas available per deployment
# kube_deployment_status_replicas_available / kube_deployment_spec_replicas
```

---

**Exercise 4: Create a PrometheusRule and trigger it**

```bash
kubectl apply -f - <<'EOF'
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: exercise-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
  - name: exercise.rules
    rules:
    - alert: HighPodRestartRate
      expr: increase(kube_pod_container_restarts_total[10m]) > 2
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} restarted {{ $value }} times"
EOF

# Trigger a crashing pod
kubectl run crash-test --image=busybox \
  --restart=Always \
  -- /bin/sh -c "exit 1"

# Watch the pod restart repeatedly
kubectl get pod crash-test -w

# In Prometheus UI: Alerts tab should show HighPodRestartRate as PENDING then FIRING
kubectl delete pod crash-test
```

---

**Exercise 5: Import a community Grafana dashboard and explore it**

```bash
# Port-forward to Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# Open http://localhost:3000, log in with admin/admin123

# Import dashboard ID 1860 (Node Exporter Full):
# Left sidebar → Dashboards → Import → Enter ID: 1860 → Load
# Select Prometheus datasource → Import

# Explore the dashboard:
# - Switch between nodes using the "instance" variable at the top
# - Look at CPU Usage, Memory, Disk I/O panels
# - Notice the time-range selector top-right — change to Last 1h

# Import dashboard ID 13332 (Kubernetes All-in-One Cluster Monitoring):
# Repeat the import process with ID 13332
# Explore the cluster-wide view, namespace drill-down, pod details
```

---

## 9. Interview Q&A

**Q: What is the difference between Prometheus and metrics-server in Kubernetes?**

Answer: Prometheus and metrics-server serve fundamentally different purposes despite both collecting metrics. **metrics-server** is a lightweight, in-memory component that collects only CPU and memory usage from each node's kubelet. It retains only the most recent data point — there is no historical storage. It exists solely to power `kubectl top` commands and the Horizontal Pod Autoscaler. It is not designed for querying, dashboards, or alerting. **Prometheus** is a full time series database and monitoring system. It scrapes any metrics endpoint (not just CPU/memory), stores data with configurable retention (days or weeks), supports rich PromQL queries, integrates with Grafana for visualisation, and drives AlertManager for alerting. In a production cluster you typically run both: metrics-server for the HPA and `kubectl top`, and Prometheus/Grafana for observability, dashboarding, and alerting.

---

**Q: What is a ServiceMonitor and why is it preferable to static scrape configuration?**

Answer: A ServiceMonitor is a Custom Resource Definition (CRD) introduced by the Prometheus Operator. It represents a Prometheus scrape configuration as a native Kubernetes object. The Prometheus Operator watches for ServiceMonitor resources across namespaces and automatically reconciles Prometheus's internal configuration to match — no Prometheus restarts required. The alternative is editing `prometheus.yml` directly and reloading Prometheus, which doesn't fit the Kubernetes declarative model and requires cluster-level access just to add a new scrape target. With ServiceMonitors, each application team can deploy their own ServiceMonitor in their namespace, decoupling the monitoring configuration from Prometheus administration. The ServiceMonitor uses label selectors to target the Service objects to scrape, and the Operator discovers the actual pod endpoints behind those services. This means when new replicas are added or pods are replaced, Prometheus automatically scrapes the new endpoints without any configuration change.

---

**Q: Explain the difference between rate() and irate() in PromQL.**

Answer: Both `rate()` and `irate()` calculate the per-second rate of increase of a counter, but they use different calculation methods that produce very different results. `rate()` calculates the rate over the entire specified range window, using linear regression across all data points in that window. For `rate(metric[5m])`, it uses all samples collected in the last 5 minutes to compute a smoothed average rate. This makes `rate()` resistant to spikes — a momentary burst smoothed across the window. `irate()` calculates the rate using only the last two data points in the range window (hence "instantaneous"). This makes it extremely sensitive to recent changes but also noisy. A brief spike in the last scrape interval will show a much higher value with `irate()` than with `rate()`. In practice: use `rate()` for alerting rules and dashboards (the smoothing avoids false alerts from single noisy samples), and use `irate()` when you specifically want to see the most current rate with high responsiveness — for example, during live debugging where you want to see a spike the moment it happens.

---

**Q: How does AlertManager handle deduplication when running with two Prometheus replicas?**

Answer: In a high-availability setup, you run two Prometheus replicas scraping the same targets. Both replicas will independently evaluate alerting rules and both will fire the same alert when a condition is triggered. Without deduplication, you would receive two notifications for every single alert. AlertManager solves this through its deduplication mechanism. When two identical alerts arrive (matching on all alert labels including alertname, namespace, severity, and any other labels), AlertManager treats them as the same alert rather than two separate ones. The deduplication key is the combination of all alert labels — if two alerts have exactly the same label set, they are considered duplicates. This is why it is important that both Prometheus replicas produce alerts with identical labels. AlertManager also uses `group_by` configuration to further aggregate related alerts into a single notification — for example, grouping all critical alerts in the same namespace into one Slack message rather than sending a separate message per alert. The `group_wait` setting controls how long AlertManager waits to collect alerts in the same group before sending the first notification.

---

**Q: What are the four golden signals and how would you implement them in Prometheus?**

Answer: The four golden signals are a monitoring philosophy from Google's SRE book. They are the minimal set of metrics that, if monitored, give you a complete picture of a service's health. **Latency** is the time to service a request — monitored via histogram metrics and PromQL's `histogram_quantile()` to compute p50, p95, p99 response times. **Traffic** is the demand on the system — monitored via `rate(http_requests_total[5m])` to see requests per second, broken down by endpoint or method. **Errors** is the rate of failing requests — monitored via `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])` to compute the error ratio. **Saturation** is how full or overloaded the service is — monitored via CPU throttling (`rate(container_cpu_cfs_throttled_seconds_total[5m])`), memory pressure (`container_memory_working_set_bytes / limit`), and queue depth metrics if the application exposes them. These four signals are the foundation of any application Grafana dashboard. Alert on all four: if error rate exceeds 1%, if p99 latency exceeds SLO, if CPU throttling exceeds 25%, or if traffic drops to near zero (indicating the service may be down).
