# Decorators and Metadata Reflection — Complete Guide

## Table of Contents
1. [Why This Lesson Exists](#1-why-this-lesson-exists)
2. [What a Decorator Actually Is](#2-what-a-decorator-actually-is)
3. [Class Decorators](#3-class-decorators)
4. [Method Decorators](#4-method-decorators)
5. [Property Decorators](#5-property-decorators)
6. [Parameter Decorators](#6-parameter-decorators)
7. [Decorator Factories and Composition](#7-decorator-factories-and-composition)
8. [The tsconfig Flags: experimentalDecorators and emitDecoratorMetadata](#8-the-tsconfig-flags-experimentaldecorators-and-emitdecoratormetadata)
9. [reflect-metadata — Storing and Reading Metadata](#9-reflect-metadata--storing-and-reading-metadata)
10. [Worked Example: A Tiny Injectable/Reflector Pair](#10-worked-example-a-tiny-injectablereflector-pair)
11. [How NestJS Actually Uses This (Conceptual Preview)](#11-how-nestjs-actually-uses-this-conceptual-preview)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Best Practices](#13-best-practices)
14. [Hands-On Exercises](#14-hands-on-exercises)
15. [Interview Q&A](#15-interview-qa)

---

## 1. Why This Lesson Exists

Every NestJS tutorial starts the same way:

```typescript
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): string[] {
    return this.catsService.findAll();
  }
}
```

It works, so beginners move on without asking *how*. Then, three weeks later, a guard silently fails to read a custom `@Roles()` decorator, or a provider can't be resolved, and there's no mental model to debug it with — because `@Controller`, `@Get`, and `@Injectable` were treated as syntax rather than as code.

They are code. A decorator is an ordinary function. `@Controller('cats')` calls a function named `Controller` with the argument `'cats'`, and that function runs against the `CatsController` class the moment the module is loaded — not when a request comes in, not "by the framework" in some abstract sense, but as a concrete function call during class definition. Everything Nest does with decorators boils down to two ideas covered in this lesson: **decorators run at definition time and can attach data to a class**, and **`reflect-metadata` is the library that stores and retrieves that data**. Once both are second nature, `@Injectable()` stops being magic and becomes "a function that calls `Reflect.defineMetadata` under the hood."

---

## 2. What a Decorator Actually Is

A decorator is a function with a specific signature that TypeScript invokes automatically when it evaluates a class declaration (or a member of one). The `@` syntax is purely sugar — it desugars to a direct function call.

```
  Source you write:              What actually happens at load time:
  ┌───────────────────┐          ┌──────────────────────────────────────┐
  │ @Sealed           │          │ class Greeter { ... }                 │
  │ class Greeter {   │   ───▶   │ Greeter = Sealed(Greeter) ?? Greeter  │
  │   ...             │          │  (Sealed is called with the class    │
  │ }                 │          │   as its only argument, immediately, │
  │                   │          │   at module-evaluation time)         │
  └───────────────────┘          └──────────────────────────────────────┘
```

There is no separate "decorator runtime" — it is plain function invocation, scheduled by the compiler to happen right after the class body is defined and before anything else in the module runs. Because of that, decorators can:

- Read information about the class/method/property they're attached to (its name, its parameter types, if `emitDecoratorMetadata` is on)
- Replace the class/method entirely (return a new constructor or descriptor)
- Attach metadata as a side effect, without altering behavior at all — this is the pattern Nest relies on almost everywhere

TypeScript supports four flavors, distinguished by *where* they're written: class, method, property, and parameter decorators. Each receives different arguments because each is attached to a different kind of target.

---

## 3. Class Decorators

A class decorator receives the constructor function itself as its only argument. It runs once, when the class is defined — not once per instance.

```typescript
// A class decorator receives the constructor and may return
// a new constructor to replace it, or return nothing to leave it alone.
function Sealed(constructor: Function): void {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@Sealed
class Greeter {
  greeting: string;

  constructor(message: string) {
    this.greeting = message;
  }

  greet(): string {
    return `Hello, ${this.greeting}`;
  }
}

// Object.seal prevents adding new properties to the constructor
// or its prototype after the fact — Sealed ran once, at load time.
```

A class decorator can also *replace* the class, by returning a new constructor that extends the original:

```typescript
function WithTimestamp<T extends { new (...args: any[]): {} }>(Base: T) {
  return class extends Base {
    createdAt = new Date();
  };
}

@WithTimestamp
class Report {
  title = 'Q3 Results';
}

const r = new Report() as Report & { createdAt: Date };
console.log(r.createdAt); // the current Date — added by the decorator
```

`@Controller()`, `@Injectable()`, and `@Module()` in NestJS are all class decorators. None of them replace the constructor — all three attach metadata and return nothing, which is why the class you write is still exactly the class you get, just with extra data riding along on the side.

---

## 4. Method Decorators

A method decorator receives three arguments: the target (the class prototype for instance methods, or the constructor for static methods), the method's name, and its `PropertyDescriptor`. It can inspect or replace the method implementation.

```typescript
function LogCall(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): void {
  const original = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    console.log(`Calling ${propertyKey} with`, args);
    const result = original.apply(this, args);
    console.log(`${propertyKey} returned`, result);
    return result;
  };
}

class Calculator {
  @LogCall
  add(a: number, b: number): number {
    return a + b;
  }
}

new Calculator().add(2, 3);
// Calling add with [ 2, 3 ]
// add returned 5
```

This is the exact shape (target, key, descriptor) that lets a decorator wrap a method in cross-cutting behavior — logging, timing, retry logic — without touching the method body. Nest's route decorators (`@Get()`, `@Post()`, etc.) are method decorators, but unlike `LogCall` above, they don't wrap the method at all: they attach metadata (the HTTP verb and path) that Nest's router later reads to know which method handles which request.

---

## 5. Property Decorators

A property decorator receives the target (prototype or constructor) and the property's name. Unlike method decorators, it does **not** receive a descriptor, because — at the time decorators run — a class property may not yet have a backing descriptor (this varies by compilation target). Property decorators are therefore used almost exclusively to record metadata, not to wrap behavior.

```typescript
import 'reflect-metadata';

const REQUIRED_KEY = 'custom:required';

function Required(target: any, propertyKey: string): void {
  const existing: string[] = Reflect.getMetadata(REQUIRED_KEY, target) ?? [];
  Reflect.defineMetadata(REQUIRED_KEY, [...existing, propertyKey], target);
}

class CreateUserDto {
  @Required
  email!: string;

  @Required
  password!: string;

  nickname?: string;
}

const requiredFields: string[] = Reflect.getMetadata(
  REQUIRED_KEY,
  CreateUserDto.prototype,
);
console.log(requiredFields); // [ 'email', 'password' ]
```

This is essentially a miniature version of what `class-validator`'s `@IsNotEmpty()` and similar decorators do — record which fields carry which constraints, so a separate validation step can walk the metadata later.

---

## 6. Parameter Decorators

A parameter decorator receives the target, the name of the method whose parameter is being decorated, and the parameter's index within the argument list. It cannot change the parameter's value directly — it can only record metadata about *which position* was decorated, for something else to act on later.

```typescript
import 'reflect-metadata';

const INJECT_PARAMS_KEY = 'custom:inject-params';

function CurrentUserParam(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number,
): void {
  const existing: number[] =
    Reflect.getMetadata(INJECT_PARAMS_KEY, target, propertyKey) ?? [];
  Reflect.defineMetadata(
    INJECT_PARAMS_KEY,
    [...existing, parameterIndex],
    target,
    propertyKey,
  );
}

class OrdersController {
  placeOrder(@CurrentUserParam() userId: string, orderId: string): void {
    console.log(userId, orderId);
  }
}

const decoratedParams: number[] = Reflect.getMetadata(
  INJECT_PARAMS_KEY,
  OrdersController.prototype,
  'placeOrder',
);
console.log(decoratedParams); // [ 0 ] — index 0 was decorated
```

This is precisely the mechanism behind Nest's `@Req()`, `@Body()`, `@Param()`, and custom parameter decorators created with `createParamDecorator()`. Nest records which argument index wants which piece of the request, then — when a real HTTP request arrives — builds the argument array by reading that metadata and slotting in the right value at the right index before calling your handler.

---

## 7. Decorator Factories and Composition

Every decorator used in NestJS in practice — `@Controller('cats')`, `@Get('/:id')`, `@Injectable()` — is written as a **decorator factory**: a function that takes configuration and *returns* the actual decorator function. This is what lets you pass arguments to something that otherwise has a fixed calling signature.

```typescript
import 'reflect-metadata';

const PATH_KEY = 'custom:path';

// A factory: a function that returns a class decorator
function Controller(path: string) {
  return function (target: Function): void {
    Reflect.defineMetadata(PATH_KEY, path, target);
  };
}

@Controller('cats')
class CatsController {}

console.log(Reflect.getMetadata(PATH_KEY, CatsController)); // 'cats'
```

`@Controller('cats')` is really `Controller('cats')` evaluated first (producing a plain class decorator function), which TypeScript then immediately applies to `CatsController`. Multiple decorators on the same target compose and run bottom-up for evaluation, top-down for the actual call — but for metadata-only decorators (the common case in Nest) that evaluation order rarely matters, since each one just writes to its own metadata key.

```typescript
@Sealed
@WithTimestamp
class Widget {}
// Evaluation order: WithTimestamp's factory result is computed first
// (closer to the class), then Sealed's — but both are applied to the
// class in that same bottom-up sequence.
```

---

## 8. The tsconfig Flags: experimentalDecorators and emitDecoratorMetadata

Two `compilerOptions` in `tsconfig.json` control decorator behavior, and NestJS projects require both:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

**`experimentalDecorators`** enables the decorator syntax at all (the legacy/stage-2 proposal that Nest is built against, not the newer TC39 stage-3 decorators shipped by default in modern TypeScript). Without it, `@Controller()` is a syntax error.

**`emitDecoratorMetadata`** tells the compiler to additionally emit *design-time type metadata* for every decorated declaration — the parameter types of a decorated method or constructor, and the return type of a decorated property — under well-known reflect-metadata keys (`design:type`, `design:paramtypes`, `design:returntype`). This is the single flag that makes Nest's constructor-based dependency injection possible without you ever specifying tokens by hand:

```typescript
import 'reflect-metadata';

class CatsService {}

class CatsController {
  constructor(private catsService: CatsService) {}
}

const paramTypes = Reflect.getMetadata('design:paramtypes', CatsController);
console.log(paramTypes); // [ [Function: CatsService] ]
```

That array of constructor functions — emitted automatically by the compiler because `emitDecoratorMetadata` is on — is exactly what Nest's DI container reads to figure out *what* to instantiate and inject when it builds a `CatsController`. No flag, no `design:paramtypes`, no automatic constructor injection.

---

## 9. reflect-metadata — Storing and Reading Metadata

`reflect-metadata` is a small polyfill package (Nest depends on it, and every Nest project imports it once, typically at the very top of `main.ts`) that implements a metadata reflection API on top of JavaScript's `Reflect` object — an API that isn't part of the JavaScript language itself, but that TypeScript's `emitDecoratorMetadata` output and Nest's own decorators both assume is present.

```typescript
import 'reflect-metadata'; // must be imported once, before any Reflect.* calls
```

The core API surface used throughout Nest:

| Function | Purpose |
|----------|---------|
| `Reflect.defineMetadata(key, value, target)` | Attach `value` under `key` to `target` (a class or object) |
| `Reflect.defineMetadata(key, value, target, propertyKey)` | Attach metadata to a specific member of `target` |
| `Reflect.getMetadata(key, target[, propertyKey])` | Read metadata, walking up the prototype chain if not found directly |
| `Reflect.hasMetadata(key, target[, propertyKey])` | Check for metadata's presence (including inherited) |
| `Reflect.getOwnMetadata(key, target[, propertyKey])` | Read metadata defined directly on `target`, ignoring inheritance |
| `Reflect.getMetadataKeys(target[, propertyKey])` | List all metadata keys present (including inherited) |

```typescript
import 'reflect-metadata';

class Base {}
Reflect.defineMetadata('role', 'base-role', Base);

class Derived extends Base {}

console.log(Reflect.getMetadata('role', Derived));    // 'base-role' (inherited)
console.log(Reflect.getOwnMetadata('role', Derived));  // undefined (not own)
```

The important mental model: metadata lives in a store keyed by `(target, propertyKey, metadataKey)` that is entirely separate from the object's own properties. `Reflect.getMetadata` never shows up in `Object.keys()`, `JSON.stringify()`, or a debugger's object inspector unless that tool specifically knows to look in the metadata store — which is exactly why it feels invisible until you know to ask for it.

---

## 10. Worked Example: A Tiny Injectable/Reflector Pair

This example builds — from scratch, with no Nest dependency — a decorator that marks a class as injectable and records its constructor dependencies, plus a reader that resolves an instance by walking that metadata. It is a deliberately simplified version of what `@Injectable()` plus Nest's internal `Injector` actually do.

```typescript
import 'reflect-metadata';

const INJECTABLE_KEY = 'app:injectable';

// --- The "decorator" half ---

// A class decorator factory. Marking a class @Injectable records that
// it is eligible for the container, and (thanks to emitDecoratorMetadata)
// its constructor parameter types are already available under
// 'design:paramtypes' without us doing anything extra.
function Injectable(): ClassDecorator {
  return (target: Function): void => {
    Reflect.defineMetadata(INJECTABLE_KEY, true, target);
  };
}

// --- The "reflection" half ---

type Constructor<T = unknown> = new (...args: unknown[]) => T;

class MiniContainer {
  private instances = new Map<Constructor, unknown>();

  resolve<T>(target: Constructor<T>): T {
    if (!Reflect.getMetadata(INJECTABLE_KEY, target)) {
      throw new Error(`${target.name} is not marked @Injectable()`);
    }

    if (this.instances.has(target)) {
      return this.instances.get(target) as T;
    }

    const paramTypes: Constructor[] =
      Reflect.getMetadata('design:paramtypes', target) ?? [];

    // Recursively resolve every constructor dependency before
    // instantiating this class — the same depth-first strategy
    // Nest's real Injector uses when it builds the dependency graph.
    const dependencies = paramTypes.map((dep) => this.resolve(dep));

    const instance = new target(...dependencies);
    this.instances.set(target, instance);
    return instance;
  }
}

// --- Usage ---

@Injectable()
class LoggerService {
  log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
}

@Injectable()
class CatsService {
  constructor(private readonly logger: LoggerService) {}

  findAll(): string[] {
    this.logger.log('Fetching all cats');
    return ['Whiskers', 'Tom'];
  }
}

const container = new MiniContainer();
const catsService = container.resolve(CatsService);
console.log(catsService.findAll());
// [LOG] Fetching all cats
// [ 'Whiskers', 'Tom' ]
```

Nothing here is Nest-specific — it's `reflect-metadata` plus a `Map`. But the shape is identical to Nest's real machinery: mark a class, read its `design:paramtypes`, recursively resolve each dependency, cache singleton instances, then construct. The only things Nest's real container adds on top are custom injection tokens (for interfaces, values, and factories that don't have a runtime constructor to reflect on), scopes (`DEFAULT`, `REQUEST`, `TRANSIENT`), and circular-dependency handling.

---

## 11. How NestJS Actually Uses This (Conceptual Preview)

With the mechanics above in hand, here is what's really happening when you write standard Nest code — a preview that Phase 3 (Controllers) and Phase 4 (Providers & DI) will build out in full:

```
  @Injectable()                    →  Reflect.defineMetadata marks CatsService
  class CatsService {}                as a provider candidate

  @Controller('cats')               →  Reflect.defineMetadata stores 'cats'
  class CatsController {              as this controller's route prefix
    constructor(
      private catsService:          →  emitDecoratorMetadata already recorded
        CatsService                    CatsService in design:paramtypes —
    ) {}                               Nest's Injector reads it to know what
                                        to instantiate and inject here

    @Get()                          →  Reflect.defineMetadata records
    findAll() {}                       { method: 'GET', path: '/' } on
                                        this method, keyed by propertyKey
  }
```

At application bootstrap, Nest scans every class registered in a `@Module()`, reads all of this accumulated metadata, builds a dependency graph, instantiates providers in dependency order (exactly like `MiniContainer.resolve` above, but with tokens, scopes, and modules layered in), and wires route handlers to an underlying HTTP adapter (Express or Fastify — covered in the next lesson) using the path/verb metadata recorded by `@Get()`, `@Post()`, and friends. There is no separate "Nest compiler" step and no build-time code generation involved — it is `reflect-metadata` reads happening once, at application startup, in plain JavaScript.

---

## 12. Common Pitfalls

**Forgetting to import `reflect-metadata` at the entry point.** `Reflect.defineMetadata`/`getMetadata` are not native JavaScript — they only exist once the `reflect-metadata` polyfill has been imported somewhere that runs before any decorator executes. Nest's CLI-generated `main.ts` doesn't even show this import because the `@nestjs/core` package imports it internally, but in a hand-rolled decorator library (like the exercises below) you must `import 'reflect-metadata'` yourself, once, before anything else.

**Decorating an arrow function class field and expecting a method decorator.** `@LogCall handler = () => {}` is a **property** decorator (no descriptor with a `.value` you can safely reassign the way you can for a real prototype method), not a method decorator, because class fields are own-properties assigned in the constructor, not prototype methods. Wrapping behavior around them requires a different pattern (wrapping in the constructor or using `Object.defineProperty`), not the descriptor-mutation trick shown in Section 4.

**Assuming decorators run per-instance.** Class, method, and property decorators all run exactly once, when the class is *defined* — not once per `new`. A decorator that expects to run fresh logic "for this particular request" (a genuinely common assumption for Nest beginners looking at `@Get()`) is wrong: the decorator's job is to record metadata once; the *framework* reads that metadata fresh on every request.

**Forgetting `emitDecoratorMetadata` and getting `undefined` constructor types.** Without this flag, `Reflect.getMetadata('design:paramtypes', SomeClass)` returns `undefined` even though `experimentalDecorators` is on and the decorators themselves execute fine. The symptom in a real Nest app is usually `Nest can't resolve dependencies` errors that seem to make no sense — the fix is almost always checking `tsconfig.json` for both flags together.

**Mutating shared metadata arrays instead of copying them.** `Reflect.getMetadata(key, target) ?? []` followed by `.push(...)` mutates whatever array was already stored (or a fresh one) — but if that same array reference was also stored on a *parent* class's metadata (via inheritance), pushing onto it silently pollutes the parent too. Always spread into a new array (`[...existing, next]`, as shown in Sections 5 and 6) before calling `defineMetadata` again.

**Confusing `experimentalDecorators` (Nest's model) with TC39 stage-3 decorators.** Modern TypeScript (5.0+) supports the newer, standardized decorator proposal without any flag at all, but it has a *different* runtime signature and does not integrate with `emitDecoratorMetadata` the way Nest expects. NestJS projects must keep `experimentalDecorators: true` — mixing in stage-3-decorator syntax or libraries built for it will break Nest's metadata assumptions.

---

## 13. Best Practices

- Always centralize custom metadata keys as exported constants (`export const ROLES_KEY = 'roles'`) rather than repeating string literals across a codebase — a typo in a metadata key is a silent bug (the read returns `undefined`, not an error).
- Prefer Nest's own `SetMetadata()` helper (covered in Phase 8, Custom Decorators) over hand-rolling `Reflect.defineMetadata` calls in application code — it exists specifically to keep this pattern consistent and typed across a codebase.
- Keep decorator factories side-effect-free beyond writing metadata; a decorator that reaches out to a database or does async work at class-definition time will run at *module import* time, which is usually not what you want and can create import-order bugs.
- When building your own parameter decorators, always store metadata keyed by both the target **and** the method name (`Reflect.defineMetadata(key, value, target, propertyKey)`) — omitting the propertyKey silently collapses metadata for *all* methods on the class into one shared slot.
- Turn on `strict` mode alongside `experimentalDecorators`/`emitDecoratorMetadata` — decorator-heavy code benefits enormously from strict null checks, since metadata reads that "might not exist" (`Type[] | undefined`) are exactly where nullability bugs hide.
- Never rely on decorator execution order across *different* decorator factories unless you've verified it deliberately (bottom-up application, as shown in Section 7) — write each decorator to be order-independent by only ever appending to its own metadata key.

---

## 14. Hands-On Exercises

**Exercise 1:** Write a class decorator factory `MinVersion(version: string)` that stores the given version string under a metadata key `'app:min-version'` on the decorated class. Write a function `checkVersion(target, currentVersion)` that reads the metadata and throws if `currentVersion` is older than the required one (simple string comparison is fine for this exercise). Apply it to a sample class and verify both the pass and throw paths.

**Exercise 2:** Write a method decorator `Deprecated(message?: string)` (a factory) that wraps the original method so that every call logs a deprecation warning (including the optional message, if provided) to the console before invoking the original implementation and returning its result unchanged. Verify with a class that has two methods, only one of which is decorated.

**Exercise 3:** Write a property decorator `MaxLength(limit: number)` that records `{ propertyKey, limit }` entries in an array under a shared metadata key `'app:max-length-rules'` on the class prototype. Then write a `validate(instance)` function that reads the rules and checks each decorated property's current string value against its limit, returning an array of violation messages (empty if none).

**Exercise 4:** Extend the `MiniContainer` from Section 10 to support a `Transient` variant: add a `@Transient()` class decorator that, when present, makes `resolve()` skip the singleton cache and always construct a brand-new instance (mirroring Nest's `Scope.TRANSIENT`). Verify by resolving a `@Transient()`-marked service twice and confirming you get two distinct object references, versus a `@Injectable()`-only service where you get the same reference both times.

**Exercise 5:** Using only `Reflect.getMetadata('design:paramtypes', SomeClass)` (with `emitDecoratorMetadata` enabled) and no decorators of your own, write a function `describeDependencies(target)` that prints a human-readable line for each constructor parameter's inferred class name, e.g. `CatsController depends on: CatsService, LoggerService`. Test it against a three-level dependency chain (`A` depends on `B`, `B` depends on `C`) and confirm the output is correct without ever manually recording anything — the compiler-emitted metadata alone is enough.

---

## 15. Interview Q&A

**Q: What is a TypeScript decorator, mechanically — not what does it look like, but what actually happens when the code runs?**
Answer: A decorator is an ordinary function that TypeScript's compiler inserts a call to, immediately after a class (or one of its members) is defined, before the surrounding module continues executing. `@Foo class Bar {}` compiles to something equivalent to `class Bar {}; Bar = Foo(Bar) ?? Bar;` — a class decorator receives the constructor, can inspect or replace it, and runs exactly once, at class-definition time, never per-instance. There is no separate decorator "runtime" — it's function invocation scheduled by the compiler's emitted code.

**Q: Why does NestJS need both `experimentalDecorators` and `emitDecoratorMetadata`, and what breaks if you only set one?**
Answer: `experimentalDecorators` enables the decorator syntax at all — without it, `@Controller()` is a compile error. `emitDecoratorMetadata` separately tells the compiler to also emit design-time type information (constructor parameter types, property types) under `reflect-metadata` keys like `design:paramtypes`. Nest's automatic constructor-based dependency injection depends entirely on that second flag — it reads `design:paramtypes` to know which classes to instantiate and pass into a controller or provider's constructor. With only `experimentalDecorators` set, decorators still run and can store their own custom metadata, but `Reflect.getMetadata('design:paramtypes', SomeClass)` returns `undefined`, and Nest throws dependency-resolution errors that look unrelated to tsconfig at all.

**Q: How does `reflect-metadata` differ from just adding a property to a class or object?**
Answer: `reflect-metadata` stores data in a separate metadata store keyed by `(target, propertyKey, metadataKey)`, entirely outside the object's own enumerable properties. It never shows up in `Object.keys()`, `JSON.stringify()`, `for...in` loops, or spread operations, and it supports prototype-chain inheritance lookups via `Reflect.getMetadata` (versus `Reflect.getOwnMetadata`, which does not walk the chain). This separation is exactly why frameworks use it for cross-cutting configuration (route paths, injection tokens, validation rules) — it can't accidentally leak into serialization or collide with a real property of the same name.

**Q: Nest's route decorators like `@Get()` don't seem to change what the method does when you call it directly — why not, and how does routing still work?**
Answer: `@Get()` is a metadata-only method decorator — it calls `Reflect.defineMetadata` to record the HTTP verb and path on the method, then returns without touching the method's actual implementation or its descriptor's `.value`. Calling `controller.findAll()` directly in a unit test behaves exactly like calling a plain, undecorated method. Routing is a separate, later step: at application bootstrap, Nest's router scans every controller method for that metadata and builds a routing table mapping `(verb, path)` pairs to method references — the decorator only ever supplies data for that table; a real Express/Fastify router does the actual URL matching and invocation at request time.

**Q: What's the difference in signature between a method decorator and a parameter decorator, and why can't a parameter decorator change the argument's value?**
Answer: A method decorator receives `(target, propertyKey, descriptor)` — the `PropertyDescriptor` gives it access to `.value` (the function itself), which it can reassign to wrap or replace the method entirely. A parameter decorator receives `(target, propertyKey, parameterIndex)` — just a numeric index into the argument list, with no descriptor and no way to intercept or transform values as they flow in, because parameter decorators run at class-definition time, long before any particular call with real arguments happens. All a parameter decorator can do is record "position 0 of method `foo` was decorated with X" as metadata; something else — Nest's request pipeline, in the framework's case — has to read that metadata later and actually build the argument at call time.

**Q: If you saw a Nest provider fail to resolve with an error like "Nest can't resolve dependencies of the CatsService", what decorator/metadata-related causes would you check first?**
Answer: First, whether `emitDecoratorMetadata` is actually enabled in the effective `tsconfig.json` (a common trap is a `tsconfig.build.json` that overrides or omits it). Second, whether the dependency's type is used only as a TypeScript interface or type alias rather than a concrete class — interfaces don't exist at runtime, so `design:paramtypes` would contain no usable constructor for that position, and Nest needs an explicit `@Inject(TOKEN)` in that case. Third, circular import order between two files that decorate and reference each other, since decorator metadata depends on the class already being fully defined when `design:paramtypes` is captured. All three trace back to the same root idea: Nest's DI resolves dependencies from compiler-emitted metadata, and anything that prevents that metadata from existing or being accurate produces this exact class of error.
