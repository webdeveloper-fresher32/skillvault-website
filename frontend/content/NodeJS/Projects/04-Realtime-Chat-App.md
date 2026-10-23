# Project 4 — Realtime Chat App

**Level:** Intermediate–Advanced
**Time estimate:** 75 – 100 minutes
**Phase prerequisite:** Phase 11 – Realtime and Microservices

---

## Requirements

Build a real-time chat backend using Express and Socket.IO. The server should:

- Accept WebSocket connections from clients identifying a username
- Support multiple **rooms** — clients join a named room and only receive messages broadcast to that room
- Broadcast chat messages to everyone in a room except (optionally) the sender
- Track and broadcast room membership on connect/disconnect (e.g. "Jane joined the room")
- Serve a minimal static HTML/JS client so the whole thing is testable in a browser with zero extra tooling

---

## Project Structure

```
04-realtime-chat-app/
├── package.json
├── server.js
└── public/
    └── index.html
```

---

## Code

### `package.json`

```json
{
  "name": "realtime-chat-app",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  }
}
```

### `server.js`

```javascript
// server.js — Express + Socket.IO realtime chat server
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // relaxed for local dev; restrict in production
});

// Serve the static test client
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// In-memory map of socket.id -> { username, room }
// A real deployment would move this to Redis so it works across multiple
// server instances (see Project 5 for the pub/sub pattern that enables that).
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Client sends this right after connecting
  socket.on('join_room', ({ username, room }) => {
    if (!username || !room) {
      socket.emit('error_message', { error: 'username and room are required' });
      return;
    }

    socket.join(room);
    connectedUsers.set(socket.id, { username, room });

    // Notify everyone else already in the room
    socket.to(room).emit('user_joined', {
      username,
      message: `${username} joined the room`,
      timestamp: new Date().toISOString(),
    });

    // Send the joining user their own confirmation + current room roster
    const roster = [...connectedUsers.values()]
      .filter((u) => u.room === room)
      .map((u) => u.username);

    socket.emit('joined_room', { room, roster });

    console.log(`${username} joined room "${room}"`);
  });

  // Broadcast a chat message to everyone in the sender's room
  socket.on('chat_message', ({ message }) => {
    const user = connectedUsers.get(socket.id);
    if (!user) {
      socket.emit('error_message', { error: 'You must join a room before sending messages' });
      return;
    }
    if (!message || !message.trim()) return;

    const payload = {
      username: user.username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Send to everyone in the room INCLUDING the sender, so the sender's own
    // UI renders from the same single source of truth as everyone else's.
    io.to(user.room).emit('chat_message', payload);
  });

  // Typing indicator — broadcast to everyone else in the room only
  socket.on('typing', () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    socket.to(user.room).emit('user_typing', { username: user.username });
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.to(user.room).emit('user_left', {
        username: user.username,
        message: `${user.username} left the room`,
        timestamp: new Date().toISOString(),
      });
      connectedUsers.delete(socket.id);
      console.log(`${user.username} disconnected from room "${user.room}"`);
    } else {
      console.log(`Socket disconnected: ${socket.id}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Chat server listening on http://localhost:${PORT}`));
```

### `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Realtime Chat</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 640px; margin: 2rem auto; }
    #joinForm, #chatForm { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    input { flex: 1; padding: 0.5rem; }
    button { padding: 0.5rem 1rem; }
    #messages { list-style: none; padding: 0; height: 320px; overflow-y: auto; border: 1px solid #ccc; }
    #messages li { padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }
    .system { color: #888; font-style: italic; }
    #typing { min-height: 1.2rem; color: #888; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Realtime Chat</h1>

  <form id="joinForm">
    <input id="username" placeholder="Your name" required />
    <input id="room" placeholder="Room name" required />
    <button type="submit">Join</button>
  </form>

  <ul id="messages"></ul>
  <div id="typing"></div>

  <form id="chatForm" style="display:none;">
    <input id="messageInput" placeholder="Type a message..." autocomplete="off" />
    <button type="submit">Send</button>
  </form>

  <!-- Socket.IO client served automatically by the socket.io server at this path -->
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentUsername = '';

    const joinForm = document.getElementById('joinForm');
    const chatForm = document.getElementById('chatForm');
    const messages = document.getElementById('messages');
    const typingEl = document.getElementById('typing');

    function addMessage(text, isSystem = false) {
      const li = document.createElement('li');
      li.textContent = text;
      if (isSystem) li.classList.add('system');
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    }

    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentUsername = document.getElementById('username').value.trim();
      const room = document.getElementById('room').value.trim();
      if (!currentUsername || !room) return;

      socket.emit('join_room', { username: currentUsername, room });
      joinForm.style.display = 'none';
      chatForm.style.display = 'flex';
    });

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('messageInput');
      const message = input.value.trim();
      if (!message) return;
      socket.emit('chat_message', { message });
      input.value = '';
    });

    document.getElementById('messageInput')?.addEventListener('input', () => {
      socket.emit('typing');
    });

    socket.on('joined_room', ({ room, roster }) => {
      addMessage(`You joined "${room}". Currently here: ${roster.join(', ')}`, true);
    });

    socket.on('chat_message', ({ username, message }) => {
      addMessage(`${username}: ${message}`);
    });

    socket.on('user_joined', ({ message }) => addMessage(message, true));
    socket.on('user_left', ({ message }) => addMessage(message, true));

    let typingTimeout;
    socket.on('user_typing', ({ username }) => {
      typingEl.textContent = `${username} is typing...`;
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => (typingEl.textContent = ''), 1500);
    });

    socket.on('error_message', ({ error }) => alert(error));
  </script>
</body>
</html>
```

---

## How to Run

```bash
mkdir 04-realtime-chat-app && cd 04-realtime-chat-app
mkdir public
# create package.json, server.js, public/index.html with the contents above
npm install
npm run dev
```

Open **two or more browser tabs** at [http://localhost:5000](http://localhost:5000). In each tab, join the same room name with a different username, then send messages — they appear in all tabs in that room instantly. Open a third tab with a different room name and confirm messages don't cross rooms.

---

## Design Notes

- **Rooms are Socket.IO's built-in grouping primitive** (`socket.join(room)`), not something built manually. `io.to(room).emit(...)` and `socket.to(room).emit(...)` scope broadcasts without the server needing to track membership itself for delivery — although we still track it in `connectedUsers` for the "who's in this room" roster feature.
- **`socket.to(room)` vs `io.to(room)`** — `socket.to()` excludes the emitting socket from the broadcast, `io.to()` includes everyone. Join/leave notifications use `socket.to()` (the joiner already knows they joined, via `joined_room`); chat messages use `io.to()` so the sender's own message renders through the same path as everyone else's, avoiding UI drift between "my optimistic render" and "what the server actually recorded."
- **State is in-memory (`Map`) and per-process.** This works for a single server instance. Running this behind a load balancer with multiple instances would require the Socket.IO Redis adapter so broadcasts reach sockets connected to *other* instances — see Project 5 for the underlying Redis pub/sub mechanism.
- **CORS is wide open (`origin: '*'`)** for local development convenience only; a production deployment should restrict it to the actual frontend origin.

---

## Possible Extensions

1. **Message persistence** — store messages in MongoDB per room and replay the last N messages to a client on join.
2. **Private messaging** — add a `direct_message` event that emits to a specific `socket.id` or user-to-socket mapping instead of a room.
3. **Authentication** — require a JWT (see Project 3) during the Socket.IO handshake (`socket.handshake.auth.token`) instead of a free-text username.
4. **Horizontal scaling** — install `@socket.io/redis-adapter` and connect it to Redis so multiple server instances share broadcast state.
5. **Read receipts / online status** — track and broadcast per-user "online"/"away" presence separately from room membership.
