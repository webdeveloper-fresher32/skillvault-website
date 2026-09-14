# Object Identification Practice Drills

## Table of Contents
1. [How to Use These Drills](#1-how-to-use-these-drills)
2. [Drill 1: Chess](#2-drill-1-chess)
3. [Drill 2: Snake and Ladder](#3-drill-2-snake-and-ladder)
4. [Drill 3: Tic-Tac-Toe Deep Dive](#4-drill-3-tic-tac-toe-deep-dive)
5. [Drill 4: Vending Machine (Command-Style)](#5-drill-4-vending-machine-command-style)
6. [Drill 5: Extensible Calculator (Strategy)](#6-drill-5-extensible-calculator-strategy)
7. [Interview Q&A](#7-interview-qa)

---

## 1. How to Use These Drills

These are **warm-up-tier** prompts — the kind interviewers use in the first 10 minutes to gauge basic OOP fluency before moving to a harder prompt, or as a full 30-minute prompt at junior/mid level. The goal here is speed and pattern recognition, not exhaustive implementation (full deep dives on comparable systems live in earlier phases and in `Projects/`).

For each drill:
1. Cover the "Class List" and "Key Decision" and try to derive them yourself from the one-line prompt.
2. Check yourself against the answer.
3. Skim the code skeleton — don't memorize it, understand *why* each method lives where it does.

---

## 2. Drill 1: Chess

**Prompt:** "Design the core engine for a two-player Chess game — board, pieces, legal moves, turns, check detection is out of scope for this drill."

### Class List

| Class | Role |
|-------|------|
| `Board` | 8x8 grid, tracks piece positions |
| `Piece` (abstract) | Base class with `get_valid_moves()` |
| `King`, `Queen`, `Rook`, `Bishop`, `Knight`, `Pawn` | Concrete pieces, each overrides `get_valid_moves()` |
| `Player` | Owns a color (WHITE/BLACK) |
| `Move` | Value object: `(from_pos, to_pos)` |
| `Game` | Orchestrates turns, delegates move validation |

### Key Decision

**Polymorphism over type-checking.** Every piece type moves differently — the anti-pattern is a `Board.get_valid_moves(piece)` method full of `if piece.type == "KNIGHT": ...`. Instead, each `Piece` subclass implements its own `get_valid_moves(board, position)`, and `Board`/`Game` call it polymorphically without knowing the concrete piece type. This is a direct application of Open/Closed — adding a new piece variant (e.g., a custom chess-variant piece) never touches existing piece classes.

### Code Skeleton

```python
from abc import ABC, abstractmethod
from enum import Enum


class Color(Enum):
    WHITE = "white"
    BLACK = "black"


class Piece(ABC):
    def __init__(self, color: Color):
        self.color = color

    @abstractmethod
    def get_valid_moves(self, board: "Board", position: tuple[int, int]) -> list[tuple[int, int]]:
        """Each subclass computes its own legal destination squares."""
        ...


class Knight(Piece):
    def get_valid_moves(self, board, position):
        r, c = position
        deltas = [(-2, -1), (-2, 1), (2, -1), (2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2)]
        candidates = [(r + dr, c + dc) for dr, dc in deltas]
        return [p for p in candidates if board.is_on_board(p) and board.is_landable(p, self.color)]


class Pawn(Piece):
    def get_valid_moves(self, board, position):
        # Direction depends on color; capture vs forward-move logic differs.
        ...  # omitted for brevity — this is a drill skeleton


class Board:
    def __init__(self):
        self.grid: dict[tuple[int, int], Piece] = {}  # populated with starting position

    def is_on_board(self, pos) -> bool:
        r, c = pos
        return 0 <= r < 8 and 0 <= c < 8

    def is_landable(self, pos, color: Color) -> bool:
        occupant = self.grid.get(pos)
        return occupant is None or occupant.color != color

    def move_piece(self, frm, to) -> None:
        piece = self.grid.pop(frm)
        self.grid[to] = piece


class Player:
    def __init__(self, color: Color):
        self.color = color


class Game:
    def __init__(self):
        self.board = Board()
        self.players = [Player(Color.WHITE), Player(Color.BLACK)]
        self.turn = 0

    def make_move(self, frm, to) -> None:
        piece = self.board.grid[frm]
        current_player = self.players[self.turn % 2]
        if piece.color != current_player.color:
            raise ValueError("Not this player's piece")
        if to not in piece.get_valid_moves(self.board, frm):
            raise ValueError("Illegal move")
        self.board.move_piece(frm, to)
        self.turn += 1
```

---

## 3. Drill 2: Snake and Ladder

**Prompt:** "Design a Snake and Ladder game for 2+ players on a configurable board size."

### Class List

| Class | Role |
|-------|------|
| `Board` | Holds size + a lookup of snakes and ladders by starting cell |
| `Dice` | Rolls a random number 1-6 |
| `Snake` | `head`, `tail` (head > tail) |
| `Ladder` | `bottom`, `top` (top > bottom) |
| `Player` | Tracks current position |
| `Game` | Turn loop: roll dice, move player, apply snake/ladder, check win |

### Key Decision

**Unify Snake and Ladder behind one lookup, not two.** Both are really "a jump from cell A to cell B" — the only difference is direction (snake moves you backward, ladder moves you forward). Modeling `Board` with a single `jumps: dict[int, int]` (start cell → end cell) built from both snakes and ladders means `Game`'s move logic doesn't need an `if isinstance(entity, Snake)` branch at all — it just does `new_pos = board.jumps.get(new_pos, new_pos)`. This is a small but real Open/Closed win: a future "wormhole" or "teleporter" entity would slot into the same `jumps` dict with zero changes to `Game`.

### Code Skeleton

```python
import random


class Dice:
    def roll(self) -> int:
        return random.randint(1, 6)


class Board:
    def __init__(self, size: int = 100):
        self.size = size
        self.jumps: dict[int, int] = {}  # start_cell -> end_cell, covers snakes AND ladders

    def add_snake(self, head: int, tail: int) -> None:
        assert head > tail
        self.jumps[head] = tail

    def add_ladder(self, bottom: int, top: int) -> None:
        assert top > bottom
        self.jumps[bottom] = top

    def resolve(self, position: int) -> int:
        return self.jumps.get(position, position)


class Player:
    def __init__(self, name: str):
        self.name = name
        self.position = 0


class Game:
    def __init__(self, board: Board, players: list[Player]):
        self.board = board
        self.players = players
        self.dice = Dice()

    def play_turn(self, player: Player) -> bool:
        roll = self.dice.roll()
        new_pos = player.position + roll
        if new_pos > self.board.size:
            return False  # overshoot, stay put — no win yet
        player.position = self.board.resolve(new_pos)
        return player.position == self.board.size
```

---

## 4. Drill 3: Tic-Tac-Toe Deep Dive

Lesson 1 covered the full 7-step build. Here we go one level deeper on two things interviewers commonly probe: the win-detection algorithm's efficiency, and generalizing to an NxN board.

### Win-Detection Algorithm

The naive approach re-scans the whole board every move (rows + columns + 2 diagonals = O(n) lines of O(n) each = O(n²) per move). For small boards (3x3) this is completely fine and is what you should default to in an interview — don't over-engineer.

```python
def check_winner_naive(grid: list[list], size: int, symbol) -> bool:
    for i in range(size):
        if all(grid[i][j] == symbol for j in range(size)):      # row i
            return True
        if all(grid[j][i] == symbol for j in range(size)):      # column i
            return True
    if all(grid[i][i] == symbol for i in range(size)):          # main diagonal
        return True
    if all(grid[i][size - 1 - i] == symbol for i in range(size)):  # anti-diagonal
        return True
    return False
```

**If asked to optimize** (common follow-up: "what if the board is 1000x1000 and you need win-detection after every move?"): maintain running counters instead of rescanning.

```python
class OptimizedWinTracker:
    """O(1) win check per move by maintaining running tallies,
    instead of O(n) rescans of the affected row/col/diagonal."""

    def __init__(self, size: int):
        self.size = size
        self.row_count = [{} for _ in range(size)]     # row_count[r][symbol] = count
        self.col_count = [{} for _ in range(size)]
        self.diag_count = {}
        self.anti_diag_count = {}

    def place(self, row: int, col: int, symbol) -> bool:
        n = self.size
        self.row_count[row][symbol] = self.row_count[row].get(symbol, 0) + 1
        self.col_count[col][symbol] = self.col_count[col].get(symbol, 0) + 1
        if row == col:
            self.diag_count[symbol] = self.diag_count.get(symbol, 0) + 1
        if row + col == n - 1:
            self.anti_diag_count[symbol] = self.anti_diag_count.get(symbol, 0) + 1

        return (
            self.row_count[row][symbol] == n
            or self.col_count[col][symbol] == n
            or self.diag_count.get(symbol, 0) == n
            or self.anti_diag_count.get(symbol, 0) == n
        )
```

This turns the win check from O(n) into O(1) per move — a strong answer when the interviewer pushes on scale.

### Extensibility to NxN

The only real changes needed versus the 3x3 version in Lesson 1:
- `Board.__init__(self, size)` — already parameterized (see Lesson 1's skeleton).
- Win condition generalizes automatically since loops already run over `range(self.size)`.
- The **win length** might differ from the board size for large boards (e.g., "5 in a row on a 15x15 board" — Gomoku). If so, add a `win_length` parameter separate from `size`, and check sliding windows of length `win_length` along each direction instead of the full line. This is the natural "what if requirements changed" follow-up — mention it proactively.

---

## 5. Drill 4: Vending Machine (Command-Style)

**Prompt:** "Design a simple vending machine: select an item, insert money, dispense, return change."

This drill is intentionally stateless-ish at the class level (no complex State Machine required for the simple version) to contrast with more complex prompts — each user action maps to a small **Command**-style object, which keeps `VendingMachine` from becoming a God class of `if/elif` on action type.

### Class List

| Class | Role |
|-------|------|
| `Item` | `name`, `price`, `stock` |
| `Inventory` | Maps item code → `Item` |
| `VendingMachine` | Holds `Inventory`, current balance, exposes `insert_coin()`, `select_item()`, `dispense()` |
| `Transaction` (optional) | Encapsulates one purchase for logging/refund |

### Key Decision

**Keep actions as simple methods first — don't force a full State pattern for a machine this simple.** A common overreach is designing an elaborate `IdleState`/`HasMoneyState`/`DispensingState` class hierarchy for what is fundamentally three sequential method calls. Reach for **State** only if the interviewer adds real branching behavior (e.g., "machine can be OUT_OF_SERVICE," "different behavior when out of stock vs out of change") — narrate that trade-off rather than defaulting to the heaviest pattern available.

### Code Skeleton

```python
class Item:
    def __init__(self, name: str, price: int, stock: int):
        self.name = name
        self.price = price
        self.stock = stock


class OutOfStockError(Exception):
    pass


class InsufficientPaymentError(Exception):
    pass


class VendingMachine:
    def __init__(self, inventory: dict[str, Item]):
        self.inventory = inventory
        self.balance = 0

    def insert_coin(self, amount: int) -> None:
        self.balance += amount

    def select_item(self, code: str) -> Item:
        item = self.inventory[code]
        if item.stock <= 0:
            raise OutOfStockError(item.name)
        if self.balance < item.price:
            raise InsufficientPaymentError(f"Need {item.price - self.balance} more")
        return item

    def dispense(self, code: str) -> tuple[Item, int]:
        item = self.select_item(code)
        item.stock -= 1
        change = self.balance - item.price
        self.balance = 0
        return item, change
```

---

## 6. Drill 5: Extensible Calculator (Strategy)

**Prompt:** "Design a calculator that supports add/subtract/multiply/divide, and should be easy to extend with new operations later."

### Class List

| Class | Role |
|-------|------|
| `Operation` (abstract) | Interface: `execute(a, b) -> float` |
| `Add`, `Subtract`, `Multiply`, `Divide` | Concrete strategies |
| `Calculator` | Holds a registry of `{symbol: Operation}`, exposes `compute(a, op_symbol, b)` |

### Key Decision

**Strategy pattern, keyed by a registry, instead of `if/elif` on operator symbol.** The naive version is `if op == "+": return a + b elif op == "-": ...`, which violates Open/Closed — every new operation requires editing `Calculator`. Instead, each operation is its own class implementing a common interface, and `Calculator` just looks it up in a dict and delegates. Adding `Power` or `Modulo` later means writing one new class and one registry line — `Calculator.compute()` itself never changes.

### Code Skeleton

```python
from abc import ABC, abstractmethod


class Operation(ABC):
    @abstractmethod
    def execute(self, a: float, b: float) -> float:
        ...


class Add(Operation):
    def execute(self, a, b):
        return a + b


class Subtract(Operation):
    def execute(self, a, b):
        return a - b


class Multiply(Operation):
    def execute(self, a, b):
        return a * b


class Divide(Operation):
    def execute(self, a, b):
        if b == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        return a / b


class Calculator:
    def __init__(self):
        self._operations: dict[str, Operation] = {
            "+": Add(), "-": Subtract(), "*": Multiply(), "/": Divide(),
        }

    def register_operation(self, symbol: str, operation: Operation) -> None:
        # Extensibility hook: new ops plug in without touching compute().
        self._operations[symbol] = operation

    def compute(self, a: float, symbol: str, b: float) -> float:
        if symbol not in self._operations:
            raise ValueError(f"Unsupported operation: {symbol}")
        return self._operations[symbol].execute(a, b)


# Extending later requires zero changes above this line:
class Power(Operation):
    def execute(self, a, b):
        return a ** b

calc = Calculator()
calc.register_operation("^", Power())
```

---

## 7. Interview Q&A

**Q: In Chess, why put `get_valid_moves()` on each `Piece` subclass instead of one big method on `Board`?**
Answer: Each piece type has fundamentally different movement rules, so a single method would need a large `if/elif` on piece type — a direct Open/Closed violation. Putting `get_valid_moves()` on each `Piece` subclass lets `Board`/`Game` call it polymorphically without knowing the concrete type, and adding a new piece variant never touches existing code.

**Q: In Snake and Ladder, why represent both snakes and ladders as one `jumps` dictionary instead of separate `Snake` and `Ladder` classes with their own logic?**
Answer: Functionally, both are "landing on cell A teleports you to cell B" — the direction is just a data difference (head > tail for a snake, top > bottom for a ladder), not a behavioral one. Unifying them into one `start -> end` lookup means the game loop has one code path (`board.resolve(position)`) instead of type-checking which kind of entity occupies a cell, and it extends cleanly to future "jump" mechanics like teleporters.

**Q: For Tic-Tac-Toe on a large NxN board with frequent moves, how would you make win-detection faster than rescanning the whole board?**
Answer: Maintain running counters per row, column, and both diagonals, incrementing the relevant counters on each `place()` call and checking if any counter hits `n` (the board size). This reduces the win check from O(n) per move (rescanning a line) to O(1) per move, at the cost of O(n) extra memory for the counters.

**Q: Why does the Vending Machine drill avoid the State pattern even though "the machine is in different states" sounds like a textbook State use case?**
Answer: The simple version's actions are a straightforward sequential flow (insert coin, select, dispense) with no real branching in *how* an action behaves based on machine mode — introducing a full State hierarchy (`IdleState`, `DispensingState`, etc.) for that adds ceremony without payoff. State becomes justified once there's genuinely different behavior per mode, e.g., an `OutOfServiceState` that rejects all coins, or a `NoChangeState` that blocks purchases needing change — at that point the pattern earns its complexity.

**Q: Why does the Calculator drill use a `dict[str, Operation]` registry instead of a `match`/`if` chain, given only 4 operations exist today?**
Answer: The requirement explicitly says "easy to extend with new operations later," which is the symptom that maps to Strategy — even with only 4 operations today, the registry means `Calculator.compute()` never needs to change when a 5th operation is added; you just implement one new `Operation` subclass and register it. Using an `if/elif` chain would work identically for 4 operations but violates Open/Closed the moment a 5th is requested.
