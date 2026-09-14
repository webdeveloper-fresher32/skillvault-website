# 02 — Cleaning and Normalizing Text

> Why raw extracted text is almost never ready to embed, and how to build a small, inspectable cleaning pipeline that fixes the mess without destroying meaning.

---

## Table of Contents

1. [The Problem: Raw Extracted Text Is Messy](#1-the-problem-raw-extracted-text-is-messy)
2. [The Analogy: Editing a Rough Transcript](#2-the-analogy-editing-a-rough-transcript)
3. [The Cleaning Pipeline](#3-the-cleaning-pipeline)
4. [Building clean_text()](#4-building-clean_text)
5. [Before and After: A Worked Example](#5-before-and-after-a-worked-example)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Raw Extracted Text Is Messy

Lesson 1 got you plain text out of a PDF, HTML page, or text file. "Plain text" and "clean text" are not the same thing. Here's what actually comes back from a real-world extraction, verbatim, from a typical PDF policy document:

```
Employee Handbook                                    Page 3 of 12

Section  2:   Time  Off Policy


Full-time employees accrue 1.5   days of paid
time off  per  month, up to  a maximum  of 18 days
per  calendar  year.



Employee Handbook                                    Page 4 of 12

Unused time off does  not  roll over  to the  next
calendar year   unless   approved  in writing  by
a manager.
```

Look closely at what's wrong here, beyond just "it looks a bit off":

- **Repeated boilerplate.** "Employee Handbook ... Page X of 12" appears on every single page — it's a header/footer artifact of the PDF's *layout*, not part of the document's actual meaning, and it will show up again and again if you don't strip it.
- **Irregular whitespace.** Double spaces, extra blank lines, and inconsistent spacing come from how the PDF's layout engine positioned words on the page — none of it is meaningful to a reader or to an embedding model, but it inflates and distorts the text.
- **Broken line breaks.** "Full-time employees accrue 1.5 days..." got split across a line boundary that has nothing to do with sentence or paragraph structure — it's just where the original page happened to wrap text.
- **Encoding artifacts.** Not shown here, but extremely common: curly quotes turning into `â€™`, em-dashes into `â€"`, or accented characters turning into mangled multi-byte sequences (a knock-on effect of the encoding issues from Lesson 1).

If you hand this raw text directly to a chunker (Phase 4) or embedder (Phase 2), you're not embedding "the time-off policy" — you're embedding "the time-off policy, plus a repeated page-header artifact, plus irregular spacing that may subtly shift how a similarity search scores the chunk." Cleaning exists to strip out the *packaging noise* and keep the *actual content*.

---

## 2. The Analogy: Editing a Rough Transcript

**Real-world analogy:** imagine you've just recorded a two-hour interview and had it auto-transcribed. The raw transcript is technically "all the words that were said" — but it's full of "um," "uh," false starts, the interviewer's phone buzzing mid-sentence, and a stage direction like "[recording paused]" that got inserted every time someone took a coffee break. Nobody publishes that transcript as-is. An editor goes through it and removes the noise — the ums, the interruptions, the repeated stage directions — while very deliberately *keeping* the actual substance of what was said, including quotes, technical terms, and the speaker's own phrasing.

Cleaning extracted document text is exactly this editing pass. You're not rewriting the content or paraphrasing it — that would be dangerous, since it risks changing meaning. You're removing the mechanical noise that came from the *format* (repeated page headers, weird spacing, broken encoding) while being careful not to touch the actual substance underneath.

> 🧠 The one-sentence version: *"Cleaning is editing, not rewriting — strip the noise, never touch the meaning."*

---

## 3. The Cleaning Pipeline

A cleaning pipeline is a short, ordered sequence of transformations applied to raw extracted text, each one narrowly scoped:

```
  Raw extracted   ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐   ┌───────────────────┐
  text        ──▶ │ 1. Strip     │──▶│ 2. Normalize      │──▶│ 3. Fix encoding │──▶│ 4. (Optional)     │──▶ Clean text
                   │   boilerplate│   │   whitespace      │   │   artifacts     │   │   lowercase/dedup │
                   └──────────────┘   └──────────────────┘   └────────────────┘   └───────────────────┘
```

**Step 1 — Strip boilerplate.** Detect and remove text that repeats mechanically across the document but carries no unique content — page headers/footers, "Confidential — Internal Use Only" stamps, repeated navigation breadcrumbs from an HTML page. This is usually done with a regex pattern matched against known repeated strings, or by comparing lines across pages and dropping ones that appear on nearly every page.

**Step 2 — Normalize whitespace.** Collapse runs of multiple spaces into one, collapse three-or-more blank lines into at most one or two, and rejoin lines that were only broken because of the original page's fixed width rather than an actual paragraph break.

**Step 3 — Fix encoding artifacts.** Repair mangled characters left over from an encoding mismatch during loading (Lesson 1) — turning `â€™` back into a proper apostrophe, for example — or normalize different Unicode representations of visually-identical characters (Unicode normalization, e.g. Python's `unicodedata.normalize`) so the same character doesn't accidentally exist as two different byte sequences.

**Step 4 — Optional: lowercase and deduplicate.** Some pipelines lowercase text or deduplicate near-identical repeated paragraphs at this stage. This step is genuinely optional and context-dependent — modern embedding models are generally case-aware and benefit from preserved casing (proper nouns, acronyms), so blanket lowercasing is less common than it used to be with older keyword-search systems. It's included here because you'll see it in some pipelines, not because it's always the right call.

The pipeline is ordered deliberately: boilerplate stripping happens *before* whitespace normalization because the boilerplate-matching regex is easier to write against text that still has its original irregular spacing (extra whitespace can actually help you spot repeated header/footer patterns); encoding fixes happen early because a mangled character can otherwise interfere with later regex matching.

---

## 4. Building clean_text()

Here's a small, real implementation covering steps 1-2 from the pipeline above — deliberately kept simple and inspectable rather than trying to handle every conceivable edge case.

```python
import re

def clean_text(raw: str, boilerplate_patterns: list[str] | None = None) -> str:
    """
    Clean raw extracted document text.

    Args:
        raw: the raw text straight out of a loader (Lesson 1).
        boilerplate_patterns: regex patterns matching repeated,
            non-content text (e.g. a page header) to strip out.

    Returns:
        Cleaned text with boilerplate removed and whitespace normalized.
    """
    text = raw

    # Step 1: strip boilerplate. Each pattern is a regex describing a
    # repeated, non-content string -- e.g. r"Employee Handbook\s+Page \d+ of \d+"
    # matches "Employee Handbook   Page 3 of 12" regardless of exact spacing.
    for pattern in (boilerplate_patterns or []):
        text = re.sub(pattern, "", text)

    # Step 2a: rejoin lines that were only broken by the original page's
    # fixed width. A lowercase letter immediately followed by a newline
    # and then another lowercase letter is a strong signal of a
    # mid-sentence line wrap rather than an intentional paragraph break.
    text = re.sub(r"(?<=[a-z,])\n(?=[a-z])", " ", text)

    # Step 2b: collapse any run of 2+ whitespace characters (spaces,
    # tabs, or remaining newlines) down to a single space.
    text = re.sub(r"[ \t]{2,}", " ", text)

    # Step 2c: collapse 3+ consecutive blank lines down to exactly one
    # blank line, so paragraph breaks are preserved but excess vertical
    # whitespace isn't.
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Step 2d: trim leading/trailing whitespace from the whole string,
    # and from each individual line.
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = text.strip()

    return text
```

A couple of the regex patterns deserve a plain-language explanation since regex syntax is dense:

- `r"(?<=[a-z,])\n(?=[a-z])"` reads as: "match a newline character, but only if it's immediately preceded by a lowercase letter or a comma, *and* immediately followed by a lowercase letter." The `(?<=...)` and `(?=...)` are **lookbehind** and **lookahead** — they check what's around a position without actually consuming those characters as part of the match, so only the newline itself gets replaced (with a space), leaving the surrounding letters untouched. This targets exactly the "Full-time employees accrue 1.5\ndays of paid" kind of mid-sentence break from the earlier example, while leaving a genuine paragraph break (which typically follows a period, not a lowercase letter) alone.
- `re.sub(pattern, "", text)` — `re.sub` finds every match of `pattern` in `text` and replaces it with the given replacement string (here, an empty string, meaning "delete it").

---

## 5. Before and After: A Worked Example

Running the raw PDF excerpt from Section 1 through `clean_text()`, with a boilerplate pattern targeting the repeated header:

```python
raw = """Employee Handbook                                    Page 3 of 12

Section  2:   Time  Off Policy


Full-time employees accrue 1.5   days of paid
time off  per  month, up to  a maximum  of 18 days
per  calendar  year.



Employee Handbook                                    Page 4 of 12

Unused time off does  not  roll over  to the  next
calendar year   unless   approved  in writing  by
a manager."""

boilerplate = [r"Employee Handbook\s+Page \d+ of \d+"]
print(clean_text(raw, boilerplate))
```

Output:

```
Section 2: Time Off Policy

Full-time employees accrue 1.5 days of paid time off per month, up to a maximum of 18 days per calendar year.

Unused time off does not roll over to the next calendar year unless approved in writing by a manager.
```

Compare the two versions side by side: the repeated "Employee Handbook ... Page X of 12" lines are gone entirely, the doubled spaces are collapsed to single spaces, the mid-sentence line break in "accrue 1.5 days of paid / time off per month" has been rejoined into one continuous sentence, and the excessive blank lines between paragraphs are down to a single blank line. Nothing about the actual *content* — the 1.5-day accrual rate, the 18-day cap, the manager-approval requirement — changed at all.

---

## 6. Common Mistakes

**Mistake 1: Over-cleaning and destroying meaningful structure.** It's tempting to write an aggressive, blanket whitespace-collapsing regex and run it over *everything*, including content where whitespace is semantically meaningful. A Markdown code block's indentation, a table's column alignment, or a poem's deliberate line breaks all carry meaning that a naive "collapse all whitespace" pass will happily destroy. If your source documents contain code snippets or tables, your cleaning pipeline needs to detect and skip over those regions (or clean them with separate, gentler rules) rather than applying the same aggressive whitespace-collapsing regex everywhere.

**Mistake 2: Cleaning after chunking instead of before.** It's easy to build the pipeline in whatever order feels convenient and end up chunking (Phase 4) raw, messy text first, then cleaning each chunk independently afterward. This is backwards for two reasons: boilerplate detection (like a repeated page header) is much easier to spot across a whole document than within an isolated chunk that may or may not contain the header text at all, and a broken mid-sentence line break sitting exactly at a chunk boundary can silently produce two chunks that each contain half of one broken sentence, corrupting both. Clean first, at the full-document level, *then* chunk the already-clean text.

**Interview angle:** "walk me through your text-cleaning pipeline" is a question that separates candidates who've actually run a RAG pipeline against real documents from those who've only worked with toy, pre-cleaned datasets. A strong answer names the ordering (boilerplate → whitespace → encoding, then chunk) and explicitly calls out the over-cleaning risk — showing you understand cleaning is a precision tool, not a blunt "strip everything" instinct.

---

## 7. Hands-On Exercises

### Exercise 1 — Clean a real messy document

**Goal:** See `clean_text()` handle something you didn't write yourself.

Take the raw output you produced from Lesson 1's Exercise 1 (loading a PDF, HTML page, and text file) and run each through `clean_text()`. For the boilerplate-heavy one (likely the PDF, if it had page numbers or headers), write your own `boilerplate_patterns` regex targeting whatever repeated string you observe.

### Exercise 2 — Break `clean_text()` on purpose

**Goal:** Directly experience the over-cleaning risk.

Construct a short string containing a fenced code block (using triple backticks) with meaningful indentation inside it, surrounded by normal prose. Run it through `clean_text()` and check whether the code block's indentation survived. If it didn't, write (in plain language, no need to implement it) how you would modify the pipeline to detect and skip over fenced code blocks before applying whitespace normalization.

### Exercise 3 — Reorder the pipeline and observe the difference

**Goal:** Internalize why order matters.

Take the worked example from Section 5, but call the whitespace-normalization regexes *before* stripping the boilerplate pattern, using the already-collapsed-whitespace text as input to the boilerplate regex. Check whether the boilerplate pattern still matches correctly (hint: `r"Employee Handbook\s+Page \d+ of \d+"` was written assuming irregular spacing — see what happens once that spacing has already been collapsed to single spaces, and adjust your regex or your reasoning accordingly).

---

## 8. Interview Q&A

### Q1. Why isn't the raw output of a document loader good enough to embed directly?

**Answer:** Raw extracted text typically contains packaging artifacts that have nothing to do with the document's actual content — repeated page headers and footers, irregular whitespace from how a page's layout engine positioned words, broken mid-sentence line wraps, and sometimes encoding corruption. Embedding this noise alongside the real content can distort similarity search, since the model is comparing text that includes artifacts no human would consider part of the meaning.

---

### Q2. What's the risk of being too aggressive when cleaning text?

**Answer:** Over-cleaning can destroy meaningful structure, not just noise. A blanket whitespace-collapsing pass will just as happily mangle a code block's indentation or a table's column alignment as it removes genuinely meaningless spacing. A cleaning pipeline needs to distinguish "noise from the document's packaging" from "structure that's part of the document's actual meaning," and treat each differently.

---

### Q3. Should you clean text before or after chunking, and why?

**Answer:** Before. Boilerplate patterns like repeated page headers are far easier to detect reliably across a whole document than within an isolated chunk, which might only contain a fragment of the repeated text. A broken mid-sentence line break sitting near a chunk boundary can also corrupt two chunks at once if you chunk first and clean second, instead of one clean pass fixing it before chunking ever happens.

---

### Q4. Why clean encoding artifacts separately from whitespace?

**Answer:** Because a mangled character (e.g. `â€™` instead of a proper apostrophe) can interfere with regex patterns used in the other cleaning steps — a boilerplate-matching or whitespace-collapsing regex written assuming normal characters may fail to match text containing garbled multi-byte sequences. Fixing encoding early keeps the rest of the pipeline working against well-formed text.

---

### Q5. Is lowercasing text during cleaning always a good idea?

**Answer:** No — it's optional and increasingly uncommon with modern embedding models, which are generally case-aware and can lose useful signal (proper nouns, acronyms, emphasis) if everything is flattened to lowercase. It made more sense historically with older keyword-matching search systems that treated "Apple" and "apple" as needing to be the same token; with embedding-based retrieval, that's usually not the right trade-off to make by default.

---

> 🧠 **Memory hook:** "Cleaning is editing, not rewriting — strip the page headers and the double spaces, never touch a sentence's actual words."
