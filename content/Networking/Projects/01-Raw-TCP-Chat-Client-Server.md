# Project 1 — Raw TCP Chat Client/Server

**Level:** Beginner
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 02 – TCP vs UDP

---

## Overview

You will build a multi-client chat server using nothing but Python's `socket` module — no frameworks, no libraries. The server accepts multiple simultaneous TCP connections (one thread per client) and broadcasts any message it receives from one client to every other connected client. This project makes the TCP concepts from Phase 02 (three-way handshake, connection-oriented streams, `accept()`/`connect()`) tangible: you'll watch connections get established, see TCP's stream nature (no message boundaries!) in practice, and handle disconnects cleanly.

---

## Requirements

- Python 3.8+ (stdlib only — `socket`, `threading`)
- Two or more terminal windows on the same machine (or same LAN)

---

## Project Structure

```
01-raw-tcp-chat/
├── chat_server.py
└── chat_client.py
```

---

## Full Code — `chat_server.py`

```python
"""
Raw TCP chat server.

- Listens on a TCP socket.
- Spawns one thread per connected client (thread-per-connection model).
- Broadcasts every message received from one client to all other clients.
- Uses a length-prefixed framing scheme so messages don't get merged or
  split across TCP packet boundaries (TCP is a byte STREAM, not a message
  protocol — this is the #1 gotcha when building anything on raw sockets).
"""

import socket
import threading

HOST = "0.0.0.0"       # listen on all interfaces
PORT = 5050
ENCODING = "utf-8"
HEADER_SIZE = 4          # 4 bytes = big-endian uint32 length prefix

# Shared state — protected by `clients_lock` since multiple threads touch it
clients = {}            # socket -> username
clients_lock = threading.Lock()


def send_framed(sock, message: str):
    """Send a length-prefixed message: [4-byte length][utf-8 payload]."""
    payload = message.encode(ENCODING)
    header = len(payload).to_bytes(HEADER_SIZE, byteorder="big")
    sock.sendall(header + payload)


def recv_exact(sock, num_bytes: int) -> bytes:
    """
    Read exactly num_bytes from a TCP socket.

    recv() can return fewer bytes than requested — TCP makes NO promise
    that one send() on the other end equals one recv() on this end.
    This loop is required for any correct raw-socket protocol.
    """
    buf = b""
    while len(buf) < num_bytes:
        chunk = sock.recv(num_bytes - len(buf))
        if not chunk:
            raise ConnectionError("socket closed while reading")
        buf += chunk
    return buf


def recv_framed(sock) -> str:
    """Read one length-prefixed message and return it as a string."""
    header = recv_exact(sock, HEADER_SIZE)
    length = int.from_bytes(header, byteorder="big")
    payload = recv_exact(sock, length)
    return payload.decode(ENCODING)


def broadcast(message: str, exclude_sock=None):
    """Send `message` to every connected client except `exclude_sock`."""
    with clients_lock:
        dead = []
        for sock in clients:
            if sock is exclude_sock:
                continue
            try:
                send_framed(sock, message)
            except OSError:
                dead.append(sock)
        for sock in dead:
            clients.pop(sock, None)


def handle_client(conn: socket.socket, addr):
    """Thread target: handles the full lifecycle of one client connection."""
    try:
        username = recv_framed(conn)
    except (ConnectionError, OSError):
        conn.close()
        return

    with clients_lock:
        clients[conn] = username

    print(f"[+] {username} connected from {addr}")
    broadcast(f"* {username} has joined the chat *")

    try:
        while True:
            message = recv_framed(conn)
            print(f"[{username}] {message}")
            broadcast(f"{username}: {message}", exclude_sock=conn)
    except (ConnectionError, OSError):
        pass
    finally:
        with clients_lock:
            clients.pop(conn, None)
        conn.close()
        print(f"[-] {username} disconnected")
        broadcast(f"* {username} has left the chat *")


def main():
    # AF_INET = IPv4, SOCK_STREAM = TCP
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Allow immediate re-binding to the port after restart (avoids
    # "Address already in use" from sockets stuck in TIME_WAIT)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((HOST, PORT))
    server_sock.listen(5)  # backlog: max queued pending connections
    print(f"Chat server listening on {HOST}:{PORT}")

    try:
        while True:
            conn, addr = server_sock.accept()  # blocks until a client connects
            thread = threading.Thread(
                target=handle_client, args=(conn, addr), daemon=True
            )
            thread.start()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server_sock.close()


if __name__ == "__main__":
    main()
```

---

## Full Code — `chat_client.py`

```python
"""
Raw TCP chat client.

Connects to the chat server, sends a username, then runs two concurrent
loops:
  - a reader thread that prints incoming broadcast messages
  - the main thread that reads stdin and sends messages
"""

import socket
import threading

HOST = "127.0.0.1"
PORT = 5050
ENCODING = "utf-8"
HEADER_SIZE = 4


def send_framed(sock, message: str):
    payload = message.encode(ENCODING)
    header = len(payload).to_bytes(HEADER_SIZE, byteorder="big")
    sock.sendall(header + payload)


def recv_exact(sock, num_bytes: int) -> bytes:
    buf = b""
    while len(buf) < num_bytes:
        chunk = sock.recv(num_bytes - len(buf))
        if not chunk:
            raise ConnectionError("socket closed while reading")
        buf += chunk
    return buf


def recv_framed(sock) -> str:
    header = recv_exact(sock, HEADER_SIZE)
    length = int.from_bytes(header, byteorder="big")
    payload = recv_exact(sock, length)
    return payload.decode(ENCODING)


def listen_for_messages(sock):
    """Runs in a background thread — prints whatever the server broadcasts."""
    while True:
        try:
            message = recv_framed(sock)
        except (ConnectionError, OSError):
            print("\n[disconnected from server]")
            break
        print(f"\r{message}\nYou: ", end="", flush=True)


def main():
    username = input("Choose a username: ").strip() or "anonymous"

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((HOST, PORT))  # performs the TCP 3-way handshake
    send_framed(sock, username)

    reader = threading.Thread(target=listen_for_messages, args=(sock,), daemon=True)
    reader.start()

    print(f"Connected as {username}. Type a message and press Enter (Ctrl+C to quit).\n")
    try:
        while True:
            message = input("You: ")
            if message:
                send_framed(sock, message)
    except (KeyboardInterrupt, EOFError):
        print("\nDisconnecting...")
    finally:
        sock.close()


if __name__ == "__main__":
    main()
```

---

## How to Run

**Terminal 1 — start the server:**

```bash
python3 chat_server.py
```

**Terminal 2, 3, 4 — start one or more clients:**

```bash
python3 chat_client.py
```

Each client will prompt for a username, then drop you into a `You: ` prompt. Type a message in one client's terminal and watch it appear in the others.

---

## Sample Output

Server terminal:

```
Chat server listening on 0.0.0.0:5050
[+] alice connected from ('127.0.0.1', 52344)
[+] bob connected from ('127.0.0.1', 52346)
[alice] hey bob, are you there?
[bob] yep! loud and clear
[-] alice disconnected
```

Bob's client terminal:

```
Connected as bob. Type a message and press Enter (Ctrl+C to quit).

* alice has joined the chat *
You: alice: hey bob, are you there?
yep! loud and clear
You: * alice has left the chat *
You:
```

---

## Design Notes

- **Thread-per-connection model.** Each client gets its own OS thread blocked on `recv()`. This is simple to reason about but doesn't scale to tens of thousands of connections (that's what `select`/`epoll`-based event loops, covered conceptually in Phase 02 and used by real servers like Nginx, solve). For a chat app with a handful of clients, threads are perfectly fine.
- **Length-prefixed framing is not optional.** TCP is a byte stream — the OS is free to merge two `send()` calls into one `recv()`, or split one `send()` across multiple `recv()`s, entirely based on network conditions (MTU, Nagle's algorithm, buffering). Without a framing scheme (here: a 4-byte big-endian length header before every message), two quick messages sent back-to-back can arrive concatenated in a single `recv()` call, and your app would misparse them. `recv_exact()` guards the read side; a length prefix guards the boundary.
- **`SO_REUSEADDR`** avoids the classic "Address already in use" error when you restart the server quickly — without it, the OS holds the port in `TIME_WAIT` state for ~1-2 minutes after the socket closes.
- **`daemon=True`** on threads means they won't block process exit — if the main thread dies (e.g. `Ctrl+C`), Python doesn't wait for straggler client-handler threads to finish.
- **The lock (`clients_lock`)** protects the shared `clients` dict from race conditions since multiple client-handler threads read/write it concurrently (classic producer/consumer synchronization, also covered in the OperatingSystems course's Process Synchronization phase).

---

## Possible Extensions

1. Add private messaging: `/msg <username> <text>` routes to one specific client instead of broadcasting.
2. Add a `/list` command that returns the currently connected usernames.
3. Replace the thread-per-connection model with `selectors`/`select.select()` for a single-threaded event loop — compare CPU/memory usage with 100 simulated clients.
4. Wrap the server socket in `ssl.wrap_socket()` (see Phase 06 – TLS/SSL) to encrypt chat traffic.
5. Persist chat history to a file and replay the last N messages to newly connected clients.
