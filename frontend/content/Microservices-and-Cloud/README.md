# Microservices and Cloud Architecture

Welcome to the **Microservices and Cloud Architecture** course in SkillVault.

This course is designed to take you from a basic understanding of monolithic web applications to designing massive, distributed, fault-tolerant cloud-native systems. It covers the core principles, patterns, and technologies required to pass senior-level System Design interviews and build modern enterprise software.

## Course Structure

The course is divided into 12 phases, categorized into three main sections: **Microservices**, **Cloud Computing**, and **Cloud-Native Architecture**.

### Section 1: Microservices Fundamentals & Patterns
*Understand why we break monoliths apart, and how to manage the ensuing chaos.*

* [**Phase 01: Monolithic Architecture**](./Phase-01-Monolithic-Architecture/README.md) - Understanding the baseline, scaling monoliths, and knowing exactly when (and when not) to migrate.
* [**Phase 02: Microservices Fundamentals**](./Phase-02-Microservices-Fundamentals/README.md) - Core tenets, Domain-Driven Design (DDD), Bounded Contexts, and the failures of legacy SOA.
* [**Phase 03: Microservices Communication**](./Phase-03-Microservices-Communication/README.md) - Synchronous vs. Asynchronous, REST vs. gRPC, and the power of Event-Driven Architecture.
* [**Phase 04: Microservices Data Management**](./Phase-04-Microservices-Data-Management/README.md) - The "Database per Service" rule, handling distributed transactions with Sagas, and querying with CQRS.
* [**Phase 05: API Gateways and Service Mesh**](./Phase-05-API-Gateways-and-Service-Mesh/README.md) - Managing North-South external traffic vs. East-West internal traffic, and dynamic Service Discovery.

### Section 2: Cloud Computing Core Concepts
*Understand the infrastructure that makes modern distributed systems possible.*

* [**Phase 06: Cloud Computing Fundamentals**](./Phase-06-Cloud-Computing-Fundamentals/README.md) - The 5 NIST characteristics, Virtualization (Hypervisors), and the economic shift from CAPEX to OPEX.
* [**Phase 07: Cloud Service Models**](./Phase-07-Cloud-Service-Models/README.md) - Infrastructure as a Service (IaaS), Platform as a Service (PaaS), Software as a Service (SaaS), and Serverless (FaaS).
* [**Phase 08: Cloud Deployment Models**](./Phase-08-Cloud-Deployment-Models/README.md) - Public Cloud, Private Cloud, Hybrid Cloud for security/bursting, and Multi-Cloud architectures.

### Section 3: Cloud-Native Design & Operations
*How to build applications specifically designed for ephemeral, distributed cloud environments.*

* [**Phase 09: Cloud Native Architecture**](./Phase-09-Cloud-Native-Architecture/README.md) - The 12-Factor App methodology, Containerization (Docker), and Orchestration (Kubernetes).
* [**Phase 10: Resiliency and Fault Tolerance**](./Phase-10-Resiliency-and-Fault-Tolerance/README.md) - Handling inevitable failures using Circuit Breakers, Bulkheads, Exponential Backoff, and Chaos Engineering.
* [**Phase 11: Security and Identity**](./Phase-11-Security-and-Identity/README.md) - Moving from Castle-and-Moat to Zero Trust, OAuth2, OIDC, and stateless JWT propagation.
* [**Phase 12: Monitoring and Observability**](./Phase-12-Monitoring-and-Observability/README.md) - The Three Pillars (Logs, Metrics, Traces), Distributed Tracing with Correlation IDs, and the Four Golden Signals.

## Hands-On Projects

Theory is useless without execution. Apply the concepts you've learned in the [**Projects**](./Projects/README.md) directory:
1. Dockerizing a Monolith
2. Deploying to AWS (IaaS vs PaaS)
3. Strangler Fig Migration
4. Building a Saga with RabbitMQ

## Interview Preparation

Before your system design interview, review the [**Quick-Reference**](./Quick-Reference/README.md) materials:
* **Architecture Cheatsheet**: High-yield summaries of patterns and vocabulary.
* **50 Interview Questions**: The most common microservices and cloud questions, fully answered.
