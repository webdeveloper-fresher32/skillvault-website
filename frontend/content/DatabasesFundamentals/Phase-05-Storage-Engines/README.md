# Phase 5: Storage Engines

## What You'll Learn

How a database physically lays bytes out on disk, how a B+ tree finds one row among billions in three or four reads, how an LSM tree trades that away to make writes sequential, and how a write-ahead log and buffer pool make the whole thing both fast and crash-safe.

## Learning Objectives

- Explain why the page is the unit of I/O, what a page physically contains, and why row-major and column-major layouts of the same table have opposite performance profiles.
- Derive a B+ tree's fanout and height from page size and key width, trace an insert split and a delete merge, and weigh that write path against an LSM tree's using read, write, and space amplification.
- Apply the write-ahead rule, buffer pool hit rate, checkpoints, and `fsync` to explain how a committed transaction survives a crash without any random page write on the commit path.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Pages-Heap-Files-and-Row-vs-Column.md](01-Pages-Heap-Files-and-Row-vs-Column.md) | pages and blocks as the unit of I/O; slotted page layout; heap files and `ctid`; row-store vs column-store; compression from columnar layout | 1 day |
| [02-B-Plus-Trees.md](02-B-Plus-Trees.md) | fanout arithmetic and tree height; internal nodes vs linked leaves; node splits and merges; why range scans and `ORDER BY` are free | 1 day |
| [03-LSM-Trees-and-SSTables.md](03-LSM-Trees-and-SSTables.md) | memtable and immutable SSTables; bloom filters and min/max footers; compaction; read, write, and space amplification; size-tiered vs levelled | 1 day |
| [04-Write-Ahead-Log-and-Buffer-Pool.md](04-Write-Ahead-Log-and-Buffer-Pool.md) | buffer pool, dirty pages, and hit rate; the write-ahead rule and redo recovery; checkpoints; `fsync` and the OS page cache; group commit | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 6: Indexing Theory](../Phase-06-Indexing-Theory/README.md)
