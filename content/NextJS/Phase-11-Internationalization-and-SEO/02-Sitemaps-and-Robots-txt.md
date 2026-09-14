# Sitemaps and Robots.txt

For search engines to effectively crawl and index your Next.js application, two files are standard requirements: `sitemap.xml` and `robots.txt`. Next.js provides special file conventions to generate these files statically or dynamically.

## 1. Generating a Sitemap

A sitemap tells search engines about the structure of your site and which pages are most important. 

You can create a sitemap in Next.js in two ways: statically (by adding a `sitemap.xml` file) or dynamically (by adding a `sitemap.js` or `sitemap.ts` file).

### Dynamic Sitemaps (`sitemap.js`)

To generate a dynamic sitemap—which is highly recommended for blogs or e-commerce sites where pages are added frequently—create a `sitemap.ts` file in the root `app` directory.

The default export must be an async function that returns an array of objects representing your URLs.

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch dynamic routes (e.g., blog posts)
  const posts = await fetch('https://api.example.com/posts').then((res) => res.json())

  const postUrls = posts.map((post: any) => ({
    url: `https://my-app.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: 'https://my-app.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://my-app.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...postUrls,
  ]
}
```

When you visit `https://my-app.com/sitemap.xml`, Next.js executes this function and returns the XML format required by search engines.

## 2. Generating `robots.txt`

The `robots.txt` file tells web crawlers which URLs they are allowed or not allowed to index.

Like the sitemap, you can place a static `robots.txt` in the `app` directory, or generate it dynamically using `robots.ts`.

### Dynamic `robots.txt` (`robots.ts`)

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', // Apply to all crawlers (Googlebot, Bingbot, etc.)
      allow: '/',
      disallow: ['/private/', '/admin/'], // Hide these routes from search engines
    },
    sitemap: 'https://my-app.com/sitemap.xml',
  }
}
```

When you visit `https://my-app.com/robots.txt`, Next.js will serve a properly formatted text file based on this configuration.

## 3. Route Handlers for Complex XML

While `sitemap.ts` covers most use cases, if you need to generate a highly complex XML feed (like an RSS feed or a Google News sitemap), you can create a standard Route Handler (`app/feed/route.ts`).

```typescript
// app/feed/route.ts
export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>My App Feed</title>
        <link>https://my-app.com</link>
      </channel>
    </rss>`
  
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
```

## Summary

- Use `app/sitemap.ts` to dynamically generate a `sitemap.xml` file for search engines.
- Use `app/robots.ts` to dynamically generate a `robots.txt` file to control crawler access.
- Both files must return specific Next.js types (`MetadataRoute.Sitemap` and `MetadataRoute.Robots`).
- Use Route Handlers (`route.ts`) returning a `Response` for custom XML files like RSS feeds.
