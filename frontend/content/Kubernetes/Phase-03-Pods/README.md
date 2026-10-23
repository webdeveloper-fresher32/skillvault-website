# Phase 3: Pods

## What You'll Learn

Pods are the atomic unit of scheduling in Kubernetes — every workload you run, whether a web server, a worker process, or a database, runs inside a Pod. This phase teaches you how to define Pods using YAML manifests, understand the fields that control resource allocation and runtime behaviour, trace a Pod through its full lifecycle from Pending to Terminating, and design multi-container Pods using patterns like sidecar, ambassador, and adapter. By the end of this phase you will be comfortable writing and troubleshooting Pod specs from scratch and explaining why Kubernetes chose the Pod as its fundamental deployment unit.

## Learning Objectives

- Write a complete Pod manifest including metadata, container spec, ports, environment variables, and volume mounts
- Configure resource requests and limits for CPU and memory, and explain the difference between the two
- Assign labels to Pods and use label selectors to filter and query resources
- Trace a Pod through all lifecycle phases: Pending, Running, Succeeded, Failed, Unknown
- Configure liveness, readiness, and startup probes to control health checking and traffic routing
- Implement multi-container Pod patterns — sidecar, ambassador, and adapter — and explain when to use each
- Use `kubectl` commands to create, inspect, stream logs from, exec into, and delete Pods
- Explain how containers within a Pod share a network namespace and communicate over localhost

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Pod-Fundamentals.md](01-Pod-Fundamentals.md) | Pod definition, YAML spec, shared network and storage, resource requests/limits, labels, annotations, kubectl commands | 2 days |
| [02-Pod-Lifecycle.md](02-Pod-Lifecycle.md) | Lifecycle phases, init containers, liveness/readiness/startup probes, termination grace period, restart policies | 2 days |
| [03-Multi-Container-Pods.md](03-Multi-Container-Pods.md) | Sidecar, ambassador, and adapter patterns, shared volumes between containers, when to co-locate vs separate | 1 day |

## Estimated Time

5–7 days

## Previous Phase

← [Phase 2: Architecture](../Phase-02-Architecture/README.md)

## Next Phase

→ [Phase 4: Workloads](../Phase-04-Workloads/README.md)
