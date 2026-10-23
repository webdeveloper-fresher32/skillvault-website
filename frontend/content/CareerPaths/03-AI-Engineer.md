# AI Engineer Career Roadmap

> "An AI Engineer builds production systems powered by foundation models: mastering vector geometry and calculus, evaluating transformer architectures, building advanced RAG pipelines, orchestrating multi-agent state machines, and serving low-latency inference."

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

---

## The Learning Sequence

```
                            AI Engineer
                                 │
                                 ▼
               Pillar 1: Math Foundations
                                 │
                                 ▼
               Pillar 2: Classical Machine Learning
                                 │
                                 ▼
               Pillar 3: Deep Learning & PyTorch
                                 │
                                 ▼
               Pillar 4: Transformers & LLMs
                                 │
                                 ▼
               Pillar 5: LLM Engineering & RAG
                                 │
                                 ▼
               Pillar 6: AI Agents & LangGraph
                                 │
                                 ▼
               Pillar 7: AI Ops (vLLM Serving, Eval & LoRA)
```

---

## Pillar Breakdown & Curriculum Links

### Pillar 1: Mathematical Foundations
- [Math Foundations Guide](../05-AI/01-Machine-Learning/01-Math-Foundations/README.md)
  - [Linear Algebra: Vectors, Matrices & Embeddings](../05-AI/01-Machine-Learning/01-Math-Foundations/01-Linear-Algebra-Vectors-Matrices-and-Embeddings.md)
  - [Calculus: Gradients & Backpropagation Mathematics](../05-AI/01-Machine-Learning/01-Math-Foundations/02-Calculus-Gradients-and-Backpropagation-Math.md)
  - [Probability, Statistics & Regression from Scratch](../05-AI/01-Machine-Learning/01-Math-Foundations/03-Probability-Statistics-and-Regression-from-Scratch.md)

### Pillar 2: Classical Machine Learning
- [Classical ML Guide](../05-AI/01-Machine-Learning/02-Classical-ML/README.md)
  - [Supervised Algorithms: Regression & Classification](../05-AI/01-Machine-Learning/02-Classical-ML/01-Supervised-Algorithms-Regression-and-Classification.md)
  - [Unsupervised Learning & Dimensionality Reduction](../05-AI/01-Machine-Learning/02-Classical-ML/02-Unsupervised-Learning-and-Dimensionality-Reduction.md)
  - [Validation Metrics & Production Pitfalls](../05-AI/01-Machine-Learning/02-Classical-ML/03-Validation-Metrics-and-Production-Pitfalls.md)

### Pillar 3: Deep Learning & PyTorch
- [Deep Learning & PyTorch Guide](../05-AI/01-Machine-Learning/03-Deep-Learning/README.md)
  - [Neural Network Anatomy & Activations](../05-AI/01-Machine-Learning/03-Deep-Learning/01-Neural-Network-Anatomy-and-Activations.md)
  - [Loss Functions, Backpropagation & Optimization](../05-AI/01-Machine-Learning/03-Deep-Learning/02-Loss-Functions-Backpropagation-and-Optimization.md)
  - [PyTorch Fundamentals & Sequence Architectures](../05-AI/01-Machine-Learning/03-Deep-Learning/03-PyTorch-Fundamentals-and-Sequence-Architectures.md)

### Pillar 4: Transformers & LLMs
- [Tokenization, Embeddings & Positional Encoding](../05-AI/02-GenAI/01-Transformers/01-Tokenization-Embeddings-and-Positional-Encoding.md)
- [Self-Attention & Multi-Head Attention](../05-AI/02-GenAI/01-Transformers/02-Self-Attention-and-Multi-Head-Attention.md)
- [Transformer Architectures: BERT, GPT, and T5](../05-AI/02-GenAI/01-Transformers/03-Transformer-Architectures-BERT-GPT-and-T5.md)
- [Token Economics, Context Windows & Inference](../05-AI/02-GenAI/02-LLM-Fundamentals/01-Token-Economics-Context-Windows-and-Inference.md)
- [PEFT, LoRA & QLoRA Quantization](../05-AI/02-GenAI/08-Fine-Tuning/02-PEFT-and-LoRA-Mechanics.md)

### Pillar 5: LLM Engineering & RAG
- [Prompt Engineering & Structured Outputs](../05-AI/02-GenAI/03-LLM-App-Engineering-and-RAG/01-Prompt-Engineering-and-Structured-Outputs.md)
- [Vector Databases & Retrieval Pipelines](../05-AI/02-GenAI/03-LLM-App-Engineering-and-RAG/03-Vector-Databases-and-Retrieval-Pipelines.md)
- [RAG Curriculum Hub](../05-AI/02-GenAI/RAG/README.md)
- [Document Loading & Preprocessing](../05-AI/02-GenAI/RAG/Phase-03-Document-Loading-and-Preprocessing/README.md)
- [Chunking Strategies](../05-AI/02-GenAI/RAG/Phase-04-Chunking-Strategies/README.md)
- [Vector Databases: Chroma & Pinecone](../05-AI/02-GenAI/RAG/Phase-05-Vector-Databases-Chroma/README.md)
- [Hybrid Retrieval Strategies (BM25 + Dense)](../05-AI/02-GenAI/RAG/Phase-08-Retrieval-Strategies/README.md)
- [LangChain Framework Orchestration](../05-AI/02-GenAI/LangChain/README.md)

### Pillar 6: AI Agents
- [Agent Loops & ReAct Pattern](../05-AI/02-GenAI/04-AI-Agents/01-Agent-Loops-and-ReAct-Pattern.md)
- [Tool Calling Schemas & Execution](../05-AI/02-GenAI/04-AI-Agents/02-Tool-Calling-Schemas-and-Execution.md)
- [Memory, Planning & Multi-Agent Systems](../05-AI/02-GenAI/04-AI-Agents/03-Memory-Planning-and-Multi-Agent-Systems.md)
- [LangGraph Master Course](../05-AI/02-GenAI/LangGraph/README.md)

### Pillar 7: AI Ops (Model Serving, Evaluation & Lifecycle)
- [Token Streaming & Async Inference](../05-AI/02-GenAI/05-AI-Backend-and-Serving/01-Token-Streaming-and-Async-Inference.md)
- [High-Throughput Serving with vLLM](../05-AI/02-GenAI/05-AI-Backend-and-Serving/02-High-Throughput-Serving-with-vLLM.md)
- [MLOps Pipelines & Experiment Tracking with MLflow](../05-AI/02-GenAI/06-MLOps-and-LLMOps/01-Experiment-Tracking-and-Model-Registries.md)
- [LLM Evaluation Triad & Golden Datasets](../05-AI/02-GenAI/07-LLM-Evaluation/01-Golden-Datasets-and-Evaluation-Design.md)
- [Fine-Tuning vs RAG Decision Framework](../05-AI/02-GenAI/08-Fine-Tuning/01-Fine-Tuning-vs-RAG-Decision-Framework.md)

---

## Recommended Portfolio Projects

| Tier | Project | Key Stack |
|---|---|---|
| **Beginner** | [Prediction API with FastAPI & Docker](../05-AI/Projects/01-Prediction-API-with-FastAPI-and-Docker.md) | FastAPI, Docker, Scikit-Learn |
| **Intermediate** | [Enterprise RAG Document Assistant](../05-AI/Projects/02-Enterprise-RAG-Document-Assistant.md) | LangChain, Vector DB, Embeddings |
| **Advanced** | [Autonomous Developer Agent with Evaluation](../05-AI/Projects/03-Autonomous-Developer-Agent-with-Evaluation.md) | LangGraph, Code Sandbox, Eval Metrics |
| **Capstone** | [Production RAG Capstone](../05-AI/02-GenAI/RAG/Projects/07-Production-RAG-Capstone.md) | Hybrid RAG, Multi-Tenant, Observability |

---

## Interview & Career Readiness

- [AI Engineer Cheatsheet](../05-AI/Quick-Reference/Cheatsheet.md)
- [AI Engineer Interview Q&A](../05-AI/Quick-Reference/Interview-QA.md)
- [RAG Interview Questions](../05-AI/02-GenAI/RAG/Quick-Reference/Interview-QA.md)
- [LangGraph Interview Q&A](../05-AI/02-GenAI/LangGraph/Quick-Reference/Interview-QA.md)
- [HR & Behavioral Prep](../07-INTERVIEW-PREP/02-HR-Interview-QA.md)
