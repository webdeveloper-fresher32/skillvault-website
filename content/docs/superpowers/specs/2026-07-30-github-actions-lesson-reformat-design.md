# GitHub Actions Lesson Reformat — Design Spec

Date: 2026-07-30

## Purpose

The `GithubActions/` course (13 phases, built 2026-07-29) used a fixed 8-section narrative template (Problem → Analogy → Internal Flow → Example → Compare → Common Mistakes → Interview Angle → Memory Hook) for every lesson. User feedback: this reads as too prose-heavy relative to code, and doesn't match the style of this repo's `Networking/` and `AWS/` courses, which the user prefers. This spec defines the replacement template and reformats all phase lesson files to match.

## Diagnosis (from comparative analysis of Networking/AWS vs GithubActions)

- GithubActions' Problem+Analogy sections front-load 250-300+ words of dense prose before any code appears (code first appears 27-30% into the file). Networking/AWS diagrams/snippets appear ~8-10% in and recur every section.
- GithubActions concentrates almost all code into one "Example" section; Networking/AWS interleave a diagram, snippet, or table into nearly every conceptual subsection (one per topic, not one per lesson).
- GithubActions' "Compare" sections use prose bullets; Networking/AWS use comparison tables.
- GithubActions ends with narrated "Interview Angle" prose; Networking ends with runnable "Hands-On Exercises" + direct "Interview Q&A" pairs (no narration).
- Headings in GithubActions are the same fixed 8 labels regardless of topic; Networking/AWS headings are topic-named per lesson, however many the concept needs.

## New Lesson Template

```markdown
# <Topic>

(1 short paragraph, 2-4 sentences: what this is and why it matters — no separate "Problem"/"Analogy" headings)

## 1. <Topic-named section, e.g. "What is X">
(short prose, 2-5 sentences) followed immediately by a code/YAML snippet, ASCII diagram, or table illustrating it

## 2. <Topic-named section>
(same pattern: short prose → immediate snippet/diagram/table)

## N. <as many topic-named sections as the concept needs>
...

## Comparison (where applicable)
A markdown table instead of prose bullets, when comparing 2+ options/approaches.

## Common Mistakes
(kept as a section — this was not flagged as a problem — 3-5 concrete bullets)

## Hands-On Exercises
3-5 runnable exercises: real CLI commands (`act`, `gh workflow run`, `gh run view`, `actionlint`, `yamllint`, `gh api`, etc.) or concrete "create this file and observe X" steps a reader can actually do, not hypothetical.

## Interview Q&A
3-5 short, direct Q&A pairs (question, then a 2-4 sentence direct answer) — no narrated "here's what an interviewer is probing for" framing.
```

Notes:
- The number of topic-named sections varies per lesson (matching Networking/AWS's variable structure) — no fixed count.
- "Memory Hook" is dropped (Networking/AWS don't use it).
- "Common Mistakes" is kept, since it wasn't part of the complaint and is genuinely useful.
- Every code/YAML example must remain well-formed (validated with a YAML parser) and, where genuinely executable (JS/shell, as in Phase 8), actually run and verified — this discipline carries over unchanged from the original build.
- All existing cross-phase citations/cross-references established during the original build must be preserved (re-stated in the new structure, not dropped).

## Scope

- Rewrite the ~53 numbered lesson files (`01-*.md`, `02-*.md`, etc.) across `Phase-01` through `Phase-13`.
- Per-phase `README.md` files are unaffected (they're already a goals/topics-table format, not narrative).
- `Projects/` and `Quick-Reference/` are unaffected — already code-heavy / table-and-Q&A format, not in scope per user decision.

## Out of Scope

- No change to phase directory names, lesson file names, or the course-level `README.md`'s structure/links.
- No new topics added or removed — this is a format rewrite of existing content, not a scope change.

## Open Questions

None — template and scope confirmed with user.
