# Singleton Pattern — Complete Guide

## Table of Contents
1. [Motivation](#1-motivation)
2. [Naive Implementation (Not Thread-Safe)](#2-naive-implementation-not-thread-safe)
3. [Thread-Safe Implementation](#3-thread-safe-implementation)
4. [Pythonic Idioms](#4-pythonic-idioms)
5. [Real Example: DB Connection Pool](#5-real-example-db-connection-pool)
6. [When to Avoid Singleton](#6-when-to-avoid-singleton)
7. [When to Use / Trade-offs](#7-when-to-use--trade-offs)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Motivation

Some objects should exist **exactly once** in an application: a logger, an application config, a connection pool, a cache manager. If any code can construct a new instance whenever it wants, you get:

```
Module A: logger = Logger()   → opens log_file handle #1
Module B: logger = Logger()   → opens log_file handle #2
Module C: logger = Logger()   → opens log_file handle #3

Result: 3 open file handles, interleaved/garbled writes,
        wasted resources, inconsistent state across "the" logger.
```

Singleton guarantees a class has **one instance**, with **one global point of access** to it.

```
┌─────────────────────────────────────────┐
│              Singleton                  │
│  ┌─────────────────────────────────┐    │
│  │  _instance: Singleton | None     │   │
│  │  __new__(cls) -> Singleton       │   │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
        ▲            ▲            ▲
        │            │            │
   Module A     Module B     Module C
   (all get the SAME object back)
```

---

## 2. Naive Implementation (Not Thread-Safe)

```python
class Logger:
    """Naive singleton — breaks under concurrent access."""

    _instance: "Logger | None" = None

    def __new__(cls) -> "Logger":
        if cls._instance is None:
            # DANGER: two threads can both pass this check
            # before either one sets cls._instance.
            cls._instance = super().__new__(cls)
            cls._instance._log_buffer = []
        return cls._instance

    def log(self, message: str) -> None:
        self._log_buffer.append(message)


# Single-threaded usage works fine:
a = Logger()
b = Logger()
print(a is b)  # True
```

The bug: if two threads call `Logger()` at almost the same instant, both can see `cls._instance is None` as `True` before either assignment happens, so **two distinct instances get created** — silently defeating the entire point of the pattern. This is a classic race condition (check-then-act without a lock).

---

## 3. Thread-Safe Implementation

```python
import threading


class Logger:
    """Thread-safe singleton using double-checked locking."""

    _instance: "Logger | None" = None
    _lock = threading.Lock()

    def __new__(cls) -> "Logger":
        # First check without the lock (fast path — avoids
        # locking on every call once the instance exists).
        if cls._instance is None:
            with cls._lock:
                # Second check inside the lock (slow path —
                # guards against two threads both passing the
                # first check before either acquires the lock).
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._log_buffer = []
        return cls._instance

    def log(self, message: str) -> None:
        self._log_buffer.append(message)
```

This is the classic **double-checked locking** pattern: lock only on the rare path where the instance might not exist yet, so subsequent calls (the common case) pay no locking overhead.

---

## 4. Pythonic Idioms

Python offers several ways to get singleton-like behavior, and interviewers like to see you know more than one:

### 4.1 Module-Level Singleton (the most "Pythonic" option)

Python modules are already singletons — imported once and cached in `sys.modules`. This is usually the *simplest correct* answer in Python, though it's less commonly what interviewers are probing for.

```python
# config.py
class _Config:
    def __init__(self) -> None:
        self.debug = False
        self.max_connections = 10

config = _Config()  # module-level instance

# anywhere else:
# from config import config
# config.debug = True   -> every importer sees the same object
```

### 4.2 Metaclass Approach

Useful when you want **multiple** singleton classes without repeating `__new__` boilerplate in each.

```python
import threading
from typing import Any


class SingletonMeta(type):
    """Metaclass that makes any class using it a singleton."""

    _instances: dict[type, Any] = {}
    _lock = threading.Lock()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        if cls not in cls._instances:
            with cls._lock:
                if cls not in cls._instances:
                    cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class AppConfig(metaclass=SingletonMeta):
    def __init__(self) -> None:
        self.env = "production"


class CacheManager(metaclass=SingletonMeta):
    def __init__(self) -> None:
        self.store: dict[str, str] = {}


a = AppConfig()
b = AppConfig()
print(a is b)          # True
print(a is CacheManager())  # False — different singleton class
```

### 4.3 `__new__` Override (shown above)

The most explicit and commonly asked-for approach in interviews because it demonstrates you understand Python's object creation protocol (`__new__` creates, `__init__` initializes — and `__init__` runs *every time* `Logger()` is called, even on an existing instance, so guard re-initialization if it matters).

---

## 5. Real Example: DB Connection Pool

```python
import threading
from typing import Any


class ConnectionPool(metaclass=SingletonMeta):
    """A single shared pool of DB connections for the whole app."""

    def __init__(self, max_size: int = 5) -> None:
        # NOTE: __init__ runs on every ConnectionPool(...) call,
        # even though it's the same instance. Guard against
        # re-running expensive setup.
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        self._max_size = max_size
        self._available: list[str] = [f"conn-{i}" for i in range(max_size)]
        self._in_use: set[str] = set()
        self._lock = threading.Lock()

    def acquire(self) -> str:
        with self._lock:
            if not self._available:
                raise RuntimeError("No available connections in pool")
            conn = self._available.pop()
            self._in_use.add(conn)
            return conn

    def release(self, conn: str) -> None:
        with self._lock:
            self._in_use.discard(conn)
            self._available.append(conn)


# Anywhere in the app:
pool_1 = ConnectionPool(max_size=5)
pool_2 = ConnectionPool(max_size=999)  # arg ignored — same instance
print(pool_1 is pool_2)  # True
conn = pool_1.acquire()
pool_2.release(conn)  # same underlying pool
```

This mirrors real systems: `psycopg2` connection pools, `boto3` sessions, and Django's settings object all behave as de-facto singletons for the same reason — creating a new pool/session per request would exhaust the DB or the AWS API rate limit.

---

## 6. When to Avoid Singleton

Singleton is one of the most **overused and interview-criticized** patterns. Push back on it explicitly if asked "would you use Singleton here?":

| Problem | Why it hurts |
|---------|---------------|
| **Global mutable state** | Any code, anywhere, can mutate the singleton — makes reasoning about program state hard, especially in large codebases. |
| **Hidden dependencies** | A class silently pulling `ConnectionPool()` internally hides a real dependency that should be passed explicitly (dependency injection), making the class harder to understand from its constructor alone. |
| **Testability** | Tests can't easily substitute a fake/mock because the singleton is baked into the class itself, not injected. Test A's mutation of the singleton can leak into Test B if you forget to reset state. |
| **Concurrency bugs** | Singletons are shared across threads by definition — any internal state needs explicit locking, and it's easy to forget one spot. |
| **Multiprocessing doesn't help** | Each process gets its own singleton instance anyway (no shared memory by default), so "singleton" guarantees can be misleading in multi-process deployments (e.g., Gunicorn workers). |

**Preferred alternative in most real systems:** dependency injection — construct the shared object once at application startup and pass it explicitly into whatever needs it. This keeps the "one instance" property while making dependencies visible and mocks trivial in tests.

---

## 7. When to Use / Trade-offs

| Use Singleton when | Avoid Singleton when |
|---|---|
| Exactly one instance must coordinate access to a shared resource (log file, connection pool, hardware device) | You can pass the shared object explicitly via constructor/DI instead |
| The object is stateless or its state is meant to be truly global (app-wide config) | You need per-test or per-request isolation |
| You're in a single-process, single-runtime context | You're scaling across multiple processes/machines and expect "the one instance" to mean one instance *system-wide* (it won't) |

---

## 8. Interview Q&A

**Q: What problem does the Singleton pattern solve?**
Answer: It ensures a class has exactly one instance and provides a single global access point to it. This matters for objects that model a genuinely singular resource — a log file, a hardware connection, a shared cache — where multiple instances would cause resource conflicts, wasted memory, or inconsistent state.

**Q: Implement a thread-safe Singleton in Python from scratch.**
Answer: Override `__new__` to check a class-level `_instance` attribute; if `None`, acquire a `threading.Lock` and check again inside the lock before creating the instance (double-checked locking). The first check avoids the locking cost on every call once the instance exists; the second check inside the lock prevents two threads from both passing the outer check and creating two instances. Example: `if cls._instance is None: with cls._lock: if cls._instance is None: cls._instance = super().__new__(cls)`.

**Q: Why is the naive `__new__` check (without a lock) broken?**
Answer: It's a check-then-act race condition. Two threads can both evaluate `cls._instance is None` as `True` before either thread executes the assignment, because there's no atomicity between the check and the write. Both threads then proceed to create and assign a new instance, so the class ends up with two "singleton" instances and the guarantee is violated.

**Q: What's the difference between using `__new__`, a metaclass, and a module-level singleton in Python?**
Answer: `__new__` override is explicit but must be repeated (or mixed in) per class. A metaclass (`SingletonMeta`) centralizes the logic once and applies it to any class via `metaclass=SingletonMeta`, which is cleaner when multiple singleton classes exist. A module-level instance (a plain object created at module scope) relies on Python's module-caching in `sys.modules` — it's the simplest and most "Pythonic" approach for app-wide singletons like config, though it's less explicit about intent to someone reading the class in isolation.

**Q: Why do senior engineers often discourage Singleton, and what do they use instead?**
Answer: Singleton introduces global mutable state, hides a class's real dependencies (since the singleton is looked up internally rather than passed in), and makes unit testing harder because you can't easily substitute a mock — tests can also leak state into each other via the shared instance. The common alternative is dependency injection: construct the shared object once at application startup (which still gives you "one instance") and pass it explicitly to any class that needs it, keeping dependencies visible and testable.

**Q: Does Singleton work correctly across multiple processes, e.g., multiple Gunicorn workers?**
Answer: No. Singleton guarantees one instance per Python process/interpreter, not one instance system-wide. Each worker process has its own memory space and therefore its own "singleton" instance. If you need true cross-process single-instance coordination (e.g., one connection pool shared by all workers), you need an external resource — a separate process, a shared database, or a service like Redis — not an in-process Singleton.
