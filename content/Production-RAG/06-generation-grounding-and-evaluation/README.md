# Module 6: Generation, Citations & Evaluation

Welcome to **Module 6**. Retrieval is only half the battle. This module ensures the LLM generates accurate, strictly grounded responses with verified source citations, and sets up quantitative evaluations.

---

## 📑 Module Lessons

1. **[01-grounded-generation-and-citations.md](01-grounded-generation-and-citations.md)**
   - Engineering grounded system prompts that forbid speculation and enforce "I don't know" gates.
   - Including verifiable source tags: `[Source: file.pdf, Chunk: 3]`.

2. **[02-citation-validation-and-hallucination-control.md](02-citation-validation-and-hallucination-control.md)**
   - Automated citation verification: confirming that every citation cited by the LLM exists in the retrieved context.
   - Guardrails against synthetic reference hallucination.

3. **[03-evaluating-your-rag-system.md](03-evaluating-your-rag-system.md)**
   - The RAG Evaluation Triad: Context Relevance, Groundedness (Faithfulness), and Answer Relevance.
   - Metrics: **Hit Rate**, **Mean Reciprocal Rank (MRR)**, **Context Precision**, **Context Recall**.

4. **[04-monitoring-and-debugging.md](04-monitoring-and-debugging.md)**
   - Structured JSON logging: tracking request IDs, tenant IDs, retrieval latency, LLM latency, and tokens.
   - Request tracing and troubleshooting real production queries.

---

[⬅️ Previous Module: Advanced Retrieval](../05-advanced-retrieval/README.md) | [Next Module: Production Deployment ➡️](../07-production-deployment/README.md)
