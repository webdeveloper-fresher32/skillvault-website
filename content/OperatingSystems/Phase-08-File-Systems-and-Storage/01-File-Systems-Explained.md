# File Systems Explained — Files, Directories, Inodes, and Allocation Methods

## Table of Contents
1. [What is a File System?](#1-what-is-a-file-system)
2. [Files and Directories](#2-files-and-directories)
3. [Inodes — The Core Data Structure](#3-inodes--the-core-data-structure)
4. [File Allocation Methods](#4-file-allocation-methods)
5. [Comparing Allocation Methods](#5-comparing-allocation-methods)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is a File System?

A **file system** is the part of the OS that decides how data is named, stored, organized, and retrieved on a storage device (HDD, SSD, USB drive). Without it, a disk is just a flat sequence of numbered blocks with no meaning attached.

```
Raw disk (no file system):
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │...│  ← just numbered blocks
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
"Where is my file called notes.txt?"  →  no idea, disk has no concept of files

With a file system (e.g. ext4, NTFS, APFS):
┌────────────────────────────────────────────┐
│  /home/ganesh/notes.txt → blocks [4, 7, 9]  │
│  /home/ganesh/photo.png → blocks [2, 3]     │
└────────────────────────────────────────────┘
"Where is notes.txt?" → file system looks it up and knows exactly which blocks
```

The file system is responsible for:
- **Naming** — mapping human-readable paths to physical locations.
- **Organization** — directories/folders, hierarchy.
- **Space management** — tracking free vs used blocks.
- **Access control** — permissions, ownership.
- **Reliability** — surviving crashes without losing/corrupting data (covered in lesson 04).

Common file systems: **ext4** (Linux), **NTFS** (Windows), **APFS** (macOS), **XFS** (Linux, high-performance), **FAT32/exFAT** (USB drives, cross-platform).

---

## 2. Files and Directories

### A File

A file is a named collection of related data, treated as a single unit by the OS. From the OS's perspective, a file is just a sequence of bytes — it doesn't know or care if it's a `.txt`, `.jpg`, or `.mp4`. Interpretation of content is up to the application.

### A Directory

A directory is **not a special container** at the disk level — it's just a special kind of file whose content is a table mapping **names → inode numbers** (see below).

```
Directory "/home/ganesh/" contents (conceptually):

┌─────────────────┬─────────────┐
│ Name             │ Inode #     │
├─────────────────┼─────────────┤
│ notes.txt        │ 1042        │
│ photo.png        │ 1043        │
│ projects/        │ 1044        │  ← another directory (subfolder)
└─────────────────┴─────────────┘
```

This is why directories can list files instantly (they just read a small table) but the actual file data lives elsewhere, pointed to by the inode.

### Directory Tree

```
/                       (root, inode 2)
├── home/               (inode 100)
│   └── ganesh/         (inode 101)
│       ├── notes.txt   (inode 1042)
│       └── projects/   (inode 1044)
├── etc/                (inode 200)
└── var/
    └── log/
        └── syslog      (inode 300)
```

---

## 3. Inodes — The Core Data Structure

An **inode** ("index node") is a data structure that stores all the **metadata** about a file — everything except its name and its actual content.

```
Inode #1042 for notes.txt
┌───────────────────────────────────────────┐
│ File type:       regular file              │
│ Permissions:     rw-r--r--                 │
│ Owner (UID):     1000 (ganesh)             │
│ Group (GID):     1000                      │
│ Size:            4096 bytes                │
│ Timestamps:      created, modified, accessed│
│ Link count:      1 (# of directory entries │
│                  pointing to this inode)   │
│ Pointers to data blocks: [4, 7, 9, ...]    │
└───────────────────────────────────────────┘
```

Key insight: **the file's name lives in the directory entry, NOT in the inode.** The inode only knows "I am this data, with these permissions, stored in these blocks." This is exactly why:

- **Hard links work**: multiple directory entries (even with different names, even in different directories) can point to the *same* inode number. The data isn't duplicated.
- **`rm` doesn't always free space immediately**: `rm` removes the directory entry and decrements the inode's link count. Only when the link count reaches 0 **and** no process has the file open does the OS actually free the data blocks.
- **Renaming a file is instant** regardless of file size — you're just changing a name→inode mapping in a directory, not touching the data.

```
Hard link example:

/home/ganesh/notes.txt  ──┐
                           ├──▶  Inode 1042  ──▶  Data blocks [4, 7, 9]
/home/ganesh/backup.txt ──┘      (link count = 2)

$ rm notes.txt      → link count drops to 1, data blocks untouched
$ rm backup.txt     → link count drops to 0, data blocks now freed
```

### Inode Table

The file system reserves a fixed region of disk (or a dynamically growable one, depending on FS) called the **inode table**, containing one inode per file/directory on the volume.

```
Inode Table (simplified)
┌──────┬──────────────────────────────┐
│  #   │ Metadata + data block pointers│
├──────┼──────────────────────────────┤
│ 100  │ (directory: /home)            │
│ 101  │ (directory: /home/ganesh)     │
│ 1042 │ (file: notes.txt)             │
│ 1043 │ (file: photo.png)             │
└──────┴──────────────────────────────┘
```

This is also why `df -i` can report "disk full" (out of inodes) even when `df -h` shows free space — millions of tiny files can exhaust the inode table before they exhaust the raw bytes.

---

## 4. File Allocation Methods

Once the OS decides a file needs N blocks of storage, it must decide **which physical blocks** to give it and **how to remember which blocks belong to which file**. Three classic strategies:

### 4.1 Contiguous Allocation

Each file occupies a single, unbroken run of blocks on disk.

```
Disk blocks:
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│free│ A  │ A  │ A  │free│ B  │ B  │free│free│free│
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘

File A: start=1, length=3   (directory entry just stores start + length)
File B: start=5, length=2
```

**Pros:** Extremely fast sequential *and* random access — the OS computes `start + offset` directly, no chasing pointers.
**Cons:** External fragmentation (free space becomes scattered into small unusable gaps); files can't easily grow in place if the next block is already taken; requires knowing the file size in advance for best placement.

```
After some files grow/shrink, free space fragments:
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│free│ A  │free│ B  │free│free│ C  │free│ D  │free│
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
Total free = 5 blocks, but no single run ≥ 2 blocks except positions 4-5.
A new file needing 3 contiguous blocks CANNOT be placed, even though 5 are free!
```

### 4.2 Linked Allocation

Each file is a linked list of blocks scattered anywhere on disk. Every block stores a pointer to the next block.

```
File A directory entry: start=4

Block 4        Block 9        Block 2        Block 7
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ data    │──▶│ data    │──▶│ data    │──▶│ data    │──▶ NULL
│ next: 9 │   │ next: 2 │   │ next: 7 │   │ next:NIL│
└─────────┘   └─────────┘   └─────────┘   └─────────┘

Disk layout (physical order ≠ logical order):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ 0  │ 1  │A:2 │ 3  │A:4 │ 5  │ 6  │A:7 │ 8  │A:9 │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
```

**Pros:** No external fragmentation — any free block can be used. Files can grow easily (just link a new block).
**Cons:** Terrible random access — to read block 100 of a file, you must traverse 99 pointers first (O(n) seek chain). Pointers waste some space in every block. A single corrupted "next" pointer breaks the whole chain.

**Variant — File Allocation Table (FAT):** pulls all the "next block" pointers out of the data blocks and into one central table in a reserved disk area, so you don't have to read each data block just to find the next pointer.

```
FAT table (kept in memory, one entry per block):
┌───────┬───────┬───────┬───────┬───────┬───────┐
│Block 2│Block 4│Block 7│Block 9│  ...  │       │
├───────┼───────┼───────┼───────┼───────┼───────┤
│  → 7  │  → 9  │  EOF  │  → 2  │       │       │
└───────┴───────┴───────┴───────┴───────┴───────┘
Directory entry for File A: start = 4
Follow: 4 → 9 → 2 → 7 → EOF
```

### 4.3 Indexed Allocation

Each file gets one **index block** that stores an array of pointers to all of its data blocks. No pointers are stored inside the data blocks themselves.

```
Directory entry for File A: index block = 50

Index Block 50                Data blocks
┌──────────────────┐
│ ptr[0] = 4        │────▶  Block 4 (data)
│ ptr[1] = 9        │────▶  Block 9 (data)
│ ptr[2] = 2        │────▶  Block 2 (data)
│ ptr[3] = 7        │────▶  Block 7 (data)
│ ptr[4] = -1 (unused)│
└──────────────────┘
```

**Pros:** Direct/random access — to read block K of the file, look up `ptr[K]` in the index block, O(1). No external fragmentation. Supports sparse files (unused ptr slots cost nothing).
**Cons:** The index block itself takes up a whole block even for a tiny file (wasteful for small files). A single index block has a fixed number of pointer slots — what about huge files?

**Solving the "huge file" problem — multi-level / indirect indexing (this is what ext-family/UNIX inodes actually use):**

```
Inode's block pointers:
┌────────────────────────────────────┐
│ Direct pointers (12 slots)           │──▶ data blocks directly
│ Single indirect pointer              │──▶ index block ──▶ data blocks
│ Double indirect pointer              │──▶ index block ──▶ index blocks ──▶ data blocks
│ Triple indirect pointer              │──▶ ... ──▶ ... ──▶ data blocks
└────────────────────────────────────┘

Small files: only direct pointers used → 1 disk read to find data, very fast.
Huge files: triple-indirect kicks in → supports files far larger than 12 blocks,
            at the cost of extra disk reads for the far-away parts of the file.
```

This hybrid design is why small file access is fast (metadata + first 12 blocks are cheap to reach) while still supporting multi-gigabyte files.

---

## 5. Comparing Allocation Methods

| Criterion | Contiguous | Linked | Indexed |
|-----------|-----------|--------|---------|
| Random access | Fast — O(1) calc | Slow — O(n) traversal | Fast — O(1) lookup |
| Sequential access | Fast | Fast (if disk seeks are cheap) | Fast |
| External fragmentation | Yes (major issue) | No | No |
| Wasted space | None (besides fragmentation) | Pointer per block | Whole index block per file |
| File growth | Hard (needs contiguous room) | Easy | Easy (until index block fills) |
| Reliability | One bad block = one file corrupted | One bad pointer = rest of chain lost | One bad index block = whole file lost |
| Real-world use | CD-ROMs, some DB files | Old FAT-style systems (via FAT table variant) | ext2/3/4, NTFS, most modern file systems |

---

## 6. Hands-On Exercises

**Exercise 1:** On a Linux/macOS machine, run `ls -i` in a directory to see inode numbers next to file names. Create a hard link with `ln file1.txt file2.txt`, then run `ls -i` again — confirm both names share the same inode number.

**Exercise 2:** Run `stat notes.txt` (or `stat -f` variants on macOS) and identify which fields come from the inode (size, permissions, timestamps, link count) versus which come from the directory entry (the filename itself).

**Exercise 3:** Run `df -h` and `df -i` on the same filesystem. Explain a hypothetical scenario where `df -h` shows plenty of free space but `df -i` shows 100% inode usage (hint: millions of tiny files).

**Exercise 4:** On paper, simulate contiguous allocation: given a 20-block disk and files needing 3, 5, 2, and 4 blocks created and deleted in some order, show how external fragmentation can leave 6 free blocks that can't satisfy a 4-block request.

**Exercise 5:** Draw the multi-level indexed structure (direct + single/double/triple indirect) for a file system with a 4KB block size and 4-byte pointers. Calculate roughly how large a file can get using only direct + single-indirect pointers (12 direct + 1024 single-indirect blocks × 4KB).

---

## 7. Interview Q&A

**Q: What is an inode, and what does it NOT store?**
Answer: An inode is a data structure holding a file's metadata — permissions, owner, size, timestamps, link count, and pointers to its data blocks. It does NOT store the file's name — that mapping (name → inode number) lives in the directory entry. This separation is what makes hard links and instant renames possible.

**Q: Why doesn't deleting a file always free up disk space immediately?**
Answer: `rm`/`unlink` removes the directory entry and decrements the inode's link count. The underlying data blocks are only freed when the link count reaches zero AND no process still has the file open (an open file descriptor keeps the inode alive even with zero links — this is why a deleted log file being written to by a running process still consumes disk space until the process closes it or restarts).

**Q: Compare contiguous, linked, and indexed file allocation.**
Answer: Contiguous stores a file in one unbroken run of blocks — fast for both sequential and random access, but suffers external fragmentation and makes growing files hard. Linked allocation scatters blocks anywhere and chains them via pointers — no fragmentation, easy growth, but slow random access (must traverse the chain) and fragile (one broken pointer loses the rest of the file). Indexed allocation uses a dedicated index block listing all data block addresses — fast random access, no fragmentation, at the cost of extra space for the index block itself; modern file systems extend this with multi-level indirect pointers to support very large files.

**Q: How do modern file systems like ext4 support both small and very large files efficiently?**
Answer: They use a hybrid indexed scheme: the inode has a handful of direct pointers (fast path for small files — one lookup gets you the data), plus single/double/triple indirect pointers that point to index blocks (which may point to more index blocks) for large files. This keeps small-file access fast (minimal indirection) while still supporting files far larger than direct pointers alone could address.

**Q: What is external fragmentation and which allocation method suffers from it?**
Answer: External fragmentation is when total free disk space is sufficient to satisfy a request, but it's scattered into small non-contiguous chunks, none large enough alone. Contiguous allocation suffers from this because it requires one unbroken run of free blocks per file. Linked and indexed allocation avoid it because they can use any free block regardless of location.

**Q: Why can `df -h` show free space while `df -i` shows the disk as "full"?**
Answer: `df -h` reports free data blocks (raw bytes), while `df -i` reports free inodes. A file system has a fixed (or capped) number of inodes. If an application creates millions of tiny files (e.g., a cache with one file per key), it can exhaust all available inodes long before it exhausts raw disk space, causing "No space left on device" errors even though `df -h` shows gigabytes free.
