# HttpClient Basics — Complete Guide

## Table of Contents
1. [Why HttpClient](#1-why-httpclient)
2. [Setting Up provideHttpClient](#2-setting-up-providehttpclient)
3. [GET Requests](#3-get-requests)
4. [POST, PUT, and DELETE Requests](#4-post-put-and-delete-requests)
5. [Typed Responses with Generics](#5-typed-responses-with-generics)
6. [Observables, Subscribing, and the Async Pipe](#6-observables-subscribing-and-the-async-pipe)
7. [Worked Example: A Data Service Calling a REST API](#7-worked-example-a-data-service-calling-a-rest-api)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why HttpClient

`HttpClient` is Angular's built-in service for talking to HTTP backends. It wraps the browser's `fetch`/`XMLHttpRequest` machinery in an RxJS-based API, giving you:

```
Raw fetch()                      Angular HttpClient
────────────                     ──────────────────
Manual JSON.parse()          →   Automatic JSON parsing
Callback/Promise based        →   Observable based (cancellable, composable)
No built-in interceptors      →   Interceptor chain for auth/logging/errors
Manual error checking          →   Typed HttpErrorResponse
No testing utilities           →   HttpClientTestingModule / provideHttpClientTesting
```

Because requests are observables, you get cancellation for free (unsubscribe or let `async` pipe handle it), easy composition with `switchMap`/`combineLatest`, and a single, consistent error-handling surface (interceptors — covered in the next lesson).

---

## 2. Setting Up provideHttpClient

Modern Angular (standalone, no NgModules) wires up `HttpClient` via a provider function in `app.config.ts`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),                    // use the fetch API instead of XHR (SSR-friendly)
      withInterceptors([authInterceptor]) // functional interceptors, see Lesson 02
    ),
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

Without `provideHttpClient()` in your providers, injecting `HttpClient` anywhere in the app throws a `NullInjectorError`. There is no `HttpClientModule` import needed in modern standalone apps — the provider function replaces it entirely.

---

## 3. GET Requests

Inject `HttpClient` and call `.get()`. It returns a **cold observable** — no request is sent until something subscribes.

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.example.com/users';

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  // With query params
  searchUsers(term: string): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl, {
      params: { q: term, limit: 20 },
    });
  }
}
```

Nothing hits the network until `.subscribe()` (or `async` pipe, or `firstValueFrom`) is called:

```typescript
this.userService.getUsers().subscribe(users => {
  console.log(users); // request fires only here
});
```

---

## 4. POST, PUT, and DELETE Requests

```typescript
interface CreateUserDto {
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = 'https://api.example.com/users';

  createUser(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.baseUrl, dto);
  }

  updateUser(id: number, dto: Partial<CreateUserDto>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, dto);
  }

  patchUser(id: number, dto: Partial<CreateUserDto>): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}`, dto);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

| Method | Verb | Body? | Typical Use |
|--------|------|-------|-------------|
| `.get<T>()` | GET | No | Fetch a resource / list |
| `.post<T>()` | POST | Yes | Create a new resource |
| `.put<T>()` | PUT | Yes | Replace a resource fully |
| `.patch<T>()` | PATCH | Yes | Partially update a resource |
| `.delete<T>()` | DELETE | Optional | Remove a resource |

Angular serializes plain object bodies to JSON automatically and sets `Content-Type: application/json` — you don't call `JSON.stringify()` yourself.

---

## 5. Typed Responses with Generics

Every `HttpClient` method accepts a generic type parameter — this is what gives you compile-time safety instead of `any`:

```typescript
// Untyped — response is `Object`, no autocomplete, no compile errors on typos
this.http.get('/api/users').subscribe(res => console.log(res.nam)); // no error, but wrong

// Typed — response is `User[]`, TypeScript catches mistakes
this.http.get<User[]>('/api/users').subscribe(users => {
  users.forEach(u => console.log(u.name)); // autocomplete + type-checked
});
```

You can also request the **full response** (headers, status) instead of just the body:

```typescript
import { HttpResponse } from '@angular/common/http';

this.http.get<User[]>(this.baseUrl, { observe: 'response' })
  .subscribe((res: HttpResponse<User[]>) => {
    console.log(res.status);           // 200
    console.log(res.headers.get('x-total-count'));
    console.log(res.body);             // User[]
  });
```

`observe` options: `'body'` (default, just the parsed body), `'response'` (full `HttpResponse<T>`), `'events'` (every `HttpEvent`, useful for upload progress).

---

## 6. Observables, Subscribing, and the Async Pipe

Manually subscribing means you own the subscription lifecycle — forget to unsubscribe on a long-lived service call and you can leak memory or duplicate side effects.

```typescript
// Manual subscribe — must unsubscribe in ngOnDestroy
export class UserListComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  users: User[] = [];

  ngOnInit() {
    this.sub = this.userService.getUsers().subscribe(users => this.users = users);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
```

The **async pipe** subscribes and unsubscribes automatically when the template is destroyed — no manual bookkeeping, no leaks:

```typescript
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [AsyncPipe, NgFor],
  template: `
    @if (users$ | async; as users) {
      <ul>
        @for (user of users; track user.id) {
          <li>{{ user.name }} — {{ user.email }}</li>
        }
      </ul>
    } @else {
      <p>Loading users…</p>
    }
  `,
})
export class UserListComponent {
  private userService = inject(UserService);
  users$ = this.userService.getUsers();
}
```

Prefer the `async` pipe (or Signals via `toSignal()`, covered in Phase 09) for template-bound data. Reserve manual `.subscribe()` for side effects that aren't rendered directly (navigation, toasts, triggering another request).

---

## 7. Worked Example: A Data Service Calling a REST API

A complete, realistic service + component pair for a "Products" feature:

```typescript
// product.model.ts
export interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}

export type CreateProductDto = Omit<Product, 'id'>;
```

```typescript
// product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, CreateProductDto } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/products';

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, dto);
  }

  update(id: number, dto: Partial<CreateProductDto>): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

```typescript
// product-list.component.ts
import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ProductService } from './product.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <h2>Products</h2>
    @if (products$ | async; as products) {
      <table>
        <tr><th>Name</th><th>Price</th><th>Stock</th></tr>
        @for (p of products; track p.id) {
          <tr>
            <td>{{ p.name }}</td>
            <td>{{ p.price | currency }}</td>
            <td>{{ p.inStock ? 'Yes' : 'No' }}</td>
          </tr>
        }
      </table>
    }
  `,
})
export class ProductListComponent {
  private productService = inject(ProductService);
  products$ = this.productService.getAll();
}
```

Notice the component has zero HTTP knowledge — it depends only on `ProductService`, which is the seam you'll mock in unit tests (Phase 11) and where interceptors (Lesson 02) transparently attach auth headers.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a standalone app, add `provideHttpClient()` to `app.config.ts`, and write a `PostService` that calls `https://jsonplaceholder.typicode.com/posts` with a typed `Post[]` GET request.

**Exercise 2:** Add `createPost(dto)`, `updatePost(id, dto)`, and `deletePost(id)` methods to `PostService` using POST, PUT, and DELETE respectively. Verify each request in the browser's Network tab.

**Exercise 3:** Build a `PostListComponent` that renders posts using the `async` pipe and the `@for` control-flow block — no manual `.subscribe()` allowed.

**Exercise 4:** Use `{ observe: 'response' }` on a GET request and log the response status code and a custom header (e.g. inspect `res.headers.keys()`).

**Exercise 5:** Add a search box that calls `searchUsers(term)` on every keystroke using `switchMap`, and confirm (via Network tab) that a fast typer only sees the *latest* request's response applied — no need to write the debounce logic yet, just observe the behavior.

---

## 9. Interview Q&A

**Q: Why does an HTTP request not fire until you subscribe?**
Answer: `HttpClient` methods return cold observables — the actual HTTP call is only made when a subscriber attaches (via `.subscribe()`, the `async` pipe, or `firstValueFrom`/`lastValueFrom`). This makes requests cancellable (unsubscribing aborts the underlying XHR/fetch) and lets you compose requests with RxJS operators before anything hits the network.

**Q: What is the benefit of typing HTTP responses with generics, e.g. `http.get<User[]>(url)`?**
Answer: It gives you compile-time type checking and IDE autocomplete on the response shape, catching typos and shape mismatches (like `user.emial`) before runtime. Without it, the response defaults to `Object`, and consuming code loses all type safety.

**Q: Why prefer the async pipe over manually subscribing in a component?**
Answer: The async pipe subscribes when the template renders and automatically unsubscribes when the component is destroyed, eliminating an entire class of memory leaks and boilerplate `ngOnDestroy` cleanup. It also plays well with `OnPush` change detection since it marks the component dirty on each emission.

**Q: How do you provide HttpClient in a standalone Angular application?**
Answer: Call `provideHttpClient()` inside the `providers` array of your `ApplicationConfig` (usually in `app.config.ts`), optionally composed with `withInterceptors([...])` for functional interceptors or `withFetch()` to use the Fetch API. There's no `HttpClientModule` to import in the modern standalone API — `provideHttpClient()` fully replaces it.

**Q: What's the difference between `observe: 'body'` and `observe: 'response'`?**
Answer: `observe: 'body'` (the default) resolves the observable to just the parsed response body, typed as `T`. `observe: 'response'` resolves to a full `HttpResponse<T>` object exposing `status`, `headers`, and `body` — useful when you need response headers (e.g. pagination totals) or the status code alongside the data.
