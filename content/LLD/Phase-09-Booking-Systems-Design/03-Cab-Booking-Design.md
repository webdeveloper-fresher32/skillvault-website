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

```java
public class DriverMatcher {
    public Optional<Driver> findNearest(Location pickup, List<Driver> drivers, VehicleType vehicleType) {
        return drivers.stream()
            .filter(d -> d.isAvailable() && (vehicleType == null || d.getVehicle().getVehicleType() == vehicleType))
            .min(Comparator.comparingDouble(d -> pickup.distanceTo(d.getLocation())));
    }
}
```

**Why this is O(n) and how to say so correctly:** for a small city/simulation this is fine. At real scale (state this explicitly in interview), you'd replace the linear scan with a **geospatial index** — geohash-bucket the drivers and only scan nearby buckets, or use a quad-tree/R-tree — while keeping `DriverMatcher`'s interface identical. This demonstrates you understand the LLD/HLD boundary: the *design* accommodates the swap without an interviewer needing you to actually implement a quad-tree on the whiteboard.

**Handling driver rejection:** if the matched driver declines/times out, `RideBookingService` should request the *next*-nearest candidate rather than failing outright — this argues for `find_nearest` optionally returning a ranked list (`find_top_k`) rather than a single driver.

---

## 10. Java Skeleton

```java
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

public record Location(double lat, double lng) {
    public double distanceTo(Location other) {
        final double R = 6371.0;
        double lat1 = Math.toRadians(this.lat);
        double lat2 = Math.toRadians(other.lat);
        double dlat = Math.toRadians(other.lat - this.lat);
        double dlng = Math.toRadians(other.lng - this.lng);
        double a = Math.sin(dlat / 2) * Math.sin(dlat / 2)
                 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) * Math.sin(dlng / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

public enum VehicleType {
    MINI, SEDAN, SUV
}

public class Vehicle {
    private final String plateNumber;
    private final VehicleType vehicleType;

    public Vehicle(String plateNumber, VehicleType vehicleType) {
        this.plateNumber = plateNumber;
        this.vehicleType = vehicleType;
    }

    public String getPlateNumber() { return plateNumber; }
    public VehicleType getVehicleType() { return vehicleType; }
}

public record Rider(String riderId, String name) {}

public class Driver {
    private final String driverId;
    private final Vehicle vehicle;
    private Location location;
    private boolean isAvailable = true;

    public Driver(String driverId, Vehicle vehicle, Location location) {
        this.driverId = driverId;
        this.vehicle = vehicle;
        this.location = location;
    }

    public synchronized void updateLocation(Location loc) { this.location = loc; }
    public synchronized Location getLocation() { return location; }
    public synchronized boolean isAvailable() { return isAvailable; }
    public synchronized void setAvailable(boolean available) { this.isAvailable = available; }
    public Vehicle getVehicle() { return vehicle; }
    public String getDriverId() { return driverId; }
}

public enum RideStatus {
    REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED;

    public boolean canTransitionTo(RideStatus next) {
        return switch (this) {
            case REQUESTED -> next == ACCEPTED || next == CANCELLED;
            case ACCEPTED -> next == ARRIVED || next == CANCELLED;
            case ARRIVED -> next == IN_PROGRESS || next == CANCELLED;
            case IN_PROGRESS -> next == COMPLETED;
            case COMPLETED, CANCELLED -> false;
        };
    }
}

public interface RideObserver {
    void onStatusChanged(Ride ride);
}

public class RiderNotifier implements RideObserver {
    @Override public void onStatusChanged(Ride ride) {
        System.out.println("[Rider Notify] Ride " + ride.getRideId() + " is now " + ride.getStatus());
    }
}

public class DriverNotifier implements RideObserver {
    @Override public void onStatusChanged(Ride ride) {
        System.out.println("[Driver Notify] Ride " + ride.getRideId() + " is now " + ride.getStatus());
    }
}

public class Ride {
    private final String rideId;
    private final Rider rider;
    private Driver driver;
    private final Location pickup;
    private final Location drop;
    private RideStatus status = RideStatus.REQUESTED;
    private Double fare;
    private final List<RideObserver> observers = new CopyOnWriteArrayList<>();

    public Ride(String rideId, Rider rider, Location pickup, Location drop) {
        this.rideId = rideId;
        this.rider = rider;
        this.pickup = pickup;
        this.drop = drop;
    }

    public void addObserver(RideObserver observer) { observers.add(observer); }

    private synchronized void transition(RideStatus newStatus) {
        if (!this.status.canTransitionTo(newStatus)) {
            throw new IllegalStateException("Cannot transition from " + status + " to " + newStatus);
        }
        this.status = newStatus;
        for (RideObserver obs : observers) {
            obs.onStatusChanged(this);
        }
    }

    public synchronized void accept(Driver driver) {
        this.driver = driver;
        driver.setAvailable(false);
        transition(RideStatus.ACCEPTED);
    }

    public synchronized void markArrived() { transition(RideStatus.ARRIVED); }
    public synchronized void start() { transition(RideStatus.IN_PROGRESS); }

    public synchronized void complete(FareStrategy fareStrategy) {
        this.fare = fareStrategy.calculate(this);
        transition(RideStatus.COMPLETED);
        if (this.driver != null) {
            this.driver.setAvailable(true);
        }
    }

    public synchronized void cancel() {
        transition(RideStatus.CANCELLED);
        if (this.driver != null) {
            this.driver.setAvailable(true);
        }
    }

    public String getRideId() { return rideId; }
    public RideStatus getStatus() { return status; }
    public Location getPickup() { return pickup; }
    public Location getDrop() { return drop; }
    public Double getFare() { return fare; }
    public Driver getDriver() { return driver; }
}

public interface FareStrategy {
    double calculate(Ride ride);
}

public class PerKmFareStrategy implements FareStrategy {
    public static final double BASE_FARE = 40.0;
    public static final double RATE_PER_KM = 12.0;

    @Override
    public double calculate(Ride ride) {
        double distance = ride.getPickup().distanceTo(ride.getDrop());
        return BASE_FARE + (distance * RATE_PER_KM);
    }
}

public class SurgeFareStrategy implements FareStrategy {
    private final FareStrategy baseStrategy;
    private final double surgeMultiplier;

    public SurgeFareStrategy(FareStrategy baseStrategy, double surgeMultiplier) {
        this.baseStrategy = baseStrategy;
        this.surgeMultiplier = surgeMultiplier;
    }

    @Override
    public double calculate(Ride ride) {
        return baseStrategy.calculate(ride) * surgeMultiplier;
    }
}

public class DriverMatcher {
    public Optional<Driver> findNearest(Location pickup, List<Driver> drivers, VehicleType vehicleType) {
        return drivers.stream()
            .filter(d -> d.isAvailable() && (vehicleType == null || d.getVehicle().getVehicleType() == vehicleType))
            .min(Comparator.comparingDouble(d -> pickup.distanceTo(d.getLocation())));
    }
}

public class RideBookingService {
    private final DriverMatcher matcher;
    private final FareStrategy fareStrategy;

    public RideBookingService(DriverMatcher matcher, FareStrategy fareStrategy) {
        this.matcher = matcher;
        this.fareStrategy = fareStrategy;
    }

    public Ride requestRide(Rider rider, Location pickup, Location drop,
                            List<Driver> drivers, VehicleType vehicleType) {
        Ride ride = new Ride(UUID.randomUUID().toString(), rider, pickup, drop);
        ride.addObserver(new RiderNotifier());
        ride.addObserver(new DriverNotifier());

        Driver driver = matcher.findNearest(pickup, drivers, vehicleType)
            .orElseThrow(() -> new IllegalStateException("No available drivers nearby"));

        ride.accept(driver);
        return ride;
    }
}
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
