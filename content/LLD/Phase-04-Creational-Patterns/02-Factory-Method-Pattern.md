# Factory Method Pattern — Complete Guide

## Table of Contents
1. [Motivation](#1-motivation)
2. [Bad Example: If/Elif Chains Everywhere](#2-bad-example-ifelif-chains-everywhere)
3. [Good Example: Payment Gateway Factory](#3-good-example-payment-gateway-factory)
4. [How It Works](#4-how-it-works)
5. [When to Use / Trade-offs](#5-when-to-use--trade-offs)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Motivation

Object creation logic that depends on a runtime value (a string, a config flag, a user selection) tends to start as a single `if/elif` block. The problem isn't the first `if/elif` — it's that the *same* decision logic gets copy-pasted into every place that needs to create the object, and every time a new type is added, every one of those copies must be updated.

Factory Method centralizes "which concrete class to instantiate" into one place, so the rest of the codebase depends only on an abstract interface (`PaymentGateway`) and never on concrete classes (`StripePayment`, `PaypalPayment`) directly.

```
Without Factory Method:                With Factory Method:

checkout.py: if provider == "stripe":  checkout.py: gateway = PaymentFactory.create(provider)
             ...                                    gateway.charge(...)
refund.py:   if provider == "stripe":
             ...                       PaymentFactory: if provider == "stripe": ...
webhook.py:  if provider == "stripe":                  (ONE place to update)
             ...
(3+ copies of the same decision, all must change together)
```

---

## 2. Bad Example: If/Elif Chains Everywhere

```python
class StripePayment:
    def charge(self, amount: float) -> str:
        return f"Charged ${amount:.2f} via Stripe"


class PaypalPayment:
    def charge(self, amount: float) -> str:
        return f"Charged ${amount:.2f} via PayPal"


# --- checkout.py ---
def checkout(provider: str, amount: float) -> str:
    if provider == "stripe":
        gateway = StripePayment()
    elif provider == "paypal":
        gateway = PaypalPayment()
    else:
        raise ValueError(f"Unknown provider: {provider}")
    return gateway.charge(amount)


# --- refund.py (same decision logic, copy-pasted) ---
def refund(provider: str, amount: float) -> str:
    if provider == "stripe":
        gateway = StripePayment()
    elif provider == "paypal":
        gateway = PaypalPayment()
    else:
        raise ValueError(f"Unknown provider: {provider}")
    return f"Refunded ${amount:.2f} via {provider}"
```

Adding **Razorpay** now means finding and editing every `if/elif` chain scattered across `checkout.py`, `refund.py`, `webhook.py`, and anywhere else a gateway gets constructed — easy to miss one, and a violation of the **Open/Closed Principle** (the code isn't closed to modification; every new provider forces edits to existing, working code).

---

## 3. Good Example: Payment Gateway Factory

```python
from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    """Common interface every concrete gateway must implement."""

    @abstractmethod
    def charge(self, amount: float) -> str: ...

    @abstractmethod
    def refund(self, amount: float) -> str: ...


class StripePayment(PaymentGateway):
    def charge(self, amount: float) -> str:
        return f"Charged ${amount:.2f} via Stripe"

    def refund(self, amount: float) -> str:
        return f"Refunded ${amount:.2f} via Stripe"


class PaypalPayment(PaymentGateway):
    def charge(self, amount: float) -> str:
        return f"Charged ${amount:.2f} via PayPal"

    def refund(self, amount: float) -> str:
        return f"Refunded ${amount:.2f} via PayPal"


class RazorpayPayment(PaymentGateway):
    def charge(self, amount: float) -> str:
        return f"Charged ${amount:.2f} via Razorpay"

    def refund(self, amount: float) -> str:
        return f"Refunded ${amount:.2f} via Razorpay"


class PaymentFactory:
    """Single place that knows how to build a PaymentGateway."""

    _registry: dict[str, type[PaymentGateway]] = {
        "stripe": StripePayment,
        "paypal": PaypalPayment,
        "razorpay": RazorpayPayment,
    }

    @classmethod
    def create(cls, provider: str) -> PaymentGateway:
        gateway_cls = cls._registry.get(provider.lower())
        if gateway_cls is None:
            raise ValueError(f"Unknown provider: {provider}")
        return gateway_cls()

    @classmethod
    def register(cls, name: str, gateway_cls: type[PaymentGateway]) -> None:
        """Allows plugging in new providers without editing this class."""
        cls._registry[name.lower()] = gateway_cls


# --- checkout.py ---
def checkout(provider: str, amount: float) -> str:
    gateway = PaymentFactory.create(provider)
    return gateway.charge(amount)


# --- refund.py ---
def refund(provider: str, amount: float) -> str:
    gateway = PaymentFactory.create(provider)
    return gateway.refund(amount)


checkout("stripe", 49.99)
refund("razorpay", 20.00)
```

Adding a new provider (e.g., `SquarePayment`) now means: write the class, call `PaymentFactory.register("square", SquarePayment)` — **zero edits** to `checkout.py`, `refund.py`, or any other caller. The registry-based factory even makes the factory itself open for extension without modification.

---

## 4. How It Works

```
┌────────────────┐        creates       ┌───────────────────┐
│ PaymentFactory │ ──────────────────▶  │  PaymentGateway    │  (interface)
│  .create(name) │                      └─────────▲──────────┘
└────────────────┘                                │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                          StripePayment    PaypalPayment   RazorpayPayment
```

Callers depend only on `PaymentGateway` (the abstraction) and `PaymentFactory` (the single creation point) — never on `StripePayment` directly. This is the **Dependency Inversion Principle** in action: high-level modules (`checkout`, `refund`) depend on an abstraction, not on concrete implementations.

---

## 5. When to Use / Trade-offs

| Use Factory Method when | Trade-offs / caveats |
|---|---|
| Object creation depends on a runtime condition (config, user input, string key) | Adds a layer of indirection — for 2 fixed types that never change, a plain `if/else` may be simpler |
| The same creation decision is duplicated across multiple call sites | The factory itself becomes a dependency every caller needs to import |
| You expect to add new concrete types over the product's lifetime | Without a registry, the factory's own `if/elif` still needs editing per new type (still centralizes it to one place, though — the key win) |
| You want callers to depend on an abstract interface, not concrete classes | Slightly more upfront code (interface + factory) than direct instantiation |

---

## 6. Interview Q&A

**Q: What problem does the Factory Method pattern solve?**
Answer: It centralizes object-creation logic that depends on a runtime condition into a single place, so callers depend on an abstract interface rather than concrete classes. This avoids duplicating the same `if/elif` decision across every call site and means adding a new concrete type doesn't require touching existing caller code — directly supporting the Open/Closed Principle.

**Q: Implement a Factory Method pattern from scratch for a notification system with Email and SMS types.**
Answer: Define an abstract `Notifier` with a `send(message: str) -> None` method. Create `EmailNotifier` and `SmsNotifier` concrete classes implementing it. Create a `NotifierFactory` with a `create(channel: str) -> Notifier` classmethod that maps a string key to the right concrete class (via `if/elif` or a dict registry) and returns an instance. Callers do `NotifierFactory.create("email").send("hi")` — they never import `EmailNotifier` directly.

**Q: How is Factory Method different from just calling the constructor directly?**
Answer: Calling `StripePayment()` directly couples the caller to a specific concrete class — the caller must know and import every concrete type and re-implement the selection logic. `PaymentFactory.create("stripe")` couples the caller only to the factory and the abstract `PaymentGateway` interface; the decision of *which* concrete class to build is made once, in one place, and can change (or gain new options) without touching any caller.

**Q: How does a registry-based factory improve on a plain if/elif factory?**
Answer: A plain if/elif factory still requires editing the factory's method body every time a new type is added — better than duplicating logic across callers, but still a modification to existing code. A registry (a `dict[str, type]` with a `register()` classmethod) lets new types plug themselves in by calling `register()` — e.g., from a plugin module — without ever touching the factory's source, making the factory itself closed for modification and open for extension.

**Q: What's the difference between Factory Method and Abstract Factory?**
Answer: Factory Method creates one product via a single creation method (e.g., one `PaymentGateway`). Abstract Factory creates a *family* of related products that must be used together (e.g., a `Button` and a `Checkbox` that both match the same UI theme) through multiple creation methods on one factory object. Abstract Factory is often built using several Factory Methods internally.

**Q: When would you avoid using Factory Method?**
Answer: When there's only one concrete type, or the set of types is fixed and will never grow (e.g., exactly two hardcoded payment providers that will never change), introducing an abstract interface and a factory class adds indirection and boilerplate without a corresponding benefit — direct instantiation is simpler and equally maintainable in that case.
