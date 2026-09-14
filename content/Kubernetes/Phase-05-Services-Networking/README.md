# Phase 05: Services and Networking

## What You'll Learn

This phase covers how Kubernetes exposes workloads both inside and outside the cluster. You will learn how Services abstract away individual Pod IPs and provide stable endpoints, how CoreDNS enables service discovery by name, and how NetworkPolicies let you control which Pods can talk to which. By the end of this phase you will be able to design and implement a complete networking layer for a production Kubernetes application.

## Learning Objectives

By completing this phase you will be able to:

- Create and configure all four Service types: ClusterIP, NodePort, LoadBalancer, and ExternalName
- Explain how kube-proxy routes traffic from a Service VIP to healthy Pod endpoints
- Use headless Services for direct Pod addressing and StatefulSet DNS
- Understand how CoreDNS resolves service names across namespaces using FQDN format
- Debug DNS failures inside a running Pod using nslookup and dig
- Write NetworkPolicy manifests to implement default-deny and least-privilege traffic rules
- Choose the correct CNI plugin that supports NetworkPolicy enforcement

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Services.md](./01-Services.md) | Services deep dive — ClusterIP, NodePort, LoadBalancer, ExternalName, headless, kube-proxy, endpoints | 2 days |
| [02-DNS-Service-Discovery.md](./02-DNS-Service-Discovery.md) | CoreDNS, FQDN format, DNS policies, ndots, environment variables, debugging DNS inside Pods | 2 days |
| [03-Network-Policies.md](./03-Network-Policies.md) | NetworkPolicy, default-deny patterns, ingress/egress rules, podSelector, namespaceSelector, ipBlock | 2 days |

## Estimated Time

5 - 6 days

## Previous Phase

[Phase 04 - Workloads](../Phase-04-Workloads/README.md) — Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs

## Next Phase

[Phase 06 - Storage](../Phase-06-Storage/README.md) — Volumes, PersistentVolumes, PersistentVolumeClaims, StorageClasses
