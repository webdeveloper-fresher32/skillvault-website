# Design Google Drive (Cloud File Storage & Sync)

You drop a 2GB video file into a synced folder on a spotty hotel WiFi connection. It uploads in the background, survives your laptop sleeping halfway through, and shows up on your phone a minute later — without re-uploading the whole file if you'd already uploaded an identical copy from another device last week. Three genuinely separate hard problems live inside that one sentence: **large files need to upload in pieces, not one shot; identical content shouldn't be stored (or uploaded) twice; and metadata (folders, permissions, versions) needs a different home than the file bytes themselves.**

## 1. Requirements

**Functional**
- A user uploads, downloads, organizes (folders), and shares files/folders with specific permission levels.
- Large file uploads/downloads must resume after a network interruption rather than restarting from zero.
- The system tracks file versions and lets a user restore a previous version.

**Non-functional**
- **Strong consistency for metadata** (a file's name, folder location, and permissions must never be ambiguous), **eventual consistency is acceptable for cross-device sync propagation** (a few seconds' delay before a change appears on another device is fine).
- **Latency target:** metadata operations (listing a folder, renaming a file) under a few hundred milliseconds; upload/download throughput bound by the user's own network, not the system.
- **Scale target:** storage volume, not request rate, is the dominant scaling axis — a single user can hold terabytes of data across millions of files.

## 2. Back-of-envelope estimation

Assume 500 million users, averaging 2GB of stored data each, with 5% of users actively uploading/modifying files on a given day:

- Total storage: 500,000,000 × 2GB = **1 exabyte (1,000 petabytes)** — this number alone tells you object storage (Phase 08 Lesson 01), not a database blob column, is mandatory; no relational database is designed to hold this volume of binary data.
- Daily active uploaders: 500,000,000 × 0.05 = 25,000,000, each performing a handful of file operations/day — call it 5 operations/user/day: 25,000,000 × 5 ÷ 86,400 ≈ **~1,450 metadata writes/sec** — this is the number the metadata database needs to sustain, and it's a very different (much smaller) number than the storage-volume figure above.
- Average file size matters for the chunking decision below: assume most files are small (documents, photos, a few MB), but a meaningful tail is large (videos, archives, tens of GB) — the upload path must handle both without penalizing the common small-file case with unnecessary chunking overhead.

## 3. High-level architecture

```
   Client (web/desktop/mobile) ──────────▶ ┌─────────────────┐
                                           │  API Gateway       │  (Phase 08 L02)
                                           └────────┬──────────┘
                                                     │
                    ┌─────────────────────────────────┼─────────────────────────┐
                    ▼                                                            ▼
          ┌────────────────────┐                                     ┌────────────────────┐
          │  Metadata Service     │                                     │  Upload/Download       │
          │  (file/folder tree,    │                                     │  Service (chunking,      │
          │  permissions,           │                                     │  dedup check, resumable   │
          │  version pointers)      │                                     │  transfer)                 │
          └────────┬───────────┘                                     └────────┬───────────┘
                    ▼                                                            ▼
          ┌────────────────────┐                                     ┌────────────────────┐
          │  Postgres              │                                     │  Object storage          │
          │  (Phase 05 L04 —        │                                     │  (S3/GCS-style,           │
          │  strongly consistent    │                                     │  Phase 08 L01) — actual   │
          │  tree structure)         │                                     │  file bytes, content-      │
          └────────────────────┘                                     │  addressed by hash          │
                                                                       └────────────────────┘
                    ▲
                    │  async change events
          ┌────────────────────┐
          │  Sync/notification      │  (Phase 07 — pushes change
          │  service (queue +         │   events to other logged-in
          │  pub/sub per user)         │   devices for that account)
          └────────────────────┘
```

- The **Metadata Service** is backed by a relational database (Phase 05 Lesson 04) because the folder/file tree and permission model need strong consistency — you never want two devices to see conflicting answers to "what's in this folder" or "who can edit this file."
- The **Upload/Download Service** talks to object storage (Phase 08 Lesson 01) for the actual bytes, chunking large files and checking content hashes for deduplication before committing to a full upload — see the deep dive.
- A **Sync/notification service** (Phase 07's pub-sub pattern) pushes lightweight "this changed" events to a user's other active devices/sessions, which then pull the updated metadata and, if needed, the changed bytes — this is what makes a change on one device "just appear" on another within seconds without every device polling constantly.

## 4. Deep dive

**Chunked upload/download.** Splitting a large file into fixed-size chunks (commonly 4-10MB each) before upload solves two problems at once: resumability (if the connection drops mid-upload, only the in-flight chunk needs to be retried, not the whole file) and parallelism (multiple chunks can upload concurrently over a fast connection). The client computes a manifest of chunk hashes up front; the server tracks which chunks have been received, and the client can query "which chunks do you still need" to resume after an interruption without re-sending already-acknowledged chunks. Once all chunks are present, the server (or the client, depending on design) reassembles/commits the file in object storage and the Metadata Service records the new version pointer.

**Deduplication via content hashing.** Before uploading a chunk (or a whole small file), the client computes its content hash (e.g., SHA-256) and asks the server "do you already have a chunk/file with this hash?" If yes — which happens surprisingly often at scale, since many users store identical common files (the same PDF forwarded around, stock photos, installer files) — the server just adds a metadata reference to the existing stored object instead of re-uploading or re-storing the bytes at all. This is why the object-storage layer should be **content-addressed**: objects are keyed by their content hash rather than an arbitrary generated ID, so identical content anywhere in the system naturally collapses to one stored copy, and the Metadata Service's file records simply point at that shared hash. The trade-off to name explicitly: deduplication saves storage and upload bandwidth but adds a hash-lookup round-trip before every upload, and it means a single stored object can be referenced by many users' file trees, so deleting a "file" from one user's view must only decrement a reference count, never actually delete the underlying object until its last reference is gone.

**Metadata DB vs blob storage split.** This is the same principle Phase 08 Lesson 01 introduced for a single image field, generalized to an entire filesystem: the Metadata Service's relational database stores only small, structured, frequently-queried data (file names, folder hierarchy, permissions, size, a pointer/hash referencing the actual content) — never the file bytes themselves. Object storage holds the actual bytes, addressed by content hash, and is optimized for storing huge volumes of large binary blobs cheaply, not for relational queries. Querying "what's in this folder" or "who can I share this with" never touches object storage at all; only an actual download does.

## 5. Trade-offs / what breaks at 10x scale

- **The Metadata Service's relational database becomes a write bottleneck** at 10x active users — the standard fix is sharding by user/account ID (Phase 05 Lesson 03), since one user's file tree is never queried jointly with another's, making this an easy, natural partition key.
- **Content-hash lookups for deduplication become a bottleneck if implemented as a single global index** — the fix is the same kind of caching layer used elsewhere in this course (Phase 06): keep a fast cache of recently-seen/popular hashes in front of the authoritative lookup, since a small set of files (common templates, popular shared documents) account for a disproportionate share of hash-check traffic.
- **The Sync/notification fan-out gets expensive for a user with many simultaneously active devices/sessions at 10x device density** — the fix is batching change events over a short window rather than pushing one notification per individual metadata change, trading a little latency for a large reduction in notification volume.

## Interview Q&A

**Q: Why split file metadata into a relational database while storing the actual file bytes in object storage, rather than one system for both?**
A: The two have completely different access patterns and scaling needs. Metadata (names, folder structure, permissions) is small, highly structured, and needs strongly consistent relational queries ("what's in this folder," "who can access this"). File bytes are enormous in aggregate, rarely queried by content, and need cheap storage optimized for large blobs — a relational database is the wrong tool for exabyte-scale binary storage, and object storage is the wrong tool for relational permission queries.

**Q: How does chunked upload help with an unreliable network connection?**
A: Splitting a file into independently-tracked chunks means a dropped connection only costs you the in-flight chunk, not the whole file — the client can query which chunks the server has already acknowledged and resume from there, and multiple chunks can also upload in parallel to use available bandwidth more fully.

**Q: How does content-hash deduplication actually save storage, and what's the catch?**
A: By keying stored objects by their content hash rather than an arbitrary ID, identical content uploaded by different users (or the same user twice) collapses to one physical copy — the server can detect "I already have this hash" before a client even uploads the bytes. The catch is that a single stored object can now be referenced by many users' file trees, so "deleting" a file must decrement a reference count rather than actually delete the object, and the actual deletion only happens once the reference count hits zero.

**Q: How would you support offline editing and syncing changes made on multiple devices while offline?**
A: Each device tracks a local version/timestamp for files it has synced; on reconnect, it compares its local version against the Metadata Service's current version. If they match, no conflict — sync proceeds normally. If they diverge (both devices edited while offline), the system either applies a last-write-wins policy with the losing version preserved as a recoverable prior version, or — for higher-stakes conflicts — surfaces both versions to the user to manually resolve, rather than silently discarding either one.

**Q: Why push change notifications via pub/sub instead of having every device poll the Metadata Service periodically?**
A: Polling wastes resources on both sides when nothing has changed (the common case) and adds latency up to the poll interval when something has. A pub/sub push (Phase 07 Lesson 03) notifies devices only when there's an actual change, giving near-real-time sync without the wasted constant-polling load at scale across hundreds of millions of connected devices.
