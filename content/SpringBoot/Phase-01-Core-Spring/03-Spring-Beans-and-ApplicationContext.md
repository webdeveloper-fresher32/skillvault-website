# Spring Beans and the ApplicationContext — Complete Guide

## Table of Contents
1. [What Is a Bean](#1-what-is-a-bean)
2. [Bean Definition Mechanisms](#2-bean-definition-mechanisms)
3. [Bean Scopes in Depth](#3-bean-scopes-in-depth)
4. [The Scoped-Proxy Problem](#4-the-scoped-proxy-problem)
5. [ApplicationContext Responsibilities](#5-applicationcontext-responsibilities)
6. [Event Publishing](#6-event-publishing)
7. [Environment Abstraction and Property Sources](#7-environment-abstraction-and-property-sources)
8. [Internationalization via MessageSource](#8-internationalization-via-messagesource)
9. [Manual Bean Lookup — Why It's an Anti-Pattern](#9-manual-bean-lookup--why-its-an-anti-pattern)
10. [BeanFactoryPostProcessor vs BeanPostProcessor](#10-beanfactorypostprocessor-vs-beanpostprocessor)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What Is a Bean

A **bean** is any object that is instantiated, assembled, and managed by the Spring IoC container. Structurally, a bean is a completely ordinary Java object — nothing about the class itself marks it as special. What makes it a "bean" is that the container owns its lifecycle: it decides when the object is created, what gets injected into it, what lifecycle callbacks run, and (for singleton scope) how long it lives.

```
  ┌─────────────────────────────────────────────────────────┐
  │              Spring IoC Container                        │
  │                                                            │
  │   BeanDefinition Registry                                 │
  │   ┌────────────┬────────────┬────────────┬─────────────┐ │
  │   │ emailService│ orderService│ dataSource │ ...        │ │
  │   │ scope:      │ scope:      │ scope:     │            │ │
  │   │ singleton   │ singleton   │ singleton  │            │ │
  │   └────────────┴────────────┴────────────┴─────────────┘ │
  │            │            │            │                    │
  │            ▼            ▼            ▼                    │
  │       actual bean instances, created and wired            │
  │       according to each BeanDefinition                    │
  └─────────────────────────────────────────────────────────┘
```

By default, every bean in Spring is **singleton-scoped** — the container creates exactly one instance per container and hands out that same instance to every injection point and every `getBean()` call. Other scopes (prototype, request, session, and more) exist for cases where a single shared instance is the wrong model, covered in Section 3.

---

## 2. Bean Definition Mechanisms

There are two primary mechanisms in modern Spring Boot code for telling the container "manage this object as a bean," plus a legacy third one worth knowing exists.

### Stereotype annotations (component scanning)

Annotating a class directly marks it for discovery during classpath scanning:

```java
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    public void sendEmail(String to, String body) { /* ... */ }
}
```

- `@Component` — the generic, root stereotype; any of the others below is itself meta-annotated with `@Component`.
- `@Service` — semantically marks a business/service-layer class. Functionally identical to `@Component` at runtime, but conveys intent and is targeted by some tooling/AOP pointcuts that match on stereotype.
- `@Repository` — marks a data-access class; in addition to registering the bean, it enables Spring's persistence exception translation, converting database-specific exceptions into Spring's unified `DataAccessException` hierarchy.
- `@Controller` / `@RestController` — marks a web-layer class handling HTTP requests; `@RestController` is `@Controller` + `@ResponseBody`, meaning return values are serialized directly to the response body rather than resolved as view names.
- `@Configuration` — marks a class as a source of `@Bean` definitions (see below); it is itself `@Component`-meta-annotated, so `@Configuration` classes are also beans in their own right.

### Java configuration (@Bean methods)

For classes you did not write — third-party library classes — you cannot add `@Component` to their source. Instead, a `@Configuration` class provides a factory method:

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        // @Bean methods can take parameters — Spring resolves them just like
        // constructor injection, by type/qualifier/primary.
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .build();
    }
}
```

`@Bean` methods also give you full control over scope, init/destroy methods, and any imperative construction logic that stereotype annotations cannot express (conditional creation, builder patterns, wrapping a legacy singleton factory).

### XML configuration (legacy)

Pre-annotation Spring (and some large legacy codebases still today) defined beans in XML:

```xml
<bean id="emailService" class="com.example.EmailService"/>
```

This mechanism still works and is fully supported for backward compatibility, but virtually no new Spring Boot code uses it — it is worth recognizing in legacy systems, not worth adopting for new work.

---

## 3. Bean Scopes in Depth

A bean's **scope** determines how many instances the container creates and how long each instance lives.

| Scope | Lifetime | Typical Use Case |
|---|---|---|
| `singleton` (default) | One instance per container, created eagerly at startup (unless `@Lazy`), lives until container shutdown | Stateless services, repositories, controllers — the overwhelming majority of beans |
| `prototype` | A new instance every time the bean is requested (injected or via `getBean()`) — container does NOT manage its destruction | Stateful, short-lived objects; objects that must not be shared across concurrent use |
| `request` | One instance per HTTP request; destroyed when the request completes | Per-request state in a web app (e.g., a request-scoped audit context) |
| `session` | One instance per HTTP session; destroyed when the session expires/invalidates | Per-user shopping cart, per-user preferences held across multiple requests |
| `application` | One instance per `ServletContext` (effectively singleton-like, but scoped to the web application rather than the Spring container) | Rarely used directly; conceptually similar to singleton for typical single-context web apps |
| `websocket` | One instance per WebSocket session | Per-connection state in STOMP/WebSocket messaging applications |

```java
@Component
@Scope("prototype")
public class ShoppingCart {
    private final List<Item> items = new ArrayList<>();
    public void add(Item item) { items.add(item); }
}
```

A critical distinction: for **prototype** beans, the container's responsibility ends the moment it hands the object back — it does not track the instance afterward, meaning `@PreDestroy` and `DisposableBean.destroy()` are **never called** by the container for prototype beans. If a prototype bean needs cleanup, the code that requested it is responsible for that cleanup manually; the container has no way to know when the caller is done with it.

```
  Singleton lifecycle:                    Prototype lifecycle:
  ┌───────────────────────┐              ┌───────────────────────┐
  │ create once            │              │ create on EVERY        │
  │ container tracks it    │              │ getBean()/injection    │
  │ container destroys it  │              │ container does NOT     │
  │ on shutdown            │              │ track or destroy it    │
  └───────────────────────┘              └───────────────────────┘
```

`request`, `session`, `application`, and `websocket` scopes require a web-aware `ApplicationContext` (which every Spring Boot web application has by default) — they have no meaning in a plain, non-web application context.

---

## 4. The Scoped-Proxy Problem

A subtle but important failure mode arises when you inject a **shorter-lived** scoped bean (e.g., `request`-scoped) into a **longer-lived** one (a `singleton`, which is instantiated exactly once at startup).

```
  Singleton bean (created ONCE, at app startup)
  ┌───────────────────────────────────────────────┐
  │  OrderController                                │
  │    - injects RequestAuditContext (request-scope)│
  │                                                  │
  │  PROBLEM: at the moment OrderController is       │
  │  constructed (app startup), there IS NO HTTP      │
  │  request yet — so which RequestAuditContext        │
  │  instance would even be injected?                 │
  └───────────────────────────────────────────────┘
```

Without help, this configuration throws `ScopeNotActiveException` at startup or on first access outside a request — the container simply has no request-scoped instance to hand over when `OrderController` is built once, at application boot, long before any HTTP request exists.

The solution is a **scoped proxy**: instead of injecting the real request-scoped object, Spring injects a lightweight CGLIB (or JDK dynamic) proxy that implements the same type. That proxy is safely injectable into the singleton at startup because it does not need a real request-scoped target to exist yet — it defers resolution: every method call on the proxy transparently looks up the *currently active* request-scoped instance and delegates to it.

```java
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.web.context.WebApplicationContext;

@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST,
       proxyMode = ScopedProxyMode.TARGET_CLASS)   // CGLIB proxy, since this is a concrete class
public class RequestAuditContext {
    private String correlationId;
    public void setCorrelationId(String id) { this.correlationId = id; }
    public String getCorrelationId() { return correlationId; }
}

@RestController
public class OrderController {

    private final RequestAuditContext auditContext; // actually a proxy, not the real object

    public OrderController(RequestAuditContext auditContext) {
        this.auditContext = auditContext;
    }

    @GetMapping("/orders/{id}")
    public Order getOrder(@PathVariable String id) {
        // Each HTTP request, this call is transparently routed to THAT
        // request's own RequestAuditContext instance via the proxy.
        auditContext.setCorrelationId(UUID.randomUUID().toString());
        // ...
    }
}
```

`proxyMode = ScopedProxyMode.TARGET_CLASS` generates a CGLIB subclass proxy, appropriate for concrete classes (as above). If the injected type is an interface, `ScopedProxyMode.INTERFACES` produces a JDK dynamic proxy instead, which is generally preferred when available since it does not require the target class to be non-final and avoids CGLIB's bytecode-generation overhead.

---

## 5. ApplicationContext Responsibilities

Beyond basic bean creation and wiring (inherited from `BeanFactory`, see lesson 1), `ApplicationContext` layers on a set of enterprise-application concerns that make it the practical, universal choice for real applications:

```
  ApplicationContext responsibilities
  ┌─────────────────────────────────────────────────────────────┐
  │  1. Bean lifecycle management (inherited from BeanFactory,    │
  │     but with EAGER singleton instantiation)                   │
  │  2. Event publication  — ApplicationEventPublisher/@EventListener│
  │  3. Environment abstraction — Environment, PropertySource      │
  │  4. Internationalization — MessageSource                      │
  │  5. Resource loading — ResourceLoader (classpath:, file:, etc.)│
  │  6. AOP integration — automatic proxy creation for             │
  │     @Transactional / @Async / @Cacheable                       │
  └─────────────────────────────────────────────────────────────┘
```

Each of the enterprise concerns above (events, environment, i18n) is explored individually in the following sections, since each is a substantial capability in its own right.

---

## 6. Event Publishing

`ApplicationContext` implements `ApplicationEventPublisher`, allowing beans to publish arbitrary events that other beans can subscribe to — a simple, in-process observer pattern with no external message broker required.

```java
public class OrderPlacedEvent {
    private final String orderId;
    public OrderPlacedEvent(String orderId) { this.orderId = orderId; }
    public String getOrderId() { return orderId; }
}

@Service
public class OrderService {

    private final ApplicationEventPublisher publisher;

    public OrderService(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void placeOrder(String orderId) {
        // ... persist the order ...
        publisher.publishEvent(new OrderPlacedEvent(orderId));
    }
}

@Component
public class OrderPlacedEmailListener {

    @EventListener
    public void onOrderPlaced(OrderPlacedEvent event) {
        System.out.println("Sending confirmation email for order " + event.getOrderId());
    }
}
```

By default, `@EventListener` methods run **synchronously**, on the same thread that called `publishEvent()` — the publishing method does not return until every listener has finished. Adding `@Async` to the listener method (with async support enabled via `@EnableAsync`) makes it run on a separate thread pool instead, decoupling the publisher from the listener's execution time. This event mechanism is precisely the kind of decoupling technique referenced in lesson 2 as an alternative to a circular dependency between two services — instead of `OrderService` calling `NotificationService` directly (and `NotificationService` potentially needing to call back into `OrderService`), `OrderService` simply publishes a fact about what happened, and any interested listener reacts independently.

---

## 7. Environment Abstraction and Property Sources

`ApplicationContext` exposes an `Environment` object unifying access to configuration from many different sources — `application.properties`/`application.yml`, OS environment variables, JVM system properties, command-line arguments, and profile-specific files — behind one consistent API and a single, predictable precedence order.

```java
@Component
public class DatabaseConfig {

    private final Environment environment;

    public DatabaseConfig(Environment environment) {
        this.environment = environment;
    }

    public String getUrl() {
        return environment.getProperty("spring.datasource.url");
    }

    public boolean isProdProfile() {
        return environment.acceptsProfiles(Profiles.of("prod"));
    }
}
```

More commonly, individual values are injected directly via `@Value`, which is resolved against the same `Environment`/`PropertySource` machinery under the hood:

```java
@Component
public class MailConfig {

    @Value("${mail.smtp.host}")
    private String smtpHost;

    @Value("${mail.smtp.port:587}")   // ":587" is a default if the property is absent
    private int smtpPort;
}
```

The `Environment` abstraction is what makes Spring profiles (`@Profile("prod")`, `application-prod.yml`) and externalized configuration (12-factor-style config via environment variables in containerized deployments) work uniformly, regardless of where a given property actually originates.

---

## 8. Internationalization via MessageSource

`ApplicationContext` also implements `MessageSource`, providing locale-aware message resolution out of the box — the mechanism behind rendering different text for different users' locales without hardcoding strings per language in application code.

```properties
# messages.properties (default/English)
greeting=Hello, {0}!

# messages_fr.properties (French)
greeting=Bonjour, {0}!
```

```java
@Service
public class GreetingService {

    private final MessageSource messageSource;

    public GreetingService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public String greet(String name, Locale locale) {
        return messageSource.getMessage("greeting", new Object[]{name}, locale);
    }
}
```

Spring Boot auto-configures a `MessageSource` bean backed by `messages.properties` (and locale-suffixed variants like `messages_fr.properties`) on the classpath with zero extra configuration, resolving the correct bundle based on the `Locale` passed in — commonly derived from the incoming request's `Accept-Language` header via a `LocaleResolver`.

---

## 9. Manual Bean Lookup — Why It's an Anti-Pattern

`ApplicationContext` exposes `getBean()` for imperative, on-demand bean retrieval:

```java
UserService userService = applicationContext.getBean(UserService.class);
```

This is occasionally necessary — for example, in a custom `BeanPostProcessor` needing to look up collaborators dynamically, in a legacy bridge between non-Spring-managed code and the Spring context, or in certain plugin-loading infrastructure where the concrete type is not known until runtime. Outside such infrastructure code, however, manual lookup is an anti-pattern for several concrete reasons: it reintroduces the exact "pull" dependency-management style that Dependency Injection was designed to eliminate (see lesson 1), it hides a class's real dependencies from its constructor/field declarations (making the dependency graph invisible to static analysis and to readers), it makes unit testing harder (you now need to mock or stub `ApplicationContext.getBean()` itself, rather than simply passing a mock into a constructor), and it silently couples a plain business class to the Spring Framework API (`ApplicationContext`) rather than to just the abstractions it actually needs. A service reaching for `applicationContext.getBean(SomeDependency.class)` instead of declaring `SomeDependency` as a constructor parameter is almost always a sign that dependency injection was available and simply not used.

---

## 10. BeanFactoryPostProcessor vs BeanPostProcessor

These two extension points are easy to confuse by name but operate at entirely different stages, on entirely different kinds of object:

```
  BeanFactoryPostProcessor                    BeanPostProcessor
  ┌─────────────────────────────┐           ┌─────────────────────────────┐
  │  Operates on BeanDefinition   │           │  Operates on actual bean     │
  │  METADATA, before ANY bean    │           │  INSTANCES, during the       │
  │  instance is created           │           │  initialization phase of     │
  │                                │           │  EVERY bean's lifecycle       │
  │  Example: PropertySource-      │           │  Example: AutowiredAnnotation-│
  │  PlaceholderConfigurer         │           │  BeanPostProcessor (handles   │
  │  resolving ${...} placeholders │           │  @Autowired), or a custom    │
  │  in bean definitions            │           │  AOP proxy creator            │
  └─────────────────────────────┘           └─────────────────────────────┘
```

A `BeanFactoryPostProcessor` runs once, early, against the whole `BeanDefinitionRegistry` — it can add new bean definitions, modify property values on existing definitions, or remove definitions entirely, but it never touches a constructed object because none exist yet at that stage. A `BeanPostProcessor`, by contrast, is invoked twice for every single bean as that bean moves through initialization (`postProcessBeforeInitialization` and `postProcessAfterInitialization`, as detailed in lesson 1's lifecycle diagram) — this is the mechanism underlying `@Autowired` resolution itself and AOP proxy creation for `@Transactional`/`@Async`/`@Cacheable`. In short: `BeanFactoryPostProcessor` shapes the blueprints; `BeanPostProcessor` intercepts the objects built from those blueprints.

---

## 11. Common Pitfalls

**Injecting a `prototype`-scoped bean into a `singleton` bean via the field/constructor and expecting a fresh instance each use.** Because the singleton is constructed exactly once, the prototype dependency is also resolved exactly once at that moment and then held for the singleton's entire lifetime — you get the illusion of "one instance forever," defeating the purpose of prototype scope entirely. The fix is either to inject an `ObjectProvider<T>`/`ObjectFactory<T>` and call `getObject()` each time a fresh instance is needed, or to use a scoped proxy (`proxyMode`) as described in Section 4, so each logical use resolves a new instance.

**Assuming `@PreDestroy` fires for prototype beans.** As emphasized in Section 3, the container hands off a prototype instance and stops tracking it — no destroy callback ever runs for it automatically. Code that allocates unmanaged resources (file handles, connections) inside a prototype bean must clean them up itself; relying on `@PreDestroy` here will silently leak resources.

**Forgetting the scoped-proxy requirement when injecting request/session-scoped beans into singletons.** Omitting `proxyMode` on a `@Scope("request")` bean injected into a singleton controller produces a startup or first-access failure (`ScopeNotActiveException`) rather than a compile error, which can be confusing the first time it is encountered — the fix is always adding the appropriate `ScopedProxyMode`.

**Overusing `ApplicationContext.getBean()` as a convenience instead of proper injection.** As detailed in Section 9, this reintroduces manual dependency lookup, hides the real dependency graph, and complicates testing — a class doing this should almost always be refactored to declare the dependency through its constructor instead.

**Confusing `@Primary` scope with bean scope, or confusing "singleton" (Spring bean scope) with the classic Gang-of-Four Singleton pattern.** Spring's singleton scope means "one instance per Spring container," not "one instance per JVM" — if an application runs multiple `ApplicationContext`s (uncommon, but possible in some test setups or multi-context architectures), each context gets its own singleton instance of the same class. This differs from the GoF Singleton pattern, which enforces exactly one instance per JVM via a private constructor and static accessor.

**Publishing an event and assuming listeners run asynchronously by default.** Without `@Async` and `@EnableAsync` configured, `@EventListener` methods execute synchronously, on the publishing thread, blocking the publisher until every listener completes — a slow listener (e.g., one calling a slow external API) directly slows down the code that published the event, which surprises developers expecting event-driven code to be inherently non-blocking.

---

## 12. Best Practices

Default every bean to singleton scope unless you have a specific, articulated reason to use another scope — singleton is simpler to reason about, cheaper (no per-request/per-use instantiation cost), and matches the overwhelming majority of stateless service/repository/controller use cases.

When you do need a shorter-lived scope injected into a longer-lived bean, always pair it with the correct `ScopedProxyMode` (or `ObjectProvider<T>`) rather than discovering the `ScopeNotActiveException` in production.

Prefer publishing an `ApplicationEvent` over adding a direct method call between two services when the relationship is naturally "notify, don't wait for a response" — this keeps services decoupled and is the idiomatic alternative to a circular service dependency (see lesson 2, Section 6).

Access configuration via `@Value`/`Environment`/typed `@ConfigurationProperties` classes rather than reading system properties or environment variables directly — this keeps configuration testable (you can substitute a `PropertySource` in tests) and consistent with Spring profiles.

Treat `ApplicationContext.getBean()` as reserved for framework/infrastructure code only; if you find yourself calling it in a `@Service` or `@Controller`, that is a strong signal to refactor toward constructor injection instead.

Keep `BeanFactoryPostProcessor` and `BeanPostProcessor` implementations rare, well-documented, and centralized — because they affect every bean or bean definition in the context, an undocumented custom processor is one of the hardest categories of bug to trace, since its effects are invisible at any individual bean's declaration site.

---

## 13. Hands-On Exercises

**Exercise 1:** Create a `prototype`-scoped bean `ReportBuilder` with a mutable `List<String> lines` field and an `addLine(String)` method. Inject it directly (constructor injection) into a `singleton`-scoped `ReportService`, call `addLine()` from two different public methods on `ReportService`, and observe that both calls append to the *same* underlying list — proving the prototype dependency was resolved only once. Fix it by injecting `ObjectProvider<ReportBuilder>` instead and calling `.getObject()` inside each method, and confirm each call now produces a fresh, empty `ReportBuilder`.

**Exercise 2:** Build a small Spring Boot web application with a `@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)` bean called `RequestContext` holding a `correlationId` field. Inject it into a singleton `@RestController`. Fire two concurrent HTTP requests (e.g., with two terminal `curl` calls slightly overlapping, or a small load-testing script) and log the `correlationId` seen inside each request's handler, confirming each request sees its own independent value despite the controller being a singleton. Then remove `proxyMode` entirely and confirm the application fails at startup or on first request with `ScopeNotActiveException`.

**Exercise 3:** Implement the `OrderPlacedEvent`/`OrderPlacedEmailListener` example from Section 6 verbatim. Add a `Thread.sleep(3000)` inside the listener to simulate a slow email provider, and measure (with `System.currentTimeMillis()` before/after) how long `OrderService.placeOrder()` takes to return — confirm it takes at least 3 seconds, proving synchronous execution. Then add `@EnableAsync` to a `@Configuration` class and `@Async` to the listener method, rerun, and confirm `placeOrder()` now returns near-instantly while the "sending confirmation email" log line appears roughly 3 seconds later on a different thread (print `Thread.currentThread().getName()` in both places to prove they differ).

**Exercise 4:** Write a `@Component` implementing `BeanPostProcessor` that logs `"Before init: " + beanName` and `"After init: " + beanName` for every bean. Separately, write a `@Component` implementing `BeanFactoryPostProcessor` that iterates `beanFactory.getBeanDefinitionNames()` and logs each registered bean definition's name and scope *before* any bean instance is created (place a log statement at the very top of your `main` method, before `SpringApplication.run()` completes, to confirm the `BeanFactoryPostProcessor` output appears first). Run the app and confirm from the log ordering that `BeanFactoryPostProcessor` output precedes all `BeanPostProcessor` output, which precedes any `@PostConstruct` log lines from your other beans.

**Exercise 5:** Create a small demo of the manual-lookup anti-pattern and its fix. First, write a `ReportGenerator` service whose method internally calls `applicationContext.getBean(TemplateEngine.class)` to fetch a collaborator (inject `ApplicationContext` itself via the constructor to enable this). Write a unit test for `ReportGenerator` using Mockito and observe how much setup is required to mock the `ApplicationContext.getBean()` call correctly (mocking a generic method call with a `Class<T>` argument). Then refactor `ReportGenerator` to receive `TemplateEngine` directly via constructor injection instead, rewrite the unit test with a plain `new ReportGenerator(mockTemplateEngine)`, and compare the line count and clarity of both tests side by side.

---

## 14. Interview Q&A

**Q: What is a Spring bean, and what makes an ordinary Java object become one?**
Answer: A bean is any object whose instantiation, wiring, and lifecycle are managed by the Spring IoC container rather than by application code directly. Structurally it is a plain Java object — nothing about the class itself is special — what makes it a "bean" is that the container's `BeanDefinition` registry has an entry describing how to create, configure, and (for singletons) hold onto that object. A class becomes eligible either via a stereotype annotation (`@Component` and its specializations `@Service`, `@Repository`, `@Controller`) discovered through component scanning, or via a `@Bean`-annotated factory method inside a `@Configuration` class, most commonly used for third-party classes you cannot annotate directly.

**Q: Explain the difference between singleton and prototype bean scopes, including a subtlety around dependency injection.**
Answer: Singleton scope, the default, means the container creates exactly one instance per container and hands that same instance to every injection point and `getBean()` call, holding it for the container's entire lifetime and running destroy callbacks on shutdown. Prototype scope means the container creates a brand-new instance every single time the bean is requested, but critically, the container stops tracking that instance the moment it is handed over — it never runs `@PreDestroy`/`DisposableBean.destroy()` for prototype beans, leaving cleanup entirely to the requesting code. A common subtlety is injecting a prototype bean directly into a singleton via a field or constructor: since the singleton is constructed only once, the prototype dependency is also resolved only once at that moment, silently defeating the "new instance every time" expectation — the fix is `ObjectProvider<T>` or a scoped proxy.

**Q: Why is a scoped proxy needed when injecting a request-scoped bean into a singleton bean?**
Answer: A singleton bean is instantiated exactly once, typically at application startup — long before any HTTP request exists — so there is no real request-scoped instance available yet to inject at that moment. A scoped proxy solves this by injecting a lightweight CGLIB or JDK dynamic proxy implementing the same type in place of the real object; every method call on that proxy is transparently routed, at call time, to whichever request-scoped instance is active for the current thread. This is configured via `@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)` for concrete classes or `ScopedProxyMode.INTERFACES` when the scoped bean's type is an interface.

**Q: What enterprise capabilities does ApplicationContext add on top of the base BeanFactory interface?**
Answer: `ApplicationContext` adds eager singleton instantiation at startup (surfacing configuration errors immediately rather than on first use), an event-publishing mechanism via `ApplicationEventPublisher`/`@EventListener` for in-process, decoupled communication between beans, an `Environment`/`PropertySource` abstraction that unifies configuration from properties files, environment variables, system properties, and profiles behind one API, a `MessageSource` for locale-aware internationalization, and automatic AOP proxy creation underlying features like `@Transactional` and `@Async`. Virtually every real Spring Boot application relies on these capabilities, which is why `ApplicationContext`, not raw `BeanFactory`, is the container implementation used everywhere in practice.

**Q: Why is calling ApplicationContext.getBean() directly in business logic considered an anti-pattern?**
Answer: Calling `getBean()` reintroduces the "pull" dependency-lookup style that Dependency Injection was specifically designed to replace with a "push" model, meaning the class actively fetches what it needs rather than declaring it and receiving it automatically. It hides the class's real dependencies from its constructor or field declarations, making the true dependency graph invisible to static analysis, code review, and IDE tooling, and it complicates unit testing since tests now need to mock the generic `getBean()` call rather than simply passing a mock object into a constructor. Manual lookup is legitimate in narrow infrastructure contexts — custom `BeanPostProcessor`s, plugin-loading code where the type is unknown until runtime — but essentially never appropriate in ordinary services or controllers, where constructor injection achieves the same result more transparently.

**Q: What is the difference between a BeanFactoryPostProcessor and a BeanPostProcessor?**
Answer: A `BeanFactoryPostProcessor` operates on `BeanDefinition` metadata before any bean instance exists, running once against the entire `BeanDefinitionRegistry` — it can modify property values, add, or remove bean definitions, but never touches a constructed object. A `BeanPostProcessor` operates on actual bean instances, invoked twice (before and after initialization) for every single bean in the container as part of that bean's lifecycle — this is precisely the mechanism Spring itself uses to implement `@Autowired` field injection and AOP proxy creation for `@Transactional`/`@Async`. In short, a `BeanFactoryPostProcessor` shapes the blueprints the container will build from, while a `BeanPostProcessor` intercepts the objects built from those blueprints.
