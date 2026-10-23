# Top Interview Questions — Hashing

Master these 15 essential interview problems covering Hash Maps, Hash Sets, Modulo Prefix Hashing, Bijection Mappings, and High-Performance Cache System Designs (LRU & LFU).

---

### Problem 1: Two Sum
**Difficulty: Easy | Pattern: One-Pass Complement Hash Map**

#### Problem Statement
Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.

#### Python Solution
```python
from typing import List

def two_sum(nums: List[int], target: int) -> List[int]:
    seen = {}  # num -> index
    
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
        
    return []

print(two_sum([2, 7, 11, 15], 9))  # [0, 1]
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 2: Longest Consecutive Sequence
**Difficulty: Medium | Pattern: Hash Set with Sequence-Starter Check**

#### Problem Statement
Given an unsorted array of integers `nums`, return the length of the longest consecutive elements sequence. Must run in $O(n)$ time.

#### Python Solution
```python
def longest_consecutive(nums: List[int]) -> int:
    num_set = set(nums)
    max_streak = 0
    
    for num in num_set:
        # Crucial check: only start counting if 'num' is the beginning of a sequence!
        # If num - 1 is in set, this number is already part of an ongoing sequence.
        if num - 1 not in num_set:
            current_num = num
            current_streak = 1
            
            while current_num + 1 in num_set:
                current_num += 1
                current_streak += 1
                
            max_streak = max(max_streak, current_streak)
            
    return max_streak

print(longest_consecutive([100, 4, 200, 1, 3, 2]))  # 4 ([1, 2, 3, 4])
```

#### Why $O(n)$?
Each number is visited at most twice: once during the set scan, and at most once inside the `while` loop when building its sequence.

---

### Problem 3: Subarray Sums Divisible by K
**Difficulty: Medium | Pattern: Modulo Prefix Hashing**

#### Problem Statement
Given an integer array `nums` and an integer `k`, return the number of non-empty subarrays that have a sum divisible by `k`.

#### Python Solution
```python
def subarrays_div_by_k(nums: List[int], k: int) -> int:
    # remainder -> frequency (base case: remainder 0 seen once)
    remainder_count = {0: 1}
    running_sum = 0
    count = 0
    
    for num in nums:
        running_sum += num
        # Python's % handles negative numbers correctly: (-1) % 5 == 4
        rem = running_sum % k
        
        if rem in remainder_count:
            count += remainder_count[rem]
            
        remainder_count[rem] = remainder_count.get(rem, 0) + 1
        
    return count

print(subarrays_div_by_k([4, 5, 0, -2, -3, 1], 5))  # 7
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(k)$ distinct remainders.

---

### Problem 4: Contiguous Array (Equal Number of 0s and 1s)
**Difficulty: Medium | Pattern: Value Transformation (0 $\to$ -1) + First-Seen Index Map**

#### Problem Statement
Given a binary array `nums`, return the maximum length of a contiguous subarray with an equal number of `0` and `1`.

#### Python Solution
```python
def find_max_length(nums: List[int]) -> int:
    first_seen = {0: -1}  # running_sum -> earliest index seen
    running_sum = 0
    max_len = 0
    
    for i, num in enumerate(nums):
        # Treat 0 as -1, and 1 as +1
        running_sum += 1 if num == 1 else -1
        
        if running_sum in first_seen:
            max_len = max(max_len, i - first_seen[running_sum])
        else:
            first_seen[running_sum] = i
            
    return max_len

print(find_max_length([0, 1, 0]))        # 2 ([0, 1] or [1, 0])
print(find_max_length([0, 1, 1, 0, 1, 0, 1]))  # 6
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 5: Insert Delete GetRandom $O(1)$
**Difficulty: Medium | Pattern: Dynamic Array + Value-to-Index Hash Map**

#### Problem Statement
Implement the `RandomizedSet` class:
- `insert(val)`: Inserts `val` if not present. Returns `True` if inserted.
- `remove(val)`: Removes `val` if present. Returns `True` if removed.
- `getRandom()`: Returns a random element from current set. Each element must have equal probability.
All methods must run in average $O(1)$ time complexity.

#### Python Solution
```python
import random

class RandomizedSet:
    def __init__(self):
        self.vals = []      # Dynamic array for O(1) random choice by index
        self.val_to_idx = {} # val -> index in self.vals

    def insert(self, val: int) -> bool:
        if val in self.val_to_idx:
            return False
        self.val_to_idx[val] = len(self.vals)
        self.vals.append(val)
        return True

    def remove(self, val: int) -> bool:
        if val not in self.val_to_idx:
            return False
            
        # O(1) Deletion trick: swap element with the last element, then pop!
        idx_to_remove = self.val_to_idx[val]
        last_val = self.vals[-1]
        
        # Overwrite position with last element
        self.vals[idx_to_remove] = last_val
        self.val_to_idx[last_val] = idx_to_remove
        
        # Remove last element
        self.vals.pop()
        del self.val_to_idx[val]
        return True

    def getRandom(self) -> int:
        return random.choice(self.vals)
```

#### Complexity
- **Time:** $O(1)$ average for all three methods.
- **Space:** $O(n)$

---

### Problem 6: Design LRU Cache (Least Recently Used)
**Difficulty: Medium-Hard | Pattern: Hash Map + Doubly Linked List with Sentinel Nodes**

#### Problem Statement
Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement `get(key)` and `put(key, value)` in $O(1)$ time.

#### Python Solution
```python
class DLinkedNode:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}  # key -> DLinkedNode
        
        # Sentinel dummy nodes
        self.head = DLinkedNode()
        self.tail = DLinkedNode()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _add_node_to_head(self, node: DLinkedNode):
        node.prev = self.head
        node.next = self.head.next
        self.head.next.prev = node
        self.head.next = node

    def _remove_node(self, node: DLinkedNode):
        prev = node.prev
        nxt = node.next
        prev.next = nxt
        nxt.prev = prev

    def _move_to_head(self, node: DLinkedNode):
        self._remove_node(node)
        self._add_node_to_head(node)

    def _pop_tail(self) -> DLinkedNode:
        res = self.tail.prev
        self._remove_node(res)
        return res

    def get(self, key: int) -> int:
        node = self.cache.get(key)
        if not node:
            return -1
        self._move_to_head(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        node = self.cache.get(key)
        if node:
            node.value = value
            self._move_to_head(node)
        else:
            new_node = DLinkedNode(key, value)
            self.cache[key] = new_node
            self._add_node_to_head(new_node)
            
            if len(self.cache) > self.capacity:
                tail = self._pop_tail()
                del self.cache[tail.key]
```

#### Complexity
- **Time:** $O(1)$ for both `get` and `put`.
- **Space:** $O(\text{capacity})$

---

### Problem 7: Design LFU Cache (Least Frequently Used)
**Difficulty: Hard | Pattern: Dual Hash Maps + Frequency Doubly Linked Lists**

#### Problem Statement
Design and implement an LFU cache where elements with lowest frequency are evicted first. If there is a tie, evict the least recently used element.

#### Python Solution
```python
from collections import defaultdict

class LFUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.min_freq = 0
        self.key_to_val = {}      # key -> val
        self.key_to_freq = {}     # key -> frequency
        # freq -> OrderedDict (in Python 3.7+, dict preserves insertion order)
        self.freq_to_keys = defaultdict(dict)

    def _update_freq(self, key: int):
        freq = self.key_to_freq[key]
        del self.freq_to_keys[freq][key]
        
        # If this frequency bucket is empty and was min_freq, increment min_freq
        if not self.freq_to_keys[freq] and freq == self.min_freq:
            self.min_freq += 1
            
        self.key_to_freq[key] = freq + 1
        self.freq_to_keys[freq + 1][key] = True

    def get(self, key: int) -> int:
        if key not in self.key_to_val:
            return -1
        self._update_freq(key)
        return self.key_to_val[key]

    def put(self, key: int, value: int) -> None:
        if self.capacity <= 0:
            return
            
        if key in self.key_to_val:
            self.key_to_val[key] = value
            self._update_freq(key)
            return
            
        if len(self.key_to_val) >= self.capacity:
            # Evict LRU key with min_freq
            evict_key = next(iter(self.freq_to_keys[self.min_freq]))
            del self.freq_to_keys[self.min_freq][evict_key]
            del self.key_to_val[evict_key]
            del self.key_to_freq[evict_key]
            
        self.key_to_val[key] = value
        self.key_to_freq[key] = 1
        self.freq_to_keys[1][key] = True
        self.min_freq = 1
```

#### Complexity
- **Time:** $O(1)$ for both `get` and `put`.
- **Space:** $O(\text{capacity})$

---

### Problem 8: Isomorphic Strings & Word Pattern
**Difficulty: Easy | Pattern: Bidirectional Bijection Mapping**

#### Problem Statement
Given two strings `s` and `t`, determine if they are isomorphic. Two strings are isomorphic if the characters in `s` can be replaced to get `t`, with a strict 1-to-1 bijection.

#### Python Solution
```python
def is_isomorphic(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
        
    map_s_to_t = {}
    map_t_to_s = {}
    
    for c1, c2 in zip(s, t):
        if (c1 in map_s_to_t and map_s_to_t[c1] != c2) or \
           (c2 in map_t_to_s and map_t_to_s[c2] != c1):
            return False
            
        map_s_to_t[c1] = c2
        map_t_to_s[c2] = c1
        
    return True

print(is_isomorphic("egg", "add"))  # True
print(is_isomorphic("foo", "bar"))  # False
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(\text{alphabet size})$

---

### Problem 9: Valid Sudoku
**Difficulty: Medium | Pattern: Hash Set Coordinate Mathematical Partitioning**

#### Problem Statement
Determine if a $9 \times 9$ Sudoku board is valid. Only the filled cells need to be validated according to standard Sudoku rules:
1. Each row must contain digits 1-9 without repetition.
2. Each column must contain digits 1-9 without repetition.
3. Each of the nine $3 \times 3$ sub-boxes must contain digits 1-9 without repetition.

#### Python Solution
```python
def is_valid_sudoku(board: List[List[str]]) -> bool:
    rows = [set() for _ in range(9)]
    cols = [set() for _ in range(9)]
    boxes = [set() for _ in range(9)]
    
    for r in range(9):
        for c in range(9):
            val = board[r][c]
            if val == '.':
                continue
                
            box_idx = (r // 3) * 3 + (c // 3)
            
            if val in rows[r] or val in cols[c] or val in boxes[box_idx]:
                return False
                
            rows[r].add(val)
            cols[c].add(val)
            boxes[box_idx].add(val)
            
    return True
```

#### Complexity
- **Time:** $O(1)$ — Board size is fixed at $9 \times 9 = 81$ cells.
- **Space:** $O(1)$

---

### Problem 10: Find All Anagrams in a String
**Difficulty: Medium | Pattern: Fixed-Length Sliding Window with Frequency Map**

#### Problem Statement
Given two strings `s` and `p`, return an array of all the start indices of `p`'s anagrams in `s`.

#### Python Solution
```python
def find_anagrams(s: str, p: str) -> List[int]:
    if len(p) > len(s):
        return []
        
    p_count = [0] * 26
    s_count = [0] * 26
    
    for c in p:
        p_count[ord(c) - ord('a')] += 1
        
    res = []
    window_len = len(p)
    
    for i, c in enumerate(s):
        s_count[ord(c) - ord('a')] += 1
        
        # Remove outgoing character from window
        if i >= window_len:
            s_count[ord(s[i - window_len]) - ord('a')] -= 1
            
        if s_count == p_count:
            res.append(i - window_len + 1)
            
    return res

print(find_anagrams("cbaebabacd", "abc"))  # [0, 6]
```

#### Complexity
- **Time:** $O(|s|)$
- **Space:** $O(1)$ — 26-element array.

---

### Problem 11: Top K Frequent Elements ($O(n)$ Bucket Sort)
**Difficulty: Medium | Pattern: Frequency Map + Bucket Sort Array**

#### Problem Statement
Given an integer array `nums` and an integer `k`, return the $k$ most frequent elements in $O(n)$ time (better than $O(n \log k)$ heap).

#### Python Solution
```python
from collections import Counter

def top_k_frequent(nums: List[int], k: int) -> List[int]:
    count = Counter(nums)
    # Buckets where index represents frequency (0 to len(nums))
    buckets = [[] for _ in range(len(nums) + 1)]
    
    for num, freq in count.items():
        buckets[freq].append(num)
        
    result = []
    # Traverse from highest frequency bucket down to lowest
    for freq in range(len(buckets) - 1, 0, -1):
        for num in buckets[freq]:
            result.append(num)
            if len(result) == k:
                return result
                
    return result

print(top_k_frequent([1, 1, 1, 2, 2, 3], 2))  # [1, 2]
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 12: 4Sum II
**Difficulty: Medium | Pattern: Split-and-Conquer into $O(n^2)$ Hash Map**

#### Problem Statement
Given four integer arrays `nums1`, `nums2`, `nums3`, and `nums4` all of length $n$, return the number of tuples `(i, j, k, l)` such that `nums1[i] + nums2[j] + nums3[k] + nums4[l] == 0`.

#### Python Solution
```python
def four_sum_count(nums1: List[int], nums2: List[int], nums3: List[int], nums4: List[int]) -> int:
    sum_map = defaultdict(int)
    
    # Precompute pairwise sums of first two arrays
    for a in nums1:
        for b in nums2:
            sum_map[a + b] += 1
            
    count = 0
    # Match with negative pairwise sums of remaining two arrays
    for c in nums3:
        for d in nums4:
            target = -(c + d)
            if target in sum_map:
                count += sum_map[target]
                
    return count

print(four_sum_count([1, 2], [-2, -1], [-1, 2], [0, 2]))  # 2
```

#### Complexity
- **Time:** $O(n^2)$ (dramatically better than brute-force $O(n^4)$).
- **Space:** $O(n^2)$ hash map.

---

### Problem 13: Brick Wall (Least Cut Through Bricks)
**Difficulty: Medium | Pattern: Edge Frequency Alignment**

#### Problem Statement
There is a rectangular brick wall made of several rows of bricks. You want to draw a vertical line from the top to the bottom and cross the least number of bricks. Return the minimum number of crossed bricks.

#### Python Solution
```python
def least_bricks(wall: List[List[int]]) -> int:
    edge_counts = defaultdict(int)
    
    for row in wall:
        prefix = 0
        # Ignore last brick since edges at the end don't cut inside the wall
        for brick in row[:-1]:
            prefix += brick
            edge_counts[prefix] += 1
            
    # Maximum edges aligned means minimum bricks cut
    max_edges = max(edge_counts.values()) if edge_counts else 0
    return len(wall) - max_edges

print(least_bricks([[1, 2, 2, 1], [3, 1, 2], [1, 3, 2], [2, 4], [3, 1, 2], [1, 3, 1, 1]]))
# 2
```

#### Complexity
- **Time:** $O(\text{total bricks})$
- **Space:** $O(\text{unique edge positions})$

---

### Problem 14: First Unique Character in a String
**Difficulty: Easy | Pattern: Two-Pass Frequency Array**

#### Problem Statement
Given a string `s`, find the first non-repeating character in it and return its index. If it does not exist, return `-1`.

#### Python Solution
```python
def first_uniq_char(s: str) -> int:
    freq = [0] * 26
    for c in s:
        freq[ord(c) - ord('a')] += 1
        
    for i, c in enumerate(s):
        if freq[ord(c) - ord('a')] == 1:
            return i
            
    return -1

print(first_uniq_char("leetcode"))      # 0 ('l')
print(first_uniq_char("loveleetcode"))  # 2 ('v')
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 15: Ransom Note
**Difficulty: Easy | Pattern: Character Inventory Verification**

#### Problem Statement
Given two strings `ransomNote` and `magazine`, return `True` if `ransomNote` can be constructed by using the letters from `magazine` and `False` otherwise. Each letter in `magazine` can only be used once.

#### Python Solution
```python
def can_construct(ransomNote: str, magazine: str) -> bool:
    if len(ransomNote) > len(magazine):
        return False
        
    counts = [0] * 26
    for c in magazine:
        counts[ord(c) - ord('a')] += 1
        
    for c in ransomNote:
        idx = ord(c) - ord('a')
        counts[idx] -= 1
        if counts[idx] < 0:
            return False
            
    return True

print(can_construct("a", "b"))     # False
print(can_construct("aa", "aab"))  # True
```

#### Complexity
- **Time:** $O(|ransomNote| + |magazine|)$
- **Space:** $O(1)$
