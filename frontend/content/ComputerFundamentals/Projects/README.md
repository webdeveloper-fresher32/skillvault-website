# Computer Fundamentals — Projects

## Overview

These hands-on projects turn the concepts from the 12 phases into working code. Reading about two's complement or bytecode VMs is useful; building a tool that computes them yourself is what makes the concept stick — and it gives you something concrete to talk through in an interview.

All projects are self-contained, single-file Python scripts using only the standard library. No installations, no external dependencies, no images or links required — copy the code into a `.py` file and run it with any Python 3.8+ interpreter.

## Project List

| # | Project | Level | Time Estimate | Related Phase(s) |
|---|---------|-------|----------------|-------------------|
| 01 | [Number System Converter and Visualizer](01-Number-System-Converter-and-Visualizer.md) | Beginner | 30–45 minutes | Phase 01 — Number Systems and Data Representation |
| 02 | [Simple Stack Machine Interpreter](02-Simple-Stack-Machine-Interpreter.md) | Intermediate | 45–60 minutes | Phase 08 — Bytecode and Virtual Machines |
| 03 | [Big-O Complexity Analyzer Exercises](03-Big-O-Complexity-Analyzer-Exercises.md) | Intermediate–Advanced | 45–60 minutes | Phase 10 — Big-O Notation, Phase 11 — Time and Space Complexity Analysis |

## How to Use These Projects

1. Work through them in order — Project 1 builds comfort with binary/hex/float representation, Project 2 shows how that representation is consumed by a tiny virtual machine, and Project 3 tests whether you can reason about complexity independently.
2. Type the code out rather than copy-pasting where you can — muscle memory helps recall under interview pressure.
3. After finishing each project, try to explain out loud (or to a rubber duck) what each function does and why, in the language of the underlying phase concept — not just "what the code does" but "what computer-science idea it demonstrates."
4. For Project 3, genuinely attempt to determine the complexity of each snippet *before* reading the answer — that's the whole point of the exercise.

## Prerequisites

- Python 3.8 or later installed (`python3 --version` to check)
- Comfort with basic Python syntax (functions, loops, classes)
- Phases 01, 08, 10, and 11 read beforehand for full context
