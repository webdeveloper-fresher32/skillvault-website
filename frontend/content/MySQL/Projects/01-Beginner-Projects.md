# Beginner MySQL Projects

---

## Project 1: Library Management System

### Requirements

Design and build a complete library database.

**Entities:**
- Books (id, title, isbn, author, genre, publication_year, total_copies, available_copies)
- Members (id, name, email, phone, membership_date, expiry_date)
- Loans (id, book_id, member_id, loan_date, due_date, return_date)

**Queries to write:**
1. List all books currently checked out (not returned)
2. Find members with overdue books (due_date < TODAY and not returned)
3. Most popular books (most times loaned)
4. Members who have never borrowed a book
5. Books available right now (available_copies > 0)
6. Loan history for a specific member
7. How many books each genre has

**Constraints to enforce:**
- available_copies cannot go below 0
- loan_date must be <= due_date
- A member can't loan same book twice while unreturned (UNIQUE constraint)

**Starter Schema:**
```sql
CREATE TABLE books (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  isbn             VARCHAR(20) UNIQUE,
  author           VARCHAR(150),
  genre            VARCHAR(50),
  publication_year YEAR,
  total_copies     INT DEFAULT 1,
  available_copies INT DEFAULT 1,
  CHECK (available_copies >= 0),
  CHECK (available_copies <= total_copies)
);

CREATE TABLE members (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  phone           VARCHAR(20),
  membership_date DATE DEFAULT (CURDATE()),
  expiry_date     DATE
);

CREATE TABLE loans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  book_id     INT NOT NULL,
  member_id   INT NOT NULL,
  loan_date   DATE DEFAULT (CURDATE()),
  due_date    DATE NOT NULL,
  return_date DATE NULL,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);
```

---

## Project 2: Student Grade Tracker

### Requirements

Track students, courses, enrollments, and grades.

**Entities:**
- Students (id, name, email, enrollment_year, major)
- Courses (id, code, title, credits, department)
- Enrollments (student_id, course_id, semester, year, grade)

**Queries to write:**
1. GPA for each student (weighted by credits)
2. Students on Dean's List (GPA >= 3.5)
3. Courses with highest average grade
4. Students enrolled in a specific course
5. How many students in each major
6. Students who failed any course (grade < 1.0)
7. Transcript for a specific student (all courses + grades)

**Triggers to implement:**
- BEFORE INSERT on enrollments: prevent duplicate enrollment in same course+semester
- AFTER UPDATE on enrollments: log grade changes to a grade_changes table

---

## Project 3: Product Inventory Tracker

### Requirements

Track products, suppliers, warehouses, and stock.

**Entities:**
- Products (id, sku, name, category, unit_price, reorder_level)
- Suppliers (id, name, email, country)
- Warehouses (id, name, city, capacity)
- Stock (product_id, warehouse_id, quantity)
- Purchase_orders (id, supplier_id, product_id, quantity, unit_cost, ordered_at, received_at)

**Queries to write:**
1. Products below reorder level (needs restocking)
2. Total stock per product across all warehouses
3. Which warehouse has the most of a specific product
4. Supplier performance: average days to fulfill order
5. Products never ordered from a specific supplier
6. Low stock report (stock < reorder_level with supplier info)

**Events to implement:**
- Daily event: flag products where total stock < reorder_level and insert into `restock_alerts` table

**Sample Seed Data:**
```sql
INSERT INTO products (sku, name, category, unit_price, reorder_level) VALUES
('SKU001', 'Laptop Dell XPS', 'Electronics', 999.99, 10),
('SKU002', 'Wireless Mouse', 'Accessories', 29.99, 50),
('SKU003', 'USB-C Hub', 'Accessories', 49.99, 30);

INSERT INTO suppliers (name, email, country) VALUES
('TechDistrib Pty Ltd', 'orders@techdistrib.com', 'AU'),
('Global Electronics', 'supply@globalelec.com', 'SG');

INSERT INTO warehouses (name, city, capacity) VALUES
('Sydney Central', 'Sydney', 10000),
('Melbourne Hub', 'Melbourne', 8000);
```

---

## Beginner Milestones

- [ ] All 3 schemas created with proper constraints and FKs
- [ ] At least 20 rows seeded into each main table
- [ ] All listed queries running correctly
- [ ] EXPLAIN run on at least one query per project — indexes added where beneficial
- [ ] At least one trigger implemented per project
