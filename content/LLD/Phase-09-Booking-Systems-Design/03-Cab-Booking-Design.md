# Cab Booking Design (Uber/Ola-style) — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Driver Matching Approach](#9-driver-matching-approach)
10. [Python Skeleton](#10-python-skeleton)
11. [Key Decisions](#11-key-decisions)
12. [Interview Follow-ups](#12-interview-follow-ups)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements
- A **rider** requests a ride by providing pickup and drop locations.
- The system finds and assigns the **nearest available driver**.
- Fare is calculated based on distance, time, and vehicle type (and optionally surge).
- The ride has a **lifecycle**: `REQUESTED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED` (or `CANCELLED` at various points).
- Both rider and driver receive **status updates** as the ride progresses.
- Payment is settled at ride completion.

### Clarifying Questions
- How many drivers/riders — city-scale (thousands of concurrent rides)? *(Assume: yes, so matching must be efficient, not O(all drivers) per request in the "real" system — for LLD purposes we design the interfaces correctly and note where a geospatial index would replace a naive scan.)*
- Multiple vehicle types (Mini/Sedan/SUV)? *(Assume: yes.)*
- Is pricing static per-km or dynamic/surge-based? *(Assume: pluggable — start static, support surge via Strategy.)*
- Do we need real-time location tracking during the ride? *(Assume: out of scope for class design; note it's driven by periodic location updates from the driver's app.)*

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|-------|------|-----------------|
| `Location` | Value object | Latitude/longitude + distance calculation |
| `Rider` | Domain | Requests rides, has profile/payment info |
| `Driver` | Domain | Accepts rides, has current `Location`, availability, vehicle |
| `Vehicle` | Domain | Type (Mini/Sedan/SUV), plate number |
| `Ride` | Domain | Core aggregate — rider, driver, pickup/drop, status, fare |
| `RideStatus` | Enum/State | Lifecycle states |
| `FareStrategy` | Strategy | Computes fare for a ride |
| `DriverMatcher` | Service | Finds nearest available driver |
| `RideObserver` | Observer interface | Notified on ride status changes |
| `Payment` | Domain | Amount, method, status |
| `RideBookingService` | Facade | Orchestrates request → match → accept → complete |

---

## 3. Step 3: Define Relationships

```
Rider          1 ────── * Ride            (a rider has ride history)
Driver         1 ────── * Ride            (a driver has ride history)
Driver         1 ────── 1 Vehicle
Ride           1 ────── 1 Rider
Ride           1 ────── 0..1 Driver       (unassigned until matched)
Ride           1 ────── 2 Location        (pickup, drop)
Ride           1 ────── 1 FareStrategy    (dependency, injected per ride/vehicle type)
Ride           1 ────── 0..1 Payment
RideBookingService  ─── 1 DriverMatcher   (dependency)
Ride           * ────── * RideObserver    (subject-observer, notified on status change)
```

---

## 4. Step 4: Assign Responsibilities

- **`Location`**: pure value object — holds lat/lng, exposes `distance_to()` (haversine or simple Euclidean approximation for LLD purposes).
- **`Driver`**: tracks its own `current_location` and `is_available`; does NOT know how it was matched.
- **`DriverMatcher`**: given a pickup `Location` and a pool of drivers, returns the best candidate — encapsulates the matching algorithm so it can be swapped (nearest vs least-idle-time vs highest-rated).
- **`Ride`**: owns lifecycle state transitions (`accept()`, `start()`, `complete()`, `cancel()`) and validates that transitions are legal for the current `RideStatus`.
- **`FareStrategy`**: pure calculation, no side effects — takes distance/time/vehicle type, returns amount.
- **`RideBookingService`**: the only class that wires together `DriverMatcher`, `Ride` creation, and notifying observers — keeps `Ride` itself free of orchestration concerns.
- **Observers** (`RiderNotifier`, `DriverNotifier`): react to `Ride` status changes (push notification/SMS) — `Ride` doesn't know or care who's listening.

---

## 5. Step 5: Apply SOLID

| Principle | Applied How |
|-----------|-------------|
| **SRP** | `DriverMatcher` only matches; `FareStrategy` only prices; `Ride` only manages its own lifecycle state; notification is external via Observer. |
| **OCP** | New matching algorithms or fare models plug in as new `DriverMatcher`/`FareStrategy` implementations without touching `Ride` or `RideBookingService`. |
| **LSP** | Any `FareStrategy` is interchangeable; any `RideObserver` can be added/removed without the subject (`Ride`) caring about the concrete type. |
| **ISP** | `RideObserver` exposes one method (`on_status_changed`) — implementers aren't forced into unrelated methods. |
| **DIP** | `RideBookingService` depends on `DriverMatcher` and `FareStrategy` abstractions, injected at construction, not concrete classes. |

---

## 6. Step 6: Apply Design Patterns

- **Strategy** — `FareStrategy` (flat-rate, per-km, surge-multiplier) — the natural fit since pricing rules vary by city/vehicle/demand and change independently of ride logic.
- **Observer** — `Ride` is the subject; `RiderNotifier`/`DriverNotifier`/`AnalyticsLogger` subscribe to status-change events, decoupling notification channels from core ride logic.
- **State** — `RideStatus` transitions (`REQUESTED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED`, or `→ CANCELLED`) are validated inside `Ride`, effectively a State machine even if implemented with an enum + guard checks rather than full State-pattern classes (mention both are valid; enum+guards is simpler for an interview whiteboard).
- **Strategy (again)** — `DriverMatcher` itself is a strategy for "nearest available driver," swappable for smarter matching (e.g., factoring in driver rating or ETA instead of raw distance).

---

## 7. Step 7: Explain Extensibility

1. **Add ride pooling (shared rides)** — introduce `PooledRide` extending/composing `Ride` with multiple riders and multiple drop points; `FareStrategy` gets a `PooledFareStrategy` that splits cost; `DriverMatcher` unchanged.
2. **Add surge pricing** — swap in `SurgeFareStrategy` that multiplies the base fare using a demand/supply ratio for the zone; no change to `Ride` or `RideBookingService`.
3. **Add driver ratings influencing matching** — extend `DriverMatcher` to a `RatingWeightedMatcher` combining distance and rating into a score; `Ride`/`RideBookingService` untouched.
4. **Scale matching city-wide** — replace the naive linear scan in `DriverMatcher` with a geospatial index (e.g., geohash bucket lookup or quad-tree) behind the same `DriverMatcher` interface — a pure implementation swap.

---

## 8. Class Diagram

```
┌───────────────┐        ┌────────────────┐        ┌───────────────┐
│    Rider      │1───────│      Ride       │───────1│    Driver     │
├───────────────┤   *    ├────────────────┤   0..1  ├───────────────┤
│ - rider_id    │        │ - status        │        │ - driver_id   │
│ - name        │        │ - pickup, drop  │        │ - location    │
└───────────────┘        │ - fare          │        │ - is_available│
                          ├────────────────┤        │ - vehicle     │
                          │ + accept()      │        └───────┬───────┘
                          │ + start()       │                │1
                          │ + complete()    │                ▼
                          │ + cancel()      │        ┌───────────────┐
                          └───┬───────┬─────┘        │    Vehicle    │
                    depends on│       │*             └───────────────┘
                              ▼       ▼
                    ┌──────────────┐ ┌──────────────────┐
                    │ FareStrategy │ │  RideObserver      │
                    │ «interface»  │ │  «interface»       │
                    ├──────────────┤ ├──────────────────┤
                    │+calculate()  │ │+on_status_changed()│
                    └──────┬───────┘ └─────────┬──────────┘
                ┌──────────┼─────────┐         │
                ▼          ▼         ▼         ├──────────────┐
        PerKmFareStrategy SurgeFareStrategy    ▼              ▼
                                        RiderNotifier   DriverNotifier

┌────────────────────┐         ┌───────────────┐
│  RideBookingService │────────▶│ DriverMatcher │
├────────────────────┤ uses    ├───────────────┤
│ + request_ride()    │         │+find_nearest()│
└────────────────────┘         └───────────────┘

┌───────────┐          ┌──────────────┐
│ Location  │          │   Payment    │
├───────────┤          ├──────────────┤
│ - lat,lng │          │ - amount     │
│+distance_ │          │ - status     │
│  to()     │          └──────────────┘
└───────────┘
```

---

## 9. Driver Matching Approach

**Requirement:** given a rider's pickup `Location` and requested `Vehicle` type, find the nearest **available** driver.

**Naive approach (correct for LLD interview scope):**
1. Filter the driver pool to `is_available == True` and matching vehicle type.
2. Compute `location.distance_to(driver.location)` for each candidate.
3. Return the minimum-distance driver (or top-K for fallback if the first rejects).

```python
class DriverMatcher:
    def find_nearest(self, pickup: "Location", drivers: List["Driver"],
                      vehicle_type: Optional[str] = None) -> Optional["Driver"]:
        candidates = [
            d for d in drivers
            if d.is_available and (vehicle_type is None or d.vehicle.vehicle_type == vehicle_type)
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda d: pickup.distance_to(d.location))
```

**Why this is O(n) and how to say so correctly:** for a small city/simulation this is fine. At real scale (state this explicitly in interview), you'd replace the linear scan with a **geospatial index** — geohash-bucket the drivers and only scan nearby buckets, or use a quad-tree/R-tree — while keeping `DriverMatcher`'s interface identical. This demonstrates you understand the LLD/HLD boundary: the *design* accommodates the swap without an interviewer needing you to actually implement a quad-tree on the whiteboard.

**Handling driver rejection:** if the matched driver declines/times out, `RideBookingService` should request the *next*-nearest candidate rather than failing outright — this argues for `find_nearest` optionally returning a ranked list (`find_top_k`) rather than a single driver.

---

## 10. Python Skeleton

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from math import radians, sin, cos, sqrt, atan2
from typing import List, Optional
import uuid


@dataclass(frozen=True)
class Location:
    lat: float
    lng: float

    def distance_to(self, other: "Location") -> float:
        # Haversine distance in km
        R = 6371.0
        lat1, lat2 = radians(self.lat), radians(other.lat)
        dlat = radians(other.lat - self.lat)
        dlng = radians(other.lng - self.lng)
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
        return 2 * R * atan2(sqrt(a), sqrt(1 - a))


class VehicleType(Enum):
    MINI = auto()
    SEDAN = auto()
    SUV = auto()


@dataclass
class Vehicle:
    plate_number: str
    vehicle_type: VehicleType


@dataclass
class Rider:
    rider_id: str
    name: str


class Driver:
    def __init__(self, driver_id: str, vehicle: Vehicle, location: Location):
        self.driver_id = driver_id
        self.vehicle = vehicle
        self.location = location
        self.is_available = True

    def update_location(self, location: Location) -> None:
        self.location = location


class RideStatus(Enum):
    REQUESTED = auto()
    ACCEPTED = auto()
    ARRIVED = auto()
    IN_PROGRESS = auto()
    COMPLETED = auto()
    CANCELLED = auto()


VALID_TRANSITIONS = {
    RideStatus.REQUESTED: {RideStatus.ACCEPTED, RideStatus.CANCELLED},
    RideStatus.ACCEPTED: {RideStatus.ARRIVED, RideStatus.CANCELLED},
    RideStatus.ARRIVED: {RideStatus.IN_PROGRESS, RideStatus.CANCELLED},
    RideStatus.IN_PROGRESS: {RideStatus.COMPLETED},
    RideStatus.COMPLETED: set(),
    RideStatus.CANCELLED: set(),
}


class RideObserver(ABC):
    @abstractmethod
    def on_status_changed(self, ride: "Ride") -> None: ...


class RiderNotifier(RideObserver):
    def on_status_changed(self, ride: "Ride") -> None:
        print(f"[Rider Notify] Ride {ride.ride_id} is now {ride.status.name}")


class DriverNotifier(RideObserver):
    def on_status_changed(self, ride: "Ride") -> None:
        print(f"[Driver Notify] Ride {ride.ride_id} is now {ride.status.name}")


class Ride:
    def __init__(self, ride_id: str, rider: Rider, pickup: Location, drop: Location):
        self.ride_id = ride_id
        self.rider = rider
        self.driver: Optional[Driver] = None
        self.pickup = pickup
        self.drop = drop
        self.status = RideStatus.REQUESTED
        self.fare: Optional[float] = None
        self._observers: List[RideObserver] = []

    def add_observer(self, observer: RideObserver) -> None:
        self._observers.append(observer)

    def _transition(self, new_status: RideStatus) -> None:
        if new_status not in VALID_TRANSITIONS[self.status]:
            raise ValueError(f"Cannot go from {self.status} to {new_status}")
        self.status = new_status
        for obs in self._observers:
            obs.on_status_changed(self)

    def accept(self, driver: Driver) -> None:
        self.driver = driver
        driver.is_available = False
        self._transition(RideStatus.ACCEPTED)

    def mark_arrived(self) -> None:
        self._transition(RideStatus.ARRIVED)

    def start(self) -> None:
        self._transition(RideStatus.IN_PROGRESS)

    def complete(self, fare_strategy: "FareStrategy") -> None:
        self.fare = fare_strategy.calculate(self)
        self._transition(RideStatus.COMPLETED)
        if self.driver:
            self.driver.is_available = True

    def cancel(self) -> None:
        self._transition(RideStatus.CANCELLED)
        if self.driver:
            self.driver.is_available = True


class FareStrategy(ABC):
    @abstractmethod
    def calculate(self, ride: Ride) -> float: ...


class PerKmFareStrategy(FareStrategy):
    BASE_FARE = 40.0
    RATE_PER_KM = 12.0

    def calculate(self, ride: Ride) -> float:
        distance = ride.pickup.distance_to(ride.drop)
        return self.BASE_FARE + distance * self.RATE_PER_KM


class SurgeFareStrategy(FareStrategy):
    def __init__(self, base_strategy: FareStrategy, surge_multiplier: float):
        self.base_strategy = base_strategy
        self.surge_multiplier = surge_multiplier

    def calculate(self, ride: Ride) -> float:
        return self.base_strategy.calculate(ride) * self.surge_multiplier


class DriverMatcher:
    def find_nearest(self, pickup: Location, drivers: List[Driver],
                      vehicle_type: Optional[VehicleType] = None) -> Optional[Driver]:
        candidates = [
            d for d in drivers
            if d.is_available and (vehicle_type is None or d.vehicle.vehicle_type == vehicle_type)
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda d: pickup.distance_to(d.location))


class RideBookingService:
    def __init__(self, matcher: DriverMatcher, fare_strategy: FareStrategy):
        self.matcher = matcher
        self.fare_strategy = fare_strategy

    def request_ride(self, rider: Rider, pickup: Location, drop: Location,
                      drivers: List[Driver], vehicle_type: Optional[VehicleType] = None) -> Ride:
        ride = Ride(ride_id=str(uuid.uuid4()), rider=rider, pickup=pickup, drop=drop)
        ride.add_observer(RiderNotifier())
        ride.add_observer(DriverNotifier())

        driver = self.matcher.find_nearest(pickup, drivers, vehicle_type)
        if driver is None:
            ride.cancel()
            raise RuntimeError("No available drivers")
        ride.accept(driver)
        return ride
```

---

## 11. Key Decisions

- **`Ride` enforces its own valid state transitions** via a transition table — prevents illegal jumps (e.g., `REQUESTED → IN_PROGRESS` skipping `ACCEPTED`) from anywhere in the codebase, not just from disciplined caller code.
- **`DriverMatcher` is a separate class, not a `Ride` or `Rider` method** — matching depends on the whole driver pool, not on any single ride/rider, so it belongs in its own service.
- **`FareStrategy` is composable (`SurgeFareStrategy` wraps a `PerKmFareStrategy`)** — a Decorator-flavored use of Strategy that lets surge multiply any base fare model without duplicating the base calculation.
- **Observer for notifications** — keeps `Ride` free of email/SMS/push-specific code; adding a new channel (e.g., in-app WebSocket push) means adding a new observer, not editing `Ride`.

---

## 12. Interview Follow-ups

- **How do you match the nearest available driver efficiently at city scale?** Naive O(n) distance scan works for small pools; at scale, index drivers by geohash or a quad-tree/R-tree keyed on location, query only nearby cells, and compute exact distance only for that shortlist — `DriverMatcher`'s interface doesn't need to change, only its implementation.
- **What happens if the matched driver rejects or times out?** `RideBookingService` should fall back to the next-nearest candidate; extend `DriverMatcher` with `find_top_k()` so the service can iterate candidates without re-querying from scratch each time.
- **How do you calculate dynamic/surge pricing?** `SurgeFareStrategy` wraps a base `FareStrategy` and multiplies by a per-zone demand/supply ratio (computed externally by a pricing service and passed in) — no change needed to `Ride.complete()`.
- **How do you notify both rider and driver in real time as ride status changes?** `Ride` is the Observer subject; `RiderNotifier`/`DriverNotifier` (or a WebSocket-backed observer) subscribe and push updates on every `_transition()` call, decoupling notification transport from ride logic.
- **How would you support ride cancellation with a cancellation fee?** Add a `cancel(reason)` variant that checks `self.status` and elapsed time since `accept()`; if past a grace period, invoke `FareStrategy`/a dedicated `CancellationFeeStrategy` to charge a partial fee before transitioning to `CANCELLED`.

---

## 13. Interview Q&A

**Q: Why is `DriverMatcher` a separate class instead of a method on `Ride` or `Driver`?**
Answer: Matching needs visibility into the entire pool of drivers, not just one ride or one driver's own state — it's a cross-cutting query over shared, mutable data (driver availability and location). Putting it on `Ride` would force `Ride` to depend on a global driver registry, breaking SRP. A standalone `DriverMatcher` keeps that dependency isolated and makes the matching algorithm independently swappable/testable.

**Q: How does the design prevent an illegal ride-state transition, like jumping from REQUESTED straight to COMPLETED?**
Answer: `Ride._transition()` checks the requested `new_status` against a `VALID_TRANSITIONS` table keyed by the current status and raises if it's not allowed. All state changes go through this single choke point (`accept`, `start`, `complete`, `cancel` all call it), so there's no code path that can silently set `self.status` to an invalid value.

**Q: Why use the Strategy pattern for fare calculation instead of an `if surge: ... else: ...` inside `Ride`?**
Answer: Fare rules vary independently of ride lifecycle logic and change frequently (surge multipliers, promotions, per-city rates). Encapsulating them in `FareStrategy` implementations lets you add/swap pricing models without touching `Ride`, and `SurgeFareStrategy` can even wrap another strategy (composition) instead of duplicating the base per-km calculation.

**Q: How would you notify the rider's app and driver's app when ride status changes, without hardcoding notification logic into `Ride`?**
Answer: Use the Observer pattern — `Ride` maintains a list of `RideObserver`s and calls `on_status_changed()` on each after every valid transition. Concrete observers (`RiderNotifier`, `DriverNotifier`, or a push-notification/WebSocket adapter) handle the actual delivery mechanism; `Ride` stays decoupled from transport details and new channels can be added without modifying `Ride`.

**Q: The naive `DriverMatcher.find_nearest()` scans every driver — how would you explain that this doesn't scale, and what would you change?**
Answer: A linear scan is O(n) per ride request, which becomes a bottleneck with a large city-wide driver pool and thousands of concurrent requests. At scale you'd replace the driver pool storage with a spatial index (geohashing to bucket drivers by grid cell, or a quad-tree/R-tree) so a query only inspects drivers in nearby cells. Crucially, this is purely an implementation change inside `DriverMatcher` — its interface (`find_nearest(pickup, drivers, vehicle_type)`) and every other class in the design stay the same.

**Q: What is the reasoning behind marking a driver `is_available = False` inside `Ride.accept()` rather than inside `DriverMatcher`?**
Answer: `DriverMatcher`'s job is purely to select a candidate — it shouldn't have side effects on driver state, or two concurrent match calls could momentarily both pick the same "available" driver before either commits. `Ride.accept()` is the transactional boundary where the match is actually committed, so that's where the driver's availability flag is flipped — keeping the read (match) and write (commit) responsibilities cleanly separated.
