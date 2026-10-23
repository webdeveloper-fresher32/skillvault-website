# Project 04: Full-Stack Task Manager

**Difficulty:** Expert  
**Time Estimate:** 15-20 hours

This is the capstone project. You will build a full-stack, database-backed web application using Next.js, Server Actions, a database (like PostgreSQL with Prisma or Drizzle ORM), and authentication.

## Requirements

1. **Database Setup:**
   - Set up a database (e.g., Vercel Postgres, Supabase, or local Docker).
   - Define a schema with a `User` model and a `Task` model (title, description, status).

2. **Authentication:**
   - Implement authentication using NextAuth.js (Auth.js) or Clerk.
   - Create a Middleware (`middleware.ts`) to protect the dashboard routes, redirecting unauthenticated users to the login page.

3. **Dashboard (Read Data):**
   - Create a `/dashboard` route that fetches the authenticated user's tasks directly from the database within a Server Component.

4. **Mutations with Server Actions:**
   - Implement the following using Server Actions:
     - Create a new task.
     - Update a task's status (e.g., from "In Progress" to "Completed").
     - Delete a task.
   - Call these actions from Client Components (e.g., form submissions or button clicks).

5. **Optimistic UI:**
   - Use the `useOptimistic` React hook on the client to instantly update the task list UI when a user changes a task status, before the server responds.

6. **Cache Invalidation:**
   - Use `revalidatePath` inside your Server Actions to purge the cached dashboard page so the user sees the updated data after a mutation.

## Stretch Goals

- Add role-based access control (RBAC) where an "Admin" can see all tasks from all users.
- Deploy the complete application to Vercel and connect a production database.
