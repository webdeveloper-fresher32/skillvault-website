# Full CI/CD Pipeline — Test, Build, Push, Deploy with Approval

## Problem Statement

A Node.js application needs a single workflow that covers its entire path to production:

1. On every push and pull request against `main`, run the test suite.
2. On every push to `main` (i.e. after a PR has merged), build a Docker image from the repository and push it to GitHub Container Registry (GHCR), tagged with both the commit SHA and `latest`.
3. Deploy that image to a `production` Environment — but only after a required reviewer has explicitly approved the deployment, not the instant the image is pushed.

None of Phase 9's test pipeline, Phase 10's registry build/push, or Phase 10's environment-gated approval covers all three steps alone — each phase lesson built exactly one link in this chain. This project wires all three into one workflow, in the order a real release actually has to happen: a deploy is worthless if it ships untested code, an approval gate is worthless if there's no specific, traceable image for the approver to be approving, and neither matters if the pipeline never reaches the deploy step at all.

## Approach Discussion

The three jobs have a strict dependency order, and that order is exactly what `needs:` expresses:

- **`test`** runs Phase 9, Lesson 1's pattern unchanged: checkout, `actions/setup-node` with a pinned version and `cache: npm`, `npm ci`, `npm test`. It runs on both `push` and `pull_request` against `main`, because a PR that never merges still deserves to know whether it broke the suite — but it has no reason to touch Docker or any deploy credential at all.
- **`build-and-push`** runs Phase 10, Lesson 1's pattern: `docker/login-action` against `ghcr.io` using `secrets.GITHUB_TOKEN`, then `docker/build-push-action` tagging the image with both `${{ github.sha }}` (the permanent, traceable tag) and `latest` (the moving convenience tag), with `cache-from`/`cache-to` set to `type=gha` so unchanged dependency layers aren't rebuilt from scratch every run. It **`needs: test`**, so a build never even starts on top of code that failed its own test suite, and it's additionally guarded with `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` — a pull request should be tested, but it has no business pushing an image to the registry before it's even merged.
- **`deploy`** runs Phase 10, Lesson 3's pattern: it declares `environment: production`, so GitHub Actions pauses the job — before its steps run and before it can fetch `production`'s Environment-scoped secrets — until a listed required reviewer approves. It **`needs: build-and-push`**, reading the exact SHA tag that job just pushed via `needs.build-and-push.outputs.image-tag`, so the human clicking "approve" is approving deployment of the *specific image this run just built and tested*, not a floating `latest` that could resolve to something else by the time the approval actually lands.

The `needs` chain is what makes the combination meaningful rather than cosmetic: without it, nothing would stop `build-and-push` from running on code that never passed `test`, or `deploy` from running before an image the approver is meant to be reviewing even exists.

## Solution

```yaml
name: Full CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

concurrency:
  group: ci-cd-${{ github.ref }}
  cancel-in-progress: true

env:
  IMAGE_NAME: ghcr.io/${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.11.1"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.compute-tag.outputs.image-tag }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Compute image tag
        id: compute-tag
        run: echo "image-tag=${{ env.IMAGE_NAME }}:${{ github.sha }}" >> "$GITHUB_OUTPUT"

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
            ${{ steps.compute-tag.outputs.image-tag }}
            ${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production   # required reviewers configured — pauses here for approval
    steps:
      - name: Deploy image to production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # production's own Environment-scoped value
        run: |
          kubectl set image deployment/my-app my-app=${{ needs.build-and-push.outputs.image-tag }}
          kubectl rollout status deployment/my-app --timeout=120s
```

This YAML was validated with:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < full-ci-cd-pipeline.yml
```

and loads cleanly as a single well-formed document.

Walking through the chain: `test` runs on every push and pull request against `main`, matching Phase 9's pattern exactly — it never touches Docker credentials or `production` secrets, so a PR from an external contributor can safely run it without any elevated access. `build-and-push` names `needs: test` and an `if:` that restricts it to pushes on `main`, so a PR run stops at `test` and never reaches the registry step at all. Its `outputs.image-tag` publishes the exact SHA-tagged image reference so `deploy` doesn't have to re-derive it or fall back to `latest`. `deploy` declares `environment: production` with no `if:` restricting *when* it can run beyond already needing `build-and-push` — the approval gate itself is what controls timing, exactly as Phase 10, Lesson 3 describes: the job's steps don't execute and `production`'s secrets aren't fetched until a required reviewer approves. The `kubectl set image` line references `needs.build-and-push.outputs.image-tag` rather than a bare `latest`, so the reviewer approving this run is approving deployment of precisely the image `build-and-push` just built and pushed.

## Trade-offs and Considerations

- **The approval gate adds latency, and that is the correct trade for a production deploy.** A `deploy` job with `environment: production` can sit pending for minutes or hours waiting on a human, whereas an ungated deploy job would proceed the instant `build-and-push` finished. That latency is the entire point (Phase 10, Lesson 3): the cost of a bad production deploy — real user impact — is high enough that trading pipeline speed for a deliberate human checkpoint is worth it. A staging-only variant of this same workflow would reasonably skip the `environment:` gate (or use one with no required reviewers) precisely because a bad staging deploy costs far less.
- **Restricting `build-and-push` to `push` events on `main`, rather than running it on every PR too, controls both cost and risk.** Building and pushing an image for every PR would burn registry storage and runner-minutes on code that may never merge, and it would mean `packages: write` credentials are exercised on branches an external contributor could open a PR from. Running `test` on PRs while deferring the image build to post-merge keeps the expensive, credentialed step reserved for code that has already been reviewed and merged.
- **`cache-from`/`cache-to: type=gha` trades some GitHub Actions cache storage for materially faster rebuilds** when only application code (not the base image or dependency-install layers) changed — the alternative, no caching, means every `build-and-push` run rebuilds every layer from scratch, which is slower and, at scale, burns more billable runner-minutes for identical unchanged layers.
- **`concurrency: cancel-in-progress: true` on the whole workflow is a reasonable default for `test`, but it is a real risk for `deploy`.** If a second push lands on `main` while an earlier run's `deploy` job is sitting pending on approval, `cancel-in-progress: true` would cancel that pending deploy — which is arguably fine (an approver hasn't acted yet) but would be dangerous if it canceled a deploy *mid-rollout* instead. A team running this in production should scope concurrency more precisely — for example, a separate `concurrency` group scoped only to the `test`/`build-and-push` jobs, leaving `deploy` either ungrouped or grouped so an in-flight rollout is never silently cancelled by a newer push.
- **Reading the image tag from `build-and-push`'s output, instead of having `deploy` re-derive `${{ github.sha }}` itself, is a small maintainability choice with a real payoff.** Both would resolve to the same value in this workflow as written, but wiring it through `needs.build-and-push.outputs.image-tag` means `deploy` never has to be kept in sync by hand if the tagging scheme in `build-and-push` changes later — it just reads whatever `build-and-push` actually published.
