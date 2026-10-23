# Project 05 — File-Processing Utility Using Streams and NIO

## Goal

Build a small file-processing tool that reads a text file with the modern `java.nio.file` API, transforms its contents with a Stream pipeline, and writes the result back out — practicing the Stream API from Phase 6 together with `Path`/`Files` from Phase 7.

## What You'll Build

A utility that reads an input text file with `Files.readAllLines`, computes a word-frequency count (or, as an alternative, filters lines matching a given pattern) using a Stream pipeline, and writes a formatted summary back out to a new file with `Files.writeString`.

## Phases Required

- Phase 6 — Lambdas and Streams
- Phase 7 — Java I/O and NIO

## Requirements

- Accept an input file path and an output file path (hardcoded, or read from `args`).
- Read the input file's contents in one call using `Files.readAllLines(path)`, wrapped in a `try`/`catch` for the checked `IOException` it can throw, per Phase 7 Lesson 2.
- Build a Stream pipeline over the lines (or over the words derived from them) using at least: one `filter` (e.g. dropping blank lines, or lines not matching a target pattern), one `map` (e.g. lowercasing words, or extracting a specific field), and one terminal operation that isn't a plain `forEach` — either `collect(Collectors.toList())` for the filtering variant, or a `Stream` of words fed one at a time into a `HashMap<String, Integer>` (using `getOrDefault`, as covered in Phase 4) for the word-frequency variant.
- Produce a final, human-readable result — either the filtered/transformed lines, or a word → count listing sorted by count descending (reusing the `Comparator` techniques from Phase 4).
- Write the final result back out to a new file using `Files.writeString(path, content)`, again handling the checked `IOException`.
- Handle the case where the input file doesn't exist: catch the resulting `IOException` and print a clear, specific error message rather than letting the program crash with an unhandled stack trace.

## Suggested Approach

1. Create a small sample input `.txt` file by hand with a few lines of repeated words to give your frequency count (or pattern filter) something meaningful to work with.
2. Write the read step first in isolation: call `Files.readAllLines`, print the raw lines, and confirm the file is being read correctly before adding any Stream logic on top.
3. Build your Stream pipeline incrementally — add one operation at a time (`filter`, then `map`, then the terminal operation) and print intermediate results as you go, tracing each stage by hand against your sample input, the same way the course's filter → map → collect example is traced step by step.
4. Format the final result into the exact lines you want to write out (e.g. `"word: count"` per line, sorted).
5. Write the result out with `Files.writeString`, then read it back with `Files.readAllLines` in a quick sanity check to confirm the output file's contents match what you printed to the console.
6. Add the `IOException` handling for both the missing-input-file case and any output-path failure, verifying the error messages are specific enough to be useful (not just "something went wrong").

## Stretch Goals

- Sort the word-frequency results by count descending using `Comparator.comparing(...).reversed()` before writing them out, rather than in whatever order the `HashMap` happens to iterate.
- Add a case-insensitive, punctuation-stripped word split (so "Word." and "word" count as the same word) as a `map` step before counting.
- Process more than one input file by calling the same read-pipeline-write logic once per file path, reusing the same code for each (this is beyond what Phase 7 covers directly, but it's a natural extension of the single-file version).

## Evaluation Checklist

- [ ] The program reads the input file with `Files.readAllLines` and correctly handles a missing file without crashing.
- [ ] The Stream pipeline includes at least one `filter`, one `map`, and a non-`forEach` terminal operation, and you can trace its output by hand against your sample input.
- [ ] The final result is written to a new file with `Files.writeString`, and reading it back confirms the content matches what was printed to the console.
- [ ] Any `IOException` from either the read or write step is caught and reported with a specific, useful message.
- [ ] The Stream is not reused after a terminal operation has already run on it anywhere in the code.
