'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Search,
  Sparkles,
  Clock,
  ArrowRight,
  BookOpen,
  Terminal,
  Cpu,
  Cloud,
  Database,
  BrainCircuit,
  Layers,
  Code2,
  CheckCircle2,
  Filter,
  Zap,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { fetchInterviewGuides, InterviewGuide } from '@/lib/api';

// Curated high-yield tags mapping for top tech tracks to enhance interview study cards
const TECH_TAGS_MAP: Record<string, string[]> = {
  angular: ['Signals vs RxJS', 'Zoneless Change Detection', 'OnPush Strategy', 'Control Flow (@defer)'],
  springboot: ['Spring Dynamic Proxies', 'Transactional Propagation', 'Spring Security 6', 'Virtual Threads'],
  java: ['JVM Memory & GC', 'Concurrency & Locks', 'ForkJoin & Virtual Threads', 'Generics & Streams'],
  hld: ['Distributed Caching', 'Kafka Partitioning', 'Database Sharding', 'Idempotency & Resiliency'],
  lld: ['Design Patterns', 'SOLID Principles', 'Thread-Safe Singletons', 'Clean Architecture'],
  dsa: ['Two Pointers & Sliding Window', 'Dynamic Programming', 'Graph Traversal', 'Tree Balancing'],
  aws: ['VPC & Subnets', 'IAM Least Privilege', 'ECS vs EKS', 'Serverless & DynamoDB'],
  kubernetes: ['Pods & ReplicaSets', 'Services & Ingress', 'RBAC Security', 'StatefulSets vs Deployments'],
  docker: ['Multi-Stage Builds', 'Layer Caching', 'Docker Compose', 'Container Security'],
  javascript: ['Event Loop & Microtasks', 'Closures & Scopes', 'Prototypes & Classes', 'Promises & Async/Await'],
  nodejs: ['Event-Driven Architecture', 'Libuv & Worker Threads', 'Stream Backpressure', 'Memory Leaks'],
  nestjs: ['Dependency Injection', 'Guards & Interceptors', 'Microservices Transport', 'Pipes & Validation'],
  'production-rag': ['PostgreSQL + pgvector', 'HNSW vs IVFFlat', 'Reciprocal Rank Fusion (RRF)', 'Cross-Encoder Reranking', 'Contextual Compression', 'FastAPI & Tenant Auth'],
  rag: ['Vector Embeddings', 'Hybrid Search & Reranking', 'Chunking Strategies', 'RAG Triad Evaluation'],
  genai: ['Prompt Engineering', 'Function Calling', 'Fine-Tuning vs RAG', 'Agentic Workflows'],
  langchain: ['LCEL Chains', 'Memory Systems', 'Retrievers & Tools', 'Custom Callbacks'],
  langgraph: ['State Graphs', 'Human-in-the-Loop', 'Multi-Agent Supervisor', 'Checkpointing'],
  postgresql: ['B-Tree vs GIN Indexes', 'MVCC & Vacuuming', 'EXPLAIN ANALYZE', 'Connection Pooling'],
  mysql: ['InnoDB Storage Engine', 'Index Optimization', 'Replication Lag', 'ACID Transactions'],
  mongodb: ['Document Modeling', 'Aggregation Pipeline', 'Replica Sets', 'Sharding Keys'],
  redis: ['Data Structures (Sets, ZSets)', 'Cache Eviction Policies', 'Redis Cluster', 'Distributed Locks (Redlock)'],
  operatingsystems: ['Processes vs Threads', 'Mutex vs Semaphores', 'Virtual Memory & Paging', 'CPU Scheduling'],
  networking: ['TCP 3-Way Handshake', 'TLS 1.3 Handshake', 'HTTP/2 vs HTTP/3', 'DNS Resolution Hierarchy'],
  git: ['Git DAG Internals', 'Rebase vs Merge', 'Conflict Resolution', 'Cherry-Pick & Reflog'],
  terraform: ['State Locking', 'Modules & Workspaces', 'Lifecycle Hooks', 'Plan vs Apply Mechanics'],
  githubactions: ['CI/CD Pipelines', 'Matrix Builds', 'Self-Hosted Runners', 'Secret Masking'],
  paymentgateways: ['Webhook Verification', 'Idempotency Keys', 'PCI-DSS Compliance', 'Reconciliation'],
  aptitude: ['Behavioral STAR Method', 'Conflict Resolution', 'Salary Negotiation', 'Leadership Scenarios']
};

// Fallback high-priority curated interview tracks if API is loading
const FALLBACK_GUIDES: InterviewGuide[] = [
  {
    id: 1,
    title: 'Senior Angular Engineer Master Guide (100 Q&A + Mock Scenarios)',
    lessonSlug: 'interview-qa',
    courseSlug: 'angular',
    courseTitle: 'Angular',
    category: 'Frontend',
    estimatedMinutes: 35,
    summary: 'Master Signals, Zoneless change detection, RxJS interop, OnPush, standalone APIs, and enterprise web performance.',
    url: '/courses/angular/interview-qa'
  },
  {
    id: 2,
    title: 'Senior Spring Boot & Java Backend Master Guide (100 Q&A)',
    lessonSlug: 'interview-qa',
    courseSlug: 'springboot',
    courseTitle: 'Spring Boot 3 & 4 Backend',
    category: 'Backend',
    estimatedMinutes: 40,
    summary: 'Spring Dynamic Proxies, Bean Lifecycle, Transactional propagation, Spring Security 6, Kafka, and Virtual Threads.',
    url: '/courses/springboot/interview-qa'
  },
  {
    id: 3,
    title: 'High-Level Design (HLD) Interview Master Guide',
    lessonSlug: 'interview-qa',
    courseSlug: 'hld',
    courseTitle: 'High-Level Design (HLD)',
    category: 'System Design',
    estimatedMinutes: 45,
    summary: 'The 4-step System Design Interview Framework, back-of-envelope estimation, load balancers, caching, and database sharding.',
    url: '/courses/hld/interview-qa'
  },
  {
    id: 4,
    title: 'Low-Level Design (LLD) & Design Patterns Interview Guide',
    lessonSlug: 'interview-qa',
    courseSlug: 'lld',
    courseTitle: 'Low-Level Design (LLD)',
    category: 'System Design',
    estimatedMinutes: 35,
    summary: 'Object-oriented modeling, Gang of Four design patterns, SOLID principles, concurrency, and clean enterprise architecture.',
    url: '/courses/lld/interview-qa'
  },
  {
    id: 5,
    title: 'AWS Cloud Solutions Architect Interview Questions',
    lessonSlug: 'interview-questions-master',
    courseSlug: 'aws',
    courseTitle: 'Amazon Web Services (AWS)',
    category: 'Cloud & DevOps',
    estimatedMinutes: 30,
    summary: 'Multi-AZ architecture, VPC peering, IAM roles, ECS/EKS containerization, serverless Lambda, and cost optimization.',
    url: '/courses/aws/interview-questions-master'
  },
  {
    id: 6,
    title: 'Java Core, Concurrency & JVM Deep Dive',
    lessonSlug: 'interview-qa',
    courseSlug: 'java',
    courseTitle: 'Java Core & Concurrency Masterclass',
    category: 'Backend',
    estimatedMinutes: 35,
    summary: 'Java memory model, Garbage Collectors (ZGC/G1), synchronized vs Lock, CompletableFuture, and Virtual Threads.',
    url: '/courses/java/interview-qa'
  },
  {
    id: 71,
    title: 'Senior Production RAG Architecture Interview Q&A',
    lessonSlug: 'interview-qa',
    courseSlug: 'production-rag',
    courseTitle: 'Production RAG Architecture & Engineering',
    category: 'AI & LLMs',
    estimatedMinutes: 35,
    summary: 'pgvector HNSW indexes, Reciprocal Rank Fusion (RRF), Cross-Encoder reranking, multi-tenant isolation, and citation validation.',
    url: '/courses/production-rag/interview-qa'
  },
  {
    id: 7,
    title: 'RAG Architecture & Retrieval-Augmented Generation Q&A',
    lessonSlug: 'interview-qa',
    courseSlug: 'rag',
    courseTitle: 'Retrieval-Augmented Generation (RAG)',
    category: 'AI & LLMs',
    estimatedMinutes: 30,
    summary: 'Vector embeddings, chunking strategies, hybrid BM25 + dense search, rerankers, and RAG evaluation frameworks.',
    url: '/courses/rag/interview-qa'
  },
  {
    id: 8,
    title: 'Data Structures & Algorithms Interview Strategy',
    lessonSlug: 'interview-qa',
    courseSlug: 'dsa',
    courseTitle: 'Data Structures & Algorithms',
    category: 'Interview Prep',
    estimatedMinutes: 30,
    summary: 'Algorithmic patterns, time-space complexity tradeoffs, tree/graph traversal, and coding interview communication strategy.',
    url: '/courses/dsa/interview-qa'
  }
];

export default function InterviewHubPage() {
  const [guides, setGuides] = useState<InterviewGuide[]>(FALLBACK_GUIDES);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    let isMounted = true;
    fetchInterviewGuides()
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setGuides(data);
        }
      })
      .catch(() => {
        // Fallback guides stay active
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Distinct categories with counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: guides.length };
    guides.forEach((g) => {
      const cat = g.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const standardOrder = [
      'All',
      'Frontend',
      'Backend',
      'System Design',
      'Cloud & DevOps',
      'DevOps',
      'Databases',
      'AI & LLMs',
      'Computer Science',
      'Interview Prep'
    ];

    const present = Object.keys(counts).filter((c) => c !== 'All');
    present.sort((a, b) => {
      const idxA = standardOrder.indexOf(a);
      const idxB = standardOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return ['All', ...present].map((name) => ({
      name,
      count: counts[name] || 0
    }));
  }, [guides]);

  // Filtered guides based on search query and category
  const filteredGuides = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return guides.filter((g) => {
      const matchesCategory = selectedCategory === 'All' || g.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.courseTitle.toLowerCase().includes(q) ||
        g.courseSlug.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        (g.summary && g.summary.toLowerCase().includes(q))
      );
    });
  }, [guides, searchQuery, selectedCategory]);

  // Featured top guides for quick launch
  const featuredPicks = useMemo(() => {
    const topSlugs = ['angular', 'springboot', 'hld', 'production-rag', 'rag', 'aws', 'dsa'];
    return guides.filter((g) => topSlugs.includes(g.courseSlug)).slice(0, 4);
  }, [guides]);

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-24">
      {/* 1. HERO HEADER */}
      <section className="border-b border-white/[0.06] bg-[#080c14] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-mono text-sky-400 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>Senior Technical Interview Knowledge Vault</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
            Technical Interview Master Guides
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-sm text-slate-400 leading-relaxed">
            Battle-tested senior engineering questions, real-world code snippets, and architectural trade-offs organized across <strong className="text-white font-semibold">{guides.length}+ technology domains</strong>.
          </p>

          {/* Quick Metrics */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{guides.length} Curated Tracks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
              <span>1,200+ Verified Q&As</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-sky-400" />
              <span>Edge Cases & Concurrency</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="mx-auto mt-8 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search interview guides (e.g. Angular, Spring Boot, Kafka, AWS, DSA, SQL)..."
              className="w-full rounded-lg border border-white/[0.08] bg-[#0c1019] pl-11 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 hover:text-white bg-white/[0.06] px-2 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT AREA */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
        {/* Category Pills Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none cursor-pointer ${
                  isActive
                    ? 'text-sky-300 font-semibold'
                    : 'bg-[#0c1019] text-slate-400 border border-white/[0.06] hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="interview-category-pill"
                    className="absolute inset-0 rounded-md bg-sky-500/15 border border-sky-500/30"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{cat.name}</span>
                <span
                  className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-white/[0.04] text-slate-500'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* High-Yield Top Picks (Visible when on "All" and no search) */}
        {selectedCategory === 'All' && !searchQuery.trim() && featuredPicks.length > 0 && (
          <div className="mt-8 mb-12">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Frequently Interviewed Senior Tracks</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">Essential Focus</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredPicks.map((pick) => (
                <motion.div
                  key={pick.id}
                  whileHover={{ y: -4, borderColor: 'rgba(56, 189, 248, 0.35)' }}
                  className="rounded-xl border border-white/[0.08] bg-[#0a0e17] transition-colors"
                >
                  <Link
                    href={pick.url}
                    className="group p-5 flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-3">
                        <span className="font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 text-[11px] font-mono">
                          {pick.category}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3" />
                          {pick.estimatedMinutes || 30}m
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm group-hover:text-sky-400 transition-colors line-clamp-2">
                        {pick.courseTitle}
                      </h3>

                      <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {pick.summary || `Senior technical interview drilling guide for ${pick.courseTitle}.`}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:text-sky-300">
                      <span>Study Master Q&A</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Results Header */}
        <div className="mt-8 flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 font-mono">
            <Briefcase className="h-3.5 w-3.5 text-sky-400" />
            <span>
              {selectedCategory === 'All' ? 'All Interview Guides' : `${selectedCategory} Tracks`}
            </span>
            <span className="text-slate-500">({filteredGuides.length} available)</span>
          </div>
          {searchQuery && (
            <span className="text-xs text-slate-400 font-mono">
              Matching <span className="text-white font-medium">"{searchQuery}"</span>
            </span>
          )}
        </div>

        {/* Cards Grid */}
        {filteredGuides.length === 0 ? (
          <div className="py-20 text-center rounded-xl border border-dashed border-white/[0.08] mt-6">
            <HelpCircle className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No interview guides found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              No tracks match your current search query "{searchQuery}". Try searching for another tech stack.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-4 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filteredGuides.map((guide, idx) => {
              const tags = TECH_TAGS_MAP[guide.courseSlug] || [
                'Architecture Tradeoffs',
                'Code Edge Cases',
                'Core Concepts',
                'Mock Scenarios'
              ];

              return (
                <motion.div
                  key={`${guide.courseSlug}-${guide.lessonSlug}-${guide.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                  whileHover={{ y: -3, borderColor: 'rgba(56, 189, 248, 0.35)' }}
                  className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 transition-colors flex flex-col justify-between group"
                >
                  <div>
                    {/* Top row: Category badge & duration */}
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-white/[0.06]">
                        {guide.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                        <Clock className="h-3 w-3" />
                        {guide.estimatedMinutes || 25} min
                      </span>
                    </div>

                    {/* Course Title & Lesson Title */}
                    <div className="mb-2">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-400 block">
                        {guide.courseTitle}
                      </span>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors mt-0.5 line-clamp-2">
                        {guide.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">
                      {guide.summary ||
                        `Senior-level interview questions, concrete code examples, and technical tradeoffs for ${guide.courseTitle}.`}
                    </p>

                    {/* Key High-Yield Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer link button */}
                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Interactive Q&A + Notes</span>
                    <Link
                      href={guide.url}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold border border-sky-500/25 transition-colors"
                    >
                      <span>Study Guide</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
