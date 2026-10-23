# Container Registry Build and Push

Phase 9 ended with CI's job fully done: code checked out, dependencies installed, tests run, a required status check reported. Continuous Deployment picks up from there, and for most containerized projects its very first step is the same regardless of what comes after: turn the repository's code into a Docker image, and get that image somewhere a deployment target can pull it from. Doing that reliably means solving two problems together — **authentication** (proving the workflow is allowed to push into the registry) and **tagging** (deciding what name the pushed image will be pullable by later) — and wiring in caching so builds don't get slower every run.

## 1. Building and Pushing a Docker Image in CI

A `docker build` run on a laptop produces an image that lives only on that laptop; nothing downstream — not a Kubernetes cluster, not a cloud provider's container service — can run it until it exists in a registry both the CI runner and the deploy target can reach. The end-to-end flow is: check out code, authenticate to the registry, compute tags, then build and push the image.

```
checkout code → authenticate to registry → compute tags (SHA + latest)
    → build image → push image (registry now holds one image, two tags)
```

## 2. Authenticating to GHCR

For GitHub Container Registry (GHCR), authentication means logging in with `docker/login-action` before attempting any push, using `registry: ghcr.io`, `username: ${{ github.actor }}` (the user or bot that triggered the run), and `password: ${{ secrets.GITHUB_TOKEN }}` — the token GitHub automatically provisions for every workflow run.

```yaml
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_TOKEN` is scoped per-run (Phase 4 covered secrets in general) and needs a `packages: write` permission for this push to succeed — Phase 11's permission-scoping lesson covers this in depth. Get authentication wrong and the push fails, sometimes with a confusing permission error rather than an obvious "you're not logged in."

## 3. Authenticating to Third-Party Registries

For Docker Hub or another third-party registry, the same `docker/login-action` is used, but with `registry:` pointed at that registry's hostname (or omitted for Docker Hub's default) and `username`/`password` sourced from repository secrets holding that registry's own credentials — never the GitHub-provided token, which only GHCR recognizes.

| Registry | `registry:` value | Credential source |
|---|---|---|
| GHCR | `ghcr.io` | `secrets.GITHUB_TOKEN` (auto-provisioned) |
| Docker Hub | omitted (default) | repository secrets for a Docker Hub username/access token |
| Other third-party registry | that registry's hostname | repository secrets for that registry's own credentials |

## 4. Tagging Strategy (SHA + `latest`)

A build typically needs at least two tags on the same image: one permanent, traceable tag — the commit SHA (`${{ github.sha }}`) — and one moving, convenience tag — `latest`, or a branch-name-derived tag for workflows that build on multiple branches. Both point at the exact same image; they are two labels on one artifact, not two separate builds.

```yaml
tags: |
  ${{ env.IMAGE_NAME }}:${{ github.sha }}
  ${{ env.IMAGE_NAME }}:latest
```

Get tagging wrong — pushing only a floating tag like `latest` — and the registry silently overwrites the previous image with no way to tell what code produced today's `latest` versus yesterday's, and no way to roll back to a specific prior build once something breaks.

## 5. Layer Caching for Faster Builds

`docker/build-push-action` wraps both the build and push into one step, accepting a `tags:` list and, for caching, `cache-from`/`cache-to` inputs that reuse layers from a previous build — commonly backed by GitHub Actions' own cache via `type=gha` — so unchanged layers, typically dependency-installation layers, don't get rebuilt from scratch on every run.

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

## 6. Full Example: Build, Tag, and Push

A workflow that builds a Docker image and pushes it to GHCR, tagged with both the commit SHA and `latest`, with layer caching enabled:

```yaml
name: Build and Push to GHCR

on:
  push:
    branches:
      - main

env:
  IMAGE_NAME: ghcr.io/${{ github.repository }}

permissions:
  contents: read
  packages: write   # required for the push step below to succeed

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`permissions: packages: write` grants this run's `GITHUB_TOKEN` the scope it needs to push to GHCR — without it, the login or push step fails with a permission error rather than an obvious "not logged in." `docker/login-action` authenticates against `ghcr.io` using that same token as the password, with `github.actor` as the username — no separate registry account or long-lived credential needed for GHCR specifically. `docker/build-push-action` then builds from the repository root (`context: .`) and, in one step, pushes the resulting image under two tags: `${{ github.sha }}`, a permanent pointer to exactly this build, and `latest`, a moving pointer that now resolves to this same image until the next push updates it. `cache-from`/`cache-to` with `type=gha` store and reuse build layers via GitHub Actions' own cache backend, so a rebuild with no `Dockerfile` changes reuses cached layers instead of re-executing them. A deployment step (Phase 10, Lesson 2) can pull the image by the specific SHA tag for a precise, auditable deploy, or by `latest`/the branch tag for a "just get me the newest build" pull — the choice belongs to the deploy step, not to this build-and-push workflow.

## Comparison

| Approach | What it does | Tradeoff |
|---|---|---|
| `docker/build-push-action` | Combines build, tag, and push into one step with built-in caching inputs | Requires no hand-rolled caching/tagging logic, but adds an external action dependency |
| Plain `docker build` + `docker push` `run:` steps | Same result via the Docker CLI directly | Works identically under the hood, but caching and multi-tag logic must be written out explicitly |
| GHCR authentication | Accepts the workflow's own `GITHUB_TOKEN` as password, only needs `packages: write` | No secret to create or rotate, but only works against `ghcr.io` |
| Docker Hub / other registry authentication | Requires a username and access token/password stored as repository (or Environment) secrets | Works with any registry, but the credential must be created and rotated independently |
| SHA tag | Immutable in practice — always resolves to the exact build that produced it | Right choice for precise rollback, but not convenient to reference by hand |
| Moving tag (`latest`/branch name) | Convenient for "give me whatever's current" | Overwritten by every subsequent push — cannot answer "which commit produced the image currently running" |

## Common Mistakes

- **Pushing only a `latest` (or only a branch-name) tag and never a commit-SHA tag.** Every new push overwrites the same tag, so there is no way to identify which commit produced a given running image, and no way to roll a deployment back to a specific prior build — only "whatever the previous push happened to be," which is not the same thing once several pushes have happened since.
- **Attempting to push before authenticating, or authenticating with the wrong credential type.** A `docker/build-push-action` (or plain `docker push`) run without a preceding successful login step fails outright; using `secrets.GITHUB_TOKEN` against a non-GHCR registry (or a third-party registry's token against `ghcr.io`) fails the same way, because neither registry recognizes the other's credential.
- **Forgetting the `packages: write` permission when pushing to GHCR.** The login step can succeed while the push still fails with a permission-denied-style error, because `GITHUB_TOKEN`'s default permissions (or a workflow-level `permissions:` block that omits `packages`) don't include write access to the package registry — Phase 11's permission-scoping lesson covers this in depth.
- **Treating layer caching as optional polish rather than wiring it correctly.** Without `cache-from`/`cache-to` (or with a cache key that never actually matches a prior run), every build re-executes every layer from scratch, including slow dependency-install steps that a correctly configured cache would have reused.
- **Hardcoding a registry username/password directly in the workflow file** instead of referencing `secrets.*` — this exposes the credential to anyone with read access to the repository, identically to any other secret misuse covered in Phase 4.

## Hands-On Exercises

1. Save the full example workflow from Section 6 as `.github/workflows/build-push.yml` and validate it with `actionlint .github/workflows/build-push.yml` (or `yamllint` if `actionlint` isn't installed) — confirm no errors are reported.
2. Run `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/build-push.yml')))"` to confirm the file parses as valid YAML.
3. Temporarily remove the `packages: write` line from the `permissions:` block, push to a test repository with GHCR configured, and observe the push step fail with a permission error even though the login step succeeded — then restore the line and confirm the push succeeds.
4. In the `tags:` list, delete the `${{ github.sha }}` line so only `latest` remains, push twice in a row from two different commits, then run `docker pull ghcr.io/<image>:latest` and confirm it always resolves to the second commit's image — there is no tag left pointing at the first commit's build, demonstrating why a SHA tag is needed for rollback.
5. Add `cache-from: type=gha` / `cache-to: type=gha,mode=max` to a workflow with no prior cache entries, run it twice, and compare the build step's duration on the second run against the first via `gh run view --log`.

## Interview Q&A

**Q: Why tag a pushed image with both a commit SHA and `latest`, instead of just `latest`?**
A: `latest` is a moving pointer overwritten by every push — useful for convenience but useless for identifying or rolling back to a specific build. The SHA tag is what actually makes a given image traceable to the exact commit that produced it, and rollback-able later.

**Q: A workflow's push to GHCR fails with a permission error even though the login step reported success — what's the likely cause?**
A: A missing `packages: write` grant in the workflow's `permissions:` block. GHCR authentication succeeding doesn't guarantee the token has write access to the registry — the login and the push permission are two separate checks.

**Q: Why can't a Docker Hub access token be used to authenticate against `ghcr.io`, or vice versa?**
A: Each registry only recognizes its own credential type. `secrets.GITHUB_TOKEN` is meaningful only to GHCR; Docker Hub requires its own username and access token stored as a repository secret. Mixing them fails the login step outright.

**Q: What happens if layer caching is misconfigured or omitted entirely?**
A: Every build re-executes every layer from scratch, including slow dependency-install steps, because there's no `cache-from` reference (or the cache key never matches a prior run) for Docker to reuse.
