# Intermediate MongoDB Projects

---

## Project 1: E-Commerce Platform

### Requirements

Build a product catalog, order management, and customer system using MongoDB's document model.

**Collections and Sample Documents:**

```javascript
// products collection
{
  _id: ObjectId(),
  sku: "LAPTOP-001",
  name: "Dell XPS 15",
  category: { _id: ObjectId(), name: "Laptops", slug: "laptops" },
  price: 1299.99,
  stock: 45,
  attributes: {
    brand: "Dell",
    ram: 16,
    storage: 512,
    display: "15.6 inch OLED"
  },
  tags: ["laptop", "dell", "work", "oled"],
  images: ["img1.jpg", "img2.jpg"],
  ratings: { average: 4.5, count: 128 },
  isActive: true,
  createdAt: new Date()
}

// orders collection
{
  _id: ObjectId(),
  orderNumber: "ORD-2026-00123",
  customer: {
    _id: ObjectId("..."),
    name: "Alice Smith",
    email: "alice@example.com"
  },
  items: [
    { productId: ObjectId(), sku: "LAPTOP-001", name: "Dell XPS 15",
      qty: 1, unitPrice: 1299.99, subtotal: 1299.99 },
    { productId: ObjectId(), sku: "MOUSE-001", name: "Logitech MX",
      qty: 2, unitPrice: 79.99, subtotal: 159.98 }
  ],
  totals: { subtotal: 1459.97, tax: 145.99, shipping: 0, total: 1605.96 },
  status: "paid",
  shippingAddress: { street: "1 George St", city: "Sydney", country: "AU" },
  createdAt: new Date()
}
```

**Aggregation Pipelines to Write:**
1. Monthly revenue report — group by year/month, sum totals
2. Top 10 products by revenue — unwind items, group by product, sum subtotals
3. Average order value by customer country
4. Products with low stock (stock < 10) sorted by stock ascending
5. Category revenue breakdown — compute % of total revenue per category
6. Customer cohort: orders per customer, average order value, first/last order date

**Indexes to Create:**
```javascript
db.products.createIndex({ sku: 1 }, { unique: true })
db.products.createIndex({ "category._id": 1, isActive: 1 })
db.products.createIndex({ tags: 1 })
db.products.createIndex({ "attributes.ram": 1, "attributes.storage": 1 })
db.orders.createIndex({ "customer._id": 1, createdAt: -1 })
db.orders.createIndex({ status: 1, createdAt: -1 })
```

---

## Project 2: Multi-Author Blog Platform

### Requirements

Blog with posts, authors, comments, and tags.

**Schema Design Decision — Hybrid Embedding + Referencing:**
- Post body + metadata: embedded in post document
- Comments: referenced (separate comments collection — can be large)
- Author info in posts: embedded snapshot (name, avatar)
- Tags: embedded array of strings + separate tags collection for stats

```javascript
// posts collection
{
  _id: ObjectId(),
  title: "Getting Started with MongoDB",
  slug: "getting-started-mongodb",
  author: {
    _id: ObjectId("..."),
    name: "Ganesh",
    avatar: "ganesh.jpg"
  },
  body: "Full post content here...",
  tags: ["mongodb", "database", "nosql"],
  status: "published",
  publishedAt: ISODate("2026-06-24"),
  stats: { views: 1423, likes: 89, commentCount: 15 },
  createdAt: new Date()
}

// comments collection
{
  _id: ObjectId(),
  postId: ObjectId("..."),
  parentId: ObjectId("..."),   // for nested replies, null for top-level
  author: { _id: ObjectId("..."), name: "Bob" },
  body: "Great post!",
  likes: 5,
  createdAt: new Date()
}
```

**Queries and Aggregations:**
1. Posts by tag, sorted by publishedAt descending
2. Top 5 authors by total post views (sum stats.views)
3. Comments thread for a post — flat list sorted by createdAt
4. Full-text search: posts matching a search term (text index)
5. Weekly publishing stats: count of posts published per week
6. Posts with no comments (posts where stats.commentCount = 0)

**Text Search:**
```javascript
db.posts.createIndex({ title: "text", body: "text", tags: "text" })
db.posts.find({ $text: { $search: "mongodb aggregation pipeline" } },
              { score: { $meta: "textScore" } })
  .sort({ score: { $meta: "textScore" } })
```

---

## Project 3: Event Booking System

### Requirements

Venues, events, ticket types, and bookings.

```javascript
// events collection
{
  _id: ObjectId(),
  title: "MongoDB Conference 2026",
  venue: {
    _id: ObjectId("..."),
    name: "Sydney Convention Centre",
    capacity: 2000
  },
  ticketTypes: [
    { type: "general", price: 150, total: 1500, sold: 1123 },
    { type: "vip", price: 500, total: 200, sold: 87 },
    { type: "student", price: 50, total: 300, sold: 289 }
  ],
  startTime: ISODate("2026-09-15T09:00:00Z"),
  endTime: ISODate("2026-09-15T18:00:00Z"),
  status: "on_sale",
  tags: ["tech", "database", "conference"]
}

// bookings collection
{
  _id: ObjectId(),
  bookingRef: "BK-2026-04521",
  customerId: ObjectId("..."),
  eventId: ObjectId("..."),
  tickets: [
    { type: "general", qty: 2, unitPrice: 150, subtotal: 300 }
  ],
  totalPaid: 300,
  status: "confirmed",
  bookedAt: new Date()
}
```

**Aggregation Challenges:**
1. Events with available tickets — compute `total - sold` for each ticket type using `$map`
2. Revenue per event across all ticket types
3. Booking volume by day (last 30 days)
4. Customers who booked multiple events
5. Use `$arrayElemAt` to get the cheapest ticket type per event

**Update Operations:**
```javascript
// Atomic ticket purchase (prevent overselling)
db.events.updateOne(
  {
    _id: eventId,
    "ticketTypes.type": "general",
    $expr: {
      $lt: [
        { $arrayElemAt: [ "$ticketTypes.sold", { $indexOfArray: ["$ticketTypes.type", "general"] } ] },
        { $arrayElemAt: [ "$ticketTypes.total", { $indexOfArray: ["$ticketTypes.type", "general"] } ] }
      ]
    }
  },
  { $inc: { "ticketTypes.$.sold": 2 } }
)
```

---

## Intermediate Milestones

- [ ] All 3 schemas created with proper validation using `$jsonSchema`
- [ ] 500+ documents seeded per main collection using `insertMany()`
- [ ] All aggregation pipelines return correct results
- [ ] `$lookup` used for at least one cross-collection aggregation
- [ ] Text index created and tested for blog search
- [ ] `explain("executionStats")` run on all critical queries
- [ ] Composite indexes added and verified to be used (IXSCAN not COLLSCAN)
