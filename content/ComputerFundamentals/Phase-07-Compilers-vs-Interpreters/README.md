# Phase 07: Compilers vs Interpreters

## Overview

Every line of code you write eventually becomes CPU instructions. This phase demystifies the journey from source code to execution — the pipeline every compiler follows, the spectrum from fully compiled to fully interpreted languages, and the hybrid JIT (Just-In-Time) approach that powers V8, the JVM, and modern Python implementations.

This is classic interview territory: "What happens when you run a Python script?", "Why is JavaScript fast despite being 'interpreted'?", "What's the difference between compiled and interpreted languages?" — this phase gives you precise, confident answers.

## Goals

By the end of this phase, you should be able to:
- Explain the four stages of a compilation pipeline (lexing, parsing, semantic analysis, code generation/optimization) and trace a simple expression through each stage.
- Compare compiled, interpreted, and hybrid (bytecode + JIT) languages using concrete trade-offs: startup time, execution speed, portability.
- Explain how JIT compilation works conceptually, using V8 (JavaScript) and PyPy (Python) as real examples, and articulate why JIT trades startup latency for peak throughput.

## Files

| File | Topic |
|------|-------|
| `01-The-Compilation-Pipeline.md` | Lexing, parsing, semantic analysis, code generation, optimization — with a worked example |
| `02-Compiled-vs-Interpreted-Languages.md` | Compiled vs interpreted vs hybrid languages, with trade-off comparison table |
| `03-Just-In-Time-JIT-Compilation.md` | How JIT compilation works, V8 and PyPy as examples, startup vs throughput trade-off |

## Prerequisites

None specific — basic familiarity with any programming language (Python, JavaScript, C, or Java) is enough. No compiler-construction background needed.

## Time Estimate

2-3 hours (reading + hands-on exercises).
