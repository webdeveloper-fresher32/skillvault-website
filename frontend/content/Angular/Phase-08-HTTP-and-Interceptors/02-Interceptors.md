# Interceptors — Complete Guide

## Table of Contents
1. [What Is an Interceptor?](#1-what-is-an-interceptor)
2. [The Functional HttpInterceptorFn](#2-the-functional-httpinterceptorfn)
3. [Registering Interceptors](#3-registering-interceptors)
4. [Use Case: Adding Auth Headers](#4-use-case-adding-auth-headers)
5. [Use Case: Logging](#5-use-case-logging)
6. [Use Case: Request/Response Transformation](#6-use-case-requestresponse-transformation)
7. [Chaining Multiple Interceptors](#7-chaining-multiple-interceptors)
8. [Worked Example: Complete Auth-Token Interceptor](#8-worked-example-complete-auth-token-interceptor)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What Is an Interceptor?

An interceptor sits between your code and the network, intercepting every outgoing `HttpRequest` and every incoming `HttpEvent` response. It's Angular's equivalent of Express middleware for HTTP calls.

```
Component/Service
      │  http.get('/api/orders')
      ▼
┌─────────────────────────────────────────────┐
│  Interceptor 1 (auth)   → adds Authorization │
│  Interceptor 2 (logging)→ logs request        │
│  Interceptor 3 (retry)  → retries on failure   │
└─────────────────────────────────────────────┘
      │
      ▼
   Backend Server
      │
      ▼  response flows back through the SAME chain, reverse order
Component/Service
```

Interceptors let you centralize cross-cutting concerns — auth tokens, logging, error handling, caching, loading indicators — instead of repeating them in every service method.

---

## 2. The Functional HttpInterceptorFn

Modern Angular (v15+) replaced class-based `HttpInterceptor` with a **functional** style: a plain function matching `HttpInterceptorFn`. This is now the recommended approach.

```typescript
import { HttpInterceptorFn } from '@angular/common/http';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  return next(req);
};
```

Signature breakdown:

```typescript
type HttpInterceptorFn = (
  req: HttpRequest<unknown>,   // the outgoing request (immutable)
  next: HttpHandlerFn          // call this to pass the request to the next interceptor
) => Observable<HttpEvent<unknown>>;
```

Key points:
- `req` is **immutable** — you never mutate it directly; you call `req.clone({...})` to produce a modified copy.
- `next(req)` forwards the (possibly cloned) request down the chain and returns an observable of the eventual response.
- You must always return an observable — either `next(req)` or something derived from it (e.g. via `catchError`, `tap`, `map`).

Functional interceptors are plain functions, so they use `inject()` for DI instead of constructor injection:

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService); // inject() works because Angular runs this in an injection context
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(cloned);
};
```

---

## 3. Registering Interceptors

Register the interceptor chain in `app.config.ts` via `withInterceptors()`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor, loggingInterceptor, errorInterceptor])
    ),
  ],
};
```

The array order is the execution order for the **outgoing** request — `authInterceptor` runs first, then `loggingInterceptor`, then `errorInterceptor`, then the request finally leaves the browser. Responses flow back through the same list in **reverse** order.

---

## 4. Use Case: Adding Auth Headers

The most common interceptor use case — attach a bearer token to every outgoing request without touching individual service calls:

```typescript
// auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Don't attach a token to auth endpoints themselves (avoid loops)
  if (!token || req.url.includes('/auth/login')) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
```

---

## 5. Use Case: Logging

Interceptors can observe both the request going out and the response (or error) coming back, using RxJS `tap`:

```typescript
// logging.interceptor.ts
import { HttpInterceptorFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = Date.now();

  return next(req).pipe(
    tap({
      next: (event: HttpEvent<unknown>) => {
        if (event instanceof HttpResponse) {
          const elapsed = Date.now() - started;
          console.log(`[HTTP] ${req.method} ${req.url} → ${event.status} (${elapsed}ms)`);
        }
      },
      error: (err) => {
        const elapsed = Date.now() - started;
        console.error(`[HTTP] ${req.method} ${req.url} failed after ${elapsed}ms`, err);
      },
    })
  );
};
```

---

## 6. Use Case: Request/Response Transformation

Interceptors can rewrite requests (e.g. rewrite URLs, add default params) and transform responses (e.g. unwrap an envelope, camelCase keys):

```typescript
// api-envelope.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

interface ApiEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

// Backend wraps every response as { data: ..., meta: ... } — unwrap it transparently
export const apiEnvelopeInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (event instanceof HttpResponse && event.body && 'data' in (event.body as object)) {
        const envelope = event.body as ApiEnvelope<unknown>;
        return event.clone({ body: envelope.data });
      }
      return event;
    })
  );
};
```

```typescript
// base-url.interceptor.ts — rewrite relative URLs to point at the configured API host
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../app.tokens';

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(APP_CONFIG);

  if (req.url.startsWith('/api')) {
    return next(req.clone({ url: `${config.apiBaseUrl}${req.url}` }));
  }
  return next(req);
};
```

---

## 7. Chaining Multiple Interceptors

Interceptors compose like middleware — each one decides whether to pass the request along unchanged, cloned, or short-circuit entirely (e.g. return a cached response without calling `next` at all).

```
withInterceptors([
  baseUrlInterceptor,   // 1. rewrite /api/* → https://api.example.com/*
  authInterceptor,      // 2. attach Authorization header
  loggingInterceptor,   // 3. log method/url/timing
  errorInterceptor,     // 4. catch and normalize errors (see Lesson 03)
])
```

```
Request flow (outgoing):
  baseUrlInterceptor → authInterceptor → loggingInterceptor → errorInterceptor → network

Response flow (incoming):
  network → errorInterceptor → loggingInterceptor → authInterceptor → baseUrlInterceptor → caller
```

Order matters. Putting `authInterceptor` before `baseUrlInterceptor` is usually fine here since it only reads the token, but if an interceptor depends on a header or URL another interceptor sets, that dependency must run earlier in the array.

You can also scope interceptors to specific requests using `HttpContext` tokens instead of URL string matching:

```typescript
import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

// in authInterceptor
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }
  // ... attach token
  return next(req);
};

// calling code opts out per-request
this.http.get('/api/public/health', { context: new HttpContext().set(SKIP_AUTH, true) });
```

---

## 8. Worked Example: Complete Auth-Token Interceptor

A realistic auth interceptor that attaches a token, refreshes it on 401, and retries the original request once:

```typescript
// auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/auth/refresh')) {
        // Token expired — refresh once, then retry the original request
        return authService.refreshToken().pipe(
          switchMap(newToken => {
            const retriedReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retriedReq);
          }),
          catchError(refreshError => {
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
```

```typescript
// auth.service.ts (relevant slice)
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private token: string | null = null;

  getToken(): string | null {
    return this.token ?? localStorage.getItem('access_token');
  }

  refreshToken(): Observable<string> {
    return this.http.post<{ accessToken: string }>('/auth/refresh', {}).pipe(
      tap(res => {
        this.token = res.accessToken;
        localStorage.setItem('access_token', res.accessToken);
      }),
      switchMap(res => [res.accessToken] as any) // simplified for brevity
    ) as unknown as Observable<string>;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('access_token');
    this.router.navigate(['/login']);
  }
}
```

Register it alongside logging, in order:

```typescript
provideHttpClient(
  withInterceptors([authInterceptor, loggingInterceptor])
)
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a `loggingInterceptor` that logs every request method, URL, and response status to the console, and register it with `withInterceptors()`.

**Exercise 2:** Write an `authInterceptor` that reads a token from `localStorage` and attaches it as an `Authorization: Bearer <token>` header to every request except calls to `/auth/login`.

**Exercise 3:** Create an `HttpContextToken` called `SKIP_LOGGING` and update your logging interceptor to skip logging for any request that sets this context flag. Verify with a request that opts out.

**Exercise 4:** Register three interceptors (`baseUrl`, `auth`, `logging`) in a specific order, then use console output to prove to yourself that the response flows back through them in reverse order.

**Exercise 5:** Extend the auth interceptor from Section 8 to handle a 401 by calling a (mocked) `refreshToken()` and retrying the original request exactly once — verify it doesn't loop infinitely if the refresh itself returns 401.

---

## 10. Interview Q&A

**Q: What is an HTTP interceptor in Angular and what problem does it solve?**
Answer: An interceptor is a function (or, historically, a class) that sits in the pipeline between application code and the network, able to inspect and modify every outgoing `HttpRequest` and incoming response. It centralizes cross-cutting concerns — auth headers, logging, error normalization, caching — so individual services don't need to repeat that logic on every call.

**Q: What's the difference between the functional HttpInterceptorFn and the older class-based HttpInterceptor?**
Answer: `HttpInterceptorFn` is a plain function `(req, next) => Observable<HttpEvent>` registered via `withInterceptors([...])`, using `inject()` for DI — it's simpler, tree-shakeable, and is the API Angular recommends since v15. The class-based `HttpInterceptor` requires implementing an `intercept()` method and registering via `HTTP_INTERCEPTORS` multi-provider tokens in an NgModule, which is more boilerplate and is being phased out of new code.

**Q: Why do you call req.clone() instead of mutating the request object directly in an interceptor?**
Answer: `HttpRequest` objects are immutable by design, so multiple interceptors (and retries) can safely reuse or reference the same request without unexpected side effects from another interceptor's changes. `clone({...})` produces a new request with the specified overrides (headers, URL, body) while leaving the original untouched.

**Q: In what order do multiple interceptors execute, and does that order apply to both requests and responses?**
Answer: For the outgoing request, interceptors run in the order given to `withInterceptors([...])` — the first one in the array runs first. For the incoming response (or error), they run in reverse order, since each interceptor's `next(req)` call is what invokes the following interceptor, and responses propagate back up through the same call stack.

**Q: How would you skip an interceptor for a specific request without matching on the URL string?**
Answer: Use an `HttpContextToken`. Define a token like `SKIP_AUTH = new HttpContextToken<boolean>(() => false)`, check `req.context.get(SKIP_AUTH)` inside the interceptor to bail out early, and set it per-call via `this.http.get(url, { context: new HttpContext().set(SKIP_AUTH, true) })`. This is more robust than string-matching URLs and keeps the opt-out explicit at the call site.
