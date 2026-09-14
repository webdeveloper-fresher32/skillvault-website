# GitHub Actions Projects — End-to-End Pipelines

Every phase so far (01–13) taught one technique in isolation: a test pipeline on its own (Phase 9), a registry build/push on its own (Phase 10), a reusable workflow on its own (Phase 7), a custom action on its own (Phase 8). A real CI/CD setup never uses exactly one of these at a time — a production pipeline tests, builds, and deploys in the same run; a monorepo's CI needs a dynamic matrix *and* a shared reusable workflow, not either alone; a custom action is only half a story until something actually consumes it, tagged and versioned the way a real dependency would be.

This folder is the bridge between "I finished Phase 9 and Phase 10 individually" and "I can write the single workflow file a real team would actually ship." Each project below fuses two or three phases' patterns into one coherent pipeline and explains, in `## Approach Discussion`, why each pattern is doing work the others can't — exactly as the phase lessons themselves cross-referenced each other throughout the course.

## How to Use This Folder

Attempt a project only after you've completed the phases it draws from — the table below lists them. Read `## Problem Statement` first and try sketching the workflow shape from memory before reading `## Approach Discussion`. The `## Solution` section has full, validated YAML (plus any supporting shell/Dockerfile), and `## Trade-offs and Considerations` closes out each project the way `## Complexity` closes out a DSA project — except here the trade-offs are cost, security, and maintainability, not Big-O, because a CI/CD pipeline's "efficiency" is measured in runner-minutes, blast radius, and how easily the next engineer can change it safely, not in asymptotic bounds.

## Projects

| File | Patterns Combined | Phases |
|---|---|---|
| [`01-Full-CI-CD-Pipeline.md`](01-Full-CI-CD-Pipeline.md) | CI (test) + Docker build/push + CD (deploy) + Environment approval | Phases 9, 10 |
| [`02-Reusable-Workflow-Monorepo-CI.md`](02-Reusable-Workflow-Monorepo-CI.md) | Reusable workflows + dynamic matrix + path filters | Phases 6, 7, 9 |
| [`03-Custom-Docker-Action-Published-and-Consumed.md`](03-Custom-Docker-Action-Published-and-Consumed.md) | Custom Docker action + versioning + consumption from another workflow | Phase 8 |

## Why This Matters for Real Pipelines

A workflow file that only tests, only builds, or only calls one reusable job is a lesson-sized example — useful for isolating a technique, but not what ships. The moment a team asks "does this actually deploy to production, gated behind someone's approval?" or "does this scale to fifty packages in one repo without fifty copy-pasted CI files?" or "can another team actually depend on the action we published, the way they'd depend on any versioned package?", the answer requires exactly the kind of synthesis these three projects drill: recognizing which phase's pattern covers which piece of the real requirement, and wiring the pieces together — `needs:` chains, `environment:` gates, `fromJSON()` matrices, `workflow_call`, and `uses: owner/repo@tag` — into one pipeline that behaves the way production CI/CD actually has to.
