# Phase 08: Transactional Systems Design in Java

Transactional systems model high-integrity business processes where atomicity, state transitions, balance reconciliation, and concurrency control are paramount. In this phase, you will design three classic enterprise systems in clean, thread-safe Java.

## 📚 Lessons in This Phase

1. **[01-ATM-Machine-Design.md](01-ATM-Machine-Design.md)**: State Machine Pattern (Idle, HasCard, Authenticated, Dispensing), Chain of Responsibility cash dispenser, and thread-safe balance operations.
2. **[02-Vending-Machine-Design.md](02-Vending-Machine-Design.md)**: State Pattern for product selection, coin/currency accumulation, atomic inventory stock decrement, and change return.
3. **[03-Splitwise-Design.md](03-Splitwise-Design.md)**: Strategy Pattern for expense splits (Equal, Exact, Percentage), pairwise Ledger matrix, and minimum-transaction cash flow simplification via dual Max-Heaps (`PriorityQueue`).
