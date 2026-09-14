# How CDN Routing Works — Complete Guide

## Table of Contents
1. [GeoDNS (DNS-Based Routing)](#1-geodns-dns-based-routing)
2. [Anycast (BGP-Based Routing)](#2-anycast-bgp-based-routing)
3. [Cache Hit vs. Cache Miss at the Edge](#3-cache-hit-vs-cache-miss-at-the-edge)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

A CDN is a distributed network of thousands of servers (Edge Nodes or Points of Presence - PoPs) scattered across the globe.

When a user in Sydney requests `example.com/logo.png`, how does that request magically end up at the CDN server in Sydney, rather than the one in New York?

There are two primary mechanisms CDNs use to route users to the closest edge server: **GeoDNS** and **Anycast**.

---

## 1. GeoDNS (DNS-Based Routing)

As you learned in Phase 04, when a browser wants to connect to a domain, it first makes a DNS query to resolve the domain to an IP address.

With GeoDNS, the Authoritative DNS server is smart.

```
User in Sydney ──DNS query for cdn.example.com──▶ GeoDNS server
                                                    │
                                     looks at source IP of query
                                     ("this is from Australia")
                                                    │
                                                    ▼
                                     returns IP of Sydney edge server
```

1. The user in Sydney makes a DNS query for `cdn.example.com`.
2. The DNS server looks at the source IP address of the query (usually the user's ISP resolver in Sydney).
3. The DNS server calculates: *"Ah, this query is coming from Australia."*
4. It dynamically returns the IP address of the Sydney edge server.

If a user in New York makes the exact same DNS query, the DNS server returns the IP address of the New York edge server.

**Pros:** It allows the CDN to maintain distinct IP addresses for every server, making it easy to monitor and take specific servers offline.

**Cons:** DNS caching. If the Sydney server crashes, you can update the DNS record, but ISPs in Australia might cache the old IP address for hours, causing downtime for users.

---

## 2. Anycast (BGP-Based Routing)

Anycast is a routing technique done at the network layer (BGP - Border Gateway Protocol), underneath DNS and HTTP.

With Anycast, **every single edge server in the CDN worldwide shares the exact same IP address.**

```
DNS returns 198.51.100.1 to EVERYONE, everywhere.

User in Sydney ──SYN to 198.51.100.1──▶ Internet's BGP routers
                                          pick shortest path
                                                    │
                                                    ▼
                                          Sydney edge server
                                          (nearest announcer of that IP)
```

1. The DNS server just returns a single IP address (e.g., `198.51.100.1`) no matter where in the world the query comes from.
2. The user in Sydney sends a TCP SYN packet addressed to `198.51.100.1`.
3. The Internet's core routers look at their BGP routing tables. They see that there are multiple paths to `198.51.100.1` (one in Sydney, one in Tokyo, one in New York).
4. The routers automatically forward the packet along the **shortest network path**. For the Sydney user, the shortest path naturally terminates at the Sydney edge server.

**Pros:** Insanely fast failover. If the Sydney server dies, it stops announcing the BGP route. The internet's routers instantly recalculate the shortest path and route the Sydney user's next packet to the Tokyo server. No waiting for DNS caches to clear.

**Cons:** Very complex and expensive to set up; requires deep integration with internet backbones. (This is what Cloudflare is famous for).

---

## 3. Cache Hit vs. Cache Miss at the Edge

Once the user is routed to the closest Edge Server, the server must fulfill the HTTP request.

**Scenario A: Cache Hit**

```
User → Sydney Edge: GET /logo.png
Sydney Edge: found locally, max-age not expired
Sydney Edge → User: 200 OK (from cache, ~10ms)

Origin server in New York: never contacted
```

1. The Sydney server looks in its local hard drive (cache) for `logo.png`.
2. It finds the file, and its `max-age` hasn't expired.
3. It immediately serves the file back to the user.

*Result: Blazing fast response time (~10ms). The Origin server in New York never even knew the request happened.*

**Scenario B: Cache Miss**

```
User → Sydney Edge: GET /new-video.mp4
Sydney Edge: not in cache (or expired)
Sydney Edge → Origin (New York): GET /new-video.mp4
Origin → Sydney Edge: 200 OK + file
Sydney Edge: saves copy locally, streams to user simultaneously
```

1. The user requests `new-video.mp4`.
2. The Sydney server looks in its cache and doesn't have it (or it has expired).
3. **The Edge server becomes a client.** It opens a connection across the ocean to your Origin Server in New York and asks for `new-video.mp4`.
4. The Origin server sends the file to the Sydney Edge server.
5. The Edge server saves a copy to its local disk, and simultaneously streams it to the user.

*Result: Slower response for the first user (~200ms), but the file is now cached in Sydney for all future Australian users.*

---

## 4. Hands-On Exercises

**Exercise 1:** Run `dig cdn.example-real-site.com` (pick any large site using GeoDNS, like a major streaming service) from two different network locations (e.g., your home network and a VPN in another country) and compare the returned IP addresses.

**Exercise 2:** Look up the Anycast IP ranges published by Cloudflare (`1.1.1.1` is a good example) and use `traceroute`/`mtr` from different networks to see how the path — and the terminating server — differs.

**Exercise 3:** Using a CDN you have access to (Cloudflare free tier, AWS CloudFront, etc.), set up caching for a static file, then use response headers (`CF-Cache-Status`, `X-Cache`) to observe a Cache Miss on first request and a Cache Hit on the second.

**Exercise 4:** Diagram, step by step, what happens end-to-end when a brand-new user requests an uncached image through a CDN — from DNS resolution through cache miss, origin fetch, and cache population.

**Exercise 5:** Research and write a short comparison of GeoDNS vs Anycast failover time, citing why global companies like Cloudflare and Google favor Anycast for their core services.

---

## 5. Interview Q&A

**Q: If I use Cloudflare (an Anycast CDN), do I need to worry about DNS TTLs for failover?**
Answer: No. Because all Cloudflare edge servers share the same Anycast IP address, your DNS record never needs to change. If a data center goes offline, BGP routing handles the failover instantly at the network layer.

**Q: A user in London requests a file, and experiences a Cache Miss. A second later, a user in Tokyo requests the exact same file. Is it a Hit or a Miss?**
Answer: It is a **Cache Miss**. CDN caches are localized to the specific Edge Server (PoP). The London server cached it, but the Tokyo server has never seen it before. The Tokyo server will have to go back to the Origin to fetch its own copy. (Note: some advanced CDNs have "tiered caching" where edge nodes check a regional hub before hitting the origin, but standard edge nodes do not share caches with each other).

**Q: What is the core architectural difference between GeoDNS and Anycast routing?**
Answer: GeoDNS operates at the DNS layer — it returns a *different* IP address depending on where the query came from, meaning each edge server has its own distinct IP. Anycast operates at the network/BGP layer — every edge server shares the *same* IP address, and the internet's routers themselves determine which physical server a packet reaches based on shortest path. GeoDNS routing decisions happen once at DNS resolution time; Anycast routing happens on every single packet at the network layer.

**Q: Why is DNS caching a bigger operational risk for GeoDNS-based CDNs than for Anycast-based ones?**
Answer: With GeoDNS, failover requires changing which IP address is returned for a domain, and resolvers/clients across the internet may cache that old IP for the duration of its TTL — sometimes hours, since not all resolvers respect TTLs strictly. With Anycast, the IP address never changes; failover happens by withdrawing a BGP route announcement, which propagates through routing tables in seconds and doesn't depend on any DNS cache expiring.

**Q: Why doesn't a Cache Hit at the Sydney edge server require contacting the Origin server at all?**
Answer: Once a file has been cached at an edge node with a valid, unexpired `Cache-Control: max-age`, the edge node treats itself as authoritative for serving that response — it has a full copy of the bytes and the freshness metadata needed to know it's still valid. There's no need to check with the Origin unless the cached copy has expired or been explicitly purged, which is exactly what makes CDN caching so effective at reducing Origin load and latency.
