# Phase 8: Custom Actions Development

## What You'll Learn

Every action consumed so far — `actions/checkout@v4`, `actions/setup-node@v4`, Phase 7's own composite actions — has either been someone else's published action or a `runs.using: composite` bundle of ordinary steps. Phase 7's composite actions cover the "bundle a few steps" case well, but they can only do what their constituent `run`/`uses` steps can already do — there is no way for a composite action to, say, parse a config file with a real JSON library, call an external API with retry logic, or ship logic in a language other than whatever the calling runner's default shell provides. This phase covers the two mechanisms for writing an action with genuine custom logic behind it: **JavaScript actions**, which run directly on the runner via Node.js and talk to the Actions runtime through the `@actions/core` toolkit library, and **Docker container actions**, which package their logic and its entire runtime (any language, any system dependency) into a container image. It closes with the basics of versioning and publishing an action — the tagging conventions that let consumers pin to `v1` instead of a raw commit SHA, and the Marketplace metadata that makes an action discoverable — previewing a security trade-off (moving tags vs. SHA pinning) that Phase 11 covers in full.

## Learning Objectives

- Build a working JavaScript action: `action.yml` with `runs.using: node20`, reading inputs and setting outputs via `@actions/core`, and understand why its dependencies must be bundled or vendored rather than left to `npm install`
- Build a working Docker container action: `action.yml` with `runs.using: docker`, a `Dockerfile` with the right `ENTRYPOINT`, and understand the startup-cost and Linux-only trade-offs against a JavaScript action
- Understand action versioning and tagging conventions (`v1`, `v1.2.3`, the moving major-version tag) and the minimum `action.yml` metadata needed for a GitHub Marketplace listing

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-JavaScript-Actions.md](01-JavaScript-Actions.md) | `action.yml` with `runs.using: node20`/`runs.main`, `@actions/core`'s `getInput`/`setOutput`/`setFailed`, bundling `node_modules` or compiling with `@vercel/ncc` | 1-2 days |
| [02-Docker-Container-Actions.md](02-Docker-Container-Actions.md) | `action.yml` with `runs.using: docker`/`runs.image`, `Dockerfile` `ENTRYPOINT`, inputs as env vars vs. args, startup cost and Linux-only constraint | 1-2 days |
| [03-Versioning-and-Publishing-to-Marketplace.md](03-Versioning-and-Publishing-to-Marketplace.md) | Tagging conventions (`v1`, `v1.2.3`, moving major tag), `action.yml` Marketplace metadata (`name`, `description`, `branding`), moving-tag vs. SHA-pin security preview | 1-2 days |

## Estimated Time

4 days

## Next Phase

→ [Phase 9: CI Patterns](../Phase-09-CI-Patterns/README.md)
