# 02 — Semantic and Sentence-Window Chunking

> Splitting documents by where the *meaning* changes, not just where the structure happens to break.

---

## Table of Contents

1. [The Problem: Structure Isn't Meaning](#1-the-problem-structure-isnt-meaning)
2. [The Analogy: An Editor Splitting a Book by Story Beats](#2-the-analogy-an-editor-splitting-a-book-by-story-beats)
3. [Semantic Chunking: Embedding-Driven Splits](#3-semantic-chunking-embedding-driven-splits)
4. [Sentence-Window Retrieval](#4-sentence-window-retrieval)
5. [Code Example: A Simplified Semantic Chunker](#5-code-example-a-simplified-semantic-chunker)
6. [Comparison Table: Semantic vs Sentence-Window vs Recursive](#6-comparison-table-semantic-vs-sentence-window-vs-recursive)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Structure Isn't Meaning

Recursive character splitting (previous lesson) is a real improvement over blind fixed-size cuts — it respects paragraph and sentence boundaries. But respecting *structure* is not the same as respecting *meaning*, and that gap causes a subtler failure.

Consider a single paragraph that starts by describing a product's shipping policy and, without any paragraph break, drifts into describing the return policy in the same block of text — a writer simply didn't bother to start a new paragraph at the topic shift. Recursive splitting has no way to detect this: from its point of view, there's no `\n\n`, so as far as it's concerned this is all one topic, and it'll either keep it as one (now topically mixed) chunk, or split it blindly on a sentence boundary somewhere in the middle purely because the character count ran out — with no regard for whether that split point actually separates the two topics or lands awkwardly in the middle of one of them.

The result: a chunk that embeds as a *blend* of two unrelated topics. A query about shipping retrieves this chunk because half of it is about shipping — but the other half (about returns) dilutes the embedding and can push genuinely more relevant, single-topic chunks further down the similarity ranking. **Structural splitting only works as a proxy for meaning when the author's structure actually lines up with topic boundaries — and real-world documents frequently don't cooperate.**

---

## 2. The Analogy: An Editor Splitting a Book by Story Beats

**Real-world analogy:** imagine two people asked to split a novel manuscript into chapters.

Person A splits it every 20 pages, mechanically, regardless of what's happening in the story. Sometimes a chapter break lands right in the middle of a tense confrontation, cutting the scene in half and continuing it, jarringly, at the start of the next "chapter."

A good editor instead reads for **story beats** — the moments where one scene resolves and a genuinely new one begins, a time jump happens, or the point of view shifts — and puts the chapter break exactly there, even if it means one chapter is 14 pages and the next is 31. The chapter boundary tracks where the *story itself* changes, not an arbitrary page count.

Semantic chunking is the good editor: instead of cutting on a fixed unit (character count, page count), it looks for the actual point where the topic shifts and cuts there. Sentence-window chunking is a related but distinct idea — closer to an editor who keeps very short, precise scene summaries as an index, but always hands the reader the surrounding pages of context when they ask for a specific scene, rather than just the one summary line.

> 🧠 Reach for this analogy when comparing strategies: *"Recursive splitting cuts by page count with a courtesy toward chapter breaks; semantic chunking cuts by story beats."*

---

## 3. Semantic Chunking: Embedding-Driven Splits

Semantic chunking uses the embeddings you already learned about in Phase 2 to actually detect where meaning shifts, rather than inferring it from punctuation. The core recipe:

1. Split the document into individual sentences (a much finer unit than the final chunks will be).
2. Embed each sentence separately, producing one vector per sentence.
3. Walk through the sentences in order, computing the similarity (typically cosine similarity — how close two vectors point in the same direction, from Phase 2) between each sentence's embedding and the next one's.
4. Wherever that similarity **drops below a threshold** — meaning consecutive sentences are embedding as meaningfully "about different things" — mark that point as a chunk boundary.
5. Group consecutive sentences between boundaries into a single chunk.

The intuition: sentences that are part of the same idea tend to produce embeddings that are close to each other (they use related vocabulary and concepts), while a genuine topic shift produces a noticeably larger jump in the embedding space between one sentence and the next. By splitting exactly where that jump occurs, you get chunks that are internally coherent by *meaning*, not just by the author's paragraphing habits.

The real cost here is computational: instead of one embedding call at index time per chunk, you're now embedding *every sentence* individually just to decide where the chunk boundaries should go — before you've even produced the final chunks you'll store and embed again for retrieval. For a large document collection, this sentence-level embedding pass can be a meaningful multiple of your total indexing cost.

---

## 4. Sentence-Window Retrieval

Sentence-window retrieval attacks a related but different problem: even a well-placed chunk boundary still forces a choice between small chunks (precise, but context-poor) and large chunks (context-rich, but less precise for matching a specific query).

The sentence-window approach sidesteps the choice by decoupling **what gets embedded** from **what gets returned**:

- At index time, split the document into individual sentences (or very small groups of 1-2 sentences) and embed each one separately — these are your small, precise, easy-to-match units.
- Alongside each sentence's embedding, store metadata pointing to a **window** of surrounding sentences — for example, the 2 sentences before and 2 sentences after it in the original document.
- At query time, retrieval still matches against the small, precise sentence embeddings (so matching stays sharp — a single-sentence embedding isn't diluted by neighboring, possibly-unrelated content the way a bigger chunk's embedding would be).
- But instead of returning just the matched sentence, you return its **window** — the matched sentence plus its surrounding context — to the LLM.

This gets you the best of both: the *matching* step stays as precise as a single sentence, while the *context handed to the LLM* is as rich as a small paragraph. The cost is that consecutive sentences' windows overlap heavily by construction — sentence 10's window and sentence 11's window share almost all their content — so if both get retrieved for the same query, you're handing the LLM a lot of duplicated text.

---

## 5. Code Example: A Simplified Semantic Chunker

This is a simplified, illustrative version — real implementations (e.g. LlamaIndex's `SemanticSplitterNodeParser`) add smoothing and buffer windows around each comparison, but the core idea is exactly this:

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """How closely two vectors point in the same direction; 1.0 = identical direction, 0.0 = unrelated."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def semantic_chunk(sentences: list[str], embed_fn, threshold: float = 0.75) -> list[str]:
    """Group sentences into chunks, starting a new chunk wherever similarity to the
    previous sentence drops below `threshold` (a meaning shift)."""
    if not sentences:
        return []

    embeddings = [embed_fn(s) for s in sentences]
    chunks = []
    current_chunk = [sentences[0]]

    for i in range(1, len(sentences)):
        sim = cosine_similarity(embeddings[i - 1], embeddings[i])
        if sim < threshold:
            # meaning shifted enough -- close out the current chunk, start a new one
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentences[i]]
        else:
            current_chunk.append(sentences[i])

    chunks.append(" ".join(current_chunk))  # don't forget the last chunk
    return chunks

# --- demo with a fake embed_fn for illustration (a real one would call an embedding model) ---
sentences = [
    "Our shipping policy covers all domestic orders within 5 business days.",
    "International shipments take 7-14 business days depending on customs.",
    "Expedited shipping is available at checkout for an additional fee.",
    "Returns are accepted within 30 days of the delivery date.",
    "Items must be unworn and include the original packaging to qualify.",
]

def fake_embed(sentence: str) -> np.ndarray:
    """Toy stand-in: 'shipping'-topic sentences get one direction, 'return'-topic
    sentences get another, so the demo produces a believable similarity drop."""
    is_shipping_topic = "shipping" in sentence.lower() or "customs" in sentence.lower()
    base = np.array([1.0, 0.1]) if is_shipping_topic else np.array([0.1, 1.0])
    noise = np.random.normal(0, 0.05, size=2)
    return base + noise

chunks = semantic_chunk(sentences, fake_embed, threshold=0.7)
for i, c in enumerate(chunks):
    print(f"--- chunk {i} ---\n{c}\n")
```

With a real embedding model in place of `fake_embed`, running this over the five sentences above would produce two chunks: one containing the three shipping-related sentences, and one containing the two return-related sentences — split exactly at the topic boundary, even though nothing in the punctuation or paragraphing signaled that boundary.

---

## 6. Comparison Table: Semantic vs Sentence-Window vs Recursive

| Dimension | Recursive splitting | Semantic chunking | Sentence-window retrieval |
|---|---|---|---|
| What it optimizes for | Respecting structural boundaries | Grouping by actual topic/meaning | Precise matching + rich returned context |
| Compute cost at index time | Very low (string ops only) | High (embeds every sentence to find boundaries) | Moderate (embeds every sentence, but no similarity-drop analysis) |
| Precision of retrieval match | Good | Good, and chunk itself is topically pure | Best — matches on a single sentence |
| Context richness returned | Depends on chunk size chosen | Depends on chunk size the algorithm settles on | Explicitly tunable via window size |
| Duplicate content risk | Low (only from overlap setting) | Low | High — adjacent windows overlap heavily |
| When it shines | Default choice for most prose | Long documents with abrupt, undermarked topic shifts | Query-precise domains (FAQ, legal clauses) needing surrounding context |

---

## 7. Common Mistakes

**Mistake 1: Reaching for semantic chunking without weighing the cost.** Semantic chunking requires embedding every sentence in a document just to decide where to cut — before you've even produced your final, stored chunk embeddings. On a large corpus (tens of thousands of documents), this sentence-level pass can dominate your total indexing cost and time. It's a genuinely strong technique for documents where topic shifts are subtle and unmarked by structure, but applying it uniformly across an entire large corpus "just to be safe" is often not worth the expense compared to recursive splitting, which is nearly free.

**Mistake 2: Ignoring duplicate content from sentence-window overlap.** Because adjacent sentence windows share most of their content by design, retrieving the top few results for a query can hand the LLM several near-identical passages instead of several distinct pieces of context. This wastes context window budget and can make the LLM's answer read as oddly repetitive. Deduplicating overlapping windows (or merging adjacent retrieved windows into one) before assembling the final prompt is a common fix, covered further in Phase 8.

**Mistake 3: Picking a similarity threshold without validating it on real data.** A semantic chunking threshold that's too high (e.g. 0.95) creates a new chunk almost every sentence, effectively degenerating into single-sentence chunks with no real grouping benefit. Too low (e.g. 0.3) and it rarely splits at all, producing chunks nearly as large as the whole document. The right threshold depends on your embedding model and your documents' actual writing style, and should be tuned against real examples, not guessed from a default.

---

## 8. Hands-On Exercises

### Exercise 1 — Trace the semantic chunker by hand

Using the `semantic_chunk` function above, replace `fake_embed` with a version that returns the *same* base vector (plus tiny noise) for every sentence regardless of topic. Run it and confirm you now get exactly one chunk containing all five sentences — explain in one sentence why a uniform embedding produces this result.

### Exercise 2 — Build a sentence-window index

Given a list of 8 short sentences, write a function `build_windows(sentences, window_size=2)` that returns, for each sentence index `i`, the joined text of sentences `i - window_size` through `i + window_size` (clipped at the list boundaries). Print the window for the 3rd sentence and confirm it includes 2 sentences before and 2 after it.

### Exercise 3 — Threshold sensitivity

Using the demo code from Section 5, run `semantic_chunk` with three different thresholds (e.g. `0.5`, `0.7`, `0.9`) over the same 5 sentences and note how many chunks each threshold produces. Explain, in your own words, which threshold you'd pick for a document made of many short, related sentences vs. one with several genuinely distinct topics packed close together.

---

## 9. Interview Q&A

### Q1. What problem does semantic chunking solve that recursive splitting doesn't?

**Answer:** Recursive splitting respects structural boundaries (paragraphs, sentences) but has no way to detect a topic shift that isn't marked by any structural cue — for example, a single paragraph that drifts from one subject to another without a paragraph break. Semantic chunking embeds individual sentences and detects a meaning shift directly, as a drop in similarity between consecutive sentence embeddings, and splits exactly there regardless of whether the author's formatting signaled it.

### Q2. How does sentence-window retrieval differ from just using small chunks?

**Answer:** With plain small chunking, both what gets matched at query time and what gets returned to the LLM are the same small chunk — precise matching, but poor context. Sentence-window retrieval decouples the two: it embeds and matches against small, precise units (individual sentences), but returns a larger window of surrounding sentences as the actual context handed to the LLM, getting precise matching and rich context simultaneously.

### Q3. Why is semantic chunking computationally more expensive than recursive splitting?

**Answer:** Recursive splitting is pure string manipulation — checking for separator characters — with no model calls involved. Semantic chunking requires embedding every individual sentence in the document (a model call per sentence, or a batch of them) just to compute the similarity scores that decide where the chunk boundaries go, before any final chunk is even produced or stored.

### Q4. What's the main downside of sentence-window retrieval?

**Answer:** Because each sentence's window overlaps heavily with its neighbors' windows by construction, retrieving multiple nearby matches for the same query returns largely duplicated content to the LLM. This wastes context window budget and can make responses read as repetitive unless the overlapping windows are deduplicated or merged before being assembled into the final prompt.

### Q5. How would you choose a similarity threshold for semantic chunking in practice?

**Answer:** By testing it against representative real documents rather than guessing — running the chunker at a few candidate thresholds and inspecting whether the resulting chunks group content the way a human reader would consider "the same topic." A threshold that's too high produces near-single-sentence chunks with no grouping benefit; one that's too low rarely splits at all and behaves like no chunking was applied.

---

> 🧠 **Memory hook:** "Recursive chunking cuts on page breaks; semantic chunking cuts on story beats; sentence-window keeps the index card small but hands you the whole page."
