# Module 2: Authentication, Tenant Context & Node.js API Gateway

| Specification | Details |
| :--- | :--- |
| **Module Number** | 02 of 12 |
| **Topic** | Multi-Tenant JWT Context, RBAC Middleware, PostgreSQL Session Variables & API Gateway |
| **Target System** | Node.js 22, Express, TypeScript, PostgreSQL 16 |
| **Engineering Level** | Staff Backend & Security Systems Engineer |

---

## 1. Architectural Overview & Context Propagation

The Node.js API Gateway is the security boundary of the TaskFlow platform. Every incoming request must be authenticated, resolved to a specific tenant context, and validated against the user's role before any database or AI operation is permitted.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              INCOMING CLIENT REQUEST                                   │
│                 Headers: { Authorization: "Bearer eyJhbGci...", Host: "..." }          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             API GATEWAY MIDDLEWARE CHAIN                               │
│                                                                                        │
│  [1. authenticateToken]                                                               │
│       ├── Validates JWT signature with RS256 / HS256                                   │
│       └── Decodes payload: { sub: "user_uuid", org_id: "org_uuid", role: "MEMBER" }    │
│                                                                                        │
│  [2. tenantContextMiddleware]                                                          │
│       ├── Injects req.tenantId = decoded.org_id                                        │
│       └── Acquires DB client & executes:                                               │
│           "SET LOCAL app.current_tenant_id = 'org_uuid';"                              │
│                                                                                        │
│  [3. requireRole(['ADMIN', 'OWNER'])]                                                  │
│       └── Asserts user role matches allowed permissions for the endpoint               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURED BUSINESS ROUTE                                    │
│             Database queries automatically scoped by Row-Level Security                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ADR: Authentication & Token Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               AUTHENTICATION SCHEMES & TOKEN FORMATS                              │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Pattern / Technology     │ Mechanism                   │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. Multi-Tenant JWT      │ Stateless Signed Token      │ 🏆 SELECTED (Contains org_id + role)     │
│ 2. Stateful Sessions     │ Redis Session ID Cookie     │ ❌ REJECTED (High distributed DB load)   │
│ 3. PASETO (Platform Asym)│ Encrypted PASETO Tokens     │ ❌ REJECTED (Limited ecosystem tooling)  │
│ 4. Basic Auth            │ Base64 Credentials per req  │ ❌ REJECTED (Insecure & un-revocable)    │
│ 5. Mutual TLS (mTLS)     │ Client Certificates         │ ❌ REJECTED (Unsuitable for web browsers)│
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

### **🏆 1. Multi-Tenant JWT (JSON Web Tokens) — SELECTED**
* **Why Selected:**
  * **Stateless Horizontal Scaling:** The Node.js gateway and the Python FastAPI AI service can independently verify tokens without querying a central session database on every single streaming packet or API call.
  * **Compact Tenant Context:** Embeds `userId`, `organizationId`, and `role` directly in the verified payload. This eliminates an extra database lookup to discover which tenant the user belongs to.
* **❌ Rejection Reasons for Alternatives:**
  * **Stateful Redis Sessions:** Requires an asynchronous Redis lookup on every token frame of an SSE stream, creating a major I/O bottleneck at 10,000 concurrent streaming users.
  * **PASETO:** While mathematically superior, library support across both TypeScript and Python FastAPI is fragmented compared to standard RFC 7519 JWT.
  * **Basic Auth:** Sends user credentials with every request; cannot encode transient tenant memberships or expiry timestamps safely.

---

## 3. Concrete Code Implementation

### 3.1 JWT Middleware & Tenant Propagation (`src/middleware/auth.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
      dbClient?: PoolClient;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secure-production-secret-key-32b';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Bearer token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'INVALID_TOKEN', message: 'Token expired or signature invalid' });
    }
    const payload = decoded as any;
    req.user = {
      userId: payload.sub,
      organizationId: payload.org_id,
      role: payload.role,
      email: payload.email,
    };
    req.tenantId = payload.org_id;
    next();
  });
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: `Role ${req.user.role} is insufficient for this action. Allowed: ${allowedRoles.join(', ')}` 
      });
    }
    next();
  };
};
```

### 3.2 Database Transaction & RLS Context Hook (`src/services/db.ts`)
```typescript
import { Pool, PoolClient } from 'pg';

export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Executes a callback within a tenant-isolated transaction where RLS is enforced.
 */
export async function withTenantTransaction<T>(
  tenantId: string, 
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    // Inject the tenant context into PostgreSQL session variable for Row-Level Security
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3.3 Auth Controller (`src/controllers/auth.controller.ts`)
```typescript
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbPool } from '../services/db';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secure-production-secret-key-32b';

export async function login(req: Request, res: Response) {
  const { email, password, organizationSlug } = req.body;

  if (!email || !password || !organizationSlug) {
    return res.status(400).json({ error: 'Missing required credentials or organization slug' });
  }

  try {
    const query = `
      SELECT u.id, u.email, u.password_hash, u.full_name, om.role, om.organization_id, o.name as org_name
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      JOIN organizations o ON o.id = om.organization_id
      WHERE u.email = $1 AND o.slug = $2
      LIMIT 1;
    `;
    const { rows } = await dbPool.query(query, [email.toLowerCase(), organizationSlug.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'User not found in organization' });
    }

    const user = rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Password mismatch' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        org_id: user.organization_id,
        role: user.role,
        org_name: user.org_name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.org_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
```

---

## 4. Multi-Tenant Verification & Security Test Cases

| Scenario | Test Execution | Expected Result |
| :--- | :--- | :--- |
| **Cross-Tenant Document Access** | User in Org A with valid token queries `GET /api/v1/tasks/:id` belonging to Org B | Returns `404 Not Found` (Postgres RLS blocks the row from view). |
| **Role Violation Mutation** | User with `VIEWER` role submits `POST /api/v1/tasks` | Returns `403 Forbidden` (`requireRole` blocks execution). |
| **Expired Token Handling** | Client presents expired JWT ($>8$ hours) | Returns `403 Invalid Token` and triggers client logout. |
| **Tampered Organization ID** | Malicious client alters `org_id` in JWT payload | Cryptographic signature validation fails; connection rejected with `403`. |
