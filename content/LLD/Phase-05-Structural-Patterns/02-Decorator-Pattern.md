# Decorator Pattern — Complete Guide

## Table of Contents
1. [The Problem Decorator Solves](#1-the-problem-decorator-solves)
2. [What is the Decorator Pattern?](#2-what-is-the-decorator-pattern)
3. [Bad Example: Subclass Explosion](#3-bad-example-subclass-explosion)
4. [Good Example: GoF Wrapper-Class Decorators (Coffee Order)](#4-good-example-gof-wrapper-class-decorators-coffee-order)
5. [Good Example: Python Function Decorators (Request Handler)](#5-good-example-python-function-decorators-request-handler)
6. [Middleware in Django/Flask is Conceptually a Decorator](#6-middleware-in-djangoflask-is-conceptually-a-decorator)
7. [When to Use / Trade-offs](#7-when-to-use--trade-offs)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem Decorator Solves

You want to add behavior to an object — logging, caching, auth checks, extra toppings, compression — but:
- Subclassing for every combination explodes (`LoggedCachedAuthHandler`, `CachedLoggedHandler`, ...).
- You want to add/remove behavior **at runtime**, per-instance, not baked into a fixed class hierarchy.
- Modifying the original class directly would violate the Open/Closed Principle and pollute a class that should stay simple.

```
Without Decorator — subclass per combination:
  Coffee
  ├── CoffeeWithMilk
  ├── CoffeeWithSugar
  ├── CoffeeWithMilkAndSugar
  ├── CoffeeWithMilkAndSugarAndWhip
  └── ... 2^N classes for N optional toppings
```

---

## 2. What is the Decorator Pattern?

Decorator attaches additional responsibilities to an object dynamically by **wrapping** it in another object that shares the same interface. Decorators can be stacked, and the client can't tell the difference between the original object and a decorated one — both satisfy the same interface.

```
┌───────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│  Client   │────▶│ Component (interface)  │◀────│ ConcreteComponent      │
└───────────┘     └────────────────────────┘     │ (the base object)      │
                              ▲                    └────────────────────────┘
                              │ implements
                   ┌──────────────────────┐
                   │ Decorator (abstract) │──── holds a reference to ────▶ Component
                   └──────────────────────┘
                              ▲
              ┌───────────────┴───────────────┐
    ┌──────────────────┐          ┌──────────────────┐
    │ MilkDecorator     │          │ SugarDecorator    │
    └──────────────────┘          └──────────────────┘

Stacking: SugarDecorator(MilkDecorator(Espresso()))
```

Two flavors exist in practice:
1. **Classic GoF wrapper-class decorator** — a class that wraps another object implementing the same interface (works for objects, any language).
2. **Python's built-in `@decorator` syntax** — wraps a *function*, using closures instead of classes. Different mechanics, identical intent: add behavior without modifying the original.

---

## 3. Bad Example: Subclass Explosion

```python
class Coffee:
    def cost(self) -> float:
        return 2.00

    def description(self) -> str:
        return "Coffee"


class CoffeeWithMilk(Coffee):
    def cost(self) -> float:
        return super().cost() + 0.50

    def description(self) -> str:
        return super().description() + ", Milk"


class CoffeeWithMilkAndSugar(CoffeeWithMilk):
    def cost(self) -> float:
        return super().cost() + 0.25

    def description(self) -> str:
        return super().description() + ", Sugar"


class CoffeeWithMilkAndSugarAndWhip(CoffeeWithMilkAndSugar):
    def cost(self) -> float:
        return super().cost() + 0.75

    def description(self) -> str:
        return super().description() + ", Whip"

# What about Sugar-only? Whip-only? Milk+Whip without sugar?
# Every new topping combination needs a NEW class. This does not scale.
```

**Why this is painful:**
- N optional add-ons require up to 2^N subclasses to cover every combination.
- Order of toppings baked into class names (`MilkAndSugar` vs `SugarAndMilk`) is arbitrary and rigid.
- Adding a new topping means touching the whole hierarchy.

---

## 4. Good Example: GoF Wrapper-Class Decorators (Coffee Order)

```python
from abc import ABC, abstractmethod


# ---- Component interface ----
class Beverage(ABC):
    @abstractmethod
    def cost(self) -> float:
        raise NotImplementedError

    @abstractmethod
    def description(self) -> str:
        raise NotImplementedError


# ---- Concrete component ----
class Espresso(Beverage):
    def cost(self) -> float:
        return 2.00

    def description(self) -> str:
        return "Espresso"


# ---- Base Decorator: implements Beverage, wraps a Beverage ----
class ToppingDecorator(Beverage, ABC):
    def __init__(self, beverage: Beverage) -> None:
        self._beverage = beverage


# ---- Concrete decorators ----
class Milk(ToppingDecorator):
    def cost(self) -> float:
        return self._beverage.cost() + 0.50

    def description(self) -> str:
        return self._beverage.description() + ", Milk"


class Sugar(ToppingDecorator):
    def cost(self) -> float:
        return self._beverage.cost() + 0.25

    def description(self) -> str:
        return self._beverage.description() + ", Sugar"


class WhippedCream(ToppingDecorator):
    def cost(self) -> float:
        return self._beverage.cost() + 0.75

    def description(self) -> str:
        return self._beverage.description() + ", Whipped Cream"


if __name__ == "__main__":
    order: Beverage = Espresso()
    order = Milk(order)
    order = Sugar(order)
    order = WhippedCream(order)

    print(f"{order.description()} => ${order.cost():.2f}")
    # Any combination, any order, no new classes needed.

    order2: Beverage = Sugar(Espresso())  # Sugar only
    print(f"{order2.description()} => ${order2.cost():.2f}")
```

```
Output:
Espresso, Milk, Sugar, Whipped Cream => $3.50
Espresso, Sugar => $2.25
```

Each decorator wraps a `Beverage` and *is itself* a `Beverage` — that's the trick that lets them stack arbitrarily.

---

## 5. Good Example: Python Function Decorators (Request Handler)

Python's `@decorator` syntax is the same idea applied to **functions**: a decorator is a callable that takes a function and returns a new function wrapping it with extra behavior — logging, auth, caching — without touching the original function's body.

```python
import time
import functools
from typing import Callable, Any


def with_logging(handler: Callable[..., Any]) -> Callable[..., Any]:
    @functools.wraps(handler)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        print(f"[LOG] Calling {handler.__name__} with {args}, {kwargs}")
        result = handler(*args, **kwargs)
        print(f"[LOG] {handler.__name__} returned {result}")
        return result
    return wrapper


def with_auth(handler: Callable[..., Any]) -> Callable[..., Any]:
    @functools.wraps(handler)
    def wrapper(request: dict, *args: Any, **kwargs: Any) -> Any:
        if not request.get("user"):
            raise PermissionError("401: authentication required")
        return handler(request, *args, **kwargs)
    return wrapper


def with_cache(handler: Callable[..., Any]) -> Callable[..., Any]:
    cache: dict[str, Any] = {}

    @functools.wraps(handler)
    def wrapper(request: dict, *args: Any, **kwargs: Any) -> Any:
        key = request["path"]
        if key in cache:
            print(f"[CACHE] hit for {key}")
            return cache[key]
        result = handler(request, *args, **kwargs)
        cache[key] = result
        return result
    return wrapper


# Stack decorators: outermost runs first (logging), innermost is the raw handler.
@with_logging
@with_auth
@with_cache
def get_order_handler(request: dict) -> dict:
    """The actual request handler — knows nothing about logging/auth/caching."""
    time.sleep(0.01)  # simulate DB lookup
    return {"order_id": 42, "status": "SHIPPED"}


if __name__ == "__main__":
    req = {"user": "alice", "path": "/orders/42"}
    print(get_order_handler(req))
    print(get_order_handler(req))  # second call hits cache

    bad_req = {"path": "/orders/42"}  # no user
    try:
        get_order_handler(bad_req)
    except PermissionError as e:
        print(f"Rejected: {e}")
```

```
Output:
[LOG] Calling get_order_handler with ({'user': 'alice', 'path': '/orders/42'},), {}
{'order_id': 42, 'status': 'SHIPPED'}
[LOG] get_order_handler returned {'order_id': 42, 'status': 'SHIPPED'}
[LOG] Calling get_order_handler with ({'user': 'alice', 'path': '/orders/42'},), {}
[CACHE] hit for /orders/42
[LOG] get_order_handler returned {'order_id': 42, 'status': 'SHIPPED'}
{'order_id': 42, 'status': 'SHIPPED'}
[LOG] Calling get_order_handler with ({'path': '/orders/42'},), {}
Rejected: 401: authentication required
```

Same pattern intent as the coffee example (wrap to add behavior, keep the interface), implemented via closures instead of wrapper classes — this is what makes Python decorators feel "native" while still being the GoF Decorator pattern underneath.

---

## 6. Middleware in Django/Flask is Conceptually a Decorator

Django/Flask middleware wraps the request/response cycle in layers — exactly the Decorator pattern at the framework level:

```
Incoming request
   │
   ▼
┌───────────────────────┐
│ SecurityMiddleware     │  (outermost decorator)
│  ┌───────────────────┐│
│  │ AuthMiddleware      ││
│  │ ┌──────────────────┤│
│  │ │ LoggingMiddleware ││
│  │ │ ┌────────────────┤│
│  │ │ │  Your View     │││  (the core "component")
│  │ │ └────────────────┤│
│  │ └──────────────────┤│
│  └───────────────────┘│
└───────────────────────┘
   │
   ▼
Outgoing response
```

Each middleware wraps the next `get_response` callable, adds behavior before/after calling it, and returns something with the same shape (a response). That's structurally identical to `Milk(Sugar(Espresso()))` — a chain of wrappers sharing one interface (`__call__(request) -> response`).

```python
# Simplified Django-style middleware — literally a decorator around get_response
class SimpleLoggingMiddleware:
    def __init__(self, get_response: Callable[[dict], dict]) -> None:
        self.get_response = get_response

    def __call__(self, request: dict) -> dict:
        print(f"[middleware] before: {request['path']}")
        response = self.get_response(request)
        print(f"[middleware] after: {response}")
        return response
```

---

## 7. When to Use / Trade-offs

**Use Decorator when:**
- You need to add responsibilities to individual objects dynamically and transparently, without affecting other objects of the same class.
- Combinations of behaviors would otherwise require an explosion of subclasses.
- You want to add/remove behavior at runtime (stack decorators conditionally based on config/feature flags).

**Trade-offs:**
- Many small wrapper objects/functions can make debugging and stack traces harder to read (a call passes through N wrapper layers).
- Order of decorator application matters and can be a subtle source of bugs (e.g., `with_auth` must run before `with_cache` checks a per-user cache key, otherwise you could leak cached data across users).
- Class-based (GoF) decorators add boilerplate for each new behavior; Python's `@decorator` syntax is far more ergonomic for function-level cross-cutting concerns.

---

## 8. Hands-On Exercises

**Exercise 1:** Add a `Caramel` decorator to the coffee example and produce a `Caramel(Milk(Espresso()))` order. Print description and cost.

**Exercise 2:** Write a `with_retry(max_attempts: int)` **decorator factory** (a function that returns a decorator) that retries `get_order_handler` up to `max_attempts` times if it raises an exception.

**Exercise 3:** Convert the `ToppingDecorator` coffee example's `Milk`/`Sugar`/`WhippedCream` into a single generic `AddOn` decorator class parameterized by `name: str` and `price: float`, so you don't need a new class per topping.

---

## 9. Interview Q&A

**Q: What problem does the Decorator pattern solve?**
Answer: It lets you add new behavior to an individual object dynamically by wrapping it, instead of creating a new subclass for every combination of behaviors. This avoids subclass explosion and lets behavior be composed and toggled at runtime.

**Q: How do Python's built-in `@decorator` functions relate to the GoF Decorator pattern?**
Answer: They're the same core idea — wrap something to add behavior without modifying its source — applied to functions instead of objects. A GoF decorator is a class implementing the same interface as the component it wraps and delegating to it; a Python function decorator is a higher-order function that takes a function and returns a new function (usually via a closure) that adds behavior before/after calling the original. Both are composable/stackable.

**Q: How is Django/Flask middleware an example of the Decorator pattern?**
Answer: Each middleware wraps the next layer's `get_response` (or `app`) callable and shares the same interface — take a request, return a response. Middlewares are chained/stacked in a fixed order, each adding behavior (auth, logging, security headers) before and/or after calling the next layer, exactly like stacking `Milk(Sugar(Espresso()))`.

**Q: What's the difference between Decorator and Proxy, since both wrap an object behind the same interface?**
Answer: Decorator's *purpose* is to add or enhance responsibilities/behavior (logging, formatting, extra toppings), and decorators are meant to be stacked in arbitrary combinations. Proxy's *purpose* is to control access to the underlying object (lazy creation, permission checks, remote access) — it typically doesn't add business behavior and usually isn't stacked the way decorators are. Structurally they look similar (both wrap + implement the same interface); intent is what distinguishes them.

**Q: Implement the Decorator pattern from scratch for a `Notifier` interface with `send(message: str) -> None`, adding an `SMSDecorator` and a `SlackDecorator` on top of a base `EmailNotifier`.**
Answer:
```python
from abc import ABC, abstractmethod


class Notifier(ABC):
    @abstractmethod
    def send(self, message: str) -> None:
        raise NotImplementedError


class EmailNotifier(Notifier):
    def send(self, message: str) -> None:
        print(f"Email: {message}")


class NotifierDecorator(Notifier, ABC):
    def __init__(self, wrapped: Notifier) -> None:
        self._wrapped = wrapped

    def send(self, message: str) -> None:
        self._wrapped.send(message)


class SMSDecorator(NotifierDecorator):
    def send(self, message: str) -> None:
        super().send(message)
        print(f"SMS: {message}")


class SlackDecorator(NotifierDecorator):
    def send(self, message: str) -> None:
        super().send(message)
        print(f"Slack: {message}")


notifier: Notifier = SlackDecorator(SMSDecorator(EmailNotifier()))
notifier.send("Your order has shipped!")
# Output:
# Email: Your order has shipped!
# SMS: Your order has shipped!
# Slack: Your order has shipped!
```

**Q: Why must a decorator implement the same interface as the object it wraps?**
Answer: So the client can treat a decorated object identically to an undecorated one, and so decorators can be nested/stacked arbitrarily — each decorator's output must be a valid input to the next decorator. If the interface diverged, stacking would break and clients would need to know whether they're holding a raw component or a decorated one, defeating the pattern's transparency.
