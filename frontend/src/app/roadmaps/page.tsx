'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Layers, ArrowRight, Compass, Terminal, Cpu, Cloud, Database, Brain, Sparkles, CheckCircle2 } from 'lucide-react';

interface CareerTrack {
  id: string;
  title: string;
  badge: string;
  tagline: string;
  icon: React.ReactNode;
  phases: {
    number: string;
    title: string;
    description: string;
    courseLinks: { name: string; slug: string }[];
  }[];
}

const CAREER_TRACKS: CareerTrack[] = [
  {
    id: 'full-stack',
    title: 'Full-Stack Engineer',
    badge: 'End-to-End Product Engineering',
    tagline: 'Master the complete stack from reactive frontends to distributed backends, robust database models, and cloud CI/CD delivery.',
    icon: <Terminal className="h-5 w-5 text-blue-400" />,
    phases: [
      {
        number: 'Phase 1',
        title: 'CS Foundations & Algorithmic Problem Solving',
        description: 'Binary logic, memory hierarchy, system runtimes, arrays, trees, heaps, and algorithmic efficiency.',
        courseLinks: [
          { name: 'Computer Fundamentals', slug: 'computerfundamentals' },
          { name: 'Data Structures & Algorithms', slug: 'dsa' },
        ],
      },
      {
        number: 'Phase 2',
        title: 'Modern Frontend Engineering',
        description: 'ES6+ JavaScript mechanics, DOM & event bubbling, React component architecture, and Next.js App Router.',
        courseLinks: [
          { name: 'JavaScript Deep Dive', slug: 'javascript' },
          { name: 'React Architecture', slug: 'react' },
          { name: 'Next.js Full Stack', slug: 'nextjs' },
        ],
      },
      {
        number: 'Phase 3',
        title: 'Backend Runtime & REST/Microservices APIs',
        description: 'Node.js event loop, Java multi-threading, Spring Boot IoC & REST, and enterprise NestJS microservices.',
        courseLinks: [
          { name: 'Node.js Architecture', slug: 'nodejs' },
          { name: 'Spring Boot 3 & 4 Backend', slug: 'springboot' },
          { name: 'NestJS Microservices', slug: 'nestjs' },
        ],
      },
      {
        number: 'Phase 4',
        title: 'Database Modeling & Distributed Caching',
        description: 'ACID guarantees, indexing theory, query execution plans, document models, and Redis caching topologies.',
        courseLinks: [
          { name: 'Database Systems & Internals', slug: 'databasesfundamentals' },
          { name: 'MySQL & Relational Design', slug: 'mysql' },
          { name: 'MongoDB Architecture', slug: 'mongodb' },
          { name: 'Redis In-Memory & Caching', slug: 'redis' },
        ],
      },
      {
        number: 'Phase 5',
        title: 'Software Engineering & Low-Level Design',
        description: 'Object-oriented modeling, SOLID design principles, structural and behavioral design patterns.',
        courseLinks: [
          { name: 'Low-Level Design (LLD)', slug: 'lld' },
        ],
      },
      {
        number: 'Phase 6',
        title: 'Cloud & CI/CD Deployment',
        description: 'Containerizing services with Docker, cloud infrastructure with AWS, and automated GitHub Actions workflows.',
        courseLinks: [
          { name: 'Docker Containerization', slug: 'docker' },
          { name: 'Amazon Web Services (AWS)', slug: 'aws' },
          { name: 'GitHub Actions CI/CD', slug: 'githubactions' },
        ],
      },
    ],
  },
  {
    id: 'backend',
    title: 'Backend Engineer',
    badge: 'High-Throughput Systems',
    tagline: 'Architect core business logic, resilient microservices, distributed transaction management, and low-latency database engines.',
    icon: <Database className="h-5 w-5 text-emerald-400" />,
    phases: [
      {
        number: 'Phase 1',
        title: 'OS Internals, Concurrency & Networking',
        description: 'Process management, kernel I/O, thread sync, TCP/UDP sockets, TLS handshakes, HTTP protocols, and shell scripting.',
        courseLinks: [
          { name: 'Operating Systems', slug: 'operatingsystems' },
          { name: 'Shell Scripting', slug: 'shellscripting' },
          { name: 'Computer Networking', slug: 'networking' },
        ],
      },
      {
        number: 'Phase 2',
        title: 'Data Structures & Algorithmic Optimization',
        description: 'Tree balancing, graph traversals, Dijkstra/MST, dynamic programming, and production cache design.',
        courseLinks: [
          { name: 'Data Structures & Algorithms', slug: 'dsa' },
        ],
      },
      {
        number: 'Phase 3',
        title: 'Backend Runtimes & Concurrent Processing',
        description: 'Java multi-threading, JVM memory management, Spring Boot 3 enterprise stack, and event-driven Node.js.',
        courseLinks: [
          { name: 'Java Master Track', slug: 'java' },
          { name: 'Spring Boot 3 & 4 Backend', slug: 'springboot' },
          { name: 'Node.js Architecture', slug: 'nodejs' },
        ],
      },
      {
        number: 'Phase 4',
        title: 'Database Architecture & Transactional Systems',
        description: 'Relational query optimization, B-Tree and LSM storage engines, distributed sharding, and high-volume Redis clusters.',
        courseLinks: [
          { name: 'Database Systems & Internals', slug: 'databasesfundamentals' },
          { name: 'MySQL & Relational Design', slug: 'mysql' },
          { name: 'Redis In-Memory & Caching', slug: 'redis' },
        ],
      },
      {
        number: 'Phase 5',
        title: 'Low-Level Design & Clean Architecture',
        description: 'SOLID principles, design patterns (Strategy, Observer, Decorator, Factory), and domain-driven design.',
        courseLinks: [
          { name: 'Low-Level Design (LLD)', slug: 'lld' },
        ],
      },
      {
        number: 'Phase 6',
        title: 'High-Level System Design & Microservices',
        description: 'Rate limiting, message queues, API gateways, CQRS, distributed tracing, and fault-tolerant cloud patterns.',
        courseLinks: [
          { name: 'High-Level Design (HLD)', slug: 'hld' },
          { name: 'Microservices & Cloud Patterns', slug: 'microservices-and-cloud' },
        ],
      },
      {
        number: 'Phase 7',
        title: 'Cloud, Payment Gateways & Production Operations',
        description: 'Deploying with Docker, managing AWS infrastructure, and processing enterprise multi-provider payment systems.',
        courseLinks: [
          { name: 'Payment Gateways & Subscriptions', slug: 'paymentgateways' },
          { name: 'Amazon Web Services (AWS)', slug: 'aws' },
          { name: 'Docker Containerization', slug: 'docker' },
        ],
      },
    ],
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    badge: 'Foundation Models & Agents',
    tagline: 'Harness the 7 Pillars of AI Engineering: from numerical optimization and neural anatomy to production RAG and multi-agent state machines.',
    icon: <Brain className="h-5 w-5 text-purple-400" />,
    phases: [
      {
        number: 'Pillar 1-3',
        title: 'Machine Learning & Deep Learning Foundations',
        description: 'Vector spaces, calculus & gradient descent, scikit-learn algorithms, and PyTorch deep neural networks.',
        courseLinks: [
          { name: 'Machine Learning & Deep Learning', slug: 'machinelearning' },
        ],
      },
      {
        number: 'Pillar 4',
        title: 'Transformers & Foundation Models',
        description: 'Self-attention mechanisms, multi-head attention, positional embeddings, context windows, and token economics.',
        courseLinks: [
          { name: 'Generative AI & LLM Systems', slug: 'genai' },
        ],
      },
      {
        number: 'Pillar 5',
        title: 'Advanced RAG & Vector Retrieval',
        description: 'Parent-document chunking, hybrid BM25 + dense vector search, reranking with Cohere, and pgvector/Pinecone indexes.',
        courseLinks: [
          { name: 'Retrieval-Augmented Generation (RAG)', slug: 'rag' },
          { name: 'LangChain Orchestration', slug: 'langchain' },
        ],
      },
      {
        number: 'Pillar 6',
        title: 'Agentic Architectures & Multi-Agent Loops',
        description: 'Cyclical state graphs, human-in-the-loop checkpoints, tool calling, and long-term memory orchestration with LangGraph.',
        courseLinks: [
          { name: 'LangGraph State Machines', slug: 'langgraph' },
        ],
      },
      {
        number: 'Pillar 7',
        title: 'High-Throughput Serving & LLMOps Evaluation',
        description: 'Token streaming, vLLM continuous batching, RAG evaluation triads (Ragas), and automated CI/CD scoring protocols.',
        courseLinks: [
          { name: 'Generative AI & LLM Systems', slug: 'genai' },
        ],
      },
    ],
  },
  {
    id: 'cloud-devops',
    title: 'Cloud & DevOps Engineer',
    badge: 'Infrastructure as Code & SRE',
    tagline: 'Automate zero-downtime deployments, codify immutable cloud infrastructure with Terraform, and operate elastic Kubernetes clusters.',
    icon: <Cloud className="h-5 w-5 text-sky-400" />,
    phases: [
      {
        number: 'Phase 1',
        title: 'Linux Internals & Shell Automation',
        description: 'Bash scripting, system call auditing, IPC, cron automation, process debugging, and log processing pipelines.',
        courseLinks: [
          { name: 'Operating Systems', slug: 'operatingsystems' },
          { name: 'Shell Scripting', slug: 'shellscripting' },
        ],
      },
      {
        number: 'Phase 2',
        title: 'Networking & Transport Security',
        description: 'Subnetting, CIDR, DNS records, TLS 1.3 handshakes, reverse proxies, and Layer 4/7 load balancers.',
        courseLinks: [
          { name: 'Computer Networking', slug: 'networking' },
        ],
      },
      {
        number: 'Phase 3',
        title: 'Version Control & Continuous Delivery',
        description: 'Git DAG plumbing, rebasing strategies, mono-repo workflows, and automated GitHub Actions CI/CD pipelines.',
        courseLinks: [
          { name: 'Git Architecture & Plumbing', slug: 'git' },
          { name: 'GitHub Actions CI/CD', slug: 'githubactions' },
        ],
      },
      {
        number: 'Phase 4',
        title: 'Containerization with Docker',
        description: 'Multi-stage builds, rootless containers, Docker Compose network bridges, volume caching, and container security.',
        courseLinks: [
          { name: 'Docker Containerization', slug: 'docker' },
        ],
      },
      {
        number: 'Phase 5',
        title: 'Cloud Infrastructure with AWS',
        description: 'VPC peering, IAM least privilege, ECS Fargate clusters, S3 durability, and disaster recovery strategies.',
        courseLinks: [
          { name: 'Amazon Web Services (AWS)', slug: 'aws' },
          { name: 'AWS Local Development', slug: 'aws-local' },
        ],
      },
      {
        number: 'Phase 6',
        title: 'Infrastructure as Code (IaC) with Terraform',
        description: 'Declarative HCL, state management, remote backends with S3/DynamoDB locks, modular architectures, and drift detection.',
        courseLinks: [
          { name: 'Terraform Infrastructure as Code', slug: 'terraform' },
        ],
      },
      {
        number: 'Phase 7',
        title: 'Container Orchestration with Kubernetes',
        description: 'Pods, Deployments, StatefulSets, Ingress controllers, Helm chart packaging, and high-availability production clusters.',
        courseLinks: [
          { name: 'Kubernetes Production Orchestration', slug: 'kubernetes' },
        ],
      },
    ],
  },
];

export default function RoadmapsPage() {
  const [activeTab, setActiveTab] = useState<string>('full-stack');
  const activeTrack = CAREER_TRACKS.find((t) => t.id === activeTab) || CAREER_TRACKS[0];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="pb-8 border-b border-slate-800">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
          <Compass className="h-3.5 w-3.5" />
          <span>Industry Career Tracks</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Career Roadmaps & Learning Pathways</h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
          Step-by-step career tracks modeled after senior engineering requirements. Each track sequences foundational theory, implementation phases, and direct course links.
        </p>

        {/* Tab Selection */}
        <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
          {CAREER_TRACKS.map((track) => (
            <button
              key={track.id}
              onClick={() => setActiveTab(track.id)}
              className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === track.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40'
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {track.icon}
              <span>{track.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Career Track Content */}
      <div className="mt-10">
        {/* Track Highlight Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6 sm:p-8 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div>
              <span className="inline-block rounded-md bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 border border-blue-500/20 mb-2">
                {activeTrack.badge}
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">{activeTrack.title} Pathway</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {activeTrack.phases.length} Progressive Milestones
            </span>
          </div>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-4xl">
            {activeTrack.tagline}
          </p>
        </div>

        {/* Timeline Sequence */}
        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-8">
          {activeTrack.phases.map((phase, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline Marker Dot */}
              <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border-2 border-blue-500 text-[11px] font-mono font-bold text-blue-400 shadow-md shadow-blue-500/20">
                {idx + 1}
              </div>

              {/* Milestone Card */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#0f172a]/70 p-6 hover:border-slate-700 hover:bg-slate-900/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono">
                    {phase.number}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                  {phase.title}
                </h3>

                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {phase.description}
                </p>

                {/* Direct Course Links for this Milestone */}
                <div className="mt-4 pt-4 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    Recommended Learning Courses:
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {phase.courseLinks.map((course, cIdx) => (
                      <Link
                        key={cIdx}
                        href={`/courses/${course.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500/60 hover:bg-blue-600/20 hover:text-blue-300 transition-all"
                      >
                        <CheckCircle2 className="h-3 w-3 text-blue-400" />
                        <span>{course.name}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
