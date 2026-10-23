# Actions Cache and Dependency Caching

Every workflow so far starts from a completely clean runner: no dependencies installed, no download cache warmed up. That means `npm install`, `pip install`, or `mvn install` re-downloads the same packages on every run, even when the dependency list hasn't changed since five minutes ago. `actions/cache` breaks that cycle — it saves a directory at the end of a run and restores it at the start of a later one, keyed on something that changes only when the cached content should change, typically a hash of the lockfile.

## 1. How `actions/cache` Hit/Miss Works

A step calls `actions/cache@v4` with a `path:` (the directory to persist) and a `key:` — a string, typically built from `hashFiles()` over a lockfile, identifying exactly this cache's contents. On restore, the action computes the key's current value and looks for an exact match.

```yaml
- name: Cache npm dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-

- name: Install dependencies
  run: npm ci
```

```
restore step: compute key from runner.os + hashFiles(lockfile)
      │
      ├─ exact match found  → cache HIT  → path: populated before later steps run → no re-save at job end
      │
      └─ no exact match     → cache MISS → path: starts empty → job installs from scratch
                                          → job end: path: saved under the computed key
```

A hit restores existing content and does *not* re-save — the entry already matches the current key. A miss starts empty, lets the job populate `path:` normally, and `actions/cache` automatically saves the now-populated directory under the key computed at the start, once the job ends.

## 2. The `cache: npm` Shortcut vs. Manual `actions/cache`

Several `setup-*` actions (`actions/setup-node`, `actions/setup-python`, and others) bundle a `cache:` input that wraps this exact same mechanism, picking a sensible path and key automatically for the common case.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm   # wraps actions/cache: detects the lockfile, targets ~/.npm automatically
```

## 3. What to Cache (and What Not To)

```yaml
name: Cached Dependency Install

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Cache npm dependencies
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-npm-

      - name: Install dependencies
        run: npm ci

      - name: Run build
        run: npm run build
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

The cache step targets `~/.npm` — npm's own download cache, not `node_modules` itself — keyed on runner OS plus a hash of `package-lock.json`. `npm ci` still runs on both a hit and a miss; on a hit it just finds most packages already downloaded locally, cutting install time sharply.

Caching the installed dependency directory directly skips more work than caching the download cache, but is riskier across a matrix: some packages compile native binaries tied to a specific OS or runtime version, and restoring a Linux-built `node_modules` onto a macOS runner (or a different Node version) can silently break at runtime. Caching the download cache instead still requires the install command to run, but that command recompiles anything OS-specific from cached, already-downloaded sources.

## 4. The Branch-Scoping Caveat

A saved cache becomes available to future workflow runs that compute the same key — not just future runs of the same job, but any job in the repository whose key happens to match, subject to the repository's overall cache size limits and eviction of old, unused entries. **That sharing is still fenced by branch, though: a run can only restore a cache from its own branch, or fall back to the base branch (for a pull-request run), or the repository's default branch as a last resort. A cache saved on `feature-branch-a` is never visible to a run on `feature-branch-b`, no matter how well the key matches.**

```
feature-branch-a cache  ──✗── run on feature-branch-b   (unrelated branch: never visible)

PR run on feature-branch-a
   ├─ same branch (feature-branch-a)  ──✓── checked first
   ├─ base branch of the PR           ──✓── fallback
   └─ repository default branch      ──✓── last-resort fallback
```

## Comparison

**`cache: npm` shortcut vs. manual `actions/cache@v4`**

| | `cache: npm` shortcut | Manual `actions/cache@v4` |
|---|---|---|
| Mechanism | Same underlying cache system | Same underlying cache system |
| Path chosen | Automatic (npm's download cache dir) | Explicit `path:` |
| Key chosen | Automatic, based on detected lockfile | Explicit `key:` — can fold in OS, tool version, matrix dimension |
| Fits | The common single-lockfile case | Non-standard directories, multiple cache paths in one entry, custom keys, tools with no `setup-*` shortcut |

**What to cache vs. what not to cache**

| Good to cache | Risky or wrong to cache |
|---|---|
| Package manager download cache (`~/.npm`, pip's cache dir) | `node_modules`/`site-packages` directly across a matrix with varying OS or tool version — native binaries compiled for one OS can silently break on another |
| A Gradle or other build tool's cache directory | Build output that should always be freshly produced, not reused stale |
| Anything reusable whose staleness is *harmless* if occasionally wrong for a run | Anything where a subtly-stale restore would be worse than a slower correct build |

## Common Mistakes

- **Caching `node_modules` directly across a matrix that varies by OS or Node version, causing native-binary mismatches.** Caching the package manager's own download cache (`~/.npm`) instead and still running the install command is safer, since install recompiles anything OS-specific from cached sources.
- **Leaving OS (and version, where relevant) out of the cache key when the workflow runs across a matrix.** A key with no `runner.os` component lets a Linux-produced cache get restored on a Windows runner purely because the lockfile hash matched.
- **Assuming a cache hit means dependencies are fully installed and skipping the install step entirely.** The cache restores whatever was saved, but the install command should still run — it's usually fast specifically because the cache is warm.
- **Expecting `actions/cache` to update an existing entry when the key matches but the underlying files changed anyway.** A cache is immutable once saved under a given key (Lesson 3) — a matching key restores the old content as-is.
- **Not setting a `restore-keys` fallback and treating every lockfile change as a full cold start.** Without `restore-keys`, a lockfile change means no cache is restored at all, even though a close prior cache exists that could partially warm the install.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 3 example, push it twice without changing `package-lock.json`, and confirm the Actions log shows a cache hit on the second run.
2. **(Requires a GitHub repo)** Change a dependency version in `package-lock.json` and push again. Confirm the cache step reports a miss, but that `restore-keys` still pulls a partial match (visible in the log as a restored cache under a prefix, not the exact key).
3. **(Paper exercise)** A workflow's cache key is `npm-${{ hashFiles('**/package-lock.json') }}` with no `runner.os` component, and the workflow runs on both `ubuntu-latest` and `windows-latest` in a matrix. Explain the failure mode this risks and the one-line fix.
4. **(Paper exercise)** A cache was saved on `feature-x`. A separate PR from `feature-y` (branched from the same `main`) runs CI. Will it see `feature-x`'s cache? Will it see `main`'s cache? Justify both answers using the branch-scoping rule.
5. **(Requires a GitHub repo)** Replace the manual `actions/cache` step with `actions/setup-node@v4`'s `cache: npm` input, rerun, and confirm the log still shows cache restore/save behavior — demonstrating the shortcut wraps the same mechanism.

## Interview Q&A

**Q: Your CI caches `node_modules` and it's fast on Linux, but a Windows matrix leg started failing with obscure native-module errors after you added the cache. What happened?**
A: A native binary compiled for Linux got restored onto a Windows runner because the cache key (or the cached path) didn't account for OS. Fix: add `runner.os` to the key, or cache the package manager's download cache instead of the installed directory.

**Q: What's the difference between `setup-node`'s `cache: npm` and writing your own `actions/cache` step?**
A: They're the same underlying mechanism. The manual step is only worth writing when the built-in shortcut's default path or key doesn't fit — a custom path, a custom key, or a tool without a `setup-*` shortcut.

**Q: A teammate assumes caches are available repo-wide regardless of branch. Is that right?**
A: No. A run can restore a cache from its own branch, the PR's base branch, or the repository's default branch as a fallback — never from an unrelated branch, even if the key matches exactly.

**Q: Does a cache hit skip the install command entirely?**
A: No. The cache restores the download cache (or whatever was saved), but the install command still runs — it's just fast because most packages are already local.

**Q: You bump a dependency version but forget to add a lockfile hash to the cache key. What happens?**
A: The key stays identical, the cache hits against the old, immutable entry, and the job silently reuses stale dependencies instead of the new ones.
