# Nest Microservices & Transporters — Complete Guide

## Table of Contents
1. [What "Microservices" Means in Nest](#1-what-microservices-means-in-nest)
2. [The Transporter Abstraction](#2-the-transporter-abstraction)
3. [Transporter Overview — TCP, Redis, NATS, RabbitMQ, Kafka](#3-transporter-overview--tcp-redis-nats-rabbitmq-kafka)
4. [MessagePattern vs EventPattern](#4-messagepattern-vs-eventpattern)
5. [ClientProxy — Calling Another Service](#5-clientproxy--calling-another-service)
6. [Hybrid Applications](#6-hybrid-applications)
7. [Worked Example — Two Services Over TCP](#7-worked-example--two-services-over-tcp)
   - [7.1 Exception Handling Across the Wire](#71-exception-handling-across-the-wire)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What "Microservices" Means in Nest

The `@nestjs/microservices` package does not give you microservices architecture for free — it gives you a **messaging layer**. A "Nest microservice" is a Nest application that, instead of (or in addition to) listening for HTTP requests, listens for messages arriving over some other transport: a raw TCP socket, a Redis pub/sub channel, a NATS subject, a RabbitMQ queue, or a Kafka topic.

Everything you already know still applies: controllers still receive requests, providers still get injected, pipes and interceptors still run. The only thing that changes is what triggers a handler. Where an HTTP controller uses `@Get()`/`@Post()` decorators tied to a route, a microservice controller uses `@MessagePattern()`/`@EventPattern()` decorators tied to a **pattern** — an arbitrary string, object, or number that identifies the kind of message.

```
  HTTP Controller                     Microservice Controller
  ┌───────────────────────┐           ┌───────────────────────┐
  │ @Get('users/:id')     │           │ @MessagePattern(      │
  │ findOne(@Param() ..)  │           │   { cmd: 'find_user' })│
  │                       │           │ findOne(@Payload() ..)│
  └───────────────────────┘           └───────────────────────┘
        triggered by                        triggered by
     HTTP GET /users/5                 a message matching the
                                        pattern { cmd: 'find_user' }
```

This matters for architecture: Nest microservices are usually **not** exposed directly to the public internet. A typical topology has one or more HTTP-facing "gateway" applications that terminate public traffic and internally delegate work to microservice applications over TCP, Redis, or a broker. The microservices themselves have no HTTP surface at all — they only understand the transporter's wire protocol.

---

## 2. The Transporter Abstraction

A **transporter** is Nest's pluggable adapter between your application code and the underlying transport mechanism. You select a transporter with the `Transport` enum when creating a microservice application, and Nest handles serialization, connection management, and message routing consistently across all of them.

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3001,
      },
    },
  );

  await app.listen();
}
bootstrap();
```

Because the transporter is just a strategy plugged into the same Nest runtime, switching from TCP to Redis to Kafka is largely a configuration change, not a rewrite of your controllers or services — the `@MessagePattern`/`@EventPattern` handlers stay the same. This is the main selling point: your business logic is transport-agnostic.

```
  Application Layer (unchanged across transporters)
  ┌─────────────────────────────────────────────────┐
  │  Controllers  →  @MessagePattern / @EventPattern │
  │  Services     →  business logic                 │
  └─────────────────────────────────────────────────┘
                       │
                       ▼
  Transporter Strategy (swappable)
  ┌───────┬────────┬──────┬──────────┬───────┐
  │  TCP  │ Redis  │ NATS │ RabbitMQ │ Kafka │
  └───────┴────────┴──────┴──────────┴───────┘
```

---

## 3. Transporter Overview — TCP, Redis, NATS, RabbitMQ, Kafka

Each transporter has different guarantees and is suited to different situations. You don't need to memorize wire protocols, but you should know the shape of the trade-off.

**TCP** — Nest's built-in, dependency-free transporter. It opens a raw TCP socket between client and server using a simple length-prefixed JSON framing protocol. No broker, no extra infrastructure — just point-to-point sockets. Good for learning, local development, and simple internal service-to-service calls where you control both ends and don't need a broker's durability guarantees. It has no built-in load balancing across multiple server instances beyond what your infrastructure (e.g., a Kubernetes Service) provides at the socket level.

**Redis** — Uses Redis pub/sub for `@EventPattern` events and a request/reply pattern (built on pub/sub channels) for `@MessagePattern`. Requires a Redis instance but nothing else — many teams already run Redis for caching, so it's an easy transporter to adopt. Redis pub/sub is at-most-once delivery — a subscriber that isn't connected when a message is published simply misses it, so it's not suited for messages that must never be dropped.

**NATS** — A lightweight, high-throughput messaging system built for exactly this kind of service-to-service messaging. Supports both fire-and-forget publish/subscribe and request-reply natively at the protocol level, plus optional persistence via NATS JetStream. Popular in cloud-native stacks where low latency and simplicity matter more than heavyweight broker features.

**RabbitMQ** — A full-featured message broker implementing AMQP. Gives you durable queues, message acknowledgment (a consumer can NACK and requeue a failed message), routing via exchanges, and dead-letter queues for messages that repeatedly fail processing. The right choice when you need guaranteed delivery and explicit control over retry/failure semantics for background work or cross-service commands.

**Kafka** — A distributed, partitioned, append-only log built for high-throughput event streaming and replay. Consumers read from partitions at their own pace and can rewind to reprocess history — Kafka retains messages for a configured period (or indefinitely) rather than deleting them once consumed. It's the right tool when multiple independent consumers need to react to the same event stream, or when you need an audit-quality event log, rather than a simple task queue.

```
┌───────────┬────────────────┬───────────────┬───────────────────────────┐
│Transporter│ Infra Required │ Delivery      │ Best Fit                  │
├───────────┼────────────────┼───────────────┼───────────────────────────┤
│ TCP       │ none           │ point-to-point│ simple internal RPC       │
│ Redis     │ Redis          │ at-most-once  │ lightweight pub/sub       │
│ NATS      │ NATS server    │ at-most-once* │ low-latency service mesh │
│ RabbitMQ  │ RabbitMQ broker│ at-least-once │ reliable task/command bus │
│ Kafka     │ Kafka cluster  │ at-least-once │ event streaming, replay   │
└───────────┴────────────────┴───────────────┴───────────────────────────┘
  * NATS JetStream adds persistence and at-least-once delivery
```

---

## 4. MessagePattern vs EventPattern

These two decorators are the microservice equivalents of HTTP verbs — they mark a controller method as a handler and, crucially, encode the caller's *intent*.

**`@MessagePattern()`** is request-response. The caller sends a message and expects a reply — conceptually identical to calling a function and getting a return value, just over the network. The handler's return value (or resolved Promise/Observable) is sent back to the caller.

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class UsersController {
  @MessagePattern({ cmd: 'find_user' })
  findUser(@Payload() userId: number) {
    // The return value is sent back to the caller as the reply.
    return { id: userId, name: 'Ada Lovelace' };
  }
}
```

**`@EventPattern()`** is fire-and-forget. The caller emits an event and does not wait for — and Nest does not send — a reply. Use it for things that happened and that other services may care about, not for things you need an answer to.

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class NotificationsController {
  @EventPattern('user_created')
  handleUserCreated(@Payload() data: { userId: number; email: string }) {
    // No return value is sent anywhere — this just reacts to the event.
    console.log(`Sending welcome email to ${data.email}`);
  }
}
```

```
  @MessagePattern (request-response)          @EventPattern (fire-and-forget)
  ┌──────────┐   send()    ┌──────────┐        ┌──────────┐  emit()   ┌──────────┐
  │ Client A │ ──────────▶ │ Service B│        │ Client A │ ────────▶│ Service B│
  │          │ ◀────────── │ (reply)  │        │          │           │ (no reply)│
  └──────────┘   response  └──────────┘        └──────────┘           └──────────┘
```

The `cmd` object pattern (`{ cmd: 'find_user' }`) is just a convention, not a requirement — patterns can be plain strings, numbers, or objects; Nest matches incoming messages against whatever shape you registered.

---

## 5. ClientProxy — Calling Another Service

`ClientProxy` is the client-side counterpart: it's how one Nest application sends messages to another. You register a client with `ClientsModule` (or construct one manually with `ClientProxyFactory`), inject it, and call `.send()` for request-response or `.emit()` for fire-and-forget.

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_SERVICE', // injection token
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3001 },
      },
    ]),
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
```

```typescript
import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get(':id/owner')
  async getOrderOwner(@Param('id') id: string) {
    // .send() returns an Observable — convert to a Promise to await it.
    const user = await firstValueFrom(
      this.usersClient.send({ cmd: 'find_user' }, Number(id)),
    );
    return { orderId: id, owner: user };
  }

  async notifyUserCreated(userId: number, email: string) {
    // .emit() is fire-and-forget — no value to await, nothing comes back.
    this.usersClient.emit('user_created', { userId, email });
  }
}
```

`send()` returns a cold RxJS `Observable` — nothing is sent over the wire until you subscribe to it (directly, or implicitly via `firstValueFrom`/`lastValueFrom`, or in a template). `emit()` returns an Observable too, but it exists purely to trigger the emission on subscription; most code just calls `.subscribe()` on it or lets `firstValueFrom` do so, though for genuinely fire-and-forget events many teams don't bother awaiting it at all.

A client registered with `ClientsModule` establishes its underlying connection once, on module init, and reuses it for every subsequent call — you are not opening a new TCP connection per request.

---

## 6. Hybrid Applications

Most real systems need both an HTTP surface (for browsers, mobile clients, external partners) and a microservice surface (for internal service-to-service traffic). Nest supports this directly: a single application instance can listen on HTTP and one or more microservice transports simultaneously via `connectMicroservice()`.

```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: 3001 },
  });

  await app.startAllMicroservices();
  await app.listen(3000); // HTTP still served on 3000
}
bootstrap();
```

This is exactly the shape a "gateway" service takes: it accepts HTTP from the outside world on port 3000 and, in parallel, accepts internal TCP calls on 3001 from other backend services — all sharing the same DI container, providers, and module tree.

---

## 7. Worked Example — Two Services Over TCP

A minimal but complete two-service setup: an `orders` HTTP gateway that calls a `users` microservice over TCP using request-response.

**users-service — main.ts** (pure microservice, no HTTP):

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UsersModule } from './users.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UsersModule,
    {
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port: 3001 },
    },
  );
  await app.listen();
  console.log('Users microservice listening on TCP:3001');
}
bootstrap();
```

**users-service — users.controller.ts:**

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'find_user' })
  findUser(@Payload() userId: number) {
    return this.usersService.findById(userId);
  }
}
```

```typescript
import { Injectable } from '@nestjs/common';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 2, name: 'Grace Hopper', email: 'grace@example.com' },
  ];

  findById(id: number): User | null {
    return this.users.find((u) => u.id === id) ?? null;
  }
}
```

**orders-service (HTTP gateway) — orders.module.ts:**

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3001 },
      },
    ]),
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
```

**orders-service — orders.controller.ts:**

```typescript
import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get(':id/owner')
  async getOrderOwner(@Param('id') id: string) {
    const user = await firstValueFrom(
      this.usersClient.send<{ id: number; name: string } | null, number>(
        { cmd: 'find_user' },
        Number(id),
      ),
    );

    if (!user) {
      throw new NotFoundException(`No user found for order owner id ${id}`);
    }

    return { orderId: id, owner: user };
  }
}
```

With the users microservice running (`node dist/apps/users-service/main`) and the orders gateway running (`node dist/apps/orders-service/main`), a request to `GET /orders/1/owner` on the gateway's HTTP port triggers a TCP call to the users microservice, which resolves and returns the user, which the gateway serializes back as an HTTP response. Business logic in `UsersService` never knows or cares that it's being invoked over TCP rather than HTTP.

---

## 7.1 Exception Handling Across the Wire

Because a microservice handler runs in a different process than the caller, an unhandled `Error` thrown inside a `@MessagePattern` handler cannot simply propagate as a JavaScript exception to the client — it has to be serialized, sent back over the transport, and re-materialized on the client side. Nest handles this with `RpcException`:

```typescript
import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'find_user' })
  findUser(@Payload() userId: number) {
    const user = this.usersService.findById(userId);
    if (!user) {
      // RpcException produces a clean, structured error payload sent back
      // to the caller -- a raw thrown NotFoundException would instead be
      // wrapped in a generic, less-useful error object by the transporter.
      throw new RpcException(`User ${userId} not found`);
    }
    return user;
  }
}
```

On the client side, the error surfaces through the RxJS `Observable` returned by `.send()`, so it's caught with `catchError` or a try/catch around an `await`:

```typescript
import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get(':id/owner')
  async getOrderOwner(@Param('id') id: string) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'find_user' }, Number(id)).pipe(
        timeout(5000), // fail fast if the users microservice is unresponsive
        catchError((err) => throwError(() => new NotFoundException(err.message))),
      ),
    );
  }
}
```

Wrapping every `ClientProxy` call with a `timeout()` operator is worth calling out on its own: without it, a downstream microservice that hangs (rather than erroring outright) will hang the calling request indefinitely, since there is no default timeout on `.send()`.

---

## 8. Common Pitfalls

- **Forgetting to subscribe to `ClientProxy.send()`.** It returns a cold Observable — if you never subscribe (directly or via `firstValueFrom`), the message is **never sent**. This is a common silent bug: code looks correct but nothing happens over the wire.
- **Using `@MessagePattern` when you meant `@EventPattern` (or vice versa).** If the caller uses `.emit()` but the handler is decorated with `@MessagePattern`, or the caller uses `.send()` against an `@EventPattern` handler, the message is effectively swallowed — Nest routes based on transport-level metadata that differs between the two patterns.
- **Assuming TCP gives you load balancing or failover for free.** The built-in TCP transporter is a direct socket to a specific host:port. If that instance goes down, calls fail; you need your own retry logic, a broker, or infrastructure-level load balancing (e.g., a Kubernetes Service) for resilience.
- **Not handling errors thrown inside a `@MessagePattern` handler.** Exceptions are serialized back to the caller as an `RpcException`-shaped error object, but if the client doesn't wrap `.send()` calls with proper error handling (`catchError` or try/catch around the `await`), an upstream service failure surfaces as an unhandled rejection.
- **Blocking the event loop inside an `@EventPattern` handler.** Since there's no reply to wait for, it's tempting to treat these as "free" background work — but they still run on the same Node process; a slow synchronous handler still stalls everything else.
- **Mismatched pattern shapes between client and server.** `{ cmd: 'find_user' }` and `'find_user'` are different patterns. A typo or shape mismatch between the emitting/sending side and the `@MessagePattern`/`@EventPattern` decorator means the message is never routed to any handler, with no error raised.

---

## 9. Best Practices

- Keep microservices behind a gateway rather than exposing TCP/Redis/Kafka ports directly to the public internet — transporters generally have no built-in authentication or TLS by default (RabbitMQ, Kafka, and NATS support TLS as broker configuration, but you must set it up explicitly).
- Define shared message pattern constants and DTO/payload interfaces in a shared library (or shared npm package) so the client and server sides can't drift out of sync silently.
- Prefer a durable broker (RabbitMQ or Kafka) over TCP or Redis pub/sub for anything where losing a message is unacceptable — background jobs, financial events, order state changes.
- Use `@EventPattern` for state that has already changed and that other services should react to (`user_created`, `order_shipped`); use `@MessagePattern` only when the caller genuinely needs a synchronous answer to proceed.
- Set explicit timeouts on `ClientProxy.send()` calls (e.g., with RxJS `timeout()`) so a slow or dead downstream microservice doesn't hang the caller indefinitely.
- Version your message patterns as your system evolves, the same way you'd version an HTTP API, so you can roll out a new payload shape without breaking services still sending the old one.

---

## 10. Hands-On Exercises

**Exercise 1:** Scaffold two Nest applications in a monorepo (`nest generate app users-service` and `nest generate app orders-service` if using Nest's monorepo mode, or two separate projects). Implement the `users-service` as a pure TCP microservice with a `@MessagePattern({ cmd: 'find_user' })` handler, and `orders-service` as an HTTP app whose `GET /orders/:id/owner` route calls it via `ClientProxy`. Confirm the full round trip works with `curl`.

**Exercise 2:** Add an `@EventPattern('order_created')` handler to a new `notifications-service`. From `orders-service`, call `.emit('order_created', { orderId, userId })` whenever an order is created. Confirm (via console logging in the handler) that the event fires without the caller waiting for any response.

**Exercise 3:** Convert the `users-service` microservice from `Transport.TCP` to `Transport.REDIS` (you'll need a local Redis instance, e.g. via Docker). Update the `orders-service` client options to match. Confirm the same `@MessagePattern`/`ClientProxy.send()` code works unmodified — only the `ClientsModule.register()` and `createMicroservice()` options change.

**Exercise 4:** Deliberately break the pattern match — change the client to `.send({ cmd: 'get_user' }, ...)` while the server handler is still `@MessagePattern({ cmd: 'find_user' })`. Observe what happens (the call hangs or times out with no matching handler found) and add a `timeout()` operator to the RxJS chain so the caller fails fast with a clear error instead of hanging.

**Exercise 5:** Add error handling: make `UsersService.findById()` throw an `RpcException` (from `@nestjs/microservices`) when the user isn't found, instead of returning `null`. Update `OrdersController` to catch the propagated error using RxJS `catchError` and translate it into an appropriate HTTP status code (404) in the gateway response.

---

## 11. Interview Q&A

**Q: What's the difference between `@MessagePattern` and `@EventPattern` in Nest microservices?**
Answer: `@MessagePattern` implements request-response messaging — the caller sends a message via `ClientProxy.send()` and receives the handler's return value back as a reply, conceptually like a remote function call. `@EventPattern` implements fire-and-forget messaging — the caller uses `ClientProxy.emit()`, and Nest does not send any reply back, nor does the handler's return value go anywhere. Use `@MessagePattern` when the caller needs an answer to proceed (e.g., "look up this user"), and `@EventPattern` when you're just notifying other parts of the system that something happened (e.g., "a user was created").

**Q: How does the transporter abstraction let you switch from TCP to Kafka without rewriting your controllers?**
Answer: Nest's `@nestjs/microservices` package separates "what your handlers do" from "how messages physically arrive." Controllers use the same `@MessagePattern`/`@EventPattern` decorators regardless of transport, and clients use the same `ClientProxy.send()`/`.emit()` API. The only thing that changes when switching transporters is the `transport` and `options` fields passed to `createMicroservice()` (server side) and `ClientsModule.register()` (client side) — Nest's transporter strategy classes handle the actual protocol differences (TCP framing vs. Kafka's producer/consumer API) internally.

**Q: Why would you choose RabbitMQ or Kafka over Nest's built-in TCP transporter?**
Answer: The TCP transporter is a direct, unbuffered socket between exactly one client and one server instance with no persistence — if the server is down when a message is sent, it's simply lost, and there's no load balancing across multiple server replicas beyond what your infrastructure provides. RabbitMQ adds durable queues, acknowledgments, and retry/dead-letter semantics, so a message survives a consumer crash and can be redelivered. Kafka goes further, persisting an ordered log that multiple independent consumer groups can read at their own pace and even replay — appropriate when several services need to react to the same stream of events, or when you need message history for auditing.

**Q: What does `ClientProxy.send()` actually return, and why does forgetting to handle that matter?**
Answer: It returns a cold RxJS `Observable` — the underlying message is not sent over the wire until something subscribes to that Observable. This is commonly wrapped in `firstValueFrom()` to `await` it as a Promise, or subscribed to directly. If code calls `.send()` and never subscribes (e.g., accidentally discards the return value), the request silently never goes out — no error is thrown, the call just does nothing, which is a common and hard-to-spot bug in Nest microservice code.

**Q: In a hybrid Nest application, how do you serve HTTP and a microservice transport from the same app?**
Answer: You create the app normally with `NestFactory.create(AppModule)` for HTTP, then call `app.connectMicroservice()` one or more times with each transporter's configuration, then call `await app.startAllMicroservices()` before (or alongside) `await app.listen(port)`. All the microservice and HTTP-facing controllers share the same DI container and providers — it's one running Nest application exposing multiple transports simultaneously, which is the typical shape of a "gateway" service that terminates public HTTP traffic and fans out to internal microservices.

**Q: What happens if an exception is thrown inside a `@MessagePattern` handler?**
Answer: Nest serializes the exception into an error object and sends it back to the caller as part of the reply, rather than crashing the microservice. On the client side, subscribing to the `ClientProxy.send()` Observable will emit that error, which you handle with RxJS operators like `catchError` or a wrapping try/catch around an `await firstValueFrom(...)` call. Nest also provides `RpcException` specifically for this purpose — throwing it from a handler produces a clean, structured error payload rather than leaking a raw stack trace across the service boundary.
