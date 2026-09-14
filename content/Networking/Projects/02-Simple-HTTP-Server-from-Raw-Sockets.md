# Project 2 — Simple HTTP Server from Raw Sockets

**Level:** Intermediate
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 05 – HTTP/HTTPS Fundamentals

---

## Overview

Python ships `http.server`, which hides everything interesting. In this project you'll deliberately avoid it and build a minimal HTTP/1.1 server directly on top of `socket` — manually parsing the request line and headers off the wire, and hand-assembling a spec-correct HTTP response. The goal is to make the HTTP wire format from Phase 05 concrete: after this, "an HTTP request is just text over a TCP socket" stops being an abstract sentence and becomes something you've parsed byte-by-byte yourself.

---

## Requirements

- Python 3.8+ (stdlib only — `socket`)
- A browser or `curl` to test against
- No `http.server`, no `socketserver`, no third-party libraries

---

## Project Structure

```
02-raw-http-server/
└── raw_http_server.py
```

---

## Full Code — `raw_http_server.py`

```python
"""
Minimal HTTP/1.1 server built directly on raw TCP sockets — no http.server.

Supports:
  - GET and POST
  - Parsing the request line + headers
  - Routing a couple of hardcoded paths
  - Correct Content-Length / Content-Type / status-line response formatting
  - Keep-Alive is NOT implemented: every response closes the connection
    (HTTP/1.0-style "Connection: close"), which keeps the parsing logic
    simple and is explicitly called out in Design Notes below.
"""

import socket
from datetime import datetime, timezone

HOST = "0.0.0.0"
PORT = 8000

STATUS_TEXT = {
    200: "OK",
    201: "Created",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
}


def http_date() -> str:
    """RFC 7231 format, e.g. 'Fri, 03 Jul 2026 10:15:00 GMT'."""
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")


def recv_until_headers_end(conn: socket.socket) -> bytes:
    """
    Read from the socket until we've seen the blank line (\\r\\n\\r\\n)
    that terminates the HTTP header block. We read in small chunks and
    buffer because the headers might not all arrive in a single recv().
    """
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = conn.recv(4096)
        if not chunk:
            break
        buf += chunk
    return buf


def parse_request(raw: bytes):
    """
    Parse the raw bytes of an HTTP request up through the header block.
    Returns (method, path, http_version, headers_dict, leftover_body_bytes).
    """
    header_block, _, leftover = raw.partition(b"\r\n\r\n")
    lines = header_block.split(b"\r\n")

    request_line = lines[0].decode("iso-8859-1")
    # Request line format per RFC 7230: "METHOD SP request-target SP HTTP-version"
    method, path, version = request_line.split(" ")

    headers = {}
    for line in lines[1:]:
        if not line:
            continue
        name, _, value = line.decode("iso-8859-1").partition(":")
        headers[name.strip().lower()] = value.strip()

    return method, path, version, headers, leftover


def build_response(status: int, body: bytes, content_type: str = "text/plain") -> bytes:
    """Assemble a full, spec-correct HTTP/1.1 response as raw bytes."""
    status_line = f"HTTP/1.1 {status} {STATUS_TEXT.get(status, 'Unknown')}\r\n"
    headers = (
        f"Date: {http_date()}\r\n"
        f"Server: RawSocketHTTP/1.0\r\n"
        f"Content-Type: {content_type}\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"Connection: close\r\n"
        f"\r\n"
    )
    return status_line.encode() + headers.encode() + body


def route(method: str, path: str, headers: dict, body: bytes) -> bytes:
    """Very small router — matches Phase 05's discussion of paths + methods."""
    if method == "GET" and path == "/":
        html = (
            "<html><body>"
            "<h1>Hello from a raw-socket HTTP server</h1>"
            "<p>No http.server was used to render this page.</p>"
            "</body></html>"
        ).encode()
        return build_response(200, html, "text/html")

    if method == "GET" and path == "/health":
        return build_response(200, b'{"status":"ok"}', "application/json")

    if method == "POST" and path == "/echo":
        content_length = int(headers.get("content-length", 0))
        # In this simple demo we assume the whole body arrived with the
        # headers (true for small bodies from curl/browsers in one packet).
        return build_response(200, body[:content_length], "text/plain")

    if method not in ("GET", "POST"):
        return build_response(405, b"Method Not Allowed")

    return build_response(404, b"Not Found")


def handle_connection(conn: socket.socket, addr):
    try:
        raw = recv_until_headers_end(conn)
        if not raw:
            return

        method, path, version, headers, leftover = parse_request(raw)
        print(f'{addr[0]} - "{method} {path} {version}"')

        # If there's a body beyond what we already buffered, read the rest.
        content_length = int(headers.get("content-length", 0))
        body = leftover
        while len(body) < content_length:
            chunk = conn.recv(4096)
            if not chunk:
                break
            body += chunk

        response = route(method, path, headers, body)
        conn.sendall(response)
    except (ValueError, UnicodeDecodeError) as e:
        conn.sendall(build_response(400, f"Bad Request: {e}".encode()))
    finally:
        conn.close()  # we advertise "Connection: close", so honor it


def main():
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((HOST, PORT))
    server_sock.listen(5)
    print(f"Raw HTTP server listening on http://{HOST}:{PORT}")

    try:
        while True:
            conn, addr = server_sock.accept()
            handle_connection(conn, addr)  # single-threaded, one request at a time
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server_sock.close()


if __name__ == "__main__":
    main()
```

---

## How to Run

```bash
python3 raw_http_server.py
```

In another terminal:

```bash
curl -i http://localhost:8000/
curl -i http://localhost:8000/health
curl -i -X POST -d "hello server" http://localhost:8000/echo
curl -i http://localhost:8000/nope       # -> 404
curl -i -X DELETE http://localhost:8000/  # -> 405
```

Or open `http://localhost:8000/` directly in a browser.

---

## Sample Output

Server terminal:

```
Raw HTTP server listening on http://0.0.0.0:8000
127.0.0.1 - "GET / HTTP/1.1"
127.0.0.1 - "GET /health HTTP/1.1"
127.0.0.1 - "POST /echo HTTP/1.1"
```

Client (`curl -i http://localhost:8000/health`):

```
HTTP/1.1 200 OK
Date: Fri, 03 Jul 2026 10:15:00 GMT
Server: RawSocketHTTP/1.0
Content-Type: application/json
Content-Length: 16
Connection: close

{"status":"ok"}
```

---

## Design Notes

- **The request line format is exactly what Phase 05 describes**: `METHOD SP request-target SP HTTP-version CRLF`, e.g. `GET /health HTTP/1.1\r\n`. Splitting on `\r\n` and then on the first two spaces recovers all three fields.
- **Headers are `Name: value` pairs, one per line, case-insensitive names** — this server lowercases header names on parse so `Content-Length` and `content-length` both work, matching real HTTP semantics.
- **The blank line (`\r\n\r\n`) is the single most important delimiter in HTTP/1.1** — it's what separates headers from the body, and there is no other way to know where headers end. `Content-Length` (or `Transfer-Encoding: chunked`, not implemented here) is the only way to know where the *body* ends.
- **`Connection: close` on every response** sidesteps HTTP/1.1 keep-alive/pipelining entirely. Real HTTP/1.1 servers default to keep-alive (multiple requests over one TCP connection) precisely because TCP handshake + slow-start make opening a new connection per request expensive — this is exactly the motivation covered in Phase 05 and revisited in Phase 06 (TLS handshake cost) and Phase 09 (connection pooling to backends).
- **Single-threaded, one connection at a time** — deliberately simple to keep the parsing logic the focus. In production this would need threading/async like Project 1, or an event loop.
- **This server trusts `Content-Length` and does no chunked-encoding support, no URL-decoding, no query-string parsing** — all reasonable next steps, called out below.

---

## Possible Extensions

1. Parse the query string (`?key=value&...`) out of the request path.
2. Support `Transfer-Encoding: chunked` request bodies.
3. Add keep-alive: reuse the same connection for multiple requests until the client sends `Connection: close` or a timeout elapses.
4. Serve static files from a directory, computing `Content-Type` from the file extension and returning `404` for missing files.
5. Wrap the listening socket with `ssl.SSLContext` (Phase 06) to turn this into a minimal HTTPS server and compare the handshake bytes with `openssl s_client`.
