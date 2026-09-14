# Project 5 — Real-time Notification System (WebSockets & Queues)

**Level:** Advanced
**Time estimate:** 4 – 5 hours
**Phase prerequisite:** Phase 11 – Microservices and Realtime

---

## Overview

You will build a notification system with two complementary asynchronous patterns:

1. **WebSocket Gateway** — `NotificationsGateway` (`@WebSocketGateway`, Socket.IO under the hood) pushes live in-app notifications to connected clients the instant they're created — no polling.
2. **Background job queue** — a BullMQ queue (`@nestjs/bullmq`, backed by Redis) processes "send email" jobs out of the HTTP request/response cycle, so triggering ten notifications doesn't block the caller for ten email-sends.

The `POST /notifications` endpoint does two things: it emits the notification over the gateway immediately (real-time UI update) *and* enqueues an email job (reliable, retryable, delivered whenever the worker gets to it) — a common production pattern of pairing "fast best-effort" delivery with "slow but durable" delivery.

---

## Prerequisites

- Completed Project 3 (guards, custom decorators) — reused for gateway auth
- Node.js 18+, Nest CLI
- Redis running locally (`docker run -p 6379:6379 redis:7-alpine`)

---

## Project Structure

```
05-notification-system/
├── package.json
├── docker-compose.yml          → spins up local Redis for development
└── src/
    ├── main.ts
    ├── app.module.ts
    └── notifications/
        ├── notifications.module.ts
        ├── notifications.controller.ts
        ├── notifications.service.ts
        ├── notifications.gateway.ts
        ├── email.processor.ts
        ├── dto/
        │   └── create-notification.dto.ts
        └── entities/
            └── notification.entity.ts
```

---

## Step-by-Step Instructions

### Step 1 — Install dependencies

```bash
nest new 05-notification-system --package-manager npm
cd 05-notification-system
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @nestjs/bullmq bullmq ioredis
npm install class-validator class-transformer
```

### Step 2 — Local Redis via Docker Compose (development dependency only)

`docker-compose.yml`

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```bash
docker compose up -d
```

### Step 3 — Notification entity (kept in-memory for this project — persistence was covered in Projects 2-4)

`src/notifications/entities/notification.entity.ts`

```typescript
export class Notification {
  id: string;
  userId: string;
  message: string;
  createdAt: Date;
}
```

### Step 4 — DTO

`src/notifications/dto/create-notification.dto.ts`

```typescript
import { IsEmail, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsEmail()
  recipientEmail: string;
}
```

### Step 5 — BullMQ queue registration and email processor

`src/notifications/notifications.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { EmailProcessor } from './email.processor';

export const EMAIL_QUEUE = 'email';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s between retries
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, EmailProcessor],
})
export class NotificationsModule {}
```

`src/notifications/email.processor.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE } from './notifications.module';

export interface EmailJobData {
  recipientEmail: string;
  message: string;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Sending email to ${job.data.recipientEmail} (attempt ${job.attemptsMade + 1})`);
    await this.simulateSlowEmailProvider();
    this.logger.log(`Email sent to ${job.data.recipientEmail}: "${job.data.message}"`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.warn(`Job ${job.id} failed on attempt ${job.attemptsMade}: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  private simulateSlowEmailProvider(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
```

### Step 6 — WebSocket gateway

`src/notifications/notifications.gateway.ts`

```typescript
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({
  cors: { origin: '*' }, // restrict this to known origins in production
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Maps userId -> set of connected socket ids, so a notification for user X
  // only broadcasts to that user's own sockets (not every connected client).
  private readonly userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    for (const sockets of this.userSockets.values()) {
      sockets.delete(client.id);
    }
  }

  // Client emits 'register' with their userId right after connecting.
  @SubscribeMessage('register')
  handleRegister(@ConnectedSocket() client: Socket, userId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
    client.join(`user:${userId}`); // Socket.IO room, one per user
  }

  broadcastNotification(notification: Notification) {
    this.server.to(`user:${notification.userId}`).emit('notification', notification);
  }
}
```

### Step 7 — Service tying WebSocket push + queue enqueue together

`src/notifications/notifications.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { EMAIL_QUEUE } from './notifications.module';
import { EmailJobData } from './email.processor';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: NotificationsGateway,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      userId: dto.userId,
      message: dto.message,
      createdAt: new Date(),
    };

    // Fast path: push over the WebSocket immediately for a live UI update.
    this.gateway.broadcastNotification(notification);

    // Durable path: enqueue the email job — retried up to 3 times with backoff
    // if the email provider is briefly unavailable. This call returns instantly;
    // the actual send happens in EmailProcessor on a worker.
    await this.emailQueue.add('send-email', {
      recipientEmail: dto.recipientEmail,
      message: dto.message,
    });

    return notification;
  }
}
```

`src/notifications/notifications.controller.ts`

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }
}
```

### Step 8 — Root module and bootstrap

`src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    NotificationsModule,
  ],
})
export class AppModule {}
```

`src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000);
}
bootstrap();
```

### Step 9 — A minimal browser client to observe the gateway (for manual testing)

`test-client.html` (open directly in a browser — not part of the Nest app)

```html
<!doctype html>
<html>
  <body>
    <pre id="log"></pre>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script>
      const socket = io('http://localhost:3000');
      const userId = 'demo-user-1';
      socket.on('connect', () => socket.emit('register', userId));
      socket.on('notification', (n) => {
        document.getElementById('log').textContent += JSON.stringify(n) + '\n';
      });
    </script>
  </body>
</html>
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Redis is up | `docker compose ps` | `redis` service `Up` |
| WebSocket connects | Open `test-client.html` in a browser with dev tools console open | `connect` event fires, no errors |
| Live push works | `curl -X POST http://localhost:3000/notifications -H "Content-Type: application/json" -d '{"userId":"demo-user-1","message":"Hi!","recipientEmail":"a@b.com"}'` | Browser log shows the notification appear instantly |
| Response returns before email completes | Time the `curl` call above | Response returns in well under 1.5s (the simulated email delay), proving the queue add is non-blocking |
| Email job processes | Watch server logs a moment after the request | `EmailProcessor` logs "Sending email..." then "Email sent..." roughly 1.5s later |
| Retry/backoff on failure | Temporarily throw inside `EmailProcessor.process()` | Logs show `failed` events on attempts 1 and 2, then a successful attempt 3 (or all 3 exhausted) with exponential delay between them |
| Room isolation | Connect two browser tabs registered as different `userId`s, send a notification to only one | Only the matching tab's log updates |

---

## Stretch Goals

1. **Bull Board dashboard** — mount `@bull-board/api` + `@bull-board/express` to visually inspect the queue, retries, and failed jobs at `/admin/queues`.
2. **Persisted notifications** — swap the in-memory `Notification` for a TypeORM entity so a user's notification history survives a server restart and can be fetched via `GET /notifications?userId=`.
3. **JWT-authenticated gateway** — use a `WsException`-throwing guard on the gateway's `handleConnection` to reject sockets that don't present a valid JWT in the handshake `auth` payload (reusing the `JwtStrategy` from Project 3).
4. **Dead-letter handling** — after all retries are exhausted, move the job's data into a separate `failed-emails` queue for manual review instead of silently dropping it.
5. **Rate-limited broadcast** — add a per-user throttle so a single user cannot receive more than 10 real-time notifications per minute (drop/queue the excess).
