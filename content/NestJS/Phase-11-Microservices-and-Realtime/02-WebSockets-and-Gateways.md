# WebSockets & Gateways — Complete Guide

## Table of Contents
1. [Why Gateways Are a Separate Concept from Controllers](#1-why-gateways-are-a-separate-concept-from-controllers)
2. [@WebSocketGateway Basics](#2-websocketgateway-basics)
3. [Lifecycle Hooks — OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect](#3-lifecycle-hooks--ongatewayinit-ongatewayconnection-ongatewaydisconnect)
4. [@SubscribeMessage — Handling Incoming Events](#4-subscribemessage--handling-incoming-events)
5. [@WebSocketServer — Broadcasting](#5-websocketserver--broadcasting)
6. [Worked Example — Room-Based Chat Gateway](#6-worked-example--room-based-chat-gateway)
7. [Authenticating WebSocket Connections](#7-authenticating-websocket-connections)
   - [7.1 The WsJwtGuard Referenced in Section 6](#71-the-wsjwtguard-referenced-in-section-6)
   - [7.2 Testing Gateways](#72-testing-gateways)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Gateways Are a Separate Concept from Controllers

HTTP is request/response: a client opens a connection, sends one request, gets one response, and (usually) the connection closes or is reused for the next unrelated request. WebSockets are fundamentally different — a client opens **one long-lived, bidirectional connection**, and either side can push messages at any time for the lifetime of that connection.

Nest models this with a distinct building block called a **gateway**, decorated with `@WebSocketGateway()` instead of `@Controller()`. A gateway is still a Nest provider — it participates in the same DI container, can inject services, and can use pipes and exception filters — but instead of routes, it exposes **message handlers** bound to socket event names, and instead of returning an HTTP response, it can push messages to one client, a group of clients, or every connected client at any point, not just in response to an incoming message.

```
  HTTP request/response                    WebSocket connection
  ┌────────┐  request   ┌────────┐         ┌────────┐  connect (once)  ┌────────┐
  │ Client │ ─────────▶ │ Server │         │ Client │ ───────────────▶ │ Server │
  │        │ ◀───────── │        │         │        │ ◀── message ───  │        │
  └────────┘  response  └────────┘         │        │ ── message ───▶  │        │
   connection often                        │        │ ◀── message ───  │        │
   closed/reused                           └────────┘  (either side, anytime)
                                             connection stays open
```

By default, Nest's WebSocket support is built on **socket.io**, an adapter that provides automatic reconnection, room/namespace support, and fallback transports on top of raw WebSockets. (Nest also ships a `ws`-based adapter for a lighter-weight, socket.io-free setup, but socket.io's rooms are exactly what makes scoped broadcasting easy, so it's the default choice for most apps.)

---

## 2. @WebSocketGateway Basics

A gateway is declared with `@WebSocketGateway()`, optionally configuring a port (if it should not share the HTTP server's port), a namespace, and CORS.

```typescript
import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({
  cors: { origin: '*' }, // tighten this in production — see Best Practices
})
export class EventsGateway {}
```

If no port is specified, the gateway attaches to the same underlying HTTP server Nest already created — this is the common case, since it means one process serves both your REST API and your WebSocket traffic on the same port, and reverse proxies/load balancers don't need special configuration for a second port.

A gateway class is registered like any other provider, inside a module:

```typescript
import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Module({
  providers: [EventsGateway],
})
export class EventsModule {}
```

---

## 3. Lifecycle Hooks — OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect

Gateways can implement three lifecycle interfaces, each corresponding to a distinct moment in the connection's life.

**`OnGatewayInit`** fires once, when the underlying socket.io server itself is initialized — not per client. This is the place to set up server-wide event listeners or middleware on the raw server instance.

**`OnGatewayConnection`** fires every time a new client connects. This is where you typically validate the connection (see Section 7), track the client, and join it to any default rooms.

**`OnGatewayDisconnect`** fires every time a client disconnects (whether cleanly or due to a dropped connection). This is where you clean up any per-connection state you were tracking.

```typescript
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, Socket>();

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients.set(client.id, client);
    this.logger.log(`Client connected: ${client.id} (total: ${this.connectedClients.size})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (total: ${this.connectedClients.size})`);
  }
}
```

Note the method names required by each interface: `afterInit`, `handleConnection`, and `handleDisconnect` — these are fixed names dictated by the interfaces, not decorators, so a typo in the method name means the hook silently never fires (TypeScript will catch this if the class declares `implements OnGatewayConnection`, since the interface requires the method — but it's easy to miss if you skip the `implements` clause).

---

## 4. @SubscribeMessage — Handling Incoming Events

`@SubscribeMessage(eventName)` binds a gateway method to a specific socket.io event name — the WebSocket analog of `@Get()`/`@Post()`. The payload sent by the client is available via `@MessageBody()`, and the underlying client socket via `@ConnectedSocket()`.

```typescript
import { SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@SubscribeMessage('ping')
handlePing(
  @MessageBody() data: { timestamp: number },
  @ConnectedSocket() client: Socket,
) {
  // Whatever this handler returns is sent back to the SAME client
  // as an acknowledgment/response to the 'ping' event, mirroring
  // the request-response feel of @MessagePattern.
  return { event: 'pong', data: { receivedAt: Date.now(), original: data.timestamp } };
}
```

The return value convention mirrors `@MessagePattern`: if you return a plain value, Nest wraps it and emits it back to the calling client as a response to that same event (socket.io calls this an "acknowledgment" when the client passes a callback, or Nest can wrap it as `{ event, data }` for a listener-based reply, depending on adapter configuration). For fire-and-forget-style handlers where you don't need to reply to the caller directly — e.g., you're going to broadcast to a room instead — the handler can also return `void` and use `@WebSocketServer()` to push messages explicitly.

Pipes, guards, and filters registered at the method or class level apply to `@SubscribeMessage` handlers exactly like they do to HTTP handlers, including `class-validator`-based DTO validation via `ValidationPipe`.

---

## 5. @WebSocketServer — Broadcasting

`@SubscribeMessage` handlers reply to the client that sent the message. But most realtime features need to push a message to **other** clients too — everyone in a chat room, every subscriber to a notification channel, or literally every connected client. For that, inject the raw socket.io `Server` instance with `@WebSocketServer()`.

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  broadcastToEveryone(message: string) {
    this.server.emit('announcement', { message });
  }

  broadcastToRoom(room: string, event: string, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }
}
```

`server.emit(...)` sends to every connected client on the namespace. `server.to(room).emit(...)` scopes the broadcast to clients that have joined a specific room — this is the mechanism behind chat channels, per-document collaborative editing sessions, and per-user private notification streams (a common pattern is joining every socket to a room named after that user's ID, so you can target `server.to('user:42').emit(...)` for private notifications).

---

## 6. Worked Example — Room-Based Chat Gateway

A chat gateway supporting multiple rooms: clients join a room, messages sent to that room are broadcast only to other members of the same room, and the server tracks who's present.

```typescript
import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from './ws-jwt.guard';

interface JoinRoomDto {
  room: string;
}

interface ChatMessageDto {
  room: string;
  text: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id} user=${client.data.user?.username ?? 'unknown'}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() { room }: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(room);

    // Tell the room someone new arrived (excluding the joining client itself).
    client.to(room).emit('userJoined', {
      username: client.data.user.username,
      room,
    });

    return { event: 'joinedRoom', data: { room } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() { room }: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(room);
    client.to(room).emit('userLeft', { username: client.data.user.username, room });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @MessageBody() { room, text }: ChatMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast to everyone in the room, including the sender, via the
    // server instance -- client.to(room) would exclude the sender.
    this.server.to(room).emit('newMessage', {
      username: client.data.user.username,
      text,
      room,
      sentAt: new Date().toISOString(),
    });
  }
}
```

Key detail: `client.to(room).emit(...)` broadcasts to everyone in the room **except** the emitting client, while `this.server.to(room).emit(...)` broadcasts to **everyone** in the room including the sender. Choosing the right one avoids either duplicate messages on the sender's own screen or the sender's message never echoing back to their own UI.

---

## 7. Authenticating WebSocket Connections

HTTP `@UseGuards()` on a controller runs per-request, with the guard reading headers off that single request. WebSockets break this model in an important way: the *connection* is established once, but many subsequent messages flow over it — so where does authentication happen, and does a guard even see the same context?

Nest's `CanActivate` guards **do** work with gateways, but the `ExecutionContext` inside a WS guard is a `WsArgumentsHost`, not an HTTP request — you must call `context.switchToWs()` to get at the client/data, not `context.switchToHttp()`. More importantly, guards on `@SubscribeMessage` handlers run per-message, not once at connection time — so if you rely purely on a guard, an unauthenticated client can still complete the initial socket.io handshake and hold an open connection, it just can't successfully invoke any guarded message handler.

For most apps, the right approach is to authenticate **at the handshake**, before the connection is even accepted, by reading a token off the handshake — typically passed by the client as `auth: { token }` in socket.io's connection options (not as a cookie/header the way an HTTP request would, since browsers don't let you set arbitrary headers on the initial WebSocket upgrade in most client setups). This is done either in `handleConnection` or, more robustly, using a socket.io middleware registered from `afterInit`, so a bad token disconnects the client before any handler ever runs.

```typescript
import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    // socket.io middleware runs BEFORE the connection is accepted --
    // this is the handshake-time authentication gate.
    server.use((socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          throw new UnauthorizedException('Missing auth token');
        }

        const payload = this.jwtService.verify(token);
        // Stash the verified user on the socket for later handlers to read.
        socket.data.user = { id: payload.sub, username: payload.username };
        next();
      } catch (err) {
        this.logger.warn(`Rejected WS connection: ${(err as Error).message}`);
        next(new Error('Unauthorized'));
      }
    });
  }
}
```

With this in place, `client.data.user` is trustworthy inside every subsequent `@SubscribeMessage` handler on that connection — no per-message re-verification of the JWT is needed, since the connection itself was gated. A companion `WsJwtGuard` (used in Section 6) can still be layered on for defense in depth or for per-handler authorization (e.g., checking room membership permissions), but the expensive/critical identity check happens once, at the handshake.

```
  Handshake-time auth flow
  ┌─────────┐  connect(auth: {token})  ┌────────────────────────┐
  │ Client  │ ───────────────────────▶ │ socket.io middleware    │
  │         │                          │  verify JWT             │
  │         │                          │  reject -> next(Error)  │
  │         │ ◀── connect_error ────── │  accept -> next()       │
  │         │                          └────────────────────────┘
  │         │                                     │ accepted
  │         │ ◀── connection established ───────  ▼
  │         │      client.data.user now trusted for
  │         │      every @SubscribeMessage handler on this socket
  └─────────┘
```

---

## 7.1 The WsJwtGuard Referenced in Section 6

The chat gateway example uses `@UseGuards(WsJwtGuard)` on individual message handlers as a defense-in-depth layer on top of handshake authentication. Here is what that guard looks like — note the use of `context.switchToWs()` instead of `context.switchToHttp()`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    // Relies on socket.data.user having already been populated by the
    // handshake-time middleware in Section 7 -- this guard does not
    // re-verify the JWT, it only checks that verification already happened.
    if (!client.data?.user) {
      throw new UnauthorizedException('Socket is not authenticated');
    }

    return true;
  }
}
```

This guard is intentionally cheap — it does not re-parse or re-verify a token on every message, it just confirms the handshake middleware already populated `socket.data.user`. Per-handler authorization logic (e.g., "is this user actually a member of the room they're posting to") belongs in a separate guard or in the service layer, not folded into this identity check.

---

## 7.2 Testing Gateways

Because a gateway is an ordinary Nest provider, unit testing the class in isolation (mocking `@WebSocketServer()` and any injected services) works the same as testing any other provider with the Nest testing module. Verifying the actual socket.io wire behavior, however, requires a real client — a common pattern is booting the full Nest app in a `beforeAll` and connecting a real `socket.io-client` instance in the test:

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let client: Socket;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(3000);

    client = io('http://localhost:3000', { auth: { token: 'valid-test-jwt' } });
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('echoes a joinedRoom acknowledgment', (done) => {
    client.emit('joinRoom', { room: 'general' }, (response: { event: string }) => {
      expect(response.event).toBe('joinedRoom');
      done();
    });
  });
});
```

This is slower than a pure unit test (it boots a real HTTP server and opens a real socket connection) but is the only reliable way to catch handshake-middleware and broadcast-routing bugs, which pure mocking tends to hide.

---

## 8. Common Pitfalls

- **Assuming an HTTP `@UseGuards(JwtAuthGuard)` "just works" on a gateway.** Guards built for `context.switchToHttp()` will throw or silently misbehave against a WS execution context — you need WS-aware guards using `context.switchToWs()`, and you still need handshake-time auth for the connection itself, not just per-message guards.
- **Broadcasting with `client.emit()` instead of `this.server.to(room).emit()`.** `client.emit()` sends only back to the same client that triggered the handler — a very common bug when someone means to broadcast to a room but the message only ever reaches the sender.
- **Forgetting the sender-exclusion difference between `client.to(room)` and `server.to(room)`.** Using the wrong one produces either a duplicated message in the sender's own UI or a message that mysteriously never appears for the person who sent it.
- **Not cleaning up room membership on disconnect.** socket.io automatically removes a disconnected socket from all its rooms, but any application-level state you're tracking yourself (e.g., a `Map` of room → user list) needs manual cleanup in `handleDisconnect`, or you'll leak stale "present" users.
- **CORS misconfiguration on the gateway.** `@WebSocketGateway({ cors: { origin: '*' } })` is convenient in development but is a wide-open policy in production; a mismatched or missing CORS config is one of the most common reasons a browser client fails to connect at all, often with a confusing generic connection error rather than a clear CORS message.
- **Treating `@SubscribeMessage` return values as a reliable request-response contract.** Unlike `@MessagePattern`, the "response" behavior for `@SubscribeMessage` depends on how the client is listening (ack callback vs. listening for a named response event) — don't assume every client library handles it the same way without checking the adapter configuration.

---

## 9. Best Practices

- Authenticate at the handshake (socket.io middleware or `handleConnection`) rather than relying solely on per-message guards — a socket that never should have connected shouldn't be allowed to sit open even if every handler is guarded.
- Scope broadcasts as narrowly as possible using rooms — prefer `server.to('user:42')` or `server.to('room:general')` over `server.emit()` to everyone, both for correctness and to avoid unnecessary network traffic to uninterested clients.
- Validate `@MessageBody()` payloads with DTOs and a `ValidationPipe`, exactly as you would for HTTP request bodies — untrusted socket payloads are just as much an attack surface as untrusted HTTP bodies.
- Keep gateways thin — delegate business logic (persisting a chat message, checking room permissions) to injected services, the same separation-of-concerns discipline you'd apply to HTTP controllers.
- Lock down CORS `origin` to your actual known frontend origins before deploying to production; `'*'` should be a development-only convenience.
- If you scale to multiple server instances/pods, configure the socket.io Redis adapter (`@socket.io/redis-adapter`) so broadcasts and room membership are shared across instances — without it, a broadcast on instance A never reaches a client connected to instance B.

---

## 10. Hands-On Exercises

**Exercise 1:** Build a minimal `EventsGateway` with a `@SubscribeMessage('ping')` handler that replies with `{ event: 'pong', timestamp: Date.now() }`. Connect to it with a simple socket.io client script (or the browser console) and confirm the round trip.

**Exercise 2:** Implement `OnGatewayConnection` and `OnGatewayDisconnect` to maintain a live count of connected clients, and broadcast the updated count to all clients (via `server.emit('clientCount', count)`) every time it changes.

**Exercise 3:** Build the room-based chat gateway from Section 6 without authentication first (skip the guard). Write a simple two-client test (two browser tabs or two socket.io client scripts) that join the same room and confirm messages sent by one appear for the other, and that a message in a different room is not received.

**Exercise 4:** Add handshake-time JWT authentication using the socket.io middleware pattern from Section 7. Confirm that connecting without a token (or with an invalid one) is rejected before any `@SubscribeMessage` handler can run, and that a valid token makes `client.data.user` available in your chat handlers.

**Exercise 5:** Simulate horizontal scaling: run two instances of your gateway server on different ports (or two processes) without a shared adapter, connect one client to each, and confirm a broadcast from one instance never reaches the client on the other. Then install `@socket.io/redis-adapter`, wire it up in `afterInit`, and confirm broadcasts now propagate across both instances.

---

## 11. Interview Q&A

**Q: How does a Nest gateway differ from a Nest controller?**
Answer: A controller handles discrete HTTP request/response cycles via route decorators (`@Get`, `@Post`); a gateway, decorated with `@WebSocketGateway()`, manages long-lived bidirectional WebSocket connections and exposes message handlers via `@SubscribeMessage(eventName)` bound to socket event names rather than HTTP routes. Both are ordinary Nest providers participating in the same DI container and can use pipes, guards, and filters — but a gateway can also push messages to clients proactively at any time (via the injected `@WebSocketServer()` instance), not only in reply to an incoming message, which has no HTTP equivalent.

**Q: Why don't standard HTTP guards work the same way on a WebSocket gateway?**
Answer: HTTP guards read from an `ExecutionContext` via `context.switchToHttp()`, which exposes the current request/response objects — that model assumes one request per invocation. A WebSocket connection is established once but then carries many subsequent messages, and any guard applied to a `@SubscribeMessage` handler runs per-message using `context.switchToWs()`, not once at connection time. This means guards alone don't prevent an unauthenticated client from completing the handshake and holding an open connection; real authentication needs to happen earlier, typically in a socket.io middleware or in `handleConnection`, so unauthenticated sockets are rejected before any handler can be invoked at all.

**Q: How do you broadcast a message to only the clients in a specific chat room?**
Answer: Clients join a room with `client.join(roomName)`, typically inside a `@SubscribeMessage('joinRoom')` handler. To broadcast to that room, inject the socket.io server with `@WebSocketServer() server: Server` and call `server.to(roomName).emit(event, payload)`, which sends only to sockets currently in that room. There's a meaningful distinction between `client.to(room).emit(...)`, which excludes the emitting client itself, and `server.to(room).emit(...)`, which includes everyone in the room including the sender — picking the wrong one is a common source of duplicated-or-missing-message bugs.

**Q: What are the three WebSocket gateway lifecycle hooks in Nest, and when does each fire?**
Answer: `OnGatewayInit` fires once, when the socket.io server itself is created — the right place to attach server-wide middleware, like handshake authentication. `OnGatewayConnection` fires every time a new client successfully connects, useful for tracking connected clients or joining default rooms. `OnGatewayDisconnect` fires every time a client disconnects, whether cleanly or due to a dropped connection, and is where you clean up any per-connection application state (socket.io itself automatically removes the disconnected socket from its rooms, but your own tracking structures need manual cleanup).

**Q: Where should you authenticate a WebSocket connection, and why not just rely on guards?**
Answer: Authentication should happen at the handshake — before the connection is even accepted — typically via a socket.io middleware registered in `afterInit()`, reading a token the client passes as part of its connection options (e.g., `auth: { token }`), and calling `next(new Error(...))` to reject the connection outright on failure. Relying solely on per-handler guards means an unauthenticated socket can still complete the handshake and remain connected, wasting a connection slot and potentially probing for which events exist; verifying identity once at the handshake and stashing the result on `socket.data` means every subsequent `@SubscribeMessage` handler can trust that data without re-verifying a token on every single message.

**Q: What's the socket.io Redis adapter for, and when do you need it?**
Answer: When a WebSocket-serving application scales horizontally to multiple instances or pods, each instance only knows about the sockets connected directly to it — a broadcast issued from instance A has no way to reach a client connected to instance B. The socket.io Redis adapter (`@socket.io/redis-adapter`) solves this by publishing broadcasts through Redis pub/sub so every instance receives them and relays them to its own locally connected clients, effectively making room membership and broadcasts work correctly across the whole fleet rather than just within a single process.
