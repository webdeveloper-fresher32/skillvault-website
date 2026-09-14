# 03 — Multimodal RAG: Images and Tables

> Why plain text embeddings are blind to images and tables, and three introductory approaches for bringing them into a RAG system.

---

## Table of Contents

1. [The Problem: A Lot of Knowledge Isn't Text](#1-the-problem-a-lot-of-knowledge-isnt-text)
2. [The Analogy: A Research Assistant Who Can't See the Diagrams](#2-the-analogy-a-research-assistant-who-cant-see-the-diagrams)
3. [Three Introductory Approaches to Multimodal RAG](#3-three-introductory-approaches-to-multimodal-rag)
4. [Captioning an Image with the Claude API](#4-captioning-an-image-with-the-claude-api)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: A Lot of Knowledge Isn't Text

Every retrieval technique this course has covered so far — chunking (Phase 4), embedding (Phase 2), vector storage (Phases 5-7), reranking (Phase 9) — operates on plain text. That's a reasonable default, because a great deal of real document content genuinely is text. But a large fraction of the useful information in real documents lives somewhere a text embedding can't see at all: an architecture diagram in a design doc, a screenshot in a bug report, a chart showing quarterly revenue in a slide deck, a pricing table in a PDF.

A standard text-embedding pipeline handles these documents by either skipping the images and tables entirely (silently losing whatever information they contained) or, at best, indexing whatever surrounding caption or alt-text happens to exist — which is often thin, generic, or missing altogether ("Figure 3" tells you nothing about what Figure 3 actually shows). Ask a RAG system built this way "what does the architecture diagram on page 12 show?" and it has no real answer, because nothing in its index actually represents what's *in* that diagram — only, at best, its filename or a one-line caption.

This is the same category of problem Lesson 01 identified for relationships: a gap in what the underlying representation can capture, not something more chunks or better prompting can fix. The fix here is to bring the image or table's *content* into a form the retrieval pipeline can actually search over.

---

## 2. The Analogy: A Research Assistant Who Can't See the Diagrams

**Real-world analogy:** imagine hiring a very well-read research assistant to help you answer questions about a stack of technical reports — except this assistant is only able to read the *words* on each page and is completely unable to look at any diagram, chart, or table embedded in the document. Handed a report that's half prose and half data tables and figures, this assistant can summarize the prose perfectly, but for every question that depends on "what does the chart on page 4 actually show," they can only shrug — they never saw it.

A text-only RAG system over documents full of diagrams and tables is exactly this assistant. It isn't broken, and it isn't dumb — it's just missing half the source material by construction. Multimodal RAG is the fix: give the assistant a way to actually look at the diagrams (or, more precisely, give the *retrieval system* a way to represent what's in them), so those pages stop being permanently unreadable.

> 🧠 Reach for this analogy when explaining *why* multimodal RAG matters, distinct from *how* it works: *"A text-only retriever is a research assistant who reads every word on the page but is blind to every diagram and table on it — multimodal RAG gives that assistant its eyesight back."*

---

## 3. Three Introductory Approaches to Multimodal RAG

At an introductory level, there are three distinct strategies for bringing non-text content into a RAG pipeline. They aren't mutually exclusive — a production system commonly uses more than one — but each has a different mechanism and a different tradeoff.

**Approach 1 — Image captioning.** Send each image to a multimodal LLM (one that accepts image input alongside text, like Claude) and ask it to produce a detailed text description of what the image shows. Store that caption as a normal text chunk — embed it, index it, retrieve it exactly the way Phases 2-9 already handle any other text — but also keep a reference (a file path or URL) back to the original image, so that when the caption is retrieved, the system (or the end user) can also pull up the actual image. This is the simplest approach to implement, because it reuses your entire existing text-retrieval pipeline unchanged; the only new step is generating the caption up front.

**Approach 2 — Multimodal embeddings.** Instead of converting an image to text first, use an embedding model that can embed *both* images and text into the same shared vector space — so an image's embedding and a text query's embedding are directly comparable by the same cosine-similarity math from Phase 2, without an intermediate captioning step. This preserves visual nuance that a caption might flatten or omit (exact colors, spatial layout, fine detail), but it requires a specific class of embedding model built for this (most everyday embedding models, including the ones used in Phases 2 and 5-7, are text-only) and a vector store that can hold and query those embeddings.

**Approach 3 — Structured table extraction.** Tables are a special case: they're not really "images" in the way a photograph or diagram is — they're structured data that happens to be rendered visually. Rather than treating a table as a picture to caption, extract its actual structure (rows, columns, headers, values) into markdown or JSON, and index *that* structured representation as text. A markdown table like `| Region | Q3 Revenue |` retrieved and handed to an LLM preserves the exact row/column relationships that a plain caption ("this table shows regional revenue") would lose.

These three approaches trade off differently: captioning is simplest to bolt onto an existing pipeline but loses visual detail the caption doesn't mention; multimodal embeddings preserve more visual nuance but require different infrastructure; structured table extraction is the right fit specifically for tabular data, not for photographs or diagrams. Most real systems pick per document type, rather than committing to one approach for everything.

---

## 4. Captioning an Image with the Claude API

Approach 1 (captioning) is the most accessible starting point, because it reuses everything you already built in Phases 2 through 9 — the only new piece is the captioning call itself. The Claude API accepts image input as part of a message's `content` list: alongside a normal `{"type": "text", ...}` block, you include a `{"type": "image", ...}` block whose `source` specifies the image data.

```python
import base64
from anthropic import Anthropic

client = Anthropic()

def caption_image(image_path: str, media_type: str = "image/png") -> str:
    """Send an image to Claude and return a detailed text caption describing
    it, suitable for embedding and indexing like any other text chunk.
    """
    with open(image_path, "rb") as image_file:
        # Claude's image input requires base64-encoded image data, not raw
        # bytes -- base64 turns arbitrary binary data into a plain ASCII
        # string that can travel safely inside a JSON request body.
        image_bytes = image_file.read()
        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                # `content` is a list of blocks -- an image block and a text
                # block together in the same message, in that order.
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,  # e.g. "image/png", "image/jpeg"
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Describe this image in detail for a search index. "
                            "Include any text, labels, numbers, or data visible "
                            "in it, and describe the overall structure (e.g. "
                            "chart type, diagram layout) as precisely as you can."
                        ),
                    },
                ],
            }
        ],
    )
    return response.content[0].text


def index_captioned_image(image_path: str, vector_collection) -> None:
    """Caption an image, then store the caption as a retrievable text chunk
    alongside a reference back to the original image path.

    `vector_collection` is assumed to be an already-created (and, after this
    call, populated) Chroma collection from Phase 5, or an equivalent
    interface from Pinecone/pgvector (Phases 6-7).
    """
    caption = caption_image(image_path)

    # Store the caption as the retrievable "document" text, and keep the
    # original image_path in metadata so the caller can display or re-fetch
    # the actual image once this chunk is retrieved.
    vector_collection.add(
        ids=[image_path],
        documents=[caption],
        metadatas=[{"source_type": "image", "image_path": image_path}],
    )
```

Once `index_captioned_image` has run for every image in a document set, retrieval works exactly like Phase 5's text retrieval: a user's question gets embedded, `vector_collection.query(...)` returns the closest chunks, and some of those chunks may now be image captions rather than passages of prose. The calling code checks `metadata["source_type"]` to know whether a given retrieved chunk is a caption (in which case it can also surface `metadata["image_path"]` so the original image can be shown) or ordinary document text.

The image content-block format shown above — a message whose `content` is a list containing an `image` block (with `source: {type: "base64", media_type: ..., data: ...}`) and a `text` block — is the same shape used for any Claude API call that mixes image and text input; captioning is simply one particular use of it.

---

## 5. Common Mistakes

**Mistake 1: Relying purely on captions and losing nuance a human would see directly.** A caption is a lossy summary — even a very detailed one will omit some detail a human glancing at the actual image would immediately notice (an exact color, a specific data point buried in a dense chart, a subtle visual relationship). For questions where that lost detail matters, captioning alone isn't enough; either invest in Approach 2 (multimodal embeddings, which preserve more of the original signal) for those document types, or make sure your application surfaces the original image alongside the caption so a human (or a second, more targeted multimodal LLM call) can inspect it directly rather than trusting the caption as the final word.

**Mistake 2: Never testing multimodal retrieval quality separately from text retrieval quality.** It's tempting to treat "did the RAG system answer the question correctly" as one single measurement, but a multimodal system has two retrieval paths (text chunks and image captions) that can fail independently. If you only ever evaluate on questions that happen to be answerable from text, you'll never notice that your image captioning is producing vague, unhelpful captions ("a chart showing some data") until a user asks a question that specifically depends on an image and gets a wrong or evasive answer. Build a small evaluation set (following the evaluation practices from Phase 11) made specifically of questions that can only be answered correctly using information from an image or table, and measure retrieval and answer quality on that set on its own.

**Interview angle:** A common way this gets probed in an interview is "how would you add support for a document full of screenshots and charts to an existing text-only RAG system?" The strong answer walks through the tradeoff in Section 3 rather than jumping straight to one technique — naming captioning as the low-friction starting point that reuses the existing text pipeline, multimodal embeddings as the higher-fidelity but higher-infrastructure-cost alternative, and structured extraction as the right, separate answer specifically for tables — and then flags that captioning quality needs to be evaluated on its own, not just folded into overall system accuracy, which is exactly Mistake 2 above.

---

## 6. Hands-On Exercises

### Exercise 1 — Caption a real image and judge its quality

**Goal:** See firsthand how much (or how little) detail a captioning call actually preserves.

Pick any image with some data or structure in it — a chart, a simple diagram, or a screenshot of a table. Run it through `caption_image` from Section 4. Read the caption, then look at the image again yourself: what specific detail did the caption capture well, and what did it flatten or omit? Write down one question about the image that the caption *could* answer, and one that it couldn't.

### Exercise 2 — Index a captioned image and retrieve it

**Goal:** Confirm the caption is actually retrievable, using the same mechanics as any other Phase 5 text chunk.

Using a populated Chroma collection (add a couple of unrelated plain-text chunks alongside the image caption, so retrieval has more than one thing to choose from — never query a collection containing only the one chunk you're testing), run `index_captioned_image` on the image from Exercise 1. Then query the collection with a question closely related to the image's content and confirm the caption chunk is retrieved, with `metadata["image_path"]` intact.

### Exercise 3 — Design an image-specific evaluation set

**Goal:** Practice the discipline from Mistake 2 directly.

Write down three questions that can only be answered correctly using information from an image (not from any surrounding text), based on documents you have access to or can imagine plausibly existing (e.g. "does the architecture diagram show a message queue between service A and service B?"). For each, note what a correct answer would need to include, and what an answer based on a vague caption alone would likely get wrong.

---

## 7. Interview Q&A

### Q1. Why can't a standard text-embedding RAG pipeline handle images and tables well?

**Answer:** Text embeddings are computed from text, and images and tables aren't text — a standard pipeline either skips them entirely or relies on whatever thin caption or alt-text happens to already exist nearby, which usually doesn't capture what the image or table actually contains. The system's retrieval index simply has no representation of the visual or tabular content itself.

---

### Q2. Name the three introductory approaches to multimodal RAG and one tradeoff for each.

**Answer:** Image captioning — convert images to text descriptions via a multimodal LLM, then index the caption like any other text chunk; simple to bolt onto an existing pipeline, but lossy compared to the original image. Multimodal embeddings — embed images and text into the same vector space directly; preserves more visual nuance, but requires a specialized embedding model and vector store support. Structured table extraction — convert tables into markdown or JSON that preserves rows and columns; the right fit for tabular data specifically, not for photographs or diagrams.

---

### Q3. In the Claude API image content-block format, what does the `source` field of an image block contain?

**Answer:** A dictionary specifying how the image data is provided — for base64-encoded input, `{"type": "base64", "media_type": "image/png" (or the appropriate MIME type), "data": <base64-encoded string>}`. This block sits inside the message's `content` list alongside a `{"type": "text", ...}` block containing the accompanying instruction or question.

---

### Q4. Why store a reference to the original image path alongside the caption, rather than just the caption text?

**Answer:** Because the caption is a lossy summary (see Mistake 1) — keeping the original image's path or URL in metadata lets the application surface the actual image once the caption chunk is retrieved, so a human (or a follow-up, more targeted multimodal call) can inspect the real image directly instead of relying solely on what the caption happened to describe.

---

### Q5. Why evaluate multimodal retrieval quality separately from overall RAG answer quality?

**Answer:** A multimodal system has two retrieval paths — text chunks and image/table-derived content — that can fail independently. If your evaluation set only contains questions answerable from text, poor-quality image captions or table extraction can go completely unnoticed, because the system's overall accuracy still looks fine. A dedicated evaluation set of questions answerable only from images or tables isolates that failure mode so it can actually be measured and improved.

---

> 🧠 **Memory hook:** "A text-only retriever is a research assistant who reads every word but is blind to every diagram — multimodal RAG gives it back its eyesight, one deliberate approach at a time."
