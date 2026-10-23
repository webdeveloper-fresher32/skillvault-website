# Phase 6: Pipes & Validation

## What You'll Learn

Pipes are NestJS's mechanism for transforming and validating input data before it reaches a route handler. This phase covers the `PipeTransform` interface and NestJS's built-in pipes, then moves into the real workhorse of production NestJS apps: DTO classes validated declaratively with `class-validator` and transformed with `class-transformer`, wired up globally via `ValidationPipe`. Finally, you'll learn to extend the system with custom synchronous and asynchronous validators, and use `class-transformer`'s serialization decorators to control exactly what shape of data leaves your API (e.g., stripping password hashes from responses).

By the end of this phase you will understand where pipes fit in the request lifecycle relative to guards and interceptors, how to enforce a "no bad data gets past the controller boundary" policy application-wide, and how to write your own validation and transformation logic when the built-in decorators aren't enough.

## Learning Objectives

- Implement the `PipeTransform<T, R>` interface and understand the `ArgumentMetadata` object
- Use built-in pipes: `ParseIntPipe`, `ParseUUIDPipe`, `ParseBoolPipe`, `ParseArrayPipe`, `ParseEnumPipe`, `DefaultValuePipe`
- Understand pipe execution order relative to middleware, guards, and interceptors
- Apply pipes at parameter, handler, controller, and global scope, and know when to use each
- Write a custom pipe that transforms and sanitizes input
- Design DTO classes with `class-validator` decorators, including nested object validation
- Configure the global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform`, and explain why each option matters
- Write a custom validation decorator with `@ValidatorConstraint`, including an async DB-backed validator
- Control response serialization with `@Expose`, `@Exclude`, `@Transform`, and `ClassSerializerInterceptor`

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Pipes-Fundamentals.md](01-Pipes-Fundamentals.md) | Pipes Fundamentals — PipeTransform, Built-In Pipes, and Scoping | 4-5 hours |
| [02-DTOs-and-class-validator.md](02-DTOs-and-class-validator.md) | DTOs & class-validator — Declarative Validation and the Global ValidationPipe | 5-6 hours |
| [03-Custom-Validation-and-Transformation.md](03-Custom-Validation-and-Transformation.md) | Custom Validation & Transformation — Custom Validators and Response Serialization | 5-6 hours |

## Estimated Time

2 days

## Previous Phase

→ [Phase 5: Modules & Application Architecture](../Phase-05-Modules-and-Application-Architecture/README.md)

## Next Phase

→ [Phase 7: Guards & Authentication](../Phase-07-Guards-and-Authentication/README.md)
