# Chain of Responsibility Pattern — Complete Guide

## Table of Contents
1. [The Problem Chain of Responsibility Solves](#1-the-problem-chain-of-responsibility-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Chain of Responsibility Solves

An expense approval system needs different approval authority based on amount: a `Manager` can approve up to $1,000, a `Director` up to $10,000, a `VP` anything above that. A naive implementation puts all the threshold logic in one function, which grows every time a new approval tier or rule (e.g. "expenses over $50,000 need CFO + VP") is added.

```
Without Chain of Responsibility:
  def approve(amount):
      if amount <= 1000:
          return "Approved by Manager"
      elif amount <= 10000:
          return "Approved by Director"
      elif amount <= 100000:
          return "Approved by VP"
      else:
          raise Exception("No one can approve this")
  # adding/reordering approval tiers means editing this one function every time
  # can't dynamically reconfigure who is "next" in the chain at runtime
```

**Chain of Responsibility Pattern**: pass a request along a chain of handler objects; each handler decides either to process the request or pass it to the next handler in the chain — the sender doesn't need to know which handler will ultimately deal with it.

---

## 2. The Bad Example

```python
class ExpenseApprover:
    def approve(self, amount: float) -> str:
        if amount <= 1000:
            return "Approved by Manager"
        elif amount <= 10000:
            return "Approved by Director"
        elif amount <= 100000:
            return "Approved by VP"
        else:
            raise ValueError("No one in the org can approve this expense")
```

Problems:
- All approval rules live in a single function/class — violates Single Responsibility and Open/Closed.
- Can't insert a new approval tier (e.g. "Team Lead" for under $200) without editing this function and re-testing every branch.
- Can't reorder or reconfigure the chain per department at runtime.

---

## 3. The Good Example

```
┌─────────┐   next   ┌───────────┐   next   ┌────────┐   next   ┌──────┐
│ Manager │ ───────▶ │ Director  │ ───────▶ │  VP     │ ───────▶ │ None │
│ (<=1000)│          │ (<=10000) │          │(<=100000)│         │      │
└─────────┘          └───────────┘          └────────┘          └──────┘
     ▲
     │ request enters here; each handler either
     │ handles it or forwards to `next`
```

Every handler implements the same interface (`set_next()`, `handle()`). The client only submits a request to the *first* handler and doesn't care which one ultimately processes it.

---

## 4. Real-World Tie-In

This is exactly how web framework middleware chains work (auth middleware → logging middleware → rate-limit middleware → your view function, each deciding to pass the request onward or short-circuit it), and how exception handling bubbles up through nested `try/except` scopes looking for a handler.

---

## 5. Complete Runnable Code

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class ExpenseHandler(ABC):
    """Base handler: holds a reference to the next handler in the chain."""

    def __init__(self) -> None:
        self._next: "ExpenseHandler | None" = None

    def set_next(self, handler: "ExpenseHandler") -> "ExpenseHandler":
        self._next = handler
        return handler  # allows fluent chaining: a.set_next(b).set_next(c)

    def handle(self, amount: float) -> str:
        if self.can_approve(amount):
            return self._approve(amount)
        if self._next is not None:
            return self._next.handle(amount)
        raise ValueError(f"No approver in the chain can approve ${amount:.2f}")

    @abstractmethod
    def can_approve(self, amount: float) -> bool:
        raise NotImplementedError

    @abstractmethod
    def _approve(self, amount: float) -> str:
        raise NotImplementedError


class Manager(ExpenseHandler):
    LIMIT = 1_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def _approve(self, amount: float) -> str:
        return f"Manager approved ${amount:.2f}"


class Director(ExpenseHandler):
    LIMIT = 10_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def _approve(self, amount: float) -> str:
        return f"Director approved ${amount:.2f}"


class VP(ExpenseHandler):
    LIMIT = 100_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def _approve(self, amount: float) -> str:
        return f"VP approved ${amount:.2f}"


if __name__ == "__main__":
    manager, director, vp = Manager(), Director(), VP()
    manager.set_next(director).set_next(vp)

    for amount in [500, 5_000, 75_000, 500_000]:
        try:
            print(manager.handle(amount))
        except ValueError as e:
            print(f"Rejected: {e}")
```

Expected output:
```
Manager approved $500.00
Director approved $5000.00
VP approved $75000.00
Rejected: No approver in the chain can approve $500000.00
```

---

## 6. When to Use / Trade-offs

**Use Chain of Responsibility when:**
- More than one object may handle a request, and the handler isn't known in advance (approval workflows, middleware/interceptor pipelines, event bubbling in UIs, logging with multiple severity-based handlers).
- You want to add, remove, or reorder handlers without touching the client or other handlers (open for extension).
- You want to decouple sender from receiver — the sender just fires the request into the chain.

**Trade-offs:**
- No guarantee a request is handled at all — if every handler declines and there's no fallback, the request silently falls off the end of the chain (mitigate with a final catch-all handler, or raise as shown above).
- Debugging can be harder — tracing which handler actually processed a request means stepping through the whole chain.
- Long chains add per-request overhead (each handler does at least one check) — usually negligible, but worth mentioning for very hot paths.

| Aspect | Without Chain of Responsibility | With Chain of Responsibility |
|--------|-------------------|----------------|
| Adding a new approval tier | Edit the single approval function | Create a new handler class, splice it into the chain |
| Reordering rules | Edit `if/elif` order | Re-wire `set_next()` calls |
| Sender coupling | Sender must know all rules | Sender only knows the first handler |

---

## 7. Interview Q&A

**Q: What problem does Chain of Responsibility solve?**
Answer: It decouples the sender of a request from the object(s) that might handle it by passing the request along a chain of handler objects. Each handler decides independently whether it can process the request; if not, it forwards it to the next handler. This lets you add, remove, or reorder handlers without changing the sender or other handlers, avoiding a single monolithic conditional.

**Q: How is Chain of Responsibility different from Command?**
Answer: Command encapsulates *a single request* as an object so it can be queued/logged/undone, with one designated receiver known at creation time. Chain of Responsibility is about *routing* a request through a sequence of potential handlers, where the specific handler that ultimately processes it is not known in advance — it emerges from the chain's traversal. They can be combined (e.g. each link in the chain could itself be a `Command`), but they solve different problems: Command = "package a request"; Chain of Responsibility = "find who should handle this request."

**Q: What happens if no handler in the chain can process the request? How do you guard against silent failures?**
Answer: By default, if the chain has no fallback, the request falls off the end and is either silently dropped or (as in the example above) explicitly raises an error. The fix is to always terminate the chain with a catch-all/default handler that either raises a clear error or applies a safe default (e.g. a `DefaultHandler` that logs "no rule matched" and escalates to a human), rather than letting requests disappear silently.

**Q: Implement Chain of Responsibility from scratch for a logging system where DEBUG/INFO go to console, WARNING/ERROR also go to a file, and CRITICAL also pages an on-call engineer.**
Answer:
```python
from abc import ABC, abstractmethod
from enum import IntEnum


class Level(IntEnum):
    DEBUG = 1
    INFO = 2
    WARNING = 3
    ERROR = 4
    CRITICAL = 5


class Logger(ABC):
    def __init__(self, level: Level) -> None:
        self.level = level
        self._next: "Logger | None" = None

    def set_next(self, nxt: "Logger") -> "Logger":
        self._next = nxt
        return nxt

    def log(self, level: Level, message: str) -> None:
        if level >= self.level:
            self._write(level, message)
        if self._next:
            self._next.log(level, message)

    @abstractmethod
    def _write(self, level: Level, message: str) -> None: ...


class ConsoleLogger(Logger):
    def _write(self, level: Level, message: str) -> None:
        print(f"[Console:{level.name}] {message}")


class FileLogger(Logger):
    def _write(self, level: Level, message: str) -> None:
        print(f"[File:{level.name}] writing '{message}' to log file")


class PagerLogger(Logger):
    def _write(self, level: Level, message: str) -> None:
        print(f"[Pager:{level.name}] paging on-call engineer: {message}")


console = ConsoleLogger(Level.DEBUG)
file_log = FileLogger(Level.WARNING)
pager = PagerLogger(Level.CRITICAL)
console.set_next(file_log).set_next(pager)

console.log(Level.INFO, "user signed in")
console.log(Level.CRITICAL, "database connection pool exhausted")
```
Note this variant lets *every* qualifying handler process the message (rather than stopping at the first match) — Chain of Responsibility supports both "first handler wins" (as in the expense example) and "every qualifying handler runs" styles; pick whichever the domain needs.

**Q: How does middleware in web frameworks (Django, Express, Flask) relate to this pattern?**
Answer: Middleware pipelines are Chain of Responsibility in practice: each middleware receives the request, does its work (auth check, logging, rate limiting), and either short-circuits the chain (e.g. returns a 401 if unauthenticated) or calls `next()`/passes the request to the next middleware, ultimately reaching the view/handler. The framework's request dispatcher builds and holds this chain; individual middlewares don't know about each other, only about "call the next one."

**Q: Can Chain of Responsibility handlers be composed at runtime instead of hardcoded?**
Answer: Yes — that's one of its main benefits over an `if/elif` ladder. Since handlers are wired with `set_next()` calls (or built from a list via a small loop), the chain's composition, order, and membership can be driven by configuration (e.g. reading approval-tier definitions from a database per department) rather than being fixed in source code.
