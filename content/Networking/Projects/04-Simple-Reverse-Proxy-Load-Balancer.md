# Project 4 — Simple Reverse Proxy / Load Balancer

**Level:** Advanced
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 09 – Load Balancers and Reverse Proxies

---

## Overview

You will build two things: a trivial backend HTTP server (you'll run 3 copies of it on different ports) and a reverse proxy in front of them that round-robins incoming client requests across the backends. The proxy is a raw-socket TCP relay: it accepts a client connection, forwards the raw HTTP request bytes to whichever backend is "next" in rotation, and relays the backend's raw response bytes back to the client — exactly the pattern described in Phase 09 for round-robin load balancing at Layer 7.

---

## Requirements

- Python 3.8+ (stdlib only — `socket`, `http.server`, `threading`)

---

## Project Structure

```
04-reverse-proxy/
├── backend_server.py
└── reverse_proxy.py
```

---

## Full Code — `backend_server.py`

```python
"""
A trivial backend HTTP server using the stdlib http.server module.

Run three copies of this on different ports to simulate a pool of
backend instances behind a load balancer. Each response identifies
which port answered it, so you can visually confirm round-robin
distribution from the proxy.
"""

import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9001


class BackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = f"Hello from backend on port {PORT}\n".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Prefix default logging with the port so multi-backend output
        # is easy to tell apart in the terminal.
        print(f"[backend:{PORT}] {fmt % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), BackendHandler)
    print(f"Backend server listening on http://0.0.0.0:{PORT}")
    server.serve_forever()
```

---

## Full Code — `reverse_proxy.py`

```python
"""
A minimal round-robin reverse proxy / load balancer built on raw sockets.

Design:
  - Listens for client TCP connections on PROXY_PORT.
  - For each accepted connection, picks the next backend in round-robin
    order and opens a NEW TCP connection to it.
  - Relays bytes client -> backend and backend -> client using two
    threads per proxied connection (since a socket relay is a full duplex
    byte pipe: data can flow both directions simultaneously).
  - Includes a lightweight health check so a downed backend is skipped.

This is a Layer 7-ish proxy in the sense that it terminates and re-opens
TCP connections and it operates at the HTTP request granularity, but it
does not parse or modify HTTP content — it forwards raw bytes end to end,
similar to how the raw-socket HTTP server in Project 2 exposed the wire
format instead of hiding it.
"""

import socket
import threading
import itertools
import time

PROXY_HOST = "0.0.0.0"
PROXY_PORT = 8080

BACKENDS = [
    ("127.0.0.1", 9001),
    ("127.0.0.1", 9002),
    ("127.0.0.1", 9003),
]

BUFFER_SIZE = 4096
HEALTH_CHECK_INTERVAL = 5  # seconds

# Shared, mutable health state — guarded by health_lock since the health
# checker thread and the request-routing code both touch it.
backend_healthy = {backend: True for backend in BACKENDS}
health_lock = threading.Lock()

_round_robin_cycle = itertools.cycle(BACKENDS)
_pick_lock = threading.Lock()


def pick_backend():
    """
    Return the next healthy backend in round-robin order.
    Skips unhealthy backends; falls back to the first backend if all
    are (mistakenly) marked unhealthy, so the proxy never wedges shut.
    """
    with _pick_lock:
        for _ in range(len(BACKENDS)):
            candidate = next(_round_robin_cycle)
            with health_lock:
                if backend_healthy[candidate]:
                    return candidate
        return BACKENDS[0]


def relay(source: socket.socket, destination: socket.socket, label: str):
    """Pump bytes from `source` to `destination` until one side closes."""
    try:
        while True:
            data = source.recv(BUFFER_SIZE)
            if not data:
                break
            destination.sendall(data)
    except OSError:
        pass
    finally:
        try:
            destination.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle_client(client_sock: socket.socket, client_addr):
    backend_host, backend_port = pick_backend()
    print(f"Routing {client_addr} -> backend {backend_host}:{backend_port}")

    try:
        backend_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        backend_sock.settimeout(3.0)
        backend_sock.connect((backend_host, backend_port))
        backend_sock.settimeout(None)
    except OSError as e:
        print(f"Backend {backend_host}:{backend_port} unreachable: {e}")
        with health_lock:
            backend_healthy[(backend_host, backend_port)] = False
        client_sock.close()
        return

    # Two threads move bytes in both directions concurrently — a proxy
    # is fundamentally a full-duplex pipe between two sockets.
    t1 = threading.Thread(target=relay, args=(client_sock, backend_sock, "c->b"))
    t2 = threading.Thread(target=relay, args=(backend_sock, client_sock, "b->c"))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    client_sock.close()
    backend_sock.close()


def health_check_loop():
    """Periodically probe each backend with a raw TCP connect."""
    while True:
        for backend in BACKENDS:
            host, port = backend
            try:
                probe = socket.create_connection((host, port), timeout=1.0)
                probe.close()
                healthy = True
            except OSError:
                healthy = False
            with health_lock:
                was_healthy = backend_healthy[backend]
                backend_healthy[backend] = healthy
            if healthy != was_healthy:
                state = "UP" if healthy else "DOWN"
                print(f"[health-check] backend {host}:{port} is now {state}")
        time.sleep(HEALTH_CHECK_INTERVAL)


def main():
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((PROXY_HOST, PROXY_PORT))
    server_sock.listen(20)
    print(f"Reverse proxy listening on http://{PROXY_HOST}:{PROXY_PORT}")
    print(f"Backends: {BACKENDS}")

    threading.Thread(target=health_check_loop, daemon=True).start()

    try:
        while True:
            client_sock, client_addr = server_sock.accept()
            threading.Thread(
                target=handle_client, args=(client_sock, client_addr), daemon=True
            ).start()
    except KeyboardInterrupt:
        print("\nShutting down proxy...")
    finally:
        server_sock.close()


if __name__ == "__main__":
    main()
```

---

## How to Run

**Terminals 1-3 — start three backend instances:**

```bash
python3 backend_server.py 9001
python3 backend_server.py 9002
python3 backend_server.py 9003
```

**Terminal 4 — start the proxy:**

```bash
python3 reverse_proxy.py
```

**Terminal 5 — send requests through the proxy:**

```bash
for i in 1 2 3 4 5 6; do curl -s http://localhost:8080/; done
```

Try stopping one backend (`Ctrl+C` in its terminal) and re-running the loop — within `HEALTH_CHECK_INTERVAL` seconds the proxy stops routing to it.

---

## Sample Output

Proxy terminal:

```
Reverse proxy listening on http://0.0.0.0:8080
Backends: [('127.0.0.1', 9001), ('127.0.0.1', 9002), ('127.0.0.1', 9003)]
Routing ('127.0.0.1', 54012) -> backend 127.0.0.1:9001
Routing ('127.0.0.1', 54014) -> backend 127.0.0.1:9002
Routing ('127.0.0.1', 54016) -> backend 127.0.0.1:9003
Routing ('127.0.0.1', 54018) -> backend 127.0.0.1:9001
```

Client terminal (`curl` loop):

```
Hello from backend on port 9001
Hello from backend on port 9002
Hello from backend on port 9003
Hello from backend on port 9001
Hello from backend on port 9002
Hello from backend on port 9003
```

After killing the 9002 backend:

```
[health-check] backend 127.0.0.1:9002 is now DOWN
Routing ('127.0.0.1', 54030) -> backend 127.0.0.1:9001
Routing ('127.0.0.1', 54032) -> backend 127.0.0.1:9003
Routing ('127.0.0.1', 54034) -> backend 127.0.0.1:9001
```

---

## Design Notes

- **Round-robin via `itertools.cycle`** is the simplest load-balancing algorithm covered in Phase 09 — every backend gets an equal share of requests in strict rotation, regardless of current load. Real load balancers (Nginx, HAProxy, cloud ALBs) also support least-connections, weighted round-robin, and consistent hashing, which you could layer on top of `pick_backend()`.
- **The proxy opens a brand-new TCP connection to the backend per client connection** rather than pooling/reusing backend connections. Production reverse proxies keep a pool of persistent connections to each backend (upstream keep-alive) to avoid paying the TCP handshake cost on every request — a direct callback to the connection-reuse discussion in Phase 05 and Phase 09.
- **Full-duplex relay with two threads** is necessary because a client can be sending more request body while the backend is simultaneously streaming back a response (or, for chunked/streaming responses, the proxy needs to forward bytes as they arrive in both directions independently) — a single blocking `recv`/`sendall` loop in one direction would stall the other.
- **Active health checking** (`health_check_loop`) is a simplified version of what real load balancers do to detect and route around failed backends — production systems typically also track failed *request* attempts (passive health checking), not just periodic TCP-connect probes.
- **This proxy forwards raw bytes and never parses HTTP itself** — it does not add `X-Forwarded-For`, does not rewrite `Host` headers, and does not terminate TLS. A production Layer 7 proxy typically does all three (Phase 09 and Phase 06 cover why: client IP preservation, virtual hosting, and TLS termination at the edge).

---

## Possible Extensions

1. Parse the HTTP request line (like Project 2) to add an `X-Forwarded-For: <client-ip>` header before forwarding to the backend.
2. Implement least-connections load balancing: track in-flight request counts per backend and route new connections to the least-loaded one.
3. Add sticky sessions: hash the client IP (or a cookie) to consistently route the same client to the same backend.
4. Terminate TLS at the proxy (`ssl.SSLContext`, Phase 06) so clients connect over HTTPS while backend connections stay plain HTTP — a realistic "TLS termination" pattern.
5. Add a `/proxy-status` endpoint on the proxy itself that reports each backend's current health and request count.
