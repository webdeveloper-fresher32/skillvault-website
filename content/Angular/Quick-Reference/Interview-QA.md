# Angular Interview Q&A

50 questions covering the full Angular course, organized by topic.

---

## Fundamentals & TypeScript/RxJS (Q1-Q10)

**Q1. What is Angular and how does it differ from a library like React?**
Answer: Angular is a full-featured, opinionated framework for building single-page applications, providing routing, dependency injection, forms, HTTP client, and a build system out of the box in one cohesive package. React is a view library focused solely on rendering UI, requiring you to assemble routing, state management, and other concerns from the ecosystem yourself. Angular uses TypeScript by default and a component/template model with decorators, while React uses JSX and plain functions/hooks. Because Angular ships batteries-included, teams get consistent conventions across projects, at the cost of a steeper learning curve and more upfront structure.

---

**Q2. What are the benefits of using TypeScript with Angular?**
Answer: TypeScript adds static typing on top of JavaScript, catching type errors, typos, and incorrect API usage at compile time rather than at runtime. It enables rich IDE features — autocomplete, inline documentation, safe refactoring, and "go to definition" — which is invaluable in large codebases. Angular's own APIs (decorators, dependency injection, generics in HttpClient) are designed around TypeScript's type system, so using it unlocks stronger guarantees, e.g., `HttpClient.get<User[]>()` gives you a typed response. Interfaces and generics also make component contracts (`@Input`/`@Output` types) self-documenting.

---

**Q3. Explain the difference between an `interface` and a `type` alias in TypeScript.**
Answer: Both describe the shape of an object, but interfaces can be reopened and merged via declaration merging (multiple `interface Foo {}` declarations combine), while type aliases are closed once declared. Type aliases can also represent unions, intersections, tuples, and mapped types (`type Status = 'active' | 'inactive'`), which interfaces cannot express directly. In Angular codebases, interfaces are commonly preferred for object/data models (like a `User` shape) because they read naturally and support extension (`interface Admin extends User`), while type aliases are used for unions and utility compositions.

---

**Q4. What are generics in TypeScript and where does Angular use them?**
Answer: Generics let you write reusable, type-safe code that operates over a placeholder type rather than a fixed type, specified at the call site — e.g., `function identity<T>(arg: T): T`. Angular uses generics extensively: `HttpClient.get<User>(url)` types the response body, `EventEmitter<T>` types the payload emitted by an `@Output()`, and `FormControl<string>` (in typed reactive forms) constrains the control's value type. Using generics correctly means the compiler catches mismatches, like trying to assign a `number` where a `User` is expected, without any runtime cost.

---

**Q5. What is an RxJS Observable and how does it differ from a Promise?**
Answer: An Observable is a lazy, push-based stream that can emit zero, one, or many values over time and supports cancellation via unsubscription. A Promise represents a single eventual value (or rejection) and is eager — the underlying work starts as soon as the Promise is created, and it cannot be cancelled once started. Observables are composable through operators (`map`, `filter`, `switchMap`), enabling declarative pipelines for events, HTTP calls, or user input streams, whereas Promises only chain sequentially via `.then()`. Angular's `HttpClient` returns Observables specifically so requests can be cancelled (e.g., when a component is destroyed) and combined with operators like `switchMap` for typeahead search.

---

**Q6. What is the difference between a hot and a cold Observable?**
Answer: A cold Observable creates a new, independent producer for each subscriber — the source data (e.g., an HTTP request) starts fresh every time `subscribe()` is called, so two subscribers get two separate executions. A hot Observable shares a single producer across all subscribers — subscribers receive whatever values are emitted after they subscribe, similar to tuning into a live broadcast. `HttpClient` requests are cold (each subscription triggers a new HTTP call), while a `Subject` or a DOM event stream is hot because the source exists independently of any particular subscriber.

---

**Q7. What is a Subject, and how does it differ from BehaviorSubject and ReplaySubject?**
Answer: A `Subject` is both an Observable and an Observer — it multicasts values to all current subscribers but does not store or replay any value, so late subscribers miss everything emitted before they subscribed. A `BehaviorSubject` requires an initial value, always retains the current/latest value, and immediately emits it to any new subscriber — useful for representing current state (e.g., current user, loading flag). A `ReplaySubject` buffers a configurable number of past emissions and replays them to new subscribers, useful for caching a stream of historical events. Angular services commonly expose state through a private `BehaviorSubject` and a public read-only Observable (`asObservable()`).

---

**Q8. Why is unsubscribing from Observables important in Angular, and what are the common patterns to do it?**
Answer: If a component subscribes to a long-lived Observable (an interval timer, a WebSocket stream, or an event emitter) and never unsubscribes, the subscription's callback keeps a reference to the component alive after it is destroyed, causing a memory leak and potentially executing logic against a destroyed view. The common patterns are: use the `async` pipe in templates, which subscribes and automatically unsubscribes when the component is destroyed; store subscriptions and call `.unsubscribe()` in `ngOnDestroy`; or use the `takeUntil(this.destroy$)` operator with a `Subject` that emits in `ngOnDestroy`. Modern Angular also offers `takeUntilDestroyed()`, which ties automatically to the component's `DestroyRef` without manual subject bookkeeping.

---

**Q9. What is the difference between `map`, `switchMap`, `mergeMap`, `concatMap`, and `exhaustMap`?**
Answer: `map` transforms each emitted value synchronously without flattening — it does not deal with inner Observables. The other four ("flattening" operators) all take a function returning an inner Observable but differ in concurrency handling: `switchMap` cancels the previous inner Observable when a new source value arrives (ideal for typeahead search where only the latest query matters); `mergeMap` runs all inner Observables concurrently with no cancellation (good for parallel independent requests); `concatMap` queues inner Observables and runs them strictly in order, one at a time (good for sequential writes that must not race); and `exhaustMap` ignores new source emissions while an inner Observable is still active (good for preventing duplicate form submissions on repeated clicks).

---

**Q10. What are Angular's structural typing rules, and how do they affect component `@Input` bindings?**
Answer: TypeScript uses structural typing ("duck typing") — two types are compatible if their shapes match, regardless of declared name or inheritance, so an object literal satisfying a `User` interface's fields is assignable even without explicitly implementing it. This means `@Input()` properties typed as an interface will accept any object with the matching shape, which is convenient but can mask intent-level mismatches (e.g., passing a superset object with extra fields is allowed). It also means Angular relies on strict compiler options (`strict: true`, `strictTemplates`) in `tsconfig.json` to catch template binding type errors, since template type-checking uses the same structural rules as the rest of TypeScript.

---

## Components, Directives & Pipes (Q11-Q20)

**Q11. What is a standalone component and how does it differ from the traditional NgModule-based approach?**
Answer: A standalone component sets `standalone: true` in its `@Component` decorator and directly declares its own dependencies (other components, directives, pipes) in an `imports` array, eliminating the need to register it in an `NgModule`'s `declarations`. This removes an entire layer of boilerplate — no `AppModule`, `SharedModule`, or `FeatureModule` wiring — and makes each component's dependency graph explicit and colocated. Since Angular 17, standalone is the default scaffold from the CLI, and `bootstrapApplication()` replaces `platformBrowserDynamic().bootstrapModule()` as the app entry point. NgModules still exist for legacy codebases and certain library patterns, but new applications default to the standalone API.

---

**Q12. Explain the three types of data binding syntax in Angular templates.**
Answer: Property binding (`[property]="expression"`) sets a DOM property or `@Input()` from the component to the template, one-way, and is evaluated whenever the bound expression changes. Event binding (`(event)="handler($event)"`) listens for a DOM event or `@Output()` emission and calls a component method, flowing data from template to component. Two-way binding (`[(ngModel)]="value"` or the "banana in a box" syntax) combines both directions using the `[value]` + `(valueChange)` convention, so a change in either the model or the view stays in sync — commonly used for form inputs and custom components exposing an `@Input()`/`@Output()` pair named `x` and `xChange`.

---

**Q13. What is the difference between `@if`/`@for`/`@switch` (new control flow) and `*ngIf`/`*ngFor`/`*ngSwitch` (structural directives)?**
Answer: The new block syntax (`@if`, `@for`, `@switch`), introduced in Angular 17, is built directly into the template compiler rather than being implemented as structural directives, which makes it roughly 90% faster to render and removes the need to import `CommonModule` for basic control flow. `@for` requires an explicit `track` expression (unlike the optional `trackBy` function on `*ngFor`), which the compiler enforces to guarantee efficient DOM diffing. The old structural directives remain fully supported for backward compatibility, but new Angular code should default to the block syntax since it is simpler to read, produces smaller bundles, and offers built-in `@empty`/`@else` branches.

---

**Q14. What is `track` in a `@for` block and why is it required?**
Answer: `track` tells Angular's reconciliation algorithm which property uniquely identifies each item in the collection, so that when the array changes, Angular can match old DOM nodes to new data by identity instead of recreating every element. Using a stable key like `item.id` (`@for (item of items(); track item.id)`) allows Angular to reorder, insert, or remove only the affected DOM nodes, preserving component state, focus, and animations for unchanged items. If no stable identifier exists, `track $index` falls back to positional tracking, but this can cause unnecessary re-renders when the array is reordered rather than mutated in place. Unlike `*ngFor`'s optional `trackBy`, the new `@for` syntax makes `track` mandatory, preventing accidental full-list re-renders.

---

**Q15. What is `@defer` and what problem does it solve?**
Answer: `@defer` lets you split a template into a lazily-loaded chunk that is only fetched and rendered when a specified trigger occurs — `on viewport`, `on interaction`, `on hover`, `on idle`, `on timer(ms)`, or `on immediate`. This directly improves initial bundle size and Largest Contentful Paint because heavy components (charts, comment sections, rich editors) are excluded from the main bundle and only downloaded when actually needed. It also supports `@placeholder` (shown before the trigger fires), `@loading` (shown while the deferred chunk downloads, with optional minimum display time to avoid flicker), and `@error` (shown if loading fails), giving fine-grained control over the loading UX without manual dynamic `import()` wiring.

---

**Q16. How do you communicate between a parent and child component in Angular?**
Answer: Parent-to-child communication uses `@Input()` (or the signal-based `input()` function) to pass data down into the child's properties, bound in the parent's template with `[childProp]="value"`. Child-to-parent communication uses `@Output()` with an `EventEmitter` (or the signal-based `output()` function), where the child calls `.emit(value)` and the parent listens with `(childEvent)="onEvent($event)"`. For two-way flows, Angular supports the `model()` signal API (or the manual `[input]`/`(inputChange)` convention), enabling `[(value)]="parentSignal"` banana-in-a-box syntax on a custom component. For deeper or sibling communication, a shared service (often backed by a signal or `BehaviorSubject`) is the idiomatic approach instead of prop-drilling through many layers.

---

**Q17. What is content projection and how does `<ng-content>` work?**
Answer: Content projection lets a parent component pass arbitrary markup into a child component's template, rendered at the location of `<ng-content>`, similar to `children` in React or slots in Vue. A basic `<ng-content></ng-content>` projects everything placed between the component's opening and closing tags. Multi-slot projection uses the `select` attribute (`<ng-content select="[header]"></ng-content>`) to project only elements matching a given CSS selector into specific slots, letting a card component define separate header, body, and footer projection points. This pattern is central to building reusable "shell" components — modals, cards, tabs — where the container controls layout/behavior but the caller controls content.

---

**Q18. What is the difference between `ViewChild` and `ContentChild`?**
Answer: `@ViewChild()` queries an element or component defined in the component's own template (its view), and is available once `ngAfterViewInit` fires. `@ContentChild()` queries an element or component that was projected into the component via `<ng-content>` from a parent, and is available once `ngAfterContentInit` fires — earlier in the lifecycle than `ViewChild`. Both accept a template reference variable, a component type, or a directive type as the selector, and both have `*ViewChildren`/`*ContentChildren` plural variants returning a `QueryList` that emits a `changes` Observable when the matched elements update. Getting the timing wrong (e.g., reading a `ViewChild` in `ngOnInit`) is a common bug because the view has not yet been initialized at that point.

---

**Q19. How do you write a custom pipe, and when should a pipe be marked `pure`?**
Answer: A custom pipe implements the `PipeTransform` interface's `transform(value, ...args)` method and is registered via the `@Pipe({ name: 'myPipe' })` decorator (with `standalone: true` for standalone components). By default pipes are pure, meaning Angular only re-invokes `transform()` when the reference of the input value or its arguments changes, which is efficient because it skips recomputation on every change-detection cycle for unchanged references. An impure pipe (`pure: false`) re-runs on every change-detection cycle regardless of reference equality — necessary for pipes that need to react to internal mutations of an array/object (like an evolving list) — but this is expensive and should be used sparingly, usually replaced with recomputing a new reference and keeping the pipe pure.

---

**Q20. What is the difference between a component and a directive in Angular?**
Answer: A component is a directive with an associated template — it has a `selector`, a `template`/`templateUrl`, and renders its own view in the DOM. A directive (specifically an "attribute directive") has no template of its own; it attaches behavior or styling to an existing DOM element or component, referenced by attribute selector syntax like `[appHighlight]`. There is also a "structural directive" category (`@if`/`@for` under the hood, or `*ngIf`/`*ngFor` historically) that adds/removes/repeats elements from the DOM. In short: every component is a directive, but not every directive is a component — directives without templates are used purely to extend the behavior of existing elements.

---

## Services, DI & Routing (Q21-Q30)

**Q21. What is Dependency Injection and why does Angular use it so heavily?**
Answer: Dependency Injection (DI) is a design pattern where a class receives its dependencies from an external source rather than constructing them itself, decoupling consumers from concrete implementations. Angular's DI container resolves a dependency graph automatically — when a component asks for a `UserService`, Angular looks up (or creates) the appropriate instance and supplies it, based on the providers registered at various levels. This makes testing straightforward (dependencies can be swapped for mocks/stubs via `TestBed.configureTestingModule`), promotes single-responsibility design (services encapsulate one concern), and enables Angular to manage singleton lifecycles and tree-shaking (`providedIn: 'root'`) without any manual wiring.

---

**Q22. What does `providedIn: 'root'` mean, and how does it differ from providing a service in a component's `providers` array?**
Answer: `@Injectable({ providedIn: 'root' })` registers the service with the application's root injector as a singleton — the same instance is shared across the entire app, and because the registration is declared on the service itself, unused services can be tree-shaken out of the production bundle if nothing imports them. Providing a service in a component's `providers` array instead creates a new, separate instance scoped to that component and its descendants — every instance of that component gets its own copy of the service, useful for per-component state (e.g., a wizard step tracker) that shouldn't leak across sibling instances. Angular's hierarchical injector always resolves to the nearest provider walking up from the requesting component to the root.

---

**Q23. What is the `inject()` function and how does it compare to constructor injection?**
Answer: `inject()` is a function that retrieves a dependency from the current injection context, usable inside field initializers, factory functions, functional guards/interceptors/resolvers, and constructors — anywhere Angular's injection context is active. It achieves the same result as constructor injection (`constructor(private http: HttpClient) {}`) but is more flexible because it works in plain functions, which is what enables Angular's functional guards, resolvers, and interceptors that have no class or constructor at all. `inject()` also makes multiple inheritance/mixin scenarios and utility functions that need DI cleaner, since you're not forced to thread dependencies through a constructor signature. Constructor injection remains fully supported and is still common for simple services and components.

---

**Q24. What is hierarchical dependency injection in Angular?**
Answer: Angular builds a tree of injectors that mirrors the component tree — there is a root/platform injector, and each component (and each lazy-loaded route) can optionally introduce its own injector by declaring providers. When a component requests a dependency, Angular walks up from that component's injector toward the root, using the first matching provider it finds. This allows different branches of the app to receive different implementations of the same token (e.g., a feature module providing a scoped `ThemeService` that overrides the root one for just that subtree), and lets each lazy-loaded route get its own instance of route-scoped services without polluting the global singleton.

---

**Q25. What is an `InjectionToken` and when do you need one?**
Answer: An `InjectionToken` is used to create a DI token for dependencies that are not classes — configuration objects, primitive values (strings, numbers), or interfaces (which don't exist at runtime and so cannot be used as a provider token). You declare it with `new InjectionToken<T>('description')` and register a value with `{ provide: API_URL, useValue: 'https://api.example.com' }`, then retrieve it via `inject(API_URL)`. This pattern is essential for supplying environment-specific configuration, feature flags, or third-party library options through Angular's DI system rather than importing a config module directly, which keeps components testable by allowing the token's value to be overridden in tests.

---

**Q26. How does the Angular Router determine which component to render for a given URL, and what is route matching order?**
Answer: The Router evaluates the configured `Routes` array in order and matches the current URL segment against each route's `path`, using the first match found — so more specific routes must be declared before more general ones (a wildcard `**` route must always be last). Static segments must match exactly; `:param` segments capture a dynamic value accessible via `ActivatedRoute.paramMap`; and an empty path `''` matches the parent's base path exactly. Once a match is found, the Router either renders the associated `component`, lazily loads it via `loadComponent`/`loadChildren`, or redirects via `redirectTo`, and then renders the result inside the nearest `<router-outlet>`.

---

**Q27. What is the difference between `loadChildren` and `loadComponent` for lazy loading?**
Answer: `loadComponent` lazily loads a single standalone component for a specific route, splitting just that component (and its direct dependencies) into a separate chunk — ideal for lazily loading one page. `loadChildren` lazily loads an entire feature area, typically pointed at a file exporting an array of child `Routes` (e.g., `admin.routes.ts`), which can itself contain multiple further `loadComponent` entries — this splits a whole feature module's worth of routes, guards, and components into one chunk downloaded only when the user navigates into that section. Both are declared as arrow functions returning a dynamic `import()`, which is what triggers Angular's build tooling (via esbuild/Webpack) to create a separate lazy chunk.

---

**Q28. What are route guards, and what are the main types available?**
Answer: Route guards are functions (in modern Angular, typically written as `CanActivateFn`, `CanDeactivateFn`, `CanMatchFn`, etc., created via `inject()`) that the Router calls before allowing a navigation to proceed, complete, or match a route. `CanActivate` decides whether a route can be entered (e.g., checking authentication); `CanDeactivate` decides whether the user can leave the current route (e.g., warning about unsaved form changes); `CanMatch` decides whether a route config should even be considered a candidate match (useful for feature-flagging entire route branches); and `CanActivateChild` applies a guard to all child routes of a parent. Guards return `true`, `false`, a `UrlTree` (for redirecting), or an `Observable`/`Promise` resolving to one of those.

---

**Q29. What is a route resolver and when should you use one?**
Answer: A resolver (`ResolveFn`) is a function the Router runs before activating a route, fetching data needed by the destination component so that the component is only rendered once that data is ready — avoiding a flash of empty state followed by a loading spinner inside the component itself. The resolved data becomes available on `ActivatedRoute.data` (or as a route-bound input if `withComponentInputBinding()` is enabled). Resolvers are best used for data that is required before the page makes sense to show at all (a detail page's core entity), but should be used sparingly for anything slow, since the Router blocks navigation until the resolver completes — data that can be shown progressively is often better fetched inside the component with its own loading state instead.

---

**Q30. How do you pass and read route parameters, query parameters, and route data in Angular?**
Answer: Route parameters (`:id` segments) are read via `route.snapshot.paramMap.get('id')` for a one-time read, or `route.paramMap.subscribe(...)` (an Observable) to react to param changes when navigating between sibling routes that reuse the same component instance. Query parameters (`?page=2`) are read similarly via `route.queryParamMap` and set programmatically with `router.navigate([], { queryParams: { page: 2 } })`. Static route data (like a page title or a required role) is declared in the route config's `data: {}` object and read via `route.data`. Since Angular 16+, `withComponentInputBinding()` can bind route params, query params, and data directly to component `@Input()`s automatically, removing the need for manual `ActivatedRoute` subscriptions in many cases.

---

## Forms, HTTP & RxJS Patterns (Q31-Q40)

**Q31. What is the difference between Template-driven forms and Reactive forms?**
Answer: Template-driven forms build the form model implicitly in the template using directives like `ngModel` and `ngForm`, with validation expressed as HTML attributes (`required`, `minlength`) — simple to set up for small forms but harder to unit test and less explicit about the form's shape. Reactive forms build the form model explicitly in the component class using `FormGroup`, `FormControl`, and `FormArray`, with validators supplied as functions (`Validators.required`) — this makes the form's structure, validation, and value changes fully typed, synchronous, and testable without touching the DOM. Angular's official guidance favors Reactive forms for anything beyond the simplest cases because of their testability, composability (nested `FormGroup`s), and support for dynamic form controls.

---

**Q32. How do you build a nested form group with a `FormArray` in Reactive Forms?**
Answer: A `FormArray` represents a resizable list of controls or groups, useful for repeatable fields like a list of phone numbers or line items. You create it with `this.fb.array([])` inside a parent `FormGroup`, push new `FormGroup`/`FormControl` instances into it dynamically with `.push()`, and remove them with `.removeAt(index)`. In the template, you iterate the array's `.controls` with `@for` (or `*ngFor`), binding each item with `[formGroupName]="i"` or `[formControlName]="i"` depending on whether each entry is a group or a plain control, wrapped inside a `formArrayName="items"` directive on the containing element.

---

**Q33. How do you write a custom synchronous validator and a custom asynchronous validator?**
Answer: A synchronous custom validator is a function matching `ValidatorFn`: `(control: AbstractControl) => ValidationErrors | null`, returning `null` when valid or an error object (e.g., `{ mismatch: true }`) when invalid; it's attached alongside built-in validators in the `Validators.compose([...])` array or as an extra array element. An asynchronous validator matches `AsyncValidatorFn`, returning an `Observable<ValidationErrors | null>` or `Promise`, used for checks that require a server round-trip (e.g., "is this username already taken?") — Angular automatically marks the control's status as `PENDING` while the async validator is in flight and updates to `VALID`/`INVALID` once it resolves. Async validators are typically debounced internally or rely on the control's `updateOn: 'blur'` setting to avoid firing on every keystroke.

---

**Q34. How does Angular's `HttpClient` differ from using the native `fetch()` API directly?**
Answer: `HttpClient` returns Observables instead of Promises, so requests are cancellable (unsubscribing aborts the underlying request) and composable with RxJS operators like `retry`, `switchMap`, and `catchError`. It automatically parses JSON responses, serializes request bodies, and integrates with Angular's interceptor chain for cross-cutting concerns (auth headers, logging, error handling) applied uniformly to every request. It also integrates with Angular's testing utilities (`HttpClientTestingModule`/`provideHttpClientTesting`) for easily mocking requests in unit tests, and (as of recent versions) can be configured to use the `fetch()` API under the hood via `withFetch()` for better compatibility with SSR and streaming, while keeping the same Observable-based API surface.

---

**Q35. What is an HTTP interceptor and what are common use cases for one?**
Answer: An interceptor sits in the middle of every outgoing `HttpClient` request and incoming response, able to inspect, modify, or short-circuit it before it reaches the server or the calling code. Common use cases: attaching an `Authorization` header with a bearer token to every request; centrally logging or timing all API calls; transforming error responses into a consistent shape and redirecting to a login page on 401 responses; retrying failed requests with backoff; and showing/hiding a global loading spinner by tracking in-flight request counts. Modern Angular defines interceptors as plain functions (`HttpInterceptorFn`) registered via `provideHttpClient(withInterceptors([...]))`, replacing the older class-based `HttpInterceptor` + `HTTP_INTERCEPTORS` multi-provider pattern.

---

**Q36. How do you handle and surface HTTP errors gracefully in an Angular application?**
Answer: The `catchError` RxJS operator intercepts an error emitted by the HTTP Observable pipeline, letting you inspect the `HttpErrorResponse` (status code, error body) and decide how to respond — return a fallback value with `of(...)`, rethrow a normalized error with `throwError(() => ...)`, or trigger a side effect like navigation. A common pattern centralizes this logic in an error interceptor that catches all HTTP errors globally (redirecting on 401, showing a toast on 5xx), while individual components/services still use `catchError` locally for request-specific fallback behavior (e.g., showing an inline "failed to load" message). Combining `retry(count)` before `catchError` also lets transient network errors self-heal without surfacing an error to the user at all.

---

**Q37. What is the purpose of `debounceTime` and `distinctUntilChanged` in a typeahead search implementation, and why are they usually paired?**
Answer: `debounceTime(300)` waits for a pause in emissions (e.g., the user stops typing for 300ms) before letting a value through, preventing an HTTP request from being fired on every keystroke. `distinctUntilChanged()` then suppresses a new emission if it is identical to the previous one, avoiding redundant requests when the debounced value happens not to have changed (e.g., typing then deleting back to the same string, or a duplicate event firing). Paired together and followed by `switchMap`, they form the canonical Angular typeahead pattern: debounce user input, skip no-op duplicates, then cancel any in-flight search and issue a new one for the latest term.

---

**Q38. What is optimistic vs. pessimistic UI updating when submitting a form, and how would you implement each with RxJS/HttpClient?**
Answer: A pessimistic update waits for the server's response before updating the UI — the form/component shows a loading state, calls `http.post(...)`, and only updates local state (or navigates away) inside the `subscribe`/`tap` success callback, guaranteeing the UI never shows data that wasn't actually persisted. An optimistic update immediately applies the change to local UI state (e.g., adds the new item to a signal-backed list) before the server confirms it, then reconciles or rolls back if the request fails, via `catchError` reverting the local state change. Optimistic updates make the UI feel instantaneous for high-confidence operations (toggling a checkbox, liking a post) but require careful rollback logic; pessimistic updates are safer for operations where failure is more consequential (submitting a payment, creating a critical record).

---

**Q39. How do reactive forms track validity, and what are the possible states of a `FormControl`?**
Answer: Each `FormControl`, `FormGroup`, and `FormArray` exposes a `status` that is one of `VALID`, `INVALID`, `PENDING` (while an async validator is running), or `DISABLED`. It also tracks `pristine`/`dirty` (whether the value has been changed from its initial value) and `untouched`/`touched` (whether the control has been blurred at least once), which templates use to decide when to show validation error messages — typically only after the user has interacted with a field (`touched`), to avoid showing errors immediately on page load. A parent `FormGroup`'s status aggregates its children: it is `INVALID` if any child control is invalid, and `PENDING` if any child has an async validator still running.

---

**Q40. What is the difference between `updateOn: 'change'`, `'blur'`, and `'submit'` in reactive forms?**
Answer: `updateOn` controls when a control's value and validity are recalculated and propagated to the form model. `'change'` (the default) updates on every keystroke/change event, giving real-time validation feedback but potentially causing excessive re-computation for expensive validators. `'blur'` defers updates until the control loses focus, which is useful for expensive synchronous validators or to avoid triggering async validators (like a uniqueness check) on every keystroke. `'submit'` defers all updates until the form is submitted, useful for forms where you want zero validation noise until the user explicitly submits, at the cost of no inline feedback during entry.

---

## Signals, Performance & Testing (Q41-Q50)

**Q41. What are Signals and what problem do they solve compared to Zone.js-based change detection?**
Answer: A Signal is a reactive primitive that wraps a value and notifies consumers precisely when that value changes, read by calling it as a function (`count()`). Historically, Angular used Zone.js to monkey-patch async browser APIs (setTimeout, event listeners, promises) so that after any async operation, Angular would run change detection across the entire component tree to check for updates — correct but coarse-grained and potentially wasteful at scale. Signals enable fine-grained reactivity: only the specific parts of the template that read a changed signal need to update, which is what allows Angular to move toward zoneless change detection, reducing unnecessary checks and improving runtime performance, especially in large component trees.

---

**Q42. What is the difference between `signal()`, `computed()`, and `effect()`?**
Answer: `signal(initialValue)` creates a writable, observable value updated via `.set()` or `.update()`. `computed(() => expression)` creates a read-only, memoized derived signal that automatically recalculates only when one of the signals it reads inside its function changes, and caches its result between reads (it will not needlessly recompute if read multiple times without a dependency changing). `effect(() => { ... })` registers a side effect that automatically re-runs whenever any signal read inside it changes — used for things like logging, syncing to localStorage, or imperative DOM manipulation — but should not be used to update other signals as a general pattern, since that couples reactive state in ways that are harder to reason about than `computed`.

---

**Q43. What are the signal-based `input()`, `output()`, and `model()` functions and how do they compare to the decorator-based `@Input()`/`@Output()`?**
Answer: `input()` declares a component input as a signal (`userId = input.required<number>()` or `theme = input<'light'|'dark'>('light')`), which integrates directly with `computed()`/`effect()` since it is itself a signal, unlike a plain `@Input()` property which requires `ngOnChanges` to react to updates. `output()` replaces `EventEmitter`-based `@Output()` with a lighter-weight emitter API (`saved = output<void>()`), decoupled from RxJS. `model()` combines both directions into a single two-way-bindable signal (`isEditing = model(false)`), letting the parent bind with `[(isEditing)]="parentValue"` without manually wiring a paired `@Input()`/`@Output()`. These signal-based APIs are functionally equivalent for most use cases but compose more naturally with the rest of the signals ecosystem.

---

**Q44. What is `ChangeDetectionStrategy.OnPush` and what conditions trigger change detection for an OnPush component?**
Answer: `OnPush` tells Angular to skip checking a component during a change detection pass unless one of a specific set of triggers occurs: one of its `@Input()` references changes (a new object/array reference, not a mutation of the same reference); an event originates from within the component or one of its children (a click, input event, etc.); an `Observable` bound via the `async` pipe emits a new value; or a signal read in the component's template changes. This dramatically reduces the number of components Angular re-checks on each cycle, but requires immutable update patterns for `@Input()` data (returning new objects/arrays rather than mutating in place) to ensure Angular actually detects the change.

---

**Q45. Why does `track` in `@for` matter for performance, and what happens if you use `track $index` on a frequently-reordered list?**
Answer: `track` gives Angular a stable identity for each item so that on re-render it can match old DOM/component instances to the corresponding new data by that identity, patching only what changed instead of destroying and recreating the entire list. If you `track $index` on a list that gets reordered (rather than just appended/removed at the end), Angular associates DOM position with index rather than with the actual data item — so reordering the array causes Angular to think the data *at each position* changed, leading to unnecessary re-renders, lost component state (e.g., a mid-edit input field), and potential animation glitches. Using a stable unique field like `item.id` avoids this entirely, since Angular can correctly detect "this exact item moved" instead of "everything changed."

---

**Q46. What is hydration and why does it matter for server-side rendered (SSR) Angular apps?**
Answer: Hydration is the process of reusing the DOM already rendered by the server (rather than tearing it down and re-rendering from scratch on the client) and attaching Angular's event listeners and internal state to that existing DOM. Without hydration, an SSR app would "destroy and rebuild" the DOM on first client-side bootstrap, causing a visible flicker, loss of focus/scroll position, and wasted rendering work since the server already produced correct markup. Angular's non-destructive hydration (enabled via `provideClientHydration()`) matches the server-rendered DOM node-by-node against what the client would render, reusing nodes where they match, which improves Core Web Vitals like Cumulative Layout Shift and Time to Interactive.

---

**Q47. What is the difference between SSR, prerendering, and client-side rendering in Angular, and when would you choose each?**
Answer: Client-side rendering (CSR) ships an essentially empty HTML shell and lets the browser download and execute JavaScript to render everything, which is simplest to deploy but has the slowest first paint and worst SEO/crawlability for content-heavy pages. Server-side rendering (SSR) renders the initial HTML on a Node.js server per-request, so the browser gets fully-formed markup immediately (better perceived performance and SEO), at the cost of server compute per request and needing hydration on the client. Prerendering (Static Site Generation) renders known routes to static HTML files at build time — combining SSR's fast first paint with CSR's zero server-compute cost per request — but only works for content that doesn't depend on per-user or per-request data; dynamic/personalized routes still need SSR or CSR.

---

**Q48. How do you unit test a component that has a dependency injected via a service, using Angular's `TestBed`?**
Answer: You configure a `TestBed.configureTestingModule({...})` with the component under test in `imports` (standalone) or `declarations` (NgModule-based), and override the real service with a mock/stub or a Jasmine spy object in the `providers` array (`{ provide: UserService, useValue: mockUserService }`). After calling `compileComponents()` (needed if the component has external templates/styles), you create the component with `TestBed.createComponent()`, trigger `fixture.detectChanges()` to run initial change detection, and then assert on the component instance's public state or on rendered DOM via `fixture.debugElement.query(By.css(...))`. Injecting a mock service in tests isolates the component's logic from the real service's implementation (HTTP calls, timers), keeping unit tests fast and deterministic.

---

**Q49. What is the difference between unit testing and end-to-end (e2e) testing in the Angular ecosystem, and what tools are typically used for each?**
Answer: Unit tests exercise a single component, service, pipe, or directive in isolation, using `TestBed` with mocked dependencies, typically run with Jasmine as the assertion/spec framework and Karma (or increasingly Jest/Web Test Runner) as the test runner executing in a real or headless browser. End-to-end tests drive the fully running application through a real browser exactly as a user would — clicking buttons, filling forms, navigating between routes — verifying that the whole system (frontend, routing, and often a real or mocked backend) works together; Angular's CLI historically scaffolded Protractor for this, now commonly replaced by Cypress or Playwright. Unit tests are fast, numerous, and pinpoint failures precisely; e2e tests are slower, fewer, and catch integration issues unit tests can't see.

---

**Q50. What build/deployment optimizations does the Angular CLI apply in a production build, and how can you further reduce bundle size?**
Answer: `ng build --configuration production` enables Ahead-of-Time (AOT) compilation (templates compiled to JavaScript at build time rather than in the browser), minification and dead-code elimination via esbuild/Terser, tree-shaking of unused code (including services never injected, thanks to `providedIn: 'root'`), and differential loading/output hashing for long-term caching. To further reduce bundle size, developers should lazy-load feature routes with `loadChildren`/`loadComponent`, use `@defer` blocks for heavy, non-critical UI, avoid importing entire libraries when only a few functions are needed (tree-shakable imports), analyze the bundle with `ng build --stats-json` plus `webpack-bundle-analyzer` to find unexpectedly large dependencies, and enable route-level prerendering or SSR for content that benefits from faster first paint.

---
