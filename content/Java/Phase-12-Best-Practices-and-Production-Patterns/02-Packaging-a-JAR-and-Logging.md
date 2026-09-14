# 02 — Packaging a JAR and Logging

> A comprehensive reference covering what a JAR file actually contains, how to build and run one with a working entry point, and why a real logging framework replaces scattered `System.out.println` calls in production code.

---

## Table of Contents

1. [The Problem: Handing Off a Finished Program](#1-the-problem-handing-off-a-finished-program)
2. [The Analogy: A Shipping Container and a Flight Recorder](#2-the-analogy-a-shipping-container-and-a-flight-recorder)
3. [What's Actually Inside a JAR](#3-whats-actually-inside-a-jar)
4. [Building and Running a JAR](#4-building-and-running-a-jar)
5. [Why a Real Logging Framework Beats System.out.println](#5-why-a-real-logging-framework-beats-systemoutprintln)
6. [Code Example: Package, Run, and Log at Different Levels](#6-code-example-package-run-and-log-at-different-levels)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Handing Off a Finished Program

Every lesson so far has run Java code from inside a project's own `src` layout, with the JDK compiling and executing it on the spot. A real, finished project has a different requirement: it needs to be handed to someone else — a teammate, a server, a customer — as a single thing they can run, without them needing your exact folder structure, your IDE, or a manual `javac` invocation on a pile of loose `.class` files.

A second, related problem shows up the moment that handed-off program actually runs somewhere else: when something goes wrong at 3 a.m. on a server nobody is watching in real time, `System.out.println` statements scattered through the code don't help. There's no way to turn them off without editing and redeploying the code, no way to route them to a file for later inspection, and no way to distinguish "routine progress update" from "something is actually broken" — they're all just lines of text on standard output.

This lesson addresses both halves of "shipping" a Java program: **packaging it into one portable, runnable artifact, and giving it a real way to record what it's doing while it runs.**

---

## 2. The Analogy: A Shipping Container and a Flight Recorder

**Real-world analogy for packaging:** before standardized shipping containers existed, cargo was loaded onto ships as loose crates, barrels, and sacks — every port needed different handling equipment, and loading/unloading was slow and error-prone. The shipping container changed that: pack everything into one standardized box, and any port, any ship, any truck built to handle that standard size can move it without custom handling. **A JAR file is that standardized container for a Java program** — pack the compiled `.class` files (and whatever resources they need) into one file, and any machine with a compatible JVM can run it, without needing to know anything about how the project was originally laid out.

**Real-world analogy for logging:** a ship's flight recorder ("black box") continuously records events — position, speed, warnings, errors — at defined levels of severity, onto a durable medium that can be reviewed later if something goes wrong. Compare that to a sailor just shouting updates out a porthole: nobody may be listening, there's no record afterward, and there's no way to say "only shout the important stuff, stay quiet about routine status." **A logging framework is the flight recorder; `System.out.println` is shouting out the porthole.**

---

## 3. What's Actually Inside a JAR

A **JAR** (Java ARchive) file is, structurally, just a `.zip`-format archive with a `.jar` extension and one special file inside it: `META-INF/MANIFEST.MF`. That manifest is a small text file of key-value metadata about the archive — most importantly, for a runnable JAR, a `Main-Class` entry naming the one class whose `public static void main(String[] args)` (Phase 1) should run when the JAR is executed directly.

Beyond the manifest, a JAR simply contains the compiled `.class` files the program needs, arranged in the same package-matching directory structure they'd have on disk (a class `com.example.App` lives at `com/example/App.class` inside the archive), plus any non-code resources (property files, small data files) the program was built with.

A JAR by itself is not a JVM — running one still requires a JVM installed on the machine that runs it (revisiting the JDK/JRE/JVM distinction from Phase 1). What the JAR provides is portability of *your code and its structure*, not the runtime itself.

---

## 4. Building and Running a JAR

Phase 11 covered Maven's build lifecycle — `compile` → `test` → `package` — and running `mvn package` to produce a build artifact. By default, `mvn package` on a standard Maven project produces a JAR containing the project's compiled classes, but with no `Main-Class` set in its manifest, since Maven has no way to guess which class (if any) should be the entry point.

To produce a *runnable* JAR — one that can be launched with `java -jar` — the project's `pom.xml` needs to tell the `maven-jar-plugin` which class is the entry point:

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-jar-plugin</artifactId>
      <configuration>
        <archive>
          <manifest>
            <mainClass>com.example.App</mainClass>
          </manifest>
        </archive>
      </configuration>
    </plugin>
  </plugins>
</build>
```

With that configuration in place, `mvn package` produces a JAR (typically under `target/`, e.g. `target/app-1.0.jar`) whose manifest now includes `Main-Class: com.example.App`. It can then be run directly:

```bash
mvn package
java -jar target/app-1.0.jar
```

The JDK also ships a standalone `jar` command that can build an archive directly from already-compiled `.class` files, without Maven or Gradle at all — useful for understanding what the build tools are automating under the hood:

```bash
jar cfe app.jar com.example.App -C target/classes .
```

Here `c` creates a new archive, `f` names the output file (`app.jar`), `e` sets the entry point class directly (`com.example.App`) without needing to hand-write a manifest file, and `-C target/classes .` tells `jar` to archive everything under `target/classes` (where `javac` placed the compiled `.class` files) using paths relative to that directory.

---

## 5. Why a Real Logging Framework Beats System.out.println

`System.out.println` has one severity level: none. Every message looks identical to the JVM and to anyone reading the output — there's no built-in way to say "this one only matters during debugging" versus "this one means the application is actually broken." A real logging framework fixes this by structuring every message around a **severity level**, typically some ordering of debug/trace, info, warning, and error/severe. The built-in `java.util.logging` package (part of the JDK, no extra dependency required) is one such framework; in real production codebases, a library like SLF4J paired with Logback is more common, but the underlying idea — leveled, configurable logging — is the same across all of them.

That leveled structure buys three concrete things `println` can't offer:

- **Configurable verbosity without touching code.** A logger can be configured (often via an external properties/config file) to only emit `WARNING` and above in production, while a developer's local run emits everything down to fine-grained debug detail — with zero source code changes between the two.
- **Routing.** Log output can be sent to a file, rotated daily, shipped to a centralized logging system, or all three at once — instead of being permanently tied to standard output.
- **Structured context.** Most logging calls can attach the class/method name, a timestamp, and — critically for error diagnosis — the actual exception object, producing a full stack trace in the log record rather than a bare printed message.

---

## 6. Code Example: Package, Run, and Log at Different Levels

**Before — undifferentiated `System.out.println` calls:**

```java
public class OrderProcessor {

    public void process(String orderId) {
        System.out.println("Processing order " + orderId);
        try {
            validate(orderId);
            System.out.println("Order " + orderId + " passed validation");
        } catch (IllegalArgumentException e) {
            System.out.println("Failed to process order " + orderId + ": " + e.getMessage());
        }
    }

    private void validate(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Order ID cannot be blank");
        }
    }
}
```

Every line above looks the same in the output — there's no way to hide the routine "passed validation" message in production while keeping the failure message visible, short of deleting the line and recompiling.

**After — `java.util.logging` with distinct severity levels:**

```java
import java.util.logging.Level;
import java.util.logging.Logger;

public class OrderProcessor {

    private static final Logger logger = Logger.getLogger(OrderProcessor.class.getName());

    public void process(String orderId) {
        logger.info("Processing order " + orderId);
        try {
            validate(orderId);
            logger.fine("Order " + orderId + " passed validation");
        } catch (IllegalArgumentException e) {
            logger.log(Level.SEVERE, "Failed to process order " + orderId, e);
        }
    }

    private void validate(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Order ID cannot be blank");
        }
    }
}
```

`logger.info(...)` and `logger.fine(...)` tag routine messages at different severities (`INFO` is enabled by default in `java.util.logging`; `FINE` is a more detailed debug-level message that's typically suppressed by default). `logger.log(Level.SEVERE, message, e)` records the failure along with the actual exception object, so the log entry includes a full stack trace rather than just the exception's message string. Nothing here required deleting a single log call to change what shows up in production — that's entirely a matter of the logger's configured level.

Packaging this class into a runnable JAR follows exactly the same two commands from the previous section:

```bash
mvn package
java -jar target/app-1.0.jar
```

---

## 7. Common Mistakes

- **Leaving debug-only `System.out.println` statements scattered through code that ships to production**, with no way to silence them short of editing and redeploying — exactly the problem a leveled logger avoids entirely by letting verbosity be turned down through configuration alone.
- **Forgetting to specify the correct main class in a JAR's manifest.** The JAR still builds successfully — packaging doesn't require a runnable entry point — but running it with `java -jar app.jar` fails immediately with `no main manifest attribute, in app.jar`, since the JVM has no `Main-Class` entry to tell it what to execute.

**Interview angle:** "Walk me through what happens when you run `java -jar app.jar`" is a common practical question that separates candidates who've only ever run code from an IDE's "Run" button from those who understand the underlying mechanics. A strong answer mentions that a JAR is a zip archive, that the JVM reads `META-INF/MANIFEST.MF` to find the `Main-Class` entry, and that omitting it produces a real, specific, recognizable error rather than a silent failure — showing you've actually hit that error before, not just read about it.

---

## 8. Hands-On Exercises

### Exercise 1 — Build and run a minimal runnable JAR

Create a small Maven project with one class containing a `main` method that prints a message. Add the `maven-jar-plugin` configuration from this lesson specifying that class as `mainClass`. Run `mvn package`, then run the resulting JAR with `java -jar`. Confirm the message prints.

### Exercise 2 — Reproduce and fix the "no main manifest attribute" error

Remove the `mainClass` configuration from Exercise 1's `pom.xml`, run `mvn package` again, and try running the resulting JAR with `java -jar`. Read the exact error message the JVM produces, then restore the configuration and confirm the JAR runs correctly again.

### Exercise 3 — Convert println debug output to leveled logging

Take a small class with 3-4 `System.out.println` calls at different points (a routine status update, a piece of debug detail, an error case). Rewrite it using `java.util.logging.Logger`, choosing an appropriate level (`INFO`, `FINE`, or `SEVERE`) for each original line, and confirm which messages appear with the logger's default configuration.

---

## 9. Interview Q&A

### Q1. What is a JAR file, structurally?

**Answer:** A JAR (Java ARchive) is a `.zip`-format archive containing compiled `.class` files arranged in package-matching directories, plus a `META-INF/MANIFEST.MF` file holding metadata about the archive — most importantly, for a runnable JAR, a `Main-Class` entry naming the class whose `main` method should run when the JAR is executed.

### Q2. What happens if you run `java -jar app.jar` and the manifest has no `Main-Class` entry?

**Answer:** The JVM fails immediately with an error like `no main manifest attribute, in app.jar`. The JAR itself builds and packages successfully regardless — a `Main-Class` entry is only required to make the JAR directly runnable with `java -jar`, not to package it in the first place.

### Q3. Why prefer a logging framework over `System.out.println` in production code?

**Answer:** A logging framework structures messages around severity levels (e.g. debug/info/warning/error), letting verbosity be tuned through configuration without touching source code, letting output be routed to files or centralized logging systems instead of only standard output, and letting exceptions be logged with full stack traces attached to a structured record — none of which plain `println` calls provide.

### Q4. How do you configure a Maven project to produce a runnable JAR?

**Answer:** Configure the `maven-jar-plugin` in the project's `pom.xml`, setting `<archive><manifest><mainClass>` to the fully-qualified name of the class containing the desired `main` method. Running `mvn package` then produces a JAR whose manifest includes that `Main-Class` entry, making it runnable with `java -jar`.

### Q5. What's the difference between `logger.info(...)` and `logger.log(Level.SEVERE, message, exception)`?

**Answer:** `logger.info(...)` records a routine, informational message at the `INFO` severity level. `logger.log(Level.SEVERE, message, exception)` records a message at the highest standard severity level while also attaching the actual exception object, so the resulting log entry includes the full stack trace — useful specifically for genuine failure cases, not routine status updates.

---

> 🧠 **Memory hook:** "A JAR is the shipping container; a logger is the flight recorder — one packs the cargo so any port can move it, the other records what happened so you can find out later, at whatever level of detail you actually need."
