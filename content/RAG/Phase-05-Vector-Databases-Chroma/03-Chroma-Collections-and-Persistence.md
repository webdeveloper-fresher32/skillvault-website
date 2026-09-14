# 03 — Chroma Collections and Persistence

> Managing multiple collections, updating and deleting documents by id, and confirming that a persistent client's data really does survive a restart.

---

## Table of Contents

1. [The Problem: A Real App Needs More Than One Script Run](#1-the-problem-a-real-app-needs-more-than-one-script-run)
2. [The Analogy: A Filing Cabinet With Labeled Folders](#2-the-analogy-a-filing-cabinet-with-labeled-folders)
3. [Internal Flow: Multiple Collections, Updates, Deletes, Persistence](#3-internal-flow-multiple-collections-updates-deletes-persistence)
4. [Worked Example: Two Knowledge Bases, an Update, a Delete, and a Restart](#4-worked-example-two-knowledge-bases-an-update-a-delete-and-a-restart)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: A Real App Needs More Than One Script Run

Phase 5's previous lesson got one collection working end-to-end: create a client, add documents, query them. That's enough for a single demo script — but a real application rarely stays that simple for long.

Suppose you're building a support assistant that needs to answer questions about *both* a product manual and an internal engineering wiki. Do you dump both into one collection and hope filtering by metadata is enough to keep them separate? What happens when a support document gets edited — do you have to delete and re-add the entire collection, or can you update just that one record? And critically: if your app restarts (a server redeploys, a laptop reboots), is your carefully indexed data still there, or do you have to re-embed everything from scratch every single time?

These are the problems this lesson solves: organizing data into multiple purpose-built collections, updating and deleting individual records by id without disturbing the rest, and understanding exactly what persistence Chroma gives you and what it doesn't.

---

## 2. The Analogy: A Filing Cabinet With Labeled Folders

**Real-world analogy:** imagine an office filing cabinet. You wouldn't throw every document — HR forms, client contracts, expense receipts — into one giant unsorted pile inside a single drawer. You'd use labeled folders: one for HR, one for contracts, one for receipts. Each folder holds related documents, and you can open, update, or remove a single document inside a folder without touching any other folder.

A Chroma **collection** is a folder. A Chroma **client** (backed by a directory on disk, if persistent) is the whole filing cabinet. Just as you'd create a new folder for a new project rather than mixing everything together, you create a new collection for each distinct knowledge base or topic your application needs — a `product_manual` collection and a separate `engineering_wiki` collection, say — so that each stays organized, independently manageable, and easy to reason about.

---

## 3. Internal Flow: Multiple Collections, Updates, Deletes, Persistence

**3.1 Multiple collections from one client.** A single client (especially a persistent one) can hold any number of named collections. `client.get_or_create_collection(name="product_manual")` and `client.get_or_create_collection(name="engineering_wiki")` create two entirely independent folders inside the same underlying storage directory. You'd typically reach for multiple collections when different bodies of knowledge shouldn't be searched together — a multi-tenant app (one collection per customer), or a multi-topic app (one collection per knowledge domain).

**3.2 Updating a document by id.** `collection.update(ids=[...], metadatas=[...])` (and optionally `documents=...` and `embeddings=...`) lets you change specific fields of an existing record, addressed by its id, without needing to resupply every field or re-add the record. This is what you'd use when, say, a document's source URL changes or you want to tag it with a new category, without touching its embedding or text.

**3.3 Deleting a document by id.** `collection.delete(ids=[...])` removes specific records, again addressed by id. You can also delete by metadata filter (`collection.delete(where={"source": "old_doc.md"})`) to remove everything matching a condition, without knowing individual ids in advance.

**3.4 Persistent vs. in-memory clients, revisited.** Lesson 02 introduced `PersistentClient(path=...)` as the way to make data survive a restart. The key mental model: a persistent client writes its collections to disk at that path as you add, update, or delete — so a *second* `PersistentClient` created later, pointed at the *same* path, opens the exact same data, as if you'd never stopped the process. This is what makes it possible to build a script that indexes documents once, then a completely separate script (or server process) that only queries — no re-indexing needed on every run.

**3.5 A word on backups.** Because a persistent Chroma client's data lives as files on disk at the path you gave it, backing it up is conceptually no different from backing up any other directory of files: copy the directory elsewhere on a schedule, or point it at a disk that's already being backed up. Chroma itself doesn't manage backups for you — that responsibility sits with whatever's managing the machine or disk it's running on, which is a meaningfully different (and lighter) operational story than a managed cloud service.

---

## 4. Worked Example: Two Knowledge Bases, an Update, a Delete, and a Restart

**Step 1 — create two separate collections, one client.**

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_data")

manual_kb = client.get_or_create_collection(name="product_manual")
wiki_kb = client.get_or_create_collection(name="engineering_wiki")

manual_kb.add(
    ids=["m1", "m2"],
    embeddings=[[0.10, 0.20, 0.30], [0.15, 0.25, 0.35]],
    documents=[
        "To install the device, connect the power cable first.",
        "The warranty covers manufacturing defects for 12 months.",
    ],
    metadatas=[{"section": "setup"}, {"section": "warranty"}],
)

wiki_kb.add(
    ids=["w1"],
    embeddings=[[0.80, 0.10, 0.05]],
    documents=["Our deployment pipeline runs integration tests before every merge to main."],
    metadatas=[{"team": "platform"}],
)

print(client.list_collections())
```

`client.list_collections()` returns the collections that exist under this client, confirming `product_manual` and `engineering_wiki` are both present and independent — adding to one never touched the other.

**Step 2 — update a document's metadata by id.**

```python
manual_kb.update(
    ids=["m2"],
    metadatas=[{"section": "warranty", "last_reviewed": "2026-01-15"}],
)
```

This changes `m2`'s metadata to add a `last_reviewed` field, without needing to resupply its embedding or document text — `update()` only touches the fields you pass.

**Step 3 — delete a document by id.**

```python
manual_kb.delete(ids=["m1"])

print(manual_kb.count())  # 1 -- only "m2" remains in product_manual
```

`m1` is now gone from `product_manual`; `m2` is untouched, and `engineering_wiki` is completely unaffected, since `delete()` only ever acts on the collection you call it on.

**Step 4 — close the process, then reopen a persistent client later.**

Imagine this next snippet runs in a brand-new Python process — a later run of your script, or a completely different process (e.g., your app's query-serving code, started up separately from whatever indexed the data):

```python
import chromadb

# Same path as before -- this is what makes it "the same data," not a fresh empty store.
client = chromadb.PersistentClient(path="./chroma_data")

manual_kb = client.get_or_create_collection(name="product_manual")
print(manual_kb.count())  # 1 -- "m2" is still there; "m1" is still gone

result = manual_kb.get(ids=["m2"])
print(result["metadatas"])  # [{'section': 'warranty', 'last_reviewed': '2026-01-15'}]
```

Because both processes point `PersistentClient` at the same `./chroma_data` path, the second process sees exactly the state the first process left behind: `m1` deleted, `m2` present with its updated metadata. `collection.get(ids=[...])` (distinct from `.query()`) fetches records directly by id rather than by similarity — useful here to confirm the exact state of a specific record without needing an embedding at all.

---

## 5. Common Mistakes

**Mistake 1: Mixing unrelated data into one collection instead of separating by collection.** It's tempting to throw everything — product docs, support tickets, internal wiki pages — into a single collection and lean entirely on metadata filters (`where={"source": "wiki"}`) to keep them apart at query time. This works, but it throws away a cleaner mental model and an operational safety net: separate collections can be deleted, backed up, re-indexed, or access-controlled independently, while a single giant mixed collection makes every one of those operations riskier and easier to get wrong (a bad `where` filter, or none at all, and you're searching across data you never meant to mix). Default to separate collections along genuinely distinct boundaries — tenant, topic, or document source — and use metadata filters *within* a collection for finer-grained slicing, not as a substitute for separation that should exist at the collection level.

**Mistake 2: Not handling duplicate ids on re-ingestion.** If you re-run an indexing script — say, because a document changed and you want to refresh it — and call `collection.add()` again with an id that already exists in the collection, Chroma does *not* raise an error and does *not* overwrite the existing record either: it logs a warning (something like "Insert of existing embedding ID") and silently skips that id, leaving the original record exactly as it was. This is arguably the more dangerous version of the mistake — a crash is loud and impossible to miss, but a silent no-op can leave your index quietly stale for weeks while every re-ingestion run "succeeds" without actually updating anything. The fix is to use `collection.upsert(ids=..., embeddings=..., documents=..., metadatas=...)` instead of `add()` whenever a re-ingestion run might touch ids that already exist — `upsert()` inserts new ids and updates existing ones in the same call, which is almost always what a re-indexing job actually wants.

**Interview angle:** A practical question here is "how would you handle re-indexing a document that changed?" A strong answer names the specific problem (`add()` silently skipping ids that already exist, rather than erroring or overwriting), names the fix (`upsert()`, or explicitly `delete()` then `add()`), and connects it to why: production indexing pipelines run repeatedly over changing data, so idempotent re-ingestion (safe to run more than once with the same result) is a basic operational requirement, not an edge case — and a silent-skip failure mode is exactly the kind of bug that's easy to miss in production because nothing ever throws.

---

## 6. Hands-On Exercises

### Exercise 1 — Build two collections and confirm isolation

**Goal:** Verify collections are truly independent, not just conceptually.

Create two collections, add at least two documents to each with different ids, then delete a document from one collection and confirm (via `.count()` or `.get()`) that the other collection's contents are completely unaffected.

### Exercise 2 — Update, then verify the update actually took

**Goal:** Practice `update()` and confirm it only changes what you asked it to.

Add a document with an initial metadata dict, call `update()` to change just one field of that metadata, then call `collection.get(ids=[...])` and confirm the field you changed is updated while the original document text and embedding are unchanged.

### Exercise 3 — Trigger the duplicate-id mistake, then fix it with `upsert`

**Goal:** Directly experience Mistake 2 from Section 5.

Add a document with a fixed id, then call `collection.add()` again with the same id and a slightly different document string, and observe what happens. Then replace the second call with `collection.upsert(...)` using the same id and confirm the record's text was updated in place, with no error.

---

## 7. Interview Q&A

### Q1. When would you use multiple collections instead of one collection with metadata filters?

**Answer:** When the data genuinely belongs to distinct domains that should be managed, backed up, or deleted independently — separate tenants, separate topics, or separate document sources. Collections give you that separation at a structural level, so operations like wiping one tenant's data or re-indexing one topic can't accidentally touch another's. Metadata filters are still useful *within* a collection for finer slicing, but they shouldn't be the only thing standing between genuinely unrelated data.

---

### Q2. What's the difference between `collection.update()` and `collection.add()`?

**Answer:** `add()` inserts new records and errors if you reuse an id that already exists in the collection. `update()` modifies specific fields (metadata, documents, or embeddings) of records that already exist, addressed by id, without requiring you to resupply fields you're not changing. They serve different purposes: `add()` is for new data, `update()` is for editing existing data in place.

---

### Q3. What happens if you call `add()` with an id that's already in the collection, and how do you avoid the problem?

**Answer:** Chroma neither errors nor overwrites the existing record — it logs a warning and silently skips the duplicate id, since `add()` is meant for inserting new items, not upserting. That silence is the real trap: the script appears to succeed on every run even though nothing after the first run actually updated the index. The practical fix is to use `collection.upsert(...)` instead whenever a script might re-add ids that already exist — it inserts new ids and updates existing ones in a single idempotent call, which is what most re-indexing workflows actually need.

---

### Q4. How does a `PersistentClient` guarantee your data survives a restart?

**Answer:** It writes collection data to disk at the path you provide as you add, update, or delete records, rather than keeping everything only in the process's memory. A later `PersistentClient` created with the *same* path opens that same on-disk data, so from the application's point of view nothing was lost — the new process just resumes working with the exact state the previous process left behind.

---

### Q5. Does Chroma handle backups for you?

**Answer:** No. A persistent Chroma client's data is just files on disk at the path you specify, so backing it up is the same problem as backing up any other directory — copy it elsewhere on a schedule, or rely on whatever already backs up the underlying disk. Chroma doesn't provide its own managed backup service the way a cloud vendor might; that operational responsibility stays with you.

---

> 🧠 **Memory hook:** "One filing cabinet, many labeled folders — keep collections separate, update and delete by id, and a persistent client remembers everything between restarts."
