# 01 — Loading Documents

> How real-world files — PDFs, HTML pages, plain text — get turned into the plain strings a RAG pipeline actually works with, and where each format quietly breaks that promise.

---

## Table of Contents

1. [The Problem: Knowledge Doesn't Arrive as Clean Strings](#1-the-problem-knowledge-doesnt-arrive-as-clean-strings)
2. [The Analogy: A Mailroom Sorting Different Envelopes](#2-the-analogy-a-mailroom-sorting-different-envelopes)
3. [The Loader Abstraction](#3-the-loader-abstraction)
4. [Loading a PDF with pypdf](#4-loading-a-pdf-with-pypdf)
5. [Loading an HTML Page with BeautifulSoup](#5-loading-an-html-page-with-beautifulsoup)
6. [Loading Plain Text and Markdown](#6-loading-plain-text-and-markdown)
7. [Comparison Table: Loader Types](#7-comparison-table-loader-types)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Knowledge Doesn't Arrive as Clean Strings

Every example in Phase 1 and Phase 2 quietly assumed you already had documents as Python strings — `"Our refund policy allows returns within 30 days..."` just appeared, ready to embed. In the real world, nothing hands you that string directly. Your organization's actual knowledge lives scattered across:

- **PDFs** — policy documents, research papers, invoices, scanned reports
- **HTML pages** — your public docs site, a wiki, a knowledge-base article rendered in a browser
- **Word documents (`.docx`)** — internal memos, specs, contracts
- **Plain text and Markdown (`.txt`, `.md`)** — READMEs, changelogs, notes
- **Structured exports** — CSV rows, JSON blobs from a support-ticket system

Each of these is a *file format* — a specific set of rules for how bytes on disk represent text, images, layout, and metadata. A PDF is not "text with some formatting" the way a `.txt` file is; it's closer to a print instruction sheet ("draw the glyph 'R' at pixel position (120, 340)") that happens to often (not always) let you recover the underlying characters. An HTML page mixes the actual content with navigation bars, ads, scripts, and markup tags that have nothing to do with what a human would call "the text."

**The problem this lesson solves:** before you can chunk anything (Phase 4), embed anything (Phase 2), or retrieve anything (Phase 5+), you first have to answer a much more basic question — *how do I reliably get plain, readable text out of whatever format this document happens to be in?* This step is called **document loading**, and it is the very first stage of the "Index" box from the Phase 1 four-stage diagram.

---

## 2. The Analogy: A Mailroom Sorting Different Envelopes

**Real-world analogy:** picture a corporate mailroom that receives packages in every imaginable shape — thick manila envelopes, padded shipping boxes, thin greeting-card envelopes, oddly-shaped tubes for posters. The mailroom's job isn't to redesign every package into a single shape. Its job is to open *each* package using the technique appropriate to that shape — cut here for a box, tear along the perforation for an envelope, unscrew the cap for a tube — and place the *contents* (not the packaging) into one common, identically-shaped tray that goes to the next department.

A document loader is the mailroom worker. It doesn't matter whether the "package" is a PDF, an HTML page, or a plain text file — a *different* opening technique is needed for each, because each is packaged completely differently at the byte level. But the output that lands in the tray — the loader's return value — is the same shape every time: plain text (plus a little structure, covered more in Lesson 3). Everything downstream in your RAG pipeline (cleaning, chunking, embedding) only ever has to deal with that one common tray shape. It never has to know or care whether the original was a PDF or an HTML page.

> 🧠 The one-sentence version: *"Different envelopes, same tray — the loader's whole job is to make every format disappear into one common shape before anything else touches it."*

---

## 3. The Loader Abstraction

Zooming in on what a loader actually does, the flow is always the same three steps, regardless of format:

```
   Input file           Parser library            Output
 (PDF / HTML /    ──▶  (format-specific     ──▶  Plain text +
  .txt / .docx)         parsing logic)             basic structure
                                                  (e.g. page number,
                                                   heading tags)
```

1. **Input file** — bytes on disk (or in memory) in some specific format.
2. **Parser library** — a piece of code that understands that format's internal rules well enough to extract the human-readable content. You almost never write this parsing logic yourself; you use a battle-tested library (`pypdf` for PDFs, `BeautifulSoup` for HTML) because correctly parsing something like the PDF specification from scratch is a multi-year undertaking.
3. **Output: plain text + basic structure** — the loader hands back a string (or list of strings, e.g. one per page) plus whatever minimal structural information the format made available "for free" during parsing, like page numbers or heading tags. Note this output is *not yet clean* — that's the whole subject of Lesson 2 — and it's *not yet tagged with rich metadata* — that's Lesson 3. This lesson is purely about getting text *out*, however rough.

Every RAG framework (LangChain's `DocumentLoader`, LlamaIndex's `Reader` classes, or a hand-rolled function) is built around exactly this abstraction: one small class or function per format, all returning the same shape of output so the rest of the pipeline can stay format-agnostic.

---

## 4. Loading a PDF with pypdf

`pypdf` is a pure-Python library for reading (and writing) PDF files. Install it with `pip install pypdf`.

```python
from pypdf import PdfReader

reader = PdfReader("employee_handbook.pdf")

print(f"Number of pages: {len(reader.pages)}")

# .pages is a list-like object; each entry is one page of the PDF.
# We loop with enumerate() so we get both the page's position (starting at 0)
# and the page object itself in each iteration.
for page_number, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"--- Page {page_number + 1} ---")
    print(text[:200])  # just the first 200 characters, to keep output short
```

Example output (truncated for readability):

```
Number of pages: 12
--- Page 1 ---
Employee Handbook
Section 1: Welcome
Welcome to the company. This handbook outlines our
policies regarding time off, conduct, and benefits...
--- Page 2 ---
Section 2: Time Off Policy
Full-time employees accrue 1.5 days of paid time off
per month, up to a maximum of...
```

Notice `extract_text()` is doing real work here: internally, a PDF stores text as a sequence of positioned glyph-drawing instructions, not as a linear string with line breaks the way a `.txt` file does. `pypdf` reconstructs a best-effort plain-text version by reading those glyph positions and inferring where words, lines, and paragraphs probably are. This inference is usually good for simple, single-column documents — and gets noticeably worse for multi-column layouts, tables, and scanned (image-only) PDFs, which is exactly the gotcha covered in the comparison table below.

---

## 5. Loading an HTML Page with BeautifulSoup

`BeautifulSoup` (from the `beautifulsoup4` package, `pip install beautifulsoup4`) parses HTML into a navigable tree structure and lets you pull out just the text, while discarding markup.

```python
import requests
from bs4 import BeautifulSoup

response = requests.get("https://docs.example.com/refund-policy")
soup = BeautifulSoup(response.text, "html.parser")

# .find() returns the first matching tag, or None if nothing matches.
# Here we grab the main content area and ignore nav bars / footers / scripts.
main_content = soup.find("main")

# get_text() walks the tag tree and concatenates every piece of visible text
# it finds, inserting the given separator between text nodes that were
# originally in different tags.
text = main_content.get_text(separator="\n", strip=True)
print(text[:300])
```

Example output:

```
Refund Policy
Our refund policy allows returns within 30 days of purchase, provided
the item is unused and in its original packaging.
Digital products are non-refundable once downloaded.
```

Two details worth internalizing here. First, `soup.find("main")` (or `soup.find("article")`, or a specific CSS class) is doing real filtering work — a raw HTML page is full of `<nav>`, `<header>`, `<footer>`, `<script>`, and `<aside>` tags that are not "the content" in any meaningful sense; a naive `soup.get_text()` on the *entire* page would pull in navigation menu text, cookie banners, and JavaScript source code right alongside the actual article. Second, `get_text(separator="\n", strip=True)` is a deliberate choice: without a separator, text from adjacent tags (e.g. a `<h1>` immediately followed by a `<p>`) can get concatenated with no space or newline between them at all, producing garbled output like `"Refund PolicyOur refund policy allows..."`.

---

## 6. Loading Plain Text and Markdown

Plain text and Markdown files require no parsing library at all — the bytes on disk already *are* the characters, in order, with no packaging to unwrap. The only real subtlety is character encoding.

```python
# encoding="utf-8" is explicit here rather than relying on Python's platform
# default, because a file saved with a different encoding (e.g. Windows'
# legacy "cp1252") will otherwise raise a UnicodeDecodeError or, worse,
# silently produce garbled characters instead of raising anything at all.
with open("release_notes.md", "r", encoding="utf-8") as f:
    text = f.read()

print(text[:200])
```

Example output:

```
# Release Notes — v2.4.0

## New Features
- Added dark mode support
- Improved search relevance ranking

## Bug Fixes
- Fixed a crash when...
```

Markdown loading is intentionally "dumb" here — we are not stripping the `#` headings or `-` bullets at this stage. That's a *cleaning* decision (Lesson 2), not a *loading* decision: Markdown's lightweight syntax is arguably still useful signal (a `#` heading tells you something structural about the text that a stripped-down version would lose), so the loader's job is simply to get the raw characters out correctly, encoding intact, and defer any judgment calls about what to keep or discard to the next stage of the pipeline.

---

## 7. Comparison Table: Loader Types

| Format | Library | What you get | Common gotchas |
|--------|---------|---------------|-----------------|
| PDF | `pypdf` (or `pdfplumber`, `PyMuPDF`) | Per-page plain text, best-effort reconstructed | Multi-column layouts get interleaved out of reading order; tables collapse into jumbled text; scanned/image-only PDFs return empty strings (need OCR, e.g. `pytesseract`) |
| HTML | `BeautifulSoup` (+ `requests` for live pages) | Visible text from selected tags, tree-navigable | Navigation/ads/scripts pollute output if you grab the whole page instead of the main content area; JavaScript-rendered content (SPAs) may not be in the raw HTML at all |
| Plain text (`.txt`) | built-in `open()` | Exact characters, in order | Wrong or unspecified encoding silently corrupts non-ASCII characters (accents, curly quotes, em-dashes) |
| Markdown (`.md`) | built-in `open()` | Exact characters including syntax (`#`, `-`, `` ``` ``) | Same encoding risk as `.txt`; deciding whether to strip Markdown syntax is a cleaning-stage decision, not a loading-stage one |
| Word (`.docx`) | `python-docx` | Paragraph-level text, some style info | Tables and embedded images need separate handling; tracked-changes markup can leak into extracted text if not handled |

---

## 8. Common Mistakes

**Mistake 1: Assuming PDF text extraction preserves reading order.** A PDF has no inherent concept of "read this text, then this text" the way a `.txt` file's line-by-line layout implies one. `pypdf` and similar libraries do their best to infer order from glyph positions, but a two-column research paper or a page with sidebars and pull-quotes can easily come out with paragraphs interleaved mid-sentence. If you feed that directly into a chunker without ever glancing at the extracted output, you can end up embedding chunks that read as nonsense to a human — and to the LLM.

**Mistake 2: Ignoring encoding issues.** Opening a text file with the wrong encoding (or none specified, relying on a platform default) doesn't always crash loudly — it can silently turn `"café"` into `"cafÃ©"` or drop characters entirely. This kind of corruption is especially insidious because it often survives all the way through cleaning, chunking, and embedding, only surfacing much later as "weirdly bad" retrieval or generation quality that's hard to trace back to its actual cause: a loading bug from Phase 3.

**Interview angle:** a favorite follow-up question after "how do you load documents into a RAG pipeline?" is "what could go wrong with a PDF specifically?" Interviewers are checking whether you understand that PDFs are a *layout* format, not a *text* format — if your answer is "you just call `extract_text()` and you're done," that signals you haven't hit the multi-column, scanned-document, or garbled-table cases that show up constantly in production RAG systems.

---

## 9. Hands-On Exercises

### Exercise 1 — Compare raw output across formats

**Goal:** See the "different envelopes, same tray" idea firsthand.

Pick (or create) three small files: a one-page PDF, a saved HTML page, and a `.txt` file, all containing roughly the same short piece of content (e.g. type the same paragraph into each format). Load all three with the code from this lesson and print the results side by side. Note any differences in whitespace, line breaks, or stray characters between the three outputs, even though the underlying content is "the same."

### Exercise 2 — Break a PDF on purpose

**Goal:** Directly observe the reading-order gotcha.

Find (or create) a two-column PDF — many academic papers on arXiv are two-column. Run `pypdf`'s `extract_text()` on it and read the output carefully. Identify at least one spot where text from the two columns got interleaved out of order. Write one sentence describing how you would detect this automatically in a pipeline processing thousands of PDFs (hint: think about what a "reasonable" sentence looks like versus a jumbled one).

### Exercise 3 — Write a tiny format-dispatching loader

**Goal:** Build the seed of a real loader abstraction.

Write a function `load_document(path: str) -> str` that looks at the file extension (`.pdf`, `.html`, `.txt`, `.md`) and calls the appropriate loading logic from this lesson, returning plain text in every case. This is intentionally the simplest possible version of the "loader abstraction" from Section 3 — real frameworks add error handling, page-level metadata (Lesson 3), and many more formats, but the dispatching idea is the same.

---

## 10. Interview Q&A

### Q1. Why can't you just treat every document type the same way when loading it?

**Answer:** Because each file format packages its content completely differently at the byte level — a PDF encodes positioned glyph-drawing instructions, HTML encodes a tree of markup tags mixed with content, and plain text is just characters in order. A loader has to use format-specific parsing logic to correctly recover the underlying text from each, even though the *output* of every loader should converge on the same shape: plain text plus a little structure.

---

### Q2. What's the biggest risk when extracting text from a PDF?

**Answer:** Losing correct reading order. PDFs have no inherent linear-text structure; multi-column layouts, sidebars, and tables can get extracted with content interleaved or jumbled, because the extraction library is inferring order from glyph positions rather than reading a format that guarantees order the way plain text does. Scanned (image-only) PDFs are an even more extreme case — there's no text layer at all, and you'd need OCR before any of this lesson's code would return anything.

---

### Q3. Why did we grab `soup.find("main")` instead of just calling `get_text()` on the whole page?

**Answer:** A raw HTML page usually contains navigation menus, footers, ads, and script tags that aren't part of "the content" a human would want retrieved. Calling `get_text()` on the entire page would pull all of that text in indiscriminately, polluting whatever gets embedded and retrieved later. Scoping to the main content area (or a specific CSS class/id) first is a simple, high-leverage filtering step.

---

### Q4. What can go wrong if you don't specify an encoding when opening a text file?

**Answer:** Python may fall back to a platform-default encoding that doesn't match how the file was actually saved. This can raise a `UnicodeDecodeError`, or — more dangerously — silently produce corrupted characters (e.g. mangled accented letters or curly quotes) without raising any error at all, corruption that then propagates invisibly through every later stage of the pipeline.

---

### Q5. Is document loading a one-time or ongoing task in a RAG system?

**Answer:** It maps to the "Index" stage from Phase 1's four-stage flow, so it happens whenever the underlying document collection changes — not on every user query. In practice this means loading logic needs to be re-run whenever documents are added, updated, or replaced, which is why it's usually built as a standalone, re-runnable ingestion step rather than code embedded in the query-time path.

---

> 🧠 **Memory hook:** "A loader doesn't care what envelope the package came in — PDF, HTML, or plain text, everything lands in the same tray: plain text, ready for the next stage."
