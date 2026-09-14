# Git Object Model (Blobs, Trees, Commits, and Tags) — Complete Guide

> "A museum vault stores every historical painting inside a tamper-proof vacuum crate stamped with a unique mathematical seal; crates are referenced in gallery catalogs (trees), and chronological exhibitions (commits) link each catalog back to the prior exhibition."

---

## Table of Contents

1. [The Problem: How Does Git Store Project History Efficiently?](#1-the-problem-how-does-git-store-project-history-efficiently)
2. [The Museum Vault and Exhibition Catalog Analogy](#2-the-museum-vault-and-exhibition-catalog-analogy)
3. [The Mechanism: Content-Addressable Storage and the 4 Object Types](#3-the-mechanism-content-addressable-storage-and-the-4-object-types)
4. [Diagram: The Git Object Dependency Graph](#4-diagram-the-git-object-dependency-graph)
5. [CLI Walkthrough: Inspecting Raw Git Objects with Plumbing Commands](#5-cli-walkthrough-inspecting-raw-git-objects-with-plumbing-commands)
6. [Comparing the 4 Git Object Types](#6-comparing-the-4-git-object-types)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: How Does Git Store Project History Efficiently?

Traditional version control systems (like SVN or CVS) stored file changes as deltas (diffs) against previous versions. Over time, computing file contents required replaying hundreds of sequential patches.

### The Delta-Based vs Snapshot Model

```text
Delta-Based VCS (SVN):
  File A (v1) ──▶ +diff1 (v2) ──▶ +diff2 (v3) ──▶ +diff3 (v4)
  Reconstructing v4 requires sequentially applying every delta!

Git Snapshot Model:
  Commit 1 ──▶ Snapshot of all project files at T1
  Commit 2 ──▶ Snapshot of all project files at T2 (Unchanged files are de-duplicated pointers!)
```

### The Solution: Git's Content-Addressable Key-Value Store

Git is fundamentally a simple key-value database stored inside `.git/objects/`. The key is a 40-character SHA-1 (or 64-character SHA-256) hash, and the value is zlib-compressed binary data.

---

## 2. The Museum Vault and Exhibition Catalog Analogy

A national gallery does not photocopy an entire wing of the museum when they hang a single new painting.

### Gallery Catalog vs Git Objects

```text
Vault Painting (Blob)   → Pure raw canvas data, identified strictly by its visual fingerprint (hash).
Room Manifest (Tree)    → Directory list: "Wall 1: Painting #A14F, Room 2: Gallery Sub-Tree #B882".
Exhibition (Commit)     → Snapshot in time: links to Room Manifest + Curator Notes + Previous Exhibition link.
Official Seal (Tag)     → Permanent wax seal stamped on a specific milestone exhibition.
```

### Mapping to Git Internals

The raw file content is the `blob`; the directory structure is the `tree`; the milestone snapshot is the `commit`; the release tag is the annotated `tag`.

---

## 3. The Mechanism: Content-Addressable Storage and the 4 Object Types

Every object in `.git/objects/` consists of a header (`type size\0`) concatenated with content, hashed with SHA-1, and compressed with zlib.

### The 4 Core Object Types

1. **`blob` (Binary Large Object)**: Stores pure file content. Does NOT store filename, permissions, or timestamps.
2. **`tree`**: Represents a directory. Maps filenames and POSIX permissions (`100644`, `100755`) to blob or child tree hashes.
3. **`commit`**: Points to a top-level `tree` hash, lists parent commit hashes, author, committer, timestamp, and commit message.
4. **`tag`**: An annotated reference pointing to a specific commit hash with GPG signatures and release notes.

### Anatomy of the Object Header

```text
Payload: "Hello World\n" (12 bytes)
Header:  "blob 12\0"
Hash:    SHA1("blob 12\0Hello World\n") = 557db03de997c86a4a028e1ebd3a1ceb225be238
Disk:    zlib.compress("blob 12\0Hello World\n") -> .git/objects/55/7db03de997...
```

---

## 4. Diagram: The Git Object Dependency Graph

### Object Relationships in `.git/objects/`

```text
Commit Object (Hash: `9a8f2c...`)
 ├── tree: `d4e17a...` ────────────────────────────────────────┐
 ├── parent: `1b08f4...` (Previous commit hash)                │
 ├── author: Jane Doe <jane@example.com> 1725148800 +0000      │
 └── message: "feat: add user authentication"                  │
                                                               │
┌──────────────────────────────────────────────────────────────┘
▼
Root Tree Object (`d4e17a...`)
 ├── 100644 blob `8a3e21...`  README.md
 ├── 100755 blob `5f4b90...`  build.sh
 └── 040000 tree `c921fe...`  src/
                               │
       ┌───────────────────────┘
       ▼
Child Tree Object: `src/` (`c921fe...`)
 └── 100644 blob `e69de2...`  server.py ──▶ [Raw Code Text Content]
```

---

## 5. CLI Walkthrough: Inspecting Raw Git Objects with Plumbing Commands

Explore and deconstruct the Git object database using low-level plumbing commands:

```bash
# 1. Initialize an empty repository
mkdir git_internals_lab && cd git_internals_lab
git init

# 2. Create a file and compute its blob hash manually
echo "Hello Git World" | git hash-object --stdin -w
# Output: 557db03de997c86a4a028e1ebd3a1ceb225be238

# 3. Inspect the stored object in .git/objects/
ls -la .git/objects/55/
# File: 7db03de997c86a4a028e1ebd3a1ceb225be238 (first 2 chars are the folder name)

# 4. Check the object type and size
git cat-file -t 557db03de997c86a4a028e1ebd3a1ceb225be238
# Output: blob
git cat-file -s 557db03de997c86a4a028e1ebd3a1ceb225be238
# Output: 16

# 5. Read the raw contents of the blob
git cat-file -p 557db03de997c86a4a028e1ebd3a1ceb225be238
# Output: Hello Git World

# 6. Make a commit and inspect the generated commit object
echo "Hello Git World" > app.txt
git add app.txt
git commit -m "Initial commit"

# 7. Print the latest commit object structure
git cat-file -p HEAD
# Shows:
# tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904
# author Jane Doe <jane@example.com> ...
# committer Jane Doe <jane@example.com> ...
#
# Initial commit
```

---

## 6. Comparing the 4 Git Object Types

| Object Type | Stores File Names? | Stores File Mode? | Points To | Immutable? |
|---|---|---|---|---|
| **`blob`** | No (Content only) | No | None | Yes |
| **`tree`** | Yes | Yes (`100644`, `100755`) | Blobs & Sub-Trees | Yes |
| **`commit`** | No | No | 1 Root Tree + $N$ Parent Commits | Yes |
| **`tag`** | No | No | Target Commit Hash | Yes |

---

## 7. Common Mistakes

- **Believing that Git stores diffs between commits.** Git stores full tree and blob snapshots; deduplication occurs automatically because identical content produces identical hashes.
- **Thinking blobs store filenames.** Blobs store pure binary content; filenames and permissions reside entirely within parent `tree` objects.
- **Assuming two identical files in different folders take double disk space.** If `src/a.txt` and `docs/b.txt` have identical content, Git creates only 1 blob object referenced by two different tree entries.
- **Confusing lightweight tags with annotated tags.** Lightweight tags are simple pointer files in `.git/refs/tags/`; annotated tags create immutable `tag` objects in `.git/objects/`.
- **Manually editing files in `.git/objects/`.** Corrupting compressed object bytes causes SHA hash mismatches and irrecoverable repository corruption.

---

## 8. Hands-On Exercises

**Exercise 1:** Use `git hash-object -w` to manually write an arbitrary string into `.git/objects/` and verify its file location on disk.

**Exercise 2:** Use `git cat-file -t <hash>` and `git cat-file -p <hash>` to inspect the root tree of your latest repository commit.

**Exercise 3:** Create two files with identical content in different directories, commit them, and verify only one blob hash is created.

**Exercise 4:** Inspect an annotated tag object using `git tag -a v1.0 -m "Release"` followed by `git cat-file -p v1.0`.

**Exercise 5:** Write a bash one-liner that decompresses any `.git/objects/xx/yyyy...` file directly using Python's `zlib` module.

---

## 9. Interview Q&A

**Q: How does Git compute an object's SHA-1 hash?**
Git formats a header string: `"{type} {size}\0"` (e.g. `"blob 16\0"`), concatenates the uncompressed payload bytes directly after the null byte, and computes the SHA-1 hash over the entire combined sequence.

**Q: Why does Git store objects in two-character subdirectory folders inside `.git/objects/`?**
Most filesystems experience severe performance degradation when tens of thousands of files exist in a single directory. Git partitions objects by using the first 2 hex characters of the 40-character hash as the directory name (e.g. `.git/objects/55/`) and the remaining 38 characters as the filename, distributing files across 256 subdirectories.

**Q: If two distinct files in a repository contain identical content, how many blob objects does Git create?**
Exactly one. Because Git is content-addressable, both files produce identical SHA hashes and point to the same single blob object in `.git/objects/`. The distinct filenames are preserved in tree objects.

**Q: What is the difference between an Author and a Committer in a Git commit object?**
The **Author** is the person who originally wrote the code and created the patch. The **Committer** is the person who actually applied or committed the patch to the repository (e.g. during a `git rebase`, cherry-pick, or pull request merge).

**Q: Why are Git objects considered immutable?**
Every object is referenced by the cryptographic hash of its contents and header. Changing even a single bit in a file changes its hash, creating a completely new object rather than mutating the existing one. This cryptographic immutability guarantees repository integrity.
