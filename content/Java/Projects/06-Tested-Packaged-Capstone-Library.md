# Project 06 — Tested, Packaged Capstone Library

## Goal

Bring together modern Java syntax, automated testing, and real build tooling into one small, distributable library — capping the course by producing something tested and packaged the way a real project would be, per Phases 9–12.

## What You'll Build

A small utility library (e.g. a validation/formatting helper library — think "is this email shaped correctly," "format this amount as currency," "normalize this phone number") that uses at least one modern Java feature (a `record` or pattern matching for `switch`), has a JUnit 5 test suite covering its public methods, and is built and packaged into a runnable/distributable JAR via Maven or Gradle.

## Phases Required

- Phase 9 — JVM Internals and Memory Management
- Phase 10 — Modern Java Features
- Phase 11 — Build Tools and Testing
- Phase 12 — Best Practices and Production Patterns

## Requirements

- Design the library around 2–4 small, focused public methods with a clear single responsibility each (e.g. `isValidEmail(String)`, `formatCurrency(double, String currencyCode)`, `normalizePhoneNumber(String)`) — following the "program to an interface, favor immutability" guidance from Phase 12 Lesson 1 wherever it naturally applies.
- Represent at least one piece of structured data in the library with a `record` (e.g. a `ValidationResult(boolean valid, String reason)` returned from a validation method instead of a bare `boolean`), per Phase 10 Lesson 1.
- Use a modern `switch` expression (arrow-style, no fallthrough) somewhere in the implementation — e.g. dispatching formatting logic based on a currency code or an input category — per Phase 10 Lesson 2.
- Set up a standard Maven (`pom.xml`) or Gradle (`build.gradle`) project layout with `src/main/java` and `src/test/java`, per Phase 11 Lesson 1.
- Write a JUnit 5 test class covering every public method with at least one normal-case test and one edge-case/failure-case test each (e.g. `assertThrows` for invalid input where the method is documented to throw), per Phase 11 Lesson 2.
- Use a proper logging call (`java.util.logging`, or note where a real project would wire in SLF4J/Logback) for at least one non-trivial internal event, instead of a stray `System.out.println` left in library code, per Phase 12 Lesson 2.
- Build the project into a runnable JAR with a correctly specified main class in the manifest (a small demo `Main` class that exercises the library), and confirm `java -jar <name>.jar` runs it successfully.

## Suggested Approach

1. Pick your library's exact scope first (3–4 methods, no more) and write out each method's expected inputs/outputs on paper before writing any code — this keeps the "small utility library" scope from ballooning.
2. Implement the methods themselves first, without tests, verifying behavior manually via a scratch `main` method.
3. Introduce the `record` for at least one return type, and the arrow-style `switch` expression for at least one piece of internal dispatch logic, refactoring existing method bodies rather than bolting them on as unused decoration.
4. Set up the Maven or Gradle project structure, moving your classes into `src/main/java` under a package, and get a plain `mvn compile` (or `gradle build`) to succeed before writing any tests.
5. Write the JUnit 5 test class in `src/test/java`, one test method per behavior (normal case and at least one failure/edge case per public method), and run `mvn test` (or `gradle test`) until everything passes.
6. Add the logging call, replacing any leftover `println` debugging statements.
7. Configure the JAR's main class (via your build tool's plugin configuration) and produce it with `mvn package` (or `gradle build`), then run `java -jar target/<name>.jar` (or the Gradle equivalent output path) to confirm it actually works end to end.

## Stretch Goals

- Add a `sealed interface` (Phase 10 Lesson 1) modeling a small closed set of validation outcomes, and use pattern matching for `switch` (Phase 10 Lesson 2) to handle each case exhaustively with no `default` branch.
- Add a Mockito-based test demonstrating how you'd isolate one of the library's methods from a slower dependency, even if the library itself doesn't currently have one (e.g. introduce a small `Clock`-like interface for a time-dependent formatting method, and mock it in a test).
- Publish the built JAR locally (e.g. to a local Maven repository with `mvn install`) and write a one-paragraph note on what would be needed to depend on it from a separate project.

## Evaluation Checklist

- [ ] The library exposes 2–4 small, focused public methods, each doing one clear thing.
- [ ] At least one method returns or uses a `record`, and at least one piece of logic uses a modern arrow-style `switch` expression.
- [ ] `mvn test` (or `gradle test`) passes, with every public method covered by at least a normal-case and a failure/edge-case test.
- [ ] The project builds into a runnable JAR, and `java -jar <name>.jar` runs the demo `Main` class successfully with no "no main manifest attribute" error.
- [ ] No stray `System.out.println` debug statements remain in library code — at least one meaningful event is logged via a proper logging call instead.
- [ ] You can explain, for at least one design choice in the library, why it follows the composition-over-inheritance or program-to-an-interface guidance from Phase 12 Lesson 1.
