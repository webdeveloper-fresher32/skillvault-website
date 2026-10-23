# High-Throughput Serving with vLLM — Complete Guide

> "Naive model serving is like a restaurant kitchen that refuses to seat new diners until an entire table finishes eating and leaves; vLLM is an agile conveyor-belt diner that seats a new guest the exact second an empty chair opens up, while storing coats in dynamic locker cubbies instead of reserving an entire empty room per person."

---

## Table of Contents

1. [The Problem: The Low Throughput of Naive Hugging Face Serving](#1-the-problem-the-low-throughput-of-naive-hugging-face-serving)
2. [The Agile Conveyor-Belt Diner Analogy](#2-the-agile-conveyor-belt-diner-analogy)
3. [The Mechanism: PagedAttention, Continuous Batching, and Tensor Parallelism](#3-the-mechanism-pagedattention-continuous-batching-and-tensor-parallelism)
4. [Diagram: PagedAttention Virtual Memory Allocation](#4-diagram-pagedattention-virtual-memory-allocation)
5. [Code Walkthrough: Deploying and Querying vLLM in Production](#5-code-walkthrough-deploying-and-querying-vllm-in-production)
6. [Comparing Serving Engines: Hugging Face vs TGI vs vLLM vs TensorRT-LLM](#6-comparing-serving-engines-hugging-face-vs-tgi-vs-vllm-vs-tensorrt-llm)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Low Throughput of Naive Hugging Face Serving

When an engineering team builds their first local LLM prototype, they typically write:
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B")
outputs = model.generate(inputs)
```

Wrapping this code in a simple FastAPI endpoint works for a single user, but collapses disastrously in production:
1. **Severe Memory Fragmentation**: Standard PyTorch requires allocating contiguous GPU VRAM for each request's KV-cache. Because sequence lengths are unpredictable, the server pre-allocates buffers for `max_context_len` (e.g. 8k tokens). Up to **60%–80% of expensive GPU VRAM** is wasted on empty, unused buffer space!
2. **Static Batching Bottleneck**: If Request A generates 20 tokens and Request B generates 800 tokens, the GPU sit idly on Request A's batch slot for 780 iterations, wasting compute while new requests wait in an external queue.
3. **Low Throughput**: An NVIDIA A100 GPU costing \$2.50/hour yields only 15–20 tokens/second overall throughput, making self-hosting financially unviable.

### What vLLM Solves

**vLLM** is an open-source high-throughput LLM serving engine developed at UC Berkeley. By introducing **PagedAttention** (virtual memory paging for KV-caches) and **Continuous Batching**, vLLM increases serving throughput by **$10\times$ to $24\times$** compared to naive Hugging Face pipelines, transforming self-hosted open models into cost-effective production infrastructure.

---

## 2. The Agile Conveyor-Belt Diner Analogy

Consider the difference between traditional restaurant seating and an optimized high-throughput diner.

### Static Reservation vs Paged Dynamic Allocation

```text
Naive Serving (Traditional Rigid Banquet):
  Table seats 8 people. If 2 friends arrive, they reserve the entire 8-person table.
  - The remaining 6 seats sit empty for 2 hours (Internal Memory Fragmentation).
  - No new customers are allowed in until the entire party pays and leaves (Static Batching).

vLLM (The Agile Conveyor-Belt Diner):
  - Dynamic Locker Cubbies (PagedAttention):
    Instead of reserving a whole room for your coat, you are assigned 16-slot cubbies
    across the building as you need them. No wasted space.
  - Continuous Seating (Iteration-Level Scheduling):
    As soon as Customer A finishes their coffee at iteration 20, they leave, and
    Customer C sitting in the waiting line is seated in that exact stool on the next step!
  - Result: 100% stool saturation; zero idle cooking capacity.
```

---

## 3. The Mechanism: PagedAttention, Continuous Batching, and Tensor Parallelism

vLLM achieves its extraordinary efficiency through three core architectural breakthroughs.

### 1. PagedAttention: Operating System Virtual Memory for GPUs

In operating systems, virtual memory divides physical RAM into non-contiguous pages mapped via a page table, eliminating physical memory fragmentation.

**PagedAttention** applies this exact concept to the Transformer KV-cache:
- Partitions each sequence's KV-cache into fixed-size virtual blocks (e.g. 16 tokens per block).
- As an LLM generates tokens, physical GPU VRAM blocks are allocated on demand from a centralized memory pool.
- Physical blocks do **not** need to be contiguous in GPU memory; PagedAttention custom CUDA kernels read keys and values from scattered memory addresses in parallel.
- **Result**: Memory waste drops from $70\%$ down to under $4\%$, allowing 4x–8x more concurrent requests to fit into the exact same GPU!

### 2. Continuous Batching (Iteration-Level Scheduling)

Traditional batching (Static Batching) operates at the request level: it bundles $N$ requests and steps them until all requests hit `<stop>`.

**Continuous Batching** operates at the **iteration level**:
- After every single forward step (one token generated per active request), the scheduler inspects the batch.
- Finished requests are immediately evicted, and their KV-cache blocks are returned to the pool.
- New requests waiting in the queue are immediately injected into the vacant slots on the very next token iteration.
- GPU tensor cores remain consistently saturated at near 100% capacity.

### 3. Tensor Parallelism: Multi-GPU Model Sharding

Large foundation models cannot fit onto a single GPU (e.g. a 70B parameter model in FP16 requires 140 GB of VRAM; an A100 GPU has 80 GB).

**Tensor Parallelism (TP)** splits individual weight matrices across multiple GPUs (e.g. 2, 4, or 8 GPUs in an NVLink cluster):
- $Q, K, V$ linear projections are sliced along columns across GPUs.
- Attention outputs are sliced along rows, combined with a high-speed GPU `all-reduce` communication collective.
- vLLM natively supports tensor parallelism with a simple flag: `--tensor-parallel-size 4`.

---

## 4. Diagram: PagedAttention Virtual Memory Allocation

```text
LOGICAL KV-CACHE (Sequential Token Order):
  Logical Block 0:  [ Token 0  ... Token 15 ]
  Logical Block 1:  [ Token 16 ... Token 31 ]
  Logical Block 2:  [ Token 32 ... Token 47 ]
                           │
                           ▼
  BLOCK TABLE (Virtual to Physical Translation):
    Logical Block 0  ──►  Physical VRAM Block #104
    Logical Block 1  ──►  Physical VRAM Block #12
    Logical Block 2  ──►  Physical VRAM Block #89
                           │
                           ▼
PHYSICAL GPU VRAM (Scattered, Non-Contiguous Pages):
  [ Block #12 ] ... [ Block #89 ] ... [ Block #104 ] ... [ Free Blocks ]
  (Zero external fragmentation; memory allocated dynamically as tokens generate!)
```

---

## 5. Code Walkthrough: Deploying and Querying vLLM in Production

Here is how to launch a production vLLM instance and query it using the standard OpenAI client SDK:

### 1. Launching the vLLM OpenAI-Compatible Server via Shell / Docker

```bash
# Production vLLM startup command for Llama-3.1-8B on an NVIDIA GPU
python3 -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-3.1-8B-Instruct \
    --tensor-parallel-size 1 \
    --dtype bfloat16 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --max-num-seqs 256 \
    --enable-prefix-caching \
    --host 0.0.0.0 \
    --port 8000
```

### 2. Python Production Client Querying vLLM

```python
import asyncio
import time
from openai import AsyncOpenAI

# Point client to the local or cloud vLLM endpoint
vllm_client = AsyncOpenAI(
    base_url="http://localhost:8000/v1",
    api_key="EMPTY"  # vLLM requires no auth locally
)

MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct"

async def test_single_stream(prompt: str):
    start_time = time.perf_counter()
    first_token_time = None
    token_count = 0
    
    print(f"--- Dispatching Request: '{prompt}' ---")
    
    response = await vllm_client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are a high-performance backend assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.0,
        max_tokens=150,
        stream=True
    )
    
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            if first_token_time is None:
                first_token_time = time.perf_counter() - start_time
            print(delta.content, end="", flush=True)
            token_count += 1
            
    total_time = time.perf_counter() - start_time
    print(f"\n\n[METRICS]")
    print(f"  Time-to-First-Token (TTFT): {first_token_time:.4f}s")
    print(f"  Total Duration:             {total_time:.4f}s")
    print(f"  Generation Throughput:      {token_count / (total_time - first_token_time):.1f} tokens/sec")

async def test_concurrent_batch():
    """Demonstrates Continuous Batching: 5 concurrent requests executed simultaneously."""
    prompts = [
        "Explain Redis caching in 2 sentences.",
        "What is an ACID transaction in PostgreSQL?",
        "How does DNS resolution work step-by-step?",
        "Explain the CAP theorem in distributed systems.",
        "What is the difference between TCP and UDP?"
    ]
    
    print(f"\n=== Dispatching 5 Concurrent Requests to vLLM ===")
    start = time.perf_counter()
    await asyncio.gather(*(test_single_stream(p) for p in prompts))
    total_time = time.perf_counter() - start
    print(f"\nAll 5 concurrent requests completed in {total_time:.2f} seconds.")

if __name__ == "__main__":
    print("vLLM production test suite ready for execution against running server.")
```

---

## 6. Comparing Serving Engines: Hugging Face vs TGI vs vLLM vs TensorRT-LLM

### Serving Engine Comparison Matrix

| Dimension | Native Hugging Face | TGI (Hugging Face) | vLLM (Berkeley) | TensorRT-LLM (NVIDIA) |
|---|---|---|---|---|
| **Paged KV-Caching** | No (contiguous memory) | Yes (PagedAttention) | **Yes (Pioneered PagedAttention)** | Yes |
| **Continuous Batching** | No (Static Batching) | Yes | **Yes (Highly Optimized Scheduler)** | Yes |
| **Throughput (Tokens/sec)** | Baseline ($1\times$) | $10\times–15\times$ | **$15\times–24\times$** | **$20\times–28\times$ (Maximum)** |
| **Setup & Complexity** | Minimal (pure Python) | Moderate (Docker container) | **Simple (Single pip install / CLI)** | Very High (requires compiling engines) |
| **Prefix Caching** | No | Yes | **Yes (`--enable-prefix-caching`)** | Yes |
| **Industry Recommendation** | Research prototyping only | Production deployments | **Primary Industry Standard for Open LLMs** | Extreme latency-sensitive production |

---

## 7. Common Mistakes

- **Setting `--gpu-memory-utilization` too high (e.g. 0.99).** Setting utilization to 0.99 leaves zero VRAM buffer for CUDA context memory or sudden activation spikes, causing the server to crash with out-of-memory errors during peak load. Keep it at `0.90`.
- **Mismatching Tensor Parallel size with GPU count.** Running `--tensor-parallel-size 4` on a server with only 2 GPUs or across GPUs that do not support high-speed NVLink interconnects creates severe communication bottlenecks.
- **Forgetting `--enable-prefix-caching` for RAG and multi-turn chat.** If your application repeatedly uses a common system prompt or shared document corpus, disabling prefix caching forces vLLM to recompute the entire prompt KV-cache on every request, wasting $50\%–80\%$ of GPU prefill compute.
- **Ignoring context length limits (`--max-model-len`).** By default, some models default to massive context windows (e.g. 131k tokens for Llama 3.1). vLLM will allocate internal memory structures based on this, leaving less VRAM for concurrent batching. If your application only needs 8k tokens, set `--max-model-len 8192` to drastically increase concurrent request capacity.

---

## 8. Hands-On Exercises

**Exercise 1:** Install vLLM in a GPU environment (`pip install vllm`), launch an offline inference script with `vllm.LLM`, and generate completions for 100 prompts simultaneously, measuring the total throughput in tokens/second.

**Exercise 2:** Configure Prefix Caching: launch vLLM with `--enable-prefix-caching`. Submit a 2,000-token prompt twice in a row, and verify that the TTFT of the second request is over $5\times$ faster than the first.

**Exercise 3:** Implement an automated health check monitor in Python: write a script that queries `GET http://localhost:8000/health` and logs GPU memory utilization metrics.

**Exercise 4:** Benchmark static batching versus continuous batching: write a Python test suite that measures the total wall-clock time required to complete 20 requests of mixed sequence lengths (5 short, 15 long).

**Exercise 5:** Run a multi-GPU Tensor Parallel deployment: launch a 70B parameter model using `--tensor-parallel-size 2` or `--tensor-parallel-size 4`, and verify that GPU VRAM consumption is balanced equally across GPUs using `nvidia-smi`.

---

## 9. Interview Q&A

**Q: What is PagedAttention, and how does it eliminate memory fragmentation in GPU VRAM?**
In standard Transformer inference, the KV-cache of every request must be stored in contiguous physical memory. Because request lengths cannot be predicted in advance, servers pre-allocate buffers matching the maximum possible sequence length. This leads to massive internal fragmentation (pre-allocated memory that is never used) and external fragmentation (memory scattered in chunks too small to allocate new requests). PagedAttention borrows the concept of virtual memory from operating systems: it divides the KV-cache into fixed-size blocks (e.g. 16 tokens) and maps virtual block indices to physical, non-contiguous VRAM pages via a page table. Memory is allocated on-demand in 16-token increments, reducing memory waste from $70\%$ to under $4\%$ and allowing $2\times–4\times$ more concurrent requests to fit in memory.

**Q: How does Continuous Batching differ from Static Batching in LLM serving?**
- **Static Batching**: Bundles $N$ requests together and runs them in a single batch. If Request A finishes in 10 tokens while Request B finishes in 500 tokens, Request A's batch slot sits idle for 490 forward passes, wasting GPU compute until the entire batch finishes.
- **Continuous Batching (Iteration-Level Scheduling)**: Evaluates the batch at every single iteration (token forward pass). The moment a request emits `<stop>`, its KV-cache blocks are freed, and a new request waiting in the queue is immediately injected into the active batch on the next token step. This keeps the GPU tensor cores continuously saturated at near 100% capacity.

**Q: What is Prefix Caching in vLLM, and why is it valuable for multi-turn chat and RAG?**
Prefix Caching stores the computed Key and Value matrices of prompt prefixes across requests. In multi-turn chat or RAG applications, many requests share identical initial tokens (the system prompt, few-shot examples, or retrieved context documents). When a new request arrives, vLLM checks its prefix tree (radix tree); if the prompt prefix matches cached blocks, it completely skips the prefill compute for those tokens, loading the cached KV-cache directly. This cuts Time-to-First-Token (TTFT) by up to $80\%$ and saves significant GPU compute.

**Q: What is Tensor Parallelism, and how does it divide matrix multiplications across GPUs?**
Tensor Parallelism splits individual weight matrices across multiple GPUs along specific dimensions using Megatron-LM style splitting:
- **Column-Parallel Linear Layer**: Splits the weight matrix $W$ by columns across GPUs ($W = [W_1 \mid W_2]$). Each GPU multiplies the full input vector $X$ by its weight slice ($XW_1, XW_2$).
- **Row-Parallel Linear Layer**: Splits the weight matrix by rows ($W = [W_1 / W_2]^T$). Each GPU multiplies its slice and combines results using an `All-Reduce` collective communication operation across NVLink.
This allows models that exceed the VRAM of a single GPU (e.g. 70B models requiring 140 GB) to be distributed and served seamlessly across multiple GPUs.

**Q: Why does memory bandwidth dominate compute during the LLM decoding phase?**
During the prefill phase, all prompt tokens are processed together: multiplying an $(L \times d)$ input matrix by a $(d \times d)$ weight matrix achieves a high **arithmetic intensity** (many FLOPs performed per byte of memory transferred from VRAM). During the autoregressive decoding phase, only **one single token** is generated per step. The model must load the entire weight matrix (e.g. 16 GB of weights for an 8B model) from High-Bandwidth Memory (HBM) into on-chip cache to execute just a single vector-matrix multiplication. Because the GPU's memory bus can only transfer data so fast (e.g. 2 TB/sec on an A100), the GPU spends most of its clock cycles waiting for memory transfers, making decoding memory-bandwidth bound.
