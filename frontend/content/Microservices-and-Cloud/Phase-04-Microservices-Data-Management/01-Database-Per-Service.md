# The Database per Service Pattern

The defining rule of modern microservices architecture is the **Database per Service** pattern. 

Every microservice must own its own data. This means:
1. Only the `Order` service can read from or write to the `Orders` database.
2. If the `Billing` service needs order data, it is strictly forbidden from querying the `Orders` database directly.
3. Instead, the `Billing` service must make a network call (REST, gRPC) to the `Order` service's API, or listen to events emitted by the `Order` service.

## Why is this mandatory?

If two microservices share the same database (or the same tables within a database), you have created a **Distributed Monolith**. 

### 1. Schema Coupling
If `Order` and `Billing` share a database, and the `Order` team decides to rename a column from `customer_id` to `userId`, they will instantly break the `Billing` service. The teams are no longer independent; they must coordinate deployments, defeating the entire purpose of microservices.

### 2. Lock Contention
If `Order` runs a heavy `UPDATE` lock on a table, and `Billing` tries to read from it, `Billing` will hang. Services can crash each other at the database level, destroying fault isolation.

### 3. Polyglot Persistence
When services own their own data, they can choose the best database for the job. 
- `Product Search` needs full-text fuzzy matching -> Use **Elasticsearch**.
- `Shopping Cart` needs sub-millisecond lookups for temporary data -> Use **Redis**.
- `Financial Transactions` needs strict ACID compliance -> Use **PostgreSQL**.
A shared monolithic database forces everyone into a one-size-fits-all solution, usually resulting in a massive, bloated Oracle or MySQL instance that is highly inefficient for specialized workloads.

## Physical vs. Logical Separation

"Database per service" does not necessarily mean you have to provision 50 separate physical database servers (which would be very expensive). 

You can achieve this separation logically:
- **Private Tables**: Services use the same database server but have strict access controls ensuring they can only see their own tables.
- **Schema per Service**: (In PostgreSQL) Each service gets its own schema.
- **Database per Service**: (Highest isolation) Each service gets a completely separate database instance.

## Technical Deep Dive: The Loss of ACID Transactions

Because data is split across multiple databases, you can no longer rely on standard database transactions to ensure data consistency.

In a monolith, placing an order and updating inventory looks like this. The database guarantees that either *all* of this happens, or *none* of it happens (Atomicity):

```sql
-- Monolithic ACID Transaction
BEGIN TRANSACTION;
  INSERT INTO Orders (id, item, status) VALUES (1, 'Laptop', 'PLACED');
  UPDATE Inventory SET stock = stock - 1 WHERE item = 'Laptop';
COMMIT; 
-- If the UPDATE fails, the INSERT is automatically rolled back.
```

**In Microservices, this simple SQL query is impossible.** 
You cannot run a single `COMMIT` across the `Order` database (Postgres) and the `Inventory` database (MongoDB) over the network. Network partitions mean the `Order` might save successfully, but the `Inventory` database might be unreachable, leaving your system in an inconsistent state (an order exists, but stock wasn't deducted).

Historically, architectures tried to solve this using **Two-Phase Commit (2PC)**, a protocol that locks rows across multiple databases simultaneously over the network. However, 2PC is disastrously slow and creates massive bottlenecks, making it an anti-pattern in modern cloud-native systems.

To solve this without 2PC, we use the **Saga Pattern**, which we will cover in the next lesson.
