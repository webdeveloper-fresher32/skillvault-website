# 01 — Classic IO: Streams and Readers

> A comprehensive reference covering byte streams vs character streams, why raw unbuffered I/O is slow, and how `BufferedReader`/`BufferedWriter` give you efficient, line-oriented file access.

---

## Table of Contents

1. [The Problem: Getting Data In and Out of Your Program](#1-the-problem-getting-data-in-and-out-of-your-program)
2. [The Analogy: A Garden Hose vs a Water Filter](#2-the-analogy-a-garden-hose-vs-a-water-filter)
3. [Byte Streams vs Character Streams](#3-byte-streams-vs-character-streams)
4. [Buffering: Why FileReader Alone Isn't Enough](#4-buffering-why-filereader-alone-isnt-enough)
5. [Code Example: Writing and Reading a File Line by Line](#5-code-example-writing-and-reading-a-file-line-by-line)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Getting Data In and Out of Your Program

Everything you've written so far (Phases 1-6) lives and dies inside one running program — variables, objects, collections, all gone the moment `main` returns. Real programs need to reach *outside* themselves: read a configuration file, write a log, load data a previous run produced, or accept text typed at the console.

That "outside world" — a file on disk, a network socket, the console — doesn't hand you Java objects. It hands you a raw sequence of bytes (or, for text-oriented sources, something you'd like to treat as a raw sequence of *characters*). Read or write that raw stream naively — one unit at a time, with no buffering — and you pay a real cost: every single read or write call can involve a trip through the operating system to the underlying file or device. Do that once, no one notices. Do it once per character across a file with tens of thousands of characters, and the overhead is very noticeable.

The core problem this lesson solves: **how do you read and write text-based data from files (and other sources) correctly, and efficiently, instead of one slow unit at a time?**

---

## 2. The Analogy: A Garden Hose vs a Water Filter

**Real-world analogy:** an `InputStream`/`OutputStream` is a garden hose connected straight to the water main — it delivers raw water (bytes), no more, no less. That's exactly what you want if you're filling a bucket with water and don't care about its composition (say, copying an image file byte-for-byte).

But if what you actually want is clean drinking water — readable text, not raw plumbing output — you attach a filter to the end of that hose. That filter is a `Reader` (for input) or `Writer` (for output): it sits on top of a byte stream and interprets those raw bytes as characters, using a specific character encoding, so your code works with `String`s and `char`s instead of manually decoding byte values yourself.

You could drink straight from the hose (decode bytes yourself), but almost nobody does — the filter exists precisely so you don't have to.

---

## 3. Byte Streams vs Character Streams

Java's classic I/O library (`java.io`, present since Java 1.0) splits cleanly into two parallel hierarchies:

- **Byte streams** — `InputStream` and `OutputStream` are abstract base classes for reading/writing raw bytes. `FileInputStream` and `FileOutputStream` are the concrete implementations for files. Use these for anything that isn't inherently text — images, audio, arbitrary binary data.
- **Character streams** — `Reader` and `Writer` are the abstract base classes for reading/writing characters (text). `FileReader` and `FileWriter` are the concrete implementations for files: internally, a `FileReader` is a byte stream with a character-decoding filter already wrapped around it, so you get `char`s and `String`s out instead of raw byte values.

The rule of thumb: if the data is meant to be read as text, reach for a `Reader`/`Writer`. If it's arbitrary binary data, reach for an `InputStream`/`OutputStream`.

---

## 4. Buffering: Why FileReader Alone Isn't Enough

A plain `FileReader` works — you can call `.read()` on it — but doing so one character at a time, or even one un-buffered line at a time, is inefficient for anything beyond a trivial file: depending on the underlying implementation, each call can involve overhead that dwarfs the actual work of moving a single character.

`BufferedReader` and `BufferedWriter` solve this by wrapping another `Reader`/`Writer` and reading/writing in large internal chunks behind the scenes, handing your code data from an in-memory buffer instead. On top of the efficiency win, `BufferedReader` adds a genuinely convenient method that plain `Reader`s don't have: `readLine()`, which reads and returns one whole line of text at a time (without the line terminator), or `null` once the end of the stream is reached.

You almost always want to wrap a `FileReader`/`FileWriter` in a `BufferedReader`/`BufferedWriter` rather than using the unbuffered version directly:

```
new BufferedReader(new FileReader("notes.txt"))
new BufferedWriter(new FileWriter("notes.txt"))
```

Both `BufferedReader`/`BufferedWriter` and the streams they wrap implement `AutoCloseable`, meaning they must eventually be closed to release the underlying file handle. The cleanest way to guarantee that — even if an exception occurs midway through reading or writing — is **try-with-resources**, which Phase 5 covers in full detail. The short version, used in the example below: declare the resource inside the `try (...)` parentheses, and Java calls `.close()` on it automatically when the block exits, success or failure.

---

## 5. Code Example: Writing and Reading a File Line by Line

```java
import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class ClassicIODemo {
    public static void main(String[] args) {
        String fileName = "notes.txt";

        // Writing: BufferedWriter wraps a FileWriter for efficient buffered output
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(fileName))) {
            writer.write("Java IO is straightforward once you see the pattern.");
            writer.newLine();
            writer.write("Buffering avoids one slow round trip per character.");
            writer.newLine();
            writer.write("try-with-resources closes the writer automatically.");
        } catch (IOException e) {
            System.out.println("Failed to write file: " + e.getMessage());
        }

        // Reading: BufferedReader wraps a FileReader for efficient line-by-line input
        try (BufferedReader reader = new BufferedReader(new FileReader(fileName))) {
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println(line);
            }
        } catch (IOException e) {
            System.out.println("Failed to read file: " + e.getMessage());
        }
    }
}
```

**Expected output:**

```
Java IO is straightforward once you see the pattern.
Buffering avoids one slow round trip per character.
try-with-resources closes the writer automatically.
```

Two details worth tracing through by hand: `writer.write(...)` does **not** append a line terminator on its own — that's what the explicit `writer.newLine()` calls are for. And the `while ((line = reader.readLine()) != null)` loop is the idiomatic pattern for "read every line until there are no more": the assignment happens inside the loop condition itself, `readLine()` returns `null` exactly once, at true end-of-file, and the loop stops there.

---

## 6. Common Mistakes

- **Skipping the buffer.** Reading or writing character-by-character (or line-by-line) directly against a `FileReader`/`FileWriter` with no `Buffered*` wrapper works for a tiny file and can be dramatically slower once the file is any real size — always wrap classic file streams in a `BufferedReader`/`BufferedWriter`.
- **Forgetting to close, or not using try-with-resources.** A `BufferedWriter` may hold written data in its internal buffer until it's flushed or closed — skip closing it (say, by forgetting a `finally` block in older-style code) and buffered output can be lost entirely, on top of leaking the underlying file handle.

**Interview angle:** interviewers often ask "why wrap a `FileReader` in a `BufferedReader`?" as a quick sanity check that you understand streams aren't just an API to memorize — they want to hear you connect the buffering to the actual performance problem (repeated small reads/writes against a slow underlying resource) and name `readLine()` as the practical convenience that comes along with it, not just "it's faster" with no explanation of why.

---

## 7. Hands-On Exercises

### Exercise 1 — Write and read back a multi-line file

Using only `BufferedWriter`/`BufferedReader` and try-with-resources, write a small text file containing at least 5 lines, then read it back and print only the lines with an odd line number (1st, 3rd, 5th, ...).

### Exercise 2 — Feel the difference buffering makes

Write a loop that calls an unbuffered `FileWriter`'s `.write(String)` method 50,000 times, each time writing a single short string, and time it (e.g. with `System.nanoTime()` before/after). Then repeat the exact same 50,000 writes wrapped in a `BufferedWriter`. Compare the two elapsed times.

### Exercise 3 — Count lines in a file

Write a method that opens a file with `BufferedReader` and returns the number of lines it contains, without loading the whole file into a `List` or `String` first — just increment a counter once per `readLine()` call until it returns `null`.

---

## 8. Interview Q&A

### Q1. What's the difference between `InputStream`/`OutputStream` and `Reader`/`Writer`?

**Answer:** `InputStream`/`OutputStream` work with raw bytes and are meant for arbitrary binary data (images, audio, any non-text format). `Reader`/`Writer` work with characters and are meant for text — internally, a character stream like `FileReader` is a byte stream with a character-decoding layer already applied, so you get `char`s/`String`s instead of raw byte values.

---

### Q2. Why wrap a `FileReader` in a `BufferedReader` instead of using `FileReader` directly?

**Answer:** A plain `FileReader` can be inefficient when read a small amount at a time, since each read can involve real overhead beyond the actual data transfer. `BufferedReader` wraps it and reads in larger internal chunks, serving subsequent small reads from an in-memory buffer — and it adds the convenient `readLine()` method, which a plain `Reader` doesn't have.

---

### Q3. What does `BufferedReader.readLine()` return at the end of a file?

**Answer:** It returns `null` exactly once, when there is no more data to read — there is no line terminator character included in the returned line either. This is why the idiomatic reading loop is `while ((line = reader.readLine()) != null) { ... }`.

---

### Q4. Why is it important to close streams, and what's the recommended way to do it?

**Answer:** Streams hold onto operating-system resources (file handles) and, for writers, may buffer data in memory that hasn't actually reached disk yet. Failing to close a stream can leak file handles and, for a `BufferedWriter`, can lose unflushed data entirely. The recommended approach is try-with-resources (Phase 5), which guarantees `.close()` runs automatically even if an exception is thrown inside the block.

---

### Q5. Does `writer.write("hello")` followed by `writer.write("world")` produce two lines in the output file?

**Answer:** No — `write(String)` does not add any line terminator by itself; the two calls produce `helloworld` on a single line unless you explicitly call `newLine()` (or include `\n` yourself) between them.

---

> 🧠 **Memory hook:** "Streams are the hose (raw bytes), Readers/Writers are the filter (text), and Buffered is the reservoir that saves you a trip to the tap on every sip."
