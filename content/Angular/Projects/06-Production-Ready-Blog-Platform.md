# Project 6 — Production-Ready Blog Platform

**Level:** Advanced
**Time estimate:** 150 – 180 minutes
**Phase prerequisite:** Phase 11 – Testing, Phase 12 – Performance & Deployment

---

## Overview

This is the capstone project. You will take a small blog application — a post list and a post detail page — through Angular's full production pipeline: Server-Side Rendering (SSR) with hydration, `ChangeDetectionStrategy.OnPush` on every component, a meaningful Jasmine/Karma unit test suite for both services and components, and a CI-ready optimized production build. The functionality is intentionally simple so that the project's focus stays on testing, rendering strategy, and build/deploy concerns rather than new features.

---

## Prerequisites

- Project 5 completed or equivalent comfort with Signals and component composition
- Phase 11 lessons completed (Jasmine/Karma, `TestBed`, component and service testing)
- Phase 12 lessons completed (SSR/hydration, `ChangeDetectionStrategy`, build optimization)
- Node.js 18+ (required by Angular SSR)

---

## Project Structure

```
blog-platform/
└── src/app/
    ├── app.routes.ts
    ├── app.routes.server.ts
    ├── app.config.ts
    ├── app.config.server.ts
    ├── app.component.ts
    ├── models/
    │   └── post.model.ts
    ├── services/
    │   ├── post.service.ts
    │   └── post.service.spec.ts
    └── pages/
        ├── post-list/
        │   ├── post-list.component.ts
        │   └── post-list.component.spec.ts
        └── post-detail/
            ├── post-detail.component.ts
            └── post-detail.component.spec.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app with SSR enabled

```bash
ng new blog-platform --standalone --style=css --routing=true --ssr
cd blog-platform
```

The `--ssr` flag adds `app.config.server.ts`, `app.routes.server.ts`, a `server.ts` entry point, and the `@angular/ssr` dependency automatically.

### Step 2 — Model: `src/app/models/post.model.ts`

```typescript
export interface Post {
  id: number;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string;
}
```

### Step 3 — `PostService` with in-memory data: `src/app/services/post.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';
import { Post } from '../models/post.model';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly _posts = signal<Post[]>([
    {
      id: 1,
      title: 'Why Standalone Components Simplify Angular',
      excerpt: 'No more NgModules boilerplate...',
      body: 'Standalone components remove the need for NgModules entirely, reducing the ceremony required to bootstrap and share code across an Angular application.',
      publishedAt: '2026-01-10',
    },
    {
      id: 2,
      title: 'A Field Guide to Signals',
      excerpt: 'signal(), computed(), and effect() explained...',
      body: 'Signals give Angular a fine-grained reactivity model. signal() holds state, computed() derives values, and effect() reacts to changes for side effects like logging or persistence.',
      publishedAt: '2026-02-03',
    },
    {
      id: 3,
      title: 'Shipping SSR Without the Headaches',
      excerpt: 'Hydration, transfer state, and OnPush together...',
      body: 'Server-side rendering combined with OnPush change detection and the TransferState API gives users a fast first paint without duplicating data-fetching work on the client.',
      publishedAt: '2026-03-21',
    },
  ]);

  readonly posts = this._posts.asReadonly();

  getById(id: number): Post | undefined {
    return this._posts().find(p => p.id === id);
  }
}
```

### Step 4 — Test the service: `src/app/services/post.service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { PostService } from './post.service';

describe('PostService', () => {
  let service: PostService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PostService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose a non-empty list of posts', () => {
    expect(service.posts().length).toBeGreaterThan(0);
  });

  it('getById should return the matching post', () => {
    const post = service.getById(2);
    expect(post?.title).toContain('Signals');
  });

  it('getById should return undefined for an unknown id', () => {
    expect(service.getById(999)).toBeUndefined();
  });
});
```

### Step 5 — `PostListComponent` with `OnPush`: `src/app/pages/post-list/post-list.component.ts`

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostService } from '../../services/post.service';

@Component({
  selector: 'app-post-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Blog</h1>
    <ul>
      @for (post of postService.posts(); track post.id) {
        <li>
          <a [routerLink]="['/posts', post.id]">{{ post.title }}</a>
          <p>{{ post.excerpt }}</p>
          <time>{{ post.publishedAt }}</time>
        </li>
      }
    </ul>
  `,
})
export class PostListComponent {
  readonly postService = inject(PostService);
}
```

### Step 6 — Test the list component: `src/app/pages/post-list/post-list.component.spec.ts`

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PostListComponent } from './post-list.component';

describe('PostListComponent', () => {
  let fixture: ComponentFixture<PostListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostListComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PostListComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render one <li> per post', () => {
    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(fixture.componentInstance.postService.posts().length);
  });

  it('should render each post title as a link', () => {
    const links: HTMLAnchorElement[] = fixture.nativeElement.querySelectorAll('a');
    const titles = fixture.componentInstance.postService.posts().map(p => p.title);
    links.forEach((link, i) => expect(link.textContent).toContain(titles[i]));
  });
});
```

### Step 7 — `PostDetailComponent` with `OnPush`: `src/app/pages/post-detail/post-detail.component.ts`

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService } from '../../services/post.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (post) {
      <a routerLink="/posts">← Back to blog</a>
      <h1>{{ post.title }}</h1>
      <time>{{ post.publishedAt }}</time>
      <p>{{ post.body }}</p>
    } @else {
      <p>Post not found.</p>
    }
  `,
})
export class PostDetailComponent {
  private readonly postService = inject(PostService);
  post = this.postService.getById(Number(inject(ActivatedRoute).snapshot.paramMap.get('id')));
}
```

### Step 8 — Test the detail component: `src/app/pages/post-detail/post-detail.component.spec.ts`

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { PostDetailComponent } from './post-detail.component';

describe('PostDetailComponent', () => {
  async function setup(id: string) {
    await TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => id } } },
        },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<PostDetailComponent> = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should render the matching post title', async () => {
    const fixture = await setup('2');
    expect(fixture.nativeElement.textContent).toContain('A Field Guide to Signals');
  });

  it('should show a not-found message for an unknown id', async () => {
    const fixture = await setup('999');
    expect(fixture.nativeElement.textContent).toContain('Post not found.');
  });
});
```

### Step 9 — Routes: `src/app/app.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'posts', pathMatch: 'full' },
  {
    path: 'posts',
    loadComponent: () => import('./pages/post-list/post-list.component').then(m => m.PostListComponent),
  },
  {
    path: 'posts/:id',
    loadComponent: () => import('./pages/post-detail/post-detail.component').then(m => m.PostDetailComponent),
  },
];
```

### Step 10 — Run the unit test suite

```bash
ng test --no-watch --code-coverage
```

Open `coverage/blog-platform/index.html` afterward and confirm `PostService`, `PostListComponent`, and `PostDetailComponent` all show meaningful line/branch coverage.

### Step 11 — Build and run with SSR locally

```bash
ng build
node dist/blog-platform/server/server.mjs
```

Open `http://localhost:4000` (the port `server.mjs` logs on startup) and view the page source — the fully rendered HTML (post titles, excerpts) should be present before any client-side JavaScript executes, confirming SSR is working. Angular's hydration then "takes over" the existing DOM on the client without re-rendering it from scratch.

### Step 12 — Wire a CI-ready npm script

Add this to `package.json`:

```json
{
  "scripts": {
    "ci": "ng lint && ng test --no-watch --no-progress --browsers=ChromeHeadless --code-coverage && ng build"
  }
}
```

This single command is what a GitHub Actions / GitLab CI job would invoke: lint → test (headless, single run) → production build, failing fast at whichever stage breaks.

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| Unit tests pass | `ng test --no-watch --code-coverage` | All specs green; coverage report generated in `coverage/` |
| SSR renders server-side | `curl -s http://localhost:4000 \| grep "Field Guide"` (after Step 11) | Post title text found in the raw HTML response, before any client JS runs |
| Hydration works | Load the page in a browser, check the console | No "hydration mismatch" warnings; app is interactive without a full re-render |
| OnPush is effective | Inspect components in Angular DevTools | `PostListComponent` and `PostDetailComponent` show `OnPush` strategy; no unnecessary re-renders on unrelated state changes |
| CI script succeeds | `npm run ci` | Lint, tests, and build all complete successfully in sequence with a non-zero exit only on real failures |
| Production bundle size | `ng build` output summary | Initial bundle stays within Angular's default budget warnings (no unexpected size regressions) |

---

## Stretch Goals

1. **TransferState** — use Angular's `TransferState` API to avoid re-fetching post data on the client after SSR already rendered it.
2. **E2E smoke test** — add a minimal Playwright or Cypress test that loads `/posts`, clicks the first post, and asserts the detail page renders.
3. **Prerendering** — use `ng build` with the `prerender` route config (via `app.routes.server.ts`) to fully prerender the post list at build time.
4. **Lighthouse budget** — run a Lighthouse CI check against the production build and set a performance budget threshold that fails the build if missed.
5. **Dockerize the SSR server** — write a `Dockerfile` that builds the app and runs `node dist/blog-platform/server/server.mjs`, tying this course back to the Docker course's multi-stage build patterns.
