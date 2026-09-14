# Generics Basics — Complete Guide

## Table of Contents
1. [The Problem: Type-Unsafe Reusable Containers](#1-the-problem-type-unsafe-reusable-containers)
2. [TypeVar Fundamentals](#2-typevar-fundamentals)
3. [Building a Generic Stack[T]](#3-building-a-generic-stackt)
4. [Building a Generic Repository[T] for LLD](#4-building-a-generic-repositoryt-for-lld)
5. [Bounded TypeVars](#5-bounded-typevars)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Type-Unsafe Reusable Containers

Suppose you need a `Stack` in an LLD problem (e.g., undo/redo history, browser back button, parenthesis matching). Without generics, you either:

**(a) Write one Stack per type** — massive duplication:

```python
class IntStack:
    def __init__(self) -> None:
        self._items: list[int] = []

    def push(self, item: int) -> None:
        self._items.append(item)

    def pop(self) -> int:
        return self._items.pop()


class StrStack:
    def __init__(self) -> None:
        self._items: list[str] = []
    # ... identical logic, different type
```

**(b) Write one untyped Stack** — reusable, but loses all type safety:

```python
class Stack:
    def __init__(self) -> None:
        self._items: list = []

    def push(self, item) -> None:
        self._items.append(item)

    def pop(self):
        return self._items.pop()


s = Stack()
s.push(1)
s.push("oops")     # no error — mixed types silently allowed
x: int = s.pop()   # returns "oops" — a str assigned to an int-typed variable, no warning
```

Generics solve this: **one implementation, reusable across types, with full type safety preserved.**

---

## 2. TypeVar Fundamentals

```python
from typing import TypeVar

T = TypeVar("T")  # T is a placeholder for "some type, to be determined by the caller"


def first_item(items: list[T]) -> T:
    return items[0]


x: int = first_item([1, 2, 3])          # T is inferred as int
y: str = first_item(["a", "b", "c"])    # T is inferred as str
```

`TypeVar` declares a *type variable* — a stand-in that a static checker (or a human reader) resolves to a concrete type at each call site. It's the generic-programming equivalent of a function parameter, but for types instead of values.

---

## 3. Building a Generic Stack[T]

```python
from typing import Generic, TypeVar

T = TypeVar("T")


class Stack(Generic[T]):
    """A type-safe, reusable stack for any element type T."""

    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self) -> T:
        if not self._items:
            raise IndexError("peek from empty stack")
        return self._items[-1]

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def __len__(self) -> int:
        return len(self._items)


# Usage — the concrete type is fixed per instance
int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push(2)
print(int_stack.pop())     # 2 — correctly typed as int

str_stack: Stack[str] = Stack()
str_stack.push("hello")
# str_stack.push(42)        # mypy error: expected str, got int
print(str_stack.pop())     # "hello" — correctly typed as str
```

`Stack(Generic[T])` is a single implementation. `Stack[int]` and `Stack[str]` are both valid, fully type-checked usages of it — no duplication, no loss of type safety.

---

## 4. Building a Generic Repository[T] for LLD

The `Repository` pattern (a common LLD/DDD building block: an abstraction over "storage of domain objects", used heavily in Phases 08–11 for things like `OrderRepository`, `UserRepository`, `BookingRepository`) is a textbook use case for generics — the CRUD logic is identical regardless of what entity you're storing.

```python
from typing import Generic, TypeVar
from dataclasses import dataclass

T = TypeVar("T")


class Repository(Generic[T]):
    """Generic in-memory repository — reusable across any entity type."""

    def __init__(self) -> None:
        self._storage: dict[str, T] = {}

    def add(self, entity_id: str, entity: T) -> None:
        self._storage[entity_id] = entity

    def get(self, entity_id: str) -> T | None:
        return self._storage.get(entity_id)

    def delete(self, entity_id: str) -> bool:
        if entity_id in self._storage:
            del self._storage[entity_id]
            return True
        return False

    def get_all(self) -> list[T]:
        return list(self._storage.values())


@dataclass
class User:
    user_id: str
    name: str


@dataclass
class Order:
    order_id: str
    total: float


# One Repository implementation, reused for two unrelated entity types
user_repo: Repository[User] = Repository()
user_repo.add("u1", User(user_id="u1", name="Alice"))
print(user_repo.get("u1"))          # User(user_id='u1', name='Alice')

order_repo: Repository[Order] = Repository()
order_repo.add("o1", Order(order_id="o1", total=99.5))
print(order_repo.get_all())         # [Order(order_id='o1', total=99.5)]
```

Without generics, you'd either write `UserRepository` and `OrderRepository` as separate near-identical classes (violating DRY) or use an untyped `Repository` and lose the ability for callers to know `get()` returns a `User` vs an `Order`.

---

## 5. Bounded TypeVars

Sometimes you want a generic container that works for *any* type that satisfies some constraint — e.g., "any type with an `id` attribute" — rather than truly *any* type. This is done with a **bound**:

```python
from typing import Generic, TypeVar, Protocol


class HasId(Protocol):
    id: str


TEntity = TypeVar("TEntity", bound=HasId)


class IndexedRepository(Generic[TEntity]):
    """Like Repository, but requires entities to expose an `.id` attribute,
    so it can index them automatically without the caller passing a key."""

    def __init__(self) -> None:
        self._storage: dict[str, TEntity] = {}

    def add(self, entity: TEntity) -> None:
        self._storage[entity.id] = entity   # safe: TEntity is guaranteed to have .id

    def get(self, entity_id: str) -> TEntity | None:
        return self._storage.get(entity_id)


from dataclasses import dataclass


@dataclass
class Product:
    id: str
    name: str
    price: float


repo: IndexedRepository[Product] = IndexedRepository()
repo.add(Product(id="p1", name="Widget", price=9.99))
print(repo.get("p1"))   # Product(id='p1', name='Widget', price=9.99)
```

Bounding `TEntity` to `HasId` (a `Protocol` — combining this lesson with the previous one) lets `IndexedRepository` safely call `entity.id` inside a fully generic class, something an unbounded `TypeVar` would not allow a type checker to verify.

---

## 6. Why This Matters for LLD Interviews

- **DRY at the type level:** interviewers often ask you to design multiple repositories/collections (`OrderRepository`, `UserRepository`, `VehicleRepository`) — recognizing that the CRUD logic is identical and factoring it into one `Repository[T]` demonstrates the same DRY instinct you apply to regular code, applied to types.
- **Preserves type safety without duplication:** shows you know the difference between "generic and safe" (`Generic[T]`) versus "generic and unsafe" (using `object` or no hints at all, i.e., losing all type information).
- **Natural fit with the Repository pattern**, which frequently appears as a supporting structure inside the larger system designs of Phases 08–11 (e.g., an in-memory `BookingRepository[Booking]` inside a booking system design).
- **Bounded generics show depth:** most candidates stop at basic `TypeVar`; being able to explain and use `bound=` (optionally combined with `Protocol`) signals a stronger grasp of Python's type system.

---

## 7. Hands-On Exercises

**Exercise 1:** Implement a generic `Queue[T]` (FIFO) with `enqueue`, `dequeue`, `is_empty`, mirroring the `Stack[T]` example. Use it with both `int` and a custom `Task` dataclass.

**Exercise 2:** Extend `Repository[T]` with a `find_by(self, predicate: Callable[[T], bool]) -> list[T]` method (hint: `Callable` comes from `typing`) that filters stored entities using an arbitrary predicate function.

**Exercise 3:** Create a bounded `TypeVar` `TComparable` (bound to a `Comparable` Protocol with `compare_to`) and write a generic `def find_max(items: list[TComparable]) -> TComparable` function.

**Exercise 4:** Explain in a short comment why `Stack(Generic[T])` with `self._items: list[T] = []` is safer for callers than a `Stack` whose `_items` is typed as `list` (no `T`).

---

## 8. Interview Q&A

**Q: What problem does `TypeVar` and `Generic[T]` solve that a plain untyped class doesn't?**
Answer: A plain untyped class (e.g., `_items: list` with no element type) is reusable across types but loses all type safety — nothing prevents mixing types or catches a type mismatch until runtime, if ever. `Generic[T]` lets you write the implementation once while preserving full type-checking per usage: `Stack[int]` and `Stack[str]` are each fully type-safe, and a static checker will flag pushing a `str` into a `Stack[int]`.

**Q: What's the difference between writing `UserRepository` and `OrderRepository` as separate classes versus a generic `Repository[T]`?**
Answer: Separate classes duplicate identical CRUD logic (`add`, `get`, `delete`, `get_all`) for every entity type, violating DRY and requiring a maintenance change in N places for any bug fix. `Repository[T]` implements that logic once; `Repository[User]` and `Repository[Order]` are just parameterized usages of the same code, each still fully type-checked for the entity type they hold.

**Q: What does a "bounded" TypeVar mean, and why would you use one?**
Answer: A bounded TypeVar (`TypeVar("T", bound=SomeType)`) restricts the generic parameter to only types that are (or satisfy) `SomeType`, rather than allowing literally any type. This lets the generic class safely call methods/access attributes defined by that bound inside its own implementation — e.g., an `IndexedRepository[TEntity]` bounded to a `HasId` Protocol can safely do `entity.id` because every valid `TEntity` is guaranteed to have that attribute.

**Q: Are Python generics enforced at runtime?**
Answer: No — like type hints generally, `Generic[T]`/`TypeVar` are purely a static-typing construct checked by tools like `mypy`. At runtime, Python does not prevent you from pushing a `str` into a `Stack[int]`; the type parameter exists for tooling and documentation purposes, not runtime enforcement (this differs from languages like Java, where generics interact with runtime type erasure differently, or C++, where templates are checked at compile time).

**Q: Give a real LLD scenario where you'd reach for a generic class instead of writing type-specific classes.**
Answer: Any time you need multiple structurally identical containers or repositories for different domain entities — e.g., an in-memory `Repository[T]` used as `Repository[Order]`, `Repository[User]`, and `Repository[Vehicle]` within the same system design, or a generic `Cache[T]`/`Stack[T]`/`Queue[T]` used for undo-history, LRU caching, or BFS/DFS traversal across different node types. Generics let you implement and test that logic exactly once.
