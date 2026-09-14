# Splitwise (Expense Splitting) — LLD Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [The Debt Simplification Algorithm](#8-the-debt-simplification-algorithm)
9. [Class Skeletons (Python)](#9-class-skeletons-python)
10. [Interview Follow-ups](#10-interview-follow-ups)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Step 1: Clarify Requirements

**Functional requirements:**
- Users can be grouped (e.g., "Goa Trip", "Flatmates").
- Any user can **add an expense**, specifying who paid and how it should be split among participants.
- Supported split types: **equal**, **exact amounts**, **percentage**.
- Every user has a running **balance** with every other user ("Alice owes Bob $20").
- Support **"simplify debts"** — collapse a group's many pairwise debts into the minimum number of transactions needed to settle everyone up.
- Support **settle up** — record a direct payment between two users that clears (or reduces) their balance.

**Non-functional requirements:**
- Splits must be **exact to the cent** — rounding errors must not make the sum of splits differ from the total expense amount.
- Balance calculations must be consistent even with concurrent expense additions (out of scope to fully solve, but be ready to discuss).

**Out of scope for v1:** multi-currency expenses, recurring expenses, expense editing/deletion history — state this explicitly.

---

## 2. Step 2: Identify Entities/Classes

| Class | Represents |
|-------|------------|
| `User` | A person using the app |
| `Group` | A named collection of users sharing expenses |
| `Expense` | One recorded expense: amount, payer, participants, split type |
| `Split` (+ subclasses via Strategy) | How much each participant owes for one expense |
| `SplitStrategy` | Algorithm that computes `Split` objects given an `Expense` |
| `ExpenseManager` | Facade: add expense, trigger split calculation, update balances |
| `Balance` / `Ledger` | Pairwise "who owes whom how much" state |

---

## 3. Step 3: Define Relationships

```
Group "1" ── "*" User              (aggregation — users exist independently of any one group)
Group "1" ── "*" Expense           (composition — an expense belongs to exactly one group's context,
                                     though it can also be a non-group 1:1 expense)
Expense "1" ── "1" User            (association — the payer)
Expense "1" ── "*" Split           (composition — splits only make sense as part of their expense)
Expense "1" ── "1" SplitStrategy   (association — delegated computation)
ExpenseManager "1" ── "1" Ledger   (composition — the manager owns the balance sheet)
Ledger "1" ── "*" Balance          (composition — one balance entry per user pair)
```

### ASCII Class Diagram

```
┌──────────────────┐        ┌───────────────────────┐
│       Group          │────────▶│         User             │
├──────────────────┤  *  *  ├───────────────────────┤
│ - id                  │        │ - id                     │
│ - name                │        │ - name                   │
│ - members: [User]     │        └───────────────────────┘
├──────────────────┤
│ + addMember(user)      │
└──────────────────┘

┌───────────────────────┐
│         Expense           │
├───────────────────────┤
│ - id                       │
│ - description               │
│ - amount                    │
│ - paidBy: User               │
│ - participants: [User]      │
│ - splitStrategy: SplitStrategy│
│ - splits: [Split]            │
├───────────────────────┤
│ + calculateSplits()         │
└──────────────┬────────────┘
               │ uses
               ▼
┌───────────────────────┐
│      <<abstract>>          │
│      SplitStrategy          │
├───────────────────────┤
│ + computeSplits(expense,   │
│     participants, meta)     │
│     -> list[Split]           │
└──────────────┬────────────┘
     ┌─────────┼──────────────┐
     ▼         ▼              ▼
┌─────────┐ ┌───────────┐ ┌────────────────┐
│ Equal   │ │ Exact     │ │ Percentage      │
│ Split   │ │ Split     │ │ Split           │
│ Strategy│ │ Strategy  │ │ Strategy        │
└─────────┘ └───────────┘ └────────────────┘

┌───────────────────┐
│        Split          │
├───────────────────┤
│ - user: User           │
│ - amountOwed            │
└───────────────────┘

┌───────────────────────┐        ┌───────────────────────┐
│    ExpenseManager        │───────▶│         Ledger            │
├───────────────────────┤ 1  1   ├───────────────────────┤
│ - ledger: Ledger           │        │ - balances: dict[         │
├───────────────────────┤        │   (User,User), float]     │
│ + addExpense(expense)      │        ├───────────────────────┤
│ + settleUp(payer, payee,    │        │ + updateBalance(a,b,amt)  │
│     amount)                  │        │ + getBalance(a,b)          │
│ + simplifyDebts(group)       │        │ + netBalances() -> dict   │
└───────────────────────┘        └───────────────────────┘
```

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibility (and only this) |
|-------|----------------------------------|
| `User` / `Group` | Identity and membership — no balance logic |
| `Expense` | Own the raw facts of one expense; delegate split computation to its `SplitStrategy` |
| `SplitStrategy` subclasses | Turn (amount, participants, per-strategy metadata) into a list of `Split` |
| `Split` | Immutable value: this user owes this much for this expense |
| `Ledger` | Own the single source of truth for pairwise balances; apply updates atomically |
| `ExpenseManager` | Facade — coordinates `Expense` creation, split calculation, and `Ledger` updates; hosts `simplifyDebts` |

---

## 5. Step 5: Apply SOLID

- **SRP** — `Expense` doesn't know *how* to split, only that it needs to; `Ledger` doesn't know about splits at all, only balance deltas.
- **OCP** — A new split type (e.g., "by shares", like roommates splitting rent by room size) is a new `SplitStrategy` subclass — `Expense` and `ExpenseManager` are untouched.
- **LSP** — Any `SplitStrategy` can replace another; all return `list[Split]` summing to the expense's total amount (this invariant is exactly what you validate in each subclass).
- **ISP** — `ExpenseManager`'s public surface (`addExpense`, `settleUp`, `simplifyDebts`) doesn't leak `Ledger`'s internal dict structure to callers.
- **DIP** — `Expense.calculate_splits()` depends on the `SplitStrategy` interface, not a concrete strategy — the strategy is injected at expense-creation time.

---

## 6. Step 6: Apply Design Patterns

### Strategy Pattern — for split types

This is the canonical Strategy use case: same contract (`compute_splits`), three genuinely different algorithms, chosen at runtime based on user input (equal / exact / percentage radio button in the UI). Compare to the ATM/vending lessons — there the variability was in *state*; here it's purely in *algorithm*, which is why Strategy (not State) is the fit.

```
Client picks split type
        │
        ▼
┌──────────────┐     ┌────────────────────┐
│   Expense     │────▶│  SplitStrategy       │  (interface)
└──────────────┘     └─────────┬──────────┘
                                │
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                   ▼
     EqualSplitStrategy  ExactSplitStrategy  PercentageSplitStrategy
```

### Facade Pattern — `ExpenseManager`

`ExpenseManager` hides the coordination between `Expense` creation, `SplitStrategy` invocation, and `Ledger` updates behind three simple methods. Client code (e.g., an API layer) never touches `Ledger` directly.

### Why not Observer here?

Worth mentioning as a forward-looking extension: if you need to **notify users** when a new expense affects their balance, that's a natural `Observer` — `ExpenseManager` publishes an "expense added" event, and a `NotificationService` subscribes. Not needed for the core design, but a good answer if asked "how would you add notifications?"

---

## 7. Step 7: Explain Extensibility

- **New split type** (by shares/weight): one new `SplitStrategy` subclass.
- **Multi-currency**: `Expense` gains a `currency` field; `Ledger` balances become `dict[(User, User, Currency), float]`, and `simplifyDebts` runs independently per currency.
- **Notifications on new expense**: add an `Observer` hook in `ExpenseManager.addExpense` — no change to `Expense`/`SplitStrategy`.
- **Expense editing**: since `Split` and balance updates are derived from `Expense`, an edit is modeled as "reverse the old splits' effect on `Ledger`, then reapply new splits" — a natural extension of the existing `updateBalance` primitive, not a new mechanism.

---

## 8. The Debt Simplification Algorithm

**Goal:** given a group's net balance per user (positive = is owed money, negative = owes money), produce the **minimum number of transactions** that settles everyone to zero. This is the classic "min cash flow" greedy algorithm.

### Why not just settle every pairwise debt directly?

If Alice owes Bob $10 and Bob owes Charlie $10, settling pairwise requires 2 transactions. But net Alice owes Charlie $10 directly (Bob is net-zero) — 1 transaction. Simplification nets everything down to per-user totals first, then greedily matches the biggest creditor with the biggest debtor.

### Algorithm (pseudocode)

```
function simplifyDebts(balances: dict[User, float]) -> list[(User, User, float)]:
    # balances[user] > 0  => user is owed money (net creditor)
    # balances[user] < 0  => user owes money (net debtor)

    transactions = []
    # Use two heaps (or repeatedly find max/min) for O(n log n)
    creditors = max-heap of (balance, user) where balance > 0
    debtors   = max-heap of (-balance, user) where balance < 0   # store owed amount as positive

    while creditors is not empty and debtors is not empty:
        creditor_amt, creditor = pop max from creditors
        debtor_amt,   debtor   = pop max from debtors

        settled = min(creditor_amt, debtor_amt)
        transactions.append((debtor, creditor, settled))   # debtor pays creditor

        remaining_credit = creditor_amt - settled
        remaining_debt   = debtor_amt - settled

        if remaining_credit > EPSILON:
            push (remaining_credit, creditor) back onto creditors
        if remaining_debt > EPSILON:
            push (remaining_debt, debtor) back onto debtors

    return transactions
```

### Complexity

- Netting balances: O(E) where E = number of expenses/splits contributing.
- Greedy matching with heaps: O(n log n) where n = number of users with non-zero balance.
- This greedy approach is provably optimal in **transaction count is not always strictly minimal** in the mathematical sense (minimum transaction count is actually NP-hard in general), but the greedy max-creditor/max-debtor pairing is the standard, interview-accepted approximation and performs well in practice — mention this nuance if asked to prove optimality.

### Walkthrough Example

```
Net balances: Alice = +40, Bob = -10, Charlie = -30

Step 1: max creditor = Alice (+40), max debtor = Charlie (-30 -> owes 30)
        settle min(40, 30) = 30 -> "Charlie pays Alice $30"
        Alice remaining = +10, Charlie settled (removed)

Step 2: max creditor = Alice (+10), max debtor = Bob (owes 10)
        settle min(10, 10) = 10 -> "Bob pays Alice $10"
        Both settled.

Result: 2 transactions instead of the up-to-3 pairwise debts that
        produced these balances.
```

---

## 9. Class Skeletons (Python)

> Design skeletons — signatures and key logic. Full runnable implementation lives in `LLD/Projects/`.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from collections import defaultdict
import heapq
from uuid import uuid4


# ---------- Domain data ----------

@dataclass(frozen=True)
class User:
    id: str
    name: str


@dataclass
class Group:
    id: str
    name: str
    members: list[User] = field(default_factory=list)

    def add_member(self, user: User) -> None:
        self.members.append(user)


@dataclass(frozen=True)
class Split:
    """Immutable: this user owes this much for one expense."""
    user: User
    amount_owed: float


# ---------- Strategy: split types ----------

class SplitStrategy(ABC):
    @abstractmethod
    def compute_splits(
        self, amount: float, participants: list[User], metadata: dict
    ) -> list[Split]:
        """metadata carries strategy-specific input, e.g. exact amounts or percentages."""
        ...


class EqualSplitStrategy(SplitStrategy):
    def compute_splits(self, amount: float, participants: list[User], metadata: dict) -> list[Split]:
        """Divide evenly; distribute rounding remainder (cents) to the first N participants
        so the splits sum EXACTLY to `amount`.
        """
        n = len(participants)
        base = round(amount / n, 2)
        splits = [Split(u, base) for u in participants]
        remainder = round(amount - base * n, 2)
        # distribute leftover cents deterministically
        cents = int(round(remainder * 100))
        for i in range(abs(cents)):
            u = splits[i].user
            adjust = 0.01 if cents > 0 else -0.01
            splits[i] = Split(u, round(splits[i].amount_owed + adjust, 2))
        return splits


class ExactSplitStrategy(SplitStrategy):
    def compute_splits(self, amount: float, participants: list[User], metadata: dict) -> list[Split]:
        """metadata = {"amounts": {user_id: amount, ...}}. Must sum to `amount` exactly."""
        amounts = metadata["amounts"]
        total = round(sum(amounts.values()), 2)
        if total != round(amount, 2):
            raise ValueError(f"Exact splits ({total}) do not sum to expense amount ({amount})")
        return [Split(u, amounts[u.id]) for u in participants]


class PercentageSplitStrategy(SplitStrategy):
    def compute_splits(self, amount: float, participants: list[User], metadata: dict) -> list[Split]:
        """metadata = {"percentages": {user_id: pct, ...}}. Percentages must sum to 100."""
        percentages = metadata["percentages"]
        if round(sum(percentages.values()), 2) != 100.0:
            raise ValueError("Percentages must sum to 100")
        return [Split(u, round(amount * percentages[u.id] / 100, 2)) for u in participants]


# ---------- Expense ----------

@dataclass
class Expense:
    description: str
    amount: float
    paid_by: User
    participants: list[User]
    split_strategy: SplitStrategy
    metadata: dict = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid4()))
    splits: list[Split] = field(default_factory=list)

    def calculate_splits(self) -> list[Split]:
        self.splits = self.split_strategy.compute_splits(self.amount, self.participants, self.metadata)
        return self.splits


# ---------- Ledger ----------

class Ledger:
    """Single source of truth for pairwise balances. balances[(a, b)] = amount b owes a."""

    def __init__(self):
        self.balances: dict[tuple[str, str], float] = defaultdict(float)

    def update_balance(self, creditor: User, debtor: User, amount: float) -> None:
        """debtor owes creditor `amount` more (can be negative to reduce/settle)."""
        self.balances[(creditor.id, debtor.id)] += amount
        self.balances[(debtor.id, creditor.id)] -= amount

    def get_balance(self, a: User, b: User) -> float:
        """Positive => b owes a."""
        return self.balances.get((a.id, b.id), 0.0)

    def net_balances(self, users: list[User]) -> dict[User, float]:
        """Collapse all pairwise balances into one net figure per user
        (positive = net creditor, negative = net debtor). Feeds simplify_debts.
        """
        net: dict[str, float] = defaultdict(float)
        seen = {u.id: u for u in users}
        for (a_id, b_id), amt in self.balances.items():
            net[a_id] += amt  # amt is what b owes a, i.e. a's net position increases
        return {seen[uid]: round(bal, 2) for uid, bal in net.items() if abs(bal) > 1e-9}


# ---------- ExpenseManager (Facade) ----------

class ExpenseManager:
    def __init__(self):
        self.ledger = Ledger()
        self.expenses: list[Expense] = []

    def add_expense(self, expense: Expense) -> None:
        splits = expense.calculate_splits()
        for split in splits:
            if split.user.id != expense.paid_by.id:
                self.ledger.update_balance(expense.paid_by, split.user, split.amount_owed)
        self.expenses.append(expense)

    def settle_up(self, payer: User, payee: User, amount: float) -> None:
        """payer pays payee `amount`, reducing what payer owes payee."""
        self.ledger.update_balance(payee, payer, -amount)

    def simplify_debts(self, users: list[User]) -> list[tuple[User, User, float]]:
        """Returns list of (debtor, creditor, amount) — minimum-transaction settlement plan."""
        net = self.ledger.net_balances(users)

        creditors = [(-bal, u) for u, bal in net.items() if bal > 0]        # max-heap via negation
        debtors = [(bal, u) for u, bal in net.items() if bal < 0]          # amount owed as positive
        heapq.heapify(creditors)
        heapq.heapify(debtors)

        transactions = []
        while creditors and debtors:
            neg_credit, creditor = heapq.heappop(creditors)
            neg_debt, debtor = heapq.heappop(debtors)
            credit_amt, debt_amt = -neg_credit, -neg_debt

            settled = min(credit_amt, debt_amt)
            transactions.append((debtor, creditor, round(settled, 2)))

            remaining_credit = credit_amt - settled
            remaining_debt = debt_amt - settled
            if remaining_credit > 1e-9:
                heapq.heappush(creditors, (-remaining_credit, creditor))
            if remaining_debt > 1e-9:
                heapq.heappush(debtors, (-remaining_debt, debtor))

        return transactions
```

---

## 10. Interview Follow-ups

**"How do you guarantee splits always sum exactly to the expense amount, given floating-point rounding?"**
`EqualSplitStrategy` computes a base amount then explicitly redistributes the leftover cents to specific participants (see `compute_splits` above) rather than trusting float division to land exactly. `ExactSplitStrategy` and `PercentageSplitStrategy` validate the sum up front and raise before ever touching the `Ledger`. In production, use integer cents (not floats) throughout to sidestep float precision entirely — worth stating even though the skeleton above uses floats for readability.

**"How would you handle a group of 100 people needing debt simplification — does the greedy algorithm scale?"**
Yes — netting is O(E) over expenses, and the heap-based greedy matching is O(n log n) in the number of users with non-zero balance, which easily handles hundreds of users. The bottleneck in practice is `E` (number of expenses), not `n`.

**"What happens if two expenses are added concurrently, both updating the same pair's balance?"**
`Ledger.update_balance` must be atomic (single DB row update with `amount += delta`, or a lock) — same principle as the ATM's `BankAccount.debit` and the vending machine's `Inventory.decrement_stock`: fan all mutation through one guarded method.

**"How would you support 'simplify debts' at the level of an individual user across multiple groups, not just within one group?"**
`net_balances` currently takes an explicit `users` list scoped to a group; generalize it to operate over the full `Ledger` (all balances involving the requesting user) rather than filtering by group membership. This is an argument change to `net_balances`, not a structural redesign.

**"How would you let a user dispute/edit a split after the expense is added?"**
Model it as: recompute new `Split` values, then call `Ledger.update_balance` with the **delta** (new − old) for each affected pair, rather than a full reversal + reapply — cheaper and less error-prone, and it's a natural use of the existing `update_balance(creditor, debtor, amount)` primitive since `amount` can be any signed delta.

---

## 11. Interview Q&A

**Q: Why is `SplitStrategy` a separate class from `Expense` rather than a method on `Expense` with an `if split_type == ...` branch?**
Answer: Same OCP argument as the ATM's `TransactionStrategy` — a branch inside `Expense` means every new split type requires editing `Expense` itself, and testing one split type in isolation means dragging in the whole `Expense` class. A `SplitStrategy` interface lets each algorithm be developed, tested, and reasoned about independently, and `Expense` stays a stable, unchanging shape.

**Q: Why does `Ledger` store pairwise balances rather than each `User` just storing a single "net worth in the group" number?**
Answer: Splitwise shows users a breakdown like "you owe Bob $20, Charlie owes you $10" — that requires pairwise data, not just a net figure. The net figure (used by `simplify_debts`) is *derived* from the pairwise ledger on demand, not stored as the source of truth, so you don't lose information needed for the detailed view.

**Q: Is the greedy debt-simplification algorithm guaranteed to produce the mathematically minimum number of transactions?**
Answer: No — finding the true minimum number of transactions to settle a set of net balances is NP-hard in general (it's equivalent to a partition-into-subsets-that-sum-to-zero problem). The greedy "pair largest creditor with largest debtor" approach is a well-known, efficient heuristic that performs close to optimal in practice and is what's expected in an interview setting; stating this nuance (rather than claiming false optimality) is itself a strong signal.

**Q: How would `add_expense` behave if `paid_by` is also one of the `participants`?**
Answer: `add_expense` explicitly skips creating a ledger update for the payer's own split (`if split.user.id != expense.paid_by.id`), since the payer effectively "pays themselves" for their share — only the *other* participants' shares become debts owed to the payer.

**Q: Where would you enforce that all `participants` in an `Expense` are actually members of the `Group` the expense belongs to?**
Answer: In `ExpenseManager.add_expense` (or a validation step just before it), not in `Expense` itself — `Expense` is a plain data-holder and shouldn't need a reference to `Group` just to validate membership. Keeping this check in the facade also means it's easy to relax later (e.g., support expenses outside any group, "just between two friends") without touching `Expense`.

**Q: Why route `settle_up` through the same `Ledger.update_balance` method used by `add_expense`, instead of giving it its own balance-mutation logic?**
Answer: A settlement is conceptually just a balance delta like any other — treating it as a negative update through the same atomic, single-choke-point method avoids duplicating the concurrency-safety logic (locking/atomicity) in two places, and guarantees `get_balance`/`net_balances` never need to know whether a given balance change came from an expense or a settlement.
