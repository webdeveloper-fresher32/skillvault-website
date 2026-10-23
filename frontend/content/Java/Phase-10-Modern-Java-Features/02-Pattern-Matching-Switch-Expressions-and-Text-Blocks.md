# 02 — Pattern Matching, Switch Expressions and Text Blocks

> A comprehensive reference covering pattern matching for `instanceof`, arrow-style switch expressions and pattern matching for `switch`, and multi-line text blocks — the modern replacements for verbose casts, fallthrough-prone `switch` statements, and manually-escaped strings.

---

## Table of Contents

1. [The Problem: Casts, Fallthrough, and Escaped Strings](#1-the-problem-casts-fallthrough-and-escaped-strings)
2. [The Analogy: A Checkpoint That Hands You a Labeled Badge](#2-the-analogy-a-checkpoint-that-hands-you-a-labeled-badge)
3. [Pattern Matching for instanceof](#3-pattern-matching-for-instanceof)
4. [Switch Expressions and Pattern Matching for switch](#4-switch-expressions-and-pattern-matching-for-switch)
5. [Text Blocks](#5-text-blocks)
6. [Classic Switch vs Switch Expression: Side by Side](#6-classic-switch-vs-switch-expression-side-by-side)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Casts, Fallthrough, and Escaped Strings

Three long-standing rough edges in older Java code all get cleaned up by modern language features covered in this lesson:

- **Checking a type, then casting it, separately.** Before you could safely treat an `Object` as a `String`, you had to check `instanceof` and then write an explicit, separate cast — two steps to do one conceptual thing, and easy to get subtly wrong (checking one type, casting to another) if the code drifts apart during edits.
- **Classic `switch` fallthrough.** Phase 1 covered the classic `switch` statement's *fallthrough* behavior — execution keeps running into the next `case` unless a `break` explicitly stops it — as a common source of bugs. It's easy to add a new `case` in the middle of an existing `switch`, forget the `break`, and silently execute code meant for a completely different case.
- **Multi-line strings needing manual escaping.** Before text blocks, embedding something like a small JSON snippet or SQL query inside Java source meant escaping every `"` and gluing lines together with `\n` and `+`, turning a simple piece of text into a hard-to-read wall of escape characters.

Modern Java addresses all three directly: pattern matching removes the separate cast, switch *expressions* remove fallthrough by construction (while also handing back a value), and text blocks remove the escaping entirely.

---

## 2. The Analogy: A Checkpoint That Hands You a Labeled Badge

**Pattern matching for `instanceof` is a security checkpoint that badges you in the same motion it checks your ID.** The old way: the guard checks your ID matches "Visitor" category, waves you through, and then — as a completely separate second step — you have to go get a visitor badge printed before you can actually do anything. The new way: the same check that confirms "yes, you're a Visitor" hands you the labeled visitor badge immediately, in one motion. Nothing about *what's* being verified changes; the redundant second step disappears.

**A switch expression is the classic `switch` statement with the fall-through footgun removed and an actual answer handed back.** The old `switch` statement was built purely for *side effects* — do this, maybe fall into that, done. A switch expression is built to *produce a value* directly, the way an `if`/`else` expression-like ternary (`condition ? a : b`) already does — and because it's designed around producing one clear value per case, unintentional fallthrough between cases is no longer even possible by default.

---

## 3. Pattern Matching for instanceof

The classic pattern — check the type, then separately cast to that type before using it — looked like this:

```java
Object obj = "hello";

// Old way: check, then cast separately
if (obj instanceof String) {
    String s = (String) obj;   // separate, explicit cast
    System.out.println(s.length());
}
```

Pattern matching for `instanceof` (available since Java 16) lets the `instanceof` check itself declare and bind a variable of the narrower type, directly:

```java
Object obj = "hello";

// Modern way: the check binds the variable for you
if (obj instanceof String s) {
    System.out.println(s.length());   // "s" is already a String here, no cast needed
}
```

`s` is only in scope (and only guaranteed non-null and actually a `String`) inside the branch where the `instanceof` check succeeded — the compiler enforces this, so you can't accidentally use `s` somewhere the check hasn't actually run. This works for any reference type check, not just `String`, and composes naturally with `&&`: `if (obj instanceof String s && !s.isEmpty())` checks the type, binds `s`, and immediately uses it in the same condition.

---

## 4. Switch Expressions and Pattern Matching for switch

A **switch expression** uses `->` instead of `:`, and — critically — each case produces a value directly, with no fallthrough between cases by default:

```java
enum Day { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY }

Day day = Day.SATURDAY;

String dayType = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "Weekday";
    case SATURDAY, SUNDAY -> "Weekend";
};

System.out.println(dayType);   // Weekend
```

Compare that to Phase 1's classic `switch` *statement*, where fallthrough was a real risk without careful use of `break`:

```java
// Classic switch statement — fallthrough risk if a `break` is missed
String dayTypeOld;
switch (day) {
    case MONDAY:
    case TUESDAY:
    case WEDNESDAY:
    case THURSDAY:
    case FRIDAY:
        dayTypeOld = "Weekday";
        break;                   // easy to forget — omitting this falls through
    case SATURDAY:
    case SUNDAY:
        dayTypeOld = "Weekend";
        break;
    default:
        dayTypeOld = "Unknown";
}
```

The `->` form needs no `break` at all — each arm runs exactly its own case and nothing else, and the whole `switch` evaluates to a value that can be assigned directly, as shown with `dayType` above. A switch expression over an `enum` that covers every constant (as `dayType` does) doesn't need a `default` branch; the compiler can verify all cases are handled. A switch expression over a non-exhaustive type (like `int` or `String`) does require a `default`, since the compiler cannot otherwise guarantee every possible value is covered.

**Pattern matching for `switch`** (standardized in Java 21) combines both ideas — the `switch` itself can match on an object's runtime type, binding a pattern variable per case, the same way `instanceof` does:

```java
static String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "an int: " + i;
        case String s  -> "a string of length " + s.length();
        case null      -> "it's null";
        default        -> "something else: " + obj;
    };
}

System.out.println(describe(42));       // an int: 42
System.out.println(describe("hi"));     // a string of length 2
System.out.println(describe(null));     // it's null
```

Note the explicit `case null` — before pattern matching for `switch`, passing `null` into any classic `switch` threw a `NullPointerException` immediately; pattern matching for `switch` lets you handle `null` as an explicit, ordinary case instead of a crash. Being a newer language feature (finalized in Java 21), code relying on pattern matching for `switch` needs a sufficiently modern JDK to compile and run — it is not available all the way back to older LTS releases like Java 8 or 11.

---

## 5. Text Blocks

A text block is a multi-line string literal delimited by triple double-quotes (`"""`) instead of a single pair, letting you write multi-line text without escaping every newline and without gluing lines together with `+`:

```java
// Old way: manual escaping and concatenation
String jsonOld = "{\n" +
                 "  \"name\": \"Ganesh\",\n" +
                 "  \"role\": \"Engineer\"\n" +
                 "}";

// Modern way: a text block
String json = """
        {
          "name": "Ganesh",
          "role": "Engineer"
        }
        """;
```

Both variables above hold equivalent JSON text. A few rules make text blocks behave predictably rather than just "however it's indented in the source": the opening `"""` must be immediately followed by a line break (no content on that line), and the *incidental* leading whitespace common to every line — including the closing `"""`'s own line — is automatically stripped based on the closing delimiter's indentation, so you can indent the whole block to match your surrounding code without that indentation ending up inside the string. A literal `"` inside a text block doesn't need escaping (only three-in-a-row, `"""`, would need one escaped), which is exactly the escaping burden text blocks remove for embedded JSON, SQL, or HTML snippets.

---

## 6. Classic Switch vs Switch Expression: Side by Side

| | **Classic `switch` statement** | **Switch expression (`->`)** |
|---|---|---|
| **Produces a value directly?** | No — only side effects unless you manually assign inside each case | Yes — the whole `switch` evaluates to a value |
| **Fallthrough between cases** | Yes, by default, unless every case ends in `break` | No — each `->` arm is self-contained, no fallthrough |
| **Grouping multiple labels** | One `case` per label, relying on fallthrough to group them | Comma-separated in one `case`: `case SATURDAY, SUNDAY ->` |
| **Exhaustiveness checking** | Not enforced by the compiler | Enforced for non-exhaustive types (`default` required); not required over an `enum`/`sealed` type covering all cases |
| **Can match on runtime type (pattern matching)** | No | Yes, since Java 21 (`case String s ->`) |
| **Handling `null`** | Throws `NullPointerException` if the switched value is `null` | Can be handled explicitly with `case null ->` |

**Common mistakes:**
- Mixing old-style `switch` statement syntax (`case X: ... break;`) and new-style switch expression syntax (`case X -> ...`) inconsistently within the same codebase — pick one style per `switch` (they can't be mixed within a single `switch` block, and consistency across a codebase avoids readers having to context-switch mental models constantly).
- Assuming pattern matching for `switch` is available identically all the way back to old Java versions — it was finalized in Java 21; code using it needs a modern-enough JDK, and won't compile on older toolchains.
- Forgetting that a classic `switch` statement throws immediately on a `null` subject, and not guarding for `null` before switching on a value that could be `null` — modern pattern-matching `switch`'s explicit `case null` exists specifically to make this an intentional, visible case instead of a crash.

**Interview angle:** A very common question is "what's the difference between a switch statement and a switch expression?" — the expected answer covers all three of: `->` producing no fallthrough, the `switch` itself evaluating to a usable value, and (for exhaustive types) the compiler enforcing that every case is handled. A strong follow-up is being able to explain *why* the classic `switch`'s fallthrough existed in the first place (deliberate, to allow intentional multi-case grouping) and why relying on it accidentally was always considered a code smell — which is exactly the historical pain Phase 1 introduced and this lesson resolves.

---

## 7. Hands-On Exercises

### Exercise 1 — Replace a cast-after-check with pattern matching

Write a method that accepts an `Object` and, using classic `instanceof` plus a separate cast, prints the uppercased value if it's a `String`. Then rewrite the same method using pattern matching for `instanceof` (`if (obj instanceof String s)`) and confirm both versions produce identical output.

### Exercise 2 — Convert a classic switch statement to a switch expression

Write a classic `switch` statement (with `break`s) that maps a `Day` enum value to a `String` describing whether it's a weekday or weekend, deliberately based on Phase 1's fallthrough-prone style. Rewrite it as a modern arrow-style switch expression that returns the same value directly, with no `break` statements.

### Exercise 3 — Build a small text block and compare it to manual escaping

Write a short multi-line SQL-like string (e.g. a 3-line `SELECT` statement) two ways: once using `\n` and string concatenation, once as a text block. Print both and confirm they produce identical output, then note which version was easier to read and edit.

---

## 8. Interview Q&A

### Q1. What does pattern matching for `instanceof` actually save you from doing?

**Answer:** It removes the separate, explicit cast that used to be required after an `instanceof` check succeeded. `if (obj instanceof String s)` both confirms the type and binds a correctly-typed variable `s` in one step, and the compiler restricts `s`'s scope to where the check is actually known to have succeeded.

### Q2. How does a switch expression eliminate fallthrough?

**Answer:** Each `case` using the `->` arrow form is a self-contained arm that produces exactly one result and does not continue into the next case — there is no implicit fall-through to opt out of with `break`, unlike the classic `switch` statement where fallthrough is the default behavior unless `break` is used.

### Q3. Does a switch expression always need a `default` case?

**Answer:** Only when the compiler can't otherwise prove every possible value is covered — for example, switching on an `int` or `String`. Switching over an `enum` or a `sealed` type that lists every possible case explicitly does not require a `default`, because the compiler can verify exhaustiveness itself.

### Q4. How does pattern matching for `switch` handle a `null` input differently from a classic switch statement?

**Answer:** A classic `switch` statement throws a `NullPointerException` immediately if the switched-on value is `null`. Pattern matching for `switch` allows an explicit `case null ->` branch, turning what used to be a crash into an ordinary, intentional case you can handle however you like.

### Q5. What problem do text blocks solve, and what's one thing to know about their indentation?

**Answer:** Text blocks remove the need to escape every embedded quote and manually join lines with `\n` and `+` for multi-line string literals. Their incidental leading whitespace — the indentation common to every line, based on where the closing `"""` sits — is automatically stripped, so the block can be indented to match surrounding code without that indentation becoming part of the actual string content.

---

> 🧠 **Memory hook:** "`instanceof` now hands you the badge instead of making you go get one; `switch ->` can't fall through because each arm just hands back an answer; `"""` stops you escaping every quote in sight."
