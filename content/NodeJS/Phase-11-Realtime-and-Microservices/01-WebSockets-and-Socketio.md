# WebSockets and Socket.io — Complete Guide

## Table of Contents
1. [The Problem: HTTP is Request/Response](#1-the-problem-http-is-requestresponse)
2. [What is a WebSocket?](#2-what-is-a-websocket)
3. [Setting Up Socket.io Server + Client](#3-setting-up-socketio-server--client)
4. [Rooms and Namespaces](#4-rooms-and-namespaces)
5. [Complete Example: Real-Time Chat](#5-complete-example-real-time-chat)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: HTTP is Request/Response

### Polling — the naive way to fake "real time"

```
Client                          Server
  │── GET /messages ────────────▶│
  │◀──── [] (no new messages) ───│
  │  (wait 3 seconds)            │
  │── GET /messages ────────────▶│
  │◀──── [] (no new messages) ───│
  │  (wait 3 seconds)            │
  │── GET /messages ────────────▶│
  │◀──── [{msg: "hi"}] ──────────│   <- message was sent 2.9s ago, only now delivered

Problems:
  - Wasted requests (most return nothing new)
  - Latency = up to your polling interval
  - Server load scales with (clients × poll frequency), not with actual events
```

### Long polling — a partial fix

```
Client                          Server
  │── GET /messages (hangs) ────▶│   server holds the connection open
  │                               │   ... waits until a message arrives ...
  │◀──── [{msg: "hi"}] ──────────│   server responds immediately when data exists
  │── GET /messages (hangs) ────▶│   client immediately re-opens the connection
```

Better than polling, but still pays full HTTP overhead (headers, TCP handshake reuse issues) per round trip, and is one-directional — server can't push without the client asking first.

### What we actually want: a persistent, bidirectional channel

```
Client ◀──────── persistent TCP connection ────────▶ Server
  Both sides can send messages at any time, with no new "request" needed.
```

That's exactly what WebSockets provide.

---

## 2. What is a WebSocket?

A WebSocket is a **full-duplex, persistent connection** over a single TCP socket. It starts life as an HTTP request (the "handshake") and then **upgrades** to the WebSocket protocol.

### The Upgrade Handshake

```
Client Request:
  GET /chat HTTP/1.1
  Host: example.com
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13

Server Response:
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

  ── connection is now a raw WebSocket, HTTP is gone ──
```

Once upgraded, both sides can send **frames** (small messages) in either direction, at any time, without re-establishing a connection.

### HTTP Polling vs WebSockets

| Aspect | HTTP Polling | WebSockets |
|--------|-------------|------------|
| Connection | New connection per request | One persistent connection |
| Direction | Client-initiated only | Bidirectional (server can push) |
| Latency | Bound by poll interval | Near-instant |
| Overhead | Full HTTP headers every request | Small frame overhead after handshake |
| Use case | Infrequent updates, simple APIs | Chat, live dashboards, games, collaboration |

### Why Socket.io Instead of Raw `ws`?

The native `ws` library gives you raw WebSockets. Socket.io is a layer on top that adds:

- **Automatic reconnection** with exponential backoff
- **Fallback to HTTP long-polling** if WebSocket upgrade is blocked (corporate proxies, old browsers)
- **Rooms and namespaces** for grouping connections
- **Built-in event-based API** (`.emit()` / `.on()`) instead of manually parsing raw frames
- **Acknowledgements** — callbacks that confirm a message was received

```
Raw WebSocket:  you build reconnection, message framing, rooms yourself
Socket.io:      all of that is built in, at the cost of a bit more payload size
```

---

## 3. Setting Up Socket.io Server + Client

### Install

```bash
npm install express socket.io
npm install socket.io-client   # only needed if client is also Node.js
```

### Minimal Server

```javascript
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);   // Socket.io needs the raw HTTP server
const io = new Server(server, {
  cors: { origin: '*' },   // restrict this in production
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('greeting', (payload) => {
    console.log('Received:', payload);
    socket.emit('greeting-reply', { message: 'Hello back!' });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(3000, () => console.log('Server listening on :3000'));
```

### Minimal Browser Client

```html
<!-- index.html -->
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io('http://localhost:3000');

  socket.on('connect', () => {
    console.log('Connected with id', socket.id);
    socket.emit('greeting', { text: 'Hi server' });
  });

  socket.on('greeting-reply', (data) => {
    console.log('Server said:', data.message);
  });
</script>
```

Socket.io's server automatically serves the client bundle at `/socket.io/socket.io.js` — no separate build step needed.

### Minimal Node.js Client (for service-to-service or testing)

```javascript
// client.js
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('greeting', { text: 'Hi from Node client' });
});

socket.on('greeting-reply', (data) => {
  console.log('Reply:', data.message);
});
```

---

## 4. Rooms and Namespaces

### Namespaces — separate communication channels on one connection

Namespaces split your application into logical sections that share one underlying connection but have independent event streams.

```
Single Socket.io server
  │
  ├── / (default namespace)
  ├── /chat        ← chat feature events
  └── /admin       ← admin dashboard events

One physical WebSocket connection can multiplex several namespaces.
```

```javascript
// server.js
const chatNamespace = io.of('/chat');
const adminNamespace = io.of('/admin');

chatNamespace.on('connection', (socket) => {
  console.log('User joined /chat namespace');
});

adminNamespace.on('connection', (socket) => {
  console.log('Admin joined /admin namespace');
});
```

```javascript
// client.js
const chatSocket = io('http://localhost:3000/chat');
const adminSocket = io('http://localhost:3000/admin');
```

### Rooms — dynamic sub-groups within a namespace

A room is an arbitrary label a socket can join/leave. Unlike namespaces (defined at connect time), rooms are dynamic — a socket can join or leave many rooms during its lifetime. Common use: one room per chat channel, per document, or per game match.

```
Namespace: /chat
  ┌─────────────────────────────────────────────┐
  │  Room "general"      Room "random"            │
  │   ┌────┐ ┌────┐       ┌────┐                  │
  │   │ S1 │ │ S2 │       │ S3 │                  │
  │   └────┘ └────┘       └────┘                  │
  │  (S1, S2 receive        (S3 receives           │
  │   "general" msgs)        "random" msgs)        │
  └─────────────────────────────────────────────┘
```

```javascript
io.on('connection', (socket) => {
  socket.on('join-room', (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit('system', `${socket.id} joined ${roomName}`);
  });

  socket.on('leave-room', (roomName) => {
    socket.leave(roomName);
  });

  socket.on('room-message', ({ room, text }) => {
    // broadcast to everyone in the room EXCEPT the sender
    socket.to(room).emit('room-message', { from: socket.id, text });
  });
});
```

### Broadcasting Cheat Sheet

| Method | Sends to |
|--------|----------|
| `socket.emit(...)` | Only this socket |
| `io.emit(...)` | Every connected client (all namespaces default `/`) |
| `socket.broadcast.emit(...)` | Every client except sender |
| `io.to(room).emit(...)` | Every client in `room` (including sender if joined) |
| `socket.to(room).emit(...)` | Every client in `room` except sender |
| `io.of('/chat').emit(...)` | Every client in the `/chat` namespace |

---

## 5. Complete Example: Real-Time Chat

A full chat server supporting multiple rooms, join/leave notifications, and message broadcasting.

### Server

```javascript
// chat-server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store of who's in which room (fine for a single-instance demo;
// use Redis in production — see lesson 03 for pub/sub across instances)
const roomUsers = new Map(); // roomName -> Set of usernames

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

  socket.on('join', ({ room, user }) => {
    currentRoom = room;
    username = user;

    socket.join(room);

    if (!roomUsers.has(room)) roomUsers.set(room, new Set());
    roomUsers.get(room).add(username);

    // tell everyone else in the room
    socket.to(room).emit('system-message', `${username} joined the room`);

    // tell the joining client the current member list
    socket.emit('room-info', {
      room,
      members: [...roomUsers.get(room)],
    });
  });

  socket.on('chat-message', (text) => {
    if (!currentRoom) return;

    const message = {
      user: username,
      text,
      timestamp: new Date().toISOString(),
    };

    // send to everyone in the room, including the sender, for a consistent UI
    io.to(currentRoom).emit('chat-message', message);
  });

  socket.on('disconnect', () => {
    if (currentRoom && username) {
      roomUsers.get(currentRoom)?.delete(username);
      socket.to(currentRoom).emit('system-message', `${username} left the room`);
    }
  });
});

server.listen(3000, () => console.log('Chat server on :3000'));
```

### Client

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head><title>Chat</title></head>
<body>
  <input id="username" placeholder="Your name" />
  <input id="room" placeholder="Room name" value="general" />
  <button id="joinBtn">Join</button>

  <ul id="messages"></ul>

  <input id="messageInput" placeholder="Type a message..." disabled />
  <button id="sendBtn" disabled>Send</button>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();

    const usernameInput = document.getElementById('username');
    const roomInput = document.getElementById('room');
    const joinBtn = document.getElementById('joinBtn');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messagesList = document.getElementById('messages');

    function addLine(text) {
      const li = document.createElement('li');
      li.textContent = text;
      messagesList.appendChild(li);
    }

    joinBtn.addEventListener('click', () => {
      socket.emit('join', {
        user: usernameInput.value || 'Anonymous',
        room: roomInput.value || 'general',
      });
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });

    sendBtn.addEventListener('click', () => {
      if (messageInput.value.trim()) {
        socket.emit('chat-message', messageInput.value);
        messageInput.value = '';
      }
    });

    socket.on('chat-message', (msg) => {
      addLine(`[${msg.timestamp.slice(11, 19)}] ${msg.user}: ${msg.text}`);
    });

    socket.on('system-message', (text) => addLine(`* ${text}`));

    socket.on('room-info', ({ room, members }) => {
      addLine(`Joined "${room}". Members: ${members.join(', ')}`);
    });
  </script>
</body>
</html>
```

### How a Message Flows

```
Browser A                Server                Browser B, C (same room)
   │── emit('chat-message', "hi") ──▶│
   │                                  │── io.to(room).emit('chat-message', {...}) ──▶│
   │◀── (also receives own message) ─│
```

Run it: `node chat-server.js`, open `http://localhost:3000` in two browser tabs, join the same room, and chat between them.

---

## 6. Hands-On Exercises

**Exercise 1:** Run the chat server example above. Open three browser tabs — join two of them to "general" and one to "random". Verify messages don't leak between rooms.

**Exercise 2:** Add a "typing..." indicator: emit a `typing` event on keystroke (throttled), and broadcast it to the room via `socket.to(room).emit('typing', username)`. Have the client show and auto-hide the indicator.

**Exercise 3:** Add private messaging: emit `private-message` with a target `socketId`, and use `io.to(socketId).emit(...)` to deliver it only to that one socket.

**Exercise 4:** Create an `/admin` namespace that receives a `user-count` event every 5 seconds with `io.engine.clientsCount`. Build a tiny admin page that displays it live.

**Exercise 5:** Simulate a flaky network: in Chrome DevTools, throttle to "Offline" for 5 seconds then restore. Observe Socket.io's automatic reconnection in the console (`socket.on('reconnect', ...)`).

---

## 7. Interview Q&A

**Q: How does a WebSocket connection get established, and why does it start as an HTTP request?**
Answer: The client sends a normal HTTP GET request with `Upgrade: websocket` and `Connection: Upgrade` headers plus a `Sec-WebSocket-Key`. If the server supports it, it replies with `HTTP/1.1 101 Switching Protocols` and a computed `Sec-WebSocket-Accept`. After that handshake, the same TCP connection is reused as a raw WebSocket — HTTP semantics are gone and both sides can send frames freely. Starting as HTTP lets WebSockets reuse existing infrastructure (ports 80/443, proxies, load balancers) instead of needing a brand-new protocol stack.

**Q: What problem does Socket.io solve that raw WebSockets (the `ws` library) don't?**
Answer: Raw WebSockets only give you a bidirectional pipe — you must build reconnection logic, message framing/events, and any grouping (rooms) yourself. Socket.io adds automatic reconnection with backoff, a fallback to HTTP long-polling when WebSocket upgrades are blocked (e.g., corporate proxies), an event-based API (`emit`/`on`), rooms and namespaces for grouping connections, and acknowledgement callbacks — at the cost of a slightly larger client bundle and non-standard wire format (it's not interoperable with a plain WebSocket client).

**Q: What's the difference between a Socket.io namespace and a room?**
Answer: A namespace is a separate communication channel defined at connection time (e.g., `/chat`, `/admin`) — the client explicitly connects to a namespace URL, and it's typically used to separate distinct features of an app. A room is a dynamic, arbitrary label that a connected socket can join or leave at any time during its session (e.g., one room per chat channel) — used for grouping sockets within a namespace for targeted broadcasts.

**Q: If you scale a Socket.io server horizontally across multiple instances, what breaks and how do you fix it?**
Answer: By default, rooms and connection state live in each process's memory, so a broadcast from an instance only reaches sockets connected to that same instance — a user on instance A won't see a message from a user on instance B even if they're in the "same" room. The fix is the Socket.io Redis adapter: each instance publishes emitted events to a shared Redis pub/sub channel, and every instance subscribes and re-emits to its own locally connected sockets, making broadcasts work cluster-wide.

**Q: When would you choose long polling as a fallback, and does Socket.io handle that automatically?**
Answer: Yes — Socket.io negotiates the best available transport. It starts with HTTP long-polling for the initial connection (to work behind restrictive proxies/firewalls that block WebSocket upgrades), then attempts to upgrade to a real WebSocket transparently. If the upgrade fails, it keeps using long-polling. This is why Socket.io "just works" in more network environments than raw WebSockets, at the cost of slightly higher latency until the upgrade completes.

**Q: In the chat example, why does `io.to(room).emit(...)` include the sender while `socket.to(room).emit(...)` does not?**
Answer: `socket.to(room)` scopes the broadcast to the room but implicitly excludes the emitting socket, matching the semantic of "notify everyone else." `io.to(room)` has no implicit sender to exclude, so it sends to every socket currently in that room, including the one that triggered it (if it's a member). Choosing between them depends on whether the sender's own UI should render the message from the server's echo or optimistically render it locally first.
