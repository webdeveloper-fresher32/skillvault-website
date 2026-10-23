# Top Interview Questions — Heaps & Priority Queues

Master these 15 essential interview problems covering Min/Max Heaps, Top-K Filtering, Dual-Heap Streaming Medians, Multi-Way K-List Merging, and Greedy Interval Scheduling.

---

### Python `heapq` Quick Primer
Python's standard library `heapq` module provides a **Min-Heap**:
- `heapq.heappush(heap, item)`: $O(\log n)$
- `heapq.heappop(heap)`: $O(\log n)$
- `heapq.heapify(list)`: $O(n)$
- To simulate a **Max-Heap**, negate numbers (`-val`).

---

### Problem 1: Kth Largest Element in an Array
**Difficulty: Medium | Pattern: Fixed-Size Min-Heap ($O(n \log k)$)**

#### Problem Statement
Given an integer array `nums` and an integer $k$, return the $k$-th largest element in the array. Note that it is the $k$-th largest element in sorted order, not the $k$-th distinct element.

#### Python Solution
```python
import heapq
from typing import List

def find_kth_largest(nums: List[int], k: int) -> int:
    min_heap = []
    
    for num in nums:
        heapq.heappush(min_heap, num)
        # Keep heap size bounded to k: root will always be the k-th largest
        if len(min_heap) > k:
            heapq.heappop(min_heap)
            
    return min_heap[0]

print(find_kth_largest([3, 2, 1, 5, 6, 4], 2))  # 5
```

#### Complexity
- **Time:** $O(n \log k)$ — Bounding heap size to $k$ avoids sorting the whole array ($O(n \log n)$).
- **Space:** $O(k)$ extra space.

---

### Problem 2: Top K Frequent Words
**Difficulty: Medium | Pattern: Min-Heap with Custom Multi-Key Tuple**

#### Problem Statement
Given an array of strings `words` and an integer $k$, return the $k$ most frequent strings. Return the answer sorted by frequency from highest to lowest. Sort words with the same frequency by their lexicographical order.

#### Python Solution
```python
from collections import Counter

class WordWrapper:
    """Helper to reverse string comparison for min-heap."""
    def __init__(self, word, count):
        self.word = word
        self.count = count
        
    def __lt__(self, other):
        # Primary: count ascending
        if self.count != other.count:
            return self.count < other.count
        # Secondary: lexicographical descending (so smaller lex word stays in heap!)
        return self.word > other.word

def top_k_frequent_words(words: List[str], k: int) -> List[str]:
    counts = Counter(words)
    min_heap = []
    
    for word, count in counts.items():
        heapq.heappush(min_heap, WordWrapper(word, count))
        if len(min_heap) > k:
            heapq.heappop(min_heap)
            
    res = []
    while min_heap:
        res.append(heapq.heappop(min_heap).word)
        
    # Reverse since popped in ascending order
    return res[::-1]

print(top_k_frequent_words(["i", "love", "leetcode", "i", "love", "coding"], 2))
# ['i', 'love']
```

#### Complexity
- **Time:** $O(n \log k)$
- **Space:** $O(n)$

---

### Problem 3: Merge K Sorted Lists
**Difficulty: Hard | Pattern: Min-Heap of Active Heads**

#### Problem Statement
You are given an array of $k$ linked-lists `lists`, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.

#### Python Solution
```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def merge_k_lists(lists: List[ListNode]) -> ListNode:
    min_heap = []
    
    # Push (val, list_index, node) to break ties without comparing ListNode objects
    for i, head in enumerate(lists):
        if head:
            heapq.heappush(min_heap, (head.val, i, head))
            
    dummy = ListNode(0)
    curr = dummy
    
    while min_heap:
        val, i, node = heapq.heappop(min_heap)
        curr.next = node
        curr = curr.next
        
        if node.next:
            heapq.heappush(min_heap, (node.next.val, i, node.next))
            
    return dummy.next
```

#### Complexity
- **Time:** $O(N \log k)$ where $N$ is total number of nodes across all lists and $k$ is number of linked lists.
- **Space:** $O(k)$ for the priority queue.

---

### Problem 4: Find Median from Data Stream
**Difficulty: Hard | Pattern: Dual Heaps (Max-Heap Lower Half + Min-Heap Upper Half)**

#### Problem Statement
The median is the middle value in an ordered integer list. Design a data structure that supports:
- `addNum(num)`: Adds integer into the data structure in $O(\log n)$.
- `findMedian()`: Returns the median of all elements so far in $O(1)$.

#### Python Solution
```python
class MedianFinder:
    def __init__(self):
        # max_heap stores lower half (negated for Python)
        self.lower_half = []
        # min_heap stores upper half
        self.upper_half = []

    def addNum(self, num: int) -> None:
        # Step 1: Add to lower half
        heapq.heappush(self.lower_half, -num)
        
        # Step 2: Ensure highest of lower half is <= lowest of upper half
        if self.lower_half and self.upper_half and (-self.lower_half[0] > self.upper_half[0]):
            val = -heapq.heappop(self.lower_half)
            heapq.heappush(self.upper_half, val)
            
        # Step 3: Balance sizes (lower_half can hold at most 1 extra element)
        if len(self.lower_half) > len(self.upper_half) + 1:
            val = -heapq.heappop(self.lower_half)
            heapq.heappush(self.upper_half, val)
        elif len(self.upper_half) > len(self.lower_half):
            val = heapq.heappop(self.upper_half)
            heapq.heappush(self.lower_half, -val)

    def findMedian(self) -> float:
        if len(self.lower_half) > len(self.upper_half):
            return float(-self.lower_half[0])
        return (-self.lower_half[0] + self.upper_half[0]) / 2.0
```

#### Complexity
- **Time:** $O(\log n)$ for `addNum`, $O(1)$ for `findMedian`.
- **Space:** $O(n)$

---

### Problem 5: Task Scheduler
**Difficulty: Medium | Pattern: Frequency Counting & Greedy Cycle Simulation**

#### Problem Statement
Given a characters array `tasks` and a cooling interval `n`, return the least number of intervals the CPU will take to finish all tasks. Same tasks must be separated by at least $n$ units of time.

#### Python Solution
```python
def least_interval(tasks: List[str], n: int) -> int:
    counts = Counter(tasks)
    max_freq = max(counts.values())
    
    # Number of tasks with this maximum frequency
    count_max_freq = sum(1 for f in counts.values() if f == max_freq)
    
    # Minimum intervals determined by chunking formula
    min_intervals = (max_freq - 1) * (n + 1) + count_max_freq
    
    # Must be at least the total number of tasks
    return max(len(tasks), min_intervals)

print(least_interval(["A","A","A","B","B","B"], 2))  # 8 (A -> B -> idle -> A -> B -> idle -> A -> B)
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$ — 26 uppercase letters.

---

### Problem 6: Reorganize String (No Two Adjacent Same)
**Difficulty: Medium | Pattern: Max-Heap Frequency Interleaving**

#### Problem Statement
Given a string `s`, rearrange the characters of `s` so that any two adjacent characters are not the same. If not possible, return `""`.

#### Python Solution
```python
def reorganize_string(s: str) -> str:
    counts = Counter(s)
    # Max-heap storing (-count, char)
    max_heap = [(-count, char) for char, count in counts.items()]
    heapq.heapify(max_heap)
    
    prev_count, prev_char = 0, ''
    res = []
    
    while max_heap:
        count, char = heapq.heappop(max_heap)
        res.append(char)
        
        # If previous character still has remaining occurrences, re-add it to heap
        if prev_count < 0:
            heapq.heappush(max_heap, (prev_count, prev_char))
            
        prev_count = count + 1  # decrements count since count is negative
        prev_char = char
        
    result_str = "".join(res)
    return result_str if len(result_str) == len(s) else ""

print(reorganize_string("aab"))  # "aba"
print(reorganize_string("aaab")) # ""
```

#### Complexity
- **Time:** $O(n \log(\text{alphabet size})) = O(n)$
- **Space:** $O(\text{alphabet size})$

---

### Problem 7: K Closest Points to Origin
**Difficulty: Medium | Pattern: Max-Heap of Size K**

#### Problem Statement
Given an array of `points` where `points[i] = [x, y]` represents a point on the X-Y plane and an integer $k$, return the $k$ closest points to the origin `(0, 0)`.

#### Python Solution
```python
def k_closest(points: List[List[int]], k: int) -> List[List[int]]:
    # Max-heap storing (-distance, [x, y])
    max_heap = []
    
    for x, y in points:
        dist_sq = x * x + y * y
        heapq.heappush(max_heap, (-dist_sq, [x, y]))
        if len(max_heap) > k:
            heapq.heappop(max_heap)
            
    return [point for _, point in max_heap]

print(k_closest([[1, 3], [-2, 2]], 1))  # [[-2, 2]]
```

#### Complexity
- **Time:** $O(n \log k)$
- **Space:** $O(k)$

---

### Problem 8: Minimum Cost to Connect Sticks
**Difficulty: Medium | Pattern: Greedy Huffman Merge via Min-Heap**

#### Problem Statement
You have some number of sticks with positive lengths. You can connect any two sticks by paying a cost equal to their sum. Connect all sticks into one with minimum cost.

#### Python Solution
```python
def connect_sticks(sticks: List[int]) -> int:
    heapq.heapify(sticks)
    total_cost = 0
    
    while len(sticks) > 1:
        first = heapq.heappop(sticks)
        second = heapq.heappop(sticks)
        cost = first + second
        total_cost += cost
        heapq.heappush(sticks, cost)
        
    return total_cost

print(connect_sticks([2, 4, 3]))        # 14 ((2+3)=5, (5+4)=9 -> total 5+9=14)
print(connect_sticks([1, 8, 3, 5]))     # 30
```

#### Complexity
- **Time:** $O(n \log n)$
- **Space:** $O(n)$

---

### Problem 9: Meeting Rooms II (Minimum Conference Rooms)
**Difficulty: Medium | Pattern: Min-Heap of Active End Times**

#### Problem Statement
Given an array of meeting time intervals `intervals` where `intervals[i] = [start_i, end_i]`, return the minimum number of conference rooms required.

#### Python Solution
```python
def min_meeting_rooms(intervals: List[List[int]]) -> int:
    if not intervals:
        return 0
        
    # Sort meetings by start time
    intervals.sort(key=lambda x: x[0])
    
    # Min-heap storing end times of active meetings
    rooms = []
    heapq.heappush(rooms, intervals[0][1])
    
    for start, end in intervals[1:]:
        # If earliest meeting ends before current starts, reuse that room!
        if rooms[0] <= start:
            heapq.heappop(rooms)
            
        heapq.heappush(rooms, end)
        
    return len(rooms)

print(min_meeting_rooms([[0, 30], [5, 10], [15, 20]]))  # 2
```

#### Complexity
- **Time:** $O(n \log n)$ due to sorting and heap operations.
- **Space:** $O(n)$

---

### Problem 10: Design Twitter (K-Way Merge Newsfeed)
**Difficulty: Medium-Hard | Pattern: Multi-Feed K-Way Priority Queue Merge**

#### Problem Statement
Design a simplified version of Twitter where users can post tweets, follow/unfollow another user, and see the 10 most recent tweets in their news feed.

#### Python Solution
```python
from collections import defaultdict

class Twitter:
    def __init__(self):
        self.time = 0
        self.tweets = defaultdict(list)    # user_id -> list of (time, tweet_id)
        self.following = defaultdict(set) # user_id -> set of followee_ids

    def postTweet(self, userId: int, tweetId: int) -> None:
        self.time += 1
        self.tweets[userId].append((self.time, tweetId))

    def getNewsFeed(self, userId: int) -> List[int]:
        min_heap = []
        # Users whose tweets should be merged: self + all followees
        users = self.following[userId] | {userId}
        
        for u in users:
            u_tweets = self.tweets[u]
            if u_tweets:
                # Push latest tweet: (time, tweetId, userId, index_in_user_tweets)
                idx = len(u_tweets) - 1
                t, tid = u_tweets[idx]
                heapq.heappush(min_heap, (-t, tid, u, idx))
                
        feed = []
        while min_heap and len(feed) < 10:
            neg_t, tid, u, idx = heapq.heappop(min_heap)
            feed.append(tid)
            if idx > 0:
                next_t, next_tid = self.tweets[u][idx - 1]
                heapq.heappush(min_heap, (-next_t, next_tid, u, idx - 1))
                
        return feed

    def follow(self, followerId: int, followeeId: int) -> None:
        self.following[followerId].add(followeeId)

    def unfollow(self, followerId: int, followeeId: int) -> None:
        self.following[followerId].discard(followeeId)
```

#### Complexity
- **Time:** `getNewsFeed` runs in $O(K \log U)$ where $U$ is number of followees and $K \le 10$.
- **Space:** $O(U + T)$

---

### Problem 11: IPO (Maximize Capital)
**Difficulty: Hard | Pattern: Dual Heaps (Capital Min-Heap + Profit Max-Heap)**

#### Problem Statement
You are given $n$ projects with given `profits` and minimum `capital` needed. Initially you have `w` capital. Finish at most `k` distinct projects to maximize your total capital.

#### Python Solution
```python
def find_maximized_capital(k: int, w: int, profits: List[int], capital: List[int]) -> int:
    # Min-heap by capital required: (capital, profit)
    capital_heap = [(c, p) for c, p in zip(capital, profits)]
    heapq.heapify(capital_heap)
    
    # Max-heap by profit achievable with current capital
    profit_heap = []
    
    for _ in range(k):
        # Move all projects we can afford into profit_heap
        while capital_heap and capital_heap[0][0] <= w:
            c, p = heapq.heappop(capital_heap)
            heapq.heappush(profit_heap, -p)
            
        if not profit_heap:
            break
            
        # Greedily choose the most profitable project
        w += -heapq.heappop(profit_heap)
        
    return w

print(find_maximized_capital(2, 0, [1, 2, 3], [0, 1, 1]))  # 4
```

#### Complexity
- **Time:** $O(n \log n + k \log n)$
- **Space:** $O(n)$

---

### Problem 12: Smallest Range Covering Elements from K Lists
**Difficulty: Hard | Pattern: Min-Heap Tracking with Running Maximum**

#### Problem Statement
You have $k$ lists of sorted integers in non-decreasing order. Find the smallest range $[a, b]$ that includes at least one number from each of the $k$ lists.

#### Python Solution
```python
def smallest_range(nums: List[List[int]]) -> List[int]:
    min_heap = []
    current_max = float('-inf')
    
    # Push the first element of each of the k lists
    for i, lst in enumerate(nums):
        heapq.heappush(min_heap, (lst[0], i, 0))
        current_max = max(current_max, lst[0])
        
    best_range = [float('-inf'), float('inf')]
    
    while True:
        min_val, list_idx, elem_idx = heapq.heappop(min_heap)
        
        # Check if current range is smaller
        if current_max - min_val < best_range[1] - best_range[0]:
            best_range = [min_val, current_max]
            
        # If this list has no more elements, we cannot cover all k lists anymore!
        if elem_idx + 1 == len(nums[list_idx]):
            break
            
        next_val = nums[list_idx][elem_idx + 1]
        heapq.heappush(min_heap, (next_val, list_idx, elem_idx + 1))
        current_max = max(current_max, next_val)
        
    return best_range

print(smallest_range([[4,10,15,24,26],[0,9,12,20],[5,18,22,30]]))  # [20, 24]
```

#### Complexity
- **Time:** $O(N \log k)$ where $N$ is total elements across all lists.
- **Space:** $O(k)$ for the min-heap.

---

### Problem 13: Ugly Numbers II (2, 3, 5 Multiples)
**Difficulty: Medium | Pattern: Min-Heap with Deduplication Set**

#### Problem Statement
An ugly number is a positive integer whose prime factors are limited to 2, 3, and 5. Given an integer $n$, return the $n$-th ugly number.

#### Python Solution
```python
def nth_ugly_number(n: int) -> int:
    min_heap = [1]
    seen = {1}
    curr = 1
    
    for _ in range(n):
        curr = heapq.heappop(min_heap)
        for prime in [2, 3, 5]:
            nxt = curr * prime
            if nxt not in seen:
                seen.add(nxt)
                heapq.heappush(min_heap, nxt)
                
    return curr

print(nth_ugly_number(10))  # 12 (1, 2, 3, 4, 5, 6, 8, 9, 10, 12)
```

#### Complexity
- **Time:** $O(n \log n)$
- **Space:** $O(n)$

---

### Problem 14: Kth Smallest Element in a Sorted Matrix
**Difficulty: Medium | Pattern: Matrix Row Pointers Min-Heap**

#### Problem Statement
Given an $n \times n$ matrix where each of the rows and columns is sorted in ascending order, return the $k$-th smallest element in the matrix.

#### Python Solution
```python
def kth_smallest(matrix: List[List[int]], k: int) -> int:
    n = len(matrix)
    # Min-heap storing (val, row, col)
    min_heap = [(matrix[r][0], r, 0) for r in range(min(n, k))]
    heapq.heapify(min_heap)
    
    val = 0
    for _ in range(k):
        val, r, c = heapq.heappop(min_heap)
        if c + 1 < n:
            heapq.heappush(min_heap, (matrix[r][c + 1], r, c + 1))
            
    return val

print(kth_smallest([[1, 5, 9], [10, 11, 13], [12, 13, 15]], 8))  # 13
```

#### Complexity
- **Time:** $O(k \log(\min(n, k)))$
- **Space:** $O(\min(n, k))$

---

### Problem 15: Sort Characters By Frequency
**Difficulty: Medium | Pattern: Max-Heap Frequency Extraction**

#### Problem Statement
Given a string `s`, sort it in decreasing order based on the frequency of the characters.

#### Python Solution
```python
def frequency_sort(s: str) -> str:
    counts = Counter(s)
    # Max-heap with (-count, char)
    max_heap = [(-count, char) for char, count in counts.items()]
    heapq.heapify(max_heap)
    
    res = []
    while max_heap:
        count, char = heapq.heappop(max_heap)
        res.append(char * (-count))
        
    return "".join(res)

print(frequency_sort("tree"))  # "eert" or "eetr"
```

#### Complexity
- **Time:** $O(n + k \log k)$ where $k$ is number of distinct characters ($k \le 62$).
- **Space:** $O(n)$
