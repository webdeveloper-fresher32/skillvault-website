# Top Interview Questions — Complexity & Foundations

Master these 15 essential interview problems and analytical challenges covering asymptotic analysis, recursion trees, recurrence relations, Master Theorem, binary search logic, and mathematical foundations.

---

### Problem 1: Analyze Nested Loop Complexity with Doubling Index
**Difficulty: Medium | Pattern: Geometric Series Summation / Amortized Analysis**

#### Problem Statement
Analyze the exact time and auxiliary space complexity of the following code snippet:
```python
def compute_sum(n: int) -> int:
    total = 0
    i = 1
    while i < n:
        j = 0
        while j < i:
            total += 1
            j += 1
        i *= 2
    return total
```

#### Interview Strategy & Mathematical Derivation
At first glance, developers see nested loops and guess $O(n^2)$ or $O(n \log n)$. 
- The outer loop variable `i` takes values: $1, 2, 4, 8, \dots, 2^k$ where $2^k < n$.
- In the inner loop, for a given $i$, `j` executes exactly $i$ times.
- The total number of inner loop operations is the sum:
  $$\sum_{k=0}^{\lfloor \log_2 n \rfloor} 2^k = 1 + 2 + 4 + 8 + \dots + 2^{\lfloor \log_2 n \rfloor}$$
- This is a standard geometric series with common ratio $r = 2$.
- The sum of this series is $2^{\lfloor \log_2 n \rfloor + 1} - 1 < 2n$.
- Therefore, the total operations are strictly bounded by $2n$, yielding **$O(n)$ time complexity**.

#### Complexity
- **Time Complexity:** $O(n)$
- **Space Complexity:** $O(1)$ auxiliary space

#### Common Trap
Assuming that because the outer loop runs $\log n$ times and the inner loop runs up to $n$ times, the bound is $O(n \log n)$. Because the inner loop bound depends geometrically on $i$, the sum collapses to linear.

---

### Problem 2: Binary Exponentiation — Implement `pow(x, n)`
**Difficulty: Medium | Pattern: Divide and Conquer / Decrease by Half**

#### Problem Statement
Implement `my_pow(x: float, n: int) -> float`, which calculates $x$ raised to the power $n$ ($x^n$). Must handle negative exponents and run in $O(\log n)$ time.

#### Python Solution
```python
def my_pow(x: float, n: int) -> float:
    """Computes x^n in O(log n) time using binary exponentiation."""
    if n == 0:
        return 1.0
    
    # Handle negative powers
    if n < 0:
        x = 1.0 / x
        n = -n
        
    result = 1.0
    current_product = x
    
    while n > 0:
        # If n is odd, multiply result by current power of x
        if n % 2 == 1:
            result *= current_product
        # Square the base and halve the exponent
        current_product *= current_product
        n //= 2
        
    return result

# Example Verification
print(my_pow(2.0, 10))  # 1024.0
print(my_pow(2.0, -2))  # 0.25
```

#### Complexity
- **Time Complexity:** $O(\log n)$ because the exponent is halved in each step.
- **Space Complexity:** $O(1)$ auxiliary space (iterative).

#### Edge Cases
- $n = 0 \to 1.0$
- $x = 0 \to 0.0$ (when $n > 0$)
- Negative powers $n < 0$ (must invert base and negate $n$)
- Potential 32-bit integer overflow in languages like C++/Java when $n = -2^{31}$.

---

### Problem 3: Recurrence Relation of Merge Sort & The Master Theorem
**Difficulty: Medium | Pattern: Divide and Conquer / Master Theorem**

#### Problem Statement
State the recurrence relation for Merge Sort, explain why it cannot be solved in $O(1)$ auxiliary space for arrays, and use the Master Theorem to solve it.

#### Analytical Derivation
1. **Recurrence Relation:**
   Merge Sort divides an array of size $n$ into 2 equal halves, recursively sorts both halves, and merges them in linear time:
   $$T(n) = 2T(n/2) + O(n)$$
2. **Master Theorem Application:**
   Form: $T(n) = aT(n/b) + f(n)$ where $a = 2$, $b = 2$, $f(n) = O(n^1)$.
   Calculate $c_{crit} = \log_b a = \log_2 2 = 1$.
   Since $f(n) = \Theta(n^1) = \Theta(n^{c_{crit}})$, this falls into **Case 2** of the Master Theorem:
   $$T(n) = \Theta(n^{c_{crit}} \log n) = \Theta(n \log n)$$
3. **Auxiliary Space Tradeoff (Arrays vs Linked Lists):**
   - For **Arrays**: Merging two contiguous sorted subarrays in $O(n)$ time requires an auxiliary buffer of size $O(n)$ because shifting elements in-place takes $O(n)$ per element, degrading total time to $O(n^2)$.
   - For **Linked Lists**: Merging only requires rearranging pointers (`next` pointers), achieving $O(1)$ auxiliary space (ignoring recursion stack).

---

### Problem 4: Integer Square Root (`my_sqrt`)
**Difficulty: Easy-Medium | Pattern: Binary Search on Monotonic Space**

#### Problem Statement
Given a non-negative integer $x$, compute and return the square root of $x$ rounded down to the nearest integer. Do not use built-in exponent functions.

#### Python Solution
```python
def my_sqrt(x: int) -> int:
    """Computes floor(sqrt(x)) in O(log x) using binary search."""
    if x < 2:
        return x
        
    left, right = 1, x // 2
    ans = 1
    
    while left <= right:
        mid = left + (right - left) // 2
        sq = mid * mid
        
        if sq == x:
            return mid
        elif sq < x:
            ans = mid      # mid could be floor(sqrt(x))
            left = mid + 1 # search right
        else:
            right = mid - 1
            
    return ans

print(my_sqrt(8))   # 2 (since 2*2 = 4 <= 8 < 9)
print(my_sqrt(16))  # 4
```

#### Complexity
- **Time Complexity:** $O(\log x)$
- **Space Complexity:** $O(1)$

---

### Problem 5: Amortized Analysis of Dynamic Array Resizing
**Difficulty: Medium | Pattern: Accounting / Banker's Method**

#### Problem Statement
Explain why appending an element to a dynamic array (like Python's `list` or Java's `ArrayList`) has an **amortized** time complexity of $O(1)$, even though allocating a new array and copying elements takes $O(n)$.

#### Explanation & Proof
1. **Cost of Doubling:**
   Suppose the array starts with capacity 1 and doubles whenever it reaches capacity.
   - Insertions at sizes 1, 2, 4, 8, ... trigger resizes.
   - For $n$ insertions (where $n = 2^k$):
     - Cost of copy operations: $1 + 2 + 4 + 8 + \dots + n/2 = n - 1$ operations.
     - Cost of actual element insertions: $n$ operations.
     - Total operations for $n$ appends $= (n - 1) + n = 2n - 1$.
2. **Amortized Cost:**
   $$\text{Amortized Cost per Append} = \frac{2n - 1}{n} < 2 = O(1)$$
3. **What if the array grew by fixed $+K$ instead of doubling?**
   If it grows by $+K$, resizing happens $n/K$ times. Total copying work is $K + 2K + 3K + \dots + n \approx O(n^2)$. Amortized cost degrades to $O(n)$ per append!

---

### Problem 6: Quickselect — Find the k-th Smallest / Largest Element
**Difficulty: Medium | Pattern: Divide and Conquer / Pruning Partition**

#### Problem Statement
Find the $k$-th smallest element in an unsorted array in $O(n)$ average time without sorting the whole array.

#### Python Solution
```python
import random
from typing import List

def find_kth_smallest(nums: List[int], k: int) -> int:
    """Quickselect algorithm: average O(n) time, O(1) auxiliary space."""
    target_idx = k - 1  # 0-indexed
    
    def partition(left: int, right: int, pivot_idx: int) -> int:
        pivot_val = nums[pivot_idx]
        # Move pivot to the end
        nums[pivot_idx], nums[right] = nums[right], nums[pivot_idx]
        store_idx = left
        for i in range(left, right):
            if nums[i] < pivot_val:
                nums[store_idx], nums[i] = nums[i], nums[store_idx]
                store_idx += 1
        # Place pivot at its final sorted position
        nums[store_idx], nums[right] = nums[right], nums[store_idx]
        return store_idx

    left, right = 0, len(nums) - 1
    while left <= right:
        pivot_idx = random.randint(left, right)
        pivot_idx = partition(left, right, pivot_idx)
        
        if pivot_idx == target_idx:
            return nums[pivot_idx]
        elif pivot_idx < target_idx:
            left = pivot_idx + 1
        else:
            right = pivot_idx - 1
            
    return -1
```

#### Complexity
- **Time Complexity:** Average $O(n)$ via recurrence $T(n) = T(n/2) + O(n)$. Worst case $O(n^2)$ if pivot is always extreme (mitigated by randomized pivot).
- **Space Complexity:** $O(1)$ auxiliary space.

---

### Problem 7: Count Inversions in an Array
**Difficulty: Hard | Pattern: Enhanced Divide and Conquer (Merge Sort)**

#### Problem Statement
Two elements $a[i]$ and $a[j]$ form an inversion if $a[i] > a[j]$ and $i < j$. Count total inversions in $O(n \log n)$ time.

#### Python Solution
```python
from typing import List, Tuple

def count_inversions(arr: List[int]) -> int:
    """Counts inversions using modified merge sort in O(n log n) time."""
    temp = [0] * len(arr)
    
    def merge_and_count(left: int, mid: int, right: int) -> int:
        i, j, k = left, mid + 1, left
        inversions = 0
        
        while i <= mid and j <= right:
            if arr[i] <= arr[j]:
                temp[k] = arr[i]
                i += 1
            else:
                temp[k] = arr[j]
                # If arr[i] > arr[j], all remaining elements from i to mid are > arr[j]
                inversions += (mid - i + 1)
                j += 1
            k += 1
            
        while i <= mid:
            temp[k] = arr[i]
            i += 1
            k += 1
            
        while j <= right:
            temp[k] = arr[j]
            j += 1
            k += 1
            
        for idx in range(left, right + 1):
            arr[idx] = temp[idx]
            
        return inversions

    def sort_and_count(left: int, right: int) -> int:
        if left >= right:
            return 0
        mid = (left + right) // 2
        inv = sort_and_count(left, mid)
        inv += sort_and_count(mid + 1, right)
        inv += merge_and_count(left, mid, right)
        return inv

    return sort_and_count(0, len(arr) - 1)

print(count_inversions([8, 4, 2, 1]))  # 6 inversions: (8,4), (8,2), (8,1), (4,2), (4,1), (2,1)
```

#### Complexity
- **Time Complexity:** $O(n \log n)$
- **Space Complexity:** $O(n)$ auxiliary array

---

### Problem 8: Greatest Common Divisor (Euclidean Algorithm) & Lamé's Theorem
**Difficulty: Easy | Pattern: Number Theory & Logarithmic Descent**

#### Problem Statement
Compute the Greatest Common Divisor ($\gcd$) of integers $a$ and $b$ in $O(\log(\min(a, b)))$ time. Prove why it runs in logarithmic time.

#### Python Solution
```python
def gcd(a: int, b: int) -> int:
    """Euclidean algorithm for GCD: gcd(a, b) = gcd(b, a % b)."""
    while b:
        a, b = b, a % b
    return abs(a)

print(gcd(48, 18))  # 6
```

#### Proof of Complexity (Lamé's Theorem)
- If $a \ge b$, then $a \pmod b < a/2$.
  - Case 1: If $b \le a/2$, then $a \pmod b < b \le a/2$.
  - Case 2: If $b > a/2$, then $a \pmod b = a - b < a/2$.
- In every 2 consecutive steps, the larger number is halved. Hence, the number of steps is at most $2 \log_2(\min(a, b))$, giving $O(\log(\min(a, b)))$.

---

### Problem 9: Tower of Hanoi
**Difficulty: Medium | Pattern: Classical Divide and Conquer Recursion**

#### Problem Statement
Solve the Tower of Hanoi for $n$ disks moving from rod `A` to rod `C` using auxiliary rod `B`. Calculate exact step count.

#### Python Solution
```python
def tower_of_hanoi(n: int, source: str, target: str, auxiliary: str, moves: list) -> None:
    if n == 1:
        moves.append(f"Move disk 1 from {source} to {target}")
        return
    # Move top n-1 disks from source to auxiliary using target
    tower_of_hanoi(n - 1, source, auxiliary, target, moves)
    # Move the nth disk from source to target
    moves.append(f"Move disk {n} from {source} to {target}")
    # Move the n-1 disks from auxiliary to target using source
    tower_of_hanoi(n - 1, auxiliary, target, source, moves)

moves = []
tower_of_hanoi(3, 'A', 'C', 'B', moves)
print(f"Total moves: {len(moves)}")  # 2^3 - 1 = 7
```

#### Recurrence & Complexity
- Recurrence: $T(n) = 2T(n-1) + 1$, where $T(1) = 1$.
- Expansion: $T(n) = 2^n - 1$.
- **Time Complexity:** $O(2^n)$
- **Space Complexity:** $O(n)$ recursion stack depth.

---

### Problem 10: Fibonacci with Optimal Space — Matrix Exponentiation
**Difficulty: Hard | Pattern: Matrix Exponentiation / $O(\log n)$ State Transitions**

#### Problem Statement
Compute the $n$-th Fibonacci number modulo $10^9 + 7$ in $O(\log n)$ time.

#### Python Solution
```python
MOD = 10**9 + 7

def fibonacci_log_n(n: int) -> int:
    """Computes F(n) in O(log n) time using 2x2 matrix exponentiation."""
    if n <= 0:
        return 0
    if n == 1:
        return 1

    def multiply(A, B):
        return [
            [(A[0][0]*B[0][0] + A[0][1]*B[1][0]) % MOD, (A[0][0]*B[0][1] + A[0][1]*B[1][1]) % MOD],
            [(A[1][0]*B[0][0] + A[1][1]*B[1][0]) % MOD, (A[1][0]*B[0][1] + A[1][1]*B[1][1]) % MOD]
        ]

    def power(M, p):
        res = [[1, 0], [0, 1]] # Identity matrix
        base = M
        while p > 0:
            if p % 2 == 1:
                res = multiply(res, base)
            base = multiply(base, base)
            p //= 2
        return res

    T = [[1, 1], [1, 0]]
    result_matrix = power(T, n - 1)
    return result_matrix[0][0]

print(fibonacci_log_n(50))  # 12586269025 % (10^9+7)
```

#### Complexity
- **Time Complexity:** $O(\log n)$ matrix multiplications (each $2 \times 2$ multiplication is $O(1)$).
- **Space Complexity:** $O(1)$.

---

### Problem 11: Tail Call Elimination & Recursion Stack Depth
**Difficulty: Easy-Medium | Pattern: Stack Memory Architecture**

#### Problem Statement
Explain why recursive algorithms risk a `RecursionError` (Stack Overflow) and how accumulator-based tail recursion transforms space from $O(n)$ to $O(1)$ in supporting compilers.

#### Explanation
- In standard recursion:
  ```python
  def factorial(n):
      if n <= 1: return 1
      return n * factorial(n - 1)  # pending multiplication: stack frame cannot be dropped!
  ```
  Every call must preserve its local variables on the call stack until the callee returns. Stack space = $O(n)$.
- In tail recursion:
  ```python
  def factorial_tail(n, acc=1):
      if n <= 1: return acc
      return factorial_tail(n - 1, n * acc)  # Nothing to do after call!
  ```
  The compiler can overwrite the current stack frame rather than pushing a new one, reducing call stack memory from $O(n)$ to $O(1)$.
  *(Note: Standard CPython does not optimize tail calls to preserve full tracebacks, but language interviewers heavily test this concept).*

---

### Problem 12: Peak Element in Array
**Difficulty: Medium | Pattern: Binary Search on Unsorted Array**

#### Problem Statement
A peak element is an element that is strictly greater than its neighbors. Given an integer array `nums`, find any peak element and return its index in $O(\log n)$ time.

#### Python Solution
```python
def find_peak_element(nums: List[int]) -> int:
    """Finds peak element index in O(log n) time."""
    left, right = 0, len(nums) - 1
    
    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] < nums[mid + 1]:
            # The slope is going upward, so a peak MUST exist on the right side
            left = mid + 1
        else:
            # The slope is flat or going downward, peak is at mid or to the left
            right = mid
            
    return left

print(find_peak_element([1, 2, 3, 1]))  # Index 2 (value 3)
```

#### Complexity
- **Time Complexity:** $O(\log n)$
- **Space Complexity:** $O(1)$

---

### Problem 13: Search in Rotated Sorted Array
**Difficulty: Medium | Pattern: Modified Binary Search (Half-Sorted Invariant)**

#### Problem Statement
Given a rotated sorted array of distinct values and a `target`, return the index of `target`, or `-1` if not present. Run in $O(\log n)$ time.

#### Python Solution
```python
def search_rotated(nums: List[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
            
        # Determine which half is sorted
        if nums[left] <= nums[mid]:
            # Left half is sorted
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:
            # Right half is sorted
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
                
    return -1

print(search_rotated([4, 5, 6, 7, 0, 1, 2], 0))  # Index 4
```

#### Complexity
- **Time Complexity:** $O(\log n)$
- **Space Complexity:** $O(1)$

---

### Problem 14: Generate All Subsets (Power Set) Complexity Analysis
**Difficulty: Medium | Pattern: Recursion Tree & Combinatorial Complexity**

#### Problem Statement
Generate all $2^n$ subsets of an array of distinct integers. Analyze the exact number of nodes in the recursion tree and total runtime.

#### Python Solution
```python
def subsets(nums: List[int]) -> List[List[int]]:
    result = []
    
    def backtrack(start: int, current_subset: List[int]):
        # Add a copy of current subset
        result.append(list(current_subset))
        
        for i in range(start, len(nums)):
            current_subset.append(nums[i])
            backtrack(i + 1, current_subset)
            current_subset.pop()
            
    backtrack(0, [])
    return result

print(subsets([1, 2, 3]))
```

#### Complexity & Proof
- Total subsets generated: $2^n$.
- Copying each subset of average size $n/2$ takes $O(n)$ time.
- **Time Complexity:** $O(n \cdot 2^n)$
- **Space Complexity:** $O(n)$ auxiliary recursion stack (excluding output array).

---

### Problem 15: Sieve of Eratosthenes — Prime Generation
**Difficulty: Medium | Pattern: Mathematical Sieving & Harmonic Series of Primes**

#### Problem Statement
Return all prime numbers strictly less than $n$ in $O(n \log \log n)$ time.

#### Python Solution
```python
def count_primes(n: int) -> int:
    """Sieve of Eratosthenes in O(n log log n) time."""
    if n <= 2:
        return 0
        
    is_prime = [True] * n
    is_prime[0] = is_prime[1] = False
    
    # Only need to check up to sqrt(n)
    p = 2
    while p * p < n:
        if is_prime[p]:
            # Mark multiples starting at p*p
            for multiple in range(p * p, n, p):
                is_prime[multiple] = False
        p += 1
        
    return sum(is_prime)

print(count_primes(30))  # 10 primes: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29
```

#### Why $O(n \log \log n)$?
Total operations equal $n \sum_{p \le n} \frac{1}{p}$. By Mertens' Second Theorem, the sum of reciprocals of primes up to $n$ grows asymptotically as $\ln(\ln n)$. Hence, total operations $= O(n \log \log n)$.
