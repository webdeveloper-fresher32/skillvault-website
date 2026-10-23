# EC2 Simulation with Docker — Complete Guide

> "A single-family house has its own dedicated plumbing, foundation, and yard; an apartment building divides a single foundation and structure into separate, isolated units."

---

## Table of Contents

1. [The Problem: High Cost and Slow Setup of Virtual Instances](#1-the-problem-high-cost-and-slow-setup-of-virtual-instances)
2. [The House vs. Apartment Building Analogy](#2-the-house-vs-apartment-building-analogy)
3. [The Mechanism: Ubuntu Containers and SSH Mapping](#3-the-mechanism-ubuntu-containers-and-ssh-mapping)
4. [Diagram: SSH and Web Routing to Local EC2 Mocks](#4-diagram-ssh-and-web-routing-to-local-ec2-mocks)
5. [Code Walkthrough: Dockerfile for Simulated EC2 and Nginx config](#5-code-walkthrough-dockerfile-for-simulated-ec2-and-nginx-config)
6. [Comparing Docker Containers to EC2 Virtual Machines](#6-comparing-docker-containers-to-ec2-virtual-machines)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: High Cost and Slow Setup of Virtual Instances

To deploy a MERN application to production, you need an environment where you can install Node.js, run background processes, configure reverse proxies (like Nginx), and configure security firewalls.

### The Charge Risks of Running Virtual Servers

AWS EC2 instances are full virtual machines. While they are highly customizable, leaving instances running in your account is the primary reason beginners receive high bills. Even inside the Free Tier, running an instance size larger than `t2.micro` or adding extra elastic IPs immediately triggers charges.

### Slow System Configuration Iteration

Spinning up a live EC2 instance, waiting for it to bootstrap, generating and associating security groups, and SSHing into a remote terminal takes several minutes. Doing this repeatedly during testing slows down the system administrator learning loop.

---

## 2. The House vs. Apartment Building Analogy

A physical house stands alone. It has its own dedicated furnace, roof, and utility connections. If you want to change the plumbing, you modify only your building. This represents an EC2 virtual machine running its own guest OS and hypervisor.

### Isolated Compartments

An apartment building shares a single foundation, roof, and main water pipe. However, each apartment is isolated. The tenant in 3B cannot access the kitchen of 4C. This represents a Docker container sharing the host kernel but running in an isolated namespace.

### Development Speed

Building a new house takes months. Creating an isolated apartment inside an existing structure takes far less time. Similarly, launching a Docker container to simulate an EC2 environment takes seconds, compared to minutes for a live VM.

---

## 3. The Mechanism: Ubuntu Containers and SSH Mapping

You cannot run a full hardware emulator for EC2 on your laptop efficiently. Instead, you simulate an EC2 instance by running a lightweight Ubuntu Linux container.

### Base OS Simulation

By starting a container using the official `ubuntu` image, you gain access to a shell containing the standard Linux package manager (`apt`). You can install `curl`, `nginx`, `git`, and `nodejs` exactly as you would on a live EC2 machine.

### Networking and SSH Access

To simulate the SSH access flow, you install an SSH server (`openssh-server`) inside the container and bind port `22` of the container to port `2222` on your host machine. You can then run `ssh -p 2222 root@localhost` using key files on your terminal, simulating remote EC2 login.

---

## 4. Diagram: SSH and Web Routing to Local EC2 Mocks

### Port Redirection Architecture

```text
Host Terminal / Browser
  │
  ├─► [SSH Connection: port 2222] ──► [Host Port 2222] ──► [Container Port 22] ──► Ubuntu SSHD
  │
  └─► [HTTP Request: port 8080] ────► [Host Port 8080] ──► [Container Port 80] ──► Nginx Reverse Proxy
                                                                                      │
                                                                                      ▼ (Internal Forward)
                                                                                   MERN Node.js API
```

### Key Takeaway

By mapping host ports `2222` and `8080` to the container, you access the simulated server's console and web server as if it were a remote virtual machine.

---

## 5. Code Walkthrough: Dockerfile for Simulated EC2 and Nginx config

The following Dockerfile defines our simulated EC2 instance with pre-configured SSH keys and Nginx, and provides a reverse proxy config.

### Dockerfile for EC2 Simulation

```dockerfile
# Dockerfile
FROM ubuntu:22.04

# 1. Install SSH, Nginx, curl, and Node.js
RUN apt-get update && apt-get install -y \
    openssh-server \
    nginx \
    curl \
    gnupg \
    && mkdir /var/run/sshd

# 2. Configure SSH root login and dummy key folder
RUN echo 'root:rootpassword' | chpasswd \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && mkdir -p /root/.ssh && chmod 700 /root/.ssh

# 3. Expose SSH (22) and HTTP (80)
EXPOSE 22 80

# 4. Start services on boot
CMD service ssh start && nginx -g "daemon off;"
```

### Nginx Reverse Proxy Configuration

This configuration file acts as the gateway to direct traffic to your MERN backend application running on port 5000:

```nginx
# default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://localhost:5000; # Forward requests to Node.js backend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### The Node.js Web Server Application

To complete the simulation setup, here is the server script running inside the container on port 5000:

```js
// app.js
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: "online",
    environment: "simulated-ec2-container",
    systemTime: new Date().toISOString()
  }));
});

server.listen(5000, () => {
  console.log("Simulated EC2 backend app running on port 5000...");
});
```

---

## 6. Comparing Docker Containers to EC2 Virtual Machines

### Instance Comparison

| Attribute | EC2 Virtual Machine | Local Docker Container |
|---|---|---|
| Virtualization | Hardware-level (Hypervisor) | OS-level (Shared Host Kernel) |
| Boot Time | 1 - 3 minutes | <2 seconds |
| Disk Image Size | 8GB - 30GB (AMI) | 100MB - 500MB (Docker Image) |
| Console Access | AWS Console / SSH on Port 22 | Docker exec / SSH on Port 2222 |
| Routing | Security Groups & Elastic IP | Docker Port Mapping & Bridge Network |
| Process Manager | Systemd / init | CMD service script / PM2 |

---

## 7. Common Mistakes

- **Running Systemd inside containers without privileged mode.** Standard Docker containers do not run a full `init` system. Attempting to execute `systemctl start nginx` will fail. You must start services manually using their direct binaries or use the shell `service` command.
- **Forgetting to rebuild the image after config changes.** Modifying the default Nginx config on your host does not automatically copy it to the container unless you configure a Docker volume mount.
- **Port overlapping on localhost.** Attempting to run the simulated EC2 container on port `80` when your local system is already running an active web server will block startup.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the Dockerfile from Section 5 and compile it locally using `docker build -t local-ec2 .`.

**Exercise 2:** Launch the container mapping ports 2222 and 8080 (`docker run -d -p 2222:22 -p 8080:80 --name ec2-mock local-ec2`).

**Exercise 3:** Access the running container's shell command line directly without SSH by running `docker exec -it ec2-mock bash`.

**Exercise 4:** Install the process manager PM2 inside the container, start a mock Node.js app on port 5000, and verify Nginx forwards traffic.

**Exercise 5:** Verify SSH access by copying your local public key to the container's `/root/.ssh/authorized_keys` and running `ssh -p 2222 root@localhost`.

---

## 9. Interview Q&A

**Q: What is the fundamental difference between an EC2 Virtual Machine and a Docker Container?**
An EC2 virtual machine runs on hypervisor virtualization, running its own guest operating system, kernel, and virtual hardware allocation. A Docker container runs on OS-level virtualization, sharing the host machine's kernel and utilizing namespaces and control groups (cgroups) to isolate processes, resulting in lower overhead.

**Q: Why does running `systemctl` commands inside standard Docker containers fail, and how do you work around it?**
Standard containers do not run a full init daemon (like `systemd`) as PID 1 to minimize footprint. Running `systemctl` fails because the daemon is missing. The workaround is to start services directly using their execution binaries (e.g. `nginx -g "daemon off;"`) or using standard service wrappers (`service ssh start`).

**Q: How do you configure Nginx as a reverse proxy for a Node.js application, and why is this done?**
Nginx is configured as a reverse proxy by writing a server block that intercepts traffic on port 80 and uses `proxy_pass` to forward requests to the Node.js port (e.g., `http://localhost:5000`). This is done to handle SSL termination, request caching, rate limiting, and serve static assets efficiently, shielding Node.js.

**Q: What is the role of a process manager like PM2 in virtual servers?**
A process manager monitors and manages application processes. It runs applications in the background, automatically restarts them if they crash, logs standard outputs, and enables clustering to utilize multiple CPU cores, ensuring application reliability.

**Q: What are AWS Security Groups, and how do you simulate them locally?**
Security Groups act as virtual firewalls controlling inbound and outbound traffic to EC2 instances. Locally, they are simulated by managing Docker port bindings (only exposing specific ports to the host via `-p`) and configuring network bridge boundaries.
