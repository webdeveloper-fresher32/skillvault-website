# Beginner MongoDB Projects

```
┌─────────────────────────────────────────────────────────────────┐
│                     BEGINNER PROJECTS                           │
│          Build Confidence with Core MongoDB Operations          │
└─────────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Project 1: Contact Book](#project-1-contact-book)
   - [Schema Design](#schema-design-contact-book)
   - [Setup Instructions](#setup-contact-book)
   - [Tasks 1-10](#tasks-contact-book)
2. [Project 2: Movie Database](#project-2-movie-database)
   - [Schema Design](#schema-design-movie-db)
   - [Setup Instructions](#setup-movie-db)
   - [Tasks 1-10](#tasks-movie-db)
3. [Project 3: Simple Blog](#project-3-simple-blog)
   - [Schema Design](#schema-design-blog)
   - [Setup Instructions](#setup-blog)
   - [Tasks 1-10](#tasks-blog)
4. [Hands-On Exercises](#hands-on-exercises)
5. [Interview Q&A](#interview-qa)

---

## Project 1: Contact Book

> **Analogy:** Think of this like building a digital Rolodex. Each card (document) holds all the details for one person — their phones, addresses, and tags — in one place. No foreign keys, no joins, just one document per contact.

### What You Will Build

A contact management system that stores people's information with multiple phone numbers, an address, and searchable tags. You will learn embedded documents and array operations.

---

### Schema Design: Contact Book

```
┌────────────────────────────────────────────────────────┐
│                  contacts collection                   │
├────────────────────────────────────────────────────────┤
│  _id        : ObjectId  (auto-generated)               │
│  name       : String    (required)                     │
│  email      : String    (unique, indexed)              │
│  phones     : Array of  { type, number }               │
│  address    : Object    { street, city, country }      │
│  tags       : Array of  String                         │
│  createdAt  : Date      (default: Date.now)            │
└────────────────────────────────────────────────────────┘
```

**Full JSON Schema:**

```json
{
  "_id": "ObjectId('64a1f2e3b5c6d7e8f9a0b1c2')",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phones": [
    { "type": "mobile",  "number": "+1-555-0101" },
    { "type": "work",    "number": "+1-555-0102" }
  ],
  "address": {
    "street": "42 Wallaby Way",
    "city":   "Sydney",
    "country": "Australia"
  },
  "tags": ["friend", "colleague", "python"],
  "createdAt": "ISODate('2024-01-15T09:00:00Z')"
}
```

**Why embed phones and address?**

```
RELATIONAL APPROACH              MONGODB APPROACH
────────────────────             ─────────────────────────────
contacts table                   contacts collection
  + phones table (FK)     vs.      phones embedded in document
  + addresses table (FK)           address embedded in document
  + tags table (FK)                tags embedded as array

3 tables, 2 JOINs per query      1 collection, 0 joins needed
```

Embedding works here because phones/addresses are always fetched with the contact, never queried independently, and the count stays bounded (a person won't have 10,000 phone numbers).

---

### Setup: Contact Book

**Step 1 — Start MongoDB shell or use mongosh:**

```bash
mongosh
```

**Step 2 — Create or switch to the database:**

```js
use contactBook
```

**Step 3 — Insert sample data:**

```js
db.contacts.insertMany([
  {
    name: "Alice Johnson",
    email: "alice@example.com",
    phones: [
      { type: "mobile", number: "+1-555-0101" },
      { type: "work",   number: "+1-555-0102" }
    ],
    address: { street: "42 Wallaby Way", city: "Sydney", country: "Australia" },
    tags: ["friend", "colleague", "python"],
    createdAt: new Date("2024-01-15")
  },
  {
    name: "Bob Martinez",
    email: "bob@example.com",
    phones: [
      { type: "home",   number: "+1-555-0201" }
    ],
    address: { street: "7 Baker St", city: "London", country: "UK" },
    tags: ["family", "javascript"],
    createdAt: new Date("2024-02-10")
  },
  {
    name: "Carol Lee",
    email: "carol@example.com",
    phones: [
      { type: "mobile", number: "+1-555-0301" },
      { type: "home",   number: "+1-555-0302" }
    ],
    address: { street: "99 Main St", city: "Toronto", country: "Canada" },
    tags: ["friend", "designer"],
    createdAt: new Date("2024-03-05")
  },
  {
    name: "David Chen",
    email: "david@example.com",
    phones: [
      { type: "mobile", number: "+1-555-0401" }
    ],
    address: { street: "21 Orchard Rd", city: "Singapore", country: "Singapore" },
    tags: ["colleague", "javascript", "mongodb"],
    createdAt: new Date("2024-03-20")
  },
  {
    name: "Eva Patel",
    email: "eva@example.com",
    phones: [
      { type: "work",   number: "+1-555-0501" },
      { type: "mobile", number: "+1-555-0502" }
    ],
    address: { street: "5 MG Road", city: "Bangalore", country: "India" },
    tags: ["friend", "colleague", "python", "mongodb"],
    createdAt: new Date("2024-04-01")
  }
])
```

**Step 4 — Create indexes:**

```js
// Unique index on email to prevent duplicates
db.contacts.createIndex({ email: 1 }, { unique: true })

// Index on tags for fast tag-based lookups
db.contacts.createIndex({ tags: 1 })

// Compound index on address fields
db.contacts.createIndex({ "address.city": 1, "address.country": 1 })
```

---

### Tasks: Contact Book

**Task 1 — Find all contacts with a specific tag**

```js
// Find everyone tagged "friend"
db.contacts.find({ tags: "friend" })

// Find contacts with ALL of these tags (both must be present)
db.contacts.find({ tags: { $all: ["friend", "colleague"] } })

// Find contacts with ANY of these tags
db.contacts.find({ tags: { $in: ["python", "javascript"] } })
```

**Task 2 — Update a phone number**

```js
// Update the mobile phone number for alice@example.com
// $set on a nested array element using positional operator $
db.contacts.updateOne(
  { email: "alice@example.com", "phones.type": "mobile" },
  { $set: { "phones.$.number": "+1-555-9999" } }
)
```

**Task 3 — Add a new phone number to a contact**

```js
// Add a new "fax" phone entry to Bob's phones array
db.contacts.updateOne(
  { email: "bob@example.com" },
  { $push: { phones: { type: "fax", number: "+1-555-0210" } } }
)

// Verify it was added
db.contacts.findOne({ email: "bob@example.com" }, { phones: 1 })
```

**Task 4 — Remove a phone number from a contact**

```js
// Remove the "home" phone from Carol's phones array
db.contacts.updateOne(
  { email: "carol@example.com" },
  { $pull: { phones: { type: "home" } } }
)
```

**Task 5 — Add and remove tags**

```js
// Add a new tag to David (avoid duplicates with $addToSet)
db.contacts.updateOne(
  { email: "david@example.com" },
  { $addToSet: { tags: "architect" } }
)

// Remove a specific tag
db.contacts.updateOne(
  { email: "alice@example.com" },
  { $pull: { tags: "colleague" } }
)
```

**Task 6 — Update address fields**

```js
// Update only the city field inside the address sub-document
db.contacts.updateOne(
  { email: "bob@example.com" },
  { $set: { "address.city": "Manchester" } }
)

// Replace entire address sub-document
db.contacts.updateOne(
  { email: "carol@example.com" },
  { $set: { address: { street: "101 Queen St", city: "Melbourne", country: "Australia" } } }
)
```

**Task 7 — Find contacts by city or country**

```js
// Find all contacts in Australia
db.contacts.find({ "address.country": "Australia" })

// Find contacts in either Sydney or Singapore
db.contacts.find({ "address.city": { $in: ["Sydney", "Singapore"] } })

// Find contacts NOT in Australia
db.contacts.find({ "address.country": { $ne: "Australia" } })
```

**Task 8 — Count contacts per tag**

```js
// Aggregate to count how many contacts have each tag
db.contacts.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

Expected output:
```
{ _id: 'friend',    count: 3 }
{ _id: 'colleague', count: 3 }
{ _id: 'python',    count: 2 }
{ _id: 'mongodb',   count: 2 }
{ _id: 'javascript',count: 2 }
{ _id: 'designer',  count: 1 }
{ _id: 'family',    count: 1 }
```

**Task 9 — Find contacts with more than one phone number**

```js
// Use $size for exact count
db.contacts.find({ phones: { $size: 2 } })

// Use $expr + $gt for "more than N" (since $size doesn't support ranges)
db.contacts.find({
  $expr: { $gt: [ { $size: "$phones" }, 1 ] }
})
```

**Task 10 — Delete a contact and verify**

```js
// Delete a single contact by email
db.contacts.deleteOne({ email: "bob@example.com" })

// Verify deletion
const remaining = db.contacts.countDocuments()
console.log("Remaining contacts:", remaining)

// Delete all contacts from a specific country
db.contacts.deleteMany({ "address.country": "India" })
```

---

## Project 2: Movie Database

> **Analogy:** Like IMDb but in your terminal. Each movie document holds everything — the cast, director details, genres, and rating — all in one self-contained record. Range queries on rating and year let you filter and rank without complex SQL.

### What You Will Build

A searchable movie catalog that supports filtering by genre, rating, and year, full-text search on plot descriptions, and aggregations like top-rated films per genre.

---

### Schema Design: Movie Database

```
┌────────────────────────────────────────────────────────┐
│                   movies collection                    │
├────────────────────────────────────────────────────────┤
│  _id        : ObjectId                                 │
│  title      : String    (required)                     │
│  year       : Number    (1900-2100)                    │
│  genres     : Array of  String                         │
│  director   : Object    { name, nationality }          │
│  cast       : Array of  String                         │
│  rating     : Number    (0.0 - 10.0)                   │
│  runtime    : Number    (minutes)                      │
│  plot       : String    (full-text indexed)            │
└────────────────────────────────────────────────────────┘
```

**Full JSON Schema:**

```json
{
  "_id": "ObjectId('...')",
  "title": "Inception",
  "year": 2010,
  "genres": ["Action", "Sci-Fi", "Thriller"],
  "director": {
    "name": "Christopher Nolan",
    "nationality": "British-American"
  },
  "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
  "rating": 8.8,
  "runtime": 148,
  "plot": "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O."
}
```

---

### Setup: Movie Database

```js
use movieDB

db.movies.insertMany([
  {
    title: "Inception",
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    director: { name: "Christopher Nolan", nationality: "British-American" },
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
    rating: 8.8,
    runtime: 148,
    plot: "A thief steals corporate secrets through dream-sharing technology and must plant an idea in a CEO's mind."
  },
  {
    title: "The Dark Knight",
    year: 2008,
    genres: ["Action", "Crime", "Drama"],
    director: { name: "Christopher Nolan", nationality: "British-American" },
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
    rating: 9.0,
    runtime: 152,
    plot: "Batman faces the Joker, a criminal mastermind who plunges Gotham into anarchy."
  },
  {
    title: "Parasite",
    year: 2019,
    genres: ["Drama", "Thriller"],
    director: { name: "Bong Joon-ho", nationality: "South Korean" },
    cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"],
    rating: 8.5,
    runtime: 132,
    plot: "A poor family schemes to become employed by a wealthy family by infiltrating their household."
  },
  {
    title: "Interstellar",
    year: 2014,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    director: { name: "Christopher Nolan", nationality: "British-American" },
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
    rating: 8.6,
    runtime: 169,
    plot: "A team of explorers travel through a wormhole in space to ensure humanity's survival on a new planet."
  },
  {
    title: "Pulp Fiction",
    year: 1994,
    genres: ["Crime", "Drama"],
    director: { name: "Quentin Tarantino", nationality: "American" },
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson"],
    rating: 8.9,
    runtime: 154,
    plot: "The lives of two mob hitmen, a boxer, a gangster, and his wife intertwine in stories of violence and redemption."
  },
  {
    title: "Spirited Away",
    year: 2001,
    genres: ["Animation", "Adventure", "Family"],
    director: { name: "Hayao Miyazaki", nationality: "Japanese" },
    cast: ["Daveigh Chase", "Suzanne Pleshette"],
    rating: 8.6,
    runtime: 125,
    plot: "A sullen 10-year-old girl wanders into a world ruled by gods, spirits, and demons, and her parents are turned into pigs."
  },
  {
    title: "The Godfather",
    year: 1972,
    genres: ["Crime", "Drama"],
    director: { name: "Francis Ford Coppola", nationality: "American" },
    cast: ["Marlon Brando", "Al Pacino", "James Caan"],
    rating: 9.2,
    runtime: 175,
    plot: "The aging patriarch of an organized crime dynasty transfers control of his empire to his reluctant son."
  },
  {
    title: "Get Out",
    year: 2017,
    genres: ["Horror", "Mystery", "Thriller"],
    director: { name: "Jordan Peele", nationality: "American" },
    cast: ["Daniel Kaluuya", "Allison Williams", "Bradley Whitford"],
    rating: 7.7,
    runtime: 104,
    plot: "A Black man visits his white girlfriend's family estate and uncovers a disturbing secret about their community."
  }
])
```

**Create Indexes:**

```js
// Single-field indexes
db.movies.createIndex({ year: 1 })
db.movies.createIndex({ rating: -1 })
db.movies.createIndex({ "director.name": 1 })

// Multi-key index (MongoDB auto-detects arrays)
db.movies.createIndex({ genres: 1 })

// Full-text index on plot and title
db.movies.createIndex({ plot: "text", title: "text" })

// Compound for common query pattern: genre + rating
db.movies.createIndex({ genres: 1, rating: -1 })
```

---

### Tasks: Movie Database

**Task 1 — Find top-rated movies per genre**

```js
db.movies.aggregate([
  { $unwind: "$genres" },
  {
    $group: {
      _id: "$genres",
      topRated: { $max: "$rating" },
      topMovie: { $first: "$title" }   // NOTE: use $sort before $group for accuracy
    }
  },
  { $sort: { topRated: -1 } }
])

// More accurate approach: sort first, then group
db.movies.aggregate([
  { $sort: { rating: -1 } },
  { $unwind: "$genres" },
  {
    $group: {
      _id: "$genres",
      bestMovie: { $first: "$title" },
      bestRating: { $first: "$rating" }
    }
  },
  { $sort: { bestRating: -1 } }
])
```

**Task 2 — Find all movies by a specific director**

```js
// Exact match on nested field
db.movies.find(
  { "director.name": "Christopher Nolan" },
  { title: 1, year: 1, rating: 1, _id: 0 }
).sort({ year: 1 })
```

**Task 3 — Full-text search on plot**

```js
// $text requires a text index (created above)
db.movies.find(
  { $text: { $search: "dream technology" } },
  { score: { $meta: "textScore" }, title: 1 }
).sort({ score: { $meta: "textScore" } })

// Search for phrase (use quotes inside the string)
db.movies.find({ $text: { $search: '"dream-sharing"' } })

// Exclude a term
db.movies.find({ $text: { $search: "crime -violence" } })
```

**Task 4 — Find movies above a rating threshold in a specific year range**

```js
db.movies.find({
  rating: { $gte: 8.5 },
  year:   { $gte: 2000, $lte: 2020 }
}).sort({ rating: -1 })
```

**Task 5 — Find movies with multiple genres (must include both)**

```js
// Movie must have BOTH Sci-Fi AND Drama genres
db.movies.find({ genres: { $all: ["Sci-Fi", "Drama"] } })

// Movie has AT LEAST ONE of these genres
db.movies.find({ genres: { $in: ["Crime", "Horror"] } })
```

**Task 6 — Average rating by director nationality**

```js
db.movies.aggregate([
  {
    $group: {
      _id: "$director.nationality",
      avgRating: { $avg: "$rating" },
      movieCount: { $sum: 1 },
      movies: { $push: "$title" }
    }
  },
  { $sort: { avgRating: -1 } }
])
```

**Task 7 — Find the shortest and longest movies**

```js
// Shortest
db.movies.find().sort({ runtime: 1 }).limit(1)

// Longest
db.movies.find().sort({ runtime: -1 }).limit(1)

// All movies longer than 2.5 hours (150 minutes)
db.movies.find({ runtime: { $gt: 150 } }, { title: 1, runtime: 1 })
```

**Task 8 — Update a movie's cast (add an actor)**

```js
// Add an actor to the cast array (avoid duplicates)
db.movies.updateOne(
  { title: "Inception" },
  { $addToSet: { cast: "Tom Hardy" } }
)

// Replace entire cast array
db.movies.updateOne(
  { title: "Get Out" },
  { $set: { cast: ["Daniel Kaluuya", "Allison Williams", "Bradley Whitford", "Lil Rel Howery"] } }
)
```

**Task 9 — Count movies per decade**

```js
db.movies.aggregate([
  {
    $bucket: {
      groupBy: "$year",
      boundaries: [1970, 1980, 1990, 2000, 2010, 2020, 2030],
      default: "Other",
      output: {
        count: { $sum: 1 },
        avgRating: { $avg: "$rating" },
        titles: { $push: "$title" }
      }
    }
  }
])
```

**Task 10 — Find directors with more than one movie in the database**

```js
db.movies.aggregate([
  {
    $group: {
      _id: "$director.name",
      movieCount: { $sum: 1 },
      movies: { $push: "$title" },
      avgRating: { $avg: "$rating" }
    }
  },
  { $match: { movieCount: { $gt: 1 } } },
  { $sort: { movieCount: -1 } }
])
```

---

## Project 3: Simple Blog

> **Analogy:** A blog post is like a filing folder. The folder (post document) contains the article itself, and stapled to the back are all the sticky notes (comments) people have left. You never need to open a separate drawer to find the comments for a post.

### What You Will Build

A blog platform where posts have embedded comments. You will practice pushing to and pulling from nested arrays, full CRUD on posts, and querying by tags.

---

### Schema Design: Blog

```
┌────────────────────────────────────────────────────────┐
│                    posts collection                    │
├────────────────────────────────────────────────────────┤
│  _id         : ObjectId                                │
│  title       : String    (required)                    │
│  body        : String    (required)                    │
│  author      : String                                  │
│  tags        : Array of  String                        │
│  comments    : Array of  {                             │
│                  _id:    ObjectId,                     │
│                  user:   String,                       │
│                  text:   String,                       │
│                  date:   Date                          │
│                }                                       │
│  publishedAt : Date      (null = draft)                │
└────────────────────────────────────────────────────────┘
```

**Full Document Example:**

```json
{
  "_id": "ObjectId('...')",
  "title": "Getting Started with MongoDB",
  "body": "MongoDB is a document-oriented NoSQL database...",
  "author": "alice",
  "tags": ["mongodb", "tutorial", "nosql"],
  "comments": [
    {
      "_id": "ObjectId('...')",
      "user": "bob",
      "text": "Great intro, thanks!",
      "date": "ISODate('2024-05-01T10:00:00Z')"
    },
    {
      "_id": "ObjectId('...')",
      "user": "carol",
      "text": "Could you cover indexes next?",
      "date": "ISODate('2024-05-02T14:30:00Z')"
    }
  ],
  "publishedAt": "ISODate('2024-04-30T08:00:00Z')"
}
```

---

### Setup: Blog

```js
use simpleBlog

db.posts.insertMany([
  {
    title: "Getting Started with MongoDB",
    body: "MongoDB is a document-oriented NoSQL database that stores data in flexible JSON-like documents.",
    author: "alice",
    tags: ["mongodb", "tutorial", "nosql"],
    comments: [
      { _id: new ObjectId(), user: "bob",   text: "Great intro, thanks!",         date: new Date("2024-05-01") },
      { _id: new ObjectId(), user: "carol", text: "Could you cover indexes next?", date: new Date("2024-05-02") }
    ],
    publishedAt: new Date("2024-04-30")
  },
  {
    title: "Understanding Aggregation Pipelines",
    body: "The aggregation pipeline is a framework for data aggregation modeled on the concept of data processing pipelines.",
    author: "david",
    tags: ["mongodb", "aggregation", "advanced"],
    comments: [
      { _id: new ObjectId(), user: "alice", text: "Very clear explanation!",    date: new Date("2024-05-10") },
      { _id: new ObjectId(), user: "eva",   text: "The $group stage confused me.", date: new Date("2024-05-11") }
    ],
    publishedAt: new Date("2024-05-08")
  },
  {
    title: "SQL vs NoSQL: When to Use Each",
    body: "SQL databases are best for structured data with complex relationships, while NoSQL databases excel at flexibility and scale.",
    author: "eva",
    tags: ["sql", "nosql", "comparison", "tutorial"],
    comments: [],
    publishedAt: new Date("2024-05-15")
  },
  {
    title: "MongoDB Indexing Strategies",
    body: "Indexes support the efficient execution of queries in MongoDB. Without indexes, MongoDB must scan every document.",
    author: "alice",
    tags: ["mongodb", "indexes", "performance"],
    comments: [
      { _id: new ObjectId(), user: "david", text: "What about TTL indexes?", date: new Date("2024-05-20") }
    ],
    publishedAt: new Date("2024-05-18")
  },
  {
    title: "Draft: MongoDB Transactions",
    body: "This is a draft post about multi-document ACID transactions introduced in MongoDB 4.0.",
    author: "david",
    tags: ["mongodb", "transactions", "advanced"],
    comments: [],
    publishedAt: null   // null = draft
  }
])

// Indexes
db.posts.createIndex({ author: 1 })
db.posts.createIndex({ tags: 1 })
db.posts.createIndex({ publishedAt: -1 })
db.posts.createIndex({ title: "text", body: "text" })
```

---

### Tasks: Blog

**Task 1 — Get recent published posts (exclude drafts)**

```js
// Published = publishedAt is not null, sorted newest first
db.posts.find(
  { publishedAt: { $ne: null } },
  { title: 1, author: 1, publishedAt: 1, tags: 1 }
).sort({ publishedAt: -1 })

// With limit for pagination
db.posts.find({ publishedAt: { $ne: null } })
  .sort({ publishedAt: -1 })
  .limit(10)
  .skip(0)   // page 1; use skip(10) for page 2
```

**Task 2 — Find posts by tag**

```js
// Single tag
db.posts.find({ tags: "mongodb" })

// Multiple tags (must have ALL)
db.posts.find({ tags: { $all: ["mongodb", "tutorial"] } })

// Multiple tags (must have ANY)
db.posts.find({ tags: { $in: ["tutorial", "comparison"] } })
```

**Task 3 — Push a new comment onto a post**

```js
// Add a comment to "Getting Started with MongoDB"
db.posts.updateOne(
  { title: "Getting Started with MongoDB" },
  {
    $push: {
      comments: {
        _id: new ObjectId(),
        user: "newuser",
        text: "I really enjoyed this post, very helpful for beginners.",
        date: new Date()
      }
    }
  }
)
```

**Task 4 — Pull (remove) a comment by user**

```js
// Remove all comments by user "bob" from a specific post
db.posts.updateOne(
  { title: "Getting Started with MongoDB" },
  { $pull: { comments: { user: "bob" } } }
)

// Remove a specific comment by its _id
const commentId = ObjectId("...paste the ObjectId here...")
db.posts.updateOne(
  { title: "Getting Started with MongoDB" },
  { $pull: { comments: { _id: commentId } } }
)
```

**Task 5 — Update a post title and body**

```js
// Update specific fields
db.posts.updateOne(
  { title: "SQL vs NoSQL: When to Use Each" },
  {
    $set: {
      title: "SQL vs NoSQL: A Complete Comparison Guide",
      body:  "Updated body with more detailed comparison...",
    }
  }
)
```

**Task 6 — Publish a draft post**

```js
// Set publishedAt from null to now
db.posts.updateOne(
  { title: "Draft: MongoDB Transactions" },
  { $set: { publishedAt: new Date() } }
)
```

**Task 7 — Count comments per post**

```js
db.posts.aggregate([
  {
    $project: {
      title: 1,
      author: 1,
      commentCount: { $size: "$comments" }
    }
  },
  { $sort: { commentCount: -1 } }
])
```

**Task 8 — Find all posts by an author with comment count**

```js
db.posts.aggregate([
  { $match: { author: "alice" } },
  {
    $project: {
      title: 1,
      publishedAt: 1,
      commentCount: { $size: "$comments" },
      tags: 1
    }
  },
  { $sort: { publishedAt: -1 } }
])
```

**Task 9 — Find posts that have at least one comment**

```js
// Using $exists and array size
db.posts.find({ "comments.0": { $exists: true } })

// Using $expr with $size
db.posts.find({ $expr: { $gt: [{ $size: "$comments" }, 0] } })
```

**Task 10 — Delete a post and verify**

```js
// Delete the draft post
db.posts.deleteOne({ title: "Draft: MongoDB Transactions" })

// Verify with count
db.posts.countDocuments({ publishedAt: null })

// Delete all posts by a specific author
db.posts.deleteMany({ author: "eva" })
```

---

## Hands-On Exercises

These exercises combine skills from all three beginner projects. Complete them without looking at the solutions above.

1. **Contact Merge Tags:** Find all contacts who have BOTH "colleague" AND "python" tags. Then write an aggregation to find how many contacts are in each country.

2. **Movie Ranking Table:** Write an aggregation that returns each director's name, number of movies, and average rating, sorted by average rating descending. Only include directors with at least one movie rated above 8.0.

3. **Blog Comment Audit:** Write a query to find all posts where user "eva" has left a comment. Then write the update query to change her username from "eva" to "eva_patel" in all comments across all posts.

4. **Cross-Project Analytics:** In the movieDB, add a "viewCount" field to each movie (use $set with random numbers 1000-50000). Then write an aggregation that computes total views per genre.

5. **Schema Evolution:** The Contact Book needs a "birthday" field. Write the update to add `birthday: null` to all existing contacts that don't have it, then add it with a real date to three specific contacts.

---

## Interview Q&A

**Q1: What is a document in MongoDB?**
A: A document is a record in MongoDB stored as BSON (Binary JSON). It is analogous to a row in a relational table but can have nested objects and arrays, making it schema-flexible. Each document lives inside a collection.

**Q2: When should you embed documents versus reference them?**
A: Embed when data is always accessed together, the sub-document is owned by the parent (not shared), and the array size is bounded. Reference (use a separate collection with an ID) when data is shared between multiple parents, the sub-document is large or grows unboundedly, or you need to query the sub-documents independently.

**Q3: What does the `$push` operator do and how does it differ from `$addToSet`?**
A: `$push` appends a value to an array regardless of duplicates. `$addToSet` only appends if the value is not already present — it ensures array uniqueness. Use `$addToSet` for tags or categories where duplicates are meaningless.

**Q4: How does the positional operator `$` work in update queries?**
A: The `$` placeholder refers to the first element in an array that matched the query condition. For example, `{ "phones.type": "mobile" }` in the filter combined with `{ $set: { "phones.$.number": "..." } }` updates only the matched array element without knowing its index.

**Q5: What is a text index and when would you use it?**
A: A text index tokenizes string fields so MongoDB can perform stemming-based word matching. Use it for search-box functionality where users type natural language queries. Unlike a regular index, there can only be one text index per collection, but it can cover multiple fields.

**Q6: How does `$unwind` work in aggregation?**
A: `$unwind` deconstructs an array field by outputting one document per array element. If a document has `tags: ["a","b","c"]`, after `$unwind: "$tags"` you get three documents — one for each tag. This lets you `$group` by array values.

**Q7: What are multi-key indexes in MongoDB?**
A: When you create an index on a field that contains an array, MongoDB automatically creates a multi-key index — one index entry per array element. This is how `db.contacts.find({ tags: "friend" })` can use an index even though `tags` is an array.

**Q8: What is the difference between `deleteOne` and `deleteMany`?**
A: `deleteOne` removes the first document matching the filter. `deleteMany` removes all matching documents. Always be deliberate — `deleteMany({})` with an empty filter deletes the entire collection.

**Q9: What does `$set` do versus replacing the whole document?**
A: `$set` updates only the specified fields, leaving the rest of the document unchanged. Without `$set` in an update (i.e., passing a plain object as the update), MongoDB replaces the entire document except for `_id`. Always use `$set` for partial updates.

**Q10: How do you prevent duplicate emails in MongoDB?**
A: Create a unique index: `db.contacts.createIndex({ email: 1 }, { unique: true })`. This enforces uniqueness at the database level and throws a duplicate key error (code 11000) if you try to insert a document with an existing email.

**Q11: What is the aggregation pipeline and how does it differ from `find`?**
A: The aggregation pipeline is a sequence of stages (`$match`, `$group`, `$sort`, `$project`, etc.) where each stage transforms documents and passes them to the next. Unlike `find`, which only filters and projects, the pipeline can reshape, group, join, and compute entirely new documents.

**Q12: What is BSON and why does MongoDB use it instead of plain JSON?**
A: BSON (Binary JSON) extends JSON with additional types like `Date`, `ObjectId`, `Int32`, `Int64`, `Decimal128`, and `BinData`. MongoDB uses BSON because it is more type-rich than JSON, traversable efficiently (fields include length prefixes), and supports types that plain JSON lacks.

**Q13: How does MongoDB handle schema validation?**
A: MongoDB is schema-flexible by default but supports optional JSON Schema validation with `$jsonSchema` in the `validator` option of `db.createCollection()`. You can enforce required fields, data types, and value ranges, with a `validationAction` of `error` (reject) or `warn` (log only).

**Q14: What is an ObjectId and what information does it encode?**
A: An ObjectId is a 12-byte unique identifier: 4 bytes timestamp (Unix epoch seconds), 5 bytes random value (per process), and 3 bytes incrementing counter. This means ObjectIds are roughly time-sortable and guaranteed unique across processes without coordination.

**Q15: What is the difference between `find()` and `findOne()`?**
A: `find()` returns a cursor (lazy iterator) over all matching documents — nothing is fetched until you iterate. `findOne()` returns the first matching document directly (or null). Use `findOne()` when you expect exactly one result; use `find()` with `.limit()` for controlled result sets.
