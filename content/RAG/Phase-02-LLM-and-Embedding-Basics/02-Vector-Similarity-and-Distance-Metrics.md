# 02 — Vector Similarity and Distance Metrics

> A comprehensive reference covering cosine similarity, dot product, and Euclidean distance — the direction-vs-magnitude intuition, worked arithmetic, plain-Python and numpy code, and when to reach for each metric.

---

## Table of Contents

1. [The Problem: Now We Have Vectors — How Do We Compare Them?](#1-the-problem-now-we-have-vectors--how-do-we-compare-them)
2. [The Analogy: Comparing the Direction of Two Arrows](#2-the-analogy-comparing-the-direction-of-two-arrows)
3. [Internal Flow: Three Ways to Measure Closeness](#3-internal-flow-three-ways-to-measure-closeness)
4. [A Worked 2D Example, By Hand](#4-a-worked-2d-example-by-hand)
5. [Code: Plain Python, Then numpy](#5-code-plain-python-then-numpy)
6. [Comparing the Three Metrics](#6-comparing-the-three-metrics)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Now We Have Vectors — How Do We Compare Them?

Lesson 01 established that text becomes a vector of numbers, and that texts with similar meaning end up with numerically "close" vectors. But we glossed over an important detail: **what does "close" actually mean, mathematically, once you have two lists of numbers?**

This isn't a rhetorical question — there are several genuinely different ways to define "distance" or "similarity" between two vectors, and they don't always agree with each other. Two vectors can be "close" by one definition and "far" by another. If you pick the wrong metric for your embedding model, or apply it incorrectly, your retrieval step can silently return the wrong chunks even though the embeddings themselves are perfectly good.

So the concrete problem this lesson solves: **given two embedding vectors, compute a single number that tells you how similar (or how different) they are — and understand precisely what that number is and isn't measuring.**

---

## 2. The Analogy: Comparing the Direction of Two Arrows

**Real-world analogy:** picture two arrows drawn from the same starting point on a piece of paper, each pointing off in some direction. Now ask: are these two arrows "similar"?

There are two completely different things you could mean by that question. You could mean **"do they point in roughly the same direction?"** — imagine two arrows, one a little longer than the other, but both pointing toward the upper-right corner of the page. Even though one is longer, they're pointing the same way — directionally, they agree. Or you could mean **"do their tips end up close together in space?"** — two arrows pointing in wildly different directions might still have tips that happen to land near each other if one is very short and the other only slightly longer in a different direction, or they might end up far apart even if they point similarly, just because one is much longer than the other.

**Cosine similarity is the "do they point the same way" question — it deliberately ignores length and only cares about direction.** Euclidean distance is the "how far apart are their tips" question — it cares about both direction and length. This distinction turns out to matter enormously for embeddings, because two embedding vectors can represent the same core meaning but differ in overall magnitude (for reasons tied to how the underlying text was phrased or how long it was) — and you usually want the retrieval system to say "these mean the same thing" based on direction, not to be thrown off by a difference in vector length that has nothing to do with meaning.

> 🧠 Reach for this analogy whenever you need the one-line version: *"Cosine similarity compares which way two arrows point; Euclidean distance compares how far apart their tips are."*

---

## 3. Internal Flow: Three Ways to Measure Closeness

There are three metrics you'll encounter constantly in RAG and vector search. Let's build each one up in plain terms before doing arithmetic.

**Dot product.** Take two vectors of the same length, multiply their corresponding numbers together, and add up all those products into one single number. That's it — no division, no square roots. `dot(a, b) = a[0]*b[0] + a[1]*b[1] + ... + a[n]*b[n]`. A larger dot product generally means the vectors point in a more similar direction *and* are larger in magnitude — the dot product bundles both direction and magnitude together into one number, which is exactly why it can be misleading on its own (more on this in Section 7).

**Cosine similarity.** Take the dot product, then *divide it* by the product of each vector's own length (its "magnitude" or "norm"). Dividing by the lengths is precisely what removes magnitude from the picture and leaves you with a pure measure of direction. The result is always a number between -1 and 1: 1 means "pointing in exactly the same direction," 0 means "pointing in completely unrelated directions" (perpendicular), and -1 means "pointing in exactly opposite directions."

**Euclidean distance (L2 distance).** This is the "ordinary" straight-line distance you learned in geometry class — the length of the straight line connecting the tips of the two vectors (if you drew them both starting from the same origin point). You compute it by subtracting the vectors element-by-element, squaring each difference, adding those squares up, and taking the square root of the total. Unlike the other two metrics, **smaller Euclidean distance means more similar** (0 means identical vectors) — it's a *distance*, not a *similarity* score, so the direction of "better" is flipped compared to cosine similarity.

```
                    dot product          cosine similarity         Euclidean distance
                  (direction AND         (direction ONLY —          (direction AND
                   magnitude)             magnitude removed)         magnitude, as a
                                                                      straight-line gap)

   bigger number  =  more similar    bigger number = more similar   bigger number = LESS similar
                     (usually)                                     (it's a distance, not
                                                                     a similarity score)
```

---

## 4. A Worked 2D Example, By Hand

Let's make all three metrics completely concrete with tiny 2-dimensional vectors — small enough to compute with pen and paper, but the arithmetic generalizes exactly to real embeddings with hundreds of dimensions.

Take two vectors:

```
a = (3, 4)
b = (6, 8)
```

Notice something before we even start: `b` is exactly `a` scaled by 2 — same direction, twice the length. This is a deliberately chosen example so you can see cosine similarity and Euclidean distance disagree in an instructive way.

**Step 1 — Dot product.**

```
dot(a, b) = (3 × 6) + (4 × 8) = 18 + 32 = 50
```

**Step 2 — Magnitudes (lengths) of each vector.**

The magnitude of a vector is the square root of the sum of its squared components — this is just the Pythagorean theorem.

```
|a| = √(3² + 4²) = √(9 + 16) = √25 = 5
|b| = √(6² + 8²) = √(36 + 64) = √100 = 10
```

**Step 3 — Cosine similarity.**

```
cosine_similarity(a, b) = dot(a, b) / (|a| × |b|) = 50 / (5 × 10) = 50 / 50 = 1.0
```

Cosine similarity of **1.0** — a perfect match, meaning "pointing in exactly the same direction." This makes total sense: `b` is just `a` scaled up, so they point the same way.

**Step 4 — Euclidean distance.**

```
euclidean_distance(a, b) = √[(6-3)² + (8-4)²] = √[3² + 4²] = √(9 + 16) = √25 = 5
```

Euclidean distance of **5** — not zero, meaning the vectors are *not* identical. If you only looked at Euclidean distance, you might conclude `a` and `b` are somewhat different (a distance of 5 is not tiny relative to their own lengths of 5 and 10). But cosine similarity tells you they point in *exactly* the same direction — the only difference is magnitude, which is exactly the kind of difference cosine similarity is designed to ignore.

**The takeaway from this worked example:** the same pair of vectors can look "perfectly similar" (cosine similarity = 1.0) and "somewhat far apart" (Euclidean distance = 5) at the same time, depending entirely on which metric you ask. Neither answer is "wrong" — they're answering different questions. This is precisely why choosing the right metric for your embedding model matters (see Section 6).

---

## 5. Code: Plain Python, Then numpy

First, the plain-Python version — no libraries, just the formula translated directly into code, so you can see exactly where every term from Section 4 shows up:

```python
import math

def dot_product(a: list[float], b: list[float]) -> float:
    """Multiply corresponding elements and sum the results."""
    return sum(a_i * b_i for a_i, b_i in zip(a, b))
    # zip(a, b) pairs up a[0] with b[0], a[1] with b[1], etc. -- it lets us
    # loop over both lists together instead of indexing manually.

def magnitude(v: list[float]) -> float:
    """The vector's length: square root of the sum of its squared components."""
    return math.sqrt(sum(x ** 2 for x in v))

def cosine_similarity(a: list[float], b: list[float]) -> float:
    return dot_product(a, b) / (magnitude(a) * magnitude(b))

def euclidean_distance(a: list[float], b: list[float]) -> float:
    squared_diffs = [(a_i - b_i) ** 2 for a_i, b_i in zip(a, b)]
    return math.sqrt(sum(squared_diffs))

a = [3, 4]
b = [6, 8]

print("dot product:      ", dot_product(a, b))         # 50
print("cosine similarity: ", cosine_similarity(a, b))   # 1.0
print("euclidean distance:", euclidean_distance(a, b))  # 5.0
```

Run this and you should see exactly the numbers we computed by hand in Section 4 — `50`, `1.0`, and `5.0`. Seeing the formula spelled out this explicitly, with no shortcuts, is the point: there's no hidden magic in any of these three metrics.

In real code, you'd never write these loops by hand for 1024-dimensional embedding vectors — you'd use `numpy`, which does the same arithmetic but implemented in fast, vectorized (batch) operations under the hood:

```python
import numpy as np

a = np.array([3, 4])
b = np.array([6, 8])

dot = np.dot(a, b)
cosine_sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
euclidean_dist = np.linalg.norm(a - b)  # norm of the difference vector = Euclidean distance

print(dot, cosine_sim, euclidean_dist)  # 50 1.0 5.0
```

`np.linalg.norm(v)` computes the magnitude of a vector (the same thing our hand-written `magnitude()` function did). `np.linalg.norm(a - b)` computes the magnitude of the *difference* vector between `a` and `b`, which is exactly the definition of Euclidean distance — subtract, then measure the length of what's left. Same three answers, far less code, and this is what you'd actually use once vectors have hundreds of dimensions.

---

## 6. Comparing the Three Metrics

| Metric | What it measures | Normalization needed? | When it's preferred |
|---|---|---|---|
| **Cosine similarity** | Direction only (magnitude ignored) | No — the formula itself divides out magnitude | The default choice for most text embeddings, because embedding magnitude often varies for reasons unrelated to meaning (e.g. text length); you usually want "same direction" regardless of scale |
| **Dot product** | Direction *and* magnitude together | Yes, if you want it to behave like cosine similarity — pre-normalize both vectors to length 1, and dot product becomes mathematically identical to cosine similarity | Common in vector databases as a faster alternative to cosine similarity, specifically *when vectors are pre-normalized* at indexing time (skips the division step per comparison, which matters at scale) |
| **Euclidean distance (L2)** | Straight-line distance (direction and magnitude both matter) | Not required, but comparisons are more meaningful when vectors are normalized, since otherwise a large-magnitude vector can appear "distant" from everything just because it's long | Common in classical clustering and nearest-neighbor algorithms outside of text embeddings; also used by some vector databases as their native distance function |

**"Normalization" here means scaling a vector so its magnitude equals exactly 1** (a "unit vector"), without changing its direction. Once every vector in your system has magnitude 1, dot product and cosine similarity become mathematically identical — the division step in cosine similarity's formula becomes dividing by `1 × 1`, which does nothing. This is why many production vector databases ask you to normalize vectors once, up front, and then use the cheaper dot product for every subsequent comparison instead of recomputing magnitudes every time.

The practical decision rule: **for text embeddings, cosine similarity (or normalized dot product, which is the same thing computed faster) is almost always the right default.** Reach for plain Euclidean distance mainly when a specific library, vector database, or embedding model's documentation explicitly recommends it — some embedding models are trained and calibrated with one particular metric in mind, and mixing metrics against that assumption can quietly degrade retrieval quality.

---

## 7. Common Mistakes

**Mistake 1: Comparing un-normalized vectors with dot product, expecting cosine-similarity-like behavior.**

Recall Section 4's worked example: `a = (3, 4)` and `b = (6, 8)` had a *dot product* of 50 but a *cosine similarity* of 1.0. If you were comparing many pairs of vectors using raw dot product and expecting the biggest dot product to mean "most similar in meaning," you'd be wrong whenever vector magnitudes vary across your dataset — a vector with a large magnitude will tend to produce large dot products with *everything*, regardless of whether the direction actually matches. The fix: either use cosine similarity directly, or normalize every vector to unit length before using dot product (at which point the two become equivalent, and dot product is just the faster computation).

**Mistake 2: Assuming higher dimensionality always means better similarity results.**

It's tempting to think "a 3072-dimension embedding model must give better similarity search than a 384-dimension one, because it captures more detail." This is only sometimes true, and it comes with real costs. Higher-dimensional vectors take more memory to store, are slower to compare at scale (more numbers to multiply and add for every single comparison), and — in some cases — can suffer from a subtle statistical phenomenon where distances between vectors become less discriminative as dimensionality grows very high (sometimes called the "curse of dimensionality"): everything starts looking roughly equidistant from everything else, making it harder to tell "similar" from "dissimilar." The right dimensionality is a trade-off between retrieval quality, storage cost, and computation speed — not a "bigger number, always better" decision. Benchmark on your own data and use case rather than assuming.

**Interview angle:** "Why do people prefer cosine similarity over Euclidean distance for text embeddings?" is a very common follow-up once a candidate demonstrates they understand what embeddings are. The answer that shows real understanding isn't "because it's standard" — it's connecting back to Section 2's arrow analogy: embedding magnitude often reflects incidental factors (like input length or phrasing) rather than meaning, so a metric that ignores magnitude and focuses purely on direction is usually the more reliable signal of "these two texts mean the same thing."

---

## 8. Hands-On Exercises

### Exercise 1 — Confirm cosine similarity ignores scale, but Euclidean distance doesn't

**Goal:** Reproduce Section 4's key insight with a different vector pair, to make sure it wasn't a one-off coincidence of the specific numbers chosen.

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.array([2, 4, 6])   # exactly 2x scaled version of a
c = np.array([3, 6, 9])   # exactly 3x scaled version of a

def cosine_similarity(x, y):
    return np.dot(x, y) / (np.linalg.norm(x) * np.linalg.norm(y))

print("cosine(a, b):", cosine_similarity(a, b))       # expect 1.0
print("cosine(a, c):", cosine_similarity(a, c))       # expect 1.0
print("euclidean(a, b):", np.linalg.norm(a - b))      # expect > 0
print("euclidean(a, c):", np.linalg.norm(a - c))      # expect > 0, and larger than (a, b)
```

**Run it and observe:** cosine similarity stays at exactly 1.0 for both pairs (same direction, different scale), while Euclidean distance grows as the scale difference grows. This should match the pattern from Section 4 exactly.

### Exercise 2 — Build a tiny "search" using cosine similarity

**Goal:** Simulate the core of the Retrieve stage from Phase 1, using hand-picked vectors instead of real embeddings, to isolate the similarity-scoring logic from the embedding-model logic.

```python
import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Pretend these are embeddings for three short documents (in reality these
# would come from an embedding model -- we're hand-picking numbers here
# purely to control the example).
documents = {
    "refund_policy":   np.array([0.9, 0.1, 0.0]),
    "shipping_policy":  np.array([0.0, 0.2, 0.9]),
    "password_reset":   np.array([0.1, 0.9, 0.1]),
}

query_vector = np.array([0.8, 0.15, 0.05])  # pretend this is the embedded user query

# `.items()` gives you (key, value) pairs from the dict so you can loop over
# both the document name and its vector together.
scores = {name: cosine_similarity(query_vector, vec) for name, vec in documents.items()}

# sorted(..., key=..., reverse=True) sorts by the similarity score, highest
# first. `key=lambda item: item[1]` tells sorted() to sort by each item's
# second element (the score), not the document name.
ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)

for name, score in ranked:
    print(f"{score:.3f}  {name}")
```

**Reflection question:** which document should rank first, given how close `query_vector` is to `refund_policy`'s vector? Run the code and confirm your prediction matches the output.

### Exercise 3 — Diagnose a metric-mismatch bug

**Goal:** Practice reasoning about which metric is at fault when retrieval quality is unexpectedly poor.

Scenario: a colleague built a retrieval system that computes plain (un-normalized) dot product between the query embedding and every document embedding, then returns the document with the highest score. They notice that one particular document — a very long, detailed one — gets returned as the "best match" for almost every query, even queries that are clearly about unrelated topics. Using what you learned in Section 7, explain: (1) what property of that long document's embedding is likely causing this, and (2) two different fixes that would resolve it.

---

## 9. Interview Q&A

### Q1. What's the difference between cosine similarity and Euclidean distance?

**Answer:** Cosine similarity measures only the *direction* two vectors point in, ignoring their magnitude (length) entirely — it answers "are these pointing the same way?" Euclidean distance measures the straight-line distance between the vectors' endpoints, which depends on both their direction and their magnitude. Two vectors can have a cosine similarity of 1.0 (identical direction) while still having a nonzero Euclidean distance, if one is simply a longer or shorter version of the other pointing the same way.

---

### Q2. Why is cosine similarity generally preferred over Euclidean distance for comparing text embeddings?

**Answer:** Text embedding vectors can vary in magnitude for reasons that have little to do with meaning — different input lengths or phrasing can produce vectors of different lengths even when the underlying meaning is very similar. Cosine similarity ignores magnitude and focuses purely on direction, which tends to be a more reliable signal of semantic similarity. Euclidean distance, by contrast, would be thrown off by magnitude differences that don't actually reflect a difference in meaning.

---

### Q3. What is the relationship between dot product and cosine similarity?

**Answer:** Cosine similarity is the dot product divided by the product of the two vectors' magnitudes — dividing by the magnitudes is exactly what removes the scale/length information and leaves pure direction. If both vectors are pre-normalized to have a magnitude of exactly 1 (unit vectors), then dividing by their magnitudes has no effect (since you're dividing by 1 × 1), and dot product becomes mathematically identical to cosine similarity — just computed faster, since you skip the normalization step per comparison.

---

### Q4. Does higher-dimensional embeddings always mean better similarity search?

**Answer:** No. Higher dimensionality can capture more nuance, but it also increases storage and computation cost for every similarity comparison, and past a certain point can make distances between vectors less discriminative — everything starts to look roughly equidistant from everything else, a phenomenon sometimes called the curse of dimensionality. The right dimensionality is a trade-off to benchmark for your specific use case, not something to maximize blindly.

---

### Q5. If I compute a raw (un-normalized) dot product between two embeddings and get a large number, does that mean they're highly similar in meaning?

**Answer:** Not necessarily. A raw dot product conflates direction and magnitude — a vector with a large magnitude will tend to produce large dot products against almost anything, regardless of whether it actually points in a similar direction. To get a result that reliably reflects semantic similarity, you should either use cosine similarity directly (which divides out magnitude) or normalize both vectors to unit length first and then use dot product, which becomes equivalent to cosine similarity once normalized.

---

> 🧠 **Memory hook:** "Cosine similarity asks 'which way are you pointing?' Euclidean distance asks 'how far apart are your tips?' — for comparing meaning, you almost always want the direction question."
