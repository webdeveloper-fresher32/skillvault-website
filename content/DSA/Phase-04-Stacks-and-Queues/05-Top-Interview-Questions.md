# Top Interview Questions — Stacks & Queues

Master these 15 essential interview problems covering Monotonic Stacks, Double-Ended Queues (Deques), Amortized Queue Design, Expression Parsing, and Histogram Geometries.

---

### Problem 1: Valid Parentheses
**Difficulty: Easy | Pattern: Last-In First-Out (LIFO) Matching**

#### Problem Statement
Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid (brackets must close in correct order and with correct type).

#### Python Solution
```python
def is_valid(s: str) -> bool:
    bracket_map = {')': '(', '}': '{', ']': '['}
    stack = []
    
    for char in s:
        if char in bracket_map:
            # If closing bracket, top of stack must match
            top_element = stack.pop() if stack else '#'
            if bracket_map[char] != top_element:
                return False
        else:
            # Opening bracket: push to stack
            stack.append(char)
            
    return len(stack) == 0

print(is_valid("()[]{}"))  # True
print(is_valid("([)]"))    # False
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 2: Min Stack with $O(1)$ Operations
**Difficulty: Medium | Pattern: Auxiliary Minimum Tracking**

#### Problem Statement
Design a stack that supports `push`, `pop`, `top`, and retrieving the minimum element in constant $O(1)$ time.

#### Python Solution
```python
class MinStack:
    def __init__(self):
        # Store pairs of (value, current_min_at_this_level)
        self.stack = []

    def push(self, val: int) -> None:
        if not self.stack:
            self.stack.append((val, val))
        else:
            current_min = min(val, self.stack[-1][1])
            self.stack.append((val, current_min))

    def pop(self) -> None:
        if self.stack:
            self.stack.pop()

    def top(self) -> int:
        return self.stack[-1][0] if self.stack else -1

    def get_min(self) -> int:
        return self.stack[-1][1] if self.stack else -1
```

#### Complexity
- **Time:** $O(1)$ for all operations (`push`, `pop`, `top`, `get_min`).
- **Space:** $O(n)$ space.

---

### Problem 3: Evaluate Reverse Polish Notation (Postfix)
**Difficulty: Medium | Pattern: Operator Evaluation via Operand Stack**

#### Problem Statement
Evaluate the value of an arithmetic expression in Reverse Polish Notation. Valid operators are `+`, `-`, `*`, and `/`. Division between two integers must truncate toward zero.

#### Python Solution
```python
from typing import List

def eval_rpn(tokens: List[str]) -> int:
    stack = []
    
    for token in tokens:
        if token in {"+", "-", "*", "/"}:
            b = stack.pop()
            a = stack.pop()
            if token == "+":
                stack.append(a + b)
            elif token == "-":
                stack.append(a - b)
            elif token == "*":
                stack.append(a * b)
            else:
                # Python's integer division // rounds towards negative infinity.
                # int(a / b) truncates towards zero as required.
                stack.append(int(a / b))
        else:
            stack.append(int(token))
            
    return stack[0]

print(eval_rpn(["2", "1", "+", "3", "*"]))           # 9 ((2 + 1) * 3)
print(eval_rpn(["4", "13", "5", "/", "+"]))          # 6 (4 + (13 / 5))
print(eval_rpn(["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"])) # 22
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 4: Daily Temperatures (Next Warmer Day)
**Difficulty: Medium | Pattern: Monotonic Decreasing Stack**

#### Problem Statement
Given an array of integers `temperatures`, return an array `answer` such that `answer[i]` is the number of days you have to wait after the $i$-th day to get a warmer temperature. If no future day is warmer, `answer[i] == 0`.

#### Python Solution
```python
def daily_temperatures(temperatures: List[int]) -> List[int]:
    n = len(temperatures)
    ans = [0] * n
    stack = []  # indices of days with strictly decreasing temperatures
    
    for curr_day, curr_temp in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < curr_temp:
            prev_day = stack.pop()
            ans[prev_day] = curr_day - prev_day
        stack.append(curr_day)
        
    return ans

print(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
# [1, 1, 4, 2, 1, 1, 0, 0]
```

#### Complexity
- **Time:** $O(n)$ — Each index is pushed and popped at most once.
- **Space:** $O(n)$ auxiliary stack.

---

### Problem 5: Next Greater Element II (Circular Array)
**Difficulty: Medium | Pattern: Monotonic Stack with Modulo Traversal ($2n$ loop)**

#### Problem Statement
Given a circular integer array `nums`, return the next greater number for every element. If it doesn't exist, return `-1`.

#### Python Solution
```python
def next_greater_elements(nums: List[int]) -> List[int]:
    n = len(nums)
    res = [-1] * n
    stack = []  # stores indices
    
    # Loop twice to simulate circular wrap-around
    for i in range(2 * n):
        curr = nums[i % n]
        while stack and nums[stack[-1]] < curr:
            res[stack.pop()] = curr
        if i < n:
            stack.append(i)
            
    return res

print(next_greater_elements([1, 2, 1]))  # [2, -1, 2]
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 6: Largest Rectangle in Histogram
**Difficulty: Hard | Pattern: Monotonic Increasing Stack with Width Resolution**

#### Problem Statement
Given an array of integers `heights` representing the histogram's bar height where the width of each bar is 1, return the area of the largest rectangle in the histogram in $O(n)$ time.

#### Python Solution
```python
def largest_rectangle_area(heights: List[int]) -> int:
    stack = []  # stores indices of monotonically increasing heights
    max_area = 0
    # Append dummy 0 to flush remaining bars at the end
    extended_heights = heights + [0]
    
    for i, h in enumerate(extended_heights):
        while stack and extended_heights[stack[-1]] > h:
            height = extended_heights[stack.pop()]
            # If stack is empty, width spans all bars up to i
            width = i if not stack else i - stack[-1] - 1
            max_area = max(max_area, height * width)
            
        stack.append(i)
        
    return max_area

print(largest_rectangle_area([2, 1, 5, 6, 2, 3]))  # 10 (bars 5 and 6 with height 5)
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 7: Maximal Rectangle in 2D Binary Matrix
**Difficulty: Hard | Pattern: Dynamic Histogram Heights Reduction**

#### Problem Statement
Given a `rows x cols` binary matrix filled with `'0'`s and `'1'`s, find the largest rectangle containing only `'1'`s and return its area.

#### Python Solution
```python
def maximal_rectangle(matrix: List[List[str]]) -> int:
    if not matrix or not matrix[0]:
        return 0
        
    cols = len(matrix[0])
    heights = [0] * (cols + 1)
    max_area = 0
    
    for row in matrix:
        # Update running histogram heights for each column
        for c in range(cols):
            heights[c] = heights[c] + 1 if row[c] == '1' else 0
            
        # Run Largest Rectangle in Histogram on this row
        stack = []
        for i, h in enumerate(heights):
            while stack and heights[stack[-1]] > h:
                height = heights[stack.pop()]
                width = i if not stack else i - stack[-1] - 1
                max_area = max(max_area, height * width)
            stack.append(i)
            
    return max_area
```

#### Complexity
- **Time:** $O(R \cdot C)$ where $R$ is rows and $C$ is cols.
- **Space:** $O(C)$ for row histogram heights.

---

### Problem 8: Sliding Window Maximum
**Difficulty: Hard | Pattern: Monotonic Decreasing Deque**

#### Problem Statement
You are given an array of integers `nums`, there is a sliding window of size $k$ which is moving from the very left of the array to the very right. Return the max sliding window values in $O(n)$ time.

#### Python Solution
```python
from collections import deque

def max_sliding_window(nums: List[int], k: int) -> List[int]:
    d = deque()  # stores indices; values at indices are strictly decreasing
    res = []
    
    for i, n in enumerate(nums):
        # 1. Remove indices outside the current window
        while d and d[0] < i - k + 1:
            d.popleft()
            
        # 2. Maintain decreasing order: remove smaller elements from back
        while d and nums[d[-1]] < n:
            d.pop()
            
        d.append(i)
        
        # 3. Add to result once the first window of size k is formed
        if i >= k - 1:
            res.append(nums[d[0]])
            
    return res

print(max_sliding_window([1, 3, -1, -3, 5, 3, 6, 7], 3))
# [3, 3, 5, 5, 6, 7]
```

#### Complexity
- **Time:** $O(n)$ — Each element is added and removed from deque at most once.
- **Space:** $O(k)$ extra space for deque.

---

### Problem 9: Implement Queue using Stacks
**Difficulty: Easy | Pattern: Two Stacks with Amortized Transfer**

#### Problem Statement
Implement a FIFO queue using only two LIFO stacks. `push`, `pop`, `peek`, and `empty` must run in $O(1)$ amortized time.

#### Python Solution
```python
class MyQueue:
    def __init__(self):
        self.in_stack = []
        self.out_stack = []

    def push(self, x: int) -> None:
        self.in_stack.append(x)

    def _transfer(self) -> None:
        if not self.out_stack:
            while self.in_stack:
                self.out_stack.append(self.in_stack.pop())

    def pop(self) -> int:
        self._transfer()
        return self.out_stack.pop()

    def peek(self) -> int:
        self._transfer()
        return self.out_stack[-1]

    def empty(self) -> bool:
        return not self.in_stack and not self.out_stack
```

#### Amortized Analysis
- While a single `pop()` might transfer $n$ elements taking $O(n)$ worst-case, each element is pushed to `in_stack` once, popped from `in_stack` once, pushed to `out_stack` once, and popped from `out_stack` once.
- Total cost across $n$ operations $= 4n = O(1)$ **amortized per operation**.

---

### Problem 10: Simplify Unix File Path
**Difficulty: Medium | Pattern: Directory Token Stack**

#### Problem Statement
Given an absolute Unix file path string, simplify it to the canonical path (resolving `.` current directory, `..` parent directory, and multiple consecutive slashes `//`).

#### Python Solution
```python
def simplify_path(path: str) -> str:
    tokens = path.split('/')
    stack = []
    
    for token in tokens:
        if token == '' or token == '.':
            continue
        elif token == '..':
            if stack:
                stack.pop()
        else:
            stack.append(token)
            
    return '/' + '/'.join(stack)

print(simplify_path("/home/"))                # "/home"
print(simplify_path("/../"))                 # "/"
print(simplify_path("/home//foo/"))          # "/home/foo"
print(simplify_path("/a/./b/../../c/"))      # "/c"
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 11: Decode String (e.g. `"3[a2[c]]" \to "accaccacc"`)
**Difficulty: Medium | Pattern: Nested Multipliers & Buffer Stacking**

#### Problem Statement
Given an encoded string, return its decoded string. The encoding rule is: `k[encoded_string]`, where the `encoded_string` inside the square brackets is being repeated exactly `k` times.

#### Python Solution
```python
def decode_string(s: str) -> str:
    stack = []  # stores pairs of (previous_string_buffer, repeat_multiplier)
    curr_str = ""
    curr_num = 0
    
    for char in s:
        if char.isdigit():
            curr_num = curr_num * 10 + int(char)
        elif char == '[':
            # Save context and reset buffers
            stack.append((curr_str, curr_num))
            curr_str = ""
            curr_num = 0
        elif char == ']':
            prev_str, multiplier = stack.pop()
            curr_str = prev_str + curr_str * multiplier
        else:
            curr_str += char
            
    return curr_str

print(decode_string("3[a]2[bc]"))   # "aaabcbc"
print(decode_string("3[a2[c]]"))    # "accaccacc"
```

#### Complexity
- **Time:** $O(\text{length of decoded string})$
- **Space:** $O(\text{depth of nesting} + \text{decoded string size})$

---

### Problem 12: Asteroid Collision
**Difficulty: Medium | Pattern: Directional Collision Resolution via Stack**

#### Problem Statement
We are given an array `asteroids` of integers representing asteroids in a row. Absolute value represents size, and sign represents direction (positive = right, negative = left). Asteroids moving towards each other collide. Equal sizes both explode; smaller explodes. Find the state after all collisions.

#### Python Solution
```python
def asteroid_collision(asteroids: List[int]) -> List[int]:
    stack = []
    
    for ast in asteroids:
        alive = True
        # Collisions only happen when stack has asteroid moving right (>0) and incoming moves left (<0)
        while alive and ast < 0 and stack and stack[-1] > 0:
            if stack[-1] < -ast:
                stack.pop()       # Stack asteroid explodes, loop again
                continue
            elif stack[-1] == -ast:
                stack.pop()       # Both explode
            alive = False         # Incoming asteroid explodes
            
        if alive:
            stack.append(ast)
            
    return stack

print(asteroid_collision([5, 10, -5]))   # [5, 10]
print(asteroid_collision([8, -8]))       # []
print(asteroid_collision([10, 2, -5]))   # [10]
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 13: Basic Calculator II (Arithmetic without Parentheses)
**Difficulty: Medium | Pattern: Precedence Tracking via Term Stack**

#### Problem Statement
Given a string `s` representing an expression containing non-negative integers and operators `+`, `-`, `*`, `/`, evaluate the expression respecting standard operator precedence.

#### Python Solution
```python
def calculate(s: str) -> int:
    stack = []
    curr_num = 0
    operation = '+'
    s = s.strip()
    
    for i, char in enumerate(s):
        if char.isdigit():
            curr_num = curr_num * 10 + int(char)
            
        if char in "+-*/" or i == len(s) - 1:
            if operation == '+':
                stack.append(curr_num)
            elif operation == '-':
                stack.append(-curr_num)
            elif operation == '*':
                stack.append(stack.pop() * curr_num)
            elif operation == '/':
                stack.append(int(stack.pop() / curr_num))
                
            operation = char
            curr_num = 0
            
    return sum(stack)

print(calculate("3+2*2"))     # 7
print(calculate(" 3/2 "))     # 1
print(calculate(" 3+5 / 2 ")) # 5
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 14: Online Stock Span
**Difficulty: Medium | Pattern: Monotonic Stack with Span Compression**

#### Problem Statement
Design an algorithm that collects daily price quotes for some stock and returns the span of that stock's price for the current day. The span is the maximum number of consecutive days (starting from today and going backward) for which the stock price was less than or equal to today's price.

#### Python Solution
```python
class StockSpanner:
    def __init__(self):
        # Monotonic stack of (price, accumulated_span)
        self.stack = []

    def next(self, price: int) -> int:
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
            
        self.stack.append((price, span))
        return span

spanner = StockSpanner()
print([spanner.next(p) for p in [100, 80, 60, 70, 60, 75, 85]])
# [1, 1, 1, 2, 1, 4, 6]
```

#### Complexity
- **Time:** $O(1)$ amortized per `next` call (each price pushed and popped at most once).
- **Space:** $O(n)$

---

### Problem 15: Implement Stack using Single Queue
**Difficulty: Easy-Medium | Pattern: Circular Rotation on Push**

#### Problem Statement
Implement a LIFO stack using only a single FIFO queue.

#### Python Solution
```python
from collections import deque

class MyStack:
    def __init__(self):
        self.q = deque()

    def push(self, x: int) -> None:
        self.q.append(x)
        # Rotate all previous elements behind the newly inserted element
        for _ in range(len(self.q) - 1):
            self.q.append(self.q.popleft())

    def pop(self) -> int:
        return self.q.popleft()

    def top(self) -> int:
        return self.q[0]

    def empty(self) -> bool:
        return len(self.q) == 0
```

#### Complexity
- **Time:** $O(n)$ for `push`, $O(1)$ for `pop`, `top`, `empty`.
- **Space:** $O(n)$
