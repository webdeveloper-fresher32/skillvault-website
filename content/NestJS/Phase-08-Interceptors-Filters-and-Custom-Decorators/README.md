# Phase 8: Interceptors, Filters & Custom Decorators

This phase completes your tour of the NestJS request pipeline. In Phase 06 you learned pipes (validation/transformation of inputs) and in Phase 07 you learned guards (authentication/authorization). Now you learn the two remaining pieces that wrap around the entire request: **interceptors** (which can run logic both before and after the handler, and transform the response on the way out) and **exception filters** (which catch anything that goes wrong and shape the error response). You'll also learn how to build your own decorators — the same mechanism that powers `@Roles()` from Phase 07 — so you can extend Nest's declarative style with your own reusable, composable metadata.

By the end of this phase you should be able to explain, precisely, what runs and in what order for any given request — middleware, guards, interceptors, pipes, the handler, interceptors again, and finally filters if anything throws.

## What You'll Learn

- The `NestInterceptor` interface and how `intercept(context, next)` wraps the handler in an RxJS `Observable`
- The complete request pipeline order, including where interceptors sit relative to guards, pipes, and filters
- Using RxJS operators (`map`, `tap`, `catchError`) to transform responses, log timing, and translate errors
- Building a logging interceptor that measures request duration
- Building a response-transform interceptor that wraps every response in a consistent `{ data, meta }` envelope
- The `@Catch()` decorator and the `ExceptionFilter` interface
- Nest's built-in exception filter and the `HttpException` class hierarchy
- Global, controller-scoped, and method-scoped exception filters, and how Nest picks which one runs
- Building a catch-all `AllExceptionsFilter` that normalizes even non-`HttpException` errors into one error shape
- `createParamDecorator` for custom parameter decorators (e.g. `@CurrentUser()`)
- `SetMetadata` as the low-level building block behind decorators like `@Roles()`
- Composing multiple decorators into one with `applyDecorators()`
- Decorator execution order (bottom-to-top for stacked method decorators)

## Learning Objectives

- Explain the full Nest request lifecycle from an incoming HTTP request to the outgoing response, naming every layer in order
- Write an interceptor that measures and logs execution time using RxJS's `tap` operator
- Write an interceptor that reshapes every successful response into a standard envelope without touching individual controllers
- Distinguish `HttpException` subclasses and know when to throw which one
- Write a global exception filter that guarantees every error — including unexpected `TypeError`s and driver errors — produces a consistent, safe JSON error body
- Understand why filter scoping (global vs controller vs method) and matching precedence matter, and order `@Catch()` clauses from most specific to least specific
- Build a custom parameter decorator with `createParamDecorator` that extracts data from the request object
- Use `SetMetadata` plus a custom guard/interceptor to read handler-level metadata via `Reflector`
- Compose several decorators into a single reusable decorator using `applyDecorators()`
- Reason correctly about the order multiple stacked decorators execute in

## Topics

| File | Topic | Time |
|------|-------|------|
| `01-Interceptors-and-the-Request-Pipeline.md` | `NestInterceptor`, the full pipeline order, RxJS operators, logging & response-transform interceptors | 1 day |
| `02-Exception-Filters.md` | `@Catch()`, `ExceptionFilter`, `HttpException` hierarchy, filter scoping, global `AllExceptionsFilter` | 1 day |
| `03-Custom-Decorators-and-Metadata.md` | `createParamDecorator`, `SetMetadata`, `applyDecorators()`, decorator execution order | 1 day |

## Estimated Time

**3 days** (Advanced)

## Previous Phase

[Phase 07: Guards & Authentication](../Phase-07-Guards-and-Authentication/README.md)

## Next Phase

[Phase 09: Database Integration](../Phase-09-Database-Integration/README.md)
