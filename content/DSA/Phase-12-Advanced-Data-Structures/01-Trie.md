# Trie (Prefix Tree)

## 1. Problem

Back in `DSA/Phase-05-Hashing/`, a hashset or hashmap gave you O(1) average-time exact-match lookups: "is this exact string in my set?" That's a different question from what autocomplete, spell-checkers, and IP-routing tables actually need to answer: "which stored strings start with this prefix?" A hashset can't answer that efficiently at all — the only way to find every word starting with `"ca"` using a hashset is to iterate over **every stored word** and check its prefix, which is O(total characters stored) no matter how the hashset is implemented, because hashing scrambles string order entirely and gives you no way to jump directly to "all strings starting with X."

A **Trie** (from re**trie**val, pronounced "try" or "tree") solves this by organizing strings character-by-character into a shared tree, where every path from the root spells out a prefix, and words sharing a prefix literally share the same path through the tree. This turns "find everything starting with `ca`" into "walk 2 characters down from the root, then everything in the subtree below is a match" — no scanning the whole dataset required. Insert and exact-word search are both O(L) where L is the length of the word being inserted or searched, completely independent of how many other words are already stored.

## 2. Analogy

Think of a library that organizes books not alphabetically on a single shelf, but as a decision tree at the entrance: a sign for "titles starting with C," inside that a sign for "CA," inside that a sign for "CAR," and so on — each sign point splits into more specific sign points as you walk deeper. To find every book whose title starts with "CAR," you don't scan the whole library; you just follow the signs "C" → "A" → "R" and everything past that point in the tree is a match. Multiple books that start the same way ("CAR", "CARD", "CARE") share the same signposted path for as long as their titles agree, and only diverge where their titles actually differ. A Trie is that signpost structure, built directly out of the characters of the strings you insert.

## 3. Internal Flow

A Trie is built from **nodes**, where each node holds:
- A `children` mapping (dict, or a fixed-size array for a known alphabet) from a single character to the child `TrieNode` reached by extending the current prefix with that character.
- An `is_end_of_word` boolean flag, marking whether the path from the root down to *this exact node* spells out a complete word that was inserted — not just a prefix of some longer word.

**Insert(word):**
1. Start at the root.
2. For each character in `word`, check if the current node already has a child for that character. If not, create a new `TrieNode` and attach it as that child.
3. Move into that child node and repeat for the next character.
4. After processing the last character, mark the final node's `is_end_of_word = True`.

**Search(word) — exact match:**
1. Start at the root, walk the trie one character at a time following existing children.
2. If at any point the required child doesn't exist, the word was never inserted — return `False` immediately.
3. If the walk completes (all characters found a matching child), the word exists **only if** the final node's `is_end_of_word` is `True`. Reaching the end of the character path is not enough by itself — that path might just be a prefix of some other longer word.

**StartsWith(prefix) — prefix match:**
1. Identical walk to `search`, but skip the `is_end_of_word` check entirely at the end.
2. If the walk completes without hitting a missing child, return `True` — some word in the trie has this prefix, regardless of whether the prefix itself is also a complete word.

Both operations are O(L): each character requires exactly one dictionary lookup / hop to a child, and the walk never revisits a node.

## 4. Example

Building a trie from `"cat"`, `"car"`, `"card"`, `"care"`, tracing exactly which nodes get created (words sharing a prefix reuse existing nodes instead of creating new ones), then running both `search` and `starts_with` against it:

```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end_of_word = False

class Trie:
    def __init__(self):
        self.root = TrieNode()
        self.nodes_created = 1  # root

    def insert(self, word):
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
                self.nodes_created += 1
                print(f"  created node for '{ch}'")
            node = node.children[ch]
        node.is_end_of_word = True

    def search(self, word):
        node = self.root
        for ch in word:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return node.is_end_of_word

    def starts_with(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return True


trie = Trie()
words = ["cat", "car", "card", "care"]
for w in words:
    print(f"insert({w!r}):")
    trie.insert(w)

print(f"\ntotal nodes in trie (including root): {trie.nodes_created}")

print()
tests = [
    ("search", "cat"),
    ("search", "ca"),
    ("search", "care"),
    ("search", "carbon"),
    ("starts_with", "ca"),
    ("starts_with", "car"),
    ("starts_with", "dog"),
]
for op, arg in tests:
    fn = trie.search if op == "search" else trie.starts_with
    print(f"{op}({arg!r}) = {fn(arg)}")
```

Actual output:

```text
insert('cat'):
  created node for 'c'
  created node for 'a'
  created node for 't'
insert('car'):
  created node for 'r'
insert('card'):
  created node for 'd'
insert('care'):
  created node for 'e'

total nodes in trie (including root): 7

search('cat') = True
search('ca') = False
search('care') = True
search('carbon') = False
starts_with('ca') = True
starts_with('car') = True
starts_with('dog') = False
```

Notice `insert("car")` only creates **one** new node (`r`) — the `c` and `a` nodes already exist from inserting `"cat"` and get reused. Similarly `insert("card")` and `insert("care")` each add just one node, branching off the shared `car` path. Four words of total length 14 characters produced only **7** trie nodes (including the root) — the shared-prefix structure is exactly why a Trie is compact for prefix-heavy datasets. Also notice `search("ca")` is `False` even though `"ca"` is a valid path in the tree (it's a prefix of `"cat"`, `"car"`, etc.) — the walk succeeds but the node at the end never had `is_end_of_word` set, which is precisely the distinction `starts_with` doesn't make.

## 5. Compare

- **Trie vs hashset**: a hashset gives O(1) average exact-match lookup but zero support for prefix queries without a full scan; a Trie gives O(L) for both exact match and prefix match, at the cost of extra memory for the node/pointer structure (a hashset just stores raw strings).
- **Trie vs sorted array + binary search**: a sorted list of words supports prefix queries via binary search to find the boundary of matching entries (O(log n + L) roughly), but insertion into a sorted array is O(n) to maintain order, whereas Trie insertion is O(L) regardless of how many words are already stored.
- **Trie vs Segment Tree / Fenwick Tree (later in this phase)**: those structures index by **position** in an array and answer range queries over numeric data; a Trie indexes by **character sequence** and answers prefix queries over strings — different domains, same underlying "walk down a tree instead of scanning" idea.

## 6. Common Mistakes

- **Forgetting the end-of-word marker entirely.** If `is_end_of_word` is never set (or `search` never checks it and just returns `True` whenever the character walk completes), inserting only `"catalog"` would make `search("cat")` incorrectly return `True`, because `"cat"` is a valid prefix-path of `"catalog"` even though `"cat"` itself was never inserted as a word.
- **Not distinguishing `search` from `starts_with`.** Reusing the exact same method for both operations (i.e., dropping the `is_end_of_word` check from `search`, or adding it to `starts_with`) collapses "is this a complete stored word" and "does any stored word start with this" into the same answer, which are genuinely different questions with different correct answers on the same input (as seen above with `"ca"`).
- **Using a fixed-size array of 26 children on a mixed-case or Unicode alphabet.** A `[None] * 26` children array only works cleanly for lowercase `a`-`z`; anything with uppercase letters, digits, or Unicode needs either a larger array with an offset scheme or a dict — using a dict is usually simplest and is what's shown above.
- **Not marking `is_end_of_word` after inserting a word that's a prefix of an already-inserted longer word.** If `"card"` is inserted first and then `"car"` is inserted, the `r` node already exists from `"card"`'s path — it's easy to forget that this existing node's `is_end_of_word` still needs to be set to `True` for `"car"`, even though no new nodes were created for it.
- **Assuming deletion is just "delete the last node."** Deleting a word correctly requires unmarking `is_end_of_word` and then only pruning nodes that have no other children and aren't the end of some other word — naively deleting the whole character path can destroy other stored words that shared that path's prefix.

## 7. Interview Angle

Trie questions are usually framed around autocomplete, spell-check, or "implement a data structure supporting `insert`, `search`, and `startsWith`" (this is literally LeetCode's "Implement Trie (Prefix Tree)" problem). Interviewers will often follow up by asking you to extend it: "find all words with a given prefix" (walk to the prefix's node, then DFS the subtree collecting every node with `is_end_of_word = True`, prefixing with the path taken), or "support wildcard search" (a `.` matching any character requires trying every child at that position instead of a direct lookup, turning O(L) into something branching). Be ready to state the complexity clearly: O(L) time per operation, O(total distinct characters across all inserted prefixes) space in the worst case — which is why the "compact prefix sharing" property is worth calling out explicitly as the reason Tries beat brute-force prefix scans.

## 8. Memory Hook

**"Same prefix, same path."** Every word inserted into a Trie walks down shared branches for as long as it agrees with previously inserted words, and only forks where it first differs — the entire structure *is* the shared-prefix relationships among your strings, made walkable one character at a time.
