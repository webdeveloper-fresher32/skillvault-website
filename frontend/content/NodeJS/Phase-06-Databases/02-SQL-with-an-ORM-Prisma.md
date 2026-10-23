# SQL with an ORM (Prisma) — Complete Guide

> This lesson covers Node's integration layer for SQL databases. For SQL fundamentals, schema design, indexing, joins, and query tuning, see `../../Databases/MySQL/` in this repo (concepts transfer directly to Postgres).

## Table of Contents
1. [Why Prisma](#1-why-prisma)
2. [Setup and Connecting](#2-setup-and-connecting)
3. [schema.prisma Basics](#3-schemaprisma-basics)
4. [Migrations](#4-migrations)
5. [CRUD via Prisma Client](#5-crud-via-prisma-client)
6. [Relations](#6-relations)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Prisma

Prisma is a next-generation ORM for Node/TypeScript that talks to Postgres, MySQL, SQLite, SQL Server, and others. It's the closest Node equivalent to SQLAlchemy (Python) or Django ORM — but schema-first and fully type-safe.

```
Django ORM / SQLAlchemy (Python)     Prisma (Node)
  models.py / declarative models  →   schema.prisma
  manage.py makemigrations        →   npx prisma migrate dev
  Model.objects.filter(...)       →   prisma.model.findMany({ where: {...} })
  ORM auto-generates SQL          →   Prisma Client auto-generates SQL
```

| Tool | Style |
|------|-------|
| **Sequelize** | Traditional JS ORM, Active Record style, closer to Django ORM |
| **TypeORM** | Decorator-based, closer to Java's Hibernate |
| **Prisma** | Schema-first, generates a fully-typed client — the current industry favorite for new Node projects |

This lesson uses Prisma since it's the most commonly asked about in modern Node interviews and has the gentlest learning curve.

---

## 2. Setup and Connecting

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

This scaffolds:
```
prisma/
  schema.prisma      # your data model
.env                 # DATABASE_URL lives here
```

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
# MySQL example: "mysql://user:password@localhost:3306/mydb"
```

```javascript
// prismaClient.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'], // helpful during development
});

module.exports = prisma;
```

```javascript
// server.js
const express = require('express');
const prisma = require('./prismaClient');

const app = express();
app.use(express.json());

async function main() {
  await prisma.$connect(); // optional — Prisma lazily connects on first query
  app.listen(3000, () => console.log('Server running on port 3000'));
}

main();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

---

## 3. schema.prisma Basics

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  age       Int?
  role      Role     @default(USER)
  posts     Post[]   // one-to-many (see §6)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
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

| Prisma Attribute | Meaning |
|-------------------|---------|
| `@id` | Primary key |
| `@default(autoincrement())` | Auto-increment (`SERIAL` in Postgres) |
| `@unique` | Unique constraint |
| `@default(now())` | Default to current timestamp |
| `@updatedAt` | Auto-updates on every write |
| `?` after type | Nullable column |
| `[]` after type | One-to-many relation array (Prisma-side only, no DB column) |
| `@relation(fields: [...], references: [...])` | Defines the foreign key |

This is directly analogous to a Django model class or SQLAlchemy declarative model — `schema.prisma` is the single source of truth for your database structure.

---

## 4. Migrations

Migrations turn `schema.prisma` changes into versioned SQL that alters the actual database — like Django's `makemigrations` + `migrate`, or Alembic for SQLAlchemy.

```bash
# Create and apply a migration in development
npx prisma migrate dev --name init

# Generates:
# prisma/migrations/20260702120000_init/migration.sql
# and regenerates Prisma Client types
```

```sql
-- Example generated migration.sql
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "age" INTEGER,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
```

```bash
# Apply pending migrations in production/CI (never generates new ones)
npx prisma migrate deploy

# Inspect current migration status
npx prisma migrate status

# Open a GUI to browse/edit data (dev only)
npx prisma studio
```

| Command | When to use |
|---------|-------------|
| `prisma migrate dev` | Local development — creates + applies migration, updates client |
| `prisma migrate deploy` | CI/CD and production — applies existing migrations only, no prompts |
| `prisma db push` | Quick prototyping, no migration history (skip in real projects) |
| `prisma generate` | Regenerate the typed client after pulling schema changes from git |

---

## 5. CRUD via Prisma Client

```javascript
const prisma = require('./prismaClient');

// CREATE
const user = await prisma.user.create({
  data: { name: 'Asha', email: 'asha@example.com', age: 29 },
});

// READ
const all = await prisma.user.findMany();
const one = await prisma.user.findUnique({ where: { id: 1 } });
const filtered = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 10, // LIMIT 10
  skip: 0,  // OFFSET 0
});

// UPDATE
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { age: 30 },
});

// UPSERT (update if exists, create if not)
await prisma.user.upsert({
  where: { email: 'asha@example.com' },
  update: { age: 30 },
  create: { name: 'Asha', email: 'asha@example.com', age: 30 },
});

// DELETE
await prisma.user.delete({ where: { id: 1 } });
await prisma.user.deleteMany({ where: { role: 'GUEST' } });
```

### Example: Express route using Prisma CRUD

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.post('/users', async (req, res) => {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json(user);
  } catch (err) {
    // Prisma throws known error codes, e.g. P2002 = unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
```

---

## 6. Relations

Prisma relations are declared in the schema and traversed with the `include` option — the equivalent of SQL joins, but expressed declaratively.

```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
  tags     Tag[]  @relation("PostTags") // many-to-many
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[] @relation("PostTags")
}
```

```javascript
// Fetch a user WITH their posts (like SQL JOIN)
const userWithPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true },
});

// Nested include
const postWithAuthorAndTags = await prisma.post.findUnique({
  where: { id: 1 },
  include: { author: true, tags: true },
});

// Create a user and a related post in one call (nested write)
const userWithNewPost = await prisma.user.create({
  data: {
    name: 'Ravi',
    email: 'ravi@example.com',
    posts: {
      create: [{ title: 'My first post' }],
    },
  },
  include: { posts: true },
});

// Filter by a related field
const admins = await prisma.user.findMany({
  where: { posts: { some: { published: true } } },
});
```

| Prisma Concept | SQL Equivalent |
|------------------|-----------------|
| `include: { posts: true }` | `LEFT JOIN post ON post.authorId = user.id` |
| `where: { posts: { some: {...} } }` | `WHERE EXISTS (SELECT 1 FROM post WHERE ...)` |
| Nested `create` | Two `INSERT`s wrapped in an implicit transaction |
| `@relation("PostTags")` many-to-many | Implicit join table managed by Prisma |

---

## 7. Hands-On Exercises

**Exercise 1:** Run `npx prisma init` against a local Postgres (or MySQL) instance. Define a `Product` model with `name`, `price` (Decimal/Float), and `inStock` (Boolean). Run `prisma migrate dev` and inspect the generated SQL file.

**Exercise 2:** Write an Express CRUD API for `Product` using Prisma Client (`POST`, `GET` all, `GET` one, `PUT`, `DELETE`).

**Exercise 3:** Add an `Order` model with a `belongsTo` relation to a `Customer` model. Write a route that returns a customer with all their orders included.

**Exercise 4:** Add a many-to-many relation between `Order` and `Product` (an order can contain many products, a product can be in many orders). Create an order with two products in a single nested-write call.

**Exercise 5:** Deliberately violate the `@unique` constraint on an email field via the API and handle Prisma's `P2002` error code with a clean 409 response.

---

## 8. Interview Q&A

**Q: What is Prisma and how is it different from a traditional ORM like Sequelize?**
Answer: Prisma is a schema-first ORM/query builder for Node and TypeScript. Instead of defining models as JS classes (Active Record style, like Sequelize or Django ORM), you define your data model declaratively in `schema.prisma`, and Prisma generates a fully type-safe client plus SQL migrations from it. This gives compile-time safety on queries — a typo in a field name is a build error, not a runtime error.

**Q: Walk through what happens when you run `npx prisma migrate dev`.**
Answer: Prisma compares the current `schema.prisma` against the migration history, generates a new SQL migration file capturing the diff, applies it to the connected database, and regenerates the typed Prisma Client so your code has up-to-date types. In production/CI, you use `prisma migrate deploy` instead, which only applies existing migrations without generating new ones or prompting interactively.

**Q: How do you fetch a record along with its related records in Prisma?**
Answer: Use the `include` option in the query, e.g. `prisma.user.findUnique({ where: { id }, include: { posts: true } })`. Prisma translates this into a JOIN (or a set of queries, depending on the relation strategy) and returns a nested object — the relational equivalent of Mongoose's `populate()`.

**Q: What's the difference between `prisma migrate dev` and `prisma db push`?**
Answer: `migrate dev` creates a versioned, reviewable SQL migration file and applies it — the right choice for any real project with a migration history and team collaboration. `db push` directly syncs the schema to the database with no migration file, useful only for fast local prototyping; it's destructive-by-default for certain changes and has no audit trail.

**Q: How would you handle a unique-constraint violation in Prisma?**
Answer: Prisma throws a `PrismaClientKnownRequestError` with a `code` property — `P2002` specifically for unique constraint violations. You catch it and inspect `err.code === 'P2002'` (and `err.meta.target` for which field) to return an appropriate HTTP status like 409 Conflict instead of a generic 500.

**Q: When would you choose Prisma/SQL over Mongoose/MongoDB for a new Node project?**
Answer: Choose SQL + Prisma when data is highly relational with many-to-many relationships, you need strong schema enforcement at the database level, multi-row transactional integrity, or complex joins/aggregations that map cleanly to SQL. Choose MongoDB + Mongoose when the data is document-shaped, schema flexibility is valuable, or you're optimizing for horizontal scale on largely independent documents. See `../../Databases/MySQL/` and `../../Databases/MongoDB/` for the deeper tradeoff discussion.
