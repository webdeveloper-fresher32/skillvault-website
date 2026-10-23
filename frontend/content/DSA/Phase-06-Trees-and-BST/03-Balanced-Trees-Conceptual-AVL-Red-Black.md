# Balanced Trees (Conceptual): AVL and Red-Black

## 1. Problem

The previous lesson ended on a warning: a plain BST's O(log n) operations are only as good as the tree's height, and nothing about "insert following the BST invariant" guarantees a short height. Insert values in already-sorted order — 1, 2, 3, 4, 5, 6, 7 — and every single one becomes the right child of the previous one, because each new value is larger than everything already in the tree. The result is a tree that's really a linked list wearing a tree's clothing: height n instead of log n, and every "O(log n)" operation quietly becomes O(n). This isn't a rare edge case either — sorted or nearly-sorted input is common in real data (timestamps, IDs, alphabetically-fed names).

**Self-balancing trees** solve this by adding extra bookkeeping on every insert and delete that actively restructures the tree whenever it starts to lean too far in one direction, guaranteeing the height stays O(log n) no matter what order values arrive in. AVL trees and Red-Black trees are the two classic strategies for doing this — different rules, different rebalancing triggers, same underlying goal.

## 2. Analogy

Think of a tightrope walker carrying a balance pole. Left un-managed, weight can accumulate more and more on one side until the walker tips over — that's the degenerate BST. An AVL tree is the walker who checks their balance *after every single step* (every insert/delete) and immediately makes a small corrective shift (a **rotation**) the instant they're off by more than one unit — strict, frequent, small corrections, so they're never more than barely tilted.

A Red-Black tree is more like a shipping company's loose weight-distribution rule: "no single path from the loading dock to any container may have more than roughly twice as many red-tagged (unbalanced) crates as another path." It doesn't demand perfect balance at every instant, just a looser guarantee — never more than a 2x height difference between the shortest and longest root-to-leaf path — which needs fewer corrective rotations overall, at the cost of the tree being somewhat less tightly balanced than an AVL tree.

## 3. Internal Flow

**AVL trees** track a **balance factor** at every node: `height(left subtree) − height(right subtree)`. The invariant is that this must always be `-1`, `0`, or `+1` at every node. After every insert or delete, you walk back up from the changed node toward the root, recomputing balance factors; the moment a node's balance factor falls outside `{-1, 0, +1}`, a **rotation** is applied to restore it.

There are four imbalance shapes, each fixed by a specific rotation:

- **Left-Left (LL)** — a node is left-heavy, and its left child is *also* left-heavy (or balanced). Fixed by a single **right rotation** around the unbalanced node (the left child becomes the new subtree root).
- **Right-Right (RR)** — the mirror image: right-heavy, right child right-heavy. Fixed by a single **left rotation**.
- **Left-Right (LR)** — left-heavy, but the left child is right-heavy. A single rotation can't fix this directly; you first left-rotate the left child (converting the shape into a plain LL case), then right-rotate the original node.
- **Right-Left (RL)** — the mirror: right-heavy, right child left-heavy. First right-rotate the right child (converting to RR), then left-rotate the original node.

A rotation re-parents a small number of nodes around a pivot — it never violates the BST invariant (left < node < right is preserved because rotation only reassigns pointers among nodes that were already correctly ordered relative to each other), it only changes *heights*, trading height on one side for height on the other.

**Red-Black trees** take a different approach: instead of tracking exact heights, every node is colored red or black, and the structure enforces coloring rules — the root is always black, no red node has a red child (no two reds in a row on any path), and every root-to-leaf path passes through the *same number* of black nodes. Together, these rules mathematically guarantee the longest root-to-leaf path is never more than twice the shortest — looser than AVL's strict `{-1,0,+1}` balance factor, but cheaper to maintain (fewer rotations per insert/delete on average), which is exactly why Red-Black trees are the ones actually used inside most standard library ordered-map implementations (C++'s `std::map`, Java's `TreeMap`).

## 4. Example

```python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def show(node, depth=0, prefix="root"):
    if node is None:
        return
    print("  " * depth + f"{prefix}: {node.val}")
    show(node.left, depth + 1, "L")
    show(node.right, depth + 1, "R")

def right_rotate(y):
    """
    Unbalanced (left-heavy) subtree:
            y (3)
           /
          x (2)
         /
        z (1)
    Right rotation around y fixes it:
            x (2)
           / \
          z(1) y(3)
    """
    x = y.left
    t2 = x.right          # x's right subtree must move under y
    x.right = y
    y.left = t2
    return x              # x is the new subtree root

# Build the unbalanced 3-node left-left case
z = Node(1)
x = Node(2, left=z)
y = Node(3, left=x)

print("Before rotation (unbalanced, left-left case):")
show(y)

new_root = right_rotate(y)

print("\nAfter single right rotation:")
show(new_root)
```

Executed output:

```
Before rotation (unbalanced, left-left case):
root: 3
  L: 2
    L: 1

After single right rotation:
root: 2
  L: 1
  R: 3
```

Before the rotation, the subtree is a straight left-leaning chain — 3 → 2 → 1, height 3 for 3 nodes, exactly the degenerate shape this lesson opened with. This is a textbook **Left-Left** case (node `3` is left-heavy, and its left child `2` is also left-heavy). A single right rotation around `3` promotes `2` to the subtree root, demotes `3` to `2`'s right child, and — since `x.right` (which was `None` here) moves to become `y.left` — the result is a perfectly balanced 3-node tree of height 2, with `1` and `3` as `2`'s two children. The BST invariant still holds (`1 < 2 < 3` reading left to right), but the height dropped from 3 to 2.

## 5. Compare

AVL trees guarantee tighter balance (height factor within 1) and therefore slightly faster lookups on average, but pay for it with more frequent rotations on insert/delete — every insert can trigger a cascade of rebalancing checks back up to the root. Red-Black trees accept a looser balance guarantee (height within roughly 2x) in exchange for fewer rotations per modification, which is why they tend to win for write-heavy workloads, while AVL trees can win for read-heavy workloads where lookups vastly outnumber insertions. Both strictly dominate a plain unbalanced BST, which offers no height guarantee at all and can degrade all the way to O(n). Neither is "better" in an absolute sense — it's a classic read/write tradeoff, and it's exactly why both exist as distinct, still-used strategies rather than one having fully replaced the other.

## 6. Common Mistakes

- **Assuming you need to implement full AVL or Red-Black rebalancing logic for an interview.** In almost every interview context, the expected depth is explaining the *concept* — why balance matters, what a balance factor or coloring invariant is, what a rotation conceptually does — not coding four rotation cases with a recursive height-tracking rebalance from memory. Standard libraries (`TreeMap`, `std::map`, Python's own sorted structures where applicable) already implement this; know how to use one and explain the tradeoff, not reimplement it live.
- **Confusing which rotation fixes which imbalance direction** — mixing up "left-heavy needs a right rotation" with "right-heavy needs a left rotation" (the rotation direction is the *opposite* of the heavy side, since rotating pulls weight from the heavy side over to the other).
- **Forgetting the LR/RL double-rotation cases** and assuming every imbalance can be fixed with a single rotation — a left-heavy node whose left child is itself right-heavy needs two rotations, not one.
- **Treating "balanced" as meaning "perfectly equal height on both sides always"** rather than the actual invariant (balance factor bounded by 1 for AVL, black-height equality plus no-double-red for Red-Black) — real balanced trees still have some asymmetry, they just bound how much.
- **Not connecting this lesson back to the previous one** — forgetting that the entire motivation for balancing is that plain BST insert/delete (Lesson 2) offers zero height guarantee, so a degenerate input order silently destroys the O(log n) promise.

## 7. Interview Angle

The realistic bar for most interviews is conceptual fluency, not implementation: "why can a BST degrade to O(n), and how do self-balancing trees prevent it?", "what's a rotation, at a high level?", "why do most language standard libraries use Red-Black trees rather than AVL?" Being able to answer "AVL is more strictly balanced but rebalances more often; Red-Black is looser but cheaper to maintain, which is why it's the more common library choice" demonstrates real understanding without needing to whiteboard the full rebalancing algorithm. If you're asked to actually code a rotation (as in the example above), that's usually testing whether you understand pointer reassignment and the BST invariant, not whether you've memorized a textbook implementation of full AVL insert.

## 8. Memory Hook

**Balance factor = tightrope walker checking after every step (AVL); coloring rule = shipping company's looser "no path more than 2x another" policy (Red-Black).** Rotation direction is always the *opposite* of the heavy side — left-heavy gets a right rotation, right-heavy gets a left rotation, and an "LR" or "RL" zigzag needs two rotations to straighten out before the final one applies. For interviews: explain it, don't reimplement it from scratch.
