import { NextResponse } from 'next/server';

export async function GET() {
  const questions = [
    {
      id: 1,
      topic: 'Spring Boot',
      question: "What is the primary purpose of Spring's Inversion of Control (IoC) container?",
      options: [
        'To route HTTP requests directly to database sockets',
        'To delegate the creation and dependency wiring of objects to a central container',
        'To compile Java bytecode directly to native binary code',
        'To generate automatic front-end HTML templates',
      ],
      correctIndex: 1,
      explanation: 'IoC inverts control: rather than classes instantiating their own dependencies, the container manages lifecycle and wires dependencies using Dependency Injection.',
    },
    {
      id: 2,
      topic: 'Spring Boot',
      question: 'Which annotation combines @Configuration, @EnableAutoConfiguration, and @ComponentScan?',
      options: [
        '@EnableSpringBootServices',
        '@SpringApplicationContext',
        '@SpringBootApplication',
        '@RestControllerAdvice',
      ],
      correctIndex: 2,
      explanation: '@SpringBootApplication is a meta-annotation that configures component scanning, auto-configuration, and Spring configuration in one declaration.',
    },
    {
      id: 3,
      topic: 'AWS & Cloud',
      question: 'What is the difference between Security Groups and Network ACLs in an AWS VPC?',
      options: [
        'Security Groups are stateless at subnet level; NACLs are stateful at instance level',
        'Security Groups are stateful at instance/ENI level; NACLs are stateless at subnet level',
        'Both are stateless, but NACLs only support egress rules',
        'There is no difference; they are interchangeable',
      ],
      correctIndex: 1,
      explanation: 'Security Groups operate statefully at the virtual network interface (ENI) level, while Network Access Control Lists (NACLs) operate statelessly at the subnet boundary.',
    },
    {
      id: 4,
      topic: 'System Design (HLD)',
      question: 'How do you achieve idempotency in a distributed Payment Gateway API?',
      options: [
        'By always using HTTP GET requests for charging credit cards',
        'By assigning an Idempotency-Key header stored in Redis/DB with unique transaction status',
        'By deploying more read replicas to the database',
        'By disabling network timeouts on the load balancer',
      ],
      correctIndex: 1,
      explanation: 'An Idempotency-Key allows the client to retry requests safely. The server checks if the key has already been processed or is in-flight, preventing duplicate charges.',
    },
  ];

  return NextResponse.json(questions);
}
