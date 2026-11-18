import { QuickReferenceTopic } from './types';

export const asyncCategory6AdvancedProblems: QuickReferenceTopic[] = [
  {
    id: 'async-race-conditions',
    number: 15,
    title: 'Race Conditions',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Advanced Asynchronous Problems',
    categorySlug: 'advanced-async-problems',
    estimatedMinutes: 5,
    concept30Sec:
      'A race condition occurs when the correctness of a program depends on the relative timing or order of uncontrollable asynchronous operations. Even though Node.js executes JavaScript on a single thread, asynchronous gaps (such as await or callbacks) allow concurrent requests to interleave, causing classic "read-modify-write" data corruption.',
    internals: {
      overview:
        'Between the time an asynchronous function reads a state (e.g., const balance = await db.getBalance()) and the time it writes the updated value back (await db.setBalance(balance - 100)), the single thread yields execution. Other incoming HTTP requests execute in that window, reading the stale balance. Both requests calculate new balances from the same initial number, overwriting each other and causing double-spending or lost updates.',
      flowSteps: [
        '1. Request 1 arrives: Reads balance = $500. Suspends at await.',
        '2. Request 2 arrives: Event loop services Request 2 during Request 1 suspension. Reads balance = $500.',
        '3. Request 1 resumes: Calculates 500 - 400 = 100. Writes balance = $100.',
        '4. Request 2 resumes: Calculates 500 - 300 = 200. Writes balance = $200.',
        '5. Data Inconsistency: $700 total was withdrawn from a $500 balance, but final balance shows $200! (Lost Update).',
        '6. Fixes: 1) Atomic DB statements (UPDATE ... SET balance = balance - 100 WHERE balance >= 100); 2) Pessimistic row locking (SELECT ... FOR UPDATE); 3) Optimistic Concurrency Control (OCC) using version columns.'
      ],
      diagram: `THE ASYNC RACE CONDITION (READ-MODIFY-WRITE FLAW):

Time    Request 1 (Withdraw $400)         Request 2 (Withdraw $300)
---------------------------------------------------------------------
T1      Read balance ($500)
T2         [ Awaits DB / Suspends ] -----> Read balance ($500 - STALE!)
T3      Calculate: $500 - $400 = $100        [ Awaits DB / Suspends ]
T4      Write balance: $100 <------------ Resume
T5                                        Calculate: $500 - $300 = $200
T6                                        Write balance: $200 (OVERWRITES $100!)
---------------------------------------------------------------------
CRITICAL BUG: Withdrew $700 from $500 account; final balance is $200!`
    },
    codeExample: {
      code: `// FLAWED: In-memory Read-Modify-Write Race Condition
let bankBalance = 500;

async function withdrawFlawed(amount, requestId) {
  console.log(\`[\${requestId}] Reading balance: \$\${bankBalance}\`);
  // Simulating async DB query latency: yields event loop!
  await new Promise((res) => setTimeout(res, 20));

  if (bankBalance >= amount) {
    bankBalance -= amount;
    console.log(\`[\${requestId}] Approved \$\${amount}! New balance: \$\${bankBalance}\`);
    return true;
  }
  console.log(\`[\${requestId}] Rejected! Insufficient funds.\`);
  return false;
}

// 2 Concurrent withdrawals fired at the same time:
Promise.all([
  withdrawFlawed(400, 'REQ_1'),
  withdrawFlawed(300, 'REQ_2')
]).then(() => {
  console.log('Final Corrupted Balance:', bankBalance); // Expect bug!
});`,
      language: 'javascript',
      output: `[REQ_1] Reading balance: $500
[REQ_2] Reading balance: $500
[REQ_1] Approved $400! New balance: $100
[REQ_2] Approved $300! New balance: $-200
Final Corrupted Balance: -200`,
      whyOutput:
        'Both REQ_1 and REQ_2 read bankBalance as $500 before either deducts funds. Because execution yields at await, both pass the if (bankBalance >= amount) check. Total $700 is withdrawn from a $500 balance, ending in negative balance.'
    },
    nodeJsApplication: {
      scenario: 'Fixing Financial Transactions via Pessimistic Row Locking and Atomic Queries',
      description:
        'In high-throughput e-commerce and banking backends, race conditions are prevented at the database layer using pessimistic row locking (SELECT ... FOR UPDATE) inside transactions, or atomic conditional updates.',
      codeSnippet: `// 1. Solution via Single Atomic SQL Update (Best Performance)
async function withdrawAtomic(accountId, amount) {
  const result = await db.query(
    \`UPDATE accounts
     SET balance = balance - $1
     WHERE id = $2 AND balance >= $1
     RETURNING balance\`,
    [amount, accountId]
  );

  if (result.rowCount === 0) {
    throw new Error('Transaction failed: Insufficient funds or account not found');
  }
  return result.rows[0].balance;
}

// 2. Solution via Pessimistic Row Lock (PostgreSQL)
async function transferWithPessimisticLock(client, fromId, toId, amount) {
  await client.query('BEGIN');
  // SELECT ... FOR UPDATE locks the row at the DB engine level!
  const res = await client.query('SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [fromId]);
  if (res.rows[0].balance < amount) {
    await client.query('ROLLBACK');
    throw new Error('Insufficient funds');
  }
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'If JavaScript is single-threaded, how can race conditions occur in Node.js?',
          spokenAnswer:
            'While JavaScript executes code on a single thread without parallel thread race conditions, Node.js applications are inherently concurrent. Every time an asynchronous operation is awaited, the V8 execution context suspends and yields the thread back to the event loop. Other incoming requests can run during that pause and mutate shared state. If code performs a "read-modify-write" sequence across an await boundary, concurrent operations will interleave and corrupt data.'
        },
        {
          question: 'What are the three main strategies to eliminate race conditions in backend Node.js applications?',
          spokenAnswer:
            '1) Atomic Database Operations: Let the database engine execute the read and update atomically (e.g. UPDATE ... SET balance = balance - X WHERE balance >= X); 2) Pessimistic Locking: Use SELECT ... FOR UPDATE within a transaction to lock the database row until commit; and 3) Optimistic Concurrency Control (OCC): Maintain a version or timestamp column; only update if the version matches, otherwise abort and retry.'
        }
      ],
      trickyFollowUp: {
        question: 'Can you use an in-memory Mutex or Semaphore (like async-mutex) in a scaled Node.js production cluster?',
        answer:
          'No! An in-memory mutex only synchronizes requests within a SINGLE Node.js process. When running in production with multiple cluster workers, Docker containers, or Kubernetes pods, processes do not share memory. You must use distributed locks (such as Redis Redlock) or database-level row locking.'
      },
      commonMistakes: [
        'Assuming single-threaded execution guarantees thread safety and immunity to race conditions.',
        'Using in-memory locks in a clustered or horizontally scaled multi-pod production environment.',
        'Reading state in Node.js, doing math in JavaScript, and writing the result back without DB transactions or atomic operators.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Race conditions occur across asynchronous await suspension points when shared state is interleaved.',
        'Single-threaded JS guarantees atomic synchronous ticks, NOT atomic multi-step async workflows.',
        'Solve via atomic SQL updates, pessimistic locking (FOR UPDATE), or optimistic concurrency (versioning).'
      ],
      oneLineDefinition:
        'A race condition in Node.js occurs when asynchronous operations interleave between read and write steps, resulting in inconsistent shared state.',
      interviewTip:
        'Always answer "single-threaded != race-free": explain that await yields the thread to other concurrent requests.',
      keyDistinction:
        'Thread Race Condition (C++/Java) vs Asynchronous Race Condition (Node.js): Thread races happen across parallel CPU cores; async races happen across interleaved event loop ticks.'
    }
  },
  {
    id: 'async-deadlocks',
    number: 16,
    title: 'Deadlocks',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Advanced Asynchronous Problems',
    categorySlug: 'advanced-async-problems',
    estimatedMinutes: 5,
    concept30Sec:
      'A deadlock occurs when two or more concurrent asynchronous operations are unable to proceed because each holds a lock on a resource that the other requires, creating a circular dependency. While a race condition produces corrupted data, a deadlock causes complete system freezing and indefinite resource hanging.',
    internals: {
      overview:
        'Deadlocks commonly happen in multi-resource database transactions. Consider two transactions: Tx1 transfers money from User A to User B, locking User A first. Concurrently, Tx2 transfers money from User B to User A, locking User B first. Tx1 then attempts to lock User B and waits; Tx2 attempts to lock User A and waits. Both transactions hang forever in a circular wait condition until the database deadlock detector kills one of them.',
      flowSteps: [
        '1. Transaction 1: Acquires exclusive lock on Resource A.',
        '2. Transaction 2: Acquires exclusive lock on Resource B.',
        '3. Transaction 1 Request: T1 attempts to acquire lock on Resource B. Blocked! Waits for T2.',
        '4. Transaction 2 Request: T2 attempts to acquire lock on Resource A. Blocked! Waits for T1.',
        '5. Circular Wait: T1 waits for T2, while T2 waits for T1. Neither can progress.',
        '6. Resolution: Modern databases detect the dependency cycle in their lock graph and abort one transaction with an error (e.g. Postgres 40P01: deadlock_detected).'
      ],
      diagram: `DEADLOCK CIRCULAR DEPENDENCY GRAPH:

  +------------------+                    +------------------+
  |  Transaction 1   | -- (Holds Lock) -> |    Resource A    |
  +------------------+                    +------------------+
          |                                        ^
    (Wants Lock)                              (Wants Lock)
          v                                        |
  +------------------+                    +------------------+
  |    Resource B    | <- (Holds Lock) -- |  Transaction 2   |
  +------------------+                    +------------------+

  Result: Neither transaction can proceed! (Circular Wait)`
    },
    codeExample: {
      code: `// FLAWED: Vulnerable to Database Deadlocks (Inverted Lock Acquisition)
async function transferFundsDeadlockProne(client, fromId, toId, amount) {
  await client.query('BEGIN');
  // Acquires lock on 'fromId' first, then 'toId' second:
  await client.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [fromId]);
  await client.query('SELECT * FROM accounts WHERE id = $2 FOR UPDATE', [toId]);

  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
}

// DEADLOCK SCENARIO:
// Caller 1: transferFundsDeadlockProne(client1, 'Account_A', 'Account_B', 100);
// Caller 2: transferFundsDeadlockProne(client2, 'Account_B', 'Account_A', 50);
// -> Caller 1 locks A, Caller 2 locks B.
// -> Caller 1 tries to lock B (waits), Caller 2 tries to lock A (waits).
// -> DATABASE DEADLOCK DETECTED!`,
      language: 'javascript',
      output: `error: deadlock detected
Detail: Process 4125 waits for ExclusiveLock on tuple (0,2) of relation accounts; blocked by process 4126.
Process 4126 waits for ExclusiveLock on tuple (0,1) of relation accounts; blocked by process 4125.
Hint: See server log for query details.
Code: 40P01`,
      whyOutput:
        'Because locks are acquired in arbitrary order based on function arguments, two concurrent transfers with reversed IDs lock resources in opposite order, creating a circular wait cycle that postgres aborts with error code 40P01.'
    },
    nodeJsApplication: {
      scenario: 'Lock Ordering Strategy and Lock Acquisition Timeouts',
      description:
        'Senior engineers prevent deadlocks by enforcing Global Lock Ordering: resources are ALWAYS acquired in a deterministic, sorted order (e.g. by Primary Key or UUID alphanumeric sort). If all transactions lock Account A before Account B, a circular wait cycle is mathematically impossible.',
      codeSnippet: `// PRODUCTION FIX: Deterministic Lock Ordering
async function transferFundsSafe(client, fromId, toId, amount) {
  // Sort IDs deterministically to guarantee consistent lock ordering across all queries!
  const [firstId, secondId] = [fromId, toId].sort();

  await client.query('BEGIN');
  // Set lock timeout to avoid hanging indefinitely if contention occurs
  await client.query('SET LOCAL lock_timeout = "3000ms"');

  // Locks are ALWAYS acquired in the exact same sorted order:
  await client.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [firstId]);
  await client.query('SELECT * FROM accounts WHERE id = $2 FOR UPDATE', [secondId]);

  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the fundamental difference between a race condition and a deadlock?',
          spokenAnswer:
            'A race condition occurs when concurrent operations execute in an uncontrolled order, producing corrupted or incorrect data while the system continues running. A deadlock occurs when concurrent operations block each other permanently waiting for resources held by one another, causing execution to freeze completely with no progress.'
        },
        {
          question: 'What are the Coffman conditions required for a deadlock to occur, and how do you prevent them?',
          spokenAnswer:
            'A deadlock requires four simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. The most practical way to prevent deadlocks in Node.js backend systems is to eliminate Circular Wait by enforcing Strict Lock Ordering—always acquiring shared locks in a deterministic, globally sorted order (e.g. sorting resource IDs).'
        }
      ],
      trickyFollowUp: {
        question: 'Can deadlocks occur entirely within JavaScript code without any database involvement?',
        answer:
          'Yes! If you implement asynchronous Mutexes or Semaphore locks in Node.js to coordinate in-memory operations, two async tasks acquiring two mutexes in opposite order (Task 1: Mutex A then B; Task 2: Mutex B then A) will deadlock in pure JavaScript.'
      },
      commonMistakes: [
        'Acquiring multiple database row locks or mutexes in arbitrary order without sorting.',
        'Not setting statement_timeout or lock_timeout in SQL transactions, allowing deadlocked or contested transactions to hang indefinitely.',
        'Confusing race conditions (wrong data) with deadlocks (hung execution).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Deadlocks occur when circular dependencies prevent any operation from making progress.',
        'Race conditions cause wrong data; deadlocks cause frozen execution.',
        'Prevent deadlocks via Global Lock Ordering (sorting IDs) and setting strict lock timeouts.'
      ],
      oneLineDefinition:
        'A deadlock is a condition where concurrent processes are permanently blocked because each holds a lock needed by another in a circular wait.',
      interviewTip:
        'State "Global Lock Ordering": sorting resource IDs before locking completely breaks circular wait conditions.',
      keyDistinction:
        'Race Condition vs Deadlock: Race condition produces inconsistent data; Deadlock produces indefinite stall.'
    }
  }
];
