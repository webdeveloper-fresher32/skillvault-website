# Project 1 — Parking Lot System

**Difficulty:** Medium
**Patterns used:** Strategy (spot allocation), Enum (vehicle/spot types), Composition

---

## 1. Requirements

**Functional:**
- The parking lot has multiple floors. Each floor has parking spots of different sizes: `MOTORCYCLE`, `COMPACT`, `LARGE`.
- Vehicles are one of `MOTORCYCLE`, `CAR`, `TRUCK`. A vehicle can only park in a spot whose size can accommodate it (a motorcycle can use any spot, a car needs `COMPACT` or `LARGE`, a truck needs `LARGE`).
- On entry, the system finds an available spot, assigns it, and issues a `Ticket` with entry time.
- On exit, the system calculates the fee based on duration, frees the spot, and generates a `Payment`.
- The system should report real-time availability per floor/spot-size.

**Non-functional:**
- Spot allocation strategy should be swappable (nearest-first, first-available, etc.) without changing core parking logic.
- Thread-safety is out of scope for this exercise (noted as an extension).

---

## 2. Class Diagram

```
                       ┌───────────────────┐
                       │    ParkingLot     │
                       │───────────────────│
                       │ - floors: List     │
                       │ - active_tickets   │
                       │ - allocator        │──────────┐
                       │───────────────────│           │
                       │ + park_vehicle()   │           ▼
                       │ + unpark_vehicle() │   ┌──────────────────────┐
                       └─────────┬─────────┘   │ «interface»          │
                                 │ 1..*         │ SpotAllocationStrategy│
                                 ▼              │──────────────────────│
                       ┌───────────────────┐    │ + find_spot()        │
                       │      Floor        │    └──────────┬───────────┘
                       │───────────────────│               │ implements
                       │ - floor_number     │      ┌────────┴─────────┐
                       │ - spots: List      │      │ FirstAvailable   │
                       └─────────┬─────────┘      │ Strategy         │
                                 │ 1..*             └──────────────────┘
                                 ▼
                       ┌───────────────────┐        ┌───────────────┐
                       │   ParkingSpot     │◀──────▶│    Vehicle    │
                       │───────────────────│  1  0..1│───────────────│
                       │ - spot_id         │        │ - plate        │
                       │ - size: SpotSize  │        │ - type: VehicleType │
                       │ - vehicle         │        └───────────────┘
                       └───────────────────┘

                       ┌───────────────────┐        ┌───────────────┐
                       │      Ticket       │───────▶│    Payment    │
                       │───────────────────│  1   1 │───────────────│
                       │ - ticket_id        │        │ - amount       │
                       │ - entry_time       │        │ - paid_at      │
                       │ - spot, vehicle    │        └───────────────┘
                       └───────────────────┘
```

---

## 3. Full Implementation

```python
"""
Parking Lot — single-file runnable LLD reference implementation.
"""

from __future__ import annotations

import itertools
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class VehicleType(Enum):
    MOTORCYCLE = auto()
    CAR = auto()
    TRUCK = auto()


class SpotSize(Enum):
    MOTORCYCLE = auto()
    COMPACT = auto()
    LARGE = auto()


# A vehicle type can park in any spot size >= its minimum requirement.
# Smaller enum value here just means "smallest spot that fits".
VEHICLE_MIN_SPOT: Dict[VehicleType, SpotSize] = {
    VehicleType.MOTORCYCLE: SpotSize.MOTORCYCLE,
    VehicleType.CAR: SpotSize.COMPACT,
    VehicleType.TRUCK: SpotSize.LARGE,
}

# Ordering used to check "does spot size X fit vehicle needing at least Y".
SPOT_SIZE_RANK: Dict[SpotSize, int] = {
    SpotSize.MOTORCYCLE: 0,
    SpotSize.COMPACT: 1,
    SpotSize.LARGE: 2,
}


def spot_fits_vehicle(spot_size: SpotSize, vehicle_type: VehicleType) -> bool:
    required = VEHICLE_MIN_SPOT[vehicle_type]
    return SPOT_SIZE_RANK[spot_size] >= SPOT_SIZE_RANK[required]


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------

@dataclass
class Vehicle:
    plate: str
    type: VehicleType


class ParkingSpot:
    def __init__(self, spot_id: str, size: SpotSize):
        self.spot_id = spot_id
        self.size = size
        self.vehicle: Optional[Vehicle] = None

    @property
    def is_free(self) -> bool:
        return self.vehicle is None

    def assign(self, vehicle: Vehicle) -> None:
        if not self.is_free:
            raise ValueError(f"Spot {self.spot_id} is already occupied")
        self.vehicle = vehicle

    def vacate(self) -> None:
        self.vehicle = None

    def __repr__(self) -> str:
        state = self.vehicle.plate if self.vehicle else "empty"
        return f"Spot({self.spot_id}, {self.size.name}, {state})"


class Floor:
    def __init__(self, floor_number: int, spots: List[ParkingSpot]):
        self.floor_number = floor_number
        self.spots = spots

    def available_spots(self, vehicle_type: VehicleType) -> List[ParkingSpot]:
        return [
            s for s in self.spots
            if s.is_free and spot_fits_vehicle(s.size, vehicle_type)
        ]

    def availability_summary(self) -> Dict[SpotSize, int]:
        summary = {size: 0 for size in SpotSize}
        for s in self.spots:
            if s.is_free:
                summary[s.size] += 1
        return summary


@dataclass
class Payment:
    amount: float
    paid_at: datetime = field(default_factory=datetime.now)


@dataclass
class Ticket:
    ticket_id: str
    vehicle: Vehicle
    spot: ParkingSpot
    entry_time: datetime
    exit_time: Optional[datetime] = None
    payment: Optional[Payment] = None


# ---------------------------------------------------------------------------
# Strategy: spot allocation
# ---------------------------------------------------------------------------

class SpotAllocationStrategy(ABC):
    """Interface for pluggable spot-selection algorithms."""

    @abstractmethod
    def find_spot(
        self, floors: List[Floor], vehicle_type: VehicleType
    ) -> Optional[ParkingSpot]:
        ...


class FirstAvailableStrategy(SpotAllocationStrategy):
    """Picks the first free, fitting spot on the lowest floor number."""

    def find_spot(
        self, floors: List[Floor], vehicle_type: VehicleType
    ) -> Optional[ParkingSpot]:
        for floor in sorted(floors, key=lambda f: f.floor_number):
            candidates = floor.available_spots(vehicle_type)
            if candidates:
                # Prefer the tightest-fitting spot to save larger spots
                # for vehicles that actually need them.
                candidates.sort(key=lambda s: SPOT_SIZE_RANK[s.size])
                return candidates[0]
        return None


# ---------------------------------------------------------------------------
# Rate calculation (kept simple: flat hourly rate per spot size)
# ---------------------------------------------------------------------------

HOURLY_RATE: Dict[SpotSize, float] = {
    SpotSize.MOTORCYCLE: 1.0,
    SpotSize.COMPACT: 2.0,
    SpotSize.LARGE: 3.5,
}


def calculate_fee(spot: ParkingSpot, entry_time: datetime, exit_time: datetime) -> float:
    duration: timedelta = exit_time - entry_time
    hours = max(1, -(-int(duration.total_seconds()) // 3600))  # ceil to next hour, min 1
    return round(hours * HOURLY_RATE[spot.size], 2)


# ---------------------------------------------------------------------------
# ParkingLot: the facade that ties everything together
# ---------------------------------------------------------------------------

class ParkingLot:
    def __init__(self, floors: List[Floor], allocator: Optional[SpotAllocationStrategy] = None):
        self.floors = floors
        self.allocator = allocator or FirstAvailableStrategy()
        self.active_tickets: Dict[str, Ticket] = {}  # ticket_id -> Ticket
        self._ticket_ids = itertools.count(1)

    def park_vehicle(self, vehicle: Vehicle, entry_time: Optional[datetime] = None) -> Ticket:
        spot = self.allocator.find_spot(self.floors, vehicle.type)
        if spot is None:
            raise RuntimeError(f"No available spot for {vehicle.type.name}")

        spot.assign(vehicle)
        ticket = Ticket(
            ticket_id=f"T-{next(self._ticket_ids):04d}",
            vehicle=vehicle,
            spot=spot,
            entry_time=entry_time or datetime.now(),
        )
        self.active_tickets[ticket.ticket_id] = ticket
        return ticket

    def unpark_vehicle(self, ticket_id: str, exit_time: Optional[datetime] = None) -> Payment:
        ticket = self.active_tickets.get(ticket_id)
        if ticket is None:
            raise ValueError(f"Unknown or already-closed ticket: {ticket_id}")

        ticket.exit_time = exit_time or datetime.now()
        fee = calculate_fee(ticket.spot, ticket.entry_time, ticket.exit_time)
        payment = Payment(amount=fee)
        ticket.payment = payment

        ticket.spot.vacate()
        del self.active_tickets[ticket_id]
        return payment

    def display_availability(self) -> None:
        for floor in self.floors:
            summary = floor.availability_summary()
            readable = ", ".join(f"{size.name}: {count}" for size, count in summary.items())
            print(f"  Floor {floor.floor_number} -> {readable}")


# ---------------------------------------------------------------------------
# Helper: build a small demo lot
# ---------------------------------------------------------------------------

def build_sample_lot() -> ParkingLot:
    floor1 = Floor(1, [
        ParkingSpot("F1-M1", SpotSize.MOTORCYCLE),
        ParkingSpot("F1-C1", SpotSize.COMPACT),
        ParkingSpot("F1-C2", SpotSize.COMPACT),
        ParkingSpot("F1-L1", SpotSize.LARGE),
    ])
    floor2 = Floor(2, [
        ParkingSpot("F2-C1", SpotSize.COMPACT),
        ParkingSpot("F2-L1", SpotSize.LARGE),
        ParkingSpot("F2-L2", SpotSize.LARGE),
    ])
    return ParkingLot([floor1, floor2], allocator=FirstAvailableStrategy())


if __name__ == "__main__":
    lot = build_sample_lot()

    print("Initial availability:")
    lot.display_availability()

    bike = Vehicle(plate="MH-01-AA-1111", type=VehicleType.MOTORCYCLE)
    car = Vehicle(plate="MH-01-BB-2222", type=VehicleType.CAR)
    truck = Vehicle(plate="MH-01-CC-3333", type=VehicleType.TRUCK)

    t1 = lot.park_vehicle(bike)
    t2 = lot.park_vehicle(car)
    t3 = lot.park_vehicle(truck)

    print(f"\nIssued tickets: {t1.ticket_id} ({t1.spot.spot_id}), "
          f"{t2.ticket_id} ({t2.spot.spot_id}), {t3.ticket_id} ({t3.spot.spot_id})")

    print("\nAvailability after parking 3 vehicles:")
    lot.display_availability()

    # Simulate the car staying for 2.5 hours
    exit_time = t2.entry_time + timedelta(hours=2, minutes=30)
    payment = lot.unpark_vehicle(t2.ticket_id, exit_time=exit_time)
    print(f"\n{car.plate} exited. Fee charged: ${payment.amount:.2f}")

    print("\nAvailability after car exits:")
    lot.display_availability()
```

**Expected output (abridged, entry times use `datetime.now()` so exact timestamps vary):**

```
Initial availability:
  Floor 1 -> MOTORCYCLE: 1, COMPACT: 2, LARGE: 1
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2

Issued tickets: T-0001 (F1-M1), T-0002 (F1-C1), T-0003 (F1-L1)

Availability after parking 3 vehicles:
  Floor 1 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 0
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2

MH-01-BB-2222 exited. Fee charged: $6.00

Availability after car exits:
  Floor 1 -> MOTORCYCLE: 0, COMPACT: 2, LARGE: 0
  Floor 2 -> MOTORCYCLE: 0, COMPACT: 1, LARGE: 2
```

---

## 4. Design Decisions

- **Strategy pattern for allocation:** `SpotAllocationStrategy` is an ABC so the actual "which spot do I give this vehicle" algorithm (first-available, nearest-to-entrance, load-balanced-across-floors) is decoupled from `ParkingLot`. Swapping strategies is a one-line change (`ParkingLot(floors, allocator=NearestExitStrategy())`), with zero changes to `park_vehicle`/`unpark_vehicle`.
- **Enums for vehicle/spot types:** `VehicleType` and `SpotSize` are enums rather than strings to get compile-time-ish safety (no typos like `"compact "`), exhaustive `match`/dict lookups, and clear intent. The `SPOT_SIZE_RANK` mapping turns "can this spot fit this vehicle" into a simple integer comparison instead of a long if/elif chain.
- **Composition over inheritance:** `ParkingLot` *has* `Floor`s which *have* `ParkingSpot`s — no inheritance hierarchy needed since a floor isn't a "kind of" spot. This mirrors the real-world containment relationship and keeps each class small and testable in isolation.
- **Ticket as the source of truth for a session:** `ParkingLot` tracks `active_tickets` keyed by ID rather than scanning spots to find "which vehicle is where" — this makes `unpark_vehicle` O(1) instead of O(spots).

---

## 5. Possible Extensions

- **Multiple entry/exit gates:** Add an `EntryPanel`/`ExitPanel` class per physical gate; each calls into the same shared `ParkingLot`, and allocation strategy could favor spots nearest to the gate the vehicle entered from.
- **EV charging spots:** Add `SpotFeature` (e.g., `EV_CHARGING`) as a set attribute on `ParkingSpot` rather than a new `SpotSize`, and let the allocator take an optional `required_features` filter.
- **Monthly passes / subscriptions:** Add a `Subscription` entity linked to a vehicle plate; on entry, check for an active subscription before falling back to per-visit ticketing, and skip fee calculation in `unpark_vehicle` for subscribed vehicles.
- **Concurrency:** Wrap `assign`/`vacate` with a per-spot lock (or use an atomic "claim" compare-and-swap) so two simultaneous entries can't be allocated the same spot in a multi-threaded/multi-process deployment.
