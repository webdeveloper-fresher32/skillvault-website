# Strategy Pattern — Complete Guide

## Table of Contents
1. [The Problem Strategy Solves](#1-the-problem-strategy-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Strategy Solves

An e-commerce checkout needs to support many payment methods: Credit Card, UPI, Net Banking, Wallet — and more will be added later (BNPL, crypto). Each method has its own validation and processing logic. If that logic lives inside the `Checkout` class as a giant conditional, the class grows forever and violates Open/Closed.

```
Without Strategy:
  Checkout.pay(method, details)
     if method == "credit_card": ... 40 lines ...
     elif method == "upi": ... 30 lines ...
     elif method == "net_banking": ... 35 lines ...
     elif method == "wallet": ... 20 lines ...
     # every new payment method touches this method again
```

**Strategy Pattern**: define a family of algorithms, encapsulate each one in its own class behind a common interface, and make them interchangeable at runtime.

---

## 2. The Bad Example

```python
class Checkout:
    def pay(self, method: str, amount: float, details: dict) -> bool:
        if method == "credit_card":
            print(f"Validating card {details['card_number'][-4:]}")
            print(f"Charging ${amount} to credit card")
            return True
        elif method == "upi":
            print(f"Validating UPI id {details['upi_id']}")
            print(f"Charging ${amount} via UPI")
            return True
        elif method == "net_banking":
            print(f"Redirecting to {details['bank']} net banking portal")
            print(f"Charging ${amount} via net banking")
            return True
        elif method == "wallet":
            print(f"Checking wallet balance for {details['wallet_id']}")
            print(f"Charging ${amount} from wallet")
            return True
        else:
            raise ValueError(f"Unknown payment method: {method}")
```

Problems:
- Adding "BNPL" means editing `Checkout.pay` again — Open/Closed violated.
- `Checkout` has to know the internal detail-keys (`card_number`, `upi_id`, `bank`, `wallet_id`) for every method — poor cohesion.
- Impossible to unit-test one payment method in isolation from the others.
- No way to swap a strategy at runtime without touching this method's source.

---

## 3. The Good Example

```
┌────────────────┐        ┌───────────────────────┐
│    Checkout    │ ──────▶│  «interface»          │
│ (context)      │  uses  │  PaymentStrategy       │
│ - strategy     │        │  + pay(amount) -> bool │
└────────────────┘        └───────────────────────┘
                                    ▲
                    ┌───────────────┼───────────────┬────────────────┐
                    │               │                │                │
          ┌─────────────────┐ ┌──────────┐ ┌──────────────────┐ ┌──────────┐
          │ CreditCardPayment│ │UPIPayment│ │NetBankingPayment │ │WalletPayment│
          └─────────────────┘ └──────────┘ └──────────────────┘ └──────────┘
```

`Checkout` holds a reference to a `PaymentStrategy` and delegates. Adding a new payment method means adding a new class — zero changes to `Checkout`.

---

## 4. Real-World Tie-In

This is exactly how real checkout systems (Stripe, Razorpay, PayPal SDKs) are structured internally, and how you'd design an e-commerce discount engine too — "Flat Discount", "Percentage Discount", "BuyOneGetOne" are interchangeable `DiscountStrategy` implementations plugged into a `Cart`.

---

## 5. Complete Runnable Code

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


class PaymentStrategy(ABC):
    """Common interface every payment method must implement."""

    @abstractmethod
    def pay(self, amount: float) -> bool:
        """Process payment of `amount`. Returns True on success."""
        raise NotImplementedError


@dataclass
class CreditCardPayment(PaymentStrategy):
    card_number: str
    cvv: str

    def pay(self, amount: float) -> bool:
        print(f"[CreditCard] Validating card ending {self.card_number[-4:]}")
        print(f"[CreditCard] Charging ${amount:.2f}")
        return True


@dataclass
class UPIPayment(PaymentStrategy):
    upi_id: str

    def pay(self, amount: float) -> bool:
        print(f"[UPI] Validating UPI id {self.upi_id}")
        print(f"[UPI] Charging ${amount:.2f}")
        return True


@dataclass
class NetBankingPayment(PaymentStrategy):
    bank_name: str

    def pay(self, amount: float) -> bool:
        print(f"[NetBanking] Redirecting to {self.bank_name} portal")
        print(f"[NetBanking] Charging ${amount:.2f}")
        return True


@dataclass
class WalletPayment(PaymentStrategy):
    wallet_id: str
    balance: float

    def pay(self, amount: float) -> bool:
        if self.balance < amount:
            print(f"[Wallet] Insufficient balance for wallet {self.wallet_id}")
            return False
        self.balance -= amount
        print(f"[Wallet] Charged ${amount:.2f}, remaining balance ${self.balance:.2f}")
        return True


class Checkout:
    """Context: holds a strategy and delegates payment to it."""

    def __init__(self, strategy: PaymentStrategy) -> None:
        self._strategy = strategy

    def set_strategy(self, strategy: PaymentStrategy) -> None:
        """Swap the strategy at runtime -- e.g. user changes payment method."""
        self._strategy = strategy

    def checkout(self, amount: float) -> bool:
        print(f"--- Checking out ${amount:.2f} ---")
        return self._strategy.pay(amount)


if __name__ == "__main__":
    checkout = Checkout(CreditCardPayment(card_number="4111111111111234", cvv="123"))
    checkout.checkout(250.0)

    checkout.set_strategy(UPIPayment(upi_id="ganesh@upi"))
    checkout.checkout(75.5)

    checkout.set_strategy(WalletPayment(wallet_id="W-9001", balance=50.0))
    checkout.checkout(75.5)  # insufficient balance -> False
```

Expected output:
```
--- Checking out $250.00 ---
[CreditCard] Validating card ending 1234
[CreditCard] Charging $250.00
--- Checking out $75.50 ---
[UPI] Validating UPI id ganesh@upi
[UPI] Charging $75.50
--- Checking out $75.50 ---
[Wallet] Insufficient balance for wallet W-9001
```

---

## 6. When to Use / Trade-offs

**Use Strategy when:**
- You have multiple algorithms/behaviors that solve the same problem in different ways (payment methods, discount rules, sorting/compression algorithms, pricing engines).
- You want to switch behavior at runtime.
- You want to avoid a long `if/elif`/`switch` ladder that keeps growing.

**Trade-offs:**
- Adds a class per strategy — can feel like over-engineering for 2 simple, stable variants.
- Client code must know which concrete strategy to instantiate (often solved by pairing Strategy with a Factory — see Phase 04).
- If strategies need access to a lot of context state, you either pass many params to `pay()` or store shared state on the context and pass `self` — watch for leaking context internals into the strategy.

| Aspect | Without Strategy | With Strategy |
|--------|-------------------|----------------|
| Adding a new algorithm | Edit existing method (Open/Closed violated) | Add a new class (Open/Closed respected) |
| Testability | Must test through the god method | Test each strategy in isolation |
| Runtime switching | Awkward / re-enter the conditional | `set_strategy()` in O(1) |

---

## 7. Interview Q&A

**Q: What problem does the Strategy pattern solve?**
Answer: It eliminates large conditional blocks that select between interchangeable algorithms. Each algorithm is encapsulated in its own class implementing a common interface, and a context object holds a reference to whichever strategy is active, delegating work to it. This satisfies the Open/Closed Principle — new algorithms are added as new classes, not by editing existing code.

**Q: How is Strategy different from State pattern? They look identical in code.**
Answer: Structurally they are nearly identical (context holds an interface reference, concrete classes implement behavior). The difference is intent: Strategy variants are chosen by the *client* and are independent of each other (you pick "pay by UPI" once per checkout); State variants transition *automatically* based on the object's own lifecycle, and each state typically knows which state comes next (an Order in `Placed` state transitions itself to `Shipped`). Strategy = "which algorithm should I use"; State = "what state am I in and how does that change my behavior."

**Q: How would you avoid making the client instantiate the wrong concrete strategy directly?**
Answer: Pair Strategy with a Factory (Simple Factory or Factory Method from Phase 04). The factory takes a string/enum like `"upi"` and returns the correct `PaymentStrategy` instance, so client code never imports concrete strategy classes directly.

**Q: Implement the Strategy pattern from scratch for a discount system with Flat, Percentage, and BOGO (Buy One Get One) discounts applied to a cart total.**
Answer:
```python
from abc import ABC, abstractmethod


class DiscountStrategy(ABC):
    @abstractmethod
    def apply(self, total: float, item_count: int) -> float:
        ...


class FlatDiscount(DiscountStrategy):
    def __init__(self, amount: float) -> None:
        self.amount = amount

    def apply(self, total: float, item_count: int) -> float:
        return max(0.0, total - self.amount)


class PercentageDiscount(DiscountStrategy):
    def __init__(self, percent: float) -> None:
        self.percent = percent

    def apply(self, total: float, item_count: int) -> float:
        return total * (1 - self.percent / 100)


class BuyOneGetOneDiscount(DiscountStrategy):
    def __init__(self, unit_price: float) -> None:
        self.unit_price = unit_price

    def apply(self, total: float, item_count: int) -> float:
        free_items = item_count // 2
        return max(0.0, total - free_items * self.unit_price)


class Cart:
    def __init__(self, total: float, item_count: int, discount: DiscountStrategy) -> None:
        self.total = total
        self.item_count = item_count
        self.discount = discount

    def final_price(self) -> float:
        return self.discount.apply(self.total, self.item_count)


cart = Cart(total=500.0, item_count=4, discount=PercentageDiscount(10))
print(cart.final_price())  # 450.0
```

**Q: Can Strategy be implemented without classes, using plain functions?**
Answer: Yes — in Python, functions are first-class objects, so a "strategy" can just be a function (or a lambda) with a matching signature stored in a variable or dict: `strategies = {"upi": pay_upi, "wallet": pay_wallet}`. Classes are preferable when the strategy needs to hold state (like `WalletPayment.balance` above) or a multi-method interface; a bare function is enough for simple, stateless, single-method behavior.

**Q: What design principle does Strategy directly demonstrate?**
Answer: "Favor composition over inheritance" and the Open/Closed Principle. Instead of subclassing `Checkout` for every payment type (inheritance explosion), `Checkout` composes a `PaymentStrategy` object and delegates — behavior is injected, not inherited.
