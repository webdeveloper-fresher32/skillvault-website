# Phase 9: Database Integration

## What You'll Learn
How to wire a real, production-grade database layer into a NestJS application using the two dominant ORM/query-layer choices in the ecosystem: TypeORM (the "batteries included," decorator-driven ORM that ships in the official Nest docs) and Prisma (the schema-first, generated-client alternative that has become the default recommendation for new projects). You'll learn how to configure either one through Nest's module system, model entities and relationships, inject repositories/clients cleanly through DI, and — critically — how to wrap multi-step writes in transactions and manage schema evolution through migrations so your database layer survives contact with production.

This phase mirrors, in TypeORM/Prisma syntax, the same entity-mapping and relationship concepts covered for JPA/Hibernate in this repo's Spring Boot course (`SpringBoot/Phase-04-Data-Access-JPA`). If you've been through that phase, the owning-side/inverse-side, cascade, and fetch-strategy concepts will feel familiar — only the decorators and query APIs differ.

## Learning Objectives
- Configure `@nestjs/typeorm` with both `TypeOrmModule.forRoot()` and the async, `ConfigService`-driven `TypeOrmModule.forRootAsync()` pattern
- Register per-module repositories with `TypeOrmModule.forFeature([Entity])` and inject them with `@InjectRepository()`
- Model entities with `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, and the relationship decorators `@OneToMany`, `@ManyToOne`, `@ManyToMany`, and `@OneToOne`
- Build a full CRUD service backed by a TypeORM `Repository<T>`
- Explain why Prisma's schema-first workflow and generated client are a popular alternative to TypeORM's decorator-based approach
- Wrap `PrismaClient` in an injectable `PrismaService` with proper `OnModuleInit`/`OnModuleDestroy` connection lifecycle handling
- Expose `PrismaService` through a global `PrismaModule` and build a fully type-safe CRUD service against the generated client
- Compare TypeORM and Prisma on type safety, migration workflow, and query ergonomics
- Wrap multi-step database operations in transactions using TypeORM's `QueryRunner`/`DataSource.transaction()` and Prisma's `$transaction`
- Generate and run schema migrations with both `typeorm migration:generate`/`migration:run` and `prisma migrate dev`/`migrate deploy`

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-TypeORM-Integration.md](01-TypeORM-Integration.md) | TypeORM Integration — Modules, Entities, Relationships, Repositories | 1 day |
| [02-Prisma-Integration.md](02-Prisma-Integration.md) | Prisma Integration — Schema, Generated Client, PrismaService | 1 day |
| [03-Transactions-and-Migrations.md](03-Transactions-and-Migrations.md) | Transactions and Migrations — QueryRunner, $transaction, Schema Evolution | 1 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 8: Interceptors, Filters and Custom Decorators](../Phase-08-Interceptors-Filters-and-Custom-Decorators/README.md)

## Next Phase
→ [Phase 10: Testing](../Phase-10-Testing/README.md)
