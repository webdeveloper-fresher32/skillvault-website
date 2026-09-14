# Lowest Common Ancestor

## 1. Problem

Given two nodes in a tree, find the deepest node that is an ancestor of *both* of them — their **lowest common ancestor (LCA)**. "Ancestor" here includes the node itself: a node counts as its own ancestor, which matters for the edge case where one of the two target nodes sits directly above the other in the tree. This shows up constantly in practice — "what's the most specific shared folder of these two files," "what's the closest shared category of these two products," "how far apart are these two org-chart employees" (answer: distance to LCA from each, summed) — anywhere two things sit somewhere in a hierarchy and you need their closest shared branching point.

The interesting part is that "find the LCA" has two genuinely different best solutions depending on what kind of tree you're handed. If it's a **binary search tree**, the ordering invariant lets you find the LCA in O(h) by just walking down from the root, making a decision at every node without ever needing to look at both subtrees. If it's an **arbitrary binary tree** with no ordering guarantee, you lose that shortcut entirely and need a full O(n) recursive search that examines every node once. Using the general-tree algorithm on a BST still works, but it throws away information you were handed for free — and using the BST shortcut on a tree that isn't actually a BST gives you silently wrong answers.

## 2. Analogy

Think of a corporate org chart again, with the CEO at the root. If you're asked "who is the closest shared manager of Alice and Bob," and you know absolutely nothing else about how the chart is organized, your only option is to search the whole chart: check every manager, see whether Alice and Bob are found in two *different* branches beneath them — if so, that manager is a candidate, and the deepest such manager is the answer. That's the **general binary tree** approach: no shortcuts, look everywhere.

Now suppose instead the company is organized like a **filing system where every manager's employee ID also tells you which half of the org they own** — anyone with a lower ID is somewhere to the left, anyone with a higher ID is somewhere to the right, all the way down. Now you don't need to search the whole chart at all: starting at the CEO, just compare Alice's and Bob's IDs to the current manager's ID. If both IDs are smaller, both Alice and Bob must be further left — step left and repeat. If both are larger, step right. The instant they're not both on the same side (one is smaller, one is larger, or the current manager *is* one of them), you've found the closest shared manager, because that's exactly the fork where their paths diverge. That's the **BST shortcut** — the ordering tells you which way to walk without ever needing to check the other branch.

## 3. Internal Flow

**LCA in a BST** — walk down from the root, using the ordering invariant to decide direction at every step:

1. Start at the root.
2. If both `p` and `q` are smaller than the current node's value, the LCA must be in the left subtree (both targets live there) — move left and repeat.
3. If both `p` and `q` are larger than the current node's value, the LCA must be in the right subtree — move right and repeat.
4. Otherwise — `p` and `q` fall on different sides of the current node, *or* the current node's value equals `p` or `q` — the current node is the LCA. This covers the ancestor case directly: if the current node's value equals one of the targets, that node is by definition an ancestor of itself, so it's the answer without needing to look any further.

This never branches into both subtrees; it always commits to one direction (or stops), which is exactly why it costs O(h) instead of O(n) — every step eliminates the entire subtree the answer can't be in, the same pruning power that makes BST search fast in the first place.

**LCA in a general binary tree** — no ordering to exploit, so the algorithm has to actually search both subtrees and combine the results:

1. Base case: if the current node is `None`, or its value matches `p` or `q`, return the current node (`None` propagates "not found in this subtree"; matching a target propagates "found it here").
2. Recurse into the left subtree and the right subtree independently, collecting both results.
3. If *both* recursive calls returned a non-`None` result, that means `p` was found somewhere in one subtree and `q` was found somewhere in the other — so the current node is exactly where their two paths meet, making it the LCA.
4. If only one side returned non-`None`, that side's result (whatever it found — could be `p`, could be `q`, could already be the LCA bubbling up from deeper) is passed upward unchanged, since the answer must live entirely within that one subtree.

This must visit every node in the worst case (you don't know where `p` and `q` are relative to each other until you've searched), so it's O(n) time and O(h) space for the recursion stack.

## 4. Example

```python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# BST LCA: walk down using the ordering invariant
def lca_bst(root, p, q):
    node = root
    while node is not None:
        if p < node.val and q < node.val:
            node = node.left
        elif p > node.val and q > node.val:
            node = node.right
        else:
            return node
    return None

# General binary tree LCA: search both subtrees, combine results
def lca_general(node, p, q):
    if node is None or node.val == p or node.val == q:
        return node
    left = lca_general(node.left, p, q)
    right = lca_general(node.right, p, q)
    if left and right:
        return node
    return left if left else right

#            8
#          /   \
#         3     10
#        / \      \
#       1   6      14
#          / \      /
#         4   7    13
root = Node(8,
            Node(3, Node(1), Node(6, Node(4), Node(7))),
            Node(10, None, Node(14, Node(13))))

print("BST LCA(4,7):", lca_bst(root, 4, 7).val)
print("BST LCA(4,6):", lca_bst(root, 4, 6).val)
print("BST LCA(1,7):", lca_bst(root, 1, 7).val)
print("BST LCA(6,14):", lca_bst(root, 6, 14).val)
print("BST LCA(13,4):", lca_bst(root, 13, 4).val)

print("General LCA(4,7):", lca_general(root, 4, 7).val)
print("General LCA(4,6):", lca_general(root, 4, 6).val)
print("General LCA(1,7):", lca_general(root, 1, 7).val)
print("General LCA(6,14):", lca_general(root, 6, 14).val)
print("General LCA(13,4):", lca_general(root, 13, 4).val)
```

Executed output:

```
BST LCA(4,7): 6
BST LCA(4,6): 6
BST LCA(1,7): 3
BST LCA(6,14): 8
BST LCA(13,4): 8
General LCA(4,7): 6
General LCA(4,6): 6
General LCA(1,7): 3
General LCA(6,14): 8
General LCA(13,4): 8
```

Tracing `lca_bst(root, 13, 4)` by hand: at the root (`8`), `13 > 8` but `4 < 8` — they're on different sides, so `8` is immediately returned as the LCA, in a single step. Contrast with `lca_bst(root, 4, 7)`: at `8`, both `4` and `7` are smaller, so move left to `3`; at `3`, `4` and `7` are both larger, so move right to `6`; at `6`, `4` is smaller and `7` is larger — different sides — so `6` is returned. This is also the ancestor edge case in disguise for `lca_bst(root, 4, 6)`: at `8` move left to `3`, at `3` move right to `6` (both `4` and `6` are larger than `3`), and at `6` the node's own value equals one of the targets (`6`), so the `else` branch fires and `6` is returned — `6` is an ancestor of `4`, and correctly ends up as its own LCA with `4`.

Tracing `lca_general(root, 4, 7)`: at `8`, recurse left into `3`'s subtree and right into `10`'s subtree. The right recursion into `10` finds neither `4` nor `7` anywhere and returns `None`. The left recursion into `3` recurses further: at `6`, recursing left finds `4` directly (base case match) and recursing right finds `7` directly — both sides non-`None`, so `6` is returned as the LCA from that call, which then bubbles up through `3` and `8` unchanged (since at each of those levels, one side is `None` and the other carries the already-found answer up).

## 5. Compare

Both algorithms solve the same problem and, given a valid BST, produce identical answers — the difference is entirely in what information each one exploits. The BST version uses the ordering invariant to *decide* which single subtree to descend into, giving O(h) time and O(1) extra space (it's a simple loop, not recursion). The general version has no ordering to lean on, so it must search *both* subtrees at every node just to find out where `p` and `q` actually are, giving O(n) time and O(h) space for the call stack. The general algorithm is strictly more broadly applicable — it works on a BST too, since a BST is just a binary tree with an extra invariant — but running it on a BST throws away a real, free speed-up. The BST algorithm, by contrast, will produce silently wrong answers if run on a tree that doesn't actually satisfy the BST invariant, since its entire correctness depends on that ordering guarantee.

## 6. Common Mistakes

- **Using the general O(n) algorithm on a known BST** instead of the O(h) walk-down version — it still gives a correct answer, but misses a straightforward speed-up that's usually exactly what an interviewer is testing for when they mention "this happens to be a BST."
- **Using the BST shortcut on a tree that isn't actually a BST** — the `p < node.val` / `p > node.val` comparisons only make sense if the ordering invariant genuinely holds; on an arbitrary binary tree this produces a confidently wrong answer with no error or crash to flag it.
- **Not handling the case where one target is an ancestor of the other.** In the BST version this is handled automatically by the `else` branch (equality falls through to "return current node"), but it's easy to write a first draft that only checks strict less-than/greater-than and forgets the equals case, causing an infinite descent past the actual answer. In the general version, forgetting the `node.val == p or node.val == q` base case means the recursion won't recognize that it has already found one of the targets, and can return the wrong (too-deep) node instead of stopping at the ancestor itself.
- **Assuming both `p` and `q` are guaranteed to exist in the tree.** Both algorithms above assume valid input; in an interview, it's worth explicitly asking or stating the assumption, since a missing target changes what "correct" even means (return `None`? raise an error?).
- **In the general algorithm, returning the wrong side when only one recursive call is non-`None`.** The final line — `left if left else right` — has to correctly propagate whichever single side actually found something; swapping the condition or returning `node` even when only one side matched breaks the "just pass the answer upward" logic that makes the algorithm work in O(n) rather than needing a second full pass.

## 7. Interview Angle

"Lowest Common Ancestor" is one of the most reliable tree interview questions precisely because it's really two questions in disguise, and the interviewer is watching for whether you notice which one applies. If they say "given a BST," the expected answer is the O(h) walk-down — coding the O(n) general version instead is a correct-but-suboptimal answer that signals you didn't register the BST hint. If they say "given a binary tree" with no ordering guarantee, the recursive "found in both subtrees ⇒ this is the LCA" pattern is the expected answer, and it's also a good proxy for whether you understand postorder-style recursion (each call must fully resolve its subtrees before the parent can decide anything). A very common follow-up is "what if one node is an ancestor of the other" — both algorithms above handle it correctly, but you should be able to explain *why* out loud rather than just having it happen to work.

## 8. Memory Hook

**BST LCA: follow the signs down, stop the instant they disagree (or one of them IS the sign).** O(h), one direction at a time, no need to check the road not taken. **General tree LCA: ask every node "is one target in my left kid and the other in my right kid?"** — if yes, you're standing at the fork; if only one side has an answer, hand it upward unchanged. BST first if you're told it's a BST — don't pay O(n) for an O(h) problem.
