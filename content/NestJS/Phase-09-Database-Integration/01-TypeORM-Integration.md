# TypeORM Integration — Complete Guide

## Table of Contents
1. [Why TypeORM](#1-why-typeorm)
2. [Installing and Configuring TypeOrmModule](#2-installing-and-configuring-typeormmodule)
3. [Async Configuration with ConfigService](#3-async-configuration-with-configservice)
4. [Declaring Entities — @Entity, @Column, @PrimaryGeneratedColumn](#4-declaring-entities--entity-column-primarygeneratedcolumn)
5. [Registering Entities per Module — TypeOrmModule.forFeature](#5-registering-entities-per-module--typeormmoduleforfeature)
6. [Relationship Decorators — @ManyToOne / @OneToMany](#6-relationship-decorators--manytoone--onetomany)
7. [@ManyToMany and @OneToOne](#7-manytomany-and-onetoone)
8. [Injecting a Repository — @InjectRepository](#8-injecting-a-repository--injectrepository)
9. [Worked Example — CRUD Service with a Repository](#9-worked-example--crud-service-with-a-repository)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why TypeORM

TypeORM is the ORM the official NestJS documentation reaches for first, and for good reason: it is decorator-based, which fits naturally into Nest's decorator-and-metadata-driven programming model. Entities are plain TypeScript classes annotated with `@Entity`, `@Column`, and relationship decorators — conceptually the same shape as a JPA `@Entity` in Java/Spring Boot, just expressed through TypeScript's `reflect-metadata` instead of Java annotations.

```
  NestJS app
  ┌───────────────────────────────────────────────────────────┐
  │  TypeOrmModule.forRoot(...)   ← registers a DataSource     │
  │            │                                               │
  │            ▼                                               │
  │  Feature modules import TypeOrmModule.forFeature([Entity]) │
  │            │                                               │
  │            ▼                                               │
  │  @InjectRepository(Entity) → Repository<Entity>             │
  │            │                                               │
  │            ▼                                               │
  │  Service methods call repository.find/save/delete/...      │
  └───────────────────────────────────────────────────────────┘
```

TypeORM supports the Active Record pattern (entities carry their own persistence methods) and the Data Mapper pattern (entities are plain data, a separate `Repository` does persistence). Nest's `@nestjs/typeorm` package is built around the Data Mapper pattern — you inject a `Repository<T>` rather than calling `entity.save()` directly — because it keeps entities as plain DTO-like classes and keeps persistence logic testable and mockable through DI, matching Nest's overall philosophy.

---

## 2. Installing and Configuring TypeOrmModule

```bash
npm install @nestjs/typeorm typeorm pg
```

(`pg` here is the PostgreSQL driver; swap for `mysql2`, `sqlite3`, etc. depending on your database.)

The simplest setup calls `TypeOrmModule.forRoot()` once in the root `AppModule`, passing connection options directly:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'app',
      password: 'app_password',
      database: 'app_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // NEVER true in production — see Common Pitfalls
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

`TypeOrmModule.forRoot()` internally creates and registers a TypeORM `DataSource` as a provider, available application-wide. Every feature module that later calls `TypeOrmModule.forFeature([...])` reuses this same connection pool rather than opening a new one.

Hardcoding credentials like this is fine for a first prototype, but it doesn't survive contact with multiple environments (local, CI, staging, production) or secrets management — which is exactly what `forRootAsync` solves.

---

## 3. Async Configuration with ConfigService

Production apps need connection details sourced from environment variables, and those variables need to be validated and available before the `DataSource` is constructed. `TypeOrmModule.forRootAsync()` accepts a factory function with injected dependencies — typically `ConfigService` from `@nestjs/config`:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // ensures ConfigService is available to inject
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        autoLoadEntities: true, // auto-registers entities from forFeature calls
      }),
    }),
  ],
})
export class AppModule {}
```

`autoLoadEntities: true` tells Nest to automatically include every entity registered via any module's `TypeOrmModule.forFeature([...])` in the connection's entity list, so you don't have to hand-maintain a glob pattern or an explicit array as the codebase grows. The `imports: [ConfigModule]` line is easy to forget — even with `ConfigModule.forRoot({ isGlobal: true })` making it globally available, `forRootAsync`'s own DI context still needs the module listed so Nest resolves `ConfigService` before the factory runs.

---

## 4. Declaring Entities — @Entity, @Column, @PrimaryGeneratedColumn

An entity is a class decorated with `@Entity()`; each persisted field is decorated with `@Column()` (or a more specific primary-key decorator):

```typescript
// users/entities/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users') // explicit table name; defaults to the class name if omitted
export class User {
  @PrimaryGeneratedColumn() // auto-incrementing integer PK
  id: number;

  @Column({ length: 100 })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

`@PrimaryGeneratedColumn()` defaults to an auto-incrementing integer; pass `'uuid'` to generate a UUID primary key instead (`@PrimaryGeneratedColumn('uuid')`) — a common choice for public-facing IDs that shouldn't leak sequential ordering. `@Column()` accepts options mirroring SQL column definitions: `type`, `length`, `nullable`, `default`, `unique`, and `enum` (for Postgres/MySQL enum columns).

| Decorator | Role |
|---|---|
| `@Entity(name?)` | Marks a class as a mapped table |
| `@PrimaryGeneratedColumn(strategy?)` | Auto-generated primary key (`'increment'` default, or `'uuid'`) |
| `@PrimaryColumn()` | Primary key you assign yourself (no auto-generation) |
| `@Column(options?)` | A regular mapped column |
| `@CreateDateColumn()` / `@UpdateDateColumn()` | Auto-managed timestamp columns |

---

## 5. Registering Entities per Module — TypeOrmModule.forFeature

`forRoot`/`forRootAsync` registers the *connection*; each feature module still needs to declare which entities it works with, via `TypeOrmModule.forFeature([Entity])`. This is what makes `@InjectRepository(Entity)` resolvable inside that module's providers:

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule], // re-export so other modules can inject Repository<User> too
})
export class UsersModule {}
```

Each module only imports the entities it actually needs — this keeps module boundaries meaningful and avoids every feature module implicitly depending on every entity in the app.

---

## 6. Relationship Decorators — @ManyToOne / @OneToMany

Relationships in TypeORM mirror the same owning-side/inverse-side model used by JPA/Hibernate: the "many" side physically holds the foreign key column and is the *owning* side; the "one" side is the *inverse* side and uses `mappedBy`-equivalent configuration (TypeORM calls it the second argument to `@OneToMany`, a function returning the inverse property).

```
  @ManyToOne     Many Orders  ───────▶  One Customer     (owning side — has the FK column)
  @OneToMany     One Customer ───────▶  Many Orders       (inverse side — no FK column here)
```

```typescript
// customers/entities/customer.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

@Entity()
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];
}
```

```typescript
// orders/entities/order.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @ManyToOne(() => Customer, (customer) => customer.orders, {
    onDelete: 'CASCADE', // deleting a Customer deletes their Orders at the DB level
  })
  @JoinColumn({ name: 'customer_id' }) // explicit FK column name; optional, TypeORM infers one otherwise
  customer: Customer;
}
```

`@ManyToOne` is virtually always the owning side, since `orders` is the table with the physical `customer_id` foreign key column. The second argument on both decorators — `(order) => order.customer` and `(customer) => customer.orders` — is how TypeORM wires the bidirectional relationship together; it must reference the actual property name on the other entity, and like JPA's `mappedBy` string, a rename on one side without updating the other fails only at runtime, not at compile time, because it's a function returning a property access that TypeScript can type-check but TypeORM only evaluates for its property *name* via reflection.

By default, `@ManyToOne` relations are eagerly-loaded-on-access via lazy Promises only if you opt into `lazy: true`; otherwise TypeORM requires you to explicitly request the relation with `relations: ['customer']` or a query builder `leftJoinAndSelect` — unlike JPA, TypeORM does **not** silently eager-load related entities by default, which avoids the classic EAGER-fetch-chain problem entirely.

---

## 7. @ManyToMany and @OneToOne

`@ManyToMany` needs a join table since neither side can hold a single-valued foreign key:

```typescript
// students/entities/student.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable } from 'typeorm';
import { Course } from '../../courses/entities/course.entity';

@Entity()
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToMany(() => Course, (course) => course.students)
  @JoinTable({ name: 'student_courses' }) // only the owning side declares @JoinTable
  courses: Course[];
}
```

```typescript
// courses/entities/course.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToMany } from 'typeorm';
import { Student } from '../../students/entities/student.entity';

@Entity()
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @ManyToMany(() => Student, (student) => student.courses)
  students: Student[]; // inverse side — no @JoinTable here
}
```

If the join table needs its own extra columns (e.g. `enrolledAt`), a plain `@ManyToMany` can no longer represent it — model it as a separate `@Entity` (e.g. `Enrollment`) with two `@ManyToOne` relationships instead, exactly like the JPA "association entity" pattern.

`@OneToOne` models a strict one-to-one relationship, such as a `User` and its `Profile`:

```typescript
// profiles/entities/profile.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  bio: string;

  @OneToOne(() => User)
  @JoinColumn() // this side owns the FK column (profile.userId)
  user: User;
}
```

Only the side with `@JoinColumn()` physically stores the foreign key; the other side, if bidirectional, uses `@OneToOne(() => Profile, (profile) => profile.user)` with no `@JoinColumn()`.

---

## 8. Injecting a Repository — @InjectRepository

Once an entity is registered via `forFeature`, any provider in that module can inject its `Repository<T>` using the `@InjectRepository()` parameter decorator:

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}
}
```

Under the hood, `@InjectRepository(User)` resolves to a Nest provider token derived from the entity, backed by the `Repository<User>` instance TypeORM creates against the shared `DataSource`. It's the direct analogue of Spring Data JPA's `@Autowired UserRepository` — except here you get TypeORM's generic `Repository<T>` rather than a custom repository interface, unless you explicitly build a custom repository class.

---

## 9. Worked Example — CRUD Service with a Repository

A complete, realistic CRUD service combining everything above:

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
// users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

```typescript
// users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email ${dto.email} is already registered`);
    }
    const user = this.usersRepository.create(dto); // builds an entity instance, does not persist yet
    return this.usersRepository.save(user); // INSERT
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // reuse for the 404 check
    Object.assign(user, dto);
    return this.usersRepository.save(user); // UPDATE, since the entity already has an id
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  async findWithOrders(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { profile: true }, // explicit relation loading — no silent eager joins
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
```

```typescript
// users/users.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

Notice `create()` uses `repository.create(dto)` (build an in-memory entity instance) followed by `repository.save(user)` (persist it) — two distinct steps, unlike `repository.save(dto)` directly, which also works for simple cases but skips any entity-level default values or computed properties that only apply after `create()` instantiates a real `User`.

---

## 10. Common Pitfalls

**Leaving `synchronize: true` on in production.** `synchronize` makes TypeORM auto-alter your database schema to match your entities on every application boot. It's convenient in early local development but is effectively "yes, silently drop and recreate columns/tables to match whatever the code currently says" — a single bad entity change can destroy production data. Always set `synchronize: false` outside of local dev/test and use migrations instead (see lesson 3).

**Forgetting the inverse-side property function must match exactly.** `@OneToMany(() => Order, (order) => order.customer)` breaks silently — either at startup with a mapping error or, worse, by creating an unintended second FK column — if `Order` doesn't have a property literally named `customer`.

**Expecting relations to load automatically.** Unlike JPA's EAGER defaults, TypeORM never auto-joins related entities unless you pass `relations: [...]` (or a query builder join) or explicitly mark the relation `{ eager: true }` in the decorator. A very common bug is calling `findOne()` and then accessing `user.orders`, getting `undefined`, and assuming a mapping error — when in fact the relation simply wasn't requested.

**Not re-exporting `TypeOrmModule` from a feature module.** If module B needs to inject `Repository<User>` (declared in module A), module A must both import `TypeOrmModule.forFeature([User])` *and* list `TypeOrmModule` in its own `exports` array — otherwise Nest throws an "UnknownDependenciesException" at bootstrap.

**Calling `repository.save(dto)` with a partial DTO on update, wiping unset fields.** `save()` performs an upsert based on whether the entity has a primary key — but if you pass a bare partial object without first loading and merging the existing row (as in `update()` above via `findOne` + `Object.assign`), any columns the DTO omits may be overwritten with `undefined`/defaults depending on driver behavior. Always load-then-merge for partial updates, or use `repository.update(id, dto)` for a true partial `UPDATE ... SET` that only touches the given columns.

---

## 11. Best Practices

- Never enable `synchronize: true` outside of local development or ephemeral test databases; use the migration workflow for every real environment.
- Default relationship loading to explicit (`relations: [...]`) rather than `{ eager: true }` on the entity, so any given query's cost is visible at the call site instead of hidden in the entity definition.
- Prefer `@PrimaryGeneratedColumn('uuid')` for any entity whose ID might be exposed externally (URLs, APIs) to avoid leaking sequential row counts/growth rate.
- Keep DTOs (`class-validator`-annotated input shapes) separate from entities — never accept a raw `@Entity()` class as a controller's `@Body()` type, since that exposes internal columns (like `id`, `createdAt`) to client-controlled input.
- Use `repository.update(id, partialDto)` for straightforward partial updates and reserve load-then-`save()` for cases where you need entity-level hooks (`@BeforeUpdate`, etc.) or validation against the full loaded entity.
- Always specify `onDelete`/`onUpdate` behavior explicitly on `@ManyToOne`/`@OneToOne` foreign keys (`CASCADE`, `SET NULL`, `RESTRICT`) rather than relying on the database default, which varies by driver.
- Put all entity classes under a consistent `*.entity.ts` naming convention so the `entities: [__dirname + '/**/*.entity{.ts,.js}']` glob (or `autoLoadEntities`) reliably picks them up.

---

## 12. Hands-On Exercises

**Exercise 1:** Scaffold a `Category` and `Product` pair with a `@OneToMany`/`@ManyToOne` relationship (one Category has many Products). Register both via `TypeOrmModule.forFeature`, build a `ProductsService` with `create`, `findAll`, and `findOne` methods, and confirm that `findOne` does *not* return the related `Category` unless you pass `relations: { category: true }`.

**Exercise 2:** Convert a hardcoded `TypeOrmModule.forRoot()` config to `forRootAsync()` driven by `ConfigService`, reading `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from a `.env` file via `@nestjs/config`. Verify the app still connects after the change.

**Exercise 3:** Build a `Tag`/`Product` `@ManyToMany` relationship with an explicit `@JoinTable`. Then extend the join table with an `addedAt` timestamp column, discover that plain `@ManyToMany` cannot express it, and refactor into an explicit `ProductTag` association entity with two `@ManyToOne`s instead.

**Exercise 4:** Add a `@OneToOne` relationship between `User` and `Profile`, with `Profile` owning the foreign key via `@JoinColumn()`. Write a service method that creates a `User` and its `Profile` together, then fetch the `User` back with and without `relations: { profile: true }` and observe the difference.

**Exercise 5:** Deliberately introduce a mismatched `mappedBy`-equivalent (change `(order) => order.customer` to reference a property that doesn't exist on `Order`) and observe the startup error TypeORM throws. Fix it and note what the error message actually told you, versus what the real bug was.

---

## 13. Interview Q&A

**Q: What is the difference between `TypeOrmModule.forRoot()` and `TypeOrmModule.forFeature()`?**
Answer: `forRoot()` (or `forRootAsync()`) configures and registers the actual database connection — the `DataSource` — typically once in the root module. `forFeature([Entity, ...])` is called in each feature module to register which specific entities that module works with, which is what makes `@InjectRepository(Entity)` resolvable within that module's providers. `forRoot` sets up the connection; `forFeature` scopes entity repositories to individual modules for cleaner boundaries.

**Q: Why does `@nestjs/typeorm` favor injecting a `Repository<T>` instead of using TypeORM's Active Record pattern?**
Answer: The Data Mapper pattern (separate `Repository` objects, plain entity classes) fits Nest's dependency-injection-centric architecture better than Active Record, where entities carry their own `.save()`/`.remove()` methods. Injecting `Repository<T>` through the constructor keeps persistence logic mockable in unit tests (you can substitute a fake repository), keeps entities as plain, easily-serializable data classes, and matches the same separation of concerns Nest encourages everywhere else via providers and DI tokens.

**Q: How do you decide which side of a `@OneToMany`/`@ManyToOne` relationship is the "owning" side?**
Answer: The owning side is always the side whose database table physically stores the foreign key column — for a Customer/Order relationship, that's the `orders` table (`customer_id`), so `Order.customer` is the owning `@ManyToOne`. The inverse side, `Customer.orders`, is declared with `@OneToMany(() => Order, (order) => order.customer)`, where the second argument points back at the owning side's property name. Only the owning side can carry `@JoinColumn()`; the inverse side never does.

**Q: Why is leaving `synchronize: true` enabled in production dangerous?**
Answer: `synchronize: true` makes TypeORM inspect your entity definitions on every application startup and automatically alter the live database schema to match — adding, renaming, or dropping columns and tables as needed. In production this means a bad entity change (a typo'd column name, a removed field) can silently drop or alter real data the moment the app restarts, with no review step and no rollback path. Migrations (`typeorm migration:generate`/`migration:run`) give you an explicit, versioned, reviewable, reversible alternative — which is why `synchronize` should be `false` everywhere except local/test environments.

**Q: Does TypeORM eagerly load relationships by default, the way JPA does for `@ManyToOne`/`@OneToOne`?**
Answer: No — unlike the JPA specification, which defaults `@ManyToOne` and `@OneToOne` to EAGER loading, TypeORM never automatically joins or fetches a related entity unless you either pass `relations: [...]` in the query options, use a query builder's `leftJoinAndSelect`, or explicitly set `{ eager: true }` on the relationship decorator itself. This avoids the classic "EAGER fetch chain" problem out of the box, but it also means a common beginner bug is calling `findOne()`, then accessing a related property and getting `undefined` because the relation was never requested.

**Q: When would you model a many-to-many relationship as a separate association entity instead of using `@ManyToMany` directly?**
Answer: Whenever the join table itself needs to carry additional data beyond the two foreign keys — for example, an `enrolledAt` timestamp on a Student-Course enrollment, or an `addedBy` field on a Product-Tag assignment. A plain `@ManyToMany` (with `@JoinTable`) can only represent a bare join table with two FK columns; as soon as extra columns are needed, the join table needs its own identity and query surface, so you model it as its own `@Entity` with two `@ManyToOne` relationships pointing at each side — the same "association entity" pattern used in JPA/Hibernate.
