# Self-Attention and Multi-Head Attention — Complete Guide

> "A database query submits a search term (Query) to match indexed table tags (Keys) and retrieve the matching row data (Values); Self-Attention is a soft, differentiable database lookup where every word queries every other word simultaneously."

---

## Table of Contents

1. [The Problem: How Can Words Understand Contextual Context?](#1-the-problem-how-can-words-understand-contextual-context)
2. [The Filing Cabinet Database Analogy](#2-the-filing-cabinet-database-analogy)
3. [The Mechanism: Queries, Keys, Values, and Scaled Attention](#3-the-mechanism-queries-keys-values-and-scaled-attention)
4. [Diagram: Scaled Dot-Product Attention Matrix Flow](#4-diagram-scaled-dot-product-attention-matrix-flow)
5. [Code Walkthrough: Scaled Dot-Product & Multi-Head Attention in PyTorch](#5-code-walkthrough-scaled-dot-product--multi-head-attention-in-pytorch)
6. [Comparing Single-Head vs Multi-Head vs FlashAttention](#6-comparing-single-head-vs-multi-head-vs-flashattention)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: How Can Words Understand Contextual Context?

In human language, the meaning of a word depends entirely on the words surrounding it:

```text
Sentence A: "The bank of the river was muddy and steep."
Sentence B: "The bank approved the commercial mortgage loan."
```

In both sentences, the token `"bank"` has the exact same initial dictionary embedding vector. 

### Why Static Embeddings Fail

Static word vectors (Word2Vec, GloVe) assign a single fixed coordinate vector to `"bank"`, forcing financial institutions and muddy riverbanks to share the same vector space!

Furthermore, consider pronouns:
> *"The animal didn't cross the street because **it** was too tired."*
> *"The animal didn't cross the street because **it** was too wide."*

In the first sentence, **"it"** refers to the animal. In the second sentence, changing one single word ("tired" $\rightarrow$ "wide") causes **"it"** to refer to the street!

### What Self-Attention Solves

Words need an interactive computational mechanism that dynamically updates their representations based on their neighbors. **Self-Attention** allows every token in a sequence to look at all other tokens, calculate how relevant each neighbor is, and absorb relevant information into its own representation.

---

## 2. The Filing Cabinet Database Analogy

Consider querying a traditional database or searching an office filing cabinet.

### Hard Lookup vs Soft Differentiable Attention

```text
Traditional Database Query (Hard Exact Match):
  Query:  "Find document WHERE tag == 'Mortgage'"
  Keys:   [Tag: 'Biology', Tag: 'Mortgage', Tag: 'Astronomy']
  Match:  Binary exact match (0 or 1).
  Value:  Retrieve 100% of the Mortgage folder.

Self-Attention (Soft Differentiable Lookup):
  Query (Q): What the current word is looking for.
             Word "it" asks: "Who was tired?"
  Keys  (K): What other words advertise about themselves.
             "animal" advertises: "Living creature, fatigue-capable"
             "street" advertises: "Inanimate asphalt path"
  Dot Product (Q . K^T):
             "it" . "animal" = High Score (8.2)
             "it" . "street" = Low Score (0.4)
  Softmax:   Normalizes scores into percentage weights (e.g. 92% animal, 8% street).
  Values (V): The actual content pulled.
             "it" absorbs 92% of "animal"'s features and 8% of "street"'s features!
```

---

## 3. The Mechanism: Queries, Keys, Values, and Scaled Attention

The heart of every Transformer block is the **Scaled Dot-Product Attention** equation:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

### 1. Generating Q, K, and V via Linear Projections

Given an input matrix of token representations $X \in \mathbb{R}^{L \times d_{\text{model}}}$ (where $L$ is sequence length), the model projects $X$ into three separate matrices using learned weight projections:

$$Q = X W_Q, \quad K = X W_K, \quad V = X W_V$$

Where $W_Q, W_K, W_V \in \mathbb{R}^{d_{\text{model}} \times d_k}$.

### 2. Step-by-Step Attention Computation

1. **Calculate Alignment Scores ($QK^T$)**: Multiplying the $(L \times d_k)$ Query matrix by the transposed $(d_k \times L)$ Key matrix computes the dot product between every query and all keys, producing an $(L \times L)$ attention matrix of raw scores.
2. **Scale by $\sqrt{d_k}$**: In high dimensions ($d_k = 64$ or $128$), dot products can grow large, causing softmax gradients to vanish. Dividing by $\sqrt{d_k}$ maintains unit variance.
3. **Optional Masking**: In causal autoregressive models (GPT), an upper-triangular mask sets future attention positions to $-\infty$ so tokens cannot look ahead into the future.
4. **Softmax Normalization**: $\text{softmax}(QK^T / \sqrt{d_k})$ converts raw scores along each row into a probability distribution summing to $1.0$. Row $i$ represents how much token $i$ attends to all tokens $j$.
5. **Value Weighting**: Multiplying the $(L \times L)$ probability matrix by the $(L \times d_v)$ Value matrix computes a weighted sum of the values, producing an updated $(L \times d_v)$ context-rich representation for every token.

### 3. Multi-Head Attention: Parallel Linguistic Subspaces

Instead of performing a single attention operation with dimension $d_{\text{model}}$, **Multi-Head Attention** splits the model into $h$ parallel attention heads (e.g. $h=8$ or $h=32$, with $d_k = d_{\text{model}} / h$):

$$\text{MHA}(Q, K, V) = \text{Concat}(\text{head}_1, \dots, \text{head}_h) W_O$$

$$\text{head}_i = \text{Attention}(Q W_Q^{(i)}, K W_K^{(i)}, V W_V^{(i)})$$

Why multiple heads? A single attention head can only construct one attention distribution per token. Multi-Head Attention allows different heads to specialize simultaneously:
- Head 1: Tracks grammatical dependencies (verb to direct object).
- Head 2: Tracks coreference resolution (pronoun to noun).
- Head 3: Tracks topical semantic similarity.
- Head 4: Tracks positional proximity (adjacent tokens).

---

## 4. Diagram: Scaled Dot-Product Attention Matrix Flow

```text
  Queries (Q)          Keys (K)^T
  (L x d_k)            (d_k x L)
    [ q_1 ]              [ k_1  k_2  k_3 ]
    [ q_2 ]      @                                 Scale by 1/sqrt(d_k)
    [ q_3 ]                                                │
       │                                                   ▼
       └───────────────────────────────────► [ Raw Scores (L x L) ]
                                                           │
                                                           ▼
                                                [ Optional Causal Mask ]
                                                (Set future cells to -inf)
                                                           │
                                                           ▼
                                                [ Softmax (Row-wise) ]
                                                Attention Weights (L x L)
                                                           │
                                                           ▼
                                             Weights @ Values (L x d_v)
                                                           │
                                                           ▼
                                             Contextual Output (L x d_v)
```

---

## 5. Code Walkthrough: Scaled Dot-Product & Multi-Head Attention in PyTorch

Here is an end-to-end PyTorch implementation of Multi-Head Attention built from scratch:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

# 1. Scaled Dot-Product Attention Function
def scaled_dot_product_attention(
    q: torch.Tensor, 
    k: torch.Tensor, 
    v: torch.Tensor, 
    mask: torch.Tensor = None
) -> tuple[torch.Tensor, torch.Tensor]:
    # q, k, v shape: (batch_size, num_heads, seq_len, d_k)
    d_k = q.size(-1)
    
    # 1. Compute pairwise dot products: (batch, heads, seq_len, d_k) @ (batch, heads, d_k, seq_len)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
    
    # 2. Apply attention mask if provided (e.g. Causal Mask or Padding Mask)
    if mask is not None:
        # Fill masked positions with -infinity so softmax assigns them 0.0 probability
        scores = scores.masked_fill(mask == 0, -1e9)
        
    # 3. Softmax along the last dimension (keys)
    attention_weights = F.softmax(scores, dim=-1)
    
    # 4. Weighted combination of Values: (batch, heads, seq_len, seq_len) @ (batch, heads, seq_len, d_k)
    output = torch.matmul(attention_weights, v)
    
    return output, attention_weights

# 2. Complete Multi-Head Attention Module
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, num_heads: int):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads  # Dimension of each individual head
        
        # Combined projection matrices for efficiency (Q, K, V in one linear layer)
        self.q_proj = nn.Linear(d_model, d_model)
        self.k_proj = nn.Linear(d_model, d_model)
        self.v_proj = nn.Linear(d_model, d_model)
        
        # Final output projection
        self.out_proj = nn.Linear(d_model, d_model)

    def forward(self, x: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        batch_size, seq_len, _ = x.size()
        
        # 1. Project inputs to Q, K, V: (batch, seq_len, d_model)
        q = self.q_proj(x)
        k = self.k_proj(x)
        v = self.v_proj(x)
        
        # 2. Reshape into multi-head format: (batch, num_heads, seq_len, d_k)
        q = q.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        
        # 3. Compute scaled dot-product attention across all heads in parallel
        out, attn_weights = scaled_dot_product_attention(q, k, v, mask=mask)
        
        # 4. Concatenate heads back together: (batch, seq_len, d_model)
        out = out.transpose(1, 2).contiguous().view(batch_size, seq_len, self.d_model)
        
        # 5. Final linear projection
        return self.out_proj(out)

# 3. Test with a batch of token representations and Causal Mask
batch_size = 2
seq_len = 4
d_model = 64
num_heads = 4

mha = MultiHeadAttention(d_model=d_model, num_heads=num_heads)
dummy_input = torch.randn(batch_size, seq_len, d_model)

# Create a Causal Mask (lower triangular matrix of 1s, upper triangular 0s)
causal_mask = torch.tril(torch.ones(seq_len, seq_len)).unsqueeze(0).unsqueeze(0)
print(f"Causal Mask Shape: {causal_mask.shape}")
print(f"Causal Mask:\n{causal_mask[0, 0].int()}\n")

output = mha(dummy_input, mask=causal_mask)
print(f"Input Tensor Shape:  {dummy_input.shape}")
print(f"Output Tensor Shape: {output.shape} (Input and output shapes match perfectly!)")
```

---

## 6. Comparing Single-Head vs Multi-Head vs FlashAttention

### Attention Variants Comparison

| Architecture | Memory Complexity (IO) | Computational Speed | Subspace Diversity | Production Status |
|---|---|---|---|---|
| **Single-Head Attention** | $O(L^2)$ intermediate VRAM | Moderate | Poor (can only average one relationship) | Deprecated. |
| **Multi-Head Attention (MHA)** | $O(L^2)$ intermediate VRAM | Fast | **Excellent** (tracks $h$ distinct semantic relations) | Foundation of Transformers. |
| **Multi-Query Attention (MQA)** | $O(L^2)$ VRAM | Faster inference (shares single $K, V$ head) | Slight quality drop | Used in Falcon, PaLM to reduce KV-cache memory. |
| **Grouped-Query Attention (GQA)** | $O(L^2)$ VRAM | Optimal balance | High | **Modern Standard** (Llama 3, Mistral). |
| **FlashAttention (v1, v2, v3)** | **$O(L)$ IO Memory** (Tiled in SRAM) | **$3\times - 8\times$ Faster** | Identical math to MHA | **Universal standard GPU kernel for training & serving**. |

---

## 7. Common Mistakes

- **Forgetting that standard Attention has $O(L^2)$ memory scaling.** The intermediate attention score matrix $(L \times L)$ scales quadratically with sequence length. Doubling context length from 4k to 8k quadruples attention memory! FlashAttention or GQA is required for long contexts.
- **Transposing wrong dimensions during multi-head reshaping.** You must transpose dimensions 1 and 2 (`transpose(1, 2)`) so the tensor shape is `(batch, num_heads, seq_len, d_k)` before multiplying $Q$ and $K^T$. Omitting `.contiguous()` before `.view()` will trigger runtime errors.
- **Applying causal masking incorrectly.** The mask must fill invalid future positions with $-1e9$ (or $-\infty$) *before* applying Softmax, not *after*. Masking after Softmax results in zeroed rows that do not sum to $1.0$.
- **Confusing Attention Weights with Values.** Attention weights ($\text{softmax}(QK^T/\sqrt{d_k})$) are scalars representing relevance percentages; Values ($V$) are the actual feature vectors containing semantic content.

---

## 8. Hands-On Exercises

**Exercise 1:** Implement a standalone function `create_causal_mask(seq_len)` in PyTorch using `torch.tril` and verify that upper-triangular elements are set to `-1e9` while lower-triangular elements are `0.0`.

**Exercise 2:** Extract and visualize the attention weight heatmap using Matplotlib for a toy 5-word sentence, showing how words attend heavily to themselves and their direct grammatical objects.

**Exercise 3:** Implement Grouped-Query Attention (GQA): create a module where there are 8 Query heads, but only 2 Key and 2 Value heads (each KV head is shared across 4 Query heads). Verify the tensor broadcasting mechanics.

**Exercise 4:** Benchmark the execution time of PyTorch's native `F.scaled_dot_product_attention` (which uses FlashAttention under the hood) against the manual implementation from Section 5 for sequence length $L = 2048$.

**Exercise 5:** Verify permutation equivariance: feed an unmasked multi-head attention module a tensor, then feed it the same tensor with row 1 and row 2 swapped. Prove that the outputs are identical except for rows 1 and 2 being swapped.

---

## 9. Interview Q&A

**Q: Why does the attention matrix scale quadratically $O(L^2)$ with sequence length, and how does FlashAttention solve the memory bottleneck?**
In self-attention, every token in a sequence of length $L$ must compute an inner product with all other $L$ tokens, yielding an $(L \times L)$ attention matrix. Storing this $(L \times L)$ matrix in high-bandwidth GPU memory (HBM) creates an $O(L^2)$ memory bottleneck. FlashAttention solves this without changing the underlying mathematical output: it computes attention by **tiling** the inputs into blocks that fit entirely within the GPU's fast on-chip SRAM cache. It computes local softmax normalizations incrementally via the online softmax algorithm and recomputes intermediate attention values during backpropagation, reducing high-bandwidth memory reads/writes from $O(L^2)$ down to $O(L)$ linear memory complexity.

**Q: What is Grouped-Query Attention (GQA), and why is it used in Llama 3 instead of standard Multi-Head Attention?**
In standard Multi-Head Attention (MHA), there are $h$ Query heads, $h$ Key heads, and $h$ Value heads. During inference, the Key and Value matrices for all past tokens must be stored in GPU VRAM (the KV-cache). In long-context models, the KV-cache consumes more memory than the model weights themselves! In GQA, multiple Query heads (e.g. 8) share a single Key and Value head. This reduces the KV-cache size and GPU memory bandwidth by a factor of 8 with virtually zero degradation in model capability, drastically increasing serving throughput.

**Q: What is the mathematical meaning of the Query, Key, and Value vectors?**
The Query, Key, and Value vectors are linear projections of the token's hidden state into specialized geometric functional roles:
- **Query ($Q = XW_Q$)**: Represents what the token is seeking or needing to disambiguate (e.g. "I am a pronoun looking for a noun antecedent").
- **Key ($K = XW_K$)**: Represents what the token advertises about its own identity (e.g. "I am a singular masculine noun").
- **Value ($V = XW_V$)**: Contains the actual semantic features to be transferred if a match is established.
Separating $Q, K, V$ into distinct learned projections gives the model the mathematical flexibility to match on one set of properties (spelling, category, grammar) while transferring a completely different set of semantic features.

**Q: What is Causal Masking, and why is it strictly forbidden in BERT but mandatory in GPT?**
Causal masking sets all attention scores corresponding to future token positions ($j > i$) to $-\infty$ before applying Softmax, guaranteeing that token $i$ can only attend to previous tokens $j \le i$. 
- **Mandatory in GPT**: GPT is an autoregressive decoder designed to generate text one token at a time. If it could attend to future tokens during training, it would simply "cheat" by looking at the next word rather than learning to predict it.
- **Forbidden in BERT**: BERT is an encoder designed for deep contextual understanding. It needs bidirectional attention so that every token can synthesize information from both preceding and succeeding context simultaneously.

**Q: Why is Self-Attention permutation-equivariant, and why does this make positional encodings mandatory?**
Matrix multiplication and row-wise softmax operate independently across row indices. If the rows of input matrix $X$ are permuted by a permutation matrix $P$ ($X_{\text{perm}} = P \cdot X$), then:
$$\text{Attention}(PX) = \text{softmax}\left(\frac{P Q (P K)^T}{\sqrt{d_k}}\right) P V = \text{softmax}\left(\frac{P Q K^T P^T}{\sqrt{d_k}}\right) P V = P \cdot \text{Attention}(X)$$
The output is identical to the unpermuted output, simply permuted by the same matrix $P$. Without positional encodings, the model cannot distinguish between `"Dog bites man"` and `"Man bites dog"`. Positional encodings break this symmetry by modifying each token's vector based on its sequence position.
