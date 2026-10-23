# Scheduled Tasks — Complete Guide

## Table of Contents
1. [Why Schedule Tasks in an Application](#1-why-schedule-tasks-in-an-application)
2. [Enabling Scheduling](#2-enabling-scheduling)
3. [@Scheduled — fixedRate, fixedDelay, and initialDelay](#3-scheduled--fixedrate-fixeddelay-and-initialdelay)
4. [Cron Expressions](#4-cron-expressions)
5. [The Single-Threaded Default Scheduler Pitfall](#5-the-single-threaded-default-scheduler-pitfall)
6. [Configuring a Thread Pool TaskScheduler](#6-configuring-a-thread-pool-taskscheduler)
7. [Distributed Scheduling in Multi-Instance Deployments](#7-distributed-scheduling-in-multi-instance-deployments)
8. [Worked Example — Nightly Cleanup Job](#8-worked-example--nightly-cleanup-job)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Schedule Tasks in an Application

Many applications need work to happen on a timer rather than in response to a request: purging expired sessions every night, re-indexing a search catalog every hour, polling a partner API every five minutes, or sending a daily digest email at 8am. Spring's `@Scheduled` annotation lets you declare this kind of recurring background work directly on a bean method, without standing up a separate cron daemon or external job scheduler for simple cases.

```
  Application JVM
  ┌──────────────────────────────────────────────┐
  │  TaskScheduler                                │
  │    │                                          │
  │    │  every trigger (fixedRate/cron/...)      │
  │    ▼                                          │
  │  invoke @Scheduled method                     │
  │    │                                          │
  │    ▼                                          │
  │  CleanupService.purgeExpiredSessions()        │
  └──────────────────────────────────────────────┘
```

Unlike `@Cacheable` and `@Async`, `@Scheduled` is not triggered by a proxy intercepting an external call — there's no "caller" invoking the method at all. Instead, a background `TaskScheduler` infrastructure component calls the method directly on a timer, so there's no self-invocation pitfall here. The proxy still wraps the bean (so other cross-cutting concerns like `@Transactional` still apply), but the trigger itself comes from the scheduler, not from application code.

---

## 2. Enabling Scheduling

Add `@EnableScheduling` to a configuration class:

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MaintenanceServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(MaintenanceServiceApplication.class, args);
    }
}
```

As with `@EnableCaching` and `@EnableAsync`, omitting this annotation means `@Scheduled` methods are simply never invoked — no exception, no startup warning, the methods just sit there unused.

---

## 3. @Scheduled — fixedRate, fixedDelay, and initialDelay

`@Scheduled` supports several trigger styles, and understanding the difference between `fixedRate` and `fixedDelay` matters for methods whose execution time isn't negligible.

```java
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class HealthCheckJob {

    // Starts a new execution every 30 seconds, measured from the START
    // of the previous execution — regardless of how long that execution took.
    @Scheduled(fixedRate = 30_000)
    public void pingDownstreamServices() {
        System.out.println("Pinging downstream services at " + java.time.Instant.now());
    }

    // Waits 10 seconds AFTER the previous execution FINISHES before starting again.
    @Scheduled(fixedDelay = 10_000)
    public void drainRetryQueue() {
        System.out.println("Draining retry queue at " + java.time.Instant.now());
    }

    // Waits 5 seconds after application startup before the very first execution,
    // then follows the fixedDelay/fixedRate cadence for subsequent runs.
    @Scheduled(initialDelay = 5_000, fixedRate = 60_000)
    public void warmUpCaches() {
        System.out.println("Warming caches at " + java.time.Instant.now());
    }
}
```

```
  fixedRate = 30s  (measured from start to start)
  |--task(20s)--|        |--task(20s)--|        |--task(20s)--|
  0s            20s  30s 30s           50s  60s  60s
                     ▲ next run fires at t=30 even though prior task still had 10s left
                     (if the executor is single-threaded, this run queues instead of overlapping)

  fixedDelay = 30s  (measured from end to start)
  |--task(20s)--|          |--task(20s)--|          |--task(20s)--|
  0s            20s   50s  50s           70s   100s
                       ▲ next run fires exactly 30s after the PREVIOUS one finished
```

`fixedRate` is appropriate when you want a consistent invocation cadence regardless of how long each run takes (accepting that runs might overlap or queue up if the task is slow). `fixedDelay` is appropriate when each run must fully finish — and you want a guaranteed gap — before the next one starts, such as a job that shouldn't overlap with itself. All three delay/rate values can also be expressed in externalized properties: `@Scheduled(fixedRateString = "${jobs.healthcheck.rate-ms}")`.

---

## 4. Cron Expressions

For calendar-based schedules (specific times of day, specific days of the week), `@Scheduled` accepts a `cron` attribute using Spring's six-field cron syntax: `second minute hour day-of-month month day-of-week`.

```java
@Component
public class ReportingJob {

    // At 08:00:00 every day
    @Scheduled(cron = "0 0 8 * * *")
    public void sendDailyDigest() {
        System.out.println("Sending daily digest at " + java.time.Instant.now());
    }

    // At 23:30:00, only on Sunday
    @Scheduled(cron = "0 30 23 * * SUN")
    public void weeklyRollup() {
        System.out.println("Running weekly rollup at " + java.time.Instant.now());
    }

    // Every 15 minutes during business hours (9am-5pm), Monday-Friday
    @Scheduled(cron = "0 0/15 9-17 * * MON-FRI")
    public void syncDuringBusinessHours() {
        System.out.println("Syncing during business hours at " + java.time.Instant.now());
    }
}
```

| Field | Allowed values | Example meaning |
|---|---|---|
| second | 0-59 | `0` = at the top of the minute |
| minute | 0-59 | `0/15` = every 15 minutes |
| hour | 0-23 | `9-17` = 9am through 5pm |
| day-of-month | 1-31, `*`, `?` | `*` = every day |
| month | 1-12, JAN-DEC | `*` = every month |
| day-of-week | 0-7 (0 and 7 = Sunday), MON-SUN, `*`, `?` | `MON-FRI` = weekdays only |

Note that Spring's cron field order (`second minute hour day month day-of-week`) differs from traditional Unix cron (`minute hour day month day-of-week`, five fields, no seconds) — a very common source of off-by-one-field confusion when porting a Unix crontab entry into `@Scheduled`. Cron expressions also support the `zone` attribute to pin evaluation to a specific timezone regardless of the server's local timezone: `@Scheduled(cron = "0 0 2 * * *", zone = "America/New_York")`.

---

## 5. The Single-Threaded Default Scheduler Pitfall

Spring Boot's default `TaskScheduler` — used when you don't explicitly configure one — runs on a **single thread**. Every `@Scheduled` method in the entire application shares that one thread. This has a serious consequence: if one scheduled method runs long (or hangs), it blocks every other scheduled method in the application from running on time, because they're all queued behind it on the same thread.

```
  Default single-threaded scheduler
  ┌───────────────────────────────────────────────────────┐
  │  Thread: scheduling-1                                  │
  │                                                          │
  │  t=0    pingDownstreamServices() starts (expected: 2s)  │
  │  t=2s   ... still running due to a slow network call ...│
  │  t=10s  ... still stuck ...                              │
  │  t=10s  drainRetryQueue() was due at t=10s but CANNOT   │
  │         start — it's queued behind the stuck task        │
  │  t=10s  sendDailyDigest() was due at 08:00:00 but ALSO  │
  │         delayed — same single thread                    │
  └───────────────────────────────────────────────────────┘
```

This is easy to miss in development, where scheduled jobs are usually fast and few, and becomes a production incident when one job (say, a slow external API poll) starves every other scheduled job in the application, causing missed cleanup jobs, missed digests, or a cascading backlog.

---

## 6. Configuring a Thread Pool TaskScheduler

The fix is to configure a `TaskScheduler` bean backed by a thread pool, so scheduled methods run concurrently instead of contending for a single thread.

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableScheduling
public class SchedulingConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("scheduled-task-");
        scheduler.setErrorHandler(throwable ->
                System.err.println("Scheduled task failed: " + throwable.getMessage()));
        scheduler.initialize();
        return scheduler;
    }
}
```

Registering a `TaskScheduler` bean (any bean of that type, name doesn't matter for auto-detection in most setups, though `taskScheduler` is the conventional name) tells Spring Boot to use it instead of the default single-threaded scheduler. With `setPoolSize(10)`, up to 10 scheduled methods can run truly concurrently, so a slow job no longer blocks unrelated ones. As of Spring Boot 3.2+, you can also achieve pool sizing purely through configuration properties without a custom bean:

```yaml
spring:
  task:
    scheduling:
      pool:
        size: 10
      thread-name-prefix: scheduled-task-
```

Setting a custom `errorHandler` is also worth calling out: by default, an uncaught exception thrown from a `@Scheduled` method is logged, but — critically — **that scheduled task is not automatically rescheduled if the exception propagates out and isn't handled**, in some scheduler configurations; explicitly catching exceptions inside the method body (or configuring an error handler) keeps the job's future executions on track rather than risking the trigger silently stopping.

---

## 7. Distributed Scheduling in Multi-Instance Deployments

`@Scheduled` is inherently per-JVM: if you run three replicas of the same service (common in Kubernetes or any horizontally scaled deployment), **all three instances run every `@Scheduled` method independently, on their own schedule**. For an idempotent, side-effect-free job (e.g., refreshing an in-memory cache), that's harmless. For a job with real side effects — sending a single daily digest email, running a billing job, purging a shared resource — running it three times simultaneously is a bug, potentially a serious one (duplicate charges, duplicate emails).

```
  3 replicas, each running the same @Scheduled job independently
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │ Instance A │   │ Instance B │   │ Instance C │
  │ 08:00:00   │   │ 08:00:00   │   │ 08:00:00   │
  │ sendDigest │   │ sendDigest │   │ sendDigest │
  └───────────┘   └───────────┘   └───────────┘
         │               │               │
         ▼               ▼               ▼
     3 emails sent to every customer, not 1
```

Common strategies to avoid duplicate execution across instances:

- **Externalize the job entirely** — move it out of the application into a proper external scheduler (a Kubernetes `CronJob`, a cloud scheduler service) that runs as a single invocation against one target, rather than embedding it in every replica.
- **Elect a single leader** and only run the scheduled logic on the leader instance (e.g., via a Kubernetes lease, a ZooKeeper/etcd-based election, or a cloud provider's leader-election primitive).
- **Use a distributed lock library like ShedLock.** ShedLock wraps a `@Scheduled` method so that, across all instances, only one acquires a lock (backed by a shared store — a database table, Redis, DynamoDB, etc.) and actually executes the method body for that trigger; the others see the lock is held and skip that run.

```java
import net.javacrud.shedlock.spring.annotation.SchedulerLock;

@Scheduled(cron = "0 0 8 * * *")
@SchedulerLock(name = "sendDailyDigest", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
public void sendDailyDigest() {
    System.out.println("Sending daily digest exactly once across all instances");
}
```

`lockAtMostFor` bounds how long a lock is held even if the instance crashes mid-job (so the lock doesn't get stuck forever), and `lockAtLeastFor` prevents a very fast successful run from releasing the lock so quickly that a second instance's slightly-offset clock triggers a near-duplicate run. ShedLock only prevents concurrent/duplicate execution — it does not itself provide a distributed cron scheduler; each instance still evaluates its own `@Scheduled` trigger locally and asks ShedLock for permission to actually run.

---

## 8. Worked Example — Nightly Cleanup Job

A job that purges expired password-reset tokens every night at 2:15am server time, using a thread-pool scheduler and ShedLock to stay safe if the service is later scaled to multiple instances.

```java
@Component
public class TokenCleanupJob {

    private final PasswordResetTokenRepository tokenRepository;

    public TokenCleanupJob(PasswordResetTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    // Cron: second=0, minute=15, hour=2, every day, every month, any day-of-week
    @Scheduled(cron = "0 15 2 * * *")
    @SchedulerLock(name = "tokenCleanupJob", lockAtLeastFor = "PT30S", lockAtMostFor = "PT15M")
    public void purgeExpiredTokens() {
        long start = System.currentTimeMillis();
        int deleted = tokenRepository.deleteAllExpiredBefore(java.time.Instant.now());
        long elapsedMs = System.currentTimeMillis() - start;
        System.out.println("Nightly cleanup: removed " + deleted
                + " expired tokens in " + elapsedMs + "ms");
    }
}
```

```java
@Configuration
@EnableScheduling
public class SchedulingConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);
        scheduler.setThreadNamePrefix("cleanup-scheduler-");
        scheduler.initialize();
        return scheduler;
    }
}
```

Breaking down `cron = "0 15 2 * * *"`: `0` seconds, `15` minutes, `2` hours (2:15am), `*` every day of month, `*` every month, `*` any day of week — this fires exactly once per day at 02:15:00. The `@SchedulerLock` ensures that if this service is later scaled to five replicas, only one replica's invocation actually deletes rows on any given night; the other four see the lock held (via a shared `shedlock` table in the same database, in the common JDBC-based ShedLock setup) and skip the run entirely, logging nothing and touching no data.

---

## 9. Common Pitfalls

- **Forgetting `@EnableScheduling`** — scheduled methods are simply never invoked, with no error at startup.
- **Confusing `fixedRate` and `fixedDelay`** — `fixedRate` can cause overlapping or rapidly queued executions if the task takes longer than the rate interval; `fixedDelay` guarantees spacing after completion but means the actual cadence drifts if execution time varies.
- **Relying on the default single-threaded scheduler in production** — one slow or hung job starves every other scheduled method in the application (see Section 5).
- **Porting a Unix crontab entry directly** — Spring's cron format has six fields (with leading seconds), while standard Unix cron has five; a naive copy-paste shifts every field by one and produces a schedule that doesn't mean what you think.
- **Running the same side-effecting job on every instance in a multi-instance deployment** without any coordination — causes duplicate emails, duplicate charges, or duplicate external calls (see Section 7).
- **Letting exceptions escape a `@Scheduled` method silently** — depending on scheduler configuration, an uncaught exception can be merely logged with no alerting, so a broken nightly job might fail silently for weeks before anyone notices.
- **Ignoring timezone differences** — a cron expression without an explicit `zone` runs in the server's local timezone, which can silently shift by an hour (or more) if the server's timezone configuration changes or differs between environments (local machine vs. containerized deployment vs. cloud region).

---

## 10. Best Practices

- Always configure a pooled `TaskScheduler` (`ThreadPoolTaskScheduler`, sized to the number of genuinely concurrent scheduled jobs you expect) rather than relying on the single-threaded default.
- Prefer `cron` expressions over `fixedRate`/`fixedDelay` for anything tied to a real-world schedule (daily digests, nightly cleanups) — they read closer to the business requirement ("every day at 2am") than a millisecond interval does.
- Set an explicit `zone` on cron expressions whenever wall-clock time matters, rather than relying on the server's default timezone.
- Wrap the body of every `@Scheduled` method in a try/catch (or otherwise ensure exceptions don't propagate silently) and log failures loudly enough to trigger alerting — a scheduled job with no observability is a job nobody notices has stopped working.
- In any deployment that might scale beyond a single instance, either externalize the job (Kubernetes `CronJob`) or add a distributed lock (ShedLock or equivalent) up front — retrofitting this after duplicate-execution incidents happen in production is far more painful.
- Keep scheduled method bodies fast, or explicitly design for overlap safety if they're not — a job expected to take seconds that occasionally takes minutes due to a slow dependency should not silently pile up invocations.
- Log start/end and duration of scheduled jobs; without this, diagnosing "why didn't the cleanup run last night" is guesswork.

---

## 11. Hands-On Exercises

1. Add `@EnableScheduling` and a `@Scheduled(fixedRate = 5000)` method that prints the current time and thread name. Confirm it fires every 5 seconds and note the (default) thread name.
2. Change the method to sleep for 8 seconds before printing, keeping `fixedRate = 5000`. Observe (via the printed timestamps) that runs on the default single-threaded scheduler back up instead of overlapping — the gap between prints grows to roughly 8 seconds instead of 5.
3. Add a second `@Scheduled` method with a fast interval, alongside the slow one from exercise 2. Confirm the fast method's timing is thrown off by the slow one on the default scheduler, then fix it by configuring a `ThreadPoolTaskScheduler` with `poolSize = 5` and confirm both now run on their own independent schedules.
4. Write and test three different cron expressions: every weekday at 6pm, every 10 minutes between 9am and 5pm, and the first day of every month at midnight. Verify each by temporarily setting the server clock or by reasoning through the six cron fields explicitly.
5. Add the ShedLock starter (`shedlock-spring` + a JDBC or Redis provider) to a project with two application instances pointed at the same database/lock store. Run both instances simultaneously with a `@Scheduled` + `@SchedulerLock`-annotated method and confirm only one instance's logs show the method actually executing per trigger.

---

## 12. Interview Q&A

**Q1: What's the difference between `fixedRate` and `fixedDelay`?**
`fixedRate` measures the interval from the start of one execution to the start of the next, so a new invocation is triggered on schedule regardless of whether the previous one has finished — potentially causing overlap or queuing if the task runs longer than the rate. `fixedDelay` measures the interval from the end of one execution to the start of the next, guaranteeing a gap after completion but meaning the actual wall-clock cadence drifts if execution time varies from run to run. Use `fixedRate` for a consistent trigger cadence and `fixedDelay` when a run must never overlap with the next.

**Q2: Why is the default `@Scheduled` behavior risky in a production application with multiple scheduled jobs?**
Spring Boot's default `TaskScheduler`, used when no custom one is configured, runs on a single thread shared by every `@Scheduled` method in the application. If one job runs long — a slow external API call, a large batch update — every other scheduled method queues up behind it on that same thread and is delayed, potentially missing its intended trigger time entirely. The fix is registering a `ThreadPoolTaskScheduler` bean with a pool size large enough to run scheduled jobs concurrently.

**Q3: How many fields does a Spring `@Scheduled` cron expression have, and how does that differ from standard Unix cron?**
Spring's cron expressions have six fields: second, minute, hour, day-of-month, month, day-of-week. Standard Unix crontab syntax has only five fields (minute, hour, day-of-month, month, day-of-week) with no seconds field. Directly copying a Unix crontab entry into `@Scheduled(cron = ...)` without adding a leading seconds field shifts every subsequent field by one position, producing a schedule that silently means something different from what was intended.

**Q4: If you run three replicas of a service, what happens to a `@Scheduled` job — and how do you prevent duplicate execution?**
`@Scheduled` is evaluated independently per JVM instance, so all three replicas trigger and run the job on their own local schedule with no built-in coordination between them — for a job with real side effects (sending an email, processing billing), this means the work happens three times instead of once. The common fixes are: moving the job out of the application entirely into an external scheduler that invokes a single target (e.g., a Kubernetes `CronJob`), implementing leader election so only one instance's scheduled trigger actually executes, or using a distributed locking library like ShedLock so that whichever instance's trigger fires first acquires a shared lock and the others skip that run.

**Q5: What does ShedLock actually do, and what doesn't it do?**
ShedLock wraps a `@Scheduled` method with `@SchedulerLock` so that, across multiple application instances sharing a common lock store (a database table, Redis, etc.), only the instance that successfully acquires the lock for that trigger actually executes the method body — the rest detect the lock is held and skip silently. It does not provide a centralized distributed scheduler itself: each instance still independently evaluates its own local `@Scheduled` trigger (cron/fixedRate/fixedDelay) and only asks ShedLock for permission at execution time, so ShedLock solves "don't run twice," not "coordinate when to run."

**Q6: Why doesn't the self-invocation proxy pitfall (seen with `@Transactional`, `@Cacheable`, `@Async`) apply to `@Scheduled` methods?**
Self-invocation breaks proxy-based features when application code calls a method on `this` instead of through the external proxy. `@Scheduled` methods, however, are never called by application code at all — they're invoked directly by the `TaskScheduler` infrastructure on a timer, which always calls through the proxy since the scheduler holds a reference to the proxied bean from the application context. There's no internal "self-call" path to accidentally take, so the self-invocation trap simply doesn't arise for scheduled methods, though the proxy still applies other annotations like `@Transactional` on the same method normally.
