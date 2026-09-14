# SLSA and Supply-Chain Attestation

Every prior lesson in this phase hardens something *upstream* of a build — the token a workflow runs with, the credentials it authenticates as, the third-party code it trusts. None of them answer a different question a consumer of a finished artifact has to ask: once a binary, container image, or package has been built and published, how does anyone downstream know it actually came from the workflow and repository it claims to, rather than being swapped or tampered with somewhere between the build finishing and the artifact reaching them? A build log says a workflow ran; it says nothing verifiable about the exact artifact a consumer is about to pull, days or months later, from a registry or release page. SLSA (Supply-chain Levels for Software Artifacts) is a framework for closing that gap with *provenance* — verifiable, signed metadata describing how an artifact was built, which a consumer can check against the artifact in hand before trusting it.

## 1. What SLSA Provenance Actually Verifies

A workflow job builds an artifact — a binary, a container image, a package — the same way any CI build in this course has (Phase 9's build/test patterns). Provenance is a signed statement, cryptographically bound to the exact artifact, saying "this specific artifact was produced by this specific workflow run, from this specific commit, at this specific repository." A verification pass confirms exactly one thing: this artifact's bytes are the same bytes that this named workflow run, at this named repository and commit, produced — nothing about the artifact's digest has changed since that run finished.

```
Build produces artifact (binary / image / package)
        │
        ▼
actions/attest-build-provenance signs a statement:
  { artifact digest, source repo, commit SHA, workflow file, run ID }
        │
        ▼
Statement published to the repository's attestations
        │
        ▼
Consumer runs `gh attestation verify` against the artifact in hand
        │
        ▼
Confirms: origin + no tampering since build   (NOT: source quality)
```

## 2. `actions/attest-build-provenance`

The job requests attestation generation via `actions/attest-build-provenance`, pointing it at the built artifact (by file path, or by digest for a container image). This step requires two permissions: `id-token: write` (to request the OIDC identity token proving which workflow run this is — the same mechanism Lesson 2 covers for cloud authentication) and `attestations: write` (to publish the resulting attestation to the repository). GitHub then generates an in-toto/SLSA-formatted provenance statement recording the artifact's cryptographic digest, the source repository, the exact commit SHA, the workflow file and its triggering event, and the specific run that produced it — signs it using Sigstore-backed infrastructure, and publishes both the statement and its signature to the repository's attestations.

```yaml
name: Build and Attest

on:
  push:
    tags:
      - "v*"

permissions:
  id-token: write
  attestations: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # illustrative SHA — always verify against the action's actual release before use
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Build artifact
        run: |
          mkdir -p dist
          echo "build output" > dist/my-app-binary

      - name: Generate build provenance attestation
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: "dist/my-app-binary"

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: my-app-binary
          path: dist/my-app-binary
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`permissions` grants both `id-token: write` (to prove which workflow run this is) and `attestations: write` (to publish the resulting statement) — without either, the attestation step fails. `attest-build-provenance` runs after the build step and points at the exact file it just produced, so the signed provenance is bound to that specific artifact's digest.

## 3. Verifying an Attestation

A consumer, later, verifies the attestation against the artifact in hand — typically via the GitHub CLI, `gh attestation verify` — which checks the artifact's digest matches the one in the signed statement, and that the signature is valid and traces back to the claimed repository and workflow.

| Step | Who performs it | What it confirms |
|---|---|---|
| Generate | The build job, via `actions/attest-build-provenance` | Signs a statement binding the artifact's digest to this run |
| Publish | GitHub, automatically | Statement + signature stored against the artifact's digest |
| Verify | A downstream consumer, via `gh attestation verify` | Digest match + valid signature tracing to the claimed repo/workflow |

## 4. What Attestation Does NOT Cover

An intact attestation confirms *origin and integrity since build time*; it says nothing about whether the source code built was itself free of bugs or vulnerabilities. That is a separate concern addressed by separate practices — code review and dependency/vulnerability scanning — with a different threat model entirely. A tampered-after-build binary and a bug-riddled-but-untampered one are different problems, and attestation only ever speaks to the first.

## Comparison

| Practice | What it checks | What it does NOT check |
|---|---|---|
| Build-provenance attestation | Artifact origin (which run/repo/commit produced it) and that it hasn't changed since | Whether the source code is well-written, bug-free, or free of vulnerable dependencies |
| Source-code review | Whether the source itself is well-written and free of intentional/accidental bugs, before it's built | Whether the built artifact was tampered with after build |
| Dependency/vulnerability scanning | Known-vulnerable packages inside what gets built | Artifact origin or post-build tampering |
| SHA-pinned actions (Lesson 3) | Trusted *inputs* to a build (the third-party code a workflow runs) | The *output* artifact's integrity after the build finishes |

## Common Mistakes

- **Treating attestation as a "nice to have" rather than understanding its specific scope.** It answers one narrow question — did this artifact come from this claimed build, unmodified since — and is not a substitute for source review or dependency scanning, which answer entirely different questions about the same software.
- **Assuming attestation proves the source code is safe or bug-free.** A signed provenance statement says the artifact matches what a specific workflow run produced; it makes no claim about whether that workflow built good code or bad code.
- **Forgetting the `id-token: write` and `attestations: write` permissions.** Per Lesson 1's least-privilege default, neither is granted automatically — omitting either causes the attestation step to fail with a permissions error rather than silently skipping.
- **Generating attestation for a build artifact but never actually verifying it downstream.** An attestation that's created but never checked provides no real protection — the value only materializes when a consumer runs `gh attestation verify` and treats a failed check as a reason to stop.
- **Confusing artifact attestation with signing the release notes or tag** — attestation is bound to the artifact's own content digest, not to a Git tag or release description, which can be edited after the fact with no effect on the artifact's own signed provenance.

## Hands-On Exercises

1. Add the example workflow from Section 2 to a scratch repository, push a tag matching `v*`, and confirm via the Actions run summary that an attestation was generated for `dist/my-app-binary`.
2. Download the built artifact from the run and verify it with `gh attestation verify dist/my-app-binary --owner <your-org>`, confirming the CLI reports the repository and workflow that produced it.
3. Remove `attestations: write` from the `permissions:` block, re-run the workflow, and confirm the `attest-build-provenance` step fails with a permissions error rather than silently skipping.
4. Modify one byte of the downloaded artifact locally, then re-run `gh attestation verify` against the modified file and confirm verification fails due to a digest mismatch.
5. (Prerequisite: Lesson 3) Add a dependency-scanning step (e.g. `npm audit` or a SARIF-uploading scanner) to the same workflow, and write down which of the three questions — origin, post-build tampering, or known-vulnerable dependencies — each of `gh attestation verify`, the scan, and a manual code review would each answer for this build.

## Interview Q&A

**Q: What does a GitHub build-provenance attestation actually prove?**
A: That a specific artifact, identified by its cryptographic digest, was produced by a specific workflow run at a specific commit in a specific repository — origin and post-build integrity, nothing about the underlying code's quality or safety.

**Q: If a repository has attestation configured, does it still need dependency scanning and code review?**
A: Yes, unconditionally. The three practices address non-overlapping risks: attestation catches post-build tampering, dependency scanning catches known-vulnerable inputs, and code review catches bugs and unintentional flaws in the source itself. Dropping any one leaves that specific threat model uncovered no matter how well the other two are done.

**Q: What two permissions does `actions/attest-build-provenance` require, and why?**
A: `id-token: write`, to request the OIDC token proving which workflow run this is, and `attestations: write`, to publish the resulting statement to the repository. Missing either fails the step with a permissions error.

**Q: How does SHA-pinning (Lesson 3) relate to build-provenance attestation?**
A: They protect opposite ends of the pipeline — SHA-pinning protects the trusted *inputs* to a build (the third-party actions it runs), while attestation protects the *output*, proving the artifact wasn't altered after the build finished. A supply chain needs both.
