# Module 2: Production Chunking Strategies

Welcome to **Module 2**. How you slice documents determines whether your vector database returns high-signal facts or irrelevant noise.

---

## 📑 Module Lessons

1. **[01-chunking-strategies-deep-dive.md](01-chunking-strategies-deep-dive.md)**
   - The chunk size trade-off: small chunks (high specificity, lost context) vs. large chunks (rich context, diluted vectors).
   - Fixed-size chunking and sliding window overlap.
   - Recursive character text splitting (paragraphs → sentences → words).
   - Semantic chunking (embedding cosine similarity threshold between adjacent sentences).
   - Parent-Document retrieval (index small chunks for search, return larger parent chunk to LLM).

2. **[02-macos-python-environment-setup.md](02-macos-python-environment-setup.md)**
   - Resolving macOS Homebrew Python environment issues (`externally-managed-environment`).
   - Setting up isolated virtual environments (`venv`) and installing dependencies cleanly.

---

[⬅️ Previous Module: Roadmap & Loaders](../01-roadmap-and-loaders/README.md) | [Next Module: Embeddings & Similarity ➡️](../03-embeddings-and-similarity/README.md)
