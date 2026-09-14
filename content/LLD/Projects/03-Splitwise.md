# Project 3 — Splitwise (Expense Sharing)

**Difficulty:** Hard
**Patterns used:** Strategy (split types), Greedy debt-simplification algorithm

---

## 1. Requirements

**Functional:**
- Users can belong to `Group`s (e.g., "Goa Trip").
- Any user can add an `Expense` paid by one user and split among a subset of users using one of three strategies:
  - **Equal** — split evenly among participants.
  - **Exact** — payer specifies exact amounts per participant (must sum to the total).
  - **Percent** — payer specifies percentages per participant (must sum to 100).
- The system tracks pairwise net balances between all users ("who owes whom how much").
- The system can **simplify debts** across a group — minimize the number of transactions needed to settle everyone up, using a greedy min-cash-flow approach.

**Non-functional:**
- New split types should be addable without modifying `Expense` or `ExpenseManager`.
- Balance calculation should be exact to 2 decimal places (no floating point drift causing $0.001 discrepancies).

---

## 2. Class Diagram

```
┌───────────┐          ┌───────────┐
│    User    │──1..*───▶│   Group    │
│───────────│  member  │───────────│
│ user_id    │◀─────────│ members    │
│ name       │          │ expenses   │
└───────────┘          └─────┬─────┘
                              │ 1..*
                              ▼
                     ┌──────────────────┐
                     │     Expense       │
                     │──────────────────│
                     │ paid_by: User      │
                     │ amount             │
                     │ participants       │
                     │ split_strategy    │────────┐
                     └──────────────────┘         ▼
                                          ┌──────────────────────┐
                                          │  «interface» Split    │
                                          │──────────────────────│
                                          │ + compute_shares()    │
                                          └──────────┬───────────┘
                                       ┌──────────────┼──────────────┐
                                       ▼              ▼              ▼
                              ┌─────────────┐ ┌──────────────┐ ┌───────────────┐
                              │ EqualSplit  │ │ ExactSplit   │ │ PercentSplit   │
                              └─────────────┘ └──────────────┘ └───────────────┘

                     ┌────────────────────────┐
                     │    ExpenseManager        │
                     │────────────────────────│
                     │ - balances: Dict[pair]   │
                     │────────────────────────│
                     │ + add_expense()          │
                     │ + get_balances()         │
                     │ + simplify_debts()        │
                     └────────────────────────┘
```

---

## 3. Full Implementation

```python
"""
Splitwise — single-file runnable LLD reference implementation.
"""

from __future__ import annotations

import heapq
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

CENTS = 100  # work in integer cents internally to avoid float drift


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class User:
    user_id: str
    name: str

    def __repr__(self) -> str:
        return self.name


class Group:
    def __init__(self, name: str, members: List[User]):
        self.name = name
        self.members = members
        self.expenses: List["Expense"] = []


# ---------------------------------------------------------------------------
# Strategy: how an expense's total is divided among participants
# ---------------------------------------------------------------------------

class Split(ABC):
    """Returns {user: amount_owed_in_cents} for the participants, summing to total_cents."""

    @abstractmethod
    def compute_shares(
        self, total_cents: int, participants: List[User], **kwargs
    ) -> Dict[User, int]:
        ...


class EqualSplit(Split):
    def compute_shares(self, total_cents: int, participants: List[User], **kwargs) -> Dict[User, int]:
        n = len(participants)
        base = total_cents // n
        remainder = total_cents - base * n
        shares = {u: base for u in participants}
        # distribute the leftover cents (from integer division) one at a time
        for u in participants[:remainder]:
            shares[u] += 1
        return shares


class ExactSplit(Split):
    def compute_shares(
        self, total_cents: int, participants: List[User], amounts_cents: Dict[User, int], **kwargs
    ) -> Dict[User, int]:
        if sum(amounts_cents.values()) != total_cents:
            raise ValueError("Exact split amounts must sum to the total expense")
        return dict(amounts_cents)


class PercentSplit(Split):
    def compute_shares(
        self, total_cents: int, participants: List[User], percentages: Dict[User, float], **kwargs
    ) -> Dict[User, int]:
        if abs(sum(percentages.values()) - 100.0) > 1e-6:
            raise ValueError("Percentages must sum to 100")
        shares = {u: round(total_cents * pct / 100.0) for u, pct in percentages.items()}
        # correct rounding drift by adjusting the largest share
        drift = total_cents - sum(shares.values())
        if drift != 0:
            biggest = max(shares, key=lambda u: shares[u])
            shares[biggest] += drift
        return shares


# ---------------------------------------------------------------------------
# Expense
# ---------------------------------------------------------------------------

@dataclass
class Expense:
    paid_by: User
    amount_cents: int
    participants: List[User]
    split_strategy: Split
    split_kwargs: dict = field(default_factory=dict)

    def shares(self) -> Dict[User, int]:
        return self.split_strategy.compute_shares(
            self.amount_cents, self.participants, **self.split_kwargs
        )


# ---------------------------------------------------------------------------
# ExpenseManager: tracks pairwise balances and simplifies debts
# ---------------------------------------------------------------------------

class ExpenseManager:
    def __init__(self):
        # balances[a][b] = cents that b owes a (positive means b owes a)
        self.balances: Dict[User, Dict[User, int]] = {}

    def _adjust(self, creditor: User, debtor: User, cents: int) -> None:
        if cents == 0 or creditor == debtor:
            return
        self.balances.setdefault(creditor, {}).setdefault(debtor, 0)
        self.balances.setdefault(debtor, {}).setdefault(creditor, 0)
        self.balances[creditor][debtor] += cents
        self.balances[debtor][creditor] -= cents

    def add_expense(self, expense: Expense) -> None:
        shares = expense.shares()
        for participant, owed_cents in shares.items():
            if participant == expense.paid_by:
                continue
            # participant owes paid_by their share
            self._adjust(creditor=expense.paid_by, debtor=participant, cents=owed_cents)

    def net_balances(self) -> Dict[User, int]:
        """Positive = this user is owed money overall; negative = this user owes money."""
        net: Dict[User, int] = {}
        for creditor, debtors in self.balances.items():
            net[creditor] = net.get(creditor, 0) + sum(debtors.values())
        return net

    def print_pairwise_balances(self) -> None:
        seen: set = set()
        for a, debtors in self.balances.items():
            for b, cents in debtors.items():
                pair = frozenset((a, b))
                if pair in seen or cents == 0:
                    continue
                seen.add(pair)
                if cents > 0:
                    print(f"  {b} owes {a}: ${cents / CENTS:.2f}")
                else:
                    print(f"  {a} owes {b}: ${-cents / CENTS:.2f}")

    def simplify_debts(self) -> List[Tuple[User, User, int]]:
        """
        Greedy min-cash-flow settlement: repeatedly match the biggest debtor
        with the biggest creditor until everyone nets to zero.
        Returns a list of (payer, receiver, amount_cents) transactions.
        """
        net = {u: bal for u, bal in self.net_balances().items() if bal != 0}

        creditors = [(-bal, u) for u, bal in net.items() if bal > 0]  # max-heap via negation
        debtors = [(bal, u) for u, bal in net.items() if bal < 0]     # min-heap (most negative first)
        heapq.heapify(creditors)
        heapq.heapify(debtors)

        transactions: List[Tuple[User, User, int]] = []

        while creditors and debtors:
            neg_credit, creditor = heapq.heappop(creditors)
            debt, debtor = heapq.heappop(debtors)
            credit = -neg_credit
            owe = -debt

            settled = min(credit, owe)
            transactions.append((debtor, creditor, settled))

            remaining_credit = credit - settled
            remaining_debt = owe - settled

            if remaining_credit > 0:
                heapq.heappush(creditors, (-remaining_credit, creditor))
            if remaining_debt > 0:
                heapq.heappush(debtors, (-remaining_debt, debtor))

        return transactions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def dollars_to_cents(amount: float) -> int:
    return round(amount * CENTS)


if __name__ == "__main__":
    alice = User("u1", "Alice")
    bob = User("u2", "Bob")
    carol = User("u3", "Carol")
    dave = User("u4", "Dave")

    trip = Group("Goa Trip", [alice, bob, carol, dave])
    manager = ExpenseManager()

    # 1. Alice pays $400 for the hotel, split equally among all 4
    e1 = Expense(
        paid_by=alice,
        amount_cents=dollars_to_cents(400.00),
        participants=[alice, bob, carol, dave],
        split_strategy=EqualSplit(),
    )
    manager.add_expense(e1)

    # 2. Bob pays $150 for dinner, split exactly (Bob 50, Carol 60, Dave 40)
    e2 = Expense(
        paid_by=bob,
        amount_cents=dollars_to_cents(150.00),
        participants=[bob, carol, dave],
        split_strategy=ExactSplit(),
        split_kwargs={"amounts_cents": {
            bob: dollars_to_cents(50.00),
            carol: dollars_to_cents(60.00),
            dave: dollars_to_cents(40.00),
        }},
    )
    manager.add_expense(e2)

    # 3. Carol pays $100 for cab rides, split by percent (Alice 20%, Bob 30%, Carol 50%)
    e3 = Expense(
        paid_by=carol,
        amount_cents=dollars_to_cents(100.00),
        participants=[alice, bob, carol],
        split_strategy=PercentSplit(),
        split_kwargs={"percentages": {alice: 20.0, bob: 30.0, carol: 50.0}},
    )
    manager.add_expense(e3)

    print("Pairwise balances after all expenses:")
    manager.print_pairwise_balances()

    print("\nNet balance per user (+ means owed money, - means owes money):")
    for user, cents in manager.net_balances().items():
        print(f"  {user}: {'+' if cents >= 0 else '-'}${abs(cents) / CENTS:.2f}")

    print("\nSimplified settlement plan:")
    for payer, receiver, cents in manager.simplify_debts():
        print(f"  {payer} pays {receiver}: ${cents / CENTS:.2f}")
```

**Expected output:**

```
Pairwise balances after all expenses:
  Bob owes Alice: $100.00
  Carol owes Alice: $80.00
  Dave owes Alice: $100.00
  Carol owes Bob: $30.00
  Dave owes Bob: $40.00

Net balance per user (+ means owed money, - means owes money):
  Alice: +$280.00
  Bob: -$30.00
  Carol: -$110.00
  Dave: -$140.00

Simplified settlement plan:
  Dave pays Alice: $140.00
  Carol pays Alice: $110.00
  Bob pays Alice: $30.00
```

Note: `Carol owes Bob $60` (from the dinner expense) nets against `Bob owes Carol $30` (from the cab expense) into a single pairwise balance of `Carol owes Bob $30`, since `_adjust` accumulates directly into the same `balances[creditor][debtor]` cell every time the same pair appears.

---

## 4. Design Decisions

- **Strategy pattern for splits:** `Split` is an ABC with `EqualSplit`/`ExactSplit`/`PercentSplit` implementations. `Expense` holds a reference to whichever strategy was chosen plus its kwargs — adding a new split type (e.g., `SharesSplit` where users specify weighted shares like 1:2:3) means writing one new class, touching nothing else.
- **Integer cents instead of floats:** All money math happens in cents (`dollars_to_cents`) to avoid classic floating-point drift (`0.1 + 0.2 != 0.3`) that would otherwise cause balances to be off by fractions of a cent after many expenses. `EqualSplit` and `PercentSplit` explicitly redistribute rounding remainders so the shares always sum exactly to the total.
- **Pairwise ledger, not per-expense history, drives balances:** `ExpenseManager.balances` is a running net between every pair of users (`balances[a][b]` = what b owes a), updated incrementally per expense. This makes "how much do Alice and Bob owe each other right now" an O(1) lookup instead of replaying all expenses.
- **Greedy min-cash-flow for simplification:** Using two heaps (largest creditor, largest debtor) and repeatedly settling the smaller of the two is a standard greedy approach that minimizes the number of transactions needed to zero out a group's balances — this is the same idea Splitwise's real "settle up" feature uses. It's O(n log n) for n users with a debt, versus O(n) minimum-possible transactions in the typical case.

---

## 5. Possible Extensions

- **Group-scoped balances:** Currently balances are global per user pair; a real app tracks balances *per group* (you might owe Bob $10 in "Goa Trip" but be owed $10 by Bob in "Roommates") — this only needs `balances` keyed by `(group_id, user_pair)`.
- **Partial settlements / payment integration:** Add a `Settlement` entity representing a real payment (e.g., via a payment gateway) that reduces a pairwise balance without going through `add_expense`.
- **Expense edits/deletes:** Support reversing an expense's effect on balances (subtract the same shares that were originally added) rather than only ever adding.
- **Notifications:** Emit an event/callback whenever a user's balance changes so a notification service can alert them ("Alice added an expense you owe $25 for").
