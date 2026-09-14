# Binary Search Tree Operations

## 1. Problem

You want a data structure that keeps a dynamic set of numbers — one that grows and shrinks as you insert and remove values — while still letting you search for any value, insert a new one, or delete an existing one, all faster than the O(n) a plain unsorted list forces on you. A sorted array gives you O(log n) search via binary search, but inserting or deleting into the *middle* of a sorted array means shifting every element after it — O(n) per insert or delete, even though the search itself is fast. What you actually want is a structure that has the *shape* of binary search baked into it, so that insert and delete can also skip half the remaining data at each step, without ever needing to shift a contiguous block of memory.

That's exactly what a **binary search tree (BST)** provides: a tree shape where, at every single node, everything smaller lives in the left subtree and everything larger lives in the right subtree. Search, insert, and delete all follow the same "compare and go left or right" logic, giving all three O(h) — where h is the tree's height, ideally O(log n) for a balanced tree.

## 2. Analogy

Picture a filing system for a warehouse of numbered lockers, structured as a decision tree: at the front desk there's a sign with a number — if the locker you want is smaller, go left down a corridor; if larger, go right. At the end of each corridor is another sign with another number, splitting the remaining lockers the same way, and so on until you reach the exact locker (or realize it doesn't exist, because you've hit a dead end with no more corridors to follow).

Searching just means walking that path of signs. Inserting a new locker means walking the same path until you fall off the tree, then bolting the new locker on at that dead end. Deleting is the interesting one: if the locker you're removing is at a genuine dead end, you just unbolt it. But what if the locker you're removing has corridors branching off *further* into the warehouse? You can't just rip it out — you'd disconnect everything downstream. You need to find a replacement locker from further down the tree that can slide into the vacated spot without breaking anyone else's left/right directions.

## 3. Internal Flow

The **BST invariant** is the single rule everything rests on: for every node, every value in its left subtree is smaller than the node's value, and every value in its right subtree is larger. This invariant must hold at *every* node, not just the root — it's what makes the "go left or right" logic valid no matter where in the tree you currently are.

**Search(val)**: start at the root. If `val` equals the current node's value, found it. If `val` is smaller, recurse (or loop) into the left child; if larger, into the right child. Hit a `None` before finding a match, and the value isn't in the tree.

**Insert(val)**: identical walk to search, but instead of stopping at `None` and reporting failure, you attach a new node with `val` at that `None` spot. This is why every newly inserted value always becomes a new leaf — insertion never rearranges existing structure, it only ever adds one node at the exact place the search for that value would have "failed."

**Delete(val)** is the tricky one, because unlike insert, removing a node can leave a gap in the middle of the tree that has to be patched without breaking the invariant. There are three cases, found by first *searching* for the node to delete:

1. **Leaf (no children)** — just remove it. Nothing depended on it.
2. **One child** — splice the node out and promote its single child directly into its place. The invariant still holds because that child (and everything under it) was already correctly positioned relative to the deleted node's parent.
3. **Two children** — you cannot simply promote *either* child alone without violating the invariant somewhere. Instead, find the node's **inorder successor** (the smallest value in the right subtree — reached by going right once, then left as far as possible) or equivalently the **inorder predecessor** (the largest value in the left subtree). Copy that successor's value into the node being "deleted," then recursively delete the successor from its original location (where it's guaranteed to have at most one child, reducing to case 1 or 2). The successor is the smallest value still larger than everything in the node's left subtree and smaller than everything remaining in its right subtree — exactly the value that can legally take the deleted node's place.

## 4. Example

```python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def insert(root, val):
    if root is None:
        return Node(val)
    if val < root.val:
        root.left = insert(root.left, val)
    elif val > root.val:
        root.right = insert(root.right, val)
    # equal values ignored (no duplicates)
    return root

def search(root, val):
    if root is None:
        return False
    if val == root.val:
        return True
    if val < root.val:
        return search(root.left, val)
    return search(root.right, val)

def find_min(node):
    while node.left is not None:
        node = node.left
    return node

def delete(root, val):
    if root is None:
        return None
    if val < root.val:
        root.left = delete(root.left, val)
    elif val > root.val:
        root.right = delete(root.right, val)
    else:
        # found the node to delete
        if root.left is None and root.right is None:
            return None                     # case 1: leaf
        if root.left is None:
            return root.right               # case 2: one child (right)
        if root.right is None:
            return root.left                # case 2: one child (left)
        # case 3: two children -> inorder successor (min of right subtree)
        successor = find_min(root.right)
        root.val = successor.val
        root.right = delete(root.right, successor.val)
    return root

def inorder(root, out):
    if root is None:
        return
    inorder(root.left, out)
    out.append(root.val)
    inorder(root.right, out)

# Build:
#            8
#          /   \
#         3     10
#        / \      \
#       1   6      14
#          / \      /
#         4   7    13
root = None
for v in [8, 3, 10, 1, 6, 14, 4, 7, 13]:
    root = insert(root, v)

out = []
inorder(root, out)
print("Inorder after inserts:", out)

print("search(6):", search(root, 6))
print("search(11):", search(root, 11))

# Delete 3 (has two children: 1 and 6) -> inorder successor is min of right
# subtree rooted at 6, which is 4 (not 6 itself, since 6 has a left child)
root = delete(root, 3)
out2 = []
inorder(root, out2)
print("Inorder after deleting 3:", out2)

node6 = root.left  # 3's slot is now occupied by 4
print("Node that used to be 3's spot now holds value:", node6.val)
print("Its children:", node6.left.val if node6.left else None, node6.right.val if node6.right else None)
```

Executed output:

```
Inorder after inserts: [1, 3, 4, 6, 7, 8, 10, 13, 14]
search(6): True
search(11): False
Inorder after deleting 3: [1, 4, 6, 7, 8, 10, 13, 14]
Node that used to be 3's spot now holds value: 4
Its children: 1 6
```

Tracing the delete-with-two-children case by hand: node `3` has left child `1` and right child `6` (which itself has children `4` and `7`). Since `3` has two children, we can't just promote one side. We find the inorder successor: go right once to `6`, then left as far as possible — `6` has a left child `4`, and `4` has no left child, so `4` is the successor (the smallest value in `3`'s right subtree). We copy `4`'s value into the node currently holding `3` — so that node now reads `4`, keeping its original `left=1` and `right=6` pointers — and then recursively delete the *original* `4` node from its old spot under `6` (where it was a leaf, reducing to case 1). The result, confirmed above: the node that used to be `3` now holds `4`, still with children `1` and `6`, and the inorder sequence remains perfectly sorted — the invariant survived the delete.

## 5. Compare

BST operations share the same O(h) shape across search, insert, and delete — all three are fundamentally "walk down one path, deciding left or right at each step." This is strictly better than a sorted array's O(n) insert/delete (no shifting required) at the cost of giving up cheap random access by index and needing extra pointer memory per node. Compared to a plain unsorted linked list, a BST turns an O(n) search into O(h), at the cost of the extra bookkeeping needed to maintain the ordering invariant on every insert and delete. But — and this is the catch covered fully in the next lesson — h is only guaranteed to be O(log n) if the tree stays *balanced*; a BST with no balancing guarantee makes no promise about h at all.

## 6. Common Mistakes

- **Breaking the BST invariant during delete** by not correctly replacing the deleted node with its true inorder successor/predecessor — e.g. promoting an arbitrary child instead of specifically the *minimum of the right subtree* (or maximum of the left), which can leave a value in the wrong position relative to its new neighbors.
- **Deleting the successor node incorrectly** — after copying the successor's value up, you must recursively delete the successor from its *original* location, not just discard it; forgetting this duplicates the value or corrupts the right subtree's pointers.
- **Assuming BST operations are always O(log n)** without acknowledging the O(n) worst case. Inserting values already in sorted order (e.g. 1, 2, 3, 4, 5...) produces a completely **skewed** (degenerate) tree — effectively a linked list — where every node has only one child, and h equals n instead of log n.
- **Forgetting the equal-value case in insert/search** — deciding up front whether duplicates are allowed, and if so, consistently routing them (e.g. always right on ties), otherwise search and insert can silently disagree about where a value "should" live.
- **Off-by-one confusion between `find_min` (successor) and `find_max` (predecessor)** — mixing up which subtree to search (right subtree for successor, left subtree for predecessor) leads to picking a replacement value that violates the invariant.

## 7. Interview Angle

BST questions are rarely "implement insert" alone — they test whether you understand *why* delete needs three cases and can articulate the invariant precisely enough to defend it under a two-children example on a whiteboard. A very common follow-up is "what's the worst-case time complexity, and when does it happen?" — the expected answer is O(n) on a degenerate/skewed tree, which segues directly into the next topic (self-balancing trees). Another frequent variant is "validate whether a given tree is a valid BST" (inorder traversal should be strictly increasing) and "find the k-th smallest element" (inorder traversal again, stopping early) — both testing whether you connect BST structure back to the inorder-gives-sorted-order property from the previous lesson.

## 8. Memory Hook

**BST = filing lockers with left/right directional signs at every fork.** Search and insert just follow the signs down to a `None`. Delete is the only hard one: a leaf you simply unbolt, one child you promote directly, but two children means borrowing the **smallest value from the right subtree** (or largest from the left) to fill the gap — because that's the one value guaranteed to slot in without breaking any sign along the way.
