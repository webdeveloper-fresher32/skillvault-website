# Error Boundaries and `error.js`

In the Next.js App Router, the `error.js` file convention allows you to gracefully handle unexpected runtime errors in nested routes. 

Under the hood, `error.js` automatically creates a **React Error Boundary** that wraps a nested child segment or `page.js` component. When an error is thrown inside that boundary, the error is caught, and the fallback UI defined in `error.js` is displayed, preventing the rest of the application from crashing.

## How `error.js` Works

When you create an `error.js` file inside a route segment, Next.js automatically wraps that segment's `page.js` and any nested layout components in a React Error Boundary.

### Example Directory Structure

```text
app/
├── layout.tsx
├── error.tsx      ← Handles errors in page.tsx or nested routes
└── page.tsx
```

### Basic `error.js` Implementation

An `error.js` component **must be a Client Component** because it needs to catch errors that can occur during both client-side rendering and server-side rendering (which are surfaced to the client).

```tsx
// app/dashboard/error.tsx
'use client' // Error components must be Client Components

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  )
}
```

### Props Passed to `error.js`

1. **`error`**: An instance of the native JavaScript `Error` object. In production, error messages are often stripped for security, so a `digest` hash is provided to match the error with server logs.
2. **`reset`**: A function to reset the error boundary. When executed, the function will try to re-render the Error boundary's contents. If successful, the fallback error component is replaced with the result of the render.

## Recovering From Errors

Sometimes, errors are transient (e.g., a temporary network failure). The `reset()` function allows users to retry the operation without reloading the entire page.

```tsx
<button onClick={() => reset()}>Try again</button>
```

When `reset()` is called:
1. The error boundary attempts to re-render its contents.
2. If the re-render is successful, the error fallback is replaced with the new React tree.
3. If it fails again, the error UI remains.

## Nested Routes and Error Bubbling

Errors bubble up to the nearest parent error boundary. This means:
- An `error.js` file will catch errors in all nested child segments.
- If a route segment does not have an `error.js` file, the error will bubble up to the parent segment's `error.js`.
- By strategically placing `error.js` files, you can create granular error UIs. A deeply nested error might only replace a specific part of the screen, leaving the rest of the application (like navigation headers and sidebars) interactive.

## Layouts and `error.js`

An `error.js` boundary **does not** catch errors thrown in the `layout.js` of the **same segment**.

Why? Because the error boundary wraps *inside* the layout. 

```text
<Layout>
  <ErrorBoundary fallback={<Error />}>
    <Page />
  </ErrorBoundary>
</Layout>
```

If you need to catch errors in a specific layout, you must place an `error.js` file in the **parent** segment's directory.

## Summary

- Use `error.js` to create granular error handling UIs.
- `error.js` must always be a Client Component (`'use client'`).
- The `reset` function allows users to recover from transient errors.
- Errors bubble up to the nearest parent boundary.
- `error.js` does not catch errors in its sibling `layout.js` file.
