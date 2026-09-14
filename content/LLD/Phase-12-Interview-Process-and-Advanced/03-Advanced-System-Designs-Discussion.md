# Advanced System Designs — Discussion-Level Treatment

## Table of Contents
1. [Why These Are Discussions, Not Takehomes](#1-why-these-are-discussions-not-takehomes)
2. [Google Docs — Concurrent Editing](#2-google-docs--concurrent-editing)
3. [Netflix / YouTube — Video Platform](#3-netflix--youtube--video-platform)
4. [Jira — Issue Tracking and Workflows](#4-jira--issue-tracking-and-workflows)
5. [GitHub — Repository and Collaboration Model](#5-github--repository-and-collaboration-model)
6. [Slack / Discord — Real-Time Messaging](#6-slack--discord--real-time-messaging)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why These Are Discussions, Not Takehomes

Every prompt in this lesson is a **real product**, not a toy problem — Google Docs, Netflix, Jira, GitHub, and Slack each represent years of engineering effort by hundreds of engineers. In a 45-minute interview, nobody expects you to produce compiling code for any of these end-to-end, and trying to do so is actually a mistake: you'll either write a shallow skeleton that ignores the interesting parts, or you'll run out of time modeling one corner of the system in depth while ignoring the rest.

**What the interviewer is actually evaluating at this level:**

| Evaluated dimension | What it looks like in your answer |
|----------------------|--------------------------------------|
| **Breadth of thinking** | You can enumerate the major subsystems/entities without being led there one at a time |
| **Trade-off articulation** | You can compare 2+ approaches to a hard sub-problem (e.g., OT vs CRDT) and state pros/cons, not just name-drop one |
| **Prioritization under time pressure** | When told "you have 10 minutes, pick the hardest part to design," you pick something genuinely load-bearing, not a peripheral feature |
| **Knowing what NOT to design** | You explicitly scope out things like exact database schema, network protocol bytes, or UI — and say so, rather than silently ignoring them |

The expected format is **verbal + whiteboard**: a rough entity diagram, a couple of key classes/interfaces sketched (not fully implemented), and spoken trade-off discussion. If asked to write *some* code, it's usually for one narrow slice (e.g., "just sketch the state machine transitions for a Jira issue"), not the whole system.

For each system below: a framing of what a 45-minute conversation actually covers, the key entities, 1-2 genuinely hard design decisions worth discussing, and why full code isn't the point.

---

## 2. Google Docs — Concurrent Editing

### What You'd Actually Cover in 45 Minutes

The realistic scope is: the document/version data model, and a discussion of *how* concurrent edits from multiple users get merged without conflicts. You would **not** be expected to implement an actual OT or CRDT algorithm from scratch — that's a multi-week research-grade problem even for experienced engineers. You're expected to know it exists, roughly how it works, and why naive locking doesn't scale to real-time collaborative editing.

### Key Entities

```
Document
 ├── DocumentVersion (or a stream of Operations applied to a base state)
 ├── Operation (insert/delete/format, at a position, by a user, with a timestamp/vector clock)
 ├── Collaborator (user + cursor position + current selection)
 └── Session (a user's live connection to a document)
```

### Key Design Decisions

**1. How do you resolve two users editing the same region simultaneously?**

Two competing high-level approaches, and the trade-off between them is the actual discussion:

| Approach | Idea | Trade-off |
|----------|------|-----------|
| **Operational Transform (OT)** | Each edit is an operation (e.g., `insert("hello", pos=5)`). When two operations arrive out of order, the server *transforms* one operation against the other so both clients converge to the same final text, adjusting positions to account for the other edit. | Requires a central server to serialize and transform operations correctly; the transform functions are notoriously tricky to get right for all operation-pair combinations (this is what Google Docs originally used, and what Google Wave's public failure taught the industry). |
| **CRDT (Conflict-free Replicated Data Type)** | Each character/element gets a globally unique, order-preserving identifier (not just an array index). Edits are commutative — applying them in any order converges to the same state — so no central transform step is needed. | Works well peer-to-peer / offline-first (no central authority needed to resolve order), but has memory/performance overhead from tombstones and unique IDs per character, and is a newer, less battle-tested approach for very large documents. |

**2. How do you represent document state for versioning/undo?**

Model the document not as a single mutable blob, but as a base snapshot plus an append-only log of operations — this gives you undo/redo (replay up to operation N), version history (any earlier operation index is a valid historical state), and is exactly the substrate OT/CRDT operate on. This is the one piece worth sketching as a lightweight class:

```python
class Operation:
    def __init__(self, op_type: str, position: int, content: str, user_id: str, timestamp: float):
        self.op_type = op_type      # "insert" | "delete" | "format"
        self.position = position
        self.content = content
        self.user_id = user_id
        self.timestamp = timestamp


class Document:
    def __init__(self, doc_id: str):
        self.doc_id = doc_id
        self.operations: list[Operation] = []   # append-only log

    def apply(self, op: Operation) -> None:
        # In a real system: transform `op` against any concurrent ops
        # received out of order (OT), or merge via CRDT ordering rules,
        # before appending. Full transform logic is out of scope here.
        self.operations.append(op)
```

### Why Full Code Isn't the Point

Implementing a correct OT transform function or a CRDT sequence type is itself a well-known hard, multi-week problem with subtle edge cases (this is genuinely what teams of engineers at Google/Figma/Notion have shipped papers about). In an interview, correctly explaining *why* naive last-write-wins or full-document locking fails at scale, and being able to compare OT vs CRDT trade-offs, demonstrates the relevant knowledge far better than a half-correct code attempt would.

---

## 3. Netflix / YouTube — Video Platform

### What You'd Actually Cover in 45 Minutes

Realistic scope: the content catalog model (videos, metadata, categorization), a watch-history/resume-playback model, a pluggable recommendation "hook" (not the recommendation algorithm itself), and adaptive streaming quality selection as a Strategy. Encoding pipelines, CDN edge caching, and the actual ML recommendation model are explicitly out of scope — say so.

### Key Entities

```
Video
 ├── VideoMetadata (title, description, genres, cast, duration)
 ├── VideoRendition (same video, multiple resolutions/bitrates — 480p/720p/1080p/4K)
User
 ├── WatchHistory (video, timestamp, position, completed)
 └── Profile (per-user preferences within one account, like Netflix's multi-profile)
RecommendationEngine (interface — pluggable, not implemented)
StreamingQualityStrategy (interface — chooses rendition based on network conditions)
```

### Key Design Decisions

**1. Adaptive streaming quality as a Strategy.**

The player continuously measures available bandwidth and picks the best `VideoRendition` to fetch next — this is a clean, concrete Strategy pattern to sketch:

```python
from abc import ABC, abstractmethod


class VideoRendition:
    def __init__(self, resolution: str, bitrate_kbps: int, url: str):
        self.resolution = resolution
        self.bitrate_kbps = bitrate_kbps
        self.url = url


class StreamingQualityStrategy(ABC):
    @abstractmethod
    def select_rendition(self, renditions: list[VideoRendition], available_bandwidth_kbps: int) -> VideoRendition:
        ...


class HighestQualityUnderBandwidth(StreamingQualityStrategy):
    def select_rendition(self, renditions, available_bandwidth_kbps):
        eligible = [r for r in renditions if r.bitrate_kbps <= available_bandwidth_kbps]
        return max(eligible, key=lambda r: r.bitrate_kbps) if eligible else min(renditions, key=lambda r: r.bitrate_kbps)
```

Swapping this strategy (e.g., "prefer stability over quality" for mobile data) requires zero changes to the player class — the exact justification for why Strategy fits.

**2. Recommendations as a pluggable hook, not a bespoke algorithm.**

The LLD-relevant insight isn't the ML model — it's that the *catalog/user-history service* should expose a stable interface (`get_recommendations(user_id) -> list[Video]`) that a recommendation subsystem implements, so the underlying algorithm (collaborative filtering, content-based, hybrid) can be swapped or A/B tested without touching the catalog or playback code. This is Dependency Inversion applied at a system-design scale.

### Why Full Code Isn't the Point

Video encoding/transcoding pipelines, CDN cache invalidation, and recommendation ML models are each their own specialized engineering domains (video engineering, distributed caching, and ML respectively) that no LLD interview expects you to implement — the interview is testing whether you can model the *domain objects and integration seams* (like the two strategies above) correctly, not whether you can write a bitrate-adaptation algorithm from research literature.

---

## 4. Jira — Issue Tracking and Workflows

### What You'd Actually Cover in 45 Minutes

This is the most "LLD-native" of the five — it's realistic to sketch a genuine class model and a full state machine for issue status transitions in 45 minutes, because the core complexity (workflow state transitions) is bounded and well-suited to code, unlike the others in this lesson.

### Key Entities

```
Project
 ├── Board (Kanban/Scrum view over issues)
 ├── Sprint (time-boxed set of issues, Scrum only)
Issue (base) ─── Epic (groups many Issues)
             └── Story / Task / Bug (leaf issue types)
Workflow (defines valid status transitions per issue type)
Status (enum-like: TODO, IN_PROGRESS, IN_REVIEW, DONE — configurable per project)
```

### Key Design Decisions

**1. Model status transitions as an explicit state machine, not a free-form enum field.**

The naive version lets any issue jump to any status (`issue.status = Status.DONE`), which allows invalid transitions (e.g., TODO → DONE skipping review). Model it as a `Workflow` that defines a transition table, and have `Issue.transition_to()` consult it:

```python
from enum import Enum


class Status(Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class InvalidTransitionError(Exception):
    pass


class Workflow:
    def __init__(self, allowed_transitions: dict[Status, set[Status]]):
        self.allowed_transitions = allowed_transitions

    def can_transition(self, current: Status, target: Status) -> bool:
        return target in self.allowed_transitions.get(current, set())


DEFAULT_WORKFLOW = Workflow({
    Status.TODO: {Status.IN_PROGRESS},
    Status.IN_PROGRESS: {Status.IN_REVIEW, Status.TODO},
    Status.IN_REVIEW: {Status.DONE, Status.IN_PROGRESS},
    Status.DONE: set(),
})


class Issue:
    def __init__(self, title: str, workflow: Workflow = DEFAULT_WORKFLOW):
        self.title = title
        self.status = Status.TODO
        self.workflow = workflow

    def transition_to(self, target: Status) -> None:
        if not self.workflow.can_transition(self.status, target):
            raise InvalidTransitionError(f"{self.status} -> {target} not allowed")
        self.status = target
```

Different projects wanting different workflows (e.g., a project with no review step) is then just a different `Workflow` instance — no changes to `Issue`.

**2. Epic-Story-Task hierarchy: composition vs a flat parent-link.**

Rather than deep inheritance (`Epic extends Issue extends Story...`), model `Epic` as a plain `Issue` that *aggregates* child issues via a `parent_id`/`children` reference, not subclassing. Every issue type (Epic, Story, Bug, Task) is a peer implementing the same `Issue` interface, and hierarchy is a relationship (aggregation), not a type hierarchy — this avoids Liskov violations from trying to make "Epic" simultaneously a kind-of Issue and a container-of Issues in one class taxonomy.

### Why This One Is Closer to Full Code

Unlike the other four systems in this lesson, the workflow/status-transition piece of Jira is genuinely interview-sized — expect to be asked to actually write the `Workflow`/`Issue` classes above. What stays discussion-only is everything around it: permission models, notification fan-out, search/indexing, and cross-project reporting.

---

## 5. GitHub — Repository and Collaboration Model

### What You'd Actually Cover in 45 Minutes

Realistic scope: the collaboration-layer model (Repository, Branch, Commit, PullRequest, Review) and a conceptual explanation of the underlying Git object model (blobs/trees/commits) — not an actual Git implementation, which is a full version-control system in itself.

### Key Entities

```
Repository
 ├── Branch (name -> pointer to a Commit)
 ├── Commit (parent commit(s), author, message, tree snapshot)
PullRequest (source branch, target branch, status, list of Review)
Review (reviewer, verdict: APPROVE/REQUEST_CHANGES/COMMENT, list of Comment)
Comment (author, body, optionally anchored to a file+line)
```

### Key Design Decisions

**1. Git's object model, at a conceptual level (not implemented).**

Worth explaining verbally because it clarifies why branches/commits are cheap: a `Commit` doesn't store a full copy of the repo — it points to a `Tree` (a snapshot of directory structure), which points to `Blob`s (file contents, content-addressed by hash). A `Branch` is just a mutable pointer to a `Commit`. This is why creating a branch is O(1) (just a new pointer) rather than O(repo size) — a common trade-off/depth question interviewers ask ("why is a git branch cheap compared to an SVN branch?").

```
Commit C3 ──parent──▶ Commit C2 ──parent──▶ Commit C1
    │                      │                      │
    ▼                      ▼                      ▼
  Tree                   Tree                   Tree
 (snapshot)            (snapshot)             (snapshot)
    │
    ▼
  Blobs (file contents, content-addressed by SHA)

main   ──▶ C3   (branch = pointer to a commit, O(1) to create)
feature ──▶ C2
```

**2. PullRequest as an aggregation of Reviews, with a status derived, not stored redundantly.**

`PullRequest.status` (e.g., "mergeable," "changes requested") should typically be *computed* from the current set of `Review`s rather than stored as an independent field that can drift out of sync — this is a good discussion point about avoiding duplicated/derivable state:

```python
from enum import Enum


class ReviewVerdict(Enum):
    APPROVE = "approve"
    REQUEST_CHANGES = "request_changes"
    COMMENT = "comment"


class PullRequest:
    def __init__(self, source_branch: str, target_branch: str):
        self.source_branch = source_branch
        self.target_branch = target_branch
        self.reviews: list["Review"] = []

    def is_mergeable(self) -> bool:
        # Derived, not stored — avoids two sources of truth going stale.
        if not self.reviews:
            return False
        return not any(r.verdict == ReviewVerdict.REQUEST_CHANGES for r in self.reviews) and \
            any(r.verdict == ReviewVerdict.APPROVE for r in self.reviews)
```

### Why Full Code Isn't the Point

An actual Git implementation involves content-addressed storage, diffing/merging algorithms (three-way merge, conflict markers), and packfile compression — each a substantial system in its own right. The interview is testing whether you understand the object model well enough to explain *why* the collaboration layer (branches, commits, PRs) behaves the way it does, not whether you can reimplement `git merge`.

---

## 6. Slack / Discord — Real-Time Messaging

### What You'd Actually Cover in 45 Minutes

Realistic scope: the data model (Workspace/Channel/Message/Thread), presence tracking, and a conceptual explanation of real-time delivery via an Observer/pub-sub pattern — not an actual WebSocket server or message broker implementation.

### Key Entities

```
Workspace
 ├── Channel (public/private, list of members)
 │    ├── Message (author, content, timestamp, optional thread_id)
 │    └── Thread (root message + replies)
User
 └── Presence (ONLINE/AWAY/OFFLINE, last_seen)
NotificationDispatcher (Observer subject — channel members subscribe)
```

### Key Design Decisions

**1. Real-time delivery as Observer/pub-sub, discussed conceptually.**

When a `Message` is posted to a `Channel`, every currently-connected member's client needs to be notified without polling. Model this as an Observer relationship: `Channel` (subject) holds a list of subscribed `Connection`s (one per online client), and `post_message()` notifies all of them. The actual transport (WebSocket push, long-polling, or a message broker like Kafka/Redis pub-sub fanning out across multiple server instances) is an infrastructure concern layered underneath this same conceptual pattern — worth naming but not implementing.

```python
from abc import ABC, abstractmethod


class MessageObserver(ABC):
    @abstractmethod
    def on_new_message(self, message: "Message") -> None:
        ...


class Channel:
    def __init__(self, name: str):
        self.name = name
        self._observers: list[MessageObserver] = []   # e.g., one per connected client

    def subscribe(self, observer: MessageObserver) -> None:
        self._observers.append(observer)

    def post_message(self, message: "Message") -> None:
        for observer in self._observers:
            observer.on_new_message(message)   # in production: push over an
                                                 # open connection, not a direct call
```

**2. Threads as a relationship on Message, not a separate parallel data structure.**

Model a thread as: the root `Message` has a `thread_id` (its own message ID), and replies are ordinary `Message`s that reference that `thread_id`. This avoids maintaining two divergent representations of "a sequence of messages" (regular channel timeline vs. thread) — a `Thread` is really just a filtered view (`messages where thread_id == X`), which is a good example of not creating a class for something that's actually a query/derived view rather than a first-class entity (a callback to the noun-filtering technique from Lesson 1).

### Why Full Code Isn't the Point

Real-time fan-out at scale (millions of concurrent WebSocket connections, cross-datacenter message ordering, delivery guarantees/exactly-once semantics) is a distributed-systems problem, not an LLD one — it belongs in a system-design interview, not this one. The LLD-relevant contribution here is correctly identifying that the *pattern* is Observer/pub-sub and being able to sketch the subject/observer interface, while explicitly deferring the transport/scale mechanics as "that's the infra layer underneath this interface."

---

## 7. Interview Q&A

**Q: Why shouldn't you try to write full working code for something like "design Google Docs" in a 45-minute interview?**
Answer: These are real products built by hundreds of engineers over years — full code either produces a shallow skeleton that misses the actually hard parts (conflict resolution, real-time fan-out) or burns all your time on one narrow slice while leaving the rest unaddressed. The interviewer is evaluating breadth of thinking, trade-off articulation, and prioritization under time pressure — not compiling code — so a clear verbal model plus a couple of sketched classes for the hardest sub-problem outperforms an attempted full implementation.

**Q: What's the core difference between Operational Transform and CRDTs for collaborative editing, and when would you mention this trade-off?**
Answer: OT represents edits as operations that get mathematically transformed against concurrent operations so all clients converge, but requires a central server to serialize and correctly transform every operation pair, and the transform functions are famously hard to get fully correct. CRDTs assign stable, order-preserving IDs to content so edits are inherently commutative and converge regardless of arrival order, working well offline/peer-to-peer, at the cost of extra memory overhead (e.g., tombstones) per element. Mention this trade-off whenever asked to design any multi-user simultaneous-editing feature — it signals you know naive locking or last-write-wins doesn't scale to real-time collaboration.

**Q: In the Jira design, why model issue status transitions as an explicit `Workflow` transition table instead of just letting `issue.status` be freely reassigned?**
Answer: A free-form status field allows invalid jumps (e.g., TODO straight to DONE, skipping review), which doesn't reflect real business rules and is a common bug source. An explicit `Workflow` with an allowed-transitions table lets `Issue.transition_to()` validate before mutating state, and different projects can plug in different `Workflow` instances (e.g., no review step) without any change to the `Issue` class itself — this is also the one sub-problem in this lesson that's realistic to actually code live, since it's bounded and well-suited to a class-based solution.

**Q: Why is creating a Git branch essentially free (O(1)), and why is this relevant to explain even though you're not implementing Git?**
Answer: A branch is just a mutable named pointer to a commit; a commit itself doesn't store a full copy of the repository but points to a tree snapshot, which points to content-addressed blobs shared across commits wherever content hasn't changed. So creating a branch is just writing one new pointer — no data is copied. This is a favorite depth-check question ("why is a git branch cheap vs. an SVN branch") because it tests whether you understand the underlying object model conceptually, which is exactly the level of understanding expected for a GitHub-style LLD discussion.

**Q: For a Slack-like system, why model real-time message delivery as Observer/pub-sub instead of having clients poll for new messages?**
Answer: Polling wastes resources and adds latency (a message is only seen at the next poll interval), while Observer/pub-sub lets a `Channel` proactively notify all currently-subscribed connections the instant a message is posted, which is both more efficient and lower-latency. In an interview, you'd sketch the subject/observer interface (`Channel.subscribe()`, `Channel.post_message()` notifying all observers) conceptually, and explicitly note that the actual transport (WebSockets, a message broker like Kafka/Redis for fanning out across multiple servers) is an infrastructure layer underneath the same pattern, out of scope for LLD.

**Q: If an interviewer says "let's go deeper on just one part" for one of these advanced systems, how do you pick which part to go deep on?**
Answer: Pick the part that is both load-bearing (central to what makes the system hard, not a peripheral feature) and genuinely codeable in the remaining time — e.g., for Jira that's the workflow state machine, for GitHub that's the PR/Review mergeability logic, for Netflix that's the streaming-quality Strategy. Avoid picking something that sounds impressive but is actually an infrastructure/algorithm problem (e.g., "let's implement the OT transform function" or "let's implement the recommendation ML model") — recognizing and saying that boundary out loud is itself part of what's being evaluated.
