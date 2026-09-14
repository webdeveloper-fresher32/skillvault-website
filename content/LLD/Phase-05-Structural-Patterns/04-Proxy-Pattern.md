# Proxy Pattern — Complete Guide

## Table of Contents
1. [The Problem Proxy Solves](#1-the-problem-proxy-solves)
2. [What is the Proxy Pattern?](#2-what-is-the-proxy-pattern)
3. [Bad Example: No Proxy](#3-bad-example-no-proxy)
4. [Good Example: Virtual Proxy (Lazy Image Loading)](#4-good-example-virtual-proxy-lazy-image-loading)
5. [Good Example: Protection Proxy (Access-Controlled DB Connection)](#5-good-example-protection-proxy-access-controlled-db-connection)
6. [Other Proxy Types](#6-other-proxy-types)
7. [When to Use / Trade-offs](#7-when-to-use--trade-offs)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem Proxy Solves

Sometimes you want an object's *interface* available immediately, but creating/accessing the *real* object is expensive, remote, or should be gated by a permission check — and you don't want every caller responsible for that logic.

```
Expensive resource:  a 50MB image, a DB connection pool, a remote API client
Problem: creating it eagerly (e.g., in __init__) wastes time/memory if it's
         never actually used, or exposes it to callers who shouldn't have
         unrestricted access.
```

You want callers to keep using the same interface as if they held the real object — but something should stand in front of it, controlling *when* and *whether* the real object is touched.

---

## 2. What is the Proxy Pattern?

Proxy provides a surrogate or placeholder for another object to control access to it. The proxy implements the same interface as the real subject, so clients can't tell whether they're talking to the real object or a proxy.

```
┌───────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Client   │────▶│ Subject (interface)│◀────│  RealSubject      │
└───────────┘     └────────────────────┘     │ (expensive/       │
                             ▲                 │  sensitive)       │
                             │ implements       └──────────────────┘
                   ┌──────────────────┐                ▲
                   │      Proxy        │── delegates ───┘
                   │ (controls access) │    to real subject
                   └──────────────────┘    (when appropriate)
```

Common proxy types:
- **Virtual Proxy** — defers creation of an expensive object until it's actually needed (lazy loading).
- **Protection Proxy** — checks permissions before allowing access to the real object.
- **Remote Proxy** — represents an object living in a different address space/process (e.g., RPC stubs).
- **Caching Proxy** — caches results of expensive operations on the real subject.

---

## 3. Bad Example: No Proxy

```python
class HighResImage:
    """Expensive to construct — simulates loading a large file from disk."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        print(f"[HighResImage] Loading {filename} from disk... (slow, ~50MB)")

    def render(self) -> None:
        print(f"[HighResImage] Rendering {self.filename}")


class ImageGallery:
    def __init__(self, filenames: list[str]) -> None:
        # Every image is loaded immediately, even ones the user never scrolls to.
        self.images = [HighResImage(f) for f in filenames]

    def render_image(self, index: int) -> None:
        self.images[index].render()


gallery = ImageGallery(["a.png", "b.png", "c.png"])  # loads ALL 3 images upfront
gallery.render_image(0)  # user only ever looks at the first one
```

**Why this is painful:**
- All images load eagerly at gallery construction, even ones the user never views — wastes memory and startup time.
- There's no natural place to insert an access check (e.g., "only premium users can view `c.png`") without littering `if` checks through `ImageGallery`.

---

## 4. Good Example: Virtual Proxy (Lazy Image Loading)

```python
from abc import ABC, abstractmethod


class Image(ABC):
    @abstractmethod
    def render(self) -> None:
        raise NotImplementedError


class HighResImage(Image):
    """The real, expensive object."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        print(f"[HighResImage] Loading {filename} from disk... (slow, ~50MB)")

    def render(self) -> None:
        print(f"[HighResImage] Rendering {self.filename}")


class LazyImageProxy(Image):
    """Virtual proxy: defers creating the real HighResImage until render() is first called."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self._real_image: HighResImage | None = None

    def render(self) -> None:
        if self._real_image is None:  # created only on first actual use
            self._real_image = HighResImage(self.filename)
        self._real_image.render()


class ImageGallery:
    def __init__(self, filenames: list[str]) -> None:
        # Only lightweight proxies are created here — no disk I/O yet.
        self.images: list[Image] = [LazyImageProxy(f) for f in filenames]

    def render_image(self, index: int) -> None:
        self.images[index].render()


if __name__ == "__main__":
    gallery = ImageGallery(["a.png", "b.png", "c.png"])  # instant — nothing loaded yet
    print("Gallery constructed. No images loaded yet.")

    gallery.render_image(0)  # NOW a.png is loaded and rendered
    gallery.render_image(0)  # second call reuses the already-loaded real image
```

```
Output:
Gallery constructed. No images loaded yet.
[HighResImage] Loading a.png from disk... (slow, ~50MB)
[HighResImage] Rendering a.png
[HighResImage] Rendering a.png
```

`b.png` and `c.png` are never loaded because they're never rendered — exactly the win a virtual proxy gives you.

---

## 5. Good Example: Protection Proxy (Access-Controlled DB Connection)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


class DatabaseConnection(ABC):
    @abstractmethod
    def execute(self, query: str) -> list[dict]:
        raise NotImplementedError


class RealDatabaseConnection(DatabaseConnection):
    """The real, sensitive resource — direct DB access."""

    def execute(self, query: str) -> list[dict]:
        print(f"[DB] Executing: {query}")
        return [{"row": 1}]


@dataclass
class User:
    username: str
    role: str  # "admin" | "analyst" | "guest"


class ProtectedDatabaseProxy(DatabaseConnection):
    """Protection proxy: checks permissions before delegating to the real connection."""

    WRITE_KEYWORDS = ("INSERT", "UPDATE", "DELETE", "DROP")

    def __init__(self, real_connection: RealDatabaseConnection, user: User) -> None:
        self._real_connection = real_connection
        self._user = user

    def execute(self, query: str) -> list[dict]:
        is_write = any(query.strip().upper().startswith(kw) for kw in self.WRITE_KEYWORDS)

        if is_write and self._user.role != "admin":
            raise PermissionError(
                f"User '{self._user.username}' (role={self._user.role}) cannot run write queries"
            )
        if self._user.role == "guest" and not query.strip().upper().startswith("SELECT"):
            raise PermissionError("Guests can only run SELECT queries")

        return self._real_connection.execute(query)


if __name__ == "__main__":
    real_db = RealDatabaseConnection()

    admin_proxy = ProtectedDatabaseProxy(real_db, User("root", "admin"))
    admin_proxy.execute("DELETE FROM orders WHERE id = 1")  # allowed

    analyst_proxy = ProtectedDatabaseProxy(real_db, User("alice", "analyst"))
    analyst_proxy.execute("SELECT * FROM orders")  # allowed

    try:
        analyst_proxy.execute("DELETE FROM orders WHERE id = 2")  # blocked
    except PermissionError as e:
        print(f"Blocked: {e}")
```

```
Output:
[DB] Executing: DELETE FROM orders WHERE id = 1
[DB] Executing: SELECT * FROM orders
Blocked: User 'alice' (role=analyst) cannot run write queries
```

The client code (`admin_proxy.execute(...)`) looks identical whether it's talking to a proxy or a raw `RealDatabaseConnection` — the permission logic is entirely invisible to the caller and centralized in one place.

---

## 6. Other Proxy Types

| Type | What it controls | Real-world example |
|------|-------------------|---------------------|
| Virtual Proxy | Delays expensive creation until needed | Lazy-loaded images, lazy DB connection pools |
| Protection Proxy | Access/permission checks | Role-gated DB access, admin-only API wrappers |
| Remote Proxy | Local stand-in for an object in another process/machine | gRPC/RPC client stubs, ORMs proxying a remote row |
| Caching Proxy | Avoids recomputation/re-fetch | HTTP caching layer in front of a slow backend call |
| Logging Proxy | Records calls transparently | Instrumentation wrapper around a service client |

---

## 7. When to Use / Trade-offs

**Use Proxy when:**
- Creating/loading the real object is expensive and might not be needed at all (virtual proxy).
- You need to enforce access control without scattering permission checks through business logic (protection proxy).
- You need to add transparent cross-cutting behavior (caching, logging, remote marshaling) to something without the client knowing.

**Trade-offs:**
- Adds an extra layer of indirection — every call goes through the proxy, which can add latency or complexity to trace.
- If overused, proxies can hide too much (a caller might be surprised that "just reading a value" triggers a network call or an expensive load on first access).
- Proxy vs Decorator confusion is common — proxy controls *access*, decorator *adds behavior*; sometimes a class technically does both, and that's fine, but pick the name that matches its dominant intent.

---

## 8. Hands-On Exercises

**Exercise 1:** Extend `LazyImageProxy` to also cache a computed `thumbnail()` the first time it's requested, without re-loading the full-resolution image.

**Exercise 2:** Add a `CachingDatabaseProxy` that wraps `RealDatabaseConnection` and caches results of `SELECT` queries by query string, invalidating the cache whenever a write query runs.

**Exercise 3:** Combine both proxy types: build one `SmartDatabaseProxy` that does both lazy connection creation (don't connect to the DB until the first `execute` call) AND permission checking, using composition of two smaller proxies or one proxy with both responsibilities — discuss which is cleaner.

---

## 9. Interview Q&A

**Q: What problem does the Proxy pattern solve?**
Answer: It lets you control access to an object — deferring its expensive creation, restricting who can use it, or adding transparent cross-cutting behavior — without the client knowing or caring, because the proxy implements the exact same interface as the real object.

**Q: What is a Virtual Proxy? Give a concrete example.**
Answer: A Virtual Proxy defers the creation of an expensive resource until it's actually needed. Example: `LazyImageProxy` implements the same `Image` interface as `HighResImage` but only constructs the real `HighResImage` (which does the slow disk load) the first time `render()` is actually called — so images that are never viewed are never loaded.

**Q: What is a Protection Proxy? Give a concrete example.**
Answer: A Protection Proxy checks permissions/access rights before delegating a call to the real object, rejecting unauthorized calls before they reach it. Example: `ProtectedDatabaseProxy` wraps a `RealDatabaseConnection` and inspects the current user's role before allowing write queries (`INSERT`/`UPDATE`/`DELETE`) through, raising `PermissionError` for unauthorized roles — centralizing access control in one place instead of scattering `if user.role == ...` checks across business logic.

**Q: How is Proxy different from Decorator, given both wrap an object behind the same interface?**
Answer: Their structure is nearly identical, but intent differs. Decorator's purpose is to *add or enhance behavior* (logging, formatting) and is designed to be stacked freely. Proxy's purpose is to *control access* to the real object — deciding whether, when, or how a call reaches it (lazy creation, permission checks, remote dispatch) — and typically isn't stacked the same way. A useful test: if removing the wrapper would remove a *feature*, it's a decorator; if removing it would remove a *control/gate*, it's a proxy.

**Q: How is Proxy different from Facade?**
Answer: Proxy implements the *same* interface as a single real object and controls access to that one object. Facade defines a *new, simpler* interface over *multiple* different subsystem classes to reduce complexity. Proxy is a 1:1 stand-in; Facade is a many-to-one simplification.

**Q: Implement a Proxy pattern from scratch that adds result-caching in front of an expensive `WeatherService.get_forecast(city: str) -> str` call.**
Answer:
```python
from abc import ABC, abstractmethod
import time


class WeatherService(ABC):
    @abstractmethod
    def get_forecast(self, city: str) -> str:
        raise NotImplementedError


class RealWeatherService(WeatherService):
    def get_forecast(self, city: str) -> str:
        print(f"[RealWeatherService] Calling external API for {city}...")
        time.sleep(0.01)  # simulate network latency
        return f"Sunny in {city}"


class CachingWeatherProxy(WeatherService):
    def __init__(self, real_service: WeatherService) -> None:
        self._real_service = real_service
        self._cache: dict[str, str] = {}

    def get_forecast(self, city: str) -> str:
        if city not in self._cache:
            self._cache[city] = self._real_service.get_forecast(city)
        else:
            print(f"[CachingWeatherProxy] Cache hit for {city}")
        return self._cache[city]


proxy = CachingWeatherProxy(RealWeatherService())
print(proxy.get_forecast("Sydney"))  # calls real service
print(proxy.get_forecast("Sydney"))  # served from cache
```
