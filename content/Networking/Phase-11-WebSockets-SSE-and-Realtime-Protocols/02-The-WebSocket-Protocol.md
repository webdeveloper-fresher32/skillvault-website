# The WebSocket Protocol — Complete Guide

## Table of Contents
1. [What is a WebSocket?](#1-what-is-a-websocket)
2. [The HTTP Upgrade Handshake](#2-the-http-upgrade-handshake)
3. [The Connection is Now a WebSocket](#3-the-connection-is-now-a-websocket)
4. [Ping and Pong](#4-ping-and-pong)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

HTTP's Request-Response model is fundamentally incapable of true real-time, bidirectional communication. Long-polling and short-polling are merely hacks that wrap around this limitation.

To achieve true real-time streaming, we need a different protocol: **WebSockets**.

---

## 1. What is a WebSocket?

WebSocket is an entirely distinct Layer 7 protocol (just like HTTP or FTP).

However, it was designed specifically to work within the existing infrastructure of the web. It runs over standard TCP ports (80 and 443) and is supported by all modern browsers and load balancers.

Unlike HTTP, WebSocket provides a **persistent, full-duplex, bidirectional communication channel** over a single TCP connection.
- **Persistent:** The connection stays open indefinitely until one side closes it.
- **Full-Duplex:** Both the client and the server can send messages at the exact same time independently.
- **Bidirectional:** The server can push data to the client without the client ever asking for it.

---

## 2. The HTTP Upgrade Handshake

Because web browsers only know how to initiate connections using HTTP, a WebSocket connection *starts its life* as an HTTP request.

The client sends a standard HTTP `GET` request, but includes special headers asking the server to "upgrade" the connection.

**Client Request:**
```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

Notice the `Upgrade: websocket` and `Connection: Upgrade` headers. These literally say: *"Please stop speaking HTTP, and start speaking WebSocket on this TCP connection."*

The `Sec-WebSocket-Key` is a random base64-encoded string. It is not used for security or encryption. It is used merely to prove that the server actually understands the WebSocket protocol (and isn't just a dumb HTTP server ignoring the Upgrade header).

**Server Response:**
If the server supports WebSockets, it replies with an HTTP `101 Switching Protocols` status code.

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

The server takes the client's `Sec-WebSocket-Key`, appends a globally defined Magic String (`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`), hashes the result using SHA-1, and sends it back in the `Sec-WebSocket-Accept` header. This proves to the client that the server truly speaks the protocol.

---

## 3. The Connection is Now a WebSocket

The moment the client receives the `101 Switching Protocols` response, the HTTP protocol is entirely abandoned.

The underlying TCP connection remains open, but the bytes flowing over it are no longer formatted as HTTP text (with headers, bodies, and newlines). Instead, they are formatted as **WebSocket Data Frames**.

**WebSocket Framing:**
Because it is a continuous stream, the data is broken down into small binary frames. Each frame has a tiny header (2-14 bytes) that specifies:
- **FIN bit:** Is this the final fragment of a message?
- **Opcode:** Is this text data, binary data, a connection close request, or a Ping/Pong?
- **Payload Length:** How many bytes long is this specific frame?
- **Masking Key:** All frames sent from the client to the server must have their payload masked (XOR'd) to prevent cache poisoning attacks on intermediate HTTP proxies.

This tiny 2-byte overhead is drastically more efficient than sending 800 bytes of HTTP headers with every single message.

---

## 4. Ping and Pong

Because a TCP connection might sit idle for hours without either side sending a chat message, NAT routers or Load Balancers might assume the connection is dead and forcefully drop it to save memory.

To prevent this, the WebSocket protocol has built-in **Ping and Pong** control frames. The server occasionally sends a tiny Ping frame, and the client's browser automatically responds with a Pong frame. This keeps the TCP connection "warm" and prevents intermediate hardware from dropping it.

---

## 5. Hands-On Exercises

**Exercise 1:** Open a browser's DevTools Network tab, filter by "WS", and connect to a public WebSocket echo server (e.g. `wss://echo.websocket.org`). Inspect the initial handshake request/response headers and confirm the `101 Switching Protocols` status.

**Exercise 2:** Using the browser console, run `const ws = new WebSocket('wss://echo.websocket.org'); ws.onmessage = e => console.log(e.data); ws.onopen = () => ws.send('hello');`. Observe the echoed message arrive as a frame, not a new HTTP response.

**Exercise 3:** Use `wscat` (or `websocat`) from the terminal to connect to a WebSocket server and manually send several messages. Use Wireshark or `tcpdump` on the loopback interface to capture the raw frames and identify the FIN bit and opcode bytes.

**Exercise 4:** Configure an Nginx reverse proxy in front of a local WebSocket server, deliberately omitting the `proxy_set_header Upgrade $http_upgrade;` directive. Observe the connection fail, then add the header back and confirm it succeeds.

**Exercise 5:** Write a tiny WebSocket server (Node.js `ws` library or Python `websockets`) that sends a Ping frame every 30 seconds, and confirm in DevTools that the browser automatically responds with Pong frames without any application code.

---

## 6. Interview Q&A

**Q: Does a WebSocket connection use HTTP?**
Answer: Only for the very first step. It uses a standard HTTP GET request to perform the Upgrade Handshake. Once the server responds with a 101 status code, HTTP is completely discarded, and the connection switches to the binary WebSocket protocol over the same underlying TCP socket.

**Q: If WebSocket is a different protocol, why does it use port 443?**
Answer: Because historically, corporate firewalls and ISP routers blocked almost all ports except 80 (HTTP) and 443 (HTTPS). By designing WebSocket to initiate via an HTTP Upgrade on port 443, it effortlessly bypasses firewalls that are configured to only allow web traffic.

**Q: Can a Load Balancer like Nginx handle WebSockets?**
Answer: Yes, modern L7 load balancers fully support WebSockets. However, they must be explicitly configured to allow the `Upgrade` and `Connection` headers to pass through to the backend, and their timeout settings must be increased (an idle HTTP connection might time out after 60 seconds, but a WebSocket connection needs to stay alive for hours).

**Q: What is the purpose of the `Sec-WebSocket-Key` and `Sec-WebSocket-Accept` headers if they aren't for encryption?**
Answer: They exist purely as a handshake sanity check. The key proves the client is genuinely initiating a WebSocket upgrade (not a cached or replayed HTTP request), and the server's computed accept value proves it understands the WebSocket protocol rather than being a generic HTTP server blindly echoing headers. Actual security still comes from running the handshake and subsequent frames over TLS (`wss://`).

**Q: Why must the client mask WebSocket frames but not the server?**
Answer: Masking client-to-server frames prevents cache-poisoning and request-smuggling attacks against intermediary HTTP proxies that might misinterpret raw, predictable byte patterns as valid HTTP requests. Server-to-client frames don't need masking because the server is a trusted, known endpoint and the same proxy-confusion attack surface doesn't apply in that direction.

**Q: What happens to in-flight messages if a WebSocket TCP connection drops unexpectedly?**
Answer: They are lost — WebSocket itself has no built-in message-durability or replay mechanism like SSE's `Last-Event-ID`. The application layer is responsible for detecting the drop (via the `onclose`/`onerror` events), reconnecting, and re-synchronizing state, which is why chat and collaboration apps typically layer their own sequence numbers or acknowledgment protocol on top of raw WebSocket frames.
