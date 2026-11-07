import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainDir } from './lib/main-dir.mjs';
import { parseVideoTable } from './lib/videos.mjs';
import { stripMarkdown } from './lib/md.mjs';

export { parseVideoTable };

export function extractPitch(readme) {
  const para = readme.split(/\n\s*\n/).find((p) => p.trim().startsWith('MinusPod is'));
  if (!para) throw new Error('Pitch paragraph starting with "MinusPod is" not found');
  return stripMarkdown(para.replace(/<[^>]*>/g, '').replace(/\s*\n\s*/g, ' ').trim());
}

const BRAND = ['logo.svg', 'logo-dark.svg', 'favicon.svg', 'apple-touch-icon.png'];

function poster(mp4, jpg) {
  if (existsSync(jpg) && statSync(jpg).mtimeMs > statSync(mp4).mtimeMs) return;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg], { stdio: 'pipe' });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const main = mainDir();
  const out = (p) => {
    const d = resolve(root, 'landing', p);
    mkdirSync(d, { recursive: true });
    return d;
  };
  const videosOut = out('public/videos');
  const shotsOut = out('public/screenshots');
  const brandOut = out('public/brand');
  const genOut = out('src/generated');

  const videosSrc = `${main}/docs/videos`;
  const mp4s = readdirSync(videosSrc).filter((f) => f.endsWith('.mp4'));
  for (const f of mp4s) {
    copyFileSync(`${videosSrc}/${f}`, `${videosOut}/${f}`);
    const m = /^minuspod-(.+?)(-landscape)?\.mp4$/.exec(f);
    if (!m) continue;
    poster(`${videosOut}/${f}`, `${videosOut}/${m[1]}-${m[2] ? 'landscape' : 'portrait'}.jpg`);
  }

  const shots = readdirSync(`${main}/docs/screenshots`).filter((f) => f.endsWith('.png'));
  for (const f of shots) copyFileSync(`${main}/docs/screenshots/${f}`, `${shotsOut}/${f}`);
  for (const f of BRAND) copyFileSync(`${main}/frontend/public/${f}`, `${brandOut}/${f}`);

  const rows = parseVideoTable(readFileSync(`${videosSrc}/README.md`, 'utf8'));
  writeFileSync(`${genOut}/videos.json`, JSON.stringify(rows, null, 2) + '\n');
  const pitch = extractPitch(readFileSync(`${main}/README.md`, 'utf8'));
  writeFileSync(`${genOut}/pitch.json`, JSON.stringify({ pitch }, null, 2) + '\n');
  console.log(`prepare-landing: ${mp4s.length} videos, ${shots.length} screenshots, ${BRAND.length} brand files, ${rows.length} table rows`);
}
