import { QuickReferenceTopic, ComparisonTable } from './types';

const JOI_VS_ZOD_COMPARISON_TABLE: ComparisonTable = {
  headers: ['Feature', 'Zod', 'Joi', 'Senior Recommendation'],
  rows: [
    [
      'TypeScript Type Inference',
      'Native: z.infer<typeof Schema> generates TS types automatically',
      'Requires separate joi-to-typescript or manual type duplication',
      'Zod is the modern standard for TS codebases'
    ],
    [
      'Bundle Size & Platform',
      'Zero dependencies, lightweight (~12kb gzip), works in Node & Browser',
      'Heavy (~140kb), Node-centric historical design',
      'Zod enables sharing schemas between Frontend and Backend'
    ],
    [
      'Schema Syntax',
      'Composable functional syntax (z.object({ name: z.string() }))',
      'Fluent chaining (Joi.object({ name: Joi.string().required() }))',
      'Both are readable; Zod feels more modern and idiomatic'
    ],
    [
      'Type Coercion',
      'Explicit via z.coerce.number() / z.coerce.date()',
      'Implicit type casting by default (can cause subtle bugs)',
      'Zod explicit coercion prevents unexpected string-to-number bugs'
    ],
    [
      'Ecosystem Integration',
      'Standard across tRPC, React Hook Form, Next.js, and Prisma',
      'Legacy standard in older Express / Hapi ecosystems',
      'Choose Zod for all new projects; maintain Joi in legacy code'
    ]
  ]
};

export const expressCategory4ValidationFiles: QuickReferenceTopic[] = [
  {
    id: 'express-request-validation-joi-zod',
    number: 14,
    title: 'Request Validation (Joi and Zod)',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Validation and File Handling',
    categorySlug: 'express-validation-files',
    estimatedMinutes: 5,
    concept30Sec:
      'Request validation enforces strict schema constraints on incoming HTTP payloads—including req.body, req.query, and req.params—before controllers execute. Validating at the middleware perimeter prevents SQL/NoSQL injection, prototype pollution, malformed types, and unhandled runtime crashes.',
    internals: {
      overview:
        'A generic validation middleware accepts a schema configuration for body, query, and params. When a request arrives, it runs schema.safeParse() (in Zod) or schema.validate() (in Joi). If validation fails, it aborts the request immediately with HTTP 400 Bad Request and a structured list of field-level errors, shielding downstream controllers. If validation succeeds, it replaces req.body/query/params with the sanitized, coerced, and stripped output.',
      flowSteps: [
        '1. Request Arrival: Raw request enters validation middleware before controller.',
        '2. Target Selection: Middleware validates req.body, req.query, and req.params against corresponding schemas.',
        '3. Safe Parsing: Executes schema validation without throwing unhandled exceptions.',
        '4. Failure Path: If errors exist, maps issues into a clean JSON error response ({ field, message }) and returns HTTP 400.',
        '5. Data Sanitization: Strips unknown or malicious properties and coerces types (e.g. string "42" -> number 42).',
        '6. Success Path: Overwrites req.body/query with validated data and invokes next().'
      ],
      diagram: `PERIMETER REQUEST VALIDATION PIPELINE:

  HTTP Request: POST /api/v1/products?limit=abc
  Payload: { "title": "", "price": -50, "hackerProp": "exploit" }
                        |
                        v
  +-------------------------------------------------------+
  | Validation Middleware: validate({ body, query })      |
  |   - Zod / Joi Schema Evaluation                       |
  +-------------------------------------------------------+
        |                                       |
        | (Validation Fails)                    | (Validation Passes)
        v                                       v
  HTTP 400 Bad Request                    Sanitized & Coerced:
  {                                       req.query.limit = 10 (coerced)
    "errors": [                           req.body = { title, price }
      { "field": "price",                 (hackerProp stripped!)
        "message": "Must be > 0" },             |
      { "field": "title",                       v
        "message": "Required" }           [ Controller Executes Safely ]
    ]
  }`
    },
    codeExample: {
      code: `import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// 1. Define Zod Schemas for Body & Query
const RegisterSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    age: z.coerce.number().int().min(18, 'Must be at least 18 years old')
  }),
  query: z.object({
    referralCode: z.string().optional()
  })
});

// 2. Reusable Generic Validation Middleware Factory
const validate = (schema: z.ZodObject<any>) => {
  return async (req: any, res: any, next: any) => {
    const result = await schema.safeParseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.slice(1).join('.'), // e.g. "body.email" -> "email"
        message: issue.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formattedErrors
      });
    }

    // Replace with validated, sanitized, and coerced data
    req.body = result.data.body || req.body;
    req.query = result.data.query || req.query;
    next();
  };
};

app.post('/api/register', validate(RegisterSchema), (req, res) => {
  // Guaranteed type-safe, validated, and sanitized!
  res.status(201).json({ message: 'User registered', user: req.body });
});`,
      language: 'javascript',
      output: `POST /api/register HTTP/1.1
Content-Type: application/json

{ "email": "not-an-email", "password": "123", "age": "15" }

HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email address format" },
    { "field": "password", "message": "Password must be at least 8 characters" },
    { "field": "age", "message": "Must be at least 18 years old" }
  ]
}`,
      whyOutput:
        'The validate middleware intercepts the payload before the controller runs. It identifies invalid email format, short password, and under-age constraint. It halts the pipeline and sends an actionable 400 response containing all field-level issues.'
    },
    nodeJsApplication: {
      scenario: 'End-to-End TypeScript Invariance across Fullstack Monorepos',
      description:
        'In Turborepo/Nx monorepos, a shared @packages/contracts package exports Zod schemas. Both the Next.js React frontend and the Express Node.js backend import the identical schema: the frontend uses it for client-side form validation, and Express uses it for API request validation, eliminating duplicate validation code.',
      codeSnippet: `// Shared schema used by both React frontend and Express backend:
export const CreateProductSchema = z.object({
  title: z.string().min(3),
  priceInCents: z.number().int().positive()
});

// Automatically infer TypeScript type for controllers:
export type CreateProductDTO = z.infer<typeof CreateProductSchema>;`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why has Zod largely replaced Joi in modern TypeScript Node.js applications?',
          spokenAnswer:
            'Zod has become the industry standard because it was designed from the ground up for TypeScript. Using z.infer<typeof Schema>, TypeScript types are automatically inferred from the runtime schema without writing manual interfaces or running compilation scripts. Furthermore, Zod has zero dependencies, works isomorphically in both the browser and Node.js (allowing shared validation between frontend and backend), and integrates natively with modern frameworks like tRPC and Next.js.'
        },
        {
          question: 'Why should you validate req.params and req.query in addition to req.body?',
          spokenAnswer:
            'Because route parameters and query strings are entry points for injection and runtime crashes. All query parameters in Express default to strings; validating them ensures that values expected to be numbers (e.g. ?page=1) or enums (e.g. ?sort=asc) are strictly validated and coerced. Validating route parameters (e.g. ensuring :id is a valid UUIDv4 or MongoDB ObjectId) prevents invalid queries from ever reaching database indexes.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the security danger of using Joi or Zod without stripping unknown properties (.strict() in Zod)?',
        answer:
          'If unknown properties are not stripped, clients can send unexpected fields (e.g. { isAdmin: true, role: "SUPERUSER" }). If your service or ORM passes req.body directly to a database update query (Mass Assignment vulnerability), the user can escalate privileges. Zod strips unknown keys by default, whereas Joi allows them unless .unknown(false) or stripUnknown is enabled.'
      },
      commonMistakes: [
        'Validating only the request body while ignoring query parameters and route IDs.',
        'Throwing raw validation errors instead of formatting them into user-friendly field-level error arrays.',
        'Duplicating TypeScript interfaces manually alongside validation schemas instead of using z.infer.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Validate req.body, req.query, and req.params at the middleware perimeter before controllers run.',
        'Zod provides automatic TypeScript inference via z.infer<typeof Schema> and zero dependencies.',
        'Always sanitize inputs to prevent Mass Assignment privilege escalation attacks.'
      ],
      oneLineDefinition:
        'Request validation ensures that incoming HTTP payloads strictly conform to typed schemas, rejecting malformed requests at the perimeter with structured 400 errors.',
      interviewTip:
        'Mention Mass Assignment prevention and shared frontend-backend validation when discussing Zod.',
      keyDistinction:
        'Zod vs Joi: Zod infers TypeScript types automatically and runs in browser/Node; Joi is a heavier Node-only library requiring manual type synchronization.'
    },
    comparisonTable: JOI_VS_ZOD_COMPARISON_TABLE
  },
  {
    id: 'express-file-uploads-multer',
    number: 15,
    title: 'File Uploads (Multer)',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Validation and File Handling',
    categorySlug: 'express-validation-files',
    estimatedMinutes: 5,
    concept30Sec:
      'Multer is a Node.js middleware for handling multipart/form-data, primarily used for uploading files. Multer parses multipart streaming bodies, extracts file streams, validates file size and MIME constraints, and writes files to memory (MemoryStorage) or local disk (DiskStorage).',
    internals: {
      overview:
        'Native express.json() cannot parse multipart/form-data. Multer uses the busboy streaming parser under the hood. When a file stream arrives, Multer streams byte chunks into memory buffers or disk write streams without buffering the entire body upfront. CRITICAL SECURITY RULE: The client-provided file.mimetype or file extension cannot be trusted; attackers rename .exe or .php malware to .png. A production backend must inspect the binary File Signature (Magic Numbers) of the initial file buffer using libraries like file-type.',
      flowSteps: [
        '1. Multipart Stream: Client transmits multipart/form-data boundary stream.',
        '2. Busboy Parsing: Multer intercepts the stream and separates text fields from file byte streams.',
        '3. Size Enforcement: Enforces limits.fileSize; if exceeded, destroys stream and rejects with LIMIT_FILE_SIZE error.',
        '4. Storage Engine: MemoryStorage buffers chunks into req.file.buffer; DiskStorage writes to disk with sanitized unique filenames.',
        '5. Magic Number Verification: Backend reads initial bytes to verify true file signature (e.g. PNG: 89 50 4E 47).',
        '6. Downstream Forwarding: Passes sanitized buffer to AWS S3 or controller.'
      ],
      diagram: `SECURE MULTIPART FILE UPLOAD PIPELINE:

Client Upload: "malware.exe" renamed to "profile.png"
                      |
                      v
+-------------------------------------------------------+
| Multer Middleware:                                    |
|   1. Enforces Size: limits: { fileSize: 5MB }         |
|   2. MemoryStorage: Buffers bytes into req.file.buffer|
+-------------------------------------------------------+
                      |
                      v
+-------------------------------------------------------+
| True MIME Magic Number Verification (file-type):       |
|   - Inspects binary header: 4D 5A (MZ = Windows EXE!) |
|   - Client claimed 'image/png', but binary is EXE!    |
|   - ACTION: REJECT IMMEDIATELY with HTTP 400!         |
+-------------------------------------------------------+`
    },
    codeExample: {
      code: `import express from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';

const app = express();

// 1. Configure Multer with strict memory storage & size boundaries
const upload = multer({
  storage: multer.memoryStorage(), // In-memory for S3 streaming or signature check
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Quick preliminary check on client-provided mimetype
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('INVALID_MIME: Only image files are allowed'));
    }
    cb(null, true);
  }
});

// 2. Controller with True Binary Magic Number Validation
app.post('/api/avatar', upload.single('avatar'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // CRITICAL: Inspect true binary magic numbers from buffer!
  const detected = await fileTypeFromBuffer(req.file.buffer);
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!detected || !allowedMimes.includes(detected.mime)) {
    return res.status(400).json({
      error: 'Security alert: Spoofed file signature detected. File rejected.'
    });
  }

  // Safe to stream to AWS S3 with randomized key:
  const safeFilename = \`avatars/\${randomUUID()}.\${detected.ext}\`;
  res.status(201).json({
    message: 'Avatar uploaded successfully',
    verifiedMime: detected.mime,
    sizeBytes: req.file.size,
    safeStorageKey: safeFilename
  });
});`,
      language: 'javascript',
      output: `POST /api/avatar (Valid PNG Image) HTTP/1.1

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "message": "Avatar uploaded successfully",
  "verifiedMime": "image/png",
  "sizeBytes": 142080,
  "safeStorageKey": "avatars/f47ac10b-58cc-4372-a567-0e02b2c3d479.png"
}`,
      whyOutput:
        'Multer enforces the 5MB size limit. The controller uses fileTypeFromBuffer to inspect the binary magic bytes of req.file.buffer. Even if an attacker disguised an executable as a PNG, the magic byte inspection detects the spoofing and rejects it.'
    },
    nodeJsApplication: {
      scenario: 'Streaming Large Uploads Directly to AWS S3 without Disk Saturation',
      description:
        'In cloud environments (Docker, AWS ECS, Heroku), local disks are ephemeral and small. Writing 50MB video uploads to local disk exhausts container storage. Senior engineers use multer-s3 or pass PassThrough streams to upload directly from network socket to S3 via @aws-sdk/lib-storage.',
      codeSnippet: `import { Upload } from '@aws-sdk/lib-storage';

// Direct stream from Multer buffer/stream to S3
const parallelUpload = new Upload({
  client: s3Client,
  params: {
    Bucket: 'cloud-assets',
    Key: safeS3Key,
    Body: req.file.buffer, // Or PassThrough stream
    ContentType: verifiedMime
  }
});
await parallelUpload.done();`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why is checking req.file.mimetype or the file extension insufficient for validating file uploads?',
          spokenAnswer:
            'Because req.file.mimetype and the file extension are completely controlled by the client. An attacker can take an executable file (.exe, .sh, .php), rename it to avatar.png, and send Content-Type: image/png in the HTTP header. If the backend only checks the file extension or mimetype header, it will accept malicious binaries. Production applications must inspect the File Signature (Magic Numbers) of the raw binary buffer using a library like file-type.'
        },
        {
          question: 'What is the trade-off between multer.memoryStorage() and multer.diskStorage()?',
          spokenAnswer:
            'memoryStorage() buffers the uploaded file chunks in the V8 Heap as a Buffer. It is fast and ideal for small files (< 10MB) that need instant magic number validation or streaming to cloud storage like AWS S3. However, large files or high concurrent uploads will rapidly exhaust the Node.js V8 heap, causing Out-Of-Memory (OOM) crashes. diskStorage() writes directly to local disk streams with minimal memory usage, but requires disk cleanup, storage provisioning, and sanitizing filenames against directory traversal attacks.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you prevent Directory Traversal attacks when using multer.diskStorage?',
        answer:
          'Never use file.originalname directly as the destination filename on disk! Attackers can pass ../../../etc/cron.d/malware as the originalname. Always generate an independent, cryptographically secure random filename (e.g. crypto.randomUUID()) and append a verified extension.'
      },
      commonMistakes: [
        'Trusting the client-provided originalname or mimetype without binary magic number validation.',
        'Using memoryStorage() for 500MB video uploads, crashing the Node.js process with Out Of Memory.',
        'Not handling Multer-specific errors (like MulterError: LIMIT_FILE_SIZE) in the centralized error handler.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Multer parses multipart/form-data; native express.json() cannot parse multipart streams.',
        'NEVER trust client mimetype: always verify true binary File Signatures (Magic Numbers).',
        'Always replace original filenames with randomized UUIDs to prevent Directory Traversal attacks.'
      ],
      oneLineDefinition:
        'Multer is a streaming multipart/form-data middleware for Express that handles file uploads, enforcing size limits and storage routing.',
      interviewTip:
        'Mention "Magic Number / File Signature verification using file-type" as the essential security control for file uploads.',
      keyDistinction:
        'memoryStorage vs diskStorage: memoryStorage keeps buffers in V8 heap for cloud streaming; diskStorage streams directly to filesystem to save RAM.'
    }
  },
  {
    id: 'express-static-files',
    number: 16,
    title: 'Static Files',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Validation and File Handling',
    categorySlug: 'express-validation-files',
    estimatedMinutes: 5,
    concept30Sec:
      'Express provides express.static() as built-in middleware to serve static assets such as images, CSS, JavaScript bundles, and PDF documents. It handles HTTP caching headers (Cache-Control, ETag, Last-Modified) and byte-range requests for audio and video streaming.',
    internals: {
      overview:
        'express.static is built directly on the serve-static and send npm libraries. When a request matches a static file path, Express opens a read stream via fs.createReadStream(). It calculates an ETag hash from file metadata (inode, size, mtime) and checks incoming If-None-Match or If-Modified-Since headers. If the file has not changed, it immediately sends HTTP 304 Not Modified without re-transmitting the file body. It also handles HTTP 206 Partial Content for range-based streaming.',
      flowSteps: [
        '1. Path Resolution: Resolves requested URL against the specified root directory using path.join().',
        '2. Traversal Security: Validates that the resolved path does not escape the root folder (blocks ../ directory traversal).',
        '3. Metadata Stat: Performs fs.stat() to read file size and modification timestamp (mtime).',
        '4. Conditional Caching Check: Compares ETag or Last-Modified against client headers. If unchanged, returns 304 Not Modified.',
        '5. Header Injection: Sets Content-Type based on extension (mime-types), Cache-Control headers (maxAge), and Accept-Ranges: bytes.',
        '6. Stream Transmission: Pipes fs.createReadStream() directly to res; calls next() if file does not exist (fallthrough).'
      ],
      diagram: `EXPRESS.STATIC HTTP 304 CACHING WORKFLOW:

Client Browser                              Express Server (express.static)
      |                                                   |
      | --- 1. GET /assets/bundle.js -------------------> |
      |                                                   | Generates ETag: "a1b2c3"
      | <--- 2. 200 OK + ETag: "a1b2c3" + Body ---------- | Sets Cache-Control: max-age=86400
      |                                                   |
(Next Day Request)                                        |
      |                                                   |
      | --- 3. GET /assets/bundle.js -------------------> |
      |        If-None-Match: "a1b2c3"                    | Compares ETag... MATCH!
      |                                                   | (File unchanged on disk)
      | <--- 4. 304 Not Modified (ZERO BYTE BODY!) ------ | Saves network bandwidth!
      | (Browser uses cached version from disk)           |`
    },
    codeExample: {
      code: `import express from 'express';
import path from 'node:path';

const app = express();
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Production Configuration for express.static
app.use('/static', express.static(PUBLIC_DIR, {
  maxAge: '1d',            // Sets Cache-Control: public, max-age=86400
  immutable: true,         // Adds immutable directive for cache-busted hashed assets
  etag: true,              // Generates weak/strong ETags
  lastModified: true,      // Sets Last-Modified header
  dotfiles: 'ignore',      // Ignores dotfiles (e.g. .env, .git) for security
  fallthrough: true,       // Passes to next middleware if file not found
  setHeaders: (res, filePath) => {
    // Custom header decoration based on file type
    if (filePath.endsWith('.html')) {
      // HTML files should never be aggressively cached!
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));`,
      language: 'javascript',
      output: `GET /static/logo.png HTTP/1.1

HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=86400, immutable
ETag: W/"1f40-18e472a8120"
Last-Modified: Mon, 16 Nov 2026 12:00:00 GMT
Accept-Ranges: bytes`,
      whyOutput:
        'express.static matches /static/logo.png, sets Content-Type, adds Cache-Control headers with max-age=86400 and immutable, attaches the computed ETag, and streams the file. Subsequent requests with matching If-None-Match will receive instantaneous 304 Not Modified responses.'
    },
    nodeJsApplication: {
      scenario: 'Reverse Proxy Offloading in Enterprise Deployments',
      description:
        'In production high-scale deployments, Node.js should NEVER serve high-volume static files directly. Serving gigabytes of static assets blocks Node.js event loop ticks and wastes V8 heap memory. Reverse proxies like Nginx, Cloudflare CDN, or AWS CloudFront/S3 are configured to intercept static paths directly.',
      codeSnippet: `# Nginx production block offloading static files before reaching Node:
location /static/ {
    alias /var/www/my-app/public/;
    expires 365d;
    add_header Cache-Control "public, immutable";
    access_log off;
    # Request never even touches the Node.js process!
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Should an Express application serve static assets directly in production?',
          spokenAnswer:
            'In local development or small standalone tools, express.static is convenient and sufficient. However, in production enterprise deployments, Node.js should NOT serve static assets directly. Static file streaming ties up Node.js thread handles and socket buffers. Production architectures place a reverse proxy (like Nginx) or a CDN / Object Storage bucket (like AWS CloudFront with S3) in front of Express to cache and serve static assets at the network edge, preserving Node.js CPU cycles entirely for dynamic API requests.'
        },
        {
          question: 'How does express.static handle conditional caching and 304 Not Modified responses?',
          spokenAnswer:
            'express.static automatically computes an ETag hash from the file size and modification timestamp, and reads the file Last-Modified time. When a browser sends a request with If-None-Match (ETag) or If-Modified-Since headers, express.static compares the hashes. If the file has not changed on disk, Express immediately sends an HTTP 304 Not Modified status code with an empty response body, saving server bandwidth and client load time.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the security risk of setting dotfiles: "allow" in express.static?',
        answer:
          'Setting dotfiles: "allow" exposes hidden configuration files like .env, .git/config, and .npmrc to the public internet if the static folder points to the root directory, leaking database passwords and API secrets. Always keep dotfiles: "ignore" (the default) or dotfiles: "deny".'
      },
      commonMistakes: [
        'Setting long Cache-Control max-age on HTML files, preventing users from receiving frontend application updates.',
        'Using relative paths without path.join(__dirname, "public"), leading to broken file paths depending on where node was launched.',
        'Serving multi-gigabyte static files through Express in production instead of offloading to S3 and CloudFront.'
      ]
    },
    quickRevision: {
      takeaways: [
        'express.static provides built-in static asset streaming with ETag and Cache-Control headers.',
        'Never serve static files through Node in high-scale production: offload to Nginx, S3, or a CDN.',
        'HTML files should never have aggressive maxAge caching; hashed JS/CSS assets should use immutable.'
      ],
      oneLineDefinition:
        'express.static is built-in middleware that serves static assets with automatic ETag generation, conditional 304 caching, and range requests.',
      interviewTip:
        'Always recommend offloading static files to Nginx or a CDN (CloudFront/S3) in senior interview answers.',
      keyDistinction:
        '200 OK vs 304 Not Modified: 200 sends full file content; 304 tells the client its cached copy is fresh, sending 0 bytes.'
    }
  }
];
