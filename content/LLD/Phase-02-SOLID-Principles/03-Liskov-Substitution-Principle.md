# Liskov Substitution Principle (LSP) — Complete Guide

## Table of Contents
1. [What is LSP?](#1-what-is-lsp)
2. [The Bad Example — A FixedDeposit That Breaks Substitutability](#2-the-bad-example--a-fixeddeposit-that-breaks-substitutability)
3. [The Good Example — Redesigning the Hierarchy](#3-the-good-example--redesigning-the-hierarchy)
4. [The Classic Rectangle/Square Trap](#4-the-classic-rectanglesquare-trap)
5. [Why This Matters in Practice](#5-why-this-matters-in-practice)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Interview-Style Exercise](#7-interview-style-exercise)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is LSP?

> **Objects of a superclass should be replaceable with objects of a subclass without breaking the correctness of the program.**

If `Bird` has a `fly()` method, and `Penguin extends Bird`, then any code written against `Bird` must keep working correctly when handed a `Penguin` — no surprise exceptions, no silently wrong behavior, no narrower preconditions or weaker guarantees than the base type promised.

```
┌───────────────────────────────────────────────────────────┐
│  LSP in one picture                                         │
│                                                              │
│  function process(account: BankAccount):                    │
│      account.withdraw(100)                                  │
│                                                              │
│  process(SavingsAccount())     ✅ works as expected          │
│  process(FixedDepositAccount())  ❌ throws / behaves         │
│                                     differently → LSP        │
│                                     VIOLATION                │
└───────────────────────────────────────────────────────────┘
```

LSP is really about **behavioral contracts**, not just method signatures. A subclass must honor:
- **Preconditions cannot be strengthened** (don't demand more than the base type required).
- **Postconditions cannot be weakened** (don't deliver less than the base type promised).
- **No new exceptions** that callers of the base type aren't prepared for.

---

## 2. The Bad Example — A FixedDepositAccount That Breaks Substitutability

```python
class BankAccount:
    """Base contract: any BankAccount can be deposited into and withdrawn from."""

    def __init__(self, balance: float = 0.0):
        self.balance = balance

    def deposit(self, amount: float) -> None:
        self.balance += amount

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount


class SavingsAccount(BankAccount):
    """Fine — behaves exactly like the base contract promises."""
    pass


class FixedDepositAccount(BankAccount):
    """
    Smell: a fixed deposit cannot be withdrawn from before maturity.
    This subclass NARROWS what the base type promised (any BankAccount
    supports withdraw()) by always throwing — it strengthens the
    precondition in a way callers of BankAccount never expect.
    """

    def withdraw(self, amount: float) -> None:
        raise NotImplementedError("Cannot withdraw from a Fixed Deposit before maturity")


def process_monthly_withdrawal(account: BankAccount, amount: float) -> None:
    """Written entirely against the BankAccount contract."""
    account.withdraw(amount)
    print(f"Withdrew {amount}. New balance: {account.balance}")


accounts = [SavingsAccount(1000), FixedDepositAccount(5000)]
for acc in accounts:
    process_monthly_withdrawal(acc, 100)  # 💥 crashes on FixedDepositAccount
```

### What Breaks / Why It's a Smell

| Problem | Consequence |
|---------|-------------|
| `FixedDepositAccount` is-a `BankAccount` in name, but not in behavior | Any generic code written against `BankAccount` can crash unpredictably |
| Callers must special-case `isinstance(account, FixedDepositAccount)` | Defeats the entire purpose of polymorphism |
| The inheritance relationship models a taxonomy ("FD is a kind of account"), not a behavioral contract | Classic real-world modeling mistake — LSP cares about behavior, not category |
| Adding more "account types with restrictions" multiplies special cases at every call site | Violation compounds across the codebase |

---

## 3. The Good Example — Redesigning the Hierarchy

The fix is to **model the actual capabilities honestly** — split the contract so that "withdrawable" is a separate, opt-in capability rather than something forced on every account type.

```python
from abc import ABC, abstractmethod


class Account(ABC):
    """Every account can be deposited into and can report its balance."""

    def __init__(self, balance: float = 0.0):
        self.balance = balance

    def deposit(self, amount: float) -> None:
        self.balance += amount

    @abstractmethod
    def get_balance(self) -> float:
        raise NotImplementedError


class Withdrawable(ABC):
    """A separate capability — only accounts that truly support this implement it."""

    @abstractmethod
    def withdraw(self, amount: float) -> None:
        raise NotImplementedError


class SavingsAccount(Account, Withdrawable):
    def get_balance(self) -> float:
        return self.balance

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount


class FixedDepositAccount(Account):
    """
    Does NOT implement Withdrawable — it honestly represents that
    withdrawal isn't part of its contract, instead of lying about
    it and throwing at runtime.
    """

    def __init__(self, balance: float, maturity_months: int):
        super().__init__(balance)
        self.maturity_months = maturity_months

    def get_balance(self) -> float:
        return self.balance

    def mature_and_withdraw(self) -> float:
        """FD has its own, distinct operation instead of a fake withdraw()."""
        amount = self.balance
        self.balance = 0
        return amount


def process_monthly_withdrawal(account: Withdrawable, amount: float) -> None:
    """Now the type signature itself guarantees withdraw() is safe to call."""
    account.withdraw(amount)
    print(f"Withdrew {amount}. New balance: {account.get_balance()}")


savings = SavingsAccount(1000)
fd = FixedDepositAccount(5000, maturity_months=12)

process_monthly_withdrawal(savings, 100)  # ✅ works
# process_monthly_withdrawal(fd, 100)     # ❌ caught at TYPE-CHECK time, not runtime —
#                                              FixedDepositAccount isn't a Withdrawable
print(fd.mature_and_withdraw())  # ✅ FD has its own correct operation: 5000
```

### Why This Is Better

- `Withdrawable` is a promise that's *always kept* by every class that implements it — no more runtime surprises.
- A type checker (mypy) would flag `process_monthly_withdrawal(fd, 100)` as a type error *before* the code ever runs, instead of crashing in production.
- `FixedDepositAccount` isn't forced to fake a behavior it doesn't have — it exposes the operation it actually supports (`mature_and_withdraw`).

---

## 4. The Classic Rectangle/Square Trap

This is the single most common LSP interview example — worth memorizing cold.

```python
class Rectangle:
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def set_width(self, width: float) -> None:
        self.width = width

    def set_height(self, height: float) -> None:
        self.height = height

    def area(self) -> float:
        return self.width * self.height


class Square(Rectangle):
    """
    Smell: mathematically a square IS a rectangle, but behaviorally
    forcing width == height breaks any code that treats width and
    height as independently settable — which the Rectangle contract
    implies they are.
    """

    def set_width(self, width: float) -> None:
        self.width = width
        self.height = width  # unexpected side effect!

    def set_height(self, height: float) -> None:
        self.width = height
        self.height = height  # unexpected side effect!


def resize_and_check(rect: Rectangle) -> None:
    rect.set_width(5)
    rect.set_height(4)
    assert rect.area() == 20, f"Expected 20, got {rect.area()}"  # holds for Rectangle


resize_and_check(Rectangle(1, 1))  # ✅ passes
resize_and_check(Square(1, 1))     # 💥 AssertionError: got 16, not 20
```

**The fix:** don't model `Square` as a subclass of a mutable `Rectangle`. Use a common `Shape` abstraction with an `area()` method, and let `Rectangle` and `Square` be siblings, each independently correct:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        raise NotImplementedError


class Rectangle(Shape):
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height


class Square(Shape):
    def __init__(self, side: float):
        self.side = side

    def area(self) -> float:
        return self.side * self.side
```

---

## 5. Why This Matters in Practice

```
Inheritance modeled on TAXONOMY (real world "is-a"):
   FixedDeposit "is a kind of" BankAccount   →  tempting, but WRONG basis

Inheritance modeled on BEHAVIOR (LSP-correct):
   FixedDeposit implements only what it can honestly guarantee
   → correct basis for inheritance/interface design
```

LSP violations are dangerous because they're often invisible at compile time in dynamically typed Python — they surface as a runtime `NotImplementedError` or silently wrong data deep in production, often nowhere near the buggy subclass. This is why LSP interview questions almost always involve spotting a subclass that "can't fully do what the base class promises."

---

## 6. Common Misconceptions

- **"LSP is about method signatures matching."** That's necessary but not sufficient — LSP is fundamentally about behavioral guarantees (pre/postconditions), not just matching type signatures.
- **"If it type-checks, it satisfies LSP."** `FixedDepositAccount.withdraw()` could type-check perfectly (same signature as the base) while still violating LSP by always raising.
- **"Real-world 'is-a' relationships always make good class hierarchies."** The Square/Rectangle and FD/BankAccount examples show that biological/mathematical "is-a" doesn't guarantee behavioral substitutability — model hierarchies on behavior, not taxonomy.

---

## 7. Interview-Style Exercise

**Prompt:** "This `Bird` hierarchy breaks when we add `Penguin`. Refactor it to follow LSP."

```python
class Bird:
    def fly(self) -> str:
        return "Flying high!"


class Sparrow(Bird):
    pass


class Penguin(Bird):
    def fly(self) -> str:
        raise NotImplementedError("Penguins can't fly!")


def make_it_fly(bird: Bird) -> None:
    print(bird.fly())


for b in [Sparrow(), Penguin()]:
    make_it_fly(b)  # 💥 crashes on Penguin
```

**Refactored Answer:**

```python
from abc import ABC, abstractmethod


class Bird(ABC):
    @abstractmethod
    def move(self) -> str:
        raise NotImplementedError


class FlyingBird(Bird):
    def move(self) -> str:
        return self.fly()

    def fly(self) -> str:
        return "Flying high!"


class SwimmingBird(Bird):
    def move(self) -> str:
        return self.swim()

    def swim(self) -> str:
        return "Swimming fast!"


class Sparrow(FlyingBird):
    pass


class Penguin(SwimmingBird):
    pass


def make_it_move(bird: Bird) -> None:
    print(bird.move())


for b in [Sparrow(), Penguin()]:
    make_it_move(b)  # ✅ both work correctly, each with real behavior
```

Say out loud in the interview: "the bug was modeling `fly()` as something every `Bird` must support. I replaced it with `move()`, a behavior every bird genuinely has, and pushed `fly`/`swim` down into capability-specific subclasses — this way every concrete `Bird` fully honors the base contract."

---

## 8. Interview Q&A

**Q: What is the Liskov Substitution Principle?**
Answer: LSP states that objects of a base type should be replaceable with objects of any derived type without altering the correctness of the program. In practice, a subclass must honor the base class's contract fully — it can't strengthen preconditions, weaken postconditions, or throw new exceptions that callers of the base type don't expect. It's fundamentally about behavioral compatibility, not just matching method signatures.

**Q: Give a real-world example of an LSP violation.**
Answer: A `FixedDepositAccount` that extends `BankAccount` but throws `NotImplementedError` on `withdraw()` because deposits are locked until maturity. Any code written generically against `BankAccount` (e.g., a monthly withdrawal batch job) will crash when it receives a `FixedDepositAccount`, even though type-wise it "is a" `BankAccount`. The fix is to only include `withdraw()` in a `Withdrawable` interface that `FixedDepositAccount` doesn't implement, and give it its own honest operation instead.

**Q: What is the Rectangle/Square problem and why does it violate LSP?**
Answer: Making `Square` a subclass of `Rectangle` (or vice versa) breaks LSP because setting the width or height independently is part of `Rectangle`'s implied contract, but a `Square` must keep both equal — so `set_width` on a `Square` has an unexpected side effect on `height`. Code that relies on independently setting width/height (a very reasonable assumption for a `Rectangle`) produces wrong results when handed a `Square`. The fix is to make both siblings under a common `Shape` abstraction instead of one inheriting from the other.

**Q: How can you detect an LSP violation in a code review?**
Answer: Look for subclasses that override a method to throw an exception, return a sentinel/no-op instead of doing real work, or narrow the range of accepted inputs compared to the base class. Also watch for client code that does `isinstance` checks before calling a method on an object typed as the base class — that's a strong sign the subclass can't be trusted to behave like its parent.

**Q: How is LSP different from just "does it type-check"?**
Answer: Type-checking only verifies method signatures match — it says nothing about behavior. A subclass method can have an identical signature to the parent's and still violate LSP by changing what the method actually guarantees (e.g., always raising, returning stale data, or silently doing nothing). LSP is a semantic/contractual guarantee, which is why unit tests written against the base class's contract, run against every subclass, are a good way to catch violations in practice.

**Q: How does LSP influence how you should design inheritance hierarchies in general?**
Answer: It pushes you to base inheritance on shared *behavior*, not shared *category* or taxonomy. Before making `B` extend `A`, ask "can `B` fully honor every guarantee `A` makes, in every method, with no surprises?" If the answer is no for even one method, prefer composition, a narrower interface, or a sibling relationship under a common abstraction instead of forcing an inheritance relationship that will eventually break substitutability.
