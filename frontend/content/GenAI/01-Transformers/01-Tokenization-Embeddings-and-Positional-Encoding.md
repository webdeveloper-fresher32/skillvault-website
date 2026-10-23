# Tokenization, Embeddings, and Positional Encoding — Complete Guide

> "Words are the books on a library shelf; tokenization breaks them into standard volume chapters, embeddings map their themes to room coordinates, and positional encodings stamp them with page numbers so the narrative order is never lost."

---

## Table of Contents

1. [The Problem: Translating Human Text into Vector Numbers](#1-the-problem-translating-human-text-into-vector-numbers)
2. [The Library Indexing Analogy](#2-the-library-indexing-analogy)
3. [The Mechanism: Sub-Words, Embedding Tables, and Positional Coordinates](#3-the-mechanism-sub-words-embedding-tables-and-positional-coordinates)
4. [Diagram: The Tokenization to Positional Embedding Pipeline](#4-diagram-the-tokenization-to-positional-embedding-pipeline)
5. [Code Walkthrough: Implementing BPE Tokenization and Embeddings in PyTorch](#5-code-walkthrough-implementing-bpe-tokenization-and-embeddings-in-pytorch)
6. [Comparing Positional Encoding Strategies: Absolute vs Relative vs RoPE](#6-comparing-positional-encoding-strategies-absolute-vs-relative-vs-rope)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Translating Human Text into Vector Numbers

Computers and neural networks cannot directly process the string `"The quick brown fox"`. They can only perform floating-point multiplications on continuous numerical tensors.

### The Failure of Naive Approaches

Historically, Natural Language Processing tried two naive approaches:
1. **Character-Level Representation**:
   - Represent text as individual characters: `['T', 'h', 'e', ' ', 'q', 'u', 'i', 'c', 'k']`.
   - Small vocabulary (256 ASCII characters), but sequences become ridiculously long. A 1,000-word essay requires 5,000 timesteps, exceeding attention memory budgets. Individual characters carry almost zero standalone semantic meaning.
2. **Word-Level Representation**:
   - Split strictly on whitespace: `["The", "quick", "brown", "fox"]`.
   - The vocabulary explodes to over 1,000,000 words. Rare words, typos, and newly invented words (`"microservices"`, `"unfriend"`) trigger catastrophic **Out-of-Vocabulary (OOV)** `<UNK>` errors.

### What Sub-Word Tokenization Solves

Modern LLMs use **Sub-Word Tokenization** (such as Byte-Pair Encoding / BPE). Frequent words remain single tokens (`"the"`, `"hello"`), while rare or compound words are split into recurring morphological subunits (`"unbelievable"` $\rightarrow$ `["un", "believ", "able"]`). This bounds the vocabulary to a fixed size (e.g. 50,000–128,000 tokens) while guaranteeing that **any** arbitrary unicode string can be represented without OOV errors.

---

## 2. The Library Indexing Analogy

Consider how a modern global archive indexes multi-lingual literature.

### Raw Text to Book Spines

```text
Raw Text (The Spoken Word):
  "The internationalization of software systems."

Sub-Word Tokenizer (The Archivist):
  Breaks words into common root stems and affixes:
  ["The", " international", "ization", " of", " software", " systems", "."]
  - Every subunit has an integer catalog ID in the Master Register (Vocabulary).
  Catalog IDs: [464, 4210, 1984, 286, 4390, 2901, 13]

Embedding Table (The Library Hall Map):
  Takes each Catalog ID and looks up its spatial coordinates (e.g. 4096 dimensions).
  - "software" lands near "computer", "code", and "hardware".

Positional Encoding (The Page Number Stamp):
  Because Transformers process all words at once in parallel, they have no concept
  of time or order without explicit page numbers.
  - Injects: "The" = Position 0, "international" = Position 1, etc.
```

---

## 3. The Mechanism: Sub-Words, Embedding Tables, and Positional Coordinates

The entry pipeline to every Transformer architecture consists of three deterministic mathematical stages.

### 1. Byte-Pair Encoding (BPE) Algorithm

BPE is an iterative data-compression algorithm adapted for NLP:
1. **Initialize Vocabulary**: Start with all unique basic characters (or raw bytes).
2. **Frequency Count**: Count how frequently adjacent character pairs appear together in a large training corpus.
3. **Merge**: Identify the most frequent pair (e.g. `"e"` + `"r"` $\rightarrow$ `"er"`) and add the merged unit to the vocabulary.
4. **Repeat**: Continue merging the most frequent pairs until the vocabulary reaches a predetermined size $V$ (e.g. 100,000 tokens in modern Llama and OpenAI models).

### 2. Token Embeddings: The Lookup Matrix

Once text is tokenized into a list of integer IDs $[t_1, t_2, \dots, t_L]$, it is passed through an **Embedding Matrix** $W_E \in \mathbb{R}^{V \times d_{\text{model}}}$, where $V$ is the vocabulary size and $d_{\text{model}}$ is the hidden dimension (e.g. $4096$).
- Mechanically, embedding lookup is a row selection: token ID $42$ pulls row $42$ from $W_E$.
- Mathematically, it is equivalent to multiplying a one-hot vector $\mathbf{e}_{42} \in \mathbb{R}^{1 \times V}$ by $W_E$:

$$\mathbf{x}_i = \mathbf{e}_{t_i} W_E \in \mathbb{R}^{1 \times d_{\text{model}}}$$

These embedding weights are learned end-to-end via backpropagation during pretraining.

### 3. Positional Encoding: Restoring Order to Parallel Attention

Unlike RNNs, the Self-Attention mechanism (covered in Lesson 2) computes all token-to-token interactions in parallel matrix multiplications. Self-attention is **permutation-equivariant**:
$$\text{Attention}(P \cdot X) = P \cdot \text{Attention}(X)$$
If you shuffle the input words randomly, the output vectors are identical except shuffled in the same order! To distinguish *"Dog bites man"* from *"Man bites dog"*, positional information must be injected into each token's embedding vector.

#### Sinusoidal Positional Encoding (Original Transformer)
The original 2017 paper *"Attention Is All You Need"* added fixed sinusoidal waves of varying frequencies directly to the input embeddings:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i / d_{\text{model}}}}\right), \quad PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i / d_{\text{model}}}}\right)$$

Where $pos$ is token position index and $i$ is feature dimension index. Lower dimensions oscillate rapidly like high-frequency clock ticks; higher dimensions oscillate slowly, allowing the model to learn relative position offsets via linear trigonometric transformations.

#### Modern Standard: Rotary Position Embedding (RoPE)
Modern frontier models (Llama 3, Mistral, DeepSeek, Gemma) do not use absolute additive positional encodings. Instead, they use **RoPE (Rotary Position Embedding)**:
- Rather than adding vectors to inputs, RoPE rotates the Query ($Q$) and Key ($K$) vectors in 2D coordinate planes by an angle proportional to their sequence position.
- When computing the attention dot product $Q_m \cdot K_n$, the dot product depends **strictly on the relative distance $m - n$ between the two tokens**, enabling superior length generalization to 32k–1M+ token contexts.

---

## 4. Diagram: The Tokenization to Positional Embedding Pipeline

```text
Input Text String:
  "AI systems learn"
          │
          ▼
Sub-Word Tokenizer:
  Tokens:       ['AI', ' systems', ' learn']
  Token IDs:    [15320,     4312,      2940]  (Shape: [3])
          │
          ▼
Embedding Table Lookup (W_E):
  Token 15320 ──► [ 0.24, -1.05,  0.82, ..., 0.12 ] (Shape: [1, d_model])
  Token  4312 ──► [ 0.91,  0.42, -0.63, ..., 0.54 ] (Shape: [1, d_model])
  Token  2940 ──► [-0.15,  0.88,  0.11, ..., 0.76 ] (Shape: [1, d_model])
          │
          ▼
Positional Encoding (PE):
  Position 0  ──► [ 0.00,  1.00,  0.00, ..., 1.00 ] (Shape: [1, d_model])
  Position 1  ──► [ 0.84,  0.54,  0.01, ..., 0.99 ] (Shape: [1, d_model])
  Position 2  ──► [ 0.91, -0.42,  0.02, ..., 0.98 ] (Shape: [1, d_model])
          │
          ▼
Element-Wise Addition (Input Representation to Transformer Layers):
  Final Vector = Embedding(Token) + PositionalEncoding(Position)
  Shape: (Batch_Size, Sequence_Length, d_model)
```

---

## 5. Code Walkthrough: Implementing BPE Tokenization and Embeddings in PyTorch

Here is an end-to-end Python and PyTorch implementation demonstrating sub-word tokenization and positional encoding from first principles:

```python
import torch
import torch.nn as nn
import math

# 1. Toy Byte-Pair Encoding (BPE) Merger
class SimpleBPETokenizer:
    def __init__(self):
        # Initial character vocabulary
        self.vocab = {"<PAD>": 0, "<UNK>": 1, "h": 2, "e": 3, "l": 4, "o": 5, "w": 6, "r": 7, "d": 8}
        self.merges = {}

    def learn_merge(self, pair: tuple, new_token: str):
        new_id = len(self.vocab)
        self.vocab[new_token] = new_id
        self.merges[pair] = new_token

    def tokenize(self, text: str) -> list[int]:
        # Split into characters
        tokens = list(text)
        # Apply learned merges iteratively
        for pair, merged in self.merges.items():
            i = 0
            new_tokens = []
            while i < len(tokens):
                if i < len(tokens) - 1 and (tokens[i], tokens[i+1]) == pair:
                    new_tokens.append(merged)
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            tokens = new_tokens
        
        # Convert string tokens to vocabulary integer IDs
        return [self.vocab.get(t, self.vocab["<UNK>"]) for t in tokens]

# Demonstrate BPE training merge
tokenizer = SimpleBPETokenizer()
tokenizer.learn_merge(("l", "l"), "ll")
tokenizer.learn_merge(("h", "e"), "he")
tokenizer.learn_merge(("he", "ll"), "hell")
tokenizer.learn_merge(("hell", "o"), "hello")

token_ids = tokenizer.tokenize("hello world")
print(f"BPE Token IDs for 'hello world': {token_ids}\n")

# 2. PyTorch Sinusoidal Positional Encoding Module
class SinusoidalPositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        # Create matrix of shape (max_len, d_model)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))

        # Apply sin to even indices; cos to odd indices
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        
        # Register as persistent buffer (part of model state, but not a trainable weight)
        self.register_buffer("pe", pe.unsqueeze(0))  # Shape: (1, max_len, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, seq_len, d_model)
        seq_len = x.size(1)
        # Add positional encoding up to current sequence length
        return x + self.pe[:, :seq_len, :]

# 3. Complete Transformer Input Embedding Layer
class TransformerEmbedding(nn.Module):
    def __init__(self, vocab_size: int, d_model: int, max_len: int = 512):
        super().__init__()
        self.token_embeddings = nn.Embedding(vocab_size, d_model)
        self.position_embeddings = SinusoidalPositionalEncoding(d_model, max_len)
        self.layer_norm = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(p=0.1)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        # 1. Lookup dense token vectors: (batch, seq_len) --> (batch, seq_len, d_model)
        x = self.token_embeddings(input_ids)
        # 2. Inject positional encoding
        x = self.position_embeddings(x)
        # 3. Normalize and apply dropout
        x = self.layer_norm(x)
        return self.dropout(x)

# 4. Test the pipeline with a batch of tokenized sequences
d_model = 64
vocab_size = 1000
embedding_layer = TransformerEmbedding(vocab_size=vocab_size, d_model=d_model)

# Batch of 2 sentences, each 5 tokens long
batch_input_ids = torch.tensor([
    [101, 2054, 2003, 1037, 102],
    [101, 7592, 1010, 2088, 102]
])

embedded_output = embedding_layer(batch_input_ids)
print(f"Batch Input IDs Shape:  {batch_input_ids.shape}")
print(f"Embedded Output Shape:  {embedded_output.shape} (Ready for Self-Attention!)")
```

---

## 6. Comparing Positional Encoding Strategies: Absolute vs Relative vs RoPE

### Positional Strategy Comparison

| Strategy | Representative Models | How It Works | Extrapolation to Longer Contexts | Dominant Advantage |
|---|---|---|---|---|
| **Absolute Learned** | Original GPT, BERT | Learnable weight matrix $W_{\text{pos}} \in \mathbb{R}^{L_{\max} \times d}$; added to token embeddings. | Fails completely beyond max pretraining length $L_{\max}$. | Simple implementation; learns domain-specific positional priors. |
| **Absolute Sinusoidal** | Original 2017 Transformer | Fixed mathematical sine/cosine waves added to input. | Poor (fails beyond trained context window). | Zero trainable parameters; handles arbitrary length in theory. |
| **Relative (T5, ALiBi)** | T5, Bloom, MPT | Modifies attention matrix directly ($QK^T + \text{bias}(m-n)$). | Good (ALiBi extrapolates to $2\times$ length). | Directly models distance between tokens rather than absolute index. |
| **RoPE (Rotary)** | **Llama 3, Claude, Mistral, DeepSeek** | Rotates $Q$ and $K$ vectors in 2D complex planes by angle $\theta \cdot pos$. | **State-of-the-Art** (via YaRN / RoPE scaling up to 1M+ tokens). | **Universal standard**: naturally decays with distance; seamless KV-caching compatibility. |

---

## 7. Common Mistakes

- **Assuming 1 token equals 1 word.** In English, 1 token is roughly $0.75$ words (or $\approx 4$ characters). In other languages (German, Chinese, Hindi) or in source code with indentation, a single word can split into 3–6 tokens, quadrupling context window consumption.
- **Forgetting that whitespace is part of the token.** In modern BPE tokenizers (`tiktoken`), `" Apple"` (with leading space) and `"Apple"` (without space) are **two completely distinct token IDs**. Always be careful with stripping whitespace when building few-shot prompts.
- **Exceeding the maximum sequence length with learned positional embeddings.** If a model uses learned absolute positional encodings initialized with `max_len=2048`, passing a 2049-token sequence triggers an `IndexError` crash because row 2049 does not exist in the embedding table.
- **Not masking padding tokens.** When batching sequences of varying lengths using `<PAD>` tokens, you must pass an attention mask to downstream Transformer layers so the model does not attend to meaningless padding vectors.

---

## 8. Hands-On Exercises

**Exercise 1:** Using the `tiktoken` Python library, tokenize the sentence `"The quick brown fox jumps over the lazy dog."` and the code snippet `def add(a: int, b: int) -> int: return a + b`. Inspect and print the token IDs and string pieces.

**Exercise 2:** Plot the Sinusoidal Positional Encoding matrix as a 2D heatmap using Matplotlib for $d_{\text{model}} = 128$ and sequence length $L = 100$. Observe the high-frequency left columns versus the smooth right columns.

**Exercise 3:** Implement RoPE (Rotary Position Embedding) for a 2D Query vector $\mathbf{q} = [q_0, q_1]$ at position $m$: multiply by the 2D rotation matrix $\begin{bmatrix} \cos(m\theta) & -\sin(m\theta) \\ \sin(m\theta) & \cos(m\theta) \end{bmatrix}$. Compute the dot product between rotated $Q_m$ and $K_n$, proving it equals $f(q, k, m-n)$.

**Exercise 4:** Test tokenizer sensitivity on arithmetic: tokenize `"12345 + 6789 = 19134"` across GPT-2, Llama-3, and Claude tokenizers, explaining why sub-word splitting makes multi-digit mental math difficult for LLMs.

**Exercise 5:** Build a PyTorch module that implements token padding and creates an attention mask: pad a list of variable-length integer lists to the length of the longest sentence with zeros, generating a binary boolean tensor mask (`mask = input_ids != 0`).

---

## 9. Interview Q&A

**Q: Why does Byte-Pair Encoding (BPE) use raw bytes as the base vocabulary in modern tokenizers like `tiktoken`?**
Early tokenizers initialized vocabularies with unique unicode characters. However, unicode contains over 140,000 characters across global languages, emojis, and symbols, creating a massive base vocabulary before merging even begins. Modern BPE tokenizers (like GPT-2/3/4 and Llama) operate directly on the 256 unique raw byte values ($0–255$). Because any text string in any language can be serialized into raw UTF-8 bytes, a byte-level vocabulary guarantees zero Out-of-Vocabulary (OOV) tokens, handles emojis, code, and foreign alphabets universally, and begins with a compact base vocabulary of only 256 items.

**Q: Why is Rotary Position Embedding (RoPE) superior to absolute positional embeddings for long-context LLMs?**
Absolute positional embeddings assign a fixed vector to each index (0, 1, 2, ...). The attention dot product $(Q + P_m)(K + P_n)^T$ contains cross-terms mixing content with absolute positions, making it difficult for the model to generalize when tested on sequence lengths longer than seen in training. RoPE applies a rotation to $Q$ and $K$ using complex numbers such that their inner product $\langle R_{\Theta, m}^d Q, R_{\Theta, n}^d K \rangle = \text{Re}(Q^* K e^{i(m-n)\theta})$ depends strictly on their **relative distance $m - n$**. This mathematical property preserves relative token relationships and allows linear interpolation (RoPE scaling, YaRN) to extend a model trained on 8k tokens to 128k+ tokens with minimal retraining.

**Q: What is the purpose of the embedding dimension scaling factor $\sqrt{d_{\text{model}}}$ in the original Transformer?**
In the original Transformer architecture, token embeddings are multiplied by $\sqrt{d_{\text{model}}}$ before adding positional encodings: $X = \sqrt{d_{\text{model}}} \cdot W_E(t) + PE(pos)$. Because learned token embeddings are initialized with small variance ($\sim 1/d_{\text{model}}$) to ensure stable initial training, their individual vector magnitudes are small compared to the fixed sinusoidal positional encoding values (which range between $-1$ and $+1$). Scaling token embeddings by $\sqrt{d_{\text{model}}}$ balances their relative magnitude, ensuring semantic token identity is not drowned out by the positional coordinates.

**Q: Why do LLMs frequently struggle with character-level tasks (like counting the number of 'r's in "strawberry")?**
LLMs do not see raw characters; they see discrete token IDs. To a tokenizer like `cl100k_base`, `"strawberry"` is parsed as two tokens: `["straw", "berry"]` (IDs `[496, 675]`). The model's embedding layer converts these token IDs directly into dense conceptual vectors. The internal Transformer layers never directly inspect individual letters; they only manipulate semantic vectors representing the concept of a strawberry. Asking an LLM to count letters forces it to reverse-engineer character decompositions from token embeddings, which frequently results in hallucinations.

**Q: What happens if two completely different words are assigned the exact same token embedding vector?**
If two words share identical embedding vectors, their representations entering the first Transformer layer are indistinguishable. The self-attention layers will compute identical query, key, and value vectors for both words in identical sentence contexts. Unless their positional encodings or surrounding neighbor tokens differ, the network will treat them as perfect synonyms. During training, backpropagation adjusts embedding rows independently based on prediction loss, ensuring that distinct words separate into distinct coordinates in the continuous vector space.
