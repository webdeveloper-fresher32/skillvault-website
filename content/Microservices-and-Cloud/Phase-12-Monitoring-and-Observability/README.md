# Phase 12: Monitoring and Observability

If a user complains that "the app is slow," how do you debug it when a single user request might touch 15 different microservices across 5 different databases?

Without robust observability, microservices are a black box. You will spend days hunting through disconnected server logs trying to piece together a timeline.

## Learning Objectives

By the end of this phase, you will understand:
- The three pillars of observability: Logging, Metrics, and Tracing.
- How Distributed Tracing reconstructs a user's journey across the network.
- The "Four Golden Signals" established by Google SREs to monitor system health.

## Files in this Phase

1. `01-Logging-Metrics-Tracing.md`: The Three Pillars of Observability.
2. `02-Distributed-Tracing.md`: How Correlation IDs tie the distributed puzzle together.
3. `03-The-Four-Golden-Signals.md`: What to actually monitor on your dashboards (Latency, Traffic, Errors, Saturation).
