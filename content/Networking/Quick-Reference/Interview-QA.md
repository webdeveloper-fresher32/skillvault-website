# Networking Interview Q&A

50 questions covering the full Networking course, organized by topic. Each answer is self-contained.

---

## OSI & TCP/IP Models (Q1–Q5)

**Q1. What is the OSI model and why does it have seven layers?**
Answer: The OSI (Open Systems Interconnection) model is a conceptual framework that divides network communication into seven layers — Physical, Data Link, Network, Transport, Session, Presentation, and Application — each responsible for a distinct concern. Splitting the stack this way lets each layer be designed, implemented, and replaced independently: Ethernet (Layer 2) can be swapped for Wi-Fi without touching IP (Layer 3), and TCP (Layer 4) works the same whether the link below it is fiber or radio. In practice, engineers use it mainly as a shared vocabulary ("that's a Layer 7 problem") rather than a literal implementation blueprint.

**Q2. How does the TCP/IP model differ from the OSI model?**
Answer: The TCP/IP (Internet) model collapses the OSI model's seven layers into four: Application (absorbing OSI's Application, Presentation, and Session layers), Transport, Internet, and Link (absorbing OSI's Data Link and Physical layers). TCP/IP is the model the actual internet protocol suite was built around and predates the OSI model's formalization; OSI is more of a teaching and reference model. Functionally they describe the same stack, just with different granularity at the top and bottom.

**Q3. What happens at each layer when data is sent from one host to another?**
Answer: Data is built up through encapsulation as it moves down the sender's stack: the Application layer produces a payload (e.g., an HTTP request), the Transport layer wraps it in a TCP or UDP segment with source/destination ports, the Network layer wraps that in an IP packet with source/destination IP addresses, and the Data Link layer wraps that in a frame with source/destination MAC addresses before the Physical layer transmits raw bits. The receiving host reverses this process (decapsulation), stripping each header as it passes the data up to the next layer.

**Q4. What is a MAC address versus an IP address, and why do we need both?**
Answer: A MAC address is a 48-bit hardware address burned into a network interface card, used for addressing within a single physical or logical Layer 2 segment (a LAN). An IP address is a logical, assignable address used for routing across networks at Layer 3. We need both because MAC addresses don't scale for global routing (they carry no location information and routers would need to know every device's MAC address on earth), while IP addresses are hierarchical and can be routed. ARP (Address Resolution Protocol) bridges the two by mapping an IP address to the MAC address of the next hop.

**Q5. What is encapsulation and decapsulation?**
Answer: Encapsulation is the process of wrapping data with protocol-specific headers (and sometimes trailers) as it passes down through each layer of the network stack on the sending side — an HTTP payload becomes a TCP segment, then an IP packet, then an Ethernet frame. Decapsulation is the reverse process on the receiving side: each layer strips its corresponding header and passes the remaining payload up to the next layer, until the original application data is recovered. Every router or switch along the path only needs to inspect the header relevant to its own layer.

---

## TCP vs UDP (Q6–Q12)

**Q6. What is the fundamental difference between TCP and UDP?**
Answer: TCP (Transmission Control Protocol) is connection-oriented and reliable — it establishes a connection via a handshake, guarantees ordered delivery, retransmits lost segments, and applies flow and congestion control. UDP (User Datagram Protocol) is connectionless and best-effort — it simply fires datagrams at the destination with no handshake, no acknowledgment, no retransmission, and no ordering guarantee. TCP trades speed and simplicity for reliability; UDP trades reliability for low latency and minimal overhead, which is why it's used for DNS, video streaming, and gaming.

**Q7. Walk through the TCP three-way handshake in detail.**
Answer: The client sends a SYN segment with an initial sequence number (say, seq=x) to signal it wants to open a connection. The server responds with a SYN-ACK segment, acknowledging the client's sequence number (ack=x+1) and providing its own initial sequence number (seq=y). The client responds with an ACK segment acknowledging the server's sequence number (ack=y+1). At this point both sides have confirmed they can send and receive, and the connection is established. This handshake exists so both endpoints agree on starting sequence numbers, which underpins TCP's ability to detect loss, reorder, and duplication.

**Q8. How does TCP connection teardown work, and why is it four steps instead of three?**
Answer: Teardown uses a four-way handshake: the side initiating close sends a FIN, the other side ACKs it, then that side sends its own FIN when it's also ready to close, and the original initiator ACKs that. It takes four steps (rather than three) because TCP connections are full-duplex — each direction of the connection must be closed independently, so one side can finish sending while still receiving data from the other side (a "half-close"). The side that sent the final ACK typically enters a TIME_WAIT state to handle any delayed duplicate segments before fully releasing the connection.

**Q9. What is TCP flow control and how does the sliding window work?**
Answer: Flow control prevents a fast sender from overwhelming a slow receiver. The receiver advertises a "receive window" size in every ACK, telling the sender how many more bytes it can currently buffer. The sender can have that many unacknowledged bytes in flight at once — as ACKs arrive, the window "slides" forward, allowing more data to be sent. If the receiver's buffer fills up, it advertises a window size of zero, pausing the sender until the application drains data and the receiver reopens the window.

**Q10. What is TCP congestion control?**
Answer: Congestion control prevents a sender from overwhelming the network itself (as opposed to flow control, which protects the receiver). TCP maintains a congestion window that starts small and grows using "slow start" (roughly doubling each round trip) until it detects loss, which is treated as a signal of congestion. On loss, algorithms like Reno or Cubic cut the congestion window and grow it more cautiously afterward. The effective amount of data in flight is the minimum of the flow-control receive window and the congestion window.

**Q11. What is head-of-line blocking in TCP?**
Answer: Because TCP guarantees strictly ordered delivery, if one segment is lost, all segments received after it — even if they arrived successfully — must wait in the receive buffer until the lost segment is retransmitted and arrives. This is "head-of-line blocking": a single lost packet stalls delivery of everything behind it to the application, even unrelated data. This is one of the core motivations behind HTTP/3 and QUIC, which use UDP and stream-independent loss recovery to avoid one lost packet blocking unrelated streams.

**Q12. Why would you choose UDP over TCP for an application?**
Answer: UDP is preferable when low latency matters more than perfect reliability, or when the application can tolerate or handle loss itself. Live video/audio streaming and VoIP prefer a dropped frame over a delayed one (retransmission would arrive too late to be useful). DNS uses UDP because queries are small, fit in one datagram, and a client can simply retry on timeout rather than pay for TCP's handshake overhead. Online multiplayer games send frequent position updates over UDP where a slightly stale or dropped packet is superseded by the next update anyway.

---

## IP Addressing & Subnetting (Q13–Q16)

**Q13. What is CIDR notation and what does the "/24" mean in 192.168.1.0/24?**
Answer: CIDR (Classless Inter-Domain Routing) notation specifies an IP address range as `address/prefix-length`, where the prefix length is the number of leading bits that make up the fixed network portion. `192.168.1.0/24` means the first 24 bits (192.168.1) identify the network and the remaining 8 bits are available for host addresses, giving 256 addresses (2 usable for the network and broadcast address, 254 usable for hosts). CIDR replaced the older rigid Class A/B/C system, allowing networks to be sized flexibly instead of only in fixed 8/16/24-bit blocks.

**Q14. What is the difference between a public IP address and a private IP address?**
Answer: Public IP addresses are globally unique and routable across the internet, assigned by regional internet registries. Private IP addresses come from reserved ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) that are not routable on the public internet and can be reused independently inside any organization's internal network. Devices with private IPs reach the internet via NAT (Network Address Translation) on a router/gateway, which rewrites private source addresses to the router's public address for outbound traffic and reverses the mapping for replies.

**Q15. What is subnetting and why would you subnet a network?**
Answer: Subnetting divides a larger IP network into smaller logical sub-networks by borrowing bits from the host portion of the address to extend the network portion. Reasons to subnet include: limiting the size of broadcast domains for performance, isolating traffic between departments or environments for security, and allocating address space efficiently to match the number of hosts actually needed rather than wasting a huge flat range. For example, a /16 network can be divided into 256 /24 subnets, each independently routable and isolated at Layer 3.

**Q16. What is NAT and how does it work?**
Answer: NAT (Network Address Translation) rewrites the source (and sometimes destination) IP address and port of packets as they cross a router, most commonly to let many devices with private IP addresses share a single public IP address for internet access. In the common form (PAT / NAT overload), the router maintains a translation table mapping each internal (private IP, private port) pair to a unique (public IP, public port) pair; when a reply comes back, the router looks up the table to know which internal device to forward it to. This is also why unsolicited inbound connections to devices behind NAT are normally impossible without explicit port forwarding.

---

## DNS (Q17–Q21)

**Q17. Walk through what happens during DNS resolution for a domain like www.example.com.**
Answer: The client's OS first checks its local cache; if not found, it queries a configured recursive resolver (often the ISP's or a public one like 8.8.8.8). The recursive resolver, if it doesn't have a cached answer, queries a root nameserver, which returns a referral to the appropriate top-level-domain (TLD) nameserver for `.com`. The TLD nameserver refers the resolver to the authoritative nameserver for `example.com`, which finally returns the actual IP address for `www.example.com`. The recursive resolver caches this answer (respecting its TTL) and returns it to the client.

**Q18. What is the difference between a recursive resolver and an authoritative nameserver?**
Answer: A recursive resolver is the "middleman" server (often run by an ISP, or a public service like Google's 8.8.8.8 or Cloudflare's 1.1.1.1) that does the work of walking the DNS hierarchy on behalf of the client, caching results along the way. An authoritative nameserver is the source of truth for a specific domain — it holds the actual DNS records for that zone and gives a definitive answer for queries about it, but it does not perform recursive lookups for other domains on a client's behalf.

**Q19. What are the most common DNS record types and what does each do?**
Answer: `A` maps a hostname to an IPv4 address; `AAAA` maps a hostname to an IPv6 address; `CNAME` aliases one hostname to another hostname (which is then resolved further); `MX` specifies mail servers responsible for a domain, with a priority value; `NS` specifies the authoritative nameservers for a domain; `TXT` holds arbitrary text, commonly used for domain verification and email security policies (SPF, DKIM, DMARC); and `SOA` holds administrative metadata about a zone, such as the primary nameserver and refresh intervals.

**Q20. What is a DNS TTL and how does it affect caching?**
Answer: TTL (Time To Live) is a value in seconds attached to every DNS record that tells resolvers and clients how long they're allowed to cache the answer before re-querying the authoritative server. A low TTL (e.g., 60 seconds) means changes propagate quickly but generates more query load and is used before planned changes like a server migration. A high TTL (e.g., 86400 seconds/24 hours) reduces load and latency for clients but means an incorrect or outdated record can linger in caches around the internet long after it's corrected at the source.

**Q21. What is the difference between DNS over UDP and DNS over TCP?**
Answer: DNS traditionally uses UDP on port 53 because most queries and responses are small and a single round trip is faster without TCP's handshake overhead. DNS falls back to TCP (also port 53) when a response would exceed the traditional 512-byte UDP payload limit (though EDNS0 extensions raise this in practice), for zone transfers between nameservers (`AXFR`/`IXFR`), and increasingly for DNS-over-TLS (DoT) or DNS-over-HTTPS (DoH), which run DNS queries inside an encrypted TCP-based connection for privacy.

---

## HTTP & HTTPS (Q22–Q28)

**Q22. What is the difference between HTTP and HTTPS?**
Answer: HTTP (Hypertext Transfer Protocol) sends requests and responses as plaintext over a TCP connection, meaning anyone on the network path can read or tamper with the traffic. HTTPS is HTTP layered on top of TLS (Transport Layer Security), which encrypts the connection, authenticates the server's identity via a certificate, and ensures data integrity so tampering is detectable. HTTPS uses port 443 by default versus HTTP's port 80, and it is now the baseline expectation for any site handling sensitive data — browsers actively flag plain HTTP sites as "Not Secure."

**Q23. What are the most common HTTP methods and what is idempotency?**
Answer: GET retrieves a resource without side effects; POST creates a resource or triggers a non-idempotent action; PUT replaces a resource entirely and is idempotent (calling it repeatedly with the same body produces the same end state); PATCH partially updates a resource; DELETE removes a resource and is also idempotent. Idempotency means that making the same request multiple times has the same effect as making it once — GET, PUT, and DELETE are idempotent by specification, while POST generally is not, which matters for safe retry logic in clients and proxies.

**Q24. What is the difference between HTTP/1.1, HTTP/2, and HTTP/3?**
Answer: HTTP/1.1 is text-based and, without pipelining tricks, processes one request at a time per connection, so browsers open multiple TCP connections to parallelize. HTTP/2 introduces binary framing and true multiplexing — many requests and responses interleave over a single TCP connection — plus header compression (HPACK), but it still suffers TCP-level head-of-line blocking when a single packet is lost. HTTP/3 replaces TCP with QUIC (built on UDP), giving each stream independent loss recovery so one lost packet no longer stalls unrelated streams, and it folds TLS 1.3 into the connection setup for faster handshakes.

**Q25. What are HTTP status code classes and give an example of each.**
Answer: 1xx (Informational) indicates the request was received and processing continues, e.g., 100 Continue. 2xx (Success) means the request succeeded, e.g., 200 OK or 201 Created. 3xx (Redirection) means further action is needed, e.g., 301 Moved Permanently or 304 Not Modified. 4xx (Client Error) means the client's request was malformed or unauthorized, e.g., 400 Bad Request, 401 Unauthorized, or 404 Not Found. 5xx (Server Error) means the server failed to fulfil a valid request, e.g., 500 Internal Server Error or 503 Service Unavailable.

**Q26. What is the difference between 401 Unauthorized and 403 Forbidden?**
Answer: 401 Unauthorized means the request lacks valid authentication credentials — the server doesn't know who the caller is, or the credentials provided are invalid/expired — and the client should authenticate and retry. 403 Forbidden means the server knows exactly who the caller is (authentication succeeded, or none was required) but that identity is not permitted to access the requested resource, so retrying with different credentials for the same account won't help. In short: 401 is "prove who you are," 403 is "I know who you are, and the answer is no."

**Q27. What is a persistent connection and how does keep-alive work in HTTP?**
Answer: By default in HTTP/1.0, each request opened a brand-new TCP connection, which was expensive due to handshake and slow-start overhead. HTTP/1.1 introduced persistent connections (keep-alive) by default, so a single TCP connection stays open and can be reused for multiple sequential requests to the same host, avoiding repeated handshakes. The `Connection: keep-alive` header (or its absence of `close`) signals this, and either side can close the connection after an idle timeout or a configured maximum number of requests.

**Q28. What is HTTP request/response multiplexing and why did HTTP/2 need it?**
Answer: Multiplexing means multiple independent request/response exchanges can be in flight simultaneously over a single connection, interleaved as small binary frames tagged with a stream ID, and reassembled at the other end. HTTP/1.1 could only have one request in flight per TCP connection (without unsafe pipelining), forcing browsers to open up to six parallel connections per host to achieve parallelism — an inefficient workaround. HTTP/2 solved this natively at the protocol level, so a browser can send dozens of requests over one connection without head-of-line blocking at the application layer (though TCP-level head-of-line blocking on packet loss remains, which HTTP/3 addresses).

---

## TLS/SSL (Q29–Q33)

**Q29. Walk through the TLS handshake step by step.**
Answer: The client sends a `ClientHello` listing supported TLS versions, cipher suites, and a random number. The server responds with a `ServerHello` choosing a cipher suite and providing its own random number, along with its certificate containing its public key. The client validates the certificate against a trusted certificate authority, then (in TLS 1.2) generates a pre-master secret, encrypts it with the server's public key, and sends it over; both sides then independently derive the same symmetric session key from the exchanged randoms and the pre-master secret. Both sides send an encrypted `Finished` message to confirm the handshake succeeded, after which all further traffic is encrypted with the fast symmetric session key.

**Q30. What is the difference between TLS 1.2 and TLS 1.3 in terms of handshake performance?**
Answer: TLS 1.2 typically requires two round trips (2-RTT) to complete the handshake before application data can flow. TLS 1.3 streamlines this to a single round trip (1-RTT) by having the client guess the server's preferred key exchange parameters in its first message, and it supports 0-RTT resumption for return visits to a previously-connected server, letting encrypted application data go out on the very first flight. TLS 1.3 also removes weaker legacy cipher suites and features entirely, simplifying the negotiation and closing several classes of downgrade attacks.

**Q31. What is a certificate authority (CA) and how does the chain of trust work?**
Answer: A certificate authority is a trusted organization that issues digital certificates binding a public key to an identity (like a domain name) after verifying that the requester controls that domain. Browsers and operating systems ship with a built-in list of trusted root CA certificates. A server's certificate is typically signed by an intermediate CA, whose own certificate is signed by a trusted root CA — this forms a "chain of trust" that the client validates by following signatures up to a root it already trusts, at which point the server's certificate (and its public key) is accepted as authentic.

**Q32. What is the difference between symmetric and asymmetric encryption, and how does TLS use both?**
Answer: Symmetric encryption uses a single shared key for both encryption and decryption — fast, but requires securely distributing the key first. Asymmetric encryption uses a public/private key pair — anything encrypted with the public key can only be decrypted with the private key — which solves the key-distribution problem but is computationally expensive. TLS uses asymmetric cryptography only during the handshake to securely agree on (or exchange) a shared secret, then switches to fast symmetric encryption (like AES) for the actual bulk data transfer for the rest of the session.

**Q33. What is mutual TLS (mTLS) and where is it used?**
Answer: In standard TLS, only the server presents a certificate and the client verifies it — the server has no cryptographic proof of the client's identity beyond the application layer (e.g., a password). Mutual TLS requires both sides to present and validate certificates, so the server also authenticates the client during the handshake itself. It's commonly used for service-to-service communication inside a microservices mesh, API gateways to backend services, and B2B integrations where both parties need strong, certificate-based identity verification before any application data is exchanged.

---

## Cookies, Sessions & Web Auth (Q34–Q37)

**Q34. How do cookies enable stateful sessions over stateless HTTP?**
Answer: HTTP itself is stateless — each request is independent with no memory of prior requests. Cookies bridge this gap: after a successful login, the server sends a `Set-Cookie` header containing a session identifier, which the browser then automatically attaches to every subsequent request to that domain via the `Cookie` header. The server looks up that session ID in its own store (memory, Redis, database) to retrieve the user's authenticated state, effectively simulating a continuous session on top of independent stateless requests.

**Q35. What are the key cookie security attributes and what does each protect against?**
Answer: `Secure` ensures the cookie is only ever sent over HTTPS, preventing it from leaking over plaintext HTTP. `HttpOnly` makes the cookie inaccessible to JavaScript (`document.cookie`), mitigating theft via cross-site scripting (XSS). `SameSite=Strict` or `Lax` restricts whether the cookie is sent on cross-site requests, which is a primary defense against cross-site request forgery (CSRF) — `Strict` blocks it on essentially all cross-site requests, while `Lax` (the modern default) still allows it on top-level navigations like clicking a link.

**Q36. What is CSRF and how do cookies make an application vulnerable to it?**
Answer: Cross-Site Request Forgery exploits the fact that browsers automatically attach cookies to any request to a domain, regardless of which site initiated that request. If a user is logged into `bank.com` and visits a malicious page that silently submits a form to `bank.com/transfer`, the browser will attach the user's valid session cookie, and the bank's server has no way to tell the request didn't originate from its own legitimate page. Defenses include CSRF tokens (a secret value embedded in legitimate forms that an attacker's page can't know), the `SameSite` cookie attribute, and checking the `Origin`/`Referer` header.

**Q37. What is the difference between cookie-based sessions and token-based (JWT) authentication?**
Answer: Cookie-based sessions store a random session ID in a cookie, and the actual user data/state lives server-side (in memory or a shared store like Redis) — the server can instantly revoke a session by deleting that server-side record. JWT-based authentication packs the user's claims directly into a signed token held by the client (often in a cookie or local storage); the server verifies the signature without needing a database lookup, which scales well statelessly across multiple servers, but revoking a single JWT before its expiry is hard without maintaining a blocklist, partially defeating the "stateless" benefit. Session cookies favor easy revocation and simplicity; JWTs favor horizontal scalability and cross-service/cross-domain use (e.g., APIs, microservices, mobile apps).

---

## Caching (Q38–Q41)

**Q38. What is the difference between `Cache-Control: no-cache` and `no-store`?**
Answer: `no-cache` allows the response to be cached, but the cache must revalidate it with the origin server (typically via a conditional request with `If-None-Match` or `If-Modified-Since`) before serving it — so it's not "don't cache," it's "don't use the cache blindly." `no-store` is far stricter: it forbids caching the response anywhere at all, not even temporarily, and is used for highly sensitive data like banking pages or one-time tokens where even a legitimately cached copy is unacceptable.

**Q39. What is the difference between browser caching and CDN caching?**
Answer: Browser caching stores responses in the private cache of a single user's browser, controlled by `Cache-Control: private` or the default behavior, and only benefits that one user's future requests. CDN (or any shared/proxy) caching stores a response in an intermediate server that many different users' requests pass through, controlled by `Cache-Control: public` and often `s-maxage` (which applies specifically to shared caches, separate from the browser's `max-age`), so one cached copy can serve thousands of users, dramatically reducing load on the origin server.

**Q40. How does ETag-based cache validation work?**
Answer: The server includes an `ETag` header — a hash or version identifier for the resource — in its response. On the next request, the client sends that value back in an `If-None-Match` header. If the resource hasn't changed, the server responds with `304 Not Modified` and an empty body, telling the client its cached copy is still valid, saving bandwidth. If the resource has changed, the server returns the new content with a new `ETag`. This lets a cache re-check freshness cheaply without re-downloading unchanged content.

**Q41. What is cache invalidation and why is it considered hard?**
Answer: Cache invalidation is the problem of removing or updating stale cached data once the underlying source changes, across every layer that might hold a copy — browser, CDN edge nodes, application-level caches like Redis. It's hard because caches are deliberately distributed and decoupled from the origin for performance, so there's no single point that automatically knows about every cached copy everywhere; strategies include short TTLs, cache-busting via versioned URLs/filenames (e.g., `app.a1b2c3.js`), explicit purge/invalidation API calls to the CDN, and event-driven invalidation when underlying data changes.

---

## Load Balancers & Proxies (Q42–Q44)

**Q42. What is the difference between a forward proxy and a reverse proxy?**
Answer: A forward proxy sits in front of clients and acts on their behalf when talking to servers — it's typically configured by the client, hides the client's identity from the server, and is used for things like corporate content filtering or bypassing geo-restrictions. A reverse proxy sits in front of servers and acts on their behalf when talking to clients — the client doesn't know or configure it, it hides the internal server topology, and is used for load balancing, TLS termination, and caching. The key distinction is which side (client or server) the proxy is protecting and controlled by.

**Q43. What is the difference between Layer 4 and Layer 7 load balancing?**
Answer: A Layer 4 load balancer operates at the transport layer, making routing decisions based purely on IP address and port information without inspecting the actual content of the traffic — it's fast and protocol-agnostic but can't route based on things like URL path or HTTP headers. A Layer 7 load balancer operates at the application layer, fully terminating and parsing HTTP requests, allowing routing decisions based on URL paths, hostnames, cookies, or headers (e.g., sending `/api/*` to one backend pool and `/static/*` to another) — more flexible but with more processing overhead per request.

**Q44. Name a few load balancing algorithms and when you'd use each.**
Answer: Round Robin distributes requests sequentially across servers and works well when all servers have similar capacity and requests have similar cost. Weighted Round Robin extends this by giving more powerful servers a proportionally larger share. Least Connections routes to whichever server currently has the fewest active connections, which handles uneven request durations better than round robin. IP Hash consistently routes a given client IP to the same backend, useful for session affinity when the application isn't using a shared session store. Health checks underpin all of these by removing unhealthy servers from rotation before they receive traffic.

---

## CDNs (Q45–Q46)

**Q45. What is a CDN and how does it reduce latency?**
Answer: A Content Delivery Network is a globally distributed network of edge servers that cache and serve content from a location physically close to the end user, rather than every request traveling back to a single origin server. When a user requests a resource, DNS-based or Anycast routing directs them to the nearest edge node; if that node already has the content cached, it serves it directly, avoiding the round-trip latency, transit hops, and origin server load that a direct request would incur. This is especially effective for static assets (images, JS, CSS, video) that don't change per request.

**Q46. How do CDNs handle dynamic, non-cacheable content differently from static content?**
Answer: Static content (images, stylesheets, videos) can be cached at the edge for long periods since it's identical for every user, so the CDN serves it directly from cache with very high hit rates. Dynamic content (personalized API responses, real-time data) generally can't be cached the same way, so CDNs instead optimize the round trip to the origin — using optimized backbone routing between edge and origin, connection reuse/keep-alive to the origin, and sometimes edge computing (running small pieces of logic at the edge itself) to reduce the latency of that origin round trip even when the response itself isn't cacheable.

---

## WebSockets, SSE & Realtime (Q47–Q49)

**Q47. What is the difference between WebSocket and Server-Sent Events (SSE)?**
Answer: WebSocket provides a full-duplex, bidirectional connection — after an HTTP upgrade handshake, both client and server can send messages to each other at any time over the same persistent TCP connection, making it suited for chat apps, multiplayer games, and collaborative editing. SSE is a much simpler, one-directional channel where only the server pushes events to the client over a plain long-lived HTTP connection (`text/event-stream`) — the client cannot send data back over that same channel (it would use a normal HTTP request for that). SSE is ideal for live feeds, notifications, and stock tickers where the client never needs to push data back through the same stream.

**Q48. How does the WebSocket protocol establish its connection?**
Answer: A WebSocket connection starts as a normal HTTP request with an `Upgrade: websocket` and `Connection: Upgrade` header, along with a `Sec-WebSocket-Key`. If the server supports WebSockets, it responds with `101 Switching Protocols` and a `Sec-WebSocket-Accept` header derived from the client's key, confirming the upgrade. From that point on, the same underlying TCP connection is reused, but framed using the WebSocket protocol's own lightweight binary framing instead of HTTP request/response semantics, allowing either side to send messages at any time.

**Q49. When would you choose long-polling over WebSocket or SSE?**
Answer: Long-polling — where the client sends a normal HTTP request and the server holds it open until it has data to return, then the client immediately re-requests — is the fallback choice when WebSocket or SSE support isn't available or reliable, such as behind restrictive corporate proxies or very old clients that don't support persistent connections or streaming responses. It's less efficient because each cycle involves a full new HTTP request (more overhead than a single persistent connection), but it works over plain, unmodified HTTP semantics everywhere, making it the most universally compatible realtime approximation.

---

## Putting It All Together (Q50)

**Q50. Walk through everything that happens when you type a URL into a browser and press Enter.**
Answer: First, the browser checks its cache (and the OS/resolver caches) for a DNS record for the hostname; if not cached, it performs DNS resolution — typically querying a recursive resolver which walks the hierarchy (root → TLD → authoritative nameserver) to get back an IP address. With the IP in hand, the browser opens a TCP connection to that address on port 443 (or 80), completing the three-way handshake (SYN, SYN-ACK, ACK). For HTTPS, a TLS handshake follows immediately: the browser and server negotiate a cipher suite, the server presents its certificate, the browser validates it against a trusted CA chain, and both sides derive a symmetric session key. Once the secure channel is ready, the browser sends an HTTP request (method, path, headers, cookies for that domain) over the encrypted connection. The server processes the request — hitting application logic, databases, or a cache — and returns an HTTP response with a status code, headers, and a body. The browser parses the HTML, discovers additional resources (CSS, JS, images, fonts), and fires off further requests for each (potentially reusing the same persistent connection or, on HTTP/2, multiplexing them over it), often going through a CDN edge node or load balancer sitting in front of the origin server along the way. Finally, the browser parses the CSS and JS, builds the DOM and render tree, and paints the page to the screen, executing any JavaScript that runs afterward.
