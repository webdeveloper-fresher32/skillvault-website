# Phase 3: Controllers & Routing

## What You'll Learn

Controllers are the entry point for incoming HTTP requests in NestJS — they map URLs and HTTP methods to handler methods using decorators instead of manually wiring up an Express/Fastify router. This phase covers the full lifecycle of a request as it arrives at a controller: how routes are declared and matched, how data is extracted from the request (route params, query strings, bodies, headers), and how a handler's return value (or thrown exception) is turned into an HTTP response. You'll also learn where Nest's "magic" ends — the points where dropping down to the raw Express/Fastify request/response objects is necessary, and the pitfalls that come with doing so.

By the end of this phase you should be able to build a fully working CRUD controller, correctly extract and validate multi-source request data, and control exactly what status code, headers, and body shape a client receives.

## Learning Objectives

- Declare controllers with `@Controller()` and route prefixes, including versioned and nested prefixes
- Map HTTP verbs to handler methods with `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, and understand route-matching order
- Use parameterized (`:id`) and wildcard (`*`) route patterns, and avoid static-vs-dynamic route ordering bugs
- Extract data from requests using `@Param()`, `@Query()`, `@Body()`, `@Headers()`, `@Ip()`, and `@Req()`
- Understand when and why to avoid `@Res()`, and how it silently disables Nest's response pipeline
- Understand Nest's default response serialization (return value → JSON) versus manual response handling
- Set explicit status codes with `@HttpCode()`, set headers with `@Header()`, and redirect with `@Redirect()`
- Throw `HttpException` subclasses to produce structured, correctly-coded error responses
- Build a controller that returns different status codes based on business logic outcomes

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Controllers-and-HTTP-Method-Decorators.md](01-Controllers-and-HTTP-Method-Decorators.md) | Controllers & HTTP Method Decorators — routes, prefixes, params, wildcards, route ordering | 1 day |
| [02-Request-Data-Extraction.md](02-Request-Data-Extraction.md) | Request Data Extraction — `@Param`/`@Query`/`@Body`/`@Headers`/`@Ip`/`@Req`, and the `@Res()` trap | 0.5 day |
| [03-Response-Handling-and-Status-Codes.md](03-Response-Handling-and-Status-Codes.md) | Response Handling & Status Codes — serialization, `@HttpCode`, `@Header`, exceptions, `@Redirect` | 0.5 day |

## Estimated Time
2 days

## Previous Phase
→ [Phase 2: Nest CLI & Project Structure](../Phase-02-Nest-CLI-and-Project-Structure/README.md)

## Next Phase
→ [Phase 4: Providers & Dependency Injection](../Phase-04-Providers-and-Dependency-Injection/README.md)
