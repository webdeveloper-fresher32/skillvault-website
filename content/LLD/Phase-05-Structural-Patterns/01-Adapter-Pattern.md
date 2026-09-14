# Adapter Pattern — Complete Guide

## Table of Contents
1. [The Problem Adapter Solves](#1-the-problem-adapter-solves)
2. [What is the Adapter Pattern?](#2-what-is-the-adapter-pattern)
3. [Bad Example: No Adapter](#3-bad-example-no-adapter)
4. [Good Example: Payment SDK Wrapper](#4-good-example-payment-sdk-wrapper)
5. [Object Adapter vs Class Adapter](#5-object-adapter-vs-class-adapter)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem Adapter Solves

You integrate a third-party library. Its interface almost never matches the interface your application already codes against.

```
Your application expects:          Third-party Stripe-like SDK gives you:
  processor.pay(amount, currency)    sdk.charge_card(card_token, amount_cents, curr_code)

Result: every call site in your app either
  (a) calls the SDK directly, coupling business logic to SDK shape, or
  (b) gets rewritten every time you swap payment providers.
```

Swap providers (Stripe → Razorpay → PayPal) and you either rewrite your whole codebase's call sites, or you introduce a **thin translation layer** once. That translation layer is the Adapter.

---

## 2. What is the Adapter Pattern?

Adapter converts the interface of a class into another interface clients expect. It lets classes work together that couldn't otherwise because of incompatible interfaces — without modifying either side.

```
┌─────────────┐       ┌───────────────────┐       ┌───────────────────────┐
│   Client    │──────▶│  Target Interface │◀──────│  Adapter (implements   │
│ (your app)  │       │  (what app wants) │       │  Target, wraps Adaptee)│
└─────────────┘       └───────────────────┘       └───────────┬────────────┘
                                                                │ delegates to
                                                                ▼
                                                    ┌───────────────────────┐
                                                    │  Adaptee (3rd-party   │
                                                    │  SDK — incompatible)  │
                                                    └───────────────────────┘
```

Think of it like a physical power plug adapter: your laptop charger (client) expects a US plug (target interface); the wall socket in Australia (adaptee) is a different shape. The travel adapter doesn't change either — it sits between them and translates.

---

## 3. Bad Example: No Adapter

```python
from dataclasses import dataclass


@dataclass
class StripeLikeSDK:
    """Third-party payment SDK — you don't control this code."""

    api_key: str

    def charge_card(self, card_token: str, amount_cents: int, curr_code: str) -> dict:
        print(f"[StripeSDK] Charging {amount_cents} {curr_code} to token {card_token}")
        return {"status": "succeeded", "sdk_txn_id": "ch_12345"}


class CheckoutService:
    """Business logic directly coupled to the SDK's exact method shape."""

    def __init__(self, sdk: StripeLikeSDK) -> None:
        self.sdk = sdk

    def checkout(self, card_token: str, amount_dollars: float) -> None:
        # Business logic has to know SDK details: cents conversion, currency code,
        # exact method name, and response shape.
        result = self.sdk.charge_card(card_token, int(amount_dollars * 100), "USD")
        if result["status"] == "succeeded":
            print(f"Order paid via txn {result['sdk_txn_id']}")
```

**Why this is painful:**
- If you switch to a different provider (PayPal, Razorpay), every call site in `CheckoutService` — and anywhere else in the codebase that touches payments — needs the SDK-specific conversion logic (cents, currency codes, response keys) rewritten.
- `CheckoutService` now knows implementation details of a specific vendor SDK, violating the Dependency Inversion Principle.
- Testing `CheckoutService` requires mocking the exact shape of a third-party class.

---

## 4. Good Example: Payment SDK Wrapper

We define **our own** `PaymentProcessor` interface — the shape our application wants — and write a thin **Adapter** class that wraps the vendor SDK to satisfy it. This is exactly the "Payment SDK Wrapper" pattern used in most real checkout systems.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


# ---- Target interface: what OUR application expects ----
class PaymentProcessor(ABC):
    """The interface our business logic codes against."""

    @abstractmethod
    def pay(self, card_token: str, amount_dollars: float) -> str:
        """Charge the card. Returns our own internal transaction id. Raises on failure."""
        raise NotImplementedError


# ---- Adaptee: the third-party SDK, unmodified ----
@dataclass
class StripeLikeSDK:
    api_key: str

    def charge_card(self, card_token: str, amount_cents: int, curr_code: str) -> dict:
        print(f"[StripeSDK] Charging {amount_cents} {curr_code} to token {card_token}")
        return {"status": "succeeded", "sdk_txn_id": "ch_12345"}


@dataclass
class RazorpayLikeSDK:
    """A second, differently-shaped vendor SDK — to prove the adapter isolates us."""

    merchant_id: str

    def make_payment(self, token: str, paise: int) -> tuple[bool, str]:
        print(f"[RazorpaySDK] Paying {paise} paise for token {token}")
        return True, "rzp_txn_98765"


# ---- Adapters: translate each vendor SDK into OUR PaymentProcessor interface ----
class StripeAdapter(PaymentProcessor):
    def __init__(self, sdk: StripeLikeSDK) -> None:
        self._sdk = sdk

    def pay(self, card_token: str, amount_dollars: float) -> str:
        amount_cents = int(round(amount_dollars * 100))
        result = self._sdk.charge_card(card_token, amount_cents, "USD")
        if result["status"] != "succeeded":
            raise RuntimeError("Stripe payment failed")
        return result["sdk_txn_id"]


class RazorpayAdapter(PaymentProcessor):
    def __init__(self, sdk: RazorpayLikeSDK) -> None:
        self._sdk = sdk

    def pay(self, card_token: str, amount_dollars: float) -> str:
        amount_paise = int(round(amount_dollars * 100))
        success, txn_id = self._sdk.make_payment(card_token, amount_paise)
        if not success:
            raise RuntimeError("Razorpay payment failed")
        return txn_id


# ---- Client: knows ONLY about PaymentProcessor, never about vendor SDKs ----
class CheckoutService:
    def __init__(self, processor: PaymentProcessor) -> None:
        self.processor = processor

    def checkout(self, card_token: str, amount_dollars: float) -> None:
        txn_id = self.processor.pay(card_token, amount_dollars)
        print(f"Order paid — internal reference: {txn_id}")


if __name__ == "__main__":
    stripe_checkout = CheckoutService(StripeAdapter(StripeLikeSDK(api_key="sk_test_123")))
    stripe_checkout.checkout(card_token="tok_visa", amount_dollars=49.99)

    razorpay_checkout = CheckoutService(RazorpayAdapter(RazorpayLikeSDK(merchant_id="mid_1")))
    razorpay_checkout.checkout(card_token="tok_rupay", amount_dollars=49.99)
```

```
Output:
[StripeSDK] Charging 4999 USD to token tok_visa
Order paid — internal reference: ch_12345
[RazorpaySDK] Paying 4999 paise for token tok_rupay
Order paid — internal reference: rzp_txn_98765
```

Notice `CheckoutService` never changed between the two vendors — only the Adapter it was handed changed. That's the whole point.

---

## 5. Object Adapter vs Class Adapter

| Style | Mechanism | Python Fit |
|-------|-----------|------------|
| **Object Adapter** (used above) | Adapter *composes* (holds a reference to) the Adaptee, delegates calls | Preferred in Python — favors composition, works with any adaptee including ones without a common base |
| **Class Adapter** | Adapter *inherits* from both Target and Adaptee (multiple inheritance) | Possible via Python multiple inheritance, but rare — tightly couples adapter to one adaptee class, breaks if adaptee has no compatible base, harder to reason about MRO |

```python
# Class Adapter sketch (rarely used in Python, shown for completeness)
class StripeClassAdapter(PaymentProcessor, StripeLikeSDK):
    def pay(self, card_token: str, amount_dollars: float) -> str:
        result = self.charge_card(card_token, int(amount_dollars * 100), "USD")
        return result["sdk_txn_id"]
```

Stick with the **object adapter** style in almost all real Python code — it's more flexible and testable.

---

## 6. When to Use / Trade-offs

**Use Adapter when:**
- You integrate a third-party library/SDK whose interface doesn't match what your code expects.
- You want to swap vendors/implementations later without touching business logic (Stripe → PayPal → internal gateway).
- You're migrating a legacy interface to a new one incrementally, keeping old code working via an adapter.

**Trade-offs:**
- Adds an extra layer/class per integration — slight indirection overhead.
- If overused for things that aren't genuinely "incompatible interfaces," it's unnecessary ceremony — sometimes a simple wrapper function is enough.
- Doesn't change behavior/business rules of the adaptee — it only translates shape. Don't smuggle business logic into an adapter.

---

## 7. Hands-On Exercises

**Exercise 1:** Add a `PayPalLikeSDK` with method `send_payment(email: str, amount: float) -> dict` returning `{"result": "ok", "id": "pp_..."}`. Write `PayPalAdapter` implementing `PaymentProcessor`.

**Exercise 2:** Modify `PaymentProcessor` to add a `refund(txn_id: str) -> bool` method. Implement it in `StripeAdapter` and `RazorpayAdapter`, inventing plausible vendor SDK refund methods.

**Exercise 3:** Write a small `NotificationAdapter` that adapts a third-party SMS SDK (`send_sms(to, body)`) and a third-party email SDK (`send_mail(recipient, subject, html)`) into a single `Notifier.notify(user_id: str, message: str) -> None` interface.

---

## 8. Interview Q&A

**Q: What problem does the Adapter pattern solve, in one sentence?**
Answer: It lets two interfaces that are incompatible in shape work together by introducing a translator class, without modifying either the client's expected interface or the third-party code.

**Q: How would you use Adapter when integrating a payment gateway SDK?**
Answer: Define your own `PaymentProcessor` interface expressing what your app needs (e.g., `pay(card_token, amount) -> txn_id`). Write an Adapter class per vendor (StripeAdapter, RazorpayAdapter) that implements `PaymentProcessor` and internally calls the vendor SDK's actual methods, translating parameters (cents vs dollars, currency codes) and return shapes. Business logic (`CheckoutService`) only depends on `PaymentProcessor`, so swapping vendors means swapping the adapter, not rewriting checkout code.

**Q: What is the difference between Object Adapter and Class Adapter?**
Answer: Object Adapter uses composition — the adapter holds a reference to the adaptee instance and delegates calls to it. Class Adapter uses inheritance — the adapter class inherits from both the target interface and the adaptee. Python favors Object Adapter because it works with any adaptee (even ones you can't subclass cleanly), avoids multiple-inheritance complexity, and follows "favor composition over inheritance."

**Q: How is Adapter different from Facade?**
Answer: Adapter makes one existing interface look like another interface the client already expects — it's about **compatibility**, usually wrapping a single class. Facade creates a brand-new, simplified interface over a **whole subsystem** of multiple classes — it's about **simplicity**, hiding complexity rather than translating shape. An adapter typically doesn't reduce the number of methods; a facade does.

**Q: Implement a minimal Adapter pattern from scratch for a legacy `XMLLogger` (method `write_xml(tag: str, message: str)`) that needs to satisfy a new `Logger` interface with a single method `log(message: str) -> None` at INFO level.**
Answer:
```python
from abc import ABC, abstractmethod


class Logger(ABC):
    @abstractmethod
    def log(self, message: str) -> None:
        raise NotImplementedError


class XMLLogger:
    def write_xml(self, tag: str, message: str) -> None:
        print(f"<{tag}>{message}</{tag}>")


class XMLLoggerAdapter(Logger):
    def __init__(self, xml_logger: XMLLogger) -> None:
        self._xml_logger = xml_logger

    def log(self, message: str) -> None:
        self._xml_logger.write_xml("INFO", message)


def notify(logger: Logger) -> None:
    logger.log("Order placed successfully")


notify(XMLLoggerAdapter(XMLLogger()))
```

**Q: Can an Adapter adapt multiple incompatible objects into one interface at once?**
Answer: Yes — this is sometimes called a "pluggable adapter" or is combined with Facade. For example, a `NotificationAdapter` could wrap both a third-party SMS SDK and a third-party email SDK behind one `Notifier.notify(...)` method, choosing internally which underlying SDK to call. When it starts orchestrating multiple subsystems rather than translating one interface, it's drifting toward Facade — the two patterns are often combined in real systems.
