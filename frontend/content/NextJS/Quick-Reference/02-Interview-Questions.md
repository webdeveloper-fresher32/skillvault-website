# Next.js Interview Questions & Answers

This document contains 50 of the most common Next.js interview questions, covering both the Pages Router (legacy) and the modern App Router.

## Fundamentals

**1. What is Next.js and why use it over pure React?**
Next.js is a React framework that provides built-in solutions for routing, server-side rendering (SSR), static site generation (SSG), and API routes, leading to better SEO and performance out of the box compared to a standard Create React App (SPA).

**2. Explain the difference between the Pages Router and the App Router.**
The Pages Router (legacy) uses the `pages/` directory where each file becomes a route. The App Router (modern) uses the `app/` directory, introduces Server Components by default, uses nested folders for routing, and introduces concepts like Layouts, Error boundaries, and Suspense.

**3. What is a Server Component?**
A React component that renders exclusively on the server. It does not send its JavaScript to the client, reducing bundle size. It can directly access backend resources like databases securely.

**4. What is a Client Component?**
A traditional React component that is pre-rendered on the server and then hydrated on the client. It supports interactivity (`onClick`), state (`useState`), and browser APIs. It is declared using the `'use client'` directive.

**5. When should you use a Client Component?**
When you need user interactivity, state management, lifecycle hooks (`useEffect`), or access to browser-specific APIs (like `window` or `localStorage`).

**6. Can you import a Server Component into a Client Component?**
No, you cannot directly import a Server Component into a Client Component. However, you can pass a Server Component as a `children` prop to a Client Component.

**7. How does routing work in the App Router?**
It uses a file-system based router where folders define routes and `page.js` files define the UI for that route.

**8. What is the purpose of `layout.js`?**
It defines UI that is shared across multiple pages (like a navigation bar). Crucially, layouts preserve state and do not re-render when a user navigates between sibling pages.

**9. What is the difference between `layout.js` and `template.js`?**
Both share UI across routes, but `layout.js` preserves state and does not remount on navigation, whereas `template.js` creates a new instance (remounts) for each of its children on navigation.

**10. How do you create a dynamic route?**
By wrapping a folder name in square brackets, e.g., `app/blog/[slug]/page.js`.

## Data Fetching

**11. How do you fetch data in a Server Component?**
You can use the native `fetch` API directly, or call a database ORM (like Prisma) directly inside the async Server Component.

**12. Explain `cache: 'force-cache'` in Next.js.**
It tells Next.js to cache the result of the fetch request indefinitely. This is the default behavior in the App Router, effectively making the page Static.

**13. Explain `cache: 'no-store'` in Next.js.**
It tells Next.js to bypass the cache and fetch fresh data on every request. This makes the route Dynamic (Server-Side Rendered).

**14. What is Incremental Static Regeneration (ISR)?**
It allows you to update static pages after you've built your site without rebuilding the entire application. It's configured using `{ next: { revalidate: 60 } }` (revalidate every 60 seconds).

**15. How do you implement on-demand revalidation?**
By using `revalidatePath('/path')` or tagging fetch requests (`{ next: { tags: ['collection'] } }`) and using `revalidateTag('collection')` in a Server Action or Route Handler.

**16. What is a Route Handler?**
The App Router equivalent of API Routes. Defined in `route.js`, it exports functions like `GET`, `POST`, `PUT`, `DELETE` to handle HTTP requests.

**17. Can `route.js` and `page.js` exist in the same directory?**
No, because they would both try to resolve to the exact same URL path, causing a routing conflict.

**18. What is the `generateStaticParams` function?**
Used in combination with dynamic routes, it returns a list of parameters to statically generate pages at build time (e.g., generating all blog posts based on their slugs).

**19. How do you fetch data in Client Components?**
You can use React's `useEffect` with `fetch`, or preferrably a data-fetching library like SWR or React Query.

**20. What is React Suspense and how does Next.js use it?**
Suspense allows you to defer rendering part of your application until a condition is met (like data loading). Next.js uses `loading.js` to automatically wrap route segments in a Suspense boundary.

## Mutations & Server Actions

**21. What are Server Actions?**
Asynchronous functions executed on the server, typically triggered by form submissions or client-side interactions, eliminating the need to manually build API endpoints for mutations.

**22. How do you declare a Server Action?**
By placing the `'use server'` directive at the top of an async function, or at the top of a file to make all exports Server Actions.

**23. How do you update the UI after a Server Action mutates data?**
By calling `revalidatePath()` or `revalidateTag()` inside the Server Action to purge the Next.js cache and trigger a re-render.

**24. What is `useFormState`?**
A React hook used in Client Components to read the result (success/error messages) of a Server Action after it executes.

**25. What is `useFormStatus`?**
A React hook that provides status information (like `pending`) of the parent `<form>`, useful for disabling submit buttons while a Server Action is running.

**26. What is optimistic UI and how is it implemented?**
Updating the UI immediately as if a mutation succeeded before the server confirms it. Implemented using the `useOptimistic` hook.

## Architecture & Conventions

**27. What is `error.js`?**
A file convention that creates a React Error Boundary to catch runtime errors in nested routes and display fallback UI. It must be a Client Component.

**28. Does `error.js` catch errors in its sibling `layout.js`?**
No, because the error boundary wraps *inside* the layout. Errors in a layout bubble up to the parent segment's `error.js`.

**29. What is `global-error.js`?**
Placed in the root `app` directory, it catches errors thrown in the root `layout.js`. It must contain its own `<html>` and `<body>` tags.

**30. What is `not-found.js`?**
UI rendered when a route doesn't exist or when the `notFound()` function is explicitly called.

**31. How do you group routes logically without affecting the URL path?**
Using Route Groups, created by wrapping a folder name in parentheses, e.g., `app/(marketing)/about/page.js` maps to `/about`.

**32. What are Parallel Routes?**
Allowing simultaneous or conditional rendering of multiple pages in the same layout. Defined using the `@folder` convention (named slots).

**33. What are Intercepting Routes?**
Allowing you to load a route from another part of your application within the current layout (e.g., expanding a photo in a modal when clicked from a feed, but rendering a full page on hard refresh). Defined using `(..)folder`.

## Styling & Optimization

**34. How does the Next.js `<Image />` component optimize images?**
It automatically serves correctly sized images, converts them to modern formats like WebP/AVIF, lazy loads them, and prevents Cumulative Layout Shift (CLS) by requiring width/height.

**35. How do you load local fonts in Next.js?**
Using `next/font/local` to load fonts efficiently without layout shift.

**36. How do you use Google Fonts in Next.js?**
Using `next/font/google`. Next.js downloads the font files at build time and self-hosts them, preventing external network requests during page load.

**37. How does the `<Script />` component work?**
It optimizes loading third-party scripts (like analytics). You can use the `strategy` prop (`beforeInteractive`, `afterInteractive`, `lazyOnload`) to control when the script loads.

**38. Can you use Tailwind CSS with Next.js?**
Yes, it is highly recommended and often the default choice when initializing a new project.

**39. Can you use CSS Modules in Next.js?**
Yes, Next.js has built-in support for CSS Modules (naming files `*.module.css`).

**40. What is CSS-in-JS and does it work in Server Components?**
Libraries like Styled Components or Emotion. They generally require runtime JavaScript, so they only work in Client Components, not Server Components (unless they support build-time extraction).

## SEO & Advanced

**41. How do you add metadata (title, description) in the App Router?**
By exporting a static `metadata` object or a dynamic `generateMetadata` function from a `layout.js` or `page.js`.

**42. How does Next.js deduplicate fetch requests?**
Next.js automatically memoizes `fetch` requests with the same URL and options that occur during the same render pass (e.g., calling fetch in `generateMetadata` and again in `page.js`).

**43. What is Next.js Middleware?**
Code that runs before a request is completed. Useful for authentication, redirects, rewrites, and language negotiation. Defined in `middleware.js` at the root.

**44. Where does Middleware execute?**
Middleware executes on the Edge (e.g., Vercel Edge Network), meaning it has ultra-low latency but cannot use all Node.js APIs.

**45. How do you handle Internationalization (i18n) in the App Router?**
Typically by using Middleware to detect the locale and redirect, and using dynamic route segments `[lang]` to serve localized content.

**46. What is the difference between `next build` and `next export`?**
`next build` builds a standard Next.js app (requiring a Node server). `next export` (now configured via `output: 'export'` in next.config.js) generates purely static HTML/CSS/JS files that can be hosted on any static file server (like S3), but disables features that require a server (like dynamic API routes or image optimization).

**47. What is Vercel?**
The cloud platform built by the creators of Next.js, optimized for zero-config deployment of Next.js applications, leveraging edge networks and serverless functions.

**48. How do you debug Server Components?**
By checking the terminal where the Next.js server is running (where `console.log` outputs appear) or attaching a debugger (like VS Code) to the Node.js process.

**49. What is the purpose of `next.config.js`?**
It allows you to configure Next.js advanced features, such as defining remote image domains, setting up redirects/rewrites, or enabling experimental features.

**50. What is "Streaming" in Next.js?**
Breaking down the page's HTML into smaller chunks and sending them to the client progressively. This allows the user to see parts of the page sooner while slower data (wrapped in Suspense) is still loading.
