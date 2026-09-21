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

```java
/**
 * ATM — single-file runnable LLD reference implementation (State pattern) in Java.
 * Run directly with: java ATMDemo.java
 */

import java.util.*;

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

class BankAccount {
    private final String accountId;
    private double balance;

    public BankAccount(String accountId, double balance) {
        this.accountId = accountId;
        this.balance = balance;
    }

    public synchronized void withdraw(double amount) {
        if (amount > balance) {
            throw new IllegalArgumentException("Insufficient account balance");
        }
        this.balance -= amount;
    }

    public synchronized void deposit(double amount) {
        this.balance += amount;
    }

    public String getAccountId() { return accountId; }
    public synchronized double getBalance() { return balance; }
}

record Card(String cardNumber, String pin, BankAccount account) {}

/** Tracks the ATM's physical cash inventory and computes note breakdowns. */
class CashDispenser {
    // denominations: {note_value: count}, e.g. {100: 5, 50: 10, 20: 20}
    private final Map<Integer, Integer> denominations = new TreeMap<>(Comparator.reverseOrder());

    public CashDispenser(Map<Integer, Integer> initialStock) {
        this.denominations.putAll(initialStock);
    }

    public synchronized int totalCash() {
        return denominations.entrySet().stream()
            .mapToInt(e -> e.getKey() * e.getValue())
            .sum();
    }

    public synchronized boolean canDispense(int amount) {
        return breakdown(amount).isPresent();
    }

    public synchronized Optional<Map<Integer, Integer>> breakdown(int amount) {
        int remaining = amount;
        Map<Integer, Integer> plan = new LinkedHashMap<>();
        for (Map.Entry<Integer, Integer> entry : denominations.entrySet()) {
            int note = entry.getKey();
            int available = entry.getValue();
            if (available <= 0) continue;

            int needed = Math.min(remaining / note, available);
            if (needed > 0) {
                plan.put(note, needed);
                remaining -= needed * note;
            }
        }
        return remaining == 0 ? Optional.of(plan) : Optional.empty();
    }

    public synchronized Map<Integer, Integer> dispense(int amount) {
        Map<Integer, Integer> plan = breakdown(amount)
            .orElseThrow(() -> new IllegalStateException("Cannot dispense exact amount with available denominations"));

        for (Map.Entry<Integer, Integer> entry : plan.entrySet()) {
            denominations.put(entry.getKey(), denominations.get(entry.getKey()) - entry.getValue());
        }
        return plan;
    }
}

class CardReader {
    public void eject() {
        // stand-in for hardware eject
    }
}

// ---------------------------------------------------------------------------
// Transaction record
// ---------------------------------------------------------------------------

enum TransactionType {
    BALANCE_INQUIRY,
    WITHDRAWAL,
    DEPOSIT
}

record Transaction(TransactionType type, double amount, double resultingBalance) {
    public Transaction(TransactionType type, double resultingBalance) {
        this(type, 0.0, resultingBalance);
    }
}

// ---------------------------------------------------------------------------
// State pattern: ATMState hierarchy
// ---------------------------------------------------------------------------

class InvalidOperationException extends RuntimeException {
    public InvalidOperationException(String message) {
        super(message);
    }
}

abstract class ATMState {
    protected final ATM atm;

    public ATMState(ATM atm) {
        this.atm = atm;
    }

    public void insertCard(Card card) {
        throw new InvalidOperationException("Cannot insert card in " + getName() + " state");
    }

    public void enterPin(String pin) {
        throw new InvalidOperationException("Cannot enter PIN in " + getName() + " state");
    }

    public Optional<Transaction> selectTransaction(TransactionType transactionType, double amount) {
        throw new InvalidOperationException("Cannot select transaction in " + getName() + " state");
    }

    public void ejectCard() {
        throw new InvalidOperationException("Cannot eject card in " + getName() + " state");
    }

    public String getName() {
        return getClass().getSimpleName();
    }
}

class IdleState extends ATMState {
    public IdleState(ATM atm) { super(atm); }

    @Override
    public void insertCard(Card card) {
        atm.setCurrentCard(card);
        atm.setPinAttempts(0);
        atm.setState(new HasCardState(atm));
        System.out.println("Card inserted. Please enter your PIN.");
    }
}

class HasCardState extends ATMState {
    public static final int MAX_PIN_ATTEMPTS = 3;

    public HasCardState(ATM atm) { super(atm); }

    @Override
    public void enterPin(String pin) {
        Card card = atm.getCurrentCard();
        if (card == null) return;

        if (pin.equals(card.pin())) {
            atm.setState(new AuthenticatedState(atm));
            System.out.println("PIN correct. Please select a transaction.");
        } else {
            atm.setPinAttempts(atm.getPinAttempts() + 1);
            int remaining = MAX_PIN_ATTEMPTS - atm.getPinAttempts();
            if (remaining <= 0) {
                System.out.println("Too many incorrect attempts. Ejecting card.");
                ejectCard();
            } else {
                System.out.println("Incorrect PIN. " + remaining + " attempt(s) remaining.");
            }
        }
    }

    @Override
    public void ejectCard() {
        atm.setCurrentCard(null);
        atm.setState(new IdleState(atm));
        System.out.println("Card ejected.");
    }
}

class AuthenticatedState extends ATMState {
    public AuthenticatedState(ATM atm) { super(atm); }

    @Override
    public Optional<Transaction> selectTransaction(TransactionType transactionType, double amount) {
        atm.setState(new TransactionState(atm));
        return atm.getState().selectTransaction(transactionType, amount);
    }

    @Override
    public void ejectCard() {
        atm.setCurrentCard(null);
        atm.setState(new IdleState(atm));
        System.out.println("Card ejected.");
    }
}

class TransactionState extends ATMState {
    public TransactionState(ATM atm) { super(atm); }

    @Override
    public Optional<Transaction> selectTransaction(TransactionType transactionType, double amount) {
        Card card = atm.getCurrentCard();
        if (card == null) return Optional.empty();
        BankAccount account = card.account();

        Transaction txn;
        switch (transactionType) {
            case BALANCE_INQUIRY -> {
                txn = new Transaction(TransactionType.BALANCE_INQUIRY, account.getBalance());
                System.out.printf("Current balance: $%.2f
", account.getBalance());
            }
            case WITHDRAWAL -> {
                int amountInt = (int) amount;
                if (amountInt > account.getBalance()) {
                    System.out.println("Transaction declined: insufficient account balance.");
                    returnToAuthenticated();
                    return Optional.empty();
                }
                if (!atm.getCashDispenser().canDispense(amountInt)) {
                    System.out.println("Transaction declined: ATM cannot dispense this exact amount.");
                    returnToAuthenticated();
                    return Optional.empty();
                }

                Map<Integer, Integer> notes = atm.getCashDispenser().dispense(amountInt);
                account.withdraw(amountInt);
                List<String> noteSummary = notes.entrySet().stream()
                    .map(e -> e.getValue() + "x$" + e.getKey())
                    .toList();
                System.out.println("Dispensing $" + amountInt + ": " + String.join(", ", noteSummary));
                txn = new Transaction(TransactionType.WITHDRAWAL, amountInt, account.getBalance());
            }
            case DEPOSIT -> {
                account.deposit(amount);
                System.out.printf("Deposited $%.2f. New balance: $%.2f
", amount, account.getBalance());
                txn = new Transaction(TransactionType.DEPOSIT, amount, account.getBalance());
            }
            default -> throw new IllegalArgumentException("Unknown transaction type: " + transactionType);
        }

        returnToAuthenticated();
        return Optional.of(txn);
    }

    private void returnToAuthenticated() {
        atm.setState(new AuthenticatedState(atm));
    }

    @Override
    public void ejectCard() {
        // Allow cancelling mid-transaction
        atm.setCurrentCard(null);
        atm.setState(new IdleState(atm));
        System.out.println("Transaction cancelled. Card ejected.");
    }
}

// ---------------------------------------------------------------------------
// ATM: Context Object
// ---------------------------------------------------------------------------

class ATM {
    private final CashDispenser cashDispenser;
    private final CardReader cardReader = new CardReader();
    private Card currentCard;
    private int pinAttempts = 0;
    private ATMState state;

    public ATM(CashDispenser cashDispenser) {
        this.cashDispenser = cashDispenser;
        this.state = new IdleState(this);
    }

    public synchronized void setState(ATMState state) {
        this.state = state;
    }

    public synchronized void insertCard(Card card) {
        state.insertCard(card);
    }

    public synchronized void enterPin(String pin) {
        state.enterPin(pin);
    }

    public synchronized Optional<Transaction> selectTransaction(TransactionType type, double amount) {
        return state.selectTransaction(type, amount);
    }

    public synchronized Optional<Transaction> selectTransaction(TransactionType type) {
        return selectTransaction(type, 0.0);
    }

    public synchronized void ejectCard() {
        state.ejectCard();
    }

    public CashDispenser getCashDispenser() { return cashDispenser; }
    public Card getCurrentCard() { return currentCard; }
    public void setCurrentCard(Card card) { this.currentCard = card; }
    public int getPinAttempts() { return pinAttempts; }
    public void setPinAttempts(int attempts) { this.pinAttempts = attempts; }
    public ATMState getState() { return state; }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

public class ATMDemo {
    public static void main(String[] args) {
        CashDispenser dispenser = new CashDispenser(Map.of(100, 5, 50, 10, 20, 20, 10, 20));
        ATM atm = new ATM(dispenser);

        BankAccount account = new BankAccount("ACC-001", 500.0);
        Card card = new Card("4111-XXXX", "1234", account);

        System.out.println("--- Wrong PIN then correct PIN ---");
        atm.insertCard(card);
        atm.enterPin("0000"); // wrong
        atm.enterPin("1234"); // correct

        System.out.println("
--- Balance inquiry ---");
        atm.selectTransaction(TransactionType.BALANCE_INQUIRY);

        System.out.println("
--- Withdraw $270 ---");
        atm.selectTransaction(TransactionType.WITHDRAWAL, 270);

        System.out.println("
--- Attempt an invalid operation: insert card mid-session ---");
        try {
            atm.insertCard(card);
        } catch (InvalidOperationException e) {
            System.out.println("Rejected as expected: " + e.getMessage());
        }

        System.out.println("
--- Deposit $150 ---");
        atm.selectTransaction(TransactionType.DEPOSIT, 150);

        System.out.println("
--- Eject card ---");
        atm.ejectCard();

        System.out.printf("
Final account balance: $%.2f
", account.getBalance());
        System.out.println("Remaining cash in ATM: $" + dispenser.totalCash());
    }
}
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
