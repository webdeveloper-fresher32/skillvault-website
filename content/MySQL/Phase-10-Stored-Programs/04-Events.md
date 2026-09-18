# Events (Scheduled Jobs) — MySQL Complete Guide

## Table of Contents
1. [What are Events?](#1-what-are-events)
2. [Event Scheduler Setup](#2-event-scheduler-setup)
3. [One-Time Events](#3-one-time-events)
4. [Recurring Events](#4-recurring-events)
5. [Practical Event Examples](#5-practical-event-examples)
6. [Managing Events](#6-managing-events)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What are Events?

Picture this: your `user_sessions` table is quietly filling up with expired rows every single day. Your `password_reset_tokens` table never cleans itself up either. Somebody needs to run a `DELETE` at 2am, every night, forever — and you don't want that "somebody" to be you, manually, at 2am.

The usual fix outside the database is a cron job on some server, calling a script, that connects to MySQL and runs the cleanup. That works, but now you've got one more moving part to babysit — a server that has to be up, a script that has to be deployed, a cron entry that has to survive server migrations.

What if the database could just do this to itself?

That's exactly what a MySQL **Event** is. Think of it as an alarm clock built into MySQL itself — you set it once ("every day at 2am, run this DELETE"), and MySQL rings that alarm forever, without any external scheduler, script, or cron daemon involved. It's the same idea as setting a recurring reminder on your phone's calendar, except the "reminder" is a SQL statement, and the "phone" is the database server.

Formally: MySQL Events are scheduled tasks — stored programs that run automatically at specified times, similar to cron jobs, but they live and run entirely inside MySQL.

```
One-time event:   Run once at a specific datetime
Recurring event:  Run every N seconds/minutes/hours/days/weeks/months/years

USE CASES:
  ✅ Purging old/expired data (sessions, logs, temp tables)
  ✅ Generating daily/weekly reports
  ✅ Refreshing summary/aggregate tables
  ✅ Sending reminder notifications via a queue
  ✅ Database maintenance (OPTIMIZE TABLE, ANALYZE TABLE)
```

### Events vs. cron vs. triggers — what actually fires them?

It's easy to mix these three up, since they're all "things that run automatically." The difference is *what wakes them up*:

| Mechanism | Triggered by | Runs where | Can call external systems? |
|---|---|---|---|
| **MySQL Event** | The clock (a schedule you define) | Inside MySQL | No — SQL only |
| **External cron job** | The clock (the OS scheduler) | Outside MySQL, on a server | Yes — shell, HTTP, anything |
| **Trigger** | A data change (INSERT/UPDATE/DELETE on a table) | Inside MySQL | No — SQL only |

So an Event and a cron job are both "time-based," but only the Event lives inside the database. A trigger, on the other hand, isn't time-based at all — it fires because of a *write*, not because of a *clock*. Don't confuse "runs automatically" with "runs on a schedule" — triggers run automatically too, just for a completely different reason.

---

## 2. Event Scheduler Setup

Here's the single most common way people get burned by Events: they write a perfectly correct `CREATE EVENT`, wait for it to fire... and nothing happens. Not an error. Not a warning. Just silence.

Why? Because the alarm clock has a power switch, and by default, that switch is **off**.

MySQL ships with `event_scheduler = OFF` out of the box. Your `CREATE EVENT` statement succeeds, the event sits there in the catalog with a perfectly valid schedule — but nobody is watching the clock. It's like setting your phone alarm for 2am while the phone itself is powered off. The alarm is "set," technically, but nothing is going to ring.

**What's actually running under the hood:**

```
     event_scheduler = OFF                event_scheduler = ON
     ----------------------                ---------------------
     CREATE EVENT stored in                A background thread
     mysql.events table                    ("event_scheduler")
             |                             wakes up periodically
             v                                     |
     ...nothing checks it...                       v
     ...ever...                            Scans mysql.events for
                                            anything due to run
                                                     |
                                                     v
                                            Executes the DO clause
                                            for every due event
```

So the very first thing to do — before writing a single `CREATE EVENT` — is turn the scheduler on and confirm it's actually running:

```sql
-- Check scheduler status
SHOW VARIABLES LIKE 'event_scheduler';
-- Value: OFF by default

-- Enable for current session
SET GLOBAL event_scheduler = ON;

-- Enable permanently (add to my.cnf / my.ini):
-- [mysqld]
-- event_scheduler = ON

-- Check it's running
SHOW PROCESSLIST;
-- You should see a row: User=event_scheduler, Command=Daemon
```

Notice that last check isn't optional busywork — `SHOW VARIABLES` tells you the setting is ON, but `SHOW PROCESSLIST` is what proves a live background thread actually picked it up and is out there ticking. Trust, but verify.

**Common mistake:** setting `event_scheduler = ON` with `SET GLOBAL` and calling it done. That setting only lives in memory — restart the MySQL server, and it silently reverts to OFF, taking every one of your "recurring forever" events down with it. If you need this to survive a restart, it has to go into `my.cnf`/`my.ini` under `[mysqld]` as well. The number of "why did my nightly cleanup stop running after last week's server reboot" tickets this one gotcha causes is not small.

**Interview answer:** "MySQL Events won't fire unless the global `event_scheduler` system variable is ON — and it's OFF by default. Enabling it with `SET GLOBAL event_scheduler = ON` only takes effect immediately and in memory; it doesn't survive a restart unless you also add `event_scheduler = ON` to the `[mysqld]` section of the config file. You can confirm the scheduler is actually alive — not just configured — by checking `SHOW PROCESSLIST` for a background thread with `User = event_scheduler` and `Command = Daemon`."

> **Memory hook:** "An unset alarm clock doesn't ring just because you plugged it in — flip `event_scheduler` ON, then check the processlist to see the clock actually ticking."

---

## 3. One-Time Events

Sometimes you don't need a recurring alarm at all — just a single "wake me up at this exact moment, once, then forget about it" reminder. That's the `AT` form of `ON SCHEDULE`. It fires exactly once, at the datetime you give it, and (by default) disappears from the system afterwards.

```sql
-- Run once at a specific time
CREATE EVENT archive_old_orders
  ON SCHEDULE AT '2026-12-31 23:59:59'
  DO
    INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < '2026-01-01';

-- Run once 1 hour from now
CREATE EVENT temp_cleanup
  ON SCHEDULE AT NOW() + INTERVAL 1 HOUR
  DO
    DELETE FROM temp_data WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR);
```

Notice you can either give an absolute datetime literal (`'2026-12-31 23:59:59'`), or compute one relative to right now (`NOW() + INTERVAL 1 HOUR`) — both are just expressions MySQL evaluates once, at creation time, to figure out when to ring the alarm.

---

## 4. Recurring Events

A one-time event is a single alarm. A recurring event is more like setting your alarm to "every day at 7am" — you configure it once, and it just keeps going off on schedule, forever (or until an `ENDS` date, if you set one). This is the `EVERY` form of `ON SCHEDULE`, and it's the one you'll reach for most — nightly cleanups, hourly refreshes, weekly maintenance.

Here's the full shape of the statement:

```sql
CREATE EVENT event_name
  ON SCHEDULE EVERY interval
    [STARTS datetime]
    [ENDS datetime]
  [ON COMPLETION {PRESERVE | NOT PRESERVE}]
  [ENABLE | DISABLE]
  DO
    -- SQL statement or BEGIN...END block;
```

Read that skeleton left to right: `EVERY interval` says how often, `STARTS`/`ENDS` optionally bound the window it's active in, `ON COMPLETION` decides whether the definition sticks around once it's done firing, and `ENABLE`/`DISABLE` is just an on/off switch for the individual event (separate from the global `event_scheduler` switch from Section 2 — that one turns the whole scheduler thread on or off; this one pauses just this one event).

### EVERY Interval Options

The interval itself can be as fine-grained as seconds or as coarse as years — pick whatever matches how often the underlying data actually needs attention:

```
EVERY 30 SECOND
EVERY 5 MINUTE
EVERY 1 HOUR
EVERY 1 DAY
EVERY 1 WEEK
EVERY 1 MONTH
EVERY 1 YEAR
```

```sql
-- Run every day, starting tomorrow at midnight
CREATE EVENT daily_report
  ON SCHEDULE EVERY 1 DAY
    STARTS '2026-06-25 00:00:00'
  ON COMPLETION PRESERVE
  DO
    INSERT INTO daily_stats(date, total_orders, total_revenue)
    SELECT CURDATE() - INTERVAL 1 DAY,
           COUNT(*),
           SUM(total)
    FROM orders
    WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY;
```

### Multi-Statement Events

A single `DO` clause isn't limited to one statement. Wrap several statements in a `BEGIN...END` block — exactly like a stored procedure body — and the event runs the whole sequence every time it fires:

```sql
DELIMITER $$

CREATE EVENT weekly_cleanup
  ON SCHEDULE EVERY 1 WEEK
    STARTS '2026-06-30 02:00:00'
  ON COMPLETION PRESERVE
  DO
BEGIN
  -- Delete expired sessions
  DELETE FROM user_sessions WHERE expires_at < NOW();

  -- Delete old log entries
  DELETE FROM activity_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

  -- Optimize tables
  OPTIMIZE TABLE user_sessions;
  OPTIMIZE TABLE activity_log;
END$$

DELIMITER ;
```

---

## 5. Practical Event Examples

Theory aside, here are the three shapes of Event you'll actually write on the job — each one solving a real, recognizable pain point.

### Purge Expired Tokens Every 15 Minutes

Password reset tokens that never expire from the table are a housekeeping problem waiting to happen. This event just keeps sweeping them out:

```sql
CREATE EVENT purge_expired_tokens
  ON SCHEDULE EVERY 15 MINUTE
  ON COMPLETION PRESERVE
  DO
    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW();
```

### Refresh Materialized View Daily

MySQL has no built-in materialized views, but an Event can fake one perfectly well: truncate a summary table and rebuild it from scratch, once a day, while everyone's asleep:

```sql
DELIMITER $$

CREATE EVENT refresh_product_stats
  ON SCHEDULE EVERY 1 DAY
    STARTS CONCAT(CURDATE() + INTERVAL 1 DAY, ' 03:00:00')
  ON COMPLETION PRESERVE
  DO
BEGIN
  TRUNCATE TABLE product_stats_summary;

  INSERT INTO product_stats_summary(product_id, total_sold, total_revenue, last_updated)
  SELECT
    product_id,
    SUM(quantity),
    SUM(quantity * unit_price),
    NOW()
  FROM order_items
  GROUP BY product_id;
END$$

DELIMITER ;
```

### Archive and Delete Old Records Monthly

And here's the "keep the hot table small" pattern: copy anything old into an archive table, then remove it from the table your application queries every day:

```sql
DELIMITER $$

CREATE EVENT monthly_archive
  ON SCHEDULE EVERY 1 MONTH
    STARTS '2026-07-01 01:00:00'
  ON COMPLETION PRESERVE
  DO
BEGIN
  -- Archive orders older than 2 years
  INSERT INTO orders_archive
  SELECT * FROM orders
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);

  -- Delete archived records from main table
  DELETE FROM orders
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);
END$$

DELIMITER ;
```

---

## 6. Managing Events

Once an event exists, you'll want to inspect it, pause it, reschedule it, or get rid of it entirely — without having to drop and recreate the whole thing every time you tweak the schedule.

```sql
-- List all events
SHOW EVENTS\G

-- Show events for specific database
SHOW EVENTS FROM mydb\G

-- View event definition
SHOW CREATE EVENT daily_report\G

-- Disable an event (without deleting)
ALTER EVENT daily_report DISABLE;

-- Re-enable
ALTER EVENT daily_report ENABLE;

-- Change schedule
ALTER EVENT daily_report
  ON SCHEDULE EVERY 1 DAY
    STARTS '2026-07-01 00:00:00';

-- Drop event
DROP EVENT IF EXISTS daily_report;

-- ON COMPLETION PRESERVE vs NOT PRESERVE:
-- PRESERVE: event stays in system after last execution
-- NOT PRESERVE (default for one-time): event auto-deletes after running
```

Two pairs of similarly-named options are easy to mix up here, so it's worth spelling out the difference plainly:

- **DISABLE vs. DROP** — `DISABLE` just flips the switch off; the event definition is still sitting in `mysql.events`, ready to be `ENABLE`d again. `DROP` deletes the definition outright. Reach for `DISABLE` when you want a temporary pause (maintenance window, investigating a bug); reach for `DROP` when the event has genuinely outlived its usefulness.
- **PRESERVE vs. NOT PRESERVE** — this is about what happens *after* an event has no more runs left (a one-time event that already fired, or a recurring event past its `ENDS` date). `NOT PRESERVE` (the default for one-time events) cleans up automatically — the event just vanishes once it's done its job. `PRESERVE` keeps the definition around so you can review it or re-enable it later.

> **Memory hook:** "DISABLE is muting the alarm; DROP is throwing the alarm clock away. PRESERVE keeps the spent alarm on the shelf; NOT PRESERVE tosses it in the bin the moment it's rung its last ring."

---

## 7. Hands-On Exercises

**Exercise 1:** Enable the event scheduler. Verify it's running with SHOW PROCESSLIST.

**Exercise 2:** Create a one-time event that runs 2 minutes from now and inserts a row into a `event_log` table with a timestamp. Check the table after 2 minutes.

**Exercise 3:** Create a recurring event that runs every minute and deletes rows from a `temp_messages` table where `created_at` is older than 5 minutes.

**Exercise 4:** Create a daily event that calculates and stores the count of new users registered yesterday into a `daily_metrics` table.

**Exercise 5:** Disable an event with ALTER EVENT, verify it no longer fires, then re-enable it.

---

## 8. Interview Q&A

**Q: What is a MySQL Event?**
Answer: A MySQL Event is a scheduled task that runs automatically at a specific time or on a recurring schedule. It's similar to a cron job but managed entirely within MySQL. Events require the event_scheduler to be enabled and are useful for automated data cleanup, reporting, and maintenance tasks.

**Q: How do you enable the MySQL event scheduler?**
Answer: Run `SET GLOBAL event_scheduler = ON;` for immediate activation, or add `event_scheduler = ON` to the `[mysqld]` section of my.cnf for persistence across restarts. Check status with `SHOW VARIABLES LIKE 'event_scheduler'`.

**Q: What is ON COMPLETION PRESERVE?**
Answer: By default, one-time events are dropped after they execute (NOT PRESERVE). ON COMPLETION PRESERVE keeps the event in the system after its last execution — useful for reviewing event history or re-enabling it later. Recurring events with PRESERVE stay even after their END date passes.

**Q: What is the difference between DISABLE and DROP for events?**
Answer: DISABLE (via `ALTER EVENT ... DISABLE`) stops the event from firing but keeps its definition — you can re-enable it later. DROP permanently removes the event definition. Use DISABLE when you want a temporary pause; DROP when the event is no longer needed.

**Q: Can events replace application-level cron jobs?**
Answer: Events are a good fit for database-centric tasks (cleanup, aggregation) since they run directly against the DB without network round-trips. However, they're limited to SQL — you can't make HTTP calls or run shell commands. For complex workflows involving external systems, use application-level cron jobs that call MySQL via stored procedures.
