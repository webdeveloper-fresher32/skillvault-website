# SOLID Principles — Complete Comparison Table

Dense, scannable, side-by-side reference for the 5 SOLID principles. Pairs with the full lessons in `Phase-02-SOLID-Principles/` and the one-liners in `Cheatsheet.md` — this file exists specifically to make the principles easy to **tell apart**, since most SOLID mix-ups in interviews come from confusing two of them, not from forgetting a definition.

---

## 1. The Full Comparison Table

| | **S** — Single Responsibility | **O** — Open/Closed | **L** — Liskov Substitution | **I** — Interface Segregation | **D** — Dependency Inversion |
|---|---|---|---|---|---|
| **Core definition** | A class should have only one reason to change. | Software entities should be open for extension, closed for modification. | Subtypes must be substitutable for their base type without breaking correctness. | Clients shouldn't be forced to depend on methods they don't use. | High-level modules shouldn't depend on low-level modules — both depend on abstractions. |
| **What it governs** | Cohesion *within* a class | How new *behavior* gets added | Behavioral correctness *across* an inheritance hierarchy | Shape of *interfaces/contracts* | *Direction* of dependencies |
| **Problem it solves** | Unrelated concerns (validation, persistence, email) bundled in one class — an unrelated change forces you to touch code you didn't mean to. | Every new requirement means editing existing, already-tested code (`if/elif` chains), risking regressions. | A subclass "is-a" parent by name/taxonomy but not by behavior, breaking any code written generically against the base type. | A fat interface forces every implementer to support capabilities it doesn't have. | Business logic hard-wired to concrete infrastructure — can't swap or test without the real thing. |
| **Classic anti-pattern / code smell** | "God class" — its description needs the word "and" (validates **and** saves **and** emails). | Long `if/elif`/`switch` chain dispatching on a `type` field, reopened for every new case. | Subclass overrides a method to `raise NotImplementedError`, no-ops it, or narrows/strengthens the parent's pre/post-conditions. | Fat interface where implementers stub out methods they don't need (`raise NotImplementedError`, `pass`). | High-level class directly instantiates a concrete class internally (`self.db = MySQLDatabase()`). |
| **The fix** | Split into cohesive collaborators; an orchestrator delegates, doesn't implement. | Introduce an abstraction; represent each variant as a subclass/strategy; client depends on the abstraction only. | Model inheritance on *behavior*, not taxonomy — split optional capabilities into separate interfaces/sibling classes. | Break the fat interface into small, focused "role interfaces"; implement only what you actually have. | Define an abstraction both sides depend on; inject the concrete implementation from outside (constructor injection). |
| **Canonical example in this course** | `UserService` (validation+DB+email) → `UserValidator` + `UserRepository` + `WelcomeEmailNotifier` + orchestrator. | `DiscountService` if/elif on `customer_type` → `DiscountStrategy` + `RegularDiscount`/`PremiumDiscount`/`VipDiscount`. | `FixedDepositAccount extends BankAccount` throwing on `withdraw()`; classic Rectangle/Square. | Fat `Worker` interface (`work`/`eat`/`sleep`/`attend_meeting`) → `Workable`/`Eatable`/`Sleepable`/`Meetable`. | `NotificationService` hardcoded to `EmailClient` → depends on `NotificationChannel` abstraction, `EmailChannel`/`SmsChannel` injected. |
| **Associated pattern / technique** | No specific GoF pattern — plain decomposition/delegation/composition. | **Strategy pattern** (primary); also Factory, Decorator, plugin/registry architectures. | Splitting contracts into capability-specific ABCs (`Withdrawable`); static type-checking (mypy) to catch violations early. | Role interfaces via ABC/`Protocol`; stateless mixin-style multiple inheritance. | **Dependency Injection** (constructor injection); `typing.Protocol`/ABC as the shared abstraction; IoC containers. |
| **Interview trick question** | "Does a class with 10 methods automatically violate SRP?" → No — cohesion matters, not method count. | "Does OCP mean you should never modify existing code?" → No — bug fixes/refactors are fine; it only targets *adding new behavior* without touching correct code. | "Why does Rectangle/Square violate LSP?" → `Square.set_width` has a side effect on `height`, breaking the parent's implied independently-settable-dimensions contract. | "Does ISP mean every interface should have exactly one method?" → No — split by cohesive *role*, not indiscriminately. | "Is Dependency Inversion the same as Dependency Injection?" → No — DIP is the *design principle* (dependency direction); DI is a *technique* to achieve it. You can do DI without honoring DIP (injecting a concrete class still leaves you coupled). |
| **Most confused with** | OCP | DIP | ISP | SRP | OCP |

---

## 2. The Confusion-Resolver Table

This is the part worth memorizing before an interview — the actual one-line distinctions people forget under pressure.

| Confused Pair | Why people mix them up | The one-line distinction |
|---|---|---|
| **SRP vs OCP** | Both are about "not touching things you shouldn't." | SRP is about *why* a class changes (cohesion of responsibilities inside it). OCP is about *how* new behavior gets added (extension vs. modification of existing code). A class can be perfectly cohesive (SRP-clean) and still force edits on every new type (OCP-violating). |
| **OCP vs DIP** | Both talk about abstractions and "not modifying code." | OCP says new behavior should arrive as *new classes*, not edits to old ones. DIP is *why that actually holds* — the client only stays untouched when a new variant appears if it already depended on an abstraction, not a concrete type. DIP is the enabling mechanism; OCP is the outcome. |
| **LSP vs ISP** | A fat interface (ISP violation) often *causes* an LSP violation. | LSP asks: does a *subclass* honor its *base class's* behavioral contract? ISP asks: does an *interface* force unnecessary methods on its *implementers*? A fat interface forces a fake stub method on a class that doesn't need it — and that stub (`raise NotImplementedError`) is exactly what breaks substitutability. Fix ISP first and LSP violations often disappear on their own. |
| **ISP vs SRP** | Both are about "don't bundle unrelated things together." | SRP is about a *class's* reasons to change (internal cohesion). ISP is about *interfaces* not bundling unrelated capabilities onto their implementers/clients. A class can honor SRP internally while still being forced to depend on someone else's bloated interface — that's an ISP problem, not an SRP one. |
| **DIP vs Dependency Injection** | Same vocabulary, different category. | DIP is a **design principle** — which direction dependencies point (toward abstractions). DI is a **technique** — supplying a dependency from the outside (constructor/setter/parameter) instead of constructing it internally. You can use DI and still violate DIP (e.g., injecting a concrete `MySQLDatabase` instead of a `Database` abstraction) — the wiring changed, but the coupling didn't. |

---

## 3. Quick Decision Flow — "Which Principle Am I Violating?"

```text
Is one class doing too many unrelated things?
        │
        ▼ yes                                   
      SRP violation
        │ no
        ▼
Do I have to edit existing tested code every time
a new variant/type is added (if/elif chain)?
        │
        ▼ yes
      OCP violation
        │ no
        ▼
Does a subclass throw/no-op a method its parent
promises to support, or narrow what it accepts?
        │
        ▼ yes
      LSP violation
        │ no
        ▼
Does an interface force implementers to stub out
methods they don't actually have?
        │
        ▼ yes
      ISP violation
        │ no
        ▼
Does a high-level class directly construct/import
a concrete low-level class instead of depending on
an abstraction passed in?
        │
        ▼ yes
      DIP violation
```

---

## 4. See Also

- Full lessons: `Phase-02-SOLID-Principles/01-Single-Responsibility-Principle.md` through `05-Dependency-Inversion-Principle.md`
- One-liner version: `Quick-Reference/Cheatsheet.md` → "SOLID Principles" section
- Practice questions: `Quick-Reference/Interview-QA.md`
