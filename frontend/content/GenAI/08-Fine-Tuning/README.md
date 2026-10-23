# Phase 11: Fine-Tuning

> **Pillar 4 of 7: Transformers & LLMs** — Fine-Tuning (LoRA & QLoRA), PEFT Mechanics & Datasets

## What You'll Learn

When, why, and how to adapt open-source foundation models for specialized production workloads: the architectural decision framework comparing Prompt Engineering vs RAG vs Fine-Tuning, parameter-efficient fine-tuning (PEFT) mechanics with LoRA rank decomposition, and high-efficiency 4-bit QLoRA training on single consumer GPUs.

## Learning Objectives

- Apply a rigorous engineering decision framework comparing Prompting, In-Context RAG, and Parameter-Efficient Fine-Tuning based on knowledge staleness, style adaptation, and cost.
- Understand low-rank adaptation (LoRA) mathematics ($\Delta W = B \cdot A$), rank $r$ and scaling factor $\alpha$ selection, and adapter weight merging.
- Train custom open-source models using QLoRA (NF4 4-bit quantization, double quantization, paged optimizers) and curate high-quality ChatML/instruction datasets.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Fine-Tuning-vs-RAG-Decision-Framework.md](01-Fine-Tuning-vs-RAG-Decision-Framework.md) | When to prompt vs RAG vs fine-tune: trade-offs, economics, and architectural matrix | 1 day |
| [02-PEFT-and-LoRA-Mechanics.md](02-PEFT-and-LoRA-Mechanics.md) | Full fine-tuning vs PEFT, low-rank decomposition ($\Delta W = B \cdot A$), and hyperparameter tuning | 1 day |
| [03-QLoRA-Quantization-and-Dataset-Curating.md](03-QLoRA-Quantization-and-Dataset-Curating.md) | NF4 quantization, double quantization, paged optimizers, SFT, and formatting ChatML datasets | 1 day |

## Estimated Time

3 days

## Next Module

→ [AI Projects & Capstones](../../Capstones/README.md)
