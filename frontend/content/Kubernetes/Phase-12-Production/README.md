# Phase 12: Kubernetes in Production

CI/CD pipelines, autoscaling, and production-hardening patterns for Kubernetes workloads.

## What You'll Learn

This phase bridges the gap between functional Kubernetes workloads and production-grade deployments. You will learn how to wire up CI/CD pipelines that build, push, and deploy to Kubernetes automatically, how GitOps tools like ArgoCD enable declarative, audit-trailed deployments, how to use HPA, VPA, and KEDA to scale workloads automatically, and how to apply the operational patterns that make clusters resilient: pod disruption budgets, topology spread, anti-affinity, graceful shutdown, and multi-tenant resource isolation.

## Learning Objectives

- Build a CI/CD pipeline that deploys to Kubernetes on every push
- Understand GitOps principles and deploy ArgoCD to manage cluster state
- Configure blue/green and canary deployments for zero-downtime releases
- Set up HPA to scale pods based on CPU, memory, or custom metrics
- Understand VPA and KEDA for vertical and event-driven autoscaling
- Configure Cluster Autoscaler to add and remove nodes automatically
- Apply PodDisruptionBudgets and topology spread constraints for HA
- Implement pre-stop hooks and graceful shutdown for zero-downtime rolling updates
- Back up and restore etcd for disaster recovery
- Apply multi-tenancy patterns with namespaces, RBAC, and ResourceQuotas

## Topics

| File | Topic | Time |
|------|-------|------|
| 01-CI-CD-Kubernetes.md | CI/CD pipelines, GitOps, ArgoCD, blue/green, canary | 2 days |
| 02-Autoscaling.md | HPA, VPA, KEDA, Cluster Autoscaler | 2 days |
| 03-Production-Best-Practices.md | HA, PDB, topology spread, graceful shutdown, disaster recovery | 2 days |

## Estimated Time

1 week

## Previous Phase

Phase 11: Monitoring & Logging

## Next Phase

Quick Reference
