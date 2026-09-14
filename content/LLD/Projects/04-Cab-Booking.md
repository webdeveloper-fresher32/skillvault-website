# Project 4 — Cab Booking System (Uber/Ola-style)

**Difficulty:** Medium
**Patterns used:** Strategy (fare calculation), simple nearest-match algorithm

---

## 1. Requirements

**Functional:**
- `Driver`s broadcast their current `Location` and availability.
- A `Passenger` requests a ride from a pickup to a drop `Location`.
- The system matches the passenger to the **nearest available driver**.
- Fare is computed from a base fare + per-km rate + optional surge multiplier — the fare formula should be swappable (e.g., a different formula for premium rides).
- A `Ride` moves through a lifecycle: `REQUESTED` -> `ACCEPTED` -> `IN_PROGRESS` -> `COMPLETED` (or `CANCELLED`).

**Non-functional:**
- Distance calculation should be a simple, self-contained formula (no external mapping API) — straight-line (Euclidean/Haversine-lite) distance is acceptable for this exercise.
- Matching should not require scanning drivers more than once per request (single pass).

---

## 2. Class Diagram

```
┌───────────┐         ┌───────────┐
│ Location   │         │  Driver    │
│───────────│         │───────────│
│ lat, lng   │◀───────│ current_loc│
│ + distance_to()│     │ is_available│
└───────────┘         └─────┬─────┘
                              │ matched to
┌───────────┐                ▼
│ Passenger  │         ┌───────────┐        ┌────────────────────┐
│───────────│         │   Ride     │───────▶│ «interface»         │
│ name       │──1──────▶│───────────│  uses  │ FareStrategy         │
└───────────┘  requests│ status: RideStatus│ │──────────────────────│
                        │ pickup, drop      │ │ + calculate_fare()   │
                        │ driver, passenger │ └──────────┬───────────┘
                        │ fare               │            │
                        └───────────────────┘  ┌──────────┴───────────┐
                                                │ StandardFareStrategy  │
                                                └──────────────────────┘

                        ┌────────────────────────┐
                        │     RideDispatcher        │
                        │────────────────────────│
                        │ + request_ride()          │
                        │ + find_nearest_driver()   │
                        │ + complete_ride()         │
                        └────────────────────────┘
```

---

## 3. Full Implementation

```python
"""
Cab Booking — single-file runnable LLD reference implementation.
"""

from __future__ import annotations

import itertools
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Optional


# ---------------------------------------------------------------------------
# Location + distance
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Location:
    lat: float
    lng: float

    def distance_to(self, other: "Location") -> float:
        """
        Simple flat-plane Euclidean approximation, scaled roughly to km.
        Good enough for city-scale LLD demo purposes (not real geodesy).
        """
        dx = (self.lat - other.lat) * 111.0        # ~111 km per degree latitude
        dy = (self.lng - other.lng) * 111.0
        return math.hypot(dx, dy)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RideStatus(Enum):
    REQUESTED = auto()
    ACCEPTED = auto()
    IN_PROGRESS = auto()
    COMPLETED = auto()
    CANCELLED = auto()


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------

class Driver:
    def __init__(self, driver_id: str, name: str, location: Location):
        self.driver_id = driver_id
        self.name = name
        self.current_location = location
        self.is_available = True

    def __repr__(self) -> str:
        return f"Driver({self.name})"


@dataclass
class Passenger:
    passenger_id: str
    name: str

    def __repr__(self) -> str:
        return f"Passenger({self.name})"


# ---------------------------------------------------------------------------
# Strategy: fare calculation
# ---------------------------------------------------------------------------

class FareStrategy(ABC):
    @abstractmethod
    def calculate_fare(self, distance_km: float, surge_multiplier: float = 1.0) -> float:
        ...


class StandardFareStrategy(FareStrategy):
    BASE_FARE = 2.5
    PER_KM_RATE = 1.2

    def calculate_fare(self, distance_km: float, surge_multiplier: float = 1.0) -> float:
        fare = self.BASE_FARE + distance_km * self.PER_KM_RATE
        return round(fare * surge_multiplier, 2)


class PremiumFareStrategy(FareStrategy):
    BASE_FARE = 6.0
    PER_KM_RATE = 2.5

    def calculate_fare(self, distance_km: float, surge_multiplier: float = 1.0) -> float:
        fare = self.BASE_FARE + distance_km * self.PER_KM_RATE
        return round(fare * surge_multiplier, 2)


# ---------------------------------------------------------------------------
# Ride
# ---------------------------------------------------------------------------

@dataclass
class Ride:
    ride_id: str
    passenger: Passenger
    pickup: Location
    drop: Location
    driver: Optional[Driver] = None
    status: RideStatus = RideStatus.REQUESTED
    fare: Optional[float] = None

    def accept(self, driver: Driver) -> None:
        if self.status != RideStatus.REQUESTED:
            raise ValueError(f"Cannot accept ride in status {self.status.name}")
        self.driver = driver
        self.status = RideStatus.ACCEPTED
        driver.is_available = False

    def start(self) -> None:
        if self.status != RideStatus.ACCEPTED:
            raise ValueError(f"Cannot start ride in status {self.status.name}")
        self.status = RideStatus.IN_PROGRESS

    def complete(self, fare_strategy: FareStrategy, surge_multiplier: float = 1.0) -> float:
        if self.status != RideStatus.IN_PROGRESS:
            raise ValueError(f"Cannot complete ride in status {self.status.name}")
        distance = self.pickup.distance_to(self.drop)
        self.fare = fare_strategy.calculate_fare(distance, surge_multiplier)
        self.status = RideStatus.COMPLETED
        if self.driver:
            self.driver.is_available = True
            self.driver.current_location = self.drop
        return self.fare

    def cancel(self) -> None:
        if self.status in (RideStatus.COMPLETED, RideStatus.CANCELLED):
            raise ValueError(f"Cannot cancel ride in status {self.status.name}")
        if self.driver:
            self.driver.is_available = True
        self.status = RideStatus.CANCELLED


# ---------------------------------------------------------------------------
# RideDispatcher: matching + orchestration
# ---------------------------------------------------------------------------

class NoDriverAvailableError(Exception):
    pass


class RideDispatcher:
    def __init__(self, drivers: List[Driver], fare_strategy: Optional[FareStrategy] = None):
        self.drivers = drivers
        self.fare_strategy = fare_strategy or StandardFareStrategy()
        self._ride_counter = itertools.count(1)
        self.rides: List[Ride] = []

    def find_nearest_driver(self, pickup: Location) -> Optional[Driver]:
        best_driver: Optional[Driver] = None
        best_distance = math.inf
        for driver in self.drivers:
            if not driver.is_available:
                continue
            distance = driver.current_location.distance_to(pickup)
            if distance < best_distance:
                best_distance = distance
                best_driver = driver
        return best_driver

    def request_ride(self, passenger: Passenger, pickup: Location, drop: Location) -> Ride:
        ride = Ride(
            ride_id=f"RIDE-{next(self._ride_counter):04d}",
            passenger=passenger,
            pickup=pickup,
            drop=drop,
        )
        self.rides.append(ride)

        driver = self.find_nearest_driver(pickup)
        if driver is None:
            ride.cancel()
            raise NoDriverAvailableError("No available drivers near pickup location")

        ride.accept(driver)
        return ride

    def complete_ride(self, ride: Ride, surge_multiplier: float = 1.0) -> float:
        ride.start()
        return ride.complete(self.fare_strategy, surge_multiplier)


if __name__ == "__main__":
    downtown = Location(lat=12.9716, lng=77.5946)

    drivers = [
        Driver("D1", "Ramesh", Location(lat=12.9750, lng=77.6000)),   # ~0.7km away
        Driver("D2", "Suresh", Location(lat=13.0500, lng=77.5946)),   # ~8.7km away
        Driver("D3", "Ganesh", Location(lat=12.9720, lng=77.5950)),   # ~0.06km away, closest
    ]

    dispatcher = RideDispatcher(drivers, fare_strategy=StandardFareStrategy())
    passenger = Passenger("P1", "Meera")

    drop_location = Location(lat=12.9352, lng=77.6146)  # ~4.6 km south

    ride = dispatcher.request_ride(passenger, pickup=downtown, drop=drop_location)
    print(f"{ride.ride_id} matched with {ride.driver.name} (status: {ride.status.name})")

    fare = dispatcher.complete_ride(ride, surge_multiplier=1.0)
    print(f"Ride completed. Distance-based fare: ${fare:.2f} (status: {ride.status.name})")
    print(f"{ride.driver.name} is now available again: {ride.driver.is_available}")

    # A second ride during surge pricing, using the premium strategy
    dispatcher.fare_strategy = PremiumFareStrategy()
    ride2 = dispatcher.request_ride(passenger, pickup=downtown, drop=drop_location)
    print(f"\n{ride2.ride_id} matched with {ride2.driver.name}")
    surge_fare = dispatcher.complete_ride(ride2, surge_multiplier=1.5)
    print(f"Premium ride completed with 1.5x surge. Fare: ${surge_fare:.2f}")

    # Both drivers used above are free again (their rides completed). Now exhaust
    # all 3 drivers with uncompleted (still ACCEPTED) rides to trigger the error.
    print()
    for _ in range(3):
        r = dispatcher.request_ride(passenger, pickup=downtown, drop=drop_location)
        print(f"{r.ride_id} matched with {r.driver.name} (driver now unavailable)")

    try:
        dispatcher.request_ride(passenger, pickup=downtown, drop=drop_location)
    except NoDriverAvailableError as e:
        print(f"\nNext ride request failed as expected: {e}")
```

**Expected output:**

```
RIDE-0001 matched with Ganesh (status: ACCEPTED)
Ride completed. Distance-based fare: $8.03 (status: COMPLETED)
Ganesh is now available again: True

RIDE-0002 matched with Ramesh
Premium ride completed with 1.5x surge. Fare: $26.29

RIDE-0003 matched with Ramesh (driver now unavailable)
RIDE-0004 matched with Ganesh (driver now unavailable)
RIDE-0005 matched with Suresh (driver now unavailable)

Next ride request failed as expected: No available drivers near pickup location
```

---

## 4. Design Decisions

- **Strategy pattern for fares:** `FareStrategy` decouples "how much does this ride cost" from `Ride`/`RideDispatcher`. Adding a new pricing model (e.g., subscription flat-rate, or a strategy factoring in traffic time instead of just distance) is a new class, and the dispatcher can even swap strategies mid-run (as shown with `PremiumFareStrategy` in the demo) without touching `Ride`.
- **Nearest-driver matching kept as a single linear scan:** `find_nearest_driver` is intentionally simple (O(n) over available drivers) — in a real system this would be backed by a geospatial index (quad-tree / geohash grid) so the interface (`find_nearest_driver(pickup) -> Driver`) doesn't need to change, only the implementation swaps for scale. Calling this out proactively is a strong interview signal.
- **Ride as an explicit state machine via enum + guarded transitions:** Every mutating method (`accept`, `start`, `complete`, `cancel`) checks `self.status` before proceeding, preventing invalid transitions like completing a ride that was never started. This is a lighter-weight alternative to a full State-pattern class hierarchy (used in Project 5 for the ATM) — appropriate here because the transition logic is simple enough not to need separate state classes.
- **Driver availability flips atomically with ride state:** `accept()` marks the driver unavailable, `complete()`/`cancel()` frees them again — keeping driver availability as a derived side effect of ride lifecycle avoids the two ever drifting out of sync.

---

## 5. Possible Extensions

- **Geospatial indexing for matching:** Swap `find_nearest_driver`'s naive scan for a geohash/quad-tree lookup so matching stays fast with thousands of drivers.
- **Multiple ride types (pool, premium, XL):** Extend `Ride` with a `ride_type` and let `RideDispatcher` pick both the matching pool of drivers and the `FareStrategy` based on it.
- **Real-time ETA and live tracking:** Add periodic `Driver.current_location` updates and an ETA calculation using speed assumptions, surfaced via a notification/websocket layer.
- **Driver ratings and cancellation penalties:** Add a `Rating` entity tied to completed rides, and fare adjustments/penalties for passenger- or driver-initiated cancellations after acceptance.
