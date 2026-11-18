import { QuickReferenceTopic } from './types';

export const expressCategory6RestApi: QuickReferenceTopic[] = [
  {
    id: 'express-pagination-filtering-sorting',
    number: 20,
    title: 'Pagination, Filtering and Sorting',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'REST API Development',
    categorySlug: 'express-rest-api',
    estimatedMinutes: 5,
    concept30Sec:
      'Pagination, filtering, and sorting are essential REST design patterns for retrieving large datasets efficiently. Pagination divides records into digestible chunks, filtering restricts results to specific criteria, and sorting orders entities predictably. Production APIs choose between Offset-based and Cursor-based pagination depending on dataset scale.',
    internals: {
      overview:
        'Offset pagination calculates offset = (page - 1) * limit. In SQL, OFFSET 100000 LIMIT 20 forces the database to read 100,020 rows from disk, sort them in memory, and discard the first 100,000, causing severe performance degradation ($O(N)$). Cursor-based (Keyset) pagination avoids OFFSET by filtering directly on an indexed column (e.g., WHERE id > :lastSeenId ORDER BY id ASC LIMIT 20). Because it seeks directly via the B-Tree index ($O(1)$), cursor pagination remains blazing fast on tables with millions of rows.',
      flowSteps: [
        '1. Query Parsing: Extract and validate page, limit, sort, and filters from req.query.',
        '2. Sanitization: Coerce string query parameters into safe typed primitives (e.g. limit capped at 100).',
        '3. Offset Calculation (Offset Mode): skip = (page - 1) * limit; parallel count query for totalPages.',
        '4. Keyset Seek (Cursor Mode): WHERE id > cursor ORDER BY id ASC LIMIT limit + 1.',
        '5. Database Execution: Queries executed in PostgreSQL or MongoDB using indexed fields.',
        '6. Response Envelope: Wraps data in a standardized envelope with pagination metadata and nextCursor.'
      ],
      diagram: `OFFSET VS CURSOR PAGINATION AT 1,000,000 ROWS:

Offset Pagination (OFFSET 500,000 LIMIT 20):
  Disk Read: [ Reads 500,020 rows ] -> [ Discards 500,000 ] -> [ Returns 20 ]
  Time Complexity: O(N) -> VERY SLOW on deep pages!
  Data Shift Flaw: New insertions shift items, causing duplicates or skipped rows.

Cursor-Based Pagination (WHERE id > "uuid_last_seen" LIMIT 20):
  Index Seek: [ Directly jumps to "uuid_last_seen" via B-Tree index ] -> [ Returns 20 ]
  Time Complexity: O(1) -> INSTANTANEOUS regardless of table depth!
  Immune to data shifting from concurrent writes.`
    },
    codeExample: {
      code: `import express from 'express';
import { z } from 'zod';

const app = express();

// 1. Zod Schema enforcing strict query validation
const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['price_asc', 'price_desc', 'created_desc']).default('created_desc'),
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional()
});

// 2. Production GET /products endpoint
app.get('/api/products', async (req, res, next) => {
  try {
    const query = ProductQuerySchema.parse(req.query);
    const { page, limit, sort, category, minPrice, maxPrice } = query;

    // Build database WHERE clauses safely
    const whereConditions: any = {};
    if (category) whereConditions.category = category;
    if (minPrice || maxPrice) {
      whereConditions.price = {};
      if (minPrice) whereConditions.price.$gte = minPrice;
      if (maxPrice) whereConditions.price.$lte = maxPrice;
    }

    // Determine database sorting field & direction
    const sortMap: Record<string, any> = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      created_desc: { createdAt: -1 }
    };
    const sortOrder = sortMap[sort];

    // Offset pagination execution
    const skip = (page - 1) * limit;

    // Simulated DB queries (e.g. Prisma or Mongoose):
    // const [items, totalCount] = await Promise.all([
    //   db.product.findMany({ where: whereConditions, skip, take: limit, orderBy: sortOrder }),
    //   db.product.count({ where: whereConditions })
    // ]);
    const totalCount = 142;
    const items = [{ id: 1, name: 'Mechanical Keyboard', price: 120, category: 'electronics' }];

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    next(err);
  }
});`,
      language: 'javascript',
      output: `GET /api/products?page=2&limit=1&sort=price_desc&category=electronics HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "data": [
    { "id": 1, "name": "Mechanical Keyboard", "price": 120, "category": "electronics" }
  ],
  "pagination": {
    "page": 2,
    "limit": 1,
    "totalItems": 142,
    "totalPages": 142,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}`,
      whyOutput:
        'The route parses and validates the query params with Zod, applies the category and price filters, calculates the offset, and returns the paginated data envelope with totalItems and hasNextPage navigation metadata.'
    },
    nodeJsApplication: {
      scenario: 'High-Volume Infinite Scroll with Cursor Pagination',
      description:
        'Social media feeds (Twitter, Instagram) and high-frequency audit logs cannot use offset pagination because new posts cause items to shift between pages, showing users duplicate items. Cursor pagination using an opaque Base64-encoded cursor guarantees zero duplicates and $O(1)$ query speed.',
      codeSnippet: `// Cursor Keyset query in Prisma:
const items = await prisma.post.findMany({
  take: limit + 1, // Fetch 1 extra to check if next page exists
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0, // Skip the cursor item itself
  orderBy: { id: 'desc' }
});

const hasNextPage = items.length > limit;
const pageData = hasNextPage ? items.slice(0, -1) : items;
const nextCursor = hasNextPage ? pageData[pageData.length - 1].id : null;`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Offset pagination and Cursor pagination, and when should you use each?',
          spokenAnswer:
            'Offset pagination uses page and limit numbers ((page - 1) * limit). It is simple to implement and allows users to jump directly to arbitrary page numbers (e.g. "Page 5"), making it ideal for standard admin dashboards with small-to-medium datasets. However, it suffers from two major flaws on large tables: 1) Performance degrades to O(N) because the database must scan and discard all preceding offset rows; and 2) Data shifting: inserting a row shifts all subsequent pages, causing users to see duplicate items. Cursor pagination uses an indexed unique marker (like an ID or timestamp) to seek directly to the next set of rows via B-Tree index in O(1) time. It is immune to data shifting and scales to billions of rows, making it the industry standard for infinite scrolling and public developer APIs (like Stripe and GitHub).'
        },
        {
          question: 'Why should you cap the maximum limit parameter on paginated endpoints?',
          spokenAnswer:
            'If an API does not enforce a maximum limit (e.g. limit: z.coerce.number().max(100)), a malicious or naive client can request ?limit=1000000. The database will attempt to fetch one million records into memory, serializing a multi-hundred-megabyte JSON payload that saturates server bandwidth and crashes the Node.js V8 process with an Out Of Memory heap exhaustion error.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you implement multi-column cursor pagination when sorting by a non-unique field like "createdAt"?',
        answer:
          'If sorting by a non-unique column like createdAt, multiple rows may share the exact same timestamp. You must use a tie-breaker cursor pairing the column with a unique ID: WHERE (created_at, id) < (:cursorCreatedAt, :cursorId) ORDER BY created_at DESC, id DESC. This guarantees deterministic cursor progression without skipping rows.'
      },
      commonMistakes: [
        'Not setting a maximum limit cap, allowing clients to request 1,000,000 records and crash the Node.js heap.',
        'Using offset pagination on tables with 10 million rows, causing 10-second query timeouts.',
        'Running COUNT(*) on every paginated request without caching: on multi-million row tables, COUNT(*) is often slower than the data query itself.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Offset pagination is O(N) and vulnerable to duplicate items; Cursor pagination is O(1) and stable.',
        'Always cap the limit parameter (e.g. max 100) to protect V8 heap memory.',
        'For infinite scroll or real-time feeds, always use cursor-based pagination.'
      ],
      oneLineDefinition:
        'Pagination, filtering, and sorting structure query endpoints to retrieve bounded, ordered subsets of data without exhausting database or memory capacity.',
      interviewTip:
        'Explain why OFFSET 100000 forces the database engine to scan 100,000 rows before discarding them.',
      keyDistinction:
        'Offset vs Cursor: Offset jumps by row count (O(N)); Cursor seeks directly by indexed value (O(1)).'
    }
  },
  {
    id: 'express-api-versioning',
    number: 21,
    title: 'API Versioning',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'REST API Development',
    categorySlug: 'express-rest-api',
    estimatedMinutes: 5,
    concept30Sec:
      'API versioning is the architectural practice of managing changes to an API over time without breaking existing client integrations. Versioning is required whenever a breaking change (such as renaming fields, removing endpoints, or altering response structures) is introduced.',
    internals: {
      overview:
        'There are three primary versioning strategies: 1) URI Path Versioning (/api/v1/orders) - the most popular, explicit, and cache-friendly approach; 2) Header Versioning (Accept: application/vnd.company.v1+json or X-API-Version: 1) - keeps URIs clean but makes browser testing and caching harder; 3) Query Parameter Versioning (/api/orders?v=1) - easy for ad-hoc testing but less common in REST standards. Express supports URI path versioning natively by mounting routers on versioned prefix paths.',
      flowSteps: [
        '1. Breaking Change Identified: A field is renamed or structure altered (e.g. user.name -> user.firstName + user.lastName).',
        '2. Sub-Router Creation: Maintain v1Router for legacy clients; create v2Router for updated contract.',
        '3. Path Mounting: app.use("/api/v1", v1Router); app.use("/api/v2", v2Router);.',
        '4. Shared Business Core: Both v1 and v2 controllers call the SAME underlying UserService, but map results to version-specific DTOs.',
        '5. Deprecation Notice: v1 routes attach standard HTTP headers: Deprecation: @<timestamp> and Sunset: <date>.',
        '6. Sunset / Decommission: On sunset date, v1 routes are deactivated, returning 410 Gone.'
      ],
      diagram: `API VERSIONING & SHARED DOMAIN CORE:

  Legacy Mobile App                         Modern Web App
         | (Calls /api/v1/users)                   | (Calls /api/v2/users)
         v                                         v
+-------------------------------+         +-------------------------------+
| v1 UserController             |         | v2 UserController             |
| Returns: { name: "Alex Fox" } |         | Returns: { first, last }      |
+-------------------------------+         +-------------------------------+
         |                                         |
         +--------------------+--------------------+
                              | (Calls the same core!)
                              v
             +---------------------------------+
             | Core Domain UserService         |
             | - Single source of domain logic |
             +---------------------------------+`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// 1. Version 1 Router (Legacy Contract)
const v1Router = express.Router();
v1Router.use((req, res, next) => {
  // Inform clients that v1 is deprecated and will sunset
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '<https://api.docs.com/v2-migration>; rel="sunset"');
  next();
});

v1Router.get('/users/:id', (req, res) => {
  // Legacy payload format: single 'name' string
  res.json({
    id: req.params.id,
    name: 'Alex Rivera'
  });
});

// 2. Version 2 Router (Modern Contract)
const v2Router = express.Router();
v2Router.get('/users/:id', (req, res) => {
  // Modern payload format: split firstName and lastName
  res.json({
    id: req.params.id,
    firstName: 'Alex',
    lastName: 'Rivera',
    version: '2.0'
  });
});

// 3. Mount versioned routes on dedicated namespaces
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);`,
      language: 'javascript',
      output: `GET /api/v1/users/42 HTTP/1.1

HTTP/1.1 200 OK
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Content-Type: application/json; charset=utf-8

{ "id": "42", "name": "Alex Rivera" }

-----------------------------------------
GET /api/v2/users/42 HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{ "id": "42", "firstName": "Alex", "lastName": "Rivera", "version": "2.0" }`,
      whyOutput:
        'Clients calling /api/v1 receive the legacy data shape along with RFC-standard Deprecation and Sunset headers. Modern clients calling /api/v2 receive the upgraded schema without breaking legacy consumers.'
    },
    nodeJsApplication: {
      scenario: 'Stripe-Style Date-Based Header Versioning',
      description:
        'Stripe uses date-based versioning via headers (Stripe-Version: 2024-06-20). Rather than duplicating routers, a single router executes, and a pipeline of version transformation functions (event transformations) rolls the payload back to match the requested version date.',
      codeSnippet: `// Stripe-style version decorator middleware
app.use((req, res, next) => {
  const requestedVersion = req.headers['api-version'] || '2026-11-01';
  req.apiVersion = requestedVersion;
  next();
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What constitutes a "Breaking Change" versus a "Non-Breaking Change" in REST APIs?',
          spokenAnswer:
            'A Non-Breaking Change does not disrupt existing client integrations—such as adding a new optional request field, adding a brand new endpoint, or adding a new field to an existing JSON response (provided clients follow the Postel robust parsing principle). A Breaking Change breaks existing clients—such as renaming an existing field, changing a data type (e.g. number to string), removing an endpoint or field, or making an optional parameter mandatory. Breaking changes strictly mandate a new API version.'
        },
        {
          question: 'What are the pros and cons of URI Path Versioning versus Custom Header Versioning?',
          spokenAnswer:
            'URI Path Versioning (/api/v1/resource) is the most popular strategy because it is completely explicit, visible in access logs, trivial to route in reverse proxies, and easily tested directly in a browser. However, it violates strict REST purity (which argues URIs identify resources, not representations). Header Versioning (Accept: application/vnd.app.v1+json) keeps URIs clean and permanent, but it is much harder to test in browsers, complicates proxy caching, and requires clients to configure custom request headers.'
        }
      ],
      trickyFollowUp: {
        question: 'What HTTP status code should be returned when an old API version is permanently shut down?',
        answer:
          'Return HTTP 410 Gone! HTTP 410 explicitly informs clients that the requested resource once existed at this URI but has been intentionally and permanently removed, and clients should not retry. Pair it with a Sunset header and a documentation migration link.'
      },
      commonMistakes: [
        'Duplicating entire services and database models for each new API version instead of just versioning controllers and DTO mappers.',
        'Bumping major API versions for non-breaking changes (like adding a new field).',
        'Decommissioning older API versions without standard Deprecation and Sunset HTTP headers.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Only bump API versions for Breaking Changes (renaming fields, removing endpoints).',
        'URI Path versioning (/api/v1) is the industry standard for clarity and proxy routing.',
        'Attach Deprecation and Sunset headers to give clients advance warning before decommission.'
      ],
      oneLineDefinition:
        'API versioning preserves backwards compatibility for existing integrations while enabling continuous evolution of backend services.',
      interviewTip:
        'Emphasize that only Controllers and DTO mappers should be versioned—the underlying domain Services should remain unified.',
      keyDistinction:
        'URI Versioning vs Header Versioning: URI is explicit and cache-friendly; Header keeps URIs clean but complicates caching and testing.'
    }
  }
];
