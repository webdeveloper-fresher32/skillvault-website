# 03 — Parent-Document Retrieval and Choosing Chunk Size

> Getting precise matching and full context at the same time, and a practical guide for picking chunk size instead of guessing.

---

## Table of Contents

1. [The Problem: Small Chunks vs Large Chunks](#1-the-problem-small-chunks-vs-large-chunks)
2. [The Analogy: The Index Card and the Whole Page](#2-the-analogy-the-index-card-and-the-whole-page)
3. [Parent-Document Retrieval: Internal Flow](#3-parent-document-retrieval-internal-flow)
4. [Code Example: Child-to-Parent Chunk Mapping](#4-code-example-child-to-parent-chunk-mapping)
5. [Decision Guide: Choosing Chunk Size and Overlap](#5-decision-guide-choosing-chunk-size-and-overlap)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Small Chunks vs Large Chunks

Across the last two lessons, one tension has kept resurfacing under different names: small chunks match queries precisely but lack surrounding context; large chunks carry plenty of context but dilute relevance and hurt precise matching. Sentence-window retrieval (Lesson 2) solved this at the sentence level, but the same tradeoff exists one level up, at the scale of full sections or documents:

- A **small chunk** — a paragraph, or a few sentences — embeds sharply and matches a specific query very precisely. But handed alone to the LLM, it might lack the surrounding explanation the LLM needs to actually use it correctly. A chunk that says *"This does not apply if the item was purchased during a promotional period"* is useless without the paragraph above it explaining what "this" refers to.

- A **large chunk** — an entire section or document — carries all the context an LLM could want. But its embedding is now an average over everything in it, so a query about one narrow detail inside that section competes, in similarity space, with every other unrelated detail also averaged into that same chunk's embedding. Precision drops, and truly relevant large chunks can rank below smaller, more precisely-matching (but context-poor) chunks from elsewhere.

So the core question this lesson answers: **how do you get the matching precision of a small chunk and the contextual completeness of a large chunk, at the same time, without picking one and sacrificing the other?**

---

## 2. The Analogy: The Index Card and the Whole Page

**Real-world analogy:** imagine looking something up in a well-indexed reference book.

You don't search the book by skimming every full page — that's slow and the exact sentence you need would be buried in surrounding text that doesn't help you find it. Instead, the book's index has a short, precise entry: *"refund eligibility, p. 42."* You search the index (short, sharp, easy to match against exactly what you're looking for), and it points you to page 42 — but the index doesn't hand you just that one line; **it hands you the whole page**, so once you've found the right spot, you get the full surrounding explanation, not just the isolated sentence the index entry pointed at.

Parent-document retrieval works exactly this way: you match against a small, precise "index card" (a child chunk), but what actually gets handed to the LLM is the larger "page" (the parent document or section) that child chunk came from. The searching stays precise; the payload stays complete.

> 🧠 Reach for this analogy whenever explaining parent-document retrieval: *"Search the index card, but read the whole page."*

---

## 3. Parent-Document Retrieval: Internal Flow

The mechanics, step by step:

1. **Split each document into small child chunks** — using recursive splitting (Lesson 1) or any strategy from this phase, sized for precise matching (small, specific, sharply embeddable).
2. **Also keep, for each document, a larger "parent" unit** — this might be the full original document, or a larger section-level chunk one tier up from the children (e.g. children are paragraphs, the parent is the whole page or chapter they came from).
3. **Embed only the child chunks** and store those embeddings in the vector database (Phases 5-7) — the parent text itself does not need to be embedded, since it's never directly matched against a query.
4. **Store a mapping from each child chunk's ID to its parent's full text** — typically in a plain key-value store or document store alongside the vector database, since this is a simple lookup, not a similarity search.
5. **At query time**, embed the user's query and run similarity search against the child chunk embeddings as usual — this is where precision comes from, since child chunks are small and specific.
6. **Once the best-matching child chunk IDs come back, look up their parent text** using the child-to-parent mapping, and hand *that* (the larger parent context) to the LLM instead of the tiny child chunk that was actually matched.

The elegant part: the expensive, precision-sensitive operation (similarity search) only ever touches the small, sharp child chunks. The "give me full context" step is a cheap dictionary lookup, not a second similarity search — it doesn't need to be, because you already know exactly which parent you want once you know which child matched.

---

## 4. Code Example: Child-to-Parent Chunk Mapping

A minimal, illustrative version — no real vector database involved, just the child-to-parent bookkeeping and a toy retrieval function so the mechanism is visible end to end:

```python
# --- setup: a small "document store" of parent documents ---
parent_documents = {
    "doc_1": (
        "Section: Refund Policy. Our refund policy allows returns within 30 days "
        "of purchase. Items must be unworn, unwashed, and in original packaging "
        "with tags attached. This does not apply if the item was purchased "
        "during a promotional clearance period, in which case all sales are final."
    ),
    "doc_2": (
        "Section: Shipping. Domestic orders ship within 5 business days. "
        "International shipments take 7-14 business days depending on customs "
        "processing at the destination country."
    ),
}

# --- child chunks, each tagged with which parent document it came from ---
child_chunks = [
    {"id": "c1", "parent_id": "doc_1", "text": "Refunds allowed within 30 days of purchase."},
    {"id": "c2", "parent_id": "doc_1", "text": "Clearance items purchased on promotion are final sale."},
    {"id": "c3", "parent_id": "doc_2", "text": "International shipping takes 7-14 business days."},
]

# --- fake embeddings (in a real system these come from an embedding model, Phase 2,
#     and matching happens via a vector database, Phases 5-7) ---
fake_similarity_scores = {
    "c1": 0.91,
    "c2": 0.40,
    "c3": 0.22,
}

def retrieve_with_parent(query_similarity_scores: dict, child_chunks: list, parents: dict, top_k: int = 1):
    """Find the best-matching child chunk(s), then return their PARENT document text,
    not the child chunk text itself."""
    ranked = sorted(child_chunks, key=lambda c: query_similarity_scores[c["id"]], reverse=True)
    top_children = ranked[:top_k]

    results = []
    for child in top_children:
        parent_text = parents[child["parent_id"]]
        results.append({"matched_child": child["text"], "returned_context": parent_text})
    return results

query = "Can I get a refund if I bought something two weeks ago?"
results = retrieve_with_parent(fake_similarity_scores, child_chunks, parent_documents, top_k=1)

for r in results:
    print("Matched on (small, precise):", r["matched_child"])
    print("\nReturned to the LLM (full parent context):\n", r["returned_context"])
```

Notice the function matches on `c1` — the small, sharp chunk that says exactly "refunds allowed within 30 days" — but what actually gets returned for the LLM to read is the *entire parent section*, including the promotional-clearance exception that the matched child chunk alone never mentioned. Without parent-document retrieval, the LLM would have answered from `c1` alone and missed that important exception entirely.

---

## 5. Decision Guide: Choosing Chunk Size and Overlap

There is no single correct chunk size — it depends on the document type and what the retrieved chunk needs to do once it reaches the LLM. Use this as a starting point, then validate against your own evaluation data (Phase 11).

| Document type | Typical chunk size | Overlap | Strategy notes |
|---|---|---|---|
| Short FAQ / Q&A pairs | Whole Q&A pair as one chunk (often 50-150 tokens) | Little to none needed | Each Q&A pair is already a self-contained unit — don't split a question from its answer |
| Long technical manual / policy document | 200-500 tokens per chunk | 10-20% of chunk size | Recursive splitting (Lesson 1) as a baseline; consider parent-document retrieval so exceptions/caveats in surrounding text aren't lost |
| Narrative / prose (articles, reports) | 300-500 tokens per chunk | 10-20% of chunk size | Recursive or semantic chunking (Lesson 2) both work well; semantic chunking pays off more here since topic shifts are common and often unmarked |
| Source code | Function- or class-level chunks, not fixed character counts | None, or only at natural boundaries (e.g. imports) | Chunk along code structure (functions, classes) rather than character count — a function split mid-body is far more damaging than a paragraph split mid-sentence |
| Legal / contract clauses | Clause-level chunks (often small) | None between clauses; consider parent-document retrieval to surface the whole section | Precision matters enormously; small chunks for matching, parent lookup for full clause context |

The general pattern across all of these: **the "right" chunk size is a function of what a human would need to read to fully understand and act on one retrieved piece — not an arbitrary token budget picked in isolation.** If a human expert would need to see the surrounding paragraph to correctly answer a question from one sentence, your RAG system needs that too, which is exactly the case parent-document retrieval and sentence-window retrieval exist to cover.

---

## 6. Common Mistakes

**Mistake 1: One chunk-size-fits-all across very different document types.** Applying the same 500-token, fixed-overlap recipe to a collection that mixes short FAQ entries, long technical manuals, and source code produces bad results in at least one of those categories every time. A FAQ entry chunked at 500 tokens might span several unrelated Q&A pairs; a function chunked at a fixed character count gets split mid-body regardless of code structure. Chunking strategy should be chosen per document type within a mixed corpus, not applied uniformly.

**Mistake 2: Using parent-document retrieval everywhere "just in case."** Parent-document retrieval adds real complexity — a separate document store, a child-to-parent mapping to maintain, and larger payloads sent to the LLM on every retrieval. For document types where the small chunk is already fully self-contained (a well-written FAQ pair, a short clause with no cross-references), the added complexity buys nothing. Reach for it specifically when you've observed retrieved chunks losing necessary context that lives just outside chunk boundaries — not as a default for every corpus.

**Mistake 3: Never validating chunk size choices against real queries.** Picking chunk size and overlap from a blog post's rule of thumb and never revisiting it is a common shortcut that quietly caps retrieval quality. The decision guide above is a starting point, not a final answer — Phase 11 (Evaluation & Observability) covers how to measure whether your actual chunking choices are helping or hurting retrieval on your specific documents and query patterns.

---

## 7. Hands-On Exercises

### Exercise 1 — Extend the parent-document mapping

Add a third parent document and two more child chunks (one belonging to the new parent, one belonging to `doc_2`) to the code in Section 4. Update `fake_similarity_scores` so the new child chunk wins for a new sample query, then run `retrieve_with_parent` and confirm it returns the correct new parent's full text.

### Exercise 2 — Apply the decision guide to your own documents

Pick two real document types you have access to (e.g. your own notes, a project's README, a set of support tickets). For each, use the decision guide table to choose a chunk size, overlap, and strategy, and write one sentence justifying each choice based on what a human reader would need to see to answer a question from one chunk.

### Exercise 3 — Simulate the "lost exception" failure

Using only `child_chunks` (not the parent lookup) from Section 4's code, write a small function that answers a query using *only* the matched child chunk's text (no parent lookup). Run it for the refund query and note that it misses the promotional-clearance exception. Then compare against `retrieve_with_parent`'s output and write one sentence on what could go wrong if an LLM answered a real user using only the child chunk.

---

## 8. Interview Q&A

### Q1. What problem does parent-document retrieval solve?

**Answer:** It resolves the tradeoff between small chunks (precise matching, but lacking surrounding context) and large chunks (rich context, but diluted matching precision) by decoupling the two: small child chunks are embedded and matched against queries for precision, but the larger parent document or section they belong to is what actually gets returned to the LLM, providing full context without sacrificing match quality.

### Q2. How is parent-document retrieval different from sentence-window retrieval?

**Answer:** They solve the same class of problem at different granularities using the same core idea — match small, return larger. Sentence-window retrieval operates at the sentence level, returning a small window of neighboring sentences. Parent-document retrieval operates at a coarser level, returning an entire parent section or document that a matched child chunk belongs to. Parent-document retrieval is typically used when the necessary context spans more than a few neighboring sentences — for example, an entire policy section with caveats scattered throughout it.

### Q3. Why is the parent lookup step a simple dictionary lookup rather than another similarity search?

**Answer:** Because by the time you need the parent, you already know exactly which child chunk matched, and the child-to-parent relationship is fixed and known in advance from indexing time — it isn't something that needs to be searched for based on similarity. Only the initial match (query against child chunks) benefits from similarity search; retrieving the corresponding parent is a deterministic, direct lookup.

### Q4. How would you choose chunk size differently for source code versus prose?

**Answer:** Prose can reasonably be chunked by a token/character budget with recursive or semantic splitting, since paragraph and sentence boundaries carry real meaning. Source code should instead be chunked along structural boundaries — function or class definitions — because splitting a function's body at an arbitrary character count is far more damaging than splitting prose at a slightly awkward sentence boundary; a partial function is often meaningless on its own regardless of how it's presented to the LLM.

### Q5. Why is "one chunk-size-fits-all" a mistake in a real, mixed document collection?

**Answer:** Because different document types have very different natural units of meaning — a Q&A pair, a code function, a legal clause, a long narrative paragraph — and a single fixed chunk size will be wrong for at least one of them: too large for short self-contained units (mixing multiple unrelated units into one chunk) or too small/structurally blind for units like code that need to be split along logical, not character-count, boundaries. Chunking strategy should be selected per document type within a mixed corpus.

---

> 🧠 **Memory hook:** "Search the index card, read the whole page — match small, return large, and never use the same ruler on a FAQ and a legal contract."
