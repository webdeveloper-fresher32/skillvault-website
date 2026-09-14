# Text Splitters and Chunking — Complete Guide

> "A bookbinder divides an encyclopedia into handy indexed volumes with overlapping summaries, rather than slicing pages blindly with a paper guillotine."

---

## Table of Contents

1. [The Problem: Context Limits and Semantic Fragmentation](#1-the-problem-context-limits-and-semantic-fragmentation)
2. [The Bookbinder Analogy](#2-the-bookbinder-analogy)
3. [The Mechanism: Recursive Splitting and Markdown Headers](#3-the-mechanism-recursive-splitting-and-markdown-headers)
4. [Diagram: Recursive Splitting Hierarchy](#4-diagram-recursive-splitting-hierarchy)
5. [Code Walkthrough: Header-Aware Recursive Chunking](#5-code-walkthrough-header-aware-recursive-chunking)
6. [Comparing LangChain Text Splitters](#6-comparing-langchain-text-splitters)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Context Limits and Semantic Fragmentation

LLM embedding models have maximum token limits (e.g. 512 or 8192 tokens). Ingesting whole 50-page documents creates noisy embeddings and exceeds context windows.

### Blind Splitting vs Context-Aware Chunking

```text
Fixed Character Splitting:
  "...The database password is" | " Secret123! Do not share..."
  → Slices words and sentences right in the middle
  → Loses subject context across chunk boundaries
  → Vector search retrieves half-sentences with zero semantic meaning
```

### The Solution: Semantic and Recursive Text Splitters

LangChain splitters preserve natural semantic boundaries (paragraphs, sentences, markdown headings) and add configurable chunk overlap.

---

## 2. The Bookbinder Analogy

A skilled bookbinder dividing a manuscript into chapters cuts at natural paragraph breaks and duplicates the last sentence of each volume at the start of the next.

### Blind Guillotine vs Master Bookbinder

```text
Guillotine Cut  → Slices every exactly 1,000 characters;
                  chops words in half, separates titles from sections.

Master Binder   → Cuts at chapter headings (H1, H2), then paragraphs (\n\n);
                  copies a 100-character overlap so continuity is never lost.
```

### Mapping to LangChain

`RecursiveCharacterTextSplitter` tries paragraph splits first, then sentence splits, preserving markdown header metadata via `MarkdownHeaderTextSplitter`.

---

## 3. The Mechanism: Recursive Splitting and Markdown Headers

LangChain provides text splitters inheriting from `TextSplitter` in `langchain-text-splitters`.

### Core Text Splitters

```python
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
    TokenTextSplitter
)

# 1. Recursive Character Text Splitter (Default workhorse)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", " ", ""]
)

# 2. Markdown Header Splitter (Preserves document hierarchy in metadata)
headers_to_split_on = [
    ("#", "Header_1"),
    ("##", "Header_2"),
    ("###", "Header_3"),
]
md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
```

---

## 4. Diagram: Recursive Splitting Hierarchy

### Splitting Decision Flow

```text
Large Document Text Block (Length > chunk_size)
                     │
                     ▼
  Can it be split by "\n\n" (Double Newline / Paragraphs)?
        ┌────────────┴────────────┐
       Yes                        No
        │                         │
        ▼                         ▼
Split into paragraphs       Can it be split by "\n" (Single Newline / Lines)?
        │                         ┌────────────┴────────────┐
        │                        Yes                        No
        │                         │                         │
        │                         ▼                         ▼
        │                   Split into lines         Can it be split by " " (Spaces)?
        │                         │                         ┌────────────┴────────────┐
        │                         │                        Yes                        No
        │                         │                         │                         │
        │                         │                         ▼                         ▼
        │                         │                  Split into words        Hard Character Cut
        └─────────────────────────┼─────────────────────────┴─────────────────────────┘
                                  │
                                  ▼
         Merge Chunks to target chunk_size with chunk_overlap
```

---

## 5. Code Walkthrough: Header-Aware Recursive Chunking

A production-grade two-stage chunking pipeline combining Markdown header extraction with recursive sub-chunking:

```python
# text_splitter_demo.py
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter
)

def process_markdown_corpus(markdown_text: str):
    # Stage 1: Split along structural Markdown headings
    headers = [
        ("#", "h1"),
        ("##", "h2"),
        ("###", "h3")
    ]
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers,
        strip_headers=False
    )
    section_docs = header_splitter.split_text(markdown_text)

    # Stage 2: Sub-split large sections recursively
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len
    )
    final_chunks = text_splitter.split_documents(section_docs)

    return final_chunks

if __name__ == "__main__":
    sample_md = """# LangChain Architecture\n\nLangChain simplifies AI development.\n\n## LCEL\n\nLCEL is the declarative language for chaining runnables together with streaming support."""
    chunks = process_markdown_corpus(sample_md)
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i+1} Metadata: {chunk.metadata}")
        print(f"Content: {chunk.page_content}\n")
```

---

## 6. Comparing LangChain Text Splitters

| Splitter | Splitting Criterion | Metadata Preserved | Best Used For |
|---|---|---|---|
| `RecursiveCharacterTextSplitter` | Hierarchy: `\n\n`, `\n`, ` `, `""` | Source document metadata | General plain text, articles, code comments |
| `MarkdownHeaderTextSplitter` | Markdown `#`, `##`, `###` headings | Heading titles as metadata fields | Markdown technical docs, wikis, READMEs |
| `TokenTextSplitter` | Direct BPE / TikToken token counts | Source document metadata | Strict LLM token context budget limits |
| `HTMLHeaderTextSplitter` | HTML `<h1>`, `<h2>`, `<h3>` tags | HTML tag hierarchy | Scraped web pages and HTML documentation |
| `SemanticChunker` | Embedding distance between sentences | Source document metadata | Deep semantic boundary preservation |

---

## 7. Common Mistakes

- **Confusing character length with token length.** 1,000 characters is roughly 250 tokens in English, but can be 1,000+ tokens for dense code or non-Latin languages.
- **Setting `chunk_overlap` too high or to zero.** Zero overlap causes severed context at boundaries; setting overlap >50% duplicates tokens and bloats vector store costs.
- **Stripping headers with `strip_headers=True`.** Removing the header text from `page_content` reduces embedding quality because the model loses the section title context.
- **Using naive regex splitters.** Custom regexes often fail on edge cases like bullet lists, decimal numbers, and code blocks.
- **Splitting code with text splitters.** For programming languages, use `RecursiveCharacterTextSplitter.from_language(Language.PYTHON)` to preserve class and function definitions.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize `RecursiveCharacterTextSplitter` with `chunk_size=200` and `chunk_overlap=40`. Split a 1,000-word essay and verify the chunk sizes.

**Exercise 2:** Create a markdown string with 3 heading levels and split it using `MarkdownHeaderTextSplitter`. Verify the resulting `doc.metadata` includes the heading hierarchy.

**Exercise 3:** Split Python source code using `RecursiveCharacterTextSplitter.from_language(Language.PYTHON)` and confirm function definitions are kept together.

**Exercise 4:** Implement a token-aware splitter using `RecursiveCharacterTextSplitter.from_tiktoken_encoder()` and compare its output to character splitting.

**Exercise 5:** Build a pipeline that takes a list of `Document` objects, splits them, and verifies that every output chunk retains the parent document's `source` metadata.

---

## 9. Interview Q&A

**Q: Why is `RecursiveCharacterTextSplitter` the recommended default splitter in LangChain?**
Because it attempts to split on paragraph boundaries (`\n\n`) first, then line breaks (`\n`), then words (` `), and only falls back to raw characters as a last resort. This keeps semantically related text together whenever possible.

**Q: What is the purpose of `chunk_overlap` during text splitting?**
`chunk_overlap` duplicates a small portion of text from the end of one chunk to the beginning of the next. This ensures that concepts or sentences spanning the boundary are not split in half, preserving semantic continuity for vector search.

**Q: How does `MarkdownHeaderTextSplitter` enhance RAG retrieval accuracy?**
It extracts markdown header hierarchy (e.g. `{"h1": "AWS", "h2": "S3", "h3": "Security"}`) and injects it into the chunk's metadata, enabling precise metadata filtering and context grounding.

**Q: How do character length and token length differ when chunking text?**
Character length counts raw string characters, while token length counts sub-word tokens processed by the LLM tokenizer. 1 token is roughly 4 characters in English, but varies significantly across languages and code.

**Q: When would you choose `SemanticChunker` over recursive character splitting?**
When documents have irregular formatting without clear headers or paragraphs, and you want chunk boundaries to be determined by significant shifts in semantic meaning (measured via embedding cosine distance).
