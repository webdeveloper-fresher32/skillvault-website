# Phase 2: Data Models

## What You'll Learn

How the relational and document models store the same domain differently and what each choice costs, why key-value, wide-column, and graph models exist at all, and how the specialised time-series and vector models solve workloads a general engine handles badly.

## Learning Objectives

- Model one e-commerce domain as normalized tables and as embedded documents, and explain concretely where the duplicate data lives and what a change to it costs.
- Match key-value, wide-column, and graph models to the access patterns that motivate them, and distinguish wide-column from column-store.
- Explain why append-only time-series data and high-dimensional vector similarity break ordinary B-tree indexes, and what time partitioning and approximate nearest neighbour search do instead.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Relational-and-Document.md](01-Relational-and-Document.md) | normalization vs embedding; foreign keys and joins; pre-joined documents; where duplicate data lives; `users`/`orders`/`order_items` modelled both ways | 1 day |
| [02-Key-Value-Wide-Column-and-Graph.md](02-Key-Value-Wide-Column-and-Graph.md) | get/put as the whole API; partition and clustering keys; sparse wide rows vs column-stores; nodes, edges, and unknown-depth traversal | 1 day |
| [03-Time-Series-and-Vector.md](03-Time-Series-and-Vector.md) | append-only chunks, retention and downsampling; embeddings and distance metrics; exact vs approximate search; HNSW and IVF | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Relational Theory and Schema Design](../Phase-03-Relational-Theory-and-Schema-Design/README.md)
