# Phase 2: Kubernetes Architecture

## What You'll Learn

Understand the internal components that make Kubernetes work — the control plane processes that manage cluster state, the worker node agents that run your workloads, and the kubectl CLI that lets you interact with all of it. This phase gives you the mental model needed to debug issues, design clusters, and understand how Kubernetes decisions are made.

## Learning Objectives

- Describe the role of each control plane component (API Server, etcd, Scheduler, Controller Manager)
- Explain how the worker node components (kubelet, kube-proxy) interact with the control plane
- Understand how requests flow through the Kubernetes API
- Configure and use kubectl across multiple contexts and namespaces
- Read and write resource manifests using both imperative and declarative approaches

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Control-Plane.md](01-Control-Plane.md) | API Server, etcd, Scheduler, Controller Manager, cloud controller | 1 day |
| [02-Worker-Nodes.md](02-Worker-Nodes.md) | kubelet, kube-proxy, container runtime, node conditions, taints | 1 day |
| [03-kubectl-CLI.md](03-kubectl-CLI.md) | kubectl config, contexts, namespaces, commands, output formats | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Pods](../Phase-03-Pods/README.md)
