# Phase 6: Memory Management

## What You'll Learn

Understand how an operating system manages the scarce, shared resource of physical RAM: how it allocates memory to competing processes, why that memory gets wasted (fragmentation), and the two classic techniques — paging and segmentation — that modern OS kernels use to solve it. This phase builds the foundation for Phase 7 (Virtual Memory), where paging is extended with demand paging and swapping.

## Learning Objectives

- Explain why memory management is necessary and what a memory manager must track
- Compare fixed and variable (dynamic) partitioning and their allocation strategies
- Distinguish internal vs external fragmentation, and explain compaction
- Describe paging: pages, frames, page tables, and translate a logical address to a physical address by hand
- Describe segmentation: segments, segment tables, and how segmentation and paging are combined in real systems (e.g., x86)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Memory-Management-Basics.md](01-Memory-Management-Basics.md) | Why memory management exists, contiguous allocation, fixed vs variable partitioning | 1 day |
| [02-Fragmentation.md](02-Fragmentation.md) | Internal vs external fragmentation, ASCII diagrams, compaction | 1 day |
| [03-Paging.md](03-Paging.md) | Pages, frames, page tables, address translation worked example | 1-2 days |
| [04-Segmentation.md](04-Segmentation.md) | Segments vs pages, segmentation with paging combined | 1 day |

## Estimated Time

4-5 days

## Prerequisites

Phase 2 (Processes and Threads) — you should know what a process's address space is before diving into how the OS physically maps it to RAM.

## Next Phase

→ [Phase 7: Virtual Memory](../Phase-07-Virtual-Memory/README.md)
