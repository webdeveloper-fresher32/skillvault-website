# Dynamic Segments and Route Groups — Complete Guide

> "A dynamic segment is a hotel room door that says 'Room ___' — one sign, filled in differently for every guest."

---

## Table of Contents
1. [The Problem: You Can't Hand-Write a Folder for Every Blog Post](#1-the-problem-you-cant-hand-write-a-folder-for-every-blog-post)
2. [The Segment Types Catalog](#2-the-segment-types-catalog)
3. [Dynamic Segments in Practice](#3-dynamic-segments-in-practice)
4. [Route Groups: Organizing Without Adding to the URL](#4-route-groups-organizing-without-adding-to-the-url)
5. [Comparison Table: [slug] vs [...slug] vs [[...slug]]](#5-comparison-table-slug-vs-slug-vs-slug)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: You Can't Hand-Write a Folder for Every Blog Post

Lesson 1 leaned on literal folder names (`about`, `dashboard`) where every URL corresponds to a folder someone deliberately created. That breaks the moment the set of URLs is unbounded — a blog with hundreds of posts, one per SKU in a store, one per username.

```
app/blog/how-to-learn-react/page.js     ✗ nobody hand-creates
app/blog/why-typescript-matters/page.js ✗ a folder per post,
app/blog/my-first-post/page.js          ✗ and nobody redeploys weekly
```

A second, smaller problem: sometimes you want to group routes (a marketing site's public pages, an `(auth)` flow) purely to share a layout or stay tidy — without the grouping folder becoming part of the URL. A folder literally named `marketing` would add `/marketing` to every URL beneath it.

```
Dynamic segments → one file matches many URLs   (Sections 2–3)
Route groups     → organize files, zero URL impact (Section 4)
```

---

## 2. The Segment Types Catalog

Four folder-naming patterns matter here, each triggering different matching behavior.

### The Hotel-Sign and Filing-Folder Analogies

A dynamic segment (`[slug]`) is a hotel door sign reading "Room ___" — one template, a different value at every door. A route group (`(marketing)`) is a filing folder on your own desk — the label never appears on the mail inside it; visitors never see it in the URL.

### The Catalog

```
[slug]         → matches exactly ONE segment.  params.slug = string
[...slug]      → matches ONE OR MORE segments. params.slug = array
[[...slug]]    → matches ZERO OR MORE segments (also matches the bare
                  route). params.slug = array, empty when unmatched
(groupName)    → organizes routes in the file tree; can apply a
                  shared layout.js; adds NOTHING to the URL
```

```
Bracket syntax, read visually:
  ↳ single brackets   = "exactly one slot"
  ↳ three dots        = "one or more, give them to me as a list"
  ↳ double brackets   = "same list, fine if it's empty"
  ↳ parentheses       = a different character entirely — organization,
                         zero effect on matching
```

---

## 3. Dynamic Segments in Practice

### A Single Dynamic Segment

One file, every slug — this is the direct fix for Section 1's blog problem.

```jsx
// app/blog/[slug]/page.js
export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}
```

```
/blog/how-to-learn-react   → this file, params.slug = "how-to-learn-react"
/blog/my-first-post        → the SAME file, params.slug = "my-first-post"
  ↳ nothing about the file changes between requests — only params does
```

### Catch-All Segments

A catch-all extends the idea to multiple segments at once — useful when a route's depth isn't fixed, like storefront category browsing.

```jsx
// app/shop/[...categories]/page.js
export default async function ShopCategoryPage({ params }) {
  const { categories } = await params;
  // categories is an ARRAY of every segment after /shop/

  return <p>Browsing: {categories.join(" > ")}</p>;
}
```

```
/shop/electronics                  → categories = ["electronics"]
/shop/electronics/phones           → categories = ["electronics", "phones"]
/shop/electronics/phones/accessories → three-element array
/shop  (nothing after it)          → 404 — catch-all needs 1+ segments
                                       (use [[...categories]] to also
                                       match the bare route)
```

---

## 4. Route Groups: Organizing Without Adding to the URL

A route group wraps a folder name in parentheses and is invisible to the URL — pure organization, plus the ability to scope a shared `layout.js` to a subset of routes that don't share a URL prefix.

```text
app/
├── (marketing)/
│   ├── layout.js         (marketing-specific nav)
│   ├── page.js           →  /            (marketing home page)
│   ├── about/
│   │   └── page.js       →  /about       (NOT /marketing/about)
│   └── pricing/
│       └── page.js       →  /pricing     (NOT /marketing/pricing)
└── (app)/
    ├── layout.js          (app shell with a sidebar)
    └── dashboard/
        └── page.js       →  /dashboard   (NOT /app/dashboard)
```

```
(marketing) and (app) disappear entirely from the served URLs.
  ↳ What you buy: a layout.js scoped to just that group's routes,
    without those routes needing a shared prefix like /marketing/*.
  ↳ This is how a public marketing section and a logged-in app
    section coexist at the URL root while keeping distinct layouts.
```

---

## 5. Comparison Table: [slug] vs [...slug] vs [[...slug]]

| Aspect | `[slug]` | `[...slug]` | `[[...slug]]` |
|---|---|---|---|
| Matches the base route with no segment | No | No | Yes |
| Segments matched | Exactly one | One or more | Zero or more |
| `params.slug` type | String | Array | Array (empty when unmatched) |
| Typical use | A single value — a blog slug, a product ID | Variable-depth path — nested categories, a docs tree | Same as catch-all, but the "root" case should also render |

---

## 6. Common Mistakes

- **Expecting `[...slug]` to also match zero segments.** A plain catch-all requires at least one segment — `app/shop/[...categories]/page.js` will not match bare `/shop` (404s unless a separate `app/shop/page.js` exists). Use `[[...categories]]` when the base route needs to match too.
- **Thinking a route group's parentheses show up in the URL.** `(marketing)/about/page.js` serves at `/about`, never `/marketing/about` — easy to get backwards coming from ordinary folder nesting, where every folder normally adds to the URL.
- **Forgetting `params` needs to be awaited.** In recent Next.js releases, `params` is a Promise — `const { slug } = await params`, not a plain object read synchronously.
- **Assuming two route groups can define conflicting routes without warning.** If both `(marketing)` and `(app)` each contained their own `about/page.js`, both resolve to `/about` — an actual conflict Next.js flags, since parentheses separate the file tree, not the URL space.

---

## 7. Hands-On Exercises

**Exercise 1 — Build a single dynamic segment.** Create `app/blog/[slug]/page.js` reading `params.slug`, rendering `Post: {slug}`. Visit `/blog/hello-world` and `/blog/second-post`, confirm each shows its own slug.

**Exercise 2 — Build a catch-all.** Create `app/shop/[...categories]/page.js` rendering `categories.join(" > ")`. Visit `/shop/electronics`, then `/shop/electronics/phones`, confirm the array grows. Visit bare `/shop` and confirm it 404s.

**Exercise 3 — Upgrade to an optional catch-all.** Rename the folder from Exercise 2 to `[[...categories]]`. Confirm `/shop` now renders (empty array — handle that case), while the deeper URLs still work.

**Exercise 4 — Build two route groups with separate layouts.** Create `app/(marketing)/layout.js` + `app/(marketing)/about/page.js`, and `app/(app)/layout.js` + `app/(app)/dashboard/page.js`, each layout with visibly different chrome. Confirm `/about` and `/dashboard` both work with no group name in the URL.

**Exercise 5 — Confirm route groups don't collide.** Add a second `about/page.js` inside `app/(app)/about/` alongside Exercise 4's `app/(marketing)/about/page.js`. Run the dev server, confirm a conflicting-route error for `/about`, then delete the duplicate and confirm it resolves cleanly again.

---

## 8. Interview Q&A

**Q: What's the difference between `[slug]` and `[...slug]` in the App Router?**
A: `[slug]` matches exactly one URL segment at that position and hands it to the page as a string on `params.slug`. `[...slug]` is a catch-all that matches one or more segments at and beyond that position, handing the matched values to the page as an array instead of a string — useful when a route's depth isn't fixed, like a multi-level category browser.

**Q: How does `[[...slug]]` differ from `[...slug]`?**
A: `[[...slug]]` is the optional variant of a catch-all — it matches zero or more segments, meaning it also matches the base route with nothing after it (e.g., bare `/shop`), which a plain `[...slug]` never does since that requires at least one segment. Both hand `params.slug` back as an array; the optional version's array is just empty in the zero-segment case.

**Q: Does a route group like `(marketing)` show up anywhere in the final URL?**
A: No. A folder wrapped in parentheses is a route group — it exists purely to organize files in the project and optionally apply a shared `layout.js` to everything inside it, but it contributes nothing to the URL path. `app/(marketing)/about/page.js` serves at plain `/about`, not `/marketing/about`.

**Q: Why would you use a route group instead of just nesting routes under a real folder like `marketing/`?**
A: Because a real folder name becomes part of the URL, forcing every route inside it to share that prefix (`marketing/about`, `marketing/pricing`). A route group lets you apply a shared layout — or just keep related files organized together — to routes that need to live at the URL root or at otherwise unrelated paths, without forcing an artificial shared prefix onto their actual URLs.

**Q: What type is `params.slug` for a route like `app/products/[...ids]/page.js`, and what happens if you visit `/products` with nothing after it?**
A: Because `[...ids]` is a plain (non-optional) catch-all, `params.ids` is always an array of the matched segments — for example, `/products/42/99` yields `["42", "99"]`. Visiting bare `/products` with no segments after it does not match this file at all and results in a 404, unless the route is changed to the optional catch-all form `[[...ids]]`, which would match the bare route with an empty array.
