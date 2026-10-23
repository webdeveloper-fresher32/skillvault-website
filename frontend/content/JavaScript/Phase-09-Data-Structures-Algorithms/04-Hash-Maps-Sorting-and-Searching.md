# Hash Maps, Sorting, and Searching — Complete Guide

## Table of Contents
1. [How Hash Maps Achieve O(1) Lookup](#1-how-hash-maps-achieve-o1-lookup)
2. [Collisions and How They're Handled](#2-collisions-and-how-theyre-handled)
3. [Map and Set in JavaScript](#3-map-and-set-in-javascript)
4. [Bubble Sort](#4-bubble-sort)
5. [Merge Sort](#5-merge-sort)
6. [Quick Sort](#6-quick-sort)
7. [Sorting Algorithm Comparison](#7-sorting-algorithm-comparison)
8. [Binary Search and Its Variants](#8-binary-search-and-its-variants)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. How Hash Maps Achieve O(1) Lookup

A hash map stores key/value pairs in a fixed-size array of "buckets." A **hash function** converts any key into a numeric index into that array, so instead of scanning every entry to find a key (O(n), like an array of pairs), you compute the bucket directly and jump straight to it (O(1) average).

```
key "apple"  ──▶ hash("apple") = 2946...  ──▶  index = hash % bucketCount = 3
key "banana" ──▶ hash("banana") = 8123... ──▶  index = hash % bucketCount = 1

Backing array (bucketCount = 5):
  index 0: (empty)
  index 1: [ "banana" → 0.55 ]
  index 2: (empty)
  index 3: [ "apple" → 1.20 ]
  index 4: (empty)

get("apple") → hash("apple") % 5 = 3 → look directly at index 3 → found in O(1)
```

A good hash function is fast to compute and spreads keys evenly across buckets, minimizing the chance that two different keys land in the same bucket.

---

## 2. Collisions and How They're Handled

A **collision** happens when two different keys hash to the same bucket index. Collisions are unavoidable in practice (more possible keys than buckets — the "pigeonhole principle"), so every hash map implementation needs a collision-resolution strategy.

### Separate Chaining (most common)

Each bucket holds a small list (or linked list) of all entries that hashed to it. On collision, the new entry is simply appended to that bucket's list.

```
index 3: [ "apple" → 1.20 ] → [ "grape" → 2.10 ]   ← both hashed to index 3
                                                       get("grape") scans this
                                                       short chain — still ~O(1)
                                                       average if chains stay short
```

```js
// A minimal hash map built from scratch to illustrate chaining —
// real engines use far more sophisticated implementations, but
// the core idea (hash → bucket → chain) is the same.
class SimpleHashMap {
  #buckets;
  #bucketCount = 16;

  constructor() {
    this.#buckets = new Array(this.#bucketCount).fill(null).map(() => []);
  }

  #hash(key) {
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % this.#bucketCount;
    }
    return hash;
  }

  set(key, value) {
    const index = this.#hash(key);
    const bucket = this.#buckets[index];
    const existing = bucket.find(entry => entry[0] === key);
    if (existing) existing[1] = value;      // update in place
    else bucket.push([key, value]);          // append — this is the "chain"
  }

  get(key) {
    const bucket = this.#buckets[this.#hash(key)];
    const entry = bucket.find(entry => entry[0] === key);
    return entry ? entry[1] : undefined;
  }

  has(key) {
    return this.#buckets[this.#hash(key)].some(entry => entry[0] === key);
  }
}

const map = new SimpleHashMap();
map.set("apple", 1.20);
map.set("grape", 2.10); // may collide with "apple" depending on the hash
console.log(map.get("apple")); // 1.20
console.log(map.get("grape")); // 2.10
```

### Why Average Case Is O(1) but Worst Case Is O(n)

If the hash function distributes keys evenly and the map resizes (rehashes into more buckets) as it fills up, each bucket's chain stays very short (close to length 1), so lookups stay close to O(1). In the pathological worst case — a bad hash function, or an adversary deliberately choosing keys that all collide — every key lands in the same bucket, degrading the chain into effectively a linked list and lookups into O(n).

---

## 3. Map and Set in JavaScript

JavaScript provides built-in `Map` and `Set` with true O(1) average-case operations, implemented internally with the hashing strategy described above (plain objects `{}` can also be used as string-keyed maps, but `Map` is strictly better: any value can be a key, iteration order is guaranteed insertion order, and there's no risk of colliding with inherited `Object.prototype` properties).

```js
// Map: key/value pairs, any type of key
const scores = new Map();
scores.set("alice", 92);
scores.set("bob", 85);
scores.set(scores, "even objects can be keys");

console.log(scores.get("alice")); // 92 — O(1) average
console.log(scores.has("carol")); // false — O(1) average
scores.delete("bob");             // O(1) average
console.log(scores.size);         // 2

for (const [name, score] of scores) {
  if (typeof name === "string") console.log(`${name}: ${score}`);
}

// Set: unique values only, same O(1) average operations
const uniqueIds = new Set([1, 2, 2, 3, 3, 3]);
console.log(uniqueIds.size);        // 3 — duplicates collapsed automatically
console.log(uniqueIds.has(2));      // true — O(1) average

// Classic use: dedupe an array in one line
function dedupe(arr) {
  return [...new Set(arr)];
}
console.log(dedupe([1, 2, 2, 3, 1])); // [1, 2, 3]

// Classic use: O(n) duplicate detection instead of O(n²) nested loop
function hasDuplicate(arr) {
  const seen = new Set();
  for (const item of arr) {
    if (seen.has(item)) return true; // O(1) check instead of arr.includes() O(n)
    seen.add(item);
  }
  return false;
}
```

---

## 4. Bubble Sort

Bubble sort repeatedly steps through the array, comparing adjacent elements and swapping them if they're out of order — each full pass "bubbles" the largest remaining unsorted value to its correct position at the end.

```js
function bubbleSort(arr) {
  const a = [...arr]; // don't mutate the caller's array
  const n = a.length;

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) { // shrinks each pass — sorted tail excluded
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted — early exit gives O(n) best case
  }
  return a;
}

console.log(bubbleSort([5, 2, 4, 1, 3])); // [1, 2, 3, 4, 5]
```

```
Pass 1: [5,2,4,1,3] → compare/swap adjacent pairs left to right
        [2,5,4,1,3] → [2,4,5,1,3] → [2,4,1,5,3] → [2,4,1,3,5]  (5 bubbled to end)
Pass 2: [2,4,1,3,5] → [2,4,1,3,5] → [2,1,4,3,5] → [2,1,3,4,5]  (4 bubbled to position)
Pass 3: [2,1,3,4,5] → [1,2,3,4,5]                               (2 bubbled to position)
Pass 4: no swaps → done early
```

Simple to understand and implement, but O(n²) even on average — used mainly for teaching, never in production.

---

## 5. Merge Sort

Merge sort is a **divide-and-conquer** algorithm: split the array in half recursively until each piece has one element (trivially sorted), then merge sorted halves back together in order.

```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr; // base case: a single element is already sorted

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));   // recursively sort left half
  const right = mergeSort(arr.slice(mid));      // recursively sort right half

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  // one side may still have leftover elements — they're already sorted, append them
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  return result;
}

console.log(mergeSort([5, 2, 4, 1, 3])); // [1, 2, 3, 4, 5]
```

```
                        [5,2,4,1,3]
                       /            \
                [5,2,4]              [1,3]
               /       \              /   \
            [5,2]      [4]         [1]    [3]
            /    \       │           │      │
          [5]    [2]    [4]        (base)  (base)
            \    /       │
            [2,5]  merge [4]
                \      /
               [2,4,5]        [1,3]  merge
                    \          /
                    [1,2,3,4,5]      ← final merge
```

Merge sort guarantees O(n log n) in every case — the split always halves the array (log n levels), and each level does O(n) work merging — at the cost of O(n) extra space for the temporary arrays created during merging. It is also **stable**: equal elements retain their original relative order, which matters when sorting objects by one field while wanting ties to preserve a previous ordering.

---

## 6. Quick Sort

Quick sort is also divide-and-conquer, but instead of splitting evenly and doing work on the merge, it does the work up front: pick a **pivot**, partition the array so everything smaller than the pivot is to its left and everything larger is to its right, then recursively sort each side. No merge step is needed because after partitioning, the pivot is already in its final sorted position.

```js
function quickSort(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIndex = partition(arr, low, high);
    quickSort(arr, low, pivotIndex - 1);  // sort left of pivot
    quickSort(arr, pivotIndex + 1, high); // sort right of pivot
  }
  return arr;
}

// Lomuto partition scheme: pick the last element as pivot
function partition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1; // boundary of elements known to be <= pivot

  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]; // place pivot in its final spot
  return i + 1; // pivot's final index
}

console.log(quickSort([5, 2, 4, 1, 3])); // [1, 2, 3, 4, 5] — sorts in place
```

```
arr = [5, 2, 4, 1, 3], pivot = 3 (last element)

j=0: 5 > 3, skip
j=1: 2 <= 3 → i=0, swap arr[0],arr[1] → [2,5,4,1,3]
j=2: 4 > 3, skip
j=3: 1 <= 3 → i=1, swap arr[1],arr[3] → [2,1,4,5,3]

swap pivot into place: swap arr[2], arr[4] → [2,1,3,5,4]
                                       pivot(3) now at index 2, correctly placed
recurse left  [2,1]  (indices 0-1)
recurse right [5,4]  (indices 3-4)
```

Quick sort's average case is O(n log n) with small constant factors (no extra array allocation — it sorts in place), making it faster in practice than merge sort despite identical Big-O. Its worst case is O(n²), which happens when the pivot choice is consistently bad (e.g. always picking the first/last element on an already-sorted array) — production implementations mitigate this with randomized or median-of-three pivot selection.

---

## 7. Sorting Algorithm Comparison

| Algorithm | Best Case | Average Case | Worst Case | Space | Stable? |
|-----------|-----------|---------------|------------|-------|---------|
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n log n) | O(n²) | O(log n)* | No |
| `Array.prototype.sort()` (V8/TimSort) | O(n) | O(n log n) | O(n log n) | O(n) | Yes |

\* O(log n) for the recursion stack in the typical in-place implementation shown above.

**Stability** matters when sorting by one key while wanting to preserve the relative order of equal keys — e.g. sorting a list of orders by `date` after it was already sorted by `customerName`; a stable sort keeps same-date orders in customer-name order, an unstable sort might not.

---

## 8. Binary Search and Its Variants

Binary search finds a target in a **sorted** array in O(log n) by repeatedly halving the search space.

```js
// Classic binary search — returns index of target, or -1 if not found
function binarySearch(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2); // avoids overflow vs (lo+hi)/2
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

console.log(binarySearch([1, 3, 5, 7, 9, 11], 7)); // 3
```

```
arr: [1, 3, 5, 7, 9, 11]   target = 7
      lo=0            hi=5    mid=2 → arr[2]=5 < 7 → lo=3
            lo=3      hi=5    mid=4 → arr[4]=9 > 7 → hi=3
            lo=3 hi=3         mid=3 → arr[3]=7 == 7 → found at index 3
```

### Variant 1: First Occurrence (with duplicates)

```js
// When duplicates exist, standard binary search may land on ANY matching
// index. This variant keeps searching left even after finding a match,
// to guarantee the leftmost occurrence.
function findFirstOccurrence(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1, result = -1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (sortedArr[mid] === target) {
      result = mid;
      hi = mid - 1; // keep looking left for an earlier match
    } else if (sortedArr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

console.log(findFirstOccurrence([1, 2, 2, 2, 3, 4], 2)); // 1 (leftmost index of 2)
```

### Variant 2: Search in a Rotated Sorted Array

```js
// A sorted array rotated at an unknown pivot, e.g. [4,5,6,7,0,1,2].
// Key insight: at least one half of any split is always properly sorted —
// determine which half is sorted, then decide which half the target could be in.
function searchRotated(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;

    if (arr[lo] <= arr[mid]) {
      // left half [lo..mid] is sorted
      if (arr[lo] <= target && target < arr[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      // right half [mid..hi] is sorted
      if (arr[mid] < target && target <= arr[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 0)); // 4
```

### Variant 3: Search Insert Position

```js
// Returns the index where target would be inserted to keep the array sorted.
// Identical to binary search but returns `lo` instead of -1 on a miss —
// `lo` naturally converges to the correct insertion point.
function searchInsertPosition(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return lo;
}

console.log(searchInsertPosition([1, 3, 5, 6], 2)); // 1 — would insert between 1 and 3
```

---

## 9. Hands-On Exercises

**Exercise 1:** Implement `groupAnagrams(words)` using a `Map` where the key is each word's letters sorted alphabetically (e.g. `"eat"` and `"tea"` both map to key `"aet"`) and the value is an array of original words sharing that key. This demonstrates using a hash map to bucket items by a derived key rather than the item itself. Expected: `groupAnagrams(["eat","tea","tan","ate","nat","bat"])` groups into `[["eat","tea","ate"], ["tan","nat"], ["bat"]]` (order of groups/items may vary).

**Exercise 2:** Implement `firstNonRepeatingChar(str)` using a `Map` to count character frequencies in one O(n) pass, then a second pass to find the first character with count 1. Compare this to a brute-force approach using `str.indexOf`/`str.lastIndexOf` per character and explain why the Map version is O(n) while the brute-force is O(n²).

**Exercise 3:** Instrument `bubbleSort`, `mergeSort`, and `quickSort` (or use `Array.prototype.sort` as a fourth baseline) with `console.time`/`console.timeEnd`, run each on a random array of 5,000 numbers, and on an already-sorted array of 5,000 numbers. Record which algorithm's timing changes most dramatically between the two inputs, and explain why using the complexity table in Section 7.

**Exercise 4:** Implement `findLastOccurrence(sortedArr, target)` — the mirror image of `findFirstOccurrence` from Section 8, but searching right instead of left after a match. Then implement `countOccurrences(sortedArr, target)` as `findLastOccurrence(...) - findFirstOccurrence(...) + 1`, achieving O(log n) instead of an O(n) linear scan/count.

**Exercise 5:** Implement `findPeakElement(arr)` using a binary-search-style approach: a peak is any element greater than both its neighbors (treat out-of-bounds neighbors as `-Infinity`). At each `mid`, compare `arr[mid]` to `arr[mid + 1]` — if `arr[mid] < arr[mid + 1]`, a peak must exist to the right, so search right; otherwise search left (including `mid` itself). This should run in O(log n) even though the array isn't globally sorted.

---

## 10. Interview Q&A

**Q: How does a hash map achieve O(1) average-case lookup, and why is that only an average, not a guarantee?**
Answer: A hash map computes a numeric index directly from a key using a hash function, then jumps straight to that bucket in the backing array — no scanning required, which is what makes lookup O(1) rather than the O(n) of scanning an array of key/value pairs. It's only an *average* case because collisions are unavoidable (more possible keys than buckets), and when multiple keys hash to the same bucket, that bucket's chain of entries must be searched linearly. As long as the hash function distributes keys evenly and the map resizes to keep chains short, each bucket holds close to a constant number of entries, keeping lookups close to O(1) — but in the worst case, if all keys collide into one bucket (either from a poor hash function or adversarial input), it degrades to O(n), no better than a linked list.

**Q: Why would you choose merge sort over quick sort, or vice versa, in a real system?**
Answer: Merge sort guarantees O(n log n) in every case, including the worst case, and is stable, meaning elements with equal keys keep their original relative order — this makes it the right choice when worst-case predictability matters (e.g. sorting untrusted or adversarial input where a bad quick-sort pivot choice could degrade to O(n²)) or when stability is a requirement, such as multi-key sorts. Quick sort, however, sorts in place with O(log n) extra space instead of merge sort's O(n), and its average-case constant factors tend to be smaller in practice, making it faster on typical inputs. In practice, many language runtimes use hybrid approaches — for example, sorting small subarrays with insertion sort and switching to quicksort or a stable merge/TimSort hybrid for larger ones — to get the best of both.

**Q: Why does binary search require the input to be sorted, and what's the time complexity if you had to sort first?**
Answer: Binary search works by comparing the target to the middle element and eliminating half the remaining search space based on that comparison — this elimination step is only valid if you can guarantee everything to one side is uniformly smaller and everything to the other side is uniformly larger, which is exactly the sorted-order invariant. If the array isn't sorted, sort it first: that costs O(n log n) using an efficient comparison sort, after which each individual search becomes O(log n). If you only need to search once, this total O(n log n) is no better than a single O(n) linear scan; binary search only pays off when the array is already sorted, or when you'll perform many searches on the same data (amortizing the one-time sort cost across many O(log n) lookups instead of many O(n) scans).

**Q: How do you modify binary search to find the first occurrence of a duplicated target value?**
Answer: Standard binary search stops and returns as soon as it finds any index where the value matches the target, which with duplicates could be any one of several valid indices. To find specifically the first (leftmost) occurrence, you continue searching even after finding a match: record the current index as a candidate, then narrow the search to the left half (`hi = mid - 1`) instead of stopping, because there might be an earlier occurrence still to the left. You keep doing this until `lo > hi`, at which point the last recorded candidate is guaranteed to be the leftmost match. This still runs in O(log n) — you're not scanning linearly, just being more careful about when to stop narrowing.

**Q: What makes an array like `[4,5,6,7,0,1,2]` still searchable in O(log n) even though it isn't fully sorted?**
Answer: Although the array as a whole isn't sorted, it's a rotation of a sorted array, which guarantees that at any split point, at least one of the two halves is itself contiguously sorted. The algorithm first determines which half is sorted by comparing the endpoints of that half (e.g. `arr[lo] <= arr[mid]` means the left half is sorted); once you know a half is sorted, you can cheaply check whether the target falls within that half's range, and if so search there, otherwise search the other half. Each step still eliminates half the remaining search space, exactly like standard binary search, preserving O(log n) time despite the array not being globally sorted.
