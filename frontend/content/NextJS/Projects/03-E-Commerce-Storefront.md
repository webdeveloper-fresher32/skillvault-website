# Project 03: E-Commerce Storefront

**Difficulty:** Advanced  
**Time Estimate:** 10-14 hours

Build a read-only e-commerce storefront that fetches product data from a mock external API (like FakeStoreAPI). This project focuses heavily on Server Components, Data Fetching, React Suspense for loading states, and Error Boundaries.

## Requirements

1. **Product Listing Page (`/products`):**
   - Fetch a list of products from `https://fakestoreapi.com/products`.
   - Implement filtering (e.g., by category) using URL query parameters (`searchParams`).

2. **Product Details Page (`/products/[id]`):**
   - Fetch the details of a single product.
   - Implement a recommended products section below the main product details, fetching data concurrently if possible.

3. **Loading States (Suspense):**
   - Create a `loading.js` file at the root or products segment to show a UI skeleton while the initial data fetches.
   - Use React `<Suspense>` boundaries to stream in different parts of the UI independently (e.g., the product details load first, while the recommended products stream in a second later).

4. **Error Handling:**
   - Create an `error.js` file to catch API failures gracefully (e.g., if FakeStoreAPI goes down) and display a user-friendly error message with a "Try Again" button.

5. **Caching:**
   - Utilize Next.js caching features (`fetch` with `next: { revalidate: 3600 }`) to cache the product data for 1 hour, ensuring fast page loads while still keeping data relatively fresh.

## Stretch Goals

- Add pagination to the product listing page using query parameters.
- Implement a basic "Add to Cart" functionality using React Context or a state management library like Zustand in Client Components.
