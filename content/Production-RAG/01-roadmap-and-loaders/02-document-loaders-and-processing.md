> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 1.1: Production RAG Architecture Roadmap](01-production-rag-architecture-roadmap.md) | ➡️ [Module 2.1: Production Chunking Strategies Deep Dive](../02-chunking-strategies/01-chunking-strategies-deep-dive.md)

---

# Module 1 — Document Loaders and Document Processing

`Lesson 1 of Production RAG`

Our first goal is to turn raw documents into clean, structured text that the RAG pipeline can process.

## 1.1 What is a document loader?

Imagine a company has 10,000 PDF files, Word documents and web pages. An LLM cannot automatically search those files just because they exist on your server.

A **document loader** reads a source and extracts its content into a format your application can process.

For example:

- PDF loader → extracts text from PDFs.
- DOCX loader → extracts paragraphs and tables from Word documents.
- Web loader → retrieves page content.
- Database loader → retrieves records from a database.
- OCR pipeline → extracts text from scanned documents and images.

The first production concern is that *extracting text is not the same as understanding a document*. Tables, page boundaries, headings and reading order can be lost during extraction.

## 1.2 Our first implementation

We'll start with Python and `pypdf`, then later connect the loader to chunking, embeddings and a vector database.

### Step 1 — Install dependencies

```bash
mkdir production-rag
cd production-rag

python3 -m venv .venv
source .venv/bin/activate

pip install pypdf
```

Create a folder structure:

```text
production-rag/
├── documents/
│   └── refund_policy.pdf
├── app/
│   └── document_loader.py
└── requirements.txt
```

Save the dependencies:

```bash
pip freeze > requirements.txt
```

Place a sample PDF named `refund_policy.pdf` in the `documents` directory.

### Step 2 — Extract text from a PDF

Create `app/document_loader.py`.

```python

from pathlib import Path
from pypdf import PdfReader

def load_pdf(file_path: str) -> list[dict]:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    reader = PdfReader(str(path))
    documents = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()

        if not text:
            continue

        documents.append({
            "text": text,
            "metadata": {
                "source": path.name,
                "page": page_number,
                "document_type": "pdf",
            },
        })

    return documents

if __name__ == "__main__":
    docs = load_pdf("documents/refund_policy.pdf")

    for doc in docs:
        print(f"Source: {doc['metadata']['source']}")
        print(f"Page: {doc['metadata']['page']}")
        print(doc["text"][:300])
        print("-" * 40)

```

Run it:

```bash
python -m app.document_loader
```

### Step 3 — Understand the output

Suppose the PDF has two pages. The loader might return:

```python
[
    {
        "text": "Customers may request a refund within 30 days...",
        "metadata": {
            "source": "refund_policy.pdf",
            "page": 1,
            "document_type": "pdf"
        }
    },
    {
        "text": "Approved refunds are processed within 5–7 business days...",
        "metadata": {
            "source": "refund_policy.pdf",
            "page": 2,
            "document_type": "pdf"
        }
    }
]
```

Notice that we don't return just strings. We return **text plus metadata**.

Why does that matter? Later, if the LLM answers a question using text from page 2, the application needs to know which document and page supplied the evidence.

This metadata will follow the content through chunking, embedding and retrieval.

## 1.3 Production concepts you must understand

> 💡 **Core Engineering Principles**: In a production document pipeline, data loading is not just reading files off a disk—it is an untrusted distributed ingestion system that must handle corrupted files, security attacks, OCR, and multitenancy.

### 📄 A. Scanned PDFs and OCR
`pypdf` extracts embedded text; it does not perform OCR. A scanned PDF might contain images of pages rather than actual text. For these files, use an OCR solution such as Tesseract or a cloud document-processing service (e.g., AWS Textract, Google Cloud Document AI).

### 🏷️ B. Metadata Preservation
Keep fields such as `source`, `page`, `document_id`, `tenant_id` and access permissions. These support citations, filtering, document updates, and secure retrieval so users never access unauthorized data.

### 🛡️ C. File Validation and Security
Production systems should enforce file-size and page-count limits, verify supported formats, isolate document processing, and avoid trusting filenames or file contents. Uploaded documents can contain malicious payloads or prompt-injection instructions.

### 🔄 D. Retries and Failure Handling
A corrupted file should not crash an entire ingestion batch. Record failures, retry transient errors with exponential backoff, and move persistently failing files into a dead-letter/failed-job queue for engineering investigation.

### ⚡ E. Deduplication and Document Versions
Use stable document IDs and content hashes (e.g. SHA-256) to detect unchanged or duplicate files. When a document changes, reprocess its content and remove or replace obsolete chunks so the system doesn't retrieve outdated policies.

## 1.4 How does this connect to LangChain?

You can also use a framework-provided loader:

```bash
pip install langchain-community pypdf
```

```python
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("documents/refund_policy.pdf")
documents = loader.load()

for document in documents:
    print(document.page_content)
    print(document.metadata)
```

LangChain represents each document with `page_content` and `metadata`. This is convenient when the next steps use LangChain text splitters, embedding integrations and retrievers.

Our earlier implementation is useful for learning the fundamentals and retaining control over error handling. Neither approach automatically makes the overall system production-ready.

## 1.5 Check your understanding

### Question 1: Why do we preserve page numbers in metadata?
- [ ] A) To make embeddings smaller
- [x] B) **To identify the source of retrieved content and support citations**
- [ ] C) To improve the PDF's visual quality

> **Explanation:** Preserving `source` and `page` in metadata enables the RAG pipeline to output verifiable citations with direct page references back to the user.

---

### Question 2: What should we do when a PDF contains scanned images?
- [ ] A) Assume the normal text extractor will read everything
- [ ] B) Skip every PDF that contains images
- [x] C) **Use OCR when text extraction is insufficient**

> **Explanation:** Plain text extractors like `pypdf` cannot read rasterized images or scanned documents without Optical Character Recognition (OCR).

---

### Question 3: A document is updated. What production issue must we prevent?
- [x] A) **Retrieving stale chunks from the old version**
- [ ] B) Adding metadata to the new document
- [ ] C) Keeping a stable document ID

> **Explanation:** If obsolete chunks are not purged or invalidated using document version hashes, the LLM will retrieve outdated policies and hallucinate old terms.

**What comes next:** Module 2 — Chunking strategies. We'll learn why putting an entire PDF into one vector is a bad idea, how chunk size and overlap affect retrieval quality, and how to implement a recursive text splitter in Python.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 1.1: Production RAG Architecture Roadmap](01-production-rag-architecture-roadmap.md) | ➡️ [Next: Module 2.1: Production Chunking Strategies Deep Dive](../02-chunking-strategies/01-chunking-strategies-deep-dive.md)
