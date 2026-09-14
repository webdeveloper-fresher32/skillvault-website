# Docker Installation & Setup — Complete Guide

## Table of Contents
1. [Installation Options](#1-installation-options)
2. [Mac Installation](#2-mac-installation)
3. [Linux Installation](#3-linux-installation)
4. [Windows Installation](#4-windows-installation)
5. [Post-Install Configuration](#5-post-install-configuration)
6. [Docker Desktop Overview](#6-docker-desktop-overview)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Installation Options

| Option | Platforms | Best For |
|--------|-----------|---------|
| **Docker Desktop** | Mac, Windows, Linux | Developers — GUI + CLI |
| **Docker Engine** | Linux only | Servers, CI/CD, production |
| **Docker in Docker (DinD)** | Any (container) | CI/CD pipelines |
| **Rancher Desktop** | Mac, Windows | Alternative with k8s |
| **Podman** | Linux, Mac | Docker-compatible, rootless |

---

## 2. Mac Installation

```bash
# Option A: Docker Desktop (recommended for Mac)
# Download from: https://docs.docker.com/desktop/install/mac-install/
# Supports: Intel and Apple Silicon (M1/M2/M3)

# After install, verify:
docker version
docker info
docker run hello-world

# Option B: Homebrew
brew install --cask docker
# Then launch Docker Desktop from Applications

# Option C: CLI only (no GUI) via Homebrew
brew install docker          # CLI only
brew install colima          # lightweight VM for Mac (replaces Desktop)
colima start                 # starts the Docker VM
docker ps                    # verify it works
```

---

## 3. Linux Installation

```bash
# Ubuntu / Debian

# 1. Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# 2. Install dependencies
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release

# 3. Add Docker's GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. Add repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Install Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Start and enable daemon
sudo systemctl start docker
sudo systemctl enable docker

# 7. Run without sudo (add user to docker group)
sudo usermod -aG docker $USER
newgrp docker   # apply group change immediately

# Verify
docker version
docker run hello-world
```

---

## 4. Windows Installation

```
Requirements:
  - Windows 10 (build 19041+) or Windows 11
  - WSL2 enabled (recommended backend)
  - Virtualization enabled in BIOS

Steps:
  1. Enable WSL2:
     wsl --install
     wsl --set-default-version 2

  2. Download Docker Desktop for Windows from docs.docker.com

  3. Install and restart

  4. In Docker Desktop Settings:
     General → Use WSL 2 based engine → ✅

  5. Verify in PowerShell:
     docker version
     docker run hello-world
```

---

## 5. Post-Install Configuration

### Docker Daemon Config (`/etc/docker/daemon.json`)

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "insecure-registries": [],
  "dns": ["8.8.8.8", "8.8.4.4"],
  "data-root": "/var/lib/docker"
}
```

```bash
# Apply changes
sudo systemctl restart docker

# Docker Desktop equivalent: Preferences → Docker Engine → edit JSON
```

### Resource Limits (Docker Desktop)

```
Preferences → Resources:
  CPUs:   4 (out of 8)
  Memory: 4 GB (out of 16)
  Swap:   1 GB
  Disk:   60 GB
```

### Docker Context

```bash
# Docker contexts let you connect to remote Docker hosts
docker context ls          # list contexts
docker context use default # switch context

# Create context for remote server
docker context create remote --docker "host=ssh://user@server.com"
docker context use remote
docker ps   # this now shows containers on the remote server!
```

---

## 6. Docker Desktop Overview

```
Docker Desktop GUI:
┌────────────────────────────────────────────────────┐
│  Containers  │  List running/stopped containers     │
│              │  Start / Stop / Remove / Exec       │
├──────────────┼────────────────────────────────────┤
│  Images      │  List local images                  │
│              │  Run / Pull / Push / Remove         │
├──────────────┼────────────────────────────────────┤
│  Volumes     │  List volumes, inspect data        │
├──────────────┼────────────────────────────────────┤
│  Dev         │  Extensions marketplace             │
│  Environments│  Dev container templates            │
├──────────────┼────────────────────────────────────┤
│  Settings    │  Resources, network, registry auth  │
└────────────────────────────────────────────────────┘
```

---

## 7. Hands-On Exercises

**Exercise 1:** Install Docker on your machine. Run `docker version` — identify the Client version, Server version, and API version.

**Exercise 2:** Run `docker info` — identify: storage driver, logging driver, number of CPUs and memory available to Docker.

**Exercise 3:** (Linux only) Add yourself to the docker group. Verify you can run `docker ps` without `sudo`.

**Exercise 4:** Explore the Docker daemon config. Find where Docker stores its data (`docker info | grep "Docker Root Dir"`). Check how much disk Docker is using with `docker system df`.

**Exercise 5:** Run `docker run --rm alpine echo "Hello from Alpine"`. The `--rm` flag auto-removes the container when done. Verify with `docker ps -a` that no container remains.

---

## 8. Interview Q&A

**Q: What is the difference between Docker Desktop and Docker Engine?**
Answer: Docker Engine is the core daemon (dockerd) + CLI that runs on Linux — production servers use this. Docker Desktop bundles the Engine inside a lightweight VM (on Mac/Windows since they don't have a Linux kernel), adds a GUI, and includes Docker Compose and Kubernetes. Use Desktop for development, Engine on Linux servers.

**Q: What is WSL2 and why does Docker on Windows need it?**
Answer: WSL2 (Windows Subsystem for Linux 2) runs a real Linux kernel inside Windows via Hyper-V. Docker on Windows needs a Linux kernel for containers (container processes use Linux kernel features like namespaces and cgroups). Docker Desktop uses WSL2 as its backend to provide the Linux kernel, giving native-speed container performance on Windows.

**Q: What is a Docker context?**
Answer: A Docker context stores connection details for a Docker daemon — the socket path or remote host URL. You can have multiple contexts (local, remote server, AWS ECS) and switch between them with `docker context use`. This lets you run Docker CLI commands against a remote Docker daemon without SSH-ing into it manually.

**Q: Why should you add your user to the docker group on Linux?**
Answer: By default, the Docker daemon socket is owned by root and the docker group. Without group membership, every docker command requires `sudo`. Adding yourself with `usermod -aG docker $USER` lets you run Docker commands without sudo. Note: docker group membership is equivalent to root access — only trusted users should be in this group.

**Q: What is `docker system df` and why is it useful?**
Answer: `docker system df` shows disk usage by images, containers, local volumes, and build cache. Docker can accumulate significant disk usage over time (unused images, dangling layers, stopped containers). Use `docker system prune` to remove unused resources. `docker system df -v` shows verbose detail per image/volume.
