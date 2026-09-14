# Phase 09 — Booking Systems Design

## Overview

Booking/reservation systems are the most common category of LLD interview question — Parking Lot, Movie Ticket Booking, Cab Booking (Uber/Ola), Hotel Booking, Airline Booking, all share the same shape: **a limited, shared resource (spot, seat, driver, room) that must be allocated to exactly one requester at a time, for a period of time, with payment attached.**

This phase applies one consistent **7-step design process** to four classic problems. Memorize the process, not the answers — interviewers vary the requirements, and the process is what transfers.

## The 7-Step Design Process

1. **Clarify Requirements** — Functional requirements (what the system must do) and non-functional requirements (scale, concurrency, consistency). Always state assumptions out loud; never assume silently.
2. **Identify Entities/Classes** — Nouns in the requirements become candidate classes. Separate core domain entities (e.g., `ParkingSpot`) from service/manager classes (e.g., `ParkingLot`) that orchestrate them.
3. **Define Relationships** — Composition vs aggregation vs association between classes; multiplicities (1:1, 1:N, N:M).
4. **Assign Responsibilities** — Apply Single Responsibility: which class owns which piece of state and behavior? Avoid "God classes."
5. **Apply SOLID** — Check each class/interface against SRP, OCP, LSP, ISP, DIP. This is usually where interviewers probe hardest.
6. **Apply Design Patterns Where Appropriate** — Don't force patterns; introduce them where they solve a real variability (allocation strategy, fare calculation, notification, locking). Strategy, Observer, Factory, and Singleton recur constantly in booking systems.
7. **Explain Extensibility** — Walk through 2-3 "what if we added X" scenarios (new vehicle type, new payment method, dynamic pricing) and show the design absorbs them without rewriting core classes (Open/Closed in action).

## Lessons in This Phase

| # | Lesson | Core Design Challenge |
|---|--------|------------------------|
| 01 | [Parking Lot Design](01-Parking-Lot-Design.md) | Spot allocation strategy, multi-level/multi-type spots |
| 02 | [Movie Ticket Booking Design](02-Movie-Ticket-Booking-Design.md) | Preventing double-booking of the same seat under concurrency |
| 03 | [Cab Booking Design](03-Cab-Booking-Design.md) | Driver matching, fare strategy, ride-status notifications |
| 04 | [Hotel Booking Design](04-Hotel-Booking-Design.md) | Date-range availability checking, reservation lifecycle |

## How to Use This Phase

For each lesson: read the requirements, try designing the classes yourself on paper/whiteboard first, *then* compare against the lesson. In an actual interview you have 35-45 minutes total — budget roughly 5 minutes for step 1, 10 for steps 2-4, 10 for step 5-6, 5 for step 7, and the rest for coding a few key methods.

Full runnable implementations for these problems live in the course's `Projects/` folder — this phase focuses on the *design reasoning*, not production code.
