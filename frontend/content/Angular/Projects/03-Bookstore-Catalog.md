# Project 3 — Bookstore Catalog

**Level:** Intermediate
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 6 – Routing & Navigation, Phase 7 – Forms

---

## Overview

You will build a multi-page bookstore catalog with three routes: a book list, a book detail page whose data is pre-fetched by a **resolver** before the route activates, and an "Add/Edit Book" page protected by a **route guard** that only lets in users with an admin role (simulated via a service). The add/edit page uses a Reactive Form with custom validators. This project ties routing, guards, resolvers, and forms together into one coherent app.

---

## Prerequisites

- Project 2 completed or equivalent comfort with services and Signals
- Phase 6 lessons completed (Router, route params, lazy loading, guards, resolvers)
- Phase 7 lessons completed (Reactive Forms, validators)

---

## Project Structure

```
bookstore-catalog/
└── src/app/
    ├── app.routes.ts
    ├── app.component.ts
    ├── models/
    │   └── book.model.ts
    ├── services/
    │   ├── book.service.ts
    │   └── auth.service.ts
    ├── guards/
    │   └── admin.guard.ts
    ├── resolvers/
    │   └── book.resolver.ts
    └── pages/
        ├── book-list/
        │   └── book-list.component.ts
        ├── book-detail/
        │   └── book-detail.component.ts
        └── book-form/
            └── book-form.component.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app

```bash
ng new bookstore-catalog --standalone --style=css --routing=true
cd bookstore-catalog
```

### Step 2 — Model: `src/app/models/book.model.ts`

```typescript
export interface Book {
  id: number;
  title: string;
  author: string;
  price: number;
  isbn: string;
}
```

### Step 3 — `BookService`: `src/app/services/book.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';
import { Book } from '../models/book.model';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly _books = signal<Book[]>([
    { id: 1, title: 'Clean Code', author: 'Robert C. Martin', price: 34.99, isbn: '9780132350884' },
    { id: 2, title: 'Effective TypeScript', author: 'Dan Vanderkam', price: 29.99, isbn: '9781492053743' },
    { id: 3, title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', price: 44.99, isbn: '9781449373320' },
  ]);

  readonly books = this._books.asReadonly();

  getById(id: number): Book | undefined {
    return this._books().find(b => b.id === id);
  }

  save(book: Omit<Book, 'id'> & { id?: number }): void {
    if (book.id) {
      this._books.update(books => books.map(b => (b.id === book.id ? { ...b, ...book, id: book.id! } : b)));
    } else {
      this._books.update(books => [...books, { ...book, id: Date.now() }]);
    }
  }
}
```

### Step 4 — `AuthService` (simulated): `src/app/services/auth.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Toggle this to simulate logging in/out as an admin.
  private readonly _isAdmin = signal(false);
  readonly isAdmin = this._isAdmin.asReadonly();

  toggleAdmin(): void {
    this._isAdmin.update(v => !v);
  }
}
```

### Step 5 — Route guard: `src/app/guards/admin.guard.ts`

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  router.navigate(['/books']);
  return false;
};
```

### Step 6 — Resolver: `src/app/resolvers/book.resolver.ts`

```typescript
import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { BookService } from '../services/book.service';
import { Book } from '../models/book.model';

export const bookResolver: ResolveFn<Book | undefined> = (route: ActivatedRouteSnapshot) => {
  const bookService = inject(BookService);
  const id = Number(route.paramMap.get('id'));
  return bookService.getById(id);
};
```

### Step 7 — `BookListComponent`: `src/app/pages/book-list/book-list.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookService } from '../../services/book.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>Catalog</h1>
    <button type="button" (click)="auth.toggleAdmin()">
      {{ auth.isAdmin() ? 'Log out admin' : 'Log in as admin' }}
    </button>
    @if (auth.isAdmin()) {
      <a routerLink="/books/new">+ Add book</a>
    }
    <ul>
      @for (book of bookService.books(); track book.id) {
        <li>
          <a [routerLink]="['/books', book.id]">{{ book.title }}</a> — {{ book.author }}
        </li>
      }
    </ul>
  `,
})
export class BookListComponent {
  readonly bookService = inject(BookService);
  readonly auth = inject(AuthService);
}
```

### Step 8 — `BookDetailComponent`: `src/app/pages/book-detail/book-detail.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Book } from '../../models/book.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (book) {
      <h1>{{ book.title }}</h1>
      <p>by {{ book.author }}</p>
      <p>ISBN: {{ book.isbn }}</p>
      <p>Price: {{ book.price | currency }}</p>
      @if (auth.isAdmin()) {
        <a [routerLink]="['/books', book.id, 'edit']">Edit</a>
      }
    } @else {
      <p>Book not found.</p>
    }
    <a routerLink="/books">Back to catalog</a>
  `,
})
export class BookDetailComponent {
  readonly auth = inject(AuthService);
  book: Book | undefined = inject(ActivatedRoute).snapshot.data['book'];
}
```

### Step 9 — `BookFormComponent`: `src/app/pages/book-form/book-form.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookService } from '../../services/book.service';

@Component({
  selector: 'app-book-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <h1>{{ editingId ? 'Edit' : 'Add' }} Book</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Title
        <input formControlName="title" />
        @if (form.controls.title.invalid && form.controls.title.touched) {
          <small class="error">Title is required.</small>
        }
      </label>
      <label>
        Author
        <input formControlName="author" />
      </label>
      <label>
        Price
        <input type="number" step="0.01" formControlName="price" />
        @if (form.controls.price.errors?.['min']) {
          <small class="error">Price must be positive.</small>
        }
      </label>
      <label>
        ISBN
        <input formControlName="isbn" />
        @if (form.controls.isbn.errors?.['pattern']) {
          <small class="error">ISBN must be 13 digits.</small>
        }
      </label>
      <button type="submit" [disabled]="form.invalid">Save</button>
    </form>
  `,
})
export class BookFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  editingId = Number(this.route.snapshot.paramMap.get('id')) || undefined;

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    author: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0.01)]],
    isbn: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
  });

  constructor() {
    if (this.editingId) {
      const existing = this.bookService.getById(this.editingId);
      if (existing) this.form.patchValue(existing);
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.bookService.save({ id: this.editingId, ...this.form.getRawValue() });
    this.router.navigate(['/books']);
  }
}
```

### Step 10 — Routes: `src/app/app.routes.ts`

```typescript
import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { bookResolver } from './resolvers/book.resolver';

export const routes: Routes = [
  { path: '', redirectTo: 'books', pathMatch: 'full' },
  {
    path: 'books',
    loadComponent: () => import('./pages/book-list/book-list.component').then(m => m.BookListComponent),
  },
  {
    path: 'books/new',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/book-form/book-form.component').then(m => m.BookFormComponent),
  },
  {
    path: 'books/:id',
    resolve: { book: bookResolver },
    loadComponent: () => import('./pages/book-detail/book-detail.component').then(m => m.BookDetailComponent),
  },
  {
    path: 'books/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/book-form/book-form.component').then(m => m.BookFormComponent),
  },
];
```

### Step 11 — `AppComponent`: `src/app/app.component.ts`

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

### Step 12 — Run it

```bash
ng serve -o
```

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| List renders | Navigate to `/books` | Three seeded books listed with links |
| Detail + resolver | Click a book title | Detail page shows immediately with title/author/ISBN/price already populated (no loading flash) |
| Guard blocks non-admins | While logged out, navigate directly to `/books/new` | Redirected back to `/books` |
| Guard allows admins | Click "Log in as admin", then "+ Add book" | Add-book form loads |
| Form validation | Submit the add-book form empty | Submit button stays disabled; inline errors shown for empty title/invalid ISBN |
| Edit flow | As admin, open a book, click "Edit", change the price, save | Returns to `/books`; new price visible on the detail page |
| Lazy loading | Open browser dev tools → Network tab while navigating | Each route's component chunk loads on demand, not all at once |

---

## Stretch Goals

1. **CanDeactivate guard** — warn the user with a confirm dialog if they navigate away from an unsaved, dirty form.
2. **Search + query params** — add a search box that filters the list and reflects the query in the URL (`/books?q=clean`).
3. **404 route** — add a wildcard route with a friendly "Book not found" page instead of relying on the resolver returning `undefined`.
4. **Persisted admin state** — persist the `AuthService` admin flag to `sessionStorage`.
5. **Route animations** — add a fade/slide transition between routes using Angular's animation package.
