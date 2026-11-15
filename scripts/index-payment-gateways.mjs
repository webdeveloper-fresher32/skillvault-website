import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../frontend/node_modules/@neondatabase/serverless/index.js';
const { neon } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_9NKSpLyAP6gw@ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const contentDir = path.resolve(__dirname, '..', 'content', 'PaymentGateways');

function formatModuleTitle(name) {
  let cleaned = name.replace(/^(Phase-\d+-?|\d+-?)/i, '');
  cleaned = cleaned.replace(/-/g, ' ');
  const acronyms = {
    api: 'API',
    pci: 'PCI',
    dss: 'DSS',
    sca: 'SCA',
    qa: 'Q&A',
    cicd: 'CI/CD'
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
    api: 'API',
    apis: 'APIs',
    pci: 'PCI',
    dss: 'DSS',
    sca: 'SCA',
    qa: 'Q&A',
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

async function indexPaymentGateways() {
  console.log('[INDEXER] Indexing PaymentGateways into Neon PostgreSQL...');

  const slug = 'payment-gateways';
  const title = 'Payment Gateways & Subscriptions';
  const category = 'Backend';
  const level = 'Advanced';
  const icon = 'credit-card';
  const description = 'Master payment gateway architecture, Stripe/Razorpay integrations, webhook idempotency, ACID consistency, and subscription dunning.';

  // 1. Check or Insert Course
  let courseRows = await sql`SELECT id FROM courses WHERE LOWER(slug) IN ('payment-gateways', 'paymentgateways') LIMIT 1`;
  let courseId;
  if (courseRows.length === 0) {
    const inserted = await sql`
      INSERT INTO courses (slug, title, description, category, level, icon, total_lessons, estimated_hours)
      VALUES (${slug}, ${title}, ${description}, ${category}, ${level}, ${icon}, 0, 15)
      RETURNING id
    `;
    courseId = inserted[0].id;
    console.log(`[INDEXER] Created new course '${slug}' with ID: ${courseId}`);
  } else {
    courseId = courseRows[0].id;
    console.log(`[INDEXER] Found existing course ID: ${courseId}`);
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
      const baseName = f.replace(/\.md$/, '');
      const lessonSlug = baseName.toLowerCase();
      const lessonTitle = formatLessonTitle(baseName);
      const filePath = `PaymentGateways/${modName}/${f}`;

      let lessonRows = await sql`
        SELECT id FROM lessons WHERE module_id = ${modId} AND slug = ${lessonSlug} LIMIT 1
      `;
      if (lessonRows.length === 0) {
        await sql`
          INSERT INTO lessons (slug, title, file_path, sort_order, estimated_minutes, module_id)
          VALUES (${lessonSlug}, ${lessonTitle}, ${filePath}, ${lessonOrder}, 25, ${modId})
        `;
        console.log(`  + Inserted lesson: ${lessonTitle}`);
      } else {
        await sql`
          UPDATE lessons 
          SET title = ${lessonTitle}, file_path = ${filePath}, sort_order = ${lessonOrder}
          WHERE id = ${lessonRows[0].id}
        `;
        console.log(`  ~ Updated lesson: ${lessonTitle}`);
      }
    }
  }

  // Update total lessons count on course
  await sql`UPDATE courses SET total_lessons = ${totalLessonCount} WHERE id = ${courseId}`;
  console.log(`[INDEXER] Indexing complete! Total lessons: ${totalLessonCount}`);
}

indexPaymentGateways().catch(err => {
  console.error('[INDEXER ERROR]', err);
  process.exit(1);
});
