# Collision Handling Strategies

## 1. Problem

The previous lesson described a hash map as a locker system: hash the key, get a bucket index, jump straight there. But that story glossed over an inevitability — with a finite number of buckets and a practically infinite number of possible keys, sooner or later two different keys will hash to the *same* bucket. `hash("cat") % 8` and `hash("act") % 8` might both land on bucket 3 even though "cat" and "act" are different strings with different values attached. This is a **collision**, and it's not a rare edge case to be avoided — it is a mathematical certainty (the pigeonhole principle: more possible keys than buckets means some bucket must eventually hold more than one). A hash map implementation that has no answer for "what happens when two keys land in the same bucket" isn't a working hash map at all — it's a design that silently loses data the moment a collision occurs.

So every real hash map needs a deliberate strategy for what to do when the bucket you were about to write to is already occupied by a different key. The two dominant families of strategy are **chaining** (let the bucket hold more than one entry) and **open addressing** (if the bucket's full, look elsewhere in the array). Both keep the O(1) average-case promise intact, but they make different tradeoffs in memory layout, cache behavior, and how deletion is handled — and knowing which one Python's own `dict` uses (open addressing, in CPython) versus which one is easiest to implement by hand (chaining) is a distinction interviewers frequently probe.

## 2. Analogy

**Chaining** is the library locker growing a small tray: if two books hash to locker 3, both go in locker 3's tray, sitting side by side. Finding a book now means "go to locker 3, then look through the (usually very short) tray for the right title" — still fast, because the tray rarely holds more than one or two books if the hash function spreads titles well.

**Open addressing** is different: there's no tray at all — each locker holds exactly one book. If locker 3 is already occupied when you need to place a new book there, you don't stack it in; you walk to the next locker (4, then 5, ...) until you find an empty one, and you remember the *sequence* of lockers you'd need to check when later looking that book up. It's like a parking lot with no double-parking allowed: if your assigned spot is taken, you circle to the next available one.

## 3. Internal Flow

**Chaining**: each bucket in the underlying array is itself a small collection (commonly a linked list, though Python examples often use a plain list) of `(key, value)` pairs. Insert hashes the key to find the bucket, then scans that bucket's list for an existing entry with the same key (to update it) or appends a new pair (if the key is new). Lookup hashes the key, then scans that one bucket's short list until it finds a match. Because the list at any bucket only grows when *that specific bucket* keeps getting hit, chaining's worst case degrades gracefully — one crowded bucket doesn't slow down lookups into every other bucket.

**Open addressing**: there is exactly one slot per bucket, no matter what. On a collision, a **probing sequence** decides where to look next:
- **Linear probing** — check bucket `i+1`, `i+2`, `i+3`, ... until an empty slot is found. Simple, but prone to *clustering*: once a run of adjacent buckets fills up, every new collision in that region has to walk past the entire run.
- **Quadratic probing** — check `i+1²`, `i+2²`, `i+3²`, ... (spread out faster, reduces clustering but can still miss slots depending on table size).
- **Double hashing** — use a *second* hash function to determine the step size between probes, so different keys that collide at bucket `i` don't necessarily follow the same probing path, which spreads collisions out far more evenly than a fixed step.

Both families depend on the **load factor** — `number of stored entries / number of buckets` — staying low. A high load factor means chaining's per-bucket lists get long (lookups degrade toward O(n) per bucket) and open addressing's probe sequences get long (more occupied slots to skip past before finding an empty one or the target). Real hash map implementations track the load factor and, once it crosses a threshold (commonly around 0.7 for CPython's dict), **resize**: allocate a larger backing array (typically double or more) and re-insert every existing entry into it, hashed against the new, larger bucket count. This is why occasional inserts into a hash map are described as O(1) *amortized* rather than strictly O(1) — most inserts are cheap, but the rare resize costs O(n) to rehash everything, and that cost is spread ("amortized") across all the cheap inserts that preceded it.

## 4. Example

A minimal hash table built from scratch using chaining — buckets are Python lists, each holding `(key, value)` tuples — deliberately using a weak hash function (sum of character codes) to force a visible collision between anagram keys:

```python
class HashTableChaining:
    def __init__(self, num_buckets=8):
        self.num_buckets = num_buckets
        self.buckets = [[] for _ in range(num_buckets)]

    def _hash(self, key):
        return sum(ord(c) for c in key) % self.num_buckets

    def insert(self, key, value):
        idx = self._hash(key)
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                print(f"insert({key!r}, {value!r}): bucket {idx} updated existing -> {bucket}")
                return
        bucket.append((key, value))
        print(f"insert({key!r}, {value!r}): bucket {idx} -> {bucket}")

    def get(self, key):
        idx = self._hash(key)
        bucket = self.buckets[idx]
        for k, v in bucket:
            if k == key:
                return v
        raise KeyError(key)


ht = HashTableChaining(num_buckets=8)
for k in ["cat", "dog", "act", "god"]:
    print(f"hash({k!r}) = {ht._hash(k)}")

ht.insert("cat", 1)
ht.insert("dog", 2)
ht.insert("act", 3)   # anagram of "cat" -> same hash -> collision in same bucket
ht.insert("god", 4)   # anagram of "dog" -> same hash -> collision in same bucket

print("get('cat') ->", ht.get("cat"))
print("get('act') ->", ht.get("act"))
print("Final buckets:", ht.buckets)
```

Executed output:

```
hash('cat') = 0
hash('dog') = 2
hash('act') = 0
hash('god') = 2
insert('cat', 1): bucket 0 -> [('cat', 1)]
insert('dog', 2): bucket 2 -> [('dog', 2)]
insert('act', 3): bucket 0 -> [('cat', 1), ('act', 3)]
insert('god', 4): bucket 2 -> [('dog', 2), ('god', 4)]
get('cat') -> 1
get('act') -> 3
Final buckets: [[('cat', 1), ('act', 3)], [], [('dog', 2), ('god', 4)], [], [], [], [], []]
```

Because "cat" and "act" contain the exact same characters, `sum(ord(c) for c in key)` produces the same total for both, so they collide in bucket 0 — same story for "dog"/"god" in bucket 2. Chaining handles this gracefully: both entries simply sit in that bucket's list, and `get()` correctly distinguishes them by scanning the (short) list and comparing full keys, not just hashes.

## 5. Compare

Chaining and open addressing both solve the same problem but make opposite space/locality tradeoffs. Chaining needs extra memory per bucket (a list/pointer structure) but handles deletion trivially (just remove the entry from its bucket's list) and degrades predictably — one crowded bucket doesn't touch any other bucket's performance. Open addressing keeps everything in one flat array (better cache locality, since probing walks through contiguous memory), but deletion is trickier — you can't just empty a slot, because that would break the probe sequence for other keys that hashed there and probed past it (real implementations use a "deleted" tombstone marker instead of a true empty slot). CPython's actual `dict` uses open addressing internally (with pseudo-random probing) rather than chaining, but that's an implementation detail hidden entirely behind `dict`'s interface — as a user of Python's dict you never see buckets or probes at all, which is precisely the point of the abstraction the earlier lesson described.

## 6. Common Mistakes

- **Writing a hash function that clusters keys into too few buckets.** A hash function like "always return 0" or one that only looks at the first character of a string technically works but destroys the O(1) guarantee — every key funnels into the same tiny set of buckets, degrading every lookup toward O(n). The example above deliberately shows this with `sum(ord(c))`, which collides on every anagram.
- **Forgetting to handle collisions entirely when hand-rolling a hash table.** A naive first attempt often does `self.buckets[idx] = (key, value)` — overwriting whatever was there — instead of appending to a list or probing to another slot. That silently loses previously inserted data the instant two keys share a bucket index.
- **Not distinguishing "same bucket" from "same key" during lookup.** A bucket holding a list of entries still requires comparing full keys (not just hashes) when scanning it — two different keys sharing a hash are still different keys, and skipping the equality check inside the bucket would return the wrong value.
- **Ignoring load factor and never resizing.** A hash table that never grows its bucket array as entries accumulate will see its load factor climb without bound, turning every bucket's chain (or every probe sequence) longer and longer until the "hash table" behaves like a plain list.
- **Using a "delete by emptying the slot" approach in open addressing.** This breaks probe sequences for other keys that landed further along the same probe path — real open-addressing deletes need a tombstone, not a true empty marker, or subsequent lookups can incorrectly conclude a key isn't present.

## 7. Interview Angle

Interviewers frequently ask "how would you implement a hash map from scratch?" specifically to see whether you volunteer a collision strategy unprompted — silence on collisions is a red flag, since it means the "hash map" you just designed loses data under load. Chaining is the easier one to describe and implement live (a list of buckets, each a list of pairs), so it's the default answer unless the interviewer specifically asks about open addressing or memory-layout tradeoffs. A common follow-up: "what happens as your table fills up?" — the expected answer names the load factor and describes resizing/rehashing, and can explain why that makes insert *amortized* O(1) rather than always O(1). Another common one: "why not just make the table huge from the start to avoid collisions?" — the answer is memory waste (most of a huge sparse table sits empty) plus the fact that even a huge table doesn't eliminate collisions, only makes them rarer; the load factor and resizing strategy matter more than raw table size.

## 8. Memory Hook

**Chaining = tray in the locker; open addressing = walk to the next locker.** Two keys hashing the same is a certainty, not a bug — the only question is whether your bucket holds a small list (chaining) or you probe onward to find a free slot (open addressing). A hash function without a collision plan is not a hash map, it's a data-loss machine.
