import { QuickReferenceTopic, CategorySummary } from './types';
import { category1Fundamentals } from './category1-fundamentals';
import { category2FunctionsOop } from './category2-functions-oop';
import { category3ObjectsData } from './category3-objects-data';
import { category4Functional } from './category4-functional';
import { category5ErrorModules } from './category5-error-modules';

import { nodejsCategory1FundamentalsArch } from './nodejs-category1-fundamentals-arch';
import { nodejsCategory2EventLoopAsync } from './nodejs-category2-event-loop-async';
import { nodejsCategory3ConcurrencyParallelism } from './nodejs-category3-concurrency-parallelism';
import { nodejsCategory4DataHandlingCore } from './nodejs-category4-data-handling-core';
import { nodejsCategory5MemoryPerformance } from './nodejs-category5-memory-performance';

import { asyncCategory1Fundamentals } from './async-category1-fundamentals';
import { asyncCategory2Promises } from './async-category2-promises';
import { asyncCategory3Combinators } from './async-category3-combinators';
import { asyncCategory4ErrorHandling } from './async-category4-error-handling';
import { asyncCategory5Concurrency } from './async-category5-concurrency';
import { asyncCategory6AdvancedProblems } from './async-category6-advanced-problems';
import { asyncCategory7CancellationResilience } from './async-category7-cancellation-resilience';

import { expressCategory1Fundamentals } from './express-category1-fundamentals';
import { expressCategory2MiddlewareLifecycle } from './express-category2-middleware-lifecycle';
import { expressCategory3ArchitecturePatterns } from './express-category3-architecture-patterns';
import { expressCategory4ValidationFiles } from './express-category4-validation-files';
import { expressCategory5SecurityState } from './express-category5-security-state';
import { expressCategory6RestApi } from './express-category6-rest-api';
import { expressCategory7ProductionLifecycle } from './express-category7-production-lifecycle';

export * from './types';
export { category1Fundamentals } from './category1-fundamentals';
export { category2FunctionsOop } from './category2-functions-oop';
export { category3ObjectsData } from './category3-objects-data';
export { category4Functional } from './category4-functional';
export { category5ErrorModules } from './category5-error-modules';

export { nodejsCategory1FundamentalsArch } from './nodejs-category1-fundamentals-arch';
export { nodejsCategory2EventLoopAsync } from './nodejs-category2-event-loop-async';
export { nodejsCategory3ConcurrencyParallelism } from './nodejs-category3-concurrency-parallelism';
export { nodejsCategory4DataHandlingCore } from './nodejs-category4-data-handling-core';
export { nodejsCategory5MemoryPerformance } from './nodejs-category5-memory-performance';

export { asyncCategory1Fundamentals } from './async-category1-fundamentals';
export { asyncCategory2Promises } from './async-category2-promises';
export { asyncCategory3Combinators } from './async-category3-combinators';
export { asyncCategory4ErrorHandling } from './async-category4-error-handling';
export { asyncCategory5Concurrency } from './async-category5-concurrency';
export { asyncCategory6AdvancedProblems } from './async-category6-advanced-problems';
export { asyncCategory7CancellationResilience } from './async-category7-cancellation-resilience';

export { expressCategory1Fundamentals } from './express-category1-fundamentals';
export { expressCategory2MiddlewareLifecycle } from './express-category2-middleware-lifecycle';
export { expressCategory3ArchitecturePatterns } from './express-category3-architecture-patterns';
export { expressCategory4ValidationFiles } from './express-category4-validation-files';
export { expressCategory5SecurityState } from './express-category5-security-state';
export { expressCategory6RestApi } from './express-category6-rest-api';
export { expressCategory7ProductionLifecycle } from './express-category7-production-lifecycle';

// Section 1: JavaScript Fundamentals (25 Topics)
export const javascriptTopics: QuickReferenceTopic[] = [
  ...category1Fundamentals,
  ...category2FunctionsOop,
  ...category3ObjectsData,
  ...category4Functional,
  ...category5ErrorModules
].map((t) => ({
  ...t,
  section: 'JavaScript Fundamentals',
  sectionSlug: 'javascript'
}));

// Section 2: Node.js Internals and Architecture (24 Topics)
export const nodejsTopics: QuickReferenceTopic[] = [
  ...nodejsCategory1FundamentalsArch,
  ...nodejsCategory2EventLoopAsync,
  ...nodejsCategory3ConcurrencyParallelism,
  ...nodejsCategory4DataHandlingCore,
  ...nodejsCategory5MemoryPerformance
].map((t) => ({
  ...t,
  section: 'Node.js Internals and Architecture',
  sectionSlug: 'nodejs'
}));

// Section 3: Asynchronous Programming (19 Topics)
export const asyncTopics: QuickReferenceTopic[] = [
  ...asyncCategory1Fundamentals,
  ...asyncCategory2Promises,
  ...asyncCategory3Combinators,
  ...asyncCategory4ErrorHandling,
  ...asyncCategory5Concurrency,
  ...asyncCategory6AdvancedProblems,
  ...asyncCategory7CancellationResilience
].map((t) => ({
  ...t,
  section: 'Asynchronous Programming',
  sectionSlug: 'async'
}));

// Section 4: Express.js – Backend Development (23 Topics)
export const expressTopics: QuickReferenceTopic[] = [
  ...expressCategory1Fundamentals,
  ...expressCategory2MiddlewareLifecycle,
  ...expressCategory3ArchitecturePatterns,
  ...expressCategory4ValidationFiles,
  ...expressCategory5SecurityState,
  ...expressCategory6RestApi,
  ...expressCategory7ProductionLifecycle
].map((t) => ({
  ...t,
  section: 'Express.js – Backend Development',
  sectionSlug: 'express'
}));

// Combined 91 Master Topics across 4 Modules
export const allQuickReferenceTopics: QuickReferenceTopic[] = [
  ...javascriptTopics,
  ...nodejsTopics,
  ...asyncTopics,
  ...expressTopics
];

export const MODULE_SECTIONS: { id: 'all' | 'javascript' | 'nodejs' | 'async' | 'express'; name: string; shortName: string; count: number }[] = [
  { id: 'all', name: 'All Modules (91 Topics)', shortName: 'All Topics', count: allQuickReferenceTopics.length },
  { id: 'javascript', name: 'Section 1: JavaScript Core (25 Topics)', shortName: 'JavaScript Core', count: javascriptTopics.length },
  { id: 'nodejs', name: 'Section 2: Node.js Internals & Architecture (24 Topics)', shortName: 'Node.js Internals', count: nodejsTopics.length },
  { id: 'async', name: 'Section 3: Asynchronous Programming (19 Topics)', shortName: 'Async Programming', count: asyncTopics.length },
  { id: 'express', name: 'Section 4: Express.js – Backend Development (23 Topics)', shortName: 'Express.js', count: expressTopics.length }
];

export const CATEGORY_DEFINITIONS: { name: string; slug: string; section: string; sectionSlug: 'javascript' | 'nodejs' | 'async' | 'express' }[] = [
  // Section 1: JavaScript Categories
  { name: 'JavaScript Fundamentals and Execution', slug: 'fundamentals', section: 'JavaScript Fundamentals', sectionSlug: 'javascript' },
  { name: 'Functions and Object-Oriented JavaScript', slug: 'functions-oop', section: 'JavaScript Fundamentals', sectionSlug: 'javascript' },
  { name: 'Objects and Data Handling', slug: 'objects-data', section: 'JavaScript Fundamentals', sectionSlug: 'javascript' },
  { name: 'Functional JavaScript', slug: 'functional', section: 'JavaScript Fundamentals', sectionSlug: 'javascript' },
  { name: 'Error Handling and Modules', slug: 'error-modules', section: 'JavaScript Fundamentals', sectionSlug: 'javascript' },

  // Section 2: Node.js Categories
  { name: 'Node.js Fundamentals and Architecture', slug: 'nodejs-fundamentals', section: 'Node.js Internals and Architecture', sectionSlug: 'nodejs' },
  { name: 'Event Loop and Asynchronous Execution', slug: 'event-loop-async', section: 'Node.js Internals and Architecture', sectionSlug: 'nodejs' },
  { name: 'Concurrency and Parallelism', slug: 'concurrency-parallelism', section: 'Node.js Internals and Architecture', sectionSlug: 'nodejs' },
  { name: 'Data Handling and Core Modules', slug: 'data-handling-core', section: 'Node.js Internals and Architecture', sectionSlug: 'nodejs' },
  { name: 'Memory Management and Performance', slug: 'memory-performance', section: 'Node.js Internals and Architecture', sectionSlug: 'nodejs' },

  // Section 3: Asynchronous Programming Categories
  { name: 'Asynchronous Programming Fundamentals', slug: 'async-fundamentals', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Promises and Async/Await', slug: 'promises-async', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Promise Combinators', slug: 'promise-combinators', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Asynchronous Error Handling', slug: 'async-error-handling-cat', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Concurrency and Execution Control', slug: 'concurrency-control', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Advanced Asynchronous Problems', slug: 'advanced-async-problems', section: 'Asynchronous Programming', sectionSlug: 'async' },
  { name: 'Cancellation and Resilience', slug: 'cancellation-resilience', section: 'Asynchronous Programming', sectionSlug: 'async' },

  // Section 4: Express.js Backend Development Categories
  { name: 'Express Fundamentals and Architecture', slug: 'express-fundamentals', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'Middleware and Request Lifecycle', slug: 'express-middleware-lifecycle', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'Backend Architecture and Design Patterns', slug: 'express-architecture-patterns', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'Validation and File Handling', slug: 'express-validation-files', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'HTTP State and Security-Related Middleware', slug: 'express-security-state', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'REST API Development', slug: 'express-rest-api', section: 'Express.js – Backend Development', sectionSlug: 'express' },
  { name: 'Production and Application Lifecycle', slug: 'express-production-lifecycle', section: 'Express.js – Backend Development', sectionSlug: 'express' }
];

export const categorySummaries: CategorySummary[] = CATEGORY_DEFINITIONS.map(cat => {
  const topics = allQuickReferenceTopics.filter(t => t.categorySlug === cat.slug);
  return {
    name: cat.name,
    slug: cat.slug,
    section: cat.section,
    sectionSlug: cat.sectionSlug,
    topicCount: topics.length,
    topicIds: topics.map(t => t.id)
  };
});

export function getTopicById(id: string): QuickReferenceTopic | undefined {
  return allQuickReferenceTopics.find(t => t.id.toLowerCase() === id.toLowerCase());
}

export function getAdjacentTopics(currentId: string, sectionFilter?: 'all' | 'javascript' | 'nodejs' | 'async' | 'express'): {
  prev: QuickReferenceTopic | null;
  next: QuickReferenceTopic | null;
} {
  const pool = sectionFilter && sectionFilter !== 'all'
    ? allQuickReferenceTopics.filter(t => t.sectionSlug === sectionFilter)
    : allQuickReferenceTopics;

  const index = pool.findIndex(t => t.id.toLowerCase() === currentId.toLowerCase());
  if (index === -1) {
    // If currentId is not in the filtered pool, find in full list
    const globalIdx = allQuickReferenceTopics.findIndex(t => t.id.toLowerCase() === currentId.toLowerCase());
    return {
      prev: globalIdx > 0 ? allQuickReferenceTopics[globalIdx - 1] : null,
      next: globalIdx < allQuickReferenceTopics.length - 1 ? allQuickReferenceTopics[globalIdx + 1] : null
    };
  }
  return {
    prev: index > 0 ? pool[index - 1] : null,
    next: index < pool.length - 1 ? pool[index + 1] : null
  };
}
