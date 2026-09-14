'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, ArrowDown, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RoadmapsPage() {
  const roadmaps = [
    {
      title: 'Backend Engineering Roadmap',
      desc: 'Master enterprise backend architectures from core programming to cloud containerization.',
      steps: [
        { name: 'Java Fundamentals & Concurrency', slug: 'java' },
        { name: 'Spring Boot 3 & 4 (IoC, Web, JPA)', slug: 'springboot' },
        { name: 'Relational & NoSQL Databases', slug: 'databases' },
        { name: 'Microservices Architecture & Resilience', slug: 'microservices-and-cloud' },
        { name: 'Docker Containerization', slug: 'docker' },
        { name: 'AWS Cloud Services (ECS, RDS, S3)', slug: 'aws' },
        { name: 'Kubernetes Production Orchestration', slug: 'kubernetes' },
      ],
    },
    {
      title: 'Full Stack Engineering Roadmap',
      desc: 'Build scalable modern web applications from responsive frontends to cloud deployments.',
      steps: [
        { name: 'Modern JavaScript (ES6+)', slug: 'javascript' },
        { name: 'TypeScript Static Typing', slug: 'typescript' },
        { name: 'React Component Architecture & Hooks', slug: 'react' },
        { name: 'Next.js App Router & Server Components', slug: 'nextjs' },
        { name: 'Node.js & Express / NestJS', slug: 'nodejs' },
        { name: 'Databases & ORMs', slug: 'databases' },
        { name: 'Cloud & CI/CD Deployment', slug: 'githubactions' },
      ],
    },
    {
      title: 'AI Engineering & LLMs Roadmap',
      desc: 'Build generative AI applications, agentic workflows, and semantic search systems.',
      steps: [
        { name: 'Python & AI Fundamentals', slug: 'computerfundamentals' },
        { name: 'Retrieval-Augmented Generation (RAG)', slug: 'rag' },
        { name: 'Vector Databases & Similarity Search', slug: 'databases' },
        { name: 'LangChain Orchestration Framework', slug: 'langchain' },
        { name: 'LangGraph Stateful Multi-Agent Workflows', slug: 'langgraph' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="pb-8 border-b border-slate-800">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
          <Layers className="h-3.5 w-3.5" />
          <span>Interactive Career Roadmaps</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Structured Technology Roadmaps</h1>
        <p className="mt-1 text-sm text-slate-400">
          Visual career pathways designed to guide your progression from foundational engineering to senior architect.
        </p>
      </div>

      <div className="mt-10 space-y-12">
        {roadmaps.map((rm, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-2">{rm.title}</h2>
            <p className="text-xs text-slate-400 mb-8">{rm.desc}</p>

            <div className="flex flex-col items-center max-w-md mx-auto space-y-3">
              {rm.steps.map((step, sIdx) => (
                <React.Fragment key={sIdx}>
                  <Link
                    href={`/courses/${step.slug}`}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 font-mono text-xs font-bold text-blue-400 border border-blue-500/20">
                        {sIdx + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-300">
                        {step.name}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </Link>

                  {sIdx < rm.steps.length - 1 && (
                    <ArrowDown className="h-4 w-4 text-slate-600 my-1" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
