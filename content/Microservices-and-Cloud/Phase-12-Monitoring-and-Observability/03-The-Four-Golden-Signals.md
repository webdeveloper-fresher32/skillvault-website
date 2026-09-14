# The Four Golden Signals

When building dashboards (e.g., in Grafana) for your microservices, it is tempting to graph everything: CPU, RAM, Disk I/O, JVM Garbage Collection times, Active Threads, etc. 

While those metrics are useful for debugging, they do not tell you if your users are currently suffering. If CPU is at 99%, but response times are fast and no errors are occurring, the system is technically healthy.

To standardize monitoring, Google Site Reliability Engineering (SRE) defined the **Four Golden Signals**. If you can only measure four metrics for your user-facing system, focus on these four.

## 1. Latency

**The time it takes to service a request.**

It is critical to distinguish between the latency of *successful* requests and the latency of *failed* requests. A failed request might fail instantly (e.g., a fast HTTP 500), bringing your average latency down, making the system look healthier when it is actually broken.

**How to measure:**
Do not look at averages. Always look at percentiles (p50, p95, p99). 
If your p99 latency is 2000ms, it means 99% of requests are faster than 2000ms, but the slowest 1% of users are suffering. Averages hide the suffering of the outliers.

## 2. Traffic

**A measure of how much demand is being placed on your system.**

For a web API, this is usually measured in HTTP requests per second. For an audio streaming service, it might be network I/O rate (Mbps). For a key-value storage system, it might be transactions per second.

**Why it matters:**
Understanding traffic helps you correlate spikes in other signals. Did latency spike because code was deployed, or because traffic tripled in 5 minutes?

## 3. Errors

**The rate of requests that fail.**

These can be explicit (HTTP 500s), implicit (an HTTP 200 success response, but the JSON payload says "Database Offline"), or driven by policy (e.g., a request that succeeds but takes 5 seconds when the SLA is 1 second).

**How to measure:**
Monitor the ratio of errors to total traffic (Error Rate). An alert should trigger if the Error Rate exceeds your Error Budget (e.g., > 1%).

## 4. Saturation

**How "full" your service is.**

This is a measure of your system fraction, emphasizing the resources that are most constrained (e.g., in a memory-constrained system, show memory; in an I/O-constrained system, show I/O). 

Most systems experience severe performance degradation long before they hit 100% utilization. For example, a database might become unacceptably slow at 85% CPU utilization. Saturation metrics should help you predict imminent failures before they happen.

## Summary

When setting up PagerDuty alerts or checking system health, look at the user-centric Four Golden Signals:
1. **Latency**: How long is it taking? (Track percentiles, not averages).
2. **Traffic**: How much demand is there? (Requests per second).
3. **Errors**: How many requests are failing? (Error rate).
4. **Saturation**: How full are the critical resources? (Predicting capacity limits).
