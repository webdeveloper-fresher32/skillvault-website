# 02 — Security and PII Considerations

> A comprehensive reference covering why RAG systems need server-side access control rather than client-trusted filters, PII redaction before indexing, and audit logging of retrieved content.

---

## Table of Contents

1. [The Problem: Indexing Sensitive Data at Scale](#1-the-problem-indexing-sensitive-data-at-scale)
2. [The Analogy: The Library That Checks Your Card Before Every Book, Not Just the Front Door](#2-the-analogy-the-library-that-checks-your-card-before-every-book-not-just-the-front-door)
3. [Internal Flow: The Layers of Enforcement](#3-internal-flow-the-layers-of-enforcement)
4. [Code Example: A Server-Side-Enforced Retrieval Wrapper](#4-code-example-a-server-side-enforced-retrieval-wrapper)
5. [Comparing Enforcement Points](#5-comparing-enforcement-points)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Indexing Sensitive Data at Scale

Most real-world RAG systems don't index public web pages — they index a company's internal wiki, support tickets, contracts, HR documents, or customer records. That's exactly what makes RAG valuable (Phase 1's whole premise is answering from *private* data an LLM was never trained on) and exactly what makes it dangerous if built carelessly.

Two distinct risks show up here, and it's worth naming them separately. The first is **cross-user or cross-tenant leakage**: a shared vector index searched purely by semantic similarity, with no access boundary, can happily return Customer A's private ticket in response to Customer B's semantically similar question — Phase 6's metadata-filtering lesson already flagged this exact scenario. The second is **PII exposure in generated answers**: even within a single user's own permitted data, if raw documents containing names, emails, SSNs, or medical details were indexed unredacted, the LLM can echo that sensitive text straight back out in a generated answer, potentially to someone who shouldn't see it, or into a log file, or into a downstream system that wasn't built to handle sensitive data.

The concrete problem this lesson solves: **how do you make sure a RAG system only ever retrieves what a given user is authorized to see, and never exposes PII it shouldn't, even when a client-side bug or a malicious request tries to make it do otherwise?**

---

## 2. The Analogy: The Library That Checks Your Card Before Every Book, Not Just the Front Door

**Real-world analogy:** imagine a research library with a strict front desk — you show your library card to get in the building. Once you're inside, though, is that the only check that ever happens?

A poorly run library checks your card once, at the door, and then lets you wander freely into every room, including the restricted archive with sealed personnel files, because "you already showed your card to get in." A well-run library checks your card again — implicitly, every time — at the point where it actually matters: the archivist fetching a specific restricted document verifies your access level for *that specific document* before handing it over, regardless of the fact that you were already let in the front door.

**RAG systems make the exact same mistake as the poorly run library when they check permissions only at the API gateway (the front door) and then trust that any document the retrieval step finds is fine to return.** The equivalent of "checking your card only at the document, not just the door" is enforcing an access filter at the moment of retrieval itself — every single time, for every single query, regardless of what already happened upstream, and regardless of what the client claims it's allowed to see.

> 🧠 Reach for this analogy whenever you need the one-line version: *"Check the card at the archive shelf, not just at the front door."*

---

## 3. Internal Flow: The Layers of Enforcement

A production-grade secure RAG pipeline layers several distinct mechanisms — no single one of them is sufficient on its own.

**Server-side metadata filtering, enforced regardless of client input.** Phases 6 and 7 covered how to attach a `user_id` (or tenant, or permission-level) metadata filter to a vector-database query so that only vectors matching that filter are even eligible to be returned. The critical detail this lesson adds: that filter must be constructed and injected by server-side code that already knows who the authenticated caller is — never accepted as a value the client sends in the request body. A client sending `{"user_id": "123"}` in its request is a claim, not a fact; a server that blindly trusts it has no real access control at all, just an honor system.

**PII scrubbing/redaction before indexing.** Rather than relying entirely on access control to prevent PII from ever surfacing, a defense-in-depth approach also reduces how much sensitive raw text ever enters the index in the first place — during Phase 3's document-loading and preprocessing step, a redaction pass can detect and mask patterns like emails, phone numbers, or government ID numbers before chunks are embedded and stored, so that even a permitted, correctly-scoped retrieval doesn't hand raw PII to the LLM (and, from there, potentially into a generated answer) unless it's genuinely needed.

**Access control checks before returning retrieved content.** Metadata filtering narrows what the vector database is even allowed to return, but an additional application-level check — verifying the retrieved documents' permissions against the current user's role right before they're inserted into the prompt — adds a second, independent line of defense in case the filter itself was misconfigured or a document's metadata was stale.

**Audit logging of what was retrieved for whom.** Every retrieval should be logged: which user (or service) made the query, which document chunks were returned, and when. This doesn't prevent a leak by itself, but it's what makes a leak *detectable and investigable* after the fact — without it, a cross-tenant leak could go unnoticed indefinitely, and there'd be no way to answer "which of Customer B's documents did Customer A actually see."

```
   Query + authenticated user identity (from auth middleware, NOT from the request body)
        │
        ▼
   ┌───────────────────────────────────────────┐
   │ Server injects user_id / tenant filter      │  ← Phases 6/7 filter syntax,
   │ into the retrieval call itself               │    built server-side only
   └───────────────────────────────────────────┘
        │
        ▼
   ┌───────────────────────────────────────────┐
   │ Vector DB returns only matching-filter       │
   │ chunks (chunks were redacted of PII          │  ← redaction happened back
   │ before they were ever indexed)                │    in Phase 3, at ingestion
   └───────────────────────────────────────────┘
        │
        ▼
   ┌───────────────────────────────────────────┐
   │ Application-level permission re-check         │
   │ on retrieved chunks (defense in depth)        │
   └───────────────────────────────────────────┘
        │
        ▼
   ┌───────────────────────────────────────────┐
   │ Audit log: user, query, chunks returned,      │
   │ timestamp                                     │
   └───────────────────────────────────────────┘
        │
        ▼
   Augment + generate (Phases 1, 10)
```

---

## 4. Code Example: A Server-Side-Enforced Retrieval Wrapper

This example builds directly on Phase 6's Pinecone metadata filter syntax (`{"$and": [{"user_id": {"$eq": "123"}}, ...]}`). The key idea: the wrapper function is the *only* code path allowed to call the vector database, and it always constructs the `user_id` filter itself from a trusted, server-side value — never from whatever the client's request happened to contain.

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_API_KEY")
index = pc.Index("rag-course-demo")


def secure_retrieve(
    query_vector: list[float],
    authenticated_user_id: str,
    top_k: int = 5,
    client_requested_filter: dict | None = None,
) -> list[dict]:
    """Retrieve chunks for `authenticated_user_id` only. `authenticated_user_id`
    must come from server-side auth (e.g. a verified session/token), never
    from the request body -- that's the whole point of this wrapper.

    `client_requested_filter` represents whatever extra filter conditions a
    client might ask for (e.g. "only documents tagged 'faq'"). We allow those
    to narrow the search further, but we NEVER let them replace or override
    the user_id filter -- that part is always injected by the server.
    """
    # Start from the non-negotiable, server-controlled filter.
    enforced_filter = {"user_id": {"$eq": authenticated_user_id}}

    if client_requested_filter:
        # `or` here provides a default: if client_requested_filter's own
        # "$and" key is missing/falsy, fall back to an empty list.
        extra_conditions = client_requested_filter.get("$and") or [client_requested_filter]
        combined_filter = {"$and": [enforced_filter] + extra_conditions}
    else:
        combined_filter = enforced_filter

    response = index.query(
        vector=query_vector,
        top_k=top_k,
        filter=combined_filter,
        include_metadata=True,
    )

    # Audit log: record who asked for what, and what came back -- this is
    # what makes a future leak investigable rather than invisible.
    audit_log_retrieval(
        user_id=authenticated_user_id,
        returned_chunk_ids=[match.id for match in response.matches],
    )

    return [{"id": m.id, "score": m.score, "metadata": m.metadata} for m in response.matches]


def audit_log_retrieval(user_id: str, returned_chunk_ids: list[str]) -> None:
    """Stand-in for a real audit log write (e.g. to a structured log store).
    In production this should be append-only and queryable, so "what did
    user X see, and when" can always be answered after the fact."""
    print(f"[audit] user={user_id} retrieved_chunks={returned_chunk_ids}")
```

Notice what `secure_retrieve` deliberately does *not* do: it never accepts a `user_id` as part of `client_requested_filter` that could override `enforced_filter`. Even if a compromised or buggy client sent `{"user_id": {"$eq": "someone-elses-id"}}`, the combined filter always `$and`s the server's own `enforced_filter` in first, so the client-supplied `user_id` condition (if it somehow got through) could only ever narrow results *further* within the authenticated user's own data — it could never widen access to someone else's.

---

## 5. Comparing Enforcement Points

| Layer | What it protects against | Where it lives |
|---|---|---|
| **Server-side metadata filter** | Cross-user/cross-tenant leakage via semantic search | Retrieval call itself (Phases 6/7 filter syntax) |
| **PII redaction at ingestion** | PII surfacing in generated answers, even for permitted data | Document-loading/preprocessing step (Phase 3) |
| **Application-level permission re-check** | Stale or misconfigured metadata slipping through the filter | Just after retrieval, before augmenting the prompt |
| **Audit logging** | Undetected leaks going unnoticed indefinitely | Every retrieval call, regardless of outcome |

---

## 6. Common Mistakes

**Mistake 1: Trusting client-supplied filters without server-side enforcement.**

If an API endpoint accepts a `user_id` (or any access-scoping field) directly from the request body or query parameters and passes it straight into the vector-database filter, it's trusting the client to tell the truth about who it is. A malicious or simply buggy client (a mobile app with a stale cached session, a misconfigured internal service) can send any `user_id` it wants, and the retrieval will happily return that user's private data to whoever asked. The fix demonstrated in Section 4: the server derives the identity value from its own authenticated session/token, constructs the filter itself, and never lets a client-supplied value substitute for or override it.

**Mistake 2: Indexing raw documents containing PII without a redaction step.**

It's tempting to index documents exactly as they arrive — support tickets, contracts, HR records — because that's the fastest path to a working prototype. But if those documents contain names, emails, phone numbers, or ID numbers in raw form, that PII is now sitting in your vector store's stored text, fully retrievable, and will be handed straight to the LLM (and potentially echoed into a generated answer, a log line, or a downstream analytics pipeline) the moment a relevant query comes in. Skipping redaction at ingestion time doesn't just risk a leak — it guarantees the PII is present and retrievable the instant access control has any gap at all.

**Interview angle:** "How would you prevent one tenant's data from leaking into another tenant's RAG answers in a shared multi-tenant system?" is a standard systems-design security question. The strong answer names the specific mechanism — server-side-enforced metadata filtering that the client cannot override, ideally combined with namespace-level isolation (Phase 6) for coarse separation — rather than a vague answer like "we'd add authentication," which doesn't actually address how retrieval itself stays scoped once a request is authenticated.

---

## 7. Hands-On Exercises

### Exercise 1 — Try to break `secure_retrieve` with a spoofed filter

**Goal:** Confirm the wrapper in Section 4 actually resists a client trying to widen its own access.

Call `secure_retrieve` with a legitimate `authenticated_user_id` but pass a `client_requested_filter` that tries to set `user_id` to a different value (e.g. `{"user_id": {"$eq": "someone-else"}}`). Trace through the `combined_filter` construction by hand (or add a `print(combined_filter)` line) and confirm the `$and` structure means the server's own `enforced_filter` still applies — the spoofed `user_id` condition can only narrow results within the authenticated user's own data, never replace the enforced condition.

### Exercise 2 — Add a simple PII redaction pass

**Goal:** Write a small function `redact_pii(text: str) -> str` that uses regular expressions to mask obvious patterns — an email address, a US-style phone number — before that text is embedded and indexed. Run it on a sample document containing a fake email and phone number and confirm the redacted version no longer contains them verbatim.

### Exercise 3 — Design an audit log query

**Goal:** Using the `audit_log_retrieval` calls from Section 4 as your data source, sketch (in plain English or pseudocode) how you'd answer the question "which chunks did user X retrieve in the last 24 hours?" and "was any chunk belonging to tenant A ever returned to a query authenticated as tenant B?" — the second question is exactly what a real audit log needs to make answerable after an incident.

---

## 8. Interview Q&A

### Q1. Why isn't authentication at the API gateway enough to secure a RAG system?

**Answer:** Authentication confirms *who* is making a request, but it says nothing about whether the retrieval step itself is scoped to only that user's authorized data. Without a server-side-enforced filter at the point of retrieval, an authenticated-but-otherwise-unrestricted query can still search the entire shared vector index by similarity alone and return another user's or tenant's documents just because they're semantically relevant.

### Q2. What's wrong with accepting a `user_id` filter value directly from the client's request?

**Answer:** It trusts the client to accurately report its own identity/scope, which is a claim rather than a verified fact. A buggy or malicious client can send any value it wants, and if that value is passed straight into the retrieval filter, the system will return whatever data matches it — including another user's private data. The filter's identity value must be derived server-side from an authenticated session, not accepted as client input.

### Q3. Why redact PII before indexing rather than relying solely on access control?

**Answer:** Defense in depth — access control can have gaps (a misconfigured filter, a stale permission, an application bug), and once a gap lets a request through, whatever raw text is stored in the index is what gets exposed. Redacting PII at ingestion time means that even if access control fails, there's less sensitive raw text sitting in the index to leak in the first place.

### Q4. What does audit logging add if metadata filtering and redaction are already in place?

**Answer:** Detectability. Filtering and redaction reduce the chance and severity of a leak, but they don't guarantee one never happens (misconfigurations occur). Audit logging of what was retrieved for whom means a leak can actually be discovered and investigated after the fact — without it, a cross-tenant leak could occur repeatedly with no way to know it happened or assess its scope.

### Q5. How does the security filter wrapper in this lesson relate to the metadata filtering covered in Phases 6 and 7?

**Answer:** It reuses the exact same filter syntax and mechanism (dict-based, MongoDB-style operators like `$eq` and `$and`) but adds one critical constraint: the `user_id`/tenant portion of the filter must always be constructed server-side from a verified identity, and any additional client-requested filter conditions can only narrow results further within that enforced scope — never replace or widen it.

---

> 🧠 **Memory hook:** "Check the card at the archive shelf, not just the front door — and never let the visitor tell you which card they're holding."
