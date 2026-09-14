# WhatsApp Design — Complete Guide

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Class Diagram](#7-class-diagram)
8. [Python Implementation](#8-python-implementation)
9. [Key Decisions](#9-key-decisions)
10. [Step 7: Extensibility](#10-step-7-extensibility)
11. [Interview Follow-ups](#11-interview-follow-ups)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements

- Users can send 1:1 messages to another user.
- Users can create groups and send messages to all group members.
- Messages can be **text** or **media** (image, video, document, audio).
- Every message has a **delivery status**: `SENT → DELIVERED → READ`, tracked per-recipient in a group.
- Users can see their list of chats (1:1 and group) ordered by most recent activity.
- Group admins can add/remove members.

### Non-Functional Requirements (state these out loud)

- Status updates should propagate to the sender in near real-time without the sender polling.
- The design should not need a different code path for 1:1 vs. group chat — assume this from the start (it's the trickiest part of this problem).
- We are **not** designing the network transport (WebSocket/XMPP) or persistence layer — that's a separate systems-design question. We're modeling the domain objects and their interactions in-process.
- Out of scope for this lesson: end-to-end encryption, message search, offline sync — call these out as "future extensions" if the interviewer doesn't ask.

### Assumptions to state

- A message belongs to exactly one `Chat` (1:1 or group) — never both.
- Delivery status is tracked per-recipient, not per-chat, because in a group of 5 the message can be delivered to 3 and read by 1 simultaneously.

---

## 2. Step 2: Identify Entities/Classes

| Class | Kind | Responsibility |
|---|---|---|
| `User` | Core entity | Identity (id, name, phone number) |
| `Message` | Core entity | Content, sender, timestamp, per-recipient status |
| `Media` | Core entity | File reference + type, attached to a `Message` |
| `Chat` | Abstract base | Common behavior for any conversation (send, add message, list participants) |
| `OneToOneChat` | Concrete `Chat` | Exactly 2 participants |
| `Group` (`GroupChat`) | Concrete `Chat` | N participants, admin list, group metadata |
| `MessageStatus` | Value/Enum | `SENT`, `DELIVERED`, `READ` |
| `StatusObserver` | Interface | Notified when a message's status changes |
| `ChatService` | Orchestrator | Creates chats, routes messages, looks up a user's chat list |

---

## 3. Step 3: Define Relationships

```
User            "participates in"        Chat        1 -------- N
Chat (abstract) "specialized by"         OneToOneChat, Group     (inheritance)
Chat            "contains"               Message     1 -------- N   (composition)
Message         "carries"                Media       1 -------- 0..1 (composition)
Message         "tracks status for"      User        N -------- N   (via a status map)
Message         "notifies"               StatusObserver           (Observer pattern)
ChatService     "manages"                Chat, User               (aggregation)
```

- `Chat` **owns** its `Message`s (composition) — delete the chat, the messages go with it.
- A `Message` does **not** own its `User`s — it only references sender/recipient ids (association).
- `OneToOneChat` and `Group` both **inherit** from `Chat` — this is the key modeling decision (see Key Decisions below).

---

## 4. Step 4: Assign Responsibilities

- **`Chat`** — owns the message list and the participant list; exposes `send_message()` and `add_message()`; does **not** know about UI, storage, or network.
- **`Message`** — owns its own content and per-recipient status map; exposes `mark_delivered(user)` / `mark_read(user)`; notifies observers on status change. It does **not** decide *who* it's delivered to — that's `Chat`'s job at creation time.
- **`Group`** — adds admin-only operations (`add_member`, `remove_member`) on top of base `Chat` behavior.
- **`ChatService`** — the only class that knows how to *find or create* a chat between users, and how to route an outgoing message to the correct `Chat`. Keeps `User` and `Chat` decoupled from lookup/creation logic.
- **`StatusObserver` implementations** (e.g., `SenderNotifier`, `PushNotificationService`) — react to status changes; `Message` does not know or care what they do with the update.

---

## 5. Step 5: Apply SOLID

| Principle | Application |
|---|---|
| **SRP** | `Message` handles content + status only; `Chat` handles membership + ordering; `ChatService` handles lookup/routing. No class does all three. |
| **OCP** | Adding a new chat type (e.g., `BroadcastList`) means subclassing `Chat` — no existing class is modified. Adding a new observer (e.g., analytics logging) means implementing `StatusObserver` — `Message` is untouched. |
| **LSP** | Anywhere a `Chat` is expected, `OneToOneChat` or `Group` can be substituted — both honor `send_message()` and `get_participants()` with the same contract. `OneToOneChat` simply enforces `len(participants) == 2` at construction. |
| **ISP** | `StatusObserver` exposes one narrow method (`on_status_changed`) — observers aren't forced to implement unrelated chat/message logic. |
| **DIP** | `Message` depends on the `StatusObserver` abstraction, not on concrete notifier classes. `ChatService` depends on the abstract `Chat` interface, not on `OneToOneChat`/`Group` directly. |

---

## 6. Step 6: Apply Design Patterns

### Observer Pattern — Delivery Status Propagation

**Problem it solves:** when a message's status changes (delivered/read), multiple parties may need to know — the sender's UI, a push-notification service, an analytics logger. We don't want `Message` to hard-code calls to each of them.

**Solution:** `Message` maintains a list of `StatusObserver`s and calls `notify()` whenever `mark_delivered()`/`mark_read()` is invoked. Observers subscribe without `Message` knowing their concrete type.

This is exactly the same pattern used for stock-price tickers or event buses — one subject, many independently-varying subscribers.

---

## 7. Class Diagram

```
                     ┌───────────────────────┐
                     │   StatusObserver       │  (interface)
                     │───────────────────────│
                     │ +on_status_changed()   │
                     └───────────▲────────────┘
                                 │ implements
                 ┌───────────────┴───────────────┐
        ┌────────────────┐              ┌──────────────────────┐
        │ SenderNotifier  │              │ PushNotificationSvc  │
        └─────────────────┘              └───────────────────────┘

┌────────────────┐        1        N ┌───────────────────────────┐
│      User       │◀───participates──▶│           Chat (ABC)      │
│─────────────────│                   │───────────────────────────│
│ -user_id         │                  │ #chat_id                  │
│ -name            │                  │ #participants: List[User] │
│ -phone           │                  │ #messages: List[Message]  │
└─────────────────┘                   │ +send_message(sender,text)│
                                       │ +get_participants()       │
                                       └─────────────▲──────────────┘
                                                      │ inherits
                              ┌───────────────────────┴───────────────────────┐
                    ┌───────────────────┐                          ┌───────────────────┐
                    │  OneToOneChat      │                          │       Group        │
                    │────────────────────│                          │────────────────────│
                    │ (enforces len==2)  │                          │ -admins: List[User]│
                    │                    │                          │ -group_name        │
                    │                    │                          │ +add_member()      │
                    │                    │                          │ +remove_member()   │
                    └────────────────────┘                          └────────────────────┘

┌───────────────────────────────────────────┐
│                  Message                   │
│─────────────────────────────────────────── │
│ -message_id                                │
│ -sender: User                              │
│ -content: str                              │
│ -media: Optional[Media]                    │
│ -status_map: Dict[User, MessageStatus]     │
│ -observers: List[StatusObserver]           │
│─────────────────────────────────────────── │
│ +mark_delivered(user)                      │
│ +mark_read(user)                           │
│ +attach_observer(obs)                      │
│ -_notify(user, status)                     │
└─────────────────┬───────────────────────────┘
                   │ 0..1 composition
                   ▼
           ┌───────────────┐
           │     Media      │
           │───────────────│
           │ -url           │
           │ -media_type    │
           └───────────────┘

┌───────────────────────┐
│      ChatService        │
│──────────────────────── │
│ -chats: Dict[...,Chat]  │
│──────────────────────── │
│ +get_or_create_1to1()   │
│ +create_group()         │
│ +send_message()         │
└──────────────────────────┘
```

---

## 8. Python Implementation

```python
from abc import ABC, abstractmethod
from enum import Enum, auto
from datetime import datetime
from typing import Dict, List, Optional
import uuid


class MessageStatus(Enum):
    SENT = auto()
    DELIVERED = auto()
    READ = auto()


class User:
    def __init__(self, name: str, phone: str):
        self.user_id = str(uuid.uuid4())
        self.name = name
        self.phone = phone

    def __hash__(self):
        return hash(self.user_id)

    def __eq__(self, other):
        return isinstance(other, User) and self.user_id == other.user_id

    def __repr__(self):
        return f"User({self.name})"


class Media:
    def __init__(self, url: str, media_type: str):
        self.url = url
        self.media_type = media_type  # "image" | "video" | "document" | "audio"


# ---- Observer pattern ----
class StatusObserver(ABC):
    @abstractmethod
    def on_status_changed(self, message: "Message", user: User, status: MessageStatus) -> None:
        ...


class SenderNotifier(StatusObserver):
    """Notifies the sender's UI/session that status changed (e.g., blue ticks)."""
    def on_status_changed(self, message: "Message", user: User, status: MessageStatus) -> None:
        print(f"[UI] {message.sender.name}'s message {message.message_id[:6]} "
              f"is now {status.name} for {user.name}")


class PushNotificationService(StatusObserver):
    def on_status_changed(self, message: "Message", user: User, status: MessageStatus) -> None:
        if status == MessageStatus.DELIVERED:
            print(f"[PUSH] Delivered receipt sent to {message.sender.name}")


class Message:
    def __init__(self, sender: User, recipients: List[User],
                 content: str, media: Optional[Media] = None):
        self.message_id = str(uuid.uuid4())
        self.sender = sender
        self.content = content
        self.media = media
        self.timestamp = datetime.utcnow()
        # per-recipient status — critical for group chats
        self.status_map: Dict[User, MessageStatus] = {r: MessageStatus.SENT for r in recipients}
        self._observers: List[StatusObserver] = []

    def attach_observer(self, observer: StatusObserver) -> None:
        self._observers.append(observer)

    def mark_delivered(self, user: User) -> None:
        self._update_status(user, MessageStatus.DELIVERED)

    def mark_read(self, user: User) -> None:
        self._update_status(user, MessageStatus.READ)

    def _update_status(self, user: User, status: MessageStatus) -> None:
        if user not in self.status_map:
            return
        # never downgrade READ -> DELIVERED etc.
        if self.status_map[user].value >= status.value:
            return
        self.status_map[user] = status
        for obs in self._observers:
            obs.on_status_changed(self, user, status)

    def overall_status(self) -> MessageStatus:
        """For a group: the status shown to the sender is the MIN across recipients."""
        return min(self.status_map.values(), key=lambda s: s.value)


class Chat(ABC):
    def __init__(self, participants: List[User]):
        self.chat_id = str(uuid.uuid4())
        self.participants: List[User] = participants
        self.messages: List[Message] = []

    def get_participants(self) -> List[User]:
        return list(self.participants)

    def send_message(self, sender: User, content: str,
                      media: Optional[Media] = None) -> Message:
        recipients = [u for u in self.participants if u != sender]
        message = Message(sender, recipients, content, media)
        self._attach_default_observers(message)
        self.messages.append(message)
        return message

    def _attach_default_observers(self, message: Message) -> None:
        message.attach_observer(SenderNotifier())
        message.attach_observer(PushNotificationService())

    def last_activity(self) -> datetime:
        return self.messages[-1].timestamp if self.messages else datetime.min


class OneToOneChat(Chat):
    def __init__(self, user_a: User, user_b: User):
        super().__init__([user_a, user_b])


class Group(Chat):
    def __init__(self, name: str, creator: User, members: List[User]):
        super().__init__(members + [creator] if creator not in members else members)
        self.group_name = name
        self.admins: List[User] = [creator]

    def add_member(self, admin: User, new_member: User) -> None:
        if admin not in self.admins:
            raise PermissionError("Only admins can add members")
        if new_member not in self.participants:
            self.participants.append(new_member)

    def remove_member(self, admin: User, member: User) -> None:
        if admin not in self.admins:
            raise PermissionError("Only admins can remove members")
        self.participants.remove(member)


class ChatService:
    """Single point of lookup/creation — decouples User from Chat internals."""
    def __init__(self):
        self._one_to_one: Dict[frozenset, OneToOneChat] = {}
        self._groups: List[Group] = []

    def get_or_create_1to1(self, a: User, b: User) -> OneToOneChat:
        key = frozenset([a.user_id, b.user_id])
        if key not in self._one_to_one:
            self._one_to_one[key] = OneToOneChat(a, b)
        return self._one_to_one[key]

    def create_group(self, name: str, creator: User, members: List[User]) -> Group:
        group = Group(name, creator, members)
        self._groups.append(group)
        return group

    def chats_for(self, user: User) -> List[Chat]:
        chats: List[Chat] = [c for c in self._one_to_one.values() if user in c.participants]
        chats += [g for g in self._groups if user in g.participants]
        return sorted(chats, key=lambda c: c.last_activity(), reverse=True)
```

---

## 9. Key Decisions

**How to model 1:1 chat vs. group chat uniformly.** The single trickiest design choice in this problem. Two options were on the table:

1. Two unrelated classes (`DirectMessage` and `GroupChat`) each with their own `send()` logic. Rejected — every consumer (`ChatService`, UI code, notification code) would need `if/else` branches to tell them apart, violating OCP the moment a `BroadcastList` or `Channel` type is added.
2. **A single `Chat` abstract base with `OneToOneChat` and `Group` subclasses**, both sharing `send_message()`, `get_participants()`, and message storage. `OneToOneChat` is simply a `Chat` with a hard constraint of exactly 2 participants; `Group` adds admin-only mutation methods. **This was chosen** — it lets `ChatService.chats_for()` treat every chat polymorphically and lets the message/status/observer machinery be written once.

**Per-recipient status instead of per-message status.** A naive design puts one `status` field directly on `Message`. That breaks the moment a message is in a 5-person group where 3 people have read it and 2 haven't. The `status_map: Dict[User, MessageStatus]` keeps per-recipient truth, and `overall_status()` derives the sender-facing summary (single-tick/double-tick/blue-tick) as the minimum status across recipients — matching WhatsApp's real UI behavior.

**Status can only move forward.** `_update_status` guards against downgrading `READ` back to `DELIVERED` (e.g., a duplicate delivery receipt arriving late over an unreliable network) — a small but interview-relevant edge case.

**Observers are attached per-message, not globally.** This keeps `Message` in control of exactly who is notified of its own lifecycle, and makes it trivial to attach message-specific observers later (e.g., a scheduled/disappearing-message observer) without touching `Chat`.

---

## 10. Step 7: Extensibility

- **Disappearing messages:** add a `TimerObserver` that, when attached to a `Message`, deletes it from `Chat.messages` after N hours. No change needed to `Message`, `Chat`, or `ChatService` — pure OCP.
- **Broadcast lists** (one-to-many, but replies go back 1:1, not to the group): add `BroadcastList(Chat)` that overrides `send_message()` to fan out N independent `Message` objects instead of one shared one. Existing `OneToOneChat`/`Group` code is untouched.
- **Read receipts toggle (privacy setting):** wrap `mark_read()` behind a check on the recipient's privacy preference — a small addition to `Message`, no ripple into `Chat` or `ChatService`.
- **Message editing/deletion:** add `edited_at` / `is_deleted` fields to `Message` and a new `on_message_edited` observer hook — existing status-tracking logic is unaffected because it's a separate concern.

---

## 11. Interview Follow-ups

- "How would you prevent a message from being delivered twice over an unreliable network?" — Discuss idempotency: use `message_id` + recipient as a dedup key at the transport layer before calling `mark_delivered()`.
- "How do you scale `ChatService` to millions of users?" — This in-memory design is for the domain model; in reality `chats_for(user)` would be backed by an index/database query, and `ChatService` would become a thin façade over a persistence layer.
- "How would you support message ordering across multiple servers?" — Mention vector clocks or per-chat sequence numbers assigned by a single owning shard, since wall-clock timestamps alone aren't sufficient under clock skew.
- "What happens if two admins remove the same member concurrently?" — Discuss making `remove_member` idempotent (removing an absent member is a no-op) plus locking/versioning the `Group.participants` list.

---

## 12. Interview Q&A

**Q: Why use a common `Chat` base class instead of separate classes for 1:1 and group chat?**
Answer: Because every downstream consumer — sending a message, listing chats, propagating status — needs to treat both uniformly. A shared `Chat` abstraction with `OneToOneChat` and `Group` subclasses lets `ChatService` and the messaging pipeline be written once and satisfies the Liskov Substitution Principle: anywhere a `Chat` is expected, either subtype works.

**Q: Why track message status per-recipient instead of a single status field on the message?**
Answer: In a group chat, different recipients read a message at different times — a single `status` field can't represent "delivered to 3, read by 1." A `Dict[User, MessageStatus]` captures the true per-recipient state, and the sender-facing summary (e.g., WhatsApp's blue ticks) is derived as the minimum status across all recipients.

**Q: Why is the Observer pattern a good fit for delivery-status updates?**
Answer: Multiple independent parties (sender UI, push notifications, analytics) need to react when a message's status changes, but `Message` shouldn't need to know about any of them concretely. Observer decouples the subject (`Message`) from its subscribers — new observer types can be added without modifying `Message` at all, satisfying the Open/Closed Principle.

**Q: How would you add support for message reactions (emoji replies) without breaking existing code?**
Answer: Add a `reactions: Dict[User, str]` field and an `add_reaction()` method on `Message`. Since reactions are additive state on an existing entity and don't change the `Chat`/`ChatService` contracts, this is a backward-compatible extension — no existing class needs modification.

**Q: Why does `ChatService` exist instead of letting `User` hold references to its chats directly?**
Answer: If `User` owned its chat list directly, creating a 1:1 chat would require checking both users' lists for an existing chat, and every new chat type would need bespoke lookup logic scattered across the codebase. `ChatService` centralizes chat creation/lookup in one place, keeping `User` a simple identity object (SRP) and making it trivial to add new chat types (broadcast lists, channels) later.

**Q: How would you extend this design to support "last seen" / online presence?**
Answer: Add an `online_status` field to `User` plus a `PresenceObserver` interface, notified whenever a user's connection state changes. This mirrors the `StatusObserver` pattern already used for message delivery — same pattern, different subject — showing the design's consistency pays off when extending it.
