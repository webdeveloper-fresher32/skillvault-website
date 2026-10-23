# Phase 12: Self-Hosted Runners and Enterprise Governance

## What You'll Learn

Every workflow so far ran on a GitHub-hosted runner — a clean, disposable VM GitHub provisions and destroys per job. This phase covers what happens once that stops being enough: standing up your own runner for custom hardware, internal network access, or cost at scale, and accepting the security responsibility that comes with owning that machine. It then covers organizing and restricting a fleet of self-hosted runners with labels and runner groups, and closes with the org- and enterprise-level governance that scales security and consistency across every repository in an organization — an allow-list on which actions and reusable workflows are even permitted, and a centrally-owned reusable CI/CD workflow teams call into instead of reinventing their own.

## Learning Objectives

- Understand when and how to run self-hosted runners safely, including the registration flow (`config.sh` / `run.sh`) and the security responsibility shift from GitHub-hosted's ephemeral clean VM to a machine you now own and must patch and isolate yourself
- Use custom labels to target self-hosted runners with specific capabilities, and use runner groups to control which repositories or workflows are allowed to schedule jobs on a given set of runners
- Apply org-level governance to restrict which actions and reusable workflows repositories are allowed to use, and centralize a shared CI/CD reusable workflow so individual teams don't reinvent (and potentially misconfigure) their own

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Setting-Up-Self-Hosted-Runners.md](01-Setting-Up-Self-Hosted-Runners.md) | Why self-hosted runners exist (custom hardware, internal network access, cost at scale), the runner registration flow (`config.sh --url ... --token ...`, `run.sh`), the security responsibility shift from GitHub-hosted's ephemeral VM to a machine you own | 1 day |
| [02-Runner-Groups-and-Labels.md](02-Runner-Groups-and-Labels.md) | Custom labels for targeting specific runner capabilities (`runs-on: [self-hosted, linux, gpu]`), runner groups for org/enterprise-level access control over which repos can use a set of runners | 1 day |
| [03-Org-Level-Reusable-Workflow-Governance.md](03-Org-Level-Reusable-Workflow-Governance.md) | Repository rulesets that require workflows to pass, allow-listing which actions/reusable workflows repos may use as a supply-chain control, centralizing a shared CI/CD reusable workflow across teams | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 13: Production Best Practices and Interview Prep](../Phase-13-Production-Best-Practices-and-Interview-Prep/README.md)
