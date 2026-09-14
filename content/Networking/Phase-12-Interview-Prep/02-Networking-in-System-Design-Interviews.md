# Networking in System Design Interviews — Complete Guide

## Table of Contents
1. [Where do Load Balancers Go?](#1-where-do-load-balancers-go)
2. [When to Use a CDN (And When Not To)](#2-when-to-use-a-cdn-and-when-not-to)
3. [Real-Time Transport Choices (WebSockets vs SSE vs Polling)](#3-real-time-transport-choices-websockets-vs-sse-vs-polling)
4. [IP Hashing vs Consistent Hashing](#4-ip-hashing-vs-consistent-hashing)
5. [TCP vs UDP (Media Streaming)](#5-tcp-vs-udp-media-streaming)
6. [Interview Q&A](#6-interview-qa)

---

When you get to the System Design round of an interview (e.g., "Design Twitter", "Design WhatsApp", "Design a URL Shortener"), you aren't expected to write low-level networking code. However, you *are* expected to place networking components correctly into your architecture diagrams and justify why they are there.

This document maps the low-level concepts from the previous 11 phases directly onto high-level System Design talking points.

---

## 1. Where do Load Balancers Go?

In a system design interview, you never just draw "User -> Application Server". You always need Load Balancers (Phase 09). But where?

**Common Placements:**
1. **User to API Gateway / Web Tier:** This is mandatory. You place an L7 Load Balancer at the edge of your infrastructure to distribute incoming internet traffic across your web servers, terminate SSL/TLS (Phase 06), and absorb DDOS attacks.
2. **Web Tier to Internal Microservices:** If your web servers need to call an internal Payment Service, you place an internal L4 or L7 load balancer between them. This abstracts away the fact that there are 50 payment servers.
3. **Database Tier:** (Advanced). Sometimes a specialized L4 load balancer is placed in front of read-replica databases to distribute read queries.

*Talking Point:* "I'll place an L7 Nginx Reverse Proxy here to terminate TLS, handle SSL offloading to save CPU on my app servers, and distribute the load using a Least Connections algorithm since our requests have variable processing times."

---

## 2. When to Use a CDN (And When Not To)

If the prompt involves a global user base (Phase 10), you must include a CDN.

**Use a CDN for:**
- Profile pictures in WhatsApp / Twitter.
- Video files in Netflix / YouTube.
- Static JavaScript bundles for the frontend React app.

**DO NOT use a CDN for:**
- The actual chat messages in WhatsApp (they are dynamic and private).
- A user's bank account balance.

*Talking Point:* "Because we have users globally, downloading a 5MB image from our US-East origin would take 600ms for a user in Australia. I'll add a CDN so the image is cached at an edge node in Sydney, reducing latency to 20ms and offloading 90% of the bandwidth costs from our origin servers."

---

## 3. Real-Time Transport Choices (WebSockets vs SSE vs Polling)

If the prompt requires real-time updates ("Design a Chat App", "Design a Live Stock Ticker"), you must explicitly choose a transport protocol (Phase 11) and defend your choice.

**Design a Live Stock Ticker / News Feed:**
- **Your Choice:** Server-Sent Events (SSE).
- **Justification:** "Because data only flows in one direction (server pushing prices to the client), WebSockets are overkill. SSE works natively over HTTP, making it easier to load balance, and has built-in reconnection logic which is critical for mobile users dropping connections."

**Design WhatsApp / Discord:**
- **Your Choice:** WebSockets.
- **Justification:** "Because users are constantly typing and receiving messages simultaneously, we need a full-duplex, bidirectional connection. WebSockets allow us to stream messages in both directions with very low overhead (2-byte frames) compared to making a new HTTP request for every single chat message."

---

## 4. IP Hashing vs Consistent Hashing

If the prompt requires caching data in memory (like a massive Redis cluster), the interviewer will ask: *"How do you decide which Redis node stores which data, and what happens when you add a new node?"*

**The Wrong Answer:** Modulo hashing (`hash(user_id) % num_servers`).
- *Why:* "If we add a server, `num_servers` changes from 4 to 5. Almost every single user ID will hash to a different number, meaning 80% of our cache is instantly invalidated and hits the database, causing a cache stampede."

**The Right Answer:** Consistent Hashing (Phase 09).
- *Why:* "I will use Consistent Hashing to map both the keys and the Redis nodes onto a ring. If we add a new Redis node to handle increased load, it only takes over a small fraction of keys from its immediate neighbor. The vast majority of the cache remains fully intact."

---

## 5. TCP vs UDP (Media Streaming)

If the prompt is "Design Zoom" or "Design a Multiplayer Game":

- **The Choice:** UDP (Phase 02).
- **Justification:** "For live voice and video, latency is more important than perfect reliability. If a packet containing a single frame of video is dropped, TCP will pause the entire stream to retransmit it (Head-of-Line blocking), causing the video to freeze and stutter. UDP will just drop the frame and move on, resulting in a momentary visual glitch but keeping the conversation in real-time."

---

## 6. Interview Q&A

**Q: Where would you place a load balancer in a typical web architecture?**
Answer: At minimum, an L7 load balancer sits at the edge in front of the web tier to distribute internet traffic, terminate TLS, and absorb DDoS traffic. In larger systems, additional internal L4 or L7 load balancers sit between the web tier and internal microservices (e.g. a payment service), and specialized L4 load balancers can even front read-replica database pools to spread read queries.

**Q: When would you choose SSE over WebSockets in a system design interview?**
Answer: Choose SSE whenever data only needs to flow one way, from server to client — live stock tickers, news feeds, notifications. It runs over plain HTTP (simpler to load balance, no special proxy configuration), and it has automatic, built-in reconnection logic. Reach for WebSockets only when the client also needs to push data back with the same low latency, such as a chat app or multiplayer game.

**Q: Why is consistent hashing preferred over simple modulo hashing for distributing keys across cache nodes?**
Answer: Modulo hashing (`hash(key) % N`) remaps almost every key whenever `N` changes, since the divisor itself changes — adding or removing a single node can invalidate the vast majority of a cache, triggering a stampede against the database. Consistent hashing places both nodes and keys on a ring so that adding or removing a node only reassigns the small slice of keys immediately adjacent to it, leaving the rest of the cache intact.

**Q: Why would you choose UDP over TCP for a video conferencing system like Zoom?**
Answer: TCP guarantees ordered, reliable delivery by retransmitting lost packets, but that means the entire stream pauses to wait for a retransmit — head-of-line blocking — which is disastrous for live audio/video where a delayed frame is worse than a dropped one. UDP has no such guarantee: a lost packet is simply skipped, causing a brief visual or audio glitch rather than a stall, which keeps the conversation feeling real-time.

**Q: When should you explicitly avoid putting a CDN in front of certain content in a system design answer?**
Answer: Avoid a CDN for dynamic, private, or highly volatile data — individual chat messages in WhatsApp, a user's bank balance, or any per-user response that shouldn't be cached and served to other users. CDNs are for content that is static or shared across many users, like profile pictures, video files, or JS/CSS bundles, where caching at the edge meaningfully cuts latency and origin load.
