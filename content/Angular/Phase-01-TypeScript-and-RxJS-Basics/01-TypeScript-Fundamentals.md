# TypeScript Fundamentals for Angular

Angular is written in TypeScript and expects you to use it. If you are coming from plain JavaScript (or React with JS), this quick guide covers the primary TypeScript features you will use every day in Angular.

## 1. Types & Interfaces

The most common thing you'll do is type your component state, API responses, and function signatures.

```typescript
// Primitives
let userName: string = 'Alice';
let age: number = 28;
let isActive: boolean = true;

// Arrays
let items: string[] = ['Apple', 'Banana'];
let scores: Array<number> = [10, 20]; // alternative syntax

// Interfaces (Preferred for object shapes)
export interface User {
  id: number;
  name: string;
  email: string;
  role?: 'admin' | 'user'; // Optional and union types
}

// Using the interface
let currentUser: User = {
  id: 1,
  name: 'Bob',
  email: 'bob@example.com'
};
```

## 2. Classes and Access Modifiers

Angular relies heavily on classes (components, services, pipes are all classes). TypeScript gives you access modifiers to enforce visibility.

```typescript
export class UserService {
  // Public by default. Available everywhere.
  public activeUsers: User[] = [];

  // Private. Only accessible within this class.
  private apiUrl: string = 'https://api.example.com/users';

  // Protected. Accessible within this class and subclasses.
  protected cacheKey: string = 'USERS_CACHE';

  // Constructor shorthand syntax for dependency injection
  // This automatically creates a private property `http` and assigns it.
  constructor(private http: HttpClient) {}

  public getUser(id: number): User | null {
    // ...
    return null;
  }
}
```

## 3. Generics

Generics allow you to write reusable code that can work over a variety of types rather than a single one. You will use Generics heavily with `HttpClient` and `Signals`.

```typescript
// A generic wrapper for API responses
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Using it with our User interface
let response: ApiResponse<User[]> = {
  data: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
  status: 200,
  message: 'Success'
};
```

## 4. Decorators

Angular uses decorators heavily. Decorators are essentially functions that add metadata to classes, methods, or properties.

```typescript
@Component({
  selector: 'app-user-profile',
  standalone: true,
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent {
  @Input() user!: User; // Property decorator
}
```

*Note: The `!` is the non-null assertion operator. It tells TypeScript "I know this isn't initialized here, but it will be initialized by Angular (as an input) before I use it."*

---
**Up Next:** Move to `02-RxJS-Observables.md` to learn about the reactive programming model underlying Angular's HTTP client and event handling.
