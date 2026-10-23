# Phase 4: Environment, Secrets, and Variables

## What You'll Learn

Every workflow so far has hardcoded its values directly into `run:` commands. Real pipelines need to inject configuration that changes per environment (a database URL for staging vs. production), keep credentials out of the YAML file entirely, and make decisions based on data the workflow only knows at runtime (which branch triggered it, what a previous step produced). This phase covers the three mechanisms GitHub Actions gives you for that: the `env:` block and its precedence rules, GitHub Secrets and Environments for credentials and deployment gating, and the `${{ }}` expression syntax that reads all of it back out.

## Learning Objectives

- Manage env-var scope and precedence correctly — workflow, job, and step level, plus the dynamic `$GITHUB_ENV` file for values computed during a run
- Use Secrets and Environments appropriately, including the approval-gate pattern for protected deployments
- Read and write expression syntax across the built-in contexts (`github`, `env`, `secrets`, `steps`, `needs`, `job`, `runner`, `matrix`)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Env-Vars-at-Workflow-Job-Step-Level.md](01-Env-Vars-at-Workflow-Job-Step-Level.md) | `env:` at workflow/job/step level, precedence order, static `env:` vs. dynamic `$GITHUB_ENV` | 1 day |
| [02-GitHub-Secrets-and-Environments.md](02-GitHub-Secrets-and-Environments.md) | Repository/organization/environment-scoped Secrets, `${{ secrets.NAME }}`, Environments as an approval gate, log masking and its limits | 1 day |
| [03-Contexts-and-Expression-Syntax.md](03-Contexts-and-Expression-Syntax.md) | `${{ }}` expression syntax, built-in contexts, `contains()`/`startsWith()`/`format()`/`toJSON()`, evaluation order and injection risk | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Artifacts and Caching](../Phase-05-Artifacts-and-Caching/README.md)
