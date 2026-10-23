# Phase 8: HTTP & Interceptors

## What You'll Learn

Connect Angular applications to real backends. Master `HttpClient` for typed REST calls, functional interceptors for cross-cutting concerns like auth and logging, and robust error-handling and retry strategies for production-grade network code.

## Learning Objectives

- Configure `HttpClient` with `provideHttpClient()` and perform GET/POST/PUT/DELETE requests
- Type HTTP responses with generics and consume them idiomatically via the `async` pipe
- Write functional `HttpInterceptorFn` interceptors and chain multiple interceptors
- Attach auth tokens, log requests/responses, and transform payloads via interceptors
- Handle `HttpErrorResponse`s and implement retry/backoff strategies with RxJS operators

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-HttpClient-Basics.md](01-HttpClient-Basics.md) | provideHttpClient, CRUD requests, typed responses, async pipe | 1 day |
| [02-Interceptors.md](02-Interceptors.md) | Functional HttpInterceptorFn, auth headers, logging, chaining | 0.5 day |
| [03-Error-Handling-and-Retries.md](03-Error-Handling-and-Retries.md) | catchError, retry, exponential backoff, global error handling | 0.5 day |

## Estimated Time

2 days

## Next Phase

→ [Phase 9: Signals & State](../Phase-09-Signals-and-State/README.md)
