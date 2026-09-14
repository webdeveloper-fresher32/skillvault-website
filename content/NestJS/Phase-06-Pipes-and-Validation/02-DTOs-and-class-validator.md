# DTOs & class-validator — Complete Guide

## Table of Contents
1. [Why DTOs](#1-why-dtos)
2. [Creating a DTO Class](#2-creating-a-dto-class)
3. [class-validator Decorators Reference](#3-class-validator-decorators-reference)
4. [Nested Validation with ValidateNested and Type](#4-nested-validation-with-validatenested-and-type)
5. [Worked Example — CreateUserDto with Nested Address](#5-worked-example--createuserdto-with-nested-address)
6. [The Global ValidationPipe](#6-the-global-validationpipe)
7. [whitelist, forbidNonWhitelisted, and transform Explained](#7-whitelist-forbidnonwhitelisted-and-transform-explained)
8. [Wiring It All Together](#8-wiring-it-all-together)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why DTOs

A **DTO (Data Transfer Object)** is a plain class that describes the shape of data crossing a boundary — most commonly, the shape of an incoming request body or query string. In NestJS, DTOs are not just documentation; they are the mechanism by which the framework knows *what to validate against*.

```
  Without a DTO                          With a DTO + class-validator
  ──────────────                          ─────────────────────────────
  @Post()                                 @Post()
  create(@Body() body: any) {             create(@Body() dto: CreateUserDto) {
    // no guarantee body has              // ValidationPipe checks dto against
    // any particular shape               // CreateUserDto's decorators before
    // manual if-checks everywhere        // this line ever runs
  }                                       }
```

DTOs solve three problems at once:
1. **Type safety** inside the handler — TypeScript knows `dto.email` is a `string`, not `any`.
2. **A single source of truth for validation rules** — decorators on the class describe exactly what "valid" means, instead of scattering `if` checks through handler bodies.
3. **Runtime enforcement** — combined with the global `ValidationPipe`, the DTO's decorators are actually checked against every incoming request, not just referenced by the type system (which disappears at runtime).

NestJS's ecosystem pairs two libraries with DTOs: **class-validator** (adds decorators like `@IsEmail()`, `@IsInt()` that describe validation rules) and **class-transformer** (converts plain JSON objects into instances of your DTO class, and vice versa for serialization — covered in depth in lesson 3).

---

## 2. Creating a DTO Class

A DTO is just a class — no special base class or interface required. Convention is to suffix the name with `Dto` and keep one file per DTO under a `dto/` folder inside the feature module.

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  name: string;
  email: string;
  age: number;
}
```

As written, this class carries zero runtime behavior — it's purely a TypeScript-time shape. TypeScript's type erasure means none of this exists once compiled to JavaScript; the class only becomes runtime-meaningful once you attach `class-validator` decorators to its properties, because those decorators register metadata (via `reflect-metadata`) that a `ValidationPipe` can later inspect.

```bash
npm install class-validator class-transformer
```

Both libraries are peer dependencies expected by `@nestjs/common`'s `ValidationPipe` — they are not bundled automatically and must be installed explicitly in every project.

---

## 3. class-validator Decorators Reference

Decorators are applied directly to class properties. Here are the ones you'll reach for constantly:

| Decorator                  | Checks                                                          |
|------------------------------|--------------------------------------------------------------------|
| `@IsString()`               | Value is a string                                                  |
| `@IsEmail()`                | Value is a syntactically valid email address                       |
| `@IsInt()`                  | Value is an integer (fails for `"5"` unless combined with `transform`) |
| `@IsNumber()`               | Value is a number (optionally restrict decimal places via options) |
| `@IsBoolean()`              | Value is a boolean                                                  |
| `@Min(n)` / `@Max(n)`       | Numeric value is `>= n` / `<= n`                                    |
| `@MinLength(n)` / `@MaxLength(n)` | String length bounds                                          |
| `@IsOptional()`             | Skips all other validators on this property if the value is `undefined` or `null` |
| `@IsNotEmpty()`             | Value is not `''`, `null`, or `undefined`                          |
| `@IsEnum(EnumType)`         | Value is one of the enum's members                                  |
| `@IsArray()`                | Value is an array                                                   |
| `@ArrayMinSize(n)` / `@ArrayMaxSize(n)` | Array length bounds                                     |
| `@IsDateString()`           | Value is an ISO 8601 date string                                     |
| `@IsUUID()`                 | Value is a valid UUID                                               |
| `@Matches(regex)`           | Value matches a regular expression                                  |
| `@ValidateNested()`         | Recursively validates a nested object/class (requires `@Type()`)   |

Example applying several of these:

```typescript
// dto/create-user.dto.ts
import { IsString, IsEmail, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  @Max(120)
  age: number;

  @IsOptional()
  @IsString()
  bio?: string;
}
```

Multiple decorators on one property combine with AND semantics — `age` must be both an integer AND between 18 and 120. `@IsOptional()` is special: it short-circuits the *rest* of the decorators on that property when the value is missing, so `bio` is validated as a string only if it was actually provided.

---

## 4. Nested Validation with ValidateNested and Type

`class-validator` only validates the *direct* properties of the object it's given by default — it does not automatically recurse into nested objects, even if those nested objects are themselves DTO classes with their own decorators. Two things are required to make nested validation work:

1. **`@ValidateNested()`** on the parent property, telling `class-validator` to recurse into it.
2. **`@Type(() => NestedDto)`** from `class-transformer`, telling the transformation layer what class to instantiate the plain nested object as (JavaScript's type erasure means `class-validator` cannot infer this from TypeScript types alone at runtime — `@Type()` supplies it explicitly).

```typescript
// dto/address.dto.ts
import { IsString, IsPostalCode } from 'class-validator';

export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsPostalCode('any')
  postalCode: string;
}
```

```typescript
// dto/create-user.dto.ts (with nested address)
import { IsString, IsEmail, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from './address.dto';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}
```

Without `@Type(() => AddressDto)`, the incoming plain object `{ street, city, postalCode }` is never turned into an actual `AddressDto` instance — it stays a plain object, and `@ValidateNested()` has nothing to recurse into meaningfully, so nested validation errors are silently skipped even though the decorator is present. This is one of the single most common validation bugs in real NestJS codebases.

For arrays of nested objects, combine `@ValidateNested({ each: true })` with `@Type()`:

```typescript
export class CreateOrderDto {
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
```

---

## 5. Worked Example — CreateUserDto with Nested Address

Full worked example: a user-registration DTO with a nested, validated address.

```typescript
// dto/address.dto.ts
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @Length(4, 10)
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}
```

```typescript
// dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from './address.dto';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  @Max(120)
  age: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}
```

```typescript
// users.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    // by the time this line runs, dto.address is a real AddressDto instance
    // and every field on both dto and dto.address has already been validated
    return this.usersService.create(dto);
  }
}
```

A valid request body:

```json
{
  "name": "Priya Nair",
  "email": "priya@example.com",
  "age": 29,
  "address": {
    "street": "12 MG Road",
    "city": "Bengaluru",
    "postalCode": "560001",
    "country": "India"
  }
}
```

A request with `address.postalCode` missing, or `address.city` set to `""`, is rejected with a `400` before `create()` runs — but **only** if the global `ValidationPipe` is configured correctly, which is the subject of the next section.

---

## 6. The Global ValidationPipe

`ValidationPipe` is a built-in pipe (`@nestjs/common`) that, when applied to an argument whose `metatype` is a class, runs `class-validator`'s `validate()` function against an instance of that class. It is almost always registered globally, once, in `main.ts`:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

Internally, for each incoming `@Body()` (or other decorated) argument, `ValidationPipe`:
1. Checks `ArgumentMetadata.metatype` — if it's a primitive (`String`, `Boolean`, `Number`, `Array`, `Object`) or absent, it skips validation entirely and passes the value through unchanged.
2. Uses `class-transformer`'s `plainToInstance()` to convert the raw parsed JSON object into an actual instance of the DTO class (this is what makes `@Type()`-annotated nested objects become real class instances, and is a prerequisite for `@ValidateNested()` to do anything).
3. Runs `class-validator`'s `validate()` against that instance, collecting any constraint violations.
4. If there are violations, throws a `BadRequestException` with a structured error payload; otherwise, passes the (possibly transformed) instance on to the handler.

---

## 7. whitelist, forbidNonWhitelisted, and transform Explained

These three options are the ones that matter most in production and are worth understanding individually rather than copy-pasting.

### `whitelist: true`

Strips any properties from the incoming object that do not have at least one `class-validator` decorator on the DTO. Without this, a client can send extra fields — `{ "name": "x", "email": "y", "isAdmin": true }` against a DTO with no `isAdmin` property — and those extra fields pass straight through to your service/database layer untouched, potentially letting a client set fields it should never control (a classic mass-assignment vulnerability).

```
  whitelist: false (default)             whitelist: true
  ───────────────────────────             ─────────────────
  Incoming: { name, email, isAdmin }      Incoming: { name, email, isAdmin }
  dto received by handler:                dto received by handler:
    { name, email, isAdmin }  ← leaked       { name, email }  ← isAdmin stripped
```

### `forbidNonWhitelisted: true`

Only meaningful in combination with `whitelist: true`. Instead of silently stripping unrecognized properties, it makes the request fail with a `400 Bad Request` listing the offending property names. This is stricter and surfaces client bugs (typos in field names, stale API contracts) immediately rather than silently dropping data the client thought was being sent.

```
  whitelist: true, forbidNonWhitelisted: false (default)
  → extra fields silently dropped, request succeeds

  whitelist: true, forbidNonWhitelisted: true
  → extra fields cause 400: "property isAdmin should not exist"
```

### `transform: true`

Enables `class-transformer`'s `plainToInstance()` conversion of the incoming plain object into a real class instance, **and** applies implicit type conversion for primitive fields using the TypeScript type declared on the DTO (via `enableImplicitConversion` under the hood in recent Nest versions, when `transform` is on). This is what allows `@IsInt()` on a body field to succeed even though raw JSON numbers arrive correctly typed, and — more importantly — what makes route/query params typed as `number` in a DTO actually usable as numbers rather than strings. It is also a hard prerequisite for `@ValidateNested()` / `@Type()` nested DTOs to work at all, since without transformation the nested object is never instantiated as its DTO class.

```
  transform: false                        transform: true
  ────────────────                        ───────────────
  dto is a plain object                   dto is a real CreateUserDto instance
  dto.address is a plain object            dto.address is a real AddressDto instance
  dto instanceof CreateUserDto → false     dto instanceof CreateUserDto → true
  nested @ValidateNested() → unreliable    nested @ValidateNested() → works correctly
```

**Why all three matter together:** `whitelist` and `forbidNonWhitelisted` protect against over-posting/mass-assignment attacks and surface client-side contract mismatches. `transform` is what makes the DTO classes you wrote actually *be* the objects flowing through your app (rather than plain JSON blobs that happen to satisfy a TypeScript interface at compile time only) — and it's required infrastructure for nested validation and for automatic type coercion of primitives.

---

## 8. Wiring It All Together

The complete, production-typical setup:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // strip properties with no decorators
      forbidNonWhitelisted: true,   // ...and reject the request instead of silently stripping
      transform: true,              // turn plain objects into real class instances + coerce primitives
      transformOptions: {
        enableImplicitConversion: true, // let @IsInt() etc. accept correctly-typed query/param strings
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

With this in place, the `CreateUserDto` + `AddressDto` example from Section 5 works exactly as described: extra fields are rejected, missing/invalid nested address fields fail validation, and `dto.address` inside the handler is a genuine `AddressDto` instance rather than an untyped plain object.

---

## 9. Common Pitfalls

- **Forgetting `@Type()` on a `@ValidateNested()` property.** Without it, the nested plain object is never instantiated as its DTO class, so nested constraint violations are silently ignored even though `@ValidateNested()` is present and `transform: true` is set.
- **Setting `whitelist: true` without realizing it silently drops fields.** If a client's payload has a typo'd field name, it just vanishes with no error — pair with `forbidNonWhitelisted: true` in most APIs so the mistake surfaces as a `400` instead of a mysteriously-missing value downstream.
- **Not installing `class-transformer` alongside `class-validator`.** `ValidationPipe`'s `transform` option and all `@Type()`/nested behavior depend on `class-transformer`; forgetting to install it (or forgetting `reflect-metadata` is imported once, typically via `main.ts`'s first import or the Nest CLI's default `main.ts`) produces confusing runtime errors.
- **Expecting `@IsOptional()` to make a property optional in the TypeScript type sense.** `@IsOptional()` only affects runtime validation (skips other validators when the value is absent) — you must still mark the property `bio?: string` in TypeScript for compile-time optionality; the decorator and the `?` are two separate mechanisms serving two separate purposes.
- **Applying decorators to interfaces instead of classes.** `class-validator` decorators only work on class properties — interfaces are erased entirely at compile time and carry no runtime metadata for `reflect-metadata` to attach to. A DTO **must** be a class, never an `interface` or a `type` alias.
- **Assuming `transform: true` alone fixes number coercion for query/route params without `enableImplicitConversion`.** In several Nest/class-transformer version combinations, plain `transform: true` transforms the object shape but doesn't necessarily coerce primitive strings to numbers for query params unless implicit conversion is explicitly enabled — always test the specific combination of Nest and class-transformer versions you're on.

---

## 10. Best Practices

- **Always pair `whitelist: true` with `forbidNonWhitelisted: true`** in APIs where client contract drift should be visible rather than silently tolerated.
- **Never define a DTO as an `interface` — always a `class`.** Decorators (and by extension all runtime validation) require classes.
- **Keep one DTO per file, named consistently** (`create-user.dto.ts`, `update-user.dto.ts`), and use `PartialType(CreateUserDto)` from `@nestjs/mapped-types` for update DTOs instead of hand-duplicating every field as optional.
- **Always add `@Type(() => NestedDto)` whenever you add `@ValidateNested()`** — treat them as an inseparable pair, never one without the other.
- **Enable `transform: true` globally from day one** of a project — retrofitting it later after handlers have grown to assume plain objects (rather than DTO instances) tends to surface subtle behavior changes.
- **Validate at the boundary, trust internally.** Once past the `ValidationPipe`, service-layer code should not re-validate the same data — that's what makes the DTO boundary valuable in the first place.
- **Return structured, descriptive validation errors** — the default `ValidationPipe` error format (an array of per-property constraint messages) is usually fine for API consumers building form-validation UIs; avoid swallowing it behind a generic "Bad Request" message.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a `CreateUserDto` with `name` (`@IsString()`, `@IsNotEmpty()`), `email` (`@IsEmail()`), and `age` (`@IsInt()`, `@Min(18)`, `@Max(120)`). Wire up the global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`. Send a `POST` request missing `email` and confirm you get a `400` naming the specific missing/invalid field.

**Exercise 2:** Add an `AddressDto` (street, city, postalCode, country) and nest it into `CreateUserDto` via `@ValidateNested()` + `@Type(() => AddressDto)`. First test it *without* `@Type()` and confirm invalid nested fields (e.g., empty `city`) do NOT get rejected. Then add `@Type()` back and confirm the same invalid payload now correctly fails validation — this demonstrates exactly why `@Type()` is required.

**Exercise 3:** Send a request to your `CreateUserDto` endpoint with an extra field not defined on the DTO (e.g., `"role": "admin"`). With `whitelist: false` (default), confirm the extra field passes through into the object your handler receives (log `dto` to verify). Then set `whitelist: true` and confirm the field is silently stripped. Finally add `forbidNonWhitelisted: true` and confirm the same request now returns a `400` naming the disallowed property.

**Exercise 4:** Create an `UpdateUserDto` using `PartialType(CreateUserDto)` from `@nestjs/mapped-types` (`npm install @nestjs/mapped-types`) rather than redefining every field as optional by hand. Wire it to a `PATCH /users/:id` endpoint and confirm a request with only `{ "age": 30 }` validates successfully (since all fields are now optional) while an invalid `age` (e.g. `15`, below the `@Min(18)` constraint) still fails.

**Exercise 5:** Build a `CreateOrderDto` containing `items: OrderItemDto[]`, using `@ValidateNested({ each: true })` and `@Type(() => OrderItemDto)`, where `OrderItemDto` has `productId` (`@IsUUID()`) and `quantity` (`@IsInt()`, `@Min(1)`). Send a request with three items where the second item has `quantity: 0` and confirm the validation error correctly identifies which array index failed (class-validator's default error format includes the property path, e.g. `items.1.quantity`).

---

## 12. Interview Q&A

**Q: What is a DTO in NestJS and why must it be a class rather than an interface or type alias?**
Answer: A DTO (Data Transfer Object) is a class describing the shape of data crossing a boundary, typically an incoming request body. It must be a class because `class-validator`'s decorators (`@IsEmail()`, `@IsInt()`, etc.) attach runtime metadata to class properties via `reflect-metadata` — interfaces and type aliases are purely compile-time constructs that are fully erased by the TypeScript compiler, leaving nothing at runtime for a decorator to attach to or for `ValidationPipe` to inspect. Only a class produces the constructor and prototype that `class-validator` and `class-transformer` need to operate on at runtime.

**Q: Why does `@ValidateNested()` require `@Type(() => NestedDto)` to work correctly?**
Answer: `@ValidateNested()` tells `class-validator` to recurse into a property and validate it, but `class-validator` has no way to know, purely from the plain JSON object it receives, what class that nested value should be validated as an instance of — TypeScript's type annotations are erased at runtime. `@Type(() => NestedDto)`, from `class-transformer`, supplies that information explicitly, and is used by `ValidationPipe`'s `plainToInstance()` step (triggered by `transform: true`) to actually instantiate the nested plain object as a real `NestedDto` instance before validation runs. Without `@Type()`, the nested object stays a plain object, and its own decorators are never meaningfully checked.

**Q: Explain what `whitelist` and `forbidNonWhitelisted` do in the global `ValidationPipe`, and why they're usually enabled together.**
Answer: `whitelist: true` strips any incoming properties that don't have at least one `class-validator` decorator on the target DTO — this prevents mass-assignment style bugs where a client sends extra fields (like `isAdmin: true`) that silently flow through to the database layer. `forbidNonWhitelisted: true` changes that stripping behavior into an outright rejection: instead of silently dropping unrecognized fields, the request fails with a `400` naming the offending properties. They're usually enabled together because silent stripping alone can hide client bugs (typos, stale contracts) that are better surfaced immediately as validation errors rather than causing confusing "why didn't my field save" support tickets later.

**Q: What does the `transform` option on `ValidationPipe` actually do, and what breaks if it's left off?**
Answer: `transform: true` enables `class-transformer`'s conversion of the raw, plain-JSON request object into an actual instance of the target DTO class (via `plainToInstance()`), and — combined with `enableImplicitConversion` — coerces primitive values (like numeric route/query params) to the types declared on the DTO. Without it, the object reaching your handler is a plain object that merely satisfies the DTO's TypeScript shape at compile time, not an actual instance of the class; `instanceof` checks against the DTO fail, nested `@ValidateNested()`/`@Type()` validation becomes unreliable since nested objects are never instantiated as their own DTO classes, and numeric query params typed as `number` in the DTO may arrive as strings.

**Q: How would you handle "extra unknown fields should be rejected" versus "extra unknown fields should just be dropped silently" as two different API policies?**
Answer: Both are controlled by the `whitelist` and `forbidNonWhitelisted` options on `ValidationPipe`. `whitelist: true` alone silently drops any property without a corresponding decorator on the DTO, giving you the "drop silently" behavior. Adding `forbidNonWhitelisted: true` on top changes unrecognized properties from being silently dropped to causing an explicit `400 Bad Request` that names the offending fields, giving you the "reject" behavior. Since these are global `ValidationPipe` options, you'd typically pick one policy for the whole app; if you need per-route differences, you can override with a route- or controller-scoped `ValidationPipe` instance configured differently, since NestJS resolves pipe scopes as additive layers.

**Q: Why is validating input in a DTO/pipe better than validating manually inside a service method?**
Answer: Validating at the controller boundary via DTOs and a `ValidationPipe` guarantees that invalid data can never reach any downstream code — service methods, repositories, or other consumers of the DTO can simply trust the shape and constraints described by the class, rather than re-checking it themselves. This keeps validation rules colocated with the data shape they describe (self-documenting via decorators), avoids duplicating the same checks across multiple call sites, and ensures a consistent, centrally-configured error response format for all validation failures across the entire API surface, rather than each service inventing its own ad hoc error handling.
