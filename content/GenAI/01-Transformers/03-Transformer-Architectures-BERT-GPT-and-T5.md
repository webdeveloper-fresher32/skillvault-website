# Transformer Architectures: BERT, GPT, and T5 — Complete Guide

> "An Encoder is like an analytical detective reading an entire case file front-to-back to understand what happened; a Decoder is like a novelist writing the next sentence of a story one word at a time, looking only at what has already been written."

---

## Table of Contents

1. [The Problem: Assembling the Full Neural Architecture](#1-the-problem-assembling-the-full-neural-architecture)
2. [The Detective and the Novelist Analogy](#2-the-detective-and-the-novelist-analogy)
3. [The Mechanism: Feed-Forward Networks, Normalization, and Architecture Families](#3-the-mechanism-feed-forward-networks-normalization-and-architecture-families)
4. [Diagram: Encoder-Only vs Decoder-Only vs Encoder-Decoder](#4-diagram-encoder-only-vs-decoder-only-vs-encoder-decoder)
5. [Code Walkthrough: Complete Transformer Block in PyTorch](#5-code-walkthrough-complete-transformer-block-in-pytorch)
6. [Comparing BERT, GPT, and T5](#6-comparing-bert-gpt-and-t5)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Assembling the Full Neural Architecture

In Lesson 2, we built the Self-Attention mechanism, which mixes information *between* tokens. However, Self-Attention alone is not a complete neural network:
1. **Attention is purely a linear routing mechanism**: It calculates weighted averages of value vectors ($\sum \alpha_i V_i$). Without non-linear transformations, it cannot perform deep reasoning or store complex factual knowledge.
2. **Deep Stacking Instability**: If you stack 30 attention layers on top of each other, values either explode or collapse into zero during backpropagation.

### What the Complete Transformer Block Provides

A complete **Transformer Block** combines three elements into an invariant, repeatable computational unit:
- **Multi-Head Attention**: Gathers and routes relational context between tokens.
- **Feed-Forward Network (FFN)**: Processes each token's representation individually through a non-linear expansion (typically $4\times d_{\text{model}}$) to memorize facts and synthesize features.
- **Residual Skip Connections & Layer Normalization**: Stabilizes activations and creates gradient highways, enabling networks to scale to hundreds of layers.

---

## 2. The Detective and the Novelist Analogy

Consider the fundamental difference between analyzing an existing document and generating a new one.

### Understanding vs Generating

```text
The Detective (Encoder-Only / BERT):
  Reads the entire crime report at once (all words simultaneously).
  - Can look ahead to paragraph 3 while reading paragraph 1.
  - Bidirectional attention allows deep, holistic comprehension.
  - Output: A rich contextual understanding vector (for classification, search, embeddings).
  - Cannot generate natural flowing text token-by-token.

The Novelist (Decoder-Only / GPT):
  Writes a novel from left to right, one word at a time.
  - Can only look at words already written (Causal Masking).
  - Forbidden from looking ahead into future unwritten chapters.
  - Output: Repeated next-token probability distribution.
  - The foundation of ChatGPT, Claude, and modern generative AI.

The Translator (Encoder-Decoder / T5):
  First, the Detective reads the French book completely (Encoder).
  Then, conditioned on that understanding, the Novelist writes the English translation (Decoder).
```

---

## 3. The Mechanism: Feed-Forward Networks, Normalization, and Architecture Families

Stacking attention and feed-forward sublayers produces the complete Transformer architecture.

### 1. The Position-wise Feed-Forward Network (FFN)

After Multi-Head Attention mixes context across tokens, each token vector $\mathbf{x}_i \in \mathbb{R}^{d_{\text{model}}}$ is passed independently through a 2-layer MLP:

$$\text{FFN}(\mathbf{x}) = \max(0, \mathbf{x} W_1 + \mathbf{b}_1) W_2 + \mathbf{b}_2$$

- **Expansion**: $W_1$ projects the hidden dimension up by $4\times$ (e.g. from $4096$ to $16384$ in Llama 3).
- **Non-Linearity**: Applied via ReLU, GELU, or modern **SwiGLU** (Swish-Gated Linear Units).
- **Projection**: $W_2$ projects back down to $d_{\text{model}}$.

Research shows that the FFN layers act as the model's **key-value associative memory**, storing factual world knowledge learned during pretraining.

### 2. Pre-LayerNorm vs Post-LayerNorm

- **Post-LayerNorm (Original 2017 Transformer)**: $\mathbf{x} = \text{LayerNorm}(\mathbf{x} + \text{Sublayer}(\mathbf{x}))$. Placed normalization *after* the residual addition. In deep networks, gradients degrade rapidly, requiring delicate learning rate warmup schedules.
- **Pre-LayerNorm (Modern Transformer Standard)**: $\mathbf{x} = \mathbf{x} + \text{Sublayer}(\text{LayerNorm}(\mathbf{x}))$. Normalizes inputs *before* feeding into attention and FFN layers. The residual path remains an unaltered identity highway ($\mathbf{x} + \dots$), drastically improving training stability in models with hundreds of layers.
- **RMSNorm**: Modern models (Llama, Mistral) replace LayerNorm with Root Mean Square Normalization, removing mean centering and computing only variance scaling, providing a $10\%–15\%$ speedup without loss of accuracy.

### 3. The Three Architecture Families

1. **Encoder-Only (BERT, RoBERTa)**:
   - Uses bidirectional attention (no causal mask).
   - Pretrained on Masked Language Modeling (MLM): replacing $15\%$ of tokens with `[MASK]` and predicting them.
   - Ideal for text classification, embedding generation, sentiment analysis, and NER.
2. **Decoder-Only (GPT-4, Claude, Llama 3, DeepSeek)**:
   - Uses causal attention (lower-triangular mask).
   - Pretrained on autoregressive next-token prediction: $\max \sum \log P(w_t \mid w_{<t})$.
   - Ideal for conversation, code generation, creative writing, and autonomous reasoning.
3. **Encoder-Decoder (T5, BART)**:
   - Bidirectional encoder connected to a causal decoder via cross-attention.
   - Ideal for sequence-to-sequence translation and abstractive summarization.

---

## 4. Diagram: Encoder-Only vs Decoder-Only vs Encoder-Decoder

```text
ENCODER-ONLY (BERT):         DECODER-ONLY (GPT):          ENCODER-DECODER (T5):
Bidirectional Attention       Causal (Autoregressive)      Encodes Input -> Cross Attention
Tokens attend to ALL tokens   Tokens attend ONLY to past   Decoder attends to Encoder Outputs
      w1 ── w2 ── w3               w1 ──► w2 ──► w3         [ Input ] ──► [ Encoder ]
      │ \  / │ \  / │              │       │     │                             │ (Cross-Attn)
      ▼  \/  ▼  \/  ▼              ▼       ▼     ▼                             ▼
   [ Fully Connected ]          [ Causal Masked ]           [ Prompt ] ──► [ Decoder ] ──► Out
```

---

## 5. Code Walkthrough: Complete Transformer Block in PyTorch

Here is an end-to-end PyTorch implementation of a complete modern Pre-LayerNorm Transformer Block:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

# 1. SwiGLU Feed-Forward Network (Modern standard used in Llama 3)
class SwiGLUFeedForward(nn.Module):
    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        # SwiGLU uses three linear projections: gate, up, down
        self.w_gate = nn.Linear(d_model, d_ff, bias=False)
        self.w_up   = nn.Linear(d_model, d_ff, bias=False)
        self.w_down = nn.Linear(d_ff, d_model, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # SwiGLU(x) = (SiLU(x * W_gate) * (x * W_up)) * W_down
        return self.w_down(F.silu(self.w_gate(x)) * self.w_up(x))

# 2. Complete Modern Transformer Block (Pre-LayerNorm)
class TransformerBlock(nn.Module):
    def __init__(self, d_model: int, num_heads: int, d_ff: int):
        super().__init__()
        self.attn_norm = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(
            embed_dim=d_model, 
            num_heads=num_heads, 
            batch_first=True
        )
        self.ffn_norm = nn.LayerNorm(d_model)
        self.ffn = SwiGLUFeedForward(d_model=d_model, d_ff=d_ff)

    def forward(self, x: torch.Tensor, causal_mask: torch.Tensor = None) -> torch.Tensor:
        # --- SUB-LAYER 1: ATTENTION WITH RESIDUAL SKIP CONNECTION ---
        # Pre-LayerNorm: normalize first, then attend
        normed_x = self.attn_norm(x)
        attn_out, _ = self.attn(
            query=normed_x, 
            key=normed_x, 
            value=normed_x, 
            attn_mask=causal_mask,
            need_weights=False
        )
        # Residual addition: output = input + f(input)
        x = x + attn_out

        # --- SUB-LAYER 2: FEED-FORWARD WITH RESIDUAL SKIP CONNECTION ---
        # Pre-LayerNorm: normalize first, then FFN
        normed_x2 = self.ffn_norm(x)
        ffn_out = self.ffn(normed_x2)
        # Residual addition
        x = x + ffn_out

        return x

# 3. Assemble a 4-layer Decoder-Only Model
class MiniDecoderTransformer(nn.Module):
    def __init__(self, vocab_size: int, d_model: int, num_heads: int, num_layers: int):
        super().__init__()
        self.token_embeddings = nn.Embedding(vocab_size, d_model)
        self.layers = nn.ModuleList([
            TransformerBlock(d_model=d_model, num_heads=num_heads, d_ff=d_model * 4)
            for _ in range(num_layers)
        ])
        self.final_norm = nn.LayerNorm(d_model)
        # Language model head: projects hidden states to vocabulary logits
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        # Weight tying: share weights between embedding and lm_head
        self.lm_head.weight = self.token_embeddings.weight

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        batch_size, seq_len = input_ids.size()
        
        # 1. Lookup embeddings
        h = self.token_embeddings(input_ids)
        
        # 2. Build upper-triangular causal mask
        causal_mask = nn.Transformer.generate_square_subsequent_mask(seq_len).to(input_ids.device)
        
        # 3. Pass through all stacked Transformer blocks
        for layer in self.layers:
            h = layer(h, causal_mask=causal_mask)
            
        # 4. Final normalization and logit projection
        h = self.final_norm(h)
        logits = self.lm_head(h)  # Shape: (batch, seq_len, vocab_size)
        return logits

# 4. Test Forward Pass
vocab_size = 5000
d_model = 128
num_heads = 4
num_layers = 4

model = MiniDecoderTransformer(vocab_size, d_model, num_heads, num_layers)
dummy_tokens = torch.randint(0, vocab_size, (2, 8))  # Batch of 2, 8 tokens long

output_logits = model(dummy_tokens)
print(f"Input Token Batch Shape: {dummy_tokens.shape}")
print(f"Output Logits Shape:     {output_logits.shape} (Ready for next-token Cross-Entropy Loss!)")
```

---

## 6. Comparing BERT, GPT, and T5

### Architectural Comparison Matrix

| Feature | BERT (Encoder-Only) | GPT (Decoder-Only) | T5 (Encoder-Decoder) |
|---|---|---|---|
| **Attention Mechanism** | Bidirectional (all-to-all) | Causal (past-only) | Bidirectional encoder + Causal decoder |
| **Training Objective** | Masked Language Modeling (MLM) | Next-Token Prediction | Span corruption / Denoising |
| **Primary Output** | Embeddings / classification logits | Autoregressive text stream | Sequence-to-sequence text |
| **Generation Capability** | Cannot generate flowing text | **State-of-the-Art Generative Text** | Good, but higher serving complexity |
| **KV-Cache Usage** | None | **Critical for low latency** | Used only in decoder stack |
| **Industry Standing** | Widely used for search/embeddings | **Dominant paradigm for foundation LLMs** | Used for specialized summarization/translation |

---

## 7. Common Mistakes

- **Assuming all Transformers have an Encoder and a Decoder.** The original 2017 paper had both for machine translation, but modern LLMs (GPT-4, Claude, Llama) are **Decoder-Only**. They have no separate encoder stack.
- **Using Post-LayerNorm in deep networks.** Post-LayerNorm scales poorly past 20 layers without severe gradient instabilities. All modern LLM architectures use Pre-LayerNorm or Pre-RMSNorm.
- **Not weight-tying the Embedding Matrix and LM Head.** In language models, the output projection matrix $W_{\text{head}} \in \mathbb{R}^{d_{\text{model}} \times V}$ has the exact same dimensions as the transposed input embedding matrix $W_E^T$. Sharing (tying) these weights saves hundreds of millions of parameters without loss of quality.
- **Applying causal masking to BERT.** Adding a causal mask to an encoder model turns it into a decoder, crippling its ability to synthesize future contextual tokens.

---

## 8. Hands-On Exercises

**Exercise 1:** Count the parameters of the `MiniDecoderTransformer` from Section 5: write a function `count_parameters(model)` that iterates through `model.named_parameters()` and prints parameter counts separated by embeddings, attention layers, and FFN blocks.

**Exercise 2:** Implement Weight Tying explicitly in PyTorch: show that `model.lm_head.weight is model.token_embeddings.weight` returns `True`, and demonstrate that updating the LM head automatically updates the embedding table.

**Exercise 3:** Implement an autoregressive text generation loop: feed an initial prompt of 3 token IDs into the `MiniDecoderTransformer`, predict the next token via `argmax`, append it to the sequence, and generate 10 successive tokens in a loop.

**Exercise 4:** Implement RMSNorm from scratch in PyTorch: subclass `nn.Module`, compute $\text{RMS}(x) = \sqrt{\frac{1}{d}\sum x_i^2 + \epsilon}$, normalize by $\frac{x}{\text{RMS}(x)}$, and scale by a learned weight parameter $\gamma$.

**Exercise 5:** Verify Pre-LN stability: build an 80-layer network with Post-LN and another with Pre-LN. Compute gradients of the first layer with respect to loss, demonstrating that Pre-LN preserves non-zero gradient magnitudes while Post-LN gradients vanish.

---

## 9. Interview Q&A

**Q: Why did Decoder-Only architectures (GPT) win over Encoder-Decoder architectures (T5) for general-purpose LLMs?**
1. **Unified Objective**: Next-token autoregressive prediction is universally applicable. Any NLP task (classification, code generation, summarization, translation, math reasoning) can be framed naturally as next-token prediction without changing architectures.
2. **Compute & KV-Cache Efficiency**: In an Encoder-Decoder, every generation step must attend back to the encoder states via cross-attention, maintaining two separate sets of representations. Decoder-Only models have a single uniform KV-cache, optimizing memory bandwidth and GPU serving efficiency.
3. **In-Context Few-Shot Learning**: Decoder-only causal pretraining naturally encourages the model to infer patterns from preceding few-shot examples in its prompt prefix, enabling massive generalization.

**Q: What is the purpose of the Feed-Forward Network (FFN) sub-layer if attention already mixes tokens?**
Multi-Head Attention is fundamentally a routing and alignment mechanism: it decides *where* to move information by computing linear weighted combinations of existing values. It does not introduce significant non-linear computational depth per token. The FFN processes each token's vector independently through a large non-linear projection (typically expanding dimension by $4\times$, e.g. from 4k to 16k with GELU/SwiGLU). Mechanistically, research demonstrates that FFN weights act as key-value associative memories, storing factual world knowledge learned during pretraining that is recalled and synthesized during generation.

**Q: What is the difference between Pre-LayerNorm and Post-LayerNorm, and why was the transition critical for scaling?**
- **Post-LayerNorm**: The residual connection adds the sublayer output and then normalizes: $x_{l+1} = \text{LN}(x_l + f(x_l))$. In deep networks, the normalization step scales down the residual signal at every layer, creating an exponential gradient degradation pathway during backpropagation that requires strict learning rate warmup to avoid divergence.
- **Pre-LayerNorm**: Normalization is applied *before* the sublayer, and added directly to the untouched residual: $x_{l+1} = x_l + f(\text{LN}(x_l))$. The residual path forms a direct identity highway ($x_L = x_0 + \sum f(\text{LN}(x_l))$), allowing gradients to flow back to early layers without impediment, enabling models to scale stably to hundreds of layers.

**Q: What is SwiGLU, and why is it preferred in modern LLMs like Llama 3?**
SwiGLU (Swish-Gated Linear Unit) is a modern activation variant for the FFN layer introduced by Noam Shazeer. Instead of a standard single-projection FFN ($W_2 \cdot \text{ReLU}(W_1 x)$), SwiGLU uses two parallel projections with a Swish (SiLU) gating mechanism:
$$\text{SwiGLU}(x) = ( \text{SiLU}(x W_{\text{gate}}) \otimes x W_{\text{up}} ) W_{\text{down}}$$
The element-wise multiplication ($\otimes$) allows one linear branch to act as a dynamic continuous gate controlling how much information flows through the second branch. Empirically, SwiGLU consistently achieves lower perplexity and faster convergence across language benchmarks than standard ReLU or GELU FFNs.

**Q: How does Weight Tying work, and what are its memory benefits?**
Weight Tying sets the weight matrix of the final language modeling output head (`lm_head`) to share the exact same physical memory pointer as the input embedding matrix: `self.lm_head.weight = self.token_embeddings.weight`. In an LLM with vocabulary size $V = 128,000$ and hidden dimension $d = 4096$, an un-tied matrix requires $128,000 \times 4096 \times 2\text{ bytes} \approx 1.05\text{ GB}$ of parameters. Weight tying eliminates this duplicate parameter matrix, saving over 1 GB of memory while regularizing the model by forcing token input semantics and output prediction vectors to inhabit the same geometric space.
