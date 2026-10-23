# Not Found and Global Error

While `error.js` handles unexpected runtime exceptions, Next.js provides two additional conventions for specific error scenarios: `not-found.js` for 404 errors, and `global-error.js` for catastrophic errors in the root layout.

## The `not-found.js` File

The `not-found.js` file is used to render a custom UI when a route cannot be found (HTTP 404).

It is triggered in two ways:
1. When a user visits a URL that does not match any route in the `app` directory.
2. When the `notFound()` function is explicitly called within a component, route handler, or server action.

### Example Implementation

```tsx
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

### The `notFound()` Function

You can programmatically trigger the `not-found.js` UI by calling the `notFound()` function. This is especially useful when fetching data.

```tsx
// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getUser } from '@/lib/api'

export default async function UserProfile({ params }: { params: { id: string } }) {
  const user = await getUser(params.id)

  if (!user) {
    // This will halt execution and render the closest not-found.js
    notFound()
  }

  return (
    <div>
      <h1>{user.name}</h1>
    </div>
  )
}
```

### Scope of `not-found.js`

Like `error.js`, `not-found.js` files bubble up.
- If you call `notFound()` in `/app/dashboard/users/page.js`, Next.js will look for `/app/dashboard/users/not-found.js`.
- If it doesn't exist, it will look in `/app/dashboard/not-found.js`, and so on, up to the root `/app/not-found.js`.

---

## The `global-error.js` File

As discussed in the previous lesson, an `error.js` file **does not** catch errors thrown in the `layout.js` of the same segment.

This presents a problem for the **Root Layout** (`app/layout.js`). If an error is thrown in the root layout, there is no parent `error.js` to catch it.

To handle errors in the root layout or root template, you use the `global-error.js` file, which must be placed in the root `app` directory.

### Example Implementation

Because `global-error.js` wraps the entire application, its component **must** include its own `<html>` and `<body>` tags. It replaces the root layout entirely when an error occurs.

```tsx
// app/global-error.tsx
'use client' // Global error must be a Client Component

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went fundamentally wrong!</h2>
        <p>A critical error occurred in the root layout.</p>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
```

### When to use `global-error.js`

`global-error.js` is a last resort. It is only triggered if an error occurs in the root `layout.js` or `template.js`. Most errors should be caught by route-specific `error.js` files or a root-level `app/error.js` (which catches errors in the root `page.js` but *not* the root layout).

## Summary

- Use `not-found.js` for 404 UI.
- Trigger it programmatically using `notFound()` from `next/navigation` when data is missing.
- Use `global-error.js` exclusively to catch catastrophic errors originating in the root layout.
- `global-error.js` must contain its own `<html>` and `<body>` tags.
