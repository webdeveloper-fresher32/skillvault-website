# Dependency Inversion Principle (DIP) — Complete Guide

## Table of Contents
1. [What is DIP?](#1-what-is-dip)
2. [The Bad Example — NotificationService Bound to Concrete Classes](#2-the-bad-example--notificationservice-bound-to-concrete-classes)
3. [The Good Example — Depending on Abstractions](#3-the-good-example--depending-on-abstractions)
4. [DIP vs Dependency Injection — Not the Same Thing](#4-dip-vs-dependency-injection--not-the-same-thing)
5. [Why This Matters in Practice](#5-why-this-matters-in-practice)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Interview-Style Exercise](#7-interview-style-exercise)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is DIP?

> **High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details; details should depend on abstractions.**

In plain terms: your business logic (high-level policy, e.g., "send a welcome notification") shouldn't directly reference concrete infrastructure classes (low-level detail, e.g., a specific `EmailClient`). Instead, both should depend on an interface (e.g., `NotificationChannel`), and the concrete implementation is *injected* from outside.

```
┌───────────────────────────────────────────────────────────┐
│  DIP in one picture                                          │
│                                                                │
│  Without DIP:                                                 │
│    NotificationService ──depends on──▶ EmailClient (concrete) │
│    (high-level)                        (low-level)            │
│    Direction of dependency: high-level → low-level (BAD)      │
│                                                                │
│  With DIP:                                                    │
│    NotificationService ──depends on──▶ NotificationChannel    │
│    (high-level)                        (abstraction)          │
│                                              ▲                │
│                                       EmailClient (low-level)  │
│    Both point at the abstraction. The dependency is           │
│    "inverted" relative to the naive version above.            │
└───────────────────────────────────────────────────────────┘
```

Note the name: it's called *inversion* because naive design has high-level code depending on low-level details; DIP inverts that so both depend on a shared abstraction owned conceptually by the high-level policy.

---

## 2. The Bad Example — NotificationService Bound to Concrete Classes

```python
class EmailClient:
    def send_email(self, to: str, body: str) -> None:
        print(f"[Email] to {to}: {body}")


class SmsClient:
    def send_sms(self, to: str, body: str) -> None:
        print(f"[SMS] to {to}: {body}")


class NotificationService:
    """
    Smell: this high-level policy class directly instantiates and
    calls concrete low-level classes. It KNOWS about EmailClient's
    and SmsClient's specific method names (send_email vs send_sms —
    not even a consistent interface). Adding a new channel means
    editing this class. Testing requires real EmailClient/SmsClient
    instances (or patching internals) since they're hardcoded.
    """

    def __init__(self):
        self.email_client = EmailClient()
        self.sms_client = SmsClient()

    def notify(self, user_contact: str, message: str, channel: str) -> None:
        if channel == "email":
            self.email_client.send_email(user_contact, message)
        elif channel == "sms":
            self.sms_client.send_sms(user_contact, message)
        else:
            raise ValueError(f"Unsupported channel: {channel}")


service = NotificationService()
service.notify("asha@example.com", "Your order shipped!", "email")
```

### What Breaks / Why It's a Smell

| Problem | Consequence |
|---------|-------------|
| `NotificationService` directly constructs `EmailClient()`/`SmsClient()` | Can't substitute a fake/mock in unit tests without monkeypatching internals |
| Adding push notifications means editing `NotificationService` | Also an OCP violation — the two principles often co-occur |
| `NotificationService` must know each client's specific method name | Tight coupling — any rename in `EmailClient` breaks the high-level class |
| The high-level policy ("how do we notify users") is entangled with low-level detail ("how does SMTP work") | Business logic can't be reasoned about or tested independently of infrastructure |

---

## 3. The Good Example — Depending on Abstractions

```python
from abc import ABC, abstractmethod
from typing import Dict


class NotificationChannel(ABC):
    """
    The abstraction both the high-level policy and the low-level
    details depend on. Owned conceptually by the high-level module —
    it describes what NotificationService NEEDS, not how any
    particular channel works internally.
    """

    @abstractmethod
    def send(self, to: str, message: str) -> None:
        raise NotImplementedError


class EmailChannel(NotificationChannel):
    """Low-level detail #1 — depends on (implements) the abstraction."""

    def send(self, to: str, message: str) -> None:
        print(f"[Email] to {to}: {message}")


class SmsChannel(NotificationChannel):
    """Low-level detail #2 — depends on (implements) the abstraction."""

    def send(self, to: str, message: str) -> None:
        print(f"[SMS] to {to}: {message}")


class PushChannel(NotificationChannel):
    """New channel: added later with zero edits to NotificationService."""

    def send(self, to: str, message: str) -> None:
        print(f"[Push] to {to}: {message}")


class NotificationService:
    """
    High-level policy. Depends only on the NotificationChannel
    abstraction — has no idea EmailChannel or SmsChannel even exist.
    Channels are injected (constructor injection), not constructed
    internally.
    """

    def __init__(self, channels: Dict[str, NotificationChannel]):
        self.channels = channels

    def notify(self, user_contact: str, message: str, channel_name: str) -> None:
        channel = self.channels.get(channel_name)
        if channel is None:
            raise ValueError(f"Unsupported channel: {channel_name}")
        channel.send(user_contact, message)


# Composition happens OUTSIDE the high-level class (e.g., in main() or a DI container)
service = NotificationService({
    "email": EmailChannel(),
    "sms": SmsChannel(),
    "push": PushChannel(),
})
service.notify("asha@example.com", "Your order shipped!", "email")
service.notify("+61-400-000-000", "Your order shipped!", "sms")


# Testing is now trivial — inject a fake channel, no real infra needed:
class FakeChannel(NotificationChannel):
    def __init__(self):
        self.sent = []

    def send(self, to: str, message: str) -> None:
        self.sent.append((to, message))


def test_notify_calls_correct_channel():
    fake = FakeChannel()
    test_service = NotificationService({"email": fake})
    test_service.notify("test@example.com", "hello", "email")
    assert fake.sent == [("test@example.com", "hello")]


test_notify_calls_correct_channel()
print("Test passed!")
```

### Why This Is Better

- `NotificationService` never imports or references `EmailChannel`/`SmsChannel` — it only knows about `NotificationChannel`.
- New channels (push, Slack, WhatsApp) are added as new classes; `NotificationService` is never touched (this is DIP enabling OCP).
- Unit testing `NotificationService`'s dispatch logic requires zero real infrastructure — inject `FakeChannel` and assert on what it recorded.

---

## 4. DIP vs Dependency Injection — Not the Same Thing

These terms are often confused in interviews — be precise:

| Concept | What it is |
|---------|-----------|
| **Dependency Inversion Principle (DIP)** | A *design principle*: high-level and low-level modules should both depend on abstractions. |
| **Dependency Injection (DI)** | A *technique*: supplying a class's dependencies from the outside (constructor, setter, or a DI framework) rather than the class constructing them itself. |

DI is a common *mechanism* for achieving DIP (as shown above — channels are passed into `NotificationService.__init__` rather than constructed inside it), but you can do DI without DIP (inject a concrete `EmailClient` instead of an abstraction — still tightly coupled to that concrete type), and in small scripts you can arguably honor DIP-like thinking without a formal DI framework. In interviews, always name both terms and clarify this distinction — it signals real understanding, not just buzzword recall.

---

## 5. Why This Matters in Practice

```
Without DIP: dependency arrows point toward low-level detail
   NotificationService ──▶ EmailClient
                       ──▶ SmsClient
   (change SMTP library → risk breaking NotificationService)

With DIP: dependency arrows point toward the shared abstraction
   NotificationService ──▶ NotificationChannel  ◀── EmailChannel
                                                 ◀── SmsChannel
                                                 ◀── PushChannel
   (change SMTP library → only EmailChannel changes)
```

DIP is what makes large systems testable and swappable at the seams: swap a real `PaymentGateway` for a sandbox one in tests, swap a `SqlUserRepository` for an `InMemoryUserRepository` in local dev, swap `EmailChannel` for `SlackChannel` in production — all without touching the business logic that orchestrates them. This is also the theoretical foundation for Dependency Injection frameworks and IoC containers used in most professional backend frameworks.

---

## 6. Common Misconceptions

- **"DIP means using a DI framework/container."** No framework is required — DIP is achieved simply by depending on abstractions and injecting concrete implementations via constructor arguments, as shown above with plain Python.
- **"Abstractions must always be ABCs."** In Python, `typing.Protocol` (structural typing) can serve the same role without requiring explicit inheritance — either is valid; ABCs are used here for clarity and explicitness.
- **"Inverting dependencies means low-level code should now depend on high-level code."** Not quite — both high-level and low-level code depend on a *shared abstraction* that typically lives conceptually with the high-level module's needs. Low-level modules implement that abstraction; they don't depend on the high-level module directly.

---

## 7. Interview-Style Exercise

**Prompt:** "This `OrderService` is tightly coupled to a concrete `MySQLDatabase` and `StripePaymentGateway`. Refactor it to follow DIP."

```python
class MySQLDatabase:
    def save_order(self, order_id: str) -> None:
        print(f"Saving order {order_id} to MySQL")


class StripePaymentGateway:
    def charge(self, amount: float) -> None:
        print(f"Charging ${amount} via Stripe")


class OrderService:
    def __init__(self):
        self.db = MySQLDatabase()
        self.payment = StripePaymentGateway()

    def place_order(self, order_id: str, amount: float) -> None:
        self.payment.charge(amount)
        self.db.save_order(order_id)
```

**Refactored Answer:**

```python
from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: float) -> None:
        raise NotImplementedError


class OrderRepository(ABC):
    @abstractmethod
    def save_order(self, order_id: str) -> None:
        raise NotImplementedError


class StripePaymentGateway(PaymentGateway):
    def charge(self, amount: float) -> None:
        print(f"Charging ${amount} via Stripe")


class MySQLOrderRepository(OrderRepository):
    def save_order(self, order_id: str) -> None:
        print(f"Saving order {order_id} to MySQL")


class OrderService:
    """Depends only on abstractions — never on Stripe or MySQL directly."""

    def __init__(self, payment: PaymentGateway, repository: OrderRepository):
        self.payment = payment
        self.repository = repository

    def place_order(self, order_id: str, amount: float) -> None:
        self.payment.charge(amount)
        self.repository.save_order(order_id)


order_service = OrderService(
    payment=StripePaymentGateway(),
    repository=MySQLOrderRepository(),
)
order_service.place_order("ORD-123", 99.99)


# Swap to PayPal + Postgres later, or fakes in tests — OrderService never changes:
class PayPalPaymentGateway(PaymentGateway):
    def charge(self, amount: float) -> None:
        print(f"Charging ${amount} via PayPal")


order_service_v2 = OrderService(
    payment=PayPalPaymentGateway(),
    repository=MySQLOrderRepository(),
)
order_service_v2.place_order("ORD-124", 49.99)
```

Talking point: "`OrderService`'s constructor now takes abstractions, and the concrete choice of Stripe vs PayPal, MySQL vs Postgres, is decided by whoever composes the object graph — not by `OrderService` itself. That's the inversion: control over which concrete implementation is used moved from inside the high-level class to outside it."

---

## 8. Interview Q&A

**Q: What is the Dependency Inversion Principle?**
Answer: DIP states that high-level modules (business logic/policy) shouldn't depend directly on low-level modules (infrastructure/details) — both should depend on abstractions. Additionally, abstractions shouldn't depend on details; details should depend on abstractions. In practice this means a class like `NotificationService` should depend on a `NotificationChannel` interface, not concrete `EmailClient`/`SmsClient` classes, with the concrete implementation supplied from outside.

**Q: What is the difference between Dependency Inversion and Dependency Injection?**
Answer: DIP is a design principle about the *direction* dependencies should point (toward abstractions). Dependency Injection is a *technique* — passing a class's dependencies in from the outside (via constructor, setter, or a DI framework) instead of the class instantiating them itself. DI is commonly used to implement DIP, but they're distinct: you can inject a concrete class (DI without DIP), and DIP's spirit could theoretically be honored without a formal injection mechanism, though DI is by far the most practical way to apply it.

**Q: Why does depending on abstractions make testing easier?**
Answer: Because you can inject a lightweight fake or mock that implements the same abstraction instead of a real, possibly slow or side-effecting dependency (a real database, a real SMTP server, a real payment gateway). In the notification example, `FakeChannel` records what was "sent" in memory, letting the test assert on `NotificationService`'s dispatch logic without any network calls — this makes unit tests fast, deterministic, and isolated from infrastructure.

**Q: How does DIP relate to the Open-Closed Principle?**
Answer: They reinforce each other. OCP requires that new behavior can be added without modifying existing code, and that's only possible if the existing code depends on an abstraction rather than a fixed set of concrete classes. In the notification example, adding `PushChannel` doesn't require editing `NotificationService` precisely *because* `NotificationService` depends on the `NotificationChannel` abstraction (DIP) rather than a hardcoded list of concrete channel classes.

**Q: Do you always need an ABC to apply DIP in Python?**
Answer: No — Python also supports structural typing via `typing.Protocol`, which lets a class satisfy an abstraction just by implementing the right methods, with no explicit inheritance required. ABCs are often preferred in interviews for clarity (they make the contract explicit and enforce it via `@abstractmethod`), but `Protocol` is equally valid and common in idiomatic Python codebases, especially with static type checkers like mypy.

**Q: What's a red flag in code review that signals a DIP violation?**
Answer: A high-level/business-logic class directly instantiating a concrete infrastructure class inside its methods or `__init__` (e.g., `self.db = MySQLDatabase()` instead of receiving `db: DatabaseInterface` as a constructor parameter). Other signals: the class imports concrete libraries like `stripe`, `smtplib`, or `psycopg2` directly, and unit-testing the class requires spinning up real infrastructure or heavy mocking of internals rather than simply injecting a test double.
