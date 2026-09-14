# Single Responsibility Principle (SRP) — Complete Guide

## Table of Contents
1. [What is SRP?](#1-what-is-srp)
2. [The Bad Example — UserService Doing Everything](#2-the-bad-example--userservice-doing-everything)
3. [The Good Example — Splitting Responsibilities](#3-the-good-example--splitting-responsibilities)
4. [Why This Matters in Practice](#4-why-this-matters-in-practice)
5. [Common Misconceptions](#5-common-misconceptions)
6. [Interview-Style Exercise](#6-interview-style-exercise)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is SRP?

> **A class should have only one reason to change.**

"Responsibility" here means "a reason to change," not "a single method." A class can have several methods and still satisfy SRP, as long as all of them serve one cohesive purpose and change for the same reason.

```
┌─────────────────────────────────────────────────────────┐
│  SRP in one picture                                      │
│                                                           │
│  One Class  ──────►  One Actor / One Reason to Change    │
│                                                           │
│  UserService should change only if "how we manage        │
│  user accounts" changes — NOT because the email          │
│  provider changed, or the DB schema changed, or the      │
│  validation rules changed for an unrelated reason.       │
└─────────────────────────────────────────────────────────┘
```

A simple test: **"If I describe what this class does, do I need to use the word 'and'?"** If yes ("it validates the user **and** saves it to the DB **and** sends a welcome email"), it likely violates SRP.

---

## 2. The Bad Example — UserService Doing Everything

```python
import re
import smtplib
import sqlite3


class UserService:
    """
    Smell: this class validates input, talks to the database,
    AND sends emails. Three unrelated actors depend on this
    one class: the product team (validation rules), the DBA
    team (schema/connection details), and the infra team
    (email/SMTP configuration). A change to any of them
    forces a change to UserService.
    """

    def __init__(self, db_path: str, smtp_host: str, smtp_port: int):
        self.db_path = db_path
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port

    def register_user(self, name: str, email: str, password: str) -> None:
        # Responsibility 1: validation
        if not name:
            raise ValueError("Name is required")
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            raise ValueError("Invalid email")
        if len(password) < 8:
            raise ValueError("Password too short")

        # Responsibility 2: persistence
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, password),
        )
        conn.commit()
        conn.close()

        # Responsibility 3: notification
        message = f"Subject: Welcome!\n\nHi {name}, thanks for signing up."
        server = smtplib.SMTP(self.smtp_host, self.smtp_port)
        server.sendmail("noreply@app.com", email, message)
        server.quit()
```

### What Breaks / Why It's a Smell

| Problem | Consequence |
|---------|-------------|
| Three reasons to change bundled into one class | Editing email logic risks breaking registration logic (regression risk) |
| Impossible to unit-test validation without a real DB and a real SMTP server | Slow, brittle tests; people stop writing them |
| Can't reuse validation or persistence elsewhere without dragging in email code | Copy-pasted logic across the codebase |
| Swapping SQLite for Postgres, or SMTP for SendGrid's API, means editing this class | High blast radius for unrelated infra changes |
| Multiple teams (product/DBA/infra) all need to review changes to the same file | Merge conflicts, unclear code ownership |

---

## 3. The Good Example — Splitting Responsibilities

Each class now owns exactly one reason to change: validation rules, persistence mechanics, or the notification channel.

```python
import re
import smtplib
import sqlite3
from dataclasses import dataclass


@dataclass
class User:
    name: str
    email: str
    password: str


class UserValidator:
    """Reason to change: business rules for what makes a valid user."""

    def validate(self, user: User) -> None:
        if not user.name:
            raise ValueError("Name is required")
        if not re.match(r"[^@]+@[^@]+\.[^@]+", user.email):
            raise ValueError("Invalid email")
        if len(user.password) < 8:
            raise ValueError("Password too short")


class UserRepository:
    """Reason to change: how/where users are persisted (schema, DB engine)."""

    def __init__(self, db_path: str):
        self.db_path = db_path

    def save(self, user: User) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (user.name, user.email, user.password),
        )
        conn.commit()
        conn.close()


class WelcomeEmailNotifier:
    """Reason to change: how/where notifications are delivered (SMTP, provider)."""

    def __init__(self, smtp_host: str, smtp_port: int):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port

    def send(self, user: User) -> None:
        message = f"Subject: Welcome!\n\nHi {user.name}, thanks for signing up."
        server = smtplib.SMTP(self.smtp_host, self.smtp_port)
        server.sendmail("noreply@app.com", user.email, message)
        server.quit()


class UserService:
    """
    Reason to change: the registration workflow itself
    (e.g., "also log an audit event" is a workflow change).
    It orchestrates collaborators but doesn't implement their logic.
    """

    def __init__(
        self,
        validator: UserValidator,
        repository: UserRepository,
        notifier: WelcomeEmailNotifier,
    ):
        self.validator = validator
        self.repository = repository
        self.notifier = notifier

    def register_user(self, name: str, email: str, password: str) -> User:
        user = User(name=name, email=email, password=password)
        self.validator.validate(user)
        self.repository.save(user)
        self.notifier.send(user)
        return user


# Usage
service = UserService(
    validator=UserValidator(),
    repository=UserRepository("app.db"),
    notifier=WelcomeEmailNotifier("smtp.mailtrap.io", 587),
)
service.register_user("Asha", "asha@example.com", "supersecret")
```

### Why This Is Better

- `UserValidator` can be unit-tested with plain Python objects — no DB, no network.
- Swapping SQLite for Postgres only touches `UserRepository`.
- Swapping SMTP for a transactional email API only touches `WelcomeEmailNotifier`.
- `UserService` reads like a checklist of the workflow — easy to review, easy to extend (e.g., add an `AuditLogger` collaborator without touching validation or persistence).

---

## 4. Why This Matters in Practice

```
Bad design: one change ripples everywhere
┌───────────┐
│UserService│◄── product team edits validation
│  (God     │◄── DBA changes schema
│  Object)  │◄── infra swaps email provider
└───────────┘
   All three teams touch the SAME file → merge conflicts, regressions

Good design: changes are isolated
UserValidator  ◄── product team only
UserRepository ◄── DBA team only
Notifier       ◄── infra team only
UserService    ◄── stays untouched unless the WORKFLOW changes
```

SRP is also what makes classes reusable. `UserValidator` can validate a user during registration, during a profile-update flow, or in a batch-import script — because it doesn't know or care about databases or emails.

---

## 5. Common Misconceptions

- **"SRP means one method per class."** No — a class can have many methods, as long as they all serve the same responsibility (e.g., `UserRepository` can have `save`, `find_by_id`, `delete` — all persistence).
- **"Splitting classes always adds unnecessary complexity."** Over-splitting (a class per single line of logic) is a real anti-pattern too. The goal is cohesion around a single *reason to change*, not a class-count minimum.
- **"SRP is only about class size."** A small class can still violate SRP (e.g., a 10-line class that both parses JSON and writes to a network socket), and a large class can honor it (e.g., a repository with 15 well-related CRUD methods).

---

## 6. Interview-Style Exercise

**Prompt:** "Here's an `OrderProcessor` class. Refactor it to follow SRP."

```python
class OrderProcessor:
    def process(self, order: dict) -> None:
        # calculate total
        total = sum(item["price"] * item["qty"] for item in order["items"])
        if order.get("coupon") == "SAVE10":
            total *= 0.9

        # charge payment
        print(f"Charging ${total:.2f} via credit card ending {order['card'][-4:]}")

        # write invoice to disk
        with open(f"invoice_{order['id']}.txt", "w") as f:
            f.write(f"Invoice for order {order['id']}: ${total:.2f}\n")

        # notify customer
        print(f"Emailing {order['email']}: your order total is ${total:.2f}")
```

**What's wrong:** one class computes pricing, charges payment, writes files, and sends emails — four unrelated reasons to change.

**Refactored Answer:**

```python
from dataclasses import dataclass


@dataclass
class Order:
    id: str
    items: list
    card: str
    email: str
    coupon: str = ""


class PriceCalculator:
    def calculate_total(self, order: Order) -> float:
        total = sum(item["price"] * item["qty"] for item in order.items)
        if order.coupon == "SAVE10":
            total *= 0.9
        return total


class PaymentGateway:
    def charge(self, order: Order, amount: float) -> None:
        print(f"Charging ${amount:.2f} via credit card ending {order.card[-4:]}")


class InvoiceWriter:
    def write(self, order: Order, amount: float) -> None:
        with open(f"invoice_{order.id}.txt", "w") as f:
            f.write(f"Invoice for order {order.id}: ${amount:.2f}\n")


class OrderNotifier:
    def notify(self, order: Order, amount: float) -> None:
        print(f"Emailing {order.email}: your order total is ${amount:.2f}")


class OrderProcessor:
    """Orchestrates the workflow; each step is delegated."""

    def __init__(
        self,
        calculator: PriceCalculator,
        gateway: PaymentGateway,
        invoice_writer: InvoiceWriter,
        notifier: OrderNotifier,
    ):
        self.calculator = calculator
        self.gateway = gateway
        self.invoice_writer = invoice_writer
        self.notifier = notifier

    def process(self, order: Order) -> None:
        total = self.calculator.calculate_total(order)
        self.gateway.charge(order, total)
        self.invoice_writer.write(order, total)
        self.notifier.notify(order, total)
```

Talking points to say out loud in an interview: name each extracted responsibility, explain that `OrderProcessor` now only orchestrates (its one reason to change is "the steps of the workflow change"), and mention that each piece is now independently testable and swappable (e.g., `InvoiceWriter` could later write to S3 instead of local disk with zero impact on the others).

---

## 7. Interview Q&A

**Q: What is the Single Responsibility Principle?**
Answer: SRP states that a class should have only one reason to change — it should be responsible to a single actor or concern. This doesn't mean "one method," it means all the behavior in the class should be cohesive and change for the same underlying reason. If a class serves multiple unrelated concerns (e.g., validation, persistence, and notification), a change to any one of them forces a risky edit to a class that other concerns also depend on.

**Q: How do you identify an SRP violation in a code review?**
Answer: Look for classes whose description needs the word "and" (e.g., "validates the order and charges payment and writes a file"). Other signals: the class imports unrelated libraries for unrelated jobs (e.g., both `smtplib` and `sqlite3`), it has low cohesion between its methods, and multiple unrelated teams need to review changes to it. If you can list two or more distinct reasons a class might need to change, it likely violates SRP.

**Q: Doesn't splitting a class into five smaller classes hurt readability?**
Answer: It can if taken to an extreme (a class per single expression), but generally it improves readability by making each piece's purpose obvious from its name and letting you reason about one concern at a time. The orchestrating class (like `UserService`) becomes a readable, high-level summary of the workflow, while the details live in focused, independently testable collaborators.

**Q: How does SRP relate to testability?**
Answer: Directly — a class with a single, focused responsibility can be unit-tested in isolation with fake/mock collaborators and no real infrastructure. A class that mixes concerns (like validation with a live SMTP connection) forces integration-style tests even for simple logic checks, making the test suite slow and brittle.

**Q: Is a class with 10 methods automatically violating SRP?**
Answer: Not necessarily. What matters is cohesion, not method count. A `UserRepository` with `save`, `find_by_id`, `find_by_email`, `delete`, and `update` all serve one responsibility — persistence of users — and change for one reason (how users are stored/queried). Method count is a weak proxy; the real test is "how many distinct actors or reasons for change does this class serve?"

**Q: How does SRP set up the other SOLID principles?**
Answer: Once responsibilities are separated into focused classes, it becomes natural to extend behavior by adding new classes rather than editing existing ones (Open-Closed Principle), to depend on small, focused interfaces per responsibility (Interface Segregation), and to inject those focused collaborators as abstractions (Dependency Inversion). SRP is the foundation the other four principles build on.
