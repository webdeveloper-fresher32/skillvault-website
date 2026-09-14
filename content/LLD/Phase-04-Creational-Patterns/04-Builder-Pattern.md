# Builder Pattern — Complete Guide

## Table of Contents
1. [Motivation](#1-motivation)
2. [Bad Example: Telescoping Constructor](#2-bad-example-telescoping-constructor)
3. [Good Example: Fluent Pizza Builder](#3-good-example-fluent-pizza-builder)
4. [Bonus: HTTP Request Builder](#4-bonus-http-request-builder)
5. [How It Works](#5-how-it-works)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Motivation

Some objects have many optional parameters, and constructing them via a single constructor forces every caller to either remember a long positional argument order or pass `None` for everything they don't need. This gets worse every time a new optional field is added — every existing call site is now ambiguous or needs updating.

Builder solves this by separating **construction** (step-by-step, one piece at a time) from **representation** (the final immutable object), using a fluent chain of method calls that reads like a sentence.

```
Telescoping constructor:                     Builder:
Pizza(12, "thin", True, False, True,         Pizza.builder()
      False, True, 2, "medium", None)             .size(12)
      ↑ what do these mean??                       .crust("thin")
                                                     .add_topping("cheese")
                                                     .add_topping("olives")
                                                     .spice_level("medium")
                                                     .build()
```

---

## 2. Bad Example: Telescoping Constructor

```python
class Pizza:
    """Telescoping constructor — unreadable and error-prone at the call site."""

    def __init__(
        self,
        size: int,
        crust: str,
        cheese: bool = True,
        pepperoni: bool = False,
        mushrooms: bool = False,
        olives: bool = False,
        onions: bool = False,
        extra_cheese: bool = False,
        spice_level: str = "mild",
        gluten_free: bool = False,
        stuffed_crust: bool = False,
    ) -> None:
        self.size = size
        self.crust = crust
        self.cheese = cheese
        self.pepperoni = pepperoni
        self.mushrooms = mushrooms
        self.olives = olives
        self.onions = onions
        self.extra_cheese = extra_cheese
        self.spice_level = spice_level
        self.gluten_free = gluten_free
        self.stuffed_crust = stuffed_crust


# Caller has to count positions or remember every keyword —
# and this is only 11 parameters; real menus have more.
pizza = Pizza(12, "thin", True, False, True, False, False, True, "hot", False, True)
# What is True #5? What is False #7? Unreadable without opening the class.

# Using keywords helps a bit, but the constructor is still one giant
# all-or-nothing call, and adding a new optional field (e.g., "sauce_type")
# means touching this signature and potentially every existing call site
# that relies on positional order.
```

The core problems: (1) unreadable call sites — booleans in a row convey no meaning, (2) fragile positional ordering, (3) every combination of options must be threaded through one constructor, and (4) partially-built/invalid states can't be validated incrementally.

---

## 3. Good Example: Fluent Pizza Builder

```python
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Pizza:
    """The final, immutable product. Only ever built via PizzaBuilder."""

    size: int
    crust: str
    toppings: tuple[str, ...]
    spice_level: str
    gluten_free: bool
    stuffed_crust: bool

    def describe(self) -> str:
        toppings = ", ".join(self.toppings) if self.toppings else "no toppings"
        return (
            f"{self.size}\" {self.crust} crust pizza, {toppings}, "
            f"spice: {self.spice_level}"
            f"{', gluten-free' if self.gluten_free else ''}"
            f"{', stuffed crust' if self.stuffed_crust else ''}"
        )


class PizzaBuilder:
    """Fluent builder — each method returns self, enabling method chaining."""

    def __init__(self, size: int, crust: str) -> None:
        # Required fields go in the builder's constructor.
        self._size = size
        self._crust = crust
        self._toppings: list[str] = []
        self._spice_level = "mild"
        self._gluten_free = False
        self._stuffed_crust = False

    def add_topping(self, topping: str) -> "PizzaBuilder":
        self._toppings.append(topping)
        return self

    def spice_level(self, level: str) -> "PizzaBuilder":
        self._spice_level = level
        return self

    def gluten_free(self, value: bool = True) -> "PizzaBuilder":
        self._gluten_free = value
        return self

    def stuffed_crust(self, value: bool = True) -> "PizzaBuilder":
        self._stuffed_crust = value
        return self

    def build(self) -> Pizza:
        if self._gluten_free and self._stuffed_crust:
            # Validation that would be awkward to express in a constructor call.
            raise ValueError("Stuffed crust is not available for gluten-free pizzas")
        return Pizza(
            size=self._size,
            crust=self._crust,
            toppings=tuple(self._toppings),
            spice_level=self._spice_level,
            gluten_free=self._gluten_free,
            stuffed_crust=self._stuffed_crust,
        )


# Reads like a sentence — self-documenting at the call site.
pizza = (
    PizzaBuilder(size=12, crust="thin")
    .add_topping("mozzarella")
    .add_topping("olives")
    .spice_level("hot")
    .stuffed_crust()
    .build()
)
print(pizza.describe())
# 12" thin crust pizza, mozzarella, olives, spice: hot, stuffed crust
```

Adding a new optional field (e.g., `sauce_type`) now means adding one new builder method and one new field — no existing call site changes, and invalid combinations (`gluten_free` + `stuffed_crust`) are caught in `build()` rather than silently accepted.

---

## 4. Bonus: HTTP Request Builder

A second common interview flavor of this same pattern:

```python
from __future__ import annotations


class HttpRequest:
    def __init__(self, method: str, url: str, headers: dict[str, str], body: str | None, timeout: float) -> None:
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.timeout = timeout

    def __repr__(self) -> str:
        return f"{self.method} {self.url} headers={self.headers} timeout={self.timeout}s"


class HttpRequestBuilder:
    def __init__(self, method: str, url: str) -> None:
        self._method = method
        self._url = url
        self._headers: dict[str, str] = {}
        self._body: str | None = None
        self._timeout = 30.0

    def header(self, key: str, value: str) -> "HttpRequestBuilder":
        self._headers[key] = value
        return self

    def body(self, content: str) -> "HttpRequestBuilder":
        self._body = content
        return self

    def timeout(self, seconds: float) -> "HttpRequestBuilder":
        self._timeout = seconds
        return self

    def build(self) -> HttpRequest:
        return HttpRequest(self._method, self._url, self._headers, self._body, self._timeout)


request = (
    HttpRequestBuilder("POST", "https://api.example.com/orders")
    .header("Content-Type", "application/json")
    .header("Authorization", "Bearer token123")
    .body('{"item": "pizza"}')
    .timeout(10.0)
    .build()
)
print(request)
```

This is exactly the shape of real libraries like `requests.Request`, `httpx.Client`, and Java's `OkHttpClient.Builder`.

---

## 5. How It Works

```
Director (optional)          Builder                       Product
   │                            │                              
   │  set_size(12)              │                              
   ├───────────────────────────▶│  ._size = 12                
   │  add_topping("olives")     │                              
   ├───────────────────────────▶│  ._toppings.append(...)     
   │  build()                   │                              
   ├───────────────────────────▶│  validates + constructs ───▶ Pizza(...)
```

A separate "Director" class that calls the builder steps in a fixed order is part of the classic GoF definition, but in Python interviews it's usually omitted — the caller plays the director's role directly via method chaining, which is simpler and just as clear.

---

## 6. When to Use / Trade-offs

| Use Builder when | Trade-offs / caveats |
|---|---|
| An object has many optional parameters (roughly 4+) or several valid combinations | Adds a second class (the builder) alongside the product — overkill for objects with 2-3 simple fields |
| Construction needs multi-step validation that a single constructor call can't express cleanly | The product should usually be immutable once built (`frozen=True` dataclass) — if it's mutable, Builder's benefit shrinks |
| You want a fluent, self-documenting call site | Chained calls can hide *which* method threw an error if `build()` fails deep in a long chain |
| The same construction process should be able to produce different representations (e.g., builder methods reused for `SmallPizza` vs `FamilyPizza` presets) | For simple objects, `@dataclass` with keyword-only arguments and defaults is often simpler than a full Builder |

---

## 7. Interview Q&A

**Q: What problem does the Builder pattern solve?**
Answer: It solves the "telescoping constructor" problem — an object with many optional parameters that would otherwise require either a huge positional constructor (unreadable, error-prone ordering) or many overloaded constructors. Builder separates step-by-step construction from the final immutable product, using a fluent chain of clearly-named methods so the call site is self-documenting.

**Q: Implement a Builder pattern from scratch for a Pizza with a required size/crust and optional toppings.**
Answer: Create an immutable `Pizza` dataclass holding the final fields. Create a `PizzaBuilder` whose `__init__` takes the required fields (size, crust), and whose other methods (`add_topping`, `spice_level`, etc.) mutate internal builder state and `return self` to enable chaining. A final `build()` method validates the accumulated state and constructs and returns the `Pizza`. Usage: `PizzaBuilder(12, "thin").add_topping("cheese").spice_level("hot").build()`.

**Q: Why should the "product" object (e.g., Pizza) typically be immutable?**
Answer: The Builder pattern's value comes from ensuring an object is only ever in a valid, fully-constructed state once `build()` returns — validation happens once, in one place. If the product were mutable afterward, code elsewhere could bypass the builder's validation and put the object into an invalid state directly, defeating the purpose of centralizing construction logic in the builder.

**Q: How does Builder differ from just using default keyword arguments on a regular constructor?**
Answer: Default keyword arguments work fine for objects with a handful of independent optional fields with no interdependencies. Builder is preferred when: (1) there are many optional fields and the call site becomes unreadable even with keywords, (2) some combinations of fields are invalid and need validation logic that doesn't belong in `__init__` (e.g., "stuffed crust incompatible with gluten-free"), or (3) construction happens incrementally across multiple steps/conditionals rather than as one call.

**Q: What is the role of a "Director" in the classic Builder pattern, and why is it often omitted in Python?**
Answer: In the original GoF pattern, a Director class encapsulates a fixed sequence of builder calls to produce a standard variant of the product (e.g., `PizzaDirector.make_margherita(builder)`). In Python, this is often skipped because the fluent chaining API is already readable and flexible enough that the calling code can act as its own director — introducing a separate Director class adds indirection without much benefit unless the same exact build sequence is reused in many places.

**Q: Give a real-world example of Builder pattern in a Python library you've used.**
Answer: `requests.Request` / `requests.PreparedRequest`, and more explicitly `httpx.Client` with chained configuration, follow the same shape — constructing an HTTP request incrementally (method, URL, headers, body, timeout) before it's "built"/sent. SQLAlchemy's query API (`session.query(Model).filter(...).order_by(...).limit(...)`) is another widely recognized fluent-builder-style API, even though it technically builds a query object rather than calling a final `.build()`.
