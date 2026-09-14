Man, for 3 YOE MERN + Node.js Full Stack roles (the ones you're applying for), backend interviews are a different league than fresher interviews. They'll expect you to know how production systems work, not just Express CRUD APIs.

Since we've already finished a lot of LLD and you're learning AWS/DevOps, here's the backend interview syllabus I'd follow if I had 2–3 weeks before interviews.

Target for 3 YOE Backend Interviews

# Production-ready Node.js engineer

Know how APIs are designed, optimized, secured, deployed, monitored, and scaled.

SYSTEM DESIGN + LLD

## High expectation

NODE + DATABASES

## Deep practical knowledge

AWS + DOCKER

## Basic deployment knowledge

SECURITY + CACHING

## Very commonly asked

# Complete Backend Interview Roadmap (3 YOE)

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-has-width="" data-d-valign="start" style="width: 36%;"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Interview Expectation</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Node.js Internals</td><td data-d-component="table-cell" data-d-valign="start">Event Loop, Streams, Buffers, Worker Threads, Cluster</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Express.js</td><td data-d-component="table-cell" data-d-valign="start">Middleware, Routing, Error Handling, Validation</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">REST APIs</td><td data-d-component="table-cell" data-d-valign="start">Versioning, Pagination, Filtering, Idempotency</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Authentication &amp; Security</td><td data-d-component="table-cell" data-d-valign="start">JWT, OAuth, Cookies, CORS, Helmet, CSRF, Rate Limiting</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">MongoDB + SQL</td><td data-d-component="table-cell" data-d-valign="start">Indexing, Aggregation, Transactions, Query Optimization</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Redis</td><td data-d-component="table-cell" data-d-valign="start">Caching, Sessions, Pub/Sub, Distributed Locking</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Async Systems</td><td data-d-component="table-cell" data-d-valign="start">Queues, Background Jobs, Cron Jobs, Webhooks</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">File Storage</td><td data-d-component="table-cell" data-d-valign="start">S3, Azure Blob, Signed URLs, Upload Strategies</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Scaling</td><td data-d-component="table-cell" data-d-valign="start">Load Balancer, Stateless Services, Horizontal Scaling</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Docker + AWS</td><td data-d-component="table-cell" data-d-valign="start">ECS, EC2, Nginx, ALB, RDS basics</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Testing</td><td data-d-component="table-cell" data-d-valign="start">Jest, Supertest, Integration Testing</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Observability</td><td data-d-component="table-cell" data-d-valign="start">Logs, Metrics, Health Checks, Monitoring</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">HLD + LLD</td><td data-d-component="table-cell" data-d-valign="start">Design scalable backend systems and APIs</td></tr></tbody></table>

This is basically 95% of what startups (M32, Conduct, Wexa, etc.) ask.

# Phase 1 — Node.js Fundamentals (Must Know)

## 1. Event Loop (Most Asked Topic)

![Stop Blocking the Loop: Practical Node.js Rules | by Aashutosh Gandotra | Medium](https://images.openai.com/static-rsc-4/D4CUYqqT6oQE3ZzqBKiHUIhz28Vav1jYBTNVhihmHWTJtZQY8BJin1V4Mcd-7vj2QmewaepQAx-TJhBSycYMGtCaQOKP9VynkJI4XxqiufUH5REhC-tpvMzsnxiQ9ItKQglsoMPdbFBNsURT8Mrl4cvIhFd6BOZX31fozOF-a0o?purpose=inline)

![Node.js Event Loop Deep Dive: Why Your Async Code Isn’t Actually Parallel | by Bhagya Rana | Medium](https://images.openai.com/static-rsc-4/lZPacQgn2DE8yOXexd1XHS2kvLq6yqRhhj03UuJyrcMUkr4HZMMa3ID1ZtKARAer_QoN2o_SDy7h2XLbIAd2QAoQ-7HSbQ3EpB2fLHdTby9I6gaVGI22-4Ef9JQzxUbyFH-CorMIfKT_a2xcjxpdBWTtj0hZw4lmg51qQEdEOsg?purpose=inline)

![Beyond readFile: How Node.js Streams & Buffers Unlock Scalable Apps | by Rishikesh Patil | Medium](https://images.openai.com/static-rsc-4/Y5zAINxxR1cnMmqdCmOFCB2mTzWMkITxD_LmlgNpROHHD6oJoF2VrwqawbEGyGtXnbTCwEGSKprYyAEh0bn5vQFv-chGxZlElu2rKIo_C8sqLwzNIpyKN6CER6qRvQJiuKNQyHP1hV6bXsZUoaTTduTZLde_GgOvHZp4QvM5kXg?purpose=inline)

5

This alone can become a 20-minute interview.

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Concept</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Know This</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Call Stack</td><td data-d-component="table-cell" data-d-valign="start">Function execution.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Web APIs</td><td data-d-component="table-cell" data-d-valign="start">Timers, Network Requests.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Callback Queue</td><td data-d-component="table-cell" data-d-valign="start"><code class="er4J8W_Code" data-d-component="code">setTimeout</code>, <code class="er4J8W_Code" data-d-component="code">setInterval</code>.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Microtask Queue</td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text">Promises, <code class="er4J8W_Code" data-d-component="code">process.nextTick</code>.</p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Event Loop Phases</td><td data-d-component="table-cell" data-d-valign="start">Timers → Pending → Poll → Check → Close.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><code class="er4J8W_Code" data-d-component="code">setImmediate()</code></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text">Difference vs <code class="er4J8W_Code" data-d-component="code">setTimeout(...,0)</code>.</p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><code class="er4J8W_Code" data-d-component="code">process.nextTick()</code></td><td data-d-component="table-cell" data-d-valign="start">Highest priority microtask.</td></tr></tbody></table>

### Questions

- Explain Event Loop.

- Promise vs Timeout execution order.

- Why is Node single-threaded?

- What runs in libuv thread pool?

## 2. Streams & Buffers

![What is Stream Module pipe() in Node.js?](https://images.openai.com/static-rsc-4/FlG-9dcHrLmwvdYvXiTqBN2Xx2xXrd-9nlHD1FLmr1lB3bUo-XFD7Y0Xh-h9AdS1mo4pvNIfm6lZ4rbOVC0tQJVSbCIA_Rpwa8dww_ZOLOh7lqlhoVSt7bKIzcaq_XMXnJ8HgetkhyLZ4ouxJCz06D-DK3FtWxrdW9mBdWNgto4?purpose=inline)

![Medium](https://images.openai.com/static-rsc-4/Fkrs-Rts6YO2zLOZ4ka93MvMe0GtdcoXaBL_9t5tqd_-Uae8oXBx3N5_HNqWQJ8cbTIlYc5-0SVKgds_S71shmRlY_NNGHzL9bg2v3dFPvdMidlutZGn2uNgXW-OZgAC3vmBy-LwZCPqwVdSTqy6W2OkmsWC27Lj8J8cauyRT2I?purpose=inline)

![NodeJS Custom Streams. - DEV Community](https://images.openai.com/static-rsc-4/IiNYT6UVSbRmvZFLmgj3d2l00RKvYgj15uOM18C4zGDUvbiuAclPJAvyD3gviLT993lyJ4rnLA2QPqYTScX1XFvKieW4xMKtrgqTJQs6PKuZWvETj1Trko9aeNDY_TmjpTw7fzS2WEkOxsP-HLRv9KfdXnO-kz0kCKtBbeCkA_8?purpose=inline)

5

Very important for file uploads.

Know:

- Readable Stream

- Writable Stream

- Duplex Stream

- Transform Stream

- Pipe

- Backpressure

- Buffers

Example Interview

> Upload a 5GB video. Why not use `fs.readFile()`?

Expected answer:

- Use streams.

- Constant memory.

- Pipe to S3.

## 3. Worker Threads vs Cluster

![Node.js Worker Threads: Unlocking Server-Side Parallel Processing | by Artem Khrienov | Medium](https://images.openai.com/static-rsc-4/xyuHCuL1JOF3WttNajFUsd8ySKJjbdToJm6gBOfxkt0GO8eUzk8pe29sjheaxi25U1WhNj1bKHlM2vyVkFKkxB279i5RiCZm4TMKaONVXPcnJ0Wk5I8SXED-_LDA0ZDvVowq-PvjNC7Ujmex_SkrQc9yDm2c_jWmmRI-cZdZzfQ?purpose=inline)

![Implementing Node.js Cluster for Improved Performance | by Amjad Rehman A | Medium](https://images.openai.com/static-rsc-4/nHzH8dU6MpuizwBdqpoxa3EQobBo5hGa_4ZoFKbdsax8fwxybDkxSRS_aeQ_GbPk-qQ-TgfD7THtMl0HtQmychzIyL7E026MA4hmbu2HTD6OagCFWRhEOjFEd7UeseIk5bUrMm7-h6dzvY_itf2jTNGwFuVBXcfrnrOdgghLmzw?purpose=inline)

![How I Scaled Node.js to Handle Millions of Requests per Minute | by Anmolchugh | Medium](https://images.openai.com/static-rsc-4/al5A10M3gbHZrwnrDSOLcU7Z2RUURTC9crRxKzJSLyb95DFGGs0G2M1jXHxborEHLS4F-GusyHgxg1dOdt75B2fL0fFg1Sr1L-PU6YjghmJW2hUOIM16qRnXYtcYCD9alYP6Yhwu7YEDQ0l84rre6_8mhTbQQwlTNspJBEvRaQY?purpose=inline)

5

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Worker Threads</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Cluster</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CPU intensive tasks.</td><td data-d-component="table-cell" data-d-valign="start">Multiple Node processes.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Shared memory possible.</td><td data-d-component="table-cell" data-d-valign="start">Separate memory.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Image processing.</td><td data-d-component="table-cell" data-d-valign="start">HTTP server scaling.</td></tr></tbody></table>

# Phase 2 — Express.js Deep Dive

## Middleware Flow

![Middleware in Express.js — The Complete Deep-Dive | by shubham | Medium](https://images.openai.com/static-rsc-4/1MpZRSHVODeIdpCquQ1vNUQ2VidICj44qy0lhJ0IUxCE8KgRxI6MH74iXWsHgslv-I5W2Ov4aC1nODZlQTQ-KNZDNhYK2MBQn7C_mRwq-Se7MDeW6YwhE0x8MPRwxjrV3gcXmrKAW7ech6Inj6xMUmx-Fbq1ntvtE2osruq8eoE?purpose=inline)

![Creating Routes and Handling Requests with Express](https://images.openai.com/static-rsc-4/nC-U-2yfQhjNTcJo8VivKtRr6Abg5C2vxH1Cnhgg0dtOQIE2UbUp-yjcsxn7XVH0_FwlR2w34PGqGOzOVKgXILwpqwyRmd8_dg97rNG1HP17_49kcbeat7W1vWOPPCVqWrRdn4VKiOOI6rNt_9asGjDYsbTH_LEqoR3onuc8WEo?purpose=inline)

![Express.js](https://images.openai.com/static-rsc-4/f4JJPspy4fS87LJHbWJa2_nLlBQAZhXXpd84kYFBRYNxx_P2dSgGxa3A-M39ba0nMdjlR2xatlhNE05uzsKAY9eZ7Y8uvMPZzHpv8XYOa5slD01xof3OkEktH1XALeZNVvXzLQFIfImmzGmsGwMEWptHPcQyDW9q_sEXK-p6c9E?purpose=inline)

5

Know:

- Global middleware.

- Route middleware.

- Error middleware.

- Async middleware.

- Helmet.

- Morgan.

- Compression.

- Validation.

### Questions

- Difference between middleware and interceptor.

- How Express handles errors.

- Why call `next(err)`?

## Request Validation

Libraries:

- Zod

- Joi

- Express Validator

Know:

- Schema validation.

- Sanitization.

- Custom validators.

## Error Handling

Know centralized handler.

JavaScript

```
app.use((err, req, res, next)=>{
   res.status(err.status || 500).json(...)
})
```

Questions:

- Operational vs Programming errors.

- Custom error classes.

# Phase 3 — REST API Design (Very Important)

## Design APIs Like Senior Engineers

![🧭 REST API Design — Best Practices and Architecture Principles for Modern Backend Engineers | by Harsh Gharat | Medium](https://images.openai.com/static-rsc-4/GzoeYditXFNLkFCUjWFw9F_Qex1A3QKhQw14hokmySZzA4AOFaUgkY340kC_80dCWZPkZcgAngM6zf9V5fWokHo2nePQE8Z4Aj-CDYjHYaewAcrhAXhvhm_TyZSQCQr8RkmE7soL3hw_bQVSzaVHi8A88jcJf1o_cdtSlIoLieQ?purpose=inline)

![The Hidden Costs of Bad REST Versioning You’ll Discover Too Late | by The Outage Specialist | Medium](https://images.openai.com/static-rsc-4/lGtKys4nnYIJTLaMqWIxxXN0Add56rN-38uDEWFHbhNAq4XXyA_P0bpGn7Wn7WByC_xxS_Ybk4mF7P81wo2QDo5RwaT81MenEVRvk_1SKTkuDutNlvMli6hHl2z6zu2uMOakeJrJMIgZw_YvbrJgIVZWuSC55VfRbTVadtUQJXQ?purpose=inline)

![Most REST APIs are painful to use.
Here are the top 5 mistakes I see.
It’s not because the logic is bad. It’s because the interface is confusing.
I see developers making the same 5 mistakes over… | Milan Jovanović | 51 comments](https://images.openai.com/static-rsc-4/sud4oTCCU9G4hEU5oXBlHOzzrKdBBlcsd6U0-aVYtG0VygsnOpm0e2G6eqgK3U7xBZdSOi7xGCZvhEW-3f6Z8xCwq6g9xdv5FmLjJvNoCYk9AbTxDKr5ZlRg6aAEv18KjuOWa6XFccxlrdMyhdJLZqQbgYkraEZp8I3kcEZGowE?purpose=inline)

6

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Concept</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Know</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CRUD Naming</td><td data-d-component="table-cell" data-d-valign="start">Resource based endpoints.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Pagination</td><td data-d-component="table-cell" data-d-valign="start">Cursor vs Offset.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Filtering</td><td data-d-component="table-cell" data-d-valign="start">Query params.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Sorting</td><td data-d-component="table-cell" data-d-valign="start">Asc/Desc.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">API Versioning</td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><code class="er4J8W_Code" data-d-component="code">/v1</code>, header versioning.</p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Idempotency</td><td data-d-component="table-cell" data-d-valign="start">PUT vs POST.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Rate Limiting</td><td data-d-component="table-cell" data-d-valign="start">API protection.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">HATEOAS</td><td data-d-component="table-cell" data-d-valign="start">Basic awareness only.</td></tr></tbody></table>

## API Status Codes

Know all common codes.

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">2xx</span></p></td><td data-d-component="table-cell" data-d-valign="start">200, 201, 204.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">4xx</span></p></td><td data-d-component="table-cell" data-d-valign="start">400, 401, 403, 404, 409, 422, 429.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">5xx</span></p></td><td data-d-component="table-cell" data-d-valign="start">500, 502, 503.</td></tr></tbody></table>

# Phase 4 — Authentication & Authorization

Probably the most asked backend topic.

## JWT Authentication Flow

![【図解で解説】トークン ベースの認証について](https://images.openai.com/static-rsc-4/VIJfhlyAvb3BYGBZHGIoEnhKUneMEcWaO9qMRhx9J9KkLq179GO7seKyohN4cm7Ye2Z7v4Gprz5HyF7XO6I3Yizk-GFYx6IO_-vvlijZJx6BxA0AA6cFSsINqSPpRP0_-fwYEnn6ceUI_xG3FBa9r9Ht6u60h-s8nbU1-SOorvI?purpose=inline)

![Persistent login in React using refresh token rotation - LogRocket Blog](https://images.openai.com/static-rsc-4/AfNPlnUf0dB0NGe_hZtKT0Gl2mDU3B_z0qz6CQy4kBy-MSg0LNvlP-9LoY7riOMY2OtkOyzYk1CpqtLKWQ0JPRH9fs-dPrjxd87oPBelFQ113eTtqViRm_ZQAdqTLbHN1BBw0ttc4-7uVZ2wEfA6L3whNMDNp378nVceDcqmVrU?purpose=inline)

![The Definitive Guide to OAuth Tokens](https://images.openai.com/static-rsc-4/v2JTDTYB2LGBo-h-mZZhP2ynGY8oneEZN9YvUzlNtXDMuA1R9HLT1tKFW2_DxswgYld5u0L0i29T2dALSaSHb0kkDelRFUDRal-18FN0RC-6fbB_FYkYRXO4p2Vouk2fGOKxj82-Mx90biGUziF1bUJAsFdfNHbqe0TBBwAPdEA?purpose=inline)

5

Know:

- Access Token.

- Refresh Token.

- Token rotation.

- Expiration.

- HttpOnly Cookies.

- LocalStorage risks.

### Questions

- Why refresh token?

- Where store JWT?

- How revoke JWT?

- Logout implementation.

## OAuth

![Oauth client](https://images.openai.com/static-rsc-4/HYrmRmPA-8qa1zmCsP-5kKQ6IIzT2_M8jnSsgUgRedx9kKc44671XaVDyYwI5bYkw4jJbuzXw5VXFuJAaCyEFHsi__PJv7H-JNuhceDLL6C3kBiEz2kLyVe7delj7gtc7wYFVL8Cfh2L6WQ3bejRtOG_6qeeF7pWNAuwscILlZ4?purpose=inline)

![OAuth Authentication — Enhance](https://images.openai.com/static-rsc-4/W5LdVHfTbPdAABAsMcW6zYZyiOqXPZZI3hLgVeN2ghrZ3orBg6z9xxn9ZAysgPuDg1poXSMCdZZmqmcR9DfHuPeqFKP2aQxbjST8cpsJdeuthnKx0tF8WmD915sO9nZWERHhRIU3MclZvfS14DKv4DpSv6j4GjOcesBVuoaa1mE?purpose=inline)

![Implementing SSO in React with GitHub OAuth2 | by Reihaneh Sadatshokouhi | Medium](https://images.openai.com/static-rsc-4/E061zzbc4UweGbx5fP8CYCsCijggSM1wubor8aFzqIVj6KqTRNXdL5CcjY_TPluMbCsNzRKJ_AUv8horUwEUoQyOAC6H1yaQg2nCVFHER7LePJexjECEw9Wo3xPmwT6HpB3vqxECqKo-KmAX2IBdryfZ-Q-ig7J9mtY9sp0mlIM?purpose=inline)

5

Since you've implemented GitHub OAuth.

Know:

- Authorization Code Flow.

- Client ID.

- Client Secret.

- Redirect URI.

- State parameter.

- PKCE basics.

## Security Concepts

![Comprehensive Guide to the OWASP Top 10](https://images.openai.com/static-rsc-4/uo4VOr4CfyBinfBGUMTmMpnqFpwaXBBp0oDJh-tky_WiF6tyfwE7rxeoxZUyHhbDaee4VmTFT6AvklJgyCunZ7tl4jVGjnTlWgdMVWXaF2DJzhXl7j6-ZA1BwkOjnVPSZJqaVFKeGnIWpD_UyxN4BGH7dZHKOMG_-S1TgDbMuFc?purpose=inline)

![The Only JavaScript Security Guide You Need: Stopping XSS and CSRF | by SnehaTech | Medium](https://images.openai.com/static-rsc-4/GO7yyjkR1DsdLaVDnEjaOKDh0fKSmSFn2O-hxRPWI8JG7VVACC281nLPA7jeg5Xw_bTjWqrIt5IRH-yODS5qZpW-fxTWrGFEVn-C-Jq0e4HVvozXR6KUUTcDKI0VVIY-r0Faj61umzmFfEAJTi6jXZk_fWUPGv5t1gH41hqxU4k?purpose=inline)

![The Web’s Security Guard: How CORS Works and Its Role in API Gateway | by Cadium | Medium](https://images.openai.com/static-rsc-4/FJGSlTe7NKAHEVXoA_vmIm8pwPjXg_ccCyQOR3aaw3FlU6-ppmaohBbn-O6nbJeN3qgrmFLgFQm39joj0R3p8NYhQnN_Pv8tfJ3UmKDbLdKJtNFjHXAFl7dnFiHAlpKjXiU6IsbWkZdaXt-63mogXf6-6JM_g72hTAx_zjIuYEY?purpose=inline)

5

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Attack</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Protection</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">SQL Injection</td><td data-d-component="table-cell" data-d-valign="start">Parameterized queries.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">NoSQL Injection</td><td data-d-component="table-cell" data-d-valign="start">Input validation.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">XSS</td><td data-d-component="table-cell" data-d-valign="start">Escape HTML, CSP.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CSRF</td><td data-d-component="table-cell" data-d-valign="start">CSRF tokens, SameSite cookies.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CORS</td><td data-d-component="table-cell" data-d-valign="start">Origin whitelist.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Helmet</td><td data-d-component="table-cell" data-d-valign="start">Secure headers.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Rate Limiting</td><td data-d-component="table-cell" data-d-valign="start">Express-rate-limit, Redis.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Password Storage</td><td data-d-component="table-cell" data-d-valign="start">bcrypt.</td></tr></tbody></table>

Expect questions from your Stripe CSP issue.

# Phase 5 — MongoDB (Deep)

## MongoDB Internals

![MongoDB索引 - VNone - 博客园](https://images.openai.com/static-rsc-4/aZlo18p5KQ5ZlyFxGkteJoke4K0nZWLqwTPhBKMyA22vTWua7tSDitv-IxkJI0PxjwXfw6C9hwwgJLFX_TVmka3yv0SLVXyOiTpI-ZwFjrDluFOpMXwwGZ5DHeH6d6xSkCeF_HKfeaE9zJdq1U6OVltBPfkwq5JR2bZnU4p_KKo?purpose=inline)

![Best Tools to Build MongoDB Aggregation Pipelines Visually in 2026](https://images.openai.com/static-rsc-4/3CgO1J9n5P0w_qjxpjeCcrrkPD3xSlRKFwea9HlN7s9T9BZUZ2553AUKWP0h6TPcOF_UtVYKcEKtM7W6MWdqS3ollby83284C6cHboin8T60WX6ONY0c3_qD6kABk__vCdr0GA_EXe6m-wW00VFtOrSNfxxi6krvPYKUhuTMCYY?purpose=inline)

![MongoDB Compass: select distinct field values - Stack Overflow](https://images.openai.com/static-rsc-4/E48tQvHeWnC22WSWpngUO6AR9-gZ-gZkSe8nQtLQi6K1SdFV5JpwwLTD2iK0xupFHR4f4zWI7nCgj55FcEy73sLCPTA0Xao1V-kpZDX5vLolI0Z1GmFaFwPJcOuMo4Wnp2eFTT9Z83mXa3pm-DqQXx_6Hu4mMlD2xuvKDUBuCV4?purpose=inline)

5

Know:

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Depth</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Indexes</td><td data-d-component="table-cell" data-d-valign="start">Compound, Unique, Sparse, TTL.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Aggregation</td><td data-d-component="table-cell" data-d-valign="start">Match, Group, Lookup, Project, Facet.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Explain Plan</td><td data-d-component="table-cell" data-d-valign="start">Query optimization.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Transactions</td><td data-d-component="table-cell" data-d-valign="start">ACID in MongoDB.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Replica Set</td><td data-d-component="table-cell" data-d-valign="start">Primary/Secondary.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Sharding</td><td data-d-component="table-cell" data-d-valign="start">Horizontal scaling.</td></tr></tbody></table>

## Aggregation Pipeline

You must know:

JavaScript

```
$match
$group
$lookup
$project
$facet
$sort
$limit
$skip
$unwind
```

Questions:

- Count active users monthly.

- Join collections.

- Pagination using aggregation.

## Mongoose

Know:

- Schema.

- Virtuals.

- Hooks.

- Populate.

- Lean.

- Transactions.

- Optimistic locking.

# Phase 6 — SQL Basics (Postgres)

Even MERN companies ask SQL.

![13- PostgreSQL 17 Performance Tuning: Indexing and Its Impact on Performance | by Jeyaram Ayyalusamy | Medium](https://images.openai.com/static-rsc-4/s5sdlklPZACAhcUprtbUKme2Oqejt32XJUuTvNS-61actQFPhc0J46aOG7sHPU3LDYEX6hFXtxC7zR14flmPXMWrHFyHYocVxakD_Fznpgo1ZuYbudBvTz1ouSIAZmUpEr26OI5TdxEkOEcA44tez8e-tJw_vhUhbaNGR80XCLs?purpose=inline)

![SQL Joins Cheat Sheet: INNER, LEFT, RIGHT, FULL JOIN Explained | Ajay Yadav posted on the topic | LinkedIn](https://images.openai.com/static-rsc-4/bbz0Nh37MDGtuN_t1xD9V4GKXgEeuB5K41m9ZW2cYbqg-krGj1nzFyEbIYL-l0GGNQZ4ZlAelh7X4PwaJZ5iqQLWrESHfZRAGTh18r0AWMa_cfnCjUxTBa51g3cfWecb0HswyAjNeCUDzmNc7Azm3CvZkCFeF5WclWvsRXsA8nY?purpose=inline)

![Optimise PostgreSQL queries: correlation and index-only scans | by Luigi Tanzini | Typeform's RnD Blog | Medium](https://images.openai.com/static-rsc-4/617NvBguGc0_s_UCQoiO0Vkb5VbY7csFmEBz5O4jJnXKkWU5mzj2QppLRcfaUqipgG1TnEKsBQDB9-kf1NddLSHO9110rj4MFZ-ayrH0UDwC6bCghR_t-qltGCJGmAR6flW9v47d9-iNqb4yaZMUJJVKQWPsUL5EVqBBZijt71I?purpose=inline)

5

Know:

- Inner Join.

- Left Join.

- Right Join.

- Group By.

- Having.

- Window Functions.

- CTE.

- Transactions.

- Isolation Levels.

# Phase 7 — Redis (Very Important)

![Redis Explained: A Complete Beginner's Guide (2026) | Xcademia](https://images.openai.com/static-rsc-4/f1hcunl6dtN2H0HqlY6DRmO6F16vE_80pMBb0QCEbqId1cEhKKz3TGAEK-nUFcPzgUTWgsWCAWn-mCMrWYx5W2LPrKeKd_r3yMx1sZtoqmlTwEfLvGdkR1ZiefJZfkheuTc1btxORkErEVr-buuCU8aPZHSwUOkq8XIre0DWHRA?purpose=inline)

![20 System Design Diagrams Every Software Engineer Should Memorize](https://images.openai.com/static-rsc-4/I-Tk6-3Xc35boIOYPWUYd1GNh9vbiVGP4rp9MqOhT1aopta0r3Wf8pvv2kA28UUL-tPZfkQqAQH8tcExcDgNle3Efy_dHaXu3CP_Ia1dwK5y06fpjUUk84QRy67ZlFs8vJDoMdkJL3jiDBB4n3vy6XUnGOXl20_wDvq8zjsMGT8?purpose=inline)

![Cache-Aside Pattern - DEV Community](https://images.openai.com/static-rsc-4/I-diFxEv2xfe4U_52lKBgLGXvP0LoWFPX3B93KF3PwoAeaXCxRmnudJx_W-GW66-CGW2WyYZM9SwvaSwOAA591gU4aN2hBEaiOFipWNDFsm10mF-xWpiAmMl-g0xk9-FzQa--iaHxdG39PTc2JfHt9ZqOwgJvCnNl3C7zoFicVI?purpose=inline)

## Redis Topics

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Know</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Cache Aside</td><td data-d-component="table-cell" data-d-valign="start">Most common.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Write Through</td><td data-d-component="table-cell" data-d-valign="start">Cache updated immediately.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">TTL</td><td data-d-component="table-cell" data-d-valign="start">Expiration.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Pub/Sub</td><td data-d-component="table-cell" data-d-valign="start">Notifications.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Distributed Lock</td><td data-d-component="table-cell" data-d-valign="start">Prevent duplicate jobs.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Sessions</td><td data-d-component="table-cell" data-d-valign="start">User session storage.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Rate Limiting</td><td data-d-component="table-cell" data-d-valign="start">Token bucket/sliding window.</td></tr></tbody></table>

### Questions

- Why Redis over Mongo?

- Cache invalidation.

- Cache stampede.

# Phase 8 — Queues & Background Jobs

![How BullMQ and Redis Work Together to Never Miss a Scheduled Job | by Gaurav Bhe | Feb, 2026 | Medium](https://images.openai.com/static-rsc-4/6ufA9dUDCTRFufJE1cqO48dvbapeuQ-D-BG-owJKXHMnOLNRxbinU462zZX5rGwh-5Rf6hdyKsrzXfNi2SjDzTPeSlDI8zShPpWkG8WU0a2OrqK_nCnmwOnHXFJfVt_88pEsYZhscahI3wEhp6im5Fz0DO5xj1_0LzcXArjbtss?purpose=inline)

![Architecting a Production-Grade Messaging & Queueing System | by Tanuj Garg | Medium](https://images.openai.com/static-rsc-4/DdZGJUuB7vzMdrxj8aemdV5FynSTOTq_wbqrKjz0HZKxca_MG9HFfhdA3FzHyED97S6xpKf7X_TOQxoIfURwiJRj12H6BQlKpf9gOGGYpnVYJb91IaiIKnywnmDIhaaAXEbF7uSo8n3XxoJ3mS8PZdfG1PESs284P-mA-pwGjCs?purpose=inline)

![Building Resilient Systems: Why Retry Mechanisms Are Critical for Third-Party API Integration | by Vaasu Bisht | Medium](https://images.openai.com/static-rsc-4/t0kApzICYgnkW3KKsiRjLWZ0HC27m1_A54sdyL0SMWSGUEif6HSh4xFags6yxSzWuwpvHMdbH40m97Aa-d22xmvTccxXPpyCo08bUW4l_swopF_jhZ4uDZffzig_-RF4uxzBuaFEExrEhQGngx0Ni9uEJanDuy5U9PrT6Cp6c-4?purpose=inline)

6

Know:

- BullMQ.

- RabbitMQ basics.

- SQS basics.

- Delayed jobs.

- Retry strategy.

- Dead Letter Queue.

Examples:

- Email sending.

- Invoice generation.

- Thumbnail processing.

## Webhooks

![Polling vs. Long Polling vs. SSE vs. WebSockets vs. Webhooks](https://images.openai.com/static-rsc-4/1eWfv_iGBbhPubwE7-SbYFDgY1Q6SB1m9kde2SbGXMlnBtQa2w4_JaUcnrpZk0p0mUwH0JVjHuF8sSPYya4Jjbqx41mOCj4jZdGN2do8zfOu7lgXDqiiDv4jp0qlFcQJF3o9fR-uldsOBJyxMjbh5WMb3bdURjjWfAY_jnUxh4k?purpose=inline)

![Building a Robust Webhook Handler in Node.js: Validation, Queuing, and Retry Logic - DEV Community](https://images.openai.com/static-rsc-4/vmO-QisWiFu1Jd28BdWVT9njqLj2WOZnbIwbDVOOAS8T5lC7U8NMsnQ5U7s3NqAoYnQKDEqtv3rsKwI2VXpmBPcsmufOzsbs0G-QrKne5bYEfD27dTR1XZcbl2gJEKqML2cXCvHYs6KvF3BY93uUzD2LAK71yksBQC6pjpyDZ-c?purpose=inline)

![How to Implement SHA256 Webhook Signature Verification](https://images.openai.com/static-rsc-4/PnDXCJEtkf5r1wkUFXqqgPoE7vhZKHXvHEPDsq7MKBUSygADb3vIXwJuSJVoovLCSmBB4_0VZnUAd6R5LqlJh_x5bY9YmHEPmiltMQI6Bw1A53kNlUmBupdpgPUdcLsPmEqgl5EVpIw9Zr4a2Lu8EOB8ovvJx9bJyHODWrpsmo4?purpose=inline)

5

You literally built Stripe.

Know:

- Signature verification.

- Idempotency.

- Retry handling.

- Duplicate events.

## Cron Jobs

Know:

- node-cron.

- Scheduled cleanup.

- Subscription expiry.

# Phase 9 — File Uploads & Storage

![File Upload using AWS S3, Node.js and React — Build React App | Part 3 | by Umakant Vashishtha | Medium](https://images.openai.com/static-rsc-4/pLyqpLx1vhc-_cuCLmB9hCTs6HPxQd5My8Ugzztczo_6nJ96Xt2-VSA0swOIQTw3wSOtN_D9H316aRzTruzRuPq9OQSix9r0G9vuPUCKtXYOCYRaJuAk_oCnGD-nXiVskOtOpdaubh7yAljutP0lMnXuJHynt1KVqTzyMMzykxQ?purpose=inline)

![Modern Web Application - Azure Blob Storage for Uploaded Files - Kontext Labs](https://images.openai.com/static-rsc-4/B7IJ2vQO-INEWkvl_4lnEsYjGE-jo1iDyNk6BFgXJTXD3ETSmQpWC1cI8F_jSoHToyr6Gh2hzlX2R1aAoXt-5hOQ2-aPxXE4LE99iB0t1tGdnqDsMlc7V7Zbgx9DS5ZjT0pECnCiNEJdaAtvl3lBGHrWombRbbOKCxrgSfoDyA8?purpose=inline)

![Generate pre-signed Url for the file via Node.Js | by Ankit Kumar Rajpoot | Medium](https://images.openai.com/static-rsc-4/3Obx3jxbs1kdTPloVNOZaaugcNQLMTgMI6UTVRhzmvCVLrwzPmuDtAY65SRvIvCs5knO8N_PiSNCnlRIFQTGgr9W-KIwTSp6NdtgwlSLAFTd28Qs8LBUaOpYbSY4k__ysyBCYeMkdn_TdBmN6eQ99SP5aXlNelHcGKKwn9YaOsY?purpose=inline)

5

Know:

- Multipart upload.

- Signed URLs.

- Presigned POST.

- CDN.

- MIME validation.

Questions:

- Upload 2GB video.

- Resume upload API.

# Phase 10 — Scaling Backend

This is the biggest interview topic.

## Stateless Architecture

![How Airbnb Runs Distributed Databases on Kubernetes at Scale](https://images.openai.com/static-rsc-4/-JEELMLUJM4vb_Nbypgxqsi_sTXUAhWb7CwjpPgEh6iVWMmMb6zapaqmqU_7PdbMmkf1_K41oK3QIECdlKz_DxOCbK_nak8Md-dwcpmUMaEIwn6hAgYyK5JWUa3LDNOvjFGE4SOI5--CpjoILuHYaYBTtq8lGw7utkrnhthQJIU?purpose=inline)

![Retire Sticky Sessions: The Load Balancer Feature That Quietly Breaks Scale | by Build Break Learn | Medium](https://images.openai.com/static-rsc-4/nn8ZstAvo7ToHcMDeLieFnX0nVq14etzLQAy-b0i7X1BFgvJ5OE4UOeMZ9VGD9mt3MHF1t8-T6u084XzoBaYOwo6n99LXMkkOOvqnCMo5rcjcKuPLJOtFuKVWbHCoFEufYPGomw3cLVANIRS54sS-0EZRj0QfD4XFQbbo3scHpc?purpose=inline)

![On Tree-Shaking and Bundle Optimization | by Basel Issmail | Medium](https://images.openai.com/static-rsc-4/OA8a6ajfyM7RbEL-XNHJDRjpXgIjGP1IqRr_MB7K-mgV1HXrkY2IRXXAxm2doseDY8RpaNOaaXlpaGuSR1s__USQSLd495_1R7wkTnxg_czXcM4BVgHE8of5C1DnwD66QJPx2jDU5zHf9mbCNAsq5FWpq9f_yfwmGTc6eiVpeXc?purpose=inline)

5

Know:

- Stateless APIs.

- Sticky Sessions.

- Session store in Redis.

## Load Balancer

![aws alb with asg lab - DEV Community](https://images.openai.com/static-rsc-4/uqamw-_wxPz2NVwiTBkHpjUuEHq5dhydoR6cMwNyM60m4LfMMCf8nvPaowc1zuSghddrN7X5dSF3IdZ-HKks9gyB8Ir3LRhlkgSunu40g2vXBczNiQO1_DRD6Whh_Qay-FJ-u1RLKIQ25SC-qrHCqrIo0iIxA8YVd59ExggzVBs?purpose=inline)

![#devops #webdevelopment #nginx #loadbalancing #reverseproxy… | kuldeep yadav](https://images.openai.com/static-rsc-4/gzL88F3Uo-scR3JcW-ZJkjEyvjX8p-F3YGlMjcN6PJZeAsrj8URX0-x_hyeDQqo_Smuuu1Muz4y8qCwxxuROFkzfx13SRNo-WlhOmcpYAbRC3Ei_YaYkSpxeaPcKBwJkhlnsy0b5-y6UvSIk7OWwYrxssosbSDSP6Y_b-fC0hnQ?purpose=inline)

![在ubuntu系统部署Nginx-腾讯云开发者社区-腾讯云](https://images.openai.com/static-rsc-4/T5pp5gFDsIIBJRV7C6Hort1EXGLcFiBWQ3UAIWRyMABrAAix2NG16KXHSafJQeIeMCBv0sI3gxTyQPMOuMy2msbzLwoxwS_RuJT7pp-l8WDjCJ4afA-hSRLvWWr_26cE_5uu7VhQWnGaxea_BtOLBs0vhN4Ah7fSKfxxCCQPn4o?purpose=inline)

6

Know:

- Round Robin.

- Least Connections.

- Health Checks.

- Reverse Proxy.

## Horizontal Scaling

![Fundamentals of Scaling Systems](https://images.openai.com/static-rsc-4/J-pEaYY8lranfqg2hwAdDOu6EaCPRC2crcy3RNn_s1SaHcrKxe9-Vrwd6d7MJzFJEeQ2RwDfQuLPq9SkOgmN3X_S-75p9QFZ9W7f-MYqD-bgWJE0MK5Jf3vNBznTLl9ymncf696Ggy46AYPaojVcbt6KJCxbAxbyaJooNhf-yTI?purpose=inline)

![Difference between Horizontal Scalability vs Vertical Scaling in System Design and Microservices | by Soma | Javarevisited | Medium](https://images.openai.com/static-rsc-4/czZRhQpM8ntPlr5DSEg08nIh8TrZyKYFTR2sGpt7JIiVApO1v71JTaWizsvKvfN1UrjppCGiy_GnTOFUQFJz3UnJO8J7HwLfZAZCA65JM517UOKHeilwKv75MKwcR89C1EaI7oDf2SPBNMNXv5N9xfPvOExbeXtoewpB_-Fj0BM?purpose=inline)

![Scaling Microservices on Kubernetes - The New Stack](https://images.openai.com/static-rsc-4/3D7LJq1XCrZVPcs-zkSEKBJNla57V8G2-5UbVvGRZutljXhG6IX0x9aqoQZY15hhVWWIGjMOWqYNVDfeDijKVuWB3cdt4BnTNIB3yiqhwlJkCnINEpd2A2g2AwD2LbuHtpnK4bjvyRgft08Z2DhOuh_zMYZocHxeUhBg3CdA0xY?purpose=inline)

6

Know:

- Vertical Scaling.

- Horizontal Scaling.

- Auto Scaling.

## CDN

![Diving into Cloudfront | Serverless Guru](https://images.openai.com/static-rsc-4/dR4Do_bVsN7GiGSnr61b9Qs3LuIzeP-dg3_FCrynbaZo6GUYKbr94sV0AFAI_bSX-u5wM6jMNyzflpLjpr8-QPPSPR6ttvA34nw3Cs_in4q2rY1WtWoNWoV1yY-qr0JYLJOblvsj4YmsN7BZEwP0JrBB8IcfaFJYM625_oo-OqQ?purpose=inline)

![Introduction to Amazon Cloudfront and its architecture | o7planning.org](https://images.openai.com/static-rsc-4/vgcj1tkzxI5dG5QyBWPslHol2r6RyYyZFlvXPs5JtInFUdzOPFs6Grx5-qpn3D5rxBgr3SM_Hd1nwhmTIBDl_p6RJomEoE7AqcYQvFt-sovaVyWN6P79T3GsahgugogKCCVlMCsfyUhQoxrbgDm5TgpvDUODHenzXOsXViMAf-I?purpose=inline)

![CDN - binbash Leverage™](https://images.openai.com/static-rsc-4/l63c-eC48ocODTaqhZofagLkPLuAnaBIiuinjO5nIHXBpaWe6tyqLC7RUu4absehZtpK9wlSa6Kvmh3DjBwlBzE9pNwNCrr3J3AWYdwCs-yEnLmf94vIfVdlnF4_w-X4CauOdtZ_UqDViYYorXVJIjgecJXQB4xcL3a-eHBC5f0?purpose=inline)

4

Know:

- Cache images.

- Static assets.

- API caching.

# Phase 11 — Docker

![Docker Made Simple: A Beginner’s Guide to Docker. | by DevOps.uz | Devops & AI Türkiye☁️ 🐧 🐳 ☸️ | Medium](https://images.openai.com/static-rsc-4/Yd8JIKs4H1U8v-7euCipwHCGyIkPjtJYk8T5PH-_gwX0Jxi8jukxeD-CmZrin2d-0nGFMeiA16NsdQ1CEJyXxObK6ajXWx1oaNAhpFhM5v3xjY8lGoGkL8jxaxvvdH0hLKLu4Ez4rx4Aj0pl0iiNVGRJVBYmhotD6LXUfy7oh1c?purpose=inline)

![Advanced Docker Networking. Master Docker networking with bridge… | by Adekola Olawale | Medium](https://images.openai.com/static-rsc-4/-3XQAQoPfSnPC6svNzmyK2rSwkxKhhpAvnh81_wVOzspr2gGxLGvFfKhovGNk1Lnq_dg8RVUCL3YxSXI21tMe6kzYiXIyHOz6ACM1CXH1BNTrf6ieHv1flbGgoBEsY4Q9OMwYMDcInQDESn68Oguhva8YF4j9w8HqhlvbFhOiMA?purpose=inline)

![A Docker 101 and in what ways Docker is used in the industry. | by Shay Writes | Medium](https://images.openai.com/static-rsc-4/ellLO0xXc5Jf8vRvh3_dfAKvqA9T_Wb8FmGztaYA7qeAtgmqLoKKxKNt6fUe6QGeEwLApy25XRREWcEalF9QtsKXhL4gqBL5WL2r4_P4f_MHggGRQ6Xg02_5ISTvWgb_IPIi1O2k3DqAnwaolDNPvH78BDIOmxJAWcqSOVB2His?purpose=inline)

6

Know everything here.

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Docker</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Know</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Image vs Container</td><td data-d-component="table-cell" data-d-valign="start">Difference.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Dockerfile</td><td data-d-component="table-cell" data-d-valign="start">Multi-stage build.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Volumes</td><td data-d-component="table-cell" data-d-valign="start">Persistent storage.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Networks</td><td data-d-component="table-cell" data-d-valign="start">Bridge, Host.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Compose</td><td data-d-component="table-cell" data-d-valign="start">Multi-container app.</td></tr></tbody></table>

You already asked about local AWS + Docker.

# Phase 12 — AWS Basics (Enough for Interviews)

![AWS Case Study - Ajungnetworks, Inc. (Ajungdang) | SmileShark](https://images.openai.com/static-rsc-4/DVE5o7qyYISLPgPvEOiL_JAEl3r8zR99tRr21xJQKBodMOzAc_bXNsKVf3prGLelxSz5Y2zVSLR43z5fgPVMJHMYyFM7MiqPG422I1wFeWEBy3BwnHnlsTps9tktx1KDXEGf8rno99DqlGZkBbTFIXfUoXObD_t1TQMFnql6GIE?purpose=inline)

![AWS Networking Basics. A practical guide to VPCs, subnets, and… | by Arsalan Anwer | Medium](https://images.openai.com/static-rsc-4/YMc4eXBurjp0tRWZFdrPk_T0cGdC4ivJcZGe0AP8xdZKvVrnPCnLMNxHCgtOxpTp4fA_czFyp0EPbZCk89GaU8mFVbWquaWAQ1b_AwSgLGxTXGBQnnCrZdqa37Bpxn4LBGXRMSJl0mTsVDQN4pbDzXsuGuTZ6DQIMCfhmTWs1EI?purpose=inline)

![ENGINEER BLOG](https://images.openai.com/static-rsc-4/OxLdkMokDvA4_U0dgd5CgA41iLIB-mFE1u3o_kbWHeJxzfF7GrZGh3rq60nWK8T07Rs6cuZL5s_VosgbT_drZXiS32CsDJKSOH5c6XUq0XwxYiKZDeI1i2bPA3daYirbxitigLkgpxxDaVp5HpSfpiNi6oDpszV2gV2-Zh8geN4?purpose=inline)

6

Know the services, not certifications.

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Service</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Why Used</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">EC2</td><td data-d-component="table-cell" data-d-valign="start">Virtual machines.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">S3</td><td data-d-component="table-cell" data-d-valign="start">Object storage.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">ALB</td><td data-d-component="table-cell" data-d-valign="start">Load balancing.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CloudFront</td><td data-d-component="table-cell" data-d-valign="start">CDN.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">RDS</td><td data-d-component="table-cell" data-d-valign="start">Managed Postgres.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">ElastiCache</td><td data-d-component="table-cell" data-d-valign="start">Managed Redis.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">ECS</td><td data-d-component="table-cell" data-d-valign="start">Docker deployment.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">IAM</td><td data-d-component="table-cell" data-d-valign="start">Permissions.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Secrets Manager</td><td data-d-component="table-cell" data-d-valign="start">Environment secrets.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">CloudWatch</td><td data-d-component="table-cell" data-d-valign="start">Logs &amp; metrics.</td></tr></tbody></table>

# Phase 13 — Testing

![Testing with Jest in TypeScript and Node.js for Beginners](https://images.openai.com/static-rsc-4/q91l3hmJnVTAQ_cCZIOFd0Ox_hw9I5_RaEioqYLmRWv7yDbgJe-56drg4rVrz00OhdE9wyNthCjF9cxm1g5ngQNgZhJBsLwq-e9er3Ei9Sv0h1nZZSA5QAteE-4LQd76drNvvTMPf2VubktbQ10MuWpl_8x9a9BPfCB45f6VKxM?purpose=inline)

![Supertest Jest: Testing NodeJs/Express API with Jest and Supertest - DEV Community](https://images.openai.com/static-rsc-4/DJevxfxsiuo5GsQ7ArJ0uN9jUXoNmbTAXbTvBqlr1F97sE9MMyde0Cy6FSPzqzEE_8KQwYq6bM3TZq9ow106kPXThf2qJYdpgB68PM67aGqEERsNXZc9yMZkiQkqLozMqCqEvoghkWiCzFmZFy5-lkvk05WRT_xKkDc58o6W1tE?purpose=inline)

![How to Test Your Express API with SuperTest — Abdurrahman Fadhil](https://images.openai.com/static-rsc-4/WgKxgMLQRJ9v_yezgjI0nEFOO09mB1vUN1BbWKumiIvHARrBIGhC206ol15R3BlIInmFCuJ7lME5mJ_C6iimLHIuq0Nbdz80vID73ZhtzI2FtcYbjWp8A43uOs1rfvB1w4WllgvXqQCOyZyU_LJ2l7YmLabUKncVNUF66uTP2ys?purpose=inline)

5

Know:

- Unit Tests.

- Integration Tests.

- API Tests.

- Mocking.

- Supertest.

- Jest lifecycle.

Questions:

- Mock MongoDB.

- Test authentication middleware.

# Phase 14 — Observability

![Loki vs Prometheus - Differences, Use Cases, and Alternatives | SigNoz](https://images.openai.com/static-rsc-4/TuJv_6Xki___Imnr-jfXaZVyCJqYpxZaE4zCXLhUaexgK51e0_N-yUYLYCzgE2IzisSMTS4dqPx35NDNmK8EuuStkaiCcH9VfAAuzr7AfTiuh8kgbhvlVhYrkQa_Mt5g-VZyz26tJmouPAMkXmcXrZssJosxBCYCVsZHJ02rReo?purpose=inline)

![Building Observability in Go: Traces with OpenTelemetry and Jaeger | by Arya Dyas | Medium](https://images.openai.com/static-rsc-4/vhs2pTB5l4OvdcqJfCRPx3e6eMQrhk4NW78DQDFTIZ4IBZXV_ttFYKgI4mlNwazrNqOM6JLmztMUuSUN42gbG9sGH9eDWKqT-0Ahgbsj6BFX_rNS_HxygOIOep8CKU_48gpVELqa3UhMXyl-Xx6JrogKFvqQvq7MOXetoi8H7T0?purpose=inline)

![Creating a Lightweight Logging Layer That Doesn’t Suck | by Tanveesh Singh | Medium](https://images.openai.com/static-rsc-4/P6kAyEO5ONyTUATJVufQ9n41ZaQD7IIhFs4lBJiRueyOtftYuApauhIm-mxM3NZgnkjH83j7-X0bjIG75B7_3AIku159GwvMei_ezoEk3SAFg_phlGzdaEzJJW-yza2gc_cfXB6YiDX5lLf14P46xFQXPuRWrAYNl6YDyknTMfY?purpose=inline)

5

Know:

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Purpose</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Winston/Pino</td><td data-d-component="table-cell" data-d-valign="start">Structured logs.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Morgan</td><td data-d-component="table-cell" data-d-valign="start">HTTP logging.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Health Checks</td><td data-d-component="table-cell" data-d-valign="start">Readiness/Liveness.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Metrics</td><td data-d-component="table-cell" data-d-valign="start">CPU, Memory, Latency.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Monitoring</td><td data-d-component="table-cell" data-d-valign="start">CloudWatch / Grafana.</td></tr></tbody></table>

# Phase 15 — High-Level Backend Design

This is where your LLD knowledge connects.

## Design a Scalable Backend

![Building a Scalable Backend Architecture with NestJS, Kafka, and PostgreSQL - DEV Community](https://images.openai.com/static-rsc-4/i2uET-Ew8N2sdQiE2ctDWm-HJEmgJah3jNUXOcWFjil0BwHz6CgPhVMWQazZfo7fMJeqyhL4V4xfOhtO2lKS0-3xmBbc_AVrwrwjo9l7A5FsuLnBs6JqcDip4glMvGwtxFvsBFFaMyYzHzqzqunmjjHLf4lChj8J9Yuwgx_fS8E?purpose=inline)

![AWS ElastiCache Redisクラスタでセッションサーバを作る│システムガーディアン株式会社](https://images.openai.com/static-rsc-4/RXw_WhOG0oMo8YrViNQVat2rkHb0s8j1n8HU0gdCXiemAhl7VbUGW9zrRXqnlfP7scawnz38Slf9n1tdt2E3q-cKTWz4gl9UeRtID7y6I46uluM8QkQ0mHiKqXzFiW_nzbWz9MyhZC6fHa-kUcwf2X04n6WDevkJmYj1rgB0Dhs?purpose=inline)

![drawio-skill — Hermes Agent Skills & Skill Registries | Hermes Atlas](https://images.openai.com/static-rsc-4/kfLJgLzwtSpTmZplS_zRu_eXHtxHr8hfSXdddwyjlCSymSkqSmSy_0uDkY8A1DDnPPUJ7jEb0-tdRJ6b4tEHVkKixYURD-Bse_BT5O4jxWehBK6s7SizXnzmMTjK0XGOPD-5VOnIhThUwxvv8k19tqK27Bdxkf8iXvQynfBPbYs?purpose=inline)

5

You asked me this yesterday.

Know how to explain:

1. Client

2. CDN

3. Load Balancer

4. API Gateway

5. Authentication Service

6. User Service

7. Billing Service

8. Notification Service

9. Redis

10. Database

11. Queue

12. S3

13. Monitoring

### Expected Interview Problems

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Design</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topics Used</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">URL Shortener</td><td data-d-component="table-cell" data-d-valign="start">DB, Cache, Hashing.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Chat App</td><td data-d-component="table-cell" data-d-valign="start">WebSockets, Redis Pub/Sub.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Notification System</td><td data-d-component="table-cell" data-d-valign="start">Queue, Retry.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Billing System</td><td data-d-component="table-cell" data-d-valign="start">Stripe, Webhooks, Idempotency.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">File Upload Service</td><td data-d-component="table-cell" data-d-valign="start">S3, CDN, Signed URLs.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">E-commerce Backend</td><td data-d-component="table-cell" data-d-valign="start">Inventory, Transactions, Cache.</td></tr></tbody></table>

# Phase 16 — LLD Backend Questions

You've completed SOLID + GoF patterns.

Now backend LLD questions include:

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Question</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Patterns</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Payment Gateway</td><td data-d-component="table-cell" data-d-valign="start">Strategy, Factory.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Notification System</td><td data-d-component="table-cell" data-d-valign="start">Observer.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Logging Library</td><td data-d-component="table-cell" data-d-valign="start">Singleton, Decorator.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Cache Layer</td><td data-d-component="table-cell" data-d-valign="start">Proxy.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">File Parser</td><td data-d-component="table-cell" data-d-valign="start">Chain of Responsibility.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Order Processing</td><td data-d-component="table-cell" data-d-valign="start">State, Command.</td></tr></tbody></table>

# Phase 17 — Real Backend Scenarios (Most Important)

These are asked because you have experience.

## Scenario-Based Questions

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Scenario</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Expected Discussion</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">API became slow.</td><td data-d-component="table-cell" data-d-valign="start">Logs → Indexes → Redis → Profiling.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Duplicate Stripe payment.</td><td data-d-component="table-cell" data-d-valign="start">Idempotency keys.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Millions of users logging in.</td><td data-d-component="table-cell" data-d-valign="start">Redis sessions + JWT + ALB.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Upload huge file.</td><td data-d-component="table-cell" data-d-valign="start">Streams + Multipart upload.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Cache inconsistency.</td><td data-d-component="table-cell" data-d-valign="start">Cache invalidation strategies.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Webhook received twice.</td><td data-d-component="table-cell" data-d-valign="start">Event IDs, retries.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Database lock.</td><td data-d-component="table-cell" data-d-valign="start">Transactions, optimistic locking.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Service crashes under traffic.</td><td data-d-component="table-cell" data-d-valign="start">Autoscaling, health checks, load balancer.</td></tr></tbody></table>

# Backend Interview Cheat Sheet (Priority Order)

Node.js Event Loop, Streams, Buffers, Worker Threads

Express Middleware, Error Handling, Validation

REST API Design (Pagination, Versioning, Idempotency)

JWT, OAuth, Cookies, Sessions

Security (CORS, CSRF, XSS, Helmet, Rate Limiting)

MongoDB (Indexes, Aggregation, Transactions, Explain Plan)

Redis (Caching, TTL, Pub/Sub, Distributed Lock)

Queues, Background Jobs, Webhooks, Cron Jobs

File Uploads (S3, Azure Blob, Signed URLs, Streams)

Docker (Images, Containers, Volumes, Compose, Networking)

AWS Basics (EC2, S3, ALB, ECS, RDS, Redis, IAM)

Testing (Jest, Supertest, Integration Testing)

Logging, Monitoring, Health Checks

Scalable Backend HLD (Load Balancer → Redis → DB → Queue → Storage)

Backend LLD (Payment, Notification, Cache, Order Processing)

# The roadmap I'd make specifically for you (Ganesh)

Based on everything we've worked on together (LLD, Stripe Billing, DevOS, AWS roadmap, MERN, Payload.js), I'd prioritize like this:

Priority

## Week 1 — Must master

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-has-width="" data-d-valign="start" style="width: 44%;"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Why</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Node.js Internals</td><td data-d-component="table-cell" data-d-valign="start">Asked in almost every backend interview.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">MongoDB Deep Dive</td><td data-d-component="table-cell" data-d-valign="start">Matches your MERN experience.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Redis</td><td data-d-component="table-cell" data-d-valign="start">Frequently asked for scaling discussions.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Authentication + Security</td><td data-d-component="table-cell" data-d-valign="start">JWT/OAuth/CORS questions are extremely common.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">REST API Design</td><td data-d-component="table-cell" data-d-valign="start">Almost every practical interview includes this.</td></tr></tbody></table>

Priority

## Week 2 — Production Backend

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-has-width="" data-d-valign="start" style="width: 44%;"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Topic</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Why</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Docker</td><td data-d-component="table-cell" data-d-valign="start">Expected for startups and remote jobs.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">AWS Deployment Basics</td><td data-d-component="table-cell" data-d-valign="start">EC2, ECS, ALB, S3 are common interview topics.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Queues &amp; Background Jobs</td><td data-d-component="table-cell" data-d-valign="start">BullMQ, Webhooks, Retry logic.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Logging &amp; Monitoring</td><td data-d-component="table-cell" data-d-valign="start">Shows production engineering experience.</td></tr></tbody></table>

Priority

## Week 3 — Interview Practice

<table class="_6IUVGW_Table" data-d-column-sizing="equal" data-d-dividers="" style="table-layout: fixed;"><tbody><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-has-width="" data-d-valign="start" style="width: 44%;"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Practice</span></p></td><td data-d-component="table-cell" data-d-valign="start"><p class="w6asjq_TextBase _85PZeG_Text" data-d-component="text"><span class="w6asjq_TextBase _85PZeG_Text" data-d-component="text" data-d-default-strong="" data-d-inline="">Focus</span></p></td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Design URL Shortener</td><td data-d-component="table-cell" data-d-valign="start">HLD + Redis + MongoDB.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Design Chat Backend</td><td data-d-component="table-cell" data-d-valign="start">WebSockets + Redis Pub/Sub.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Design Billing Service</td><td data-d-component="table-cell" data-d-valign="start">Stripe experience from your project.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Design Notification Service</td><td data-d-component="table-cell" data-d-valign="start">Queue + Retry + Email/SMS.</td></tr><tr data-d-component="table-row"><td data-d-component="table-cell" data-d-valign="start">Mock Backend Interviews</td><td data-d-component="table-cell" data-d-valign="start">40–60 production-oriented questions.</td></tr></tbody></table>
