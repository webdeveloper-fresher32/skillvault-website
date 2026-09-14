# Querying Data: API Composition and CQRS

In a monolith, if you want to display an "Order Details" page that shows the Order info, the Customer's name, and the Product's shipping weight, you write a single SQL `JOIN` query across the `Orders`, `Customers`, and `Products` tables.

In a microservices architecture (Database per Service), those tables live in three completely different physical databases. You cannot write a SQL `JOIN` across them. 

How do you fetch the data to display the page? There are two primary patterns: API Composition and CQRS.

## 1. API Composition (The Simple Way)

API Composition acts as a virtual `JOIN` performed in application memory instead of the database.

An API Gateway (or a dedicated "Backend for Frontend" service) receives the request from the user's browser, and then makes synchronous network calls to the individual microservices.

### The Flow
1. API Gateway receives: `GET /order-details/123`
2. Gateway calls `Order Service`: `GET /orders/123`
3. Gateway parses the response, finds `customerId: 45` and `productId: 99`.
4. Gateway calls `Customer Service`: `GET /customers/45`
5. Gateway calls `Product Service`: `GET /products/99`
6. Gateway stitches the three JSON responses together in memory.
7. Gateway sends the massive unified JSON object back to the browser.

### The Problem
API Composition relies entirely on synchronous network calls. 
- **High Latency**: The user has to wait for three separate network hops.
- **Low Availability**: If the `Product Service` is down, the entire "Order Details" page fails to load.
- **Inefficient Memory Usage**: The API Gateway has to hold massive amounts of data in RAM while it stitches the JSON together.

## 2. CQRS (Command Query Responsibility Segregation)

When API Composition is too slow or fragile, you use CQRS. 

CQRS states that the system that handles **Commands** (Writes/Updates) should be entirely separate from the system that handles **Queries** (Reads).

In microservices, CQRS is implemented by creating a dedicated **View Database** (a Materialized View).

### Deep Dive: How CQRS Works

Let's say the "Order Details" page is the most heavily trafficked page on the site, and API Composition is crashing the Gateway. We implement CQRS:

1. **The View Database**: We create a brand new, highly optimized NoSQL database (e.g., MongoDB or Elasticsearch) specifically designed to serve the "Order Details" page.
2. **The View Structure**: We pre-join the data. The MongoDB document looks exactly like the JSON the UI needs:
```json
{
  "_id": "order-123",
  "status": "SHIPPED",
  "customerName": "Alice Smith",
  "productWeightGrams": 1500
}
```
3. **The Query Phase (Instant)**: When the user requests the page, the API Gateway simply asks MongoDB for document `order-123`. It is returned in 1 millisecond. There are no network hops to other services.

### The Challenge: Keeping the View Updated

If the customer changes their name from "Alice Smith" to "Alice Johnson", how does the MongoDB View Database know?

This is where CQRS connects with **Event-Driven Architecture**.
- The `Customer Service` updates its own Postgres database (The Command).
- The `Customer Service` publishes a `CustomerNameUpdated` event to Kafka.
- A background worker (the "View Updater") listens to Kafka. It receives the event, connects to the MongoDB View Database, and updates all orders belonging to Alice to reflect her new name.

### Advantages of CQRS
- **Ultimate Performance**: Reads are lightning fast because the data is pre-joined and optimized for the specific UI view.
- **High Availability**: If the `Customer Service` goes down, the user can still read their Order Details page from MongoDB.

### Disadvantages of CQRS
- **Massive Complexity**: You now have to maintain extra databases and background workers.
- **Eventual Consistency**: When Alice changes her name, it might take 2 seconds for the Kafka message to update MongoDB. For 2 seconds, she will see her old name on the Order Details page.

## Summary
- **API Composition** is essentially an in-memory SQL JOIN. It is easy to implement but suffers from high latency and temporal coupling.
- **CQRS** creates dedicated, pre-joined "View Databases" tailored for specific queries.
- CQRS provides incredible read performance and availability but requires complex Event-Driven updates and introduces eventual consistency.
