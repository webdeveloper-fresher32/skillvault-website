# Next.js Course — Design Spec

Date: 2026-07-31

## Purpose

Add a new SkillVault course, `NextJS/`, covering the Next.js framework (App Router, Next.js 14/15) from fundamentals through production deployment, mirroring the structure of existing courses (Docker, Kubernetes, AWS, Networking, PaymentGateways). Framed for both practical full-stack development and technical interview prep.

## Scope

12 phases, App Router-first (no Pages Router coverage — the App Router is the current recommended default, and covering both would double lesson count without adding interview/practical value for a course written today).

## Course Structure

```
NextJS/
├── Phase-01-Fundamentals-and-Setup/
├── Phase-02-App-Router-and-File-Based-Routing/
├── Phase-03-Server-and-Client-Components/
├── Phase-04-Data-Fetching-and-Rendering-Strategies/
├── Phase-05-Route-Handlers-and-API-Routes/
├── Phase-06-Server-Actions-and-Forms/
├── Phase-07-Middleware-and-Authentication/
├── Phase-08-Styling-and-UI/
├── Phase-09-Caching-and-Performance/
├── Phase-10-Metadata-SEO-and-Error-Handling/
├── Phase-11-Testing/
├── Phase-12-Production-and-Deployment/
├── Projects/
├── Quick-Reference/
└── README.md
```

Per-phase `README.md` is included (standard convention, matching every complete course in the repo).

## Phase Topic Breakdown

1. **Fundamentals and Setup** — what Next.js solves vs. plain React/CRA/Vite (routing, bundling, SSR out of the box), `create-next-app`, project structure conventions (`app/`, `public/`, config files), the React Server Components mental model introduced at a high level (deep dive deferred to Phase 3)
2. **App Router and File-Based Routing** — special files (`page.js`, `layout.js`, `template.js`, `loading.js`, `error.js`, `not-found.js`), nested layouts, dynamic segments (`[id]`, `[...slug]`, `[[...slug]]`), route groups `(group)`, parallel routes (`@slot`), intercepting routes (`(.)folder`)
3. **Server and Client Components** — the RSC/Client Component boundary and why it exists (shipping less JS, direct backend access), `"use client"` placement rules, composition patterns (passing Server Components as `children` into Client Components), what's forbidden across the boundary (hooks, browser APIs, serializable props only)
4. **Data Fetching and Rendering Strategies** — `fetch()` in Server Components with caching options, SSR vs. SSG vs. ISR (`revalidate`), `generateStaticParams`, streaming with `<Suspense>`, parallel vs. sequential data fetching (request waterfalls)
5. **Route Handlers and API Routes** — `app/api/.../route.js` conventions, supported HTTP methods, `NextRequest`/`NextResponse`, dynamic route params, Node.js vs. Edge runtime tradeoffs
6. **Server Actions and Forms** — `"use server"` functions, calling Server Actions from forms and client components, progressive enhancement (works without JS), optimistic UI with `useOptimistic`, `useActionState`/`useFormStatus` for pending/error state
7. **Middleware and Authentication** — `middleware.js` (matcher config, request rewriting/redirecting), where middleware runs (Edge, before rendering), auth patterns with Auth.js (NextAuth), protecting routes, reading/writing cookies and sessions
8. **Styling and UI** — CSS Modules, global CSS, Tailwind CSS integration, `next/image` (automatic optimization, `sizes`/`priority`), `next/font` (self-hosted font loading, zero layout shift)
9. **Caching and Performance** — the four Next.js caching layers (Request Memoization, Data Cache, Full Route Cache, Router Cache) and how they interact, `revalidatePath`/`revalidateTag`, `dynamic`/`revalidate` route segment config, bundle analysis and code-splitting basics
10. **Metadata, SEO, and Error Handling** — static `metadata` export vs. `generateMetadata`, Open Graph/Twitter card basics, `sitemap.js`/`robots.js`, `error.js` (Client Component error boundaries) vs. `global-error.js`, `not-found.js` and `notFound()`
11. **Testing** — unit/component testing with Jest + React Testing Library (including Server Component quirks), e2e testing with Playwright, testing Route Handlers and Server Actions
12. **Production and Deployment** — deploying to Vercel vs. self-hosting (Node server, Docker), environment variables (`.env`, `NEXT_PUBLIC_` prefix, server vs. client exposure), production checklist (build output, `output: 'standalone'`), monitoring basics, interview-strategy capstone

## Lesson Format

**Revised AGAIN per user correction after seeing Phase 6's draft** (the React/Angular-style format below — long narrative paragraphs per section — was the SECOND approved design, but the user compared it against this repo's JavaScript course and found it too reading-heavy: too much prose, not enough code doing the explaining. The format is now revised a THIRD time to match the JavaScript course's leaner, code-dense style instead.)

Every lesson file now matches the **JavaScript course format** (e.g. `JavaScript/Phase-01-Fundamentals/01-Variables-and-Data-Types.md`) — same overall skeleton (title, TOC, numbered sections, Hands-On Exercises, Interview Q&A) but LEANER inside each section:

```markdown
# <Lesson Title> — Complete Guide

## Table of Contents
1. [Topic Section Name](#1-topic-section-name)
...
N-1. [Hands-On Exercises](#n-1-hands-on-exercises)
N. [Interview Q&A](#n-interview-qa)

---

## 1. <Topic Section Name>

(SHORT intro, 1-3 sentences — not 2-5 paragraphs) → a code block or ASCII diagram immediately follows

### <Sub-topic Heading>
(1-2 sentences of prose) → code block

### <Another Sub-topic Heading>
(1-2 sentences) → code block, often with an ASCII "↳" annotation breaking down what a line does

---

## 2 through N-2. <as many numbered sections as the subject needs, each broken into 2-5 ### sub-headings>
(same pattern: short prose, then code/diagram carrying the actual explanation — code-to-prose ratio should be roughly even or code-dominant, not prose-dominant)

---

## N-1. Hands-On Exercises
(4-5 numbered, concrete, runnable exercises)

## N. Interview Q&A
(4-5 pairs: **Q: ...** then a full paragraph answer — Interview Q&A answers stay substantive/paragraph-length even though body sections got leaner, since these need to sound like something a candidate would say)
```

Key differences from the previous (React/Angular-inspired) format: body sections use `###` sub-headings liberally to break a topic into small, code-anchored chunks; prose per chunk is 1-3 sentences, not 2-5 paragraphs; ASCII diagrams use inline `↳` annotations to explain specific lines rather than a separate prose paragraph; comparison content is often an ASCII block (`var → function-scoped...`) rather than always a markdown table. The goal is a much higher code-to-reading ratio — a learner should spend most of their time reading and running code, with prose only doing the connective/motivating work between code blocks. Interview Q&A answers are the one place that stays full-paragraph, since those need to read as something spoken aloud.

**Superseded — the format below was the second approved design (React/Angular style), replaced by the above:** (the 9-step per-concept scaffold below was the originally-approved design, but the user compared the result against this repo's React and Angular courses and asked for that format instead — a long-form, single-topic-per-file lesson with a Table of Contents and several numbered sections flowing narratively, not one rigid 9-step block repeated per micro-concept).

Every lesson file matches the **React/Angular course format** exactly:

```markdown
# <Lesson Title>

(optional short italicized hook quote/analogy, 1-2 sentences — used in React's course, not mandatory)

---

## Table of Contents

1. [Topic Section Name](#1-topic-section-name)
2. [Topic Section Name](#2-topic-section-name)
...
N-1. [Hands-On Exercises](#n-1-hands-on-exercises)
N. [Interview Q&A](#n-interview-qa)

---

## 1. <Topic Section Name>
(opens with the problem/pain point where the topic warrants it, not a bare definition — prose, 2-5 paragraphs) → interleaved with a diagram, table, or code block as needed

## 2 through N-2. <as many numbered topic sections as the lesson's subject needs — typically 5-8 for a substantial lesson>
(same prose+diagram/code interleaving pattern; sections flow narratively from one to the next rather than each restarting a fixed scaffold)

## N-1. Hands-On Exercises
(4-5 numbered, concrete "build this" exercises — buildable against a real Next.js project, sanity-checked for logical self-consistency)

## N. Interview Q&A
(4-5 direct Q&A pairs: **Q: ...** / short answer paragraph — no narration)
```

This replaces the originally-planned rigid "problem → analogy → definition → internal working → example → compare → mistakes → interview → memory hook" 9-step template that was applied identically to every narrow sub-concept. The spoon-fed teaching principles from [[feedback-explanation-style]] (problem-first framing, analogies, internal-flow diagrams, common mistakes, an interview-ready answer) are still followed **within** individual topic sections where a concept is genuinely tricky — they're just woven into the narrative flow of a longer, multi-section lesson file instead of forced into a repeated fixed heading structure per micro-topic. A "Common Mistakes"-style callout can appear inline within a topic section (as a bullet list or note) rather than as its own top-level numbered section, matching how React/Angular's lessons handle this (e.g. React's Phase 1 Lesson 1 has a numbered section "9. Common Beginner Misconceptions").

Code examples are JavaScript/JSX (matching the JavaScript/React/NodeJS course convention already in the repo — no TypeScript variants, to keep pace with those courses and avoid doubling example volume).

## Projects/ Folder

3 end-to-end builds combining multiple phases:
1. A blog/content site using SSG + ISR, dynamic routes, and the Metadata API (combines Phases 2, 4, 10)
2. An authenticated dashboard using Server Actions, Middleware-based route protection, and forms (combines Phases 6, 7)
3. A full-stack app combining Route Handlers, caching strategies, testing, and deployment to Vercel (combines Phases 5, 9, 11, 12)

## Quick-Reference/ Folder

- `Cheatsheet.md` — dense reference condensed from all 12 phases, organized by task (special file reference table, caching-layer table, rendering-strategy decision table, etc.), phase-cited per the PaymentGateways cheatsheet convention.
- `Interview-QA.md` — 50 interview questions with answers.

Both built last, once phase content exists to cite (matching PaymentGateways build order).

## Course-level README.md

Standard convention: course overview, what it covers and why, Phase | Topic | Difficulty | Time learning path table (12 rows + Projects row), prerequisites, link into Phase 1's README.

## Build Order

Phase-by-phase with review checkpoints (per explicit user decision), not a single large pass:
1. Build Phase 1 (README + lesson files) → user reviews.
2. Continue through Phase 2–12 in order, each phase reviewed before moving to the next.
3. Build Projects/ after all 12 phases are done.
4. Build Quick-Reference/ last.
5. Write course-level README.md once the phase list and time estimates are finalized (can be drafted early alongside Phase 1 and refined as phases complete).

## Out of Scope

- No Pages Router coverage.
- No TypeScript-specific lessons (examples are JavaScript, consistent with the JavaScript/React/NodeJS courses).
- No deep dive into a specific auth provider beyond Auth.js/NextAuth patterns (not a full auth-provider comparison course).
- No cloud-provider-specific deployment beyond Vercel + a basic self-host/Docker mention (deep Docker/Kubernetes deployment patterns are covered by the existing Docker/Kubernetes courses).

## Open Questions

None — all scoping decisions made during brainstorming (12 phases, App Router-first, spoon-fed lesson style, phase-by-phase build order).
