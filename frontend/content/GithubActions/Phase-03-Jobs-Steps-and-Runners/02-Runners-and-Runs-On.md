# Runners and runs-on

Every example since Phase 1 has quietly used `runs-on: ubuntu-latest` without asking what that line actually does. `runs-on` tells GitHub which machine — which *runner* — should execute a job's steps, and `ubuntu-latest`, `windows-latest`, and `macos-latest` are different operating systems with different pre-installed tooling, different default shells, and different performance/cost characteristics.

## 1. GitHub-Hosted Runner Options

`runs-on` is read per job, not once per workflow — each job in the `jobs` map declares its own `runs-on`, so a single workflow can mix runner types across jobs (e.g., `build` on Ubuntu, a platform-specific test job on Windows). A single string value is matched against GitHub's hosted runner labels: `ubuntu-latest`, `windows-latest`, `macos-latest`, each mapping to a specific, versioned virtual machine image that GitHub updates over time. Pinned variants like `ubuntu-22.04` or `windows-2022` map to a specific OS version instead of whatever "latest" currently resolves to.

| Label | OS family | Default shell |
|---|---|---|
| `ubuntu-latest` | Linux (Ubuntu) | `bash` |
| `macos-latest` | macOS | `bash` |
| `windows-latest` | Windows | `pwsh` (PowerShell) |
| `ubuntu-22.04` / `windows-2022` | Pinned OS version | Same as their `-latest` family |

GitHub provisions a fresh virtual machine matching the chosen label, pre-loaded with a documented (and periodically updated) image containing common language runtimes, package managers, and CLI tools. The VM is destroyed after the job finishes — nothing about the machine's state, installed extras, or filesystem persists to the next run.

`runs-on` isn't really "pick an OS" — it's "pick a runner matching this label (or these labels)." The same mechanism is also how self-hosted runners are targeted (covered fully in a later phase): `runs-on` can take a list of labels, e.g. `runs-on: [self-hosted, linux, x64]`, which GitHub treats as "match a runner that has *all* of these labels" — a self-hosted runner registers itself with a set of labels it will accept jobs for.

## 2. OS/Tooling Differences Across Runners

```yaml
name: Cross-Platform Smoke Test

on:
  push:
    branches:
      - main

jobs:
  test-ubuntu:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4
      - name: Show shell and platform info
        run: |
          echo "Default shell on this runner is bash"
          uname -a

  test-windows:
    runs-on: windows-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4
      - name: Show shell and platform info
        run: |
          Write-Host "Default shell on this runner is PowerShell (pwsh)"
          $PSVersionTable
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < cross-platform.yml
```

`test-ubuntu` and `test-windows` run the "same" workflow intent — print diagnostic info — but each `run:` step's body had to be written in the shell that runner defaults to. Pasting the Ubuntu job's bash body into the Windows job unmodified would fail, because `windows-latest` does not default to interpreting `run:` steps as bash.

## 3. Windows' Default Shell Gotcha

Each job's steps execute inside its provisioned VM, and — critically — each `run:` step is handed to a default shell the runner OS considers native: `bash` on `ubuntu-latest` and `macos-latest`, but `pwsh` (PowerShell) on `windows-latest`, unless a step explicitly overrides its shell with a `shell:` key. A `run:` step written in bash syntax (`$VAR`, `if [ ]`, Unix-style paths) on a job with `runs-on: windows-latest` will fail or behave unexpectedly, because it's being interpreted as PowerShell. To force bash behavior on a Windows job (e.g., for a shared cross-platform script), you must explicitly set `shell: bash` on that step — it is not inferred from the fact that a step "looks like" bash.

## Comparison

| Comparison | Detail |
|---|---|
| `ubuntu-latest` vs. `windows-latest` vs. `macos-latest` | All valid hosted labels, provisioned the same way conceptually, but differ in pre-installed tooling versions, default shell, filesystem path conventions, and per-minute cost multiplier |
| `-latest` label vs. pinned label (`ubuntu-22.04`, `windows-2022`) | `-latest` moves forward to a new image periodically (sometimes changing tool versions); pinned labels fix the OS version and image contents until you change the label yourself |
| Single-string `runs-on` vs. list `runs-on` | Single string matches one hosted label; list (`[self-hosted, linux, x64]`) requires a runner carrying *all* listed labels — the self-hosted runner mechanism |
| Phase 1's treatment vs. this lesson | Phase 1 introduced `runs-on: ubuntu-latest` as "which runner OS to use" with no alternatives explored; here the choice of value changes what a workflow can safely assume about its environment |

## Common Mistakes

- **Assuming pre-installed tool versions are identical across `ubuntu-latest`, `windows-latest`, and `macos-latest`** — they are not, and GitHub updates each image's tool versions on its own schedule, independent of the others; a workflow relying on "whatever Node/Python/Git version happens to be on the image" can silently break when an image updates, which is why pinning exact tool versions explicitly (via a setup action's `version` input) is safer than trusting the ambient "latest" version on the runner.
- **Writing a `run:` step in bash syntax on a job with `runs-on: windows-latest`**, not realizing the default shell there is PowerShell — a script full of `$VAR`, `if [ ]`, or Unix-style paths will fail or behave unexpectedly, because it's being interpreted as PowerShell, not bash.
- **Not explicitly setting `shell: bash` on a Windows job when bash behavior is actually required** — GitHub Actions does support this override, but it must be stated; it isn't inferred from the step's content.
- **Treating `-latest` labels as permanently fixed** — building automation or documentation that assumes `ubuntu-latest` will always mean today's specific Ubuntu version, when GitHub periodically retires old images and moves the label forward.
- **Reaching for a `runs-on` label list before understanding it requires a registered self-hosted runner** — writing `runs-on: [self-hosted, linux, x64]` in a repository with no such runner registered leaves the job queued indefinitely, waiting for a machine that will never claim it.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Create the two-job cross-platform workflow above. Push it and confirm both jobs succeed, then intentionally paste the Ubuntu job's `uname -a` line into the Windows job's `run:` block and observe the failure.
2. **(Requires a GitHub repo)** Add a step to the Windows job with `shell: bash` and a bash-only command (e.g., `echo $BASH_VERSION`). Confirm it runs successfully despite the job's default shell being PowerShell.
3. **(Requires a GitHub repo)** Add a step to any job that prints a tool's version (e.g., `node --version`). Compare the output across `ubuntu-latest`, `macos-latest`, and `windows-latest` runs to see the pre-installed version differences firsthand.
4. **(Paper exercise, no execution needed)** Given `runs-on: [self-hosted, linux, x64]` in a repo with no self-hosted runner registered, describe what the job's status will show in the Actions UI and why.
5. **(Requires a GitHub repo)** Pin a job to `ubuntu-22.04` instead of `ubuntu-latest`, run it, and confirm the workflow still succeeds — noting that the OS version is now fixed regardless of what `ubuntu-latest` resolves to in the future.

## Interview Q&A

**Q: A teammate's workflow step works fine on Ubuntu but fails on Windows with a syntax error in the `run:` block. What's the most likely cause?**
A: The default shell difference — bash syntax is being handed to PowerShell's interpreter on `windows-latest`.

**Q: Does anything installed by one job's steps carry over to the next job, or the next run, on a GitHub-hosted runner?**
A: No — each job gets a freshly provisioned, ephemeral VM from the documented base image; extra tool installation must happen again every run (or come from a self-hosted runner with persistent state).

**Q: How do you force a step to run under bash on a `windows-latest` job?**
A: Explicitly set `shell: bash` on that step — it is never inferred automatically.

**Q: What's the difference between `ubuntu-latest` and `ubuntu-22.04`?**
A: `ubuntu-latest` is a moving alias GitHub periodically points at a newer image; `ubuntu-22.04` pins the OS version until you change the label yourself.

**Q: What does `runs-on: [self-hosted, linux, x64]` actually mean?**
A: Match a runner that carries *all* of these labels — the mechanism self-hosted runners register against, not a special hosted-runner keyword.
