# 03 — Ordered-Set & Statistical Aggregates

## Table of Contents
1. [The Limitations of Standard `AVG` and `SUM`](#1-the-limitations-of-standard-avg-and-sum)
2. [The `FILTER (WHERE ...)` Clause](#2-the-filter-where--clause)
3. [Ordered-Set Aggregates (`WITHIN GROUP`)](#3-ordered-set-aggregates-within-group)
4. [Calculating Medians & Service-Level Percentiles (P90, P95, P99)](#4-calculating-medians--service-level-percentiles-p90-p95-p99)
5. [Hypothetical-Set Aggregates](#5-hypothetical-set-aggregates)
6. [Statistical Functions: Variance, Standard Deviation & Correlation](#6-statistical-functions-variance-standard-deviation--correlation)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Limitations of Standard `AVG` and `SUM`

In production engineering, averages (`AVG`) are notoriously misleading because extreme outliers skew the metric. For example, if 99 web requests take 10ms, but 1 request takes 10,000ms, the arithmetic mean is ~110ms—failing to represent the true experience of 99% of your users.

PostgreSQL provides advanced **Ordered-Set Aggregates** and **Percentile Functions** to measure real statistical distributions.

---

## 2. The `FILTER (WHERE ...)` Clause

In standard SQL, calculating conditional aggregates requires messy `CASE` expressions:

```sql
-- The legacy, cumbersome way:
SELECT 
    department,
    SUM(CASE WHEN status = 'active' THEN salary ELSE 0 END) AS active_salary
FROM employees GROUP BY department;
```

PostgreSQL implements the ANSI SQL standard **`FILTER (WHERE ...)` clause**, which is cleaner, faster, and self-documenting:

```sql
SELECT 
    department,
    COUNT(*) AS total_staff,
    COUNT(*) FILTER (WHERE status = 'active') AS active_staff,
    COUNT(*) FILTER (WHERE status = 'on_leave') AS on_leave_staff,
    AVG(salary) FILTER (WHERE tenure_years > 3) AS senior_avg_salary
FROM employees
GROUP BY department;
```

---

## 3. Ordered-Set Aggregates (`WITHIN GROUP`)

Certain calculations—such as medians, percentiles, and mode—require the underlying values to be strictly sorted before the mathematical formula can be applied.

PostgreSQL uses the **`WITHIN GROUP (ORDER BY ...)`** syntax to achieve this natively:

```sql
-- Syntax:
aggregate_function(arguments) WITHIN GROUP (ORDER BY sort_column)
```

---

## 4. Calculating Medians & Service-Level Percentiles (P90, P95, P99)

### 1. The Statistical Median
The true median represents the exact 50th percentile where half of all values are lower and half are higher:
```sql
SELECT 
    endpoint,
    -- percentile_cont interpolates continuous floats between values:
    percentile_cont(0.50) WITHIN GROUP (ORDER BY response_time_ms) AS median_latency
FROM api_metrics
GROUP BY endpoint;
```

### 2. P95 and P99 Service Level Indicators (SLIs)
In distributed systems, Service Level Agreements (SLAs) are defined by the 95th and 99th percentiles:

```sql
SELECT 
    service_name,
    COUNT(*) AS total_requests,
    ROUND(AVG(response_time_ms)::numeric, 2) AS avg_latency,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY response_time_ms) AS p50_median,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_latency,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_latency
FROM api_metrics
GROUP BY service_name;
```

- `percentile_cont(p)`: **Continuous** percentile (interpolates between two points if no exact match exists).
- `percentile_disc(p)`: **Discrete** percentile (always returns a real value that exists in the dataset).

### 3. The Statistical Mode (Most Frequent Value)
```sql
SELECT mode() WITHIN GROUP (ORDER BY requested_product_id) AS top_searched_item
FROM user_search_logs;
```

---

## 5. Hypothetical-Set Aggregates

Hypothetical-set functions ask: *"If I were to insert a new row with value X into this table, what would its rank be?"*

```sql
-- What would a salary of $85,000 rank among current employees?
SELECT 
    rank(85000) WITHIN GROUP (ORDER BY salary DESC) AS hypothetical_rank,
    percent_rank(85000) WITHIN GROUP (ORDER BY salary DESC) AS hypothetical_percentile
FROM employees;
```

---

## 6. Statistical Functions: Variance, Standard Deviation & Correlation

PostgreSQL includes built-in statistical sampling:

```sql
SELECT 
    stddev_pop(temperature) AS population_standard_deviation,
    var_pop(temperature)    AS population_variance,
    -- Compute Pearson correlation coefficient between marketing spend and signups:
    corr(marketing_spend, new_signups) AS marketing_correlation
FROM marketing_campaigns;
```

---

## 7. Hands-On Exercises

1. Create an `api_latency_logs` table with `endpoint TEXT` and `duration_ms INT`.
2. Populate 1,000 simulated requests with a few extreme latency spikes (e.g. 5,000ms).
3. Compute the `AVG()`, `p50`, `p95`, and `p99` latency per endpoint.
4. Observe how `AVG` is distorted by the spikes, whereas `p50` remains stable.

---

## 8. Summary & Key Takeaways

1. `FILTER (WHERE ...)` replaces legacy `CASE` statements inside aggregate functions.
2. Never rely solely on `AVG()` for latency or financial telemetry; use percentiles.
3. `percentile_cont(0.50) WITHIN GROUP (ORDER BY ...)` computes the exact mathematical median.
4. `P95` and `P99` percentiles reveal true worst-case user experiences in microservices.
5. `mode()` identifies the most common discrete element in a dataset.
