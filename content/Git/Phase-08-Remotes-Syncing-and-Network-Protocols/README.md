# Phase 8: Remotes, Syncing, and Network Protocols

## What You'll Learn

Master distributed synchronization mechanics and Git network protocols: inspect remote tracking branches (`refs/remotes/origin/*`), understand upstream tracking configurations (`-u` / `--set-upstream-to`), dissect the operational differences between `git fetch`, `git pull`, and `git pull --rebase`, enforce safe publishing with `--force-with-lease`, and configure secure SSH key pairs and authentication protocols.

## Learning Objectives

- Explain how Git mirrors remote state in read-only tracking branches (`origin/main`).
- Configure explicit upstream tracking branches and analyze tracking telemetry with `git branch -vv`.
- Compare non-destructive `git fetch` against `git pull` and configure `pull.rebase` defaults.
- Set up enterprise SSH key authentication with Ed25519 keys and manage multiple GitHub remote identities via SSH config.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Remote-Tracking-Branches-and-Upstream.md](01-Remote-Tracking-Branches-and-Upstream.md) | Remote tracking branches (`origin/*`), `git remote`, upstream tracking (`-u`), `git branch -vv` | 1 day |
| [02-Fetch-vs-Pull-vs-Pull-Rebase.md](02-Fetch-vs-Pull-vs-Pull-Rebase.md) | `git fetch` vs `git pull` vs `git pull --rebase`, remote ref specs, auto-pruning | 1 day |
| [03-Push-Force-With-Lease-and-SSH-Auth.md](03-Push-Force-With-Lease-and-SSH-Auth.md) | Push mechanics, `--force-with-lease`, SSH vs HTTPS, Ed25519 setup, `~/.ssh/config` | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Git Hooks, Submodules, and Configuration](../Phase-09-Git-Hooks-Submodules-and-Configuration/README.md)
