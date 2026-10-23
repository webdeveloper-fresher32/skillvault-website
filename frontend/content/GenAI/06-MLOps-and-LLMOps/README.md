# Phase 9: MLOps and LLMOps

> **Pillar 7 of 7: AI Ops** — MLflow, Model Registries, CI/CD Pipelines & Telemetry

## What You'll Learn

The production lifecycle, continuous integration, and operational observability required to run machine learning and LLM applications reliably at scale: experiment tracking with MLflow, model registries, Dockerized GPU containerization, cloud deployment, and real-time telemetry (latency, cost, tokens, and data drift).

## Learning Objectives

- Master experiment tracking (logging parameters, metrics, artifacts) and model registry promotion workflows (staging to production) with MLflow and Weights & Biases.
- Containerize AI applications and GPU runtime environments with Docker (NVIDIA Container Toolkit) and deploy to cloud environments (AWS ECS / EC2).
- Build production observability pipelines tracking Time-to-First-Token (TTFT), Inter-Token Latency (ITL), token accounting, per-tenant cost attribution, and silent failure detection.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Experiment-Tracking-and-Model-Registries.md](01-Experiment-Tracking-and-Model-Registries.md) | The MLOps lifecycle, experiment tracking with MLflow, and versioned model registries | 1 day |
| [02-Containerization-and-Cloud-Deployment.md](02-Containerization-and-Cloud-Deployment.md) | Dockerizing AI services, NVIDIA container toolkit, and cloud deployment pipelines | 1 day |
| [03-Production-Observability-Cost-and-Telemetry.md](03-Production-Observability-Cost-and-Telemetry.md) | TTFT/ITL latency, token accounting, per-user cost tracking, OpenTelemetry, and drift | 1 day |

## Estimated Time

3 days

## Next Module

→ [10: LLM Evaluation](../07-LLM-Evaluation/README.md)
