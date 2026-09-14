# 02 — Chroma Fundamentals

> Installing Chroma, creating a client and a collection, adding documents with embeddings and metadata, and querying by vector — the smallest real vector database workflow you can build.

---

## Table of Contents

1. [The Problem: Prototyping Without Cloud Setup](#1-the-problem-prototyping-without-cloud-setup)
2. [The Analogy: A Notebook vs. Renting an Office](#2-the-analogy-a-notebook-vs-renting-an-office)
3. [Internal Flow: Client → Collection → Add → Query](#3-internal-flow-client--collection--add--query)
4. [Worked Example: Indexing and Querying Three Documents](#4-worked-example-indexing-and-querying-three-documents)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Prototyping Without Cloud Setup

Say you've just finished Phase 4 — you have a working chunker, and Phase 2 gave you a way to turn each chunk into an embedding vector. Now you need somewhere to put those vectors so you can search them later. The obvious next step, if you've read tutorials or production RAG blog posts, is often "sign up for a managed vector database" — create an account, get an API key, configure a cloud index, wait for it to provision.

That's a lot of ceremony for what might just be "I want to see if my RAG pipeline works." You don't want to manage cloud infrastructure, pay for a service, or wait on network round-trips just to test whether your retrieval step finds the right chunk. You want something you can `pip install`, import, and start using in the same terminal session — ideally with data that survives if you restart your script.

That's exactly the gap Chroma fills: a vector database you run as a local Python process (or a lightweight local server), with zero accounts and zero cost, that still gives you the real API shape (add documents, query by embedding, get back ranked results with metadata) you'll use again with Pinecone (Phase 6) and pgvector (Phase 7).

---

## 2. The Analogy: A Notebook vs. Renting an Office

**Real-world analogy:** imagine you want to jot down some ideas.

Renting an office means signing a lease, getting a key cut, setting up a desk, maybe hiring someone to answer the phone — a lot of setup before you've written a single word. That's appropriate once you have a real, ongoing business to run out of that space, but it's absurd overhead for "I just want to write something down right now."

A personal notebook, by contrast, is something you can open and start scribbling in immediately. No setup, no commitment, no one else involved — and when you close it and open it again tomorrow, your notes are still there, right where you left them.

Chroma is the notebook. You `pip install chromadb`, write a few lines of Python, and you're storing and querying real vectors within a minute — with a persistent client (Section 3), those vectors are still there the next time you run your script. Pinecone (Phase 6) is closer to the rented office: more setup, but built for when you're running a real, ongoing, possibly large-scale operation.

---

## 3. Internal Flow: Client → Collection → Add → Query

Every Chroma workflow follows the same four steps, and it's worth understanding what each one is actually doing before you see the code.

**3.1 Create a client.** The client is your connection to a Chroma database. Chroma offers a few client types, but the two you'll use most as a beginner are an **in-memory client** (`chromadb.Client()` — data vanishes when the process ends, useful for quick experiments) and a **persistent client** (`chromadb.PersistentClient(path=...)` — data is written to disk at the given path and survives process restarts). Section 5 (Common Mistakes) covers why picking the wrong one by accident is a classic beginner trap.

**3.2 Create (or get) a collection.** A collection is Chroma's equivalent of a table — a named bucket that holds a set of related vectors, their original text, and their metadata. You almost always want `client.get_or_create_collection(name=...)` rather than `client.create_collection(name=...)`, because the latter raises an error if a collection with that name already exists, while `get_or_create_collection` quietly reuses it — handy when you re-run a script during development.

**3.3 Add documents.** `collection.add(...)` takes parallel lists: `ids` (a unique string identifier for each item — you choose these), `embeddings` (the vector for each item, computed however you like — Phase 2's embedding model, or Chroma's own built-in default embedding function if you pass raw text via `documents` without supplying `embeddings`), `documents` (the original text, stored so you can retrieve it later without a separate lookup), and `metadatas` (an optional dict per item — source file, page number, category, whatever you want to filter or display later).

**3.4 Query by embedding.** `collection.query(query_embeddings=[...], n_results=k)` takes one or more query vectors and returns, for each one, the `k` closest stored items — ranked by distance, with their ids, documents, metadatas, and distances all returned together. You can also pass `query_texts=[...]` instead of `query_embeddings` if the collection was set up with an embedding function that Chroma can call automatically — more on why mixing these two approaches inconsistently is dangerous in Section 5.

---

## 4. Worked Example: Indexing and Querying Three Documents

Here's the smallest realistic Chroma workflow: index three support-knowledge-base chunks, then query for the one relevant to a user's question. To keep the example self-contained and its output fully predictable, we'll supply small, hand-picked embedding vectors directly instead of calling a real embedding model — in a real pipeline these would come from the embedding model covered in Phase 2.

```python
import chromadb

# A persistent client writes its data to disk at this path, so it survives
# restarting the Python process (see Section 5 for why this matters).
client = chromadb.PersistentClient(path="./chroma_data")

# get_or_create_collection won't error if "support_docs" already exists from a
# previous run -- it just reuses it.
collection = client.get_or_create_collection(name="support_docs")

collection.add(
    ids=["doc1", "doc2", "doc3"],
    embeddings=[
        [0.12, 0.85, 0.33, 0.02],  # about refunds
        [0.90, 0.10, 0.05, 0.44],  # about password reset
        [0.15, 0.80, 0.30, 0.05],  # also about refunds
    ],
    documents=[
        "Our refund policy allows returns within 30 days of purchase.",
        "To reset your password, go to Settings -> Security -> Reset Password.",
        "Refunds are processed within 5-7 business days after approval.",
    ],
    metadatas=[
        {"source": "refund_policy.md"},
        {"source": "account_help.md"},
        {"source": "refund_policy.md"},
    ],
)

# Pretend this is the embedding of the user question: "how long is the return window?"
query_vector = [0.13, 0.82, 0.31, 0.03]

results = collection.query(
    query_embeddings=[query_vector],
    n_results=2,
)

print(results["ids"])
print(results["documents"])
print(results["distances"])
```

**What this actually prints.** Chroma's default distance metric is squared L2 (Euclidean) distance — smaller means closer. That's a different default than the cosine similarity Phase 2 recommended as the usual first choice for text embeddings — if you want cosine instead, pass `metadata={"hnsw:space": "cosine"}` when creating the collection; the rest of this lesson works identically either way. Working through the three stored vectors against `query_vector` by hand: `doc2` (the password-reset vector) is numerically far from the query on every dimension, so it's excluded once we ask for only the top 2. Between the two refund-related vectors, `doc3`'s coordinates happen to sit marginally closer to `query_vector` than `doc1`'s do. So the top-2 result comes back ranked `doc3` first, `doc1` second:

```
[['doc3', 'doc1']]
[['Refunds are processed within 5-7 business days after approval.', 'Our refund policy allows returns within 30 days of purchase.']]
[[0.0013, 0.0015]]
```

(Exact distance numbers will vary slightly by Chroma version and internal floating-point handling — treat the printed values above as illustrative of the *shape and ordering*, not a guaranteed byte-for-byte output.) Notice the outer list in every field: `results["ids"]`, `results["documents"]`, and `results["distances"]` are each a **list of lists** — one inner list per query embedding you passed in. Since we passed exactly one query vector, each field has exactly one inner list. If you queried with three question embeddings at once, you'd get three inner lists back, one ranked result set per question. This "list of lists" shape is the single most important structural fact to internalize about Chroma's `query()` — miss it, and code that expects `results["documents"]` to be a flat list of strings will break in a confusing way.

---

## 5. Common Mistakes

**Mistake 1: Passing an inconsistent embedding function between indexing and querying.** If you add documents by letting Chroma compute embeddings automatically (passing `documents=[...]` without `embeddings=[...]`, relying on a collection's configured embedding function), you must query with `query_texts=[...]` using that *same* embedding function — not hand-roll a different embedding model and pass raw vectors via `query_embeddings`. Two different embedding models produce vectors in different, incompatible geometric spaces; comparing a vector from model A against vectors from model B produces meaningless distances, even though no error is raised. The fix is discipline: decide once whether you're supplying your own embeddings everywhere (as in Section 4's example) or letting Chroma's embedding function handle both indexing and querying everywhere, and never mix the two approaches within one collection.

**Mistake 2: Not setting a persistent path and losing data on restart.** `chromadb.Client()` (or the default in some Chroma versions) creates an **in-memory-only** client — perfectly fine for a quick experiment in a single script run, but every bit of data disappears the moment the Python process ends. It's an easy trap: your script "works" in one run, you restart your terminal or rerun the script expecting your data to still be there, and the collection is empty. If you want data to survive across runs, use `chromadb.PersistentClient(path="./some/directory")` explicitly, as in Section 4.

**Interview angle:** A common practical Chroma question is "you indexed documents but your queries return nothing relevant — what would you check first?" A strong answer checks, in order: (1) is the query using the same embedding approach (same model, same dimensionality) as indexing did; (2) is the client actually pointed at the collection you populated, or did a fresh in-memory client silently start empty; (3) are the embedding vectors the right length and not accidentally all zeros or identical. This mirrors the general RAG debugging instinct from Phase 1 — separate "retrieval found the wrong thing" from "the data was never really there."

---

## 6. Hands-On Exercises

### Exercise 1 — Index and query your own three sentences

**Goal:** Get the full add → query loop running on your own machine.

Install Chroma (`pip install chromadb`), then adapt Section 4's example with three sentences of your own choosing (they don't need to be about the same topic) and small hand-picked embedding vectors of your own design — make two of the three "close" to each other and one clearly "far," then confirm `collection.query()` returns the two close ones ranked ahead of the far one.

### Exercise 2 — Break it on purpose: in-memory vs. persistent

**Goal:** Directly experience Mistake 2 from Section 5.

Run a script that uses `chromadb.Client()` (in-memory), adds a document, and prints `collection.count()`. Then run the script a second time and observe that the collection is empty again. Now change the client to `chromadb.PersistentClient(path="./my_chroma_data")`, repeat the two runs, and confirm the count persists the second time.

### Exercise 3 — Inspect the shape of query results

**Goal:** Cement the "list of lists" structure from Section 4.

Using your collection from Exercise 1, call `collection.query(query_embeddings=[vec_a, vec_b], n_results=1)` with two different query vectors at once, and print `len(results["ids"])` and `len(results["ids"][0])`. Confirm the outer length equals the number of query vectors you passed (2) and each inner list's length equals `n_results` (1).

---

## 7. Interview Q&A

### Q1. What's the difference between `create_collection` and `get_or_create_collection`?

**Answer:** `create_collection` raises an error if a collection with that name already exists. `get_or_create_collection` returns the existing collection if one exists, or creates a new one if it doesn't — which is almost always what you want during iterative development, since it lets you re-run a script without manually deleting the old collection first.

---

### Q2. What arguments does `collection.add()` typically take, and which are required?

**Answer:** `ids` (required — a unique string per item), and then some combination of `embeddings`, `documents`, and `metadatas`. You need either `embeddings` (vectors you computed yourself) or `documents` combined with a configured embedding function so Chroma can compute the embeddings for you; `metadatas` is optional but commonly used to store filterable attributes like source file or category.

---

### Q3. What does `collection.query()` return, structurally?

**Answer:** A dictionary whose relevant fields — `ids`, `documents`, `metadatas`, `distances` — are each a list of lists: one inner list per query embedding you passed in, containing that query's top `n_results` matches ranked by distance (smaller distance means closer, by default). If you pass a single query vector, every field has exactly one inner list.

---

### Q4. Why would data disappear when you restart your Python script using Chroma?

**Answer:** Because the script used an in-memory-only client (e.g., `chromadb.Client()` in many configurations) rather than a persistent one. In-memory clients never write to disk, so all collections and their contents are lost the instant the process exits. Using `chromadb.PersistentClient(path=...)` instead writes data to disk at that path, so it's still there the next time the client is created pointing at the same path.

---

### Q5. Why is it dangerous to query with a different embedding model than the one used to index?

**Answer:** Because different embedding models place text in different, incompatible vector spaces — the numbers aren't comparable across models even if they have the same dimensionality. Querying with mismatched embeddings won't raise an error; it will silently return meaningless, effectively random-looking "closest" results, which is a much harder bug to catch than a crash.

---

> 🧠 **Memory hook:** "Chroma is the notebook you can scribble in right now — client, collection, add, query, and your ideas are already searchable."
