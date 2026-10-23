# Cache Key Strategy and Invalidation

The previous lesson showed `actions/cache` working on the happy path — lockfile unchanged, key matches, cache hit. But the mechanism lives or dies on the key design: a key that doesn't change when it should serves stale dependencies silently; a key that changes too often never hits and every run pays full install cost. Neither failure is loud — a stale cache doesn't error, it just quietly serves old content. This lesson covers what goes into a good key, the `restore-keys` fallback, and a fact about the backend that shapes all of it: a cache entry is immutable once created under a given key.

## 1. Designing a Good Cache Key

A good key is built from everything that should invalidate the cache when it changes: a hash of the lockfile so the key changes exactly when dependencies change, `runner.os` so a Linux-built cache is never handed to a Windows runner, and a tool-version identifier wherever a matrix varies by version.

```yaml
key: v1-${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
```

| Key ingredient | Why it belongs |
|---|---|
| `hashFiles('**/package-lock.json')` | Changes exactly when dependencies change |
| `runner.os` | Prevents a cache built on one OS from being restored on another |
| Tool/runtime version (e.g. Node version) | Prevents cross-version corruption on a matrix build |
| Manual version prefix (e.g. `v1-`) | Lets a maintainer force a full invalidation later without touching content-based parts of the key |

## 2. `restore-keys` Fallback

On restore, `actions/cache` first looks for an exact match against the full computed key — byte-for-byte what was saved, no partial matching or freshness check beyond the string itself. If no exact match exists, it falls back to `restore-keys`, an ordered list of key *prefixes*: it searches for the most recently created entry whose key starts with the first prefix, then the next prefix, and so on, until nothing matches (a full miss).

```yaml
- name: Cache npm dependencies with fallback
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: v1-${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      v1-${{ runner.os }}-npm-
```

```
restore
  ├─ exact match on full key?          → yes: restore that exact entry, done
  └─ no exact match
        ├─ try restore-keys[0] prefix   → most recent entry matching this prefix?
        ├─ try restore-keys[1] prefix   → (if [0] found nothing)
        └─ none match                   → full cache miss, path: starts empty
```

A `restore-keys` match is explicitly a fallback, not an exact hit — it restores the closest prior entry by prefix, likely close but built under a different exact key, so the install step afterward still has real reconciliation work to do.

**Both the exact match and the `restore-keys` prefix search are scoped by branch: a run can only reach its own branch's cache shelf, then the base branch's shelf (for a pull-request run), then the repository's default branch's shelf as a last resort. A cache entry sealed on an unrelated branch is never reachable, however well its key prefix matches.**

## 3. Why Caches Are Immutable

There is no operation that updates an existing key's contents in place. `actions/cache`'s save step only ever creates a *new* entry under whatever key was computed for that run. This is why the key must be designed to change whenever the underlying content should change — the system has no other invalidation lever.

```yaml
name: Cache Key Strategy Demo

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

      - name: Cache npm dependencies with fallback
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: v1-${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            v1-${{ runner.os }}-npm-

      - name: Install dependencies
        run: npm ci

      - name: Run build
        run: npm run build
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

The `key:` folds in a manual version prefix (`v1-`), the runner OS, and a lockfile hash — changing whenever the lockfile changes, never shared across OS. `restore-keys` provides the prefix up to but not including the lockfile hash, so a lockfile change still gives `npm ci` a head start from the nearest prior cache instead of starting fully cold.

## 4. Manual Eviction and Key Rotation

Eviction happens two ways: automatically (GitHub evicts caches unused for a period of time, and enforces a total per-repository size cap by evicting least-recently-used entries) and manually, through the Actions UI's Caches page or the REST API / `gh cache` CLI, letting a maintainer delete a specific stale entry on demand.

A **rotating key prefix** — deliberately bumping a fixed segment of the key, e.g. `v1-` to `v2-` — is a manual technique for forcing every future run to treat all existing entries as misses, invalidating an entire family of cache keys at once without touching the UI or API:

```yaml
# Before: every existing entry keyed under v1- becomes permanently unreachable
key: v1-${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}

# After: bump the prefix in both key and restore-keys
key: v2-${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
restore-keys: |
  v2-${{ runner.os }}-npm-
```

None of this changes the runtime hit/miss behavior from the previous lesson — a hit still restores without re-running the save step, a miss still runs from empty and saves a new entry at the end. Key strategy only changes *which* entry, if any, counts as a hit.

## Comparison

| Comparison | Detail |
|---|---|
| Exact key match vs. `restore-keys` fallback | Exact match restores precisely what was saved, nothing more needed. `restore-keys` restores the closest prior entry by prefix — a head start for install, not a substitute for it |
| Static key (`npm-cache`) vs. content-hashed key | Static key hits forever, even after the lockfile changes, silently serving stale dependencies. Content-hashed key misses cleanly and correctly whenever dependencies actually change |
| Automatic eviction vs. manual eviction vs. rotating prefix | Automatic: GitHub's own age/size-cap housekeeping, untargeted. Manual: deletes one identified entry via UI/API. Rotating prefix: makes an entire family of old keys unreachable, no deletion needed |
| This lesson's key design vs. Lesson 2's OS/version mistake | Lesson 2 flagged omitting `runner.os` as one cause of cross-matrix corruption; this lesson generalizes it — include everything that should force a miss (content hash, OS, version), nothing that shouldn't |

## Common Mistakes

- **Reusing the exact same cache key across dependency changes**, e.g. a static string like `npm-cache` with no lockfile hash. Every run hits the same immutable entry even after the lockfile changes, silently reusing stale dependencies.
- **Relying solely on `restore-keys` fallback with no exact key component.** Every run then treats the cache as a miss and re-saves a new entry every time, defeating the purpose of caching and filling repository cache storage with redundant entries.
- **Expecting a key change to update an existing entry rather than create a new one.** Caches are immutable — changing the key seals a brand-new entry; the old one sits until evicted automatically or removed manually, it isn't overwritten.
- **Omitting OS or tool version from the key when the workflow runs across a matrix**, letting an entry saved on one matrix leg get restored on another — the same cross-matrix corruption from Lesson 2, now framed as a key-design omission.
- **Assuming a rotating key prefix or manual UI deletion is required routinely.** A correctly designed key invalidates itself automatically as content changes — prefix rotation and manual eviction are recovery tools for a bad cache already saved, not a substitute for correct key design.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 3 example, run it twice unchanged, and confirm a cache hit on the second run via the Actions log.
2. **(Requires a GitHub repo)** Change `package-lock.json`, push, and confirm the log shows a miss on the exact key but a `restore-keys` fallback restore from the previous entry.
3. **(Paper exercise)** A cache key is `npm-cache` (no `hashFiles()` term at all). Dependencies change three times over a month. How many distinct cache entries exist afterward, and what does each run actually install? Justify from the immutability rule.
4. **(Requires a GitHub repo)** Bump the version prefix from `v1-` to `v2-` in both `key:` and `restore-keys`, push, and confirm the Actions log shows a full miss (no `restore-keys` fallback found either) on that run — demonstrating the rotation made the old family unreachable.
5. **(Paper exercise)** A cache was saved under a matching key on `main`. A feature branch `add-login`, branched from `main` last week, opens a PR. Will its CI run see that cache on an exact key match? Explain using the branch-scoping rule from Lesson 2, applied to `restore-keys` search order.

## Interview Q&A

**Q: Your team suspects CI is silently using outdated dependencies even though the lockfile was updated weeks ago. Where would you look?**
A: The cache key. If it doesn't include a hash of the lockfile, every run computes the same key, exact-hits against the old immutable entry, and never reinstalls. Fix: add `hashFiles('**/package-lock.json')` to the key.

**Q: If caches are immutable, how do you invalidate a bad cache that's already been saved?**
A: You can't edit it in place. Either change the key going forward (a version-prefix bump is the common pattern) or delete the specific entry manually via the Actions UI or API.

**Q: What's the difference between an exact key match and a `restore-keys` match?**
A: An exact match restores precisely what was saved under that identical key. A `restore-keys` match restores the most recent entry matching a prefix — a head start, not a guarantee the content reflects the current lockfile.

**Q: Does `restore-keys` ever reach a cache saved on a completely unrelated branch?**
A: No. Both the exact match and the `restore-keys` prefix search are scoped to the current branch, then the PR's base branch, then the repository's default branch — never an unrelated branch.

**Q: Why include `runner.os` and a tool version in the key instead of just the lockfile hash?**
A: Without them, a cache entry built on one OS or tool version can be restored on another whose native binaries or runtime behavior differ, causing silent, hard-to-diagnose failures.
