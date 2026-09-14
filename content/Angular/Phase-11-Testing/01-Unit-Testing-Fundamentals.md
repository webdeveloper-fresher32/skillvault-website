# Unit Testing Fundamentals — Complete Guide

## Table of Contents
1. [Why Unit Test Angular Apps](#1-why-unit-test-angular-apps)
2. [Jasmine: describe, it, expect](#2-jasmine-describe-it-expect)
3. [Karma: The Test Runner](#3-karma-the-test-runner)
4. [TestBed and Standalone Components](#4-testbed-and-standalone-components)
5. [Writing a Basic Component Test](#5-writing-a-basic-component-test)
6. [Spies: Mocking Dependencies](#6-spies-mocking-dependencies)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Unit Test Angular Apps

A unit test verifies a single piece of code — a component, service, or pipe — in isolation, with all its dependencies replaced by fakes. Angular ships with the tooling to do this out of the box:

```
Jasmine  → the testing framework (describe/it/expect syntax, spies)
Karma    → the test runner (launches a browser, executes specs, reports results)
TestBed  → Angular's own utility for building a mini testing module per test
```

```
Without tests:                          With tests:
  Refactor → deploy → hope                Refactor → run tests → know immediately
  Bug found by users in prod              Bug caught in CI before merge
  Fear of touching old code               Confidence to change old code
```

Angular CLI projects come preconfigured with Jasmine + Karma — every `ng generate component` scaffolds a matching `.spec.ts` file automatically.

---

## 2. Jasmine: describe, it, expect

Jasmine organizes tests into **suites** (`describe`) containing **specs** (`it`), each making one or more **assertions** (`expect`).

```typescript
describe('Calculator', () => {
  let result: number;

  beforeEach(() => {
    result = 0; // runs before every spec in this suite
  });

  it('should add two numbers', () => {
    result = 2 + 3;
    expect(result).toBe(5);
  });

  it('should not equal a wrong sum', () => {
    result = 2 + 3;
    expect(result).not.toBe(6);
  });

  afterEach(() => {
    result = 0; // cleanup after every spec
  });
});
```

### Common Matchers

| Matcher | Meaning |
|---------|---------|
| `toBe(x)` | Strict equality (`===`) |
| `toEqual(x)` | Deep equality (objects/arrays) |
| `toBeTruthy()` / `toBeFalsy()` | Truthiness check |
| `toBeNull()` / `toBeUndefined()` | Null/undefined check |
| `toContain(x)` | Array/string contains `x` |
| `toHaveBeenCalled()` | Spy was invoked |
| `toThrow()` | Function throws an error |

### Nesting Suites

```typescript
describe('UserService', () => {
  describe('when user is logged in', () => {
    it('should return the display name', () => { /* ... */ });
  });

  describe('when user is logged out', () => {
    it('should return "Guest"', () => { /* ... */ });
  });
});
```

Nesting groups related behavior and produces readable, hierarchical test output.

---

## 3. Karma: The Test Runner

Karma launches a real browser (Chrome by default via ChromeHeadless), injects your compiled spec files, and reports pass/fail results back to the terminal.

```bash
ng test                       # runs Karma in watch mode, re-runs on file save
ng test --no-watch --browsers=ChromeHeadless   # single run, CI-friendly
ng test --code-coverage       # generates a coverage/ report
```

`karma.conf.js` (or the `test` builder options in `angular.json`) configures:

```
frameworks: ['jasmine']        // Jasmine provides describe/it/expect
browsers: ['Chrome']           // which browser(s) to launch
reporters: ['progress', 'kjhtml']
files: [...]                   // which spec files to include
```

Every file matching `*.spec.ts` is picked up automatically — no manual registration needed.

Note: newer Angular CLI versions (17+) also support swapping Karma for **Jest** or the **Web Test Runner** via `ng generate` builder options, but Karma remains the default and is what this course uses.

---

## 4. TestBed and Standalone Components

`TestBed` is Angular's own test harness. It builds a small Angular testing module (`configureTestingModule`) so a component can be instantiated with real Angular machinery (change detection, DI) instead of running as a plain class.

For a **standalone component**, you import it directly — there's no `NgModule` `declarations` array anymore:

```typescript
import { TestBed } from '@angular/core/testing';
import { CounterComponent } from './counter.component';

describe('CounterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounterComponent], // standalone components go in `imports`
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
```

Key `TestBed` pieces:

| API | Purpose |
|-----|---------|
| `TestBed.configureTestingModule({...})` | Declares imports/providers for the test module |
| `TestBed.createComponent(Component)` | Creates a `ComponentFixture` wrapping an instance |
| `fixture.componentInstance` | The actual component class instance |
| `fixture.detectChanges()` | Triggers Angular change detection (runs `ngOnInit`, updates bindings) |
| `TestBed.inject(Service)` | Retrieves a provider from the testing module's injector |

---

## 5. Writing a Basic Component Test

```typescript
// counter.component.ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">+</button>
  `,
})
export class CounterComponent {
  count = signal(0);

  increment(): void {
    this.count.update((c) => c + 1);
  }
}
```

```typescript
// counter.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { CounterComponent } from './counter.component';

describe('CounterComponent', () => {
  let component: CounterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounterComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(CounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start at 0', () => {
    expect(component.count()).toBe(0);
  });

  it('should increment the count', () => {
    component.increment();
    expect(component.count()).toBe(1);
  });

  it('should increment twice correctly', () => {
    component.increment();
    component.increment();
    expect(component.count()).toBe(2);
  });
});
```

This test never touches the DOM — it exercises the component class directly. That's enough for testing pure logic; Lesson 02 covers asserting against the rendered template.

---

## 6. Spies: Mocking Dependencies

A **spy** replaces a real function with a fake one you can inspect (was it called? with what arguments? what did it return?) — essential for isolating a unit from its real dependencies (HTTP calls, other services, timers).

### `jasmine.createSpy` — a standalone fake function

```typescript
it('should call the callback when clicked', () => {
  const onClickSpy = jasmine.createSpy('onClick');
  onClickSpy('button-1');

  expect(onClickSpy).toHaveBeenCalled();
  expect(onClickSpy).toHaveBeenCalledWith('button-1');
  expect(onClickSpy).toHaveBeenCalledTimes(1);
});
```

### `jasmine.createSpyObj` — a fake object with multiple spy methods

Use this to mock an entire service so a component under test never touches the real implementation:

```typescript
import { TestBed } from '@angular/core/testing';
import { UserProfileComponent } from './user-profile.component';
import { AuthService } from './auth.service';

describe('UserProfileComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'logout']);
    authServiceSpy.getCurrentUser.and.returnValue({ id: 1, name: 'Ganesh' });

    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }],
    }).compileComponents();
  });

  it('should display the current user name', () => {
    const fixture = TestBed.createComponent(UserProfileComponent);
    fixture.detectChanges();

    expect(authServiceSpy.getCurrentUser).toHaveBeenCalled();
    expect(fixture.componentInstance.userName).toBe('Ganesh');
  });
});
```

### Spy Configuration Methods

| Method | Effect |
|--------|--------|
| `.and.returnValue(x)` | Spy returns `x` when called |
| `.and.callThrough()` | Spy calls the real implementation but still tracks calls |
| `.and.callFake(fn)` | Spy runs a custom fake function |
| `.and.throwError('msg')` | Spy throws when called |

Spies replace real dependencies with lightweight, controllable substitutes — the component under test never knows the difference.

---

## 7. Hands-On Exercises

**Exercise 1:** Create a standalone `GreetingComponent` with a `name` input and a template rendering `Hello, {{ name }}!`. Write a spec that uses `TestBed` to create the component, set the input, and assert the property is correctly received.

**Exercise 2:** Write a `describe` block for a `StringUtils` class with methods `capitalize()` and `reverse()`. Write at least 3 `it` specs total, using `toBe` and `toEqual` matchers.

**Exercise 3:** Create a spy with `jasmine.createSpy('save')` and pass it as a callback to a function. Assert it was called exactly once with a specific argument using `toHaveBeenCalledWith`.

**Exercise 4:** Create a `NotificationService` interface with `send(message: string): void`. Use `jasmine.createSpyObj` to mock it, provide the spy via `TestBed.configureTestingModule({ providers: [...] })`, and assert a component calls `send` when a button's click handler runs.

**Exercise 5:** Run `ng test --code-coverage` on a small project and open the generated `coverage/index.html` report. Identify one file with low statement coverage and add a spec to improve it.

---

## 8. Interview Q&A

**Q: What's the difference between Jasmine and Karma?**
Answer: Jasmine is the testing framework — it provides the `describe`/`it`/`expect` syntax, matchers, and spies used to write test specs. Karma is the test runner — it launches a real browser, loads the compiled spec files, executes them, and reports pass/fail results. Jasmine writes the tests; Karma runs them.

**Q: Why do you need `TestBed.configureTestingModule` instead of just `new MyComponent()`?**
Answer: Instantiating a component directly with `new` bypasses Angular's dependency injection, change detection, and template compilation — none of the framework machinery runs. `TestBed` builds a real (if minimal) Angular testing module, so the component behaves as it would in the actual app: DI resolves its dependencies, `ngOnInit` fires, and template bindings update.

**Q: What is `fixture.detectChanges()` and when do you need to call it?**
Answer: It manually triggers Angular's change detection cycle inside a test, since tests don't run inside NgZone's automatic detection loop. Call it once after creating the fixture to run `ngOnInit` and render the initial template, and again after changing component state if you need the DOM to reflect the update before asserting against it.

**Q: What's the difference between `jasmine.createSpy` and `jasmine.createSpyObj`?**
Answer: `createSpy` creates a single fake function you can pass around and inspect. `createSpyObj` creates a fake object with several spy methods at once (e.g., mocking an entire service's public API), which is the standard way to substitute an injected dependency in a component test.

**Q: Why mock a service with a spy instead of using the real implementation in a component test?**
Answer: Using the real service would make the test depend on network calls, timers, or other side effects outside the component's own logic — turning a unit test into a slow, flaky integration test. A spy gives full control over return values and lets you assert exactly how the component interacted with its dependency, keeping the test fast, deterministic, and focused on one unit.
