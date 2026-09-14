# Transactions and Migrations — Complete Guide

## Table of Contents
1. [Why Transactions Matter](#1-why-transactions-matter)
2. [TypeORM Transactions — QueryRunner](#2-typeorm-transactions--queryrunner)
3. [TypeORM Transactions — DataSource.transaction()](#3-typeorm-transactions--datasourcetransaction)
4. [Why the @Transaction Decorator Is Discouraged](#4-why-the-transaction-decorator-is-discouraged)
5. [Prisma Transactions — $transaction](#5-prisma-transactions--transaction)
6. [Worked Example — Multi-Step Operation with Rollback](#6-worked-example--multi-step-operation-with-rollback)
7. [Migrations — TypeORM Workflow](#7-migrations--typeorm-workflow)
8. [Migrations — Prisma Workflow](#8-migrations--prisma-workflow)
9. [Migration Workflow Comparison](#9-migration-workflow-comparison)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Transactions Matter

A transaction groups multiple database operations into a single atomic unit: either every operation succeeds and is committed, or any failure rolls back every change made so far, leaving the database exactly as it was before the transaction started. Any operation that touches more than one table (or performs more than one write) as part of a single logical action — placing an order that both creates an `Order` row and decrements `Inventory` stock, for example — needs a transaction, or a failure partway through leaves the database in an inconsistent state.

```
  Without a transaction:
  ┌─────────────────────────────────────────────────────────┐
  │  1. INSERT INTO orders (...)          ✅ committed       │
  │  2. UPDATE inventory SET stock = ...  ❌ throws error     │
  │                                                            │
  │  Result: an Order row exists with NO corresponding        │
  │  inventory deduction — an inconsistent database state.    │
  └─────────────────────────────────────────────────────────┘

  With a transaction:
  ┌─────────────────────────────────────────────────────────┐
  │  BEGIN                                                    │
  │  1. INSERT INTO orders (...)                              │
  │  2. UPDATE inventory SET stock = ...  ❌ throws error     │
  │  ROLLBACK  ← step 1 is undone too                          │
  │                                                            │
  │  Result: neither the order nor the inventory change        │
  │  persists — the database is left exactly as it was.        │
  └─────────────────────────────────────────────────────────┘
```

Both TypeORM and Prisma expose transaction APIs; the details differ, but the guarantee (ACID atomicity) is the same.

---

## 2. TypeORM Transactions — QueryRunner

The lowest-level, most explicit transaction mechanism in TypeORM is a `QueryRunner`, obtained from the `DataSource`. It gives you full manual control over `startTransaction()`, `commitTransaction()`, and `rollbackTransaction()`:

```typescript
// orders/orders.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async placeOrder(productId: number, quantity: number, total: number): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: { productId },
        lock: { mode: 'pessimistic_write' }, // row-level lock for the duration of the transaction
      });

      if (!inventory || inventory.stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      inventory.stock -= quantity;
      await queryRunner.manager.save(inventory);

      const order = queryRunner.manager.create(Order, { productId, quantity, total });
      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error; // re-throw so the caller/global exception filter still sees the error
    } finally {
      await queryRunner.release(); // always release the runner back to the pool
    }
  }
}
```

Every database operation inside the transaction must go through `queryRunner.manager` (an `EntityManager` bound to that specific transactional connection), not through the module's regular injected `Repository<T>` — using the regular repository would run its queries on a *different* connection outside the transaction entirely, silently defeating the atomicity you're trying to achieve. The `try`/`catch`/`finally` structure is mandatory boilerplate: `commitTransaction()` on success, `rollbackTransaction()` on any thrown error, and `release()` in a `finally` block so the connection always returns to the pool regardless of outcome.

---

## 3. TypeORM Transactions — DataSource.transaction()

For most use cases, `DataSource.transaction()` is preferable to a hand-managed `QueryRunner` — it wraps the same commit/rollback/release boilerplate in a callback-based API, so you can't forget one of the steps:

```typescript
// orders/orders.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async placeOrder(productId: number, quantity: number, total: number): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const inventory = await manager.findOne(Inventory, { where: { productId } });

      if (!inventory || inventory.stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      inventory.stock -= quantity;
      await manager.save(inventory);

      const order = manager.create(Order, { productId, quantity, total });
      return manager.save(order);
      // If we reach here without throwing, transaction() commits automatically.
      // If anything above throws, transaction() rolls back and re-throws
      // the original error automatically — no manual try/catch needed.
    });
  }
}
```

`transaction()` commits automatically if the callback resolves, and rolls back automatically (re-throwing the original error) if the callback throws or its returned promise rejects — connection acquisition and release are handled internally. This is the recommended default for new code: it's shorter, and it's structurally impossible to forget a `commit`/`rollback`/`release` call.

---

## 4. Why the @Transaction Decorator Is Discouraged

Older TypeORM versions shipped a `@Transaction()` method decorator plus a `@TransactionManager()` parameter decorator, intended to wrap an entire service method in a transaction declaratively:

```typescript
// DISCOURAGED — shown for recognition only, do not write new code like this
import { Transaction, TransactionManager, EntityManager } from 'typeorm'; // deprecated exports

class LegacyOrdersService {
  @Transaction()
  async placeOrder(@TransactionManager() manager: EntityManager, productId: number) {
    // ...
  }
}
```

This decorator pair is now deprecated and removed from current TypeORM releases, for reasons worth understanding even if you only ever encounter it in legacy code: it obscured the transaction boundary (a reader has to know the decorator's semantics to realize the whole method is transactional), it played awkwardly with Nest's own DI-based method interception (interceptors, guards), and it made it easy to accidentally call a *non*-transactional repository method from inside the "transactional" method by forgetting to use the injected `manager` parameter — silently running that call outside the transaction. `DataSource.transaction()` (or manual `QueryRunner` when you need session-level control, like pessimistic locking held across several sequential awaits) replaced it as the recommended pattern, because the transaction boundary is now an explicit callback scope rather than an easy-to-miss decorator.

---

## 5. Prisma Transactions — $transaction

Prisma exposes `$transaction` in two forms. The array form runs a fixed, known-upfront list of independent operations atomically:

```typescript
// simple array form — good when the operations don't depend on each other's results
await this.prisma.$transaction([
  this.prisma.inventory.update({ where: { productId }, data: { stock: { decrement: quantity } } }),
  this.prisma.order.create({ data: { productId, quantity, total } }),
]);
```

The interactive callback form is needed whenever a later step depends on the result of an earlier one (exactly the inventory-check-then-decrement scenario from section 2) — it receives a transactional Prisma client scoped to that transaction:

```typescript
// orders/orders.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async placeOrder(productId: number, quantity: number, total: number) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { productId } });

      if (!inventory || inventory.stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      await tx.inventory.update({
        where: { productId },
        data: { stock: inventory.stock - quantity },
      });

      return tx.order.create({ data: { productId, quantity, total } });
      // Throwing anywhere inside this callback (including the
      // BadRequestException above) rolls back every write made via `tx`
      // so far, automatically — same guarantee as TypeORM's DataSource.transaction().
    });
  }
}
```

As with TypeORM, every query inside the callback must go through the transactional client (`tx`), not the outer `this.prisma` — calling `this.prisma.inventory.update(...)` directly inside the callback would run on a separate connection, outside the transaction.

---

## 6. Worked Example — Multi-Step Operation with Rollback

A complete "transfer funds between two accounts" example demonstrates rollback most clearly, since it inherently has two dependent writes that must both succeed or both fail together:

```typescript
// accounts/accounts.service.ts (TypeORM version)
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(private readonly dataSource: DataSource) {}

  async transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const from = await manager.findOne(Account, {
        where: { id: fromAccountId },
        lock: { mode: 'pessimistic_write' },
      });
      const to = await manager.findOne(Account, {
        where: { id: toAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!from || !to) {
        throw new NotFoundException('One or both accounts do not exist');
      }
      if (from.balance < amount) {
        // Throwing here rolls back the entire transaction — nothing has
        // been persisted yet, so no manual cleanup is needed.
        throw new BadRequestException('Insufficient balance');
      }

      from.balance -= amount;
      to.balance += amount;

      await manager.save(from);
      await manager.save(to);
      // Both saves commit together when the callback resolves; if the
      // second save() ever fails (e.g. a constraint violation), the
      // first save()'s debit is rolled back too — the balance can never
      // "disappear" partway through.
    });
  }
}
```

```typescript
// accounts/accounts.service.ts (Prisma equivalent)
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const from = await tx.account.findUnique({ where: { id: fromAccountId } });
      const to = await tx.account.findUnique({ where: { id: toAccountId } });

      if (!from || !to) {
        throw new NotFoundException('One or both accounts do not exist');
      }
      if (from.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: from.balance - amount },
      });
      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: to.balance + amount },
      });
    });
  }
}
```

In both versions, a thrown `NotFoundException`/`BadRequestException` anywhere inside the callback propagates out of `transaction()`/`$transaction()`, triggers an automatic rollback of anything already written in that callback, and is then re-thrown to the caller — where Nest's global exception filter converts it into the correct HTTP response, exactly as if no transaction were involved.

---

## 7. Migrations — TypeORM Workflow

Migrations are versioned, incremental, reviewable SQL scripts that evolve the database schema over time — the production-safe alternative to `synchronize: true`. TypeORM's CLI generates migrations by diffing your current entities against the live database schema:

```bash
# 1. Make sure your DataSource config is exported for the CLI to use
#    (typically a dedicated data-source.ts, separate from the NestJS app config)

# 2. Generate a migration by diffing entities vs. the current database schema
npx typeorm migration:generate src/migrations/AddUserActiveFlag -d src/data-source.ts

# 3. Inspect the generated file — it contains explicit up()/down() SQL
# 4. Run pending migrations against the database
npx typeorm migration:run -d src/data-source.ts

# 5. Roll back the most recently applied migration if needed
npx typeorm migration:revert -d src/data-source.ts
```

A generated migration file looks like this:

```typescript
// src/migrations/1700000000000-AddUserActiveFlag.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserActiveFlag1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
  }
}
```

`up()` applies the change; `down()` must precisely reverse it, which is what makes `migration:revert` possible. TypeORM tracks which migrations have already run in a `migrations` table it creates in your database, so `migration:run` only applies migrations that haven't been recorded yet — safe to run repeatedly across deploys.

---

## 8. Migrations — Prisma Workflow

Prisma Migrate diffs `schema.prisma` against migration history rather than against entity classes, and has two distinct commands for two distinct environments:

```bash
# Local development — creates AND applies a new migration, and regenerates the client
npx prisma migrate dev --name add_user_active_flag

# Production/CI deploy — applies any pending, already-committed migrations only
# (never generates new ones, never prompts, safe for automated pipelines)
npx prisma migrate deploy
```

`migrate dev` is interactive-friendly: it detects schema drift, generates a new SQL migration file under `prisma/migrations/<timestamp>_add_user_active_flag/migration.sql`, applies it to your local dev database, and re-runs `prisma generate` automatically. `migrate deploy` is the production-safe counterpart — it never generates new migrations or prompts for confirmation, it only applies whatever migration files already exist and are pending, which is exactly the non-interactive behavior a CI/CD pipeline needs.

A generated migration file is plain SQL, directly reviewable in a pull request:

```sql
-- prisma/migrations/20260713120000_add_user_active_flag/migration.sql
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
```

---

## 9. Migration Workflow Comparison

| Step | TypeORM | Prisma |
|---|---|---|
| Generate a migration | `typeorm migration:generate` (diffs entities vs. DB) | `prisma migrate dev` (diffs schema.prisma vs. migration history) |
| Apply pending migrations | `typeorm migration:run` | `prisma migrate deploy` (production) or `migrate dev` (local) |
| Roll back last migration | `typeorm migration:revert` | No direct revert command — write a new forward migration, or restore from a backup |
| Tracking table | `migrations` (auto-created) | `_prisma_migrations` (auto-created) |
| Migration file format | TypeScript class with `up()`/`down()` | Plain `.sql` file |
| Safe for CI/CD | Yes, via `migration:run` | Yes, via `migrate deploy` specifically (never `migrate dev` in CI) |

---

## 10. Common Pitfalls

**Running queries against the injected `Repository`/`PrismaService` instead of the transactional handle inside a transaction callback.** Both TypeORM (`manager` from the callback) and Prisma (`tx` from the callback) give you a scoped handle bound to that specific transaction. Calling the module-level `this.repository` or `this.prisma` directly inside the callback bypasses the transaction entirely — those calls run on a separate connection and commit immediately, defeating the whole point of wrapping the operation.

**Forgetting `queryRunner.release()` in a `finally` block.** With manual `QueryRunner` usage, skipping `release()` (or only calling it in the success path, not on error) leaks a connection from the pool on every failure. Given enough failed requests, the pool exhausts and the application stops being able to acquire new connections at all.

**Using `migrate dev` in a production or CI deploy pipeline.** `prisma migrate dev` can prompt interactively, and worse, it can reset the database in some drift-resolution scenarios — it is designed for local iteration only. Automated pipelines must use `prisma migrate deploy`, which only applies existing, already-reviewed migration files non-interactively.

**Editing an already-applied migration file instead of writing a new one.** Once a migration has run in any shared environment (staging, production, or a teammate's machine), editing it in place desyncs environments that already recorded it as "applied" in the tracking table from ones that haven't run it yet — the two databases end up with different actual schemas despite agreeing on which migration IDs have run. Always add a new migration for further changes.

**Assuming a transaction protects against concurrent modification without explicit locking.** Wrapping reads-then-writes in a transaction guarantees atomicity and isolation from other transactions per the database's isolation level, but at default isolation levels (e.g. Postgres's `READ COMMITTED`) two concurrent transactions can still both read the same "before" balance and both compute an update based on stale data (a race condition), unless you use row-level locking (`lock: { mode: 'pessimistic_write' }` in TypeORM) or a stricter isolation level.

---

## 11. Best Practices

- Default to `DataSource.transaction()` (TypeORM) or the callback form of `$transaction` (Prisma) for new code; reach for manual `QueryRunner` only when you need session-level control that the callback API doesn't expose, such as holding a lock across several sequential operations with conditional logic between them.
- Never call the module's regular injected `Repository`/`PrismaService` inside a transaction callback — always use the `manager`/`tx` handle the transaction API gives you.
- Keep transaction callbacks short and focused on the writes that actually need atomicity; avoid unrelated I/O (HTTP calls, file writes) inside a transaction, since those don't roll back and can hold database locks/connections open far longer than necessary.
- Generate migrations from a diff against the actual target environment's schema, review the generated SQL by hand before committing it, and never hand-edit a migration file after it has been applied anywhere outside your own machine.
- Use `prisma migrate deploy` (never `migrate dev`) in CI/CD pipelines, and the TypeORM equivalent (`migration:run`, never `migration:generate`) in the same context — migration *generation* is a local development-time activity; migration *application* is a deploy-time activity.
- Add explicit row-level locking (`pessimistic_write` in TypeORM, or `SELECT ... FOR UPDATE` via `$queryRaw` in Prisma) for read-then-write sequences on rows that can be modified concurrently, such as balances or inventory counts — atomicity alone does not prevent lost updates from concurrent transactions.
- Commit every migration file to version control alongside the schema/entity change that produced it, so the two can never drift apart in history.

---

## 12. Hands-On Exercises

**Exercise 1:** Implement the `transfer()` method from section 6 using TypeORM's `DataSource.transaction()`. Deliberately throw an error after the first `manager.save(from)` call and confirm — by querying the database directly afterward — that the first account's balance was *not* actually changed, proving the rollback occurred.

**Exercise 2:** Reimplement the same `transfer()` method using a manual `QueryRunner` (section 2's style) instead of `DataSource.transaction()`. Deliberately omit the `finally { await queryRunner.release(); }` block, then write a quick script that calls `transfer()` in a loop with a forced failure and observe the connection pool exhausting (check your database driver's active-connection count).

**Exercise 3:** Reimplement `transfer()` using Prisma's `$transaction` callback form. Confirm that calling `this.prisma.account.update(...)` directly (instead of `tx.account.update(...)`) inside the callback does **not** roll back on a later thrown error — observe the inconsistent state this produces, then fix it by switching to `tx`.

**Exercise 4:** Add an `isActive` boolean column to a `User` entity/model in both a TypeORM project and a Prisma project. Generate a migration for each (`typeorm migration:generate` and `prisma migrate dev`), inspect both generated files, run them, then revert the TypeORM one with `migration:revert` and note that Prisma has no direct equivalent — write and apply a new forward migration to remove the column instead.

**Exercise 5:** Simulate a production deploy pipeline locally: create a migration with `prisma migrate dev` on your local database, then run `prisma migrate deploy` against a second, empty database to confirm it applies cleanly without prompting. Repeat the same exercise with TypeORM's `migration:run` against a fresh database using the migration from Exercise 4.

---

## 13. Interview Q&A

**Q: What guarantee does wrapping multiple database writes in a transaction give you, and why does that matter for a multi-step operation like an order-placement flow?**
Answer: A transaction gives you atomicity — either every write inside it is committed together, or (on any error) every write is rolled back together, leaving the database exactly as it was before the transaction started. For an order-placement flow that both creates an `Order` row and decrements `Inventory` stock, this prevents the inconsistent state where one write succeeds and the other fails partway through — for example, an order existing with no matching inventory deduction, or stock decremented with no corresponding order recorded.

**Q: Why must you use the `manager` (TypeORM) or `tx` (Prisma) parameter provided inside a transaction callback, rather than the regular injected repository or client?**
Answer: The transactional handle passed into the callback is bound to the specific database connection and transaction context that was opened for that call — every operation issued through it participates in the same transaction and is subject to its commit/rollback. The regular injected `Repository`/`PrismaService` operates on a separate connection from the pool and commits its own operations immediately, independent of any transaction running elsewhere. Calling it inside a transaction callback silently breaks atomicity: that particular write will not roll back even if the rest of the transaction later fails.

**Q: Why was TypeORM's `@Transaction()`/`@TransactionManager()` decorator pair deprecated in favor of `DataSource.transaction()`?**
Answer: The decorator pair made the transaction boundary implicit — a reader had to already know the decorator's semantics to realize an entire method ran inside a transaction — and it was easy to accidentally bypass the transaction by calling a repository method other than the injected `@TransactionManager()` parameter from inside the "transactional" method. It also interacted awkwardly with Nest's own method-level constructs (guards, interceptors). `DataSource.transaction(callback)` makes the transaction boundary an explicit lexical scope — everything inside the callback is transactional by construction, and the API is structurally hard to misuse since there's only one manager reference available inside it.

**Q: What is the practical difference between `prisma migrate dev` and `prisma migrate deploy`, and why does using the wrong one in production matter?**
Answer: `prisma migrate dev` is a local development command — it detects schema drift, generates new migration files interactively, applies them to your dev database, and regenerates the Prisma client, potentially prompting for confirmation or even resetting the database in certain drift scenarios. `prisma migrate deploy` is designed for CI/CD and production: it only applies migrations that already exist as committed files, never generates new ones, and never prompts, making it safe for unattended automated pipelines. Running `migrate dev` in a production deploy risks unexpected schema resets or interactive prompts blocking an automated pipeline — the equivalent mistake in TypeORM would be running `migration:generate` (a local, dev-time command) instead of `migration:run` during a deploy.

**Q: Does an ACID transaction alone prevent a race condition where two concurrent requests both read a stale balance and both compute an update from it?**
Answer: Not necessarily — a transaction guarantees atomicity and enforces the database's configured isolation level, but at commonly-used default isolation levels (like PostgreSQL's `READ COMMITTED`), two concurrent transactions can each read the same "before" value, compute their own update independently, and the second commit can overwrite the first's change (a lost update), even though each transaction was individually atomic. Preventing this requires either row-level locking (TypeORM's `lock: { mode: 'pessimistic_write' }`, or `SELECT ... FOR UPDATE` in raw SQL/Prisma's `$queryRaw`) held for the duration of the read-then-write, or a stricter isolation level such as `SERIALIZABLE` combined with retry-on-conflict logic.

**Q: Why can't you simply "revert" a Prisma migration the way you can with `typeorm migration:revert`?**
Answer: TypeORM migrations are TypeScript classes with paired `up()` and `down()` methods, so reverting means running the already-defined `down()` SQL for the most recently applied migration. Prisma Migrate generates plain SQL migration files representing only the forward change, with no built-in reverse operation captured alongside it. To undo a Prisma migration in a shared environment, you write and apply a new forward migration that reverses the schema change (e.g., dropping the column that was just added) rather than "rewinding" — which also has the benefit of leaving an explicit, auditable trail of every schema change, forward-only, in migration history.
