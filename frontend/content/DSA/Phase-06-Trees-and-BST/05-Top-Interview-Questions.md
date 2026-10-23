# Top Interview Questions — Trees & BST

Master these 16 essential interview problems covering Binary Tree Traversals (DFS/BFS), Binary Search Tree Properties, Diameter & Maximum Path Sums, Tree Serialization, and Balanced Tree Mechanics.

---

### Standard TreeNode Definition
```python
class TreeNode:
    def __init__(self, val: int = 0, left: 'TreeNode' = None, right: 'TreeNode' = None):
        self.val = val
        self.left = left
        self.right = right
```

---

### Problem 1: Invert / Flip Binary Tree
**Difficulty: Easy | Pattern: Recursive Tree Transformation**

#### Problem Statement
Given the root of a binary tree, invert the tree (swap left and right subtrees recursively) and return its root.

#### Python Solution
```python
def invert_tree(root: TreeNode) -> TreeNode:
    if not root:
        return None
        
    # Swap children
    root.left, root.right = root.right, root.left
    
    # Recurse on subtrees
    invert_tree(root.left)
    invert_tree(root.right)
    
    return root
```

#### Complexity
- **Time:** $O(n)$ — Visits every node once.
- **Space:** $O(h)$ call stack, where $h$ is tree height ($O(\log n)$ balanced, $O(n)$ skewed).

---

### Problem 2: Validate Binary Search Tree
**Difficulty: Medium | Pattern: Min/Max Range Propagation**

#### Problem Statement
Given the root of a binary tree, determine if it is a valid binary search tree (BST). A valid BST requires that all nodes in the left subtree have values strictly less than the node's value, and all nodes in the right subtree have values strictly greater.

#### Python Solution
```python
def is_valid_bst(root: TreeNode) -> bool:
    def validate(node: TreeNode, low: float, high: float) -> bool:
        if not node:
            return True
            
        if not (low < node.val < high):
            return False
            
        # Left child must be in (low, node.val)
        # Right child must be in (node.val, high)
        return validate(node.left, low, node.val) and validate(node.right, node.val, high)
        
    return validate(root, float('-inf'), float('inf'))
```

#### Common Trap
Checking only `node.left.val < node.val < node.right.val` locally. A node must obey bounds established by *all* ancestors higher up in the tree!

---

### Problem 3: Lowest Common Ancestor of a Binary Tree
**Difficulty: Medium | Pattern: Postorder Divide and Conquer**

#### Problem Statement
Given a binary tree and two nodes `p` and `q`, find the lowest common ancestor (LCA). The LCA is defined between two nodes `p` and `q` as the lowest node in $T$ that has both `p` and `q` as descendants.

#### Python Solution
```python
def lowest_common_ancestor(root: TreeNode, p: TreeNode, q: TreeNode) -> TreeNode:
    # Base cases
    if not root or root == p or root == q:
        return root
        
    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)
    
    # If both left and right return a non-null node, root is the LCA!
    if left and right:
        return root
        
    # Otherwise, LCA is located in whichever subtree returned non-null
    return left if left else right
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(h)$ call stack.

---

### Problem 4: Lowest Common Ancestor of a BST
**Difficulty: Medium | Pattern: BST Property Exploitation ($O(1)$ Space)**

#### Problem Statement
Find the LCA of nodes `p` and `q` in a Binary Search Tree.

#### Python Solution
```python
def lowest_common_ancestor_bst(root: TreeNode, p: TreeNode, q: TreeNode) -> TreeNode:
    curr = root
    
    while curr:
        if p.val < curr.val and q.val < curr.val:
            curr = curr.left   # Both nodes are in the left subtree
        elif p.val > curr.val and q.val > curr.val:
            curr = curr.right  # Both nodes are in the right subtree
        else:
            # We found the split point! curr is the LCA.
            return curr
            
    return None
```

#### Complexity
- **Time:** $O(h)$ where $h$ is tree height.
- **Space:** $O(1)$ auxiliary space.

---

### Problem 5: Binary Tree Level Order Traversal (BFS)
**Difficulty: Medium | Pattern: Queue with Level Size Snapshot**

#### Problem Statement
Given the root of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level).

#### Python Solution
```python
from collections import deque
from typing import List

def level_order(root: TreeNode) -> List[List[int]]:
    if not root:
        return []
        
    result = []
    queue = deque([root])
    
    while queue:
        level_size = len(queue)
        current_level = []
        
        for _ in range(level_size):
            node = queue.popleft()
            current_level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
                
        result.append(current_level)
        
    return result
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$ (at most $n/2$ nodes stored in queue for complete binary tree).

---

### Problem 6: Binary Tree Zigzag Level Order Traversal
**Difficulty: Medium | Pattern: Alternating Level Traversal**

#### Problem Statement
Given the root of a binary tree, return the zigzag level order traversal of its nodes' values (i.e., alternate left-to-right and right-to-left).

#### Python Solution
```python
def zigzag_level_order(root: TreeNode) -> List[List[int]]:
    if not root:
        return []
        
    result = []
    queue = deque([root])
    left_to_right = True
    
    while queue:
        level_size = len(queue)
        level_nodes = deque()
        
        for _ in range(level_size):
            node = queue.popleft()
            if left_to_right:
                level_nodes.append(node.val)
            else:
                level_nodes.appendleft(node.val)
                
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
                
        result.append(list(level_nodes))
        left_to_right = not left_to_right
        
    return result
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$

---

### Problem 7: Diameter of Binary Tree
**Difficulty: Easy-Medium | Pattern: Postorder Traversal with Global Max State**

#### Problem Statement
The diameter of a binary tree is the length of the longest path between any two nodes in a tree. This path may or may not pass through the root. Length is measured by number of edges.

#### Python Solution
```python
def diameter_of_binary_tree(root: TreeNode) -> int:
    max_diameter = 0
    
    def get_height(node: TreeNode) -> int:
        nonlocal max_diameter
        if not node:
            return 0
            
        left_height = get_height(node.left)
        right_height = get_height(node.right)
        
        # Diameter through this node is sum of left and right subtree heights
        max_diameter = max(max_diameter, left_height + right_height)
        
        # Return height of this node to parent
        return 1 + max(left_height, right_height)
        
    get_height(root)
    return max_diameter
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(h)$

---

### Problem 8: Binary Tree Maximum Path Sum
**Difficulty: Hard | Pattern: Postorder Maximum Gain Branching**

#### Problem Statement
A path in a binary tree is a sequence of nodes where each pair of adjacent nodes has an edge. Path sum is sum of node values. Return the maximum path sum of any non-empty path.

#### Python Solution
```python
def max_path_sum(root: TreeNode) -> int:
    max_sum = float('-inf')
    
    def get_max_gain(node: TreeNode) -> int:
        nonlocal max_sum
        if not node:
            return 0
            
        # Max gain from left and right subtrees (ignore negative gains with max(0, ...))
        left_gain = max(get_max_gain(node.left), 0)
        right_gain = max(get_max_gain(node.right), 0)
        
        # Current path sum with node as the apex (highest point)
        price_newpath = node.val + left_gain + right_gain
        max_sum = max(max_sum, price_newpath)
        
        # For parent calls, return maximum single branch gain
        return node.val + max(left_gain, right_gain)
        
    get_max_gain(root)
    return max_sum
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(h)$

---

### Problem 9: Construct Binary Tree from Preorder & Inorder Traversal
**Difficulty: Medium | Pattern: Hash Map Index Split + Divide & Conquer**

#### Problem Statement
Given two integer arrays `preorder` and `inorder`, construct and return the binary tree.

#### Python Solution
```python
def build_tree(preorder: List[int], inorder: List[int]) -> TreeNode:
    # Build hash map of value -> index in inorder array for O(1) lookups
    inorder_index_map = {val: idx for idx, val in enumerate(inorder)}
    preorder_idx = 0
    
    def array_to_tree(left: int, right: int) -> TreeNode:
        nonlocal preorder_idx
        if left > right:
            return None
            
        # Select current root from preorder
        root_val = preorder[preorder_idx]
        preorder_idx += 1
        root = TreeNode(root_val)
        
        # Root splits inorder into left and right subtrees
        mid = inorder_index_map[root_val]
        
        root.left = array_to_tree(left, mid - 1)
        root.right = array_to_tree(mid + 1, right)
        
        return root

    return array_to_tree(0, len(inorder) - 1)
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n)$ for hash map and recursion stack.

---

### Problem 10: Serialize and Deserialize Binary Tree
**Difficulty: Hard | Pattern: Preorder DFS with Sentinel Delimiters**

#### Problem Statement
Design an algorithm to serialize a binary tree to a string and deserialize that string back to the original tree structure.

#### Python Solution
```python
class Codec:
    def serialize(self, root: TreeNode) -> str:
        """Encodes a tree to a single string using preorder traversal."""
        def rserialize(node):
            if not node:
                return ["#"]
            return [str(node.val)] + rserialize(node.left) + rserialize(node.right)
            
        return ",".join(rserialize(root))

    def deserialize(self, data: str) -> TreeNode:
        """Decodes your encoded data to tree."""
        def rdeserialize(tokens):
            val = next(tokens)
            if val == "#":
                return None
            node = TreeNode(int(val))
            node.left = rdeserialize(tokens)
            node.right = rdeserialize(tokens)
            return node
            
        tokens = iter(data.split(","))
        return rdeserialize(tokens)
```

#### Complexity
- **Time:** $O(n)$ for both serialization and deserialization.
- **Space:** $O(n)$

---

### Problem 11: Kth Smallest Element in a BST
**Difficulty: Medium | Pattern: Iterative Inorder Traversal with Early Stopping**

#### Problem Statement
Given the root of a binary search tree and an integer $k$, return the $k$-th smallest value (1-indexed) in the tree.

#### Python Solution
```python
def kth_smallest(root: TreeNode, k: int) -> int:
    stack = []
    curr = root
    
    while curr or stack:
        # Reach leftmost node of curr
        while curr:
            stack.append(curr)
            curr = curr.left
            
        curr = stack.pop()
        k -= 1
        if k == 0:
            return curr.val
            
        curr = curr.right
        
    return -1
```

#### Complexity
- **Time:** $O(h + k)$ where $h$ is tree height.
- **Space:** $O(h)$ stack depth.

---

### Problem 12: Populating Next Right Pointers in Each Node
**Difficulty: Medium | Pattern: Level Traversal in $O(1)$ Extra Space**

#### Problem Statement
Populate each `next` pointer to point to its next right node. If there is no next right node, the `next` pointer should be set to `None`. Must run in $O(1)$ extra space.

```python
class NodeWithNext:
    def __init__(self, val=0, left=None, right=None, next=None):
        self.val = val
        self.left = left
        self.right = right
        self.next = next

def connect(root: NodeWithNext) -> NodeWithNext:
    if not root:
        return None
        
    leftmost = root
    
    # Traverse level by level using previously established next pointers
    while leftmost.left:
        head = leftmost
        while head:
            # Connect children of same parent
            head.left.next = head.right
            # Connect right child to adjacent parent's left child
            if head.next:
                head.right.next = head.next.left
            head = head.next
            
        leftmost = leftmost.left
        
    return root
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$ auxiliary space.

---

### Problem 13: Path Sum II (All Root-to-Leaf Paths)
**Difficulty: Medium | Pattern: Backtracking DFS with Path Stack**

#### Problem Statement
Given the root of a binary tree and an integer `targetSum`, return all root-to-leaf paths where the sum of the node values equals `targetSum`.

#### Python Solution
```python
def path_sum(root: TreeNode, target_sum: int) -> List[List[int]]:
    result = []
    current_path = []
    
    def dfs(node: TreeNode, remaining_sum: int):
        if not node:
            return
            
        current_path.append(node.val)
        
        # Check if it's a leaf node and sum matches
        if not node.left and not node.right and remaining_sum == node.val:
            result.append(list(current_path))
        else:
            dfs(node.left, remaining_sum - node.val)
            dfs(node.right, remaining_sum - node.val)
            
        # Backtrack
        current_path.pop()
        
    dfs(root, target_sum)
    return result
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(h)$

---

### Problem 14: Symmetric Tree (Mirror Symmetry Check)
**Difficulty: Easy | Pattern: Dual-Pointer Mirror Recursion**

#### Problem Statement
Given the root of a binary tree, check whether it is a mirror of itself (i.e., symmetric around its center).

#### Python Solution
```python
def is_symmetric(root: TreeNode) -> bool:
    if not root:
        return True
        
    def is_mirror(t1: TreeNode, t2: TreeNode) -> bool:
        if not t1 and not t2:
            return True
        if not t1 or not t2:
            return False
            
        return (t1.val == t2.val) and \
               is_mirror(t1.left, t2.right) and \
               is_mirror(t1.right, t2.left)
               
    return is_mirror(root.left, root.right)
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(h)$

---

### Problem 15: Count Complete Tree Nodes in $O(\log^2 n)$
**Difficulty: Medium-Hard | Pattern: Depth Comparison Binary Search**

#### Problem Statement
Given the root of a complete binary tree, count the number of nodes in strictly less than $O(n)$ time.

#### Python Solution
```python
def count_nodes(root: TreeNode) -> int:
    if not root:
        return 0
        
    def get_left_depth(node):
        d = 0
        while node:
            d += 1
            node = node.left
        return d

    def get_right_depth(node):
        d = 0
        while node:
            d += 1
            node = node.right
        return d

    left_d = get_left_depth(root)
    right_d = get_right_depth(root)
    
    # If left and right depths match, subtree is a full binary tree!
    if left_d == right_d:
        return (1 << left_d) - 1  # 2^d - 1
        
    # Otherwise, recurse on left and right
    return 1 + count_nodes(root.left) + count_nodes(root.right)
```

#### Complexity
- **Time:** $O(\log^2 n)$ — Depth calculation takes $O(\log n)$ and is executed $O(\log n)$ times.
- **Space:** $O(\log n)$ call stack.

---

### Problem 16: Flatten Binary Tree to Linked List
**Difficulty: Medium | Pattern: In-Place Morris Traversal / Right-Spine Redirection**

#### Problem Statement
Flatten a binary tree into a single right-leaning linked list in-place (following preorder traversal). Solve in $O(1)$ extra space.

#### Python Solution
```python
def flatten_tree(root: TreeNode) -> None:
    curr = root
    
    while curr:
        if curr.left:
            # Find the rightmost node of curr's left subtree
            rightmost = curr.left
            while rightmost.right:
                rightmost = rightmost.right
                
            # Connect right subtree of curr to rightmost node
            rightmost.right = curr.right
            # Move left subtree to right
            curr.right = curr.left
            curr.left = None
            
        curr = curr.right
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$ auxiliary space.
