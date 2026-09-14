# Project 01 — Command-Line Text Utility

## Goal

Build a small console-based text-processing tool that reads lines of input and reports statistics about them, using nothing but the language fundamentals, control flow, and core `String`/array utilities covered in Phases 1–3 — no collections, no streams, no external libraries.

## What You'll Build

A CLI program that reads lines of text typed into the console (or piped in) until a sentinel line (e.g. a blank line or the word `END`) is entered, then prints a short report: total line count, total word count, the longest line (and its length), and the count of a specific word supplied as a command-line argument.

## Phases Required

- Phase 1 — Java Fundamentals and Setup
- Phase 2 — Object-Oriented Programming
- Phase 3 — Arrays, Strings and Core Utility Classes

## Requirements

- Read the target search word from `args[0]` (the `main(String[] args)` parameter) before reading any console input.
- Read lines of console input in a loop (a `Scanner` wrapping `System.in`, or a `BufferedReader` if you prefer — either is fair game at this stage) until a sentinel line signals the end of input.
- Track, without using any collection type: the number of lines read, the number of words read (split each line on whitespace), the longest line seen so far and its length, and how many times the target word appears across all lines (case-insensitive).
- Store each line's word count and the running "longest line" comparison using plain variables and `if`/`else` logic — no `List` or array resizing tricks needed, since you only need to remember the current line and the best-so-far values.
- Print a final report with clearly labeled fields, one per line.
- Handle the edge case of zero lines of input (an empty report, not a crash or a division-by-zero when computing an average).

## Suggested Approach

1. Start with the `main` method reading `args[0]` and printing an error message (without crashing) if no argument was supplied.
2. Set up your loop, tracking variables (`lineCount`, `wordCount`, `longestLine`, `longestLineLength`, `targetWordCount`) initialized before the loop starts.
3. Inside the loop, read one line, check it against your sentinel, and `break` out if it matches.
4. For each real line: split it into words (`String.split`), update `wordCount`, compare its length against `longestLineLength` and replace both tracking variables if it's longer, and count case-insensitive occurrences of the target word.
5. After the loop exits, print the final report, guarding the "longest line" output for the zero-lines case.
6. Manually trace through a small sample input by hand before running it, to confirm your counts match what you expect (per the course's code-accuracy discipline).

## Stretch Goals

- Add a second report line showing the *average* word count per line (as a `double`, demonstrating the integer-vs-floating-point division distinction from Phase 1).
- Support multiple search words (space-separated in `args`) and report a count for each, using nested loops instead of collections.
- Detect and report the shortest non-empty line as well as the longest.

## Evaluation Checklist

- [ ] The program compiles and runs from the command line with `java CommandLineUtility <word>`.
- [ ] It correctly counts lines and words for a multi-line sample input.
- [ ] It correctly identifies the longest line, including a tie-breaking rule you can explain (e.g. "first one seen wins").
- [ ] The target-word count is case-insensitive and correct against a hand-traced sample.
- [ ] Zero-line input does not crash and prints a sensible empty report.
- [ ] No `List`, `Map`, or `Set` is used anywhere in the solution — only primitives, `String`/array methods, and control flow.
