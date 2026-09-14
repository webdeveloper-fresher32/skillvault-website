# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

SkillVault is a structured, self-study learning library — entirely Markdown, no build system, no tests, no dependencies. It holds 27 courses: 24 at the top level, plus 3 grouped under `Databases/`. Most follow a 12-phase arc from fundamentals to production; a few are still mid-build.

Representative examples:

- **Docker** — fundamentals through production patterns (Phase 01–12)
- **Kubernetes** — fundamentals through production best practices (Phase 01–12)
- **HLD** — high-level/system design interview prep (Phase 01–12), companion to LLD
- **Databases/MongoDB** — fundamentals through Atlas/cloud (Phase 01–12)
- **Databases/MySQL** — SQL fundamentals through advanced MySQL (Phase 01–12)
- **Databases/Redis** — fundamentals through production patterns (Phase 01–12)

## Consistent Course Structure

Every course follows the same layout:

```
<Course>/
├── Phase-01-<Topic>/     → numbered learning phases (01–12)
├── Phase-NN-<Topic>/     → each phase has a README.md + numbered lesson files
├── Projects/             → beginner → advanced hands-on projects (numbered .md files)
├── Quick-Reference/      → Cheatsheet + Interview Q&A
└── README.md             → course overview, learning path table, time estimates
```

Phase lesson files are numbered (e.g. `01-Topic.md`, `02-Topic.md`) within each phase directory. The Quick-Reference Interview Q&A files contain 50 interview questions per course.

Known gaps, not conventions to copy: `Git/`, `Java/`, `NextJS/`, `React/`, `TypeScript/` and `Databases/Redis/` have no course-level `README.md`. Redis additionally has no phase READMEs at all — that was an explicit request when the course was written, so leave it alone unless told otherwise.

## Database Courses Live Under `Databases/`

Database courses are grouped one level deeper rather than sitting at the top level:

```
Databases/
├── README.md          → family hub: selection matrix, cross-engine comparison, learning order
├── Fundamentals/      → engine-agnostic theory — read before any specific engine
├── MySQL/             → relational
├── PostgreSQL/        → relational
├── MongoDB/           → document
├── Cassandra/         → wide-column
└── Redis/             → key-value
```

Each subfolder is a full course in its own right with the standard layout above. When adding a new database course, put it here — not at the top level — and add a row to the hub's comparison tables. Note the extra directory level when writing relative links: a database lesson reaching another course needs `../../../`, not `../../`.

## Content Conventions

- All content is GitHub-flavored Markdown.
- Phases are numbered with zero-padded two digits (`Phase-01`, `Phase-12`) — preserve this pattern when adding phases.
- Lesson files within a phase follow the same zero-padded numbering (`01-`, `02-`).
- Each phase directory contains its own `README.md` summarising that phase's goals and files.
- Code blocks inside lessons use fenced code blocks with language tags (`bash`, `yaml`, `sql`, `js`, etc.).
- `Databases/MongoDB/README.md` and `Databases/MySQL/README.md` include a full table of contents with anchor links — update these when adding sections. This belongs to the older README style; newer course READMEs deliberately have no TOC (see below).

## Lesson Format — Use the Newest One

The lesson template has been revised twice. Two generations are in the repo, and new content must use the newer:

- **Current (lean, code-dense).** Shipped in the JavaScript course and NextJS Phases 07–09. Short prose, then code or an ASCII diagram doing the explaining. Copy the structure from `NextJS/Phase-07-Middleware-and-Authentication/01-Middleware-Basics.md`. Hard invariants: title ends `— Complete Guide`; an analogy blockquote on line 3; 8 or 9 numbered sections (9 when a `Diagram:` section is present); `###` sub-headings in sections 1–6 only; exactly 5 Hands-On Exercises; exactly 5 Interview Q&A pairs; 200–248 lines; the file ends on the last Q&A answer with no summary or next-lesson link.
- **Older (prose-heavy).** MongoDB, MySQL, Redis and other early courses. Do not copy it for new work; do not rewrite it wholesale either — those courses are complete and correct as they stand.

NextJS Phase 06 is a transitional variant. It is not the reference.

Reference files for the other artifacts: phase README → `NextJS/Phase-09-Caching-and-Performance/README.md` (27 lines, fixed shape). Course README → `PaymentGateways/README.md`. Projects entry → `Databases/Redis/Projects/01-Simple-Key-Value-Cache.md`. Cheatsheet → `PaymentGateways/Quick-Reference/Cheatsheet.md`. Interview Q&A → `Databases/Redis/Quick-Reference/Interview-QA.md` (exactly 50 questions, `### Qn.` form). Recent courses do not include a `Quick-Reference/README.md`.

## Adding New Content

When adding a new course, mirror the existing `Phase-NN-<Topic>` + `Projects/` + `Quick-Reference/` structure and include a top-level `README.md` with a learning path table (Phase | Topic | Difficulty | Time). Database courses go under `Databases/`.

Substantial additions get a design spec in `docs/superpowers/specs/` and an implementation plan in `docs/superpowers/plans/`, both dated — see the existing files for the convention. Those documents record decisions as they were made; do not retro-edit them when paths later change.

When adding a phase to an existing course, update:
1. The phase directory with its own `README.md`.
2. The course-level `README.md` course structure diagram and learning path table.
