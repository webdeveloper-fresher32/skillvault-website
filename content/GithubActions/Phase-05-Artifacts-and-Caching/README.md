# Phase 5: Artifacts and Caching

## What You'll Learn

So far, everything a job produces has lived only inside that job's own runner, and disappeared the moment the runner was torn down. That's fine for `echo` demos, but real pipelines need two different things this phase covers: **artifacts**, for handing a build's actual output (a compiled binary, a test report, a coverage file) to another job or to a human looking at the workflow run later, and **caching**, for skipping redundant work (reinstalling the same dependencies from scratch on every single run) by reusing what a previous run already downloaded. They look similar — both involve files surviving past a single job — but they solve different problems and get misused in opposite directions when conflated.

## Learning Objectives

- Choose artifacts vs. caching correctly for a given data-passing need — persisting a run's real output vs. speeding up repeated setup work
- Design cache keys that invalidate correctly, using lockfile hashes and `restore-keys` fallback without silently serving stale dependencies
- Avoid cross-matrix cache corruption by keying caches on OS and tool version wherever a build matrix varies

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Upload-and-Download-Artifacts.md](01-Upload-and-Download-Artifacts.md) | `actions/upload-artifact` and `actions/download-artifact`, artifacts vs. job outputs, cross-job hand-off, default retention period | 1 day |
| [02-Actions-Cache-and-Dependency-Caching.md](02-Actions-Cache-and-Dependency-Caching.md) | `actions/cache`, cache hit/miss behavior, built-in `setup-*` caching shortcuts vs. manual `actions/cache` configuration | 1 day |
| [03-Cache-Key-Strategy-and-Invalidation.md](03-Cache-Key-Strategy-and-Invalidation.md) | Designing cache keys from lockfile hash + OS + tool version, `restore-keys` fallback, cache immutability, manual eviction | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Matrix Builds and Strategy](../Phase-06-Matrix-Builds-and-Strategy/README.md)
