# Phase 7: Configuration & Secrets

## What You'll Learn
This phase covers how Kubernetes manages application configuration and sensitive data. You'll learn to separate configuration from container images using ConfigMaps and Secrets, and inject them into pods as environment variables or volume mounts.

## Learning Objectives
- Understand the difference between ConfigMaps and Secrets
- Create ConfigMaps from literals, files, and directories
- Create and use Kubernetes Secrets safely
- Inject configuration as environment variables and volume mounts
- Understand base64 encoding vs encryption
- Use the Downward API for pod/container metadata
- Apply best practices for secret management

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-ConfigMaps.md](01-ConfigMaps.md) | ConfigMaps — Creating and Using Application Configuration | 1 day |
| [02-Secrets.md](02-Secrets.md) | Secrets — Managing Sensitive Data | 1 day |
| [03-Environment-Variables.md](03-Environment-Variables.md) | Environment Variables — env, envFrom, and the Downward API | 1 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 6: Storage & Volumes](../Phase-06-Storage/README.md)

## Next Phase
→ [Phase 8: Ingress](../Phase-08-Ingress/README.md)
