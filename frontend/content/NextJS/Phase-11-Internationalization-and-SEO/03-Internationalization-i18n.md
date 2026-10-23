# Internationalization (i18n) Routing

Internationalization (i18n) allows you to adapt your Next.js application to support multiple languages and regions. In the App Router, i18n is typically achieved using a combination of **Middleware** and **Dynamic Route Segments**.

The goal is to serve content based on the user's preferred language, often by prefixing the URL with a locale (e.g., `https://my-app.com/fr/products` for French, `https://my-app.com/en/products` for English).

## 1. Defining Locales

First, you need to define which locales your application supports and identify the default locale.

```typescript
// i18n.config.ts
export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'de'],
} as const

export type Locale = (typeof i18n)['locales'][number]
```

## 2. Using Middleware for Language Negotiation

When a user visits the root of your site (`/`), you want to detect their preferred language (using the `Accept-Language` HTTP header) and redirect them to the appropriate localized route (e.g., `/fr`).

You can use libraries like `@formatjs/intl-localematcher` and `negotiator` within Next.js Middleware to handle this logic.

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { match as matchLocale } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { i18n } from './i18n.config'

function getLocale(request: NextRequest): string | undefined {
  // Extract headers to pass to negotiator
  const negotiatorHeaders: Record<string, string> = {}
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value))

  // Determine preferred locales from the request
  let languages = new Negotiator({ headers: negotiatorHeaders }).languages()
  
  // Return the best match
  return matchLocale(languages, i18n.locales, i18n.defaultLocale)
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if the pathname already contains a supported locale
  const pathnameIsMissingLocale = i18n.locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // If the locale is missing, redirect to the localized URL
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)
    return NextResponse.redirect(
      new URL(`/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`, request.url)
    )
  }
}

export const config = {
  // Do not run middleware on API routes, static files, or images
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

## 3. Creating the Localized Route Segment

To capture the locale from the URL and use it in your application, move all your application files into a dynamic route segment named `[lang]`.

```text
app/
├── [lang]/
│   ├── layout.tsx
│   └── page.tsx
├── middleware.ts
└── i18n.config.ts
```

Because `[lang]` is a dynamic segment, the matched locale will be passed as a `params` prop to every Layout and Page within it.

```tsx
// app/[lang]/layout.tsx
import { i18n, Locale } from '@/i18n.config'

// Generate static routes for all locales at build time
export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }))
}

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: Locale }
}) {
  return (
    <html lang={params.lang}>
      <body>{children}</body>
    </html>
  )
}
```

## 4. Using Dictionaries

Once you have the `lang` param, you need a way to look up the translated text for that language. This is usually done using dictionary files (JSON or TS).

```json
// dictionaries/en.json
{
  "navigation": {
    "home": "Home",
    "about": "About Us"
  }
}
```

```json
// dictionaries/fr.json
{
  "navigation": {
    "home": "Accueil",
    "about": "À propos de nous"
  }
}
```

You create a helper function to load the dictionary based on the locale:

```typescript
// lib/dictionary.ts
import type { Locale } from '@/i18n.config'

const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  fr: () => import('@/dictionaries/fr.json').then((module) => module.default),
  de: () => import('@/dictionaries/de.json').then((module) => module.default),
}

export const getDictionary = async (locale: Locale) => dictionaries[locale]()
```

Finally, use the dictionary in your Server Components:

```tsx
// app/[lang]/page.tsx
import { getDictionary } from '@/lib/dictionary'
import { Locale } from '@/i18n.config'

export default async function Page({ params: { lang } }: { params: { lang: Locale } }) {
  // Load the translated text on the server
  const dict = await getDictionary(lang)

  return (
    <div>
      <h1>{dict.navigation.home}</h1>
    </div>
  )
}
```

## Summary

- Use **Middleware** to detect the user's preferred language and redirect them to a localized URL path.
- Wrap your application in a dynamic route segment (e.g., `app/[lang]/`) to capture the locale as a parameter.
- Use Server Components to load and inject **dictionaries** (translation JSON files) without sending the entire translation bundle to the client.
