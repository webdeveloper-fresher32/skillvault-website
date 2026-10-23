# Transactions in Node — Complete Guide

> This lesson covers how to *use* transactions from Node code with Mongoose and Prisma. For transaction isolation levels, locking, and ACID theory in depth, see `../../Databases/MySQL/` and `../../Databases/MongoDB/` in this repo.

## Table of Contents
1. [Why Transactions Are Needed](#1-why-transactions-are-needed)
2. [The Motivating Example: Balance Transfer](#2-the-motivating-example-balance-transfer)
3. [Transactions with Mongoose Sessions](#3-transactions-with-mongoose-sessions)
4. [Transactions with Prisma `$transaction`](#4-transactions-with-prisma-transaction)
5. [Error Handling and Rollback](#5-error-handling-and-rollback)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Transactions Are Needed

A **transaction** groups multiple database operations into a single all-or-nothing unit: either every operation succeeds and is committed, or if any operation fails, all of them are rolled back as if none had happened. This is the "A" (Atomicity) and "C" (Consistency) in ACID.

```
Without a transaction:                  With a transaction:
Step 1: debit Account A  ✅ succeeds     BEGIN
Step 2: credit Account B  ❌ fails         Step 1: debit Account A
                                           Step 2: credit Account B
Result: money vanished — A is           If either fails → ROLLBACK (nothing happened)
        debited but B never credited    If both succeed → COMMIT (both happened)
        = inconsistent, corrupted data
```

In Node specifically, this matters because your application code makes multiple **separate, asynchronous** calls to the database — a crash, thrown error, or unhandled promise rejection between step 1 and step 2 leaves the database in a partially-updated, inconsistent state unless those calls are wrapped in a transaction.

---

## 2. The Motivating Example: Balance Transfer

Transferring money between two accounts is the textbook case: it requires **two writes** (debit one account, credit another) that must succeed or fail together.

```javascript
// DANGEROUS — no transaction. If the process crashes or the credit
// query throws between these two lines, money simply disappears.
async function transferUnsafe(fromId, toId, amount) {
  await Account.findByIdAndUpdate(fromId, { $inc: { balance: -amount } });
  // <-- if the app crashes right here, money is gone from A but never reaches B
  await Account.findByIdAndUpdate(toId, { $inc: { balance: amount } });
}
```

The fix in both Mongoose and Prisma is the same shape: open a transaction, perform both writes using that transaction's session/client, and commit only if both succeed.

---

## 3. Transactions with Mongoose Sessions

MongoDB transactions require a **replica set** (Atlas clusters and modern local setups are replica sets by default) — a standalone single-node `mongod` does not support multi-document transactions.

```javascript
const mongoose = require('mongoose');
const Account = require('./models/Account');

async function transferBalance(fromId, toId, amount) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fromAccount = await Account.findById(fromId).session(session);
    if (!fromAccount || fromAccount.balance < amount) {
      throw new Error('Insufficient funds');
    }

    await Account.findByIdAndUpdate(
      fromId,
      { $inc: { balance: -amount } },
      { session }
    );
    await Account.findByIdAndUpdate(
      toId,
      { $inc: { balance: amount } },
      { session }
    );

    await session.commitTransaction(); // both writes become permanent together
    return { success: true };
  } catch (err) {
    await session.abortTransaction(); // both writes are undone together
    throw err;
  } finally {
    session.endSession();
  }
}
```

```javascript
// Express route
router.post('/transfer', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  try {
    await transferBalance(fromId, toId, amount);
    res.json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

**Key rule:** every query inside the transaction must explicitly pass `{ session }` (or `.session(session)`) — a query that forgets to attach the session runs **outside** the transaction and defeats the whole point.

| Mongoose Session Method | Purpose |
|---------------------------|---------|
| `mongoose.startSession()` | Create a session tied to a transaction |
| `session.startTransaction()` | Begin the transaction |
| `session.commitTransaction()` | Persist all operations atomically |
| `session.abortTransaction()` | Roll back all operations |
| `session.endSession()` | Always clean up, in a `finally` block |

---

## 4. Transactions with Prisma `$transaction`

Prisma offers two styles: an **array-based** transaction (simpler, less flexible) and an **interactive** transaction (a callback, needed when later queries depend on earlier results — like our balance check).

### Array-based (independent operations)

```javascript
// All three succeed together or none do — but they can't depend on each other's results
const [account1, account2] = await prisma.$transaction([
  prisma.account.update({ where: { id: fromId }, data: { balance: { decrement: amount } } }),
  prisma.account.update({ where: { id: toId }, data: { balance: { increment: amount } } }),
]);
```

### Interactive transaction (needed for our balance-transfer example)

```javascript
async function transferBalance(fromId, toId, amount) {
  return prisma.$transaction(async (tx) => {
    const fromAccount = await tx.account.findUnique({ where: { id: fromId } });

    if (!fromAccount || fromAccount.balance < amount) {
      throw new Error('Insufficient funds'); // throwing here rolls back automatically
    }

    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });

    return { success: true };
  });
}
```

```javascript
// Express route
router.post('/transfer', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  try {
    await transferBalance(fromId, toId, amount);
    res.json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

Inside an interactive transaction, `tx` is a special Prisma client scoped to the transaction — use `tx.account...` instead of `prisma.account...` for every query that must participate in the atomic unit. Throwing any error inside the callback automatically rolls back everything; Prisma commits automatically only if the callback resolves successfully.

| Prisma Transaction Style | When to use |
|-----------------------------|-------------|
| `prisma.$transaction([...])` (array) | A fixed batch of independent writes, no branching logic between them |
| `prisma.$transaction(async (tx) => {...})` (interactive) | Later operations depend on earlier query results (reads, conditionals) — like our funds check |

---

## 5. Error Handling and Rollback

| Concern | Mongoose | Prisma |
|---------|----------|--------|
| Start | `session.startTransaction()` | Entering the `$transaction` call |
| Commit | `session.commitTransaction()` (explicit) | Automatic, if the callback resolves / array all succeeds |
| Rollback | `session.abortTransaction()` (explicit, in `catch`) | Automatic, if the callback throws / any array item fails |
| Cleanup | `session.endSession()` (explicit, in `finally`) | Automatic — Prisma manages the connection |
| Timeout | No default; configure manually if needed | Default timeout (~5s) before the transaction is aborted |

**Common mistakes:**
- Forgetting to attach `{ session }` to a Mongoose query inside a transaction — it silently runs outside the transaction.
- Doing slow, non-database work (an external API call, heavy computation) inside a transaction — it holds locks/resources for longer than necessary and risks hitting the transaction timeout.
- Not validating business rules (like "sufficient funds") *inside* the transaction — checking before starting the transaction leaves a race-condition window where the balance could change between the check and the write.

---

## 6. Hands-On Exercises

**Exercise 1:** Using Mongoose, build the `Account` model (`owner`, `balance`) and the `transferBalance` function above. Manually trigger a failure (e.g., transfer more than the balance) and verify via `Account.find()` that neither account's balance changed.

**Exercise 2:** Repeat Exercise 1 with Prisma's interactive `$transaction`, using a Postgres `Account` model.

**Exercise 3:** Modify the transfer function to also insert a `Transaction` record (audit log: `fromId`, `toId`, `amount`, `timestamp`) as a third operation inside the same transaction. Verify that if the audit-log insert fails, the balance changes are also rolled back.

**Exercise 4:** Deliberately simulate a mid-transaction crash (e.g., `throw new Error('simulated crash')` between the two updates) and confirm via direct queries that the database is left in its original state, not a half-updated one.

**Exercise 5:** Compare the array-based and interactive Prisma transaction styles by rewriting the transfer example both ways — try to make the array-based version handle the "insufficient funds" check, and explain in a comment why it can't cleanly do so.

---

## 7. Interview Q&A

**Q: Why is a transaction necessary for a balance transfer between two accounts?**
Answer: A transfer requires two separate writes — debiting one account and crediting another. If these run as independent, unguarded operations and the process crashes, throws, or the second write fails after the first succeeds, the database ends up in an inconsistent state — money debited from one account never arrives in the other. A transaction guarantees both writes commit together or neither does, preserving atomicity and consistency (the "A" and "C" in ACID).

**Q: How do you run a transaction with Mongoose, and what's the most common mistake developers make?**
Answer: You call `mongoose.startSession()`, then `session.startTransaction()`, pass `{ session }` to every query that should participate, and finish with `session.commitTransaction()` on success or `session.abortTransaction()` in a catch block, always calling `session.endSession()` in a `finally`. The most common mistake is forgetting to attach `{ session }` to one of the queries — that query then executes outside the transaction and isn't rolled back if the transaction later aborts.

**Q: What's the difference between Prisma's array-based `$transaction` and its interactive `$transaction` with a callback?**
Answer: The array-based form (`prisma.$transaction([query1, query2])`) runs a fixed, independent batch of operations atomically but can't branch on intermediate results. The interactive form (`prisma.$transaction(async (tx) => {...})`) gives you a scoped client `tx` to run reads and writes sequentially inside a callback, so later operations can depend on earlier results — necessary whenever you need to check a condition (like sufficient balance) before deciding what to write next.

**Q: Why does MongoDB require a replica set to support multi-document transactions?**
Answer: MongoDB's transaction implementation relies on the oplog (operations log) used for replication to provide a consistent snapshot and to coordinate commit/rollback across documents and shards. A standalone single-node `mongod` has no oplog, so it cannot support multi-document ACID transactions — only single-document operations (which are always atomic in MongoDB regardless of replica set status).

**Q: What happens if an error is thrown inside a Prisma interactive transaction callback?**
Answer: Prisma automatically catches the thrown error, rolls back every operation performed inside that callback via `tx`, and re-throws the error out of `$transaction` for your calling code to handle — you never call an explicit rollback method yourself, unlike Mongoose's `session.abortTransaction()`.

**Q: Why should you check business rules like "sufficient balance" inside the transaction rather than before starting it?**
Answer: Checking before the transaction begins creates a race condition — between the check and the actual debit, a concurrent request could change the balance, making the earlier check stale. Performing the read and the conditional check inside the same transaction (using the transaction's session/client) ensures the check and subsequent write are part of one atomic, isolated unit, preventing lost updates under concurrency.
