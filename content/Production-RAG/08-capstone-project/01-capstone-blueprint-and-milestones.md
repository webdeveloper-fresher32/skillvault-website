> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.7: Production Readiness Checklist, Deep Health Checks & Migrations](../07-production-deployment/07-production-readiness-and-healthchecks.md) | ➡️ [Module 9.1: Comprehensive Production RAG Knowledge Audit](../09-roadmap-and-langchain/01-production-rag-coverage-audit.md)

---

# Production RAG Capstone — Let's build it step by step

We'll turn your existing `production-rag` project into an end-to-end RAG application you can run locally, test, and eventually demonstrate in interviews.

We'll **build on your existing code**, not throw it away and start over. First, we'll verify that the pieces fit together; then we'll fix any integration issues before adding new features.

## Capstone architecture

**1. Upload documents**
PDF validation and tenant ownership

**2. Ingest and index**
Extract → chunk → embed → pgvector

**3. Retrieve relevant evidence**
Hybrid search → reranking → compression

**4. Generate a grounded answer**
LLM → citations → validation

**5. Evaluate and monitor**
Quality, security, latency, and cost

## Our capstone milestones

  **Integration audit:** verify your files, imports, function signatures, configuration, and database schema.
  **End-to-end ingestion:** upload a PDF and confirm its chunks are stored with correct tenant metadata.
  **Reliable retrieval:** test hybrid search, reranking, compression, and source filters.
  **Grounded Q&A:** generate answers with citations and handle questions the documents cannot answer.
  **Automated tests:** test tenant isolation, ingestion idempotency, citations, and failure cases.
  **Deployment polish:** health checks, Docker, logging, configuration, and a useful README.

## Milestone 1 — Audit your existing project

Before changing code, let's see what you already have and catch integration problems early.

### Step 1: Open your project in the terminal

Run these commands on your Mac:

```bash

cd ~/production-rag

# Activate the existing virtual environment
source .venv/bin/activate

# Confirm Python is using the virtual environment
which python

# Display the project structure
find app docker tests -maxdepth 2 -type f 2>/dev/null | sort

# Check installed packages
python -m pip check

```

If your project isn't located at `~/production-rag`, use its actual directory path instead.

### Step 2: Check your environment configuration safely

Run:

```bash

# Show variable NAMES only, never their values
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env 2>/dev/null \
  | sed 's/=.*//' \
  | sort

# Check Git status
git status --short

```

**Important:** Don't paste your API keys, database password, access token, or the contents of `.env` here.

### Step 3: Send me the results

Paste the output of those commands here. If a command reports an error, include the error too.

I'll use that output to tailor the next step to your actual project, verify which modules are missing, and give you the precise code changes needed to connect ingestion → retrieval → generation → citations.

We'll get the existing application working end to end before adding more code.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.7: Production Readiness Checklist, Deep Health Checks & Migrations](../07-production-deployment/07-production-readiness-and-healthchecks.md) | ➡️ [Next: Module 9.1: Comprehensive Production RAG Knowledge Audit](../09-roadmap-and-langchain/01-production-rag-coverage-audit.md)
