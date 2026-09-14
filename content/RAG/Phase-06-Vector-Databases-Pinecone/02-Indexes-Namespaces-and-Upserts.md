# 02 — Indexes, Namespaces, and Upserts

> How to add and update vectors without downtime, and how namespaces keep multiple datasets or tenants cleanly separated inside a single Pinecone index.

---

## Table of Contents

1. [The Problem: Growing Data Without Downtime](#1-the-problem-growing-data-without-downtime)
2. [The Analogy: Labeled Drawers in One Archive Cabinet](#2-the-analogy-labeled-drawers-in-one-archive-cabinet)
3. [What Upserts and Namespaces Actually Are](#3-what-upserts-and-namespaces-actually-are)
4. [Internal Flow: Insert-or-Update, Scoped by Namespace](#4-internal-flow-insert-or-update-scoped-by-namespace)
5. [Code Example: Batch Upserting and Namespace-Scoped Querying](#5-code-example-batch-upserting-and-namespace-scoped-querying)
6. [Common Mistakes](#6-common-mistakes)
7. [Interview Angle](#7-interview-angle)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Growing Data Without Downtime

A RAG app rarely stays static. New documents arrive continuously — support tickets get filed, new product pages get published, users upload new files. Meanwhile, existing documents get corrected or removed. A production vector store has to support all of this *while the application keeps serving queries* — you can't take the index offline every time a new document shows up.

There's a second, related problem that shows up the moment your app serves more than one customer, team, or dataset: how do you keep Customer A's documents from ever leaking into Customer B's search results, without paying for and managing a completely separate index per customer? Provisioning a new index for every tenant doesn't scale operationally — you'd be managing hundreds of indexes for hundreds of customers, most of which hold a tiny amount of data.

Pinecone solves the first problem with **upserts** and the second with **namespaces** — two independent mechanisms that, together, let one index support continuous writes and clean logical separation at the same time.

## 2. The Analogy: Labeled Drawers in One Archive Cabinet

**Real-world analogy:** picture that professional archive service from the previous lesson, but now imagine it serves multiple law firms out of the same building, to keep costs down.

The archive doesn't build a separate building per client — that would be wasteful and slow to set up for every new small client. Instead, it uses one large cabinet system, but every firm gets its own clearly labeled drawer. A clerk retrieving files for Firm A only ever opens Firm A's drawer; they're never at risk of accidentally handing Firm A a document from Firm B's drawer, because the drawers are physically and procedurally separated, even though they live in the same cabinet.

**Namespaces are those labeled drawers.** One Pinecone index (one "cabinet") can hold many namespaces (many "drawers"), each holding its own set of vectors. A query scoped to a namespace only ever searches within that drawer — it never sees vectors from other namespaces in the same index, even though they're all physically stored in the same underlying system.

And the archive clerk doesn't need to "delete and re-file" a whole folder just to update one page in it — they simply replace or add the specific page under its existing label. That's the upsert: replace-if-present, insert-if-new, addressed by id, without disturbing anything else in the drawer.

## 3. What Upserts and Namespaces Actually Are

**Upsert** is a portmanteau of "insert" and "update." When you upsert a vector, you provide an id, the vector values, and (optionally) metadata. If a vector with that id doesn't already exist in the target namespace, it's inserted. If a vector with that id *does* already exist, it's overwritten with the new values and metadata. This is the single write operation Pinecone exposes for adding data — there's no separate "insert" vs. "update" call to worry about, which simplifies application code: you never need to check "does this already exist?" before writing.

**Namespaces** are a partitioning mechanism within a single index. Every vector belongs to exactly one namespace (the "default" empty-string namespace if none is specified). Vectors in different namespaces are never mixed during a query — a query scoped to namespace `"tenant-a"` only ever searches vectors upserted into `"tenant-a"`. Critically, namespaces share the index's dimension and metric (you can't have one namespace with 768-dimensional vectors and another with 1536 in the same index) — they're a logical partition, not a way to run different configurations side by side.

## 4. Internal Flow: Insert-or-Update, Scoped by Namespace

When your application needs to add or refresh data, the flow looks like this:

1. **Prepare your records.** For each chunk of text you've embedded, assemble an id (something stable and unique — often derived from the source document and chunk index, e.g. `"doc42-chunk3"`), the embedding vector, and a metadata dict (source filename, tenant id, timestamps, whatever you'll want to filter on later — covered in the next lesson).

2. **Batch them.** Rather than sending one vector per network call, you group many records into a single `upsert` call. Pinecone's client and API are built around accepting a list of vectors per request — this matters enough that it gets its own section below.

3. **Send with a namespace.** You specify which namespace this batch belongs to. If you omit it, the vectors land in the default namespace — fine for single-tenant apps, but a namespace should be provided explicitly for anything multi-tenant.

4. **Query, scoped the same way.** At query time, you pass the same namespace argument. The search only considers vectors in that namespace, so a query issued on behalf of Tenant A structurally cannot return Tenant B's data, regardless of how similar the vectors might be.

## 5. Code Example: Batch Upserting and Namespace-Scoped Querying

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_API_KEY")
index = pc.Index("rag-course-demo")

# Each record is a tuple of (id, vector_values, metadata_dict).
# In a real pipeline these vectors would come from an embedding model,
# not hardcoded lists -- shortened here for readability.
records = [
    ("doc1-chunk0", [0.12, 0.98, 0.03, 0.44], {"source": "doc1.pdf", "chunk": 0}),
    ("doc1-chunk1", [0.31, 0.11, 0.87, 0.20], {"source": "doc1.pdf", "chunk": 1}),
    ("doc2-chunk0", [0.55, 0.42, 0.19, 0.76], {"source": "doc2.pdf", "chunk": 0}),
]

# Batch upsert -- one network call for the whole list, scoped to a namespace.
# In practice, split very large record lists into chunks of a few hundred
# per call rather than sending thousands of vectors in a single request.
index.upsert(vectors=records, namespace="tenant-acme")

# Query, scoped to the same namespace -- results will only ever come
# from vectors previously upserted into "tenant-acme".
query_vector = [0.30, 0.15, 0.85, 0.22]

response = index.query(
    vector=query_vector,
    top_k=2,
    namespace="tenant-acme",
    include_metadata=True,
)

# The response is an object with a `.matches` list -- NOT a list of lists.
# Each match has its own `.id`, `.score`, and `.metadata` attributes
# (or equivalent dict-style access), one match per result -- a flatter
# shape than what you may have seen from other vector store clients.
for match in response.matches:
    print(match.id, match.score, match.metadata)
```

Two things worth calling out for readers building intuition here: the `vectors=` argument to `upsert` accepts a plain list of tuples (or dicts, for more explicit code) — there's no separate "does it exist" check because upsert handles both cases by design. And the shape of `response.matches` — a flat list where each element carries its own id, score, and metadata directly — is specific to Pinecone; don't assume every vector database returns results in the same structural shape, since that assumption is a common source of bugs when porting code between vector store providers.

## 6. Common Mistakes

**Mistake 1: Upserting one vector at a time in a loop.** It's tempting to write `for record in records: index.upsert(vectors=[record])` — one network call per vector. For a few dozen vectors this "works," but for thousands or millions it's dramatically slower (you pay full network round-trip latency per vector instead of per batch) and, depending on your plan, can be needlessly costly compared to sending the same data in a handful of batched calls. Always assemble a list of records and upsert in batches (a few hundred vectors per call is a common practical size).

**Mistake 2: Forgetting namespace scoping and accidentally querying across tenants.** If you upsert Tenant A's data into `"tenant-acme"` but then issue a query without specifying `namespace=`, that query hits the *default* namespace — which is likely empty, giving a silent "no results" bug rather than a loud error. Worse, if two tenants' data both end up in the default namespace because a namespace argument was forgotten somewhere in the code, queries can return one tenant's documents to another tenant, which is a data-isolation failure with real security implications in a multi-tenant application. Always pass `namespace=` explicitly on both `upsert` and `query`, and treat "which namespace does this request belong to" as a value that flows through your application's request context, not something to default silently.

## 7. Interview Angle

Interviewers probing production RAG experience often ask "how do you keep customer data separated in a shared vector store?" This is really testing whether the candidate understands namespaces (or the equivalent partitioning concept in whatever vector database they used) as an architectural decision, not just an API parameter — the right answer connects namespace scoping to a concrete failure mode (cross-tenant data leakage) rather than reciting "you pass a namespace argument." A second common follow-up is about update semantics: "how do you handle a document that changes?" — the strong answer is that upsert-by-id makes this trivial (re-embed the changed chunk, upsert with the same id, and the old vector is atomically replaced) rather than requiring a manual delete-then-insert dance.

## 8. Hands-On Exercises

### Exercise 1 — Batch upsert and verify with describe_index_stats

**Goal:** Upsert a list of 10+ small placeholder vectors into two different namespaces (`"team-a"` and `"team-b"`) in a test index, then call `index.describe_index_stats()` and confirm it reports the correct vector count per namespace.

### Exercise 2 — Prove namespace isolation

**Goal:** With the data from Exercise 1 in place, run the same query vector against `namespace="team-a"` and `namespace="team-b"` and confirm the returned matches are completely disjoint (no overlapping ids) — direct, hands-on proof of the isolation guarantee described in this lesson.

### Exercise 3 — Update a vector via upsert and confirm the old version is gone

**Goal:** Upsert a vector with id `"doc1-chunk0"` and some metadata, query for it, then upsert a *new* vector under the same id with different values and metadata. Query again and confirm only the new version is returned — this demonstrates upsert's replace-on-conflict behavior rather than creating a duplicate.

## 9. Interview Q&A

### Q1. What does "upsert" mean in the context of a vector database, and why is it the primary write operation instead of separate insert/update calls?

**Answer:** Upsert means insert-if-the-id-doesn't-exist, update-if-it-does. It's the primary write operation because it removes the need for application code to check existence before writing — you always just upsert, and the database resolves whether that's a fresh insert or an overwrite based on the id.

### Q2. What is a namespace, and what problem does it solve?

**Answer:** A namespace is a logical partition within a single index — every vector belongs to exactly one namespace, and queries scoped to a namespace only search within it. It solves the multi-tenant/multi-dataset problem: you can keep many customers' or datasets' vectors cleanly separated without provisioning a separate index (with its own dimension, metric, and infrastructure) for each one.

### Q3. Can two namespaces in the same index use different vector dimensions?

**Answer:** No. Dimension and metric are properties of the index as a whole; every namespace within that index shares them. Namespaces partition the *data*, not the index's configuration.

### Q4. Why is batching upserts important at scale?

**Answer:** Each upsert call is a network round trip. Sending one vector per call means paying that latency (and often cost) overhead once per vector, which becomes prohibitively slow for large datasets. Batching many vectors into a single call amortizes that overhead across the whole batch, making large-scale writes dramatically faster.

### Q5. What's a realistic failure mode if a developer forgets to pass a namespace on a query in a multi-tenant app?

**Answer:** The query silently falls back to the default namespace instead of erroring. If tenant data was upserted into named namespaces, the query returns no results (a confusing "empty results" bug) — or worse, if multiple tenants' data was accidentally written to the default namespace, a query could return one tenant's data mixed with another's, which is a real data-isolation and security problem, not just a UX bug.

---

> 🧠 **Memory hook:** "Upsert is 'insert-or-update, no questions asked.' Namespaces are labeled drawers in the same cabinet — always check whose drawer you're opening before you search."
