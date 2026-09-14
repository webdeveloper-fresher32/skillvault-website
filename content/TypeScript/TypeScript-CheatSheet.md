# 📘 TypeScript Deep-Dive Cheat Sheet

This guide serves as an in-depth, GitHub-style reference for TypeScript, from foundational concepts to advanced type manipulation.

---

## 📑 Table of Contents
1. [Basic Types](#1-basic-types)
2. [Type Assertions & Non-Null Assertion](#2-type-assertions--non-null-assertion)
3. [Optional Chaining & Nullish Coalescing](#3-optional-chaining--nullish-coalescing)
4. [Functions](#4-functions)
5. [Interfaces & Type Aliases](#5-interfaces--type-aliases)
6. [Classes & Access Modifiers](#6-classes--access-modifiers)
7. [Enums & Const Assertions](#7-enums--const-assertions)
8. [Generics](#8-generics)
9. [Advanced Types (Union, Intersection, Tuples)](#9-advanced-types)
10. [Type Narrowing & Guards](#10-type-narrowing--guards)
11. [Discriminated Unions](#11-discriminated-unions)
12. [keyof, typeof & Index Signatures](#12-keyof-typeof--index-signatures)
13. [Mapped Types](#13-mapped-types)
14. [Conditional Types & infer](#14-conditional-types--infer)
15. [Template Literal Types](#15-template-literal-types)
16. [Utility Types](#16-utility-types)
17. [The `satisfies` Operator](#17-the-satisfies-operator)
18. [Decorators](#18-decorators)
19. [Modules & Declaration Files](#19-modules--declaration-files)
20. [tsconfig.json Fundamentals](#20-tsconfigjson-fundamentals)

---

## 1. Basic Types

TypeScript brings static typing to JavaScript. Here are the primitive types:

```typescript
// Primitives
let isDone: boolean = false;
let lines: number = 42;
let name: string = "TypeScript";

// Arrays
let numbers: number[] = [1, 2, 3];
let strings: Array<string> = ["Hello", "World"]; // Generic array type

// Any (Disable type checking - use sparingly!)
let notSure: any = 4;
notSure = "maybe a string instead";

// Unknown (Safer than 'any', forces you to check the type before use)
let safeUnknown: unknown = "hello";
if (typeof safeUnknown === "string") {
    console.log(safeUnknown.toUpperCase());
}

// Void (Absence of returning a value)
function logMessage(msg: string): void {
    console.log(msg);
}

// Never (Values that never occur, e.g., throwing errors or infinite loops)
function throwError(errorMsg: string): never {
    throw new Error(errorMsg);
}

// Literal types (a value narrowed to one specific value)
let direction: "up" | "down" | "left" | "right";
direction = "up";     // OK
// direction = "north"; // Error: not assignable
```

---

## 2. Type Assertions & Non-Null Assertion

Sometimes you know more about a value's type than the compiler does. Assertions don't change runtime behavior — they only affect the type checker.

```typescript
// "as" syntax (preferred, works in .tsx files)
const input = document.getElementById("email") as HTMLInputElement;
console.log(input.value);

// Angle-bracket syntax (equivalent, but NOT usable in .tsx files)
const input2 = <HTMLInputElement>document.getElementById("email");

// Double assertion (escape hatch when types don't overlap at all)
const forced = ("hello" as unknown) as number;

// Non-null assertion operator (!) — tells the compiler "this is never null/undefined"
function getLength(s: string | null) {
    // return s.length;      // Error: s could be null
    return s!.length;        // Asserts s is not null (use sparingly — no runtime check!)
}
```

**Pitfall:** `as` and `!` are purely compile-time. If you're wrong at runtime, you get a crash, not a type error — prefer a proper type guard (see [Section 10](#10-type-narrowing--guards)) whenever you can actually check the value.

---

## 3. Optional Chaining & Nullish Coalescing

Modern JS/TS syntax for safely navigating potentially-missing values.

```typescript
interface UserProfile {
    address?: {
        city?: string;
    };
}

const profile: UserProfile = {};

// Optional chaining (?.) — short-circuits to `undefined` instead of throwing
const city = profile.address?.city; // undefined, no error thrown

// Optional call — only calls the function if it exists
const maybeFn: (() => void) | undefined = undefined;
maybeFn?.();

// Nullish coalescing (??) — fallback ONLY for null/undefined (unlike || which also
// triggers on 0, "", false)
const displayName = city ?? "Unknown City";

const count = 0;
const a = count || 10; // 10  (0 is falsy, so || overrides it — usually a bug!)
const b = count ?? 10; // 0   (0 is not nullish, so ?? preserves it — usually correct)
```

---

## 4. Functions

Functions can have typed parameters and return types.

```typescript
// Standard function
function add(x: number, y: number): number {
    return x + y;
}

// Arrow function with type
const multiply = (x: number, y: number): number => x * y;

// Optional parameters (?) and Default parameters
function buildName(firstName: string, lastName?: string, middleName: string = "M."): string {
    return lastName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${middleName}`;
}

// Rest parameters
function sum(...numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0);
}

// Function Overloads
function padding(a: number, b?: number, c?: number, d?: number) { /* ... */ }
```

---

## 5. Interfaces & Type Aliases

Both represent shapes of objects, but have subtle differences (Interfaces can be extended/merged, Types can represent unions/primitives).

### Interfaces
```typescript
interface User {
    readonly id: number; // Cannot be modified after creation
    name: string;
    age?: number;        // Optional property
}

// Extending an interface
interface Admin extends User {
    privileges: string[];
}
```

### Type Aliases
```typescript
type ID = string | number; // Union type (Impossible with interface)

type Point = {
    x: number;
    y: number;
};

// Extending Type (Intersection)
type Point3D = Point & { z: number };
```

---

## 6. Classes & Access Modifiers

TypeScript adds access modifiers and property typing to ES6 classes.

```typescript
class Person {
    public name: string;        // Accessible everywhere (Default)
    private age: number;        // Accessible only within Person class
    protected ssn: string;      // Accessible in Person and its subclasses
    readonly id: number;        // Cannot be reassigned
    static species = "Homo sapiens"; // Belongs to the class itself, not instances

    constructor(name: string, age: number, ssn: string, id: number) {
        this.name = name;
        this.age = age;
        this.ssn = ssn;
        this.id = id;
    }
}

// Shorthand Initialization (Automatically assigns properties)
class Employee {
    constructor(
        public name: string,
        private salary: number
    ) {}
}

// Interfaces describe a contract a class must fulfill via "implements"
interface Serializable {
    serialize(): string;
}

class Product implements Serializable {
    constructor(public name: string, public price: number) {}
    serialize(): string {
        return JSON.stringify(this);
    }
}

// Abstract classes cannot be instantiated directly — only extended
abstract class Shape {
    abstract area(): number; // Must be implemented by subclasses

    describe(): string {
        return `This shape has an area of ${this.area()}`;
    }
}

class Circle extends Shape {
    constructor(private radius: number) {
        super();
    }
    area(): number {
        return Math.PI * this.radius ** 2;
    }
}

// const shape = new Shape(); // Error: cannot create an instance of an abstract class
```

---

## 7. Enums & Const Assertions

Enums allow a developer to define a set of named constants. `as const` is a lighter-weight alternative many teams prefer.

```typescript
// Numeric Enum (Auto-incrementing from 0)
enum Direction {
    Up,    // 0
    Down,  // 1
    Left,  // 2
    Right  // 3
}

// String Enum (Better for debugging)
enum Status {
    Success = "SUCCESS",
    Failed = "FAILED",
    Pending = "PENDING"
}

// const enum — inlined at compile time, no runtime object generated (smaller output)
const enum LogLevel {
    Info,
    Warn,
    Error
}

// --- Alternative: "as const" ---
// Instead of an enum, freeze a plain object/array into a set of literal types.
// No extra runtime object shape, works great with union types.
const Colors = {
    Red: "RED",
    Green: "GREEN",
    Blue: "BLUE"
} as const;

type Color = (typeof Colors)[keyof typeof Colors]; // "RED" | "GREEN" | "BLUE"

const directions = ["up", "down", "left", "right"] as const;
type CardinalDirection = (typeof directions)[number]; // "up" | "down" | "left" | "right"
```

---

## 8. Generics

Generics create reusable components that work with a variety of types.

```typescript
// Generic Function
function identity<T>(arg: T): T {
    return arg;
}
let output = identity<string>("myString");

// Generic Interface
interface Box<T> {
    contents: T;
}
let numberBox: Box<number> = { contents: 42 };

// Generic Constraints (Restricting what T can be)
interface HasLength {
    length: number;
}
function logLength<T extends HasLength>(arg: T): T {
    console.log(arg.length);
    return arg;
}

// Generic default type parameters
interface ApiResponse<T = unknown> {
    data: T;
    status: number;
}
```

---

## 9. Advanced Types

### Union & Intersection
```typescript
// Union: Can be A OR B
function printId(id: number | string) { /* ... */ }

// Intersection: Must be A AND B
interface ErrorHandling { success: boolean; error?: string; }
interface ArtworksData { artworks: { title: string }[] }
type ArtworksResponse = ArtworksData & ErrorHandling;
```

### Tuples
Fixed-length arrays with specified types for each index.
```typescript
let myTuple: [string, number, boolean] = ["hello", 42, true];

// Named tuple elements (improves readability in signatures/hovers)
let point: [x: number, y: number] = [10, 20];

// Optional and rest elements in tuples
type StringNumberBooleans = [string, number, ...boolean[]];
```

---

## 10. Type Narrowing & Guards

TypeScript gets smarter about types via runtime checks.

```typescript
// typeof guard
function padLeft(padding: number | string, input: string) {
    if (typeof padding === "number") {
        return " ".repeat(padding) + input;
    }
    return padding + input; // TypeScript knows it's a string here
}

// instanceof guard
if (error instanceof Error) { /* ... */ }

// Custom Type Guard (Predicate)
interface Fish { swim(): void; }
interface Bird { fly(): void; }

function isFish(pet: Fish | Bird): pet is Fish {
    return (pet as Fish).swim !== undefined;
}
```

---

## 11. Discriminated Unions

The most important intermediate pattern in TypeScript: a shared literal "tag" property lets the compiler narrow a union automatically inside a `switch`/`if`.

```typescript
interface CircleShape {
    kind: "circle";
    radius: number;
}

interface SquareShape {
    kind: "square";
    sideLength: number;
}

interface RectangleShape {
    kind: "rectangle";
    width: number;
    height: number;
}

type Shape = CircleShape | SquareShape | RectangleShape;

function getArea(shape: Shape): number {
    switch (shape.kind) {
        case "circle":
            return Math.PI * shape.radius ** 2; // shape is narrowed to CircleShape
        case "square":
            return shape.sideLength ** 2;        // shape is narrowed to SquareShape
        case "rectangle":
            return shape.width * shape.height;   // shape is narrowed to RectangleShape
        default:
            // Exhaustiveness check: if a new Shape variant is added and not handled
            // above, this line fails to compile because `shape` isn't `never`.
            const _exhaustive: never = shape;
            throw new Error(`Unhandled shape: ${_exhaustive}`);
    }
}
```

---

## 12. keyof, typeof & Index Signatures

```typescript
interface Person {
    name: string;
    age: number;
}

// keyof — produces a union of an object type's property names
type PersonKey = keyof Person; // "name" | "age"

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

// typeof — captures the TYPE of a variable/value (not the runtime `typeof` operator!)
const defaultPerson = { name: "Alex", age: 30 };
type PersonFromValue = typeof defaultPerson; // { name: string; age: number }

// Index signatures — describe objects whose keys aren't known ahead of time
interface StringDictionary {
    [key: string]: string;
}
const translations: StringDictionary = {
    hello: "hola",
    goodbye: "adios"
};

// Record<K, V> (see Utility Types) is usually preferred over a raw index signature
type NumericDictionary = Record<string, number>;
```

---

## 13. Mapped Types

Create new types by transforming properties of existing ones.

```typescript
type AppConfig = {
    volume: number;
    brightness: number;
};

// Makes all properties boolean
type BooleanConfig = {
    [Property in keyof AppConfig]: boolean;
};
// Result: { volume: boolean; brightness: boolean; }

// Modifiers: add/remove `readonly` and `?` with +/-
type PartialConfig = {
    -readonly [Property in keyof AppConfig]+?: AppConfig[Property];
};
```

---

## 14. Conditional Types & infer

Types that depend on a condition (like a ternary operator for types). `infer` lets you extract a type from within another type — it's what makes conditional types powerful rather than just a type-level if/else.

```typescript
// T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer — capture part of a matched type into a new type variable
type ElementType<T> = T extends (infer U)[] ? U : T;
type Item = ElementType<string[]>; // string

// This is exactly how the built-in ReturnType<T> utility works under the hood:
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
function greet() {
    return { message: "hi" };
}
type Greeting = MyReturnType<typeof greet>; // { message: string }

// Distributive conditional types: applying a conditional type to a union
// distributes over each member of the union individually
type ToArray<T> = T extends any ? T[] : never;
type StrOrNumArray = ToArray<string | number>; // string[] | number[]
```

---

## 15. Template Literal Types

Build new string literal types by combining and interpolating existing ones — useful for typed event names, CSS-in-JS keys, API routes, etc.

```typescript
type Locale = "en" | "fr" | "de";
type Greeting = "hello" | "goodbye";

// Combines every Locale with every Greeting: "en-hello" | "en-goodbye" | "fr-hello" | ...
type LocalizedGreeting = `${Locale}-${Greeting}`;

// Common real-world use: typed event handler names
type EventName = "click" | "hover" | "focus";
type HandlerName = `on${Capitalize<EventName>}`; // "onClick" | "onHover" | "onFocus"

// Extracting parts of a route string with infer
type ExtractRouteParam<T extends string> =
    T extends `${string}/:${infer Param}` ? Param : never;

type Param = ExtractRouteParam<"/users/:id">; // "id"
```

---

## 16. Utility Types

Built-in mapped/conditional types provided by TypeScript globally — no import needed.

```typescript
interface Todo {
    title: string;
    description: string;
    completed: boolean;
    assignee?: { id: number; name: string };
}

// Partial: Makes all properties optional
type PartialTodo = Partial<Todo>;

// Required: Makes all properties required
type RequiredTodo = Required<PartialTodo>;

// Readonly: Makes all properties immutable
type ReadonlyTodo = Readonly<Todo>;

// Pick: Selects specific properties
type TodoPreview = Pick<Todo, "title" | "completed">;

// Omit: Removes specific properties
type TodoInfo = Omit<Todo, "completed">;

// Record: Creates an object type with specific keys/values
type PageInfo = { title: string };
const pages: Record<string, PageInfo> = {
    home: { title: "Home" },
    about: { title: "About" }
};

// Exclude: Removes types from a union that are assignable to the given type
type NonBoolean = Exclude<string | number | boolean, boolean>; // string | number

// Extract: Keeps only types from a union assignable to the given type
type OnlyBoolean = Extract<string | number | boolean, boolean>; // boolean

// NonNullable: Removes null and undefined from a type
type Definite = NonNullable<string | null | undefined>; // string

// ReturnType: Extracts a function's return type
function createUser() {
    return { id: 1, name: "Alex" };
}
type NewUser = ReturnType<typeof createUser>; // { id: number; name: string }

// Parameters: Extracts a function's parameter types as a tuple
type CreateUserParams = Parameters<typeof createUser>; // []

// Awaited: Unwraps a Promise (recursively) to get the resolved value's type
async function fetchUser() {
    return { id: 1 };
}
type FetchedUser = Awaited<ReturnType<typeof fetchUser>>; // { id: number }

// InstanceType: Extracts the instance type of a class constructor
class Widget {
    constructor(public id: number) {}
}
type WidgetInstance = InstanceType<typeof Widget>; // Widget
```

---

## 17. The `satisfies` Operator

Introduced in TypeScript 4.9. Validates that a value matches a type **without widening or losing the value's own more specific inferred type** — the best of both `as` and explicit annotations.

```typescript
type RGB = [number, number, number];

// Problem with an explicit annotation: you lose literal key info
const palette1: Record<string, RGB | string> = {
    red: [255, 0, 0],
    green: "#00ff00" // typo-safe, but palette1.red is now RGB | string, not RGB
};

// Problem with no annotation at all: no validation against the shape
const palette2 = {
    red: [255, 0, 0],
    green: "#00ff00",
    blu: "#0000ff" // typo! No error, because there's no shape to check against.
};

// "satisfies" gives you BOTH: validation AND precise inference
const palette3 = {
    red: [255, 0, 0],
    green: "#00ff00"
    // blue: "#0000ff"  // if a required key were missing, this would error
} satisfies Record<string, RGB | string>;

// palette3.red is still known to be RGB (not widened to RGB | string)
const [r, g, b] = palette3.red;
```

---

## 18. Decorators

Used for meta-programming (commonly in Angular/NestJS). Enable via `"experimentalDecorators": true` in tsconfig (or use the newer TC39 stage-3 decorators supported natively since TS 5.0 without that flag).

```typescript
function Logger(constructor: Function) {
    console.log("Logging class creation...");
}

@Logger
class MyClass {
    constructor() {
        console.log("Class initialized");
    }
}
```

---

## 19. Modules & Declaration Files

How TypeScript code is split across files, and how types are described for plain JavaScript.

```typescript
// math.ts
export function add(a: number, b: number): number {
    return a + b;
}
export const PI = 3.14159;
export default class Calculator { /* ... */ }

// app.ts
import Calculator, { add, PI } from "./math";

// "import type" — imports ONLY the type, guaranteed to be erased at compile time
// (useful to avoid accidental circular runtime imports / keep bundles smaller)
import type { Todo } from "./todo-types";

// Re-exporting from a barrel file
export * from "./math";
export { add as sum } from "./math";
```

```typescript
// Declaration files (.d.ts) describe the shape of existing JS code/libraries
// without containing any implementation. TypeScript ships these for you
// (@types/* packages), but you can also author your own:

// vendor-lib.d.ts
declare module "vendor-lib" {
    export function doSomething(input: string): number;
}

// Describing a global variable injected by a <script> tag
declare global {
    interface Window {
        analytics: {
            track(event: string): void;
        };
    }
}
```

---

## 20. tsconfig.json Fundamentals

The configuration file that dictates how the TypeScript compiler behaves.

```json
{
  "compilerOptions": {
    "target": "es2022",         // JavaScript version to compile down to
    "module": "commonjs",       // Module system
    "strict": true,             // Enables all strict type-checking options
    "outDir": "./dist",         // Where to output JS files
    "rootDir": "./src",         // Where TS source files are
    "esModuleInterop": true,    // Fixes CommonJS/ES Module imports
    "skipLibCheck": true,       // Skips checking node_modules types (faster builds)
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],      // Which files to compile
  "exclude": ["node_modules"]   // Which files to ignore
}
```
