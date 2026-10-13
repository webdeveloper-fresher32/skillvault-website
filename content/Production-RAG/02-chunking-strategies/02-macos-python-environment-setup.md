> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 2.1: Production Chunking Strategies Deep Dive](01-chunking-strategies-deep-dive.md) | ➡️ [Module 3: Embeddings, Vector Spaces & Similarity Search](../03-embeddings-and-similarity/01-embeddings-and-similarity-search.md)

---

Man, no worries! This is a common issue on macOS when using Homebrew Python. Your Python installation is protecting its system-managed packages. **Don't use `--break-system-packages`** — we'll set up a virtual environment for your Production RAG project.

## Step 1 — Create a virtual environment

You're already inside your `production-rag` folder. Run these commands one by one.

```bash

python3 -m venv .venv

```

This creates a `.venv` folder containing an isolated Python environment for this project.

## Step 2 — Activate the environment

```bash

source .venv/bin/activate

```

Your terminal prompt should now start with something like:

```text
(.venv) ganeshpirikirala@Ganeshs-MacBook-Air production-rag %
```

The `(.venv)` prefix confirms that the environment is activated.

## Step 3 — Install the dependencies

Run:

```bash

python -m pip install --upgrade pip
python -m pip install langchain-text-splitters pypdf

```

We're installing both:

- `langchain-text-splitters` — for Module 2's recursive chunking.
- `pypdf` — for Module 1's PDF loader.

## Step 4 — Verify the installation

```bash

python -c "from langchain_text_splitters import RecursiveCharacterTextSplitter; from pypdf import PdfReader; print('Production RAG dependencies installed successfully!')"

```

Expected output:

```text
Production RAG dependencies installed successfully!
```

## Step 5 — Update your `requirements.txt`

Once the installation succeeds:

```bash

python -m pip freeze > requirements.txt

```

This records the installed packages so you can recreate the environment later.

## Your project structure should now look like this

```text
production-rag/
├── .venv/
├── app/
│   ├── document_loader.py
│   └── chunking.py
├── documents/
│   └── refund_policy.pdf
└── requirements.txt
```

Your actual files may differ slightly; that's fine.

## Important: Every time you reopen Terminal

Activate the environment before running your project:

```bash
cd /path/to/production-rag
source .venv/bin/activate
```

Replace `/path/to/production-rag` with your actual project path. You can get the current directory by running `pwd` inside the project folder.

**If you see `(.venv)` already, don't create another environment.** Just activate it if needed and install the packages.

Once this works, run your chunking script:

```bash
python -m app.chunking
```

If you haven't created `app/chunking.py` yet, save the production chunking implementation from Module 2 first.

**One more thing, man:** Avoid installing project libraries into your global Homebrew Python. Keeping each project inside its own `.venv` will make your RAG development much easier as we add embedding models, vector databases and FastAPI.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 2.1: Production Chunking Strategies Deep Dive](01-chunking-strategies-deep-dive.md) | ➡️ [Next: Module 3: Embeddings, Vector Spaces & Similarity Search](../03-embeddings-and-similarity/01-embeddings-and-similarity-search.md)
