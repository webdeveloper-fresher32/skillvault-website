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

```java
/**
 * Cab Booking — single-file runnable LLD reference implementation in Java.
 * Run directly with: java CabBookingDemo.java
 */

import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

// ---------------------------------------------------------------------------
// Location + distance
// ---------------------------------------------------------------------------

record Location(double lat, double lng) {
    /**
     * Simple flat-plane Euclidean approximation, scaled roughly to km.
     * Good enough for city-scale LLD demo purposes (not real geodesy).
     */
    public double distanceTo(Location other) {
        double dx = (this.lat - other.lat) * 111.0; // ~111 km per degree latitude
        double dy = (this.lng - other.lng) * 111.0;
        return Math.hypot(dx, dy);
    }
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

enum RideStatus {
    REQUESTED,
    ACCEPTED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

class Driver {
    private final String driverId;
    private final String name;
    private Location currentLocation;
    private boolean isAvailable = true;

    public Driver(String driverId, String name, Location currentLocation) {
        this.driverId = driverId;
        this.name = name;
        this.currentLocation = currentLocation;
    }

    public String getDriverId() { return driverId; }
    public String getName() { return name; }
    public synchronized Location getCurrentLocation() { return currentLocation; }
    public synchronized void setCurrentLocation(Location loc) { this.currentLocation = loc; }
    public synchronized boolean isAvailable() { return isAvailable; }
    public synchronized void setAvailable(boolean available) { this.isAvailable = available; }

    @Override
    public String toString() {
        return "Driver(" + name + ")";
    }
}

record Passenger(String passengerId, String name) {
    @Override
    public String toString() {
        return "Passenger(" + name + ")";
    }
}

// ---------------------------------------------------------------------------
// Strategy: fare calculation
// ---------------------------------------------------------------------------

interface FareStrategy {
    double calculateFare(double distanceKm, double surgeMultiplier);
}

class StandardFareStrategy implements FareStrategy {
    public static final double BASE_FARE = 2.5;
    public static final double PER_KM_RATE = 1.2;

    @Override
    public double calculateFare(double distanceKm, double surgeMultiplier) {
        double fare = BASE_FARE + (distanceKm * PER_KM_RATE);
        return Math.round(fare * surgeMultiplier * 100.0) / 100.0;
    }
}

class PremiumFareStrategy implements FareStrategy {
    public static final double BASE_FARE = 6.0;
    public static final double PER_KM_RATE = 2.5;

    @Override
    public double calculateFare(double distanceKm, double surgeMultiplier) {
        double fare = BASE_FARE + (distanceKm * PER_KM_RATE);
        return Math.round(fare * surgeMultiplier * 100.0) / 100.0;
    }
}

// ---------------------------------------------------------------------------
// Ride
// ---------------------------------------------------------------------------

class Ride {
    private final String rideId;
    private final Passenger passenger;
    private final Location pickup;
    private final Location drop;
    private Driver driver;
    private RideStatus status = RideStatus.REQUESTED;
    private Double fare;

    public Ride(String rideId, Passenger passenger, Location pickup, Location drop) {
        this.rideId = rideId;
        this.passenger = passenger;
        this.pickup = pickup;
        this.drop = drop;
    }

    public synchronized void accept(Driver driver) {
        if (status != RideStatus.REQUESTED) {
            throw new IllegalStateException("Cannot accept ride in status " + status);
        }
        this.driver = driver;
        this.status = RideStatus.ACCEPTED;
        driver.setAvailable(false);
    }

    public synchronized void start() {
        if (status != RideStatus.ACCEPTED) {
            throw new IllegalStateException("Cannot start ride in status " + status);
        }
        this.status = RideStatus.IN_PROGRESS;
    }

    public synchronized double complete(FareStrategy fareStrategy, double surgeMultiplier) {
        if (status != RideStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cannot complete ride in status " + status);
        }
        double distance = pickup.distanceTo(drop);
        this.fare = fareStrategy.calculateFare(distance, surgeMultiplier);
        this.status = RideStatus.COMPLETED;
        if (driver != null) {
            driver.setAvailable(true);
            driver.setCurrentLocation(drop);
        }
        return this.fare;
    }

    public synchronized void cancel() {
        if (status == RideStatus.COMPLETED || status == RideStatus.CANCELLED) {
            throw new IllegalStateException("Cannot cancel ride in status " + status);
        }
        if (driver != null) {
            driver.setAvailable(true);
        }
        this.status = RideStatus.CANCELLED;
    }

    public String getRideId() { return rideId; }
    public Passenger getPassenger() { return passenger; }
    public Location getPickup() { return pickup; }
    public Location getDrop() { return drop; }
    public synchronized Driver getDriver() { return driver; }
    public synchronized RideStatus getStatus() { return status; }
    public synchronized Double getFare() { return fare; }
}

// ---------------------------------------------------------------------------
// RideDispatcher: matching + orchestration
// ---------------------------------------------------------------------------

class NoDriverAvailableException extends RuntimeException {
    public NoDriverAvailableException(String message) {
        super(message);
    }
}

class RideDispatcher {
    private final List<Driver> drivers;
    private FareStrategy fareStrategy;
    private final AtomicInteger rideCounter = new AtomicInteger(1);
    private final List<Ride> rides = new CopyOnWriteArrayList<>();

    public RideDispatcher(List<Driver> drivers, FareStrategy fareStrategy) {
        this.drivers = new ArrayList<>(drivers);
        this.fareStrategy = fareStrategy != null ? fareStrategy : new StandardFareStrategy();
    }

    public void setFareStrategy(FareStrategy fareStrategy) {
        this.fareStrategy = fareStrategy;
    }

    public synchronized Optional<Driver> findNearestDriver(Location pickup) {
        Driver bestDriver = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (Driver driver : drivers) {
            if (!driver.isAvailable()) {
                continue;
            }
            double distance = driver.getCurrentLocation().distanceTo(pickup);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestDriver = driver;
            }
        }
        return Optional.ofNullable(bestDriver);
    }

    public synchronized Ride requestRide(Passenger passenger, Location pickup, Location drop) {
        String rideId = String.format("RIDE-%04d", rideCounter.getAndIncrement());
        Ride ride = new Ride(rideId, passenger, pickup, drop);
        rides.add(ride);

        Optional<Driver> driverOpt = findNearestDriver(pickup);
        if (driverOpt.isEmpty()) {
            ride.cancel();
            throw new NoDriverAvailableException("No available drivers near pickup location");
        }

        ride.accept(driverOpt.get());
        return ride;
    }

    public synchronized double completeRide(Ride ride, double surgeMultiplier) {
        ride.start();
        return ride.complete(fareStrategy, surgeMultiplier);
    }

    public double completeRide(Ride ride) {
        return completeRide(ride, 1.0);
    }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

public class CabBookingDemo {
    public static void main(String[] args) {
        Location downtown = new Location(12.9716, 77.5946);

        List<Driver> drivers = List.of(
            new Driver("D1", "Ramesh", new Location(12.9750, 77.6000)), // ~0.7km away
            new Driver("D2", "Suresh", new Location(13.0500, 77.5946)), // ~8.7km away
            new Driver("D3", "Ganesh", new Location(12.9720, 77.5950))  // ~0.06km away, closest
        );

        RideDispatcher dispatcher = new RideDispatcher(drivers, new StandardFareStrategy());
        Passenger passenger = new Passenger("P1", "Meera");

        Location dropLocation = new Location(12.9352, 77.6146); // ~4.6 km south

        Ride ride = dispatcher.requestRide(passenger, downtown, dropLocation);
        System.out.printf("%s matched with %s (status: %s)
",
            ride.getRideId(), ride.getDriver().getName(), ride.getStatus());

        double fare = dispatcher.completeRide(ride, 1.0);
        System.out.printf("Ride completed. Distance-based fare: $%.2f (status: %s)
",
            fare, ride.getStatus());
        System.out.printf("%s is now available again: %b
",
            ride.getDriver().getName(), ride.getDriver().isAvailable());

        // A second ride during surge pricing, using the premium strategy
        dispatcher.setFareStrategy(new PremiumFareStrategy());
        Ride ride2 = dispatcher.requestRide(passenger, downtown, dropLocation);
        System.out.printf("
%s matched with %s
", ride2.getRideId(), ride2.getDriver().getName());
        double surgeFare = dispatcher.completeRide(ride2, 1.5);
        System.out.printf("Premium ride completed with 1.5x surge. Fare: $%.2f
", surgeFare);

        // Both drivers used above are free again (their rides completed). Now exhaust
        // all 3 drivers with uncompleted (still ACCEPTED) rides to trigger the error.
        System.out.println();
        for (int i = 0; i < 3; i++) {
            Ride r = dispatcher.requestRide(passenger, downtown, dropLocation);
            System.out.printf("%s matched with %s (driver now unavailable)
",
                r.getRideId(), r.getDriver().getName());
        }

        try {
            dispatcher.requestRide(passenger, downtown, dropLocation);
        } catch (NoDriverAvailableException e) {
            System.out.println("
Next ride request failed as expected: " + e.getMessage());
        }
    }
}
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
