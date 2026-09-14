# Persistent Connections and Multiplexing — Complete Guide

## Table of Contents
1. [The Problem with Early HTTP](#1-the-problem-with-early-http)
2. [HTTP/1.1 and Keep-Alive](#2-http11-and-keep-alive)
3. [HTTP/2 and Multiplexing](#3-http2-and-multiplexing)
4. [HTTP/3 and TCP Head-of-Line Blocking](#4-http3-and-tcp-head-of-line-blocking)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Problem with Early HTTP

In HTTP/1.0, every single request required its own brand new TCP connection. The lifecycle looked like this:

```
1. DNS Resolution (find IP)
2. TCP Handshake (SYN, SYN-ACK, ACK)        →  1 Round Trip Time (RTT)
3. TLS Handshake (if HTTPS)                 →  1-2 RTTs
4. HTTP Request sent, HTTP Response received →  1 RTT
5. TCP Connection closed.
   (repeat from step 2 for the NEXT asset)
```

If a webpage had 1 HTML file, 5 CSS files, and 10 images, the browser had to open and close **16 separate TCP connections**.

Because TCP connections start out slow (a concept called **TCP Slow Start** to avoid overwhelming the network), throwing away a connection immediately after using it meant every single asset suffered maximum latency and minimum throughput.

---

## 2. HTTP/1.1 and Keep-Alive

HTTP/1.1 introduced **Persistent Connections** (often called Keep-Alive) as the default behavior.

Instead of closing the TCP connection after a single request, the client and server agree to keep the connection open for a set duration or number of requests. The lifecycle changed to:

```
1. Open TCP/TLS connection.
2. Request/Receive index.html.
3. (Connection stays open)
4. Request/Receive style.css   over the SAME connection.
5. Request/Receive logo.png    over the SAME connection.
```

This was a massive performance upgrade. It eliminated the 3-way handshake overhead for subsequent requests and allowed TCP to reach its maximum throughput speed.

### Head-of-Line (HoL) Blocking in HTTP/1.1

Keep-Alive solved the connection overhead problem, but it exposed a new one.

In HTTP/1.1, requests on a single TCP connection must be processed **strictly in order**. If the browser asks for `app.js` and then `data.json`, the server must send the complete response for `app.js` before it can even begin sending `data.json`.

```
Connection: [ app.js response (500ms) ][ data.json response (5ms) ]
                                        ▲
                          data.json is ready instantly but stuck
                          waiting behind app.js — HoL Blocking
```

If `app.js` takes 500ms to generate or is a massive 2MB file, `data.json` is stuck waiting in line behind it, even if `data.json` is tiny and ready to go. This traffic jam is called **Head-of-Line (HoL) Blocking**.

To work around this, browsers typically opened multiple parallel TCP connections to the same domain (usually limited to 6). This was an inefficient hack that wasted resources on both the client and server.

---

## 3. HTTP/2 and Multiplexing

HTTP/2 was created to solve HTTP/1.1's Head-of-Line blocking problem. It introduced **True Multiplexing**.

Instead of sending HTTP messages as plain text, HTTP/2 breaks them down into binary **frames** (e.g., a HEADERS frame, a DATA frame). Every frame is tagged with a Stream ID.

Because the data is broken into labeled chunks, the client and server can interleave frames from multiple different requests on a **single TCP connection**, at the exact same time.

```
Single TCP Connection:
[Stream1 frame][Stream2 frame][Stream1 frame][Stream1 frame][Stream2 frame]
   large.js       icon.png       large.js       large.js       icon.png
```

**How Multiplexing Works:**
- The browser wants `large-script.js` (Stream 1) and `tiny-icon.png` (Stream 2).
- The server sends a chunk of `large-script.js`.
- The server pauses Stream 1, sends the entirety of `tiny-icon.png` (Stream 2).
- The server resumes sending chunks of `large-script.js` (Stream 1).

With HTTP/2, a browser only needs to open **one single TCP connection per domain**. It can request 50 assets simultaneously, and they will all flow back concurrently without blocking each other.

---

## 4. HTTP/3 and TCP Head-of-Line Blocking

HTTP/2 solved HTTP-level Head-of-Line blocking, but it exposed a deeper problem: **TCP-level Head-of-Line blocking**.

Because HTTP/2 sends all 50 streams over a single TCP connection, it relies on TCP's guarantee of in-order, reliable delivery.
If a router drops a single packet, TCP stops delivering data to the application (the browser) until that missing packet is retransmitted and received.

```
TCP stream: [Stream1 pkt][Stream2 pkt][DROPPED pkt][Stream1 pkt][Stream2 pkt]
                                            ▲
                          TCP withholds EVERYTHING after this point
                          from the app, even unrelated streams
```

Even if the dropped packet belonged to `tiny-icon.png`, the browser cannot receive the arrived packets for `large-script.js` because TCP is holding them back to maintain strict order. A single dropped packet stalls *all* 50 multiplexed streams.

**HTTP/3** solves this by abandoning TCP entirely. It runs over **QUIC**, a new transport protocol built on top of UDP.
QUIC implements multiplexing natively at the transport layer. If a packet for Stream 2 is dropped, only Stream 2 stalls. Stream 1 continues completely unaffected.

---

## 5. Hands-On Exercises

**Exercise 1:** Open Chrome DevTools → Network tab on a modern website. Check the "Protocol" column (right-click the header row to enable it if hidden) and observe whether requests use `h2` (HTTP/2) or `h3` (HTTP/3).

**Exercise 2:** Run `curl -v --http1.1 https://example.com` followed by `curl -v --http2 https://example.com`. Compare the connection setup lines in the verbose output.

**Exercise 3:** Using DevTools Network tab, load a page with many small images and note how many requests appear to fire "simultaneously" — this is multiplexing in action if the site serves over HTTP/2.

**Exercise 4:** Use Chrome's network throttling (DevTools → Network → set to a lossy/slow profile) or a tool like `tc` (Linux traffic control) to simulate packet loss, and compare load times of an HTTP/2 site versus an HTTP/3 site to observe TCP-level HoL blocking in practice.

**Exercise 5:** Inspect the `Alt-Svc` response header on a site that supports HTTP/3 (e.g., `curl -I https://cloudflare.com`) — this header is how a server advertises to the browser that QUIC/HTTP/3 is available on a given port.

---

## 6. Interview Q&A

**Q: Why do browsers limit the number of parallel connections to a domain in HTTP/1.1 to 6?**
Answer: If browsers opened 50 connections to download 50 images, they would essentially be performing a Denial of Service (DoS) attack on the server. Limiting connections balances performance for the client with resource exhaustion on the server. (HTTP/2 makes this limit irrelevant by using multiplexing over a single connection).

**Q: With HTTP/2 multiplexing, do we still need to bundle our JavaScript files or use CSS sprites?**
Answer: Historically (in HTTP/1.1), developers bundled all their JS into one massive file to avoid the overhead of multiple requests and HoL blocking. With HTTP/2, requesting 20 small files is just as fast as requesting 1 large file. However, bundling is still useful for *compression* (gzip/brotli compress large files better than many small ones) and eliminating dead code (tree-shaking).

**Q: Explain the difference between Head-of-Line blocking in HTTP/1.1 and HTTP/2.**
Answer: In HTTP/1.1, HoL blocking happens at the **application layer**: a slow HTTP response blocks subsequent HTTP responses on the same TCP connection. HTTP/2 solves this with multiplexing. However, HTTP/2 suffers from HoL blocking at the **transport layer**: a single dropped TCP packet stalls all multiplexed streams on that connection. HTTP/3 (QUIC) solves this final transport-layer bottleneck.

**Q: What is Keep-Alive and why was it such a significant improvement over HTTP/1.0?**
Answer: Keep-Alive (persistent connections) allows a single TCP connection to be reused for multiple sequential HTTP requests instead of opening and closing a new connection per request. This eliminates the repeated cost of the TCP 3-way handshake (and TLS handshake, if HTTPS) for every asset, and lets TCP's congestion window grow past the initial slow-start phase, giving each subsequent request higher throughput than a fresh connection would have.

**Q: Why does HTTP/3 use UDP instead of TCP if UDP is unreliable?**
Answer: HTTP/3 doesn't use raw, unreliable UDP — it runs QUIC on top of UDP, and QUIC reimplements the reliability and ordering guarantees TCP normally provides, but per-stream instead of per-connection. This lets QUIC keep the benefits of reliable delivery while avoiding TCP's connection-wide in-order delivery requirement, which is exactly what causes transport-level Head-of-Line blocking.

**Q: If a site already uses HTTP/2, what concrete latency benefit does upgrading to HTTP/3 provide on a lossy mobile network?**
Answer: On a lossy connection, HTTP/2's single TCP connection means any packet loss stalls every in-flight stream until retransmission completes, even for streams whose data already arrived. HTTP/3's QUIC streams are independent at the transport layer, so a lost packet only stalls the one stream it belongs to — the rest of the page's assets keep flowing. This matters most on mobile/Wi-Fi networks where packet loss is common, and QUIC also supports faster connection re-establishment (via connection IDs that survive network changes, e.g., switching from Wi-Fi to cellular).
