# 02 — Self-Querying Retrievers

> How an LLM can split a natural-language question into a semantic search string and a structured metadata filter, so the retriever searches by meaning *and* filters by fact in one step.

---

## Table of Contents

1. [The Problem: One Sentence, Two Different Kinds of Constraint](#1-the-problem-one-sentence-two-different-kinds-of-constraint)
2. [The Analogy: The Librarian Who Parses Your Request For You](#2-the-analogy-the-librarian-who-parses-your-request-for-you)
3. [Internal Flow: Query → Structured Parse → Filtered Search](#3-internal-flow-query--structured-parse--filtered-search)
4. [Code Example: Parsing a Query into Search Text + Filter](#4-code-example-parsing-a-query-into-search-text--filter)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: One Sentence, Two Different Kinds of Constraint

Consider a user typing: *"Show me articles about pricing from last month."*

That single sentence actually contains two completely different kinds of request, tangled together:

- **A semantic part** — "articles about pricing." This is exactly what vector similarity search (Phases 5-8) is good at: find chunks whose *meaning* is close to "pricing."
- **A structured filter part** — "from last month." This has nothing to do with meaning or embeddings. It's an exact, factual constraint on a metadata field (a `date` or `published_at` field), the kind of filter Phases 6 and 7 covered as metadata filtering on Pinecone and pgvector.

A plain retriever can only do one of these well. If you embed the entire sentence "articles about pricing from last month" and run pure similarity search, the phrase "last month" doesn't correspond to any consistent *meaning* the embedding model can latch onto — today's "last month" and last year's "last month" embed almost identically, since the words themselves don't encode a specific date range. The system either ignores the temporal constraint entirely, or it half-heartedly biases toward documents that happen to *mention* the word "recent" or "month," which isn't the same as actually filtering by date.

The problem, stated plainly: **a single natural-language query often mixes a semantic search intent with a structured, factual filter, and a retriever needs a way to separate the two before it can search correctly for either one.**

---

## 2. The Analogy: The Librarian Who Parses Your Request For You

**Real-world analogy:** imagine two ways of asking a librarian for help.

In the clumsy version, you fill out two separate forms: one form where you write "pricing" as your topic, and a second, entirely different form where you specify a date range, a shelf number, or a section code. You have to know in advance which parts of your request go on which form, and mentally split your own sentence into two pieces before you even talk to anyone.

In the better version, you just say the whole sentence out loud — "show me articles about pricing from last month" — to a librarian who is good at parsing requests. They automatically hear "pricing" as the *topic* to search by meaning, and "last month" as a *shelf constraint* — they go check the card catalog's date index for that, separately from the topic search, and combine both to hand you exactly the right set of books.

A self-querying retriever is that skilled librarian. **Instead of you manually splitting your query into "the semantic part" and "the filter part," an LLM does that parsing for you** — reading the natural-language question once and producing both pieces: a clean semantic search string, and a structured filter object ready to hand to the vector store's metadata-filtering mechanism.

> 🧠 One-sentence version: *"Don't make the user fill out two forms — let the model read the one sentence and sort it into 'what to search for' and 'what to filter by' itself."*

---

## 3. Internal Flow: Query → Structured Parse → Filtered Search

```
   User's natural-language question
   "Show me articles about pricing from last month"
                    │
                    ▼
   ┌─────────────────────────────────────────────┐
   │  1. LLM PARSES the query                      │
   │  Prompted to output structured JSON:           │
   │  {                                             │
   │    "search_query": "pricing",                  │
   │    "filter": {"category": "pricing",           │
   │               "published_after": "2026-06-25"} │
   │  }                                             │
   └───────────────────┬───────────────────────────┘
                       ▼
   ┌─────────────────────────────────────────────┐
   │  2. Parse the JSON string into a real object  │
   │     (json.loads) — never trust raw text as     │
   │     directly usable                            │
   └───────────────────┬───────────────────────────┘
                       ▼
   ┌─────────────────────────────────────────────┐
   │  3. Validate the filter against the ACTUAL     │
   │     metadata schema (field names / types exist)│
   └───────────────────┬───────────────────────────┘
                       ▼
   ┌─────────────────────────────────────────────┐
   │  4. Query the vector store with BOTH:          │
   │     - the embedding of "search_query"          │
   │     - the structured filter as a `where` clause│
   │     (same metadata-filtering mechanism as       │
   │      Phases 6 and 7)                            │
   └─────────────────────────────────────────────────┘
```

The self-querying retriever is really just an LLM call inserted *before* the retrieval step you already know from Phases 5-8: instead of embedding the raw user question, you first ask an LLM to rewrite it into `(search_query, filter)`, then you run the exact same "embed + metadata-filtered search" you'd run manually if the user had filled out those two forms themselves.

---

## 4. Code Example: Parsing a Query into Search Text + Filter

**Step 1 — prompt an LLM to produce structured JSON.** The prompt needs to tell the model exactly what metadata fields exist, so it doesn't invent fields that aren't in your schema.

```python
import json
import anthropic
import chromadb

client = anthropic.Anthropic()

# A previously-populated Chroma collection (Phase 5 pattern) — every
# document was added with a "category" and "published_at" (ISO date string)
# metadata field at ingestion time. We never query an empty collection.
chroma_client = chromadb.PersistentClient(path="./chroma_data")
articles = chroma_client.get_or_create_collection(name="articles")

# The actual metadata schema this collection uses — the prompt below is
# built from this, so the model can't invent fields we don't have.
METADATA_SCHEMA = {
    "category": "string, one of: pricing, security, onboarding, integrations",
    "published_at": "string, ISO 8601 date, e.g. 2026-06-01",
}

SELF_QUERY_PROMPT = """You convert a user's natural-language question into a JSON
object with exactly two fields:

"search_query": a short string capturing the semantic topic to search for
  (strip out any date or category constraints — those go in "filter").
"filter": an object containing ONLY constraints that map to these exact
  metadata fields (omit fields that aren't mentioned in the question):
  {schema}

Respond with ONLY the JSON object, no other text. Today's date is 2026-07-25,
so resolve relative dates like "last month" against that.

User question: {question}
"""

def parse_query(question: str) -> dict:
    prompt = SELF_QUERY_PROMPT.format(
        schema=json.dumps(METADATA_SCHEMA, indent=2), question=question
    )
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = next(b.text for b in response.content if b.type == "text")

    # CRITICAL: the model's response is just a string. It must be parsed
    # into a real Python object before it's usable for anything — never treat
    # raw LLM text as directly queryable.
    parsed = json.loads(raw_text)
    return parsed
```

**Step 2 — validate the parsed filter before trusting it.** This is the step that's easy to skip and the one Common Mistakes below calls out explicitly: the LLM can hallucinate a field name or a value type that doesn't match your actual schema.

```python
def validate_filter(filter_dict: dict) -> dict:
    """Drop any filter key that isn't a real metadata field on this
    collection — never pass an unvalidated, model-generated filter
    straight into the vector store."""
    valid_keys = set(METADATA_SCHEMA.keys())
    cleaned = {k: v for k, v in filter_dict.items() if k in valid_keys}
    dropped = set(filter_dict.keys()) - valid_keys
    if dropped:
        print(f"Warning: dropped unknown filter fields: {dropped}")
    return cleaned
```

**Step 3 — query the vector store with both the semantic string and the validated filter.** This reuses the exact same metadata-filtering shape covered in Phases 6 (Pinecone) and 7 (pgvector) — here shown against the populated Chroma collection from Phase 5, using its `where` clause.

```python
def self_querying_retrieve(question: str, top_k: int = 5) -> list[str]:
    parsed = parse_query(question)
    search_query = parsed.get("search_query", question)
    filter_dict = validate_filter(parsed.get("filter", {}))

    # Chroma's `where` clause needs each condition wrapped in an operator when
    # there's more than one; here we build a simple equality filter per field.
    where_clause = None
    if len(filter_dict) == 1:
        (key, value), = filter_dict.items()
        where_clause = {key: value}
    elif len(filter_dict) > 1:
        where_clause = {"$and": [{k: v} for k, v in filter_dict.items()]}

    results = articles.query(
        query_texts=[search_query],
        n_results=top_k,
        where=where_clause,  # None means "no metadata filter, search everything"
    )
    return results["documents"][0] if results["documents"] else []


# "pricing" becomes the semantic query; "last month" becomes a
# published_at-based filter — resolved to an actual date by the LLM.
chunks = self_querying_retrieve("Show me articles about pricing from last month")
```

Note that `published_at` filtering with a "from last month" phrase in practice needs a range comparison (e.g. `$gte`) rather than pure equality — real self-querying implementations map relative date phrases to a `{"published_at": {"$gte": "2026-06-25"}}`-style range filter. The equality-only version above is kept simple for the sake of the walkthrough; extending `validate_filter` and the `where_clause` builder to handle range operators is Exercise 2 below.

---

## 5. Common Mistakes

**Mistake 1: Trusting the LLM's parsed filter blindly.** The single most important discipline in a self-querying retriever is validating the model's output against your *actual* metadata schema before using it. An LLM can confidently produce a filter like `{"date": "last-month"}` when your real field is named `published_at` and expects an ISO date string — or it can invent a category value that doesn't exist in your data at all. If you pass that straight into your vector store's `where` clause without validation, you get one of two bad outcomes: the query silently returns zero results (because no document has a `date` field), or — depending on the vector store's error handling — an outright query error. Always check parsed field names and value types against the real schema (as `validate_filter` does above) before using the filter, and treat a filter you can't validate as "no filter" rather than passing it through unchecked.

**Interview angle:** This is one of the most commonly probed failure modes for self-querying retrievers, and interviewers are specifically listening for whether you name the validation step unprompted. A strong answer says: the LLM's structured output must never be used directly against production data without checking field names and types against the real metadata schema first, because an unvalidated hallucinated filter fails silently (zero results) far more often than it errors loudly — and a system that "just returns nothing" for a valid question is much harder to debug than one that crashes.

---

## 6. Hands-On Exercises

### Exercise 1 — Trace a query through the full parse-validate-search pipeline

**Goal:** Confirm you understand every step before extending the code.

Call `self_querying_retrieve("What do we have on security from 2026-06-01 onward?")` and add print statements after each stage: the raw LLM text, the `json.loads`-parsed dict, the validated filter dict, and the final `where_clause`. Confirm the `category` field correctly resolves to `"security"` and that a date-related constraint appears in the filter (even if, per the note above, it's using simple equality rather than a proper range).

### Exercise 2 — Add range-filter support for relative dates

**Goal:** Fix the equality-only limitation called out in the code walkthrough.

Extend `METADATA_SCHEMA`'s prompt description and `validate_filter` so the LLM can express `{"published_at": {"$gte": "2026-06-25"}}` instead of a bare equality value, and update the `where_clause` builder to pass range-operator dicts straight through Chroma's `where` syntax. Test with "articles from the last month" versus "articles from exactly 2026-06-01" and confirm the two produce different filter shapes (a range vs. an equality).

### Exercise 3 — Break the validator on purpose

**Goal:** Build intuition for exactly the failure mode called out in Common Mistakes.

Temporarily edit `SELF_QUERY_PROMPT` to *not* include the metadata schema at all (just say "produce search_query and filter"), and ask a question involving a date. Observe the model likely invents a field name that doesn't match `METADATA_SCHEMA` (e.g. `"date"` instead of `"published_at"`). Confirm `validate_filter` correctly drops it and prints a warning, rather than passing an invalid filter through to Chroma. Then restore the schema-aware prompt and confirm the field name comes back correct.

---

## 7. Interview Q&A

### Q1. What problem does a self-querying retriever solve that plain semantic search doesn't?

**Answer:** A single natural-language question often mixes a semantic part (what topic to search for) with a structured, factual constraint (a date range, a category, an author) that has nothing to do with embedding similarity. Plain semantic search over the whole sentence handles the topic reasonably well but can't reliably honor the structured constraint, since phrases like "last month" don't correspond to a consistent embedding meaning. A self-querying retriever uses an LLM to split the question into a clean semantic search string plus a structured metadata filter, then applies both separately.

---

### Q2. Walk me through what a self-querying retriever actually does, step by step.

**Answer:** An LLM is prompted with the user's question and a description of the collection's real metadata schema, and asked to output JSON with two fields: a semantic `search_query` string and a structured `filter` object. That JSON text is parsed with `json.loads()` into a real object — never used as raw text — and the resulting filter is validated against the actual metadata field names and types before use. The validated filter and an embedding of the semantic query are then sent to the vector store together, exactly as in a normal metadata-filtered search from Phase 6 or 7.

---

### Q3. Why is it dangerous to pass the LLM's filter output straight into the vector store without validation?

**Answer:** The LLM can hallucinate a field name that doesn't exist in the actual metadata schema, or produce a value in the wrong type or format. Passed through unchecked, this usually fails silently — the query runs but matches zero documents, because no record has that field — which is much harder to notice and debug than a loud error. The fix is to always validate parsed field names and value types against the real schema before using the filter, and treat anything that doesn't validate as no filter at all rather than passing it through.

---

### Q4. How is this different from just embedding the whole natural-language question and searching?

**Answer:** Embedding the whole sentence treats every word, including date phrases and category names, as contributing to a single semantic vector — which is fine for the topic part but doesn't reliably capture exact structured constraints, since "last month" doesn't have a consistent, distinct embedding meaning the way an actual date range does. Self-querying separates the two: the topic goes through semantic embedding search as usual, while the structured constraint goes through the vector store's metadata filter mechanism (an exact `where`-clause match), which is the correct tool for exact, factual constraints.

---

### Q5. What would you do if the LLM's parsed filter references a category value that doesn't actually exist in your data?

**Answer:** Validate not just field names but, where practical, value membership too — for a fixed-enum field like `category`, check the parsed value against the real set of valid categories (as declared in the schema prompt) and drop or flag it if it doesn't match. This is the same discipline as validating field names: an invented value produces a filter that silently matches nothing, so catching it before the query runs (rather than debugging an empty result set afterward) is the safer default.

---

> 🧠 **Memory hook:** "One sentence, two forms — let the model sort 'what to search for' from 'what to filter by,' then check its filter against your real schema before you trust it."
