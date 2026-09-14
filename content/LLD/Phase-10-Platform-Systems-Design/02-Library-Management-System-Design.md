# Library Management System — Design Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities](#2-step-2-identify-entities)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Key Decisions](#9-key-decisions)
10. [Interview Follow-ups](#10-interview-follow-ups)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements (in scope)
- Members can **search the catalog** by title, author, or ISBN.
- Members can **issue (borrow)** an available physical copy of a book and **return** it.
- If all copies of a book are checked out, a member can **place a hold/reservation**;
  when a copy is returned, the next person in the hold queue is notified.
- Members who return a book **after the due date** are charged a **fine**.
- A `Librarian` role can add/remove books and copies, and manually check items in/out.

### Out of Scope
- Digital/e-book lending and DRM.
- Inter-library loans.
- Payment processing for fines (assume a `Fine` is recorded; charging it is another
  system's job).

### Non-Functional Requirements
- Catalog search must scale to a large number of titles — search is decoupled from the
  transactional issue/return path.
- Every physical copy needs independent state (one copy of "Clean Code" can be checked
  out while another sits on the shelf) — this drives the `Book` vs `BookItem` split.

---

## 2. Step 2: Identify Entities

| Entity | Represents |
|--------|-----------|
| `Book` | Catalog-level metadata: title, author, ISBN, subject — **not** a physical object |
| `BookItem` | One physical copy of a `Book`, with its own barcode and status |
| `Member` | A library patron who can borrow books |
| `Librarian` | Staff who manage the catalog and manually process transactions |
| `IssueRecord` (Loan) | A record of one `BookItem` being borrowed by one `Member`, with due date |
| `Reservation` (Hold) | A `Member`'s place in line for a `Book` that's fully checked out |
| `Fine` | A monetary penalty tied to a late `IssueRecord` |
| `Catalog` | Search interface over all `Book`s |

The `Book` / `BookItem` split is the single most important modeling decision in this
problem — call it out explicitly in an interview.

---

## 3. Step 3: Define Relationships

```
Book         "1" ────── "*" BookItem         (composition — a copy belongs to exactly one title)
Member       "1" ────── "*" IssueRecord      (association — a member's borrowing history)
BookItem     "1" ────── "0..*" IssueRecord   (association — a copy's borrowing history over time)
Book         "1" ────── "*" Reservation      (composition — holds are against the title, not a specific copy)
Member       "1" ────── "*" Reservation      (association)
IssueRecord  "1" ────── "0..1" Fine          (composition — a fine only exists because a loan was late)
Librarian    "1" ────── "*" BookItem         (association — manages, doesn't own)
```

Key point: a **hold is placed on a `Book` (the title)**, not a specific `BookItem` (copy)
— any copy becoming available can satisfy the reservation. This is a common interview
trip-up; get it right and call it out.

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibilities |
|-------|-------------------|
| `Catalog` | Index `Book`s by title/author/ISBN; return search results |
| `Book` | Hold metadata; track its list of `BookItem`s; expose `available_copies()` |
| `BookItem` | Hold its own status (`AVAILABLE`, `LOANED`, `RESERVED`, `LOST`); barcode |
| `Member` | Hold current loans and reservations; enforce a max-loans-per-member cap |
| `IssueRecord` | Hold issue date, due date, return date; compute `is_overdue()` and days late |
| `FineCalculator` | Compute the fine amount for a given `IssueRecord` (kept OUT of `IssueRecord` — pluggable policy) |
| `Reservation` | Hold member + book + queue position + status |
| `LibraryService` | Orchestrate issue/return/reserve flows across the above — the façade members and librarians actually call |

---

## 5. Step 5: Apply SOLID

| Principle | Applied how |
|-----------|-------------|
| **SRP** | `IssueRecord` only tracks dates and overdue status; it does NOT compute the fine amount — that's `FineCalculator`'s job |
| **OCP** | New fine policies (flat-rate, per-day, capped) are new `FineCalculator` implementations; `LibraryService.return_book()` never changes |
| **LSP** | Any `FineCalculator` implementation must accept an `IssueRecord` and return a non-negative `float` — no throwing on "no fine due", just return `0.0` |
| **ISP** | `LibraryService` exposes separate, focused methods (`issue_book`, `return_book`, `place_reservation`) rather than one giant `process(action, ...)` method that forces callers to know about every action's parameters |
| **DIP** | `LibraryService` depends on `FineCalculator` (interface) and `Catalog` (interface over storage), not concrete implementations — swappable for tests |

---

## 6. Step 6: Apply Design Patterns

The dominant pattern here is not a GoF pattern applied wholesale — it's **strategy for
fine calculation** plus a clean **state model** for `BookItem`/`IssueRecord`. Over-applying
patterns (e.g., forcing Observer where nobody needs to react to book returns) is a common
interview mistake — resist it.

### Strategy — Fine Calculation

```python
from abc import ABC, abstractmethod
from datetime import date


class FineCalculator(ABC):
    @abstractmethod
    def calculate(self, issue_record: "IssueRecord") -> float: ...


class PerDayFineCalculator(FineCalculator):
    def __init__(self, rate_per_day: float = 0.50, grace_days: int = 0):
        self.rate_per_day = rate_per_day
        self.grace_days = grace_days

    def calculate(self, issue_record: "IssueRecord") -> float:
        days_late = issue_record.days_overdue()
        billable_days = max(0, days_late - self.grace_days)
        return round(billable_days * self.rate_per_day, 2)


class CappedFineCalculator(FineCalculator):
    def __init__(self, inner: FineCalculator, max_fine: float):
        self.inner = inner
        self.max_fine = max_fine

    def calculate(self, issue_record: "IssueRecord") -> float:
        return min(self.inner.calculate(issue_record), self.max_fine)
```

`CappedFineCalculator` wraps another `FineCalculator` — a small Decorator-flavored
composition that lets you cap *any* underlying policy without editing it.

### Simple State Modeling — BookItem / IssueRecord

```python
from enum import Enum, auto
from datetime import date, timedelta


class BookItemStatus(Enum):
    AVAILABLE = auto()
    LOANED = auto()
    RESERVED = auto()
    LOST = auto()


class BookItem:
    def __init__(self, barcode: str, book: "Book"):
        self.barcode = barcode
        self.book = book
        self.status = BookItemStatus.AVAILABLE

    def checkout(self) -> None:
        if self.status != BookItemStatus.AVAILABLE:
            raise ValueError(f"Item {self.barcode} is not available")
        self.status = BookItemStatus.LOANED

    def check_in(self) -> None:
        self.status = BookItemStatus.AVAILABLE


class IssueRecord:
    LOAN_PERIOD_DAYS = 14

    def __init__(self, member: "Member", item: BookItem, issue_date: date):
        self.member = member
        self.item = item
        self.issue_date = issue_date
        self.due_date = issue_date + timedelta(days=self.LOAN_PERIOD_DAYS)
        self.return_date: date | None = None

    def days_overdue(self, as_of: date | None = None) -> int:
        reference = self.return_date or as_of or date.today()
        return max(0, (reference - self.due_date).days)

    def is_overdue(self, as_of: date | None = None) -> bool:
        return self.days_overdue(as_of) > 0
```

### LibraryService — Orchestration (Facade-flavored)

```python
class LibraryService:
    def __init__(self, catalog: "Catalog", fine_calculator: FineCalculator):
        self.catalog = catalog
        self.fine_calculator = fine_calculator
        self._active_loans: dict[str, IssueRecord] = {}   # barcode -> IssueRecord

    def issue_book(self, member: "Member", item: BookItem) -> IssueRecord:
        item.checkout()
        record = IssueRecord(member, item, date.today())
        self._active_loans[item.barcode] = record
        member.loans.append(record)
        return record

    def return_book(self, item: BookItem) -> float:
        record = self._active_loans.pop(item.barcode)
        record.return_date = date.today()
        item.check_in()
        fine_amount = self.fine_calculator.calculate(record)
        if fine_amount > 0:
            record.member.fines.append(Fine(record, fine_amount))
        self._promote_next_reservation(item.book)
        return fine_amount

    def _promote_next_reservation(self, book: "Book") -> None:
        if book.reservation_queue:
            next_reservation = book.reservation_queue.pop(0)
            next_reservation.notify_available()
```

---

## 7. Step 7: Explain Extensibility

| New requirement | How the design absorbs it |
|------------------|----------------------------|
| E-book lending | Introduce `EBookItem` implementing the same `checkout()`/`check_in()` contract but without a physical barcode — `LibraryService` is unaffected if both share a common `Lendable` interface |
| Membership tiers with different loan limits/fine rates | `Member` gains a `MembershipTier`; `FineCalculator` picks a rate from the tier — no change to `IssueRecord` |
| Multiple branches | `BookItem` gains a `branch_id`; `Catalog.search()` optionally filters by branch — `Book`/`Member` untouched |
| Renewals | Add `IssueRecord.renew()` that pushes `due_date` forward, guarded by "no pending reservations for this book" — fits inside existing `IssueRecord` |
| Fine waivers by librarians | `Librarian` gets a `waive_fine(fine)` method that sets `fine.waived = True` — `FineCalculator` logic doesn't change, only the record's final state |

---

## 8. Class Diagram

```
┌───────────┐        ┌────────────┐
│  Catalog  │───────▶│    Book    │
└───────────┘ search └────────────┘
                          │1
                          │*
                     ┌────┴─────┐
                     │ BookItem │
                     │ status   │
                     └────┬─────┘
                          │0..*
                          ▼
                  ┌───────────────┐        ┌──────────┐
                  │  IssueRecord  │───────▶│  Member  │
                  │ issue_date    │        └──────────┘
                  │ due_date      │              │1
                  │ return_date   │              │*
                  └──────┬────────┘        ┌─────┴──────┐
                          │0..1            │ Reservation │
                          ▼                └─────────────┘
                     ┌────────┐
                     │  Fine  │
                     └────────┘

┌────────────────────┐
│ FineCalculator (ABC)│
│ + calculate(record)  │
└──────────▲───────────┘
           │
 ┌─────────┴──────────┐
 │ PerDayFineCalculator │
 │ CappedFineCalculator │
 └──────────────────────┘
```

---

## 9. Key Decisions

- **Why split `Book` and `BookItem`?** Availability, condition, and loan history are
  per-physical-copy, but title/author/ISBN metadata is shared — modeling them as one
  class would force duplicated metadata across copies or awkward copy-counting logic
  bolted onto a "Book".
- **Why is a reservation against a `Book`, not a `BookItem`?** A member waiting for "Clean
  Code" doesn't care which physical copy they get — binding a hold to one specific copy
  would create false unavailability when a different copy is returned first.
- **Why is `FineCalculator` separate from `IssueRecord`?** Fine policy is a business rule
  that changes independently of what a loan record fundamentally is (who, what, when) —
  keeping it separate means policy changes never touch the loan data model.
- **Why does `LibraryService` own the promote-next-reservation logic instead of
  `BookItem.check_in()`?** `BookItem` shouldn't need to know about the reservation queue
  of its `Book` — that's an orchestration concern spanning two aggregates, which belongs
  in a service layer, not inside a single entity.

---

## 10. Interview Follow-ups

- "How do you prevent two members from checking out the same copy simultaneously?" →
  Discuss `BookItem.checkout()` needing to be atomic (a DB-level `UPDATE ... WHERE status
  = AVAILABLE` in a real system, or a lock in-memory).
- "What if a member loses a book?" → Add a `LOST` status to `BookItemStatus`, a
  `LibraryService.report_lost()` method that closes the `IssueRecord` and applies a
  replacement-cost fine via a different `FineCalculator` policy.
- "How would you support a max number of concurrent holds per member?" → Enforce it in
  `LibraryService.place_reservation()` by checking `len(member.reservations)` before
  appending — a service-layer invariant, not a `Member` invariant, since it depends on
  library-wide policy.
- "Search must support fuzzy/partial title matches at scale — does your `Catalog` design
  still hold?" → `Catalog` is already an interface in front of storage; swap a
  dictionary-based index for an inverted index or external search service (Elasticsearch)
  without touching `LibraryService`.

---

## 11. Interview Q&A

**Q: Why not merge `Book` and `BookItem` into a single class with a `copies_available` counter?**
Answer: A counter loses information — you can't tell which specific copy is overdue, who has it, or its condition/barcode. Real libraries need per-copy state (a lost copy vs. an available one vs. one out on loan), and `IssueRecord`/`Reservation` need to reference a specific physical item or a queued title respectively. Splitting `Book` (catalog metadata) from `BookItem` (physical, stateful copy) models this precisely and mirrors how the real-world entities behave.

**Q: Why is `FineCalculator` a Strategy instead of a `calculate_fine()` method on `IssueRecord`?**
Answer: Fine policy (flat rate, per-day, capped, grace period, membership-tier-based) is a business rule that changes far more often than the definition of a loan itself. Coupling it to `IssueRecord` would mean every policy change requires editing and redeploying the loan model. As a Strategy, `LibraryService` injects whichever `FineCalculator` is active, and new policies are added without touching `IssueRecord` — OCP in action.

**Q: How does a reservation get fulfilled when a copy is returned?**
Answer: `LibraryService.return_book()` calls `item.check_in()` to free the copy, then checks `book.reservation_queue` — if non-empty, it pops the earliest reservation and notifies that member the book is available (holding the copy for them, typically with a pickup deadline). This orchestration lives in `LibraryService` rather than `BookItem` because it spans two aggregates (the item and the book's reservation queue).

**Q: What object-oriented relationship exists between `IssueRecord` and `Fine`?**
Answer: Composition — a `Fine` only exists because a specific `IssueRecord` was returned late; it has no independent lifecycle or meaning without that loan. If the `IssueRecord` were somehow purged, its associated `Fine` would go with it. Contrast this with `Member` to `IssueRecord`, which is association — a member's loan history is a collection of independently meaningful records the member happens to be linked to.

**Q: How would you extend this design to support both physical books and e-books without duplicating the issue/return logic?**
Answer: Define a common interface (e.g., `Lendable` with `checkout()`/`check_in()`) that both `BookItem` and a new `EBookItem` implement. `LibraryService.issue_book()`/`return_book()` would operate against `Lendable` rather than the concrete `BookItem`, so the orchestration code is untouched — only a new class is added. E-book-specific behavior (DRM expiry, no physical location) lives inside `EBookItem` itself.

**Q: Why does `Member` hold references to its own `loans` and `fines` lists rather than the system computing them on demand by scanning all records?**
Answer: Either approach is defensible, but holding direct references on `Member` gives O(1) access to "what does this member currently owe/have out" — a very common query (checkout eligibility, fine payment) — at the cost of keeping two places in sync. In an interview, name the trade-off explicitly: denormalized-for-read-speed vs. single-source-of-truth, and note that in a persisted system this would likely be a query against `IssueRecord`/`Fine` tables filtered by member, with the in-memory list as a cache.
