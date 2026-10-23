# Character Encoding — Complete Guide

## Table of Contents
1. [The Core Problem: Text Is Also Just Bits](#1-the-core-problem-text-is-also-just-bits)
2. [ASCII — The Original 7-Bit Standard](#2-ascii--the-original-7-bit-standard)
3. [Unicode — One Standard for Every Character](#3-unicode--one-standard-for-every-character)
4. [UTF-8 vs UTF-16 — How Unicode Gets Stored as Bytes](#4-utf-8-vs-utf-16--how-unicode-gets-stored-as-bytes)
5. [Worked Example: Encoding "Hi 👋" in UTF-8](#5-worked-example-encoding-hi--in-utf-8)
6. [Why Encoding Mismatches Break Real Applications](#6-why-encoding-mismatches-break-real-applications)
7. [Where This Shows Up in Real Code](#7-where-this-shows-up-in-real-code)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Core Problem: Text Is Also Just Bits

A computer only stores bits. The letter `A` isn't inherently "A" to a computer — it's just whatever number a program has agreed to interpret as "A" when displaying it. **Character encoding** is the agreed-upon mapping between numbers (which the computer stores) and characters (which humans read).

```
Bits stored:   01000001
Interpreted as a number:     65
Interpreted as a character (via ASCII table): "A"
```

If the writer and reader of a piece of text disagree on which encoding to use, the same bits get displayed as different (often garbled) characters — this is the root cause of "mojibake" (e.g., `café` showing up as `cafÃ©`).

---

## 2. ASCII — The Original 7-Bit Standard

ASCII (American Standard Code for Information Interchange), from the 1960s, maps 128 values (7 bits: 0–127) to English letters, digits, punctuation, and control codes.

```
Decimal   Binary      Character
65        0100 0001   A
97        0110 0001   a
48        0011 0000   0
32        0010 0000   (space)
10        0000 1010   (newline, \n)
```

```python
>>> ord('A')      # character -> code point
65
>>> chr(65)       # code point -> character
'A'
>>> ord('a') - ord('A')   # the case-shift trick: lowercase = uppercase + 32
32
```

ASCII's fatal limitation: **128 values cannot represent the world's languages** — no accented letters (é, ñ), no Cyrillic, Chinese, Arabic, Hindi scripts, no emoji. Early computing solved this badly with dozens of incompatible "extended ASCII" / code-page standards (Latin-1, Windows-1252, etc.), each using the freed-up 8th bit differently — which is exactly why old text files sometimes show garbled accented characters when opened with the wrong assumption.

---

## 3. Unicode — One Standard for Every Character

Unicode is **not an encoding** — it's a single universal table that assigns every character in every writing system (plus symbols, emoji, etc.) a unique number called a **code point**, written as `U+XXXX` in hex.

```
U+0041   =  "A"
U+00E9   =  "é"
U+4E2D   =  "中"
U+1F600  =  "😀"
```

Unicode currently defines over 149,000 characters. It solves the "which character does this number mean" problem globally — but it does **not** by itself say how to store those numbers as bytes on disk or in memory. That's the job of an **encoding** like UTF-8 or UTF-16.

```python
>>> ord('中')
20013
>>> hex(ord('中'))
'0x4e2d'
>>> "中"
'中'
```

---

## 4. UTF-8 vs UTF-16 — How Unicode Gets Stored as Bytes

Since Unicode code points range up to `U+10FFFF` (over a million values), they can't all fit in a single byte. UTF-8 and UTF-16 are two different strategies for encoding these code points as sequences of bytes.

### UTF-8 — Variable Width, 1 to 4 Bytes

```
Code point range        Bytes used   Byte pattern
U+0000   – U+007F       1 byte       0xxxxxxx                          (ASCII, unchanged!)
U+0080   – U+07FF       2 bytes      110xxxxx 10xxxxxx
U+0800   – U+FFFF       3 bytes      1110xxxx 10xxxxxx 10xxxxxx
U+10000  – U+10FFFF     4 bytes      11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
```

Key property: **UTF-8 is fully backward compatible with ASCII** — every ASCII byte (0–127) is a valid, identical single-byte UTF-8 character. This is a major reason UTF-8 became the dominant encoding of the web, Linux, and most modern APIs/JSON.

### UTF-16 — Variable Width, 2 or 4 Bytes

```
Code point range        Bytes used
U+0000   – U+FFFF       2 bytes (a single "code unit")
U+10000  – U+10FFFF     4 bytes (a "surrogate pair" — two 2-byte code units)
```

UTF-16 is used internally by Java, JavaScript strings (historically), Windows APIs, and .NET. It's not ASCII-compatible at the byte level (every character takes at least 2 bytes, even plain "A").

| | UTF-8 | UTF-16 |
|---|-------|--------|
| Minimum bytes per char | 1 | 2 |
| ASCII-compatible bytes | Yes | No |
| Common usage | Web, Linux, JSON, most APIs | Java/JS internal string storage, Windows |
| Endianness concerns | None | Yes (BE/LE byte order matters) |

---

## 5. Worked Example: Encoding "Hi 👋" in UTF-8

```python
>>> text = "Hi 👋"
>>> [hex(b) for b in text.encode('utf-8')]
['0x48', '0x69', '0x20', '0xf0', '0x9f', '0x91', '0x8b']
>>> len(text)                      # Python counts this as 4 "characters" (code points)
4
>>> len(text.encode('utf-8'))      # but it takes 7 bytes on disk/network
7
```

Breaking it down:

```
'H'   -> U+0048 -> 1 byte:  0x48
'i'   -> U+0069 -> 1 byte:  0x69
' '   -> U+0020 -> 1 byte:  0x20
'👋'  -> U+1F44B -> 4 bytes: 0xf0 0x9f 0x91 0x8b   (outside the Basic Multilingual Plane)
```

Notice `len(text)` (4 characters) does not equal `len(text.encode('utf-8'))` (7 bytes) — a common source of bugs when systems assume "1 character = 1 byte," which was only ever true for plain ASCII.

---

## 6. Why Encoding Mismatches Break Real Applications

**Mojibake example** — encoding as UTF-8, then wrongly decoding as Latin-1:

```python
>>> original = "café"
>>> utf8_bytes = original.encode('utf-8')
>>> utf8_bytes
b'caf\xc3\xa9'
>>> utf8_bytes.decode('latin-1')     # wrong assumption about the encoding used
'cafÃ©'
```

This exact bug pattern (`café` becoming `cafÃ©`) happens constantly in the real world: a database column set to `latin1` storing UTF-8 bytes, a CSV export/import across tools with different default encodings, an HTTP response missing a `charset` header, or an email client guessing the wrong encoding.

```python
>>> utf8_bytes.decode('utf-8')       # decoding with the SAME encoding it was written in
'café'
```

**The rule that prevents 90% of encoding bugs**: always decode text with the *same* encoding it was encoded with — and be explicit about which encoding you're using rather than relying on system/locale defaults.

---

## 7. Where This Shows Up in Real Code

- **HTTP responses**: `Content-Type: text/html; charset=utf-8` header tells the browser which encoding to use to decode the byte stream.
- **Databases**: MySQL's infamous `utf8` charset is actually a 3-byte-max subset that can't store 4-byte characters like emoji — `utf8mb4` is needed for full Unicode/emoji support.
- **Python 2 vs 3**: one of the biggest breaking changes was Python 3 making the `str` type Unicode-aware by default, requiring explicit `.encode()`/`.decode()` at I/O boundaries.
- **File uploads / CSV exports**: opening a UTF-8 CSV in a tool assuming Windows-1252 garbles accented names.
- **String length bugs**: JavaScript's `"👋".length` returns `2` (because JS strings are UTF-16 and this emoji needs a surrogate pair), which surprises developers expecting `1`.

---

## 8. Hands-On Exercises

1. In a Python REPL, run `ord('A')`, `ord('a')`, `ord('0')` and confirm the ASCII decimal values match the table in §2.
2. Encode the string `"naïve"` to UTF-8 bytes with `.encode('utf-8')`, inspect the raw bytes, then decode it back and confirm round-trip correctness.
3. Reproduce the mojibake bug from §6 yourself: encode a string with accented characters as UTF-8, then deliberately decode those bytes as `latin-1`, and describe what happened in terms of byte-to-character mapping.
4. Compare `len("😀")` vs `len("😀".encode('utf-8'))` in Python, and explain the difference in one sentence.
5. In a JavaScript console (browser or Node), run `"👋".length`. Explain why it returns `2` instead of `1`, referencing UTF-16 surrogate pairs.

---

## 9. Interview Q&A

**Q: What is the difference between ASCII, Unicode, and UTF-8?**
Answer: ASCII is a 7-bit character encoding covering only 128 characters (basic English letters, digits, punctuation). Unicode is not an encoding — it's a universal table assigning every character in every writing system a unique numeric "code point" (e.g., U+0041 for "A"). UTF-8 is one specific *encoding* — a set of rules for representing those Unicode code points as sequences of 1–4 bytes. So Unicode says "what number means what character," and UTF-8 says "how do we write that number as bytes."

**Q: Why is UTF-8 so widely used compared to UTF-16 or other encodings?**
Answer: UTF-8 is backward-compatible with ASCII (every ASCII byte is a valid, identical single-byte UTF-8 character), it's compact for English/Latin-heavy text (1 byte per common character), it has no byte-order/endianness ambiguity, and it can represent the entire Unicode range. This combination made it the default for the web, Linux, JSON, and most modern APIs.

**Q: What causes "mojibake" (garbled text like café becoming cafÃ©)?**
Answer: It happens when text is encoded with one character encoding (e.g., UTF-8) but decoded using a different, incompatible encoding (e.g., Latin-1). The underlying bytes never change — only the interpretation of those bytes into characters changes — so choosing the wrong decoding maps the same byte sequence to the wrong characters.

**Q: Why might `"😀".length` return `2` in JavaScript instead of `1`?**
Answer: JavaScript strings are UTF-16 internally, and `.length` counts UTF-16 code units, not visual characters. Code points outside the Basic Multilingual Plane (like most emoji, above U+FFFF) require a "surrogate pair" of two 16-bit code units to represent, so a single emoji character counts as length 2.

**Q: What's the practical difference between MySQL's `utf8` and `utf8mb4` charsets, and why does it matter?**
Answer: MySQL's historically named `utf8` charset only supports up to 3 bytes per character, which covers the Basic Multilingual Plane but cannot store 4-byte UTF-8 sequences like most emoji or some rare CJK characters. `utf8mb4` ("UTF-8 most bytes 4") supports the full UTF-8 spec up to 4 bytes per character. Using plain `utf8` can silently truncate or error out when a user submits emoji in a text field — a very common real-world bug.

**Q: If you're debugging an encoding-related bug in a text pipeline (e.g., API to database to frontend), what's your general approach?**
Answer: Identify every boundary where text is encoded or decoded (file read, HTTP request/response, database read/write, frontend rendering) and check that each side agrees on the same encoding — ideally standardizing on UTF-8 everywhere. Inspect the raw bytes (not just the rendered text) at each boundary to see where the mismatch is introduced, since the garbled output alone doesn't tell you which stage misinterpreted the encoding.
