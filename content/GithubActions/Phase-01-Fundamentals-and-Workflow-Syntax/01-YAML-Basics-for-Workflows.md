# YAML Basics for Workflows

Every GitHub Actions workflow file is plain YAML before it is anything else — GitHub hands the raw text to a YAML parser first, and that parser knows nothing about "jobs" or "steps." A handful of YAML rules (indentation, key-value pairs, lists, block strings) account for almost every "workflow file is not valid" error beginners hit, so learning them removes that entire class of pain before you write a real pipeline.

## 1. Indentation Is the Structure

YAML uses indentation instead of braces or brackets to show what belongs to what — like an outline where "Apples" belongs to "Fruits" only because it's indented one level under it, not because of any punctuation.

```
Fruits
    Apples
    Bananas
Vegetables
    Carrots
```

If "Bananas" were indented one space less than "Apples," a parser would treat it as belonging to a different parent — the structure itself would be wrong even though every word is spelled correctly.

## 2. How a Parser Turns Text Into Structure

Before GitHub Actions reads any of its expected keys, the YAML parser runs through a fixed sequence of steps to turn raw text into a nested data structure (maps and lists):

1. **Tokenize by line and indentation** — lines indented further than the line above are children of it.
2. **Recognize key-value pairs** — `name: CI` splits at the first colon-space into key `name` and value `CI`, building a map.
3. **Recognize lists** — lines starting with `- ` at the same indentation level become items in a list.
4. **Recognize scalars vs. block strings** — plain values become strings/numbers/booleans; `|` and `>` switch into "block scalar" mode.
5. **Build the final tree** — one nested structure (maps of maps, lists, strings) is handed to GitHub Actions, which then reads specific keys (`name`, `on`, `jobs`) out of it.
6. **Fail fast on ambiguity** — inconsistent indentation (mixed tabs/spaces, a child indented less than its parent) means the parser can't decide the structure and raises a syntax error before GitHub Actions ever sees a "job."

So a "workflow syntax error" almost always means one of steps 1–4 failed — the file never became valid data in the first place, regardless of your CI logic.

## 3. Key-Value Pairs and Nested Maps

A single colon-space turns a line into a key-value pair; leaving the value off the same line makes the indented block below it the value instead (a nested map).

```yaml
name: Hello World CI

on:
  push:
    branches:
      - main
```

`name: Hello World CI` is a key-value pair. `on:` has nothing after the colon on its own line, so its value is the whole indented map below it — `push`, in turn, holds another map (`branches`).

## 4. Lists

Lines starting with `- ` at the same indentation level become items of a list attached to whatever key introduced them. `steps` is the most common list in a workflow file — a list of maps, one per step.

```yaml
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:                   # "steps" holds a list of maps
      - name: Say hello
        run: echo "Hello"
      - name: Say goodbye
        run: echo "Goodbye"
```

`jobs` itself is a **map** keyed by job id (`greet`), not a list — only `steps` uses the `-` list syntax here.

## 5. Multi-Line Strings (`|` and `>`)

Two block-scalar styles let a `run:` value span multiple lines instead of being a single string:

| Style | Symbol | Behavior | Typical use |
|---|---|---|---|
| Literal block | `\|` | Keeps line breaks exactly as written | Multi-command `run:` steps |
| Folded block | `>` | Joins lines with spaces instead of newlines | Long single-line strings |

```yaml
steps:
  - name: Multi-line block scalar
    run: |
      echo "Hello"
      echo "This is a multi-line block scalar"
  - name: Folded string
    run: >
      echo "This whole block is folded by YAML into one line
      before it ever reaches the shell, so it runs as a single command"
```

The `|` form reappears constantly in later lessons — multi-line `run:` steps are the norm for anything beyond a single shell command (see Lesson 03).

## 6. The `on`/Boolean Gotcha

Some generic YAML parsers (following the YAML 1.1 spec) treat bare, unquoted `on`, `off`, `yes`, `no` as booleans rather than strings — historically this meant a top-level `on:` key could be silently interpreted as the boolean key `true:` by certain YAML tools.

```yaml
# Some YAML 1.1 parsers would read this key as boolean `true`, not the string "on"
on:
  push:
    branches:
      - main
```

GitHub's own workflow parser handles `on:` correctly as the trigger key today, but the underlying ambiguity is real in the broader YAML ecosystem — which is why some style guides recommend quoting suspicious bare words (`"on":`) when writing YAML for tools other than GitHub Actions.

## 7. Validating YAML

Before worrying about GitHub Actions semantics at all, confirm the file is even valid YAML:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

If this prints nothing and exits with status 0, the file is syntactically valid YAML — this does not mean it is a *correct* GitHub Actions workflow, only that the text parses into a data structure.

## Comparison

| | YAML | JSON |
|---|---|---|
| Structure signal | Indentation (implicit) | Braces/brackets (explicit) |
| Readability | Higher | Lower |
| Fragility | Breaks on whitespace mistakes | Breaks on missing punctuation |
| Valid GitHub Actions input | Yes | Yes — JSON is valid YAML, so workflows can be written as JSON too |

This lesson is the prerequisite for **02-Workflow-File-Anatomy.md** — once you can read indentation and lists correctly, the top-level `name`/`on`/`jobs` structure is just "three keys in a map."

## Common Mistakes

- **Inconsistent indentation** — mixing 2-space and 4-space levels, or indenting one sibling key differently than another, breaks the document even though it "looks" fine to a casual read.
- **Using tabs instead of spaces** — YAML disallows tabs for indentation entirely; a single stray tab (often pasted from an editor with different settings) causes a hard parse failure.
- **Assuming `on`, `yes`, `no`, `true`, `off` are always strings** — see the boolean gotcha above; GitHub's parser handles `on:` correctly, but other YAML tooling may not.
- **Forgetting the space after `:` or `-`** — `key:value` (no space) is not a valid key-value pair in most YAML parsers; it must be `key: value`.
- **Copy-pasting snippets from different sources at different indentation levels** — the single most common real-world cause of "workflow is invalid" errors, because each snippet was internally consistent but not consistent with the other.

## Hands-On Exercises

1. Save the annotated example from section 3 as `workflow.yml` and validate it with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml` — confirm it exits cleanly.
2. Break it on purpose: indent `- main` by one extra space relative to `branches:` and re-run the same command — observe the parser raise an error.
3. Replace a `- ` list item's space with nothing (`-main`) and re-validate — observe that it's no longer parsed as a list item.
4. Write a `run:` step using `|` with three echo commands, then rewrite it using `>` with the same three lines — validate both with `yamllint workflow.yml` (or `actionlint workflow.yml` if installed) and compare how each renders once actually run in a step.
5. Run `actionlint workflow.yml` against the file from step 1 to see the difference between a generic YAML linter and one that understands GitHub Actions schema.

## Interview Q&A

**Q: A teammate says their workflow doesn't even show up in the Actions tab — what do you check first?**
A: Validate that the YAML is well-formed before looking at job logic at all — a parse failure means the file never became valid data, so GitHub never even considers triggers or jobs.

**Q: Why might `on: true` be a bug in some YAML tooling?**
A: Some YAML 1.1 parsers interpret bare, unquoted `on` as the boolean `true` rather than the string `"on"`, so a generic tool could silently read the key as `true:` instead of `on:`. GitHub Actions itself isn't tripped up by this for the `on:` key specifically, but it's a known YAML ecosystem gotcha.

**Q: What's the difference between `|` and `>` in YAML?**
A: `|` (literal block) preserves line breaks exactly as written, which is why multi-command `run:` steps use it. `>` (folded block) joins lines with spaces instead of newlines, collapsing the block into one logical line.

**Q: Why does mixing tabs and spaces break a workflow file?**
A: YAML disallows tabs for indentation entirely, so a stray tab character makes indentation ambiguous and causes a hard parse failure before GitHub Actions reads any keys.

**Q: Is GitHub Actions YAML actually YAML, or could you write it as JSON?**
A: It's genuinely YAML, but since JSON is a strict subset of YAML, a workflow file written as valid JSON is also valid YAML and will parse correctly.
