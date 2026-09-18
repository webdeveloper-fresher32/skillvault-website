# Advanced MongoDB Projects

---

## Project 1: Real-Time Analytics Platform

### Requirements

Time-series event data with aggregation pipelines, change streams, and Atlas Search.

**Schema Design — Time-Series Optimized:**
```javascript
// Use MongoDB Time Series collection (5.0+)
db.createCollection("user_events", {
  timeseries: {
    timeField: "timestamp",
    metaField: "metadata",
    granularity: "minutes"
  }
})

// Document structure
{
  timestamp: ISODate("2026-06-24T10:30:00Z"),
  metadata: {
    userId: ObjectId("..."),
    sessionId: "sess_abc123",
    country: "AU",
    device: "mobile"
  },
  event: "page_view",
  properties: {
    page: "/products/laptop-001",
    referrer: "google",
    duration_ms: 8500
  }
}
```

**Advanced Aggregation Pipelines:**

```javascript
// 1. Daily Active Users (DAU) — last 30 days
db.user_events.aggregate([
  { $match: {
    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }
  }},
  { $group: {
    _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } },
    dau: { $addToSet: "$metadata.userId" }
  }},
  { $project: { date: "$_id.date", dau: { $size: "$dau" } }},
  { $sort: { date: 1 } }
])

// 2. User Funnel (page_view → add_to_cart → purchase)
db.user_events.aggregate([
  { $match: { event: { $in: ["page_view", "add_to_cart", "purchase"] } }},
  { $group: {
    _id: "$event",
    uniqueUsers: { $addToSet: "$metadata.userId" }
  }},
  { $project: { event: "$_id", count: { $size: "$uniqueUsers" } }},
  { $sort: { count: -1 } }
])

// 3. Bucket by session duration
db.user_events.aggregate([
  { $group: {
    _id: "$metadata.sessionId",
    totalMs: { $sum: "$properties.duration_ms" }
  }},
  { $bucket: {
    groupBy: "$totalMs",
    boundaries: [0, 10000, 30000, 60000, 300000, Infinity],
    default: "Other",
    output: { sessions: { $sum: 1 }, avgMs: { $avg: "$totalMs" } }
  }}
])
```

**Change Streams:**
```javascript
// Watch for new purchases in real-time
const changeStream = db.user_events.watch([
  { $match: { "fullDocument.event": "purchase" } }
])

changeStream.on("change", (change) => {
  console.log("New purchase:", change.fullDocument.properties)
  // Trigger notification, update dashboard, etc.
})
```

---

## Project 2: Social Network with Graph-Like Queries

### Requirements

Users, posts, follows, and complex social graph queries.

**Schema:**
```javascript
// users
{
  _id: ObjectId(),
  username: "ganesh_p",
  following: [ObjectId("user2"), ObjectId("user3")],  // embedded array (max ~1000)
  followingCount: 2,
  followerCount: 150,
  profile: { bio: "...", avatar: "...", location: "Sydney" }
}

// posts
{
  _id: ObjectId(),
  authorId: ObjectId("..."),
  body: "Building cool things with MongoDB!",
  media: ["img1.jpg"],
  likes: [ObjectId("user2"), ObjectId("user5")],   // embedded for small counts
  likeCount: 2,
  comments: [
    { _id: ObjectId(), authorId: ObjectId("..."), body: "Nice!", createdAt: new Date() }
  ],  // embed up to ~50 comments, reference beyond
  tags: ["mongodb", "tech"],
  createdAt: new Date()
}
```

**Complex Queries:**

```javascript
// 1. News feed: posts from users you follow
const user = db.users.findOne({ _id: myUserId })
db.posts.find(
  { authorId: { $in: user.following } },
  { sort: { createdAt: -1 }, limit: 20 }
)

// 2. Mutual follows (friends = both follow each other)
db.users.aggregate([
  { $match: { _id: myUserId } },
  { $lookup: {
    from: "users",
    let: { myFollowing: "$following" },
    pipeline: [
      { $match: { $expr: { $in: [myUserId, "$following"] } } },
      { $match: { $expr: { $in: ["$$ROOT._id", "$$myFollowing"] } } }
    ],
    as: "mutualFriends"
  }},
  { $project: { mutualFriends: { username: 1 } } }
])

// 3. "People you may know" — follows of follows, not already following
db.users.aggregate([
  { $match: { _id: myUserId } },
  { $lookup: { from: "users", localField: "following", foreignField: "_id", as: "myFollowing" }},
  { $unwind: "$myFollowing" },
  { $unwind: "$myFollowing.following" },
  { $match: { "myFollowing.following": { $nin: [...user.following, myUserId] } }},
  { $group: { _id: "$myFollowing.following", count: { $sum: 1 } }},
  { $sort: { count: -1 } },
  { $limit: 10 }
])
```

---

## Project 3: Multi-Tenant SaaS Platform

### Requirements

Schema design for a B2B SaaS product: organizations, users, workspaces, and data isolation.

**Schema Design Decision: Shared Collections with Tenant Scoping**

```javascript
// organizations (tenants)
{
  _id: ObjectId(),
  slug: "acme-corp",
  name: "Acme Corporation",
  plan: "enterprise",
  settings: { maxUsers: 500, featuresEnabled: ["analytics", "api_access"] },
  createdAt: new Date()
}

// users (scoped to org)
{
  _id: ObjectId(),
  orgId: ObjectId("..."),        // tenant key — on ALL documents
  email: "alice@acme.com",
  role: "admin",
  workspaceAccess: [ObjectId("ws1"), ObjectId("ws2")],
  createdAt: new Date()
}

// workspaces
{
  _id: ObjectId(),
  orgId: ObjectId("..."),
  name: "Product Team",
  members: [
    { userId: ObjectId("..."), role: "owner" },
    { userId: ObjectId("..."), role: "member" }
  ]
}

// projects (workspace-scoped)
{
  _id: ObjectId(),
  orgId: ObjectId("..."),        // always include for tenant isolation
  workspaceId: ObjectId("..."),
  title: "Q3 Roadmap",
  tasks: [
    { _id: ObjectId(), title: "Design schema", status: "done", assigneeId: ObjectId("...") }
  ],
  createdAt: new Date()
}
```

**Compound Indexes for Tenant Isolation:**
```javascript
// orgId FIRST on every collection — mandatory for multi-tenant performance
db.users.createIndex({ orgId: 1, email: 1 }, { unique: true })
db.projects.createIndex({ orgId: 1, workspaceId: 1, createdAt: -1 })
db.projects.createIndex({ orgId: 1, "tasks.assigneeId": 1 })
```

**Aggregation: Tenant Usage Report**
```javascript
db.users.aggregate([
  { $group: {
    _id: "$orgId",
    userCount: { $sum: 1 },
    admins: { $sum: { $cond: [{ $eq: ["$role","admin"] }, 1, 0] } }
  }},
  { $lookup: { from: "organizations", localField: "_id", foreignField: "_id", as: "org" }},
  { $unwind: "$org" },
  { $project: { orgName: "$org.name", plan: "$org.plan", userCount: 1, admins: 1 }},
  { $sort: { userCount: -1 } }
])
```

**Transaction — Workspace Membership:**
```javascript
// Add user to workspace + update their workspaceAccess array atomically
const session = client.startSession()
session.withTransaction(async () => {
  await db.workspaces.updateOne(
    { _id: workspaceId, orgId: orgId },
    { $push: { members: { userId: userId, role: "member" } } },
    { session }
  )
  await db.users.updateOne(
    { _id: userId, orgId: orgId },
    { $addToSet: { workspaceAccess: workspaceId } },
    { session }
  )
})
```

---

## Advanced Milestones

- [ ] Time-series collection deployed and queried correctly
- [ ] Change stream implemented and tested (watch for new events)
- [ ] All aggregation pipelines use `explain("executionStats")` — 0 COLLSCAN
- [ ] Multi-tenant indexes all have `orgId` as first field
- [ ] Transaction used for at least one multi-document operation
- [ ] Atlas Search (or text index) implemented and tested
- [ ] Sharding key selected and justified for the largest collection
- [ ] Schema validated with `$jsonSchema` validator
- [ ] Replica set failover tested (step down primary, verify reads/writes continue)
