# Inversion of Control (IoC) — Complete Guide

## Table of Contents
1. [What Is Inversion of Control](#1-what-is-inversion-of-control)
2. [Traditional Control vs Inverted Control](#2-traditional-control-vs-inverted-control)
3. [The Spring IoC Container](#3-the-spring-ioc-container)
4. [BeanFactory vs ApplicationContext](#4-beanfactory-vs-applicationcontext)
5. [The Full Spring Bean Lifecycle](#5-the-full-spring-bean-lifecycle)
6. [Proving the Lifecycle Order with Code](#6-proving-the-lifecycle-order-with-code)
7. [Container Startup Sequence](#7-container-startup-sequence)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Is Inversion of Control

Inversion of Control (IoC) is a design principle in which the flow of control of a program is inverted: instead of your own code being responsible for creating, configuring, and wiring together the objects it depends on, that responsibility is handed off to an external entity — in Spring's case, the **IoC Container**.

```
  Without IoC:                          With IoC:
  ┌───────────────────────┐            ┌───────────────────────┐
  │  Your class            │            │  Your class            │
  │  - decides WHAT it     │            │  - declares WHAT it    │
  │    needs               │            │    needs               │
  │  - decides HOW to      │            │  - receives it from    │
  │    create it           │            │    an external actor   │
  │  - creates it itself   │            │  - has NO idea how it   │
  │    (new SomeImpl())    │            │    was created          │
  └───────────────────────┘            └───────────────────────┘
        "pull" dependencies                  "push" dependencies
     (control lives inside the class)   (control lives in the container)
```

This is not unique to Spring — IoC is a general principle also seen in plugin architectures, the Hollywood Principle ("don't call us, we'll call you"), and template method patterns. Spring's specific implementation of IoC is built around a container that reads metadata (annotations or XML) describing your objects, and takes over the job of instantiating and wiring them.

The practical benefit is decoupling. A class that receives its dependencies instead of creating them has no compile-time knowledge of *which* concrete implementation it will get — only the abstraction (interface) it depends on. This makes the class trivially testable, swappable, and reusable across contexts, because the decision of "which implementation" moves from being baked into the class to being an external, configurable decision.

---

## 2. Traditional Control vs Inverted Control

Consider a `NotificationService` that needs to send messages through some channel. In traditional, non-inverted code, the class is in full control of its own dependency graph:

```java
// Traditional (non-inverted) approach — the class controls its own dependencies
public class NotificationService {

    private EmailSender emailSender;

    public NotificationService() {
        // NotificationService decides the concrete implementation AND creates it.
        this.emailSender = new SmtpEmailSender("smtp.company.com", 587);
    }

    public void notify(String recipient, String message) {
        emailSender.send(recipient, message);
    }
}
```

Three problems immediately surface. First, `NotificationService` is now compiled against `SmtpEmailSender` — switching to an `SqsEmailSender` for a different environment means editing this class's source code. Second, unit testing `notify()` in isolation is difficult: you cannot substitute a mock `EmailSender` without either subclassing or reaching for heavyweight test doubles that intercept the `new` call. Third, if `SmtpEmailSender` itself has dependencies (a connection pool, credentials), `NotificationService` must also know how to construct those, and the object graph construction logic leaks into every class that needs an `EmailSender`.

Now compare the inverted version:

```java
// Inverted approach — the class declares what it needs, receives it from outside
public class NotificationService {

    private final EmailSender emailSender;

    // NotificationService no longer knows HOW an EmailSender is created,
    // or WHICH concrete implementation it will receive.
    public NotificationService(EmailSender emailSender) {
        this.emailSender = emailSender;
    }

    public void notify(String recipient, String message) {
        emailSender.send(recipient, message);
    }
}
```

`NotificationService` now depends only on the `EmailSender` interface. Some external actor — a test method calling `new NotificationService(mockSender)`, or the Spring IoC Container calling `new NotificationService(smtpSenderBean)` — is responsible for deciding which implementation to supply and for constructing it. The control over object creation has been inverted from the consuming class to the caller.

Spring formalizes this "external actor" as the **IoC Container**: a runtime component that reads configuration metadata (component-scanned annotations, `@Configuration` classes, or historically XML) describing the beans your application needs, resolves the dependency graph between them, and constructs and wires the entire object graph before your application code starts executing business logic.

---

## 3. The Spring IoC Container

The Spring IoC Container is the engine underlying every Spring application. It is responsible for three fundamental jobs:

```
  ┌────────────────────────────────────────────────────────────────┐
  │                     Spring IoC Container                       │
  │                                                                  │
  │  1. INSTANTIATE  — create instances of managed classes ("beans")│
  │  2. CONFIGURE    — inject dependencies, set properties          │
  │  3. MANAGE       — own the full lifecycle: init callbacks,      │
  │                     make the bean available for use, run        │
  │                     destroy callbacks on shutdown                │
  └────────────────────────────────────────────────────────────────┘
```

Concretely, the container:

- Reads **configuration metadata** — this can be annotations (`@Component`, `@Service`, `@Repository`, `@Controller`, `@Configuration` + `@Bean`), or (in legacy applications) XML `<bean>` definitions.
- Builds an internal registry of **BeanDefinitions** — metadata objects describing each bean's class, scope, dependencies, initialization/destruction callbacks, and lazy/eager instantiation preference. Note that a `BeanDefinition` is *not* the bean instance itself — it is a blueprint the container uses to create the instance later.
- Resolves the **dependency graph** between bean definitions so that beans are instantiated in an order that satisfies their dependencies (a bean cannot be fully constructed via constructor injection until its dependencies exist).
- Instantiates beans, injects their dependencies, and runs them through the full lifecycle described in Section 5.
- Holds references to singleton beans for the lifetime of the container and hands them out whenever they are requested (by another bean's constructor/setter, or by explicit lookup).
- Tears the beans down (destroy callbacks) when the container itself is closed.

You almost never call this container directly for everyday business logic — you simply annotate your classes and let component scanning discover them, and let `@Autowired` describe what each class needs. But recognizing that all of this activity is orchestrated by a single container object is essential to reasoning about startup order, circular dependencies, and lifecycle bugs.

---

## 4. BeanFactory vs ApplicationContext

Spring actually ships two levels of IoC container abstraction: `BeanFactory` (the root interface) and `ApplicationContext` (a more capable interface that extends it). Virtually every real Spring Boot application uses an `ApplicationContext`, but understanding the distinction — and why `BeanFactory` still exists — is a common interview topic and clarifies what the container is actually doing for you.

```
  BeanFactory (root interface)
        │
        │  extended by
        ▼
  ApplicationContext
        │
        ├── ConfigurableApplicationContext
        ├── WebApplicationContext (web-aware variant)
        └── AnnotationConfigApplicationContext (used internally by Spring Boot)
```

| Aspect | BeanFactory | ApplicationContext |
|---|---|---|
| Bean instantiation | Lazy by default — beans created only when first requested via `getBean()` | Eager — singleton beans are instantiated at container startup, unless marked `lazy-init`/`@Lazy` |
| Dependency injection | Supported, but must be driven manually in many cases | Fully automatic, integrated with component scanning |
| Event publishing | Not supported | Supported via `ApplicationEventPublisher` and `@EventListener` |
| Internationalization (i18n) | Not supported | Supported via `MessageSource` |
| Environment/property abstraction | Not supported directly | Supported via `Environment` and `PropertySource` abstraction |
| AOP integration | Requires manual `ProxyFactory` setup | Automatic — `@Transactional`, `@Async`, `@Cacheable` proxies are woven in transparently |
| BeanPostProcessor / BeanFactoryPostProcessor auto-registration | Must be registered manually | Automatically detected and registered from bean definitions |
| Typical usage | Extremely memory-constrained environments (rare today) | Virtually all real-world applications, including every Spring Boot app |

The eager-vs-lazy distinction is the most consequential difference in practice. Because `ApplicationContext` eagerly instantiates all singleton beans at startup, configuration errors (a missing dependency, a bean that fails during `@PostConstruct`) surface immediately when the application boots — a "fail fast" behavior. A raw `BeanFactory`, by contrast, would not discover such an error until the first `getBean()` call for that bean, which could happen much later, deep in a request path in production.

```java
// BeanFactory — low-level, rarely used directly in application code
BeanFactory factory = new XmlBeanFactory(new ClassPathResource("beans.xml"));
// Bean NOT created yet — created lazily on first getBean() call
UserService userService = factory.getBean(UserService.class);

// ApplicationContext — what Spring Boot uses under the hood
ApplicationContext context =
        new AnnotationConfigApplicationContext(AppConfig.class);
// All singleton beans were ALREADY instantiated when the context was built above.
UserService userService2 = context.getBean(UserService.class);
```

Every `@SpringBootApplication` boots an `ApplicationContext` (specifically an `AnnotationConfigServletWebServerApplicationContext` for a typical web app). You should think of `BeanFactory` as the theoretical, minimal contract that `ApplicationContext` builds upon and enriches with the enterprise features (events, i18n, environment abstraction, AOP) that real applications rely on.

---

## 5. The Full Spring Bean Lifecycle

Every singleton bean managed by the container passes through a well-defined sequence of stages between the moment the container decides to create it and the moment the container shuts down. Understanding this sequence precisely is essential for correctly using lifecycle hooks like `@PostConstruct`, `InitializingBean`, and `@PreDestroy`.

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │  1. BEAN DEFINITION LOADED                                            │
  │     Container reads @Component/@Bean metadata → BeanDefinition        │
  ├──────────────────────────────────────────────────────────────────────┤
  │  2. INSTANTIATION                                                     │
  │     Container calls the constructor → raw object exists (no deps set │
  │     yet if using setter/field injection; deps ARE set already if     │
  │     using constructor injection)                                     │
  ├──────────────────────────────────────────────────────────────────────┤
  │  3. DEPENDENCY INJECTION                                              │
  │     Setter methods called / @Autowired fields populated              │
  ├──────────────────────────────────────────────────────────────────────┤
  │  4. AWARE INTERFACE CALLBACKS  (in this order)                       │
  │     a. BeanNameAware.setBeanName()                                    │
  │     b. BeanClassLoaderAware.setBeanClassLoader()                      │
  │     c. BeanFactoryAware.setBeanFactory()                              │
  │     d. ApplicationContextAware.setApplicationContext()                │
  │        (only if running inside an ApplicationContext, not a raw       │
  │        BeanFactory)                                                   │
  ├──────────────────────────────────────────────────────────────────────┤
  │  5. BeanPostProcessor.postProcessBeforeInitialization()               │
  │     Runs for EVERY bean, before any init callback                    │
  ├──────────────────────────────────────────────────────────────────────┤
  │  6. INITIALIZATION CALLBACKS  (in this order)                        │
  │     a. @PostConstruct annotated method(s)                             │
  │     b. InitializingBean.afterPropertiesSet()                          │
  │     c. custom init-method (declared via @Bean(initMethod = "..."))    │
  ├──────────────────────────────────────────────────────────────────────┤
  │  7. BeanPostProcessor.postProcessAfterInitialization()                │
  │     This is also where AOP proxies (@Transactional, @Async,          │
  │     @Cacheable) get wrapped around the bean                          │
  ├──────────────────────────────────────────────────────────────────────┤
  │  8. BEAN IS READY — lives in the singleton cache, handed out to       │
  │     every injection point and getBean() call                         │
  ├──────────────────────────────────────────────────────────────────────┤
  │  9. CONTAINER SHUTDOWN TRIGGERED (context.close() / JVM shutdown hook)│
  ├──────────────────────────────────────────────────────────────────────┤
  │  10. DESTRUCTION CALLBACKS  (in this order)                          │
  │      a. @PreDestroy annotated method(s)                               │
  │      b. DisposableBean.destroy()                                      │
  │      c. custom destroy-method (declared via @Bean(destroyMethod=...)) │
  └──────────────────────────────────────────────────────────────────────┘
```

A few subtleties are worth calling out explicitly. First, the Aware callbacks (step 4) only fire for beans that implement the corresponding interface — most application beans implement none of them, since `@Autowired` and `ApplicationContext` injection via constructor cover almost every real need. Second, `BeanPostProcessor` is a container-wide hook: every registered `BeanPostProcessor` runs its `postProcessBeforeInitialization` and `postProcessAfterInitialization` methods for **every single bean** in the context, which is precisely how Spring implements cross-cutting features like `@Autowired` field injection itself (via `AutowiredAnnotationBeanPostProcessor`) and AOP proxy creation (via `AnnotationAwareAspectJAutoProxyCreator`). Third, destruction callbacks (step 10) only run for singleton-scoped beans when the container is explicitly closed — prototype-scoped beans are handed off to the caller and the container does not track or destroy them (see Phase 01, lesson 3, for scopes).

---

## 6. Proving the Lifecycle Order with Code

The following bean deliberately implements every lifecycle hook so the exact console output demonstrates the order described above:

```java
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.BeanNameAware;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

@Component
public class LifecycleDemoBean implements
        BeanNameAware, ApplicationContextAware, InitializingBean, DisposableBean {

    @Override
    public void setBeanName(String name) {
        System.out.println("4a. BeanNameAware.setBeanName() -> " + name);
    }

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        System.out.println("4d. ApplicationContextAware.setApplicationContext()");
    }

    @PostConstruct
    public void postConstruct() {
        System.out.println("6a. @PostConstruct");
    }

    @Override
    public void afterPropertiesSet() {
        System.out.println("6b. InitializingBean.afterPropertiesSet()");
    }

    public void customInit() {
        System.out.println("6c. custom init-method");
    }

    @PreDestroy
    public void preDestroy() {
        System.out.println("10a. @PreDestroy");
    }

    @Override
    public void destroy() {
        System.out.println("10b. DisposableBean.destroy()");
    }

    public void customDestroy() {
        System.out.println("10c. custom destroy-method");
    }
}
```

Because `@Component`-scanned beans cannot declare `initMethod`/`destroyMethod` directly, the custom init/destroy methods are normally wired via an `@Bean` definition instead:

```java
@Configuration
public class DemoConfig {

    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")
    public LifecycleDemoBean lifecycleDemoBean() {
        return new LifecycleDemoBean();
    }
}
```

Running a small `main` method that builds the context, then calls `context.close()`, produces console output in exactly this order:

```
4a. BeanNameAware.setBeanName() -> lifecycleDemoBean
4d. ApplicationContextAware.setApplicationContext()
6a. @PostConstruct
6b. InitializingBean.afterPropertiesSet()
6c. custom init-method
... (application runs) ...
10a. @PreDestroy
10b. DisposableBean.destroy()
10c. custom destroy-method
```

The redundancy between `@PostConstruct`/`afterPropertiesSet()`/`initMethod` (and their destroy-side counterparts) exists purely for historical and interoperability reasons — `InitializingBean`/`DisposableBean` predate annotations, and `initMethod`/`destroyMethod` exist for classes you cannot annotate (third-party library classes wired via `@Bean`). In new code you should pick exactly one mechanism per bean, almost always `@PostConstruct`/`@PreDestroy`, and never combine all three as this example does outside of a teaching context.

---

## 7. Container Startup Sequence

Understanding what actually happens between `SpringApplication.run()` being called and your first `@RestController` handling a request clarifies a lot of "why did my bean fail to start" debugging:

```
  1. SpringApplication.run(Application.class, args)
          │
          ▼
  2. Create the ApplicationContext instance (empty, no beans registered yet)
          │
          ▼
  3. COMPONENT SCAN
     Classpath scanned starting at @SpringBootApplication's package (and
     subpackages) for @Component/@Service/@Repository/@Controller/
     @Configuration classes
          │
          ▼
  4. BEAN DEFINITION REGISTRATION
     For every discovered class (and every @Bean method inside every
     @Configuration class), a BeanDefinition is created and registered
     in the BeanDefinitionRegistry — NO objects instantiated yet
          │
          ▼
  5. BeanFactoryPostProcessor PHASE
     Special processors run against the BeanDefinitions themselves
     (not bean instances) — e.g. resolving @Value placeholders against
     property sources, or the mechanism that turns @Configuration classes'
     @Bean methods into BeanDefinitions in the first place
          │
          ▼
  6. BeanPostProcessor REGISTRATION
     Processors that will act on bean INSTANCES (step 5/7 of the
     lifecycle) are instantiated first, ahead of ordinary beans, so they
     are ready to intercept every other bean's creation
          │
          ▼
  7. SINGLETON BEAN INSTANTIATION
     Container walks the dependency graph and instantiates every
     non-lazy singleton bean, resolving each bean's dependencies (which
     may trigger recursive instantiation of other beans first) —
     each bean goes through the full lifecycle from Section 5
          │
          ▼
  8. CONTEXT REFRESH COMPLETE
     ContextRefreshedEvent published; ApplicationRunner/CommandLineRunner
     beans execute; embedded web server (Tomcat/Netty) starts accepting
     requests
```

The dependency graph resolution in step 7 is why bean creation order in your logs is rarely the order classes were declared in code — Spring instantiates whichever bean is needed first to satisfy a constructor argument, recursively, and caches each singleton the moment it is fully constructed so it is not built twice. If this recursive resolution loops back to a bean that is still under construction, you get the circular dependency failure covered in lesson 2 of this phase.

---

## 8. Common Pitfalls

**Assuming `@PostConstruct` runs before dependencies are injected.** A very common bug is reading an `@Autowired` field inside a constructor, expecting it to already be populated. Field and setter injection happen *after* the constructor returns, so any field-injected dependency is `null` inside the constructor body. `@PostConstruct` methods run after all injection (steps 3–4) are complete, which is exactly why lifecycle initialization logic belongs there or in the constructor when using constructor injection (since constructor injection guarantees dependencies exist by the time the constructor body runs).

**Confusing `ApplicationContextAware` with simply `@Autowired ApplicationContext`.** Both work, but `@Autowired` is idiomatic in modern code and does not require implementing a marker interface, tying your class to the Spring API more visibly. Reach for `ApplicationContextAware` only in framework/infrastructure code where the interface-based contract matters (for example, when writing a custom `BeanPostProcessor` that needs the context before the bean's own injection phase runs).

**Expecting BeanPostProcessors to run in a predictable order without configuring it.** Multiple `BeanPostProcessor` beans in the same context run in registration order by default, which is not guaranteed to match declaration order in your source. If ordering matters (e.g., one processor must wrap the bean before another does), implement `Ordered` or use `@Order` explicitly rather than relying on incidental ordering.

**Believing `@PreDestroy` will run when the JVM is killed with `SIGKILL` or when the process is forcibly terminated.** Destroy callbacks only run on a graceful shutdown — `context.close()`, a normal JVM shutdown hook triggered by `SIGTERM`, or `ConfigurableApplicationContext.registerShutdownHook()` (which Spring Boot registers automatically). A hard kill bypasses all of this, so destroy logic should never be the only mechanism responsible for critical cleanup like flushing data to disk.

**Assuming lazy beans get Aware callbacks and lifecycle hooks at the same "startup" moment as everything else.** A bean marked `@Lazy` does not go through steps 2–7 until it is first requested (via injection into an already-initialized bean, or an explicit `getBean()` call). This means a `@PostConstruct` on a lazy bean can execute long after the application has finished starting, which surprises developers who expect all initialization logic to run before the server starts accepting traffic.

**Doing expensive or failure-prone work inside `@PostConstruct` without considering startup-order dependencies.** Because singleton instantiation order follows the dependency graph rather than any declaration order, a `@PostConstruct` method that reaches out to another bean assumed to be "already initialized" may run before that other bean exists, if the two are not connected by an explicit dependency. If ordering across unrelated beans matters, use an `ApplicationListener<ContextRefreshedEvent>` or a `@Bean(initMethod=...)` combined with explicit `@DependsOn`, rather than relying on incidental instantiation order.

---

## 9. Best Practices

Prefer constructor injection over field/setter injection so that the "instantiation" and "dependency injection" stages of the lifecycle (steps 2–3) collapse into one atomic operation — the object literally cannot exist in a partially-wired state, which eliminates an entire class of "field is null" bugs described above.

Reserve `@PostConstruct` for initialization logic that depends on injected collaborators already being present (opening a connection pool, validating configuration, warming a cache) — do not put business logic unrelated to bean setup there.

Avoid implementing `BeanFactoryAware`/`ApplicationContextAware`/`BeanNameAware` in ordinary application beans; these are infrastructure-level escape hatches meant for framework code, custom scopes, and custom `BeanPostProcessor` implementations, not for services and controllers.

Use `@PreDestroy` for releasing resources the bean itself acquired (closing a custom connection, unregistering a listener) — but never assume it is your only safety net; pair it with proper resource-management patterns (try-with-resources inside the bean's own methods, connection pool timeouts) for resources that must not leak under abnormal termination.

When you need one bean's initialization ordered relative to another unrelated bean, prefer an explicit `@DependsOn` or a redesign that makes the dependency direct (inject it), rather than depending on component-scan or classpath ordering, which is an implementation detail that can change between Spring versions.

Log a single line at `@PostConstruct` time in every bean that performs non-trivial setup (opening external connections, loading caches). This turns lifecycle debugging from a guessing game into a simple log-read, especially valuable the first time you hit a startup-order bug in a large application.

---

## 10. Hands-On Exercises

**Exercise 1:** Create a Spring Boot project (via start.spring.io, dependency: Spring Web) with a bean `AppStartupBean` implementing `BeanNameAware` and `InitializingBean`, and annotated with both a `@PostConstruct` method and a `@PreDestroy` method. Print a distinct labeled message from each callback. Run the application, observe the console order, then stop it with `Ctrl+C` (a graceful `SIGTERM`) and confirm the `@PreDestroy` message prints before the JVM exits. Compare this against forcibly killing the process (`kill -9 <pid>` from another terminal) and confirm the destroy message does NOT print — this proves destruction callbacks require a graceful shutdown.

**Exercise 2:** Write two beans, `ServiceA` and `ServiceB`, where `ServiceA`'s constructor takes a `ServiceB` parameter. Add a `System.out.println` inside each constructor announcing "Creating ServiceA"/"Creating ServiceB". Run the application and observe that `ServiceB`'s constructor message prints *before* `ServiceA`'s — this demonstrates that the container resolves dependency order, not declaration or component-scan order. Then swap the constructor injection so `ServiceB` depends on `ServiceA` instead and reverse an unrelated declaration order in your source file; confirm the log order still tracks the dependency graph, not the file layout.

**Exercise 3:** Build a small demonstration of `BeanFactory` vs `ApplicationContext` eager instantiation. Create a bean whose constructor throws a `RuntimeException` if a certain condition is true (e.g., a missing environment variable). With the bean registered as a normal `@Component` in a Spring Boot app (which uses `ApplicationContext`), confirm the application fails to start immediately with a clear stack trace pointing at your bean. Then, in a small standalone Java program (no Spring Boot, just `spring-context` on the classpath), construct a raw `DefaultListableBeanFactory`, register the same bean definition manually, and confirm that no exception is thrown until you explicitly call `beanFactory.getBean(YourBean.class)` — proving the lazy-vs-eager distinction concretely.

**Exercise 4:** Write a custom `BeanPostProcessor` that logs the class name of every bean passing through `postProcessBeforeInitialization` and `postProcessAfterInitialization`. Register it as a `@Component` in a small Spring Boot app with 3–4 other simple beans. Run the app and confirm your processor's log lines appear for every bean in the context, including framework-internal beans you did not write — this demonstrates that `BeanPostProcessor` is a container-wide hook, not opt-in per bean.

**Exercise 5:** Create a bean using `@Bean(initMethod = "start", destroyMethod = "stop")` inside a `@Configuration` class, where the underlying class is a plain POJO (not annotated with `@Component`, and not implementing any Spring interfaces) with a `start()` and `stop()` method that print messages. This proves the `initMethod`/`destroyMethod` mechanism exists specifically to add lifecycle hooks to classes you cannot modify or annotate (simulating a third-party library class). Confirm both messages print at the expected points in the application lifecycle, matching the timing of `@PostConstruct`/`@PreDestroy` on other beans in the same app.

---

## 11. Interview Q&A

**Q: What is Inversion of Control, and how does Spring implement it?**
Answer: Inversion of Control is a design principle where the responsibility for creating and wiring an object's dependencies is moved from the object itself to an external actor, rather than the object constructing its own collaborators directly. Spring implements this through its IoC Container, which reads configuration metadata (annotations like `@Component`/`@Bean`, or legacy XML), builds an internal registry of `BeanDefinition`s describing each bean, and then instantiates and wires the entire object graph before application code runs. The practical benefit is decoupling: classes depend only on abstractions (interfaces) and receive concrete implementations from the container, which makes them far easier to test, swap, and reconfigure across environments.

**Q: What is the difference between BeanFactory and ApplicationContext?**
Answer: `BeanFactory` is the root container interface providing basic dependency injection with lazy bean instantiation — beans are created only when `getBean()` is first called for them. `ApplicationContext` extends `BeanFactory` and adds enterprise features: eager instantiation of singleton beans at startup (so configuration errors surface immediately, a "fail fast" behavior), event publishing via `ApplicationEventPublisher`/`@EventListener`, internationalization via `MessageSource`, environment/property-source abstraction, and automatic AOP proxy creation for features like `@Transactional`. Every Spring Boot application uses an `ApplicationContext`; raw `BeanFactory` usage is rare and mostly of historical or academic interest today.

**Q: Walk through the full Spring bean lifecycle from instantiation to destruction.**
Answer: The container first instantiates the bean via its constructor, then injects dependencies via setters or fields (constructor injection combines these first two steps). Next, any applicable Aware interfaces fire in order — `BeanNameAware`, `BeanClassLoaderAware`, `BeanFactoryAware`, then `ApplicationContextAware`. Every registered `BeanPostProcessor`'s `postProcessBeforeInitialization` runs next, followed by initialization callbacks in order: `@PostConstruct`, then `InitializingBean.afterPropertiesSet()`, then any custom `initMethod`. Each `BeanPostProcessor`'s `postProcessAfterInitialization` then runs (this is where AOP proxies get woven in), after which the bean is fully ready and cached as a singleton. On container shutdown, `@PreDestroy`, `DisposableBean.destroy()`, and any custom `destroyMethod` run in that order, but only for a graceful shutdown and only for singleton-scoped beans.

**Q: Why does bean creation order in application logs not match the order classes are declared in source code?**
Answer: The container instantiates beans according to their dependency graph, not their declaration or component-scan order — if bean A's constructor requires bean B, the container recursively instantiates B first regardless of where B is declared relative to A in the codebase. This is fundamentally necessary for constructor injection to work: a bean cannot be constructed until every constructor argument already exists. Developers relying on incidental ordering (assuming a `@PostConstruct` in one unrelated bean always runs before another) are exploiting an implementation detail that is not guaranteed and can break silently after refactoring; explicit `@DependsOn` or direct injection should be used instead when ordering genuinely matters.

**Q: What is a BeanPostProcessor and how is it different from a BeanFactoryPostProcessor?**
Answer: A `BeanFactoryPostProcessor` operates on `BeanDefinition` metadata before any bean instances are created — it can modify property values, add new bean definitions, or alter configuration, but it never touches an actual bean instance. A `BeanPostProcessor`, by contrast, operates on live bean instances during the initialization phase of the lifecycle, wrapping every bean in the container with `postProcessBeforeInitialization` and `postProcessAfterInitialization` hooks. Spring's own core features are implemented this way: `AutowiredAnnotationBeanPostProcessor` performs `@Autowired` field/setter injection, and `AnnotationAwareAspectJAutoProxyCreator` wraps beans in AOP proxies for `@Transactional`/`@Async`/`@Cacheable` — both are `BeanPostProcessor`s operating transparently on every bean.

**Q: Why should application code avoid implementing ApplicationContextAware or BeanFactoryAware directly?**
Answer: These Aware interfaces exist to let infrastructure code — custom scopes, custom `BeanPostProcessor`s, framework integration code — obtain a direct handle on the container itself, which is a capability ordinary business logic almost never legitimately needs. Implementing them in a `@Service` or `@Controller` couples that class tightly to the Spring API and encourages manual `getBean()` lookups, which bypass the declarative dependency graph the IoC container is designed to manage and make the class's real dependencies invisible from its public API (constructor/setters). If a bean genuinely needs the `ApplicationContext` itself (for example, to publish events), a simple `@Autowired ApplicationContext context` field/constructor parameter achieves the same result without the marker-interface ceremony, and is idiomatic in modern Spring code.
