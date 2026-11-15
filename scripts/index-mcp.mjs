import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../frontend/node_modules/@neondatabase/serverless/index.js';
const { neon } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_9NKSpLyAP6gw@ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const contentDir = path.resolve(__dirname, '..', 'content', 'MCP');

function formatModuleTitle(name) {
  let cleaned = name.replace(/^(Phase-\d+-?|\d+-?)/i, '');
  cleaned = cleaned.replace(/-/g, ' ');
  const acronyms = {
    mcp: 'MCP',
    jsonrpc: 'JSON-RPC',
    sse: 'SSE',
    stdio: 'stdio',
    sdk: 'SDK',
    api: 'API',
    cicd: 'CI/CD',
    hitl: 'HITL'
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
    mcp: 'MCP',
    jsonrpc: 'JSON-RPC',
    sse: 'SSE',
    stdio: 'stdio',
    sdk: 'SDK',
    api: 'API',
    llm: 'LLM',
    llms: 'LLMs',
    ci: 'CI',
    cd: 'CD',
    qa: 'Q&A',
    hitl: 'HITL',
    and: 'and',
    or: 'or',
    with: 'with',
    vs: 'vs',
    to: 'to',
    in: 'in',
    of: 'of',
    for: 'for'
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

function extractDescription(readmePath) {
  if (!fs.existsSync(readmePath)) return 'Comprehensive production-grade mastery course on Model Context Protocol (MCP).';
  const text = fs.readFileSync(readmePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('!')) {
      const cleaned = trimmed.replace(/[*_`\[\]]/g, '').trim();
      if (cleaned.length > 50) {
        return cleaned.length > 220 ? cleaned.substring(0, 217) + '...' : cleaned;
      }
    }
  }
  return 'Master Model Context Protocol (MCP): architecture, tools, resources, prompts, security, and multi-agent orchestration.';
}

async function indexMcp() {
  console.log('[INDEXER] Indexing MCP course into Neon PostgreSQL...');

  const slug = 'mcp';
  const title = 'Model Context Protocol (MCP)';
  const category = 'AI & LLMs';
  const level = 'Intermediate';
  const icon = 'brain';
  const description = extractDescription(path.join(contentDir, 'README.md'));

  // 1. Check or Insert Course
  let courseRows = await sql`SELECT id FROM courses WHERE LOWER(slug) = 'mcp' LIMIT 1`;
  let courseId;
  if (courseRows.length === 0) {
    const inserted = await sql`
      INSERT INTO courses (slug, title, description, category, level, icon, total_lessons, estimated_hours)
      VALUES (${slug}, ${title}, ${description}, ${category}, ${level}, ${icon}, 0, 10)
      RETURNING id
    `;
    courseId = inserted[0].id;
    console.log(`[INDEXER] Created new course 'mcp' with ID: ${courseId}`);
  } else {
    courseId = courseRows[0].id;
    await sql`
      UPDATE courses 
      SET title = ${title}, description = ${description}, category = ${category}, level = ${level}, icon = ${icon}
      WHERE id = ${courseId}
    `;
    console.log(`[INDEXER] Found existing course 'mcp' with ID: ${courseId}`);
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
      // Exactly matches the file_path pattern in DB: /content/MCP/<modDir>/<file>
      const filePath = `/content/MCP/${modName}/${f}`;

      let lessonRows = await sql`
        SELECT id FROM lessons WHERE module_id = ${modId} AND slug = ${lessonSlug} LIMIT 1
      `;
      if (lessonRows.length === 0) {
        await sql`
          INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
          VALUES (${lessonSlug}, ${lessonTitle}, ${filePath}, ${lessonOrder}, 20, ${modId})
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

  const estimatedHours = Math.max(10, Math.round(totalLessonCount * 45 / 60));
  await sql`
    UPDATE courses 
    SET total_lessons = ${totalLessonCount}, estimated_hours = ${estimatedHours}
    WHERE id = ${courseId}
  `;

  console.log(`[INDEXER] Successfully indexed MCP! Total lessons: ${totalLessonCount}, Est hours: ${estimatedHours}`);
}

indexMcp().catch(err => {
  console.error('[INDEXER] Error indexing MCP:', err);
  process.exit(1);
});
