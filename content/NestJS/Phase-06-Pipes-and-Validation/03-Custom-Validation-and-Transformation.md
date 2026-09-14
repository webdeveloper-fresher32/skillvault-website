# Custom Validation & Transformation — Complete Guide

## Table of Contents
1. [Why Go Beyond Built-In Decorators](#1-why-go-beyond-built-in-decorators)
2. [Writing a Custom Validation Decorator with @ValidatorConstraint](#2-writing-a-custom-validation-decorator-with-validatorconstraint)
3. [Async Validators — Checking DB Uniqueness](#3-async-validators--checking-db-uniqueness)
4. [Worked Example — @IsUnique('users', 'email')](#4-worked-example--isuniqueusers-email)
5. [class-transformer for Response Shaping](#5-class-transformer-for-response-shaping)
6. [@Expose, @Exclude, and @Transform](#6-expose-exclude-and-transform)
7. [ClassSerializerInterceptor](#7-classserializerinterceptor)
8. [Worked Example — Hiding a Password Field in Responses](#8-worked-example--hiding-a-password-field-in-responses)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Go Beyond Built-In Decorators

The stock `class-validator` decorators (`@IsEmail()`, `@IsInt()`, `@Min()`, etc.) cover shape and format checks, but two categories of validation need are common in production APIs and aren't covered out of the box:

1. **Cross-field or domain-specific rules** that don't map to a single reusable built-in — e.g., "confirm password must match password," "start date must be before end date," "value must be a valid product SKU format specific to our catalog."
2. **Validation that depends on external state** — most commonly, checking a database. "Is this email already registered?" cannot be answered by inspecting the DTO alone; it requires a query.

`class-validator` supports both via **custom validation constraints**, built with the `@ValidatorConstraint()` decorator and the `ValidatorConstraintInterface`. Crucially, these constraints can be either synchronous or asynchronous, and — because they're plain injectable classes — they can have services (like a repository) injected into them via NestJS's DI container.

Separately, on the *output* side, **class-transformer** gives you decorators (`@Expose()`, `@Exclude()`, `@Transform()`) to control exactly what shape of data leaves your API when a class instance is serialized to JSON — most commonly used to strip sensitive fields like password hashes out of response bodies without needing separate manually-maintained "response DTOs" for every entity.

---

## 2. Writing a Custom Validation Decorator with @ValidatorConstraint

A custom validator has two parts: a class implementing `ValidatorConstraintInterface`, decorated with `@ValidatorConstraint()`, and a decorator factory function that attaches it to a property.

```typescript
// validators/is-strong-password.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);
    return value.length >= 8 && hasUpper && hasLower && hasDigit;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at least 8 characters and include an uppercase letter, a lowercase letter, and a digit`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
```

Usage on a DTO is indistinguishable from any built-in decorator:

```typescript
// dto/create-user.dto.ts
import { IsEmail } from 'class-validator';
import { IsStrongPassword } from '../validators/is-strong-password.validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;
}
```

`registerDecorator()` is `class-validator`'s bridge between "a decorator applied to a property" and "a constraint class that knows how to validate it." The `constraints` array lets you pass compile-time arguments into the decorator (e.g., `@IsStrongPassword({ minLength: 10 })` could pass `[10]` through to `args.constraints`), which the validator's `validate()` method can read via `args.constraints`.

---

## 3. Async Validators — Checking DB Uniqueness

Setting `async: true` in `@ValidatorConstraint()` tells `class-validator` that `validate()` returns a `Promise<boolean>`. This is what makes DB-backed checks possible — and because the constraint class is a normal `@Injectable()`, NestJS's DI container can inject a repository or service into it, **provided the constraint class is itself registered as a provider in a module** (this is the one non-obvious wiring step async, DI-aware validators require).

```typescript
// validators/is-unique.validator.ts
import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository('EntityRegistry') // resolved dynamically per decorator args — see Section 4
    private readonly repositories: Map<string, Repository<any>>,
  ) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    const [entityName, field] = args.constraints as [string, string];
    const repository = this.repositories.get(entityName);
    if (!repository) return true; // fail open only in dev misconfiguration — see pitfalls
    const existing = await repository.findOne({ where: { [field]: value } });
    return !existing;
  }

  defaultMessage(args: ValidationArguments): string {
    const [entityName, field] = args.constraints as [string, string];
    return `${field} "${args.value}" is already taken`;
  }
}
```

The example above sketches a generic repository-map lookup; Section 4 shows a simpler, more common pattern that injects a specific service directly rather than a generic registry — the generic version above is included to show that `@InjectRepository`-style DI works fine inside a validator constraint as long as it's a properly registered provider.

Because async validators return promises, `class-validator`'s `validate()` function (the one `ValidationPipe` calls internally) automatically awaits all constraints — no special configuration is needed on the `ValidationPipe` side beyond what's already covered in lesson 2.

---

## 4. Worked Example — @IsUnique('users', 'email')

A cleaner, commonly-used pattern: inject the specific service the validator needs directly, and pass the entity/field names as decorator arguments purely for the error message and for reuse across multiple entities if the service exposes a generic lookup method.

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async existsByField(field: keyof User, value: unknown): Promise<boolean> {
    const count = await this.userRepository.count({ where: { [field]: value } as any });
    return count > 0;
  }
}
```

```typescript
// validators/is-unique.validator.ts
import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { UsersService } from '../users/users.service';

@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly usersService: UsersService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    const [, field] = args.constraints as [string, string];
    const alreadyExists = await this.usersService.existsByField(field as any, value);
    return !alreadyExists;
  }

  defaultMessage(args: ValidationArguments): string {
    const [, field] = args.constraints as [string, string];
    return `${field} "${args.value}" is already registered`;
  }
}

export function IsUnique(
  entity: string,
  field: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [entity, field],
      validator: IsUniqueConstraint,
    });
  };
}
```

```typescript
// dto/create-user.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { IsUnique } from '../validators/is-unique.validator';

export class CreateUserDto {
  @IsEmail()
  @IsUnique('users', 'email')
  email: string;

  @IsString()
  password: string;
}
```

Registering the constraint as a provider is the step easiest to forget — `IsUniqueConstraint` must appear in the `providers` array of the module that owns `UsersService` (or `AppModule`) for its constructor injection to resolve:

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { IsUniqueConstraint } from '../validators/is-unique.validator';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, IsUniqueConstraint],
})
export class UsersModule {}
```

With this wired up, `POST /users` with an email already present in the database fails validation with `400: email "priya@example.com" is already registered` — before `UsersController.create()` is ever invoked, and without the controller or service needing any explicit uniqueness-checking code of their own.

---

## 5. class-transformer for Response Shaping

Just as `class-transformer` converts incoming plain objects into DTO instances (lesson 2), it also runs in the opposite direction — converting a class instance back into a plain object suitable for JSON serialization, applying decorators that control which properties survive that conversion. This is the mechanism NestJS uses to let you return a full entity instance (e.g., a TypeORM `User` with a `passwordHash` field) from a controller while guaranteeing sensitive fields never appear in the actual HTTP response.

```
  Entity instance (has passwordHash)          Serialized response (no passwordHash)
  ────────────────────────────────             ──────────────────────────────────
  User {                                       {
    id: 1,                                       "id": 1,
    email: "a@b.com",                            "email": "a@b.com",
    passwordHash: "$2b$10$..."     ──────▶        "name": "Alice"
    name: "Alice"                                }
  }
```

This transformation is driven by `class-transformer`'s `instanceToPlain()` function, invoked automatically by NestJS's `ClassSerializerInterceptor` on every response (when applied).

---

## 6. @Expose, @Exclude, and @Transform

### @Exclude()

Marks a property to be removed from the serialized output. Applied on the entity/response-shaping class.

```typescript
import { Exclude } from 'class-transformer';

export class User {
  id: number;
  email: string;
  name: string;

  @Exclude()
  passwordHash: string;
}
```

### @Expose()

Two uses: marking a property to be *included* when the class uses `@Exclude()` at the class level (opt-in mode instead of opt-out), or exposing a computed/virtual property that doesn't exist as a real class field.

```typescript
import { Exclude, Expose } from 'class-transformer';

@Exclude() // opt-in mode: nothing is exposed unless explicitly marked
export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  get displayName(): string {
    return this.name.toUpperCase();
  }

  name: string; // NOT exposed — no @Expose(), and class-level @Exclude() hides it by default
}
```

### @Transform()

Runs an arbitrary function against a property's value during serialization — useful for formatting, redaction, or deriving a value.

```typescript
import { Exclude, Transform } from 'class-transformer';

export class User {
  id: number;
  email: string;

  @Exclude()
  passwordHash: string;

  @Transform(({ value }) => new Date(value).toISOString().split('T')[0])
  createdAt: Date;

  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullName: string;
}
```

`@Transform()` receives an options object with `value` (the raw property value) and `obj` (the entire source object), letting transforms be computed from sibling fields as shown in `fullName` above.

---

## 7. ClassSerializerInterceptor

Decorators like `@Exclude()` only take effect when something actually runs `instanceToPlain()` against the response. NestJS provides `ClassSerializerInterceptor` to do this automatically for every response that leaves a controller (or a specific route/controller, depending on scope), inspecting the returned value's decorators and applying them before the JSON is sent to the client.

```typescript
// main.ts — apply globally
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.listen(3000);
}
bootstrap();
```

Or scoped to a single controller/handler:

```typescript
import { Controller, Get, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  // ...
}
```

`ClassSerializerInterceptor` is an interceptor, not a pipe — it runs on the response side of the pipeline (the "post-handler" phase from lesson 1's pipeline diagram), which is exactly where response shaping belongs: after the handler has produced its result, before that result is sent back over the wire.

**Critical requirement:** the value returned by the handler must actually be an instance of the class carrying the decorators — not a plain object. If a repository or ORM already returns real entity instances (as TypeORM does by default), this works automatically. If you build a plain object literal by hand (`return { id: user.id, email: user.email }`), there are no decorators attached because it's not a class instance, and `ClassSerializerInterceptor` has nothing to act on — it will pass such a plain object through unchanged.

---

## 8. Worked Example — Hiding a Password Field in Responses

Full worked example: a `User` entity with a hidden password hash, served through a controller with global serialization enabled.

```typescript
// users/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  @Exclude()
  passwordHash: string;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
```

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    return this.userRepository.save(user);
  }

  async findOne(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}
```

```typescript
// users/users.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, UseInterceptors } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return user; // real User entity instance — passwordHash will be stripped automatically
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id); // same guarantee applies here
  }
}
```

`POST /users` response body, despite `create()` returning the full entity including `passwordHash`:

```json
{
  "id": 7,
  "email": "priya@example.com",
  "name": "Priya Nair"
}
```

The `passwordHash` field never appears — `ClassSerializerInterceptor` intercepted the returned `User` instance, ran `instanceToPlain()` against it, saw the `@Exclude()` decorator, and stripped the field before NestJS's response pipeline serialized the result to JSON. No manual "response DTO mapping" code was needed in the controller or service.

---

## 9. Common Pitfalls

- **Forgetting to register a DI-aware validator constraint as a provider.** `IsUniqueConstraint` (or any async validator injecting a service) must be listed in a module's `providers` array. If it isn't, Nest either throws a dependency-resolution error at startup or, in some misconfigurations, silently fails to inject the dependency, making the validator effectively broken.
- **Returning plain objects from a controller and expecting `ClassSerializerInterceptor` to still strip fields.** `@Exclude()` only has an effect on real class instances passed through `instanceToPlain()`. `return { id: user.id, passwordHash: user.passwordHash }` is a plain object literal — it has no attached class metadata, so the interceptor passes it through completely unchanged, `passwordHash` included.
- **Applying `@Expose()` at the property level while forgetting the class-level `@Exclude()`.** Without a class-level `@Exclude()`, `class-transformer` defaults to exposing everything, making per-property `@Expose()` a no-op — remember `@Expose()`'s opt-in behavior only kicks in once the class itself is opted out by default.
- **Not applying `ClassSerializerInterceptor` at all** and assuming `@Exclude()` decorators are enforced automatically just by being present on the entity — the decorator is inert metadata until an interceptor (or a manual `instanceToPlain()` call) actually processes the returned value.
- **Async validators without proper error handling for a failing DB call.** If the query inside `validate()` throws (e.g., connection error), the entire validation call rejects, and the failure surfaces as an unhandled promise rejection rather than a clean validation error — wrap DB calls in try/catch and decide explicitly whether a DB failure should fail-open (treat as valid — risky) or fail-closed (treat as invalid — safer default) for uniqueness-style checks.
- **Confusing entity-level `@Exclude()` with DTO-level whitelisting from lesson 2.** These solve different problems: `whitelist`/`forbidNonWhitelisted` govern what's accepted on the way *in* (request body), while `@Exclude()`/`ClassSerializerInterceptor` govern what's sent on the way *out* (response body). Both are necessary; neither substitutes for the other.

---

## 10. Best Practices

- **Register async validator constraints as providers in the module that owns their dependencies**, and keep their DB queries narrow and indexed (a uniqueness check should be a single indexed lookup, not a full scan).
- **Decide and document a fail-open vs. fail-closed policy** for async validators when the underlying check errors out — silently treating a failed check as "valid" can let bad data through during an outage.
- **Use `@Exclude()` directly on entities for fields that should never leave the API** (password hashes, internal tokens, soft-delete flags) rather than relying on controllers to remember to omit them manually — the entity is the single source of truth for what's sensitive.
- **Register `ClassSerializerInterceptor` globally** in `main.ts` rather than per-controller, so no new controller can accidentally leak a sensitive field by forgetting to apply the interceptor.
- **Prefer dedicated response DTOs with `@Expose()` (opt-in) over ad hoc `@Exclude()` on entities** for complex APIs with many consumers — an opt-in shape is more resistant to accidentally leaking a newly-added entity field, since new fields aren't exposed unless someone explicitly adds `@Expose()`.
- **Never rely on TypeScript types alone to guarantee runtime shape.** All of `class-validator`/`class-transformer`'s guarantees are runtime, decorator-driven metadata checks — a `private` or type-annotated-only field provides zero actual protection against leaking or accepting unwanted data.
- **Test custom validators and serialization behavior explicitly** (unit test the constraint's `validate()` method directly, and an integration/e2e test asserting a sensitive field is genuinely absent from a real HTTP response body) rather than trusting that decorators "look right" in the source.

---

## 11. Hands-On Exercises

**Exercise 1:** Implement `IsStrongPassword` exactly as shown in Section 2 and apply it to a `password` field on a `CreateUserDto`. Test it against a weak password (`"abc"`), a password missing a digit (`"Abcdefgh"`), and a valid one (`"Abcdef1!"`), confirming the correct pass/fail result and error message for each.

**Exercise 2:** Build the full `@IsUnique('users', 'email')` validator from Section 4, backed by a real (or in-memory mock) `UsersService`. Register `IsUniqueConstraint` in `UsersModule`'s providers. Seed one existing user, then confirm a `POST /users` with that same email fails validation with a `400`, while a request with a new email succeeds.

**Exercise 3:** Deliberately forget to register `IsUniqueConstraint` in the module's `providers` array and observe what happens at application startup or at request time. Then fix it by adding the registration and confirm the validator starts working — this builds intuition for the exact failure mode of the most common async-validator wiring mistake.

**Exercise 4:** Add a `passwordHash` field to a `User` entity, decorate it with `@Exclude()`, and register `ClassSerializerInterceptor` globally in `main.ts`. Confirm via an actual HTTP request (curl or REST client) that a `GET /users/:id` response never contains `passwordHash`, even though the service method returns the full entity. Then temporarily remove the interceptor registration and confirm the field reappears in the response, proving the interceptor — not the decorator alone — is what enforces the exclusion.

**Exercise 5:** Create a `UserResponseDto` using class-level `@Exclude()` with individual `@Expose()` properties for `id`, `email`, and a computed `@Expose() get accountAgeDays()` derived from a `createdAt` field via a getter. Return instances of this DTO (constructed with `new UserResponseDto(user)` or via `plainToInstance`) from a controller instead of the raw entity, and confirm the response contains exactly the exposed fields — nothing more, nothing less — even after adding a new unrelated field to the underlying `User` entity.

---

## 12. Interview Q&A

**Q: How do you write a custom validation rule in NestJS that isn't covered by class-validator's built-in decorators?**
Answer: You create a class implementing `ValidatorConstraintInterface`, decorated with `@ValidatorConstraint()`, which defines a `validate(value, args)` method returning a boolean (or `Promise<boolean>` for async constraints) and a `defaultMessage(args)` method for the error text. You then write a decorator factory function that calls `class-validator`'s `registerDecorator()`, linking a property decorator (e.g., `@IsStrongPassword()`) to that constraint class. Once registered, the custom decorator is applied to DTO properties exactly like any built-in one, and is checked automatically by the global `ValidationPipe`.

**Q: How do you implement an async validator that checks database uniqueness, and what's the one wiring step people most often forget?**
Answer: Set `async: true` in the `@ValidatorConstraint()` decorator so `class-validator` awaits the constraint's `validate()` method, which returns a `Promise<boolean>` after querying a repository or service for an existing record. Because the constraint class can have services injected into its constructor via Nest's DI container, it must be decorated `@Injectable()` and — this is the step most often forgotten — explicitly listed in the `providers` array of the module that owns its dependencies. Skipping that registration leaves the constructor's injected service unresolved, breaking the validator silently or causing a startup dependency-resolution error.

**Q: What's the difference between `@Expose()` and `@Exclude()` in class-transformer, and how do they interact?**
Answer: `@Exclude()` removes a property from serialized output; applied at the class level, it flips the default from "expose everything" to "expose nothing unless explicitly marked." `@Expose()` marks a specific property (or getter) to be included in the output — it's a no-op by itself unless the class is already in "exclude everything by default" mode (via a class-level `@Exclude()`), in which case `@Expose()` becomes the opt-in mechanism per property. A common pattern is applying `@Exclude()` at the class level and `@Expose()` on each field you deliberately want visible, which is safer against accidentally leaking newly-added entity fields than the reverse (exposing everything and excluding sensitive fields one by one).

**Q: What role does `ClassSerializerInterceptor` play, and why won't `@Exclude()` alone hide a field from an HTTP response?**
Answer: `@Exclude()` (and `@Expose()`/`@Transform()`) are inert metadata until something actually invokes `class-transformer`'s `instanceToPlain()` against the returned object. `ClassSerializerInterceptor` is the NestJS interceptor that does exactly this automatically on the way out of every route handler (or a scoped subset, depending on where it's applied) — it inspects the value the handler returned, and if it's a class instance carrying these decorators, transforms it into a plain object with the appropriate fields stripped or transformed before the response is serialized to JSON. Without registering the interceptor, the decorators exist on the entity class but nothing ever applies them, so excluded fields remain in the response.

**Q: Why does `ClassSerializerInterceptor` fail to strip a field if the controller returns a plain object literal instead of the actual entity/class instance?**
Answer: `@Exclude()`/`@Expose()` decorators attach metadata to a specific class's properties via `reflect-metadata`. `instanceToPlain()` (which `ClassSerializerInterceptor` calls) relies on the input actually being an instance of that class to look up its metadata. A plain object literal built by hand, like `return { id: user.id, email: user.email }`, carries no class identity and therefore no attached decorator metadata — `instanceToPlain()` has nothing to check and passes the object through unchanged. This is why entities (or DTOs constructed via `new` or `plainToInstance()`) must be returned directly from handlers for the serialization decorators to have any effect.

**Q: How would you decide whether an async uniqueness validator should "fail open" or "fail closed" if its database query throws an error?**
Answer: This is a deliberate policy decision, not a default class-validator provides. Failing closed (treating the value as invalid/rejecting the request when the check errors) is the safer default for most uniqueness or security-sensitive checks, since it prevents bad data (e.g., a duplicate email, or a value that should have been checked against a blocklist) from slipping through during a transient DB outage. Failing open (treating an error as "valid") might be acceptable for lower-stakes, non-critical validations where availability matters more than strictness, but should be an explicit, documented choice — wrapping the query in a try/catch and choosing the behavior deliberately, rather than letting an unhandled rejection propagate as an unrelated 500 error.
