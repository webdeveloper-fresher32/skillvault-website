# 03 — MMR and Metadata Filtering

> Top-k similarity search can return five near-duplicate chunks that all say the same thing — Maximal Marginal Relevance (MMR) balances relevance against diversity, and metadata filtering decides what pool that diversity gets chosen from.

---

## Table of Contents

1. [The Problem: Five Chunks, One Opinion](#1-the-problem-five-chunks-one-opinion)
2. [The Analogy: Five Different Perspectives, Not One Repeated Five Times](#2-the-analogy-five-different-perspectives-not-one-repeated-five-times)
3. [Internal Flow: Maximal Marginal Relevance](#3-internal-flow-maximal-marginal-relevance)
4. [Code Example: A Simplified MMR Re-Selection Function](#4-code-example-a-simplified-mmr-re-selection-function)
5. [Metadata Filtering Revisited: Filter-Then-Rank vs. Rank-Then-Filter](#5-metadata-filtering-revisited-filter-then-rank-vs-rank-then-filter)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Five Chunks, One Opinion

Plain top-k similarity search has a subtle failure mode that has nothing to do with k being too small or too large in absolute terms: it optimizes purely for "closest to the query," with zero awareness of how similar the retrieved chunks are *to each other*. If a document collection contains five near-duplicate passages — say, five slightly different phrasings of the same product description, or five chunks that all restate the same policy — a top-k=5 retrieval can return all five of them, because they're all legitimately close to the query.

The result: you spend your entire context budget on one idea repeated five times, while a *different*, equally relevant fact that could have completed the picture never makes it into the prompt at all — not because it wasn't similar enough, but because the top 5 slots were already consumed by near-duplicates. This is a distinct problem from k-tuning (Lesson 1) — even a well-tuned k can suffer from this if the retrieved set has no diversity constraint.

---

## 2. The Analogy: Five Different Perspectives, Not One Repeated Five Times

**Real-world analogy:** imagine asking five different colleagues for their opinion on a decision, hoping to get a well-rounded picture. If all five happen to have read the same one article and just repeat its argument back to you, you haven't actually gained five opinions — you've gained one opinion, heard five times. What you actually wanted was for someone to notice "these two are about to say the same thing — let's swap one of them out for a colleague who'll bring something different to the table," even if that colleague's take is, on its own, slightly less directly on-topic than a fourth repeat of the same view.

Maximal Marginal Relevance is exactly that instinct, encoded as an algorithm: when picking the next chunk to include, don't just ask "how relevant is this to the query" — also ask "how different is this from what I've already picked," and balance the two.

> 🧠 The one-line version: MMR asks for relevant *and* different, not just relevant.

---

## 3. Internal Flow: Maximal Marginal Relevance

MMR builds the retrieved set one chunk at a time, and at each step it scores every remaining candidate using both its relevance to the original query *and* its similarity to chunks already selected so far:

```
MMR = argmax over unselected docs d of
      [ lambda * sim(d, query)  -  (1 - lambda) * max_{s in selected} sim(d, s) ]
```

Reading this term by term: `sim(d, query)` is the ordinary relevance score — how similar candidate `d` is to the original query, exactly what plain top-k similarity search already computes. `max_{s in selected} sim(d, s)` is the *redundancy penalty* — how similar `d` is to the most similar chunk **already chosen**, which captures "would picking this add something new, or just repeat what's already in the selected set." The **lambda** parameter (between 0 and 1) controls the tradeoff between the two:

- **lambda close to 1** → the formula collapses toward pure relevance ranking, mostly ignoring redundancy (behaves close to plain top-k).
- **lambda close to 0** → the formula prioritizes diversity almost exclusively, potentially selecting chunks that are quite dissimilar to the query just because they're different from what's already picked.
- **A middle value (commonly around 0.5-0.7)** balances both — favor relevance, but actively avoid picking something that's nearly identical to a chunk you already have.

The algorithm runs iteratively: pick the single most relevant chunk first (there's nothing selected yet to be redundant with), then for each subsequent pick, compute the MMR score above for every remaining candidate against the *already-selected* set, and pick whichever scores highest. Repeat until you have k chunks.

---

## 4. Code Example: A Simplified MMR Re-Selection Function

```python
import numpy as np

def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def mmr_select(
    candidates: list[tuple[str, np.ndarray, float]],  # (chunk_text, embedding, sim_to_query)
    query_embedding: np.ndarray,
    k: int = 5,
    lambda_param: float = 0.6,
) -> list[str]:
    """Re-select k chunks from a larger candidate pool, balancing relevance
    to the query against diversity from chunks already selected."""
    remaining = list(candidates)
    selected: list[tuple[str, np.ndarray, float]] = []

    while remaining and len(selected) < k:
        best_score = float("-inf")
        best_candidate = None

        for chunk_text, embedding, sim_to_query in remaining:
            if not selected:
                # Nothing selected yet -- redundancy penalty is zero,
                # so this reduces to picking by relevance alone.
                redundancy = 0.0
            else:
                # Penalty is the similarity to the MOST similar already-
                # selected chunk -- the closest match, not the average.
                redundancy = max(
                    cosine_sim(embedding, sel_embedding)
                    for _, sel_embedding, _ in selected
                )

            mmr_score = lambda_param * sim_to_query - (1 - lambda_param) * redundancy

            if mmr_score > best_score:
                best_score = mmr_score
                best_candidate = (chunk_text, embedding, sim_to_query)

        selected.append(best_candidate)
        remaining.remove(best_candidate)

    return [chunk_text for chunk_text, _, _ in selected]
```

Notice the structure mirrors the formula directly: `sim_to_query` is the relevance term, and `redundancy` (the max similarity to anything already selected) is subtracted, weighted by `(1 - lambda_param)`. The first pick always reduces to plain top-relevance because there's nothing yet to be redundant against — MMR only changes behavior from the second pick onward.

---

## 5. Metadata Filtering Revisited: Filter-Then-Rank vs. Rank-Then-Filter

Phases 6 and 7 introduced metadata filtering — restricting a similarity search to chunks matching certain metadata (a date range, a document type, a customer tier, and so on) alongside the vector query. In the context of choosing a retrieval strategy, there are two different orders you can apply filtering and ranking, and they're not equivalent:

**Filter-then-rank:** first narrow the candidate pool to only chunks matching the metadata condition, then run similarity search (or MMR) purely within that narrowed pool. This guarantees every result satisfies the filter, and it's usually what you want when the filter is a hard business requirement (e.g., "only search documents the current user is authorized to see," or "only search this customer's own account history").

**Rank-then-filter:** run similarity search across the *entire* corpus first, then discard results that don't match the metadata condition afterward. This is riskier: if you retrieve top-k=5 and then filter, you might end up with fewer than 5 results (or zero) if most of the top matches happen to fail the filter — you've thrown away ranking budget on candidates that were always going to be discarded.

The practical rule of thumb: filter-then-rank whenever the metadata condition is a hard requirement (especially anything security- or access-control-related, where "rank first" risks even *seeing* unauthorized content pass through scoring); rank-then-filter is occasionally acceptable for soft preferences where you're willing to gracefully degrade the metadata match if similarity is strong enough. And this interacts directly with MMR and k-tuning from this phase: if you filter down to a very small candidate pool first, there may not be enough distinct chunks left for MMR's diversity term to do anything meaningful with — a consideration covered further in the mistakes below.

---

## 6. Common Mistakes

**Mistake 1: Setting MMR's diversity weight too high.** Pushing lambda too close to 0 optimizes almost entirely for "different from what's already picked" and can end up selecting chunks that are barely relevant to the query at all, just because they're dissimilar to earlier picks. The retrieved set becomes diverse but useless — diversity without a relevance floor isn't actually helpful. A common practical range is lambda around 0.5-0.7, favoring relevance while still penalizing near-duplicates.

**Mistake 2: Filtering so aggressively that MMR has nothing left to diversify over.** If a metadata filter (Phases 6-7) narrows the candidate pool down to just two or three chunks before MMR ever runs, there's no meaningful diversity to select from — MMR degenerates into just returning whatever tiny pool survived the filter, in whatever order. If a retrieval strategy pairs strict filtering with MMR, it's worth checking that the post-filter candidate pool is meaningfully larger than k; otherwise the diversity mechanism has nothing to work with.

**Interview angle:** a strong answer to "when would you use MMR over plain top-k" names the specific failure mode — near-duplicate chunks consuming the entire retrieved set — rather than a vague "for better results." Being able to state the MMR formula (or at least that it subtracts a redundancy penalty weighted by `1 - lambda` from a relevance term weighted by `lambda`) and correctly explain which direction lambda pushes behavior is what distinguishes real understanding from having only heard the term.

---

## 7. Hands-On Exercises

### Exercise 1 — Run MMR with two different lambda values

Using the `mmr_select` function above, construct a candidate list where two chunks have nearly identical embeddings (simulate near-duplicates) and a third chunk is meaningfully different but slightly less relevant to the query. Run the selection with `lambda_param=0.9` and `lambda_param=0.3` and compare which chunks get selected in each case.

### Exercise 2 — Combine filtering and MMR

Simulate a metadata filter that narrows a 20-chunk candidate pool down to 3 chunks matching some condition, then run MMR with k=5 over that filtered pool. Observe what happens when k exceeds the size of the filtered candidate pool, and describe in your own words why this is the "filtering too aggressively" mistake from this lesson.

### Exercise 3 — Decide filter-then-rank vs. rank-then-filter

Take a retrieval scenario from a past phase's project (or design a new one) involving an access-control requirement — for example, "users should only retrieve chunks from documents belonging to their own organization." Write out why this specific scenario demands filter-then-rank rather than rank-then-filter, and what could go wrong if it were implemented the other way around.

---

## 8. Interview Q&A

### Q1. What problem does MMR solve that plain top-k similarity search doesn't?

**Answer:** Plain top-k similarity search only optimizes for relevance to the query, with no awareness of how similar the retrieved chunks are to each other — it can return several near-duplicate chunks that all restate the same fact, wasting the context budget on redundant information instead of surfacing a diverse, complementary set of relevant facts. MMR explicitly balances relevance against diversity from already-selected results to avoid this.

---

### Q2. Write out the MMR formula and explain what lambda controls.

**Answer:** `MMR = argmax over unselected docs d of [ lambda * sim(d, query) - (1 - lambda) * max_{s in selected} sim(d, s) ]`. The first term rewards relevance to the query; the second term penalizes similarity to whatever's already been selected. Lambda close to 1 favors relevance (behaves close to plain top-k); lambda close to 0 favors diversity, potentially at the cost of relevance.

---

### Q3. What happens if you set MMR's lambda too low?

**Answer:** The algorithm optimizes almost entirely for diversity from already-selected chunks and can end up choosing candidates that are barely relevant to the original query, just because they differ from earlier picks. You get a diverse but low-quality retrieved set — diversity isn't useful on its own if it comes at the cost of relevance.

---

### Q4. What's the difference between filter-then-rank and rank-then-filter, and when does it matter?

**Answer:** Filter-then-rank narrows the candidate pool to only metadata-matching chunks before running similarity search or MMR, guaranteeing every result satisfies the filter. Rank-then-filter runs similarity search first and discards non-matching results afterward, which can leave you with fewer results than expected. It matters most for hard requirements like access control, where filter-then-rank is essential — rank-then-filter risks scoring, or even exposing, content the user shouldn't see in the first place.

---

### Q5. Can combining aggressive metadata filtering with MMR backfire? How?

**Answer:** Yes — if the metadata filter narrows the candidate pool down to only a handful of chunks before MMR runs, there isn't a meaningful diversity to select from, and MMR effectively degenerates into just returning whatever tiny pool survived filtering. The fix is making sure the post-filter candidate pool is meaningfully larger than the target k before applying MMR.

---

> 🧠 **Memory hook:** "Relevance gets you in the room; MMR's redundancy penalty makes sure everyone in the room isn't saying the same thing."
