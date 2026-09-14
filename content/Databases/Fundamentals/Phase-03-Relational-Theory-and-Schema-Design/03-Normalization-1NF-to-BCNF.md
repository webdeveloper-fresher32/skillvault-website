# Normalization 1NF to BCNF — Complete Guide

> "When every department keeps its own photocopy of the staff phone list, one person changing desk means hunting down eleven copies, and the copy you miss is the one somebody reads."

---

## Table of Contents

1. [The Problem: One Table That Cannot Be Edited Safely](#1-the-problem-one-table-that-cannot-be-edited-safely)
2. [The Photocopied Phone List Analogy](#2-the-photocopied-phone-list-analogy)
3. [The Mechanism: Functional Dependencies](#3-the-mechanism-functional-dependencies)
4. [Diagram: The Decomposition Staircase](#4-diagram-the-decomposition-staircase)
5. [Code Walkthrough: Fixing One Normal Form at a Time](#5-code-walkthrough-fixing-one-normal-form-at-a-time)
6. [Comparing 3NF to BCNF](#6-comparing-3nf-to-bcnf)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: One Table That Cannot Be Edited Safely

One table records which students take which courses. It reads fine and fails at every kind of write.

### The Running Table and Its Three Anomalies

```text
enrolment  PK = {student_id, course_code}
 sid   name        phones                  code   title      dept head
 S001  Amira Khan  0161-4455, 07700-900123 CS210  Databases  CS   Bianchi
 S001  Amira Khan  0161-4455, 07700-900123 CS330  Compilers  CS   Bianchi
 S002  Tom Weller  0161-9087               CS210  Databases  CS   Bianchi
 S003  Lin Zhao    0161-2213               MA101  Calculus   MA   Adeyemi
```

```text
UPDATE → rename CS210 and two rows must change together; miss one and
  the same course has two names.
INSERT → MA205 exists but nobody enrolled, and there is no row to put
  it in: sid is half the key and cannot be NULL.
DELETE → Lin Zhao withdraws and MA101 dies with her single row.
```

### What's Missing

All three failures have one cause: facts about students, courses, and departments are stored in the same row as the fact about an enrolment. Normalization separates them, and functional dependencies are the tool that says where the seams are.

---

## 2. The Photocopied Phone List Analogy

A company with no central directory lets each department photocopy the staff phone list. Reading a number is fast; everything else is a hazard. One person changing desk means eleven copies to correct, a new hire with no department yet has nowhere to be written down, and closing a department shreds the only record of two people's numbers.

### Photocopies vs One Master List

```text
Eleven photocopies → one change means eleven edits, and the copy you
                     miss is the one somebody reads
Nowhere to file    → a new hire with no department yet has no
                     photocopy to be written into
Shredded copy      → closing a department destroys the only record
                     of everyone who worked in it
One master list    → each fact written once, in the table owning it
```

### Mapping the Analogy to Normalization

The photocopies are redundant rows, and the three hazards are the update, insert, and delete anomalies from Section 1. Normalization builds the master list: it finds every fact stored more than once and moves it to the one table whose key actually determines it.

---

## 3. The Mechanism: Functional Dependencies

Normal forms are defined entirely in terms of functional dependencies, so the dependencies come first. They are drawn from business rules, never from the rows that happen to be loaded.

### What a Functional Dependency Is

```text
X → Y  reads "X functionally determines Y": any two rows agreeing on
       every attribute of X must agree on every attribute of Y.
  student_id → name                course_code → title, dept
  dept       → head                {student_id, course_code} → grade
  ↳ Read each aloud as a rule: "a course code determines its title" is
    a claim about the university, not about these four rows.
```

### Full Partial and Transitive Dependencies

```text
Prime    → an attribute belonging to some candidate key
Full     → Y depends on ALL of X      {sid, code} → grade
Partial  → Y depends on PART of X     {sid, code} → name
Transit. → X → Z through a non-prime  code → dept → head

1NF  → every attribute holds one atomic value; no repeating groups
2NF  → 1NF, plus no non-prime attribute depends on part of a key
       (only possible at all when a candidate key is composite)
3NF  → 2NF, and no non-prime attribute depends on another non-prime
BCNF → for every non-trivial X → Y, X is a superkey. No exceptions
```

---

## 4. Diagram: The Decomposition Staircase

Each step removes one class of dependency, and one class of anomaly leaves with it.

### The Staircase

```text
enrolment (phones holds "0161-4455, 07700-900123")
   ▼ 1NF: one value per cell
enrolment(sid, code, name, title, dept, head, grade) + student_phone
   ├──► student(sid, name)      ├──► course(code, title, dept, head)
   ▼ 2NF: kill partial dependencies on {sid, code}
enrolment(sid, code, grade)                              ← final
   ├──────────► department(dept, head)
   ▼ 3NF: kill the transitive code → dept → head
course(code, title, dept)                                ← final
tutorial(sid, subject, tutor) is already in 3NF
   ├──────────► tutor(tutor, subject)      BCNF: tutor → subject,
   ▼                                       not a superkey
student_tutor(sid, tutor)                                ← final
```

### Reading the Diagram

Nothing is thrown away: each step replaces one relation with two whose natural join reconstructs it exactly, which is what "lossless" means. Order matters only because 2NF violations hide 3NF violations — `dept → head` is hard to see while `dept` is still repeated on every enrolment row.

---

## 5. Code Walkthrough: Fixing One Normal Form at a Time

Each fix is shown with the anomaly it removes, on the running table from Section 1.

### 1NF and 2NF: Repeating Groups and Partial Dependencies

```text
1NF: the repeating group leaves the row
     student_phone(student_id, phone)          PK {student_id, phone}
2NF: name depended on sid alone, title and dept on code alone
     student(student_id, name)
     course(code, title, dept, head)
     enrolment(student_id, code, grade)        PK {student_id, code}
  ↳ INSERT gone: MA205 with no students is one row in course. UPDATE
    gone: a title exists in one row. DELETE gone: Lin Zhao's enrolment
    can go and MA101 stays.
```

```sql
-- Illustrative standard SQL.
CREATE TABLE enrolment (
    student_id CHAR(4) NOT NULL REFERENCES student (student_id),
    code       CHAR(5) NOT NULL REFERENCES course (code),
    grade      CHAR(2),
    PRIMARY KEY (student_id, code)
);
```

### 3NF: The Transitive Dependency

```text
Still broken inside course: code → dept → head
  CS210  Databases  CS  Bianchi
  CS330  Compilers  CS  Bianchi   ← head repeated once per course
  ↳ Replacing Bianchi means updating every CS row together, and a new
    department with no courses cannot be recorded at all.
```

```sql
CREATE TABLE department (dept CHAR(2) PRIMARY KEY,
                         head VARCHAR(120) NOT NULL);
ALTER TABLE course DROP COLUMN head;
ALTER TABLE course ADD FOREIGN KEY (dept) REFERENCES department;
```

### BCNF: The Overlapping Key

```text
tutorial(student_id, subject, tutor): a tutor teaches one subject; a
student has one tutor per subject.
  S001 Statistics Rossi | S002 Statistics Rossi | S001 Databases Okafor
FDs: {student_id, subject} → tutor   and   tutor → subject
Candidate keys: {student_id, subject} and {student_id, tutor}
  ↳ Every attribute is prime, so this is 3NF. But tutor → subject has
    a determinant that is not a superkey, so it fails BCNF, and the
    anomaly is real: "Rossi teaches Statistics" cannot be recorded
    until a student is assigned, and dies with the last one.
BCNF fix:  tutor(tutor, subject)  +  student_tutor(student_id, tutor)
```

---

## 6. Comparing 3NF to BCNF

The two forms differ in one clause, and that clause only bites when candidate keys overlap.

### 3NF vs BCNF

| | 3NF | BCNF |
|---|---|---|
| Rule | Non-prime attributes must not depend on non-keys | Every determinant must be a superkey |
| Decomposition | Lossless and dependency-preserving | Lossless, sometimes loses a dependency |

### Takeaway

Aim for BCNF and accept 3NF when the BCNF split would scatter a constraint you need enforced in one place — after splitting `tutorial`, no single table can enforce `{student_id, subject} → tutor`, so that rule moves into application code or a trigger. Beyond BCNF, 4NF concerns multivalued dependencies (two independent many-valued facts sharing a table, such as a lecturer's courses and the languages they speak, producing a row per combination) and 5NF concerns join dependencies, where a relation only decomposes losslessly into three or more parts. Both are real and both are already prevented by a schema where each table describes one thing, which is exactly what the ER modelling in Lesson 2 produces.

---

## 7. Common Mistakes

- **Inferring functional dependencies from the sample data.** Every student in the current table has one phone number, so `student_id → phone` looks true and the repeating group looks unnecessary. Dependencies are business rules: the question is whether the rule must hold, not whether today's rows happen to satisfy it.
- **Treating 1NF atomicity as a ban on structured column types.** 1NF forbids a column whose value is a repeating group the application has to split apart before it can query it. An array or JSON column the engine indexes and queries as a first-class type is a different conversation, and the real test is whether the contents need their own keys and constraints — if they do, they need their own table.
- **Normalizing to 3NF and immediately undoing it because a join felt slow.** A join on an indexed foreign key is not a performance problem until it has been measured as one, and the correct order is normalize, measure, then denormalize deliberately with the safeguards in Lesson 4.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the unnormalised `enrolment` table with all four rows from Section 1, storing `phones` as one comma-separated column. Write out its functional dependencies and identify its primary key.

**Exercise 2:** Reproduce all three anomalies. Run an `UPDATE` renaming CS210 that touches only one row and confirm the two names disagree; attempt to insert MA205 with no student; delete Lin Zhao's row and confirm MA101 no longer exists anywhere in the database.

**Exercise 3:** Build the 2NF schema from Section 5, migrate the four rows into it, then repeat all three attempts from Exercise 2 and confirm each now either succeeds cleanly or is correctly rejected.

**Exercise 4:** Before applying the 3NF fix, insert a second CS course, update `head` on only one CS row, and confirm the table disagrees with itself. Then split out `department` and confirm the same update is now impossible to get wrong.

**Exercise 5:** Build `tutorial(student_id, subject, tutor)` with the three rows from Section 5 and confirm it satisfies 3NF by checking that every attribute is prime. Attempt to record that Rossi teaches Statistics with no student assigned, decompose to BCNF, confirm the fact is now storable, and write down which constraint you can no longer enforce with a key.

---

## 9. Interview Q&A

**Q: What is a functional dependency and where does it come from?**
X functionally determines Y when any two rows agreeing on X must agree on Y — a course code determines its title, a department determines its head. It comes from the business rules, not from inspecting the data, and that distinction is the one that matters most in practice. A dependency that merely happens to hold across today's rows produces a schema that breaks the first time a legitimate counterexample arrives.

**Q: Walk me through 2NF and 3NF with an example.**
2NF only applies when the primary key is composite: it forbids a non-key attribute depending on part of that key. In an enrolment table keyed on student plus course, the student's name depends on the student half alone, so it belongs in a student table. 3NF then forbids a non-key attribute depending on another non-key attribute — the course row carries a department and the department determines its head, so the head belongs in a department table keyed on department.

**Q: What is the difference between 3NF and BCNF?**
3NF tolerates a dependency whose determinant is not a superkey as long as the dependent attribute is prime; BCNF removes that exception entirely and requires every determinant to be a superkey. They differ only when a relation has overlapping candidate keys, which is why most schemas that reach 3NF are already in BCNF. The standard counterexample is a tutorial table where each tutor teaches one subject and a student has one tutor per subject.

**Q: Is a BCNF decomposition always safe?**
It is always lossless — the natural join of the parts reconstructs the original exactly — but it is not always dependency-preserving. Splitting the tutorial table means no single table can enforce "one tutor per student per subject" any more, so that rule has to move into application code or a trigger. When the constraint matters more than the anomaly, stopping at 3NF is a defensible engineering decision rather than a failure.

**Q: Why do 4NF and 5NF come up so rarely?**
4NF deals with two independent multivalued facts sharing one table, and 5NF with relations that only decompose losslessly into three or more pieces. Both violations require putting genuinely unrelated many-valued facts into the same relation, which a schema derived from a proper entity-relationship model does not do in the first place. They are worth being able to name in an interview, but a table that reached BCNF from a sane ER model is usually already past both.
