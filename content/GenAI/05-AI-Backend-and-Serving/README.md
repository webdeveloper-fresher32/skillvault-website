# Phase 8: AI Backend and Serving

> **Pillar 7 of 7: AI Ops** — Model Serving (vLLM), PagedAttention, Token Streaming & Quantization

## What You'll Learn

How to design, build, optimize, and operate production-grade model serving infrastructure: Server-Sent Events (SSE) token streaming, non-blocking asynchronous Python backends, high-throughput model serving with vLLM (PagedAttention and continuous batching), and model quantization (AWQ, GPTQ, GGUF).

## Learning Objectives

- Build production streaming endpoints in FastAPI and Node.js using Server-Sent Events (SSE) with non-blocking async concurrency and client disconnect handling.
- Master the vLLM serving engine: PagedAttention virtual memory, continuous iteration batching, tensor parallelism, and prefix caching.
- Master model quantization (FP16, BF16, INT8, INT4, AWQ, GGUF) and optimization runtimes (ONNX Runtime, TensorRT-LLM) to maximize tokens-per-second per dollar.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Token-Streaming-and-Async-Inference.md](01-Token-Streaming-and-Async-Inference.md) | SSE streaming architecture, non-blocking async backends, and handling client dropouts | 1.5 days |
| [02-High-Throughput-Serving-with-vLLM.md](02-High-Throughput-Serving-with-vLLM.md) | vLLM engine architecture, PagedAttention, continuous batching, and tensor parallelism | 1.5 days |
| [03-Model-Optimization-Quantization-and-Engines.md](03-Model-Optimization-Quantization-and-Engines.md) | Quantization precision (AWQ, GPTQ, GGUF), TensorRT, and hardware VRAM budgeting | 1 day |

## Estimated Time

4 days

## Next Module

→ [09: MLOps and LLMOps](../06-MLOps-and-LLMOps/README.md)
