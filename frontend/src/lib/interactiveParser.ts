import { QAPair } from '@/components/interactive/FlipCardDeck';
import { ExerciseItem } from '@/components/interactive/ExerciseChecklist';
import { CodeToggleProps } from '@/components/interactive/CodeToggle';

export interface ParsedLessonContent {
  mainMarkdown: string;
  qaItems: QAPair[];
  exercises: ExerciseItem[];
  codeToggles: CodeToggleProps[];
  hasInteractiveComponents: boolean;
}

/**
 * Checks if a string contains ASCII diagram box/arrow characters.
 */
export function isAsciiDiagram(text: string): boolean {
  const diagramMarkers = ['┌', '└', '├', '┤', '│', '─', '──▶', '──>', '▲', '▼', '◄──', '◄──▶', '|---', '+---', '+==='];
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
export function parseExercises(markdown: string): { exercises: ExerciseItem[]; remainingMarkdown: string } {
  const exerciseRegex = /(?:^|\n)##\s+(?:\d+[\.\-\s]+)?(?:Interview-Style\s+|Hands-On\s+)?Exercises?([\s\S]*?)(?=(?:\n##\s+)|\s*$)/i;
  const match = markdown.match(exerciseRegex);

  if (!match) {
    return { exercises: [], remainingMarkdown: markdown };
  }

  const exerciseBody = match[1];
  const remainingMarkdown = markdown.replace(match[0], '\n\n');

  const exercises: ExerciseItem[] = [];

  // 1. Check for multiple numbered exercises like "**Exercise 1:** ..."
  const multiExRegex = /\*\*Exercise\s+(\d+):\*\*\s*([\s\S]*?)(?=(?:\*\*Exercise\s+\d+:)|(?:\n---)|\s*$)/gi;
  let exMatch;
  while ((exMatch = multiExRegex.exec(exerciseBody)) !== null) {
    const num = exMatch[1];
    const text = exMatch[2].trim();
    exercises.push({
      id: `ex-${num}`,
      title: `Exercise ${num}`,
      problem: text,
    });
  }

  // 2. Fallback: single Interview-Style Refactor prompt
  if (exercises.length === 0) {
    const promptMatch = exerciseBody.match(/\*\*Prompt:\*\*\s*([^\n]+)/i);
    const promptText = promptMatch ? promptMatch[1].trim().replace(/^"|"$/g, '') : 'Refactor the given code to satisfy clean architecture standards.';

    const codeBlocks = Array.from(exerciseBody.matchAll(/```(?:[a-z]+)?\n([\s\S]*?)```/gi));
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

  return { exercises, remainingMarkdown };
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
 * Main parser function to prepare markdown and interactive components.
 */
export function parseLessonContent(rawMarkdown: string): ParsedLessonContent {
  let text = rawMarkdown;

  // 1. Extract Q&A
  const { qaItems, remainingMarkdown: textWithoutQA } = parseQAPairs(text);
  text = textWithoutQA;

  // 2. Extract Exercises
  const { exercises, remainingMarkdown: textWithoutEx } = parseExercises(text);
  text = textWithoutEx;

  // 3. Extract Bad vs Good Code
  const { codeToggles, remainingMarkdown: textWithToggles } = parseBadGoodSections(text);
  text = textWithToggles;

  const hasInteractive = qaItems.length > 0 || exercises.length > 0 || codeToggles.length > 0;

  return {
    mainMarkdown: text,
    qaItems,
    exercises,
    codeToggles,
    hasInteractiveComponents: hasInteractive,
  };
}
