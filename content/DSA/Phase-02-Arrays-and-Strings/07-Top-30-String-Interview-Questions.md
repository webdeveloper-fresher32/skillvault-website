# Top 30 String Interview Questions

Master these 30 essential String interview problems covering Anagrams, Palindromic Expansions, Variable & Fixed Sliding Windows, String Parsing, Knuth-Morris-Pratt (KMP) Substring Matching, Prefix/Suffix Encoding, and Text Justification.

---

### Problem 1: Valid Anagram
**Difficulty: Easy | Pattern: Fixed Alphabet Frequency Counting**

#### Problem Statement
Given two strings `s` and `t`, return `True` if `t` is an anagram of `s`, and `False` otherwise.

#### Python Solution
```python
def is_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
        
    counts = [0] * 26
    for c1, c2 in zip(s, t):
        counts[ord(c1) - ord('a')] += 1
        counts[ord(c2) - ord('a')] -= 1
        
    return all(x == 0 for x in counts)

print(is_anagram("anagram", "nagaram"))  # True
print(is_anagram("rat", "car"))          # False
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$ — 26 integers.

---

### Problem 2: Group Anagrams
**Difficulty: Medium | Pattern: Character Count Tuple as Hash Key**

#### Problem Statement
Given an array of strings `strs`, group the anagrams together in $O(N \cdot K)$ time.

#### Python Solution
```python
from collections import defaultdict
from typing import List

def group_anagrams(strs: List[str]) -> List[List[str]]:
    groups = defaultdict(list)
    for s in strs:
        count = [0] * 26
        for c in s:
            count[ord(c) - ord('a')] += 1
        groups[tuple(count)].append(s)
    return list(groups.values())

print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
# [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]
```
- **Complexity:** Time: $O(N \cdot K)$, Space: $O(N \cdot K)$

---

### Problem 3: Valid Palindrome
**Difficulty: Easy | Pattern: Two Pointers with In-Place Character Skipping**

#### Problem Statement
Return `True` if string is a palindrome considering only alphanumeric characters and ignoring cases, in $O(1)$ space.

#### Python Solution
```python
def is_palindrome(s: str) -> bool:
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True

print(is_palindrome("A man, a plan, a canal: Panama"))  # True
print(is_palindrome("race a car"))                      # False
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 4: Valid Palindrome II (At Most One Deletion)
**Difficulty: Easy-Medium | Pattern: Greedy Mismatch Recovery**

#### Problem Statement
Given a string `s`, return `True` if `s` can be a palindrome after deleting at most one character from it.

#### Python Solution
```python
def valid_palindrome_ii(s: str) -> bool:
    def check_range(l: int, r: int) -> bool:
        while l < r:
            if s[l] != s[r]:
                return False
            l += 1
            r -= 1
        return True

    left, right = 0, len(s) - 1
    while left < right:
        if s[left] != s[right]:
            # Either skip left character or skip right character
            return check_range(left + 1, right) or check_range(left, right - 1)
        left += 1
        right -= 1
    return True

print(valid_palindrome_ii("aba"))   # True
print(valid_palindrome_ii("abca"))  # True (delete 'c')
print(valid_palindrome_ii("abc"))   # False
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 5: Longest Substring Without Repeating Characters
**Difficulty: Medium | Pattern: Variable-Length Sliding Window + Last-Seen Map**

#### Problem Statement
Find the length of the longest substring without repeating characters in $O(n)$ time.

#### Python Solution
```python
def length_of_longest_substring(s: str) -> int:
    char_map = {}
    left = 0
    max_len = 0
    for right, c in enumerate(s):
        if c in char_map and char_map[c] >= left:
            left = char_map[c] + 1
        char_map[c] = right
        max_len = max(max_len, right - left + 1)
    return max_len

print(length_of_longest_substring("abcabcbb"))  # 3 ("abc")
print(length_of_longest_substring("bbbbb"))     # 1 ("b")
```
- **Complexity:** Time: $O(n)$, Space: $O(\min(n, 26))$

---

### Problem 6: Longest Repeating Character Replacement
**Difficulty: Medium | Pattern: Window Invariant (`window_len - max_freq <= k`)**

#### Problem Statement
You are given a string `s` and an integer `k`. You can choose any character and replace it with any other uppercase English character at most `k` times. Return the length of the longest substring containing the same letter.

#### Python Solution
```python
def character_replacement(s: str, k: int) -> int:
    counts = {}
    left = 0
    max_freq = 0
    max_len = 0
    
    for right in range(len(s)):
        counts[s[right]] = counts.get(s[right], 0) + 1
        max_freq = max(max_freq, counts[s[right]])
        
        # If number of characters to replace exceeds k, contract from left
        while (right - left + 1) - max_freq > k:
            counts[s[left]] -= 1
            left += 1
            
        max_len = max(max_len, right - left + 1)
    return max_len

print(character_replacement("ABAB", 2))    # 4
print(character_replacement("AABABBA", 1)) # 4
```
- **Complexity:** Time: $O(n)$, Space: $O(26) = O(1)$

---

### Problem 7: Minimum Window Substring
**Difficulty: Hard | Pattern: Constrained Sliding Window with Frequency Counts**

#### Problem Statement
Given two strings `s` and `t`, return the minimum window substring of `s` such that every character in `t` is included in the window.

#### Python Solution
```python
from collections import Counter

def min_window(s: str, t: str) -> str:
    if not s or not t:
        return ""
    t_count = Counter(t)
    required = len(t_count)
    formed = 0
    window_counts = {}
    ans = (float("inf"), None, None)
    left = 0
    
    for right, char in enumerate(s):
        window_counts[char] = window_counts.get(char, 0) + 1
        if char in t_count and window_counts[char] == t_count[char]:
            formed += 1
            
        while left <= right and formed == required:
            if right - left + 1 < ans[0]:
                ans = (right - left + 1, left, right)
            left_char = s[left]
            window_counts[left_char] -= 1
            if left_char in t_count and window_counts[left_char] < t_count[left_char]:
                formed -= 1
            left += 1
            
    return "" if ans[0] == float("inf") else s[ans[1]:ans[2] + 1]

print(min_window("ADOBECODEBANC", "ABC"))  # "BANC"
```
- **Complexity:** Time: $O(|s| + |t|)$, Space: $O(|s| + |t|)$

---

### Problem 8: Permutation in String
**Difficulty: Medium | Pattern: Fixed-Size Sliding Window Frequency Matching**

#### Problem Statement
Given two strings `s1` and `s2`, return `True` if `s2` contains a permutation of `s1`.

#### Python Solution
```python
def check_inclusion(s1: str, s2: str) -> bool:
    if len(s1) > len(s2):
        return False
        
    c1, c2 = [0] * 26, [0] * 26
    for i in range(len(s1)):
        c1[ord(s1[i]) - ord('a')] += 1
        c2[ord(s2[i]) - ord('a')] += 1
        
    matches = sum(1 for i in range(26) if c1[i] == c2[i])
    
    for i in range(len(s1), len(s2)):
        if matches == 26:
            return True
            
        # Add incoming char
        in_idx = ord(s2[i]) - ord('a')
        c2[in_idx] += 1
        if c2[in_idx] == c1[in_idx]:
            matches += 1
        elif c2[in_idx] == c1[in_idx] + 1:
            matches -= 1
            
        # Remove outgoing char
        out_idx = ord(s2[i - len(s1)]) - ord('a')
        c2[out_idx] -= 1
        if c2[out_idx] == c1[out_idx]:
            matches += 1
        elif c2[out_idx] == c1[out_idx] - 1:
            matches -= 1
            
    return matches == 26

print(check_inclusion("ab", "eidbaooo"))  # True
print(check_inclusion("ab", "eidboaoo"))  # False
```
- **Complexity:** Time: $O(|s2|)$, Space: $O(1)$

---

### Problem 9: Find All Anagrams in a String
**Difficulty: Medium | Pattern: Sliding Window Index Collector**

#### Problem Statement
Given strings `s` and `p`, return all start indices of `p`'s anagrams in `s`.

#### Python Solution
```python
def find_anagrams(s: str, p: str) -> List[int]:
    if len(p) > len(s):
        return []
    p_cnt = [0] * 26
    s_cnt = [0] * 26
    for c in p:
        p_cnt[ord(c) - ord('a')] += 1
    k = len(p)
    res = []
    
    for i, c in enumerate(s):
        s_cnt[ord(c) - ord('a')] += 1
        if i >= k:
            s_cnt[ord(s[i - k]) - ord('a')] -= 1
        if s_cnt == p_cnt:
            res.append(i - k + 1)
    return res

print(find_anagrams("cbaebabacd", "abc"))  # [0, 6]
```
- **Complexity:** Time: $O(|s|)$, Space: $O(1)$

---

### Problem 10: Longest Palindromic Substring
**Difficulty: Medium | Pattern: Expand Around Center**

#### Problem Statement
Return the longest palindromic substring in `s` in $O(1)$ auxiliary space.

#### Python Solution
```python
def longest_palindrome(s: str) -> str:
    if not s:
        return ""
    start, max_len = 0, 1
    
    def expand(l: int, r: int) -> int:
        while l >= 0 and r < len(s) and s[l] == s[r]:
            l -= 1
            r += 1
        return r - l - 1

    for i in range(len(s)):
        len1 = expand(i, i)       # Odd length ("aba")
        len2 = expand(i, i + 1)   # Even length ("abba")
        cur = max(len1, len2)
        if cur > max_len:
            max_len = cur
            start = i - (cur - 1) // 2
            
    return s[start:start + max_len]

print(longest_palindrome("babad"))  # "bab" or "aba"
```
- **Complexity:** Time: $O(n^2)$, Space: $O(1)$

---

### Problem 11: Palindromic Substrings (Count Total)
**Difficulty: Medium | Pattern: Dual-Center Expansion**

#### Problem Statement
Given a string `s`, return the number of palindromic substrings in it.

#### Python Solution
```python
def count_substrings(s: str) -> int:
    total = 0
    
    def count_from_center(l: int, r: int) -> int:
        c = 0
        while l >= 0 and r < len(s) and s[l] == s[r]:
            c += 1
            l -= 1
            r += 1
        return c

    for i in range(len(s)):
        total += count_from_center(i, i)     # Odd centers
        total += count_from_center(i, i + 1) # Even centers
    return total

print(count_substrings("abc"))  # 3 ("a", "b", "c")
print(count_substrings("aaa"))  # 6 ("a", "a", "a", "aa", "aa", "aaa")
```
- **Complexity:** Time: $O(n^2)$, Space: $O(1)$

---

### Problem 12: Encode and Decode Strings
**Difficulty: Medium | Pattern: Length-Prefix Delimiter Framing**

#### Problem Statement
Design an algorithm to encode a list of strings to a single string and decode it back, handling any delimiter characters inside the strings.

#### Python Solution
```python
class Codec:
    def encode(self, strs: List[str]) -> str:
        """Encodes list to string using length#word format."""
        res = []
        for s in strs:
            res.append(f"{len(s)}#{s}")
        return "".join(res)

    def decode(self, s: str) -> List[str]:
        """Decodes formatted string back to list."""
        res = []
        i = 0
        while i < len(s):
            hash_idx = s.find('#', i)
            length = int(s[i:hash_idx])
            start = hash_idx + 1
            res.append(s[start:start + length])
            i = start + length
        return res

codec = Codec()
encoded = codec.encode(["lint", "code", "love", "you"])
print(encoded)  # "4#lint4#code4#love3#you"
print(codec.decode(encoded))
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$ auxiliary space.

---

### Problem 13: String Compression (Run-Length Encoding)
**Difficulty: Medium | Pattern: In-Place Two Pointers (Read/Write)**

#### Problem Statement
Given an array of characters `chars`, compress it in-place using run-length encoding. Return new length.

#### Python Solution
```python
def compress(chars: List[str]) -> int:
    write = 0
    read = 0
    n = len(chars)
    while read < n:
        char = chars[read]
        count = 0
        while read < n and chars[read] == char:
            read += 1
            count += 1
        chars[write] = char
        write += 1
        if count > 1:
            for digit in str(count):
                chars[write] = digit
                write += 1
    return write

chars = ["a","a","b","b","c","c","c"]
length = compress(chars)
print(chars[:length])  # ['a', '2', 'b', '2', 'c', '3']
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 14: Reverse Words in a String
**Difficulty: Medium | Pattern: Word Token Splitting & Spacing Normalization**

#### Problem Statement
Given an input string `s`, reverse the order of the words. Return a string of words joined by a single space without leading/trailing spaces.

#### Python Solution
```python
def reverse_words(s: str) -> str:
    words = []
    i = 0
    n = len(s)
    
    while i < n:
        while i < n and s[i] == ' ':
            i += 1
        if i >= n:
            break
        j = i
        while j < n and s[j] != ' ':
            j += 1
        words.append(s[i:j])
        i = j
        
    return " ".join(reversed(words))

print(reverse_words("the sky is blue"))  # "blue is sky the"
print(reverse_words("  hello world  "))  # "world hello"
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 15: Longest Common Prefix
**Difficulty: Easy | Pattern: Vertical Scanning Across String Matrix**

#### Problem Statement
Find the longest common prefix string amongst an array of strings.

#### Python Solution
```python
def longest_common_prefix(strs: List[str]) -> str:
    if not strs:
        return ""
    for i in range(len(strs[0])):
        char = strs[0][i]
        for s in strs[1:]:
            if i >= len(s) or s[i] != char:
                return strs[0][:i]
    return strs[0]

print(longest_common_prefix(["flower", "flow", "flight"]))  # "fl"
```
- **Complexity:** Time: $O(S)$ where $S$ is sum of all characters, Space: $O(1)$

---

### Problem 16: KMP Algorithm (Implement `strStr`)
**Difficulty: Hard | Pattern: Knuth-Morris-Pratt with Longest Prefix Suffix (LPS) Array**

#### Problem Statement
Return the index of the first occurrence of `needle` in `haystack`, in $O(n + m)$ guaranteed time.

#### Python Solution
```python
def str_str_kmp(haystack: str, needle: str) -> int:
    if not needle:
        return 0
    # Step 1: Build LPS (Longest Prefix Suffix) table
    lps = [0] * len(needle)
    prev_lps, i = 0, 1
    while i < len(needle):
        if needle[i] == needle[prev_lps]:
            lps[i] = prev_lps + 1
            prev_lps += 1
            i += 1
        elif prev_lps == 0:
            lps[i] = 0
            i += 1
        else:
            prev_lps = lps[prev_lps - 1]
            
    # Step 2: Search using LPS table
    h_idx = n_idx = 0
    while h_idx < len(haystack):
        if haystack[h_idx] == needle[n_idx]:
            h_idx += 1
            n_idx += 1
            if n_idx == len(needle):
                return h_idx - len(needle)
        else:
            if n_idx == 0:
                h_idx += 1
            else:
                n_idx = lps[n_idx - 1]
    return -1

print(str_str_kmp("sadbutsad", "sad"))  # 0
print(str_str_kmp("leetcode", "leeto")) # -1
```
- **Complexity:** Time: $O(N + M)$, Space: $O(M)$ for LPS table.

---

### Problem 17: Valid Parentheses
**Difficulty: Easy | Pattern: LIFO Stack Validation**

#### Problem Statement
Given string `s` of `'()[]{}'`, determine if string is valid.

#### Python Solution
```python
def is_valid_parentheses(s: str) -> bool:
    mapping = {')': '(', '}': '{', ']': '['}
    stack = []
    for c in s:
        if c in mapping:
            top = stack.pop() if stack else '#'
            if mapping[c] != top:
                return False
        else:
            stack.append(c)
    return len(stack) == 0

print(is_valid_parentheses("()[]{}"))  # True
print(is_valid_parentheses("([)]"))    # False
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 18: Longest Valid Parentheses
**Difficulty: Hard | Pattern: Two-Pass Counter in $O(1)$ Space**

#### Problem Statement
Given a string containing just `'('` and `')'`, return the length of the longest valid (well-formed) parentheses substring.

#### Python Solution
```python
def longest_valid_parentheses(s: str) -> int:
    left = right = max_len = 0
    # Left to right pass
    for c in s:
        if c == '(': left += 1
        else: right += 1
        if left == right:
            max_len = max(max_len, 2 * right)
        elif right > left:
            left = right = 0
            
    # Right to left pass
    left = right = 0
    for c in reversed(s):
        if c == '(': left += 1
        else: right += 1
        if left == right:
            max_len = max(max_len, 2 * left)
        elif left > right:
            left = right = 0
            
    return max_len

print(longest_valid_parentheses(")()())"))  # 4 ("()()")
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 19: Simplify Path
**Difficulty: Medium | Pattern: Stack Directory Normalization**

#### Problem Statement
Given an absolute Unix path string, simplify it to its canonical form.

#### Python Solution
```python
def simplify_path(path: str) -> str:
    stack = []
    for token in path.split('/'):
        if token in ('', '.'):
            continue
        elif token == '..':
            if stack:
                stack.pop()
        else:
            stack.append(token)
    return '/' + '/'.join(stack)

print(simplify_path("/home//foo/"))      # "/home/foo"
print(simplify_path("/a/./b/../../c/"))  # "/c"
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 20: Decode String
**Difficulty: Medium | Pattern: Nested Multiplier & Buffer Stacking**

#### Problem Statement
Given an encoded string `k[encoded_string]`, return its decoded string.

#### Python Solution
```python
def decode_string(s: str) -> str:
    stack = []
    curr_str = ""
    curr_num = 0
    for c in s:
        if c.isdigit():
            curr_num = curr_num * 10 + int(c)
        elif c == '[':
            stack.append((curr_str, curr_num))
            curr_str = ""
            curr_num = 0
        elif c == ']':
            prev_str, mult = stack.pop()
            curr_str = prev_str + curr_str * mult
        else:
            curr_str += c
    return curr_str

print(decode_string("3[a2[c]]"))  # "accaccacc"
```
- **Complexity:** Time: $O(\text{output length})$, Space: $O(\text{nesting depth})$

---

### Problem 21: Reorganize String
**Difficulty: Medium | Pattern: Max-Heap Frequency Interleaving**

#### Problem Statement
Rearrange string so that no two adjacent characters are identical. Return `""` if impossible.

#### Python Solution
```python
import heapq
from collections import Counter

def reorganize_string(s: str) -> str:
    counts = Counter(s)
    max_heap = [(-count, c) for c, count in counts.items()]
    heapq.heapify(max_heap)
    
    prev_cnt, prev_char = 0, ''
    res = []
    while max_heap:
        cnt, char = heapq.heappop(max_heap)
        res.append(char)
        if prev_cnt < 0:
            heapq.heappush(max_heap, (prev_cnt, prev_char))
        prev_cnt = cnt + 1
        prev_char = char
        
    out = "".join(res)
    return out if len(out) == len(s) else ""

print(reorganize_string("aab"))  # "aba"
```
- **Complexity:** Time: $O(n)$, Space: $O(26)$

---

### Problem 22: Multiply Strings
**Difficulty: Medium | Pattern: Column-Wise Digit Multiplication Simulation**

#### Problem Statement
Given two non-negative integers `num1` and `num2` as strings, return their product as string without built-in big-int conversion.

#### Python Solution
```python
def multiply_strings(num1: str, num2: str) -> str:
    if num1 == "0" or num2 == "0":
        return "0"
        
    m, n = len(num1), len(num2)
    res = [0] * (m + n)
    
    for i in range(m - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            mul = (ord(num1[i]) - ord('0')) * (ord(num2[j]) - ord('0'))
            p1, p2 = i + j, i + j + 1
            total = mul + res[p2]
            res[p2] = total % 10
            res[p1] += total // 10
            
    # Skip leading zeroes
    start = 0
    while start < len(res) and res[start] == 0:
        start += 1
    return "".join(map(str, res[start:]))

print(multiply_strings("123", "456"))  # "56088"
```
- **Complexity:** Time: $O(m \cdot n)$, Space: $O(m + n)$

---

### Problem 23: Add Binary
**Difficulty: Easy | Pattern: Two-Pointer Bit Carry Simulation**

#### Problem Statement
Given two binary strings `a` and `b`, return their sum as a binary string.

#### Python Solution
```python
def add_binary(a: str, b: str) -> str:
    res = []
    i, j = len(a) - 1, len(b) - 1
    carry = 0
    while i >= 0 or j >= 0 or carry:
        total = carry
        if i >= 0:
            total += int(a[i])
            i -= 1
        if j >= 0:
            total += int(b[j])
            j -= 1
        res.append(str(total % 2))
        carry = total // 2
    return "".join(reversed(res))

print(add_binary("11", "1"))  # "100"
```
- **Complexity:** Time: $O(\max(len(a), len(b)))$, Space: $O(1)$ auxiliary space.

---

### Problem 24: Add Strings (Decimal)
**Difficulty: Easy | Pattern: Digit Carry Addition**

#### Problem Statement
Given two non-negative integers `num1` and `num2` represented as string, return the sum of `num1` and `num2` as a string.

#### Python Solution
```python
def add_strings(num1: str, num2: str) -> str:
    res = []
    i, j = len(num1) - 1, len(num2) - 1
    carry = 0
    while i >= 0 or j >= 0 or carry:
        n1 = ord(num1[i]) - ord('0') if i >= 0 else 0
        n2 = ord(num2[j]) - ord('0') if j >= 0 else 0
        total = n1 + n2 + carry
        res.append(str(total % 10))
        carry = total // 10
        i -= 1
        j -= 1
    return "".join(reversed(res))

print(add_strings("456", "77"))  # "533"
```
- **Complexity:** Time: $O(\max(len(n1), len(n2)))$, Space: $O(1)$

---

### Problem 25: Isomorphic Strings
**Difficulty: Easy | Pattern: Dual Hash Map Bijection**

#### Problem Statement
Determine if two strings `s` and `t` are isomorphic (character-to-character one-to-one mapping).

#### Python Solution
```python
def is_isomorphic(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    map_s, map_t = {}, {}
    for c1, c2 in zip(s, t):
        if (c1 in map_s and map_s[c1] != c2) or (c2 in map_t and map_t[c2] != c1):
            return False
        map_s[c1] = c2
        map_t[c2] = c1
    return True

print(is_isomorphic("egg", "add"))  # True
print(is_isomorphic("foo", "bar"))  # False
```
- **Complexity:** Time: $O(n)$, Space: $O(26)$

---

### Problem 26: Word Pattern
**Difficulty: Easy | Pattern: Word Token to Character Bijection**

#### Problem Statement
Given a `pattern` and string `s`, find if `s` follows the same pattern.

#### Python Solution
```python
def word_pattern(pattern: str, s: str) -> bool:
    words = s.split(' ')
    if len(pattern) != len(words):
        return False
    p_to_w, w_to_p = {}, {}
    for p, w in zip(pattern, words):
        if (p in p_to_w and p_to_w[p] != w) or (w in w_to_p and w_to_p[w] != p):
            return False
        p_to_w[p] = w
        w_to_p[w] = p
    return True

print(word_pattern("abba", "dog cat cat dog"))  # True
print(word_pattern("abba", "dog cat cat fish")) # False
```
- **Complexity:** Time: $O(n)$, Space: $O(\text{unique words})$

---

### Problem 27: Ransom Note
**Difficulty: Easy | Pattern: Character Inventory Frequency Count**

#### Problem Statement
Return `True` if `ransomNote` can be constructed using letters from `magazine`.

#### Python Solution
```python
def can_construct(ransomNote: str, magazine: str) -> bool:
    counts = [0] * 26
    for c in magazine:
        counts[ord(c) - ord('a')] += 1
    for c in ransomNote:
        idx = ord(c) - ord('a')
        counts[idx] -= 1
        if counts[idx] < 0:
            return False
    return True

print(can_construct("aa", "aab"))  # True
```
- **Complexity:** Time: $O(N + M)$, Space: $O(1)$

---

### Problem 28: First Unique Character in a String
**Difficulty: Easy | Pattern: Two-Pass Frequency Array**

#### Problem Statement
Find first non-repeating character in string and return its index; `-1` if none.

#### Python Solution
```python
def first_uniq_char(s: str) -> int:
    counts = [0] * 26
    for c in s:
        counts[ord(c) - ord('a')] += 1
    for i, c in enumerate(s):
        if counts[ord(c) - ord('a')] == 1:
            return i
    return -1

print(first_uniq_char("loveleetcode"))  # 2 ('v')
```
- **Complexity:** Time: $O(n)$, Space: $O(1)$

---

### Problem 29: Zigzag Conversion
**Difficulty: Medium | Pattern: Row Direction Bouncing Simulation**

#### Problem Statement
Write the code that will take a string and make this conversion given a number of rows: $P A H N \dots$

#### Python Solution
```python
def convert_zigzag(s: str, numRows: int) -> str:
    if numRows == 1 or numRows >= len(s):
        return s
        
    rows = [''] * numRows
    curr_row = 0
    going_down = False
    
    for c in s:
        rows[curr_row] += c
        # Bounce direction at top and bottom rows
        if curr_row == 0 or curr_row == numRows - 1:
            going_down = not going_down
        curr_row += 1 if going_down else -1
        
    return "".join(rows)

print(convert_zigzag("PAYPALISHIRING", 3))  # "PAHNAPLSIIGYIR"
```
- **Complexity:** Time: $O(n)$, Space: $O(n)$

---

### Problem 30: Text Justification
**Difficulty: Hard | Pattern: Greedy Word Packing & Space Distribution**

#### Problem Statement
Given an array of strings `words` and a width `maxWidth`, format the text such that each line has exactly `maxWidth` characters and is fully (left and right) justified.

#### Python Solution
```python
def full_justify(words: List[str], max_width: int) -> List[str]:
    res = []
    line = []
    line_chars = 0
    
    for w in words:
        # Check if adding w exceeds maxWidth (each word needs at least 1 space)
        if line_chars + len(w) + len(line) > max_width:
            # Distribute spaces for current completed line
            spaces_to_add = max_width - line_chars
            if len(line) == 1:
                res.append(line[0] + ' ' * spaces_to_add)
            else:
                spaces_between, extra = divmod(spaces_to_add, len(line) - 1)
                for i in range(extra):
                    line[i] += ' '
                res.append((' ' * spaces_between).join(line))
            line = []
            line_chars = 0
            
        line.append(w)
        line_chars += len(w)
        
    # Last line: left-justified with spaces on the right
    last_line = " ".join(line)
    res.append(last_line + ' ' * (max_width - len(last_line)))
    return res

words = ["This", "is", "an", "example", "of", "text", "justification."]
for line in full_justify(words, 16):
    print(f"'{line}'")
```
- **Complexity:** Time: $O(N)$ where $N$ is total characters, Space: $O(\text{output size})$
