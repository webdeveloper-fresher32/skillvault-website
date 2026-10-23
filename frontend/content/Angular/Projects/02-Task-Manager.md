# Project 2 — Task Manager

**Level:** Beginner-Intermediate
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 5 – Services & DI (builds on Phase 3-4 components/pipes)

---

## Overview

You will build a task manager where every piece of state — the task list, the active filter, the counts — lives inside a single injectable `TaskService` built on `signal()` and `computed()`, instead of scattering state across component fields. Sibling components (an input form, a filter bar, and a task list) all read and write through the shared service, which is the cleanest way to learn dependency injection and Signal-based state sharing before you meet full state-management libraries later in the course.

---

## Prerequisites

- Project 1 completed or equivalent comfort with standalone components and `@for`/`@if`
- Phase 5 lessons completed (`@Injectable`, `providedIn: 'root'`, constructor/`inject()` injection)

---

## Project Structure

```
task-manager/
└── src/app/
    ├── app.component.ts
    ├── models/
    │   └── task.model.ts
    ├── services/
    │   └── task.service.ts
    └── components/
        ├── task-form/
        │   └── task-form.component.ts
        ├── task-filter/
        │   └── task-filter.component.ts
        └── task-list/
            └── task-list.component.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app

```bash
ng new task-manager --standalone --style=css --routing=false
cd task-manager
```

### Step 2 — Define the model: `src/app/models/task.model.ts`

```typescript
export interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: number;
}

export type TaskFilter = 'all' | 'active' | 'completed';
```

### Step 3 — Build the service: `src/app/services/task.service.ts`

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { Task, TaskFilter } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly _tasks = signal<Task[]>([]);
  private readonly _filter = signal<TaskFilter>('all');

  readonly filter = this._filter.asReadonly();

  readonly filteredTasks = computed(() => {
    const tasks = this._tasks();
    switch (this._filter()) {
      case 'active':    return tasks.filter(t => !t.completed);
      case 'completed': return tasks.filter(t => t.completed);
      default:          return tasks;
    }
  });

  readonly activeCount = computed(() => this._tasks().filter(t => !t.completed).length);
  readonly completedCount = computed(() => this._tasks().filter(t => t.completed).length);

  addTask(title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this._tasks.update(tasks => [
      ...tasks,
      { id: Date.now(), title: trimmed, completed: false, createdAt: Date.now() },
    ]);
  }

  toggleTask(id: number): void {
    this._tasks.update(tasks =>
      tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  }

  deleteTask(id: number): void {
    this._tasks.update(tasks => tasks.filter(t => t.id !== id));
  }

  clearCompleted(): void {
    this._tasks.update(tasks => tasks.filter(t => !t.completed));
  }

  setFilter(filter: TaskFilter): void {
    this._filter.set(filter);
  }
}
```

### Step 4 — `TaskFormComponent`: `src/app/components/task-form/task-form.component.ts`

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="submit()">
      <input
        [(ngModel)]="title"
        name="title"
        placeholder="What needs doing?"
        autocomplete="off" />
      <button type="submit">Add task</button>
    </form>
  `,
})
export class TaskFormComponent {
  private readonly taskService = inject(TaskService);
  title = '';

  submit(): void {
    this.taskService.addTask(this.title);
    this.title = '';
  }
}
```

### Step 5 — `TaskFilterComponent`: `src/app/components/task-filter/task-filter.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TaskFilter } from '../../models/task.model';

@Component({
  selector: 'app-task-filter',
  standalone: true,
  template: `
    <div class="filters">
      @for (f of filters; track f) {
        <button
          type="button"
          [class.active]="taskService.filter() === f"
          (click)="taskService.setFilter(f)">
          {{ f }}
        </button>
      }
      <span class="count">{{ taskService.activeCount() }} left</span>
      <button type="button" (click)="taskService.clearCompleted()">
        Clear completed ({{ taskService.completedCount() }})
      </button>
    </div>
  `,
})
export class TaskFilterComponent {
  readonly taskService = inject(TaskService);
  readonly filters: TaskFilter[] = ['all', 'active', 'completed'];
}
```

### Step 6 — `TaskListComponent`: `src/app/components/task-list/task-list.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-list',
  standalone: true,
  template: `
    @if (taskService.filteredTasks().length === 0) {
      <p class="empty">Nothing here — enjoy the silence.</p>
    } @else {
      <ul>
        @for (task of taskService.filteredTasks(); track task.id) {
          <li [class.completed]="task.completed">
            <label>
              <input
                type="checkbox"
                [checked]="task.completed"
                (change)="taskService.toggleTask(task.id)" />
              {{ task.title }}
            </label>
            <button type="button" (click)="taskService.deleteTask(task.id)">✕</button>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    li { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; }
    li.completed label { text-decoration: line-through; color: #999; }
  `],
})
export class TaskListComponent {
  readonly taskService = inject(TaskService);
}
```

### Step 7 — Wire up `AppComponent`: `src/app/app.component.ts`

```typescript
import { Component } from '@angular/core';
import { TaskFormComponent } from './components/task-form/task-form.component';
import { TaskFilterComponent } from './components/task-filter/task-filter.component';
import { TaskListComponent } from './components/task-list/task-list.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TaskFormComponent, TaskFilterComponent, TaskListComponent],
  template: `
    <h1>Task Manager</h1>
    <app-task-form />
    <app-task-filter />
    <app-task-list />
  `,
})
export class AppComponent {}
```

### Step 8 — Run it

```bash
ng serve -o
```

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| Add task | Type a title and submit the form | New task appears at the bottom of the list, input clears |
| Toggle complete | Click a task's checkbox | Task gets a strikethrough; "left" counter decrements |
| Filter | Click "active" / "completed" / "all" | List shows only the matching subset; active filter button is highlighted |
| Delete | Click ✕ on a task | Task disappears immediately |
| Clear completed | Complete two tasks, click "Clear completed" | Both disappear; counter resets to 0 |
| Shared state | Open the app in two components simultaneously (e.g. filter bar + list) | Both reflect the same underlying signal — no prop drilling needed |

---

## Stretch Goals

1. **Persistence** — persist tasks to `localStorage` inside the service using an `effect()` that runs whenever `_tasks` changes, and hydrate on startup.
2. **Edit in place** — double-click a task's title to turn it into an editable `<input>`.
3. **Due dates** — add an optional due date field and sort overdue tasks to the top using a `computed()`.
4. **Drag-to-reorder** — use the Angular CDK's `DragDropModule` to let users reorder tasks.
5. **Unit test the service** — write a spec for `TaskService` covering `addTask`, `toggleTask`, and the `filteredTasks`/`activeCount` computed signals (a good warm-up for Phase 11).
