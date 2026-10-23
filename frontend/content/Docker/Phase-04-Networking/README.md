# Phase 04 - Docker Networking

## Overview

This phase covers Docker networking concepts including bridge, host, and overlay networks, DNS resolution between containers, and port mapping strategies. By the end of this phase you will be able to design and manage container networking for both single-host and multi-host setups.

## Learning Objectives

By completing this phase you will be able to:

- Create and manage custom Docker networks
- Connect containers to one or more networks
- Understand how Docker DNS resolution works between containers
- Map container ports to host ports for external access
- Differentiate between network drivers and choose the right one for a given use case
- Inspect network configuration and troubleshoot connectivity issues

## Topics

| File | Topic | Estimated Time |
|------|-------|---------------|
| [01-Docker-Networking.md](./01-Docker-Networking.md) | Core networking concepts - bridge, host, and overlay networks, custom network creation, connecting containers | 2 days |
| [02-Network-Drivers.md](./02-Network-Drivers.md) | Network drivers in depth - bridge, host, overlay, macvlan, none - use cases and configuration | 2 days |
| [03-Port-Mapping.md](./03-Port-Mapping.md) | Port mapping and publishing - `-p` and `-P` flags, binding to specific interfaces, exposing vs publishing ports | 1 day |

## Estimated Time

4 - 5 days

## Prerequisites

- Phase 03 - Docker Images (building images, Dockerfile, layers, caching)
- Familiarity with basic networking concepts (IP addresses, ports, protocols)

## Key Concepts Covered

- **Bridge network** - the default network driver for containers on a single host
- **Host network** - removes network isolation between container and Docker host
- **Overlay network** - spans multiple Docker hosts, used with Docker Swarm
- **DNS resolution** - how containers discover each other by name on a custom network
- **Port mapping** - exposing container services to the host and external clients

## What's Next

**Phase 05 - Volumes** - persistent data storage, bind mounts, volume drivers, and sharing data between containers.
