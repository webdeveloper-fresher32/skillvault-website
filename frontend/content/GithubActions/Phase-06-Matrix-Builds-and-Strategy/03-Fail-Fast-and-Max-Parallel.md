# Fail-Fast and Max-Parallel

A matrix that generates a dozen job runs raises two questions plain job definitions never had to answer. First: if one combination fails, should the rest keep running, or should GitHub Actions cancel everything else in flight? Second: if a matrix fans out to many combinations, should they all start at once, even if that overwhelms a shared external resource like a rate-limited API or a shared staging database? `strategy.fail-fast` controls the first behavior; `strategy.max-parallel` controls the second.

## 1. `fail-fast` (Default Behavior)

`strategy.fail-fast` defaults to `true` for any matrixed job, whether or not it's written explicitly. The moment any one matrix combination's job fails, GitHub Actions immediately cancels every other combination's job still in progress (queued or running) for that same matrix — they're marked cancelled, not failed, and their steps stop wherever they were. Combinations that had already completed successfully before the failure keep their successful result; cancellation only affects runs still in progress at the moment of the first failure.

```
Combination A ──✓ done
Combination B ──✗ FAILS at t=30s
Combination C ──[running]──✗ cancelled at t=30s
Combination D ──[queued]───✗ cancelled at t=30s
```

## 2. When to Disable `fail-fast`

Setting `fail-fast: false` disables the cancellation entirely — every combination runs to its own completion, success or failure, independent of what happens to any other combination. The overall job's status still reflects reality: if any combination failed, the job as a whole is still reported as failed in the checks UI, but every combination gets to finish and report its own individual result first.

```yaml
name: Matrix with Fail-Fast Disabled and Max-Parallel Capped

on:
  push:
    branches:
      - main

jobs:
  test-against-dependency-versions:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      max-parallel: 2
      matrix:
        dependency-version: ["1.2.0", "1.3.0", "1.4.0", "2.0.0-beta"]
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Install dependency at pinned version
        run: npm install some-dependency@${{ matrix.dependency-version }}

      - name: Run compatibility tests
        run: npm test
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

This matrix generates four combinations, one per `dependency-version`. `fail-fast: false` means that if `2.0.0-beta` fails its compatibility tests, `1.2.0`, `1.3.0`, and `1.4.0` are not cancelled — they keep running and each reports its own pass/fail independently, giving a full compatibility picture across all four versions instead of an incomplete one cut short by the first failure. This is exactly the case for an exploratory matrix: one built to find out which dependency versions or OS/runtime combinations break, where every individual result is valuable information rather than just a pass/fail gate.

## 3. `max-parallel`

`strategy.max-parallel` caps how many of the matrix's generated combinations are allowed to be running at the same moment, regardless of how many total combinations were generated or how many runners GitHub could otherwise provide. It's evaluated independently of `fail-fast`. Combinations beyond the cap are queued, not skipped or cancelled — they wait until a running combination finishes and frees a slot, then start. The total number of combinations that eventually run is unchanged; only how many run simultaneously changes. Without `max-parallel` set, GitHub Actions runs as many combinations concurrently as runner availability allows — for most matrices, that means effectively all of them start together.

In the example above, `max-parallel: 2` means that even though four combinations exist, only two run at any given moment — the third and fourth are queued and start only as the first two finish, rather than all four hitting `npm install` against the same registry simultaneously. This is the same shared-resource concern Phase 5 raised when designing cache keys so concurrent matrix legs don't collide over the same cache entry.

## Comparison

| | `fail-fast: true` (default) | `fail-fast: false` | `max-parallel` (unset) | `max-parallel: n` |
|---|---|---|---|---|
| Governs | What happens *after* a failure | What happens *after* a failure | Concurrency *before* any failure | Concurrency *before* any failure |
| One combination fails | Cancels all other in-progress combinations | No effect on siblings — they keep running | N/A | N/A |
| Combinations running at once | Up to runner availability | Up to runner availability | Up to runner availability | Capped at `n`, rest queued |
| Overall job status on any failure | Reported failed | Reported failed | Unaffected | Unaffected |
| Best suited for | One logical attempt split across variants that must all succeed together | Exploratory/informational matrices where every result matters | Small matrices, no shared external resource | Matrices hitting a shared external resource (rate-limited API, shared DB, fixed device pool) |

## Common Mistakes

- **Leaving `fail-fast` at its default `true` for an exploratory matrix.** A matrix built to find out which dependency versions or OS/runtime combinations break silently loses most of that information the moment the first combination fails and cancels the rest.
- **Setting `max-parallel` far lower than the matrix needs**, e.g. `max-parallel: 1` on a 12-combination matrix "just to be safe." This serializes what could otherwise run largely in parallel, turning a matrix that could finish in minutes into one taking many multiples longer.
- **Assuming `fail-fast: false` prevents the overall job from being reported as failed.** It doesn't — if any combination genuinely fails, the matrixed job as a whole still shows failed; `fail-fast: false` only changes whether the *other* combinations get to finish.
- **Conflating `fail-fast` with `max-parallel` as if they were the same setting.** A low `max-parallel` with the default `fail-fast: true` can still have an early failure cancel later-queued combinations before they ever get a chance to start.
- **Not considering `max-parallel` at all for a matrix hitting a shared external resource.** Letting every combination in a large matrix start simultaneously against one shared staging database, rate-limited API, or fixed device pool can cause failures that have nothing to do with the code under test.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 2 example exactly as written, push it, and confirm the checks UI shows only two combinations running at a time even though four are declared.
2. **(Requires a GitHub repo)** Remove `fail-fast: false` (letting it default to `true`) from the Section 2 example, then deliberately make one `dependency-version` combination fail (e.g. reference a package version that doesn't exist). Confirm the still-in-progress combinations are marked cancelled, not failed.
3. **(Requires a GitHub repo)** With `fail-fast: false` restored, rerun the same deliberate failure from Exercise 2. Confirm all four combinations report their own result and the overall job is still shown as failed in the checks UI.
4. **(Paper exercise)** A matrix has 20 combinations and `max-parallel: 5`. If none of them fail, how many combinations are running at any single moment during steady state, and what happens to the rest?
5. **(Requires a GitHub repo)** Set `max-parallel: 1` on the Section 2 example and time the total workflow run. Compare against the same workflow with `max-parallel: 2`, confirming the lower cap increases wall-clock time.

## Interview Q&A

**Q: Your matrix tests five dependency versions, and version three of five fails. With the default settings, what happens to versions four and five?**
A: `fail-fast` defaults to `true`, so the moment version three's job fails, GitHub Actions cancels whatever's still in progress for versions four and five — they never get to report their own result.

**Q: How would you change that if you wanted to know the result for every version regardless of failures?**
A: Set `fail-fast: false`, which lets every combination run to completion independently while the overall job still correctly reports as failed if any combination failed.

**Q: Your matrix has 20 combinations that all hit the same rate-limited third-party API. What would you add to the workflow?**
A: `max-parallel` set to a number the API can tolerate concurrently — this queues the remaining combinations rather than skipping them, trading some wall-clock speed for not overwhelming the shared resource.

**Q: Does `max-parallel: 2` on a 4-combination matrix change how many combinations eventually run?**
A: No — all four still run eventually; `max-parallel` only limits how many run simultaneously, queuing the rest until a slot frees up.

**Q: If `fail-fast: false` is set and one combination fails, does the overall job still show as failed?**
A: Yes — `fail-fast: false` only stops cancellation of sibling runs, it doesn't change whether a real failure among them counts toward the overall job status.
