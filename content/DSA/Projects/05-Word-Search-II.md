# Word Search II

## Problem Statement

Given an `m x n` board of characters and a list of strings `words`, return all words present on the board. Each word must be constructed from letters of sequentially adjacent cells (horizontally or vertically neighboring), and the same board cell may not be used more than once in constructing a single word.

Example board:

```
o a a n
e t a e
i h k r
i f l v
```

With `words = ["oath", "pea", "eat", "rain"]`, the words found are `["eat", "oath"]`.

## Approach Discussion

The brute-force approach — for each word, backtrack (DFS) over the board looking for it — works but is wasteful: with `W` words and a board of `R x C` cells, that's `W` independent searches, each potentially exploring the same board paths repeatedly for different words that happen to share a prefix (e.g., searching for both `"eat"` and `"eats"` re-walks the identical `"eat"` path twice).

The fix is to flip the search around: instead of doing one search per word, do **one search per starting cell**, and check *all words at once* by using a **Trie** (`DSA/Phase-12-Advanced-Data-Structures/01-Trie.md`) built from every word up front. A Trie is exactly suited to this because it merges shared prefixes across words into shared paths — searching board path `"e" -> "a" -> "t"` walks one trie path that simultaneously represents progress toward every word starting with `"eat"`, rather than restarting from scratch per word.

The board traversal itself is **backtracking** (`DSA/Phase-10-Greedy-and-Backtracking/02-Backtracking-Fundamentals-N-Queens.md`): from each starting cell, explore all 4 neighboring directions via DFS, mark the current cell as visited (in-place, by overwriting it with a sentinel like `'#'`) so it can't be reused within the same path, and un-mark it (restore the original letter) after backtracking out — the same "choose, explore, un-choose" shape used in N-Queens or subset generation.

The Trie is what makes the backtracking *prunable*: at each board cell during the DFS, check whether the current character even has a corresponding child in the current Trie node — if not, this path can't possibly extend to any word in the dictionary, and the DFS branch is abandoned immediately instead of continuing to explore dead-end paths. A further optimization prunes Trie nodes with no children left after a match is found, shrinking the search space as words are discovered. Neither pattern alone is enough: backtracking alone (one search per word) is correct but redundant across words; a Trie alone has no notion of "board adjacency" and can't search 2D space by itself.

## Solution

```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.word = None  # set to the full word at a terminal node


def build_trie(words):
    root = TrieNode()
    for word in words:
        node = root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.word = word
    return root


def find_words(board, words):
    root = build_trie(words)
    rows, cols = len(board), len(board[0])
    found = set()

    def backtrack(r, c, node):
        ch = board[r][c]
        if ch not in node.children:
            return
        next_node = node.children[ch]
        if next_node.word is not None:
            found.add(next_node.word)

        board[r][c] = "#"  # mark visited
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and board[nr][nc] != "#":
                backtrack(nr, nc, next_node)
        board[r][c] = ch  # unmark

        # Prune the trie branch once it can no longer yield new words
        if not next_node.children:
            del node.children[ch]

    for r in range(rows):
        for c in range(cols):
            backtrack(r, c, root)

    return list(found)


if __name__ == "__main__":
    board = [
        ["o", "a", "a", "n"],
        ["e", "t", "a", "e"],
        ["i", "h", "k", "r"],
        ["i", "f", "l", "v"],
    ]
    words = ["oath", "pea", "eat", "rain"]
    result = find_words(board, words)
    print(sorted(result))  # expect ['eat', 'oath']
```

**Actual output when run:**

```
['eat', 'oath']
```

This matches the classic LeetCode 212 example exactly: `"oath"` is found via the path `o(0,0) -> a(0,1) -> t(1,1) -> h(2,1)`, and `"eat"` via `e(1,3) -> a(1,2) -> t(1,1)`, reusing shared board cells across different search paths (never within a single word's own path). `"pea"` and `"rain"` are correctly absent since no valid adjacent-cell path spells them.

## Complexity

- **Time**: O(R × C × 4^L) worst case, where `R x C` is the board size and `L` is the maximum word length — from each of the `R × C` starting cells, backtracking can in principle explore up to 4 directions at each of `L` steps. In practice this bound is rarely approached: the Trie check at each cell prunes any path that isn't a prefix of some word, and the trie-node-deletion optimization shrinks the search space further as words are found, so real-world performance is far closer to the total shared-prefix length across the dictionary than to the raw exponential bound.
- **Space**: O(sum of word lengths) for the Trie (shared prefixes reduce this below storing every word independently), plus O(L) for the backtracking call stack.
