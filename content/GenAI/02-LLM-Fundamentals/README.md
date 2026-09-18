# Phase 5: LLM Fundamentals

> **Pillar 4 of 7: Transformers & LLMs** — Token Economics, KV-Caching, Pretraining, SFT & RLHF

## What You'll Learn

The foundational concepts, operational vocabulary, and economic drivers of Large Language Models: token budgeting, context windows, KV-caching, generation parameters (temperature, top-p, top-k), the 3-stage training lifecycle (Pretraining, SFT, RLHF/DPO), and commercial vs open-weights API mechanics.

## Learning Objectives

- Master token economics, context window limits, KV-caching dynamics, and how sampling parameters (temperature, top-p, penalties) modulate probability distributions.
- Understand the complete model training lifecycle: web-scale self-supervised pretraining, Supervised Fine-Tuning (SFT / instruction tuning), and preference optimization (RLHF and DPO).
- Write robust, provider-portable client code connecting to frontier APIs (OpenAI, Anthropic Claude, Google Gemini) and open-weights models (via Hugging Face and vLLM).

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Token-Economics-Context-Windows-and-Inference.md](01-Token-Economics-Context-Windows-and-Inference.md) | Token budgeting, context limits, KV-cache memory, and decoding sampling parameters | 1 day |
| [02-Training-Lifecycle-Pretraining-to-RLHF.md](02-Training-Lifecycle-Pretraining-to-RLHF.md) | Pretraining scale, instruction fine-tuning (SFT), RLHF reward modeling, and DPO alignment | 1 day |
| [03-Model-APIs-and-Provider-Ecosystem.md](03-Model-APIs-and-Provider-Ecosystem.md) | Provider message schemas, streaming responses, open vs closed models, and SDK integration | 1 day |

## Estimated Time

3 days

## Next Module

→ [06: LLM Application Engineering & RAG](../03-LLM-App-Engineering-and-RAG/README.md)
