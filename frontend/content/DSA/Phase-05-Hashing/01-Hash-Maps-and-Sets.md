# Hash Maps and Sets

## 1. Problem

Imagine you're building a contacts app with ten thousand entries, and every time the user types a name into the search box you need to answer "does this contact exist, and if so, what's their number?" If contacts are stored in a plain list, answering that question means walking the list from the start, comparing names one at a time, until you either find a match or run off the end — on average you'll check half the list, and in the worst case (no match) you'll check every single entry. That's an O(n) lookup, and it gets slower, linearly, as the contact list grows. Do this for every keystroke of an autocomplete box and the app visibly lags.

What you actually want is a structure where "does this key exist, and what's its value" can be answered in roughly the same amount of time whether there are ten contacts or ten million. That's exactly what a **hash map** (and its close cousin, the **hash set**, which only tracks membership, not values) is built for. Instead of scanning, it computes a number from the key itself and uses that number to jump almost directly to where the answer should be — average-case O(1) lookup, insert, and delete. This is one of the most load-bearing ideas in all of programming: databases index rows this way, compilers track variable scopes this way, and a huge fraction of "how do you make this faster" interview questions are secretly asking "did you notice you could use a hash map here?"

## 2. Analogy

Think of a library that, instead of shelving books alphabetically and making you scan shelf by shelf, assigns every book a locker number computed directly from its title — say, by adding up the letters and taking the remainder when divided by the number of lockers. Handed a title, you don't search anything: you recompute that same locker number and walk straight to it. Two completely different titles might occasionally compute to the same locker (a **collision** — covered in the next lesson), so each locker actually holds a small tray where a few books can sit together, but you almost never need to sift through more than one or two.

A hash map is that locker system: the **key** (the book title) is run through a **hash function** that produces a **bucket index** (the locker number), and the **value** (or, for a set, just the fact that the key exists) lives at that bucket. Compute the hash, jump to the bucket — no scanning the whole shelf.

## 3. Internal Flow

A hash map is backed by an array of **buckets**. Three things happen every time you insert, look up, or delete a key:

1. **Hash the key.** A hash function takes the key and produces an integer — for strings this typically involves combining the character codes (and, in real implementations, mixing bits to spread values evenly). Python's built-in `hash()` does this for any hashable object.
2. **Map the hash to a bucket index.** The raw hash can be astronomically large or negative, so it's reduced with `hash(key) % num_buckets` to land inside the array's actual size.
3. **Operate on that bucket.** For insert, the key-value pair is stored in that bucket (handling any collision — see Lesson 2). For lookup, the bucket is checked for a matching key. For delete, the matching entry is removed from that bucket.

Because step 1 and step 2 take constant time (independent of how many keys are already stored) and a well-designed hash function spreads keys evenly enough that any one bucket holds only a handful of entries, checking a bucket is also effectively constant time. That's the source of the **average-case O(1)** guarantee: you never touch more than a small, roughly-fixed number of entries, regardless of how large the map has grown. This is *average-case*, not worst-case — enough collisions crammed into one bucket can degrade lookups toward O(n) (Lesson 2 covers exactly how, and how resizing keeps it from happening in practice).

Python gives you this behavior for free: `dict` is the practical hash map (keys mapped to values) and `set` is the practical hash set (keys with no attached value, just membership). Both are implemented in C using this exact bucket/hash-index scheme, which is why `key in some_dict` and `item in some_set` are O(1) average case, while `item in some_list` is O(n).

## 4. Example

Replacing an O(n) linear scan with an O(1) dict lookup, built from the same source list:

```python
def linear_scan_lookup(items, target):
    for i, item in enumerate(items):
        if item == target:
            return i
    return -1

items = ["apple", "banana", "cherry", "date", "elderberry"]
print("List scan for 'cherry':", linear_scan_lookup(items, "cherry"))
print("List scan for 'fig':", linear_scan_lookup(items, "fig"))

index_map = {item: i for i, item in enumerate(items)}
print("Dict lookup for 'cherry':", index_map.get("cherry", -1))
print("Dict lookup for 'fig':", index_map.get("fig", -1))

s = set(items)
print("'banana' in set:", "banana" in s)
print("'kiwi' in set:", "kiwi" in s)
```

Executed output:

```
List scan for 'cherry': 2
List scan for 'fig': -1
Dict lookup for 'cherry': 2
Dict lookup for 'fig': -1
'banana' in set: True
'kiwi' in set: False
```

Both approaches give identical answers here because the list only has five items — the difference only becomes visible as `items` grows. Qualitatively: `linear_scan_lookup` has to inspect every element up to the match (or the whole list, on a miss), so its cost grows in direct proportion to the list's length — double the list, and a missing-item search roughly doubles in work. The dict lookup (`index_map.get(...)` or `item in s`) computes one hash and jumps to one bucket regardless of how many entries the dict holds, so its cost stays essentially flat as the collection grows from five items to five million. If you plotted "time per lookup" against "collection size," the list-scan line would rise roughly linearly while the dict-lookup line would stay roughly flat — that flat line is the entire reason hash maps exist.

## 5. Compare

A hash map trades away something a sorted list or tree structure gives you for free: **order**. A `list.index()` scan or a balanced binary search tree lookup is worse or comparable in raw speed (O(n) or O(log n)) but keeps elements retrievable in sorted sequence; a hash map's O(1) average lookup comes precisely from *not* caring about order — bucket index is derived from a hash, not from comparison, so there's no sorted structure to walk. A `set` is simply a `dict` with the values stripped away — same bucket/hash mechanics, used purely to answer "have I seen this key before?" Later lessons in this phase (chaining, open addressing) are about *how* the bucket array survives collisions internally; this lesson is about the contract a hash map offers on the surface: near-constant-time lookup, insert, and delete, in exchange for giving up ordering guarantees.

## 6. Common Mistakes

- **Using a mutable type (like a `list`) as a dict key.** Keys must be hashable, and Python's mutable containers (`list`, `dict`, `set`) deliberately have no stable `__hash__` — if they did, mutating the key after insertion would silently move it to the wrong bucket forever. Attempting `{[1, 2]: "x"}` raises `TypeError: unhashable type: 'list'` immediately; use a `tuple` instead if you need a sequence as a key.
- **Assuming dict iteration order matters for hashing logic.** Since Python 3.7, dicts preserve insertion order when you iterate them — but that's an implementation guarantee about *iteration*, not a hint about *how keys map to buckets*. Two keys inserted in a particular order still land in whatever bucket their hash dictates; don't write logic that assumes "inserted earlier" implies "hashes to an earlier bucket" or "sorts before."
- **Forgetting that equal objects must hash equal.** If you override `__eq__` on a custom class without also overriding `__hash__` consistently, two objects that compare equal can land in different buckets, and dict/set lookups for one will silently fail to find the other.
- **Treating average-case O(1) as worst-case.** A pathological hash function (or an attacker deliberately choosing keys that all collide) can degrade every operation toward O(n); "hash map lookup is O(1)" is a statement about the typical case, not a guarantee.
- **Reaching for a list membership check (`item in some_list`) out of habit.** It's easy to default to a list simply because that's what the data arrived in, without noticing that converting to a `set` once and checking membership repeatedly turns a string of O(n) checks into a string of O(1) checks.

## 7. Interview Angle

"Can you do better than O(n²)?" is the single most common nudge toward a hash map in interviews — any time a problem involves checking "have I seen this value before" or "what's the value associated with this key" inside a loop, a nested loop or repeated linear scan is the naive answer, and a hash map collapsing that inner scan to O(1) is almost always the intended optimization. Interviewers also probe whether you know the difference between `dict` (key→value) and `set` (key existence only) and pick the right one — using a `dict` with throwaway values (`{"seen": True}`) when a `set` would do is a small tell that you haven't fully internalized the distinction. Be ready to state the space/time tradeoff explicitly: hash maps trade O(n) extra space for turning O(n) or O(n²) time into O(n), and to explain *why* the O(1) holds (hashing + bucket indexing) rather than just quoting it.

## 8. Memory Hook

**Hash map = library with locker numbers computed from the title, not shelved alphabetically.** No scanning shelves — compute the hash, jump straight to the bucket. The moment you catch yourself writing `for item in list: if item == target`, ask whether a `dict` or `set` would turn that scan into a jump.
