import fs from 'node:fs';
import path from 'node:path';

export interface SubtopicSection {
  id: string;
  title: string;
  level: number;
  content: string;
}

export function readMarkdownFile(rawFilePath: string): string {
  if (!rawFilePath) return '';

  const cleanPath = rawFilePath.startsWith('/') ? rawFilePath.slice(1) : rawFilePath;
  const subPath = cleanPath.startsWith('content/') ? cleanPath.slice('content/'.length) : cleanPath;

  // Statically scoped to process.cwd()/content so Turbopack file tracing stays strictly inside content
  const targetPath = path.join(process.cwd(), 'content', subPath);

  if (fs.existsSync(targetPath)) {
    try {
      return fs.readFileSync(targetPath, 'utf-8');
    } catch (err) {
      console.error('Error reading markdown file at', targetPath, err);
    }
  }

  return '';
}

export function parseSubtopics(markdown: string): SubtopicSection[] {
  if (!markdown) return [];

  const subtopics: SubtopicSection[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentTitle: string | null = null;
  let currentLevel = 2;
  let currentBody: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(?:(?:\d+\.)+\s*)?(.+)$/);
    const h3Match = line.match(/^###\s+(?:(?:\d+\.)+\s*)?(.+)$/);

    if (h2Match || h3Match) {
      if (currentTitle) {
        subtopics.push({
          id: `section-${sectionIndex++}`,
          title: currentTitle,
          level: currentLevel,
          content: currentBody.join('\n').trim(),
        });
        currentBody = [];
      }
      if (h2Match) {
        currentTitle = h2Match[1].trim();
        currentLevel = 2;
      } else if (h3Match) {
        currentTitle = h3Match[1].trim();
        currentLevel = 3;
      }
    } else if (currentTitle) {
      currentBody.push(line);
    }
  }

  if (currentTitle) {
    subtopics.push({
      id: `section-${sectionIndex++}`,
      title: currentTitle,
      level: currentLevel,
      content: currentBody.join('\n').trim(),
    });
  }

  return subtopics;
}
