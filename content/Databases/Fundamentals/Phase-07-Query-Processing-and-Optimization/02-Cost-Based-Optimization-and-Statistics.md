# Cost-Based Optimization and Statistics — Complete Guide

> "A shop manager staffs tomorrow's tills from last month's footfall counts, and gets it right every week until the month a festival moves and the counts describe a town that no longer exists."

---

## Table of Contents

1. [The Problem: The Optimizer Has to Guess Before It Can Choose](#1-the-problem-the-optimizer-has-to-guess-before-it-can-choose)
2. [The Footfall Count Analogy](#2-the-footfall-count-analogy)
3. [The Mechanism: Row Counts Distinct Values Null Fractions and Histograms](#3-the-mechanism-row-counts-distinct-values-null-fractions-and-histograms)
4. [Diagram: Equi-Width and Equi-Depth Histograms Over the Same Column](#4-diagram-equi-width-and-equi-depth-histograms-over-the-same-column)
5. [Code Walkthrough: Estimating Selectivity by Hand](#5-code-walkthrough-estimating-selectivity-by-hand)
6. [Comparing Rule-Based to Cost-Based Optimization](#6-comparing-rule-based-to-cost-based-optimization)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Optimizer Has to Guess Before It Can Choose

To pick between two plans the optimizer must know which is cheaper, and cost depends almost entirely on how many rows flow between operators. That number cannot be known without running the query, and running it is precisely what the optimizer is trying to decide how to do.

### One Wrong Number Ruins Everything Above It

```text
SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE  o.country = 'DE' AND o.city = 'Munich';

  planner estimates  o produces        12 rows
  reality            o produces 1,430,000 rows
  ↳ Because 12 is small, a nested loop looked ideal: 12 index probes
    into customers. The executor instead performed 1,430,000 probes.
    22 minutes. The join algorithm was not the bug — the 12 was.
```

### Estimation Error Compounds Upward

```text
scan orders     est     12   actual 1,430,000   ×119,000 off
  join customers est    12   actual 1,430,000   inherits the error
    sort          est   12   actual 1,430,000   sized for 12 rows,
                                                 spills to disk
  ↳ An estimate is an input to the operator above it, so one bad
    leaf estimate is wrong all the way to the root.
```

### What's Missing

Nothing is available at planning time except a summary of the data collected earlier and stored in the catalogue. What's missing from a naive model of "the optimizer picks the best plan" is that it picks the plan that looks best under a summary, and every failure mode in this lesson is a case of the summary and the data disagreeing.

---

## 2. The Footfall Count Analogy

A shop manager cannot count tomorrow's customers, so tomorrow's rota is built from a survey taken last month: how many people came in, at which hours, on which days. The method is sound and works for months, right up until something moves the pattern and the survey silently describes a different town.

### Survey Versus Reality

```text
Survey           → 400 shoppers/day, peak 12:00-14:00, counted in March
Rota built       → four tills at noon, one at 18:00 — correct for March
Festival moves   → 3,000 shoppers arrive at 18:00 in June
Result           → one till, a queue out the door; the rota was never
                   wrong about March, it was just answering March
Re-survey        → count again in June and the rota fixes itself
```

### Mapping the Analogy to the Optimizer

The survey is the statistics snapshot, the rota is the chosen plan, and the festival is any bulk load, backfill, or seasonal shift that changes the distribution without changing the query. Re-surveying is refreshing statistics, which is why a plan regression that nobody caused is usually fixed by an operation nobody ran.

---

## 3. The Mechanism: Row Counts Distinct Values Null Fractions and Histograms

Statistics collection samples the table and stores a compact per-column summary in the catalogue. Four things matter, and every selectivity formula is built out of them.

### What the Catalogue Stores per Column

```text
orders — 40,000,000 rows, 512,000 pages, stats collected 2026-07-02

column        n_distinct    null_frac   most common values (freq)
status                 6      0.0000    'ACTIVE' .45  'SHIPPED' .31
country              214      0.0020    'US' .38  'DE' .09  'BR' .04
city              18,900      0.0110    (no MCV dominance)
total_amount   1,240,000      0.0000    100-bucket histogram
placed_at      3,650,000      0.0000    100-bucket histogram
```

### Selectivity for Equality and Range

```text
equality, value in MCV list  → sel = that value's stored frequency
equality, value not in MCV   → sel = 1 / n_distinct   (uniform guess)
range (< > BETWEEN)          → sel = fraction of histogram in range
IS NULL                      → sel = null_frac
IS NOT NULL                  → sel = 1 - null_frac

  estimated_rows = sel × row_count
  ↳ country = 'DE' → 0.09 × 40,000,000 = 3,600,000 rows
  ↳ city = 'Munich' → 1/18,900 × 40,000,000 = 2,116 rows
```

### Combining Predicates and the Independence Assumption

```text
sel(A AND B) = sel(A) × sel(B)              ← assumes independence
sel(A OR  B) = sel(A) + sel(B) - sel(A)×sel(B)
sel(NOT A)   = 1 - sel(A)

  country='DE' AND city='Munich'
    0.09 × 0.0000529 = 0.00000476 → 190 rows estimated
  ↳ But every Munich row IS a DE row. The true answer is the city
    count alone: 2,116. Correlated columns break the multiplication,
    always in the direction of under-estimating.
```

---

## 4. Diagram: Equi-Width and Equi-Depth Histograms Over the Same Column

### Two Ways to Bucket total_amount

```text
Actual data: 1,000,000 orders, almost all under 100, a long thin tail

EQUI-WIDTH — equal value ranges, wildly unequal counts
  0-2000    │████████████████████████████████████│ 994,300 rows
  2000-4000 │▏                                    │   4,100 rows
  4000-6000 │▏                                    │   1,100 rows
  6000-8000 │▏                                    │     500 rows

EQUI-DEPTH — equal counts, unequal value ranges
  bucket 1  │██████│ 250,000 rows   range     0 -    18
  bucket 2  │██████│ 250,000 rows   range    18 -    47
  bucket 3  │██████│ 250,000 rows   range    47 -   131
  bucket 4  │██████│ 250,000 rows   range   131 - 8,000
```

### Reading the Diagram

Asking "how many orders are under 50?" against the equi-width histogram means interpolating inside a bucket holding 99% of the table, so the answer is a guess scaled linearly across a range where the data is not remotely linear. The equi-depth version answers the same question by counting whole buckets — two and a bit — because it spends its resolution where the rows actually are, which is why real engines use equi-depth (or height-balanced) histograms plus a separate list of most common values.

---

## 5. Code Walkthrough: Estimating Selectivity by Hand

Cost is not measured in seconds. It is a unit-free number produced by a formula that weights the work an operator will do, using the row estimates from Section 3 as its main input.

### Cost as a Weighted Sum of I/O and CPU

```text
cost = sequential_pages  × seq_page_cost      (1.0, the unit)
     + random_pages      × random_page_cost   (4.0 — seeks hurt)
     + rows_returned     × cpu_tuple_cost     (0.01)
     + rows_examined     × cpu_operator_cost  (0.0025 per predicate)

Illustrative weights. Two plans for: WHERE country = 'DE'
  A) Sequential scan   512,000 × 1.0 + 40,000,000 × 0.0025 = 612,000
  B) Index + fetch   3,600,000 × 4.0 + 3,600,000 × 0.01    = 14,436,000
  ↳ At 3.6M matching rows the index plan is 23x worse, because each
    matched row is a random page fetch. The scan wins, correctly.
```

### Why Stale Statistics Cause Sudden Regressions

```text
Day 0   stats say orders holds 200,000 rows; country='DE' → 18,000
        plan B costs 72,000, plan A costs 3,060 → sequential scan

Day 30  a backfill loads 39,800,000 rows. Nothing re-collects stats.
        The optimizer still believes 200,000 rows and 18,000 matches.

  ↳ It now chooses plans sized for a table 200x smaller than reality.
    Nothing was deployed. Nothing was configured. The query text is
    byte-identical. Re-collecting statistics restores the old choice.
```

---

## 6. Comparing Rule-Based to Cost-Based Optimization

Before cost models, optimizers ranked access paths by a fixed priority list — "an equality index beats a range index beats a scan" — with no reference to the data at all.

### Rule-Based vs Cost-Based

| | Rule-Based | Cost-Based |
|---|---|---|
| Decides using | A fixed priority ranking of access paths | Estimated rows and a cost formula |
| Reads statistics | No | Yes — this is its only view of the data |
| Same data twice as big | Identical plan | Possibly a different, better plan |
| Failure mode | Uses an index that matches 90% of the table | Trusts a stale or correlated-column estimate |
| Predictability | Very high — plans never move on their own | Lower — plans can regress without a deploy |

### Takeaway

Cost-based optimization won because a fixed ranking cannot know that an index matching 90% of a table is worse than reading the table, and only row counts reveal that. The cost is the failure mode traded for it: the plan is now a function of statistics, so keeping statistics fresh becomes an operational duty rather than an optional tidy-up.

---

## 7. Common Mistakes

- **Reading estimated rows as a measurement rather than a prediction.** The estimate is what the optimizer believed before running anything; the actual row count is what happened. Comparing the two is the single highest-value habit in query tuning, and treating the estimate as fact removes the only signal that the plan was chosen on bad information.
- **Assuming a bulk load refreshes statistics.** Loading, restoring, or backfilling millions of rows usually does not trigger statistics collection synchronously, and automatic collection is threshold-based and asynchronous. A large load followed immediately by queries is the classic setup for a plan chosen against a snapshot of a much smaller table.
- **Ignoring correlation between columns.** `country` and `city`, `postcode` and `region`, `product` and `category` are not independent, so multiplying their selectivities under-estimates — often by orders of magnitude. Most engines offer some form of multi-column or extended statistics precisely for this; without it, the independence assumption is silently applied.
- **Blaming the join algorithm for a cardinality bug.** A nested loop over a million-row outer is a symptom, not a cause: the planner chose it because it expected twelve rows. Forcing a different join fixes the instance and leaves the wrong estimate feeding every other plan over the same table.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a table with 1,000,000 rows where one column has 6 distinct values with skewed frequencies and another has 50,000 near-uniform values. Collect statistics, then read the catalogue's stored `n_distinct`, null fraction, and most-common-value list for both columns and confirm they match the data you generated.

**Exercise 2:** Using only the stored statistics and the formulas in Section 3, predict on paper the row count for `WHERE status = 'ACTIVE'`, for `WHERE total_amount > 500`, and for both combined with `AND`. Then obtain the real plan and compare your three hand-computed numbers against the optimizer's estimates.

**Exercise 3:** Take the equi-width and equi-depth bucket layouts from Section 4 and compute, for each, the estimated number of rows below 50. Show the arithmetic for both and explain in one sentence why the two answers differ by so much.

**Exercise 4:** Build a two-column correlated data set — a country column and a city column where every city belongs to exactly one country — with 40,000 rows. Compare the optimizer's estimate for `country = 'DE' AND city = 'Munich'` against the actual count, and confirm the under-estimate predicted by the independence assumption.

**Exercise 5:** Reproduce the stale-statistics regression from Section 5 deliberately. Collect statistics on a small table, save the plan for a filtered query, insert two hundred times more rows without re-collecting, and obtain the plan again — confirm it is unchanged and now wrong, then re-collect statistics and watch it flip.

---

## 9. Interview Q&A

**Q: Why does a cost-based optimizer need statistics at all?**
Because the cost of a plan is dominated by how many rows move between its operators, and that number is unknown until the query runs. Statistics are a compact summary of the data — row counts, distinct values, null fractions, histograms — that let the optimizer predict those row counts before executing anything. Without them it would be choosing between plans with no way to tell which is cheaper.

**Q: What is cardinality estimation and why is it considered the hard part?**
It is predicting how many rows each operator will emit. It is hard because errors compound: a leaf scan estimate feeds the join above it, which feeds the sort above that, so a single wrong number at the bottom propagates all the way to the root and can make a plan that is optimal for twelve rows get chosen for a million. Most severe plan problems in practice trace back to a cardinality error rather than to the optimizer choosing badly given correct inputs.

**Q: What is the difference between an equi-width and an equi-depth histogram?**
Equi-width divides the value range into buckets of equal width, so with skewed data one bucket can hold almost the whole table and estimates inside it degrade to linear interpolation over a range where the data is not linear. Equi-depth divides so that each bucket holds roughly the same number of rows, which puts fine-grained boundaries where the data is dense. That is why real engines use equi-depth or height-balanced histograms, usually alongside a separate most-common-values list for the heavy hitters.

**Q: What is the independence assumption and when does it hurt you?**
When combining predicates with AND, the optimizer multiplies their individual selectivities, which is correct only if the columns are statistically independent. On correlated columns — city and country, postcode and region, product and category — the multiplication under-estimates, sometimes by several orders of magnitude, because the second predicate filters out far less than its standalone selectivity suggests. The fix is multi-column or extended statistics so the engine has a real joint frequency instead of a product.

**Q: A query got dramatically slower overnight with no deploy. What do you check first?**
Whether the plan changed, and if it did, whether the statistics behind it are stale. The usual sequence is a large load or a distribution shift that was not followed by statistics collection, so the optimizer keeps choosing plans sized for a much smaller or differently shaped table. Comparing estimated against actual rows in the plan usually shows the discrepancy immediately, and re-collecting statistics is both the diagnosis and, most of the time, the fix.
