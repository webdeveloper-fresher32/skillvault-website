# 03 - Networking Rapid-Fire Interview Q&A

This document is designed for the night before your interview. Cover the answers with your hand and test yourself.

## OSI & TCP/IP

**Q: At what layer of the OSI model does HTTP operate? What about TCP? What about IP?**
- HTTP: Layer 7 (Application)
- TCP: Layer 4 (Transport)
- IP: Layer 3 (Network)

**Q: What is a port?**
A software construct (a number from 1 to 65535) used at the Transport Layer (TCP/UDP) to direct incoming data to the correct specific application or process running on a machine. (e.g., Port 80 for an HTTP server, Port 5432 for Postgres).

## TCP vs UDP

**Q: What is the primary difference between TCP and UDP?**
TCP is connection-oriented and guarantees reliable, in-order delivery. UDP is connectionless and provides "best effort" delivery with no guarantees of order or arrival.

**Q: What is the TCP 3-way handshake?**
The process used to establish a TCP connection. 
1. Client sends SYN (Synchronize).
2. Server responds with SYN-ACK.
3. Client responds with ACK (Acknowledge).

## DNS

**Q: What is the purpose of DNS?**
To resolve human-readable domain names (like `google.com`) into machine-routable IP addresses (like `142.250.190.46`).

**Q: What is an A Record? What is a CNAME?**
- **A Record:** Maps a domain name directly to an IPv4 address.
- **CNAME:** Maps a domain name to another domain name (an alias).

## HTTP and HTTPS

**Q: What is the difference between HTTP/1.1 and HTTP/2?**
HTTP/1.1 suffers from Head-of-Line blocking because requests must be sent sequentially over a TCP connection. HTTP/2 introduced binary framing and true multiplexing, allowing dozens of concurrent requests to interleave over a single TCP connection.

**Q: Why does HTTPS require two separate forms of encryption (Symmetric and Asymmetric)?**
Asymmetric (Public/Private key) encryption is mathematically secure but computationally very slow. Symmetric encryption (AES) is incredibly fast but requires both sides to share the same secret key. HTTPS uses the slow Asymmetric encryption *only* during the TLS handshake to safely transmit a secret. It then uses that secret to generate fast Symmetric keys for the actual data transfer.

**Q: What does a Digital Certificate actually prove?**
It proves that the public key provided by the server mathematically belongs to the entity that owns the domain name, and this binding was verified and signed by a trusted third party (Certificate Authority).

## State and Auth

**Q: HTTP is a stateless protocol. How do we stay logged in?**
By using cookies. The server generates a unique Session ID, stores it in its database, and sends it to the browser via the `Set-Cookie` header. The browser automatically attaches this cookie to all subsequent requests, allowing the server to look up the user's state.

**Q: How does the `SameSite` cookie attribute prevent CSRF?**
If `SameSite=Lax` or `Strict`, the browser will refuse to attach the cookie if the HTTP request was initiated by a third-party, malicious website (Cross-Site). Since the cookie is missing, the forged request is treated as unauthenticated.

## Caching and Proxies

**Q: What is the difference between a Forward Proxy and a Reverse Proxy?**
A Forward Proxy sits in front of *clients* and hides their identities from the internet (e.g., a corporate firewall or a VPN). A Reverse Proxy sits in front of *servers* and hides their internal IPs from the internet (e.g., Nginx, Load Balancers).

**Q: Explain `Cache-Control: no-cache`.**
It does *not* mean "do not cache." It means the browser is allowed to store the file, but it must send a conditional request (using ETag or Last-Modified) to validate with the server that the file hasn't changed before using it.

**Q: What is SSL Termination?**
The process of decrypting HTTPS traffic at the Load Balancer/Reverse proxy, and forwarding the traffic as plain HTTP to the internal backend servers. It centralizes certificate management and offloads CPU strain.

## Real-Time

**Q: If I need to stream a live crypto price ticker to a React frontend, should I use WebSockets or SSE?**
Server-Sent Events (SSE). It is natively built for one-way server-to-client streaming over standard HTTP, and it handles dropped connection reconnects automatically. WebSockets are full-duplex and are overkill for a simple one-way ticker.
