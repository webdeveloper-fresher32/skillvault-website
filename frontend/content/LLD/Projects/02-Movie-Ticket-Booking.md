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

```java
/**
 * Movie Ticket Booking — single-file runnable LLD reference implementation in Java.
 * Run directly with: java MovieTicketBookingDemo.java
 */

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

enum SeatCategory {
    REGULAR(10.0),
    PREMIUM(18.0);

    private final double price;
    SeatCategory(double price) { this.price = price; }
    public double getPrice() { return price; }
}

enum SeatStatus {
    AVAILABLE,
    LOCKED,
    BOOKED
}

enum PaymentStatus {
    PENDING,
    SUCCESS,
    FAILED
}

// ---------------------------------------------------------------------------
// Core static entities
// ---------------------------------------------------------------------------

record Seat(String seatId, SeatCategory category) {}

record Movie(String title, int durationMinutes) {}

class Screen {
    private final String screenId;
    private final List<Seat> seats;

    public Screen(String screenId, List<Seat> seats) {
        this.screenId = screenId;
        this.seats = List.copyOf(seats);
    }

    public String getScreenId() { return screenId; }
    public List<Seat> getSeats() { return seats; }
}

class Theatre {
    private final String name;
    private final List<Screen> screens;

    public Theatre(String name, List<Screen> screens) {
        this.name = name;
        this.screens = List.copyOf(screens);
    }

    public String getName() { return name; }
    public List<Screen> getScreens() { return screens; }
}

// ---------------------------------------------------------------------------
// Show: a movie playing on a screen at a specific time, with live seat state
// ---------------------------------------------------------------------------

class Show {
    public static final Duration LOCK_DURATION = Duration.ofMinutes(5);

    private final String showId;
    private final Movie movie;
    private final Screen screen;
    private final LocalDateTime startTime;

    private final Map<String, SeatStatus> seatStatus = new ConcurrentHashMap<>();
    private final Map<String, LocalDateTime> lockExpiry = new ConcurrentHashMap<>();
    private final Map<String, Seat> seatsById = new HashMap<>();

    public Show(String showId, Movie movie, Screen screen, LocalDateTime startTime) {
        this.showId = showId;
        this.movie = movie;
        this.screen = screen;
        this.startTime = startTime;
        for (Seat seat : screen.getSeats()) {
            this.seatStatus.put(seat.seatId(), SeatStatus.AVAILABLE);
            this.seatsById.put(seat.seatId(), seat);
        }
    }

    public synchronized List<Seat> availableSeats() {
        expireStaleLocks(LocalDateTime.now());
        return seatStatus.entrySet().stream()
            .filter(e -> e.getValue() == SeatStatus.AVAILABLE)
            .map(e -> seatsById.get(e.getKey()))
            .collect(Collectors.toList());
    }

    private synchronized void expireStaleLocks(LocalDateTime now) {
        for (Map.Entry<String, LocalDateTime> entry : new HashMap<>(lockExpiry).entrySet()) {
            String seatId = entry.getKey();
            LocalDateTime expiry = entry.getValue();
            if (seatStatus.get(seatId) == SeatStatus.LOCKED && !now.isBefore(expiry)) {
                seatStatus.put(seatId, SeatStatus.AVAILABLE);
                lockExpiry.remove(seatId);
            }
        }
    }

    /** Atomically lock a group of seats. Returns false if any seat is unavailable. */
    public synchronized boolean lockSeats(List<String> seatIds, LocalDateTime now) {
        LocalDateTime currentTime = (now != null) ? now : LocalDateTime.now();
        expireStaleLocks(currentTime);

        for (String seatId : seatIds) {
            if (seatStatus.get(seatId) != SeatStatus.AVAILABLE) {
                return false; // at least one seat already locked/booked -> abort, lock nothing
            }
        }

        for (String seatId : seatIds) {
            seatStatus.put(seatId, SeatStatus.LOCKED);
            lockExpiry.put(seatId, currentTime.plus(LOCK_DURATION));
        }
        return true;
    }

    public synchronized void confirmSeats(List<String> seatIds) {
        for (String seatId : seatIds) {
            if (seatStatus.get(seatId) != SeatStatus.LOCKED) {
                throw new IllegalStateException("Seat " + seatId + " is not locked, cannot confirm");
            }
        }
        for (String seatId : seatIds) {
            seatStatus.put(seatId, SeatStatus.BOOKED);
            lockExpiry.remove(seatId);
        }
    }

    public synchronized void releaseSeats(List<String> seatIds) {
        for (String seatId : seatIds) {
            if (seatStatus.get(seatId) == SeatStatus.LOCKED) {
                seatStatus.put(seatId, SeatStatus.AVAILABLE);
                lockExpiry.remove(seatId);
            }
        }
    }

    public double priceFor(List<String> seatIds) {
        return seatIds.stream()
            .mapToDouble(sid -> seatsById.get(sid).category().getPrice())
            .sum();
    }

    public String getShowId() { return showId; }
    public Movie getMovie() { return movie; }
    public Screen getScreen() { return screen; }
    public LocalDateTime getStartTime() { return startTime; }
}

// ---------------------------------------------------------------------------
// Booking + Payment
// ---------------------------------------------------------------------------

class Payment {
    private final double amount;
    private PaymentStatus status;

    public Payment(double amount, PaymentStatus status) {
        this.amount = amount;
        this.status = status;
    }

    public Payment(double amount) {
        this(amount, PaymentStatus.PENDING);
    }

    public double getAmount() { return amount; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
}

class Booking {
    private final String bookingId;
    private final String user;
    private final Show show;
    private final List<String> seatIds;
    private final Payment payment;
    private final LocalDateTime createdAt;

    public Booking(String bookingId, String user, Show show, List<String> seatIds, Payment payment) {
        this.bookingId = bookingId;
        this.user = user;
        this.show = show;
        this.seatIds = List.copyOf(seatIds);
        this.payment = payment;
        this.createdAt = LocalDateTime.now();
    }

    public String getBookingId() { return bookingId; }
    public String getUser() { return user; }
    public Show getShow() { return show; }
    public List<String> getSeatIds() { return seatIds; }
    public Payment getPayment() { return payment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}

// ---------------------------------------------------------------------------
// BookingManager: orchestrates the lock -> pay -> confirm workflow
// ---------------------------------------------------------------------------

class SeatsUnavailableException extends RuntimeException {
    public SeatsUnavailableException(String message) {
        super(message);
    }
}

class PaymentFailedException extends RuntimeException {
    public PaymentFailedException(String message) {
        super(message);
    }
}

class BookingManager {
    private final AtomicInteger bookingCounter = new AtomicInteger(1);
    private final Map<String, Booking> bookings = new ConcurrentHashMap<>();

    public synchronized Booking book(
        String user,
        Show show,
        List<String> seatIds,
        boolean paymentShouldSucceed
    ) {
        boolean locked = show.lockSeats(seatIds, LocalDateTime.now());
        if (!locked) {
            throw new SeatsUnavailableException("One or more seats in " + seatIds + " are no longer available");
        }

        double amount = show.priceFor(seatIds);
        Payment payment = new Payment(amount);

        if (!paymentShouldSucceed) {
            payment.setStatus(PaymentStatus.FAILED);
            show.releaseSeats(seatIds);
            throw new PaymentFailedException(String.format("Payment of $%.2f failed; seats released", amount));
        }

        payment.setStatus(PaymentStatus.SUCCESS);
        show.confirmSeats(seatIds);

        String bookingId = String.format("BKG-%04d", bookingCounter.getAndIncrement());
        Booking booking = new Booking(bookingId, user, show, seatIds, payment);
        bookings.put(booking.getBookingId(), booking);
        return booking;
    }

    public Booking book(String user, Show show, List<String> seatIds) {
        return book(user, show, seatIds, true);
    }

    public Map<String, Booking> getBookings() {
        return Collections.unmodifiableMap(bookings);
    }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

public class MovieTicketBookingDemo {
    public static Show buildSampleShow() {
        List<Seat> seats = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            seats.add(new Seat("A" + i, SeatCategory.PREMIUM));
        }
        for (int i = 1; i <= 5; i++) {
            seats.add(new Seat("B" + i, SeatCategory.REGULAR));
        }
        Screen screen = new Screen("SCR-1", seats);
        Theatre theatre = new Theatre("Cineplex Downtown", List.of(screen));
        Movie movie = new Movie("The LLD Interview", 125);
        return new Show("SHOW-001", movie, screen, LocalDateTime.now().plusHours(3));
    }

    public static void main(String[] args) {
        Show show = buildSampleShow();
        BookingManager manager = new BookingManager();

        System.out.println("Available seats before booking: " +
            show.availableSeats().stream().map(Seat::seatId).toList());

        // User A books two premium seats successfully
        Booking bookingA = manager.book("alice", show, List.of("A1", "A2"));
        System.out.printf("
%s: alice booked %s for $%.2f (%s)
",
            bookingA.getBookingId(), bookingA.getSeatIds(), bookingA.getPayment().getAmount(), bookingA.getPayment().getStatus());

        // User B tries to book one of the same seats -> must fail, no double booking
        try {
            manager.book("bob", show, List.of("A1", "B1"));
        } catch (SeatsUnavailableException e) {
            System.out.println("
bob's booking rejected as expected: " + e.getMessage());
        }

        // User C books different seats, but payment fails -> seats must be released
        try {
            manager.book("carol", show, List.of("B2", "B3"), false);
        } catch (PaymentFailedException e) {
            System.out.println("
carol's booking failed as expected: " + e.getMessage());
        }

        System.out.println("
Available seats after all attempts: " +
            show.availableSeats().stream().map(Seat::seatId).toList());

        // carol retries and succeeds now that seats were released
        Booking bookingC = manager.book("carol", show, List.of("B2", "B3"));
        System.out.printf("
%s: carol booked %s for $%.2f (%s)
",
            bookingC.getBookingId(), bookingC.getSeatIds(), bookingC.getPayment().getAmount(), bookingC.getPayment().getStatus());

        System.out.println("
Final available seats: " +
            show.availableSeats().stream().map(Seat::seatId).toList());
    }
}
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
