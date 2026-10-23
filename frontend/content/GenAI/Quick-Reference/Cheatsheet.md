# AI Engineer Cheatsheet

Dense, instant-reference technical material across all 12 phases of the Full-Stack → AI Engineer curriculum, indexed by the 7 Pillars of AI Engineering:

```
Pillar 1: Math Foundations    - Linear Algebra, Calculus, Probability & Statistics
Pillar 2: Classical ML        - scikit-learn, Regression/Classification, Clustering
Pillar 3: Deep Learning       - PyTorch, Neural Networks, Backpropagation
Pillar 4: Transformers & LLMs - Attention, Embeddings, BERT/GPT, Fine-Tuning (LoRA)
Pillar 5: LLM Engineering     - LangChain, RAG, Vector DBs (Pinecone, FAISS)
Pillar 6: AI Agents           - LangGraph, Tool-Calling, Multi-Agent Orchestration
Pillar 7: AI Ops              - MLflow, Model Serving (vLLM), Eval & Monitoring
```

---

## 1. Math Foundations Quick Reference

### Core Matrix Operations & Formulas

| Operation | Mathematical Formula | NumPy / PyTorch Code | Intuition |
|---|---|---|---|
| **Dot Product** | $\mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^n u_i v_i$ | `np.dot(u, v)` or `u @ v` | Measures directional alignment and projection magnitude. |
| **Cosine Similarity** | $\cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$ | `np.dot(u, v) / (norm(u) * norm(v))` | Measures angle between vectors; invariant to vector scale. |
| **Matrix Multiplication** | $C_{ij} = \sum_k A_{ik} B_{kj}$ | `A @ B` or `torch.matmul(A, B)` | Linear transformation mapping from one vector space to another. |
| **Gradient Vector** | $\nabla f = \left[ \frac{\partial f}{\partial x_1}, \dots, \frac{\partial f}{\partial x_n} \right]^T$ | `loss.backward()` then `param.grad` | Vector pointing in direction of steepest function increase. |
| **Gradient Descent** | $\mathbf{w}_{t+1} = \mathbf{w}_t - \eta \nabla L(\mathbf{w}_t)$ | `w -= lr * grad` | Iterative weight update against error gradient. |
| **Bayes' Theorem** | $P(A\|B) = \frac{P(B\|A)P(A)}{P(B)}$ | `(p_b_given_a * p_a) / p_b` | Updating hypothesis probability with observed evidence. |

---

## 2. Classical Machine Learning Metrics & Loss Functions

### Metrics Reference Table

| Metric | Formula | Best Used For | Warning |
|---|---|---|---|
| **Accuracy** | $\frac{TP + TN}{TP + TN + FP + FN}$ | Balanced classification datasets. | Misleading on imbalanced datasets (e.g. 99% majority class). |
| **Precision** | $\frac{TP}{TP + FP}$ | Minimizing false positives (e.g. spam, fraud flags). | Ignores missed positive cases (false negatives). |
| **Recall** | $\frac{TP}{TP + FN}$ | Minimizing false negatives (e.g. medical diagnosis). | Can be inflated by predicting positive on everything. |
| **F1 Score** | $2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$ | Balancing precision and recall on imbalanced data. | Assumes equal weighting between precision and recall. |
| **MAE** | $\frac{1}{N}\sum \|y_i - \hat{y}_i\|$ | Continuous prediction with occasional outliers. | Treats all errors linearly; does not penalize huge spikes. |
| **MSE / RMSE** | $\sqrt{\frac{1}{N}\sum (y_i - \hat{y}_i)^2}$ | Continuous prediction penalizing severe errors. | Sensitive to extreme data outliers. |
| **R² Score** | $1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$ | Explaining variance explained by regression model. | Can arbitrarily increase as more irrelevant features are added. |

---

## 3. Deep Learning & PyTorch Patterns

### Standard PyTorch Training Loop

```python
import torch
import torch.nn as nn
import torch.optim as optim

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = MyModel().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)

for epoch in range(num_epochs):
    model.train()
    for batch_x, batch_y in dataloader:
        batch_x, batch_y = batch_x.to(device), batch_y.to(device)
        
        optimizer.zero_grad(set_to_none=True)  # Memory efficient zeroing
        outputs = model(batch_x)
        loss = criterion(outputs, batch_y)
        loss.backward()
        
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
```

### Activation Functions Quick Reference

- **ReLU**: $f(x) = \max(0, x)$. Default for hidden layers; avoids vanishing gradients.
- **Sigmoid**: $\sigma(x) = \frac{1}{1 + e^{-x}}$. Squashes to $(0, 1)$; used for single-label binary classification.
- **Softmax**: $\text{Softmax}(z_i) = \frac{e^{z_i}}{\sum_j e^{z_j}}$. Normalizes logits to sum to 1.0; used for token selection.

---

## 4. Transformers & Attention Architecture

### Scaled Dot-Product Attention

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

- **Query ($Q$)**: What the current token is looking for.
- **Key ($K$)**: What other tokens expose about themselves.
- **Value ($V$)**: The actual contextual information transferred.
- **$\sqrt{d_k}$ Scaling**: Prevents dot products from exploding into regions where softmax has vanishing gradients.

### Model Architecture Comparison

| Architecture | Representative Models | Masking | Best For |
|---|---|---|---|
| **Encoder-Only** | BERT, RoBERTa | Bidirectional (sees all tokens) | Classification, Named Entity Recognition, Embedding Generation |
| **Decoder-Only** | GPT-4, Claude, Llama, DeepSeek | Causal (sees past tokens only) | Autoregressive text generation, chat, code writing, reasoning |
| **Encoder-Decoder** | T5, BART | Bidirectional encoder + Causal decoder | Translation, document summarization, text-to-text transformation |

---

## 5. LLM Token Economics & Sampling Parameters

| Parameter | Range | Recommended Value | Mechanical Effect |
|---|---|---|---|
| **Temperature** | $0.0 - 2.0$ | `0.0` (Code/Data) / `0.7` (Chat) | Divides logits by $T$ before softmax. Lower = greedy/deterministic; Higher = random. |
| **Top-P (Nucleus)** | $0.0 - 1.0$ | `0.9` | Samples from the smallest set of tokens whose cumulative probability $\ge P$. |
| **Top-K** | $1 - 100$ | `40` | Limits candidates to top $K$ highest probability tokens before sampling. |
| **Presence Penalty** | $-2.0 - 2.0$ | `0.0 - 0.5` | Penalizes tokens based on whether they appeared at all (encourages new topics). |
| **Frequency Penalty** | $-2.0 - 2.0$ | `0.0 - 0.5` | Penalizes tokens based on frequency of occurrence (prevents word repetition). |

---

## 6. Vector Database & RAG Cheatsheet (`pgvector`)

### Production PostgreSQL `pgvector` Schema & Index

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents & embeddings table
CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536) -- OpenAI text-embedding-3-small dimension
);

-- Approximate Nearest Neighbor (ANN) HNSW index for high QPS
CREATE INDEX ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Cosine similarity search query (<=> is cosine distance)
SELECT id, document_id, content, 
       1 - (embedding <=> $query_embedding) AS cosine_similarity
FROM document_chunks
WHERE metadata->>'tenant_id' = 'acme_corp'
ORDER BY embedding <=> $query_embedding
LIMIT 5;
```

---

## 7. Model Serving with vLLM

### Production Server Startup Command

```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-3.1-8B-Instruct \
    --tensor-parallel-size 1 \
    --dtype bfloat16 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --enable-prefix-caching \
    --host 0.0.0.0 --port 8000
```

### Key vLLM Flags

- `--gpu-memory-utilization 0.90`: Allocates 90% of GPU VRAM for model weights and KV-cache blocks.
- `--enable-prefix-caching`: Reuses KV-cache for shared system prompts and multi-turn conversations.
- `--max-model-len`: Maximum sequence length supported by the running engine.

---

## 8. LLM Evaluation & RAG Triad

| Metric | Question Answered | Evaluation Mechanism |
|---|---|---|
| **Faithfulness** | Does the answer contain claims NOT found in retrieved context? | LLM-as-judge checks each answer statement against context chunks. |
| **Answer Relevance** | Does the answer directly address the user query? | LLM-as-judge evaluates query-answer alignment, ignoring truthfulness. |
| **Context Relevance** | Are retrieved chunks actually relevant to the user query? | LLM-as-judge scores chunk signal-to-noise ratio. |

---

## 9. Fine-Tuning & LoRA Configuration

### PEFT LoRA Config with Hugging Face

```python
from peft import LoraConfig, get_peft_model, TaskType

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                         # Rank of update matrices
    lora_alpha=32,                # Scaling factor (typically 2 * r)
    lora_dropout=0.05,
    bias="none",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
)
```

---

## 10. Complete Course Glossary

| Term | One-Line Engineering Definition |
|---|---|
| **Token** | The atomic text unit processed by LLMs; roughly 4 characters or 0.75 words in English. |
| **Embedding** | A dense numerical vector mapping semantic meaning to coordinates in a continuous vector space. |
| **Context Window** | The maximum total token budget (input prompt + generated completion) an LLM can process in one pass. |
| **Self-Attention** | The mathematical mechanism enabling each token in a sequence to dynamically weigh and absorb information from all other tokens. |
| **Temperature** | A scalar dividing logits before softmax that flattens or sharpens token probability distributions. |
| **RAG** | Retrieval-Augmented Generation: dynamically retrieving external documents to ground LLM completions with current/private facts. |
| **Vector Database** | A specialized database designed to index, store, and execute approximate nearest neighbor (ANN) similarity searches on dense vectors. |
| **AI Agent** | An LLM wrapped in a loop with tools, state, and memory, capable of autonomous multi-step execution. |
| **Fine-Tuning** | Adapting the weights of a pretrained model on task-specific data to alter its format, style, or behavioral reflexes. |
| **LoRA** | Low-Rank Adaptation: freezes base weights and trains lightweight low-rank decomposition matrices ($A \times B$). |
| **Hallucination** | A model response that is grammatically fluent and confident, but factually false or unsupported by source facts. |
| **Inference** | Executing a trained neural network forward pass to generate predictions or generate text completions. |
| **MLOps / LLMOps** | The operational discipline, infrastructure, and CI/CD pipelines governing model training, evaluation, deployment, and observability. |
| **LLM-as-a-Judge** | Using an advanced frontier LLM with structured rubrics to automatically evaluate and score outputs from candidate models or pipelines. |
| **KV-Cache** | Caching calculated Key and Value attention matrices during autoregressive generation to eliminate redundant compute. |
| **PagedAttention** | An algorithm that partitions KV-caches into non-contiguous virtual memory blocks, eliminating VRAM fragmentation in vLLM. |
