package com.skillvault.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/practice")
public class PracticeController {

    @GetMapping("/quizzes")
    public ResponseEntity<List<Map<String, Object>>> getQuizzes(@RequestParam(defaultValue = "springboot") String topic) {
        List<Map<String, Object>> questions = List.of(
            Map.of(
                "id", 1,
                "topic", "Spring Boot",
                "question", "What is the primary purpose of Spring's Inversion of Control (IoC) container?",
                "options", List.of(
                    "To route HTTP requests directly to database sockets",
                    "To delegate the creation and dependency wiring of objects to a central container",
                    "To compile Java bytecode directly to native binary code",
                    "To generate automatic front-end HTML templates"
                ),
                "correctIndex", 1,
                "explanation", "IoC inverts control: rather than classes instantiating their own dependencies, the container manages lifecycle and wires dependencies using Dependency Injection."
            ),
            Map.of(
                "id", 2,
                "topic", "Spring Boot",
                "question", "Which annotation combines @Configuration, @EnableAutoConfiguration, and @ComponentScan?",
                "options", List.of(
                    "@EnableSpringBootServices",
                    "@SpringApplicationContext",
                    "@SpringBootApplication",
                    "@RestControllerAdvice"
                ),
                "correctIndex", 2,
                "explanation", "@SpringBootApplication is a meta-annotation that configures component scanning, auto-configuration, and Spring configuration in one declaration."
            ),
            Map.of(
                "id", 3,
                "topic", "AWS & Cloud",
                "question", "What is the difference between Security Groups and Network ACLs in an AWS VPC?",
                "options", List.of(
                    "Security Groups are stateless at subnet level; NACLs are stateful at instance level",
                    "Security Groups are stateful at instance/ENI level; NACLs are stateless at subnet level",
                    "Both are stateless, but NACLs only support egress rules",
                    "There is no difference; they are interchangeable"
                ),
                "correctIndex", 1,
                "explanation", "Security Groups operate statefully at the virtual network interface (ENI) level, while Network Access Control Lists (NACLs) operate statelessly at the subnet boundary."
            ),
            Map.of(
                "id", 4,
                "topic", "System Design (HLD)",
                "question", "How do you achieve idempotency in a distributed Payment Gateway API?",
                "options", List.of(
                    "By always using HTTP GET requests for charging credit cards",
                    "By assigning an Idempotency-Key header stored in Redis/DB with unique transaction status",
                    "By deploying more read replicas to the database",
                    "By disabling network timeouts on the load balancer"
                ),
                "correctIndex", 1,
                "explanation", "An Idempotency-Key allows the client to retry requests safely. The server checks if the key has already been processed or is in-flight, preventing duplicate charges."
            )
        );
        return ResponseEntity.ok(questions);
    }

    @GetMapping("/flashcards")
    public ResponseEntity<List<Map<String, String>>> getFlashcards(@RequestParam(defaultValue = "springboot") String topic) {
        List<Map<String, String>> cards = List.of(
            Map.of(
                "id", "1",
                "category", "Spring Boot",
                "front", "What is the difference between @Component, @Service, and @Repository?",
                "back", "@Component is the generic stereotype for any Spring-managed bean. @Service marks business service layer beans. @Repository marks data access beans and enables automatic persistence exception translation into Spring's DataAccessException hierarchy."
            ),
            Map.of(
                "id", "2",
                "category", "Database Architecture",
                "front", "What is the difference between Multi-AZ and Read Replicas in Amazon RDS?",
                "back", "Multi-AZ is for High Availability and Disaster Recovery (synchronous replication to a standby instance in another AZ). Read Replicas are for Read Scalability (asynchronous replication where read-heavy queries are offloaded)."
            ),
            Map.of(
                "id", "3",
                "category", "Spring Boot",
                "front", "How does @Transactional work behind the scenes?",
                "back", "Spring generates a CGLIB/JDK dynamic proxy around the bean. When the method is invoked, the proxy intercepts the call, starts or joins a transaction via PlatformTransactionManager, commits on normal exit, and rolls back on RuntimeException or Error."
            ),
            Map.of(
                "id", "4",
                "category", "Distributed Systems",
                "front", "What is the CAP Theorem?",
                "back", "In any distributed data store, you can only guarantee at most two of the following three properties during network partitioning: Consistency (every read receives the most recent write), Availability (every request receives a non-error response), and Partition Tolerance."
            ),
            Map.of(
                "id", "5",
                "category", "Next.js & React",
                "front", "What is the difference between Server Components and Client Components?",
                "back", "React Server Components (RSC) execute exclusively on the server, sending rendered HTML/JSON to the client with zero client-side JavaScript bundle weight. Client Components ('use client') run on both server (for SSR) and client, supporting interactivity, hooks, and browser APIs."
            )
        );
        return ResponseEntity.ok(cards);
    }
}
