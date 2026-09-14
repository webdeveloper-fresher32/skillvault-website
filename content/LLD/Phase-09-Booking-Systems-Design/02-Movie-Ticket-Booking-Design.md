# Movie Ticket Booking Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Preventing Double-Booking of Seats](#9-preventing-double-booking-of-seats)
10. [Python Skeleton](#10-python-skeleton)
11. [Key Decisions](#11-key-decisions)
12. [Interview Follow-ups](#12-interview-follow-ups)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements
- Users can **browse movies**, view **theatres and shows** (a show = a movie playing on a specific screen at a specific time).
- Users can view a **seat map** for a show and **select seats**.
- Users **hold** selected seats temporarily, then **pay** to confirm the booking; unpaid holds expire and release the seats.
- The system must **never sell the same seat twice** for the same show, even under concurrent requests.
- Support **cancellation** with seat release.

### Clarifying Questions
- Is this single-city or multi-city, single cinema chain or aggregator across chains? *(Assume: single chain, multiple theatres/screens/shows.)*
- How long does a seat "hold" last before auto-release? *(Assume: configurable, default 5-10 minutes.)*
- Do different seat categories (Silver/Gold/Premium) have different prices? *(Assume: yes.)*
- Peak load — thousands of users hitting "book" for the same popular show simultaneously — must handle high contention on a small set of seats. *(Design implication: pessimistic locking or DB-level constraints are needed, not naive read-then-write.)*

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|-------|------|-----------------|
| `Movie` | Domain | Title, duration, genre, language |
| `Theatre` | Domain | Location, owns multiple `Screen`s |
| `Screen` | Domain | Physical screen, owns a fixed `Seat` layout |
| `Show` | Domain | A `Movie` scheduled on a `Screen` at a start time; owns per-show seat status |
| `Seat` | Domain | Seat number, category (row/type) — layout-level, shared across shows on that screen |
| `ShowSeat` | Domain | Per-show booking status of a `Seat` (AVAILABLE / LOCKED / BOOKED) — this is what actually gets locked |
| `User` | Domain | Booking account |
| `Booking` | Domain | A confirmed reservation of a set of `ShowSeat`s for a `User` |
| `Payment` | Domain | Amount, method, status |
| `SeatLockManager` | Service | Handles temporary holds + expiry (the concurrency-critical piece) |
| `BookingService` | Service (Facade) | Orchestrates search → lock → pay → confirm |

---

## 3. Step 3: Define Relationships

```
Theatre    1 ────── * Screen
Screen     1 ────── * Seat            (fixed physical layout)
Screen     1 ────── * Show            (many shows use the same screen over time)
Show       1 ────── * ShowSeat        (one ShowSeat per Seat, per Show — composition)
ShowSeat   * ────── 1 Seat            (reference to the physical seat)
Booking    1 ────── * ShowSeat        (a booking covers 1+ seats)
Booking    1 ────── 1 User
Booking    1 ────── 0..1 Payment
Movie      1 ────── * Show
```

Key modeling decision: **`Seat` (physical) and `ShowSeat` (per-show status) are separate classes.** A theatre's seat layout doesn't change per show, but booking status absolutely does — conflating them would mean re-creating seat layout data for every show instead of just seat-status rows.

---

## 4. Step 4: Assign Responsibilities

- **`Screen`**: owns the static seat layout (`List[Seat]`).
- **`Show`**: creates one `ShowSeat` per `Seat` when scheduled; exposes `available_seats()`.
- **`ShowSeat`**: the unit of concurrency control — holds a status enum and the lock/version metadata. Knows how to transition AVAILABLE → LOCKED → BOOKED and back.
- **`SeatLockManager`**: the only component allowed to mutate `ShowSeat` status during the hold phase; enforces hold expiry (via a scheduled sweep or lazy check-on-read).
- **`BookingService`**: orchestrates the full flow (lock seats → collect payment → confirm booking → release lock on failure); the only class that talks to both `SeatLockManager` and `Payment`.
- **`Booking`**: pure record of what was purchased — no behavior beyond `cancel()`.

---

## 5. Step 5: Apply SOLID

| Principle | Applied How |
|-----------|-------------|
| **SRP** | `Show` manages scheduling/seat-instantiation; `SeatLockManager` manages concurrency; `BookingService` orchestrates; `Payment` only tracks payment state. |
| **OCP** | New seat categories (Recliner) or new payment methods plug in without touching `BookingService`'s control flow. |
| **LSP** | Any `PaymentStrategy` implementation can substitute another without breaking `BookingService`. |
| **ISP** | `SeatLockManager` only exposes `lock()`, `release()`, `confirm()` — clients don't depend on internal expiry-sweep methods. |
| **DIP** | `BookingService` depends on `PaymentStrategy` and `SeatLockManager` abstractions, not concrete payment gateways or a concrete locking mechanism (in-memory vs Redis-backed). |

---

## 6. Step 6: Apply Design Patterns

- **State** — `ShowSeat` status (`AVAILABLE → LOCKED → BOOKED`, and `LOCKED → AVAILABLE` on expiry/cancel) is a textbook State pattern; each state disallows invalid transitions (e.g., can't lock an already-BOOKED seat).
- **Strategy** — `PaymentStrategy` (Card/UPI/Wallet) pluggable without touching `BookingService`.
- **Observer** — notify `User` (via email/SMS) on booking confirmation or hold-expiry without `BookingService` depending on notification channels directly.
- **Facade** — `BookingService` hides the multi-step choreography (search → lock → pay → confirm) behind a simple `book_seats()` call for API/controller code.

---

## 7. Step 7: Explain Extensibility

1. **New seat category (Recliner)** — add to the `SeatCategory` enum + a pricing rule; `ShowSeat`/`Show`/`BookingService` logic is untouched.
2. **Dynamic pricing (surge for last-minute/high-demand shows)** — swap in a `DynamicPricingStrategy` when computing seat price at lock-time; no change to seat-locking logic.
3. **Group booking / waitlist when show is full** — add a `Waitlist` service that listens (Observer) for `ShowSeat` release events and offers seats first-come-first-served; core classes unchanged.
4. **Multiple cinema chains (aggregator)** — introduce a `TheatreChain` abstraction above `Theatre`; `Show`/`ShowSeat`/`BookingService` remain valid per-theatre building blocks.

---

## 8. Class Diagram

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Movie   │──1..*│   Show   │*────1│  Screen  │1────*│ Theatre  │
└──────────┘      └────┬─────┘      └────┬─────┘      └──────────┘
                       │1..*             │1..*
                       ▼                 ▼
                 ┌──────────┐      ┌──────────┐
                 │ ShowSeat │*────1│   Seat   │
                 ├──────────┤      ├──────────┤
                 │ - status │      │ - number │
                 │ - lock_  │      │ - category│
                 │   token  │      └──────────┘
                 ├──────────┤
                 │+lock()   │
                 │+confirm()│
                 │+release()│
                 └────┬─────┘
                      │*
                      ▼
                 ┌──────────┐        ┌────────────────┐
                 │ Booking  │───────▶│    Payment      │
                 ├──────────┤ 0..1   ├────────────────┤
                 │ - user   │        │ - amount        │
                 │ - seats  │        │ - status        │
                 │ - status │        └────────────────┘
                 └────┬─────┘
                      │1
                      ▼
                 ┌──────────┐        ┌───────────────────┐
                 │   User   │        │  SeatLockManager    │
                 └──────────┘        ├───────────────────┤
                                     │ + lock(seats, ttl) │
                                     │ + confirm(token)   │
                                     │ + release(token)   │
                                     └───────────────────┘
```

---

## 9. Preventing Double-Booking of Seats

Two workable approaches — explain both, pick one, justify it:

**A. Pessimistic locking (hold-based, chosen here)**
1. User selects seats → `SeatLockManager.lock(seats, user, ttl=10min)`.
2. Lock succeeds only if *every* requested `ShowSeat` is currently `AVAILABLE`; the transition to `LOCKED` happens atomically per seat (DB row-level lock / `SELECT ... FOR UPDATE`, or a compare-and-swap on status + version in an in-memory/Redis model).
3. If any seat is already `LOCKED`/`BOOKED`, the whole lock request fails fast (all-or-nothing) — no partial holds.
4. User pays within the TTL → `confirm(token)` transitions `LOCKED → BOOKED` and creates the `Booking`.
5. If TTL expires without payment, a background sweep (or lazy check on next read) transitions `LOCKED → AVAILABLE` again.

**B. Optimistic concurrency (version-based)**
1. Each `ShowSeat` carries a `version` integer.
2. To book, read current `version`, then attempt `UPDATE show_seats SET status='BOOKED', version=version+1 WHERE seat_id=? AND version=? AND status='AVAILABLE'`.
3. If the update affects 0 rows, someone else won it first — retry or fail. No holds/TTLs needed, but poorer UX (user fills payment form, then finds seat gone) unless combined with a short-lived hold.

**Why pessimistic-with-TTL is preferred for this problem**: movie seat selection has a real user-facing "hold while I pay" step, so a short lock is expected UX, not just a concurrency trick — optimistic-only would let users lose a seat *after* entering payment details, which is a bad experience. In practice, production systems often combine both: a short pessimistic hold implemented via optimistic version checks under the hood.

---

## 10. Python Skeleton

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from threading import Lock
from typing import Dict, List, Optional
import uuid


class SeatStatus(Enum):
    AVAILABLE = auto()
    LOCKED = auto()
    BOOKED = auto()


@dataclass
class Seat:
    seat_id: str
    row: str
    number: int
    category: str  # SILVER / GOLD / PREMIUM


class ShowSeat:
    """Per-show booking status of a physical Seat — the unit of concurrency control."""
    def __init__(self, seat: Seat):
        self.seat = seat
        self.status = SeatStatus.AVAILABLE
        self.lock_token: Optional[str] = None
        self.lock_expiry: Optional[datetime] = None
        self._lock = Lock()

    def try_lock(self, token: str, ttl_seconds: int) -> bool:
        with self._lock:
            self._expire_if_needed()
            if self.status != SeatStatus.AVAILABLE:
                return False
            self.status = SeatStatus.LOCKED
            self.lock_token = token
            self.lock_expiry = datetime.now() + timedelta(seconds=ttl_seconds)
            return True

    def confirm(self, token: str) -> bool:
        with self._lock:
            if self.status == SeatStatus.LOCKED and self.lock_token == token:
                self.status = SeatStatus.BOOKED
                return True
            return False

    def release(self, token: str) -> None:
        with self._lock:
            if self.lock_token == token:
                self.status = SeatStatus.AVAILABLE
                self.lock_token = None
                self.lock_expiry = None

    def _expire_if_needed(self) -> None:
        if (self.status == SeatStatus.LOCKED and self.lock_expiry
                and datetime.now() > self.lock_expiry):
            self.status = SeatStatus.AVAILABLE
            self.lock_token = None
            self.lock_expiry = None


class Show:
    def __init__(self, show_id: str, movie: "Movie", screen: "Screen", start_time: datetime):
        self.show_id = show_id
        self.movie = movie
        self.screen = screen
        self.start_time = start_time
        self.show_seats: Dict[str, ShowSeat] = {
            seat.seat_id: ShowSeat(seat) for seat in screen.seats
        }

    def available_seats(self) -> List[ShowSeat]:
        return [s for s in self.show_seats.values() if s.status == SeatStatus.AVAILABLE]


@dataclass
class Movie:
    movie_id: str
    title: str
    duration_minutes: int


@dataclass
class Screen:
    screen_id: str
    seats: List[Seat]


@dataclass
class Theatre:
    theatre_id: str
    name: str
    screens: List[Screen]


class SeatLockManager:
    """Coordinates all-or-nothing locking across multiple ShowSeats for one request."""
    DEFAULT_TTL_SECONDS = 600

    def lock(self, show: Show, seat_ids: List[str]) -> Optional[str]:
        token = str(uuid.uuid4())
        locked: List[ShowSeat] = []
        for sid in seat_ids:
            show_seat = show.show_seats[sid]
            if show_seat.try_lock(token, self.DEFAULT_TTL_SECONDS):
                locked.append(show_seat)
            else:
                # All-or-nothing: roll back any seats we already locked
                for s in locked:
                    s.release(token)
                return None
        return token

    def confirm(self, show: Show, seat_ids: List[str], token: str) -> bool:
        return all(show.show_seats[sid].confirm(token) for sid in seat_ids)

    def release(self, show: Show, seat_ids: List[str], token: str) -> None:
        for sid in seat_ids:
            show.show_seats[sid].release(token)


@dataclass
class User:
    user_id: str
    name: str


@dataclass
class Payment:
    amount: float
    method: str
    status: str = "PENDING"


@dataclass
class Booking:
    booking_id: str
    user: User
    show: Show
    seat_ids: List[str]
    payment: Optional[Payment] = None
    status: str = "PENDING"


class PaymentStrategy:
    def pay(self, amount: float) -> Payment:
        raise NotImplementedError


class CreditCardPayment(PaymentStrategy):
    def pay(self, amount: float) -> Payment:
        return Payment(amount=amount, method="CARD", status="PAID")


class BookingService:
    """Facade orchestrating search -> lock -> pay -> confirm."""
    def __init__(self, lock_manager: SeatLockManager, payment_strategy: PaymentStrategy):
        self.lock_manager = lock_manager
        self.payment_strategy = payment_strategy

    def book_seats(self, user: User, show: Show, seat_ids: List[str], price_per_seat: float) -> Booking:
        token = self.lock_manager.lock(show, seat_ids)
        if token is None:
            raise RuntimeError("One or more seats are no longer available")
        try:
            payment = self.payment_strategy.pay(price_per_seat * len(seat_ids))
            if payment.status != "PAID":
                raise RuntimeError("Payment failed")
            self.lock_manager.confirm(show, seat_ids, token)
            return Booking(
                booking_id=str(uuid.uuid4()), user=user, show=show,
                seat_ids=seat_ids, payment=payment, status="CONFIRMED",
            )
        except Exception:
            self.lock_manager.release(show, seat_ids, token)
            raise
```

---

## 11. Key Decisions

- **`Seat` (layout) vs `ShowSeat` (per-show status) split** — avoids duplicating theatre layout data per show and makes it obvious what actually needs locking.
- **All-or-nothing locking across multiple seats** — a group booking of 4 seats must not leave 2 locked and 2 failed; `SeatLockManager.lock()` rolls back on any single failure.
- **Lock token instead of "locked by user_id"** — decouples the lock mechanism from user identity, lets the same user run parallel booking attempts safely, and makes release/confirm idempotent-checkable.
- **Lazy expiry check (`_expire_if_needed`) inside `try_lock`/read paths**, not solely a background sweep — guarantees correctness even if the sweep job is delayed; the sweep is just an optimization to reclaim seats proactively for browsing users.

---

## 12. Interview Follow-ups

- **How do you prevent double-booking under high concurrency for a popular show?** Combine per-seat atomic state transitions (DB row lock or CAS) with an all-or-nothing multi-seat lock; reject fast rather than queueing, since users expect an immediate "seat taken" response.
- **What happens if payment fails after seats are locked?** `BookingService` catches the failure and calls `lock_manager.release()`, returning seats to `AVAILABLE` immediately rather than waiting for TTL expiry — good UX for other buyers.
- **How would you scale this across multiple servers (not just multiple threads)?** Move seat-lock state out of process memory into a shared store (Redis with `SETNX`/Lua script for atomic multi-key lock, or the DB with `SELECT...FOR UPDATE`), since `Lock()` objects in Python are per-process and won't coordinate across servers.
- **How do you handle a seat hold that a user abandons (closes tab)?** TTL-based expiry handles it automatically — no explicit "cancel" event needed; the seat becomes bookable again once `lock_expiry` passes.
- **How would you support a waitlist for sold-out shows?** Add a `Waitlist` per `Show`; when a `ShowSeat` transitions back to `AVAILABLE` (release/cancel), notify (Observer) the next waitlisted user with a short priority window to claim it before it's opened to general booking.

---

## 13. Interview Q&A

**Q: Why separate `Seat` and `ShowSeat` into two classes instead of one?**
Answer: `Seat` represents the fixed physical layout of a screen — it doesn't change between shows. `ShowSeat` represents booking status, which is specific to one showtime and changes constantly. Merging them would force re-creating full seat records per show and would tangle static layout data with highly mutable booking state, making the locking logic harder to reason about.

**Q: How do you guarantee two users can't book the same seat at the same time?**
Answer: Each `ShowSeat`'s status transition is guarded by an atomic operation — a per-object lock in-memory, or a `SELECT...FOR UPDATE`/conditional `UPDATE` in a real DB. `try_lock()` checks-and-sets `AVAILABLE → LOCKED` in one atomic step, so only one of two concurrent callers can win; the other gets `False` and must pick different seats.

**Q: What's the trade-off between pessimistic locking and optimistic concurrency for seat booking?**
Answer: Pessimistic locking (hold seats for N minutes while the user pays) gives good UX — the user won't lose a seat mid-payment — but requires TTL/expiry management and ties up inventory even for users who abandon checkout. Optimistic concurrency (attempt the booking and fail if the version changed) avoids holding inventory but risks a user completing a payment form only to find the seat gone. Real systems usually pick pessimistic-with-short-TTL for this exact UX reason.

**Q: Why lock all seats in a group booking atomically instead of one at a time?**
Answer: If seats are locked one-by-one and the 3rd of 4 fails, the user is left holding 2 seats they may not want individually — worse UX and wasted inventory. `SeatLockManager.lock()` locks all-or-nothing: if any seat fails, previously locked seats in that request are released immediately.

**Q: How would this design change if it needed to run across multiple application servers instead of one process?**
Answer: In-process `threading.Lock` only synchronizes within one process. Scaling out requires moving lock state to a shared store — Redis (atomic `SET NX EX` per seat, or a Lua script for multi-seat all-or-nothing locking) or the relational DB via row-level locks/conditional updates. The `SeatLockManager` interface stays the same; only its implementation changes — which is exactly why it's a dependency-injected abstraction.

**Q: Where would you add dynamic/surge pricing without breaking the booking flow?**
Answer: Introduce a `PricingStrategy` (Strategy pattern) that computes `price_per_seat` at lock-time based on demand, time-to-showtime, or seat category, and inject it into `BookingService`. `book_seats()` calls `pricing_strategy.price(show, seat_ids)` instead of taking a raw `price_per_seat` argument — no change to locking or payment orchestration.
