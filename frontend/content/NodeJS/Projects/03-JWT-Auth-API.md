# Project 3 — JWT Auth API

**Level:** Intermediate
**Time estimate:** 75 – 100 minutes
**Phase prerequisite:** Phase 7 – Auth and Security

---

## Requirements

Build a full authentication API with Express, MongoDB, bcrypt, and JSON Web Tokens. You will implement:

- **Register** — create a user with a hashed password
- **Login** — verify credentials and issue a short-lived access token plus a long-lived refresh token
- **Protected route** — `/api/auth/me`, accessible only with a valid access token
- **Refresh** — exchange a valid refresh token for a new access token, without forcing the user to log in again
- **Logout** — invalidate the refresh token server-side

---

## Project Structure

```
03-jwt-auth-api/
├── package.json
├── .env
├── server.js
├── config/
│   └── db.js
├── models/
│   ├── User.js
│   └── RefreshToken.js
├── controllers/
│   └── authController.js
├── routes/
│   └── authRoutes.js
├── middleware/
│   ├── authMiddleware.js
│   └── errorHandler.js
└── utils/
    └── tokens.js
```

---

## Code

### `package.json`

```json
{
  "name": "jwt-auth-api",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.4.0"
  }
}
```

### `.env`

```bash
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/authdb
ACCESS_TOKEN_SECRET=replace-with-a-long-random-string-access
REFRESH_TOKEN_SECRET=replace-with-a-different-long-random-string-refresh
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
```

### `config/db.js`

```javascript
// config/db.js
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

### `models/User.js`

```javascript
// models/User.js — user schema with a pre-save password-hashing hook
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // never return the hash by default in queries
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Hash the password automatically whenever it's set/changed
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plaintext password against the stored hash
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

### `models/RefreshToken.js`

```javascript
// models/RefreshToken.js — persisted refresh tokens so they can be revoked (logout)
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
});

// MongoDB TTL index — automatically deletes expired token documents
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
```

### `utils/tokens.js`

```javascript
// utils/tokens.js — helpers to sign and verify access/refresh JWTs
const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}

// Convert a "15m" / "7d" style TTL string into a future Date for storage
function ttlToDate(ttl) {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const [, amount, unit] = match;
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + Number(amount) * multipliers[unit]);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ttlToDate,
};
```

### `middleware/authMiddleware.js`

```javascript
// middleware/authMiddleware.js — protects routes by requiring a valid access token
const { verifyAccessToken } = require('../utils/tokens');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // expected format: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired' });
    }
    return res.status(401).json({ error: 'Invalid access token' });
  }
}

module.exports = requireAuth;
```

### `middleware/errorHandler.js`

```javascript
// middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
```

### `controllers/authController.js`

```javascript
// controllers/authController.js — register, login, refresh, logout, me
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ttlToDate,
} = require('../utils/tokens');

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    const user = await User.create({ email, password, name });

    res.status(201).json({
      data: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // .select('+password') because the schema excludes it by default
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await RefreshToken.create({
      token: refreshToken,
      userId: user._id,
      expiresAt: ttlToDate(process.env.REFRESH_TOKEN_TTL),
    });

    res.status(200).json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, name: user.name },
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    // 1. Verify the JWT signature/expiry
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // 2. Confirm it hasn't been revoked (still exists in the store)
    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const newAccessToken = signAccessToken(user);
    res.status(200).json({ data: { accessToken: newAccessToken } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    await RefreshToken.deleteOne({ token: refreshToken });
    res.status(200).json({ data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me — protected route, requires requireAuth middleware
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ data: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me };
```

### `routes/authRoutes.js`

```javascript
// routes/authRoutes.js
const express = require('express');
const { register, login, refresh, logout, me } = require('../controllers/authController');
const requireAuth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
```

### `server.js`

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
});
```

---

## How to Run

```bash
docker run -d --name mongo -p 27017:27017 mongo:7   # if not already running

mkdir 03-jwt-auth-api && cd 03-jwt-auth-api
# create the folder structure and files above
npm install
npm run dev
```

Exercise the full flow with curl:

```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"supersecret1","name":"Jane Doe"}'

# Login — save the accessToken and refreshToken from the response
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"supersecret1"}'

# Access a protected route
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# Refresh an expired/expiring access token
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

# Logout — revokes the refresh token
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## Design Notes

- **Two tokens, two lifetimes, two secrets.** The access token is short-lived (15 minutes) and carries identity for API calls; the refresh token is long-lived (7 days) and used only to mint new access tokens. Using separate signing secrets means a leaked access-token secret can't be used to forge refresh tokens.
- **Refresh tokens are persisted in MongoDB**, not just trusted as a valid JWT signature. This is what makes `logout` and revocation possible — a stateless JWT alone cannot be invalidated before its expiry. The `RefreshToken` collection's TTL index (`expireAfterSeconds: 0` on `expiresAt`) lets MongoDB garbage-collect expired tokens automatically.
- **`select: false` on `User.password`** keeps the hash out of every default query result (e.g. `GET /me`); it must be explicitly requested with `.select('+password')`, which the login controller does deliberately.
- **Password hashing lives in a Mongoose `pre('save')` hook**, not in the controller, so it's impossible to accidentally save a user with a plaintext password no matter which code path creates or updates one.
- **`requireAuth` attaches `req.user`**, not the full Mongoose document — controllers that need more user data re-fetch it, keeping the middleware fast and decoupled from what any given route needs.

---

## Possible Extensions

1. **Refresh token rotation** — issue a brand-new refresh token on every `/refresh` call and invalidate the old one, limiting the blast radius of a stolen token.
2. **Rate limiting on `/login`** — add `express-rate-limit` to slow down brute-force password guessing.
3. **Role-based access control** — add a `role` field to `User` and an `requireRole('admin')` middleware.
4. **Email verification** — send a verification token on register and block login until the email is confirmed.
5. **Multiple sessions per user** — allow several active refresh tokens per user (one per device) and add a "log out of all devices" endpoint that deletes all of a user's tokens.
