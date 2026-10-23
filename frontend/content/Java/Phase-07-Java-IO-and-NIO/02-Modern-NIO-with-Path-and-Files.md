# 02 — Modern NIO with Path and Files

> A comprehensive reference covering the `java.nio.file` package — `Path`, `Paths`/`Path.of`, and the `Files` utility class — and why it replaced much of the classic `java.io.File` API for everyday file operations.

---

## Table of Contents

1. [The Problem: The Awkward java.io.File API](#1-the-problem-the-awkward-javaiofile-api)
2. [The Analogy: An Old Paper Map vs GPS Navigation](#2-the-analogy-an-old-paper-map-vs-gps-navigation)
3. [Path and the Files Utility Class](#3-path-and-the-files-utility-class)
4. [Code Example: Writing and Reading With Files](#4-code-example-writing-and-reading-with-files)
5. [java.io.File vs java.nio.file.Path/Files](#5-javaiofile-vs-javaniofilepathfiles)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: The Awkward java.io.File API

Lesson 1 covered reading and writing text through `BufferedReader`/`BufferedWriter`, but there's a related, older question: how do you check whether a file exists, create a directory, delete a file, or copy one file to another? Classic Java answers all of these with `java.io.File` — and its design shows its age. Many `File` operations report success or failure as a plain `boolean`: `file.delete()` returns `false` if deletion failed, `file.mkdir()` returns `false` if the directory couldn't be created — with no explanation of *why*. Did the file not exist? Was it a permissions problem? Was the disk full? A bare `false` doesn't say.

The core problem: **how do you perform everyday file operations and get a clear, specific reason when something goes wrong, instead of a bare `true`/`false`?**

---

## 2. The Analogy: An Old Paper Map vs GPS Navigation

**Real-world analogy:** `java.io.File` is like an old paper road map — if a route turns out to be a dead end or the road's been closed, the map doesn't tell you; you just arrive and have to work out why yourself. The modern `java.nio.file` API (`Path` and `Files`) is GPS navigation: if a route fails, it tells you exactly why — "road closed," "no such address" — via a real, specific exception, instead of leaving you stranded with an ambiguous "didn't work."

---

## 3. Path and the Files Utility Class

`java.nio.file.Path` is the modern replacement for `java.io.File` as a representation of a location on the file system — a file or a directory. You construct one with the static factory method `Path.of(...)` (added in Java 11) or the older, still-common `Paths.get(...)` (both do the same job; `Path.of` is the more modern spelling and generally preferred in new code):

```java
Path configPath = Path.of("config", "settings.txt");
```

`Path` itself is mostly about *representing* a location — the actual work happens in `java.nio.file.Files`, a utility class of static methods that operate on a given `Path`. A few of the most commonly used:

- `Files.exists(path)` — returns whether something exists at that location.
- `Files.createDirectories(path)` — creates a directory (and any missing parent directories), throwing `IOException` if it genuinely can't.
- `Files.writeString(path, content)` — writes a `String` to a file in one call (added in Java 11).
- `Files.readAllLines(path)` — reads an entire text file into a `List<String>`, one element per line.
- `Files.copy(source, target)` — copies a file, throwing `IOException` on failure (e.g. `target` already exists, without an explicit overwrite option).

The key structural difference from `java.io.File`: these methods throw a real, informative checked `IOException` (Phase 5) when something goes wrong, rather than silently returning `false`.

---

## 4. Code Example: Writing and Reading With Files

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class NioDemo {
    public static void main(String[] args) {
        Path path = Path.of("nio-notes.txt");

        try {
            Files.writeString(path, "Line one from Files.writeString\nLine two, same call\n");

            List<String> lines = Files.readAllLines(path);
            for (String line : lines) {
                System.out.println(line);
            }

            System.out.println("File exists: " + Files.exists(path));
        } catch (IOException e) {
            System.out.println("NIO operation failed: " + e.getMessage());
        }
    }
}
```

**Expected output:**

```
Line one from Files.writeString
Line two, same call
File exists: true
```

Trace it through: `Files.writeString` writes the whole two-line string (including the embedded `\n` characters) to `nio-notes.txt` in one call — no manual `Writer`, no explicit close, since the method opens and closes the file internally. `Files.readAllLines` then reads that file back as a `List<String>` — the trailing `\n` after "Line two, same call" is a line terminator, not a third empty line, so the list has exactly two elements. Both calls are checked to throw `IOException`, so the whole block is wrapped in a single `try`/`catch`.

---

## 5. java.io.File vs java.nio.file.Path/Files

| | **`java.io.File`** | **`java.nio.file.Path` / `Files`** |
|---|---|---|
| **Error reporting** | Often a plain `boolean` (`false` = failed, no reason given) | Throws a specific, informative `IOException` (or subclass) on failure |
| **Convenience methods** | Limited — reading/writing text still requires a separate `Reader`/`Writer` | Rich one-line methods: `writeString`, `readAllLines`, `copy`, `createDirectories` |
| **Memory behavior** | N/A — `File` only represents metadata/paths, not content | Convenience methods like `readAllLines`/`writeString` load the *entire* file into memory |
| **Best for** | Legacy code, minimal path metadata operations | Everyday file operations on reasonably-sized files |
| **Still relevant?** | Streaming a very large file line-by-line is still done with `BufferedReader` (Lesson 1), not a method that loads it all into memory | The clear default for anything that comfortably fits in memory |

The practical takeaway: reach for `Files`' convenience methods by default — they're shorter and give you real error information. But for a file too large to comfortably fit in memory, Lesson 1's line-by-line `BufferedReader` streaming approach (or `Files.lines(path)`, which returns a lazily-read `Stream<String>` and must itself be closed, typically via try-with-resources) is still the right tool, not `Files.readAllLines`.

---

## 6. Common Mistakes

- **Loading an entire huge file into memory.** `Files.readAllLines` and `Files.writeString` are convenient because they load/write everything in one call — which is exactly the problem for a file too large to fit comfortably in memory. For that case, stream it line-by-line with `BufferedReader` (Lesson 1) or `Files.lines(path)` instead of pulling the whole thing into a `List<String>` at once.
- **Ignoring the checked `IOException`.** Because `Files` methods throw real exceptions instead of returning `false`, forgetting to handle (or declare) that `IOException` is a compile error waiting to remind you — which is the point: it forces you to at least acknowledge that file operations can fail, rather than silently ignoring a `false` return value the way older `File` code often did.

**Interview angle:** a common framing question is "why did Java introduce `java.nio.file` when `java.io.File` already existed?" — interviewers want to hear that you understand the *specific* problem being solved (ambiguous `boolean` failures vs. real exceptions with a cause) rather than a vague "it's newer and better," and that you know classic streaming I/O from Lesson 1 hasn't been made obsolete — it's still the right choice for very large files that `Files`' whole-file convenience methods would load entirely into memory.

---

## 7. Hands-On Exercises

### Exercise 1 — Round-trip a file with Files

Using only `Path` and `Files` (no `BufferedReader`/`BufferedWriter`), write a short multi-line string to a file with `Files.writeString`, then read it back with `Files.readAllLines` and print the number of lines it contains.

### Exercise 2 — Trigger and inspect a real IOException

Call `Files.readAllLines` on a `Path` that deliberately does not exist, inside a `try`/`catch (IOException e)` block, and print `e.getMessage()`. Note how much more specific that message is than a plain `false` would have been.

### Exercise 3 — Create a directory tree

Use `Files.createDirectories` to create a nested directory structure (e.g. `data/2026/reports`) in one call, then use `Files.exists` to confirm each level was actually created.

---

## 8. Interview Q&A

### Q1. What problem does `java.nio.file` solve that `java.io.File` didn't?

**Answer:** `java.io.File` frequently reports failure as a bare `boolean`, giving no indication of why an operation failed. `java.nio.file`'s `Path`/`Files` API throws specific, informative exceptions (typically `IOException` or a subclass) instead, so callers get an actual reason for the failure rather than an ambiguous `false`.

---

### Q2. What does `Files.readAllLines` return, and what's the risk of using it carelessly?

**Answer:** It returns a `List<String>`, one element per line of the file, read entirely into memory in one call. The risk is using it on a file too large to comfortably fit in memory — for that case, streaming line-by-line with `BufferedReader` or `Files.lines(path)` is the safer choice.

---

### Q3. What's the difference between `Paths.get(...)` and `Path.of(...)`?

**Answer:** They do the same job — constructing a `Path` from one or more string segments. `Path.of` was added in Java 11 as the more modern, preferred static factory; `Paths.get` is the older method still seen frequently in existing code and tutorials predating Java 11.

---

### Q4. Is `Files.exists(path)` guaranteed to still be accurate by the time you act on it?

**Answer:** Not strictly — like most file-system checks, there's a small window between checking and acting where another process could change the file system. `Files.exists` is a useful check for typical single-process scripts and applications, but code that must be robust against concurrent external changes generally needs to handle the failure of the subsequent operation (via its thrown exception) rather than relying solely on the earlier existence check.

---

### Q5. When would you still use classic `BufferedReader`/`BufferedWriter` from Lesson 1 instead of `Files`' convenience methods?

**Answer:** When the file is large enough that reading it all into memory at once (as `Files.readAllLines` does) isn't practical — streaming it line-by-line with `BufferedReader`, processing and discarding each line as you go, keeps memory usage bounded regardless of file size.

---

> 🧠 **Memory hook:** "`File` hands you a shrugging `false`; `Path`/`Files` hands you GPS turn-by-turn directions on exactly what went wrong."
