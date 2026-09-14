# 01 — What is RAG?

> A comprehensive reference covering the problem RAG solves, the four-stage RAG flow, a worked conceptual example, and the misconceptions that trip up beginners.

---

## Table of Contents

1. [The Problem: Why LLMs Aren't Enough](#1-the-problem-why-llms-arent-enough)
2. [The Analogy: Open-Book vs Closed-Book Exam](#2-the-analogy-open-book-vs-closed-book-exam)
3. [What RAG Actually Is](#3-what-rag-actually-is)
4. [The Four-Stage Flow](#4-the-four-stage-flow)
5. [A Minimal End-to-End Example](#5-a-minimal-end-to-end-example)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Why LLMs Aren't Enough

Let's start with the pain, not the acronym.

You ask a large language model (LLM) a question. It answers confidently, fluently, and in complete sentences. The only issue: the answer is wrong, or out of date, or about a document the model has never seen. This isn't a bug you can patch — it's a structural consequence of how LLMs are built, and it shows up in three distinct ways.

**1.1 Hallucination.** An LLM is a next-token predictor trained to produce plausible-sounding text. When it doesn't actually know something, it doesn't say "I don't know" by default — it produces the *most statistically likely* continuation, which can be a completely fabricated fact stated with total confidence. Ask an LLM for a niche legal citation or an obscure API method signature, and it may invent one that sounds exactly right and doesn't exist.

**1.2 Knowledge cutoff.** Every LLM is trained on a snapshot of data up to some date. Anything that happened after that date — a new product launch, a policy change, this morning's stock price — is simply not in its weights. The model isn't "unaware" of this in any way it can detect; it just answers from what it has, even if what it has is stale.

**1.3 No access to private or proprietary data.** An LLM's training data is (broadly) public internet text, books, and code. It has never seen your company's internal wiki, your product's support tickets, your codebase, or last week's meeting notes — because that data was never public and never part of training. No amount of clever prompting fixes this; the information simply isn't in the model.

Put these three together and you get the core problem RAG was invented to solve: **how do you get an LLM to answer questions using information it wasn't trained on — information that's current, private, or both — without retraining the model itself?**

---

## 2. The Analogy: Open-Book vs Closed-Book Exam

**Real-world analogy:** imagine two students taking the same history exam.

Student A studied for months and is answering purely from memory — a **closed-book exam**. If a question falls outside what they memorized, or if a fact has been updated since they studied, they either guess (confidently, and sometimes wrong) or leave it blank.

Student B walks in with a stack of textbooks, their notes, and a index card system for finding the right page fast — an **open-book exam**. When a question comes up, Student B doesn't just wing it: they quickly find the *relevant page*, read the specific passage that answers the question, and then write their answer using both what they already know and what's on that page.

A base LLM, unaided, is Student A: answering purely from what got baked into its weights during training. **RAG turns the LLM into Student B.** Instead of relying solely on memorized knowledge, the model is handed the relevant passage right before it answers — retrieved on the fly from a much larger, up-to-date, possibly private collection of documents it never had to memorize in the first place.

> 🧠 This analogy is the one to reach for whenever you need to explain RAG to a non-technical audience in one sentence: *"We give the model an open book instead of asking it to memorize everything."*

---

## 3. What RAG Actually Is

**RAG** stands for **Retrieval-Augmented Generation**. Peel apart the three words and you get the whole idea:

- **Retrieval** — given a question, find the small set of documents (or document snippets) most relevant to answering it, out of a much larger collection.
- **Augmented** — take those retrieved snippets and insert them into the prompt sent to the LLM, augmenting what the model has to work with beyond its own training data.
- **Generation** — the LLM then generates its answer the normal way, except now its context window contains the specific facts it needs, right in front of it.

So the one-line definition: **RAG is a technique where you retrieve relevant information from an external knowledge source and insert it into the LLM's prompt, so the model can generate an answer grounded in that information rather than purely from what it memorized during training.**

Notice what RAG does *not* do: it does not change the model's weights, it does not require retraining, and it does not require the model to have ever seen your data before. The knowledge lives outside the model, in a document store, and gets pulled in fresh at question time.

---

## 4. The Four-Stage Flow

Every RAG system, no matter how sophisticated, boils down to four stages. Two of them happen once, ahead of time; two of them happen every time a user asks a question.

```
                    ONE-TIME (ahead of time)              EVERY QUERY (at question time)
                 ┌───────────────────────────┐        ┌────────────────────────────────────┐
                 │                           │        │                                    │
   Documents ──▶ │   1. INDEX                │        │   2. RETRIEVE                       │
   (PDFs,         │   Break docs into chunks, │        │   Find the chunks most relevant     │
    wiki pages,    │   convert each chunk to  │        │   to the user's question            │
    tickets, ...)  │   a vector, store it      │        │            │                        │
                 │                           │        │            ▼                        │
                 └───────────────────────────┘        │   3. AUGMENT                        │
                                                        │   Insert those chunks into the       │
                                                        │   prompt alongside the question      │
                                                        │            │                        │
                                                        │            ▼                        │
                                                        │   4. GENERATE                       │
                                                        │   LLM produces an answer grounded    │
                                                        │   in the retrieved chunks            │
                                                        │                                    │
                                                        └────────────────────────────────────┘
```

Walking through each stage in plain language:

**Stage 1 — Index (happens once, or whenever your documents change).** You take your entire knowledge source — product docs, PDFs, a wiki, support tickets, whatever — and break it into smaller pieces (chunks). Each chunk gets converted into a vector (a list of numbers that captures its meaning — much more on this in Phase 2) and stored in a vector database alongside the original text.

**Stage 2 — Retrieve (happens per query).** When a user asks a question, that question also gets converted into a vector the same way. The system then searches the vector database for the chunks whose vectors are most similar to the question's vector — in other words, the chunks that are *about the same thing* as the question.

**Stage 3 — Augment (happens per query).** The retrieved chunks get inserted into a prompt template, typically something like: *"Using the following context, answer the question. Context: [retrieved chunks]. Question: [user's question]."* This is the "augmented" part of Retrieval-Augmented Generation — the prompt has been augmented with retrieved facts.

**Stage 4 — Generate (happens per query).** The LLM receives this augmented prompt and generates its answer as normal — except now it has the specific, relevant, possibly-private, possibly-current information sitting right in its context window, instead of having to rely on what it memorized months or years ago during training.

The genuinely important thing to internalize here: **indexing happens rarely (once, or on a schedule), while retrieve → augment → generate happens on every single user query.** This asymmetry — expensive one-time setup, cheap repeated queries — is why RAG scales well: you don't re-process your entire document collection every time someone asks a question.

---

## 5. A Minimal End-to-End Example

Let's trace one concrete query all the way through the pipeline, with no code yet — just the flow.

**Setup (indexing, done ahead of time):** Imagine a company support knowledge base with three documents:
- Doc A: "Our refund policy allows returns within 30 days of purchase, provided the item is unused."
- Doc B: "To reset your password, go to Settings → Security → Reset Password."
- Doc C: "Shipping to international addresses takes 7-14 business days."

Each of these gets chunked (in this simple example, each is small enough to be its own chunk), converted into an embedding vector, and stored in a vector database.

**Query time:** A user asks: *"Can I get my money back if I bought something two weeks ago?"*

1. **Retrieve:** The system embeds this question into a vector and compares it against the three stored vectors. Doc A's embedding is closest — despite the user never using the words "refund" or "policy," the *meaning* ("money back," "bought," "two weeks ago") is semantically close to "refund policy," "returns," "30 days." Doc A is retrieved. (This is the whole point of embeddings over exact keyword matching — more in Phase 2.)

2. **Augment:** The system builds a prompt like:

   ```
   Answer the user's question using only the context below. If the context
   doesn't contain the answer, say so.

   Context:
   "Our refund policy allows returns within 30 days of purchase, provided
   the item is unused."

   Question: Can I get my money back if I bought something two weeks ago?
   ```

3. **Generate:** The LLM reads this prompt and answers something like: *"Yes — since your purchase was two weeks ago, you're within the 30-day window, so you're eligible for a refund as long as the item is unused."*

Notice the model never had "our refund policy" baked into its training data. It answered correctly because the *right document was handed to it at the right time* — that's RAG, end to end.

---

## 6. Common Misconceptions

**Misconception 1: "RAG is a database."**

RAG is not a product, a database, or a single piece of software you install — it's a **technique** (a pattern for combining retrieval with generation). A vector database (covered starting Phase 5) is one *component* commonly used inside a RAG system, but RAG itself is the overall approach: retrieve, then generate. You could technically build a RAG system using a plain keyword search engine instead of a vector database — it would just retrieve less accurately by meaning.

**Misconception 2: "RAG is a form of fine-tuning."**

Fine-tuning changes the model's weights through additional training. RAG changes **nothing about the model** — it changes what's in the *prompt* at inference time. This is the single most important distinction in this entire phase, and it's covered in exhaustive detail in the next lesson (`02-RAG-vs-Fine-Tuning-vs-Long-Context.md`). For now, the short version: fine-tuning teaches the model new *behavior or style* by updating its weights; RAG gives the model new *facts* by handing them over at question time. The model itself never changes.

**Misconception 3: "More retrieved context is always better."**

It's tempting to think "if a little context helps, a lot of context helps more" — dump in 20 documents just to be safe. In practice, irrelevant or excessive context can *confuse* the model, drown out the genuinely relevant passage, and burn through your context window budget (and your API costs) for no benefit. Good RAG systems retrieve a small, high-precision set of chunks — this is exactly what Phases 8 and 9 (Retrieval Strategies, Reranking & Query Transformation) are about.

**Pitfalls to watch for:**
- Assuming RAG "just works" without ever validating that the retrieval step is finding the right chunks — a wrong-but-confident retrieval produces a wrong-but-confident answer.
- Confusing "the model can search the web" (a tool-use capability) with RAG (a specific retrieve-then-generate architecture over your own document store) — they can overlap, but they're not the same thing.
- Believing RAG eliminates hallucination entirely. It dramatically reduces it by grounding answers in real text, but a model can still misread or misuse the retrieved context.

**Interview angle:** "What is RAG and why does it exist?" is one of the most common opening questions in an LLM-systems interview. Interviewers are listening for whether you can articulate the *problem* (hallucination, knowledge cutoff, no private data) before you recite the *acronym* — jumping straight to "it stands for Retrieval-Augmented Generation" without explaining why anyone needed it is a common tell that the candidate has memorized vocabulary without understanding the motivation.

---

## 7. Hands-On Exercises

These exercises use only Python — no vector database or API key required yet. The goal is to build intuition for the *shape* of the problem before Phase 2 introduces real embeddings.

### Exercise 1 — Simulate "retrieval" with keyword overlap

**Goal:** Build the crudest possible version of retrieval to feel why "meaning-based" retrieval (embeddings) will later be an upgrade, not a completely different idea.

```python
documents = [
    "Our refund policy allows returns within 30 days of purchase, provided the item is unused.",
    "To reset your password, go to Settings -> Security -> Reset Password.",
    "Shipping to international addresses takes 7-14 business days.",
]

def crude_retrieve(query: str, docs: list[str]) -> str:
    """Return the doc with the most overlapping words with the query."""
    query_words = set(query.lower().split())
    best_doc = None
    best_overlap = -1
    for doc in docs:
        doc_words = set(doc.lower().split())
        overlap = len(query_words & doc_words)  # `&` is set intersection -- the words common to both sets
        if overlap > best_overlap:
            best_overlap = overlap
            best_doc = doc
    return best_doc

query = "Can I get my money back if I bought something two weeks ago?"
print(crude_retrieve(query, documents))
```

**Run it and observe:** this crude, word-overlap-based retriever likely picks the *wrong* document (or no clear winner), because the query shares almost no literal words with Doc A ("refund," "policy," "30 days" never appear in the question). This is exactly the gap that embeddings close in Phase 2 — they compare *meaning*, not literal word overlap.

### Exercise 2 — Write the four-stage flow as four functions

**Goal:** Cement the four-stage flow by writing it as bare function stubs — no real implementation yet, just the shape of the pipeline.

```python
def index(documents: list[str]) -> list[dict]:
    """Stage 1: chunk + embed + store. Returns a list of {"text": ..., "vector": ...}."""
    # Real implementation comes in Phases 3-5. For now, fake a "vector" as a placeholder.
    return [{"text": doc, "vector": None} for doc in documents]

def retrieve(query: str, index_entries: list[dict], top_k: int = 1) -> list[str]:
    """Stage 2: find the most relevant chunk(s) for the query."""
    raise NotImplementedError("Real similarity search arrives in Phase 5+")

def augment(query: str, retrieved_chunks: list[str]) -> str:
    """Stage 3: build the final prompt."""
    context = "\n\n".join(retrieved_chunks)
    return f"Answer using only this context:\n\n{context}\n\nQuestion: {query}"

def generate(prompt: str) -> str:
    """Stage 4: call the LLM."""
    raise NotImplementedError("Real LLM call arrives later in this lesson's example")

# Try it end-to-end (retrieve/generate will raise until you implement them —
# that's the point: you can see exactly where the real work has to happen)
docs = index(["doc one text", "doc two text"])
print(augment("What is doc one about?", ["doc one text"]))
```

**Reflection question:** which stage do you think is hardest to get right in practice — retrieve, augment, or generate? (Most practitioners find *retrieve* is where the real engineering effort goes; you'll see why starting Phase 4.)

### Exercise 3 — Diagnose a broken RAG answer

**Goal:** Practice separating "the model generated badly" from "retrieval fetched the wrong thing" — the single most useful debugging skill in RAG.

Given this scenario: a user asks "What's your return policy for opened items?" and the system answers "I don't have information about that." Write down, in your own words, at least three different possible causes — some in the retrieve stage, some in the generate stage. (Example starting points: no chunk in the index actually discusses opened items specifically; the chunk exists but wasn't retrieved because of a bad similarity match; the chunk was retrieved but the prompt template didn't include it correctly; the LLM was retrieved the right chunk but is being overly cautious.)

---

## 8. Interview Q&A

### Q1. What is RAG, in one sentence?

**Answer:** RAG (Retrieval-Augmented Generation) is a technique where relevant information is retrieved from an external knowledge source at query time and inserted into the LLM's prompt, so the model generates its answer grounded in that retrieved context rather than relying solely on what it memorized during training.

---

### Q2. Why do we need RAG if LLMs are already trained on huge amounts of data?

**Answer:** Because training data has three fundamental limitations that no amount of scale fixes: it has a knowledge cutoff (nothing after training ends is known), it can't contain private or proprietary data that was never public, and models can hallucinate confidently when they don't actually know an answer. RAG solves all three by handing the model fresh, specific, possibly-private text right before it answers, instead of relying on what got baked into its weights.

---

### Q3. Is RAG a type of fine-tuning?

**Answer:** No. Fine-tuning changes the model's weights through additional training; RAG changes nothing about the model itself — it changes what's in the prompt at inference time by retrieving and inserting relevant context. RAG is often cheaper, faster to update (no retraining needed when documents change), and easier to audit (you can point to exactly which document produced an answer) — but it doesn't teach the model new skills or styles the way fine-tuning can.

---

### Q4. Walk me through the four stages of a RAG pipeline.

**Answer:** Index (one-time): documents are chunked and converted into vector embeddings, then stored in a vector database. Retrieve (per query): the user's question is also embedded, and the system finds the chunks whose vectors are most similar. Augment (per query): those retrieved chunks are inserted into a prompt template alongside the original question. Generate (per query): the LLM produces its answer using that augmented prompt, grounding its response in the retrieved text rather than pure memorized knowledge.

---

### Q5. Does RAG completely eliminate hallucination?

**Answer:** No — it significantly reduces it by grounding the model's answer in real retrieved text, but it doesn't eliminate it entirely. The model can still misinterpret the retrieved context, blend it incorrectly with prior knowledge, or hallucinate if retrieval itself fails to find the relevant document. Good RAG systems pair strong retrieval (Phases 4-9) with evaluation (Phase 11) to catch and measure these failure modes rather than assuming grounding alone is a guarantee of correctness.

---

> 🧠 **Memory hook:** "Don't make the model memorize the whole library — just hand it the right book, open to the right page, right before the exam."
