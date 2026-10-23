# The Next.js Metadata API

In Next.js, you define HTML `<head>` elements (like `<title>`, `<meta name="description">`, Open Graph images) using the **Metadata API**. This replaces the need to manually inject a `<head>` tag or use the old `next/head` component.

Metadata can be defined in two ways:
1. **Static Metadata:** Exporting a `metadata` object from a `layout.js` or `page.js`.
2. **Dynamic Metadata:** Exporting a `generateMetadata` function from a `layout.js` or `page.js`.

> **Note:** Metadata can only be exported from **Server Components**.

## 1. Static Metadata

To define static metadata for a page or layout, simply export a constant named `metadata`.

```tsx
// app/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Next.js Application',
  description: 'Built with the Next.js App Router.',
  openGraph: {
    title: 'My Next.js Application',
    description: 'Built with the Next.js App Router.',
    url: 'https://my-app.com',
    siteName: 'My App',
    images: [
      {
        url: 'https://my-app.com/og.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### Title Templates

If you define a title object in a layout, you can create a template so that child pages automatically inherit the site name.

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    template: '%s | My Store',
    default: 'My Store', // Used if a child doesn't define a title
  },
}

// app/products/page.tsx
export const metadata = {
  title: 'Products', // Renders as: <title>Products | My Store</title>
}
```

## 2. Dynamic Metadata

Often, your metadata depends on dynamic data, such as a product ID in the URL. To fetch data and set metadata dynamically, export an async `generateMetadata` function.

```tsx
// app/products/[id]/page.tsx
import { Metadata } from 'next'

// The function receives the same params and searchParams as the page component
export async function generateMetadata({ 
  params 
}: { 
  params: { id: string } 
}): Promise<Metadata> {
  // Fetch product data
  const product = await fetch(`https://api.example.com/products/${params.id}`).then((res) => res.json())

  // Optionally access and extend parent metadata
  return {
    title: product.name,
    description: product.summary,
    openGraph: {
      images: [product.imageUrl],
    },
  }
}

export default async function ProductPage({ params }) {
  // ... page content ...
}
```

### Data Fetching and `generateMetadata`

You might notice that both `generateMetadata` and the default `ProductPage` component need to fetch the same product data. 

**Next.js automatically memoizes (caches) `fetch` requests.** If you use `fetch` with the same URL and options in both functions, the network request is only made *once*. The second call will return the cached result instantly.

## 3. Metadata Files (File-based Metadata)

In addition to the Metadata API, Next.js allows you to define metadata using specific files placed in your route segments:

- `favicon.ico`, `apple-icon.jpg`, `icon.png`: Used for favicons and app icons.
- `opengraph-image.png`, `twitter-image.png`: Used for social media sharing cards.

If you place an `opengraph-image.png` inside `app/products/[id]/`, Next.js will automatically generate the corresponding `<meta property="og:image">` tag for that specific route.

## Summary

- Export a `metadata` object for static SEO tags.
- Export a `generateMetadata` function to fetch data and generate SEO tags dynamically.
- Next.js automatically dedupes `fetch` requests across `generateMetadata` and your page components.
- Use file conventions (`icon.png`, `opengraph-image.png`) for easy image metadata.
