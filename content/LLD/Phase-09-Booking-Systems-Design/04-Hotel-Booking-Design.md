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

```java
public static boolean rangesOverlap(LocalDate startA, LocalDate endA, LocalDate startB, LocalDate endB) {
    return startA.isBefore(endB) && startB.isBefore(endA);
}
```

A `Room` is available for a requested `[start, end)` if **none** of its existing (non-cancelled) reservations overlap that range:

```java
public static boolean isRoomAvailable(Room room, LocalDate start, LocalDate end) {
    return room.existingReservations().stream()
        .noneMatch(r -> rangesOverlap(start, end, r.getStartDate(), r.getEndDate()));
}
```

**Why not just check "is the room reserved on any single day in the range"?** A day-by-day loop is O(days) and easy to get off-by-one wrong at boundaries; the interval-overlap formula is O(1) per existing reservation and handles boundary days (checkout morning = checkin evening) correctly by construction, since `end` is exclusive.

**Concurrency note (interview follow-up bait):** the check-then-reserve sequence (`is_available()` then `create Reservation`) is a classic race condition if two guests try to book the same room for overlapping dates simultaneously. In a real system this is closed with a DB-level constraint (e.g., a Postgres exclusion constraint on `(room_id, daterange)` using `EXCLUDE USING gist`) or a serializable transaction — the LLD answer is to name this explicitly and note the class design should route all reservation creation through a single `HotelBookingService.book_room()` method so the atomic check-and-insert lives in one place, ready to be wrapped in a transaction/lock.

---

## 10. Java Skeleton

```java
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

public record RoomType(String typeId, String name, double basePrice, int capacity) {}

public enum ReservationStatus {
    CONFIRMED, CANCELLED
}

public class Reservation {
    private final String reservationId;
    private final Room room;
    private final Guest guest;
    private final LocalDate startDate;
    private final LocalDate endDate;
    private ReservationStatus status = ReservationStatus.CONFIRMED;
    private Payment payment;

    public Reservation(String reservationId, Room room, Guest guest,
                       LocalDate startDate, LocalDate endDate, Payment payment) {
        this.reservationId = reservationId;
        this.room = room;
        this.guest = guest;
        this.startDate = startDate;
        this.endDate = endDate;
        this.payment = payment;
    }

    public boolean overlaps(LocalDate start, LocalDate end) {
        return this.startDate.isBefore(end) && start.isBefore(this.endDate);
    }

    public void cancel() { this.status = ReservationStatus.CANCELLED; }

    public String getReservationId() { return reservationId; }
    public Room getRoom() { return room; }
    public Guest getGuest() { return guest; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public ReservationStatus getStatus() { return status; }
    public Payment getPayment() { return payment; }
}

public class Room {
    private final String roomNumber;
    private final RoomType roomType;
    private final List<Reservation> reservations = new ArrayList<>();
    private final ReentrantLock lock = new ReentrantLock();

    public Room(String roomNumber, RoomType roomType) {
        this.roomNumber = roomNumber;
        this.roomType = roomType;
    }

    public List<Reservation> existingReservations() {
        return reservations.stream()
            .filter(r -> r.getStatus() == ReservationStatus.CONFIRMED)
            .toList();
    }

    public boolean isAvailable(LocalDate start, LocalDate end) {
        return existingReservations().stream().noneMatch(r -> r.overlaps(start, end));
    }

    public boolean addReservation(Reservation reservation) {
        lock.lock();
        try {
            if (!isAvailable(reservation.getStartDate(), reservation.getEndDate())) {
                return false;
            }
            reservations.add(reservation);
            return true;
        } finally {
            lock.unlock();
        }
    }

    public String getRoomNumber() { return roomNumber; }
    public RoomType getRoomType() { return roomType; }
}

public class AvailabilityChecker {
    public boolean isAvailable(Room room, LocalDate start, LocalDate end) {
        return room.isAvailable(start, end);
    }

    public List<Room> filterAvailable(List<Room> rooms, LocalDate start, LocalDate end) {
        return rooms.stream().filter(r -> isAvailable(r, start, end)).toList();
    }
}

public class Hotel {
    private final String hotelId;
    private final String name;
    private final List<Room> rooms;

    public Hotel(String hotelId, String name, List<Room> rooms) {
        this.hotelId = hotelId;
        this.name = name;
        this.rooms = new ArrayList<>(rooms);
    }

    public List<Room> searchAvailableRooms(LocalDate start, LocalDate end,
                                           AvailabilityChecker checker, String roomTypeName) {
        return rooms.stream()
            .filter(r -> roomTypeName == null || r.getRoomType().name().equalsIgnoreCase(roomTypeName))
            .filter(r -> checker.isAvailable(r, start, end))
            .toList();
    }

    public List<Room> getRooms() { return Collections.unmodifiableList(rooms); }
}

public record Guest(String guestId, String name) {}

public record Payment(double amount, String method, String status) {}

public interface PaymentStrategy {
    Payment pay(double amount);
}

public class CreditCardPaymentStrategy implements PaymentStrategy {
    @Override
    public Payment pay(double amount) {
        return new Payment(amount, "CARD", "PAID");
    }
}

public interface CancellationPolicy {
    double refundAmount(Reservation reservation, LocalDate cancelDate);
}

public class FreeCancellationPolicy implements CancellationPolicy {
    @Override
    public double refundAmount(Reservation reservation, LocalDate cancelDate) {
        return (reservation.getPayment() != null) ? reservation.getPayment().amount() : 0.0;
    }
}

public class TieredCancellationPolicy implements CancellationPolicy {
    @Override
    public double refundAmount(Reservation reservation, LocalDate cancelDate) {
        double paid = (reservation.getPayment() != null) ? reservation.getPayment().amount() : 0.0;
        long daysBefore = ChronoUnit.DAYS.between(cancelDate, reservation.getStartDate());
        return (daysBefore >= 3) ? paid : paid * 0.50;
    }
}

public class HotelBookingService {
    private final AvailabilityChecker checker;
    private final PaymentStrategy paymentStrategy;
    private final CancellationPolicy cancellationPolicy;

    public HotelBookingService(AvailabilityChecker checker,
                               PaymentStrategy paymentStrategy,
                               CancellationPolicy cancellationPolicy) {
        this.checker = checker;
        this.paymentStrategy = paymentStrategy;
        this.cancellationPolicy = cancellationPolicy;
    }

    public Reservation bookRoom(Hotel hotel, Guest guest, Room room,
                                LocalDate start, LocalDate end, double nightlyRate) {
        long nights = ChronoUnit.DAYS.between(start, end);
        double total = nightlyRate * nights;

        Payment payment = paymentStrategy.pay(total);
        if (!"PAID".equalsIgnoreCase(payment.status())) {
            throw new IllegalStateException("Payment failed");
        }

        Reservation reservation = new Reservation(
            UUID.randomUUID().toString(), room, guest, start, end, payment
        );

        if (!room.addReservation(reservation)) {
            throw new IllegalStateException("Room is no longer available for the requested dates");
        }
        return reservation;
    }

    public double cancelReservation(Reservation reservation, LocalDate cancelDate) {
        double refund = cancellationPolicy.refundAmount(reservation, cancelDate);
        reservation.cancel();
        return refund;
    }
}
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
