import { NextResponse } from 'next/server';

export async function GET() {
  const cards = [
    {
      id: '1',
      category: 'Spring Boot',
      front: 'What is the difference between @Component, @Service, and @Repository?',
      back: "@Component is the generic stereotype for any Spring-managed bean. @Service marks business service layer beans. @Repository marks data access beans and enables automatic persistence exception translation into Spring's DataAccessException hierarchy.",
    },
    {
      id: '2',
      category: 'Database Architecture',
      front: 'What is the difference between Multi-AZ and Read Replicas in Amazon RDS?',
      back: 'Multi-AZ is for High Availability and Disaster Recovery (synchronous replication to a standby instance in another AZ). Read Replicas are for Read Scalability (asynchronous replication where read-heavy queries are offloaded).',
    },
    {
      id: '3',
      category: 'Spring Boot',
      front: 'How does @Transactional work behind the scenes?',
      back: 'Spring generates a CGLIB/JDK dynamic proxy around the bean. When the method is invoked, the proxy intercepts the call, starts or joins a transaction via PlatformTransactionManager, commits on normal exit, and rolls back on RuntimeException or Error.',
    },
    {
      id: '4',
      category: 'Distributed Systems',
      front: 'What is the CAP Theorem?',
      back: 'In any distributed data store, you can only guarantee at most two of the following three properties during network partitioning: Consistency (every read receives the most recent write), Availability (every request receives a non-error response), and Partition Tolerance.',
    },
    {
      id: '5',
      category: 'Next.js & React',
      front: 'What is the difference between Server Components and Client Components?',
      back: "React Server Components (RSC) execute exclusively on the server, sending rendered HTML/JSON to the client with zero client-side JavaScript bundle weight. Client Components ('use client') run on both server (for SSR) and client, supporting interactivity, hooks, and browser APIs.",
    },
  ];

  return NextResponse.json(cards);
}
