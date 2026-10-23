# Project 6 — Microservices: Orders + Inventory (Capstone)

**Level:** Advanced (Capstone)
**Time estimate:** 5 – 6 hours
**Phase prerequisite:** Phase 11-12 – Microservices Basics & Production/Deployment

---

## Overview

You will split a single domain into two independently deployable NestJS applications:

- **`inventory-service`** — owns product stock levels, exposed only as a **TCP microservice** (no public HTTP API for its core operations).
- **`orders-service`** — a normal HTTP API that, when placing an order, calls `inventory-service` over Nest's TCP transporter using `ClientProxy.send()` (request/response) to reserve stock.

Both services expose `GET /health` via `@nestjs/terminus`, ship with their own multi-stage production `Dockerfile`, and are wired together with a `docker-compose.yml`. This capstone ties together controllers (Phase 3), DI (Phase 4), modules (Phase 5), validation (Phase 6), the microservices transporter and health-check patterns (Phase 11-12) into one deployable system.

---

## Prerequisites

- Completed Projects 1-5
- Docker and Docker Compose installed
- Node.js 18+, Nest CLI

---

## Project Structure

```
06-microservices-orders-inventory/
├── docker-compose.yml
├── inventory-service/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── health/
│       │   └── health.controller.ts
│       └── inventory/
│           ├── inventory.module.ts
│           ├── inventory.controller.ts   → @MessagePattern handlers (TCP)
│           └── inventory.service.ts
└── orders-service/
    ├── package.json
    ├── Dockerfile
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── health/
        │   └── health.controller.ts
        └── orders/
            ├── orders.module.ts
            ├── orders.controller.ts       → public HTTP API
            ├── orders.service.ts          → calls inventory-service via ClientProxy
            └── dto/
                └── create-order.dto.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold both services

```bash
mkdir 06-microservices-orders-inventory && cd 06-microservices-orders-inventory
nest new inventory-service --package-manager npm
nest new orders-service --package-manager npm

cd inventory-service
npm install @nestjs/microservices @nestjs/terminus
cd ../orders-service
npm install @nestjs/microservices @nestjs/terminus class-validator class-transformer
cd ..
```

### Step 2 — Inventory service: message-pattern "controller"

`inventory-service/src/inventory/inventory.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

interface StockItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  // In-memory stock for this demo — swap for TypeORM (Project 2 pattern) in a real system.
  private stock = new Map<string, number>([
    ['prod-1', 50],
    ['prod-2', 10],
  ]);

  checkAndReserve(items: StockItem[]): { reserved: boolean } {
    for (const item of items) {
      const available = this.stock.get(item.productId) ?? 0;
      if (available < item.quantity) {
        // RpcException propagates a structured error back to the caller over TCP,
        // instead of an HTTP-flavored exception that means nothing outside a request context.
        throw new RpcException(
          `Insufficient stock for ${item.productId}: requested ${item.quantity}, available ${available}`,
        );
      }
    }

    for (const item of items) {
      const available = this.stock.get(item.productId) ?? 0;
      this.stock.set(item.productId, available - item.quantity);
    }

    return { reserved: true };
  }

  getStock(productId: string): { productId: string; quantity: number } {
    return { productId, quantity: this.stock.get(productId) ?? 0 };
  }
}
```

`inventory-service/src/inventory/inventory.controller.ts`

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';

interface ReserveStockPayload {
  items: { productId: string; quantity: number }[];
}

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Message pattern instead of an HTTP route — invoked via ClientProxy.send('reserve_stock', payload)
  @MessagePattern('reserve_stock')
  reserveStock(@Payload() payload: ReserveStockPayload) {
    return this.inventoryService.checkAndReserve(payload.items);
  }

  @MessagePattern('get_stock')
  getStock(@Payload() productId: string) {
    return this.inventoryService.getStock(productId);
  }
}
```

`inventory-service/src/inventory/inventory.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
```

### Step 3 — Inventory service bootstrap as a hybrid app (TCP microservice + tiny HTTP health server)

`inventory-service/src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
```

`inventory-service/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { InventoryModule } from './inventory/inventory.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [InventoryModule, TerminusModule],
  controllers: [HealthController],
})
export class AppModule {}
```

`inventory-service/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Hybrid application: a normal Nest HTTP app (serves /health) that ALSO
  // connects a TCP microservice listener for @MessagePattern handlers.
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 4001,
    },
  });

  await app.startAllMicroservices();
  await app.listen(4000); // HTTP port, used only for /health
}
bootstrap();
```

### Step 4 — Orders service: HTTP API calling inventory-service via ClientProxy

`orders-service/src/orders/dto/create-order.dto.ts`

```typescript
import { Type } from 'class-transformer';
import { ArrayMinSize, IsEmail, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsEmail()
  customerEmail: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[];
}
```

`orders-service/src/orders/orders.service.ts`

```typescript
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';
import { randomUUID } from 'crypto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(@Inject('INVENTORY_SERVICE') private readonly inventoryClient: ClientProxy) {}

  async placeOrder(dto: CreateOrderDto) {
    // send() is request/response: it returns an Observable that resolves with
    // the microservice's reply. A 5s timeout guards against inventory-service
    // being down or slow — orders-service should degrade, not hang forever.
    const reservation = await firstValueFrom(
      this.inventoryClient.send('reserve_stock', { items: dto.items }).pipe(
        timeout(5000),
        catchError((err) =>
          throwError(() => new BadGatewayException(`Inventory service unavailable: ${err.message}`)),
        ),
      ),
    );

    return {
      orderId: randomUUID(),
      customerEmail: dto.customerEmail,
      items: dto.items,
      reservation,
      status: 'PLACED',
    };
  }
}
```

`orders-service/src/orders/orders.controller.ts`

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.placeOrder(dto);
  }
}
```

`orders-service/src/orders/orders.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'INVENTORY_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.INVENTORY_HOST || 'localhost',
          port: Number(process.env.INVENTORY_PORT) || 4001,
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

`orders-service/src/health/health.controller.ts` — identical pattern to inventory-service's, omitted for brevity (copy Step 3's version).

`orders-service/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [OrdersModule, TerminusModule],
  controllers: [HealthController],
})
export class AppModule {}
```

`orders-service/src/main.ts`

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

### Step 5 — Production Dockerfiles (multi-stage, per service)

`inventory-service/Dockerfile`

```dockerfile
# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 4000 4001
USER node
CMD ["node", "dist/main.js"]
```

`orders-service/Dockerfile`

```dockerfile
# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

### Step 6 — docker-compose wiring both services together

`docker-compose.yml`

```yaml
services:
  inventory-service:
    build: ./inventory-service
    ports:
      - "4000:4000"   # health check HTTP port
      - "4001:4001"   # TCP microservice port
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  orders-service:
    build: ./orders-service
    ports:
      - "3000:3000"
    environment:
      INVENTORY_HOST: inventory-service
      INVENTORY_PORT: 4001
    depends_on:
      inventory-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 3
```

### Step 7 — Run it

```bash
docker compose up --build
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Both services healthy | `docker compose ps` | Both containers show `healthy` |
| Inventory health endpoint | `curl http://localhost:4000/health` | `200 OK`, `{"status":"ok", ...}` |
| Orders health endpoint | `curl http://localhost:3000/health` | `200 OK`, `{"status":"ok", ...}` |
| Place a valid order | `curl -i -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d '{"customerEmail":"a@b.com","items":[{"productId":"prod-1","quantity":2}]}'` | `201`/`200`, `status: "PLACED"`, `reservation.reserved: true` |
| Insufficient stock rejected | Request `quantity: 999` for `prod-2` | `502 Bad Gateway` (or your chosen mapping) wrapping the `RpcException` message about insufficient stock |
| Inventory service down | `docker compose stop inventory-service`, then place an order | `orders-service` responds `502 Bad Gateway` within ~5s (the `timeout(5000)` guard), not a hang |
| Service isolation | `docker compose logs orders-service` vs `docker compose logs inventory-service` | Each service logs independently; no shared process |

---

## Stretch Goals

1. **Redis transporter instead of TCP** — swap `Transport.TCP` for `Transport.REDIS` on both the client and the microservice listener, and compare the configuration and failure-mode differences.
2. **Circuit breaker** — wrap the `ClientProxy.send()` call in a simple circuit-breaker (e.g. via `opossum` or a hand-rolled failure counter) so repeated inventory-service failures short-circuit immediately instead of waiting out the timeout each time.
3. **Readiness vs liveness** — split `/health` into `/health/live` (process is up) and `/health/ready` (can reach its dependencies, e.g. inventory-service's TCP port from orders-service using a custom Terminus indicator).
4. **Event-based stock release on cancellation** — add a `cancel_reservation` message pattern so `orders-service` can roll back a reservation if a later step (e.g. payment) fails.
5. **Shared DTO package** — extract `CreateOrderDto`'s item shape into a small shared npm workspace package so both services compile against the same contract instead of duplicating interfaces.
