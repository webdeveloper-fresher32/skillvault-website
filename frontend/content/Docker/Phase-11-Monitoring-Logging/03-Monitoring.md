# Monitoring — Complete Guide

## Table of Contents
1. [Monitoring Strategy for Containers](#1-monitoring-strategy-for-containers)
2. [cAdvisor — Container Metrics Exporter](#2-cadvisor--container-metrics-exporter)
3. [Prometheus — Metrics Collection and Storage](#3-prometheus--metrics-collection-and-storage)
4. [Grafana — Visualization](#4-grafana--visualization)
5. [Full Stack with Docker Compose](#5-full-stack-with-docker-compose)
6. [Prometheus Scrape Config for Docker](#6-prometheus-scrape-config-for-docker)
7. [Alerting with Alertmanager](#7-alerting-with-alertmanager)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Monitoring Strategy for Containers

Containers are ephemeral and dynamic — traditional host-based monitoring does not scale. A container-native monitoring stack needs to:

- Discover containers automatically as they start and stop
- Collect metrics at the container level, not just the host level
- Provide dashboards that correlate CPU, memory, network, and disk per container
- Alert when containers breach thresholds or when services become unhealthy

```
The four golden signals for container monitoring:

  Latency    → How long requests take
  Traffic    → How many requests per second
  Errors     → Rate of failed requests / OOM events / restarts
  Saturation → How full is the resource (CPU %, memory %)

Monitoring stack role:
  cAdvisor  → collect raw container metrics from cgroups
  Prometheus → scrape, store, query metrics (time-series DB)
  Grafana   → dashboards, graphs, alert visualization
  Alertmanager → route alerts to Slack, PagerDuty, email
```

---

## 2. cAdvisor — Container Metrics Exporter

**cAdvisor** (Container Advisor) is a Google-built open-source daemon that reads cgroup data for every container on the host and exposes it as a Prometheus-compatible HTTP endpoint.

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Host                                                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │Container │  │Container │  │Container │                 │
│  │  web     │  │   db     │  │  cache   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│       │               │             │                      │
│       └───────────────┴─────────────┘                      │
│                         │  cgroups                         │
│                         ▼                                  │
│              ┌──────────────────┐                          │
│              │    cAdvisor      │                          │
│              │  :8080/metrics   │ ◄── Prometheus scrapes  │
│              └──────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Running cAdvisor

```bash
docker run -d \
  --name cadvisor \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --volume=/dev/disk/:/dev/disk:ro \
  --publish=8080:8080 \
  --privileged \
  --device=/dev/kmsg \
  gcr.io/cadvisor/cadvisor:latest
```

Key cAdvisor metrics exposed at `http://host:8080/metrics`:

```
container_cpu_usage_seconds_total         ← cumulative CPU usage
container_memory_usage_bytes              ← current memory usage
container_memory_working_set_bytes        ← memory working set (excludes cache)
container_network_receive_bytes_total     ← bytes received on network interface
container_network_transmit_bytes_total    ← bytes transmitted
container_fs_reads_bytes_total            ← filesystem read bytes
container_fs_writes_bytes_total           ← filesystem write bytes
container_last_seen                       ← last time cAdvisor saw the container
```

---

## 3. Prometheus — Metrics Collection and Storage

Prometheus is a pull-based time-series database. It scrapes HTTP endpoints at configured intervals, stores metrics with labels, and provides a query language (PromQL) to analyse them.

```
┌──────────────────────────────────────────────────────────────────┐
│  Prometheus                                                      │
│                                                                  │
│  Scrape targets every 15s:                                       │
│    GET http://cadvisor:8080/metrics     ──▶  parse & store      │
│    GET http://node-exporter:9100/metrics──▶  parse & store      │
│    GET http://myapp:8080/metrics        ──▶  parse & store      │
│                                                                  │
│  Storage: local TSDB (default 15 days retention)                │
│                                                                  │
│  Query API:  http://prometheus:9090/api/v1/query                │
│  UI:         http://prometheus:9090                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key PromQL Queries for Container Monitoring

```promql
# CPU usage percentage per container (rate over 2m window)
rate(container_cpu_usage_seconds_total{name!=""}[2m]) * 100

# Memory usage as percentage of limit
container_memory_usage_bytes{name!=""} /
  container_spec_memory_limit_bytes{name!=""} * 100

# Network receive rate (bytes/sec)
rate(container_network_receive_bytes_total{name!=""}[5m])

# Containers that have been restarted (non-zero restart count)
changes(container_start_time_seconds{name!=""}[1h]) > 0

# Top 5 containers by memory usage
topk(5, container_memory_working_set_bytes{name!=""})
```

---

## 4. Grafana — Visualization

Grafana connects to Prometheus as a data source and renders dashboards. It supports templating so one dashboard can show metrics for any container or service.

```
Grafana Dashboard layout:

┌─────────────────────────────────────────────────────────────────┐
│  Container Overview — variable: $container                      │
├──────────────────┬──────────────────┬───────────────────────────┤
│  CPU Usage %     │  Memory Usage    │  Restart Count (24h)      │
│  ────────────    │  ██████░░░░ 60%  │  0                        │
│  ╱╲╱╲╱╲╱╲╱╲     │  300/512 MiB    │                           │
├──────────────────┴──────────────────┴───────────────────────────┤
│  Network I/O (bytes/sec)                                        │
│  RX: ─────────────────────────────────────────────────────      │
│  TX: - - - - - - - - - - - - - - - - - - - - - - - - - -       │
├─────────────────────────────────────────────────────────────────┤
│  Filesystem Reads/Writes (bytes/sec)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Pre-built Docker dashboards available at grafana.com/grafana/dashboards:
- **ID 193** — Docker and system monitoring
- **ID 11600** — Docker container and host metrics
- **ID 14282** — cAdvisor full metrics dashboard

---

## 5. Full Stack with Docker Compose

```yaml
# docker-compose.yml — Monitoring stack
version: "3.8"

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data: {}
  grafana_data: {}

services:

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    privileged: true
    devices:
      - /dev/kmsg
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=15d"
      - "--web.enable-lifecycle"
    ports:
      - "9090:9090"
    networks:
      - monitoring
    depends_on:
      - cadvisor
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=secret
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    networks:
      - monitoring
    depends_on:
      - prometheus
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    command:
      - "--config.file=/etc/alertmanager/alertmanager.yml"
    ports:
      - "9093:9093"
    networks:
      - monitoring
    restart: unless-stopped
```

---

## 6. Prometheus Scrape Config for Docker

```yaml
# prometheus/prometheus.yml

global:
  scrape_interval:     15s   # how often to scrape targets
  evaluation_interval: 15s   # how often to evaluate alert rules

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "alert_rules.yml"

scrape_configs:

  # Scrape cAdvisor for container metrics
  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]
    metrics_path: /metrics

  # Scrape Prometheus itself
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Scrape node-exporter for host-level metrics
  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  # Docker daemon metrics (enable in /etc/docker/daemon.json)
  # "metrics-addr": "0.0.0.0:9323", "experimental": true
  - job_name: "docker-daemon"
    static_configs:
      - targets: ["host.docker.internal:9323"]
```

### Enabling Docker Daemon Metrics

```json
// /etc/docker/daemon.json
{
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true
}
```

This exposes Docker daemon metrics (image pulls, container starts, goroutines, etc.) at `http://host:9323/metrics` for Prometheus to scrape.

---

## 7. Alerting with Alertmanager

### Alert Rules (prometheus/alert_rules.yml)

```yaml
groups:
  - name: container_alerts
    rules:

      # Alert if a container has been restarting
      - alert: ContainerRestarting
        expr: changes(container_start_time_seconds{name!=""}[15m]) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container {{ $labels.name }} is restarting frequently"
          description: "Container {{ $labels.name }} has restarted more than 2 times in 15 minutes."

      # Alert if container memory exceeds 90% of its limit
      - alert: ContainerHighMemory
        expr: >
          container_memory_usage_bytes{name!=""}
          / container_spec_memory_limit_bytes{name!=""}
          * 100 > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Container {{ $labels.name }} memory near limit"
          description: "Memory usage is {{ $value | humanize }}% of the limit."

      # Alert if container CPU exceeds 80% sustained
      - alert: ContainerHighCPU
        expr: rate(container_cpu_usage_seconds_total{name!=""}[5m]) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container {{ $labels.name }} high CPU usage"
```

### Alertmanager Config

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ["alertname", "container"]
  group_wait:      30s
  group_interval:  5m
  repeat_interval: 12h
  receiver: "slack-notifications"

receivers:
  - name: "slack-notifications"
    slack_configs:
      - api_url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
        channel: "#alerts"
        send_resolved: true
        title: "[{{ .Status | toUpper }}] {{ .CommonAnnotations.summary }}"
        text: "{{ .CommonAnnotations.description }}"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Deploy the full monitoring stack using the `docker-compose.yml` from section 5. Confirm all four containers (cAdvisor, Prometheus, Grafana, Alertmanager) are running. Open Prometheus at `http://localhost:9090/targets` and verify cAdvisor shows as `UP`.

**Exercise 2:** In the Prometheus UI, run the PromQL query `container_memory_usage_bytes{name!=""}` and observe memory usage per container. Switch to the Graph tab and run `rate(container_cpu_usage_seconds_total{name!=""}[2m])` to see CPU rate.

**Exercise 3:** Log into Grafana at `http://localhost:3000` (admin/secret). Add Prometheus as a data source (`http://prometheus:9090`). Import dashboard ID 193 from Grafana's dashboard library and explore the pre-built container metrics panels.

**Exercise 4:** Add the alert rule from section 7 to `prometheus/alert_rules.yml`. Run `docker compose restart prometheus`. In the Prometheus UI go to **Alerts** and confirm the rules are loaded. Trigger the high-memory alert by running a container that consumes near its memory limit.

**Exercise 5:** Enable Docker daemon metrics by editing `/etc/docker/daemon.json` (add `"metrics-addr"` and `"experimental"`). Restart Docker, then add the `docker-daemon` scrape job to `prometheus.yml` and reload Prometheus. Query `engine_daemon_container_states_containers_total` to see running/stopped/paused container counts tracked by the daemon itself.

---

## 9. Interview Q&A

**Q: What is cAdvisor and why is it used with Prometheus?**
Answer: cAdvisor (Container Advisor) is a Google open-source daemon that reads container resource usage directly from the host's cgroup filesystem and the Docker API. It exposes these metrics in Prometheus exposition format at `/metrics`. Because Prometheus is a pull-based system, it scrapes cAdvisor's HTTP endpoint on a configured interval and stores the time-series data. cAdvisor handles the complexity of translating low-level cgroup data (CPU, memory, network, filesystem) into labelled metrics that Prometheus can index by container name, image, and ID.

**Q: What is the difference between container_memory_usage_bytes and container_memory_working_set_bytes?**
Answer: `container_memory_usage_bytes` includes all memory the container is mapped to, including cached filesystem pages that the kernel can reclaim under pressure. `container_memory_working_set_bytes` excludes reclaimable cache and reflects the memory the container is actively using — this is the value Kubernetes uses for OOM eviction decisions. In practice, use `working_set_bytes` for alerting and capacity planning because it reflects the true memory pressure the container exerts.

**Q: How does Prometheus discover Docker containers automatically?**
Answer: Prometheus supports Docker service discovery via `docker_sd_configs` in its scrape configuration. It connects to the Docker daemon socket, lists running containers, and generates scrape targets from container labels. You annotate containers with labels like `prometheus.io/scrape=true` and `prometheus.io/port=8080`, and Prometheus picks them up without static target lists. In Kubernetes, Prometheus uses `kubernetes_sd_configs` with pod annotations for the same purpose. For simpler static environments, cAdvisor centralises all container metrics so only one static target is needed.

**Q: How would you alert when a container is restarting repeatedly?**
Answer: Use the PromQL expression `changes(container_start_time_seconds{name!=""}[15m]) > 2` in a Prometheus alert rule. This counts how many times `container_start_time_seconds` changed (i.e., the container restarted) within a 15-minute window. Set a `for: 5m` duration to avoid firing on a single transient restart. Route the alert through Alertmanager to Slack or PagerDuty with the container name in the annotation so on-call engineers know exactly which container to investigate.

**Q: What is the role of Grafana in the monitoring stack, and can Prometheus replace it?**
Answer: Prometheus provides a basic expression browser and graph UI at port 9090, which is useful for ad-hoc PromQL queries and debugging. However, Prometheus's UI is not designed for persistent dashboards, multi-panel layouts, templating across services, or team access control. Grafana fills that role: it connects to Prometheus (and many other data sources) as a read-only query layer and renders rich, interactive dashboards with alerting overlays, variable drop-downs, and annotations. They are complementary — Prometheus stores and queries metrics; Grafana visualises and presents them.
