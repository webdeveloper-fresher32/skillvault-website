# Upload and Download Artifacts

Phase 4 covered passing small runtime values between jobs via `needs.<job>.outputs`, but that channel is capped in size and meant for a handful of characters, not a compiled binary or a directory of test reports. Once a workflow run finishes, everything on its runners' disks is gone forever, too — there's no runner left holding the file for later inspection. `actions/upload-artifact` and `actions/download-artifact` solve both problems: a named, file-based bundle stored on GitHub's own infrastructure (not any runner's disk) that another job, or a human in the Actions UI, can retrieve after the uploading job's runner is destroyed.

## 1. Uploading Artifacts

A step calls `actions/upload-artifact@v4`, pointing at a file or directory on the current runner's disk and giving the bundle a `name:`. The action ships that path's contents to GitHub's artifact storage, associated with the current workflow run — not with the runner, which is torn down once the job ends.

```yaml
- name: Compile the binary
  run: |
    mkdir -p dist
    echo '#!/bin/sh' > dist/app.bin
    echo 'echo "Hello from the compiled app"' >> dist/app.bin
    chmod +x dist/app.bin

- name: Upload compiled binary as an artifact
  uses: actions/upload-artifact@v4
  with:
    name: app-binary
    path: dist/app.bin
    retention-days: 14
```

## 2. Downloading Artifacts in Another Job

A later job that declares `needs: [build]` runs `actions/download-artifact@v4`, naming the same artifact. GitHub Actions fetches it from storage and writes it onto that job's runner disk — a different machine from the one that uploaded it. From that point on, the downloading job's steps read the file as if it had always been local.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Compile the binary
        run: |
          mkdir -p dist
          echo '#!/bin/sh' > dist/app.bin
          echo 'echo "Hello from the compiled app"' >> dist/app.bin
          chmod +x dist/app.bin
      - uses: actions/upload-artifact@v4
        with:
          name: app-binary
          path: dist/app.bin
          retention-days: 14

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download compiled binary
        uses: actions/download-artifact@v4
        with:
          name: app-binary
          path: dist
      - name: Run the downloaded binary
        run: |
          chmod +x dist/app.bin
          ./dist/app.bin
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

`build` compiles `dist/app.bin`, uploads it as `app-binary` with an explicit 14-day retention window, then its runner is destroyed. `deploy` declares `needs: build`, so it only starts once `build` finishes and the artifact exists; `download-artifact` fetches `app-binary` onto `deploy`'s own runner and writes it to `dist/app.bin` there. Note the `chmod +x` reapplied after download — executable permissions aren't always guaranteed to survive the upload/download round trip, depending on how the artifact was packed and the runner OS.

Without `needs: build` on the `deploy` job, GitHub Actions has no guarantee the upload finished — or ran at all — before the download attempts to fetch it, and the download step fails or races.

## 3. Artifacts vs. Job Outputs (When to Use Which)

Steps within the same job already share one runner's filesystem directly — a file written in step 2 is already sitting on disk for step 3 to read, no upload/download needed. Artifacts only become relevant once a file needs to cross a job boundary or survive past the run itself. Caching (next lesson) looks similar on the surface — files that outlive a single job — but serves a different intent: caching reuses *input* from a previous run to skip setup work, while artifacts persist this run's actual *output* for consumption once.

## 4. Default Retention Period

Every artifact is subject to a retention period: a default number of days after which GitHub automatically deletes it, whether or not any job ever downloaded it. The default is set per repository and applies unless overridden. `retention-days:` on the `upload-artifact` step shortens or lengthens that window for a specific upload, up to the repository's configured maximum — as used above (`retention-days: 14`) to guarantee this particular binary outlives whatever the repo's default happens to be.

```
Upload day 0 ──────────────► Default retention window ──────────────► Auto-deleted
                 (no retention-days set: repo default applies)

Upload day 0 ── retention-days: 14 ──► kept 14 days regardless of repo default ──► Auto-deleted
```

## Comparison

| | Job outputs (`needs.<job>.outputs`) | Artifacts (`upload-`/`download-artifact`) |
|---|---|---|
| Carries | A short string (version tag, computed flag) | Real files or directories (binaries, reports, logs) |
| Size limit | Strict, small | No meaningful ceiling for typical build output |
| Resolved via | Expression evaluation (`${{ }}`) | Upload to storage, download onto a different runner's disk |
| Survives past the run? | No — exists only as long as workflow-run data is retained for expression lookups | Yes — visible in the Actions UI and downloadable by a human after the run ends |
| Wrong use | Base64-encoding a large file into an output string | Uploading a file just to pass it between two steps in the *same* job |

## Common Mistakes

- **Uploading an artifact just to pass a file between two steps in the same job.** Unnecessary — same-job steps already share the runner's filesystem directly. Reach for artifacts only when the file needs to cross a job boundary or survive past the run.
- **Forgetting artifacts have a default retention period and not overriding it.** A release binary someone expects to fetch months later silently disappears once the default window elapses, unless `retention-days:` was set explicitly on upload.
- **Using `download-artifact` in a job that doesn't declare `needs:` on the uploading job.** Without `needs`, GitHub Actions doesn't guarantee the upload finished before the download attempts to fetch it, and the step fails or races.
- **Assuming a downloaded artifact preserves file permissions like the executable bit automatically.** Depending on how the artifact was packed and the runner OS, an executable may need `chmod +x` reapplied after download.
- **Trying to move a large file through job outputs by base64-encoding it into a string.** Outputs are meant for short values; stuffing megabytes of encoded binary into `needs.<job>.outputs` fights the mechanism's size limits — that's exactly the case artifacts exist for.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 2 example (`build` uploads `app-binary`, `deploy` downloads and runs it) exactly as written, push it, and confirm `deploy`'s log shows `Hello from the compiled app`.
2. **(Requires a GitHub repo)** Remove `needs: build` from the `deploy` job in the example above, push, and observe that `deploy` either fails to find the artifact or races against `build` — confirming why `needs:` is required, not optional, when downloading.
3. **(Requires a GitHub repo)** Set `retention-days: 1` on the upload step, run the workflow, then check the artifact's listed expiration in the Actions UI run summary — confirm it reflects the 1-day override rather than the repository default.
4. **(Paper exercise)** A `test` job produces a 200-line JUnit XML report and a `PASS`/`FAIL` string. Which mechanism carries the report, and which carries the string? Justify each choice.
5. **(Requires a GitHub repo)** In the `deploy` job's "Run the downloaded binary" step, remove the `chmod +x` line and rerun. Confirm the step fails with a permission error, then restore the line and confirm it passes — demonstrating that executable bits aren't guaranteed to survive the round trip.

## Interview Q&A

**Q: Your `build` job produces a compiled binary your `deploy` job needs. How do you get it there?**
A: `upload-artifact` in `build`, `download-artifact` in a `deploy` job that declares `needs: build`. The file goes to GitHub's own storage, not either runner's disk.

**Q: Nobody downloads that artifact for two months — is it still there?**
A: Only if `retention-days:` was set explicitly on upload to cover that window. Otherwise the repository's default retention period deletes it automatically, regardless of whether it was ever downloaded.

**Q: Why not just write a file in one step and read it in the next, instead of using artifacts?**
A: Within a single job, that already works — steps share the runner's filesystem directly. Artifacts are pure overhead there; they're only needed once a file must cross a job boundary or survive past the run.

**Q: What breaks if `download-artifact` runs in a job without `needs:` on the uploading job?**
A: No ordering guarantee. GitHub Actions doesn't ensure the upload completed — or ran — before the download attempts to fetch it, so the step can fail or race.

**Q: Your build output has a large binary and also a short version tag. Do both go through artifacts?**
A: No — the version tag belongs in `needs.<job>.outputs` (a short string other jobs' expressions can read), while the binary belongs in an artifact (a real file with no practical size ceiling).
