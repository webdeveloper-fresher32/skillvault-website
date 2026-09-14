# Open-Closed Principle (OCP) — Complete Guide

## Table of Contents
1. [What is OCP?](#1-what-is-ocp)
2. [The Bad Example — A Discount Service That Grows Forever](#2-the-bad-example--a-discount-service-that-grows-forever)
3. [The Good Example — Extending Without Modifying](#3-the-good-example--extending-without-modifying)
4. [A Second Example — Notification Channels](#4-a-second-example--notification-channels)
5. [Why This Matters in Practice](#5-why-this-matters-in-practice)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Interview-Style Exercise](#7-interview-style-exercise)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is OCP?

> **Software entities (classes, modules, functions) should be open for extension, but closed for modification.**

In practice: when a new requirement shows up, you should be able to add new code (a new class) rather than edit code that already works and is already tested. The classic mechanism for this in Python is **polymorphism** — define an abstraction (an ABC or protocol), and let new behavior arrive as new subclasses.

```
┌───────────────────────────────────────────────────────────┐
│  OCP in one picture                                        │
│                                                             │
│  Bad:   if type == "A": ...                                │
│         elif type == "B": ...                              │
│         elif type == "C": ...   ◄── edited every time a    │
│                                       new type is added     │
│                                                             │
│  Good:  Abstraction                                         │
│           ▲     ▲     ▲                                    │
│         TypeA TypeB TypeC   ◄── new type = new subclass,    │
│                                   zero edits to existing code│
└───────────────────────────────────────────────────────────┘
```

---

## 2. The Bad Example — A Discount Service That Grows Forever

```python
class DiscountService:
    """
    Smell: every new discount type requires editing this method
    and adding another elif branch. This class is never "done" —
    it's modified on every new business requirement, risking
    regressions in the untouched branches every single time.
    """

    def calculate_discount(self, customer_type: str, amount: float) -> float:
        if customer_type == "regular":
            return amount * 0.95  # 5% off
        elif customer_type == "premium":
            return amount * 0.90  # 10% off
        elif customer_type == "vip":
            return amount * 0.80  # 20% off
        else:
            return amount
```

### What Breaks / Why It's a Smell

| Problem | Consequence |
|---------|-------------|
| Adding a new customer tier means editing `calculate_discount` | Every change risks breaking existing, already-tested branches |
| Growing `if/elif` chain becomes unreadable over time | Cyclomatic complexity balloons; hard to review diffs |
| No way to plug in a discount rule without touching this file | Can't be extended by another team/module without a merge |
| Testing requires re-running the *whole* method for every branch | Slower feedback loop; regressions in tier A while adding tier D |

---

## 3. The Good Example — Extending Without Modifying

```python
from abc import ABC, abstractmethod


class DiscountStrategy(ABC):
    """The abstraction that is 'closed for modification.'"""

    @abstractmethod
    def apply(self, amount: float) -> float:
        raise NotImplementedError


class RegularDiscount(DiscountStrategy):
    def apply(self, amount: float) -> float:
        return amount * 0.95


class PremiumDiscount(DiscountStrategy):
    def apply(self, amount: float) -> float:
        return amount * 0.90


class VipDiscount(DiscountStrategy):
    def apply(self, amount: float) -> float:
        return amount * 0.80


class NoDiscount(DiscountStrategy):
    def apply(self, amount: float) -> float:
        return amount


class DiscountService:
    """
    Never needs to change again. It works purely against the
    DiscountStrategy abstraction.
    """

    def calculate_discount(self, strategy: DiscountStrategy, amount: float) -> float:
        return strategy.apply(amount)


# Usage
service = DiscountService()
print(service.calculate_discount(VipDiscount(), 1000))       # 800.0
print(service.calculate_discount(RegularDiscount(), 1000))   # 950.0

# Adding a brand-new "Black Friday 50% off" tier requires
# ZERO edits to DiscountService or any existing strategy class:
class BlackFridayDiscount(DiscountStrategy):
    def apply(self, amount: float) -> float:
        return amount * 0.50

print(service.calculate_discount(BlackFridayDiscount(), 1000))  # 500.0
```

This is the **Strategy Pattern** — you'll see it formally in Phase 03, but OCP is the principle that motivates it.

---

## 4. A Second Example — Notification Channels

A second common interview scenario: extending a notification system with new channels (push notifications, Slack, etc.) without touching the existing dispatch code.

```python
from abc import ABC, abstractmethod
from typing import List


class NotificationChannel(ABC):
    @abstractmethod
    def send(self, message: str, recipient: str) -> None:
        raise NotImplementedError


class EmailChannel(NotificationChannel):
    def send(self, message: str, recipient: str) -> None:
        print(f"[Email] to {recipient}: {message}")


class SmsChannel(NotificationChannel):
    def send(self, message: str, recipient: str) -> None:
        print(f"[SMS] to {recipient}: {message}")


class NotificationService:
    """Closed for modification: dispatch logic never changes."""

    def __init__(self, channels: List[NotificationChannel]):
        self.channels = channels

    def notify_all(self, message: str, recipient: str) -> None:
        for channel in self.channels:
            channel.send(message, recipient)


# Extending with a brand new channel — no edits to NotificationService:
class SlackChannel(NotificationChannel):
    def send(self, message: str, recipient: str) -> None:
        print(f"[Slack] to {recipient}: {message}")


service = NotificationService([EmailChannel(), SmsChannel(), SlackChannel()])
service.notify_all("Your order has shipped!", "asha@example.com")
```

---

## 5. Why This Matters in Practice

```
Bad: growing if/elif                Good: polymorphic dispatch
                                     
if type == A: ...                   Abstraction.apply()
elif type == B: ...                      ▲    ▲    ▲    ▲
elif type == C: ...                      A    B    C   NEW
elif type == NEW: ...  ◄── edited    (each independently
   (touches tested code)              testable, zero edits
                                       to existing classes)
```

New requirements are the norm, not the exception, in real systems (new discount tiers, new payment methods, new notification channels, new file export formats). OCP means each new requirement is additive: a new file, a new class, a PR that touches nothing else — drastically lowering regression risk and enabling parallel work by different engineers on different strategies.

---

## 6. Common Misconceptions

- **"OCP means never editing any code, ever."** Not literally — you will still edit code for bug fixes or when the abstraction itself is wrong. OCP is about *extending behavior* without modifying *already-correct, already-tested* code.
- **"You need to predict every future extension in advance."** No — you introduce the abstraction only once you see the recurring `if/elif`/`switch` pattern (or anticipate it strongly, e.g. payment methods). Over-engineering an abstraction for a single case that never repeats is a real anti-pattern (YAGNI).
- **"Strategy pattern is the only way to do OCP."** It's the most common mechanism, but plugins/registries, decorators, and composition all achieve the same goal — the invariant is "new behavior added without editing existing, working code."

---

## 7. Interview-Style Exercise

**Prompt:** "This `ShippingCostCalculator` grows every time we add a shipping method. Refactor it to follow OCP."

```python
class ShippingCostCalculator:
    def calculate(self, method: str, weight_kg: float) -> float:
        if method == "standard":
            return weight_kg * 2.0
        elif method == "express":
            return weight_kg * 5.0 + 10
        elif method == "overnight":
            return weight_kg * 10.0 + 25
        else:
            raise ValueError(f"Unknown shipping method: {method}")
```

**Refactored Answer:**

```python
from abc import ABC, abstractmethod


class ShippingStrategy(ABC):
    @abstractmethod
    def calculate(self, weight_kg: float) -> float:
        raise NotImplementedError


class StandardShipping(ShippingStrategy):
    def calculate(self, weight_kg: float) -> float:
        return weight_kg * 2.0


class ExpressShipping(ShippingStrategy):
    def calculate(self, weight_kg: float) -> float:
        return weight_kg * 5.0 + 10


class OvernightShipping(ShippingStrategy):
    def calculate(self, weight_kg: float) -> float:
        return weight_kg * 10.0 + 25


class ShippingCostCalculator:
    def calculate(self, strategy: ShippingStrategy, weight_kg: float) -> float:
        return strategy.calculate(weight_kg)


# New requirement: "drone" shipping — zero edits above this line
class DroneShipping(ShippingStrategy):
    def calculate(self, weight_kg: float) -> float:
        return weight_kg * 15.0 + 50


calc = ShippingCostCalculator()
print(calc.calculate(DroneShipping(), 3))  # 95.0
```

In an interview, explicitly point out: "notice `ShippingCostCalculator` didn't change at all when I added `DroneShipping` — that's the closed-for-modification part. The new class is the open-for-extension part."

---

## 8. Interview Q&A

**Q: What is the Open-Closed Principle?**
Answer: OCP states that classes/modules should be open for extension but closed for modification — you should be able to add new behavior without editing existing, already-tested code. In practice this is achieved through polymorphism: define an abstraction (interface/ABC), and represent each variant as a subclass. Adding a new variant means adding a new class, not touching the dispatch logic.

**Q: How do you recognize an OCP violation in code?**
Answer: The strongest signal is a growing `if/elif`/`switch` statement (or a dictionary of type-to-behavior mappings) that gets a new branch every time a new business requirement arrives. If you find yourself re-opening and editing the same method repeatedly for unrelated new cases, that method is not closed for modification.

**Q: What design pattern is most associated with OCP?**
Answer: The Strategy pattern is the textbook example — encapsulate each algorithm/variant behind a common interface and let the client hold a reference to whichever strategy it needs. Factory patterns, the Decorator pattern, and plugin/registry architectures are other common mechanisms for achieving OCP.

**Q: Does OCP mean you should never modify existing code?**
Answer: No. Bug fixes, refactors for clarity, and correcting a wrong abstraction all still involve modifying existing code — that's healthy maintenance. OCP specifically targets the addition of *new behavior*: the goal is that adding a new case shouldn't require editing and re-testing unrelated, already-correct cases.

**Q: Isn't introducing an abstraction for every possible variation over-engineering?**
Answer: Yes, if done prematurely. If you only have one case and no clear signal that more are coming, introducing an ABC and a strategy hierarchy is unnecessary ceremony (violates YAGNI). Apply OCP once you see the second or third `elif` branch appearing, or when you have concrete evidence (e.g., product roadmap) that more variants are imminent, such as payment methods or discount tiers.

**Q: How does OCP interact with the Dependency Inversion Principle?**
Answer: They work together — OCP's polymorphic abstraction only stays "closed for modification" if the client depends on the abstraction, not on concrete subclasses (that's DIP). In the discount example, `DiscountService.calculate_discount` takes a `DiscountStrategy` (the abstraction), not a specific class like `VipDiscount` — that's what lets new strategies be added without touching `DiscountService`.
