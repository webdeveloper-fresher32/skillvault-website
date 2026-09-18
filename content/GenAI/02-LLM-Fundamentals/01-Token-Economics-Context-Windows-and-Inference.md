# Token Economics, Context Windows, and Inference — Complete Guide

> "Tokens are the kilowatt-hours of the AI economy: every prompt consumes input energy, every generated word burns output wattage, and your server's context window is the physical battery that limits how much charge can be held at once."

---

## Table of Contents

1. [The Problem: Managing Cost, Latency, and Memory in Production AI](#1-the-problem-managing-cost-latency-and-memory-in-production-ai)
2. [The Electricity Grid Analogy](#2-the-electricity-grid-analogy)
3. [The Mechanism: Tokens, Context Limits, KV-Caching, and Sampling](#3-the-mechanism-tokens-context-limits-kv-caching-and-sampling)
4. [Diagram: The Autoregressive Inference Loop and KV-Cache](#4-diagram-the-autoregressive-inference-loop-and-kv-cache)
5. [Code Walkthrough: Simulating Token Sampling and KV-Cache Memory](#5-code-walkthrough-simulating-token-sampling-and-kv-cache-memory)
6. [Comparing Sampling Parameters: Temperature, Top-P, and Top-K](#6-comparing-sampling-parameters-temperature-top-p-and-top-k)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Managing Cost, Latency, and Memory in Production AI

In traditional web development, serving an API endpoint costs fractions of a cent:
- Reading a record from Redis or PostgreSQL takes $2\text{ms}$ of CPU time.
- Bandwidth is measured in kilobytes; pricing is negligible.
- A user submitting a 5,000-word essay incurs no measurable marginal cloud bill.

### The Realities of LLM APIs

When calling an LLM (such as GPT-4o, Claude 3.5 Sonnet, or a self-hosted Llama-3 cluster):
1. **Marginal Cost is Real**: Pricing is strictly metered per million tokens. A naive loop generating summaries across 10,000 documents can burn $500 in 15 minutes.
2. **Context Window Expiry**: Everything the model "knows" about the current session must fit inside the active context window. If the prompt exceeds the window, the request fails or past context is violently truncated.
3. **Asymmetric Pricing & Latency**: Input tokens are cheap and fast (processed in parallel); output tokens are $3\times–5\times$ more expensive and slow (generated sequentially, one token per forward pass).

### What Every AI Engineer Must Master

Engineering LLM systems requires rigorous resource budgeting: calculating token consumption, configuring decoding parameters (temperature, top-p) for reliability, and understanding how KV-caching dictates server memory.

---

## 2. The Electricity Grid Analogy

Consider managing energy consumption in an industrial data center.

### Fixed Capacity vs Metered Draw

```text
Fixed Battery Storage (Context Window):
  Battery capacity: 128,000 Watt-hours (128k Tokens).
  - Holds the input prompt, database RAG chunks, and conversation history.
  - Once full, you cannot add a single additional watt without dropping an older one.

Energy Draw (Token Economics):
  Input Charge (Reading Prompt):   $2.50 per 1M Watts. (Bulk parallel processing).
  Output Generation (Writing):     $10.00 per 1M Watts. (High-voltage sequential drain).
  Prompt Caching Discount:        Reusing cached prompt blocks gets a 90% discount!

Voltage Throttle (Sampling Parameters):
  Temperature = 0.0:  Steady, deterministic DC current. (Code, JSON extraction).
  Temperature = 1.0:  Fluctuating AC current. (Creative brainstorming).
```

---

## 3. The Mechanism: Tokens, Context Limits, KV-Caching, and Sampling

Large Language Models operate as autoregressive probability engines governed by key operational parameters.

### 1. Token Budgeting & Context Windows

- **Token**: The atomic text unit processed by LLMs ($\approx 4$ characters or $0.75$ words in English).
- **Context Window**: The maximum sequence length ($L_{\text{prompt}} + L_{\text{completion}}$) supported by the model architecture in a single call (e.g. 128k for GPT-4o and Llama 3.1, 200k for Claude 3.5 Sonnet, 1M–2M for Gemini 1.5).
- **Prompt Caching**: Modern providers (Anthropic, OpenAI, DeepSeek) cache the KV-cache of identical prompt prefixes. If a 20,000-token system prompt or documentation corpus is reused across requests, subsequent calls process that prefix with a $50\%–90\%$ discount in cost and up to $80\%$ lower Time-to-First-Token (TTFT) latency!

### 2. Autoregressive Inference: Prefill vs Decode

Serving an LLM consists of two distinct phases with opposite hardware profiles:
1. **Prefill Phase (Prompt Evaluation)**: The server ingests the entire input prompt $[x_1, x_2, \dots, x_N]$. Because all prompt tokens are known in advance, the model computes self-attention across all tokens in parallel using full GPU matrix multiplication tensor cores. It is **compute-bound**.
2. **Decode Phase (Token Generation)**: The model generates tokens one by one:
   $$x_{N+1} \sim P(x \mid x_{\le N}), \quad x_{N+2} \sim P(x \mid x_{\le N+1})$$
   Each new token requires reading all model weights from High-Bandwidth Memory (HBM) to compute just one token output. It is strictly **memory-bandwidth bound**.

### 3. KV-Caching: Why Memory Disappears Rapidly

To prevent recomputing past Keys and Values during decoding, the server stores past $K$ and $V$ tensors in GPU VRAM (the KV-cache). The memory consumption per active request is:

$$\text{Memory}_{\text{KV}} = 2 \times n_{\text{layers}} \times n_{\text{heads}} \times d_{\text{head}} \times \text{bytes\_per\_dtype} \times \text{seq\_len}$$

For a Llama-3-8B model in FP16 (2 bytes per number, 32 layers, 8 KV heads in GQA, dimension 128):
$$\text{Per Token Memory} = 2 \times 32 \times 8 \times 128 \times 2 = 131,072\text{ bytes} \approx 0.128\text{ MB per token}$$
A single request with a 32,000-token context requires **4.1 GB of GPU VRAM** just to hold its KV-cache! Serving 10 concurrent users at 32k context requires 41 GB of VRAM solely for memory buffers.

### 4. Decoding & Sampling Parameters

Before an LLM selects a token from its vocabulary $V$, it generates raw float scores (logits $z_i$). The sampling parameters modulate this distribution:
- **Temperature ($T$)**: Scaled logits: $z_i / T$.
  - $T \to 0$: Probability of the highest logit approaches 1.0 (greedy deterministic decoding). Essential for JSON extraction, SQL generation, and code.
  - $T \approx 0.7$: Balanced creativity and coherence (chat, general writing).
  - $T > 1.2$: Flat distribution; high diversity, but prone to grammatical degradation.
- **Top-P (Nucleus Sampling)**: Dynamically sorts tokens by probability and keeps the top subset whose cumulative sum $\sum P_i \ge P$ (e.g. 0.90), truncating the long tail of irrational words.
- **Top-K**: Restricts candidate pool to the top $K$ highest-probability tokens (e.g. $K=40$).
- **Frequency Penalty**: Penalizes tokens based on how many times they have already appeared in the output, preventing repetitive loops.
- **Presence Penalty**: Penalizes tokens if they have appeared at least once, encouraging the model to introduce fresh topics.
- **Stop Sequences**: String arrays (`["\n", "User:", "```"]`) that immediately halt generation when emitted by the model.

---

## 4. Diagram: The Autoregressive Inference Loop and KV-Cache

```text
PREFILL PHASE (Parallel across all prompt tokens):
  [ System Prompt + User Query ] (e.g., 500 tokens)
               │
               ▼
  [ Compute Attention in Parallel ] ──► Store K, V in VRAM (KV-Cache)
               │
               ▼
  Emit Token 1 (Time-to-First-Token / TTFT ~ 250ms)

DECODE PHASE (Serial, one token per forward pass):
  Token 1 ──► [ Query Projection ] 
                   │
                   ▼
  Attend against [ Cached Keys & Values in VRAM ] ──► Emit Token 2
                   │
                   ▼
  Append K2, V2 to KV-Cache
                   │
                   ▼
  Token 2 ──► Attend against [ Cached K & V ] ──► Emit Token 3 (Repeats until <STOP>)
```

---

## 5. Code Walkthrough: Simulating Token Sampling and KV-Cache Memory

Here is an end-to-end Python script implementing temperature, top-p, and top-k sampling, plus a production GPU VRAM calculator for LLM serving:

```python
import numpy as np

# 1. Advanced Token Sampler Implementing Temperature, Top-P, and Top-K
def sample_token(
    logits: np.ndarray, 
    temperature: float = 1.0, 
    top_p: float = 0.9, 
    top_k: int = 50
) -> int:
    # Handle greedy deterministic decoding
    if temperature <= 1e-5:
        return int(np.argmax(logits))
    
    # 1. Apply Temperature Scaling
    scaled_logits = logits / temperature
    
    # 2. Convert to probabilities via Softmax (with numerical stability)
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits))
    probs = exp_logits / np.sum(exp_logits)
    
    # 3. Apply Top-K Truncation
    if top_k > 0 and top_k < len(probs):
        top_k_indices = np.argsort(probs)[-top_k:]
        # Zero out all probabilities outside top-k
        mask = np.ones_like(probs, dtype=bool)
        mask[top_k_indices] = False
        probs[mask] = 0.0
        probs = probs / np.sum(probs)  # Renormalize
        
    # 4. Apply Top-P (Nucleus) Truncation
    if top_p < 1.0:
        sorted_indices = np.argsort(probs)[::-1]
        sorted_probs = probs[sorted_indices]
        cumulative_probs = np.cumsum(sorted_probs)
        
        # Remove tokens exceeding cumulative probability top_p
        sorted_indices_to_remove = cumulative_probs > top_p
        # Shift mask right by 1 to keep the first token exceeding threshold
        sorted_indices_to_remove[1:] = sorted_indices_to_remove[:-1].copy()
        sorted_indices_to_remove[0] = False
        
        indices_to_remove = sorted_indices[sorted_indices_to_remove]
        probs[indices_to_remove] = 0.0
        probs = probs / np.sum(probs)  # Renormalize
        
    # 5. Sample token index from final categorical distribution
    return int(np.random.choice(len(probs), p=probs))

# Test Sampler across temperatures
np.random.seed(42)
vocab = ["apple", "banana", "cat", "dog", "elephant", "frog"]
mock_logits = np.array([5.0, 4.2, 1.0, 0.8, -1.0, -3.0])

print("--- Token Sampling Probabilities ---")
for temp in [0.1, 0.7, 1.5]:
    sampled_counts = {word: 0 for word in vocab}
    for _ in range(1000):
        idx = sample_token(mock_logits, temperature=temp, top_p=0.9, top_k=5)
        sampled_counts[vocab[idx]] += 1
    print(f"Temp {temp:.1f} Distribution: {sampled_counts}")

# 2. Production KV-Cache Memory Calculator
def calculate_llm_vram(
    param_billions: float, 
    precision_bytes: int,  # 2 for FP16/BF16, 1 for INT8, 0.5 for INT4
    num_layers: int, 
    num_kv_heads: int, 
    head_dim: int, 
    context_length: int, 
    concurrent_requests: int
) -> dict:
    # Model Weights Memory
    weights_gb = (param_billions * 1e9 * precision_bytes) / (1024**3)
    
    # KV Cache Memory per Token = 2 (K and V) * layers * kv_heads * head_dim * precision
    kv_per_token_bytes = 2 * num_layers * num_kv_heads * head_dim * 2  # KV cache kept in FP16
    
    # Total KV Cache Memory across all concurrent streams
    total_kv_gb = (kv_per_token_bytes * context_length * concurrent_requests) / (1024**3)
    
    # CUDA Context and Runtime Overhead (~1.5 GB)
    cuda_overhead_gb = 1.5
    
    total_vram_gb = weights_gb + total_kv_gb + cuda_overhead_gb
    return {
        "Weights (GB)": round(weights_gb, 2),
        "KV-Cache (GB)": round(total_kv_gb, 2),
        "Total VRAM Required (GB)": round(total_vram_gb, 2)
    }

# Example: Llama-3-8B (GQA: 8 KV heads, 32 layers, head_dim 128)
vram_stats = calculate_llm_vram(
    param_billions=8.0,
    precision_bytes=2,  # FP16 weights
    num_layers=32,
    num_kv_heads=8,
    head_dim=128,
    context_length=8192,
    concurrent_requests=10
)

print(f"\n--- Llama-3-8B VRAM Footprint (10 concurrent users at 8k context) ---")
for k, v in vram_stats.items():
    print(f"  {k}: {v} GB")
```

---

## 6. Comparing Sampling Parameters: Temperature, Top-P, and Top-K

### Decoding Parameters Matrix

| Parameter | Recommended Value | Mechanical Effect | Best Production Use Case |
|---|---|---|---|
| **Temperature = 0.0** | `0.0` | Forces strictly greedy `argmax` selection. Perfectly deterministic. | JSON parsing, code writing, SQL queries, data extraction. |
| **Temperature = 0.7** | `0.7` | Moderately flattens logits; enables diverse vocabulary selection. | General conversational chatbots, customer support, document rewriting. |
| **Temperature = 1.2+** | `1.2 - 1.5` | Heavily flattens logits; high randomness and divergence. | Creative fiction, divergent brainstorming, poetry. |
| **Top-P = 0.90** | `0.85 - 0.95` | Cuts off the long tail of irrational words dynamically based on confidence. | **Universal production standard** paired with Temperature. |
| **Top-K = 40** | `20 - 50` | Hard cutoff: never considers any word ranked below rank $K$. | Preventing catastrophic hallucinations in local open-weights models. |
| **Frequency Penalty** | `0.2 - 0.5` | Scales down logits of words based on count in generated text. | Stopping repetitive loops (e.g. models repeating `"and and and"`). |
| **Presence Penalty** | `0.1 - 0.4` | Scales down logits of words if they appeared at least once. | Encouraging models to cover novel topics and explore diverse terminology. |

---

## 7. Common Mistakes

- **Setting `temperature > 0` for structured JSON output.** When extracting schemas or generating API arguments, non-zero temperature causes occasional syntax errors (`"age": "twenty"` instead of `"age": 20` or invalid comma placement). Always use `temperature = 0.0`.
- **Ignoring asymmetric input vs output token pricing.** In commercial APIs, generating output tokens is $3\times–4\times$ more expensive than reading input tokens. Asking an LLM to write a verbose 2,000-word response when a 50-word summary was needed quadruples cost and increases latency by $10\times$.
- **Not setting `max_tokens` defensively.** If a user submits a prompt that causes the model to enter an infinite loop or generate unending text, an unbounded API call will run until reaching context limits, burning through token budgets. Always enforce a reasonable `max_tokens` bound.
- **Neglecting Prompt Caching architecture.** Arranging prompts with dynamic user information placed *before* the static system prompt invalidates the cache on every request! Place static instructions and documentation at the **very top** of the prompt so the KV-cache prefix remains identical and cache-hits are maximized.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a token cost estimator in Python: given input token count, output token count, and pricing rates ($/1M tokens), calculate the cost of running 50,000 requests per day across GPT-4o, Claude 3.5 Sonnet, and Llama 3.1 8B.

**Exercise 2:** Experiment with Stop Sequences: call an LLM API asking it to count from 1 to 20, but supply `stop=["10"]`. Verify that generation halts immediately when the token `10` is emitted.

**Exercise 3:** Implement an automated prompt truncation guard: write a function `truncate_chat_history(messages, max_tokens, tokenizer)` that calculates token counts and discards the oldest user-assistant message pairs while strictly preserving the system prompt.

**Exercise 4:** Demonstrate repetition loops: prompt a small local open model with low frequency penalty on a repetitive phrase, then increase `frequency_penalty=1.0` and observe how the model switches to alternative synonyms.

**Exercise 5:** Calculate the Time-to-First-Token (TTFT) and Tokens-per-Second (TPS) for an API call using Python's `time.perf_counter()` and an asynchronous streaming client.

---

## 9. Interview Q&A

**Q: Why is generating output tokens significantly slower and more expensive than processing input prompt tokens?**
1. **Parallelism**: Processing input tokens (prefill) is executed in a single forward pass where all tokens are computed simultaneously across GPU tensor cores using compute-bound matrix multiplications ($QK^TV$). 
2. **Sequential Dependency**: Generating output tokens (decode) is strictly sequential: generating token $t+1$ requires the output of token $t$. Each single token requires loading the entire model's weights (e.g. 14 GB for an 8B model) from GPU VRAM into on-chip cache to generate just one single token, making decoding memory-bandwidth bound. The GPU spends most of its time waiting for memory transfers, yielding lower hardware efficiency and higher operational cost.

**Q: How does Prompt Caching work in modern LLM APIs, and how should prompts be structured to maximize cache hits?**
Prompt caching saves the computed KV-cache of prompt prefixes in memory. When a new request arrives, the server checks if the initial tokens match a cached prefix; if so, it skips the prefill compute phase, reading the KV-cache directly. This reduces latency by up to $80\%$ and costs by $50\%–90\%$. To maximize cache hits, prompts must be structured hierarchically:
- **Place static content first**: System prompts, tool schemas, and reference documentation should be placed at the beginning of the prompt.
- **Place dynamic content last**: User queries, timestamps, and session-specific inputs should be appended at the very end, ensuring the long prefix remains bit-for-bit identical across requests.

**Q: What is the difference between Top-P and Top-K sampling, and why is Top-P generally preferred?**
- **Top-K**: Truncates the candidate pool to a static number $K$ (e.g. 50). The limitation is that in scenarios where one token is overwhelmingly likely ($P=0.98$), Top-K still samples across 50 tokens, allowing nonsensical words to slip through. In scenarios where 200 tokens are plausible, Top-K cuts off viable options too early.
- **Top-P (Nucleus)**: Dynamically sizes the candidate pool based on cumulative probability mass. When the model is confident, the nucleus shrinks to 1–2 tokens; when the model is uncertain, the nucleus expands to include dozens of tokens. It adapts dynamically to the model's confidence distribution.

**Q: What causes an LLM to enter an infinite repetition loop, and how can backend systems defend against it?**
Autoregressive models condition on their own past outputs. If a phrase is emitted, its tokens enter the context window. In the next step, self-attention attends to those tokens, increasing their likelihood of being selected again. Once a pattern repeats twice, the probability of continuing the loop approaches 1.0. 
Defenses:
1. **Frequency Penalty**: Penalizes logits proportionally to their frequency count in past output.
2. **Repetition Detection**: Stream monitoring on the backend that inspects rolling 4-gram or sentence hashes, terminating the stream if identical text is generated consecutively.
3. **Stop Sequences**: Adding explicit stop tokens.

**Q: What is the "Lost in the Middle" phenomenon in large context windows?**
Research demonstrates that despite models supporting 128k–1M+ token context windows, information retrieval and reasoning accuracy are not uniform across the window. Models exhibit high recall for information placed at the very beginning of the prompt (primacy effect) and at the very end of the prompt (recency effect), but performance drops significantly when critical facts are buried in the middle $40\%–70\%$ of a long context. In RAG applications, the most relevant retrieved chunks should be placed either at the very beginning or directly before the final user prompt.
