# LLD Projects — Reference Implementations

These are complete, runnable reference implementations of the most commonly asked LLD interview problems. Each is self-contained — read requirements, class diagram, then full code with a demo/main showing it running.

Copy the code block(s) from any file into a `.py` file and run it directly with `python3 <file>.py` — no external packages, no other files needed.

## Projects

| # | Project | Core Patterns Used | Difficulty |
|---|---------|---------------------|------------|
| 1 | [Parking Lot](01-Parking-Lot.md) | Strategy, Enum, Composition | Medium |
| 2 | [Movie Ticket Booking](02-Movie-Ticket-Booking.md) | State (seat status), Composition | Medium |
| 3 | [Splitwise](03-Splitwise.md) | Strategy (split types), Graph/Greedy | Hard |
| 4 | [Cab Booking](04-Cab-Booking.md) | Strategy (fare calc), Matching | Medium |
| 5 | [ATM](05-ATM.md) | State (ABC-based state machine) | Medium |

## How to Use These

1. Read the **Requirements** — these are the same functional/non-functional requirements an interviewer would state or that you'd clarify with them.
2. Study the **Class Diagram** — understand relationships (composition vs association, which classes hold references to which) before reading code.
3. Read the **Full Implementation** top to bottom — it is written as a single cohesive module.
4. Run the **Demo** section — paste everything into one `.py` file and execute it to see real output.
5. Review **Design Decisions** — this is the part interviewers actually probe on. Be ready to justify *why*, not just *what*.
6. Think through **Possible Extensions** — a strong candidate proactively mentions how the design accommodates new requirements.
