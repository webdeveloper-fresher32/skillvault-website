# 🧠 The Ultimate Guide to Memento Pattern (LLD)

> **Core Philosophy:** *Without violating encapsulation, capture and externalize an object's internal state so that the object can be restored to this state later.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [Encapsulation vs Snapshotting](#2-encapsulation-vs-snapshotting)
3. [The Core Architecture (The 3 Participants)](#3-the-core-architecture-the-3-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Save & Restore Operations](#6-execution-flow-save--restore-operations)
7. [Side-by-Side Comparison: Exposing Getters vs Memento](#7-side-by-side-comparison-exposing-getters-vs-memento)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Video Game Checkpoint / Save Game System 🎮 💾
Imagine building a dark fantasy RPG (like Dark Souls or Elden Ring). Before walking into a dangerous Boss Arena, the player reaches a **Bonfire Checkpoint**:
* The player's state contains: `healthPoints`, `mana`, `level`, and `inventoryItems`.
* When the boss defeats the player, the game must restore the player's exact stats back to the Bonfire Checkpoint.

```
                      PLAYER FIGHTING BOSS
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   Bonfire Checkpoint (Save)              Defeated by Boss (Die)
   • HP: 100%, Mana: 100%                 • HP: 0% ☠️
   • State saved in Memento               • RESTORE back to Bonfire!
```

---

## 2. Encapsulation vs Snapshotting

### ❌ The Antipattern: Exposing Private State
To save the player's state, an external `GameSaver` class reads:
```java
saver.save(player.getHealth(), player.getMana(), player.getPrivateInventoryKey());
```
* **Violates Encapsulation:** Making internal private fields public or exposing them through getters leaks secret implementation details.
* Any change to `Player`'s internal data structure breaks the external saving mechanism.

### ✅ The Memento Solution: The Black Box
The `Player` creates an opaque, immutable **Memento** object. The external `Caretaker` (History Manager) can store the Memento, but **cannot inspect or modify its contents**! Only the `Player` has access to restore from it.

---

## 3. The Core Architecture (The 3 Participants)

```
┌──────────────────────────────────────┐
│ Originator (Player)                  │
│ Creates snapshots & restores itself  │
├──────────────────────────────────────┤
│ - health : int                       │
│ - mana : int                         │
├──────────────────────────────────────┤
│ + save() : Memento                   │──────┐ creates
│ + restore(m: Memento)                │      │
└──────────────────────────────────────┘      ▼
                                       ┌──────────────────────────────────────┐
┌──────────────────────────────────────┐│ Memento (Immutable Snapshot)        │
│ Caretaker (GameCheckpointManager)    │├──────────────────────────────────────┤
│ Stores history stack of mementos     ││ - state details (private/immutable)  │
├──────────────────────────────────────┤└──────────────────▲───────────────────┘
│ - history : Stack<Memento>           │                   │
├──────────────────────────────────────┤                   │
│ + saveCheckpoint(m: Memento)         │───────────────────┘ stores opaque box
│ + undoCheckpoint() : Memento         │
└──────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Immutable Memento (Opaque Snapshot)

```java
public class PlayerMemento {
    // Immutable private state snapshot
    private final int health;
    private final int mana;
    private final int currentLevel;

    // Package-private constructor: Only Originator should instantiate
    PlayerMemento(int health, int mana, int currentLevel) {
        this.health = health;
        this.mana = mana;
        this.currentLevel = currentLevel;
    }

    // Package-private getters: Caretaker CANNOT tamper with these
    int getHealth() { return health; }
    int getMana() { return mana; }
    int getCurrentLevel() { return currentLevel; }
}
```

---

### Step 2: The Originator (Player Character)

```java
public class Player {
    private int health;
    private int mana;
    private int level;

    public Player(int health, int mana, int level) {
        this.health = health;
        this.mana = mana;
        this.level = level;
    }

    public void takeDamage(int damage) {
        this.health = Math.max(0, this.health - damage);
        System.out.println("💥 Player took " + damage + " damage! Current HP: " + this.health);
    }

    // Create snapshot (Save)
    public PlayerMemento saveState() {
        System.out.println("💾 Checkpoint created: HP=" + health + ", Mana=" + mana + ", Level=" + level);
        return new PlayerMemento(this.health, this.mana, this.level);
    }

    // Restore snapshot (Load)
    public void restoreState(PlayerMemento memento) {
        this.health = memento.getHealth();
        this.mana = memento.getMana();
        this.level = memento.getCurrentLevel();
        System.out.println("🔄 Player restored from checkpoint! HP: " + health + ", Mana: " + mana);
    }

    @Override
    public String toString() {
        return "Player [HP=" + health + ", Mana=" + mana + ", Level=" + level + "]";
    }
}
```

---

### Step 3: The Caretaker (Checkpoint History Manager)

```java
import java.util.Stack;

public class CheckpointHistory {
    private final Stack<PlayerMemento> checkpoints = new Stack<>();

    public void addCheckpoint(PlayerMemento memento) {
        checkpoints.push(memento);
    }

    public PlayerMemento getLatestCheckpoint() {
        if (checkpoints.isEmpty()) {
            throw new IllegalStateException("No checkpoints saved!");
        }
        return checkpoints.pop();
    }
}
```

---

### Step 4: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        CheckpointHistory checkpointManager = new CheckpointHistory();

        // 1. Initial State at Bonfire
        Player hero = new Player(100, 50, 10);
        System.out.println("Starting Game: " + hero);

        // 2. Save Bonfire Checkpoint
        checkpointManager.addCheckpoint(hero.saveState());

        // 3. Player Enters Boss Room & takes fatal damage
        System.out.println("\n⚔️ --- FIGHTING THE DRAGON BOSS ---");
        hero.takeDamage(70);
        hero.takeDamage(30); // Dies! HP = 0
        System.out.println("Player Died! Current: " + hero);

        // 4. Respawn by restoring from Bonfire
        System.out.println("\n🔥 --- RESPAWNING AT BONFIRE ---");
        hero.restoreState(checkpointManager.getLatestCheckpoint());
        System.out.println("Restored Hero: " + hero);
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│                    Player                    │
├──────────────────────────────────────────────┤
│ - health, mana, level : int                  │
├──────────────────────────────────────────────┤
│ + saveState() : PlayerMemento                │
│ + restoreState(m: PlayerMemento)             │
└──────────────────────┬───────────────────────┘
                       │ creates / restores from
                       ▼
┌──────────────────────────────────────────────┐
│                 PlayerMemento                │◄─────────────────────┐
├──────────────────────────────────────────────┤                      │
│ - health, mana, level : int (final)          │                      │
├──────────────────────────────────────────────┤                      │
│ ~ package-private getters()                  │                      │
└──────────────────────────────────────────────┘                      │
                                                                      │ stores in stack
┌──────────────────────────────────────────────┐                      │
│              CheckpointHistory               │                      │
├──────────────────────────────────────────────┤                      │
│ - checkpoints : Stack<PlayerMemento>         │──────────────────────┘
├──────────────────────────────────────────────┤
│ + addCheckpoint(m: PlayerMemento)            │
│ + getLatestCheckpoint() : PlayerMemento      │
└──────────────────────────────────────────────┘
```

---

## 6. Execution Flow: Save & Restore Operations

```
1. hero.saveState()
   └─► Returns new PlayerMemento(HP=100, Mana=50, Level=10)
   └─► CheckpointHistory pushes memento to Stack

2. hero takes damage ──► HP changes to 0

3. hero.restoreState(checkpointHistory.getLatestCheckpoint())
   └─► Pops latest PlayerMemento
   └─► Copies (100, 50, 10) back into hero's private fields
   ▼
Hero is fully restored with zero internal fields leaked!
```

---

## 7. Side-by-Side Comparison: Exposing Getters vs Memento

| Metric | ❌ Public Setters/Getters | ✅ Memento Pattern |
| :--- | :--- | :--- |
| **Encapsulation** | Destroyed; private state exposed to the world. | Strictly preserved; memento is an opaque box. |
| **Tampering** | Outside classes can mutate saved state. | Memento is immutable; cannot be modified. |
| **Maintenance** | Changing a field requires rewriting all savers. | Only modify Originator & Memento. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* You want to produce snapshots of the object's state to be able to restore a previous state of the object.
* When direct access to the object's fields/getters/setters violates its encapsulation.

### ❌ When NOT to USE
* When state objects are massive in RAM, and users save checkpoints frequently (will cause memory exhaustion).
* When state is trivial or already tracked via event sourcing.

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* Produces clean snapshots without violating encapsulation.
* Simplifies the originator's code by letting the caretaker maintain the history of snapshots.

### 🔴 Disadvantages
* High memory consumption if clients create mementos too often.
* Caretakers should track the originator's lifecycle to be able to destroy obsolete mementos.

---

## 10. Real-World Everyday Examples

| Domain | Originator | Memento | Caretaker |
| :--- | :--- | :--- | :--- |
| 🎮 **Gaming** | `GamePlayer` | `SaveFile` / `SaveSlot` | `SaveLoadManager` |
| 🗄️ **Database Transactions** | `DatabaseTransaction` | `Savepoint` (`ROLLBACK TO SAVEPOINT`) | `TransactionManager` |
| 🎨 **Photoshop / Canvas** | `ImageCanvas` | `CanvasSnapshot` | History Panel |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Originator (Creates & Restores)} + \text{Immutable Memento (Opaque Data)} + \text{Caretaker (History Stack)} = \mathbf{Memento\ Pattern}$$
