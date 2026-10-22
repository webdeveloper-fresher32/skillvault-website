# Top 30 Array Interview Questions

Master these 30 essential Array interview problems covering Two Pointers, Prefix Sums, Kadane's Algorithm, Interval Merging, In-Place Array Manipulations, 2D Matrix Algorithms, Boyer-Moore Voting, Cyclic Sorting, and Dynamic Programming.

---

### Problem 1: Two Sum II (Input Array Is Sorted)
**Difficulty: Easy-Medium | Pattern: Opposite-Direction Two Pointers**

#### Problem Statement
Given a 1-indexed array of integers `numbers` sorted in non-decreasing order, find two numbers such that they add up to a specific `target`. Return their indices `[index1, index2]`. Must use $O(1)$ extra space.

#### Python Solution
```python
from typing import List

def two_sum_sorted(numbers: List[int], target: int) -> List[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        curr_sum = numbers[left] + numbers[right]
        if curr_sum == target:
            return [left + 1, right + 1]
        elif curr_sum < target:
            left += 1
        else:
            right -= 1
    return []

print(two_sum_sorted([2, 7, 11, 15], 9))  # [1, 2]
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 2: 3Sum
**Difficulty: Medium | Pattern: Sorting + Two Pointers + Duplicate Elimination**

#### Problem Statement
Given an integer array `nums`, return all unique triplets `[nums[i], nums[j], nums[k]]` such that $i \neq j \neq k$ and $nums[i] + nums[j] + nums[k] == 0$.

#### Python Solution
```python
def three_sum(nums: List[int]) -> List[List[int]]:
    nums.sort()
    res = []
    n = len(nums)
    
    for i in range(n - 2):
        if nums[i] > 0:
            break
        if i > 0 and nums[i] == nums[i - 1]:
            continue
            
        left, right = i + 1, n - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total < 0:
                left += 1
            elif total > 0:
                right -= 1
            else:
                res.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
    return res

print(three_sum([-1, 0, 1, 2, -1, -4]))  # [[-1, -1, 2], [-1, 0, 1]]
```
- **Complexity:** Time: $O(n^2)$, Space: $O(1)$ auxiliary space.

---

### Problem 3: 4Sum
**Difficulty: Medium-Hard | Pattern: Recursive $k$-Sum Reduction to Two Pointers**

#### Problem Statement
Given an array `nums` of $n$ integers and an integer `target`, return all unique quadruplets summing to `target`.

#### Python Solution
```python
def four_sum(nums: List[int], target: int) -> List[List[int]]:
    nums.sort()
    
    def k_sum(nums: List[int], target: int, k: int) -> List[List[int]]:
        res = []
        if not nums:
            return res
            
        average_value = target // k
        if nums[0] > average_value or average_value > nums[-1]:
            return res
            
        if k == 2:
            return two_sum_helper(nums, target)
            
        for i in range(len(nums)):
            if i == 0 or nums[i - 1] != nums[i]:
                for subset in k_sum(nums[i + 1:], target - nums[i], k - 1):
                    res.append([nums[i]] + subset)
        return res

    def two_sum_helper(nums: List[int], target: int) -> List[List[int]]:
        res = []
        left, right = 0, len(nums) - 1
        while left < right:
            curr = nums[left] + nums[right]
            if curr < target or (left > 0 and nums[left] == nums[left - 1]):
                left += 1
            elif curr > target or (right < len(nums) - 1 and nums[right] == nums[right + 1]):
                right -= 1
            else:
                res.append([nums[left], nums[right]])
                left += 1
                right -= 1
        return res

    return k_sum(nums, target, 4)

print(four_sum([1, 0, -1, 0, -2, 2], 0))
```
- **Complexity:** Time: $O(n^{k-1}) = O(n^3)$ for 4Sum, Space: $O(k)$ recursion stack.

---

### Problem 4: Container With Most Water
**Difficulty: Medium | Pattern: Greedy Two Pointers**

#### Problem Statement
Given an integer array `height` of length $n$, find two lines that together with the x-axis form a container containing the most water. Return maximum water volume.

#### Python Solution
```python
def max_area(height: List[int]) -> int:
    left, right = 0, len(height) - 1
    max_water = 0
    while left < right:
        width = right - left
        h = min(height[left], height[right])
        max_water = max(max_water, width * h)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_water

print(max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]))  # 49
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 5: Trapping Rain Water
**Difficulty: Hard | Pattern: Two Pointers with Left/Right Boundary Max**

#### Problem Statement
Given $n$ non-negative integers representing elevation map where width of each bar is 1, compute how much water it can trap after raining.

#### Python Solution
```python
def trap(height: List[int]) -> int:
    if not height:
        return 0
    left, right = 0, len(height) - 1
    left_max, right_max = height[left], height[right]
    water = 0
    
    while left < right:
        if left_max < right_max:
            left += 1
            left_max = max(left_max, height[left])
            water += left_max - height[left]
        else:
            right -= 1
            right_max = max(right_max, height[right])
            water += right_max - height[right]
    return water

print(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))  # 6
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 6: Maximum Subarray (Kadane's Algorithm)
**Difficulty: Medium | Pattern: Running Subarray Reset**

#### Problem Statement
Given an integer array `nums`, find the contiguous subarray with the largest sum and return its sum.

#### Python Solution
```python
def max_sub_array(nums: List[int]) -> int:
    curr_sum = max_sum = nums[0]
    for x in nums[1:]:
        curr_sum = max(x, curr_sum + x)
        max_sum = max(max_sum, curr_sum)
    return max_sum

print(max_sub_array([-2, 1, -3, 4, -1, 2, 1, -5, 4]))  # 6
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 7: Maximum Product Subarray
**Difficulty: Medium | Pattern: Dual Extremes DP (`max_prod` & `min_prod`)**

#### Problem Statement
Given an integer array `nums`, find a contiguous non-empty subarray that has the largest product, and return the product. Negative numbers flipped by another negative become positive.

#### Python Solution
```python
def max_product(nums: List[int]) -> int:
    res = nums[0]
    cur_min = cur_max = 1
    
    for n in nums:
        # Multiply by n; negative n swaps cur_max and cur_min
        vals = (n, n * cur_max, n * cur_min)
        cur_max = max(vals)
        cur_min = min(vals)
        res = max(res, cur_max)
    return res

print(max_product([2, 3, -2, 4]))  # 6 ([2, 3])
print(max_product([-2, 0, -1]))   # 0
print(max_product([-2, 3, -4]))   # 24 ([-2, 3, -4])
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 8: Subarray Sum Equals K
**Difficulty: Medium | Pattern: Prefix Sums + Frequency Hash Map**

#### Problem Statement
Given an array of integers `nums` and integer `k`, return total continuous subarrays whose sum equals `k`.

#### Python Solution
```python
def subarray_sum(nums: List[int], k: int) -> int:
    counts = {0: 1}
    curr_sum = 0
    total = 0
    for n in nums:
        curr_sum += n
        if (curr_sum - k) in counts:
            total += counts[curr_sum - k]
        counts[curr_sum] = counts.get(curr_sum, 0) + 1
    return total

print(subarray_sum([1, 1, 1], 2))  # 2
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 9: Continuous Subarray Sum (Multiple of K)
**Difficulty: Medium | Pattern: Modulo Prefix Hashing with Index Gap $\ge 2$**

#### Problem Statement
Return `True` if `nums` has a continuous subarray of size at least 2 whose elements sum up to a multiple of `k`.

#### Python Solution
```python
def check_subarray_sum(nums: List[int], k: int) -> bool:
    # remainder -> first seen index
    seen = {0: -1}
    running_sum = 0
    for i, num in enumerate(nums):
        running_sum += num
        rem = running_sum % k
        if rem in seen:
            if i - seen[rem] >= 2:
                return True
        else:
            seen[rem] = i
    return False

print(check_subarray_sum([23, 2, 4, 6, 7], 6))  # True ([2, 4] sums to 6)
```
- **Complexity:** Time: $O(n)$, Space: $O(\min(n, k))$

---

### Problem 10: Product of Array Except Self
**Difficulty: Medium | Pattern: Prefix and Suffix Product Accumulation**

#### Problem Statement
Return array where `ans[i]` is product of all elements except `nums[i]`, without division, in $O(n)$ time and $O(1)$ auxiliary space.

#### Python Solution
```python
def product_except_self(nums: List[int]) -> List[int]:
    n = len(nums)
    res = [1] * n
    prefix = 1
    for i in range(n):
        res[i] = prefix
        prefix *= nums[i]
    suffix = 1
    for i in range(n - 1, -1, -1):
        res[i] *= suffix
        suffix *= nums[i]
    return res

print(product_except_self([1, 2, 3, 4]))  # [24, 12, 8, 6]
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$ auxiliary space.

---

### Problem 11: Merge Intervals
**Difficulty: Medium | Pattern: Interval Sorting & Linear Sweep**

#### Problem Statement
Given an array of `intervals`, merge all overlapping intervals into non-overlapping intervals.

#### Python Solution
```python
def merge_intervals(intervals: List[List[int]]) -> List[List[int]]:
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

print(merge_intervals([[1, 3], [2, 6], [8, 10], [15, 18]]))  # [[1, 6], [8, 10], [15, 18]]
```
- **Complexity:** Time: $O(n \log n)$, Space: $O(n)$

---

### Problem 12: Insert Interval
**Difficulty: Medium | Pattern: Three-Phase Linear Sweep**

#### Problem Statement
Insert `newInterval` into sorted non-overlapping `intervals` and merge if necessary.

#### Python Solution
```python
def insert_interval(intervals: List[List[int]], new_interval: List[int]) -> List[List[int]]:
    res = []
    i = 0
    n = len(intervals)
    
    # 1. Add all intervals ending before new_interval starts
    while i < n and intervals[i][1] < new_interval[0]:
        res.append(intervals[i])
        i += 1
        
    # 2. Merge all overlapping intervals with new_interval
    while i < n and intervals[i][0] <= new_interval[1]:
        new_interval[0] = min(new_interval[0], intervals[i][0])
        new_interval[1] = max(new_interval[1], intervals[i][1])
        i += 1
    res.append(new_interval)
    
    # 3. Add remaining intervals
    while i < n:
        res.append(intervals[i])
        i += 1
    return res

print(insert_interval([[1, 3], [6, 9]], [2, 5]))  # [[1, 5], [6, 9]]
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 13: Non-Overlapping Intervals
**Difficulty: Medium | Pattern: Greedy Interval Scheduling (Sort by End Time)**

#### Problem Statement
Find minimum number of intervals to remove to make remainder non-overlapping.

#### Python Solution
```python
def erase_overlap_intervals(intervals: List[List[int]]) -> int:
    intervals.sort(key=lambda x: x[1])  # Greedy by earliest finish time
    removals = 0
    prev_end = float('-inf')
    for start, end in intervals:
        if start >= prev_end:
            prev_end = end
        else:
            removals += 1
    return removals

print(erase_overlap_intervals([[1, 2], [2, 3], [3, 4], [1, 3]]))  # 1
```
- **Complexity:** Time: $O(n \log n)$, Space: $O(1)$

---

### Problem 14: Rotate Array by K Steps
**Difficulty: Medium | Pattern: 3-Step In-Place Reversal**

#### Problem Statement
Rotate an array of $n$ elements to the right by $k$ steps in-place with $O(1)$ extra memory.

#### Python Solution
```python
def rotate(nums: List[int], k: int) -> None:
    n = len(nums)
    k %= n
    def reverse(l: int, r: int):
        while l < r:
            nums[l], nums[r] = nums[r], nums[l]
            l += 1
            r -= 1
    reverse(0, n - 1)
    reverse(0, k - 1)
    reverse(k, n - 1)

arr = [1, 2, 3, 4, 5, 6, 7]
rotate(arr, 3)
print(arr)  # [5, 6, 7, 1, 2, 3, 4]
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 15: Next Permutation
**Difficulty: Medium | Pattern: Lexicographical Pivot Search & Suffix Inversion**

#### Problem Statement
Rearrange numbers into lexicographically next greater permutation in-place.

#### Python Solution
```python
def next_permutation(nums: List[int]) -> None:
    n = len(nums)
    i = n - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1
    if i >= 0:
        j = n - 1
        while nums[j] <= nums[i]:
            j -= 1
        nums[i], nums[j] = nums[j], nums[i]
    # Reverse suffix starting at i + 1
    l, r = i + 1, n - 1
    while l < r:
        nums[l], nums[r] = nums[r], nums[l]
        l += 1
        r -= 1

a = [1, 2, 3]
next_permutation(a)
print(a)  # [1, 3, 2]
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 16: Set Matrix Zeroes
**Difficulty: Medium | Pattern: In-Place Marking using First Row and Column**

#### Problem Statement
Given an $m \times n$ matrix, if an element is 0, set its entire row and column to 0 in-place with $O(1)$ space.

#### Python Solution
```python
def set_zeroes(matrix: List[List[int]]) -> None:
    rows, cols = len(matrix), len(matrix[0])
    first_row_zero = any(matrix[0][c] == 0 for c in range(cols))
    first_col_zero = any(matrix[r][0] == 0 for r in range(rows))
    
    # Use first row and column as markers
    for r in range(1, rows):
        for c in range(1, cols):
            if matrix[r][c] == 0:
                matrix[r][0] = 0
                matrix[0][c] = 0
                
    # Zero out cells based on markers
    for r in range(1, rows):
        for c in range(1, cols):
            if matrix[r][0] == 0 or matrix[0][c] == 0:
                matrix[r][c] = 0
                
    if first_row_zero:
        for c in range(cols): matrix[0][c] = 0
    if first_col_zero:
        for r in range(rows): matrix[r][0] = 0
```
- **Complexity:** Time: $O(m \cdot n)$, Space: $O(1)$

---

### Problem 17: Spiral Matrix
**Difficulty: Medium | Pattern: 4-Boundary Inward Contraction**

#### Problem Statement
Given an $m \times n$ matrix, return all elements of the matrix in spiral order.

#### Python Solution
```python
def spiral_order(matrix: List[List[int]]) -> List[int]:
    res = []
    top, bottom = 0, len(matrix) - 1
    left, right = 0, len(matrix[0]) - 1
    
    while top <= bottom and left <= right:
        for c in range(left, right + 1):
            res.append(matrix[top][c])
        top += 1
        for r in range(top, bottom + 1):
            res.append(matrix[r][right])
        right -= 1
        if top <= bottom:
            for c in range(right, left - 1, -1):
                res.append(matrix[bottom][c])
            bottom -= 1
        if left <= right:
            for r in range(bottom, top - 1, -1):
                res.append(matrix[r][left])
            left += 1
    return res

print(spiral_order([[1, 2, 3], [4, 5, 6], [7, 8, 9]]))  # [1, 2, 3, 6, 9, 8, 7, 4, 5]
```
- **Complexity:** Time: $O(m \cdot n)$, Space: $O(1)$ auxiliary space.

---

### Problem 18: Rotate Image (90 Degrees Clockwise)
**Difficulty: Medium | Pattern: Transpose + Row Reversal**

#### Problem Statement
Rotate an $n \times n$ 2D matrix by 90 degrees clockwise in-place with $O(1)$ extra space.

#### Python Solution
```python
def rotate_image(matrix: List[List[int]]) -> None:
    n = len(matrix)
    # 1. Transpose: swap matrix[i][j] with matrix[j][i]
    for i in range(n):
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    # 2. Reverse each row
    for i in range(n):
        matrix[i].reverse()

mat = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
rotate_image(mat)
print(mat)  # [[7, 4, 1], [8, 5, 2], [9, 6, 3]]
```
- **Complexity:** Time: $O(n^2)$, Space: $O(1)$

---

### Problem 19: Sort Colors (Dutch National Flag Algorithm)
**Difficulty: Medium | Pattern: 3-Way Partitioning with 3 Pointers**

#### Problem Statement
Sort an array with $n$ objects colored red (`0`), white (`1`), or blue (`2`) in-place in a single pass.

#### Python Solution
```python
def sort_colors(nums: List[int]) -> None:
    low = 0
    mid = 0
    high = len(nums) - 1
    
    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1
            mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1

arr = [2, 0, 2, 1, 1, 0]
sort_colors(arr)
print(arr)  # [0, 0, 1, 1, 2, 2]
```
- **Complexity:** Time: $O(n)$ in single pass, Space: $O(1)$

---

### Problem 20: Majority Element ($> n/2$ occurrences)
**Difficulty: Easy | Pattern: Boyer-Moore Voting Algorithm**

#### Problem Statement
Find the majority element that appears more than $\lfloor n / 2 \rfloor$ times in $O(n)$ time and $O(1)$ space.

#### Python Solution
```python
def majority_element(nums: List[int]) -> int:
    candidate = None
    count = 0
    for num in nums:
        if count == 0:
            candidate = num
        count += (1 if num == candidate else -1)
    return candidate

print(majority_element([2, 2, 1, 1, 1, 2, 2]))  # 2
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 21: Majority Element II ($> n/3$ occurrences)
**Difficulty: Medium | Pattern: Dual-Candidate Boyer-Moore Voting**

#### Problem Statement
Find all elements that appear more than $\lfloor n / 3 \rfloor$ times. (At most 2 candidates can exist).

#### Python Solution
```python
def majority_element_ii(nums: List[int]) -> List[int]:
    if not nums:
        return []
    cand1, cand2 = None, None
    count1, count2 = 0, 0
    
    for n in nums:
        if n == cand1:
            count1 += 1
        elif n == cand2:
            count2 += 1
        elif count1 == 0:
            cand1, count1 = n, 1
        elif count2 == 0:
            cand2, count2 = n, 1
        else:
            count1 -= 1
            count2 -= 1
            
    # Verify candidates
    return [c for c in (cand1, cand2) if c is not None and nums.count(c) > len(nums) // 3]

print(majority_element_ii([3, 2, 3]))  # [3]
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 22: Find the Duplicate Number
**Difficulty: Medium-Hard | Pattern: Floyd's Cycle Detection on Array Pointers**

#### Problem Statement
Given an array of $n + 1$ integers where each integer is in range $[1, n]$, find the duplicate number without modifying array and in $O(1)$ space.

#### Python Solution
```python
def find_duplicate(nums: List[int]) -> int:
    # Phase 1: Tortoise and hare cycle intersection
    slow = nums[0]
    fast = nums[0]
    while True:
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast:
            break
            
    # Phase 2: Find cycle entrance
    ptr1 = nums[0]
    ptr2 = slow
    while ptr1 != ptr2:
        ptr1 = nums[ptr1]
        ptr2 = nums[ptr2]
    return ptr1

print(find_duplicate([1, 3, 4, 2, 2]))  # 2
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 23: First Missing Positive
**Difficulty: Hard | Pattern: Cyclic Sort / In-Place Index Hashing**

#### Problem Statement
Given an unsorted integer array `nums`, return smallest missing positive integer in $O(n)$ time and $O(1)$ auxiliary space.

#### Python Solution
```python
def first_missing_positive(nums: List[int]) -> int:
    n = len(nums)
    # Place each number x in index x - 1 if 1 <= x <= n
    for i in range(n):
        while 1 <= nums[i] <= n and nums[nums[i] - 1] != nums[i]:
            target_idx = nums[i] - 1
            nums[i], nums[target_idx] = nums[target_idx], nums[i]
            
    for i in range(n):
        if nums[i] != i + 1:
            return i + 1
    return n + 1

print(first_missing_positive([3, 4, -1, 1]))  # 2
print(first_missing_positive([7, 8, 9, 11, 12]))  # 1
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 24: Jump Game I (Can Reach End?)
**Difficulty: Medium | Pattern: Greedy Furthest Reachable Index**

#### Problem Statement
Given an integer array `nums` where each element represents maximum jump length from that position, return `True` if you can reach the last index.

#### Python Solution
```python
def can_jump(nums: List[int]) -> bool:
    max_reach = 0
    for i, jump in enumerate(nums):
        if i > max_reach:
            return False
        max_reach = max(max_reach, i + jump)
    return True

print(can_jump([2, 3, 1, 1, 4]))  # True
print(can_jump([3, 2, 1, 0, 4]))  # False
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 25: Jump Game II (Minimum Jumps)
**Difficulty: Medium | Pattern: Greedy BFS Window Level Expansion**

#### Problem Statement
Return minimum number of jumps to reach the last index from index 0.

#### Python Solution
```python
def jump(nums: List[int]) -> int:
    jumps = 0
    cur_end = 0
    farthest = 0
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        if i == cur_end:
            jumps += 1
            cur_end = farthest
    return jumps

print(jump([2, 3, 1, 1, 4]))  # 2
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 26: Best Time to Buy and Sell Stock I
**Difficulty: Easy | Pattern: Running Minimum Price Tracking**

#### Problem Statement
Maximize profit by choosing a single day to buy and a different day in the future to sell.

#### Python Solution
```python
def max_profit_single(prices: List[int]) -> int:
    min_price = float('inf')
    max_prof = 0
    for p in prices:
        if p < min_price:
            min_price = p
        elif p - min_price > max_prof:
            max_prof = p - min_price
    return max_prof

print(max_profit_single([7, 1, 5, 3, 6, 4]))  # 5
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 27: Best Time to Buy and Sell Stock II
**Difficulty: Medium | Pattern: Greedy Collection of All Positive Slopes**

#### Problem Statement
Find maximum profit with unlimited transactions (buy then sell repeatedly).

#### Python Solution
```python
def max_profit_unlimited(prices: List[int]) -> int:
    profit = 0
    for i in range(1, len(prices)):
        if prices[i] > prices[i - 1]:
            profit += prices[i] - prices[i - 1]
    return profit

print(max_profit_unlimited([7, 1, 5, 3, 6, 4]))  # 7 ((5-1) + (6-3))
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 28: Longest Consecutive Sequence
**Difficulty: Medium | Pattern: Hash Set Sequence Boundary Expansion**

#### Problem Statement
Given an unsorted array of integers `nums`, return length of longest consecutive elements sequence in $O(n)$ time.

#### Python Solution
```python
def longest_consecutive(nums: List[int]) -> int:
    num_set = set(nums)
    best = 0
    for x in num_set:
        if x - 1 not in num_set:
            curr = x
            streak = 1
            while curr + 1 in num_set:
                curr += 1
                streak += 1
            best = max(best, streak)
    return best

print(longest_consecutive([100, 4, 200, 1, 3, 2]))  # 4 ([1, 2, 3, 4])
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 29: Subarray Sums Divisible by K
**Difficulty: Medium | Pattern: Modulo Prefix Frequency Counting**

#### Problem Statement
Given integer array `nums` and integer `k`, return number of non-empty subarrays with sum divisible by `k`.

#### Python Solution
```python
def subarrays_div_by_k(nums: List[int], k: int) -> int:
    rem_count = {0: 1}
    run_sum = 0
    ans = 0
    for n in nums:
        run_sum += n
        rem = run_sum % k
        if rem in rem_count:
            ans += rem_count[rem]
        rem_count[rem] = rem_count.get(rem, 0) + 1
    return ans

print(subarrays_div_by_k([4, 5, 0, -2, -3, 1], 5))  # 7
```
- **Complexity:** Time: $O(n)$, Space: $O(k)$

---

### Problem 30: Squares of a Sorted Array
**Difficulty: Easy | Pattern: Two Pointers from Outer Extremes**

#### Problem Statement
Given integer array `nums` sorted in non-decreasing order, return an array of squares of each number sorted in non-decreasing order in $O(n)$ time.

#### Python Solution
```python
def sorted_squares(nums: List[int]) -> List[int]:
    n = len(nums)
    res = [0] * n
    left, right = 0, n - 1
    idx = n - 1
    
    while left <= right:
        left_sq = nums[left] * nums[left]
        right_sq = nums[right] * nums[right]
        if left_sq > right_sq:
            res[idx] = left_sq
            left += 1
        else:
            res[idx] = right_sq
            right -= 1
        idx -= 1
    return res

print(sorted_squares([-4, -1, 0, 3, 10]))  # [0, 1, 9, 16, 100]
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$
