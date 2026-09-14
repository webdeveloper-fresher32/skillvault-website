# Dependency Injection — Complete Guide

## Table of Contents
1. [The Problem: Hard-Coded Dependencies](#1-the-problem-hard-coded-dependencies)
2. [What Dependency Injection Actually Is](#2-what-dependency-injection-actually-is)
3. [Constructor Injection in Practice](#3-constructor-injection-in-practice)
4. [DI and Testability](#4-di-and-testability)
5. [Other Injection Styles (Briefly)](#5-other-injection-styles-briefly)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Hard-Coded Dependencies

Consider an `OrderService` that needs to send a confirmation notification after checkout:

```python
class EmailNotifier:
    def send(self, message: str) -> None:
        print(f"[Email] {message}")


class OrderService:
    def __init__(self) -> None:
        self.notifier = EmailNotifier()   # hard-coded — created inside the class

    def checkout(self, order_id: str) -> None:
        print(f"Processing order {order_id}")
        self.notifier.send(f"Order {order_id} confirmed")
```

This looks fine until requirements change or you need to test it:

- **Cannot swap the notification channel** without editing `OrderService`'s source (want SMS instead of email? Edit the class.) — this violates the Open/Closed Principle from Phase 02.
- **Cannot unit test in isolation** — every test of `OrderService.checkout()` also runs `EmailNotifier.send()`, which in a real system might make a network call to an email provider. Slow, flaky, and not a unit test anymore.
- **`OrderService` depends on a concrete class (`EmailNotifier`), not an abstraction** — a direct violation of the Dependency Inversion Principle.

---

## 2. What Dependency Injection Actually Is

**Dependency Injection (DI)** means a class receives its dependencies from the outside (typically via its constructor) instead of creating them itself. No framework is required — in Python, DI is usually just passing objects as constructor arguments.

```
Without DI:                          With DI:
  OrderService creates                 OrderService receives
  its own EmailNotifier                a NotificationChannel
  internally.                          from whoever constructs it.

  OrderService ──creates──> EmailNotifier      Caller ──creates──> EmailNotifier
                                                Caller ──injects──> OrderService
```

DI is the concrete mechanism that satisfies the Dependency Inversion Principle: "depend on abstractions, not concretions." The abstraction here is a `NotificationChannel` interface (built with `abc.ABC` or `typing.Protocol`, from earlier in this phase); the concretion (`EmailNotifier`, `SMSNotifier`) is decided by whoever constructs `OrderService`, not by `OrderService` itself.

---

## 3. Constructor Injection in Practice

```python
from abc import ABC, abstractmethod


class NotificationChannel(ABC):
    @abstractmethod
    def send(self, message: str) -> None:
        ...


class EmailNotifier(NotificationChannel):
    def send(self, message: str) -> None:
        print(f"[Email] {message}")


class SMSNotifier(NotificationChannel):
    def send(self, message: str) -> None:
        print(f"[SMS] {message}")


class OrderService:
    """Depends on the NotificationChannel abstraction, injected via the constructor."""

    def __init__(self, notifier: NotificationChannel) -> None:
        self.notifier = notifier   # received from outside, not created internally

    def checkout(self, order_id: str) -> None:
        print(f"Processing order {order_id}")
        self.notifier.send(f"Order {order_id} confirmed")


# The caller decides which concrete implementation to use — OrderService doesn't care
email_service = OrderService(notifier=EmailNotifier())
email_service.checkout("ORD-1")
# Processing order ORD-1
# [Email] Order ORD-1 confirmed

sms_service = OrderService(notifier=SMSNotifier())
sms_service.checkout("ORD-2")
# Processing order ORD-2
# [SMS] Order ORD-2 confirmed
```

Switching notification channels — or adding a brand-new one (`PushNotifier`, `SlackNotifier`) — requires **zero changes** to `OrderService`. This is the Open/Closed Principle in action, enabled directly by DI.

This scales cleanly to multiple dependencies — e.g., a `CheckoutService` needing both a payment gateway and a notifier:

```python
class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount: float) -> bool:
        ...


class StripeGateway(PaymentGateway):
    def charge(self, amount: float) -> bool:
        print(f"[Stripe] Charging ${amount:.2f}")
        return True


class CheckoutService:
    def __init__(
        self,
        payment_gateway: PaymentGateway,
        notifier: NotificationChannel,
    ) -> None:
        self.payment_gateway = payment_gateway
        self.notifier = notifier

    def checkout(self, order_id: str, amount: float) -> None:
        if self.payment_gateway.charge(amount):
            self.notifier.send(f"Order {order_id} confirmed, charged ${amount:.2f}")
        else:
            self.notifier.send(f"Order {order_id} payment failed")


checkout = CheckoutService(
    payment_gateway=StripeGateway(),
    notifier=EmailNotifier(),
)
checkout.checkout("ORD-3", 149.99)
```

`CheckoutService` never instantiates `StripeGateway` or `EmailNotifier` itself — it only knows about the `PaymentGateway` and `NotificationChannel` abstractions. All wiring decisions happen at the single point where `CheckoutService` is constructed (often called the "composition root").

---

## 4. DI and Testability

The biggest practical payoff of DI is that tests can inject a **fake/stub** implementation instead of a real one, with zero changes to the class under test:

```python
class FakeNotifier(NotificationChannel):
    """Test double — records messages instead of actually sending them."""

    def __init__(self) -> None:
        self.sent_messages: list[str] = []

    def send(self, message: str) -> None:
        self.sent_messages.append(message)


class FakePaymentGateway(PaymentGateway):
    """Test double — lets tests control charge success/failure deterministically."""

    def __init__(self, should_succeed: bool = True) -> None:
        self.should_succeed = should_succeed
        self.charged_amounts: list[float] = []

    def charge(self, amount: float) -> bool:
        self.charged_amounts.append(amount)
        return self.should_succeed


def test_checkout_sends_confirmation_on_successful_payment() -> None:
    fake_notifier = FakeNotifier()
    fake_gateway = FakePaymentGateway(should_succeed=True)
    service = CheckoutService(payment_gateway=fake_gateway, notifier=fake_notifier)

    service.checkout("ORD-1", 100.0)

    assert fake_gateway.charged_amounts == [100.0]
    assert fake_notifier.sent_messages == ["Order ORD-1 confirmed, charged $100.00"]


def test_checkout_sends_failure_message_on_declined_payment() -> None:
    fake_notifier = FakeNotifier()
    fake_gateway = FakePaymentGateway(should_succeed=False)
    service = CheckoutService(payment_gateway=fake_gateway, notifier=fake_notifier)

    service.checkout("ORD-2", 50.0)

    assert fake_notifier.sent_messages == ["Order ORD-2 payment failed"]


test_checkout_sends_confirmation_on_successful_payment()
test_checkout_sends_failure_message_on_declined_payment()
print("All tests passed")
```

No real network call, no real email sent, no non-determinism — because `CheckoutService` never hard-coded a concrete dependency, tests can substitute controllable fakes that also satisfy the `PaymentGateway`/`NotificationChannel` abstraction.

---

## 5. Other Injection Styles (Briefly)

Constructor injection is the default and most common style in Python LLD interviews, but two others exist:

```python
# Setter injection — dependency assigned after construction via a setter method.
# Useful for optional dependencies, but leaves the object in a partially-configured
# state between construction and the setter call.
class ReportGenerator:
    def __init__(self) -> None:
        self.notifier: NotificationChannel | None = None

    def set_notifier(self, notifier: NotificationChannel) -> None:
        self.notifier = notifier


# Method injection — dependency passed directly to the method that needs it,
# rather than stored on the object at all. Useful when the dependency
# only matters for a single operation, not the object's whole lifetime.
class ReportService:
    def generate_and_notify(self, notifier: NotificationChannel) -> None:
        notifier.send("Report generated")
```

Constructor injection is generally preferred because it makes dependencies **explicit and mandatory** — you cannot construct an `OrderService` without providing a `NotificationChannel`, so there's no way to end up with a half-initialized object that fails later when a dependency turns out to be missing.

---

## 6. Why This Matters for LLD Interviews

- **DI is how you *demonstrate* DIP, not just state it.** Saying "I follow the Dependency Inversion Principle" is a claim; writing `def __init__(self, gateway: PaymentGateway)` instead of `self.gateway = StripeGateway()` is proof, visible directly in the code you write during the interview.
- **Testability is a concrete, checkable outcome an interviewer can ask about directly** — "how would you unit test this without hitting a real payment API?" DI with injected abstractions is the direct answer: swap in a fake implementing the same interface.
- **Pairs with Strategy and Factory (Phases 04, 06):** the object being injected is very often itself chosen by a Factory, and the injected interface is very often a Strategy — DI is the "glue" that wires those patterns together into a working system rather than three unconnected ideas.
- **No framework needed — and interviewers don't expect one.** Unlike Java (Spring) or C# (built-in DI containers), idiomatic Python LLD interviews expect plain constructor injection; reaching for a DI framework or `unittest.mock` patching internals instead of injecting is usually a sign of overcomplicating a design that a simple constructor parameter would solve.

---

## 7. Hands-On Exercises

**Exercise 1:** Define a `DiscountStrategy` Protocol/ABC (from earlier lessons) with `apply(self, price: float) -> float`. Inject it into a `PricingService` via the constructor, and implement two strategies: `NoDiscount` and `PercentageDiscount(percent: float)`.

**Exercise 2:** Write a `FakeDiscountStrategy` test double that always returns a fixed value, and write a small test function (no test framework needed — plain `assert`) proving `PricingService` calls it correctly.

**Exercise 3:** Take the `CheckoutService` example and add a third injected dependency, `InventoryChecker` (with `is_in_stock(self, order_id: str) -> bool`), such that `checkout()` refuses to charge if the item is out of stock. Confirm you didn't need to touch `PaymentGateway` or `NotificationChannel` to add this.

**Exercise 4:** Rewrite `OrderService` from Section 1 (the *hard-coded* version) using setter injection instead of constructor injection, then explain in a comment why constructor injection is the safer default for a required dependency.

---

## 8. Interview Q&A

**Q: What is dependency injection, in one sentence?**
Answer: Dependency injection is providing a class's dependencies (typically other objects it collaborates with) from the outside — usually via constructor parameters — rather than having the class construct those dependencies itself internally.

**Q: How does dependency injection relate to the Dependency Inversion Principle?**
Answer: DIP states that high-level modules should depend on abstractions, not on concrete implementations. DI is the mechanical technique that makes this achievable in code: a class's constructor takes a parameter typed as an abstraction (an ABC or Protocol), and the caller decides, at construction time, which concrete implementation to pass in. Without DI, a class typically has to instantiate its own concrete dependency internally, which directly violates DIP.

**Q: Why is DI important for unit testing?**
Answer: When a dependency is injected rather than hard-coded, tests can pass in a fake/stub/mock implementation that satisfies the same interface but behaves deterministically and without side effects (no real network calls, no real charges, no real emails). This lets you unit test a class's logic in complete isolation from its collaborators' real implementations, and to assert on the fake's recorded state (e.g., "was `charge()` called with the right amount?").

**Q: What's the difference between constructor injection, setter injection, and method injection?**
Answer: Constructor injection passes dependencies as arguments to `__init__`, making them mandatory and available for the object's entire lifetime — generally preferred for required dependencies. Setter injection assigns a dependency via a separate method after construction, useful for optional dependencies but risks a partially-initialized object if the setter is forgotten. Method injection passes a dependency directly into the specific method that needs it, appropriate when the dependency is only relevant to a single operation rather than the object as a whole.

**Q: Do you need a DI framework (like Spring in Java) to do dependency injection in Python?**
Answer: No. Python's dynamic typing and first-class objects make DI trivial without any framework — you simply pass dependencies as constructor arguments. DI frameworks/containers exist in the Python ecosystem too (e.g., for auto-wiring large dependency graphs), but for LLD interviews and most application code, plain constructor injection is both sufficient and the expected idiomatic approach.

**Q: In the `CheckoutService` example, why does it depend on `PaymentGateway` and `NotificationChannel` (abstractions) rather than `StripeGateway` and `EmailNotifier` (concrete classes) directly?**
Answer: Depending on the abstractions means `CheckoutService`'s logic works unchanged regardless of which concrete gateway or notifier is supplied — new payment providers or notification channels can be added without modifying `CheckoutService` at all (Open/Closed Principle), and tests can substitute fakes for both dependencies without needing real external services. Depending on the concrete classes directly would couple `CheckoutService` to specific implementations, making it harder to extend and harder to test in isolation.
