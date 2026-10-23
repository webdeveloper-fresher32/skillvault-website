# Phase 8: Styling and UI

## What You'll Learn

How to scope component styles safely with CSS Modules versus global CSS, how to integrate Tailwind's utility-first approach, and how to use `next/image` and `next/font` to avoid layout shift and unnecessary network cost.

## Learning Objectives

- Scope styles with CSS Modules vs global CSS appropriately, understanding what the `.module.css` filename suffix actually triggers.
- Integrate Tailwind CSS as a utility-first alternative (or complement) to CSS Modules, including the `tailwind.config.js` content scan.
- Use `next/image` and `next/font` to avoid layout shift — reserving image space with `width`/`height` and self-hosting fonts instead of a late external font request.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-CSS-Modules-and-Global-Styles.md](01-CSS-Modules-and-Global-Styles.md) | Class name collisions in global CSS; `.module.css` scoping; when to use `globals.css` instead | 1 day |
| [02-Tailwind-Integration.md](02-Tailwind-Integration.md) | Utility-first CSS; `tailwind.config.js` and the content scan; combining Tailwind with CSS Modules | 1 day |
| [03-Image-and-Font-Optimization.md](03-Image-and-Font-Optimization.md) | `next/image` sizing/lazy-loading/`priority`; `next/font` self-hosting; avoiding layout shift | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Caching and Performance](../Phase-09-Caching-and-Performance/README.md)
