# Debugging Next.js Applications

Debugging a Next.js application can sometimes feel complex because code runs in multiple environments: on the server (Server Components, API Routes, Server Actions) and on the client (Client Components).

This lesson covers tools and techniques to effectively debug errors and performance issues in Next.js.

## 1. The Next.js Error Overlay

During development (`next dev`), Next.js provides a built-in error overlay. When a runtime error occurs, a modal pops up in your browser displaying:
- The error message.
- A source map traced stack trace.
- A button to open the offending file directly in your code editor.

**Tip:** If you're working with Client Components, errors will appear directly in the browser console. If working with Server Components, errors will appear in your terminal where you ran `npm run dev` *and* in the browser overlay.

## 2. Using `console.log` effectively

Because Next.js code runs in different places, `console.log` outputs go to different places:
- **Server Components / Server Actions:** Output appears in your **terminal** where the Next.js dev server is running.
- **Client Components:** Output appears in your **browser's developer tools console**.

If a `console.log` isn't appearing where you expect, check the `use client` directive at the top of the file to determine where the code is executing.

## 3. VS Code Debugging

You can attach the VS Code debugger to Next.js to set breakpoints in both server-side and client-side code.

Create a `.vscode/launch.json` file at the root of your project:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "serverReadyAction": {
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

Running the "Next.js: debug full stack" configuration will start the server and open Chrome, allowing you to hit breakpoints in both Server and Client Components.

## 4. Next.js DevTools (React DevTools)

The **React Developer Tools** browser extension is essential. It has been updated to support React Server Components.
- The **Components** tab allows you to inspect the component tree, props, and state.
- In Next.js, Server Components are typically marked in the tree, making it easy to see the boundary between Server and Client Components.

## 5. Inspecting Network Traffic

When debugging data fetching or Server Actions, the browser's **Network tab** is your best friend.
- **Client-side Fetch:** Look for standard XHR/Fetch requests.
- **Server Actions:** Look for `POST` requests made to the same URL as the page, with a custom `Next-Action` header. The payload will contain the action ID and arguments.
- **RSC Payload:** When navigating between pages using `<Link>`, Next.js fetches a special JSON-like payload (RSC Payload) instead of full HTML. You can inspect these requests (often with `?_rsc=` query parameters) to see exactly what data the server is sending to the client.

## Summary

- Pay attention to where code runs: server logs vs. browser console.
- Use VS Code's `launch.json` to enable breakpoints for both server and client.
- Leverage React DevTools to inspect the boundary between Server and Client Components.
- Use the Network tab to debug Server Actions and RSC payloads during navigation.
