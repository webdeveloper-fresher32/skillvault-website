# Trees, Graphs, and Traversal — Complete Guide

## Table of Contents
1. [Tree Terminology](#1-tree-terminology)
2. [Binary Tree Implementation](#2-binary-tree-implementation)
3. [Depth-First Traversal (Recursive)](#3-depth-first-traversal-recursive)
4. [Depth-First Traversal (Iterative with Explicit Stack)](#4-depth-first-traversal-iterative-with-explicit-stack)
5. [Breadth-First Traversal](#5-breadth-first-traversal)
6. [Binary Search Tree Operations](#6-binary-search-tree-operations)
7. [Graph Representation](#7-graph-representation)
8. [Graph Traversal (BFS and DFS)](#8-graph-traversal-bfs-and-dfs)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Tree Terminology

A tree is a hierarchical, non-linear data structure made of nodes connected by edges, with no cycles — each node (except the root) has exactly one parent.

```
                 root
                  │
              ┌───(1)───┐
              │         │
            (2)         (3)          depth 1
           ┌──┴──┐        │
          (4)   (5)      (6)         depth 2  ← leaves: 4, 5, 6
```

```
root        the top node, no parent
leaf        a node with no children
depth       number of edges from root to a node
height      number of edges on the longest path from a node down to a leaf
subtree     any node and all of its descendants, treated as its own tree
```

A **binary tree** restricts every node to at most two children, conventionally called `left` and `right`.

---

## 2. Binary Tree Implementation

```js
class TreeNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class BinaryTree {
  constructor() {
    this.root = null;
  }
}
```

### Field-by-Field Breakdown

```
TreeNode
  value  ↳ the payload stored at this node
  left   ↳ pointer to the left child TreeNode, or null
  right  ↳ pointer to the right child TreeNode, or null

BinaryTree
  root   ↳ entry point for every traversal and operation
```

We build one manually for the traversal examples below:

```js
//         1
//        / \
//       2   3
//      / \   \
//     4   5   6
const tree = new BinaryTree();
tree.root = new TreeNode(1);
tree.root.left = new TreeNode(2);
tree.root.right = new TreeNode(3);
tree.root.left.left = new TreeNode(4);
tree.root.left.right = new TreeNode(5);
tree.root.right.right = new TreeNode(6);
```

---

## 3. Depth-First Traversal (Recursive)

Depth-first traversal fully explores one branch before backtracking. There are three orderings, distinguished by *when* the current node's value is visited relative to its children.

```js
// Pre-order: visit node, then left subtree, then right subtree
// Use case: copying/serializing a tree (visit parent before children)
function preOrder(node, result = []) {
  if (!node) return result;
  result.push(node.value); // visit BEFORE recursing
  preOrder(node.left, result);
  preOrder(node.right, result);
  return result;
}

// In-order: visit left subtree, then node, then right subtree
// Use case: for a Binary SEARCH Tree, this yields values in sorted order
function inOrder(node, result = []) {
  if (!node) return result;
  inOrder(node.left, result);
  result.push(node.value); // visit BETWEEN the two recursive calls
  inOrder(node.right, result);
  return result;
}

// Post-order: visit left subtree, then right subtree, then node
// Use case: safely deleting a tree (children before parent) or computing subtree aggregates
function postOrder(node, result = []) {
  if (!node) return result;
  postOrder(node.left, result);
  postOrder(node.right, result);
  result.push(node.value); // visit AFTER both recursive calls
  return result;
}

console.log(preOrder(tree.root));  // [1, 2, 4, 5, 3, 6]
console.log(inOrder(tree.root));   // [4, 2, 5, 1, 3, 6]
console.log(postOrder(tree.root)); // [4, 5, 2, 6, 3, 1]
```

Each call recurses into `left` completely before touching `right` — that "go deep first" behavior is what makes this depth-first. The recursion itself uses the JS call stack implicitly, which is why very deep unbalanced trees can risk a stack overflow — the motivation for the iterative version next.

---

## 4. Depth-First Traversal (Iterative with Explicit Stack)

Any recursive traversal can be rewritten iteratively by managing an explicit stack yourself instead of relying on the call stack.

```js
// Iterative pre-order using an explicit stack.
// Push right child BEFORE left child so that left is popped (visited) first —
// a stack is LIFO, so the last thing pushed is the first thing processed.
function preOrderIterative(root) {
  if (!root) return [];
  const result = [];
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    result.push(node.value);
    if (node.right) stack.push(node.right); // push right first...
    if (node.left) stack.push(node.left);   // ...so left pops off first
  }
  return result;
}

console.log(preOrderIterative(tree.root)); // [1, 2, 4, 5, 3, 6] — matches recursive version
```

```
Stack trace for preOrderIterative on the sample tree:

stack: [1]                     result: []
pop 1 → visit 1, push 3, then 2
stack: [3, 2]                  result: [1]
pop 2 → visit 2, push 5, then 4
stack: [3, 5, 4]               result: [1, 2]
pop 4 → visit 4, no children
stack: [3, 5]                  result: [1, 2, 4]
pop 5 → visit 5, no children
stack: [3]                     result: [1, 2, 4, 5]
pop 3 → visit 3, push 6
stack: [6]                     result: [1, 2, 4, 5, 3]
pop 6 → visit 6, no children
stack: []                      result: [1, 2, 4, 5, 3, 6]  ← done
```

In-order and post-order can also be made iterative but require more bookkeeping (tracking whether a node's children have already been processed); pre-order is the simplest to convert and is shown here as the canonical example.

---

## 5. Breadth-First Traversal

Breadth-first traversal (also called level-order traversal) visits all nodes at depth 1, then all nodes at depth 2, and so on — it explores wide before it explores deep. This requires a **queue**, not a stack.

```js
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root]; // using push/shift here for clarity;
                        // see Lesson 2 for why a real Queue class avoids O(n) shift()

  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node.value);
    if (node.left) queue.push(node.left);
    if (node.right) queue.push(node.right);
  }
  return result;
}

console.log(levelOrder(tree.root)); // [1, 2, 3, 4, 5, 6] — level by level

// Level-order that groups nodes by depth — common interview variant
function levelOrderGrouped(root) {
  if (!root) return [];
  const levels = [];
  let queue = [root];

  while (queue.length > 0) {
    const currentLevelValues = [];
    const nextQueue = [];
    for (const node of queue) {
      currentLevelValues.push(node.value);
      if (node.left) nextQueue.push(node.left);
      if (node.right) nextQueue.push(node.right);
    }
    levels.push(currentLevelValues);
    queue = nextQueue;
  }
  return levels;
}

console.log(levelOrderGrouped(tree.root)); // [[1], [2, 3], [4, 5, 6]]
```

```
BFS visits ring by ring, outward from the root — this is why it's
the correct choice for "shortest path" problems in unweighted graphs:
the first time you reach a target node, you've reached it by the
fewest possible edges.

           1            ← ring 0
         /   \
        2     3         ← ring 1  (visited together, before ring 2)
       / \     \
      4   5     6       ← ring 2
```

---

## 6. Binary Search Tree Operations

A Binary Search Tree (BST) is a binary tree with an ordering invariant: for every node, all values in its left subtree are smaller, and all values in its right subtree are larger. This invariant is what makes search, insert, and delete average-case O(log n) — each comparison eliminates roughly half the remaining tree, just like binary search on a sorted array.

```js
class BSTNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null;
  }

  insert(value) {
    const newNode = new BSTNode(value);
    if (!this.root) {
      this.root = newNode;
      return this;
    }
    let current = this.root;
    while (true) {
      if (value === current.value) return this; // no duplicates
      if (value < current.value) {
        if (!current.left) { current.left = newNode; return this; }
        current = current.left;
      } else {
        if (!current.right) { current.right = newNode; return this; }
        current = current.right;
      }
    }
  }

  search(value) {
    let current = this.root;
    while (current) {
      if (value === current.value) return true;
      current = value < current.value ? current.left : current.right;
    }
    return false;
  }

  // Delete is the trickiest BST operation — three cases per node removed
  delete(value) {
    this.root = this.#deleteNode(this.root, value);
  }

  #deleteNode(node, value) {
    if (!node) return null;

    if (value < node.value) {
      node.left = this.#deleteNode(node.left, value);
    } else if (value > node.value) {
      node.right = this.#deleteNode(node.right, value);
    } else {
      // Found the node to delete — three cases:
      if (!node.left && !node.right) return null;             // Case 1: leaf, just remove
      if (!node.left) return node.right;                       // Case 2: one child, splice it up
      if (!node.right) return node.left;                       // Case 2: one child, splice it up

      // Case 3: two children — replace value with in-order successor
      // (smallest value in the right subtree), then delete that successor
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.value = successor.value;
      node.right = this.#deleteNode(node.right, successor.value);
    }
    return node;
  }
}

const bst = new BinarySearchTree();
[8, 3, 10, 1, 6, 14, 4, 7, 13].forEach(v => bst.insert(v));
console.log(bst.search(6));  // true
console.log(bst.search(99)); // false
bst.delete(3);
console.log(inOrder(bst.root)); // sorted output even after deletion
```

### Why Average O(log n) but Worst-Case O(n)

```
Balanced BST (log n height):        Unbalanced/degenerate BST (n height):

        8                            1
       / \                            \
      3   10                          2
     / \    \                          \
    1   6    14                         3
       / \   /                          \
      4   7 13                           4   ← inserting 1,2,3,4... in order
                                              degenerates into a linked list!
height ≈ log(n)                     height = n
search/insert/delete: O(log n)      search/insert/delete: O(n)
```

Inserting already-sorted data into a plain BST produces a degenerate, linked-list-shaped tree — this is exactly why self-balancing variants (AVL trees, Red-Black trees, which JS engines and language runtimes use internally for ordered structures) exist, though implementing them is beyond this lesson's scope.

---

## 7. Graph Representation

A graph generalizes a tree by removing the "no cycles, one parent" restriction — any node can connect to any other node. The two common representations are adjacency matrix and adjacency list; JS almost always favors the **adjacency list** because most real-world graphs are sparse (far fewer edges than the maximum possible).

```
Graph:            A ── B
                  │    │
                  C ── D

Adjacency List (Map of node → array of neighbors):
  A: [B, C]
  B: [A, D]
  C: [A, D]
  D: [B, C]
```

```js
class Graph {
  #adjacencyList = new Map();

  addVertex(vertex) {
    if (!this.#adjacencyList.has(vertex)) {
      this.#adjacencyList.set(vertex, []);
    }
    return this;
  }

  // Undirected edge — add the connection both ways
  addEdge(v1, v2) {
    this.addVertex(v1);
    this.addVertex(v2);
    this.#adjacencyList.get(v1).push(v2);
    this.#adjacencyList.get(v2).push(v1);
    return this;
  }

  neighbors(vertex) {
    return this.#adjacencyList.get(vertex) || [];
  }

  get vertices() {
    return [...this.#adjacencyList.keys()];
  }
}

const graph = new Graph();
graph.addEdge("A", "B");
graph.addEdge("A", "C");
graph.addEdge("B", "D");
graph.addEdge("C", "D");
console.log(graph.neighbors("A")); // ["B", "C"]
```

For a **directed** graph, `addEdge` would only push `v2` onto `v1`'s list (a one-way connection). Weighted graphs store `{ node, weight }` pairs instead of plain node references.

---

## 8. Graph Traversal (BFS and DFS)

Unlike trees, graphs can contain cycles, so every traversal must track **visited** nodes to avoid infinite loops.

```js
// BFS — explores level by level, correct for shortest path in unweighted graphs
function bfsGraph(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];

  while (queue.length > 0) {
    const vertex = queue.shift();
    order.push(vertex);
    for (const neighbor of graph.neighbors(vertex)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor); // mark visited when ENQUEUED, not when dequeued —
        queue.push(neighbor);  // prevents the same node being queued multiple times
      }
    }
  }
  return order;
}

// DFS — recursive version, explores as deep as possible before backtracking
function dfsGraphRecursive(graph, start, visited = new Set(), order = []) {
  visited.add(start);
  order.push(start);
  for (const neighbor of graph.neighbors(start)) {
    if (!visited.has(neighbor)) {
      dfsGraphRecursive(graph, neighbor, visited, order);
    }
  }
  return order;
}

// DFS — iterative version with an explicit stack (no recursion depth limit)
function dfsGraphIterative(graph, start) {
  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length > 0) {
    const vertex = stack.pop();
    if (visited.has(vertex)) continue; // may be pushed more than once; skip duplicates
    visited.add(vertex);
    order.push(vertex);
    for (const neighbor of graph.neighbors(vertex)) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return order;
}

console.log(bfsGraph(graph, "A"));           // ["A", "B", "C", "D"]
console.log(dfsGraphRecursive(graph, "A"));  // ["A", "B", "D", "C"]
console.log(dfsGraphIterative(graph, "A"));  // ["A", "C", "D", "B"] (order can vary with stack-based DFS)
```

Both BFS and DFS run in O(V + E) time — every vertex and every edge is examined at most once — differing only in whether they use a queue (BFS) or a stack (DFS), which directly parallels the tree traversal patterns above: a binary tree traversal is really just graph BFS/DFS on a graph that happens to be acyclic and hierarchical.

---

## 9. Hands-On Exercises

**Exercise 1:** Implement `maxDepth(root)` that returns the height of a binary tree using recursion (`1 + max(maxDepth(left), maxDepth(right))`, with base case `0` for `null`). Then implement `isBalanced(root)` that returns `true` if, for every node, the height difference between its left and right subtrees is at most 1.

**Exercise 2:** Implement iterative versions of **in-order** and **post-order** traversal (Section 4 only showed pre-order). For in-order, push left children onto the stack until you hit `null`, then pop, visit, and move to the right child. For post-order, a common trick is to do a modified pre-order (node, right, left) and reverse the result at the end.

**Exercise 3:** Using the `BinarySearchTree` class from Section 6, implement `isValidBST(root)` that verifies the BST invariant holds for an arbitrary binary tree (not just one built via `insert`) — pass down a valid `(min, max)` range to each recursive call rather than only comparing to immediate children.

**Exercise 4:** Extend the `Graph` class from Section 7 to support directed, weighted edges: `addEdge(v1, v2, weight)` should only connect `v1 → v2` (not both ways) and store `{ node: v2, weight }` in the adjacency list. Then implement `hasPath(graph, start, end)` using BFS to determine if any path exists from `start` to `end`.

**Exercise 5:** Implement `shortestPathBFS(graph, start, end)` on an unweighted graph that returns the actual sequence of nodes forming the shortest path (not just whether one exists), by tracking a `parent` map during BFS (each node's parent is whichever node first discovered it) and walking backward from `end` to `start` once found, then reversing the result.

---

## 10. Interview Q&A

**Q: What is the difference between depth-first and breadth-first traversal, and when would you choose each?**
Answer: Depth-first traversal (DFS) explores as far down one branch as possible before backtracking, using a stack (either the implicit call stack via recursion, or an explicit stack iteratively). Breadth-first traversal (BFS) explores all nodes at the current depth before moving to the next depth, using a queue. DFS is the right choice when you need to explore every path or check for existence deep in a structure — like detecting a cycle, or generating all permutations — and its memory usage is bounded by the tree's height. BFS is the right choice whenever you need the *shortest* path or minimum number of steps in an unweighted graph, because it guarantees the first time you reach a target node is via the fewest possible edges — but its memory usage can be higher since it must hold an entire "ring" of nodes in the queue at once.

**Q: Why does an unbalanced binary search tree degrade to O(n) operations instead of O(log n)?**
Answer: A BST's O(log n) average performance comes from each comparison eliminating roughly half of the remaining nodes, which only holds if the tree is roughly balanced — height proportional to log n. If data is inserted in already-sorted (or reverse-sorted) order, every new node becomes the right (or left) child of the previous one, producing a tree that is really just a linked list in disguise, with height equal to n instead of log n. Searching, inserting, or deleting then requires walking potentially all n nodes, giving O(n) worst-case behavior — this is exactly why production systems use self-balancing variants like AVL or Red-Black trees, which perform rotations during insertion/deletion to keep the height close to log n regardless of insertion order.

**Q: Why do we mark a node as visited when it's enqueued in BFS rather than when it's dequeued?**
Answer: If we waited to mark a node visited until it's dequeued, the same node could be pushed onto the queue multiple times by different neighbors before any of those pushes are processed — for example, if nodes B and C are both adjacent to D, both B and C might enqueue D before D is ever dequeued and marked visited, resulting in D being processed twice (and wasted work re-exploring its neighbors). By marking a node visited at the moment it's enqueued, we guarantee each node enters the queue exactly once, keeping the algorithm's total work bounded to O(V + E) rather than allowing duplicate work that could, in pathological graphs, blow up the complexity.

**Q: How would you detect a cycle in a graph, and does the approach differ for directed versus undirected graphs?**
Answer: For an undirected graph, a straightforward DFS works: track visited nodes, and if you ever encounter a neighbor that is already visited and is not the node you just came from (its immediate parent in the traversal), you've found a cycle. For a directed graph, this isn't sufficient, because a node can be "visited" from an earlier, now-finished branch without there being a cycle back to it — instead you need to track nodes currently in the active recursion path (often called the "recursion stack" or "gray" set, as opposed to fully "black" finished nodes); if DFS encounters a node that is in the *current* path rather than merely visited at some point, that's a genuine back-edge indicating a cycle. This distinction — visited overall versus visited in the current path — is the key difference between cycle detection in undirected versus directed graphs.

**Q: What's the practical difference between an adjacency list and an adjacency matrix for representing a graph, and which is preferred in most applications?**
Answer: An adjacency matrix is a V×V grid where `matrix[i][j]` indicates whether an edge exists between vertex i and j, giving O(1) edge-existence checks but O(V²) space regardless of how many edges actually exist. An adjacency list stores, for each vertex, only the list of its actual neighbors, using O(V + E) space — proportional to what's actually there. Most real-world graphs (social networks, road networks, dependency graphs) are sparse, meaning E is much smaller than V², so an adjacency list is dramatically more memory-efficient and is the standard choice; an adjacency matrix becomes preferable only when the graph is dense (E close to V²) or when O(1) "are these two nodes directly connected?" checks are performed far more often than iterating over neighbors.
