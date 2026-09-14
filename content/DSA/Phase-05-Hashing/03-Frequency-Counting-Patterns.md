# Frequency Counting Patterns

## 1. Problem

A huge fraction of practical text and data problems boil down to one question asked over and over: "how many times does each thing appear?" How many times does each word show up in a document? Which product SKU was ordered the most this month? Are two words anagrams of each other — meaning they use *exactly* the same letters the *exact* same number of times, just rearranged? Do two datasets contain the same multiset of values? Every one of these is really "build a tally of occurrences, then compare or query that tally" — and a hash map is the natural structure for the tally itself, because it needs to associate an arbitrary key (a word, a character, a product ID) with a running count, updated in O(1) per occurrence.

Doing this without a hash map usually means sorting first (to bring identical items next to each other so you can count runs) — which works, but costs O(n log n) instead of the O(n) a single pass with a hash map achieves. Python's `collections.Counter` is purpose-built for exactly this pattern: it's a `dict` subclass specialized for counting, with conveniences (default zero for missing keys, `.most_common()`, multiset-style arithmetic) layered on top of the same hashing mechanics from the earlier lessons in this phase.

## 2. Analogy

Picture a vote-counting table at an election: as each ballot comes in, a clerk doesn't re-sort the whole pile of ballots seen so far — they walk straight to the tally sheet row for that candidate's name and add one tick mark. If the candidate's row doesn't exist yet, they add a new row starting at one tick. At the end, the tally sheet *is* the answer — no separate counting pass needed, because every ballot updated its row the instant it was processed. `Counter` is exactly that tally sheet: every element you feed it walks straight to its row (bucket, from the hashing lessons) and increments a running total, one pass, no sorting required.

## 3. Internal Flow

The pattern has three recurring shapes:

1. **Build the tally.** Walk the input once; for each element, increment its count in a hash map. `Counter(iterable)` does this in one call — feed it a string and it counts characters, feed it a list and it counts elements.
2. **Compare tallies.** Two collections are anagrams of each other (or "same multiset") exactly when their tallies are identical — same keys, same counts, for every key in either tally. `Counter` overrides equality so `Counter(a) == Counter(b)` checks precisely this, and it correctly treats a key that's absent from both sides (or present with count zero) as a non-issue rather than a mismatch.
3. **Query the tally.** Once you have counts, "most frequent" and "least frequent" become lookups over the tally rather than re-scans of the original data: `Counter.most_common(k)` returns the top-`k` keys by count directly (internally, this is a sort over the much smaller set of *distinct* keys, not the original data), and the same idea generalizes to "least frequent" by sorting ascending or using `most_common()[:-k-1:-1]`.

The key efficiency insight: once the tally is built, every downstream question ("is X more frequent than Y," "what's the count of Z," "are these two collections anagrams") is answered by looking at the (usually much smaller) set of distinct keys and their counts — not by re-scanning the original, possibly much larger, input every time.

## 4. Example

Anagram checking via `Counter` comparison, followed by finding the top-k frequent elements via `Counter` plus a sort:

```python
from collections import Counter

def is_anagram(s1, s2):
    return Counter(s1) == Counter(s2)

print("is_anagram('listen', 'silent') ->", is_anagram("listen", "silent"))
print("Counter('listen') ->", Counter("listen"))
print("Counter('silent') ->", Counter("silent"))
print("is_anagram('listen', 'silentx') ->", is_anagram("listen", "silentx"))
print("is_anagram('aab', 'abb') ->", is_anagram("aab", "abb"))

words = ["the", "quick", "brown", "fox", "the", "fox", "the", "jumps", "fox"]
counts = Counter(words)
print("Counter(words) ->", counts)

k = 2
top_k = sorted(counts.items(), key=lambda pair: pair[1], reverse=True)[:k]
print(f"Top-{k} frequent:", top_k)

print("most_common(2) ->", counts.most_common(2))
```

Executed output:

```
is_anagram('listen', 'silent') -> True
Counter('listen') -> Counter({'l': 1, 'i': 1, 's': 1, 't': 1, 'e': 1, 'n': 1})
Counter('silent') -> Counter({'s': 1, 'i': 1, 'l': 1, 'e': 1, 'n': 1, 't': 1})
is_anagram('listen', 'silentx') -> False
is_anagram('aab', 'abb') -> False
Counter(words) -> Counter({'the': 3, 'fox': 3, 'quick': 1, 'brown': 1, 'jumps': 1})
Top-2 frequent: [('the', 3), ('fox', 3)]
most_common(2) -> [('the', 3), ('fox', 3)]
```

Note that `Counter('listen')` and `Counter('silent')` print their entries in a *different* order (each `Counter` lists keys in the order it first encountered them while scanning its own string) yet still compare equal — `==` on a `Counter` checks that every key maps to the same count on both sides, regardless of insertion order, which is exactly the multiset-equality semantics anagram checking needs.

## 5. Compare

Sorting both strings and comparing (`sorted(s1) == sorted(s2)`) also correctly detects anagrams, and for very short strings it's perfectly reasonable — but it costs O(n log n) per comparison versus the O(n) a single `Counter` build achieves, and that gap widens as strings get longer or as you need to check many pairs against each other (in which case building one `Counter` per string once and comparing/hashing them repeatedly beats re-sorting on every comparison). The frequency-tally pattern in this lesson is also the direct foundation for the next lesson's hashmap-based sum-finding techniques: both rely on the same core move — trade a second linear scan (or nested loop) for O(1) hash map lookups against information already gathered in a first pass.

## 6. Common Mistakes

- **Reaching for `sorted(s1) == sorted(s2)` out of habit when a hashmap/Counter is more efficient at scale.** Sorting is O(n log n); building and comparing counts is O(n). For a single short string this difference is invisible, but the moment the problem involves many strings or long strings, the sorting approach's extra log factor adds up — and it's worth being able to state *why* the Counter approach is the better default even when both pass the test cases.
- **Manually comparing two plain `dict` tallies and getting bitten by absent vs. zero-count keys.** `Counter` equality correctly treats "key absent" and "key present with count zero" as equivalent, but if you build tallies with plain `dict` objects and one side happens to have an explicit zero-count entry the other side lacks, a naive `dict1 == dict2` comparison sees them as *different* dictionaries (different key sets) even though the "real" counts they represent are identical — `Counter` sidesteps this by design; hand-rolled dict comparisons don't get that for free.
- **Forgetting `Counter` returns 0, not a `KeyError`, for missing keys.** This is usually a convenience (no need for `.get(key, 0)`), but it also means a typo'd key silently returns 0 instead of raising — worth being deliberate about when correctness depends on a key definitely being present.
- **Using `most_common()` on a Counter that's still being mutated inside a loop.** `most_common()` returns a snapshot list at the moment it's called; recomputing it inside a hot loop instead of building the tally fully first and querying once is a common efficiency mistake.
- **Assuming anagram-checking requires equal-length strings up front.** It's true that unequal-length strings can never be anagrams, but relying on a length check *instead of* a full tally comparison is fragile — always let the count comparison itself decide, since it automatically subsumes the length check for you (`Counter('aab') != Counter('ab')` fails on the counts, not just the lengths, and either way returns the correct verdict).

## 7. Interview Angle

"Valid Anagram" and "Top K Frequent Elements" are two of the most commonly asked frequency-counting problems, and both exist specifically to check whether you reach for a hash map (or `Counter`) rather than sorting or nested loops. A common follow-up on anagram-checking: "can you do it in one pass without a second data structure?" — the expected answer is a single `Counter` built by incrementing on one string and decrementing on the other, then checking all counts landed at zero, which is still hashmap-based, just merged into one pass instead of two. For "top-k frequent," an interviewer will often push past the `sorted()` approach shown here (O(n log n) over the distinct keys) toward a heap-based solution (O(n log k), using a min-heap of size k) — knowing that the Counter-building step is the same either way, and only the "select top k" step changes, shows you understand where the actual optimization opportunity lives.

## 8. Memory Hook

**Counter = a tally sheet at a vote count — one tick mark per ballot, no re-sorting the pile.** Anagram checking is "do these two tally sheets match, key for key" — not "do these two strings look the same after alphabetizing." Reach for `Counter` the instant a problem says "count," "frequency," "most common," or "same letters, different order."
