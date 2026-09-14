# Magic Methods and Properties — Complete Guide

## Table of Contents
1. [What Are Magic (Dunder) Methods?](#1-what-are-magic-dunder-methods)
2. [`__str__` vs `__repr__`](#2-__str__-vs-__repr__)
3. [`__eq__` and `__hash__`](#3-__eq__-and-__hash__)
4. [Ordering With `__lt__` and `functools.total_ordering`](#4-ordering-with-__lt__-and-functoolstotal_ordering)
5. [`@property` and `@x.setter`](#5-property-and-xsetter)
6. [Putting It All Together](#6-putting-it-all-together)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Are Magic (Dunder) Methods?

Magic methods (also called "dunder" methods, for **d**ouble **under**score) let your objects hook into Python's built-in syntax and functions — `print()`, `==`, `<`, `{}`/`set()` membership, and more — instead of forcing callers to remember custom method names.

```
Without magic methods:            With magic methods:
  obj.equals(other)                 obj == other
  obj.to_string()                   str(obj)
  obj.compare_to(other) < 0         obj < other
  obj.get_hash_code()               hash(obj)
```

Well-implemented magic methods are what make custom classes feel like "native" Python types — a common expectation in interview code.

---

## 2. `__str__` vs `__repr__`

- `__str__` — a **readable** representation, meant for end users (`print(obj)`, `str(obj)`, f-strings).
- `__repr__` — an **unambiguous** representation, meant for developers (REPL display, debugging, logs, and used as the fallback when `__str__` is missing).

### Bad Example — No Custom Representation

```python
class Money:
    def __init__(self, amount: float, currency: str) -> None:
        self.amount = amount
        self.currency = currency


m = Money(499.99, "USD")
print(m)       # <__main__.Money object at 0x104a1e5d0>  — useless
print([m])     # [<__main__.Money object at 0x104a1e5d0>] — useless in logs too
```

Debugging a list of these objects, or logging one in production, gives you a meaningless memory address.

### Good Example

```python
class Money:
    def __init__(self, amount: float, currency: str) -> None:
        self.amount = amount
        self.currency = currency

    def __str__(self) -> str:
        return f"{self.amount:.2f} {self.currency}"          # human-friendly

    def __repr__(self) -> str:
        return f"Money(amount={self.amount!r}, currency={self.currency!r})"  # dev-friendly, unambiguous


m = Money(499.99, "USD")
print(m)          # 499.99 USD                (uses __str__)
print(f"{m}")     # 499.99 USD                (uses __str__)
print(repr(m))    # Money(amount=499.99, currency='USD')  (uses __repr__)
print([m])        # [Money(amount=499.99, currency='USD')] — lists always use repr() on elements
```

**Rule of thumb:** always implement `__repr__` (ideally so `eval(repr(obj))` could reconstruct an equal object) — it's what shows up in lists, tuples, dicts, and debuggers. Implement `__str__` additionally when you want a nicer user-facing display; if you skip `__str__`, Python falls back to `__repr__`.

---

## 3. `__eq__` and `__hash__`

By default, Python compares objects by **identity** (memory address), not by their data.

### Bad Example — Default Identity Comparison

```python
class Point:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y


p1 = Point(1, 2)
p2 = Point(1, 2)

print(p1 == p2)  # False — different objects in memory, even though "equal" in value
```

Two points with identical coordinates compare unequal — almost never what you want for a value-like object.

### Good Example — Value-Based Equality

```python
class Point:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __hash__(self) -> int:
        return hash((self.x, self.y))

    def __repr__(self) -> str:
        return f"Point({self.x}, {self.y})"


p1 = Point(1, 2)
p2 = Point(1, 2)

print(p1 == p2)         # True — compared by value now
print(p1 in {p2})       # True — set membership uses __eq__ and __hash__ together
print({p1, p2})         # {Point(1, 2)} — treated as one element in a set, since equal + same hash
```

**Critical rule:** if you override `__eq__`, you must also override `__hash__` (or explicitly set `__hash__ = None` to make the object unhashable), otherwise Python's default `__hash__` — based on identity — becomes inconsistent with your value-based `__eq__`. Two objects that are `==` must have the same `hash()`, or sets and dict keys will behave incorrectly (silently, which is worse than an error).

---

## 4. Ordering With `__lt__` and `functools.total_ordering`

To make objects sortable (`sorted()`, `<`, `>`), implement comparison methods.

```python
from functools import total_ordering


@total_ordering
class Employee:
    def __init__(self, name: str, salary: float) -> None:
        self.name = name
        self.salary = salary

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Employee):
            return NotImplemented
        return self.salary == other.salary

    def __lt__(self, other: "Employee") -> bool:
        if not isinstance(other, Employee):
            return NotImplemented
        return self.salary < other.salary

    def __repr__(self) -> str:
        return f"Employee({self.name!r}, {self.salary})"


employees = [Employee("Asha", 90000), Employee("Ravi", 75000), Employee("Meera", 110000)]
print(sorted(employees))
# [Employee('Ravi', 75000), Employee('Asha', 90000), Employee('Meera', 110000)]

print(employees[0] > employees[1])  # True — >, <=, >= all derived automatically
```

`@total_ordering` fills in `<=`, `>`, `>=` automatically from just `__eq__` and `__lt__`, saving you from implementing all four comparison dunders by hand.

---

## 5. `@property` and `@x.setter`

`@property` lets a method be accessed like an attribute (no parentheses) while still running code — the mechanism behind read-only and validated attributes introduced in Lesson 03.

### Bad Example — Java-Style Getters/Setters (Not Pythonic)

```python
class Temperature:
    def __init__(self, celsius: float) -> None:
        self._celsius = celsius

    def get_celsius(self) -> float:
        return self._celsius

    def set_celsius(self, value: float) -> None:
        if value < -273.15:
            raise ValueError("Below absolute zero")
        self._celsius = value

    def get_fahrenheit(self) -> float:
        return self._celsius * 9 / 5 + 32


t = Temperature(25)
print(t.get_celsius())        # 25 — works, but verbose and un-Pythonic
t.set_celsius(30)
print(t.get_fahrenheit())     # 86.0
```

Functionally correct, but every read/write needs explicit method-call syntax — clunky compared to native Python attribute access, and every existing caller using `t.celsius` directly (if this class started that way) would break if you later needed to add validation.

### Good Example — `@property`

```python
class Temperature:
    def __init__(self, celsius: float) -> None:
        self.celsius = celsius   # goes through the setter below, validated from the start

    @property
    def celsius(self) -> float:
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:
        if value < -273.15:
            raise ValueError("Below absolute zero")
        self._celsius = value

    @property
    def fahrenheit(self) -> float:          # computed, read-only property — no setter defined
        return self._celsius * 9 / 5 + 32


t = Temperature(25)
print(t.celsius)          # 25 — reads like a plain attribute
t.celsius = 30             # writes like a plain attribute, but runs validation
print(t.fahrenheit)        # 86.0 — computed on the fly, no separate "stored" field

t.celsius = -500           # ValueError: Below absolute zero
t.fahrenheit = 100          # AttributeError: property 'fahrenheit' has no setter — read-only
```

This is exactly why `@property` is preferred in Python over manual getter/setter methods: callers use plain, idiomatic attribute syntax (`t.celsius`, not `t.get_celsius()`), while the class retains full control over validation and can even expose computed, read-only values like `fahrenheit`. Critically, if `Temperature` originally exposed `celsius` as a plain public attribute and later needed validation, switching to `@property` requires **zero changes to any caller's code** — `t.celsius = 30` looks identical before and after.

---

## 6. Putting It All Together

A realistic LLD-style value object combining everything above:

```python
from functools import total_ordering


@total_ordering
class Money:
    def __init__(self, amount: float, currency: str = "USD") -> None:
        self.amount = amount   # goes through the setter, validated
        self.currency = currency

    @property
    def amount(self) -> float:
        return self._amount

    @amount.setter
    def amount(self, value: float) -> None:
        if value < 0:
            raise ValueError("Money amount cannot be negative")
        self._amount = round(value, 2)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.amount == other.amount and self.currency == other.currency

    def __lt__(self, other: "Money") -> bool:
        if not isinstance(other, Money) or self.currency != other.currency:
            return NotImplemented
        return self.amount < other.amount

    def __hash__(self) -> int:
        return hash((self.amount, self.currency))

    def __repr__(self) -> str:
        return f"Money({self.amount!r}, {self.currency!r})"

    def __str__(self) -> str:
        return f"{self.amount:.2f} {self.currency}"


prices = [Money(499.99), Money(50.00), Money(199.50)]
print(sorted(prices))               # sorted by amount via __lt__
print(Money(50.00) == Money(50.0))  # True — value equality
print(f"Total item: {prices[0]}")   # Total item: 499.99 USD
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `Book` class with `title`, `author`, `isbn`. Implement `__eq__`/`__hash__` based on `isbn` alone (two books with the same ISBN are the "same" book, regardless of other fields).

**Exercise 2:** Add `__str__` and `__repr__` to a `Order` class so that `print(order)` shows a friendly summary and `repr(order)` shows a developer-focused, reconstructable string.

**Exercise 3:** Use `@property`/`@x.setter` on a `Product` class to enforce `price >= 0` and `discount_percent` between 0 and 100, and add a read-only computed `final_price` property.

**Exercise 4:** Make a `Version` class (e.g., representing `"1.4.2"`) sortable with `@total_ordering`, comparing major/minor/patch numerically (not as strings — explain why string comparison of versions like `"1.10.0"` vs `"1.9.0"` would be wrong).

---

## 8. Interview Q&A

**Q: What is the difference between `__str__` and `__repr__`?**
Answer: `__str__` provides a human-readable representation intended for end users, invoked by `str()`, `print()`, and f-strings. `__repr__` provides an unambiguous, developer-facing representation, invoked by `repr()`, the interactive REPL, and used as a fallback whenever `__str__` isn't defined; it's also what's shown for objects inside containers like lists. Best practice is to always define `__repr__` (ideally something that could recreate the object) and add `__str__` only when a friendlier display is needed.

**Q: Why must you implement `__hash__` whenever you implement `__eq__`?**
Answer: Python's contract for hashable objects requires that two objects considered equal (`==`) must produce the same hash value, since sets and dict keys rely on hashing to bucket objects and then use `__eq__` to confirm matches within a bucket. If you only override `__eq__`, Python doesn't automatically update `__hash__` for you in a compatible way — by default, defining `__eq__` actually sets `__hash__` to `None`, making instances unhashable. You must explicitly define `__hash__` (usually based on the same fields used in `__eq__`) to keep the object usable in sets and as dict keys.

**Q: What does `functools.total_ordering` do, and what's the minimum you need to provide?**
Answer: `total_ordering` is a class decorator that fills in the remaining rich comparison methods (`<=`, `>`, `>=`) automatically, as long as you provide `__eq__` and one of `__lt__`, `__le__`, `__gt__`, or `__ge__` yourself. It saves you from manually and redundantly implementing all combinations of comparison operators while still making the class fully sortable and comparable.

**Q: Why is `@property` preferred over explicit `get_x()`/`set_x()` methods in Python?**
Answer: `@property` lets attribute-style access (`obj.x`, `obj.x = value`) run validation or computed logic behind the scenes, which is both more idiomatic (Python favors direct attribute syntax) and non-breaking: if a class starts with a plain public attribute and later needs validation, converting it to a `@property` requires no changes to any caller's code, since the access syntax stays identical. Explicit getter/setter methods, by contrast, are verbose and — if introduced later — require rewriting every call site that used direct attribute access.

**Q: What happens if you compare two objects of different types using `__eq__`, and why should you return `NotImplemented` rather than `False` for a type mismatch?**
Answer: Returning `NotImplemented` (not the same as raising `NotImplementedError`) tells Python that this particular `__eq__` implementation doesn't know how to compare against the other type, so Python then tries the other object's `__eq__` (or its reflected method) before ultimately falling back to `False` if neither side can compare. Returning `False` directly short-circuits that mechanism and can produce asymmetric or incorrect results in edge cases involving subclasses or duck-typed comparisons; `NotImplemented` is the technically correct signal.

**Q: Can a read-only property (defined with only `@property`, no setter) still be reassigned by external code?**
Answer: No — attempting `obj.some_property = value` on a property with no corresponding `@some_property.setter` raises an `AttributeError` stating the property has no setter. This is exactly how you expose computed or derived values (like `fahrenheit` derived from `celsius`, or `final_price` derived from `price` and `discount`) as read-only from the outside while keeping the underlying computation encapsulated inside the class.
