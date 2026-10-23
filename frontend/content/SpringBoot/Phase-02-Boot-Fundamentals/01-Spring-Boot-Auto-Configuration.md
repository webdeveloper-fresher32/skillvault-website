# Spring Boot Auto-Configuration — Complete Guide

## Table of Contents
1. [Why Spring Boot Exists](#1-why-spring-boot-exists)
2. [@SpringBootApplication — A Composition of Three Annotations](#2-springbootapplication--a-composition-of-three-annotations)
3. [The Auto-Configuration Mechanism](#3-the-auto-configuration-mechanism)
4. [Conditional Annotations In Depth](#4-conditional-annotations-in-depth)
5. [A Realistic Auto-Configuration Example](#5-a-realistic-auto-configuration-example)
6. [Auto-Configuration Ordering](#6-auto-configuration-ordering)
7. [Backing Out of Auto-Configuration](#7-backing-out-of-auto-configuration)
8. [Debugging Auto-Configuration](#8-debugging-auto-configuration)
9. [The Startup Pipeline](#9-the-startup-pipeline)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Spring Boot Exists

Before Spring Boot existed, building a Spring application meant writing a large amount of configuration by hand — either XML `<bean>` definitions or, later, `@Configuration` classes full of `@Bean` methods. If you wanted a working web application backed by a relational database, you had to explicitly wire together a `DataSource`, a `TransactionManager`, an `EntityManagerFactory`, a `DispatcherServlet`, a view resolver, a Jackson `ObjectMapper`, an embedded or external servlet container, and dozens of other collaborating objects — most of which are the same for almost every project.

```
  Raw Spring (pre-Boot)                    Spring Boot
  ────────────────────                     ───────────
  web.xml                                  (none needed)
  DispatcherServlet config                 spring-boot-starter-web on classpath
  DataSource bean (manual)                 spring-boot-starter-data-jpa +
  TransactionManager bean (manual)         application.properties
  EntityManagerFactory bean (manual)       → auto-configured
  ViewResolver bean (manual)
  Jackson ObjectMapper bean (manual)
  Tomcat installed + configured externally → embedded Tomcat, zero XML

  Result: 200+ lines of boilerplate        Result: one dependency + a
  before you write a single line of        few properties, then you
  business logic                           write business logic immediately
```

This boilerplate was not just tedious — it was also *repetitive across nearly every project in existence*. Every team using Spring MVC with JPA and a MySQL database wrote almost identical configuration classes. Spring Boot's core insight was: if 95% of projects configure a `DataSource` the same way when a JDBC driver and `spring-boot-starter-data-jpa` are present, then Spring Boot itself can supply that configuration by default — and simply step aside if the developer supplies their own.

Spring Boot is not a replacement for the Spring Framework; it is built directly on top of it. It is best described as **an opinionated bootstrapping layer** that (1) auto-configures beans based on what is on the classpath and what properties are set, (2) bundles dependencies into cohesive "starters" so you do not have to hunt for compatible library versions, and (3) provides production-ready operational features (embedded servers, health checks, metrics) out of the box. The Spring Framework itself did not change — Spring Boot simply removes the burden of assembling it manually.

The payoff is enormous in practice: a new REST service backed by PostgreSQL can go from an empty directory to a running, database-connected HTTP endpoint in minutes, with a handful of properties instead of hundreds of lines of Java configuration.

---

## 2. @SpringBootApplication — A Composition of Three Annotations

Nearly every Spring Boot application has exactly one class annotated with `@SpringBootApplication`, conventionally placed at the root package so component scanning covers the whole application:

```java
package com.example.orders;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class OrdersApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrdersApplication.class, args);
    }
}
```

`@SpringBootApplication` is a meta-annotation — it is itself annotated with three other annotations, and applying it is exactly equivalent to applying all three individually:

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration   // meta-annotated with @Configuration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = {
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication {
    // attributes such as exclude, excludeName, scanBasePackages...
}
```

| Constituent Annotation | Responsibility |
|---|---|
| `@SpringBootConfiguration` (wraps `@Configuration`) | Marks the class itself as a source of bean definitions, so `@Bean` methods defined in it are registered like any other configuration class. |
| `@ComponentScan` | Scans the current package and all sub-packages for `@Component`, `@Service`, `@Repository`, `@Controller`/`@RestController`, and `@Configuration` classes, registering them as beans. This is why the main class's package placement matters — anything outside that package tree is invisible unless explicitly imported. |
| `@EnableAutoConfiguration` | The actual trigger for auto-configuration: it tells Spring Boot to attempt to automatically configure beans based on the jars on the classpath, other beans already defined, and various property settings. |

Understanding that `@SpringBootApplication` is *just* these three annotations demystifies a lot of "magic" — you could remove it and write `@Configuration @ComponentScan @EnableAutoConfiguration` on the same class and the application would behave identically. Developers occasionally do exactly this when they need fine-grained control, e.g., a custom `@ComponentScan(basePackages = ...)` that differs from the default.

---

## 3. The Auto-Configuration Mechanism

`@EnableAutoConfiguration` does not contain a hardcoded list of configuration classes. Instead it imports a special class, `AutoConfigurationImportSelector`, via the meta-annotation `@Import(AutoConfigurationImportSelector.class)`. This selector implements `DeferredImportSelector`, which means it runs *after* all other `@Configuration` classes have been processed — auto-configuration is deliberately evaluated last, so user-defined beans are always visible to the conditional checks described in Section 4.

```
  @EnableAutoConfiguration
          │
          ▼
  @Import(AutoConfigurationImportSelector.class)
          │
          ▼
  AutoConfigurationImportSelector.selectImports()
          │
          ├─ 1. Loads the full candidate list of auto-configuration
          │      classes (see mechanism below)
          │
          ├─ 2. Filters out excluded classes (exclude attribute /
          │      spring.autoconfigure.exclude property)
          │
          ├─ 3. Evaluates @Conditional annotations on each
          │      candidate class (see Section 4)
          │
          └─ 4. Returns the surviving list of fully-qualified
                 class names to be imported as @Configuration classes
```

### How the candidate list is loaded — the historical mechanism

Prior to Spring Boot 2.7, every auto-configuration jar (both Spring Boot's own `spring-boot-autoconfigure.jar` and any third-party library wanting to participate) shipped a file at `META-INF/spring.factories` containing a key/value mapping:

```properties
# META-INF/spring.factories  (legacy, Spring Boot <= 2.6)
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration,\
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration,\
org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration
```

`spring.factories` was a general-purpose "service loader" style file used for several different Spring Boot extension points (not only auto-configuration), which made it slow to parse (the whole file had to be read and every key checked) and easy to misuse for unrelated purposes.

### The current mechanism — Spring Boot 2.7+ and 3.x

Starting in Spring Boot 2.7, and mandatory in Spring Boot 3.x, auto-configuration classes are declared in a dedicated, purpose-built file:

```
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

The content is a simple newline-separated list of fully qualified class names — no key prefix, no other extension points mixed in:

```
# META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration
```

This split file gives faster startup (Spring Boot only reads a file dedicated to this one purpose, and can cache it), a clearer contract for library authors, and prevents `spring.factories` from becoming a dumping ground for unrelated keys. `spring.factories` still exists and is still used for a handful of other extension points (like `ApplicationContextInitializer` and `ApplicationListener` registration), but auto-configuration specifically has moved off it.

Every class name loaded from this file becomes a *candidate*. Being a candidate does **not** mean the configuration will be applied — it only means it will be evaluated. This is where conditional annotations take over.

---

## 4. Conditional Annotations In Depth

Every auto-configuration class is guarded by one or more conditional annotations from the `org.springframework.boot.autoconfigure.condition` package. These conditions are evaluated top-to-bottom against the current classpath, bean definitions, and environment. If any condition on a class (or on an individual `@Bean` method inside it) fails, that configuration or bean is skipped entirely — silently, with no error.

| Annotation | Passes When |
|---|---|
| `@ConditionalOnClass` | The named class is present on the classpath (checked without triggering class loading, to avoid `ClassNotFoundException` side effects). |
| `@ConditionalOnMissingClass` | The named class is **not** present on the classpath. |
| `@ConditionalOnBean` | A bean of the given type (or name) already exists in the `ApplicationContext`. |
| `@ConditionalOnMissingBean` | No bean of the given type (or name) exists yet — this is the primary mechanism that lets user-defined beans silently override auto-configured defaults. |
| `@ConditionalOnProperty` | A named property in `application.properties`/`application.yml` (or the environment) equals a given value, or is simply present, controlled via `havingValue` and `matchIfMissing`. |
| `@ConditionalOnWebApplication` | The application context is a web application (servlet-based or reactive), inferred from the presence of certain classes and the context type. |
| `@ConditionalOnNotWebApplication` | The inverse — application is not a web application. |
| `@ConditionalOnResource` | A specified classpath resource exists (e.g., a specific config file). |
| `@ConditionalOnExpression` | A SpEL expression evaluates to `true` — the most flexible but slowest and least readable option, used sparingly. |

### Why `@ConditionalOnMissingBean` matters most

This is the annotation that makes auto-configuration "back off" gracefully. It is almost always placed on the auto-configuration's own `@Bean` methods, never on user code — the *user* never needs to add annotations to override anything; they simply declare their own bean of the same type, and Spring Boot's `@ConditionalOnMissingBean` detects it and steps aside.

```java
@Configuration
public class MyDataSourceConfig {

    @Bean
    public DataSource dataSource() {
        // Because this bean now exists, DataSourceAutoConfiguration's
        // own dataSource() @Bean method (guarded by
        // @ConditionalOnMissingBean(DataSource.class)) will not run.
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:postgresql://localhost:5432/orders");
        ds.setUsername("orders_app");
        ds.setPassword(System.getenv("DB_PASSWORD"));
        return ds;
    }
}
```

### Ordering of condition evaluation

Conditions are evaluated in a specific priority: `@ConditionalOnClass`/`@ConditionalOnMissingClass` checks run first (cheapest, and they gate whether the class-loading of the rest of the configuration is even attempted), followed by `@ConditionalOnBean`/`@ConditionalOnMissingBean` (which require the `ApplicationContext`'s bean definitions to have stabilized enough to inspect), and finally `@ConditionalOnProperty`/`@ConditionalOnExpression` (environment-based, cheap, but usually most specific to the developer's intent).

---

## 5. A Realistic Auto-Configuration Example

The actual `DataSourceAutoConfiguration` class in Spring Boot is more elaborate than this, but the following simplified reconstruction demonstrates the real pattern precisely — nested `@Configuration` classes guarded by different conditions, so that only one connection-pool implementation is ever configured:

```java
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(DataSource.class)
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(HikariDataSource.class)
    @ConditionalOnMissingBean(DataSource.class)
    static class HikariDataSourceConfiguration {

        @Bean
        public HikariDataSource dataSource(DataSourceProperties properties) {
            HikariDataSource dataSource = new HikariDataSource();
            dataSource.setJdbcUrl(properties.getUrl());
            dataSource.setUsername(properties.getUsername());
            dataSource.setPassword(properties.getPassword());
            return dataSource;
        }
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnMissingClass("com.zaxxer.hikari.HikariDataSource")
    @ConditionalOnClass(org.apache.commons.dbcp2.BasicDataSource.class)
    static class Dbcp2DataSourceConfiguration {
        // falls back to Commons DBCP2 if Hikari is not on the classpath
    }
}
```

Reading this top to bottom: the outer `@AutoConfiguration` (a specialization of `@Configuration` introduced for auto-configuration classes) only activates at all if a `DataSource` class and embedded-database support class exist on the classpath, *and* only if the user has not already defined their own `DataSource` bean. Inside it, a nested configuration picks Hikari if it is present (Hikari is Spring Boot's default pool since 2.x because of its performance), otherwise a different nested configuration falls back to Commons DBCP2. This layered conditional structure is the general shape of nearly every real Spring Boot auto-configuration class: an outer gate, then progressively narrower inner gates that pick the most specific implementation available.

A second, shorter, real-world-flavored example — auto-configuring a `RestTemplate` builder only for servlet-based web applications and only when no user-defined builder exists:

```java
@AutoConfiguration
@ConditionalOnClass(RestTemplate.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class RestTemplateAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public RestTemplateBuilder restTemplateBuilder() {
        return new RestTemplateBuilder();
    }
}
```

---

## 6. Auto-Configuration Ordering

Because dozens of auto-configuration classes can be candidates simultaneously, and some configurations logically must run before or after others (for example, a JMX auto-configuration should run after the beans it exposes have been created), Spring Boot provides ordering annotations:

| Annotation | Effect |
|---|---|
| `@AutoConfigureOrder` | A numeric `Ordered`-style priority applied globally across all auto-configuration classes (lower values run earlier). Rarely used directly by application developers; mostly a Spring Boot internal tool. |
| `@AutoConfigureBefore` | Declares that this auto-configuration class must be processed before the named class(es). |
| `@AutoConfigureAfter` | Declares that this auto-configuration class must be processed after the named class(es) — the far more common of the two, since most auto-configurations depend on something more foundational having already run. |

```java
@AutoConfiguration
@AutoConfigureAfter(DataSourceAutoConfiguration.class)
@ConditionalOnClass(EntityManagerFactory.class)
@ConditionalOnMissingBean(EntityManagerFactory.class)
public class HibernateJpaAutoConfiguration {
    // needs a DataSource to already be defined/evaluated first,
    // hence @AutoConfigureAfter(DataSourceAutoConfiguration.class)
}
```

Ordering only affects the *sequence in which classes are processed and their conditions evaluated* — it does not change whether a class activates. If `DataSourceAutoConfiguration` never contributes a `DataSource` bean (say, no JDBC driver is on the classpath), `HibernateJpaAutoConfiguration`'s own `@ConditionalOnClass(EntityManagerFactory.class)` will simply fail on its own merits regardless of ordering.

---

## 7. Backing Out of Auto-Configuration

There are three distinct ways to override or disable auto-configuration, each suited to a different situation.

**1. Define your own bean.** This is the preferred approach for 95% of cases, because it composes with `@ConditionalOnMissingBean` without requiring any special syntax — you simply write a `@Bean` method of the matching type, as shown in Section 4's `dataSource()` example.

**2. Exclude specific auto-configuration classes.** Use this when a whole auto-configuration class's *side effects* are unwanted, not just its bean — for example, disabling automatic DataSource configuration entirely in a test slice, or preventing security auto-configuration from locking down every endpoint by default while you build out your own `SecurityFilterChain`.

```java
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    SecurityAutoConfiguration.class
})
public class OrdersApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrdersApplication.class, args);
    }
}
```

The same effect can be achieved from `application.properties` without touching code, which is useful when the exclusion should vary per-environment or per-profile:

```properties
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration
```

**3. Toggle behavior via properties.** Many auto-configuration classes expose `@ConditionalOnProperty` gates specifically so you do not need to exclude the whole class — just flip one setting:

```properties
# Disable Spring Boot's own banner-based health endpoint contribution
management.endpoint.health.show-details=always

# Turn off the whole Actuator auto-configuration's web exposure of endpoints
management.endpoints.web.exposure.include=
```

---

## 8. Debugging Auto-Configuration

When you cannot tell why a bean did or did not get created — a very common real-world debugging scenario — Spring Boot provides a built-in auto-configuration report.

```bash
# Start the application with the --debug flag
java -jar orders-app.jar --debug

# Equivalent when running via Maven or Gradle
./mvnw spring-boot:run -Dspring-boot.run.arguments=--debug
./gradlew bootRun --args='--debug'
```

This prints a **Conditions Evaluation Report** to the console at startup, broken into three sections:

```
=========================
CONDITIONS EVALUATION REPORT
=========================

Positive matches:
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required class 'javax.sql.DataSource' (OnClassCondition)
      - @ConditionalOnMissingBean did not find any beans of type
        'javax.sql.DataSource' (OnBeanCondition)

Negative matches:
-----------------
   MongoAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class
           'com.mongodb.client.MongoClient' (OnClassCondition)

   SecurityAutoConfiguration:
      Did not match:
         - @ConditionalOnMissingBean (types: ...SecurityFilterChain;
           SearchStrategy: all) found beans 'filterChain' (OnBeanCondition)

Exclusions:
-----------
    org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration

Unconditional classes:
-----------------------
    org.springframework.boot.autoconfigure.context.
    ConfigurationPropertiesAutoConfiguration
```

"Positive matches" lists every auto-configuration class that activated and exactly which condition allowed it. "Negative matches" lists every candidate that was rejected and the precise reason — this is the section developers reach for 90% of the time (e.g., "why didn't my Mongo auto-configuration run? — oh, the driver jar is missing"). "Exclusions" lists anything you explicitly excluded. "Unconditional classes" are auto-configurations with no conditions at all, so they always run.

The same report is also available at runtime (without restarting with `--debug`) via the Actuator `conditions` endpoint if `spring-boot-starter-actuator` is on the classpath and the endpoint is exposed: `GET /actuator/conditions`.

---

## 9. The Startup Pipeline

Putting the previous eight sections together, here is the complete sequence of events from `main()` to a running, request-serving application:

```
  public static void main(String[] args) {
      SpringApplication.run(OrdersApplication.class, args);
  }
          │
          ▼
  1. SpringApplication is constructed
     - Deduces application type (Servlet / Reactive / None)
     - Loads ApplicationContextInitializers and ApplicationListeners
       (still via META-INF/spring.factories for these extension points)
          │
          ▼
  2. Environment is prepared
     - application.properties / .yml loaded
     - Profiles resolved (spring.profiles.active)
     - Command-line args, env vars merged per precedence rules
          │
          ▼
  3. ApplicationContext is created
     - AnnotationConfigServletWebServerApplicationContext (typical case)
          │
          ▼
  4. @ComponentScan runs
     - Scans base package + sub-packages
     - Registers @Component/@Service/@Repository/@Controller/
       @Configuration classes as bean definitions (not yet instantiated)
          │
          ▼
  5. @EnableAutoConfiguration → AutoConfigurationImportSelector
     - Loads candidates from
       META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
     - Removes excluded classes
     - Evaluates @ConditionalOnClass / @ConditionalOnBean /
       @ConditionalOnMissingBean / @ConditionalOnProperty / etc.
       (deferred — runs AFTER user @Configuration classes are known)
     - Surviving auto-configuration classes imported as
       @Configuration classes
          │
          ▼
  6. Bean definitions are finalized
     - All @Bean methods across user config + surviving
       auto-configuration classes are registered (not yet instantiated)
          │
          ▼
  7. ApplicationContext.refresh()
     - Beans are instantiated, dependencies injected (constructor/
       field/setter), BeanPostProcessors applied (@PostConstruct,
       AOP proxies, validation, etc.)
     - ApplicationContext becomes fully active
          │
          ▼
  8. Embedded server starts (Tomcat/Jetty/Undertow/Netty)
     - Only if @ConditionalOnWebApplication matched during step 5
     - Servlet context / router is wired to DispatcherServlet
     - Server begins listening on server.port
          │
          ▼
  9. CommandLineRunner / ApplicationRunner beans execute
  10. Application is ready — ApplicationReadyEvent published
```

This pipeline explains several behaviors developers often find surprising: why a `@Bean` you define is always preferred over an auto-configured one (auto-configuration's `DeferredImportSelector` runs after user configuration is known, step 5 vs step 4); why excluding an auto-configuration class removes it before any conditions are even checked; and why the embedded server does not start until the entire bean graph has been fully wired (step 7 completes before step 8 begins) — so a misconfigured bean anywhere in the graph prevents the server from ever accepting a request.

---

## 10. Common Pitfalls

**Forgetting that component scanning starts at the main class's package.** If `OrdersApplication` lives in `com.example.orders` but a `@Service` lives in `com.example.shared`, it will never be picked up by the default `@ComponentScan`, silently — Spring will not error, the bean simply won't exist, and you'll get a confusing `NoSuchBeanDefinitionException` at injection time far from the real cause. The fix is either moving the main class to the top-level package (the conventional solution) or adding `@ComponentScan(basePackages = {"com.example.orders", "com.example.shared"})`.

**Assuming `@ConditionalOnMissingBean` checks by name instead of by type.** By default it checks type, so defining a bean named differently but of the same type still causes the auto-configuration to back off — and conversely, developers are sometimes surprised that two beans of *different* types with the same *name* do not trigger the same backing-off behavior they expected.

**Excluding an auto-configuration class that a different auto-configuration depends on.** For example, excluding `DataSourceAutoConfiguration` while still having `spring-boot-starter-data-jpa` on the classpath causes `HibernateJpaAutoConfiguration` to fail at startup because no `DataSource` bean exists for it to depend on (`@AutoConfigureAfter` only orders evaluation, it does not manufacture missing beans).

**Confusing "no error" with "correctly configured."** Because conditions fail silently by design, a missing driver jar or a misspelled property key often results in an auto-configuration simply not activating rather than a loud failure — the application starts, but a feature you expected (e.g., a `DataSource`) is silently absent, only surfacing later as an injection failure or a runtime `NullPointerException`. The `--debug` conditions report (Section 8) is the correct first debugging step, not guesswork.

**Overusing `@ConditionalOnExpression`.** Because it evaluates arbitrary SpEL, it's tempting to reach for it for complex logic, but it is both the slowest condition to evaluate and the hardest for other developers to read; a combination of `@ConditionalOnProperty` with `havingValue` almost always expresses the same intent more clearly.

**Assuming starter version can be bumped independently.** Manually forcing a newer version of an auto-configured library (e.g., Hibernate) without checking compatibility with the Spring Boot BOM can break the very conditions (`@ConditionalOnClass` checking for specific method signatures reflectively in some cases) that auto-configuration relies on — see Phase 2's second lesson on starters and the parent BOM for the correct way to override versions.

---

## 11. Best Practices

- Place your main `@SpringBootApplication` class at the root package of your application so the default component scan covers everything without extra configuration.
- Prefer overriding via your own `@Bean` definition over excluding a whole auto-configuration class — it is more surgical and keeps the rest of that auto-configuration's beneficial defaults intact.
- Reach for `exclude` only when you need to suppress an entire auto-configuration's *behavior*, not just replace one bean (e.g., disabling Spring Security's default auto-configured filter chain while you build a custom one).
- Run with `--debug` (or hit `/actuator/conditions`) the moment a bean "isn't there" and you don't know why — do not guess.
- Keep custom `@Configuration` classes narrowly scoped and clearly named (`JwtConfig`, `CacheConfig`) rather than one giant catch-all `AppConfig` — this mirrors how Spring Boot itself organizes auto-configuration into many small, single-purpose classes.
- Avoid `@ConditionalOnExpression` in application code; if you find yourself needing conditional beans at all (which is rare outside of framework/library code), prefer `@ConditionalOnProperty` or plain `@Profile`.
- Never rely on auto-configuration ordering between two of *your own* configuration classes without an explicit `@AutoConfigureBefore`/`@AutoConfigureAfter` or `@DependsOn` — implicit ordering is an implementation detail that can change between Spring Boot versions.
- When writing a reusable library meant to plug into other Spring Boot applications, follow the same pattern Spring Boot itself uses: ship an `AutoConfiguration.imports` file, guard every configuration with the narrowest condition that expresses your actual requirement, and always provide a `@ConditionalOnMissingBean` escape hatch for consumers.

---

## 12. Hands-On Exercises

**Exercise 1:** Create a new Spring Boot project (via Spring Initializr, covered in the next lesson) with only the `spring-boot-starter-web` dependency. Run it with `--debug` and search the console output's "Positive matches" section for `DispatcherServletAutoConfiguration` and `ServletWebServerFactoryAutoConfiguration`. Then add `spring-boot-starter-data-jpa` and an H2 dependency, restart with `--debug` again, and confirm that `DataSourceAutoConfiguration` and `HibernateJpaAutoConfiguration` now appear in "Positive matches" where they previously would have appeared (or not appeared at all) in "Negative matches" due to a missing `DataSource`-related class on the classpath.

**Exercise 2:** In the same project, define your own `@Bean` of type `DataSource` in a `@Configuration` class, pointing it at an H2 in-memory database with a custom name. Restart with `--debug` and find `DataSourceAutoConfiguration` in the "Negative matches" section — read the exact reason string reported and confirm it references `@ConditionalOnMissingBean`. Then remove your custom bean, add `@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)` instead, and observe that the application now fails to start with a `NoSuchBeanDefinitionException` for `DataSource` the moment any repository or service tries to use JPA — demonstrating the difference between "back off because a substitute exists" and "explicitly disabled with nothing left in its place."

**Exercise 3:** Write a small custom auto-configuration of your own. Create a class `GreetingAutoConfiguration` annotated with `@AutoConfiguration`, guarded by `@ConditionalOnProperty(prefix = "app.greeting", name = "enabled", havingValue = "true", matchIfMissing = false)`, exposing a single `@Bean` `GreetingService` with a `@ConditionalOnMissingBean` guard. Register it by creating the file `src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` containing its fully qualified class name. Toggle `app.greeting.enabled=true`/`false` in `application.properties` between runs and confirm with `--debug` that the class moves between "Positive matches" and "Negative matches" accordingly.

**Exercise 4:** Deliberately create an ordering problem: write two of your own `@AutoConfiguration` classes, `AConfig` (which defines a bean depending on a bean from `BConfig`) with no ordering annotation, and observe (or force, by making `BConfig`'s bean conditional in a way that sometimes doesn't exist yet) a startup failure or unexpected null dependency. Then add `@AutoConfigureAfter(BConfig.class)` to `AConfig` and confirm the problem disappears. Use the `--debug` report to see the relative ordering of the two classes reflected in the sequence they are printed.

**Exercise 5:** Explore the Actuator conditions endpoint as a runtime alternative to `--debug`. Add `spring-boot-starter-actuator`, set `management.endpoints.web.exposure.include=conditions` in `application.properties`, start the application normally (without `--debug`), and call `GET http://localhost:8080/actuator/conditions` with `curl`. Compare the JSON structure returned (positiveMatches/negativeMatches/exclusions/unconditionalClasses) against the console report from Exercise 1 and confirm they describe the same underlying decisions in a machine-readable format suitable for automated tooling.

---

## 13. Interview Q&A

**Q: What exactly does `@SpringBootApplication` do, and what three annotations does it compose?**
Answer: `@SpringBootApplication` is a meta-annotation equivalent to applying `@Configuration` (via `@SpringBootConfiguration`), `@ComponentScan`, and `@EnableAutoConfiguration` together on the same class. `@Configuration` marks the class as a source of bean definitions; `@ComponentScan` scans the current package and sub-packages for stereotype-annotated classes; `@EnableAutoConfiguration` triggers Spring Boot's classpath- and property-driven automatic bean registration via `AutoConfigurationImportSelector`. Because it is just a composition, developers can replace it with the three individual annotations when they need finer control, such as a non-default `@ComponentScan` base package.

**Q: How does Spring Boot decide which auto-configuration classes to load, and how has that mechanism changed over recent versions?**
Answer: Historically (through Spring Boot 2.6), auto-configuration classes were listed under the `EnableAutoConfiguration` key inside `META-INF/spring.factories`, a general-purpose service-loader-style file shared by several unrelated Spring Boot extension points. Starting in Spring Boot 2.7 and mandatory in 3.x, auto-configuration classes are instead listed in a dedicated file, `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`, containing one fully qualified class name per line. This dedicated file loads faster and keeps auto-configuration registration separate from other `spring.factories`-based extension points like `ApplicationListener` registration, which still use the older file.

**Q: Explain how `@ConditionalOnMissingBean` allows a user-defined bean to silently override an auto-configured one.**
Answer: Auto-configuration classes place `@ConditionalOnMissingBean` on their own `@Bean` methods (or on the enclosing configuration class), meaning that method only registers its bean if no bean of that type already exists in the context. Auto-configuration is processed as a `DeferredImportSelector`, so it is evaluated after the developer's own `@Configuration` classes and their bean definitions are already known. If the developer has defined their own bean of the matching type, the condition evaluates to false and the auto-configured bean is skipped entirely — no annotation or opt-out is required on the user's side, it is automatic and silent by design.

**Q: What is the difference between excluding an auto-configuration class and simply defining your own bean to override it?**
Answer: Defining your own bean is surgical — it replaces exactly the bean(s) guarded by `@ConditionalOnMissingBean` while leaving the rest of that auto-configuration class's other beans and side effects intact. Excluding a class via `@SpringBootApplication(exclude = ...)` or the `spring.autoconfigure.exclude` property removes the entire class from consideration before any of its conditions are even evaluated, which means every bean it would have contributed is gone — if another auto-configuration class depends on one of those beans (e.g., `HibernateJpaAutoConfiguration` depending on a `DataSource`), excluding the source auto-configuration can break dependents unless you supply a full replacement yourself.

**Q: How would you debug a situation where an auto-configured bean you expected is missing from the context?**
Answer: Start the application with the `--debug` flag (or, at runtime, call the Actuator `/actuator/conditions` endpoint if exposed) to print the Conditions Evaluation Report. Look in the "Negative matches" section for the auto-configuration class in question and read the specific condition that failed — commonly a missing classpath dependency (`@ConditionalOnClass`), an existing conflicting bean (`@ConditionalOnBean`/`@ConditionalOnMissingBean`), or a missing/mismatched property (`@ConditionalOnProperty`). This report gives the exact reason rather than requiring guesswork, and is the standard first step before inspecting bean definitions manually or adding logging.

**Q: Why does Spring Boot need ordering annotations like `@AutoConfigureAfter` if conditions already determine whether a configuration activates?**
Answer: Conditions determine *whether* a configuration class activates, but many auto-configuration classes also need certain other configurations to have already been *processed* — not just present — before their own conditions can be meaningfully evaluated. For example, `HibernateJpaAutoConfiguration` uses `@AutoConfigureAfter(DataSourceAutoConfiguration.class)` so that by the time its own `@ConditionalOnBean`/`@ConditionalOnMissingBean` checks run, the `DataSource` bean (or lack thereof) is already finalized. Without correct ordering, a class could be evaluated before a bean it depends on has been registered, leading to it either failing to activate when it should, or activating and later failing with a missing dependency during the actual `refresh()` bean-instantiation phase.
