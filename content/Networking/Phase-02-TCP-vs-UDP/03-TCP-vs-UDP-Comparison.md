# TCP vs UDP Comparison — Complete Guide

## Table of Contents
1. [Side-by-Side Comparison Table](#1-side-by-side-comparison-table)
2. [Header Overhead Compared](#2-header-overhead-compared)
3. [Worked Scenario Questions](#3-worked-scenario-questions)
4. [How to Reason About It Yourself](#4-how-to-reason-about-it-yourself)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Side-by-Side Comparison Table

| Dimension | TCP | UDP |
|-----------|-----|-----|
| **Connection** | Connection-oriented — 3-way handshake before data flows | Connectionless — no setup, send immediately |
| **Reliability** | Reliable — lost segments are detected and retransmitted | Unreliable — lost datagrams are simply gone |
| **Ordering** | Guaranteed — receiver reassembles in correct sequence order | Not guaranteed — datagrams delivered in arrival order |
| **Speed** | Slower — handshake + ACK waits + retransmission logic add latency | Faster — no setup, no waiting for ACKs |
| **Header overhead** | 20+ bytes minimum | 8 bytes fixed |
| **Flow control** | Yes — receive window (rwnd) prevents overwhelming receiver | None built in |
| **Congestion control** | Yes — congestion window (cwnd) throttles sender under network stress | None built in |
| **Data boundaries** | Byte stream — no message boundaries preserved | Message/datagram boundaries preserved — one `send` = one `recv` |
| **Duplicate handling** | Duplicates detected and discarded automatically | No duplicate detection — app must handle if needed |
| **Server-side state** | Per-connection state tracked (sockets, buffers, timers) | Stateless — server just reads whatever arrives on the port |
| **Broadcast/multicast** | Not supported | Supported |
| **Typical use cases** | HTTP/HTTPS, REST APIs, databases, SSH, email, file transfer | DNS, live video/audio streaming, online gaming, VoIP, DHCP |

---

## 2. Header Overhead Compared

```
UDP header — 8 bytes:
┌───────────────┬───────────────┬──────────┬──────────┐
│ Source Port   │ Dest Port     │ Length   │ Checksum │
└───────────────┴───────────────┴──────────┴──────────┘

TCP header — 20 bytes minimum (before options):
┌──────────────────────────────┬──────────────────────────────┐
│ Source Port                  │ Dest Port                     │
├──────────────────────────────┴──────────────────────────────┤
│ Sequence Number                                              │
├────────────────────────────────────────────────────────────┤
│ Acknowledgment Number                                         │
├──────┬──────────┬───────────┬────────────────────────────────┤
│ Off  │ Flags    │ Window    │                                │
├──────┴──────────┴───────────┴────────────────────────────────┤
│ Checksum                     │ Urgent Pointer                 │
├────────────────────────────────────────────────────────────┤
│ Options (variable, if present)                                │
└────────────────────────────────────────────────────────────┘
```

For small, frequent messages (like game state updates dozens of times a second), that extra ~12+ bytes per packet plus handshake/ACK round trips adds up to real, perceptible latency.

---

## 3. Worked Scenario Questions

### Scenario: A REST API for a banking app that transfers money between accounts

**Answer: TCP.** Correctness matters more than speed here — a lost or misordered "transfer $500" request would be a disaster. You need guaranteed delivery, guaranteed ordering, and confirmation the server actually received and processed it. This is also why almost all HTTP/HTTPS traffic (which this API rides on) uses TCP.

### Scenario: A live multiplayer shooter game sending player position 30 times per second

**Answer: UDP.** Position updates are only useful if they're recent — a retransmitted position from 200ms ago is stale and worse than useless once a newer update exists. The game can tolerate occasionally dropping an update (the next one arrives in ~33ms anyway), but it cannot tolerate the latency of TCP's retransmission and head-of-line blocking.

### Scenario: Resolving a domain name to an IP address (DNS lookup)

**Answer: UDP.** It's a single small request and single small response. Setting up a full TCP connection (handshake + teardown) for one round trip of data is wasteful overhead. If the query is dropped, the client just resends the whole thing — cheap to redo. (DNS does fall back to TCP for large responses like zone transfers.)

### Scenario: Streaming a live sports broadcast to thousands of viewers

**Answer: UDP** (or a UDP-based protocol like RTP/SRT). A momentarily glitchy frame is far less disruptive to the viewer than the stream stalling to retransmit an old frame. Real-time video prioritizes continuity over perfect completeness.

### Scenario: Downloading a firmware update file that must be byte-perfect

**Answer: TCP.** A corrupted or incomplete firmware file could brick the device. You need every byte, in the correct order, with guaranteed delivery — exactly TCP's core promise. Speed is secondary to correctness here.

### Scenario: A VoIP call between two coworkers

**Answer: UDP.** Like video, a brief audio glitch from a dropped packet is much less noticeable and disruptive than the delay caused by waiting for TCP to retransmit and reorder a lost packet mid-conversation.

### Scenario: A chat application sending text messages

**Answer: TCP.** Messages are small and infrequent relative to game/video traffic, so handshake overhead is negligible, but losing or reordering a chat message ("yes" arriving before "did you mean no?") would confuse the conversation. Reliability wins here since the volume/frequency tradeoff that favors UDP doesn't apply.

---

## 4. How to Reason About It Yourself

When faced with a new scenario, ask two questions:

```
1. Is a lost or out-of-order piece of data ACCEPTABLE to the application,
   or would it break correctness?
      Acceptable  → leans UDP
      Not acceptable → leans TCP

2. Is LATENCY / real-time responsiveness more important than
   perfect completeness?
      Latency wins → leans UDP
      Completeness wins → leans TCP
```

Most "use TCP" answers come down to: *this data must be correct and complete, and a bit of extra latency is an acceptable price.* Most "use UDP" answers come down to: *stale or incomplete data is actively worse than missing data, so don't wait for it.*

---

## 5. Hands-On Exercises

**Exercise 1:** For each of these, decide TCP or UDP and write one sentence of reasoning before checking against this lesson: (a) a stock ticker price feed, (b) an email being sent, (c) a Zoom video call, (d) an SSH session, (e) a DNS lookup.

**Exercise 2:** Run `curl -v https://example.com` and identify in the output where the TCP handshake happens (look for "Connected to") versus where the TLS handshake happens on top of it.

**Exercise 3:** Run both the TCP and UDP servers from lesson 04. Use `tcpdump -i lo0 port 6000 or port 6001` (adjust interface/ports) while connecting to each, and compare the packet counts and flags for a single "hello" message sent over each protocol.

**Exercise 4:** Look up (or reason from what you know) which transport protocol WebRTC uses for its media streams and explain in your own words why, referencing the "acceptable loss" and "latency matters" reasoning from this lesson.

**Exercise 5:** Pick one production system you've worked on (or a well-known one, e.g., a chat app, a game backend, a video platform) and identify which transport protocol each of its major features likely uses, and why.

---

## 6. Interview Q&A

**Q: What are the fundamental differences between TCP and UDP?**
Answer: TCP is connection-oriented, reliable, and ordered — it performs a handshake, acknowledges every segment, retransmits lost data, and reassembles data in order, at the cost of extra latency and a larger header. UDP is connectionless, unreliable, and unordered — it sends independent datagrams with no handshake, no acknowledgments, and no retransmission, trading reliability for speed and lower overhead.

**Q: Why would you ever choose an "unreliable" protocol like UDP on purpose?**
Answer: Because for some applications, stale retransmitted data is worse than missing data. Live video, gaming, and VoIP care more about low latency and continuity than about every single packet arriving — a dropped frame or audio sample is less disruptive than the delay incurred waiting for TCP to detect loss and retransmit it.

**Q: Why does DNS use UDP by default but fall back to TCP sometimes?**
Answer: Most DNS queries and responses are small enough to fit in one packet each way, so the TCP handshake would be pure overhead for such a tiny exchange — UDP is more efficient. DNS falls back to TCP when the response is too large for a single UDP datagram (e.g., DNSSEC-signed responses, zone transfers) since TCP has no such size limitation.

**Q: A colleague says "UDP is just worse than TCP since it can lose data." How do you respond?**
Answer: UDP isn't strictly worse — it's a different tradeoff. TCP optimizes for correctness and completeness at the cost of latency; UDP optimizes for low latency and simplicity at the cost of guarantees. For real-time systems (gaming, live video, VoIP) where stale data is actively harmful, UDP's behavior is the correct choice, not a limitation.

**Q: What is head-of-line blocking, and how does it relate to choosing TCP vs UDP?**
Answer: Head-of-line blocking happens because TCP must deliver bytes to the application in order — if an early segment is lost, later segments that already arrived are held back until the missing one is retransmitted and received. This can stall real-time applications, which is a key reason latency-sensitive systems like live video and voice prefer UDP, where each datagram is independent.

**Q: How would you decide between TCP and UDP for a new feature you're building?**
Answer: I'd ask whether losing or reordering a piece of data would break correctness (favors TCP) or would just be a tolerable, transient glitch (favors UDP), and whether low latency matters more than completeness. For most typical CRUD APIs and file transfers, TCP is correct by default; for real-time media or high-frequency state updates, UDP (often with an application-level reliability layer, like QUIC or RTP) is worth considering.

**Q: What is QUIC and how does it relate to the TCP vs UDP debate?**
Answer: QUIC is a transport protocol built on top of UDP that reimplements many of TCP's reliability features (acknowledgments, retransmission, congestion control) at the application layer, while avoiding some of TCP's downsides like head-of-line blocking across independent streams and a slower connection setup. It's used by HTTP/3, showing that "TCP vs UDP" isn't always binary — you can build custom reliability on top of UDP when you need more control than TCP gives you.
