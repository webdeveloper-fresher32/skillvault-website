# Phase 05 - Docker Volumes and Storage

## Overview

This phase covers how Docker manages persistent and ephemeral data, including named volumes, bind mounts, tmpfs mounts, and the storage drivers that underpin every container's writable layer. By the end of this phase you will be able to keep data alive beyond a container's lifetime, share files between the host and running containers, and understand the trade-offs between different storage strategies.

## Learning Objectives

By completing this phase you will be able to:

- Create and manage named Docker volumes
- Persist data so it survives container removal and recreation
- Mount host directories into containers using bind mounts
- Use tmpfs mounts for sensitive or temporary in-memory data
- Explain how storage drivers manage a container's writable layer
- Choose the appropriate storage strategy for a given use case
- Inspect and troubleshoot volume and mount configuration

## Topics

| File | Topic | Estimated Time |
|------|-------|----------------|
| [01-Volumes.md](./01-Volumes.md) | Named volumes - creating, mounting, inspecting, and removing volumes, sharing volumes between containers, volume drivers | 2 days |
| [02-Bind-Mounts.md](./02-Bind-Mounts.md) | Bind mounts - mounting host paths into containers, read-only mounts, use cases for local development and config injection | 1 day |
| [03-Storage-Drivers.md](./03-Storage-Drivers.md) | Storage drivers - overlay2, devicemapper, btrfs, how the union filesystem works, performance considerations | 1 day |

## Estimated Time

3 - 4 days

## Prerequisites

- Phase 03 - Docker Containers (running, stopping, removing containers, container lifecycle)

## Key Concepts Covered

- **Named volume** - a Docker-managed storage unit that persists independently of any container
- **Bind mount** - a direct mapping from a host filesystem path into a container
- **tmpfs mount** - an in-memory mount that is never written to disk, discarded when the container stops
- **Storage driver** - the mechanism Docker uses to manage the layered union filesystem of each container image and writable layer
- **overlay2** - the default and recommended storage driver on most Linux systems
- **Volume driver** - a plugin that allows volumes to be backed by remote or cloud storage

## What's Next

**Phase 06 - Docker Compose** - defining and running multi-container applications with a single YAML file, service networking, and volume declarations in Compose.
