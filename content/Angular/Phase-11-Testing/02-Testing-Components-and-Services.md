# Testing Components and Services — Complete Guide

## Table of Contents
1. [Testing the Rendered Template](#1-testing-the-rendered-template)
2. [Querying the DOM with By.css](#2-querying-the-dom-with-bycss)
3. [Testing Services with HttpClientTestingModule](#3-testing-services-with-httpclienttestingmodule)
4. [Testing Async Code: fakeAsync, tick, waitForAsync](#4-testing-async-code-fakeasync-tick-waitforasync)
5. [Worked Example: Component + HTTP Service](#5-worked-example-component--http-service)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Testing the Rendered Template

Lesson 01 tested a component's class in isolation. Real confidence often comes from asserting against what the user actually sees — the rendered DOM.

```
fixture.componentInstance   → the TypeScript class instance
fixture.nativeElement       → the root DOM element (HTMLElement)
fixture.debugElement        → Angular's wrapper around the DOM, with query helpers
fixture.detectChanges()     → runs change detection, syncs template with component state
```

```typescript
it('should render the greeting text', () => {
  const fixture = TestBed.createComponent(GreetingComponent);
  fixture.componentInstance.name = 'Ganesh';
  fixture.detectChanges(); // sync the template

  const text = fixture.nativeElement.querySelector('p').textContent;
  expect(text).toContain('Hello, Ganesh!');
});
```

Forgetting `detectChanges()` after changing a property is the most common cause of a test asserting against stale, pre-update DOM content.

---

## 2. Querying the DOM with By.css

`fixture.debugElement.query(By.css(...))` is the idiomatic way to find elements — it works whether or not `CUSTOM_ELEMENTS_SCHEMA` or shadow boundaries are involved, and integrates with Angular's debugging metadata.

```typescript
import { By } from '@angular/platform-browser';

it('should increment count when button is clicked', () => {
  const fixture = TestBed.createComponent(CounterComponent);
  fixture.detectChanges();

  const button = fixture.debugElement.query(By.css('button'));
  button.triggerEventHandler('click', null);
  fixture.detectChanges();

  const paragraph = fixture.debugElement.query(By.css('p')).nativeElement;
  expect(paragraph.textContent).toContain('Count: 1');
});
```

### Common Query Patterns

| Pattern | Use case |
|---------|---------|
| `By.css('button')` | Find by CSS selector (tag, class, attribute) |
| `By.css('[data-testid="submit"]')` | Find by a stable test attribute (preferred over classes) |
| `By.directive(MyDirective)` | Find elements hosting a specific directive/component |
| `fixture.debugElement.queryAll(By.css('li'))` | Find all matches, returns an array |
| `button.nativeElement.click()` | Dispatch a real DOM click event |
| `button.triggerEventHandler('click', event)` | Simulate an event without needing a real DOM event object |

`nativeElement.click()` is closer to real user interaction; `triggerEventHandler` is faster and works even for custom output bindings.

---

## 3. Testing Services with HttpClientTestingModule

Services that call `HttpClient` shouldn't hit a real network in tests. Angular provides `provideHttpClientTesting()` (standalone-style, replacing the older `HttpClientTestingModule` import) plus `HttpTestingController` to intercept and assert on outgoing requests.

```typescript
// user.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface User {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}

  getUser(id: number) {
    return this.http.get<User>(`/api/users/${id}`);
  }
}
```

```typescript
// user.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // fails the test if there are unmatched/unexpected requests
  });

  it('should fetch a user by id', () => {
    const mockUser = { id: 1, name: 'Ganesh' };

    service.getUser(1).subscribe((user) => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/users/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser); // respond with fake data
  });

  it('should surface an error response', () => {
    service.getUser(99).subscribe({
      next: () => fail('expected an error'),
      error: (err) => expect(err.status).toBe(404),
    });

    const req = httpMock.expectOne('/api/users/99');
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
  });
});
```

`httpMock.verify()` in `afterEach` is important — it catches requests your code fired that the test never asserted on, preventing silent gaps in coverage.

---

## 4. Testing Async Code: fakeAsync, tick, waitForAsync

Real async operations (`setTimeout`, `Promise`, RxJS `debounceTime`) can't be awaited cleanly inside a synchronous Jasmine `it`. Angular provides two zone-based helpers.

### `fakeAsync` + `tick()`

`fakeAsync` runs the test in a special zone where time is simulated. `tick(ms)` manually advances the virtual clock, flushing any pending timers/microtasks up to that point — no real waiting occurs.

```typescript
import { fakeAsync, tick } from '@angular/core/testing';

it('should show the message after a 2s delay', fakeAsync(() => {
  const fixture = TestBed.createComponent(DelayedMessageComponent);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).not.toContain('Done!');

  tick(2000); // instantly fast-forward 2 virtual seconds
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Done!');
}));
```

### `waitForAsync`

`waitForAsync` (formerly `async`) wraps a test that contains genuine async operations (e.g. real promises), letting Angular's testing zone wait for all pending async tasks to complete before the spec finishes — useful mainly for `compileComponents()` when a component has an external templateUrl, or wrapping tests that involve real `Promise` chains rather than timers.

```typescript
import { waitForAsync } from '@angular/core/testing';

it('should load data on init', waitForAsync(() => {
  const fixture = TestBed.createComponent(DataComponent);
  fixture.detectChanges();

  fixture.whenStable().then(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loaded');
  });
}));
```

### When to Use Which

| Scenario | Tool |
|----------|------|
| `setTimeout`, `setInterval`, RxJS `delay`/`debounceTime` | `fakeAsync` + `tick()` |
| Real `Promise` resolution, `compileComponents()` with external templates | `waitForAsync` |
| Simple synchronous state change | Neither — a plain `it(() => {...})` is enough |

---

## 5. Worked Example: Component + HTTP Service

A component that fetches a user from `UserService` on init and renders the name, tested end-to-end at the component level with a spy (not real HTTP).

```typescript
// user-card.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { UserService } from './user.service';

@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `
    @if (userName()) {
      <p data-testid="user-name">{{ userName() }}</p>
    } @else {
      <p data-testid="loading">Loading...</p>
    }
  `,
})
export class UserCardComponent implements OnInit {
  userName = signal<string | null>(null);

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getUser(1).subscribe((user) => {
      this.userName.set(user.name);
    });
  }
}
```

```typescript
// user-card.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { UserCardComponent } from './user-card.component';
import { UserService } from './user.service';

describe('UserCardComponent', () => {
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUser']);

    await TestBed.configureTestingModule({
      imports: [UserCardComponent],
      providers: [{ provide: UserService, useValue: userServiceSpy }],
    }).compileComponents();
  });

  it('should show loading state before the response arrives', () => {
    userServiceSpy.getUser.and.returnValue(of({ id: 1, name: 'Ganesh' }));

    const fixture = TestBed.createComponent(UserCardComponent);
    // No detectChanges() yet — ngOnInit hasn't run, subscribe hasn't resolved.
    const loading = fixture.debugElement.query(By.css('[data-testid="loading"]'));
    expect(loading).toBeTruthy();
  });

  it('should render the user name once the service responds', () => {
    userServiceSpy.getUser.and.returnValue(of({ id: 1, name: 'Ganesh' }));

    const fixture = TestBed.createComponent(UserCardComponent);
    fixture.detectChanges(); // triggers ngOnInit; of() emits synchronously

    const nameEl = fixture.debugElement.query(By.css('[data-testid="user-name"]'));
    expect(nameEl.nativeElement.textContent).toContain('Ganesh');
    expect(userServiceSpy.getUser).toHaveBeenCalledWith(1);
  });
});
```

Using `of(...)` from RxJS as the spy's return value is a common trick: it emits synchronously, so no `fakeAsync`/`tick` is needed to assert against the result inside a normal `it`.

---

## 6. Hands-On Exercises

**Exercise 1:** Write a spec for a `TodoListComponent` that renders an `<li>` per item in an `items` input array. Use `fixture.debugElement.queryAll(By.css('li'))` to assert the correct number of items render.

**Exercise 2:** Add a `data-testid="delete-btn"` to a delete button in a component template. Write a test that queries it with `By.css('[data-testid="delete-btn"]')`, triggers a click, and asserts the item is removed from the list.

**Exercise 3:** Write a service spec for a `ProductService.getProducts()` method using `provideHttpClientTesting()` and `HttpTestingController`. Assert the request URL, method, and that `httpMock.verify()` passes with no outstanding requests.

**Exercise 4:** Write a `fakeAsync` test for a search component that calls an API after a 300ms debounce. Use `tick(300)` to flush the debounce and assert the API spy was called exactly once even if the input changed multiple times within the window.

**Exercise 5:** Take the `UserCardComponent` worked example and add an error-path test: make the spy return `throwError(() => new Error('failed'))` instead of `of(...)`, and assert the component shows an error message instead of crashing.

---

## 7. Interview Q&A

**Q: What's the difference between `fixture.nativeElement` and `fixture.debugElement`?**
Answer: `nativeElement` is the raw DOM `HTMLElement` — you query it with standard DOM APIs like `querySelector`. `debugElement` is Angular's wrapper around it that exposes framework-aware query helpers (`By.css`, `By.directive`) and metadata like injected providers, which plain DOM APIs can't see.

**Q: Why use `provideHttpClientTesting()` instead of letting a service hit a real backend in tests?**
Answer: Real HTTP calls make tests slow, flaky (network dependent), and impossible to run in CI without a live backend. `provideHttpClientTesting()` combined with `HttpTestingController` intercepts outgoing requests, lets the test assert on their URL/method/body, and responds with controlled fake data via `req.flush()` — keeping the test fast and deterministic.

**Q: What does `httpMock.verify()` do and why call it in `afterEach`?**
Answer: It asserts that every HTTP request made during the test was matched by an `expectOne`/`match` call — if the code under test fired a request the test never checked, `verify()` fails. Running it in `afterEach` catches untested request paths automatically across every spec in the suite.

**Q: When would you use `fakeAsync`/`tick` instead of `waitForAsync`?**
Answer: `fakeAsync` with `tick()` is for code driven by timers or scheduler-based async (`setTimeout`, `setInterval`, RxJS `delay`/`debounceTime`) — it lets you instantly fast-forward virtual time without waiting in real time. `waitForAsync` is for code with genuine async operations like real Promise resolution, where you can't just "fast forward" and instead need the test zone to wait until pending async work settles.

**Q: Why did the worked example's "loading" test skip calling `fixture.detectChanges()`?**
Answer: `ngOnInit` — where the service call happens — only runs on the first `detectChanges()` call. By asserting before that call, the test captures the initial synchronous state, which correctly reflects what the user sees for the brief moment before the component's `OnInit` logic executes.
