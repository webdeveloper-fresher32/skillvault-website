# Phase 10: LLM Evaluation

> **Pillar 7 of 7: AI Ops** — Eval & Monitoring, LLM-as-a-Judge, RAG Triad Metrics

## What You'll Learn

The rigorous methodologies, scoring rubrics, and automated testing frameworks required to systematically measure the quality, accuracy, and reliability of LLM applications: curated golden evaluation datasets, LLM-as-a-judge scoring protocols, and the RAG evaluation triad (context relevance, faithfulness, answer relevance).

## Learning Objectives

- Construct curated golden benchmark datasets pairing representative user inputs, system contexts, reference answers, and hard negative edge cases.
- Implement LLM-as-a-judge scoring protocols (pairwise and single-answer Likert scales) with structured reasoning rubrics while mitigating position and verbosity biases.
- Evaluate end-to-end RAG pipelines using the retrieval and generation triad (Ragas, TruLens) and integrate automated evaluation gates into CI/CD regression testing.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Golden-Datasets-and-Evaluation-Design.md](01-Golden-Datasets-and-Evaluation-Design.md) | Ground-truth dataset curation, synthetic generation, edge cases, and evaluation suites | 1 day |
| [02-LLM-as-a-Judge-and-Scoring-Protocols.md](02-LLM-as-a-Judge-and-Scoring-Protocols.md) | Pairwise vs Likert rubrics, bias mitigation (position, verbosity), and human calibration | 1 day |
| [03-RAG-Evaluation-Triad-and-Regression-Suites.md](03-RAG-Evaluation-Triad-and-Regression-Suites.md) | Context relevance, faithfulness, answer relevance, Ragas metrics, and CI regression gates | 1 day |

## Estimated Time

3 days

## Next Module

→ [11: Fine-Tuning](../08-Fine-Tuning/README.md)
