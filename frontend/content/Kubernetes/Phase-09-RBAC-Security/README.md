# Phase 9: RBAC & Security

## What You'll Learn
Kubernetes RBAC (Role-Based Access Control) and cluster security. Learn how to control who can do what in your cluster through Roles, ClusterRoles, RoleBindings, and ServiceAccounts. Covers Pod Security Standards, security contexts, admission controllers, OPA/Gatekeeper, image scanning, and CIS benchmarks.

## Learning Objectives
- Understand the RBAC model — subjects, resources, and verbs
- Create Roles and ClusterRoles with the least-privilege principle
- Bind roles to users, groups, and ServiceAccounts via RoleBindings
- Create and configure ServiceAccounts for workloads
- Use kubectl auth can-i to audit permissions
- Apply Pod Security Standards (Privileged, Baseline, Restricted)
- Harden Pods with securityContext settings
- Understand admission controllers and OPA/Gatekeeper
- Follow CIS Kubernetes benchmark recommendations

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-RBAC.md](01-RBAC.md) | RBAC — Roles, ClusterRoles, and Bindings | 2 days |
| [02-ServiceAccounts.md](02-ServiceAccounts.md) | ServiceAccounts — Identity for Workloads | 1 day |
| [03-Security-Best-Practices.md](03-Security-Best-Practices.md) | Security Best Practices — Pod Security, Admission, and Hardening | 2 days |

## Estimated Time
5 days

## Previous Phase
→ [Phase 8: Ingress](../Phase-08-Ingress/README.md)

## Next Phase
→ [Phase 10: Helm](../Phase-10-Helm/README.md)
