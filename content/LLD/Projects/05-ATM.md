# Project 5 — ATM System

**Difficulty:** Medium
**Patterns used:** State (ABC-based state machine), Composition

---

## 1. Requirements

**Functional:**
- The ATM starts `Idle`. Inserting a `Card` moves it to a "has card" state.
- The user enters a PIN; correct PIN authenticates them, wrong PIN (after N attempts) ejects the card.
- Once authenticated, the user can select a transaction: check balance, withdraw cash, or deposit cash.
- Withdrawals validate sufficient account balance **and** sufficient cash in the machine, then dispense the exact amount using the fewest notes (greedy denomination breakdown).
- After a transaction (or cancel/eject), the ATM returns to `Idle`.

**Non-functional:**
- Each state should only expose the operations valid in that state — e.g., you can't "enter PIN" before a card is inserted, and you can't "insert card" while a transaction is in progress. This should be enforced by the design, not by scattered `if` checks.

---

## 2. Class Diagram

```
┌─────────────────────┐
│         ATM           │  (State pattern context)
│─────────────────────│
│ - state: ATMState      │◀────────────────┐
│ - card_dispenser       │                  │
│ - cash_dispenser       │                  │
│ - current_card         │        ┌─────────┴──────────┐
│─────────────────────│        │ «abstract» ATMState  │
│ + insert_card()        │──────▶│──────────────────────│
│ + enter_pin()          │       │ + insert_card()       │
│ + select_transaction() │       │ + enter_pin()          │
│ + eject_card()         │       │ + select_transaction()│
└─────────────────────┘        │ + eject_card()         │
                                  └──────────┬────────────┘
                     ┌──────────────┬────────┴────────┬───────────────────┐
                     ▼              ▼                 ▼                    ▼
             ┌─────────────┐┌────────────────┐┌────────────────────┐┌─────────────┐
             │ IdleState   ││ HasCardState    ││ AuthenticatedState  ││ TransactionState│
             └─────────────┘└────────────────┘└────────────────────┘└─────────────┘

┌───────────┐          ┌───────────────┐          ┌──────────────────┐
│    Card    │─────────▶│  BankAccount   │◀────────│  CashDispenser    │
│───────────│  1     1 │───────────────│          │──────────────────│
│ card_number│          │ balance        │          │ denominations      │
│ pin        │          │ + withdraw()   │          │ + dispense()        │
│ account    │          │ + deposit()    │          └──────────────────┘
└───────────┘          └───────────────┘
```

---

## 3. Full Implementation

```python
"""
ATM — single-file runnable LLD reference implementation (State pattern).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Domain entities
# ---------------------------------------------------------------------------

class BankAccount:
    def __init__(self, account_id: str, balance: float):
        self.account_id = account_id
        self.balance = balance

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("Insufficient account balance")
        self.balance -= amount

    def deposit(self, amount: float) -> None:
        self.balance += amount


@dataclass
class Card:
    card_number: str
    pin: str
    account: BankAccount


class CashDispenser:
    """Tracks the ATM's physical cash inventory and computes note breakdowns."""

    def __init__(self, denominations: Dict[int, int]):
        # denominations: {note_value: count}, e.g. {100: 5, 50: 10, 20: 20}
        self.denominations = dict(denominations)

    def total_cash(self) -> int:
        return sum(note * count for note, count in self.denominations.items())

    def can_dispense(self, amount: int) -> bool:
        return self._breakdown(amount) is not None

    def _breakdown(self, amount: int) -> Optional[Dict[int, int]]:
        remaining = amount
        plan: Dict[int, int] = {}
        for note in sorted(self.denominations.keys(), reverse=True):
            available = self.denominations[note]
            if available <= 0:
                continue
            needed = min(remaining // note, available)
            if needed > 0:
                plan[note] = needed
                remaining -= needed * note
        return plan if remaining == 0 else None

    def dispense(self, amount: int) -> Dict[int, int]:
        plan = self._breakdown(amount)
        if plan is None:
            raise ValueError("Cannot dispense exact amount with available denominations")
        for note, count in plan.items():
            self.denominations[note] -= count
        return plan


class CardReader:
    """Minimal stand-in for physical card read/eject hardware."""

    def eject(self) -> None:
        pass  # in real hardware this would trigger the mechanism


# ---------------------------------------------------------------------------
# Transaction record (kept simple for this exercise)
# ---------------------------------------------------------------------------

class TransactionType(Enum):
    BALANCE_INQUIRY = auto()
    WITHDRAWAL = auto()
    DEPOSIT = auto()


@dataclass
class Transaction:
    type: TransactionType
    amount: float = 0.0
    resulting_balance: float = 0.0


# ---------------------------------------------------------------------------
# State pattern: ATMState hierarchy
# ---------------------------------------------------------------------------

class ATMState(ABC):
    """Base state. Default implementations raise — each concrete state
    overrides only the operations that are legal for it."""

    def __init__(self, atm: "ATM"):
        self.atm = atm

    def insert_card(self, card: Card) -> None:
        raise InvalidOperationError(f"Cannot insert card in {self.name} state")

    def enter_pin(self, pin: str) -> None:
        raise InvalidOperationError(f"Cannot enter PIN in {self.name} state")

    def select_transaction(
        self, transaction_type: TransactionType, amount: float = 0.0
    ) -> Optional[Transaction]:
        raise InvalidOperationError(f"Cannot select transaction in {self.name} state")

    def eject_card(self) -> None:
        raise InvalidOperationError(f"Cannot eject card in {self.name} state")

    @property
    def name(self) -> str:
        return self.__class__.__name__


class InvalidOperationError(Exception):
    pass


class IdleState(ATMState):
    def insert_card(self, card: Card) -> None:
        self.atm.current_card = card
        self.atm.pin_attempts = 0
        self.atm.set_state(HasCardState(self.atm))
        print("Card inserted. Please enter your PIN.")


class HasCardState(ATMState):
    MAX_PIN_ATTEMPTS = 3

    def enter_pin(self, pin: str) -> None:
        card = self.atm.current_card
        assert card is not None
        if pin == card.pin:
            self.atm.set_state(AuthenticatedState(self.atm))
            print("PIN correct. Please select a transaction.")
        else:
            self.atm.pin_attempts += 1
            remaining = self.MAX_PIN_ATTEMPTS - self.atm.pin_attempts
            if remaining <= 0:
                print("Too many incorrect attempts. Ejecting card.")
                self.eject_card()
            else:
                print(f"Incorrect PIN. {remaining} attempt(s) remaining.")

    def eject_card(self) -> None:
        self.atm.current_card = None
        self.atm.set_state(IdleState(self.atm))
        print("Card ejected.")


class AuthenticatedState(ATMState):
    def select_transaction(
        self, transaction_type: TransactionType, amount: float = 0.0
    ) -> Optional[Transaction]:
        self.atm.set_state(TransactionState(self.atm))
        return self.atm.state.select_transaction(transaction_type, amount)

    def eject_card(self) -> None:
        self.atm.current_card = None
        self.atm.set_state(IdleState(self.atm))
        print("Card ejected.")


class TransactionState(ATMState):
    def select_transaction(
        self, transaction_type: TransactionType, amount: float = 0.0
    ) -> Optional[Transaction]:
        card = self.atm.current_card
        assert card is not None
        account = card.account

        if transaction_type == TransactionType.BALANCE_INQUIRY:
            txn = Transaction(TransactionType.BALANCE_INQUIRY, resulting_balance=account.balance)
            print(f"Current balance: ${account.balance:.2f}")

        elif transaction_type == TransactionType.WITHDRAWAL:
            amount_int = int(amount)
            if amount_int > account.balance:
                print("Transaction declined: insufficient account balance.")
                self._return_to_authenticated()
                return None
            if not self.atm.cash_dispenser.can_dispense(amount_int):
                print("Transaction declined: ATM cannot dispense this exact amount.")
                self._return_to_authenticated()
                return None

            notes = self.atm.cash_dispenser.dispense(amount_int)
            account.withdraw(amount_int)
            note_summary = ", ".join(f"{count}x${note}" for note, count in sorted(notes.items(), reverse=True))
            print(f"Dispensing ${amount_int}: {note_summary}")
            txn = Transaction(TransactionType.WITHDRAWAL, amount=amount_int, resulting_balance=account.balance)

        elif transaction_type == TransactionType.DEPOSIT:
            account.deposit(amount)
            print(f"Deposited ${amount:.2f}. New balance: ${account.balance:.2f}")
            txn = Transaction(TransactionType.DEPOSIT, amount=amount, resulting_balance=account.balance)

        else:
            raise ValueError(f"Unknown transaction type: {transaction_type}")

        self._return_to_authenticated()
        return txn

    def _return_to_authenticated(self) -> None:
        self.atm.set_state(AuthenticatedState(self.atm))

    def eject_card(self) -> None:
        # Allow cancelling mid-transaction-selection.
        self.atm.current_card = None
        self.atm.set_state(IdleState(self.atm))
        print("Transaction cancelled. Card ejected.")


# ---------------------------------------------------------------------------
# ATM: the State pattern's context object
# ---------------------------------------------------------------------------

class ATM:
    def __init__(self, cash_dispenser: CashDispenser):
        self.cash_dispenser = cash_dispenser
        self.card_reader = CardReader()
        self.current_card: Optional[Card] = None
        self.pin_attempts = 0
        self.state: ATMState = IdleState(self)

    def set_state(self, state: ATMState) -> None:
        self.state = state

    # Delegate every public operation to the current state.
    def insert_card(self, card: Card) -> None:
        self.state.insert_card(card)

    def enter_pin(self, pin: str) -> None:
        self.state.enter_pin(pin)

    def select_transaction(
        self, transaction_type: TransactionType, amount: float = 0.0
    ) -> Optional[Transaction]:
        return self.state.select_transaction(transaction_type, amount)

    def eject_card(self) -> None:
        self.state.eject_card()


if __name__ == "__main__":
    dispenser = CashDispenser({100: 5, 50: 10, 20: 20, 10: 20})
    atm = ATM(dispenser)

    account = BankAccount("ACC-001", balance=500.0)
    card = Card(card_number="4111-XXXX", pin="1234", account=account)

    print("--- Wrong PIN then correct PIN ---")
    atm.insert_card(card)
    atm.enter_pin("0000")          # wrong
    atm.enter_pin("1234")          # correct

    print("\n--- Balance inquiry ---")
    atm.select_transaction(TransactionType.BALANCE_INQUIRY)

    print("\n--- Withdraw $270 ---")
    atm.select_transaction(TransactionType.WITHDRAWAL, amount=270)

    print("\n--- Attempt an invalid operation: insert card mid-session ---")
    try:
        atm.insert_card(card)
    except InvalidOperationError as e:
        print(f"Rejected as expected: {e}")

    print("\n--- Deposit $150 ---")
    atm.select_transaction(TransactionType.DEPOSIT, amount=150)

    print("\n--- Eject card ---")
    atm.eject_card()

    print(f"\nFinal account balance: ${account.balance:.2f}")
    print(f"Remaining cash in ATM: ${dispenser.total_cash()}")
```

**Expected output:**

```
--- Wrong PIN then correct PIN ---
Card inserted. Please enter your PIN.
Incorrect PIN. 2 attempt(s) remaining.
PIN correct. Please select a transaction.

--- Balance inquiry ---
Current balance: $500.00

--- Withdraw $270 ---
Dispensing $270: 2x$100, 1x$50, 1x$20

--- Attempt an invalid operation: insert card mid-session ---
Rejected as expected: Cannot insert card in AuthenticatedState state

--- Deposit $150 ---
Deposited $150.00. New balance: $380.00

--- Eject card ---
Card ejected.

Final account balance: $380.00
Remaining cash in ATM: $1330
```

---

## 4. Design Decisions

- **State pattern via ABC instead of an enum + if/elif:** Each `ATMState` subclass overrides only the methods that are valid in that state; the base class raises `InvalidOperationError` for everything else. This makes illegal transitions (like calling `enter_pin` while `Idle`) fail loudly and automatically, instead of relying on a giant `if self.status == ...` chain scattered across every method — the classic reason to reach for State over a status flag.
- **ATM as a thin context that always delegates:** `ATM.insert_card/enter_pin/select_transaction/eject_card` never contain business logic themselves — they forward to `self.state`. This means the ATM class doesn't grow every time a new state or transition rule is added; only the state classes change.
- **CashDispenser's greedy denomination breakdown:** `_breakdown` walks denominations largest-to-smallest and greedily takes as many of each note as available and needed — this gives the fewest total notes for typical currency systems (this greedy approach is provably optimal for "canonical" denomination sets like standard currency notes, though not for arbitrary sets — worth mentioning if an interviewer probes on it).
- **Withdrawal checks both account balance and physical cash availability independently:** These are two separate real-world failure modes (you might have $500 in your account, but the machine may be out of the notes needed to make exact change) — the code checks and reports on them separately rather than conflating into one generic "declined" message.

---

## 5. Possible Extensions

- **Multiple accounts per card (checking/savings):** Add an `AccountSelectionState` between `AuthenticatedState` and `TransactionState` where the user picks which linked `BankAccount` to operate on.
- **Receipt printing:** Add a `ReceiptPrinter` that the `TransactionState` notifies after each completed `Transaction`, decoupled via a simple observer callback.
- **Network/timeout handling:** Add a `TimeoutState` (or a decorator around each state) that ejects the card automatically if no input is received within N seconds — mirrors how real ATMs behave.
- **PIN attempts persisted server-side:** Currently `pin_attempts` resets whenever a new card is inserted; a production system would track failed attempts per card server-side so it persists across separate ATM sessions/machines and can trigger a card lock.
