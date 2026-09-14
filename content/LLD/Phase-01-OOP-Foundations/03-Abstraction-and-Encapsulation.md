# Abstraction and Encapsulation — Complete Guide

## Table of Contents
1. [Two Different Ideas Often Confused](#1-two-different-ideas-often-confused)
2. [Abstraction: Hiding "How", Exposing "What"](#2-abstraction-hiding-how-exposing-what)
3. [Encapsulation: Protecting Internal State](#3-encapsulation-protecting-internal-state)
4. [Real-World Example: A BankAccount](#4-real-world-example-a-bankaccount)
5. [Real-World Example: A PaymentProcessor Abstraction](#5-real-world-example-a-paymentprocessor-abstraction)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Two Different Ideas Often Confused

- **Abstraction** = hiding *complexity* behind a simple interface. Callers know *what* an object can do, not *how* it does it.
- **Encapsulation** = hiding *internal state* and controlling access to it, so an object's invariants can't be violated from outside.

```
Abstraction (interface hides implementation):

   Caller ──▶ processor.pay(amount)  ──▶  [complex charging logic hidden inside]

Encapsulation (object protects its own state):

   ┌─────────────────────────┐
   │ BankAccount              │
   │  - __balance (private)   │  ← caller cannot do account.__balance = -999999
   │  + deposit(amount)       │  ← only sanctioned way to change balance
   │  + withdraw(amount)      │
   └─────────────────────────┘
```

They're complementary: abstraction is about the *interface* a class exposes; encapsulation is about *protecting* what's behind that interface.

---

## 2. Abstraction: Hiding "How", Exposing "What"

Python provides `abc.ABC` and `@abstractmethod` to define abstractions formally — a base class that declares *what* subclasses must do, without saying *how*.

### Bad Example — No Abstraction, Caller Must Know Every Concrete Type

```python
def checkout(payment_type: str, amount: float) -> str:
    if payment_type == "credit_card":
        # ... credit card charging logic inline ...
        return f"Charged ${amount} to credit card"
    elif payment_type == "upi":
        # ... UPI logic inline ...
        return f"Paid ${amount} via UPI"
    elif payment_type == "wallet":
        # ... wallet logic inline ...
        return f"Debited ${amount} from wallet"
    else:
        raise ValueError(f"Unknown payment type: {payment_type}")
```

Every new payment method means editing `checkout()` and adding another `elif` branch. The caller has to pass a magic string, and all the "how" logic is tangled together in one function with no clear boundary.

### Good Example — Abstraction via an Abstract Base Class

```python
from abc import ABC, abstractmethod


class PaymentMethod(ABC):
    @abstractmethod
    def pay(self, amount: float) -> str:
        """Charge the given amount using this payment method."""


class CreditCardPayment(PaymentMethod):
    def pay(self, amount: float) -> str:
        return f"Charged ${amount} to credit card"


class UpiPayment(PaymentMethod):
    def pay(self, amount: float) -> str:
        return f"Paid ${amount} via UPI"


def checkout(method: PaymentMethod, amount: float) -> str:
    return method.pay(amount)  # caller only knows the abstraction, not the details


print(checkout(CreditCardPayment(), 500))  # Charged $500 to credit card
print(checkout(UpiPayment(), 200))         # Paid $200 via UPI

PaymentMethod()  # TypeError: Can't instantiate abstract class PaymentMethod
                 # with abstract method pay
```

`checkout()` depends only on the `PaymentMethod` abstraction. Adding `WalletPayment` requires zero changes to `checkout()`. Python also actively prevents instantiating `PaymentMethod` directly, or any subclass that forgets to implement `pay()` — enforcing the abstraction at runtime.

---

## 3. Encapsulation: Protecting Internal State

Python has no true "private" keyword, but uses naming conventions the whole ecosystem respects:

| Prefix | Convention | Meaning |
|--------|-----------|---------|
| `name` | public | Freely accessible from anywhere |
| `_name` | protected (convention only) | "Internal use — don't touch from outside," but nothing enforces it |
| `__name` | name-mangled | Python rewrites it to `_ClassName__name`, making accidental external access & subclass clashes unlikely |

```python
class Example:
    def __init__(self) -> None:
        self.public = 1
        self._protected = 2
        self.__private = 3


e = Example()
print(e.public)        # 1 — fine
print(e._protected)    # 2 — works, but violates convention; a linter/reviewer would flag it
print(e.__private)     # AttributeError
print(e._Example__private)  # 3 — name mangling makes it awkward, not impossible
```

Name mangling isn't unbreakable security — it's a strong social signal ("don't touch this") plus a practical safeguard against accidental attribute clashes in subclasses.

---

## 4. Real-World Example: A BankAccount

### Bad Example — No Encapsulation

```python
class BankAccount:
    def __init__(self, owner: str, balance: float) -> None:
        self.owner = owner
        self.balance = balance


acc = BankAccount("Asha", 1000)
acc.balance = -5000       # nothing stops this — balance is just a public attribute
acc.balance += 999999999  # nothing validates this either
print(acc.balance)        # 999994999 — nonsensical, but Python allowed it
```

Any code anywhere in the program can set `balance` to anything, bypassing all business rules (no negative balances, no unchecked massive credits).

### Good Example — Encapsulation via Private State + Controlled Access

```python
class BankAccount:
    def __init__(self, owner: str, balance: float = 0.0) -> None:
        self.owner = owner
        self.__balance = balance  # name-mangled: BankAccount__balance

    @property
    def balance(self) -> float:
        return self.__balance

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")
        self.__balance += amount

    def withdraw(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive")
        if amount > self.__balance:
            raise ValueError("Insufficient funds")
        self.__balance -= amount


acc = BankAccount("Asha", 1000)
acc.deposit(500)
print(acc.balance)  # 1500

acc.withdraw(10000)  # ValueError: Insufficient funds

acc.balance = 999999999  # AttributeError: can't set attribute
                          # ('balance' has no setter — read-only from outside)
```

Now `__balance` can only change through `deposit()` and `withdraw()`, both of which enforce business rules. The `@property` exposes a read-only view for callers who just want to *see* the balance. (Full `@property`/`@x.setter` mechanics are covered in Lesson 07.)

---

## 5. Real-World Example: A PaymentProcessor Abstraction

Combining abstraction (a common interface) and encapsulation (protected internal state) is exactly what a well-designed `PaymentProcessor` in an LLD interview looks like:

```python
from abc import ABC, abstractmethod


class PaymentProcessor(ABC):
    """Abstraction: callers only interact with process_payment()."""

    def __init__(self, merchant_id: str) -> None:
        self._merchant_id = merchant_id      # protected: subclasses may use it
        self.__transaction_count = 0         # private: only this class touches it

    def process_payment(self, amount: float) -> str:
        if amount <= 0:
            raise ValueError("Amount must be positive")
        result = self._charge(amount)        # delegate the "how" to subclasses
        self.__transaction_count += 1
        return result

    @property
    def transaction_count(self) -> int:
        return self.__transaction_count

    @abstractmethod
    def _charge(self, amount: float) -> str:
        """Subclasses implement the actual charging mechanism."""


class StripeProcessor(PaymentProcessor):
    def _charge(self, amount: float) -> str:
        return f"[Stripe:{self._merchant_id}] charged ${amount}"


class RazorpayProcessor(PaymentProcessor):
    def _charge(self, amount: float) -> str:
        return f"[Razorpay:{self._merchant_id}] charged ${amount}"


processor: PaymentProcessor = StripeProcessor(merchant_id="M-001")
print(processor.process_payment(250))  # [Stripe:M-001] charged $250
print(processor.process_payment(100))  # [Stripe:M-001] charged $100
print(processor.transaction_count)     # 2

processor.__transaction_count = 999    # creates a NEW unrelated public attribute,
                                        # does NOT touch the real mangled private one
print(processor.transaction_count)     # still 2 — internal state stayed protected
```

Callers only ever call `process_payment(amount)` — the abstraction. They can read `transaction_count` but cannot corrupt it directly — the encapsulation. Each concrete processor only implements `_charge`, the one truly varying piece — polymorphism handling the rest, as covered in Lesson 02.

---

## 6. Hands-On Exercises

**Exercise 1:** Build a `Shape` abstract base class with an abstract `area()` method and a concrete `describe()` method that calls `self.area()`. Implement `Circle` and `Square`. Confirm you cannot instantiate `Shape` directly.

**Exercise 2:** Add a private `__id` counter to a `Ticket` class (auto-incrementing, unique per ticket) with a read-only `id` property. Prove that external code cannot directly reassign `ticket.id`.

**Exercise 3:** Design a `NotificationService` abstraction with `send(message: str)`, and two implementations `EmailService`/`SmsService`, each encapsulating provider-specific details (e.g., an API key stored as `__api_key`, never exposed).

**Exercise 4:** Take the `BankAccount` from Section 4 and add a `transaction_history` feature: a private `__history: list[str]` that records every deposit/withdrawal, exposed only via a read-only property that returns a *copy* of the list (not the original) — explain why returning a copy matters for encapsulation.

---

## 7. Interview Q&A

**Q: What is the difference between abstraction and encapsulation?**
Answer: Abstraction is about exposing a simple, well-defined interface while hiding the complexity of *how* something is implemented — e.g., calling `processor.pay(amount)` without knowing the charging logic behind it. Encapsulation is about protecting an object's internal *state* so it can only be changed through controlled, validated methods — e.g., a bank account's balance can only change via `deposit()`/`withdraw()`, never by direct assignment. Abstraction concerns the interface; encapsulation concerns the data behind it.

**Q: How do you achieve abstraction in Python, given there's no `interface` keyword like Java?**
Answer: Python uses `abc.ABC` as a base class and `@abstractmethod` to mark methods that subclasses must implement. Attempting to instantiate the abstract class directly, or a subclass that hasn't implemented every abstract method, raises a `TypeError` at instantiation time. This gives you compile-time-like guarantees (checked at instantiation) that concrete subclasses honor the contract the abstraction defines.

**Q: Does Python have real private variables?**
Answer: Not in the sense of enforced access control like Java's `private` keyword. Python uses naming conventions: a single underscore (`_name`) signals "internal use, don't touch" but is not enforced; a double underscore (`__name`) triggers name mangling, rewriting the attribute to `_ClassName__name`, which makes accidental external access or subclass attribute clashes unlikely but not impossible. Python's philosophy is "we're all consenting adults here" — privacy is convention-based, not compiler-enforced.

**Q: Why would you make an attribute private and expose it via a read-only `@property` instead of just leaving it public?**
Answer: A public attribute can be set to any value from anywhere in the codebase, bypassing business rules (e.g., setting a bank balance negative). Making it private and exposing a read-only property lets callers *read* the value freely while forcing all *writes* to go through validated methods (like `deposit`/`withdraw`), guaranteeing the object never enters an invalid state. It also gives you a stable public interface — you can change the internal representation later without breaking callers.

**Q: In the PaymentProcessor example, why is `_charge` protected (single underscore) but `__transaction_count` is private (double underscore)?**
Answer: `_charge` is meant to be overridden by subclasses — it's part of the extension contract between the base class and its subclasses, so a single underscore signals "internal, but subclasses should touch this." `__transaction_count` is bookkeeping that belongs entirely to the base class's own implementation and should never be touched or overridden by subclasses or external callers, so name mangling protects it even from accidental subclass attribute collisions.

**Q: Can encapsulation and abstraction exist independently of each other?**
Answer: Yes. You can have abstraction without encapsulation — e.g., an abstract base class whose subclasses expose all their attributes as fully public with no protection. You can also have encapsulation without abstraction — e.g., a single concrete class with private attributes and getter/setter methods, but no shared interface for interchangeable implementations. In practice, well-designed LLD solutions use both together: an abstraction (interface) that concrete classes conform to, each of which encapsulates its own private state.
