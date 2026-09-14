# Identifying Objects and Responsibilities — The Noun-Extraction Technique

## Table of Contents
1. [The Problem: Where Do You Even Start?](#1-the-problem-where-do-you-even-start)
2. [The Technique, Step by Step](#2-the-technique-step-by-step)
3. [Worked Example 1 — Design WhatsApp](#3-worked-example-1--design-whatsapp)
4. [Worked Example 2 — Design a Library System](#4-worked-example-2--design-a-library-system)
5. [Worked Example 3 — Design an Elevator](#5-worked-example-3--design-an-elevator)
6. [How to Think Out Loud in the Interview](#6-how-to-think-out-loud-in-the-interview)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Where Do You Even Start?

Given a prompt like "Design WhatsApp" or "Design a Library System," most candidates freeze because the prompt is deliberately vague. The fix is a repeatable, almost mechanical technique: **extract nouns from the problem statement and from your own mental walkthrough of how the system is used, then turn each noun into a candidate class.** This is the object-oriented analog of "identify the entities" in database design — except here you also assign *behavior* (methods), not just *data* (columns).

```
Vague prompt  ──▶  Nouns (candidate classes)  ──▶  Attributes + Relationships  ──▶  Responsibilities (methods)  ──▶  Class diagram
```

This lesson teaches that pipeline and applies it three times end to end.

---

## 2. The Technique, Step by Step

### Step 1 — Restate the problem and clarify scope
Before extracting anything, restate the prompt back and ask 2-3 clarifying questions. This narrows scope and buys you thinking time. ("Should I support group chats and media, or just 1:1 text messages? Are we designing the backend model, or also UI?")

### Step 2 — List the core use cases (user stories)
Write down 4-6 things a user actually *does*. Nouns hide inside verbs — "a user sends a message to a group" surfaces `User`, `Message`, `Group` all at once.

### Step 3 — Extract nouns → candidate classes
Go through your use cases and your restated problem sentence by sentence. Underline every noun. Not every noun becomes a class — some become attributes (a `phone_number` is an attribute of `User`, not its own class) — but every noun is a *candidate* worth considering.

### Step 4 — Filter: class, attribute, or irrelevant?
For each candidate noun, ask:
- Does it have its own **identity and lifecycle** (created, modified, deleted independently)? → likely a class.
- Is it just a **property/value** of something else (a string, number, date, enum)? → likely an attribute.
- Is it outside the scope you clarified in Step 1? → drop it.

### Step 5 — Identify relationships between the surviving classes
For every pair of related classes, decide: association, aggregation, composition, or inheritance (see `01-Class-Diagrams-Basics.md`). Also note multiplicity (`1..*`, `0..1`, etc.).

### Step 6 — Assign responsibilities (methods) to each class
This is the step most candidates skip, and it's the one that most reveals OOP maturity. For each class, ask: **"What is this object responsible for knowing, and what is it responsible for doing?"** A responsibility should live on the class that owns the data it needs (this is the "Information Expert" principle — assign a behavior to the class that has the information required to fulfill it).

### Step 7 — Draw the class diagram
Boxes with attributes/methods, arrows for relationships, multiplicity labels. This becomes your anchor for the rest of the interview.

---

## 3. Worked Example 1 — Design WhatsApp

### Step 1-2: Scope and use cases
Assume scope: 1:1 chats, group chats, text + media messages, online/offline status ("Status" as in presence, not the "Status" story feature — clarify this out loud). Use cases:
- A user sends a message to another user or to a group.
- A user creates a group and adds/removes members.
- A user sees delivery/read receipts on a message.
- A user uploads a media file (image/video) as part of a message.
- A user sees another user's online/last-seen status.

### Step 3-4: Noun extraction and filtering

| Noun found | Class, attribute, or drop? | Reasoning |
|---|---|---|
| User | Class | Has identity, lifecycle, own behavior (send message, change status) |
| Message | Class | Has identity (message id), timestamp, status, content — independent lifecycle |
| Group | Class | Has identity, member list, own lifecycle (created/deleted) |
| Media | Class | Has identity (file), type, size — attached to messages but modeled separately since it has its own metadata |
| Chat / Conversation | Class | Groups messages between a fixed set of participants (1:1 or group) — needed to answer "show me this thread" |
| Status (presence) | Attribute | Just an enum (`ONLINE`, `OFFLINE`, `last_seen`) on `User` — no independent lifecycle |
| phone_number, name | Attribute | Simple values on `User` |
| Delivery/read receipt | Attribute | A status enum (`SENT`, `DELIVERED`, `READ`) on `Message`, not its own class |

### Step 5: Relationships

```
User        1 ──── * Chat        (a user participates in many chats)      → Association
Chat        1 ──── * Message      (a chat contains many messages)          → Composition
Group       ────▷  Chat            (a Group IS-A special kind of Chat)     → Inheritance
Message     0..1 ── 1 Media        (a message may carry one media file)    → Aggregation
User        1 ──── * Message      (a user sends many messages)             → Association
```

```
                        ┌───────────────┐
                        │      Chat       │
                        ├───────────────┤
                        │ - chat_id       │
                        │ - participants  │
                        ├───────────────┤
                        │ + add_message() │
                        └───────△───────┘
                                │  (IS-A)
                        ┌───────┴───────┐
                        │      Group      │
                        ├───────────────┤
                        │ - admin_id      │
                        ├───────────────┤
                        │ + add_member()  │
                        │ + remove_member()│
                        └───────────────┘

┌───────────────┐  1        *  ┌───────────────┐   0..1      1  ┌───────────────┐
│      User       │ ───────────▶ │    Message      │ ◇──────────────▶ │     Media       │
└───────────────┘   sends       ├───────────────┤   attaches      └───────────────┘
                                │ - text          │
                                │ - status        │
                                │ - timestamp     │
                                ├───────────────┤
                                │ + mark_read()   │
                                └───────────────┘
                                        ▲
                                        │ contains (composition ◆)
                                ┌───────┴───────┐
                                │      Chat       │  (same class as above)
                                └───────────────┘
```

### Step 6: Responsibilities

| Class | Responsibilities (methods) |
|---|---|
| `User` | `send_message()`, `update_status()`, knows its own contact list |
| `Chat` | `add_message()`, `get_messages()` — owns the collection of messages |
| `Group(Chat)` | `add_member()`, `remove_member()` — group-specific membership rules |
| `Message` | `mark_delivered()`, `mark_read()` — owns its own status transitions |
| `Media` | `get_file_url()`, `get_size()` — knows about its own storage details |

```python
from abc import ABC
from datetime import datetime
from enum import Enum, auto


class MessageStatus(Enum):
    SENT = auto()
    DELIVERED = auto()
    READ = auto()


class Media:
    def __init__(self, file_url: str, size_bytes: int):
        self.file_url = file_url
        self.size_bytes = size_bytes


class Message:
    def __init__(self, sender: "User", text: str, media: Media | None = None):
        self.sender = sender
        self.text = text
        self.media = media                      # aggregation: Media created outside, optionally attached
        self.status = MessageStatus.SENT
        self.timestamp = datetime.now()

    def mark_delivered(self) -> None:
        self.status = MessageStatus.DELIVERED

    def mark_read(self) -> None:
        self.status = MessageStatus.READ


class Chat:
    def __init__(self, chat_id: str, participants: list["User"]):
        self.chat_id = chat_id
        self.participants = participants
        self.messages: list[Message] = []       # composition: Chat owns its Messages

    def add_message(self, message: Message) -> None:
        self.messages.append(message)


class Group(Chat):                               # inheritance: Group IS-A Chat
    def __init__(self, chat_id: str, participants: list["User"], admin: "User"):
        super().__init__(chat_id, participants)
        self.admin = admin

    def add_member(self, user: "User") -> None:
        self.participants.append(user)

    def remove_member(self, user: "User") -> None:
        self.participants.remove(user)


class User:
    def __init__(self, name: str, phone_number: str):
        self.name = name
        self.phone_number = phone_number
        self.is_online = False

    def send_message(self, chat: Chat, text: str, media: Media | None = None) -> Message:
        message = Message(sender=self, text=text, media=media)
        chat.add_message(message)
        return message
```

---

## 4. Worked Example 2 — Design a Library System

### Step 1-2: Scope and use cases
Scope: members can search and borrow/return books; librarians manage the catalog; fines apply for late returns. Use cases:
- A member searches for a book by title/author.
- A member checks out a book.
- A member returns a book, possibly incurring a fine if late.
- A librarian adds a new book title to the catalog, with multiple physical copies.

### Step 3-4: Noun extraction and filtering

| Noun | Class / attribute / drop | Reasoning |
|---|---|---|
| Book (title) | Class (`BookTitle`) | Has identity (ISBN), independent of any single physical copy |
| BookCopy | Class | Each physical copy has its own status (available/checked out) — one title can have many copies |
| Member | Class | Has identity, borrowing history, own lifecycle |
| Librarian | Class | Distinct role/permissions from Member — IS-A `Person` (or separate class) |
| Library | Class | The system boundary — owns the catalog and coordinates checkouts |
| Fine | Class | Has its own amount, paid/unpaid state, tied to a specific late return — enough independent state to be a class rather than a plain attribute |
| Checkout / Loan record | Class | Tracks which member borrowed which copy and when — needed to compute fines and due dates |
| due_date, isbn | Attribute | Simple values |

### Step 5: Relationships

```
Library     1 ──── *  BookTitle    (catalog contains many titles)        → Composition
BookTitle   1 ──── *  BookCopy      (a title has multiple physical copies) → Composition
Member      1 ──── *  Loan          (a member has many loan records)      → Association
BookCopy    1 ──── 0..1 Loan        (a copy has at most one active loan)  → Association
Loan        1 ──── 0..1 Fine        (a loan may generate one fine)         → Aggregation
Librarian   ────▷  Person; Member ────▷ Person  (both IS-A Person)        → Inheritance
```

### ASCII Class Diagram

```
                          ┌───────────────┐
                          │     Person      │
                          ├───────────────┤
                          │ - name          │
                          │ - id            │
                          └───────△───────┘
                                  │
                     ┌────────────┼────────────┐
                     │                          │
           ┌───────────────┐          ┌───────────────┐
           │     Member       │          │   Librarian     │
           ├───────────────┤          ├───────────────┤
           │ + borrow()      │          │ + add_title()   │
           │ + return_copy() │          │ + add_copy()    │
           └───────△───────┘          └───────────────┘
                   │  1
                   │
                   │  *
           ┌───────┴───────┐   1        0..1  ┌───────────────┐
           │      Loan        │ ─────────────────▶ │      Fine       │
           ├───────────────┤    generates      ├───────────────┤
           │ - due_date      │                    │ - amount        │
           │ - returned_date │                    │ - is_paid       │
           └───────△───────┘                    └───────────────┘
                   │  0..1
                   │
                   │  1
           ┌───────┴───────┐   *        1   ┌───────────────┐
           │    BookCopy     │ ◆────────────────▶ │   BookTitle     │
           ├───────────────┤  belongs to      ├───────────────┤
           │ - copy_id       │                    │ - isbn          │
           │ - is_available  │                    │ - title, author │
           └───────────────┘                    └───────────────┘
```

### Step 6: Responsibilities (selected)

| Class | Responsibilities |
|---|---|
| `Member` | `borrow(copy)`, `return_copy(copy)` — initiates loan actions |
| `BookCopy` | `mark_checked_out()`, `mark_available()` — owns its own availability state |
| `Loan` | `is_overdue()`, `calculate_fine()` — owns the data (dates) needed to compute this |
| `Library` | `search_by_title()`, `find_available_copy()` — coordinates across the whole catalog |

```python
from datetime import date, timedelta


class BookTitle:
    def __init__(self, isbn: str, title: str, author: str):
        self.isbn = isbn
        self.title = title
        self.author = author
        self.copies: list["BookCopy"] = []      # composition: title owns its copies

    def add_copy(self, copy: "BookCopy") -> None:
        self.copies.append(copy)

    def find_available_copy(self) -> "BookCopy | None":
        return next((c for c in self.copies if c.is_available), None)


class BookCopy:
    def __init__(self, copy_id: str):
        self.copy_id = copy_id
        self.is_available = True

    def mark_checked_out(self) -> None:
        self.is_available = False

    def mark_available(self) -> None:
        self.is_available = True


class Fine:
    def __init__(self, amount: float):
        self.amount = amount
        self.is_paid = False


class Loan:
    def __init__(self, copy: BookCopy, due_date: date):
        self.copy = copy
        self.due_date = due_date
        self.returned_date: date | None = None

    def is_overdue(self) -> bool:
        end = self.returned_date or date.today()
        return end > self.due_date

    def calculate_fine(self) -> Fine | None:
        if not self.is_overdue():
            return None
        days_late = ((self.returned_date or date.today()) - self.due_date).days
        return Fine(amount=days_late * 0.50)


class Member:
    def __init__(self, name: str, member_id: str):
        self.name = name
        self.member_id = member_id
        self.loans: list[Loan] = []

    def borrow(self, title: BookTitle) -> Loan:
        copy = title.find_available_copy()
        if copy is None:
            raise ValueError(f"No available copy of {title.title}")
        copy.mark_checked_out()
        loan = Loan(copy, due_date=date.today() + timedelta(days=14))
        self.loans.append(loan)
        return loan

    def return_copy(self, loan: Loan) -> Fine | None:
        loan.returned_date = date.today()
        loan.copy.mark_available()
        return loan.calculate_fine()
```

---

## 5. Worked Example 3 — Design an Elevator

### Step 1-2: Scope and use cases
Scope: single elevator car (not a bank of elevators), serving requests from inside the car and from floor call buttons; enforce weight limits; basic scheduling. Use cases:
- A person on a floor presses UP or DOWN — the elevator should come.
- A person inside the elevator presses a floor button.
- The elevator door opens/closes at each stop.
- The system rejects a request if the car exceeds weight capacity.

### Step 3-4: Noun extraction and filtering

| Noun | Class / attribute / drop | Reasoning |
|---|---|---|
| Elevator (car) | Class | Has identity, own state (current floor, direction, doors) |
| Floor | Class | Has identity (floor number), and owns the up/down call buttons for that floor |
| Button (call button, floor button) | Class | Has its own pressed/unpressed state and identity — enough behavior to warrant a class |
| Door | Class | Own open/closed state, own open()/close() behavior |
| Request | Class | Represents a pending stop (source floor + direction, or destination floor) — needed by the scheduler |
| Scheduler / Controller | Class | Coordinates: decides which request to serve next — this is the "brain" |
| Direction (UP/DOWN/IDLE) | Attribute (enum) | Just a state value on Elevator, not its own class |
| weight_limit | Attribute | Simple value on Elevator |

### Step 5: Relationships

```
Building    1 ──── *  Floor          (a building has many floors)          → Composition
Floor       1 ──── 2  Button          (each floor has an up and down button) → Composition
Elevator    1 ──── 1  Door            (an elevator has exactly one door)      → Composition
Controller  1 ──── 1  Elevator        (controller drives one elevator car)   → Association
Controller  1 ──── *  Request         (controller manages a queue of requests)→ Aggregation
Button      ────▷  triggers Request creation (not a stored reference; behavioral)
```

### ASCII Class Diagram

```
┌───────────────┐  1        *  ┌───────────────┐  1        2  ┌───────────────┐
│    Building      │ ◆──────────────▶ │      Floor      │ ◆──────────────▶ │     Button      │
└───────────────┘   has          ├───────────────┤   has          ├───────────────┤
                                │ - number         │                │ - direction     │
                                └───────────────┘                │ + press()        │
                                                                    └───────────────┘

┌───────────────┐  1        1  ┌───────────────┐  1        1  ┌───────────────┐
│   Controller    │ ───────────────▶ │    Elevator     │ ◆──────────────▶ │      Door       │
├───────────────┤   drives      ├───────────────┤   has          ├───────────────┤
│ - requests      │                │ - current_floor  │                │ - is_open        │
├───────────────┤                │ - direction      │                ├───────────────┤
│ + add_request() │                │ - weight_limit   │                │ + open()          │
│ + step()        │                ├───────────────┤                │ + close()         │
└───────────────┘  ◇──── *      │ + move_to()      │                └───────────────┘
                       manages   │ + is_overweight()│
                    ┌───────┴───────┐  └───────────────┘
                    │    Request      │
                    ├───────────────┤
                    │ - floor          │
                    │ - direction     │
                    └───────────────┘
```

### Step 6: Responsibilities (selected)

| Class | Responsibilities |
|---|---|
| `Button` | `press()` — knows only that it was pressed and what direction/floor it represents |
| `Elevator` | `move_to(floor)`, `is_overweight()` — owns physical state (position, load) |
| `Door` | `open()`, `close()` — owns its own open/closed state |
| `Controller` | `add_request()`, `step()` (decide next stop) — the only class that needs visibility across all pending requests to make a scheduling decision (Information Expert) |

```python
from dataclasses import dataclass
from enum import Enum, auto


class Direction(Enum):
    UP = auto()
    DOWN = auto()
    IDLE = auto()


class Door:
    def __init__(self):
        self.is_open = False

    def open(self) -> None:
        self.is_open = True

    def close(self) -> None:
        self.is_open = False


@dataclass
class Request:
    floor: int
    direction: Direction


class Button:
    def __init__(self, floor: int, direction: Direction):
        self.floor = floor
        self.direction = direction

    def press(self, controller: "Controller") -> None:
        controller.add_request(Request(self.floor, self.direction))


class Elevator:
    def __init__(self, weight_limit_kg: int):
        self.current_floor = 0
        self.direction = Direction.IDLE
        self.weight_limit_kg = weight_limit_kg
        self.current_load_kg = 0
        self.door = Door()                       # composition: Elevator owns its Door

    def is_overweight(self, additional_kg: int) -> bool:
        return self.current_load_kg + additional_kg > self.weight_limit_kg

    def move_to(self, floor: int) -> None:
        self.direction = Direction.UP if floor > self.current_floor else Direction.DOWN
        self.current_floor = floor
        self.door.open()
        self.door.close()
        self.direction = Direction.IDLE


class Controller:
    def __init__(self, elevator: Elevator):
        self.elevator = elevator                 # association: drives an externally-created elevator
        self.requests: list[Request] = []         # aggregation: holds requests created by Buttons

    def add_request(self, request: Request) -> None:
        self.requests.append(request)

    def step(self) -> None:
        if not self.requests:
            return
        next_request = self.requests.pop(0)       # simplest scheduling: FIFO
        self.elevator.move_to(next_request.floor)
```

---

## 6. How to Think Out Loud in the Interview

Interviewers are grading your *process*, not just your final diagram. Narrate it:

1. "Let me restate the problem and confirm scope first — are we handling X, Y, Z?"
2. "I'll list a few core use cases before jumping to classes, so I don't miss an entity."
3. "Going through these use cases, the nouns I see are... let me decide which are classes vs. attributes."
4. "For each pair of classes, I want to nail down the relationship — is this ownership (composition), a loose reference (aggregation), or just an interaction (association)?"
5. "Now, who's responsible for each behavior? I want to put each method on the class that already holds the data it needs — that's the Information Expert principle."
6. "Let me sketch this as a quick diagram so we're both looking at the same model before I write code."

This sequence — scope, use cases, nouns, filter, relationships, responsibilities, diagram — is the same seven-step pipeline every time, regardless of the prompt.

---

## 7. Common Mistakes

- **Jumping straight to code** without stating classes/relationships out loud first — interviewers can't follow your reasoning.
- **Turning every noun into a class**, including things that are clearly simple attributes (e.g., making `Address` a class with its own file when a plain string or a small dataclass would do, unless the domain genuinely needs `Address` to have independent behavior).
- **Putting responsibilities on the wrong class** — e.g., having `Library` compute a fine directly instead of delegating to `Loan`, which actually owns the dates needed for that calculation (violates Information Expert / creates a God Object).
- **Ignoring multiplicity** — not stating whether a relationship is `1..1`, `0..1`, or `1..*` leads to ambiguous, hard-to-implement designs (e.g., can a `BookCopy` have zero or multiple active loans at once?).
- **Forgetting to revisit scope** when the interviewer adds a follow-up requirement mid-interview (e.g., "now add support for reservations") — go back through steps 3-6 for just the new use case rather than restarting from scratch.

---

## 8. Hands-On Exercises

**Exercise 1:** Apply the 7-step technique to "Design a Parking Lot." Produce a noun table, relationships, an ASCII class diagram, and a responsibilities table. (Hint: consider `ParkingLot`, `ParkingSpot`, `Vehicle`, `Ticket`, `PaymentProcessor`.)

**Exercise 2:** Apply the technique to "Design a Vending Machine." Pay special attention to the class that owns the state machine (idle, selecting, dispensing) — that's a responsibility-assignment decision, not just a noun-extraction one.

**Exercise 3:** Take the WhatsApp example above and extend it for a new requirement: "users can react to messages with emoji." Walk through which existing class this new noun (`Reaction`) attaches to, and whether it's composition or aggregation relative to `Message`.

**Exercise 4:** For the Elevator example, a new requirement arrives: "support a bank of 4 elevators serving the same floors, and route each request to the best elevator." Identify what new class needs to be introduced (a dispatcher/manager) and how `Controller`'s responsibilities change.

---

## 9. Interview Q&A

**Q: How do you approach a completely open-ended prompt like "Design a Chess Game" in the first two minutes?**
Answer: Start by restating scope and asking clarifying questions (do we need full rule validation including check/checkmate, or just piece movement?). Then list 4-5 core use cases (a player moves a piece, the board detects check, a player captures a piece). Extract nouns from those use cases (`Board`, `Piece`, `Player`, `Move`, `Square`) and classify each as a class or attribute. This gives you a concrete starting point within the first couple of minutes instead of freezing on the vagueness of the prompt.

**Q: How do you decide whether a noun becomes its own class or just an attribute of another class?**
Answer: Ask whether the noun has independent identity and lifecycle — can it be created, modified, or queried on its own, and does it carry enough state/behavior to be worth a class? If it's just a scalar value describing another object (a date, a name, an enum), make it an attribute. For example, in the Library system, `Fine` became a class because it has its own state (amount, paid/unpaid) and identity across time, while `isbn` stayed a plain attribute of `BookTitle` because it's just a string with no independent behavior.

**Q: What is the "Information Expert" principle and how does it help you assign responsibilities?**
Answer: Information Expert says a responsibility (method) should be assigned to the class that already holds the data required to fulfill it, rather than to whichever class happens to be "in charge." For example, in the Library system, `calculate_fine()` belongs on `Loan` because `Loan` holds `due_date` and `returned_date` — the exact data needed for that computation — rather than on `Library`, which would otherwise need to reach into `Loan`'s internals and become a bloated "God Object."

**Q: In the WhatsApp example, why is `Group` modeled as inheriting from `Chat` instead of `Chat` having a `type` field ("1:1" vs "group")?**
Answer: Inheritance is preferred here because `Group` has genuinely different behavior and data — member management (`add_member`, `remove_member`, an `admin`) that a 1:1 `Chat` doesn't need. If you used a single `Chat` class with a `type` field, you'd end up with conditional logic (`if type == "group": ...`) scattered through methods, which is exactly the code smell inheritance (or, in a more advanced design, the Strategy pattern) is meant to eliminate. If the differences were trivial (just a label), a flag on one class would be simpler — the decision depends on how much *behavior*, not just data, differs.

**Q: How do you handle it when the interviewer adds a new requirement mid-design, like "now also support message reactions" in the WhatsApp example?**
Answer: Don't restart the whole process — re-run steps 3 through 6 scoped to just the new use case. Extract the new noun (`Reaction`: emoji + user who reacted), decide it's a class (it has identity — which user reacted with which emoji, and possibly a timestamp), determine the relationship to `Message` (aggregation is reasonable here — reactions are tied to a message but you might query/aggregate them independently), assign responsibility (`Message.add_reaction()` since `Message` owns the collection), and update just that part of the diagram. This incremental re-application is exactly what interviewers want to see — it shows your model is extensible, not brittle.

**Q: Why is listing use cases before extracting nouns important, rather than extracting nouns directly from the prompt title?**
Answer: A short prompt like "Design an Elevator" doesn't contain enough nouns on its own — most of the real entities (`Request`, `Button`, `Door`, `Controller`) only surface once you describe *how the system is actually used* (a person presses a button, the controller decides which floor to serve next). Use cases force you to narrate behavior, and behavior is where hidden nouns and — critically — hidden responsibilities live. Skipping straight from the title to a class list tends to produce a shallow model missing the coordinating/controller classes that interviewers specifically look for.
