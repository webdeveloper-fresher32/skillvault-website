# 01 — Similarity Search and Top-K Tuning

> How many chunks should you actually retrieve — the tradeoffs of k, the "lost in the middle" phenomenon, and how to tune k empirically instead of guessing.

---

## Table of Contents

1. [The Problem: How Many Chunks Is Enough?](#1-the-problem-how-many-chunks-is-enough)
2. [The Analogy: The Research Assistant, Not the Whole Library](#2-the-analogy-the-research-assistant-not-the-whole-library)
3. [Internal Flow: Top-K Recap and the Cost of Getting K Wrong](#3-internal-flow-top-k-recap-and-the-cost-of-getting-k-wrong)
4. [Lost in the Middle](#4-lost-in-the-middle)
5. [Code Example: Comparing Retrieved Chunks Across Different K Values](#5-code-example-comparing-retrieved-chunks-across-different-k-values)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: How Many Chunks Is Enough?

Every retrieval step in a RAG pipeline ends with the same decision: how many chunks do we hand to the LLM? So far in this course, that number — `k` — has mostly been an afterthought, a parameter set to some default like 3 or 5 and never revisited. But k is one of the highest-leverage tuning knobs in the entire system, and getting it wrong produces two very different, equally bad failure modes.

Set k **too low** (say, k=1) and you risk missing the answer entirely — not because it isn't in your document store, but because the fact the user needs is split across two chunks, or the single most-similar chunk isn't actually the one containing the answer (it's merely the closest by embedding distance). Set k **too high** (say, k=50 "just to be safe") and you drown the model in irrelevant text: more tokens to pay for, more latency waiting on a longer generation call, and — counterintuitively — a *worse* answer, because the LLM now has to sift signal from noise across a much longer context window.

There's no universally correct k. The right value depends on your chunk size, your corpus, and how spread out answers tend to be across chunks — which means tuning k is an empirical exercise, not a one-time default you set and forget.

---

## 2. The Analogy: The Research Assistant, Not the Whole Library

**Real-world analogy:** imagine asking a research assistant to help you answer a question. You wouldn't say "bring me the entire library" — you'd drown in irrelevant material and never find the answer. You also wouldn't say "bring me exactly one page, no matter what" — sometimes the answer genuinely spans two or three pages, and a single page might not be enough.

What you actually want is: *"bring me the 5 most relevant pages you can find."* Enough material to reliably contain the answer, but curated enough that you (or in RAG's case, the LLM) can actually read and use all of it without wading through noise. Top-k similarity search is that instruction to the assistant — and k is the number you write in place of "5."

> 🧠 The instinct to reach for: k isn't "how much context can I afford to send" — it's "how many relevant pages does this research assistant need to reliably find the answer, and not one page more."

---

## 3. Internal Flow: Top-K Recap and the Cost of Getting K Wrong

Recall from earlier phases how top-k similarity search actually works at query time: the user's query is embedded into a vector, that vector is compared (typically via cosine similarity or a similar distance metric) against every stored chunk vector, and the k chunks with the highest similarity scores are returned, ranked from most to least similar.

**What happens as you increase k:**

- **Recall goes up.** With more chunks returned, you're more likely to have included the one that actually contains the answer — especially for questions whose answer is scattered across multiple source passages.
- **Precision (on average) goes down.** The chunks beyond the first few are, by definition, less similar to the query than the top ones — that's what "ranked by similarity" means. Chunk #20 is there because it scored higher than chunk #21, not because it's actually relevant to the question.
- **Token cost and latency go up linearly.** Every additional chunk is more tokens in the prompt, which costs more (most LLM APIs charge per input token) and takes longer to process before generation even starts.
- **Answer quality doesn't just plateau — it can degrade.** This is the counterintuitive part, and it's the subject of the next section: past a certain point, adding more "maybe relevant" chunks makes the model's actual answer *worse*, not just more expensive.

So the tuning problem is: find the smallest k that reliably contains the answer for your typical queries, without needlessly padding the prompt with lower-relevance chunks that add cost and can actively hurt quality.

---

## 4. Lost in the Middle

Here's the mechanism behind "more context can make the answer worse," and it's specific to how LLMs process long inputs.

Research on long-context LLM behavior has repeatedly found that models are noticeably better at using information placed at the **very beginning** or the **very end** of their context window than information buried in the **middle**. This effect is commonly called **"lost in the middle."** Intuitively: think of skimming a long document under time pressure — you tend to remember the opening and the conclusion far better than paragraph 40 of 80. LLMs exhibit an analogous attention pattern, even though nothing forces them to.

The practical consequence for RAG: if you retrieve a large k, and the single chunk that actually answers the question happens to land in the middle of the assembled context (rather than first or last), the model may effectively "skim past" it — even though the correct text is technically present in the prompt. This is a real, measurable way that a *too-large* k can hurt answer quality, distinct from the token-cost argument. It's not just "extra chunks cost money" — extra chunks in the middle of the prompt can actively cause the model to underweight the chunk that mattered.

This is also why retrieval strategy and prompt-assembly order interact: some RAG systems deliberately place the highest-similarity chunk first *and* last, or reorder retrieved chunks so the most relevant one isn't buried mid-context — a mitigation, not a full fix, for the lost-in-the-middle effect.

---

## 5. Code Example: Comparing Retrieved Chunks Across Different K Values

The most direct way to build intuition for k is to actually query a vector store with several different k values and look at how the similarity scores fall off. A steep drop-off after the first few results suggests a small k is enough; a gentle, slow decline suggests there's no sharp cutoff and you may need a larger k (or a different retrieval strategy entirely — see Lesson 2).

```python
# Using Chroma from Phase 5 as the vector store, but this pattern applies
# to any vector store client that returns (chunk, score) pairs.
import chromadb

# Reopen the same persistent collection populated in Phase 5 — an in-memory
# chromadb.Client() would start empty and every query below would return
# nothing, so make sure you're pointed at the same path used to build it.
client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection(name="support_docs")

# If you're running this fresh without Phase 5's data on hand, add a few
# documents first, e.g.:
# collection.add(
#     ids=["doc1", "doc2", "doc3"],
#     documents=[
#         "Our refund policy allows returns within 30 days of purchase.",
#         "Password resets are handled through the account settings page.",
#         "Refunds are processed within 5-7 business days after approval.",
#     ],
# )

query = "How do I get a refund for something I bought two weeks ago?"

# Try several k values and compare the similarity scores side by side.
for k in [1, 3, 5, 10]:
    results = collection.query(query_texts=[query], n_results=k)

    # Chroma returns parallel lists: documents, distances (lower = more similar
    # for the default distance metric), one sub-list per query text.
    docs = results["documents"][0]
    distances = results["distances"][0]

    print(f"\n--- k={k} ---")
    for rank, (doc, dist) in enumerate(zip(docs, distances), start=1):
        # Truncate long chunks for readable side-by-side comparison.
        preview = doc[:60].replace("\n", " ")
        print(f"  rank {rank}: distance={dist:.4f}  chunk='{preview}...'")
```

Running this against a real corpus typically reveals one of two patterns: either the distance jumps sharply after the top 2-3 results (a strong signal that a small k, like 3, is sufficient and the rest are noise), or it declines gradually with no clear elbow (a signal that similarity search alone isn't cleanly separating relevant from irrelevant chunks — often because the corpus has many topically-similar documents, which is exactly the situation Lesson 3's MMR addresses). Looking at this score curve across a representative sample of your real user queries — not just one example — is the actual empirical process for choosing a production k, rather than picking a number by intuition.

---

## 6. Common Mistakes

**Mistake 1: Picking k=1 and missing an answer split across chunks.** If a document was chunked (Phase 4) such that the fact a user needs spans a boundary — the setup is in one chunk, the conclusion in the next — a k=1 retrieval might grab only one half. The model then either answers incompletely or says it doesn't know, even though the full answer *was* in the document store, just split across two chunks that k=1 never gave it access to.

**Mistake 2: Picking a huge k "to be safe."** It feels conservative to think "just retrieve 30 chunks, surely the answer is in there somewhere." In practice this trades a false sense of safety for real, measurable costs: higher token spend on every single query, higher latency, and — because of lost-in-the-middle — a real chance the correct chunk gets buried and effectively ignored by the model anyway. "Safe" here is an illusion; it's neither cheaper nor obviously more accurate than a well-tuned small k.

**Interview angle:** when asked "how do you choose k," the strongest answers describe an empirical process — look at the similarity score distribution for representative queries, evaluate answer quality (Phase 11) at a few candidate k values, and pick the smallest k that doesn't sacrifice recall — rather than quoting a single fixed number as if it were universal.

---

## 7. Hands-On Exercises

### Exercise 1 — Plot the distance curve

Using the code example above (or any vector store you've already populated in Phases 5-7), run the same query at k=20 and plot (or just print) the distance value at each rank. Identify whether there's a sharp "elbow" where distance jumps, and note the rank where it happens.

### Exercise 2 — Construct a split-answer scenario

Write two short chunks such that a fact is split across them (e.g., chunk A: "Our premium plan includes 24/7 support."; chunk B: "24/7 support response time is guaranteed within 1 hour."). Query for a question that needs both facts ("What's the response time guarantee for premium support?") at k=1 and k=2, and observe how the answer quality changes.

### Exercise 3 — Reorder for lost-in-the-middle

Take a k=10 retrieval result and manually try two different orderings when building the prompt: (a) ranked by similarity score as returned, and (b) most-similar chunk placed first *and* a copy of it referenced again at the very end. Compare whether the model's answer changes based on where the key chunk sits in the prompt.

---

## 8. Interview Q&A

### Q1. How do you decide what value to use for k in top-k retrieval?

**Answer:** Empirically, not by guessing a fixed default. Run representative queries against your vector store at several k values, look at how the similarity/distance scores fall off (a sharp drop-off after the top few suggests a small k is enough), and evaluate actual answer quality (Phase 11) at each candidate k. Pick the smallest k that reliably contains the answer without needlessly padding the prompt.

---

### Q2. Why isn't a very large k always safer?

**Answer:** Because more retrieved chunks means more tokens (higher cost and latency), more noise for the model to sift through, and — due to the "lost in the middle" effect — a real risk that the chunk containing the actual answer gets buried in the middle of a long prompt and effectively underweighted by the model, even though it's technically present in the context.

---

### Q3. What is the "lost in the middle" phenomenon?

**Answer:** It's the observed tendency of LLMs to pay more attention to information at the very beginning or end of their context window than information placed in the middle. In RAG, this means a large k can hurt answer quality if the genuinely relevant chunk lands mid-prompt — the model may effectively skim past it, producing a wrong or incomplete answer despite the correct text being present.

---

### Q4. Can increasing k actually hurt recall, not just precision?

**Answer:** Not recall in the strict retrieval sense — a larger k, by definition, can only include at least as many relevant chunks as a smaller k. But it can hurt *effective* recall from the model's perspective: if the relevant chunk is present but gets lost in the middle of a long prompt, the model may behave as if it never saw it, which looks identical to a recall failure from the end user's point of view.

---

### Q5. Give an example of when k=1 clearly isn't enough.

**Answer:** Any question whose answer is split across chunk boundaries — for example, one chunk states a policy exists and a separate chunk states the specific numeric detail (like a time limit or price). A k=1 retrieval only grabs whichever single chunk is most similar to the query, missing the other half of the answer even though both chunks are in the document store.

---

> 🧠 **Memory hook:** "k is the size of the stack of pages you hand the assistant — too thin and the answer's missing, too thick and the answer gets lost in the pile."
