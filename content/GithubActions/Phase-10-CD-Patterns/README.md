# Phase 10: CD Patterns

## What You'll Learn

Phase 9 assembled CI's shape: get code tested and its result trusted enough to gate a merge. Phase 10 picks up right where that leaves off and builds Continuous Deployment's equivalent shape — turn tested code into a container image, get that image somewhere a running system can pull it from, update that system to actually run it, verify the update actually succeeded rather than just accepted, and, for production specifically, make sure a human signs off before any of it touches real users. Each lesson in this phase builds on the last: Lesson 1's pushed image is what Lesson 2's Kubernetes deploy step pulls, and Lesson 3's Environment gate is what decides whether Lesson 2's deploy job runs at all when the target is production.

## Learning Objectives

- Build and push a Docker image to a container registry with a sound tagging strategy — a permanent commit-SHA tag alongside a moving `latest`/branch tag — authenticating correctly (GHCR via `GITHUB_TOKEN`, or another registry via secrets) and reusing layers via caching
- Deploy a pushed image to a Kubernetes cluster using short-lived, narrowly scoped credentials where possible, and verify the rollout actually succeeded with `kubectl rollout status` rather than trusting `kubectl set image`'s immediate return
- Gate production deploy jobs behind a GitHub Environment (Phase 4) with required reviewers, keeping production's credentials scoped to that Environment specifically so an ungated `staging` job can never read them

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Container-Registry-Build-and-Push.md](01-Container-Registry-Build-and-Push.md) | Building an image with `docker/build-push-action` (or plain `docker build`/`push`), authenticating to GHCR via `GITHUB_TOKEN` or another registry via secrets, tagging with both a commit SHA and a moving `latest`/branch tag, layer caching | 1 day |
| [02-Deploying-to-Kubernetes.md](02-Deploying-to-Kubernetes.md) | Authenticating to a cluster (cloud CLI/action or a `kubeconfig` secret), updating a Deployment via `kubectl set image`/`helm upgrade`, preferring short-lived scoped credentials, verifying rollout success with `kubectl rollout status` | 1 day |
| [03-Environment-Gated-Approvals-for-Production.md](03-Environment-Gated-Approvals-for-Production.md) | Using GitHub Environments (Phase 4, Lesson 2) with required reviewers/a wait timer to gate production deploy jobs, contrasted with an ungated staging job, Environment-scoped secrets/variables preventing a production job from reading staging credentials | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 11: Security Best Practices](../Phase-11-Security-Best-Practices/README.md)
