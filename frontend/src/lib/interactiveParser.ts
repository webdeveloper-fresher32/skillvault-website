import { QAPair } from '@/components/interactive/FlipCardDeck';
import { ExerciseItem } from '@/components/interactive/ExerciseChecklist';
import { CodeToggleProps } from '@/components/interactive/CodeToggle';

export interface ParsedLessonContent {
  mainMarkdown: string;
  qaItems: QAPair[];
  exercises: ExerciseItem[];
  exerciseTitle?: string;
  codeToggles: CodeToggleProps[];
  hasInteractiveComponents: boolean;
}

/**
 * Checks if a string contains Mermaid diagram syntax.
 */
export function isMermaidCode(text: string, className?: string): boolean {
  if (className && (className.includes('language-mermaid') || className.includes('mermaid'))) {
    return true;
  }
  if (!text) return false;

  const trimmed = text.trim();
  const clean = trimmed
    .replace(/^<div\s+class=["']mermaid["']>([\s\S]*?)<\/div>$/i, '$1')
    .trim();

  const mermaidKeywords = [
    'flowchart',
    'graph TD',
    'graph LR',
    'graph TB',
    'graph BT',
    'graph RL',
    'sequenceDiagram',
    'stateDiagram',
    'classDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'C4Context',
    'mindmap',
    'timeline',
    'architecture',
  ];

  for (const kw of mermaidKeywords) {
    if (clean.startsWith(kw) || clean.startsWith(kw.toLowerCase())) {
      return true;
    }
  }

  // Also check if it defines flowchart or classDef and has connections
  if (
    (clean.includes('flowchart TD') || clean.includes('flowchart LR') || clean.includes('flowchart TB')) &&
    clean.includes('-->')
  ) {
    return true;
  }

  if (clean.includes('classDef') && (clean.includes('-->') || clean.includes('subgraph'))) {
    return true;
  }

  if (clean.includes('subgraph') && clean.includes('end') && clean.includes('-->')) {
    return true;
  }

  return false;
}

/**
 * Extracts and cleans Mermaid code from potential markdown / HTML wrappers.
 */
export function extractMermaidCode(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // If wrapped in display(HTML("""...<div class="mermaid">...</div>..."""))
  const divMatch = text.match(/<div\s+class=["']mermaid["']>([\s\S]*?)<\/div>/i);
  if (divMatch) {
    text = divMatch[1].trim();
  }

  // Strip markdown code fences if wrapped
  text = text.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  return text;
}

/**
 * Checks if a string contains ASCII diagram box/arrow characters.
 */
export function isAsciiDiagram(text: string): boolean {
  if (!text) return false;
  if (isMermaidCode(text)) return false;

  const diagramMarkers = ['┌', '└', '├', '┤', '│', '─', '──▶', '──>', '▲', '▼', '◄──', '◄──▶', '|---', '+---', '+===', '→', '-->', '──►'];
  let markerHits = 0;
  for (const marker of diagramMarkers) {
    if (text.includes(marker)) {
      markerHits++;
      if (markerHits >= 2) return true;
    }
  }
  return false;
}

/**
 * Extracts Q&A pairs from "## Interview Q&A" or "## Interview Angle".
 */
export function parseQAPairs(markdown: string): { qaItems: QAPair[]; remainingMarkdown: string } {
  // 1. Check for standard Interview Q&A section
  const qaSectionRegex = /(?:^|\n)##\s+(?:\d+[\.\-\s]+)?(?:Interview\s+)?(?:Q&A|Questions|Recap Questions)([\s\S]*?)(?=(?:\n##\s+)|\s*$)/i;
  const match = markdown.match(qaSectionRegex);

  if (match) {
    const qaSectionBody = match[1];
    const remainingMarkdown = markdown.replace(match[0], '\n\n');

    const qaItems: QAPair[] = [];
    const itemRegex = /\*\*Q:\s*(.*?)\*\*\s*(?:Answer:)?\s*([\s\S]*?)(?=(?:\n\*\*Q:)|$)/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(qaSectionBody)) !== null) {
      const question = itemMatch[1].trim();
      const answer = itemMatch[2].replace(/^Answer:\s*/i, '').trim();

      if (question && answer) {
        qaItems.push({
          question,
          answer,
          category: 'Interview Prep',
        });
      }
    }

    if (qaItems.length > 0) {
      return { qaItems, remainingMarkdown };
    }
  }

  // 2. Fallback: Check for "## Interview Angle" with bulleted questions like - "Question?" — Answer...
  const angleRegex = /(?:^|\n)##\s+(?:\d+[\.\-\s]+)?Interview\s+Angle([\s\S]*?)(?=(?:\n##\s+)|\s*$)/i;
  const angleMatch = markdown.match(angleRegex);
  if (angleMatch) {
    const angleBody = angleMatch[1];
    const qaItems: QAPair[] = [];
    const bulletRegex = /-\s*["“]([^"”]+)["”]\s*—\s*([^\n]+)/g;
    let bMatch;
    while ((bMatch = bulletRegex.exec(angleBody)) !== null) {
      const question = bMatch[1].trim();
      const answer = bMatch[2].trim();
      if (question && answer) {
        qaItems.push({
          question,
          answer,
          category: 'Interview Follow-Up',
        });
      }
    }

    if (qaItems.length > 0) {
      const remainingMarkdown = markdown.replace(angleMatch[0], '\n\n');
      return { qaItems, remainingMarkdown };
    }
  }

  return { qaItems: [], remainingMarkdown: markdown };
}

/**
 * Extracts hands-on exercises from "## Interview-Style Exercise" or "## Hands-On Exercises".
 */
export function parseExercises(markdown: string): { exercises: ExerciseItem[]; remainingMarkdown: string; exerciseTitle?: string } {
  const exerciseRegex = /(?:^|\n)(##\s+((?:\d+[\.\-\s]+)?(?:Interview-Style\s+|Hands-On\s+|Practice\s+|Refactor\s+|Implementation\s+)?(?:Verification\s+)?(?:Drills?|Exercises?)[^\n]*))\n([\s\S]*?)(?=(?:\n##\s+)|\s*$)/i;
  const match = markdown.match(exerciseRegex);

  if (!match) {
    return { exercises: [], remainingMarkdown: markdown };
  }

  const fullHeadingLine = match[1]; // e.g. "## 8. Hands-On Exercises"
  const rawTitle = match[2].trim(); // e.g. "8. Hands-On Exercises"
  const exerciseBody = match[3];

  const exercises: ExerciseItem[] = [];

  // Clean title for card display (removes leading "8. ")
  const displayTitle = rawTitle.replace(/^\d+[\.\-\s]+/, '').trim() || 'Hands-On Exercises';

  // 1. Check for multiple numbered exercises like "**Exercise 1:** ..."
  const multiExRegex = /\*\*Exercise\s+(\d+):\*\*\s*([\s\S]*?)(?=(?:\*\*Exercise\s+\d+:)|(?:\n---)|\s*$)/gi;
  let exMatch;
  while ((exMatch = multiExRegex.exec(exerciseBody)) !== null) {
    const num = exMatch[1];
    const text = exMatch[2].trim();
    if (text) {
      exercises.push({
        id: `ex-${num}`,
        title: `Exercise ${num}`,
        problem: text,
      });
    }
  }

  // 2. Check for standard Markdown numbered list: "1. Do this...\n2. Do that..."
  if (exercises.length === 0) {
    const numberedItemRegex = /(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=(?:\n\d+\.)|(?:\n---)|\s*$)/g;
    let nMatch;
    while ((nMatch = numberedItemRegex.exec(exerciseBody)) !== null) {
      const num = nMatch[1];
      const text = nMatch[2].trim();
      if (text) {
        exercises.push({
          id: `ex-${num}`,
          title: `Task ${num}`,
          problem: text,
        });
      }
    }
  }

  // 3. Check for single Interview-Style Refactor prompt with code block
  if (exercises.length === 0) {
    const promptMatch = exerciseBody.match(/\*\*Prompt:\*\*\s*([^\n]+)/i);
    const codeBlocks = Array.from(exerciseBody.matchAll(/```(?:[a-z]+)?\n([\s\S]*?)```/gi));

    // Only treat as refactor drill if there is an explicit prompt or code block
    if (promptMatch || codeBlocks.length > 0) {
      const promptText = promptMatch ? promptMatch[1].trim().replace(/^"|"$/g, '') : 'Refactor the given code to satisfy clean architecture standards.';
      const problemCode = codeBlocks[0] ? codeBlocks[0][1].trim() : undefined;
      const solutionCode = codeBlocks[1] ? codeBlocks[1][1].trim() : undefined;

      const talkingPointsMatch = exerciseBody.match(/(?:Talking points|Interview talking points|Say out loud)[^:]*:\s*([\s\S]*?)$/i);
      const talkingPoints = talkingPointsMatch ? talkingPointsMatch[1].trim() : undefined;

      exercises.push({
        id: 'exercise-1',
        title: 'Exercise 1: ' + (promptText.length > 60 ? promptText.substring(0, 57) + '...' : promptText),
        problem: promptText,
        promptCode: problemCode,
        solutionCode: solutionCode,
        talkingPoints: talkingPoints,
      });
    }
  }

  // If no structured exercises were found, do NOT strip or alter the markdown!
  if (exercises.length === 0) {
    return { exercises: [], remainingMarkdown: markdown };
  }

  // Replace with the original H2 heading preserved, followed by an in-place placeholder
  // This keeps the heading (e.g. ## 8. Hands-On Exercises) in the markdown document
  // so timeline scrollspy and heading anchors remain intact!
  const remainingMarkdown = markdown.replace(match[0], `\n\n${fullHeadingLine}\n\n__EXERCISES_PLACEHOLDER__\n\n`);

  return { exercises, remainingMarkdown, exerciseTitle: displayTitle };
}

/**
 * Extracts Bad vs Good example sections and bundles them into CodeToggle props.
 */
export function parseBadGoodSections(markdown: string): {
  codeToggles: CodeToggleProps[];
  remainingMarkdown: string;
} {
  // Regex looking for:
  // ## ... The Bad Example ... ```code```
  // followed by
  // ## ... The Good Example ... ```code```
  const badGoodRegex = /(?:^|\n)##\s+(?:\d+[\.\-\s]+)?The\s+Bad\s+Example[^\n]*\n([\s\S]*?)(?=##\s+(?:\d+[\.\-\s]+)?The\s+Good\s+Example)##\s+(?:\d+[\.\-\s]+)?The\s+Good\s+Example[^\n]*\n([\s\S]*?)(?=(?:\n##\s+(?:\d+[\.\-\s]+)?[A-Z])|\s*$)/i;

  const match = markdown.match(badGoodRegex);
  if (!match) {
    return { codeToggles: [], remainingMarkdown: markdown };
  }

  const badBlock = match[1];
  const goodBlock = match[2];

  // Extract code from bad block
  const badCodeMatch = badBlock.match(/```(?:[a-z]+)?\n([\s\S]*?)```/i);
  const badCode = badCodeMatch ? badCodeMatch[1].trim() : '';

  // Extract code from good block
  const goodCodeMatch = goodBlock.match(/```(?:[a-z]+)?\n([\s\S]*?)```/i);
  const goodCode = goodCodeMatch ? goodCodeMatch[1].trim() : '';

  // Extract explanations
  const badExpMatch = badBlock.match(/(?:Smell:|Problem:|Why It's a Smell)([\s\S]*?)(?:```|\||\n##|$)/i);
  const badExplanation = badExpMatch ? badExpMatch[1].trim().replace(/\*+/g, '').replace(/\n+/g, ' ').substring(0, 240) : undefined;

  const goodExpMatch = goodBlock.match(/(?:Why This Is Better|Why this is better)([\s\S]*?)(?:```|\||\n##|$)/i);
  const goodExplanation = goodExpMatch ? goodExpMatch[1].trim().replace(/\*+/g, '').replace(/\n+/g, ' ').substring(0, 240) : undefined;

  if (badCode && goodCode) {
    const toggle: CodeToggleProps = {
      badTitle: '✕ Bad: Code Smell / Fragile Approach',
      badCode,
      badExplanation,
      goodTitle: '✓ Good: Refactored & Cohesive Fix',
      goodCode,
      goodExplanation,
    };

    // Replace the matched section with a placeholder marker
    const remainingMarkdown = markdown.replace(match[0], '\n\n__CODE_TOGGLE_PLACEHOLDER__\n\n');
    return { codeToggles: [toggle], remainingMarkdown };
  }

  return { codeToggles: [], remainingMarkdown: markdown };
}

/**
 * Strips accidental 4+ space indentations on non-code lines outside of fenced code blocks.
 * In CommonMark, 4 leading spaces creates an indented code block (<pre><code>).
 * When copying/exporting from rich HTML, nested card divs turn into 4-8 space indented text,
 * which erroneously renders as raw code boxes with Copy buttons.
 */
export function sanitizeAccidentalIndentedCodeBlocks(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const cleaned: string[] = [];
  let inFencedCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inFencedCode = !inFencedCode;
      cleaned.push(line);
      continue;
    }

    if (inFencedCode) {
      cleaned.push(line);
      continue;
    }

    // Outside fenced code:
    if (!trimmed) {
      cleaned.push('');
      continue;
    }

    // Check if line has 4+ leading spaces or tabs
    const leadingSpaces = line.length - line.trimStart().length;
    if (line.startsWith('\t') || leadingSpaces >= 4) {
      // If line is markdown formatted or prose
      if (
        trimmed.startsWith('**') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('###') ||
        trimmed.startsWith('##') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('- ') ||
        trimmed.startsWith('1. ') ||
        trimmed.startsWith('2. ') ||
        trimmed.startsWith('3. ') ||
        trimmed.startsWith('4. ') ||
        trimmed.startsWith('5. ') ||
        trimmed.startsWith('[') ||
        trimmed.startsWith('<radio') ||
        trimmed.startsWith('{#') ||
        !/^[a-z_][a-z0-9_]*\s*[:=(]/i.test(trimmed)
      ) {
        cleaned.push(trimmed);
        continue;
      }
    }

    cleaned.push(line);
  }

  // Collapse 3+ consecutive newlines to at most 2 newlines
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Main parser function to prepare markdown and interactive components.
 */
export function parseLessonContent(rawMarkdown: string): ParsedLessonContent {
  let text = sanitizeAccidentalIndentedCodeBlocks(rawMarkdown || '');

  // 1. Extract Q&A
  const { qaItems, remainingMarkdown: textWithoutQA } = parseQAPairs(text);
  text = textWithoutQA;

  // 2. Extract Exercises
  const { exercises, remainingMarkdown: textWithoutEx, exerciseTitle } = parseExercises(text);
  text = textWithoutEx;

  // 3. Extract Bad vs Good Code
  const { codeToggles, remainingMarkdown: textWithToggles } = parseBadGoodSections(text);
  text = textWithToggles;

  const hasInteractive = qaItems.length > 0 || exercises.length > 0 || codeToggles.length > 0;

  return {
    mainMarkdown: text,
    qaItems,
    exercises,
    exerciseTitle,
    codeToggles,
    hasInteractiveComponents: hasInteractive,
  };
}
