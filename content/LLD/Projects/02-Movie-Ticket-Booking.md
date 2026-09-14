# Project 2 — Movie Ticket Booking System

**Difficulty:** Medium
**Patterns used:** State (seat status lifecycle), Composition, simple pessimistic locking

---

## 1. Requirements

**Functional:**
- A `Movie` can play on multiple `Screen`s across a `Theatre`, each as a scheduled `Show`.
- Each `Screen` has a fixed layout of `Seat`s (with a category: `REGULAR`, `PREMIUM`).
- A user searches shows for a movie, picks seats for a specific show, and books them.
- Seats must never be double-booked — once a user starts checkout, the seat should be temporarily **locked** for other users until payment completes or the lock expires.
- On successful payment, seats move to `BOOKED`; a `Booking` record is created.

**Non-functional:**
- Seat-locking logic must prevent two concurrent bookings for the same seat in the same show.
- Pricing varies by seat category.

---

## 2. Class Diagram

```
┌───────────┐        ┌──────────────────┐        ┌───────────┐
│  Theatre   │───1..*─▶│      Screen      │───1..*─▶│   Seat    │
│───────────│        │──────────────────│        │───────────│
│ name       │        │ screen_id         │        │ seat_id    │
│ screens    │        │ seats: List[Seat] │        │ category   │
└───────────┘        └────────┬─────────┘        └───────────┘
                               │ 1..*
                               ▼
┌───────────┐        ┌──────────────────┐
│   Movie    │◀──1───│       Show        │
│───────────│        │──────────────────│
│ title      │        │ show_id           │
│ duration   │        │ movie, screen     │
└───────────┘        │ start_time        │
                      │ seat_status: Dict │◀── SeatStatus enum
                      │  {seat_id: status}│    (AVAILABLE / LOCKED / BOOKED)
                      └────────┬─────────┘
                               │ 1
                               ▼
                      ┌──────────────────┐        ┌───────────┐
                      │     Booking       │───1───▶│  Payment  │
                      │──────────────────│        │───────────│
                      │ booking_id         │        │ amount     │
                      │ show, seats, user  │        │ status     │
                      └──────────────────┘        └───────────┘

               ┌──────────────────────┐
               │   BookingManager      │  (facade / orchestrator)
               │──────────────────────│
               │ + lock_seats()        │
               │ + confirm_booking()   │
               │ + release_expired()   │
               └──────────────────────┘
```

---

## 3. Full Implementation

```python
"""
Movie Ticket Booking — single-file runnable LLD reference implementation.
"""

from __future__ import annotations

import itertools
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SeatCategory(Enum):
    REGULAR = auto()
    PREMIUM = auto()


class SeatStatus(Enum):
    AVAILABLE = auto()
    LOCKED = auto()
    BOOKED = auto()


class PaymentStatus(Enum):
    PENDING = auto()
    SUCCESS = auto()
    FAILED = auto()


SEAT_PRICE: Dict[SeatCategory, float] = {
    SeatCategory.REGULAR: 10.0,
    SeatCategory.PREMIUM: 18.0,
}

LOCK_DURATION = timedelta(minutes=5)


# ---------------------------------------------------------------------------
# Core static entities
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Seat:
    seat_id: str
    category: SeatCategory


@dataclass
class Movie:
    title: str
    duration_minutes: int


class Screen:
    def __init__(self, screen_id: str, seats: List[Seat]):
        self.screen_id = screen_id
        self.seats = seats


class Theatre:
    def __init__(self, name: str, screens: List[Screen]):
        self.name = name
        self.screens = screens


# ---------------------------------------------------------------------------
# Show: a movie playing on a screen at a specific time, with live seat state
# ---------------------------------------------------------------------------

class Show:
    def __init__(self, show_id: str, movie: Movie, screen: Screen, start_time: datetime):
        self.show_id = show_id
        self.movie = movie
        self.screen = screen
        self.start_time = start_time
        self.seat_status: Dict[str, SeatStatus] = {
            seat.seat_id: SeatStatus.AVAILABLE for seat in screen.seats
        }
        self._lock_expiry: Dict[str, datetime] = {}
        self._seats_by_id: Dict[str, Seat] = {s.seat_id: s for s in screen.seats}

    def available_seats(self) -> List[Seat]:
        return [
            self._seats_by_id[sid]
            for sid, status in self.seat_status.items()
            if status == SeatStatus.AVAILABLE
        ]

    def _expire_stale_locks(self, now: datetime) -> None:
        for seat_id, expiry in list(self._lock_expiry.items()):
            if self.seat_status.get(seat_id) == SeatStatus.LOCKED and now >= expiry:
                self.seat_status[seat_id] = SeatStatus.AVAILABLE
                del self._lock_expiry[seat_id]

    def lock_seats(self, seat_ids: List[str], now: Optional[datetime] = None) -> bool:
        """Atomically lock a group of seats. Returns False if any seat is unavailable."""
        now = now or datetime.now()
        self._expire_stale_locks(now)

        for seat_id in seat_ids:
            if self.seat_status.get(seat_id) != SeatStatus.AVAILABLE:
                return False  # at least one seat already locked/booked -> abort, lock nothing

        for seat_id in seat_ids:
            self.seat_status[seat_id] = SeatStatus.LOCKED
            self._lock_expiry[seat_id] = now + LOCK_DURATION
        return True

    def confirm_seats(self, seat_ids: List[str]) -> None:
        for seat_id in seat_ids:
            if self.seat_status.get(seat_id) != SeatStatus.LOCKED:
                raise ValueError(f"Seat {seat_id} is not locked, cannot confirm")
        for seat_id in seat_ids:
            self.seat_status[seat_id] = SeatStatus.BOOKED
            self._lock_expiry.pop(seat_id, None)

    def release_seats(self, seat_ids: List[str]) -> None:
        for seat_id in seat_ids:
            if self.seat_status.get(seat_id) == SeatStatus.LOCKED:
                self.seat_status[seat_id] = SeatStatus.AVAILABLE
                self._lock_expiry.pop(seat_id, None)

    def price_for(self, seat_ids: List[str]) -> float:
        return sum(SEAT_PRICE[self._seats_by_id[sid].category] for sid in seat_ids)


# ---------------------------------------------------------------------------
# Booking + Payment
# ---------------------------------------------------------------------------

@dataclass
class Payment:
    amount: float
    status: PaymentStatus = PaymentStatus.PENDING


@dataclass
class Booking:
    booking_id: str
    user: str
    show: Show
    seat_ids: List[str]
    payment: Payment
    created_at: datetime = field(default_factory=datetime.now)


# ---------------------------------------------------------------------------
# BookingManager: orchestrates the lock -> pay -> confirm workflow
# ---------------------------------------------------------------------------

class SeatsUnavailableError(Exception):
    pass


class PaymentFailedError(Exception):
    pass


class BookingManager:
    def __init__(self):
        self._booking_counter = itertools.count(1)
        self.bookings: Dict[str, Booking] = {}

    def book(
        self,
        user: str,
        show: Show,
        seat_ids: List[str],
        payment_should_succeed: bool = True,
    ) -> Booking:
        locked = show.lock_seats(seat_ids)
        if not locked:
            raise SeatsUnavailableError(
                f"One or more seats in {seat_ids} are no longer available"
            )

        amount = show.price_for(seat_ids)
        payment = Payment(amount=amount)

        if not payment_should_succeed:
            payment.status = PaymentStatus.FAILED
            show.release_seats(seat_ids)
            raise PaymentFailedError(f"Payment of ${amount:.2f} failed; seats released")

        payment.status = PaymentStatus.SUCCESS
        show.confirm_seats(seat_ids)

        booking = Booking(
            booking_id=f"BKG-{next(self._booking_counter):04d}",
            user=user,
            show=show,
            seat_ids=seat_ids,
            payment=payment,
        )
        self.bookings[booking.booking_id] = booking
        return booking


# ---------------------------------------------------------------------------
# Helper: build a small demo theatre + show
# ---------------------------------------------------------------------------

def build_sample_show() -> Show:
    seats = (
        [Seat(f"A{i}", SeatCategory.PREMIUM) for i in range(1, 4)]
        + [Seat(f"B{i}", SeatCategory.REGULAR) for i in range(1, 6)]
    )
    screen = Screen("SCR-1", seats)
    theatre = Theatre("Cineplex Downtown", [screen])
    movie = Movie("The LLD Interview", duration_minutes=125)
    return Show(
        show_id="SHOW-001",
        movie=movie,
        screen=screen,
        start_time=datetime.now() + timedelta(hours=3),
    )


if __name__ == "__main__":
    show = build_sample_show()
    manager = BookingManager()

    print(f"Available seats before booking: {[s.seat_id for s in show.available_seats()]}")

    # User A books two premium seats successfully
    booking_a = manager.book("alice", show, ["A1", "A2"])
    print(f"\n{booking_a.booking_id}: alice booked {booking_a.seat_ids} "
          f"for ${booking_a.payment.amount:.2f} ({booking_a.payment.status.name})")

    # User B tries to book one of the same seats -> must fail, no double booking
    try:
        manager.book("bob", show, ["A1", "B1"])
    except SeatsUnavailableError as e:
        print(f"\nbob's booking rejected as expected: {e}")

    # User C books different seats, but payment fails -> seats must be released
    try:
        manager.book("carol", show, ["B2", "B3"], payment_should_succeed=False)
    except PaymentFailedError as e:
        print(f"\ncarol's booking failed as expected: {e}")

    print(f"\nAvailable seats after all attempts: {[s.seat_id for s in show.available_seats()]}")

    # carol retries and succeeds now that seats were released
    booking_c = manager.book("carol", show, ["B2", "B3"])
    print(f"\n{booking_c.booking_id}: carol booked {booking_c.seat_ids} "
          f"for ${booking_c.payment.amount:.2f} ({booking_c.payment.status.name})")

    print(f"\nFinal available seats: {[s.seat_id for s in show.available_seats()]}")
```

**Expected output:**

```
Available seats before booking: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5']

BKG-0001: alice booked ['A1', 'A2'] for $36.00 (SUCCESS)

bob's booking rejected as expected: One or more seats in ['A1', 'B1'] are no longer available

carol's booking failed as expected: Payment of $20.00 failed; seats released

Available seats after all attempts: ['A3', 'B1', 'B2', 'B3', 'B4', 'B5']

BKG-0002: carol booked ['B2', 'B3'] for $20.00 (SUCCESS)

Final available seats: ['A3', 'B1', 'B4', 'B5']
```

---

## 4. Design Decisions

- **Lock-before-pay, all-or-nothing:** `lock_seats` first checks that *every* requested seat is `AVAILABLE` before locking *any* of them — this avoids a partial-lock state where seat A1 gets locked for a user but seat B1 (already taken) causes the request to fail, leaving A1 stuck locked for no reason.
- **Status as an enum stored per-seat-per-show, not on the `Seat` object itself:** A `Seat` is a physical fixture on a `Screen` — its availability only makes sense *in the context of a specific `Show`*. Storing `seat_status` on `Show` (not on `Seat`) correctly models that the same physical seat is independently available across different showtimes.
- **Lock expiry as a lazy check:** Rather than running a background sweeper thread, `_expire_stale_locks` is called at the start of every `lock_seats` — simple, deterministic, and easy to unit test, at the cost of a stale lock only clearing on the next booking attempt (acceptable for this scope; see extensions for a real scheduler).
- **Payment failure rolls back the lock:** `book()` explicitly calls `release_seats` on payment failure so seats don't stay artificially locked until timeout — this is the same "compensating action" idea used in distributed transactions/sagas.

---

## 5. Possible Extensions

- **Background lock-expiry sweeper:** Run a scheduled job (or use `threading.Timer`) that proactively releases expired locks instead of only checking lazily on the next booking attempt, so seats become visibly available in real time.
- **Multiple theatres/cities search:** Add a `CatalogService` that indexes `Show`s by movie + city + date so users can search across theatres, not just book against a `Show` they already have.
- **Dynamic pricing:** Replace the flat `SEAT_PRICE` dict with a `PricingStrategy` (Strategy pattern, same idea as Project 1's allocator) that factors in demand, day of week, or show time (matinee vs. prime time).
- **Cancellations & refunds:** Add `cancel_booking()` that reverts `BOOKED` seats to `AVAILABLE` and issues a `Refund` record linked to the original `Payment`.
