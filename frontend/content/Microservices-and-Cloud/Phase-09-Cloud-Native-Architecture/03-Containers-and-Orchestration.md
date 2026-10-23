# Containers and Orchestration

Virtual Machines (VMs) are the foundation of the cloud, but they are too heavy for cloud-native microservices. 

If you have an application with 50 microservices, running each service inside its own VM means running 50 full operating systems. A standard Linux OS takes up roughly 1GB of RAM. That means you are wasting 50GB of RAM just on operating systems, before you even run a single line of business code.

The solution to this inefficiency is **Containerization**.

## 1. Containerization (Docker)

Containers (like Docker) provide OS-level virtualization. 

Instead of a Hypervisor creating fake hardware for a full OS, a Container Engine (Docker) sits on top of a single host OS and isolates *processes* from each other.

- **Lightweight**: Containers share the host OS kernel. Therefore, a container does not contain a full OS. It only contains your application code and the specific libraries it needs. A container can be as small as 10MB.
- **Fast**: Because there is no OS to boot up, a container can start in milliseconds, achieving Factor 9 of the 12-Factor app (Disposability and fast startup).
- **Portability**: A Docker image contains exactly what the app needs. It eliminates the "it works on my machine" problem. If the container runs on your laptop, it will run identically on an AWS server.

## 2. Container Orchestration (Kubernetes)

Docker solves the problem of packaging and running a single microservice. But what happens when you have 50 microservices, and you want to run 10 copies of each (500 containers) across a fleet of 20 physical servers?

How do you decide which container goes on which server? What happens if a server dies? How do the containers find each other's IP addresses?

This is where **Container Orchestrators** step in. The undisputed industry standard is **Kubernetes (K8s)**, originally developed by Google.

### What does Kubernetes do?

1. **Scheduling**: You give Kubernetes a container and say, "I need 5 copies of this running." Kubernetes looks at your 20 physical servers, finds the ones with available CPU and RAM, and places the containers there automatically.
2. **Self-Healing**: If a server crashes, taking down 2 of your containers, Kubernetes notices immediately and automatically restarts those 2 containers on a healthy server.
3. **Service Discovery and Load Balancing**: Kubernetes gives every group of containers an internal DNS name (e.g., `order-service`) and automatically load-balances traffic across the healthy instances.
4. **Automated Rollouts**: When deploying v2 of your application, Kubernetes will slowly spin up v2 containers and shut down v1 containers one by one (Rolling Update), ensuring zero downtime.

## Summary
- **VMs** are heavy and contain a full OS. **Containers** (Docker) are lightweight, share the host OS kernel, and start in milliseconds.
- Containers are the standard packaging format for Cloud-Native Microservices.
- **Kubernetes** is the orchestrator (the conductor) that manages thousands of containers across a cluster of servers, providing scheduling, auto-scaling, and self-healing.
