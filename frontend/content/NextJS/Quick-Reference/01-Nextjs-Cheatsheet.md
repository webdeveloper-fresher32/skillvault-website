# Next.js App Router Cheatsheet

A quick reference guide for common patterns in the Next.js App Router.

## Routing Conventions

| File | Description |
|------|-------------|
| `layout.js` | UI shared across multiple routes. Preserves state on navigation. |
| `page.js` | The unique UI of a route. Makes the route publicly accessible. |
| `loading.js` | Fallback UI shown while `page.js` or children are loading (Suspense). |
| `not-found.js` | UI shown when `notFound()` is called or route doesn't exist (404). |
| `error.js` | Error boundary UI. Must be a Client Component. |
| `global-error.js` | Catches errors in the root `layout.js`. |
| `route.js` | API endpoint (Server-side only). |
| `template.js` | Similar to layout, but creates a new instance (no state preserved) on navigation. |
| `default.js` | Fallback UI for Parallel Routes. |

## Server vs. Client Components

### Server Components (Default)
- **Use when:** Fetching data securely, accessing backend resources, keeping large dependencies on the server, improving SEO.
- **Cannot use:** React hooks (`useState`, `useEffect`), browser APIs (`window`), event listeners (`onClick`).

### Client Components
- **Use when:** Adding interactivity (onClick, onChange), using state/lifecycle hooks, using browser-only APIs.
- **How to declare:** Add `'use client'` at the very top of the file.

## Data Fetching (Server Components)

Next.js extends the native `fetch` API with caching and revalidation options.

```typescript
// 1. Force Cache (Static - Default)
fetch('https://api.example.com/data', { cache: 'force-cache' })

// 2. No Store (Dynamic - Every Request)
fetch('https://api.example.com/data', { cache: 'no-store' })

// 3. Incremental Static Regeneration (ISR - Time based)
fetch('https://api.example.com/data', { next: { revalidate: 3600 } }) // 1 hour

// 4. On-Demand Revalidation (Tag based)
fetch('https://api.example.com/data', { next: { tags: ['collection'] } })
// In a Server Action: revalidateTag('collection')
```

## Navigation

```tsx
import Link from 'next/link'
import { useRouter } from 'next/navigation' // App Router uses next/navigation!

export default function Nav() {
  const router = useRouter()

  return (
    <>
      {/* Declarative (Prefetches by default) */}
      <Link href="/dashboard">Dashboard</Link>
      
      {/* Programmatic */}
      <button onClick={() => router.push('/dashboard')}>Go</button>
    </>
  )
}
```

## Server Actions

Server Actions allow you to run asynchronous code directly on the server, typically called from a form or button.

```tsx
// app/actions.ts
'use server'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  // ... insert into database ...
  revalidatePath('/posts') // Purge cache
}
```

```tsx
// app/components/Form.tsx
import { createPost } from '@/app/actions'

export default function Form() {
  return (
    <form action={createPost}>
      <input type="text" name="title" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Metadata

```tsx
// Static
export const metadata = {
  title: 'My Page',
  description: 'Page description',
}

// Dynamic
export async function generateMetadata({ params }) {
  const data = await getPost(params.id)
  return { title: data.title }
}
```
