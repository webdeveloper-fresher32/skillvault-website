# 01 — GROUPING SETS, ROLLUP & CUBE

## Table of Contents
1. [The Challenge of Multi-Level Reporting](#1-the-challenge-of-multi-level-reporting)
2. [`GROUPING SETS`: Selective Multi-Dimensional Grouping](#2-grouping-sets-selective-multi-dimensional-grouping)
3. [`ROLLUP`: Hierarchical Subtotals and Grand Totals](#3-rollup-hierarchical-subtotals-and-grand-totals)
4. [`CUBE`: Full Cross-Tabulation](#4-cube-full-cross-tabulation)
5. [Distinguishing Aggregates with `GROUPING()`](#5-distinguishing-aggregates-with-grouping)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Summary & Key Takeaways](#7-summary--key-takeaways)

---

## 1. The Challenge of Multi-Level Reporting

Suppose business analysts request sales totals by:
1. **Year, Region, and Product**
2. **Year and Region**
3. **Year only**
4. **Grand Total across the entire company**

In naive SQL, you would have to write 4 separate `GROUP BY` queries and join them with `UNION ALL`, scanning the table 4 times!

PostgreSQL provides **`GROUPING SETS`**, **`ROLLUP`**, and **`CUBE`** to calculate all aggregate dimensions in a **single sequential scan**.

---

## 2. `GROUPING SETS`: Selective Multi-Dimensional Grouping

`GROUPING SETS` lets you explicitly specify the exact combinations of dimensions to calculate:

```sql
CREATE TABLE sales (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_year INT,
    region VARCHAR(50),
    product VARCHAR(50),
    revenue NUMERIC(12, 2)
);

-- Calculate revenue by (Region, Product) AND by (Region only):
SELECT region, product, SUM(revenue) AS total_revenue
FROM sales
GROUP BY GROUPING SETS (
    (region, product),  -- Dimension 1
    (region),           -- Dimension 2
    ()                  -- Dimension 3: Grand Total!
);
```

---

## 3. `ROLLUP`: Hierarchical Subtotals and Grand Totals

`ROLLUP` generates hierarchical subtotals that "roll up" from left to right:
`ROLLUP (year, region, product)` produces groupings for:
1. `(year, region, product)`
2. `(year, region)`
3. `(year)`
4. `()` (Grand total)

```sql
SELECT 
    sale_year, 
    region, 
    SUM(revenue) AS total_revenue
FROM sales
GROUP BY ROLLUP (sale_year, region)
ORDER BY sale_year NULLS LAST, region NULLS LAST;
```

### Output Visualization:
```
 sale_year | region | total_revenue 
-----------+--------+---------------
      2025 | North  |      15000.00
      2025 | South  |      22000.00
      2025 | NULL   |      37000.00  <-- Subtotal for 2025
      2026 | North  |      19000.00
      2026 | South  |      28000.00
      2026 | NULL   |      47000.00  <-- Subtotal for 2026
      NULL | NULL   |      84000.00  <-- Company Grand Total!
```

---

## 4. `CUBE`: Full Cross-Tabulation

`CUBE` generates **every possible mathematical combination** of the specified dimensions ($2^N$ grouping combinations):
`CUBE (region, product)` generates:
1. `(region, product)`
2. `(region)`
3. `(product)`
4. `()`

```sql
SELECT region, product, SUM(revenue) AS total_revenue
FROM sales
GROUP BY CUBE (region, product);
```

---

## 5. Distinguishing Aggregates with `GROUPING()`

When subtotals are generated, PostgreSQL outputs `NULL` for the collapsed dimension. But what if a column actually contained legitimate `NULL` values in the raw data? How do you distinguish between a subtotal and real NULL data?

The **`GROUPING()` function** returns `1` if the column is collapsed into an aggregate subtotal, and `0` if it represents a genuine row value:

```sql
SELECT 
    CASE WHEN GROUPING(sale_year) = 1 THEN 'All Years' ELSE sale_year::text END AS year_label,
    CASE WHEN GROUPING(region) = 1 THEN 'All Regions' ELSE region END AS region_label,
    SUM(revenue) AS total_revenue
FROM sales
GROUP BY ROLLUP (sale_year, region);
```

---

## 6. Hands-On Exercises

1. Create a `store_transactions` table with `store_id INT`, `category TEXT`, `payment_method TEXT`, and `amount NUMERIC`.
2. Populate 50 sample rows across 2 stores, 3 categories, and 2 payment methods ('card', 'cash').
3. Write a query using `CUBE(store_id, category)` to generate all permutation subtotals.
4. Use `GROUPING()` to display `'STORE TOTAL'` and `'OVERALL TOTAL'` instead of NULLs.

---

## 7. Summary & Key Takeaways

1. `GROUPING SETS` computes multiple custom grouping dimensions in a single data pass.
2. `ROLLUP` produces hierarchical sub-totals (e.g. Year -> Quarter -> Month).
3. `CUBE` produces full cross-tabulation across all possible dimension pairs.
4. Use `GROUPING(col)` to identify generated subtotal rows and format presentation labels.
