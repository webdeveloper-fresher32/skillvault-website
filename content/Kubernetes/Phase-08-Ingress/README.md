# Phase 8: Ingress

## What You'll Learn
This phase covers Kubernetes Ingress — the mechanism for routing external HTTP and HTTPS traffic into your cluster services. You'll learn how Ingress resources work, how to install and configure Ingress controllers, and how to secure traffic with TLS certificates including automated certificate management.

## Learning Objectives
- Understand what Ingress is and how it differs from a Service of type LoadBalancer
- Configure host-based and path-based HTTP routing rules
- Install and configure the NGINX Ingress Controller
- Compare popular Ingress controller options
- Terminate TLS at the Ingress layer
- Automate certificate management with cert-manager and Let's Encrypt
- Apply annotations to customise Ingress controller behaviour

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Ingress-Fundamentals.md](01-Ingress-Fundamentals.md) | Ingress Fundamentals — HTTP Routing into Kubernetes | 1 day |
| [02-Ingress-Controllers.md](02-Ingress-Controllers.md) | Ingress Controllers — NGINX, Traefik, and Cloud-Native Options | 1 day |
| [03-TLS-SSL.md](03-TLS-SSL.md) | TLS & SSL — Securing Ingress with Certificates | 1 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 7: Configuration & Secrets](../Phase-07-Config-Secrets/README.md)

## Next Phase
→ [Phase 9: RBAC & Security](../Phase-09-RBAC/README.md)
