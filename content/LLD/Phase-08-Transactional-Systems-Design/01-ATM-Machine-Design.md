# ATM Machine — LLD Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Skeletons (Python)](#8-class-skeletons-python)
9. [Interview Follow-ups](#9-interview-follow-ups)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Step 1: Clarify Requirements

Never start drawing classes before you've pinned down scope. For an ATM, ask (or state, if driving solo):

**Functional requirements** (assume these unless the interviewer says otherwise):
- A customer authenticates with a **card + PIN**.
- Supported operations: **check balance, withdraw cash, deposit cash**.
- The ATM has a **finite cash inventory** (denominations) and must dispense the exact requested amount using available notes.
- Wrong PIN entered 3 times → card is retained/blocked.
- A single account can only have **one active session** on the ATM at a time.

**Non-functional requirements / constraints:**
- **Consistency over availability** — never dispense cash without atomically debiting the account first (or the transaction must be reversible).
- **Concurrency-safe** — two withdrawal requests against the same account (e.g., card cloned, two ATMs) must not both succeed if the balance only supports one.
- Single ATM, single bank for v1 (interviewer will often ask you to extend to multi-bank later — see Follow-ups).

**Out of scope for v1** (say this explicitly — it shows scoping discipline): multi-currency, receipt printing, NFC/contactless, network partition handling between ATM and bank server.

---

## 2. Step 2: Identify Entities/Classes

Pull nouns straight out of the requirements:

| Class | Represents |
|-------|------------|
| `ATM` | The physical machine; orchestrates the session |
| `ATMState` (+ subclasses) | Current state of the machine (Idle, HasCard, Authenticated, Dispensing) |
| `CardReader` | Reads/ejects the inserted card |
| `Card` | The customer's bank card (card number, linked account id) |
| `Keypad` | PIN / amount entry |
| `CashDispenser` | Physical cash inventory + dispensing logic |
| `BankAccount` | Balance, account holder, PIN hash |
| `Transaction` | Record of a withdraw/deposit/balance-check attempt |
| `TransactionStrategy` (+ subclasses) | Withdraw / Deposit / CheckBalance behavior |
| `BankServer` (interface) | External system the ATM talks to for authentication + ledger updates |

---

## 3. Step 3: Define Relationships

```
ATM "1" ── "1" CardReader        (composition — CardReader has no meaning outside an ATM)
ATM "1" ── "1" CashDispenser     (composition)
ATM "1" ── "1" Keypad            (composition)
ATM "1" ── "1" ATMState          (current state, swapped at runtime — association)
ATM "1" ── "*" Transaction       (composition — ATM logs every transaction it processes)
Card  "*" ── "1" BankAccount     (association — many cards can map to one account in real banks;
                                   1:1 is fine for v1)
Transaction "1" ── "1" TransactionStrategy   (association — delegated behavior)
ATM "1" ── "1" BankServer        (dependency — ATM calls out to verify PIN / update balance)
```

### ASCII Class Diagram

```
┌─────────────────────────────┐
│            ATM               │
├──────────────────────────────┤
│ - state: ATMState             │
│ - cardReader: CardReader      │
│ - cashDispenser: CashDispenser│
│ - keypad: Keypad              │
│ - bankServer: BankServer      │
│ - currentCard: Card           │
│ - transactions: list[Transaction]│
├──────────────────────────────┤
│ + insertCard(card)            │
│ + enterPin(pin)                │
│ + selectTransaction(type)     │
│ + ejectCard()                  │
│ + setState(state)              │
└───────────────┬───────────────┘
                │ delegates to
                ▼
┌──────────────────────────────┐        ┌───────────────────────┐
│        <<abstract>>           │        │      CashDispenser     │
│         ATMState               │        ├───────────────────────┤
├──────────────────────────────┤        │ - notes: dict[int,int] │
│ + insertCard(atm, card)       │        ├───────────────────────┤
│ + enterPin(atm, pin)           │        │ + dispense(amount)     │
│ + selectTransaction(atm, type)│        │ + hasSufficientCash()  │
│ + ejectCard(atm)               │        └───────────────────────┘
└───────────────┬───────────────┘
     ┌──────────┼───────────┬────────────────┐
     ▼          ▼           ▼                ▼
┌─────────┐ ┌─────────┐ ┌───────────────┐ ┌────────────┐
│IdleState│ │HasCard  │ │Authenticated  │ │Dispensing  │
│         │ │State    │ │State          │ │State       │
└─────────┘ └─────────┘ └───────────────┘ └────────────┘

┌───────────────────────┐        ┌─────────────────────────┐
│      Transaction        │──────▶│  <<abstract>>            │
├───────────────────────┤        │  TransactionStrategy     │
│ - id: str                │        ├─────────────────────────┤
│ - account: BankAccount   │        │ + execute(account, amt) │
│ - amount: float           │        └────────────┬────────────┘
│ - type: str               │                     │
│ - status: str             │        ┌────────────┼─────────────┐
└───────────────────────┘        ▼            ▼             ▼
                              ┌─────────┐ ┌──────────┐ ┌────────────┐
                              │Withdraw │ │ Deposit  │ │CheckBalance│
                              │Strategy │ │Strategy  │ │Strategy    │
                              └─────────┘ └──────────┘ └────────────┘

┌─────────────┐         ┌──────────────────────┐
│    Card      │────────▶│     BankAccount        │
├─────────────┤ account ├──────────────────────┤
│ - cardNumber │         │ - accountId            │
│ - accountId  │         │ - balance               │
│ - pinHash    │         │ - ownerName             │
└─────────────┘         │ + debit(amount) / credit│
                          └──────────────────────┘
```

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibility (and only this) |
|-------|----------------------------------|
| `ATM` | Owns the session lifecycle; delegates all behavior to the current `ATMState` |
| `ATMState` subclasses | Decide what's legal in the current state, and trigger the next transition |
| `CardReader` | Read the card's raw data; eject on demand |
| `CashDispenser` | Know note denominations; compute greedy note breakdown; physically "dispense" |
| `BankAccount` | Own balance mutation (`debit`/`credit`) — **this is the only place balance changes happen** |
| `Transaction` | Immutable record of what was attempted and its outcome |
| `TransactionStrategy` subclasses | Encapsulate the steps for one transaction type |
| `BankServer` | Boundary to the "source of truth" ledger (in a real system, ATM and BankServer are separate services) |

Notice `BankAccount.debit()` is the single choke point for balance changes — this is where you enforce the "never dispense without debiting" invariant.

---

## 5. Step 5: Apply SOLID

- **SRP** — `ATM` no longer contains a giant `if/elif` chain over states; each `ATMState` subclass owns one state's rules. `CashDispenser` only knows about physical cash, not business validation.
- **OCP** — Adding a new transaction type (e.g., mini-statement) means adding a new `TransactionStrategy` subclass — zero changes to `ATM` or `Transaction`. Adding a new state (e.g., `OutOfServiceState` when cash is low) means adding a new `ATMState` subclass.
- **LSP** — Any `ATMState` subclass can replace another in `ATM.state` without breaking `ATM`'s code, because they all implement the same interface (illegal actions simply raise/ignore rather than crash).
- **ISP** — `BankServer` interface exposes only `authenticate()` and `updateBalance()` — an ATM doesn't need the bank's admin/reporting interface.
- **DIP** — `ATM` depends on the `BankServer` **interface**, not a concrete bank implementation — swapping in a mock bank for testing is trivial.

---

## 6. Step 6: Apply Design Patterns

### State Pattern — for ATM lifecycle

The ATM's behavior for "insert card", "enter PIN", "select transaction" genuinely differs depending on where you are in the session. That's the textbook signal for **State**: eliminate a hairy conditional (`if state == IDLE: ... elif state == HAS_CARD: ...`) by giving each state its own class.

```
IdleState ──insertCard──▶ HasCardState ──enterPin(correct)──▶ AuthenticatedState
    ▲                          │                                    │
    │                    enterPin(wrong x3)                selectTransaction
    │                          │                                    │
    └──────ejectCard───────────▼                                    ▼
                          CardRetainedState                  DispensingState
                                                                     │
                                                              ejectCard/done
                                                                     │
                                                                     ▼
                                                                 IdleState
```

### Strategy Pattern — for transaction types

Withdraw / deposit / check-balance share a shape (`execute(account, amount) -> Transaction`) but differ entirely in logic. Strategy lets `ATM` call `strategy.execute(...)` without caring which one it is — and lets you unit-test each transaction type in isolation.

### Why not Factory here?

You *could* add a `TransactionStrategyFactory` to map a transaction-type string to a strategy instance — worth mentioning to the interviewer as a natural next refinement, but not required to justify the core design.

---

## 7. Step 7: Explain Extensibility

Narrate this to the interviewer once the design is on the board:

- **New transaction type** (e.g., transfer): add one `TransactionStrategy` subclass. No existing class changes.
- **New ATM state** (e.g., `MaintenanceState` when cash is critically low): add one `ATMState` subclass; `CashDispenser.hasSufficientCash()` already gives you the trigger condition.
- **Multi-bank support**: `BankServer` is already an interface — plug in a `BankServerAdapter` per bank, keyed by the card's issuer prefix (BIN).
- **Concurrency**: because all balance mutation funnels through `BankAccount.debit()`, you only need to make **that one method** transactional (see Follow-ups) rather than auditing the whole codebase.

This is the payoff of steps 4–6: the design absorbs new requirements as *additions*, not *rewrites*.

---

## 8. Class Skeletons (Python)

> These are **design skeletons** — signatures and the logic that matters for the design conversation, not a full runnable implementation. A complete, tested implementation lives in `LLD/Projects/`.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from uuid import uuid4


# ---------- Domain data ----------

@dataclass
class BankAccount:
    """A customer's account at the bank. The single source of truth for balance."""
    account_id: str
    owner_name: str
    balance: float
    pin_hash: str

    def debit(self, amount: float) -> None:
        """Atomically reduce balance. Raises if funds are insufficient.
        In production this call is wrapped in a DB transaction / row lock
        to make it safe under concurrent withdrawals (see Follow-ups).
        """
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount

    def credit(self, amount: float) -> None:
        """Atomically increase balance (deposit)."""
        self.balance += amount


@dataclass
class Card:
    """Physical/virtual card linked to one account."""
    card_number: str
    account_id: str


class TransactionType(Enum):
    WITHDRAW = "WITHDRAW"
    DEPOSIT = "DEPOSIT"
    CHECK_BALANCE = "CHECK_BALANCE"


@dataclass
class Transaction:
    """Immutable record of a single transaction attempt."""
    account_id: str
    type: TransactionType
    amount: float
    status: str = "PENDING"
    id: str = field(default_factory=lambda: str(uuid4()))


# ---------- Strategy: transaction types ----------

class TransactionStrategy(ABC):
    """Encapsulates the steps to execute one kind of transaction."""

    @abstractmethod
    def execute(self, account: BankAccount, amount: float) -> Transaction:
        ...


class WithdrawStrategy(TransactionStrategy):
    def __init__(self, dispenser: "CashDispenser"):
        self.dispenser = dispenser

    def execute(self, account: BankAccount, amount: float) -> Transaction:
        """Debit first (source of truth), then physically dispense.
        If dispensing fails after debit, the caller must reverse the debit —
        this ordering is a key point to call out to the interviewer.
        """
        if not self.dispenser.has_sufficient_cash(amount):
            raise ValueError("ATM cannot dispense requested amount")
        account.debit(amount)
        self.dispenser.dispense(amount)
        return Transaction(account.account_id, TransactionType.WITHDRAW, amount, status="SUCCESS")


class DepositStrategy(TransactionStrategy):
    def execute(self, account: BankAccount, amount: float) -> Transaction:
        account.credit(amount)
        return Transaction(account.account_id, TransactionType.DEPOSIT, amount, status="SUCCESS")


class CheckBalanceStrategy(TransactionStrategy):
    def execute(self, account: BankAccount, amount: float = 0) -> Transaction:
        return Transaction(account.account_id, TransactionType.CHECK_BALANCE, account.balance, status="SUCCESS")


# ---------- Cash dispenser ----------

class CashDispenser:
    """Owns physical note inventory. Knows nothing about accounts or business rules."""

    def __init__(self, notes: dict[int, int]):
        # e.g. {100: 20, 50: 10, 20: 50} -> denomination: count
        self.notes = notes

    def has_sufficient_cash(self, amount: float) -> bool:
        """Check total cash AND that amount is representable by available denominations."""
        ...

    def dispense(self, amount: float) -> dict[int, int]:
        """Greedily break `amount` into denominations and decrement inventory.
        Returns the note breakdown dispensed.
        """
        ...


# ---------- State pattern: ATM lifecycle ----------

class ATMState(ABC):
    """Base state. Each concrete state overrides only the actions legal in it;
    others raise/ignore by default.
    """

    def insert_card(self, atm: "ATM", card: Card) -> None:
        raise InvalidOperationError("Cannot insert card in this state")

    def enter_pin(self, atm: "ATM", pin: str) -> None:
        raise InvalidOperationError("Cannot enter PIN in this state")

    def select_transaction(self, atm: "ATM", strategy: TransactionStrategy, amount: float) -> None:
        raise InvalidOperationError("Cannot select transaction in this state")

    def eject_card(self, atm: "ATM") -> None:
        raise InvalidOperationError("No card to eject")


class InvalidOperationError(Exception):
    pass


class IdleState(ATMState):
    def insert_card(self, atm: "ATM", card: Card) -> None:
        atm.current_card = card
        atm.set_state(HasCardState())


class HasCardState(ATMState):
    def enter_pin(self, atm: "ATM", pin: str) -> None:
        if atm.bank_server.authenticate(atm.current_card, pin):
            atm.set_state(AuthenticatedState())
        else:
            atm.register_failed_pin_attempt()  # after 3 -> retain card

    def eject_card(self, atm: "ATM") -> None:
        atm.current_card = None
        atm.set_state(IdleState())


class AuthenticatedState(ATMState):
    def select_transaction(self, atm: "ATM", strategy: TransactionStrategy, amount: float) -> None:
        atm.set_state(DispensingState())
        atm.run_transaction(strategy, amount)
        atm.set_state(AuthenticatedState())  # back to menu after completion

    def eject_card(self, atm: "ATM") -> None:
        atm.current_card = None
        atm.set_state(IdleState())


class DispensingState(ATMState):
    """Transient state — no user-triggerable actions while mid-dispense."""
    pass


# ---------- Orchestrator ----------

class BankServer(ABC):
    """Boundary interface to the bank's ledger/auth system (DIP: ATM depends on this, not a concrete bank)."""

    @abstractmethod
    def authenticate(self, card: Card, pin: str) -> bool: ...

    @abstractmethod
    def get_account(self, account_id: str) -> BankAccount: ...


class ATM:
    def __init__(self, dispenser: CashDispenser, bank_server: BankServer):
        self.state: ATMState = IdleState()
        self.cash_dispenser = dispenser
        self.bank_server = bank_server
        self.current_card: Card | None = None
        self.failed_pin_attempts = 0
        self.transactions: list[Transaction] = []

    def set_state(self, state: ATMState) -> None:
        self.state = state

    def insert_card(self, card: Card) -> None:
        self.state.insert_card(self, card)

    def enter_pin(self, pin: str) -> None:
        self.state.enter_pin(self, pin)

    def select_transaction(self, strategy: TransactionStrategy, amount: float) -> None:
        self.state.select_transaction(self, strategy, amount)

    def run_transaction(self, strategy: TransactionStrategy, amount: float) -> Transaction:
        account = self.bank_server.get_account(self.current_card.account_id)
        txn = strategy.execute(account, amount)
        self.transactions.append(txn)
        return txn

    def register_failed_pin_attempt(self) -> None:
        self.failed_pin_attempts += 1
        if self.failed_pin_attempts >= 3:
            self.current_card = None  # card retained
            self.set_state(IdleState())
```

---

## 9. Interview Follow-ups

**"How would you handle concurrent withdrawals from the same account (e.g., two ATMs, one shared account)?"**
`BankAccount.debit()` must be the single atomic choke point. In a real system this maps to a database transaction with either row-level locking (`SELECT ... FOR UPDATE`) or an optimistic-concurrency check (version column, compare-and-swap on balance). The design already isolates all mutation behind this one method — you're only hardening that method, not restructuring the class model.

**"How would you add support for multiple currencies?"**
`BankAccount` gains a `currency` field; `CashDispenser` becomes currency-aware (separate note trays or a `currency` param on `dispense`); `WithdrawStrategy` performs a conversion step if the ATM's dispensing currency differs from the account's currency, using an injected `ExchangeRateProvider` (another seam for DIP).

**"What happens if the ATM crashes mid-dispense, after debiting the account?"**
This is why `Transaction` records status transitions (`PENDING` → `SUCCESS`/`FAILED`) rather than being written only on success. On restart, the ATM reconciles any `PENDING` transaction against the bank server's ledger and either completes or reverses (credits back) the debit — a **saga/compensating-transaction** pattern.

**"How would you support multiple banks on one ATM?"**
Card BIN (first 6 digits) is looked up in a table mapping to a `BankServer` implementation. `ATM` already depends on the `BankServer` interface, so this is a routing change at the point where `bank_server` is selected — no change to `ATMState` or `TransactionStrategy`.

**"How would you rate-limit or fraud-check withdrawals?"**
Add a decorator/middleware step in `WithdrawStrategy.execute` (or a separate `FraudCheckStrategy` composed in) that consults a daily-limit counter per account before calling `debit`. This is naturally an Open/Closed extension — no existing class is modified, a check is inserted in the pipeline.

---

## 10. Interview Q&A

**Q: Why use the State pattern instead of a single `status` enum field with if/else checks?**
Answer: An enum + if/else scatters the same conditional logic across every method (`insertCard`, `enterPin`, `selectTransaction`, ...), and every new state means editing all of them (violates OCP). The State pattern puts each state's legal transitions in one class, so adding a state means adding a class, not touching existing ones, and it's impossible to "forget" to handle a state in one of the branches.

**Q: Why does `WithdrawStrategy` call `account.debit()` before `dispenser.dispense()` rather than after?**
Answer: The bank's ledger is the system of record. If you dispense first and the debit fails afterward, the bank has given away money it can't account for. Debiting first — even though it means you must handle "debit succeeded, dispense failed" via a compensating credit — keeps the ledger consistent, which is the higher-priority invariant in a financial system.

**Q: Where would you put the "3 wrong PIN attempts locks the card" rule?**
Answer: In the `ATM` orchestrator (`register_failed_pin_attempt`), not in a specific state class, because it's cross-cutting session state rather than a single state's transition rule. Alternatively it could live in `BankServer.authenticate` if lockout should be enforced bank-wide (across all ATMs) rather than per-machine — worth surfacing this ambiguity to the interviewer as a clarifying question.

**Q: How is `CashDispenser` decoupled from business rules like "does this account have enough balance"?**
Answer: `CashDispenser` only knows about physical notes — `has_sufficient_cash` checks whether the *machine* has that much cash, not whether the *account* does. Balance sufficiency is checked separately in `BankAccount.debit`. This split means the dispenser class is reusable even if you swap the underlying accounting system entirely.

**Q: Why is `Transaction` a plain immutable-style record rather than a class with behavior?**
Answer: `Transaction` is a data/record class — it represents a fact ("this happened"), not a behavior. Putting logic on it (like "execute yourself") would blur the line with `TransactionStrategy`, which is the object actually responsible for performing the operation. Keeping `Transaction` dumb also makes it trivially serializable for audit logs.

**Q: What's the tradeoff of using Strategy for transaction types versus subclassing `ATM` itself (e.g., `WithdrawATM`, `DepositATM`)?**
Answer: Subclassing `ATM` per transaction type would mean a single physical ATM couldn't offer more than one transaction type without multiple inheritance or duplicated session/state logic. Strategy lets one `ATM` instance compose in whichever transaction behaviors it supports, and you can add/remove supported transaction types at runtime (e.g., disable deposits on a withdrawal-only ATM) by simply not registering that strategy.
