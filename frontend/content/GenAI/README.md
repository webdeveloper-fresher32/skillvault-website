# Generative AI & Large Language Models (LLMs) Hub

> "Generative AI is not prompt engineering; it is systems engineering with probabilistic components. We treat models as reasoning runtimes, optimizing token economics, building deterministic agent loops, serving inference at scale, and enforcing mathematical evaluation gates in CI/CD."

---

## The 7 Pillars of AI Engineering

```
Math Foundations    - Linear Algebra, Calculus, Probability & Statistics
Classical ML        - scikit-learn, Regression/Classification, Clustering
Deep Learning       - PyTorch, Neural Networks, Backpropagation
Transformers & LLMs - Attention, Embeddings, BERT/GPT, Fine-Tuning (LoRA)
LLM Engineering     - LangChain, RAG, Vector DBs (Pinecone, FAISS)
AI Agents           - LangGraph, Tool-Calling, Multi-Agent Orchestration
AI Ops              - MLflow, Model Serving (vLLM), Eval & Monitoring
```

This directory centers on **Tech Stacks 04 through 11** (Transformers & LLMs, LLM App Engineering & RAG, AI Agents, AI Backend & Serving, MLOps & LLMOps, LLM Evaluation, and Fine-Tuning).

---

## The Complete AI Dependency Chain

```
[Pillars 1-3: Machine Learning Bedrock]
Math Foundations ──> Classical ML ──> Deep Learning & PyTorch
                                              │
                                              ▼
[Pillars 4-5: Models & Retrieval]
Transformers (01) ──> LLM Fundamentals (02) ──> LLM App Engineering & RAG (03)
                                                        │
                                                        ▼
[Pillars 6-7: Systems, Serving & Operations]
AI Agents (04) ──> AI Backend & Serving (05) ──> MLOps (06) ──> Eval (07) ──> Fine-Tuning (08)
```

### Specialized Implementation Ecosystem

Within Modules 03 and 04, specialized open-source frameworks provide deep implementation toolkits:

```
                                  ┌── LangChain (Module 03: Document loaders, parsers, quick chains)
                                  ├── RAG Deep-Dive (Module 03: 14-phase comprehensive retrieval curriculum)
LLM Fundamentals (Module 02)───────┼── LangGraph (Module 04: Stateful agent graphs, cyclic reasoning)
                                  └── vLLM & MLflow (Modules 05/06: Production serving & operations)
```

---

## Tech Stack Modules & Curriculum Reference

| Module | Directory | Scope & Key Technologies |
|---|---|---|
| **04. Transformers** | [01-Transformers/](01-Transformers/README.md) | Tokenization, Embeddings, Positional Encoding, Self-Attention ($Q,K,V$), Multi-Head Attention, BERT vs GPT vs T5 |
| **05. LLM Fundamentals** | [02-LLM-Fundamentals/](02-LLM-Fundamentals/README.md) | Token economics, Context Windows, KV-Caching, Temperature/Top-P, Pretraining to RLHF/DPO, Provider APIs |
| **06. LLM App Engineering & RAG** | [03-LLM-App-Engineering-and-RAG/](03-LLM-App-Engineering-and-RAG/README.md) | Prompt engineering, Structured Outputs, Document chunking, Vector DBs (pgvector, Pinecone), Hybrid search |
| **07. AI Agents** | [04-AI-Agents/](04-AI-Agents/README.md) | ReAct reasoning loops, Tool-calling execution pipelines, Long-term memory stores, Multi-agent graphs |
| **08. AI Backend & Serving** | [05-AI-Backend-and-Serving/](05-AI-Backend-and-Serving/README.md) | SSE token streaming, Async inference, High-throughput vLLM PagedAttention, Quantization (AWQ, GGUF) |
| **09. MLOps & LLMOps** | [06-MLOps-and-LLMOps/](06-MLOps-and-LLMOps/README.md) | Experiment tracking (MLflow), Model registries, Docker GPU containers, Cloud deployment, Telemetry |
| **10. LLM Evaluation** | [07-LLM-Evaluation/](07-LLM-Evaluation/README.md) | Golden datasets, LLM-as-a-judge scoring protocols, Position bias mitigation, RAG Triad, Ragas automated gates |
| **11. Fine-Tuning** | [08-Fine-Tuning/](08-Fine-Tuning/README.md) | Prompting vs RAG vs Fine-tuning matrix, PEFT, LoRA rank decomposition, 4-bit QLoRA, SFT dataset curation |

### Deep-Dive Frameworks
| Framework | Scope |
|---|---|
| [RAG Master Deep Dive](RAG/Phase-01-RAG-Fundamentals/README.md) | 14-phase comprehensive retrieval architecture, cross-encoders, BM25, and hybrid vector search |
| [LangChain Course](LangChain/) | LCEL expressions, prompt chains, memory stores, retrievers, and agent tool execution |
| [LangGraph Course](LangGraph/) | Cyclic StateGraph execution, checkpointers, thread management, and human-in-the-loop approvals |

---

## Domain Projects

- **Intermediate**: [Full-Stack Enterprise RAG Document Assistant](../../06-PROJECTS/02-Intermediate/README.md)
- **Advanced**: [Autonomous Developer Agent with Sandboxed Tool Execution](../../06-PROJECTS/03-Advanced/README.md)
- **Capstone**: [Production Enterprise AI Platform with vLLM & CI/CD Eval Gates](../../06-PROJECTS/04-Capstones/README.md)
