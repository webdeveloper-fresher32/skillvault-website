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

## 9. Class Skeletons (Java)

> Design skeletons — signatures and key logic. Full runnable implementation lives in `LLD/Projects/`.

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// ---------- Domain data ----------

public record User(String id, String name) {}

public class Group {
    private final String id;
    private final String name;
    private final List<User> members = new ArrayList<>();

    public Group(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public void addMember(User user) {
        members.add(user);
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public List<User> getMembers() { return Collections.unmodifiableList(members); }
}

public record Split(User user, double amountOwed) {}

// ---------- Strategy: split types ----------

public interface SplitStrategy {
    List<Split> computeSplits(double amount, List<User> participants, Map<String, Object> metadata);
}

public class EqualSplitStrategy implements SplitStrategy {
    @Override
    public List<Split> computeSplits(double amount, List<User> participants, Map<String, Object> metadata) {
        int n = participants.size();
        double base = Math.round((amount / n) * 100.0) / 100.0;
        List<Split> splits = new ArrayList<>();
        for (User u : participants) {
            splits.add(new Split(u, base));
        }

        // Distribute rounding remainder cents to first participants
        double remainder = Math.round((amount - (base * n)) * 100.0) / 100.0;
        int cents = (int) Math.round(remainder * 100);
        for (int i = 0; i < Math.abs(cents); i++) {
            User u = splits.get(i).user();
            double adjust = cents > 0 ? 0.01 : -0.01;
            double adjustedAmount = Math.round((splits.get(i).amountOwed() + adjust) * 100.0) / 100.0;
            splits.set(i, new Split(u, adjustedAmount));
        }
        return splits;
    }
}

public class ExactSplitStrategy implements SplitStrategy {
    @Override
    @SuppressWarnings("unchecked")
    public List<Split> computeSplits(double amount, List<User> participants, Map<String, Object> metadata) {
        Map<String, Double> amounts = (Map<String, Double>) metadata.get("amounts");
        double sum = amounts.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - amount) > 0.01) {
            throw new IllegalArgumentException("Exact splits sum (" + sum + ") does not match total (" + amount + ")");
        }

        List<Split> splits = new ArrayList<>();
        for (User u : participants) {
            splits.add(new Split(u, amounts.getOrDefault(u.id(), 0.0)));
        }
        return splits;
    }
}

public class PercentageSplitStrategy implements SplitStrategy {
    @Override
    @SuppressWarnings("unchecked")
    public List<Split> computeSplits(double amount, List<User> participants, Map<String, Object> metadata) {
        Map<String, Double> percentages = (Map<String, Double>) metadata.get("percentages");
        double sum = percentages.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - 100.0) > 0.01) {
            throw new IllegalArgumentException("Percentages must sum to 100");
        }

        List<Split> splits = new ArrayList<>();
        for (User u : participants) {
            double pct = percentages.getOrDefault(u.id(), 0.0);
            double share = Math.round((amount * pct / 100.0) * 100.0) / 100.0;
            splits.add(new Split(u, share));
        }
        return splits;
    }
}

// ---------- Expense ----------

public class Expense {
    private final String id;
    private final String description;
    private final double amount;
    private final User paidBy;
    private final List<User> participants;
    private final SplitStrategy splitStrategy;
    private final Map<String, Object> metadata;
    private List<Split> splits = new ArrayList<>();

    public Expense(String description, double amount, User paidBy, List<User> participants,
                   SplitStrategy strategy, Map<String, Object> metadata) {
        this.id = UUID.randomUUID().toString();
        this.description = description;
        this.amount = amount;
        this.paidBy = paidBy;
        this.participants = new ArrayList<>(participants);
        this.splitStrategy = strategy;
        this.metadata = (metadata == null) ? Collections.emptyMap() : metadata;
    }

    public List<Split> calculateSplits() {
        this.splits = splitStrategy.computeSplits(amount, participants, metadata);
        return Collections.unmodifiableList(splits);
    }

    public String getId() { return id; }
    public double getAmount() { return amount; }
    public User getPaidBy() { return paidBy; }
    public List<Split> getSplits() { return splits; }
}

// ---------- Ledger & Balance Sheet ----------

public class Ledger {
    // Pairwise balance: (creditorId, debtorId) -> amount owed
    private final Map<String, Map<String, Double>> balances = new ConcurrentHashMap<>();

    public synchronized void updateBalance(User creditor, User debtor, double amount) {
        balances.computeIfAbsent(creditor.id(), k -> new ConcurrentHashMap<>())
                .merge(debtor.id(), amount, Double::sum);
        balances.computeIfAbsent(debtor.id(), k -> new ConcurrentHashMap<>())
                .merge(creditor.id(), -amount, Double::sum);
    }

    public double getBalance(User a, User b) {
        return balances.getOrDefault(a.id(), Collections.emptyMap()).getOrDefault(b.id(), 0.0);
    }

    public Map<User, Double> netBalances(List<User> users) {
        Map<String, Double> net = new HashMap<>();
        Map<String, User> userLookup = new HashMap<>();
        for (User u : users) userLookup.put(u.id(), u);

        for (var entry : balances.entrySet()) {
            String creditor = entry.getKey();
            for (var sub : entry.getValue().entrySet()) {
                net.merge(creditor, sub.getValue(), Double::sum);
            }
        }

        Map<User, Double> result = new HashMap<>();
        for (var entry : net.entrySet()) {
            if (Math.abs(entry.getValue()) > 0.01 && userLookup.containsKey(entry.getKey())) {
                result.put(userLookup.get(entry.getKey()), Math.round(entry.getValue() * 100.0) / 100.0);
            }
        }
        return result;
    }
}

// ---------- ExpenseManager (Facade) ----------

public record Settlement(User debtor, User creditor, double amount) {}

public class ExpenseManager {
    private final Ledger ledger = new Ledger();
    private final List<Expense> expenses = new ArrayList<>();

    public void addExpense(Expense expense) {
        List<Split> splits = expense.calculateSplits();
        for (Split split : splits) {
            if (!split.user().id().equals(expense.getPaidBy().id())) {
                ledger.updateBalance(expense.getPaidBy(), split.user(), split.amountOwed());
            }
        }
        expenses.add(expense);
    }

    public void settleUp(User payer, User payee, double amount) {
        ledger.updateBalance(payee, payer, -amount);
    }

    public List<Settlement> simplifyDebts(List<User> users) {
        Map<User, Double> net = ledger.netBalances(users);

        // PriorityQueue Max-Heaps for Creditors and Debtors
        PriorityQueue<Map.Entry<User, Double>> creditors = new PriorityQueue<>(
            (a, b) -> Double.compare(b.getValue(), a.getValue())
        );
        PriorityQueue<Map.Entry<User, Double>> debtors = new PriorityQueue<>(
            (a, b) -> Double.compare(a.getValue(), b.getValue()) // Lowest negative is highest debtor
        );

        for (var entry : net.entrySet()) {
            if (entry.getValue() > 0) creditors.offer(entry);
            else if (entry.getValue() < 0) debtors.offer(entry);
        }

        List<Settlement> settlements = new ArrayList<>();

        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            var creditor = creditors.poll();
            var debtor = debtors.poll();

            double creditAmt = creditor.getValue();
            double debtAmt = -debtor.getValue();
            double settled = Math.min(creditAmt, debtAmt);

            settlements.add(new Settlement(debtor.getKey(), creditor.getKey(), Math.round(settled * 100.0) / 100.0));

            double remainingCredit = creditAmt - settled;
            double remainingDebt = debtAmt - settled;

            if (remainingCredit > 0.01) {
                creditors.offer(Map.entry(creditor.getKey(), remainingCredit));
            }
            if (remainingDebt > 0.01) {
                debtors.offer(Map.entry(debtor.getKey(), -remainingDebt));
            }
        }
        return settlements;
    }
}
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
