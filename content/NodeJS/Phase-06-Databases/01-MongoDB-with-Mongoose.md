# MongoDB with Mongoose — Complete Guide

> This lesson covers Node's integration layer for MongoDB. For document modeling theory, indexing, aggregation pipelines, and MongoDB internals, see `../../Databases/MongoDB/` in this repo.

## Table of Contents
1. [Why Mongoose](#1-why-mongoose)
2. [Connecting to MongoDB](#2-connecting-to-mongodb)
3. [Schemas and Models](#3-schemas-and-models)
4. [CRUD Operations](#4-crud-operations)
5. [Validation](#5-validation)
6. [Population (Refs)](#6-population-refs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Mongoose

MongoDB's native Node driver (`mongodb` package) gives you raw collections and documents — like using `pymongo` directly in Python. **Mongoose** is an ODM (Object-Document Mapper) layered on top — like Django ORM sits on top of raw SQL, or like `mongoengine` sits on top of `pymongo`.

```
Raw MongoDB driver:            Mongoose (ODM):
  db.collection('users')         const User = mongoose.model('User', userSchema)
    .insertOne({...})            await User.create({...})
  No schema enforcement          Schema-enforced structure
  No validation                  Built-in validation
  No middleware/hooks            pre/post hooks (save, remove, etc.)
  Manual type casting            Automatic type casting
```

| Tool | Analogy (Python) | Use when |
|------|-------------------|----------|
| `mongodb` (native driver) | `pymongo` | You want full control, no schema overhead |
| `mongoose` | `mongoengine` / Django ORM (for Mongo) | You want schemas, validation, hooks, relations |

Mongoose is the de-facto standard for MongoDB in Express apps — assume interviewers mean Mongoose when they say "MongoDB with Node."

---

## 2. Connecting to MongoDB

```bash
npm install mongoose
```

```javascript
// db.js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ sets sane defaults automatically (no more
      // useNewUrlParser / useUnifiedTopology flags needed)
    });
    console.log('MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // fail fast — don't serve traffic without a DB
  }
}

module.exports = connectDB;
```

```javascript
// server.js
const express = require('express');
const connectDB = require('./db');

const app = express();
app.use(express.json());

connectDB().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});
```

### Connection Events

```javascript
mongoose.connection.on('connected', () => console.log('Mongoose connected'));
mongoose.connection.on('error', (err) => console.error('Mongoose error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
```

`process.env.MONGO_URI` comes from environment config — covered in `03-Connection-Pooling-and-Environment-Config.md`.

---

## 3. Schemas and Models

A **Schema** defines the shape of documents in a collection (like a Pydantic model or Django model class). A **Model** is a compiled constructor built from a schema — you use the model to query/create documents.

```javascript
// models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    age: { type: Number, min: 0, max: 120 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }], // relation (see §6)
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
  }
);

// Instance method — available on every document
userSchema.methods.isAdmin = function () {
  return this.role === 'admin';
};

// Static method — available on the model itself
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

const User = mongoose.model('User', userSchema);
module.exports = User;
```

```
Schema  →  compiled into  →  Model  →  produces  →  Documents
(blueprint)                (constructor)          (actual records)
```

### Common Schema Types

| Type | Example |
|------|---------|
| `String` | `{ type: String }` |
| `Number` | `{ type: Number }` |
| `Boolean` | `{ type: Boolean }` |
| `Date` | `{ type: Date, default: Date.now }` |
| `ObjectId` | `{ type: Schema.Types.ObjectId, ref: 'ModelName' }` |
| `Array` | `[String]`, `[{ type: Schema.Types.ObjectId, ref: 'Post' }]` |
| `Mixed` | `Schema.Types.Mixed` (any shape — use sparingly) |

---

## 4. CRUD Operations

```javascript
const User = require('./models/User');

// CREATE
const user = await User.create({ name: 'Asha', email: 'asha@example.com', age: 29 });
// or: const user = new User({...}); await user.save();

// READ
const all = await User.find();                          // all documents
const one = await User.findById(userId);                 // by _id
const filtered = await User.find({ role: 'admin' });      // by filter
const first = await User.findOne({ email: 'asha@example.com' });

// UPDATE
await User.findByIdAndUpdate(
  userId,
  { age: 30 },
  { new: true, runValidators: true } // return updated doc, re-run validation
);
await User.updateMany({ role: 'user' }, { $set: { verified: true } });

// DELETE
await User.findByIdAndDelete(userId);
await User.deleteMany({ role: 'guest' });
```

### Example: Express route using Mongoose CRUD

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
```

| Mongoose Method | SQL/ORM Equivalent (mental model) |
|------------------|-------------------------------------|
| `Model.create()` | `INSERT` |
| `Model.find()` | `SELECT * WHERE ...` |
| `Model.findByIdAndUpdate()` | `UPDATE ... WHERE id = ?` |
| `Model.findByIdAndDelete()` | `DELETE ... WHERE id = ?` |

---

## 5. Validation

Mongoose validates at the **schema level**, before a document is saved — similar to Pydantic validators or Django model `clean()`.

```javascript
const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    minlength: [3, 'Name must be at least 3 characters'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  category: {
    type: String,
    enum: {
      values: ['electronics', 'clothing', 'food'],
      message: '{VALUE} is not a supported category',
    },
  },
  sku: {
    type: String,
    validate: {
      validator: (v) => /^[A-Z]{3}-\d{4}$/.test(v), // custom validator
      message: (props) => `${props.value} is not a valid SKU format`,
    },
  },
});
```

```javascript
try {
  await Product.create({ name: 'AB', price: -5 });
} catch (err) {
  // err.name === 'ValidationError'
  // err.errors.name.message, err.errors.price.message
  console.log(err.errors);
}
```

**Important:** `findByIdAndUpdate`/`findOneAndUpdate` do **not** run validators by default — you must opt in with `{ runValidators: true }`. This trips up almost everyone coming from an ORM where updates are always validated.

---

## 6. Population (Refs)

MongoDB has no joins — Mongoose's `populate()` simulates a join client-side by doing a second query and substituting `ObjectId` references with actual documents.

```javascript
// models/Post.js
const postSchema = new Schema({
  title: String,
  content: String,
  author: { type: Schema.Types.ObjectId, ref: 'User' }, // reference
});
const Post = mongoose.model('Post', postSchema);
```

```javascript
// Without populate — author is just an ObjectId
const post = await Post.findById(postId);
console.log(post.author); // 507f1f77bcf86cd799439011

// With populate — author is replaced with the full User document
const populatedPost = await Post.findById(postId).populate('author');
console.log(populatedPost.author.name); // "Asha"

// Populate specific fields only
await Post.findById(postId).populate('author', 'name email');

// Populate a two-way relation (User has posts: [ObjectId])
await User.findById(userId).populate('posts');

// Nested populate
await Post.findById(postId).populate({
  path: 'author',
  populate: { path: 'company' },
});
```

```
Post document:                     After .populate('author'):
{                                   {
  title: "Hello",                    title: "Hello",
  author: ObjectId("507f...")        author: { _id: ..., name: "Asha", email: "..." }
}                                   }
```

`populate()` is convenient but issues an extra query — for deep relational needs at scale, consider whether a SQL database (Phase `02-SQL-with-an-ORM-Prisma.md`) is a better fit.

---

## 7. Hands-On Exercises

**Exercise 1:** Set up a free MongoDB Atlas cluster (or run `mongod` locally), connect to it with Mongoose from a small script, and log `mongoose.connection.readyState`.

**Exercise 2:** Define a `Book` schema with `title` (required), `author` (required), `isbn` (unique), `publishedYear` (Number, min 1450), and `genre` (enum of 3 values). Create three books and log validation errors when you intentionally violate a constraint.

**Exercise 3:** Build Express routes for full CRUD on `Book` (`POST /books`, `GET /books`, `GET /books/:id`, `PUT /books/:id`, `DELETE /books/:id`).

**Exercise 4:** Add a `Review` schema with a `book` ref to `Book`. Write a route that returns a book with all its reviews populated.

**Exercise 5:** Add a custom validator to `Review.rating` that only accepts integers 1-5, and a pre-save hook that lowercases the reviewer's email.

---

## 8. Interview Q&A

**Q: What is Mongoose and why use it over the native MongoDB driver?**
Answer: Mongoose is an ODM (Object-Document Mapper) for MongoDB in Node. The native driver gives raw, schema-less collection access (like `pymongo`). Mongoose adds schema definition, built-in and custom validation, type casting, middleware/hooks (pre/post save), and relation-like behavior via `populate()` — the same value an ORM adds over raw SQL.

**Q: What's the difference between a Mongoose Schema and a Model?**
Answer: A Schema is the blueprint — it defines field types, validation rules, and defaults. A Model is a compiled constructor built from a schema via `mongoose.model('Name', schema)` — it's what you actually use to query, create, update, and delete documents in the corresponding collection.

**Q: Why doesn't `findByIdAndUpdate` run schema validators by default, and how do you fix it?**
Answer: Mongoose's update operations bypass the full document validation pipeline for performance/backward-compatibility reasons, since updates can be partial. You must explicitly pass `{ runValidators: true }` (often paired with `{ new: true }` to get the updated document back) to enforce schema rules on updates.

**Q: What does `populate()` do, and why doesn't MongoDB do this automatically like a SQL join?**
Answer: MongoDB is a document database with no native join operator. `populate()` is a Mongoose feature that performs a second query behind the scenes, replacing stored `ObjectId` references with the actual referenced documents, simulating a join at the application layer. It's convenient but costs an extra round trip and doesn't scale as well as a true SQL join for deeply relational data.

**Q: How would you model a one-to-many relationship in Mongoose — embedding or referencing?**
Answer: Embed when the child data is small, bounded, and always accessed with the parent (e.g., an address inside a user). Reference (via `ObjectId` + `populate`) when the child collection is large, grows unbounded, or needs to be queried independently (e.g., a user's thousands of orders). This embedding-vs-referencing tradeoff is core MongoDB schema design — see `../../Databases/MongoDB/` for the full treatment.

**Q: What happens if you call `.save()` on a document that fails validation?**
Answer: Mongoose throws a `ValidationError` (or rejects the returned promise) before any write reaches MongoDB — the document is never persisted. The error object's `.errors` property is a map of field name to validator failure, letting you return structured 400 responses to the client.
