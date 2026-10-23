# Next.js App Router — Complete Learning Course

Master modern Next.js using the App Router. This course covers everything from React Server Components and file-based routing to data fetching, server actions, and production deployment.

---

## Course Structure

```text
NextJS/
├── Phase-01-Fundamentals-and-Setup/            → Next.js overview, installation, project structure
├── Phase-02-App-Router-and-File-Based-Routing/ → Pages, Layouts, navigation, dynamic routes
├── Phase-03-Server-and-Client-Components/      → RSCs vs Client Components, rendering environments
├── Phase-04-Data-Fetching-and-Rendering-Strategies/ → Fetching data, SSR, SSG, ISR
├── Phase-05-Route-Handlers-and-API-Routes/     → Creating backend API endpoints
├── Phase-06-Server-Actions-and-Forms/          → Data mutations, form handling, optimistic UI
├── Phase-07-Middleware-and-Authentication/     → Edge middleware, auth patterns, route protection
├── Phase-08-Styling-and-UI/                    → Tailwind CSS, CSS Modules, Font/Image optimization
├── Phase-09-Caching-and-Performance/           → Next.js caching layers, revalidation strategies
├── Phase-10-Error-Handling-and-Debugging/      → Error boundaries, 404s, global errors
├── Phase-11-Internationalization-and-SEO/      → i18n routing, metadata, sitemaps
├── Phase-12-Deployment-and-Production/         → Vercel, Docker self-hosting, CI/CD
├── Projects/                                   → Beginner → Advanced hands-on projects
└── Quick-Reference/                            → Cheatsheet + 50 interview Q&A
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals & Setup | Beginner | 2 days |
| 02 | App Router & Routing | Beginner | 3 days |
| 03 | Server vs Client Components | Beginner | 2 days |
| 04 | Data Fetching & Rendering | Intermediate | 4 days |
| 05 | Route Handlers | Intermediate | 2 days |
| 06 | Server Actions & Forms | Intermediate | 3 days |
| 07 | Middleware & Auth | Advanced | 3 days |
| 08 | Styling & UI Optimization | Intermediate | 2 days |
| 09 | Caching & Performance | Advanced | 3 days |
| 10 | Error Handling | Intermediate | 2 days |
| 11 | Internationalization & SEO | Advanced | 3 days |
| 12 | Deployment & Production | Advanced | 2 days |

**Total estimated time: 6-8 weeks**

---

## Prerequisites

- Solid understanding of modern JavaScript (ES6+).
- Strong foundation in React (Hooks, Context, JSX).
- Basic understanding of web servers and HTTP methods.
- Familiarity with Tailwind CSS (optional, but heavily used in examples).

---

## The Next.js App Router Mental Model

In traditional React (SPAs), the entire application is bundled into JavaScript and sent to the browser, which then fetches data and renders the UI.

In Next.js (App Router):
1. The Server does the heavy lifting: fetching data, connecting to databases, and rendering UI components into static HTML.
2. Only the necessary, interactive parts (Client Components) are shipped to the browser as JavaScript.
3. This hybrid approach (Server Components + Client Components) results in faster initial page loads, better SEO, and smaller JavaScript bundles.

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Personal Portfolio | Beginner | Static site focusing on layouts and routing |
| Markdown Blog | Intermediate | Dynamic routing and reading local `fs` files |
| E-Commerce Storefront | Advanced | External data fetching, Suspense, Error handling |
| Full-Stack Task Manager | Expert | DB, Auth, Server Actions, Optimistic UI |

---

## Quick Commands

```bash
npx create-next-app@latest          # Scaffold a new project
npm run dev                         # Start the development server (localhost:3000)
npm run build                       # Create an optimized production build
npm run start                       # Start the production server
```
