# Design Google Docs (Real-Time Collaborative Editing)

Two people open the same document. One is typing at the top of page 1, the other is typing at the bottom of page 3. Both see each other's cursor and both see each other's words appear within a fraction of a second, and — critically — neither one's edit ever silently overwrites the other's. This is a different flavor of hard problem than anything else in this phase: it's not about contention over a single resource (a room, a seat) but about **merging genuinely concurrent, interleaved edits to the same shared piece of data** without a central lock ever making one user wait for another.

## 1. Requirements

**Functional**
- Multiple users can edit the same document simultaneously, with each user's changes visible to others within roughly a second.
- The system preserves document history (who changed what, when) and supports viewing/reverting to a previous version.
- A user can keep editing while briefly offline, with changes syncing once reconnected.

**Non-functional**
- **Availability and low latency win over strict consistency at the moment of edit** — a user must never be blocked from typing while waiting to confirm they have the "true" latest version; the system instead guarantees that all replicas *eventually* converge to the same final document state, and does so quickly.
- **Latency target:** an edit should appear on other collaborators' screens in well under a second.
- **Scale target:** the actual hard constraint isn't total documents (that's just storage) but concurrent editors *on the same document* — a handful of doors, not the whole company, edit any single document at once, but that handful is doing so continuously and expects instant feedback.

## 2. Back-of-envelope estimation

Assume 100 million monthly active users, of whom 10% edit a document (rather than just viewing) on a given day, averaging 3 edit sessions/day with a typical session generating one edit operation roughly every 2 seconds while actively typing:

- Daily active editors: 100,000,000 × 0.10 = 10,000,000.
- Edit operations/sec (very rough, assuming edits are bursty but average out): 10,000,000 × 3 sessions × (say 2 minutes of actual typing per session ÷ 2 sec/op = 60 ops/session) ÷ 86,400 ≈ **~20,800 edit-operations/sec** system-wide — individually tiny (a few bytes per operation) but this is the number the real-time sync layer must sustain in aggregate.
- Storage: document history as a sequence of small operations (rather than full-document snapshots each time) keeps per-edit storage tiny — a few hundred bytes per operation — but the *count* of operations across a long-lived, heavily-edited document can run into the millions over its lifetime; periodic snapshotting (checkpoint the full document state every N operations) keeps replay-on-load fast without storing every single keystroke's full history forever in the hot path.

## 3. High-level architecture

```
   Collaborator A ──┐                                   ┌── Collaborator B
                     │      WebSocket (persistent)         │
                     ▼                                     ▼
              ┌─────────────────────────────────────────────┐
              │            Document Session Server             │
              │  (holds the live, in-memory document state       │
              │   for documents currently being edited;            │
              │   applies OT/CRDT merge logic per edit)             │
              └───────────────────┬─────────────────────────┘
                                   │  periodic checkpoint +
                                   │  operation log append
                                   ▼
              ┌─────────────────────────────────────────────┐
              │   Operation log store (append-only, per doc)    │
              │   + periodic full-snapshot store                 │
              │   (Phase 05 — a database optimized for            │
              │   append-heavy sequential writes)                  │
              └─────────────────────────────────────────────┘
```

- Editors connect over a **persistent WebSocket connection** to a Document Session Server, not plain request/response HTTP — real-time collaboration needs the server to be able to *push* other collaborators' edits to you the instant they happen, which a stateless request/response API can't do.
- The Session Server holds the **live in-memory state** of a document currently being actively edited, applying each incoming edit through the merge logic described in the deep dive, then broadcasting the resulting change to every other connected collaborator on that document.
- Every accepted edit is appended to a durable **operation log** (so a crashed session server doesn't lose in-flight edits, and so document history/version-restore is possible), with periodic full-document snapshots so loading a long-lived document doesn't require replaying its entire operation history from scratch.

## 4. Deep dive

**Real-time collaborative editing, at a conceptual level.** The core problem: two users can each type at the "same position" in the document at nearly the same instant, and by the time either edit reaches the server, the document has already changed underneath it — a naive "apply my edit at character position 42" can land in the wrong place, or clobber the other person's edit, once you account for what the other person just inserted. Two named families of algorithms solve this, and an HLD-level answer names both and what problem each solves, without deriving the algorithms themselves (that's a genuinely deep, dedicated topic — out of this course's scope):

- **Operational Transformation (OT):** each edit is expressed as an operation (e.g., "insert 'x' at position 42") along with the document version it was made against. When the server (or another client) receives an operation made against an older version, it *transforms* that operation's position to account for other operations that have landed in the meantime — e.g., if someone else inserted 5 characters before position 42 first, the incoming "insert at 42" gets transformed to "insert at 47" before being applied. This is the approach Google Docs itself is historically known for.
- **Conflict-free Replicated Data Types (CRDTs):** the document is represented as a data structure specifically designed so that concurrent operations from different replicas can be merged automatically and deterministically, regardless of the order they're received in, without needing a central server to transform anything — every replica converges to the same state by construction. CRDTs shift complexity from "transform operations relative to a version history" to "design a data structure with a merge function that's provably commutative and associative," and are increasingly popular for peer-to-peer/offline-first collaborative tools.

The practical takeaway for an interview: pick one, name why (OT is more mature/server-centric and easier to reason about with a central authority; CRDTs are better suited to offline-first/peer-to-peer scenarios with no single server to arbitrate), and move on — deriving the transform functions or the CRDT merge rules themselves is a research-level topic, not something expected in a system-design interview.

**WebSocket-based sync.** Every active collaborator holds an open WebSocket to the Document Session Server responsible for that document. When Collaborator A's edit arrives, the server: (1) transforms/merges it against the document's current authoritative state using OT or CRDT logic, (2) applies the merged result to its in-memory state and appends the operation to the durable log, (3) broadcasts the transformed operation to every other connected collaborator (B, C, ...), who apply it locally. Because all edits funnel through one authoritative Session Server per document, that server is a natural place to also handle presence (whose cursor is where) and avoid the harder problem of arbitrating conflicts across multiple servers for the same document — this does mean a single document's live edit session has a soft scaling ceiling (one server's capacity), which is a deliberate, acceptable trade-off since no single document is ever concurrently edited by more than a small number of people in practice.

## 5. Trade-offs / what breaks at 10x scale

- **A single Document Session Server instance handling many concurrently-edited documents becomes a memory/CPU bottleneck** — the fix is sharding documents across many session servers (consistent hashing on document ID, per Phase 04 Lesson 02, so a document always routes to the same server for the duration of its active session) rather than trying to make one server hold every live document.
- **The operation log grows unbounded for a long-lived, heavily-edited document** — the fix (already folded into the architecture above) is periodic snapshotting: checkpoint the full resolved document state every N operations, and truncate/archive older log entries, so loading a document replays only "snapshot + recent operations" instead of its entire history.
- **A collaborator on a flaky connection generates a burst of catch-up operations on reconnect** that could momentarily overwhelm the merge logic if unbounded — the fix is batching/coalescing a reconnecting client's backlog into fewer merge operations before broadcasting, rather than replaying every buffered keystroke individually.

## Interview Q&A

**Q: Why does this system need WebSockets instead of a normal REST API?**
A: Collaborative editing requires the server to push other users' edits to you the instant they happen — a plain request/response API only lets the server respond when you ask, so you'd have to poll constantly to approximate real-time updates, adding latency and wasted load. A persistent WebSocket lets the server broadcast an edit to every connected collaborator immediately.

**Q: What problem does Operational Transformation or a CRDT actually solve here?**
A: Both solve the same problem — merging two edits that were made concurrently, each unaware of the other, so the final document is correct and consistent for everyone, without forcing one editor to wait for the other. OT does this by transforming an incoming operation's position relative to operations that landed first; a CRDT does it by representing the document in a data structure whose merge function is deterministic and order-independent by construction.

**Q: Why is document history stored as a sequence of operations rather than saving a full copy of the document after every edit?**
A: An operation ("insert 'x' at position 42") is a few bytes; a full document snapshot after every single keystroke would be enormously wasteful for a large document edited over a long session. Operations are cheap to store and also directly give you the audit trail (who changed what, when) that full-snapshot-per-edit storage would need extra bookkeeping to reconstruct.

**Q: How does this system handle a user editing while offline and reconnecting later?**
A: The client keeps applying edits locally against its own copy of the document while offline, buffering the operations. On reconnect, it sends its buffered operations to the Session Server, which transforms/merges them against whatever happened on the document while the client was disconnected — the same merge logic that handles two simultaneously-online editors handles a delayed batch of offline edits, just applied all at once on reconnect.

**Q: Why is one document's live edit session pinned to a single server rather than distributed across many servers for extra scale?**
A: Arbitrating concurrent edits correctly requires one authoritative place to apply the merge logic in order — spreading a single document's edits across multiple servers would reintroduce the exact conflict-ordering problem OT/CRDTs are meant to solve, just at the infrastructure layer instead of the editing layer. Since no single document is ever edited by more than a handful of people concurrently, one server per active document is sufficient; the scaling story is sharding *many different documents* across *many servers*, not scaling one document's session horizontally.
