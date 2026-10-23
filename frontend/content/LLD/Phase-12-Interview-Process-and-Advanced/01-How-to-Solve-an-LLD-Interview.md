# How to Solve an LLD Interview — Complete Guide

## Table of Contents
1. [Why a Framework Beats Improvisation](#1-why-a-framework-beats-improvisation)
2. [Step 1 — Clarify Requirements](#2-step-1--clarify-requirements)
3. [Step 2 — Identify Entities and Classes](#3-step-2--identify-entities-and-classes)
4. [Step 3 — Define Relationships](#4-step-3--define-relationships)
5. [Step 4 — Assign Responsibilities](#5-step-4--assign-responsibilities)
6. [Step 5 — Apply SOLID Principles](#6-step-5--apply-solid-principles)
7. [Step 6 — Apply Design Patterns](#7-step-6--apply-design-patterns)
8. [Step 7 — Explain Extensibility](#8-step-7--explain-extensibility)
9. [Worked Example: Tic-Tac-Toe End-to-End](#9-worked-example-tic-tac-toe-end-to-end)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why a Framework Beats Improvisation

Most candidates fail LLD interviews not because they don't know OOP or patterns, but because they **jump straight to code** with an unclear model, then have to backtrack mid-interview when the interviewer adds a twist ("now support undo" / "now support 3 players" / "now this needs to scale to N warehouses"). A repeatable framework prevents this:

```
Bad flow:                          Good flow:
  Hear prompt                        Hear prompt
  → start typing class Game:         → 2-4 min: clarify scope & scale
  → realize missing a class          → 2 min: extract nouns → classes
  → realize wrong relationship       → 1 min: draw relationships
  → refactor under time pressure     → 1 min: assign responsibilities
  → run out of time                  → mental SOLID + pattern check
                                      → code confidently, narrate as you go
                                      → close with extensibility remarks
```

The framework has exactly **7 steps**. You don't need to announce them by number to the interviewer, but internally, always march through them in order.

```
1. Clarify requirements
2. Identify entities/classes
3. Define relationships
4. Assign responsibilities
5. Apply SOLID principles
6. Apply design patterns where they fit
7. Explain extensibility
```

Budget roughly: 15% clarify, 15% modeling (steps 2-4), 5% principle/pattern check, 55% coding, 10% extensibility/wrap-up — for a 45-minute slot that's about 7 min clarify, 7 min model, 3 min check, 22-25 min code, 4-5 min wrap-up.

---

## 2. Step 1 — Clarify Requirements

**Never start designing on an ambiguous prompt.** "Design a parking lot" or "design tic-tac-toe" is deliberately underspecified — the interviewer wants to see if you ask good questions before assuming.

### What to Ask, and Why

| Category | Sample questions | Why it matters |
|----------|------------------|-----------------|
| **Scope** | "Should I design just the core engine, or also persistence / API / UI?" | Prevents wasted time modeling things out of scope (e.g., a REST layer when only the domain model is wanted). |
| **Must-have vs nice-to-have** | "Is multiplayer over network in scope, or just local two-player?" | Lets you sequence your build — get the must-haves working first, mention nice-to-haves as "I'd extend it like this." |
| **Scale** | "How many concurrent games/users? Single process or distributed?" | Changes whether you need thread-safety, a database, or can keep everything in memory. A single-node parking lot look very different from a multi-location one. |
| **Actors/users** | "Who interacts with this system — one admin, many end users, a scheduler?" | Determines whether you need auth/roles as classes or can ignore them. |
| **Edge cases** | "What happens on a tie? On an invalid move? On concurrent access to the same seat?" | Surfaces business rules early instead of discovering them mid-code. |
| **Extensibility hints** | "Is this a fixed 3x3 board or should it generalize?" | Tells you whether to hardcode or design for open extension (Step 7 material). |

### A Simple Script

If you don't know what to ask, use this generic script for almost any LLD prompt:

```
1. "What's the core use case I should optimize the design for?"
2. "Are there features I should explicitly leave out of scope?"
3. "What scale are we talking — single machine, single process, or
    do I need to think about concurrency/persistence?"
4. "Any specific edge cases you want me to handle?"
```

Four questions, under two minutes, and you walk away with a scoped problem instead of guessing.

---

## 3. Step 2 — Identify Entities and Classes

### Noun Extraction Technique

Take the requirements you just clarified and **underline every noun**. Nouns are candidate classes; verbs attached to those nouns are candidate methods.

```
"Two players take turns placing their marks (X or O) on a 3x3 board.
 The game ends when a player gets three in a row, or the board is full (draw)."

Nouns:      Players, marks (X/O), board, game
Verbs:      take turns, place mark, ends, gets three in a row, is full

Candidate classes: Player, Mark/Symbol, Board, Game
Candidate methods: Board.place_mark(), Board.is_full(), Game.check_winner()
```

### Filtering Nouns

Not every noun becomes a class. Filter using these rules:

| Keep as a class if... | Discard / demote if... |
|------------------------|--------------------------|
| It has its own state + behavior | It's just an attribute (e.g., "mark" might just be a string/enum, not a class) |
| Multiple instances exist with independent lifecycles (Player, Piece) | It's a synonym for something already modeled |
| The domain expert (interviewer) refers to it repeatedly as a "thing" | It only appears once, in passing |
| It changes independently of other objects | It's purely derived/computed (e.g., "winner" is a result, not an entity) |

For Tic-Tac-Toe: `Player`, `Board`, `Game` survive as classes. `Mark` becomes an `Enum` (X, O, EMPTY) rather than a full class — it has no behavior of its own.

---

## 4. Step 3 — Define Relationships

Once you have candidate classes, decide how they connect. Use this decision order:

```
Is B a specialized kind of A?              → Inheritance (A <|-- B)
Does A own B, and B dies when A dies?      → Composition (A *-- B)
Does A use B, but B can outlive A?         → Aggregation (A o-- B)
Does A just call/reference B temporarily?  → Association (A --> B)
```

### Applied to Tic-Tac-Toe

```
Game *-- Board        (composition: Board has no meaning outside its Game;
                        destroy the Game, the Board goes with it)
Game o-- Player        (aggregation: Players exist independently — the same
                        Player object could play another Game next)
Player -- Symbol        (association: a Player is associated with X or O for
                        the duration of one game)
```

```
┌────────────┐        ┌───────────┐
│    Game    │◇──────▶│   Board   │   composition (filled diamond = owns)
│            │        └───────────┘
│            │
│            │◇──────▶┌───────────┐
│            │ (0..2)  │  Player   │   aggregation (hollow diamond = uses)
└────────────┘        └───────────┘
```

Always say the relationship type **out loud** — "Game composes Board because a board has no independent lifecycle" is a strong interview signal that you understand UML, not just syntax.

---

## 5. Step 4 — Assign Responsibilities

This is where many candidates lose points: they get the classes right but stuff all the logic into one "God class" (usually `Game`). Use two classic heuristics from Responsibility-Driven Design (GRASP):

### Information Expert

> Assign a responsibility to the class that has the information needed to fulfill it.

`Board` has the grid → `Board` should own `is_full()` and `get_cell()`, not `Game`.

### Tell, Don't Ask

> Tell an object what to do; don't pull its internal data out and make the decision yourself.

```java
// Bad — Ask (Game reaches into Board's internals)
if (game.getBoard().getGrid()[r][c] != Symbol.EMPTY) {
    throw new InvalidMoveException("Cell already occupied");
}
game.getBoard().getGrid()[r][c] = symbol;

// Good — Tell (Game delegates the decision to Board)
game.getBoard().placeMark(r, c, symbol); // Board validates internally and throws if invalid
```

### Quick "Who Owns This?" Table

| Behavior | Owning class | Why |
|----------|--------------|-----|
| Validate and place a move | `Board` | It owns the grid state (information expert) |
| Check win/draw condition | `Board` (or a `WinChecker`) | Needs full grid access |
| Track whose turn it is | `Game` | It's the orchestrator, not domain state of the board |
| Track player identity/symbol | `Player` | Each player owns their own identity |

A useful mental test: **"If I renamed this method, would it still make sense as a public API of the class I put it on?"** `board.place_mark()` reads naturally; `game.grid[r][c] = x` does not.

---

## 6. Step 5 — Apply SOLID Principles

Before or while coding, run this 10-second mental checklist per class:

| Principle | One-line check |
|-----------|-----------------|
| **S**ingle Responsibility | "Can I describe this class's job in one sentence without using 'and'?" |
| **O**pen/Closed | "If a new variant appears (new piece type, new payment method), do I add a class or edit existing ones?" |
| **L**iskov Substitution | "Can every subclass be used wherever the base class is expected, without surprises?" |
| **I**nterface Segregation | "Am I forcing a class to implement methods it doesn't need?" |
| **D**ependency Inversion | "Does my high-level class depend on an abstraction (interface) or a concrete class?" |

You don't need to cite these by name unprompted, but narrating one or two as you design ("I'm making `WinStrategy` an interface here so we satisfy Open/Closed if new win conditions are added") is a strong senior-level signal.

---

## 7. Step 6 — Apply Design Patterns

Patterns should emerge from the problem, never be forced in. Use this **symptom → pattern** lookup table while designing:

| Symptom in the requirement | Likely pattern | Why |
|------------------------------|-----------------|-----|
| Many `if/elif` branches dispatching on a `type` field | **Factory Method** / **Abstract Factory** | Centralizes object creation, removes type-checking from client code |
| "The algorithm/behavior can vary" (e.g., different payment methods, different pricing rules) | **Strategy** | Swap behavior at runtime via composition instead of conditionals |
| "Notify multiple other parts of the system when X happens" | **Observer** | Decouples the subject from subscribers |
| "An object's behavior changes based on its current status/state" | **State** | Replaces `if self.status == "X"` sprawl with polymorphic state classes |
| "Only one instance should ever exist" (config, logger, connection pool) | **Singleton** | Use sparingly — often better replaced by dependency injection |
| "Build a complex object step by step with optional parts" | **Builder** | Avoids telescoping constructors |
| "Wrap an incompatible interface to match what I need" | **Adapter** | Bridges third-party or legacy interfaces |
| "Add responsibilities to an object dynamically without subclass explosion" | **Decorator** | e.g., coffee add-ons, middleware chains |
| "Undo/redo a sequence of actions" | **Command** | Encapsulate each action as an object with `execute()`/`undo()` |
| "Traverse a collection without exposing its internal structure" | **Iterator** | Standard Python `__iter__`/`__next__` |

For Tic-Tac-Toe specifically: win-checking has multiple independent conditions (rows, columns, diagonals) — a **Strategy**-style list of `WinCondition` checkers is a clean, extensible fit (see worked example below).

---

## 8. Step 7 — Explain Extensibility

Interviewers routinely follow up with "now what if requirement X changes?" — the strongest candidates **preempt this** by narrating extensibility before being asked, in one or two sentences at natural pauses.

### Template

> "If \[future requirement\] changed, I'd extend this by \[specific change\], and I wouldn't need to touch \[existing class\] because of \[SOLID principle / pattern\]."

### Examples

| Future change | How you'd extend | Why it's cheap |
|----------------|---------------------|------------------|
| Board size 3x3 → NxN | Make `size` a constructor parameter on `Board`; generalize win-check loops | No new classes — `Board` was already parameterized correctly |
| Tic-Tac-Toe → Connect-4 (gravity-drop moves) | Swap `Board.place_mark(row, col)` for a `Board.drop(col)` that computes the landing row | Isolated to `Board`; `Game`/`Player` untouched |
| Add an AI opponent | Introduce a `Player` subclass (`AIPlayer`) that overrides `get_move()` | Liskov-safe because `Game` only calls `Player.get_move()` polymorphically |
| Add online multiplayer | Extract move input behind a `MoveSource` interface; `Game` calls `move_source.get_move()` instead of reading stdin directly | Dependency Inversion — `Game` never depended on the concrete input mechanism |

Ending your solution with 2-3 of these remarks, unprompted, is one of the highest-leverage things you can do in the last few minutes of an interview.

---

## 9. Worked Example: Tic-Tac-Toe End-to-End

Let's run all 7 steps live, as you would out loud in an interview.

### Step 1 — Clarify

- "Is this a standard 3x3 board, two human players, local (not networked)?" → Yes.
- "Do I need a full UI, or just the game engine with a simple way to feed moves in?" → Just the engine; console I/O is fine.
- "Should I design for future board-size changes?" → "Good question, I'll keep the board size configurable anyway since it costs nothing."

### Step 2 — Entities

Nouns: Player, Board, Game, Symbol (X/O), Cell/Position, win condition.
Classes: `Player`, `Board`, `Game`. `Symbol` → `Enum`. Position → plain `(row, col)` tuple, not a class (no behavior).

### Step 3 — Relationships

```
Game *-- Board            (composition)
Game o-- Player (2)       (aggregation)
Board -- Symbol            (association, via grid cells)
```

### Step 4 — Responsibilities

- `Board`: owns grid, `place_mark()`, `is_full()`, `check_winner()`.
- `Player`: owns `name`, `symbol`.
- `Game`: orchestrates turn order, asks the current player for a move, delegates validation to `Board`, declares the result.

### Step 5 — SOLID check

- SRP: `Board` only knows about grid state; `Game` only knows about turn flow. Good.
- OCP: win-checking implemented as a list of checkable line-generators so a board-size change doesn't require rewriting the win logic.

### Step 6 — Patterns

Win-checking has multiple independent "lines to check" (rows, columns, diagonals) — model each as a callable/strategy so adding a new win condition (e.g., corner-squares variant) doesn't change `Board.check_winner()`.

### Step 7 — Extensibility (narrated while coding, see comments below)

### Code

```java
import java.util.*;

public enum Symbol {
    EMPTY(" "),
    X("X"),
    O("O");

    private final String value;
    Symbol(String value) { this.value = value; }
    public String getValue() { return value; }
}

public class Move {
    private final int row;
    private final int col;

    public Move(int row, int col) {
        this.row = row;
        this.col = col;
    }

    public int getRow() { return row; }
    public int getCol() { return col; }
}

public class Player {
    private final String name;
    private final Symbol symbol;
    private final Scanner scanner = new Scanner(System.in);

    public Player(String name, Symbol symbol) {
        this.name = name;
        this.symbol = symbol;
    }

    public Move getMove() {
        // Extensibility: an AIPlayer subclass could override this method
        // to compute a move instead of reading input — Game never changes.
        System.out.print(name + " (" + symbol.getValue() + "), enter 'row col': ");
        int row = scanner.nextInt();
        int col = scanner.nextInt();
        return new Move(row, col);
    }

    public String getName() { return name; }
    public Symbol getSymbol() { return symbol; }
}

public class InvalidMoveException extends RuntimeException {
    public InvalidMoveException(String message) {
        super(message);
    }
}

public class Board {
    private final int size;
    private final Symbol[][] grid;

    public Board(int size) {
        // Extensibility: size is parameterized so NxN boards need zero
        // changes to this class beyond passing a different size.
        this.size = size;
        this.grid = new Symbol[size][size];
        for (int i = 0; i < size; i++) {
            Arrays.fill(grid[i], Symbol.EMPTY);
        }
    }

    public Board() {
        this(3);
    }

    public void placeMark(int row, int col, Symbol symbol) {
        if (row < 0 || row >= size || col < 0 || col >= size) {
            throw new InvalidMoveException("Out of bounds");
        }
        if (grid[row][col] != Symbol.EMPTY) {
            throw new InvalidMoveException("Cell already occupied");
        }
        grid[row][col] = symbol;
    }

    public boolean isFull() {
        for (int r = 0; r < size; r++) {
            for (int c = 0; c < size; c++) {
                if (grid[r][c] == Symbol.EMPTY) return false;
            }
        }
        return true;
    }

    private List<List<Symbol>> getLines() {
        List<List<Symbol>> lines = new ArrayList<>();
        // Rows
        for (int r = 0; r < size; r++) {
            lines.add(Arrays.asList(grid[r]));
        }
        // Columns
        for (int c = 0; c < size; c++) {
            List<Symbol> col = new ArrayList<>();
            for (int r = 0; r < size; r++) {
                col.add(grid[r][c]);
            }
            lines.add(col);
        }
        // Main diagonal
        List<Symbol> diag1 = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            diag1.add(grid[i][i]);
        }
        lines.add(diag1);
        // Anti-diagonal
        List<Symbol> diag2 = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            diag2.add(grid[i][size - 1 - i]);
        }
        lines.add(diag2);
        return lines;
    }

    public Optional<Symbol> checkWinner() {
        for (List<Symbol> line : getLines()) {
            Symbol first = line.get(0);
            if (first != Symbol.EMPTY && line.stream().allMatch(s -> s == first)) {
                return Optional.of(first);
            }
        }
        return Optional.empty();
    }

    public void display() {
        for (int r = 0; r < size; r++) {
            List<String> rowSymbols = new ArrayList<>();
            for (int c = 0; c < size; c++) {
                rowSymbols.add(grid[r][c].getValue());
            }
            System.out.println(String.join(" | ", rowSymbols));
        }
    }

    public int getSize() { return size; }
}

public class Game {
    private final Board board;
    private final List<Player> players;

    public Game(Player player1, Player player2, int boardSize) {
        this.board = new Board(boardSize);
        this.players = List.of(player1, player2);
    }

    public Game(Player player1, Player player2) {
        this(player1, player2, 3);
    }

    public void play() {
        int turn = 0;
        while (true) {
            Player current = players.get(turn % 2);
            board.display();
            Move move = current.getMove();
            try {
                board.placeMark(move.getRow(), move.getCol(), current.getSymbol());
            } catch (InvalidMoveException e) {
                System.out.println("Invalid move: " + e.getMessage());
                continue;
            }

            Optional<Symbol> winner = board.checkWinner();
            if (winner.isPresent()) {
                board.display();
                System.out.println(current.getName() + " wins!");
                return;
            }
            if (board.isFull()) {
                board.display();
                System.out.println("Draw!");
                return;
            }
            turn++;
        }
    }

    public static void main(String[] args) {
        Game game = new Game(new Player("Alice", Symbol.X), new Player("Bob", Symbol.O));
        game.play();
    }
}
```

**Closing remarks to the interviewer** (Step 7, restated at the end): "This generalizes to NxN by just passing a different `size`; adding an AI player only requires subclassing `Player` and overriding `get_move()`; and win conditions are open for extension via `_lines()` without touching `check_winner()`."

---

## 10. Interview Q&A

**Q: An interviewer gives you a one-sentence prompt like "design a vending machine." What's the very first thing you should do?**
Answer: Ask 3-4 clarifying questions before writing anything — scope (just the dispensing logic, or also payment/inventory refill?), scale (single machine or a fleet?), must-haves vs nice-to-haves (exact change, card payment, refunds), and key edge cases (out of stock, insufficient payment). This takes under two minutes and prevents building the wrong thing.

**Q: How do you decide whether a noun in the requirements becomes a full class or just an attribute/enum?**
Answer: Promote a noun to a class if it has its own state *and* behavior, or multiple independent instances exist. Demote it to an attribute or `Enum` if it's just a value with no behavior of its own — e.g., a tic-tac-toe "mark" (X/O) is an `Enum`, not a class, because it never does anything on its own.

**Q: What's the difference between composition and aggregation, and why does it matter in an interview?**
Answer: Composition means the child's lifecycle is bound to the parent's — destroy the parent, the child goes away (Game and its Board). Aggregation means the child can exist independently and outlive the parent (Game and its Players — the same Player plays many games). Stating this out loud during modeling shows the interviewer you understand UML semantics, not just syntax, and it directly affects how you'd write constructors (owned objects are usually created inside the owner; aggregated objects are usually passed in).

**Q: How do you decide who "owns" a piece of behavior when multiple classes could plausibly host it?**
Answer: Use Information Expert — give the responsibility to the class that already holds the data needed to fulfill it (e.g., `Board` owns `is_full()` because it owns the grid). Cross-check with Tell-Don't-Ask — if calling code needs to reach into another object's internals to make a decision, that logic belongs inside that object instead.

**Q: Should you always try to fit a design pattern into your solution?**
Answer: No — patterns should emerge from a symptom in the requirements (e.g., "behavior varies" → Strategy, "type-based branching" → Factory), never be forced in to show you know pattern names. Using patterns you weren't lucky enough to have a genuine symptom for tends to hurt more than help, since interviewers will probe "why this pattern specifically?" and a fabricated justification is easy to spot.

**Q: What should you do in the last few minutes if you have time left after finishing the code?**
Answer: Proactively narrate extensibility — pick 2-3 plausible future requirement changes and explain in one sentence each how your design would absorb them and why (which class changes, which stays untouched, which principle/pattern makes that possible). This preempts follow-up questions and is one of the strongest signals of senior-level design thinking.
