import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '..', '..', 'content');
const destDir = path.resolve(__dirname, '..', 'content');

function copyMarkdownOnly(source, target) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    const entries = fs.readdirSync(source);
    for (const entry of entries) {
      copyMarkdownOnly(path.join(source, entry), path.join(target, entry));
    }
  } else if (source.endsWith('.md')) {
    fs.copyFileSync(source, target);
  }
}

if (fs.existsSync(srcDir)) {
  console.log(`[sync-content] Copying course markdown files from ${srcDir} to ${destDir}...`);
  copyMarkdownOnly(srcDir, destDir);
  console.log('[sync-content] Markdown sync complete.');
} else {
  console.log('[sync-content] Root content dir not found (using existing frontend/content if present).');
}
