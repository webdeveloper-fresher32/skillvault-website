# Phase 4: Workloads

## What You'll Learn

This phase covers Kubernetes workload controllers — the higher-level objects that manage Pod lifecycle at scale so you never have to create Pods directly in production. You will learn how Deployments wrap ReplicaSets to give you rolling updates and rollback, how DaemonSets ensure every node runs exactly one copy of a Pod, how StatefulSets provide ordered deployment and stable network identities for stateful applications, and how Jobs and CronJobs run batch and scheduled workloads to completion. By the end of this phase you will be able to choose the right controller for any workload type and operate each one confidently in a production cluster.

## Learning Objectives

By completing this phase you will be able to:

- Create and manage Deployments with custom update strategies (RollingUpdate and Recreate)
- Perform rolling updates, monitor rollout progress with `kubectl rollout status`, and roll back to a previous revision
- Scale Deployments manually with `kubectl scale` and understand how the Horizontal Pod Autoscaler automates this
- Configure maxSurge and maxUnavailable to balance update speed against availability requirements
- Deploy a DaemonSet and explain how it guarantees one Pod per node including nodes added after the DaemonSet is created
- Use node selectors and tolerations to restrict DaemonSet Pods to a subset of nodes
- Deploy a StatefulSet with a headless Service and explain why ordered creation, stable hostnames, and persistent volume claims matter for stateful workloads
- Create Jobs with parallelism and completions settings, and design CronJobs for recurring batch tasks
- Track Job completion and inspect logs from completed Job Pods

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Deployments.md](./01-Deployments.md) | Deployments deep dive — ReplicaSet relationship, rolling updates, maxSurge/maxUnavailable, rollback, scaling, rollout commands | 2–3 days |
| [02-ReplicaSets-DaemonSets.md](./02-ReplicaSets-DaemonSets.md) | ReplicaSets standalone use cases, DaemonSets — node coverage, update strategies, tolerations and node selectors | 2 days |
| [03-StatefulSets-Jobs.md](./03-StatefulSets-Jobs.md) | StatefulSets — ordered deployment, stable DNS, PVC templates; Jobs — parallelism, completions, backoffLimit; CronJobs — schedule syntax, concurrency policy | 2–3 days |

## Estimated Time

6 – 8 days

## Previous Phase

[Phase 03 - Pods](../Phase-03-Pods/README.md) — Pod spec, init containers, multi-container patterns, probes, resource requests and limits

## Next Phase

[Phase 05 - Services and Networking](../Phase-05-Services-Networking/README.md) — Services, ClusterIP, NodePort, LoadBalancer, CoreDNS, NetworkPolicies
