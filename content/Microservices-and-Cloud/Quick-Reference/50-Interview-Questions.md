# 50 Interview Questions: Microservices and Cloud

This document contains 50 common interview questions covering microservices architecture, distributed systems, and cloud computing. 

## Microservices Architecture

**1. What is the fundamental difference between a Monolith and a Microservice architecture?**
A Monolith is a single unified application where all business logic runs in the same memory space and uses a single database. Microservices are highly cohesive, loosely coupled, independently deployable services organized around business domains, where each service owns its own database.

**2. Why is "Database per Service" mandatory in Microservices?**
If multiple services share a database, it creates a Distributed Monolith. Changes to the database schema by one team will break the other team's service, destroying independent deployability. It also causes lock contention and prevents teams from choosing the best database engine for their specific needs (Polyglot Persistence).

**3. What is Bounded Context in Domain-Driven Design (DDD)?**
A Bounded Context is a boundary within which a specific domain model is defined and applicable. It ensures that terms (like "Product") have a strict, unified meaning within that context. Microservices should be mapped 1:1 with Bounded Contexts to ensure high cohesion and loose coupling.

**4. What is the API Gateway pattern?**
An API Gateway acts as a single entry point for all external traffic entering the microservices cluster. It handles North-South routing, SSL termination, rate limiting, and authentication, preventing external clients from having to know the internal IP addresses of dozens of individual services.

**5. How does a Service Mesh differ from an API Gateway?**
An API Gateway handles North-South traffic (Client to Cluster). A Service Mesh handles East-West traffic (Internal Service to Internal Service). The Service Mesh uses sidecar proxies to automatically manage mTLS encryption, retries, and distributed tracing without requiring changes to application code.

**6. Explain the Strangler Fig Pattern.**
It is a migration strategy where a legacy monolithic application is gradually replaced by new microservices. An API Gateway sits in front of both. Over time, specific routes (e.g., `/api/billing`) are repointed from the monolith to the new microservice until the monolith is completely "strangled" and decommissioned.

**7. What is Temporal Coupling?**
It occurs in synchronous communication (like REST/gRPC) where both Service A and Service B must be online at the exact same time for a transaction to succeed. It is dangerous because a failure in Service B causes a cascading failure in Service A.

**8. How do you solve Temporal Coupling?**
By using asynchronous communication (Message Brokers/Event-Driven Architecture). Service A drops a message in a queue and returns a success response. If Service B is offline, the message waits in the queue until B comes back online.

**9. What is Eventual Consistency?**
In distributed systems, data is updated asynchronously across multiple databases. Eventual Consistency means that if no new updates are made to a given data item, eventually all accesses to that item will return the last updated value. The system is temporarily inconsistent but will synchronize over time.

**10. What is the Saga Pattern?**
A pattern to manage distributed transactions across multiple microservices without using ACID locks. It consists of a sequence of local transactions. If a step fails, the Saga executes Compensating Transactions (rollbacks) to undo the previous successful steps.

**11. Choreography vs. Orchestration in Sagas?**
Choreography is decentralized; services react to events published by other services. Orchestration is centralized; a "brain" service sends direct commands telling other services exactly what to do.

**12. What is CQRS?**
Command Query Responsibility Segregation. It separates the write model (Commands) from the read model (Queries). It often involves building highly optimized read-only databases by listening to async events, bypassing the need for complex distributed SQL joins across microservices.

**13. What is the CAP Theorem?**
It states that a distributed data store can only guarantee two out of three: Consistency, Availability, and Partition Tolerance. Because network partitions (P) are unavoidable in distributed systems, architects must choose between prioritizing Consistency (CP) or Availability (AP).

**14. Why are retries dangerous?**
Naive retries can cause a "Retry Storm," effectively DDoS'ing a struggling internal service. Retries must always implement Exponential Backoff and Jitter (randomness) to give the downstream service time to recover.

**15. Explain the Circuit Breaker pattern.**
If a downstream service has a high failure rate, the circuit breaker "trips" (opens). The calling service immediately returns an error locally instead of making the network call. This prevents threads from hanging and gives the failing service silence to recover.

**16. What is the Bulkhead pattern?**
Isolating system resources (like thread pools) per integration point. If the "Inventory" API slows down, only the threads dedicated to Inventory are exhausted, ensuring the "Payment" API continues to function normally.

**17. What is Chaos Engineering?**
The discipline of intentionally injecting failures (killing servers, adding network latency) into a production system during normal business hours to prove that the architecture's resiliency mechanisms (circuit breakers, auto-scaling) actually work.

**18. What are the Three Pillars of Observability?**
Logging (detailed event records for debugging), Metrics (aggregated numerical data for dashboards and alerts), and Tracing (tracking a single request across multiple network hops).

**19. How does Distributed Tracing work?**
The API Gateway generates a unique Correlation ID (Trace ID) and injects it into the HTTP headers. Every subsequent microservice extracts this ID, logs it, and passes it forward. This allows log aggregators to rebuild the entire user journey.

**20. What are the Four Golden Signals?**
Latency (response time percentiles), Traffic (requests per second), Errors (failure rate), and Saturation (how full constrained resources are). Defined by Google SRE as the critical user-centric metrics to monitor.

## Cloud Computing and Deployment

**21. What is the definition of Cloud Computing?**
The on-demand delivery of IT resources over the internet with pay-as-you-go pricing, featuring resource pooling, rapid elasticity, and self-service provisioning.

**22. Explain CAPEX vs. OPEX.**
CAPEX (Capital Expenditure) is buying physical servers upfront. OPEX (Operational Expenditure) is renting cloud resources and paying only for what you use by the second.

**23. What is IaaS?**
Infrastructure as a Service. The provider manages the hardware and hypervisor. You manage the OS, runtime, and application code (e.g., AWS EC2).

**24. What is PaaS?**
Platform as a Service. The provider manages the OS and runtime. You only manage your application code and data (e.g., Heroku, AWS Elastic Beanstalk).

**25. What is SaaS?**
Software as a Service. The provider manages everything. You just consume the software via a web browser (e.g., Salesforce, Gmail).

**26. What is FaaS / Serverless?**
Functions as a Service. You deploy snippets of code that execute in response to events. You pay exactly $0 when the function is idle, and it scales infinitely instantly (e.g., AWS Lambda).

**27. What is a "Cold Start" in Serverless?**
The delay (latency) experienced when a serverless function is invoked after being idle. The cloud provider must provision a new container from scratch before executing the code.

**28. Public vs. Private Cloud?**
Public Cloud uses multi-tenant shared hardware managed by a third party (AWS/Azure). Private Cloud uses single-tenant dedicated hardware managed for a single organization, offering maximum security but higher operational overhead.

**29. What is a Hybrid Cloud?**
An architecture that combines a Private Cloud (on-premises data center) with a Public Cloud, allowing for Cloud Bursting or keeping sensitive data on-prem while using public compute resources.

**30. Why adopt a Multi-Cloud strategy?**
To avoid vendor lock-in (being trapped by AWS pricing or proprietary APIs), to achieve ultimate disaster recovery, or to use best-of-breed services from different providers (e.g., AWS for compute, GCP for AI).

**31. What is Virtualization?**
The abstraction of physical hardware using a Hypervisor, allowing a single physical server to act as multiple independent Virtual Machines (VMs), enabling cloud resource pooling.

**32. Type 1 vs. Type 2 Hypervisor?**
Type 1 (Bare Metal) runs directly on the hardware (VMware ESXi, used in Data Centers). Type 2 (Hosted) runs on top of a host operating system (VirtualBox, used on developer laptops).

**33. VMs vs. Containers?**
VMs contain a full Operating System and are heavy/slow to boot. Containers (Docker) share the host OS kernel, are extremely lightweight, and boot in milliseconds.

**34. What is Kubernetes?**
An open-source container orchestration platform that automates the deployment, scaling, scheduling, and self-healing of thousands of containerized applications across a cluster of servers.

**35. What is the 12-Factor App methodology?**
A set of best practices for building Cloud-Native SaaS applications. Key principles include isolating dependencies, storing config in the environment, and treating backing services as attached resources.

**36. Why should configuration be stored in the environment?**
Because code remains identical across Dev, Staging, and Prod, but configuration (database passwords) changes. Hardcoding config prevents portability and creates security vulnerabilities.

**37. What does "Stateless Processes" mean in the 12-Factor app?**
The application process must not store any session data in local memory or on the local disk, because cloud servers are ephemeral and requests are load-balanced randomly. All state must be stored in a backing service (Database/Redis).

**38. What is Zero Trust Architecture?**
A security model assuming the internal network is already compromised. "Never trust, always verify." Every internal request between microservices must be authenticated and encrypted (mTLS).

**39. OAuth 2.0 vs. OpenID Connect (OIDC)?**
OAuth 2.0 is for Authorization (granting delegated access via Access Tokens). OIDC is built on top of OAuth 2.0 and is for Authentication (verifying identity via ID Tokens).

**40. Why are JWTs used in Microservices?**
Because they are stateless. A microservice can verify a JSON Web Token's cryptographic signature locally using a public key, proving the user's identity and roles without having to make a network call to a centralized session database.

## System Design and General Concepts

**41. What is an API (Application Programming Interface)?**
A set of rules and protocols that allow one software application to communicate with another, abstracting the underlying implementation.

**42. What is Idempotency?**
A property of an operation where executing it once has the exact same effect as executing it multiple times. Crucial in distributed systems where network retries or message brokers might deliver the same request twice (e.g., an "Order Placed" event).

**43. Horizontal vs. Vertical Scaling?**
Vertical (Scale Up) = adding more RAM/CPU to an existing server. Horizontal (Scale Out) = adding more servers behind a load balancer.

**44. What is a Load Balancer?**
A device or software that distributes incoming network traffic across multiple backend servers to ensure high availability and prevent any single server from becoming overwhelmed.

**45. What is a Reverse Proxy?**
A server that sits in front of backend servers and forwards client requests to them. Unlike a forward proxy (which protects clients), a reverse proxy protects servers, offering caching, SSL termination, and load balancing.

**46. What is a Content Delivery Network (CDN)?**
A geographically distributed group of servers that cache static assets (HTML, images, videos) closer to the end-users to reduce latency and bandwidth costs.

**47. SQL vs. NoSQL?**
SQL databases (PostgreSQL, MySQL) are relational, use strict schemas, and guarantee ACID transactions. NoSQL databases (MongoDB, DynamoDB) are non-relational, schema-less, and prioritize horizontal scalability and flexibility over strict consistency.

**48. What is the N+1 Query Problem?**
A performance anti-pattern where an application makes 1 database query to fetch a list of N items, and then makes N additional queries to fetch details for each item (Total = N+1 queries). Solved by using JOINs or batching (e.g., GraphQL DataLoader).

**49. What is a Message Broker?**
Software that enables applications to communicate asynchronously by sending messages to queues or topics (e.g., RabbitMQ, Kafka). It provides decoupling and load leveling.

**50. What is Infrastructure as Code (IaC)?**
Managing and provisioning cloud infrastructure through machine-readable definition files (code) rather than physical hardware configuration or interactive configuration tools (GUI). Example: Terraform, AWS CloudFormation.
