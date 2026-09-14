# Hotel Booking Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Availability Checking (Date-Range Overlap)](#9-availability-checking-date-range-overlap)
10. [Python Skeleton](#10-python-skeleton)
11. [Key Decisions](#11-key-decisions)
12. [Interview Follow-ups](#12-interview-follow-ups)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements
- Guests can **search rooms** by date range, room type, and location.
- A search returns only rooms that are **actually free** for the entire requested date range.
- A guest can **reserve** a room for a date range, and **cancel** an existing reservation.
- Payment is collected at booking (or partially, as a deposit — kept simple here: full payment at booking).
- One hotel has multiple **room types** (Standard/Deluxe/Suite), each with multiple **physical rooms**.

### Clarifying Questions
- Single hotel or a chain with many properties? *(Assume: model one `Hotel` with many `Room`s; a chain is a thin aggregation layer added later — see extensibility.)*
- Can the same physical room have multiple *pending* reservation requests before one is confirmed (like a shopping-cart hold)? *(Assume: no hold step for this lesson, unlike movie seats — booking is closer to immediate reserve-or-fail with a DB constraint. Mention the hold pattern as an easy extension, reusing lesson 02's `SeatLockManager` idea, renamed to a `RoomLockManager`.)*
- What counts as "available"? *(A room is available for `[start, end)` if no existing, non-cancelled reservation for that room overlaps that range.)*
- Overbooking policy — is slight overbooking allowed (airline-style) for revenue optimization? *(Assume: no overbooking — hotels typically guarantee the room.)*

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|-------|------|-----------------|
| `Hotel` | Domain (aggregate root) | Owns rooms, top-level search entry point |
| `RoomType` | Domain (value-ish) | Category metadata: name, base price, capacity |
| `Room` | Domain | One physical room; belongs to a `RoomType` |
| `Guest` | Domain | Booking account |
| `Reservation` | Domain | A confirmed date-range booking of a `Room` by a `Guest` |
| `Payment` | Domain | Amount, method, status |
| `AvailabilityChecker` | Service | Determines free rooms for a date range (the core algorithm) |
| `HotelBookingService` | Facade | Orchestrates search → reserve → pay → confirm/cancel |

---

## 3. Step 3: Define Relationships

```
Hotel        1 ────── * RoomType
Hotel        1 ────── * Room
RoomType     1 ────── * Room             (a type groups many physical rooms)
Room         1 ────── * Reservation      (a room has a history of reservations)
Guest        1 ────── * Reservation
Reservation  1 ────── 1 Room
Reservation  1 ────── 1 Guest
Reservation  1 ────── 0..1 Payment
HotelBookingService ─── 1 AvailabilityChecker  (dependency)
```

`RoomType` and `Room` are separate for the same reason `Seat`/`ShowSeat` were separate in the movie-booking lesson: `RoomType` is category-level metadata (price, capacity, amenities) shared by many rooms, while `Room` is the concrete bookable unit with its own reservation history.

---

## 4. Step 4: Assign Responsibilities

- **`Hotel`**: owns the full room inventory; exposes `search_available_rooms(date_range, room_type)` as the public entry point, delegating the actual overlap logic to `AvailabilityChecker`.
- **`Room`**: exposes its own reservation history (`existing_reservations()`), and validates that a new reservation on it doesn't overlap existing ones — the room is the natural owner of "am I free right now for this range."
- **`AvailabilityChecker`**: stateless algorithm class — given a `Room` and a candidate date range, answers true/false; also supports the batch query "which of these rooms are free."
- **`Reservation`**: pure data + `overlaps(other_range)` helper and `cancel()` state change; doesn't know about payment gateways.
- **`HotelBookingService`**: the only class coordinating search, reservation creation, and payment — keeps `Room`/`Reservation` free of orchestration and I/O concerns.

---

## 5. Step 5: Apply SOLID

| Principle | Applied How |
|-----------|-------------|
| **SRP** | `AvailabilityChecker` only checks overlap; `Room` only tracks its own reservations; `HotelBookingService` only orchestrates; `Payment` only tracks payment state. |
| **OCP** | Adding a new search filter (e.g., "rooms with sea view") extends `Hotel.search_available_rooms()`'s filter chain without modifying `AvailabilityChecker`'s core overlap algorithm. |
| **LSP** | Any `CancellationPolicy` implementation (see below) can substitute another without `Reservation.cancel()` changing. |
| **ISP** | `AvailabilityChecker` exposes a narrow interface (`is_available`, `filter_available`) — clients don't depend on internal date-math helpers. |
| **DIP** | `HotelBookingService` depends on `AvailabilityChecker` and `PaymentStrategy` abstractions, injected — not concrete date-overlap code or a hardcoded payment gateway. |

---

## 6. Step 6: Apply Design Patterns

- **Strategy** — `PaymentStrategy` (Card/UPI/Wallet), and optionally `CancellationPolicy` (free cancellation vs non-refundable vs partial-refund-if-N-days-out) — both vary independently of the reservation/availability logic.
- **Facade** — `HotelBookingService` hides the multi-step choreography (search → reserve → pay) behind `book_room()`.
- **Factory Method** — `RoomFactory`/registering `RoomType`s so `Hotel` construction doesn't hardcode room creation logic.
- **Observer** (optional extension) — notify a `Guest` on booking confirmation/cancellation, or notify a `WaitlistService` when a room frees up, without `Reservation` depending on notification channels.

---

## 7. Step 7: Explain Extensibility

1. **Hotel chain (multiple properties)** — add a `HotelChain` aggregating multiple `Hotel`s; `search_available_rooms()` at the chain level fans out to each `Hotel`'s existing method and merges results — no change to `Hotel`, `Room`, or `AvailabilityChecker`.
2. **Dynamic pricing by season/demand** — introduce a `PricingStrategy` computing nightly rate from `RoomType.base_price` plus a seasonal/demand multiplier; `HotelBookingService` calls it when computing total cost, no change to `Reservation`/`AvailabilityChecker`.
3. **Cancellation policies (free vs non-refundable vs tiered refund)** — `CancellationPolicy` strategy computes refund amount from `Reservation` dates; `Reservation.cancel()` delegates to it — swapping policy doesn't touch cancellation control flow.
4. **Overbooking / waitlist support** — add a `Waitlist` that listens for `Reservation.cancel()` events (Observer) and offers the freed room to the next waitlisted guest — core booking classes remain untouched.

---

## 8. Class Diagram

```
┌───────────┐        ┌───────────┐        ┌───────────┐
│   Hotel   │1──────*│  RoomType │1──────*│    Room    │
├───────────┤        ├───────────┤        ├───────────┤
│ - rooms   │        │ - name    │        │ - room_no │
│ - types   │        │ - price   │        │ - type    │
├───────────┤        │ - capacity│        ├───────────┤
│+search()  │        └───────────┘        │+existing_ │
└─────┬─────┘                             │ reservations()│
      │ uses                              └─────┬─────┘
      ▼                                          │1
┌──────────────────────┐                         │*
│  AvailabilityChecker   │                       ▼
├──────────────────────┤              ┌────────────────────┐
│+is_available(room,    │              │    Reservation      │
│   date_range)          │◀─────────── ├────────────────────┤
│+filter_available(rooms,│  checks     │ - start, end        │
│   date_range)          │             │ - status             │
└──────────────────────┘              │ - guest, room        │
                                       ├────────────────────┤
                                       │+overlaps(range)      │
                                       │+cancel()              │
                                       └──────┬───────┬───────┘
                                              │1       │0..1
                                              ▼        ▼
                                       ┌───────────┐ ┌──────────────┐
                                       │   Guest   │ │   Payment    │
                                       └───────────┘ ├──────────────┤
                                                      │ - amount     │
                                                      │ - status     │
                                                      └──────────────┘

┌────────────────────┐         ┌───────────────────┐
│ HotelBookingService  │────────▶│ CancellationPolicy │
├────────────────────┤ uses    │  «interface»        │
│+search_and_book()    │        ├───────────────────┤
│+cancel_reservation() │        │+refund_amount()    │
└────────────────────┘        └───────────────────┘
```

---

## 9. Availability Checking (Date-Range Overlap)

**Core rule:** two date ranges `[startA, endA)` and `[startB, endB)` overlap **if and only if** `startA < endB AND startB < endA`. Using half-open intervals (`endA` exclusive — checkout day) correctly allows a guest to check in on the same day another guest checks out.

```python
def ranges_overlap(start_a: date, end_a: date, start_b: date, end_b: date) -> bool:
    return start_a < end_b and start_b < end_a
```

A `Room` is available for a requested `[start, end)` if **none** of its existing (non-cancelled) reservations overlap that range:

```python
def is_room_available(room: "Room", start: date, end: date) -> bool:
    return not any(
        ranges_overlap(start, end, r.start_date, r.end_date)
        for r in room.existing_reservations()
        if r.status != "CANCELLED"
    )
```

**Why not just check "is the room reserved on any single day in the range"?** A day-by-day loop is O(days) and easy to get off-by-one wrong at boundaries; the interval-overlap formula is O(1) per existing reservation and handles boundary days (checkout morning = checkin evening) correctly by construction, since `end` is exclusive.

**Concurrency note (interview follow-up bait):** the check-then-reserve sequence (`is_available()` then `create Reservation`) is a classic race condition if two guests try to book the same room for overlapping dates simultaneously. In a real system this is closed with a DB-level constraint (e.g., a Postgres exclusion constraint on `(room_id, daterange)` using `EXCLUDE USING gist`) or a serializable transaction — the LLD answer is to name this explicitly and note the class design should route all reservation creation through a single `HotelBookingService.book_room()` method so the atomic check-and-insert lives in one place, ready to be wrapped in a transaction/lock.

---

## 10. Python Skeleton

```python
from dataclasses import dataclass, field
from datetime import date
from enum import Enum, auto
from threading import Lock
from typing import List, Optional
import uuid


@dataclass
class RoomType:
    type_id: str
    name: str  # STANDARD / DELUXE / SUITE
    base_price: float
    capacity: int


class ReservationStatus(Enum):
    CONFIRMED = auto()
    CANCELLED = auto()


@dataclass
class Reservation:
    reservation_id: str
    room: "Room"
    guest: "Guest"
    start_date: date
    end_date: date
    status: ReservationStatus = ReservationStatus.CONFIRMED
    payment: Optional["Payment"] = None

    def overlaps(self, start: date, end: date) -> bool:
        return self.start_date < end and start < self.end_date

    def cancel(self) -> None:
        self.status = ReservationStatus.CANCELLED


class Room:
    def __init__(self, room_number: str, room_type: RoomType):
        self.room_number = room_number
        self.room_type = room_type
        self._reservations: List[Reservation] = []
        self._lock = Lock()

    def existing_reservations(self) -> List[Reservation]:
        return [r for r in self._reservations if r.status == ReservationStatus.CONFIRMED]

    def is_available(self, start: date, end: date) -> bool:
        return not any(r.overlaps(start, end) for r in self.existing_reservations())

    def add_reservation(self, reservation: Reservation) -> bool:
        """Atomically re-check availability and add — closes the check-then-act race."""
        with self._lock:
            if not self.is_available(reservation.start_date, reservation.end_date):
                return False
            self._reservations.append(reservation)
            return True


class AvailabilityChecker:
    def is_available(self, room: Room, start: date, end: date) -> bool:
        return room.is_available(start, end)

    def filter_available(self, rooms: List[Room], start: date, end: date) -> List[Room]:
        return [r for r in rooms if self.is_available(r, start, end)]


class Hotel:
    def __init__(self, hotel_id: str, name: str, rooms: List[Room]):
        self.hotel_id = hotel_id
        self.name = name
        self.rooms = rooms

    def search_available_rooms(self, start: date, end: date,
                                checker: AvailabilityChecker,
                                room_type_name: Optional[str] = None) -> List[Room]:
        candidates = self.rooms
        if room_type_name:
            candidates = [r for r in candidates if r.room_type.name == room_type_name]
        return checker.filter_available(candidates, start, end)


@dataclass
class Guest:
    guest_id: str
    name: str


@dataclass
class Payment:
    amount: float
    method: str
    status: str = "PENDING"


class PaymentStrategy:
    def pay(self, amount: float) -> Payment:
        raise NotImplementedError


class CreditCardPayment(PaymentStrategy):
    def pay(self, amount: float) -> Payment:
        return Payment(amount=amount, method="CARD", status="PAID")


class CancellationPolicy:
    def refund_amount(self, reservation: Reservation, cancel_date: date) -> float:
        raise NotImplementedError


class FreeCancellationPolicy(CancellationPolicy):
    def refund_amount(self, reservation: Reservation, cancel_date: date) -> float:
        paid = reservation.payment.amount if reservation.payment else 0.0
        return paid  # full refund regardless of timing


class TieredCancellationPolicy(CancellationPolicy):
    """Full refund if cancelled 3+ days before check-in, else 50%."""
    def refund_amount(self, reservation: Reservation, cancel_date: date) -> float:
        paid = reservation.payment.amount if reservation.payment else 0.0
        days_before = (reservation.start_date - cancel_date).days
        return paid if days_before >= 3 else paid * 0.5


class HotelBookingService:
    def __init__(self, checker: AvailabilityChecker, payment_strategy: PaymentStrategy,
                 cancellation_policy: CancellationPolicy):
        self.checker = checker
        self.payment_strategy = payment_strategy
        self.cancellation_policy = cancellation_policy

    def book_room(self, hotel: Hotel, guest: Guest, room: Room,
                   start: date, end: date, nightly_rate: float) -> Reservation:
        nights = (end - start).days
        amount = nightly_rate * nights
        payment = self.payment_strategy.pay(amount)
        if payment.status != "PAID":
            raise RuntimeError("Payment failed")

        reservation = Reservation(
            reservation_id=str(uuid.uuid4()), room=room, guest=guest,
            start_date=start, end_date=end, payment=payment,
        )
        if not room.add_reservation(reservation):
            raise RuntimeError("Room no longer available for these dates")
        return reservation

    def cancel_reservation(self, reservation: Reservation, cancel_date: date) -> float:
        refund = self.cancellation_policy.refund_amount(reservation, cancel_date)
        reservation.cancel()
        return refund
```

---

## 11. Key Decisions

- **Availability uses interval-overlap math, not a day-by-day calendar loop** — O(1) per existing reservation instead of O(days), and avoids off-by-one boundary bugs on checkin/checkout day by using half-open ranges.
- **`Room.add_reservation()` re-checks availability *inside* the same locked critical section** that inserts the reservation — closes the check-then-act TOCTOU race between `search_available_rooms()` and actually booking; a room-level lock is sufficient since overlap only matters per-room.
- **Payment happens before the reservation is durably added**, and `add_reservation()` can still fail (race lost) — in a real system you'd refund/void the payment on that failure path; noting this trade-off explicitly is a good signal in interviews even if not fully implemented.
- **`CancellationPolicy` is a separate strategy from `PaymentStrategy`** — refund computation and payment collection are different concerns with different variability (refund rules change by hotel policy; payment methods change by what gateways are integrated).

---

## 12. Interview Follow-ups

- **How do you check room availability for a date range efficiently?** Interval-overlap test (`start_a < end_b and start_b < end_a`) against each room's existing confirmed reservations — O(1) per reservation rather than iterating individual days; for large reservation histories, index reservations by room and date range (e.g., an interval tree or a DB range/exclusion index) instead of a linear scan.
- **How do you prevent two guests from booking the same room for overlapping dates simultaneously?** Guard the "check availability, then insert reservation" sequence with a per-room lock (`Room.add_reservation()` re-validates inside the lock) so it's atomic; in a distributed/DB-backed system, use a database exclusion constraint on `(room_id, daterange)` or a serializable transaction instead of an in-process lock.
- **How would you support partial refunds on cancellation?** `CancellationPolicy` strategy (e.g., `TieredCancellationPolicy`) computes the refund based on how far in advance the cancellation happens relative to `start_date`; swapping policies doesn't touch `HotelBookingService.cancel_reservation()`'s control flow.
- **How would you extend this to a hotel chain with many properties?** Add a `HotelChain` that holds multiple `Hotel`s and fans a search request out to each `Hotel.search_available_rooms()`, merging and ranking results — no changes needed inside `Hotel`, `Room`, or `AvailabilityChecker`.
- **How would you handle a guest wanting to modify (not cancel) an existing reservation's dates?** Model as an atomic cancel-and-rebook inside `HotelBookingService`: check availability for the new range (excluding the reservation being modified from the overlap check), and only commit the change if the new range is free — avoids a half-updated reservation if the new dates aren't available.

---

## 13. Interview Q&A

**Q: Why compute availability with an interval-overlap formula instead of checking each day individually?**
Answer: The overlap formula (`start_a < end_b and start_b < end_a`) is a single O(1) comparison per existing reservation, whereas a day-by-day loop is O(number of days) and is easy to get wrong at checkin/checkout boundaries. Using half-open ranges (`end` exclusive) also naturally and correctly allows one guest to check in the same day another checks out, without special-casing that boundary.

**Q: Why separate `RoomType` from `Room`?**
Answer: `RoomType` captures category-level attributes shared across many physical rooms — name, base price, capacity, amenities — while `Room` is the concrete, individually-bookable unit with its own reservation history. Merging them would mean either duplicating type metadata on every room row or losing the ability to track per-room availability independently, both of which complicate the booking logic.

**Q: How do you prevent a race condition where two guests both see a room as available and both try to book it?**
Answer: The "check, then act" pattern (`is_available()` followed by creating a `Reservation`) is a classic time-of-check-to-time-of-use race if done as two separate steps. The fix is to make the check and the insert atomic — here, `Room.add_reservation()` re-validates availability *inside* the same lock that appends the reservation, so only one of two racing callers can succeed. In a multi-server/DB-backed deployment, this atomicity is instead enforced with a database constraint (e.g., a range-exclusion constraint) or a serializable transaction, since an in-process lock won't coordinate across servers.

**Q: Where does cancellation refund logic live, and why isn't it inside `Reservation.cancel()` directly?**
Answer: Refund computation is business policy that varies independently of the reservation lifecycle (free cancellation, non-refundable rates, tiered refunds based on notice period) — encapsulating it in a `CancellationPolicy` strategy keeps `Reservation.cancel()` simple (just a status flip) and lets `HotelBookingService` swap refund rules per hotel or rate plan without touching `Reservation` at all.

**Q: How would this design extend to support a chain of hotels instead of just one?**
Answer: Add a `HotelChain` aggregate that holds a list of `Hotel`s. A chain-wide search fans the same `search_available_rooms()` call out to each `Hotel` and merges/ranks the results (e.g., by price or distance). Because `Hotel`, `Room`, and `AvailabilityChecker` were already designed as self-contained, per-property units, none of them need to change — this is Open/Closed working as intended.

**Q: What would you change if the business wanted to allow slight overbooking (like airlines do) instead of a strict no-overbooking policy?**
Answer: Introduce an `OverbookingPolicy` that `AvailabilityChecker`/`Hotel.search_available_rooms()` consults — e.g., allow booking up to N% over physical capacity for a given room type, tracked at the `RoomType` level rather than per physical `Room`. This is a materially different availability model (capacity-based instead of per-room-instance based), so it would likely warrant a distinct `AvailabilityChecker` implementation behind the same interface rather than a small tweak to the existing overlap check.
