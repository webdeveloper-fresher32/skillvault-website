# The Angular CLI

The Angular CLI (Command Line Interface) is the core tool used to initialize, develop, scaffold, and maintain Angular applications. Unlike some frameworks where the CLI is optional, in Angular, it is practically mandatory and incredibly powerful.

## 1. Installation

You install the Angular CLI globally via npm:

```bash
npm install -g @angular/cli
```

Verify the installation by checking the version:
```bash
ng version
```

## 2. Creating a New Project

To create a new workspace and application:

```bash
ng new my-angular-app
```

When prompted:
1. **Which stylesheet format would you like to use?** Choose `CSS` or `SCSS`.
2. **Do you want to enable Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering)?** This is a new feature in v17+. We recommend saying `y` (Yes) for modern apps, but `N` is fine for learning.

**What `ng new` does:**
- Creates a new directory.
- Scaffolds the application files.
- Installs npm dependencies.
- Initializes a git repository.
- Sets up testing (Jasmine/Karma) and linting environments.

## 3. Serving the Application

During development, you run a local dev server with:

```bash
ng serve
```
By default, the app is hosted on `http://localhost:4200/`.
- Use `--open` or `-o` to automatically open your default browser.
- Use `--port 4201` to change the port.

## 4. Generating Code

The most common use of the CLI after setup is generating code. This ensures you follow Angular's architectural patterns.

```bash
# Generate a component
ng generate component user-profile
# shorthand
ng g c user-profile

# Generate a service
ng g s services/auth

# Generate a directive
ng g d shared/highlight

# Generate a pipe
ng g p shared/truncate
```

When you generate a component, the CLI creates:
- `user-profile.component.ts` (Logic)
- `user-profile.component.html` (Template)
- `user-profile.component.css` (Styles)
- `user-profile.component.spec.ts` (Test file)

## 5. Building for Production

When you are ready to deploy, you build the app:

```bash
ng build
```

This compiles your TypeScript and HTML, bundles your CSS, minifies the code, performs tree-shaking (removing unused code), and outputs production-ready files into the `dist/` directory.

---
Next, we will look at the files generated in the workspace and what they do.
