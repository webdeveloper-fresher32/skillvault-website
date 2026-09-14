# Layer 4 vs Layer 7 Load Balancing — Complete Guide

## Table of Contents
1. [Layer 4 Load Balancing (Transport Layer)](#1-layer-4-load-balancing-transport-layer)
2. [Layer 7 Load Balancing (Application Layer)](#2-layer-7-load-balancing-application-layer)
3. [The Modern Standard: Doing Both](#3-the-modern-standard-doing-both)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

When configuring a load balancer (like AWS ALB/NLB, Nginx, or HAProxy), you must make a fundamental choice: at what layer of the OSI model should it operate?

You can load balance at **Layer 4 (Transport Layer)** or **Layer 7 (Application Layer)**.

---

## 1. Layer 4 Load Balancing (Transport Layer)

At Layer 4, the load balancer only looks at the **IP addresses and TCP/UDP ports**. It has no idea what protocol is running inside the TCP stream (it could be HTTP, Redis, PostgreSQL, or SSH).

**How it works:**

```
Client ──TCP SYN──▶ L4 Load Balancer ──new TCP conn──▶ Backend Server
                    (reads src/dst IP + port only)
                    (blindly streams raw bytes both ways)
```

1. The client establishes a TCP connection with the Load Balancer.
2. The Load Balancer looks at the source IP, destination IP, and ports.
3. It selects a backend server (e.g., using Round Robin) and creates a new TCP connection to that server.
4. It blindly streams raw bytes back and forth between the two connections. It does not parse or inspect the HTTP headers or body.

**Pros of L4:**
- **Blisteringly Fast:** Because it doesn't parse HTTP headers, it uses very little CPU. It can handle millions of connections per second.
- **Protocol Agnostic:** You can use an L4 load balancer to route database traffic, WebSockets, or custom UDP gaming protocols.
- **Security:** TLS/HTTPS can pass right through it encrypted (called SSL Passthrough). The load balancer never sees the decrypted data, meaning the certificate only needs to live on the backend servers.

**Cons of L4:**
- **Dumb Routing:** Because it can't see the HTTP URL, it cannot route `/api/*` to one set of servers and `/images/*` to another.

---

## 2. Layer 7 Load Balancing (Application Layer)

At Layer 7, the load balancer fully understands the **HTTP protocol**. It inspects the URL, the headers, the cookies, and the payload.

**How it works:**

```
Client ──TLS handshake──▶ L7 Load Balancer ──plain HTTP──▶ Backend Server
                          (terminates TLS)
                          (reads URL/headers/cookies)
                          (routes /images/* → static pool)
```

1. The client establishes a TCP connection and completes the TLS handshake *with the Load Balancer itself* (SSL Termination).
2. The Load Balancer decrypts the traffic and reads the HTTP request (e.g., `GET /images/logo.png`).
3. It evaluates its routing rules: *"Ah, requests to `/images/*` should go to the Static File Server pool."*
4. It creates a new connection to a server in that specific pool and forwards the request.

**Pros of L7:**
- **Smart Routing:** You can route based on the URL path (`/api/v1` vs `/api/v2`), HTTP headers, or even the user's cookies (e.g., routing beta users to a different cluster).
- **SSL Termination:** The heavy cryptographic lifting of TLS is handled by the load balancer. The backend servers just receive plain HTTP, saving them CPU cycles.
- **Caching & Rate Limiting:** Because the load balancer understands HTTP, it can cache responses or rate-limit specific URLs.

**Cons of L7:**
- **Slower (Relatively):** Decrypting TLS and parsing HTTP requires more CPU and memory per request than blindly shuffling bytes.
- **Certificate Management:** The TLS certificate must be installed on the load balancer itself, so the load balancer has access to all decrypted user data.

---

## 3. The Modern Standard: Doing Both

In large-scale cloud environments (like Kubernetes or AWS), it is common to chain them together:

```
Internet → L4 Load Balancer (AWS NLB) → L7 Reverse Proxy (Nginx/Ingress) → Backend Servers
```

- The **L4 Load Balancer** handles the raw firehose of internet traffic, protecting against DDoS attacks and blindly distributing TCP connections across multiple Nginx nodes.
- The **L7 Reverse Proxy (Nginx)** terminates the TLS, parses the HTTP paths, and smartly routes the request to the correct microservice.

---

## 4. Hands-On Exercises

**Exercise 1:** Set up an Nginx `stream` block (L4) that proxies raw TCP traffic on port 6379 to a Redis instance, and confirm it works with `redis-cli` without Nginx understanding the Redis protocol.

**Exercise 2:** Set up an Nginx `http` block (L7) with two `location` rules — `/api/` routing to one upstream and `/static/` routing to another. Use `curl` to hit both paths and confirm each is routed correctly.

**Exercise 3:** Enable SSL Termination on your L7 Nginx config (self-signed cert is fine) and verify with `curl -v` that TLS ends at Nginx while the connection to the backend is plain HTTP (e.g., using `tcpdump` or backend logs).

**Exercise 4:** Provision (or read the docs for) an AWS Network Load Balancer (L4) sitting in front of an Application Load Balancer (L7), and diagram the request path from client to backend, labeling which layer handles what.

**Exercise 5:** Compare the latency of an L4 proxy vs an L7 proxy handling the same number of requests per second using a simple load-testing tool (e.g., `wrk` or `ab`), and explain the CPU/latency difference you observe.

---

## 5. Interview Q&A

**Q: I have a monolithic application deployed on 3 servers. I want requests to `/images` to go to a separate S3 bucket, and all other requests to go to the monolith. Should I use an L4 or L7 load balancer?**
Answer: You must use an L7 load balancer. An L4 load balancer only sees IP addresses and TCP ports; it cannot read the HTTP URL path (`/images`), so it is incapable of making routing decisions based on the path.

**Q: What is SSL Termination, and why is it usually done at the Load Balancer?**
Answer: SSL Termination is the process of decrypting HTTPS traffic at the edge of your network (the load balancer) and forwarding it as plain HTTP to your internal backend servers over the private network. This centralizes certificate management (you only install the cert in one place) and offloads the CPU-intensive TLS handshake process from your application servers, allowing them to focus entirely on running business logic.

**Q: Is it safe to use plain HTTP between the Load Balancer and the Backend Servers?**
Answer: Generally, yes, if they are inside a trusted, isolated private network (like an AWS VPC) where external actors cannot sniff the traffic. However, in Zero-Trust architectures or highly regulated industries (banking, healthcare), you may be required to re-encrypt the traffic between the load balancer and the backend servers (End-to-End Encryption).

**Q: What is SSL Passthrough, and when would you use it over SSL Termination?**
Answer: SSL Passthrough means the load balancer forwards the encrypted TLS traffic untouched to the backend, which performs the TLS handshake itself. This is an L4 behavior — the load balancer never decrypts anything, so it can't inspect HTTP paths, but it also means the private key never leaves the backend servers. You'd choose this when compliance requires the load balancer to never see decrypted data, or when the backend protocol isn't HTTP at all (e.g., a custom TLS-wrapped protocol).

**Q: Why might an L4 load balancer be preferred in front of a Kubernetes cluster instead of going straight to L7?**
Answer: An L4 load balancer (like AWS NLB) can absorb massive amounts of raw connection volume with very low latency and minimal CPU cost, acting as a DDoS-resilient front door. It then hands connections off to an L7 Ingress controller (like Nginx Ingress) running inside the cluster, which does the smart HTTP-aware routing. This two-tier design separates "survive the traffic firehose" from "route intelligently," letting each layer do what it's best at.

**Q: Can a single load balancer product operate at both L4 and L7 simultaneously?**
Answer: Yes — many modern load balancers (AWS ALB, Nginx, HAProxy, Envoy) can be configured to do TCP-level load balancing for non-HTTP traffic while also running full HTTP-aware routing for web traffic, sometimes even within the same deployment via different listener configurations. The key is understanding, for each listener/port, whether it is inspecting only IP/port (L4 behavior) or parsing the full HTTP request (L7 behavior).
