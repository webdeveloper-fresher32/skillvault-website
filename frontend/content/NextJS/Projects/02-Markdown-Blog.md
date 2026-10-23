# Project 02: Markdown Blog

**Difficulty:** Intermediate  
**Time Estimate:** 6-8 hours

Build a statically generated blog where posts are written in local Markdown files. This project introduces reading from the file system within Server Components, dynamic route segments, and generating static paths at build time.

## Requirements

1. **Local Data Source:**
   - Create a `posts/` folder at the root of your project containing several `.md` files.
   - Each markdown file should have frontmatter (YAML) containing the `title`, `date`, and `description`.

2. **Blog Index Page (`/blog`):**
   - Write a Server Component that uses Node's `fs` module to read the `posts/` directory.
   - Parse the frontmatter (using a package like `gray-matter`).
   - Display a list of blog post titles, descriptions, and dates, sorted by date.

3. **Dynamic Post Page (`/blog/[slug]`):**
   - Create a dynamic route segment that accepts a `slug`.
   - Read the corresponding markdown file, parse the content, and render it to HTML (using a package like `remark` and `remark-html`).
   - Use `not-found.js` to handle cases where a user navigates to a slug that doesn't exist.

4. **Static Generation (`generateStaticParams`):**
   - Implement the `generateStaticParams` function inside `/blog/[slug]/page.tsx` so that all blog posts are rendered to static HTML at build time, rather than on every request.

## Stretch Goals

- Add dynamic `generateMetadata` to each blog post page so the `<title>` matches the post title.
- Implement syntax highlighting for code blocks inside your markdown files.
