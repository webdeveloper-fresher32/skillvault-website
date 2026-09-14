# 03 — Metadata and Structured Content

> Why plain text alone isn't enough — and how attaching a metadata dictionary to every document turns "some text" into "text you can trust, filter, and cite."

---

## Table of Contents

1. [The Problem: Plain Text Loses Context](#1-the-problem-plain-text-loses-context)
2. [The Analogy: A Library Card Catalog Entry](#2-the-analogy-a-library-card-catalog-entry)
3. [Attaching Metadata: What and Why](#3-attaching-metadata-what-and-why)
4. [Building a Document Object](#4-building-a-document-object)
5. [A Brief Note on Tables and Images](#5-a-brief-note-on-tables-and-images)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Plain Text Loses Context

By the end of Lesson 2, you have clean text. But clean text on its own is missing something that turns out to matter enormously once your RAG system is answering real questions for real users: **where did this text come from?**

Imagine your retrieval step (Phase 5+) hands the LLM this chunk of clean text: *"Full-time employees accrue 1.5 days of paid time off per month, up to a maximum of 18 days per calendar year."* Now imagine a user asks a follow-up: *"Where did you get that from? Is this current?"* With plain text alone, you have no answer. You don't know:

- Which **document** this came from (the 2023 handbook? the 2024 update? a draft that was never finalized?)
- Which **page** or **section**, so a human could go verify it themselves
- **When** it was last updated, so you can tell if it's stale
- What **type** of source it is (an official policy PDF vs. a Slack message vs. a random wiki edit someone made)

Without this context, every chunk of text is a fact floating with no way to check it, no way to filter it, and no way to cite it. This is the difference between a RAG system that can say "According to the Employee Handbook, Section 2, last updated March 2024, page 3..." and one that can only ever say "I found some text that says..." with no way to back that up.

---

## 2. The Analogy: A Library Card Catalog Entry

**Real-world analogy:** a library doesn't just shelve books — every book has a card catalog entry (or, today, a database record) attached to it: author, title, publication year, edition, call number, which shelf it lives on. The catalog entry isn't the book's *content*; it's information *about* the book that lets a librarian (or a patron) find it again, verify which edition they're looking at, and cite it correctly in a bibliography.

Metadata in a RAG system plays exactly this role. The `content` field of a document is the book's actual text — what you'd read. The `metadata` dictionary is the card catalog entry riding alongside it: source filename, page number, section title, last-modified timestamp. Just as no library would ever shelve a book by tearing off its catalog card and discarding it, a well-built RAG pipeline never lets a chunk of text travel through the system without its metadata attached — because a book without a catalog entry is a book nobody can ever find or verify again.

> 🧠 The one-sentence version: *"A chunk of text without metadata is a book with no catalog card — you can read it, but you can never prove where it came from."*

---

## 3. Attaching Metadata: What and Why

The core idea is simple: instead of a loader returning a plain string, it should return the string *plus* a dictionary of facts about that string. Common metadata fields, and why each one matters:

| Metadata field | Example value | Why it matters |
|----------------|---------------|------------------|
| `source` | `"employee_handbook_2024.pdf"` | Lets you trace any answer back to the exact file it came from |
| `page` | `3` | Lets a human (or the LLM's citation) point to the specific page to verify |
| `section` | `"Time Off Policy"` | Enables filtering retrieval to a specific section of a large document |
| `last_modified` | `"2024-03-15"` | Lets you detect and prefer fresher information, or flag stale content |
| `doc_type` | `"policy"` vs `"slack_message"` | Lets you weight or filter sources by trustworthiness/type |

Two of these matter enough to call out by name, because they set up work you'll do explicitly later in this course:

- **Filtering at retrieval time (Phase 8).** Metadata lets you narrow a search *before* similarity scoring even runs — e.g. "only search chunks where `doc_type == 'policy'` and `last_modified` is within the last year." Without metadata attached to every chunk, this kind of filtering is simply impossible; you'd only have raw text with no attributes to filter on.
- **Citations.** When the LLM's final answer needs to say "according to the Employee Handbook, page 3," that sentence is only possible because `source` and `page` metadata survived, attached to the retrieved chunk, all the way from Phase 3 through retrieval and into the final generated response.

---

## 4. Building a Document Object

Rather than passing plain strings and separate metadata dictionaries around independently (easy to accidentally mismatch), the standard approach is to bundle both into a single object. Python's `dataclasses` module is a clean way to define this: it's a decorator that auto-generates the boilerplate `__init__` method (and a few others) for a class whose main job is just to hold a fixed set of named fields — you get a normal class, just without hand-writing the repetitive constructor yourself.

```python
from dataclasses import dataclass
from pypdf import PdfReader

@dataclass
class Document:
    content: str
    metadata: dict


def load_pdf_as_documents(path: str, doc_type: str = "policy") -> list[Document]:
    """
    Load a PDF and return one Document per page, each carrying
    its own metadata -- most importantly, which page it came from.
    """
    reader = PdfReader(path)
    documents = []

    for page_number, page in enumerate(reader.pages):
        text = page.extract_text()
        doc = Document(
            content=text,
            metadata={
                "source": path,
                "page": page_number + 1,  # human-friendly, 1-indexed
                "doc_type": doc_type,
            },
        )
        documents.append(doc)

    return documents


docs = load_pdf_as_documents("employee_handbook_2024.pdf")
print(docs[2].content[:100])
print(docs[2].metadata)
```

Example output:

```
Section 2: Time Off Policy

Full-time employees accrue 1.5 days of paid time off per month...
{'source': 'employee_handbook_2024.pdf', 'page': 3, 'doc_type': 'policy'}
```

Notice `docs[2]` (Python lists are zero-indexed, so the third element is at position 2) corresponds to `page: 3` in its own metadata — the loader deliberately converts from `pypdf`'s zero-indexed page numbering to a human-friendly 1-indexed page number at the moment of loading, so that anything downstream (including a citation shown to a user) says "page 3" rather than the more confusing "page 2."

One more detail worth flagging in the `Document` definition itself: `metadata: dict` gives every `Document` its own metadata dictionary, but be careful if you ever add a *default* value for a dataclass field that's a mutable type like a dict or list — writing `metadata: dict = {}` directly would cause every `Document` instance to unintentionally *share the exact same dictionary object*, so that changing one document's metadata would silently change every other document's metadata too. Python's `dataclasses` module actually raises an error if you try this directly; the fix, if you need a default, is to import `field` from `dataclasses` and write `field(default_factory=dict)`, which tells the dataclass to call `dict()` fresh for every new instance instead of reusing one shared object. In the example above we sidestep the issue entirely by always passing metadata explicitly, but it's worth knowing why the shortcut is dangerous the first time you reach for it.

---

## 5. A Brief Note on Tables and Images

Two categories of content deserve a preview here, even though full treatment comes much later in this course.

**Tables.** A table extracted naively as plain text (the way `pypdf`'s `extract_text()` handles it) often collapses rows and columns into a jumbled run-on string, losing the alignment that gave the table its meaning in the first place. A better approach — briefly previewed here — is to extract tables *as tables*, either as a Markdown table (`| Column A | Column B |` syntax, which an LLM can read structurally) or as structured JSON (a list of row dictionaries). Libraries like `pdfplumber` or `camelot` specialize in table extraction specifically, returning row/column structure instead of flattened text. The metadata pattern from this lesson still applies directly: a table extracted this way is just another `Document`, with `content` holding the Markdown/JSON representation and `metadata` recording which page and section it came from.

**Images.** Some documents contain meaningful images — charts, diagrams, scanned handwriting, photos with captions. Handling these well (generating a text caption/description of an image so it becomes searchable alongside regular text, or embedding the image directly with a multimodal model) is a substantial topic of its own, and this course covers it in full starting **Phase 13**. For now, the only thing worth internalizing is that an image in a source document isn't simply "skipped" in a well-built pipeline — it's a gap that eventually needs its own handling, and pretending it doesn't exist (silently dropping every image) is a common but costly shortcut in early RAG prototypes.

---

## 6. Common Mistakes

**Mistake 1: Losing metadata during cleaning or chunking.** It's easy to build a cleaning function (Lesson 2) or a chunking function (Phase 4) that takes a plain string in and returns a plain string (or list of strings) out — quietly dropping the `Document` wrapper and its metadata along the way, because the function signature only cared about the text. Once metadata is lost at any stage, it cannot be recovered later; there's no way to look at a bare string of cleaned or chunked text and reconstruct which page it came from after the fact. Every function in your pipeline that transforms text should be written to accept and return the metadata-carrying `Document` (or an equivalent chunk object), not a bare string, specifically to prevent this.

**Mistake 2: Not tracking source well enough to support citations.** It's tempting to store just a vague `source` like `"handbook"` rather than `"employee_handbook_2024.pdf"` with a specific `page` number, on the theory that "we'll clean it up later." In practice, by the time a user is asking "where did this answer come from," reconstructing the exact page or section after the fact is often impossible — the specificity has to be captured at load time, when you actually have access to the page number, or it's gone for good.

**Interview angle:** a common interview probe is "how would you build citations into a RAG system's answers?" A weak answer jumps straight to prompt engineering ("just tell the model to cite its sources"). A strong answer starts from ingestion: citations are only possible if `source`, `page`, and `section` metadata were captured and preserved all the way from document loading through cleaning, chunking, and retrieval — the LLM can't cite information it was never given in the first place.

---

## 7. Hands-On Exercises

### Exercise 1 — Build Documents from a real PDF

**Goal:** Practice the `Document` pattern end-to-end.

Using a real PDF you have on hand, adapt `load_pdf_as_documents()` from Section 4 to also add a `section` field to the metadata (you can set it manually per page, or write a simple heuristic that looks for a line matching a pattern like `"Section \d+:"` at the top of each page's extracted text). Print out the metadata for every page and confirm each one has the right page number and section.

### Exercise 2 — Trace metadata through a cleaning step

**Goal:** Directly confront the "losing metadata during cleaning" mistake.

Take the `clean_text()` function from Lesson 2 (which accepts and returns a plain string) and write a small wrapper `clean_document(doc: Document) -> Document` that applies `clean_text()` to `doc.content` while explicitly preserving `doc.metadata` unchanged in the returned `Document`. Confirm that after cleaning, `page` and `source` are still exactly what they were before.

### Exercise 3 — Design a citation string

**Goal:** Connect metadata directly to a user-facing outcome.

Given a `Document` with `metadata = {"source": "employee_handbook_2024.pdf", "page": 3, "section": "Time Off Policy"}`, write a small function `format_citation(doc: Document) -> str` that produces a human-readable citation string, e.g. `"Employee Handbook (2024), Section: Time Off Policy, p. 3"`. This is a preview of exactly the kind of formatting a generation step (much later in this course) would use to make an LLM's answer verifiable.

---

## 8. Interview Q&A

### Q1. Why isn't clean text on its own sufficient for a production RAG system?

**Answer:** Clean text tells you *what* was said but not *where it came from* — which document, which page, which section, or how current it is. Without that context attached as metadata, you can't filter retrieval by source or recency, and you can't produce a citation a user could go verify, which matters enormously for trust in domains like legal, medical, or internal policy questions.

---

### Q2. What's a practical way to structure a document plus its metadata in code?

**Answer:** A small object (e.g. a Python dataclass) with two fields: `content` (the actual text) and `metadata` (a dictionary of facts about that text — source, page, section, timestamp). Bundling both together, rather than passing strings and metadata around as separate parallel lists, avoids the two ever accidentally getting mismatched as they move through cleaning, chunking, and retrieval.

---

### Q3. Why does metadata matter for something as specific as retrieval filtering, and when does that come up?

**Answer:** Metadata lets you narrow the search space *before* similarity scoring runs, e.g. only searching chunks from documents newer than a certain date, or only from a specific document type. This is covered in depth in Phase 8 (Retrieval Strategies) — but it's only possible at all if metadata was captured and preserved starting all the way back at document loading in Phase 3.

---

### Q4. How should tables be handled during document loading, at a high level?

**Answer:** Rather than letting a naive text extractor flatten a table's rows and columns into a jumbled run-on string, tables should ideally be extracted with their structure intact — as a Markdown table or as structured JSON (a list of row records) — so an LLM reading the retrieved chunk later can still understand which value belongs to which row and column.

---

### Q5. What's deferred to later in the course when it comes to structured content?

**Answer:** Full handling of images — generating captions or descriptions so image content becomes searchable, or using multimodal embeddings — is deferred to Phase 13. This lesson's scope is limited to establishing that images are a known gap needing eventual handling, not something to silently ignore.

---

> 🧠 **Memory hook:** "No catalog card, no way back to the book — attach source, page, and section to every chunk, or you can never prove where an answer came from."
