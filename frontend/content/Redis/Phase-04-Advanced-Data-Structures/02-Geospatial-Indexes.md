# 02 — Geospatial Indexes

> A comprehensive reference covering Redis's geospatial commands for storing locations and running "what's nearby" queries, built on top of Sorted Sets.

---

## Table of Contents

1. [The Problem: "What's Near Me?" Needs Real Distance Math](#1-the-problem-whats-near-me-needs-real-distance-math)
2. [The Analogy: A Sorted Set Wearing a Geography Hat](#2-the-analogy-a-sorted-set-wearing-a-geography-hat)
3. [Internal Flow: Storing and Querying Locations](#3-internal-flow-storing-and-querying-locations)
4. [Code Example: Coffee Shops Within Range](#4-code-example-coffee-shops-within-range)
5. [Geospatial Command Reference](#5-geospatial-command-reference)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: "What's Near Me?" Needs Real Distance Math

"Find all coffee shops within 2km of me" sounds like a simple filter, but it isn't one you can express with the data structures covered so far. A plain Sorted Set can rank things by a single numeric score — but a location has *two* numbers (latitude and longitude), and "within 2km" requires actual geographic distance math (accounting for the fact that the Earth is a sphere, not a flat grid), not a simple numeric range comparison.

Rolling this yourself means implementing haversine-style distance calculations in application code, then filtering candidates from wherever they're stored — expensive to compute at scale and easy to get subtly wrong. Redis instead builds this capability directly into the server.

---

## 2. The Analogy: A Sorted Set Wearing a Geography Hat

**Real-world analogy:** imagine a guest list sorted not by a single number, but by a clever combined code that encodes "where on the map" someone is, in a way that guests near each other in real life end up near each other in the sorted list too. That's exactly what Redis does: it takes a location's longitude and latitude and encodes them together into a single sortable number (a **geohash**), then stores that number as the *score* of a member in an ordinary Sorted Set.

So a "geospatial index" in Redis isn't a fundamentally new data structure — **it's a Sorted Set with a geography superpower**. The geospatial commands (`GEOADD`, `GEOSEARCH`, `GEODIST`, `GEOPOS`) are really just friendly wrappers around `ZADD`/`ZRANGE`-style operations that know how to encode and decode that geohash score into real distance and radius queries.

---

## 3. Internal Flow: Storing and Querying Locations

- **`GEOADD key longitude latitude member [longitude latitude member ...]`** — adds one or more locations to the geospatial index stored at `key`. Returns the number of *new* elements added (existing members that are updated don't count unless the `CH` option is used).
- **`GEOSEARCH key FROMLONLAT longitude latitude BYRADIUS radius unit [ASC|DESC]`** (or `FROMMEMBER member` instead of coordinates, or `BYBOX width height unit` instead of a radius) — searches for members within a shape centered on a point or an existing member, returning matching member names (optionally with `WITHCOORD`/`WITHDIST`/`WITHHASH` for extra detail per match).
- **`GEODIST key member1 member2 [unit]`** — returns the distance between two already-stored members.
- **`GEOPOS key member [member ...]`** — returns the stored longitude/latitude for one or more members (note: due to the internal 52-bit geohash encoding, the coordinates returned can differ from the originals by a very small amount — a precision trade-off, not a bug).

**The single most important detail to get right:** Redis geospatial commands expect **longitude before latitude**, in every command. This is the opposite of how most people casually say "lat/long" out loud, and it's a very easy mistake to make.

---

## 4. Code Example: Coffee Shops Within Range

Adding a coffee shop in downtown San Francisco (longitude `-122.4194`, latitude `37.7749`) to a geospatial index called `shops`:

```
127.0.0.1:6379> GEOADD shops -122.4194 37.7749 "shop:sf-downtown"
(integer) 1
```

The reply `1` confirms one new member was added. Now searching from a nearby point (longitude `-122.42`, latitude `37.78`) for anything within 5km:

```
127.0.0.1:6379> GEOSEARCH shops FROMLONLAT -122.42 37.78 BYRADIUS 5 km ASC
1) "shop:sf-downtown"
```

The stored shop is roughly 0.6km from the search point, well inside the 5km radius, so it's returned. `ASC` sorts results nearest-first, which matters once there are multiple matches.

**Python (`redis-py`) equivalent, adding a second shop and querying both:**

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# GEOADD: longitude, latitude, member — in that order
r.geoadd("shops", (-122.4194, 37.7749, "shop:sf-downtown"))
r.geoadd("shops", (-122.4783, 37.7694, "shop:sf-sunset"))

# GEOSEARCH from a point, within 5km, nearest first
nearby = r.geosearch("shops", longitude=-122.42, latitude=37.78, radius=5, unit="km")
print(nearby)  # ['shop:sf-downtown']  -- shop:sf-sunset is ~5.7km away, outside the radius

# GEODIST between the two stored shops
print(r.geodist("shops", "shop:sf-downtown", "shop:sf-sunset", unit="km"))  # distance in km, as a string-like float
```

`r.geoadd(key, (longitude, latitude, member))` in `redis-py` takes a tuple — a fixed-size, ordered, immutable grouping of values — bundling the three pieces of one location together; passing multiple tuples in sequence lets you add several locations in a single call.

---

## 5. Geospatial Command Reference

| Command | Purpose | Returns |
|---|---|---|
| `GEOADD key long lat member ...` | Add/update one or more locations | Count of *new* members added |
| `GEOSEARCH key FROMLONLAT/FROMMEMBER ... BYRADIUS/BYBOX ...` | Query members within a radius or box | List of matching member names (or with extra fields if `WITHCOORD`/`WITHDIST`/`WITHHASH` requested) |
| `GEODIST key member1 member2 [unit]` | Distance between two stored members | Distance as a numeric string, or `nil` if either member doesn't exist |
| `GEOPOS key member ...` | Look up a member's stored coordinates | Longitude/latitude pairs (with small precision loss from geohash encoding) |

---

**Common mistakes:**
- Mixing up the argument order and passing latitude before longitude — Redis geospatial commands always expect **longitude first**, which is the reverse of how "latitude and longitude" is commonly spoken.
- Assuming `GEOPOS` returns back the *exact* coordinates you originally stored — the geohash encoding used internally introduces a tiny precision loss, so round-tripped coordinates can differ very slightly from the originals.

**Interview angle:** A common question is "how would you implement 'find nearby X' without a dedicated geospatial database?" The strong answer names Redis's geospatial commands specifically, explains that they're Sorted Sets under the hood (score = an encoded geohash), and — this is the detail that separates someone who's actually used it from someone reciting a feature list — mentions the longitude-before-latitude argument order unprompted.

---

## 6. Hands-On Exercises

### Exercise 1 — Build a small shop index and query it two ways

Using `redis-cli`, add three or four locations (real or made-up coordinates) to a `shops` geospatial index. Query them once with `GEOSEARCH ... BYRADIUS` and once with `GEOSEARCH ... BYBOX`, comparing which locations each shape includes for the same center point.

### Exercise 2 — Measure precision loss with GEOPOS

Add one location with several decimal places of precision (e.g. `-122.419416 37.774929`). Run `GEOPOS` on that member and compare the returned coordinates to what you stored — note how many decimal places differ and roughly how much real-world distance that discrepancy represents.

### Exercise 3 — Rank results by distance from a moving point

Store 5 locations spread across a city. Run `GEOSEARCH` with `WITHDIST` from three different center points (e.g. simulating a user moving across town) and observe how the ordering and included members change as the center point moves.

---

## 7. Interview Q&A

### Q1. What data structure actually backs Redis's geospatial index?

**Answer:** A Sorted Set. Redis encodes each location's longitude and latitude into a single sortable geohash value and stores that as the member's score, so geospatial commands are really specialized wrappers around Sorted Set operations.

### Q2. What's the single most common mistake when using `GEOADD`?

**Answer:** Passing latitude before longitude. Redis geospatial commands always expect longitude first, then latitude — the opposite order from how people typically say "lat/long" out loud — and getting this backwards silently stores the location in the wrong place on Earth.

### Q3. How would you find all locations within a 2km radius of a given point?

**Answer:** `GEOSEARCH key FROMLONLAT <lon> <lat> BYRADIUS 2 km`, optionally with `ASC` to sort nearest-first and `WITHDIST` to include each result's distance from the center point.

### Q4. Does `GEOPOS` return exactly the coordinates you stored with `GEOADD`?

**Answer:** Not exactly — Redis encodes coordinates into a 52-bit geohash internally, which introduces a very small precision loss. The coordinates you get back from `GEOPOS` can differ from the originals by a tiny amount, which is expected behavior, not a bug.

### Q5. How do you find the distance between two already-stored locations?

**Answer:** `GEODIST key member1 member2 [unit]`, which returns the distance directly without needing to re-supply either member's coordinates; if either member doesn't exist in the index it returns `nil`.

---

> 🧠 **Memory hook:** "Longitude, then latitude — same order as 'x, y' on a graph, not the order you say 'lat-long' out loud."
