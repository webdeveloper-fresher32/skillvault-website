# Document Loaders and Parsers — Complete Guide

> "A library's digital intake scanner ingests microfilms, rare manuscripts, and audio transcripts, cataloging each with uniform barcodes and metadata."

---

## Table of Contents

1. [The Problem: Ingestion of Heterogeneous File Formats](#1-the-problem-ingestion-of-heterogeneous-file-formats)
2. [The Library Intake Scanner Analogy](#2-the-library-intake-scanner-analogy)
3. [The Mechanism: The Document Schema and Loaders](#3-the-mechanism-the-document-schema-and-loaders)
4. [Diagram: Document Ingestion Pipeline](#4-diagram-document-ingestion-pipeline)
5. [Code Walkthrough: Lazy Loading Multi-Format Documents](#5-code-walkthrough-lazy-loading-multi-format-documents)
6. [Comparing Document Loaders](#6-comparing-document-loaders)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Ingestion of Heterogeneous File Formats

Enterprise knowledge lives in fragmented formats: multi-page PDF reports, Confluence HTML pages, CSV spreadsheets, and nested markdown files.

### The Raw Data Chaos

```text
Raw Sources:
  annual_report.pdf    → binary stream with tables, headers, and images
  sales_data.csv       → comma-separated rows with column headers
  wiki_page.html       → DOM tree with navigation bars, scripts, and CSS
  
  → Manually writing bespoke parsers for 20+ file formats is unmaintainable.
  → In-memory loading of 10,000 PDFs crashes server memory (OOM error).
```

### The Solution: LangChain Document Abstraction

LangChain normalizes any data source into a uniform `Document(page_content="...", metadata={...})` object with batch and lazy-loading iterators (`.lazy_load()`).

---

## 2. The Library Intake Scanner Analogy

A national archive does not store loose handwritten letters, cassette tapes, and bound books in chaotic heaps.

### Raw Piles vs Standard Catalog Cards

```text
Raw Piles       → Boxes of unindexed blueprints, tapes, and paper sheets;
                  researchers cannot search or cross-reference.

Standard Intake → Every item scanned, transcribed to text, stamped with:
                  Content: "[Transcribed text]"
                  Metadata: { Author: "X", Date: "Y", Source: "Box 4", Page: 12 }
```

### Mapping to LangChain

The loader extracts the raw text into `page_content` and preserves critical provenance (source path, page number, creation date) in `metadata`.

---

## 3. The Mechanism: The Document Schema and Loaders

Every loader in `langchain-community` implements the `BaseLoader` interface (`load` and `lazy_load`).

### Standard Document and Loader Usage

```python
from langchain_core.documents import Document
from langchain_community.document_loaders import (
    PyPDFLoader,
    WebBaseLoader,
    DirectoryLoader,
    CSVLoader
)

# 1. Standard Document object
doc = Document(
    page_content="PostgreSQL supports ACID transactions with MVCC.",
    metadata={"source": "databases.pdf", "page": 4, "topic": "storage"}
)

# 2. PDF Loader (extracts page-by-page)
pdf_loader = PyPDFLoader("docs/system_spec.pdf")
pdf_docs = pdf_loader.load()  # Returns List[Document]

# 3. Web Scraper Loader (extracts HTML text)
web_loader = WebBaseLoader("https://docs.python.org/3/")
web_docs = web_loader.load()
```

---

## 4. Diagram: Document Ingestion Pipeline

### Ingestion and Transformation Lifecycle

```text
Raw Sources: [PDF Files] [CSV Tables] [Web URLs] [Markdown Files]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Document Loader Layer                       │
│    PyPDFLoader / CSVLoader / WebBaseLoader / TextLoader     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (Extracted & Normalized)
┌─────────────────────────────────────────────────────────────┐
│                   List[Document] / Iterator                 │
│  Document(                                                  │
│    page_content="...extracted clean text...",               │
│    metadata={"source": "path.pdf", "page": 1, ...}          │
│  )                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Downstream: Text Splitter ──▶ Embeddings ──▶ Vector Store   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Lazy Loading Multi-Format Documents

A memory-efficient directory ingestion script utilizing `.lazy_load()` to process gigabytes of files without memory exhaustion:

```python
# document_loader_demo.py
import os
from typing import Iterator
from langchain_core.documents import Document
from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader

def ingest_directory_stream(dir_path: str) -> Iterator[Document]:
    """Memory-safe lazy loader for large document repositories."""
    if not os.path.exists(dir_path):
        raise FileNotFoundError(f"Directory {dir_path} does not exist.")

    # Configure directory loader with specific glob pattern
    loader = DirectoryLoader(
        dir_path,
        glob="**/*.txt",
        loader_cls=TextLoader,
        show_progress=True,
        use_multithreading=True
    )

    # Yield documents one by one to keep memory consumption low
    for document in loader.lazy_load():
        # Inject custom enrichment metadata
        document.metadata["file_size_bytes"] = len(document.page_content)
        document.metadata["verified"] = True
        yield document

if __name__ == "__main__":
    os.makedirs("./sample_vault", exist_ok=True)
    with open("./sample_vault/doc1.txt", "w") as f:
        f.write("LangChain document loading fundamentals.")

    for doc in ingest_directory_stream("./sample_vault"):
        print("Loaded:", doc.metadata["source"], "| Size:", doc.metadata["file_size_bytes"])
```

---

## 6. Comparing Document Loaders

| Loader | Target Source | Extraction Strategy | Key Metadata Extracted | Dependencies |
|---|---|---|---|---|
| `PyPDFLoader` | PDF files | Page-by-page text extraction | `source`, `page` (0-indexed) | `pypdf` |
| `WebBaseLoader` | Web URLs | BeautifulSoup HTML parsing | `source`, `title`, `language` | `beautifulsoup4` |
| `CSVLoader` | CSV files | One document per row | `source`, `row` number | standard `csv` |
| `DirectoryLoader` | Local Folders | Recursive glob scanning | `source`, file path | `glob` / `tqdm` |
| `UnstructuredLoader`| Multi-modal | Advanced OCR & layout parsing | `source`, `coordinates`, `category` | `unstructured` |

---

## 7. Common Mistakes

- **Using `.load()` on massive corpora.** Calling `.load()` loads all documents into RAM at once. For thousands of PDFs, always use `.lazy_load()` to process documents in a streaming fashion.
- **Losing metadata during document transforms.** When modifying `page_content`, never create a new `Document` without copying `doc.metadata` from the original document.
- **Scraping web pages without user-agent headers.** `WebBaseLoader` may trigger 403 Forbidden errors on sites with bot protection; pass custom request headers via `requests_kwargs`.
- **Ignoring 0-indexed page numbers.** `PyPDFLoader` numbers pages starting at 0 (`page: 0` is page 1 of the PDF).
- **Not cleaning non-text HTML elements.** Parsing raw HTML without filtering `<script>` and `<nav>` tags poisons vector embeddings with useless boilerplate.

---

## 8. Hands-On Exercises

**Exercise 1:** Instantiate a `Document` object with custom `page_content` and metadata keys (`author`, `category`, `timestamp`).

**Exercise 2:** Use `WebBaseLoader` to load a public documentation page and print the title and word count from the extracted document.

**Exercise 3:** Create a directory with 3 text files and use `DirectoryLoader` with `use_multithreading=True` to load all files concurrently.

**Exercise 4:** Implement a generator function that reads a CSV file with `CSVLoader` using `.lazy_load()` and filters rows where a specific column value matches a condition.

**Exercise 5:** Load a multi-page PDF using `PyPDFLoader`, iterate through the returned pages, and print the character count of each individual page.

---

## 9. Interview Q&A

**Q: What are the two core attributes of a LangChain `Document` object?**
`page_content` (a string containing the raw textual content) and `metadata` (a Python dictionary containing contextual key-value pairs like `source`, `page`, `author`, or custom tags).

**Q: Why is metadata preservation critical during the document loading and RAG lifecycle?**
Metadata enables provenance tracking (citing the exact source file and page number to users) and supports metadata filtering in vector databases (e.g. searching only documents created in 2026).

**Q: What is the architectural difference between `.load()` and `.lazy_load()` in `BaseLoader`?**
`.load()` synchronously parses and loads all documents into an in-memory list, which can cause out-of-memory errors on large datasets. `.lazy_load()` returns a Python generator yielding one document at a time.

**Q: How does `PyPDFLoader` structure loaded PDF documents?**
`PyPDFLoader` creates a separate `Document` object for every individual page of the PDF, storing the 0-indexed page number in `doc.metadata["page"]` and file path in `doc.metadata["source"]`.

**Q: How can you load multiple file extensions (e.g. `.pdf`, `.md`, `.txt`) using `DirectoryLoader`?**
You can instantiate multiple `DirectoryLoader` instances with distinct `glob` patterns and `loader_cls` mappings, or use `UnstructuredDirectoryLoader` to handle multiple file types automatically.
