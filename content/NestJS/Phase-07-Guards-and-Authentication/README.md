# Phase 7: Guards & Authentication

## What You'll Learn

Guards are the part of the Nest request pipeline responsible for **authorization** — deciding whether a given request is allowed to reach a route handler at all. This phase goes deep on guards themselves (the `CanActivate` interface, `ExecutionContext`, execution order relative to middleware/interceptors/pipes), then builds a complete, production-shaped authentication system on top of them using `@nestjs/passport` and `@nestjs/jwt`: a login flow that issues signed JWTs, a `JwtStrategy` that validates incoming tokens, and a `JwtAuthGuard` that protects routes. Finally it covers role-based access control (RBAC) built from first principles with custom metadata decorators and a `Reflector`-driven `RolesGuard`, plus a `@CurrentUser()` parameter decorator for ergonomic access to the authenticated user inside controllers.

This is one of the most security-sensitive phases in the course. Getting guard execution order wrong, mismanaging JWT secrets, or misusing `Reflector` are all common real-world bugs — each lesson has a dedicated Common Pitfalls section for exactly this reason.

## Learning Objectives

- Implement the `CanActivate` interface and understand where guards sit in the request lifecycle (after middleware, before interceptors and route handlers, alongside/after pipes for route-level binding)
- Use `ExecutionContext` to extract the underlying HTTP request, response, and handler/class metadata in a transport-agnostic way
- Apply guards at handler, controller, and application (global) scope, and understand precedence between them
- Integrate `@nestjs/passport` and build a `JwtStrategy` by extending `PassportStrategy(Strategy)`
- Issue and verify signed JWTs with `@nestjs/jwt`, including a full login flow from credential check to token issuance
- Protect routes with `AuthGuard('jwt')` / a custom `JwtAuthGuard`, and reason about refresh-token strategies
- Build a custom `@Roles()` decorator with `SetMetadata` and a `RolesGuard` that reads it via `Reflector`
- Correctly order authentication and authorization guards (`JwtAuthGuard` before `RolesGuard`) at both the guard-array level and the `canActivate` life-cycle level
- Build a `@CurrentUser()` parameter decorator with `createParamDecorator` to cleanly extract `request.user` in controllers
- Recognize and avoid the most common auth pitfalls: unregistered `Reflector`, guard ordering bugs, and insecure secret management

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Guards-and-CanActivate.md](01-Guards-and-CanActivate.md) | Guards & `CanActivate` — the Authorization Layer of the Request Pipeline | 1 day |
| [02-Passport-and-JWT-Authentication.md](02-Passport-and-JWT-Authentication.md) | Passport & JWT Authentication — Login, Strategies, and Protected Routes | 1 day |
| [03-Role-Based-Access-and-Custom-Decorators-for-Auth.md](03-Role-Based-Access-and-Custom-Decorators-for-Auth.md) | Role-Based Access Control & Custom Auth Decorators | 1 day |

## Estimated Time

3 days

## Previous Phase

→ [Phase 6: Pipes and Validation](../Phase-06-Pipes-and-Validation/README.md)

## Next Phase

→ [Phase 8: Interceptors, Filters and Custom Decorators](../Phase-08-Interceptors-Filters-and-Custom-Decorators/README.md)
