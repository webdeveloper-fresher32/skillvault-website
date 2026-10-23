# Workspace and Application Structure

When you run `ng new my-app`, Angular generates a standard directory structure. Understanding what these files do is essential for navigating the codebase.

## The Root Directory

The root level of your workspace contains configuration files for the workspace, testing, and linting.

- **`angular.json`**: The most important config file. It defines how the CLI builds, serves, and tests your application. It contains paths to your main files, styles, assets, and build optimization settings.
- **`package.json`**: Standard Node.js file for managing npm dependencies and scripts.
- **`tsconfig.json`**: The base TypeScript configuration for the workspace.
- **`node_modules/`**: Where npm installs the dependencies.

## The `src/` Directory

This is where you will spend 99% of your time. It contains the actual source code of your application.

```text
src/
├── app/                  → The main application code
├── assets/               → Static files (images, icons, translation files)
├── index.html            → The main HTML page served to the browser
├── main.ts               → The main entry point for the application
├── styles.css            → Global styles applied to the entire app
```

### Deep dive into `src/app/`

In modern Angular (v17+ using Standalone Components), the `app/` directory looks like this out of the box:

- **`app.component.ts`**: The root component class. Every Angular app has at least one component, the root component, that connects a component hierarchy with the page DOM.
- **`app.component.html`**: The HTML template associated with the root component.
- **`app.component.css`**: CSS styles specific only to the root component.
- **`app.config.ts`**: (Modern Angular) Provides application-level configuration, replacing the old `app.module.ts`. It sets up routing, HTTP clients, and global providers.
- **`app.routes.ts`**: Defines the application's routing configuration (which URLs map to which components).

*(Legacy Note: In older Angular versions, you would see an `app.module.ts` file here instead of `app.config.ts`. NgModules were the old way of grouping components, directives, and services together).*

## The Bootstrapping Process

How does the app actually load?

1. The browser loads `index.html`.
2. Inside `index.html`, there is a custom tag, usually `<app-root></app-root>`.
3. The browser executes the compiled JavaScript, starting at `main.ts`.
4. `main.ts` calls `bootstrapApplication(AppComponent, appConfig)`.
5. Angular reads the `AppComponent`, finds its selector (`app-root`), and inserts the component's HTML into the `index.html` file.
6. The application is now alive and interactive.
