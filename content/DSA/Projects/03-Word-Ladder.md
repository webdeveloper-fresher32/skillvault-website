# Word Ladder

## Problem Statement

Given a `beginWord`, an `endWord`, and a `wordList`, find the length of the **shortest transformation sequence** from `beginWord` to `endWord`, such that:

- Only one letter can be changed at a time.
- Each transformed word must exist in `wordList` (`beginWord` does not need to be in the list; `endWord` must be).

Return `0` if no such transformation sequence exists.

Example: `beginWord = "hit"`, `endWord = "cog"`, `wordList = ["hot","dot","dog","lot","log","cog"]` → the shortest sequence is `hit -> hot -> dot -> dog -> cog` (length 5, counting words) or `hit -> hot -> lot -> log -> cog` (also length 5) — either path is valid since both achieve the minimum.

## Approach Discussion

The problem is really a graph shortest-path problem in disguise: think of every word in `wordList` (plus `beginWord`) as a node, with an implicit edge between two words if they differ by exactly one letter. "Shortest transformation sequence" is then just "shortest path from `beginWord` to `endWord`" in an **unweighted** graph — and shortest path in an unweighted graph is exactly what **BFS** guarantees (`DSA/Phase-08-Graphs-Traversal/02-BFS-and-DFS.md`), because BFS explores nodes in order of increasing distance from the source, so the first time it reaches `endWord` is guaranteed to be via the shortest path.

The catch: the graph's edges are never given explicitly — there's no adjacency list to build in advance for a full dictionary. Instead, edges must be **generated on the fly** from each word: for a word of length `L`, try substituting each of the 26 letters at each of the `L` positions, and check whether the resulting candidate word exists in the word list. That existence check needs to be O(1), which is exactly what a **hash set** gives you (`DSA/Phase-05-Hashing/01-Hash-Maps-and-Sets.md`) — without it, checking "is this candidate a real word" against a list would be an O(n) scan for every one of the `26 × L` candidates generated at every BFS step, blowing up the total cost.

So the combination is: BFS provides the traversal order that guarantees shortest-path correctness, and a hash set of the word list provides the O(1) membership check needed to make each BFS step's edge generation (try every one-letter variant) cheap enough to be practical. A `visited` set (also hash-backed) prevents re-processing the same word and infinite loops.

## Solution

```python
from collections import deque
import string


def word_ladder_length(begin_word, end_word, word_list):
    word_set = set(word_list)
    if end_word not in word_set:
        return 0

    queue = deque([(begin_word, 1)])
    visited = {begin_word}

    while queue:
        word, steps = queue.popleft()
        if word == end_word:
            return steps

        for i in range(len(word)):
            for c in string.ascii_lowercase:
                candidate = word[:i] + c + word[i + 1:]
                if candidate in word_set and candidate not in visited:
                    visited.add(candidate)
                    queue.append((candidate, steps + 1))

    return 0


if __name__ == "__main__":
    word_list = ["hot", "dot", "dog", "lot", "log", "cog"]
    print(word_ladder_length("hit", "cog", word_list))  # expect 5

    word_list2 = ["hot", "dot", "dog", "lot", "log"]
    print(word_ladder_length("hit", "cog", word_list2))  # expect 0 (cog not reachable)
```

**Actual output when run:**

```
5
0
```

The first case finds the shortest 5-word transformation (`hit -> hot -> dot/lot -> dog/log -> cog`). The second case removes `cog` from the word list entirely, so the end word check at the top short-circuits and correctly returns `0` without doing any BFS work.

## Complexity

- **Time**: O(N × L²) where `N` is the number of words in `wordList` and `L` is the word length. Each word processed by BFS generates `26 × L` candidate strings; building each candidate string is O(L) (string slicing/concatenation), and each candidate requires an O(1) hash set lookup — so per word the cost is O(26 × L × L) = O(L²), and across up to `N` words in the BFS that's O(N × L²).
- **Space**: O(N × L) — the hash set stores up to `N` words of length `L`, and the BFS queue/visited set can hold up to `N` words at once.
