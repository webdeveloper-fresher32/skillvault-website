# Time and Work — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Time and work problems are time-speed-distance problems wearing a different costume: instead of "distance covered," you're tracking "work done," and instead of "speed," you're tracking "rate of work per day." The core relationship is identical: **work = rate × time**. If a person can finish an entire job in n days, their rate is 1/n of the job per day — that single fraction is the key that unlocks almost every question in this topic, because once everyone's rate is expressed as "work done per day," you can add rates together exactly like you'd add speeds for two people walking toward each other.

Pipes and cisterns are just time-and-work with a sign convention bolted on: a pipe that *fills* a tank contributes a **positive** rate (it adds to the work getting done), while a pipe that *empties* the tank contributes a **negative** rate (it undoes work). Once you assign the correct sign to each pipe, combining them is just addition, same as any other combined-rate problem.

**Plain-English example:** If A can paint a room alone in 10 days, A does 1/10 of the room per day. If B can paint the same room alone in 15 days, B does 1/15 per day. Working together, they do 1/10 + 1/15 = 1/6 of the room per day — so together they finish in 6 days. Notice 6 is less than either individual time, which must always be true: two people working together can never take longer than the faster person alone.

---

## 2. Shortcut / Trick

### The 1/n per-day rate

If a job takes n days for one worker (or one pipe, or one team) alone, that worker's rate is **1/n of the job per day**. This converts every "X can do a job in N days" statement into a rate you can add, subtract, or scale — no separate technique needed for different phrasings of the same idea.

### Combining rates (working together)

$$\text{Combined rate} = \frac{1}{a} + \frac{1}{b} \quad \Rightarrow \quad \text{Combined time} = \frac{1}{\frac{1}{a}+\frac{1}{b}} = \frac{ab}{a+b}$$

For two workers this simplifies to the product-over-sum shortcut, ab/(a+b) — memorize this form so you can skip the fraction-adding step entirely when only two workers/pipes are involved.

### Work and wages — split by efficiency, not by headcount

When two or more people work together for the *same total time* and are paid a lump sum for the job, the money is split in the ratio of their individual **efficiencies** (their per-day rates), which is the same as the ratio of the total *work* each one actually contributed — never split it equally just because they worked the same number of days.

$$\text{Wage ratio} = \text{Efficiency ratio} = \frac{1}{(\text{days A alone})} : \frac{1}{(\text{days B alone})}$$

### Pipes and cisterns — sign convention

- **Inlet pipe** (fills the tank): rate is **+1/n** (positive — adds to the work of filling).
- **Outlet pipe** (drains the tank): rate is **−1/m** (negative — subtracts from the work of filling).

Add up all the signed rates to get the net rate, then take the reciprocal for the net time. If the net rate comes out negative, the tank is being drained overall, not filled — a useful sanity check on your setup.

---

## 3. Worked Examples

### (a) A and B together vs. alone

A can complete a job alone in 12 days, and B can complete the same job alone in 18 days. How long will they take working together?

$$\text{Combined rate} = \frac{1}{12} + \frac{1}{18} = \frac{3}{36} + \frac{2}{36} = \frac{5}{36} \text{ of the job per day}$$

$$\text{Combined time} = \frac{36}{5} = 7.2 \text{ days}$$

**Check:** 7.2 days at a combined rate of 5/36 per day gives 7.2 × 5/36 = 36/36 = 1 whole job done. Also, 7.2 is less than both 12 and 18, as it must be. Matches.

### (b) One pipe fills, another empties, both open together

Pipe A can fill a tank in 6 hours. Pipe B can empty the same full tank in 8 hours. If both pipes are opened together on an empty tank, how long will it take to fill?

Inlet rate = +1/6 per hour. Outlet rate = −1/8 per hour.

$$\text{Net rate} = \frac{1}{6} - \frac{1}{8} = \frac{4}{24} - \frac{3}{24} = \frac{1}{24} \text{ of the tank per hour}$$

$$\text{Time to fill} = 24 \text{ hours}$$

**Check:** In 24 hours, pipe A alone would have filled 24/6 = 4 tanks' worth, while pipe B alone would have drained 24/8 = 3 tanks' worth. Net = 4 − 3 = 1 full tank. Matches — and the net time (24 h) is correctly larger than A's solo time (6 h), since B is working against A.

### (c) Work and wages split by efficiency

A can do a piece of work alone in 10 days, and B can do the same work alone in 20 days. They work together and complete the job, earning a total of ₹900. How should the money be split?

Efficiency ratio = 1/10 : 1/20 = 2 : 1 (A is twice as efficient as B, since A finishes in half the time).

- A's share = 900 × 2/3 = **₹600**
- B's share = 900 × 1/3 = **₹300**

**Check:** In the time they work together, A does exactly twice as much of the job as B (efficiency ratio 2:1), so A deserves exactly twice B's pay: 600 = 2 × 300. And 600 + 300 = 900, matching the total.

---

## 4. Timed Practice Set

1. A can finish a job alone in 15 days and B alone in 10 days. How long will they take working together? (45 sec)
2. A, B, and C can individually complete a job in 20, 30, and 60 days respectively. How long will they take working together? (60 sec)
3. A can do a job in 8 days. After A works alone for 2 days, B joins and together they finish the remaining work in 3 days. In how many days could B alone have done the whole job? (75 sec)
4. Pipe A fills a tank in 5 hours; pipe B fills the same tank in 10 hours. If both are opened together, how long to fill the tank? (45 sec)
5. Pipe A fills a tank in 4 hours; pipe B (an outlet) empties it in 6 hours. If both are opened together on an empty tank, how long to fill it? (60 sec)
6. A and B together can finish a job in 12 days. A alone can finish it in 20 days. How long would B alone take? (60 sec)
7. A, B, and C together earn ₹2,160 for a job. A can do it alone in 6 days, B in 8 days, and C in 12 days. Find each person's share. (75 sec)
8. A tank is filled by pipe A in 6 hours. Pipe B can empty a full tank in 12 hours. If the tank is empty and both pipes are opened together, how long will it take to fill? (45 sec)

### Answer Key

1. **6 days** — rate = 1/15+1/10 = 2/30+3/30 = 5/30 = 1/6; time = 6. (Or shortcut: 15×10/(15+10) = 150/25 = 6.)
2. **10 days** — rate = 1/20+1/30+1/60 = 3/60+2/60+1/60 = 6/60 = 1/10; time = 10.
3. **8 days** — A's rate = 1/8. In the first 2 days A alone does 2/8 = 1/4 of the job; remaining work = 3/4. Over the next 3 days, A+B together finish that 3/4, so (A+B)'s combined rate = (3/4)/3 = 1/4 per day. B's rate = 1/4 − 1/8 = 1/8, so B alone would take 8 days.
4. **10/3 hours (3 hours 20 minutes)** — rate = 1/5+1/10 = 2/10+1/10=3/10; time = 10/3.
5. **12 hours** — net rate = 1/4 − 1/6 = 3/12−2/12=1/12; time = 12.
6. **30 days** — combined rate 1/12, A's rate 1/20; B's rate = 1/12−1/20 = 5/60−3/60=2/60=1/30; B alone = 30 days.
7. **A: ₹960, B: ₹720, C: ₹480** — efficiency ratio = 1/6 : 1/8 : 1/12 = (×24) 4 : 3 : 2, sum = 9; shares = 2160×4/9=960, 2160×3/9=720, 2160×2/9=480.
8. **12 hours** — net rate = 1/6 − 1/12 = 2/12−1/12=1/12; time = 12.
