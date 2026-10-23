# The Compilation Pipeline — Complete Guide

## Table of Contents
1. [What a Compiler Actually Does](#1-what-a-compiler-actually-does)
2. [The Four-Stage Pipeline](#2-the-four-stage-pipeline)
3. [Stage 1: Lexing (Tokenizing)](#3-stage-1-lexing-tokenizing)
4. [Stage 2: Parsing (Building the AST)](#4-stage-2-parsing-building-the-ast)
5. [Stage 3: Semantic Analysis](#5-stage-3-semantic-analysis)
6. [Stage 4: Code Generation and Optimization](#6-stage-4-code-generation-and-optimization)
7. [Worked Example: Tracing `x = 2 + 3 * 4`](#7-worked-example-tracing-x--2--3--4)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What a Compiler Actually Does

A compiler is a program that translates source code (text a human wrote) into another form — usually machine code, but sometimes bytecode or another language entirely. It does this in **stages**, each one transforming the program into a more precise, more "understood" representation.

```
Human-readable text              Machine-executable instructions
  "x = 2 + 3 * 4"    ──compiler──▶   MOV, ADD, MUL, STORE ...

The compiler doesn't do this in one leap.
It moves through a pipeline of well-defined stages.
```

Every compiler — whether it's GCC compiling C, javac compiling Java, or the CPython compiler compiling your `.py` file to bytecode — follows roughly the same pipeline. The stages are universal even though the output format differs.

---

## 2. The Four-Stage Pipeline

```
┌────────────────┐     ┌────────────────┐     ┌────────────────────┐     ┌──────────────────────┐
│  1. LEXING     │     │  2. PARSING    │     │ 3. SEMANTIC        │     │ 4. CODE GENERATION   │
│  (Tokenizing)  │────▶│  (Build AST)   │────▶│    ANALYSIS         │────▶│    & OPTIMIZATION    │
│                │     │                │     │                     │     │                       │
│ source text    │     │ tokens ─▶ tree │     │ type checking,      │     │ AST ─▶ machine code   │
│      ─▶        │     │                │     │ scope resolution,   │     │        or bytecode,   │
│  token stream  │     │                │     │ error detection     │     │ + optimization passes │
└────────────────┘     └────────────────┘     └────────────────────┘     └──────────────────────┘
      │                       │                        │                          │
      ▼                       ▼                        ▼                          ▼
  "x" "=" "2"           BinOp(+,                 checks: is "x"              MOV R1, 4
  "+" "3" "*" "4"         2,                       declared? do types         MUL R1, 3
                          BinOp(*, 3, 4))          match? etc.                ADD R1, 2
                                                                               STORE x, R1
```

Some textbooks split this into more stages (e.g., separating "intermediate code generation" from "target code generation," or adding a distinct "linking" stage). For interview purposes, four stages is the right level of granularity: **lex → parse → analyze → generate/optimize**.

---

## 3. Stage 1: Lexing (Tokenizing)

The **lexer** (a.k.a. tokenizer, scanner) reads raw source code character by character and groups characters into **tokens** — the smallest meaningful units of the language (keywords, identifiers, literals, operators, punctuation).

```
Input (raw characters):
  x = 2 + 3 * 4

Output (token stream):
  IDENTIFIER("x")
  ASSIGN("=")
  NUMBER("2")
  PLUS("+")
  NUMBER("3")
  STAR("*")
  NUMBER("4")
```

The lexer does NOT understand grammar or meaning — it just recognizes "this chunk of characters is a valid token of type X." It also throws out things that don't matter to later stages: whitespace, comments, line-continuation backslashes.

```
"x=2+3*4"   (no spaces at all)
     │
     ▼ lexer still produces the same tokens:
  IDENTIFIER("x") ASSIGN("=") NUMBER("2") PLUS("+") NUMBER("3") STAR("*") NUMBER("4")
```

If you type `x = 2 $ 4`, the lexer is where you'd get an "unexpected character '$'" error — it doesn't know the language's grammar, but it does know `$` isn't a valid token in most languages.

---

## 4. Stage 2: Parsing (Building the AST)

The **parser** takes the flat token stream and imposes structure on it according to the language's **grammar**, producing an **Abstract Syntax Tree (AST)** — a tree representation of the program's structure.

This is where operator precedence and associativity get applied. `2 + 3 * 4` must become a tree where `*` binds tighter than `+`, even though `+` appears first in the token stream.

```
Token stream:
  IDENTIFIER(x) ASSIGN NUMBER(2) PLUS NUMBER(3) STAR NUMBER(4)

AST:
              Assign
              /    \
             x      Add
                    /   \
                   2     Mul
                        /   \
                       3     4
```

If the parser encounters a token sequence that doesn't match any valid grammar rule (e.g., `x = + 4 *`), you get a **syntax error** — the classic "SyntaxError: invalid syntax" you see in Python, or "expected expression" in C.

Parsing is also where a **Concrete Syntax Tree (CST)** is sometimes built first (retaining every token including parens, commas) before being simplified into the more compact AST that later stages use. For interview purposes, "parser builds the AST" is the important takeaway.

---

## 5. Stage 3: Semantic Analysis

The AST tells you the program's *structure* but not whether it *makes sense*. Semantic analysis walks the AST and checks:

- **Scope resolution**: is `x` declared? Is it in scope at this point? Which `x` does this reference resolve to (local, enclosing, global)?
- **Type checking**: do the operand types match what the operator expects? (In statically typed languages like Java/C++, this can reject the program at compile time. In dynamically typed languages like Python, most of this is deferred to runtime.)
- **Other static checks**: unreachable code, duplicate declarations, calling a function with the wrong number of arguments, using a variable before assignment.

```
AST:
              Assign
              /    \
             x      Add(2, Mul(3, 4))

Semantic analysis asks:
  - Does "x" already exist in this scope, or is this a new binding?  → new binding, OK
  - Are the types of 2, 3, 4 compatible with + and *?                → all int, OK
  - Result: annotated/decorated AST, ready for code generation
```

This is the stage where you get errors like "cannot add 'int' and 'str'" (statically caught) or "undefined variable 'y'" (caught here or deferred to runtime, depending on the language).

---

## 6. Stage 4: Code Generation and Optimization

Finally, the compiler walks the validated AST and emits output — this could be:
- **Native machine code** (C, C++, Go, Rust) — CPU-specific instructions (x86-64, ARM).
- **Bytecode** (Python, Java, C#) — instructions for a virtual machine, not a real CPU (see Phase 08).

Before or during emission, the compiler applies **optimization passes** — transformations that preserve behavior but improve speed, size, or both:

```
Common optimizations:
  Constant folding:     3 * 4        →  12          (computed at compile time)
  Dead code elimination: if (false) { ... }  →  removed entirely
  Common subexpression
  elimination:           (a+b) * (a+b)  →  t = a+b; t * t
  Inlining:               small function calls replaced with their body
  Loop unrolling:         repeated loop bodies expanded to reduce branch overhead
```

```
AST (after semantic analysis):
  Assign(x, Add(2, Mul(3, 4)))

Optimizer folds constants:
  Mul(3, 4) → 12
  Add(2, 12) → 14
  Assign(x, 14)

Code generator emits (pseudo-assembly):
  MOV R1, 14
  STORE x, R1
```

Notice: because `2 + 3 * 4` involves only constants, a good optimizing compiler computes the whole thing at compile time and emits a single `MOV`. No runtime arithmetic needed at all.

---

## 7. Worked Example: Tracing `x = 2 + 3 * 4`

Let's trace the full pipeline end to end for one line: `x = 2 + 3 * 4`.

**Stage 1 — Lexing:**
```
"x = 2 + 3 * 4"
   ↓
[IDENTIFIER('x'), ASSIGN('='), NUMBER('2'), PLUS('+'), NUMBER('3'), STAR('*'), NUMBER('4')]
```

**Stage 2 — Parsing (respecting `*` precedence over `+`):**
```
        Assign
        /    \
       x      Add
             /   \
            2     Mul
                 /   \
                3     4
```

**Stage 3 — Semantic Analysis:**
```
- 'x' is a new local binding → register it in the current scope's symbol table
- 2, 3, 4 are all int literals → Add(int, int) is valid → result type int
- Mul(int, int) is valid → result type int
- Assign(x: int, int) is valid
→ AST is well-formed, annotated with types, passed to code generation
```

**Stage 4 — Code Generation & Optimization:**
```
Without optimization (naive code gen):
  LOAD_CONST 3
  LOAD_CONST 4
  MUL
  LOAD_CONST 2
  ADD
  STORE x

With constant folding optimization:
  LOAD_CONST 14
  STORE x
```

This is exactly what CPython's compiler does — you can verify it yourself using the `dis` module (covered in Phase 08, Lesson 02): CPython's peephole optimizer folds `2 + 3 * 4` into the constant `14` at compile time, so the bytecode never actually performs the addition or multiplication at runtime.

---

## 8. Hands-On Exercises

**Exercise 1:** By hand, tokenize the expression `y = (a + b) * 2`. Write out the full token stream.

**Exercise 2:** Draw the AST for `a + b * c - d`, being careful about operator precedence (`*` before `+`/`-`) and left-to-right associativity for `+`/`-`.

**Exercise 3:** In Python, run `compile("x = 2 + 3 * 4", "<string>", "exec")` and then inspect `.co_consts` on the result. Do you see the raw numbers `2`, `3`, `4`, or the folded result `14`? What does that tell you about when constant folding happens?

**Exercise 4:** Identify which pipeline stage would catch each of these errors: (a) `x = 2 +* 3` (b) using a variable `total` that was never assigned anywhere in the function (c) `"hello" + 5` in a statically typed language like Java (d) an unterminated string literal `"hello`.

**Exercise 5:** Write out the AST for `if x > 0: y = 1 else: y = -1` and identify which nodes semantic analysis would need to type-check.

---

## 9. Interview Q&A

**Q: What are the main stages of a compiler pipeline?**
Answer: Lexing (tokenizing raw source into a stream of tokens), parsing (imposing grammar structure on tokens to build an Abstract Syntax Tree), semantic analysis (checking scope, types, and other static correctness rules on the AST), and code generation with optimization (emitting target code — machine code or bytecode — while applying transformations like constant folding and dead code elimination).

**Q: What's the difference between a lexer and a parser?**
Answer: A lexer converts a flat stream of characters into a flat stream of tokens — it has no concept of grammar or nesting, just "is this a valid token." A parser takes that token stream and imposes hierarchical structure on it according to the language's grammar, producing a tree (the AST). Lexing answers "what are the words"; parsing answers "how do the words fit together as sentences."

**Q: What is an AST and why is it useful?**
Answer: An Abstract Syntax Tree is a tree representation of a program's structure, with each node representing a construct (an assignment, a binary operation, a function call). It's useful because it strips away syntactic noise (parentheses, semicolons) while preserving semantic structure, making it easy for later compiler stages — and tools like linters, formatters, and IDEs — to analyze and transform the program programmatically.

**Q: Where does type checking happen in the pipeline, and does that differ between languages?**
Answer: Type checking is part of semantic analysis. In statically typed languages (Java, C++, Go), it happens fully at compile time and can reject the program before it ever runs. In dynamically typed languages (Python, JavaScript), most type checking is deferred to runtime — the compiler does relatively little static type checking, and type errors surface as exceptions during execution instead of compile errors.

**Q: What is constant folding and why does it matter?**
Answer: Constant folding is an optimization where the compiler evaluates expressions made entirely of constants at compile time instead of generating code to compute them at runtime. For example, `3 * 4` becomes `12` before the program ever runs. It matters because it eliminates redundant runtime work — CPython, GCC, and the JVM all perform this optimization, so code that looks like it does arithmetic may actually just load a precomputed value.

**Q: Can a syntax error and a semantic error both occur in the same line, and which one wins?**
Answer: Yes, but the pipeline is sequential — the parser must succeed in building a valid AST before semantic analysis can even run. So a syntax error (e.g., mismatched parentheses) is always caught and reported first, before any semantic check (like an undefined variable) gets a chance to run on that code.
