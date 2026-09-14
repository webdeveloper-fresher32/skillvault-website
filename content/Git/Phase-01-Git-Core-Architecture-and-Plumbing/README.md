# Phase 1: Git Core Architecture and Plumbing

## What You'll Learn

Understand Git's internal engine from the ground up: content-addressable storage, immutable object models (blobs, trees, commits, annotated tags), the Three Trees architecture (Working Tree, Index/Staging Area, and HEAD repository), and underlying plumbing commands (`hash-object`, `cat-file`, `write-tree`, `commit-tree`, `update-ref`).

## Learning Objectives

- Explain Git's content-addressable database and cryptographic hashing mechanisms (SHA-1 / SHA-256).
- Inspect and deconstruct the internal structure of Git objects inside `.git/objects/`.
- Trace how changes move across the Three Trees: Working Directory, Index/Staging, and HEAD.
- Construct commits and branch references manually using raw Git plumbing commands.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Git-Object-Model-Blobs-Trees-Commits.md](01-Git-Object-Model-Blobs-Trees-Commits.md) | Content-addressable storage, blobs, trees, commits, tags, `.git` anatomy | 1 day |
| [02-The-Three-Trees-Working-Tree-Index-HEAD.md](02-The-Three-Trees-Working-Tree-Index-HEAD.md) | Working tree, staging area / index, HEAD, lifecycle transitions | 1 day |
| [03-Plumbing-vs-Porcelain-Commands.md](03-Plumbing-vs-Porcelain-Commands.md) | Low-level plumbing (`hash-object`, `cat-file`, `write-tree`) vs high-level porcelain | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: Staging, Committing, and Inspection](../Phase-02-Staging-Committing-and-Inspection/README.md)
