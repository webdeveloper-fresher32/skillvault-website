# Project 4 — E-commerce Storefront

**Level:** Intermediate-Advanced
**Time estimate:** 120 – 150 minutes
**Phase prerequisite:** Phase 8 – HTTP & Interceptors (builds on Phase 5-7 services, routing, forms)

---

## Overview

You will build a storefront that fetches a real product catalog from the public [Fake Store API](https://fakestoreapi.com/), routes an outbound HTTP interceptor through every request to attach headers and centralize error handling, holds cart state in Signals so totals and the cart badge update reactively, and validates checkout through a Reactive Form. This project is where HTTP, interceptors, Signals, and forms come together into a single realistic app.

---

## Prerequisites

- Project 3 completed or equivalent comfort with routing and Reactive Forms
- Phase 8 lessons completed (`HttpClient`, functional interceptors, error handling, retries)
- An internet connection (the app calls `https://fakestoreapi.com`)

---

## Project Structure

```
ecommerce-storefront/
└── src/app/
    ├── app.routes.ts
    ├── app.config.ts
    ├── app.component.ts
    ├── models/
    │   ├── product.model.ts
    │   └── cart-item.model.ts
    ├── services/
    │   ├── product.service.ts
    │   └── cart.service.ts
    ├── interceptors/
    │   └── api.interceptor.ts
    └── pages/
        ├── product-list/
        │   └── product-list.component.ts
        ├── product-detail/
        │   └── product-detail.component.ts
        └── checkout/
            └── checkout.component.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app

```bash
ng new ecommerce-storefront --standalone --style=css --routing=true
cd ecommerce-storefront
```

### Step 2 — Models

`src/app/models/product.model.ts`

```typescript
export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
}
```

`src/app/models/cart-item.model.ts`

```typescript
import { Product } from './product.model';

export interface CartItem {
  product: Product;
  quantity: number;
}
```

### Step 3 — Functional interceptor: `src/app/interceptors/api.interceptor.ts`

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authedReq = req.clone({
    setHeaders: { 'X-Client': 'angular-storefront' },
  });

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      console.error(`API error on ${req.method} ${req.url}:`, err.status, err.message);
      return throwError(() => err);
    }),
  );
};
```

### Step 4 — Register HTTP + the interceptor: `src/app/app.config.ts`

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiInterceptor } from './interceptors/api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor])),
  ],
};
```

### Step 5 — `ProductService`: `src/app/services/product.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://fakestoreapi.com/products';

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }
}
```

### Step 6 — `CartService` (Signal-based): `src/app/services/cart.service.ts`

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../models/cart-item.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() => this._items().reduce((sum, i) => sum + i.quantity, 0));
  readonly total = computed(() => this._items().reduce((sum, i) => sum + i.product.price * i.quantity, 0));

  add(product: Product): void {
    this._items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      if (existing) {
        return items.map(i => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...items, { product, quantity: 1 }];
    });
  }

  remove(productId: number): void {
    this._items.update(items => items.filter(i => i.product.id !== productId));
  }

  clear(): void {
    this._items.set([]);
  }
}
```

### Step 7 — `ProductListComponent`: `src/app/pages/product-list/product-list.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, RouterLink],
  template: `
    <h1>Products</h1>
    <a routerLink="/checkout">Cart ({{ cart.itemCount() }})</a>
    @if (products$ | async; as products) {
      <div class="grid">
        @for (product of products; track product.id) {
          <div class="product">
            <a [routerLink]="['/products', product.id]">
              <img [src]="product.image" [alt]="product.title" />
              <h3>{{ product.title }}</h3>
            </a>
            <p>{{ product.price | currency }}</p>
            <button type="button" (click)="cart.add(product)">Add to cart</button>
          </div>
        }
      </div>
    } @else {
      <p>Loading products…</p>
    }
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
    .product img { width: 100%; height: 140px; object-fit: contain; }
  `],
})
export class ProductListComponent {
  private readonly productService = inject(ProductService);
  readonly cart = inject(CartService);
  products$: Observable<Product[]> = this.productService.getAll();
}
```

### Step 8 — `ProductDetailComponent`: `src/app/pages/product-detail/product-detail.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, RouterLink],
  template: `
    @if (product$ | async; as product) {
      <a routerLink="/products">← Back</a>
      <img [src]="product.image" [alt]="product.title" />
      <h1>{{ product.title }}</h1>
      <p>{{ product.description }}</p>
      <p><strong>{{ product.price | currency }}</strong></p>
      <button type="button" (click)="cart.add(product)">Add to cart</button>
    }
  `,
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  readonly cart = inject(CartService);

  product$: Observable<Product> = this.route.paramMap.pipe(
    switchMap(params => this.productService.getById(Number(params.get('id')))),
  );
}
```

### Step 9 — `CheckoutComponent`: `src/app/pages/checkout/checkout.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <h1>Checkout</h1>
    @if (cart.items().length === 0) {
      <p>Your cart is empty.</p>
    } @else {
      <ul>
        @for (item of cart.items(); track item.product.id) {
          <li>
            {{ item.product.title }} × {{ item.quantity }}
            — {{ item.product.price * item.quantity | currency }}
            <button type="button" (click)="cart.remove(item.product.id)">Remove</button>
          </li>
        }
      </ul>
      <p><strong>Total: {{ cart.total() | currency }}</strong></p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Full name
          <input formControlName="name" />
        </label>
        <label>
          Email
          <input type="email" formControlName="email" />
          @if (form.controls.email.errors?.['email']) {
            <small class="error">Enter a valid email.</small>
          }
        </label>
        <label>
          Shipping address
          <textarea formControlName="address"></textarea>
        </label>
        <button type="submit" [disabled]="form.invalid">Place order</button>
      </form>
    }
  `,
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required, Validators.minLength(10)]],
  });

  submit(): void {
    if (this.form.invalid || this.cart.items().length === 0) return;
    // In a real app this would POST to an orders endpoint.
    this.cart.clear();
    this.router.navigate(['/products']);
  }
}
```

### Step 10 — Routes: `src/app/app.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  {
    path: 'products',
    loadComponent: () => import('./pages/product-list/product-list.component').then(m => m.ProductListComponent),
  },
  {
    path: 'products/:id',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
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
| Product list loads | Open `http://localhost:4200` | Grid of real products fetched from Fake Store API |
| Interceptor header | Open dev tools → Network → a `products` request → Headers | `X-Client: angular-storefront` present on the request |
| Add to cart | Click "Add to cart" on two different products | Cart badge count updates immediately without a page reload |
| Detail route | Click a product image/title | Navigates to `/products/:id` and shows full description and price |
| Checkout totals | Add several items, go to `/checkout` | Line items and total match `price × quantity` sums |
| Form validation | Submit checkout with an invalid email | Submit button disabled; inline error shown |
| Order placed | Fill the form correctly and submit | Cart clears and you're redirected to `/products` |
| Error handling | Temporarily point `baseUrl` at a bad URL and reload | Console shows the interceptor's logged error instead of an unhandled exception |

---

## Stretch Goals

1. **Category filter** — add a dropdown backed by `GET /products/categories` to filter the product grid.
2. **Loading & error states** — replace the bare "Loading products…" text with a proper spinner and an error banner when the API call fails.
3. **Retry policy** — add `retry({ count: 2, delay: 1000 })` to `ProductService.getAll()` for resilience against transient network blips.
4. **Persist the cart** — use an `effect()` in `CartService` to sync cart contents to `localStorage` and rehydrate on app start.
5. **Auth interceptor** — add a second interceptor that attaches a fake bearer token and redirects to a login page on `401` responses.
