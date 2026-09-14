# Nest CLI, Schematics, and Generated Project Structure — Complete Guide

## Table of Contents
1. [Why the Nest CLI Exists](#1-why-the-nest-cli-exists)
2. [Installing the CLI](#2-installing-the-cli)
3. [Creating a New Project with nest new](#3-creating-a-new-project-with-nest-new)
4. [Anatomy of a Generated Project](#4-anatomy-of-a-generated-project)
5. [Generator Schematics — nest generate](#5-generator-schematics--nest-generate)
6. [The resource Schematic](#6-the-resource-schematic)
7. [Workspace Configuration — nest-cli.json](#7-workspace-configuration--nest-clijson)
8. [Standard Mode vs Monorepo Mode](#8-standard-mode-vs-monorepo-mode)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why the Nest CLI Exists

NestJS is a convention-heavy framework: every feature is a `Module`, every module groups `Controller`s and `Provider`s, and every one of those classes follows a predictable file-naming and decorator pattern. The Nest CLI exists to make those conventions automatic rather than something you retype by hand for the tenth time.

```
  Without the CLI                         With the CLI
  ─────────────────                       ─────────────
  Hand-write class boilerplate            nest g module users
  Hand-wire imports/exports/providers  →  nest g controller users
  Risk typos in decorator names           nest g service users
  Forget to register in app.module.ts     CLI updates app.module.ts for you
```

The CLI is not just a scaffolding tool — it also owns the **build** (`nest build`), **dev server with hot reload** (`nest start --watch`), and **workspace metadata** (`nest-cli.json`) for a project. Every official NestJS project, tutorial, and production codebase you will encounter was almost certainly created with `nest new` and grown with `nest generate`.

---

## 2. Installing the CLI

The CLI can be installed globally (most common for day-to-day scaffolding) or invoked ad hoc with `npx` (no global install, always uses a pinned/latest version).

```bash
# Global install — recommended for regular NestJS development
npm install -g @nestjs/cli

# Verify installation and version
nest --version

# Ad hoc, no global install (useful in CI or shared machines)
npx @nestjs/cli new my-project

# Per-project install (added to devDependencies, invoked via npm scripts)
npm install --save-dev @nestjs/cli
```

A generated project also depends on `@nestjs/cli` as a dev dependency, so `npm run build` and `npm run start:dev` inside the project use the *locally installed* CLI version — the global install is only a convenience for running commands like `nest generate` from your terminal.

---

## 3. Creating a New Project with nest new

```bash
nest new task-api
```

This launches an interactive prompt:

```
? Which package manager would you like to use? (Use arrow keys)
❯ npm
  yarn
  pnpm
```

Pick a package manager and the CLI clones its internal starter template, installs dependencies, and initializes a git repository. Useful flags let you skip prompts for scripting or CI:

```bash
# Skip the package manager prompt, use npm directly
nest new task-api --package-manager npm

# Skip git initialization
nest new task-api --skip-git

# Skip dependency installation (install later yourself)
nest new task-api --skip-install

# Generate a strict TypeScript config
nest new task-api --strict
```

After it finishes:

```bash
cd task-api
npm run start:dev
```

```
[Nest] 12345  - 07/13/2026, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 07/13/2026, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized +8ms
[Nest] 12345  - 07/13/2026, 10:00:00 AM     LOG [RoutesResolver] AppController {/}: +3ms
[Nest] 12345  - 07/13/2026, 10:00:00 AM     LOG [RouterExplorer] Mapped {/, GET} route +1ms
[Nest] 12345  - 07/13/2026, 10:00:00 AM     LOG [NestApplication] Nest application successfully started +2ms
```

The server listens on port 3000 by default, and `npm run start:dev` runs it with `ts-node`/webpack HMR so file changes trigger an automatic restart or recompile.

---

## 4. Anatomy of a Generated Project

```
task-api/
├── src/
│   ├── main.ts               ← application entry point, calls NestFactory
│   ├── app.module.ts          ← root module
│   ├── app.controller.ts      ← sample controller (GET /)
│   ├── app.controller.spec.ts ← unit test for the controller
│   └── app.service.ts         ← sample provider (business logic)
├── test/
│   ├── app.e2e-spec.ts        ← end-to-end test using Supertest
│   └── jest-e2e.json          ← Jest config for e2e tests
├── nest-cli.json               ← Nest workspace/build configuration
├── package.json
├── tsconfig.json
├── tsconfig.build.json         ← build-specific TS config (excludes spec files)
└── .eslintrc.js / eslint.config.mjs
```

### `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

This is the only place in a generated project where framework startup happens imperatively — everything else is declarative (decorators + modules). Phase 02's second lesson covers this file in depth.

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

The root module. Every Nest application has exactly one root module that NestFactory bootstraps; every other module is imported into this tree, directly or transitively.

### `src/app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

A controller with no path prefix (`@Controller()`), mapping `GET /` to `getHello()`. Notice the controller does not implement the logic itself — it delegates to an injected provider.

### `src/app.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

`@Injectable()` marks this class as a provider that Nest's DI container can construct and hand out. Controllers never `new` up their own services — the constructor parameter `appService: AppService` is enough for Nest to resolve and inject an instance.

### Spec files

`app.controller.spec.ts` is a unit test that builds a minimal testing module via `Test.createTestingModule({...})` and exercises the controller in isolation. `test/app.e2e-spec.ts` instead boots the *entire* `AppModule` with `NestFactory`-equivalent testing utilities and issues real HTTP requests with Supertest. Both ship by default because the CLI's philosophy is that a scaffolded project should already demonstrate testable structure, not just "hello world" routes.

---

## 5. Generator Schematics — nest generate

The `nest generate` command (aliased `nest g`) creates new building blocks and — critically — automatically wires them into the nearest module.

```bash
# Full form
nest generate module users
nest generate controller users
nest generate service users

# Short form (identical result)
nest g mo users
nest g co users
nest g s users
```

| Schematic alias | Full name | Generates |
|---|---|---|
| `mo` | `module` | `users.module.ts` |
| `co` | `controller` | `users.controller.ts` + `.spec.ts` |
| `s` | `service` | `users.service.ts` + `.spec.ts` |
| `pi` | `pipe` | `users.pipe.ts` + `.spec.ts` |
| `gu` | `guard` | `users.guard.ts` + `.spec.ts` |
| `f` | `filter` | `users.filter.ts` + `.spec.ts` |
| `itc` | `interceptor` | `users.interceptor.ts` + `.spec.ts` |
| `d` | `decorator` | `users.decorator.ts` |
| `mi` | `middleware` | `users.middleware.ts` + `.spec.ts` |
| `r` | `resolver` | `users.resolver.ts` + `.spec.ts` (GraphQL) |
| `res` | `resource` | full CRUD module (see below) |

Running `nest g co users` when a `UsersModule` already exists produces:

```
CREATE src/users/users.controller.spec.ts (566 bytes)
CREATE src/users/users.controller.ts (99 bytes)
UPDATE src/users/users.module.ts (168 bytes)
```

That `UPDATE` line is the important part — the CLI parsed `users.module.ts`, added `UsersController` to the `controllers` array, and rewrote the file. This is why running generators from the project root (rather than hand-creating files in random folders) keeps modules self-consistent.

You can target a subfolder directly:

```bash
# Places files under src/users/ and updates the closest module found there
nest g controller users

# Explicit nested path
nest g service users/profile
# → src/users/profile/profile.service.ts

# Generate without a spec file (e.g., for throwaway scaffolding)
nest g service users --no-spec

# Dry run — show what would be generated without writing files
nest g module orders --dry-run
```

---

## 6. The resource Schematic

`nest g resource` is the fastest way to scaffold a complete CRUD feature — module, controller, service, DTOs, and an entity stub — in one command.

```bash
nest g resource products
```

```
? What transport layer do you use? (Use arrow keys)
❯ REST API
  GraphQL (code first)
  GraphQL (schema first)
  Microservice (non-HTTP)
  WebSockets

? Would you like to generate CRUD entry points? (Y/n) Y
```

Choosing **REST API** + CRUD entry points produces:

```
src/products/
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
├── entities/
│   └── product.entity.ts
├── products.controller.ts
├── products.controller.spec.ts
├── products.module.ts
├── products.service.ts
└── products.service.spec.ts
```

The generated controller already contains full CRUD routes wired to service method stubs:

```typescript
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
```

This is why teams reach for `resource` when starting a new domain area — it produces the entire skeleton of a REST resource (including DTO classes ready for `class-validator` decorators) in a single command, and it is automatically imported into `AppModule`.

---

## 7. Workspace Configuration — nest-cli.json

Every generated project has an `nest-cli.json` at the root describing how the CLI should build and serve the project.

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

| Field | Purpose |
|---|---|
| `collection` | Which schematics collection `nest generate` uses — almost always `@nestjs/schematics` |
| `sourceRoot` | Root folder the CLI scaffolds into and builds from (`src` by default) |
| `compilerOptions.deleteOutDir` | Clean the `dist/` folder before every build |
| `compilerOptions.webpack` | Use webpack instead of `tsc` for builds (needed for HMR) |
| `compilerOptions.assets` | Non-TS files (e.g., `.graphql`, `.hbs` templates) to copy into `dist/` |
| `entryFile` | Override the default `main` entry file name |
| `projects` | Present only in monorepo mode — see below |

This file is what makes `nest build`, `nest start`, and `nest generate` location-aware without you passing `--path` flags on every command.

---

## 8. Standard Mode vs Monorepo Mode

By default, `nest new` creates a **standard mode** project: one `nest-cli.json`, one `tsconfig.json`, one `src/` tree, one deployable application. This is correct for the overwhelming majority of projects, including most microservice setups where each service simply lives in its own repository.

**Monorepo mode** lets a single repository host multiple *applications* and shared *libraries* that all build against one Nest workspace configuration — useful when you have, say, an API gateway and several internal microservices that share DTOs or utility code.

```bash
# Convert (or start) as a monorepo by generating a second application
nest generate app orders-service

# Generate a shared library
nest generate library shared-dto
```

After adding an app, `nest-cli.json` gains a `projects` map:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/task-api/src",
  "monorepo": true,
  "root": "apps/task-api",
  "compilerOptions": {
    "webpack": true,
    "tsConfigPath": "apps/task-api/tsconfig.app.json"
  },
  "projects": {
    "task-api": {
      "type": "application",
      "root": "apps/task-api",
      "entryFile": "main",
      "sourceRoot": "apps/task-api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/task-api/tsconfig.app.json"
      }
    },
    "orders-service": {
      "type": "application",
      "root": "apps/orders-service",
      "entryFile": "main",
      "sourceRoot": "apps/orders-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/orders-service/tsconfig.app.json"
      }
    },
    "shared-dto": {
      "type": "library",
      "root": "libs/shared-dto",
      "entryFile": "index",
      "sourceRoot": "libs/shared-dto/src",
      "compilerOptions": {
        "tsConfigPath": "libs/shared-dto/tsconfig.lib.json"
      }
    }
  }
}
```

The resulting directory layout:

```
task-api/
├── apps/
│   ├── task-api/
│   │   ├── src/ (main.ts, app.module.ts, ...)
│   │   └── tsconfig.app.json
│   └── orders-service/
│       ├── src/
│       └── tsconfig.app.json
├── libs/
│   └── shared-dto/
│       └── src/index.ts
├── nest-cli.json
├── tsconfig.json    ← path-mapped so apps/libs can import shared code by name
└── package.json      ← single package.json, single node_modules, for the whole workspace
```

Libraries are imported by name (e.g., `import { CreateOrderDto } from '@app/shared-dto'`) via TypeScript path mapping in `tsconfig.json`, and each application is built/served independently:

```bash
nest build orders-service
nest start orders-service --watch
```

```
  Standard mode                          Monorepo mode
  ──────────────                         ──────────────
  One package.json                       One package.json (shared across apps)
  One nest-cli.json entry                nest-cli.json "projects" map
  One deployable app                     Many deployable apps + shared libs
  Simple, isolated dependency versions   Enforced dependency consistency
  Best default for most teams            Best for tightly coupled microservices
```

---

## 9. Common Pitfalls

- **Editing generated files by hand and then re-running a generator over them.** Schematics do simple AST insertion (e.g., adding an import/array entry) — they do not merge complex hand-written changes gracefully. Generate first, customize after.
- **Running `nest generate` from the wrong directory.** The CLI resolves the "nearest module" relative to your current working directory and the target path, not always `AppModule`. Running `nest g service foo` from inside `src/users/` can attach the service to `UsersModule` instead of a new module you intended.
- **Forgetting `--no-spec` matters for CI speed, not correctness.** Skipping spec files is a valid choice for prototyping, but doing it habitually in real projects erodes test coverage — the CLI generates working spec scaffolding for a reason.
- **Assuming monorepo mode is "more advanced" and always better.** Monorepo mode adds real overhead (shared `tsconfig`, shared dependency versions, cross-app build config) that is wasted complexity for a single-service project. Default to standard mode unless you actually have multiple apps/libs to share.
- **Committing `dist/` or forgetting `deleteOutDir`.** Stale compiled output in `dist/` can be picked up by `node dist/main.js` even after source changes, causing "it works on rebuild but not on restart" confusion. Trust `nest build`'s `deleteOutDir: true` default and never hand-edit `dist/`.
- **Global CLI version drift.** A globally installed `@nestjs/cli` can be a different major version than the one pinned in a project's `devDependencies`. Prefer `npx nest generate ...` or an `npm run` script inside a project to guarantee you use the version the project expects.

---

## 10. Best Practices

- Scaffold every new controller/service/module through `nest generate` rather than copy-pasting files — the auto-registration in the parent module is the main value, not the boilerplate itself.
- Use `nest g resource <name>` as the default starting point for a new REST domain; delete the CRUD stubs you don't need rather than writing a resource from scratch.
- Keep `nest-cli.json` under version control and treat changes to it (e.g., enabling webpack, adding asset globs) as reviewable, since they affect every developer's build.
- Default to standard mode. Only reach for monorepo mode when you can name at least two applications or libraries that genuinely need to share code and a workspace-level build.
- Run `nest g <schematic> --dry-run` before generating into an unfamiliar or deeply nested path to confirm where files will land and which module will be updated.
- Pin `@nestjs/cli` as an exact or tightly-ranged devDependency version matching your `@nestjs/core` major version to avoid schematic/runtime API mismatches.

---

## 11. Hands-On Exercises

**Exercise 1:** Install the Nest CLI globally, run `nest new inventory-api` (choose `npm`), and start it with `npm run start:dev`. Confirm you can `curl http://localhost:3000` and get `Hello World!`. Open `src/app.module.ts`, `src/app.controller.ts`, and `src/app.service.ts` and, in your own words, describe how a request to `GET /` flows from the controller to the service and back.

**Exercise 2:** Inside `inventory-api`, run `nest g resource items` selecting REST API with CRUD entry points. Inspect the generated `items.module.ts` and confirm `ItemsController` and `ItemsService` are registered. Then open `app.module.ts` and confirm `ItemsModule` was automatically added to `imports`. Start the server and verify `GET /items` returns an empty array (or whatever stub value the generated service returns).

**Exercise 3:** Run `nest g controller items/archive --dry-run` from the project root and read the output carefully. Predict which file paths would be created and which module would be updated before running it for real (without `--dry-run`). Then verify your prediction.

**Exercise 4:** Convert `inventory-api` into a monorepo by running `nest generate app reporting-service` and `nest generate library shared-types`. Inspect the resulting `nest-cli.json` `projects` map, and move a shared interface (e.g., an `Item` interface) into `libs/shared-types/src/index.ts`. Import it from both `apps/inventory-api` and `apps/reporting-service` using the path-mapped library name, and build both apps with `nest build <app-name>` to confirm the shared import resolves.

**Exercise 5:** Delete `nest-cli.json` from a scaffolded project (back it up first) and try running `nest generate service test-service`. Observe what breaks or what the CLI falls back to. Restore the file from your backup, then deliberately change `sourceRoot` to a non-existent folder name and re-run `nest start`. Document what error message appears and what it tells you about how tightly the CLI's build/generate commands depend on `nest-cli.json`.

---

## 12. Interview Q&A

**Q: What does `nest generate module/controller/service` actually do beyond creating files?**
Answer: Beyond writing the boilerplate `.ts` (and usually `.spec.ts`) files following NestJS naming conventions, the CLI performs an AST-level update of the nearest existing module file — adding the new controller to its `controllers` array or the new service to its `providers` array (and, for `nest g module`, adding the new module to the parent's `imports` array). This auto-registration is the main productivity win: it eliminates the class of bugs where a class is defined and decorated correctly but never actually wired into the module tree, so Nest's DI container never instantiates it.

**Q: What is the difference between standard mode and monorepo mode in the Nest CLI?**
Answer: Standard mode is the default: one `nest-cli.json`, one `src/` tree, one `package.json`, and one deployable application per repository — appropriate for the vast majority of projects. Monorepo mode, created by running `nest generate app` a second time or `nest generate library`, restructures the repo into `apps/` and `libs/` directories governed by a `projects` map inside `nest-cli.json`, with a single shared `package.json`/`node_modules` and TypeScript path-mapped imports between apps and libraries. Monorepo mode is worth the added build/tsconfig complexity only when multiple applications genuinely need to share code (DTOs, utilities, constants) within one repository.

**Q: What is `nest-cli.json` and what happens if it's missing or misconfigured?**
Answer: `nest-cli.json` is the Nest CLI's workspace configuration file — it tells `nest build`, `nest start`, and `nest generate` which schematics collection to use, where the source root is, and (in monorepo mode) which apps/libraries exist and how each one's TypeScript config and entry file are laid out. If it's missing, the CLI falls back to hard-coded defaults (`src` as source root, `@nestjs/schematics` as the collection) which works for a bare-bones project but breaks immediately for any monorepo, custom source layout, or webpack-based build. A misconfigured `sourceRoot` typically manifests as `nest generate` writing files into the wrong folder or `nest build`/`nest start` failing to find the entry file.

**Q: How does `nest g resource` differ from running `nest g module`, `nest g controller`, and `nest g service` separately?**
Answer: `nest g resource` is a composite schematic: after asking which transport layer (REST, GraphQL, microservice, WebSockets) and whether to scaffold CRUD endpoints, it generates the module, controller, and service (all wired together and registered in the parent module) *plus* DTO classes (`create-x.dto.ts`, `update-x.dto.ts`) and an entity stub, and — for REST/CRUD — pre-fills the controller with working `@Get`/`@Post`/`@Patch`/`@Delete` handlers calling matching service methods. Running the three generators separately gives you the module/controller/service skeleton but none of the DTOs, entity stub, or pre-wired CRUD routes, so you'd write that scaffolding by hand.

**Q: Why does the CLI generate `.spec.ts` files alongside every controller, service, guard, etc.?**
Answer: NestJS treats testability as a first-class architectural concern, not an afterthought — the framework's own `Test.createTestingModule()` utility exists specifically to let you build an isolated DI container for unit tests. Generating a matching spec file by default (using Jest, with a working `TestingModule` setup that already injects the class under test) means every scaffolded piece of the application starts with a passing, extendable test rather than zero test coverage. Teams can opt out per-generation with `--no-spec`, but the default exists to make "just delete the boilerplate test" the developer's active choice rather than the path of least resistance being "skip tests entirely."

**Q: If you hand-write a new provider class instead of using `nest generate service`, does anything break?**
Answer: Nothing breaks mechanically — a hand-written class decorated with `@Injectable()` is functionally identical to a CLI-generated one, since the CLI's schematics are just a convenience layer over plain TypeScript classes and NestJS decorators. What you lose is the automatic registration step: you must remember to import the class and add it to the owning module's `providers` array yourself, and forgetting to do so produces a runtime dependency-injection error (Nest cannot resolve a provider that was never registered) rather than a compile-time error, since TypeScript alone has no notion of Nest's module graph.
