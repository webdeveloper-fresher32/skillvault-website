# Intermediate MySQL Projects

---

## Project 1: E-Commerce Platform

### Requirements

Build a production-ready e-commerce database with orders, products, customers, and reviews.

**Full Schema:**
```sql
CREATE TABLE customers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(200) UNIQUE NOT NULL,
  first_name  VARCHAR(100),
  last_name   VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP NULL   -- soft delete
);

CREATE TABLE categories (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  parent_id INT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  stock       INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  status      ENUM('pending','paid','shipped','delivered','cancelled') DEFAULT 'pending',
  total       DECIMAL(10,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  customer_id INT NOT NULL,
  rating      TINYINT CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, customer_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

**Required Queries:**
1. Monthly revenue report with month-over-month % change (window function)
2. Top 10 products by revenue this month
3. Customers who spent more than the average customer total
4. Products with average rating >= 4.0 and at least 10 reviews
5. Abandoned orders (pending > 7 days, never paid)
6. Category hierarchy — recursive CTE showing category tree with depth
7. Customer lifetime value: total spend per customer with rank

**Required Stored Programs:**
- Procedure `place_order(customer_id, product_id, quantity)` — check stock, insert order + item, decrement stock, return order_id
- Trigger AFTER UPDATE on order_items — recalculate orders.total
- Trigger AFTER INSERT on order_items — decrement products.stock

---

## Project 2: Blog Platform

### Requirements

Multi-author blog with posts, tags, comments, and analytics.

**Schema Overview:**
```sql
CREATE TABLE authors (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  email      VARCHAR(200) UNIQUE NOT NULL,
  bio        TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  author_id    INT NOT NULL,
  title        VARCHAR(300) NOT NULL,
  slug         VARCHAR(300) UNIQUE NOT NULL,
  body         LONGTEXT,
  status       ENUM('draft','published','archived') DEFAULT 'draft',
  view_count   INT DEFAULT 0,
  published_at TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_posts (title, body),
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE tags (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE comments (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  post_id   INT NOT NULL,
  author_id INT NULL,  -- NULL for anonymous
  body      TEXT NOT NULL,
  parent_id INT NULL,  -- for nested comments
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);
```

**Required Queries:**
1. Most popular posts this week (by view_count)
2. Posts with no comments
3. Authors with most published posts
4. Posts by tag — given a tag slug, return all published posts
5. Full-text search: posts matching a search term (MATCH ... AGAINST)
6. Recursive CTE: thread view for nested comments (comment + replies)
7. Author analytics: posts published per month per author (pivot-style)

---

## Project 3: Event Booking System

### Requirements

Venue management, events, tickets, and bookings.

**Key Schema Elements:**
- venues (id, name, address, capacity)
- events (id, venue_id, title, start_time, end_time, total_tickets, tickets_sold)
- ticket_types (id, event_id, name, price, quantity)
- bookings (id, customer_id, event_id, ticket_type_id, quantity, total_paid, status)
- customers (id, name, email)

**Required Queries:**
1. Events with available tickets (tickets_sold < total_tickets)
2. Revenue per event
3. Customers who booked more than 1 event
4. Events happening in next 7 days
5. Cancellation rate per event (cancelled bookings / total bookings)
6. Overbooking check — events where tickets_sold > venue.capacity

**Required Stored Programs:**
- Procedure `book_tickets(customer_id, ticket_type_id, qty)` — check availability, create booking in a transaction, update tickets_sold; rollback if overbooked
- Event (scheduled): nightly job to email-queue reminder for events happening tomorrow (insert into notification_queue table)

---

## Intermediate Milestones

- [ ] Full schema with FKs, constraints, indexes deployed
- [ ] 100+ rows seeded into each main table
- [ ] All required queries return correct results
- [ ] Window functions used in at least 2 queries
- [ ] CTEs used in at least 1 query per project
- [ ] EXPLAIN run on all queries — type = ALL resolved
- [ ] All stored procedures tested with edge cases (insufficient stock, overbooked, etc.)
