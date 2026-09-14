# RAG Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete "RAG" (Retrieval-Augmented Generation) course under `/Users/ganeshpirikirala/Desktop/SkillVault/RAG/`, matching SkillVault's existing course structure (14 phases, Projects/, Quick-Reference/, top-level README.md), per `docs/superpowers/specs/2026-07-24-rag-course-design.md`.

**Architecture:** This is a Markdown-only content repository — no code to test, no build system (see CLAUDE.md). "Tests" in this plan are verification steps: confirm each file exists at the right path, follows the repo's naming/numbering conventions, and contains the required structural sections (Table of Contents, numbered sections, Interview Q&A where applicable). Each phase is one task that creates a `README.md` + numbered lesson files. Content must follow the user's established explanation style (see Style Guide below) and mirror the structural pattern of `MongoDB/Phase-01-Fundamentals/01-What-is-MongoDB.md`.

**Tech Stack:** Markdown only. Code snippets inside lessons are Python (framework-agnostic first, LangChain second), with generation-call examples using the Claude API and vector-DB-specific examples using Chroma/Pinecone/pgvector Python clients as relevant to that phase.

---

## Style Guide (apply to every lesson file in every task below)

Every lesson file (`NN-Topic.md`) must follow this structure, modeled on `MongoDB/Phase-01-Fundamentals/01-What-is-MongoDB.md`:

1. **Title** — `# NN — Topic Name`
2. **One-line description blockquote** — `> A comprehensive reference covering ...`
3. **Table of Contents** — numbered links to every `##` section in the file, including a final "Hands-On Exercises" and "Interview Q&A" section.
4. **Body sections**, each following: **problem** (why this matters, framed as a concrete pain point) → **analogy** (plain-language comparison) → **internal flow** (how it actually works, step by step) → **code example** (Python, runnable/illustrative) → **comparison table** (where relevant — e.g. comparing approaches/tools) → **common mistakes** (a bulleted "pitfalls" list) → **interview angle** (1-2 sentences on how this gets asked in interviews).
5. **Hands-On Exercises** section — 2-3 small practical exercises the learner can do with just Python + the tools covered so far.
6. **Interview Q&A** section — 3-5 short Q&A pairs specific to that lesson's topic (the phase-level `Interview-QA.md` in Quick-Reference aggregates the full 50 across the whole course; per-lesson Q&A is a smaller, topic-scoped set).
7. **Memory hook** — a final one-line callout (e.g. `> 🧠 **Memory hook:** ...`) that gives a short mnemonic or phrase to recall the core idea.

Assume the reader knows Python and a little ML, but has never built a RAG system. Explain any non-trivial Python construct (e.g. async/await, generators, decorators) briefly inline the first time it's used, rather than assuming fluency.

---

## Task 1: Scaffold Course Skeleton

**Files:**
- Create: `RAG/README.md` (placeholder, filled in Task 17)
- Create: `RAG/Phase-01-RAG-Fundamentals/` through `RAG/Phase-14-Production-Patterns-and-Scaling/` (empty directories)
- Create: `RAG/Projects/` (empty directory)
- Create: `RAG/Quick-Reference/` (empty directory)

- [ ] **Step 1: Create the directory structure**

Run:
```bash
cd /Users/ganeshpirikirala/Desktop/SkillVault
mkdir -p RAG/Phase-01-RAG-Fundamentals \
         RAG/Phase-02-LLM-and-Embedding-Basics \
         RAG/Phase-03-Document-Loading-and-Preprocessing \
         RAG/Phase-04-Chunking-Strategies \
         RAG/Phase-05-Vector-Databases-Chroma \
         RAG/Phase-06-Vector-Databases-Pinecone \
         RAG/Phase-07-Vector-Databases-Pgvector \
         RAG/Phase-08-Retrieval-Strategies \
         RAG/Phase-09-Reranking-and-Query-Transformation \
         RAG/Phase-10-RAG-Orchestration-LangChain \
         RAG/Phase-11-Evaluation-and-Observability \
         RAG/Phase-12-Agentic-RAG \
         RAG/Phase-13-GraphRAG-and-Multimodal-RAG \
         RAG/Phase-14-Production-Patterns-and-Scaling \
         RAG/Projects \
         RAG/Quick-Reference
```

- [ ] **Step 2: Verify structure**

Run: `find RAG -maxdepth 1 -type d | sort`
Expected: 17 lines — `RAG`, 14 `Phase-NN-*` dirs, `Projects`, `Quick-Reference`.

- [ ] **Step 3: Commit**

```bash
git add RAG
git commit -m "Scaffold RAG course directory structure"
```

---

## Task 2: Phase 01 — RAG Fundamentals

**Files:**
- Create: `RAG/Phase-01-RAG-Fundamentals/README.md`
- Create: `RAG/Phase-01-RAG-Fundamentals/01-What-is-RAG.md`
- Create: `RAG/Phase-01-RAG-Fundamentals/02-RAG-vs-Fine-Tuning-vs-Long-Context.md`
- Create: `RAG/Phase-01-RAG-Fundamentals/03-RAG-Architecture-Overview.md`

- [ ] **Step 1: Write the phase README**

Following the `AWS/Phase-01-Cloud-Fundamentals/README.md` pattern: an Overview paragraph, a Learning Objectives bulleted list (4-6 items), and an Estimated Study Time table listing the 3 lesson files with topics and hour estimates, plus a total.

- [ ] **Step 2: Write `01-What-is-RAG.md`**

Cover: the problem (LLMs hallucinate, have knowledge cutoffs, don't know private/proprietary data); analogy (open-book vs closed-book exam); what RAG is (retrieve relevant context, then generate); the four-stage flow (index → retrieve → augment → generate) with a simple diagram in a code fence; a minimal end-to-end conceptual example (no code yet, just the flow with a sample query); common misconceptions (RAG isn't a database, RAG isn't fine-tuning); interview angle; hands-on exercises; interview Q&A; memory hook. Follow the full Style Guide above.

- [ ] **Step 3: Write `02-RAG-vs-Fine-Tuning-vs-Long-Context.md`**

Cover: the problem (when do you choose RAG vs fine-tuning vs just stuffing everything into a long context window?); analogy (hiring a researcher with a library card vs sending someone to years of training vs handing someone a huge stack of papers to read every time); a comparison table (RAG vs fine-tuning vs long-context across cost, freshness of knowledge, latency, explainability/citability, implementation complexity); decision guidance (a short flowchart-in-prose: "use RAG when..."); common mistakes (assuming RAG replaces fine-tuning entirely, ignoring cost of large contexts); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-RAG-Architecture-Overview.md`**

Cover: the problem (what are all the moving parts and how do they fit together before we go deep on each one?); analogy (a librarian + card catalog + reference desk); internal flow — walk through: document ingestion → chunking → embedding → vector store → query embedding → similarity search → context assembly → prompt construction → LLM generation → response, with a code-fence ASCII diagram; a preview code example showing a bare-bones RAG loop in ~20 lines of pseudocode-ish Python (no real API calls yet — flagged as "we'll implement each piece for real starting Phase 2"); a table mapping each architecture stage to the phase of this course that covers it in depth; common mistakes (treating RAG as a single step instead of a pipeline with failure points at every stage); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure**

Run: `for f in RAG/Phase-01-RAG-Fundamentals/*.md; do echo "== $f =="; grep -c "^## " "$f"; grep -l "Interview Q&A" "$f"; grep -l "Memory hook" "$f"; done`
Expected: each of the 3 lesson files reports at least 5 `##` sections and matches on both `Interview Q&A` and `Memory hook`; the README shows in the listing too (it uses `##` differently — just confirm it has "Learning Objectives" and "Estimated Study Time" headings via `grep -l "Learning Objectives" RAG/Phase-01-RAG-Fundamentals/README.md` and `grep -l "Estimated Study Time" RAG/Phase-01-RAG-Fundamentals/README.md`).

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-01-RAG-Fundamentals
git commit -m "Add RAG Phase 01: RAG Fundamentals"
```

---

## Task 3: Phase 02 — LLM & Embedding Basics for RAG

**Files:**
- Create: `RAG/Phase-02-LLM-and-Embedding-Basics/README.md`
- Create: `RAG/Phase-02-LLM-and-Embedding-Basics/01-What-is-an-Embedding.md`
- Create: `RAG/Phase-02-LLM-and-Embedding-Basics/02-Vector-Similarity-and-Distance-Metrics.md`
- Create: `RAG/Phase-02-LLM-and-Embedding-Basics/03-Tokenization-and-Context-Windows.md`

- [ ] **Step 1: Write the phase README** (same pattern as Task 2 Step 1: Overview, Learning Objectives, Estimated Study Time table for the 3 files)

- [ ] **Step 2: Write `01-What-is-an-Embedding.md`**

Cover: the problem (computers can't compare meaning of text directly — "dog" and "puppy" are just different strings); analogy (embeddings as GPS coordinates for meaning — similar meanings land near each other on a map); internal flow (text → embedding model → fixed-length vector of floats, with a real small example vector truncated to ~8 dims for illustration); code example calling an embedding API (e.g. `voyageai` or OpenAI embeddings client — show a plain Python snippet: `embed(["a happy dog", "a joyful puppy", "quarterly tax filing"])` and note the first two vectors are close, the third is far); a comparison table of a few embedding model families (dimension size, typical use case, open vs API-based) — no need for exact current benchmarks, describe qualitatively; common mistakes (using different embedding models for indexing vs querying, not normalizing text before embedding); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Vector-Similarity-and-Distance-Metrics.md`**

Cover: the problem (once we have vectors, how do we measure "closeness"?); analogy (comparing the *direction* two arrows point, not just their length — cosine similarity); internal flow explaining cosine similarity, dot product, and Euclidean (L2) distance in plain terms with a tiny worked numeric example (2D vectors, show the arithmetic); code example computing cosine similarity between two vectors in plain Python (no library, just the formula) then showing the numpy one-liner; comparison table of the three metrics (when each is preferred, normalization requirements); common mistakes (comparing un-normalized vectors, assuming higher dimensionality always means better similarity); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Tokenization-and-Context-Windows.md`**

Cover: the problem (LLMs don't read raw text, and every model has a limit on how much it can read at once); analogy (a translator who reads in fixed-size word chunks, not letter by letter); internal flow (text → tokens → why token count matters for chunking and cost, briefly mention subword tokenization without deep BPE algorithm detail); code example estimating token count for a string (e.g. using `tiktoken` or a simple heuristic, explicitly noted as an estimate); table of typical context window sizes for a few current model tiers (described qualitatively, e.g. "small/medium/large" rather than pinned numbers that will go stale); common mistakes (forgetting the prompt template + retrieved context + question all count against the context window, not the raw document); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure**

Run: `for f in RAG/Phase-02-LLM-and-Embedding-Basics/*.md; do grep -c "^## " "$f"; done` and confirm each lesson file has ≥5 sections; confirm README has Learning Objectives + Estimated Study Time headings (same grep pattern as Task 2 Step 5).

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-02-LLM-and-Embedding-Basics
git commit -m "Add RAG Phase 02: LLM and Embedding Basics"
```

---

## Task 4: Phase 03 — Document Loading & Preprocessing

**Files:**
- Create: `RAG/Phase-03-Document-Loading-and-Preprocessing/README.md`
- Create: `RAG/Phase-03-Document-Loading-and-Preprocessing/01-Loading-Documents.md`
- Create: `RAG/Phase-03-Document-Loading-and-Preprocessing/02-Cleaning-and-Normalizing-Text.md`
- Create: `RAG/Phase-03-Document-Loading-and-Preprocessing/03-Metadata-and-Structured-Content.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Loading-Documents.md`**

Cover: the problem (real-world knowledge lives in PDFs, HTML pages, Word docs, plain text — not neatly formatted strings); analogy (a mailroom sorting different envelope shapes into one common tray); internal flow (loader abstraction: input file → parser library → plain text + basic structure); code examples loading a PDF (`pypdf`), an HTML page (`BeautifulSoup`), and a plain `.txt`/`.md` file, each as a short Python snippet with output shown; comparison table of loader types (format, library, gotchas e.g. PDF text extraction losing layout); common mistakes (assuming PDF extraction preserves reading order, ignoring encoding issues); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Cleaning-and-Normalizing-Text.md`**

Cover: the problem (raw extracted text is messy — headers/footers repeated, broken line breaks, weird whitespace); analogy (editing a rough transcript before publishing it); internal flow (a cleaning pipeline: strip boilerplate → normalize whitespace → fix encoding artifacts → optionally lowercase/deduplicate); code example: a small Python function `clean_text(raw: str) -> str` doing whitespace collapsing and boilerplate stripping with a regex, with before/after sample text; common mistakes (over-cleaning and destroying meaningful structure like code blocks or tables, cleaning after chunking instead of before); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Metadata-and-Structured-Content.md`**

Cover: the problem (plain text alone loses context — which document, which page, which section did this come from?); analogy (a library card catalog entry attached to every book, not just the book itself); internal flow (attaching metadata dict to each document/chunk: source, page number, section title, timestamps — and why this matters later for filtering in Phase 8); code example building a `Document` object (simple dataclass: `content: str`, `metadata: dict`) from a loaded PDF, attaching page numbers; brief note on handling tables (extracting as markdown tables or structured JSON) and images (captioning, deferred fully to Phase 13); common mistakes (losing metadata during cleaning/chunking steps, not tracking source for citations); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern as prior tasks, applied to this phase's files)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-03-Document-Loading-and-Preprocessing
git commit -m "Add RAG Phase 03: Document Loading and Preprocessing"
```

---

## Task 5: Phase 04 — Chunking Strategies

**Files:**
- Create: `RAG/Phase-04-Chunking-Strategies/README.md`
- Create: `RAG/Phase-04-Chunking-Strategies/01-Fixed-Size-and-Recursive-Chunking.md`
- Create: `RAG/Phase-04-Chunking-Strategies/02-Semantic-and-Sentence-Window-Chunking.md`
- Create: `RAG/Phase-04-Chunking-Strategies/03-Parent-Document-Retrieval-and-Choosing-Chunk-Size.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Fixed-Size-and-Recursive-Chunking.md`**

Cover: the problem (a whole document is too big to embed as one unit, and too coarse for precise retrieval — but chunk wrong and you cut a sentence in half); analogy (slicing a loaf of bread — even slices are easy but might cut through the good bits; a good baker slices along natural breaks); internal flow (fixed-size character/token chunking with overlap; recursive character splitting that tries paragraph → sentence → word boundaries in order); code example implementing simple fixed-size chunking by hand (~15 lines, with overlap) then showing `RecursiveCharacterTextSplitter` from LangChain doing the smarter version on the same text, comparing outputs; comparison table (fixed-size vs recursive: simplicity, boundary awareness, speed); common mistakes (too much overlap wastes storage/retrieval budget, too little breaks context, ignoring token vs character count mismatch); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Semantic-and-Sentence-Window-Chunking.md`**

Cover: the problem (recursive chunking still splits by structure, not meaning — a topic shift mid-paragraph won't be detected); analogy (a good editor splitting a book into chapters by story beats, not by page count); internal flow (semantic chunking: embed sentences, detect meaning shifts via similarity drop, split there; sentence-window: keep small chunks for precise matching but retrieve a window of surrounding sentences for context); code example: a simplified semantic chunker using sentence embeddings + a similarity threshold to decide split points; comparison table (semantic vs sentence-window vs recursive: precision, compute cost, when each shines); common mistakes (semantic chunking is compute-heavy — don't use it on huge corpora without considering cost; sentence-window can duplicate content across chunks); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Parent-Document-Retrieval-and-Choosing-Chunk-Size.md`**

Cover: the problem (small chunks retrieve precisely but lack context; large chunks have context but dilute relevance — how do you get both?); analogy (finding the exact paragraph in a book via the index, then reading the whole page it's on for context); internal flow (parent-document retrieval: embed small child chunks, but return the larger parent chunk/document they belong to at query time); code example wiring up a simple parent-child chunk mapping (dict of child chunk id → parent document text) and a toy retrieval function; a decision guide/table for choosing chunk size and overlap based on document type (short FAQ vs long technical manual vs code) and downstream use case; common mistakes (one chunk-size-fits-all across very different document types); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern as prior tasks)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-04-Chunking-Strategies
git commit -m "Add RAG Phase 04: Chunking Strategies"
```

---

## Task 6: Phase 05 — Vector Databases I: Chroma

**Files:**
- Create: `RAG/Phase-05-Vector-Databases-Chroma/README.md`
- Create: `RAG/Phase-05-Vector-Databases-Chroma/01-Introduction-to-Vector-Databases.md`
- Create: `RAG/Phase-05-Vector-Databases-Chroma/02-Chroma-Fundamentals.md`
- Create: `RAG/Phase-05-Vector-Databases-Chroma/03-Chroma-Collections-and-Persistence.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Introduction-to-Vector-Databases.md`**

Cover: the problem (once you have thousands/millions of embeddings, a Python list and a for-loop for similarity search doesn't scale); analogy (a phone book organized for fast lookup vs a pile of loose business cards); internal flow (what a vector database adds over brute-force search: approximate nearest neighbor indexes like HNSW/IVFFlat at a conceptual level, no deep math); a comparison table previewing the three vector DBs this course covers (Chroma: local/open-source, Pinecone: managed/cloud, pgvector: SQL-native) with when to reach for each; common mistakes (reaching for a heavyweight managed vector DB when a local one would do for prototyping); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Chroma-Fundamentals.md`**

Cover: the problem (need a fast way to prototype RAG locally without cloud setup/cost); analogy (a personal notebook you can scribble in immediately, vs renting an office); internal flow (installing Chroma, creating a client, creating a collection, adding documents with embeddings + metadata, querying by embedding); full code example: `import chromadb`, create persistent client, create collection, `.add()` documents with ids/embeddings/metadatas, `.query()` with `n_results`, print results; common mistakes (forgetting to pass consistent embedding function between indexing and querying, not setting a persistent path and losing data on restart); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Chroma-Collections-and-Persistence.md`**

Cover: the problem (a real app needs multiple collections, updates, deletes, and durable storage — not just a one-off script); analogy (folders within a filing cabinet, each for a different project); internal flow (multiple collections for multi-tenant/multi-topic use cases, updating/deleting documents by id, persistent vs in-memory client, basic backup consideration); code example: creating two collections for two "knowledge bases", updating a document's metadata, deleting a document, then reopening a persistent client to show data survives; common mistakes (mixing unrelated data in one collection instead of separating by collection, not handling duplicate ids on re-ingestion); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-05-Vector-Databases-Chroma
git commit -m "Add RAG Phase 05: Vector Databases - Chroma"
```

---

## Task 7: Phase 06 — Vector Databases II: Pinecone

**Files:**
- Create: `RAG/Phase-06-Vector-Databases-Pinecone/README.md`
- Create: `RAG/Phase-06-Vector-Databases-Pinecone/01-Pinecone-Fundamentals.md`
- Create: `RAG/Phase-06-Vector-Databases-Pinecone/02-Indexes-Namespaces-and-Upserts.md`
- Create: `RAG/Phase-06-Vector-Databases-Pinecone/03-Metadata-Filtering-and-Scaling.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Pinecone-Fundamentals.md`**

Cover: the problem (Chroma is great locally, but production apps need a managed, scalable, always-on vector store); analogy (moving from a personal notebook to a professional archive service that handles the building, security, and backups for you); internal flow (Pinecone account/API key setup conceptually, creating an index with a dimension matching your embedding model, connecting via the Python client); code example: `from pinecone import Pinecone`, create client, create index (spec/dimension/metric), connect to index; comparison table (Chroma vs Pinecone: hosting, cost model, scale, setup complexity); common mistakes (mismatched embedding dimension vs index dimension, choosing the wrong distance metric for your embedding model); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Indexes-Namespaces-and-Upserts.md`**

Cover: the problem (a growing app has multiple datasets/tenants and needs to add/update vectors without downtime); analogy (namespaces as separate labeled drawers within the same archive cabinet); internal flow (upsert = insert-or-update by id, namespaces for logical separation without separate indexes, batching upserts for large datasets); code example: batch-upserting a list of (id, vector, metadata) tuples into a namespace, then querying scoped to that namespace; common mistakes (upserting one vector at a time in a loop instead of batching — slow and costly, forgetting namespace scoping and accidentally querying across tenants); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Metadata-Filtering-and-Scaling.md`**

Cover: the problem (semantic similarity alone isn't enough — you often need "only search documents from this user" or "only docs after this date"); analogy (a librarian who first checks your library card before even starting the search, narrowing the shelves); internal flow (metadata filter syntax at query time, combining filters with similarity search, how filtering interacts with index performance at scale); code example: querying with a metadata filter (e.g. `{"user_id": {"$eq": "123"}}`) alongside the embedding query; a short section on scaling considerations (pod types/serverless indexes conceptually, cost vs latency tradeoffs — described qualitatively since exact pricing/tiers change over time); common mistakes (over-filtering to the point few/no results return, not indexing metadata fields that need frequent filtering); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-06-Vector-Databases-Pinecone
git commit -m "Add RAG Phase 06: Vector Databases - Pinecone"
```

---

## Task 8: Phase 07 — Vector Databases III: pgvector

**Files:**
- Create: `RAG/Phase-07-Vector-Databases-Pgvector/README.md`
- Create: `RAG/Phase-07-Vector-Databases-Pgvector/01-pgvector-Fundamentals.md`
- Create: `RAG/Phase-07-Vector-Databases-Pgvector/02-Hybrid-Relational-and-Vector-Queries.md`
- Create: `RAG/Phase-07-Vector-Databases-Pgvector/03-Indexing-with-IVFFlat-and-HNSW.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-pgvector-Fundamentals.md`**

Cover: the problem (many teams already run PostgreSQL and don't want to operate a whole separate vector database); analogy (adding a new skill to a Swiss Army knife you already carry, instead of buying a new tool); internal flow (installing the `pgvector` extension, creating a table with a `vector` column, inserting embeddings, querying with `<->`/`<=>` distance operators); code example: `CREATE EXTENSION vector;`, `CREATE TABLE documents (id serial, content text, embedding vector(768));`, an `INSERT`, then a `SELECT ... ORDER BY embedding <-> query_embedding LIMIT 5;`; comparison table (pgvector vs Chroma vs Pinecone: operational overhead, SQL integration, when it's the right/wrong choice); common mistakes (forgetting to set the vector dimension to match the embedding model, running vector search on an unindexed large table); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Hybrid-Relational-and-Vector-Queries.md`**

Cover: the problem (real apps need "similar documents AND owned by this user AND created this year" — pure vector DBs make relational joins awkward); analogy (searching a library not just by topic similarity but also by "only books checked out this year, by this author"); internal flow (combining a `WHERE` clause on regular columns with `ORDER BY embedding <-> query` — the relational engine does both in one query); code example: a query joining a `documents` table and a `users` table, filtering by `users.plan = 'pro'`, ordered by vector distance; common mistakes (writing the WHERE clause after the ORDER BY conceptually in your head but not verifying the query planner uses the filter efficiently — a nudge to check `EXPLAIN`); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Indexing-with-IVFFlat-and-HNSW.md`**

Cover: the problem (a plain `SELECT ... ORDER BY embedding <-> query` on a million-row table without an index scans everything — too slow); analogy (an index is like a book's index page vs flipping through every page to find a word); internal flow (IVFFlat: cluster vectors into buckets, search only relevant buckets — approximate; HNSW: a navigable graph structure for faster approximate search — describe both at a conceptual level, no deep algorithm derivation); code example: `CREATE INDEX ON documents USING hnsw (embedding vector_l2_ops);` and a note on `ivfflat` as the alternative with `lists` parameter; comparison table (IVFFlat vs HNSW: build time, query speed, memory use, when to pick each); common mistakes (building an index before you have enough data for IVFFlat's clustering to be meaningful, not rebuilding indexes after major data changes); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-07-Vector-Databases-Pgvector
git commit -m "Add RAG Phase 07: Vector Databases - pgvector"
```

---

## Task 9: Phase 08 — Retrieval Strategies

**Files:**
- Create: `RAG/Phase-08-Retrieval-Strategies/README.md`
- Create: `RAG/Phase-08-Retrieval-Strategies/01-Similarity-Search-and-Top-K-Tuning.md`
- Create: `RAG/Phase-08-Retrieval-Strategies/02-Hybrid-Search-BM25-and-Vectors.md`
- Create: `RAG/Phase-08-Retrieval-Strategies/03-MMR-and-Metadata-Filtering.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Similarity-Search-and-Top-K-Tuning.md`**

Cover: the problem (how many chunks should you retrieve — too few misses context, too many drowns the LLM in noise and cost); analogy (asking a research assistant to bring you "the 5 most relevant pages," not the whole library); internal flow (top-k similarity search recap, tradeoffs of increasing k, the "lost in the middle" phenomenon where LLMs pay less attention to context buried in a long prompt); code example: querying a vector store with varying `k` values and printing the retrieved chunk relevance scores side by side; common mistakes (picking k=1 and missing a valid answer split across chunks, picking a huge k "to be safe" and ballooning cost/latency); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Hybrid-Search-BM25-and-Vectors.md`**

Cover: the problem (pure vector search misses exact keyword/code/acronym matches that a human would obviously want — e.g. an exact product SKU or error code); analogy (a search engine that understands both "meaning" and "exact spelling," like a librarian who does both a subject-catalog search and a keyword index search); internal flow (BM25 as classic keyword-frequency search, combining BM25 + vector similarity scores via a weighted or reciprocal-rank-fusion approach); code example: running a simple BM25 search (`rank_bm25` library) alongside a vector query on the same corpus, then combining scores with reciprocal rank fusion; comparison table (pure vector vs pure keyword/BM25 vs hybrid: strengths, weaknesses, when each wins); common mistakes (assuming vector search alone is always better — it often loses on exact-match queries); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-MMR-and-Metadata-Filtering.md`**

Cover: the problem (top-k similarity search can return 5 near-duplicate chunks that all say the same thing, wasting context budget); analogy (asking for "5 different perspectives," not "the same opinion repeated 5 times"); internal flow (Maximal Marginal Relevance: balance relevance to the query against diversity from already-selected results, described with the tradeoff parameter lambda); code example: a simplified MMR re-selection function over a candidate list of (chunk, embedding, similarity_score) tuples; recap of metadata filtering from Phase 6/7 in the context of retrieval strategy selection (filter first, then rank, vs rank then filter); common mistakes (setting MMR's diversity weight too high and losing relevance, filtering so aggressively that MMR has nothing left to diversify over); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-08-Retrieval-Strategies
git commit -m "Add RAG Phase 08: Retrieval Strategies"
```

---

## Task 10: Phase 09 — Reranking & Query Transformation

**Files:**
- Create: `RAG/Phase-09-Reranking-and-Query-Transformation/README.md`
- Create: `RAG/Phase-09-Reranking-and-Query-Transformation/01-Cross-Encoder-Reranking.md`
- Create: `RAG/Phase-09-Reranking-and-Query-Transformation/02-HyDE-Hypothetical-Document-Embeddings.md`
- Create: `RAG/Phase-09-Reranking-and-Query-Transformation/03-Query-Expansion-and-Multi-Query-Retrieval.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Cross-Encoder-Reranking.md`**

Cover: the problem (the fast vector search that scores millions of chunks is approximate — the top 20 it returns aren't perfectly ordered by true relevance); analogy (a first-pass resume filter done quickly by a scanner, then a slower but more careful human re-reads the shortlist to rank it precisely); internal flow (bi-encoder vs cross-encoder: bi-encoders embed query and doc separately for fast search, cross-encoders jointly process query+doc pairs for accurate but slower scoring — used only on the small shortlist); code example: retrieving top 20 with a vector store, then reranking with a cross-encoder model (e.g. `sentence-transformers` CrossEncoder) and showing scores before/after reordering; comparison table (bi-encoder vs cross-encoder: speed, accuracy, when to use each stage); common mistakes (running a cross-encoder over the entire corpus instead of just the shortlist — far too slow); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-HyDE-Hypothetical-Document-Embeddings.md`**

Cover: the problem (short user queries often embed poorly compared to the longer, richer documents they're trying to match — a mismatch in "embedding style"); analogy (instead of searching with a vague question, first imagine what a perfect answer would look like, then search for documents that resemble that imagined answer); internal flow (HyDE: ask the LLM to generate a hypothetical answer to the query first, embed that hypothetical answer instead of the raw query, then do similarity search with it); code example: a two-step function — generate a hypothetical answer via an LLM call, embed it, then query the vector store with that embedding instead of the original query's embedding; common mistakes (using HyDE for queries that are already long/well-formed — adds latency for little gain, trusting a hallucinated hypothetical answer's specific facts rather than just its "shape"); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Query-Expansion-and-Multi-Query-Retrieval.md`**

Cover: the problem (a single phrasing of a query might miss documents that use different wording for the same concept); analogy (asking the same question three different ways to three different people, then combining all their answers); internal flow (query expansion: ask an LLM to generate synonyms/related terms or several reworded versions of the query, run retrieval for each, then merge/deduplicate results); code example: a function that prompts an LLM to produce 3 reworded queries, runs a vector search for each, and merges results using reciprocal rank fusion (reusing the concept from Phase 8); common mistakes (generating too many query variants and multiplying retrieval cost/latency without proportional benefit, not deduplicating overlapping results across variants); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-09-Reranking-and-Query-Transformation
git commit -m "Add RAG Phase 09: Reranking and Query Transformation"
```

---

## Task 11: Phase 10 — RAG Orchestration with LangChain

**Files:**
- Create: `RAG/Phase-10-RAG-Orchestration-LangChain/README.md`
- Create: `RAG/Phase-10-RAG-Orchestration-LangChain/01-LangChain-Core-Concepts.md`
- Create: `RAG/Phase-10-RAG-Orchestration-LangChain/02-Building-Retrievers-and-Chains.md`
- Create: `RAG/Phase-10-RAG-Orchestration-LangChain/03-End-to-End-RAG-Pipeline-with-LangChain.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-LangChain-Core-Concepts.md`**

Cover: the problem (Phases 2-9 built each RAG piece by hand — that's great for understanding, but wiring it all together manually for every project is repetitive); analogy (LangChain as a set of standardized electrical plugs and sockets so components from different "brands" — vector stores, LLMs, loaders — snap together instead of needing custom wiring every time); internal flow (LangChain's core abstractions: `Document`, `Embeddings`, `VectorStore`, `Retriever`, `PromptTemplate`, `Runnable`/LCEL chaining with the `|` operator); code example: a tiny LCEL chain combining a prompt template and a chat model call, showing the `|` pipe syntax; comparison table (doing it by hand vs LangChain: control vs convenience, debugging difficulty, lock-in considerations); common mistakes (treating LangChain as magic and not understanding what it does under the hood — which is why Phases 2-9 taught the manual version first); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Building-Retrievers-and-Chains.md`**

Cover: the problem (need to plug a Chroma/Pinecone/pgvector store into LangChain's retriever interface so it composes with everything else); analogy (a universal adapter — once a vector store speaks the "Retriever" interface, it works with any chain that expects a retriever); internal flow (wrapping a vector store as a `Retriever`, configuring search type and k, composing a retriever into an LCEL chain alongside a prompt and LLM); code example: wrap a Chroma collection as a LangChain retriever, build a chain: `retriever | format_docs | prompt | llm`, invoke with a question; common mistakes (not configuring `search_kwargs` (k, filters) and getting default behavior that doesn't match what was tuned manually in Phase 8); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-End-to-End-RAG-Pipeline-with-LangChain.md`**

Cover: the problem (put it all together: ingestion, chunking, embedding, storage, retrieval, reranking, prompt construction, generation — as one coherent LangChain pipeline); analogy (an assembly line where each station from earlier phases now has a standardized conveyor belt connecting it to the next); internal flow (full pipeline walkthrough referencing back to specific earlier phases for each stage); a complete code example (~40-60 lines) that: loads a document, chunks it (Phase 4), embeds and stores in Chroma (Phase 5), builds a retriever with MMR (Phase 8), adds a cross-encoder reranking step (Phase 9), constructs a prompt template with retrieved context, and calls the Claude API for generation, printing a final answer with cited sources from metadata; common mistakes (skipping error handling for empty retrieval results, not tracing which stage a bad answer came from — foreshadowing Phase 11's evaluation focus); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-10-RAG-Orchestration-LangChain
git commit -m "Add RAG Phase 10: RAG Orchestration with LangChain"
```

---

## Task 12: Phase 11 — Evaluation & Observability

**Files:**
- Create: `RAG/Phase-11-Evaluation-and-Observability/README.md`
- Create: `RAG/Phase-11-Evaluation-and-Observability/01-RAG-Evaluation-Metrics.md`
- Create: `RAG/Phase-11-Evaluation-and-Observability/02-Tracing-a-RAG-Pipeline.md`
- Create: `RAG/Phase-11-Evaluation-and-Observability/03-Debugging-Bad-Retrievals.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-RAG-Evaluation-Metrics.md`**

Cover: the problem ("it seems to work" isn't good enough once a RAG system is in production — how do you measure quality objectively?); analogy (a teacher grading essays on more than one axis: did it answer the question, did it use the source material honestly, did it cite the right sources); internal flow (RAGAS-style metrics explained plainly: **faithfulness** — is the answer grounded in retrieved context, not hallucinated; **answer relevance** — does the answer address the question; **context precision** — are retrieved chunks actually relevant; **context recall** — did retrieval find everything needed); code example: a simplified faithfulness check using an LLM-as-judge prompt that compares the generated answer against the retrieved context and returns a grounded/ungrounded verdict; comparison table (the 4 metrics: what each measures, what a low score indicates is broken); common mistakes (only checking answer quality and never checking whether retrieval itself was good — masking a retrieval problem as a "prompting problem"); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Tracing-a-RAG-Pipeline.md`**

Cover: the problem (when an answer is wrong, which stage broke — loading, chunking, embedding, retrieval, reranking, or generation?); analogy (a package tracking number that shows every checkpoint it passed through, so you know exactly where it got lost); internal flow (structured logging/tracing of each pipeline stage: log the query, retrieved chunk ids + scores, reranked order, final prompt, and generated answer as one traceable record); code example: a simple `RAGTrace` dataclass capturing each stage's output, populated as the pipeline runs, and a function to pretty-print a trace for inspection; brief mention of dedicated observability tools (e.g. LangSmith) as the production-grade version of this pattern; common mistakes (only logging the final answer and discarding intermediate retrieval results, making debugging bad answers guesswork); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Debugging-Bad-Retrievals.md`**

Cover: the problem (given a trace showing retrieval returned the wrong chunks, how do you actually fix it?); analogy (a doctor working through a differential diagnosis — checking each likely cause in order rather than guessing at a cure); internal flow (a debugging checklist: is the embedding model consistent between indexing/query? is chunk size appropriate for this content? is metadata filtering excluding the right doc? does the query need rewriting/HyDE? does k need tuning?) each tied back to the specific earlier phase that addresses it; code example: a small diagnostic script that re-embeds a known-good query and doc pair and prints their cosine similarity, to sanity check whether the embedding model itself is the problem vs the pipeline configuration; common mistakes (changing multiple pipeline variables at once when debugging, making it unclear what fixed or broke something); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-11-Evaluation-and-Observability
git commit -m "Add RAG Phase 11: Evaluation and Observability"
```

---

## Task 13: Phase 12 — Agentic RAG

**Files:**
- Create: `RAG/Phase-12-Agentic-RAG/README.md`
- Create: `RAG/Phase-12-Agentic-RAG/01-Tool-Using-Retrieval-Agents.md`
- Create: `RAG/Phase-12-Agentic-RAG/02-Self-Querying-Retrievers.md`
- Create: `RAG/Phase-12-Agentic-RAG/03-Multi-Step-and-Iterative-Retrieval.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Tool-Using-Retrieval-Agents.md`**

Cover: the problem (a plain RAG pipeline always retrieves, even for questions that don't need it, e.g. "what's 2+2" — and it can't decide it needs a *different* tool, like a calculator or web search); analogy (a smart assistant who decides *whether* and *which* reference book to grab, rather than a clerk who reflexively fetches the same shelf every time); internal flow (the agent loop: LLM receives a query + list of available tools (retriever, calculator, web search) → decides which tool(s) to call → executes → feeds results back → decides to answer or call another tool); code example: defining a `retrieve_documents` tool function with a docstring description, giving it to an LLM via tool-calling (Claude API tool use), and showing the agent choosing to call it (or not) based on the query; common mistakes (giving the agent too many overlapping tools causing indecisive tool selection, not setting a max iteration limit and risking infinite tool-calling loops); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Self-Querying-Retrievers.md`**

Cover: the problem (a user asks "show me articles about pricing from last month" — that's a semantic part (pricing) and a structured filter part (last month) mixed in one sentence); analogy (a smart librarian who parses your request into "topic" and "shelf constraints" automatically instead of you filling out a separate form for each); internal flow (self-querying retriever: an LLM parses the natural-language query into a semantic search string + a structured metadata filter, then that filter is applied as in Phase 6/7); code example: a function that prompts an LLM to output JSON `{"search_query": ..., "filter": {...}}` from a natural-language question, then uses that structured output to query a vector store with both the embedding and the metadata filter; common mistakes (trusting the LLM's parsed filter blindly without validating field names/types against the actual metadata schema); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Multi-Step-and-Iterative-Retrieval.md`**

Cover: the problem (some questions need multiple rounds of retrieval — e.g. "compare the pricing in these two documents" requires finding document A, then document B, then reasoning across both); analogy (a detective who follows one clue to find the next clue, rather than expecting the whole case solved from a single piece of evidence); internal flow (iterative retrieval loop: retrieve → generate a partial answer or a follow-up sub-question → retrieve again based on that sub-question → repeat until the agent decides it has enough → synthesize final answer); code example: a loop that tracks accumulated context across iterations, asks the LLM after each retrieval "do you have enough information, or what should we search for next?", and terminates on a max-iteration safety limit; common mistakes (no termination condition leading to runaway loops/cost, not deduplicating context accumulated across iterations); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-12-Agentic-RAG
git commit -m "Add RAG Phase 12: Agentic RAG"
```

---

## Task 14: Phase 13 — GraphRAG & Multimodal RAG

**Files:**
- Create: `RAG/Phase-13-GraphRAG-and-Multimodal-RAG/README.md`
- Create: `RAG/Phase-13-GraphRAG-and-Multimodal-RAG/01-Knowledge-Graph-Basics-for-Retrieval.md`
- Create: `RAG/Phase-13-GraphRAG-and-Multimodal-RAG/02-GraphRAG-Retrieval-Patterns.md`
- Create: `RAG/Phase-13-GraphRAG-and-Multimodal-RAG/03-Multimodal-RAG-Images-and-Tables.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Knowledge-Graph-Basics-for-Retrieval.md`**

Cover: the problem (vector search finds chunks that are *semantically similar*, but struggles with questions requiring *relationships* — e.g. "who reports to the person who manages the Sydney office?" isn't answerable by similarity alone); analogy (a vector store is like a pile of index cards sorted by topic; a knowledge graph is a family tree showing exactly how things connect); internal flow (entities and relationships as nodes and edges, extracting a simple knowledge graph from text using an LLM to identify entity/relation triples); code example: prompting an LLM to extract `(entity, relation, entity)` triples from a short paragraph and representing them as a simple Python list of tuples / a tiny `networkx` graph; common mistakes (trying to build a knowledge graph for every use case — it adds real complexity and is only worth it when relationship-style questions are common); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-GraphRAG-Retrieval-Patterns.md`**

Cover: the problem (given a knowledge graph, how do you actually use it at query time alongside or instead of vector search?); analogy (following a trail of connected dots on a map, rather than just checking which single dot is closest); internal flow (graph traversal retrieval: find matching entities/nodes for the query, walk outward along relevant edges to gather connected context, combine graph context with normal vector-retrieved chunks); code example: a small function that, given a query entity, walks 1-2 hops in a `networkx` graph and collects the connected node/edge text as additional context alongside standard vector retrieval results; comparison table (pure vector RAG vs GraphRAG: what kinds of questions each answers well); common mistakes (over-engineering GraphRAG for simple lookup-style questions that plain vector search already handles fine); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Multimodal-RAG-Images-and-Tables.md`**

Cover: the problem (a lot of real knowledge lives in images, charts, and tables — not plain text — and plain text embeddings can't "see" them); analogy (a research assistant who can only read text is missing half the story in a document full of diagrams and spreadsheets); internal flow (approaches at an introductory level: image captioning to convert images into searchable text descriptions, multimodal embedding models that embed images and text into the same vector space, treating extracted tables as structured markdown/JSON for retrieval); code example: a function that captions an image via a multimodal LLM call and stores the caption as retrievable text alongside a reference to the original image path; common mistakes (relying purely on captions and losing nuance a human would see directly in the image, not testing multimodal retrieval quality separately from text retrieval); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-13-GraphRAG-and-Multimodal-RAG
git commit -m "Add RAG Phase 13: GraphRAG and Multimodal RAG"
```

---

## Task 15: Phase 14 — Production Patterns & Scaling

**Files:**
- Create: `RAG/Phase-14-Production-Patterns-and-Scaling/README.md`
- Create: `RAG/Phase-14-Production-Patterns-and-Scaling/01-Caching-and-Cost-Control.md`
- Create: `RAG/Phase-14-Production-Patterns-and-Scaling/02-Security-and-PII-Considerations.md`
- Create: `RAG/Phase-14-Production-Patterns-and-Scaling/03-Deployment-Monitoring-and-Failure-Modes.md`

- [ ] **Step 1: Write the phase README** (Overview, Learning Objectives, Estimated Study Time table)

- [ ] **Step 2: Write `01-Caching-and-Cost-Control.md`**

Cover: the problem (every query re-embeds text and calls an LLM — at scale, repeated/similar queries cost real money and add latency); analogy (a fast-food kitchen pre-making common orders instead of cooking from scratch every single time); internal flow (caching layers: embedding cache for repeated documents, semantic cache for near-duplicate queries (cache hit if a new query is similar enough to a previous one), response caching with TTLs); code example: a simple in-memory semantic cache — check cosine similarity of a new query embedding against cached query embeddings, return cached answer above a similarity threshold, else run the full pipeline and cache the result; common mistakes (caching answers too aggressively and serving stale/wrong answers for subtly different queries, not invalidating cache when underlying documents change); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `02-Security-and-PII-Considerations.md`**

Cover: the problem (RAG systems often index sensitive internal documents — a careless setup can leak data across users or expose PII in generated answers); analogy (a library that must check *your* library card before showing you *any* book, not just rely on the front door lock); internal flow (per-user/per-tenant metadata filtering enforced server-side (not just requested by the client), scrubbing/redacting PII before indexing, access control checks before returning retrieved content, audit logging of what was retrieved for whom); code example: a retrieval wrapper function that always injects a server-side `user_id` metadata filter regardless of what the client requests, preventing cross-tenant leakage; common mistakes (trusting client-supplied filters without server-side enforcement, indexing raw documents containing PII without a redaction step); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Write `03-Deployment-Monitoring-and-Failure-Modes.md`**

Cover: the problem (a RAG system that worked in a notebook still needs to run reliably as a service — what breaks in production that didn't break in development?); analogy (the difference between a home-cooked meal for friends and running a restaurant kitchen that must serve hundreds of orders reliably every night); internal flow (deploying a RAG pipeline behind an API endpoint, monitoring key metrics (latency per stage, retrieval quality drift over time, cost per query), common production failure modes: vector index drift as new documents are added without embedding model consistency, silent retrieval degradation, upstream LLM API rate limits/outages); a table of common failure modes mapped to the earlier phase that helps diagnose/prevent each (ties the whole course together); common mistakes (no monitoring on retrieval quality — only monitoring uptime/latency and missing "silently getting worse" answers); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 5: Verify structure** (same grep pattern)

- [ ] **Step 6: Commit**

```bash
git add RAG/Phase-14-Production-Patterns-and-Scaling
git commit -m "Add RAG Phase 14: Production Patterns and Scaling"
```

---

## Task 16: Projects

**Files:**
- Create: `RAG/Projects/README.md`
- Create: `RAG/Projects/01-Simple-Doc-QA-Bot.md`
- Create: `RAG/Projects/02-PDF-Knowledge-Base-Assistant.md`
- Create: `RAG/Projects/03-Hybrid-Search-App.md`
- Create: `RAG/Projects/04-Multi-Source-RAG-with-LangChain.md`
- Create: `RAG/Projects/05-Evaluated-RAG-Pipeline.md`
- Create: `RAG/Projects/06-Agentic-Research-Assistant.md`
- Create: `RAG/Projects/07-Production-RAG-Capstone.md`

- [ ] **Step 1: Write `RAG/Projects/README.md`**

Following the `AWS/Projects/README.md` pattern: a short intro explaining the 7 projects go beginner → advanced, each links to which phases it draws on, and a table (Project | Difficulty | Phases Used | Est. Time).

- [ ] **Step 2: Write each of the 7 project files** using this per-file structure: **Goal** (1-2 sentences), **What You'll Build** (short description), **Phases Required** (list), **Requirements** (bulleted functional requirements), **Suggested Approach** (numbered high-level steps, not full solution code — this is a project brief, not a lesson), **Stretch Goals** (2-3 optional extensions), **Evaluation Checklist** (how the learner knows they succeeded). Content per project, matching the spec:

  1. **Simple Doc-QA Bot** — load a handful of text/markdown files, chunk (fixed-size), embed, store in Chroma, answer questions with a single retrieve-then-generate call. Phases 1-5.
  2. **PDF Knowledge Base Assistant** — load real PDFs, apply recursive/semantic chunking (Phase 4), store in Pinecone, add basic metadata filtering. Phases 3, 4, 6.
  3. **Hybrid Search App** — combine BM25 + vector search with reranking, backed by pgvector. Phases 7, 8, 9.
  4. **Multi-Source RAG with LangChain** — ingest multiple document types (PDF, HTML, markdown) into one LangChain pipeline with metadata-based filtering across sources. Phases 3, 8, 10.
  5. **Evaluated RAG Pipeline** — take an existing pipeline and add RAGAS-style evaluation metrics + tracing, iterate on chunk size/k based on measured results. Phases 10, 11.
  6. **Agentic Research Assistant** — an agent that decides when to retrieve vs use other tools (e.g. a calculator), with multi-step retrieval for comparison-style questions. Phase 12.
  7. **Production RAG Capstone** — combine chunking, hybrid retrieval, reranking, evaluation, caching, and per-user metadata security into one end-to-end deployed-style system, capstone integrating phases 1-14.

- [ ] **Step 3: Verify structure**

Run: `ls RAG/Projects/*.md | wc -l` — expected `8` (7 projects + README). Run: `grep -L "Evaluation Checklist" RAG/Projects/0*.md` — expected empty output (every numbered project file has this section).

- [ ] **Step 4: Commit**

```bash
git add RAG/Projects
git commit -m "Add RAG course Projects"
```

---

## Task 17: Quick-Reference

**Files:**
- Create: `RAG/Quick-Reference/RAG-Cheatsheet.md`
- Create: `RAG/Quick-Reference/Interview-QA.md`

- [ ] **Step 1: Write `RAG-Cheatsheet.md`**

Following the `Docker-Cheatsheet.md`/`Kubernetes-Cheatsheet.md` pattern: a dense, scannable quick-lookup document organized by phase topic, each as a `##` section with tables/bullet lists (no long prose). Sections: Chunking Strategies Comparison, Similarity Metrics Cheat Sheet, Vector DB Comparison (Chroma vs Pinecone vs pgvector), Retrieval Strategies Quick Reference, Reranking/Query Transformation Techniques, Common LangChain Snippets (retriever setup, LCEL chain skeleton), Evaluation Metrics Glossary, Production Checklist (caching/security/monitoring one-liners).

- [ ] **Step 2: Write `Interview-QA.md`**

Following the `Docker/Quick-Reference/Interview-QA.md` numbering pattern (`Q1`, `Q2`, ... `Q50`), write 50 interview Q&A pairs covering: RAG architecture & fundamentals (Q1-8), embeddings & similarity (Q9-14), chunking (Q15-20), vector databases (Q21-28, covering all 3 covered DBs), retrieval strategies (Q29-35), reranking & query transformation (Q36-40), evaluation (Q41-44), agentic RAG (Q45-47), GraphRAG/multimodal (Q48-49), production (Q50 combined into a slightly larger closing set if needed to reach exactly 50 — adjust section boundaries as needed but the total must be exactly 50). Each Q&A is a `### QN. Question text?` heading followed by a 2-5 sentence answer.

- [ ] **Step 3: Verify structure**

Run: `grep -c "^### Q" RAG/Quick-Reference/Interview-QA.md` — expected `50`. Run: `grep -c "^## " RAG/Quick-Reference/RAG-Cheatsheet.md` — expected ≥8.

- [ ] **Step 4: Commit**

```bash
git add RAG/Quick-Reference
git commit -m "Add RAG course Quick-Reference (Cheatsheet + Interview Q&A)"
```

---

## Task 18: Top-Level README

**Files:**
- Modify: `RAG/README.md` (created as placeholder in Task 1)

- [ ] **Step 1: Write the full README**

Following the `AWS/README.md` / `Kubernetes/README.md` format: title (`# Complete RAG Learning Course` or similar), a "Why RAG?" section (2-3 sentences on why RAG matters for building LLM applications with private/current data), a "Prerequisites" section (Python fluency + basic ML familiarity — no prior RAG/LLM-app experience assumed), a "How to Use This Course" section explaining the Phase → Projects → Quick-Reference flow, a course-structure diagram (the directory tree from the spec, in a code fence), and a "Learning Path" table with columns `# | Phase | Folder | Difficulty | Estimated Time` for all 14 phases plus a total estimated time row/note at the bottom.

- [ ] **Step 2: Verify structure**

Run: `grep -c "^|" RAG/README.md` — expected at least 15 (header + separator + 14 phase rows). Run: `grep -l "Learning Path" RAG/README.md` and `grep -l "Prerequisites" RAG/README.md` — both must match.

- [ ] **Step 3: Commit**

```bash
git add RAG/README.md
git commit -m "Add RAG course top-level README"
```

---

## Task 19: Final Cross-Check

- [ ] **Step 1: Verify full course structure matches the spec**

Run: `find RAG -name "README.md" | wc -l` — expected `16` (1 top-level + 14 phase + 1 Projects).
Run: `find RAG -name "*.md" | wc -l` — expected around `16 (READMEs) + 14*3 (lessons) + 7 (projects) + 2 (quick-ref) = 67`. Confirm actual count is in that neighborhood (a few files more/less due to natural content splits is fine — flag anything wildly off).

- [ ] **Step 2: Spot-check style compliance**

Run: `grep -L "Memory hook" RAG/Phase-*/0*.md` — expected empty output (every lesson file has a memory hook). Run: `grep -L "Interview Q&A" RAG/Phase-*/0*.md` — expected empty output.

- [ ] **Step 3: Final commit (if any cleanup was needed)**

```bash
git status
git add -A
git commit -m "RAG course: final structure cross-check" --allow-empty-message -m "Cross-checked structure against spec" 2>/dev/null || true
```
(Only commit if Step 1/2 required fixes — otherwise skip, nothing to commit.)
