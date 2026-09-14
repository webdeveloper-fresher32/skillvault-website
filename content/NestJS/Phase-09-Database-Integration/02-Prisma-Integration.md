# Prisma Integration — Complete Guide

## Table of Contents
1. [Why Prisma](#1-why-prisma)
2. [The Prisma Schema](#2-the-prisma-schema)
3. [Generating the Client](#3-generating-the-client)
4. [PrismaService — Connection Lifecycle](#4-prismaservice--connection-lifecycle)
5. [PrismaModule — A Global Module](#5-prismamodule--a-global-module)
6. [Worked Example — Type-Safe CRUD Service](#6-worked-example--type-safe-crud-service)
7. [Modeling Relationships in Prisma](#7-modeling-relationships-in-prisma)
8. [Type-Safe Filtering and Pagination](#8-type-safe-filtering-and-pagination)
9. [TypeORM vs Prisma — Comparison](#9-typeorm-vs-prisma--comparison)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Prisma

Prisma inverts TypeORM's approach: instead of TypeScript classes decorated with `@Entity`/`@Column` describing your schema, you write your schema once in a dedicated `schema.prisma` file, and Prisma **generates** a fully type-safe database client from it. The generated client's types are exact — every field, every relation, every filter option on every model is derived directly from your schema, so a typo'd field name or a wrong relation name is a compile-time TypeScript error, not a runtime surprise.

```
  schema.prisma (source of truth)
         │
         │  npx prisma generate
         ▼
  @prisma/client (generated, fully-typed)
         │
         │  injected as a provider
         ▼
  PrismaService (extends PrismaClient, wired into Nest's DI + lifecycle)
         │
         ▼
  Feature services call prisma.user.findMany(), prisma.user.create(), ...
```

This "schema-first, generate everything" workflow is why Prisma has become the default recommendation for new Node/TypeScript projects: there's a single file to review for the entire data model, the client is regenerated automatically whenever the schema changes, and autocomplete in your editor reflects your actual current schema rather than hand-maintained decorator metadata that can drift out of sync with the database.

Prisma also ships its own migration tool, Prisma Migrate, which diffs your schema against migration history and generates plain SQL migration files — reviewable, versioned, and reversible (covered in lesson 3).

---

## 2. The Prisma Schema

Everything starts with `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  fullName  String
  email     String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

The `datasource` block points at your database via `DATABASE_URL` (kept in `.env`, never committed). The `generator client` block controls what `npx prisma generate` produces — by default, a fully-typed client under `node_modules/@prisma/client`. Model fields map directly to columns; `@id`, `@default(...)`, `@unique`, and `?` (nullable) read almost identically to SQL DDL, which is part of why the format is easy to review in a pull request compared to scattered decorator annotations across many files.

---

## 3. Generating the Client

```bash
npm install prisma --save-dev
npm install @prisma/client

npx prisma init          # scaffolds prisma/schema.prisma and .env
npx prisma generate      # (re)generates the typed client from schema.prisma
```

`prisma generate` must be re-run any time `schema.prisma` changes — many teams add it to a `postinstall` npm script so it happens automatically after `npm install`, and CI pipelines run it explicitly before building. Forgetting to regenerate after a schema change is the single most common Prisma pitfall for newcomers (see Common Pitfalls).

---

## 4. PrismaService — Connection Lifecycle

Prisma's generated `PrismaClient` isn't Nest-aware out of the box — it doesn't know when to connect or disconnect relative to the application lifecycle. The standard integration pattern is to wrap it in an injectable `PrismaService` that extends `PrismaClient` and implements Nest's `OnModuleInit`/`OnModuleDestroy` lifecycle hooks:

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Explicitly connect at startup rather than relying on Prisma's lazy
    // connect-on-first-query — this surfaces connection errors immediately
    // at boot rather than on the first incoming request.
    await this.$connect();
  }

  async onModuleDestroy() {
    // Ensures the connection pool is closed cleanly when Nest shuts the
    // application down (e.g., during graceful shutdown or in tests).
    await this.$disconnect();
  }

  // Optional: hook Prisma's shutdown into Nest's own shutdown sequence so
  // that `app.close()` (e.g. triggered by SIGTERM) actually waits for
  // Prisma to disconnect before the process exits.
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }
}
```

By extending `PrismaClient` directly, `PrismaService` *is* the client — every model delegate (`this.user`, `this.post`, ...) is available on `this` inside any service that injects `PrismaService`, with no extra wrapping layer or manual method proxying required.

---

## 5. PrismaModule — A Global Module

Because nearly every feature module needs database access, `PrismaService` is a natural candidate for Nest's `@Global()` module pattern — registered once, injectable anywhere without every feature module re-importing it:

```typescript
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
export class PrismaModule {}

// Apply the @Module decorator via decorator composition, or declare inline:
Module({
  providers: [PrismaService],
  exports: [PrismaService],
})(PrismaModule);
```

The more common and readable way to write the same thing is to stack the decorators directly:

```typescript
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
})
export class AppModule {}
```

Import `PrismaModule` exactly once, in `AppModule` — `@Global()` makes its exports (`PrismaService`) available to every other module's DI container without those modules needing to list `PrismaModule` in their own `imports` array.

---

## 6. Worked Example — Type-Safe CRUD Service

```typescript
// users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;
}
```

```typescript
// users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      // .create() is fully typed: passing a field that doesn't exist on
      // User, or omitting a required one, fails at compile time.
      return await this.prisma.user.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // P2002 = unique constraint violation (email is @unique in the schema)
        throw new ConflictException(`Email ${dto.email} is already registered`);
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findWithPosts(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { posts: true }, // explicit relation loading, same philosophy as TypeORM
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: number, dto: Prisma.UserUpdateInput): Promise<User> {
    await this.findOne(id); // 404 check
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // 404 check
    await this.prisma.user.delete({ where: { id } });
  }
}
```

`Prisma.UserUpdateInput` and the `User` model type itself are both generated directly from `schema.prisma` — rename a field there, run `prisma generate`, and every one of these call sites that references the old field name fails to compile immediately, with no separate "entity" definition that could silently drift out of sync.

---

## 7. Modeling Relationships in Prisma

Prisma relations read close to plain English. A one-to-many (`User` has many `Post`s) needs a scalar foreign key field plus a `@relation` attribute on the "many" side, and just the reverse array on the "one" side — shown already in section 2. Many-to-many is even simpler than TypeORM's explicit `@JoinTable`, since Prisma can manage an implicit join table automatically for simple cases:

```prisma
model Post {
  id   Int    @id @default(autoincrement())
  title String
  tags Tag[]
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}
```

Prisma creates and manages the implicit `_PostToTag` join table automatically — no explicit join-table model needed for the simple case. As soon as the join table needs extra columns (e.g., `addedAt`), switch to an explicit join model with two one-to-many relations, exactly like TypeORM's association-entity pattern:

```prisma
model PostTag {
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  tag       Tag      @relation(fields: [tagId], references: [id])
  tagId     Int
  addedAt   DateTime @default(now())

  @@id([postId, tagId])
}
```

---

## 8. Type-Safe Filtering and Pagination

Beyond basic CRUD, Prisma's generated client also produces typed filter objects for every model, so query conditions get the same compile-time safety as create/update calls. A paginated, filterable "search users" endpoint is a common real-world requirement:

```typescript
// users/dto/find-users.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FindUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
```

```typescript
// users/users.service.ts (excerpt)
async search(query: FindUsersDto): Promise<{ data: User[]; total: number }> {
  const { search, page = 1, pageSize = 20 } = query;

  // Prisma.UserWhereInput is generated from the schema — passing a field
  // name that doesn't exist on User fails to compile.
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.user.count({ where }),
  ]);

  return { data, total };
}
```

Running `findMany` and `count` together inside a `$transaction` array here isn't for atomicity (neither call writes anything) — it's to guarantee both queries see the same consistent snapshot of the data, so the returned `total` always matches the page of `data` returned alongside it, even under concurrent writes from other requests.

---

## 9. TypeORM vs Prisma — Comparison

| Aspect | TypeORM | Prisma |
|---|---|---|
| Schema definition | Decorator-annotated TypeScript classes | Dedicated `schema.prisma` DSL file |
| Type safety | Good, but entity/repository types are hand-authored | Generated directly from schema — exact, always in sync |
| Query API | `Repository<T>` methods + optional QueryBuilder | Generated per-model client (`prisma.user.findMany(...)`) |
| Migrations | `typeorm migration:generate`/`migration:run` | `prisma migrate dev`/`migrate deploy` |
| Relation loading | Explicit via `relations: [...]` or `{ eager: true }` | Explicit via `include: {...}` |
| Active Record support | Yes (optional) | No — Data Mapper only |
| Raw SQL escape hatch | QueryBuilder, `query()` | `$queryRaw`, `$executeRaw` |
| Ecosystem fit | Matches Nest's decorator-driven style closely | Requires a small wrapping layer (`PrismaService`) to fit DI |
| Learning curve | Lower if already familiar with JPA/Hibernate-style ORMs | Lower if you prefer schema-first, generated-code workflows |

Neither is strictly "better" — TypeORM's decorator style fits naturally alongside Nest's own decorators and Active Record is occasionally convenient for very simple CRUD, while Prisma's generated, schema-derived types eliminate an entire category of entity/database drift bugs at the cost of one extra build step (`prisma generate`) and a thin custom service wrapper for DI integration.

---

## 10. Common Pitfalls

**Forgetting to run `prisma generate` after editing `schema.prisma`.** The generated client is a build artifact under `node_modules/@prisma/client` — editing the schema alone has zero effect until you regenerate. This shows up as stale type errors ("property does not exist") or, worse, a client that silently doesn't know about a new field. Add `"postinstall": "prisma generate"` to `package.json` scripts and re-run it explicitly after every schema edit during local development.

**Not calling `$connect()`/`$disconnect()` through Nest's lifecycle hooks.** Without `OnModuleInit`/`OnModuleDestroy`, Prisma still works (it lazily connects on the first query), but connection errors surface on the first real request instead of at boot, and connections may not close cleanly during tests or graceful shutdown, leaving dangling handles.

**Treating `PrismaService` as request-scoped by default.** `PrismaService` should be a singleton (Nest's default provider scope) backed by Prisma's own internal connection pool — do not mark it `{ scope: Scope.REQUEST }`, which would create a new database connection pool per incoming request and quickly exhaust available connections under load.

**Using the implicit many-to-many join table when extra columns are needed later.** Prisma's implicit join tables are convenient for simple many-to-many relationships, but they cannot hold additional columns. If you discover mid-project that you need a `assignedAt` or `role` column on the join, you must migrate to an explicit join model — plan for this upfront if you suspect the relationship will need metadata.

**Swallowing `PrismaClientKnownRequestError` codes without checking them.** Prisma surfaces database errors (unique constraint violations, foreign key violations, record-not-found) as typed `PrismaClientKnownRequestError` instances with a `code` (e.g., `P2002` for unique violations, `P2025` for record not found). Catching the generic `Error` type and re-throwing a generic 500 loses this information — always check `error.code` and map it to the appropriate Nest HTTP exception, as shown in the `create()` method above.

---

## 11. Best Practices

- Add `"postinstall": "prisma generate"` to `package.json` so the client is always regenerated after `npm install`, in local dev and CI alike.
- Register `PrismaModule` as `@Global()` and import it exactly once in `AppModule` — every other feature module simply injects `PrismaService` without re-importing the module.
- Always implement both `OnModuleInit` (`$connect()`) and `OnModuleDestroy` (`$disconnect()`) on `PrismaService` so connection errors surface at boot and shutdown is clean.
- Keep `PrismaService` as a default singleton provider — never make it request-scoped.
- Prefer Prisma's generated input types (`Prisma.UserCreateInput`, `Prisma.UserUpdateInput`) for method parameters instead of hand-written interfaces, so a schema change that removes/renames a field is caught by the compiler everywhere that type is used.
- Map specific `PrismaClientKnownRequestError` codes (`P2002` unique violation, `P2025` not found, `P2003` foreign key violation) to specific Nest `HttpException` subclasses rather than a blanket 500.
- Keep `schema.prisma` as the single source of truth reviewed in pull requests — resist hand-editing the generated client or the database directly outside of the migration workflow.

---

## 12. Hands-On Exercises

**Exercise 1:** Scaffold a new Nest project, run `npx prisma init`, and define a `User` model with `id`, `email` (unique), and `createdAt`. Run `npx prisma generate`, then build `PrismaService` and `PrismaModule` exactly as shown in sections 4-5, and confirm you can inject `PrismaService` into a throwaway controller and call `prisma.user.findMany()`.

**Exercise 2:** Add a `Post` model with a `User` relation (one user has many posts). Regenerate the client, then write a `PostsService.create()` method that fails to compile if you typo a field name in the `data` object — deliberately introduce the typo, observe the compiler error, then fix it.

**Exercise 3:** Trigger a `P2002` unique constraint violation on purpose (create two users with the same email) and confirm your service correctly translates it into a `ConflictException` (409) rather than an unhandled 500.

**Exercise 4:** Add a `Tag` model with an implicit many-to-many relationship to `Post`. Then extend the requirement to track `addedAt` per tag assignment, discover the implicit join table can't hold it, and refactor to an explicit `PostTag` join model with a composite `@@id([postId, tagId])`.

**Exercise 5:** Remove the `OnModuleDestroy` hook from `PrismaService` temporarily and write a small script that boots the Nest app, makes one query, then calls `app.close()`. Compare connection cleanup behavior (e.g., via your database's active-connections view) with and without the hook to see the practical effect of `$disconnect()`.

---

## 13. Interview Q&A

**Q: What is the core architectural difference between how TypeORM and Prisma define a data model?**
Answer: TypeORM is decorator-first — you write TypeScript classes annotated with `@Entity`, `@Column`, and relationship decorators, and TypeORM reads that metadata at runtime via `reflect-metadata` to build its understanding of the schema. Prisma is schema-first — you write your entire data model once in a dedicated `schema.prisma` DSL file, and a build step (`npx prisma generate`) generates a fully-typed TypeScript client from it. The practical difference is that Prisma's types are always in exact sync with the schema (they're generated from it), whereas TypeORM's entity classes and the actual database schema can theoretically drift if `synchronize` is off and migrations aren't kept perfectly in step with entity edits.

**Q: Why does `PrismaService` need to implement `OnModuleInit` and `OnModuleDestroy`?**
Answer: `PrismaClient` doesn't know anything about Nest's application lifecycle by default — it lazily connects to the database on the first query it's asked to run. Implementing `OnModuleInit` and calling `this.$connect()` forces the connection to be established during application bootstrap, so any connectivity problem (wrong credentials, unreachable database) surfaces immediately at startup rather than on a random user's first request. Implementing `OnModuleDestroy` and calling `this.$disconnect()` ensures the connection pool is released cleanly when Nest tears the application down, which matters for graceful shutdowns and for test suites that repeatedly bootstrap and tear down the app.

**Q: Why is `PrismaModule` typically decorated with `@Global()`?**
Answer: Almost every feature module in a typical application needs database access, so requiring each one to explicitly `import: [PrismaModule]` would be repetitive boilerplate for essentially no benefit — `PrismaService` has no per-module configuration that would justify scoping it. Marking `PrismaModule` `@Global()` and importing it once in `AppModule` makes `PrismaService` injectable from any module's providers without further imports, the same pattern commonly used for `ConfigModule`.

**Q: How do you handle a database constraint violation (like a duplicate unique field) when using Prisma inside a Nest service?**
Answer: Prisma throws a `Prisma.PrismaClientKnownRequestError` with a specific `code` property for known database error conditions — `P2002` for a unique constraint violation, `P2025` for "record not found," `P2003` for a foreign key constraint failure, and others. The idiomatic pattern is to catch the error, check `instanceof Prisma.PrismaClientKnownRequestError` and inspect `error.code`, then translate it into the appropriate Nest exception — for example, mapping `P2002` to a `ConflictException` (409) — rather than letting it propagate as an unhandled 500.

**Q: When would you choose an explicit join model over Prisma's implicit many-to-many relation?**
Answer: Prisma's implicit many-to-many (declaring `Post[]`/`Tag[]` array fields on both sides with no intermediate model) is convenient when the relationship itself carries no extra data — Prisma manages the join table for you automatically. As soon as the relationship needs its own attributes, such as an `addedAt` timestamp or a `role` on the join, an implicit relation cannot represent it, since there's no model to attach fields to. In that case you introduce an explicit join model with two scalar foreign keys and a composite primary key (`@@id([postId, tagId])`), which mirrors the "association entity" pattern used for the same problem in TypeORM and JPA.

**Q: What's a practical reason to prefer Prisma over TypeORM specifically for migration review in a team setting?**
Answer: Prisma Migrate generates plain, human-readable SQL migration files derived from a diff between your `schema.prisma` and the current migration history, and the entire data model lives in a single file that's easy to review end-to-end in a pull request. TypeORM's migration generation works similarly (diffing entities against the database), but because entity definitions are scattered decorator-by-decorator across many files, reviewing "what changed in the data model" in a PR is comparatively harder than reviewing a diff of one central `schema.prisma` file plus the generated SQL migration.
