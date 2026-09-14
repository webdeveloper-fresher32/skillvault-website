# Architecture Cheatsheet

## Monolith vs. Microservices

| Feature | Monolith | Microservices |
| :--- | :--- | :--- |
| **Deployment** | All at once. Slow, high risk. | Independent. Fast, low risk. |
| **Scaling** | Scale the whole app. Inefficient. | Scale specific services based on load. |
| **Data** | Centralized (ACID transactions). | Decentralized (Database per service). |
| **Complexity** | Low initially, becomes a "ball of mud". | High initially (network, tracing, sagas). |
| **Tech Stack** | Locked into one language/framework. | Polyglot (use the best tool for the job). |

## Scaling Types

- **Vertical Scaling (Scale Up)**: Buying a bigger server (more CPU/RAM). Has hard hardware limits.
- **Horizontal Scaling (Scale Out)**: Buying *more* servers and using a Load Balancer. Infinite scaling, but requires the application to be stateless.

## Communication Patterns

- **Synchronous (REST/gRPC)**: Blocks until a response is received. Creates Temporal Coupling (both services must be online). Causes cascading failures if not protected.
- **Asynchronous (Message Brokers/RabbitMQ)**: Fire and forget. Highly decoupled. Provides load-leveling (buffering). Introduces Eventual Consistency.

## Data Management Patterns

- **Database per Service**: The golden rule. No two microservices can share a database to prevent schema coupling.
- **Saga Pattern**: A sequence of local transactions coordinated via messages to simulate a distributed transaction. Requires explicitly coded Compensating Transactions (rollbacks) if a step fails.
- **CQRS (Command Query Responsibility Segregation)**: Separating write operations from read operations. Often involves creating highly optimized, read-only "View" databases that stay up to date by listening to async events.

## Resiliency Patterns

- **Exponential Backoff & Jitter**: Never retry immediately. Wait 1s, 2s, 4s, and add randomness to prevent DDoS'ing your own struggling services.
- **Circuit Breaker**: If a downstream service is failing, "trip the circuit" and immediately return an error locally without making the network call. Gives the downstream service time to recover.
- **Bulkhead**: Isolate resources (like thread pools) so a failure in one feature doesn't consume all system resources and crash healthy features.

## Cloud Computing Models

- **IaaS (Infrastructure as a Service)**: Raw VMs (AWS EC2). You manage the OS, runtime, and app. Max control, max maintenance.
- **PaaS (Platform as a Service)**: Developer platforms (Heroku). You manage the code and data. The provider manages the OS and runtime. High velocity.
- **SaaS (Software as a Service)**: End-user products (Salesforce). You manage nothing.
- **FaaS (Serverless)**: Code executes in response to events (AWS Lambda). Scales to zero. You only pay for execution milliseconds.

## Observability

- **Metrics**: Time-series numerical data (CPU usage, Requests/sec). Used for triggering alerts (PagerDuty).
- **Logs**: Immutable records of events. Must be centralized (ELK stack) for microservices.
- **Distributed Tracing**: Uses a Correlation ID passed in HTTP headers to track a single user's request across dozens of microservices to find bottlenecks.
