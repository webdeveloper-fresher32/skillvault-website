# Project 2: PDF Knowledge Base Assistant

## Goal

Move from toy text files to real-world PDFs, apply a smarter chunking strategy than fixed-size splitting, store the result in a managed cloud vector database (Pinecone), and support basic metadata filtering at query time.

## What You'll Build

An assistant that ingests a small stack of real PDF documents (manuals, papers, reports — whatever you have on hand), splits them using recursive (or semantic) chunking, stores them in a Pinecone index with per-document metadata, and answers questions that can optionally be scoped to a specific document via a metadata filter.

## Phases Required

- Phase 3 — Document Loading & Preprocessing
- Phase 4 — Chunking Strategies
- Phase 6 — Vector Databases II (Pinecone)

## Requirements

- Load at least 3 real PDF files using `pypdf` (or equivalent), extracting text per page.
- Clean the extracted text: normalize whitespace and strip obvious boilerplate (headers, footers, page numbers) introduced by PDF extraction.
- Attach metadata to every loaded chunk: at minimum source filename and page number.
- Chunk documents using `RecursiveCharacterTextSplitter` (or a semantic chunking approach) rather than naive fixed-size splitting, and be able to explain why the result differs from Project 1's fixed-size chunks.
- Create a Pinecone index with a dimension matching your embedding model, and upsert chunks in batches with their metadata.
- Support basic metadata filtering at query time: e.g. restrict a query to a single source document, or to a specific page range.
- Answer questions with citations that include both the source filename and the page number.

## Suggested Approach

1. Gather 3+ real PDFs of varying quality (a clean report, a manual with headers/footers, something with tables if you can find one).
2. Load each PDF page-by-page with `pypdf`, keeping page number as part of each page's metadata.
3. Write a cleaning pass that strips repeated headers/footers (they usually repeat verbatim across pages, making them easy to detect) and collapses excess whitespace.
4. Apply `RecursiveCharacterTextSplitter` to the cleaned page text, carrying `{source, page}` metadata onto every resulting chunk. Compare a few chunks against what fixed-size chunking from Project 1 would have produced on the same text.
5. Create a Pinecone index (correct dimension for your embedding model, cosine or dot-product metric), then embed and upsert chunks in batches, storing `{source, page, chunk_text}` as metadata alongside each vector.
6. Build a query function that accepts an optional filter (e.g. `{"source": "manual.pdf"}`) and passes it through to Pinecone's query call alongside the embedded question.
7. Retrieve top-k chunks (filtered or unfiltered), assemble a prompt, generate an answer, and format citations as `(filename, page N)`.

## Stretch Goals

- Add a page-range filter (e.g. "only search pages 10-20") in addition to the per-document filter.
- Handle a PDF with tables by extracting them separately and giving them their own metadata tag (`content_type: table`).
- Compare answer quality and chunk boundaries between recursive chunking and a simple semantic chunking pass on the same PDF.

## Evaluation Checklist

- [ ] All PDFs load without crashing, including ones with unusual layouts.
- [ ] Extracted text is free of obvious repeated header/footer boilerplate.
- [ ] Every chunk carries correct source filename and page number metadata.
- [ ] A query scoped with a metadata filter to one document only returns chunks from that document.
- [ ] Answers cite filename and page number, and the cited page actually contains the supporting text.
- [ ] You can explain in one or two sentences why recursive chunking produced different (and usually better) boundaries than fixed-size chunking on the same text.
