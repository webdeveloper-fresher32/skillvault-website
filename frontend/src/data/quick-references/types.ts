export interface ComparisonTable {
  headers: string[];
  rows: string[][];
}

export interface InterviewQuestion {
  question: string;
  spokenAnswer: string;
  explanation?: string;
}

export interface QuickReferenceTopic {
  id: string;
  number: number;
  title: string;
  section?: string; // 'JavaScript Fundamentals' | 'Node.js Internals and Architecture' | 'Asynchronous Programming' | 'Express.js – Backend Development'
  sectionSlug?: 'javascript' | 'nodejs' | 'async' | 'express';
  category: string;
  categorySlug: string;
  estimatedMinutes: number;
  concept30Sec: string;
  internals: {
    overview: string;
    flowSteps?: string[];
    diagram?: string;
  };
  codeExample: {
    code: string;
    language: string;
    output: string;
    whyOutput: string;
    annotations?: string[];
  };
  nodeJsApplication: {
    scenario: string;
    description: string;
    codeSnippet?: string;
  };
  interviewPrep: {
    questions: InterviewQuestion[];
    trickyFollowUp: {
      question: string;
      answer: string;
    };
    commonMistakes: string[];
  };
  quickRevision: {
    takeaways: string[];
    oneLineDefinition: string;
    interviewTip: string;
    keyDistinction?: string;
    codeSnippetOrDiagram?: string;
  };
  comparisonTable?: ComparisonTable;
}

export interface RevisionState {
  revisedTopicIds: string[];
  bookmarkedTopicIds: string[];
  lastRevisedTimestamps: Record<string, number>; // topicId -> epoch timestamp (ms)
}

export interface CategorySummary {
  name: string;
  slug: string;
  section: string;
  sectionSlug: 'javascript' | 'nodejs' | 'async' | 'express';
  topicCount: number;
  topicIds: string[];
}
