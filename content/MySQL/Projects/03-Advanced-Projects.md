# Advanced MySQL Projects

---

## Project 1: Banking / Financial Ledger System

### Requirements

A high-integrity financial system with immutable transaction records, balance tracking, and audit trail.

**Schema:**
```sql
CREATE TABLE account_holders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(200) UNIQUE NOT NULL,
  kyc_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  holder_id      INT NOT NULL,
  account_number CHAR(12) UNIQUE NOT NULL,
  account_type   ENUM('checking','savings','credit'),
  status         ENUM('active','frozen','closed') DEFAULT 'active',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (holder_id) REFERENCES account_holders(id)
);

-- LEDGER: append-only — never UPDATE or DELETE
CREATE TABLE ledger_entries (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id   INT NOT NULL,
  amount       DECIMAL(15,4) NOT NULL,   -- positive=credit, negative=debit
  type         ENUM('deposit','withdrawal','transfer','fee','interest','reversal'),
  reference_id BIGINT NULL,              -- link transfer pairs together
  description  VARCHAR(200),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_account_date (account_id, created_at),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Summary view: current balance
CREATE VIEW account_balances AS
SELECT account_id, SUM(amount) AS balance
FROM ledger_entries
GROUP BY account_id;
```

**Stored Procedure — Transfer:**
```sql
DELIMITER $$
CREATE PROCEDURE transfer_funds(
  IN from_acct INT, IN to_acct INT,
  IN amount DECIMAL(15,4), IN description VARCHAR(200)
)
BEGIN
  DECLARE current_balance DECIMAL(15,4);
  DECLARE ref_id BIGINT;

  START TRANSACTION;

  -- Lock both accounts (consistent order to prevent deadlock)
  SELECT SUM(amount) INTO current_balance
  FROM ledger_entries
  WHERE account_id = from_acct
  FOR UPDATE;

  IF current_balance < amount THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
  END IF;

  -- Debit source
  INSERT INTO ledger_entries (account_id, amount, type, description)
  VALUES (from_acct, -amount, 'transfer', description);
  SET ref_id = LAST_INSERT_ID();

  -- Credit destination
  INSERT INTO ledger_entries (account_id, amount, type, reference_id, description)
  VALUES (to_acct, amount, 'transfer', ref_id, description);

  -- Update source reference_id
  UPDATE ledger_entries SET reference_id = LAST_INSERT_ID() WHERE id = ref_id;

  COMMIT;
END$$
DELIMITER ;
```

**Required Queries:**
1. Current balance for all accounts (from ledger_entries sum)
2. Transaction history for an account with running balance (window function)
3. Monthly income/expense summary per account
4. Accounts with negative balance
5. Find transfer pairs (outgoing + incoming for same reference_id)
6. Point-in-time balance: balance of account X as of date Y
7. Top 10 accounts by transaction volume this month

---

## Project 2: Social Network (Friends, Posts, Feed)

### Requirements

Build the data layer for a social platform.

**Schema Overview:**
```sql
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50) UNIQUE NOT NULL,
  email        VARCHAR(200) UNIQUE NOT NULL,
  bio          TEXT,
  follower_count INT DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friendships (bidirectional — smaller id always in user1_id)
CREATE TABLE friendships (
  user1_id   INT NOT NULL,
  user2_id   INT NOT NULL,
  status     ENUM('pending','accepted','blocked') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user1_id, user2_id),
  CHECK (user1_id < user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);

CREATE TABLE posts (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  body       TEXT,
  like_count INT DEFAULT 0,
  visibility ENUM('public','friends','private') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE post_likes (
  post_id    BIGINT NOT NULL,
  user_id    INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE follows (
  follower_id INT NOT NULL,
  followee_id INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (followee_id) REFERENCES users(id)
);
```

**Required Queries:**
1. News feed: posts from users you follow, last 20, newest first
2. Mutual friends between two users (intersection query)
3. "People you may know" — friends of friends you're not already friends with
4. Most liked posts this week
5. Users who followed you back
6. Trending hashtags (extracted from post body using REGEXP_REPLACE)
7. User activity stats: posts, likes given, likes received

**Optimization Challenge:**
- Run EXPLAIN on the news feed query — identify the bottleneck
- Add appropriate composite index (followee_id, created_at)
- Verify EXPLAIN improvement

---

## Project 3: Analytics Pipeline — Partitioned Log System

### Requirements

High-volume event logging system with partitioning, archiving, and reporting.

**Partitioned Events Table:**
```sql
CREATE TABLE user_events (
  id         BIGINT NOT NULL AUTO_INCREMENT,
  user_id    INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  properties JSON,
  session_id VARCHAR(64),
  ip_address VARCHAR(45),
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2024 VALUES LESS THAN (2025),
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_2026 VALUES LESS THAN (2027),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Daily summary table (pre-aggregated for fast dashboards)
CREATE TABLE event_daily_summary (
  summary_date DATE NOT NULL,
  event_type   VARCHAR(50) NOT NULL,
  event_count  BIGINT DEFAULT 0,
  unique_users INT DEFAULT 0,
  PRIMARY KEY (summary_date, event_type)
);
```

**Required Scheduled Events:**
```sql
-- Nightly: populate daily summary
CREATE EVENT build_daily_summary
  ON SCHEDULE EVERY 1 DAY
    STARTS CONCAT(CURDATE() + INTERVAL 1 DAY, ' 01:00:00')
  ON COMPLETION PRESERVE
  DO
    INSERT INTO event_daily_summary (summary_date, event_type, event_count, unique_users)
    SELECT
      DATE(created_at),
      event_type,
      COUNT(*),
      COUNT(DISTINCT user_id)
    FROM user_events
    WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY
    GROUP BY DATE(created_at), event_type
    ON DUPLICATE KEY UPDATE
      event_count = VALUES(event_count),
      unique_users = VALUES(unique_users);
```

**Required Queries:**
1. Daily active users (DAU) for last 30 days — from summary table
2. User funnel: count users who fired event A → event B → event C (in order)
3. Session analysis: average events per session
4. Top 10 JSON property values for a given event_type (JSON functions)
5. Week-over-week event count change by event_type (window function)
6. Partition health check: row counts per partition

**Architecture Challenges:**
- Add a generated column + index on `properties->>'$.page'` for the most queried JSON field
- Implement EXCHANGE PARTITION to archive p_2024 to `user_events_2024_archive` table
- Design a schema for A/B test tracking (experiments, variants, assignments, conversions)

---

## Advanced Milestones

- [ ] All 3 schemas fully deployed with production-quality constraints
- [ ] Banking: transfer_funds procedure tested for insufficient funds, concurrent transfers (2 sessions)
- [ ] Social: news feed query optimized — EXPLAIN shows no full table scans
- [ ] Analytics: partitioning verified with EXPLAIN showing partition pruning
- [ ] Each project: at least one complex window function query
- [ ] Each project: at least one recursive CTE
- [ ] Deadlock scenario created and documented with prevention fix
- [ ] Performance before/after documented for at least one index optimization
