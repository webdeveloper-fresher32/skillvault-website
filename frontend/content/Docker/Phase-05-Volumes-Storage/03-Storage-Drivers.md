# Storage Drivers — Complete Guide

## Table of Contents
1. [What is a Storage Driver?](#1-what-is-a-storage-driver)
2. [Union Filesystem and Layering](#2-union-filesystem-and-layering)
3. [Copy-on-Write Mechanics](#3-copy-on-write-mechanics)
4. [overlay2 — The Default Driver](#4-overlay2--the-default-driver)
5. [Other Storage Drivers](#5-other-storage-drivers)
6. [Checking and Configuring the Driver](#6-checking-and-configuring-the-driver)
7. [Performance Considerations](#7-performance-considerations)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Storage Driver?

A storage driver is the component of the Docker daemon responsible for managing the layered union filesystem that every container image and running container uses. It answers two questions:

1. How are image layers stored on disk and stacked into a unified view?
2. How is a container's writable layer created and isolated from the read-only image layers?

```
Docker Architecture — where the storage driver fits:

  docker run myapp:latest
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │              Docker Daemon                   │
  │                                             │
  │  Image Store  ─►  Storage Driver  ─►  Container │
  │  (layers on        (mounts layers,     (unified  │
  │   disk)             CoW, diff)          FS view)  │
  └─────────────────────────────────────────────┘
        │
        ▼
  /var/lib/docker/<driver>/   ← storage driver data root
```

### Available storage drivers

| Driver | Linux kernel feature | Status |
|--------|---------------------|--------|
| `overlay2` | OverlayFS | Default, recommended |
| `fuse-overlayfs` | FUSE-based OverlayFS | Rootless containers |
| `btrfs` | Btrfs snapshots | Btrfs filesystem required |
| `zfs` | ZFS snapshots | ZFS filesystem required |
| `devicemapper` | Device Mapper thin provisioning | Deprecated (legacy) |
| `vfs` | Plain copy (no CoW) | Testing only |

---

## 2. Union Filesystem and Layering

A union filesystem presents multiple directories (layers) as a single merged view. Docker uses this so multiple containers can share the same image layers on disk without duplicating data.

```
Image: myapp:v2 on disk        What a container sees
─────────────────────────      ─────────────────────────────
Layer 4 (COPY . /app)          /app/server.js      (Layer 4)
Layer 3 (RUN npm install)      /app/node_modules/  (Layer 3)
Layer 2 (COPY package.json)    /app/package.json   (Layer 2)
Layer 1 (FROM node:18-alpine)  /usr/local/bin/node (Layer 1)
                               /bin /etc /usr ...  (Layer 1)

All image layers = read-only.
Container writable layer on top = read-write (ephemeral).
```

### Layer sharing across images and containers

```
                    Disk (one copy each)        Running containers
                    ────────────────────        ────────────────────────────────
node:18-alpine  ──► Layer A (alpine base)  ──►  container-1 (myapp:v1)
                    Layer B (Node.js)       ──►  container-2 (myapp:v2)
                                            ──►  container-3 (express-api)
myapp:v1        ──► Layer A (shared)
                    Layer B (shared)
                    Layer C (npm install v1)
                    Layer D (COPY v1 app)

myapp:v2        ──► Layer A (shared)        3 containers, 2 images —
                    Layer B (shared)        Layers A and B stored ONCE.
                    Layer C (npm install v2) Each container has its own
                    Layer E (COPY v2 app)    thin writable layer (KBs).
```

---

## 3. Copy-on-Write Mechanics

Copy-on-Write (CoW) is the mechanism that lets multiple containers share the same image layers while still being able to "modify" files independently. No data is copied until a write actually occurs.

```
CoW step-by-step — container modifies /etc/nginx/nginx.conf:

Step 1: Container reads /etc/nginx/nginx.conf
  ┌─────────────────────────────────────────────┐
  │ Container writable layer (empty)             │
  ├─────────────────────────────────────────────┤
  │ Layer 3 (COPY nginx.conf)  ← file lives here│  Container reads from here
  ├─────────────────────────────────────────────┤
  │ Layer 2 (RUN apt-get ...)                    │
  ├─────────────────────────────────────────────┤
  │ Layer 1 (FROM debian)                        │
  └─────────────────────────────────────────────┘

Step 2: Container writes /etc/nginx/nginx.conf
  ┌─────────────────────────────────────────────┐
  │ Container writable layer                     │
  │   nginx.conf ← COPY-UP: file copied here    │  Container now reads from here
  │               and modified                   │  (shadows Layer 3 copy)
  ├─────────────────────────────────────────────┤
  │ Layer 3 (COPY nginx.conf)  ← unchanged      │  Other containers still see original
  ├─────────────────────────────────────────────┤
  │ Layer 2 ...                                  │
  └─────────────────────────────────────────────┘

The image layer is NEVER modified. Each container gets its own copy of the file
in its own writable layer. Removing the container discards its writable layer.
```

### What copy-on-write costs

```
First write to a file already in an image layer:
  1. Storage driver finds the file in the image layers (one lookup per layer)
  2. Copies the entire file up to the container's writable layer
  3. Write proceeds on the copy

Cost:
  → Small files: negligible (microseconds)
  → Large files (database files): noticeable — first write copies the whole file
  → This is why databases should use volumes, NOT the container's writable layer
```

---

## 4. overlay2 — The Default Driver

`overlay2` is the default and recommended storage driver for Docker on Linux. It uses the kernel's OverlayFS which directly supports multiple lower layers, making it efficient and fast.

### Directory structure on disk

```bash
# overlay2 stores each layer as a directory under:
ls /var/lib/docker/overlay2/
# l/                             ← symlinks (short names to avoid ENAMETOOLONG)
# abc123.../                     ← layer directory
# def456.../
# ...

# A running container's layer directory contains:
ls /var/lib/docker/overlay2/<container-layer-id>/
# diff/    ← the actual filesystem diff (files changed by this layer)
# link     ← this layer's short symlink name
# lower    ← colon-separated list of lower layer symlinks
# merged/  ← the unified view (only present for running containers)
# work/    ← internal OverlayFS scratch directory
```

### OverlayFS mount structure

```
OverlayFS kernel mount:
  upperdir  = container writable layer (diff/)
  lowerdir  = image layers, bottom to top (colon-separated)
  workdir   = internal scratch space (work/)
  merged    = unified view presented to the container process

kernel command (conceptual):
  mount -t overlay overlay \
    -o lowerdir=layer1:layer2:layer3:layer4,\
       upperdir=container-diff,\
       workdir=container-work \
    /container-merged

Container process reads/writes /container-merged.
Only upperdir is writable. All lowerdirs are read-only.
```

### How overlay2 handles the layers

```
Image: myapp:latest (4 image layers + 1 container layer)

/var/lib/docker/overlay2/
  l/
    AB → ../abcdef1.../diff     (Layer 1 — base OS)
    CD → ../234567.../diff      (Layer 2 — dependencies)
    EF → ../89abcd.../diff      (Layer 3 — app code)
    GH → ../ef0123.../diff      (Layer 4 — entrypoint)
    IJ → ../456789.../diff      (Container writable layer)

OverlayFS sees:
  lowerdir = l/GH:l/EF:l/CD:l/AB   (top image layer to bottom)
  upperdir = 456789.../diff          (container's writable layer)
  merged   = 456789.../merged        (what the container process sees)
```

---

## 5. Other Storage Drivers

### btrfs

```bash
# btrfs uses native Btrfs subvolumes and snapshots for layers
# Requires the Docker data root to be on a Btrfs-formatted filesystem

# Advantages:
#   - Efficient snapshots at the filesystem level (instant, no copy)
#   - Can use Btrfs send/receive for efficient image transfer
#   - No per-file CoW overhead — snapshot granularity is the subvolume

# Disadvantages:
#   - Requires Btrfs filesystem (can't use ext4 or xfs host)
#   - More complex administration
#   - Less common than overlay2

# Check if your filesystem is Btrfs
df -T /var/lib/docker
# Filesystem     Type  ...
# /dev/sda1      btrfs ...   ← btrfs driver can be used
```

### devicemapper (legacy — do not use in new deployments)

```
devicemapper used Linux Device Mapper thin provisioning to manage layers.
Each layer was a thin-provisioned block device — flexible but complex.

Two modes:
  loop-lvm  → uses loopback files (extremely slow, dev-only)
  direct-lvm → uses a dedicated block device (production-viable but complex)

Deprecated in Docker 18.09+. Removed from future Linux kernel.
Migrate to overlay2.
```

### vfs (testing only)

```bash
# vfs does NO copy-on-write — every layer is a full directory copy.
# Each image layer and container layer is physically copied to disk.

# Used only for:
#   - CI environments where CoW is not supported (some nested containers)
#   - Testing the Docker daemon without kernel FS support

# Performance: very slow, uses large amounts of disk space
# Never use in development or production
```

---

## 6. Checking and Configuring the Driver

```bash
# Check current storage driver
docker info | grep "Storage Driver"
# Storage Driver: overlay2

# Full storage driver details
docker info
# Storage Driver: overlay2
#   Backing Filesystem: extfs
#   Supports d_type: true
#   Using metacopy: false
#   Native Overlay Diff: true
#   userxattr: false

# Inspect a specific container's storage driver usage
docker inspect <container_id> | grep -A5 '"GraphDriver"'
# "GraphDriver": {
#   "Data": {
#     "LowerDir": "/var/lib/docker/overlay2/abc.../diff:...",
#     "MergedDir": "/var/lib/docker/overlay2/def.../merged",
#     "UpperDir": "/var/lib/docker/overlay2/def.../diff",
#     "WorkDir": "/var/lib/docker/overlay2/def.../work"
#   },
#   "Name": "overlay2"
# }
```

### Changing the storage driver

```json
// Edit or create /etc/docker/daemon.json
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
```

```bash
# Apply the change
sudo systemctl restart docker

# WARNING: changing the storage driver means all existing images and
# containers become inaccessible. Back up data before switching.
# Docker does NOT migrate data between drivers automatically.
```

---

## 7. Performance Considerations

```
Storage driver performance comparison:

Driver       Write speed    Read speed    CoW overhead   Recommendation
──────────────────────────────────────────────────────────────────────
overlay2     Fast           Fast          Low            Use this
btrfs        Fast           Fast          Low (snapshot) Use on Btrfs FS
zfs          Fast           Fast          Low (snapshot) Use on ZFS FS
devicemapper Fast (direct)  Fast          Medium         Deprecated
vfs          Slow           Slow          None (copies)  Testing only
```

### Practical performance rules

```
1. Never store database files in the container writable layer.
   → CoW copies entire blocks on first write → kills DB performance
   → Use a named volume (bypasses the storage driver entirely)

2. Minimize the number of image layers.
   → Fewer lowerdir entries = slightly faster OverlayFS lookups
   → Chain RUN commands with &&

3. Use .dockerignore to keep COPY layers small.
   → Smaller layers = faster builds and faster CoW operations

4. On macOS (Docker Desktop), the VM boundary is the bottleneck.
   → The storage driver runs inside the Linux VM, not natively
   → Bind mounts crossing the VM boundary are slow for large directories
   → Use anonymous volumes for node_modules, vendor/, .venv/

5. Use --read-only containers where possible.
   → No writable layer activity = no CoW overhead at runtime
```

### Disk usage inspection

```bash
# See how much space the storage driver is using
docker system df
# TYPE            TOTAL   ACTIVE  SIZE      RECLAIMABLE
# Images          14      3       3.2GB     2.1GB (65%)
# Containers      5       2       120MB     88MB  (73%)
# Local Volumes   8       3       12GB      4.5GB (37%)
# Build Cache     42              890MB     890MB

# Detailed breakdown
docker system df -v

# Clean up everything unused
docker system prune       # stopped containers, dangling images, unused networks
docker system prune -a    # also removes unused images (not just dangling)
docker system prune -a --volumes  # also removes unused volumes (DESTRUCTIVE)
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run `docker info | grep -A10 "Storage Driver"` to identify your current driver and backing filesystem. Run `docker inspect $(docker run -d busybox sleep 60)` and find the `GraphDriver` section. Identify the `UpperDir`, `LowerDir`, and `MergedDir` paths on disk.

**Exercise 2:** Pull `nginx:latest`. Use `docker history nginx:latest` to count image layers. Navigate to `/var/lib/docker/overlay2/` on a Linux host and count how many directories correspond to those layers. List the `diff/` directory of the top layer to see what files the final Dockerfile instruction added.

**Exercise 3:** Demonstrate copy-on-write: start a container from `ubuntu:22.04` and run `apt-get install -y curl` inside. Use `docker diff <container>` to see every file that was added or modified in the container's writable layer. Then commit the container as a new image and compare its size to `ubuntu:22.04`.

**Exercise 4:** Run `docker system df` before and after pulling three large images. Observe how shared base layers affect total disk usage — the number should be much less than the sum of individual image sizes. Pull `node:18`, `node:20`, and `node:18-alpine` and note that `node:18` and `node:20` share some base Debian layers.

**Exercise 5:** Start a MySQL container with no volume (`-e MYSQL_ROOT_PASSWORD=secret mysql:8`). Insert a row into a table. Stop and remove the container with `docker rm`. Start a new MySQL container — confirm the data is gone. Repeat with `-v mysqldata:/var/lib/mysql` and verify data persists across `docker rm` and recreation.

---

## 9. Interview Q&A

**Q: What is copy-on-write and why does Docker use it?**
Answer: Copy-on-write (CoW) is a resource-management strategy where a copy of data is only made when a modification occurs, not when it is first shared. Docker uses CoW so that all containers running from the same image can share the read-only image layers without each container needing its own complete copy. When a container modifies a file, the storage driver copies only that file into the container's writable layer, then the modification is made to the copy. This saves significant disk space and allows containers to start in milliseconds.

**Q: What is overlay2 and why is it the recommended storage driver?**
Answer: `overlay2` uses the Linux kernel's OverlayFS feature to implement the union filesystem. It supports up to 128 lower layers natively in the kernel, requires no additional configuration beyond a supported filesystem (ext4 or xfs with `d_type` support), and is maintained directly in the Linux kernel. Compared to alternatives like `devicemapper` (complex configuration, deprecated) or `btrfs` (requires specific filesystem), `overlay2` works on most standard Linux setups out of the box with low overhead and good performance.

**Q: Why should you never store database data in a container's writable layer?**
Answer: Three reasons. First, the writable layer is ephemeral — `docker rm` destroys it, so all database data is lost. Second, database files are written frequently and in large block patterns; CoW means the storage driver must copy an entire file block into the writable layer on the first write, which causes severe write amplification and I/O latency for database workloads. Third, the writable layer cannot be accessed by other containers or the host easily. Use a named volume instead — writes go directly to the host filesystem, bypassing the storage driver entirely for data I/O.

**Q: What happens to the storage driver's data if you change drivers in daemon.json?**
Answer: Changing the `storage-driver` in `daemon.json` and restarting Docker renders all existing images and containers inaccessible — they are stored in the old driver's format under `/var/lib/docker/<old-driver>/` and the new driver cannot read them. Docker does not migrate data between drivers automatically. To change drivers safely: back up all volumes, export any container filesystems you need, restart Docker with the new driver, then re-pull images and re-create containers.

**Q: What is the difference between the overlay2 `UpperDir`, `LowerDir`, and `MergedDir`?**
Answer: These are the three key directories in an OverlayFS mount. `LowerDir` is a colon-separated list of read-only image layer directories, ordered from top (most recent) to bottom (oldest). `UpperDir` is the container's writable layer — all writes go here. `MergedDir` is the unified view presented to the container process: the kernel merges `LowerDir` and `UpperDir` so the container sees a single coherent filesystem. `MergedDir` only exists while the container is running; when the container stops, the mount is unmounted and only `UpperDir` retains the container's changes.
