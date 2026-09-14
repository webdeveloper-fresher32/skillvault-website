# Project 01: Personal Portfolio

**Difficulty:** Beginner  
**Time Estimate:** 4-6 hours

Build a static personal portfolio website to showcase your skills, projects, and contact information. This project focuses on the core foundations of the Next.js App Router: layouts, pages, routing, and styling.

## Requirements

1. **Pages:**
   - Home (`/`): A brief introduction, profile picture, and summary.
   - About (`/about`): Detailed background and skills.
   - Projects (`/projects`): A list or grid of projects you've worked on.
   - Contact (`/contact`): A simple contact form (UI only for now) or links to your social profiles.

2. **Layouts:**
   - Implement a Root Layout (`app/layout.tsx`) that contains a persistent navigation bar (header) and a footer.

3. **Styling:**
   - Use Tailwind CSS or CSS Modules to style the application. Ensure it is fully responsive on mobile devices.

4. **SEO:**
   - Add static Metadata (title, description) to each page.
   - Configure an Open Graph image for social sharing.

5. **Optimization:**
   - Use the `next/image` component (`<Image />`) for your profile picture and any project screenshots to ensure they are optimized and lazy-loaded.

## Stretch Goals

- Add a Dark Mode toggle using a Client Component.
- Use `next/font` to load a custom Google Font optimally.
