# 02 — HyDE (Hypothetical Document Embeddings)

> Short, vague queries often embed poorly against long, detailed documents — HyDE closes that gap by embedding an LLM-generated hypothetical answer instead of the raw query.

---

## Table of Contents

1. [The Problem: Queries and Documents Embed Differently](#1-the-problem-queries-and-documents-embed-differently)
2. [The Analogy: Imagining the Perfect Answer Before You Search](#2-the-analogy-imagining-the-perfect-answer-before-you-search)
3. [Internal Flow: Generate, Then Embed the Hypothetical Answer](#3-internal-flow-generate-then-embed-the-hypothetical-answer)
4. [Code Example: A Two-Step HyDE Retrieval Function](#4-code-example-a-two-step-hyde-retrieval-function)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Queries and Documents Embed Differently

Vector search rests on an assumption that's easy to forget: the query and the documents are both being embedded by the *same* model, into the *same* space, and then compared by proximity. That works cleanly when the query and the matching document are similar in *style and length* — but a huge share of real user queries aren't. A user types "how do refunds work," five words, no elaboration. The document that actually answers it might be three paragraphs of formal policy language, full of qualifying clauses and specific terms the user's short question never used.

An embedding model still has to compress both of these — the five-word question and the three-paragraph policy — into a fixed-length vector, and the two vectors don't always end up as close together as you'd hope, even when the document genuinely answers the question. This is sometimes described as a mismatch in **embedding style**: short questions and long, richly-worded answers occupy somewhat different regions of embedding space even when they're topically about the same thing, because the embedding model is influenced by more than pure topic — surface form, phrasing, and length all leave a mark on the resulting vector.

---

## 2. The Analogy: Imagining the Perfect Answer Before You Search

**Real-world analogy:** imagine you're researching a topic you don't know much about yet, so your question to a librarian is vague: "do you have anything about protecting a small business from lawsuits?" A librarian who searches for that exact phrasing might come up short, because the actual books on the shelf are titled things like *"Liability Insurance and Risk Mitigation for Small Enterprises."*

A sharper approach: before searching, first imagine — even without knowing the answer yet — roughly what a *good, detailed answer* to your question would sound like: paragraphs about liability insurance, LLC structures, indemnification clauses, risk assessments. Now search using *that imagined passage* as the search input, instead of your original vague question. Because your imagined answer uses the vocabulary and structure of an actual expert answer, it's now much closer, in wording and style, to the real book that would have helped you all along — even though your imagined passage might get some of the details wrong.

**This is exactly what HyDE does.** Instead of embedding the raw, short, vague user query, it first has an LLM *generate a hypothetical answer* to the query — even though the LLM might not know the real specific facts — and then embeds *that* hypothetical answer instead. The hypothetical answer's job isn't to be factually correct; its job is to be stylistically and structurally similar to the real documents in the corpus, which makes it a much better search key.

> 🧠 Reach for this analogy whenever someone asks "why would you search with a made-up answer" — because the made-up answer isn't trusted for its facts, only borrowed for its *shape*, which happens to resemble the real document far more closely than the original short question did.

---

## 3. Internal Flow: Generate, Then Embed the Hypothetical Answer

HyDE (**Hypothetical Document Embeddings**) replaces one step of the standard retrieval flow — nothing else about the pipeline changes:

**Standard retrieval:** embed the raw query → search the vector store with that embedding → get back the nearest chunks.

**HyDE retrieval:**
1. **Generate:** send the user's raw query to an LLM with a prompt like *"Write a short passage that would answer the following question, as if it were an excerpt from a knowledge base article."* The LLM produces a hypothetical answer — plausible in style and structure, but not guaranteed to be factually correct, since the LLM hasn't seen your actual private documents.
2. **Embed:** run that hypothetical answer (not the original query) through the same embedding model used to index your documents.
3. **Search:** use *that* embedding — the hypothetical answer's embedding — to query the vector store, exactly as you would have used the raw query's embedding.

The critical detail, worth stating precisely because it's easy to get subtly wrong: **HyDE swaps the query embedding out for the hypothetical-document embedding — it does not embed both and combine or average them.** The raw query's embedding is not used for the similarity search at all once the hypothetical answer has been generated; the hypothetical answer's embedding entirely replaces it as the search vector. This matters because the whole benefit of HyDE comes from searching with something that resembles a real document, not from blending a query-shaped vector with a document-shaped one.

The reason this works despite the hypothetical answer being potentially wrong on the facts: embedding similarity is driven heavily by surface form, vocabulary, and structure, not solely by verified factual content. A hypothetical answer that gets a specific number wrong but uses the right domain vocabulary and the right kind of sentence structure will still land close, in embedding space, to the real document that has the correct number — because both are "shaped" the same way. The real document, retrieved via that closeness, is what actually goes to the LLM for the final generation step; the hypothetical answer itself is discarded after it's served its purpose as a search key.

---

## 4. Code Example: A Two-Step HyDE Retrieval Function

This example uses the Claude API to generate the hypothetical answer, and a Chroma **persistent client** already populated with real chunks (reusing the Phase 5 setup pattern — `chromadb.PersistentClient(path=...)`, not the in-memory `chromadb.Client()`), so the final query is run against real, previously-indexed data.

```python
import chromadb
from anthropic import Anthropic

client_llm = Anthropic()  # reads ANTHROPIC_API_KEY from the environment

# Connect to an already-populated persistent collection (reusing indexed
# data from an earlier phase; populate on first run if empty, same as 01).
chroma_client = chromadb.PersistentClient(path="./chroma_data")
collection = chroma_client.get_or_create_collection(name="support_docs")

if collection.count() == 0:
    collection.add(
        ids=[f"doc_{i}" for i in range(3)],
        documents=[
            "Our refund policy allows returns within 30 days of purchase, provided the item is unused, and requires the original receipt.",
            "To reset your password, navigate to Settings, then Security, then select Reset Password, and follow the emailed link.",
            "International shipping typically takes 7-14 business days, and customs delays can add up to a further 5 business days.",
        ],
    )


def generate_hypothetical_answer(query: str) -> str:
    """Step 1: ask the LLM to imagine a plausible answer to the query."""
    response = client_llm.messages.create(
        model="claude-opus-4-8",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": (
                    "Write a short, plausible passage (2-4 sentences) that "
                    "would answer the following question, as if it were an "
                    "excerpt from a company knowledge base article. It's fine "
                    "if specific details are approximate.\n\n"
                    f"Question: {query}"
                ),
            }
        ],
    )
    # .content is a list of content blocks; for a plain text reply the first
    # block's .text holds the generated passage.
    return response.content[0].text


def hyde_retrieve(query: str, n_results: int = 3) -> list[str]:
    """Step 2: embed the hypothetical answer (not the raw query) and search."""
    hypothetical_answer = generate_hypothetical_answer(query)

    # collection.query() with query_texts embeds the given text internally
    # using the collection's configured embedding function -- here, that text
    # is the hypothetical answer, not the original query.
    results = collection.query(query_texts=[hypothetical_answer], n_results=n_results)
    return results["documents"][0]


query = "What do I do if my order hasn't shown up yet?"
retrieved_chunks = hyde_retrieve(query)

print("Retrieved chunks (via HyDE):")
for chunk in retrieved_chunks:
    print(f"  - {chunk}")
```

Notice that the vague original query ("what do I do if my order hasn't shown up yet") shares almost no vocabulary with the shipping-times document ("international shipping," "business days," "customs delays"). The hypothetical answer the LLM generates, by contrast, is likely to naturally use shipping/delivery vocabulary similar to the real document's, purely because it's imagining what a shipping-related answer would sound like — which is exactly the closer match the vector search needs.

---

## 5. Common Mistakes

**Mistake 1: Using HyDE for queries that are already long and well-formed.** HyDE's entire benefit comes from bridging a *style gap* between a short, vague query and long, detailed documents. If a user's query is already a detailed, well-phrased paragraph that closely resembles the documents it should match, generating a hypothetical answer adds an extra LLM call's worth of latency and cost for little to no retrieval improvement. HyDE is a targeted fix for a specific failure mode, not a default step to bolt onto every query.

**Mistake 2: Trusting the hypothetical answer's specific facts.** The hypothetical answer is generated by an LLM that hasn't seen your private documents — it's producing something *plausible*, not something *verified*. Some implementations mistakenly show the hypothetical answer itself to the end user, or use it (rather than the real retrieved chunks) as context for the final generation step. Both are mistakes: the hypothetical answer's only job is to be embedded and used as a *search key* — its role ends the moment the real documents come back from the vector store. The final answer generation should still be grounded in the retrieved real documents, never in the hypothetical one.

**Interview angle:** if asked to explain HyDE, the strongest answers name the specific mechanism precisely — generate a hypothetical answer, embed *that instead of* the query, then search — and can explain *why* it helps (closing a style/length gap between short queries and long documents) without overclaiming that the hypothetical answer's facts are trustworthy. A common tell of a shallow understanding is describing HyDE as "combining" the query and hypothetical embeddings, which isn't what the technique does.

---

## 6. Hands-On Exercises

### Exercise 1 — Compare raw-query vs HyDE retrieval

Using the code above, run `collection.query(query_texts=[query], ...)` directly with the raw query, and separately run `hyde_retrieve(query)`. Compare which chunks come back in each case for a deliberately vague, short query. Note any difference in which document ranks first.

### Exercise 2 — Break HyDE with an already-detailed query

Rewrite the example query into a long, detailed version (e.g. "My package containing a blue jacket, ordered eight days ago for international delivery, has not yet arrived — what is the expected delivery window?") and run both raw-query retrieval and HyDE retrieval against it. Discuss whether HyDE still helps, and why the benefit shrinks as the query itself starts to resemble a document.

### Exercise 3 — Inspect what the hypothetical answer actually says

Print `generate_hypothetical_answer(query)` directly and read it. Identify anything in it that's plausible-sounding but not actually verified against your real corpus — this is the concrete reminder of why the hypothetical answer must never be shown to the user or used as final-generation context.

---

## 7. Interview Q&A

### Q1. What problem does HyDE solve?

**Answer:** It addresses the mismatch between short, often vague user queries and the longer, more detailed documents they're trying to match in embedding space. Because embedding similarity is influenced by surface form and structure, not just topic, a short query and a long document about the same topic don't always embed as close together as you'd want. HyDE closes that gap by generating a longer, document-like hypothetical answer and embedding that instead.

---

### Q2. Walk me through the HyDE algorithm step by step.

**Answer:** First, send the user's query to an LLM and ask it to generate a plausible hypothetical answer, as if it were an excerpt from the target knowledge base. Second, embed that hypothetical answer using the same embedding model used to index the real documents. Third, use that embedding — not the original query's embedding — to perform the similarity search against the vector store. The retrieved real documents, not the hypothetical answer, are what get used for the final generation step.

---

### Q3. Does HyDE combine the query embedding and the hypothetical answer's embedding?

**Answer:** No. This is a common misconception. HyDE entirely replaces the query embedding with the hypothetical answer's embedding for the search step — it's a swap, not a combination or average. The raw query's embedding isn't used in the similarity search at all once the hypothetical answer has been generated.

---

### Q4. Why doesn't it matter that the LLM's hypothetical answer might contain factually wrong details?

**Answer:** Because the hypothetical answer is only ever used as a search key, not as the source of truth. Embedding similarity is driven substantially by vocabulary, phrasing, and structure — a hypothetical answer that gets a specific number or fact wrong but uses realistic domain language will still land close, in embedding space, to the real correct document. The real retrieved document, not the hypothetical one, is what's grounded and shown to the user.

---

### Q5. When would you not bother using HyDE?

**Answer:** When queries are already long, detailed, and phrased similarly to the target documents — in that case there's little embedding-style gap to close, so the extra LLM call to generate a hypothetical answer adds latency and cost without a proportional retrieval improvement. HyDE is most valuable for short, vague, or under-specified queries against long, richly-worded documents.

---

> 🧠 **Memory hook:** "Don't search with the question — search with what the answer would look like."
