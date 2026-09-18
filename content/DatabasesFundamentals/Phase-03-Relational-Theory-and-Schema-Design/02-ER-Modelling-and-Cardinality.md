# ER Modelling and Cardinality — Complete Guide

> "Nobody pours a foundation straight from the sentence 'we want three bedrooms and lots of light' — an architect draws a floor plan first, because moving a wall on paper costs nothing and moving it in brick costs a fortune."

---

## Table of Contents

1. [The Problem: Prose That Does Not Say What the Tables Are](#1-the-problem-prose-that-does-not-say-what-the-tables-are)
2. [The Architect's Floor Plan Analogy](#2-the-architects-floor-plan-analogy)
3. [The Mechanism: Entities Relationships and Crow's Foot Cardinality](#3-the-mechanism-entities-relationships-and-crows-foot-cardinality)
4. [Diagram: The Library ER Model](#4-diagram-the-library-er-model)
5. [Code Walkthrough: Turning the Diagram into Tables](#5-code-walkthrough-turning-the-diagram-into-tables)
6. [Comparing an ER Diagram to a List of Tables](#6-comparing-an-er-diagram-to-a-list-of-tables)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Prose That Does Not Say What the Tables Are

Requirements arrive as sentences. Sentences name things, describe things, and connect things, but they never say which noun deserves a table and which is only a column.

### The Requirement and the First Wrong Schema

```text
"The library lends books to members. A book has a title, an ISBN and a
 publication year, and may be written by several authors; an author
 writes several books. The library owns several physical copies of a
 book, each with its own barcode and shelf. A member borrows a copy on
 a date, is given a due date, and returns it later. Every past loan
 must stay on record."

First attempt, straight from the sentence:
  loan(member_name, book_title, author, barcode, borrowed_on, due_on)
  ↳ Is "author" one value or several? Is "barcode" a fact about the
    book or about something else? Where does a book with no copies
    on the shelf live? The sentence answers none of this.
```

### What's Missing

The gap between prose and DDL is a step where nouns are sorted into entities and attributes, verbs are examined to see whether they carry facts of their own, and every connection is given a count and an optionality. That intermediate artefact is the entity-relationship model.

---

## 2. The Architect's Floor Plan Analogy

An architect does not translate a client's wishes directly into poured concrete. They draw a plan: rooms as boxes, doors between them, dimensions on every wall. The plan is what the client argues with, and every argument is cheap while it is still ink.

### Wishes vs Plan vs Building

```text
Client's sentences → "three bedrooms, a study that can become a
                      nursery, lots of light"
Floor plan         → rooms as boxes, doors between them, every
                      dimension written down and checkable
Built house        → walls, plumbing, wiring; moving a wall now means
                      demolition and a skip in the driveway
```

### Mapping the Analogy to ER Modelling

The requirement text is the client's wishes, the ER diagram is the floor plan, and the DDL plus the data already loaded into it is the built house. Cardinality and optionality are the dimensions written on the walls: without them the plan looks finished but cannot be built from, because "a member has loans" does not say whether a brand-new member with zero loans is legal.

---

## 3. The Mechanism: Entities Relationships and Crow's Foot Cardinality

An ER model has exactly three kinds of thing in it, and the discipline is deciding which of the three each noun in the requirement is.

### Entity Attribute Relationship

```text
Entity type  → a thing the business keeps facts about: book, member
Entity       → one instance of it: the member with card number 40912
Attribute    → a single fact about an entity: title, due_on, email
Identifier   → the attribute(s) that pick out one entity: isbn
Relationship → a named association, always a verb: member borrows copy
Weak entity  → one that cannot be identified without its parent
```

### Crow's Foot Cardinality and Optionality

```text
Two markers sit on each end of a line: the one nearest the entity is
the MAXIMUM, the one behind it the MINIMUM.

  ──││   exactly one     min 1, max 1   (mandatory, single)
  ──o│   zero or one     min 0, max 1   (optional,  single)
  ──│<   one or many     min 1, max N   (mandatory, multiple)
  ──o<   zero or many    min 0, max N   (optional,  multiple)
```

### Reading a Relationship in Both Directions

```text
member ──││────────o<── loan
  ↳ left to right: one member has zero or many loans
  ↳ right to left: one loan belongs to exactly one member

Every line is read twice, and each reading is a sentence a domain
expert can agree or disagree with. A line you can only read in one
direction has not been thought through yet.
```

---

## 4. Diagram: The Library ER Model

Applying those three questions to the requirement in Section 1 produces five entity types, not one table.

### The Model

```text
  ┌──────────┐ ││ one       zero or many o<  ┌─────────────┐
  │  author  │────────────────────────────────│ book_author │
  └──────────┘                                └──────┬──────┘
                                   zero or many o<   │
  ┌──────────────────────────────────────┐           │
  │   book     isbn · title · year       │─── ││ one ─┘
  └───────────────────┬──────────────────┘
                     ││ one
                     o< zero or many
  ┌───────────────────┴──────────────────┐
  │ book_copy  barcode · shelf           │
  └───────────────────┬──────────────────┘
                     ││ one
                     o< zero or many
  ┌───────────────────┴──────────────────┐ o< many  ┌──────────┐
  │ loan   borrowed_on · due_on ·        │──────────│  member  │
  │        returned_on (NULL = still out)│  ││ one  └──────────┘
  └──────────────────────────────────────┘
```

### Reading the Diagram

`borrows` was a verb in the requirement, but it carries facts of its own — a borrow date, a due date, a return date — and it must be kept after the book comes back. A verb with attributes and history is an entity, so it became `loan`. `book_author` is the opposite case: a verb with nothing but the pair itself, so it stays a plain junction. `book_copy` exists because barcode and shelf are facts about a physical object, not about a title, and a library with three copies of the same ISBN has three of them.

---

## 5. Code Walkthrough: Turning the Diagram into Tables

Once the diagram is agreed, the translation into DDL is mechanical.

### The Translation Rules

```text
Entity type → a table   Attribute → a column   Identifier → PRIMARY KEY
1:N relationship   → FK column on the N side; NOT NULL when that side's
                     participation is mandatory, nullable when optional
M:N relationship   → a new table with an FK to each side, the pair as PK
Relationship with
its own attributes → a table of its own, never a column
```

### The Resulting DDL

```sql
-- Illustrative standard SQL.
CREATE TABLE book (
    isbn           CHAR(13)     PRIMARY KEY,
    title          VARCHAR(300) NOT NULL,
    published_year SMALLINT
);
CREATE TABLE book_author (            -- M:N resolved
    isbn      CHAR(13) NOT NULL REFERENCES book (isbn) ON DELETE CASCADE,
    author_id BIGINT   NOT NULL REFERENCES author (author_id),
    PRIMARY KEY (isbn, author_id)
);
CREATE TABLE book_copy (              -- 1:N, mandatory parent
    barcode VARCHAR(20) PRIMARY KEY,
    isbn    CHAR(13)    NOT NULL REFERENCES book (isbn),
    shelf   VARCHAR(20)
);
CREATE TABLE loan (                   -- the promoted relationship
    loan_id     BIGINT      PRIMARY KEY,
    barcode     VARCHAR(20) NOT NULL REFERENCES book_copy (barcode),
    member_id   BIGINT      NOT NULL REFERENCES member (member_id),
    borrowed_on DATE        NOT NULL,
    due_on      DATE        NOT NULL,
    returned_on DATE                  -- NULL means still out
);
```

---

## 6. Comparing an ER Diagram to a List of Tables

Both artefacts describe the same schema, and a competent developer can read either. They are not interchangeable when the schema is still being decided.

### ER Diagram vs Table List

| | ER diagram | List of tables |
|---|---|---|
| Audience | Domain experts who know books but not SQL | Developers only |
| States optionality | Yes, visually, on both ends of every line | Only indirectly, via NOT NULL |
| Cost of a change | Redraw a line | Migration, backfill, deploy |
| What it hides | Column types and indexes | Which verbs were rejected |

### Takeaway

The diagram's real value is that it is reviewable by someone who cannot read DDL, and that is exactly the person who knows whether a loan can exist without a member. Once the model is agreed the diagram stops being the source of truth and the DDL takes over, so a diagram nobody updates afterwards is not a failure of the technique — it did its job during the argument.

---

## 7. Common Mistakes

- **Turning every verb into a table, or none of them.** `borrows` deserved its own table because it carries dates and must survive the return; `writes` did not, because nothing about the pairing is worth recording beyond the pairing. The test is whether the relationship has attributes or a lifecycle of its own, not whether it is grammatically a verb.
- **Leaving an attribute that is really an entity as a column.** Storing `shelf` and `barcode` on `book` looks fine until the library buys a second copy, at which point the row has to be duplicated with a different barcode and the title is repeated. If an attribute can have more than one value per row, it is a separate entity.
- **Missing a many-to-many because the current data only shows one.** Every book in the sample data has one author, so `book.author_name` seems adequate — until the first co-authored title arrives and someone writes `'Ahmed and Novak'` into the column. Model the rule the domain allows, not the rows that happen to exist today.
- **Drawing cardinality but not optionality.** "One member has many loans" leaves the important question unanswered: is a member with zero loans legal? The answer decides whether the FK is nullable and whether the join in every report has to be an outer join.

---

## 8. Hands-On Exercises

**Exercise 1:** Take the requirement text in Section 1 and list every noun in it. Mark each one as entity, attribute, or neither, and write one sentence justifying each choice. You should end with five entities.

**Exercise 2:** Draw the crow's foot line between `member` and `loan` and write out both readings in full sentences. Then do the same for `book` and `book_copy`, and state explicitly whether a book with zero copies is allowed.

**Exercise 3:** Create all five tables from Section 5 in any SQL engine, plus `author` and `member`. Insert one book with two authors and two physical copies, then one open loan, and confirm every constraint accepts the data.

**Exercise 4:** Extend the model to add reservations: a member may reserve a book (not a specific copy), and a book may be reserved by many members with a queue position. Decide whether `reserves` is a junction or a promoted entity, justify it, then write the DDL.

**Exercise 5:** Reproduce the third mistake from Section 7. Drop `book_author` and add `author_name VARCHAR(200)` to `book`, insert a co-authored title as `'Ahmed and Novak'`, then try to write a query listing every book by Novak. Confirm it either misses rows or matches the wrong ones, then restore the junction table and write the correct join.

---

## 9. Interview Q&A

**Q: How do you decide whether something in a requirement is an entity or an attribute?**
The practical test is whether it has facts of its own and whether more than one of it can belong to a single parent row. A book's title is a single value per book, so it is an attribute; a physical copy has its own barcode and shelf and there can be several per book, so it is an entity. If you find yourself wanting to put a list into a column, you have found an entity.

**Q: When does a relationship become a table of its own rather than a foreign key?**
Always for many-to-many, because a column cannot hold several values. Additionally for any relationship that carries its own attributes or has a lifecycle — a loan has a borrow date, a due date, and a return date, and it must survive after the book comes back. A relationship with no attributes and a one-to-many shape is just a foreign key column on the many side.

**Q: What does optionality add that cardinality alone does not?**
Cardinality says how many, optionality says whether zero is allowed, and the second one is what determines nullability and join type. "A loan belongs to one member" makes the foreign key NOT NULL; "a member may have no loans" means any report joining the two needs an outer join or it silently drops brand-new members. Diagrams that show only one-to-many without the minimum are the usual source of that bug.

**Q: What is a weak entity?**
An entity that cannot be identified without its parent — its identifier is only unique within the scope of that parent, and it has no meaning if the parent is removed. An order line identified by order number plus line number is the standard example. In practice this maps to a composite primary key that includes the parent's key, and usually to ON DELETE CASCADE.

**Q: How do you spot a hidden many-to-many early?**
Ask the domain expert the question in both directions and insist on the maximum, not the typical case. "Can a book have more than one author" gets a yes even when every book currently loaded has one, and that yes is the answer that matters. Modelling from the sample data rather than the business rule is what produces `author_name` columns containing the word "and".
