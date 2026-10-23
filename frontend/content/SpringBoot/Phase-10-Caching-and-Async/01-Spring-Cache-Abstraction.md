# Spring Cache Abstraction — Complete Guide

## Table of Contents
1. [Why Caching Matters](#1-why-caching-matters)
2. [Enabling the Cache Abstraction](#2-enabling-the-cache-abstraction)
3. [@Cacheable — Read-Through Caching](#3-cacheable--read-through-caching)
4. [@CachePut — Always Update the Cache](#4-cacheput--always-update-the-cache)
5. [@CacheEvict — Removing Entries](#5-cacheevict--removing-entries)
6. [@Caching and @CacheConfig](#6-caching-and-cacheconfig)
7. [Cache Key Generation — SpEL and Custom KeyGenerator](#7-cache-key-generation--spel-and-custom-keygenerator)
8. [How Caching Actually Works — The Proxy Mechanism](#8-how-caching-actually-works--the-proxy-mechanism)
9. [The Self-Invocation Pitfall](#9-the-self-invocation-pitfall)
10. [Pluggable CacheManagers](#10-pluggable-cachemanagers)
11. [Worked Example — Caching an Expensive Lookup](#11-worked-example--caching-an-expensive-lookup)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Best Practices](#13-best-practices)
14. [Hands-On Exercises](#14-hands-on-exercises)
15. [Interview Q&A](#15-interview-qa)

---

## 1. Why Caching Matters

Many methods in a typical service layer are expensive but return the same result for the same input over and over: a lookup by primary key that rarely changes, a call to a slow external API, an aggregation query over a large table, or a computation that burns CPU. Every one of those calls is wasted work if the answer was already computed a second ago.

Caching trades memory for time. Instead of recomputing a result, the application stores it the first time and returns the stored value on subsequent calls — until the cache decides the entry is stale and evicts it. Spring's caching abstraction lets you add this behavior declaratively, without littering your business logic with `if (cache.containsKey(...))` checks.

```
  Without caching                      With caching (@Cacheable)
  ┌────────────┐                       ┌────────────┐
  │ Controller │                       │ Controller │
  └─────┬──────┘                       └─────┬──────┘
        │ every call                         │ call
        ▼                                    ▼
  ┌────────────┐                       ┌─────────────┐   miss  ┌────────────┐
  │  Service    │──▶ DB / API          │ Cache Proxy │────────▶│  Service   │──▶ DB / API
  │ (expensive) │    every time         └─────┬───────┘  hit    └────────────┘
  └────────────┘                              │ returns
                                               ▼ cached value
                                        (DB/API not touched)
```

Crucially, Spring's cache abstraction is just that — an abstraction. Your business code has no idea whether a cache is backed by a simple in-process `HashMap`, Caffeine, Redis, or Hazelcast. You annotate methods, and a separate `CacheManager` bean decides where the data actually lives.

---

## 2. Enabling the Cache Abstraction

Caching is opt-in. Add `@EnableCaching` to a configuration class (commonly the main application class or a dedicated `@Configuration`):

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class ProductCatalogApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProductCatalogApplication.class, args);
    }
}
```

`@EnableCaching` triggers registration of the infrastructure beans that make caching work: an advisor that scans for `@Cacheable`/`@CachePut`/`@CacheEvict` annotations, and a `CacheInterceptor` that wraps annotated beans in a proxy. If you add the `spring-boot-starter-cache` dependency (or `spring-context-support` plus a cache provider) but forget `@EnableCaching`, the annotations are silently ignored — no error, no caching, just full method execution every time. This is one of the most common "why isn't my cache working" bugs.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
```

---

## 3. @Cacheable — Read-Through Caching

`@Cacheable` is the workhorse annotation. Before the method body runs, Spring checks the named cache for an entry matching the computed key. On a hit, the method body is skipped entirely and the cached value is returned. On a miss, the method runs, and its return value is stored under that key before being returned to the caller.

```java
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Cacheable(value = "products", key = "#id")
    public Product findById(Long id) {
        System.out.println("Loading product " + id + " from the database");
        return productRepository.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }
}
```

The first call for a given `id` prints the log line and hits the database. Every subsequent call for the same `id` returns instantly from the cache — the log line never appears again until the entry is evicted.

`@Cacheable` supports a `condition` attribute (evaluated *before* the method runs, decides whether to even consult the cache) and an `unless` attribute (evaluated *after* the method runs, decides whether to skip storing the result — useful for not caching `null` or error responses):

```java
@Cacheable(value = "products", key = "#id", condition = "#id > 0", unless = "#result == null")
public Product findById(Long id) {
    return productRepository.findById(id).orElse(null);
}
```

---

## 4. @CachePut — Always Update the Cache

`@CachePut` looks similar to `@Cacheable` but behaves differently: the method body **always executes**, and its result is always written to the cache under the computed key, overwriting whatever was there. Use it when you want to update the cache as a side effect of writing new data — typically on create/update operations — without skipping the actual write.

```java
import org.springframework.cache.annotation.CachePut;

@CachePut(value = "products", key = "#product.id")
public Product update(Product product) {
    return productRepository.save(product);
}
```

Every call to `update` hits the database and refreshes the cache entry for that product's ID, so the next `findById` call sees the fresh value instead of a stale cached one.

---

## 5. @CacheEvict — Removing Entries

`@CacheEvict` removes one or more entries from a cache, typically on delete operations, so future reads fall through to the source of truth.

```java
import org.springframework.cache.annotation.CacheEvict;

@CacheEvict(value = "products", key = "#id")
public void delete(Long id) {
    productRepository.deleteById(id);
}
```

Two useful attributes:

- `allEntries = true` — clears the entire cache region instead of a single key. Handy for bulk operations where computing individual keys is impractical.
- `beforeInvocation = true` — evicts before the method runs rather than after. Useful if the method might throw, and you want the eviction to happen regardless (the default, `false`, only evicts after a successful, non-exception return).

```java
@CacheEvict(value = "products", allEntries = true)
public void clearCatalogCache() {
    // no body needed — this method exists purely to trigger the evict
}

@CacheEvict(value = "products", key = "#id", beforeInvocation = true)
public void deleteRiskyOperation(Long id) {
    productRepository.deleteById(id); // if this throws, the entry is still gone
}
```

---

## 6. @Caching and @CacheConfig

`@Caching` lets you combine multiple cache operations on a single method when one annotation of each type isn't enough:

```java
import org.springframework.cache.annotation.Caching;

@Caching(
    put = { @CachePut(value = "products", key = "#product.id") },
    evict = { @CacheEvict(value = "productLists", allEntries = true) }
)
public Product update(Product product) {
    return productRepository.save(product);
}
```

`@CacheConfig` is a class-level annotation that lets you declare shared settings — most commonly the cache name — once, instead of repeating `value = "products"` on every method:

```java
import org.springframework.cache.annotation.CacheConfig;

@Service
@CacheConfig(cacheNames = "products")
public class ProductService {

    @Cacheable(key = "#id")
    public Product findById(Long id) { /* ... */ return null; }

    @CacheEvict(key = "#id")
    public void delete(Long id) { /* ... */ }
}
```

---

## 7. Cache Key Generation — SpEL and Custom KeyGenerator

If you omit `key`, Spring generates a key using the default `SimpleKeyGenerator`, based on all method arguments. For zero-argument methods it uses a fixed key; for one argument it uses that argument itself; for multiple arguments it wraps them in a `SimpleKey` composite. This works but is opaque and inflexible — most real projects specify keys explicitly with SpEL.

### SpEL key expressions

The `key` attribute is a SpEL expression evaluated in a context that exposes method arguments (`#paramName` or `#a0`, `#a1`, ...), plus special variables:

| Variable | Meaning |
|----------|---------|
| `#root.method` | the `Method` object being invoked |
| `#root.target` | the target bean instance |
| `#root.caches` | the caches this operation applies to |
| `#result` | the return value (only available in `unless`, and in `@CacheEvict` with `beforeInvocation=false`) |

```java
@Cacheable(value = "orderSummaries", key = "#customerId + '-' + #status")
public OrderSummary summarize(Long customerId, String status) { /* ... */ return null; }

@Cacheable(value = "products", key = "#product.sku")
public Product findBySku(Product product) { /* ... */ return null; }
```

### Custom KeyGenerator

For logic too complex for a one-line SpEL expression — or to enforce a consistent key format across many methods — implement `KeyGenerator` and register it as a bean, then reference it by name:

```java
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

@Component("productKeyGenerator")
public class ProductKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        String args = Arrays.stream(params)
                .map(String::valueOf)
                .collect(Collectors.joining(":"));
        return target.getClass().getSimpleName() + "#" + method.getName() + ":" + args;
    }
}
```

```java
@Cacheable(value = "products", keyGenerator = "productKeyGenerator")
public Product findById(Long id) { /* ... */ return null; }
```

`key` and `keyGenerator` are mutually exclusive on the same annotation — specifying both is a configuration error at startup.

---

## 8. How Caching Actually Works — The Proxy Mechanism

Spring's declarative caching, like `@Transactional`, is implemented with **AOP proxies**, not bytecode magic inside your class. When the container detects a bean with `@Cacheable`/`@CachePut`/`@CacheEvict` methods, it wraps that bean in a proxy — a CGLIB subclass proxy by default in Spring Boot, or a JDK dynamic proxy if the bean only implements interfaces and CGLIB proxying is disabled.

```
  Caller
    │
    ▼
  ProductService$$SpringCGLIB$$0   (proxy, extends ProductService)
    │
    │  intercepts findById(id) call
    ▼
  CacheInterceptor
    │  1. compute key
    │  2. check CacheManager → Cache "products"
    │  3. HIT?  return cached value, skip target method
    │     MISS? invoke target method, store result, return it
    ▼
  ProductService  (the real, undecorated bean — "target")
    └── findById(id) { ... real logic ... }
```

The bean that Spring registers in the application context — the one that gets autowired everywhere — is the **proxy**, not your original class. Every external call goes through the proxy first, giving the `CacheInterceptor` a chance to short-circuit the call on a cache hit. This is exactly the same mechanism `@Transactional` uses to open/commit transactions around a method call, and it has the same weakness.

---

## 9. The Self-Invocation Pitfall

Because caching is applied by an external proxy, it only intercepts calls that come in **from outside the bean, through the proxy**. If a method inside the bean calls another `@Cacheable` method on `this`, that call goes directly to the real object — bypassing the proxy entirely — so no caching happens.

```java
@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id")
    public Product findById(Long id) {
        System.out.println("Loading product " + id);
        return productRepository.findById(id).orElseThrow();
    }

    public List<Product> findMany(List<Long> ids) {
        // BUG: this calls findById() on "this", not on the proxy.
        // @Cacheable is silently ignored here — every call hits the DB.
        return ids.stream().map(this::findById).toList();
    }
}
```

Running `findMany` with the same ID twice will print "Loading product ..." both times, even though `findById` is annotated `@Cacheable`. This is the identical failure mode developers hit with `@Transactional` self-invocation, because the root cause — proxy-based AOP only intercepting external calls — is the same.

**Fixes:**

1. **Split into two beans.** Move `findById` into a separate `@Service` and inject it, so the call genuinely goes through a proxy.

    ```java
    @Service
    public class ProductLookupService {
        @Cacheable(value = "products", key = "#id")
        public Product findById(Long id) { /* ... */ return null; }
    }

    @Service
    public class ProductService {
        private final ProductLookupService lookupService;
        public ProductService(ProductLookupService lookupService) {
            this.lookupService = lookupService;
        }
        public List<Product> findMany(List<Long> ids) {
            return ids.stream().map(lookupService::findById).toList();
        }
    }
    ```

2. **Self-inject a proxy reference** using `@Lazy` (works but is widely considered a code smell — prefer option 1):

    ```java
    @Service
    public class ProductService {
        @Lazy @Autowired
        private ProductService self;

        @Cacheable(value = "products", key = "#id")
        public Product findById(Long id) { /* ... */ return null; }

        public List<Product> findMany(List<Long> ids) {
            return ids.stream().map(self::findById).toList();
        }
    }
    ```

3. **AspectJ compile-time or load-time weaving** removes the proxy limitation entirely, since the caching advice is woven directly into the bytecode rather than applied via a wrapping proxy — but it adds build complexity most projects don't need.

---

## 10. Pluggable CacheManagers

The `@Cacheable` family of annotations is provider-agnostic. The actual storage, eviction policy, TTL, and distribution behavior are determined entirely by which `CacheManager` bean is on the classpath/configured. Spring Boot auto-configures one for you based on what it finds.

### ConcurrentMapCacheManager — development / testing only

The simplest possible implementation: each named cache is backed by a `ConcurrentHashMap` living in the JVM's heap. Zero configuration, zero extra dependencies — Spring Boot falls back to this automatically if no other cache provider is on the classpath.

```java
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DevCacheConfig {

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("products", "orderSummaries");
    }
}
```

It has no eviction policy, no size limit, and no expiration — entries live forever unless explicitly evicted or the JVM restarts. That makes it fine for local development and tests, and a memory-leak risk in production.

### Caffeine — high-performance in-process cache

Caffeine is the modern replacement for Guava's cache and Spring Boot's recommended in-process option. It supports size-based eviction, time-based expiration, and near-optimal hit rates via a W-TinyLFU eviction policy.

```xml
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>
```

```java
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import java.util.concurrent.TimeUnit;

@Bean
public CacheManager cacheManager() {
    CaffeineCacheManager cacheManager = new CaffeineCacheManager("products");
    cacheManager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(10, TimeUnit.MINUTES));
    return cacheManager;
}
```

Caffeine is still per-instance/in-process — in a multi-instance deployment, each pod maintains its own independent cache, so entries are not shared and invalidations on one instance don't affect the others.

### Redis — distributed, shared caching

For multi-instance deployments where cache consistency across nodes matters (e.g., a `@CacheEvict` on one instance should invalidate the entry everywhere), an external cache like Redis is required.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```java
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import java.time.Duration;

@Bean
public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
    RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(15))
            .disableCachingNullValues()
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                    .fromSerializer(new StringRedisSerializer()));

    return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .build();
}
```

With `spring-boot-starter-data-redis` on the classpath and a reachable Redis instance, Spring Boot will actually auto-configure a `RedisCacheManager` for you with no explicit `@Bean` needed — the manual bean above is shown for when you need custom TTLs or serialization per cache. Values are serialized (JSON or JDK serialization) to cross the network, so cached objects must be serializable, unlike with in-process caches.

| CacheManager | Scope | Eviction/TTL | Best for |
|---|---|---|---|
| `ConcurrentMapCacheManager` | Single JVM | None (manual only) | Local dev, quick prototypes |
| `CaffeineCacheManager` | Single JVM | Size + time based | Single-instance production, hot local caches |
| `RedisCacheManager` | Shared/distributed | TTL-based | Multi-instance production, shared cache state |

---

## 11. Worked Example — Caching an Expensive Lookup

A pricing service that calls a slow external exchange-rate API. Without caching, every price request pays the full network round trip.

```java
@Service
@CacheConfig(cacheNames = "exchangeRates")
public class ExchangeRateService {

    private final ExchangeRateClient exchangeRateClient; // slow HTTP client

    public ExchangeRateService(ExchangeRateClient exchangeRateClient) {
        this.exchangeRateClient = exchangeRateClient;
    }

    @Cacheable(key = "#currencyCode", unless = "#result == null")
    public BigDecimal getRateToUsd(String currencyCode) {
        System.out.println("Calling external exchange-rate API for " + currencyCode);
        return exchangeRateClient.fetchRate(currencyCode); // expensive network call
    }

    // Called by a scheduled job when rates are refreshed upstream
    @CacheEvict(allEntries = true)
    public void invalidateAllRates() {
        System.out.println("Cleared exchange rate cache");
    }
}
```

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager("exchangeRates");
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(1, TimeUnit.HOURS));
        return cacheManager;
    }
}
```

The first call to `getRateToUsd("EUR")` prints the log line and pays the network cost. Every call for `EUR` within the next hour returns instantly from Caffeine. After an hour, or after `invalidateAllRates()` runs, the next call is a fresh miss.

---

## 12. Common Pitfalls

- **Forgetting `@EnableCaching`.** The annotations compile fine and do nothing at runtime — no exception, no log warning, just full method execution every call.
- **Self-invocation.** Calling a `@Cacheable` method from another method on the same bean bypasses the proxy entirely (see Section 9).
- **Caching mutable objects without defensive copies.** If a cached object is mutated by the caller after retrieval, every subsequent cache hit returns the mutated (corrupted) instance — because in-process caches typically store references, not copies.
- **Using `ConcurrentMapCacheManager` in production.** No eviction, no TTL — an unbounded cache is a slow-motion `OutOfMemoryError`.
- **Caching methods with side effects or non-idempotent behavior.** `@Cacheable` assumes the method is a pure function of its arguments; caching a method that also sends an email or writes an audit log means those side effects only happen once, silently, on the first call.
- **Not handling exceptions.** By default, if the cached method throws, nothing is cached (correct), but callers relying on `@Cacheable` to also cache error states need `unless` or a custom `CacheErrorHandler` — Spring does not cache exceptions by default.
- **Keys that don't uniquely identify results.** Omitting `key` on overloaded methods with the default `SimpleKeyGenerator` can cause different argument combinations to collide or, conversely, generate keys that are needlessly method-signature-sensitive.

---

## 13. Best Practices

- Always pair `@Cacheable` reads with an explicit `@CacheEvict`/`@CachePut` on the corresponding write path — a cache with no invalidation strategy is a bug waiting to surface as stale data.
- Prefer Caffeine or Redis over `ConcurrentMapCacheManager` outside of local development; always configure a `maximumSize` and `expireAfterWrite`/TTL.
- Keep cache keys simple and explicit (`key = "#id"`) rather than relying on the default key generator for anything beyond trivial single-argument methods.
- Use `unless` to avoid caching `null` or error-shaped results, which otherwise poison the cache with a permanent "not found" answer.
- Split cross-calling `@Cacheable` methods into separate beans rather than fighting self-invocation with `@Lazy` self-injection.
- Name caches descriptively (`"products"`, `"exchangeRates"`) and configure per-cache TTLs — don't share one giant undifferentiated cache region for unrelated data with different freshness needs.
- In distributed deployments, default to Redis (or another shared store) whenever correctness depends on all instances seeing the same evictions.

---

## 14. Hands-On Exercises

1. Add `@EnableCaching` and a `ConcurrentMapCacheManager` to a small Spring Boot app with a `UserService.findById(Long id)` method. Add a `Thread.sleep(1000)` inside it to simulate latency, then call it twice with the same ID from a REST controller and observe the timing difference in the logs.
2. Reproduce the self-invocation bug: add a `findAll(List<Long> ids)` method on `UserService` that calls `this.findById(id)` in a loop. Confirm via logging that caching is bypassed, then fix it by extracting `findById` into a separate bean.
3. Replace `ConcurrentMapCacheManager` with a Caffeine-backed `CacheManager` configured with `maximumSize(100)` and `expireAfterWrite(30, TimeUnit.SECONDS)`. Verify entries actually expire by waiting past the TTL and confirming the method body re-executes.
4. Write a custom `KeyGenerator` that builds keys from a bean's class name, method name, and all arguments joined by `:`. Apply it to two different service methods with `keyGenerator = "..."` and print the cache's key set to confirm the format.
5. Add Redis to a local Docker Compose file, wire up `spring-boot-starter-data-redis`, and configure a `RedisCacheManager` with a 5-minute TTL. Cache a service method, restart the application, and confirm the cached value survives the restart (proving it lives outside the JVM), unlike a Caffeine or ConcurrentMap cache.

---

## 15. Interview Q&A

**Q1: What is the difference between `@Cacheable` and `@CachePut`?**
`@Cacheable` checks the cache first and skips the method body entirely on a hit, returning the stored value. `@CachePut` always executes the method body and always overwrites the cache entry with the fresh result — it never skips execution. `@Cacheable` is for reads you want to short-circuit; `@CachePut` is for writes (create/update) where you want the cache kept in sync with a database write that must still happen.

**Q2: Why does calling a `@Cacheable` method from another method in the same class not get cached?**
Spring implements caching via a proxy wrapped around the bean. External callers invoke the proxy, which checks the cache before delegating to the real method. But a call from inside the class to `this.method()` goes directly to the real object, never passing through the proxy, so the caching interceptor never runs. This is the same root cause behind `@Transactional` not working on self-invoked calls. The fix is to move the cached method to a separate bean and call it through an injected reference, so the call genuinely passes through a proxy.

**Q3: How do you decide what CacheManager to use?**
Use `ConcurrentMapCacheManager` only for local development or tests — it has no eviction or TTL and will leak memory in production. Use Caffeine for a single-instance (or per-instance) production cache needing size/time-based eviction with the lowest possible latency, since it's entirely in-process. Use Redis (or another external store) when multiple application instances must share cache state and see each other's evictions — critical whenever correctness depends on cross-instance consistency, such as invalidating a cached price after any instance processes an update.

**Q4: How does Spring generate a cache key when you don't specify one?**
It uses `SimpleKeyGenerator`: zero-argument methods get a fixed key, single-argument methods use that argument as the key directly, and multi-argument methods get wrapped into a composite `SimpleKey` built from all arguments' `hashCode`/`equals`. This is fragile for anything beyond trivial cases — most production code specifies `key` explicitly with SpEL or a custom `KeyGenerator` bean for clarity and to avoid accidental key collisions on overloaded methods.

**Q5: What happens if you cache the result of a method and the underlying data changes elsewhere (e.g., a direct database update outside the app)?**
The cache has no idea the underlying data changed — it happily keeps serving the stale value until the entry's TTL expires or it's explicitly evicted. This is the fundamental caching trade-off: staleness bounded by TTL/eviction policy in exchange for speed. Systems that cannot tolerate any staleness generally should not cache that data at all, or must have an explicit invalidation hook triggered by the write path (a `@CacheEvict` on every write, or a Redis pub/sub-based invalidation across instances).

**Q6: Why must objects cached in Redis be serializable, but not objects cached with Caffeine?**
Caffeine stores data in the same JVM heap as your application, so it can hold a live object reference directly — no conversion needed. Redis is an external process reachable only over the network, so cached values must be converted to bytes (JSON, JDK serialization, etc.) to cross that boundary and be reconstructed on retrieval. This is why `RedisCacheManager` configuration typically wires in serializers, and why a class that works fine with an in-process cache can suddenly throw a `SerializationException` the moment you swap in Redis.
