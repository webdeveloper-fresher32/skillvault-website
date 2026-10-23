# Nginx, HAProxy, and ALB in Practice

Everything in Lessons 01-02 — round robin, least connections, health checks — is real behavior you configure, not code you write. In production you almost never hand-roll a load balancer in Python; you drop a battle-tested piece of software or managed cloud service in front of your app and configure it. This lesson makes that concrete.

## The Three You'll See Most

```
                     ┌────────────────────────────────┐
       Clients ────▶ │  Nginx / HAProxy / AWS ALB      │
                     │  (the load balancer)            │
                     └────────────────┬─────────────────┘
                                       │
                      ┌────────────────┼────────────────┐
                      ▼                ▼                ▼
                ┌───────────┐   ┌───────────┐   ┌───────────┐
                │ FastAPI   │   │ FastAPI   │   │ FastAPI   │
                │ :8001     │   │ :8002     │   │ :8003     │
                └───────────┘   └───────────┘   └───────────┘
```

- **Nginx** — originally a web server, extremely commonly used as a reverse proxy / load balancer too. Free, self-hosted, config-file driven. The default choice for "put something in front of my app instances."
- **HAProxy** — purpose-built for load balancing (the name literally stands for High Availability Proxy). More advanced traffic-shaping and health-check options than Nginx's load-balancing features, often preferred in high-traffic or finance-grade setups.
- **AWS ALB (Application Load Balancer)** — a managed load balancer from AWS. No server to patch or scale yourself; AWS runs it across multiple availability zones for you. You configure target groups (your backend instances) and routing rules through the AWS console/API instead of a config file. Costs money per hour + per request, but removes an entire piece of infrastructure you'd otherwise have to operate.

In an interview, naming any of these as "what actually sits here" is a good signal — it shows you know the load balancer box on your diagram isn't imaginary infrastructure.

## A Minimal Nginx Config

Here's the actual config that implements the round-robin diagram from Lesson 01, load balancing across three local FastAPI instances:

```nginx
# nginx.conf

http {
    upstream backend {
        server 127.0.0.1:8001;
        server 127.0.0.1:8002;
        server 127.0.0.1:8003;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://backend;
        }
    }
}
```

- The `upstream backend { ... }` block is the pool of servers — this is the load balancer's target list. By default, Nginx round-robins across them.
- `proxy_pass http://backend;` tells Nginx: for any request hitting this server block, forward it to one of the servers in the `backend` upstream group instead of handling it directly.
- To run this locally: start three FastAPI instances (`uvicorn main:app --port 8001`, `--port 8002`, `--port 8003`), point Nginx at this config, and every request to `http://localhost/` gets forwarded to one of the three, rotating.

To switch algorithms, you add one directive inside `upstream`:

```nginx
upstream backend {
    least_conn;                   # least-connections instead of round robin
    server 127.0.0.1:8001;
    server 127.0.0.1:8002 weight=3;   # weighted round robin
    server 127.0.0.1:8003;
}
```

And to add a basic health check (Nginx's open-source version supports passive health checks by default — marking a server as down after failed requests — with active health checks available in Nginx Plus or via third-party modules):

```nginx
upstream backend {
    server 127.0.0.1:8001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8002 max_fails=3 fail_timeout=30s;
}
```

This marks a server as temporarily down after 3 consecutive failed requests, and stops sending it traffic for 30 seconds before retrying it.

## L4 vs L7 Load Balancing

Load balancers operate at one of two layers of the network stack, and it changes what they're able to see and route on:

| | Layer 4 (Transport) | Layer 7 (Application) |
|---|---|---|
| **Sees** | IP address + port, raw TCP/UDP packets | Full HTTP request — headers, path, cookies, body |
| **Can route on** | Source/destination IP and port only | URL path, hostname, headers, cookies |
| **Example decision** | "Forward this TCP connection to server X" | "Requests to `/api/v1/orders` go to the Order Service; requests to `/api/v1/users` go to the User Service" |
| **Speed** | Faster — less to parse per packet | Slightly slower — has to parse the HTTP request |
| **Example tools** | AWS Network Load Balancer (NLB), raw TCP mode in HAProxy | Nginx (as configured above), AWS ALB, HAProxy in HTTP mode |

The Nginx config above is doing L7 load balancing — it's proxying HTTP requests and could just as easily route based on the URL path (e.g., send `/auth/*` to one upstream and `/posts/*` to another, which is exactly the API Gateway pattern covered in Phase 08, Lesson 02). If all you need is "spread raw TCP connections across servers" with no awareness of HTTP at all, an L4 load balancer is cheaper and faster, but can't make routing decisions based on request content.

## Interview Q&A

**Q: Would you write your own load balancer for a production system?**
Answer: No — this is a solved problem with mature, battle-tested tools (Nginx, HAProxy) or managed services (AWS ALB/NLB, GCP's load balancers). Writing your own means re-implementing health checks, algorithm choices, TLS termination, and failure handling that these tools have had years of production hardening on. The interview-relevant skill is knowing *which* tool fits (L4 vs L7, self-managed vs managed) and how to configure it, not implementing one from scratch.

**Q: What's the difference between L4 and L7 load balancing?**
Answer: L4 (transport layer) load balancers route based only on IP address and port, without looking at the actual HTTP request — they're fast but can't make content-aware decisions. L7 (application layer) load balancers parse the full HTTP request and can route based on URL path, hostname, headers, or cookies — e.g., sending `/api/orders` to one service and `/api/users` to another. L7 is more flexible and is what's typically meant by "load balancer" in a web application context; L4 is used when you need raw throughput and don't need HTTP-aware routing.

**Q: In the `upstream backend { ... }` block, what does adding `weight=3` to one server do?**
Answer: It tells Nginx to send that server roughly 3x as many requests as a server with the default weight of 1, implementing weighted round robin. This is used when backend instances have different capacity — e.g., one runs on a larger EC2 instance than the others — so traffic is split proportionally to what each can actually handle, rather than evenly by request count.

**Q: How would you use Nginx to implement the "route based on URL path to different services" pattern instead of plain load balancing across identical servers?**
Answer: Define multiple `upstream` blocks (one per service) and use `location` blocks matching different URL prefixes to route to each: e.g., `location /auth/ { proxy_pass http://auth_service; }` and `location /posts/ { proxy_pass http://post_service; }`. This is L7 routing by path rather than balancing identical instances of the same service, and it's the same underlying mechanism an API Gateway uses (Phase 08, Lesson 02) — Nginx itself is often used to implement a simple gateway.

**Q: If you're running on AWS, why might you choose ALB over self-hosting Nginx?**
Answer: ALB removes the operational burden of running, patching, and scaling the load balancer itself — AWS runs it redundantly across availability zones and handles its availability for you. It integrates natively with other AWS services (auto scaling groups, target group health checks, ACM for TLS certificates) with less manual wiring than a self-managed Nginx box. The trade-off is cost (you pay per hour and per request/LCU) and less low-level configurability than a raw Nginx config file gives you — teams with very specific routing/traffic-shaping needs, or that want to avoid the recurring cost, sometimes still prefer self-hosted Nginx or HAProxy.
