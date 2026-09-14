# Project 2 — REST API with Express and MongoDB

**Level:** Beginner–Intermediate
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 5 – REST API Design, Phase 6 – Databases

---

## Requirements

Build a full CRUD REST API for a **Book** resource using Express and Mongoose, organized into the routes/controllers/models layers you'll use in every real Node backend. The API should:

- Support Create, Read (list + single), Update, and Delete operations on `/api/books`
- Validate incoming data with Mongoose schema validation
- Return consistent JSON error responses with correct HTTP status codes
- Separate concerns: routing, business logic, and data access live in different files

---

## Project Structure

```
02-rest-api-books/
├── package.json
├── .env
├── server.js
├── config/
│   └── db.js
├── models/
│   └── Book.js
├── controllers/
│   └── bookController.js
├── routes/
│   └── bookRoutes.js
└── middleware/
    └── errorHandler.js
```

---

## Code

### `package.json`

```json
{
  "name": "rest-api-books",
  "version": "1.0.0",
  "description": "CRUD REST API for a Book resource using Express and Mongoose",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.4.0"
  }
}
```

### `.env`

```bash
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/booksdb
```

### `config/db.js`

```javascript
// config/db.js — establishes the Mongoose connection to MongoDB
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
```

### `models/Book.js`

```javascript
// models/Book.js — Mongoose schema and model for a Book document
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
    },
    publishedYear: {
      type: Number,
      min: [1450, 'publishedYear must be after the invention of the printing press'],
      max: [new Date().getFullYear(), 'publishedYear cannot be in the future'],
    },
    genre: {
      type: String,
      enum: ['fiction', 'non-fiction', 'sci-fi', 'fantasy', 'biography', 'other'],
      default: 'other',
    },
    inStock: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

module.exports = mongoose.model('Book', bookSchema);
```

### `controllers/bookController.js`

```javascript
// controllers/bookController.js — business logic for Book CRUD operations
const Book = require('../models/Book');

// GET /api/books
async function getBooks(req, res, next) {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.status(200).json({ count: books.length, data: books });
  } catch (err) {
    next(err);
  }
}

// GET /api/books/:id
async function getBookById(req, res, next) {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: `Book with id ${req.params.id} not found` });
    }
    res.status(200).json({ data: book });
  } catch (err) {
    next(err);
  }
}

// POST /api/books
async function createBook(req, res, next) {
  try {
    const book = await Book.create(req.body);
    res.status(201).json({ data: book });
  } catch (err) {
    next(err);
  }
}

// PUT /api/books/:id
async function updateBook(req, res, next) {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // return the updated document
      runValidators: true, // re-run schema validation on update
    });
    if (!book) {
      return res.status(404).json({ error: `Book with id ${req.params.id} not found` });
    }
    res.status(200).json({ data: book });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/books/:id
async function deleteBook(req, res, next) {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).json({ error: `Book with id ${req.params.id} not found` });
    }
    res.status(200).json({ data: { message: 'Book deleted', id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBooks, getBookById, createBook, updateBook, deleteBook };
```

### `routes/bookRoutes.js`

```javascript
// routes/bookRoutes.js — maps HTTP verbs + paths to controller functions
const express = require('express');
const {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} = require('../controllers/bookController');

const router = express.Router();

router.route('/').get(getBooks).post(createBook);

router.route('/:id').get(getBookById).put(updateBook).delete(deleteBook);

module.exports = router;
```

### `middleware/errorHandler.js`

```javascript
// middleware/errorHandler.js — centralized error formatting for the whole app
function errorHandler(err, req, res, next) {
  console.error(err);

  // Mongoose validation error (schema `required`, `min`, `max`, `enum`, etc.)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  // Mongoose duplicate key error (e.g. unique isbn already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Duplicate value for field: ${field}` });
  }

  // Mongoose invalid ObjectId cast (e.g. malformed :id in the URL)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid id format: ${err.value}` });
  }

  // Fallback: unexpected server error
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
```

### `server.js`

```javascript
// server.js — application entry point
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Feature routes
app.use('/api/books', bookRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler — must be registered last
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
});
```

---

## How to Run

Prerequisite: a MongoDB instance running locally (or a connection string from Atlas). Local option via Docker:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

Then:

```bash
mkdir 02-rest-api-books && cd 02-rest-api-books
# create the folder structure and files above
npm install
npm run dev
```

Test the endpoints with curl:

```bash
# Create
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Clean Code","author":"Robert C. Martin","isbn":"9780132350884","publishedYear":2008,"genre":"non-fiction"}'

# List
curl http://localhost:3000/api/books

# Get one (replace :id with the _id returned above)
curl http://localhost:3000/api/books/<id>

# Update
curl -X PUT http://localhost:3000/api/books/<id> \
  -H "Content-Type: application/json" \
  -d '{"inStock": false}'

# Delete
curl -X DELETE http://localhost:3000/api/books/<id>
```

---

## Design Notes

- **Routes → Controllers → Models is a strict one-way dependency chain.** Routes know nothing about Mongoose; controllers know nothing about Express routing internals beyond `req`/`res`/`next`. This makes each layer independently testable and matches how most production Express codebases are organized.
- **`next(err)` funnels every error to one place.** Instead of duplicating try/catch error-formatting logic in every controller, each controller catches and forwards to `errorHandler`, which knows how to translate Mongoose-specific errors (`ValidationError`, duplicate key `11000`, `CastError`) into the right HTTP status codes.
- **`runValidators: true` on update** is easy to forget — by default Mongoose does **not** re-run schema validation on `findByIdAndUpdate`, which would let invalid data slip through on updates even though `create` enforces it.
- **`.env` + `dotenv`** keeps the Mongo connection string out of source code, following the same 12-factor pattern used in the Docker and Kubernetes courses' environment variable conventions.

---

## Possible Extensions

1. **Pagination** — add `?page=1&limit=10` query params to `getBooks` using `.skip()` and `.limit()`.
2. **Search/filter** — support `?genre=sci-fi&author=Asimov` query filtering.
3. **Request validation middleware** — add a library like `express-validator` or `zod` in front of the controllers for input validation independent of Mongoose.
4. **Soft deletes** — replace `findByIdAndDelete` with an `isDeleted` flag and filter it out of `find()` queries.
5. **Automated tests** — write integration tests with `supertest` and `mongodb-memory-server` (ties into Phase 9 – Testing).
