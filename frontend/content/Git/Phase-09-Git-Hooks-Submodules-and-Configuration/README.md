# Phase 9: Git Hooks, Submodules, and Configuration

## What You'll Learn

Master repository automation, nested dependencies, and advanced configuration: write and deploy client-side lifecycle hooks (`pre-commit`, `commit-msg`, `pre-push`) and server-side hooks (`pre-receive`), manage nested component repositories using Git Submodules and Git Subtrees, and customize developer productivity with global configurations, `.gitattributes`, custom diff drivers, and shell aliases.

## Learning Objectives

- Author automated Bash/Python client-side Git hooks for linting, secret scanning, and commit message validation.
- Link nested repositories cleanly using `git submodule` (`init`, `update`, recursive clones) and contrast with `git subtree`.
- Configure `.gitattributes` for binary handling, line-ending normalization (`text=auto`), and custom diff algorithms.
- Build powerful Git CLI aliases and global environment configurations for high-speed workflow execution.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Client-Side-and-Server-Side-Git-Hooks.md](01-Client-Side-and-Server-Side-Git-Hooks.md) | `pre-commit`, `commit-msg`, `pre-push`, `pre-receive`, automated Husky/pre-commit tools | 1 day |
| [02-Git-Submodules-and-Subtrees.md](02-Git-Submodules-and-Subtrees.md) | `.gitmodules`, submodule commit pointer tracking, `git submodule update`, `git subtree` | 1 day |
| [03-Git-Config-Aliases-and-Attributes.md](03-Git-Config-Aliases-and-Attributes.md) | `.gitattributes` (CRLF normalization, diff drivers), global `.gitconfig`, aliases | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: GitHub Collaboration, Security, and Enterprise Workflows](../Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/README.md)
