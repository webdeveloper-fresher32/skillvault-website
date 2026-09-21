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

```java
import java.util.*;

public enum Color {
    WHITE,
    BLACK
}

public record Position(int row, int col) {}

public abstract class Piece {
    private final Color color;

    public Piece(Color color) {
        this.color = color;
    }

    public Color getColor() { return color; }

    /** Each subclass computes its own legal destination squares. */
    public abstract List<Position> getValidMoves(Board board, Position position);
}

public class Knight extends Piece {
    private static final int[][] DELTAS = {
        {-2, -1}, {-2, 1}, {2, -1}, {2, 1},
        {-1, -2}, {-1, 2}, {1, -2}, {1, 2}
    };

    public Knight(Color color) {
        super(color);
    }

    @Override
    public List<Position> getValidMoves(Board board, Position position) {
        List<Position> moves = new ArrayList<>();
        for (int[] d : DELTAS) {
            Position next = new Position(position.row() + d[0], position.col() + d[1]);
            if (board.isOnBoard(next) && board.isLandable(next, getColor())) {
                moves.add(next);
            }
        }
        return moves;
    }
}

public class Pawn extends Piece {
    public Pawn(Color color) {
        super(color);
    }

    @Override
    public List<Position> getValidMoves(Board board, Position position) {
        // Direction depends on color; capture vs forward-move logic differs.
        return Collections.emptyList(); // drill skeleton
    }
}

public class Board {
    private final Map<Position, Piece> grid = new HashMap<>();

    public boolean isOnBoard(Position pos) {
        return pos.row() >= 0 && pos.row() < 8 && pos.col() >= 0 && pos.col() < 8;
    }

    public boolean isLandable(Position pos, Color color) {
        Piece occupant = grid.get(pos);
        return occupant == null || occupant.getColor() != color;
    }

    public void movePiece(Position from, Position to) {
        Piece piece = grid.remove(from);
        if (piece != null) {
            grid.put(to, piece);
        }
    }
}

public class Player {
    private final Color color;

    public Player(Color color) {
        this.color = color;
    }

    public Color getColor() { return color; }
}
```


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

```java
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

public class Dice {
    public int roll() {
        return ThreadLocalRandom.current().nextInt(1, 7);
    }
}

public class Board {
    private final int size;
    private final Map<Integer, Integer> jumps = new HashMap<>(); // startCell -> endCell, covers snakes AND ladders

    public Board(int size) {
        this.size = size;
    }

    public Board() {
        this(100);
    }

    public void addSnake(int head, int tail) {
        if (head <= tail) throw new IllegalArgumentException("Snake head must be greater than tail");
        jumps.put(head, tail);
    }

    public void addLadder(int bottom, int top) {
        if (top <= bottom) throw new IllegalArgumentException("Ladder top must be greater than bottom");
        jumps.put(bottom, top);
    }

    public int resolve(int position) {
        return jumps.getOrDefault(position, position);
    }

    public int getSize() { return size; }
}

public class Player {
    private final String name;
    private int position = 0;

    public Player(String name) {
        this.name = name;
    }

    public String getName() { return name; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}

public class Game {
    private final Board board;
    private final List<Player> players;
    private final Dice dice = new Dice();

    public Game(Board board, List<Player> players) {
        this.board = board;
        this.players = players;
    }

    public boolean playTurn(Player player) {
        int roll = dice.roll();
        int newPos = player.getPosition() + roll;
        if (newPos > board.getSize()) {
            return false; // overshoot, stay put — no win yet
        }
        player.setPosition(board.resolve(newPos));
        return player.getPosition() == board.getSize();
    }
}
```

---

## 4. Drill 3: Tic-Tac-Toe Deep Dive

Lesson 1 covered the full 7-step build. Here we go one level deeper on two things interviewers commonly probe: the win-detection algorithm's efficiency, and generalizing to an NxN board.

### Win-Detection Algorithm

The naive approach re-scans the whole board every move (rows + columns + 2 diagonals = O(n) lines of O(n) each = O(n²) per move). For small boards (3x3) this is completely fine and is what you should default to in an interview — don't over-engineer.

```java
public boolean checkWinnerNaive(Symbol[][] grid, int size, Symbol symbol) {
    for (int i = 0; i < size; i++) {
        // row i
        boolean rowWin = true;
        for (int j = 0; j < size; j++) {
            if (grid[i][j] != symbol) { rowWin = false; break; }
        }
        if (rowWin) return true;

        // column i
        boolean colWin = true;
        for (int j = 0; j < size; j++) {
            if (grid[j][i] != symbol) { colWin = false; break; }
        }
        if (colWin) return true;
    }

    // main diagonal
    boolean diagWin = true;
    for (int i = 0; i < size; i++) {
        if (grid[i][i] != symbol) { diagWin = false; break; }
    }
    if (diagWin) return true;

    // anti-diagonal
    boolean antiDiagWin = true;
    for (int i = 0; i < size; i++) {
        if (grid[i][size - 1 - i] != symbol) { antiDiagWin = false; break; }
    }
    return antiDiagWin;
}
```

**If asked to optimize** (common follow-up: "what if the board is 1000x1000 and you need win-detection after every move?"): maintain running counters instead of rescanning.

```java
import java.util.*;

/**
 * O(1) win check per move by maintaining running tallies,
 * instead of O(n) rescans of the affected row/col/diagonal.
 */
public class OptimizedWinTracker {
    private final int size;
    private final List<Map<Symbol, Integer>> rowCount;
    private final List<Map<Symbol, Integer>> colCount;
    private final Map<Symbol, Integer> diagCount = new HashMap<>();
    private final Map<Symbol, Integer> antiDiagCount = new HashMap<>();

    public OptimizedWinTracker(int size) {
        this.size = size;
        this.rowCount = new ArrayList<>(size);
        this.colCount = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            rowCount.add(new HashMap<>());
            colCount.add(new HashMap<>());
        }
    }

    public boolean place(int row, int col, Symbol symbol) {
        int rVal = rowCount.get(row).merge(symbol, 1, Integer::sum);
        int cVal = colCount.get(col).merge(symbol, 1, Integer::sum);

        int dVal = 0;
        if (row == col) {
            dVal = diagCount.merge(symbol, 1, Integer::sum);
        }

        int adVal = 0;
        if (row + col == size - 1) {
            adVal = antiDiagCount.merge(symbol, 1, Integer::sum);
        }

        return rVal == size || cVal == size || dVal == size || adVal == size;
    }
}
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

```java
import java.util.Map;

public record Item(String name, int price, int stock) {
    public Item withDecrementedStock() {
        return new Item(name, price, stock - 1);
    }
}

public class OutOfStockException extends RuntimeException {
    public OutOfStockException(String message) {
        super(message);
    }
}

public class InsufficientPaymentException extends RuntimeException {
    public InsufficientPaymentException(String message) {
        super(message);
    }
}

public class VendingMachine {
    private final Map<String, Item> inventory;
    private int balance = 0;

    public VendingMachine(Map<String, Item> inventory) {
        this.inventory = inventory;
    }

    public synchronized void insertCoin(int amount) {
        this.balance += amount;
    }

    public synchronized Item selectItem(String code) {
        Item item = inventory.get(code);
        if (item == null) {
            throw new IllegalArgumentException("Invalid code: " + code);
        }
        if (item.stock() <= 0) {
            throw new OutOfStockException(item.name());
        }
        if (balance < item.price()) {
            throw new InsufficientPaymentException("Need " + (item.price() - balance) + " more");
        }
        return item;
    }

    public synchronized DispenseResult dispense(String code) {
        Item item = selectItem(code);
        inventory.put(code, item.withDecrementedStock());
        int change = balance - item.price();
        balance = 0;
        return new DispenseResult(item, change);
    }

    public record DispenseResult(Item item, int change) {}
}
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

```java
import java.util.HashMap;
import java.util.Map;

public interface Operation {
    double execute(double a, double b);
}

public class Add implements Operation {
    @Override
    public double execute(double a, double b) {
        return a + b;
    }
}

public class Subtract implements Operation {
    @Override
    public double execute(double a, double b) {
        return a - b;
    }
}

public class Multiply implements Operation {
    @Override
    public double execute(double a, double b) {
        return a * b;
    }
}

public class Divide implements Operation {
    @Override
    public double execute(double a, double b) {
        if (b == 0) {
            throw new ArithmeticException("Cannot divide by zero");
        }
        return a / b;
    }
}

public class Calculator {
    private final Map<String, Operation> operations = new HashMap<>();

    public Calculator() {
        operations.put("+", new Add());
        operations.put("-", new Subtract());
        operations.put("*", new Multiply());
        operations.put("/", new Divide());
    }

    /** Extensibility hook: new ops plug in without touching compute(). */
    public void registerOperation(String symbol, Operation operation) {
        operations.put(symbol, operation);
    }

    public double compute(double a, String symbol, double b) {
        Operation op = operations.get(symbol);
        if (op == null) {
            throw new IllegalArgumentException("Unsupported operation: " + symbol);
        }
        return op.execute(a, b);
    }
}

// Extending later requires zero changes to the classes above:
public class Power implements Operation {
    @Override
    public double execute(double a, double b) {
        return Math.pow(a, b);
    }
}

// Usage:
// Calculator calc = new Calculator();
// calc.registerOperation("^", new Power());
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
