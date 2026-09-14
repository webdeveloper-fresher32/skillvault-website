# Abstract Factory Pattern — Complete Guide

## Table of Contents
1. [Motivation](#1-motivation)
2. [Bad Example: Mixing Families by Accident](#2-bad-example-mixing-families-by-accident)
3. [Good Example: Regional Notification Factory](#3-good-example-regional-notification-factory)
4. [How It Works](#4-how-it-works)
5. [Abstract Factory vs Factory Method](#5-abstract-factory-vs-factory-method)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Motivation

Sometimes you don't just need *one* object built polymorphically — you need a **family of related objects** that must be used together and stay consistent with each other. The classic example is a UI theme: a `LightButton` must never be paired with a `DarkCheckbox` — they need to come from the same "family" (Light or Dark) for the UI to look coherent.

This lesson uses a similarly-shaped real-world example: a cross-platform notification system where each **region** needs its own family of senders — an `EmailSender` and an `SmsSender` that both speak that region's compliance rules and formats (e.g., US vs India). Mixing a US email sender with an India SMS sender by accident should be structurally impossible.

```
Family: "US"                Family: "India"
┌────────────────┐          ┌────────────────┐
│ USEmailSender   │          │ INEmailSender   │
│ USSmsSender     │          │ INSmsSender     │
└────────────────┘          └────────────────┘
   Must always be used as a matched pair — never mixed.
```

---

## 2. Bad Example: Mixing Families by Accident

```python
class USEmailSender:
    def send_email(self, to: str, body: str) -> str:
        return f"[US SMTP] Email to {to}: {body}"


class USSmsSender:
    def send_sms(self, to: str, body: str) -> str:
        return f"[US Twilio] SMS to {to}: {body}"


class INEmailSender:
    def send_email(self, to: str, body: str) -> str:
        return f"[IN SMTP + GST header] Email to {to}: {body}"


class INSmsSender:
    def send_sms(self, to: str, body: str) -> str:
        return f"[IN DLT-registered SMS] SMS to {to}: {body}"


# --- caller code, scattered across the app ---
def notify_user(region: str, to: str, body: str) -> None:
    if region == "US":
        email = USEmailSender()
        sms = INSmsSender()          # BUG: mismatched family! Nothing stops this.
    else:
        email = INEmailSender()
        sms = USSmsSender()          # BUG here too.
    print(email.send_email(to, body))
    print(sms.send_sms(to, body))
```

Nothing in the type system or the code structure *prevents* a US email sender from being paired with an India SMS sender. The bug above is easy to write and easy to miss in review — each sender is constructed independently, so there's no single point that enforces "these two must match."

---

## 3. Good Example: Regional Notification Factory

```python
from abc import ABC, abstractmethod


# --- Abstract products ---
class EmailSender(ABC):
    @abstractmethod
    def send_email(self, to: str, body: str) -> str: ...


class SmsSender(ABC):
    @abstractmethod
    def send_sms(self, to: str, body: str) -> str: ...


# --- Concrete products: US family ---
class USEmailSender(EmailSender):
    def send_email(self, to: str, body: str) -> str:
        return f"[US SMTP] Email to {to}: {body}"


class USSmsSender(SmsSender):
    def send_sms(self, to: str, body: str) -> str:
        return f"[US Twilio] SMS to {to}: {body}"


# --- Concrete products: India family ---
class INEmailSender(EmailSender):
    def send_email(self, to: str, body: str) -> str:
        return f"[IN SMTP + GST header] Email to {to}: {body}"


class INSmsSender(SmsSender):
    def send_sms(self, to: str, body: str) -> str:
        return f"[IN DLT-registered SMS] SMS to {to}: {body}"


# --- Abstract factory ---
class NotificationFactory(ABC):
    @abstractmethod
    def create_email_sender(self) -> EmailSender: ...

    @abstractmethod
    def create_sms_sender(self) -> SmsSender: ...


# --- Concrete factories, one per family ---
class USNotificationFactory(NotificationFactory):
    def create_email_sender(self) -> EmailSender:
        return USEmailSender()

    def create_sms_sender(self) -> SmsSender:
        return USSmsSender()


class INNotificationFactory(NotificationFactory):
    def create_email_sender(self) -> EmailSender:
        return INEmailSender()

    def create_sms_sender(self) -> SmsSender:
        return INSmsSender()


# --- Factory of factories (simple dispatch) ---
def get_notification_factory(region: str) -> NotificationFactory:
    factories: dict[str, type[NotificationFactory]] = {
        "US": USNotificationFactory,
        "IN": INNotificationFactory,
    }
    factory_cls = factories.get(region)
    if factory_cls is None:
        raise ValueError(f"Unsupported region: {region}")
    return factory_cls()


# --- Caller code: impossible to mismatch families ---
def notify_user(region: str, to: str, body: str) -> None:
    factory = get_notification_factory(region)
    email = factory.create_email_sender()
    sms = factory.create_sms_sender()
    print(email.send_email(to, body))
    print(sms.send_sms(to, body))


notify_user("US", "alice@example.com", "Your order shipped")
notify_user("IN", "bob@example.com", "Your order shipped")
```

Because `email` and `sms` are always produced by the **same** factory instance, it is structurally impossible to pair a US email sender with an India SMS sender — the caller never chooses the concrete classes itself, only the region.

---

## 4. How It Works

```
                     NotificationFactory (abstract)
                     ├── create_email_sender() -> EmailSender
                     └── create_sms_sender()   -> SmsSender
                              ▲                        ▲
              ┌───────────────┘                        └───────────────┐
   USNotificationFactory                                    INNotificationFactory
   ├── create_email_sender() -> USEmailSender      ├── create_email_sender() -> INEmailSender
   └── create_sms_sender()   -> USSmsSender        └── create_sms_sender()   -> INSmsSender

Each concrete factory is internally just two Factory Methods bundled
together, guaranteeing the pair returned always belongs to one family.
```

---

## 5. Abstract Factory vs Factory Method

| Aspect | Factory Method | Abstract Factory |
|---|---|---|
| Produces | One product | A family of related products |
| Structure | One creation method | Multiple creation methods on one factory |
| Enforces | Which concrete class to use | Which concrete classes are used *together* |
| Example | `PaymentFactory.create("stripe")` → one gateway | `USNotificationFactory()` → matched email + SMS senders |
| Relationship | Abstract Factory is typically composed of several Factory Methods | Built on top of Factory Method |

---

## 6. When to Use / Trade-offs

| Use Abstract Factory when | Trade-offs / caveats |
|---|---|
| You have multiple families of related products that must be used together consistently | More classes/interfaces than a single Factory Method — one abstract product interface + one concrete class per product per family |
| Mixing products from different families would be a correctness bug | Adding a *new kind of product* (e.g., a `PushNotificationSender`) requires updating the abstract factory interface **and every concrete factory** |
| You want to swap an entire family at once (e.g., switch region, switch UI theme) via a single factory swap | Overkill if there's only one family or products don't need to be used together |

---

## 7. Interview Q&A

**Q: What problem does Abstract Factory solve that Factory Method doesn't?**
Answer: Factory Method produces a single product polymorphically. Abstract Factory produces a *family* of related products that must be consistent with each other — it guarantees that whichever concrete factory you use, all the products it creates belong to the same family (e.g., a Light theme's Button is never paired with a Dark theme's Checkbox), which a collection of independent Factory Methods cannot guarantee on its own.

**Q: Implement an Abstract Factory from scratch for a UI theme system with Button and Checkbox for Light and Dark themes.**
Answer: Define abstract product interfaces `Button` and `Checkbox`, each with a `render()` method. Create concrete pairs: `LightButton`/`LightCheckbox` and `DarkButton`/`DarkCheckbox`. Define an abstract `UIFactory` with `create_button() -> Button` and `create_checkbox() -> Checkbox`. Implement `LightUIFactory` and `DarkUIFactory`, each returning its matching pair. Client code takes a single `UIFactory` instance and calls both creation methods on it, guaranteeing a matched theme.

**Q: How does Abstract Factory prevent the "mismatched family" bug?**
Answer: By requiring the caller to obtain all related products from a single concrete factory instance rather than instantiating each product independently. Since `USNotificationFactory` only ever returns `USEmailSender` and `USSmsSender`, and `INNotificationFactory` only ever returns the India pair, there is no code path where a caller can independently pick a US email sender and an India SMS sender — the pairing is enforced by construction, not by convention or code review.

**Q: What's the cost of adding a new product type (e.g., a PushNotificationSender) to an existing Abstract Factory?**
Answer: You must add a new abstract method (e.g., `create_push_sender()`) to the abstract factory interface, and then implement it in *every* concrete factory (`USNotificationFactory`, `INNotificationFactory`, and any others). This violates the Open/Closed Principle in one dimension — adding a new product type means modifying existing factory classes — which is the known trade-off of Abstract Factory: it's easy to add new *families* (a new concrete factory) but harder to add new *product types* (a new abstract method).

**Q: When would you choose a plain Factory Method over Abstract Factory?**
Answer: When you're only ever creating one kind of product and there's no risk of needing to keep multiple related objects consistent with each other — e.g., picking a single `PaymentGateway` implementation. Abstract Factory's extra structure (multiple abstract product interfaces, multiple concrete factories) only pays off when there are genuinely multiple products that must travel together as a family.

**Q: Is Abstract Factory just "a factory that returns other factories"?**
Answer: Not quite — an Abstract Factory is a single factory object with multiple creation methods, one per product type in the family (e.g., `create_email_sender()` and `create_sms_sender()` both live on the same `NotificationFactory`). It's sometimes *combined* with a factory-selection function (like `get_notification_factory(region)`) that itself looks like "a factory of factories," but that outer dispatch function is a separate, simpler piece — typically just a Factory Method or a registry lookup that decides which concrete Abstract Factory to hand back.
