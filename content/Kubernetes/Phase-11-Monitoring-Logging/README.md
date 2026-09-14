# Phase 11: Monitoring & Logging

Resource management, Prometheus/Grafana metrics, and EFK log aggregation for production Kubernetes clusters.

## What You'll Learn

This phase covers the observability stack for Kubernetes: how to set resource requests and limits to prevent noisy-neighbour problems, how Prometheus scrapes metrics from cluster components and applications, how to build Grafana dashboards and AlertManager rules, and how to aggregate logs from all pods using the EFK (Elasticsearch + Fluentd + Kibana) stack. By the end you will be able to monitor cluster health, alert on anomalies, and drill into logs for any workload.

## Learning Objectives

- Configure resource requests, limits, and QoS classes for pods
- Understand LimitRange and ResourceQuota at the namespace level
- Use kubectl top to inspect live CPU and memory consumption
- Deploy kube-prometheus-stack via Helm and understand ServiceMonitors
- Write PromQL queries to answer real operational questions
- Configure AlertManager routes and receivers (Slack, PagerDuty)
- Deploy the EFK stack and understand the Fluentd DaemonSet log pipeline
- Apply structured logging best practices in containerised applications

## Topics

| File | Topic | Time |
|------|-------|------|
| 01-Resource-Management.md | Resource requests/limits, QoS classes, LimitRange, ResourceQuota | 2 days |
| 02-Prometheus-Grafana.md | Prometheus architecture, ServiceMonitor, PromQL, Grafana, AlertManager | 2 days |
| 03-Logging-EFK.md | Logging strategies, EFK stack, Fluentd DaemonSet, Loki alternative | 2 days |

## Estimated Time

1 week

## Previous Phase

Phase 10: Security

## Next Phase

Phase 12: Production
