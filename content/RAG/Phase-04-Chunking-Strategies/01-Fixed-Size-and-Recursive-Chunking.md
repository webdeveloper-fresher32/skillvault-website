# 01 — Fixed-Size and Recursive Chunking

> How to break a document into pieces small enough to embed and retrieve precisely, without slicing through the sentences that matter.

---

## Table of Contents

1. [The Problem: Too Big to Embed, Too Coarse to Retrieve](#1-the-problem-too-big-to-embed-too-coarse-to-retrieve)
2. [The Analogy: Slicing a Loaf of Bread](#2-the-analogy-slicing-a-loaf-of-bread)
3. [Fixed-Size Chunking with Overlap](#3-fixed-size-chunking-with-overlap)
4. [Recursive Character Splitting](#4-recursive-character-splitting)
5. [Code Example: Hand-Rolled vs RecursiveCharacterTextSplitter](#5-code-example-hand-rolled-vs-recursivecharactertextsplitter)
6. [Comparison Table: Fixed-Size vs Recursive](#6-comparison-table-fixed-size-vs-recursive)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Too Big to Embed, Too Coarse to Retrieve

In Phase 3, you loaded and cleaned a document — say, a 40-page product manual — into one long string of text. Now you need to turn it into something a RAG system can retrieve against, and here's the tension you run straight into:

**Too big:** you can't embed the entire 40-page manual as a single vector and expect that vector to usefully represent "what this document is about" for retrieval purposes. Embedding models also have hard input-length limits (Phase 2), and even where they don't, cramming an entire document into one vector averages away all the specific detail a query might be asking about. A query about "return shipping labels" and a query about "warranty claims" would both retrieve the exact same one giant chunk — the manual — telling the LLM nothing about *where* in the manual to look.

**Too coarse:** so you split it up. But split carelessly — say, by cutting every 500 characters no matter what's there — and you get chunks like: `"...the return window is 30 days from the date of purch"` followed by a new chunk starting with `"ase. Items must be unworn and..."`. The sentence that answers your query has been sawn in half, and neither half alone captures the full meaning. Worse, the embedding of a truncated sentence is often *not* close to the embedding of a query about that sentence's actual meaning, so the chunk that would have answered the question perfectly might not even get retrieved.

So the real problem chunking has to solve: **break a document into pieces small enough that each one is specific and embeds well, without cutting through the natural units of meaning (sentences, ideas, sections) that make each piece coherent on its own.**

---

## 2. The Analogy: Slicing a Loaf of Bread

**Real-world analogy:** imagine you're slicing a loaf of bread that has raisins and walnuts baked unevenly throughout it.

A careless baker with a ruler slices exactly every 2 centimeters, no matter what's underneath the knife. Most slices come out fine, but every so often the knife lands right on a walnut, splitting it in half across two slices — neither slice has the whole walnut, and biting into either one gives you an incomplete, slightly wrong sense of what was actually in the loaf at that point.

A good baker looks at the loaf first, and slices along the loaf's natural give — between the denser walnut clusters, along the seams where the dough naturally separates — while still keeping each slice a reasonable, similar-ish size for a sandwich. The slices aren't perfectly uniform, but nothing important gets cut in half.

Fixed-size chunking is the careless baker: fast, predictable, occasionally slices right through the good part. Recursive character splitting is the baker who looks for natural seams first — paragraph breaks, then sentence breaks, then word breaks — and only resorts to a blind cut if no natural seam is available nearby.

> 🧠 Reach for this analogy whenever chunking strategy comes up: *"Fixed-size chunking slices by the ruler; recursive chunking slices along the seams."*

---

## 3. Fixed-Size Chunking with Overlap

The simplest possible chunking strategy: pick a chunk size (say, 500 characters or roughly 100-150 tokens — more on that distinction below), and cut the text into consecutive pieces of that size, moving straight through the document with no regard for what's at each cut point.

The one refinement almost everyone adds on top of pure fixed-size chunking is **overlap**: instead of starting each new chunk exactly where the previous one ended, you back up a little — say, 50 of the last 500 characters — and start the next chunk from there. The reasoning: if an important sentence happens to straddle a cut boundary, overlap increases the odds that the *full* sentence appears intact in at least one of the two chunks around the cut, even if it's still split in the other.

Overlap doesn't eliminate the "cut through the walnut" problem — it just increases the chance that somewhere in your chunk set, the important sentence appears whole. It's a mitigation, not a fix, and it comes at a real cost: overlapping text gets embedded and stored twice, inflating your vector database size and (in Phase 8) sometimes causing near-duplicate chunks to compete for the same top-k retrieval slots.

---

## 4. Recursive Character Splitting

Recursive character splitting (the strategy behind LangChain's `RecursiveCharacterTextSplitter`, and conceptually similar in most RAG frameworks) tries to respect document structure instead of ignoring it, while still guaranteeing every chunk stays under your target size.

The trick is an ordered list of separators it tries, from "most meaningful break" to "least meaningful break" — typically something like:

1. Double newline (`\n\n`) — paragraph breaks
2. Single newline (`\n`) — line breaks
3. Sentence-ending punctuation followed by a space (`". "`, `"! "`, `"? "`) — sentence breaks
4. Space (`" "`) — word breaks
5. Empty string (`""`) — a hard character-by-character cut, the last resort

The algorithm works recursively (a function that calls a smaller version of itself on each piece it produces — here, on each half of a text after a split): it first tries splitting the whole text on paragraph breaks. If any resulting paragraph is still bigger than your target chunk size, it recurses *into that oversized paragraph* and tries splitting it on the next separator down the list (sentence breaks), and so on, only falling all the way to a hard character cut if a single "sentence" (or a run of text with no punctuation, like a long URL) is itself bigger than the target size. Chunks that come out under the size limit are then reassembled up to (but not exceeding) the target size, so you still get consistently-sized chunks — they just land on natural boundaries whenever one is available nearby.

This is why recursive splitting is the default, sensible starting point for most RAG systems: it costs almost nothing extra computationally (it's just string splitting, no ML involved) and it dramatically reduces mid-sentence cuts compared to naive fixed-size chunking.

---

## 5. Code Example: Hand-Rolled vs RecursiveCharacterTextSplitter

First, a hand-rolled fixed-size chunker with overlap, so you can see exactly what it's doing under the hood:

```python
def fixed_size_chunk(text: str, chunk_size: int = 120, overlap: int = 20) -> list[str]:
    """Split text into fixed-size chunks with a character overlap between consecutive chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap  # back up by `overlap` chars before starting the next chunk
        if end >= len(text):
            break
    return chunks

sample_text = (
    "Our return policy allows returns within 30 days of purchase. Items must be "
    "unworn, unwashed, and in original packaging with tags attached. Refunds are "
    "issued to the original payment method within 5-7 business days of us "
    "receiving the item. Store credit is available immediately upon request."
)

for i, c in enumerate(fixed_size_chunk(sample_text)):
    print(f"--- chunk {i} ---\n{c}\n")
```

Running this, you'll see at least one chunk boundary land mid-word — for example, chunk 0 ends `"...unworn, unwashed, and in original packaging w"`, and chunk 1 (after backing up 20 characters for overlap) begins `"original packaging with tags attached..."`. The overlap means the full word "with" does show up intact in the *next* chunk, but the first chunk itself still ends on a jagged, meaning-broken fragment ("w").

Now the same text through `RecursiveCharacterTextSplitter`:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=120,
    chunk_overlap=20,
    separators=["\n\n", "\n", ". ", " ", ""],  # tried in this order, most meaningful first
    keep_separator="end",  # keep the matched separator attached to the end of the preceding chunk
)

recursive_chunks = splitter.split_text(sample_text)
for i, c in enumerate(recursive_chunks):
    print(f"--- chunk {i} ---\n{c}\n")
```

Comparing the two outputs on the same input: the recursive splitter's chunks reliably end on a sentence boundary (`"...within 30 days of purchase."`) wherever the text allows it within the size budget, instead of cutting wherever the character count happens to land. The fixed-size version is faster to reason about and produces perfectly uniform lengths, but at the cost of chunk boundaries that don't respect the content at all.

---

## 6. Comparison Table: Fixed-Size vs Recursive

| Dimension | Fixed-size chunking | Recursive character splitting |
|---|---|---|
| Simplicity | Extremely simple — one loop, one formula | Slightly more complex — ordered separator list, recursive logic |
| Boundary awareness | None — cuts wherever the count lands | High — prefers paragraph/sentence/word breaks before a hard cut |
| Chunk size uniformity | Perfectly uniform | Variable — length yields to boundary respect, so chunks can differ noticeably in size, especially on short/irregular text |
| Speed | Fastest — pure arithmetic | Still very fast — string operations only, no ML |
| Risk of mid-sentence cuts | High | Low (but not zero — very long "sentences" can still get force-split) |
| Good default choice? | Only for structureless text (e.g. raw logs) | Yes — the sensible default for most prose documents |

---

## 7. Common Mistakes

**Mistake 1: Overlap set too high.** Setting overlap to 40-50% of chunk size (instead of the more typical 10-20%) means nearly half of every chunk's content is duplicated in a neighboring chunk. This bloats your vector database, wastes retrieval budget on near-duplicate chunks competing for the same top-k slots (Phase 8), and adds embedding cost for no real gain in boundary safety past a certain point.

**Mistake 2: Overlap set too low or zero.** The opposite failure: with no overlap, a sentence or idea that straddles a chunk boundary is genuinely split with no safety net anywhere in your chunk set. This is especially damaging for fixed-size chunking, where boundary cuts are already unavoidable — zero overlap there means guaranteed lost context at every single boundary.

**Mistake 3: Confusing token count with character count.** Chunk size is usually specified as characters in tooling defaults, but embedding models and LLMs have limits measured in *tokens* (Phase 2) — and the character-to-token ratio varies by language and content (roughly 4 characters per token for English prose, but code, URLs, and non-English text can differ significantly). A chunk that looks safely under a character limit can silently exceed a model's token limit, causing truncation or an outright API error at embed time. Always verify chunk sizes against the actual tokenizer of the embedding model you're using, not just character counts.

---

## 8. Hands-On Exercises

### Exercise 1 — Break the naive chunker on purpose

Take the `fixed_size_chunk` function above and run it on a paragraph of your own choosing with `chunk_size=50, overlap=0`. Find and print the specific chunk boundary that cuts through a word. Then re-run with `overlap=15` and confirm the full word now appears intact in at least one chunk.

### Exercise 2 — Compare chunk counts

Run both `fixed_size_chunk` and `RecursiveCharacterTextSplitter` on the same 500+ word passage of real prose (a Wikipedia paragraph works well) with the same `chunk_size` and `overlap`. Count how many chunks each produces, and manually inspect how many chunk boundaries in each land mid-sentence. Report the difference.

### Exercise 3 — Token vs character mismatch

Pick a short piece of code (not prose) and a short piece of English prose of roughly the same character length. Use a tokenizer (e.g. `tiktoken` for OpenAI models) to count tokens in each. Confirm that the code sample has a noticeably different character-per-token ratio than the prose sample, and explain in one sentence why this matters when picking a `chunk_size`.

---

## 9. Interview Q&A

### Q1. Why can't you just embed an entire document as a single chunk?

**Answer:** Embedding models have input length limits, and even where a document fits, a single vector for an entire document averages away the specific detail needed to distinguish "what part of this document is relevant to this particular query." A query about one narrow topic and a query about a completely different narrow topic within the same document would both retrieve the identical single chunk, giving the LLM the whole document instead of the specific passage it needs.

### Q2. What problem does overlap solve in fixed-size chunking, and what's the tradeoff?

**Answer:** Overlap increases the odds that a sentence or idea straddling a chunk boundary appears intact in at least one chunk, by having each new chunk start slightly before where the previous one ended rather than exactly at that point. The tradeoff is duplicated content: too much overlap bloats storage and can cause near-duplicate chunks to compete for the same retrieval slots, while too little overlap leaves boundary content genuinely and irrecoverably split.

### Q3. How does `RecursiveCharacterTextSplitter` decide where to cut?

**Answer:** It tries an ordered list of separators from most to least meaningful — typically paragraph breaks, then line breaks, then sentence-ending punctuation, then spaces, and only as a last resort a hard character-by-character cut. It recursively re-splits any piece that's still too big using the next separator down the list, so chunks stay under the target size while preferring to land on natural content boundaries whenever one exists nearby.

### Q4. Why might a chunk that looks fine by character count still fail at embedding time?

**Answer:** Because embedding models enforce limits in tokens, not characters, and the character-to-token ratio isn't fixed — it varies by content type (English prose vs. code vs. non-English text) and can differ meaningfully from the ~4-characters-per-token rule of thumb. A chunk sized purely by character count can silently exceed the model's actual token limit, leading to truncation or an API error.

### Q5. When would you choose plain fixed-size chunking over recursive splitting?

**Answer:** When the text has no meaningful structure for a recursive splitter to exploit — raw logs, sensor data dumps, or other structureless streams where paragraph/sentence boundaries don't carry semantic meaning anyway. For ordinary prose documents, recursive splitting is almost always the better default since it costs barely more and produces much cleaner boundaries.

---

> 🧠 **Memory hook:** "Fixed-size slices by the ruler; recursive slices along the seams — same loaf, very different walnuts survive intact."
