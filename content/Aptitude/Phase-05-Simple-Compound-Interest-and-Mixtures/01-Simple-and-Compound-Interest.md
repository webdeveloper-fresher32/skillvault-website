# Simple and Compound Interest — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

**Simple interest (SI)** is interest paid only on the original principal, every year, at a flat rate — the interest amount is identical each year. **Compound interest (CI)** is interest paid on the principal *plus* all previously accumulated interest, so each year's interest is a little larger than the last, because it's being calculated on a growing base.

$$\text{SI} = \frac{P \times R \times T}{100} \qquad \text{CI} = P\left(1 + \frac{R}{100}\right)^T - P$$

where P = principal, R = rate of interest per annum (%), T = time in years.

**Plain-English example:** Put ₹100 at 10% per annum for 2 years. Under SI you earn ₹10 in year 1 and another flat ₹10 in year 2 — total ₹20. Under CI you earn ₹10 in year 1 (10% of 100), but in year 2 you earn 10% of ₹110 (the new balance), which is ₹11 — total ₹21. That extra ₹1 is interest-on-interest, and it's the entire reason CI ever exceeds SI. For year 1, SI and CI are always identical — the gap only opens up from year 2 onward.

The other thing tested constantly is **non-annual compounding**: a bank might quote "10% per annum compounded half-yearly," which does *not* mean 10% every six months. It means the annual rate is split in half (5% per half-year) and applied twice, and the number of compounding periods doubles to match.

---

## 2. Shortcut / Trick

### CI − SI difference for 2 years

$$\text{CI} - \text{SI (for 2 years)} = P\left(\frac{R}{100}\right)^2$$

This is a direct algebraic consequence: SI for 2 years = 2PR/100, while CI for 2 years = P[(1+R/100)² − 1] = P[2R/100 + (R/100)²]. Subtracting, every term cancels except P(R/100)² — the difference is exactly one year's interest *on* one year's interest. This shortcut only holds for **2 years**; for 3 years the difference formula is different (P(R/100)²(3 + R/100)) and isn't needed for most aptitude papers.

Rearranged, this also lets you go backward: if a question gives you the CI−SI difference and the rate, you can find the principal instantly without ever computing CI or SI separately:

$$P = \frac{\text{CI} - \text{SI}}{(R/100)^2}$$

### Effective annual rate for non-annual compounding

For a nominal annual rate R compounded *n* times a year, each compounding period uses rate R/n, and the number of periods over T years is n×T:

$$\text{Amount} = P\left(1 + \frac{R}{100n}\right)^{nT}$$

- **Half-yearly:** n = 2, so use rate R/2 per period and double the number of periods (2T periods total).
- **Quarterly:** n = 4, so use rate R/4 per period and quadruple the number of periods (4T periods total).

The **effective annual rate** (the single equivalent annual rate that would give the same growth as the split compounding) is:

$$\text{Effective rate} = \left[\left(1 + \frac{R}{100n}\right)^n - 1\right] \times 100$$

This is always slightly *higher* than the nominal rate R whenever n > 1 — more frequent compounding always compounds to a bit more.

---

## 3. Worked Examples

### (a) Find the CI on ₹10,000 for 2 years at 10% per annum

$$\text{CI} = 10000\left(1 + \frac{10}{100}\right)^2 - 10000 = 10000 \times 1.21 - 10000 = 12100 - 10000 = 2100$$

**Check:** SI for the same sum = 10000×10×2/100 = 2000. CI − SI should equal P(R/100)² = 10000×(0.1)² = 100. And indeed 2100 − 2000 = 100. Matches.

### (b) The difference between CI and SI on a sum for 2 years at 5% per annum is ₹25. Find the sum.

Using the shortcut directly:

$$P = \frac{\text{CI} - \text{SI}}{(R/100)^2} = \frac{25}{(0.05)^2} = \frac{25}{0.0025} = 10000$$

**Check:** SI for 2 years on ₹10,000 at 5% = 10000×5×2/100 = 1000. CI = 10000×(1.05)² − 10000 = 10000×1.1025 − 10000 = 11025 − 10000 = 1025. Difference = 1025 − 1000 = 25. Matches.

### (c) Find the CI on ₹8,000 for 1.5 years at 10% per annum, compounded half-yearly

Half-yearly compounding: rate per half-year = 10/2 = 5%, number of half-year periods = 1.5 × 2 = 3.

$$\text{Amount} = 8000 \times (1.05)^3 = 8000 \times 1.157625 = 9261$$

$$\text{CI} = 9261 - 8000 = 1261$$

**Check:** Step through period by period. After period 1: 8000×1.05 = 8400. After period 2: 8400×1.05 = 8820. After period 3: 8820×1.05 = 9261. Matches the direct power calculation, confirming 3 periods at 5% each is the correct setup (not 1.5 periods at 10%, which would be a common but wrong shortcut).

---

## 4. Timed Practice Set

1. Find the SI on ₹5,000 at 8% per annum for 3 years. (20 sec)
2. Find the CI on ₹5,000 at 8% per annum for 2 years. (40 sec)
3. The difference between CI and SI on a certain sum for 2 years at 8% per annum is ₹64. Find the sum. (40 sec)
4. Find the CI on ₹15,000 at 20% per annum for 2 years, compounded half-yearly. (50 sec)
5. Find the CI on ₹20,000 at 8% per annum for 1 year, compounded quarterly. (50 sec)
6. A sum triples the SI earned in year 1 vs. CI earned in year 1 — true or false, and why? (20 sec)
7. Find the effective annual rate for a nominal rate of 10% per annum compounded half-yearly. (40 sec)
8. The CI on a sum for 2 years at 10% per annum is ₹210. Find the SI on the same sum for 2 years at the same rate. (40 sec)

### Answer Key

1. **₹1,200** — SI = 5000×8×3/100 = 1200.
2. **₹832** — CI = 5000×(1.08)² − 5000 = 5000×1.1664 − 5000 = 5832 − 5000 = 832.
3. **₹10,000** — P = 64/(0.08)² = 64/0.0064 = 10000.
4. **₹6,961.5** — half-yearly: rate = 10% per period (20/2), periods = 4 (2 years × 2); Amount = 15000×(1.1)⁴ = 15000×1.4641 = 21961.5; CI = 21961.5 − 15000 = 6961.5.
5. **₹1,648.64** — quarterly: rate = 2% per period, periods = 4; Amount = 20000×(1.02)⁴ = 20000×1.08243216 = 21648.6432; CI = 1648.64 (rounded).
6. **False** — SI and CI are always equal for year 1, since no interest-on-interest has accumulated yet; they only diverge from year 2 onward.
7. **10.25%** — Effective rate = [(1.05)² − 1]×100 = [1.1025 − 1]×100 = 10.25%.
8. **₹200** — first find P from the CI: P[(1.1)² − 1] = 210 ⟹ P×0.21 = 210 ⟹ P = 1000. Then SI = 1000×10×2/100 = 200.
