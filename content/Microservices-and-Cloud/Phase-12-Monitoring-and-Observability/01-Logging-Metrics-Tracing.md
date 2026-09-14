# The Three Pillars of Observability

Monitoring a monolithic system is relatively easy: you look at the CPU usage of the single server, and you tail the single `app.log` file. 

Monitoring a distributed system requires three distinct but interconnected pillars of data.

## 1. Logging

A log is an immutable timestamped record of discrete events that happened over time (e.g., `2023-10-27 10:00:01 ERROR Database Connection Failed`).

**The Microservice Challenge**: If you have 50 services, each running 10 instances, you have 500 different log files scattered across 500 different containers.
**The Solution (Centralized Logging)**: You must use a log aggregator (like the ELK Stack - Elasticsearch, Logstash, Kibana, or Splunk). 
1. Every container writes its logs to `stdout`.
2. A daemon (like Fluentd) runs on the host server, scoops up all the logs, and sends them over the network to the central Elasticsearch database.
3. Developers log into Kibana and search across all 500 containers simultaneously.

**Structured Logging**: Never log plain text. Always log in JSON format. This allows the log aggregator to index fields so you can query: `Search where service="Order" AND level="ERROR"`.

## 2. Metrics

Logs are great for debugging, but terrible for monitoring system health. Generating 10,000 logs per second just to record successful HTTP 200 responses will destroy your network and storage budget.

**Metrics** are numerical representations of data measured over intervals of time. Instead of logging every request, you increment a counter in memory. Every 10 seconds, you push that number (e.g., "1,500 requests") to a time-series database (like Prometheus).

- **Pros**: Incredibly cheap to store and query. Used to build Grafana dashboards and trigger PagerDuty alerts if the error rate goes above 1%.

## 3. Tracing

Tracing is a specialized form of logging used strictly to follow a request's lifecycle as it travels through a distributed system. It shows exactly how long a request spent in the `API Gateway`, the `Order Service`, the `Database`, and the `Payment Service`. (Covered in the next lesson).

## Summary
- **Metrics** tell you *that* there is a problem (and wake you up via PagerDuty).
- **Tracing** tells you *where* the problem is (which specific microservice is slowing down).
- **Logging** tells you *why* the problem happened (the exact stack trace or error message).
