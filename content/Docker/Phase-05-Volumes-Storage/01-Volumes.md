# Docker Volumes — Complete Guide

## Table of Contents
1. [What is a Docker Volume?](#1-what-is-a-docker-volume)
2. [Creating and Managing Volumes](#2-creating-and-managing-volumes)
3. [Mounting Volumes into Containers](#3-mounting-volumes-into-containers)
4. [Inspecting Volumes](#4-inspecting-volumes)
5. [Sharing Volumes Between Containers](#5-sharing-volumes-between-containers)
6. [Volume Lifecycle and Cleanup](#6-volume-lifecycle-and-cleanup)
7. [Volume Drivers](#7-volume-drivers)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Docker Volume?

A named volume is a Docker-managed storage unit stored on the host filesystem but fully controlled by the Docker daemon. Unlike the container's writable layer, a volume persists independently — it survives container removal and can be attached to new containers.

```
Host filesystem layout (Docker-managed):
/var/lib/docker/
└── volumes/
    ├── pgdata/
    │   └── _data/          ← actual Postgres data lives here
    │       ├── pg_hba.conf
    │       ├── base/
    │       └── global/
    ├── redis-cache/
    │   └── _data/
    └── app-logs/
        └── _data/

Container view:
  /var/lib/postgresql/data  → mapped to pgdata/_data
  /data                     → mapped to redis-cache/_data
  /var/log/app              → mapped to app-logs/_data
```

### Why use named volumes instead of the writable container layer?

```
Container writable layer:           Named volume:
─────────────────────────           ──────────────────────────
Discarded on docker rm              Survives docker rm
Tied to one container               Shareable across containers
Slower writes (copy-on-write)       Direct writes, faster I/O
Hard to back up                     Easy to back up (_data dir)
Not portable                        Portable via volume drivers
```

---

## 2. Creating and Managing Volumes

```bash
# Create a named volume
docker volume create pgdata

# Create with labels
docker volume create \
  --label env=production \
  --label app=postgres \
  pgdata-prod

# List all volumes
docker volume ls
# DRIVER    VOLUME NAME
# local     pgdata
# local     pgdata-prod
# local     redis-cache

# Filter volumes by label
docker volume ls --filter "label=env=production"

# Filter by driver
docker volume ls --filter "driver=local"

# Remove a single volume
docker volume rm pgdata

# Remove all unused volumes (not mounted by any container)
docker volume prune

# Remove specific volumes in bulk
docker volume rm pgdata redis-cache app-logs
```

---

## 3. Mounting Volumes into Containers

Docker supports two syntaxes: the older `-v` flag and the newer `--mount` flag. Both achieve the same result; `--mount` is more explicit and recommended for scripts.

### -v / --volume syntax

```bash
# Syntax: -v <volume-name>:<container-path>[:<options>]

# Mount named volume into Postgres container
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15

# Mount read-only
docker run -d \
  -v myconfig:/etc/app/config:ro \
  myapp:latest

# If the volume does not exist, Docker creates it automatically
docker run -d -v newvol:/data busybox
```

### --mount syntax (preferred)

```bash
# Syntax: --mount type=volume,source=<name>,target=<path>[,options]

docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  --mount type=volume,source=pgdata,target=/var/lib/postgresql/data \
  postgres:15

# Read-only mount
docker run -d \
  --mount type=volume,source=myconfig,target=/etc/app/config,readonly \
  myapp:latest

# tmpfs (in-memory, never written to disk)
docker run -d \
  --mount type=tmpfs,target=/tmp/session-data,tmpfs-size=64m \
  myapp:latest
```

### -v vs --mount comparison

```
Feature                  -v flag          --mount flag
─────────────────────────────────────────────────────────
Creates volume if missing  yes              yes
Explicit syntax            no               yes
Multiple options           colon-separated  comma-separated
Volume vs bind ambiguity   yes (confusing)  no (type= required)
Works in Docker Swarm      yes              yes (preferred)
Readable in scripts        harder           clearer
```

---

## 4. Inspecting Volumes

```bash
# Inspect a volume (full JSON)
docker volume inspect pgdata
# [
#   {
#     "CreatedAt": "2024-03-15T10:22:01Z",
#     "Driver": "local",
#     "Labels": {},
#     "Mountpoint": "/var/lib/docker/volumes/pgdata/_data",
#     "Name": "pgdata",
#     "Options": {},
#     "Scope": "local"
#   }
# ]

# Find which containers are using a volume
docker ps --filter "volume=pgdata"

# Inspect a container's mounts
docker inspect postgres --format '{{json .Mounts}}' | python3 -m json.tool
# [
#   {
#     "Type": "volume",
#     "Name": "pgdata",
#     "Source": "/var/lib/docker/volumes/pgdata/_data",
#     "Destination": "/var/lib/postgresql/data",
#     "Mode": "",
#     "RW": true,
#     "Propagation": ""
#   }
# ]

# Browse volume contents directly (Linux host)
ls /var/lib/docker/volumes/pgdata/_data

# Browse via a temporary container (works on all platforms)
docker run --rm \
  -v pgdata:/data \
  busybox \
  ls -la /data
```

---

## 5. Sharing Volumes Between Containers

Multiple containers can mount the same volume simultaneously. This is how sidecars, log shippers, and data pipelines share data without networking.

```
                    ┌───────────────────────────────────┐
                    │         Named Volume: appdata      │
                    │   /var/lib/docker/volumes/appdata  │
                    └──────────────┬────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
    ┌──────────▼──────┐  ┌─────────▼──────┐  ┌────────▼───────┐
    │   app container  │  │ log-shipper    │  │ backup-cron    │
    │  /data (rw)      │  │ /data (ro)     │  │ /data (ro)     │
    │  writes files    │  │ reads + ships  │  │ tarballs data  │
    └──────────────────┘  └────────────────┘  └────────────────┘
```

```bash
# Start the primary writer container
docker run -d \
  --name app \
  -v appdata:/data \
  myapp:latest

# Attach the log-shipper sidecar (read-only)
docker run -d \
  --name log-shipper \
  -v appdata:/data:ro \
  fluentd:latest

# Attach the backup cron (read-only)
docker run -d \
  --name backup \
  -v appdata:/data:ro \
  backup-agent:latest

# Verify both see the same files
docker exec app touch /data/testfile.txt
docker exec log-shipper ls /data/testfile.txt
# /data/testfile.txt  ← confirms shared access
```

### Volumes from another container (--volumes-from)

```bash
# Inherit all mount points from an existing container
docker run -d \
  --name sidecar \
  --volumes-from app \
  busybox sleep 3600

# sidecar now has the same /data mount as app
# Note: --volumes-from copies all mounts including writable ones
# Prefer explicit -v for production; --volumes-from is mostly legacy
```

---

## 6. Volume Lifecycle and Cleanup

```
Volume lifecycle:
  docker volume create  →  volume exists, empty
        │
  docker run -v name:/path  →  volume mounted, container writes data
        │
  docker stop / docker rm  →  volume STILL exists (data preserved)
        │
  docker run -v name:/path  →  new container mounts same data
        │
  docker volume rm  →  volume deleted (data gone permanently)
        │
  docker volume prune  →  all UNUSED volumes deleted
```

```bash
# Safe cleanup workflow
# 1. Stop and remove containers first
docker stop app log-shipper backup
docker rm app log-shipper backup

# 2. Now volume is unused
docker volume ls
# DRIVER    VOLUME NAME
# local     appdata   ← still exists, no container using it

# 3. Remove it explicitly
docker volume rm appdata

# OR: remove container AND its anonymous volumes together
docker rm -v <container_id>  # -v removes anonymous volumes only
```

---

## 7. Volume Drivers

The default driver is `local`, which stores data on the Docker host. Volume plugins extend this to remote and cloud storage.

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Volume API                         │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼──────────────────┐
        │           │                  │
  ┌─────▼─────┐ ┌───▼──────┐  ┌───────▼───────┐
  │   local   │ │  nfs     │  │  cloud drivers │
  │ (default) │ │  driver  │  │  aws-ebs       │
  │ host disk │ │ NFS share│  │  azure-file    │
  └───────────┘ └──────────┘  │  gce-pd        │
                               └───────────────┘
```

```bash
# Local driver with custom options (NFS via local driver)
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw \
  --opt device=:/mnt/nfs/share \
  nfs-vol

# Local driver with tmpfs backend (in-memory volume)
docker volume create \
  --driver local \
  --opt type=tmpfs \
  --opt device=tmpfs \
  --opt o=size=100m \
  tmpfs-vol

# Install third-party driver (example: rexray for AWS EBS)
docker plugin install rexray/ebs \
  EBS_ACCESSKEY=AKIA... \
  EBS_SECRETKEY=secret...

# Create EBS-backed volume
docker volume create \
  --driver rexray/ebs \
  --opt size=10 \
  ebs-pgdata

# List available plugins
docker plugin ls
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create a named volume called `webdata`. Run an nginx container mounting `webdata` at `/usr/share/nginx/html`. Copy a custom `index.html` into the volume via a busybox container. Start the nginx container and verify your page is served.

**Exercise 2:** Start a Postgres container with `-v pgdata:/var/lib/postgresql/data`. Create a database and table. Remove the container with `docker rm`. Start a fresh Postgres container with the same `-v pgdata` flag — verify the database and table still exist.

**Exercise 3:** Run two containers mounting the same volume — one as read-write (`app`) and one as read-only (`reader`). Write a file from `app`. Verify `reader` can see it. Attempt a write from `reader` and observe the permission error.

**Exercise 4:** Use `docker volume inspect` on a volume to find its `Mountpoint`. On a Linux host browse to that path directly and list the files. Use `docker inspect <container> --format '{{json .Mounts}}'` to confirm the same path is reported.

**Exercise 5:** Create a volume using the local driver with NFS options (or simulate with a tmpfs option). Run `docker volume ls` and `docker volume inspect` to confirm the custom driver options are stored. Remove the volume with `docker volume rm`.

---

## 9. Interview Q&A

**Q: What is the difference between a named volume and an anonymous volume?**
Answer: A named volume is created with an explicit name (`docker volume create pgdata` or `-v pgdata:/path`) and persists until explicitly removed. An anonymous volume is created when you specify a container path with no name (`-v /data`) — Docker generates a random ID for it. Anonymous volumes are removed with `docker rm -v` but not by `docker volume prune` unless also unreferenced, making named volumes much easier to manage in practice.

**Q: Does data in a named volume survive `docker rm`?**
Answer: Yes. A named volume's lifecycle is independent of any container. `docker rm` removes the container and its writable layer but leaves all named volumes intact. You must explicitly run `docker volume rm <name>` or `docker volume prune` to delete the data. This is the primary reason to use named volumes for databases and persistent state.

**Q: What is the difference between `-v` and `--mount`?**
Answer: Both flags mount storage into a container, but `--mount` uses explicit key-value pairs (`type=`, `source=`, `target=`) which removes ambiguity — Docker can tell immediately whether you mean a named volume, a bind mount, or a tmpfs. The `-v` flag uses a positional colon-separated string; if the first segment looks like a host path Docker treats it as a bind mount, otherwise as a named volume, which can be confusing in scripts. `--mount` is the recommended syntax for Dockerfiles, Compose files, and Swarm services.

**Q: How do you back up and restore a Docker volume?**
Answer: Run a temporary container that mounts the target volume and a host directory, then use `tar` to archive the contents. For example: `docker run --rm -v pgdata:/data -v $(pwd):/backup busybox tar czf /backup/pgdata.tar.gz -C /data .`. Restore by extracting into a new volume: `docker run --rm -v pgdata-new:/data -v $(pwd):/backup busybox tar xzf /backup/pgdata.tar.gz -C /data`. This works regardless of which storage driver backs the volume.

**Q: When would you use a volume driver instead of the default local driver?**
Answer: Use a volume driver when data must survive the Docker host itself — for example, in a Docker Swarm cluster where a service can reschedule onto any node, or in a cloud environment where you want data on managed block storage (AWS EBS, Azure Files, GCE Persistent Disk). The volume driver plugin abstracts the underlying storage so containers treat remote or cloud-backed storage exactly like a local volume.
