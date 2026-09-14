# Coding-Decoding — Complete Guide

## Table of Contents
1. [Concept](#1-concept)
2. [Shortcut / Trick](#2-shortcut--trick)
3. [Worked Examples](#3-worked-examples)
4. [Timed Practice Set](#4-timed-practice-set)

---

## 1. Concept

Coding-decoding questions give you a rule that turns real words into "coded" words (or numbers), show you one or more worked examples of the rule in action, and then ask you to apply the same rule forwards (encode) or backwards (decode). The rule itself is one of a small number of standard types:

- **Letter-shift coding** — every letter is shifted a fixed number of positions in the alphabet (Caesar-cipher style): CAT → DBU is a shift of +1 (C→D, A→B, T→U).
- **Number coding** — each letter (or whole word) is replaced by a number, according to a key you have to reverse-engineer from the examples given (not necessarily the letter's real alphabet position — it can be an arbitrary codebook).
- **Substitution coding** — letters are swapped according to a fixed table (e.g., a reversed alphabet, or a scrambled key) rather than a uniform shift.
- **Coded sentences** — whole sentences are coded word-for-word (in scrambled order), and you're given two coded sentences that share one real word in common; you find that word's code by finding the one code-word the two coded sentences have in common.

---

## 2. Shortcut / Trick

**Convert letters to alphabet-position numbers to detect a shift instantly.** Given an example pair like CAT → DBU, write positions underneath: C(3)→D(4), A(1)→B(2), T(20)→U(21). If every letter moves by the same amount, it's a uniform shift — apply that same shift (forward to encode, backward to decode) to the new word, letter by letter.

**For number-coding, build a letter-to-digit map from the overlapping letters across the given examples — don't assume real alphabet positions.** If you're told TRAIN = 74129 and BUS = 658, line up letters under digits (T=7, R=4, A=1, I=2, N=9, B=6, U=5, S=8) and simply look up each letter of the target word in that map. These codes are usually arbitrary, not the letter's true A=1…Z=26 position, so never assume — always derive the map from the given data.

**For coded sentences, find the common word between the two sentences, then find the common code-word between the two codes — that pairing is your answer.** Only compare two coded-sentence examples that literally share one real word; the code-word that appears in both coded outputs must correspond to that shared word, since every other word differs between the two sentences.

**Always decode-then-recode when the question changes direction.** If the rule was demonstrated as encoding (real word → code), and the question gives you a code and asks for the real word, reverse the same operation (shift back, or look up the digit-to-letter map in reverse) rather than trying to apply the rule forwards by mistake.

---

## 3. Worked Examples

### (a) Letter-shift coding — decode a word

If CAT is coded as DBU, what does IBU decode to?

First confirm the rule from the example: C(3)→D(4), A(1)→B(2), T(20)→U(21) — every letter shifts **+1**. So encoding is "+1 to each letter"; decoding therefore means "−1 to each letter."

Apply −1 to each letter of IBU: I(9)−1=H(8), B(2)−1=A(1), U(21)−1=T(20).

IBU decodes to **HAT**.

### (b) Number-to-letter substitution code

If TRAIN is coded as 74129 and BUS is coded as 658, what is the code for RUN?

Line up each word with its code digit by digit:

```
T R A I N        B U S
7 4 1 2 9        6 5 8
```

This gives the letter-to-digit map: T=7, R=4, A=1, I=2, N=9, B=6, U=5, S=8.

RUN needs R, U, N: R=4, U=5, N=9.

The code for RUN is **459**.

### (c) Coded sentence — decode a specific word

If "ROSES ARE RED" is coded as "pin ton sin" and "RED IS COLOR" is coded as "sin bye lin", what is the code for RED?

The word **RED** is the one real word common to both sentences. Now find the one code-word common to both coded outputs: {pin, ton, sin} and {sin, bye, lin} — the shared code-word is **sin**.

Since RED is the only word shared by both sentences, and sin is the only code-word shared by both codes, RED = **sin**.

---

## 4. Timed Practice Set

1. If TRAIN is coded as 74129 and BUS is coded as 658, find the code for "BAT". (30 sec)
2. If MOUSE is written as NPVTF (each letter shifted +1), what is the code for TIGER? (30 sec)
3. If PENCIL is coded as QFODJM (+1 shift), decode the word "TBOE". (30 sec)
4. In a code, each letter is written as the letter 2 positions ahead in the alphabet (A→C, B→D, …). What is the code for "FLOWER"? (40 sec)
5. If "GOOD BOYS PLAY" is coded as "ta ka la" and "BOYS STUDY WELL" is coded as "la na pa", find the code for "BOYS". (40 sec)
6. If "RED" is coded as 18-5-4 (true alphabet positions), what is the code for "BLUE"? (30 sec)
7. If "SUN" is written as "TVO" (+1 shift each letter), what is the code for "MOON"? (30 sec)
8. If "CAT DOG RUN" is coded as "mx pq zt" and "DOG SAT FUN" is coded as "pq lw yx", find the code for "DOG". (40 sec)

### Answer Key

1. **617** — Map from the examples: T=7, R=4, A=1, I=2, N=9, B=6, U=5, S=8. BAT = B(6) A(1) T(7) = 617.
2. **UJHFS** — Confirm +1 shift from MOUSE→NPVTF, then apply to TIGER: T→U, I→J, G→H, E→F, R→S.
3. **SAND** — The code is +1, so decoding is −1: T→S, B→A, O→N, E→D.
4. **HNQYGT** — Shift each letter +2: F→H, L→N, O→Q, W→Y, E→G, R→T.
5. **la** — BOYS is the only word common to both sentences; "la" is the only code-word common to both coded outputs.
6. **2-12-21-5** — True alphabet positions: B=2, L=12, U=21, E=5.
7. **NPPO** — Confirm +1 shift from SUN→TVO, then apply to MOON: M→N, O→P, O→P, N→O.
8. **pq** — DOG is the only word common to both sentences; "pq" is the only code-word common to both coded outputs.
