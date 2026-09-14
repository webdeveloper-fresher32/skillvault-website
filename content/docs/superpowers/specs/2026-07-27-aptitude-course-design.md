# Aptitude Course — Design Spec

Date: 2026-07-27

## Purpose

Add a new SkillVault course, `Aptitude/`, covering the first-round aptitude exam commonly used in campus and off-campus tech hiring. Scope is general-purpose: it should serve both service-based mass-hiring rounds (TCS, Infosys, Wipro, Accenture — high-volume, moderate-difficulty, time-pressured) and product/startup-style rounds (Amazon and similar — fewer, harder questions, less rote formula-plugging), without a dedicated Data Interpretation or coding-aptitude/pseudocode pillar.

## Scope

Three pillars, weighted by real exam emphasis:

- **Quantitative Aptitude** — 6 phases (heaviest weight; this is where most exam questions come from)
- **Logical Reasoning** — 4 phases
- **Verbal Ability** — 2 phases

12 phases total, matching the SkillVault convention used by every other course.

## Course Structure

```
Aptitude/
├── Phase-01-Number-Systems-and-Simplification/
├── Phase-02-Percentages-Profit-Loss-and-Averages/
├── Phase-03-Ratio-Proportion-and-Partnership/
├── Phase-04-Time-Speed-Distance-and-Time-Work/
├── Phase-05-Simple-Compound-Interest-and-Mixtures/
├── Phase-06-Geometry-Mensuration-and-Permutations-Combinations/
├── Phase-07-Series-Coding-Decoding-and-Blood-Relations/
├── Phase-08-Puzzles-Seating-Arrangement-and-Direction-Sense/
├── Phase-09-Syllogisms-and-Logical-Deduction/
├── Phase-10-Data-Sufficiency-and-Non-Verbal-Reasoning/
├── Phase-11-Grammar-and-Sentence-Correction/
├── Phase-12-Reading-Comprehension-and-Vocabulary/
├── Projects/
├── Quick-Reference/
└── README.md
```

Phases 1–6 = Quant, 7–10 = Logical Reasoning, 11–12 = Verbal.

Each phase directory contains its own `README.md` (phase goals, learning objectives, topics table with time estimates, link to next phase) plus 2–4 zero-padded numbered lesson files, following the same pattern as Docker/Kubernetes/MongoDB/MySQL/HLD.

## Lesson Format

Aptitude prep is formula- and timed-practice-driven rather than deep architectural explanation, so lessons use a lighter format than the technical courses:

1. **Concept** — short explanation of what the topic is and when it shows up in an exam
2. **Shortcut/trick** — the fast-solve method actually used under time pressure (not just the textbook derivation)
3. **Worked examples** — 2–3 fully solved problems showing the shortcut in action
4. **Timed practice set** — a set of practice questions with an answer key, framed with a suggested time limit per question to build exam-pace habits

## Projects/ Folder

Repurposed as full-length mock tests instead of hands-on coding projects:

- 5 numbered mock tests (`01-Mock-Test-1.md` … `05-Mock-Test-5.md`), each mixing Quant/Logical/Verbal questions proportionally to the real exam weighting, with a suggested total time limit and an answer key at the end of each file.
- A `README.md` explaining how to use the mock tests (timing, scoring, when to attempt relative to phase progress).

## Quick-Reference/ Folder

- `Formula-Cheatsheet.md` — dense reference of every formula/shortcut across all Quant/Logical/Verbal phases, organized by topic (not by chapter), matching the style of existing cheatsheets (e.g. `Git-Cheatsheet.md`).
- `Interview-QA.md` — 50 commonly-missed or trick aptitude questions with explanations, matching the 50-question convention used in other courses' Quick-Reference folders.

## Course-level README.md

Follows the standard convention: course overview, what this course covers and why, the Phase | Topic | Difficulty | Time learning path table, and a link into Phase 1.

## Out of Scope

- Data Interpretation (tables/graphs/charts) — explicitly excluded per user decision.
- Coding aptitude / pseudocode / flowchart questions — explicitly excluded per user decision.
- CLAUDE.md is not being updated as part of this work (separate, pre-existing staleness noted from the earlier codebase scan, not part of this task).

## Open Questions

None — all scoping decisions were made during brainstorming (pillar selection, phase weighting, lesson format, Projects/ repurposing).
