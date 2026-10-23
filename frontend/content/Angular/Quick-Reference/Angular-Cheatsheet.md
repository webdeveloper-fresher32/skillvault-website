# Angular Cheatsheet

---

### Angular CLI

```bash
npm install -g @angular/cli                          # Install the CLI globally
ng new my-app                                         # Create a new workspace/app
ng new my-app --standalone --routing --style=scss    # New app, standalone APIs, routing, SCSS
ng serve                                              # Serve app on http://localhost:4200
ng serve --open                                       # Serve and open browser automatically
ng serve --port 4300                                 # Serve on a custom port
ng build                                              # Production build (outputs to dist/)
ng build --configuration development                 # Dev-mode build
ng test                                               # Run unit tests (Karma/Jasmine or Jest)
ng e2e                                                # Run end-to-end tests

ng generate component my-widget                       # Scaffold a component (shorthand: ng g c)
ng g c features/my-widget --standalone                # Standalone component in a subfolder
ng g service data/user --skip-tests                  # Scaffold a service without a spec file
ng g directive shared/highlight                       # Scaffold a directive
ng g pipe shared/truncate                             # Scaffold a pipe
ng g guard auth/auth --functional                    # Scaffold a functional route guard
ng g interceptor core/auth                           # Scaffold an HTTP interceptor
ng g module legacy/reports                           # Scaffold an NgModule (legacy pattern)
ng g interface models/user                           # Scaffold a TypeScript interface

ng add @angular/material                              # Add and configure a library/schematic
ng update                                             # Check for framework updates
ng update @angular/core @angular/cli                 # Update Angular core + CLI together
ng lint                                               # Run configured linter
ng version                                            # Show Angular/CLI/Node version info
```

---

### Workspace Structure

```text
my-app/
├── src/
│   ├── app/
│   │   ├── app.component.ts        # Root standalone component
│   │   ├── app.config.ts           # Application-wide providers (DI, router, HttpClient)
│   │   ├── app.routes.ts           # Route configuration
│   ├── main.ts                     # Bootstraps the app via bootstrapApplication()
│   ├── index.html
│   └── styles.scss
├── angular.json                    # Workspace/build configuration
├── tsconfig.json                   # TypeScript compiler options
└── package.json
```

```ts
// main.ts — bootstrapping a standalone app
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig);
```

---

### Components

```ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [/* CommonModule, other standalone components/directives/pipes */],
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.scss',
})
export class UserCardComponent {
  @Input() name!: string;
  @Input({ required: true }) userId!: number;
  @Output() selected = new EventEmitter<number>();

  onClick() {
    this.selected.emit(this.userId);
  }
}
```

```html
<!-- Data binding -->
<p>{{ name }}</p>                          <!-- Interpolation -->
<img [src]="imageUrl" [alt]="name" />       <!-- Property binding -->
<button (click)="onClick()">Select</button> <!-- Event binding -->
<input [(ngModel)]="searchTerm" />          <!-- Two-way binding (needs FormsModule) -->
<div [class.active]="isActive"></div>       <!-- Class binding -->
<div [style.color]="color"></div>           <!-- Style binding -->
```

---

### Modern Control Flow (`@if` / `@for` / `@switch` / `@defer`)

```html
@if (user(); as u) {
  <p>Welcome, {{ u.name }}</p>
} @else if (loading()) {
  <p>Loading...</p>
} @else {
  <p>No user found.</p>
}

@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>No items available.</li>
}

@switch (status()) {
  @case ('active') { <span class="badge-green">Active</span> }
  @case ('paused') { <span class="badge-yellow">Paused</span> }
  @default { <span class="badge-gray">Unknown</span> }
}

@defer (on viewport) {
  <heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="skeleton"></div>
} @loading (minimum 500ms) {
  <app-spinner />
} @error {
  <p>Failed to load chart.</p>
}
<!-- other @defer triggers: on idle, on timer(2s), on hover, on interaction, on immediate -->
```

---

### Directives

```ts
import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
  standalone: true,
})
export class HighlightDirective {
  private el = inject(ElementRef);
  @Input() appHighlight = 'yellow';

  @HostListener('mouseenter') onEnter() {
    this.el.nativeElement.style.backgroundColor = this.appHighlight;
  }

  @HostListener('mouseleave') onLeave() {
    this.el.nativeElement.style.backgroundColor = '';
  }
}
```

```html
<p appHighlight="lightblue">Hover over me</p>
<div [ngClass]="{ active: isActive, disabled: isDisabled }"></div>
<div [ngStyle]="{ color: textColor, 'font-size.px': fontSize }"></div>
```

---

### Pipes

```ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 20): string {
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
  }
}
```

```html
{{ price | currency:'USD' }}                 <!-- Built-in pipes -->
{{ createdAt | date:'mediumDate' }}
{{ name | uppercase }}
{{ description | truncate:50 }}              <!-- Custom pipe with parameter -->
{{ user$ | async }}                          <!-- Unwrap an Observable/Promise in the template -->
```

---

### Signals

```ts
import { signal, computed, effect, Signal } from '@angular/core';

const count = signal(0);                     // Writable signal
count.set(5);                                // Set a new value
count.update(v => v + 1);                    // Update based on current value

const doubled = computed(() => count() * 2); // Derived, memoized, read-only signal

effect(() => {                               // Side effect that reruns when dependencies change
  console.log(`Count is now: ${count()}`);
});

// Component input/output/model as signals (Angular 17.1+)
import { input, output, model } from '@angular/core';

export class ProfileComponent {
  userId = input.required<number>();         // Signal-based required input
  theme = input<'light' | 'dark'>('light');  // Signal-based input with default
  saved = output<void>();                    // Signal-based output (replaces EventEmitter)
  isEditing = model(false);                  // Two-way bindable signal: [(isEditing)]
}
```

```html
<app-profile [userId]="42" [(isEditing)]="editMode" (saved)="onSaved()" />
```

---

### Dependency Injection

```ts
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })          // Singleton, tree-shakable, app-wide
export class UserService {
  private http = inject(HttpClient);          // Modern DI via inject() function

  getUser(id: number) {
    return this.http.get<User>(`/api/users/${id}`);
  }
}

// Constructor injection (still valid)
export class UserComponent {
  constructor(private userService: UserService) {}
}

// Injection tokens for non-class dependencies
import { InjectionToken } from '@angular/core';
export const API_URL = new InjectionToken<string>('API_URL');

// app.config.ts — providing values/tokens app-wide
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_URL, useValue: 'https://api.example.com' },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
```

---

### Routing

```ts
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'users/:id', component: UserDetailComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES), // Lazy load
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
  },
  { path: '**', component: NotFoundComponent },  // Wildcard/404 route
];
```

```ts
// Functional route guard
import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.parseUrl('/login');
};

// Functional resolver
export const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService);
  return userService.getUser(route.paramMap.get('id')!);
};
```

```html
<a routerLink="/users/5" routerLinkActive="active">User 5</a>
<router-outlet />
```

```ts
// Programmatic navigation + reading params
constructor(private router: Router, private route: ActivatedRoute) {}
goToUser(id: number) {
  this.router.navigate(['/users', id]);
}
this.route.paramMap.subscribe(params => this.id = params.get('id'));
```

---

### Reactive Forms

```ts
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

export class SignupComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    address: this.fb.group({
      city: [''],
      zip: [''],
    }),
    tags: this.fb.array([]),
  });

  get email() { return this.form.get('email'); }

  submit() {
    if (this.form.valid) {
      console.log(this.form.value);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
```

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <input formControlName="email" />
  <div *ngIf="email?.invalid && email?.touched">Enter a valid email.</div>

  <div formGroupName="address">
    <input formControlName="city" placeholder="City" />
  </div>

  <button type="submit" [disabled]="form.invalid">Sign up</button>
</form>
```

```ts
// Custom validator
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirm')?.value;
    return pass === confirm ? null : { mismatch: true };
  };
}
```

---

### HttpClient & Interceptors

```ts
// Providing HttpClient (standalone)
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor]))],
};
```

```ts
// Service using HttpClient
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getUsers() {
    return this.http.get<User[]>('/api/users');
  }
  createUser(user: Partial<User>) {
    return this.http.post<User>('/api/users', user);
  }
  updateUser(id: number, changes: Partial<User>) {
    return this.http.patch<User>(`/api/users/${id}`, changes);
  }
  deleteUser(id: number) {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
```

```ts
// Functional interceptor
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token;
  const cloned = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(cloned);
};

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) inject(Router).navigate(['/login']);
      return throwError(() => err);
    })
  );
```

---

### RxJS Operators Commonly Used in Angular

```ts
import { map, filter, switchMap, mergeMap, concatMap, exhaustMap, debounceTime,
         distinctUntilChanged, catchError, retry, tap, take, takeUntil, combineLatest } from 'rxjs';

// map / filter — transform and select emitted values
source$.pipe(map(x => x * 2), filter(x => x > 10));

// switchMap — cancel previous inner observable, use latest (typeahead search)
searchTerm$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => this.api.search(term))
);

// mergeMap — run inner observables concurrently (parallel requests)
ids$.pipe(mergeMap(id => this.api.getUser(id)));

// concatMap — queue inner observables, preserve order (sequential writes)
actions$.pipe(concatMap(action => this.api.save(action)));

// exhaustMap — ignore new emissions while an inner observable is active (prevent double-submit)
submitClick$.pipe(exhaustMap(() => this.api.submitForm()));

// catchError / retry — error handling
this.api.getUsers().pipe(retry(2), catchError(err => of([])));

// takeUntil — auto-unsubscribe pattern with a component-level Subject
private destroy$ = new Subject<void>();
this.api.getData().pipe(takeUntil(this.destroy$)).subscribe();
ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

// combineLatest — combine multiple streams, emit whenever any source emits
combineLatest([filters$, page$]).pipe(switchMap(([filters, page]) => this.api.search(filters, page)));
```

---

### Lifecycle Hooks

```ts
export class WidgetComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  ngOnChanges(changes: SimpleChanges) {}   // Fires on every @Input() change
  ngOnInit() {}                            // Once, after first ngOnChanges — init logic here
  ngAfterViewInit() {}                     // Once, after view (and @ViewChild) is initialized
  ngOnDestroy() {}                         // Cleanup: unsubscribe, clear timers/listeners
}
```

---

### Testing (Jasmine/Karma)

```ts
describe('UserCardComponent', () => {
  let fixture: ComponentFixture<UserCardComponent>;
  let component: UserCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent], // standalone components go in imports, not declarations
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should emit selected id on click', () => {
    spyOn(component.selected, 'emit');
    component.userId = 7;
    component.onClick();
    expect(component.selected.emit).toHaveBeenCalledWith(7);
  });
});
```

---

### Performance & Deployment

```ts
// OnPush change detection — component only re-renders on input reference change,
// event, or signal update, not on every zone.js tick
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })

// Track function for @for (avoids full list re-render)
@for (item of items(); track item.id) { ... }
```

```bash
ng build --configuration production                 # Production build with optimizations
ng build --stats-json                                # Emit stats for bundle analysis
npx webpack-bundle-analyzer dist/my-app/stats.json  # Visualize bundle size

ng add @angular/ssr                                  # Add server-side rendering
ng build && ng run my-app:prerender                 # Prerender static routes
```
