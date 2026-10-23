# Tree Traversals

## 1. Problem

A tree isn't a line — a list has one obvious order to visit its elements (front to back), but a binary tree has branches, and the moment you have branches you have to make a decision: do you visit a node before or after its children? Do you go all the way down one branch before touching the other, or do you sweep across the tree level by level? Different questions about a tree need different answers to that question. "Print this tree so it looks nested" wants one order. "Give me every value in sorted order, but only for a BST" wants another. "Copy this tree, or safely delete it, without touching a child before you're done with it" wants a third. "Find the shortest path in an unweighted tree, or process nodes closest to the root first" wants a fourth. Without a name for each of these orderings, you'd be reinventing the same recursive pattern from scratch every time — and picking the wrong one is a common, subtle source of bugs (e.g. deleting a node's children before you've read the value you needed from them).

**Tree traversal** is the general term for "visit every node in a tree exactly once, in some well-defined order." The four standard orders — preorder, inorder, postorder, and level-order — aren't arbitrary; each corresponds to a genuinely different question you'd ask about the tree, and recognizing which one a problem is secretly asking for is half the battle.

## 2. Analogy

Think of a company org chart, with the CEO at the root and each manager's direct reports as children. If you're **announcing to the whole company at once, floor by floor** ("everyone on the executive floor, then everyone on the director floor, then everyone on the manager floor..."), that's **level-order**: you process the tree rung by rung, breadth first.

If instead you're **onboarding new hires by first meeting the manager who owns the decision, then working down into their team**, you'd introduce the manager first, then dive into their reports — that's **preorder**: visit the node, then its left subtree, then its right subtree.

If you're **auditing a filing cabinet where a folder's own summary page only makes sense once you've read what's inside it**, you'd read the children's contents fully before writing the parent's roll-up number — that's **postorder**: visit children first, node last. This is exactly why postorder is the natural order for safely deleting a tree (delete children before the parent) or computing aggregate values (a folder's total depends on its subfolders' totals).

**Inorder** doesn't map as cleanly to an org chart, but it has a special home turf: in a binary *search* tree, where left children are smaller and right children are larger, visiting left-subtree → node → right-subtree happens to walk every value in ascending sorted order — for free, with no separate sort step.

## 3. Internal Flow

The three "depth-first" traversals — preorder, inorder, postorder — differ only in *where the visit (the "process this node's value") statement sits* relative to the two recursive calls:

- **Preorder**: `visit(node)` → recurse left → recurse right. Visit happens *before* descending.
- **Inorder**: recurse left → `visit(node)` → recurse right. Visit happens *between* the two subtrees.
- **Postorder**: recurse left → recurse right → `visit(node)`. Visit happens *after* both subtrees are fully processed.

All three share the same base case: if the current node is `None`, there's nothing to visit and nothing to recurse into, so the function returns immediately. This base case is what stops the recursion at the leaves' non-existent children — skip it, and you can't even call these on a real tree without crashing.

**Level-order** (also called BFS — breadth-first search) is fundamentally different: it's iterative, not recursive, and it uses a **queue** instead of the call stack. The algorithm:

1. Push the root onto a queue.
2. While the queue isn't empty: pop the front node, visit it, then push its left child (if any) and its right child (if any) onto the *back* of the queue.
3. Because a queue is FIFO (first-in-first-out), all nodes at depth *d* get popped and visited — and their children pushed — before any node at depth *d+1* is popped. That's what guarantees the level-by-level order.

Depth-first traversals use O(h) extra space (h = tree height, via the call stack); level-order uses O(w) extra space (w = the tree's maximum width, via the queue) — on a wide, shallow tree the queue can hold far more nodes at once than the recursion stack ever would.

## 4. Example

```python
from collections import deque

class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

#          4
#        /   \
#       2     6
#      / \   / \
#     1   3 5   7
root = Node(4,
            Node(2, Node(1), Node(3)),
            Node(6, Node(5), Node(7)))

def preorder(node, out):
    if node is None:
        return
    out.append(node.val)      # visit
    preorder(node.left, out)
    preorder(node.right, out)

def inorder(node, out):
    if node is None:
        return
    inorder(node.left, out)
    out.append(node.val)      # visit
    inorder(node.right, out)

def postorder(node, out):
    if node is None:
        return
    postorder(node.left, out)
    postorder(node.right, out)
    out.append(node.val)      # visit

def level_order(root):
    if root is None:
        return []
    out = []
    q = deque([root])
    while q:
        node = q.popleft()
        out.append(node.val)
        if node.left:
            q.append(node.left)
        if node.right:
            q.append(node.right)
    return out

pre, ino, post = [], [], []
preorder(root, pre)
inorder(root, ino)
postorder(root, post)

print("Preorder   :", pre)
print("Inorder    :", ino)
print("Postorder  :", post)
print("Level-order:", level_order(root))
```

Executed output:

```
Preorder   : [4, 2, 1, 3, 6, 5, 7]
Inorder    : [1, 2, 3, 4, 5, 6, 7]
Postorder  : [1, 3, 2, 5, 7, 6, 4]
Level-order: [4, 2, 6, 1, 3, 5, 7]
```

Notice inorder produces `[1, 2, 3, 4, 5, 6, 7]` — perfectly sorted, because this tree happens to satisfy the BST invariant. Preorder starts with the root (4) since it visits before descending; postorder ends with the root (4) since it visits after both subtrees are done; level-order visits 4, then both its children (2, 6), then all four grandchildren — strictly rung by rung.

## 5. Compare

Preorder, inorder, and postorder all visit the same set of nodes and cost the same O(n) time and O(h) space — they differ purely in *sequence*, driven entirely by where you place the visit statement relative to the two recursive calls. Level-order visits the same n nodes in O(n) time too, but trades the call stack for an explicit queue, giving O(w) space instead of O(h) — for a balanced tree, h (≈log n) is much smaller than w (≈n/2 at the widest level) — so DFS's space stays small while BFS's space grows with the tree's width — but for a highly skewed tree this relationship can flip (h large, w small, or vice versa for a very bushy shallow tree), so the space profile can differ substantially. Pick preorder when you need to process a node before its children (e.g. serializing a tree so it can be rebuilt top-down, or copying a tree). Pick postorder when children must be fully handled before the parent (e.g. safely deleting a tree bottom-up, or computing a subtree-dependent aggregate like folder size). Pick inorder specifically when the tree is a BST and you want sorted output. Pick level-order when "distance from the root" or "which level is this node on" is what actually matters, e.g. printing a tree level by level, or finding the shortest path in an unweighted tree.

## 6. Common Mistakes

- **Confusing the order of the recursive calls versus the visit statement** — e.g. intending postorder (children fully processed before the parent, for a safe bottom-up delete) but accidentally writing `visit(node)` first, which silently gives you preorder instead. The bug won't crash; it'll just produce a different sequence than you meant, which is easy to miss unless you check the actual output against what the order should be.
- **Forgetting the `None` base case before recursing**, e.g. writing `preorder(node.left, out)` without first checking `if node is None: return` — the recursion runs off the bottom of the tree and calls `.left` or `.right` on `None`, raising `AttributeError: 'NoneType' object has no attribute 'left'`.
- **Assuming inorder always produces sorted output.** It only does so for a valid BST; run inorder on an arbitrary (non-BST) binary tree and you get a perfectly valid traversal order that has nothing to do with sorted order.
- **Using recursion for level-order** (or a stack for BFS) instead of a queue — level-order's entire correctness depends on FIFO ordering; swapping in a stack (LIFO) or plain recursion gives you a depth-first order dressed up to look like BFS, and it will not process nodes level-by-level.
- **Forgetting to check both children exist before enqueueing them** in level-order — pushing a `None` child onto the queue means the next iteration pops `None` and crashes trying to read `.val`.

## 7. Interview Angle

Interviewers rarely ask "implement inorder traversal" in isolation — they ask a question that *requires* recognizing which traversal solves it. "Validate that a tree is a BST" is really "does inorder produce a strictly increasing sequence?" "Serialize and deserialize a binary tree" is naturally a preorder problem (root first makes top-down reconstruction easy). "Find the maximum depth" or "print level by level" is a level-order (BFS) problem. Being asked to convert a recursive traversal into an *iterative* one (using an explicit stack to simulate the call stack) is also common, since it tests whether you actually understand what the recursion is doing rather than having memorized the three-line function. Know all four by name, know which real-world question each answers, and be ready to trace one by hand on a small tree on a whiteboard.

## 8. Memory Hook

**Where's the visit statement?** Pre-**order**: visit first (root before kids) — think "announce the manager, then meet the team." In-**order**: visit in the middle (left, node, right) — the one that sorts a BST for free. Post-**order**: visit last (root after kids) — safe for deletion, since you never touch a parent before its children are done. **Level**-order breaks the pattern entirely: no recursion, just a queue, rung by rung.
