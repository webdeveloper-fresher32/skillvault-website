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

```java
/**
 * Splitwise — single-file runnable LLD reference implementation in Java.
 * Run directly with: java SplitwiseDemo.java
 */

import java.util.*;

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

record User(String userId, String name) {
    @Override
    public String toString() {
        return name;
    }
}

class Group {
    private final String name;
    private final List<User> members;
    private final List<Expense> expenses = new ArrayList<>();

    public Group(String name, List<User> members) {
        this.name = name;
        this.members = List.copyOf(members);
    }

    public String getName() { return name; }
    public List<User> getMembers() { return members; }
    public List<Expense> getExpenses() { return expenses; }
}

// ---------------------------------------------------------------------------
// Strategy: how an expense's total is divided among participants
// ---------------------------------------------------------------------------

interface Split {
    /** Returns {user: amount_owed_in_cents} for the participants, summing to totalCents. */
    Map<User, Integer> computeShares(int totalCents, List<User> participants, Map<String, Object> params);
}

class EqualSplit implements Split {
    @Override
    public Map<User, Integer> computeShares(int totalCents, List<User> participants, Map<String, Object> params) {
        int n = participants.size();
        int base = totalCents / n;
        int remainder = totalCents - (base * n);

        Map<User, Integer> shares = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            shares.put(participants.get(i), base + (i < remainder ? 1 : 0));
        }
        return shares;
    }
}

class ExactSplit implements Split {
    @Override
    @SuppressWarnings("unchecked")
    public Map<User, Integer> computeShares(int totalCents, List<User> participants, Map<String, Object> params) {
        Map<User, Integer> amounts = (Map<User, Integer>) params.get("amountsCents");
        int sum = amounts.values().stream().mapToInt(Integer::intValue).sum();
        if (sum != totalCents) {
            throw new IllegalArgumentException("Exact split amounts must sum to the total expense");
        }
        return new LinkedHashMap<>(amounts);
    }
}

class PercentSplit implements Split {
    @Override
    @SuppressWarnings("unchecked")
    public Map<User, Integer> computeShares(int totalCents, List<User> participants, Map<String, Object> params) {
        Map<User, Double> percentages = (Map<User, Double>) params.get("percentages");
        double sumPct = percentages.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sumPct - 100.0) > 1e-6) {
            throw new IllegalArgumentException("Percentages must sum to 100");
        }

        Map<User, Integer> shares = new LinkedHashMap<>();
        int computedSum = 0;
        User biggest = null;
        int maxShare = -1;

        for (Map.Entry<User, Double> entry : percentages.entrySet()) {
            int share = (int) Math.round(totalCents * entry.getValue() / 100.0);
            shares.put(entry.getKey(), share);
            computedSum += share;
            if (share > maxShare) {
                maxShare = share;
                biggest = entry.getKey();
            }
        }

        // correct rounding drift by adjusting the largest share
        int drift = totalCents - computedSum;
        if (drift != 0 && biggest != null) {
            shares.put(biggest, shares.get(biggest) + drift);
        }
        return shares;
    }
}

// ---------------------------------------------------------------------------
// Expense
// ---------------------------------------------------------------------------

class Expense {
    private final User paidBy;
    private final int amountCents;
    private final List<User> participants;
    private final Split splitStrategy;
    private final Map<String, Object> splitParams;

    public Expense(User paidBy, int amountCents, List<User> participants, Split splitStrategy, Map<String, Object> splitParams) {
        this.paidBy = paidBy;
        this.amountCents = amountCents;
        this.participants = List.copyOf(participants);
        this.splitStrategy = splitStrategy;
        this.splitParams = splitParams != null ? splitParams : Collections.emptyMap();
    }

    public Map<User, Integer> getShares() {
        return splitStrategy.computeShares(amountCents, participants, splitParams);
    }

    public User getPaidBy() { return paidBy; }
    public int getAmountCents() { return amountCents; }
    public List<User> getParticipants() { return participants; }
}

// ---------------------------------------------------------------------------
// ExpenseManager: tracks pairwise balances and simplifies debts
// ---------------------------------------------------------------------------

record Transaction(User payer, User receiver, int amountCents) {}

class ExpenseManager {
    public static final int CENTS = 100;
    // balances[a][b] = cents that b owes a (positive means b owes a)
    private final Map<User, Map<User, Integer>> balances = new HashMap<>();

    private void adjust(User creditor, User debtor, int cents) {
        if (cents == 0 || creditor.equals(debtor)) {
            return;
        }
        balances.computeIfAbsent(creditor, k -> new HashMap<>()).merge(debtor, cents, Integer::sum);
        balances.computeIfAbsent(debtor, k -> new HashMap<>()).merge(creditor, -cents, Integer::sum);
    }

    public void addExpense(Expense expense) {
        Map<User, Integer> shares = expense.getShares();
        for (Map.Entry<User, Integer> entry : shares.entrySet()) {
            User participant = entry.getKey();
            int owedCents = entry.getValue();
            if (participant.equals(expense.getPaidBy())) {
                continue;
            }
            adjust(expense.getPaidBy(), participant, owedCents);
        }
    }

    public Map<User, Integer> netBalances() {
        Map<User, Integer> net = new LinkedHashMap<>();
        for (Map.Entry<User, Map<User, Integer>> entry : balances.entrySet()) {
            User creditor = entry.getKey();
            int sum = entry.getValue().values().stream().mapToInt(Integer::intValue).sum();
            net.put(creditor, sum);
        }
        return net;
    }

    public void printPairwiseBalances() {
        Set<Set<User>> seen = new HashSet<>();
        for (Map.Entry<User, Map<User, Integer>> entryA : balances.entrySet()) {
            User a = entryA.getKey();
            for (Map.Entry<User, Integer> entryB : entryA.getValue().entrySet()) {
                User b = entryB.getKey();
                int cents = entryB.getValue();
                Set<User> pair = Set.of(a, b);
                if (seen.contains(pair) || cents == 0) {
                    continue;
                }
                seen.add(pair);
                if (cents > 0) {
                    System.out.printf("  %s owes %s: $%.2f
", b, a, cents / (double) CENTS);
                } else {
                    System.out.printf("  %s owes %s: $%.2f
", a, b, -cents / (double) CENTS);
                }
            }
        }
    }

    record BalanceNode(User user, int amount) {}

    public List<Transaction> simplifyDebts() {
        Map<User, Integer> net = netBalances();
        PriorityQueue<BalanceNode> creditors = new PriorityQueue<>((a, b) -> Integer.compare(b.amount(), a.amount()));
        PriorityQueue<BalanceNode> debtors = new PriorityQueue<>((a, b) -> Integer.compare(a.amount(), b.amount()));

        for (Map.Entry<User, Integer> entry : net.entrySet()) {
            if (entry.getValue() > 0) {
                creditors.add(new BalanceNode(entry.getKey(), entry.getValue()));
            } else if (entry.getValue() < 0) {
                debtors.add(new BalanceNode(entry.getKey(), entry.getValue()));
            }
        }

        List<Transaction> transactions = new ArrayList<>();
        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            BalanceNode creditor = creditors.poll();
            BalanceNode debtor = debtors.poll();

            int credit = creditor.amount();
            int owe = -debtor.amount();

            int settled = Math.min(credit, owe);
            transactions.add(new Transaction(debtor.user(), creditor.user(), settled));

            int remainingCredit = credit - settled;
            int remainingDebt = owe - settled;

            if (remainingCredit > 0) {
                creditors.add(new BalanceNode(creditor.user(), remainingCredit));
            }
            if (remainingDebt > 0) {
                debtors.add(new BalanceNode(debtor.user(), -remainingDebt));
            }
        }

        return transactions;
    }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

public class SplitwiseDemo {
    public static int dollarsToCents(double amount) {
        return (int) Math.round(amount * ExpenseManager.CENTS);
    }

    public static void main(String[] args) {
        User alice = new User("u1", "Alice");
        User bob = new User("u2", "Bob");
        User carol = new User("u3", "Carol");
        User dave = new User("u4", "Dave");

        Group trip = new Group("Goa Trip", List.of(alice, bob, carol, dave));
        ExpenseManager manager = new ExpenseManager();

        // 1. Alice pays $400 for hotel, split equally among all 4
        Expense e1 = new Expense(
            alice,
            dollarsToCents(400.00),
            List.of(alice, bob, carol, dave),
            new EqualSplit(),
            null
        );
        manager.addExpense(e1);

        // 2. Bob pays $150 for dinner, split exactly (Bob 50, Carol 60, Dave 40)
        Expense e2 = new Expense(
            bob,
            dollarsToCents(150.00),
            List.of(bob, carol, dave),
            new ExactSplit(),
            Map.of("amountsCents", Map.of(
                bob, dollarsToCents(50.00),
                carol, dollarsToCents(60.00),
                dave, dollarsToCents(40.00)
            ))
        );
        manager.addExpense(e2);

        // 3. Carol pays $100 for cab rides, split by percent (Alice 20%, Bob 30%, Carol 50%)
        Expense e3 = new Expense(
            carol,
            dollarsToCents(100.00),
            List.of(alice, bob, carol),
            new PercentSplit(),
            Map.of("percentages", Map.of(alice, 20.0, bob, 30.0, carol, 50.0))
        );
        manager.addExpense(e3);

        System.out.println("Pairwise balances after all expenses:");
        manager.printPairwiseBalances();

        System.out.println("
Net balance per user (+ means owed money, - means owes money):");
        for (Map.Entry<User, Integer> entry : manager.netBalances().entrySet()) {
            int cents = entry.getValue();
            System.out.printf("  %s: %s$%.2f
", entry.getKey(), cents >= 0 ? "+" : "-", Math.abs(cents) / (double) ExpenseManager.CENTS);
        }

        System.out.println("
Simplified settlement plan:");
        for (Transaction tx : manager.simplifyDebts()) {
            System.out.printf("  %s pays %s: $%.2f
", tx.payer(), tx.receiver(), tx.amountCents() / (double) ExpenseManager.CENTS);
        }
    }
}
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
