# CDNs for Static vs Dynamic Content — Complete Guide

## Table of Contents
1. [Caching Static Content (The Traditional Use Case)](#1-caching-static-content-the-traditional-use-case)
2. [Accelerating Dynamic Content (No Caching)](#2-accelerating-dynamic-content-no-caching)
3. [Edge Compute (The Modern Era)](#3-edge-compute-the-modern-era)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

Historically, CDNs were only used for **Static Content**: images, CSS files, JavaScript bundles, and videos. These files never change based on who is asking for them, making them trivial to cache at the edge for months.

But modern web applications consist of **Dynamic Content**: API responses tailored to the logged-in user, live inventory counts, or real-time dashboards.

Can a CDN help with dynamic content? Yes, but in entirely different ways.

---

## 1. Caching Static Content (The Traditional Use Case)

This is straightforward. You configure your origin server to serve static assets with `Cache-Control: public, max-age=31536000` (1 year).

```
Client → Edge: GET /app.bundle.js
Edge: cached, max-age fresh → 200 OK (edge only)

99% of requests: Cache Hit at the edge
Origin server: sees almost zero traffic for this asset
```

The CDN edge nodes cache the files. 99% of requests result in a Cache Hit at the edge. The origin server sees almost zero traffic.

---

## 2. Accelerating Dynamic Content (No Caching)

If an endpoint returns the user's current bank balance (`/api/balance`), you **cannot** cache it. You must return `Cache-Control: no-store`. Every single request must go all the way back to the Origin Server.

So why put a CDN in front of an API? Because the CDN still provides massive performance and security benefits:

```
Client (Sydney) ──TLS handshake (10ms)──▶ Edge Node (Sydney)
                                             │
                              persistent warm connection
                              over CDN private backbone
                                             │
                                             ▼
                                     Origin (New York)
```

1. **TLS Termination at the Edge:** The TLS handshake takes 1-2 round trips. If a user in Sydney connects to an origin in New York, the handshake alone might take 500ms due to the speed of light. With a CDN, the user does the TLS handshake with the Sydney Edge Node (10ms). The CDN maintains a persistent, already-warmed-up connection from Sydney back to New York, eliminating handshake latency across the ocean.
2. **TCP Optimization:** The connection between the Edge Node and the Origin traverses the CDN's private, highly optimized fiber-optic backbone, which suffers less packet loss and congestion than the public internet.
3. **DDoS Protection:** Because the CDN absorbs the traffic first, it can identify and drop malicious packets before they ever reach your fragile origin server.

---

## 3. Edge Compute (The Modern Era)

What if you want the performance of serving from the edge, but the logic requires dynamic computation?

Modern CDNs (Cloudflare Workers, AWS Lambda@Edge, Vercel Edge Functions) allow you to **deploy your backend code directly to the CDN edge nodes**.

Instead of running a Node.js server in `us-east-1`, you write a lightweight JavaScript function. The CDN distributes that function to all 300 of its global data centers.

```
User (London) → London Edge Server
                   │
        executes your JS function locally
        (reads cookie, builds greeting)
                   │
                   ▼
        200 OK — response returned
        (Origin server never contacted)
```

When a user in London requests `/api/personalized-greeting`:
1. The London Edge Server intercepts the request.
2. It executes your JavaScript function locally in London.
3. The function reads the user's cookie, generates the dynamic greeting, and returns the response.
4. The request never touches your origin server.

**Limitations of Edge Compute:**

While you can run code at the edge, your database is usually still in one central location (e.g., Virginia). If your edge function needs to query the database, it still has to make a cross-ocean network request, defeating the purpose. Edge compute is best used for tasks that don't require heavy database access: JWT validation, A/B testing routing, SEO redirects, or modifying HTTP headers.

---

## 4. Hands-On Exercises

**Exercise 1:** Configure two routes on a test origin server — one static asset with `Cache-Control: public, max-age=31536000` and one dynamic endpoint with `Cache-Control: no-store`. Put both behind a CDN (Cloudflare free tier works) and verify via response headers which one gets cached.

**Exercise 2:** Deploy a small Cloudflare Worker (or AWS Lambda@Edge function) that reads a cookie and returns a personalized JSON greeting, without touching any origin server. Confirm via logs that the origin is never hit.

**Exercise 3:** Simulate the TLS/TCP latency benefit: use `curl -w` timing fields to measure handshake time when connecting directly to a distant origin server versus connecting through a CDN edge node.

**Exercise 4:** Deliberately misconfigure a personalized endpoint (like `/api/user-profile`) with `Cache-Control: public`, request it as two different "users" (different cookies) through a CDN, and observe the data leak — then fix it with `private`/`no-store` and confirm the leak is gone.

**Exercise 5:** Write a short design note on which of your own app's endpoints could move to Edge Compute (e.g., auth token validation, header rewriting) versus which must remain at the origin because they need heavy database access.

---

## 5. Interview Q&A

**Q: I have a GraphQL API where all requests are `POST` requests. Can a CDN cache this?**
Answer: By default, CDNs strictly refuse to cache `POST`, `PUT`, or `DELETE` requests because HTTP semantics dictate these are state-changing actions. They only cache `GET` and `HEAD` requests. However, many modern CDNs allow you to write custom Edge Compute functions to explicitly cache `POST` requests based on the hash of the GraphQL body payload, though this requires careful manual configuration.

**Q: Why shouldn't I just put `Cache-Control: public` on my `/api/user-profile` endpoint?**
Answer: Because the CDN will cache the profile of the first person who requests it (Alice). When Bob requests the same URL, the CDN will experience a Cache Hit and serve Bob Alice's private data. This is a catastrophic security breach called a "cross-user data leak." Dynamic, personalized data must always be `private` or `no-store`.

**Q: What is the benefit of a CDN if my site is entirely dynamic and uncacheable?**
Answer: TCP connection pooling and TLS termination at the edge. The user completes the costly TCP/TLS handshakes with the nearby edge node, and the edge node forwards the HTTP request over a persistent, high-speed, long-lived connection back to your origin server. Plus, you get built-in DDoS mitigation.

**Q: What kinds of logic are a good fit for Edge Compute, and what kinds are not?**
Answer: Good fits are stateless, low-latency-sensitive tasks that don't need a round trip to a central database — JWT validation, A/B test bucket assignment, SEO redirects, header rewriting, and simple personalization based on cookies. Poor fits are anything requiring heavy, consistent access to a centrally located database or complex business logic with multiple dependent queries, since the edge function would just end up making the same cross-region network trip it was trying to avoid, negating the latency benefit.

**Q: How does putting a CDN in front of a fully dynamic API help with DDoS protection specifically?**
Answer: The CDN's edge network absorbs and terminates all incoming connections first, meaning attack traffic (like a SYN flood or volumetric flood) hits the CDN's massive, purpose-built infrastructure rather than your comparatively fragile origin server. The CDN can apply rate limiting, bot detection, and traffic-pattern analysis at the edge to drop malicious requests before they ever consume your origin's compute or bandwidth, even though the legitimate dynamic responses still have to be generated by the origin.
