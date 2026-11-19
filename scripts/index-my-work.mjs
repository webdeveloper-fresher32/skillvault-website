import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../frontend/node_modules/@neondatabase/serverless/index.js';
const { neon } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const contentDir = path.resolve(__dirname, '..', 'content', 'My-Work');

function formatModuleTitle(name) {
  let cleaned = name.replace(/^(Phase-\d+-?|\d+-?)/i, '');
  cleaned = cleaned.replace(/-/g, ' ');
  const acronyms = {
    rag: 'RAG',
    sse: 'SSE',
    hitl: 'HITL',
    acid: 'ACID',
    rrf: 'RRF',
    ai: 'AI',
    api: 'API',
  };
  return cleaned
    .split(/\s+/)
    .map(w => acronyms[w.toLowerCase()] || (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

function formatLessonTitle(name) {
  let cleaned = name.replace(/^\d+-?/, '');
  cleaned = cleaned.replace(/-/g, ' ');
  const acronyms = {
    rag: 'RAG',
    sse: 'SSE',
    hitl: 'HITL',
    acid: 'ACID',
    rrf: 'RRF',
    ai: 'AI',
    api: 'API',
    and: 'and',
    of: 'of',
    in: 'in',
    for: 'for',
    to: 'to'
  };
  return cleaned
    .split(/\s+/)
    .map((w, idx) => {
      const lower = w.toLowerCase();
      if (acronyms[lower]) {
        return (idx === 0) ? (acronyms[lower].charAt(0).toUpperCase() + acronyms[lower].slice(1)) : acronyms[lower];
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .trim();
}

async function indexMyWork() {
  console.log('[INDEXER] Indexing My Work course into Neon PostgreSQL...');

  const slug = 'my-work';
  const title = 'My Work: Production Engineering Blueprints';
  const category = 'My Work';
  const level = 'Advanced';
  const icon = 'sparkles';
  const description = 'Exhaustive production architectures, distributed locking, multi-tenant RAG, LangGraph agent workflows, and senior technical interview battle cards.';

  // 1. Check or Insert Course
  let courseRows = await sql`SELECT id FROM courses WHERE LOWER(slug) = 'my-work' LIMIT 1`;
  let courseId;
  if (courseRows.length === 0) {
    const inserted = await sql`
      INSERT INTO courses (slug, title, description, category, level, icon, total_lessons, estimated_hours)
      VALUES (${slug}, ${title}, ${description}, ${category}, ${level}, ${icon}, 0, 8)
      RETURNING id
    `;
    courseId = inserted[0].id;
    console.log(`[INDEXER] Created new course 'my-work' with ID: ${courseId}`);
  } else {
    courseId = courseRows[0].id;
    await sql`
      UPDATE courses 
      SET title = ${title}, description = ${description}, category = ${category}, level = ${level}, icon = ${icon}
      WHERE id = ${courseId}
    `;
    console.log(`[INDEXER] Found existing course 'my-work' with ID: ${courseId}`);
  }

  // 2. Discover modules
  const subDirs = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
    .sort();

  let moduleOrder = 0;
  let totalLessonCount = 0;

  for (const modName of subDirs) {
    const modSlug = modName.toLowerCase();
    const modTitle = formatModuleTitle(modName);
    moduleOrder++;

    let modRows = await sql`
      SELECT id FROM course_modules WHERE course_id = ${courseId} AND slug = ${modSlug} LIMIT 1
    `;
    let modId;
    if (modRows.length === 0) {
      const insertedMod = await sql`
        INSERT INTO course_modules (slug, title, sort_order, course_id)
        VALUES (${modSlug}, ${modTitle}, ${moduleOrder}, ${courseId})
        RETURNING id
      `;
      modId = insertedMod[0].id;
    } else {
      modId = modRows[0].id;
      await sql`
        UPDATE course_modules 
        SET title = ${modTitle}, sort_order = ${moduleOrder}
        WHERE id = ${modId}
      `;
    }

    const modDirPath = path.join(contentDir, modName);
    const mdFiles = fs.readdirSync(modDirPath)
      .filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
      .sort();

    let lessonOrder = 0;
    for (const f of mdFiles) {
      lessonOrder++;
      totalLessonCount++;
      const lessonSlug = f.replace('.md', '').toLowerCase();
      const lessonTitle = formatLessonTitle(f.replace('.md', ''));
      const filePath = `/content/My-Work/${modName}/${f}`;

      let lessonRows = await sql`
        SELECT id FROM lessons WHERE module_id = ${modId} AND slug = ${lessonSlug} LIMIT 1
      `;
      if (lessonRows.length === 0) {
        await sql`
          INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
          VALUES (${lessonSlug}, ${lessonTitle}, ${filePath}, ${lessonOrder}, 25, ${modId})
        `;
      } else {
        await sql`
          UPDATE lessons 
          SET title = ${lessonTitle}, file_path = ${filePath}, sort_order = ${lessonOrder}
          WHERE id = ${lessonRows[0].id}
        `;
      }
    }
    console.log(`[INDEXER] Module '${modTitle}': indexed ${mdFiles.length} lessons.`);
  }

  const estimatedHours = Math.max(6, Math.round(totalLessonCount * 30 / 60));
  await sql`
    UPDATE courses 
    SET total_lessons = ${totalLessonCount}, estimated_hours = ${estimatedHours}
    WHERE id = ${courseId}
  `;

  console.log(`[INDEXER] Successfully indexed My-Work! Total lessons: ${totalLessonCount}, Est hours: ${estimatedHours}`);
}

indexMyWork().catch(err => {
  console.error('[INDEXER] Error indexing My-Work:', err);
  process.exit(1);
});
