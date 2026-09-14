# Project 1 — Recipe Card Gallery

**Level:** Beginner
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 3 – Components & Templates (Phase 4 – Directives & Pipes helps but is not required)

---

## Overview

You will build a small, purely presentational component library — no services, no routing, no HTTP — and use it to render a gallery of recipe cards from a hard-coded array of data. The goal is to build muscle memory with standalone components, `@Input()`/`@Output()` bindings, the new `@if`/`@for` control-flow blocks, a built-in directive, and a custom pipe.

---

## Prerequisites

- Node.js and the Angular CLI installed (`npm install -g @angular/cli`)
- Phase 3 lessons completed (components, templates, interpolation, bindings, control flow)

---

## Project Structure

```
recipe-card-gallery/
└── src/app/
    ├── app.component.ts
    ├── models/
    │   └── recipe.model.ts
    ├── data/
    │   └── recipes.ts
    ├── pipes/
    │   └── cook-time.pipe.ts
    └── components/
        ├── recipe-card/
        │   └── recipe-card.component.ts
        ├── rating-stars/
        │   └── rating-stars.component.ts
        └── tag-list/
            └── tag-list.component.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app

```bash
ng new recipe-card-gallery --standalone --style=css --routing=false
cd recipe-card-gallery
```

### Step 2 — Define the model: `src/app/models/recipe.model.ts`

```typescript
export interface Recipe {
  id: number;
  title: string;
  imageUrl: string;
  cookTimeMinutes: number;
  rating: number;       // 0 – 5
  tags: string[];
  isFavorite: boolean;
}
```

### Step 3 — Seed some data: `src/app/data/recipes.ts`

```typescript
import { Recipe } from '../models/recipe.model';

export const RECIPES: Recipe[] = [
  { id: 1, title: 'Margherita Pizza', imageUrl: 'https://picsum.photos/seed/pizza/400/250', cookTimeMinutes: 75, rating: 4, tags: ['Italian', 'Vegetarian'], isFavorite: true },
  { id: 2, title: 'Chicken Tikka Masala', imageUrl: 'https://picsum.photos/seed/tikka/400/250', cookTimeMinutes: 55, rating: 5, tags: ['Indian', 'Spicy'], isFavorite: false },
  { id: 3, title: 'Avocado Toast', imageUrl: 'https://picsum.photos/seed/toast/400/250', cookTimeMinutes: 10, rating: 3, tags: ['Breakfast', 'Vegan'], isFavorite: false },
  { id: 4, title: 'Beef Bourguignon', imageUrl: 'https://picsum.photos/seed/beef/400/250', cookTimeMinutes: 195, rating: 5, tags: ['French', 'Slow-cook'], isFavorite: true },
];
```

### Step 4 — Custom pipe: `src/app/pipes/cook-time.pipe.ts`

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'cookTime', standalone: true })
export class CookTimePipe implements PipeTransform {
  transform(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
}
```

### Step 5 — `RatingStarsComponent`: `src/app/components/rating-stars/rating-stars.component.ts`

```typescript
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  template: `
    <span class="stars" [attr.aria-label]="rating + ' out of 5 stars'">
      @for (i of [1, 2, 3, 4, 5]; track i) {
        <span [class.filled]="i <= rating">★</span>
      }
    </span>
  `,
  styles: [`
    .stars span { color: #ddd; font-size: 1.1rem; }
    .stars span.filled { color: #f5a623; }
  `],
})
export class RatingStarsComponent {
  @Input({ required: true }) rating = 0;
}
```

### Step 6 — `TagListComponent`: `src/app/components/tag-list/tag-list.component.ts`

```typescript
import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-tag-list',
  standalone: true,
  imports: [NgClass],
  template: `
    <ul class="tags">
      @for (tag of tags; track tag) {
        <li [ngClass]="{ 'tag--spicy': tag === 'Spicy' }">{{ tag }}</li>
      }
    </ul>
  `,
  styles: [`
    .tags { display: flex; gap: 0.4rem; list-style: none; padding: 0; margin: 0.5rem 0 0; }
    .tags li { background: #eef1f6; border-radius: 12px; padding: 0.15rem 0.7rem; font-size: 0.75rem; }
    .tags li.tag--spicy { background: #ffe1e1; color: #c0392b; }
  `],
})
export class TagListComponent {
  @Input({ required: true }) tags: string[] = [];
}
```

### Step 7 — `RecipeCardComponent`: `src/app/components/recipe-card/recipe-card.component.ts`

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Recipe } from '../../models/recipe.model';
import { CookTimePipe } from '../../pipes/cook-time.pipe';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';
import { TagListComponent } from '../tag-list/tag-list.component';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [CookTimePipe, RatingStarsComponent, TagListComponent],
  template: `
    <article class="card">
      <img [src]="recipe.imageUrl" [alt]="recipe.title" />
      <div class="card__body">
        <header>
          <h3>{{ recipe.title }}</h3>
          <button
            type="button"
            class="fav-btn"
            [class.active]="recipe.isFavorite"
            (click)="toggleFavorite.emit(recipe.id)">
            {{ recipe.isFavorite ? '♥' : '♡' }}
          </button>
        </header>
        <p class="meta">
          @if (recipe.cookTimeMinutes > 120) {
            <span class="slow-cook-badge">Slow cook</span>
          }
          {{ recipe.cookTimeMinutes | cookTime }}
        </p>
        <app-rating-stars [rating]="recipe.rating" />
        <app-tag-list [tags]="recipe.tags" />
      </div>
    </article>
  `,
  styles: [`
    .card { border: 1px solid #e2e5eb; border-radius: 10px; overflow: hidden; width: 280px; }
    .card img { width: 100%; height: 160px; object-fit: cover; display: block; }
    .card__body { padding: 0.9rem; }
    header { display: flex; justify-content: space-between; align-items: center; }
    h3 { margin: 0; font-size: 1.05rem; }
    .fav-btn { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #999; }
    .fav-btn.active { color: #e63946; }
    .meta { color: #666; font-size: 0.85rem; margin: 0.3rem 0; }
    .slow-cook-badge { background: #fff3cd; color: #856404; border-radius: 8px; padding: 0 0.4rem; margin-right: 0.4rem; font-size: 0.7rem; }
  `],
})
export class RecipeCardComponent {
  @Input({ required: true }) recipe!: Recipe;
  @Output() toggleFavorite = new EventEmitter<number>();
}
```

### Step 8 — Wire up `AppComponent`: `src/app/app.component.ts`

```typescript
import { Component } from '@angular/core';
import { RECIPES } from './data/recipes';
import { Recipe } from './models/recipe.model';
import { RecipeCardComponent } from './components/recipe-card/recipe-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RecipeCardComponent],
  template: `
    <h1>Recipe Gallery</h1>
    @if (recipes.length === 0) {
      <p>No recipes yet — add one!</p>
    } @else {
      <div class="gallery">
        @for (recipe of recipes; track recipe.id) {
          <app-recipe-card
            [recipe]="recipe"
            (toggleFavorite)="onToggleFavorite($event)" />
        }
      </div>
    }
  `,
  styles: [`
    .gallery { display: flex; flex-wrap: wrap; gap: 1rem; }
  `],
})
export class AppComponent {
  recipes: Recipe[] = RECIPES;

  onToggleFavorite(id: number) {
    const recipe = this.recipes.find(r => r.id === id);
    if (recipe) recipe.isFavorite = !recipe.isFavorite;
  }
}
```

### Step 9 — Run it

```bash
ng serve -o
```

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| Gallery renders | Open `http://localhost:4200` | Four recipe cards displayed in a wrapping grid |
| Cook-time pipe | Look at "Beef Bourguignon" | Shows `3h 15m` and a "Slow cook" badge |
| Rating stars | Look at "Avocado Toast" | Exactly 3 of 5 stars filled |
| Favorite toggle | Click the heart icon on any card | Icon fills red immediately (no page reload) |
| Empty state | Temporarily set `recipes = []` in `AppComponent` | "No recipes yet — add one!" message shown instead of the grid |

---

## Stretch Goals

1. **Search box** — add an `<input>` bound with `[(ngModel)]` (or a signal) that filters the gallery by title as you type.
2. **Custom structural directive** — write a `*appHighlightIfSpicy` attribute directive that outlines any card containing the "Spicy" tag.
3. **Sort control** — add a dropdown to sort recipes by rating or cook time using a pure pipe.
4. **Skeleton loading state** — simulate an async data load with `setTimeout` and show skeleton placeholder cards until it resolves.
5. **Accessibility pass** — audit the gallery with a screen reader and add any missing `aria-*` attributes.
