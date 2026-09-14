# Context Managers — Complete Guide

## Table of Contents
1. [The Problem: Manual Resource Cleanup](#1-the-problem-manual-resource-cleanup)
2. [The `with` Statement and the Context Manager Protocol](#2-the-with-statement-and-the-context-manager-protocol)
3. [Writing a Class-Based Context Manager](#3-writing-a-class-based-context-manager)
4. [contextlib.contextmanager — the Function-Based Shortcut](#4-contextlibcontextmanager--the-function-based-shortcut)
5. [Real LLD Use Case: A File-Based Lock](#5-real-lld-use-case-a-file-based-lock)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Manual Resource Cleanup

Any resource that must be explicitly released — a DB connection, a file handle, a lock, a network socket — is dangerous to manage manually, because an exception between acquiring and releasing the resource skips the cleanup:

```python
conn = DatabaseConnection.connect()
conn.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
conn.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
conn.close()  # never reached if either execute() raises an exception!
```

If the first `execute()` raises, `conn.close()` is never called — the connection (and, in a real DB, potentially a held lock or an open transaction) leaks. The traditional fix is `try/finally`:

```python
conn = DatabaseConnection.connect()
try:
    conn.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
    conn.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
finally:
    conn.close()  # guaranteed to run, even if an exception occurs above
```

This works, but it's verbose, easy to forget, and doesn't compose well when acquiring multiple resources. Python's **context manager protocol** (`with` statement) makes this pattern automatic and mandatory-by-construction.

---

## 2. The `with` Statement and the Context Manager Protocol

A context manager is any object implementing two special methods:

- `__enter__(self)` — called when entering the `with` block; its return value is bound to the `as` variable.
- `__exit__(self, exc_type, exc_value, traceback)` — called when leaving the block, **whether it exited normally or via an exception**.

```python
with acquire_resource() as resource:
    do_something(resource)
# __exit__ is guaranteed to run here, exception or not
```

This is equivalent to (but safer and shorter than) the `try/finally` version above — the interpreter guarantees `__exit__` runs unconditionally once `__enter__` has succeeded.

---

## 3. Writing a Class-Based Context Manager

```python
class DatabaseConnection:
    """A toy DB connection that must be explicitly opened and closed."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.is_open = False

    def __enter__(self) -> "DatabaseConnection":
        print(f"Opening connection to {self.dsn}")
        self.is_open = True
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        print(f"Closing connection to {self.dsn}")
        self.is_open = False
        if exc_type is not None:
            print(f"An error occurred: {exc_value}")
        return False  # False = don't suppress the exception; let it propagate

    def execute(self, query: str) -> None:
        if not self.is_open:
            raise RuntimeError("Connection is not open")
        print(f"Executing: {query}")


with DatabaseConnection("postgres://localhost/mydb") as conn:
    conn.execute("SELECT * FROM users")
    conn.execute("UPDATE users SET active = true")
# Output:
# Opening connection to postgres://localhost/mydb
# Executing: SELECT * FROM users
# Executing: UPDATE users SET active = true
# Closing connection to postgres://localhost/mydb


# Even when an exception is raised mid-block, __exit__ still runs:
try:
    with DatabaseConnection("postgres://localhost/mydb") as conn:
        conn.execute("SELECT * FROM users")
        raise ValueError("simulated failure")
except ValueError:
    print("Caught the propagated exception outside the with block")
# Output:
# Opening connection to postgres://localhost/mydb
# Executing: SELECT * FROM users
# An error occurred: simulated failure
# Closing connection to postgres://localhost/mydb
# Caught the propagated exception outside the with block
```

The return value of `__exit__` matters: returning `False` (or `None`) lets any exception propagate normally after cleanup runs; returning `True` would **suppress** the exception entirely — almost always the wrong choice unless you're deliberately implementing exception-swallowing behavior (e.g., a "best-effort cleanup" context manager).

---

## 4. contextlib.contextmanager — the Function-Based Shortcut

For simpler cases, writing a full class with `__enter__`/`__exit__` is more ceremony than needed. `@contextlib.contextmanager` lets you write a context manager as a single generator function: code before `yield` is `__enter__`, code after `yield` is `__exit__`.

```python
from contextlib import contextmanager
from typing import Iterator


@contextmanager
def database_connection(dsn: str) -> Iterator["DatabaseConnection"]:
    conn = DatabaseConnection(dsn)
    conn.is_open = True
    print(f"Opening connection to {dsn}")
    try:
        yield conn                     # this is what `as conn` receives
    finally:
        print(f"Closing connection to {dsn}")
        conn.is_open = False           # always runs, exception or not


with database_connection("postgres://localhost/mydb") as conn:
    conn.execute("SELECT * FROM orders")
# Opening connection to postgres://localhost/mydb
# Executing: SELECT * FROM orders
# Closing connection to postgres://localhost/mydb
```

The `try/finally` inside the generator is what guarantees cleanup — `yield` is where control passes to the `with` block's body, and `finally` runs when that body finishes or raises.

---

## 5. Real LLD Use Case: A File-Based Lock

A recurring LLD interview scenario — e.g., "design a distributed job scheduler" or "prevent two processes from modifying the same resource concurrently" — needs a lock that is *always* released, even if the protected code raises. A context manager is the natural fit:

```python
import os
import time
from contextlib import contextmanager
from typing import Iterator


class LockAcquisitionError(Exception):
    pass


class FileLock:
    """A simple file-based mutual-exclusion lock for a shared resource."""

    def __init__(self, lock_path: str, timeout_seconds: float = 5.0) -> None:
        self.lock_path = lock_path
        self.timeout_seconds = timeout_seconds

    def __enter__(self) -> "FileLock":
        start = time.monotonic()
        while True:
            try:
                # O_CREAT|O_EXCL: fails atomically if the file already exists
                fd = os.open(self.lock_path, os.O_CREAT | os.O_EXCL)
                os.close(fd)
                return self
            except FileExistsError:
                if time.monotonic() - start > self.timeout_seconds:
                    raise LockAcquisitionError(
                        f"Could not acquire lock at {self.lock_path} "
                        f"within {self.timeout_seconds}s"
                    )
                time.sleep(0.1)

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        if os.path.exists(self.lock_path):
            os.remove(self.lock_path)
        return False  # never suppress exceptions from the protected block


def update_shared_inventory_count(item_id: str, delta: int) -> None:
    with FileLock(f"/tmp/inventory_{item_id}.lock"):
        # Only one process/thread can be inside this block at a time
        # for a given item_id, because the lock file acts as a mutex.
        print(f"Updating inventory for {item_id} by {delta}")
        if delta < -1000:
            raise ValueError("Delta too large — refusing update")
    # Lock file is guaranteed removed here, whether the block succeeded or raised


update_shared_inventory_count("SKU-1", 5)

try:
    update_shared_inventory_count("SKU-2", -5000)
except ValueError as e:
    print(f"Update failed but lock was still released: {e}")
```

Even though `update_shared_inventory_count("SKU-2", -5000)` raises inside the `with` block, `__exit__` still runs and the lock file is removed — a subsequent call for the same `item_id` will not deadlock waiting for a lock that a crashed process never released.

---

## 6. Why This Matters for LLD Interviews

- **Guarantees cleanup under failure — a correctness property, not a style preference.** Interviewers designing systems with shared/limited resources (connection pools in Phase 08-style transactional systems, seat/inventory locks in Phase 09-style booking systems) will specifically probe "what happens if an exception occurs mid-transaction?" — a context manager is the concrete, demonstrable answer.
- **More idiomatic than `try/finally` scattered everywhere.** Encapsulating acquire/release logic inside `__enter__`/`__exit__` (or a `@contextmanager` generator) means callers can't forget to release the resource — the resource-management code lives in one place instead of being duplicated at every call site.
- **Connects to RAII-style thinking** (Resource Acquisition Is Initialization, a concept from C++) that many interviewers use as a mental model — Python's context managers are the language's idiomatic equivalent, and being able to draw that comparison signals broader engineering awareness.
- **Composable with other patterns:** a connection-pool `__enter__` can hand out a pooled connection and `__exit__` can return it to the pool rather than closing it — a natural pairing with the Object Pool idea and Singleton-managed pools from Phase 04.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a class-based context manager `Transaction` that prints "BEGIN", "COMMIT" on success, and "ROLLBACK" if an exception occurs inside the block (hint: check `exc_type` in `__exit__`).

**Exercise 2:** Rewrite `Transaction` from Exercise 1 using `@contextlib.contextmanager` and a `try/except/else` inside the generator function instead of a class.

**Exercise 3:** Extend the `FileLock` example so that `__enter__` returns `self` and add a `locked_by: str` attribute set to a caller-supplied owner name, printed in a log line on both acquire and release.

**Exercise 4:** Explain (in a short comment) what would go wrong if `FileLock.__exit__` returned `True` instead of `False`, using the `update_shared_inventory_count("SKU-2", -5000)` example.

---

## 8. Interview Q&A

**Q: What two methods must an object implement to be usable in a `with` statement, and what does each do?**
Answer: `__enter__(self)` is called when the `with` block is entered; its return value is bound to the `as` variable. `__exit__(self, exc_type, exc_value, traceback)` is called when the block is exited, whether normally or via an exception — its job is to release/clean up the resource. Python guarantees `__exit__` runs once `__enter__` has succeeded, regardless of how the block exits.

**Q: What does the return value of `__exit__` control?**
Answer: If `__exit__` returns a falsy value (`False` or `None`), any exception raised inside the `with` block propagates normally after `__exit__` finishes running. If it returns a truthy value (`True`), the exception is suppressed entirely — the `with` statement exits as if nothing happened. Suppressing exceptions is rarely correct and should be an explicit, deliberate design choice, not an accident.

**Q: What is `contextlib.contextmanager` and how does it relate to `__enter__`/`__exit__`?**
Answer: It's a decorator that turns a generator function into a context manager without writing a full class. Code before the `yield` acts as `__enter__` (it runs on entering the `with` block), the yielded value becomes the `as` variable, and code after the `yield` (typically inside a `finally`) acts as `__exit__`, running when the block exits — a `try/finally` around the `yield` is what guarantees cleanup runs even if the block raises.

**Q: Why is a context manager better than a plain `try/finally` scattered at each call site?**
Answer: `try/finally` works correctly, but the acquire/release logic must be manually written (and correctly remembered) at every call site. A context manager encapsulates that logic once, inside `__enter__`/`__exit__` (or a `@contextmanager` function) — callers just write `with resource() as r:` and cannot forget the cleanup step, because it's structurally guaranteed by the protocol rather than relying on every caller remembering a `finally` block.

**Q: Give a concrete LLD scenario where a custom context manager is the right tool.**
Answer: Any scenario with a resource that must be released deterministically even under failure — a database transaction that must roll back on error and commit on success, a distributed/file-based lock protecting a shared resource like inventory count or a parking spot, or handing out and returning a connection from a connection pool. In each case, wrapping acquire/use/release in `__enter__`/`__exit__` guarantees the release step runs regardless of exceptions in the "use" phase.

**Q: Can a context manager's `__enter__` fail, and what happens to `__exit__` if it does?**
Answer: Yes — if `__enter__` raises an exception, `__exit__` is never called, because the resource was never successfully acquired to begin with (there is nothing to clean up). This is why acquisition logic that might partially succeed should be careful to clean up after itself before raising from `__enter__`, since `__exit__` won't run as a safety net in that case.
