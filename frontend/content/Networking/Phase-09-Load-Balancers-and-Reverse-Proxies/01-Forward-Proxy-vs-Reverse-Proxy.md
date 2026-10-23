# Forward Proxy vs Reverse Proxy — Complete Guide

## Table of Contents
1. [The Core Idea: Who Is Being Hidden?](#1-the-core-idea-who-is-being-hidden)
2. [Forward Proxy](#2-forward-proxy)
3. [Reverse Proxy](#3-reverse-proxy)
4. [Side-by-Side Comparison](#4-side-by-side-comparison)
5. [Common Confusion Points](#5-common-confusion-points)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Core Idea: Who Is Being Hidden?

A **proxy** is a middleman server that sits between a client and a server, forwarding requests and responses on someone's behalf. The only question that matters when telling forward and reverse proxies apart is:

```
Whose identity is the proxy hiding from the other side?

Forward Proxy → hides the CLIENT from the server
Reverse Proxy → hides the SERVER(s) from the client
```

Everything else (caching, filtering, logging, security) is a side benefit that both types can offer. The position in the request path is what defines them.

---

## 2. Forward Proxy

A forward proxy sits **in front of clients**, on the client's side of the network. The server on the other end only ever sees the proxy — it has no idea which actual client made the request.

```
FORWARD PROXY TOPOLOGY

  ┌──────────┐     ┌──────────┐     ┌──────────┐        ┌─────────────┐
  │ Client A │ ──▶ │          │     │          │        │             │
  └──────────┘     │ Forward  │ ──▶ │ Internet │ ──────▶│  example.com │
  ┌──────────┐     │  Proxy   │     │          │        │  (server)   │
  │ Client B │ ──▶ │          │     │          │        │             │
  └──────────┘     └──────────┘     └──────────┘        └─────────────┘
  ┌──────────┐          ▲
  │ Client C │ ─────────┘
  └──────────┘

  example.com sees ONE source IP: the forward proxy's IP.
  It has no idea whether Client A, B, or C made the request.
```

### Who configures it, and why

The **client** (or the client's network administrator) configures the forward proxy. Clients are typically told explicitly to route their traffic through it — via browser settings, OS proxy settings, or a VPN client.

### Common Use Cases

| Use Case | How It Works |
|----------|--------------|
| **Corporate network proxy** | All employee traffic to the internet is routed through a company proxy, which logs activity, blocks non-work sites, and scans for malware. |
| **VPN** | A VPN client tunnels your traffic through a remote proxy/gateway, hiding your real IP from every website you visit. |
| **Bypassing geo-restrictions** | Connecting through a proxy located in another country makes the destination server think the request originated there. |
| **Anonymity / privacy tools** | Services like Tor chain multiple forward proxies together so no single hop knows both "who" and "what."|
| **Content filtering for schools/offices** | Admins block categories of sites (social media, gambling) at the proxy level before traffic ever leaves the network. |
| **Caching outbound requests** | A proxy caches frequently requested external pages so repeated requests from different internal clients don't all hit the internet. |

---

## 3. Reverse Proxy

A reverse proxy sits **in front of servers**, on the server's side of the network. The client only ever talks to the reverse proxy — it has no idea which actual backend server handled the request, or how many backend servers even exist.

```
REVERSE PROXY TOPOLOGY

  ┌──────────┐
  │ Client A │ ──┐
  └──────────┘   │
  ┌──────────┐   │      ┌──────────┐      ┌─────────────┐
  │ Client B │ ──┼────▶ │ Reverse  │ ──┬─▶│  Server 1   │
  └──────────┘   │      │  Proxy   │   ├─▶│  Server 2   │
  ┌──────────┐   │      │ (nginx)  │   └─▶│  Server 3   │
  │ Client C │ ──┘      └──────────┘      └─────────────┘

  Clients only know about ONE address: the reverse proxy.
  They have no idea whether Server 1, 2, or 3 handled their request.
```

### Who configures it, and why

The **server owner / operations team** configures the reverse proxy. Clients don't know it exists — they just think they're talking directly to the website.

### Common Use Cases

| Use Case | How It Works |
|----------|--------------|
| **nginx / HAProxy in front of an app** | The proxy receives all traffic on port 80/443 and forwards it to app servers running on internal ports (e.g., Node.js on 3000). |
| **Load balancing** | Distributes incoming requests across multiple backend instances so no single server is overwhelmed (see Lesson 02). |
| **SSL/TLS termination** | The proxy handles HTTPS encryption/decryption once, so backend servers only deal with plain HTTP internally. |
| **Caching responses** | Static or semi-static responses are cached at the proxy, reducing load on backend servers. |
| **Security / hiding infrastructure** | Backend server IPs, versions, and internal topology are never exposed to the client — reduces attack surface. |
| **Single entry point for microservices** | An API gateway (a specialized reverse proxy) routes `/users` to one service and `/orders` to another, presenting one unified API. |

---

## 4. Side-by-Side Comparison

| Aspect | Forward Proxy | Reverse Proxy |
|--------|---------------|----------------|
| Sits in front of | Clients | Servers |
| Hides identity of | The client (from the server) | The server(s) (from the client) |
| Configured by | Client / client's network admin | Server owner / ops team |
| Client awareness | Client knows the proxy exists (usually configured explicitly) | Client is unaware — thinks it's talking to the real server |
| Server awareness | Server sees only the proxy's IP, not the real client | N/A — servers are behind it |
| Typical products | Squid, corporate proxies, VPN gateways, Tor | nginx, HAProxy, Envoy, AWS ALB/NLB, Kubernetes Ingress |
| Primary goals | Privacy, access control, content filtering, bypassing restrictions | Load balancing, SSL termination, caching, security, high availability |

---

## 5. Common Confusion Points

**"Isn't a reverse proxy just a load balancer?"**
Not exactly — a reverse proxy is the broader concept (any proxy fronting servers). Load balancing is one *feature* a reverse proxy can provide. A reverse proxy could front a single server purely for SSL termination or caching, with no load balancing involved at all.

**"Can something be both?"**
Yes. A corporate network might run a forward proxy for outbound employee traffic AND a reverse proxy for its own public-facing website — they're two separate deployments solving two different problems.

**"Does a CDN count as a reverse proxy?"**
Yes — a CDN edge node is a geographically distributed reverse proxy that caches and serves content on behalf of an origin server. Covered in depth in Phase 10 (CDNs and Edge Delivery).

---

## 6. Hands-On Exercises

**Exercise 1:** Install nginx locally (`brew install nginx` or via Docker: `docker run -d -p 8080:80 nginx`). Configure it as a reverse proxy in front of a simple app you run on `localhost:3000`, using the `proxy_pass` directive. Confirm requests to `localhost:8080` are forwarded to your app.

**Exercise 2:** In your company's or home network settings, check if a proxy is configured under network/proxy settings (System Preferences → Network → Proxies on Mac). Note whether it's a forward proxy for outbound browsing.

**Exercise 3:** Use `curl -v https://example.com` and inspect the response headers. Look for headers like `Server`, `Via`, or `X-Cache` that hint whether a reverse proxy or CDN is in front of the origin.

**Exercise 4:** Set up a free VPN or proxy browser extension, visit `https://whatismyipaddress.com` before and after enabling it, and confirm the IP address changes — demonstrating a forward proxy hiding your real IP.

**Exercise 5:** Draw (on paper or in a tool) the request path for a real app you've worked on, from browser to database, labeling every proxy/load balancer hop you know about (CDN, WAF, load balancer, app server).

---

## 7. Interview Q&A

**Q: What is the fundamental difference between a forward proxy and a reverse proxy?**
Answer: A forward proxy sits in front of clients and hides the client's identity from the server — the server only sees the proxy's IP. A reverse proxy sits in front of servers and hides the servers' identity from the client — the client only sees the proxy, unaware of how many backend servers exist or which one handled the request. The distinction is about which side of the connection the proxy is protecting/representing.

**Q: Give a real-world example of each.**
Answer: Forward proxy: a corporate network routes all employee internet traffic through a proxy that blocks certain sites and logs activity — the external websites only see the company's proxy IP, never individual employees. Reverse proxy: nginx sitting in front of three Node.js app instances, receiving all public traffic on port 443 and forwarding it internally — users only know about the public domain, not the individual app servers.

**Q: Is a VPN a forward proxy or a reverse proxy?**
Answer: A VPN acts as a forward proxy from the client's perspective — it tunnels the client's traffic through a remote gateway, and the destination server only sees the VPN gateway's IP, not the real client IP.

**Q: Can a reverse proxy do load balancing? Is that required?**
Answer: A reverse proxy *can* do load balancing across multiple backend servers, but it's not required — a reverse proxy can front just one backend server purely for SSL termination, caching, or security reasons. Load balancing is one optional capability of a reverse proxy, not its definition.

**Q: Why would a company use a reverse proxy instead of exposing app servers directly?**
Answer: Security (backend IPs/software versions are hidden, reducing attack surface), centralized SSL/TLS termination (certificates managed in one place), load balancing and failover across multiple instances, response caching to reduce backend load, and a single, stable entry point even as backend infrastructure changes.

**Q: How does a server know it's behind a reverse proxy, and how does it recover the real client IP?**
Answer: The reverse proxy adds headers like `X-Forwarded-For` (original client IP), `X-Forwarded-Proto` (original scheme, http/https), and `X-Forwarded-Host`. The backend application reads these headers instead of the raw TCP connection's source IP, since that IP would otherwise just be the proxy's.
