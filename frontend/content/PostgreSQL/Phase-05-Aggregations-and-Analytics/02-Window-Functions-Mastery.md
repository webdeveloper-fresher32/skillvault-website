# 02 — Window Functions Mastery

## Table of Contents
1. [Window Functions vs GROUP BY](#1-window-functions-vs-group-by)
2. [The Anatomy of the `OVER()` Clause](#2-the-anatomy-of-the-over-clause)
3. [Ranking Functions: `ROW_NUMBER`, `RANK`, `DENSE_RANK` & `NTILE`](#3-ranking-functions-row_number-rank-dense_rank--ntile)
4. [Offset Functions: `LAG` & `LEAD`](#4-offset-functions-lag--lead)
5. [Window Frame Specifications: `ROWS` vs `RANGE`](#5-window-frame-specifications-rows-vs-range)
6. [Real-World Use Cases: Running Totals & Moving Averages](#6-real-world-use-cases-running-totals--moving-averages)
7. [Reusing Window Specifications with Named Windows](#7-reusing-window-specifications-with-named-windows)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Window Functions vs GROUP BY

Both `GROUP BY` and Window Functions perform calculations across sets of rows. The fundamental difference:
- **`GROUP BY` collapses rows:** If 1,000 rows share the same category, `GROUP BY` reduces them to 1 single row.
- **Window Functions preserve row identity:** Every single row remains in the final output, enriched with aggregate metrics calculated across its partition.

```
GROUP BY:         100 Rows ──► Collapsed into 5 Category Summary Rows
Window Function:  100 Rows ──► 100 Rows with Category Total column attached
```

---

## 2. The Anatomy of the `OVER()` Clause

```sql
function() OVER (
    [PARTITION BY partition_columns]
    [ORDER BY sort_columns]
    [frame_clause]
)
```

- **`PARTITION BY`:** Divides the dataset into independent logical groups (similar to a local `GROUP BY`).
- **`ORDER BY`:** Sorts the rows within each partition.
- **`frame_clause`:** Defines the subset of rows relative to the current row included in the calculation.

---

## 3. Ranking Functions: `ROW_NUMBER`, `RANK`, `DENSE_RANK` & `NTILE`

Suppose two employees share the same salary ($5,000):

```sql
SELECT 
    name, 
    department, 
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
    RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rnk,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rnk,
    NTILE(4)     OVER (ORDER BY salary DESC) AS salary_quartile
FROM employees;
```

### Comparison Matrix:
| Employee | Salary | `ROW_NUMBER()` | `RANK()` | `DENSE_RANK()` | Behavior Explanation |
|---|---|---|---|---|---|
| Alice | $9,000 | 1 | 1 | 1 | Leader |
| Bob | $5,000 | 2 | 2 | 2 | Tied |
| Charlie | $5,000 | 3 | 2 | 2 | Tied (same rank) |
| David | $4,000 | 4 | **4** (Skips 3!) | **3** (No gaps!) | `DENSE_RANK` never skips numbers |

- **`NTILE(n)`:** Divides ordered rows into `n` equal buckets (e.g. `NTILE(4)` produces quartiles, `NTILE(100)` produces percentiles).

---

## 4. Offset Functions: `LAG` & `LEAD`

Offset functions inspect preceding or succeeding rows without self-joins.

```sql
SELECT 
    recorded_date,
    daily_revenue,
    -- Get yesterday's revenue
    LAG(daily_revenue, 1, 0.00) OVER (ORDER BY recorded_date) AS previous_day_revenue,
    -- Calculate daily growth rate
    daily_revenue - LAG(daily_revenue, 1) OVER (ORDER BY recorded_date) AS revenue_delta
FROM daily_financials;
```

- `LAG(column, offset, default_value)`: Peeks backward by `offset` rows.
- `LEAD(column, offset, default_value)`: Peeks forward by `offset` rows.

---

## 5. Window Frame Specifications: `ROWS` vs `RANGE`

The frame clause dictates how many neighbors participate in the calculation:

```sql
ROWS BETWEEN [Start_Bound] AND [End_Bound]
```

Valid bounds include:
- `UNBOUNDED PRECEDING`: From the start of the partition.
- `n PRECEDING`: `n` physical rows before current row.
- `CURRENT ROW`: The current evaluated row.
- `n FOLLOWING`: `n` physical rows after current row.
- `UNBOUNDED FOLLOWING`: To the end of the partition.

### Subtle Danger: `ROWS` vs `RANGE`
- **`ROWS`:** Counts physical rows.
- **`RANGE`:** Evaluates values in the `ORDER BY` column. If two rows have identical dates, `RANGE` aggregates both together, which can cause surprising spikes in running totals! **Always prefer `ROWS` unless you intentionally want tie grouping.**

---

## 6. Real-World Use Cases: Running Totals & Moving Averages

### 1. Year-to-Date (YTD) Running Total
```sql
SELECT 
    invoice_date,
    amount,
    SUM(amount) OVER (
        ORDER BY invoice_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ytd_running_total
FROM invoices;
```

### 2. 7-Day Moving Average
Smooth out weekend volatility in telemetry or web traffic:
```sql
SELECT 
    log_date,
    active_users,
    ROUND(AVG(active_users) OVER (
        ORDER BY log_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2) AS seven_day_moving_avg
FROM daily_metrics;
```

---

## 7. Reusing Window Specifications with Named Windows

When multiple functions share the same partition and ordering, avoid duplicating code using the `WINDOW` clause:

```sql
SELECT 
    name, 
    department, 
    salary,
    ROW_NUMBER() OVER w,
    DENSE_RANK() OVER w,
    AVG(salary)  OVER w
FROM employees
WINDOW w AS (PARTITION BY department ORDER BY salary DESC);
```

---

## 8. Hands-On Exercises

1. Create a `stock_prices` table with `symbol TEXT`, `trade_time TIMESTAMPTZ`, and `price NUMERIC`.
2. Insert 10 trades for symbol `'AAPL'`.
3. Calculate the price change compared to the immediate previous trade using `LAG()`.
4. Calculate a 3-trade trailing simple moving average using `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`.

---

## 9. Summary & Key Takeaways

1. Window functions perform aggregate math while preserving original row granularity.
2. `ROW_NUMBER` gives unique sequential IDs; `DENSE_RANK` handles ties without skipping.
3. `LAG` and `LEAD` enable seamless inter-row deltas without joining the table back to itself.
4. Always specify `ROWS BETWEEN ...` explicitly for deterministic moving averages and running totals.
5. Use named `WINDOW` definitions to keep queries clean and dry.
