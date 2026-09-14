# Error Handling and Retries — Complete Guide

## Table of Contents
1. [Why HTTP Error Handling Needs a Strategy](#1-why-http-error-handling-needs-a-strategy)
2. [Understanding HttpErrorResponse](#2-understanding-httperrorresponse)
3. [catchError — Handling Failures](#3-catcherror--handling-failures)
4. [retry and retryWhen](#4-retry-and-retrywhen)
5. [Exponential Backoff Retry Pattern](#5-exponential-backoff-retry-pattern)
6. [Global Error Handling Strategies](#6-global-error-handling-strategies)
7. [Worked Example: Interceptor + Centralized Error Handling](#7-worked-example-interceptor--centralized-error-handling)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why HTTP Error Handling Needs a Strategy

Network calls fail for reasons outside your control: the server is down, the connection drops, the user is offline, or the request is simply invalid. Without a strategy, every component that calls `HttpClient` ends up duplicating ad-hoc `try/catch`-style logic and inconsistent user feedback.

```
Without a strategy:                     With a strategy:
Component A: alert('Error!')            Interceptor: normalize error
Component B: console.log(err)                        → retry transient failures
Component C: silently swallows err                    → surface a toast once
Component D: crashes the page                         → log to monitoring
                                         Components: just handle the "no data" case
```

The goal: distinguish **transient** failures (network blip, 503, timeout — worth retrying) from **permanent** failures (400 validation error, 404, 403 — never worth retrying), and handle each category once, consistently.

---

## 2. Understanding HttpErrorResponse

Any error emitted from an `HttpClient` call for a 4xx/5xx status or an actual network failure comes wrapped in an `HttpErrorResponse`:

```typescript
import { HttpErrorResponse } from '@angular/common/http';

this.http.get<User[]>('/api/users').subscribe({
  next: users => console.log(users),
  error: (err: unknown) => {
    if (err instanceof HttpErrorResponse) {
      console.log(err.status);      // e.g. 404, 500, or 0 for network failure
      console.log(err.statusText);  // e.g. "Not Found"
      console.log(err.url);         // the request URL that failed
      console.log(err.error);       // the parsed response body (server error payload)

      if (err.status === 0) {
        // status 0 typically means: no connection, CORS failure, or DNS failure
        console.log('Network error — is the server reachable?');
      } else if (err.status >= 500) {
        console.log('Server error — likely transient, safe to retry');
      } else if (err.status === 401) {
        console.log('Unauthorized — handled by auth interceptor');
      } else if (err.status === 404) {
        console.log('Not found — permanent, do not retry');
      }
    }
  },
});
```

| Status Range | Meaning | Retry? |
|---|---|---|
| `0` | Network/CORS/DNS failure | Yes (transient) |
| `408` | Request Timeout | Yes |
| `429` | Too Many Requests | Yes, with backoff, respecting `Retry-After` |
| `500`, `502`, `503`, `504` | Server errors | Yes (transient) |
| `400`, `422` | Validation error | No — fix the request |
| `401` | Unauthorized | No retry directly — refresh token then retry once (Lesson 02) |
| `403` | Forbidden | No — permission issue |
| `404` | Not Found | No |

---

## 3. catchError — Handling Failures

`catchError` intercepts an error notification from the source observable and lets you recover, rethrow, or substitute a fallback value:

```typescript
import { catchError, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

getUsers(): Observable<User[]> {
  return this.http.get<User[]>('/api/users').pipe(
    catchError((err: HttpErrorResponse) => {
      console.error('Failed to load users', err);
      return of([]); // fallback: treat failure as "no users" instead of crashing the UI
    })
  );
}
```

Or rethrow a normalized, app-specific error for the caller to handle:

```typescript
export class AppHttpError extends Error {
  constructor(public status: number, message: string, public original: HttpErrorResponse) {
    super(message);
  }
}

getUsers(): Observable<User[]> {
  return this.http.get<User[]>('/api/users').pipe(
    catchError((err: HttpErrorResponse) => {
      const message = err.error?.message ?? 'Something went wrong loading users.';
      return throwError(() => new AppHttpError(err.status, message, err));
    })
  );
}
```

Rule of thumb: use `of(fallback)` when a failure has a sane default (e.g. empty list); use `throwError(() => ...)` when the caller genuinely needs to know the call failed (e.g. a form submission).

---

## 4. retry and retryWhen

RxJS's `retry` operator resubscribes to the source observable when it errors, up to a configured count:

```typescript
import { retry } from 'rxjs';

getUsers(): Observable<User[]> {
  return this.http.get<User[]>('/api/users').pipe(
    retry(2) // retry up to 2 additional times on any error (3 attempts total)
  );
}
```

Blind retries are dangerous — retrying a 404 or a 400 three times just delays an inevitable failure and hammers the server. Use the object-config form to filter and delay:

```typescript
import { retry, timer } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

getUsers(): Observable<User[]> {
  return this.http.get<User[]>('/api/users').pipe(
    retry({
      count: 3,
      delay: (error, retryCount) => {
        if (error instanceof HttpErrorResponse && error.status >= 500) {
          return timer(1000 * retryCount); // linear backoff: 1s, 2s, 3s
        }
        throw error; // non-transient error — do not retry, propagate immediately
      },
    })
  );
}
```

`retryWhen` is the older, more manual mechanism for the same purpose (it hands you the *errors* observable and expects you to return a notifier observable). It's considered legacy in modern RxJS — the `retry({ delay })` config form above is the current recommended replacement for conditional/delayed retries, and `retryWhen` is deprecated as of RxJS 7+.

---

## 5. Exponential Backoff Retry Pattern

Exponential backoff spaces out retries increasingly (1s, 2s, 4s, 8s...) instead of hammering a struggling server at a fixed interval — this is the standard pattern for resilient clients:

```typescript
import { retry, timer, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500 || error.status === 429);
}

function exponentialBackoffRetry(maxRetries = 4, baseDelayMs = 500) {
  return retry({
    count: maxRetries,
    delay: (error: unknown, retryCount: number) => {
      if (!isTransient(error)) {
        return throwError(() => error); // permanent error — stop retrying
      }
      const backoff = baseDelayMs * Math.pow(2, retryCount - 1); // 500, 1000, 2000, 4000ms
      const jitter = Math.random() * 200; // avoid thundering-herd retries across clients
      console.warn(`Retry #${retryCount} after ${Math.round(backoff + jitter)}ms`);
      return timer(backoff + jitter);
    },
  });
}

// Usage
getUsers(): Observable<User[]> {
  return this.http.get<User[]>('/api/users').pipe(
    exponentialBackoffRetry(4, 500)
  );
}
```

```
Attempt 1 fails → wait ~500ms  → Attempt 2
Attempt 2 fails → wait ~1000ms → Attempt 3
Attempt 3 fails → wait ~2000ms → Attempt 4
Attempt 4 fails → wait ~4000ms → Attempt 5 (final)
Attempt 5 fails → give up, propagate error to caller
```

Adding small random **jitter** prevents many simultaneous clients from retrying in lockstep and re-overwhelming a recovering server.

---

## 6. Global Error Handling Strategies

Three complementary layers, each with a distinct job:

```
┌───────────────────────────────────────────────────────────┐
│ 1. HTTP Interceptor  → catches every HTTP error uniformly   │
│    - normalizes HttpErrorResponse into AppHttpError          │
│    - retries transient failures                             │
│    - triggers a global toast/snackbar for unhandled errors   │
├───────────────────────────────────────────────────────────┤
│ 2. Component-level catchError → contextual recovery          │
│    - e.g. "no products found" empty state vs generic error   │
├───────────────────────────────────────────────────────────┤
│ 3. ErrorHandler (Angular's global handler) → last resort      │
│    - catches uncaught synchronous/template errors             │
│    - logs to a monitoring service (Sentry, Datadog, etc.)     │
└───────────────────────────────────────────────────────────┘
```

A minimal global `ErrorHandler` (catches errors outside the HTTP pipeline too — template errors, uncaught exceptions):

```typescript
// global-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NotificationService } from './notification.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private notifications = inject(NotificationService);

  handleError(error: unknown): void {
    console.error('Unhandled error:', error);
    this.notifications.showError('Something went wrong. Please try again.');
    // send to monitoring service here (Sentry.captureException(error), etc.)
  }
}
```

```typescript
// app.config.ts
providers: [
  { provide: ErrorHandler, useClass: GlobalErrorHandler },
  provideHttpClient(withInterceptors([errorInterceptor])),
]
```

Keep HTTP-specific handling in the interceptor (it has access to the request/response and can retry) and reserve the global `ErrorHandler` for truly unexpected, uncaught errors.

---

## 7. Worked Example: Interceptor + Centralized Error Handling

An interceptor that retries transient failures with exponential backoff, normalizes all errors into a consistent shape, and shows a toast for anything that isn't handled locally:

```typescript
// app-http-error.ts
import { HttpErrorResponse } from '@angular/common/http';

export class AppHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly original: HttpErrorResponse
  ) {
    super(message);
  }

  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}
```

```typescript
// error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, timer, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AppHttpError } from './app-http-error';

function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500 || error.status === 429);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error, retryCount) => {
        if (!isTransient(error)) {
          return throwError(() => error);
        }
        const backoff = 500 * Math.pow(2, retryCount - 1);
        return timer(backoff + Math.random() * 200);
      },
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const message = error.error?.message ?? defaultMessageFor(error.status);
        const appError = new AppHttpError(error.status, message, error);

        // Only show a global toast for errors the caller hasn't opted to handle locally.
        if (![400, 401, 422].includes(error.status)) {
          notifications.showError(message);
        }
        return throwError(() => appError);
      }
      return throwError(() => error);
    })
  );
};

function defaultMessageFor(status: number): string {
  switch (true) {
    case status === 0: return 'Unable to reach the server. Check your connection.';
    case status === 404: return 'The requested resource was not found.';
    case status >= 500: return 'The server encountered an error. Please try again shortly.';
    default: return 'An unexpected error occurred.';
  }
}
```

```typescript
// product.service.ts — consumer only handles the case it cares about (validation)
getProduct(id: number): Observable<Product> {
  return this.http.get<Product>(`/api/products/${id}`).pipe(
    catchError((err: AppHttpError) => {
      if (err.status === 404) {
        return of(null); // component renders a "not found" state
      }
      return throwError(() => err); // let the interceptor's toast + logging handle everything else
    })
  );
}
```

```typescript
provideHttpClient(
  withInterceptors([authInterceptor, errorInterceptor])
)
```

Retries happen once, centrally, in `errorInterceptor` — no service or component needs to know exponential backoff exists. Components only add `catchError` when they want to render something different from the default toast (e.g. a 404 empty state or a 400 validation message inline in a form).

---

## 8. Hands-On Exercises

**Exercise 1:** Write a service method that calls a (deliberately broken) endpoint and use `catchError` to return `of([])` as a fallback instead of letting the error propagate.

**Exercise 2:** Add `retry(2)` to a GET call, then use a mock/dev-tools network throttle to simulate a flaky connection and confirm in the Network tab that the request fires up to 3 times.

**Exercise 3:** Replace the plain `retry(2)` from Exercise 2 with a `retry({ count, delay })` config that only retries on `status >= 500` or `status === 0`, and rethrows immediately for 4xx errors.

**Exercise 4:** Implement `exponentialBackoffRetry()` as a standalone reusable RxJS operator (per Section 5) and apply it to two different services, confirming the delay roughly doubles between attempts (log timestamps).

**Exercise 5:** Build the `errorInterceptor` from Section 7, wire it up alongside a `NotificationService` stub that just `console.log`s messages, and verify: a 500 response triggers retries + eventually a toast, while a 404 does not show a toast (because the calling component handles it).

---

## 9. Interview Q&A

**Q: What is HttpErrorResponse and what information does it give you?**
Answer: `HttpErrorResponse` is the object Angular's `HttpClient` emits as an error notification whenever a request fails — either due to a non-2xx HTTP status or a network-level failure. It exposes `status` (0 for network/CORS failures, otherwise the HTTP status code), `statusText`, `url`, and `error` (the parsed response body), letting you branch behavior based on what actually went wrong.

**Q: When should you retry a failed HTTP request, and when should you not?**
Answer: Retry transient failures — network errors (`status === 0`), timeouts, `429 Too Many Requests`, and `5xx` server errors — since these often succeed on a subsequent attempt. Never retry permanent failures like `400` (bad request), `404` (not found), or `403` (forbidden), since the request itself is invalid or unauthorized and retrying wastes time and load without any chance of success.

**Q: How does RxJS's retry operator work, and what's the danger of using retry(n) with no configuration?**
Answer: `retry(n)` resubscribes to the source observable up to `n` additional times whenever it errors, with no delay and no filtering by default. Used bare, it retries indiscriminately — it will retry unretryable errors like a 400 validation failure just as eagerly as a genuine 503, and with no delay it can hammer a struggling server immediately. The `retry({ count, delay })` config form fixes this by letting you inspect the error and either return a delay observable (e.g. via `timer()`) or rethrow to bail out.

**Q: Describe the exponential backoff pattern and why jitter is added to it.**
Answer: Exponential backoff increases the delay between retries geometrically (e.g. 500ms, 1s, 2s, 4s) instead of a fixed interval, giving a struggling server increasing room to recover instead of being hit at a constant rate. Jitter — a small random amount added to each delay — prevents many clients that failed at the same moment from all retrying in lockstep, which would otherwise recreate the same overload it's trying to avoid ("thundering herd").

**Q: How would you structure global HTTP error handling across an app without duplicating logic in every component?**
Answer: Put shared behavior in a single `errorInterceptor`: normalize `HttpErrorResponse` into a consistent app-level error type, retry transient failures with backoff, and trigger a global toast/notification for errors components haven't opted to handle. Components then only add `catchError` for errors they want to render specially (e.g., a 404 empty state or a 400 validation message), letting everything else fall through to the interceptor's default handling — plus a top-level `ErrorHandler` implementation as a last-resort catch for uncaught, non-HTTP errors.
